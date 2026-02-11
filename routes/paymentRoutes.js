import express from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/* =========================
   CREATE CHECKOUT
========================= */
router.post('/checkout', auth, async (req, res) => {
  try {
    if (!process.env.YOCO_SECRET_KEY) {
      return res.status(500).json({ error: 'YOCO_SECRET_KEY missing' });
    }

    const amount = 1249900; // R12,499 in cents

    const response = await axios.post(
      'https://payments.yoco.com/api/checkouts',
      {
        amount,
        currency: 'ZAR',
        successUrl: process.env.FRONTEND_SUCCESS_URL,
        cancelUrl: process.env.FRONTEND_CANCEL_URL,
        metadata: {
          userId: req.user.id,
          product: 'calculators',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      checkoutUrl: response.data.redirectUrl,
      checkoutId: response.data.id,
    });
  } catch (err) {
    console.error('YOCO checkout error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

/* =========================
   CONFIRM PAYMENT
========================= */
router.post('/confirm', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

    user.subscriptions = user.subscriptions || {};

    user.subscriptions.calculators = {
      status: 'active',
      subscriptionEnd,
    };

    await user.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Payment confirm error:', err.message);
    res.status(500).json({ error: 'Payment confirmation failed' });
  }
});

export default router;
