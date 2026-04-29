/**
 * SQLite via better-sqlite3 (native, synchronous)
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Use project root-relative path for Vercel compatibility
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'backend/golfgives.db');

let _db = null;

function init() {
  console.log('[DB] Initializing with path:', DB_PATH);
  _db = new Database(DB_PATH);

  const tables = _db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map(t => t.name);
  console.log('[DB] Found tables:', tableNames.join(', '));
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
