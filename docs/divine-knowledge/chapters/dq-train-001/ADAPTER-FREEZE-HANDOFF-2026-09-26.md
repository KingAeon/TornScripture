# DQ-TRAIN-001D — Adapter Specification Freeze Handoff

Status: **[V]/[S] PERFORMED; SOURCE/FRESHNESS SPEC AMENDED; FINAL FREEZE BLOCKED BY BOOSTER-THRESHOLD PLANNER CORRECTION; NO ADAPTER RUNTIME BUILD AUTHORIZED**

Prepared: 2026-09-26

Repository: `KingAeon/TornScripture`

Current merged baseline:

`main@0adcab679c07b6dc6d01e4aa2d2eea586f9a5f97`

Clean continuation branch:

`docs/training-advisor-adapter-freeze-001d-r2`

Historical discovery PR:

`#124` on `docs/training-advisor-adapter-discovery-001d`

PR #124 diverged after the independently verified DQ-TRAIN-001E refill correction merged through PR #125. Do not merge #124 as-is. Its reusable adapter evidence/specification documents were carried forward onto this clean branch from the corrected main baseline.

## Upstream state now settled

PR #125 merged and corrected Point-refill semantics:

- direct refill fills to `naturalEnergyMax`;
- no additive refill into stacked Energy;
- no pre-stack `XANAX_REFILL`;
- refill-assisted 1,150E plan is sequential TRAIN -> USE_REFILL -> VERIFY_STATE -> TRAIN;
- second training phase continues modeled stat and Happy;
- points/refill freshness and availability gate readiness;
- focused 89/89 and repository 326/326 Work tests passed before merge;
- independent [V] passed before owner merge authorization.

DQ-TRAIN-001D may therefore resume without the upstream refill blocker.

## Carried-forward 001D evidence

The clean branch contains:

- `ADAPTER-SOURCE-MAP-001D.md`
- `LIVE-ADAPTER-PROOF-PROTOCOL-001D.md`
- `LIVE-ADAPTER-PROOF-RESULTS-001D.md`
- `ITEM-MECHANIC-REGISTRY-001D.md`
- `ITEM-MECHANIC-FIXTURES-001D.json`
- `ADAPTER-CONTRACT-001D.md`
- `ADAPTER-FIXTURES-001D.json`

Live-proof state already established:

- bars: donator natural Energy max 150; +5 / 600s Energy; ordinary-state Happy response;
- cooldowns: drug/booster countdown shape;
- battlestats: raw `value` distinct from modifier/modifiers;
- active gym: Complete Cardio id 14;
- gym catalog: 10E and 5.5 / 5.8 / 5.5 / 5.2 direct live unit match;
- current gain perks: property +2%, faction +7/+7/+6/+6;
- refill boolean polarity: false means unused/available;
- planning inventory: Drug/Candy/Booster item-ID/amount/timestamp semantics with complete-pagination absence-to-zero;
- inventory remains planning-only because Torn documents one-hour category caching.

## Remaining 001D freeze work

### V1 — fixture/spec consistency

Independently verify:

- all adapter fixtures parse;
- all item-mechanic fixtures parse;
- no duplicate fixture IDs;
- fixture expectations match the written contract;
- refill fixture semantics match merged DQ-TRAIN-001E;
- Complete Cardio calibration gating remains bounded;
- unknown material effects fail closed;
- cached inventory cannot become LIVE execution proof;
- capability failure degrades only the dependent feature.

### V2 — v0.1 dynamic-item boundary

Freeze the intentionally conservative v0.1 rule:

- base Xanax/Ecstasy/eDVD/Candy mechanics supported;
- current live-proven gym-gain perks supported separately;
- dynamic candy/consumable/eDVD/booster-maximum modifiers are not generic-parsed in v0.1;
- when a material unsupported modifier is present, only the affected preparation capability fails closed;
- base booster maximum 24h may be derived only from a complete verified perk/effect state with no maximum-booster modifier.

### V3 — source/freshness contract

Confirm:

- `/user/bars`, `/user/cooldowns`, `/user/battlestats`, `/user/gym`, `/torn/gyms`, `/user/perks`, `/user/refills`, `/user/inventory` mappings;
- `/user/gym` and `/user/perks` minimum-access documentation mismatch stays capability-based rather than guessed;
- `/torn/gyms` remains guarded because the endpoint is Unstable;
- one-hour inventory cache is planning-only;
- execution readiness requires the planner's already-frozen freshness classes.

### V4 — optional strengthening, not a blocker

At a future naturally occurring elevated-Happy state, a second `/user/bars` capture can confirm:

```text
happy.current > happy.maximum
```

while `happy.maximum` remains the ordinary/base Happy reference.

Until then, `ordinaryHappy <- bars.happy.maximum` remains the leading guarded mapping and must never fall back to current elevated Happy.

## Freeze outcome

If V1–V3 pass with no blocking contradiction:

1. mark DQ-TRAIN-001D source/adapter contract frozen for v0.1;
2. record explicit supported/unsupported dynamic mechanic boundaries;
3. keep optional elevated-Happy proof open as strengthening;
4. request separate owner `[B]` authorization for adapter implementation;
5. adapter implementation remains separate from presentation/UI;
6. after adapter verification, request separate UI/integration authorization.

## Explicit non-authority

This handoff does not authorize:

- API/network runtime code;
- userscript changes;
- TornPDA integration;
- UI;
- storage;
- timers/listeners/DOM observers;
- automatic gameplay actions;
- merge/release of the continuation PR.

The next action is **[V]/[S] adapter specification verification and freeze**, not product build.

## [V]/[S] outcome — 2026-09-26

PR #126 verification parsed both fixture sets, checked current OpenAPI 6.13.6 source contracts, reconciled the post-PR125 refill model, and inspected the merged pure planner dependency.

Specification amendments made during verification:

- paid refill mapping now consumes `special_count` and a versioned 30-Point current cost;
- paid refill fails closed while free/special refills are pending;
- dynamic Candy/eDVD/item effects project fail-closed by omitting unsupported mechanics from planner-facing `itemMechanics`;
- World Diabetes Day/event state is explicit rather than assumed inactive;
- general strategy search now fails calibrated confidence closed because the current planner has one global `calibratedDomain` boolean;
- stale PR #124 / already-resolved blocker pointers are superseded.

Blocking finding:

- current Torn booster mechanics treat the maximum as a pre-use threshold: an item may be started below the maximum and leave cooldown above it; the merged planner instead enforces `current + planned <= max`.
- this can suppress the fifth eDVD in a base-24h preparation and conflicts with DQ-TRAIN-001B's live five-eDVD calibration evidence.

See `ADAPTER-VERIFICATION-FINDINGS-2026-09-26.md`.

### Revised next gate

1. owner authorizes a bounded `[B][BUG]` booster-threshold / one-item-overcap pure-planner correction;
2. correction receives independent `[V]`;
3. return to PR #126 for final fixture/spec consistency and owner freeze;
4. only then request separate `[B]` adapter implementation authorization.

PR #126 remains documentation/specification only.
