/**
 * 模拟面试接口
 *
 * 一轮流程：选题 → 逐题作答（服务端判客观题 + LLM 点评并追问一层）→ 交卷出六维复盘报告。
 *
 * 三条边界：
 * 1) 客观题对错由服务端按题库算，和练习接口同一套约定 —— 不采信客户端上报的 correct；
 * 2) 题目选项在建会话时就地乱序并重算答案字母，发给客户端的视图里永远没有答案与参考要点，
 *    否则打开 devtools 就能背答案；
 * 3) 报告生成失败时照样返回会话（客观题成绩是真的），只把评审那部分标成不可用，不编分数。
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { query, queryOne, execute, nowIso, newId } = require('../db');
const { authenticateToken } = require('../auth/middleware');
const { chatLimiter, llmConcurrencyGate } = require('../guard');
const { reviewAnswer, buildReport, getLlm } = require('./grader');

const MAX_ANSWER_CHARS = 2000;
const MCQ_COUNT = 6;
const OPEN_COUNT = 2;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// 只有真会打 LLM 的两条路由需要并发闸门；GET 套上会把读请求也算成一次在飞推理
const gateLlm = llmConcurrencyGate();
// 限流也只套在写请求上：一轮面试要发 15 次左右（8 答 + 7 追问），
// 如果"打开历史列表""看报告"也计额度，用户光是回看就能把自己限死
const limitWrites = chatLimiter({ max: Number(process.env.INTERVIEW_RATE_MAX) || 20 });

/** 面试方向 → 取题的分类范围。只列题库里真实存在的分类。 */
const DIRECTIONS = {
  rag: { name: 'RAG 与检索', categories: ['RAG', '向量数据库'] },
  agent: { name: 'AI Agent', categories: ['AI Agent', 'Agent Memory', 'MCP协议'] },
  system: { name: 'AI 系统设计', categories: ['AI系统设计', 'Prompt Engineering'] },
  full: { name: '综合（AI 应用开发岗）', categories: null },
};

/** 开放题从"解释型"题干里挑：这些开头天然要求展开讲，而不是选一个字母 */
const OPEN_TITLE = /^(为什么|怎么|如何|什么是|请(解释|说明|描述)|谈谈|说一下|讲讲)/;

function loadBank() {
  const file = path.join(__dirname, '..', 'data', 'questions.json');
  const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return Array.isArray(list) ? list.filter((q) => q && typeof q.id === 'string') : [];
}

const bank = loadBank();

function stripOption(text) {
  return String(text || '').replace(/^[A-E]\.\s*/, '').trim();
}

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 组卷。选项乱序后答案字母要按"正确选项文本"重新定位，
 * 直接沿用题库字母会判错（乱序后同一个字母指向的是另一句话）。
 */
function toMcqItem(question) {
  const options = (Array.isArray(question.options) ? question.options : []).map(stripOption).filter(Boolean);
  if (options.length < 2 || typeof question.answer !== 'string') return null;

  const correctText = options[question.answer.trim().toUpperCase().charCodeAt(0) - 65];
  if (!correctText) return null;

  const order = shuffle(options.map((text, index) => index));
  const shuffled = order.map((index) => options[index]);
  const answerIndex = shuffled.findIndex((text) => text === correctText);
  if (answerIndex < 0) return null;

  return {
    id: `m_${question.id}`,
    source_id: question.id,
    kind: 'mcq',
    question: question.title,
    category: question.category || '未分类',
    options: shuffled.map((text, index) => `${LETTERS[index]}. ${text}`),
    answer: LETTERS[answerIndex],
    reference: question.content || '',
  };
}

function toOpenItem(question) {
  return {
    id: `o_${question.id}`,
    source_id: question.id,
    kind: 'open',
    question: `${question.title}（请用 2~4 句话讲清，像面试时口头回答那样）`,
    category: question.category || '未分类',
    options: [],
    answer: null,
    reference: question.content || '',
  };
}

function buildItems(directionKey) {
  const direction = DIRECTIONS[directionKey];
  const pool = direction.categories ? bank.filter((q) => direction.categories.includes(q.category)) : bank;

  // 同一道题只能出现一次：开放题和选择题如果撞了同一个 source_id，考第二次没有信息量
  const used = new Set();
  const mcq = [];
  const open = [];

  for (const question of shuffle(pool)) {
    if (used.has(question.id)) continue;
    const isExplanation = OPEN_TITLE.test(String(question.title || '').trim());
    if (open.length < OPEN_COUNT && isExplanation && question.content) {
      open.push(toOpenItem(question));
      used.add(question.id);
      continue;
    }
    if (mcq.length < MCQ_COUNT) {
      const item = toMcqItem(question);
      if (item) {
        mcq.push(item);
        used.add(question.id);
      }
    }
  }

  if (open.length < OPEN_COUNT) {
    for (const question of shuffle(pool)) {
      if (used.has(question.id) || !question.content) continue;
      open.push(toOpenItem(question));
      used.add(question.id);
      if (open.length >= OPEN_COUNT) break;
    }
  }
  return { items: shuffle([...mcq, ...open]), direction };
}

