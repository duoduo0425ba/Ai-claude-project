process.env.DB_PATH = ':memory:';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { resetRateLimits } = require('../middleware/rateLimit');

// 注册一个新用户，返回其 id 和带 Token 的请求头
async function signup(username, password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ username, password });
  const { id } = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return { id, auth: { Authorization: `Bearer ${res.body.data.token}` } };
}

const login = (username, password) =>
  request(app).post('/api/auth/login').send({ username, password });

// 每个用例结束都恢复 mock、清空限流计数。
// 测试里所有请求都来自同一个 IP，不清零的话一个用例触发的限流会拦住后面的用例
afterEach(() => {
  jest.restoreAllMocks();
  resetRateLimits();
});

afterAll(() => {
  db.close();
});

// ─── 鉴权以数据库为准 ─────────────────────────────────────────────────────────

describe('账号状态以数据库为准，不只信 Token 载荷', () => {
  it('用户被删除后，未过期的旧 Token 立即失效', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'ghostuser', password: 'password123',
    });
    const ghostAuth = { Authorization: `Bearer ${reg.body.data.token}` };

    const before = await request(app).get('/api/transactions').set(ghostAuth);
    expect(before.status).toBe(200);

    db.prepare("DELETE FROM users WHERE username = 'ghostuser'").run();

    const after = await request(app).get('/api/transactions').set(ghostAuth);
    expect(after.status).toBe(401);
  });

  it('管理员被降级后，旧 Token 里的 admin 角色不再生效', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'exadmin', password: 'password123',
    });
    db.prepare("UPDATE users SET role = 'admin' WHERE username = 'exadmin'").run();

    // 此刻登录，Token 载荷里 role = admin
    const login = await request(app).post('/api/auth/login').send({
      username: 'exadmin', password: 'password123',
    });
    const exAuth = { Authorization: `Bearer ${login.body.data.token}` };
    expect((await request(app).get('/api/auth/users').set(exAuth)).status).toBe(200);

    db.prepare("UPDATE users SET role = 'user' WHERE username = 'exadmin'").run();

    // 同一个 Token，权限应立即以数据库为准被收回
    const res = await request(app).get('/api/auth/users').set(exAuth);
    expect(res.status).toBe(403);
  });

  it('管理员被降级后，旧 Token 不能再删除用户', async () => {
    for (const username of ['exadmin2', 'victim']) {
      await request(app).post('/api/auth/register').send({ username, password: 'password123' });
    }
    db.prepare("UPDATE users SET role = 'admin' WHERE username = 'exadmin2'").run();
    const login = await request(app).post('/api/auth/login').send({
      username: 'exadmin2', password: 'password123',
    });
    const exAuth = { Authorization: `Bearer ${login.body.data.token}` };
    db.prepare("UPDATE users SET role = 'user' WHERE username = 'exadmin2'").run();

    // 删用户是最危险的管理员操作，且每个路由各自检查 role，必须单独确认
    const victim = db.prepare("SELECT id FROM users WHERE username = 'victim'").get();
    const res = await request(app).delete(`/api/auth/users/${victim.id}`).set(exAuth);
    expect(res.status).toBe(403);
    expect(db.prepare("SELECT id FROM users WHERE username = 'victim'").get()).toBeDefined();
  });

  it('用户被删除后，旧 Token 也不能再改密码', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'ghostuser2', password: 'password123',
    });
    const ghostAuth = { Authorization: `Bearer ${reg.body.data.token}` };
    db.prepare("DELETE FROM users WHERE username = 'ghostuser2'").run();

    // change-password 在 auth.js 里单独挂的中间件，要单独确认它也被拦下
    const res = await request(app).post('/api/auth/change-password').set(ghostAuth)
      .send({ oldPassword: 'password123', newPassword: 'newpass123' });
    expect(res.status).toBe(401);
  });

  it('查库出错时返回 JSON 格式的 500，而不是 HTML 错误页', async () => {
    // 正常签发的 Token 里 userId 一定是数字。这里故意签一个对象，
    // 让 better-sqlite3 绑定参数时抛错，从而走到中间件的 catch 分支
    const badToken = jwt.sign({ userId: {} }, JWT_SECRET);
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/transactions')
      .set({ Authorization: `Bearer ${badToken}` });
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ success: false, error: '服务器错误' });
    // 详细错误只写进服务端日志
    // 不能用 expect.any(RangeError)：原生模块抛出的错误来自 Jest 沙箱之外，instanceof 判断不成立
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ name: 'RangeError' }));
  });

  it('改密码后旧 Token 立即失效，重新登录拿到的新 Token 可用', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'pwchanger', password: 'password123',
    });
    const oldAuth = { Authorization: `Bearer ${reg.body.data.token}` };
    expect((await request(app).get('/api/transactions').set(oldAuth)).status).toBe(200);

    const change = await request(app).post('/api/auth/change-password').set(oldAuth)
      .send({ oldPassword: 'password123', newPassword: 'newpass456' });
    expect(change.body.success).toBe(true);

    // 场景：Token 被盗，受害者改密后攻击者手里的旧 Token 必须马上作废
    expect((await request(app).get('/api/transactions').set(oldAuth)).status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({
      username: 'pwchanger', password: 'newpass456',
    });
    const newAuth = { Authorization: `Bearer ${login.body.data.token}` };
    expect((await request(app).get('/api/transactions').set(newAuth)).status).toBe(200);
  });

  it('不带版本号的旧格式 Token 一律拒绝', async () => {
    const { id } = await signup('legacyuser');
    // 引入 token_version 之前签发的 Token 就是这个形状：没有 tokenVersion 字段
    const legacy = jwt.sign({ userId: id, username: 'legacyuser', role: 'user' }, JWT_SECRET);
    const res = await request(app).get('/api/transactions')
      .set({ Authorization: `Bearer ${legacy}` });
    expect(res.status).toBe(401);
  });
});

