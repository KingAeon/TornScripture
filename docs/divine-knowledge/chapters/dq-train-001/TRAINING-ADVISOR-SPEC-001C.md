# DQ-TRAIN-001C — Training Advisor / Happy Jump Navigator v0.1 Product Specification

Status: **DRAFT SPECIFICATION; OWNER REVIEW ACTIVE; NO PRODUCT IMPLEMENTATION AUTHORIZED**

Opened: 2026-09-25 by owner `[S]` instruction.
Depends on:
- `DQ-TRAIN-001A` frozen Training Math Engine contract;
- `DQ-TRAIN-001B` live calibration results;
- owner acceptance of `vladar-v2-pre50m-v1` as `calibrated_observed_domain` in the documented evidence domain.

## 1. Mission

Build a faction-shareable TornScriptures Training Advisor whose first major feature is the Happy Jump Navigator.

The advisor must answer:

> Given this player's current state, inventory, budget, available gym, modifiers, cooldowns, and activity window, what should they do next, why, what should it cost, and what improvement should they expect?

The product must remain useful at two depths:

- **Beginner surface:** one clear next action, required resources, timing, approximate cost, expected outcome, and concise reason.
- **Advanced surface:** assumptions, model status, confidence, opportunity costs, full economics, rejected alternatives, marginal-value analysis, and detailed plan state.

Complexity may be hidden in the UI. It must not be discarded from the planner when it materially affects correctness or explanation.

## 2. Product boundary

The advisor is advisory-only.

It MAY:

- normalize authorized Torn/API/page-visible state;
- accept manual player inputs and preferences;
- simulate training and resource timelines;
- compare strategies;
- rank strategies under selectable objectives;
- warn, remind, explain, and show readiness;
- preserve a resumable local plan;
- replan after state changes;
- expose confidence and unsupported mechanics.

It MUST NOT:

- automatically consume items;
- automatically take drugs;
- automatically use refills;
- automatically train;
- send unattended gameplay requests;
- background-watch DOM state in violation of current Torn scripting rules;
- hide unsupported mechanics behind silent defaults;
- upload or commit private player state, API keys, inventory snapshots, session data, or raw personal calibration history.

## 3. v0.1 objective modes

The planner MUST support selectable objectives from the first product version.

### 3.1 Maximum Gain

Maximize projected total stat gain subject to hard player constraints.

Cost and wait time remain visible, but do not reduce ranking unless constrained by the player.

### 3.2 Best Value

Prefer the strongest marginal stat gain per economic value consumed.

The planner MUST apply a usefulness floor so that tiny, technically efficient plans do not defeat materially better practical plans.

The exact usefulness threshold is a policy constant to be frozen with planner fixtures, not guessed in this document.

### 3.3 Budget Cap

Maximize projected gain without exceeding a user-defined spending ceiling.

Budget is a hard constraint, not a ranking preference.

### 3.4 Use My Inventory

Prefer plans that minimize new cash outlay by consuming suitable owned resources first.

Owned items have:

- zero new cash outlay at time of execution; and
- nonzero replacement/opportunity value.

Both MUST be preserved. The beginner surface may show "already owned" while Advanced mode exposes consumed market value.

### 3.5 Fastest Useful Plan

Prefer the earliest practical completion of a materially useful training session.

The planner MUST compare immediate training against short waits that unlock meaningfully better outcomes.

### 3.6 Balanced

Balanced is the default beginner objective.

Balanced MUST NOT be implemented as one opaque fixed weighted score across all candidate plans.

Instead:

1. enforce hard constraints;
2. remove dominated strategies;
3. retain a Pareto frontier across gain, cost, wait, resource usage, and confidence;
4. favor a knee-of-the-curve plan where substantially greater spending or waiting produces comparatively small additional gain;
5. explain the tradeoff in human-readable terms.

## 4. Hard constraints

Hard constraints are walls, not preferences.

v0.1 SHOULD support:

