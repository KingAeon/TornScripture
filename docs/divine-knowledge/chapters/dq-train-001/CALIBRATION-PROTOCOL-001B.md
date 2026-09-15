# DQ-TRAIN-001B — Live Training Calibration Protocol

Status: **FROZEN SPECIFICATION; EVIDENCE COLLECTION NOT YET COMPLETE**

Frozen: 2026-09-14 by owner `[S]` instruction.
Depends on: `MATH-ENGINE-SPEC-001A.md` and `MATH-ENGINE-FIXTURES-001A.json`.

## Mission

Determine how well candidate Torn gym-training models reproduce current live Torn behavior inside explicitly observed domains, without spending extra resources solely for research and without allowing ordinary randomness, UI rounding, or capture mistakes to masquerade as model error.

DQ-TRAIN-001B calibrates and selects models. It does not implement the Training Advisor, optimize Happy Jump recipes, automate data capture, or authorize gameplay actions.

## Hard boundaries

- Use routine player-planned training wherever possible. Do not buy boosters, take drugs, change gyms, or waste energy merely to satisfy the research matrix.
- The player performs every train manually through Torn.
- No background DOM watcher, automatic train request, synthetic click, or unattended gameplay request is authorized.
- Raw personal observations remain local/chat-session evidence unless the owner explicitly chooses otherwise. Divine Knowledge stores only synthetic vectors, protocol text, and aggregate/nonidentifying conclusions.
- A model is never promoted beyond the stat, Happy, gym, perk, and special-effect ranges actually supported by evidence.
- Passing DQ-TRAIN-001A fixtures proves arithmetic reproduction only. DQ-TRAIN-001B is the separate live-fidelity gate.

## Candidate models

### Primary candidate

`vladar-v2-pre50m-v1` from DQ-TRAIN-001A.

- trained-stat domain: 0 through exactly 50,000,000;
- explicit stat-specific gain-noise range;
- sequential internal trains;
- explicit Happy-loss rolls;
- unsupported effects fail closed.

### Comparison model

The public logarithmic formula currently shown on the official Torn Wiki is retained as a comparison model only. It is not server code and is not automatically eligible for product use. Calibration may compare its absolute prediction error with the primary candidate to detect whether the later model actually improves live fit in the observed region.

A new product `modelId` requires a separate specification decision if arithmetic differs from the frozen 001A model.

## Evidence classes

### Class S — single internal train

This is the primary calibration evidence. `trainCount = 1` allows the observed gain to be mapped directly to an inferred candidate-model gain-noise interval.

### Class B — batch train

Two or more internal trains in one Torn request. Use only after Class S evidence has survived initial falsification. Batch observations validate sequential state mutation and aggregate envelopes; they cannot identify every internal random draw from total gain alone.

### Class H — naturally occurring elevated-Happy train

A Class S or B observation collected during a Happy Jump or other already-planned high-Happy event. No extra consumables are used solely to create this evidence.

### Class X — special-effect / boundary evidence

Fitness Center Happy-loss reduction, unusual company/property/book effects, post-50m stats, or other mechanics outside the primary model. Keep separate from ordinary model-fit evidence until the mechanic has its own placement/rounding specification.

## Primary Class S capture protocol

For a routine planned train:

1. Use Torn's repeat quantity of exactly **1**.
2. Prefer a trained stat at or below 50,000,000 when testing `vladar-v2-pre50m-v1`.
3. Record the trained stat, displayed stat value, current Happy, current Energy, gym identity, normalized gym dots for that stat, energy cost per train, and every known gym-gain modifier.
4. Record any active special effect that could change gain or Happy loss. If its exact behavior is not frozen, mark the observation `special_effect_present`; it is Class X, not ordinary Class S evidence.
5. Do not let a quarter-hour Happy tick occur between the before-state capture and the train result. A convenient manual safety window is approximately minute `:02–:13`, `:17–:28`, `:32–:43`, or `:47–:58` of the hour. This is a capture convenience, not a Torn mechanic.
6. Manually perform exactly one train.
7. Record the gym success-message gain exactly as displayed, ending Happy, and ending Energy. Do not rewrite the displayed gain with extra zeroes or inferred precision.
8. Record whether any other action occurred between the before-state and result capture. If yes, mark the observation ineligible until reviewed.

