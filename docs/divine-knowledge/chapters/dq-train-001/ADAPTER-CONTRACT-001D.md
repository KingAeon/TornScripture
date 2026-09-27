# DQ-TRAIN-001D — Normalized Adapter Contract v0.1

Status: **V0.1 SOURCE, FRESHNESS, AND MECHANIC CONTRACT FROZEN AFTER PR #128; ADAPTER RUNTIME BUILD REQUIRES SEPARATE OWNER [B] AUTHORIZATION**

Prepared: 2026-09-26
Pure planner baseline: PR #123 merged at `37fe611cfeb58bf812272eef18c5d69eb9952d01`.

## 1. Boundary

The adapter layer converts approved Torn sources into the normalized inputs already consumed by `src/training-advisor-pure.js`.

It MUST NOT:

- change planner arithmetic;
- perform gameplay actions;
- hide stale or cached state by relabeling it LIVE;
- parse arbitrary percentages into gain modifiers;
- infer exact future random drug cooldowns;
- treat inventory names as mechanic truth;
- require one giant all-or-nothing API key;
- persist raw player state merely because it was fetched.

## 2. Capability-based source acquisition

Runtime capability checks take precedence over broad key labels.

For each requested source the adapter records:

```text
sourceId
requestedSelection
requestSucceeded
permissionFailure?
sourceTimestamp?
observedAt
cacheClass
freshness
```

The current OpenAPI description/key-parameter mismatch for `/user/gym` and `/user/perks` therefore does not need to be guessed into a static minimum-access label.

Contract:

- if the endpoint succeeds and validates structurally, consume it;
- if Torn returns a permission failure, mark only the dependent capability unavailable;
- onboarding may request the exact Custom selection where available;
- never infer permission from broad numeric access level alone.

This closes the architecture dependency on the unresolved Public-versus-Minimal documentation mismatch while preserving the discrepancy as a maintenance note.

## 3. ObservedState normalization

### Bars

Source: `GET /user/bars`.

```text
energy                 <- bars.energy.current
naturalEnergyMax       <- bars.energy.maximum
naturalRegen.energy    <- bars.energy.increment
naturalRegen.everySeconds <- bars.energy.interval
happy                  <- bars.happy.current
ordinaryHappy          <- bars.happy.maximum   [guarded until elevated-Happy strengthening]
```

Freshness:

- current Energy and Happy may be marked LIVE only from a successful current bars response whose timestamp/provenance is accepted by the adapter;
- `maximum`, `increment`, and `interval` inherit source provenance but are slower-changing mechanics;
- a positive `tick_time` never means natural Energy may exceed `naturalEnergyMax`.

### Cooldowns

Source: `GET /user/cooldowns`.

```text
cooldowns.drugSeconds    <- cooldowns.drug
cooldowns.boosterSeconds <- cooldowns.booster
```

Freshness: LIVE only from the current successful cooldown response.

### Battle stats

Source: `GET /user/battlestats`.

```text
stats.strength  <- battlestats.strength.value
stats.speed     <- battlestats.speed.value
stats.defense   <- battlestats.defense.value
stats.dexterity <- battlestats.dexterity.value
```

The aggregate `modifier` and `modifiers[]` fields are NOT gym-gain perks.

### Active gym

Sources:

```text
/user/gym.gym.id
    JOIN
/torn/gyms[].id
```

Normalized for the target stat:

```text
gym.energyPerTrain <- activeCatalog.energy_cost
gym.dots           <- activeCatalog.modifiers[targetStat]
gym.id             <- activeCatalog.id
gym.name           <- activeCatalog.name
```

The catalog row MUST contain all expected structural fields. Because `/torn/gyms` is officially Unstable, shape mismatch or missing join fails closed.

A non-null gym `note` is preserved as a material mechanic flag. If its training or preparation impact is not explicitly supported, gym-dependent prediction fails closed with `UNSUPPORTED_EFFECT`; unrelated inventory and market capabilities may continue. Lowering `calibratedDomain` alone is insufficient, because the note may change whether the recommended sequence is usable. A future supported note requires its own typed mechanic rule.

## 4. Gain-perk normalization

Source: complete successful `GET /user/perks` response.

Recognized v0.1 numeric gain patterns:

```text
faction:
  + N% strength gym gains
  + N% speed gym gains
  + N% defense gym gains
  + N% dexterity gym gains

property:
  + N% gym gains
```

Normalized perk IDs are deterministic:

```text
faction:gym:strength
faction:gym:speed
faction:gym:defense
faction:gym:dexterity
property:gym:all
```

Rates are decimal `N / 100`.

Explicit exclusions:

- passive Strength/Speed/Defense/Dexterity;
- damage;
- crime gains;
- work-stat effects;
- unrelated percentages.

Unknown strings are not fatal by default. A string is material only when it contains training-relevant terms such as `gym`, `happy`, `booster`, `candy`, `energy`, `drug`, `training`, or a recognized training-special identifier. Unknown material strings create an `activeEffects` UNSUPPORTED record and disable affected gain prediction.

