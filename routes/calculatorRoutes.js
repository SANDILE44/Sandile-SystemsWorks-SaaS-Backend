import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/* ---------------- ACCESS CHECK ---------------- */
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

async function requireActiveAccess(req, res, next) {
  const user = await User.findById(req.user.id).select('subscriptions');
  if (!user) return res.status(401).json({ error: 'User not found' });

  const sub = user.subscriptions?.calculators;
  if (!isActive(sub))
    return res.status(403).json({ error: 'Payment required' });

  next();
}

/* ---------------- ACCESS ENDPOINT ---------------- */
router.get('/access', auth, requireActiveAccess, (req, res) => {
  res.json({ allowed: true });
});

/* =================================================
   AGRICULTURE CALCULATORS (BACKEND AUTHORITY)
================================================= */

/* FARM */
router.post('/agriculture/farm', auth, requireActiveAccess, (req, res) => {
  const { acreage, yieldPerAcre, price, fixed, variable, labor, months } =
    req.body;

  const totalYield = acreage * yieldPerAcre * months;
  const revenue = totalYield * price;
  const variableCosts = variable * acreage * months;
  const totalCosts = fixed + variableCosts + labor;
  const profit = revenue - totalCosts;

  res.json({
    totalYield,
    revenue,
    totalCosts,
    profit,
    roi: totalCosts ? (profit / totalCosts) * 100 : 0,
    margin: revenue ? (profit / revenue) * 100 : 0,
    breakeven: price ? totalCosts / price : 0,
    costPerAcre: acreage && months ? totalCosts / (acreage * months) : 0,
  });
});

/* LIVESTOCK */
router.post('/agriculture/livestock', auth, requireActiveAccess, (req, res) => {
  const { count, price, feed, health, fixed, labor, months, mortality } =
    req.body;

  const adjustedCount = count * (1 - mortality / 100);
  const revenue = adjustedCount * price;
  const variableCosts = adjustedCount * (feed + health) * months;
  const totalCosts = variableCosts + fixed + labor;
  const profit = revenue - totalCosts;

  res.json({
    revenue,
    totalCosts,
    profit,
    costPerAnimal: adjustedCount ? totalCosts / adjustedCount : 0,
    profitPerAnimal: adjustedCount ? profit / adjustedCount : 0,
    roi: totalCosts ? (profit / totalCosts) * 100 : 0,
    margin: revenue ? (profit / revenue) * 100 : 0,
  });
});

export default router;
