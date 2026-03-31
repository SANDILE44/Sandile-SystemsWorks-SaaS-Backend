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


/* ================= CONSTRUCTION WITH STEPS ================= */
router.post('/construction/project', auth, requireActiveAccess, (req, res) => {
  let {
    value,
    material,
    laborMonthly,
    equipmentMonthly,
    fixedMonthly,
    months,
  } = req.body;

  // ===== SANITIZE INPUTS =====
  value = Number(value) || 0;
  material = Number(material) || 0;
  laborMonthly = Number(laborMonthly) || 0;
  equipmentMonthly = Number(equipmentMonthly) || 0;
  fixedMonthly = Number(fixedMonthly) || 0;
  months = Number(months) > 0 ? Number(months) : 0;

  // ===== TOTAL COSTS =====
  const laborTotal = laborMonthly * months;
  const equipmentTotal = equipmentMonthly * months;
  const fixedTotal = fixedMonthly * months;

  const totalCosts = material + laborTotal + equipmentTotal + fixedTotal;

  // ===== PROFIT =====
  const profit = value - totalCosts;
  const margin = value ? (profit / value) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const costRatio = value ? (totalCosts / value) * 100 : 0;

  const breakEvenRevenue = totalCosts;

  const monthlyProfit = months ? profit / months : 0;
  const annualProfit = monthlyProfit * 12;

  // ===== PROFIT PER COST =====
  const profitPerMaterial = material ? profit / material : 0;
  const profitPerLabor = laborTotal ? profit / laborTotal : 0;
  const profitPerEquipment = equipmentTotal ? profit / equipmentTotal : 0;

  // ===== COST OVERRUN SIMULATION =====
  const overrun5 = totalCosts * 1.05;
  const overrun10 = totalCosts * 1.1;
  const overrun20 = totalCosts * 1.2;

  const profitOverrun5 = value - overrun5;
  const profitOverrun10 = value - overrun10;
  const profitOverrun20 = value - overrun20;

  // ===== DECISION ENGINE =====
  let decision = 'Strong Project';
  let riskLevel = 'Low';

  if (profit <= 0) {
    decision = 'Do Not Take';
    riskLevel = 'High';
  } else if (margin < 10) {
    decision = 'High Risk';
    riskLevel = 'High';
  } else if (margin < 20) {
    decision = 'Moderate Risk';
    riskLevel = 'Medium';
  }

  // ===== STEP-BY-STEP GUIDANCE =====
  let steps = [];

  steps.push({
    step: 'Revenue vs Costs',
    message: totalCosts <= value
      ? 'Revenue covers costs. Proceed with caution and monitor expenses.'
      : 'Revenue is less than total costs. Re-evaluate project scope or pricing.'
  });

  steps.push({
    step: 'Profit Margin Check',
    message: margin >= 20
      ? `Healthy margin (${margin.toFixed(2)}%). Good buffer for unexpected costs.`
      : margin >= 10
      ? `Moderate margin (${margin.toFixed(2)}%). Monitor costs closely.`
      : `Low margin (${margin.toFixed(2)}%). High risk of loss.`
  });

  steps.push({
    step: 'Largest Cost Driver',
    message: (() => {
      const costs = [
        { name: 'Material', value: material },
        { name: 'Labor', value: laborTotal },
        { name: 'Equipment', value: equipmentTotal },
        { name: 'Fixed', value: fixedTotal },
      ];
      const maxCost = costs.reduce((a, b) => (a.value > b.value ? a : b));
      return `Largest cost contributor is ${maxCost.name} (R${maxCost.value}). Consider optimization.`;
    })()
  });

  steps.push({
    step: 'Overrun Simulation',
    message: `If costs increase by 5-20%, profits will range: 
      R${profitOverrun5.toFixed(2)} (5%), 
      R${profitOverrun10.toFixed(2)} (10%), 
      R${profitOverrun20.toFixed(2)} (20%). Plan contingencies accordingly.`
  });

  steps.push({
    step: 'Break-even Revenue',
    message: `Minimum revenue to break-even: R${breakEvenRevenue.toFixed(2)}. Avoid quoting below this.`
  });

  steps.push({
    step: 'Risk Assessment',
    message: riskLevel === 'High'
      ? 'High risk project. Only proceed if unavoidable.'
      : riskLevel === 'Medium'
      ? 'Moderate risk. Monitor costs and schedule closely.'
      : 'Low risk. Project financially sound.'
  });

  res.json({
    value,
    material,
    laborTotal,
    equipmentTotal,
    fixedTotal,
    totalCosts,
    profit,
    margin,
    roi,
    costRatio,
    breakEvenRevenue,
    profitPerMaterial,
    profitPerLabor,
    profitPerEquipment,
    monthlyProfit,
    annualProfit,
    profitOverrun5,
    profitOverrun10,
    profitOverrun20,
    decision,
    riskLevel,
    steps
  });
});

