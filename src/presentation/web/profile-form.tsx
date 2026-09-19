import { toggleProperty, togglePurchase, toggleSale, addRefinance } from '../view/property-model.js';
/**
 * The editable profile, rendered from the field registry.
 *
 * Each group is a fieldset with a legend, every input has a real label, and validation messages are
 * attached to the field they belong to via `aria-describedby`. Cross-field rules that belong to no
 * single input (floor ≤ target ≤ comfort, portfolio weights, correlation definiteness) are shown at
 * the foot of their group.
 *
 * A filterable form additionally hides inputs above the reader's chosen tier. Filtering is display
 * only: the profile, the drafts, the validation state and the run key are untouched, hidden fields
 * keep their stored values, and anything carrying a validation issue is shown whatever the filter
 * says — an error must never be maskable.
 *
 * Every control also says whether its value is the reader's own or the starter profile's, and
 * offers a way back. The marker and the reset are attached here, once, for both the numeric grid
 * and the registry-described selects, checkboxes and composite editors.
 */
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Profile } from '../../domain/contracts.js';
import {
  DEFAULT_TIER_MODE, MARKET_VARIABLES, TIER_MODES, choiceFieldsFor, displayValue, fieldName,
  fieldVisibility, isGridField, type ChoiceFieldDef, type FieldGroupId, type NumberFieldDef,
  type TierMode, type Visibility,
} from '../view/fields.js';
import { FIELD_GROUPS } from '../view/fields.js';
import {
  fieldArrivalNote, fieldTarget, raiseModeFor, tierRaiseNote,
  type FieldFocusRequest, type FieldTarget,
} from '../view/field-navigation.js';
import { provenanceSummary, resettableInGroup } from '../view/provenance.js';
import { CheckboxField, NumberField, ProvenanceMark, SelectField, type FieldMark } from './components.js';
import { GlossaryTerms } from './glossary-ui.js';
import type { ProfileStore } from './profile-state.js';

/** Everything is shown unless a form explicitly opts into filtering. */
const SHOW_ALL = (): boolean => true;

type Show = (fieldId: string) => boolean;

/** The marker for one registry entry, or nothing when the entry is not described (a bare control). */
function markFor(store: ProfileStore, fieldId: string): FieldMark | undefined {
  const entry = store.provenance.get(fieldId);
  if (!entry) return undefined;
  return {
    edited: entry.state === 'edited',
    note: entry.note,
    resetLabel: entry.resetLabel,
    onReset: entry.resettable ? () => store.resetField(fieldId) : undefined,
  };
}

