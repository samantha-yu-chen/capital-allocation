import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile, type Profile } from '../src/domain/contracts.js';
import { runMonteCarlo } from '../src/engine/monte-carlo/simulation.js';
import { runSolver, solveTarget, solverBounds, sensitivityCases } from '../src/engine/solver.js';
import { fireAgeCurve } from '../src/engine/fire-curve.js';
import { defaultProperty } from '../src/presentation/view/property-model.js';
import { close, profileWith } from './ledger-helpers.js';

/** Small, fast fixtures: every assertion below is about search behaviour, not sampling accuracy. */
const base = (mutate: (profile: Profile) => void = () => {}): Profile => profileWith(profile => {
  profile.personal.endAge = 75;
  profile.simulation.count = 24;
  mutate(profile);
});

const withSalary = (profile: Profile, salary: number): Profile =>
  parseProfile({ ...profile, income: { ...profile.income, salaryAnnual: salary } });

test('the salary search returns a plan that clears the target when the full model is re-run independently', async () => {
  const profile = base();
  const result = await solveTarget(profile, { mode: 'salary', maxEvaluations: 16 });
  assert.equal(result.status, 'solved');
  assert.ok(result.currentProbability! < profile.personal.targetSuccessProbability, 'the entered plan must fall short');
  assert.ok(result.requiredValue! > result.currentValue, 'more income is needed, so the answer must rise');

  // Independent confirmation: rebuild the candidate outside the solver and run the engine again.
  const solved = await runMonteCarlo(withSalary(profile, result.requiredValue!));
  assert.equal(solved.successProbability, result.requiredProbability);
  assert.ok(solved.successProbability >= profile.personal.targetSuccessProbability);
  assert.equal(result.confirmed, true);
  assert.equal(result.confirmedProbability, result.requiredProbability);

  // The bracket is real: the largest tested value below the answer genuinely fails.
  assert.ok(result.excludedValue !== null && result.excludedValue < result.requiredValue!);
  const below = await runMonteCarlo(withSalary(profile, result.excludedValue!));
  assert.ok(below.successProbability < profile.personal.targetSuccessProbability);
  assert.ok(result.requiredValue! - result.excludedValue! <= result.precision + 1e-9, 'the answer is bracketed to the search precision');

  // Search precision and sampling uncertainty are different quantities and both are reported.
  assert.equal(result.precision, 100);
  close(result.standardError!, Math.sqrt(result.requiredProbability! * (1 - result.requiredProbability!) / 24), 1e-12);
});

test('an already-achieved target stops at the current value instead of reporting a smaller one', async () => {
  const profile = base(p => { p.personal.targetSuccessProbability = 0.5; });
  const result = await solveTarget(profile, { mode: 'salary' });
  assert.equal(result.status, 'already_met');
  assert.equal(result.requiredValue, result.currentValue);
  assert.equal(result.evaluations.length, 1, 'nothing beyond the entered plan needs evaluating');
  assert.ok(result.confirmed);
  assert.match(result.notes.join(' '), /already clears the target/);
});

test('a target that is unreachable inside the bound is labelled, and publishes no required value', async () => {
  const profile = base();
  const result = await solveTarget(profile, { mode: 'salary', targetProbability: 1, bound: 58_000 });
  assert.equal(result.status, 'infeasible');
  assert.equal(result.requiredValue, null);
  assert.equal(result.requiredProbability, null);
  assert.equal(result.confirmed, false);
  assert.equal(result.bound.value, 58_000);
  assert.ok(result.bound.probability! < 1, 'the probability actually reached at the bound is reported');
  assert.match(result.notes.join(' '), /Nothing inside the search bound reached the target/);
});

