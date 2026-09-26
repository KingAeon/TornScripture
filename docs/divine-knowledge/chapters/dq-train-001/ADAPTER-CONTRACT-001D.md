# DQ-TRAIN-001D — Normalized Adapter Contract Candidate

Status: **SPECIFICATION CANDIDATE; LIVE SOURCE MATRIX SUBSTANTIALLY COMPLETE; NO RUNTIME IMPLEMENTATION AUTHORIZED**

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

A non-null gym `note` is preserved as a material mechanic flag. Unrecognized special-gym notes prevent automatic promotion into calibrated-domain confidence.

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

Official faction mechanics can extend maximum booster cooldown by up to +24 hours.

Candidate normalization:

- begin at `86400` seconds;
- if a complete verified perk set contains a recognized "maximum booster cooldown" addition, add the explicit hours;
- if the response is incomplete/unknown, do not assume the base maximum is the player's actual maximum;
- current booster countdown remains independently observed from `/user/cooldowns`.

For a complete perk set with no applicable maximum-booster-cooldown string, v0.1 may derive base 24h with provenance `DERIVED` and an explicit source reason.

## 6. Daily points Energy refill

Source: `GET /user/refills`.

Torn's v2 migration documented this selection as renamed fields from the earlier `*_refill_used` shape.

```text
pointRefill.allowed          <- !refills.energy
pointRefill.fillAmountPolicy <- "natural_max"
pointRefill.pointsRequired   <- configured/current verified point cost source
```

The boolean means **used**, not available:

- `false` = not used, therefore available;
- `true` = used, therefore unavailable.

The adapter does not infer the point currency valuation. That remains a preference/economic input.

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

Base constants are versioned and source-audited. Dynamic modifiers are separate state.

Random future drug cooldown ranges MUST NOT become exact `xanax.cooldownSeconds` values. When exact future timing is required and no observed checkpoint exists, the strategy remains unsupported/replan-based.

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

Planning may continue with weaker inventory freshness where the pure planner permits it.

## 10. Calibrated-domain flag

The adapter may set `calibratedDomain:true` only when all of the following are true:

- model ID is `vladar-v2-pre50m-v1`;
- active gym is Complete Cardio with the live-verified 10E / 5.5 / 5.8 / 5.5 / 5.2 catalog values;
- target stat/gain modifiers are represented by supported explicit gain perks consistent with the documented B1–B4 evidence domain;
- no unsupported material training effect is active;
- trained stat start remains inside the frozen pre-50m boundary.

Otherwise use supported extrapolation or unsupported behavior according to the pure planner contract.

## 11. Failure isolation

Source failures degrade only dependent capabilities.

Examples:

- battlestats denied -> allow manual stats;
- inventory stale -> planning inventory remains useful but execution readiness is not READY;
- perks unavailable -> do not assume zero modifiers;
- gym catalog schema changed -> fail gym-dependent prediction;
- market unavailable -> preserve gain-only objectives where economics are not required;
- bars unavailable -> no current Energy/Happy recommendation.

## 12. Remaining specification work

Before freezing 001D:

1. write and independently verify sanitized adapter fixtures;
2. freeze the exact supported Candy/dynamic modifier subset for v0.1;
3. retain elevated-Happy `ordinaryHappy` confirmation as a desirable strengthening specimen;
4. perform complete-diff verification of PR #124.

No adapter implementation, networking, storage, UI, timer, DOM capture, or gameplay action is authorized by this contract candidate.
