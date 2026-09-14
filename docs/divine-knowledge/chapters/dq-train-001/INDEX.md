# DQ-TRAIN-001 — Battle-Stat Training and Happy Jump Optimization

State: **DQ-TRAIN-001A CONTRACT + FIXTURES FROZEN; LIVE CALIBRATION PENDING**

## Canonical reading order

1. [2026-09-14 source audit](RESEARCH-2026-09-14.md) — current provenance, corrections, uncertainty, and calibration gates.
2. [DQ-TRAIN-001A Training Math Engine Contract](MATH-ENGINE-SPEC-001A.md) — frozen pure-kernel boundary and arithmetic profile.
3. [`MATH-ENGINE-FIXTURES-001A.json`](MATH-ENGINE-FIXTURES-001A.json) — normative deterministic arithmetic fixtures.

The source audit supersedes the preliminary research snapshot from PR #118 wherever they conflict. In particular, no public formula is promoted to Torn server truth, no universal diminishing-return claim is retained, and no above-50m extrapolation is silently accepted.

## Discovery question

How can TornScriptures accurately predict and optimize battle-stat training for a specific player, including Happy Jumps and alternative strategies, while remaining newbie-friendly, faction-shareable, transparent, and advisory?

## Owner-approved outcome

The desired product should answer:

> Given this player's current state, inventory, budget, available gym, perks, and activity window, what should they do next, why, and what improvement should they expect now and over time?

The beginner surface should reduce this to a safe next-action sequence. An advanced surface may expose formulas, costs, assumptions, alternatives, sensitivity, model status, and prediction error.

Working label: **TornScriptures Training Advisor**, with **Happy Jump Navigator** as its first major feature. These labels remain working names.

## DQ-TRAIN-001A frozen result

The first layer is now specified as a pure, deterministic, versioned Training Math Engine.

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

This freeze allows future implementation to target a stable interface without laundering an uncalibrated community model into project truth.

## Still unresolved

Formula fidelity against current Torn remains an empirical question. DQ-TRAIN-001B must address model selection and residual error with ordinary planned training observations before the candidate model can be promoted.

Important unresolved mechanics include:

- current post-50m training behavior;
- exact placement and rounding of Fitness Center and other Happy-loss modifiers;
- ambiguous or unsupported gain modifiers;
- probability distributions and risk-adjusted outcomes;
- candy, eDVD, Ecstasy, Xanax, refill, cooldown, and reset timeline behavior;
- inventory and price normalization;
- current API capability/freshness details;
- long-horizon strategy ranking and uncertainty propagation.

## DQ-TRAIN-001B next step

Use routine planned training rather than extra spending to calibrate competing model predictions. Collect enough controlled observations to discriminate systematic error by stat, Happy, gym, batch size, and relevant perks. Validate special modifier behavior separately and keep private player observations browser/local; only synthetic fixtures and aggregate nonidentifying findings belong in Divine Knowledge.

DQ-TRAIN-001B should either promote a bounded model with an evidence-based tolerance or explicitly leave the affected region unsupported. Tolerances must follow observed residuals rather than be chosen to make a candidate pass.

## Product boundary

The eventual advisor remains advisory. It may calculate, compare, explain, warn, remind, and guide. Automatic item consumption, drug use, training, or unattended gameplay requests remain outside the approved direction.

No API key, private player state, inventory export, or session data belongs in Divine Knowledge.

## Implementation and release boundary

DQ-TRAIN-001A freezes documentation and deterministic test vectors only. It does **not** authorize product/runtime implementation, UI work, network integration, gameplay behavior, release, merge, or branch deletion.

Any future math-engine implementation must satisfy the acceptance gate in `MATH-ENGINE-SPEC-001A.md`; any model change that alters frozen fixture output requires a new model ID or an explicit specification supersession.