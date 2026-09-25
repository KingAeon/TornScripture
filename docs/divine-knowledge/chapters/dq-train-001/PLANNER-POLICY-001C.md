# DQ-TRAIN-001C — Planner Ranking Policy

Status: **DRAFT POLICY FOR OWNER FREEZE; NO PRODUCT IMPLEMENTATION AUTHORIZED**

Opened: 2026-09-25.
Parent: `TRAINING-ADVISOR-SPEC-001C.md`.
Normative fixture draft: `PLANNER-POLICY-FIXTURES-001C.json`.

## 1. Purpose

Define deterministic v0.1 ranking semantics above the Training Math Engine so the same normalized candidate set produces the same recommendation independent of UI, locale, insertion order, network state, or implementation language.

This policy deliberately avoids opaque weighted scoring where a more direct rule exists.

## 2. Candidate prerequisites

Before objective ranking, a candidate MUST:

1. be structurally valid;
2. satisfy all hard player constraints;
3. have sufficient normalized state for every mechanic it uses;
4. avoid `UNSUPPORTED` mechanics;
5. comply with the active confidence/risk policy;
6. have a simulated outcome or an explicit non-gain state such as wait/replan;
7. expose all material resource burdens used by the selected objective.

Invalid candidates never receive a compensating score.

## 3. Confidence/risk policy

Planner preference `riskPolicy` is one of:

- `CALIBRATED_ONLY`
- `ALLOW_SUPPORTED`
- `ALLOW_EXPERIMENTAL`

Eligibility:

| riskPolicy | CALIBRATED | SUPPORTED_EXTRAPOLATION | EXPERIMENTAL | UNSUPPORTED |
|---|---:|---:|---:|---:|
| CALIBRATED_ONLY | yes | no | no | no |
| ALLOW_SUPPORTED | yes | yes | no | no |
| ALLOW_EXPERIMENTAL | yes | yes | yes | no |

Within an allowed set, confidence is a deterministic tie-breaker in this order:

`CALIBRATED > SUPPORTED_EXTRAPOLATION > EXPERIMENTAL`.

No hidden percentage tolerance is used to decide when lower-confidence gain is "worth it." The player controls that boundary through `riskPolicy`.

## 4. Economic value

For ranking purposes:

```text
economicValueConsumed =
    newCashRequired
  + marketValueOfOwnedItemsConsumed
  + pricedPointValueConsumed
```

Purchased items are represented by `newCashRequired`, not counted again as owned replacement value.

Owned items have zero immediate cash requirement but nonzero economic value.

If a candidate consumes points and no point valuation is available:

- gain-only objectives MAY still use the candidate;
- price/value objectives MUST either treat points as a separate explicit hard resource or declare economics unavailable for that comparison;
- no fabricated point price is allowed.

## 5. Useful-session reference

v0.1 MUST NOT use an arbitrary percentage of the maximum candidate gain as its default "useful" threshold.

Instead define:

```text
referenceSessionGain =
  projected gain from one ordinary natural full Energy bar
  trained under the current supported state/gym/modifiers,
  with no purchased Happy preparation.
```

Examples:

- donator natural maximum 150E -> ordinary 150E modeled session;
- non-donator natural maximum 100E -> ordinary 100E modeled session.

If the reference session itself cannot be modeled, objectives that require a usefulness floor MUST report that requirement unavailable rather than invent a threshold.

A candidate is `useful` when:

```text
candidate.expectedGain >= referenceSessionGain
```

This threshold is used by `BEST_VALUE`, `USE_MY_INVENTORY`, and `FASTEST_USEFUL`.

## 6. Pareto dominance

After simulation, valid candidates are Pareto-pruned before Balanced ranking.

Candidate A dominates B when A is no worse than B in every active frontier dimension and strictly better in at least one.

v0.1 frontier dimensions:

Maximize:

- expected gain;
- confidence rank.

Minimize:

- economic value consumed;
- time to completion;
- natural Energy lost;
- points consumed.

A dimension with identical values across all compared candidates is inert.

Drug/booster cooldown commitment remains exposed economics in v0.1 but is not an independent Pareto axis unless later fixtures prove it changes decisions materially.

## 7. Normalization

Balanced uses min-max normalization only after hard constraints, confidence eligibility, invalid-candidate removal, and Pareto pruning.

For a benefit dimension:

```text
normBenefit(x) = (x - min) / (max - min)
```

For a burden dimension, normalization produces 0 for the least burden and 1 for the greatest:

```text
normBurden(x) = (x - min) / (max - min)
```

If `max == min`, normalized value is 0 for that inert dimension.

Normalization is local to the surviving frontier for the current decision.

## 8. Balanced knee rule

Balanced MUST NOT use a hidden weighted sum.

For every surviving frontier candidate:

```text
gainUtility = normalized expected gain

burden = MAX(
  normalized economic value consumed,
  normalized time to completion,
  normalized natural Energy lost,
  normalized points consumed
)

kneeScore = gainUtility - burden
```

Select the candidate with the greatest `kneeScore`.

This is a Chebyshev-style burden rule: a candidate cannot hide one extreme burden behind several cheap dimensions.

Deterministic ties resolve by:

1. higher confidence;
2. higher expected gain;
3. lower economic value consumed;
4. shorter time to completion;
5. lower natural Energy lost;
6. fewer points consumed;
7. lexicographically smaller stable plan fingerprint.

The geometric rule intentionally makes frontier shape determine the knee rather than a fixed "cost is worth 30%" style coefficient.

## 9. Maximum Gain

`MAXIMUM_GAIN` ranks eligible candidates by:

1. highest expected gain;
2. higher confidence;
3. lower economic value consumed;
4. shorter time to completion;
5. stable fingerprint.

No cost penalty is applied before the gain comparison unless cost is a hard constraint.

## 10. Budget Cap

`BUDGET_CAP` first filters:

```text
newCashRequired <= configuredBudget
```

The budget is immediate/new cash spend unless the user explicitly selects an economic-value cap instead.

Then rank:

1. highest expected gain;
2. higher confidence;
3. lower new cash required;
4. lower economic value consumed;
5. shorter time to completion;
6. stable fingerprint.

## 11. Use My Inventory

`USE_MY_INVENTORY` considers only useful candidates.

Rank:

1. lowest new cash required;
2. highest expected gain;
3. higher confidence;
4. lower total economic value consumed;
5. shorter time to completion;
6. stable fingerprint.

This deliberately allows an owned-item plan to beat a slightly stronger purchase-heavy plan while still exposing the owned inventory's replacement value.

## 12. Fastest Useful Plan

`FASTEST_USEFUL` considers only useful candidates.

Rank:

1. shortest time to completion;
2. highest expected gain;
3. higher confidence;
4. lower economic value consumed;
5. stable fingerprint.

Meaningful wait checkpoints are generated upstream. This ranking never asks the generator to enumerate arbitrary minute-by-minute delays.

## 13. Best Value

Best Value evaluates incremental improvement over the strongest no-economic-sacrifice baseline.

Define:

```text
baseline =
  highest-gain eligible candidate with economicValueConsumed == 0
```

If no such candidate exists, baseline gain and economic value are zero.

For each useful candidate with:

```text
deltaGain = candidate.expectedGain - baseline.expectedGain
deltaEconomic = candidate.economicValueConsumed - baseline.economicValueConsumed
```

A paid improvement is value-rankable only when:

```text
deltaGain > 0
deltaEconomic > 0
```

Then:

```text
incrementalValue = deltaGain / deltaEconomic
```

Select the highest `incrementalValue`.

Ties resolve by:

1. higher total expected gain;
2. higher confidence;
3. lower economic value consumed;
4. shorter completion time;
5. stable fingerprint.

If no paid useful candidate improves on baseline, return the baseline as the Best Value recommendation and explain that no purchase improves it efficiently enough to enter the value comparison.

This prevents "free current Energy" from creating an infinite ratio while still respecting it as the comparison baseline.

## 14. Wait as a valid plan

`WAIT` is a valid candidate action when it leads to a meaningful future checkpoint.

A wait candidate may win if the resulting plan survives the selected objective and constraints.

Balanced compares waiting by its actual `timeToCompletion` burden.

Fastest Useful naturally rejects excessive waiting when an earlier useful plan exists.

Maximum Gain may choose a long wait if it produces the largest supported gain and the player's hard `maxWait` permits it.

## 15. Plan stability and price refresh

Plan structural fingerprint excludes:

- mutable market prices;
- predicted gain decimals;
- source timestamps;
- UI labels.

It includes:

- ordered meaningful action types;
- consumable IDs and quantities;
- target/stat-allocation mode;
- Energy-preparation structure;
- resource-policy choices that alter the strategy.

A market refresh that changes only economics MUST NOT create a new structural plan identity.

After refresh:

- economics may update;
- ranking may re-run;
- recommendation is "unchanged" when the winning fingerprint is unchanged;
- no arbitrary percentage threshold is required.

A price update is materially decision-changing only when it changes candidate validity, winner fingerprint, hard-constraint compliance, or a material explanation.

## 16. Readiness does not equal ranking

The best plan may be `WAITING`, `NEEDS_ITEMS`, or `NEEDS_REFRESH`.

Ranking chooses the strategy.

Readiness tells the player whether its next consequential step is currently safe/possible.

An unsafe quarter-hour window does not necessarily make the strategy inferior; it makes immediate execution `BLOCKED` with `TIMING_UNSAFE`.

## 17. Partial modeled plans

A plan that reaches a model boundary may preserve the supported prefix.

For pre-50m model boundaries:

- an internal train that starts within domain may be modeled;
- once the next train would start outside domain, simulation stops;
- the plan records modeled train count, modeled gain, remaining Energy, and `MODEL_OUT_OF_DOMAIN`;
- unsupported remainder is never fabricated.

Such a candidate cannot compete as a fully predicted total-gain plan unless the selected objective explicitly supports partial-result comparison.

v0.1 default ranking excludes partial plans from full-outcome objectives and presents them as boundary diagnostics/alternatives.

## 18. Abstention

Return `NO_SAFE_RECOMMENDATION` when:

- no candidate survives hard constraints and confidence policy;
- material gain inputs are unsupported or unavailable;
- the selected objective requires economics but economics cannot be established for any meaningful candidate;
- model boundaries prevent defensible comparison of the relevant strategies.

Abstention must include stable reason codes and the smallest actionable request needed to restore capability.

## 19. Determinism

For identical normalized candidate summaries and policy inputs, ranking MUST be independent of:

- candidate insertion order;
- object property order;
- locale;
- wall clock;
- network state;
- UI mode.

Final fingerprint tie-break guarantees stable ordering.

## 20. Fixture rule

`PLANNER-POLICY-FIXTURES-001C.json` is the normative draft for these policy decisions.

The policy is eligible for FROZEN status when:

1. every fixture's expected result is owner-accepted;
2. independent calculation reproduces each ranking;
3. no fixture requires hidden implementation-only information;
4. changing a ranking-semantic rule requires fixture updates and explicit owner review.

No product build is authorized by freezing this policy alone.
