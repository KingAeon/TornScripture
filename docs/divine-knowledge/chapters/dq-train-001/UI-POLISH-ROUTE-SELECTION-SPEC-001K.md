# DQ-TRAIN-001K - UI Polish and Route Comparison/Selection Specification

Status: **FROZEN BY OWNER [S] FOR INDEPENDENT [V]; DOCUMENTATION/FIXTURES ONLY; IMPLEMENTATION REQUIRES SEPARATE OWNER [B][WORK]**

Prepared: 2026-10-01

Authoritative merged baseline:

`main@776d8e8044f317cd8feca58fb5197710b9c69b64`

Active implementation reference at freeze time:

- draft PR #135, branch `agent/training-runtime-ui-001j-build`;
- documentation-inclusive head `4067c82c52439e97bb22856ac5e3e451d6a33591`;
- current product-bearing bytes last changed at `f309913a223520e720701d5e5c25cb092796b618`;
- PR #135 remains draft, open, unmerged and unreleased.

DQ-TRAIN-001K is a follow-on to the independently frozen/merged DQ-TRAIN-001J contract. It freezes a bounded visual/interaction redesign plus one additive planner-facing capability: a canonical, bounded route-comparison projection that lets the player select an already-generated supported plan without letting the UI become a second planner.

## 1. Purpose

The current Training Advisor runtime has proven its core TornPDA workflow during owner smoke testing, including startup, managed key use, current bars/stats/gym acquisition, explicit checkpoint/new-epoch behavior, same-epoch effect confirmation, selected-plan item confirmation, lower/zero inventory override with replanning, refresh clearing prior manual proof, and H1 remaining fail-closed.

The remaining product problem is presentation and route choice:

> Make the Advisor fast to read, touch-safe and visually coherent while allowing the player to compare a bounded set of canonical supported routes, understand their gain/resource tradeoffs, and explicitly choose one without bypassing readiness, freshness or evidence gates.

The design identity is **Midnight Ledger** with restrained **Dark Terminal** instrumentation.

## 2. Preservation invariants

001K MUST preserve all previously frozen mechanics and safety boundaries unless this document explicitly extends presentation/selection behavior.

Unchanged:

- Training math, calibration bounds and sequential simulation;
- refill semantics;
- booster pre-use threshold/frontier legality;
- Energy stack cap and Xanax mechanics;
- source freshness/provenance and refresh epochs;
- DQ-TRAIN-001J-P item-local selected-plan current inventory proof;
- H1 Happy timing and H2 personalized Candy interval as open live-evidence gates;
- no automatic Torn gameplay;
- no background polling;
- no remote planner/backend;
- no durable current player-state authority;
- generated standalone userscript and TornPDA compatibility requirements.

The UI MUST NOT independently simulate, rank, invent or mutate candidate plans.

## 3. Scope boundary

Authorized for a later implementation after verification/merge:

- visual tokens, layout and responsive styling;
- modal layering/scrim and mobile safe areas;
- Plan / Options / Advanced navigation;
- human-facing readiness/confidence copy;
- transformed confirmation states;
- structured Advanced presentation;
- compact/collapsed HUD polish;
- staged planning preferences with one Apply & Replan action;
- canonical route-option projection in the pure planner;
- ephemeral player selection of one exact canonical route option;
- selected-route-aware current confirmation scope;
- additive canonical marginal-final-booster metadata when supported by current modeled state.

Not authorized by this specification itself:

- product edits before separate [B][WORK];
- new game mechanics;
- new price providers;
- automatic purchases or item use;
- H1/H2 closure;
- forecasting an unobserved future booster checkpoint as though it were current;
- changing ranking winners for existing objectives;
- altering frozen 001J fixture expectations.

# Part A - Visual system and overlay ownership

## 4. Theme tokens

Dark is the primary designed experience.

### Dark: Midnight Ledger

| Token | Value |
|---|---|
| shell | `#111722` |
| elevated card | `#182131` |
| control/input surface | `#202A3A` |
| border/divider | `#344156` |
| primary text | `#E8EDF5` |
| secondary text | `#AAB5C6` |
| muted text | `#7F8CA1` |
| action blue | `#4C8DFF` |
| ready/current emerald | `#45C792` |
| waiting/research amber | `#E9B44C` |
| true-block red | `#E26464` |
| confidence violet | `#9A84F8` |
| telemetry cyan | `#48C7D9` |

