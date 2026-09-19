# How this model works

A plain-language walkthrough for someone who is not a finance person. It explains the *method* — no
figure in here is a result, and none of it is advice.

The same walkthrough is in the app itself, behind **How this works** in the sidebar
(`src/presentation/view/learn.ts` holds the text; `src/presentation/web/learn-panel.tsx` renders
it). Where a claim below is a rule the code enforces, the source file is named, so you can check it
rather than take it on trust.

---

## 1. One year at a time

The model never guesses at a lifetime in one step. It walks forward one year at a time, and every
year is the same five steps: you earn, you are taxed, you spend, whatever is left is invested, and
then the markets move.

**Inside a year the order is fixed: opening balances, then income, tax and contributions, then
spending and withdrawals, then that year’s market return, then closing balances.**
(`docs/architecture-decisions.md`, ADR 002; implemented in `src/engine/ledger.ts`.)

That order is the load-bearing part. Because spending is settled *before* the year's return is
applied, a year in which the money ran out stays a year in which the money ran out. **If a year
cannot be funded, that failure is recorded, and a good market later in the same path cannot erase
it.** A model that let a December rally pay January's bills would report plans as safe that are not.

**A projected year runs from one birthday to the next: year t covers the year from age t to age
t + 1.** The first point on any wealth chart is what you hold today, at your current age; every
point after it is a closing balance at the end of a year. The plan simulates `endAge - currentAge`
years, and the end age is the boundary after the last funded year rather than one more year of
spending (ADR 002).

Money leaves your accounts in the order recorded in your profile — cash, ordinary investment
account, ISA, pension, each appearing exactly once — rather than in whichever order happens to
flatter the result (`src/domain/contracts.ts`, `simulation.withdrawalOrder`). The pension cannot be
drawn at all before the pension access age, so if you retire before it, the years in between have to
be funded from everything else. That gap is called the bridge, and it is where a surprising number
of otherwise sound plans fail.

## 2. Tax, and what a pension contribution really costs

Tax is not estimated once and scaled. It is calculated every projected year from the published
rules for the tax year in your profile, separately for Scotland and the rest of the UK
(`src/config/tax/`, `src/domain/tax/`, documented in `docs/tax-rules-2026-27.md`).

Those rules are then held constant **in real terms** for the whole projection: bands, allowances and
thresholds move with cumulative inflation and never otherwise change (ADR 002, the `constant_real`
tax policy). Real tax law will change over a lifetime and that risk is not modelled. The app says so
on every screen rather than burying it here.

A pension contribution is worth more than it costs you, and the app refuses to lump the difference
into one number, because the three available numbers answer different questions
(`src/presentation/view/pension-relief.ts`):

- **Tax relief** — income tax only. The figure people mean when they say "40% relief".
- **Tax and National Insurance you no longer pay** — adds the employee NI a salary sacrifice
  avoids, so it is strictly larger whenever sacrifice is in use.
- **What it actually costs you** — the drop in your take-home pay, and the only one of the three you
  can check against a payslip.

Contributions are constrained, not merely counted. A contribution above the pension allowance
available to you is reported as **unsupported**, naming the limit that stopped it, rather than being
quietly trimmed to fit and priced as something you did not describe (`AGENTS.md`, "Honest failure";
`PensionLimitError`).

## 3. From one projection to many

Running the plan once with average returns every year tells you whether the arithmetic works. It
cannot tell you whether the plan is *safe*, because no real lifetime receives the average every
year. The order in which good and bad years arrive matters enormously when you are drawing money
out — which is why a single smooth projection is the beginning of the analysis, not the end.

So the app runs the same plan thousands of times over generated market histories. The returns are
drawn from the average returns, volatilities and correlations in your own profile: growth is
lognormal, calibrated to arithmetic annual means and standard deviations, and the correlation matrix
describes the shocks underneath (ADR 004, `src/engine/returns.ts`).

Each of those runs is a complete lifetime ledger — the same five steps, the same tax rules, the same
withdrawal order — differing only in the market returns it meets. A run counts as a **success** if
every year of it was funded. The success probability is simply the share of runs that succeeded
(`src/engine/monte-carlo/simulation.ts`).

Two things about how the randomness is organised matter to you as a reader:

- **It is reproducible.** Each path's random numbers come from your seed and that path's absolute
  position in the list, and from nothing else — not from how the work was scheduled, and not from
  any decision inside the scenario (ADR 004). Run it twice, get the same answer.
- **Comparisons are fair by construction.** When the app compares two plans, it reuses matching
  seeds and matching path positions, and asserts that it did rather than trusting it (`AGENTS.md`,
  "Common paths"). A difference you see is a difference between the plans, not between the market
  histories they happened to be handed.

Runs you cancel, and runs that fail, publish nothing at all: no partial probability, no previous
number left standing beside changed inputs (ADR 004; `AGENTS.md`, "Honest failure"). If a figure is
on screen, a complete run produced it from the inputs currently on the form.

