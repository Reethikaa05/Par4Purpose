const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('./backend/golfgives.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.length ? tables.map(t => t.name).join(', ') : 'NONE');
if (tables.length) {
  const charities = db.prepare('SELECT COUNT(*) as count FROM charities').get();
  console.log('Charities count:', charities.count);
}
db.close();