- maximum new cash spend;
- minimum cash reserve;
- points/refill policy;
- prohibited consumables;
- owned-items-only mode;
- target stat;
- maximum wait time;
- player activity/play window;
- patience profile;
- resource preservation rules;
- supported-model boundary;
- user-selected risk restrictions where applicable.

Plans that violate a hard constraint MUST NOT enter the ranked candidate set.

## 5. Core normalized inputs

Planner logic MUST NOT consume raw API, DOM, or market payloads directly.

Adapters normalize external state into three separate logical inputs:

1. `ObservedState`
2. `PlanningPreferences`
3. `MarketSnapshot`

The planner consumes normalized values and provenance only.

## 6. ObservedState contract

Conceptual shape:

```text
ObservedState
  stats
  bars
  cooldowns
  gym
  modifiers
  inventory
  specials
  provenance
  observedAt
```

### 6.1 Required player-state domains

The normalizer SHOULD represent:

- Strength;
- Speed;
- Defense;
- Dexterity;
- current Energy;
- natural Energy maximum;
- current Happy;
- base/max ordinary Happy;
- drug cooldown;
- booster cooldown;
- active/current gym;
- normalized gym dots by stat;
- energy cost per internal train;
- explicit gain modifiers;
- relevant inventory quantities;
- active books/events/special effects when detectable;
- source and freshness metadata for each material field.

### 6.2 State provenance classes

Each material state value MUST identify its provenance:

- `OBSERVED` — directly obtained from an approved current source;
- `CONFIGURED` — explicitly supplied/persisted by the player;
- `DERIVED` — calculated from stronger normalized inputs;
- `ASSUMED` — fallback assumption.

Material `ASSUMED` values MUST NOT silently produce authoritative recommendations.

General rule:

> Observed and Configured values may create Derived values. Assumed values may not silently become authoritative advice.

### 6.3 Freshness classes

Each mutable value MUST be classifiable as:

- `LIVE` — suitable for immediate execution readiness;
- `FRESH` — suitable for planning/comparison;
- `STALE` — displayable, but confirmation/refresh required before consequential use;
- `UNKNOWN` — not safely available.

Freshness policy is field-specific.

Energy, Happy, and cooldowns require stricter freshness than slowly changing modifiers.

Inventory freshness MUST respect source-specific caching. A cached inventory snapshot may be sufficient for planning but insufficient to prove an item is still present immediately before use.

### 6.4 State authority

When values conflict, fresher direct reality wins.

Conceptual priority:

1. fresh observed state;
2. explicit current player confirmation;
3. recent API state;
4. derived state;
5. stale state;
6. assumption.

Adapters MAY define field-specific exceptions where a source contract requires them.

## 7. Modifier contract

The normalizer MUST preserve modifier ingredients rather than only a flattened multiplier.

Conceptual representation:

```text
Modifier
  id
  rate
  scope
  source
  confidence
  observedAt
  expiresAt?
```

Examples include:

- property gym-gain modifier;
- faction stat-specific modifier;
- education modifier;
- supported company/job modifier;
- supported book/event modifier.

Unknown or ambiguously ordered modifiers MUST NOT be silently treated as zero.

The pure math engine receives only explicit supported gain modifiers.

## 8. PlanningPreferences contract

Conceptual shape:

```text
PlanningPreferences
  objective
  targetStat
  statAllocationMode
  budget
  cashReserve
  pointPolicy
  itemRestrictions
  maxWait
  patienceProfile
  playWindow
  riskPreference
```

### 8.1 Stat allocation modes

v0.1 SHOULD support:

- `TARGET_STAT`
- `WEAKEST_STAT`
- `BALANCED_STATS`

A future battle-impact objective is deferred until a defensible combat-impact model exists.

### 8.2 Patience profiles

v0.1 SHOULD expose simple patience choices rather than low-level time-weight sliders:

- `TRAIN_ASAP`
- `CAN_WAIT`
- `LONG_TERM`

These influence waiting-plan ranking but do not override hard maximum-wait constraints.

## 9. MarketSnapshot contract

Market prices are world state, not player state.

Conceptual shape:

```text
MarketSnapshot
  items[]
  pointValue?
  fetchedAt
  freshness
  source
```

