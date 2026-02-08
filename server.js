import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

import { connectDB } from './config/db.js';
import { loadEnv } from './config/env.js';

// ROUTES (ONLY ACTIVE ONES)
import authRoutes from './routes/auth.routes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import calculatorsRoutes from './routes/calculatorRoutes.js';

// =======================
// INIT
// =======================
loadEnv();
const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// MIDDLEWARE
// =======================
app.use(
  cors({
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'https://sandile44.github.io',
    ],
    credentials: true,
  })
);

app.use(express.json());

// =======================
// HEALTH CHECK (ROOT)
// =======================
app.get('/', (req, res) => {
  res.json({ status: 'Sandile SystemsWorks API running' });
});

// =======================
// API ROUTES
// =======================

// Auth & payments
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);

// Calculators
app.use('/api/calculators', calculatorsRoutes);

// =======================
// START SERVER
// =======================
try {
  await connectDB();

  app.listen(PORT, () => {
    console.log('✅ MongoDB connected');
    console.log(`🚀 Server running on port ${PORT}`);
  });
} catch (err) {
  console.error('❌ Startup failed:', err.message);
  process.exit(1);
}
