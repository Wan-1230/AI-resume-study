/**
 * Postgres 持久层
 *
 * 承载全部「用户维度」的可变数据：账号、收藏、练习记录、自建题。
 * 之前是本地文件（users.json）+ 本地 SQLite（app.db），两者在免费 PaaS 上都是
 * 临时盘 —— 每次休眠/重新部署就清零，注册用户第二天登录就是「账号不存在」。
 * 知识库语料（backend/data/*.json）仍是只读输入，不走这条写入路径。
 *
 * 连接串取 DATABASE_URL：Render 蓝图里作为 secretFromEnvWidget 注入，本地开发见
 * backend/.env.example（可指向 docker 起的 Postgres 或 Neon 的 dev branch）。
 */

const { Pool } = require('pg');

/** 逐条执行：多语句拼在一个查询里会被部分驱动/连接池拒绝 */
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE,
    username        TEXT,
    password_hash   TEXT,
    avatar_url      TEXT,
    github_id       TEXT UNIQUE,
    github_username TEXT,
    auth_provider   TEXT NOT NULL DEFAULT 'email',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS favorites (
    user_id     TEXT NOT NULL,
    question_id TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, question_id)
  )`,

  `CREATE TABLE IF NOT EXISTS practice_sessions (
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
  )`,

  `CREATE TABLE IF NOT EXISTS practice_answers (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id     TEXT NOT NULL,
    user_id        TEXT NOT NULL,
    question_id    TEXT NOT NULL,
    category       TEXT,
    chosen         TEXT,
    correct_answer TEXT,
    is_correct     INTEGER NOT NULL,
    duration_s     INTEGER NOT NULL DEFAULT 0,
    answered_at    TEXT NOT NULL,
    display_options_json TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS custom_questions (
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
  )`,

  `CREATE TABLE IF NOT EXISTS interview_sessions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    direction       TEXT NOT NULL,
    direction_key   TEXT NOT NULL,
    items_json      TEXT NOT NULL DEFAULT '[]',
    transcript_json TEXT NOT NULL DEFAULT '[]',
    report_json     TEXT,
    score_total     DOUBLE PRECISION,
    visibility      TEXT NOT NULL DEFAULT 'private',
    created_at      TEXT NOT NULL,
    finished_at     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS chat_threads (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    title      TEXT NOT NULL DEFAULT '新对话',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS chat_messages (
    id           TEXT PRIMARY KEY,
    thread_id    TEXT NOT NULL,
    role         TEXT NOT NULL,
    content      TEXT NOT NULL,
    sources_json TEXT NOT NULL DEFAULT '[]',
    feedback     TEXT,
    created_at   TEXT NOT NULL
  )`,

  // 检索日志：阈值校准与"检索质量"面板的唯一数据来源。只存查询与命中元数据，
  // 不存答案正文，避免这张表变成第二份用户内容。
  `CREATE TABLE IF NOT EXISTS retrieval_log (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     TEXT,
    thread_id   TEXT,
    query       TEXT NOT NULL,
    top_k       INTEGER NOT NULL,
    min_score   DOUBLE PRECISION NOT NULL,
    hit_ids_json TEXT NOT NULL DEFAULT '[]',
    llm_model   TEXT,
    abstained   INTEGER NOT NULL DEFAULT 0,
    latency_ms  INTEGER,
    created_at  TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user   ON practice_sessions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_answers_session ON practice_answers(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_answers_user_q  ON practice_answers(user_id, question_id, answered_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_custom_owner    ON custom_questions(owner_user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_interview_user  ON interview_sessions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_threads_user    ON chat_threads(user_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_thread ON chat_messages(thread_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_retrieval_time  ON retrieval_log(created_at DESC)`,
];

function isLocal(url) {
  return /^postgres(ql)?:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?\//.test(url);
}

let pool = null;

function getPool(env = process.env) {
  if (pool) return pool;

  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      '缺少 DATABASE_URL：用户与学习数据存放在 Postgres，本地开发配置见 backend/.env.example'
    );
  }

  // Neon / Render 的托管实例只接受 TLS；本地 docker 起的库没有证书
  const ssl = isLocal(connectionString) ? false : { require: true };
  pool = new Pool({
    connectionString,
    ssl,
    // 免费档实例单进程足够，池子留小：Neon 免费额度对并发连接数有硬上限
    max: Number(env.PG_POOL_MAX) || 3,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (err) => console.error('[db] 空闲连接异常:', err.message));
  return pool;
}

/** 启动时建表；重复执行安全 */
async function initSchema(env = process.env) {
  for (const statement of SCHEMA_STATEMENTS) {
    await getPool(env).query(statement);
  }
}

/** SELECT 多行。node-postgres 把 COUNT/SUM 返回成 int8 字符串，SQL 里要 ::int 收口 */
async function query(text, params) {
  const result = await getPool().query(text, params);
  return result.rows;
}

async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows.length ? rows[0] : null;
}

/** INSERT / UPDATE / DELETE，返回受影响行数 */
async function execute(text, params) {
  const result = await getPool().query(text, params);
  return result.rowCount;
}

/**
 * 单连接事务：一次练习会话要写 sessions + N 条 answers，中途失败必须整体回滚，
 * 否则会留下没有作答记录的「空会话」，统计页的正确率就错了。
 */
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const api = {
      query: async (text, params) => (await client.query(text, params)).rows,
      queryOne: async (text, params) => {
        const rows = await api.query(text, params);
        return rows.length ? rows[0] : null;
      },
      execute: async (text, params) => (await client.query(text, params)).rowCount,
    };
    const out = await fn(api);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${require('crypto').randomBytes(5).toString('hex')}`;
}

async function closePool() {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
}

module.exports = {
  getPool,
  initSchema,
  query,
  queryOne,
  execute,
  withTransaction,
  nowIso,
  newId,
  closePool,
};
