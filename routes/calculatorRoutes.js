import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /api/calculators/access
 * Purpose: allow calculator usage if trial OR paid
 */
router.get('/access', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const sub = user.subscriptions?.calculators;
    if (!sub) return res.status(403).json({ error: 'No calculator access' });

    const now = Date.now();

    const trialActive =
      sub.status === 'trial' &&
      sub.trialEnd &&
      now < new Date(sub.trialEnd).getTime();

    const paidActive =
      sub.status === 'active' &&
      sub.subscriptionEnd &&
      now < new Date(sub.subscriptionEnd).getTime();

    if (trialActive || paidActive) {
      return res.json({ access: true });
    }

    return res.status(403).json({ error: 'Access expired' });
  } catch (err) {
    res.status(500).json({ error: 'Access check failed' });
  }
});

export default router;
