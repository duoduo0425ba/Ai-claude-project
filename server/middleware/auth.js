const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'pocket-money-jwt-secret-2026';

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录，请先登录' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token 无效或已过期' });
  }
};

module.exports.JWT_SECRET = JWT_SECRET;
