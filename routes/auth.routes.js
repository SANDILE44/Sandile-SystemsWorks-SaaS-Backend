import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import User from '../models/User.js';
import auth from '../middleware/auth.js';
import { sendResetEmail } from '../utils/sendResetEmail.js';

const router = express.Router();

/* =========================
   JWT HELPER
========================= */
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

/* =========================
   SIGNUP (3-DAY TRIAL)
========================= */
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();

    const exists = await User.findOne({ email: cleanEmail });
    if (exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const now = Date.now();
    const trialEnd = new Date(now + 3 * 24 * 60 * 60 * 1000);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      subscriptions: {
        calculators: {
          status: 'trial',
          trialEnd,
        },
        riskMonitor: {
          status: 'trial',
          trialEnd,
          scansToday: 0,
          scansResetAt: new Date(),
        },
      },
    });

    const token = signToken(user._id);

    res.status(201).json({
      message: 'Signup successful (3-day trial)',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptions: user.subscriptions,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

/* =========================
   LOGIN
========================= */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = signToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptions: user.subscriptions,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/* =========================
   FORGOT PASSWORD
========================= */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const safe = { message: 'If the email exists, a reset link was sent.' };

  if (!email) return res.json(safe);

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json(safe);

    const token = crypto.randomBytes(32).toString('hex');

    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.FRONTEND_RESET_URL}?token=${token}`;
    await sendResetEmail(user.email, resetUrl);

    res.json(safe);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.json(safe);
  }
});

/* =========================
   PROFILE (AUTH REQUIRED)
========================= */
router.get('/profile', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select(
    'name email subscriptions recentCalculators'
  );

  res.json({ user });
});

export default router;
