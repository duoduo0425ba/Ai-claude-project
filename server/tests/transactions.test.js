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

// ─── 分页参数健壮性 ───────────────────────────────────────────────────────────

describe('分页参数异常时不应 500', () => {
  beforeEach(async () => {
    for (const d of ['2026-04-01', '2026-04-02', '2026-04-03']) {
      await request(app).post('/api/transactions').set(auth)
        .send({ type: 'expense', amount: 10, category: '餐饮', date: d });
    }
  });

  it.each(['abc', '', '-5', '0'])('page=%s 回落到第 1 页', async (page) => {
    const res = await request(app)
      .get(`/api/transactions?page=${page}&pageSize=2`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it('超大 page 不会 500，只是返回空列表', async () => {
    const res = await request(app)
      .get(`/api/transactions?page=${'9'.repeat(400)}&pageSize=2`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(3);
  });

  it('page 传成数组（?page=2&page=3）也能正常分页', async () => {
    const res = await request(app)
      .get('/api/transactions?page=2&page=3&pageSize=2').set(auth);
    expect(res.status).toBe(200);
    // 同名参数只取第一个（见 app.js 的 query parser），page=2：每页 2 条共 3 条，第 2 页剩 1 条
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(3);
  });
});

// ─── 设置项白名单 ─────────────────────────────────────────────────────────────

describe('PUT /settings 只接受已知的数字设置项', () => {
  // 单独用一个用户，改设置不影响上面预算用例依赖的阈值
  let settingsAuth;
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'settingsuser', password: 'password123',
    });
    settingsAuth = { Authorization: `Bearer ${res.body.data.token}` };
  });

  const put = (body) =>
    request(app).put('/api/transactions/settings').set(settingsAuth).send(body);
  const current = async () =>
    (await request(app).get('/api/transactions/settings').set(settingsAuth)).body.data;

  it('未知的键被丢弃，不会写进数据库', async () => {
    expect((await put({ monthly_income: 500, junk_key: 'x' })).status).toBe(200);
    const settings = await current();
    expect(settings.monthly_income).toBe('500');
    expect(settings).not.toHaveProperty('junk_key');
  });

  it('值不是数字时整体拒绝，已有设置保持不变', async () => {
    const before = await current();
    const res = await put({ monthly_income: 800, warn_threshold: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('设置值必须是数字');
    expect(await current()).toEqual(before);
  });

  it('兼容备份文件里的字符串数字；只传部分项时其余不变', async () => {
    const before = await current();
    expect((await put({ warn_threshold: '150' })).status).toBe(200);
    expect(await current()).toEqual({ ...before, warn_threshold: '150' });
  });

  it('请求体不是对象时拒绝', async () => {
    expect((await put([1, 2])).status).toBe(400);
    expect(await current()).not.toHaveProperty('0');
  });
});

// ─── 批量操作的条数上限 ───────────────────────────────────────────────────────

describe('不分页查询与批量导入的条数上限（20000 条）', () => {
  let userId;
  beforeAll(() => {
    userId = db.prepare("SELECT id FROM users WHERE username = 'testuser'").get().id;
  });

  // 直接写库造数据，比走接口快得多（beforeEach 会清空 transactions）
  const insertRows = (n) => {
    const stmt = db.prepare(
      "INSERT INTO transactions (type, amount, category, date, user_id) VALUES ('expense', 1, '餐饮', '2026-04-01', ?)"
    );
    db.transaction(() => { for (let i = 0; i < n; i++) stmt.run(userId); })();
  };

  it('恰好 20000 条时仍能不分页全部取回（备份、导出依赖这一点）', async () => {
    insertRows(20000);
    const res = await request(app).get('/api/transactions').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20000);
  });

  it('超过 20000 条时不分页查询直接报错，而不是悄悄截断', async () => {
    insertRows(20001);
    const res = await request(app).get('/api/transactions').set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('20000');

    // 分页查询不受影响
    const paged = await request(app).get('/api/transactions?page=1&pageSize=30').set(auth);
    expect(paged.status).toBe(200);
    expect(paged.body.total).toBe(20001);
  });

  it('单次导入超过 20000 条时整体拒绝，一条都不写入', async () => {
    const records = Array.from({ length: 20001 }, () => ({
      type: 'expense', amount: 1, category: '餐饮', date: '2026-04-01',
    }));
    const res = await request(app).post('/api/transactions/batch').set(auth).send({ records });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('单次最多导入 20000 条记录');
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(userId);
    expect(n).toBe(0);
  });
});

// ─── 错误信息不外泄 ───────────────────────────────────────────────────────────

describe('出错时不向前端暴露内部细节', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('重复的查询参数只取第一个，不再触发 500', async () => {
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'income', amount: 10, category: '工资', date: '2026-04-01' });
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 5, category: '餐饮', date: '2026-04-01' });

    const res = await request(app).get('/api/transactions?type=income&type=expense').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.type)).toEqual(['income']);
  });

  it('数据库报错时只返回通用提示，详细错误写进服务端日志', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    // 中间件用的是预编译好的语句，所以这次请求里第一次 prepare 发生在路由里
    jest.spyOn(db, 'prepare').mockImplementationOnce(() => {
      throw new Error('no such table: secret_internal_table');
    });

    const res = await request(app).get('/api/transactions/settings').set(auth);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: '服务器错误' });
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'no such table: secret_internal_table' })
    );
  });

  it('请求体不是合法 JSON 时返回 JSON 格式的 400', async () => {
    const res = await request(app).post('/api/transactions').set(auth)
      .set('Content-Type', 'application/json').send('{"type": broken');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ success: false, error: '请求格式错误' });
  });
});
