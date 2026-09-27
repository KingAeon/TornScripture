# DQ-TRAIN-001D — PR #126 Verification / Specification Findings

Subsequent disposition (2026-09-26 America/Chicago): upstream finding V126-02 was corrected by PR #127 and the follow-up frontier issue by independently verified PR #128, merged as `24701cccbaebbeae7b3e8bb3e05d9c2f9c478a82`. This document preserves the earlier verification evidence and dated blocker state. See [final adapter freeze](ADAPTER-FINAL-FREEZE-2026-09-26.md).

Status: **[V]/[S] COMPLETE WITH CORRECTIONS; FINAL 001D FREEZE BLOCKED BY ONE UPSTREAM PLANNER SEMANTICS DEFECT**

Date: 2026-09-26
PR: #126
Reviewed head before verification amendments: `96f75f4db830cd2218095b2d1fcbc31bb301e239`
Baseline: `main@0adcab679c07b6dc6d01e4aa2d2eea586f9a5f97`

No runtime adapter, userscript, network, storage, UI, listener, timer, DOM, or gameplay implementation is authorized by this verification.

## Verified clean

- PR #126 is based directly on the corrected PR #125 merge and was 14 commits ahead / 0 behind at review start.
- Only `docs/divine-knowledge/**` files differ from main.
- Adapter fixture JSON and item-mechanic fixture JSON both parse.
- Original review set contained 11 adapter fixtures and 10 item-mechanic fixtures with no duplicate IDs.
- OpenAPI 6.13.6 remains current on 2026-09-26.
- Current OpenAPI still confirms:
  - `/user/bars`: Minimal, Stable;
  - `/user/cooldowns`: Minimal, Stable;
  - `/user/battlestats`: Limited, Stable;
  - `/user/gym`: description says Minimal while declared key parameter is Public;
  - `/user/perks`: same Minimal/Public discrepancy;
  - `/user/refills`: Minimal, Stable;
  - `/user/inventory`: Minimal, Stable, cached one hour per category;
  - `/torn/gyms`: Public, Unstable.
- Complete Cardio live normalization remains consistent with 10E and 5.5 / 5.8 / 5.5 / 5.2.
- Inventory complete-pagination absence-to-zero and planning-only freshness remain coherent.
- PR #125 corrected Point-refill semantics are preserved: refill policy is `natural_max`, not additive stack Energy.

## Finding V126-01 — paid refill mapping omitted special refills and current cost

Severity: **blocking specification gap; corrected in PR #126 docs/fixtures**

Current `/user/refills` requires `special_count`. The v2 refactor documented refills as "just renamed fields"; the historical v1 field was `special_refills_available`.

Current Torn Points documentation states:

- a daily Energy refill costs **30 Points**;
- paid daily refill resets at New Day;
- if free/special refills exist, they must be used before the daily refill.

Therefore `pointRefill.allowed <- !refills.energy` was insufficient by itself.

Frozen v0.1 direction:

- `refills.energy == true` => paid daily Energy refill already used;
- `refills.energy == false && special_count == 0` => paid daily refill may be exposed, with current configured cost 30 Points;
- `special_count > 0` => do not expose the paid-refill planner path as READY in v0.1; special/free refill sequencing is a separate capability and must be modeled before optimization can assume the paid refill is immediately usable;
- the 30-Point cost is versioned/configured provenance, not inferred from `/user/refills`.

Historical pure-planner tests using 25 as a synthetic `pointsRequired` value remain arithmetic fixtures and are not current-cost claims.

## Finding V126-02 — booster maximum is a use threshold, not a hard post-item ceiling

Severity: **blocking upstream planner semantics defect**

Current Torn cooldown documentation says booster cooldown has a base maximum of 24 hours and that once the cooldown is over the maximum, further booster items cannot be used until it drops below the maximum. Current 2026 guidance states the operational rule explicitly: an item may push the cooldown over the listed maximum if the cooldown was below the maximum before use.

Project evidence independently points the same way:

- DQ-TRAIN-001B's live elevated-Happy calibration successfully used **five Erotic DVDs** (+30 hours base booster cooldown total);
- the later live perk specimen recorded no maximum-booster-cooldown faction modifier.

The merged pure planner currently enforces the stricter rule:

