# DQ-TRAIN-001E — Work Transfer Handoff: Point Refill Semantics Correction

Status: **OWNER-AUTHORIZED [B][BUG]; PRODUCT EDITS BLOCKED IN CURRENT CHAT BY EXECUTABLE-WORKSPACE PREFLIGHT FAILURE; RESUME IN WORK**

Prepared: 2026-09-26

Repository: `KingAeon/TornScripture`

Authorized base:

`main@37fe611cfeb58bf812272eef18c5d69eb9952d01`

Dedicated branch:

`agent/training-refill-semantics-correction-001e`

Do not merge, release, delete the branch, or modify unrelated runtime behavior.

## Owner authorization

The owner explicitly authorized:

> [B][BUG] bounded refill-semantics correction of the frozen fixture + pure planner, followed by [V] re-verification.

This authorization is limited to the refill-semantics defect described below plus the minimum documentation/tests needed to preserve the corrected contract.

## Mandatory executable-workspace preflight

Before product edits, satisfy root `AGENTS.md`:

- fully materialized checkout;
- exact main/base SHA verified;
- branch head verified;
- clean working tree;
- Node/test commands available;
- baseline relevant tests run;
- complete diff inspection available;
- publish capability available.

Current chat attempted:

```text
git clone https://github.com/KingAeon/TornScripture.git
```

and received:

```text
Could not resolve host: github.com
```

Therefore no product/runtime/test file was edited from the current chat. A GitHub connector is not a substitute for the required executable workspace.

## Blocking defect

The original source audit records that the daily Points Energy refill fills the bar to the player's natural Energy maximum, rather than adding a full natural bar onto stacked Energy.

Current merged `src/training-advisor-pure.js::generateEnergyCandidates()` instead implements:

```text
energyAfter = min(stackCap, energy + naturalEnergyMax)
```

and emits both a direct additive `REFILL` candidate and a combined pre-training `XANAX_REFILL` candidate.

The frozen DQ-TRAIN-001C `REFILL_CAP_001` strategy fixture encodes the same incorrect transformation:

```text
900E + 150 nominal refill -> 1000E
```

The PR #123 verification correction also added a regression test that explicitly accepts:

```text
600E -> Xanax -> 850E -> refill -> 1000E
```

That path must be removed/superseded.

## Correct semantic direction

### Ordinary refill

When a daily Points refill is legally usable below the natural maximum:

```text
energyAfter = naturalEnergyMax
energyObtained = naturalEnergyMax - energyBefore
```

Do not generate a refill that increases a player already at or above natural Energy maximum.

### Optimized Happy Jump

A 1,150E jump is sequential:

```text
prepare/stack to 1000E
Happy preparation
Ecstasy
TRAIN stacked 1000E
USE_REFILL when legally refillable
VERIFY_STATE
TRAIN ordinary 150E refill
```

It is not:

```text
stack -> add 150 refill before training -> cap at 1000
```

The second training phase must continue from the first phase's modeled Happy and stat state.

## Required code/spec correction

Bounded scope:

1. supersede the frozen `REFILL_CAP_001` fixture instead of silently retaining its incorrect meaning;
2. add a direct refill fixture proving e.g. 50E -> 150E, not 200E;
3. add a fixture proving no pre-training refill candidate exists when Energy is already above natural maximum, e.g. 900E;
4. remove `XANAX_REFILL` pre-stack generation;
5. remove/replace the existing regression test `finite combined Xanax and refill checkpoint reaches stack cap`;
6. preserve ordinary `USE_REFILL` as an advisory action;
7. add a sequential refill-assisted plan path that can represent TRAIN -> USE_REFILL -> VERIFY_STATE -> TRAIN;
8. preserve sequential stat mutation and Happy loss between the first and second training segments;
9. preserve point consumption/economics and readiness/freshness gates;
10. preserve advisory-only behavior and all other planner objective/ranking semantics;
11. update Divine Knowledge with the correction result and explicit supersession of the incorrect fixture semantics.

