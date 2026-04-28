const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireAdmin, requireSubscription } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

const SUBSCRIPTION_PRICE = { monthly: 9.99, yearly: 89.99 };
const PRIZE_POOL_SHARE = 0.40;

function calcPrizePool(db, rollover = 0) {
  const activeUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active' AND role != 'admin'").get();
  const monthlyTotal = activeUsers.count * SUBSCRIPTION_PRICE.monthly;
  const pool = monthlyTotal * PRIZE_POOL_SHARE + rollover;
  return {
    total: parseFloat(pool.toFixed(2)),
    five: parseFloat((pool * 0.40).toFixed(2)),
    four: parseFloat((pool * 0.35).toFixed(2)),
    three: parseFloat((pool * 0.25).toFixed(2)),
    activeUsers: activeUsers.count,
  };
}

function generateDrawNumbers(db, mode = 'random') {
  if (mode === 'random') {
    const nums = new Set();
    while (nums.size < 5) nums.add(Math.floor(Math.random() * 45) + 1);
    return Array.from(nums);
  }
  // Algorithmic: weighted by score frequency
  const scores = db.prepare(`
    SELECT s.value, COUNT(*) as freq FROM scores s
    JOIN users u ON s.user_id = u.id
    WHERE u.subscription_status = 'active'
    GROUP BY s.value ORDER BY freq DESC
  `).all();
  const pool = [];
  scores.forEach(s => { for (let i = 0; i < s.freq; i++) pool.push(s.value); });
  if (pool.length < 5) {
    const nums = new Set();
    while (nums.size < 5) nums.add(Math.floor(Math.random() * 45) + 1);
    return Array.from(nums);
  }
  const selected = new Set();
  const attempts = 200;
  let i = 0;
  while (selected.size < 5 && i < attempts) {
    selected.add(pool[Math.floor(Math.random() * pool.length)]);
    i++;
  }
  while (selected.size < 5) selected.add(Math.floor(Math.random() * 45) + 1);
  return Array.from(selected);
}

// GET /api/draws - list draws (public summary)
router.get('/', (req, res) => {
  const db = getDb();
  const draws = db.prepare(`SELECT * FROM draws ORDER BY created_at DESC LIMIT 12`).all();
  const pool = calcPrizePool(db);
  res.json({ draws, currentPool: pool });
});

// GET /api/draws/current - current month draw info
router.get('/current', authenticate, (req, res) => {
  const db = getDb();
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  let draw = db.prepare("SELECT * FROM draws WHERE month = ?").get(month);
  const pool = calcPrizePool(db);

  // Check user's scores and entry
  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT 5').all(req.user.id);
  let myEntry = null;
  if (draw) {
    myEntry = db.prepare('SELECT * FROM draw_entries WHERE draw_id = ? AND user_id = ?').get(draw.id, req.user.id);
  }

  res.json({ draw, pool, scores, myEntry, month });
});

// POST /api/draws/simulate - admin simulate draw
router.post('/simulate', authenticate, requireAdmin, [
  body('month').notEmpty(),
  body('mode').isIn(['random', 'algorithm']),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { month, mode } = req.body;

  // Get rollover from previous unpaid jackpot
  const lastDraw = db.prepare("SELECT * FROM draws WHERE status = 'published' ORDER BY id DESC LIMIT 1").get();
  const rollover = lastDraw && !lastDraw.winners_five ? (lastDraw.prize_five || 0) : 0;

  const pool = calcPrizePool(db, rollover);
  const numbers = generateDrawNumbers(db, mode);

  // Calculate matches for all active users
  const users = db.prepare("SELECT u.*, GROUP_CONCAT(s.value) as score_vals FROM users u LEFT JOIN scores s ON s.user_id = u.id WHERE u.subscription_status = 'active' AND u.role != 'admin' GROUP BY u.id").all();

  const results = users.map(u => {
    const userScores = u.score_vals ? u.score_vals.split(',').map(Number) : [];
    const matches = numbers.filter(n => userScores.includes(n)).length;
    return { id: u.id, name: u.name, email: u.email, scores: userScores, matches };
  });

  const fiveMatchers = results.filter(r => r.matches === 5);
  const fourMatchers = results.filter(r => r.matches === 4);
  const threeMatchers = results.filter(r => r.matches === 3);

  res.json({
    numbers,
    pool,
    month,
    mode,
    results,
    summary: {
      fiveMatch: fiveMatchers.length,
      fourMatch: fourMatchers.length,
      threeMatch: threeMatchers.length,
      jackpotRolls: fiveMatchers.length === 0,
    }
  });
});

