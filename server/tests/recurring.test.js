process.env.DB_PATH = ':memory:';

const request = require('supertest');
const app = require('../app');
const db = require('../db');

let auth; // Authorization 请求头
let userId;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({
    username: 'recurruser', password: 'password123',
  });
  auth = { Authorization: `Bearer ${res.body.data.token}` };
  userId = db.prepare('SELECT id FROM users WHERE username = ?').get('recurruser').id;
});

beforeEach(() => {
  db.prepare('DELETE FROM recurring_templates').run();
  db.prepare('DELETE FROM transactions').run();
});

afterAll(() => {
  db.close();
});

// 走真实 API 创建模板（day_of_month=1 任何日期都合法）
const createTpl = async (overrides = {}) => {
  const res = await request(app).post('/api/recurring').set(auth).send({
    type: 'expense', amount: 15, category: '早餐',
    frequency: 'monthly', day_of_month: 1, ...overrides,
  });
  return res.body.data;
};

// 直接插库造一条「今天到期」的模板——绕过 Zod 的 day_of_month<=28 上限，
// 保证 29~31 号跑测试也不挂（仓库无时钟 mock，只能贴真实日期）
const insertDueToday = ({ is_active = 1 } = {}) => {
  const result = db.prepare(`
    INSERT INTO recurring_templates
      (type, amount, category, emoji, note, frequency, day_of_month, is_active, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('expense', 88.88, '房租', '🏠', '', 'monthly', new Date().getDate(), is_active, userId);
  return result.lastInsertRowid;
};

describe('PATCH /api/recurring/:id', () => {
  test('暂停模板返回更新后的数据并持久化', async () => {
    const tpl = await createTpl();
    const res = await request(app)
      .patch(`/api/recurring/${tpl.id}`).set(auth).send({ is_active: 0 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(0);

    const list = await request(app).get('/api/recurring').set(auth);
    expect(list.body.data.find((t) => t.id === tpl.id).is_active).toBe(0);
  });

  test('恢复已暂停的模板', async () => {
    const tpl = await createTpl();
    await request(app).patch(`/api/recurring/${tpl.id}`).set(auth).send({ is_active: 0 });
    const res = await request(app)
      .patch(`/api/recurring/${tpl.id}`).set(auth).send({ is_active: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(1);
  });

  test('接受布尔值并归一化为 0/1', async () => {
    const tpl = await createTpl();
    const res = await request(app)
      .patch(`/api/recurring/${tpl.id}`).set(auth).send({ is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(0); // 严格是 0，不是 false
  });

  test('缺少 is_active 返回 400', async () => {
    const tpl = await createTpl();
    const res = await request(app)
      .patch(`/api/recurring/${tpl.id}`).set(auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('非法 is_active 值返回 400', async () => {
    const tpl = await createTpl();
    for (const bad of [2, 'yes']) {
      const res = await request(app)
        .patch(`/api/recurring/${tpl.id}`).set(auth).send({ is_active: bad });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });

  test('不存在的 id 返回 404', async () => {
    const res = await request(app)
      .patch('/api/recurring/99999').set(auth).send({ is_active: 0 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('模板不存在');
  });

  test('不能修改其他用户的模板', async () => {
    const tpl = await createTpl();
    const reg = await request(app).post('/api/auth/register').send({
      username: 'otherrecurr', password: 'password123',
    });
    const otherAuth = { Authorization: `Bearer ${reg.body.data.token}` };

    const res = await request(app)
      .patch(`/api/recurring/${tpl.id}`).set(otherAuth).send({ is_active: 0 });
    expect(res.status).toBe(404);

    const list = await request(app).get('/api/recurring').set(auth);
    expect(list.body.data.find((t) => t.id === tpl.id).is_active).toBe(1);
  });

  test('未登录返回 401', async () => {
    const res = await request(app).patch('/api/recurring/1').send({ is_active: 0 });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/recurring/generate 与暂停状态', () => {
  test('活跃且到期的模板会生成，同日不重复生成', async () => {
    insertDueToday({ is_active: 1 });
    const first = await request(app).post('/api/recurring/generate').set(auth);
    expect(first.body.generated).toBe(1);
    const second = await request(app).post('/api/recurring/generate').set(auth);
    expect(second.body.generated).toBe(0);
  });

  test('已暂停的到期模板不会生成', async () => {
    insertDueToday({ is_active: 0 });
    const res = await request(app).post('/api/recurring/generate').set(auth);
    expect(res.body.generated).toBe(0);

    const list = await request(app).get('/api/transactions').set(auth);
    expect(list.body.data).toHaveLength(0);
  });

  test('恢复后即可生成', async () => {
    const id = insertDueToday({ is_active: 0 });
    const before = await request(app).post('/api/recurring/generate').set(auth);
    expect(before.body.generated).toBe(0);

    await request(app).patch(`/api/recurring/${id}`).set(auth).send({ is_active: 1 });
    const after = await request(app).post('/api/recurring/generate').set(auth);
    expect(after.body.generated).toBe(1);

    const list = await request(app).get('/api/transactions').set(auth);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].amount).toBe(88.88);
    expect(list.body.data[0].category).toBe('房租');
  });
});
