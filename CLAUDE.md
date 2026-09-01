# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**零花钱记账** — React 19 + Express 5 + SQLite 个人记账应用，支持多用户 JWT 鉴权、自定义分类、交易标签、周期账单、分类级预算和深色模式。

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
| ↳ `GET /` 查询参数 | | `startDate`、`endDate`、`category`、`type`、`keyword`、`tag`、`page`、`pageSize`、`sort`、`order` |
| `routes/categories.js` | `/api/categories` | 受保护 — 列表、添加、删除（`is_default=1` 的默认分类不可删除） |
| `routes/recurring.js` | `/api/recurring` | 受保护 — 周期模板 CRUD + `/generate`（幂等，首页加载时调用） |
| `routes/budgets.js` | `/api/budgets` | 受保护 — 分类月度预算 CRUD + `/status` |
| `routes/tags.js` | `/api/tags` | 受保护 — 仅 GET，返回 `[{name, count}]` 按使用次数降序；标签本身随交易保存自动创建，无独立管理接口 |

**所有查询均按 `req.user.userId` 过滤**——数据完全按用户隔离。

**Zod v4 校验**用于交易的 POST/PUT/batch，共用同一个 `transactionSchema`。注意：Zod v4 使用 `.issues` 而非 `.errors`。

**`POST /batch` 逐条校验、逐条跳过**，不因单行脏数据整批失败——批量导入的数据来自 Excel 和用户可手改的备份 JSON，整批拒绝体验太差。响应带 `imported`、`skippedCount` 和 `skipped` 明细（`{row, field, error}`，最多 20 条），前端据此提示。Zod 会自动剥掉备份文件里多余的 `id`/`created_at`/`user_id`。

**统计接口一律「一条 `GROUP BY` + JS 补零」**，不要退回按天/按月循环查询。先用循环排出完整的日期（或月份）骨架，再把 `GROUP BY` 的结果填进去——没有记录的日子不会出现在 SQL 结果里，靠骨架补 `0`。月度/年度总计仍单独走一条 SQL，避免按天累加 `REAL` 引入浮点尾差。

**排序（`GET /api/transactions`）：** `sort=amount` 按金额排，其余值一律回退到按日期；`order=asc` 升序，其余回退降序。列名和方向都走白名单后再拼进 `ORDER BY`，绝不能直接插用户输入。不传参数时与历史行为完全一致（`date DESC, created_at DESC`）。

**交易标签走规范化两表**（`tags` + `transaction_tags`，`003_tags.js`），不要改成 JSON 列或逗号分隔文本。要点：

- **全库无外键**——项目从未开启 `PRAGMA foreign_keys`，写 `ON DELETE CASCADE` 也不生效。删除交易、管理员删用户时都要显式清 `transaction_tags`（见 transactions.js 的 DELETE 和 auth.js 的级联事务）
- 保存交易时自动 upsert 标签（`INSERT OR IGNORE` + 回查 id）；孤儿标签**不回收**，`GET /api/tags` 里以 `count: 0` 出现，兼作输入历史
- **PUT 是全量替换标签集，不传 `tags` 即清空**（Zod `default([])`）——所有 PUT 调用方必须带上 `tags`
- **`?tag=` 筛选条件必须在 COUNT 查询之前拼进 `where`**，否则 `total` 与 `data` 不同步；列表行的 `tags` 数组由 `attachTags` 一条 IN 查询批量挂载，不要退回 N+1
- 校验：单个标签 trim 后 1–20 字，每笔最多 10 个（按去重前的原始数组计数），schema 自动去重
- `/batch` 接受 `tags` 字段，因此 JSON 备份→恢复自动保留标签；Excel 导入导出**不含**标签（待做）

**响应格式：** `{ success: true, data: ... }` / `{ success: false, error: "..." }`

### 前端（`client/src/`）— React 19 + Vite + React Router v7

**页面：**
- `/` **HomePage** — 记账入口、日汇总、余额、BudgetAlert（全局 + 分类预算）
- `/list` **ListPage** — 服务端分页历史记录，支持搜索/筛选/排序/编辑/删除
- `/report` **ReportPage** — Chart.js 图表（周/月/年）、分类明细
- `/settings` **SettingsPage** — 预算配置、分类预算、分类管理、周期账单、数据备份/恢复、主题、账号安全、管理员用户面板

