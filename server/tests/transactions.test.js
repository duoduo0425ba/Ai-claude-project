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

// ─── 排序 ────────────────────────────────────────────────────────────────────

describe('GET /api/transactions 排序', () => {
  beforeEach(async () => {
    // 金额与日期顺序相反，用来区分两种排序
    const rows = [
      { amount: 30, date: '2026-04-01' },
      { amount: 10, date: '2026-04-02' },
      { amount: 50, date: '2026-04-03' },
      { amount: 20, date: '2026-04-04' },
    ];
    for (const r of rows) {
      await request(app).post('/api/transactions').set(auth)
        .send({ type: 'expense', category: '测试', ...r });
    }
  });

  it('默认按日期倒序', async () => {
    const res = await request(app).get('/api/transactions').set(auth);
    expect(res.body.data.map((t) => t.date))
      .toEqual(['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01']);
  });

  it('金额降序', async () => {
    const res = await request(app).get('/api/transactions?sort=amount&order=desc').set(auth);
    expect(res.body.data.map((t) => t.amount)).toEqual([50, 30, 20, 10]);
  });

  it('金额升序', async () => {
    const res = await request(app).get('/api/transactions?sort=amount&order=asc').set(auth);
    expect(res.body.data.map((t) => t.amount)).toEqual([10, 20, 30, 50]);
  });

  it('金额排序跨分页仍然正确', async () => {
    const res = await request(app)
      .get('/api/transactions?sort=amount&order=desc&page=1&pageSize=2').set(auth);
    expect(res.body.data.map((t) => t.amount)).toEqual([50, 30]);
    expect(res.body.total).toBe(4);
  });

  it('非法 sort 值回退到默认排序', async () => {
    const res = await request(app)
      .get('/api/transactions?sort=amount;DROP TABLE transactions&order=x').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.date))
      .toEqual(['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01']);
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

// ─── 周汇总 ───────────────────────────────────────────────────────────────────

// 2026-04-20 是周一，2026-04-26 是周日，属于同一周
describe('GET /api/transactions/stats/weekly', () => {
  beforeEach(async () => {
    const add = (t) => request(app).post('/api/transactions').set(auth).send(t);
    await add({ type: 'income',  amount: 100, category: '零花钱', date: '2026-04-20' }); // 周一
    await add({ type: 'expense', amount: 30,  category: '餐饮',   date: '2026-04-20' }); // 周一
    await add({ type: 'expense', amount: 12,  category: '餐饮',   date: '2026-04-20' }); // 周一，同日同类型
    await add({ type: 'expense', amount: 8,   category: '零食',   date: '2026-04-22' }); // 周三
    await add({ type: 'expense', amount: 99,  category: '娱乐',   date: '2026-04-27' }); // 下周一，不应计入
  });

  it('返回周一到周日 7 天，日期和标签对齐', async () => {
    const res = await request(app).get('/api/transactions/stats/weekly?date=2026-04-22').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(7);
    expect(res.body.data[0]).toMatchObject({ date: '2026-04-20', dayLabel: '周一' });
    expect(res.body.data[6]).toMatchObject({ date: '2026-04-26', dayLabel: '周日' });
  });

  it('同日同类型的多条记录被合计', async () => {
    const res = await request(app).get('/api/transactions/stats/weekly?date=2026-04-22').set(auth);
    expect(res.body.data[0].income).toBe(100);
    expect(res.body.data[0].expense).toBe(42); // 30 + 12
  });

  it('没有记录的日子返回 0 而不是 null', async () => {
    const res = await request(app).get('/api/transactions/stats/weekly?date=2026-04-22').set(auth);
    expect(res.body.data[1]).toMatchObject({ date: '2026-04-21', income: 0, expense: 0 });
    expect(res.body.data[2]).toMatchObject({ date: '2026-04-22', income: 0, expense: 8 });
  });

  it('传入周日时回退到本周一，不跨到下一周', async () => {
    const res = await request(app).get('/api/transactions/stats/weekly?date=2026-04-26').set(auth);
    expect(res.body.data[0].date).toBe('2026-04-20');
    expect(res.body.data[6].date).toBe('2026-04-26');
    // 2026-04-27 的 99 元属于下一周，本周总支出应为 30+12+8
    const totalExpense = res.body.data.reduce((s, d) => s + d.expense, 0);
    expect(totalExpense).toBe(50);
  });

  it('不统计其他用户的记录', async () => {
    const reg = await request(app).post('/api/auth/register')
      .send({ username: 'weeklyother', password: 'password123' });
    const otherAuth = { Authorization: `Bearer ${reg.body.data.token}` };
    await request(app).post('/api/transactions').set(otherAuth)
      .send({ type: 'expense', amount: 500, category: '餐饮', date: '2026-04-20' });

    const res = await request(app).get('/api/transactions/stats/weekly?date=2026-04-22').set(auth);
    expect(res.body.data[0].expense).toBe(42); // 不含对方的 500
  });
});

// ─── 批量导入 ─────────────────────────────────────────────────────────────────

describe('POST /api/transactions/batch', () => {
  const batch = (records) =>
    request(app).post('/api/transactions/batch').set(auth).send({ records });

  const ok = { type: 'expense', amount: 30, category: '餐饮', emoji: '🍜', date: '2026-04-26' };

  it('全部合法时整批导入', async () => {
    const res = await batch([ok, { ...ok, amount: 12 }]);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    expect(res.body.skippedCount).toBe(0);
  });

  it('跳过日期格式错误的行并报告行号', async () => {
    const res = await batch([ok, { ...ok, date: '2026-4-5' }, { ...ok, amount: 5 }]);
    expect(res.body.imported).toBe(2);
    expect(res.body.skippedCount).toBe(1);
    expect(res.body.skipped[0]).toMatchObject({ row: 2, field: 'date' });
  });

  it('跳过非法 type 而不是整批 500', async () => {
    const res = await batch([{ ...ok, type: '垃圾' }, ok]);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.skipped[0]).toMatchObject({ row: 1, field: 'type' });
  });

  it('跳过金额为负或为 0 的行', async () => {
    const res = await batch([{ ...ok, amount: -10 }, { ...ok, amount: 0 }, ok]);
    expect(res.body.imported).toBe(1);
    expect(res.body.skippedCount).toBe(2);
  });

  it('跳过分类名超长的行', async () => {
    const res = await batch([{ ...ok, category: 'x'.repeat(51) }]);
    expect(res.body.imported).toBe(0);
    expect(res.body.skipped[0]).toMatchObject({ row: 1, field: 'category' });
  });

  it('全部非法时返回 imported=0 而不报错', async () => {
    const res = await batch([{ foo: 'bar' }, {}]);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBe(0);
    expect(res.body.skippedCount).toBe(2);
  });

  it('skipped 明细最多返回 20 条，skippedCount 仍是总数', async () => {
    const res = await batch(Array.from({ length: 25 }, () => ({ ...ok, date: 'bad' })));
    expect(res.body.skippedCount).toBe(25);
    expect(res.body.skipped).toHaveLength(20);
  });

  it('备份恢复：带 id / created_at / user_id 的整行能正常导入', async () => {
    const res = await batch([{ ...ok, id: 999, created_at: '2026-04-26 10:00:00', user_id: 4242 }]);
    expect(res.body.imported).toBe(1);
    const list = await request(app).get('/api/transactions').set(auth);
    expect(list.body.data[0].id).not.toBe(999); // id 由数据库重新分配
    expect(list.body.data[0].amount).toBe(30);
  });

  it('缺省的 emoji / note 落库为空字符串', async () => {
    await batch([{ type: 'income', amount: 50, category: '零花钱', date: '2026-04-26' }]);
    const list = await request(app).get('/api/transactions').set(auth);
    expect(list.body.data[0].emoji).toBe('');
    expect(list.body.data[0].note).toBe('');
  });

  it('金额是字符串时被转成数字', async () => {
    const res = await batch([{ ...ok, amount: '38.5' }]);
    expect(res.body.imported).toBe(1);
    const list = await request(app).get('/api/transactions').set(auth);
    expect(list.body.data[0].amount).toBe(38.5);
  });

  it('空数组或非数组返回 400', async () => {
    expect((await batch([])).status).toBe(400);
    expect((await batch('nope')).status).toBe(400);
  });
});

// ─── 月汇总 / 年汇总 ──────────────────────────────────────────────────────────

describe('GET /api/transactions/stats/monthly 与 /stats/yearly', () => {
  beforeEach(async () => {
    const add = (t) => request(app).post('/api/transactions').set(auth).send(t);
    await add({ type: 'income',  amount: 100, category: '零花钱', date: '2026-04-20' });
    await add({ type: 'expense', amount: 30,  category: '餐饮',   date: '2026-04-20' });
    await add({ type: 'expense', amount: 12,  category: '餐饮',   date: '2026-04-20' }); // 同日同类型
    await add({ type: 'expense', amount: 50,  category: '娱乐',   date: '2026-04-22' });
    await add({ type: 'expense', amount: 999, category: '餐饮',   date: '2026-03-31' }); // 上月
    await add({ type: 'expense', amount: 888, category: '餐饮',   date: '2026-05-01' }); // 下月
    await add({ type: 'expense', amount: 777, category: '餐饮',   date: '2025-12-31' }); // 上一年
  });

  const monthly = (q) => request(app).get(`/api/transactions/stats/monthly?${q}`).set(auth);
  const yearly  = (q) => request(app).get(`/api/transactions/stats/yearly?${q}`).set(auth);

  it('daily 覆盖当月每一天，空白日补 0', async () => {
    const res = await monthly('year=2026&month=4');
    expect(res.body.data.daily).toHaveLength(30);
    expect(res.body.data.daily[19]).toMatchObject({ date: '2026-04-20', day: 20, income: 100, expense: 42 });
    expect(res.body.data.daily[0]).toMatchObject({ date: '2026-04-01', income: 0, expense: 0 });
  });

  it('月份天数随月份变化（2026 年 2 月 28 天）', async () => {
    const res = await monthly('year=2026&month=2');
    expect(res.body.data.daily).toHaveLength(28);
  });

  it('月度总计只含本月，不含上月和下月', async () => {
    const res = await monthly('year=2026&month=4');
    expect(res.body.data.totalIncome).toBe(100);
    expect(res.body.data.totalExpense).toBe(92); // 30 + 12 + 50
    expect(res.body.data.balance).toBe(8);
  });

  it('无任何记录的月份返回 0 而不是 undefined', async () => {
    const res = await monthly('year=2026&month=7');
    expect(res.body.data.totalIncome).toBe(0);
    expect(res.body.data.totalExpense).toBe(0);
    expect(res.body.data.categories).toEqual([]);
  });

  it('月度分类排行按金额降序，收支分流正确', async () => {
    const res = await monthly('year=2026&month=4');
    expect(res.body.data.categories).toEqual([
      { category: '娱乐', emoji: '', total: 50 },
      { category: '餐饮', emoji: '', total: 42 },
    ]);
    expect(res.body.data.incomeCategories).toEqual([
      { category: '零花钱', emoji: '', total: 100 },
    ]);
  });

  it('yearly 返回 12 个月，空月补 0', async () => {
    const res = await yearly('year=2026');
    expect(res.body.data.months).toHaveLength(12);
    expect(res.body.data.months[0]).toMatchObject({ month: 1, label: '1月', income: 0, expense: 0 });
    expect(res.body.data.months[2]).toMatchObject({ month: 3, expense: 999 });
    expect(res.body.data.months[3]).toMatchObject({ month: 4, income: 100, expense: 92 });
    expect(res.body.data.months[4]).toMatchObject({ month: 5, expense: 888 });
  });

  it('yearly 不统计上一年的记录', async () => {
    const res = await yearly('year=2026');
    const totalExpense = res.body.data.months.reduce((s, m) => s + m.expense, 0);
    expect(totalExpense).toBe(1979); // 999 + 92 + 888，不含 2025 年的 777
  });

  it('yearly 分类排行按金额降序', async () => {
    const res = await yearly('year=2026');
    expect(res.body.data.expenseCategories).toEqual([
      { category: '餐饮', emoji: '', total: 1929 }, // 30+12+999+888
      { category: '娱乐', emoji: '', total: 50 },
    ]);
    expect(res.body.data.incomeCategories).toEqual([
      { category: '零花钱', emoji: '', total: 100 },
    ]);
  });

  it('yearly 分类排行最多返回 8 条', async () => {
    for (let i = 1; i <= 10; i++) {
      await request(app).post('/api/transactions').set(auth)
        .send({ type: 'expense', amount: i, category: `分类${i}`, date: '2026-06-15' });
    }
    const res = await yearly('year=2026');
    expect(res.body.data.expenseCategories).toHaveLength(8);
  });

  it('不统计其他用户的记录', async () => {
    const reg = await request(app).post('/api/auth/register')
      .send({ username: 'monthlyother', password: 'password123' });
    const otherAuth = { Authorization: `Bearer ${reg.body.data.token}` };
    await request(app).post('/api/transactions').set(otherAuth)
      .send({ type: 'expense', amount: 500, category: '餐饮', date: '2026-04-20' });

    const res = await monthly('year=2026&month=4');
    expect(res.body.data.totalExpense).toBe(92);
    expect(res.body.data.daily[19].expense).toBe(42);
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
