# DQ-TRAIN-001C — PR #123 verification correction

**2026-09-26 supersession:** Finding 6 below asserted that a Point refill adds Energy to an existing Xanax stack. This is incorrect. The owner-authorized [DQ-TRAIN-001E correction](REFILL-SEMANTICS-CORRECTION-2026-09-26.md) supersedes only that refill claim and its `REFILL_CAP_001` fixture: a Point refill fills to the natural Energy maximum; the 1,150E jump requires training the stack before the refill. The other findings remain historical verification results.

Date: 2026-09-25. Starting branch head: `d20998ac1535207d7c7bf8d7bd7f29081fe0672c`. Main baseline: `05d8ba9c53d20cc9df0a4ada842df369a6a4f71a`. The existing branch is `agent/training-advisor-pure-planner-001c`. PR #123 remains draft and unmerged.

The verification report's five blocking findings and two bounded gaps were reproduced with seven tests failing on the reviewed head, then corrected:

1. Xanax now commits a normalized next drug-cooldown checkpoint. Ecstasy follows a wait and explicit state verification when the cooldown is known; combination abstains when it is unknown. The combined wait obeys the user wait bound and delayed Happy requires an explicit checkpoint.
2. A booster consumes the remaining cooldown capacity (`boosterMaxSeconds - boosterSeconds`). Existing accumulated cooldown by itself does not force a wait or future Happy assumption.
3. Explicit regeneration advances Energy to the Xanax checkpoint and charges only regeneration lost at the natural cap. Below-cap delayed Xanax candidates are withheld when regeneration inputs are missing; above-cap delayed plans preserve unknown regeneration loss and Balanced abstains from comparing that unknown burden.
4. The useful-session reference uses explicit normalized `ordinaryHappy` and one natural full Energy bar. A missing base Happy causes usefulness-based objectives to abstain; elevated current Happy is not substituted.
5. Execution `READY` requires normalized field-level freshness and present modifier arrays. Dynamic Energy, Happy, relevant cooldowns, and required inventory must be `LIVE`; gym and gain modifiers can be `FRESH` or `LIVE`. A plan can still be modeled and ranked while its execution status says `NEEDS_REFRESH`.
6. A finite refill after a meaningful Xanax checkpoint can make a full stack, with point cost and cap discard preserved.
7. Mixed known-value and owned unknown-value booster recipes remain available to Maximum Gain, with the economic value left unknown.

Frozen DQ-TRAIN-001A `model.status` remains `candidate_not_live_calibrated`, separate from planner confidence. The BALANCED_STATS abstention, explicit future Happy requirement, and post-50m partial boundary are unchanged. No frozen JSON fixtures or userscript/runtime files changed. No networking, persistent storage, listeners, timers, API, DOM, UI, or gameplay actions were added.

Verification: `node --check` on the two changed JavaScript files; focused planner suite 81/81; full repository suite 318/318; `git diff --check main...HEAD` and complete diff inspection after committing. Source freshness remains caller supplied; the pure module cannot fetch current state. Missing post-Xanax cooldown, unsupplied regeneration during a below-cap wait, and future Happy without an explicit checkpoint cause abstention where relevant.

Rollback: revert the verification correction commit on the existing feature branch. The branch and draft PR must be retained until separately authorized otherwise.
