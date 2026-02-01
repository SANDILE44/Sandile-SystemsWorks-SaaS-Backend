const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const auth = require('../middleware/auth');
const paid = require('../middleware/paid');

const { sendResetEmail } = require('../utils/sendResetEmail');

// ====================
// SIGNUP
// ====================
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
      hasPaid: false,
      trialEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'secret123',
      {
        expiresIn: '7d',
      }
    );

    res.status(201).json({
      message: 'User registered (3-day free trial)',
      token,
      userId: user._id,
      trialEnd: user.trialEnd,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// LOGIN
// ====================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'secret123',
      {
        expiresIn: '7d',
      }
    );

    res.json({
      message: 'Login successful',
      token,
      hasPaid: user.hasPaid,
      trialEnd: user.trialEnd,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// FORGOT PASSWORD (NOW SENDS EMAIL)
// ====================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  // Always respond same to avoid leaking user existence
  const safeMsg = { message: 'If the email exists, a reset link was sent.' };
  if (!email) return res.json(safeMsg);

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json(safeMsg);

    const token = crypto.randomBytes(32).toString('hex');

    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    await user.save();

    const base = process.env.FRONTEND_RESET_URL;
    // Example: https://sandile44.github.io/Sandile-SystemsWorks-SaaS-Frontend/reset-password.html
    const resetUrl = `${base}?token=${token}`;

    await sendResetEmail(user.email, resetUrl);

    return res.json(safeMsg);
  } catch (err) {
    // Keep response generic for security
    return res.json(safeMsg);
  }
});

// ====================
// RESET PASSWORD
// ====================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password required' });
  }

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// PROFILE
// ====================
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================
// PAID-ONLY ROUTE (TEST)
// ====================
router.get('/dashboard', auth, paid, (req, res) => {
  res.json({ message: 'Welcome to paid dashboard' });
});

module.exports = router;

//Time And recent dashboard
// routes/authRoutes.js (PROFILE)
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'name email hasPaid trialEnd subscriptionEnd recentCalculators'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        name: user.name,
        email: user.email,
        hasPaid: user.hasPaid,
        trialEnd: user.trialEnd,
        subscriptionEnd: user.subscriptionEnd,
        recentCalculators: user.recentCalculators || [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
