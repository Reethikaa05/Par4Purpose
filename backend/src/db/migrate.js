require('dotenv').config();
const { getDb, initPromise } = require('./database');

const migrate = () => {
  const db = getDb();
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
  console.log('✅ Database migrated successfully');
};

initPromise.then(() => { migrate(); process.exit(0); });
