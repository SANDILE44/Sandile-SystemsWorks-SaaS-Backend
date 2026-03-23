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
/* ================= CONSTRUCTION ================= */
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

  const totalCosts =
    material + laborTotal + equipmentTotal + fixedTotal;

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

    // Overrun simulations
    profitOverrun5,
    profitOverrun10,
    profitOverrun20,

    // Decision
    decision,
    riskLevel,
  });
});

/* ================= CONSULTING ================= */
router.post('/consulting/project', auth, requireActiveAccess, (req, res) => {
  const {
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

  const baseRevenue = hours * rate;
  const overtimeRevenue = otHours * otRate;
  const totalRevenue = baseRevenue + overtimeRevenue;

  const discountAmount = totalRevenue * (discountPct / 100);
  const revenueAfterDiscount = totalRevenue - discountAmount;

  const contingencyAmount =
    (expenses + labor + fixed + variableCosts) * (contingencyPct / 100);

  const totalCosts =
    expenses + labor + fixed + variableCosts + contingencyAmount;

  const profit = revenueAfterDiscount - totalCosts;
  const profitPerHour = hours > 0 ? profit / hours : 0;

  const margin = revenueAfterDiscount
    ? (profit / revenueAfterDiscount) * 100
    : 0;

  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const breakevenHours = rate > 0 ? totalCosts / rate : 0;

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
    margin,
    roi,
    breakevenHours,
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


/* =====================================================
   LOGISTICS — SHIPMENT ENGINE
   POST /logistics/shipment
===================================================== */
router.post(
  '/logistics/shipment',
  auth,
  requireActiveAccess,
  (req, res) => {

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

    const fuelCost = distance * fuelPerKm;
    const vehicleCost = distance * vehiclePerKm;
    const timeCost = (drivingHours + waitHours) * driverRate;
    const insuranceCost = (insuranceRate / 100) * cargoValue;

    const baseCost =
      fuelCost +
      vehicleCost +
      timeCost +
      tolls +
      permits +
      otherFees +
      insuranceCost +
      duties +
      handling +
      passThrough;

    const loadMultiplier = 100 / loadFactor;
    const totalCost = baseCost * loadMultiplier;

    const profit = quote - totalCost;
    const margin =
      quote > 0 ? (profit / quote) * 100 : 0;

    const requiredMargin =
      clamp(minMargin + buffer, 0, 99.99);

    let recommendedMinQuote = totalCost;

    if (requiredMargin > 0 && requiredMargin < 100) {
      recommendedMinQuote =
        totalCost / (1 - requiredMargin / 100);
    }

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

    res.json({
      totalCost,
      profit,
      margin,
      recommendedMinQuote,
      decision,
      reason,
      shipmentRisk,
    });
  }
);

/* =====================================================
   LOGISTICS — FREIGHT IMPORT / EXPORT ENGINE
   POST /logistics/freight
===================================================== */
router.post(
  '/logistics/freight',
  auth,
  requireActiveAccess,
  (req, res) => {

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

    /* ---------- CALCULATIONS ---------- */

    const insuranceCost = (insuranceRate / 100) * cargoValue;
    const duties = (dutyRate / 100) * cargoValue;

    const totalCost =
      freightCost +
      fuelSurcharge +
      insuranceCost +
      duties +
      customsFees +
      portFees +
      handlingFees +
      inlandTransport +
      tollCosts +
      otherCosts;

    const profit = quote - totalCost;

    const margin =
      quote > 0 ? (profit / quote) * 100 : 0;

    const breakEvenQuote = totalCost;

    /* ---------- DECISION ENGINE ---------- */

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

    res.json({
      insuranceCost,
      duties,
      totalCost,
      profit,
      margin,
      breakEvenQuote,
      decision,
      reason,
      riskLevel
    });

  }
);

/* ================= MANUFACTURING ================= */

router.post(
  '/manufacturing/business',
  auth,
  requireActiveAccess,
  (req, res) => {

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

    const totalCosts =
      (units * material) +
      labor +
      fixed +
      operational;

    const profit = revenue - totalCosts;


    /* ===============================
       UNIT ECONOMICS
    ================================ */

    const costPerUnit =
      units > 0 ? totalCosts / units : 0;

    const profitPerUnit =
      units > 0 ? profit / units : 0;

    const revenuePerUnit =
      units > 0 ? revenue / units : 0;


    /* ===============================
       BREAK-EVEN ANALYSIS
    ================================ */

    const contributionMargin =
      price - material;

    const breakeven =
      contributionMargin > 0
        ? Math.ceil((fixed + operational) / contributionMargin)
        : 0;


    /* ===============================
       PERFORMANCE METRICS
    ================================ */

    const roi =
      totalCosts > 0
        ? (profit / totalCosts) * 100
        : 0;

    const margin =
      revenue > 0
        ? (profit / revenue) * 100
        : 0;


    /* ===============================
       PROJECTIONS
    ================================ */

    const monthlyRevenue = revenue;
    const annualRevenue = revenue * 12;


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
      annualRevenue
    });

  }
);

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

/* ================= RESTAURANT ================= */
router.post(
  '/restaurant/operations',
  auth,
  requireActiveAccess,
  (req, res) => {
    // ===== SAFE INPUTS =====
    const tables = Math.max(0, toNum(req.body.tables));
    const coversPerTable = Math.max(0, toNum(req.body.coversPerTable));
    const avgCheck = Math.max(0, toNum(req.body.avgCheck));
    const foodPct = Math.max(0, toNum(req.body.foodPct));
    const labor = Math.max(0, toNum(req.body.labor));
    const fixed = Math.max(0, toNum(req.body.fixed));
    const days = Math.max(0, toNum(req.body.days));

    // ===== CORE CALCULATIONS =====
    const dailyCovers = tables * coversPerTable;
    const monthlyRevenue = dailyCovers * avgCheck * days;

    const foodCost = monthlyRevenue * (foodPct / 100);
    const totalCosts = foodCost + labor + fixed;

    const profit = monthlyRevenue - totalCosts;

    const margin = monthlyRevenue ? (profit / monthlyRevenue) * 100 : 0;
    const costRatio = monthlyRevenue ? (totalCosts / monthlyRevenue) * 100 : 0;
    const profitPerCover = dailyCovers && days ? profit / (dailyCovers * days) : 0;
    const breakevenCovers = avgCheck > 0 && days > 0 ? Math.ceil(totalCosts / (avgCheck * days)) : 0;
    const monthlyProfit = profit;
    const annualProfit = profit * 12;

    // ===== DECISION ENGINE =====
    let status = 'Break-even';
    if (profit > 0) status = 'Profitable';
    if (profit < 0) status = 'Loss';

    let advice = 'Monitor pricing and costs for better performance.';
    if (margin < 10) advice = 'Margin is low — consider increasing pricing or reducing costs.';
    else if (margin < 20) advice = 'Healthy margin, but there is room for optimization.';
    else advice = 'Strong profitability zone.';

    // ===== RESPONSE =====
    res.json({
      dailyCovers,
      monthlyRevenue,
      foodCost,
      totalCosts,
      profit,
      margin,
      costRatio,
      profitPerCover,
      breakevenCovers,
      monthlyProfit,
      annualProfit,
      status,
      advice,
    });
  }
);


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


















