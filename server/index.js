const express = require('express');
const cors = require('cors');
const path = require('path');
const transactionsRouter = require('./routes/transactions');

const app = express();
const PORT = process.env.PORT || 5001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API 路由
app.use('/api/transactions', transactionsRouter);
app.use('/api/settings', (req, res, next) => {
  // settings 路由复用 transactions 文件中的 settings 部分
  // 由于 settings 路由在 transactions.js 中已处理，这里直接代理
  next();
});

// 生产环境：服务前端静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const http = require('http');
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`🌸 零花钱记账服务已启动: http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
