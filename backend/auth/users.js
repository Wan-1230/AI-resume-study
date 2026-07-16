/**
 * 用户数据管理模块 — JSON 文件存储
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// 确保数据目录存在
function ensureDataDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 读取用户数据
function readUsers() {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  let rawData;
  try {
    rawData = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (parseErr) {
    // JSON 损坏时备份原文件，避免数据永久丢失
    console.error('[users] users.json 解析失败，已备份为 users.json.corrupted:', parseErr.message);
    const backupPath = USERS_FILE + '.corrupted.' + Date.now();
    try {
      // 使用已读入内存的数据写入备份，避免再次从磁盘读取
      if (rawData !== undefined) {
        fs.writeFileSync(backupPath, rawData);
      } else {
        fs.copyFileSync(USERS_FILE, backupPath);
      }
      console.error('[users] 备份已保存到:', backupPath);
    } catch (backupErr) {
      console.error('[users] 备份失败:', backupErr.message);
    }
    return [];
  }
}

// 写入用户数据（原子写入：先写临时文件，再 rename）
function writeUsers(users) {
  ensureDataDir();
  const tmpFile = USERS_FILE + '.tmp.' + Date.now();
  fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2));
  fs.renameSync(tmpFile, USERS_FILE);
}

// 通过邮箱查找用户
function findByEmail(email) {
  const users = readUsers();
  return users.find(u => u.email === email) || null;
}

// 通过 GitHub ID 查找用户
function findByGitHubId(githubId) {
  const users = readUsers();
  return users.find(u => u.github_id === githubId) || null;
}

// 通过 ID 查找用户
function findById(id) {
  const users = readUsers();
  return users.find(u => u.id === id) || null;
}

// 创建用户
function createUser(userData) {
  const users = readUsers();
  const now = new Date().toISOString();

  const newUser = {
    id: crypto.randomUUID(),
    email: userData.email || null,
    username: userData.username || null,
    password_hash: userData.password_hash || null,
    avatar_url: userData.avatar_url || null,
    github_id: userData.github_id || null,
    github_username: userData.github_username || null,
    auth_provider: userData.auth_provider || 'email', // 'email' | 'github'
    created_at: now,
    updated_at: now,
  };

  users.push(newUser);
  writeUsers(users);
  return newUser;
}

// 更新用户（更新 github_id 关联等）
function updateUser(id, updates) {
  const users = readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  writeUsers(users);
  return users[index];
}

// 查找或创建 GitHub 用户
function findOrCreateGitHubUser(githubProfile) {
  const { id: githubId, login, email, avatar_url } = githubProfile;

  // 先按 github_id 查找
  let user = findByGitHubId(githubId);
  if (user) {
    // 更新头像等信息
    return updateUser(user.id, {
      avatar_url: avatar_url || user.avatar_url,
      github_username: login || user.github_username,
    });
  }

  // 如果 GitHub 有邮箱，尝试按邮箱关联
  if (email) {
    user = findByEmail(email);
    if (user) {
      // 关联 GitHub 账号到已有邮箱账号
      return updateUser(user.id, {
        github_id: githubId,
        github_username: login,
        avatar_url: avatar_url || user.avatar_url,
        auth_provider: 'github',
      });
    }
  }

  // 全新用户
  return createUser({
    email: email || `${login}@github.user`,
    username: login,
    avatar_url,
    github_id: githubId,
    github_username: login,
    auth_provider: 'github',
  });
}

// 去除敏感字段的安全用户对象
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  readUsers,
  writeUsers,
  findByEmail,
  findByGitHubId,
  findById,
  createUser,
  updateUser,
  findOrCreateGitHubUser,
  sanitizeUser,
};
