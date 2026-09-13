// Simplified FIRE / capital-allocation engine — approximate model for prototyping only.
// All returns/spending are modelled in REAL (today's money) terms to avoid nominal/real bookkeeping.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randNormal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --- Scottish income tax + NI, 2024/25 bands, real-terms, no PA taper ---
const SCOT_BANDS = [
  [12570, 0], [14876, 0.19], [26561, 0.20], [43662, 0.21], [75000, 0.42], [125140, 0.45], [Infinity, 0.48],
];
export function scottishTax(taxable) {
  let tax = 0, prev = 0;
  for (const [top, rate] of SCOT_BANDS) {
    if (taxable <= prev) break;
    const slice = Math.min(taxable, top) - prev;
    tax += slice * rate;
    prev = top;
  }
  return Math.max(0, tax);
}
export function marginalRate(taxable) {
  for (const [top, rate] of SCOT_BANDS) if (taxable <= top) return rate + niMarginal(taxable);
  return 0.48;
}
function niMarginal(taxable) {
  if (taxable <= 12570) return 0;
  if (taxable <= 50270) return 0.08;
  return 0.02;
}
export function nationalInsurance(taxable) {
  if (taxable <= 12570) return 0;
  if (taxable <= 50270) return (taxable - 12570) * 0.08;
  return (50270 - 12570) * 0.08 + (taxable - 50270) * 0.02;
}

export function cashFlow({ salary, employeePct, employerPct, spendingMonthly }) {
  const employeeContribution = salary * employeePct;
  const employerContribution = salary * employerPct;
  const taxable = Math.max(0, salary - employeeContribution);
  const tax = scottishTax(taxable);
  const ni = nationalInsurance(taxable);
  const takeHome = taxable - tax - ni;
  const annualSpending = spendingMonthly * 12;
  return {
    employeeContribution, employerContribution, tax, ni, takeHome, annualSpending,
    investableSurplus: takeHome - annualSpending,
    pensionAdded: employeeContribution + employerContribution,
    marginal: marginalRate(taxable),
    savingsRate: takeHome > 0 ? (takeHome - annualSpending) / takeHome : 0,
  };
}

// --- portfolio return sampling (uncorrelated normal approximation) ---
const ASSET_STATS = {
  equities: { mean: 0.05, sd: 0.16 },
  bonds: { mean: 0.01, sd: 0.06 },
  cash: { mean: 0.0, sd: 0.01 },
};
function portfolioReturn(rng, portfolio) {
  return (
    portfolio.equities * (ASSET_STATS.equities.mean + ASSET_STATS.equities.sd * randNormal(rng)) +
    portfolio.bonds * (ASSET_STATS.bonds.mean + ASSET_STATS.bonds.sd * randNormal(rng)) +
    portfolio.cash * (ASSET_STATS.cash.mean + ASSET_STATS.cash.sd * randNormal(rng))
  );
}

// --- one lifecycle path ---
function simulatePath(rng, p) {
  const dragFactor = p.giaDragFactor ?? 0.94;
  let accessible = p.cash + p.isa + p.gia * dragFactor;
  let pension = p.pension;
  let salary = p.salary;
  let bridgeFail = false, depletionFail = false;
  let accessibleAtFire = null;
  if (p.extraLump) {
    if (p.extraLump.dest === 'pension') pension += p.extraLump.amount;
    else accessible += p.extraLump.amount;
  }
  for (let age = p.currentAge; age <= p.endAge; age++) {
    if (age === p.fireAge) accessibleAtFire = accessible;
    if (age < p.fireAge) {
      const cf = cashFlow({ salary, employeePct: p.employeePct, employerPct: p.employerPct, spendingMonthly: p.spendingCurrentMonthly });
      accessible += cf.investableSurplus;
      pension += cf.pensionAdded;
      salary *= 1 + p.salaryGrowth;
    } else {
      const spend = p.spendingFireMonthly * 12;
      if (age < p.accessAge) {
        accessible -= spend;
        if (accessible < 0) bridgeFail = true;
      } else {
        if (accessible >= spend) accessible -= spend;
        else {
          const remainder = spend - Math.max(accessible, 0);
          accessible = 0;
          pension -= remainder;
          if (pension < 0) depletionFail = true;
        }
      }
    }
    accessible *= 1 + portfolioReturn(rng, p.portfolio);
    pension *= 1 + portfolioReturn(rng, p.portfolio);
  }
  if (accessibleAtFire === null) accessibleAtFire = accessible;
  return {
    success: !bridgeFail && !depletionFail,
    bridgeFail, depletionFail,
    terminal: accessible + pension,
    accessibleAtFire,
  };
}

