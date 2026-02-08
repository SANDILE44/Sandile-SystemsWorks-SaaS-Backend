import express from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/checkout', auth, async (req, res) => {
  try {
    if (!process.env.YOCO_API_KEY) {
      return res.status(500).json({ error: 'YOCO_API_KEY missing' });
    }
    if (!process.env.FRONTEND_SUCCESS_URL || !process.env.FRONTEND_CANCEL_URL) {
      return res.status(500).json({ error: 'Success/Cancel URLs missing' });
    }

    const amount = Number(process.env.SUBSCRIPTION_AMOUNT || 1249900);

    const response = await axios.post(
      'https://payments.yoco.com/api/checkouts',
      {
        amount,
        currency: 'ZAR',
        successUrl: process.env.FRONTEND_SUCCESS_URL,
        cancelUrl: process.env.FRONTEND_CANCEL_URL,
        metadata: { userId: req.user.id, product: 'calculators' },
      },
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
    res.status(500).json({ error: 'Checkout failed' });
  }
});

export default router;