/* ================= CONSULTING ================= */
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

  // ===== SAFE NUMBER CONVERSION =====
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

  // ===== REVENUE =====
  const baseRevenue = hours * rate;
  const overtimeRevenue = otHours * otRate;
  const totalRevenue = baseRevenue + overtimeRevenue;

  const discountAmount = totalRevenue * (discountPct / 100);
  const revenueAfterDiscount = totalRevenue - discountAmount;

  // ===== COSTS =====
  const baseCosts = expenses + labor + fixed + variableCosts;
  const contingencyAmount = baseCosts * (contingencyPct / 100);
  const totalCosts = baseCosts + contingencyAmount;

  // ===== PROFIT =====
  const profit = revenueAfterDiscount - totalCosts;
  const profitPerHour = hours > 0 ? profit / hours : 0;
  const costPerHour = hours > 0 ? totalCosts / hours : 0;
  const margin = revenueAfterDiscount > 0 ? (profit / revenueAfterDiscount) * 100 : 0;
  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const breakevenHours = rate > 0 ? totalCosts / rate : 0;

  // ===== DECISION ENGINE =====
  let decision = "Break-even";
  let riskLevel = "Medium";
  let advice = "Monitor project closely for costs and revenue.";

  // ===== STEP-BY-STEP SUGGESTIONS =====
  const steps = [];

  if (profit <= 0) {
    decision = "❌ Do Not Take";
    riskLevel = "High";
    advice = "This project will lose money. Follow the steps below to fix it.";

    // Suggest increasing rate
    if (rate > 0) {
      const suggestedRate = Math.ceil(totalCosts / hours * 1.1); // 10% margin
      steps.push({
        action: "Increase Hourly Rate",
        current: rate,
        suggested: suggestedRate,
        reason: "Profit is negative. Raising rate will make project profitable."
      });
    }

    // Suggest reducing fixed costs if possible
    if (fixed > 0) {
      const suggestedFixed = Math.max(fixed * 0.7, 0); // reduce 30%
      steps.push({
        action: "Reduce Fixed Costs",
        current: fixed,
        suggested: suggestedFixed,
        reason: "Lowering fixed costs helps avoid loss without touching hours."
      });
    }

    // Suggest reducing discount
    if (discountPct > 0) {
      steps.push({
        action: "Reduce Discount",
        current: discountPct,
        suggested: Math.max(discountPct - 10, 0),
        reason: "Reducing discount increases revenue after discount."
      });
    }
  } else if (margin < 10) {
    decision = "⚠ High Risk";
    riskLevel = "High";
    advice = "Margin is very thin. Follow the steps below.";

    // Suggest raising rate slightly
    steps.push({
      action: "Increase Hourly Rate",
      current: rate,
      suggested: Math.ceil(rate * 1.1),
      reason: "Small increase can make project safer."
    });

    // Suggest lowering variable costs
    if (variableCosts > 0) {
      steps.push({
        action: "Reduce Variable Costs",
        current: variableCosts,
        suggested: Math.max(variableCosts * 0.8, 0),
        reason: "Lower variable costs to increase margin."
      });
    }
  } else if (margin < 20) {
    decision = "🟡 Moderate Risk";
    riskLevel = "Medium";
    advice = "Profitable but tight. Small adjustments recommended.";

    steps.push({
      action: "Monitor Overtime Hours",
      current: otHours,
      suggested: otHours,
      reason: "Keep overtime low to maintain margin."
    });

    steps.push({
      action: "Monitor Expenses",
      current: baseCosts,
      suggested: baseCosts,
      reason: "Track expenses to ensure margin doesn't drop."
    });
  } else {
    decision = "✅ Strong Project";
    riskLevel = "Low";
    advice = "Healthy margin. Consider minor optimizations.";

    steps.push({
      action: "Consider Negotiating Higher Rate",
      current: rate,
      suggested: rate,
      reason: "Optional: you may increase rate if client allows."
    });
  }

  // ===== RESPONSE =====
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
    steps, // <-- new field for step-by-step guidance
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

