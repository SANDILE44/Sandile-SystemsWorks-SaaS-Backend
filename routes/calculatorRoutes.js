import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/* =================================================
   SUBSCRIPTION ACCESS LOGIC
================================================= */

function hasCalculatorAccess(user) {
  const now = Date.now();
  const calcSub = user?.subscriptions?.calculators;

  if (!calcSub) return false;

  // Active subscription
  if (calcSub.status === 'active') {
    if (!calcSub.subscriptionEnd) return true;

    if (new Date(calcSub.subscriptionEnd).getTime() > now) {
      return true;
    }
  }

  // Trial subscription
  if (
    calcSub.status === 'trial' &&
    calcSub.trialEnd &&
    new Date(calcSub.trialEnd).getTime() > now
  ) {
    return true;
  }

  return false;
}

async function requireActiveAccess(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('subscriptions');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!hasCalculatorAccess(user)) {
      return res.status(403).json({ error: 'Payment required' });
    }

    next();
  } catch (err) {
    console.error('Access check error:', err.message);
    return res.status(500).json({ error: 'Access validation failed' });
  }
}

/* =================================================
   ACCESS CHECK ENDPOINT
================================================= */

router.get('/access', auth, requireActiveAccess, (req, res) => {
  res.json({ allowed: true });
});

/* =================================================
   HELPER FUNCTIONS (DECLARE ONCE FOR ALL CALCULATORS)
================================================= */

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (n, min, max) =>
  Math.min(max, Math.max(min, n));

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

/* AUTOMOTIVE CALCULATORS */
router.post('/transport/vehicle', auth, requireActiveAccess, (req, res) => {
  const { units, costPerUnit, pricePerUnit, fixed, labor, operational } =
    req.body;

  const revenue = units * pricePerUnit;
  const cogs = units * costPerUnit;
  const grossProfit = revenue - cogs;
  const totalCosts = cogs + fixed + labor + operational;
  const netProfit = revenue - totalCosts;

  const margin = revenue ? (netProfit / revenue) * 100 : 0;
  const markup = cogs ? (grossProfit / cogs) * 100 : 0;
  const roi = totalCosts ? (netProfit / totalCosts) * 100 : 0;

  const contributionPerUnit = pricePerUnit - costPerUnit;
  const breakevenUnits =
    contributionPerUnit > 0
      ? (fixed + labor + operational) / contributionPerUnit
      : 0;

  const monthlyRevenue = revenue;
  const annualRevenue = revenue * 12;
  const annualProfit = netProfit * 12;

  const revenuePerUnit = units ? revenue / units : 0;
  const costContribution = revenue ? (totalCosts / revenue) * 100 : 0;

  res.json({
    revenue,
    cogs,
    grossProfit,
    totalCosts,
    netProfit,
    margin,
    markup,
    roi,
    breakevenUnits,
    revenuePerUnit,
    costContribution,
    monthlyRevenue,
    annualRevenue,
    annualProfit,
  });
});

router.post('/construction/project', auth, requireActiveAccess, (req, res) => {

  const value            = Math.max(0, Number(req.body.value) || 0);
  const material         = Math.max(0, Number(req.body.material) || 0);
  const laborMonthly     = Math.max(0, Number(req.body.laborMonthly) || 0);
  const equipmentMonthly = Math.max(0, Number(req.body.equipmentMonthly) || 0);
  const fixedMonthly     = Math.max(0, Number(req.body.fixedMonthly) || 0);
  const months           = Math.max(0, Number(req.body.months) || 0);

  /* ================= CORE ================= */
  const laborTotal     = laborMonthly * months;
  const equipmentTotal = equipmentMonthly * months;
  const fixedTotal     = fixedMonthly * months;

  const totalCosts = material + laborTotal + equipmentTotal + fixedTotal;
  const profit     = value - totalCosts;

  const margin = value > 0 ? (profit / value) * 100 : 0;
  const roi    = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

  const monthlyProfit = months > 0 ? profit / months : 0;
  const annualProfit  = monthlyProfit * 12;

  const costRatio = value > 0 ? (totalCosts / value) * 100 : 0;

  const breakEvenValue = totalCosts;

  /* ================= DECISION ================= */
  let decision = "Strong Project";
  let riskLevel = "Low";
  let advice = "Project is financially viable.";

  if (profit <= 0) {
    decision = "❌ Do Not Take";
    riskLevel = "High";
    advice = "Loss project — renegotiate contract.";
  } else if (margin < 10) {
    decision = "⚠ High Risk";
    riskLevel = "High";
    advice = "Very low margin — risky.";
  } else if (margin < 20) {
    decision = "🟡 Moderate Risk";
    riskLevel = "Medium";
    advice = "Acceptable but weak buffer.";
  }

  /* ================= 🔥 PRIMARY UX LAYER (MISSING BEFORE) ================= */
  const steps = [

    {
      step: "Cost vs Value",
      message:
        profit >= 0
          ? `Profit of R${profit.toFixed(2)} on project value R${value.toFixed(2)}.`
          : `Loss of R${Math.abs(profit).toFixed(2)}. Break-even is R${breakEvenValue.toFixed(2)}.`
    },

    {
      step: "Cost Breakdown",
      message:
        `Material R${material}, Labor R${laborTotal.toFixed(2)}, Equipment R${equipmentTotal.toFixed(2)}, Fixed R${fixedTotal.toFixed(2)}`
    },

    {
      step: "Margin Check",
      message: `${margin.toFixed(1)}% margin — ${margin < 10 ? "Critical" : margin < 20 ? "Weak" : "Strong"}`
    },

    {
      step: "ROI Check",
      message: `${roi.toFixed(1)}% ROI on total investment`
    },

    {
      step: "Scaling Decision",
      message:
        profit <= 0
          ? "DO NOT scale"
          : margin < 15
          ? "Scale cautiously"
          : "Safe to scale"
    },

    {
      step: "Final Action",
      message: advice
    }

  ];

  /* ================= DROPDOWN INSIGHTS ================= */
  const insights = {

    profitability: [
      {
        title: "Margin Health",
        message: `${margin.toFixed(1)}% margin level`
      },
      {
        title: "ROI",
        message: `${roi.toFixed(1)}% ROI`
      }
    ],

    costs: [
      {
        title: "Total Cost",
        message: `R${totalCosts.toFixed(2)} total project cost`
      }
    ],

    operations: [
      {
        title: "Break-even",
        message: `Break-even value: R${breakEvenValue.toFixed(2)}`
      }
    ],

    growth: [
      {
        title: "Growth Potential",
        message:
          profit <= 0
            ? "No scaling possible"
            : margin < 15
            ? "Limited scaling"
            : "Strong scaling potential"
      }
    ]

  };

  /* ================= RESPONSE ================= */
  res.json({
    value,
    totalCosts,
    profit,
    margin,
    roi,

    laborTotal,
    equipmentTotal,
    fixedTotal,

    monthlyProfit,
    annualProfit,
    costRatio,
    breakEvenValue,

    decision,
    riskLevel,
    advice,

    steps,        // ⭐ FIXED (THIS WAS MISSING)
    insights
  });

});

