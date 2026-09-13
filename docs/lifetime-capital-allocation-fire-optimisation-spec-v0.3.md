# Lifetime Capital Allocation, FIRE & Leverage Optimisation Engine

**Version:** 0.3 Consolidated Spec  
**Primary market:** UK  
**Initial jurisdiction:** Scotland + Rest of UK  
**Core modelling approach:** Deterministic cash-flow engine + Monte Carlo FIRE simulation + marginal capital allocation optimiser + reverse goal solver

---

# 1. Background Context

Most personal-finance calculators solve isolated problems:

- pension contribution calculators optimise tax relief;
- ISA calculators project tax-free investment growth;
- FIRE calculators estimate retirement capital;
- mortgage calculators model affordability;
- salary calculators estimate take-home pay;
- investment calculators assume a fixed annual return.

These isolated calculations are insufficient for real capital-allocation decisions.

The actual question is:

> Given my current income, tax position, assets, liquidity requirements, living costs, FIRE target, investment portfolio, pension, and potential property leverage, where should the next £1 go to maximise lifetime usable wealth while maintaining an acceptable probability of financial independence?

Optimising one wrapper independently can produce a locally optimal but globally poor result.

Examples:

- maximising pension contributions may improve tax efficiency while creating excessive locked wealth;
- prioritising ISA may preserve flexibility while sacrificing valuable current marginal-tax arbitrage;
- holding excessive cash protects liquidity but reduces long-term compounding;
- property leverage may increase expected equity returns while increasing concentration and insolvency risk;
- a deterministic 7% return assumption can make a FIRE plan appear viable even though sequence-of-returns risk makes it fragile;
- a large pension balance does not necessarily allow early retirement because it may be inaccessible before pension age;
- an apparently strong FIRE plan may simply be assuming unrealistically low future living costs;
- fine-tuning tax wrappers may matter less than increasing active income.

The starting use case is a UK resident, particularly a Scottish taxpayer earning approximately **£55,000**.

At this income level, different slices of salary can face materially different marginal tax rates. Therefore the optimal strategy may be:

```text
Use pension selectively around high marginal-tax bands
+
build accessible ISA capital
+
use GIA when relevant
+
maintain sufficient liquidity
+
evaluate property leverage separately
+
control living expenses
+
increase active income where it dominates tax optimisation
+
test the entire plan probabilistically through Monte Carlo simulation
```

The system must model the user's **whole personal balance sheet**, not pension, investments, property, expenses, and FIRE independently.

---

# 2. Core Hypotheses

## Hypothesis 1 — Capital allocation should be marginal

Personal wealth should be optimised at the marginal-pound level rather than through static rules such as:

```text
Put 15% into pension
Max pension first
Always max ISA first
Buy property as soon as possible
```

For every additional £1 of gross income or available capital, the optimal destination depends on:

1. current marginal tax avoided;
2. future withdrawal tax;
3. expected investment return;
4. volatility;
5. time horizon;
6. liquidity requirements;
7. pension-access restrictions;
8. FIRE target;
9. ISA capacity;
10. property leverage opportunities;
11. borrowing cost;
12. risk tolerance;
13. sequence-of-returns risk;
14. current and expected future active income;
15. current and retirement spending.

Therefore:

```text
Optimal Allocation
≠
Universal Account Ordering
```

Instead:

```text
Optimal Allocation =
Tax Arbitrage
+ Expected Compounding
+ Liquidity
+ FIRE Timing
+ Leverage
+ Risk
+ Probability of Plan Success
```

---

## Hypothesis 2 — FIRE must be probabilistic

A FIRE target should not be treated as:

```text
Annual Spending × 25
```

and considered solved.

The traditional 4% rule can provide a useful reference point, but actual retirement sustainability depends on:

- portfolio composition;
- asset volatility;
- inflation;
- retirement duration;
- withdrawal timing;
- sequence of returns;
- pension access;
- state pension;
- property income;
- taxes;
- spending flexibility.

Therefore the primary FIRE question is:

> What is the probability that the user's assets can sustainably fund their desired lifestyle over the required period?

The FIRE engine must therefore be **Monte Carlo based**.

---

## Hypothesis 3 — The limiting factor may be active income

The user's main constraint may not be portfolio optimisation.

It may be insufficient active income.

The engine must distinguish:

```text
Allocation Problem
```

from:

```text
Income Problem
```

Example:

If pension-vs-ISA optimisation improves terminal wealth by £50,000, but increasing annual investable surplus by £10,000 closes a £400,000 FIRE shortfall, then active-income growth is the dominant lever.

The system must explicitly surface this.

---

## Hypothesis 4 — Spending is a structural FIRE variable

Recurring spending affects FIRE twice:

1. it reduces the amount available to invest today;
2. it increases the amount of retirement capital required later.

Therefore lowering recurring spending is not equivalent to earning the same additional amount.

For example:

```text
Monthly spending reduction:
£350

Annual reduction:
£4,200
```

At a 4% reference withdrawal rate:

```text
£4,200 / 0.04
= £105,000
```

So a permanent £4,200 annual spending reduction may:

- create £4,200 more investable surplus each year; and
- reduce the reference FIRE capital requirement by approximately £105,000.

The system should expose this double effect.

---

# 3. Intent

Build an analytical decision-support engine that models:

```text
Income
Tax
Spending
Cash
ISA
GIA
Pension
Property
Mortgage Debt
Investment Risk
Retirement Withdrawals
Inflation
FIRE Probability
```

as one system.

It should answer:

- How far am I from financial independence?
- What probability do I currently have of successfully reaching and sustaining FIRE?
- What salary or annual investment surplus is required to reach an acceptable success probability?
- Where should the next £1 go?
- How much pension is economically rational?
- How much liquid capital should exist before allocating more to locked retirement assets?
- Does buying property improve or weaken the plan?
- What happens if market returns are poor early in retirement?
- How much does spending matter relative to salary growth or wrapper optimisation?
- What are the largest variables driving the outcome?

