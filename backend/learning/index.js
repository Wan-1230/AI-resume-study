/**
 * 学习数据接口（收藏 / 练习记录 / 统计 / 错题本）
 * 全部要求登录：这些数据是用户维度的，也是本站"登录后才解锁能力"的第一块落地。
 *
 * 约定：客户端只上报「选了哪个选项」，是否正确由服务端按题库重算，
 * 避免前端被改一下就刷出虚假的正确率。
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { query, queryOne, execute, withTransaction, nowIso, newId } = require('../db');
const { authenticateToken } = require('../auth/middleware');

const MAX_ANSWERS_PER_SESSION = 200;

/** 题库只读索引：id → { answer, category, options }。改题库需重启后端。 */
function loadQuestionIndex() {
  const file = path.join(__dirname, '..', 'data', 'questions.json');
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const map = new Map();
    for (const q of Array.isArray(list) ? list : []) {
      if (!q || typeof q.id !== 'string') continue;
      map.set(q.id, {
        answer: q.answer,
        category: q.category || null,
        title: q.title || null,
        options: (Array.isArray(q.options) ? q.options : []).map(stripOption),
      });
    }
    return map;
  } catch (e) {
    console.warn(`[learning] 题库索引加载失败，将按客户端上报判定对错：${e.message}`);
    return new Map();
  }
}

/** 选项文本可能自带 "A. " 前缀，比对前先剥掉 */
function stripOption(text) {
  return String(text || '').replace(/^[A-D]\.\s*/, '').trim();
}

/**
 * 判分。客户端可上报本次展示顺序 display_options（练习时选项会乱序），
 * 此时按「选项文本」比对而不是字母 —— 否则乱序后字母和题库字母不同源，会把对的判成错的。
 * 题库查不到的（如用户自建题）退回采信客户端上报的 correct_answer。
 */
function gradeAnswer(known, item) {
  const chosen = typeof item.chosen === 'string' ? item.chosen.trim().toUpperCase() : null;
  if (!chosen) return null;

  const display = Array.isArray(item.display_options) && item.display_options.length
    ? item.display_options.map(stripOption)
    : null;

  if (!known) {
    const correctAnswer = typeof item.correct_answer === 'string' ? item.correct_answer.trim().toUpperCase() : null;
    if (!correctAnswer) return null;
    return { chosen, correctAnswer, ok: chosen === correctAnswer, display };
  }

  const knownIndex = String(known.answer || '').charCodeAt(0) - 65;
  const correctText = known.options[knownIndex];

  if (!display) {
    return { chosen, correctAnswer: known.answer, ok: chosen === known.answer, display: null };
  }

  const chosenText = display[chosen.charCodeAt(0) - 65];
  const displayAnswerIndex = display.findIndex((text) => text && text === correctText);
  return {
    chosen,
    correctAnswer: displayAnswerIndex >= 0 ? String.fromCharCode(65 + displayAnswerIndex) : known.answer,
    ok: Boolean(chosenText) && chosenText === correctText,
    display,
  };
}

const questionIndex = loadQuestionIndex();
const clampInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

const router = express.Router();
// 逐条挂鉴权：不能 router.use(authenticateToken)，因为该路由会挂在 /api 前缀上，
// 那会让 /api/health、/api/chat 也进入本路由并被迫鉴权。

// ==================== 题目维度的真实统计 ====================

/**
 * 单题作答统计。故意不要求登录：它是纯聚合数（作答次数/正确率/中位用时），
 * 用于替换题目详情页里写死的"浏览 1.2k / 建议用时 5分钟"，未登录访客也应看到真实值。
 */
router.get('/questions/:questionId/stats', async (req, res) => {
  const questionId = req.params.questionId;
  const totals = await queryOne(
    'SELECT COUNT(*)::int AS attempts, COALESCE(SUM(is_correct), 0)::int AS correct FROM practice_answers WHERE question_id = $1',
    [questionId]
  );
  const durations = (
    await query(
      'SELECT duration_s FROM practice_answers WHERE question_id = $1 AND duration_s > 0 ORDER BY duration_s',
      [questionId]
    )
  ).map((row) => row.duration_s);

  res.json({
    question_id: questionId,
    attempts: totals.attempts,
    correct: totals.correct,
    accuracy: totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : null,
    median_duration_s: durations.length >= 3 ? median(durations) : null,
  });
});

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ==================== 收藏 ====================

