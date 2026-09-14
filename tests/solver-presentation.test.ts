import test from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '../src/domain/contracts.js';
import { defaultLedgerOptions } from '../src/engine/ledger.js';
import { runSolver, solveTarget } from '../src/engine/solver.js';
import { fireAgeCurve } from '../src/engine/fire-curve.js';
import { TABS, tabById } from '../src/presentation/view/tabs.js';
import { fromDisplay, toDisplay } from '../src/presentation/view/fields.js';
import {
  CURVE_FROM_FIELD, CURVE_TO_FIELD, SOLVER_BUDGET_FIELD, SOLVER_MODE_OPTIONS, SOLVER_TARGET_FIELD,
  curveGeometry, curveHeadline, curveNotes, curvePlan, curveRows, evaluationRows, probabilityWithUncertainty,
  sensitivityRows, solverBoundField, solverDetailRows, solverHeadline, solverModeSummary, solverNotes, solverPlan,
} from '../src/presentation/view/solver-model.js';
import { profileWith } from './ledger-helpers.js';

const options = defaultLedgerOptions();
const small = (mutate: (profile: Profile) => void = () => {}): Profile => profileWith(profile => {
  profile.personal.endAge = 70;
  profile.simulation.count = 8;
  mutate(profile);
});
const form = (mode: Parameters<typeof solverModeSummary>[0], drafts: Record<string, string> = {}, sensitivity = false) =>
  ({ mode, destination: 'gia' as const, includeSensitivity: sensitivity, drafts });

test('package-6 destinations stay built and only attribution remains planned', () => {
  assert.equal(tabById('curve').status, 'built');
  assert.equal(tabById('solver').status, 'built');
  assert.equal(TABS.length, 8, 'all eight reference destinations are preserved');
  assert.deepEqual(
    TABS.filter(tab => tab.status === 'planned').map(tab => tab.id),
    ['attribution'],
  );
  for (const tab of TABS) if (tab.status === 'built') assert.equal(tab.groundwork, '');
});

test('the solver plan reads real bounds from the engine and announces the work before running', () => {
  const profile = small();
  const plan = solverPlan(profile, options, form('salary'));
  assert.equal(plan.issues.length, 0);
  assert.equal(plan.unsupported, null);
  assert.equal(plan.currentValue, profile.income.salaryAnnual);
  assert.ok(plan.boundValue > plan.currentValue);
  assert.equal(plan.request.mode, 'salary');
  assert.equal(plan.request.bound, plan.boundValue);
  assert.equal(plan.searches, 1);
  assert.equal(plan.plannedProjections, plan.plannedSimulations * profile.simulation.count);

  // Sensitivity turns one search into four, and the screen must say so before the run starts.
  const withSensitivity = solverPlan(profile, options, form('salary', {}, true));
  assert.equal(withSensitivity.searches, 4);
  assert.equal(withSensitivity.plannedSimulations, plan.plannedSimulations * 4);
  assert.equal(SOLVER_MODE_OPTIONS.length, 6);
});

test('solver controls are validated against the search direction rather than silently coerced', () => {
  const profile = small();
  const bound = solverBoundField(solverModeSummary('salary'));
  assert.equal(bound.kind, 'money');
  const raising = solverPlan(profile, options, form('salary', { [bound.id]: '40000' }));
  assert.deepEqual(raising.issues.map(issue => issue.id), [bound.id]);
  assert.match(raising.issues[0]!.message, /at or above the current value/);

  const lowering = solverPlan(profile, options, form('retirement_spending', { 'solver.bound': '5000' }));
  assert.deepEqual(lowering.issues.map(issue => issue.id), ['solver.bound']);
  assert.match(lowering.issues[0]!.message, /at or below the current value/);
  assert.equal(solverBoundField(solverModeSummary('retirement_spending')).kind, 'monthlyMoney');
  assert.equal(solverBoundField(solverModeSummary('pension_contribution')).kind, 'percent');

  const badTarget = solverPlan(profile, options, form('salary', { [SOLVER_TARGET_FIELD.id]: '0' }));
  assert.ok(badTarget.issues.some(issue => issue.id === SOLVER_TARGET_FIELD.id));
  const badBudget = solverPlan(profile, options, form('salary', { [SOLVER_BUDGET_FIELD.id]: '2' }));
  assert.ok(badBudget.issues.some(issue => issue.id === SOLVER_BUDGET_FIELD.id));

  // A percent control stores a fraction and shows it multiplied, like every other numeric field.
  assert.equal(toDisplay(SOLVER_TARGET_FIELD, 0.9), '90');
  assert.equal(fromDisplay(SOLVER_TARGET_FIELD, '92.5'), 0.925);
  assert.equal(solverPlan(profile, options, form('salary', { [SOLVER_TARGET_FIELD.id]: '95' })).request.targetProbability, 0.95);
});

test('a spending override makes the savings search unsupported on the screen, not just in the engine', () => {
  const profile = small();
  const overridden = { ...options, monthlyHouseholdOverride: 1500 };
  const plan = solverPlan(profile, overridden, form('savings'));
  assert.match(plan.unsupported!, /override/);
  assert.ok(!Number.isFinite(plan.currentValue));
  assert.equal(solverPlan(profile, options, form('savings')).unsupported, null);
});

