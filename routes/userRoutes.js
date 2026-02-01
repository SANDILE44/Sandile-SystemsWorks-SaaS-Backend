// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const auth = require('../middleware/auth');
const paid = require('../middleware/paid');

const { sendResetEmail } = require('../utils/sendResetEmail');

// ✅ ADD THIS LINE RIGHT HERE
console.log('✅ userRoutes v2 deployed:', {
  userModelType: typeof User,
  hasFindOne: typeof User?.findOne,
});

// helper
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '7d',
  });
}

// ====================
// SIGNUP
// ====================
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser)
      return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      hasPaid: false,
      trialEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    });

    const token = signToken(user._id);

    return res.status(201).json({
      message: 'User registered (3-day free trial)',
      token,
      userId: user._id,
      trialEnd: user.trialEnd,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = signToken(user._id);

    return res.json({
      message: 'Login successful',
      token,
      hasPaid: user.hasPaid,
      trialEnd: user.trialEnd,
      subscriptionEnd: user.subscriptionEnd || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ====================
// FORGOT PASSWORD
// ====================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

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
    if (!base) return res.json(safeMsg);

    const resetUrl = `${base}?token=${token}`;

    // If domain is not verified yet, this may fail silently depending on your implementation.
    await sendResetEmail(user.email, resetUrl);

    return res.json(safeMsg);
  } catch (err) {
    return res.json(safeMsg);
  }
});

// ====================
// RESET PASSWORD
// ====================
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required' });
  }

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user)
      return res.status(400).json({ error: 'Invalid or expired token' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ====================
// PROFILE
// ====================
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'name email hasPaid trialEnd subscriptionEnd recentCalculators'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
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
    return res.status(500).json({ error: err.message });
  }
});

// ====================
// PAID/TRIAL ACCESS TEST
// ====================
router.get('/dashboard', auth, paid, (req, res) => {
  return res.json({ message: 'Welcome to paid dashboard' });
});

// ====================
// DEBUG (TEMPORARY)
// ====================
router.get('/_debug-user-model', (req, res) => {
  res.json({
    typeofUser: typeof User,
    hasFindOne: typeof User?.findOne,
    hasFindById: typeof User?.findById,
  });
});

module.exports = router;
