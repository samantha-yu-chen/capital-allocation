# Property model and API — chunk 5

`property.ts` supplies `mortgageYear`, `purchaseTax`, `propertyYear` and `leverage`.
`runProjection` integrates the result into the existing event order. The market path's property
return acts on post-transaction property value. Money inputs are real; fixed mortgage balances and
payments remain nominal. Monthly amortisation is summed inside each annual interval, with a
remaining-term recast on a configured refinance age. Interest-only principal is due in the final
interval. Unpaid interest is capitalised, unpaid principal stays outstanding, and a
`mortgage_shortfall` failure persists even if wealth later recovers.

A non-null purchase means future acquisition: existing value/debt are ignored until purchase.
The configured price, deposit, legal costs and purchase tax inflate to the purchase age. The deposit
and costs use the fixed withdrawal order and its tax gross-up. A purchase that cannot fund the
full year's obligations is cancelled atomically: no house, mortgage or deposit expense is created,
and the year retains an `unfunded_essential_spending` failure identifying the failed commitment.
Living costs, property operating costs, interest, principal, sale debt deficit and known capital
needs are funded in that order. This refines obligations inside the existing spending/withdrawal
step; the top-level event order is unchanged. Required costs remain fixed; funding shortfalls are
failures, never spending-policy cuts.

A scheduled sale occurs before that year's operating cash flows and return. Net proceeds repay the
mortgage and enter settlement cash. Negative equity must be funded; an unpaid residual remains
mortgage debt. Sales are the only equity-release action. No automatic sale, refinance cash-out,
bridge funding from equity, or forced liquidation is assumed.

`currentRentMonthlyIncluded` identifies the rent component of all supplied spending schedules,
including retirement, floor/comfort, overrides and phases. During owner occupation it is removed
once, up to that year's total (essentials first). The supplied spending total resumes on sale.
Rental property never removes personal rent. Users must enter the other household budget without
the mortgage, maintenance, insurance, service charge and council tax entered in the property form.
The owner-paid council tax input should be zero if the tenant pays it. Recurring property costs
inflate; gross rent is occupancy-adjusted and management fees apply to collected rent.

## Tax configuration and sources

Frozen 2026/27 structure, `residential-2026-27-v1`, verified 14 September 2026. Like the inherited
income-tax policy, purchase thresholds retain constant real values; this is not a legislative
forecast. Property location is separate from income-tax residence. Optional additions to the
schema-1 property contract preserve existing profiles:

- `taxLocation`: Scotland, England/Northern Ireland, or manual (Wales/special cases). Omitted
  means Scotland for Scottish income-tax residence, otherwise England/NI.
- `buyerStatus`: standard (default), eligible first-time owner occupier, or additional dwelling.
- `purchaseTaxOverride`: explicit real purchase tax for manual cases, additional to legal costs.
- `acquisitionCostBasis`: historical nominal allowable cost for an existing rental. Required if
  selling that rental. Planned purchases record price, purchase tax and transaction costs as basis.

[HMRC SDLT residential schedules](https://www.gov.uk/stamp-duty-land-tax/residential-property-rates)
support standard and eligible first-time rates. Additional dwellings use the 5% surcharge from
£40,000. [Scottish 2026/27 LBTT schedules](https://www.gov.scot/publications/scottish-budget-2026-2027/pages/4/)
and [Revenue Scotland ADS](https://revenue.scot/taxes/land-buildings-transaction-tax/additional-dwelling-supplement-ads)
supply LBTT bands, the £175,000 first-time nil band and 8% ADS from £40,000.
Eligibility is explicitly selected; refunds, linked transactions, new-lease rent premiums,
nonresident surcharges and corporate ownership require a manual amount and are not inferred.

Rental operating profit enters the same annual non-savings income assessment as other income.
Operating losses carry within this property business. Residential finance costs are not deducted
from profit: [HMRC's finance-cost restriction](https://www.gov.uk/guidance/changes-to-tax-relief-for-residential-landlords-how-its-worked-out-including-case-studies)
is applied as 20% of the lowest of eligible finance costs, property profit after losses, and
adjusted income excluding savings/dividends above the personal allowance, capped by income tax.
Unused restricted costs carry forward. Owner-occupied sales assume full private residence relief;
rental gains/losses join GIA gains/losses in the existing 18%/24% CGT calculation and share one
annual exemption and loss pool. No automatic deduction for mortgage principal. Existing relief
history, prior rental losses/finance-cost carry, mixed use and changes of use are outside this
single-use model. Future announced tax changes are not enacted into the constant-real policy.

## Accounting and comparisons

All original per-account identities are unchanged. In addition:

```
financial closing = financial opening + active income + pension added - personal pension cash
  - total tax - funded living/known capital costs - funded property operations
  - funded interest - principal paid + property transaction cash flow + financial returns
net-worth change = active income + pension added - personal pension cash - tax
  - funded living/known capital costs - funded operations - accrued mortgage interest
  - acquisition costs - selling costs + financial returns + property appreciation
```

`LedgerYearDetail` adds required/funded housing flows, rental relief/carry, transaction costs,
appreciation and taxable disposal audit fields. Base `LedgerYear` fields are populated. CGT audit
allowance/loss totals now describe the combined GIA/property assessment; per-asset realised gains
remain separately available. The engine version includes the property-tax version.

`comparePropertyPlans` / `comparePropertyPlansBrowser` run full plans on the exact same generated
path object per pair. The alternative retains the buyer's opening financial assets and spending
schedule. `LedgerOptions.rentInvestment` is an explicit optional action (resolved default null):
at purchase age invest up to the avoided deposit and transaction costs from available cash,
respecting the reserve, then unused ISA allowance and GIA. Existing investments stay invested;
there is no deposit credit. The comparison returns terminal wealth distributions, FIRE success,
liquidity, full-horizon net-worth drawdown and debt exposure. It requires a planned purchase;
an existing owner has no unspent deposit. Worker cancellation terminates computation; edits
invalidate results. Count, seed, profile, resolved options and versions are recorded.