// POST /api/draws/publish - admin publish official draw
router.post('/publish', authenticate, requireAdmin, [
  body('month').notEmpty(),
  body('numbers').isArray({ min: 5, max: 5 }),
  body('mode').isIn(['random', 'algorithm']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { month, numbers, mode } = req.body;

  const existing = db.prepare('SELECT id FROM draws WHERE month = ?').get(month);
  if (existing && existing.status === 'published') {
    return res.status(409).json({ error: 'Draw for this month already published' });
  }

  const lastDraw = db.prepare("SELECT * FROM draws WHERE status = 'published' ORDER BY id DESC LIMIT 1").get();
  const rollover = lastDraw && !lastDraw.winners_five ? (lastDraw.prize_five || 0) : 0;
  const pool = calcPrizePool(db, rollover);

  // Process entries
  const users = db.prepare("SELECT u.*, GROUP_CONCAT(s.value) as score_vals FROM users u LEFT JOIN scores s ON s.user_id = u.id WHERE u.subscription_status = 'active' AND u.role != 'admin' GROUP BY u.id").all();

  const results = users.map(u => {
    const userScores = u.score_vals ? u.score_vals.split(',').map(Number) : [];
    const matches = numbers.filter(n => userScores.includes(n)).length;
    return { ...u, userScores, matches };
  });

  const fiveMatch = results.filter(r => r.matches === 5);
  const fourMatch = results.filter(r => r.matches === 4);
  const threeMatch = results.filter(r => r.matches === 3);

  const jackpotRolls = fiveMatch.length === 0;
  const prizePerFive = fiveMatch.length > 0 ? pool.five / fiveMatch.length : 0;
  const prizePerFour = fourMatch.length > 0 ? pool.four / fourMatch.length : 0;
  const prizePerThree = threeMatch.length > 0 ? pool.three / threeMatch.length : 0;

  // Insert or update draw
  let drawId;
  if (existing) {
    db.prepare("UPDATE draws SET numbers=?,status='published',draw_mode=?,prize_pool_total=?,prize_five=?,prize_four=?,prize_three=?,jackpot_rollover=?,published_at=datetime('now') WHERE id=?")
      .run(numbers.join(','), mode, pool.total, pool.five, pool.four, pool.three, rollover, existing.id);
    drawId = existing.id;
  } else {
    drawId = db.prepare("INSERT INTO draws (month,numbers,status,draw_mode,prize_pool_total,prize_five,prize_four,prize_three,jackpot_rollover,published_at) VALUES (?,?,'published',?,?,?,?,?,?,datetime('now'))")
      .run(month, numbers.join(','), mode, pool.total, pool.five, pool.four, pool.three, rollover).lastInsertRowid;
  }

  // Insert draw entries and create winners
  const insertEntry = db.prepare('INSERT OR REPLACE INTO draw_entries (draw_id,user_id,scores_snapshot,matches,prize_won,match_tier) VALUES (?,?,?,?,?,?)');
  const insertWinner = db.prepare('INSERT INTO winners (draw_id,user_id,match_tier,prize_amount) VALUES (?,?,?,?)');

  const publishTx = db.transaction(() => {
    results.forEach(u => {
      let prize = 0, tier = null;
      if (u.matches === 5) { prize = prizePerFive; tier = 'five'; }
      else if (u.matches === 4) { prize = prizePerFour; tier = 'four'; }
      else if (u.matches === 3) { prize = prizePerThree; tier = 'three'; }
      insertEntry.run(drawId, u.id, JSON.stringify(u.userScores), u.matches, prize, tier);
      if (tier) insertWinner.run(drawId, u.id, tier, prize);
    });
  });
  publishTx();

  // Send emails async
  results.forEach(u => {
    const prize = u.matches === 5 ? prizePerFive : u.matches === 4 ? prizePerFour : u.matches === 3 ? prizePerThree : 0;
    sendEmail(u.email, 'drawResults', u.name, u.matches, prize.toFixed(2)).catch(() => {});
  });

  res.json({
    message: 'Draw published successfully',
    drawId,
    numbers,
    pool,
    jackpotRolls,
    winners: { five: fiveMatch.length, four: fourMatch.length, three: threeMatch.length }
  });
});

// GET /api/draws/:id/results
router.get('/:id/results', authenticate, (req, res) => {
  const db = getDb();
  const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
  if (!draw) return res.status(404).json({ error: 'Draw not found' });

  const myEntry = db.prepare('SELECT * FROM draw_entries WHERE draw_id = ? AND user_id = ?').get(draw.id, req.user.id);
  res.json({ draw, myEntry });
});

module.exports = router;
