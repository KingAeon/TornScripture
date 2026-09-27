# DQ-TRAIN-001F — Booster threshold correction

Date: 2026-09-26 (America/Chicago). Existing branch `agent/training-booster-threshold-correction-001f`, draft PR #127. Starting head `8069033aa1dcb79226d1d27ecf7e7c577f7b222c`; verified main baseline `0adcab679c07b6dc6d01e4aa2d2eea586f9a5f97`. The [owner-authorized Work handoff](WORK-TRANSFER-HANDOFF-BOOSTER-THRESHOLD-CORRECTION-2026-09-26.md) limits this build to the pure planner, focused regressions, and correction records.

## Corrected legality

For each individual booster item, the cooldown **before use** must be strictly below the known maximum. Add that item's cooldown once; the result may exceed the maximum. If the result reaches or exceeds the maximum, no further immediate booster is legal. Unknown maximum prevents booster preparation. A changed or stale booster state prevents `READY` guidance.

At base maximum 86,400s, four 21,600s eDVDs starting at zero reach exactly 86,400s. A fifth immediate eDVD is rejected. The four-item recipe carries a separate `nextBoosterCheckpoint` with `WAIT` for `BOOSTER_BELOW_MAX` and `VERIFY_STATE` for cooldown and Happy. This is **an optional continuation before future Happy preparation**, not a hidden fifth item in that four-item training plan: the planner does not invent elapsed time or a future Happy value, does not simulate gain from an unobserved fifth item, and does not charge its inventory/economics. Replan from a fresh observed below-max state before considering the fifth item. One eDVD at observed 86,399s is legal and may leave 107,999s.

For mixed recipes, item-ID order is retained if it is legal; otherwise a stable shorter-cooldown-first order permits a legal final larger item where appropriate. `boosterUseSequence` records the chosen order and per-item increments for readiness. Existing action types, fingerprints for ordinary below-threshold paths, and other frozen objective/refill/math behavior are preserved.

## Regression evidence and verification

Six B1–B6 acceptance cases were added before changing source. B1 (one-item overcap), B3 (explicit fifth-item checkpoint), and B5 (unknown-max direct composition) failed on the starting head and pass after correction. B2 (at max), B4 (already over max), and B6 (ordinary below-threshold path) passed initially as protected controls and still pass. Two further tests cover stable mixed-bundle ordering and malformed booster sequence / unsupported-mechanic fail-closed behavior. Baseline focused suite: 89/89. Corrected focused suite: 97/97. The full repository suite has 334 passing tests across 21 suites. Both changed JavaScript files pass `node --check`; `git diff --check main...HEAD` and complete diff inspection pass after committing.

The frozen fixture JSON files were not changed. There is no userscript/runtime, API, DOM, UI, storage, network, listener, timer, or gameplay-action change. No manual Torn/TornPDA behavior is claimed. A two-stage Happy preparation requires a fresh observation after the wait; the pure planner does not forecast unobserved future booster cooldown or Happy. The DQ-TRAIN-001D adapter contract stays in draft PR #126 for its separate final `[V]/[S]` gate after independent verification and owner-authorized merge of #127.

Rollback: revert the DQ-TRAIN-001F correction commit on the existing branch. PR #127 remains draft/unmerged/unreleased, pending **independent `[V]`**. No merge, release, or branch deletion is authorized by this build.