## 5. Booster maximum

Base mechanic: 24 hours.

Faction mechanics can extend maximum booster cooldown by up to +24 hours.

Frozen v0.1 normalization:

- when a complete verified perk/effect state contains **no** material maximum-booster-cooldown modifier, derive `boosterMaxSeconds = 86400` with provenance `DERIVED`;
- when such a modifier is present, v0.1 does **not** numerically parse it and `boosterMaxSeconds` remains unknown/unsupported;
- when perk/effect state is incomplete, do not assume the base maximum;
- current booster countdown remains independently observed from `/user/cooldowns`.

This is intentionally conservative until a positive live specimen and parser contract justify broader faction-shareable support.

### 5.1 Booster-use threshold semantics — corrected in the merged planner

`boosterMaxSeconds` is the threshold that must be **above the current cooldown before the next item is used**, not a hard ceiling on the post-item result.

Correct sequence rule:

```text
before each booster:
  currentBoosterSeconds < boosterMaxSeconds

after use:
  currentBoosterSeconds += itemCooldownSeconds
  # result may exceed boosterMaxSeconds

while currentBoosterSeconds >= boosterMaxSeconds:
  no next booster until an observed/waited state is below the maximum
```

If a sequence reaches the maximum exactly, the planner must insert an explicit wait/verification before another booster rather than assume elapsed time.

PR #127 corrected per-item pre-use legality, and independently verified PR #128 corrected raw-candidate frontier pruning before sequential legality filtering. Both are merged in main `24701cccbaebbeae7b3e8bb3e05d9c2f9c478a82`. The adapter passes the observed maximum as-is; it must not inflate or falsify `boosterMaxSeconds`. The four-eDVD phase at a base 24h maximum exposes a separate wait/verify continuation for the fifth item, without inventing future Happy or elapsed time.

## 6. Daily points Energy refill

Source: `GET /user/refills` plus a versioned configured mechanic for current Point cost.

Torn's v2 migration documented this selection as renamed fields from the earlier `*_refill_used` / `special_refills_available` shape.

Current verified v0.1 mechanic baseline (2026-09-26):

- paid daily Energy refill: **30 Points**;
- free/special refills must be consumed before the daily paid refill can be used.

Normalized paid-refill path:

```text
refillState.paidEnergyUsed   <- refills.energy
refillState.specialCount     <- refills.special_count
pointRefill.fillAmountPolicy <- "natural_max"
pointRefill.pointsRequired   <- 30   [CONFIGURED, versioned mechanic]
```

Eligibility:

- `refills.energy == true` -> paid daily Energy refill already used;
- `refills.energy == false && special_count == 0` -> paid daily refill may be exposed as available;
- `special_count > 0` -> v0.1 MUST NOT expose the paid-refill path as READY; special/free refill sequencing is not yet modeled and the game requires those refills to be used first.

The adapter does not infer the cash value of Points. `pointValue` remains a preference/economic input.

`/user/refills` does not report `pointsAvailable`. Unless a separately approved current balance source or explicit current player confirmation supplies that quantity, leave it unknown. The pure planner may form a refill candidate for comparison, but execution readiness MUST be `NEEDS_REFRESH` until `pointsAvailable` and refill state meet the existing freshness checks; never infer enough Points from `refills.energy == false`. An unpriced `pointValue` also remains unknown economics for objectives that require it.

Historical pure-planner tests using another synthetic `pointsRequired` value test arithmetic only and are not current-cost claims.

## 7. Planning inventory

Source: `GET /user/inventory?cat=<category>`.

Required categories for v0.1:

- Drug;
- Booster;
- Candy.

Rules:

- consume all pages;
- only after pagination is complete may missing item IDs normalize to zero;
- normalize by stable item ID, not display name;
- preserve category source timestamp;
- because Torn documents a one-hour category cache, API inventory freshness is never promoted to LIVE for execution readiness solely because it was just fetched.

Planner-friendly keys currently map:

```text
206 -> xanax
197 -> ecstasy
366 -> eroticDvd
<candy item id> -> registry key
```

The adapter may provide planning quantities while execution readiness remains NEEDS_REFRESH until the required inventory is confirmed by a stronger approved source or explicit player confirmation.

## 8. Item mechanics

The adapter joins inventory IDs against `ITEM-MECHANIC-REGISTRY-001D.md`.

Base constants are versioned and source-audited.

Frozen v0.1 dynamic-item policy:

- numerical item mechanics are base-only;
- current live-proven gym-gain perks remain supported separately;
- if complete perk/effect state contains a material Candy, consumable-cooldown, eDVD, booster-maximum, drug-effect, event, or other preparation modifier outside the frozen subset, only the affected preparation capability is marked unsupported;
- raw planning inventory remains available for display/accounting, but the adapter MUST omit unsupported item classes from the planner-facing `itemMechanics` projection so the pure planner cannot generate those preparation candidates;
- an unsupported material-effect record is retained for explanation/provenance;
- the adapter MUST NOT generic-parse arbitrary percentages to recover that capability.

