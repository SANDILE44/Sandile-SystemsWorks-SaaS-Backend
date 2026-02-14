import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

function hasCalculatorAccess(user) {
  const now = Date.now();
  const calcSub = user.subscriptions?.calculators;
  if (!calcSub) return false;

  // Active subscription
  if (calcSub.status === 'active') {
    // If no end date → allow
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
  const user = await User.findById(req.user.id).select('subscriptions');

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // 🔍 TEMP DEBUG (remove after confirmation)
  console.log('ACCESS CHECK', {
    userId: req.user.id,
    subscription: user.subscriptions?.calculators,
    now: new Date().toISOString(),
  });

  if (!hasCalculatorAccess(user)) {
    return res.status(403).json({ error: 'Payment required' });
  }

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
  const {
    value,
    material,
    laborMonthly,
    equipmentMonthly,
    fixedMonthly,
    months,
  } = req.body;

  const laborTotal = laborMonthly * months;
  const equipmentTotal = equipmentMonthly * months;
  const fixedTotal = fixedMonthly * months;

  const totalCosts = material + laborTotal + equipmentTotal + fixedTotal;

  const profit = value - totalCosts;

  const margin = value ? (profit / value) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
  const costRatio = value ? (totalCosts / value) * 100 : 0;

  const breakEvenRevenue = totalCosts;

  const profitPerMaterial = material ? profit / material : 0;
  const profitPerLabor = laborTotal ? profit / laborTotal : 0;
  const profitPerEquipment = equipmentTotal ? profit / equipmentTotal : 0;

  const monthlyProfit = months > 0 ? profit / months : 0;
  const annualProfit = months > 0 ? monthlyProfit * 12 : 0;

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

/* ================= LOGISTICS ================= */
router.post('/logistics/business', auth, requireActiveAccess, (req, res) => {
  const { shipments, revenuePer, fuel, labor, maintenance, fixed } = req.body;

  const totalRevenue = shipments * revenuePer;
  const totalCosts = fuel + labor + maintenance + fixed;
  const profit = totalRevenue - totalCosts;

  /* =========================
     CORE METRICS
  ========================= */
  const costPerShipment = shipments ? totalCosts / shipments : 0;
  const revenuePerShipment = shipments ? totalRevenue / shipments : 0;
  const profitPerShipment = shipments ? profit / shipments : 0;

  const margin = totalRevenue ? (profit / totalRevenue) * 100 : 0;
  const roi = totalCosts ? (profit / totalCosts) * 100 : 0;

  /* =========================
     DECISION METRICS (NEW)
  ========================= */

  // Break-even shipments (how many deliveries needed to survive)
  const contributionPerShipment = revenuePer - (shipments ? totalCosts / shipments : 0);
  const breakEvenShipments =
    revenuePer > 0 ? Math.ceil(totalCosts / revenuePer) : 0;

  // Cost structure insights
  const fuelPercent = totalCosts ? (fuel / totalCosts) * 100 : 0;
  const laborPercent = totalCosts ? (labor / totalCosts) * 100 : 0;
  const maintenancePercent = totalCosts ? (maintenance / totalCosts) * 100 : 0;

  // Monthly & annual projections
  const monthlyProfit = profit;
  const annualProfit = profit * 12;

  // Health status (SUPER IMPORTANT FOR CLIENTS)
  let status = 'Break-even';
  if (profit > 0) status = 'Profitable';
  if (profit < 0) status = 'Loss';

  res.json({
    shipments,
    totalRevenue,
    totalCosts,
    profit,

    costPerShipment,
    revenuePerShipment,
    profitPerShipment,

    margin,
    roi,

    breakEvenShipments,

    fuelPercent,
    laborPercent,
    maintenancePercent,

    monthlyProfit,
    annualProfit,

    status,
  });
});

/* ================= MANUFACTURING ================= */
router.post(
  '/manufacturing/business',
  auth,
  requireActiveAccess,
  (req, res) => {
    const { units, price, material, labor, fixed, operational } = req.body;

    const revenue = units * price;
    const totalCosts = units * material + labor + fixed + operational;
    const profit = revenue - totalCosts;

    const costPerUnit = units ? totalCosts / units : 0;
    const profitPerUnit = units ? profit / units : 0;

    const breakeven =
      price - material > 0 ? Math.ceil(fixed / (price - material)) : 0;

    const roi = totalCosts ? (profit / totalCosts) * 100 : 0;
    const margin = revenue ? (profit / revenue) * 100 : 0;

    const monthlyRevenue = revenue;
    const annualRevenue = revenue * 12;

    res.json({
      units,
      revenue,
      totalCosts,
      costPerUnit,
      profitPerUnit,
      profit,
      breakeven,
      roi,
      margin,
      monthlyRevenue,
      annualRevenue,
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
});

/* ================= PROPERTY INVESTMENT/ REAL ESTATE ================= */
router.post('/property/investment', auth, requireActiveAccess, (req, res) => {
  const { cost, rent, expenses, vacancyPct, years } = req.body;

  const annualIncome = rent * 12 * (1 - vacancyPct / 100);
  const annualExpenses = expenses * 12;

  const totalIncome = annualIncome * years;
  const totalExpenses = annualExpenses * years;
  const profit = totalIncome - totalExpenses;

  const roi = cost ? (profit / cost) * 100 : 0;
  const margin = totalIncome ? (profit / totalIncome) * 100 : 0;

  const monthlyProfit = annualIncome / 12 - annualExpenses / 12;

  const annualProfit = annualIncome - annualExpenses;

  res.json({
    annualIncome,
    totalIncome,
    totalExpenses,
    profit,
    roi,
    margin,
    monthlyProfit,
    annualProfit,
  });
});

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
router.post('/restaurant/operations', auth, requireActiveAccess, (req, res) => {
  const { tables, coversPerTable, avgCheck, foodPct, labor, fixed, days } =
    req.body;

  const dailyCovers = tables * coversPerTable;
  const monthlyRevenue = dailyCovers * avgCheck * days;

  const foodCost = monthlyRevenue * (foodPct / 100);
  const totalCosts = foodCost + labor + fixed;
  const profit = monthlyRevenue - totalCosts;

  const margin = monthlyRevenue ? (profit / monthlyRevenue) * 100 : 0;

  const costRatio = monthlyRevenue ? (totalCosts / monthlyRevenue) * 100 : 0;

  const profitPerCover =
    dailyCovers && days ? profit / (dailyCovers * days) : 0;

  const breakevenCovers =
    avgCheck > 0 && days > 0 ? Math.ceil(totalCosts / (avgCheck * days)) : null;

  const monthlyProfit = profit;
  const annualProfit = profit * 12;

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




