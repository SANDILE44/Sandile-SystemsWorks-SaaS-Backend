import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';

const router = express.Router();

// ... (Your imports)

router.post(
  '/',
  express.raw({ type: 'application/json' }), // Essential for signature verification
  async (req, res) => {
    try {
      const signature = req.headers['x-yoco-signature'];
      const payload = req.body;

      // Verify it's actually Yoco calling
      const hmac = crypto.createHmac('sha256', process.env.YOCO_WEBHOOK_SECRET);
      hmac.update(payload);
      const digest = hmac.digest('hex');

      if (digest !== signature) {
        return res.status(400).send('Invalid Signature');
      }

      const event = JSON.parse(payload.toString());

      // Only care about successful payments
      if (event?.event?.type !== 'checkout.completed') {
        return res.sendStatus(200); 
      }

      const { userId, product } = event.event.data.metadata;

      const user = await User.findById(userId);
      if (!user) return res.sendStatus(200);

      const sub = user.subscriptions[product];
      
      // Update to ACTIVE status
      sub.status = 'active';
      sub.trialEnd = null; // Clear trial status

      // Use the 'setMonth' logic for precise billing
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);
      sub.subscriptionEnd = expiry;

      if (product === 'riskMonitor') {
        sub.scansToday = 0;
        sub.scansResetAt = new Date();
      }

      await user.save();
      console.log(`💰 PAYMENT RECEIVED: ${product} activated for ${user.email}`);

      res.sendStatus(200);
    } catch (err) {
      console.error('Webhook processing failed:', err.message);
      res.sendStatus(500);
    }
  }
);

export default router;
