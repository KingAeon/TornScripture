# Training Optimization Domain

Status: **PURE STACK AND 001J SPECIFICATION VERIFIED/MERGED; 001J RUNTIME/UI v0.1.0 IMPLEMENTED/TESTED; PRIOR HEAD INDEPENDENTLY VERIFIED; OWNER TORNPDA CORE WORKFLOW LIVE PASS; UI-POLISH [D] ACTIVE; DESKTOP/MERGE GATES PENDING; H1/H2 OPEN**

## Purpose

Develop a TornScriptures training advisor that helps the owner and faction members make better long-term battle-stat training decisions. Happy Jump planning is the first major use case, but the domain includes ordinary training, gym choice, consumable strategy, opportunity cost, and compounded future outcomes.

## Owner-approved direction

Recorded 2026-09-14:

- The eventual tool should be useful to the project owner and shareable with the owner's faction.
- New players must be able to use the primary guidance without understanding the underlying formula.
- Advanced users should be able to inspect assumptions, predicted gains, costs, alternatives, model status, and uncertainty.
- Small efficiency gains matter because current stat gains feed later training gains over a long time horizon.
- Durable conclusions, source provenance, decisions, uncertainty, and nonprivate fixtures belong in Divine Knowledge.

## Product boundary

The intended product is an advisory navigator, not an unattended gameplay agent.

Allowed direction includes calculations, live-state summaries, timers, warnings, checklists, inventory-aware substitutions, predicted gains, comparisons, and user-triggered planning. Automatic item consumption, automatic drug use, automatic training, or other unattended gameplay actions remain prohibited.

Player API keys, personal inventory, live player stats, session data, raw calibration records, and private exports remain browser/local/chat context and must not enter this subtree by default.

## Knowledge split

Store here:

- verified mechanics and explicitly bounded formula assumptions;
- sources and dates checked;
- owner decisions and product boundaries;
- uncertainty and competing interpretations;
- deterministic test vectors containing no private player data;
- calibration protocol and synthetic observation schema;
- aggregate validation findings and supersession history.

Resolve at runtime or recheck before consequential use:

- live prices and market availability;
- current player stats, energy, Happy, cooldowns, perks, gyms, and inventory;
- mutable Torn API contracts and cache behavior;
- current Torn scripting rules.

## Delivery sequence

1. **Completed:** research and falsify initial training-model assumptions.
2. **Completed:** freeze DQ-TRAIN-001A pure Training Math Engine contract and deterministic fixtures.
3. **Completed:** freeze DQ-TRAIN-001B live-calibration protocol and observation schema.
4. **Completed:** B1 smoke/falsification lane.
5. **Completed:** B2 all-four stat-family ordinary-Happy breadth.
6. **Completed:** B3 elevated-Happy Speed/Strength calibration.
7. **Completed:** B4 sequential 11-train batch validation.
8. **Accepted 2026-09-25:** owner promoted `vladar-v2-pre50m-v1` to `calibrated_observed_domain` for the documented Complete Cardio / 10E / recorded-modifier evidence domain only.
9. **Completed:** freeze the Training Advisor / Happy Jump Navigator product specification and ranking/strategy fixtures.
10. **Implemented and verification corrected in draft PR #123:** pure math/planner and deterministic frozen-fixture tests after explicit owner build authorization; five blocking findings and two bounded gaps corrected, 318 Node tests passed. Its additive Point-refill finding was subsequently superseded.
11. **DQ-TRAIN-001E correction, PR #125 merged into main:** owner-authorized supersession of the incorrect refill fixture; a refill fills to natural maximum and a 1,150E jump trains the stack and refill bar sequentially. Focused 89 and repository 326 Node tests passed at that checkpoint.
12. **DQ-TRAIN-001F correction merged in PR #127:** per-item pre-use booster threshold; after exact-max four-eDVD checkpoint, fifth item requires observed below-max state. Focused 97 and repository 334 Node tests passed at the original checkpoint. The merge preceded independent [V], which found a legal mixed-booster plan pruned by an illegal competitor. The bounded [follow-up correction](../../chapters/dq-train-001/BOOSTER-FRONTIER-VERIFICATION-CORRECTION-2026-09-26.md), draft PR #128, passed independent [V] at `0a8abe04cfe8a7d4e2ce346b7bb5f0867e29785c`; its separately authorized merge landed as `24701cccbaebbeae7b3e8bb3e05d9c2f9c478a82`; PR #126 final adapter-spec verification has resumed.
13. **DQ-TRAIN-001D completed:** pure source adapters built from `main@f4777409632ee69f901ed0dbe41a882a95743f2d`, independently verified, and merged in PR #129. UI and TornPDA integration remain later.
14. **DQ-TRAIN-001H/001I complete:** PR #130's immediate Xanax +75 Happy correction and PR #131's 1,000E stack-cap specification merged. PR #132 passed independent [V] at `a5066c848ebd14c5045817947978646ef9af9578` and merged at `7352573be851f4cae590848af830975e905f6890`, completing versioned-cap and supported Xanax normalization. The [001I build checkpoint](../../chapters/dq-train-001/STACK-CAP-BUILD-CHECKPOINT-2026-09-28.md) retains its historical pending-V language.
15. **DQ-TRAIN-001J-P complete/merged:** the selected-plan inventory prerequisite passed independent executable [V] at `7b1b31c60efcd8cbd0c13d32ee1d44fa84b7bcf0` and merged in PR #133 at `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`. Partial current confirmation can prove only selected-plan owned quantities; bought resources remain acquisition-gated.
16. **DQ-TRAIN-001J specification independently verified/merged in PR #134:** [runtime/UI integration](../../chapters/dq-train-001/RUNTIME-UI-INTEGRATION-SPEC-001J.md) plus [34 synthetic fixtures](../../chapters/dq-train-001/RUNTIME-UI-INTEGRATION-FIXTURES-001J.json) freeze user-triggered acquisition/refresh, deterministic standalone packaging/runtime boundaries, mission-first beginner/advanced UI, and advisory-only interaction. H1/H2 remain open live-evidence gates. Verified head `49fe20463c2e1568cc953e729129a8aa92ee5f38` merged at `776d8e8044f317cd8feca58fb5197710b9c69b64`; the owner subsequently authorized the separate runtime build.
17. **DQ-TRAIN-001J implementation complete on isolated branch:** the [build checkpoint](../../chapters/dq-train-001/RUNTIME-UI-BUILD-CHECKPOINT-001J.md) records standalone 0.1.0, canonical modules unchanged, all 34 runtime/UI cases executable, 229 focused / 466 repository passes after bounded v2 bars/input-guidance correction. Owner TornPDA live smoke now also exercises the core bars/stats/gym, checkpoint/new-epoch, same-epoch effect confirmation, selected-plan current inventory, lower/zero override and refresh-reset behavior while H1 remains fail-closed.
18. **DQ-TRAIN-001J UI polish discussion active:** [polish discussion checkpoint](../../chapters/dq-train-001/RUNTIME-UI-POLISH-DISCUSSION-001J.md) records true-modal stacking after owner-observed Torn chrome overlap, scrim/high-opacity direction, sticky header/state strip, semantic color roles, cleaner recommendation hierarchy and acknowledged evidence states. Exact visual tokens/copy remain [D], with separate [S] required before polish implementation.
19. Release only after independent verification, owner review, manual gates, and explicit merge/release authorization.

