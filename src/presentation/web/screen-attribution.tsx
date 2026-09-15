import { useMemo, useState, type ReactNode } from 'react';
import type { LedgerOptions } from '../../engine/ledger.js';
import type { AttributionResult, AttributionProgress } from '../../engine/attribution.js';
import { runAttributionBrowser } from '../../engine/analysis-browser.js';
import { STRESS_AGE_FIELD } from '../view/fields.js';
import { attributionPlan, attributionRows, attributionConclusion, attributionCaveats, stressRows, attributionDiagnostics, attributionProgress } from '../view/attribution-model.js';
import { stableStringify } from '../view/run-key.js';
import { Banner, Card, NumberField, Progress } from './components.js';
import { ProfileFields } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import { useAnalysis } from './use-analysis.js';

export function AttributionScreen({store,ledgerOptions}:{store:ProfileStore;ledgerOptions:LedgerOptions}): ReactNode {
  const [draft,setDraft]=useState<string|null>(null);const profile=store.profile;
  const age=draft??String(store.editable.personal.currentAge);
  const plan=useMemo(()=>profile?attributionPlan(profile,ledgerOptions,age):null,[profile,ledgerOptions,age]);
  const key=useMemo(()=>profile?stableStringify({profile,ledgerOptions,age}):null,[profile,ledgerOptions,age]);
  const runner=useAnalysis<AttributionResult,AttributionProgress>(key);const running=runner.state.status==='running';
  return <div className="stack">
    {runner.invalidated?<Banner tone="notice" title="Inputs changed, so the previous analysis was discarded"/>:null}
    {runner.state.status==='cancelled'?<Banner tone="neutral" title="Run cancelled">No partial attribution is published.</Banner>:null}
    {runner.state.status==='error'?<Banner tone="error" title="Analysis could not be computed">{runner.state.name}: {runner.state.message}. No partial attribution is published.</Banner>:null}
    <Card kicker="Where It Comes From" title="Which changes move your plan?" elevation="md">
      <p>Compare income, expenses, time, allocation, investment risk and property using your complete lifetime model.</p>
      <div className="field-grid"><NumberField def={STRESS_AGE_FIELD} value={age} onChange={setDraft} errors={plan?.issue?[plan.issue]:[]}/></div>
      <ProfileFields store={store} ids={['simulation.count','personal.targetSuccessProbability','spending.scenarioMonthly.low','spending.scenarioMonthly.base','spending.scenarioMonthly.high']}/>
      <p className="footnote">{plan?.announcement}</p>
      <p className="footnote">Stresses use this start age, which defaults to today. To inspect retirement sequence risk, choose your target FIRE age. Configure property on Property &amp; Leverage to include its comparisons.</p>
      <div className="row"><button className="btn btn-primary" disabled={!profile||!plan?.valid||running} onClick={()=>{if(profile&&plan?.valid)runner.run(c=>runAttributionBrowser(profile,plan.request,c));}}>{running?'Computing…':'Compute levers and stresses'}</button>
      <button className="btn btn-secondary" disabled={!running} onClick={runner.cancel}>Cancel</button></div>
      {runner.state.status==='running'?<div role="status"><p>{attributionProgress(runner.state.progress)}</p>{runner.state.progress?<Progress completed={runner.state.progress.paths.completed} total={runner.state.progress.paths.total} label="Attribution path progress"/>:null}</div>:null}
    </Card>
    {runner.state.status==='done'?<Results result={runner.state.result}/>:null}
    <Card kicker="How to read this" title="Tested effects and their limits" muted>{attributionCaveats.map(p=><p className="footnote" key={p}>{p}</p>)}</Card>
  </div>;
}
function Results({result}:{result:AttributionResult}):ReactNode {
  const rows=attributionRows(result),sensitivities=attributionRows(result,true),stresses=stressRows(result),diagnostics=attributionDiagnostics(result);
  return <div className="stack" data-testid="attribution-result">
    <Card kicker="Completed full-count analysis" title="What has the largest tested effect?" elevation="lg"><p>{attributionConclusion(result)}</p></Card>
    <Card kicker="One change at a time" title="FIRE probability effects" elevation="sm">
      {rows.map(r=><div key={r.id} className="stack" style={{marginBottom:'var(--space-4)'}}>
        <div><strong>{r.label}</strong><p className="footnote">{r.probability} · Δ {r.delta} · {r.evidence}</p></div>
        <div style={{height:14,borderRadius:999,background:'var(--color-neutral-200)'}}><div style={{height:'100%',borderRadius:999,width:`${r.width}%`,background:r.negative?'var(--color-accent-500)':'var(--color-accent-2-500)'}}/></div>
        {r.reason?<p>{r.reason}</p>:null}
      </div>)}
      <p className="footnote">Bar length is absolute probability change on a 0–100 percentage-point scale. Read the signed delta and uncertainty beside each bar.</p>
    </Card>
    <ComparisonTable rows={rows} title="Lever outcomes"/>
    <ComparisonTable rows={sensitivities} title="Sensitivity: nine assumption families"/>
    <Card kicker="Observed failures" title="Funding events and diagnostic risk factors">
      <p className="footnote">These baseline failure events overlap; do not sum them. High spending and low savings are tested through interventions above, not assigned invented causal percentages.</p>
      {diagnostics.failures.map(f=><p key={f.label}>{f.label}: {f.value}</p>)}
      <p>{diagnostics.sequence}</p><p className="footnote">{diagnostics.interpretation}</p>
      {diagnostics.diagnostics.map(d=><p key={d.label}>{d.label}: {d.text}</p>)}
    </Card>
    <Card kicker="Deterministic stress paths" title="Synthetic adverse conditions">
      <p>No historical backtest is implied. These are single assumed paths, not probabilities. Outside the stated shock window, entered nominal means apply; multi-year shocks end at the projection horizon.</p>
      <div className="split">{stresses.map(s=><Card key={s.id} kicker={s.title} title={s.outcome} elevation="sm"><p className="footnote">{s.assumptions||s.reason}</p>
        <p>Terminal net worth, today: {s.terminal}<br/>Change versus deterministic mean path: {s.delta}</p><p className="footnote">{s.diagnostic}</p>
        <details><summary>Funding failure audit</summary>{s.failures.length?s.failures.map((f,i)=><p key={i}>{f}</p>):<p>{s.reason?'Unsupported: no stress result.':'No recorded funding failures.'}</p>}</details>
      </Card>)}</div>
    </Card>
    <Card kicker="Recompute and audit" title="Versioned inputs and complete engine results" muted><details><summary>Reproducibility metadata</summary><pre style={{overflowX:'auto',maxWidth:'100%'}}>{JSON.stringify(result.metadata,null,2)}</pre></details>
      <details><summary>Per-case profiles, options, engine results and deterministic stress ledgers</summary><pre style={{overflowX:'auto',maxWidth:'100%'}}>{JSON.stringify(result,null,2)}</pre></details>
    </Card>
  </div>;
}
function ComparisonTable({rows,title}:{rows:ReturnType<typeof attributionRows>;title:string}):ReactNode {
 return <Card kicker="Full lifetime reruns" title={title}><div className="table-scroll"><table className="table"><thead><tr><th>Test</th><th>Success / change</th><th>Bridge failure</th><th>FIRE age / spending</th><th>Median liquid / pension / property at FIRE</th><th>Terminal median / P10</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th>{r.label}{r.reason?<p className="footnote">Unsupported: {r.reason}</p>:null}</th><td>{r.probability}<br/>{r.delta}<br/>{r.evidence}</td><td>{r.bridge}</td><td>{r.age}<br/>{r.spending}</td><td>{r.liquid}<br/>{r.pension}<br/>{r.property}</td><td>{r.terminal}<br/>{r.downside}</td></tr>)}</tbody></table></div><p className="footnote">Wealth is in today’s GBP. The listed FIRE age is the plan’s target, not a solved earliest qualifying age.</p></Card>;
}
