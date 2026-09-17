# DQ-TRAIN-001A — Training Math Engine Contract

Status: **FROZEN SPECIFICATION; NOT LIVE-CALIBRATED; NO PRODUCT IMPLEMENTATION AUTHORIZED**

Frozen: 2026-09-14 by owner instruction.
Research basis: `RESEARCH-2026-09-14.md`.
Fixture set: `MATH-ENGINE-FIXTURES-001A.json`.

## Purpose

Define a small, deterministic, versioned arithmetic kernel for TornScriptures battle-stat training. The kernel exists so formula candidates, rounding behavior, sequential training, modifier handling, and later live observations can be compared without mixing them with API access, DOM state, market data, scheduling, storage, UI, or gameplay actions.

This freeze is a contract freeze, not a claim that the candidate formula reproduces Torn's current server implementation. Model promotion requires DQ-TRAIN-001B calibration.

## Hard boundary

The Training Math Engine MUST be pure for a given input object. It MUST NOT:

- read Torn API, DOM, storage, cookies, local time, inventory, prices, or cooldowns;
- generate random numbers;
- infer player perks, gym, Happy, energy, or stat values;
- buy, consume, take drugs, refill, train, navigate, or perform gameplay actions;
- rank Happy Jump strategies or schedule consumables;
- hide unsupported mechanics behind silent defaults.

All mutable/live state is normalized by later layers before invoking this kernel.

## Frozen model registry

### `vladar-v2-pre50m-v1`

State: **candidate_not_live_calibrated**.

This profile reproduces the publicly documented Vladar V2 arithmetic for deterministic comparison fixtures. It is bounded to a trained-stat value of 50,000,000 or less. The 2022 removal of Torn's 50m gain cap means this profile MUST NOT clamp or extrapolate a value above 50m. Above-domain input returns `OUT_OF_MODEL_DOMAIN`.

The profile does not establish Torn server truth. A later model may supersede it without breaking the engine contract because `modelId` is explicit and versioned.

## Input contract

A simulation request is a serializable object with these fields:

```json
{
  "modelId": "vladar-v2-pre50m-v1",
  "stat": { "kind": "defense", "value": 100000 },
  "happy": 1000,
  "gym": { "dots": 4.0, "energyPerTrain": 10 },
  "gainPerks": [
    { "id": "education", "rate": 0.02 },
    { "id": "faction", "rate": 0.15 }
  ],
  "trainCount": 3,
  "randomness": {
    "gainNoise": [0, 0, 0],
    "happyLossRoll": [4, 5, 6]
  }
}
```

### Field rules

- `modelId` is required and must name a supported versioned model.
- `stat.kind` is one of `strength`, `speed`, `defense`, `dexterity`.
- `stat.value` is finite and nonnegative. This frozen model accepts values through exactly 50,000,000.
- `happy` is an integer from 0 through 99,999.
- `gym.dots` uses the familiar normalized 0–10-style gym scale, not the API's ten-times display value. It must be finite and nonnegative.
- `gym.energyPerTrain` is a positive integer representing one internal train.
- `gainPerks` contains explicit gain multipliers only. IDs must be unique. Each finite `rate` must be greater than -1. The engine sorts entries lexicographically by `id` before multiplication so output is deterministic across callers.
- `trainCount` is a nonnegative integer.
- `randomness.gainNoise` and `randomness.happyLossRoll` contain exactly `trainCount` entries. The engine never invents missing random values.
- Each `gainNoise[i]` is an integer inside the stat-specific inclusive Vladar V2 range `[-C,+C]`.
- Each `happyLossRoll[i]` is exactly integer 4, 5, or 6.

Unsupported special effects, including any effect whose exact placement or rounding is not yet frozen, must fail visibly with `UNSUPPORTED_EFFECT`. Fitness Center's Happy-loss reduction is specifically outside this v1 contract pending DQ-TRAIN-001B validation.

## Candidate arithmetic profile

For each internal train, using current stat `S`, current Happy `H`, normalized gym dots `G`, energy per train `E`, explicit noise `N`, and canonicalized perk rates `p_i`:

```text
L1 = ROUND_HALF_UP( ln(1 + H / 250), 4 )
L2 = ROUND_HALF_UP( 1 + 0.07 * L1, 4 )

B = S * L2
    + 8 * H^1.05
    + (1 - (H / 99999)^2) * A
    + B_stat
    + N

perkMultiplier = PRODUCT(1 + p_i)

gain = B * (1 / 200000) * G * E * perkMultiplier
```

Stat constants for this candidate profile:

| Stat | A | B_stat | C noise bound |
|---|---:|---:|---:|
| strength | 1600 | 1700 | 700 |
| speed | 1600 | 2000 | 1350 |
| dexterity | 1800 | 1500 | 1000 |
| defense | 2100 | -600 | 1500 |

No presentation rounding is applied to `gain` inside the kernel.

