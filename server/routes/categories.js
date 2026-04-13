const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/categories?type=expense|income
router.get('/', (req, res) => {
  const { type } = req.query;
  if (!type || !['income', 'expense'].includes(type)) {
    return res.json({ success: false, error: '参数错误：type 必须为 income 或 expense' });
  }

  const categories = db.prepare(`
    SELECT id, type, name, emoji, is_default
    FROM categories
    WHERE type = ?
    ORDER BY is_default DESC, id ASC
  `).all(type);

  res.json({ success: true, data: categories });
});

// POST /api/categories
router.post('/', (req, res) => {
  const { type, name, emoji } = req.body;

  if (!type || !['income', 'expense'].includes(type)) {
    return res.json({ success: false, error: '参数错误：type 必须为 income 或 expense' });
  }

  if (!name || !name.trim()) {
    return res.json({ success: false, error: '分类名称不能为空' });
  }

  if (!emoji || !emoji.trim()) {
    return res.json({ success: false, error: '分类表情不能为空' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO categories (type, name, emoji, is_default)
      VALUES (?, ?, ?, 0)
    `).run(type, name.trim(), emoji.trim());

    const category = db.prepare(`
      SELECT id, type, name, emoji, is_default
      FROM categories
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, data: category });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // 检查是否为默认分类
  const category = db.prepare('SELECT is_default FROM categories WHERE id = ?').get(id);
  if (!category) {
    return res.json({ success: false, error: '分类不存在' });
  }

  if (category.is_default === 1) {
    return res.json({ success: false, error: '无法删除默认分类' });
  }

  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
