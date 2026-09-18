// 生产模式（NODE_ENV=production）下 app.js 额外挂载前端静态文件和 SPA 回退路由。
// Express 5 不再接受 app.get('*')，曾让生产模式一加载就崩溃，这里锁定修复后的行为。
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'production';

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

// 用临时目录冒充前端构建产物，测试不依赖 client/dist 是否已构建
const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-money-dist-'));
fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>零花钱记账</title>');
process.env.CLIENT_DIST = distDir;

let app;

afterAll(() => {
  require('../db').close();
  fs.rmSync(distDir, { recursive: true, force: true });
});

// 后面的用例都用这里加载的 app，所以这个用例必须放在第一个
it('生产模式下加载 app 不报错', () => {
  expect(() => { app = require('../app'); }).not.toThrow();
});

describe('前端页面路径返回 index.html', () => {
  it.each(['/', '/list', '/report', '/settings'])('GET %s', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('零花钱记账');
  });
});

describe('接口路径不受回退路由影响', () => {
  it('已有接口照常工作，返回 JSON', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: '未登录，请先登录' });
  });

  it('不存在的接口返回 404，而不是 index.html', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('零花钱记账');
  });
});
