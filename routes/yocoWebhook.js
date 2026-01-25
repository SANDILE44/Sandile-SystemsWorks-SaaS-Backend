// routes/yocoWebhook.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');

router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-yoco-signature'];
    const payload = req.body; // raw body (express.raw)

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.YOCO_WEBHOOK_SECRET);
    hmac.update(JSON.stringify(payload));
    const digest = hmac.digest('hex');

    if (digest !== signature) {
      console.warn('❌ Invalid webhook signature');
      return res.sendStatus(400);
    }

    // Filter only completed checkouts
    if (payload.event && payload.event.type === 'checkout.completed') {
      const checkout = payload.event.data;
      const userId = checkout.metadata.userId;

      const user = await User.findById(userId);
      if (user) {
        user.hasPaid = true;
        await user.save();
        console.log(`✅ User ${user.email} marked as paid`);
      }
    }

    res.sendStatus(200); // acknowledge webhook
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;
