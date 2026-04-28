const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('./golfgives.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.length > 0 ? tables.map(t => t.name).join(', ') : 'NONE');
if (tables.length > 0) {
  const charities = db.prepare("SELECT COUNT(*) as count FROM charities").get();
  console.log('Charities count:', charities.count);
}
db.close();
