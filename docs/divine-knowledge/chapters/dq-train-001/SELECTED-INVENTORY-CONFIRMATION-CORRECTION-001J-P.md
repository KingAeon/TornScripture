# DQ-TRAIN-001J-P — Selected-Plan Inventory Confirmation Correction

Status: **INDEPENDENT EXECUTABLE [V] PASS; PR #133 MERGED AT `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`; PREREQUISITE COMPLETE**

Prepared: 2026-09-30.

Base: `main@7352573be851f4cae590848af830975e905f6890`, the independently verified PR #132 merge. Its implementation head was `a5066c848ebd14c5045817947978646ef9af9578`; DQ-TRAIN-001I is complete/merged.

Branch: `agent/training-selected-inventory-confirmation-001jp`, created from that exact base. Published head and PR are recorded in the draft PR completion report.

## Problem and authority

The attempted DQ-TRAIN-001J specification freeze stopped before edits: the merged adapter accepted current execution inventory only when confirmation covered every one of the 14 registry items. A selected-plan-only confirmation was ignored, including quantities contradicting cached API data. This prevented J-A4/J-C7/J-C8 from being frozen consistently with unchanged canonical code.

The owner separately authorized this bounded correction. It changes inventory normalization and inventory readiness only. It does not freeze or implement the remaining DQ-TRAIN-001J acquisition, packaging, or UI contract.

Independent `[V]` at head `36b535f8df647b5b33948cbef773641ff20c23c0` returned **BLOCKED**: malformed observation timestamps could grant LIVE inventory proof, and bought quantities were charged against confirmed owned inventory. The owner authorized exactly those two amendments on the existing branch/PR. The amended head `7b1b31c60efcd8cbd0c13d32ee1d44fa84b7bcf0` subsequently passed independent executable `[V]` and was merged through PR #133 as `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`.

## Normalized contract

The existing `confirmedInventory` input accepts a subset of registry keys:

```json
{
  "sourceId": "PLAYER_CONFIRMED_INVENTORY",
  "confirmedCurrent": true,
  "observedAt": "2026-09-30T14:00:00Z",
  "freshness": "LIVE",
  "quantities": {"xanax": 1, "eroticDvd": 2, "ecstasy": 1}
}
```

This is synthetic, nonprivate input, not a captured player specimen. Confirmation remains subject to the existing verified source/freshness gate. Inventory confirmation additionally requires a parseable ISO/RFC3339-style timestamp string: `YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:mm)`, with valid calendar date and time/offset components. Empty/non-string/non-parseable values and impossible dates cannot override planning quantities or emit execution proof. The validation applies to both subset and complete inventory confirmation, without changing unrelated `sourceStatus` behavior. Missing observation evidence, noncurrent confirmation, or `FRESH`/`STALE`/`UNKNOWN` confirmation cannot grant execution proof. The pure modules do not read a clock, impose an age/TTL policy, or independently certify recency; callers must honestly establish current evidence and invalidate it after material changes. A recently fetched API response is not equivalent to current player confirmation.

- Only explicitly present, own registry keys with nonnegative safe-integer quantities are accepted. Zero is a confirmed quantity. Unknown keys and invalid quantities cannot override planning data or create execution proof. Valid keys in a mixed input remain independently usable.
- Accepted current confirmation overrides conflicting cached quantities for those keys. It does not copy cached quantities into a confirmation or manufacture missing quantities. The precedence is current player evidence over category-cached planning data, independent of HTTP fetch order.
- `adaptInventory` and `observedState` add `inventoryFreshnessByItem`. Accepted confirmed keys are `LIVE`; unconfirmed API keys retain their planning freshness. Category source/cache/provenance records remain unchanged.
- `fields.inventory.confirmation` records only accepted quantities with `CONFIGURED`, `PLAYER_CONFIRMATION`, source ID, observation timestamp, and `LIVE` freshness.
- Aggregate `inventoryFreshness`, `freshness.inventory`, and `capabilities.inventoryExecution` retain their complete-inventory meaning. Partial confirmation does not promote them. The existing `complete:true` all-registry confirmation still produces aggregate `LIVE` and `inventoryExecution:true`.
- Each normalization starts from its supplied inputs. There is no persisted confirmation, implicit carry-forward, epoch manager, or new storage behavior.

## Selected-plan readiness

`planReadiness` validates the selected plan's `ownedItemsConsumed` and `boughtItems` quantities separately. Only a positive owned share requires current inventory proof. For that owned share, explicit per-item freshness takes precedence over the aggregate class. Legacy fully-LIVE normalized inputs remain supported when an item has no explicit per-item class.

