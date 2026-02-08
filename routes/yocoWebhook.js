import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';

const router = express.Router();

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const signature = req.headers['x-yoco-signature'];
      const payload = req.body;

      const hmac = crypto.createHmac('sha256', process.env.YOCO_WEBHOOK_SECRET);
      hmac.update(payload);
      const digest = hmac.digest('hex');

      if (digest !== signature) {
        console.warn('❌ Invalid YOCO webhook signature');
        return res.sendStatus(400);
      }

      const event = JSON.parse(payload.toString());

      if (event?.event?.type !== 'checkout.completed') {
        return res.sendStatus(200);
      }

      const data = event.event.data;
      const userId = data?.metadata?.userId;
      const product = data?.metadata?.product;

      if (!userId || !product) return res.sendStatus(200);

      const user = await User.findById(userId);
      if (!user) return res.sendStatus(200);

      const sub = user.subscriptions?.[product];
      if (!sub) return res.sendStatus(200);

      const now = Date.now();

      sub.status = 'active';
      sub.subscriptionEnd = new Date(now + 30 * 24 * 60 * 60 * 1000);

      // reset trial-only counters
      if (product === 'riskMonitor') {
        sub.scansToday = 0;
        sub.scansResetAt = new Date();
      }

      await user.save();

      console.log(`✅ ${product} activated for ${user.email}`);

      return res.sendStatus(200);
    } catch (err) {
      console.error('YOCO webhook error:', err.message);
      return res.sendStatus(500);
    }
  }
);

export default router;