B5 special/boundary research remains parallel and opportunistic; it does not block specification work.

## Active chapter

- `../../chapters/dq-train-001/INDEX.md` — authoritative state for battle-stat training and Happy Jump mechanics, DQ-TRAIN-001A contract/fixtures, DQ-TRAIN-001B live calibration, aggregate results, and later optimization work.

## DQ-TRAIN-001D adapter specification

Merged PR #126 carries the normalized source map, item mechanic registry, live proof, and synthetic fixtures. Its final [V]/[S] checks passed after the verified PR #128 planner merge; see the [freeze result](../../chapters/dq-train-001/ADAPTER-FINAL-FREEZE-2026-09-26.md). The owner separately authorized the [001D pure adapter build](../../chapters/dq-train-001/ADAPTER-BUILD-CHECKPOINT-2026-09-27.md), later merged in PR #129. PR #131 froze the versioned Energy stack cap; PR #132's independently verified 001I implementation is merged. Selected-plan inventory execution proof is complete through independently verified/merged PR #133. DQ-TRAIN-001J now freezes the later acquisition, standalone packaging/runtime, and beginner/advanced UI contract; the prior runtime/UI head passed independent [V][WORK], and the bounded quote correction now awaits repeated owner live gates; see the build checkpoint.

Owner-authorized PR #135 amendment (2026-10-01) removes the unsupported 60-second authority expiry and blanket foreground/page-interaction invalidation. Current epochs/confirmation persist until an explicit approved transition; checkpoint → Refresh & Plan → observe → replan remains required after material actions. Tested amended product head `a151435e18de2a15eebbcd818cdc8ea1b296cebe`; 219 focused / 456 repository passes; final draft PR head is the independent-verification pin.

Owner-authorized TornPDA compatibility amendment (2026-10-01), after independently verified head `f9c37b181c22a23f093830e33d987abdfeb7d380`: first real Android smoke test installed successfully with END injection but showed no HUD, with or without an API key. Known whole-source smart-quote normalization turned `plan\u2019s` into invalid single-quoted JavaScript; the documented transform reproduced the startup SyntaxError. Two ASCII-safe UI wording changes and one permanent four-quote source/artifact build guard correct that bounded failure. Tested product head `29a4b6bc80a59889cc336d43cbf166c601092309`; 162 existing / 58 runtime/UI/build / 220 focused / 457 repository passes, all 34 frozen J cases, deterministic regeneration, provenance, drift and VM parity. See the build checkpoint and [normalization evidence](../../../discovery/evidence/TORN-PDA-USERSCRIPT-SOURCE-NORMALIZATION.md). Repeat owner TornPDA smoke; desktop/H1/H2 gates remain pending; same draft PR #135 remains unmerged/unreleased.

Owner live post-quote smoke at `efbe6b34a36dc72896c54f0c29f388cbebd02765` passed END startup, HUD/expanded UI, managed key, real CURRENT refresh, stats and Complete Cardio gym acquisition. Bars normalization remained blocked because the acquisition boundary omitted the official v2 bars envelope; the first new regression reproduced missing Energy, then one unwrap line fixed it without changing adaptBars. The nine-endpoint official wrapper audit (OpenAPI 6.13.6) found no other missing unwrap. Current confirmations now receive immediate-replan guidance; API failures identify their source/refresh; H1/H2 remain dedicated open limitations with full Advanced raw diagnostics. Tested product head `0ba12a007f0b1fe241b63b563586bb543990e679`; 162 canonical / 67 runtime/UI/build / 229 focused / 466 repository passes, all 34 frozen J cases, deterministic/hashes/drift/VM/four-quote checks pass. Repeat owner bars/confirmation smoke; same draft/open/unmerged PR #135 and separate desktop/H1/H2 gates remain.
