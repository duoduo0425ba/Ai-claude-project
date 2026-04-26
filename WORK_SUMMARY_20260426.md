# 今日工作总结 2026-04-26

## 一、性能优化

### 1.1 后端分页（Server-side Pagination）
**文件：** `server/routes/transactions.js`

- `GET /api/transactions` 新增 `page` / `pageSize` 查询参数
- 查询前先执行 `SELECT COUNT(*)` 获取总数，响应始终包含 `total` 字段
- 有 `page` 参数时追加 `LIMIT … OFFSET …`，无参数则返回全量（兼容导出）
- 前端 `ListPage.jsx` 同步改造：
  - 移除客户端切片逻辑，直接使用服务端返回的 `data`
  - 新增 `total` 状态驱动分页 UI
  - 筛选条件变化时通过 `useRef` 对比自动重置第 1 页
  - 导出功能单独发无分页请求，保证导出完整数据
  - 增删改导入改用 `refreshKey` 触发刷新，`AbortController` 由 `useEffect` cleanup 管理

### 1.2 数据库索引
**文件：** `server/db.js`

```sql
CREATE INDEX IF NOT EXISTS idx_transactions_date_type
ON transactions (date, type);
```
加速月统计、年统计等按日期+类型聚合的查询。

---

## 二、安全与健壮性

### 2.1 Zod 输入验证
**文件：** `server/routes/transactions.js`

- 安装 `zod@4`
- 定义 `transactionSchema`：type 枚举校验、amount 正数强转、category 长度限制、date 正则校验
- `POST /api/transactions` 和 `PUT /api/transactions/:id` 均通过 `safeParse` 验证，失败返回明确中文错误信息

### 2.2 设置页数字输入 leading-zero 修复
**文件：** `client/src/pages/SettingsPage.jsx`

- 四个金额字段（月零花钱额度、预警阈值、危险阈值、初始结余）从 `type="number"` 改为 `type="text" inputMode="decimal"`
- `handleInputChange` 不再提前 `parseFloat`，直接存原始字符串；`handleSave` 时统一转换
- 根因：`type="number"` + 初始值为 `"0"` 时，浏览器会拒绝中间状态 `"0X"`，导致无法编辑

---

## 三、功能增强

### 3.1 周期性账单（Recurring Transactions）
**新文件：** `server/routes/recurring.js`  
**改动：** `server/db.js`、`server/app.js`、`client/src/api/index.js`、`client/src/pages/SettingsPage.jsx`、`client/src/pages/HomePage.jsx`

**数据库表：**
```sql
CREATE TABLE recurring_templates (
  id, type, amount, category, emoji, note,
  frequency (weekly/monthly),
  day_of_week (0=周一..6=周日),
  day_of_month (1-28),
  last_generated,
  is_active,
  created_at
)
```

