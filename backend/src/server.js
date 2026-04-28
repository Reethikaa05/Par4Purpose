require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads dir exists (use /tmp on Vercel as it's the only writable directory)
const uploadDir = process.env.VERCEL 
  ? path.join('/tmp', 'uploads')
  : path.resolve(process.env.UPLOAD_DIR || './uploads');

try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (err) {
  console.warn('Failed to create upload directory:', err.message);
}

// Security & middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: true,
  credentials: true,
}));

const JWT_SECRET = process.env.JWT_SECRET || 'golfgives-dev-secret-key-12345';
process.env.JWT_SECRET = JWT_SECRET;

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many requests' } }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: 'Too many requests' } }));

// Static file serving for uploads
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/draws', require('./routes/draws'));
app.use('/api/charities', require('./routes/charities'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/winners', require('./routes/winners'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const { initPromise } = require('./db/database');
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  initPromise.then(() => {
    app.listen(PORT, () => {
      console.log(`\n🏌️  GolfGives API running on http://localhost:${PORT}`);
      console.log(`📚  Health: http://localhost:${PORT}/api/health\n`);
    });
  });
}

module.exports = app;
