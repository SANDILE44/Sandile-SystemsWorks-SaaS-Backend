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

    // R12,499.00 in cents
    const amount = 1249900; 

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
      id: response.data.id, // Important for verification
    });
  } catch (err) {
    console.error('YOCO checkout error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

/* =========================
   CONFIRM PAYMENT (SECURE)
========================= */
router.post('/confirm', auth, async (req, res) => {
  const { checkoutId } = req.body;

  if (!checkoutId) {
    return res.status(400).json({ error: 'Checkout ID is required' });
  }

  try {
    // 1. Verify payment status directly with Yoco
    const yocoResponse = await axios.get(
      `https://payments.yoco.com/api/checkouts/${checkoutId}`,
      {
        headers: { Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}` },
      }
    );

    const paymentStatus = yocoResponse.data.status;

    // 2. Only update DB if Yoco confirms the money was "successful"
    if (paymentStatus !== 'successful') {
      return res.status(400).json({ error: 'Payment has not been completed' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 3. Set subscription end date (1 month from now)
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

    user.subscriptions.calculators = {
      status: 'active',
      subscriptionEnd,
      trialEnd: null // Wipe the trial date once they pay
    };

    await user.save();

    res.json({ 
      success: true, 
      message: 'Subscription activated successfully' 
    });
    
  } catch (err) {
    console.error('Payment confirm error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
