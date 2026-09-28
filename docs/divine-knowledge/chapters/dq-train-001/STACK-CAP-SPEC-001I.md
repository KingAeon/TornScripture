# DQ-TRAIN-001I — Energy Stack-Cap Versioned Mechanic

Status: **FROZEN BY OWNER [S]; DOCUMENTATION BRANCH ONLY; RUNTIME IMPLEMENTATION REQUIRES SEPARATE [B][WORK]**

Prepared: 2026-09-27

Base:

`main@cfdf9000d9a8e37d52ad3d5fbf0861abe5c4b1c2`

## Decision

TornScriptures freezes the current absolute Energy stack cap as a versioned Torn mechanic:

```text
energyStackCap = 1000
```

This is **not** the same field as the player's natural Energy maximum.

Natural Energy maximum remains player/account state:

```text
naturalEnergyMax <- /user/bars.energy.maximum
```

and is normally 100 or 150 depending on current account state.

The absolute stacked maximum is a separate game mechanic and MUST NOT be sourced from `/user/bars.energy.maximum`.

## Evidence

Primary current source:

- official Torn Wiki, **Energy**, rechecked 2026-09-27;
- the page states that natural Energy regenerates to 100/150 depending on donator status;
- it separately states: **"The maximum energy one can have at any moment is 1,000."**
- the same source records Xanax as +250 Energy.

This matches the earlier DQ-TRAIN-001A source audit, which already recorded the 1,000 stacked Energy cap from the official Energy page. DQ-TRAIN-001I promotes that established mechanic into the normalized adapter contract.

## Normalized contract

The adapter may expose:

```text
ObservedState.stackCap = 1000
```

from a project-versioned mechanic registry rather than a live player-state endpoint.

Required metadata:

```text
value       = 1000
provenance  = CONFIGURED
freshness   = FRESH
sourceId    = "TORN_ENERGY_STACK_CAP_V1"
cacheClass  = "VERSIONED_MECHANIC"
verifiedAt  = "2026-09-27"
```

`CONFIGURED` here means an explicit versioned TornScriptures mechanic constant, following the existing configured-mechanic precedent used by the paid Point-refill cost. It does not mean the user manually typed 1,000.

No runtime Wiki fetch is required or authorized. The value is maintained as versioned source-audited mechanic data and should be reverified when Torn changes Energy mechanics or during a future mechanic-maintenance pass.

## Xanax adapter consequence

DQ-TRAIN-001H corrected the pure planner so an immediate successful Xanax applies its explicit +75 Happy exactly once.

With the stack cap now frozen, the pure adapter may enable its Xanax planning capability only when the existing supported Xanax mechanic is present.

Target normalized projection:

```text
observedState.stackCap = 1000

observedState.xanax = {
  energyGain: 250
}

itemMechanics.xanax = {
  energyGain: 250,
  happyGain: 75
}
```

The Energy candidate and Happy effect remain intentionally split because the current pure planner reads Xanax Energy from `ObservedState.xanax` and the Happy mutation from `itemMechanics.xanax`.

## Capability rule

`xanaxPreparation` may be true only when all of the following hold:

1. the frozen stack-cap mechanic is available and valid at exactly 1,000;
2. Xanax's supported base mechanic survives the existing dynamic-effect fail-closed projection;
3. no material unsupported drug effect is active/unknown under the frozen adapter rules.

If the stack-cap mechanic is absent, invalid, or version-mismatched:

- omit `observedState.stackCap`;
- omit `observedState.xanax`;
- set `xanaxPreparation:false`;
- expose a bounded reason such as `STACK_CAP_UNAVAILABLE` or `MECHANIC_VERSION_MISMATCH`.

If Xanax mechanics are suppressed by unsupported dynamic drug effects:

- the stack cap may remain available for other logic;
- `observedState.xanax` remains absent;
- `xanaxPreparation:false`;
- preserve the existing `UNSUPPORTED_EFFECT` explanation.

## Timing boundary

This freeze does **not** turn future random Xanax cooldowns into exact values.

The adapter MUST NOT emit an invented `xanax.cooldownSeconds`.

Consequences:

- if current observed drug cooldown is zero, the planner may model one immediate Xanax;
- if current observed drug cooldown is positive, existing wait/checkpoint behavior applies;
- after a successful Xanax, another future Xanax still requires a fresh observed cooldown checkpoint before the next step can be authoritative;
- a four-Xanax 1,000E stack is therefore built/replanned checkpoint by checkpoint unless future exact cooldown state is separately observed.

## Refill boundary

The 1,000 Energy stack cap does not alter DQ-TRAIN-001E refill semantics.

A Point refill:

```text
fills to naturalEnergyMax
```

and does not add 100/150 Energy into an already stacked bar.

The optimized 1,150E Happy Jump remains:

```text
stack/train 1000E
-> USE_REFILL after training
-> VERIFY_STATE
-> train the ordinary refilled bar
```

not a pre-stack 1,150E state.

## Scope exclusions

DQ-TRAIN-001I does not authorize:

- source acquisition/networking;
- runtime Wiki scraping;
- TornPDA UI;
- DOM capture;
- storage changes;
- timers/listeners;
- automatic item use;
- automatic training;
- release.

It only freezes the stack-cap mechanic and the adapter-facing semantics needed to enable Xanax after a separately authorized implementation pass.

## Implementation acceptance

The later [B][WORK] pass must prove at minimum:

- natural Energy maximum 150 and stack cap 1,000 remain distinct;
- adapter emits `stackCap:1000` from versioned mechanics;
- supported Xanax projection emits `observedState.xanax.energyGain = 250`;
- immediate Xanax planner route becomes available without inventing future cooldown;
- unsupported drug-effect state still suppresses Xanax only;
- invalid/missing stack-cap mechanic fails closed;
- PR #130 Xanax +75 Happy regressions remain green;
- refill, booster, frontier, freshness, calibration and inventory regressions remain green;
- no network/UI/storage/gameplay behavior is introduced.
