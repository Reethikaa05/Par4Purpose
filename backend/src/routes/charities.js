const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

const router = express.Router();

// GET /api/charities - public list
router.get('/', (req, res) => {
  const db = getDb();
  const { search, category } = req.query;
  let query = 'SELECT * FROM charities';
  const params = [];
  const conditions = [];
  if (search) { conditions.push('(name LIKE ? OR description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY is_featured DESC, total_raised DESC';
  res.json({ charities: db.prepare(query).all(...params) });
});

// GET /api/charities/featured
router.get('/featured', (req, res) => {
  const db = getDb();
  const featured = db.prepare("SELECT * FROM charities WHERE is_featured = 1 LIMIT 1").get();
  res.json({ charity: featured });
});

// GET /api/charities/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const charity = db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id);
  if (!charity) return res.status(404).json({ error: 'Charity not found' });
  const memberCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE charity_id = ? AND subscription_status = 'active'").get(req.params.id);
  res.json({ charity, memberCount: memberCount.count });
});

// POST /api/charities - admin create
router.post('/', authenticate, requireAdmin, [
  body('name').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('category').trim().notEmpty(),
  body('emoji').optional().trim(),
  body('image_url').optional().trim().custom(value => {
    if (!value) return true;
    return /^(https?:\/\/|\/uploads\/)/.test(value);
  }),
  body('website').optional().trim().isURL(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const db = getDb();
  const { name, emoji, description, category, image_url, website, total_raised = 0, is_featured = 0 } = req.body;
  const result = db.prepare('INSERT INTO charities (name, emoji, description, category, image_url, website, total_raised, is_featured) VALUES (?,?,?,?,?,?,?,?)').run(name, emoji || '💚', description, category, image_url || null, website || null, total_raised, is_featured ? 1 : 0);
  res.status(201).json({ charity: db.prepare('SELECT * FROM charities WHERE id = ?').get(result.lastInsertRowid) });
});

// POST /api/charities/upload - admin upload charity image
router.post('/upload', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image file required' });
  res.json({ image_url: `/uploads/${req.file.filename}` });
});

// PUT /api/charities/:id - admin update
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const charity = db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id);
  if (!charity) return res.status(404).json({ error: 'Charity not found' });
  const { name, emoji, description, category, image_url, website, total_raised, is_featured } = req.body;
  db.prepare('UPDATE charities SET name=COALESCE(?,name), emoji=COALESCE(?,emoji), description=COALESCE(?,description), category=COALESCE(?,category), image_url=COALESCE(?,image_url), website=COALESCE(?,website), total_raised=COALESCE(?,total_raised), is_featured=COALESCE(?,is_featured) WHERE id=?')
    .run(name||null, emoji||null, description||null, category||null, image_url||null, website||null, total_raised??null, is_featured!==undefined?is_featured?1:0:null, req.params.id);
  res.json({ charity: db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id) });
});

// DELETE /api/charities/:id/image - admin delete charity image
router.delete('/:id/image', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const charity = db.prepare('SELECT * FROM charities WHERE id = ?').get(req.params.id);
  if (!charity) return res.status(404).json({ error: 'Charity not found' });
  if (!charity.image_url || !charity.image_url.startsWith('/uploads/')) return res.status(400).json({ error: 'No uploaded image to delete' });
  const filePath = path.join(process.cwd(), charity.image_url);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  db.prepare('UPDATE charities SET image_url = NULL WHERE id = ?').run(req.params.id);
  res.json({ message: 'Image deleted' });
});

module.exports = router;
