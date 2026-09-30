# DQ-TRAIN-001J — Runtime / Browser / UI Integration Specification

Status: **FROZEN BY OWNER [S] FOR INDEPENDENT [V]; DOCUMENTATION/FIXTURES ONLY; RUNTIME IMPLEMENTATION REQUIRES SEPARATE OWNER [B][WORK]**

Prepared: 2026-09-30

Authoritative baseline:

`main@8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`

This baseline is the merge commit for independently verified PR #133, DQ-TRAIN-001J-P. The exact verified implementation head was `7b1b31c60efcd8cbd0c13d32ee1d44fa84b7bcf0`.

## 1. Purpose

DQ-TRAIN-001J freezes the runtime acquisition, browser packaging, and beginner/advanced presentation contract for the already-merged Training Advisor planner and adapters.

The product question remains:

> Given trustworthy current player state and explicit preferences, what should the player do next, why, what should it cost, and what gain should they expect?

This specification does not implement that product. It freezes the boundary a later implementation must satisfy.

## 2. Existing canonical layers

The following merged modules remain authoritative:

- `src/training-advisor-pure.js` — pure generation, simulation, ranking, readiness, and recommendation;
- `src/training-advisor-adapters.js` — source normalization, provenance, freshness, capability degradation, item-mechanic projection, and selected-plan inventory proof.

DQ-TRAIN-001J MUST NOT duplicate or reinterpret their arithmetic, ranking, item mechanics, freshness semantics, or reason-code contracts in the browser/UI layer.

DQ-TRAIN-001J-P is a completed prerequisite. Selected-plan inventory execution confirmation now supports item-local LIVE proof for current confirmed owned quantities while cached API inventory remains planning-grade. Purchased quantities remain governed by acquisition availability rather than being double-charged against confirmed owned inventory.

## 3. Product safety boundary

The Training Advisor is advisory only.

Allowed:

- user-triggered source refresh;
- calculations, comparisons, predictions, warnings, timers/countdowns, checklists, and explanations;
- current-state summaries;
- inventory-aware planning and explicit current item confirmation;
- manual preference input;
- human-readable next-action guidance;
- local-only UI preferences.

Not authorized:

- automatic item or drug use;
- automatic training;
- automatic Point-refill use;
- automatic booster use;
- automatic purchasing;
- unattended gameplay sequencing;
- hidden background polling;
- remote TornScriptures player-state services;
- upload of private player state, API keys, inventory, or calibration history.

Gameplay instructions are text. The player performs actions in Torn; TornScriptures re-observes and replans.

# Part A — Source acquisition and refresh contract

## 4. User-triggered observation epochs

The primary acquisition action is:

`Refresh & Plan`

Each invocation creates a new **refresh epoch**. The runtime records the start/completion of that refresh for diagnostics, but each material field retains its own source identity, observation timestamp, cache class, and freshness. A refresh epoch is not falsely presented as an atomic server transaction.

No periodic background polling is required or authorized for v0.1.

After a material player action or a planner `VERIFY_STATE` checkpoint, the previous execution-sensitive observation epoch is no longer sufficient to authorize the next consequential step. The UI requires another Refresh & Plan.

A local countdown may display elapsed/remaining time derived from an already observed cooldown. Reaching zero may change the message to "refresh now"; it MUST NOT promote state to LIVE or independently authorize an action.

## 5. Runtime source map