function FieldGrid(props: { store: ProfileStore; defs: readonly NumberFieldDef[]; columns?: 2 | 3; show?: Show }): ReactNode {
  const show = props.show ?? SHOW_ALL;
  const defs = props.defs.filter(def => show(def.id));
  if (defs.length === 0) return null;
  return (
    <div className={props.columns === 3 ? 'field-grid-3' : 'field-grid'}>
      {defs.map(def => (
        <NumberField
          key={def.id}
          def={def}
          value={displayValue(props.store.base, def, props.store.drafts)}
          errors={props.store.errorsFor(def.id)}
          onChange={text => props.store.setDraft(def.id, text)}
          mark={markFor(props.store, def.id)}
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

/**
 * Renders a registry-described control, or nothing when the filter hides it. The registry owns the
 * label, the options and the help text, so the tier covers the whole editable surface rather than
 * only the numeric part of it.
 *
 * The control's provenance marker is handed to the renderer, which knows where it belongs — beside
 * a select's label, under a checkbox, next to a composite editor's heading. Where the default is
 * worked out from another answer rather than simply chosen, the registry's note is shown too.
 */
function Choice(props: {
  choices: readonly ChoiceFieldDef[]; show: Show; id: string; store: ProfileStore;
  children: (def: ChoiceFieldDef, mark: FieldMark | undefined) => ReactNode;
}): ReactNode {
  const def = props.choices.find(item => item.id === props.id);
  if (!def || !props.show(def.id)) return null;
  return (
    <>
      {props.children(def, markFor(props.store, def.id))}
      {def.derivedFrom ? <p className="field-help" style={{ marginTop: 0 }}>The default is {def.derivedFrom}.</p> : null}
    </>
  );
}

const optionsOf = <T extends string>(def: ChoiceFieldDef): readonly { value: T; label: string }[] =>
  (def.options ?? []) as readonly { value: T; label: string }[];

/**
 * Everything a registry-described control says in words, so no call site spells it out again.
 *
 * `controlId` is the registry id, which makes a select or a checkbox addressable by the same id a
 * numeric input already uses — without it a jump could reach "Gross salary" but not "Tax region".
 */
const textOf = (def: ChoiceFieldDef): {
  label: string; controlId: string; help?: string; plainHelp?: string; terms?: readonly string[];
} => ({
  label: fieldName(def),
  controlId: def.id,
  ...(def.help === undefined ? {} : { help: def.help }),
  ...(def.plainHelp === undefined ? {} : { plainHelp: def.plainHelp }),
  ...(def.terms === undefined ? {} : { terms: def.terms }),
});

/** A composite editor's own heading, plain sentence and glossary terms. */
function EditorHeading(props: { def: ChoiceFieldDef; mark: FieldMark | undefined }): ReactNode {
  return (
    <>
      <h4 className="field-label-row" style={{ fontSize: 15, margin: 0 }}>
        {fieldName(props.def)}<ProvenanceMark mark={props.mark} />
      </h4>
      {props.def.plainHelp ? <p className="field-plain" style={{ margin: 0 }}>{props.def.plainHelp}</p> : null}
      <GlossaryTerms ids={props.def.terms} />
    </>
  );
}

function PhaseEditor(props: { store: ProfileStore; def: ChoiceFieldDef; mark: FieldMark | undefined }): ReactNode {
  const { store } = props;
  const phases = store.base.spending.phases;
  return (
    <div className="stack-tight">
      <EditorHeading def={props.def} mark={props.mark} />
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

function CapitalNeedsEditor(props: { store: ProfileStore; def: ChoiceFieldDef; mark: FieldMark | undefined }): ReactNode {
  const { store } = props;
  return (
    <div className="stack-tight">
      <EditorHeading def={props.def} mark={props.mark} />
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
function CorrelationMatrix(props: { store: ProfileStore; def: ChoiceFieldDef; mark: FieldMark | undefined }): ReactNode {
  const { store } = props;
  const matrix = store.base.market.correlation;
  return (
    <div className="stack-tight">
      <EditorHeading def={props.def} mark={props.mark} />
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
                        aria-label={fieldName(def)}
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

function WithdrawalOrder(props: { store: ProfileStore; def: ChoiceFieldDef; mark: FieldMark | undefined }): ReactNode {
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
      <EditorHeading def={props.def} mark={props.mark} />
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

function GroupExtras(props: {
  store: ProfileStore; group: FieldGroupId; choices: readonly ChoiceFieldDef[]; show: Show;
}): ReactNode {
  const { store, group, choices, show } = props;
  const pick = (id: string, render: (def: ChoiceFieldDef, mark: FieldMark | undefined) => ReactNode): ReactNode =>
    <Choice choices={choices} show={show} id={id} store={store}>{render}</Choice>;
  switch (group) {
    case 'property':
      return <div className="stack-tight">
        {pick('property', (def, mark) => (
          <CheckboxField {...textOf(def)} checked={store.base.property !== null} mark={mark}
            onChange={enabled => store.edit(p => toggleProperty(p, enabled))} />
        ))}
        {store.base.property ? <>
          {pick('property.use', (def, mark) => (
            <SelectField {...textOf(def)} value={store.base.property!.use} options={optionsOf<'owner_occupied' | 'rental'>(def)} mark={mark}
              onChange={use => store.edit(p => ({ ...p, property: { ...p.property!, use } }))} />
          ))}
          {pick('property.mortgageType', (def, mark) => (
            <SelectField {...textOf(def)} value={store.base.property!.mortgageType} options={optionsOf<'repayment' | 'interest_only'>(def)} mark={mark}
              onChange={mortgageType => store.edit(p => ({ ...p, property: { ...p.property!, mortgageType } }))} />
          ))}
          {pick('property.taxLocation', (def, mark) => (
            <SelectField {...textOf(def)}
              value={store.base.property!.taxLocation ?? (store.base.personal.taxRegion === 'scotland' ? 'scotland' : 'england_ni')}
              options={optionsOf<'scotland' | 'england_ni' | 'manual'>(def)} mark={mark}
              onChange={taxLocation => store.edit(p => ({ ...p, property: { ...p.property!, taxLocation } }))} />
          ))}
          {pick('property.buyerStatus', (def, mark) => (
            <SelectField {...textOf(def)} value={store.base.property!.buyerStatus ?? 'standard'}
              options={optionsOf<'standard' | 'first_time' | 'additional'>(def)} mark={mark}
              onChange={buyerStatus => store.edit(p => ({ ...p, property: { ...p.property!, buyerStatus } }))} />
          ))}
          {pick('property.purchase', (def, mark) => (
            <CheckboxField {...textOf(def)} checked={store.base.property!.purchase !== null} mark={mark}
              onChange={enabled => store.edit(p => togglePurchase(p, enabled))} />
          ))}
          {pick('property.sale', (def, mark) => (
            <CheckboxField {...textOf(def)} checked={store.base.property!.sale !== null} mark={mark}
              onChange={enabled => store.edit(p => toggleSale(p, enabled))} />
          ))}
          <p className="field-help">A purchase uses its price and deposit; existing value and debt apply only to an already owned property. First-time relief and additional-dwelling eligibility are your explicit assumptions. Owner-occupied sales assume full private residence relief. No automatic equity release.</p>
          {pick('property.rateChanges', (_def, mark) => <>
            <ProvenanceMark mark={mark} />
            {store.base.property!.rateChanges.map((_, i) => <div key={i}>
              <FieldGrid store={store} defs={store.defs.filter(d => d.path[1] === 'rateChanges' && d.path[2] === i)} />
              <button type="button" className="btn btn-secondary" onClick={() => store.edit(p => ({ ...p, property: { ...p.property!, rateChanges: p.property!.rateChanges.filter((_item, j) => j !== i) } }))}>Remove refinance {i + 1}</button>
            </div>)}
            <button type="button" className="btn btn-secondary" onClick={() => store.edit(addRefinance)}>Add refinance rate</button>
          </>)}
        </> : null}
      </div>;
    case 'personal':
      return (
        <div className="field-grid">
          {pick('personal.taxRegion', (def, mark) => (
            <SelectField
              {...textOf(def)}
              value={store.base.personal.taxRegion}
              options={optionsOf<'scotland' | 'rest_of_uk'>(def)}
              mark={mark}
              onChange={value => store.edit(profile => ({ ...profile, personal: { ...profile.personal, taxRegion: value } }))}
            />
          ))}
          {pick('personal.taxYear', def => (
            <div className="field">
              <label htmlFor="tax-year">{fieldName(def)}</label>
              <input id="tax-year" className="input" value={store.base.personal.taxYear} readOnly
                aria-describedby="tax-year-help" />
              {def.plainHelp ? <p className="field-plain">{def.plainHelp}</p> : null}
              <p className="field-help" id="tax-year-help">{def.help}</p>
            </div>
          ))}
        </div>
      );
    case 'pension':
      return (
        <div className="stack-tight">
          {pick('pension.method', (def, mark) => (
            <SelectField
              {...textOf(def)}
              value={store.base.pension.method}
              options={optionsOf<'salary_sacrifice' | 'net_pay' | 'relief_at_source'>(def)}
              mark={mark}
              onChange={value => store.edit(profile => ({ ...profile, pension: { ...profile.pension, method: value } }))}
            />
          ))}
          {pick('pension.salarySacrificeAvailable', (def, mark) => (
            <CheckboxField
              {...textOf(def)}
              mark={mark}
              checked={store.base.pension.salarySacrificeAvailable}
              onChange={checked => store.edit(profile => ({ ...profile, pension: { ...profile.pension, salarySacrificeAvailable: checked } }))}
            />
          ))}
          {pick('pension.sacrificeAddedBackForTaper', (def, mark) => (
            <CheckboxField
              {...textOf(def)}
              mark={mark}
              checked={store.base.pension.sacrificeAddedBackForTaper}
              onChange={checked => store.edit(profile => ({ ...profile, pension: { ...profile.pension, sacrificeAddedBackForTaper: checked } }))}
            />
          ))}
          {pick('pension.moneyPurchaseAnnualAllowanceTriggered', (def, mark) => (
            <CheckboxField
              {...textOf(def)}
              mark={mark}
              checked={store.base.pension.moneyPurchaseAnnualAllowanceTriggered}
              onChange={checked => store.edit(profile => ({ ...profile, pension: { ...profile.pension, moneyPurchaseAnnualAllowanceTriggered: checked } }))}
            />
          ))}
        </div>
      );
    case 'spending':
      return (
        <div className="stack-tight">
          {pick('spending.breakdown', (def, mark) => <>
            <CheckboxField
              {...textOf(def)}
              mark={mark}
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
              <FieldGrid store={store} defs={store.defs.filter(def2 => def2.path[1] === 'breakdown')} columns={3} />
            ) : null}
          </>)}
          {pick('spending.phases', (def, mark) => <PhaseEditor store={store} def={def} mark={mark} />)}
        </div>
      );
    case 'liquidity':
      return pick('liquidity.capitalNeeds', (def, mark) => <CapitalNeedsEditor store={store} def={def} mark={mark} />);
    case 'market':
      return (
        <div className="stack-tight">
          {pick('market.assumptionVersion', def => (
            <div className="field">
              <label htmlFor="assumption-version">{fieldName(def)}</label>
              <input
                id="assumption-version"
                className="input"
                value={store.base.market.assumptionVersion}
                onChange={event => store.edit(profile => ({ ...profile, market: { ...profile.market, assumptionVersion: event.target.value } }))}
                aria-describedby="assumption-version-help"
              />
              {def.plainHelp ? <p className="field-plain">{def.plainHelp}</p> : null}
              <p className="field-help" id="assumption-version-help">{def.help}</p>
            </div>
          ))}
          {pick('market.correlation', (def, mark) => <CorrelationMatrix store={store} def={def} mark={mark} />)}
        </div>
      );
    case 'simulation':
      return pick('simulation.withdrawalOrder', (def, mark) => <WithdrawalOrder store={store} def={def} mark={mark} />);
    default:
      return null;
  }
}

/**
 * A short inline row of named profile fields, for screens that need one or two inputs rather than
 * a whole group. The field registry stays the only description of what a numeric input is.
 *
 * Named fields are never tier-filtered: the screen asked for these specific inputs.
 */
export function ProfileFields(props: { store: ProfileStore; ids: readonly string[]; columns?: 2 | 3 }): ReactNode {
  const defs = props.ids
    .map(id => props.store.defs.find(def => def.id === id))
    .filter((def): def is NumberFieldDef => def !== undefined);
  return <FieldGrid store={props.store} defs={defs} {...(props.columns ? { columns: props.columns } : {})} />;
}

/** Named non-numeric controls, rendered through the same registry wrapper as the full profile form. */
export function ProfileChoiceFields(props: { store: ProfileStore; ids: readonly string[] }): ReactNode {
  const choices = useMemo(() => choiceFieldsFor(props.store.base), [props.store.base]);
  const wanted = new Set(props.ids);
  const groups = [...new Set(choices.filter(def => wanted.has(def.id)).map(def => def.group))];
  const show: Show = id => wanted.has(id);
  return <>{groups.map(group => (
    <GroupExtras key={group} store={props.store} group={group} choices={choices} show={show} />
  ))}</>;
}

/** The depth chooser. Local to the form: it is a view preference, not part of the profile. */
function TierFilter(props: {
  mode: TierMode; onChange: (mode: TierMode) => void; visibility: Visibility; summary: string;
  /** Which starter situation "default" currently means. UX-9 made that a choice, so it is named. */
  starterNote: string;
}): ReactNode {
  return (
    <div className="card elev-sm stack-tight">
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="card-kicker" style={{ padding: 0 }}>How much detail to show</legend>
        <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          {TIER_MODES.map(option => (
            <label className="radio" key={option.mode} style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="profile-tier"
                value={option.mode}
                checked={props.mode === option.mode}
                style={{ position: 'static', opacity: 1, width: 16, height: 16 }}
                onChange={() => props.onChange(option.mode)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="field-help" style={{ margin: 0 }}>
        Hiding an input changes nothing: every value stays exactly as it is and the model uses all of
        them. Anything that needs attention is shown whichever setting you pick.
        Showing {props.visibility.inputCount} input{props.visibility.inputCount === 1 ? '' : 's'}.
      </p>
      <p className="field-help" style={{ margin: 0 }}>
        {props.summary} A value you changed is marked <span className="tag tag-outline">edited</span> and can
        be put back on its own, or a whole section at a time. {props.starterNote}
      </p>
    </div>
  );
}

/** Puts one section back to the starter profile, and says how much that would undo. */
function GroupReset(props: { store: ProfileStore; group: FieldGroupId; label: string }): ReactNode {
  const ids = resettableInGroup(props.store.provenance, props.group);
  if (ids.length === 0) return null;
  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{ alignSelf: 'flex-start' }}
      onClick={() => props.store.resetGroup(props.group)}
    >
      Reset {props.label.toLowerCase()} ({ids.length} value{ids.length === 1 ? '' : 's'}) to the default
    </button>
  );
}

/**
 * What a jump did, once it has landed (UX-11).
 *
 * Shown above the form rather than announced only to assistive technology, because the thing it
 * reports — the reader's chosen depth moving — is visible on screen and must be attributable. It is
 * dismissible and it carries no figure.
 */
function ArrivalNote(props: { arrival: Arrival; onDismiss: () => void }): ReactNode {
  return (
    <div className="card elev-sm stack-tight field-arrival" role="status" data-testid="field-arrival">
      <p className="field-plain" style={{ margin: 0 }}>{fieldArrivalNote(props.arrival.target)}</p>
      {props.arrival.raisedTo
        ? <p className="field-help" style={{ margin: 0 }} data-testid="tier-raised">
            {tierRaiseNote(props.arrival.target, props.arrival.raisedTo)}
          </p>
        : null}
      <button type="button" className="link-button" style={{ alignSelf: 'flex-start' }} onClick={props.onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

interface Arrival {
  target: FieldTarget;
  /** The depth the filter was widened to, or null when it was already wide enough. */
  raisedTo: TierMode | null;
}

export function ProfileForm(props: {
  store: ProfileStore; groups: readonly FieldGroupId[]; openByDefault?: readonly FieldGroupId[];
  /** Opt in to the tier filter. Screens that render one targeted group leave it off. */
  filterable?: boolean;
  /**
   * A request to put one registry input in front of the reader (UX-11). The form widens its own
   * filter far enough for the target to be visible, opens the group holding it, scrolls to it and
   * focuses it — and says so, because the filter is the reader's setting even though moving it
   * changes nothing about the plan.
   */
  focus?: FieldFocusRequest | null | undefined;
}): ReactNode {
  const { store } = props;
  const [mode, setMode] = useState<TierMode>(DEFAULT_TIER_MODE);
  const effective: TierMode = props.filterable ? mode : 'all';
  const choices = useMemo(() => choiceFieldsFor(store.base), [store.base]);
  const visibility = useMemo(
    () => fieldVisibility(effective, store.defs, choices, store.validation.issues),
    [effective, store.defs, choices, store.validation.issues],
  );
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [pending, setPending] = useState<FieldTarget | null>(null);
  const focusSequence = props.focus?.sequence ?? null;

  // A request decides what has to change; it never touches the DOM, because the target may not be
  // rendered yet. Asking for the same field twice is two requests, so a second click still works.
  useEffect(() => {
    const request = props.focus;
    if (!request) return;
    const target = fieldTarget(store.base, request.fieldId);
    if (!target || !props.groups.includes(target.group)) return;
    const raise = props.filterable ? raiseModeFor(target.tier, mode) : null;
    if (raise) setMode(raise);
    setArrival({ target, raisedTo: raise });
    setPending(target);
    // Deliberately keyed on the request alone: the rest is read at the moment it fires, and a
    // re-render caused by the mode change it makes must not re-enter this.
  }, [focusSequence]); // eslint-disable-line react-hooks/exhaustive-deps

  // The second pass runs after the widened filter has rendered, so the box exists to be focused.
  useEffect(() => {
    if (!pending) return;
    setPending(null);
    const element = document.getElementById(pending.id);
    if (!element) return;
    // A collapsed group hides its inputs without removing them, and a hidden input cannot take focus.
    const group = element.closest('details');
    if (group && !group.open) group.open = true;
    element.scrollIntoView({ block: 'center' });
    (element as HTMLElement).focus({ preventScroll: true });
  }, [pending, effective]);

  const open = new Set(props.openByDefault ?? props.groups);
  if (arrival) open.add(arrival.target.group);
  const show: Show = fieldId => visibility.shows(fieldId);
  return (
    <>
      {arrival ? <ArrivalNote arrival={arrival} onDismiss={() => setArrival(null)} /> : null}
      {props.filterable
        ? <TierFilter mode={mode} onChange={setMode} visibility={visibility}
            summary={provenanceSummary(store.provenance)} starterNote={store.starterNote} />
        : null}
      {props.groups.map(groupId => {
        const group = FIELD_GROUPS.find(item => item.id === groupId);
        if (!group) return null;
        if (!visibility.showsGroup(groupId)) return null;
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
              {groupId === 'property' ? <GroupExtras store={store} group={groupId} choices={choices} show={show} /> : null}
              <FieldGrid store={store} defs={defs} columns={groupId === 'portfolios' ? 3 : 2} show={show} />
              {groupId !== 'property' ? <GroupExtras store={store} group={groupId} choices={choices} show={show} /> : null}
              {/* The matrix renders the market group's issues itself; if it is filtered away, they still must appear. */}
              {groupId === 'market' && visibility.shows('market.correlation') ? null : <GroupIssues store={store} group={groupId} />}
              <GroupReset store={store} group={groupId} label={group.label} />
            </fieldset>
          </details>
        );
      })}
    </>
  );
}
