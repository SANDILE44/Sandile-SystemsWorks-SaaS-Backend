import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/access', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const sub = user.subscriptions?.calculators;
  if (!sub) return res.status(403).json({ error: 'No access' });

  const now = Date.now();

  if (
    sub.status === 'active' ||
    (sub.status === 'trial' && new Date(sub.trialEnd).getTime() > now)
  ) {
    return res.json({ ok: true, access: sub.status });
  }

  return res.status(403).json({ error: 'Access expired' });
});

export default router;
