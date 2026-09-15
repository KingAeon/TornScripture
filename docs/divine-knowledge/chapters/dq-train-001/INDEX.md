# DQ-TRAIN-001 — Battle-Stat Training and Happy Jump Optimization

State: **DQ-TRAIN-001A FROZEN; DQ-TRAIN-001B PROTOCOL FROZEN; LIVE EVIDENCE COLLECTION OPEN**

## Canonical reading order

1. [2026-09-14 source audit](RESEARCH-2026-09-14.md) — provenance, corrections, uncertainty, and calibration gates.
2. [DQ-TRAIN-001A Training Math Engine Contract](MATH-ENGINE-SPEC-001A.md) — frozen pure-kernel boundary and arithmetic profile.
3. [`MATH-ENGINE-FIXTURES-001A.json`](MATH-ENGINE-FIXTURES-001A.json) — normative deterministic arithmetic fixtures.
4. [DQ-TRAIN-001B Live Training Calibration Protocol](CALIBRATION-PROTOCOL-001B.md) — frozen live-fidelity evidence plan.
5. [`CALIBRATION-OBSERVATION-SCHEMA-001B.json`](CALIBRATION-OBSERVATION-SCHEMA-001B.json) — raw/local observation shape and derived-analysis contract.

The source audit supersedes the preliminary research snapshot from PR #118 wherever they conflict. In particular, no public formula is promoted to Torn server truth, no universal diminishing-return claim is retained, and no above-50m extrapolation is silently accepted.

## Discovery question

How can TornScriptures accurately predict and optimize battle-stat training for a specific player, including Happy Jumps and alternative strategies, while remaining newbie-friendly, faction-shareable, transparent, and advisory?

## Owner-approved outcome

The desired product should answer:

> Given this player's current state, inventory, budget, available gym, perks, and activity window, what should they do next, why, and what improvement should they expect now and over time?

The beginner surface should reduce this to a safe next-action sequence. An advanced surface may expose formulas, costs, assumptions, alternatives, sensitivity, model status, and prediction error.

Working label: **TornScriptures Training Advisor**, with **Happy Jump Navigator** as its first major feature. These labels remain working names.

## DQ-TRAIN-001A frozen result

The first layer is specified as a pure, deterministic, versioned Training Math Engine.

Locked characteristics:

- no network, API, DOM, storage, clock, price, inventory, scheduler, UI, or gameplay dependency;
- no internal RNG; random gain noise and Happy-loss rolls are explicit inputs;
- one-click batches are evaluated as sequential internal trains with stat and Happy updated after every train;
- gain modifiers are explicit and multiplicative, with a canonical stable ordering for deterministic cross-runtime output;
- the first arithmetic profile is named `vladar-v2-pre50m-v1` and remains `candidate_not_live_calibrated`;
- the candidate model accepts trained-stat values through exactly 50,000,000 and fails closed above that boundary rather than clamping or extrapolating;
- unsupported special effects fail visibly rather than being approximated;
- high-precision deterministic fixture expectations are stored as decimal strings with numeric tolerances;
- passing fixtures proves contract arithmetic only, not prediction accuracy against live Torn.

## DQ-TRAIN-001B frozen protocol

Live calibration now has a separate bounded contract.

Primary evidence is a **single internal train** performed manually during normal planned play. Current Torn gym success messages expose gains to two decimal places, so displayed gains are treated as quantized observations rather than exact internal arithmetic. Until the display rounding rule is independently proven, the protocol conservatively interprets a displayed gain `D` as `[D-0.01,D+0.01]`.

For the Vladar candidate, each eligible single-train observation is inverted into an `inferredNoiseInterval`. If that interval cannot intersect the stat-specific `[-C,+C]` range after data-quality review, the observation is a confirmed contradiction rather than something to explain away by silently widening the model.

Evidence classes are separated:

- **S** — one internal train; primary formula-calibration evidence;
- **B** — multi-train batch; validates sequential aggregate envelopes after single-train calibration;
- **H** — naturally occurring elevated-Happy observation during an already-planned session;
- **X** — special effects or boundaries such as Fitness Center or post-50m behavior.

The first live gate is one ordinary Class-S observation. After the capture/analysis pipeline is validated, B1 expands to 12 eligible Class-S observations. B1 is a smoke/falsification set only and cannot by itself promote the model to calibrated status.

Raw personal observations remain local/chat evidence by default. Divine Knowledge stores the protocol, synthetic shapes, and aggregate/nonidentifying conclusions.

## Calibration progression

- **B1:** 12 eligible routine Class-S observations; gross falsification and capture validation.
- **B2:** target at least 8 eligible Class-S observations per stat family for faction-capable coverage; claims remain narrower when coverage is missing.
- **B3:** target at least 8 naturally occurring elevated-Happy single trains, ideally across two stat families; no extra boosters solely for research.
- **B4:** target at least 8 multi-train batches after B1 survives; test sequential aggregate envelopes.
- **B5:** separate lanes for Fitness Center/reduced Happy loss, ambiguous gain modifiers, and post-50m behavior.

Model states may advance from `candidate_not_live_calibrated` to `live_spot_checked` and then `calibrated_observed_domain`, or move to contradiction/rejection states. A bounded calibration claim never implies untested stat, Happy, perk, gym, special-effect, or post-50m validity.

## Still unresolved

Important unresolved mechanics include:

- current post-50m training behavior;
- exact placement and rounding of Fitness Center and other Happy-loss modifiers;
- ambiguous or unsupported gain modifiers;
- probability distributions and risk-adjusted outcomes;
- candy, eDVD, Ecstasy, Xanax, refill, cooldown, and reset timeline behavior;
- inventory and price normalization;
- current API capability/freshness details;
- long-horizon strategy ranking and uncertainty propagation.

## Product boundary

The eventual advisor remains advisory. It may calculate, compare, explain, warn, remind, and guide. Automatic item consumption, drug use, training, or unattended gameplay requests remain outside the approved direction.

No API key, private player state, inventory export, or session data belongs in Divine Knowledge.

## Implementation and release boundary

DQ-TRAIN-001A and 001B freeze documentation, arithmetic fixtures, and calibration protocol only. They do **not** authorize product/runtime implementation, UI work, network integration, gameplay behavior, release, merge, or branch deletion.

The next actual action is evidence, not code: collect one routine Class-S observation using `CALIBRATION-OBSERVATION-SCHEMA-001B.json`, validate the transcription and inferred-noise calculation, then expand only if the pipeline proves sound.