/* ================= LOGISTICS ROUTES ================= */
    /* =====================================================
   LOGISTICS — MONTHLY OPERATIONS
   POST /logistics/business
===================================================== */
router.post(
  '/logistics/business',
  auth,
  requireActiveAccess,
  (req, res) => {

    const shipments = Math.max(0, Math.floor(toNum(req.body.shipments)));
    const revenuePer = Math.max(0, toNum(req.body.revenuePer));
    const fuel = Math.max(0, toNum(req.body.fuel));
    const labor = Math.max(0, toNum(req.body.labor));
    const maintenance = Math.max(0, toNum(req.body.maintenance));
    const fixed = Math.max(0, toNum(req.body.fixed));

    const totalRevenue = shipments * revenuePer;
    const totalCosts = fuel + labor + maintenance + fixed;
    const profit = totalRevenue - totalCosts;

    const costPerShipment =
      shipments > 0 ? totalCosts / shipments : 0;

    const profitPerShipment =
      shipments > 0 ? profit / shipments : 0;

    const margin =
      totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const roi =
      totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

    const breakEvenShipments =
      revenuePer > 0 ? Math.ceil(totalCosts / revenuePer) : 0;

    const annualProfit = profit * 12;

    const fuelPercent =
      totalCosts > 0 ? (fuel / totalCosts) * 100 : 0;

    const laborPercent =
      totalCosts > 0 ? (labor / totalCosts) * 100 : 0;

    const maintenancePercent =
      totalCosts > 0 ? (maintenance / totalCosts) * 100 : 0;

    const fixedPercent =
      totalCosts > 0 ? (fixed / totalCosts) * 100 : 0;

    let status = 'Break-even';
    if (profit > 0) status = 'Profitable';
    if (profit < 0) status = 'Loss';

    let riskLevel = 'Low';
    if (profit < 0) riskLevel = 'High';
    else if (margin < 8) riskLevel = 'High';
    else if (margin < 15) riskLevel = 'Medium';

    const targetMargin = 20;

    const recommendedPricePerShipment =
      costPerShipment > 0
        ? costPerShipment / (1 - targetMargin / 100)
        : 0;

    let safetyStatus = 'Healthy';
    if (profit < 0) safetyStatus = 'Critical';
    else if (margin < 10) safetyStatus = 'At Risk';

    let advice =
      'Operations stable. Maintain margin discipline.';

    if (profit < 0) {
      advice =
        'Operating at a loss. Increase pricing or reduce largest cost driver immediately.';
    } else if (margin < 10) {
      advice =
        'Margins are thin. Small cost increases could wipe out profit.';
    } else if (margin >= 20) {
      advice =
        'Strong margin zone. You have operational buffer and pricing power.';
    }

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
    });
  }
);


