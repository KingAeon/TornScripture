# DQ-TRAIN-001I — Work Transfer Handoff: Versioned Stack Cap + Xanax Adapter Enablement

Status: **COMPILED FOR NEXT [B][WORK] PASS; DO NOT START PRODUCT EDITS UNTIL THIS SPECIFICATION PR IS MERGED INTO MAIN**

Prepared: 2026-09-27

Repository: `KingAeon/TornScripture`

Specification branch:

`docs/training-stack-cap-001i-freeze`

Canonical specification:

- `STACK-CAP-SPEC-001I.md`
- `STACK-CAP-FIXTURES-001I.json`

Upstream product baseline before this specification branch:

`main@cfdf9000d9a8e37d52ad3d5fbf0861abe5c4b1c2`

PR #130 is merged at that baseline. The Work implementation MUST begin from the first exact `main` SHA that contains the merged DQ-TRAIN-001I specification branch/PR. Record that exact SHA in preflight and do not implement from the pre-freeze baseline above.

## Objective

Implement the frozen DQ-TRAIN-001I mechanic and remove the final deliberate Xanax-adapter blocker without expanding into source acquisition or UI.

Frozen mechanic:

```text
TORN_ENERGY_STACK_CAP_V1 = 1000
```

This is a versioned project mechanic backed by current official Torn Energy documentation. It is distinct from `naturalEnergyMax`, which remains live player/account state from `/user/bars.energy.maximum`.

## Required implementation

### 1. Versioned Energy mechanic

Add the smallest coherent versioned-mechanic representation for:

```text
energyStackCap = 1000
sourceId = TORN_ENERGY_STACK_CAP_V1
cacheClass = VERSIONED_MECHANIC
verifiedAt = 2026-09-27
```

Preferred behavior:

- `observedState.stackCap = 1000`;
- expose a normalized `fields.stackCap` record with the frozen metadata;
- provenance follows the frozen DQ-TRAIN-001I `CONFIGURED` mechanic convention;
- no network/Wiki fetch at runtime;
- a different supplied value is not a player-specific override and must fail closed as mechanic-version mismatch.

Do not derive stack cap from `/user/bars.energy.maximum`.

### 2. Enable supported Xanax adapter projection

When and only when the existing supported Xanax base mechanic survives the frozen dynamic-effect guards and the stack-cap mechanic is valid:

```text
observedState.stackCap = 1000
observedState.xanax = { energyGain: 250 }
itemMechanics.xanax = { energyGain: 250, happyGain: 75 }
capabilities.xanaxPreparation = true
```

Use the existing item-mechanic registry values. Do not duplicate Xanax numeric constants in a second unsynchronized source if avoidable.

Remove the stale `STACK_CAP_UNAVAILABLE` diagnostic only when the route is actually available. Preserve a bounded unsupported diagnostic when the versioned mechanic is unavailable/mismatched or Xanax is dynamically unsupported.

### 3. Preserve random cooldown checkpoint semantics

Do not add or infer `xanax.cooldownSeconds` from the documented 360–480 minute range.

Required behavior:

- current observed drug cooldown may gate the next Xanax;
- if it is zero, the planner may model one immediate Xanax;
- after a successful Xanax, another future Xanax remains checkpoint/replan based because the next exact cooldown is not known;
- do not plan four future Xanax on a fabricated cooldown schedule;
- PR #130 immediate +75 Happy semantics remain authoritative.

### 4. Preserve dynamic-effect locality

If a complete verified effect state contains an unsupported drug/Xanax modifier:

- keep `stackCap=1000` available as the general Energy mechanic;
- omit planner-facing Xanax mechanics as required by the existing item projection;
- omit `observedState.xanax`;
- set `xanaxPreparation:false`;
- preserve `UNSUPPORTED_EFFECT` or the existing localized reason.

Do not globally disable unrelated training capabilities.

### 5. Preserve refill semantics

DQ-TRAIN-001I does not alter DQ-TRAIN-001E.

Protect:

```text
point refill -> naturalEnergyMax
NOT
point refill -> stackCap or +naturalEnergyMax into stacked Energy
```

The 1,150E route remains sequential 1,000E training then refill then 150E training.

## Required regressions

Use the frozen `STACK-CAP-FIXTURES-001I.json` unchanged.

### S1 — versioned stack cap

Assert:

- stackCap 1,000 is projected;
- metadata source ID, versioned cache class and configured provenance are present;
- no live API source is falsely attributed.

### S2 — natural max remains distinct

With bars maximum 150:

```text
naturalEnergyMax = 150
stackCap = 1000
```

Assert they never alias or overwrite one another.

### S3 — Xanax adapter enablement

With complete supported effect state:

- `itemMechanics.xanax` contains +250E/+75 Happy;
- `observedState.xanax.energyGain == 250`;
- `observedState.stackCap == 1000`;
- `xanaxPreparation == true`.