**关键模式：**
- `refreshKey` 状态模式 — 自增触发 `useEffect` 重新拉取数据
- `useEffect` cleanup 中的 `AbortController` — 防止快速切换筛选条件时的竞态问题
- 服务端分页 — `GET /api/transactions?page=N&pageSize=30` 返回 `{ data, total }`
- **排序必须走服务端。** 列表是分页的，前端只持有当前 30 条；对 `transactions` 数组本地排序得到的是「这一页里最大的」而非「全部记录里最大的」——看着能用，结果是错的。ListPage 的金额排序把 `sort`/`order` 传给后端，三态循环：`null`（按日期）→ `'desc'` → `'asc'` → `null`
- 按金额排序时**关闭日期分组**，改用 `.sorted-list` 平铺、每条上方标注日期。否则金额顺序会打乱日期，分组头出现「08-03 / 08-01 / 08-03」这类反复跳动
- 排序或筛选条件变更时通过 `prevFilters` ref 重置到第 1 页（新条件下停留在第 N 页没有意义）
- 主题：在 `main.jsx` 中 React 渲染前读取 `localStorage.getItem('theme')` 并设置 `data-theme` attribute，避免首屏闪烁。深色模式选择器：`html[data-theme="dark"]` 和 `@media (prefers-color-scheme: dark)` 内的 `html:not([data-theme="light"])`
- 周期账单在首页加载时自动调用 `generateRecurring()`——该接口幂等（跳过已生成的条目）
- 标签选择用 `TagPicker` 组件（多选 chip + 自由输入）。**添加表单和编辑表单是两个不 DRY 的近似副本**（`TransactionForm` / `EditTransactionForm`），标签相关改动必须同步两处；**编辑表单的 payload 必须带 `tags`**——PUT 是全量替换，漏传会在每次编辑时清空该笔交易的标签
- ListPage 的标签筛选 state 是**单字符串**（`''` = 不筛选，存 localStorage `listPageTag`）——`prevFilters` 用恒等比较，换成数组会每次渲染都误判变更、把页码重置回第 1 页
- `TransactionCard` 渲染标签必须用可选链（`tags?.length`）：stats 接口返回的记录不带 `tags`，而该组件是共用的

**样式：** `index.css` 中的 CSS 自定义属性，无 CSS-in-JS，所有主题通过 `var(--token-name)` 实现。

**数字输入框：** 使用 `type="text" inputMode="decimal"`（而非 `type="number"`），避免浏览器拒绝 `"01"` 等中间状态。

### 文件结构

```
server/
├── migrations/        # 001_initial_schema.js、002_category_budgets.js、…
├── middleware/auth.js  # JWT 验证
├── routes/            # auth、transactions、categories、recurring、budgets、tags
├── tests/             # Jest + Supertest（使用 DB_PATH=':memory:'）
├── app.js             # Express app（供测试引入）
├── index.js           # 仅 HTTP 监听
├── migrate.js         # 迁移运行器
└── db.js              # DB 连接 + 调用 runMigrations

client/src/
├── api/index.js       # 所有 API 调用、Token 注入、401 处理
├── pages/             # 4 个路由页面 + LoginPage、RegisterPage
├── components/        # BudgetAlert、CategoryPicker、TagPicker、ErrorBoundary 等
├── hooks/             # useToast、useLocalStorage
├── utils/             # date.js、Excel 导入导出、date.test.js
└── index.css          # 设计 token + 深色模式
```

## 测试说明

后端测试在 `require('app.js')` **之前**设置 `process.env.DB_PATH = ':memory:'`。`beforeAll` 中注册测试用户，所有请求携带 `Authorization` Header。

新增迁移不需要额外测试配置——迁移在内存 DB 上自动执行。

## macOS 打包

`bash build_app.sh` — 将 AppleScript 启动器编译为 `.app` bundle，启动 Express 服务并自动打开浏览器。