| Domain | Preferred runtime source | Contract |
|---|---|---|
| current Energy, natural maximum, regen, current Happy | `GET /user/bars` | current state; execution-sensitive fields require LIVE evidence |
| ordinary/base Happy candidate | guarded `/user/bars.happy.maximum` mapping | existing adapter guard remains authoritative |
| drug and booster cooldowns | `GET /user/cooldowns` | current execution-sensitive countdowns |
| battle stats | `GET /user/battlestats` | capability-gated; existing explicit manual fallback remains allowed |
| active gym identity | `GET /user/gym` | capability-gated |
| gym catalog/mechanics | `GET /torn/gyms` | schema-guarded public catalog; failure disables dependent prediction only |
| gain perks/effects | `GET /user/perks` | capability-gated; unknown material modifiers fail closed |
| Point refill used/special state | `GET /user/refills` | current refill state; cost mechanic remains separately versioned/configured |
| current Points balance | `GET /user/money -> money.points` or approved explicit current confirmation | must satisfy execution freshness for paid-refill readiness |
| relevant inventory | `GET /user/inventory?cat=Drug|Booster|Candy` | planning only because category responses are cached; never execution proof by HTTP recency alone |
| Torn/server timing anchor | approved Torn timestamp selection | timing evidence only when source contract is established |
| player event timing | `GET /user/calendar` | candidate source for personalized event interval |
| event definitions | `GET /torn/calendar` | candidate source for fixed/personalized event semantics |
| stack cap, refill cost, base item mechanics | versioned TornScriptures mechanics | no runtime Wiki fetch |
| market economics | separately approved typed `MarketSnapshot` path | optional; gain-only planning may continue when economics are not required |

The runtime requests only data materially needed by the Advisor. Unrelated profile, messages, trades, attacks, faction chat, or broad inventory categories are out of scope.

## 6. Capability isolation and batching

Torn API multi-selection batching may be used only when it preserves the same capability isolation, error handling, provenance, and freshness semantics as separately acquired selections.

A giant all-or-nothing request is not part of the frozen contract.

If one permission or selection fails, unrelated normalized capabilities continue when their own evidence remains sufficient.

Examples:

- battlestats denied -> manual stats may continue;
- market unavailable -> gain-only objectives may continue;
- inventory planning unavailable -> noninventory routes may continue;
- gym schema mismatch -> gain prediction fails closed while unrelated state remains visible;
- perks unavailable/ambiguous -> no zero-assumption for material gain modifiers.

## 7. Inventory planning versus execution

API inventory remains planning-grade. A new HTTP response cannot make the category cache execution-LIVE.

For immediate execution readiness of owned items, use the merged DQ-TRAIN-001J-P contract:

- current confirmation is scoped to selected-plan registry items;
- accepted quantities require current confirmation evidence, LIVE freshness, a valid inventory-confirmation timestamp, and nonnegative safe-integer quantities;
- only explicitly confirmed keys receive item-local LIVE proof;
- current confirmation overrides conflicting cached values for those keys, including explicit zero;
- unrelated cached items remain planning-grade;
- confirmed owned quantity must cover only `ownedItemsConsumed`;
- `boughtItems` remain governed by the existing acquisition availability gate;
- partial confirmation never globally promotes `inventoryFreshness` or `capabilities.inventoryExecution`.

The UI SHOULD request confirmation only for owned items actually required by the selected plan, not the entire registry.

Any contradiction changes the next normalized state and requires replanning.

## 8. Current Points and paid-refill execution

`/user/refills` does not establish current Points balance.

Paid-refill execution readiness requires:

- refill currently allowed under the merged refill contract;
- versioned Point cost mechanic valid;
- current Points balance proof with execution freshness;
- sufficient Points for the selected plan.

If current Points cannot be obtained automatically, an approved explicit current player confirmation may be normalized through the existing confirmation boundary. No balance may be invented.

## 9. Market/economic degradation

Market prices remain world state, separate from player state.

If the selected objective requires economics and trustworthy economics are unavailable, that comparison fails closed according to existing planner policy.

If the selected objective can operate without economics, gain planning may continue. The UI must say that cost comparison is unavailable rather than fabricating prices.

## 10. Request-budget discipline

Refresh behavior is optimized for correctness and restraint, not for consuming the API rate ceiling.

v0.1 requirements:

- no background heartbeat;
- one in-flight Refresh & Plan operation at a time;
- deduplicate public/slower catalog acquisition where safe;
- avoid pointless immediate refetches of one-hour cached inventory;
- preserve per-source metadata even when requests are parallelized;
- re-observe after material checkpoints rather than forecasting uncertain future state.

