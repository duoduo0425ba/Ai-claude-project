const express = require('express');
const cors = require('cors');
const path = require('path');
const authMiddleware = require('./middleware/auth');
const authRouter = require('./routes/auth');
const transactionsRouter = require('./routes/transactions');
const categoriesRouter = require('./routes/categories');
const recurringRouter = require('./routes/recurring');
const budgetsRouter   = require('./routes/budgets');
const tagsRouter      = require('./routes/tags');
const serverError = require('./utils/serverError');

const app = express();

// 查询参数一律解析成字符串，同名参数重复出现时只取第一个。
// 默认解析器会把 ?type=a&type=b 解析成数组，绑定进 SQL 时直接报错
app.set('query parser', (str) => {
  const query = {};
  for (const [key, value] of new URLSearchParams(str)) {
    if (!Object.hasOwn(query, key)) query[key] = value;
  }
  return query;
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 公开路由（无需 Token）
app.use('/api/auth', authRouter);

// 受保护路由（需要 Token）
app.use('/api/transactions', authMiddleware, transactionsRouter);
app.use('/api/categories', authMiddleware, categoriesRouter);
app.use('/api/recurring', authMiddleware, recurringRouter);
app.use('/api/budgets',   authMiddleware, budgetsRouter);
app.use('/api/tags',      authMiddleware, tagsRouter);

if (process.env.NODE_ENV === 'production') {
  // 前端构建产物目录；测试用 CLIENT_DIST 指向一个临时目录，不依赖是否已构建
  const distDir = path.resolve(__dirname, process.env.CLIENT_DIST || '../client/dist');
  app.use(express.static(distDir));
  // 其余 GET 请求都返回 index.html，交给前端路由处理（直接打开或刷新 /list、/report 也能进页面）。
  // Express 5 不再接受 '*'，通配符必须命名：'/{*splat}' 连根路径一起匹配
  app.get('/{*splat}', (req, res, next) => {
    // 不存在的接口照常 404，不能把网页当成接口响应返回
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// 兜底错误处理（必须放在所有路由之后）：路由里没捕获的异常、请求体不是合法 JSON 等都走这里，
// 保证始终返回 JSON，也不把内部错误详情暴露给前端
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.status >= 400 && err.status < 500) {
    const error = err.type === 'entity.too.large' ? '请求数据过大' : '请求格式错误';
    return res.status(err.status).json({ success: false, error });
  }
  serverError(res, err);
});

module.exports = app;
