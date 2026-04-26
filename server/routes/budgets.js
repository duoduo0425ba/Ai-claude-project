const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/budgets — 获取当前用户所有分类预算
router.get('/', (req, res) => {
  try {
    const uid = req.user.userId;
    const rows = db.prepare('SELECT category, amount FROM category_budgets WHERE user_id = ? ORDER BY category').all(uid);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/budgets/status?year=&month= — 各分类预算执行情况
router.get('/status', (req, res) => {
  try {
    const uid = req.user.userId;
    const y = parseInt(req.query.year)  || new Date().getFullYear();
    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthStart  = `${y}-${String(m).padStart(2,'0')}-01`;
    const monthEnd    = `${y}-${String(m).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

    const budgets = db.prepare('SELECT category, amount FROM category_budgets WHERE user_id = ?').all(uid);
    if (budgets.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 查询有预算的分类本月支出
    const placeholders = budgets.map(() => '?').join(',');
    const categories   = budgets.map(b => b.category);
    const spentRows    = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) AS spent
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ? AND user_id = ?
        AND category IN (${placeholders})
      GROUP BY category
    `).all(monthStart, monthEnd, uid, ...categories);

    const spentMap = {};
    spentRows.forEach(r => { spentMap[r.category] = r.spent; });

    // 查 emoji（从 categories 表）
    const emojiRows = db.prepare(`
      SELECT name, emoji FROM categories WHERE user_id = ? AND type = 'expense'
    `).all(uid);
    const emojiMap = {};
    emojiRows.forEach(r => { emojiMap[r.name] = r.emoji; });

    const data = budgets.map(b => {
      const spent    = spentMap[b.category] || 0;
      const progress = Math.min((spent / b.amount) * 100, 100);
      const status   = spent >= b.amount ? 'danger' : progress >= 80 ? 'warn' : 'safe';
      return {
        category:     b.category,
        emoji:        emojiMap[b.category] || '',
        budgetAmount: b.amount,
        spent,
        remaining:    Math.max(b.amount - spent, 0),
        progress,
        status,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/budgets/:category — 设置（新增或更新）分类预算
router.put('/:category', (req, res) => {
  try {
    const uid      = req.user.userId;
    const category = req.params.category;
    const amount   = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: '预算金额必须大于 0' });
    }
    db.prepare(`
      INSERT INTO category_budgets (user_id, category, amount)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, category) DO UPDATE SET amount = excluded.amount
    `).run(uid, category, amount);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/budgets/:category — 删除分类预算
router.delete('/:category', (req, res) => {
  try {
    const uid      = req.user.userId;
    const category = req.params.category;
    db.prepare('DELETE FROM category_budgets WHERE user_id = ? AND category = ?').run(uid, category);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