/* ================= CONSULTING PROJECT ================= */
router.post('/consulting/project', auth, requireActiveAccess, (req, res) => {
  let {
    hours,
    rate,
    expenses,
    labor,
    fixed,
    discountPct,
    otHours,
    otRate,
    variableCosts,
    contingencyPct,
  } = req.body;

  /* ================= SAFE CONVERSION ================= */
  hours = Number(hours) || 0;
  rate = Number(rate) || 0;
  expenses = Number(expenses) || 0;
  labor = Number(labor) || 0;
  fixed = Number(fixed) || 0;
  discountPct = Number(discountPct) || 0;
  otHours = Number(otHours) || 0;
  otRate = Number(otRate) || 0;
  variableCosts = Number(variableCosts) || 0;
  contingencyPct = Number(contingencyPct) || 0;

  /* ================= REVENUE ================= */
  const baseRevenue = hours * rate;
  const overtimeRevenue = otHours * otRate;
  const totalRevenue = baseRevenue + overtimeRevenue;

  const discountAmount = totalRevenue * (discountPct / 100);
  const revenueAfterDiscount = totalRevenue - discountAmount;

  /* ================= COSTS ================= */
  const baseCosts = expenses + labor + fixed + variableCosts;
  const contingencyAmount = baseCosts * (contingencyPct / 100);
  const totalCosts = baseCosts + contingencyAmount;

  /* ================= PROFIT ================= */
  const profit = revenueAfterDiscount - totalCosts;

  const profitPerHour = hours > 0 ? profit / hours : 0;
  const costPerHour = hours > 0 ? totalCosts / hours : 0;

  const margin =
    revenueAfterDiscount > 0
      ? (profit / revenueAfterDiscount) * 100
      : 0;

  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

  const breakevenHours = rate > 0 ? totalCosts / rate : 0;

  /* ================= DECISION ENGINE ================= */
  let decision = 'Break-even';
  let riskLevel = 'Medium';
  let advice = 'Monitor costs and hours closely before committing.';

  const steps = [];

  // Step 1
  steps.push(
    `Revenue after discount is R${revenueAfterDiscount.toFixed(
      2
    )}, total costs are R${totalCosts.toFixed(2)}.`
  );

  // LOSS CASE
  if (profit <= 0) {
    decision = '❌ Do Not Take';
    riskLevel = 'High';
    advice = 'Project is unprofitable. Adjust pricing or costs.';

    steps.push(
      `Profit is negative: R${profit.toFixed(2)}. You lose money.`
    );

    const suggestedRate =
      hours > 0 ? Math.ceil(totalCosts / hours * 1.15) : rate;

    steps.push(
      `Suggested hourly rate to break even + profit: R${suggestedRate}`
    );

    const suggestedDiscount = Math.max(discountPct - 10, 0);
    steps.push(
      `Reduce discount from ${discountPct}% to ${suggestedDiscount}%`
    );
  }

  // LOW MARGIN
  else if (margin < 10) {
    decision = '⚠ High Risk';
    riskLevel = 'High';
    advice = 'Low margin project. Very sensitive to overruns.';

    steps.push(`Margin is low: ${margin.toFixed(2)}%`);

    if (variableCosts > 0) {
      steps.push(
        `Reduce variable costs (currently R${variableCosts})`
      );
    }
  }

  // MEDIUM
  else if (margin < 20) {
    decision = '🟡 Moderate Risk';
    riskLevel = 'Medium';
    advice = 'Acceptable but monitor closely.';

    steps.push(`Margin is moderate: ${margin.toFixed(2)}%`);
    steps.push(`Track overtime: ${otHours} hours`);
  }

  // GOOD
  else {
    decision = '✅ Strong Project';
    riskLevel = 'Low';
    advice = 'Healthy margin. Good to proceed.';

    steps.push(`Strong margin: ${margin.toFixed(2)}%`);
    steps.push(`Opportunity to negotiate higher rate.`);
  }

  // Break-even
  steps.push(
    `Break-even hours: ${breakevenHours.toFixed(2)}`
  );

  /* ================= RESPONSE ================= */
  res.json({
    baseRevenue,
    overtimeRevenue,
    totalRevenue,
    discountAmount,
    revenueAfterDiscount,

    contingencyAmount,
    totalCosts,

    profit,
    profitPerHour,
    costPerHour,

    margin,
    roi,
    breakevenHours,

    decision,
    riskLevel,
    advice,

    steps,
  });
});

/* ================= EDUCATION ================= */
router.post('/education/school', auth, requireActiveAccess, (req, res) => {
  const { students, tuition, staff, facilities, supplies, fixed } = req.body;

  const totalRevenue = students * tuition;

  const annualCosts = staff * 12 + facilities * 12 + supplies * 12 + fixed * 12;

  const profit = totalRevenue - annualCosts;

  const costPerStudent = students > 0 ? annualCosts / students : 0;

  const revenuePerStudent = students > 0 ? totalRevenue / students : 0;

  const roi = annualCosts ? (profit / annualCosts) * 100 : 0;
  const margin = totalRevenue ? (profit / totalRevenue) * 100 : 0;

  res.json({
    students,
    totalRevenue,
    annualCosts,
    profit,
    costPerStudent,
    revenuePerStudent,
    roi,
    margin,
  });
});

/* ================= ELECTRONICS ================= */
router.post('/electronics/business', auth, requireActiveAccess, (req, res) => {
  const { units, costPerUnit, pricePerUnit, fixed, labor, operational } =
    req.body;

  const revenue = units * pricePerUnit;

  const cogs = units * costPerUnit;
  const totalCosts = cogs + fixed + labor + operational;

  const profit = revenue - totalCosts;

  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const markup = cogs ? ((revenue - cogs) / cogs) * 100 : 0;

  const revenuePerUnit = units ? revenue / units : 0;
  const costContribution = revenue ? (totalCosts / revenue) * 100 : 0;

  const monthlyRevenue = revenue;
  const annualRevenue = revenue * 12;
  const annualProfit = profit * 12;

  res.json({
    units,
    revenue,
    cogs,
    totalCosts,
    profit,
    margin,
    roi,
    markup,
    revenuePerUnit,
    costContribution,
    monthlyRevenue,
    annualRevenue,
    annualProfit,
  });
});

/* ================= FINANCE ================= */
router.post('/finance/business', auth, requireActiveAccess, (req, res) => {
  const { clients, fee, staff, technology, fixed, operational } = req.body;

  const revenue = clients * fee;

  const totalCosts = staff + technology + fixed + operational;

  const profit = revenue - totalCosts;

  const profitPerClient = clients ? profit / clients : 0;

  const costPerClient = clients ? totalCosts / clients : 0;

  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  res.json({
    clients,
    revenue,
    totalCosts,
    profit,
    profitPerClient,
    costPerClient,
    margin,
    roi,
  });
});

/* ================= FISHING ================= */
router.post('/fishing/business', auth, requireActiveAccess, (req, res) => {
  const { catchKg, priceKg, fuel, labor, equipment, fixed } = req.body;

  const revenue = catchKg * priceKg;

  const totalCosts = fuel + labor + equipment + fixed;

  const profit = revenue - totalCosts;

  const profitPerKg = catchKg ? profit / catchKg : 0;

  const margin = revenue ? (profit / revenue) * 100 : 0;

  const breakevenCatch = priceKg ? totalCosts / priceKg : 0;

  const monthlyRevenue = revenue;
  const annualRevenue = revenue * 12;

  res.json({
    catchKg,
    revenue,
    totalCosts,
    profit,
    profitPerKg,
    margin,
    breakevenCatch,
    monthlyRevenue,
    annualRevenue,
  });
});

/* ================= FOOD & BEVERAGE ================= */
router.post(
  '/food-beverage/business',
  auth,
  requireActiveAccess,
  (req, res) => {
    const { units, price, ingredients, labor, equipment, fixed } = req.body;

    const revenue = units * price;
    const totalCosts = ingredients + labor + equipment + fixed;
    const profit = revenue - totalCosts;

    const profitPerUnit = units ? profit / units : 0;
    const margin = revenue ? (profit / revenue) * 100 : 0;
    const revenuePerUnit = units ? revenue / units : 0;

    const monthlyRevenue = revenue;
    const annualRevenue = revenue * 12;
    const annualProfit = profit * 12;

    res.json({
      units,
      revenue,
      totalCosts,
      profit,
      profitPerUnit,
      margin,
      revenuePerUnit,
      monthlyRevenue,
      annualRevenue,
      annualProfit,
    });
  }
);

