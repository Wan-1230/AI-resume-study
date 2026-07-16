/**
 * 管理员认证模块
 * 使用 .env 中配置的固定管理员账号，与普通用户系统独立
 */

const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
// 支持明文或 bcrypt hash：如果以 $2 开头则当作 hash 校验
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_PASSWORD_IS_HASH = ADMIN_PASSWORD.startsWith('$2');

const ADMIN_USER = {
  id: 'admin',
  email: ADMIN_EMAIL,
  username: '管理员',
  role: 'admin',
};

async function verifyAdmin(email, password) {
  if (email !== ADMIN_EMAIL) return null;

  let valid;
  if (ADMIN_PASSWORD_IS_HASH) {
    valid = await bcrypt.compare(password, ADMIN_PASSWORD);
  } else {
    valid = password === ADMIN_PASSWORD;
  }

  return valid ? ADMIN_USER : null;
}

function getAdminUser() {
  return ADMIN_USER;
}

module.exports = { verifyAdmin, getAdminUser, ADMIN_EMAIL };