Each relevant item price SHOULD preserve:

- item identity;
- executable or chosen price concept;
- quantity support where material;
- source;
- fetched time;
- freshness;
- confidence/availability.

If economics data is unavailable, gain simulation MAY continue while price-based ranking capability is disabled.

Catalog reference values, average prices, and executable listing prices MUST remain distinct concepts.

## 10. Capability model

The advisor SHOULD expose internal capability flags such as:

```text
canPredictGain
canCompareCost
canScheduleJump
canUseInventory
canAssessReadiness
canRankLongTerm
```

Missing one data source MUST NOT automatically disable unrelated capabilities.

Examples:

- no market price -> gain comparison can continue, value ranking disabled;
- no inventory -> purchase-everything scenarios may continue;
- no current Energy -> strategy comparison may continue, execution readiness disabled;
- unsupported gain modifier -> exact affected gain prediction withheld.

## 11. Strategy generation

Strategy generation MUST be hierarchical.

### 11.1 Stage A: Energy preparation

Generate meaningful Energy timelines such as:

- train now;
- wait for natural Energy;
- one or more Xanax uses;
- full stack where valid;
- refill-assisted variants when allowed;
- micro-jump-sized Energy states.

Do not enumerate arbitrary minute-by-minute waits.

Meaningful wait checkpoints include:

- next drug cooldown;
- next booster cooldown;
- natural Energy cap;
- next player activity window;
- user maximum-wait boundary;
- quarter-hour Happy timing boundary where relevant.

### 11.2 Stage B: Happy preparation

For each viable Energy state, generate feasible Happy preparations:

- no Happy boost;
- candy + Ecstasy;
- eDVD + Ecstasy;
- mixed/owned-inventory substitutions where mechanics are supported;
- micro-jump variants.

Happy preparation MUST evaluate the exact supported item effect and modifier rules rather than using an unsafe universal shortcut.

### 11.3 Stage C: Training allocation

Combine Energy/Happy state with:

- selected stat allocation mode;
- current gym;
- supported modifiers;
- model-domain boundaries.

### 11.4 Pareto pruning between stages

The generator MUST prune dominated intermediate states.

A candidate may be discarded when another candidate is at least as good in all material dimensions and strictly better in one or more.

Dimensions may include:

- Happy produced;
- Energy available;
- cash required;
- replacement value consumed;
- booster cooldown used;
- drug cooldown used;
- wait time;
- confidence;
- resource waste.

The implementation MUST NOT brute-force and retain every consumable permutation when a bounded frontier can represent the meaningful choices.

## 12. Happy-preparation frontier

The Happy recipe engine MUST treat Happy as an intermediate resource, not the optimization objective.

Every viable recipe SHOULD preserve:

- pre-Ecstasy Happy;
- post-Ecstasy Happy;
- booster items consumed;
- cooldown consumed;
- new cash required;
- inventory replacement value consumed;
- estimated marginal training gain from the final booster step;
- reason the recipe stopped.

Possible stop reasons include:

- `BOOSTER_LIMIT_REACHED`
- `HAPPY_CAP_REACHED`
- `BUDGET_EXHAUSTED`
- `MARGINAL_GAIN_TOO_LOW`
- `USER_RESOURCE_RESTRICTION`

The planner MUST compare resulting training gain, not merely Happy per dollar.

## 13. Energy timeline economics

Energy preparation MUST preserve opportunity costs.

Relevant metrics include:

- Energy obtained from items/refills;
- Energy discarded at stack cap;
- natural regeneration forfeited while capped;
- waiting duration;
- drug uses required;
- refill resources consumed;
- remaining Energy after plan completion.

A nominal resource gain MUST NOT be treated as free when it blocks natural regeneration or is discarded by a cap.

## 14. Overdose treatment

v0.1 MUST NOT invent a risk-adjusted expected-value model without a verified overdose probability model.

Until such evidence is frozen:

- overdose is represented as risk/consequence metadata;
- plans may state how many drug uses are required;
- successful-path gain remains distinct from risk-adjusted EV;
- overdose interruption invalidates affected Energy/Happy/cooldown/readiness state;
- the plan becomes resumable/replannable only after fresh state exists.

