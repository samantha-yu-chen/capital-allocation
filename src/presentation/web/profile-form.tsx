import { toggleProperty, togglePurchase, toggleSale, addRefinance } from '../view/property-model.js';
/**
 * The editable profile, rendered from the field registry.
 *
 * Each group is a fieldset with a legend, every input has a real label, and validation messages are
 * attached to the field they belong to via `aria-describedby`. Cross-field rules that belong to no
 * single input (floor ≤ target ≤ comfort, portfolio weights, correlation definiteness) are shown at
 * the foot of their group.
 */
import type { ReactNode } from 'react';
import type { Profile } from '../../domain/contracts.js';
import { MARKET_VARIABLES, displayValue, type FieldGroupId, type NumberFieldDef } from '../view/fields.js';
import { FIELD_GROUPS } from '../view/fields.js';
import { CheckboxField, NumberField, SelectField } from './components.js';
import type { ProfileStore } from './profile-state.js';

const EXCLUDED_FROM_GRID = new Set(['correlation', 'phases', 'capitalNeeds', 'breakdown', 'rateChanges']);

const isGridField = (def: NumberFieldDef): boolean => !def.path.some(part => typeof part === 'string' && EXCLUDED_FROM_GRID.has(part));

function FieldGrid(props: { store: ProfileStore; defs: readonly NumberFieldDef[]; columns?: 2 | 3 }): ReactNode {
  return (
    <div className={props.columns === 3 ? 'field-grid-3' : 'field-grid'}>
      {props.defs.map(def => (
        <NumberField
          key={def.id}
          def={def}
          value={displayValue(props.store.base, def, props.store.drafts)}
          errors={props.store.errorsFor(def.id)}
          onChange={text => props.store.setDraft(def.id, text)}
        />
      ))}
    </div>
  );
}

function GroupIssues(props: { store: ProfileStore; group: FieldGroupId }): ReactNode {
  const issues = props.store.issuesForGroup(props.group);
  if (issues.length === 0) return null;
  return (
    <ul className="field-error" style={{ paddingLeft: '1.1rem' }}>
      {issues.map(issue => <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>)}
    </ul>
  );
}