Dark expanded surface opacity: **0.98**.

Dark compact HUD opacity: **0.94**.

Modal scrim: **`rgba(5, 8, 14, 0.76)`**.

No backdrop blur is required or authorized for the 001K implementation. Readability and TornPDA/WebView stability outrank glass effects.

### Light

| Token | Value |
|---|---|
| shell | `#F4F7FB` |
| elevated card | `#FFFFFF` |
| control/input surface | `#EDF2F8` |
| border/divider | `#CDD6E2` |
| primary text | `#17202D` |
| secondary text | `#536176` |
| muted text | `#647286` |
| action blue | `#2563C9` |
| ready/current green | `#157A55` |
| waiting/research amber | `#9A5B00` |
| true-block red | `#B63A3A` |
| confidence violet | `#6C4FC0` |
| telemetry cyan | `#0D7180` |

Light main surfaces are opaque.

Auto chooses Dark or Light from the existing supported appearance detection. Auto is not a third hybrid palette.

Semantic meaning is theme-independent.

## 5. TornScriptures visual fingerprint

The expanded shell uses a subtle **2px action-blue to telemetry-cyan top accent**.

It has no glow and no required animation.

This is a TornScriptures family cue, not a gameplay state indicator.

## 6. Modal ownership and stacking

Owner live screenshots established a real stacking defect: Torn document chrome could paint over the expanded Advisor header/Close area and across content.

001K freezes the correction as a layering contract:

1. Torn document UI;
2. Advisor scrim;
3. compact HUD where visible;
4. expanded Advisor surface and sticky shell.

The expanded Advisor MUST render above ordinary Torn document navbar/sticky/status/tooltip layers. Torn document content must not paint through or over the Advisor.

The implementation MUST use positioned elements with explicit stacking ownership. An unpositioned ancestor `z-index` is not sufficient.

Do not solve this by hiding individual Torn selectors.

Native TornPDA application chrome is outside the userscript document and is not required to be covered.

## 7. Geometry

Working geometry is frozen as:

- expanded mobile Advisor: full viewport document surface;
- desktop expanded Advisor: centered bounded surface, maximum width approximately 820px unless implementation evidence justifies a small equivalent adjustment;
- shell radius desktop: 12px;
- major card radius: 10px;
- controls: 8px;
- chips: pill radius;
- essential content: no horizontal scrolling.

Mobile bottom content padding MUST include ordinary spacing plus `env(safe-area-inset-bottom)` where supported.

## 8. Typography and density

Font stack: `system-ui, sans-serif`.

Target hierarchy:

- shell title / plan title: 18-20px, weight 700;
- NEXT primary instruction: 16-18px, weight 650-700;
- normal body: 14-15px;
- metadata/telemetry: 12-13px;
- no diagnostic text below 12px.

Monospace is reserved for canonical IDs, source names, timestamps, mechanic versions and similar technical identifiers.

Use tabular numerals where practical for comparison metrics.

Plan is the least dense surface, Options is moderate, Advanced may be dense but structured.

## 9. Accessibility and motion

Required:

- interactive touch targets at least 44px; major mobile actions target approximately 48px;
- visible keyboard focus on desktop;
- semantic meaning never relies on color alone;
- normal text targets WCAG AA contrast;
- `prefers-reduced-motion` disables nonessential transitions;
- permitted transitions are short and restrained, approximately 120-180ms;
- no pulsing/glowing status animation is required;
- no swipe-to-close, drag-to-dismiss or hidden long-press interaction.

# Part B - Shell navigation and information architecture

## 10. Sticky shell

The expanded mobile shell is:

1. sticky identity header;
2. sticky tab row;
3. sticky state strip;
4. scrolling body.

Header:

- `Training Advisor v<version>`;
- touch-safe Close control, visually a simple X is preferred;
- accessible label: `Close Training Advisor`.

Tabs:

- **Plan**
- **Options**
- **Advanced**

Plan is always the initial view when opening the full Advisor.

A new Refresh & Plan result returns to Plan.

## 11. State strip

Beginner strip is concise:

`CURRENT | Epoch 4 | TornPDA`

or equivalent.

The strip may show:

- CURRENT;
- NEEDS REFRESH;
- REFRESHING;
- BLOCKED/attention treatment when materially useful.

