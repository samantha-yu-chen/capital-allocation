/**
 * Overview: the current position, this year's cash flow, the reference FIRE arithmetic and the full
 * annual ledger, all from the deterministic engine.
 *
 * The reference FIRE figures are transparent ratios, not a safety result — spec section 6 is explicit
 * that only the Monte Carlo screen answers "will this work". The wording on screen says so.
 */
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { LedgerOptions } from '../../engine/index.js';
import { computeOverview, type LedgerRowModel, type MoneyBasis, type OverviewModel } from '../view/overview-model.js';
import { money, moneyExact, moneySigned, percent, ratio, years } from '../view/format.js';
import { Banner, Card, ExpandableRow, Line, SelectField } from './components.js';
import { ProfileForm } from './profile-form.js';
import type { ProfileStore } from './profile-state.js';
import type { Profile } from '../../domain/contracts.js';

const LEDGER_COLUMNS = [
  'Age', 'Phase', 'Gross income', 'Tax + NI + CGT', 'Pension in', 'Spending', 'Surplus', 'Liquid', 'Pension', 'Net worth',
] as const;

function LedgerDetail(props: { row: LedgerRowModel; basis: MoneyBasis }): ReactNode {
  const v = props.row[props.basis];
  const entries: [string, string][] = [
    ['Employment income', money(v.employmentIncome)],
    ['Other income', money(v.otherIncome)],
    ['State pension', money(v.statePensionIncome)],
    ['Rental income', money(v.rentalIncome)],
    ['Property operating costs required', money(v.propertyOperatingCosts)],
    ['Mortgage interest required', money(v.mortgageInterest)],
    ['Mortgage principal paid', money(v.mortgagePrincipal)],
    ['Property transaction cash flow', money(v.propertyTransactionCashFlow)],
    ['Included rent removed', money(v.rentRemoved)],
    ['Landlord finance tax relief', money(v.rentalFinanceRelief)],
    ['Closing property value', money(v.propertyValue)],
    ['Closing mortgage debt', money(v.mortgageDebt)],
    ['Closing property equity', money(v.propertyEquity)],
    ['Purchase funding', money(v.propertyPurchaseFunding)],
    ['Purchase tax and costs', money(v.propertyAcquisitionCosts)],
    ['Property appreciation', money(v.propertyAppreciation)],

    ['Employer pension contribution', money(v.pensionContributionEmployer)],
    ['Member pension contribution', money(v.pensionContributionMember)],
    ['Income tax', money(v.incomeTax)],
    ['Employee NI', money(v.employeeNi)],
    ['Capital gains tax', money(v.capitalGainsTax)],
    ['Essential spending required', money(v.spendingEssential)],
    ['Discretionary spending required', money(v.spendingDiscretionary)],
    ['Spending funded', money(v.spendingFunded)],
    ['Capital needs required / funded', `${money(v.capitalNeedsRequired)} / ${money(v.capitalNeedsFunded)}`],
    ['Shortfall', money(v.shortfall)],
    ['Investable surplus', moneySigned(v.investableSurplus)],
    ['Held back as cash reserve', money(v.allocatedToCashReserve)],
    ['Allocated to ISA', money(v.allocatedToIsa)],
    ['Allocated to GIA', money(v.allocatedToGia)],
    ['ISA withdrawal', money(v.withdrawalIsa)],
    ['GIA disposal proceeds', money(v.withdrawalGia)],
    ['Pension withdrawal (gross)', money(v.withdrawalPension)],
    ['— tax free / taxable', `${money(v.pensionWithdrawalTaxFree)} / ${money(v.pensionWithdrawalTaxable)}`],
    ['Investment return', moneySigned(v.investmentReturnTotal)],
    ['Closing cash', money(v.closingCash)],
    ['Closing ISA', money(v.closingIsa)],
    ['Closing GIA (cost basis)', `${money(v.closingGia)} (${money(v.giaCostBasis)})`],
    ['Closing pension / SIPP', `${money(v.closingPension)} / ${money(v.closingSipp)}`],
    ['Emergency reserve target', money(v.emergencyReserveTarget)],
    ['Liquidity coverage', `${props.row.liquidityCoverageYears === Infinity ? 'no essential spending' : `${props.row.liquidityCoverageYears.toFixed(1)} years`}${props.row.meetsMinimumLiquidity ? '' : ' — below the minimum'}`],
    ['ISA allowance remaining', money(props.row.isaAllowanceRemaining)],
    ['Pension allowance remaining', money(props.row.pensionAllowanceRemaining)],
    ['Spending source', props.row.spendingSource],
    ['Inflation index (opening → closing)', `${props.row.inflationIndex.toFixed(4)} → ${props.row.closingInflationIndex.toFixed(4)}`],
    ['Pension accessible', props.row.pensionAccessible ? 'yes' : 'no'],
  ];
  return (
    <>
      {entries.map(([label, value]) => (
        <div className="line" key={label}>
          <dt className="text-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      {props.row.failures.length ? (
        <div className="span-all">
          <b className="field-error">
            {props.row.failures.map(failure => `${failure.code} (shortfall ${moneyExact(failure.shortfall)})`).join('; ')}
          </b>
        </div>
      ) : null}
    </>
  );
}

function LedgerTable(props: { model: OverviewModel }): ReactNode {
  const [basis, setBasis] = useState<MoneyBasis>('real');
  const [from, setFrom] = useState<number>(props.model.rows[0]?.age ?? 0);
  const rows = props.model.rows.filter(row => row.age >= from).slice(0, 25);
  const ages = props.model.rows.map(row => row.age);
  return (
    <Card kicker="Annual ledger" title="Every projected year">
      <p className="card-body">
        The deterministic run: the configured nominal means every year, not a sampled path. Expand a year
        to see all of its line items. Years are half-open — the row for age {ages[0]} covers [{ages[0]}, {(ages[0] ?? 0) + 1}).
      </p>
      <div className="row">
        <SelectField
          label="Money basis"
          value={basis}
          options={[
            { value: 'real' as const, label: 'Today’s money (real)' },
            { value: 'nominal' as const, label: 'Nominal (as the ledger computes)' },
          ]}
          onChange={setBasis}
          help="Flows are deflated by the opening index and closing balances by the closing index."
        />
        <SelectField
          label="Start from age"
          value={String(from)}
          options={ages.map(age => ({ value: String(age), label: String(age) }))}
          onChange={value => setFrom(Number(value))}
          help="Twenty-five years are shown at a time."
        />
      </div>
      <div className="table-scroll">
        <table className="table">
          <caption>
            Showing ages {rows[0]?.age ?? '—'}–{rows[rows.length - 1]?.age ?? '—'} of {ages[0]}–{ages[ages.length - 1]}.
            Amounts in {basis === 'real' ? 'today’s money' : 'nominal pounds'}.
          </caption>
          <thead>
            <tr>
              {LEDGER_COLUMNS.map((column, index) => (
                <th key={column} scope="col" className={index <= 1 ? undefined : 'numeric'}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const v = row[basis];
              return (
                <ExpandableRow
                  key={row.age}
                  columns={LEDGER_COLUMNS.length}
                  failed={row.failures.length > 0}
                  label={`Age ${row.age} detail (${basis === 'real' ? 'today’s money' : 'nominal'})`}
                  detail={<LedgerDetail row={row} basis={basis} />}
                  cells={[
                    row.age,
                    row.phase,
                    money(v.grossIncome),
                    money(v.totalTax),
                    money(v.pensionContributionTotal),
                    money(v.spendingRequired),
                    moneySigned(v.investableSurplus),
                    money(v.liquid),
                    money(v.pensionBalance),
                    money(v.netWorth),
                  ]}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReferenceFire(props: { model: OverviewModel }): ReactNode {
  const r = props.model.reference;
  return (
    <Card kicker="Reference FIRE target" title="Transparent arithmetic, not a safety result" elevation="md">
      <p className="card-body">
        These are the spec’s reference ratios. They ignore sequence of returns, tax on withdrawals and
        the shape of the path. The spending reference is the entered retirement budget before property adjustments. The FIRE &amp; Monte Carlo screen includes housing cash flows when testing whether the plan survives.
      </p>
      <dl className="kv">
        <Line label="Annual retirement spending (today’s money)" value={money(r.retirementSpendingReal)} />
        <Line label="Reference withdrawal rate" value={percent(r.withdrawalRate, 2)} />
        <Line label="Reference FIRE number (spending ÷ rate)" value={money(r.referenceFireNumber)} strong />
        <Line label="Projected investable assets at the FIRE age" value={money(r.investableAssetsAtFireReal)} />
        <Line label="Coverage of the reference number" value={ratio(r.referenceFireRatio)} />
        <Line label={`Bridge to pension access (${years(r.bridgeYears)})`} value={money(r.requiredBridgeCapitalReal)} />
        <Line label="Accessible capital at FIRE, and its coverage" value={`${money(r.accessibleWealthAtFireReal)} · ${ratio(r.liquidFireRatio)}`} />
        <Line label="Post-access requirement" value={money(r.requiredPostPensionCapitalReal)} />
        <Line label="Pension capital at FIRE, and its coverage" value={`${money(r.lockedWealthAtFireReal)} · ${ratio(r.pensionCoverageRatio)}`} />
      </dl>
      <hr className="hr" />
      <dl className="kv">
        <Line label="Terminal net worth on this single path" value={money(r.terminalNetWorthReal)} />
        <Line label="Peak net worth on this single path" value={money(r.peakNetWorthReal)} />
        <Line
          label="Deterministic outcome"
          value={props.model.success
            ? 'funded every year'
            : `first failure at age ${r.firstFailureAge ?? '—'} (${r.yearsWithShortfall} shortfall ${r.yearsWithShortfall === 1 ? 'year' : 'years'})`}
          strong
        />
      </dl>
    </Card>
  );
}

function CashFlow(props: { model: OverviewModel }): ReactNode {
  const c = props.model.cashFlow;
  const m = props.model.marginal;
  return (
    <Card kicker="Annual cash flow" title={`Age ${c.age}, in today’s money`} elevation="md">
      <dl className="kv">
        <Line label="Gross income" value={money(c.grossIncome)} title="Employment, other, state pension, taxable savings interest, GIA dividends and any gross pension withdrawal." />
        <Line label="Pension contributions (employer)" value={money(c.pensionContributionEmployer)} />
        <Line label="Pension contributions (member)" value={money(c.pensionContributionMember)} />
        <Line label="Income tax" value={money(c.incomeTax)} />
        <Line label="Employee National Insurance" value={money(c.employeeNi)} />
        {c.capitalGainsTax > 0 ? <Line label="Capital gains tax" value={money(c.capitalGainsTax)} /> : null}
        <Line label="Take-home pay" value={money(c.takeHome)} strong />
        <Line label="Essential spending" value={money(c.essentialSpending)} />
        <Line label="Discretionary spending" value={money(c.discretionarySpending)} />
        {c.capitalNeeds > 0 ? <Line label="Known capital needs" value={money(c.capitalNeeds)} /> : null}
        <Line label="Annual investable surplus" value={moneySigned(c.investableSurplus)} strong />
        <Line label="Savings rate (surplus ÷ take-home)" value={percent(c.savingsRate)} />
      </dl>
      <hr className="hr" />
      <dl className="kv">
        <Line label="Held as cash reserve" value={money(c.allocatedToCashReserve)} />
        <Line label="Into ISA" value={money(c.allocatedToIsa)} />
        <Line label="Into GIA" value={money(c.allocatedToGia)} />
        <Line label="ISA allowance remaining" value={money(c.isaAllowanceRemaining)} />
        <Line label="Pension annual allowance remaining" value={money(c.pensionAllowanceRemaining)} />
      </dl>
      <hr className="hr" />
      {m ? (
        <>
          <dl className="kv">
            <Line
              label={`Income tax + NI on the next ${money(m.increment)} of gross salary`}
              value={`${money(m.total)} · ${percent(m.rate)}`}
              strong
            />
            <Line label="— of which income tax" value={money(m.incomeTax)} />
            <Line label="— of which employee NI" value={money(m.employeeNi)} />
            {Math.abs(m.extraPensionContribution) > 0.005
              ? <Line label="Extra pension contribution triggered by the rise" value={money(m.extraPensionContribution)} />
              : null}
          </dl>
          <p className="footnote">
            Measured by re-running the whole projection with a larger salary, so it is this model’s own
            marginal rate rather than a separate tax formula. The pension policy is held constant, so under
            salary sacrifice part of the increase is sacrificed before tax and the rate reflects that.
          </p>
        </>
      ) : (
        <p className="footnote">Marginal rate unavailable: {props.model.marginalUnavailable}</p>
      )}
    </Card>
  );
}

function engineErrorBanner(error: unknown, _profile: Profile): ReactNode {
  const thrown = error instanceof Error ? error : new Error(String(error));
  return (
    <Banner tone="error" title="The projection could not be produced">
      <p style={{ margin: 0 }}><b>{thrown.name}:</b> {thrown.message}</p>
    </Banner>
  );
}

export function OverviewScreen(props: { store: ProfileStore; ledgerOptions: LedgerOptions }): ReactNode {
  const { store } = props;
  const profile = store.profile;
  const outcome = useMemo(() => {
    if (!profile) return null;
    try {
      return { ok: true as const, model: computeOverview(profile, props.ledgerOptions) };
    } catch (error) {
      return { ok: false as const, error };
    }
  }, [profile, props.ledgerOptions]);

  return (
    <div className="stack">
      {!profile ? (
        <Banner tone="error" title="Fix the inputs before the model can run">
          <p style={{ margin: 0 }}>
            Nothing is sent to the engine while the profile is invalid. The affected groups are marked below.
          </p>
          <ul>
            {store.crossFieldIssues.map(issue => <li key={`${issue.path}:${issue.message}`}>{issue.message}</li>)}
          </ul>
        </Banner>
      ) : null}
      {outcome && !outcome.ok ? engineErrorBanner(outcome.error, profile!) : null}

      <div className="split">
        <div className="stack">
          <ProfileForm
            store={store}
            groups={['personal', 'income', 'household', 'spending', 'assets', 'pension', 'wrappers', 'liquidity', 'portfolios', 'market', 'simulation']}
            openByDefault={['personal', 'income', 'spending', 'assets']}
            filterable
          />
          <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={store.reset}>
            Reset to the specification’s example profile
          </button>
        </div>

        <div className="stack">
          <Card kicker="Current position" title="Kept separable on purpose" elevation="md">
            <dl className="kv">
              <Line label="Liquid wealth (cash + ISA + GIA)" value={money(outcome?.ok ? outcome.model.position.liquid : Number.NaN)} />
              <Line
                label={`Pension (workplace + SIPP, locked until ${store.editable.pension.accessAge})`}
                value={money(outcome?.ok ? outcome.model.position.pension : Number.NaN)}
              />
              <Line label="Property equity" value={money(outcome?.ok ? outcome.model.position.propertyEquity : Number.NaN)} />
              <Line label="Net worth" value={money(outcome?.ok ? outcome.model.position.netWorth : Number.NaN)} strong />
            </dl>
            <p className="footnote">
              Liquid and pension capital are never collapsed into one headline. Property equity is not spendable
              without an explicitly modelled action, so it stays out of the liquid figure.
            </p>
          </Card>

          {outcome?.ok ? <CashFlow model={outcome.model} /> : null}
          {outcome?.ok ? <ReferenceFire model={outcome.model} /> : null}

          {outcome?.ok ? (
            <Card kicker="Assumptions in force" muted>
              <dl className="kv stat-small">
                <Line label="Ledger engine" value={outcome.model.assumptions.engineVersion} />
                <Line label="Tax configuration" value={outcome.model.assumptions.taxConfigVersion} />
                <Line label="Tax policy" value={outcome.model.assumptions.taxPolicy} />
                <Line label="Market assumptions" value={outcome.model.assumptions.marketAssumptionVersion} />
                <Line label="Years projected" value={String(outcome.model.assumptions.years)} />
                <Line label="Retirement level" value={outcome.model.assumptions.options.retirementLevel} />
                <Line label="Surplus allocation" value={outcome.model.assumptions.options.surplusAllocation} />
              </dl>
              <p className="footnote">
                Event order each year: {outcome.model.assumptions.eventOrder.join(' → ')}.
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      {outcome?.ok ? <LedgerTable model={outcome.model} /> : null}
    </div>
  );
}
