# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**零花钱记账** — React 19 + Express 5 + SQLite 个人记账应用，支持多用户 JWT 鉴权、自定义分类、周期账单、分类级预算和深色模式。

## 常用命令

```bash
# 根目录 — 同时启动服务端（5001）和客户端（5173）
npm run dev
npm run build          # 仅构建前端（生产模式）

# 后端测试（Jest + Supertest，内存 SQLite）
cd server && npm test
cd server && npm test -- --testPathPatterns=tests/transactions

# 前端测试（Vitest）
cd client && npm test

# 前端代码检查
cd client && npm run lint
```

## 架构

### 鉴权流程

- 所有受保护路由需要 `Authorization: Bearer <token>`（JWT，7 天有效期）
- Token 存储在 **`sessionStorage`**（关闭浏览器自动清除——有意为之）
- `server/middleware/auth.js` 验证 Token，将 `{ userId, username, role }` 挂载到 `req.user`
- `client/src/api/index.js` 自动注入 Token；401 响应时清除 Token 并跳转到 `/login`
- `client/src/App.jsx` — `AuthLayout` 包裹所有路由，`/login` 和 `/register` 除外

### 数据库迁移机制

- `server/migrate.js` 在每次启动时运行，按序执行 `server/migrations/NNN_*.js`
- 已执行版本记录在 `schema_migrations` 表中
- 添加 Schema 变更：新建 `server/migrations/003_*.js`，导出 `up(db)` 函数
- `db.js` 仅负责打开连接并调用 `runMigrations`
- `seedDefaults(db, userId)`（从 `001_initial_schema.js` 导出）为新用户初始化默认设置和分类，在注册时调用

### 后端（`server/`）— Express 5 + SQLite（better-sqlite3）

**路由：**

| 路由文件 | 挂载路径 | 说明 |
|--------|-------|-------|
| `routes/auth.js` | `/api/auth` | 公开 — 注册、登录、改密、管理员用户 CRUD |
| `routes/transactions.js` | `/api/transactions` | 受保护 — 交易 CRUD + 统计（日/周/月/年/预算/余额）+ 设置 |
| `routes/categories.js` | `/api/categories` | 受保护 — 列表、添加、删除（`is_default=1` 的默认分类不可删除） |
| `routes/recurring.js` | `/api/recurring` | 受保护 — 周期模板 CRUD + `/generate`（幂等，首页加载时调用） |
| `routes/budgets.js` | `/api/budgets` | 受保护 — 分类月度预算 CRUD + `/status` |

**所有查询均按 `req.user.userId` 过滤**——数据完全按用户隔离。

**Zod v4 校验**用于交易的 POST/PUT。注意：Zod v4 使用 `.issues` 而非 `.errors`。

**响应格式：** `{ success: true, data: ... }` / `{ success: false, error: "..." }`

### 前端（`client/src/`）— React 19 + Vite + React Router v7

**页面：**
- `/` **HomePage** — 记账入口、日汇总、余额、BudgetAlert（全局 + 分类预算）
- `/list` **ListPage** — 服务端分页历史记录，支持搜索/筛选/编辑/删除
- `/report` **ReportPage** — Chart.js 图表（周/月/年）、分类明细
- `/settings` **SettingsPage** — 预算配置、分类预算、分类管理、周期账单、数据备份/恢复、主题、账号安全、管理员用户面板

**关键模式：**
- `refreshKey` 状态模式 — 自增触发 `useEffect` 重新拉取数据
- `useEffect` cleanup 中的 `AbortController` — 防止快速切换筛选条件时的竞态问题
- 服务端分页 — `GET /api/transactions?page=N&pageSize=30` 返回 `{ data, total }`
- 主题：在 `main.jsx` 中 React 渲染前读取 `localStorage.getItem('theme')` 并设置 `data-theme` attribute，避免首屏闪烁。深色模式选择器：`html[data-theme="dark"]` 和 `@media (prefers-color-scheme: dark)` 内的 `html:not([data-theme="light"])`
- 周期账单在首页加载时自动调用 `generateRecurring()`——该接口幂等（跳过已生成的条目）

**样式：** `index.css` 中的 CSS 自定义属性，无 CSS-in-JS，所有主题通过 `var(--token-name)` 实现。

**数字输入框：** 使用 `type="text" inputMode="decimal"`（而非 `type="number"`），避免浏览器拒绝 `"01"` 等中间状态。

### 文件结构

```
server/
├── migrations/        # 001_initial_schema.js、002_category_budgets.js、…
├── middleware/auth.js  # JWT 验证
├── routes/            # auth、transactions、categories、recurring、budgets
├── tests/             # Jest + Supertest（使用 DB_PATH=':memory:'）
├── app.js             # Express app（供测试引入）
├── index.js           # 仅 HTTP 监听
├── migrate.js         # 迁移运行器
└── db.js              # DB 连接 + 调用 runMigrations

client/src/
├── api/index.js       # 所有 API 调用、Token 注入、401 处理
├── pages/             # 4 个路由页面 + LoginPage、RegisterPage
├── components/        # BudgetAlert、CategoryPicker、ErrorBoundary 等
├── hooks/             # useToast、useLocalStorage
├── utils/             # date.js、Excel 导入导出、date.test.js
└── index.css          # 设计 token + 深色模式
```

## 测试说明

后端测试在 `require('app.js')` **之前**设置 `process.env.DB_PATH = ':memory:'`。`beforeAll` 中注册测试用户，所有请求携带 `Authorization` Header。

新增迁移不需要额外测试配置——迁移在内存 DB 上自动执行。

## macOS 打包

`bash build_app.sh` — 将 AppleScript 启动器编译为 `.app` bundle，启动 Express 服务并自动打开浏览器。
