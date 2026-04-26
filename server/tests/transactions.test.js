process.env.DB_PATH = ':memory:';

const request = require('supertest');
const app = require('../app');
const db = require('../db');

let auth; // Authorization 请求头

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({
    username: 'testuser', password: 'password123',
  });
  auth = { Authorization: `Bearer ${res.body.data.token}` };
});

beforeEach(() => {
  db.prepare('DELETE FROM transactions').run();
});

afterAll(() => {
  db.close();
});

// ─── POST /api/transactions ───────────────────────────────────────────────────

describe('POST /api/transactions', () => {
  it('成功创建一条支出记录', async () => {
    const res = await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 55, category: '餐饮', emoji: '🍜', date: '2026-04-26' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(55);
  });

  it('拒绝无效 type', async () => {
    const res = await request(app).post('/api/transactions').set(auth)
      .send({ type: 'other', amount: 10, category: '餐饮', date: '2026-04-26' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('拒绝负数金额', async () => {
    const res = await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: -10, category: '餐饮', date: '2026-04-26' });
    expect(res.status).toBe(400);
  });

  it('拒绝格式错误的日期', async () => {
    const res = await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 10, category: '餐饮', date: '20260426' });
    expect(res.status).toBe(400);
  });

  it('未登录时返回 401', async () => {
    const res = await request(app).post('/api/transactions')
      .send({ type: 'expense', amount: 10, category: '餐饮', date: '2026-04-26' });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/transactions 分页 ───────────────────────────────────────────────

describe('GET /api/transactions 分页', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/api/transactions').set(auth)
        .send({ type: 'expense', amount: i * 10, category: '测试', date: `2026-04-${String(i).padStart(2,'0')}` });
    }
  });

  it('不传 page 时返回全部记录', async () => {
    const res = await request(app).get('/api/transactions').set(auth);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.total).toBe(5);
  });

  it('第 1 页返回 2 条', async () => {
    const res = await request(app).get('/api/transactions?page=1&pageSize=2').set(auth);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });

  it('第 3 页返回 1 条', async () => {
    const res = await request(app).get('/api/transactions?page=3&pageSize=2').set(auth);
    expect(res.body.data).toHaveLength(1);
  });
});

// ─── 当日摘要 ──────────────────────────────────────────────────────────────────

describe('GET /api/transactions/stats/daily', () => {
  beforeEach(async () => {
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'income', amount: 100, category: '零花钱', date: '2026-04-26' });
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 30, category: '餐饮', date: '2026-04-26' });
  });

  it('正确返回当日收支和结余', async () => {
    const res = await request(app).get('/api/transactions/stats/daily?date=2026-04-26').set(auth);
    expect(res.body.data.income).toBe(100);
    expect(res.body.data.expense).toBe(30);
    expect(res.body.data.balance).toBe(70);
  });

  it('其他日期返回 0', async () => {
    const res = await request(app).get('/api/transactions/stats/daily?date=2026-04-25').set(auth);
    expect(res.body.data.income).toBe(0);
    expect(res.body.data.expense).toBe(0);
  });
});

// ─── 预算状态 ──────────────────────────────────────────────────────────────────

describe('GET /api/transactions/stats/budget', () => {
  it('支出低于警戒线时返回 safe', async () => {
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 50, category: '餐饮', date: '2026-04-26' });
    const res = await request(app).get('/api/transactions/stats/budget?year=2026&month=4').set(auth);
    expect(res.body.data.status).toBe('safe');
    expect(res.body.data.totalExpense).toBe(50);
  });

  it('超过预警阈值返回 warn', async () => {
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 220, category: '娱乐', date: '2026-04-26' });
    const res = await request(app).get('/api/transactions/stats/budget?year=2026&month=4').set(auth);
    expect(res.body.data.status).toBe('warn');
  });

  it('超过危险阈值返回 danger', async () => {
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 280, category: '娱乐', date: '2026-04-26' });
    const res = await request(app).get('/api/transactions/stats/budget?year=2026&month=4').set(auth);
    expect(res.body.data.status).toBe('danger');
  });
});