/* ================= FORESTRY ================= */
router.post('/forestry/business', auth, requireActiveAccess, (req, res) => {
  const { volume, price, labor, equipment, replanting, fixed, months } =
    req.body;

  const revenue = volume * price;
  const totalCosts = labor + equipment + replanting + fixed;
  const profit = revenue - totalCosts;

  const profitPerUnit = volume ? profit / volume : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  const breakevenVolume = price ? totalCosts / price : 0;
  const annualProfit = profit * months;

  res.json({
    volume,
    revenue,
    totalCosts,
    profit,
    profitPerUnit,
    margin,
    roi,
    breakevenVolume,
    annualProfit,
  });
});

/* ================= GOVERNMENT ================= */
router.post('/government/budget', auth, requireActiveAccess, (req, res) => {
  const { budget, staff, ops, infra, beneficiaries } = req.body;

  const totalCost = staff + ops + infra;
  const balance = budget - totalCost;

  const utilisation = budget ? (totalCost / budget) * 100 : 0;
  const costPerBeneficiary = beneficiaries ? totalCost / beneficiaries : 0;

  let feasibility = '—';
  if (budget > 0) {
    if (balance >= 0 && utilisation <= 100) {
      feasibility = 'Feasible';
    } else if (utilisation > 100) {
      feasibility = 'Over Budget';
    } else {
      feasibility = 'Needs Review';
    }
  }

  res.json({
    totalCost,
    balance,
    utilisation,
    costPerBeneficiary,
    feasibility,
  });
});

/* ================= HEALTHCARE ================= */
router.post('/healthcare/clinic', auth, requireActiveAccess, (req, res) => {
  const { patientsPerDay, fee, days, staff, supplies, fixed } = req.body;

  const monthlyPatients = patientsPerDay * days;
  const revenue = monthlyPatients * fee;
  const totalCosts = staff + supplies + fixed;
  const profit = revenue - totalCosts;

  const costPerPatient = monthlyPatients ? totalCosts / monthlyPatients : 0;

  const revenuePerPatient = monthlyPatients ? revenue / monthlyPatients : 0;

  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  res.json({
    monthlyPatients,
    revenue,
    totalCosts,
    profit,
    costPerPatient,
    revenuePerPatient,
    margin,
    roi,
  });
});

/* ================= HOSPITALITY ================= */
router.post('/hospitality/hotel', auth, requireActiveAccess, (req, res) => {
  const { rooms, occupancyPct, price, variable, labor, fixed } = req.body;

  const occupiedNights = rooms * (occupancyPct / 100) * 30;
  const revenue = occupiedNights * price;
  const variableCosts = occupiedNights * variable;
  const totalCosts = variableCosts + labor + fixed;
  const profit = revenue - totalCosts;

  const revenuePerRoom = rooms ? revenue / rooms : 0;
  const costPerRoom = rooms ? totalCosts / rooms : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  res.json({
    occupiedNights,
    revenue,
    totalCosts,
    profit,
    revenuePerRoom,
    costPerRoom,
    margin,
    roi,
  });
});

/* ================= IT SERVICES ================= */
router.post('/it/services', auth, requireActiveAccess, (req, res) => {
  const { hours, rate, labor, software, fixed } = req.body;

  const revenue = hours * rate;
  const totalCosts = labor + software + fixed;
  const profit = revenue - totalCosts;

  const profitPerHour = hours ? profit / hours : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const breakevenHours = rate ? totalCosts / rate : 0;

  const monthlyProfit = profit;
  const annualProfit = profit * 12;

  res.json({
    revenue,
    totalCosts,
    profit,
    profitPerHour,
    margin,
    roi,
    breakevenHours,
    monthlyProfit,
    annualProfit,
  });
});

/* =====================================================
   LOGISTICS — MONTHLY OPERATIONS
   POST /logistics/business
===================================================== */
router.post('/logistics/business', auth, requireActiveAccess, (req, res) => {

  const shipments    = Math.max(0, Math.floor(toNum(req.body.shipments)));
  const revenuePer   = Math.max(0, toNum(req.body.revenuePer));
  const fuel         = Math.max(0, toNum(req.body.fuel));
  const labor        = Math.max(0, toNum(req.body.labor));
  const maintenance  = Math.max(0, toNum(req.body.maintenance));
  const fixed        = Math.max(0, toNum(req.body.fixed));

  const totalRevenue      = shipments * revenuePer;
  const totalCosts        = fuel + labor + maintenance + fixed;
  const profit            = totalRevenue - totalCosts;
  const costPerShipment   = shipments > 0 ? totalCosts / shipments : 0;
  const profitPerShipment = shipments > 0 ? profit / shipments : 0;
  const margin            = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const roi               = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const breakEvenShipments = revenuePer > 0 ? Math.ceil(totalCosts / revenuePer) : 0;
  const annualProfit      = profit * 12;

  const fuelPercent        = totalCosts > 0 ? (fuel / totalCosts) * 100 : 0;
  const laborPercent       = totalCosts > 0 ? (labor / totalCosts) * 100 : 0;
  const maintenancePercent = totalCosts > 0 ? (maintenance / totalCosts) * 100 : 0;
  const fixedPercent       = totalCosts > 0 ? (fixed / totalCosts) * 100 : 0;

  const targetMargin = 20;
  const recommendedPricePerShipment = costPerShipment > 0
    ? costPerShipment / (1 - targetMargin / 100)
    : 0;

  let status = 'Break-even';
  if (profit > 0) status = 'Profitable';
  if (profit < 0) status = 'Loss';

  let riskLevel = 'Low';
  if (profit < 0) riskLevel = 'High';
  else if (margin < 8) riskLevel = 'High';
  else if (margin < 15) riskLevel = 'Medium';

  let safetyStatus = 'Healthy';
  if (profit < 0) safetyStatus = 'Critical';
  else if (margin < 10) safetyStatus = 'At Risk';

  let advice = 'Operations stable. Maintain margin discipline.';
  if (profit < 0) advice = 'Operating at a loss. Increase pricing or reduce largest cost driver immediately.';
  else if (margin < 10) advice = 'Margins are thin. Small cost increases could wipe out profit.';
  else if (margin >= 20) advice = 'Strong margin zone. You have operational buffer and pricing power.';

  /* =====================================================
     STEP-BY-STEP GUIDANCE
  ===================================================== */
  const steps = [];

  /* Step 1 — Revenue vs Costs */
  steps.push({
    step: 'Revenue vs Total Costs',
    message: totalRevenue >= totalCosts
      ? `Revenue of R${totalRevenue.toFixed(2)} covers all costs of R${totalCosts.toFixed(2)}. You are making R${profit.toFixed(2)} profit this month.`
      : `Revenue of R${totalRevenue.toFixed(2)} is below total costs of R${totalCosts.toFixed(2)}. You are losing R${Math.abs(profit).toFixed(2)} per month. Increase your rate per shipment or reduce your largest cost immediately.`
  });

  /* Step 2 — Profit Margin */
  steps.push({
    step: 'Profit Margin Check',
    message: margin >= 20
      ? `Strong margin of ${margin.toFixed(2)}%. Industry standard for logistics is 15-25%. You are in a healthy position.`
      : margin >= 10
      ? `Moderate margin of ${margin.toFixed(2)}%. You need ${(20 - margin).toFixed(2)}% more to reach a strong position. Increasing your rate per shipment by R${(recommendedPricePerShipment - revenuePer).toFixed(2)} would achieve this.`
      : margin > 0
      ? `Dangerous margin of ${margin.toFixed(2)}%. Any fuel price increase or breakdown will eliminate your profit. Raise your rate per shipment to at least R${recommendedPricePerShipment.toFixed(2)} to achieve 20% margin.`
      : `No margin. You are losing money on every shipment. Your recommended rate per shipment is R${recommendedPricePerShipment.toFixed(2)} to reach 20% margin.`
  });

  /* Step 3 — Largest Cost Driver */
  steps.push({
    step: 'Largest Cost Driver',
    message: (() => {
      const costs = [
        { name: 'Fuel', value: fuel, pct: fuelPercent },
        { name: 'Labor', value: labor, pct: laborPercent },
        { name: 'Maintenance', value: maintenance, pct: maintenancePercent },
        { name: 'Fixed Costs', value: fixed, pct: fixedPercent }
      ];
      const sorted = [...costs].sort((a, b) => b.value - a.value);
      const top = sorted[0];
      return `Your largest cost is ${top.name} at R${top.value.toFixed(2)} — ${top.pct.toFixed(1)}% of total costs. A 10% reduction in ${top.name} would save R${(top.value * 0.1).toFixed(2)} per month and add ${((top.value * 0.1 / totalRevenue) * 100).toFixed(2)}% to your margin.`;
    })()
  });

  /* Step 4 — Pricing Recommendation */
  steps.push({
    step: 'Recommended Rate Per Shipment',
    message: revenuePer >= recommendedPricePerShipment
      ? `Your current rate of R${revenuePer.toFixed(2)} per shipment meets the target margin of ${targetMargin}%. Maintain this pricing.`
      : `Your current rate of R${revenuePer.toFixed(2)} per shipment is below the recommended R${recommendedPricePerShipment.toFixed(2)}. Increasing by R${(recommendedPricePerShipment - revenuePer).toFixed(2)} per shipment would add R${((recommendedPricePerShipment - revenuePer) * shipments).toFixed(2)} to your monthly profit.`
  });

  /* Step 5 — Break-even */
  steps.push({
    step: 'Break-even Shipments',
    message: shipments >= breakEvenShipments
      ? `You are running ${shipments} shipments — ${shipments - breakEvenShipments} above your break-even of ${breakEvenShipments}. You have a healthy operational buffer.`
      : `You need ${breakEvenShipments} shipments per month to break even but are only running ${shipments}. You need ${breakEvenShipments - shipments} more shipments just to cover costs.`
  });

  /* Step 6 — Annual Outlook */
  steps.push({
    step: 'Annual Profit Outlook',
    message: annualProfit > 0
      ? `At current performance your annual profit is R${annualProfit.toFixed(2)}. ${annualProfit > 500000 ? 'Excellent. Consider fleet expansion to scale.' : 'Stable but there is room to grow. Focus on increasing shipment volume or rate.'}`
      : `At current performance your annual loss is R${Math.abs(annualProfit).toFixed(2)}. Immediate pricing or cost action is required to prevent long term damage.`
  });

  /* Step 7 — Risk Assessment */
  steps.push({
    step: 'Final Risk Assessment',
    message: riskLevel === 'High'
      ? `High risk operations. ${profit < 0 ? `You are losing R${Math.abs(profit).toFixed(2)} per month. Raise rates to minimum R${recommendedPricePerShipment.toFixed(2)} per shipment immediately.` : `Margin of ${margin.toFixed(2)}% is below safe threshold. Any unexpected cost will push you into loss.`}`
      : riskLevel === 'Medium'
      ? `Medium risk. Margin of ${margin.toFixed(2)}% is acceptable but thin. Target R${recommendedPricePerShipment.toFixed(2)} per shipment for a stronger position.`
      : `Low risk. Operations are financially sound with ${margin.toFixed(2)}% margin. Continue monitoring fuel and maintenance costs.`
  });

  res.json({
    shipments,
    totalRevenue,
    totalCosts,
    profit,
    costPerShipment,
    profitPerShipment,
    margin,
    roi,
    breakEvenShipments,
    annualProfit,
    fuelPercent,
    laborPercent,
    maintenancePercent,
    fixedPercent,
    status,
    riskLevel,
    recommendedPricePerShipment,
    safetyStatus,
    advice,
    steps
  });
});


