# DQ-TRAIN-001J-P — Selected-Plan Inventory Confirmation Correction

Status: **OWNER-AUTHORIZED [B][WORK] IMPLEMENTED ON ISOLATED BRANCH; INDEPENDENT [V] PENDING**

Prepared: 2026-09-30.

Base: `main@7352573be851f4cae590848af830975e905f6890`, the independently verified PR #132 merge. Its implementation head was `a5066c848ebd14c5045817947978646ef9af9578`; DQ-TRAIN-001I is complete/merged.

Branch: `agent/training-selected-inventory-confirmation-001jp`, created from that exact base. Published head and PR are recorded in the draft PR completion report.

## Problem and authority

The attempted DQ-TRAIN-001J specification freeze stopped before edits: the merged adapter accepted current execution inventory only when confirmation covered every one of the 14 registry items. A selected-plan-only confirmation was ignored, including quantities contradicting cached API data. This prevented J-A4/J-C7/J-C8 from being frozen consistently with unchanged canonical code.

The owner separately authorized this bounded correction. It changes inventory normalization and inventory readiness only. It does not freeze or implement the remaining DQ-TRAIN-001J acquisition, packaging, or UI contract.

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

This is synthetic, nonprivate input, not a captured player specimen. Confirmation remains subject to the existing verified source/freshness gate. Missing observation evidence, noncurrent confirmation, or `FRESH`/`STALE`/`UNKNOWN` confirmation cannot grant execution proof. The pure modules do not read a clock or independently certify recency; callers must honestly establish current evidence and invalidate it after material changes. A recently fetched API response is not equivalent to current player confirmation.

- Only explicitly present, own registry keys with nonnegative safe-integer quantities are accepted. Zero is a confirmed quantity. Unknown keys and invalid quantities cannot override planning data or create execution proof. Valid keys in a mixed input remain independently usable.
- Accepted current confirmation overrides conflicting cached quantities for those keys. It does not copy cached quantities into a confirmation or manufacture missing quantities. The precedence is current player evidence over category-cached planning data, independent of HTTP fetch order.
- `adaptInventory` and `observedState` add `inventoryFreshnessByItem`. Accepted confirmed keys are `LIVE`; unconfirmed API keys retain their planning freshness. Category source/cache/provenance records remain unchanged.
- `fields.inventory.confirmation` records only accepted quantities with `CONFIGURED`, `PLAYER_CONFIRMATION`, source ID, observation timestamp, and `LIVE` freshness.
- Aggregate `inventoryFreshness`, `freshness.inventory`, and `capabilities.inventoryExecution` retain their complete-inventory meaning. Partial confirmation does not promote them. The existing `complete:true` all-registry confirmation still produces aggregate `LIVE` and `inventoryExecution:true`.
- Each normalization starts from its supplied inputs. There is no persisted confirmation, implicit carry-forward, epoch manager, or new storage behavior.

## Selected-plan readiness

`planReadiness` evaluates only keys in the selected plan's `ownedItemsConsumed` and `boughtItems`. For each consumed item, explicit per-item freshness takes precedence over the aggregate class. Legacy fully-LIVE normalized inputs remain supported when an item has no explicit per-item class.

The required quantity is the sum of owned and bought consumption for that item. It must be a positive safe integer; the observed available quantity must be explicit and valid. `LIVE` proof with an insufficient quantity returns `NEEDS_ITEMS` / `RESOURCE_MISSING`. Missing/invalid quantity returns `NEEDS_REFRESH` / `DATA_MISSING`; non-LIVE proof remains `NEEDS_REFRESH` under existing stale/missing reasons.

Purchase-dependent plans still require `itemsAvailable:true` and current quantity proof for the total consumed quantity. Item confirmation cannot bypass acquisition, Energy, Happy, gym, gain modifiers, cooldown, booster threshold, refill, or timing gates. A train-now plan consuming no items does not acquire an inventory dependency.

Current confirmation changes the next normalized inventory and therefore the next `recommend` invocation. Contradictory quantities require callers to replan; an old plan is also checked against the new quantities rather than its cached resource assumptions. No runtime event handler or automatic replan trigger is introduced here.

## Protected behavior and exclusions

Planner arithmetic, simulation, objective ranking, candidate generation, confidence classification, structural identity, and item mechanics are unchanged. A confirmation supporting the same resource plan preserves modeled gain, economics, confidence, and fingerprint while changing readiness only.

Preserved: `TORN_ENERGY_STACK_CAP_V1=1000`, independent natural maximum, supported +250E Xanax projection and immediate +75 Happy exactly once, no invented future Xanax cooldown, checkpoint/replan stacking, natural-max Point refill, sequential 1,150E route, booster pre-use threshold/legal frontier, ordinary Happy, regeneration, provenance, calibration, and 50m boundary. All frozen 001A–001I JSON fixtures remain unchanged.

No userscript, browser/runtime/UI implementation, generator, dependency installation, package manifest, workflow, network acquisition, storage key/migration, listener, timer, observer, release metadata, private player data, or gameplay action is added.

H1 (`happy.tick_time` reset timing) and H2 (personalized calendar event interval) remain **unresolved live-evidence gates**. Synthetic timing inputs exercise existing proof boundaries; they do not prove H1/H2 or authorize their closure.

## Verification and rollback

Preflight: full checkout, exact local/remote base, clean tree, Git/Node/Python available, and an isolated branch created remotely through the GitHub connector. Direct CLI push lacked write authentication; publication uses connector Git objects with local tested-tree equality and exact parent verification.

Baseline: focused **148/148**, repository **385/385** across 21 suites. Ten of the first eleven J-P checks failed against unchanged baseline source; the noninventory-gate preservation check already passed. The completed suite covers unique J-P1–J-P14: required-only overlay, zero/missing state, invalid proof, full compatibility, selected-plan integration, contradiction/replan, scoped freshness, insufficient quantity, item-proof precedence, bought-resource totals, independent gates, Happy preparation, normalization isolation, and malformed consumption/immutability.

Required checks: syntax for both canonical source/test pairs; focused and repository Node regressions; frozen JSON parse/ID checks; edited NDJSON parse/ID checks; Markdown link/heading inspection; `git diff --check`; complete exact-base diff review and prohibited-file review. Final executed counts are recorded in the draft PR.

No live Torn/TornPDA behavior was exercised. Future runtime work still requires its separate specification, independent verification, owner `[B][WORK]` authorization, and desktop/TornPDA manual gates.

Rollback: leave this draft PR unmerged, or revert its single published correction commit on the isolated branch. No durable player data is changed.

Next: independent `[V]` of this correction, then a separate owner merge decision. Resume the DQ-TRAIN-001J `[S]` freeze against a freshly verified baseline only after this prerequisite is resolved. Runtime implementation remains unauthorized.
