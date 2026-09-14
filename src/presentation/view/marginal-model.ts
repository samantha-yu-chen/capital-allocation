import type { Profile } from '../../domain/contracts.js';
import type { LedgerOptions } from '../../engine/ledger.js';
import { marginalRequestSchema, type MarginalRequest, type MarginalResult, type MarginalProgress } from '../../engine/marginal.js';
import type { MarginalDestination, MarginalAction } from '../../engine/marginal-funding.js';
import { MARGINAL_AMOUNT_FIELD, MARGINAL_DEBT_FIELD, fromDisplay } from './fields.js';
import { count, money, percent } from './format.js';
import { probabilityWithUncertainty } from './solver-model.js';
export const destinationLabel: Record<MarginalDestination,string> = {
  pension: 'Pension', isa: 'ISA', gia: 'GIA', cash: 'Cash', mortgage: 'Mortgage overpayment', deposit: 'Property deposit',
};
export const defaultDebt = (p: Profile) => p.property?.purchase
  ? p.property.purchase.price - p.property.purchase.deposit : p.property?.mortgageBalance ?? 0;
export function marginalPlan(profile: Profile, options: LedgerOptions, drafts: Record<string,string>, basis: MarginalAction['basis']) {
  const amount = drafts[MARGINAL_AMOUNT_FIELD.id] === undefined ? 1000 : fromDisplay(MARGINAL_AMOUNT_FIELD, drafts[MARGINAL_AMOUNT_FIELD.id]!);
  const maximumDebt = drafts[MARGINAL_DEBT_FIELD.id] === undefined ? defaultDebt(profile) : fromDisplay(MARGINAL_DEBT_FIELD, drafts[MARGINAL_DEBT_FIELD.id]!);
  const parsed = marginalRequestSchema.safeParse({ amount, maximumDebt, basis });
  return { request: { amount, maximumDebt, basis, ledgerOptions: options } satisfies MarginalRequest,
    issues: parsed.success ? [] : parsed.error.issues.map(i => i.message),
    announcement: `Up to 7 complete simulations: ${count(7*profile.simulation.count)} lifetime projections at ${count(profile.simulation.count)} paths per plan. This can take a minute or more. The path count is never reduced; you can lower it explicitly before running.`,
  };
}
export function marginalProgressLine(p: MarginalProgress | null): string {
  return p ? `${p.stage}: ${count(p.evaluationsCompleted)} of up to ${count(p.evaluationsPlanned)} plans complete` : 'Starting…';
}
export function marginalRows(result: MarginalResult) {
  return result.candidates.map(c => ({
    destination: c.destination, label: destinationLabel[c.destination], classification: c.classification,
    rank: c.rank === null ? 'Unranked' : `Rank ${c.rank}`, reason: c.reason,
    constraints: c.constraints,
    probability: c.summary ? probabilityWithUncertainty(c.summary.probability,c.summary.standardError) : 'Infeasible',
    delta: c.delta ? `${percent(c.delta.probability,2)} ± ${percent(1.96*c.delta.probabilitySE,2)}` : '—',
    score: c.summary ? money(c.summary.score.mean) : '—',
    scoreDelta: c.delta ? `${money(c.delta.score)} ± ${money(1.96*c.delta.scoreSE)}` : '—',
    terminalMean: c.summary ? money(c.summary.terminal.mean) : '—',
    terminalWorst: c.summary ? money(c.summary.terminal.worst) : '—',
    terminal: c.summary ? money(c.summary.terminal.median) : '—',
    terminalDelta: c.delta ? money(c.delta.terminal) : '—',
    downside: c.summary ? money(c.summary.terminal.p10) : '—',
    downsideDelta: c.delta ? money(c.delta.downside) : '—',
    tax: c.summary ? money(c.summary.lifetimeTax.mean) : '—', taxDelta: c.delta ? money(c.delta.tax) : '—',
    debt: c.summary ? money(c.summary.maxDebt.mean) : '—', debtDelta: c.delta ? money(c.delta.debt) : '—',
    funding: c.funding ? [
      `Destination cash ${money(c.funding.allocation)}; pension added ${money(c.funding.pensionAdded)}.`,
      `Incremental income tax ${money(c.funding.incomeTax)}; employee NI ${money(c.funding.employeeNi)}; employer pension ${money(c.funding.employerAdded)}; provider relief ${money(c.funding.providerRelief)}.`,
      ...c.funding.boundaryCrossings.map(b => `${b.label} crossed at ${money(b.threshold)} (${money(b.before)} → ${money(b.after)} on that tax basis).`),
    ] : [],
    targets: c.summary?.targets.map((t,i) => ({ age: t.age, debt: money(t.debt.mean), deltaDebt: money(t.debt.mean-result.baseline.targets[i]!.debt.mean),
      usable: money(t.usable.mean), deltaUsable: money(t.usable.mean-result.baseline.targets[i]!.usable.mean),
      accessible: money(t.accessible.median), deltaAccessible: money(t.accessible.median-result.baseline.targets[i]!.accessible.median),
      wealth: money(t.netWorth.median), deltaWealth: money(t.netWorth.median-result.baseline.targets[i]!.netWorth.median),
    })) ?? [],
  }));
}
export function marginalConclusion(result: MarginalResult): string {
  const eligible = result.candidates.filter(c => c.rank !== null);
  if (!eligible.length) return 'No destination clears all constraints on these sampled paths. No allocation recommendation is supported. Review the probability, reserve, liquidity and debt reasons below.';
  const first = eligible.filter(c => c.rank === 1);
  return `${first.map(c => destinationLabel[c.destination]).join(' / ')} has the highest tested constrained mean usable wealth. Shared ranks indicate near-equivalence within paired sampling uncertainty, not a universal wrapper ordering. Read the tradeoffs before acting.`;
}
export const marginalBasis = [
  'Gross earnings: a one-off non-pensionable bonus. Pension uses the selected workplace method, remaining contractual employer match and NI shareback. Existing after-tax cash: a transfer from opening cash; pension uses RAS with additional relief claimed and recycled in the same annual settlement. No employer match is invented for existing cash.',
  'Every plan reuses the profile seed and absolute path indices, the fixed spending policy and full lifetime ledger. Rent-investment actions are null. The baseline is the entered plan: for existing cash it already owns the increment; for gross earnings it does not receive the bonus.',
  'Objective: equal-weight mean after-tax usable wealth at FIRE, pension access (if in horizon) and terminal age. Snapshot valuation liquidates financial assets in one tax year with no employment or contributions, plus configured other/state-pension income. It uses actual GIA basis/losses and remaining pension tax-free allowance. Pension is excluded before access; unsold property equity is excluded. Debt is a separate hard constraint.',
  'Constraints: the 95% sampling lower bound clears the FIRE target; emergency cash reserve and minimum liquid years hold throughout every sampled path; real debt stays within the entered ceiling. These are sampled checks, not guarantees. Unranked evaluated plans still show real outcomes.',
  'All changes are versus the baseline in today’s money. ± is a 95% Monte Carlo sampling interval; paired errors use matching paths. Terminal wealth and P10 include unsold property and unrealised taxes and do not define the usable-wealth objective. Funding audit uses the expected-value first year; each sampled path settles its own taxes.',
  'Assumption sensitivity: one-year liquidation can tax pension more heavily than phased drawdown; earlier FIRE increases the value of accessible bridge capital. Returns, future tax policy, withdrawal timing and mortgage rates can change the ordering. These are conditional tradeoffs, not separately simulated sensitivity forecasts. Dominance requires a material probability and objective advantage with no worse downside, accessible capital or debt.',
  'Property deposit increases the deposit on the configured purchase at the same price, with unchanged transaction costs. Until a future purchase the budget remains ordinary cash and may be used by the plan; failure to fund the eventual purchase is recorded. Mortgage overpayment uses existing debt, no lender fees or early-repayment penalties, and recasts payments over the original remaining term.',
];