/* =====================================================
   LOGISTICS — SHIPMENT ENGINE
   POST /logistics/shipment
===================================================== */
router.post('/logistics/shipment', auth, requireActiveAccess, (req, res) => {

  const quote        = Math.max(0, toNum(req.body.quote));
  const minMargin    = clamp(toNum(req.body.minMargin), 0, 99.99);
  const buffer       = clamp(toNum(req.body.buffer), 0, 99.99);
  const distance     = Math.max(0, toNum(req.body.distance));
  const fuelPerKm    = Math.max(0, toNum(req.body.fuelPerKm));
  const vehiclePerKm = Math.max(0, toNum(req.body.vehiclePerKm));
  const loadFactor   = clamp(toNum(req.body.loadFactor) || 100, 1, 200);
  const drivingHours = Math.max(0, toNum(req.body.drivingHours));
  const waitHours    = Math.max(0, toNum(req.body.waitHours));
  const driverRate   = Math.max(0, toNum(req.body.driverRate));
  const tolls        = Math.max(0, toNum(req.body.tolls));
  const permits      = Math.max(0, toNum(req.body.permits));
  const otherFees    = Math.max(0, toNum(req.body.otherFees));
  const cargoValue   = Math.max(0, toNum(req.body.cargoValue));
  const insuranceRate = clamp(toNum(req.body.insuranceRate), 0, 100);
  const duties       = Math.max(0, toNum(req.body.duties));
  const handling     = Math.max(0, toNum(req.body.handling));
  const passThrough  = Math.max(0, toNum(req.body.passThrough));

  const fuelCost      = distance * fuelPerKm;
  const vehicleCost   = distance * vehiclePerKm;
  const timeCost      = (drivingHours + waitHours) * driverRate;
  const insuranceCost = (insuranceRate / 100) * cargoValue;

  const baseCost  = fuelCost + vehicleCost + timeCost + tolls + permits + otherFees + insuranceCost + duties + handling + passThrough;
  const totalCost = baseCost * (100 / loadFactor);
  const profit    = quote - totalCost;
  const margin    = quote > 0 ? (profit / quote) * 100 : 0;

  const requiredMargin      = clamp(minMargin + buffer, 0, 99.99);
  const recommendedMinQuote = requiredMargin > 0 && requiredMargin < 100
    ? totalCost / (1 - requiredMargin / 100)
    : totalCost;

  let decision = 'REVIEW';
  let reason   = 'Review shipment before approval.';
  if (quote === 0) {
    decision = 'REVIEW';
    reason   = 'Enter client quote to evaluate.';
  } else if (margin >= requiredMargin) {
    decision = 'APPROVE';
    reason   = 'Shipment meets required margin and buffer.';
  } else if (margin < minMargin) {
    decision = 'REJECT';
    reason   = 'Shipment below minimum margin requirement.';
  }

  let shipmentRisk = 'Low';
  if (profit < 0) shipmentRisk = 'High';
  else if (margin < requiredMargin) shipmentRisk = 'Medium';

  /* =====================================================
     STEP-BY-STEP GUIDANCE
  ===================================================== */
  const steps = [];

  /* Step 1 — Cost Evaluation */
  steps.push({
    step: 'Evaluate Costs',
    message: `Total cost for this shipment is R${totalCost.toFixed(2)}. Your quote is R${quote.toFixed(2)}. ${profit >= 0 ? `You make R${profit.toFixed(2)} profit on this shipment.` : `You lose R${Math.abs(profit).toFixed(2)} on this shipment. Do not accept it at this price.`}`
  });

  /* Step 2 — Margin Check */
  steps.push({
    step: 'Margin Check',
    message: margin >= requiredMargin
      ? `Margin of ${margin.toFixed(2)}% meets your required ${requiredMargin}% target. Shipment is financially safe to accept.`
      : margin > 0
      ? `Margin of ${margin.toFixed(2)}% is below your required ${requiredMargin}%. You need to increase your quote by R${(recommendedMinQuote - quote).toFixed(2)} to meet your target margin. Recommended minimum quote is R${recommendedMinQuote.toFixed(2)}.`
      : `Negative margin of ${margin.toFixed(2)}%. This shipment loses money. Do not accept unless quote is raised to at least R${recommendedMinQuote.toFixed(2)}.`
  });

  /* Step 3 — Largest Cost Driver */
  steps.push({
    step: 'Largest Cost Driver',
    message: (() => {
      const costs = [
        { name: 'Fuel', value: fuelCost },
        { name: 'Vehicle Wear', value: vehicleCost },
        { name: 'Driver Time', value: timeCost },
        { name: 'Insurance', value: insuranceCost },
        { name: 'Tolls', value: tolls },
        { name: 'Handling', value: handling }
      ].filter(c => c.value > 0);
      if (costs.length === 0) return 'Enter cost details to identify your largest cost driver.';
      const top = costs.reduce((a, b) => a.value > b.value ? a : b);
      const pct = totalCost > 0 ? ((top.value / totalCost) * 100).toFixed(1) : 0;
      return `Your largest cost is ${top.name} at R${top.value.toFixed(2)} — ${pct}% of total shipment cost. A 10% reduction here would save R${(top.value * 0.1).toFixed(2)} and add ${((top.value * 0.1 / quote) * 100).toFixed(2)}% to your margin.`;
    })()
  });

  /* Step 4 — Recommended Quote */
  steps.push({
    step: 'Recommended Minimum Quote',
    message: quote >= recommendedMinQuote
      ? `Your quote of R${quote.toFixed(2)} is above the minimum required R${recommendedMinQuote.toFixed(2)}. Good pricing decision.`
      : `To achieve your target margin of ${requiredMargin}% your minimum quote should be R${recommendedMinQuote.toFixed(2)}. You are currently underquoting by R${(recommendedMinQuote - quote).toFixed(2)}. Use this number when negotiating with the client.`
  });

  /* Step 5 — Load Factor Impact */
  steps.push({
    step: 'Load Factor Impact',
    message: loadFactor >= 85
      ? `Load factor of ${loadFactor}% is good. Truck is well utilised and cost per unit is efficient.`
      : loadFactor >= 60
      ? `Load factor of ${loadFactor}% is moderate. Increasing load to 85% would reduce your cost per unit and improve margin by approximately ${((baseCost * (100/loadFactor) - baseCost * (100/85)) / quote * 100).toFixed(2)}%.`
      : `Load factor of ${loadFactor}% is low. You are running a mostly empty truck which increases your effective cost. Try to consolidate loads or add cargo to improve profitability.`
  });

  /* Step 6 — Risk Assessment */
  steps.push({
    step: 'Final Risk Assessment',
    message: shipmentRisk === 'High'
      ? `High risk shipment. ${profit < 0 ? `Do not accept. Loss of R${Math.abs(profit).toFixed(2)} at current quote. Minimum viable quote is R${recommendedMinQuote.toFixed(2)}.` : `Margin is dangerously low. Any delay, fuel spike or additional cost will result in a loss.`}`
      : shipmentRisk === 'Medium'
      ? `Medium risk. Shipment is profitable but below your target margin. Consider negotiating the quote up to R${recommendedMinQuote.toFixed(2)} before accepting.`
      : `Low risk. Shipment is financially sound. Approve and proceed.`
  });

  res.json({
    totalCost,
    profit,
    margin,
    recommendedMinQuote,
    decision,
    reason,
    shipmentRisk,
    steps
  });
});


