const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');

const SECRET_FILE = path.join(__dirname, '..', '.jwt-secret');

// 密钥来源优先级：环境变量 → 本地密钥文件 → 首次运行时随机生成
// 绝不能有硬编码的兜底值——那等于把密钥公开在代码仓库里
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // 测试用的内存库不落文件，每个进程用一次性随机密钥
  if (process.env.DB_PATH === ':memory:') return crypto.randomBytes(32).toString('hex');

  try {
    const saved = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (saved.length >= 32) return saved;
  } catch {
    // 文件不存在或读不了，往下生成新的
  }

  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  console.log('[auth] 已生成新的 JWT 密钥 → server/.jwt-secret（已被 .gitignore 排除，请勿提交）');
  console.log('[auth] 密钥更换后原有登录状态失效，需要重新登录');
  return secret;
}

const JWT_SECRET = loadSecret();

// require('../db') 时迁移已经跑完，users 表一定存在；语句预编译一次后复用
const findUserStmt = db.prepare('SELECT id, username, role FROM users WHERE id = ?');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录，请先登录' });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, error: 'Token 无效或已过期' });
  }

  // 账号状态与 role 一律以数据库为准。Token 有 7 天有效期，这期间用户可能
  // 已被删除或被降级——只信载荷会让已撤销的管理员权限继续有效
  let user;
  try {
    user = findUserStmt.get(payload.userId);
  } catch {
    // 数据库故障也要按约定返回 JSON，不能漏成 Express 默认的 HTML 错误页
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
  if (!user) {
    return res.status(401).json({ success: false, error: '账号不存在，请重新登录' });
  }

  req.user = { userId: user.id, username: user.username, role: user.role };
  next();
};

module.exports.JWT_SECRET = JWT_SECRET;
