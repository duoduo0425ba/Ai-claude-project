# 零花钱记账 (Pocket Money Tracker)

一个功能完整的个人财务管理应用，帮助用户记录日常收支、分析消费习惯、制定预算计划。

![version](https://img.shields.io/badge/version-2.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![react](https://img.shields.io/badge/react-19-61dafb)
![node](https://img.shields.io/badge/node-18%2B-339933)

## ✨ 主要特性

### 📝 记账管理
- ⚡ 快速记账：一键切换收入/支出，快速选择分类和金额
- 📋 交易列表：支持搜索、按日期和分类筛选、分页显示
- ✏️ 编辑删除：随时修改或删除已记录的交易
- 📁 自定义分类：添加超出默认分类的自定义类别

### 📊 数据分析
- 📈 周报：7日数据一览，日均消费分析
- 📆 月报：日均趋势图、支出分类占比、收入分类占比
- 📋 年报：12月收支汇总、年度顶级支出/收入分类排名
- 💰 预算追踪：实时预警机制，设定消费预警和危险阈值

### 🎯 个人财务管理
- 💵 总余额统计：初始结余 + 全部收入 - 全部支出
- 💚 今日摘要：快速查看每日收入、支出、结余
- 🏦 初始结余：设定账户起始余额
- 🎚️ 月度额度：自定义每月零花钱预算

### 🛠️ 数据操作
- 📥 Excel 导入：批量导入交易记录（支持自定义日期范围）
- 📤 Excel 导出：按时间周期导出数据（周/月/年）
- 🔄 批量操作：支持多条记录批量导入

### 🎨 用户体验
- 🌙 深色模式：自动响应系统深色主题偏好
- ⌨️ 快捷键：Escape 快速关闭弹窗
- 💾 状态记忆：记住上次筛选偏好
- ⏳ 加载反馈：数据加载时显示进度提示
- 📱 响应式设计：完美适配桌面和平板屏幕

## 🚀 快速开始

### 前置条件
- Node.js 18 或更高版本
- npm 或 yarn

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/pocket-money-tracker.git
cd pocket-money-tracker

# 安装依赖
npm install
```

### 开发模式

```bash
# 启动前后端开发服务器
npm run dev

# 前端: http://localhost:5173
# 后端: http://localhost:5001
```

### 生产构建

```bash
# 构建前端
npm run build

# 输出目录: client/dist/
```

### macOS 应用打包

```bash
# 生成 .app 包
bash build_app.sh

# 将生成 零花钱记账.app
```

## 📁 项目结构

```
pocket-money-tracker/
├── client/                      # React 前端
│   ├── src/
│   │   ├── pages/              # 4个主页面
│   │   │   ├── HomePage.jsx    # 首页（记账、今日摘要、余额）
│   │   │   ├── ListPage.jsx    # 账单列表（搜索、筛选、分页）
│   │   │   ├── ReportPage.jsx  # 报表统计（图表、分析）
│   │   │   └── SettingsPage.jsx # 设置（预算、分类管理）
│   │   ├── components/         # 可复用组件
│   │   ├── hooks/              # 自定义 Hook
│   │   ├── utils/              # 工具函数（Excel处理）
│   │   ├── api/                # API 层
│   │   └── index.css           # 全局样式 + 深色模式
│   └── package.json
│
├── server/                      # Express 后端
│   ├── routes/
│   │   ├── transactions.js      # 交易 CRUD + 统计
│   │   └── categories.js        # 分类管理
│   ├── db.js                    # SQLite 初始化
│   ├── index.js                 # Express 服务器
│   └── package.json
│
├── build_app.sh                 # macOS 应用构建脚本
├── CLAUDE.md                    # 开发者指南
└── README.md                    # 本文件
```

## 🔧 技术栈

### 前端
- **框架**: React 19 + Vite
- **路由**: React Router v6
- **图表**: Chart.js + react-chartjs-2
- **数据处理**: xlsx (Excel import/export)
- **样式**: CSS3 (Variables, Grid, Flexbox)
- **动画**: CSS Animations

### 后端
- **框架**: Express 5
- **数据库**: SQLite 3 (better-sqlite3)
- **架构**: RESTful API

## 📋 API 文档

### 交易管理

```
GET    /api/transactions              # 获取交易列表（支持筛选）
POST   /api/transactions              # 创建新交易
PUT    /api/transactions/:id          # 修改交易
DELETE /api/transactions/:id          # 删除交易
POST   /api/transactions/batch        # 批量导入
```

**查询参数:**
- `startDate`, `endDate`: 日期范围
- `category`: 分类筛选
- `type`: income | expense
- `keyword`: 备注搜索

### 统计数据

```
GET /api/transactions/stats/daily     # 每日统计
GET /api/transactions/stats/weekly    # 周统计（7日）
GET /api/transactions/stats/monthly   # 月统计（含分类）
GET /api/transactions/stats/yearly    # 年统计（含分类）
GET /api/transactions/stats/budget    # 预算状态
GET /api/transactions/stats/balance   # 总余额
```

### 分类管理

```
GET    /api/categories?type=expense   # 获取分类
POST   /api/categories                # 添加自定义分类
DELETE /api/categories/:id            # 删除分类（仅自定义）
```

### 应用设置

```
GET  /api/transactions/settings       # 获取设置
PUT  /api/transactions/settings       # 更新设置
```

**设置项:**
- `monthly_income`: 月度零花钱（默认: 300）
- `warn_threshold`: 预警阈值（默认: 200）
- `danger_threshold`: 危险阈值（默认: 270）
- `initial_balance`: 初始结余（默认: 0）

## 🎯 默认分类

### 支出分类 (8个)
🍜 餐饮 | 🍡 零食 | 📚 文具 | 🚌 交通 | 🎮 娱乐 | 🎁 礼物 | 👗 服饰 | ✨ 其他

### 收入分类 (5个)
💰 零花钱 | 🧧 红包 | 💪 劳动所得 | 🏆 奖励 | 🌟 其他

## 📱 界面展览

### 首页
- 快速记账表单（支出/收入切换）
- 月度预算进度条
- 今日收支汇总
- 总余额统计

### 账单列表
- 按日期分组展示
- 支持搜索和多条件筛选
- 30条记录一页，分页导航
- 单条编辑/删除操作
- 批量导入/导出 Excel

### 报表统计
- **周报**: 7日柱状图 + 日均分析
- **月报**: 日趋势线图 + 支出分类饼图 + 收入分类饼图
- **年报**: 12月柱状图 + 年度分类排名
- 按周期导出数据

### 设置页面
- 预算参数配置
- 初始结余设置
- 自定义分类管理（增删分类）

## 🌙 深色模式

应用自动响应系统深色主题偏好设置，无需手动切换。

## 💾 数据存储

- **位置**: `server/data.db` (SQLite)
- **模式**: WAL (Write-Ahead Logging) 用于并发性能
- **初始化**: 自动创建表和种子数据

## 📦 依赖项管理

### 前端主要依赖
```json
{
  "react": "^19",
  "react-router-dom": "^6",
  "chart.js": "^4",
  "react-chartjs-2": "^5",
  "xlsx": "^0.18"
}
```

### 后端主要依赖
```json
{
  "express": "^5",
  "better-sqlite3": "^9",
  "cors": "^2"
}
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📝 更新日志

### v2.0 (最新)
- ✅ 自定义分类系统
- ✅ 收入分类图表分析
- ✅ 年度分类排名
- ✅ 总余额统计
- ✅ 深色模式支持
- ✅ 分页与加载状态
- ✅ 键盘快捷键
- ✅ Excel 导出按周期

### v1.0
- 基础交易记录
- 周/月/年报表
- Excel 导入导出
- 预算追踪

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 👨‍💻 作者

- **开发**: Created with ❤️

## 🙏 致谢

感谢所有贡献者和使用者的支持！

---

**提示**: 详见 [CLAUDE.md](CLAUDE.md) 了解开发者指南和架构细节。