## 15. TrainingPlan contract

Every candidate recommendation MUST reduce to the same plan representation.

Conceptual shape:

```text
TrainingPlan
  id
  fingerprint
  objective
  target
  prerequisites
  actions[]
  phase
  startState
  projectedEndState
  resources
  economics
  timing
  confidence
  warnings
  explanation
  stopReason
```

A normal 150E training session and a multi-day Happy Jump MUST use the same contract.

## 16. Plan action vocabulary

v0.1 plan actions SHOULD be limited to a small explicit set:

- `WAIT`
- `TAKE_XANAX`
- `USE_BOOSTER`
- `TAKE_ECSTASY`
- `USE_REFILL`
- `TRAIN`
- `VERIFY_STATE`

These are advisory plan steps, not executable gameplay commands.

Each action SHOULD define:

- preconditions;
- predicted state transformation;
- resources consumed;
- state fields invalidated by the action;
- confidence/model dependencies;
- verification requirement.

## 17. VERIFY_STATE behavior

`VERIFY_STATE` is a first-class action.

High-value or irreversible phases SHOULD insert verification checkpoints, especially:

- before Happy preparation;
- after Happy boosters;
- after Ecstasy;
- before large training expenditure;
- after a material deviation.

Observed state replaces predicted state when they differ.

The remaining plan MUST re-simulate from the newest trustworthy state when material.

## 18. Resumable plan phases

A plan MAY span hours or days without requiring TornScriptures to remain open.

Example phases:

- `ENERGY_STACK`
- `WAITING_COOLDOWN`
- `HAPPY_PREP`
- `ECSTASY_READY`
- `TRAINING_READY`
- `TRAINING`
- `COMPLETE`
- `INTERRUPTED`

On resume, current state is re-normalized.

If the old plan remains valid, continue from the nearest valid phase.

If not, preserve historical progress where useful and replan from current reality.

## 19. Stable plan identity

A plan SHOULD have a structural fingerprint based on meaningful strategy components such as:

- Energy preparation;
- Happy recipe;
- target/stat-allocation mode;
- resource policy;
- execution structure.

Mutable prices and predicted gains MUST NOT necessarily create a new plan identity.

This allows messages such as:

> Recommendation unchanged; estimated cost updated.

## 20. Simulation and model boundaries

The simulator uses the frozen math engine where supported.

It MUST:

- evaluate internal trains sequentially;
- preserve Happy loss and stat mutation;
- respect current model-domain limits;
- fail closed for unsupported mechanics;
- distinguish deterministic arithmetic from stochastic ranges;
- preserve calibrated-domain status separately from supported extrapolation.

### 20.1 Crossing the 50m boundary

If a train starts inside the supported model domain and ends above 50m, that train may be modeled.

The next internal train begins outside the supported domain and MUST NOT silently extrapolate.

A plan MAY return a partially modeled segment with:

- modeled train count;
- modeled gain;
- remaining Energy;
- boundary reason `MODEL_OUT_OF_DOMAIN`.

## 21. Confidence contract

Recommendation/model confidence levels:

- `CALIBRATED`
- `SUPPORTED_EXTRAPOLATION`
- `EXPERIMENTAL`
- `UNSUPPORTED`

Confidence MUST include reasons.

A plan outside the calibrated domain may be shown when the underlying specification supports the arithmetic, but it must not be presented as equally proven.

Unsupported plans MUST NOT fabricate gain values.

## 22. Ranking pipeline

The planner MUST rank in this order:

1. normalize current state;
2. enforce hard constraints;
3. generate hierarchical candidates;
4. simulate candidates;
5. remove invalid candidates;
6. Pareto-prune dominated candidates;
7. apply confidence policy;
8. rank according to selected objective;
9. generate primary recommendation and meaningful alternatives;
10. generate explanation and current next action.

The system MUST preserve sufficient metrics to explain why a candidate won or lost.

## 23. Recommendation contract