The credential source such as `TornPDA managed key` is Advanced detail, not primary-strip copy.

The non-atomic-snapshot explanation remains inspectable in Advanced/help and does not occupy the primary strip.

## 12. Semantic color roles

- blue: user interaction / selected navigation / refresh;
- emerald: READY, current confirmed evidence;
- amber: waiting, open evidence/research limitation, needs refresh/attention;
- red: true hard block/unsupported conflict;
- violet: model confidence;
- cyan: source/provenance/telemetry;
- slate: unavailable, inactive or secondary information.

Do not tint entire ordinary plan cards aggressively. Prefer chips, thin accents, icons and small status regions.

Readiness and confidence remain separate axes.

## 13. Human-facing labels

Canonical machine states remain unchanged.

Beginner presentation may use:

| Canonical condition | Beginner label |
|---|---|
| `READY` | **READY** |
| `NEEDS_ITEMS` | **NEEDS ITEMS** |
| `NEEDS_REFRESH` because explicit current confirmation is the smallest supported remedy | **NEEDS CONFIRMATION** |
| `NEEDS_REFRESH` after state change / stale authority | **NEEDS REFRESH** |
| `WAITING` | **WAITING** |
| unresolved H1/H2 dependency represented by existing machine readiness/reason | **RESEARCH GATE** |
| `BLOCKED` hard stop | **BLOCKED** |

`RESEARCH GATE` is presentation, not a new machine readiness enum. Advanced MUST show the actual canonical readiness/reason and the relevant open gate.

Confidence labels in Beginner:

- `CALIBRATED` -> **CALIBRATED**
- `SUPPORTED_EXTRAPOLATION` -> **SUPPORTED**
- `EXPERIMENTAL` -> **EXPERIMENTAL**

Advanced retains canonical names.

## 14. Plan screen hierarchy

The Plan screen order is frozen:

1. selected plan identity;
2. readiness chip;
3. confidence chip;
4. prominent NEXT card;
5. outcome metrics;
6. resource summary;
7. ordered steps;
8. concise Why this plan?;
9. Compare Routes entry;
10. small advisory workflow cue.

The strongest visual hierarchy belongs to NEXT/readiness, not projected gain.

Suggested workflow cue:

`You act in Torn. Advisor observes and replans.`

## 15. NEXT card

NEXT renders one immediate instruction or one immediate blocker.

Examples:

READY:
- `Train Strength with 130E`
- optional `I completed this step` after a human gameplay action is actually expected.

Confirmation:
- `Confirm your current preparation effects.`
- current confirmation control.

Research gate:
- `Ecstasy timing is not yet verified.`
- no gameplay-action completion control.

Needs refresh:
- `State changed. Refresh & Plan to continue.`

Do not place an action-looking Torn gameplay button in the card.

## 16. Outcome metrics

Beginner metrics include only relevant values, normally:

- projected approximate gain;
- target stat;
- Energy used;
- supported wait;
- cash needed when known/material;
- Points used when material.

Use explicit labels:

- **Points used**, never ambiguous `Points`;
- **Available Points** only for the actual observed/current balance;
- **Cash needed** for new cash;
- **Owned value used** for consumed owned-item replacement value;
- **Total resource value** only when the canonical economic total is known.

Unknown economics render as **Price unavailable** or **Cost comparison unavailable**, never as zero.

## 17. Resource presentation

Beginner separates:

- Uses;
- Need to acquire.

Current item-local proof may be indicated when material, but Beginner is not required to display source-taxonomy jargon on every resource.

Advanced shows exact provenance/freshness.

## 18. Step sequence

Use concise visual states:

- current NEXT;
- future supported step;
- refresh/checkpoint boundary;
- withheld/research-gated step;
- confirmed/completed state only when evidence actually supports it.

Do not render a checkmark merely because an action appears in a candidate plan.

Repeated checkpoint prose is consolidated. The route sequence may use concise language such as `Refresh & Plan` instead of repeating a full paragraph after every step.

## 19. Human checkpoint wording

Beginner manual-state-change control:

**I completed this step**

This control performs only Advisor invalidation/checkpoint behavior. It does not perform the Torn action.

After activation:

- prior recommendation becomes visually stale/subdued;
- execution-changing plan controls are disabled;
- state strip becomes NEEDS REFRESH;
- Refresh & Plan becomes dominant;
- old plan may remain readable for context.

