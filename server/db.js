const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// 开启 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

// 创建 transactions 表
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL CHECK(amount > 0),
    category TEXT NOT NULL,
    emoji TEXT DEFAULT '',
    note TEXT DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

// 创建 settings 表
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// 创建 categories 表
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    is_default INTEGER DEFAULT 0
  )
`);

// 初始化默认设置
const initSettings = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);
initSettings.run('monthly_income', '300');
initSettings.run('warn_threshold', '200');
initSettings.run('danger_threshold', '270');
initSettings.run('initial_balance', '0');

// 初始化默认分类
const initCategories = db.prepare(`
  INSERT OR IGNORE INTO categories (type, name, emoji, is_default) VALUES (?, ?, ?, 1)
`);

// 支出分类
initCategories.run('expense', '餐饮', '🍜');
initCategories.run('expense', '零食', '🍡');
initCategories.run('expense', '文具', '📚');
initCategories.run('expense', '交通', '🚌');
initCategories.run('expense', '娱乐', '🎮');
initCategories.run('expense', '礼物', '🎁');
initCategories.run('expense', '服饰', '👗');
initCategories.run('expense', '其他', '✨');

// 收入分类
initCategories.run('income', '零花钱', '💰');
initCategories.run('income', '红包', '🧧');
initCategories.run('income', '劳动所得', '💪');
initCategories.run('income', '奖励', '🏆');
initCategories.run('income', '其他', '🌟');

module.exports = db;
