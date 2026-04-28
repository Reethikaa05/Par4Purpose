const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function safeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
  body('plan').isIn(['monthly', 'yearly']).withMessage('Invalid plan'),
  body('charityId').isInt({ min: 1 }).withMessage('Charity ID required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, plan, charityId, charityPercentage = 10 } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const charity = db.prepare('SELECT id FROM charities WHERE id = ?').get(charityId);
  if (!charity) return res.status(400).json({ error: 'Charity not found' });

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, subscription_status, subscription_plan, charity_id, charity_percentage)
    VALUES (?, ?, ?, ?, 'user', 'inactive', ?, ?, ?)
  `).run(id, name, email, passwordHash, plan, charityId, Math.min(100, Math.max(10, charityPercentage)));

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = generateToken(user);

  sendEmail(email, 'welcome', name).catch(() => {});

  res.status(201).json({ token, user: safeUser(user) });
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken(user);
  res.json({ token, user: safeUser(user) });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('charityId').optional().isInt({ min: 1 }),
  body('charityPercentage').optional().isFloat({ min: 10, max: 100 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { name, charityId, charityPercentage } = req.body;
  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (charityId) {
    const c = db.prepare('SELECT id FROM charities WHERE id = ?').get(charityId);
    if (!c) return res.status(400).json({ error: 'Charity not found' });
    updates.push('charity_id = ?'); values.push(charityId);
  }
  if (charityPercentage !== undefined) {
    updates.push('charity_percentage = ?'); values.push(Math.min(100, Math.max(10, charityPercentage)));
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  updates.push("updated_at = datetime('now')");
  values.push(req.user.id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: safeUser(updated) });
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = await bcrypt.compare(req.body.currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' });

  const newHash = await bcrypt.hash(req.body.newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