Advanced may use the phrase `checkpoint / invalidate current observation`.

## 20. Confirmation surfaces

Successful confirmation MUST visibly transform state.

Before:

`Current confirmation required`

After:

`Preparation effects confirmed | current epoch`

or:

`Required inventory confirmed | item-local current proof`

with an Edit/Change affordance where supported.

Do not rerender the successful effect confirmation as an apparently unchecked initial form.

Beginner shows current evidence only when relevant to the effective selected route.

Advanced may show all current-epoch evidence.

## 21. H1/H2 limitation cards

H1/H2 are research/evidence limitations, not generic failures.

Beginner uses concise amber callouts that explain consequence, for example:

`Timing not yet verified. Ecstasy execution is withheld; planning estimates may still be shown.`

Do not expose `worldDiabetesDay` as a player-fillable ordinary field.

Advanced shows the exact gate identifier/state and canonical reason.

## 22. Options

Options groups controls by player intent:

1. Planning Goal
   - objective;
   - target stat/allocation.
2. Spending & Resources
   - new-cash budget;
   - max wait;
   - consider owned preparation items;
   - refill policy;
   - collapsed Do not use item restrictions.
3. Model & Risk
   - Supported;
   - Calibrated only;
   - Experimental allowed.
4. Economics
   - optional Point cash value and later separately approved economics inputs.
5. Appearance
   - Auto / Dark / Light.

Planning-affecting edits are staged and applied together through:

**Apply & Replan**

Apply & Replan uses the same current observation epoch. It does not perform a new Torn acquisition.

A planning-affecting Apply & Replan clears any manual route selection and returns to the current objective's canonical recommendation.

UI-only changes such as theme may apply without reranking.

**Refresh & Plan** remains the only primary acquisition/new-epoch action.

## 23. Advanced

Advanced is structured, not a raw-JSON wall.

Required sections:

- Current State;
- Sources & Freshness;
- Selected Plan;
- Evidence & Confirmations;
- Economics;
- Model & Mechanics;
- Other / Rejected Routes;
- Diagnostics.

Raw normalized objects remain inspectable one level deeper, such as `View raw`.

Opening Advanced MUST NOT alter ranking, readiness or route selection.

A future Copy diagnostics feature is out of 001K unless separately privacy-specified.

# Part C - Compact HUD

## 24. HUD states

The compact HUD is glanceable and answers:

- what plan;
- readiness;
- next move.

Expanded compact HUD normally shows:

- Training Advisor identity;
- readiness;
- short plan identity/target;
- one-line NEXT;
- Refresh & Plan;
- Open.

It omits detailed inventory, price tables, alternatives, model IDs and raw provenance.

## 25. Collapsed chip

The HUD has:

- expanded compact state;
- collapsed chip;
- full Advisor.

Collapsed chip may render:

- `TA | READY`
- `TA | REFRESH`
- `TA | WAITING`
- `TA | BLOCKED`
- `TA | REFRESHING`

with text plus semantic color.

It never auto-expands because state changed.

## 26. HUD safety

- only a dedicated header/grip area is draggable;
- controls do not double as drag surfaces;
- viewport position is clamped;
- HUD position and collapsed state may persist;
- no `I completed this step` control in the compact HUD for 001K;
- no gameplay action control;
- HUD never auto-opens the full Advisor.

# Part D - Canonical route comparison and selection

## 27. Why this crosses the pure-planner boundary

The current canonical planner owns generation/ranking and exposes the objective winner plus a limited objective-relative alternatives slice.

001K requires a bounded route-comparison set that can include other meaningful winners, such as highest gain or best value, even when the active objective is different.

Therefore the route set MUST be projected by the canonical pure planner (for example as `routeOptions` or an equivalent additive structure).

The UI MUST NOT create this set by reranking plans itself.

Existing `primaryPlan` remains the current objective winner and its historical semantics are unchanged.

## 28. Route-option eligibility

Every selectable route MUST be an exact canonical plan already generated/simulated by the planner for the current observation and preferences.

A route option must satisfy the same current hard constraints that apply to candidate support, including as applicable:

- risk policy;
- max wait;
- Point limits;
- prohibited items;
- owned-only hard restriction when enabled;
- explicit budget ceiling when supplied;
- supported simulation/model status;
- resource-known requirements.

