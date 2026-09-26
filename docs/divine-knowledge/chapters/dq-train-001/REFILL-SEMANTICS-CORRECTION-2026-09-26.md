# DQ-TRAIN-001E — Point refill semantics correction

Date: 2026-09-26. Owner-authorized bounded pure-planner correction on existing branch `agent/training-refill-semantics-correction-001e`, draft PR #125. Starting head: `833243cb7b43d7ba41b39f922973140c5908c562`; verified main baseline: `37fe611cfeb58bf812272eef18c5d69eb9952d01`. The branch remains unmerged and unreleased.

## Superseded assertion

The historical `REFILL_CAP_001` strategy case and finding 6 in [PR #123 verification](VERIFICATION-CORRECTION-2026-09-25.md) incorrectly added a 150E Point refill to 900E (or to an 850E post-Xanax stack). The [owner's handoff](WORK-TRANSFER-HANDOFF-REFILL-CORRECTION-2026-09-26.md) explicitly authorizes superseding only this erroneous frozen-fixture meaning. `REFILL_CAP_001` now records `status: superseded`, names the correction and points to executable `REFILL_TO_NATURAL_MAX_001E` and `REFILL_ABOVE_NATURAL_MAX_001E`. Other math, ranking, and strategy fixture meanings remain intact.

## Corrected planner contract

- Point refill **fills** Energy to `naturalEnergyMax`; below that maximum, `energyObtained = naturalEnergyMax - energyBefore`. A refill at 50E with natural maximum 150E yields 150E and obtains 100E. At 900E, natural maximum 150E, no pre-training refill candidate is generated.
- No `XANAX_REFILL` pre-stack candidate is generated. A Point refill does not raise a 600E → 850E Xanax stack to 1000E.
- The finite 1,150E Happy Jump route is `1000E preparation → Happy preparation → Ecstasy → TRAIN 100×10E → USE_REFILL → VERIFY_STATE → TRAIN 15×10E`. The second phase starts at the **modeled final stat and Happy** of the first phase. The checkpoint explicitly expects the refilled 150E, intervening stat and Happy. Both training actions are advisory.
- One refill consumes its normalized `pointsRequired` exactly once. An explicit nonnegative `pointValue` prices that amount exactly once; unknown value leaves economic value unknown. Unknown point quantity, unavailable refill, insufficient known points, or missing/stale normalized refill/point freshness cannot produce `READY` execution guidance. The pure planner never fetches or refreshes state.
- A second phase crossing the frozen 50m start-stat boundary remains partial and ineligible for full-outcome ranking. The frozen 001A `model.status` value `candidate_not_live_calibrated` is unchanged; planner confidence remains distinct.

## Reproduction and checks

Six focused regression tests were written and run on the starting implementation before the fix; **all six failed**. R1 produced 200E instead of 150E; R2 and R3 emitted invalid pre-training refill candidates; R4 lacked the sequential second training phase; R5's allowed route had no post-training refill; R6 lacked the expected fail-closed rejection. After correction all six pass, together with the two executable replacement fixture cases and a further 50m boundary check.

| Case | Expected outcome after correction |
| --- | --- |
| R1 direct refill at 50E | 150E total; 100E obtained |
| R2 already 900E | No direct pre-training refill |
| R3 Xanax stack | No combined Xanax + refill pre-stack candidate |
| R4 1,150E Happy Jump | Two training phases, continuous stat/Happy mutation, one refill and one point charge |
| R5 refill unavailable | No post-training refill; insufficient or stale points block readiness |
| R6 unknown point quantity/value | Missing quantity rejected; missing value excluded from economic ranking |

`node --check src/training-advisor-pure.js` and `node --check tests/training-advisor-pure.test.js` pass. `node --test tests/training-advisor-pure.test.js`: **89/89 pass**. `node --test tests/*.test.js`: **326/326 pass**. The complete `main...HEAD` diff and `git diff --check main...HEAD` were inspected after committing; no userscript/runtime file changed.

## Limits and next gate

Source adapters must supply actual refill eligibility, live points and refill freshness, material player state, and a fresh observation at the post-refill checkpoint. No live Torn or TornPDA integration was performed. Above-50m outcomes remain unranked; timing and economic inputs are not invented. This correction adds no API, DOM, UI, network, persistent storage, listeners, timers, or gameplay actions.

Rollback: revert the correction commit on this existing feature branch. That would restore the superseded additive fixture, so review the fixture correction before applying any rollback. Independent **[V] re-verification** of draft PR #125 is the next gate. Merge, release, and branch deletion have not been authorized.
