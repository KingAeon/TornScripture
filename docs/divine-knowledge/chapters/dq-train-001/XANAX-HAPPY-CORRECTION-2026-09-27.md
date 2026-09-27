# DQ-TRAIN-001H — Xanax Happy-effect correction checkpoint

Status: **IMPLEMENTED ON DRAFT PR #130; INDEPENDENT [V] PENDING; UNMERGED/UNRELEASED**

Base: `main@443cb542e8b3f3d2b70404993d5dd322fe6f013d`. Existing branch: `agent/training-xanax-happy-correction-001h`, starting at `d976b697fef6c50e730f5874a418eff603d6bf65`. The [owner-authorized handoff](WORK-TRANSFER-HANDOFF-XANAX-HAPPY-CORRECTION-2026-09-27.md) defines scope and exclusions. Its failed network preflight described an earlier environment; this implementation used a fully materialized, clean executable checkout, verified both heads and publishing capability, and ran the 136 focused / 373 repository baseline tests successfully.

## Correction

The pure planner's immediate Xanax action now requires explicit supported `itemMechanics.xanax.happyGain`. Each immediately modeled successful use adds that integer gain once to observed Happy before subsequent boosters, Ecstasy where legal, and sequential training; Happy caps at 99,999. Unknown or unsupported immediate effects yield `UNSUPPORTED_EFFECT` rather than a false full forecast. Final-booster marginal gain uses that same post-Xanax starting Happy. This does not change Energy stacking, drug wait checkpoints, resource accounting, fingerprints, readiness, or the frozen 001A math kernel.

Delayed plans use `happyAtCheckpoint` as the authoritative post-action value and never add Xanax's Happy again. A missing required future Happy value still prevents a full gain forecast. Xanax followed by Ecstasy must still pass the post-Xanax drug wait and verification, then multiplies the checkpoint Happy. A synthetic 3,075 checkpoint produces 6,150 after Ecstasy, with no invented future cooldown or Happy.

The adapter registry still holds Xanax +250 Energy/+75 Happy, but its approved sources do not establish a stack cap. It continues withholding `observedState.xanax`, sets `xanaxPreparation:false`, and now reports `STACK_CAP_UNAVAILABLE` instead of the resolved planner-Happy blocker. Source acquisition and planner-facing Xanax remain out of scope.

## Regression evidence

Tests were written before changing product source. X1 immediate +75, X2 99,999 cap, X3 unknown effect, X7 immediate Xanax then legal booster, and X8 adapter diagnostic each failed on the starting implementation and passed after correction. X4 delayed checkpoint, X5 missing future checkpoint, and X6 Xanax→drug wait→Ecstasy passed before and after. An immediate Xanax→Ecstasy without a drug wait is illegal under the current post-Xanax cooldown contract; X7 covers a legal immediate booster instead. X1 also proves one Xanax inventory/economic charge and no invented wait; X7 checks final-booster marginal gain against the same post-Xanax baseline.

## Verification and limits

Syntax checks on both changed source/test pairs passed. `node --test tests/training-advisor-pure.test.js tests/training-advisor-adapters.test.js` passed 141/141; `node --test tests/*.test.js` passed 378/378 in 21 suites. `git diff --check main...HEAD` passed after the local main ref was aligned with the verified remote baseline, and the complete branch diff was inspected. Frozen JSON fixtures and userscripts remain unchanged. No normalized schema, storage, network, listener, timer, DOM, UI, userscript or gameplay action changes are authorized. Roll back the bounded correction commit on this branch; leave PR #130 draft/unmerged for independent [V].