This is a decision-support and simulation product.

It is **not** intended to provide regulated financial advice.

---

# 4. Primary Goal

The north-star output is:

> Maximise sustainable after-tax lifetime wealth while achieving the user's desired level of financial independence with sufficient liquidity and an acceptable probability of plan success.

The engine must optimise against:

```text
Expected Wealth
+
Tax Efficiency
+
Liquidity
+
FIRE Probability
+
Optionality
-
Tax
-
Fees
-
Debt Risk
-
Liquidity Risk
-
Failure Probability
```

---

# 5. Core System Architecture

The calculation system should contain four major engines:

```text
1. Deterministic Financial Projection Engine

2. Monte Carlo FIRE Engine

3. Marginal Capital Allocation Engine

4. Reverse Goal Solver
```

These should share common domain models but remain separately testable.

---

# 6. Deterministic Projection Engine

The deterministic engine remains necessary.

It should provide:

- reference calculations;
- expected-value projections;
- deterministic test cases;
- debugging;
- transparent year-by-year cash flow;
- baseline scenario comparisons.

For every year:

```text
Opening Assets

+ Active Income
+ Employer Contributions
+ Investment Contributions
+ Investment Returns
+ Rental Income
+ Other Income

- Income Tax
- Investment Tax
- Living Costs
- Property Costs
- Debt Service
- Withdrawals

= Closing Assets
```

This produces the baseline financial ledger.

However:

> Deterministic projections must NOT be treated as the primary measure of FIRE safety.

---

# 7. Monte Carlo FIRE Engine

The Monte Carlo engine is the primary retirement sustainability model.

Instead of assuming:

```text
Every year return = 7%
```

simulate many possible market paths.

Example:

```text
Simulation 1:
+18%
+4%
-21%
+12%
...

Simulation 2:
-19%
-8%
+26%
+10%
...

Simulation 3:
+7%
+9%
+4%
-12%
...
```

Run thousands of paths through the entire lifetime model.

Initial default:

```yaml
monte_carlo:
  simulations: 10000
```

The count must be configurable.

---

# 8. Why Monte Carlo Is Required

Average return alone does not determine retirement success.

Consider two return paths:

```text
Path A:
+20%
+20%
-20%
-20%
```

versus:

```text
Path B:
-20%
-20%
+20%
+20%
```

Even if long-run average returns are similar, retirement outcomes can differ materially if withdrawals occur during early losses.

This is:

```text
Sequence-of-Returns Risk
```

The system must explicitly model it.

---

# 9. Simulation Lifecycle

Each Monte Carlo simulation should model the user's entire lifecycle.

```text
Current Age
    ↓
Accumulation Phase
    ↓
Target FIRE Age
    ↓
Pre-Pension Bridge
    ↓
Pension Access
    ↓
State Pension
    ↓
Late Retirement
    ↓
End of Simulation
```

Every simulated year recalculates:

```text
Income
Tax
Contributions
Asset Returns
Inflation
Property
Debt
Withdrawals
Portfolio Balance
Liquidity
```

---

# 10. Accumulation Phase

Before FIRE, simulate:

```text
salary
salary growth
annual savings
pension contributions
ISA contributions
GIA contributions
investment returns
property appreciation
mortgage reduction
inflation
```

V0.3 may keep salary growth deterministic while market returns are stochastic.

Future versions may model:

```text
job loss
promotion probability
bonus volatility
career breaks
```

---

# 11. Retirement Phase

At FIRE age, employment income may fall to:

```text
£0
```

or another configurable amount.

The model funds spending from available assets according to a defined withdrawal strategy.

Possible default order:

```text
Cash
→ GIA
→ ISA
→ Pension when accessible
```

However this must ultimately be configurable because withdrawal order can itself be a tax optimisation problem.

---

# 12. Critical Distinction: FIRE Capital vs Retirement Capital

The system must distinguish between:

## Accessible Capital

Assets usable before pension-access age:

- Cash
- ISA
- GIA
- accessible property equity where realistically releasable
- other liquid investments

Call this:

```text
Freedom Capital
```

## Locked Retirement Capital

Primarily:

- workplace pension
- SIPP
- other inaccessible retirement assets

Call this:

```text
Retirement Capital
```

A user may have:

```text
£700k Pension
£50k ISA
```

and technically exceed their theoretical FIRE number.

But if they are age 42, they may still be unable to stop working because most capital is inaccessible.

Therefore calculate separately:

```text
Pre-Pension FIRE Gap
Post-Pension Retirement Gap
```

---

# 13. Pre-Pension FIRE Bridge

If:

```text
FIRE age = 45
Pension access = 57
```

then:

```text
Bridge = 12 years
```

The Monte Carlo engine must simulate whether accessible assets survive this bridge.

A simulation fails even if total net worth is high when:

```text
Liquid Assets = £0

while

Pension = £800,000
```

but pension remains inaccessible.

---

# 14. FIRE Success Definition

A Monte Carlo simulation should be successful if the user:

1. never exhausts required accessible assets before pension access;
2. can meet required annual spending;
3. does not become insolvent;
4. retains sufficient assets until the configured terminal age.

Example:

```yaml
life_expectancy_age: 95
```

A simple V0.3 success definition:

```text
Portfolio Balance > 0
at every required year
AND
annual essential spending is funded
```

Later versions may include:

```text
minimum terminal estate
minimum emergency reserve
dynamic spending cuts
care costs
```

---

# 15. FIRE Success Probability

Main output:

```text
FIRE Success Probability
```

Example:

```text
Target FIRE age: 45

10,000 simulations

Successful paths:
7,820

Success probability:
78.2%
```

This replaces a simple binary:

