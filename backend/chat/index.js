/**
 * 对话会话持久化（列表 / 重命名 / 删除 / 逐条落库 / 赞踩）
 *
 * 为什么不把消息直接塞进一个 JSON 大字段：赞/踩要按条统计、反馈要能 JOIN 到 retrieval_log，
 * 拆成行才问得出来；整段 JSON 只能读，改一条就得重写整坨。
 *
 * 标题取首条用户消息的前若干字：省掉一次"给会话起名"的 LLM 调用，
 * 而这类自动生成出来的标题通常比模型给的花名更好认。
 */

const express = require('express');
const { query, queryOne, execute, nowIso, newId } = require('../db');
const { authenticateToken } = require('../auth/middleware');

const MAX_MESSAGES_PER_CALL = 20;
const MAX_CONTENT_CHARS = 20000;
const TITLE_CHARS = 30;
const FEEDBACKS = new Set(['up', 'down']);

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const rows = await query(
    `SELECT t.id, t.title, t.created_at, t.updated_at,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id)::int AS message_count
     FROM chat_threads t WHERE t.user_id = $1 ORDER BY t.updated_at DESC LIMIT $2`,
    [req.user.id, Math.max(1, Math.min(Number(req.query.limit) || 30, 100))]
  );
  res.json({ items: rows });
});

router.post('/', async (req, res) => {
  const id = newId('ct');
  const now = nowIso();
  const title = clamp(req.body?.title, 60) || '新对话';
  await execute(
    'INSERT INTO chat_threads (id, user_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)',
    [id, req.user.id, title, now]
  );
  res.status(201).json({ item: { id, title, created_at: now, updated_at: now, message_count: 0 } });
});

router.get('/:id', async (req, res) => {
  const thread = await ownThread(req.params.id, req.user.id);
  if (!thread) return res.status(404).json({ error: '会话不存在' });

  const messages = await query(
    `SELECT id, role, content, sources_json, feedback, created_at
     FROM chat_messages WHERE thread_id = $1 ORDER BY created_at`,
    [thread.id]
  );
  res.json({
    thread,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: parseJson(m.sources_json, []),
      feedback: m.feedback,
      created_at: m.created_at,
    })),
  });
});

router.patch('/:id', async (req, res) => {
  const thread = await ownThread(req.params.id, req.user.id);
  if (!thread) return res.status(404).json({ error: '会话不存在' });

  const title = clamp(req.body?.title, 60);
  if (!title) return res.status(400).json({ error: '标题不能为空且不超过 60 字' });

  await execute('UPDATE chat_threads SET title = $1, updated_at = $2 WHERE id = $3', [title, nowIso(), thread.id]);
  res.json({ ok: true, title });
});

router.delete('/:id', async (req, res) => {
  const thread = await ownThread(req.params.id, req.user.id);
  if (!thread) return res.status(404).json({ error: '会话不存在' });

  // 消息表没有外键级联（建表时就按弱关联处理），这里显式删干净，别留孤儿行
  await execute('DELETE FROM chat_messages WHERE thread_id = $1', [thread.id]);
  await execute('DELETE FROM chat_threads WHERE id = $1', [thread.id]);
  res.json({ removed: true });
});

/** 一轮问答结束后整批写入（assistant 消息带上来源，供回看时还原引用） */
router.post('/:id/messages', async (req, res) => {
  const thread = await ownThread(req.params.id, req.user.id);
  if (!thread) return res.status(404).json({ error: '会话不存在' });

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!incoming.length) return res.status(400).json({ error: 'messages 不能为空' });
  if (incoming.length > MAX_MESSAGES_PER_CALL) {
    return res.status(400).json({ error: `单次最多写入 ${MAX_MESSAGES_PER_CALL} 条` });
  }

  const created = [];
  for (const row of incoming) {
    const role = row?.role === 'assistant' ? 'assistant' : row?.role === 'user' ? 'user' : null;
    const content = clamp(row?.content, MAX_CONTENT_CHARS);
    if (!role || !content) continue;

    const id = newId('cm');
    const now = nowIso();
    const sources = Array.isArray(row.sources) ? JSON.stringify(row.sources.slice(0, 10)) : '[]';
    await execute(
      `INSERT INTO chat_messages (id, thread_id, role, content, sources_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, thread.id, role, content, sources, now]
    );
    created.push({ id, role, content, sources: parseJson(sources, []), feedback: null, created_at: now });
  }

  if (!created.length) return res.status(400).json({ error: '没有可写入的消息（role 只能是 user / assistant）' });

  // 首条用户消息到达时才定标题，避免一长串"新对话"
  if (thread.title === '新对话') {
    const firstUser = created.find((m) => m.role === 'user') || null;
    const auto = firstUser ? clamp(firstUser.content, TITLE_CHARS) : null;
    if (auto) await execute('UPDATE chat_threads SET title = $1 WHERE id = $2', [auto, thread.id]);
  }
  await execute('UPDATE chat_threads SET updated_at = $1 WHERE id = $2', [nowIso(), thread.id]);

  res.status(201).json({ items: created });
});

/** 赞/踩只允许打在助手消息上，且必须属于本会话的所有者 */
router.post('/:id/messages/:messageId/feedback', async (req, res) => {
  const thread = await ownThread(req.params.id, req.user.id);
  if (!thread) return res.status(404).json({ error: '会话不存在' });

  const raw = req.body?.feedback;
  const feedback = raw === null || raw === '' || raw === false ? null : String(raw);
  if (feedback !== null && !FEEDBACKS.has(feedback)) return res.status(400).json({ error: 'feedback 只能是 up / down / null' });

  const changed = await execute(
    'UPDATE chat_messages SET feedback = $1 WHERE id = $2 AND thread_id = $3 AND role = $4',
    [feedback, req.params.messageId, thread.id, 'assistant']
  );
  if (!changed) return res.status(404).json({ error: '这条消息不在你的会话里，或不是助手回答' });
  res.json({ ok: true, feedback });
});

/** 服务端按会话判分依据做统计时用的只读汇总（管理端"检索质量"页的数据源之一） */
router.get('/meta/feedback', async (req, res) => {
  const rows = await queryOne(
    `SELECT COUNT(*) FILTER (WHERE feedback = 'up')::int AS up,
            COUNT(*) FILTER (WHERE feedback = 'down')::int AS down,
            COUNT(*) FILTER (WHERE feedback IS NULL)::int AS none
     FROM chat_messages WHERE role = 'assistant'`
  );
  res.json(rows);
});

async function ownThread(id, userId) {
  return queryOne('SELECT id, title, created_at, updated_at FROM chat_threads WHERE id = $1 AND user_id = $2', [id, userId]);
}

function clamp(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text.length) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = router;