/* =====================================================
   LOGISTICS — FREIGHT IMPORT / EXPORT ENGINE
   POST /logistics/freight
===================================================== */
router.post('/logistics/freight', auth, requireActiveAccess, (req, res) => {

  const quote          = Math.max(0, toNum(req.body.quote));
  const cargoValue     = Math.max(0, toNum(req.body.cargoValue));
  const insuranceRate  = clamp(toNum(req.body.insuranceRate), 0, 100);
  const freightCost    = Math.max(0, toNum(req.body.freightCost));
  const fuelSurcharge  = Math.max(0, toNum(req.body.fuelSurcharge));
  const dutyRate       = clamp(toNum(req.body.dutyRate), 0, 100);
  const customsFees    = Math.max(0, toNum(req.body.customsFees));
  const portFees       = Math.max(0, toNum(req.body.portFees));
  const handlingFees   = Math.max(0, toNum(req.body.handlingFees));
  const inlandTransport = Math.max(0, toNum(req.body.inlandTransport));
  const tollCosts      = Math.max(0, toNum(req.body.tollCosts));
  const otherCosts     = Math.max(0, toNum(req.body.otherCosts));

  const insuranceCost = (insuranceRate / 100) * cargoValue;
  const duties        = (dutyRate / 100) * cargoValue;

  const totalCost = freightCost + fuelSurcharge + insuranceCost + duties + customsFees + portFees + handlingFees + inlandTransport + tollCosts + otherCosts;
  const profit    = quote - totalCost;
  const margin    = quote > 0 ? (profit / quote) * 100 : 0;
  const breakEvenQuote = totalCost;

  const targetMargin = 20;
  const recommendedQuote = totalCost > 0 ? totalCost / (1 - targetMargin / 100) : 0;

  let decision = 'REVIEW';
  let reason   = 'Shipment needs evaluation.';
  if (profit < 0) {
    decision = 'REJECT';
    reason   = 'Shipment results in a loss.';
  } else if (margin < 10) {
    decision = 'REVIEW';
    reason   = 'Margin is very thin for freight risk.';
  } else if (margin >= 20) {
    decision = 'APPROVE';
    reason   = 'Healthy freight margin.';
  }

  let riskLevel = 'Low';
  if (profit < 0) riskLevel = 'High';
  else if (margin < 15) riskLevel = 'Medium';

  /* =====================================================
     STEP-BY-STEP GUIDANCE
  ===================================================== */
  const steps = [];

  /* Step 1 — Cost vs Quote */
  steps.push({
    step: 'Total Costs vs Client Quote',
    message: profit >= 0
      ? `Total freight costs are R${totalCost.toFixed(2)} against your quote of R${quote.toFixed(2)}. You make R${profit.toFixed(2)} profit on this shipment.`
      : `Total freight costs of R${totalCost.toFixed(2)} exceed your quote of R${quote.toFixed(2)}. You lose R${Math.abs(profit).toFixed(2)} on this shipment. Do not accept unless you requote at minimum R${breakEvenQuote.toFixed(2)}.`
  });

  /* Step 2 — Margin Check */
  steps.push({
    step: 'Profit Margin Check',
    message: margin >= 20
      ? `Strong margin of ${margin.toFixed(2)}%. Freight shipment is financially healthy. International freight standard is 15-25%.`
      : margin >= 10
      ? `Moderate margin of ${margin.toFixed(2)}%. To reach 20% target your quote should be R${recommendedQuote.toFixed(2)}. You are underquoting by R${(recommendedQuote - quote).toFixed(2)}.`
      : margin > 0
      ? `Dangerous margin of ${margin.toFixed(2)}%. Freight has high hidden risk — port delays, currency fluctuations and duty changes can easily eliminate this. Requote at R${recommendedQuote.toFixed(2)} minimum.`
      : `Negative margin. Loss of R${Math.abs(profit).toFixed(2)}. Requote at minimum R${breakEvenQuote.toFixed(2)} to break even or R${recommendedQuote.toFixed(2)} for 20% margin.`
  });

  /* Step 3 — Largest Cost Driver */
  steps.push({
    step: 'Largest Cost Driver',
    message: (() => {
      const costs = [
        { name: 'Freight Cost', value: freightCost },
        { name: 'Duties', value: duties },
        { name: 'Insurance', value: insuranceCost },
        { name: 'Fuel Surcharge', value: fuelSurcharge },
        { name: 'Customs Fees', value: customsFees },
        { name: 'Port Fees', value: portFees },
        { name: 'Handling Fees', value: handlingFees },
        { name: 'Inland Transport', value: inlandTransport }
      ].filter(c => c.value > 0);
      if (costs.length === 0) return 'Enter cost details to identify your largest cost driver.';
      const top = costs.reduce((a, b) => a.value > b.value ? a : b);
      const pct = totalCost > 0 ? ((top.value / totalCost) * 100).toFixed(1) : 0;
      return `Largest cost is ${top.name} at R${top.value.toFixed(2)} — ${pct}% of total freight costs. ${top.name === 'Duties' ? `Duties are fixed by regulation but check if any duty rebates or exemptions apply to this cargo.` : `A 10% reduction would save R${(top.value * 0.1).toFixed(2)} and add ${((top.value * 0.1 / quote) * 100).toFixed(2)}% to your margin.`}`;
    })()
  });

  /* Step 4 — Duty Impact */
  steps.push({
    step: 'Import Duty Assessment',
    message: duties === 0
      ? `No import duty entered. If this is an international shipment make sure to verify the correct duty rate — missing duties can turn a profitable shipment into a loss.`
      : duties > profit
      ? `Import duty of R${duties.toFixed(2)} is larger than your profit of R${profit.toFixed(2)}. Duty alone is wiping out your margin. Verify the duty rate and check if any exemptions apply. Consider building duty cost into your client quote.`
      : `Import duty is R${duties.toFixed(2)} — ${totalCost > 0 ? ((duties / totalCost) * 100).toFixed(1) : 0}% of total costs. Factor this into all future international quotes for similar cargo.`
  });

  /* Step 5 — Break-even */
  steps.push({
    step: 'Break-even Quote',
    message: quote >= breakEvenQuote
      ? `Your quote of R${quote.toFixed(2)} is above the break-even of R${breakEvenQuote.toFixed(2)}. Never quote below R${breakEvenQuote.toFixed(2)} for a shipment with these costs.`
      : `Your quote of R${quote.toFixed(2)} is below break-even of R${breakEvenQuote.toFixed(2)}. You need to increase your quote by R${(breakEvenQuote - quote).toFixed(2)} just to cover costs — profit is not yet included. Target quote for 20% margin is R${recommendedQuote.toFixed(2)}.`
  });

  /* Step 6 — Risk Assessment */
  steps.push({
    step: 'Final Risk Assessment',
    message: riskLevel === 'High'
      ? `High risk freight. ${profit < 0 ? `Do not accept at current quote. Minimum break-even quote is R${breakEvenQuote.toFixed(2)}. For 20% margin quote at R${recommendedQuote.toFixed(2)}.` : `Margin is dangerously thin for international freight. Port delays, currency shifts or additional duties can push you into loss instantly.`}`
      : riskLevel === 'Medium'
      ? `Medium risk. Shipment is profitable but thin for international freight. Recommend increasing quote to R${recommendedQuote.toFixed(2)} before accepting.`
      : `Low risk. Freight margin is healthy. Approve and proceed. Monitor for any duty or port fee changes during transit.`
  });

  res.json({
    insuranceCost,
    duties,
    totalCost,
    profit,
    margin,
    breakEvenQuote,
    recommendedQuote,
    decision,
    reason,
    riskLevel,
    steps
  });
});