Conceptual shape:

```text
Recommendation
  status
  objective
  primaryPlan
  alternatives[]
  readiness
  outcome
  economics
  confidence
  explanation
  rejectedPlans[]
  opportunitySummary
  nextAction
  refreshTriggers[]
```

## 24. Recommendation alternatives

The beginner surface SHOULD show only a few meaningful alternatives.

Useful alternative roles include:

- best overall/current objective;
- maximum gain;
- best value;
- fastest;
- cheapest/new-cash-minimizing.

Each retained alternative SHOULD explain why it was not selected under the current objective.

Examples:

- "7% less gain but saves $9.4m";
- "more gain but exceeds your budget";
- "better value but requires 26 more hours."

The planner MUST NOT retain thousands of dominated recipe permutations solely for UI explanation.

## 25. Outcome presentation

Internal calculations may retain high precision.

Recommendation output SHOULD expose:

- expected/central gain;
- low/high range where meaningful;
- ending stat estimate;
- Energy consumed;
- Happy consumed;
- model/confidence status.

Beginner UI must not expose false precision.

Example:

> Expected gain: ~13.4k Speed

Advanced UI may expose a calculated interval and model details.

## 26. Economics contract

Each plan SHOULD preserve:

- new cash required;
- owned inventory consumed;
- replacement/market value consumed;
- points/refills consumed;
- Energy consumed;
- natural Energy lost;
- drug cooldown committed;
- booster cooldown committed;
- wait time;
- estimated active execution time.

Beginner UI may collapse this to a small summary.

Advanced UI may expose all material components.

## 27. Opportunity summary

Recommendations SHOULD preserve comparative metrics such as:

- gain vs train-now;
- gain vs cheapest viable plan;
- incremental cost vs cheaper frontier candidate;
- additional wait vs fastest candidate;
- percentage of maximum attainable modeled gain;
- marginal gain from the final booster/resource step.

These metrics power concise explanations without exposing raw formula internals by default.

## 28. Readiness contract

Readiness states:

- `READY`
- `WAITING`
- `NEEDS_ITEMS`
- `NEEDS_REFRESH`
- `BLOCKED`
- `EXPERIMENTAL`

Each recommendation MUST produce a concrete `nextAction`.

Examples:

- take Xanax when cooldown clears;
- buy 2 eDVDs;
- wait until just after the next quarter-hour;
- refresh Energy/Happy;
- unsupported modifier detected, prediction withheld.

## 29. Planning vs execution validation

Planning and execution guidance use the same plan with different strictness.

### Planning

May use sufficiently fresh data if uncertainty is preserved.

### Execution readiness

Before advising a consequential/high-value step, require fresh validation of material fields such as:

- Energy;
- Happy;
- drug cooldown;
- booster cooldown;
- required inventory;
- selected gym;
- supported modifiers;
- safe time window.

The advisor does not perform the action. It only decides whether the plan is ready to present as "go".

## 30. Failure and replanning semantics

General rule:

> Preserve progress, discard invalid assumptions, and replan from the newest trustworthy state.

Required failure behavior includes:

### 30.1 Overdose

- mark plan `INTERRUPTED`;
- invalidate prepared Energy/Happy/cooldown assumptions;
- do not classify the event as a model contradiction;
- resume only after current state is refreshed.

### 30.2 Quarter-hour Happy reset

Before elevated-Happy training:

- block readiness and recommend a safe window.

During training:

- invalidate pre-reset Happy;
- refresh current state;
- simulate remaining Energy from reality;
- expose lost opportunity where useful.

### 30.3 Inventory mismatch

If observed inventory contradicts a cached snapshot:

- fresh observed state wins;
- affected item is removed from usable inventory;
- candidate frontier is rebuilt.

### 30.4 Market unavailable

- gain simulation may continue;
- price/value ranking capability becomes unavailable;
- no fabricated prices.

### 30.5 Material price change

Re-rank economics only when the change can alter eligibility, winner selection, or a material explanation.

Avoid recommendation flicker from trivial price changes.

### 30.6 Unknown modifier