```text
Can retire / Cannot retire
```

---

# 16. Probability Thresholds

Allow user-defined targets.

Example:

```yaml
target_fire_success_probability: 0.90
```

Possible presentation labels:

```text
< 70%      Fragile
70–80%     Moderate
80–90%     Strong
90–95%     High Confidence
> 95%      Very Conservative
```

These labels are presentation-level only.

---

# 17. FIRE Probability Curve

Instead of producing one FIRE age, calculate:

```text
Age 42 → 48% success
Age 43 → 57%
Age 44 → 68%
Age 45 → 78%
Age 46 → 86%
Age 47 → 92%
Age 48 → 95%
```

Identify:

```text
Earliest age reaching target success probability
```

Example:

```text
Target = 90%
Earliest sustainable FIRE age = 47
```

---

# 18. Traditional FIRE Number

Still calculate the conventional FIRE number as a reference:

```text
FIRE Number =
Annual Retirement Spending / Safe Withdrawal Rate
```

Example:

```text
£30,000 / 0.04 = £750,000
```

Label it:

```text
Reference FIRE Number
```

The Monte Carlo result is authoritative for the simulator.

---

# 19. Withdrawal Rate

Safe withdrawal rate remains an input / reference assumption:

```yaml
safe_withdrawal_rate:
  default: 0.04
```

Allow:

```text
3.0%
3.5%
4.0%
4.5%
Custom
```

Monte Carlo must also support direct spending simulation without relying entirely on SWR.

---

# 20. Expense Model Is a Core Input

Living expenses must be treated as one of the primary drivers.

The system must not assume:

```text
Income - Tax = Investable Capital
```

Instead:

```text
Gross Income
- Tax
- NI
- Pension Contributions
- Living Expenses
- Debt Service
- Property Costs
- Other Required Spending
=
Annual Investable Surplus
```

This surplus determines how much capital can flow into:

```text
ISA
Pension
GIA
Cash
Property Deposit
Mortgage Overpayment
```

---

# 21. Baseline Per-Person Monthly Expense

Initial modelling range:

```yaml
living_cost:
  monthly_per_person:
    low: 1300
    base: 1650
    high: 2000
```

Equivalent annual range:

```text
Low:
£1,300 × 12
= £15,600

Base:
£1,650 × 12
= £19,800

High:
£2,000 × 12
= £24,000
```

This range is configurable.

Do not hard-code £1,300–£2,000 as universally correct.

---

# 22. Household Size

Expenses must support:

```yaml
household:
  adults:
  children:
```

Do not assume:

```text
2 people = exactly 2 × individual cost
```

because many costs are shared.

Support:

```yaml
expense_model:
  shared_household_costs:
  per_person_costs:
```

---

# 23. Expense Categories

At minimum:

```yaml
expenses:

  housing:
    rent_or_mortgage:
    council_tax:
    service_charge:
    home_insurance:

  utilities:
    electricity_gas:
    water:
    broadband:
    mobile:

  food:
    groceries:
    eating_out:

  transport:
    public_transport:
    car:
    fuel:
    insurance:

  lifestyle:
    entertainment:
    subscriptions:
    travel:
    shopping:

  health:
    insurance:
    dental:
    medical:

  other:
    miscellaneous:
```

Detailed categorisation is optional.

The user may provide only a single monthly figure.

---

# 24. Essential vs Discretionary Spending

Separate:

```text
Essential Spending
```

from:

```text
Discretionary Spending
```

Example:

```yaml
spending:
  essential_monthly: 1300
  discretionary_monthly: 500
```

This matters because Monte Carlo FIRE should support spending flexibility.

---

# 25. Three Spending Levels

Define:

```text
Floor Spending
Target Spending
Comfort Spending
```

Example:

```yaml
retirement_spending:
  floor: 15600
  target: 19800
  comfort: 24000
```

Per year, real terms.

Interpretation:

- **Floor**: minimum acceptable lifestyle.
- **Target**: expected FIRE lifestyle.
- **Comfort**: preferred lifestyle when portfolio performance permits.

---

# 26. Current Spending vs FIRE Spending

Do not assume they are equal.

Inputs:

```yaml
spending:

  current_monthly:

  target_fire_monthly:

  minimum_fire_monthly:
```

Example:

```text
Current:
£2,000/month

Expected FIRE:
£1,650/month

Minimum acceptable:
£1,300/month
```

---

# 27. Spending Inflation

Retirement spending should normally increase with inflation.

Example:

```text
Year 1:
£19,800

Inflation:
2.5%

Year 2:
£20,295
```

Spending should be shown in today's money in UI while simulation distinguishes:

```text
Nominal Spending
Real Spending
```

---

# 28. Expense Timeline

Support:

```yaml
expense_phases:

  current:
    start_age:
    end_age:
    monthly_spending:

  pre_fire:
    monthly_spending:

  early_fire:
    monthly_spending:

  pension_age:
    monthly_spending:

  late_retirement:
    monthly_spending:
```

A simpler V0.3 implementation can initially use:

```text
Current Spending
FIRE Spending
```

but architecture should support phases.

---

# 29. Lifestyle Creep

Support salary-linked lifestyle inflation.

Example:

```yaml
lifestyle_creep:
  enabled: true
  share_of_real_income_growth_spent: 0.25
```

Meaning:

25% of real income growth is absorbed by higher lifestyle costs rather than invested.

This matters when modelling:

```text
Salary £55k → £75k → £100k
```

---

# 30. Expense Shock

Monte Carlo should eventually support unexpected spending.

Examples:

```text
Home repair
Medical cost
Family support
Temporary unemployment
Car replacement
```

V0.3 may implement this as optional:

```yaml
expense_shock:
  enabled: true
  annual_probability: 0.05
  mean_cost: 5000
```

---

# 31. Investable Surplus

One of the most important outputs:

