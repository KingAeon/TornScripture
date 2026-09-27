# DQ-TRAIN-001D — Pure adapter implementation checkpoint

Date: 2026-09-27 UTC. Owner-authorized `[B][WORK]` implementation from verified `main@f4777409632ee69f901ed0dbe41a882a95743f2d`, after PR #126 merged its frozen 001D contract. Isolated branch: `agent/training-adapter-001d-build`. This checkpoint records a proposed build pending independent `[V]`; it is not a release or merge authorization.

## Scope and implementation

- Added `src/training-advisor-adapters.js`: pure source-specific normalization for bars, cooldowns, raw battle stats and current manual fallback, active gym/catalog join, perk strings, daily refill, three independently cached inventory categories, typed market inputs, and approved timing evidence.
- Added a versioned in-code v0.1 item registry for base Xanax, Ecstasy, eDVD and the 11 documented Candy IDs. Drug cooldown envelopes remain descriptive, not invented exact future cooldowns. Complete verified effect state is required for base item mechanics and 86,400-second booster maximum. Candy additionally requires independently verified inactive event evidence. The planner-facing Xanax Energy route is withheld pending the upstream Happy-effect correction below.
- Each material field carries provenance, source identity, observed-at, cache class, and freshness where known. Source or permission failures degrade only dependent capabilities. Missing material gain modifiers, malformed/unsupported gym notes, incomplete inventory pagination, stale stats, unknown Point balance, unproven elevated ordinary Happy, and unsupported item effects fail closed in their respective planner projection.
- Refills use the historical `energy` used-state polarity, natural-max fill policy, 30-Point configured mechanic, and `special_count` paid-path gate. Live Points quantity is separate. Cached category inventory is suitable for planning only; complete current player confirmation of the entire v0.1 registry can provide LIVE execution inventory.
- General candidate searches always set `calibratedDomain:false`. There is no inferred server quarter-hour rule; safe timing requires explicit approved evidence. Market input retains typed new-cash and owned replacement value concepts.

The code never calls Torn, reads local or network state, touches DOM or storage, schedules work, or performs gameplay actions. No userscript imports this adapter yet. The frozen 001D JSON fixtures and merged pure planner are unchanged.

## Verification at build checkpoint

The clean baseline on `main@f4777409632ee69f901ed0dbe41a882a95743f2d` passed 98/98 Training Advisor tests and 335/335 repository Node tests. The new adapter tests execute all 17 adapter fixtures and all 16 item-mechanic fixtures, plus evidence-gate, multi-page inventory, market-type, permission/locality, and planner-integration regressions. Syntax checks passed for changed JavaScript. Focused adapters plus pure planner passed 136/136; full Node suite passed 373/373 across 21 suites. The branch-to-main diff check passed; independent `[V]` remains a separate gate. No live desktop or TornPDA behavior was exercised.

## Limits, next gate, rollback

External source acquisition, exact runtime permissions, live event and quarter-window proof, approved live Points/inventory confirmation, market-provider wiring, UI/TornPDA integration, and observed-domain candidate-set certification remain separate. The optional elevated-Happy ordinary/base maximum strengthening remains open. The caller must provide honest timestamp/freshness proof; an absent proof is never labeled LIVE by this module.

**Known upstream planner mismatch for independent [V]:** Xanax's documented base +75 Happy appears in the frozen 001D registry, but the merged pure planner composes an immediate `TAKE_XANAX -> TRAIN` without adding that Happy to its modeled first train. Reproduction: 500E, 1,000 Happy, 0s drug cooldown, 250E Xanax, 1,000E cap yields 750E with simulated first-train Happy still 1,000 instead of 1,075. The adapter therefore retains the source mechanic but suppresses the planner-facing Xanax Energy route and marks `UPSTREAM_PLANNER_HAPPY_EFFECT_UNMODELED`. No stack-cap source is frozen in 001D either. This capability gap requires a separately scoped planner correction before Xanax recommendations; do not silently promote this v0.1 build as full Xanax support. Frozen JSON fixtures and planner arithmetic have not been edited.

Next: independent `[V]` of the isolated adapter branch, then an explicit owner merge decision if review passes. UI/TornPDA requires a later gate. Roll back by reverting the adapter implementation commit on its branch. No storage keys, migration, network endpoint, listener, observer, timer, userscript version, or release metadata changes.
