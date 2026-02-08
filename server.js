import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { loadEnv } from './config/env.js';

import authRoutes from './routes/auth.routes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import calculatorsRoutes from './routes/calculatorRoutes.js';
import websitesRoutes from './routes/websites.routes.js';
import scansRoutes from './routes/scans.routes.js';
import reportsRoutes from './routes/reports.routes.js';

import { startScheduler } from './services/monitoring/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// STATIC FRONTEND
// =======================
app.use(express.static(path.join(__dirname, '../frontend')));

// Optional: default landing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

// =======================
// API ROUTES
// =======================

// Auth & payments
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);

// Calculators
app.use('/api/calculators', calculatorsRoutes);

// Risk Monitor
app.use('/api/websites', websitesRoutes);
app.use('/api/scans', scansRoutes);
app.use('/api/reports', reportsRoutes);

// =======================
// START SERVER
// =======================
try {
  await connectDB();
  startScheduler();

  app.listen(PORT, () => {
    console.log('✅ MongoDB connected');
    console.log(
      `[scheduler] Running every ${process.env.SCAN_INTERVAL_HOURS || 24}h`
    );
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('❌ Startup failed:', err.message);
  process.exit(1);
}
