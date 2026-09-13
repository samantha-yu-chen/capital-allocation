# Tax configuration and supported calculation cases

Verified 13 September 2026. Effective tax year: 6 April 2026–5 April 2027. Configuration IDs: `uk-2026-27-scotland-v1` and `uk-2026-27-rest_of_uk-v1`.

## Source register

| Area | Implemented rule | Official source |
| --- | --- | --- |
| Income bands / NI | Annual Class 1 A/C; Scotland non-savings bands and rest-of-UK rates; separate employer NI | [HMRC 2026/27 rates](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027) |
| Personal allowance | £12,570; reduced £1 per £2 adjusted net income above £100,000 | [HMRC income tax](https://www.gov.uk/income-tax-rates) |
| Scottish scope | Scottish rates apply to non-savings/non-dividend income, UK rates to savings/dividends | [Scottish income tax](https://www.gov.uk/scottish-income-tax) |
| Dividends | £500 nil-rate band; 10.75%, 35.75%, 39.35% | [HMRC dividends](https://www.gov.uk/tax-on-dividends) |
| Savings | £5,000 starting-rate band reduced by taxable non-savings income; £1,000/£500/£0 personal savings allowance | [HMRC savings interest](https://www.gov.uk/apply-tax-free-interest-on-savings) |
| PA allocation | Minimise tax over allocation to non-savings, savings and dividends; dividends stay the top slice | [HMRC allocation principle](https://www.gov.uk/government/publications/dividend-allowance-factsheet/dividend-allowance-factsheet) (historical numerical rates not reused) |
| RAS | Gross contribution extends basic and subsequent bands, restores PA through adjusted net income; provider adds basic-rate relief; Scottish starter rate does not require repayment | [HMRC pension relief](https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief) |
| Calculation mechanics | Income stacking, nil-rate band occupancy and Scottish basic-band extension | [SA110 2025/26 notes](https://assets.publishing.service.gov.uk/media/69c4fc274a06660f0854422a/SA110-Notes-2026.pdf), pages 3, 13–14; mechanics only, rates taken from 2026/27 sources |
| Salary sacrifice | Pension sacrifice reduces taxable and NI-able employment pay; retained earnings must satisfy minimum wage | [HMRC salary sacrifice](https://www.gov.uk/guidance/salary-sacrifice-and-the-effects-on-paye) |
| Pension limits | £60,000 annual allowance, £10,000 MPAA, £3,600 RAS gross minimum; standard lump-sum allowance £268,275 | [HMRC pension scheme rates](https://www.gov.uk/government/publications/rates-and-allowances-pension-schemes/pension-schemes-rates) |
| Pension taper | Both £200,000 threshold and £260,000 adjusted-income tests; taper £1 per £2, minimum £10,000; employer contributions and relevant sacrifice treatment | [HMRC tapered allowance](https://www.gov.uk/guidance/pension-schemes-work-out-your-tapered-annual-allowance) |
| Member relief | Relevant-earnings limit; relief ceases at 75; low-earner minimum requires RAS | [HMRC PTM044100](https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm044100) |
| Withdrawal split | UFPLS-style tax-free/taxable split subject to remaining lump-sum allowance | [HMRC PTM061200](https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm061200) |
| ISA | £20,000 annual subscription capacity; no wrapper income/gains tax | [HMRC ISA rules](https://www.gov.uk/individual-savings-accounts/how-isas-work) |
| CGT | £3,000 annual exemption; ordinary investment gains at 18%/24%, using remaining UK basic band | [HMRC CGT rates and worked examples](https://www.gov.uk/capital-gains-tax/rates) |
| Losses | Current-year losses first; brought-forward losses used only above exemption | [HMRC capital losses](https://www.gov.uk/capital-gains-tax/losses) |

Band `upper` values in code are cumulative TAXABLE-income limits. They are not gross salaries. `null` means unbounded and survives JSON serialization. In particular, the upper taxable higher/advanced boundary remains £125,140, not £112,570, because PA is fully tapered away at the additional/top boundary.

## Calculation conventions

The functions calculate final annual tax liabilities, not PAYE withholding, tax codes or monthly NIC rounding. They retain floating-point precision; presentation rounds to pence. The annual NI approximation is explicit and may differ from irregular-pay payslips.

Pension methods are separate:

- Salary sacrifice reduces employment income and NI earnings; it is legally employer pension funding. Employer match/base/shareback are added once. A supplied pensionable-pay basis determines contributions and matching.
- Net pay deducts gross member contributions for income tax but not NI.
- Relief at source uses a gross contribution input: personal cash pays 80%, the provider supplies 20%. Income tax is computed using extended bands and restored personal allowance, assuming any additional relief is claimed in the same model year. RAS gross is not also deducted from taxable income.

`calculateIncomeTax` assumes its RAS input is already eligible. `calculateNetIncome` validates eligibility and pension allowances. Never feed pre-contribution salary into the tax primitive and also deduct contributions again after calling the net-income API.

Savings/dividend nil-rate allowances do not remove income from band occupancy, adjusted net income or CGT capacity. The PA allocator enumerates vertices of a piecewise-linear allocation problem to minimise total income tax. It includes boundaries for income bands, savings starting rate, PSA and dividend allowance; it does not use a coarse monetary grid.

`calculateCapitalGainsTax` expects annual totals of actual realised gains and losses, not annual appreciation. `realiseGiaDisposal` apportions an aggregate pool's cost basis and reports gain or loss without taxing it. The later ledger must aggregate dividends, disposals and tax once per year and preserve unrealised gains and carried losses.

## Explicit support boundaries

- UK-resident individual; Scotland or England/Wales/Northern Ireland; ordinary employment and defined-contribution pensions; supplied non-savings income is already a taxable amount. No self-employment NICs, student loans, benefits/child-benefit charges, marriage/blind allowances, Gift Aid, foreign relief, special tax codes or investment relief schemes.
- Only 2026/27 is loaded. Unsupported tax years fail. `scaleTaxConfig` is an explicit constant-real forecast assumption, not future legislation. New laws require a new config/version and tests.
- Annual pension excess is assessed but the tax charge is not modelled: `calculateNetIncome` throws `PensionLimitError('annual_allowance')`. Optimisers must mark such candidates infeasible or implement explicit charge modelling later. It does not silently cap pension contributions.
- Carry-forward is an explicit amount already verified eligible by the caller. Historical scheme membership and previous-year eligibility are not inferred. MPAA support assumes all modelled pension savings are defined contribution and the restriction applies for the model year; mid-year triggering and defined-benefit alternative allowances are outside this primitive.
- Member contributions at/above 75 are rejected. Employer contributions may continue. Eligibility for low-earner net-pay top-up is flagged as `deferredNetPayTopUpNotModelled`; its later-year HMRC receipt is not included in cash. This is a known limitation for low-income net-pay scenarios.
- Pensionable pay is explicit so employer-specific bonus, notional-pay and qualifying-earnings arrangements can be supplied. The example adapter uses salary excluding bonus. The minimum retained salary floor is caller-supplied; working hours/minimum-wage eligibility are not inferred.
- No automatic flexible ISA replacement subscriptions, LISA bonus or withdrawal penalty. Assess subscription headroom and overflow explicitly.
- GIA aggregate-pool disposal is a planning approximation. Actual security-level same-day/30-day matching, transactions across holdings, deemed disposals and tax-return preparation are not supported. Current-year losses are assumed allowable and carried losses claimed.
- The pension withdrawal split is a primitive, not an access check or a complete drawdown policy. The ledger must enforce age, remaining balance, remaining lifetime lump-sum allowance and taxable pension income. Protected lump sums and prior crystallisation details require separate support.
- Property tax, interest relief, property purchase taxes and mortgage modelling belong to chunk 5. Do not pass gross rent as if all of it were taxable profit.

## Independent reference cases

Tests pin cumulative salary-band calculations, both sides of key boundaries, the taper's effective marginal rates, all three contribution methods, RAS at Scottish starter/intermediate rates, employer NI thresholds, carry-forward/MPAA, and source examples for dividend/CGT tax.

For the example salary with 5% salary sacrifice and 5% employer contribution in Scotland, tax is £9,927.05, employee NI £3,055.60, net annual income £39,267.35 and pension funding £5,500. These are calculated annual-model outputs, not a forecast payslip. The £19,800 spending input leaves £19,467.35 before allocation.