/** 发给客户端的题目视图：不带答案与参考要点 */
function publicItem(item) {
  return { id: item.id, kind: item.kind, question: item.question, category: item.category, options: item.options };
}

const router = express.Router();

/**
 * 分享链接是只读公开的，所以这一条必须注册在 authenticateToken 之前。
 * 挂载路径是 /api/interview，router.use(auth) 会拦截其后注册的所有路由。
 */
router.get('/shared/:id', async (req, res) => {
  const row = await queryOne('SELECT * FROM interview_sessions WHERE id = $1', [req.params.id]);
  if (!row || row.visibility !== 'public') return res.status(404).json({ error: '报告不存在或未公开' });
  // includeAnswers=false：公开链接只给报告和他自己的作答，不给正确答案与参考要点（那是答案本）
  res.json({ report: shapeSession(row, { includeAnswers: false }) });
});

router.use(authenticateToken);

router.get('/directions', (req, res) => {
  res.json({
    directions: Object.entries(DIRECTIONS).map(([key, value]) => {
      const pool = value.categories ? bank.filter((q) => value.categories.includes(q.category)) : bank;
      return { key, name: value.name, available: pool.length };
    }),
    grader_ready: Boolean(getLlm()),
  });
});

router.post('/sessions', limitWrites, async (req, res) => {
  const key = String(req.body?.direction || 'full').toLowerCase();
  if (!DIRECTIONS[key]) return res.status(400).json({ error: '不认识这个面试方向' });

  const { items, direction } = buildItems(key);
  if (!items.length) return res.status(500).json({ error: '该方向下题库为空，换一个方向试试' });

  const id = newId('iv');
  const now = nowIso();
  await execute(
    `INSERT INTO interview_sessions (id, user_id, direction, direction_key, items_json, transcript_json, visibility, created_at)
     VALUES ($1, $2, $3, $4, $5, '[]', 'private', $6)`,
    [id, req.user.id, direction.name, key, JSON.stringify(items), now]
  );

  res.status(201).json({
    session: { id, direction: direction.name, grader_ready: Boolean(getLlm()), items: items.map(publicItem) },
  });
});

/** 逐题作答：客观题就地判分，同时生成点评与追问 */
router.post('/sessions/:id/answer', limitWrites, gateLlm, async (req, res) => {
  const row = await ownSession(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '会话不存在' });
  if (row.finished_at) return res.status(409).json({ error: '这份会话已经交卷了' });

  const items = parseJsonColumn(row.items_json, []);
  const transcript = parseJsonColumn(row.transcript_json, []);
  const item = items.find((it) => it.id === req.body?.item_id);
  if (!item) return res.status(400).json({ error: '题目不在这次面试里' });

  const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim().slice(0, MAX_ANSWER_CHARS) : '';
  if (!answer) return res.status(400).json({ error: '回答不能为空' });

  const graded = gradeMcq(item, answer);
  const review = await reviewAnswer({
    kind: item.kind,
    question: item.question,
    reference: item.reference,
    answer,
  });

  const entry = {
    item_id: item.id,
    kind: item.kind,
    category: item.category,
    question: item.question,
    answer,
    chosen: graded?.chosen ?? null,
    correct_answer: item.answer,
    correct: graded?.correct ?? null,
    reference: item.reference,
    feedback: review?.feedback ?? null,
    follow_up: review?.follow_up ?? null,
    follow_up_answer: null,
    answered_at: nowIso(),
  };
  const at = transcript.findIndex((t) => t.item_id === item.id);
  if (at >= 0) transcript.splice(at, 1, entry);
  else transcript.push(entry);

  await execute('UPDATE interview_sessions SET transcript_json = $1 WHERE id = $2', [JSON.stringify(transcript), row.id]);

  res.json({
    item: {
      item_id: entry.item_id,
      correct: entry.correct,
      chosen: entry.chosen,
      correct_answer: item.answer,
      feedback: entry.feedback,
      follow_up: entry.follow_up,
      reference: entry.reference,
    },
    progress: { answered: transcript.length, total: items.length },
  });
});

/** 追问的回答。不再触发 LLM —— 补充答案会在交卷时一起进复盘依据。 */
router.post('/sessions/:id/followup', limitWrites, async (req, res) => {
  const row = await ownSession(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '会话不存在' });

  const transcript = parseJsonColumn(row.transcript_json, []);
  const entry = transcript.find((t) => t.item_id === req.body?.item_id);
  if (!entry) return res.status(400).json({ error: '这一题还没作答' });

  const text = typeof req.body?.answer === 'string' ? req.body.answer.trim().slice(0, MAX_ANSWER_CHARS) : '';
  entry.follow_up_answer = text || '（跳过）';
  await execute('UPDATE interview_sessions SET transcript_json = $1 WHERE id = $2', [JSON.stringify(transcript), row.id]);
  res.json({ ok: true });
});

