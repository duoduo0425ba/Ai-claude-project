// 测试里发请求的统一入口：每个测试文件只启动一个服务器，所有请求都走它。
//
// 不要直接用 supertest 的 request(app)：它每发一个请求都新开一个服务器、用完即关，
// 在本机（macOS + Node 25）上偶尔会把新连接送到刚关掉的旧服务器，表现为随机失败
// （带有效 Token 却返回 401、beforeEach 里的写入丢失等）。
//
// 用法：
//   const app = require('../app');
//   const api = require('./helpers/api')(app);
//   await api.get('/api/transactions').set(auth);
const http = require('http');
const supertest = require('supertest');

module.exports = function createApi(app) {
  const server = http.createServer(app);

  beforeAll(() => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  }));

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  // 交给 supertest 的是已经在监听的服务器，它就不会再自己开关服务器
  return supertest(server);
};
