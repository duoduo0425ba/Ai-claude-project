const express = require('express');
const router = express.Router();
const db = require('../db');

// ========== 交易记录 CRUD ==========

// 获取所有交易记录（支持筛选）
router.get('/', (req, res) => {
  try {
    const { startDate, endDate, category, keyword, type } = req.query;
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (keyword) {
      sql += ' AND (note LIKE ? OR category LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增一条记录
router.post('/', (req, res) => {
  try {
    const { type, amount, category, emoji, note, date } = req.body;

    if (!type || !amount || !category || !date) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const stmt = db.prepare(`
      INSERT INTO transactions (type, amount, category, emoji, note, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(type, amount, category, emoji || '', note || '', date);
    const newRecord = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: newRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除一条记录
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 批量导入
router.post('/batch', (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: '无有效记录' });
    }

    const stmt = db.prepare(`
      INSERT INTO transactions (type, amount, category, emoji, note, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      let count = 0;
      for (const item of items) {
        if (item.type && item.amount && item.category && item.date) {
          stmt.run(item.type, item.amount, item.category, item.emoji || '', item.note || '', item.date);
          count++;
        }
      }
      return count;
    });

    const count = insertMany(records);
    res.json({ success: true, imported: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== 统计 API ==========

// 当日摘要
router.get('/stats/daily', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const income = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date = ?"
    ).get(targetDate);

    const expense = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date = ?"
    ).get(targetDate);

    const records = db.prepare(
      'SELECT * FROM transactions WHERE date = ? ORDER BY created_at DESC'
    ).all(targetDate);

    res.json({
      success: true,
      data: {
        date: targetDate,
        income: income.total,
        expense: expense.total,
        balance: income.total - expense.total,
        records
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 周统计
router.get('/stats/weekly', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dayOfWeek = targetDate.getDay();
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);

      const income = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date = ?"
      ).get(dateStr);

      const expense = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date = ?"
      ).get(dateStr);

      days.push({
        date: dateStr,
        dayLabel: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i],
        income: income.total,
        expense: expense.total
      });
    }

    res.json({ success: true, data: days });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 月统计
router.get('/stats/monthly', (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();

    // 每日趋势
    const daily = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const income = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date = ?"
      ).get(dateStr);
      const expense = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date = ?"
      ).get(dateStr);
      daily.push({ date: dateStr, day: d, income: income.total, expense: expense.total });
    }

    // 分类汇总
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const categories = db.prepare(`
      SELECT category, emoji, SUM(amount) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
      GROUP BY category
      ORDER BY total DESC
    `).all(monthStart, monthEnd);

    const totalIncome = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date >= ? AND date <= ?"
    ).get(monthStart, monthEnd);

    const totalExpense = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?"
    ).get(monthStart, monthEnd);

    res.json({
      success: true,
      data: {
        daily,
        categories,
        totalIncome: totalIncome.total,
        totalExpense: totalExpense.total,
        balance: totalIncome.total - totalExpense.total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 年统计
router.get('/stats/yearly', (req, res) => {
  try {
    const { year } = req.query;
    const y = parseInt(year) || new Date().getFullYear();

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const daysInMonth = new Date(y, m, 0).getDate();
      const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const income = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date >= ? AND date <= ?"
      ).get(monthStart, monthEnd);

      const expense = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?"
      ).get(monthStart, monthEnd);

      months.push({
        month: m,
        label: `${m}月`,
        income: income.total,
        expense: expense.total
      });
    }

    res.json({ success: true, data: months });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 预算状态
router.get('/stats/budget', (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const settings = {};
    db.prepare('SELECT key, value FROM settings').all().forEach(row => {
      settings[row.key] = row.value;
    });

    const totalExpense = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?"
    ).get(monthStart, monthEnd);

    const totalIncome = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date >= ? AND date <= ?"
    ).get(monthStart, monthEnd);

    const monthlyIncome = parseFloat(settings.monthly_income) || 300;
    const warnThreshold = parseFloat(settings.warn_threshold) || 200;
    const dangerThreshold = parseFloat(settings.danger_threshold) || 270;
    const spent = totalExpense.total;

    let status = 'safe';
    let message = '花费合理，继续保持哦~ ✨';

    if (spent >= dangerThreshold) {
      status = 'danger';
      message = `已花 ¥${spent.toFixed(2)}，建议延迟消费，养成储蓄好习惯 🐱`;
    } else if (spent >= warnThreshold) {
      status = 'warn';
      message = `已花 ¥${spent.toFixed(2)}，注意控制开支哦~ 💛`;
    }

    res.json({
      success: true,
      data: {
        monthlyIncome,
        totalIncome: totalIncome.total,
        totalExpense: spent,
        remaining: monthlyIncome - spent,
        warnThreshold,
        dangerThreshold,
        status,
        message,
        progress: Math.min((spent / monthlyIncome) * 100, 100)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== 设置 ==========

router.get('/settings', (req, res) => {
  try {
    const settings = {};
    db.prepare('SELECT key, value FROM settings').all().forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/settings', (req, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    const updateMany = db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        stmt.run(key, String(value));
      }
    });

    updateMany(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