## 11. H1 — Happy quarter-hour timing evidence gate

`/user/bars.happy.tick_time` remains a candidate timing source.

DQ-TRAIN-001J does **not** freeze the claim that this field is proven to represent the elevated-Happy quarter-hour reset used for Ecstasy execution safety.

Before a runtime timing adapter may emit authoritative `timing.safeQuarterWindow` from that relationship, H1 requires a controlled sanitized elevated-Happy specimen tying the field to the actual relevant reset.

Until H1 passes:

- planning may continue where otherwise valid;
- Ecstasy/elevated-Happy execution readiness remains fail-closed under the existing timing contract;
- the UI may explain the missing timing proof;
- no local-clock guess may be promoted as authoritative.

## 12. H2 — personalized Candy-event interval evidence gate

Calendar date alone is not sufficient to determine a player-specific World Diabetes Day interval.

Candidate inputs are:

- `/torn/calendar`;
- `fixed_start_time` semantics;
- `/user/calendar`;
- authoritative server time.

Before Candy mechanics may depend on the exact personalized event interval, H2 requires sanitized live evidence proving the calculation.

Until H2 passes, affected Candy execution mechanics fail closed where event state materially changes the result. This gate does not block unrelated Training Advisor capabilities.

# Part B — Browser packaging and runtime boundary

## 13. Canonical-source rule

The planner and adapter under `src/` remain the single source of truth.

A future userscript MUST NOT contain a manually maintained copy of planner or adapter logic.

The intended production flow is:

```text
canonical pure planner
+ canonical adapters
+ browser runtime/acquisition
+ UI/presentation
        |
        v
deterministic Node-core build
        |
        v
TornScripture-Training-Advisor.user.js
```

The generated userscript is a release artifact, not the canonical editing location for planner/adapter behavior.

## 14. Future source layout

A later implementation may introduce a bounded layout equivalent to:

```text
src/training-advisor-pure.js
src/training-advisor-adapters.js
src/training-advisor-runtime.js
src/training-advisor-ui.js
scripts/build-training-advisor.js
TornScripture-Training-Advisor.user.js
```

Names may be adjusted during implementation only when behavior and verification remain equivalent.

No such files are created by this specification.

## 15. Standalone artifact

The released userscript must be self-contained.

v0.1 MUST NOT depend on:

- runtime GitHub source fetching;
- CDN module loading;
- remote planner execution;
- production `@require` dependencies;
- a TornScriptures backend service.

The future build may wrap the canonical CommonJS modules in private module capsules and capture their existing `module.exports` interfaces.

No npm package/bundler dependency is required by this specification. A later implementation may propose one only if the small deterministic generator proves insufficient and the owner separately approves that architecture.

## 16. Deterministic build and drift protection

The build contract requires:

- unchanged canonical inputs produce byte-identical generated output;
- the artifact records auditable build/source provenance, such as hashes or equivalent manifest data;
- regenerated output must match the checked-in artifact;
- manual edits to embedded canonical code must be detectable;
- representative frozen planner/adapter behavior must be exercisable through the built userscript.

Recommended test hooks:

- `__TS_TRAINING_ADVISOR_TEST_MODE__`
- `__TS_TRAINING_ADVISOR_TEST_EXPORTS__`

The build/test harness must not perform Torn network requests during fixture verification.

## 17. Runtime/acquisition responsibilities

The runtime layer owns:

- TornPDA managed-key resolution;
- desktop/browser fallback-key handling;
- official Torn API requests;
- refresh epochs;
- source metadata/timestamps;
- inventory pagination;
- acquisition errors;
- explicit manual confirmations;
- future H1/H2 source acquisition after those evidence gates pass.

It does not own planner ranking, training arithmetic, or UI policy.

API keys may be sent only to the official Torn API.

## 18. Adapter responsibilities

The adapter layer owns:

- raw-source normalization;
- provenance;
- freshness;
- cache-class preservation;
- capability degradation;
- selected-plan inventory confirmation normalization;
- supported mechanic projection.

It performs no network, DOM, storage, or clock I/O.

## 19. Pure-planner responsibilities

The pure planner owns:

- candidate generation;
- simulation;
- ranking;
- readiness;
- recommendation identity;
- checkpoint/replan semantics.

Browser/UI code MUST NOT independently decide which strategy "wins."

## 20. UI responsibilities

The UI owns:

- presentation;
- editing user preferences;
- showing planner-provided next manual action;
- invoking Refresh & Plan;
- collecting explicit current confirmations;
- presenting provenance/freshness/confidence explanations.

It must not recreate formulas or silently change planner outcomes.

## 21. Storage boundary

v0.1 persists user-authored preferences/UI state only.

Suitable examples:

- objective;
- target stat/allocation mode;
- budget/cash reserve;
- Point policy;
- item restrictions;
- max wait/patience;
- risk policy;
- beginner/advanced mode;
- theme;
- HUD position;
- collapsed state;
- desktop fallback API key under the established TornScriptures local-key pattern when TornPDA does not inject one.

Raw current bars, battle stats, Happy, cooldowns, Points, inventory responses, and recommendation history are not durable authority by default.

A current recommendation snapshot may remain in memory for checkpoint explanation.

A new `PDA_storage` dependency is not required for v0.1.

# Part C — Beginner / Advanced UI and interaction contract

## 22. Three separate axes

The UI MUST distinguish:

1. **Recommendation** — whether the planner found a defensible plan;
2. **Readiness** — whether the selected plan's next consequential step is ready now;
3. **Confidence** — how strongly the modeled result is supported.

Readiness states are:

- `READY`
- `WAITING`
- `NEEDS_ITEMS`
- `NEEDS_REFRESH`
- `BLOCKED`

Confidence is separate, including:

- `CALIBRATED`
- `SUPPORTED_EXTRAPOLATION`
- `EXPERIMENTAL`

`EXPERIMENTAL` MUST NOT be rendered as a readiness state.

## 23. Compact HUD

The future product should use established TornScriptures mobile-safe HUD patterns:

- draggable via pointer/touch-safe handling;
- clamped on screen;
- collapsible;
- theme-aware;
- no hover-only controls.

The compact view should prioritize:

- readiness;
- plan identity;
- target stat;
- next manual action;
- Refresh & Plan;
- Open.

Detailed provenance does not belong in the mini HUD.

## 24. Beginner full view

The beginner surface is mission-oriented.

It SHOULD show:

- target stat/allocation;
- active objective;
- readiness;
- selected plan;
- one prominent **NEXT** instruction;
- approximate expected gain;
- material cost/resource summary;
- wait/active time where supported;
- concise "why this plan";
- ordered plan/checkpoint sequence;
- Refresh & Plan;
- a bounded set of meaningful alternatives;
- access to Advanced details.

Internal precision may remain high, but beginner output avoids false precision.

## 25. Manual-action safety rule

Allowed presentation:

- "Next: Take 1 Xanax"
- "Refresh after taking it"
- "Wait for booster capacity, then refresh"

Not authorized:

- a button that consumes Xanax;
- a button that takes Ecstasy;
- a button that uses a booster;
- a button that trains;
- a button that spends a refill;
- unattended action chaining.

Buttons may refresh, open settings/details, collect confirmation, or navigate within the Advisor. Gameplay remains human-controlled in Torn.

## 26. Checkpoint UX

At `VERIFY_STATE` or another material checkpoint, the UI explicitly requires refresh.

For random future drug cooldowns, the UI does not fabricate a future multi-Xanax schedule.

The pattern is:

```text
manual action
-> checkpoint
-> Refresh & Plan
-> observe reality
-> replan
```

Already spent resources may be explained/preserved by planner semantics, but stale assumptions are not silently advanced.

## 27. Human-readable readiness treatment