Candy base mechanics require explicit verification that faction/company/book/event modifiers are absent or inactive. In particular, World Diabetes Day state must be explicit from approved server-time/event logic; unknown or active event state fails Candy preparation closed in v0.1.

Random future drug cooldown ranges MUST NOT become exact `xanax.cooldownSeconds` or Ecstasy cooldown values. When exact future timing is required and no observed checkpoint exists, the strategy remains unsupported/replan-based.

The item-specific Ecstasy source currently says 200–231 minutes while the generic Drugs table says 200–230. The registry therefore stores a conservative 200–231 documented envelope for provenance only; planner execution still re-observes the actual cooldown checkpoint rather than depending on an exact forecast.

## 9. Provenance and freshness

Every material normalized field receives:

```text
provenance
freshness
sourceId
observedAt
sourceTimestamp?
cacheClass?
reason?
```

Planner-facing convenience fields such as `freshness.energy` are derived from this metadata.

Minimum readiness semantics remain those already frozen in the pure planner:

- Energy: LIVE
- Happy: LIVE
- relevant drug cooldown: LIVE
- relevant booster cooldown: LIVE
- execution inventory: LIVE-equivalent
- gym: LIVE or FRESH
- gain modifiers: LIVE or FRESH
- a Point-refill plan: current `pointsAvailable` and refill eligibility proof

Planning may continue with weaker inventory freshness where the pure planner permits it.

Elevated-Happy execution also needs `timing.safeQuarterWindow == true` from approved current timing evidence. If no server-time/active-window rule is verified, the adapter leaves that capability unknown; the planner returns `NEEDS_REFRESH` instead of a READY Happy-preparation sequence.

## 10. Calibrated-domain flag

The accepted calibration is narrower than "Complete Cardio + supported perks + <=50m".

Documented B1–B4 evidence covers:

- ordinary-Happy observed lanes for all four battle-stat families;
- elevated Happy around 33k only for Speed and Strength;
- 11-train sequential batches only for Speed and Strength;
- the recorded modifier stacks and observed stat-magnitude lanes;
- Complete Cardio / 10E.

The merged pure planner currently consumes one plan-global `state.calibratedDomain` boolean, while a recommendation search may generate candidates that move Happy or other plan state outside the observed lane.

Therefore frozen conservative v0.1 adapter behavior is:

- general/open-ended strategy generation emits `calibratedDomain:false`;
- `calibratedDomain:true` is permitted only for an explicitly calibration-locked invocation whose **entire candidate set** is constrained to a documented B1–B4 lane;
- no generic faction-shareable adapter may infer that lock from only gym identity, supported modifiers, and the pre-50m arithmetic boundary;
- a future planner contract may replace the global boolean with plan-specific calibration classification.

This avoids labeling unobserved Defense/Dexterity high-Happy plans, materially different stat magnitudes, or other generated recipes as CALIBRATED while preserving their arithmetic as supported extrapolation where otherwise allowed.

## 11. Failure isolation

Source failures degrade only dependent capabilities.

Examples:

- battlestats denied -> allow manual stats;
- inventory stale -> planning inventory remains useful but execution readiness is not READY;
- perks unavailable -> do not assume zero modifiers;
- gym catalog schema changed -> fail gym-dependent prediction;
- market unavailable -> preserve gain-only objectives where economics are not required;
- bars unavailable -> no current Energy/Happy recommendation.

## 12. Remaining gate

The normalized source mappings, capability/freshness behavior, refill/special-refill mapping, conservative calibration-confidence policy, material gym-note gate, and bounded v0.1 dynamic-item projection are specification-frozen by the final [V]/[S] pass. The upstream Point-refill, booster-threshold, and booster-frontier defects are resolved in main. This document approves no runtime build.

Before adapter implementation:

1. retain elevated-Happy `ordinaryHappy` confirmation as desirable strengthening rather than a blocker;
2. obtain explicit owner `[B]` authorization for adapter implementation;
3. verify the separately built adapters before requesting UI/TornPDA integration authority.

No adapter implementation, networking, storage, UI, timer, DOM capture, or gameplay action is authorized by this contract.


## Resolved upstream refill correction

The `/user/refills` source mapping remains valid. DQ-TRAIN-001E corrected the pure planner so a Point refill fills to `naturalEnergyMax`, removes pre-stack `XANAX_REFILL`, and models the 1,150E route sequentially as TRAIN -> USE_REFILL -> VERIFY_STATE -> TRAIN. PR #125 was independently verified and merged as `0adcab679c07b6dc6d01e4aa2d2eea586f9a5f97`. Adapter implementation still requires the separate 001D freeze/build gate.