Then pass the normalized state through the pure planner with current drug cooldown zero and enough inventory/current state to prove an immediate Xanax candidate can be produced and PR #130's +75 Happy applies.

Do not require the route to be execution-READY if unrelated inventory/freshness evidence is intentionally only planning-grade.

### S4 — dynamic drug effect fails closed

With an unsupported material drug/Xanax modifier:

- stack cap remains available;
- Xanax planner projection is absent;
- `xanaxPreparation == false`;
- localized unsupported reason preserved.

### S5 — mechanic mismatch fails closed

If an injected/configured value is not the frozen 1,000:

- do not accept it as a player override;
- omit authoritative `stackCap`;
- omit `observedState.xanax`;
- `xanaxPreparation == false`;
- return `MECHANIC_VERSION_MISMATCH` or the exact frozen equivalent.

### S6 — no exact future cooldown

Assert enabled Xanax projection contains no fabricated `cooldownSeconds`.

A first immediate Xanax may be modeled. A second future Xanax must not be scheduled without an observed/replanned checkpoint.

### S7 — PR #130 protection

Keep X1–X8 Xanax Happy-effect regressions green:

- immediate +75 exactly once;
- 99,999 cap;
- unknown immediate Happy mechanic fail closed;
- delayed checkpoint no double count;
- missing checkpoint no full forecast;
- Xanax→Ecstasy checkpoint Happy authority;
- legal immediate booster ordering;
- adapter fail-closed logic updated only for the now-resolved stack-cap condition.

### S8 — prior correction protection

Explicitly retain:

- Point refill natural-max correction;
- sequential 1,150E route;
- booster threshold / one-item-overcap semantics;
- legal-before-Pareto frontier behavior;
- ordinaryHappy reference;
- natural Energy regeneration before Xanax;
- 50m partial behavior;
- Balanced ranking;
- cached inventory planning-vs-execution freshness;
- material gym-note fail closed;
- calibration-confidence conservatism.

## Expected code/document scope

Likely:

- `src/training-advisor-adapters.js`
- `tests/training-advisor-adapters.test.js`
- pure planner source only if a real integration defect is found; do not touch it merely to rearrange code
- `docs/TRAINING-ADVISOR-ADAPTERS.md`
- bounded DQ-TRAIN-001I implementation checkpoint
- `docs/divine-knowledge/NOW.md`, chapter index, changelog/open node as needed

Frozen:

- `STACK-CAP-SPEC-001I.md`
- `STACK-CAP-FIXTURES-001I.json`
- existing 001D frozen JSON fixtures
- existing 001A/001C planner fixtures unless a contradiction is demonstrated

If implementation appears to require changing a frozen specification/fixture rather than implementing it, stop and return to [S].

## Explicit exclusions

Do not add:

- Torn API fetching/acquisition;
- runtime Wiki requests;
- TornPDA bridge code;
- userscript UI;
- DOM capture;
- localStorage/GM storage;
- timers/listeners/observers;
- market-provider wiring;
- automatic item use;
- automatic training;
- release metadata.

This pass ends at pure adapter/planner integration.

## Mandatory preflight

Before product edits:

1. verify repository `KingAeon/TornScripture`;
2. verify exact `main` SHA containing merged DQ-TRAIN-001I spec;
3. verify implementation branch starts from that exact SHA;
4. clean working tree;
5. required Node commands available;
6. run relevant baseline tests;
7. confirm full branch-to-main diff can be inspected;
8. confirm branch/PR can be published.

Stop rather than bypassing the executable-workspace requirement.

## Baseline expectation

The last merged product checkpoint after PR #130 reported:

- focused planner+adapter: 141/141;
- repository: 378/378 across 21 suites.

Re-run baseline on the exact post-spec main before edits. Do not assume the count if the repository has moved.

## Required validation

At minimum:

```text
node --check src/training-advisor-adapters.js
node --check tests/training-advisor-adapters.test.js
node --check src/training-advisor-pure.js
node --check tests/training-advisor-pure.test.js
node --test tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js
node --test tests/*.test.js
git diff --check main...HEAD
```

Also:

- parse all changed/new JSON/NDJSON;
- verify all five 001I fixture IDs are executed;
- inspect the complete branch-to-main diff;
- verify no network/storage/UI/userscript files changed.

## Publication and completion report

Publish the finished implementation on one isolated PR and return:

1. exact verified post-spec base SHA;
2. starting implementation branch SHA;
3. resulting head SHA;
4. PR number;
5. exact files changed;
6. S1–S8 red/green/protected results;
7. exact normalized stack-cap metadata;
8. exact Xanax enablement/fail-closed conditions;
9. proof no future cooldown is fabricated;
10. focused/full validation commands and counts;
11. schema changes, if any;
12. network/storage/listener/timer/UI effects;
13. remaining limitations;
14. rollback;
15. explicit unmerged/unreleased statement.

Do not merge. Return to independent [V].