router.post('/sessions/:id/finish', limitWrites, gateLlm, async (req, res) => {
  const row = await ownSession(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '会话不存在' });

  const items = parseJsonColumn(row.items_json, []);
  const transcript = parseJsonColumn(row.transcript_json, []);
  const objective = summarize(items, transcript);
  const missing = items.length - transcript.length;

  const built = await buildReport({ direction: row.direction, transcript });
  const report = built.error
    ? { error: built.error, objective, skipped: missing }
    : { ...built, objective, skipped: missing };

  const scoreTotal = built.error ? null : built.score_total;
  await execute(
    `UPDATE interview_sessions SET report_json = $1, score_total = $2, finished_at = $3 WHERE id = $4`,
    [JSON.stringify(report), scoreTotal, nowIso(), row.id]
  );

  res.json({ report });
});

router.get('/sessions', async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
  const rows = await query(
    `SELECT id, direction, direction_key, score_total, visibility, created_at, finished_at, transcript_json
     FROM interview_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [req.user.id, limit]
  );
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      score_total: r.score_total === null ? null : Number(r.score_total),
      answered: parseJsonColumn(r.transcript_json, []).length,
      finished: Boolean(r.finished_at),
      visibility: r.visibility,
      created_at: r.created_at,
    })),
  });
});

router.get('/sessions/:id', async (req, res) => {
  const row = await ownSession(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '会话不存在' });
  res.json({ report: shapeSession(row, { includeAnswers: true }) });
});

router.post('/sessions/:id/share', limitWrites, async (req, res) => {
  const row = await ownSession(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '会话不存在' });
  if (!row.finished_at) return res.status(409).json({ error: '先交卷再分享' });

  const visibility = req.body?.enabled === false ? 'private' : 'public';
  await execute('UPDATE interview_sessions SET visibility = $1 WHERE id = $2', [visibility, row.id]);
  res.json({ visibility, path: visibility === 'public' ? `/interview/${row.id}` : null });
});

async function ownSession(id, userId) {
  return queryOne('SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
}

function gradeMcq(item, answer) {
  if (item.kind !== 'mcq') return null;
  const chosen = String(answer).trim().charAt(0).toUpperCase();
  if (!LETTERS.slice(0, item.options.length).includes(chosen)) {
    // 也允许直接把选项文字当作回答提交（口语化作答时很常见）
    const byText = item.options.findIndex((text) => stripOption(text) === stripOption(answer));
    if (byText < 0) return { chosen: null, correct: null };
    return { chosen: LETTERS[byText], correct: LETTERS[byText] === item.answer };
  }
  return { chosen, correct: chosen === item.answer };
}

/** 客观题部分的真实统计 —— 报告生成失败时这就是全部交付物 */
function summarize(items, transcript) {
  const byId = new Map(transcript.map((t) => [t.item_id, t]));
  const mcq = items.filter((it) => it.kind === 'mcq');
  const answeredMcq = mcq.filter((it) => byId.get(it.id)?.correct !== null && byId.get(it.id)?.correct !== undefined);
  const byCategory = new Map();

  for (const it of items) {
    const entry = byId.get(it.id);
    if (!entry) continue;
    const bucket = byCategory.get(it.category) || { category: it.category, total: 0, correct: 0, open: 0 };
    bucket.total += 1;
    if (entry.kind === 'open') bucket.open += 1;
    else if (entry.correct) bucket.correct += 1;
    byCategory.set(it.category, bucket);
  }

  return {
    total: items.length,
    answered: transcript.length,
    mcq_correct: answeredMcq.filter((it) => byId.get(it.id).correct).length,
    mcq_answered: answeredMcq.length,
    categories: [...byCategory.values()].sort((a, b) => b.total - a.total),
  };
}

function shapeSession(row, { includeAnswers }) {
  const report = parseJsonColumn(row.report_json, null);
  const items = parseJsonColumn(row.items_json, []);
  const transcript = parseJsonColumn(row.transcript_json, []);
  const objective = report?.objective || summarize(items, transcript);

  return {
    id: row.id,
    direction: row.direction,
    visibility: row.visibility,
    created_at: row.created_at,
    finished_at: row.finished_at,
    score_total: row.score_total === null ? null : Number(row.score_total),
    report,
    objective,
    items: includeAnswers
      ? items.map((it) => ({ ...publicItem(it), answer: it.answer, reference: it.reference }))
      : items.map(publicItem),
    // 公开链接不给参考要点和正确选项：报告页只用得上「他说了什么 + 面试官怎么评」
    transcript: includeAnswers
      ? transcript
      : transcript.map(({ reference, correct_answer, ...rest }) => rest),
  };
}

function parseJsonColumn(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// 与 learning / myquestions 保持一致：直接导出 router
module.exports = router;
