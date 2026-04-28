const app = require('../backend/src/server.js');
const { initPromise } = require('../backend/src/db/database.js');

module.exports = async (req, res) => {
  try {
    await initPromise;
    return app(req, res);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ 
      error: 'Initialization failed', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      path: __dirname,
      cwd: process.cwd()
    });
  }
};
