const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const { applyThirtyDaySubscription } = require('../utils/subscription');

router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-yoco-signature'];
    const payload = req.body;

    const hmac = crypto.createHmac('sha256', process.env.YOCO_WEBHOOK_SECRET);
    hmac.update(JSON.stringify(payload));
    const digest = hmac.digest('hex');

    if (digest !== signature) {
      console.warn('❌ Invalid webhook signature');
      return res.sendStatus(400);
    }

    if (payload?.event?.type === 'checkout.completed') {
      const checkout = payload.event.data;
      const userId = checkout?.metadata?.userId;

      if (!userId) return res.sendStatus(200);

      const user = await User.findById(userId);
      if (user) {
        applyThirtyDaySubscription(user);
        await user.save();
        console.log(`✅ Subscription updated for ${user.email}`);
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.sendStatus(500);
  }
});

module.exports = router;
