const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/users
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { status, plan, search } = req.query;
  let query = `SELECT u.id, u.name, u.email, u.role, u.subscription_status, u.subscription_plan, u.created_at, u.current_period_end, u.charity_id, u.charity_percentage, c.name as charity_name,
    (SELECT COUNT(*) FROM scores s WHERE s.user_id = u.id) as score_count
    FROM users u LEFT JOIN charities c ON u.charity_id = c.id WHERE u.role != 'admin'`;
  const params = [];
  if (status) { query += ' AND u.subscription_status = ?'; params.push(status); }
  if (plan) { query += ' AND u.subscription_plan = ?'; params.push(plan); }
  if (search) { query += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  query += ' ORDER BY u.created_at DESC';
  res.json({ users: db.prepare(query).all(...params) });
});

// GET /api/admin/users/:id
router.get('/users/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT u.*, c.name as charity_name FROM users u LEFT JOIN charities c ON u.charity_id = c.id WHERE u.id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...safe } = user;
  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY date DESC').all(req.params.id);
  const payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id);
  const winnings = db.prepare('SELECT w.*, d.month FROM winners w JOIN draws d ON w.draw_id = d.id WHERE w.user_id = ?').all(req.params.id);
  res.json({ user: safe, scores, payments, winnings });
});

// PUT /api/admin/users/:id
router.put('/users/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { name, subscription_status, subscription_plan, charity_id } = req.body;
  const updates = []; const vals = [];
  if (name) { updates.push('name=?'); vals.push(name); }
  if (subscription_status) { updates.push('subscription_status=?'); vals.push(subscription_status); }
  if (subscription_plan) { updates.push('subscription_plan=?'); vals.push(subscription_plan); }
  if (charity_id) { updates.push('charity_id=?'); vals.push(charity_id); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  updates.push("updated_at=datetime('now')"); vals.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals);
  res.json({ message: 'User updated' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
  res.json({ message: 'User deleted' });
});

// GET /api/admin/analytics
router.get('/analytics', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'admin'").get().c;
  const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE subscription_status = 'active' AND role != 'admin'").get().c;
  const monthlyPlan = db.prepare("SELECT COUNT(*) as c FROM users WHERE subscription_plan = 'monthly' AND subscription_status = 'active'").get().c;
  const yearlyPlan = db.prepare("SELECT COUNT(*) as c FROM users WHERE subscription_plan = 'yearly' AND subscription_status = 'active'").get().c;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status = 'paid'").get().s;
  const totalCharity = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM charity_contributions").get().s;
  const totalPrizes = db.prepare("SELECT COALESCE(SUM(prize_amount),0) as s FROM winners WHERE payment_status = 'paid'").get().s;
  const drawCount = db.prepare("SELECT COUNT(*) as c FROM draws WHERE status = 'published'").get().c;
  const pendingWinners = db.prepare("SELECT COUNT(*) as c FROM winners WHERE verification_status = 'pending'").get().c;
  const charityBreakdown = db.prepare(`SELECT c.id, c.name, c.emoji, c.total_raised, COUNT(u.id) as member_count FROM charities c LEFT JOIN users u ON u.charity_id = c.id AND u.subscription_status = 'active' GROUP BY c.id ORDER BY c.total_raised DESC`).all();
  const mrr = (monthlyPlan * 9.99 + yearlyPlan * (89.99 / 12)).toFixed(2);
  const recentPayments = db.prepare("SELECT p.*, u.name, u.email FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 10").all();

  res.json({
    totalUsers, activeUsers, monthlyPlan, yearlyPlan,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalCharity: parseFloat(totalCharity.toFixed(2)),
    totalPrizes: parseFloat(totalPrizes.toFixed(2)),
    drawCount, pendingWinners,
    mrr: parseFloat(mrr),
    arr: parseFloat((mrr * 12).toFixed(2)),
    charityBreakdown,
    recentPayments,
  });
});

// GET /api/admin/dashboard - summary for overview widget
router.get('/dashboard', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE subscription_status = 'active' AND role != 'admin'").get().c;
  const pool = (activeUsers * 9.99 * 0.40).toFixed(2);
  const charityTotal = (activeUsers * 9.99 * 0.10).toFixed(2);
  const pendingVerifications = db.prepare("SELECT COUNT(*) as c FROM winners WHERE verification_status = 'pending'").get().c;
  const latestDraw = db.prepare("SELECT * FROM draws ORDER BY id DESC LIMIT 1").get();
  res.json({ activeUsers, prizePool: parseFloat(pool), charityTotal: parseFloat(charityTotal), pendingVerifications, latestDraw });
});

module.exports = router;
