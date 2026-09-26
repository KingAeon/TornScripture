# DQ-TRAIN-001 — Point Refill Semantics Erratum Candidate

Status: **BLOCKING CORRECTION REQUIRED BEFORE DQ-TRAIN-001D FREEZE OR ADAPTER BUILD**

Discovered: 2026-09-26 during DQ-TRAIN-001D specification verification.

Affected merged baseline:

- DQ-TRAIN-001C frozen strategy fixture;
- PR #123 pure planner on `main`;
- PR #123 verification correction that added a Xanax + refill preparation route.

No product correction is authorized by this document.

## 1. Contradiction

The original training source audit correctly recorded:

> A daily points refill fills to natural maximum, rather than adding a full bar unconditionally.

Current Torn Wiki Energy documentation, rechecked 2026-09-26, likewise states that a Point refill fills the Energy bar **up to its maximum**. The same page distinguishes natural maximum from the global 1,000 stacked-Energy cap.

Current Happy Jump guidance also treats the point refill as a **post-stack training refill**: train the stacked Energy, refill the ordinary bar, then train the additional ordinary bar.

However, the frozen DQ-TRAIN-001C strategy fixture `REFILL_CAP_001` currently models:

```text
energyBefore = 900
naturalEnergyMax = 150
stackCap = 1000
refill -> energyAfter = 1000
discardedEnergy = 50
```

That treats a Point refill as "+150 Energy, capped at 1,000" rather than "fill the ordinary Energy bar up to its natural maximum."

## 2. Merged implementation impact

`src/training-advisor-pure.js::generateEnergyCandidates()` currently implements the same mistaken semantics:

```text
after = min(stackCap, energy + naturalEnergyMax)
```

and can emit a combined `XANAX_REFILL` preparation candidate.

The PR #123 verification correction explicitly added a synthetic route equivalent to:

```text
600E + 250E Xanax + 150E refill -> 1000E
```

Under the source-backed refill semantics this is not a valid preparation transformation.

## 3. Why this is blocking

The defect can affect:

- generated Energy-preparation candidates;
- Maximum Gain and other objective ranking;
- point-refill opportunity cost;
- discarded-Energy accounting;
- readiness/action ordering;
- Happy Jump total Energy.

The error is not limited to adapter normalization. The frozen strategy fixture and merged pure planner encode the same wrong state transition.

Therefore DQ-TRAIN-001D MUST NOT freeze a runtime adapter contract that feeds `pointRefill.allowed` into the current refill path as though the planner semantics were correct.

## 4. Correct semantic direction

The correction should preserve the established source distinction:

### Ordinary refill

When a refill is legally usable below the natural maximum:

```text
energyAfter = naturalEnergyMax
energyObtained = naturalEnergyMax - energyBefore
```

It is not:

```text
energyAfter = min(stackCap, energyBefore + naturalEnergyMax)
```

A player already stacked above the natural maximum must not receive a pre-training "+150" refill candidate.

### Optimized Happy Jump

The common 1,150E Happy Jump is a sequential execution plan:

```text
stack Energy
prepare Happy
take Ecstasy
TRAIN stacked Energy
USE_REFILL after the bar is emptied / legally refillable
VERIFY_STATE
TRAIN the refilled ordinary Energy
```

The 150E refill is an additional **post-training phase**, not part of the pre-training stack.

This requires preserving sequential Happy mutation across both training phases.

## 5. Required specification correction

Do not silently edit the frozen fixture.

A bounded owner-authorized correction should:

1. supersede `REFILL_CAP_001`;
2. add a refill-to-natural-maximum fixture, for example 50E -> 150E;
3. add an above-natural-cap fixture proving no pre-training Point-refill candidate at 900E;
4. add a sequential Happy-Jump fixture proving 1000E training -> refill -> 150E training, with Happy updated through both phases;
5. remove the invalid `XANAX_REFILL` pre-stack composition path;
6. preserve explicit `USE_REFILL` as an advisory action;
7. preserve point/refill economics and availability semantics;
8. rerun complete pure-planner verification after correction.

## 6. DQ-TRAIN-001D consequence

The live `/user/refills` source proof remains useful:

- the API boolean polarity is resolved;
- `false` means the daily refill is unused/available;
- `true` means it has been used.

What is blocked is the **planner transformation after availability is known**.

Other 001D source proofs remain valid:

- bars;
- cooldowns;
- battlestats;
- active gym/catalog join;
- gain-perk normalization;
- planning inventory;
- base item mechanic registry.

## 7. Stop condition

Do not implement adapters or merge/freeze PR #124 as an adapter-build gate until the refill semantics correction is approved, implemented, and re-verified.

The next required owner decision is authorization for a bounded DQ-TRAIN-001 refill-semantics specification + planner correction.
