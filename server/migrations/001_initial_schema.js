// Migration 001: 建立初始表结构、多用户支持、索引、默认数据
// 所有语句幂等，可安全重复执行

const bcrypt = require('bcryptjs');

exports.up = (db) => {
  // ── 建表 ────────────────────────────────────────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `).run();

  db.prepare(`
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
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      is_default INTEGER DEFAULT 0
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount REAL NOT NULL CHECK(amount > 0),
      category TEXT NOT NULL,
      emoji TEXT DEFAULT '',
      note TEXT DEFAULT '',
      frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly')),
      day_of_week INTEGER DEFAULT NULL,
      day_of_month INTEGER DEFAULT NULL,
      last_generated TEXT DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `).run();

  // ── 创建/确认 admin 用户 ────────────────────────────────────────────────────

  let adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!adminUser) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')"
    ).run(hash);
    adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  }
  const adminId = adminUser.id;

  // ── 数据迁移：给旧表添加 user_id ────────────────────────────────────────────

  const hasColumn = (table, col) =>
    db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);

  if (!hasColumn('transactions', 'user_id')) {
    db.prepare(`ALTER TABLE transactions ADD COLUMN user_id INTEGER DEFAULT ${adminId}`).run();
  }
  if (!hasColumn('categories', 'user_id')) {
    db.prepare(`ALTER TABLE categories ADD COLUMN user_id INTEGER DEFAULT ${adminId}`).run();
  }
  if (!hasColumn('recurring_templates', 'user_id')) {
    db.prepare(
      `ALTER TABLE recurring_templates ADD COLUMN user_id INTEGER DEFAULT ${adminId}`
    ).run();
  }

  // settings 表需重建以将主键改为 (user_id, key)
  if (!hasColumn('settings', 'user_id')) {
    db.prepare(`
      CREATE TABLE settings_new (
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (user_id, key)
      )
    `).run();
    db.prepare(
      `INSERT OR IGNORE INTO settings_new (user_id, key, value) SELECT ?, key, value FROM settings`
    ).run(adminId);
    db.prepare('DROP TABLE settings').run();
    db.prepare('ALTER TABLE settings_new RENAME TO settings').run();
  }

  // ── 索引 ──────────────────────────────────────────────────────────────────────

  db.prepare('DROP INDEX IF EXISTS idx_categories_type_name').run();
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_type_name_user
    ON categories (type, name, user_id)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date_type
    ON transactions (date, type)
  `).run();

  // ── 初始化 admin 默认数据 ──────────────────────────────────────────────────────

  exports.seedDefaults(db, adminId);
};

exports.seedDefaults = (db, userId) => {
  const setStmt = db.prepare(
    'INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)'
  );
  setStmt.run(userId, 'monthly_income', '300');
  setStmt.run(userId, 'warn_threshold', '200');
  setStmt.run(userId, 'danger_threshold', '270');
  setStmt.run(userId, 'initial_balance', '0');

  const catStmt = db.prepare(
    'INSERT OR IGNORE INTO categories (type, name, emoji, is_default, user_id) VALUES (?, ?, ?, 1, ?)'
  );
  [
    ['expense', '餐饮', '🍜'], ['expense', '零食', '🍡'], ['expense', '文具', '📚'],
    ['expense', '交通', '🚌'], ['expense', '娱乐', '🎮'], ['expense', '礼物', '🎁'],
    ['expense', '服饰', '👗'], ['expense', '其他', '✨'],
    ['income', '零花钱', '💰'], ['income', '红包', '🧧'],
    ['income', '劳动所得', '💪'], ['income', '奖励', '🏆'], ['income', '其他', '🌟'],
  ].forEach(([type, name, emoji]) => catStmt.run(type, name, emoji, userId));
};
