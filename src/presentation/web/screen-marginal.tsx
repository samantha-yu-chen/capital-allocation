import { useMemo, useState, type ReactNode } from 'react';
import type { LedgerOptions } from '../../engine/ledger.js';
import type { MarginalProgress, MarginalResult } from '../../engine/marginal.js';
import type { MarginalAction } from '../../engine/marginal-funding.js';
import { compareMarginalBrowser } from '../../engine/analysis-browser.js';
import { MARGINAL_AMOUNT_FIELD, MARGINAL_DEBT_FIELD, toDisplay } from '../view/fields.js';
import { defaultDebt, marginalPlan, marginalRows, marginalConclusion, marginalBasis, marginalProgressLine } from '../view/marginal-model.js';
import { stableStringify } from '../view/run-key.js';
import { money } from '../view/format.js';
import { Banner, Card, NumberField, Progress } from './components.js';
import { ProfileFields } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import { useAnalysis } from './use-analysis.js';

export function MarginalScreen({ store, ledgerOptions }: { store: ProfileStore; ledgerOptions: LedgerOptions }): ReactNode {
  const [drafts,setDrafts] = useState<Record<string,string>>({});
  const [basis,setBasis] = useState<MarginalAction['basis']>('gross_earnings');
  const profile = store.profile;
  const plan = useMemo(() => profile ? marginalPlan(profile,ledgerOptions,drafts,basis) : null,[profile,ledgerOptions,drafts,basis]);
  const key = useMemo(() => profile ? stableStringify({profile,request:plan?.request}) : null,[profile,plan]);
  const runner = useAnalysis<MarginalResult,MarginalProgress>(key);
  const running = runner.state.status === 'running';
  return <div className="stack">
    {runner.invalidated ? <Banner tone="notice" title="Inputs changed, so the previous allocation was discarded" /> : null}
    {runner.state.status === 'cancelled' ? <Banner tone="neutral" title="Run cancelled">No partial ranking is published.</Banner> : null}
    {runner.state.status === 'error' ? <Banner tone="error" title="Allocation could not be computed">{runner.state.name}: {runner.state.message}</Banner> : null}
    {!profile ? <Banner tone="error" title="Invalid profile; no analysis can run" /> : null}
    <Card kicker="The next increment" title="Compare six destinations over your lifetime" elevation="md">
      <div className="field-grid">
        <NumberField def={MARGINAL_AMOUNT_FIELD} value={drafts[MARGINAL_AMOUNT_FIELD.id] ?? '1000'} onChange={text => setDrafts(p => ({...p,[MARGINAL_AMOUNT_FIELD.id]:text}))} errors={[]} />
        <div className="field"><label htmlFor="marginal.basis">Funding basis</label><select className="input" id="marginal.basis" value={basis} onChange={e => setBasis(e.target.value as MarginalAction['basis'])}>
          <option value="gross_earnings">Extra gross earnings</option><option value="after_tax_cash">Existing after-tax cash</option>
        </select></div>
        <NumberField def={MARGINAL_DEBT_FIELD} value={drafts[MARGINAL_DEBT_FIELD.id] ?? toDisplay(MARGINAL_DEBT_FIELD,defaultDebt(store.editable))} onChange={text => setDrafts(p => ({...p,[MARGINAL_DEBT_FIELD.id]:text}))} errors={[]} />
      </div>
      <ProfileFields store={store} ids={['simulation.count','personal.targetSuccessProbability']} />
      {plan?.issues.map((issue,i) => <p className="field-error" role="alert" key={i}>{issue}</p>)}
      <p className="footnote">{plan?.announcement}</p>
      <div className="row"><button className="btn btn-primary" type="button" disabled={!profile || !plan || plan.issues.length > 0 || running} onClick={() => {
        if (profile && plan) runner.run(controls => compareMarginalBrowser(profile,plan.request,controls));
      }}>{running ? 'Computing…' : 'Compare allocation'}</button>
      <button className="btn btn-secondary" type="button" disabled={!running} onClick={runner.cancel}>Cancel</button></div>
      {runner.state.status === 'running' ? <div role="status"><p>{marginalProgressLine(runner.state.progress)}</p>{runner.state.progress ? <Progress completed={runner.state.progress.paths.completed} total={runner.state.progress.paths.total} label="Allocation path progress" /> : null}</div> : null}
    </Card>
    {runner.state.status === 'done' ? <AllocationResult result={runner.state.result} /> : null}
    <Card kicker="Comparison basis" title="What the ranking measures" muted>{marginalBasis.map(p => <p className="footnote" key={p}>{p}</p>)}</Card>
  </div>;
}
function AllocationResult({result}:{result:MarginalResult}): ReactNode {
  const rows = marginalRows(result);
  return <div className="stack" data-testid="marginal-result">
    <Card kicker="Completed allocation comparison" title="Ranking under your constraints" elevation="lg"><p>{marginalConclusion(result)}</p></Card>
    <div className="split">{rows.map(row => <Card key={row.destination} kicker={row.label} title={row.probability} elevation="sm">
      <span className="tag tag-neutral">{row.rank} · {row.classification}</span>
      <p className="footnote">Success change: {row.delta} (percentage points)</p>
      {row.reason ? <p>{row.reason}</p> : <><p>Mean usable wealth: {row.score}<br />Change: {row.scoreDelta}</p>
        <p className="footnote">Mean terminal: {row.terminalMean}<br />Observed worst terminal: {row.terminalWorst}<br />Median terminal: {row.terminal} (Δ {row.terminalDelta})<br />P10 terminal: {row.downside} (Δ {row.downsideDelta})<br />Mean lifetime tax: {row.tax} (Δ {row.taxDelta})<br />Mean maximum debt: {row.debt} (Δ {row.debtDelta})</p></>}
      {row.constraints.map(c => <p className="footnote" key={c}>{c}</p>)}
      {row.funding.map(f => <p className="footnote" key={f}>{f}</p>)}
      {row.targets.length ? <div className="table-scroll"><table className="table"><caption>{row.label}: target ages, today’s money</caption><thead><tr><th>Age</th><th>Mean usable / Δ</th><th>Median accessible / Δ</th><th>Median net worth / Δ</th><th>Mean debt / Δ</th></tr></thead><tbody>
        {row.targets.map(t => <tr key={t.age}><th>{t.age}</th><td>{t.usable}<br />{t.deltaUsable}</td><td>{t.accessible}<br />{t.deltaAccessible}</td><td>{t.wealth}<br />{t.deltaWealth}</td><td>{t.debt}<br />{t.deltaDebt}</td></tr>)}
      </tbody></table></div> : null}
    </Card>)}</div>
    <Card kicker="Tax boundaries" title="Thresholds from the selected tax configuration" muted>
      <p className="footnote">These are tax-basis thresholds, not gross salary bands. Crossed boundaries for the expected-value first year appear in each funding audit above.</p>
      <div className="table-scroll"><table className="table"><thead><tr><th>Boundary</th><th>Income basis</th><th>Threshold</th></tr></thead><tbody>{result.boundaries.map(b => <tr key={b.label}><th>{b.label}</th><td>{b.basis}</td><td>{money(b.amount)}</td></tr>)}</tbody></table></div>
      <details><summary>Reproducibility metadata</summary><pre style={{overflowX:'auto',maxWidth:'100%'}}>{JSON.stringify(result.metadata,null,2)}</pre></details>
    </Card>
  </div>;
}
