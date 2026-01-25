// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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
app.use(cors());
app.use(express.json());

// =======================
// MongoDB Connection
// =======================
const dbURI = process.env.DB_URI;

if (!dbURI) {
  console.error('❌ No MongoDB URI defined in .env');
  process.exit(1);
}

mongoose
  .connect(dbURI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// =======================
// Health Check Routes
// =======================
app.get('/', (req, res) => {
  res.send('Backend is alive!');
});

app.get('/test-db', async (req, res) => {
  try {
    const adminDb = mongoose.connection.db.admin();
    const info = await adminDb.serverStatus();
    res.json({ message: 'MongoDB connected!', info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// API Routes
// =======================
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/calculators', require('./routes/calculatorRoutes'));

// =======================
// Start Server
// =======================
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

