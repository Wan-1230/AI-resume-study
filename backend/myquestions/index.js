/**
 * 我的题库接口（用户自建题目）
 *
 * 与系统题库的边界：backend/data/questions.json 是只读语料（RAG 与练习的数据来源），
 * 用户新增/导入的题进 SQLite 的 custom_questions，只有本人可见可改。
 * 因此这里不提供对系统题的修改入口 —— 之前的"假 CRUD"正是把两者混为一谈才写不下去的。
 */

const express = require('express');
const { getDb, nowIso, newId } = require('../db');
const { authenticateToken } = require('../auth/middleware');

const LIMITS = {
  title: 300,
  content: 5000,
  explanation: 5000,
  option: 500,
  category: 50,
  optionsMin: 2,
  optionsMax: 4,
  importMax: 200,
};

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const LETTERS = ['A', 'B', 'C', 'D'];

const router = express.Router();
router.use(authenticateToken);

function trimText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text.length || text.length > max) return null;
  return text;
}

/** 允许题目录入时把答案写成 "B" 或 "B. 选项文字"，统一取首字母 */
function normalizeAnswer(value, optionCount) {
  const letter = String(value || '').trim().charAt(0).toUpperCase();
  if (!LETTERS.slice(0, optionCount).includes(letter)) return null;
  return letter;
}

/** 选项文本自带 "A. " 前缀时去掉，避免与展示层重新编号后重复 */
function stripOptionPrefix(text, index) {
  const expected = `${LETTERS[index]}.`;
  return text.startsWith(expected) ? text.slice(expected.length).trim() : text;
}

/**
 * 归一化并校验一条题目。返回 { error } 或 { fields }。
 * fields.options 为不带字母前缀的纯文本，answer 为字母。
 */
function validateQuestion(raw) {
  if (!raw || typeof raw !== 'object') return { error: '题目格式不正确' };

  const title = trimText(raw.title, LIMITS.title);
  if (!title) return { error: `标题不能为空且不超过 ${LIMITS.title} 字` };

  const content = typeof raw.content === 'string' ? raw.content.trim() : '';
  if (content.length > LIMITS.content) return { error: `内容不超过 ${LIMITS.content} 字` };

  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options = rawOptions
    .map((option, index) => (typeof option === 'string' ? stripOptionPrefix(option.trim(), index) : ''))
    .filter(Boolean);
  if (options.length < LIMITS.optionsMin || options.length > LIMITS.optionsMax) {
    return { error: `选项需要 ${LIMITS.optionsMin}~${LIMITS.optionsMax} 个非空项` };
  }
  if (options.some((o) => o.length > LIMITS.option)) {
    return { error: `单个选项不超过 ${LIMITS.option} 字` };
  }

  const answer = normalizeAnswer(raw.answer, options.length);
  if (!answer) return { error: `正确答案必须是前 ${options.length} 个字母之一` };

  const difficulty = DIFFICULTIES.has(raw.difficulty) ? raw.difficulty : 'medium';
  const category = trimText(raw.category ?? raw.category_id, LIMITS.category) || '未分类';
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim().slice(0, LIMITS.explanation) : '';

  return { fields: { title, content, options, answer, difficulty, category, explanation } };
}

function toRow(row) {
  let options = [];
  try {
    options = JSON.parse(row.options_json);
  } catch {
    options = [];
  }
  return { ...row, options_json: undefined, options, category_id: row.category };
}

router.get('/', (req, res) => {
  const items = getDb()
    .prepare('SELECT * FROM custom_questions WHERE owner_user_id = ? ORDER BY created_at DESC')
    .all(req.user.id)
    .map(toRow);
  res.json({ items, total: items.length });
});

router.post('/', (req, res) => {
  const { error, fields } = validateQuestion(req.body);
  if (error) return res.status(400).json({ error });

  const sourceId = typeof req.body?.source_id === 'string' ? req.body.source_id : null;
  const db = getDb();

  // 「加入我的题库」是复制系统题，重复点击不应产生副本
  if (sourceId) {
    const existing = db
      .prepare('SELECT * FROM custom_questions WHERE owner_user_id = ? AND source_id = ?')
      .get(req.user.id, sourceId);
    if (existing) return res.json({ item: toRow(existing), already: true });
  }

  const now = nowIso();
  const id = newId('uq');
  db.prepare(
    `INSERT INTO custom_questions (id, owner_user_id, title, content, options_json, answer, explanation, category, difficulty, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, fields.title, fields.content, JSON.stringify(fields.options), fields.answer,
    fields.explanation, fields.category, fields.difficulty, sourceId, now, now);

  const item = db.prepare('SELECT * FROM custom_questions WHERE id = ?').get(id);
  res.status(201).json({ item: toRow(item) });
});

router.put('/:id', (req, res) => {
  const existing = getDb()
    .prepare('SELECT id, owner_user_id FROM custom_questions WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: '题目不存在' });
  if (existing.owner_user_id !== req.user.id) return res.status(403).json({ error: '只能修改自己的题目' });

  const { error, fields } = validateQuestion(req.body);
  if (error) return res.status(400).json({ error });

  getDb()
    .prepare(
      `UPDATE custom_questions SET title=?, content=?, options_json=?, answer=?, explanation=?, category=?, difficulty=?, updated_at=? WHERE id=?`
    )
    .run(fields.title, fields.content, JSON.stringify(fields.options), fields.answer, fields.explanation,
      fields.category, fields.difficulty, nowIso(), req.params.id);

  const item = getDb().prepare('SELECT * FROM custom_questions WHERE id = ?').get(req.params.id);
  res.json({ item: toRow(item) });
});

router.delete('/:id', (req, res) => {
  const { changes } = getDb()
    .prepare('DELETE FROM custom_questions WHERE id = ? AND owner_user_id = ?')
    .run(req.params.id, req.user.id);
  if (!changes) return res.status(404).json({ error: '题目不存在或无权限删除' });
  res.json({ removed: true });
});

/**
 * 批量导入：逐条校验，失败的带行号回报，成功的入库 —— 不再"假装全部成功"。
 */
router.post('/import', (req, res) => {
  const rows = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!rows) return res.status(400).json({ error: 'items 必须是数组' });
  if (!rows.length) return res.status(400).json({ error: '没有可导入的题目' });
  if (rows.length > LIMITS.importMax) {
    return res.status(400).json({ error: `单次最多导入 ${LIMITS.importMax} 题` });
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO custom_questions (id, owner_user_id, title, content, options_json, answer, explanation, category, difficulty, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
  );
  const created = [];
  const failed = [];

  db.exec('BEGIN');
  try {
    for (let index = 0; index < rows.length; index += 1) {
      const { error, fields } = validateQuestion(rows[index]);
      if (error) {
        failed.push({ index, title: String(rows[index]?.title || '').slice(0, 40), error });
        continue;
      }
      const now = nowIso();
      const id = newId('uq');
      insert.run(id, req.user.id, fields.title, fields.content, JSON.stringify(fields.options), fields.answer,
        fields.explanation, fields.category, fields.difficulty, now, now);
      created.push({ id, title: fields.title, category: fields.category });
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.status(created.length ? 201 : 400).json({ created, created_count: created.length, failed, failed_count: failed.length });
});

module.exports = router;
