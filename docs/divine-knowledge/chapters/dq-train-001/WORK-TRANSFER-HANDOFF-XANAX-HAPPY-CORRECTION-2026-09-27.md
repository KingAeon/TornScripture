# DQ-TRAIN-001H — Work Transfer Handoff: Xanax Happy-Effect Planner Correction

Status: **OWNER-AUTHORIZED NEXT STEP; [B][BUG] PRODUCT EDITS REQUIRE EXECUTABLE WORKSPACE; CURRENT CHAT PREFLIGHT FAILED**

Prepared: 2026-09-27

Repository: `KingAeon/TornScripture`

Authorized base:

`main@443cb542e8b3f3d2b70404993d5dd322fe6f013d`

Dedicated branch:

`agent/training-xanax-happy-correction-001h`

Related landed work:

- PR #129 pure source adapters merged at `443cb542e8b3f3d2b70404993d5dd322fe6f013d`
- adapter v0.1 intentionally withholds planner-facing Xanax preparation because the merged pure planner omits Xanax's +75 Happy effect
- Xanax stack-cap sourcing remains a separate unresolved adapter/acquisition concern

The owner said the next step may commence after PR #129 merge. This handoff scopes that next step to the known upstream Xanax Happy-effect defect.

Do not merge, release, delete branches, add UI/TornPDA integration, or expand into source acquisition.

## Mandatory executable-workspace preflight

Before product edits, satisfy root `AGENTS.md`:

- fully materialized checkout;
- exact base SHA verified;
- branch head verified;
- clean working tree;
- Node/test commands available;
- relevant baseline tests run;
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

Therefore no product/test file is to be edited from this chat via connector as a substitute for an executable checkout.

## Defect

The frozen mechanic registry records Xanax success-path effects:

```text
Energy +250
Happy  +75
```

The merged pure planner currently uses Xanax to alter Energy but does not apply its +75 Happy before an immediate training simulation.

Minimal reproduction from PR #129 verification:

```text
Energy 500
Happy 1000
drug cooldown 0
stack cap 1000
Xanax +250E / +75 Happy

planner action:
TAKE_XANAX -> TRAIN

current incorrect simulation:
Energy 750
first-train Happy 1000

correct immediate success-path simulation:
Energy 750
first-train Happy 1075
```

PR #129 safely withholds `observedState.xanax` and reports `UPSTREAM_PLANNER_HAPPY_EFFECT_UNMODELED`, so no incorrect live Xanax recommendation is currently exposed.

## Checkpoint semantics

Do **not** blindly add +75 after every delayed Xanax plan.

The existing planner already requires `happyAtCheckpoint` when a delayed Energy/drug path needs a fresh future Happy value. That checkpoint is authoritative reality after the preceding wait/action sequence.

Frozen bounded rule for this correction:

1. **Immediate Xanax path with no intervening/future Happy checkpoint before training/preparation**
   - require an explicit supported `happyGain` for Xanax;
   - apply it once per immediately modeled Xanax success;
   - clamp to 99,999;
   - use the resulting Happy for boosters/Ecstasy/training.

2. **Delayed/checkpointed Xanax path**
   - `happyAtCheckpoint` is the authoritative observed/configured Happy at the checkpoint after the preceding Xanax/wait sequence;
   - do not add Xanax Happy again on top of that observed checkpoint;
   - if the required checkpoint Happy is missing, remain fail-closed as today.

3. **Xanax then Ecstasy**
   - if the Xanax creates a required drug-cooldown wait before Ecstasy, the later observed Happy checkpoint is authoritative;
   - do not forecast a random post-Xanax cooldown or future Happy;
   - Ecstasy multiplies the verified checkpoint Happy under the existing contract.

4. **Unknown Xanax Happy mechanic**
   - immediate Xanax gain simulation must fail closed rather than assume +75 or zero.

This preserves the project principle: fresh observed state beats prediction.

## Remaining stack-cap boundary

This correction does **not** invent a source for `stackCap`.

PR #129's pure adapter may continue withholding `observedState.xanax` until the adapter/acquisition layer has an approved stack-cap mechanic/source.

After the planner bug is corrected, update the adapter diagnostic so it no longer claims `UPSTREAM_PLANNER_HAPPY_EFFECT_UNMODELED`. It should instead expose the actual remaining bounded reason, e.g. `STACK_CAP_UNAVAILABLE` / equivalent frozen reason, while keeping `xanaxPreparation:false`.

Do not enable planner-facing Xanax merely because the Happy bug is fixed.

## Required implementation behavior

Bounded scope:

1. correct immediate Xanax Happy mutation in `src/training-advisor-pure.js`;
2. require an explicit supported Xanax Happy effect for any immediate modeled Xanax path;
3. preserve delayed `happyAtCheckpoint` authority and avoid double counting;
4. preserve 99,999 Happy cap;
5. preserve Xanax Energy, inventory, economics, cooldown checkpoint, fingerprint and readiness semantics;
6. update PR #129 adapter limitation/diagnostic to the remaining stack-cap blocker without enabling Xanax preparation;
7. update bounded docs/Divine Knowledge;
8. no source acquisition, UI, userscript, storage, network, listeners, timers or gameplay actions.

## Required regression cases

Write these first and reproduce the applicable defect before changing source.

### X1 — immediate Xanax applies +75 Happy

```text
Energy 500
Happy 1000
drug cooldown 0
stackCap 1000
Xanax +250E/+75 Happy
TRAIN immediately
```

Assert:

- Energy at training = 750;
- exactly one `TAKE_XANAX`;
- simulation first-train starting Happy = 1075;
- plan's prepared/pre-training Happy reflects 1075 where exposed;
- economics/inventory count one Xanax;
- no invented wait.

### X2 — Happy cap

```text
Happy 99950
immediate Xanax +75
```

Assert prepared Happy = 99999, never 100025.

### X3 — unknown Happy effect fails closed

Energy mechanics may know +250E, but if the immediate Xanax Happy effect is absent/unsupported:

- no authoritative full gain forecast may use that Xanax;
- result is unsupported / DATA_MISSING / UNSUPPORTED_EFFECT according to the smallest coherent existing contract;
- do not silently treat Happy gain as zero.

### X4 — delayed Xanax does not double count checkpoint Happy

```text
wait required
happyAtCheckpoint = 1075
one Xanax already occurred in the preceding action/checkpoint sequence
```

Assert training/preparation starts from 1075, **not 1150**.

### X5 — delayed path still needs Happy checkpoint

Existing missing-`happyAtCheckpoint` regression must continue to return no full forecast.

### X6 — Xanax then Ecstasy uses verified checkpoint Happy

With a post-Xanax drug wait and:

```text
happyAtCheckpoint = 3075
Ecstasy x2
```

Assert Ecstasy result = 6150 and no extra +75 is inserted after the checkpoint.

### X7 — immediate Xanax plus booster/Ecstasy ordering where no drug wait exists

Only if the existing contract permits an immediate follow-on action without a mandatory drug checkpoint. Preserve action ordering and prove Xanax's Happy mutation occurs before subsequent Happy preparation. If the drug rules make the combination unavailable, record that and keep the test bounded to the actually legal route.

### X8 — adapter remains fail-closed after planner correction

After pure planner correction:

- registry still records Xanax +250E/+75 Happy;
- adapter still does not expose `observedState.xanax` without approved stack-cap support;
- `xanaxPreparation === false`;
- unsupported reason changes away from the now-resolved planner Happy defect to the remaining stack-cap reason.

## Protected regressions

Do not regress:

- 001A math;
- 001E Point-refill natural-max behavior;
- sequential 1,150E refill route;
- 001F booster pre-use threshold;
- 001G legal-before-Pareto booster frontier;
- ordinaryHappy usefulness reference;
- natural Energy regeneration before Xanax;
- delayed Xanax checkpoint/replan semantics;
- Ecstasy safe-quarter readiness;
- 50m partial behavior;
- Balanced knee ranking;
- adapter fixture behavior;
- cached inventory freshness;
- dynamic item fail-closed projection;
- no runtime source acquisition or gameplay automation.

## Expected files

Likely:

- `src/training-advisor-pure.js`
- `tests/training-advisor-pure.test.js`
- `src/training-advisor-adapters.js` only for the stale unsupported-reason/update, not to enable Xanax
- `tests/training-advisor-adapters.test.js`
- `docs/TRAINING-ADVISOR-PURE-PLANNER.md`
- `docs/TRAINING-ADVISOR-ADAPTERS.md`
- bounded Divine Knowledge correction record + NOW/index/changelog

Frozen 001D JSON fixtures should remain unchanged unless the implementation proves a fixture itself is contradictory; if so, stop and return to [S] instead of silently editing a frozen contract.

## Validation

Run at minimum:

```text
node --check src/training-advisor-pure.js
node --check tests/training-advisor-pure.test.js
node --check src/training-advisor-adapters.js
node --check tests/training-advisor-adapters.test.js
node --test tests/training-advisor-pure.test.js tests/training-advisor-adapters.test.js
node --test tests/*.test.js
git diff --check main...HEAD
```

Inspect the complete branch-to-main diff.

## Required completion report

Return:

1. verified base SHA and starting branch SHA;
2. resulting head SHA;
3. exact files changed;
4. which X1–X8 regressions failed before correction and passed afterward;
5. exact immediate-vs-checkpoint Xanax Happy semantics;
6. focused + full commands/results;
7. whether any normalized schema changed;
8. adapter limitation after the correction;
9. storage/network/listener/timer/runtime effects;
10. remaining limitations;
11. rollback commit;
12. explicit statement that branch/PR remains unmerged and unreleased.

After implementation, return to **independent [V]** before any merge.
