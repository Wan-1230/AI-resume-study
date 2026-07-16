/**
 * Auth 路由模块
 * - GET  /api/auth/github          → 跳转 GitHub OAuth 授权
 * - GET  /api/auth/github/callback → GitHub OAuth 回调，签发 JWT
 * - POST /api/auth/register        → 邮箱注册
 * - POST /api/auth/login           → 邮箱登录
 * - GET  /api/auth/me              → 获取当前用户信息（需登录）
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const users = require('./users');
const { generateToken, authenticateToken, requireAdmin } = require('./middleware');
const { verifyAdmin } = require('./admin');

const router = express.Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ==================== GitHub OAuth ====================

// 步骤1：重定向到 GitHub 授权页
router.get('/github', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({
      error: 'GitHub OAuth 未配置',
      detail: '请在后端 .env 中设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET'
    });
  }

  // 生成随机 state 防 CSRF
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 分钟有效期
    path: '/api/auth',
  });

  const scope = 'read:user user:email';
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&state=${state}&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}&scope=${encodeURIComponent(scope)}`;

  res.redirect(redirectUrl);
});

// 步骤2：GitHub 回调
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;

  // 验证 state 参数防 CSRF
  const savedState = req.cookies?.oauth_state;
  if (!state || !savedState || state !== savedState) {
    console.warn('[OAuth] state 验证失败，可能是 CSRF 攻击');
    return res.redirect(`${FRONTEND_URL}/login?error=安全校验失败，请重新登录`);
  }
  // 清除 state cookie，防止重复使用
  res.clearCookie('oauth_state', { path: '/api/auth' });

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=授权失败，未收到授权码`);
  }

  try {
    // 用 code 换取 access_token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const { access_token, error: tokenError } = tokenResponse.data;
    if (tokenError || !access_token) {
      console.error('GitHub token exchange failed:', tokenResponse.data);
      return res.redirect(`${FRONTEND_URL}/login?error=GitHub 授权失败`);
    }

    // 获取 GitHub 用户信息
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const githubProfile = userResponse.data;

    // 获取 GitHub 邮箱（如果 user 接口没有返回邮箱）
    let email = githubProfile.email;
    if (!email) {
      try {
        const emailResponse = await axios.get('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const primaryEmail = emailResponse.data.find(e => e.primary);
        email = primaryEmail?.email || null;
      } catch {
        // 邮箱获取失败也不影响登录
      }
    }

    // 查找或创建用户
    const user = users.findOrCreateGitHubUser({
      id: String(githubProfile.id),
      login: githubProfile.login,
      email,
      avatar_url: githubProfile.avatar_url,
    });

    // 签发 JWT
    const token = generateToken(user);

    // 重定向到前端回调页（所有参数 URL 编码，防止 JWT 特殊字符导致解析错误）
    const safeUser = users.sanitizeUser(user);
    const tokenParam = encodeURIComponent(token);
    const userParam = encodeURIComponent(JSON.stringify(safeUser));
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${tokenParam}&user=${userParam}`);
  } catch (error) {
    console.error('GitHub OAuth error:', error.message);
    res.redirect(`${FRONTEND_URL}/login?error=GitHub 登录失败，请重试`);
  }
});

// ==================== 邮箱注册/登录 ====================

// 注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // 参数校验
    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于6位' });
    }

    // 检查邮箱是否已注册
    const existingUser = users.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    // 创建用户
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = users.createUser({
      email,
      username: username || email.split('@')[0],
      password_hash,
      auth_provider: 'email',
    });

    // 签发 JWT
    const token = generateToken(user);

    res.json({
      token,
      user: users.sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请重试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }

    // 查找用户
    const user = users.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // GitHub 用户不能用邮箱密码登录
    if (user.auth_provider === 'github' && !user.password_hash) {
      return res.status(401).json({ error: '该账号使用 GitHub 登录，请使用 GitHub 登录' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 签发 JWT
    const token = generateToken(user);

    res.json({
      token,
      user: users.sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请重试' });
  }
});

// ==================== 获取当前用户 ====================

// 获取当前登录用户信息
router.get('/me', authenticateToken, (req, res) => {
  // 从数据库获取最新用户信息
  const user = users.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({ user: users.sanitizeUser(user) });
});

// ==================== 管理员登录 ====================

router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }

    const adminUser = await verifyAdmin(email, password);
    if (!adminUser) {
      return res.status(401).json({ error: '管理员邮箱或密码错误' });
    }

    const token = generateToken(adminUser);

    res.json({ token, user: adminUser });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: '登录失败，请重试' });
  }
});

// 获取管理员信息（验证 token 有效性）
router.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
