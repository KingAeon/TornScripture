# Training Optimization Domain

Status: **ACTIVE RESEARCH / PRODUCT SPECIFICATION NOT FROZEN**

## Purpose

Develop a TornScriptures training advisor that helps the owner and faction members
make better long-term battle-stat training decisions. Happy Jump planning is the
first major use case, but the domain includes ordinary training, gym choice,
consumable strategy, opportunity cost, and compounded future outcomes.

## Owner-approved direction

Recorded 2026-09-14:

- The eventual tool should be useful to the project owner and shareable with the
  owner's faction.
- New players must be able to use the primary guidance without understanding the
  underlying formula.
- Advanced users should be able to inspect assumptions, predicted gains, costs,
  alternatives, and uncertainty.
- Small efficiency gains matter because current stat gains feed later training
  gains over a long time horizon.
- Durable conclusions, source provenance, decisions, and unresolved questions
  should be stored in Divine Knowledge for future-thread continuity and freshness.

## Product boundary

The intended product is an advisory navigator, not an unattended gameplay agent.

Allowed direction includes calculations, live-state summaries, timers, warnings,
checklists, inventory-aware substitutions, predicted gains, comparisons, and
user-triggered planning. Automatic item consumption, automatic drug use,
automatic training, or other unattended gameplay actions remain prohibited.

Player API keys, personal inventory, live player stats, session data, and private
exports remain browser-local and must never enter this subtree.

## Knowledge split

Store here:

- verified mechanics and formula assumptions;
- sources and dates checked;
- owner decisions and product boundaries;
- uncertainty and competing interpretations;
- test vectors that contain no private player data;
- validation findings and supersession history.

Resolve at runtime or recheck before consequential use:

- live prices and market availability;
- current player stats, energy, Happy, cooldowns, perks, gyms, and inventory;
- mutable Torn API contracts and cache behavior;
- current Torn scripting rules.

## Delivery sequence

1. Research and falsify the training model.
2. Freeze a testable math-engine specification.
3. Implement the pure calculation engine and deterministic tests.
4. Calibrate predictions against controlled real Torn training observations.
5. Design the beginner navigator and advanced explanation layer.
6. Validate desktop userscript managers and TornPDA/Android.
7. Release only after owner review, manual gates, and explicit merge authorization.

## Active chapter

- `../../chapters/dq-train-001/INDEX.md` — battle-stat training and Happy Jump
  mechanics, optimization objectives, data contracts, and validation questions.