/* ================= MANUFACTURING ================= */
router.post('/manufacturing/business', auth, requireActiveAccess, (req, res) => {

  const units       = Math.max(0, Number(req.body.units) || 0);
  const price       = Math.max(0, Number(req.body.price) || 0);
  const material    = Math.max(0, Number(req.body.material) || 0);
  const labor       = Math.max(0, Number(req.body.labor) || 0);
  const fixed       = Math.max(0, Number(req.body.fixed) || 0);
  const operational = Math.max(0, Number(req.body.operational) || 0);

  /* ================= CORE ================= */

  const revenue = units * price;

  // ⚠️ FIX: labor is monthly → convert to per unit safely
  const laborPerUnit = units > 0 ? labor / units : 0;

  const variableCostPerUnit = material + laborPerUnit;
  const totalVariableCosts  = units * variableCostPerUnit;

  const totalCosts = totalVariableCosts + fixed + operational;
  const profit     = revenue - totalCosts;

  // ✅ SAFE PERCENTAGES (no crazy numbers)
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const roi    = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

  const costPerUnit   = units > 0 ? totalCosts / units : 0;
  const profitPerUnit = units > 0 ? profit / units : 0;

  const contributionMargin = price - variableCostPerUnit;

  const breakeven =
    contributionMargin > 0
      ? Math.ceil((fixed + operational) / contributionMargin)
      : 0;

  /* ================= DECISION ================= */

  let status = "PROFIT";
  let decision = "";
  let riskLevel = "";
  let action = "";

  if (profit <= 0) {
    status = "LOSS";
    decision = "❌ Loss Making";
    riskLevel = "High";
    action = "Increase price or reduce production costs immediately.";
  } 
  else if (margin < 10) {
    status = "RISK";
    decision = "⚠ Low Margin";
    riskLevel = "High";
    action = "Margins too low — optimize costs before scaling.";
  } 
  else if (margin < 20) {
    status = "STABLE";
    decision = "🟡 Stable";
    riskLevel = "Medium";
    action = "Improve efficiency before scaling.";
  } 
  else {
    status = "STRONG";
    decision = "✅ Strong Profitability";
    riskLevel = "Low";
    action = "Safe to scale production.";
  }

  /* ================= STEP ENGINE (PRIMARY UI) ================= */

  const stepGuide = {
    steps: [

      {
        step: "Step 1 — Production Overview",
        message:
          profit <= 0
            ? `You are losing R${Math.abs(profit).toLocaleString()} per cycle.`
            : `You are generating R${profit.toLocaleString()} profit at ${margin.toFixed(1)}% margin.`
      },

      {
        step: "Step 2 — Cost Structure",
        message:
          costPerUnit > price
            ? "Cost per unit exceeds selling price — guaranteed loss."
            : `Healthy cost buffer: R${(price - costPerUnit).toFixed(2)} per unit.`
      },

      {
        step: "Step 3 — Break-even",
        message:
          breakeven > 0
            ? `Break-even at ${breakeven} units.`
            : "Break-even not achievable."
      },

      {
        step: "Step 4 — Scaling",
        message:
          status === "LOSS"
            ? "Do NOT scale."
            : status === "RISK"
            ? "Scaling is risky."
            : "Scaling is viable."
      },

      {
        step: "Step 5 — Action",
        message: action
      }

    ],

    insights: {

      profitability: [
        {
          title: "Margin Health",
          message:
            margin >= 20
              ? "Strong profitability."
              : margin >= 10
              ? "Moderate margin."
              : "Critical margin."
        }
      ],

      costs: [
        {
          title: "Cost Efficiency",
          message:
            costPerUnit > price
              ? "Unprofitable unit economics."
              : "Cost structure is stable."
        }
      ],

      operations: [
        {
          title: "Break-even Position",
          message:
            breakeven > 0
              ? `${breakeven} units required.`
              : "No viable break-even."
        }
      ],

      growth: [
        {
          title: "Scaling Outlook",
          message:
            status === "LOSS"
              ? "Stop scaling."
              : status === "RISK"
              ? "Delay scaling."
              : "Scaling opportunity available."
        }
      ]

    }
  };

  /* ================= RESPONSE ================= */

  res.json({
    revenue,
    totalCosts,
    profit,
    margin,
    roi,
    costPerUnit,
    profitPerUnit,
    breakeven,
    status,
    decision,
    riskLevel,
    action,

    stepGuide   // ✅ ONE OBJECT → PERFECT FOR UI
  });

});

/* ================= MARKETING ================= */
router.post('/marketing/campaign', auth, requireActiveAccess, (req, res) => {
  const { campaigns, budget, revenue, staff, fixed, variable } = req.body;

  const totalCosts = budget + staff + fixed + variable;
  const profit = revenue - totalCosts;

  const revenuePerCampaign = campaigns ? revenue / campaigns : 0;

  const costPerCampaign = campaigns ? totalCosts / campaigns : 0;

  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  res.json({
    revenue,
    totalCosts,
    profit,
    revenuePerCampaign,
    costPerCampaign,
    roi,
    margin,
  });
});

