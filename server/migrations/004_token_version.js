// 用户 Token 版本号。签发 Token 时把当时的版本写进载荷，改密码时版本 +1，
// 中间件发现载荷里的版本和库里对不上就拒绝——旧 Token 立即失效，不用等 7 天过期。
exports.up = (db) => {
  const hasColumn = db.prepare('PRAGMA table_info(users)').all()
    .some((c) => c.name === 'token_version');
  if (!hasColumn) {
    db.prepare('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0').run();
  }
};