```text
Annual Investable Surplus =
Net Active Income
-
Annual Cash Living Cost
```

That value becomes available for allocation.

---

# 32. Active-Income Solver

One of the key outputs is:

> How much active income is required to make this plan work?

Inputs:

```text
Target FIRE Age
Target FIRE Success Probability
Target Spending
Existing Assets
Current Salary
Current Spending
```

Solve:

```text
Required Annual Investable Surplus
```

then:

```text
Required Gross Active Income
```

The solver must account for marginal taxation.

---

# 33. Required Income Example

Example output:

```text
Current salary:
£55,000

Target:
FIRE at 45
90% simulation success

Current probability:
63%

Required annual investment:
£24,200

Estimated gross salary required:
£81,500
```

Then show sensitivity:

```text
If target FIRE age = 47:
Required salary = £71,000

If spending falls £5k:
Required salary = £67,500

If expected returns decrease:
Required salary = £88,000
```

---

# 34. Income vs Allocation Attribution

The system should quantify whether the user's largest lever is:

```text
More Income
Lower Spending
Better Tax Allocation
Later FIRE
More Investment Risk
Property Leverage
```

Example:

```text
Improvement in FIRE probability:

Pension optimisation: +2.4%
ISA optimisation: +1.1%
Salary +£10k: +11.7%
Retire 2 years later: +17.2%
Reduce spending £3k: +9.8%
```

This prevents over-optimising small tax differences while ignoring major structural gaps.

---

# 35. UK Tax Model

Tax calculations must be deterministic inside each simulation.

Tax rules must be configurable by:

```text
Jurisdiction
Tax Year
Account Type
```

Suggested:

```text
tax/
  uk/
    2026_27/
      scotland.yaml
      rest_of_uk.yaml
      pension.yaml
      isa.yaml
      cgt.yaml
      dividends.yaml
```

Core functions:

```python
calculate_income_tax(...)
calculate_marginal_tax_rate(...)
calculate_ni(...)
calculate_pension_relief(...)
calculate_cgt(...)
calculate_dividend_tax(...)
calculate_net_income(...)
```

Tax assumptions must not be spread across simulation logic.

---

# 36. Tax-Rule Time Risk

Tax rules can change over multi-decade projections.

V0.3 may assume current tax structure continues in real terms.

The output must clearly disclose this assumption.

Future architecture should support:

```text
Tax Scenario A
Tax Scenario B
Tax Scenario C
```

Examples:

```text
Pension withdrawal tax rises
ISA allowance changes
CGT increases
```

---

# 37. Pension Model

Inputs:

```yaml
pension:
  current_balance:
  employee_contribution:
  employer_contribution:
  employer_match:
  salary_sacrifice_available:
  employer_ni_shareback:
  annual_allowance:
  access_age:
  estimated_withdrawal_tax:
```

Pension value should reflect:

```text
Current Tax Saved
+
NI Saved
+
Employer Contributions
+
Tax-Free Compounding
-
Future Tax
-
Liquidity Constraint
```

---

# 38. Pension Tax-Deferral Logic

Pension should not be treated as universally superior.

Its attractiveness depends heavily on:

```text
Current Marginal Tax Rate
vs
Future Effective Withdrawal Tax Rate
```

Conceptually:

```text
High current tax
+
lower future withdrawal tax
=
strong pension arbitrage
```

The model should detect marginal-tax bands automatically and identify high-value contribution zones.

For a user around £55k, especially a Scottish taxpayer, this may create a sharp difference between:

```text
Contribution that removes income from a high marginal-tax slice
```

and:

```text
Additional contribution once income is already below that boundary
```

Do not hard-code the recommendation.

Generate it from tax configuration.

---

# 39. ISA Model

Inputs:

```yaml
isa:
  current_balance:
  annual_allowance:
  allowance_used:
```

Properties:

```text
No UK CGT
No UK dividend tax
No UK withdrawal tax
Accessible
```

ISA therefore has both:

```text
Tax Value
+
Liquidity Value
```

---

# 40. GIA Model

Model:

- dividend taxation;
- realised capital gains;
- CGT allowance;
- turnover;
- gain realisation;
- unrealised tax deferral.

Do NOT tax all annual appreciation.

Inputs:

```yaml
gia:
  current_balance:
  dividend_yield:
  turnover_rate:
  gain_realisation_rate:
```

---

# 41. Liquidity Model

Liquidity is an explicit constraint.

Calculate:

```text
Liquid Assets =
Cash + ISA + GIA
```

Do not include inaccessible pension capital.

Minimum required liquidity:

```text
Emergency Reserve
+
Known Near-Term Capital Needs
```

Example:

```yaml
emergency_fund_months: 6
```

Metric:

```text
Liquidity Coverage =
Accessible Liquid Assets /
Annual Essential Spending
```

---

# 42. Liquidity Failure

Monte Carlo simulations must be able to fail through liquidity even when net worth remains positive.

Example:

```text
Age 49:

Property Equity = £400k
Pension = £700k

Cash + ISA + GIA = £0

Required spending cannot be funded.
```

This should count as:

```text
FIRE failure
```

unless the model explicitly allows:

```text
property sale
downsizing
borrowing
```

Those actions must never happen implicitly.

---

# 43. Liquidity Option Value

V0.3 should initially model liquidity through constraints rather than assigning an arbitrary price.

Example:

```yaml
minimum_liquid_years_of_spending: 2
```

Optimisation objective:

```text
Maximise expected lifetime wealth

subject to:

Liquid Assets >= minimum threshold
FIRE probability >= target probability
```

---

# 44. Market Return Model

Do not simply generate:

```text
Normal(mean=7%, sd=15%)
```

without documenting assumptions.

The simulation engine should make return generation pluggable.

Initial supported method:

```text
Parametric return model
```

Inputs:

```yaml
equities:
  expected_return:
  volatility:

bonds:
  expected_return:
  volatility:

cash:
  expected_return:
```

Future methods:

```text
Historical bootstrap
Block bootstrap
Regime-based models
Fat-tail distributions
```

---

# 45. Asset Allocation

Portfolio composition must influence simulated returns.

Example:

```yaml
portfolio:
  equities: 0.80
  bonds: 0.15
  cash: 0.05
```

Do not assume ISA, GIA, and pension necessarily hold identical portfolios.

Allow:

```yaml
isa_allocation:
pension_allocation:
gia_allocation:
```

V0.3 may default to a shared allocation.

---

# 46. Correlation

When multiple asset classes are simulated, returns should not be sampled independently.

Support a correlation matrix.

Example:

```text
Equities ↔ Bonds
Equities ↔ Property
Property ↔ Inflation
```

A basic implementation can simplify this initially, but architecture must permit correlated stochastic variables.

---

# 47. Property as a Separate Capital Engine

Property must not simply be added to investments as though it were an ETF.

Model it separately.

Property has:

```text
Equity Return
=
Property Appreciation
+
Net Rental Yield
-
Interest
-
Maintenance
-
Insurance
-
Taxes
-
Transaction Costs
```

But leverage changes return on equity.

---

# 48. Property Leverage Model

Inputs:

```yaml
property_price:
deposit:
mortgage_ltv:
mortgage_interest_rate:
mortgage_term:
mortgage_type:
stamp_duty_or_lbtt:
legal_costs:
maintenance_rate:
insurance:
service_charge:
expected_property_growth:
rental_income:
occupancy_rate:
management_cost:
selling_cost:
```

Calculate:

```text
Initial Equity
Mortgage Balance
Annual Interest
Principal Repayment
Property Value
Property Equity
Net Rental Cash Flow
```

---

# 49. Leverage Effect

Example:

```text
£300k property
£60k deposit
£240k mortgage
```

If property increases 5%:

```text
Property gain = £15k
```

Relative to £60k starting equity:

```text
£15k / £60k = 25%
```

before financing and costs.

The reverse must also be shown:

```text
Property falls 10%
= -£30k

Relative to £60k equity
= -50%
```

Track:

```text
LTV
Debt Service Coverage
Interest Sensitivity
Equity Drawdown
```

---

# 50. Property Monte Carlo Model

Inputs:

```yaml
property:
  market_value:
  mortgage_balance:
  mortgage_rate:
  mortgage_term:
  expected_appreciation:
  appreciation_volatility:
  rental_income:
  vacancy_rate:
  maintenance:
  insurance:
  service_charge:
  transaction_costs:
```

Property value can evolve stochastically.

---

# 51. Mortgage Interest Risk

Support scenarios where mortgage costs change.

For fixed mortgage periods:

```text
Years 1–5:
4%

At refinance:
simulate/refeed rate
```

At minimum scenario analysis should support:

```text
3%
5%
7%
9%
```

mortgage environments.

---

# 52. Owner-Occupied Property vs Rent

For a primary residence, economic benefit includes:

```text
Avoided Rent
+
Property Appreciation
+
Mortgage Principal Accumulation
```

Costs include:

```text
Mortgage Interest
Maintenance
Insurance
Taxes
Transaction Costs
Deposit Opportunity Cost
```

Compare:

```text
Buy
```

against:

```text
Rent + Invest
```

using the same Monte Carlo market paths where practical.

---

# 53. Housing Expense Treatment

Avoid double counting.

If the user currently rents:

```text
Monthly Expense
includes rent
```

If buying:

```text
rent disappears

but is replaced by:

mortgage interest
mortgage principal
maintenance
insurance
council tax
service charge
transaction costs
```

Mortgage principal must not be treated purely as consumption because it builds equity.

Separate:

```text
Housing Cash Outflow
```

from:

```text
Housing Economic Cost
```

---

# 54. Mortgage and FIRE Spending

If mortgage is fully repaid before FIRE, FIRE spending may fall materially.

Example:

```text
Current spending:
£2,000/month

Mortgage:
£700/month
```

If mortgage disappears before retirement:

```text
Retirement spending:
~£1,300/month
```

subject to ongoing property maintenance and housing costs.

Therefore expenses must be able to change by age.

---

# 55. Investment Property

Investment property should model:

```text
Rent
Vacancy
Tax
Maintenance
Debt
Interest
Appreciation
Selling Cost
```

Do not treat gross rental yield as total return.

---

# 56. Opportunity Cost of Property Deposit

Critical comparison:

```text
£60k property deposit
```

versus:

```text
£20k ISA
+
£40k GIA
```

Calculate both trajectories over the same horizon.

Compare:

```text
Expected net worth
Median net worth
10th percentile outcome
90th percentile outcome
FIRE success probability
Liquidity
Maximum drawdown
Debt exposure
```

---

# 57. Marginal Capital Allocation Engine

For each incremental unit of capital, compare:

```text
A. Pension
B. ISA
C. GIA
D. Cash
E. Mortgage Overpayment
F. Property Deposit
```

For each option, rerun the model.

Example:

```text
Allocate next £1,000 to Pension
→ FIRE success = 87.4%

Allocate next £1,000 to ISA
→ FIRE success = 88.2%

Allocate next £1,000 to GIA
→ FIRE success = 87.6%

Mortgage overpayment
→ FIRE success = 86.9%
```

Evaluate not only terminal wealth but:

```text
Change in FIRE Probability
Change in Median Wealth
Change in Liquidity
Change in Downside Risk
```

---

# 58. Marginal Decision Metrics

For each allocation candidate calculate:

```text
Δ Expected Lifetime Wealth
Δ Median Terminal Wealth
Δ FIRE Success Probability
Δ 10th Percentile Outcome
Δ Accessible Wealth at FIRE
Δ Tax Paid
Δ Debt
```