test('the curve plan validates its age range and announces the number of simulations', () => {
  const profile = small();
  const plan = curvePlan(profile, options, {});
  assert.equal(plan.issues.length, 0);
  assert.equal(plan.ages[0], profile.personal.currentAge);
  assert.equal(plan.ages.at(-1), Math.min(profile.personal.endAge - 1, profile.personal.currentAge + 20));
  assert.equal(plan.plannedProjections, plan.ages.length * profile.simulation.count);

  const reversed = curvePlan(profile, options, { [CURVE_FROM_FIELD.id]: '50', [CURVE_TO_FIELD.id]: '44' });
  assert.deepEqual(reversed.issues.map(issue => issue.id), [CURVE_TO_FIELD.id]);
  assert.deepEqual(reversed.ages, [], 'an invalid range plans no work');
  const tooLate = curvePlan(profile, options, { [CURVE_TO_FIELD.id]: String(profile.personal.endAge) });
  assert.ok(tooLate.issues.some(issue => issue.id === CURVE_TO_FIELD.id));
  const fractional = curvePlan(profile, options, { [CURVE_FROM_FIELD.id]: '40.5' });
  assert.ok(fractional.issues.some(issue => issue.id === CURVE_FROM_FIELD.id));
});

test('solver presentation reports a solved search, its bracket and its uncertainty separately', async () => {
  const profile = small(p => { p.personal.targetSuccessProbability = 0.75; });
  const run = await runSolver(profile, { mode: 'salary', maxEvaluations: 12 }, { includeSensitivity: true });
  const result = run.primary;
  const headline = solverHeadline(result);
  if (result.status === 'solved') {
    assert.equal(headline.tone, 'good');
    assert.match(headline.value, /^£/);
    assert.match(headline.note, /re-checked against the complete model/);
    const rows = solverDetailRows(result);
    assert.ok(rows.some(row => row.label === 'Required value'));
    assert.ok(rows.some(row => row.label === 'Confirmed on re-evaluation'));
    assert.ok(rows.some(row => row.label === 'Search precision'));
    const surplus = rows.find(row => row.label === 'First-year investable surplus of the solved plan');
    assert.ok(surplus && surplus.value.startsWith('£'));
  } else {
    assert.equal(result.status, 'already_met');
    assert.equal(headline.tone, 'good');
  }

  // Every simulated candidate appears in the trace, in search order, with its own probability.
  const trace = evaluationRows(result);
  assert.equal(trace.length, result.evaluations.length);
  assert.ok(trace.every(row => row.verdict.length > 0));

  // Sensitivity rows come from separate completed searches, starting with the unchanged plan.
  const sensitivity = sensitivityRows(run);
  assert.equal(sensitivity[0]!.label, 'Current value');
  assert.equal(sensitivity.length, 1 + run.sensitivities.length);
  assert.ok(sensitivity.some(row => row.label.startsWith('FIRE age +2')));

  // Sampling uncertainty is always shown beside a probability, never folded into the value.
  assert.match(probabilityWithUncertainty(0.9, 0.01), /90\.00% ± 1\.96%/);
  assert.equal(probabilityWithUncertainty(null, null), '—');
});

test('an unreachable search is presented as a bound that was not cleared, with no required value', async () => {
  const profile = small(p => { p.personal.endAge = 75; p.simulation.count = 24; });
  const result = await solveTarget(profile, { mode: 'salary', targetProbability: 1, bound: profile.income.salaryAnnual + 500 });
  assert.equal(result.status, 'infeasible');
  const headline = solverHeadline(result);
  assert.equal(headline.tone, 'bad');
  assert.match(headline.kicker, /Not reachable inside the search bound/);
  assert.match(headline.note, /reaches only/);
  assert.ok(!solverDetailRows(result).some(row => row.label === 'Required value'));
});

test('a non-monotone search carries its caveats into the presented notes', async () => {
  const profile = small(p => { p.personal.targetFireAge = 46; p.assets.isa = 120_000; });
  const result = await solveTarget(profile, { mode: 'pension_contribution', maxEvaluations: 10 });
  const notes = solverNotes(result);
  assert.ok(notes.some(note => /not assumed to help monotonically/.test(note)),
    'the screen must say monotonicity was not assumed for this input');
  assert.equal(result.monotoneAssumed, false);
});

test('curve presentation draws only simulated ages and marks the earliest qualifying one', async () => {
  const profile = small();
  const curve = await fireAgeCurve(profile, { fromAge: 44, toAge: 50 });
  const geometry = curveGeometry(curve)!;
  assert.equal(geometry.points.length, curve.points.filter(point => point.probability !== null).length);
  assert.match(geometry.pathD, /^M/);
  assert.ok(geometry.targetY >= geometry.axis.top && geometry.targetY <= geometry.height - geometry.axis.bottom);
  assert.equal(
    geometry.points.filter(point => point.qualifying).length,
    curve.earliestQualifyingAge === null ? 0 : 1,
  );
  for (const point of geometry.points) {
    assert.ok(point.x >= geometry.axis.left && point.x <= geometry.width - geometry.axis.right);
    assert.ok(point.y >= geometry.axis.top - 1e-9 && point.y <= geometry.height - geometry.axis.bottom + 1e-9);
  }

  const rows = curveRows(curve);
  assert.equal(rows.length, curve.points.length);
  assert.equal(rows[0]!.age, 44);
  assert.ok(rows.every(row => row.verdict === 'Clears the target' || row.verdict === 'Below the target'));
  assert.ok(rows.every(row => row.interval.startsWith('± ')), 'sampling uncertainty is shown for every age');

  const headline = curveHeadline(curve);
  if (curve.earliestQualifyingAge === null) {
    assert.equal(headline.tone, 'bad');
    assert.match(headline.note, /No FIRE age/);
  } else {
    assert.equal(headline.value, `Age ${curve.earliestQualifyingAge}`);
    assert.match(headline.note, /pre-pension bridge/);
  }
  assert.deepEqual(curveNotes(curve), curve.monotone ? [] : curveNotes(curve));
});
