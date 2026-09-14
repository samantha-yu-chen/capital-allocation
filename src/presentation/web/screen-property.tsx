import { useMemo, type ReactNode } from 'react';
import type { LedgerOptions } from '../../engine/ledger.js';
import { computeProperty, comparisonRows } from '../view/property-model.js';
import { runKey } from '../view/run-key.js';
import { money, percent } from '../view/format.js';
import { Card, Line, Stat, Banner } from './components.js';
import { ProfileForm } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import { usePropertyComparison } from './use-property-comparison.js';

export function PropertyScreen({store,ledgerOptions}:{store:ProfileStore;ledgerOptions:LedgerOptions}):ReactNode {
  const outcome=useMemo(()=>{
    if(!store.profile)return {model:null,error:''};
    try{return {model:computeProperty(store.profile,ledgerOptions),error:''};}
    catch(e){return {model:null,error:e instanceof Error?e.message:String(e)};}
  },[store.profile,ledgerOptions]);
  const key=store.profile?runKey(store.profile,ledgerOptions):null;
  const comparison=usePropertyComparison(key);
  const m=outcome.model,p=store.profile?.property;
  return <div className="stack">
    <ProfileForm store={store} groups={['property','spending']} openByDefault={['property']}/>
    {!store.profile?<Banner tone="error" title="Correct the property or profile inputs to project"/>:null}
    {outcome.error?<Banner tone="error" title="Projection unavailable">{outcome.error}</Banner>:null}
    {!p&&store.profile?<Banner tone="notice" title="Add a property to model ownership">Enable the property above to plan a purchase or enter an existing home.</Banner>:null}
    {m&&p?<>
      <div className="grid-3">
        <Stat kicker="Starting property equity" value={money(m.initial.equity)} note="Separate from spendable capital. Purchase figures describe the proposed transaction."/>
        <Stat kicker="Starting LTV" value={m.initial.ltv===null?'No property value':percent(m.initial.ltv,1)}/>
        <Stat kicker="Debt-service coverage" value={m.debtServiceCoverage===null?'No debt service':`${m.debtServiceCoverage.toFixed(2)}×`}
          note={p.use==='rental'?'Operating rental income / scheduled debt service, before personal tax.':'Net household income after non-mortgage spending / scheduled debt service. Assets can fund a shortfall.'}/>
      </div>
      {!m.projection.success?<Banner tone="notice" title="This deterministic plan has funding failures">First failure at age {m.projection.metrics.firstFailureAge}. Property equity cannot automatically pay bills. See the Overview ledger and run FIRE &amp; Monte Carlo for sampled success.</Banner>:null}
      <div className="grid-2">
        <Card kicker="Ownership cash flow" title="First ownership year">
          <dl className="kv">
            <Line label="Ownership starts at age" value={m.first.age}/>
            <Line label="Scheduled monthly mortgage payment" value={money(m.monthlyPayment)}/>
            <Line label="Purchase tax (today’s GBP)" value={money(m.purchaseTax)}/>
            <Line label="Purchase funding actually paid" value={money(m.purchaseFunding)}/>
            <Line label="Housing cash outflow / year" value={money(m.housingCashOutflow)} strong/>
            <Line label="Housing economic cost / year" value={money(m.housingEconomicCost)}/>
            {p.use==='rental'?<Line label="Rental cash flow before personal tax" value={money(m.netRentalCashFlow)}/>:null}
          </dl>
          <p className="footnote">Cash outflow includes principal; economic cost excludes it because repayment builds equity. These annual figures exclude purchase/sale costs, shown separately in the ledger. Mortgage payments are additional to the rent-adjusted living budget, counted once. Interest-only loans require a balloon at term.</p>
        </Card>
        <Card kicker="Leverage" title="Downside before financing and costs">
          <dl className="kv"><Line label="Expected first-year appreciation" value={money(m.initial.appreciation)}/>
            <Line label="Maximum equity drawdown on the deterministic path" value={m.maximumEquityDrawdown===null?'Purchase not funded':percent(m.maximumEquityDrawdown,1)}/>
            <Line label="Gross return on starting equity" value={m.initial.equityReturn===null?'Not meaningful with nonpositive equity':percent(m.initial.equityReturn,1)}/></dl>
          <div className="table-scroll"><table className="table"><thead><tr><th>Price shock</th><th>Equity change</th><th>Remaining equity</th></tr></thead><tbody>
            {m.downside.map(d=><tr key={d.change}><th scope="row">{percent(d.change,0)}</th><td>{d.equityReturn===null?'—':percent(d.equityReturn,1)}</td><td>{money(d.stressedEquity)}</td></tr>)}
          </tbody></table></div>
          <p className="footnote">Instantaneous value shocks hold debt fixed. They are leverage illustrations; the full projections below include financing, cash flow and taxes.</p>
        </Card>
      </div>
      <Card kicker="Mortgage environments" title="3 / 5 / 7 / 9% over the full plan">
        <p className="footnote">Each scenario replaces the initial rate and all refinance changes with a constant rate. Expected market returns are used; deterministic funding success is not a probability.</p>
        <div className="table-scroll"><table className="table"><thead><tr><th>Rate</th><th>First annual debt service</th><th>Terminal net worth</th><th>Full-plan funding</th></tr></thead><tbody>
          {m.rates.map(r=><tr key={r.rate}><th scope="row">{percent(r.rate,0)}</th><td>{money(r.payment)}</td><td>{money(r.terminal)}</td><td>{r.success?'Funded':`Failure at age ${r.firstFailureAge}`}</td></tr>)}
        </tbody></table></div>
      </Card>
      <Card kicker="Matched market paths" title={p.use==='rental'?'Rental purchase versus invest':'Buy versus rent and invest'}>
        <p className="footnote">Both plans start with the same financial assets, spending schedules, salary, seed and path count. At the purchase age, the alternative invests the avoided deposit and costs from available cash into remaining ISA allowance then GIA, preserving its reserve. Holdings already invested stay invested. The rent component remains in its spending. No equity is released without a scheduled sale. All results cover the full horizon in today’s GBP.</p>
        {!p.purchase?<p>A planned purchase is required for this comparison. An existing owner has no unspent deposit; enter a purchase scenario to compare acquisition choices.</p>:<>
          <div className="row"><button className="btn btn-primary" type="button" disabled={comparison.state.status==='running'||!store.profile} onClick={()=>{if(store.profile)comparison.run(store.profile,ledgerOptions);}}>Compare {store.editable.simulation.count.toLocaleString()} matching paths</button>
            {comparison.state.status==='running'?<button className="btn btn-secondary" type="button" onClick={comparison.cancel}>Cancel comparison</button>:null}</div>
          <p role="status">{comparison.state.status==='running'?`${comparison.state.completed.toLocaleString()} / ${comparison.state.total.toLocaleString()} path pairs`:comparison.state.status==='cancelled'?'Comparison cancelled; no partial results.':comparison.state.status==='error'?comparison.state.message:''}</p>
          {comparison.state.result?<>
            <div className="table-scroll"><table className="table"><thead><tr><th>Full-plan measure</th><th>Buy</th><th>Rent + invest</th></tr></thead><tbody>{comparisonRows(comparison.state.result).map(r=><tr key={r.label}><th scope="row">{r.label}</th><td>{r.buy}</td><td>{r.rent}</td></tr>)}</tbody></table></div>
            <p className="footnote">Drawdown is the largest decline in real net worth from its running peak over the full horizon; cash flows and sale costs contribute. Debt exposure includes the opening mortgage. Distributions describe sampled paths, not bounds.</p>
            <details><summary>Comparison reproducibility</summary><pre style={{overflowX:"auto",maxWidth:"100%"}}>{JSON.stringify(comparison.state.result.metadata,null,2)}</pre></details>
          </>:null}
        </>}
      </Card>
      <Card kicker="Annual property ledger" title="Value, debt and cash flow">
        <p className="footnote">Rows cover [age, age+1). Value, debt and equity are closing balances; flows occur before market returns. All numbers are today’s GBP. Personal rental income tax is assessed jointly with other income in the Overview ledger; finance relief is shown here.</p>
        <div className="table-scroll"><table className="table"><thead><tr>{['Age','Value','Debt','Equity','Rent','Interest','Principal paid','Operating costs','Transaction cash','Finance tax relief','Plan shortfall'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
          {m.rows.map(y=><tr key={y.age}><th scope="row">{y.age}</th>{[y.value,y.debt,y.equity,y.rent,y.interest,y.principal,y.costs,y.transaction,y.taxRelief,y.shortfall].map((v,i)=><td key={i}>{money(v)}</td>)}</tr>)}
        </tbody></table></div>
      </Card>
    </>:null}
  </div>;
}
