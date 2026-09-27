# Training Optimization Domain

Status: **MATH/PLANNER POLICY FROZEN; B1–B4 CALIBRATED IN DOCUMENTED DOMAIN; PR #127 AND VERIFIED FOLLOW-UP #128 MERGED; DQ-TRAIN-001D V0.1 ADAPTER SPEC FROZEN ON DRAFT PR #126; BUILD REQUIRES SEPARATE OWNER [B]**

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
13. **Later gate:** separately authorize adapters, then verify them; UI and TornPDA integration remain later.
14. Release only after owner review, manual gates, and explicit merge/release authorization.

B5 special/boundary research remains parallel and opportunistic; it does not block specification work.

## Active chapter

- `../../chapters/dq-train-001/INDEX.md` — authoritative state for battle-stat training and Happy Jump mechanics, DQ-TRAIN-001A contract/fixtures, DQ-TRAIN-001B live calibration, aggregate results, and later optimization work.

## DQ-TRAIN-001D adapter specification

Draft PR #126 carries the normalized source map, item mechanic registry, live proof, and synthetic fixtures. Its final [V]/[S] checks passed after the verified PR #128 planner merge; see the [freeze result](../../chapters/dq-train-001/ADAPTER-FINAL-FREEZE-2026-09-26.md). A separate owner `[B]` authorization is required for adapter implementation; UI and TornPDA integration are later gates.
