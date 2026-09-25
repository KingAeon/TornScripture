# Training Optimization Domain

Status: **MATH CONTRACT FROZEN; B1–B4 LIVE CALIBRATION COMPLETE; MODEL CALIBRATED IN OBSERVED DOMAIN; PRODUCT SPECIFICATION NEXT**

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
9. **Next:** freeze the Training Advisor / Happy Jump Navigator product specification, including strategy/timeline economics, confidence boundaries, and beginner/advanced surfaces.
10. Implement the pure calculation engine and deterministic tests only after the specification is frozen and owner build authorization is explicit.
11. Validate desktop userscript managers and TornPDA/Android.
12. Release only after owner review, manual gates, and explicit merge/release authorization.

B5 special/boundary research remains parallel and opportunistic; it does not block specification work.

## Active chapter

- `../../chapters/dq-train-001/INDEX.md` — authoritative state for battle-stat training and Happy Jump mechanics, DQ-TRAIN-001A contract/fixtures, DQ-TRAIN-001B live calibration, aggregate results, and later optimization work.