**API 端点：**
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/recurring` | 获取所有模板 |
| POST | `/api/recurring` | 新增模板（Zod 校验） |
| DELETE | `/api/recurring/:id` | 删除模板 |
| POST | `/api/recurring/generate` | 检查并生成到期账单 |

**生成逻辑（幂等）：**
- 月账单：今天日期 = `day_of_month` 且本月尚未生成过
- 周账单：今天星期 = `day_of_week` 且今天尚未生成过

**前端：**
- 首页打开时自动调用 generate，有新记录时弹 toast 并刷新数据
- 设置页新增"周期账单"管理区块：展示模板列表、添加表单（支持每月/每周）、"立即检查生成"按钮

### 3.2 数据备份与恢复
**文件：** `client/src/pages/SettingsPage.jsx`

设置页新增"数据管理"区块：

- **📤 备份为 JSON**：并行拉取全量交易记录 + 设置，组装为带版本号和时间戳的 JSON 文件并下载
- **📥 从 JSON 恢复**：解析 JSON 文件，追加导入交易记录 + 覆盖设置，不删除现有数据

---

## 四、自动化测试

### 4.1 后端测试（Jest + Supertest）
**新文件：** `server/tests/transactions.test.js`  
**改动：** `server/db.js`（DB_PATH 可配置）、`server/app.js`（提取 Express app）、`server/package.json`

- 使用 `process.env.DB_PATH = ':memory:'` + in-memory SQLite，不污染真实数据库
- 将 `app.js`（Express 实例）与 `index.js`（HTTP 监听）分离，便于测试引入
- **12 个测试用例，全部通过：**
  - POST /api/transactions：成功创建、拒绝无效 type、拒绝负数金额、拒绝格式错误日期
  - GET /api/transactions：全量返回、第 1 页、第 3 页（边界分页）
  - GET /api/transactions/stats/daily：收支金额、结余计算、空日期返回 0
  - GET /api/transactions/stats/budget：safe / warn / danger 三种状态

### 4.2 前端测试（Vitest）
**新文件：** `client/src/utils/date.test.js`  
**改动：** `client/vite.config.js`（添加 test 配置）、`client/package.json`（添加 test 脚本）

- **4 个测试用例，全部通过：**
  - `formatLocalDate` 正确格式化给定日期
  - 月份和日期补零
  - 无参数时返回 YYYY-MM-DD 格式
  - 月末最后一天格式正确

---

## 五、验证结果

```
后端测试：12 passed (Jest)
前端测试：4 passed (Vitest)
前端 lint：✓ 0 errors
前端 build：✓ built in ~190ms
```

## 六、涉及文件清单（优化阶段）

| 文件 | 变更类型 |
|------|----------|
| `server/db.js` | 修改：加索引、加 recurring 表、DB_PATH 可配置 |
| `server/app.js` | 新建：提取 Express app 实例 |
| `server/index.js` | 修改：仅保留 HTTP 监听 |
| `server/routes/transactions.js` | 修改：后端分页 + Zod 校验 |
| `server/routes/recurring.js` | 新建：周期账单全套路由 |
| `server/tests/transactions.test.js` | 新建：12 个后端测试 |
| `server/package.json` | 修改：添加 jest/supertest，添加 test 脚本 |
| `client/src/api/index.js` | 修改：添加周期账单 API 函数 |
| `client/src/pages/ListPage.jsx` | 修改：切换为服务端分页 |
| `client/src/pages/HomePage.jsx` | 修改：启动时触发周期生成 |
| `client/src/pages/SettingsPage.jsx` | 修改：修复数字输入 + 周期账单 + 数据备份 UI |
| `client/src/utils/date.test.js` | 新建：4 个前端单元测试 |
| `client/vite.config.js` | 修改：添加 vitest 配置 |
| `client/package.json` | 修改：添加 vitest，添加 test 脚本 |

---

## 七、多用户管理功能

### 7.1 数据库升级与迁移
**文件：** `server/db.js`（重写）

新增 `users` 表：
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',  -- 'user' | 'admin'
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
)
```

**存量数据迁移策略（兼容升级）：**
- 首次启动自动创建 `admin` 账号（默认密码：`admin123`）
- `transactions`、`categories`、`recurring_templates` 三张表使用 `ALTER TABLE … ADD COLUMN user_id INTEGER DEFAULT adminId` 追加字段，存量数据自动归属 admin
- `settings` 表主键从 `key` 改为 `(user_id, key)`，通过创建新表 → 迁移数据 → 重命名实现（包裹在事务内）
- 分类唯一索引从 `(type, name)` 升级为 `(type, name, user_id)`，确保不同用户可有同名分类
- 新增 `seedDefaults(userId)` 函数（导出），注册新用户时为其初始化默认分类和设置

### 7.2 后端鉴权
**新文件：** `server/middleware/auth.js`、`server/routes/auth.js`  
**依赖：** `bcryptjs`、`jsonwebtoken`

**中间件（`auth.js`）：**
- 解析 `Authorization: Bearer <token>`，验证 JWT，将 `{ userId, username, role }` 挂载至 `req.user`
- Token 无效或缺失时返回 401

**认证路由（`/api/auth`，公开）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（Zod 校验、bcrypt 加密、自动初始化用户数据、返回 JWT） |
| POST | `/api/auth/login` | 登录（校验密码、返回 JWT，有效期 7 天） |
| POST | `/api/auth/change-password` | 修改密码（需登录，修改后需重新登录） |
| GET | `/api/auth/users` | 获取用户列表（仅 admin） |
| DELETE | `/api/auth/users/:id` | 删除用户及其全部数据（仅 admin，不可删自己和其他 admin） |

**业务路由（`/api/transactions`、`/api/categories`、`/api/recurring`）：**
- 统一在 `app.js` 层挂载 `authMiddleware`，无需各路由单独处理
- 所有 SELECT / INSERT / UPDATE / DELETE 均加 `AND user_id = req.user.userId`，严格数据隔离

### 7.3 前端改造
**文件：** `client/src/api/index.js`、`client/src/App.jsx`、`client/src/pages/SettingsPage.jsx`  
**新文件：** `client/src/pages/LoginPage.jsx`、`client/src/pages/RegisterPage.jsx`