/* ================= MEDIA ================= */
router.post('/media/business', auth, requireActiveAccess, (req, res) => {
  const { content, adRevenue, subscriptions, staff, fixed, variable } =
    req.body;

  const revenue = adRevenue + subscriptions;
  const totalCosts = staff + fixed + variable;
  const profit = revenue - totalCosts;

  const revenuePerContent = content ? revenue / content : 0;

  const costPerContent = content ? totalCosts / content : 0;

  const breakeven =
    revenuePerContent > 0 ? Math.ceil(totalCosts / revenuePerContent) : 0;

  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  const monthlyProfit = profit;
  const annualProfit = profit * 12;

  res.json({
    revenue,
    totalCosts,
    profit,
    revenuePerContent,
    costPerContent,
    breakeven,
    roi,
    margin,
    monthlyProfit,
    annualProfit,
  });
});

/* ================= MINING ================= */
router.post('/mining/business', auth, requireActiveAccess, (req, res) => {
  const { tons, price, variable, labor, fixed } = req.body;

  const revenue = tons * price;
  const totalCosts = tons * variable + labor + fixed;
  const profit = revenue - totalCosts;

  const costPerTon = tons ? totalCosts / tons : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  const monthlyProfit = profit;
  const annualProfit = profit * 12;

  res.json({
    revenue,
    totalCosts,
    profit,
    costPerTon,
    roi,
    margin,
    monthlyProfit,
    annualProfit,
  });
});

/* ================= NGO / NON-PROFIT ================= */
router.post('/ngo/operations', auth, requireActiveAccess, (req, res) => {
  const { donations, staff, programs, fixed, programCount } = req.body;

  const totalCosts = staff + programs + fixed;
  const remaining = donations - totalCosts;

  const costPerProgram = programCount ? programs / programCount : 0;

  const impactEfficiency = donations ? (programs / donations) * 100 : 0;

  res.json({
    donations,
    totalCosts,
    remaining,
    costPerProgram,
    impactEfficiency,
  });
});

/* ================= ENERGY / OIL & GAS ================= */
router.post('/energy/production', auth, requireActiveAccess, (req, res) => {
  const { volume, price, opex, capex, fixed } = req.body;

  const revenue = volume * price;
  const totalCosts = opex + capex + fixed;
  const profit = revenue - totalCosts;

  const revenuePerUnit = volume ? revenue / volume : 0;

  const costPerUnit = volume ? totalCosts / volume : 0;

  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  const margin = revenue ? (profit / revenue) * 100 : 0;

  res.json({
    revenue,
    totalCosts,
    profit,
    revenuePerUnit,
    costPerUnit,
    roi,
    margin,
  });
});

/* ================= PUBLIC ADMINISTRATION ================= */
router.post(
  '/public-administration/operations',
  auth,
  requireActiveAccess,
  (req, res) => {
    const {
      budget,
      staffCount,
      operationalCosts,
      programCosts,
      efficiencyRate,
    } = req.body;

    const totalExpenses = operationalCosts + programCosts;
    const remainingBudget = budget - totalExpenses;

    const costPerStaff = staffCount ? totalExpenses / staffCount : 0;

    res.json({
      budget,
      totalExpenses,
      remainingBudget,
      costPerStaff,
      efficiencyRate,
    });
  }
);

/* ================= R&D INVESTMENT ================= */
router.post('/rnd/investment', auth, requireActiveAccess, (req, res) => {
  const { cost, years, revenue, operating } = req.body;

  const annualProfit = revenue - operating;
  const netGain = annualProfit * years - cost;

  const monthlyProfit = annualProfit / 12;
  const annualizedGain = years ? netGain / years : 0;

  const roi = cost ? (netGain / cost) * 100 : 0;
  const payback = annualProfit > 0 ? cost / annualProfit : null;

  res.json({
    annualProfit,
    monthlyProfit,
    netGain,
    annualizedGain,
    roi,
    payback,
  });
});

/* ================= REAL ESTATE INVESTMENT ================= */

router.post(
"/property/investment",
auth,
requireActiveAccess,
(req, res) => {

try{

/* ===============================
SAFE NUMBER CONVERSION
=============================== */

const cost = Number(req.body.cost) || 0;
const rent = Number(req.body.rent) || 0;
const expenses = Number(req.body.expenses) || 0;
const vacancyPct = Number(req.body.vacancyPct) || 0;
const years = Number(req.body.years) || 0;

/* ===============================
VACANCY FACTOR
=============================== */

const vacancyFactor = Math.max(0.01, 1 - vacancyPct / 100);

/* ===============================
INCOME CALCULATIONS
=============================== */

const annualIncome = rent * 12 * vacancyFactor;

const annualExpenses = expenses * 12;

const totalIncome = annualIncome * years;

const totalExpenses = annualExpenses * years;

/* ===============================
PROFIT
=============================== */

const profit = totalIncome - totalExpenses;

const monthlyProfit = annualIncome / 12 - annualExpenses / 12;

const annualProfit = annualIncome - annualExpenses;

/* ===============================
INVESTMENT METRICS
=============================== */

const roi = cost > 0 ? (profit / cost) * 100 : 0;

const margin = totalIncome > 0
? (profit / totalIncome) * 100
: 0;

/* ===============================
BREAK EVEN RENT
=============================== */

const breakEvenRent =
vacancyFactor > 0
? expenses / vacancyFactor
: 0;

/* ===============================
RISK LEVEL
=============================== */

let riskLevel = "Low";

if(roi < 8)
riskLevel = "High";
else if(roi < 15)
riskLevel = "Medium";

/* ===============================
DECISION ENGINE
=============================== */

let decision = "BUY";

let reason =
"Investment produces strong returns with acceptable risk.";

if(roi < 8 || monthlyProfit <= 0){

decision = "AVOID";

reason =
"Property does not produce sufficient return or monthly profit.";

}

else if(roi < 15){

decision = "REVIEW";

reason =
"Returns are moderate. Verify expenses, price, and rental demand.";

}

/* ===============================
RESPONSE
=============================== */

res.json({

annualIncome,
totalIncome,
totalExpenses,
profit,
roi,
margin,
monthlyProfit,
annualProfit,
breakEvenRent,
riskLevel,
decision,
reason

});

}
catch(err){

console.error(err);

res.status(500).json({
error: "Real estate calculator error"
});

}

}
);

/* ================= RENEWABLE ENERGY ================= */
router.post('/energy/renewable', auth, requireActiveAccess, (req, res) => {
  const { install, maintenance, revenue, years } = req.body;

  const totalCosts = install + maintenance * years;
  const totalRevenue = revenue * years;
  const profit = totalRevenue - totalCosts;

  const roi = install ? (profit / install) * 100 : 0;
  const payback = revenue ? Math.ceil(install / revenue) : null;

  res.json({
    totalCosts,
    totalRevenue,
    profit,
    roi,
    payback,
  });
});