Beginner wording should be stable in meaning:

| Machine state | Beginner meaning |
|---|---|
| `READY` | Ready now; show next manual action |
| `WAITING` | A known wait/checkpoint blocks immediate continuation |
| `NEEDS_ITEMS` | Required resource/acquisition is not currently satisfied |
| `NEEDS_REFRESH` | Current proof is missing/stale; identify the smallest material refresh need |
| `BLOCKED` | A specific mechanic/safety condition prevents the step |

Stable reason codes remain inspectable in Advanced mode, including at least:

`DATA_STALE`, `DATA_MISSING`, `CAPABILITY_UNAVAILABLE`, `RESOURCE_MISSING`, `COOLDOWN_BLOCKED`, `TIMING_UNSAFE`, `STATE_CHANGED`, `MODEL_OUT_OF_DOMAIN`, `UNSUPPORTED_EFFECT`, `ECONOMICS_UNAVAILABLE`, `NO_SAFE_RECOMMENDATION`, and `BOOSTER_LIMIT_REACHED`.

The browser/UI layer must expose the machine reason actually emitted by the merged canonical layers. In particular, current adapter permission failures normalize to `CAPABILITY_UNAVAILABLE`; the UI must not invent or substitute the older specification label `PERMISSION_MISSING`.

## 28. Required-item confirmation UX

When selected-plan owned items need current proof, the UI asks only for those items and required quantities.

Example:

```text
Required now
Xanax      1
eDVD       2
Ecstasy    1
```

The confirmation is explicit current player input and must carry the normalized evidence required by DQ-TRAIN-001J-P.

If confirmed values contradict cached planning inventory, current confirmation wins for those keys and a new recommendation is produced.

Purchased quantities are displayed separately from owned quantities and are not represented as preexisting confirmed inventory.

## 29. Beginner objective labels

Human labels map deterministically to existing planner objectives:

| UI label | Planner objective |
|---|---|
| Balanced | `BALANCED` |
| Biggest Gain | `MAXIMUM_GAIN` |
| Best Value | `BEST_VALUE` |
| Stay Under Budget | `BUDGET_CAP` |
| Use What I Own | `USE_MY_INVENTORY` |
| Train Soonest | `FASTEST_USEFUL` |

Balanced is the default beginner objective.

No hidden weighted sliders are introduced.

## 30. Alternatives

Beginner mode displays only a small set of meaningful alternatives, preferably two or three when available.

Useful roles include:

- current-objective winner;
- maximum gain;
- lower/new-cash or use-my-inventory option;
- train-now / fastest option.

Comparisons should use human tradeoffs such as gain difference, cash difference, or wait difference.

The full frontier remains an Advanced concern.

## 31. Confidence presentation

Confidence remains visible but secondary to readiness.

Examples:

- Calibrated;
- Supported model;
- Experimental prediction.

Experimental/support labels never convert an otherwise blocked or stale plan into READY.

## 32. Advanced surface

Advanced mode may use tabs or collapsible sections such as:

- Plan;
- State;
- Sources;
- Economics;
- Alternatives;
- Model;
- Rejected / Diagnostics.

It may expose:

- full ordered plan;
- normalized state;
- field provenance/freshness/source IDs;
- observation timestamps/cache classes;
- complete owned versus bought resource accounting;
- replacement value/new cash/Points;
- natural Energy lost;
- cooldown commitment;
- model ID/confidence/calibrated-domain status;
- supported gain interval where available;
- unsupported effects;
- meaningful rejected candidates and machine reason codes.

Advanced presentation MUST NOT alter planner output.

## 33. Degraded capability UX

Failures are capability-local.

Examples:

- battlestats unavailable -> offer the supported manual-stat path;
- economics unavailable -> say gain planning remains available when valid;
- API inventory planning-only -> recommendation may exist while selected-plan owned items need confirmation;
- unsupported gym shape -> gain prediction withheld;
- unknown material modifier -> affected prediction withheld;
- missing permission -> identify the affected capability rather than declaring the whole Advisor broken.

