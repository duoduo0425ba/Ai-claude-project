process.env.DB_PATH = ':memory:';

const request = require('supertest');
const app = require('../app');
const db = require('../db');

let authA; // 用户 A 的 Authorization 请求头
let authB; // 用户 B（隔离测试用）

beforeAll(async () => {
  const resA = await request(app).post('/api/auth/register').send({
    username: 'taguser_a', password: 'password123',
  });
  authA = { Authorization: `Bearer ${resA.body.data.token}` };

  const resB = await request(app).post('/api/auth/register').send({
    username: 'taguser_b', password: 'password123',
  });
  authB = { Authorization: `Bearer ${resB.body.data.token}` };
});

beforeEach(() => {
  db.prepare('DELETE FROM transaction_tags').run();
  db.prepare('DELETE FROM tags').run();
  db.prepare('DELETE FROM transactions').run();
});

afterAll(() => {
  db.close();
});

// 基础记录工厂
const tx = (overrides = {}) => ({
  type: 'expense', amount: 10, category: '午餐', date: '2026-08-01', ...overrides,
});

const add = (t, auth = authA) =>
  request(app).post('/api/transactions').set(auth).send(t);

const getTags = (auth = authA) => request(app).get('/api/tags').set(auth);

describe('POST /api/transactions 带标签', () => {
  it('创建时写入标签并按名称排序返回', async () => {
    const res = await add(tx({ tags: ['早餐', '学校'] }));
    expect(res.status).toBe(200);
    // SQLite BINARY 排序按码点：学(U+5B66) < 早(U+65E9)
    expect(res.body.data.tags).toEqual(['学校', '早餐']);

    const list = await request(app).get('/api/transactions').set(authA);
    expect(list.body.data[0].tags).toEqual(['学校', '早餐']);
  });

  it('不传 tags 时返回空数组', async () => {
    const res = await add(tx());
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual([]);
  });

  it('复用已有标签不产生重复行', async () => {
    await add(tx({ tags: ['学校'] }));
    await add(tx({ date: '2026-08-02', tags: ['学校'] }));
    const res = await getTags();
    expect(res.body.data).toEqual([{ name: '学校', count: 2 }]);
  });

  it('同一请求内去重并 trim', async () => {
    const res = await add(tx({ tags: [' 学校', '学校', '学校 '] }));
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual(['学校']);
  });

  it('trim 后为空的标签返回 400', async () => {
    const res = await add(tx({ tags: ['   '] }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('超过 20 字的标签返回 400', async () => {
    const res = await add(tx({ tags: ['一'.repeat(21)] }));
    expect(res.status).toBe(400);
  });

  it('超过 10 个标签返回 400', async () => {
    const many = Array.from({ length: 11 }, (_, i) => `标签${i}`);
    const res = await add(tx({ tags: many }));
    expect(res.status).toBe(400);
  });

  it('tags 不是数组返回 400', async () => {
    const res = await add(tx({ tags: '学校' }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/transactions 附带标签', () => {
  it('每行只带自己的标签', async () => {
    await add(tx({ note: 'r1', tags: ['a', 'b'] }));
    await add(tx({ note: 'r2', date: '2026-08-02', tags: ['b'] }));
    await add(tx({ note: 'r3', date: '2026-08-03' }));

    const res = await request(app).get('/api/transactions').set(authA);
    const byNote = Object.fromEntries(res.body.data.map((r) => [r.note, r.tags]));
    expect(byNote.r1).toEqual(['a', 'b']);
    expect(byNote.r2).toEqual(['b']);
    expect(byNote.r3).toEqual([]);
  });

  it('分页时当页标签正确且 total 不受影响', async () => {
    await add(tx({ note: 'r1', date: '2026-08-01', tags: ['a'] }));
    await add(tx({ note: 'r2', date: '2026-08-02', tags: ['b'] }));
    await add(tx({ note: 'r3', date: '2026-08-03', tags: ['c'] }));

    const res = await request(app)
      .get('/api/transactions?page=1&pageSize=2').set(authA);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
    // 默认按日期倒序：r3、r2
    expect(res.body.data[0].tags).toEqual(['c']);
    expect(res.body.data[1].tags).toEqual(['b']);
  });
});

describe('GET /api/transactions?tag= 筛选', () => {
  it('只返回带该标签的记录且 total 正确', async () => {
    await add(tx({ note: 'm1', tags: ['学校'] }));
    await add(tx({ note: 'm2', date: '2026-08-02', tags: ['学校', '早餐'] }));
    await add(tx({ note: 'm3', date: '2026-08-03', tags: ['学校'] }));
    await add(tx({ note: 'x1', date: '2026-08-04', tags: ['旅行'] }));
    await add(tx({ note: 'x2', date: '2026-08-05' }));

    const res = await request(app)
      .get('/api/transactions?tag=学校').set(authA);
    expect(res.body.total).toBe(3);
    expect(res.body.data.map((r) => r.note).sort()).toEqual(['m1', 'm2', 'm3']);
  });

  it('筛选与分页组合时 total 是匹配总数', async () => {
    await add(tx({ note: 'm1', date: '2026-08-01', tags: ['学校'] }));
    await add(tx({ note: 'm2', date: '2026-08-02', tags: ['学校'] }));
    await add(tx({ note: 'm3', date: '2026-08-03', tags: ['学校'] }));
    await add(tx({ note: 'x1', date: '2026-08-04', tags: ['旅行'] }));

    const res = await request(app)
      .get('/api/transactions?tag=学校&page=1&pageSize=2').set(authA);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it('tag 与 category 组合取交集', async () => {
    await add(tx({ note: 'hit', category: '午餐', tags: ['学校'] }));
    await add(tx({ note: 'wrongcat', category: '交通', date: '2026-08-02', tags: ['学校'] }));
    await add(tx({ note: 'wrongtag', category: '午餐', date: '2026-08-03', tags: ['旅行'] }));

    const res = await request(app)
      .get('/api/transactions?tag=学校&category=午餐').set(authA);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].note).toBe('hit');
  });

  it('不存在的标签返回空结果', async () => {
    await add(tx({ tags: ['学校'] }));
    const res = await request(app)
      .get('/api/transactions?tag=不存在').set(authA);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe('PUT /api/transactions/:id 替换标签集', () => {
  it('换成新标签集并更新计数', async () => {
    const created = await add(tx({ tags: ['旧'] }));
    const res = await request(app)
      .put(`/api/transactions/${created.body.data.id}`).set(authA)
      .send(tx({ tags: ['新'] }));
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual(['新']);

    const tags = await getTags();
    expect(tags.body.data).toEqual([
      { name: '新', count: 1 },
      { name: '旧', count: 0 },
    ]);
  });

  it('tags: [] 清空标签，孤儿标签保留为 count 0', async () => {
    const created = await add(tx({ tags: ['学校'] }));
    const res = await request(app)
      .put(`/api/transactions/${created.body.data.id}`).set(authA)
      .send(tx({ tags: [] }));
    expect(res.body.data.tags).toEqual([]);

    const tags = await getTags();
    expect(tags.body.data).toEqual([{ name: '学校', count: 0 }]);
  });

  it('不传 tags 视为清空（default-[] 语义）', async () => {
    const created = await add(tx({ tags: ['学校'] }));
    const res = await request(app)
      .put(`/api/transactions/${created.body.data.id}`).set(authA)
      .send(tx());
    expect(res.body.data.tags).toEqual([]);
  });

  it('不存在的 id 返回 404 且不产生新标签', async () => {
    const res = await request(app)
      .put('/api/transactions/99999').set(authA)
      .send(tx({ tags: ['幽灵'] }));
    expect(res.status).toBe(404);

    const tags = await getTags();
    expect(tags.body.data).toEqual([]);
  });
});

describe('DELETE /api/transactions/:id 清理关联', () => {
  it('删除后筛选不到，标签行保留为 count 0', async () => {
    const created = await add(tx({ tags: ['学校'] }));
    await request(app)
      .delete(`/api/transactions/${created.body.data.id}`).set(authA);

    const list = await request(app)
      .get('/api/transactions?tag=学校').set(authA);
    expect(list.body.total).toBe(0);

    const tags = await getTags();
    expect(tags.body.data).toEqual([{ name: '学校', count: 0 }]);
  });
});

describe('GET /api/tags', () => {
  it('按 count 降序、name 升序返回', async () => {
    await add(tx({ date: '2026-08-01', tags: ['交通'] }));
    await add(tx({ date: '2026-08-02', tags: ['交通'] }));
    const third = await add(tx({ date: '2026-08-03', tags: ['交通', '学校', '旅行'] }));
    // 把「旅行」变成孤儿（count 0）
    await request(app)
      .put(`/api/transactions/${third.body.data.id}`).set(authA)
      .send(tx({ date: '2026-08-03', tags: ['交通', '学校'] }));

    const res = await getTags();
    expect(res.body.data).toEqual([
      { name: '交通', count: 3 },
      { name: '学校', count: 1 },
      { name: '旅行', count: 0 },
    ]);
  });

  it('无标签时返回空数组', async () => {
    const res = await getTags();
    expect(res.body.data).toEqual([]);
  });

  it('未登录返回 401', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(401);
  });
});

describe('跨用户隔离', () => {
  it('同名标签各自独立计数', async () => {
    await add(tx({ tags: ['共享名'] }), authA);
    await add(tx({ tags: ['共享名'] }), authB);
    await add(tx({ date: '2026-08-02', tags: ['共享名'] }), authB);

    const a = await getTags(authA);
    const b = await getTags(authB);
    expect(a.body.data).toEqual([{ name: '共享名', count: 1 }]);
    expect(b.body.data).toEqual([{ name: '共享名', count: 2 }]);
  });

  it('用户 B 筛选不到用户 A 的标签，列表行也不带 A 的标签', async () => {
    await add(tx({ tags: ['私有标签'] }), authA);
    await add(tx({ note: 'b-row' }), authB);

    const filtered = await request(app)
      .get('/api/transactions?tag=私有标签').set(authB);
    expect(filtered.body.total).toBe(0);

    const list = await request(app).get('/api/transactions').set(authB);
    expect(list.body.data[0].tags).toEqual([]);
  });
});

describe('POST /api/transactions/batch 带标签', () => {
  it('合法行的标签被创建并关联，非法行照常跳过', async () => {
    const res = await request(app)
      .post('/api/transactions/batch').set(authA)
      .send({
        records: [
          tx({ tags: ['x'] }),
          tx({ date: '2026-08-02', tags: ['x', 'y'] }),
          tx({ date: '2026-8-3' }), // 非法日期
        ],
      });
    expect(res.body.imported).toBe(2);
    expect(res.body.skippedCount).toBe(1);

    const tags = await getTags();
    expect(tags.body.data).toEqual([
      { name: 'x', count: 2 },
      { name: 'y', count: 1 },
    ]);
  });

  it('备份导出的原始行（含 id/created_at/user_id/tags）可回灌且标签保留', async () => {
    await add(tx({ tags: ['备份标签'] }));
    const exported = await request(app).get('/api/transactions').set(authA);

    db.prepare('DELETE FROM transaction_tags').run();
    db.prepare('DELETE FROM tags').run();
    db.prepare('DELETE FROM transactions').run();

    const res = await request(app)
      .post('/api/transactions/batch').set(authA)
      .send({ records: exported.body.data });
    expect(res.body.imported).toBe(1);
    expect(res.body.skippedCount).toBe(0);

    const list = await request(app).get('/api/transactions').set(authA);
    expect(list.body.data[0].tags).toEqual(['备份标签']);
  });
});

describe('管理员删除用户时级联清理标签', () => {
  it('删除用户后其 tags 与 transaction_tags 无残留', async () => {
    // 现场注册一次性用户（不能删共用的 userB，后续用例还要用）
    const resC = await request(app).post('/api/auth/register').send({
      username: 'taguser_c', password: 'password123',
    });
    const authC = { Authorization: `Bearer ${resC.body.data.token}` };
    await add(tx({ tags: ['临时标签'] }), authC);

    const login = await request(app).post('/api/auth/login').send({
      username: 'admin', password: 'admin123',
    });
    const authAdmin = { Authorization: `Bearer ${login.body.data.token}` };

    const userC = db.prepare('SELECT id FROM users WHERE username = ?').get('taguser_c');
    const del = await request(app)
      .delete(`/api/auth/users/${userC.id}`).set(authAdmin);
    expect(del.body.success).toBe(true);

    const tagCount = db.prepare('SELECT COUNT(*) AS cnt FROM tags WHERE user_id = ?')
      .get(userC.id).cnt;
    const dangling = db.prepare(
      'SELECT COUNT(*) AS cnt FROM transaction_tags WHERE transaction_id NOT IN (SELECT id FROM transactions)'
    ).get().cnt;
    expect(tagCount).toBe(0);
    expect(dangling).toBe(0);
  });
});
