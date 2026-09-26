# DQ-TRAIN-001D — Training Advisor Adapter Source Map and Live-Proof Plan

Status: **DISCOVERY / SPECIFICATION CANDIDATE; NO ADAPTER OR UI IMPLEMENTATION AUTHORIZED**

Opened: 2026-09-25 after verified merge of PR #123.
Repository baseline: `main@37fe611cfeb58bf812272eef18c5d69eb9952d01`.

## 1. Purpose

The pure Training Advisor planner is now merged. The next bounded problem is not more planner math. It is deciding how TornScriptures should obtain trustworthy normalized state for that planner without weakening the frozen provenance, freshness, permission, privacy, or fail-closed contracts.

DQ-TRAIN-001D maps candidate sources for:

- `ObservedState`;
- `PlanningPreferences` inputs that can be derived safely;
- `MarketSnapshot`;
- timing/readiness state;
- static or versioned mechanic metadata used by adapters.

This document does not authorize network calls, storage changes, DOM capture, userscript UI, or runtime integration.

## 2. Current official API baseline

Current official Torn API v2 OpenAPI rechecked 2026-09-25:

- OpenAPI version: **6.13.6**;
- base URL: `https://api.torn.com/v2`;
- API v2 remains under active development;
- endpoint stability is recorded per selection.

Important update from the older 2026-09-14 training audit:

- `/user/gym` and `/user/perks` still contain a documentation/parameter mismatch: their descriptions say Minimal access while the declared key parameter is Public.
- `/torn/gyms` remains marked **Unstable**.
- `/user/inventory` remains explicitly cached for **1 hour per category**.

Do not resolve these discrepancies by assumption. Live permission and response-shape proof is required before runtime architecture relies on them.

## 3. Candidate normalized source map

| Planner field/domain | Preferred candidate source | Documented access | Stability/freshness | Current disposition |
|---|---|---|---|---|
| current Energy | `GET /user/bars` | Minimal | Stable | strong candidate |
| natural Energy maximum | `/user/bars -> energy.maximum` | Minimal | Stable | live-proven for donator-class 150 cap |
| natural Energy increment/interval | `/user/bars -> energy.increment/interval` | Minimal | Stable | live-proven +5 / 600s in observed donator state |
| current Happy | `GET /user/bars` | Minimal | Stable | strong candidate |
| ordinary/base Happy | `/user/bars -> happy.maximum` candidate | Minimal | Stable | semantic live proof required; do not silently equate until verified |
| Happy recovery timing | `/user/bars -> happy.tick_time/full_time` where useful | Minimal | Stable | candidate |
| drug cooldown | `GET /user/cooldowns` | Minimal | Stable | live-proven response source |
| booster cooldown | `GET /user/cooldowns` | Minimal | Stable | live-proven countdown source; maximum capacity separate |
| battle stats | `GET /user/battlestats` | Limited | Stable | live-proven raw `value`; combat modifiers remain separate |
| active gym identity | `GET /user/gym` | description says Minimal; key parameter says Public | Stable | permission conflict requires live proof |
| gym Energy/train + stat modifiers | `GET /torn/gyms` joined by gym ID | Public | **Unstable** | Complete Cardio live-proven direct 10E + familiar dot scale; schema guard required |
| gain perks/modifiers | `GET /user/perks` | description says Minimal; key parameter says Public | Stable | current +2% property and +7/+7/+6/+6 faction gym-gain strings live-proven; explicit parser registry required |
| relevant inventory quantities | `GET /user/inventory` | Minimal | Stable, **1h/category cache** | live-proven for Drug/Candy/Booster planning snapshots; complete-pagination absence may normalize to zero; not execution proof |
| refill availability | `GET /user/refills` | Minimal | Stable | response live-proven; boolean polarity not yet frozen |
| Torn/server timestamp | public timestamp selection | Public | Stable | preferred timing anchor when needed |
| item catalog identity | `GET /torn/{ids}/items` | Public | Stable | good for item identity/catalog metadata |
| exact training-item mechanics | versioned TornScriptures mechanic registry backed by verified sources | n/a | explicit versioning required | do not parse free-text effects into exact mechanics without specification |
| current market value | existing market capability layer where applicable | capability-specific | source-specific cache | separate MarketSnapshot adapter, not ObservedState |