A screenshot containing the before state and/or success message may support transcription, but screenshots are not required and are not committed to Divine Knowledge by default.

## Display precision and observation interval

The official Gym patch history records that gym gains were changed to display two decimal places in 2020. The official Battle Stats page records that site-wide battle-stat display without decimals is rounded down. These are presentation rules, not proof of internal storage precision. Therefore live UI values are observations with display quantization, not exact internal values.

Until current gym-gain display rounding/truncation is independently proven, a gain displayed as `D` with two decimal places is conservatively represented by:

```text
observedGainInterval = [D - 0.01, D + 0.01]
```

This deliberately covers ordinary nearest-cent rounding and truncation-style presentation. It is wider than mathematically necessary, by design. A later verified display rule may narrow the interval without changing the underlying live observation.

Displayed whole-number pre-train stat values are accepted for initial calibration. Any sub-unit uncertainty in `S` must be propagated or shown negligible relative to the two-decimal gain observation before claiming high precision.

## Inferred-noise falsification test

For one Class S observation under the 001A candidate, let:

```text
K = (G * E * perkMultiplier) / 200000
B0 = candidate bracket before the +N gain-noise term
```

For observed gain interval `[gLo, gHi]`:

```text
inferredNoiseInterval = [gLo / K - B0, gHi / K - B0]
```

using the same normalized gym dots, energy, Happy, trained stat, and canonical perk multiplier as the candidate model.

Let the candidate stat-specific noise bound be `[-C,+C]`.

- If `inferredNoiseInterval` intersects `[-C,+C]`, that observation is **compatible** with the candidate.
- If the intervals are disjoint, the observation is a **candidate contradiction** and must be checked for capture, modifier, gym-dot, reset-boundary, and display mistakes.
- A contradiction that survives data-quality review is a **confirmed contradiction**. Do not hide it by widening `C` or changing rounding ad hoc.

The inferred noise interval midpoint may be normalized by `C` for aggregate diagnostics, but the protocol does not assume a uniform random distribution unless evidence establishes one.

## Happy-loss validation

For one train, ending Happy does not affect that train's gain, so gain-model calibration and Happy-loss validation are recorded separately.

Under the 001A candidate:

```text
happyLoss = ROUND_HALF_UP(0.1 * E * R)
R ∈ {4,5,6}
```

Useful discriminating energy costs:

- 5E -> loss 2, 3, or 3; rolls 5 and 6 are observationally ambiguous.
- 10E -> loss 4, 5, or 6; all three rolls are distinguishable.
- 25E -> loss 10, 13, or 15; all three rolls are distinguishable and exercise the 12.5 -> 13 candidate rounding boundary.

A quarter-hour Happy tick, consumable, property change, or special reduced-Happy-loss effect makes an ordinary Happy-loss observation ineligible unless modeled explicitly.

## Batch validation

After single-train evidence survives initial falsification, Class B observations test the sequential rule.

For each batch, the analysis layer must use starting stat/Happy, train count, energy per train, gym, perks, and all allowed internal Happy-loss/noise possibilities to produce a candidate aggregate gain envelope. It must update stat and Happy after every hypothetical internal train. It must not use `firstTrainGain * trainCount`.

A batch result outside the full candidate envelope is a contradiction after data-quality review. A batch result inside the envelope is compatible, but does not identify the hidden internal random sequence.

## Coverage ladder

Coverage is progressive. Missing coverage narrows the claim; it does not justify extra spending.

### B1 — smoke/falsification set

Target: 12 eligible Class S observations from routine training.

Purpose: catch gross model, modifier, gym-dot, normalization, display, or arithmetic errors before collecting a larger set. Prefer more than one Happy level when ordinary play naturally provides it. One trained stat is acceptable for this first gate.

