const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`🌸 零花钱记账服务已启动: http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
