/**
 * 用户数据管理模块（Postgres）
 *
 * 唯一标识：邮箱注册按 email 唯一，GitHub 登录按 github_id 唯一，两者可关联到同一账号。
 * 所有查询都走参数化占位符（$n），不要把任何外部输入拼进 SQL 字符串。
 */

const crypto = require('crypto');
const { query, queryOne, execute, nowIso } = require('../db');

const UPDATABLE_COLUMNS = new Set([
  'email',
  'username',
  'password_hash',
  'avatar_url',
  'github_id',
  'github_username',
  'auth_provider',
]);

const INSERT_COLUMNS = [
  'id', 'email', 'username', 'password_hash', 'avatar_url', 'github_id',
  'github_username', 'auth_provider', 'created_at', 'updated_at',
];

const SELECT_COLUMNS = `id, email, username, password_hash, avatar_url, github_id,
  github_username, auth_provider, created_at, updated_at`;

// 去除敏感字段的安全用户对象
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

async function findByEmail(email) {
  return queryOne(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`, [email]);
}

async function findByGitHubId(githubId) {
  return queryOne(`SELECT ${SELECT_COLUMNS} FROM users WHERE github_id = $1`, [String(githubId)]);
}

async function findById(id) {
  return queryOne(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
}

/**
 * 创建用户。email / github_id 上的唯一约束冲突会抛 code=23505 的错误，
 * 由调用方翻译成 409 —— 比「先查再插」可靠，两者之间的竞态窗口只有靠约束才能堵住。
 */
async function createUser(userData) {
  const id = crypto.randomUUID();
  const now = nowIso();
  const user = {
    id,
    email: userData.email || null,
    username: userData.username || null,
    password_hash: userData.password_hash || null,
    avatar_url: userData.avatar_url || null,
    github_id: userData.github_id ? String(userData.github_id) : null,
    github_username: userData.github_username || null,
    auth_provider: userData.auth_provider || 'email',
    created_at: now,
    updated_at: now,
  };

  await query(
    `INSERT INTO users (${INSERT_COLUMNS.join(', ')})
     VALUES (${INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ')})`,
    INSERT_COLUMNS.map((col) => user[col])
  );
  return user;
}

/** 更新用户（关联 GitHub 账号、刷新头像等）。返回更新后的完整记录 */
async function updateUser(id, updates) {
  // 列名只允许来自白名单，绝不用外部传入的 key 拼 SQL
  const fields = Object.keys(updates).filter((col) => UPDATABLE_COLUMNS.has(col));
  if (!fields.length) return findById(id);

  const values = fields.map((col) =>
    col === 'github_id' && updates[col] != null ? String(updates[col]) : updates[col]
  );
  const setClause = fields.map((col, i) => `${col} = $${i + 2}`).join(', ');

  await execute(
    `UPDATE users SET ${setClause}, updated_at = $${fields.length + 2} WHERE id = $1`,
    [id, ...values, nowIso()]
  );
  return findById(id);
}

// 查找或创建 GitHub 用户
async function findOrCreateGitHubUser(githubProfile) {
  const { id: githubId, login, email, avatar_url } = githubProfile;

  // 先按 github_id 查找
  const existing = await findByGitHubId(githubId);
  if (existing) {
    return updateUser(existing.id, {
      avatar_url: avatar_url || existing.avatar_url,
      github_username: login || existing.github_username,
    });
  }

  // 如果 GitHub 有邮箱，尝试按邮箱关联到已有账号
  if (email) {
    const byEmail = await findByEmail(email);
    if (byEmail) {
      return updateUser(byEmail.id, {
        github_id: githubId,
        github_username: login,
        avatar_url: avatar_url || byEmail.avatar_url,
        auth_provider: 'github',
      });
    }
  }

  return createUser({
    email: email || `${login}@github.user`,
    username: login,
    avatar_url,
    github_id: githubId,
    github_username: login,
    auth_provider: 'github',
  });
}

/** 管理员列表：搜索 + 分页，模糊匹配邮箱与用户名 */
async function listUsers({ search, page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const pattern = search ? `%${String(search).toLowerCase()}%` : null;
  const args = [];
  let where = '';

  if (pattern) {
    args.push(pattern);
    where = 'WHERE lower(COALESCE(username, \'\')) LIKE $1 OR lower(COALESCE(email, \'\')) LIKE $1';
  }

  args.push(l, (p - 1) * l);
  const rows = await query(
    `SELECT ${SELECT_COLUMNS} FROM users ${where}
     ORDER BY created_at DESC LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args
  );

  const totalRow = await queryOne(
    `SELECT COUNT(*)::int AS total FROM users ${where}`,
    pattern ? [pattern] : []
  );

  return { users: rows.map(sanitizeUser), total: totalRow.total, page: p, limit: l };
}

/** 注册用户构成统计（按认证方式） */
async function userStats() {
  const rows = await query(
    `SELECT auth_provider, COUNT(*)::int AS n FROM users GROUP BY auth_provider`
  );
  const byProvider = Object.fromEntries(rows.map((r) => [r.auth_provider, r.n]));
  return {
    total: rows.reduce((sum, r) => sum + r.n, 0),
    emailUsers: byProvider.email || 0,
    githubUsers: byProvider.github || 0,
  };
}

/** 删除用户，返回是否真的删掉了 */
async function deleteUser(id) {
  return (await execute('DELETE FROM users WHERE id = $1', [id])) > 0;
}

module.exports = {
  findByEmail,
  findByGitHubId,
  findById,
  createUser,
  updateUser,
  findOrCreateGitHubUser,
  sanitizeUser,
  listUsers,
  userStats,
  deleteUser,
};
