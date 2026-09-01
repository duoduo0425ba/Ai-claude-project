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

const templateSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  category: z.string().min(1).max(50),
  emoji: z.string().max(10).optional().default(''),
  note: z.string().max(500).optional().default(''),
  frequency: z.enum(['weekly', 'monthly']),
  day_of_week: z.coerce.number().int().min(0).max(6).nullable().optional().default(null),
  day_of_month: z.coerce.number().int().min(1).max(28).nullable().optional().default(null),
});

// 不用 z.coerce.boolean()——它会把 "0" 转成 true
const toggleSchema = z.object({
  is_active: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0)),
});

router.get('/', (req, res) => {
  try {
    const templates = db.prepare(
      'SELECT * FROM recurring_templates WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.userId);
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const { type, amount, category, emoji, note, frequency, day_of_week, day_of_month } = parsed.data;

    if (frequency === 'weekly' && day_of_week == null) {
      return res.status(400).json({ success: false, error: '按周账单需指定星期几' });
    }
    if (frequency === 'monthly' && day_of_month == null) {
      return res.status(400).json({ success: false, error: '按月账单需指定每月几号' });
    }

    const result = db.prepare(`
      INSERT INTO recurring_templates
        (type, amount, category, emoji, note, frequency, day_of_week, day_of_month, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, amount, category, emoji, note, frequency, day_of_week, day_of_month, req.user.userId);

    const template = db.prepare('SELECT * FROM recurring_templates WHERE id = ?')
      .get(result.lastInsertRowid);
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(
      'DELETE FROM recurring_templates WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.userId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const result = db.prepare(
      'UPDATE recurring_templates SET is_active = ? WHERE id = ? AND user_id = ?'
    ).run(parsed.data.is_active, req.params.id, req.user.userId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    const template = db.prepare('SELECT * FROM recurring_templates WHERE id = ?')
      .get(req.params.id);
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/generate', (req, res) => {
  try {
    const uid = req.user.userId;
    const today = formatLocalDate();
    const now = new Date();
    const dayOfMonth = now.getDate();
    const dow = now.getDay();
    const dayOfWeek = dow === 0 ? 6 : dow - 1;

    const templates = db.prepare(
      'SELECT * FROM recurring_templates WHERE is_active = 1 AND user_id = ?'
    ).all(uid);

    let generated = 0;
    for (const t of templates) {
      let isDue = false;
      if (t.frequency === 'monthly' && dayOfMonth === t.day_of_month) {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const thisMonthTarget = `${year}-${month}-${String(t.day_of_month).padStart(2, '0')}`;
        isDue = !t.last_generated || t.last_generated < thisMonthTarget;
      } else if (t.frequency === 'weekly' && dayOfWeek === t.day_of_week) {
        isDue = !t.last_generated || t.last_generated < today;
      }
      if (isDue) {
        db.prepare(`
          INSERT INTO transactions (type, amount, category, emoji, note, date, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(t.type, t.amount, t.category, t.emoji, t.note, today, uid);
        db.prepare(
          'UPDATE recurring_templates SET last_generated = ? WHERE id = ?'
        ).run(today, t.id);
        generated++;
      }
    }
    res.json({ success: true, generated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