### Happy loss and sequential update

For explicit loss roll `R`:

```text
happyLoss = ROUND_HALF_UP(0.1 * E * R, 0)
```

A multi-train request is evaluated in strict sequence:

```text
for each internal train:
  compute gain from current S and current H
  S = S + gain
  happyLoss = explicit loss for this train
  H = max(0, H - happyLoss)
```

A batch MUST NOT be approximated as `firstTrainGain * trainCount`.

## Rounding policy

The frozen fixture arithmetic profile uses decimal round-half-up only at the explicit Vladar rounding stages above. This is a reproducibility rule for the candidate model, not a claim that every Torn rounding site uses the same rule.

The exact tie behavior of the nested four-decimal Torn calculation has not been live-verified. The deterministic fixture set intentionally avoids exact four-decimal halfway cases. The 25-energy Happy-loss fixture deliberately covers `12.5 -> 13` for the candidate model.

Implementations may use ordinary binary floating point internally if every frozen fixture remains within the declared tolerance. They must not introduce extra intermediate rounding merely to make fixtures pass.

## Output contract

Successful evaluation returns a serializable result shaped conceptually as:

```json
{
  "status": "ok",
  "model": {
    "id": "vladar-v2-pre50m-v1",
    "status": "candidate_not_live_calibrated"
  },
  "start": { "stat": 100000, "happy": 1000 },
  "end": { "stat": 100074.4117689, "happy": 985 },
  "totalGain": 74.4117689,
  "energySpent": 30,
  "trains": [
    {
      "index": 0,
      "statBefore": 100000,
      "happyBefore": 1000,
      "gainNoise": 0,
      "gain": 24.8140181,
      "statAfter": 100024.8140181,
      "happyLossRoll": 4,
      "happyLoss": 4,
      "happyAfter": 996
    }
  ],
  "warnings": [],
  "assumptions": []
}
```

The fixture file stores high-precision expected decimals as strings. Product/UI layers may format them later; the kernel contract does not prescribe display precision.

## Status and error semantics

The top-level status is one of:

- `ok` — the request was evaluated under the named model;
- `unsupported` — valid-shaped input requests a mechanic outside the model's calibrated/specification domain;
- `invalid` — malformed or internally inconsistent input.

Stable reason codes frozen for v1:

- `UNSUPPORTED_MODEL`
- `OUT_OF_MODEL_DOMAIN`
- `UNSUPPORTED_EFFECT`
- `INVALID_INPUT`

Invalid and unsupported results MUST NOT return a fabricated projected gain.

## Determinism requirements

For identical normalized input, an implementation must return equivalent arithmetic output independent of:

- wall clock or timezone;
- network/API availability;
- DOM/page state;
- object insertion order for `gainPerks`;
- device/browser locale;
- random-number generator state.

Randomness is data, not behavior, in this kernel. Probability distributions and expected-value simulation belong to a later layer.

## Fixture contract

`MATH-ENGINE-FIXTURES-001A.json` is normative for arithmetic correctness of this frozen contract. It includes:

- all four stat constant families;
- zero and maximum Happy boundaries;
- nested Happy multiplier checkpoints;
- explicit noise extrema;
- multiplicative perk handling;
- the exact 50m supported boundary;
- explicit Happy-loss rounding cases;
- sequential multi-train state mutation;
- zero-train identity behavior;
- above-50m fail-closed behavior.

Expected decimal strings are compared numerically with both absolute and relative tolerance from the fixture header. String identity is not required.

Passing these fixtures proves contract arithmetic only. It does not prove that the candidate model predicts Torn accurately.

## Explicitly deferred to DQ-TRAIN-001B or later

- live player calibration and model selection;
- current post-50m gain function;
- Fitness Center and other Happy-loss modifier ordering/rounding;
- unsupported or ambiguous gain modifiers;
- probabilistic gain/Happy-loss distributions and confidence intervals;
- overdose probability and risk-adjusted strategy value;
- candy/eDVD/Ecstasy/Xanax/refill timeline simulation;
- booster/drug cooldown boundary behavior;
- inventory, prices, budgets, and opportunity-cost ranking;
- Torn API normalization and freshness;
- Happy Jump Navigator UI and recommendations.

## Acceptance gate for any future implementation

An implementation is not eligible for product integration merely because it compiles. Before the engine can be treated as implemented:

1. every frozen deterministic fixture must pass independently;
2. unsupported-domain inputs must fail closed with the correct reason code;
3. there must be no network, DOM, storage, clock, or RNG dependency in the pure kernel;
4. repeated identical inputs must be stable;
5. no live-calibration claim may be added until DQ-TRAIN-001B evidence supports it;
6. any model change that alters frozen fixture output requires a new `modelId` or an explicit specification supersession.

This document freezes DQ-TRAIN-001A only. It does not authorize product code, UI, networking, gameplay automation, release, or merge.