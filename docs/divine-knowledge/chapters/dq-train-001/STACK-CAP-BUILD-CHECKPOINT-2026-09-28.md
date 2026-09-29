# DQ-TRAIN-001I — Versioned Stack Cap and Xanax Adapter Build

Status: **OWNER-AUTHORIZED [B][WORK] IMPLEMENTED ON ISOLATED BRANCH; INDEPENDENT [V] PENDING**

Base: `main@3a812d8fdf550dc35a9c9eddc7dd384e3631a86d`, the PR #131 specification merge with frozen DQ-TRAIN-001I files present.

Branch: `agent/training-stack-cap-xanax-001i-build`, started at that exact base SHA.

## Implementation

- A pure versioned mechanic projects `observedState.stackCap=1000` and `fields.stackCap` with `CONFIGURED`, `FRESH`, `TORN_ENERGY_STACK_CAP_V1`, `VERSIONED_MECHANIC`, and `verifiedAt=2026-09-27`. It has no live API or Wiki attribution. `naturalEnergyMax` remains independent `/user/bars.energy.maximum` state.
- An explicit conflicting `configuredMechanics.energyStackCap` fails closed as `MECHANIC_VERSION_MISMATCH`; no authoritative stack cap or planner-facing Xanax projection is emitted.
- Supported Xanax mechanics reuse the existing item registry's +250 Energy and +75 Happy. With complete fresh effect evidence and no unsupported material drug modifier, `observedState.xanax={energyGain:250}` and `xanaxPreparation:true` are emitted. Incomplete evidence or an unsupported drug modifier suppresses this Xanax route locally; the general stack cap remains available.
- No future Xanax `cooldownSeconds` is emitted. The current observed drug cooldown can gate one use; a later use needs another observed checkpoint and replan.
- The pure planner and its PR #130 immediate +75 Happy semantics are unchanged. The Point refill still fills only to `naturalEnergyMax`; the 1,150E route remains sequential stack training, one refill, verification, and ordinary-bar training.

## Regression evidence

- Baseline before product edits: focused planner and adapter 141/141; full repository 378/378 across 21 suites.
- Seven new adapter checks failed on the exact untouched base: each of the five frozen `STACK-CAP-FIXTURES-001I.json` cases, supported immediate Xanax/cooldown integration, and drug-effect locality. The same checks pass after the bounded adapter implementation.
- S1–S5 exercise all five frozen fixture IDs without changing the fixture. S6 checks one immediate use, observed-current-cooldown gating, and the absence of exact future cooldown. S7 keeps X1–X8 Happy protections; S8 is covered by the unchanged pure planner and existing refill, booster, frontier, freshness, inventory, gym-note and calibration tests.

## Verification and boundary

The four required `node --check` commands passed for both adapter and pure-planner source/test files. `node --test tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js` passed **148/148**; `node --test tests/*.test.js` passed **385/385** across 21 suites. The five 001I, 17 001D adapter, and 16 001D item-mechanic fixture IDs are unique and parse. `OPEN-NODES.ndjson` (20 rows) and `CHANGELOG.ndjson` (49 rows) parse. Frozen specifications and fixtures are unchanged. The complete branch-to-main diff and `git diff --check main...HEAD` were inspected before publication; the published head is recorded in the draft PR completion report.

This is pure adapter output only. There is no API acquisition, runtime Wiki fetch, TornPDA/UI/DOM integration, storage, timer, listener, market-provider wiring, gameplay action, userscript change, or release. Actual live Torn/TornPDA behavior has not been tested. Independent [V] and explicit owner merge authorization remain separate gates. Rollback: leave the draft PR unmerged or revert its implementation commit on the isolated branch.
