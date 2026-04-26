const express = require('express');
const router = express.Router();
const db = require('../db');
const { z } = require('zod');

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  category: z.string().min(1).max(50),
  emoji: z.string().max(10).optional().default(''),
  note: z.string().max(500).optional().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
});

// ── 设置 ──────────────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  try {
    const settings = {};
    db.prepare('SELECT key, value FROM settings WHERE user_id = ?')
      .all(req.user.userId)
      .forEach(row => { settings[row.key] = row.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/settings', (req, res) => {
  try {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)'
    );
    db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        stmt.run(req.user.userId, key, String(value));
      }
    })(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 交易 CRUD ─────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    const { startDate, endDate, category, keyword, type, page, pageSize } = req.query;
    const userId = req.user.userId;
    let where = 'WHERE user_id = ?';
    const params = [userId];

    if (startDate) { where += ' AND date >= ?'; params.push(startDate); }
    if (endDate)   { where += ' AND date <= ?'; params.push(endDate); }
    if (category)  { where += ' AND category = ?'; params.push(category); }
    if (type)      { where += ' AND type = ?'; params.push(type); }
    if (keyword) {
      where += ' AND (note LIKE ? OR category LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM transactions ${where}`)
      .get(...params).cnt;

    let sql = `SELECT * FROM transactions ${where} ORDER BY date DESC, created_at DESC`;
    if (page !== undefined) {
      const limit = Math.min(Math.max(parseInt(pageSize) || 30, 1), 100);
      const offset = (Math.max(parseInt(page), 1) - 1) * limit;
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const { type, amount, category, emoji, note, date } = parsed.data;

    const result = db.prepare(`
      INSERT INTO transactions (type, amount, category, emoji, note, date, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(type, amount, category, emoji, note, date, req.user.userId);

    const newRecord = db.prepare('SELECT * FROM transactions WHERE id = ?')
      .get(result.lastInsertRowid);
    res.json({ success: true, data: newRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const { type, amount, category, emoji, note, date } = parsed.data;

    const result = db.prepare(`
      UPDATE transactions
      SET type = ?, amount = ?, category = ?, emoji = ?, note = ?, date = ?
      WHERE id = ? AND user_id = ?
    `).run(type, amount, category, emoji, note, date, req.params.id, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.userId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: '无有效记录' });
    }
    const stmt = db.prepare(`
      INSERT INTO transactions (type, amount, category, emoji, note, date, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const count = db.transaction((items) => {
      let n = 0;
      for (const item of items) {
        if (item.type && item.amount && item.category && item.date) {
          stmt.run(item.type, item.amount, item.category, item.emoji || '', item.note || '', item.date, req.user.userId);
          n++;
        }
      }
      return n;
    })(records);
    res.json({ success: true, imported: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 统计 API ──────────────────────────────────────────────────────────────────

router.get('/stats/daily', (req, res) => {
  try {
    const uid = req.user.userId;
    const targetDate = req.query.date || formatLocalDate();

    const income = db.prepare(
      "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date=? AND user_id=?"
    ).get(targetDate, uid);
    const expense = db.prepare(
      "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date=? AND user_id=?"
    ).get(targetDate, uid);
    const records = db.prepare(
      'SELECT * FROM transactions WHERE date=? AND user_id=? ORDER BY created_at DESC'
    ).all(targetDate, uid);

    res.json({ success: true, data: { date: targetDate, income: income.total, expense: expense.total, balance: income.total - expense.total, records } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats/weekly', (req, res) => {
  try {
    const uid = req.user.userId;
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const dow = targetDate.getDay();
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() - (dow === 0 ? 6 : dow - 1));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatLocalDate(d);
      const income = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date=? AND user_id=?").get(dateStr, uid);
      const expense = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date=? AND user_id=?").get(dateStr, uid);
      days.push({ date: dateStr, dayLabel: ['周一','周二','周三','周四','周五','周六','周日'][i], income: income.total, expense: expense.total });
    }
    res.json({ success: true, data: days });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats/monthly', (req, res) => {
  try {
    const uid = req.user.userId;
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthStart = `${y}-${String(m).padStart(2,'0')}-01`;
    const monthEnd   = `${y}-${String(m).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

    const daily = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const inc = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date=? AND user_id=?").get(dateStr, uid);
      const exp = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date=? AND user_id=?").get(dateStr, uid);
      daily.push({ date: dateStr, day: d, income: inc.total, expense: exp.total });
    }

    const categories = db.prepare(`
      SELECT category, emoji, SUM(amount) as total
      FROM transactions WHERE type='expense' AND date>=? AND date<=? AND user_id=?
      GROUP BY category ORDER BY total DESC
    `).all(monthStart, monthEnd, uid);

    const incomeCategories = db.prepare(`
      SELECT category, emoji, SUM(amount) as total
      FROM transactions WHERE type='income' AND date>=? AND date<=? AND user_id=?
      GROUP BY category ORDER BY total DESC
    `).all(monthStart, monthEnd, uid);

    const totalIncome  = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date>=? AND date<=? AND user_id=?").get(monthStart, monthEnd, uid);
    const totalExpense = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date>=? AND date<=? AND user_id=?").get(monthStart, monthEnd, uid);

    res.json({ success: true, data: { daily, categories, incomeCategories, totalIncome: totalIncome.total, totalExpense: totalExpense.total, balance: totalIncome.total - totalExpense.total } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats/yearly', (req, res) => {
  try {
    const uid = req.user.userId;
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const yearStart = `${y}-01-01`;
    const yearEnd   = `${y}-12-31`;

    const months = [];
    for (let mo = 1; mo <= 12; mo++) {
      const ms = `${y}-${String(mo).padStart(2,'0')}-01`;
      const me = `${y}-${String(mo).padStart(2,'0')}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`;
      const inc = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date>=? AND date<=? AND user_id=?").get(ms, me, uid);
      const exp = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date>=? AND date<=? AND user_id=?").get(ms, me, uid);
      months.push({ month: mo, label: `${mo}月`, income: inc.total, expense: exp.total });
    }

    const expenseCategories = db.prepare(`
      SELECT category, emoji, SUM(amount) as total
      FROM transactions WHERE type='expense' AND date>=? AND date<=? AND user_id=?
      GROUP BY category ORDER BY total DESC LIMIT 8
    `).all(yearStart, yearEnd, uid);

    const incomeCategories = db.prepare(`
      SELECT category, emoji, SUM(amount) as total
      FROM transactions WHERE type='income' AND date>=? AND date<=? AND user_id=?
      GROUP BY category ORDER BY total DESC LIMIT 8
    `).all(yearStart, yearEnd, uid);

    res.json({ success: true, data: { months, expenseCategories, incomeCategories } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats/balance', (req, res) => {
  try {
    const uid = req.user.userId;
    const settings = {};
    db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(uid)
      .forEach(r => { settings[r.key] = r.value; });
    const initialBalance = parseFloat(settings.initial_balance) || 0;
    const totalIncome  = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND user_id=?").get(uid);
    const totalExpense = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND user_id=?").get(uid);
    res.json({ success: true, data: { initialBalance, totalIncome: totalIncome.total, totalExpense: totalExpense.total, netBalance: initialBalance + totalIncome.total - totalExpense.total } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats/budget', (req, res) => {
  try {
    const uid = req.user.userId;
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthStart = `${y}-${String(m).padStart(2,'0')}-01`;
    const monthEnd   = `${y}-${String(m).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

    const settings = {};
    db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(uid)
      .forEach(r => { settings[r.key] = r.value; });

    const totalExpense = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date>=? AND date<=? AND user_id=?").get(monthStart, monthEnd, uid);
    const totalIncome  = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income' AND date>=? AND date<=? AND user_id=?").get(monthStart, monthEnd, uid);

    const monthlyIncome   = parseFloat(settings.monthly_income)  || 300;
    const warnThreshold   = parseFloat(settings.warn_threshold)  || 200;
    const dangerThreshold = parseFloat(settings.danger_threshold)|| 270;
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

    res.json({ success: true, data: { monthlyIncome, totalIncome: totalIncome.total, totalExpense: spent, remaining: monthlyIncome - spent, warnThreshold, dangerThreshold, status, message, progress: Math.min((spent / monthlyIncome) * 100, 100) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
