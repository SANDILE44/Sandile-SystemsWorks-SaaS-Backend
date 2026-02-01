// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
console.log('✅ DEPLOY MARKER: 2026-02-01 v3');

const PORT = process.env.PORT || 10000;

// =======================
// Webhook route (RAW BODY FIRST)
// =======================
app.use(
  '/api/webhooks',
  express.raw({ type: 'application/json' }),
  require('./routes/yocoWebhook')
);

// =======================
// Standard Middleware
// =======================
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());

// =======================
// MongoDB Connection
// =======================
const dbURI = process.env.MONGO_URI;

if (!dbURI) {
  console.warn('⚠️ MONGO_URI not found. Waiting for environment injection...');
} else {
  mongoose
    .connect(dbURI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
}

// =======================
// Health Check Routes
// =======================
app.get('/', (req, res) => {
  res.send('Backend is alive!');
});

app.get('/test-db', async (req, res) => {
  try {
    if (!mongoose.connection.readyState) {
      return res.status(503).json({ error: 'MongoDB not connected yet' });
    }

    const adminDb = mongoose.connection.db.admin();
    const info = await adminDb.serverStatus();
    res.json({ message: 'MongoDB connected!', info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/_deploy-check', (req, res) => {
  res.send('deploy-check-2026-02-01-v3');
});

// =======================
// API Routes
// =======================
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/users', require('./routes/recentCalculators'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/calculators', require('./routes/calculatorRoutes'));

// =======================
// Start Server (LAST)
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
