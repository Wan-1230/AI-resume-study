/**
 * SQLite 持久层（Node 内置 node:sqlite，需 Node ≥ 22.5，部署基镜见根目录 Dockerfile）
 *
 * 只承载「用户维度」的学习数据（收藏、练习会话、逐题作答）。
 * 题库与知识库语料仍是 backend/data/*.json 的只读输入 —— 两者写入路径与生命周期不同，不混在一张库里。
 * 会话（chat_threads/chat_messages）留到带会话列表 UI 的那一次一起落地，避免先建表后没人写。
 */

const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS favorites (
  user_id     TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'drill',
  config_json   TEXT NOT NULL DEFAULT '{}',
  total         INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  duration_s    INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT,
  finished_at   TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_answers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  question_id    TEXT NOT NULL,
  category       TEXT,
  chosen         TEXT,
  correct_answer TEXT,
  is_correct     INTEGER NOT NULL,
  duration_s     INTEGER NOT NULL DEFAULT 0,
  answered_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON practice_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_session  ON practice_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_q   ON practice_answers(user_id, question_id, answered_at DESC);

CREATE TABLE IF NOT EXISTS custom_questions (
  id            TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  options_json  TEXT NOT NULL DEFAULT '[]',
  answer        TEXT NOT NULL,
  explanation   TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '未分类',
  difficulty    TEXT NOT NULL DEFAULT 'medium',
  source_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_owner ON custom_questions(owner_user_id, created_at DESC);
`;

/** 增量列：老库缺哪列补哪列，避免让用户删库重跑 */
const ADDED_COLUMNS = [
  ['practice_answers', 'display_options_json', 'TEXT'],
];

function applyMigrations(db) {
  for (const [table, column, type] of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}

function openDatabase(env = process.env) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    throw new Error(
      `学习数据需要 Node.js ≥ 22.5 的内置 node:sqlite（当前 ${process.version}）。` +
      ` 请升级 Node 后重启后端，见根目录 Dockerfile 基镜与 backend/package.json engines。`
    );
  }

  const dbPath = env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  applyMigrations(db);
  return db;
}

let handle = null;

function getDb() {
  if (!handle) handle = openDatabase();
  return handle;
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${require('crypto').randomBytes(5).toString('hex')}`;
}

module.exports = { getDb, nowIso, newId };