Then classify:

```text
Dominant
Near Equivalent
Assumption Sensitive
Inferior
```

Avoid pretending tiny numerical differences constitute strong recommendations.

---

# 59. Tax-Band Boundary Detection

The allocation engine should automatically identify marginal tax cliffs/boundaries.

Conceptual output:

```text
Salary: £55,000

£55,000 → tax boundary X:
Pension tax advantage: HIGH

Below boundary X:
ISA becomes comparatively more attractive.
```

Do not hard-code a £55k-specific recommendation.

Tax rules should generate the result.

---

# 60. Reverse FIRE Solver

Instead of only asking:

> What happens if I retire at 45?

the model must solve:

> What needs to change for age 45 to achieve a 90% success probability?

Possible unknowns:

```text
Required Salary
Required Annual Savings
Required FIRE Age
Required Starting Capital
Required Spending Reduction
Required Pension Contribution
```

Use numerical search.

---

# 61. Spending Sensitivity

Run at minimum three expense scenarios:

```text
Low:
£1,300/month

Base:
£1,650/month

High:
£2,000/month
```

Output example:

| Monthly spending | FIRE age @ 90% success | Required salary | Reference FIRE number |
|---:|---:|---:|---:|
| £1,300 | calculated | calculated | £390k at 4% |
| £1,650 | calculated | calculated | £495k at 4% |
| £2,000 | calculated | calculated | £600k at 4% |

Only the reference FIRE values above are deterministic examples. FIRE age and required salary must come from the model.

---

# 62. Income Uplift Scenarios

Create scenario bands:

```text
Current:
£55k

Scenario A:
£65k

Scenario B:
£75k

Scenario C:
£90k

Scenario D:
£120k
```

For each calculate:

- take-home;
- marginal tax;
- pension opportunity;
- annual ISA contribution;
- annual total investment;
- projected FIRE age;
- FIRE success probability;
- projected liquid net worth;
- projected pension;
- total net worth.

This should expose whether increasing active income has a much larger effect than fine-tuning tax allocation.

---

# 63. Required Scenario Matrix

At minimum evaluate:

```text
Salary:
£55k
£65k
£75k
£90k
£120k
```

against:

```text
Monthly spending:
£1,300
£1,650
£2,000
```

and:

```text
Capital strategy:
ISA Heavy
Pension Tax-Band Optimised
Balanced
Property
```

The system should show how strongly spending and income dominate or interact with wrapper optimisation.

---

# 64. Scenario Engine

Support named scenarios:

```text
Baseline
ISA Heavy
Pension Heavy
Income Growth
Property Heavy
No Property
Aggressive FIRE
Conservative FIRE
```

Each scenario should use identical simulation seeds where possible.

---

# 65. Common Random Numbers

For scenario comparison, use identical simulated market paths where possible.

Scenario A and B should experience the same:

```text
Year 1 equity crash
Year 2 recovery
Year 3 inflation spike
```

This reduces simulation noise when evaluating strategy differences.

Use seeded random number generation.

---

# 66. Reproducibility

Every simulation result must store:

```text
random_seed
simulation_count
assumption_version
tax_config_version
portfolio assumptions
property assumptions
```

Example:

```yaml
simulation:
  seed: 421337
  paths: 10000
```

The same inputs and seed must reproduce the same result.

---

# 67. Monte Carlo Outputs

At minimum output:

```text
Success Probability
Median Terminal Wealth
Mean Terminal Wealth
10th Percentile Terminal Wealth
25th Percentile
75th Percentile
90th Percentile
Worst Observed Outcome
Median FIRE Capital
Probability of Pre-Pension Bridge Failure
Probability of Portfolio Depletion
```

---

# 68. Wealth Distribution

For major ages:

```text
40
45
50
57
65
75
85
95
```

report:

```text
P10
P25
Median
P75
P90
```

for:

```text
Liquid Wealth
Pension
Property Equity
Total Net Worth
```

---

# 69. Failure Analysis

Do not only report:

```text
22% simulations failed
```

Classify causes:

```text
Pre-Pension Liquidity Failure
Portfolio Depletion
High Inflation
Early Market Crash
Mortgage Stress
Excessive Spending
Insufficient Savings
```

Example:

```text
22% failed simulations:

11% — pre-pension liquidity exhaustion
6% — poor early retirement returns
3% — prolonged inflation
2% — property/mortgage stress
```

---

# 70. Sequence Risk Metrics

Explicitly report:

```text
Probability portfolio falls >20% during first 5 FIRE years
Probability accessible portfolio falls below 2 years' expenses
Median recovery time
```

---

# 71. Sensitivity Analysis

Monte Carlo and sensitivity analysis serve different purposes.

Monte Carlo:

```text
What is the distribution of outcomes under uncertainty?
```

Sensitivity:

```text
Which assumptions matter most?
```

Test at minimum:

```text
Expected equity return
Equity volatility
Inflation
Spending
Salary growth
FIRE age
Mortgage rate
Property growth
Pension withdrawal tax
```

---

# 72. Stress Testing

In addition to Monte Carlo, include deterministic stress scenarios.

Examples:

```text
2000-style equity crash
2008-style crash
High inflation decade
Lost decade
Mortgage rate shock
Property crash
Job loss
```

Do not rely on Monte Carlo alone to discover extreme but plausible states.

---

# 73. Historical Backtesting — Future Extension

Architecture should eventually allow the same retirement strategy to be tested against historical sequences.

Example:

```text
Retire in 1966
Retire in 2000
Retire in 2007
```

This is outside V0.3 implementation requirements but should not be blocked by architecture.

---

# 74. Whole-Balance-Sheet Model

Represent:

```text
                     ACTIVE INCOME
                          │
                          ▼
                 Annual Free Cash Flow
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
      Pension            ISA             GIA
          │               │               │
          └───────────────┼───────────────┘
                          │
                          ▼
                   Financial Assets


ACTIVE INCOME ────────────┐
                          ▼
                    Property Deposit
                          │
                          ▼
                   Leveraged Property
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        Property Equity         Housing / Rental
                                    Cash Flow
```

---

# 75. Net-Worth Metrics

Calculate separately:

```text
Net Worth
Financial Net Worth
Liquid Net Worth
Accessible FIRE Capital
Retirement Capital
Property Equity
Total Debt
```

Do not collapse them into one number.

---

# 76. FIRE Metrics

## Reference FIRE Ratio

```text
Investable Assets /
Reference FIRE Number
```

## Liquid FIRE Ratio

```text
Accessible FIRE Assets /
Required Pre-Pension Capital
```

## Pension Coverage

```text
Retirement Assets /
Required Post-Pension Capital
```

## Monte Carlo FIRE Probability

```text
Successful Simulations /
Total Simulations
```

This is the primary FIRE metric.

---

# 77. Optimisation Objective

Do NOT optimise:

```text
maximum nominal net worth
```

Primary optimisation should approximate:

```text
Maximum Lifetime Usable Wealth
```

Conceptually:

```text
Objective =
After-Tax Spendable Wealth
+ Liquidity Utility
+ FIRE-Date Utility
- Insolvency Risk
- Debt Risk
- Locked-Capital Penalty
```

V0.3 objective:

```text
Maximise:
After-Tax Wealth at target ages

Subject to:
minimum emergency fund
minimum liquidity
target FIRE probability
maximum acceptable debt
pension access constraints
ISA allowance
tax rules
```

---

# 78. Required User Inputs

## Personal

```yaml
age:
country:
tax_region:
target_fire_age:
simulation_end_age:
target_success_probability:
```

## Income

```yaml
gross_salary:
bonus:
other_income:
salary_growth:
```

## Spending

```yaml
current_monthly:
essential_monthly:
discretionary_monthly:
target_fire_monthly:
minimum_fire_monthly:
```

## Assets

```yaml
cash:
isa:
gia:
pension:
sipp:
property_value:
mortgage_balance:
```

## Pension

```yaml
employee_contribution:
employer_contribution:
employer_match:
salary_sacrifice:
pension_access_age:
```

## Portfolio

```yaml
equity_weight:
bond_weight:
cash_weight:
```

## Simulation

```yaml
equity_return:
equity_volatility:
bond_return:
bond_volatility:
inflation:
simulation_count:
random_seed:
```

---

# 79. Example Profile

```yaml
profile:
  age: 31
  tax_region: scotland
  target_fire_age: 45
  simulation_end_age: 95
  target_success_probability: 0.90

income:
  salary: 55000
  annual_growth: 0.03

spending:
  current_monthly: 1650
  essential_monthly: 1300
  discretionary_monthly: 350
  fire_monthly: 1650
  minimum_fire_monthly: 1300

assets:
  cash: 10000
  isa: 50000
  gia: 15000
  pension: 25000

pension:
  employee_contribution: 0.05
  employer_contribution: 0.05
  access_age: 57

portfolio:
  equities: 0.85
  bonds: 0.10
  cash: 0.05

simulation:
  runs: 10000
  seed: 421337

fire:
  reference_swr: 0.035
```

---

# 80. Desired Dashboard

Example:

```text
CURRENT POSITION

Age                           31
Salary                        £55,000
Monthly spending              £1,650
Annual spending               £19,800
Liquid wealth                 £75,000
Pension                       £25,000
Property equity               £0
Net worth                     £100,000
```

```text
CASH FLOW

Gross income                  £55,000
Take-home                     calculated
Essential expenses            £1,300/month
Discretionary                 £350/month
Total spending                £1,650/month
Monthly investable surplus    calculated
Annual investable surplus     calculated
Savings rate                  calculated
```

```text
FIRE TARGET

Target age                    45
Target spending               £19,800
Reference SWR                 3.5%
Reference FIRE number         £565,714
Target success probability    90%
```

```text
MONTE CARLO

Current success probability   calculated
Median terminal wealth        calculated
10th percentile               calculated
90th percentile               calculated

Pre-pension bridge failure    calculated
Overall depletion             calculated
```

```text
TARGET GAP

Current likely FIRE age       calculated
90%-success FIRE age          calculated

Required annual investment    calculated
Current annual investment     calculated

Estimated required salary     calculated
```

---

# 81. Strategy Comparison

Example output structure:

| Strategy | FIRE Success | Median Wealth | P10 | Liquid @ FIRE |
|---|---:|---:|---:|---:|
| Current | calculated | calculated | calculated | calculated |
| Pension Heavy | calculated | calculated | calculated | calculated |
| ISA Heavy | calculated | calculated | calculated | calculated |
| Salary £75k | calculated | calculated | calculated | calculated |
| FIRE +3 years | calculated | calculated | calculated | calculated |

---

# 82. Decision Output

The system should not say:

```text
Put £10k into ISA.
```

without context.

Instead:

```text
Marginal £10k Allocation

ISA:
FIRE probability +X%
Accessible wealth at FIRE +£Y

Pension:
FIRE probability +A%
Age-57 wealth +£B

Difference:
ISA materially improves bridge resilience.

Result:
ISA dominates under current FIRE-age assumptions.

If FIRE age moves above pension access age,
pension becomes more competitive.
```

---

# 83. Implementation Architecture

Suggested separation:

```text
domain/
  tax/
  income/
  spending/
  pension/
  isa/
  gia/
  property/
  portfolio/
  fire/
  cashflow/

engine/
  deterministic/
  monte_carlo/
  projection/
  withdrawals/
  optimisation/
  reverse_solver/
  scenarios/
  stress/

config/
  tax/
  market/
  assumptions/

presentation/
  cli/
  web/
```