- do not assume zero;
- affected predictions are unsupported or explicitly ranged only when a supported uncertainty treatment exists;
- unrelated planner capabilities may continue.

### 30.7 API unavailable or permission missing

- fall back to manual entry where supported;
- mark old state stale;
- disable only dependent capabilities.

### 30.8 Player deviates from plan

- accept current observed state;
- preserve already-spent resources;
- recalculate from the new state;
- do not dead-end the plan.

### 30.9 No defensible recommendation

The advisor MAY abstain.

Status: `NO_SAFE_RECOMMENDATION`

It MUST explain which missing/unsupported facts prevent ranking.

## 31. Stable reason codes

v0.1 SHOULD use stable machine-readable reason codes including:

- `DATA_STALE`
- `DATA_MISSING`
- `PERMISSION_MISSING`
- `RESOURCE_MISSING`
- `COOLDOWN_BLOCKED`
- `TIMING_UNSAFE`
- `STATE_CHANGED`
- `PLAN_INTERRUPTED`
- `MODEL_OUT_OF_DOMAIN`
- `UNSUPPORTED_EFFECT`
- `ECONOMICS_UNAVAILABLE`
- `NO_COMPETITIVE_PLAN`
- `NO_SAFE_RECOMMENDATION`
- `BUDGET_EXHAUSTED`
- `BOOSTER_LIMIT_REACHED`
- `HAPPY_CAP_REACHED`
- `MARGINAL_GAIN_TOO_LOW`
- `USER_RESOURCE_RESTRICTION`

Reason-code wording may later expand, but semantics must remain stable once fixtures depend on them.

## 32. Material-change rule

A state update SHOULD trigger replanning only when it can materially alter:

- candidate eligibility;
- predicted outcome;
- selected winner;
- readiness;
- a hard constraint;
- a confidence boundary.

Small irrelevant changes SHOULD NOT cause recommendation churn.

## 33. Data minimization

The Training Advisor MUST request or inspect only data materially needed for its job.

It does not require:

- faction chat;
- attack history;
- trade history;
- messages;
- unrelated inventory categories;
- other players' private information;
- full account/profile data when narrower fields suffice.

Faction distribution of the script does not authorize sharing player data.

Private player state remains local/browser-side unless the owner separately authorizes a different data architecture.

## 34. UI contract boundary

This specification freezes information requirements, not final visual design.

The eventual UI may hide advanced fields while preserving them behind details/advanced views.

The beginner surface SHOULD be capable of rendering a compact mission-style plan such as:

```text
PLAN: eDVD HAPPY JUMP
Ready: in 6h 20m
Need: 2 eDVDs + 1 Ecstasy
New cash: ~$8.1m
Expected gain: ~13.4k Speed
Why: best balance of gain and cost
Next: wait for Xanax cooldown
```

Advanced UI may expose:

- full plan timeline;
- state provenance;
- confidence;
- model ID;
- gain interval;
- frontier alternatives;
- opportunity costs;
- replacement value;
- marginal booster curve;
- unsupported/extrapolated domains.

Final visual language is deferred until planner contracts and fixtures are frozen.

## 35. v0.1 strategy families

Initial strategy generation SHOULD cover:

- train now;
- wait and train;
- Xanax stacking;
- candy + Ecstasy Happy Jump;
- eDVD + Ecstasy Happy Jump;
- mixed/owned-inventory Happy preparation;
- refill-assisted plans when explicitly allowed;
- micro-jumps;
- do-nothing-yet/wait as a valid strategy.

B5 special mechanics remain outside normal v0.1 prediction unless separately supported.

## 36. Deferred from v0.1

Explicitly deferred unless later frozen before build:

- automated gameplay actions;
- post-50m training prediction;
- Fitness Center special Happy-loss behavior;
- unsupported book/event/company modifier ordering;
- verified overdose-probability expected-value optimization;
- combat-impact ranking;
- remote/cloud player-state storage;
- social/faction data sharing;
- automatic background DOM monitoring;
- long-horizon projections that silently leave the calibrated/supported model domain;
- a final visual theme.