Any candidate contradiction is reviewed. B1 does not promote the model to calibrated status.

### B2 — stat-family calibration

Target: at least 8 eligible Class S observations for each of Strength, Speed, Defense, and Dexterity, collected from the owner and/or consenting faction volunteers during normal play.

The final claim may be narrower if some stat families lack evidence. Never infer unobserved stat-family fidelity from another stat.

Across the evidence pool, seek variation in Happy and gym dots when it occurs naturally. Do not change a player's training plan solely to create variation.

### B3 — elevated-Happy calibration

Target: at least 8 eligible Class H single-train observations from real, already-planned elevated-Happy sessions, ideally covering at least two stat families.

If unavailable, high-Happy remains explicitly uncalibrated. This does not block low/normal-Happy calibration.

### B4 — sequential batch validation

Target: at least 8 eligible Class B observations after B1 survives, with batch sizes greater than one. These validate aggregate sequential behavior only.

### B5 — special boundaries

Separate evidence lanes for Fitness Center/reduced Happy loss, ambiguous gain modifiers, and >50m stats. These do not contaminate the ordinary pre50m calibration pool.

## Aggregate diagnostics

For each candidate model and observed domain, report at minimum:

- eligible observation count;
- candidate and confirmed contradiction count;
- inferred-noise intervals and normalized midpoints for the Vladar candidate;
- residual or inferred-noise behavior grouped by stat, Happy band, gym, and relevant perk configuration when sample size permits;
- visible systematic drift with Happy or stat size;
- comparison-model absolute error using the same display-quantization policy;
- batch envelope coverage;
- exact evidence domain: min/max stat, Happy range, gym-dot range, stats represented, perk configurations, and special effects excluded.

Do not publish false p-values or confidence intervals from tiny convenience samples. Statistical thresholds may be frozen only after enough observations exist to estimate actual residual behavior; they must not be chosen retroactively to make a favored model pass.

## Model-state transitions

Allowed evidence states:

- `candidate_not_live_calibrated`
- `live_spot_checked`
- `calibrated_observed_domain`
- `contradicted_under_review`
- `rejected_for_observed_domain`
- `superseded`

`vladar-v2-pre50m-v1` may move to `live_spot_checked` after B1 if no confirmed contradiction remains. It may move to `calibrated_observed_domain` only after the evidence domain and residual behavior are documented and the owner accepts the bounded claim. This status never implies post-50m or untested special-effect validity.

A confirmed contradiction does not automatically prove the comparison model correct.

## Data-quality exclusions

Exclude or quarantine an observation when any of these apply:

- train count uncertain;
- quarter-hour Happy tick crossed the capture;
- gym or trained stat uncertain;
- an unknown gain modifier or special effect may be active;
- before/after Happy or displayed gain was transcribed ambiguously;
- another train, consumable, drug, refill, property/job/faction change, or other relevant action occurred between snapshots;
- candidate model is asked outside its domain;
- normalized gym-dot scale is uncertain (API ten-times scale confusion is specifically guarded against).

Quarantined evidence may be re-admitted after the missing fact is resolved. Do not silently discard contradictory evidence solely because it is inconvenient.

## Tool choice

DQ-TRAIN-001B evidence analysis may be performed in chat with deterministic calculations and repository documentation. GitHub remains the canonical durable knowledge store. Codex/Work is not required for protocol definition or early observation analysis and should remain reserved until implementation/testing complexity justifies it.

## Manual gate and first live action

The first live gate is intentionally small: collect **one ordinary Class S observation** during a train the player was going to perform anyway, using the observation schema in `CALIBRATION-OBSERVATION-SCHEMA-001B.json`.

After the first observation, validate the transcription and analysis pipeline before accumulating the full B1 set. If the schema is awkward in real use, change the capture schema before gathering dozens of observations; do not change the frozen 001A arithmetic merely because the capture workflow needs improvement.

DQ-TRAIN-001B remains open until live evidence has been collected, analyzed, and a bounded model-state decision has been recorded.
