const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireSubscription } = require('../middleware/auth');

const router = express.Router();
const MAX_SCORES = 5;

// GET /api/scores - get my scores
router.get('/', authenticate, requireSubscription, (req, res) => {
  const db = getDb();
  const scores = db.prepare(`
    SELECT * FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT ?
  `).all(req.user.id, MAX_SCORES);
  res.json({ scores });
});

// POST /api/scores - add a score
router.post('/', authenticate, requireSubscription, [
  body('value').isInt({ min: 1, max: 45 }).withMessage('Score must be between 1 and 45'),
  body('date').isDate().withMessage('Valid date required (YYYY-MM-DD)'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const { value, date } = req.body;
  const userId = req.user.id;

  // Check for duplicate date
  const existing = db.prepare('SELECT id FROM scores WHERE user_id = ? AND date = ?').get(userId, date);
  if (existing) return res.status(409).json({ error: 'A score for this date already exists. Edit or delete it instead.' });

  // Insert new score
  db.prepare('INSERT INTO scores (user_id, value, date) VALUES (?, ?, ?)').run(userId, value, date);

  // Enforce rolling 5-score window - delete oldest beyond 5
  const allScores = db.prepare('SELECT id FROM scores WHERE user_id = ? ORDER BY date DESC').all(userId);
  if (allScores.length > MAX_SCORES) {
    const toDelete = allScores.slice(MAX_SCORES).map(s => s.id);
    const placeholders = toDelete.map(() => '?').join(',');
    db.prepare(`DELETE FROM scores WHERE id IN (${placeholders})`).run(...toDelete);
  }

  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT ?').all(userId, MAX_SCORES);
  res.status(201).json({ message: 'Score added successfully', scores });
});

// PUT /api/scores/:id - edit a score
router.put('/:id', authenticate, requireSubscription, [
  param('id').isInt(),
  body('value').optional().isInt({ min: 1, max: 45 }),
  body('date').optional().isDate(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const score = db.prepare('SELECT * FROM scores WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!score) return res.status(404).json({ error: 'Score not found' });

  const { value, date } = req.body;

  // Check date conflict (exclude current score)
  if (date && date !== score.date) {
    const conflict = db.prepare('SELECT id FROM scores WHERE user_id = ? AND date = ? AND id != ?').get(req.user.id, date, score.id);
    if (conflict) return res.status(409).json({ error: 'A score for this date already exists.' });
  }

  const newValue = value ?? score.value;
  const newDate = date ?? score.date;
  db.prepare('UPDATE scores SET value = ?, date = ? WHERE id = ?').run(newValue, newDate, score.id);

  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT ?').all(req.user.id, MAX_SCORES);
  res.json({ message: 'Score updated', scores });
});

// DELETE /api/scores/:id
router.delete('/:id', authenticate, requireSubscription, (req, res) => {
  const db = getDb();
  const score = db.prepare('SELECT * FROM scores WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!score) return res.status(404).json({ error: 'Score not found' });

  db.prepare('DELETE FROM scores WHERE id = ?').run(score.id);
  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY date DESC LIMIT ?').all(req.user.id, MAX_SCORES);
  res.json({ message: 'Score deleted', scores });
});

// GET /api/scores/admin/:userId - admin view any user's scores
router.get('/admin/:userId', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDb();
  const scores = db.prepare('SELECT * FROM scores WHERE user_id = ? ORDER BY date DESC').all(req.params.userId);
  res.json({ scores });
});

module.exports = router;
