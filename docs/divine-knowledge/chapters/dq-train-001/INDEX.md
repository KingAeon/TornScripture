# DQ-TRAIN-001 — Battle-Stat Training and Happy Jump Optimization

State: **DQ-TRAIN-001A FROZEN; DQ-TRAIN-001B B1 COMPLETE; B2 PARTIAL WITH SPEED + DEXTERITY LIVE-SPOT-CHECKED**

## Canonical reading order

1. [2026-09-14 source audit](RESEARCH-2026-09-14.md) — provenance, corrections, uncertainty, and calibration gates.
2. [DQ-TRAIN-001A Training Math Engine Contract](MATH-ENGINE-SPEC-001A.md) — frozen pure-kernel boundary and arithmetic profile.
3. [`MATH-ENGINE-FIXTURES-001A.json`](MATH-ENGINE-FIXTURES-001A.json) — normative deterministic arithmetic fixtures.
4. [DQ-TRAIN-001B Live Training Calibration Protocol](CALIBRATION-PROTOCOL-001B.md) — frozen live-fidelity evidence plan.
5. [`CALIBRATION-OBSERVATION-SCHEMA-001B.json`](CALIBRATION-OBSERVATION-SCHEMA-001B.json) — raw/local observation shape and derived-analysis contract.
6. [DQ-TRAIN-001B Calibration Results](CALIBRATION-RESULTS-001B.md) — aggregate nonidentifying live evidence and model-state progression.

The source audit supersedes the preliminary research snapshot from PR #118 wherever they conflict. No public formula is promoted to Torn server truth, no universal diminishing-return claim is retained, and no above-50m extrapolation is silently accepted.

## Discovery question

How can TornScriptures accurately predict and optimize battle-stat training for a specific player, including Happy Jumps and alternative strategies, while remaining newbie-friendly, faction-shareable, transparent, and advisory?

## Owner-approved outcome

The desired product should answer:

> Given this player's current state, inventory, budget, available gym, perks, and activity window, what should they do next, why, and what improvement should they expect now and over time?

The beginner surface should reduce this to a safe next-action sequence. An advanced surface may expose formulas, costs, assumptions, alternatives, sensitivity, model status, and prediction error.

Working label: **TornScriptures Training Advisor**, with **Happy Jump Navigator** as its first major feature.

## DQ-TRAIN-001A frozen result

The first layer is specified as a pure, deterministic, versioned Training Math Engine. It has no network/API/DOM/storage/clock/UI/gameplay dependency, no internal RNG, evaluates batches sequentially, treats gain modifiers explicitly and multiplicatively under the candidate model, supports the trained-stat domain through exactly 50,000,000, and fails closed above that domain. Passing fixtures proves contract arithmetic only, not current-server fidelity.

## DQ-TRAIN-001B live calibration

Primary evidence is one manual internal train during routine play. Displayed values are treated as quantized observations, and eligible Vladar observations are inverted into an inferred gain-noise interval. Raw personal observations remain local/chat evidence; Divine Knowledge stores only protocol, synthetic shapes, and aggregate/nonidentifying findings.

### Speed lane

B1 completed with 12 eligible consecutive Speed Class-S observations in Complete Cardio at 5.8 dots and 10E with +2% property and +7% faction Speed gain.

- confirmed contradictions: 0;
- inferred-noise midpoint range: approximately -931 to +1,212 inside Speed's `[-1350,+1350]` bound;
- mean midpoint: approximately +37;
- all Happy losses were in `{4,5,6}`.

### Dexterity lane

B2 Dexterity target completed with 8 eligible Class-S observations in Complete Cardio at 5.2 dots and 10E with +2% property and +6% faction Dexterity gain. The observations span two short sessions separated by natural energy regeneration; each train is independently calibrated from its captured pre-state.

- confirmed contradictions: 0;
- displayed gain range: 17.06 to 17.39;
- zero-noise center range: approximately 17.125 to 17.218;
- inferred-noise midpoint range: approximately -504 to +770 inside Dexterity's `[-1000,+1000]` bound;
- mean midpoint: approximately +44;
- Happy-loss counts: 4×3, 5×1, 6×4, with every observation inside `{4,5,6}`.

The candidate is therefore **`live_spot_checked`** in two narrow ordinary-training lanes: Speed and Dexterity. This is not a broad production calibration claim.

## Calibration progression

- **B1: COMPLETE.** 12 eligible Speed Class-S observations, zero confirmed contradictions.
- **B2: PARTIAL.** Dexterity has reached the 8-observation target; Strength and Defense remain untested at the target level. Additional Speed/Dex evidence is lower priority unless normal play naturally calls for it.
- **B3:** elevated-Happy single-train evidence, naturally occurring only.
- **B4:** multi-train batch validation after sufficient single-train coverage.
- **B5:** Fitness Center/reduced-Happy-loss, ambiguous modifiers, and post-50m boundaries.

## Still unresolved

Important unresolved mechanics include Strength and Defense fidelity, broader stat/Happy ranges, post-50m behavior, special Happy-loss modifiers, ambiguous gain modifiers, probabilistic distributions, consumable/drug timelines, inventory/price normalization, API capability/freshness, and long-horizon strategy ranking.

## Product boundary

The eventual advisor remains advisory. It may calculate, compare, explain, warn, remind, and guide. Automatic item consumption, drug use, training, or unattended gameplay requests remain outside the approved direction.

No API key, private player state, inventory export, raw calibration history, or session data belongs in Divine Knowledge.

## Implementation and release boundary

DQ-TRAIN-001A and 001B currently cover documentation, arithmetic fixtures, calibration protocol, and bounded evidence only. They do **not** authorize product/runtime implementation, UI work, network integration, gameplay behavior, release, merge, or branch deletion.

The next evidence action is B2 breadth: prefer routine single-train Strength or Defense observations over collecting additional Speed or Dexterity purely for research.