Role-specific objectives may additionally require economics/reference data. If their required evidence is unavailable, that role is omitted rather than fabricated.

No UI-created hybrid recipe is selectable.

## 29. Deterministic route curation

The canonical planner emits a deterministic bounded route set, maximum **7 distinct plan fingerprints**.

Required curation priority, with exact-fingerprint deduplication and role badges accumulated on one card:

1. current objective winner: **RECOMMENDED**;
2. winner under existing `MAXIMUM_GAIN`: **HIGHEST GAIN**;
3. winner under existing `BEST_VALUE`, when valid: **BEST VALUE**;
4. winner under existing `USE_MY_INVENTORY`, when valid: **USE WHAT I OWN**;
5. highest-gain supported representatives of materially distinct preparation signatures until the cap is reached.

A preparation signature is a deterministic planner-side presentation grouping derived only from the canonical plan, using:

- distinct booster item IDs in `boosterUseSequence`;
- whether Ecstasy is used;
- whether Xanax is used;
- whether a Point refill is used.

No-preparation route may use a stable `TRAIN_ONLY` signature.

This grouping does not change mechanics or ranking. It exists only to ensure materially different supported recipe families, such as eDVD-based versus Candy-based preparation, can be compared when they survive current constraints.

Exact duplicate plan fingerprints never render as separate cards merely because they carry multiple roles.

## 30. Route cards

Collapsed route cards expose:

- human plan/family name;
- role badges;
- approximate projected gain;
- readiness;
- confidence;
- Cash needed;
- Owned value used;
- supported wait.

Expanded route detail exposes:

- exact resource recipe;
- need-to-acquire quantities;
- Points used if applicable;
- Total resource value when known;
- ordered sequence;
- current evidence/research gates;
- marginal-final-booster information when canonically supported;
- **Use this plan**.

Unknown economic fields say unavailable; they are not zero-filled.

## 31. Compare Routes navigation

Compare Routes is a **Plan subview**, not another modal and not a fourth top-level tab.

Plan -> Compare Routes -> back to current Plan.

Selecting Use this plan returns to Plan.

Route cards are collapsed by default to keep mobile scanning bounded.

## 32. Effective selected route

A user may select only one exact fingerprint from the current canonical route-option set.

The runtime/UI may hold an ephemeral `selectedRouteFingerprint` or equivalent.

The effective selected plan is:

- the matching exact canonical route option when one is selected;
- otherwise canonical `primaryPlan`.

Selection:

- does not change the active objective;
- does not rewrite `primaryPlan`;
- does not change canonical ranking;
- does not create new actions;
- does not bypass the selected route's canonical readiness/confidence/reasons.

The Plan screen visibly distinguishes a manual route choice, for example with **PLAYER SELECTED**, while preserving the objective recommendation in comparison context.

## 33. Selection lifetime

Manual route selection is in-memory planning-session state, not a durable preference.

It clears on:

- Refresh & Plan / new epoch;
- key change;
- reload/dispose;
- planning-affecting Apply & Replan.

At an explicit checkpoint/invalidation, the old selected route may remain visible only as stale context. It has no execution authority and is not silently carried into the next epoch.

Close/reopen within the same live page/epoch may retain it in memory.

## 34. Selected-route confirmation scope

Changing the selected route changes which resources are execution-relevant.

On manual route change:

- current selected-plan inventory confirmation is cleared;
- unrelated current evidence such as confirmed effects, current stats or current Points may remain if its existing evidence contract still applies;
- the Advisor replans/rebuilds effective readiness in the same epoch;
- inventory confirmation prompts only the new effective route's owned items.

No confirmation for the prior route may globally promote inventory for the new route.

## 35. Route selection and H1/H2

A route may remain selectable for planning/comparison while not execution-ready.

Example:

- player selects an eDVD + Ecstasy route;
- H1 remains open;
- Plan becomes PLAYER SELECTED + RESEARCH GATE;
- Ecstasy execution instruction remains withheld.

Selecting a Candy route does not close H2.

A player choice is not evidence.

## 36. Economics

For every route, preserve distinct meanings:

- `newCashRequired` -> Cash needed;
- `marketValueOfOwnedItemsConsumed` -> Owned value used;
- `economicValueConsumed` -> Total resource value when known;
- `pointsConsumed` -> Points used.

