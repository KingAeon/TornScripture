# Training Optimization Domain

Status: **MATH CONTRACT + CALIBRATION PROTOCOL FROZEN; LIVE EVIDENCE COLLECTION OPEN; PRODUCT IMPLEMENTATION PENDING**

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

1. **Completed:** research and falsify the initial training-model assumptions; source audit recorded in DQ-TRAIN-001.
2. **Completed:** freeze DQ-TRAIN-001A pure Training Math Engine contract and deterministic fixtures.
3. **Completed specification / active evidence:** freeze DQ-TRAIN-001B controlled calibration protocol and observation schema; collect one routine Class-S observation first, validate the analysis pipeline, then expand to the B1 falsification set.
4. **Pending evidence decision:** select/promote/reject models only inside observed domains; validate modifier/rounding gaps and unsupported boundaries separately.
5. After evidence-based model promotion and separate owner implementation authorization, implement the pure calculation engine and fixture tests.
6. Build strategy/timeline economics above the pure kernel, then design the beginner navigator and advanced explanation layer.
7. Validate desktop userscript managers and TornPDA/Android.
8. Release only after owner review, manual gates, and explicit merge authorization.

## Active chapter

- `../../chapters/dq-train-001/INDEX.md` — authoritative state for battle-stat training and Happy Jump mechanics, DQ-TRAIN-001A contract/fixtures, DQ-TRAIN-001B live calibration, and later optimization work.
