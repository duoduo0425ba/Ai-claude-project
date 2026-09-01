const express = require('express');
const router = express.Router();
const db = require('../db');

// 标签随交易保存自动创建（见 transactions.js），此路由只提供列表。
// count 为 0 的孤儿标签保留，兼作输入历史/自动补全。
router.get('/', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT g.name, COUNT(tt.tag_id) AS count
      FROM tags g
      LEFT JOIN transaction_tags tt ON tt.tag_id = g.id
      WHERE g.user_id = ?
      GROUP BY g.id
      ORDER BY count DESC, g.name ASC
    `).all(req.user.userId);
    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