test('the tapered pension allowance narrows the search bound instead of failing the search', async () => {
  const profile = base();
  // £2m of salary is far past the point where the tapered annual allowance rejects the
  // contribution; that is a modelling boundary, not a plan that failed to fund itself.
  const result = await solveTarget(profile, { mode: 'salary', bound: 2_000_000, maxEvaluations: 24 });
  assert.equal(result.status, 'solved');
  assert.match(result.notes.join(' '), /outside the supported model/);
  assert.match(result.notes.join(' '), /allowance/);
  assert.ok(result.bound.value < 2_000_000, 'the reported bound is the one that was actually searched');
  const confirmation = await runMonteCarlo(withSalary(profile, result.requiredValue!));
  assert.ok(confirmation.successProbability >= profile.personal.targetSuccessProbability);
});

test('the spending search moves downwards and the solved plan really spends less', async () => {
  const profile = base();
  const result = await solveTarget(profile, { mode: 'retirement_spending' });
  assert.equal(result.status, 'solved');
  assert.ok(result.requiredValue! < result.currentValue, 'a spending answer must be a reduction');
  assert.ok(result.excludedValue! > result.requiredValue!, 'the failing bracket sits above the answer');
  close(result.derived.retirementSpendingAnnualReal!, result.requiredValue! * 12, 1e-6);
  const solved = await runMonteCarlo(parseProfile({
    ...profile,
    spending: {
      ...profile.spending,
      retirement: { essentialMonthly: result.requiredValue!, discretionaryMonthly: 0 },
      retirementFloorAnnual: Math.min(profile.spending.retirementFloorAnnual, result.requiredValue! * 12),
    },
  }));
  assert.equal(solved.successProbability, result.requiredProbability);
});

test('required annual savings equal the measured investable surplus of the solved plan', async () => {
  const profile = base();
  const bounds = solverBounds(profile, { mode: 'savings' });
  const result = await solveTarget(profile, { mode: 'savings' });
  assert.equal(result.status, 'solved');
  close(result.currentValue, bounds.current, 1e-9);
  // The search target is the surplus itself, so the solved plan must actually produce it.
  close(result.derived.annualInvestableSurplusReal!, result.requiredValue!, 1e-6);
  assert.ok(result.requiredValue! > result.currentValue);
});

test('a household spending override makes the spending and savings searches explicitly unsupported', async () => {
  const profile = base();
  for (const mode of ['savings', 'retirement_spending'] as const) {
    const result = await solveTarget(profile, { mode, ledgerOptions: { monthlyHouseholdOverride: 1500 } });
    assert.equal(result.status, 'unsupported');
    assert.equal(result.requiredValue, null);
    assert.match(result.message!, /override/);
  }
});

test('locked pension capital cannot fund the bridge, and the access age decides which search works', async () => {
  const bridge = base(profile => {
    profile.personal.currentAge = 40;
    profile.personal.targetFireAge = 45;
    profile.pension.accessAge = 57;
    profile.income.salaryAnnual = 60_000;
    profile.assets = { cash: 5_000, isa: 10_000, gia: { marketValue: 0, costBasis: 0, carriedLosses: 0 },
      pension: 300_000, sipp: 0, pensionTaxFreeCashUsed: 0 };
  });
  const intoPension = await solveTarget(bridge, { mode: 'starting_capital', startingCapitalDestination: 'pension', bound: 1_000_000 });
  const intoIsa = await solveTarget(bridge, { mode: 'starting_capital', startingCapitalDestination: 'isa', bound: 1_000_000 });
  assert.equal(intoPension.status, 'infeasible', 'capital locked until 57 cannot fund a bridge starting at 45');
  assert.equal(intoIsa.status, 'solved');
  assert.ok(intoIsa.confirmed);
  assert.equal(intoPension.metadata.startingCapitalDestination, 'pension');
});

