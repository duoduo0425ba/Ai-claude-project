const Database = require('better-sqlite3');
const path = require('path');
const runMigrations = require('./migrate');
const { seedDefaults: _seedDefaults } = require('./migrations/001_initial_schema');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

runMigrations(db);

module.exports = db;
module.exports.seedDefaults = (userId) => _seedDefaults(db, userId);
