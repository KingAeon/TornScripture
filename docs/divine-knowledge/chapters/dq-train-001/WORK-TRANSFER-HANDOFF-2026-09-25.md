# DQ-TRAIN-001 — Work Transfer Handoff: Pure Training Advisor Planner

Status: **BUILD AUTHORIZED; IMPLEMENTATION NOT YET STARTED; TRANSFER TO WORK REQUESTED**

Prepared: 2026-09-25
Repository: `KingAeon/TornScripture`
Current `main`: `05d8ba9c53d20cc9df0a4ada842df369a6a4f71a`
Build branch: `agent/training-advisor-pure-planner-001c`
Build branch was created from the exact current `main` above.

## 1. Owner authorization

The owner explicitly entered:

`[B] implement the pure Training Advisor planner first`

This authorizes the pure-planner implementation described by frozen DQ-TRAIN-001C.

It does **not** authorize merge/release, Torn API/DOM integration, userscript UI, automatic gameplay behavior, storage migration, or unrelated cleanup.

## 2. Frozen specification foundation

Read in this order before implementation:

1. `MATH-ENGINE-SPEC-001A.md`
2. `MATH-ENGINE-FIXTURES-001A.json`
3. `CALIBRATION-RESULTS-001B.md`
4. `TRAINING-ADVISOR-SPEC-001C.md`
5. `PLANNER-POLICY-001C.md`
6. `PLANNER-POLICY-FIXTURES-001C.json`
7. `PLANNER-STRATEGY-FIXTURES-001C.json`

PR #122 merged the frozen DQ-TRAIN-001C specification into main at merge commit:

`05d8ba9c53d20cc9df0a4ada842df369a6a4f71a`

The reviewed specification head before merge was:

`cb773f9fe164538a90cc2b30b601ed8782ca9b2d`

## 3. Frozen planner behavior

The pure planner must preserve:

- advisory-only behavior;
- no network/API/DOM/storage/clock dependency inside the pure planner;
- normalized inputs rather than raw Torn payloads;
- hierarchical Energy -> Happy -> training candidate generation;
- sequential simulation using the frozen training math engine where supported;
- Pareto pruning;
- selectable objectives:
  - Maximum Gain
  - Best Value
  - Budget Cap
  - Use My Inventory
  - Fastest Useful Plan
  - Balanced
- explicit confidence/risk policy;
- deterministic ranking and tie breaks;
- resumable plan/action contracts;
- readiness separate from ranking;
- fail-closed unsupported mechanics;
- partial pre-50m boundary behavior;
- no fabricated prices, odds, modifiers, or player state.

Balanced is frozen as Pareto pruning plus normalized geometric knee:

```text
gainUtility = normalized expected gain

burden = max(
  normalized economic value consumed,
  normalized time to completion,
  normalized natural Energy lost,
  normalized points consumed
)

kneeScore = gainUtility - burden
```

Best Value is incremental gain per incremental economic value above the strongest zero-economic-sacrifice baseline.

The usefulness reference is one ordinary natural full Energy bar under the current supported state.

## 4. Existing specification verification

Before build authorization, an independent scratch verifier reproduced all 10 current ranking-policy fixture selections.

This was **specification verification only**, not runtime/unit testing.

The strategy/composition fixture file also freezes synthetic cases for:

- ordinary train-now;
- full 1,000E eDVD + Ecstasy composition;
- candy frontier pruning;
- owned-vs-purchased substitution;
- meaningful Energy checkpoints;
- refill cap/discard behavior;
- natural-E opportunity cost while capped;
- micro-jump generation;
- observed state overriding prediction;
- unsupported-effect locality;
- partial 50m model boundary.

## 5. Required first implementation slice

Implement the pure planner before adapters or UI.

Expected subsystem responsibilities:

1. pure training-math adapter/engine implementation matching DQ-TRAIN-001A fixtures;
2. normalized candidate/plan data structures;
3. Energy preparation candidate generation;
4. Happy preparation/frontier generation;
5. sequential training simulation;
6. Pareto pruning;
7. objective ranking;
8. Recommendation output contract;
9. deterministic executable tests for frozen math, policy, and strategy fixtures.

The exact file/module layout should follow the existing repository conventions discovered during Work preflight rather than being invented before inspecting the checkout.

## 6. Mandatory repository preflight

`AGENTS.md` requires, before product edits:

- full executable repository checkout/materialization;
- exact base SHA verification;
- clean working tree;
- available syntax/test commands;
- existing relevant tests identified and baseline result captured;
- isolated feature branch;
- ability to inspect the complete diff;
- ability to publish a verified commit.

The previous non-Work chat environment could not materialize/clone the repository because `github.com` DNS resolution was unavailable there.

Therefore **no product code was changed in that environment**.

Work should retry preflight in its full repository/cloud-computer workspace.

If baseline tests fail before edits, source differs materially from the frozen specification, or the full executable checkout cannot be obtained, stop and report instead of improvising.

## 7. Branch state at transfer

The build branch currently contains no product implementation.

Only this Divine Knowledge transfer checkpoint and related state pointers may be newer than main.

Do not recreate the branch if it already exists.

Resume from:

`agent/training-advisor-pure-planner-001c`

Verify its head before coding.

## 8. Explicit exclusions for this build slice

Do not implement yet:

- Torn API adapters;
- DOM/page parsing;
- TornPDA UI;
- desktop UI;
- background monitoring;
- market-price networking;
- persistent player state;
- automatic drug/item/refill use;
- automatic training;
- post-50m prediction;
- B5 special mechanics;
- Fitness Center special Happy-loss behavior;
- overdose-probability EV;
- combat-impact ranking;
- unrelated casino/IMM/DQ-EXT work.

## 9. Required completion report

At the end of the pure-planner implementation pass, report:

- exact base SHA and resulting head SHA;
- files changed;
- architecture implemented;
- exact validation commands and results;
- all frozen fixture counts/pass results;
- any test failures or deviations;
- storage/network/listener/timer changes, expected to be none;
- manual tests still required;
- rollback method;
- known limitations;
- explicit statement that the work remains unmerged.

## 10. Merge/release boundary

Implementation authorization is not merge authorization.

Do not merge, release, or delete the feature branch without later explicit owner authorization.
