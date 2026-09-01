// 交易标签：tags 存每个用户的标签，transaction_tags 是交易↔标签多对多关联。
// 不加外键——本项目从未开启 PRAGMA foreign_keys，级联清理在路由层显式处理。
exports.up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, name)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      UNIQUE(transaction_id, tag_id)
    )
  `).run();

  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_transaction_tags_tx ON transaction_tags (transaction_id)'
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON transaction_tags (tag_id)'
  ).run();
};
