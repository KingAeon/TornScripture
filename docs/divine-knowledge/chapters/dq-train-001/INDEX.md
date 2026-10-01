# DQ-TRAIN-001 — Battle-Stat Training and Happy Jump Optimization

State: **001J CORE OWNER TORNPDA SMOKE PASS; 001K SPEC VERIFIED/MERGED; PR #135 0.1.2 BOUNDED UI CORRECTIONS/AUTOMATED PASS; OWNER BROWSER AND INDEPENDENT IMPLEMENTATION GATES PENDING; DRAFT/UNMERGED; H1/H2 OPEN**

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
16. [Booster threshold correction handoff — 2026-09-26](WORK-TRANSFER-HANDOFF-BOOSTER-THRESHOLD-CORRECTION-2026-09-26.md) — owner-authorized bounded pure-planner build before adapter specification freeze.
17. [Booster threshold correction — 2026-09-26](BOOSTER-THRESHOLD-CORRECTION-2026-09-26.md) — per-item pre-use legality, explicit fifth-item checkpoint, tests, limitations, and independent verification gate.
18. [Booster frontier independent verification correction — 2026-09-26](BOOSTER-FRONTIER-VERIFICATION-CORRECTION-2026-09-26.md) — post-merge blocking finding, reproduced regression, bounded fix, and follow-up gate.
19. [DQ-TRAIN-001D Adapter Source Map](ADAPTER-SOURCE-MAP-001D.md) — live-proven source, permission, freshness, capability-degradation, and remaining optional strengthening.
20. [DQ-TRAIN-001D Live Adapter Proof Protocol](LIVE-ADAPTER-PROOF-PROTOCOL-001D.md) — minimal redacted live-capture protocol.
21. [DQ-TRAIN-001D Live Adapter Proof Results](LIVE-ADAPTER-PROOF-RESULTS-001D.md) — sanitized Runs A–E conclusions.
22. [DQ-TRAIN-001D Item Mechanic Registry](ITEM-MECHANIC-REGISTRY-001D.md) — bounded v0.1 base mechanics and dynamic-modifier fail-closed boundary.
23. [`ITEM-MECHANIC-FIXTURES-001D.json`](ITEM-MECHANIC-FIXTURES-001D.json) — synthetic item-mechanic acceptance fixtures.
24. [DQ-TRAIN-001D Adapter Contract](ADAPTER-CONTRACT-001D.md) — normalized capability/freshness contract prepared for final verification/freeze.
25. [`ADAPTER-FIXTURES-001D.json`](ADAPTER-FIXTURES-001D.json) — synthetic nonprivate adapter fixtures.
26. [Adapter freeze handoff — 2026-09-26](ADAPTER-FREEZE-HANDOFF-2026-09-26.md) — clean post-PR125 continuation baseline and verification gate.
27. [PR #126 adapter verification findings — 2026-09-26](ADAPTER-VERIFICATION-FINDINGS-2026-09-26.md) — refill special-count/cost correction, dynamic-item/event fail-closed projection, conservative calibration-confidence correction, and blocking booster-threshold planner mismatch.
28. [DQ-TRAIN-001D final adapter freeze — 2026-09-26](ADAPTER-FINAL-FREEZE-2026-09-26.md) — V1–V3 result after PR #128 merge, corrected fixture statuses, material gym-note gate, frozen v0.1 boundary, and separate adapter build gate.
29. [DQ-TRAIN-001D pure adapter implementation checkpoint — 2026-09-27](ADAPTER-BUILD-CHECKPOINT-2026-09-27.md) — owner-authorized isolated adapter build, frozen fixtures, provenance/freshness and capability gates, tests, and independent [V] handoff.
30. [DQ-TRAIN-001H Xanax Happy-effect correction handoff — 2026-09-27](WORK-TRANSFER-HANDOFF-XANAX-HAPPY-CORRECTION-2026-09-27.md) — owner-authorized bounded planner defect, checkpoint semantics, adapter stack-cap boundary, and X1–X8 gates.
31. [DQ-TRAIN-001H implementation checkpoint — 2026-09-27](XANAX-HAPPY-CORRECTION-2026-09-27.md) — immediate +75 Happy, delayed authoritative checkpoints, fail-closed adapter limitation, red/green regressions, and independent [V] gate.
32. [DQ-TRAIN-001I Energy stack-cap specification — 2026-09-27](STACK-CAP-SPEC-001I.md) — owner-frozen official versioned mechanic `stackCap=1000`, provenance, Xanax capability rule, and timing/refill boundaries.
33. [`STACK-CAP-FIXTURES-001I.json`](STACK-CAP-FIXTURES-001I.json) — synthetic acceptance cases for versioned stack cap, natural-max distinction, Xanax enablement, dynamic-drug fail-closed behavior, and version mismatch.
34. [DQ-TRAIN-001I Work transfer handoff — 2026-09-27](WORK-TRANSFER-HANDOFF-STACK-CAP-XANAX-ENABLE-2026-09-27.md) — deliberate implementation bundle covering versioned stack-cap projection, Xanax enablement, S1–S8 regressions, full validation, publication, and independent [V] return.
35. [DQ-TRAIN-001I implementation checkpoint — 2026-09-28](STACK-CAP-BUILD-CHECKPOINT-2026-09-28.md) — isolated pure-adapter implementation, exact post-spec baseline, frozen fixture execution, regression results, limitations, and independent [V] gate.
36. [DQ-TRAIN-001J-P selected-plan inventory correction](SELECTED-INVENTORY-CONFIRMATION-CORRECTION-001J-P.md) — independently verified selected-plan owned-item proof, valid confirmation timestamp requirement, bought-resource separation, and PR #133 merge at `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`.

37. [DQ-TRAIN-001J Runtime / Browser / UI Integration Specification](RUNTIME-UI-INTEGRATION-SPEC-001J.md) - independently verified in PR #134 and merged at `776d8e8044f317cd8feca58fb5197710b9c69b64`; acquisition/refresh, deterministic standalone packaging/runtime, beginner/advanced UI, safety, storage and H1/H2 contract.
38. [`RUNTIME-UI-INTEGRATION-FIXTURES-001J.json`](RUNTIME-UI-INTEGRATION-FIXTURES-001J.json) - 34 synthetic acceptance cases: 11 acquisition, 8 packaging/runtime and 15 UI/interaction cases.
39. [DQ-TRAIN-001K historical UI polish discussion](RUNTIME-UI-POLISH-DISCUSSION-001J.md) - owner/assistant [D] record from live PR #135 TornPDA smoke and visual/route-comparison design.
40. [DQ-TRAIN-001K UI Polish and Route Comparison/Selection Specification](UI-POLISH-ROUTE-SELECTION-SPEC-001K.md) - owner-frozen follow-on visual shell/information architecture plus canonical route-option and ephemeral player-selection contract.
41. [`UI-POLISH-ROUTE-SELECTION-FIXTURES-001K.json`](UI-POLISH-ROUTE-SELECTION-FIXTURES-001K.json) - synthetic shell/UI/route-selection acceptance cases including safe final-booster and conditional-fifth handling.
42. [001J runtime/UI build checkpoint](RUNTIME-UI-BUILD-CHECKPOINT-001J.md) - preserved implementation and verification history.

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

DQ-TRAIN-001C is frozen and the authorized pure planner was implemented on `agent/training-advisor-pure-planner-001c`. The historical PR #123 verification correction fixed five blocking findings and two bounded gaps; its additive Point-refill finding was later falsified. The owner-authorized DQ-TRAIN-001E correction on `agent/training-refill-semantics-correction-001e` explicitly supersedes that one strategy fixture, replaces additive pre-stack refill with natural-max fill, and models post-stack refill as a second sequential training phase. The repository passed 326 Node tests at that checkpoint; see [refill correction](REFILL-SEMANTICS-CORRECTION-2026-09-26.md). PR #125 is merged into main `0adcab679c07b6dc6d01e4aa2d2eea586f9a5f97`. No adapters, UI, or live TornPDA integration was authorized by that checkpoint. B5 remains a separate opportunistic evidence lane.

The owner-authorized DQ-TRAIN-001F correction on `agent/training-booster-threshold-correction-001f` replaces the erroneous hard post-use booster ceiling with a per-item pre-use threshold and an explicit below-max continuation checkpoint. The repository passed 334 Node tests at that checkpoint; see [booster threshold correction](BOOSTER-THRESHOLD-CORRECTION-2026-09-26.md). PR #127 merged into `fb9dce7c90bcc88eacfbfaff111f562793eb9f79` before the requested independent `[V]`; that review blocked on frontier pruning of a legal mixed-booster recipe. The [bounded follow-up](BOOSTER-FRONTIER-VERIFICATION-CORRECTION-2026-09-26.md), PR #128, passed independent `[V]` and merged at `24701cccbaebbeae7b3e8bb3e05d9c2f9c478a82` after separate owner authorization. Adapter implementation requires its own `[B]` authorization.

## DQ-TRAIN-001D final verification

The 001D adapter source, mechanic, fixture, and freshness contract from PR #126 passed final V1–V3 checks against merged PR #128. The [v0.1 documentation contract is specification-frozen](ADAPTER-FINAL-FREEZE-2026-09-26.md) and PR #126 merged at `f4777409632ee69f901ed0dbe41a882a95743f2d`. The owner separately authorized the [pure adapter implementation](ADAPTER-BUILD-CHECKPOINT-2026-09-27.md); PR #129 merged into `443cb542e8b3f3d2b70404993d5dd322fe6f013d`. The [Xanax Happy correction](XANAX-HAPPY-CORRECTION-2026-09-27.md) passed independent [V] and PR #130 merged at `cfdf9000d9a8e37d52ad3d5fbf0861abe5c4b1c2`. PR #132 independently passed [V] at implementation head `a5066c848ebd14c5045817947978646ef9af9578` and merged at `7352573be851f4cae590848af830975e905f6890`: DQ-TRAIN-001I's versioned absolute 1,000E stack cap and supported Xanax adapter are complete. Natural Energy maximum remains distinct.

## DQ-TRAIN-001J runtime/UI freeze and DQ-TRAIN-001K follow-on

The selected-plan inventory prerequisite is complete. PR #133 passed independent executable [V] at `7b1b31c60efcd8cbd0c13d32ee1d44fa84b7bcf0` and merged at `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`.

The owner then froze [DQ-TRAIN-001J](RUNTIME-UI-INTEGRATION-SPEC-001J.md) with [34 synthetic acceptance fixtures](RUNTIME-UI-INTEGRATION-FIXTURES-001J.json). The freeze covers user-triggered snapshot acquisition and refresh epochs, cache/freshness/capability isolation, deterministic standalone browser packaging from canonical planner/adapter sources, mission-first beginner UI, advanced provenance transparency, selected-plan item confirmation, advisory-only controls, and preference-only persistence.

H1 Happy-reset timing and H2 personalized Candy-event interval remain open live-evidence gates. They fail closed only the dependent execution mechanics and are not silently resolved by this specification.

PR #134 passed independent `[V]` at `49fe20463c2e1568cc953e729129a8aa92ee5f38` and merged at `776d8e8044f317cd8feca58fb5197710b9c69b64`. The owner separately authorized `[B][WORK]` from that exact baseline.

The [runtime/UI implementation checkpoint](RUNTIME-UI-BUILD-CHECKPOINT-001J.md) records the isolated `agent/training-runtime-ui-001j-build` branch, tested bars/input-guidance product head `0ba12a007f0b1fe241b63b563586bb543990e679`, 0.1.0 generated artifact, 229 focused / 466 repository passes, and preserved H1/H2 gates.

Prior independent `[V][WORK]` passed at `f9c37b181c22a23f093830e33d987abdfeb7d380`. Next gate: repeat owner TornPDA bars/confirmation smoke on the amended pinned artifact, complete desktop manual verification, then a separate merge decision. The implementation remains unmerged and unreleased.

Owner-authorized PR #135 amendment (2026-10-01) removes the unsupported 60-second authority expiry and blanket foreground/page-interaction invalidation. Current epochs/confirmation persist until an explicit approved transition; checkpoint → Refresh & Plan → observe → replan remains required after material actions. Tested amended product head `a151435e18de2a15eebbcd818cdc8ea1b296cebe`; 219 focused / 456 repository passes; final draft PR head is the independent-verification pin.

First owner TornPDA Android smoke failed before HUD startup despite successful install and END injection, both without and with an API key. The [known source-normalization hazard](../../../discovery/evidence/TORN-PDA-USERSCRIPT-SOURCE-NORMALIZATION.md) reproduced a SyntaxError from the literal U+2019 in `plan\u2019s`. Owner-authorized compatibility amendment removes the two literal smart apostrophes through ASCII-safe UI copy, regenerates the artifact, and adds a build guard against all four known normalized quote characters in every source input/generator/artifact. Product head `29a4b6bc80a59889cc336d43cbf166c601092309`; 220 focused / 457 repository tests and 34 frozen J cases pass. The [checkpoint](RUNTIME-UI-BUILD-CHECKPOINT-001J.md) records hashes and exact evidence. Live HUD/API/mobile workflow must be retested; automated coverage does not establish live TornPDA compatibility. Frozen/canonical bytes, H1/H2 and same draft/unmerged PR remain unchanged.

The next owner live smoke at `efbe6b34a36dc72896c54f0c29f388cbebd02765` established successful END execution, HUD/expanded rendering, managed-key injection, real CURRENT acquisition, battle stats and active Complete Cardio gym. Missing bars fields were a source-envelope normalization defect, not authentication: official OpenAPI 6.13.6 wraps UserBars in bars, while the canonical adapter accepts direct bars. Nine-endpoint audit found only that missing unwrap. Product head `0ba12a007f0b1fe241b63b563586bb543990e679` adds the one-line runtime boundary correction, preserves direct/frozen adapter inputs, and separates API refresh tasks from immediate current confirmation and unavailable H1/H2 gates in beginner guidance. Advanced retains complete raw missing/reason evidence. Nine added regressions bring results to 67 runtime/UI/build / 229 focused / 466 full, with 162 canonical and 34 J cases unchanged. The [checkpoint](RUNTIME-UI-BUILD-CHECKPOINT-001J.md) records exact schema/build hashes, failed-before/passed-after reproduction and the repeated owner bars/UX smoke gate. No merge/release; no H1/H2 closure.

## DQ-TRAIN-001J UI polish discussion

Owner live TornPDA use progressed beyond the bars/input correction and exercised the core current-evidence workflow: explicit checkpoint/new epoch, same-epoch effect confirmation, selected-plan item-local confirmation, lower/zero override with recommendation change, refresh clearing prior manual proof, and H1 fail-closed behavior. These live outcomes contain no private values in Divine Knowledge.

The owner then opened `[D]` UI-polish work. [RUNTIME-UI-POLISH-DISCUSSION-001J.md](RUNTIME-UI-POLISH-DISCUSSION-001J.md) records the active design direction. A live screenshot exposed Torn document chrome painting above the expanded Advisor, including near the Close control and state line; the checkpoint treats this as a modal-stacking/ownership defect rather than opacity bleed-through. Working direction includes a true modal stack, dark scrim with highly opaque Advisor surface, sticky touch-safe header/Close, compact state strip, semantic readiness/confidence colors, stronger recommendation hierarchy, acknowledged confirmation states, concise H1/H2 limitation presentation, and mobile safe-area treatment.

This is discussion-only. Exact palette/opacity/typography/copy choices remain open, no polish product edits are authorized, and a separate owner `[S]` step is required before implementation.

PR #134 subsequently passed independent [V] at `49fe20463c2e1568cc953e729129a8aa92ee5f38` and merged at `776d8e8044f317cd8feca58fb5197710b9c69b64`. The owner separately authorized runtime/UI implementation in draft PR #135. At the 001K freeze, PR #135 remains draft/open/unmerged at `4067c82c52439e97bb22856ac5e3e451d6a33591`, with current product bytes from `f309913a223520e720701d5e5c25cb092796b618`; owner TornPDA smoke has exercised the core current-state/confirmation workflow while H1/H2 remain open.

The owner then completed [D] UI-polish design and froze [DQ-TRAIN-001K](UI-POLISH-ROUTE-SELECTION-SPEC-001K.md) with [synthetic acceptance fixtures](UI-POLISH-ROUTE-SELECTION-FIXTURES-001K.json). 001K adds the Midnight Ledger/Dark Terminal shell and information architecture plus a bounded canonical route-comparison projection and ephemeral exact-route selection. The UI cannot rerank or synthesize routes, route choice is not evidence, selected-route inventory confirmation is re-scoped, and a conditional fifth booster after a pre-use threshold remains checkpoint/reobserve/replan rather than a guessed future gain.

Next gate: independent [V] of the 001K documentation/fixture freeze, followed by a separate owner merge decision. No 001K product amendment is authorized until after verified spec merge and a separate [B][WORK] decision.

## Initial DQ-TRAIN-001K implementation checkpoint

PR #136 passed independent [V] at `0b17df647129634675913b8f7c9ad2844986609c` and merged as `main@b8474253237e63485100fdcc51b2cb82530d2efc`. Separate owner [B][WORK] then authorized this amendment. The existing PR #135 branch was reconciled by ordinary two-parent merge `0e435bd1e4f3262e77c72b370e9bf35e64b55bba`, preserving previous head `4067c82c52439e97bb22856ac5e3e451d6a33591` and all 001J product/history evidence.

Tested 0.1.1 product head `6a6cfdaf4097b4d7a4266e325d5e7e67380ad76d` adds canonical routeOptions (maximum seven exact fingerprints, deduplicated accumulated roles and supported preparation families), canonical marginal-final-booster metadata, ephemeral exact player selection with route-scoped inventory proof clearing, staged same-epoch Apply & Replan, and the frozen Midnight Ledger Plan/Options/Advanced/modal/HUD presentation. Historical objective winners remain unchanged; adapters and frozen 001J/001K specification/fixture bytes remain unchanged. No new endpoint, price source, durable key, gameplay action, authority TTL, polling or observer.

Automated PASS: 162 existing canonical Training tests, 67 runtime/UI/build tests, 54 polish tests including all 46 K cases; 283 focused / 520 full, 21 suites; all 34 J cases; deterministic regeneration, source hashes, deliberate drift rejection, VM parity and four-quote guard. [Implementation checkpoint](RUNTIME-UI-BUILD-CHECKPOINT-001J.md) contains exact commands, privacy boundaries, manual checks and rollback. Prior owner 001J smoke is live evidence; the new 001K modal/route/UI implementation is synthetic-tested only. Next: repeated owner TornPDA and desktop smoke, independent implementation verification, then a separate owner merge decision. H1/H2 remain OPEN. Same PR #135 remains draft/open/unmerged/unreleased.

## Current bounded verification correction

At starting static-review head `e674345d9e787d0bce80eef87c018a397815d6e1`, owner-authorized correction product `9837276160d897ff08b565a8553ef7bf94a3da38` (0.1.2) guarantees Close 44px by 44px and scopes Beginner preparation/Points evidence to the effective canonical route. Advanced and no-safe-plan recovery remain available; no planner/readiness/mechanic change. Fresh 162 canonical + 67 runtime/UI/build + 60 polish = 289 focused / 526 full, 21 suites PASS; all 34 J / 46 K cases, 288 historical parity scenarios and deterministic/hash/drift/VM/smart-quote guards PASS. Frozen/canonical files unchanged by this correction; no storage/network/listener/timer/observer change. Repeat owner TornPDA/desktop smoke and independent implementation verification; PR #135 remains draft/open/unmerged, H1/H2 OPEN. Exact commands, artifact SHA and history are in the implementation checkpoint.
