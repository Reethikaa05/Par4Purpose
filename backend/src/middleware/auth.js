const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

const requireSubscription = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.user.subscription_status !== 'active') {
    return res.status(403).json({ error: 'Active subscription required', code: 'SUBSCRIPTION_REQUIRED' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireSubscription };
