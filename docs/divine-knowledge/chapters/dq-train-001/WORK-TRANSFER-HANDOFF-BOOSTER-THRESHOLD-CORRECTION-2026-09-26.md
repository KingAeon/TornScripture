# DQ-TRAIN-001F — Work Transfer Handoff: Booster Threshold / One-Item-Overcap Correction

Status: **OWNER-AUTHORIZED [B][BUG]; PRODUCT EDITS BLOCKED IN CURRENT CHAT BY EXECUTABLE-WORKSPACE PREFLIGHT FAILURE; RESUME IN WORK**

Prepared: 2026-09-26

Repository: `KingAeon/TornScripture`

Authorized base:

`main@0adcab679c07b6dc6d01e4aa2d2eea586f9a5f97`

Dedicated branch:

`agent/training-booster-threshold-correction-001f`

Related specification PR:

`#126` — DQ-TRAIN-001D adapter specification verification/freeze

Do not merge, release, delete the branch, or modify unrelated runtime behavior.

## Owner authorization

The owner explicitly authorized the next product correction after PR #126 [V]/[S]:

> [B][BUG] booster-threshold / one-item-overcap pure-planner correction

This authorization is limited to the booster-use legality defect documented by PR #126 plus the minimum tests/docs needed to preserve the corrected contract.

## Mandatory executable-workspace preflight

Before product edits, satisfy root `AGENTS.md`:

- fully materialized checkout;
- exact main/base SHA verified;
- branch head verified;
- clean working tree;
- Node/test commands available;
- baseline relevant tests run;
- complete diff inspection available;
- publish capability available.

Current chat retried:

```text
git clone https://github.com/KingAeon/TornScripture.git
```

and again received:

```text
Could not resolve host: github.com
```

Therefore no runtime/test file may be edited from this chat via connector as a substitute for the required executable workspace.

## Blocking defect

The merged pure planner currently treats `boosterMaxSeconds` as a hard post-use ceiling.

Observed code patterns include aggregate checks equivalent to:

```text
currentBoosterSeconds + plannedAddedCooldown <= boosterMaxSeconds
```

and candidate-generation checks equivalent to:

```text
plannedAddedCooldown <= boosterMaxSeconds - currentBoosterSeconds
```

Current Torn booster semantics instead use the maximum as the threshold for whether **another booster may begin use**.

Correct rule:

```text
before each booster:
  currentBoosterSeconds < boosterMaxSeconds

after use:
  currentBoosterSeconds += itemCooldownSeconds
  # result may exceed boosterMaxSeconds

while currentBoosterSeconds >= boosterMaxSeconds:
  no next booster until current cooldown is observed below the maximum
```

If a sequence reaches the maximum exactly, another booster requires an explicit wait / observed checkpoint below the threshold. Do not invent elapsed seconds between actions.

## Why this matters

The current stricter rule can suppress a legal final booster.

Project evidence includes the separately captured DQ-TRAIN-001B live Happy Jump that used five Erotic DVDs, while the captured perk set contained no maximum-booster-cooldown faction modifier. That evidence is compatible with one-item-overcap threshold semantics and incompatible with a hard aggregate ceiling.

## Required implementation behavior

Bounded scope:

1. replace aggregate hard-ceiling legality with pre-use threshold legality;
2. an item is legal when current booster cooldown **before that item** is strictly below `boosterMaxSeconds`;
3. resulting cooldown may exceed the maximum;
4. once result is at/above maximum, no subsequent booster may be used until a wait/verification step produces an observed state below maximum;
5. do not assume time passed between instantaneous planned actions;
6. preserve booster cooldown arithmetic exactly once per item;
7. preserve economics, inventory consumption, Happy effects, readiness, deterministic fingerprints, objective ranking, and all unrelated planner semantics;
8. preserve fail-closed behavior when `boosterMaxSeconds` is unknown;
9. preserve unsupported dynamic item modifiers from PR #126 specification as an adapter concern; this correction only fixes pure-planner booster legality;
10. update bounded Divine Knowledge with the correction result.

## Required regression cases

At minimum reproduce these as initially failing tests before correction:

### B1 — one item may push over maximum

```text
current booster = 86399
max = 86400
next eDVD = +21600
=> item legal
=> result = 107999
=> another immediate booster illegal
```

### B2 — exactly at max is blocked

```text
current booster = 86400
max = 86400
next booster
=> illegal
=> BOOSTER_LIMIT_REACHED / equivalent bounded reason
```

### B3 — five-eDVD base-max checkpoint

```text
start booster = 0
max = 86400
eDVD cooldown = 21600

use #1 -> 21600
use #2 -> 43200
use #3 -> 64800
use #4 -> 86400
#5 cannot immediately follow without time/state change

WAIT / VERIFY below 86400
use #5 -> may finish above 86400
```

Assertions:

- first four are legal;
- fifth immediate use at exactly 86400 is not legal;
- planner must represent a wait/checkpoint before fifth rather than inventing elapsed time;
- after observed below-max state, fifth becomes legal and may finish over maximum.

### B4 — already over max is blocked

```text
current booster > max
=> no booster candidate until observed below max
```

### B5 — unknown maximum fails closed

```text
boosterMaxSeconds unknown
=> no booster-preparation candidate requiring legality proof
```

### B6 — existing ordinary booster plan remains unchanged below threshold

A simple one-/two-booster plan that stays below maximum should preserve prior actions, costs, Happy, and fingerprint behavior except where the old hard-ceiling rule had incorrectly pruned options.

## Architecture constraint

Do not solve this by inflating or falsifying `boosterMaxSeconds`.

Preferred planner shape:

- legality is evaluated sequentially per booster action;
- candidate-generation may build a sequence only while each next item begins below maximum;
- if a sequence lands at/above maximum and wants another item, insert or require a WAIT/VERIFY boundary;
- the pure planner must not manufacture the post-wait booster cooldown unless the wait duration or observed checkpoint is explicit.

If supporting a wait-before-next-booster requires a bounded extension to existing candidate representation, make the smallest coherent extension and keep action semantics advisory.

## Protected regressions

Do not regress:

- DQ-TRAIN-001E Point-refill natural-max correction;
- sequential 1,150E TRAIN -> USE_REFILL -> VERIFY -> TRAIN route;
- Xanax cooldown checkpoint behavior;
- natural Energy regeneration before Xanax;
- ordinaryHappy usefulness reference;
- execution freshness gates;
- 50m partial behavior;
- Balanced knee ranking;
- unknown-value booster behavior;
- unsupported effect locality;
- deterministic central projection N=0 / R=5;
- no API/DOM/UI/storage/network/listener/timer/gameplay behavior.

## Expected files

Likely:

- `src/training-advisor-pure.js`
- `tests/training-advisor-pure.test.js`
- bounded DQ-TRAIN-001F correction/verification docs
- `docs/divine-knowledge/NOW.md`, chapter/domain indices, changelog as needed

Do not modify userscript runtime files.

## Validation

Run:

```text
node --check src/training-advisor-pure.js
node --check tests/training-advisor-pure.test.js
node --test tests/training-advisor-pure.test.js
node --test tests/*.test.js
git diff --check main...HEAD
```

Also inspect the complete branch-to-main diff.

## Required completion report

Return:

1. verified base SHA and starting branch SHA;
2. resulting head SHA;
3. exact files changed;
4. which booster regressions failed before correction and passed afterward;
5. exact corrected legality semantics;
6. focused + full test commands/results;
7. any action/schema changes;
8. storage/network/listener/timer/runtime effects;
9. remaining limitations;
10. rollback commit;
11. explicit statement branch/PR remains unmerged and unreleased.

After build completion, return to **[V] independent re-verification** before any merge decision, then return to PR #126 for the final DQ-TRAIN-001D freeze.