## 4. Why adapters remain separate

The pure planner MUST remain unaware of:

- API keys;
- endpoint URLs;
- Torn response object names;
- TornPDA bridges;
- browser fetch;
- localStorage / GM storage;
- DOM/page state;
- request timestamps;
- API error codes.

An adapter may read an approved source and emit normalized values plus provenance/freshness. It may not smuggle uncertain source semantics into a field marked authoritative.

Conceptual flow:

```text
Official/API or approved current source
        |
        v
Source-specific adapter
        |
        v
Normalized field + provenance + freshness + evidence
        |
        v
ObservedState / MarketSnapshot
        |
        v
pure Training Advisor planner
```

## 5. Proposed source adapter contracts

Every source adapter SHOULD return either normalized data or a visible failure object.

Minimum metadata per material field:

```text
value
provenance: OBSERVED | CONFIGURED | DERIVED | ASSUMED
freshness: LIVE | FRESH | STALE | UNKNOWN
sourceId
observedAt
sourceTimestamp?
cacheClass?
confidenceReason?
```

Adapters MUST NOT convert a stale/cached response to LIVE merely because the HTTP request itself was recent.

### 5.1 Execution freshness

The merged pure planner requires execution-critical fields to arrive with adequate freshness classes.

Adapter policy candidate:

- current Energy: LIVE;
- current Happy: LIVE;
- relevant drug/booster cooldown: LIVE;
- inventory used in immediate execution: LIVE-equivalent proof or player confirmation;
- active gym: LIVE or FRESH depending source semantics;
- gain modifiers: FRESH or better;
- battle stats: FRESH for planning, refreshed after material training where necessary.

The exact time thresholds are not frozen here. Prefer endpoint/source semantics over arbitrary elapsed-time constants.

## 6. Inventory split

`/user/inventory` is officially one-hour cached per category and is already live-proven in TornScriptures under a narrow Custom key.

Therefore v0.1 should distinguish:

### Planning inventory

May use the cached API inventory snapshot with provenance and cache warning.

### Execution inventory

Before an immediate item-use recommendation becomes READY, the adapter needs stronger evidence:

- player confirmation;
- approved foreground page/application state when rules allow;
- or another future source proven fresh enough.

Do not label a one-hour API inventory snapshot LIVE solely because it was fetched now.

## 7. Bars as a high-value source

The current `UserBar` schema exposes:

- `current`;
- `maximum`;
- `increment`;
- `interval`;
- `tick_time`;
- `full_time`.

That makes `/user/bars` a promising source for both present state and explicit natural-regeneration timing.

Live proof should establish:

1. donator Energy `maximum` is 150 for the owner;
2. Energy `increment/interval` match the current account state;
3. `happy.maximum` is the correct semantic source for the planner's `ordinaryHappy` field;
4. over-base temporary Happy does not mutate the meaning of `happy.maximum`;
5. timestamp/tick fields can be normalized without local-clock assumptions.

Until item 3 is proven, `ordinaryHappy` must not silently fall back to current Happy.

## 8. Gym source composition

Current `/user/gym` returns only active gym identity (`id`, `name`).

Current `/torn/gyms` supplies catalog records with:

- gym ID/name/class;
- `energy_cost`;
- stat modifiers for Strength, Speed, Defense, Dexterity;
- cost;
- note.

The likely adapter shape is a join:

```text
/user/gym.gym.id
      +
/torn/gyms[matching id]
      =
normalized active gym
```

Before freezing this adapter, prove:

- current response unit scale for modifiers;
- Complete Cardio maps to the previously calibrated familiar dot values;
- `energy_cost` equals internal Energy/train;
- special gym notes/effects do not get discarded;
- behavior when `/torn/gyms` changes because the endpoint is marked Unstable.

