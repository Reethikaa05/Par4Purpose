/**
 * SQLite via better-sqlite3 (native, synchronous)
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Use project root-relative path for Vercel compatibility
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), 'golfgives.db');

let _db = null;

function runMigrations() {
  const db = _db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
      subscription_status TEXT NOT NULL DEFAULT 'inactive', subscription_plan TEXT,
      subscription_id TEXT, customer_id TEXT, current_period_end TEXT,
      charity_id INTEGER, charity_percentage REAL DEFAULT 10,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS charities (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, emoji TEXT,
      description TEXT, category TEXT, total_raised REAL DEFAULT 0,
      is_featured INTEGER DEFAULT 0, image_url TEXT, website TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
      value INTEGER NOT NULL, date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    );
    CREATE TABLE IF NOT EXISTS draws (
      id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT NOT NULL UNIQUE,
      numbers TEXT, status TEXT NOT NULL DEFAULT 'pending',
      draw_mode TEXT NOT NULL DEFAULT 'random', jackpot_rollover REAL DEFAULT 0,
      prize_pool_total REAL DEFAULT 0, prize_five REAL DEFAULT 0,
      prize_four REAL DEFAULT 0, prize_three REAL DEFAULT 0,
      published_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS draw_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, draw_id INTEGER NOT NULL,
      user_id TEXT NOT NULL, scores_snapshot TEXT NOT NULL,
      matches INTEGER DEFAULT 0, prize_won REAL DEFAULT 0, match_tier TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS winners (
      id INTEGER PRIMARY KEY AUTOINCREMENT, draw_id INTEGER NOT NULL,
      user_id TEXT NOT NULL, match_tier TEXT NOT NULL, prize_amount REAL NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'pending', proof_url TEXT,
      admin_note TEXT, payment_status TEXT NOT NULL DEFAULT 'pending',
      paid_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS charity_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
      charity_id INTEGER NOT NULL, amount REAL NOT NULL, month TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
      stripe_payment_id TEXT, amount REAL NOT NULL, currency TEXT DEFAULT 'eur',
      plan TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT NOT NULL,
      subject TEXT, recipient TEXT NOT NULL, status TEXT DEFAULT 'sent',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log('✅ Database tables created');
}

function init() {
  console.log('[DB] Initializing with path:', DB_PATH);
  
  // Ensure the directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('[DB] Created directory:', dbDir);
  }
  
  _db = new Database(DB_PATH);

  // Check if tables exist, if not run migrations
  const tables = _db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map(t => t.name);
  
  if (tableNames.length === 0) {
    console.log('[DB] No tables found, running migrations...');
    runMigrations();
  } else {
    console.log('[DB] Found tables:', tableNames.join(', '));
  }
}

// Exported promise so server waits for DB init before listening
const initPromise = new Promise((resolve, reject) => {
  try {
    init();
    resolve();
  } catch (err) {
    console.error('DB init failed:', err);
    reject(err);
  }
});

function getDb() {
  return {
    run(sql, params = []) {
      return _db.prepare(sql).run(params);
    },

    exec(sql) {
      return _db.exec(sql);
    },

    pragma() { return this; },

    prepare(sql) {
      const stmt = _db.prepare(sql);
      return {
        run(...args) {
          const params = Array.isArray(args[0]) ? args[0] : args;
          return stmt.run(params);
        },
        get(...args) {
          const params = Array.isArray(args[0]) ? args[0] : args;
          return stmt.get(params);
        },
        all(...args) {
          const params = Array.isArray(args[0]) ? args[0] : args;
          return stmt.all(params);
        },
      };
    },

    transaction(fn) {
      return _db.transaction(fn);
    },
  };
}

module.exports = { getDb, initPromise };
