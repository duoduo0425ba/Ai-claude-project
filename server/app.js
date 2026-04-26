const express = require('express');
const cors = require('cors');
const path = require('path');
const authMiddleware = require('./middleware/auth');
const authRouter = require('./routes/auth');
const transactionsRouter = require('./routes/transactions');
const categoriesRouter = require('./routes/categories');
const recurringRouter = require('./routes/recurring');
const budgetsRouter   = require('./routes/budgets');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 公开路由（无需 Token）
app.use('/api/auth', authRouter);

// 受保护路由（需要 Token）
app.use('/api/transactions', authMiddleware, transactionsRouter);
app.use('/api/categories', authMiddleware, categoriesRouter);
app.use('/api/recurring', authMiddleware, recurringRouter);
app.use('/api/budgets',   authMiddleware, budgetsRouter);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

module.exports = app;
