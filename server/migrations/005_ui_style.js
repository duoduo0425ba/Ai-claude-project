// 用户的界面风格（anime 二次元 / space 星际探索 / classic 经典账本）。
// 注册时选择，之后可在设置里修改；已有账号默认 anime，外观保持不变。
exports.up = (db) => {
  const hasColumn = db.prepare('PRAGMA table_info(users)').all()
    .some((c) => c.name === 'ui_style');
  if (!hasColumn) {
    db.prepare("ALTER TABLE users ADD COLUMN ui_style TEXT NOT NULL DEFAULT 'anime'").run();
  }
};