**API 层：**
- 每次请求自动从 `localStorage` 读取 token，注入 `Authorization: Bearer <token>` Header
- 全局拦截 401 响应：清除 token，`window.location.replace('/login')` 强制跳转

**路由守卫（`AuthLayout`）：**
- 嵌套路由方案：`/login`、`/register` 公开；其余路由套在 `<AuthLayout>` 内
- `AuthLayout` 检查 `localStorage.token`，无 token 则 `<Navigate to="/login" replace />`
- 登录态下才渲染 `<Navbar>` 和 `<SakuraEffect>`

**登录 / 注册页：**
- 使用现有 CSS 设计系统（变量、卡片样式）
- 注册成功后自动登录（免二次跳转）
- 两页互相链接（"还没有账号？"/"已有账号？"）

**设置页新增内容：**
- **🔐 账号安全**：显示当前用户名和角色标识；修改密码（成功后自动退出）；退出登录
- **👥 用户管理**（仅 admin 可见）：列表展示所有用户（用户名、角色、注册时间）；删除普通用户（级联删除其所有数据）

### 7.4 测试更新
**文件：** `server/tests/transactions.test.js`

- `beforeAll` 中注册测试用户并获取 JWT
- 所有 API 请求统一携带 `Authorization` Header
- 新增"未登录时返回 401"断言
- 测试数量：12 → **13 个**，全部通过

### 7.5 验证结果

```
后端测试：13 passed (Jest)
前端 lint：✓ 0 errors
前端 build：✓ 50 modules transformed，built in ~190ms
```

## 八、涉及文件清单（多用户阶段）

| 文件 | 变更类型 |
|------|----------|
| `server/db.js` | 重写：users 表、存量迁移、seedDefaults 导出 |
| `server/middleware/auth.js` | 新建：JWT 验证中间件 |
| `server/routes/auth.js` | 新建：注册/登录/改密/用户管理路由 |
| `server/routes/transactions.js` | 重写：全部查询加 user_id 过滤 |
| `server/routes/categories.js` | 修改：全部查询加 user_id 过滤 |
| `server/routes/recurring.js` | 修改：全部查询加 user_id 过滤 |
| `server/app.js` | 修改：挂载 auth 路由，受保护路由加中间件 |
| `server/tests/transactions.test.js` | 修改：注册测试用户，全部请求带 auth header |
| `server/package.json` | 修改：添加 bcryptjs、jsonwebtoken |
| `client/src/api/index.js` | 重写：JWT 注入 + 401 跳转 + auth API |
| `client/src/App.jsx` | 修改：AuthLayout 路由守卫 + 公开路由 |
| `client/src/pages/LoginPage.jsx` | 新建：登录页 |
| `client/src/pages/RegisterPage.jsx` | 新建：注册页 |
| `client/src/pages/SettingsPage.jsx` | 修改：账号安全 + 用户管理面板 |

---

## 九、后续优化（FUTURE_IMPROVEMENTS.md 前三项）

### 9.1 ErrorBoundary 全局错误兜底
**新文件：** `client/src/components/ErrorBoundary.jsx`  
**改动：** `client/src/main.jsx`

- React class component，实现 `getDerivedStateFromError` + 友好回退页（含刷新按钮）
- `main.jsx` 用 `<ErrorBoundary>` 包裹 `<App>`，所有组件渲染异常均被捕获，不再白屏

### 9.2 数据库迁移机制
**新文件：** `server/migrate.js`、`server/migrations/001_initial_schema.js`  
**改动：** `server/db.js`

- `schema_migrations` 表记录已执行版本，启动时按序执行 `migrations/` 目录下 `NNN_*.js` 文件
- `db.js` 精简至 ~10 行，仅负责连接数据库并调用 `runMigrations`
- 首个迁移文件包含所有原有建表语句、admin 用户创建、存量数据 user_id 追加、settings 表主键重建、索引创建、`seedDefaults` 函数

### 9.3 主题手动切换
**改动：** `client/src/pages/SettingsPage.jsx`、`client/src/index.css`、`client/src/main.jsx`

- 设置页"外观"区块新增主题选择：跟随系统 / 浅色 / 深色，写入 `localStorage`
- `index.css` 新增 `html[data-theme="dark"]` 选择器（与 `@media prefers-color-scheme: dark` 内 `html:not([data-theme="light"])` 并列），覆盖全部深色变量
- `main.jsx` 在 React 渲染前读取 `localStorage.theme` 并设置 `data-theme` attribute，避免首屏主题闪烁

