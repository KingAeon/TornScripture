# DQ-TRAIN-001 — Battle-Stat Training and Happy Jump Optimization

State: **DQ-TRAIN-001A FROZEN; DQ-TRAIN-001B B1 COMPLETE; PRIMARY CANDIDATE LIVE-SPOT-CHECKED IN NARROW SPEED DOMAIN**

## Canonical reading order

1. [2026-09-14 source audit](RESEARCH-2026-09-14.md) — provenance, corrections, uncertainty, and calibration gates.
2. [DQ-TRAIN-001A Training Math Engine Contract](MATH-ENGINE-SPEC-001A.md) — frozen pure-kernel boundary and arithmetic profile.
3. [`MATH-ENGINE-FIXTURES-001A.json`](MATH-ENGINE-FIXTURES-001A.json) — normative deterministic arithmetic fixtures.
4. [DQ-TRAIN-001B Live Training Calibration Protocol](CALIBRATION-PROTOCOL-001B.md) — frozen live-fidelity evidence plan.
5. [`CALIBRATION-OBSERVATION-SCHEMA-001B.json`](CALIBRATION-OBSERVATION-SCHEMA-001B.json) — raw/local observation shape and derived-analysis contract.
6. [DQ-TRAIN-001B Calibration Results](CALIBRATION-RESULTS-001B.md) — aggregate nonidentifying live evidence and model-state progression.

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
- the first arithmetic profile is named `vladar-v2-pre50m-v1`;
- the candidate model accepts trained-stat values through exactly 50,000,000 and fails closed above that boundary rather than clamping or extrapolating;
- unsupported special effects fail visibly rather than being approximated;
- high-precision deterministic fixture expectations are stored as decimal strings with numeric tolerances;
- passing fixtures proves contract arithmetic only, not prediction accuracy against live Torn.

The frozen 001A document records the model's pre-calibration state. Live evidence state is tracked separately by 001B so arithmetic provenance is not rewritten after the fact.

## DQ-TRAIN-001B protocol and B1 result

Live calibration has a separate bounded contract. Primary evidence is a **single internal train** performed manually during normal planned play. Displayed values are treated as quantized observations rather than exact hidden arithmetic, and each eligible Vladar observation is inverted into an inferred gain-noise interval.

B1 is complete with **12 eligible consecutive Speed Class-S observations** in a narrow ordinary-training lane. Aggregate result:

- candidate contradictions: 0;
- confirmed contradictions: 0;
- all inferred gain-noise intervals intersected the frozen Speed `[-1350,+1350]` range;
- inferred-noise midpoints ranged approximately from -931 to +1,212 with mean approximately +37;
- five midpoint estimates were positive and seven negative;
- all 12 Happy losses matched the 10E candidate set `{4,5,6}`;
- Happy-loss counts were 4×5, 5×6, and 6×1;
- no obvious one-direction residual drift appeared in the small sequence.

The candidate therefore advances to **`live_spot_checked`** for the observed Speed / Complete Cardio / 10E / ordinary-modifier lane only. It is **not** yet `calibrated_observed_domain`, and this result does not establish other stats, higher Happy, different gyms, special effects, batches, or post-50m behavior.

Raw personal observations remain local/chat evidence by default. Divine Knowledge stores the protocol, synthetic shapes, and aggregate/nonidentifying conclusions only.

## Calibration progression

- **B1: COMPLETE.** 12 eligible routine Speed Class-S observations; capture/inversion pipeline and gross candidate falsification passed with zero confirmed contradictions.
- **B2: NEXT.** Target at least 8 eligible Class-S observations per stat family for faction-capable coverage; claims remain narrower when coverage is missing. Strength, Defense, and Dexterity are currently untested live families.
- **B3:** target at least 8 naturally occurring elevated-Happy single trains, ideally across two stat families; no extra boosters solely for research.
- **B4:** target at least 8 multi-train batches after single-train calibration; test sequential aggregate envelopes.
- **B5:** separate lanes for Fitness Center/reduced Happy loss, ambiguous gain modifiers, and post-50m behavior.

## Still unresolved

Important unresolved mechanics include:

- Strength, Defense, and Dexterity live formula fidelity;
- broader stat and Happy ranges;
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

No API key, private player state, inventory export, raw calibration history, or session data belongs in Divine Knowledge.

## Implementation and release boundary

DQ-TRAIN-001A and 001B currently cover documentation, arithmetic fixtures, calibration protocol, and bounded evidence only. They do **not** authorize product/runtime implementation, UI work, network integration, gameplay behavior, release, merge, or branch deletion.

The next evidence action is B2 breadth: prefer routine single-train observations from Strength, Defense, or Dexterity over collecting additional Speed purely for research.
