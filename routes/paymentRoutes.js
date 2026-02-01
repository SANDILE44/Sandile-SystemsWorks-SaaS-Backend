// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const auth = require('../middleware/auth'); // JWT auth
const User = require('../models/User'); // User model
const { applyThirtyDaySubscription } = require('../utils/subscription');

// ====================
// CREATE YOCO CHECKOUT
// ====================
router.post('/checkout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.hasPaid)
      return res.status(400).json({ error: 'User already paid' });

    const amount = process.env.SUBSCRIPTION_AMOUNT
      ? parseInt(process.env.SUBSCRIPTION_AMOUNT, 10)
      : 5000;

    const yocoPayload = {
      amount,
      currency: 'ZAR',
      successUrl: process.env.FRONTEND_SUCCESS_URL,
      cancelUrl: process.env.FRONTEND_CANCEL_URL,
      metadata: {
        userId: user._id.toString(),
        email: user.email,
      },
    };

    const response = await axios.post(
      'https://payments.yoco.com/api/checkouts',
      yocoPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.YOCO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      checkoutUrl: response.data.redirectUrl,
      checkoutId: response.data.id,
    });
  } catch (err) {
    console.error('💥 YOCO checkout error:', err.response?.data || err.message);
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

    applyThirtyDaySubscription(user);
    await user.save();

    res.json({
      success: true,
      hasPaid: true,
      subscriptionEnd: user.subscriptionEnd,
    });
  } catch (err) {
    res.status(500).json({ error: 'Payment confirmation failed' });
  }
});

module.exports = router;
