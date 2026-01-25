const express = require('express');
const router = express.Router();
const axios = require('axios');

const auth = require('../middleware/auth');
const User = require('../models/User');

router.post('/checkout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.hasPaid) return res.status(400).json({ error: 'User already paid' });

    // amount in cents → R12499 = 1249900 cents
    const response = await axios.post(
      'https://payments.yoco.com/api/checkouts',
      {
        amount: 1249900, 
        currency: 'ZAR',
        successUrl: process.env.FRONTEND_SUCCESS_URL,
        cancelUrl: process.env.FRONTEND_CANCEL_URL,
        metadata: { userId: user._id.toString(), email: user.email }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // redirect URL your frontend can open
    res.json({ checkoutUrl: response.data.redirectUrl });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// ====================
// CONFIRM PAYMENT
// ====================
router.post('/confirm', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 🔴 IMPORTANT: use SAME field name everywhere
    user.hasPaid = true;
    user.paidAt = new Date();

    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Payment confirm error:', err.message);
    res.status(500).json({ error: 'Payment confirmation failed' });
  }
});

module.exports = router;