/* ================= RESTAURANT OPTIMIZED (DROPDOWN READY) ================= */
router.post('/restaurant/operations', auth, requireActiveAccess, (req, res) => {

  const tables         = Math.max(0, toNum(req.body.tables));
  const coversPerTable = Math.max(0, toNum(req.body.coversPerTable));
  const avgCheck       = Math.max(0, toNum(req.body.avgCheck));
  const foodPct        = clamp(toNum(req.body.foodPct), 0, 100);
  const labor          = Math.max(0, toNum(req.body.labor));
  const fixed          = Math.max(0, toNum(req.body.fixed));
  const days           = Math.max(0, toNum(req.body.days));

  /* ================= CORE ================= */
  const dailyCovers    = tables * coversPerTable;
  const monthlyCovers  = dailyCovers * days;
  const monthlyRevenue = monthlyCovers * avgCheck;

  const foodCost   = monthlyRevenue * (foodPct / 100);
  const totalCosts = foodCost + labor + fixed;
  const profit     = monthlyRevenue - totalCosts;

  const margin     = monthlyRevenue > 0 ? (profit / monthlyRevenue) * 100 : 0;
  const costRatio  = monthlyRevenue > 0 ? (totalCosts / monthlyRevenue) * 100 : 0;
  const profitPerCover = monthlyCovers > 0 ? profit / monthlyCovers : 0;
  const laborRatio = monthlyRevenue > 0 ? (labor / monthlyRevenue) * 100 : 0;
  const breakevenCovers = avgCheck > 0 && days > 0
    ? Math.ceil(totalCosts / (avgCheck * days))
    : 0;

  const monthlyProfit = profit;
  const annualProfit  = profit * 12;

  /* ================= DECISION ================= */
  let decision = "Break-even";
  let riskLevel = "Medium";
  let advice = "Monitor operations.";

  if (profit <= 0) {
    decision = "❌ Losing Money";
    riskLevel = "High";
    advice = "Increase prices or reduce food/labor costs immediately.";
  } else if (margin < 10) {
    decision = "⚠ Dangerous";
    riskLevel = "High";
    advice = "Margins too thin. Small cost increases will kill profit.";
  } else if (margin < 20) {
    decision = "🟡 Moderate";
    riskLevel = "Medium";
    advice = "Profitable but needs optimization.";
  } else {
    decision = "✅ Strong";
    riskLevel = "Low";
    advice = "Healthy business. Focus on scaling.";
  }

  /* ================= SMART FLAGS ================= */
  const flags = {
    highFoodCost: foodPct > 35,
    highLabor: laborRatio > 30,
    lowMargin: margin < 10,
    loss: profit <= 0
  };

  /* ================= GROUPED STEPS ================= */
  const insights = {

    summary: [
      {
        title: "Revenue vs Costs",
        message:
          totalCosts <= monthlyRevenue
            ? `Revenue covers costs. You're profitable.`
            : `You're losing R${Math.abs(profit).toFixed(2)} monthly.`
      }
    ],

    profitability: [
      {
        title: "Margin",
        message:
          margin >= 20
            ? `Strong margin (${margin.toFixed(2)}%).`
            : margin >= 10
            ? `Moderate margin (${margin.toFixed(2)}%). Improve pricing or volume.`
            : `Low margin (${margin.toFixed(2)}%). High risk.`
      },
      {
        title: "Profit per Customer",
        message:
          profitPerCover <= 0
            ? `You lose money per customer.`
            : profitPerCover < 20
            ? `Low profit per customer. Upsell needed.`
            : `Healthy profit per customer.`
      }
    ],

    costs: [
      {
        title: "Food Cost",
        message:
          foodPct <= 28
            ? `Excellent food cost (${foodPct}%).`
            : foodPct <= 35
            ? `Acceptable food cost (${foodPct}%).`
            : `Too high (${foodPct}%). Reduce to 30% to save money.`
      },
      {
        title: "Labor Cost",
        message:
          laborRatio <= 30
            ? `Labor under control (${laborRatio.toFixed(2)}%).`
            : `Labor too high (${laborRatio.toFixed(2)}%). Reduce staffing or increase volume.`
      }
    ],

    operations: [
      {
        title: "Break-even",
        message:
          dailyCovers >= breakevenCovers
            ? `Above break-even by ${dailyCovers - breakevenCovers} customers/day.`
            : `Need ${breakevenCovers - dailyCovers} more customers/day.`
      }
    ],

    growth: [
      {
        title: "Annual Projection",
        message:
          annualProfit <= 0
            ? `Annual loss projected. Fix urgently.`
            : annualProfit < 100000
            ? `Small profit. Growth needed.`
            : `Strong annual profit. Consider expansion.`
      }
    ]

  };

  /* ================= RESPONSE ================= */
  res.json({
    dailyCovers,
    monthlyRevenue,
    foodCost,
    totalCosts,
    profit,
    margin,
    costRatio,
    laborRatio,
    profitPerCover,
    breakevenCovers,
    monthlyProfit,
    annualProfit,

    decision,
    riskLevel,
    advice,
    flags,

    insights   // 👈 NEW STRUCTURE FOR DROPDOWNS
  });

});

/* ================= RETAIL ================= */
router.post('/retail/business', auth, requireActiveAccess, (req, res) => {
  const { units, cost, price, fixed, labor, operational } = req.body;

  const revenue = units * price;
  const cogs = units * cost;
  const gross = revenue - cogs;
  const totalCosts = cogs + fixed + labor + operational;
  const profit = revenue - totalCosts;

  const margin = revenue ? (profit / revenue) * 100 : 0;
  const markup = cost ? ((price - cost) / cost) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const ratio = revenue ? (totalCosts / revenue) * 100 : 0;

  const breakeven =
    price > cost
      ? Math.ceil((fixed + labor + operational) / (price - cost))
      : null;

  const profitPerUnit = price - cost;
  const monthlyProfit = profit;
  const annualProfit = profit * 12;

  res.json({
    revenue,
    cogs,
    gross,
    totalCosts,
    profit,
    margin,
    markup,
    roi,
    ratio,
    breakeven,
    profitPerUnit,
    monthlyProfit,
    annualProfit,
  });
});

/* ================= SAAS ================= */
router.post('/saas/business', auth, requireActiveAccess, (req, res) => {
  const { mrr, churnPct, dev, infra, support, marketing } = req.body;

  const churnLoss = mrr * (churnPct / 100);
  const netMRR = mrr - churnLoss;

  const totalCosts = dev + infra + support + marketing;
  const profit = netMRR - totalCosts;

  const margin = mrr ? (profit / mrr) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  const runway =
    profit < 0 && totalCosts > 0 ? Math.floor(mrr / totalCosts) : null;

  res.json({
    mrr,
    netMRR,
    churnLoss,
    totalCosts,
    profit,
    margin,
    roi,
    runway,
  });
});

/* ================= SOCIAL ENTERPRISE/ COMMUNITY PROGRAM ================= */
router.post('/social/enterprise', auth, requireActiveAccess, (req, res) => {
  const { participants, fee, staff, supplies, operational } = req.body;

  const revenue = participants * fee;
  const totalCosts = staff + supplies + operational;
  const netImpact = revenue - totalCosts;

  const margin = revenue ? (netImpact / revenue) * 100 : 0;

  const roi = totalCosts ? (netImpact / totalCosts) * 100 : 0;

  res.json({
    participants,
    revenue,
    totalCosts,
    netImpact,
    margin,
    roi,
  });
});

/* ================= SOFTWARE ================= */
router.post('/software/business', auth, requireActiveAccess, (req, res) => {
  const { units, price, dev, labor, ops } = req.body;

  const revenue = units * price;
  const totalCosts = dev + labor + ops;
  const profit = revenue - totalCosts;

  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  res.json({ units, revenue, totalCosts, profit, margin, roi });
});


/* ================= TELECOM ================= */
router.post('/telecom/business', auth, requireActiveAccess, (req, res) => {
  const { subs, price, infra, labor, ops } = req.body;

  const revenue = subs * price;
  const totalCosts = infra + labor + ops;
  const profit = revenue - totalCosts;

  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  res.json({
    subs,
    revenue,
    totalCosts,
    profit,
    margin,
    roi,
    monthlyProfit: profit,
    annualProfit: profit * 12,
  });
});

/* ================= TEXTILES ================= */
router.post('/textiles/business', auth, requireActiveAccess, (req, res) => {
  const { units, price, material, labor, fixed, operational } = req.body;

  const materialTotal = material * units;
  const totalCosts = materialTotal + labor + fixed + operational;
  const revenue = units * price;
  const profit = revenue - totalCosts;

  const margin = revenue ? (profit / revenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  res.json({
    units,
    revenue,
    materialTotal,
    totalCosts,
    profit,
    margin,
    roi,
  });
});

export default router;
