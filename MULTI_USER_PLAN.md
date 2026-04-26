# 多用户管理改造方案 (Multi-User Management Plan)

为了给“零花钱记账”应用添加多用户管理功能（注册、登录、修改密码、数据隔离、用户管理），需要从数据库、后端接口到前端路由进行全面的改造。以下是详细的实施方案。

## 1. 数据库升级 (`server/db.js`)

核心目标：引入 `users` 表，并对现有的业务表（交易、分类、设置）添加 `user_id` 以实现数据隔离。

### 1.1 新增 users 表
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user', -- 'user' (普通用户) 或 'admin' (管理员)
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

### 1.2 改造现有表
对于已经存在的 `transactions`、`categories` 和 `settings` 表，需要增加 `user_id` 字段。
*   **兼容旧数据**: 可以在升级脚本中，先创建一个默认的 admin 用户，然后将所有现有数据的 `user_id` 关联到该 admin 用户，以保证老用户数据不丢失。
*   **联合索引**: 需要为 `user_id` 与其他查询条件（如 `date`, `category`）建立联合索引，提升每个用户自身数据的查询效率。

## 2. 后端鉴权 (Node.js + Express)

依赖项: `bcryptjs` (密码加密), `jsonwebtoken` (JWT 生成与验证)

### 2.1 鉴权中间件 (`server/middleware/auth.js`)
解析请求头中的 `Authorization: Bearer <token>`，验证 JWT，提取 `user_id` 并挂载到 `req.user` 上。如果 Token 无效或过期，返回 401 状态码。

### 2.2 认证路由 (`server/routes/auth.js`)
*   **`POST /api/auth/register`**: 接收账号密码，使用 bcryptjs 加密后存入 `users` 表，同时为新用户初始化默认的设置和分类。
*   **`POST /api/auth/login`**: 校验账号密码，成功则下发 JWT (设置合理的过期时间，如 7 天)。
*   **`POST /api/auth/change-password`**: 验证旧密码，更新新密码（需经过 auth 中间件）。
*   **`GET /api/auth/users`**: 仅限管理员 (`role === 'admin'`) 访问，列出系统内所有用户，用于用户管理功能。

### 2.3 业务路由改造
必须修改 `server/routes/transactions.js` 和 `server/routes/categories.js`。所有的 `SELECT`, `INSERT`, `UPDATE`, `DELETE` 语句，都**必须**增加 `WHERE user_id = ?` 条件，其值为 `req.user.id`，坚决防止越权访问。

## 3. 前端改造 (React)

### 3.1 API 拦截器 (`client/src/api/index.js`)
*   在每次 `fetch` 请求的 Headers 中自动注入 `Authorization` (从 `localStorage` 获取 token)。
*   全局拦截 401 响应状态码，一旦触发则清除本地 token，并强制重定向到 `/login` 页面。

### 3.2 路由保护 (`client/src/App.jsx`)
*   引入 `<PrivateRoute>` 路由守卫组件。未登录状态下访问业务页面会重定向到登录页。
*   新增 `/login` 和 `/register` 页面，这两个页面不需要守卫。
*   全局组件（如 `Navbar`, `SakuraEffect`）应只在用户登录后才渲染。

### 3.3 页面与功能新增
*   **登录/注册页**: 实现美观的表单，包含用户名、密码验证，以及接口请求失败时的 Toast 提示。
*   **设置页扩充 (`SettingsPage.jsx`)**:
    *   增加“修改密码”弹窗/区域。
    *   增加“退出登录”按钮。
    *   如果当前登录用户是 admin 角色，显示“用户管理”入口。
*   **用户管理面板 (仅 Admin 可见)**: 列表展示所有注册用户，可进行简单的管理操作（视需求实现禁用/删除等）。

---

## 实施步骤建议

如果你准备开始实施，建议按照以下顺序进行：
1.  **Phase 1**: 后端依赖安装，数据库表结构升级，编写并测试 `auth.js` 路由和中间件。
2.  **Phase 2**: 改造所有现有的后端 API，全面加上 `user_id` 过滤。
3.  **Phase 3**: 前端新增登录/注册页面，配置 API 拦截器和 `<PrivateRoute>` 路由守卫。
4.  **Phase 4**: 在前端设置页面中补齐“修改密码”、“退出登录”以及管理员的“用户管理”界面。
