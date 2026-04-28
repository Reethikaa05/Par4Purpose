require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, initPromise } = require('./database');

const seed = async () => {
  const db = getDb();
  const charities = [
    { name: 'Caddie4Kids', emoji: '⛳', description: 'Bringing golf and opportunity to underprivileged youth across Ireland.', category: 'Youth', total_raised: 18420, is_featured: 0, image_url: 'https://images.unsplash.com/photo-1587329431835-43033bf7000e?w=800&auto=format&fit=crop' },
    { name: 'Green Hearts', emoji: '💚', description: 'Environmental stewardship through golf course conservation programmes.', category: 'Environment', total_raised: 9870, is_featured: 0, image_url: 'https://images.unsplash.com/photo-1535136155554-469b2d829393?w=800&auto=format&fit=crop' },
    { name: 'Fairway Health', emoji: '🏥', description: 'Funding mental health initiatives for sporting communities.', category: 'Health', total_raised: 14300, is_featured: 0, image_url: 'https://images.unsplash.com/photo-1593111774240-d529f12eb4d6?w=800&auto=format&fit=crop' },
    { name: 'Swing & Hope', emoji: '🌍', description: 'International relief fund using sport to rebuild communities.', category: 'Relief', total_raised: 22150, is_featured: 1, image_url: 'https://images.unsplash.com/photo-1542385151-efd9000785a0?w=800&auto=format&fit=crop' },
    { name: 'Birdie Foundation', emoji: '🐦', description: 'Supporting veteran golfers and their families through hardship.', category: 'Veterans', total_raised: 7640, is_featured: 0, image_url: 'https://images.unsplash.com/photo-1580227184283-93d3b76a6cfd?w=800&auto=format&fit=crop' },
    { name: 'Eagle Trust', emoji: '🦅', description: 'Providing golf scholarships to talented players from low-income homes.', category: 'Education', total_raised: 31200, is_featured: 0, image_url: 'https://images.unsplash.com/photo-1595861113524-7b003a27778b?w=800&auto=format&fit=crop' },
  ];
  charities.forEach(c => {
    const exists = db.prepare('SELECT id FROM charities WHERE name = ?').get(c.name);
    if (!exists) db.prepare('INSERT INTO charities (name,emoji,description,category,total_raised,is_featured,image_url) VALUES (?,?,?,?,?,?,?)').run(c.name,c.emoji,c.description,c.category,c.total_raised,c.is_featured,c.image_url);
  });

  const adminHash = await bcrypt.hash('admin123', 12);
  const adminId = uuidv4();
  const adminExists = db.prepare("SELECT id FROM users WHERE email='admin@golfgives.com'").get();
  if (!adminExists) db.prepare("INSERT INTO users (id,name,email,password_hash,role,subscription_status,subscription_plan,charity_id,charity_percentage) VALUES (?,?,?,?,'admin','active','yearly',1,10)").run(adminId,'Admin User','admin@golfgives.com',adminHash);

  const userHash = await bcrypt.hash('user1234', 12);
  const userId = uuidv4();
  const userExists = db.prepare("SELECT id FROM users WHERE email='user@golfgives.com'").get();
  if (!userExists) {
    db.prepare("INSERT INTO users (id,name,email,password_hash,role,subscription_status,subscription_plan,charity_id,charity_percentage) VALUES (?,?,?,?,'user','active','monthly',4,10)").run(userId,'Test Golfer','user@golfgives.com',userHash);
    [{ v:34,d:'2025-04-26'},{v:28,d:'2025-04-20'},{v:41,d:'2025-04-14'},{v:33,d:'2025-04-07'},{v:39,d:'2025-04-01'}].forEach(s => {
      db.prepare('INSERT INTO scores (user_id,value,date) VALUES (?,?,?)').run(userId,s.v,s.d);
    });
  }

  console.log('✅ Database seeded');
  console.log('   Admin: admin@golfgives.com / admin123');
  console.log('   User:  user@golfgives.com  / user1234');
};

initPromise.then(() => seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); }));
