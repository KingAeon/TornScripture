# Training Advisor pure planner checkpoint

`src/training-advisor-pure.js` implements the DQ-TRAIN-001A math kernel and the first DQ-TRAIN-001C pure planner slice. It exports CommonJS functions for the repository's Node tests. It is not loaded by a userscript. No browser, Torn API, market request, storage, clock, or gameplay action is present.

## Inputs and entry points

- `simulateTraining(request)` accepts the exact frozen 001A model request. Noise and Happy-loss rolls must be supplied. Its model descriptor retains the frozen arithmetic fixture label `candidate_not_live_calibrated`; planner confidence independently records the later bounded B1–B4 calibration status.
- `simulatePlanTraining({modelId, stat, happy, gym, gainPerks, energy})` provides a deterministic central planning path with explicit zero gain noise and loss roll 5. It stops at the first train that would *start* beyond 50m, preserving the modeled prefix and unspent Energy. This central path is not an EV or confidence interval.
- `generateEnergyCandidates(normalizedState)` enumerates train now, explicit cooldown Xanax checkpoints, natural full-bar wait, and allowed refill states. It reports cap discard and capped natural regeneration loss. It does not invent cooldowns or point requirements.
- `generateHappyFrontier({boosterSlots, items, newCashBudget})` and `generateHappyRecipes(state, itemMechanics, marketSnapshot, preferences)` enumerate owned/bought bundles in stable item-ID order, prune dominated recipes, and preserve cash and replacement value separately. Item effects and purchasable quantities must be explicitly normalized.
- `composePlan(...)` combines Energy and Happy preparation with sequential training, advisory actions, structural identity, economics, confidence, readiness, and a final-booster marginal comparison.
- `rankCandidates(...)` accepts normalized outcome summaries and implements all six frozen objectives and their confidence, useful-session, Pareto, and tie rules. `recommend(...)` composes the stages into the Recommendation contract.
- `resolveObserved`, `replanOnEvent`, and `compareRecommendationIdentity` are pure transition helpers. A caller must normalize fresh observed state and invoke replanning; no background observation exists here.

Normalized state must supply actual numeric stat, Happy, Energy, gym dots and Energy per internal train, supported explicit gain perks, and the chosen stat. Optional cooldowns, inventory, prices, regeneration, and refill mechanics enable their corresponding candidates only. An `activeEffects` entry that affects gym gain must be explicitly supported *and* linked to a matching `gainPerks` ID. Set `calibratedDomain: true` only after an adapter has verified the documented B1–B4 evidence domain; otherwise the planner uses `SUPPORTED_EXTRAPOLATION` and the selected risk policy decides eligibility.

For a delayed plan, `happyAtCheckpoint` must be supplied as an explicit normalized future checkpoint value before any full gain forecast is ranked. The plan still includes `VERIFY_STATE` after the wait; a fresh observation overrides that projection. Immediate boosted plans require a safe quarter-hour window for `READY` status. The planner may rank a `NEEDS_ITEMS`, `NEEDS_REFRESH`, `WAITING`, or `BLOCKED` plan while keeping execution readiness separate.

## Limits of this checkpoint

- The 001A model's live calibration applies only to the documented observed domain. Other supported pre-50m arithmetic is identified as extrapolation. No post-50m outcome is forecast.
- Happy gain from items, cooldowns, prices, availability, point values, and future Happy must be supplied by a future authorized adapter or explicit manual normalization. An unknown resource cost is `null`, not zero. Gain-only modes can still compare supported owned-item paths when replacement value is unknown.
- The Happy recipe engine models integer Happy effects and an explicitly supplied Ecstasy multiplier. Fractional outcomes and unsupported special effects abstain. No overdose odds, success probability, long-horizon projection, or timing of intermediate natural regeneration is invented.
- `BALANCED_STATS` allocation is explicitly unsupported because the frozen specification supplies no train-by-train allocation rule. `WEAKEST_STAT` picks the lowest normalized stat with lexical ties; `TARGET_STAT` uses the selected stat.
- Only meaningful Energy checkpoints are generated; a scheduled Happy preparation after a cooldown requires a normalized future Happy value. Play-window timing and additional gym special mechanics remain outside this slice.
- No user-facing UI or live TornPDA behavior has been exercised. The future adapter and presentation phase requires a separate authorization and manual desktop/TornPDA gate.

## Verification and rollback

Run `node --check src/training-advisor-pure.js`, `node --test tests/training-advisor-pure.test.js`, `node --test tests/*.test.js`, and `git diff --check`. The focused test imports all 14 math cases, 16 math helper cases, 10 policy ranking cases, 9 policy state cases, and 11 strategy cases from frozen JSON, plus end-to-end and fail-closed checks. The fixture file contents are unchanged.

The change is isolated to the pure module, its tests, and this checkpoint. Revert the implementation commit on its feature branch to roll back. No stored data or live userscript version is affected.