router.get('/favorites', authenticateToken, async (req, res) => {
  const items = await query(
    'SELECT question_id, created_at FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ items });
});

router.post('/favorites', authenticateToken, async (req, res) => {
  const questionId = typeof req.body?.question_id === 'string' ? req.body.question_id.trim() : '';
  if (!questionId) return res.status(400).json({ error: '缺少 question_id' });

  await execute(
    'INSERT INTO favorites (user_id, question_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [req.user.id, questionId, nowIso()]
  );
  const item = await queryOne(
    'SELECT question_id, created_at FROM favorites WHERE user_id = $1 AND question_id = $2',
    [req.user.id, questionId]
  );
  res.status(201).json({ item });
});

router.delete('/favorites/:questionId', authenticateToken, async (req, res) => {
  const changes = await execute(
    'DELETE FROM favorites WHERE user_id = $1 AND question_id = $2',
    [req.user.id, req.params.questionId]
  );
  res.json({ removed: changes > 0 });
});

// ==================== 练习会话 ====================

router.post('/practice/sessions', authenticateToken, async (req, res) => {
  const { mode, config, started_at: startedAt, finished_at: finishedAt, answers } = req.body || {};

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers 不能为空' });
  }
  if (answers.length > MAX_ANSWERS_PER_SESSION) {
    return res.status(400).json({ error: `单次会话最多 ${MAX_ANSWERS_PER_SESSION} 题` });
  }

  const graded = [];
  const skipped = [];
  for (const item of answers) {
    const questionId = typeof item?.question_id === 'string' ? item.question_id : '';
    if (!questionId || skipped.length + graded.length >= MAX_ANSWERS_PER_SESSION) {
      skipped.push(item?.question_id ?? null);
      continue;
    }
    const gradedItem = gradeAnswer(questionIndex.get(questionId), item);
    if (!gradedItem) {
      skipped.push(questionId);
      continue;
    }
    graded.push({
      question_id: questionId,
      category: questionIndex.get(questionId)?.category ?? (typeof item.category === 'string' ? item.category : null),
      chosen: gradedItem.chosen,
      correct_answer: gradedItem.correctAnswer,
      display_options_json: gradedItem.display ? JSON.stringify(gradedItem.display) : null,
      is_correct: gradedItem.ok ? 1 : 0,
      duration_s: toInt(item.duration_s),
    });
  }

  if (!graded.length) return res.status(400).json({ error: '没有可记录的作答', skipped });

  const sessionId = newId('ps');
  const createdAt = nowIso();
  const answeredAt = typeof finishedAt === 'string' ? finishedAt : createdAt;
  const correctCount = graded.reduce((sum, a) => sum + a.is_correct, 0);
  const durationTotal = graded.reduce((sum, a) => sum + a.duration_s, 0);

  // 会话与逐题作答必须同生同死：只写进一半会让统计页出现「有会话、零作答」的空记录
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO practice_sessions (id, user_id, mode, config_json, total, correct_count, duration_s, started_at, finished_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sessionId,
        req.user.id,
        typeof mode === 'string' ? mode : 'drill',
        JSON.stringify(config && typeof config === 'object' ? config : {}),
        graded.length,
        correctCount,
        durationTotal,
        typeof startedAt === 'string' ? startedAt : null,
        typeof finishedAt === 'string' ? finishedAt : null,
        createdAt,
      ]
    );

    for (const a of graded) {
      await tx.execute(
        `INSERT INTO practice_answers (session_id, user_id, question_id, category, chosen, correct_answer, is_correct, duration_s, answered_at, display_options_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [sessionId, req.user.id, a.question_id, a.category, a.chosen, a.correct_answer, a.is_correct, a.duration_s, answeredAt, a.display_options_json]
      );
    }
  });

  res.status(201).json({
    session: {
      id: sessionId,
      total: graded.length,
      correct_count: correctCount,
      accuracy: Math.round((correctCount / graded.length) * 100),
      duration_s: durationTotal,
      skipped,
    },
  });
});

router.get('/practice/sessions', authenticateToken, async (req, res) => {
  const limit = clampInt(req.query.limit, 10, 1, 50);
  const items = (
    await query(
      `SELECT id, mode, config_json, total, correct_count, duration_s, started_at, finished_at, created_at
       FROM practice_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [req.user.id, limit]
    )
  ).map((row) => ({ ...row, config: safeParse(row.config_json) }));
  res.json({ items });
});

// ==================== 统计与错题本 ====================

router.get('/practice/stats', authenticateToken, async (req, res) => {
  const overall = await queryOne(
    `SELECT COUNT(*)::int AS answers, COALESCE(SUM(is_correct), 0)::int AS correct
     FROM practice_answers WHERE user_id = $1`,
    [req.user.id]
  );
  const sessions = await queryOne('SELECT COUNT(*)::int AS n FROM practice_sessions WHERE user_id = $1', [req.user.id]);
  const byCategory = (
    await query(
      `SELECT category, COUNT(*)::int AS total, COALESCE(SUM(is_correct), 0)::int AS correct
       FROM practice_answers WHERE user_id = $1 GROUP BY category ORDER BY total DESC`,
      [req.user.id]
    )
  ).map((row) => ({
    ...row,
    accuracy: row.total ? Math.round((row.correct / row.total) * 100) : 0,
  }));

  res.json({
    sessions: sessions.n,
    answers: overall.answers,
    correct: overall.correct,
    accuracy: overall.answers ? Math.round((overall.correct / overall.answers) * 100) : 0,
    by_category: byCategory,
  });
});

/**
 * 错题本：每题只看最近一次作答，最近一次答错才计为错题（答过即毕业），
 * 并给出该题历史错误次数，便于排优先级。
 */
router.get('/practice/wrong', authenticateToken, async (req, res) => {
  const limit = clampInt(req.query.limit, 50, 1, 200);
  // 用自增 id 而不是 answered_at 定位「最近一次」：客户端上报的时间可能回填成过去时刻
  const items = (
    await query(
      `WITH latest AS (
         SELECT question_id, MAX(id) AS rid FROM practice_answers WHERE user_id = $1 GROUP BY question_id
       )
       SELECT l.question_id, pa.category, pa.chosen, pa.correct_answer, pa.answered_at,
              (SELECT COUNT(*) FROM practice_answers x
                WHERE x.user_id = $2 AND x.question_id = l.question_id AND x.is_correct = 0)::int AS wrong_count
       FROM latest l JOIN practice_answers pa ON pa.id = l.rid
       WHERE pa.is_correct = 0
       ORDER BY pa.answered_at DESC LIMIT $3`,
      [req.user.id, req.user.id, limit]
    )
  ).map((row) => ({ ...row, title: questionIndex.get(row.question_id)?.title || null }));
  res.json({ items });
});

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

module.exports = router;
