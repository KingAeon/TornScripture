# DQ-TRAIN-001 — Battle-Stat Training and Happy Jump Optimization

State: **DQ-TRAIN-001A FROZEN; DQ-TRAIN-001B B1–B4 COMPLETE; MODEL CALIBRATED IN DOCUMENTED OBSERVED DOMAIN; DQ-TRAIN-001C FROZEN WITH 001E REFILL SUPERSESSION; PURE PLANNER + REFILL CORRECTION MERGED; DQ-TRAIN-001D ADAPTER SPEC VERIFICATION READY**

## Canonical reading order

1. [2026-09-14 source audit](RESEARCH-2026-09-14.md) — provenance, corrections, uncertainty, and calibration gates.
2. [DQ-TRAIN-001A Training Math Engine Contract](MATH-ENGINE-SPEC-001A.md) — frozen pure-kernel boundary and arithmetic profile.
3. [`MATH-ENGINE-FIXTURES-001A.json`](MATH-ENGINE-FIXTURES-001A.json) — normative deterministic arithmetic fixtures.
4. [DQ-TRAIN-001B Live Training Calibration Protocol](CALIBRATION-PROTOCOL-001B.md) — frozen live-fidelity evidence plan.
5. [`CALIBRATION-OBSERVATION-SCHEMA-001B.json`](CALIBRATION-OBSERVATION-SCHEMA-001B.json) — raw/local observation shape and derived-analysis contract.
6. [DQ-TRAIN-001B Calibration Results](CALIBRATION-RESULTS-001B.md) — aggregate nonidentifying live evidence and model-state progression.
7. [DQ-TRAIN-001C Training Advisor / Happy Jump Navigator v0.1 Specification](TRAINING-ADVISOR-SPEC-001C.md) — frozen product contracts for state, strategy generation, ranking, recommendations, readiness, and replanning.
8. [DQ-TRAIN-001C Planner Ranking Policy](PLANNER-POLICY-001C.md) — frozen deterministic objective ranking and Balanced knee semantics.
9. [`PLANNER-POLICY-FIXTURES-001C.json`](PLANNER-POLICY-FIXTURES-001C.json) — synthetic planner-policy acceptance fixtures.
10. [`PLANNER-STRATEGY-FIXTURES-001C.json`](PLANNER-STRATEGY-FIXTURES-001C.json) — synthetic strategy-generation and composition fixtures; `REFILL_CAP_001` is explicitly superseded by two DQ-TRAIN-001E executable cases.
11. [Work transfer handoff — 2026-09-25](WORK-TRANSFER-HANDOFF-2026-09-25.md) — exact pure-planner build authorization, branch, preflight blocker, implementation scope, exclusions, and resume instructions.
12. [Pure planner checkpoint](../../../TRAINING-ADVISOR-PURE-PLANNER.md) — normalized module contract, verification, limitations, and rollback on the feature branch.
13. [PR #123 verification correction](VERIFICATION-CORRECTION-2026-09-25.md) — reproduced findings, bounded fixes, freshness contract, tests, and rollback.
14. [Point refill correction handoff — 2026-09-26](WORK-TRANSFER-HANDOFF-REFILL-CORRECTION-2026-09-26.md) — owner-authorized fixture supersession and bounded sequential planner change.
15. [Point refill semantics correction — 2026-09-26](REFILL-SEMANTICS-CORRECTION-2026-09-26.md) — six reproduced regressions, new natural-max and sequential training contract, verification, limitations, and rollback.
16. [DQ-TRAIN-001D Adapter Source Map](ADAPTER-SOURCE-MAP-001D.md) — live-proven source, permission, freshness, capability-degradation, and remaining optional strengthening.
17. [DQ-TRAIN-001D Live Adapter Proof Protocol](LIVE-ADAPTER-PROOF-PROTOCOL-001D.md) — minimal redacted live-capture protocol.
18. [DQ-TRAIN-001D Live Adapter Proof Results](LIVE-ADAPTER-PROOF-RESULTS-001D.md) — sanitized Runs A–E conclusions.
19. [DQ-TRAIN-001D Item Mechanic Registry](ITEM-MECHANIC-REGISTRY-001D.md) — bounded v0.1 base mechanics and dynamic-modifier fail-closed boundary.
20. [`ITEM-MECHANIC-FIXTURES-001D.json`](ITEM-MECHANIC-FIXTURES-001D.json) — synthetic item-mechanic acceptance fixtures.
21. [DQ-TRAIN-001D Adapter Contract](ADAPTER-CONTRACT-001D.md) — normalized capability/freshness contract prepared for final verification/freeze.
22. [`ADAPTER-FIXTURES-001D.json`](ADAPTER-FIXTURES-001D.json) — synthetic nonprivate adapter fixtures.
23. [Adapter freeze handoff — 2026-09-26](ADAPTER-FREEZE-HANDOFF-2026-09-26.md) — clean post-PR125 continuation baseline and next verification gate.

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

B2 Dexterity target completed with 8 eligible Class-S observations in Complete Cardio at 5.2 dots and 10E with +2% property and +6% faction Dexterity gain.

- confirmed contradictions: 0;
- displayed gain range: 17.06 to 17.39;
- zero-noise center range: approximately 17.125 to 17.218;
- inferred-noise midpoint range: approximately -504 to +770 inside Dexterity's `[-1000,+1000]` bound;
- mean midpoint: approximately +44;
- Happy-loss counts: 4×3, 5×1, 6×4, with every observation inside `{4,5,6}`.

### Defense lane

B2 Defense target completed with 8 eligible consecutive Class-S observations in Complete Cardio at 5.5 dots and 10E with +2% property and +6% faction Defense gain.

- confirmed contradictions: 0;
- displayed gain range: 17.50 to 18.14;
- zero-noise center range: approximately 17.697 to 17.785;
- inferred-noise midpoint range: approximately -845 to +1,351 inside Defense's `[-1500,+1500]` bound;
- mean midpoint: approximately +444;
- Happy-loss counts: 4×3, 5×1, 6×4, with every observation inside `{4,5,6}`.

The Defense sample's positive mean is preserved as an observation rather than interpreted away. Eight convenience samples are insufficient to infer systematic bias, and there is no candidate contradiction.

### Strength lane

B2 Strength target completed with 8 eligible consecutive Class-S observations in Complete Cardio at 5.5 dots and 10E with +2% property and +7% faction Strength gain.

- confirmed contradictions: 0;
- displayed gain range: 22.66 to 23.00;
- zero-noise center range: approximately 22.738 to 22.817;
- inferred-noise midpoint range: approximately -461 to +611 inside Strength's `[-700,+700]` bound;
- mean midpoint: approximately +154;
- Happy-loss counts: 4×2, 5×3, 6×3, with every observation inside `{4,5,6}`.

The candidate passed the ordinary-training B1/B2 lanes and later survived B3 elevated-Happy and B4 batch validation. On 2026-09-25 the owner accepted the explicitly bounded claim, advancing `vladar-v2-pre50m-v1` to **`calibrated_observed_domain`** for the documented evidence domain only.

### Elevated-Happy lane

B3 completed with 12 eligible Class-H singles from a fully captured 33,550-Happy eDVD + Ecstasy jump, split evenly across Speed and Strength.

- Speed inferred-noise midpoints: approximately -1,183 to +954 inside ±1,350;
- Strength inferred-noise midpoints: approximately -385 to +17 inside ±700;
- confirmed contradictions: 0;
- Happy remained approximately 33,060 to 33,550 across the single-train probes.

### Batch lane

B4 completed with 8 eligible 11-train batches from the same elevated-Happy session. All 8 aggregate gains landed inside full sequential candidate envelopes after enumerating allowed internal Happy-loss paths and stat-specific gain-noise bounds.

- batch contradictions: 0;
- stats represented: Speed and Strength;
- batch size: 11 internal trains / 110E each.

## Calibration progression

- **B1: COMPLETE.** 12 eligible Speed Class-S observations, zero confirmed contradictions.
- **B2: COMPLETE.** Strength, Speed, Defense, and Dexterity have all reached the protocol target with zero confirmed contradictions in their observed narrow lanes.
- **B3: COMPLETE.** 12 eligible elevated-Happy Class-H singles across Speed and Strength; zero confirmed contradictions.
- **B4: COMPLETE.** 8 eligible 11-train batches; every aggregate result inside the frozen sequential candidate envelope.
- **B5:** Fitness Center/reduced-Happy-loss, ambiguous modifiers, and post-50m boundaries.

## Still unresolved

Important unresolved mechanics include broader gym/energy/modifier ranges, post-50m behavior, special Happy-loss modifiers, ambiguous gain modifiers, probabilistic distributions, consumable/drug timeline optimization, inventory/price normalization, API capability/freshness, and long-horizon strategy ranking.

## Product boundary

The eventual advisor remains advisory. It may calculate, compare, explain, warn, remind, and guide. Automatic item consumption, drug use, training, or unattended gameplay requests remain outside the approved direction.

No API key, private player state, inventory export, raw calibration history, or session data belongs in Divine Knowledge.

## Implementation and release boundary

DQ-TRAIN-001A and 001B currently cover documentation, arithmetic fixtures, calibration protocol, and bounded evidence only. They do **not** authorize product/runtime implementation, UI work, network integration, gameplay behavior, release, merge, or branch deletion.

DQ-TRAIN-001C is frozen with the explicit DQ-TRAIN-001E Point-refill supersession. The corrected pure planner was independently verified and merged through PR #125 at `0adcab679c07b6dc6d01e4aa2d2eea586f9a5f97`. DQ-TRAIN-001D now resumes on a clean post-merge branch with its live source matrix substantially complete and its adapter/item-mechanic contract plus synthetic fixtures ready for independent specification verification and owner freeze. No adapter runtime, UI, network, storage, listener, timer, or gameplay implementation is authorized by this checkpoint. B5 remains a separate opportunistic evidence lane.