Do not place business logic in UI code.

---

# 84. Monte Carlo Interfaces

Suggested abstraction:

```python
class ReturnGenerator:
    def generate_path(
        self,
        years: int,
        rng
    ) -> MarketPath:
        ...
```

Future implementations:

```python
ParametricReturnGenerator
HistoricalBootstrapGenerator
BlockBootstrapGenerator
RegimeReturnGenerator
```

The simulation engine should consume the interface, not know the underlying sampling methodology.

---

# 85. Simulation Performance

10,000 simulations across 60+ years can become computationally expensive once tax, property, and optimisation logic are included.

Design for:

```text
Vectorisation where reasonable
Deterministic seeds
Batch simulation
Caching
Parallelisation if useful
```

Correctness takes priority over optimisation.

---

# 86. Testing Requirements

## Deterministic Tests

Known tax examples.

Known FIRE arithmetic.

Known compound-growth examples.

Known mortgage amortisation.

Known leverage calculations.

---

## Monte Carlo Determinism

With:

```text
Seed = X
Inputs = Y
```

the output must reproduce exactly.

---

## Statistical Tests

For sufficiently many generated samples:

```text
Observed Mean ≈ Configured Mean
Observed Volatility ≈ Configured Volatility
```

within reasonable tolerance.

---

## Zero-Volatility Test

If:

```text
volatility = 0
```

Monte Carlo output should converge to deterministic projection.

This is a critical cross-engine verification.

---

# 87. Golden Scenario Tests

### Scenario A — FIRE Reference

```text
Annual spending = £40k
SWR = 4%

Reference FIRE number = £1m
```

### Scenario B — Property Leverage

```text
Property = £300k
Deposit = £60k
Rise = 5%

Gross appreciation = £15k
Gross return on starting equity = 25%
before costs
```

### Scenario C — Certain Success

Extremely high starting wealth should produce near-100% success.

### Scenario D — Certain Failure

Zero assets + zero income + positive spending should produce 0%.

### Scenario E — Locked-Wealth Failure

Large inaccessible pension + zero liquid wealth before pension age must fail.

### Scenario F — Spending Effect

Reducing recurring annual spending should:

- increase annual investable surplus; and
- reduce FIRE capital requirement.

Both effects must appear in results.

---

# 88. V0.3 Scope

V0.3 MUST include:

1. UK tax model;
2. Scotland support;
3. salary and spending;
4. essential vs discretionary expenses;
5. £1,300 / £1,650 / £2,000 monthly expense scenarios;
6. pension;
7. ISA;
8. GIA;
9. cash;
10. accessible vs locked capital;
11. deterministic year-by-year projection;
12. Monte Carlo investment returns;
13. FIRE success probability;
14. sequence-of-returns risk;
15. pre-pension bridge;
16. FIRE-age probability curve;
17. reverse annual-savings solver;
18. reverse gross-salary solver;
19. marginal Pension/ISA/GIA comparison;
20. basic single-property model;
21. property leverage;
22. rent-vs-buy comparison;
23. named scenarios;
24. deterministic stress scenarios;
25. percentile outputs;
26. seeded reproducibility;
27. sensitivity analysis;
28. income-vs-allocation attribution;
29. spending sensitivity.

---

# 89. Explicitly Deferred Beyond V0.3

Do not initially require:

```text
Live brokerage integrations
Bank feeds
Regulated advice
Multiple investment properties
Couples tax optimisation
International tax
Estate planning
Stochastic employment loss
Historical bootstrap
Regime-switching models
Dynamic withdrawal strategies
AI-generated financial recommendations
```

Architecture should permit later extension.

---

# 90. Implementation Priority

Priority order:

```text
1. Correct tax engine

2. Correct deterministic ledger

3. Correct expense/cash-flow engine

4. Monte Carlo simulation engine

5. FIRE success/failure logic

6. Pre-pension bridge

7. Reverse savings/income solver

8. Marginal capital allocation

9. Property leverage

10. Scenario comparison

11. UI
```

The UI is not the product.

The model is the product.

---

# 91. Product Decision Principle

The engine should never optimise a number without explaining what it represents.

For example:

```text
Largest Net Worth
```

is not necessarily equivalent to:

```text
Earliest FIRE
```

which is not necessarily equivalent to:

```text
Highest FIRE Success Probability
```

which is not necessarily equivalent to:

```text
Maximum Lifetime Spending
```

The model should expose these competing objectives.

---

# 92. Core Question Hierarchy

The system should answer these questions in this order.

## 1. Where am I now?

```text
Income
Spending
Assets
Debt
Liquidity
Tax position
```

## 2. Where do I want to go?

```text
FIRE age
Lifestyle spending
Success probability
```

## 3. Does my current trajectory work?

```text
Monte Carlo FIRE probability
```

## 4. What is causing the gap?

```text
Income?
Spending?
Liquidity?
Returns?
Tax?
Time?
```

## 5. What moves the outcome most?

```text
Higher income
Lower spending
Later FIRE
Pension optimisation
ISA
Property
```

## 6. Where should the next £1 go?

Only answer this after understanding the whole plan.

---

# 93. Final North Star

The product is not a pension calculator.

It is not an ISA calculator.

It is not a mortgage calculator.

It is not simply a FIRE calculator.

It is:

> **A whole-balance-sheet capital allocation and financial-independence simulation engine.**

Its job is to answer:

```text
Given where I am,
where I want to be,
the taxes I face,
the uncertainty of markets,
the liquidity I require,
the living costs I actually have,
and the leverage I may use:

What combination of
income,
spending,
saving,
tax wrappers,
investments,
property,
and time

gives me the strongest probability
of reaching sustainable financial independence?
```

The primary measure of success is:

> **Probability-adjusted, after-tax, usable lifetime wealth with sufficient liquidity to support the desired FIRE path.**