/* ================= LOGISTICS ROUTES WITH STEPS ================= */
const express = require('express');
const router = express.Router();
const { auth, requireActiveAccess, toNum, clamp } = require('../middleware/utils');

/* =====================================================
   LOGISTICS — MONTHLY OPERATIONS
===================================================== */
router.post('/logistics/business', auth, requireActiveAccess, (req, res) => {

  const shipments = Math.max(0, Math.floor(toNum(req.body.shipments)));
  const revenuePer = Math.max(0, toNum(req.body.revenuePer));
  const fuel = Math.max(0, toNum(req.body.fuel));
  const labor = Math.max(0, toNum(req.body.labor));
  const maintenance = Math.max(0, toNum(req.body.maintenance));
  const fixed = Math.max(0, toNum(req.body.fixed));

  const totalRevenue = shipments * revenuePer;
  const totalCosts = fuel + labor + maintenance + fixed;
  const profit = totalRevenue - totalCosts;
  const costPerShipment = shipments > 0 ? totalCosts / shipments : 0;
  const profitPerShipment = shipments > 0 ? profit / shipments : 0;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const breakEvenShipments = revenuePer > 0 ? Math.ceil(totalCosts / revenuePer) : 0;
  const annualProfit = profit * 12;

  // Percent cost breakdown
  const fuelPercent = totalCosts > 0 ? (fuel / totalCosts) * 100 : 0;
  const laborPercent = totalCosts > 0 ? (labor / totalCosts) * 100 : 0;
  const maintenancePercent = totalCosts > 0 ? (maintenance / totalCosts) * 100 : 0;
  const fixedPercent = totalCosts > 0 ? (fixed / totalCosts) * 100 : 0;

  // Statuses
  let status = 'Break-even';
  if (profit > 0) status = 'Profitable';
  if (profit < 0) status = 'Loss';

  let riskLevel = 'Low';
  if (profit < 0) riskLevel = 'High';
  else if (margin < 8) riskLevel = 'High';
  else if (margin < 15) riskLevel = 'Medium';

  const targetMargin = 20;
  const recommendedPricePerShipment = costPerShipment > 0
    ? costPerShipment / (1 - targetMargin / 100)
    : 0;

  let safetyStatus = 'Healthy';
  if (profit < 0) safetyStatus = 'Critical';
  else if (margin < 10) safetyStatus = 'At Risk';

  let advice = 'Operations stable. Maintain margin discipline.';
  if (profit < 0) advice = 'Operating at a loss. Increase pricing or reduce largest cost driver immediately.';
  else if (margin < 10) advice = 'Margins are thin. Small cost increases could wipe out profit.';
  else if (margin >= 20) advice = 'Strong margin zone. You have operational buffer and pricing power.';

  // ================== STEP-BY-STEP GUIDANCE ==================
  let steps = [];

  steps.push({
    step: 'Revenue vs Costs',
    message: totalRevenue >= totalCosts
      ? 'Revenue covers all costs. Good start.'
      : 'Revenue is lower than total costs. Review pricing or reduce largest cost driver.'
  });

  steps.push({
    step: 'Profit Margin Analysis',
    message: margin >= 20
      ? 'Margin is strong. You have buffer for unexpected costs.'
      : margin >= 10
      ? 'Margin is moderate. Monitor expenses closely.'
      : 'Margin is low. Consider increasing rates or cutting major expenses.'
  });

  // Highlight largest cost driver
  const costs = [
    { name: 'Fuel', value: fuel },
    { name: 'Labor', value: labor },
    { name: 'Maintenance', value: maintenance },
    { name: 'Fixed Costs', value: fixed }
  ];
  const maxCost = costs.reduce((a, b) => (a.value > b.value ? a : b));
  steps.push({
    step: 'Largest Cost Driver',
    message: `Your largest cost is ${maxCost.name} (${maxCost.value}). Review if it can be optimized.`
  });

  steps.push({
    step: 'Pricing Recommendation',
    message: `Recommended price per shipment to target ${targetMargin}% margin: R${recommendedPricePerShipment.toFixed(2)}. Adjust pricing carefully.`
  });

  steps.push({
    step: 'Risk Assessment',
    message: riskLevel === 'High'
      ? 'High risk detected. Avoid below-cost shipments.'
      : riskLevel === 'Medium'
      ? 'Medium risk. Monitor key metrics.'
      : 'Low risk. Operations stable.'
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
===================================================== */
router.post('/logistics/shipment', auth, requireActiveAccess, (req, res) => {
  const quote = Math.max(0, toNum(req.body.quote));
  const minMargin = clamp(toNum(req.body.minMargin), 0, 99.99);
  const buffer = clamp(toNum(req.body.buffer), 0, 99.99);

  const distance = Math.max(0, toNum(req.body.distance));
  const fuelPerKm = Math.max(0, toNum(req.body.fuelPerKm));
  const vehiclePerKm = Math.max(0, toNum(req.body.vehiclePerKm));
  const loadFactor = clamp(toNum(req.body.loadFactor) || 100, 1, 200);

  const drivingHours = Math.max(0, toNum(req.body.drivingHours));
  const waitHours = Math.max(0, toNum(req.body.waitHours));
  const driverRate = Math.max(0, toNum(req.body.driverRate));

  const tolls = Math.max(0, toNum(req.body.tolls));
  const permits = Math.max(0, toNum(req.body.permits));
  const otherFees = Math.max(0, toNum(req.body.otherFees));

  const cargoValue = Math.max(0, toNum(req.body.cargoValue));
  const insuranceRate = clamp(toNum(req.body.insuranceRate), 0, 100);

  const duties = Math.max(0, toNum(req.body.duties));
  const handling = Math.max(0, toNum(req.body.handling));
  const passThrough = Math.max(0, toNum(req.body.passThrough));

  // ----- Costs -----
  const fuelCost = distance * fuelPerKm;
  const vehicleCost = distance * vehiclePerKm;
  const timeCost = (drivingHours + waitHours) * driverRate;
  const insuranceCost = (insuranceRate / 100) * cargoValue;

  const baseCost = fuelCost + vehicleCost + timeCost + tolls + permits + otherFees + insuranceCost + duties + handling + passThrough;
  const totalCost = baseCost * (100 / loadFactor);
  const profit = quote - totalCost;
  const margin = quote > 0 ? (profit / quote) * 100 : 0;
  const requiredMargin = clamp(minMargin + buffer, 0, 99.99);
  let recommendedMinQuote = requiredMargin > 0 && requiredMargin < 100 ? totalCost / (1 - requiredMargin / 100) : totalCost;

  // Decision
  let decision = 'REVIEW';
  let reason = 'Review shipment before approval.';
  if (quote === 0) {
    decision = 'REVIEW';
    reason = 'Enter client quote to evaluate.';
  } else if (margin >= requiredMargin) {
    decision = 'APPROVE';
    reason = 'Shipment meets required margin and buffer.';
  } else if (margin < minMargin) {
    decision = 'REJECT';
    reason = 'Shipment below minimum margin requirement.';
  }

  let shipmentRisk = 'Low';
  if (profit < 0) shipmentRisk = 'High';
  else if (margin < requiredMargin) shipmentRisk = 'Medium';

  // Step-by-step guidance
  let steps = [];
  steps.push({
    step: 'Evaluate Costs',
    message: `Total cost for this shipment: R${totalCost.toFixed(2)}. Compare against quote.`
  });
  steps.push({
    step: 'Margin Check',
    message: margin >= requiredMargin
      ? `Margin is healthy (${margin.toFixed(2)}%).`
      : `Margin is below target (${margin.toFixed(2)}%). Consider increasing quote or reducing costs.`
  });
  steps.push({
    step: 'Largest Cost Driver',
    message: `Review top contributors: Fuel (R${fuelCost}), Vehicle (R${vehicleCost}), Time (R${timeCost}).`
  });
  steps.push({
    step: 'Recommended Minimum Quote',
    message: `To achieve target margin of ${requiredMargin}%, quote should be at least R${recommendedMinQuote.toFixed(2)}.`
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
===================================================== */
router.post('/logistics/freight', auth, requireActiveAccess, (req, res) => {

  const quote = Math.max(0, toNum(req.body.quote));
  const cargoValue = Math.max(0, toNum(req.body.cargoValue));
  const insuranceRate = clamp(toNum(req.body.insuranceRate), 0, 100);

  const freightCost = Math.max(0, toNum(req.body.freightCost));
  const fuelSurcharge = Math.max(0, toNum(req.body.fuelSurcharge));
  const dutyRate = clamp(toNum(req.body.dutyRate), 0, 100);
  const customsFees = Math.max(0, toNum(req.body.customsFees));
  const portFees = Math.max(0, toNum(req.body.portFees));
  const handlingFees = Math.max(0, toNum(req.body.handlingFees));
  const inlandTransport = Math.max(0, toNum(req.body.inlandTransport));
  const tollCosts = Math.max(0, toNum(req.body.tollCosts));
  const otherCosts = Math.max(0, toNum(req.body.otherCosts));

  const insuranceCost = (insuranceRate / 100) * cargoValue;
  const duties = (dutyRate / 100) * cargoValue;

  const totalCost = freightCost + fuelSurcharge + insuranceCost + duties + customsFees + portFees + handlingFees + inlandTransport + tollCosts + otherCosts;
  const profit = quote - totalCost;
  const margin = quote > 0 ? (profit / quote) * 100 : 0;
  const breakEvenQuote = totalCost;

  // Decision engine
  let decision = 'REVIEW';
  let reason = 'Shipment needs evaluation.';
  if (profit < 0) {
    decision = 'REJECT';
    reason = 'Shipment results in a loss.';
  } else if (margin < 10) {
    decision = 'REVIEW';
    reason = 'Margin is very thin for freight risk.';
  } else if (margin >= 20) {
    decision = 'APPROVE';
    reason = 'Healthy freight margin.';
  }

  let riskLevel = 'Low';
  if (profit < 0) riskLevel = 'High';
  else if (margin < 15) riskLevel = 'Medium';

  // Steps
  let steps = [];
  steps.push({
    step: 'Evaluate Costs',
    message: `Total freight costs: R${totalCost.toFixed(2)}. Compare against client quote.`
  });
  steps.push({
    step: 'Profit Margin Check',
    message: margin >= 20
      ? `Margin is strong at ${margin.toFixed(2)}%.`
      : margin >= 10
      ? `Margin is moderate at ${margin.toFixed(2)}%.`
      : `Margin is low at ${margin.toFixed(2)}%. Consider revising quote or reducing expenses.`
  });
  steps.push({
    step: 'Break-even Check',
    message: `Break-even quote: R${breakEvenQuote.toFixed(2)}. Avoid quotes below this value.`
  });
  steps.push({
    step: 'Risk Assessment',
    message: riskLevel === 'High'
      ? 'High risk detected. Avoid below-cost shipments.'
      : riskLevel === 'Medium'
      ? 'Medium risk. Monitor key metrics.'
      : 'Low risk. Operations stable.'
  });

  res.json({
    insuranceCost,
    duties,
    totalCost,
    profit,
    margin,
    breakEvenQuote,
    decision,
    reason,
    riskLevel,
    steps
  });
});


/* ================= MANUFACTURING WITH STEPS ================= */

router.post('/manufacturing/business', auth, requireActiveAccess, (req, res) => {

  let {
    units,
    price,
    material,
    labor,
    fixed,
    operational
  } = req.body;

  /* ===============================
     SAFE NUMBER CONVERSION
  ================================ */

  units = Number(units) || 0;
  price = Number(price) || 0;
  material = Number(material) || 0;
  labor = Number(labor) || 0;
  fixed = Number(fixed) || 0;
  operational = Number(operational) || 0;

  /* ===============================
     CORE CALCULATIONS
  ================================ */

  const revenue = units * price;

  const totalCosts = (units * material) + labor + fixed + operational;

  const profit = revenue - totalCosts;

  /* ===============================
     UNIT ECONOMICS
  ================================ */

  const costPerUnit = units > 0 ? totalCosts / units : 0;
  const profitPerUnit = units > 0 ? profit / units : 0;
  const revenuePerUnit = units > 0 ? revenue / units : 0;

  /* ===============================
     BREAK-EVEN ANALYSIS
  ================================ */

  const contributionMargin = price - material;

  const breakeven = contributionMargin > 0
    ? Math.ceil((fixed + operational) / contributionMargin)
    : 0;

  /* ===============================
     PERFORMANCE METRICS
  ================================ */

  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  /* ===============================
     PROJECTIONS
  ================================ */

  const monthlyRevenue = revenue;
  const annualRevenue = revenue * 12;

  /* ===============================
     STEP-BY-STEP GUIDANCE
  ================================ */

  let steps = [];

  steps.push({
    step: 'Revenue vs Costs',
    message: totalCosts <= revenue
      ? 'Revenue covers costs. You are in a sustainable zone.'
      : 'Revenue is less than total costs. Review pricing, reduce costs, or adjust production volume.'
  });

  steps.push({
    step: 'Profit Margin Check',
    message: margin >= 20
      ? `Strong margin (${margin.toFixed(2)}%). Good buffer for unexpected costs.`
      : margin >= 10
      ? `Moderate margin (${margin.toFixed(2)}%). Watch for cost increases.`
      : `Low margin (${margin.toFixed(2)}%). High risk of loss. Consider re-evaluating pricing or material costs.`
  });

  steps.push({
    step: 'Largest Cost Driver',
    message: (() => {
      const costs = [
        { name: 'Material', value: units * material },
        { name: 'Labor', value: labor },
        { name: 'Fixed', value: fixed },
        { name: 'Operational', value: operational }
      ];
      const maxCost = costs.reduce((a, b) => (a.value > b.value ? a : b));
      return `Largest cost contributor is ${maxCost.name} (R${maxCost.value}). Consider optimization.`;
    })()
  });

  steps.push({
    step: 'Break-even Analysis',
    message: `Minimum units to sell to cover fixed & operational costs: ${breakeven} units. Avoid producing less.`
  });

  steps.push({
    step: 'Unit Economics',
    message: `Profit per unit: R${profitPerUnit.toFixed(2)}. Cost per unit: R${costPerUnit.toFixed(2)}. Ensure unit pricing covers material and operational costs.`
  });

  steps.push({
    step: 'Risk Assessment',
    message: profit <= 0
      ? 'Project operating at a loss. Adjust pricing or reduce costs.'
      : margin < 10
      ? 'Margins are thin. Be cautious with production and cost spikes.'
      : 'Profit healthy. Continue monitoring costs and production efficiency.'
  });

  /* ===============================
     RESPONSE
  ================================ */

  res.json({
    units,
    revenue,
    totalCosts,
    costPerUnit,
    revenuePerUnit,
    profitPerUnit,
    profit,
    breakeven,
    roi,
    margin,
    monthlyRevenue,
    annualRevenue,
    steps
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


/* ================= RESTAURANT WITH STEPS ================= */  
router.post('/restaurant/operations', auth, requireActiveAccess, (req, res) => {  
  const tables         = Math.max(0, toNum(req.body.tables));  
  const coversPerTable = Math.max(0, toNum(req.body.coversPerTable));  
  const avgCheck       = Math.max(0, toNum(req.body.avgCheck));  
  const foodPct        = clamp(toNum(req.body.foodPct), 0, 100);  
  const labor          = Math.max(0, toNum(req.body.labor));  
  const fixed          = Math.max(0, toNum(req.body.fixed));  
  const days           = Math.max(0, toNum(req.body.days));  

  /* ==========================
     CORE CALCULATIONS
  ========================== */
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
  const breakevenCovers = avgCheck > 0 && days > 0 ? Math.ceil(totalCosts / (avgCheck * days)) : 0;  

  const monthlyProfit = profit;  
  const annualProfit  = profit * 12;  

  /* ==========================
     DECISION / STATUS
  ========================== */
  let status   = 'Break-even';  
  let riskLevel = 'Medium';  
  let advice   = 'Monitor pricing and costs for better performance.';  

  if (profit <= 0) {  
    status    = 'Loss';  
    riskLevel = 'High';  
    advice    = 'Operating at a loss. Increase pricing or reduce food and labor costs.';  
  } else if (margin < 10) {  
    status    = 'Dangerous Margin';  
    riskLevel = 'High';  
    advice    = 'Margin is too thin. Any cost increase could eliminate profit.';  
  } else if (margin < 20) {  
    status    = 'Moderate Profitability';  
    riskLevel = 'Medium';  
    advice    = 'Profitable but margin can improve. Optimize food and labor costs.';  
  } else {  
    status    = 'Strong Profitability';  
    riskLevel = 'Low';  
    advice    = 'Healthy margins. Scaling operations could significantly increase profit.';  
  }  

  if (foodPct > 35) {  
    advice = 'Food cost above industry standard of 35%. Reduce waste or renegotiate supplier prices.';  
  }  

  if (laborRatio > 30) {  
    advice = 'Labor cost exceeds 30% of revenue. Review staffing levels or increase covers per shift.';  
  }  

  /* ==========================
     STEP-BY-STEP GUIDANCE
  ========================== */
  const steps = [];

  steps.push({
    step: 'Revenue vs Costs',
    message: totalCosts <= monthlyRevenue
      ? 'Revenue covers costs. Operations are sustainable.'
      : 'Revenue is below costs. Consider increasing pricing or reducing major costs.'
  });

  steps.push({
    step: 'Profit Margin Check',
    message: margin >= 20
      ? `Strong margin (${margin.toFixed(2)}%). Good buffer for unexpected costs.`
      : margin >= 10
      ? `Moderate margin (${margin.toFixed(2)}%). Monitor cost changes carefully.`
      : `Low margin (${margin.toFixed(2)}%). High risk. Review pricing or reduce costs.`
  });

  steps.push({
    step: 'Largest Cost Contributor',
    message: (() => {
      const costs = [
        { name: 'Food', value: foodCost },
        { name: 'Labor', value: labor },
        { name: 'Fixed', value: fixed }
      ];
      const maxCost = costs.reduce((a, b) => (a.value > b.value ? a : b));
      return `Largest cost driver is ${maxCost.name} (R${maxCost.value.toFixed(2)}). Consider optimization.`;
    })()
  });

  steps.push({
    step: 'Break-even Analysis',
    message: `Minimum covers per day to break even: ${breakevenCovers}. Ensure you consistently meet or exceed this number.`
  });

  steps.push({
    step: 'Profit per Cover',
    message: `Profit per cover: R${profitPerCover.toFixed(2)}. Helps to evaluate pricing strategy per table.`
  });

  steps.push({
    step: 'Risk Assessment',
    message: profit <= 0
      ? 'Operations currently at a loss. Immediate action required.'
      : margin < 10
      ? 'Margins are thin. Watch for any increase in costs.'
      : 'Profit healthy. Continue monitoring for efficiency.'
  });

  /* ==========================
     RESPONSE
  ========================== */
  res.json({  
    dailyCovers,  
    monthlyCovers,  
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
    status,  
    riskLevel,  
    advice,
    steps
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