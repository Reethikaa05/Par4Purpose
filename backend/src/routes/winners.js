const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

const router = express.Router();

// GET /api/winners/my - get my winnings
router.get('/my', authenticate, (req, res) => {
  const db = getDb();
  const winners = db.prepare(`
    SELECT w.*, d.month, d.numbers FROM winners w
    JOIN draws d ON w.draw_id = d.id
    WHERE w.user_id = ? ORDER BY w.created_at DESC
  `).all(req.user.id);
  const total = winners.filter(w => w.payment_status === 'paid').reduce((s, w) => s + w.prize_amount, 0);
  res.json({ winners, total: parseFloat(total.toFixed(2)) });
});

// POST /api/winners/:id/upload-proof - user uploads proof
router.post('/:id/upload-proof', authenticate, upload.single('proof'), (req, res) => {
  const db = getDb();
  const winner = db.prepare('SELECT * FROM winners WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!winner) return res.status(404).json({ error: 'Winner record not found' });
  if (!req.file) return res.status(400).json({ error: 'Proof file required' });
  db.prepare("UPDATE winners SET proof_url = ?, verification_status = 'submitted' WHERE id = ?").run(req.file.filename, winner.id);
  res.json({ message: 'Proof uploaded. Admin will review within 48 hours.' });
});

// GET /api/winners - admin list all winners
router.get('/', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { status } = req.query;
  let query = `SELECT w.*, u.name as user_name, u.email as user_email, d.month FROM winners w JOIN users u ON w.user_id = u.id JOIN draws d ON w.draw_id = d.id`;
  if (status) query += ` WHERE w.verification_status = '${status}'`;
  query += ' ORDER BY w.created_at DESC';
  res.json({ winners: db.prepare(query).all() });
});

// PUT /api/winners/:id/verify - admin approve or reject
router.put('/:id/verify', authenticate, requireAdmin, async (req, res) => {
  const db = getDb();
  const { action, note } = req.body; // action: 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });

  const winner = db.prepare(`SELECT w.*, u.name, u.email FROM winners w JOIN users u ON w.user_id = u.id WHERE w.id = ?`).get(req.params.id);
  if (!winner) return res.status(404).json({ error: 'Winner not found' });

  if (action === 'approve') {
    db.prepare("UPDATE winners SET verification_status='approved', payment_status='processing', admin_note=? WHERE id=?").run(note || null, winner.id);
    sendEmail(winner.email, 'winnerVerified', winner.name, winner.prize_amount.toFixed(2)).catch(() => {});
  } else {
    db.prepare("UPDATE winners SET verification_status='rejected', admin_note=? WHERE id=?").run(note || 'Proof not accepted', winner.id);
  }
  res.json({ message: `Winner ${action}d` });
});

// PUT /api/winners/:id/payout - admin mark as paid
router.put('/:id/payout', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const winner = db.prepare('SELECT * FROM winners WHERE id = ?').get(req.params.id);
  if (!winner) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE winners SET payment_status='paid', paid_at=datetime('now') WHERE id=?").run(winner.id);
  res.json({ message: 'Payout marked as completed' });
});

module.exports = router;