function PhaseEditor(props: { store: ProfileStore }): ReactNode {
  const { store } = props;
  const phases = store.base.spending.phases;
  return (
    <div className="stack-tight">
      <h4 style={{ fontSize: 15, margin: 0 }}>Spending phases</h4>
      <p className="field-help" style={{ margin: 0 }}>
        Optional overrides for a half-open age range. A phase wins over the current/retirement schedule.
        Phases must not overlap.
      </p>
      {phases.map((_, index) => (
        <div className="row" key={index}>
          <FieldGrid
            store={store}
            defs={store.defs.filter(def => def.path[0] === 'spending' && def.path[1] === 'phases' && def.path[2] === index)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => store.edit(profile => ({
              ...profile,
              spending: { ...profile.spending, phases: profile.spending.phases.filter((_item, i) => i !== index) },
            }))}
          >
            Remove phase {index + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => store.edit(profile => ({
          ...profile,
          spending: {
            ...profile.spending,
            phases: [...profile.spending.phases, {
              startAge: profile.personal.targetFireAge,
              endAge: Math.min(profile.personal.endAge, profile.personal.targetFireAge + 10),
              essentialMonthly: profile.spending.retirement.essentialMonthly,
              discretionaryMonthly: profile.spending.retirement.discretionaryMonthly,
            }],
          },
        }))}
      >
        Add spending phase
      </button>
    </div>
  );
}

function CapitalNeedsEditor(props: { store: ProfileStore }): ReactNode {
  const { store } = props;
  return (
    <div className="stack-tight">
      <h4 style={{ fontSize: 15, margin: 0 }}>Known capital needs</h4>
      <p className="field-help" style={{ margin: 0 }}>
        One-off amounts in today’s money, funded in the year they fall. Living costs take priority if both cannot be met.
      </p>
      {store.base.liquidity.capitalNeeds.map((need, index) => (
        <div className="row" key={index}>
          <FieldGrid
            store={store}
            defs={store.defs.filter(def => def.path[0] === 'liquidity' && def.path[1] === 'capitalNeeds' && def.path[2] === index)}
          />
          <div className="field">
            <label htmlFor={`capital-need-label-${index}`}>Label</label>
            <input
              id={`capital-need-label-${index}`}
              className="input"
              value={need.label}
              onChange={event => store.edit(profile => ({
                ...profile,
                liquidity: {
                  ...profile.liquidity,
                  capitalNeeds: profile.liquidity.capitalNeeds.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item),
                },
              }))}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => store.edit(profile => ({
              ...profile,
              liquidity: {
                ...profile.liquidity,
                capitalNeeds: profile.liquidity.capitalNeeds.filter((_item, i) => i !== index),
              },
            }))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => store.edit(profile => ({
          ...profile,
          liquidity: {
            ...profile.liquidity,
            capitalNeeds: [...profile.liquidity.capitalNeeds,
              { age: profile.personal.currentAge, amount: 10_000, label: 'New capital need' }],
          },
        }))}
      >
        Add capital need
      </button>
    </div>
  );
}

/** Symmetric by contract, so only the upper triangle is editable; the mirror cell is written too. */
function CorrelationMatrix(props: { store: ProfileStore }): ReactNode {
  const { store } = props;
  const matrix = store.base.market.correlation;
  return (
    <div className="stack-tight">
      <h4 style={{ fontSize: 15, margin: 0 }}>Correlation of Gaussian log-growth shocks</h4>
      <p className="field-help" style={{ margin: 0 }}>
        These are the correlations of the underlying Gaussian log-growth shocks, <b>not</b> the Pearson
        correlation of arithmetic returns. For non-zero log volatilities the implied arithmetic
        correlation is <code>expm1(ρ·σᵢ·σⱼ) / √(expm1(σᵢ²)·expm1(σⱼ²))</code>. The matrix must be symmetric,
        have a unit diagonal and be positive semidefinite; a correlation involving a zero-volatility
        series has no observable effect on that series.
      </p>
      <div className="table-scroll">
        <table className="matrix">
          <caption className="field-help">Upper triangle is editable; the mirror cell is written with it.</caption>
          <thead>
            <tr>
              <th scope="col"><span className="text-muted">shock</span></th>
              {MARKET_VARIABLES.map(name => <th scope="col" key={name}>{name}</th>)}
            </tr>
          </thead>
          <tbody>
            {MARKET_VARIABLES.map((rowName, row) => (
              <tr key={rowName}>
                <th scope="row">{rowName}</th>
                {MARKET_VARIABLES.map((columnName, column) => {
                  if (column <= row) {
                    return <td className="fixed" key={columnName}>{(matrix[row]?.[column] ?? 0).toFixed(2)}</td>;
                  }
                  const def = store.defs.find(item =>
                    item.path[0] === 'market' && item.path[1] === 'correlation' && item.path[2] === row && item.path[3] === column);
                  if (!def) return <td key={columnName} />;
                  const errors = store.errorsFor(def.id);
                  return (
                    <td key={columnName}>
                      <input
                        className="input"
                        type="number"
                        step={def.step}
                        min={-1}
                        max={1}
                        aria-label={def.label}
                        aria-invalid={errors.length > 0}
                        value={displayValue(store.base, def, store.drafts)}
                        onChange={event => store.setDraft(def.id, event.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GroupIssues store={store} group="market" />
    </div>
  );
}

function WithdrawalOrder(props: { store: ProfileStore }): ReactNode {
  const { store } = props;
  const order = store.base.simulation.withdrawalOrder;
  const move = (index: number, delta: number) => store.edit(profile => {
    const next = [...profile.simulation.withdrawalOrder];
    const target = index + delta;
    if (target < 0 || target >= next.length) return profile;
    [next[index], next[target]] = [next[target]!, next[index]!];
    return { ...profile, simulation: { ...profile.simulation, withdrawalOrder: next as Profile['simulation']['withdrawalOrder'] } };
  });
  return (
    <div className="stack-tight">
      <h4 style={{ fontSize: 15, margin: 0 }}>Withdrawal order</h4>
      <p className="field-help" style={{ margin: 0 }}>
        A fixed order, applied every year. Cash is the settlement account, so its position controls how
        much of the opening cash balance is released before the other accounts are liquidated.
      </p>
      <ol className="stack-tight" style={{ paddingLeft: '1.2rem', margin: 0 }}>
        {order.map((account, index) => (
          <li key={account}>
            <span className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
              <b>{account.toUpperCase()}</b>
              <button type="button" className="btn btn-secondary" disabled={index === 0}
                aria-label={`Move ${account} earlier`} onClick={() => move(index, -1)}>↑</button>
              <button type="button" className="btn btn-secondary" disabled={index === order.length - 1}
                aria-label={`Move ${account} later`} onClick={() => move(index, 1)}>↓</button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GroupExtras(props: { store: ProfileStore; group: FieldGroupId }): ReactNode {
  const { store, group } = props;
  switch (group) {
    case 'property':
      return <div className="stack-tight">
        <CheckboxField label="Include a property" checked={store.base.property !== null}
          onChange={enabled => store.edit(p => toggleProperty(p, enabled))} />
        {store.base.property ? <>
          <SelectField label="Property use" value={store.base.property.use}
            options={[{value:'owner_occupied' as const,label:'Owner occupied'},{value:'rental' as const,label:'Rental'}]}
            onChange={use=>store.edit(p=>({...p,property:{...p.property!,use}}))}/>
          <SelectField label="Mortgage type" value={store.base.property.mortgageType}
            options={[{value:'repayment' as const,label:'Repayment'},{value:'interest_only' as const,label:'Interest only (balloon at term)'}]}
            onChange={mortgageType=>store.edit(p=>({...p,property:{...p.property!,mortgageType}}))}/>
          <SelectField label="Property tax location" value={store.base.property.taxLocation ?? (store.base.personal.taxRegion==='scotland'?'scotland':'england_ni')}
            options={[{value:'scotland' as const,label:'Scotland (LBTT)'},{value:'england_ni' as const,label:'England / Northern Ireland (SDLT)'},{value:'manual' as const,label:'Wales / special case: enter tax manually'}]}
            onChange={taxLocation=>store.edit(p=>({...p,property:{...p.property!,taxLocation}}))}/>
          <SelectField label="Buyer status" value={store.base.property.buyerStatus ?? 'standard'}
            options={[{value:'standard' as const,label:'Standard / replacement main home'},{value:'first_time' as const,label:'Eligible first-time owner occupier'},{value:'additional' as const,label:'Additional dwelling'}]}
            onChange={buyerStatus=>store.edit(p=>({...p,property:{...p.property!,buyerStatus}}))}/>
          <CheckboxField label="Plan a purchase (otherwise already owned)" checked={store.base.property.purchase!==null}
            onChange={enabled=>store.edit(p=>togglePurchase(p,enabled))}/>
          <CheckboxField label="Schedule a sale to release equity" checked={store.base.property.sale!==null}
            onChange={enabled=>store.edit(p=>toggleSale(p,enabled))}/>
          <p className="field-help">A purchase uses its price and deposit; existing value and debt apply only to an already owned property. First-time relief and additional-dwelling eligibility are your explicit assumptions. Owner-occupied sales assume full private residence relief. No automatic equity release.</p>
          {store.base.property.rateChanges.map((_,i)=><div key={i}>
            <FieldGrid store={store} defs={store.defs.filter(d=>d.path[1]==='rateChanges'&&d.path[2]===i)}/>
            <button type="button" className="btn btn-secondary" onClick={()=>store.edit(p=>({...p,property:{...p.property!,rateChanges:p.property!.rateChanges.filter((_,j)=>j!==i)}}))}>Remove refinance {i+1}</button>
          </div>)}
          <button type="button" className="btn btn-secondary" onClick={()=>store.edit(addRefinance)}>Add refinance rate</button>
        </> : null}
      </div>;
    case 'personal':
      return (
        <div className="field-grid">
          <SelectField
            label="Tax region"
            value={store.base.personal.taxRegion}
            options={[{ value: 'scotland' as const, label: 'Scotland' }, { value: 'rest_of_uk' as const, label: 'Rest of UK' }]}
            onChange={value => store.edit(profile => ({ ...profile, personal: { ...profile.personal, taxRegion: value } }))}
          />
          <div className="field">
            <label htmlFor="tax-year">Tax year</label>
            <input id="tax-year" className="input" value={store.base.personal.taxYear} readOnly
              aria-describedby="tax-year-help" />
            <p className="field-help" id="tax-year-help">
              The only configured year. An unsupported year fails rather than silently falling back.
            </p>
          </div>
        </div>
      );
    case 'pension':
      return (
        <div className="stack-tight">
          <SelectField
            label="Contribution method"
            value={store.base.pension.method}
            options={[
              { value: 'salary_sacrifice' as const, label: 'Salary sacrifice' },
              { value: 'net_pay' as const, label: 'Net pay' },
              { value: 'relief_at_source' as const, label: 'Relief at source' },
            ]}
            onChange={value => store.edit(profile => ({ ...profile, pension: { ...profile.pension, method: value } }))}
          />
          <CheckboxField
            label="Salary sacrifice available"
            checked={store.base.pension.salarySacrificeAvailable}
            onChange={checked => store.edit(profile => ({ ...profile, pension: { ...profile.pension, salarySacrificeAvailable: checked } }))}
          />
          <CheckboxField
            label="Sacrifice added back for the allowance taper"
            help="Post-8 July 2015 sacrifice is added back to threshold income."
            checked={store.base.pension.sacrificeAddedBackForTaper}
            onChange={checked => store.edit(profile => ({ ...profile, pension: { ...profile.pension, sacrificeAddedBackForTaper: checked } }))}
          />
          <CheckboxField
            label="Money purchase annual allowance triggered"
            checked={store.base.pension.moneyPurchaseAnnualAllowanceTriggered}
            onChange={checked => store.edit(profile => ({ ...profile, pension: { ...profile.pension, moneyPurchaseAnnualAllowanceTriggered: checked } }))}
          />
        </div>
      );
    case 'spending':
      return (
        <div className="stack-tight">
          <CheckboxField
            label="Break the current total down by household member"
            help="Optional. The household totals stay authoritative; the breakdown must reconcile to them."
            checked={store.base.spending.breakdown !== null}
            onChange={checked => store.edit(profile => ({
              ...profile,
              spending: {
                ...profile.spending,
                breakdown: checked
                  ? { sharedMonthly: profile.spending.current.essentialMonthly + profile.spending.current.discretionaryMonthly, perAdultMonthly: 0, perChildMonthly: 0 }
                  : null,
              },
            }))}
          />
          {store.base.spending.breakdown ? (
            <FieldGrid store={store} defs={store.defs.filter(def => def.path[1] === 'breakdown')} columns={3} />
          ) : null}
          <PhaseEditor store={store} />
        </div>
      );
    case 'liquidity':
      return <CapitalNeedsEditor store={store} />;
    case 'market':
      return (
        <div className="stack-tight">
          <div className="field">
            <label htmlFor="assumption-version">Assumption version</label>
            <input
              id="assumption-version"
              className="input"
              value={store.base.market.assumptionVersion}
              onChange={event => store.edit(profile => ({ ...profile, market: { ...profile.market, assumptionVersion: event.target.value } }))}
              aria-describedby="assumption-version-help"
            />
            <p className="field-help" id="assumption-version-help">Recorded in the reproducibility metadata of every run.</p>
          </div>
          <CorrelationMatrix store={store} />
        </div>
      );
    case 'simulation':
      return <WithdrawalOrder store={store} />;
    default:
      return null;
  }
}

/**
 * A short inline row of named profile fields, for screens that need one or two inputs rather than
 * a whole group. The field registry stays the only description of what a numeric input is.
 */
export function ProfileFields(props: { store: ProfileStore; ids: readonly string[]; columns?: 2 | 3 }): ReactNode {
  const defs = props.ids
    .map(id => props.store.defs.find(def => def.id === id))
    .filter((def): def is NumberFieldDef => def !== undefined);
  return <FieldGrid store={props.store} defs={defs} {...(props.columns ? { columns: props.columns } : {})} />;
}

export function ProfileForm(props: { store: ProfileStore; groups: readonly FieldGroupId[]; openByDefault?: readonly FieldGroupId[] }): ReactNode {
  const { store } = props;
  const open = new Set(props.openByDefault ?? props.groups);
  return (
    <>
      {props.groups.map(groupId => {
        const group = FIELD_GROUPS.find(item => item.id === groupId);
        if (!group) return null;
        const defs = store.defs.filter(def => def.group === groupId && isGridField(def));
        const hasError = store.validation.issues.some(issue => issue.group === groupId);
        return (
          <details className="card elev-sm group" key={groupId} open={open.has(groupId) || hasError}>
            <summary>
              {group.label}
              {hasError ? <span className="tag tag-accent" style={{ marginLeft: 8 }}>needs attention</span> : null}
            </summary>
            <fieldset className="stack-tight" style={{ marginTop: 'var(--space-2)' }}>
              <legend className="visually-hidden" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                {group.label}
              </legend>
              {group.note ? <p className="field-help" style={{ margin: 0 }}>{group.note}</p> : null}
              {groupId === 'property' ? <GroupExtras store={store} group={groupId} /> : null}
              {defs.length ? <FieldGrid store={store} defs={defs} columns={groupId === 'portfolios' ? 3 : 2} /> : null}
              {groupId !== 'property' ? <GroupExtras store={store} group={groupId} /> : null}
              {groupId === 'market' ? null : <GroupIssues store={store} group={groupId} />}
            </fieldset>
          </details>
        );
      })}
    </>
  );
}