```text
currentBooster + plannedAddedCooldown <= boosterMax
```

in recipe generation, composition, and readiness. That can suppress a legal final booster and can miss the classic five-eDVD preparation when base maximum is 24h.

Correct target semantics:

```text
before each booster:
  currentBoosterCooldown < boosterMaxSeconds

after item:
  currentBoosterCooldown += itemCooldown
  # result may exceed boosterMaxSeconds

if currentBoosterCooldown >= boosterMaxSeconds:
  no next booster until it is observed below the maximum
```

For a sequence that reaches the maximum exactly, a later booster requires an explicit wait/observation below the maximum. Do not hide that checkpoint by assuming time passed.

This cannot be repaired solely by adapter normalization without distorting the source value. A bounded pure-planner correction is required before adapter runtime build.

## Finding V126-03 — calibration confidence gate was broader than the accepted evidence

Severity: **specification overclaim; corrected conservatively in PR #126**

The candidate adapter contract allowed `calibratedDomain:true` from:

- Complete Cardio;
- expected dots / 10E;
- supported gain perks;
- no unsupported effect;
- start stat <=50m.

That is broader than the accepted B1-B4 evidence. The calibration results explicitly bound the observed domain to:

- ordinary-Happy all four stats in the observed lanes;
- elevated Happy around 33k only for Speed and Strength;
- 11-train sequential batches only for Speed and Strength;
- recorded modifier stacks;
- observed stat-magnitude lanes;
- Complete Cardio / 10E.

The merged pure planner also treats `state.calibratedDomain` as one plan-global boolean, so a true value would label every generated recipe CALIBRATED even if a recipe moves Happy into an unobserved lane.

Frozen conservative v0.1 adapter rule:

- general/open-ended strategy generation emits `calibratedDomain:false`;
- `true` is permitted only in an explicitly calibration-locked invocation whose entire candidate set is constrained to a documented B1-B4 lane;
- no faction-shareable generic adapter may infer that lock from only gym + modifiers + <=50m;
- a future planner improvement may replace the global boolean with plan-specific calibration classification.

This preserves arithmetic support while preventing false confidence labels.

## Finding V126-04 — dynamic item fail-closed behavior lacked a planner-facing projection rule

Severity: **specification gap; corrected in PR #126**

The candidate said Candy/eDVD/cooldown modifiers fail closed but did not define how to stop the pure planner from generating those preparations.

Frozen adapter projection rule:

- preserve raw planning inventory separately;
- construct planner-facing `itemMechanics` only for item classes whose dynamic modifier state is fully supported/verified;
- omit unsupported Candy/eDVD/etc mechanics from the planner-facing mechanic map;
- retain an unsupported material-effect record for explanation;
- do not rely on `activeEffects` alone to suppress preparation candidates because the current pure planner only localizes unsupported gym-gain effects.

## Finding V126-05 — Candy event state must be explicit

Severity: **specification gap; corrected in PR #126**

Base Candy Happy is not always the executable value. Current Torn documentation identifies World Diabetes Day, faction Candy effect, the Yes Please Diabetes book, and company cooldown modifiers as material.

Frozen v0.1 rule:

- base Candy mechanics may be exposed to the planner only when all relevant dynamic Candy/cooldown state is verified absent/inactive;
- event state must be explicit from approved server-time/event logic;
- if World Diabetes Day or another material Candy event state is active/unknown, Candy preparation fails closed in v0.1 rather than silently using base Happy.

## Finding V126-06 — stale continuation text

Severity: **documentation-only; corrected**

Carried-forward documents still referenced verifying PR #124 and listed already-resolved refill/permission items as blockers. Those pointers are updated to PR #126 / capability-bounded state.

## Freeze disposition

V1-V3 do **not** support final adapter-build authorization yet because V126-02 is an upstream planner semantics mismatch.

Everything else in the 001D source/freshness contract can proceed as specification-frozen after the amendments in this PR.

Next required gate:

```text
[B][BUG] bounded booster-cooldown threshold/one-item-overcap correction
-> [V] planner re-verification
-> return to PR #126 final 001D freeze
-> separate [B] adapter implementation authorization
```

PR #126 remains draft/unmerged. No release or branch deletion is authorized.
