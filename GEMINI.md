# Gemini CLI - 项目上下文 (零花钱记账)

这是一个全栈个人财务管理应用（Pocket Money Tracker），旨在帮助用户记录日常收支、分析消费习惯并管理预算。

## 🚀 项目概览
- **前端**: React 19 (Vite) + Chart.js + CSS Variables (支持深色模式)。
- **后端**: Express 5 + SQLite (better-sqlite3)。
- **数据库**: `server/data.db`，包含交易记录、应用设置和分类管理。
- **核心功能**: 
  - 交易 CRUD 与分页列表。
  - 多维度报表（周/月/年）与分类占比图表。
  - 自定义分类与预算阈值提醒（预警/危险）。
  - Excel 批量导入与导出。
  - macOS `.app` 打包支持。

## 🛠️ 关键指令
- **开发模式**: `npm run dev` (同时启动前后端)。
- **仅启动后端**: `npm run server` (端口 5001)。
- **仅启动前端**: `npm run client` (端口 5173)。
- **前端构建**: `npm run build`。
- **macOS 打包**: `bash build_app.sh`。

## 📁 核心架构
- `client/src/pages/`: 包含首页、列表页、统计页和设置页。
- `client/src/api/index.js`: 封装了所有与后端的通信接口。
- `server/db.js`: 数据库初始化脚本，包含默认分类和设置的种子数据。
- `server/routes/`: 交易路由 (`transactions.js`) 和分类路由 (`categories.js`)。

## 💡 开发约定
1. **API 通信**: 使用 `client/src/api/index.js` 中的 `request` 封装函数，接口均返回 `{ success: boolean, data?: any, error?: string }`。
2. **样式风格**: 采用原生 CSS 变量（`--color-primary` 等）实现主题化。样式设计倾向于淡色系（樱花粉、薰衣草紫、薄荷绿），并支持自动深色模式（`@media (prefers-color-scheme: dark)`）。
3. **状态管理**: 优先使用本地 `useState`。跨页面偏好（如列表筛选条件）存储在 `localStorage` 中。
4. **数据库操作**: 使用 `better-sqlite3`。查询逻辑集中在 `server/routes/` 中，统计逻辑（如聚合查询）较为复杂，修改前请查看 `server/routes/transactions.js`。
5. **数据同步**: 修改交易或分类后，前端应通过触发相应状态更新或重新拉取 API 来保持同步。

## ⚠️ 注意事项
- 数据库路径位于 `server/data.db`，不要在 `server/` 目录外直接操作。
- 分页默认每页 30 条。
- 导出 Excel 时支持按当前筛选周期（周/月/年）进行。
