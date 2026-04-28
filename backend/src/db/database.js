/**
 * SQLite via sql.js (pure JavaScript, no native compilation needed)
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Use project root-relative path for Vercel compatibility
const DB_PATH = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH) 
  : path.resolve(process.cwd(), 'backend/golfgives.db');


let _db = null;
let _SQL = null;
let _ready = false;

async function init() {
  console.log('[DB] Initializing with path:', DB_PATH);
  _SQL = await initSqlJs();
  
  try {
    const filebuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(filebuffer);
    console.log('[DB] Database loaded from file');
  } catch (e) {
    _db = new _SQL.Database();
    console.log('[DB] Created new in-memory database');
  }
  
  const tables = _db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.length > 0 ? tables[0].values.map(t => t[0]) : [];
  console.log('[DB] Found tables:', tableNames.join(', '));
  _ready = true;
}

// Persistence helper
function saveDb() {
  try {
    const data = _db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('[DB] Failed to save:', e.message);
  }
}

const db = {
  _check() { if (!_ready) throw new Error('DB not initialised'); },

  run(sql, params = []) { 
    this._check(); 
    const stmt = _db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    stmt.step();
    stmt.free();
    saveDb();
    return this;
  },

  exec(sql) { 
    this._check(); 
    _db.run(sql);
    saveDb();
    return this;
  },

  pragma() { return this; },

  prepare(sql) {
    const self = this;
    return {
      run(...args) {
        self._check();
        const params = self._flatten(args);
        try {
          const stmt = _db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          stmt.step();
          // Get lastRow to find insert ID
          const getLastId = _db.prepare("SELECT last_insert_rowid() as id");
          getLastId.step();
          const row = getLastId.getAsObject();
          getLastId.free();
          stmt.free();
          saveDb();
          return { lastInsertRowid: row?.id || 0 };
        } catch (e) {
          throw e;
        }
      },
      get(...args) {
        self._check();
        const params = self._flatten(args);
        try {
          const stmt = _db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return null;
        } catch (e) {
          throw e;
        }
      },
      all(...args) {
        self._check();
        const params = self._flatten(args);
        try {
          const stmt = _db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        } catch (e) {
          throw e;
        }
      },
    };
  },

  transaction(fn) {
    const self = this;
    return function() {
      self._check();
      try {
        self.run('BEGIN TRANSACTION');
        fn();
        self.run('COMMIT');
      } catch (e) {
        self.run('ROLLBACK');
        throw e;
      }
    };
  },

  _flatten(args) {
    if (args.length === 0) return [];
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) return args[0];
    return args;
  },
};

// Exported promise so server waits for DB init before listening
const initPromise = init().catch(err => { console.error('DB init failed:', err); process.exit(1); });

function getDb() { return db; }

module.exports = { getDb, initPromise };
