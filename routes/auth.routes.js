import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import User from '../models/User.js';
import auth from '../middleware/auth.js';

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

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 3);
    trialEnd.setHours(23, 59, 59, 999);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,

      // 🔑 THESE ARE WHAT YOUR CALCULATORS USE
      hasPaid: false,
      trialEnd,
      subscriptionEnd: null,
    });

    const token = signToken(user._id);

    res.status(201).json({
      message: 'Signup successful (3-day trial)',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        hasPaid: user.hasPaid,
        trialEnd: user.trialEnd,
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
   PROFILE (AUTH REQUIRED)
========================= */
router.get('/profile', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select(
    'name email subscriptions recentCalculators'
  );

  res.json({ user });
});

export default router;
