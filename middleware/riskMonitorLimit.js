import User from '../models/User.js';

/**
 * Risk Monitor scan limit middleware
 *
 * Rules:
 * - Trial: 3 days
 * - Trial scans: max 3 per day
 * - Paid: unlimited scans
 */
export default async function riskMonitorLimit(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const sub = user.subscriptions?.riskMonitor;
    if (!sub) {
      return res.status(403).json({ error: 'No Risk Monitor access' });
    }

    const now = Date.now();

    // =========================
    // CHECK SUBSCRIPTION STATUS
    // =========================
    const trialActive =
      sub.status === 'trial' &&
      sub.trialEnd &&
      now < new Date(sub.trialEnd).getTime();

    const paidActive =
      sub.status === 'active' &&
      sub.subscriptionEnd &&
      now < new Date(sub.subscriptionEnd).getTime();

    if (!trialActive && !paidActive) {
      return res.status(403).json({
        error: 'Risk Monitor access expired. Please subscribe.',
      });
    }

    // =========================
    // PAID USERS → UNLIMITED
    // =========================
    if (paidActive) {
      return next();
    }

    // =========================
    // TRIAL USERS → LIMIT SCANS
    // =========================

    // Reset scan counter every 24h
    if (
      !sub.scansResetAt ||
      now - new Date(sub.scansResetAt).getTime() > 24 * 60 * 60 * 1000
    ) {
      sub.scansToday = 0;
      sub.scansResetAt = new Date();
    }

    if (sub.scansToday >= 3) {
      return res.status(429).json({
        error:
          'Daily scan limit reached (3/day during trial). Try again tomorrow.',
      });
    }

    // Increment scan count
    sub.scansToday += 1;
    await user.save();

    return next();
  } catch (err) {
    console.error('Risk Monitor limit error:', err);
    return res.status(500).json({ error: 'Scan limit check failed' });
  }
}
