import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

function isActive(sub) {
  const now = Date.now();
  const trialEnd = sub?.trialEnd ? new Date(sub.trialEnd).getTime() : 0;
  const subEnd = sub?.subscriptionEnd
    ? new Date(sub.subscriptionEnd).getTime()
    : 0;

  const trialActive = sub?.status === 'trial' && trialEnd > now;
  const paidActive = sub?.status === 'active' && subEnd > now;

  return trialActive || paidActive;
}

router.get('/access', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('subscriptions');
  if (!user) return res.status(401).json({ error: 'User not found' });

  const sub = user.subscriptions?.calculators;
  if (!isActive(sub))
    return res.status(403).json({ error: 'Payment required' });

  res.json({ allowed: true });
});

export default router;
