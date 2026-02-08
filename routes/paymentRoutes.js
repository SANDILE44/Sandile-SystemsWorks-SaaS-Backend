import express from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * POST /api/payments/checkout
 * Purpose: create checkout for calculators ONLY
 */
router.post('/checkout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const payload = {
      amount: 1249900,
      currency: 'ZAR',
      successUrl: process.env.FRONTEND_SUCCESS_URL,
      cancelUrl: process.env.FRONTEND_CANCEL_URL,
      metadata: { userId: user._id.toString() },
    };

    const response = await axios.post(
      'https://payments.yoco.com/api/checkouts',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.YOCO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ checkoutUrl: response.data.redirectUrl });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

export default router;