## 34. No-safe-recommendation UX

`NO_SAFE_RECOMMENDATION` receives a deliberate screen.

It explains:

- what is known;
- what is missing/unsupported;
- why ranking/prediction was withheld;
- the smallest actionable input/refresh capable of restoring support;
- the Advanced machine reason.

An empty panel is not acceptable.

## 35. Refresh behavior

There is one dominant current-state action:

`Refresh & Plan`

During a long refresh, the UI may show bounded progress by source class. It must not imply completion for sources that failed.

On completion, the UI may show "updated just now" or equivalent. After a material player action, the UI marks the previous state as requiring refresh rather than silently projecting authority forward.

## 36. Mobile/theme behavior

TornPDA Android is first-class.

Requirements:

- full-screen or near-full-screen detail overlay on narrow displays;
- desktop max-width layout;
- touch-sized controls;
- no horizontal table dependency for essential information;
- no hover-only interaction;
- Auto / Dark / Light theme support;
- compact HUD position/collapse persistence.

# Part D — Normative fixtures, evidence gates, and implementation gate

## 37. Normative acceptance fixtures

`RUNTIME-UI-INTEGRATION-FIXTURES-001J.json` is the normative synthetic fixture set for this specification.

It contains:

- 11 acquisition/refresh cases, J-A1 through J-A11;
- 8 packaging/runtime-boundary cases, J-B1 through J-B8;
- 15 UI/interaction cases, J-C1 through J-C15.

All cases are synthetic and nonprivate.

The fixtures freeze required behavior, not final CSS, copy punctuation, or exact DOM structure.

## 38. Evidence-gate treatment

H1 and H2 are specification inputs marked **OPEN_LIVE_EVIDENCE_REQUIRED**.

They are not fixture failures and do not prevent unrelated implementation work.

A future implementation must preserve their fail-closed behavior and cannot mark them resolved from synthetic tests alone.

## 39. Implementation exclusions

This specification does not authorize or create:

- `TornScripture-Training-Advisor.user.js`;
- runtime/acquisition source;
- UI source;
- build generator;
- package manifest;
- dependency installation;
- workflow;
- storage migration;
- listener/timer/observer;
- live API request;
- API key;
- private player data;
- gameplay action.

No existing planner/adapter source or tests are changed by this freeze.

## 40. Future implementation acceptance

A later owner-authorized `[B][WORK]` implementation must:

1. start from the exact post-spec verified baseline selected at that time;
2. preserve all 001A–001I and 001J-P behavior;
3. make all applicable 001J acceptance fixtures executable or otherwise deterministically verified;
4. prove deterministic standalone generation and source/artifact parity;
5. run focused and full repository regressions;
6. perform desktop and TornPDA manual smoke testing for UI/runtime behavior;
7. keep H1/H2 fail-closed until their separate live evidence gates pass;
8. remain advisory-only;
9. stop for independent `[V]` before merge/release.

## 41. Specification verification

Independent `[V]` of this documentation freeze should verify:

- baseline is exactly `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`;
- PR #133/J-P is represented as merged and complete;
- fixture JSON parses and all 34 IDs are unique;
- A/B/C fixture counts are 11/8/15;
- H1/H2 remain open;
- source acquisition does not silently promote cached inventory;
- selected-plan confirmation matches merged J-P semantics;
- packaging does not rely on runtime source loading or TornPDA `@require`;
- UI keeps recommendation/readiness/confidence distinct;
- no gameplay controls are authorized;
- no product/runtime/test/userscript/workflow/storage/release files changed;
- edited NDJSON parses;
- Markdown local links/headings are valid;
- complete branch-to-main diff is documentation/fixture only.

## 42. Rollback

Before merge, rollback is leaving the documentation PR unmerged.

After a separately authorized future merge, rollback is reverting the documentation commit. No runtime state, browser storage, player data, or gameplay state is changed by this specification freeze.