## Implementation design constraint

Do not force the sequential refill phase into `generateEnergyCandidates()` as though it were another pre-training Energy state.

Preferred architectural direction:

- `generateEnergyCandidates()` continues to describe pre-first-training Energy preparation;
- direct Point-refill candidate is only valid when initial Energy is below natural maximum and should normalize to natural maximum;
- post-stack refill is represented as an additional sequential plan phase/action after the first TRAIN;
- the simulation must explicitly model both TRAIN segments in order.

If the existing `composePlan()` shape cannot represent two TRAIN phases without a bounded extension, make the smallest coherent extension and keep the action contract unchanged.

## Required regression cases

At minimum create initially failing tests for:

### R1 — refill fills to natural max

```text
start Energy 50
natural max 150
refill available
=> refill candidate ends at 150
=> Energy obtained 100
```

### R2 — no refill above natural max

```text
start Energy 900
natural max 150
stack cap 1000
refill available
=> no pre-training REFILL candidate
```

### R3 — no combined Xanax + refill stack

```text
start Energy 600
Xanax +250
refill available
=> no candidate that reaches 1000 by TAKE_XANAX + USE_REFILL before training
```

### R4 — 1,150E sequential Happy Jump

Synthetic but planner-realistic:

```text
1000E
ordinary Happy 4275
5 eDVD -> 16775
Ecstasy -> 33550
TRAIN 100 x 10E
USE_REFILL
VERIFY_STATE
TRAIN 15 x 10E
```

Assertions:

- first train count 100;
- refill appears after first TRAIN;
- second train count 15;
- total Energy spent 1150;
- point consumption counted once;
- final Happy equals sequential simulation across all 115 internal 10E trains on the central path;
- final stat equals sequential simulation across both segments;
- fingerprint remains deterministic;
- readiness remains advisory and respects refill availability/freshness.

### R5 — refill unavailable

```text
pointRefill.allowed = false
=> no refill phase/candidate
```

### R6 — point quantity/economics unknown

Preserve existing fail-closed behavior: if point quantity/value needed by the selected objective is unknown, do not invent it.

## Protected regressions

Do not regress:

- 001A math fixtures;
- Balanced knee policy;
- ordinaryHappy usefulness reference;
- Xanax cooldown checkpoint behavior;
- booster remaining-capacity correction;
- natural Energy regeneration before Xanax;
- execution freshness gates;
- 50M partial behavior;
- unknown-value booster behavior;
- BALANCED_STATS abstention;
- deterministic central projection N=0/R=5;
- frozen `candidate_not_live_calibrated` kernel metadata;
- no API/DOM/UI/storage/network/listener/timer/gameplay behavior.

## Expected files

Likely:

- `src/training-advisor-pure.js`
- `tests/training-advisor-pure.test.js`
- `docs/divine-knowledge/chapters/dq-train-001/PLANNER-STRATEGY-FIXTURES-001C.json`
- bounded DQ-TRAIN-001 correction/verification documentation
- `docs/divine-knowledge/NOW.md`, chapter/domain indices, changelog as needed

Do not touch userscript files.

## Validation

Run:

```text
node --check src/training-advisor-pure.js
node --check tests/training-advisor-pure.test.js
<focused training-advisor test command>
<full repository Node test command>
git diff --check main...HEAD
```

Report exact commands and counts.

Also inspect the complete branch-to-main diff.

## Required completion report

Return:

1. verified base SHA and starting branch SHA;
2. resulting head SHA;
3. exact files changed;
4. which refill bug cases reproduced before correction;
5. corrected semantics;
6. focused + full test commands/results;
7. any changes to planner action/schema contracts;
8. storage/network/listener/timer/runtime effects;
9. remaining manual/integration limitations;
10. rollback commit;
11. explicit statement that branch/PR remains unmerged and unreleased.

After build completion, return to **[V] independent re-verification** before any merge decision.