An unstable catalog MUST NOT silently change the planner's arithmetic semantics.

## 9. Perk normalization

`/user/perks` currently exposes categorized arrays of strings rather than a frozen numeric gym-gain structure.

Therefore a naïve text parser is not yet authorized.

The next evidence pass should capture sanitized examples for only the categories needed by training:

- faction;
- job;
- property;
- education;
- enhancer;
- book;
- stock;
- merit.

Then classify each relevant string as:

- recognized numeric gym-gain modifier;
- recognized unsupported special effect;
- unrelated to training;
- unknown.

Unknown potentially material strings fail closed for affected gain prediction.

## 10. Permission strategy

The Training Advisor should request the least privilege that supports the selected feature set.

Current likely floor:

- Minimal for bars, cooldowns, inventory, refills;
- Limited when automatic battle-stat acquisition is desired;
- Public candidates for gym catalog and some metadata;
- exact Custom selections should be supported where Torn permits them.

Do not require a broad Limited key merely because one core endpoint needs Limited. TornScriptures' existing DQ-KEY evidence shows that exact Custom grants can be the more truthful permission model.

Permission checks should be capability-based and presence-oriented, not based only on broad numeric access level.

## 11. MarketSnapshot boundary

Market data must remain separate from player state.

The planner needs concepts such as:

- new cash required;
- replacement value of owned items;
- point value when the user wants it priced;
- source/freshness/quantity support.

Do not collapse catalog `market_price`, average price, executable listing floor, trader quote, and owned replacement value into one number.

Existing TornScriptures market discovery should be reused rather than creating a Training-Advisor-specific price fetcher.

## 12. Timing and quarter-hour safety

The pure planner consumes normalized timing state and never reads the clock.

The adapter layer should prefer Torn server timestamp when timing correctness matters.

For elevated-Happy execution, the eventual timing adapter should provide enough information to decide whether the current quarter-hour window is safe for the expected manual training sequence.

No automatic action is implied.

## 13. Live-proof matrix before adapter implementation

A bounded owner-assisted live pass should prove only fields that materially unblock v0.1.

Priority A:

1. `/user/bars` response semantics for Energy/current/max/regen and Happy/current/max;
2. `/user/cooldowns` drug + booster fields;
3. `/user/battlestats` exact current stat response under intended Custom/Limited permission;
4. `/user/gym` permission behavior and active gym ID;
5. `/torn/gyms` matching active gym record and unit normalization;
6. `/user/perks` exact strings for the owner's currently relevant training modifiers;
7. `/user/refills` response semantics;
8. relevant `/user/inventory` categories and cache metadata.

Priority B:

- current server timestamp normalization;
- item-catalog lookup for Xanax, Ecstasy, eDVD, selected candy exemplars;
- price-source integration semantics;
- execution-fresh inventory fallback.

No raw API key, full inventory dump, or private player-state specimen belongs in Divine Knowledge. Store sanitized schema notes and aggregate conclusions only.

## 14. Capability-first degradation

The adapter layer should expose capabilities rather than make one giant all-or-nothing request.

Examples:

- bars + gym + perks but no battlestats -> manual stats can still enable planning;
- battlestats unavailable -> ask user for stats, do not disable inventory planning;
- market unavailable -> Maximum Gain may continue, cost objectives degrade;
- inventory stale -> planning can continue, READY becomes NEEDS_REFRESH;
- `/torn/gyms` schema mismatch -> gym-dependent prediction fails closed while unrelated state remains visible.

## 15. Next gate

Before adapter/UI implementation:

1. complete the bounded live-proof matrix;
2. freeze normalized source mappings and freshness semantics;
3. freeze permission/capability requirements;
4. define sanitized adapter fixtures;
5. independently verify adapter fixtures;
6. obtain explicit build authorization for adapters;
7. implement adapters separately from presentation;
8. integrate beginner/advanced UI only after adapter verification.

The next immediate action is therefore **source verification, not UI coding**.