// ─── JWT 算法白名单 ───────────────────────────────────────────────────────────

describe('JWT 只接受 HS256 签名', () => {
  let userId;
  beforeAll(async () => {
    ({ id: userId } = await signup('algouser'));
  });

  const call = (token) => request(app).get('/api/transactions')
    .set({ Authorization: `Bearer ${token}` });

  it('同一密钥、HS256 签名的 Token 可以通过（对照组）', async () => {
    const token = jwt.sign({ userId, tokenVersion: 0 }, JWT_SECRET);
    expect((await call(token)).status).toBe(200);
  });

  it('密钥和载荷都一样，只是改用 HS384 签名，Token 被拒绝', async () => {
    const token = jwt.sign({ userId, tokenVersion: 0 }, JWT_SECRET, { algorithm: 'HS384' });
    expect((await call(token)).status).toBe(401);
  });
});

// ─── 失败次数限流 ─────────────────────────────────────────────────────────────

describe('登录、注册、改密的失败次数限流', () => {
  it('失败满 10 次后锁定，正确密码也进不去；中间的成功登录不计数也不清零', async () => {
    await signup('lockme');
    // 密码不足 6 位会在格式校验阶段失败，比真去比对错误密码快（跳过 bcrypt）
    for (let i = 0; i < 9; i++) {
      expect((await login('lockme', 'short')).status).toBe(400);
    }
    expect((await login('lockme', 'password123')).status).toBe(200);
    expect((await login('lockme', 'password123')).status).toBe(200);
    expect((await login('lockme', 'short')).status).toBe(400); // 第 10 次失败

    const res = await login('lockme', 'password123');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, error: '尝试次数过多，请 15 分钟后再试' });
    const retryAfter = Number(res.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(900);
  });

  it('锁定只针对被爆破的用户名，其他账号照常登录', async () => {
    await signup('bystander');
    for (let i = 0; i < 10; i++) {
      expect((await login('no_such_user', 'wrong-password')).status).toBe(401);
    }
    expect((await login('no_such_user', 'wrong-password')).status).toBe(429);
    expect((await login('bystander', 'password123')).status).toBe(200);
  });

  it('15 分钟窗口过后自动解锁', async () => {
    for (let i = 0; i < 10; i++) await login('no_such_user', 'wrong-password');
    expect((await login('no_such_user', 'wrong-password')).status).toBe(429);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 15 * 60 * 1000 + 1);
    expect((await login('no_such_user', 'wrong-password')).status).toBe(401);
  });

  it('注册失败按 IP 计数，防止换着用户名批量探测', async () => {
    await signup('taken_name');
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/auth/register')
        .send({ username: 'taken_name', password: 'password123' });
      expect(res.status).toBe(400);
    }
    // 换一个从没用过的用户名，同一个 IP 照样被拦下
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'fresh_name', password: 'password123' });
    expect(res.status).toBe(429);
    expect(db.prepare("SELECT id FROM users WHERE username = 'fresh_name'").get()).toBeUndefined();
  });

  it('改密码失败满 10 次后锁定', async () => {
    const { auth } = await signup('pwguesser');
    const changePassword = (body) =>
      request(app).post('/api/auth/change-password').set(auth).send(body);
    // 新密码太短会在比对旧密码之前就失败，同样计入失败次数
    for (let i = 0; i < 10; i++) {
      const res = await changePassword({ oldPassword: 'password123', newPassword: '123' });
      expect(res.status).toBe(400);
    }
    const res = await changePassword({ oldPassword: 'password123', newPassword: 'newpass123' });
    expect(res.status).toBe(429);
  });
});
