/**
 * JWT 签发与验证中间件
 */

const jwt = require('jsonwebtoken');
const users = require('./users');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 签发 JWT Token
function generateToken(user) {
  const safeUser = users.sanitizeUser(user);
  return jwt.sign(safeUser, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// JWT 验证中间件 — 必须登录
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '认证令牌已过期，请重新登录' });
    }
    return res.status(403).json({ error: '认证令牌无效' });
  }
}

// JWT 验证中间件 — 可选登录（不强制，但如果有 token 就解析）
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch {
    req.user = null;
  }
  next();
}

// 管理员权限中间件 — 必须是 role=admin
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '认证令牌已过期，请重新登录' });
    }
    return res.status(403).json({ error: '认证令牌无效' });
  }
}

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  requireAdmin,
  JWT_SECRET,
};