test('the pension contribution search scans an ordered grid and never assumes it helps', async () => {
  const bridge = base(profile => {
    profile.personal.currentAge = 40;
    profile.personal.targetFireAge = 46;
    profile.pension.accessAge = 57;
    profile.income.salaryAnnual = 70_000;
    profile.assets.isa = 120_000;
  });
  const result = await solveTarget(bridge, { mode: 'pension_contribution', maxEvaluations: 12 });
  assert.equal(result.monotoneAssumed, false, 'contribution strategy is never assumed monotone');
  assert.ok(result.evaluations.length >= 2);
  // Whatever the verdict, every tested rate is published with its own probability.
  for (const evaluation of result.evaluations) {
    assert.ok(evaluation.value >= 0 && evaluation.value <= 1);
    assert.ok(evaluation.status === 'invalid' || typeof evaluation.probability === 'number');
  }
  if (result.status === 'solved') {
    assert.ok(result.confirmed);
    assert.ok(result.requiredValue! > bridge.pension.employeeRate);
  } else {
    assert.equal(result.status, 'infeasible');
    assert.equal(result.requiredValue, null);
  }
});

test('candidates share the seed and path indices, and a repeated search replays exactly', async () => {
  const profile = base();
  const snapshot = structuredClone(profile);
  const first = await solveTarget(profile, { mode: 'salary', maxEvaluations: 12 });
  const second = await solveTarget(profile, { mode: 'salary', maxEvaluations: 12 });
  assert.deepEqual(first, second);
  assert.deepEqual(profile, snapshot, 'the entered profile is never mutated');
  assert.equal(first.metadata.seed, profile.simulation.seed);
  assert.deepEqual(first.metadata.pathIndices, { start: 0, endExclusive: 24 });
  assert.equal(first.metadata.simulationCount, 24);
  assert.equal(first.simulationCount, profile.simulation.count, 'the configured path count is never reduced');
});

test('a search rejects rent-comparison options and cancels without publishing a partial answer', async () => {
  const profile = base();
  await assert.rejects(
    solveTarget(profile, { mode: 'salary', ledgerOptions: { rentInvestment: { age: 40, amount: 1000 } } }),
    /rentInvestment/,
  );
  const controller = new AbortController();
  let seen = 0;
  await assert.rejects(solveTarget(profile, { mode: 'salary' }, {
    signal: controller.signal,
    onProgress: progress => { seen = progress.evaluationsCompleted; if (progress.evaluationsCompleted >= 1) controller.abort(); },
  }), { name: 'AbortError' });
  assert.ok(seen >= 1, 'progress was reported before the cancellation');
});

test('a planned property purchase changes what the salary search requires', async () => {
  const renting = base(profile => { profile.assets.cash = 80_000; });
  const buying = base(profile => {
    profile.assets.cash = 80_000;
    profile.property = defaultProperty(profile);
    profile.property.purchase = { age: 33, price: 300_000, deposit: 60_000, transactionCosts: 2_000 };
    profile.spending.currentRentMonthlyIncluded = 700;
  });
  const [without, with_] = await Promise.all([
    solveTarget(renting, { mode: 'salary', maxEvaluations: 14 }),
    solveTarget(buying, { mode: 'salary', maxEvaluations: 14 }),
  ]);
  assert.notDeepEqual(
    [without.status, without.requiredValue, without.currentProbability],
    [with_.status, with_.requiredValue, with_.currentProbability],
    'mortgage service, property costs and replaced rent must move the requirement',
  );
  if (with_.status === 'solved') assert.ok(with_.confirmed);
});

test('section 33 sensitivities are separately solved searches, not a scaled headline', async () => {
  const profile = base();
  const cases = sensitivityCases(profile);
  assert.deepEqual(cases.map(item => item.id), ['fire_age_plus_2', 'spending_down', 'returns_down']);
  assert.equal(cases[0]!.profile.personal.targetFireAge, profile.personal.targetFireAge + 2);
  close(cases[2]!.profile.market.equities.meanNominal, profile.market.equities.meanNominal - 0.01, 1e-12);

  const run = await runSolver(profile, { mode: 'salary', maxEvaluations: 12 }, { includeSensitivity: true });
  assert.equal(run.sensitivities.length, 3);
  for (const item of run.sensitivities) assert.ok(item.result.evaluations.length >= 1, 'each row ran its own search');
  const later = run.sensitivities.find(item => item.id === 'fire_age_plus_2')!.result;
  if (run.primary.status === 'solved' && later.status === 'solved')
    assert.ok(later.requiredValue! < run.primary.requiredValue!, 'two more working years must lower the salary requirement');
  else assert.equal(later.status, 'already_met');
});

