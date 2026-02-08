import User from '../models/User.js';

export default function paid(productKey) {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const sub = user.subscriptions?.[productKey];
      if (!sub) {
        return res.status(403).json({ error: 'No access to this product' });
      }

      const now = Date.now();

      const trialActive =
        sub.status === 'trial' &&
        sub.trialEnd &&
        now < new Date(sub.trialEnd).getTime();

      const paidActive =
        sub.status === 'active' &&
        sub.subscriptionEnd &&
        now < new Date(sub.subscriptionEnd).getTime();

      if (!trialActive && !paidActive) {
        return res.status(403).json({ error: 'Payment required' });
      }

      req.userDoc = user;
      req.productSub = sub;
      next();
    } catch (err) {
      console.error('Paid middleware error:', err);
      return res.status(500).json({ error: 'Access check failed' });
    }
  };
}