export function runMonteCarlo(p, runs = 600, seed = 421337) {
  const terminals = [], results = [];
  let successes = 0, bridgeFails = 0, depletionFails = 0;
  for (let i = 0; i < runs; i++) {
    const rng = mulberry32(seed + i * 7919);
    const r = simulatePath(rng, p);
    if (r.success) successes++;
    if (r.bridgeFail) bridgeFails++;
    if (r.depletionFail) depletionFails++;
    terminals.push(r.terminal);
    results.push(r);
  }
  terminals.sort((a, b) => a - b);
  const pct = (q) => terminals[Math.min(terminals.length - 1, Math.max(0, Math.floor(q * (terminals.length - 1))))];
  const accessibleAtFireMedian = results.map((r) => r.accessibleAtFire).sort((a, b) => a - b)[Math.floor(results.length / 2)];
  return {
    runs, successProbability: successes / runs,
    bridgeFailureRate: bridgeFails / runs, depletionFailureRate: depletionFails / runs,
    otherFailureRate: Math.max(0, 1 - successes / runs - bridgeFails / runs - depletionFails / runs),
    p10: pct(0.10), p25: pct(0.25), median: pct(0.50), p75: pct(0.75), p90: pct(0.90),
    mean: terminals.reduce((a, b) => a + b, 0) / terminals.length,
    accessibleAtFireMedian,
  };
}

export function fireAgeCurve(p, ages, runsPerAge = 300, seed = 421337) {
  return ages.map((age) => ({ age, ...runMonteCarlo({ ...p, fireAge: age }, runsPerAge, seed) }));
}

export function reverseSolveSalary(p, targetProb, targetAge, runs = 400, seed = 421337) {
  let lo = p.salary, hi = p.salary * 3.2;
  let hiResult = runMonteCarlo({ ...p, fireAge: targetAge, salary: hi }, runs, seed);
  if (hiResult.successProbability < targetProb) {
    return { achievable: false, requiredSalary: hi, probAtHi: hiResult.successProbability };
  }
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const r = runMonteCarlo({ ...p, fireAge: targetAge, salary: mid }, runs, seed);
    if (r.successProbability >= targetProb) hi = mid; else lo = mid;
  }
  return { achievable: true, requiredSalary: Math.round(hi / 100) * 100 };
}

export function reverseSolveSpending(p, targetProb, targetAge, runs = 400, seed = 421337) {
  let lo = p.spendingMinMonthly * 0.5, hi = p.spendingFireMonthly;
  let loResult = runMonteCarlo({ ...p, fireAge: targetAge, spendingFireMonthly: lo }, runs, seed);
  if (loResult.successProbability < targetProb) {
    return { achievable: false, requiredMonthly: lo, probAtLo: loResult.successProbability };
  }
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const r = runMonteCarlo({ ...p, fireAge: targetAge, spendingFireMonthly: mid }, runs, seed);
    if (r.successProbability >= targetProb) hi = mid; else lo = mid;
  }
  return { achievable: true, requiredMonthly: Math.round(hi) };
}

// --- property leverage & rent-vs-buy ---
export function propertyModel({ price, depositPct, rate, termYears, appreciation, currentRentMonthly, maintenanceRate }) {
  const deposit = price * depositPct;
  const mortgage = price - deposit;
  const monthlyRate = rate / 12;
  const n = termYears * 12;
  const monthlyPayment = monthlyRate === 0 ? mortgage / n : (mortgage * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  const annualPayment = monthlyPayment * 12;
  const interestYear1 = mortgage * rate;
  const principalYear1 = annualPayment - interestYear1;
  const appreciationGain = price * appreciation;
  const equityGainYear1 = principalYear1 + appreciationGain;
  const leverageReturnPct = deposit > 0 ? equityGainYear1 / deposit : 0;
  const maintenance = price * maintenanceRate;
  const housingEconomicCostYear1 = interestYear1 + maintenance - appreciationGain;
  const rentAnnual = currentRentMonthly * 12;
  const netVsRentYear1 = rentAnnual - housingEconomicCostYear1;
  return {
    deposit, mortgage, monthlyPayment, annualPayment, interestYear1, principalYear1,
    appreciationGain, equityGainYear1, leverageReturnPct, maintenance,
    housingEconomicCostYear1, rentAnnual, netVsRentYear1,
  };
}
