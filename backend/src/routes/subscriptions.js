const express = require('express');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const router = express.Router();
const PRICES = { monthly: 9.99, yearly: 89.99 };

// POST /api/subscriptions/create - initiate subscription (mock Stripe)
router.post('/create', authenticate, async (req, res) => {
  const db = getDb();
  const { plan, paymentMethodId } = req.body;
  if (!['monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

  // In production: create Stripe customer + subscription
  // For demo: simulate successful payment
  const periodEnd = plan === 'monthly'
    ? new Date(Date.now() + 30 * 86400000).toISOString()
    : new Date(Date.now() + 365 * 86400000).toISOString();

  db.prepare(`UPDATE users SET subscription_status='active', subscription_plan=?, current_period_end=?, updated_at=datetime('now') WHERE id=?`)
    .run(plan, periodEnd, req.user.id);

  // Log payment
  db.prepare('INSERT INTO payments (user_id, amount, plan, status) VALUES (?,?,?,?)').run(req.user.id, PRICES[plan], plan, 'paid');

  // Record charity contribution
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const contribAmount = (PRICES[plan] * (user.charity_percentage || 10) / 100).toFixed(2);
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  db.prepare('INSERT INTO charity_contributions (user_id, charity_id, amount, month) VALUES (?,?,?,?)').run(req.user.id, user.charity_id, contribAmount, month);

  // Update charity raised total
  if (user.charity_id) db.prepare('UPDATE charities SET total_raised = total_raised + ? WHERE id = ?').run(parseFloat(contribAmount), user.charity_id);

  sendEmail(user.email, 'subscriptionConfirm', user.name, plan, PRICES[plan]).catch(() => {});

  res.json({
    message: 'Subscription activated',
    user: db.prepare('SELECT id,name,email,role,subscription_status,subscription_plan,current_period_end,charity_id,charity_percentage FROM users WHERE id=?').get(req.user.id)
  });
});

// POST /api/subscriptions/cancel
router.post('/cancel', authenticate, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE users SET subscription_status='cancelled', updated_at=datetime('now') WHERE id=?").run(req.user.id);
  res.json({ message: 'Subscription cancelled. Access continues until period end.' });
});

// POST /api/subscriptions/reactivate
router.post('/reactivate', authenticate, (req, res) => {
  const db = getDb();
  const { plan } = req.body;
  if (!['monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  const periodEnd = plan === 'monthly'
    ? new Date(Date.now() + 30 * 86400000).toISOString()
    : new Date(Date.now() + 365 * 86400000).toISOString();
  db.prepare("UPDATE users SET subscription_status='active', subscription_plan=?, current_period_end=?, updated_at=datetime('now') WHERE id=?").run(plan, periodEnd, req.user.id);
  res.json({ message: 'Subscription reactivated' });
});

// GET /api/subscriptions/status
router.get('/status', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT subscription_status, subscription_plan, current_period_end FROM users WHERE id = ?').get(req.user.id);
  const payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(req.user.id);
  res.json({ ...user, payments });
});

// GET /api/subscriptions/contributions
router.get('/contributions', authenticate, (req, res) => {
  const db = getDb();
  const contributions = db.prepare(`
    SELECT cc.*, c.name as charity_name, c.emoji FROM charity_contributions cc
    JOIN charities c ON cc.charity_id = c.id
    WHERE cc.user_id = ? ORDER BY cc.created_at DESC
  `).all(req.user.id);
  const total = contributions.reduce((s, c) => s + c.amount, 0);
  res.json({ contributions, total: parseFloat(total.toFixed(2)) });
});

module.exports = router;
