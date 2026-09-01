const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');
const { seedDefaults } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const authMiddleware = require('../middleware/auth');

const credSchema = z.object({
  username: z.string().min(3, '用户名至少 3 个字符').max(20).regex(/^\S+$/, '用户名不能包含空格'),
  password: z.string().min(6, '密码至少 6 个字符'),
});

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const parsed = credSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const { username, password } = parsed.data;

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')"
    ).run(username, hash);

    const newUserId = result.lastInsertRowid;
    seedDefaults(newUserId);

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(newUserId);
    res.json({ success: true, data: { token: makeToken(user), username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const parsed = credSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const { username, password } = parsed.data;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    res.json({ success: true, data: { token: makeToken(user), username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/change-password  (需登录)
router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '请填写旧密码和新密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码至少 6 个字符' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(400).json({ success: false, error: '旧密码不正确' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/users  (仅 admin)
router.get('/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  try {
    const users = db.prepare(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
    ).all();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/auth/users/:id  (仅 admin，不能删自己和其他 admin)
router.delete('/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.userId) {
    return res.status(400).json({ success: false, error: '不能删除自己的账号' });
  }
  try {
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(targetId);
    if (!target) return res.status(404).json({ success: false, error: '用户不存在' });
    if (target.role === 'admin') {
      return res.status(400).json({ success: false, error: '不能删除管理员账号' });
    }

    // 级联删除该用户所有数据
    db.transaction(() => {
      // 关联表无 user_id，须先借 transactions 定位再删
      db.prepare(
        'DELETE FROM transaction_tags WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)'
      ).run(targetId);
      db.prepare('DELETE FROM tags WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM transactions WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM categories WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM settings WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM recurring_templates WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    })();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
