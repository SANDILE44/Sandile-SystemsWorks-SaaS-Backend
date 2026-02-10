// backend/calculators/agriculture.calc.js

exports.farm = (req, res) => {
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
};

exports.livestock = (req, res) => {
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
};