## 4. Reading the numbers without over-reading them

Two verdict-shaped numbers are visible in this app, and only one of them arbitrates.

**The success probability is the number your target is judged against.** The reference FIRE number
beside it — your retirement spending divided by the reference withdrawal rate — is a landmark and a
piece of arithmetic (`src/presentation/view/two-numbers.ts`, `src/engine/fire-curve.ts`). It is
useful for orientation and it knows nothing about your tax, your pension access age, or the order in
which returns arrive.

**A probability measured from a sample carries a margin of error, and a difference smaller than that
margin is not a finding.** The app computes that error as `sqrt(p(1 - p) / n)` and writes its
probabilities with the uncertainty attached (`src/engine/fire-curve.ts`;  `AGENTS.md`,
"Uncertainty"). Two plans a percentage point apart over ten thousand paths have not been shown to
differ — the honest reading is "too close to call", and the fix, if you need to call it, is more
paths rather than a firmer tone.

**The ledger works in the money of the day, and every figure the app shows you has been converted
back into today’s money, so you never see the same inflation applied twice.** The accounting
underneath has to run in nominal terms, because that is the only way to apply a tax band correctly;
the conversion back happens once, at the boundary between the engine and the screen (ADR 002;
`AGENTS.md`, "Money and units"). Profile amounts you type are today's money too.

A percentile band on a chart is not a forecast and not a range of likely outcomes for you. It says
that, of the runs this app performed, that share ended at or below that line. Half of the runs end
below the median, and the runs at the bottom are the ones worth planning against.

The confidence labels — Fragile, Moderate, Strong, High confidence, Very conservative — are labels
on a probability, not targets (`src/presentation/view/monte-carlo-model.ts`). Your target is the one
you set in your own profile.

## 5. What each screen asks

All eight destinations ask one question each of the same model, and stay reachable at all times
(`src/presentation/view/tabs.ts`):

| Screen | The question it answers |
| --- | --- |
| Overview | Where do I stand today, and what does this year look like? |
| FIRE & Monte Carlo | Across many possible market histories, how often does this plan work? |
| FIRE Age Curve | How much does waiting a year actually buy me? |
| Marginal Allocation | If I had one more pound to save, where would it do the most good? |
| Reverse Solver | What would have to change for this plan to hit my target? |
| Scenario Comparison | How do my alternatives compare, on the same terms? |
| Property & Leverage | Does buying, owning or renting leave me better off in this plan? |
| Where It Comes From | Which assumption is my result actually resting on? |

Two of them have a trap worth naming in advance.

**Marginal Allocation** answers for the *next increment*, not for you in general. It accounts for an
employer match, your marginal rate, a withdrawn personal allowance and the annual allowance, so the
ordering can be surprising — and it changes the moment a limit is reached
(`src/engine/marginal.ts`, ADR 006).

**Property & Leverage** keeps the house inside the same ledger: the purchase costs cash and stamp
duty on the day, the mortgage is amortised and charged annually, and the property appreciates after
the year's flows (ADR 005, `docs/property-model.md`). Property equity is never sold automatically to
fund a year, so a plan that fails while sitting on a large house has genuinely failed on the terms
you set. The rent-versus-buy comparison runs over matching paths with rent invested; outside that
comparison the assumption is switched off entirely, so it can never quietly flatter a plan elsewhere
(`AGENTS.md`, "Common paths").

## 6. What this model deliberately does not do

**This app explains and simulates. It does not advise, and it does not predict.** Nothing on any
screen is a recommendation. Where the app orders things, it is reporting what its own model measured
on the assumptions you entered (`docs/ux-improvement-plan.md`, Part D).

**The model never cuts your spending for you part-way through a run: the floor, target and comfort
levels are three separate runs, not one run that adapts.** Real people do cut back when a bad decade
arrives, and that flexibility is worth a great deal — which is exactly why modelling it
automatically would make almost every plan look safe. Instead you choose a level and the app tests
that level honestly; running the floor level is how you ask "what if I had to cut back?"
(`AGENTS.md`, "Fixed spending policy"; `src/engine/spending.ts`).

It models one household and one property, with market assumptions that do not change with age. It
does not model job loss, divorce, care costs, inheritance, a company you own, or a glide path into
bonds as you get older. Anything you want tested has to be expressible in the profile — and the
profile is validated by one authority, `profileSchema` in `src/domain/contracts.ts`, so an input the
model cannot represent is rejected rather than silently approximated.

The starting situations the app offers are illustrations on the same terms: a set of plausible
figures to start editing, not a claim about what someone in that situation has or should do
(`src/presentation/view/starter-picker.ts`).

---

*This document describes the model as built. The product authority is
`docs/lifetime-capital-allocation-fire-optimisation-spec-v0.3.md`; the conventions it must not
contradict are in `AGENTS.md` and `docs/architecture-decisions.md`.*
