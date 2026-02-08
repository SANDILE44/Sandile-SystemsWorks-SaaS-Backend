import express from 'express';
import axios from 'axios';

import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * POST /api/payments/checkout
 * body: { product: 'calculators' | 'riskMonitor' }
 */
router.post('/checkout', auth, async (req, res) => {
  try {
    const { product } = req.body;

    if (!['calculators', 'riskMonitor'].includes(product)) {
      return res.status(400).json({ error: 'Invalid product' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sub = user.subscriptions?.[product];
    if (!sub) return res.status(400).json({ error: 'Product unavailable' });

    if (sub.status === 'active') {
      return res.status(400).json({ error: 'Product already active' });
    }

    const amount =
      product === 'riskMonitor'
        ? 229900 // R2,299
        : 1249900; // R12,499 calculators

    const payload = {
      amount,
      currency: 'ZAR',
      successUrl: process.env.FRONTEND_SUCCESS_URL,
      cancelUrl: process.env.FRONTEND_CANCEL_URL,
      metadata: {
        userId: user._id.toString(),
        product,
      },
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

    res.json({
      checkoutUrl: response.data.redirectUrl,
      checkoutId: response.data.id,
    });
  } catch (err) {
    console.error('YOCO checkout error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

export default router;
