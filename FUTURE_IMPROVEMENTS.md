# 后续优化建议（补充稿）

本文档是对 `OPTIMIZATIONS.md` 和 `MULTI_USER_PLAN.md` 的补充，只列出已有文档**未覆盖**的改进方向，按实用价值排序。

---

## 🥇 高价值（建议优先做）

### 1. 多账户 / 钱包
- **现状**: 只有单一账本，所有收支混在一起。
- **建议**: 新增 `accounts` 表（现金、银行卡、支付宝、微信…），每条交易关联一个账户；支持账户间"转账"操作（不计入收支，只调整余额）。
- **收益**: 真实还原用户资金分布，是记账类 App 的核心能力。

### 2. ~~分类级预算~~ ✅ 已完成
- **已实现**: `category_budgets` 表（`002_category_budgets.js` 迁移）+ `routes/budgets.js`（CRUD + `/status`），设置页可按分类设预算，BudgetAlert 同时展示全局与分类预算。

### 3. ~~ErrorBoundary + 全局错误兜底~~ ✅ 已完成
- **已实现**: `components/ErrorBoundary.jsx`，在 `main.jsx` 中包裹整个应用。

### 4. ~~数据库迁移机制~~ ✅ 已完成
- **已实现**: `server/migrate.js` 启动时按序执行 `migrations/NNN_*.js`（JS 而非 SQL 脚本），已执行版本记录在 `schema_migrations` 表。

---

## 🥈 中等价值

### 5. ~~标签系统（Tags）~~ ✅ 已完成（2026-09）
- **已实现**: `tags` + `transaction_tags` 两表（`003_tags.js` 迁移）；交易可打多个标签（保存时自动创建）、列表页按标签筛选、`GET /api/tags` 返回用量统计；JSON 备份/恢复自动保留标签。详见 `CLAUDE.md` 的标签章节。
- **遗留小项**: Excel 导入导出带标签列、多标签组合筛选（AND/OR）、标签重命名/删除管理界面。

### 6. 票据 / 图片附件
- **现状**: 每条记录只有文本备注。
- **建议**: 支持给交易上传小图（发票、收据），存 `server/uploads/` 或 Base64 入库（小数据量）。
- **收益**: 报销、对账场景刚需。

### 7. ~~全文搜索增强~~ ✅ 基本完成
- **已实现**: `GET /api/transactions?keyword=` 对备注和分类做 `LIKE` 模糊匹配，ListPage 有搜索框。
- **遗留小项**: 搜索结果关键词高亮未做。

### 8. ~~主题手动切换~~ ✅ 已完成
- **已实现**: 设置页「浅色 / 深色 / 跟随系统」三档，写入 localStorage，`main.jsx` 在 React 渲染前读取并设置 `data-theme`，避免首屏闪烁。

### 9. 国际化 i18n
- **现状**: 中文文案硬编码在组件里。
- **建议**: 引入 `react-i18next`，把文案抽到 `zh.json` / `en.json`。
- **收益**: 未来扩展英文版本成本极低；越晚做越痛。

---

## 🥉 工程健壮性

### 10. TypeScript 渐进迁移
- 从 `api/index.js` 和数据模型（Transaction、Category）开始加类型，防止字段拼写/类型错误。
- 可以先用 JSDoc 类型注释，低成本起步。

### 11. Docker 化部署
- 一份 `docker-compose.yml` 同时跑前后端，方便部署到 NAS、VPS、自托管服务器。

### 12. 日志分级
- 后端用 `pino` 或 `winston` 代替 `console.log`，区分 info / warn / error，配合 `server.log` 轮转。
- 便于线上排查问题。

---

## 📌 推荐起步组合

原推荐的三件事中，分类级预算和 ErrorBoundary 均已完成。当前待办里性价比最高的是：

1. **多账户 / 钱包**（功能价值最高，条目 1）
2. **票据 / 图片附件**（报销对账刚需，条目 6）
3. **标签功能收尾**（Excel 标签列、多标签组合筛选，见条目 5 遗留小项）

之后再按需推进 i18n、TypeScript、Docker 化等工程改造。