## 37. Pure planner architecture

Implementation SHOULD preserve these layers:

```text
Authorized adapters
        |
        v
ObservedState + PlanningPreferences + MarketSnapshot
        |
        v
Strategy Generator
        |
        v
Sequential Simulator / frozen Training Math Engine
        |
        v
Pareto Pruning
        |
        v
Objective Ranking
        |
        v
Recommendation Contract
        |
        v
Beginner / Advanced UI
```

Network/API/DOM/storage concerns MUST remain outside the pure planning and math layers.

## 38. Specification fixtures required before build

Before product implementation is authorized, DQ-TRAIN-001C MUST use the draft normative ranking policy in `PLANNER-POLICY-001C.md` and synthetic policy fixtures in `PLANNER-POLICY-FIXTURES-001C.json` as the first planner-policy verification layer.

The policy fixture file covers ranking/readiness/failure semantics, and `PLANNER-STRATEGY-FIXTURES-001C.json` now covers the first strategy-generation/simulator-composition layer. Before build, the complete matrix must still cover:

1. ordinary train-now plan;
2. full 1,000E eDVD + Ecstasy plan;
3. candy-frontier plan;
4. owned-inventory vs buy-more comparison;
5. Budget Cap rejection;
6. Balanced knee-of-curve choice;
7. Fastest Useful Plan;
8. wait-as-best-action;
9. stale inventory planning with execution refresh required;
10. market unavailable with gain-only capability preserved;
11. unsupported modifier fail-closed behavior;
12. quarter-hour unsafe readiness;
13. overdose interruption/replan;
14. player deviation/replan;
15. plan identity preserved through small price changes;
16. model crossing 50m with partial modeled result;
17. no-safe-recommendation abstention;
18. confidence distinction between calibrated and extrapolated candidates.

Fixtures MUST use synthetic/nonprivate state.

## 39. Acceptance criteria for specification freeze

DQ-TRAIN-001C is eligible to move from DRAFT to FROZEN only when the owner accepts:

- objective modes;
- hard-constraint model;
- normalized state split;
- freshness/provenance rules;
- strategy hierarchy;
- plan/action contract;
- Pareto/ranking behavior;
- recommendation contract;
- readiness and execution gates;
- failure/replanning semantics;
- stable initial reason-code set;
- data-minimization boundary;
- deferred scope;
- required planner fixture matrix.

Ranking policy MUST be separately frozen through deterministic fixtures before product build. The current draft deliberately avoids arbitrary percentage thresholds where a gameplay-grounded or geometric rule exists: the useful-session floor is one ordinary natural full Energy bar, and Balanced uses a normalized geometric knee (`gainUtility - max(normalized burdens)`) after Pareto pruning. Any later numeric threshold that materially affects ranking requires an explicit fixture and owner review.

## 40. Build gate

This document does **not** authorize implementation.

After specification freeze, the next gate should be:

1. create machine-readable planner fixtures;
2. independently verify ranking and failure cases;
3. authorize `[B]`;
4. implement the pure planner before UI/adapters;
5. integrate authorized state/market adapters;
6. build beginner and advanced presentation;
7. verify TornPDA/Android and desktop;
8. owner review before merge/release.

Codex may be used after build authorization when implementation/testing complexity justifies it.


## 41. DQ-TRAIN-001C policy documents

The product specification is supplemented by:

- `PLANNER-POLICY-001C.md` — deterministic ranking semantics, useful-session reference, confidence policy, Pareto dimensions, Balanced knee rule, and objective-specific tie-breakers.
- `PLANNER-POLICY-FIXTURES-001C.json` — synthetic, nonprivate fixture cases for ranking, readiness, interruption, replanning, plan identity, partial model boundaries, and abstention.
- `PLANNER-STRATEGY-FIXTURES-001C.json` — synthetic, nonprivate fixture cases for candidate generation, Happy/Energy plan composition, owned-vs-purchased substitution, opportunity cost, observation override, capability partitioning, and model-boundary composition.

These are DRAFT until owner acceptance. They do not authorize implementation.