---

## 十、Bug 修复

### 10.1 自动登录问题（localStorage → sessionStorage）
**改动：** `client/src/App.jsx`、`client/src/api/index.js`、`client/src/pages/LoginPage.jsx`、`client/src/pages/RegisterPage.jsx`、`client/src/pages/SettingsPage.jsx`

- **根因**：JWT Token 存于 `localStorage`，浏览器重启后依然保留，`AuthLayout` 检测到 token 直接跳过登录页
- **修复**：将所有与 token 相关的 9 处 `localStorage` 调用改为 `sessionStorage`；关闭标签页或浏览器时 session 自动清除，重启必须重新登录
- 主题设置（`theme`）保留 `localStorage`，不受影响

---

## 十一、交互优化

### 11.1 周期账单分类改为下拉选择
**改动：** `client/src/pages/SettingsPage.jsx`

- 周期账单添加表单中"表情"和"分类名称"两个手动文本框替换为单个下拉选择器
- 选择器通过 `getCategories(type)` 动态加载当前类型（支出/收入）的分类列表
- 切换收入/支出类型时自动重新加载分类并清空已选项
- 选中分类后自动联动填入对应 emoji，存入账单时保持一致

---

## 十二、分类级预算功能
**新文件：** `server/migrations/002_category_budgets.js`、`server/routes/budgets.js`  
**改动：** `server/app.js`、`client/src/api/index.js`、`client/src/components/BudgetAlert.jsx`、`client/src/pages/SettingsPage.jsx`

### 数据库
```sql
CREATE TABLE category_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  UNIQUE(user_id, category)
)
```

### API 端点（`/api/budgets`，需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/budgets` | 获取当前用户所有分类预算 |
| GET | `/api/budgets/status?year=&month=` | 各分类本月实际支出 vs 预算（含 safe/warn/danger） |
| PUT | `/api/budgets/:category` | 新增或更新分类预算（upsert） |
| DELETE | `/api/budgets/:category` | 清除分类预算 |

**状态判断：** 进度 < 80% → safe，80–100% → warn，≥ 100% → danger（显示超支金额）

### 前端展示（BudgetAlert）
- 同时加载全局预算 + 分类预算状态（`Promise.all` 并发）
- 全局进度条下方折叠展示各分类细项进度条（emoji + 分类名 + 金额 + 进度条 + 超支提示）
- 未设置任何分类预算时不显示分类区块

### 设置页管理（SettingsPage）
- 新增"🎯 分类预算"区块，列出全部支出分类
- 每行显示 `{emoji} {分类名} [金额输入框] [保存] [清除]`
- 支持按 Enter 快速保存；清除按钮仅在该分类有预算时显示

### 验证结果
```
后端启动检查：✅ 002_category_budgets.js 迁移成功执行
前端构建：✓ 51 modules transformed，built in ~190ms，0 errors
```

## 十三、涉及文件清单（后续优化阶段）

| 文件 | 变更类型 |
|------|----------|
| `server/migrate.js` | 新建：迁移运行器 |
| `server/migrations/001_initial_schema.js` | 新建：初始 schema + seedDefaults |
| `server/migrations/002_category_budgets.js` | 新建：分类预算表迁移 |
| `server/routes/budgets.js` | 新建：分类预算 CRUD + 状态查询 |
| `server/db.js` | 重写：精简为连接 + 运行迁移 |
| `server/app.js` | 修改：注册 budgets 路由 |
| `client/src/components/ErrorBoundary.jsx` | 新建：全局错误边界 |
| `client/src/components/BudgetAlert.jsx` | 修改：扩展分类预算进度条 |
| `client/src/api/index.js` | 修改：token 改 sessionStorage；新增分类预算 API |
| `client/src/main.jsx` | 修改：主题初始化 + ErrorBoundary 包裹 |
| `client/src/index.css` | 修改：新增 data-theme 深色模式选择器 |
| `client/src/App.jsx` | 修改：token 改 sessionStorage |
| `client/src/pages/LoginPage.jsx` | 修改：token 改 sessionStorage |
| `client/src/pages/RegisterPage.jsx` | 修改：token 改 sessionStorage |
| `client/src/pages/SettingsPage.jsx` | 修改：主题切换 + 周期账单下拉 + 分类预算管理 + token 改 sessionStorage |