Owned and bought consumption must each be nonnegative safe integers, and their combined consumption must be positive and safe. Confirmed owned inventory must cover only `ownedItemsConsumed[item]`; bought units are not added to that owned-inventory requirement. `LIVE` proof with insufficient owned quantity returns `NEEDS_ITEMS` / `RESOURCE_MISSING`. Missing/invalid owned quantity returns `NEEDS_REFRESH` / `DATA_MISSING`; non-LIVE owned proof remains `NEEDS_REFRESH` under existing stale/missing reasons.

Purchase-dependent plans still require the existing `itemsAvailable:true` acquisition gate. Bought-only resources need no preexisting inventory confirmation, including an absent or explicit zero owned share. A plan consuming one owned and one bought eDVD may satisfy inventory readiness with one confirmed owned eDVD plus valid acquisition availability. One purchased item cannot compensate for insufficient or unconfirmed owned consumption. Item confirmation cannot bypass acquisition, Energy, Happy, gym, gain modifiers, cooldown, booster threshold, refill, or timing gates. A plan consuming no owned items does not acquire an inventory dependency.

Current confirmation changes the next normalized inventory and therefore the next `recommend` invocation. Contradictory quantities require callers to replan; an old plan is also checked against the new quantities rather than its cached resource assumptions. No runtime event handler or automatic replan trigger is introduced here.

## Protected behavior and exclusions

Planner arithmetic, simulation, objective ranking, candidate generation, confidence classification, structural identity, and item mechanics are unchanged. A confirmation supporting the same resource plan preserves modeled gain, economics, confidence, and fingerprint while changing readiness only.

Preserved: `TORN_ENERGY_STACK_CAP_V1=1000`, independent natural maximum, supported +250E Xanax projection and immediate +75 Happy exactly once, no invented future Xanax cooldown, checkpoint/replan stacking, natural-max Point refill, sequential 1,150E route, booster pre-use threshold/legal frontier, ordinary Happy, regeneration, provenance, calibration, and 50m boundary. All frozen 001A–001I JSON fixtures remain unchanged.

No userscript, browser/runtime/UI implementation, generator, dependency installation, package manifest, workflow, network acquisition, storage key/migration, listener, timer, observer, release metadata, private player data, or gameplay action is added.

H1 (`happy.tick_time` reset timing) and H2 (personalized calendar event interval) remain **unresolved live-evidence gates**. Synthetic timing inputs exercise existing proof boundaries; they do not prove H1/H2 or authorize their closure.

## Verification and rollback

Preflight: full checkout, exact local/remote base, clean tree, Git/Node/Python available, and an isolated branch created remotely through the GitHub connector. Direct CLI push lacked write authentication; publication uses connector Git objects with local tested-tree equality and exact parent verification.

Baseline: focused **148/148**, repository **385/385** across 21 suites. Ten of the first eleven J-P checks failed against unchanged baseline source; the noninventory-gate preservation check already passed. The completed suite covers unique J-P1–J-P14: required-only overlay, zero/missing state, invalid proof, full compatibility, selected-plan integration, contradiction/replan, scoped freshness, insufficient quantity, item-proof precedence, bought-resource totals, independent gates, Happy preparation, normalization isolation, and malformed consumption/immutability.

Amendment preflight at the blocked head reproduced **162/162** focused and **399/399** repository passes. Expanded J-P3, J-P5 and corrected J-P10 failed against that head before code changes. They now cover malformed timestamp rejection without cached-quantity overwrite (including complete confirmation), valid UTC/fraction/offset forms, mixed owned/bought readiness, insufficient or unconfirmed owned shares, bought-only acquisition success/failure, and canonical mixed eDVD composition. J-P IDs remain unchanged and unique; final regression results are recorded in the updated draft PR.

Independent executable verification at the amended head reproduced focused **162/162** and repository **399/399** passes across 21 suites, exercised malformed timestamp rejection and owned-versus-bought separation, checked syntax/diffs/NDJSON/frozen fixtures, and confirmed no runtime/UI/browser/userscript/storage/workflow/release scope entered.

No live Torn/TornPDA behavior was exercised. Future runtime work still requires its separate specification, independent verification, owner `[B][WORK]` authorization, and desktop/TornPDA manual gates.

Rollback after merge is to revert PR #133 / merge commit `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`. No durable player data was changed by the correction.

Next: DQ-TRAIN-001J specification freeze resumes from `main@8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`. Runtime implementation remains separately gated and unauthorized until the 001J specification passes independent `[V]` and receives owner `[B][WORK]` authorization.