If a field is unknown, display unavailable.

A route may be valid for gain-only comparison when economics are unavailable if the underlying objective/route role allows it.

001K does not authorize a new external pricing source.

## 37. Marginal final booster

The canonical planner may expose additive metadata for the **final booster already contained in a currently modeled plan**, for example:

- item ID;
- marginal projected gain attributable to including that final booster versus the same supported modeled state without it;
- economic delta when canonically derivable from the same current price/resource evidence.

This is display/diagnostic metadata. It does not change plan ranking unless an existing objective already uses equivalent canonical economics.

The UI MUST NOT infer marginal gain independently.

## 38. Four eDVD versus fifth eDVD rule

001K explicitly freezes the distinction discussed by the owner:

- community convention does not define the optimal quantity;
- route cards show the quantity the canonical planner actually modeled;
- if five eDVDs are currently legal and canonically modeled, a five-eDVD plan may show the fifth unit's canonical marginal-final-booster result;
- if four uses reach the current pre-use threshold and `nextBoosterCheckpoint` says another eDVD may become legal only after waiting and re-observing, the current route is a **4 eDVD current segment with a conditional later extension**, not a five-eDVD execution-ready route;
- the conditional extension may identify the possible next item/checkpoint;
- its future gain MUST be labeled **replan after checkpoint** unless a separate canonical supported future-state model has actually produced that value;
- the existing `marginalGainFromFinalBooster` for the current plan MUST NOT be relabeled as the gain of an unmodeled future fifth eDVD.

This preserves the existing checkpoint -> observe -> replan safety rule.

## 39. Candy and other preparation families

When supported canonical candidate plans survive current constraints, route comparison may surface distinct preparation signatures such as:

- eDVD + Ecstasy;
- Candy + Ecstasy;
- mixed booster preparation;
- Train only;
- Xanax/refill variants.

The UI does not hardcode recipes such as `5 eDVD` or `49 lollipops`.

Displayed quantities are current canonical results.

H2 continues to fail closed event-dependent Candy execution where material.

# Part E - Verification and implementation gate

## 40. Automated acceptance

The companion `UI-POLISH-ROUTE-SELECTION-FIXTURES-001K.json` freezes synthetic acceptance cases.

A later implementation must add deterministic tests covering at minimum:

- modal stacking ownership;
- theme tokens / no blur;
- sticky shell and default Plan tab;
- state/readiness/confidence mapping;
- stale plan transition;
- successful confirmation transformation;
- staged Apply & Replan versus Refresh & Plan;
- structured Advanced;
- compact/collapsed HUD;
- canonical route curation/dedup/cap;
- manual route selection lifetime;
- selected-route confirmation scope;
- H1/H2 non-bypass;
- economic unknown handling;
- final-booster marginal labeling;
- conditional fifth-booster no-future-guess rule;
- no gameplay action controls;
- generated-artifact drift/normalization guards already required by 001J.

## 41. Manual browser gates

Before release, owner/manual verification must include TornPDA Android and at least one supported desktop userscript manager path.

TornPDA checks include:

- no Torn document element paints above expanded Advisor;
- Close is fully visible/touch-safe;
- no Torn bars/status chrome crosses body content;
- header/tabs/state strip remain sticky while body scrolls;
- bottom actions remain clear of native controls;
- Plan/Options/Advanced navigation;
- confirmation success visibly transforms;
- stale plan clearly withdraws authority;
- Compare Routes and player selection;
- route selection cannot bypass H1/H2;
- compact HUD drag/collapse/viewport clamp;
- dark/light/auto readability.

Desktop checks include:

- keyboard focus;
- centered bounded modal;
- theme behavior;
- no route/ranking outcome change caused merely by opening Advanced.

## 42. Implementation gate

This specification is documentation-only.

Required next steps:

1. independent `[V]` of the exact docs/fixtures diff;
2. separate owner decision to merge the specification PR;
3. only after verified spec merge, separate owner `[B][WORK]` authorization for code;
4. implementation may then amend existing draft PR #135 or use another owner-approved branch strategy, but must start from a reconciled post-spec baseline;
5. new executable verification is required after any product/pure-planner/runtime/UI amendment;
6. merge/release remains a separate owner decision.

No implementation, merge, ready-for-review transition, auto-merge or release is authorized by 001K.