test('the FIRE age curve evaluates every candidate age on the same paths as an ordinary run', async () => {
  const profile = base();
  const curve = await fireAgeCurve(profile, { fromAge: 43, toAge: 48 });
  assert.deepEqual(curve.points.map(point => point.age), [43, 44, 45, 46, 47, 48]);
  assert.equal(curve.metadata.seed, profile.simulation.seed);
  assert.deepEqual(curve.metadata.pathIndices, { start: 0, endExclusive: 24 });

  const direct = await runMonteCarlo(profile);
  assert.equal(curve.probabilityAtTargetAge, direct.successProbability);
  assert.equal(curve.points.find(point => point.age === profile.personal.targetFireAge)!.probability, direct.successProbability);

  const earliest = curve.points.find(point => point.meetsTarget) ?? null;
  assert.equal(curve.earliestQualifyingAge, earliest ? earliest.age : null);
  for (const point of curve.points) {
    if (point.probability === null) continue;
    assert.equal(point.meetsTarget, point.probability >= curve.targetProbability);
    assert.equal(point.bridgeYears, Math.max(0, profile.pension.accessAge - point.age));
  }
  const replay = await fireAgeCurve(profile, { fromAge: 43, toAge: 48 });
  assert.deepEqual(curve, replay);
});

test('the earliest qualifying age agrees with the FIRE age search on the same profile', async () => {
  const profile = base();
  const curve = await fireAgeCurve(profile, { fromAge: profile.personal.targetFireAge, toAge: profile.personal.targetFireAge + 8 });
  const search = await solveTarget(profile, { mode: 'fire_age', bound: profile.personal.targetFireAge + 8, maxEvaluations: 20 });
  assert.equal(search.status, 'solved');
  assert.equal(search.requiredValue, curve.earliestQualifyingAge);
  assert.equal(search.unit, 'age');
});

test('a property purchase changes the age curve, and an empty or oversized range is rejected', async () => {
  const buying = base(profile => {
    profile.assets.cash = 80_000;
    profile.property = defaultProperty(profile);
    profile.property.purchase = { age: 33, price: 300_000, deposit: 60_000, transactionCosts: 2_000 };
    profile.spending.currentRentMonthlyIncluded = 700;
  });
  const renting = base(profile => { profile.assets.cash = 80_000; });
  const [a, b] = await Promise.all([
    fireAgeCurve(buying, { fromAge: 44, toAge: 50 }),
    fireAgeCurve(renting, { fromAge: 44, toAge: 50 }),
  ]);
  assert.notDeepEqual(a.points.map(point => point.probability), b.points.map(point => point.probability));

  await assert.rejects(fireAgeCurve(renting, { fromAge: 50, toAge: 44 }), /age range is empty/);
  const longHorizon = profileWith(profile => { profile.simulation.count = 1; });
  await assert.rejects(fireAgeCurve(longHorizon, { fromAge: 31, toAge: 93 }), /61 candidate ages/);
  await assert.rejects(fireAgeCurve(renting, { ledgerOptions: { rentInvestment: { age: 40, amount: 1 } } }), /rentInvestment/);
});

test('curve cancellation reports progress and then rejects without a partial curve', async () => {
  const profile = base();
  const controller = new AbortController();
  let ages = 0;
  await assert.rejects(fireAgeCurve(profile, { fromAge: 40, toAge: 60 }, {
    signal: controller.signal,
    onProgress: progress => { ages = Math.max(ages, progress.agesCompleted); if (progress.agesCompleted >= 2) controller.abort(); },
  }), { name: 'AbortError' });
  assert.ok(ages >= 2);
});
