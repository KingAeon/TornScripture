# DQ-TRAIN-001J — Runtime/UI polish discussion checkpoint

State: **ACTIVE [D] DISCUSSION CHECKPOINT; NOT SPECIFICATION-FROZEN; NO PRODUCT EDIT AUTHORIZATION**

Date: 2026-10-01.

Repository: `KingAeon/TornScripture`.

Active draft implementation: PR #135 on `agent/training-runtime-ui-001j-build`.

Discussion baseline / current product-bearing branch head when this checkpoint was recorded:

`f309913a223520e720701d5e5c25cb092796b618`

Authoritative merged implementation base remains:

`776d8e8044f317cd8feca58fb5197710b9c69b64`

This checkpoint records owner/assistant UI-polish direction discovered during real TornPDA use. It is not a replacement for the independently verified DQ-TRAIN-001J specification, does not change frozen fixture expectations, and does not authorize runtime/UI edits by itself.

## Live behavior that polish must preserve

Owner TornPDA smoke testing on the amended 0.1.0 branch has now established, at the behavioral level and without storing private player values:

- END injection executes after the TornPDA smart-quote compatibility correction;
- compact/expanded Training Advisor surfaces render;
- TornPDA managed-key injection works;
- user-triggered Refresh & Plan reaches CURRENT;
- live bars, battle-stat and active-gym acquisition normalize after the bounded bars-envelope correction;
- explicit checkpoint invalidation withdraws current authority;
- a new refresh creates a new epoch and clears prior current confirmations;
- current effect confirmation replans in the same epoch;
- selected-plan owned-item confirmation becomes item-local LIVE proof;
- explicit lower/zero owned quantities override planning-cache quantities and force replanning;
- a later refresh discards those manual confirmations and rebuilds planning state;
- H1 continues to withhold Ecstasy execution timing rather than guessing;
- H2 remains open and is not presented as ordinary user-fillable evidence.

UI polish must not weaken these evidence, freshness, advisory-only or fail-closed behaviors.

## Design thesis

The Training Advisor should feel like a calm analytical cockpit over Torn rather than a diagnostic dump or a counterfeit Torn menu.

Current direction:

- dark, dense and readable;
- Torn-native-adjacent rather than Torn-red imitation;
- slightly translucent only where readability remains dominant;
- color carries semantic meaning rather than decoration;
- beginner mode tells the player what matters now;
- Advanced mode proves why.

Working principle:

> Opaque enough to read. Compact enough to breathe. Color means something. Beginner tells the story; Advanced proves it.

## Modal ownership and stacking — owner-observed defect

Owner live screenshots show Torn document UI rendering above portions of the expanded Advisor:

- Torn top controls can visually cover the Advisor header / Close control;
- Torn navigation/status bars can paint across Advisor content near the state line.

The current expanded surface is already effectively opaque, so this is not treated as simple background bleed-through. It is a stacking/modal-ownership defect.

Polish direction:

- the expanded Advisor must behave as a true modal surface above ordinary Torn document UI;
- no Torn navbar, sticky document control, tooltip or status strip may paint above or through it;
- the compact HUD must sit above ordinary Torn content;
- the expanded Advisor must sit above the compact HUD;
- implementation should use explicit positioned stacking layers rather than relying on an unpositioned parent z-index;
- do not patch individual Torn selectors merely to hide the two observed overlaps.

Conceptual stack:

1. Torn document;
2. Advisor modal scrim;
3. compact HUD where applicable;
4. expanded Advisor surface/header at the highest Advisor document layer.

Exact z-index values remain implementation detail for later specification.

## Scrim, opacity and visual separation

Working direction, not yet frozen:

- expanded panel surface should remain highly opaque, approximately 96–100%, because Torn is visually busy;
- a dedicated dark scrim/backdrop beneath the expanded surface is preferred to making the panel itself heavily transparent;
- provisional scrim strength: approximately 70–80% dark opacity;
- compact HUD may use slightly more transparency than the expanded surface, approximately 92–95%, if text contrast remains strong;
- avoid heavy backdrop blur by default because TornPDA/WebView performance and clarity outrank fashion effects.

Exact values, shadows and blur policy remain open for the later [S] pass.

## Header and dismissal

The expanded mobile Advisor should have a sticky owner-controlled header.

Direction:

- Training Advisor identity/version at left;
- a clear close affordance at right;
- Close must remain fully visible above Torn document chrome;
- minimum touch target approximately 44–48 px;
- prefer a simple X visual with an accessible label such as `Close Training Advisor`;
- retain enough edge padding to reduce fat-finger risk.

TornPDA native app chrome is outside the document and is not expected to be covered by the userscript.

## State strip

The existing sentence:

`TornPDA managed key · Epoch N · CURRENT/NEEDS_REFRESH · Independent observations; not an atomic Torn server snapshot.`

is too verbose for the primary player surface.

Working direction:

- replace it in beginner presentation with a compact state strip, for example:
  - `CURRENT · Epoch 4 · TornPDA`
  - `NEEDS REFRESH · Epoch 4 · TornPDA`
- keep the non-atomic-snapshot explanation in Advanced/Sources or a small informational affordance;
- source provenance and exact timestamps remain inspectable in Advanced.

The state strip must not collapse recommendation, readiness and confidence into one axis.

## Semantic color language

Working palette roles:

- blue: primary interaction / selected controls / Refresh & Plan;
- green: READY or current verified evidence;
- amber/gold: WAITING, evidence limitations, H1/H2/open-gate caution;
- red: actual BLOCKED/unsafe/unsupported states, not ordinary missing input;
- muted slate: diagnostics, unavailable economics and secondary metadata;
- cool violet/blue-violet: confidence/model information, visually separate from readiness.

Readiness and confidence must remain independent both semantically and visually.

Example direction:

- green `READY` chip;
- violet `SUPPORTED EXTRAPOLATION` chip;
- amber H1 limitation card.

Exact color values and accessibility contrast targets remain to be frozen later.

## Recommendation hierarchy

The current plan card repeats checkpoint and refresh prose too many times and gives most text similar visual weight.

Beginner direction:

1. plan family/title;
2. readiness chip;
3. confidence chip;
4. one prominent NEXT instruction;
5. expected gain / target;
6. resources and acquisition;
7. wait/cost summary;
8. concise Why;
9. short ordered steps;
10. alternatives/evidence actions.

Repeated checkpoint prose should be consolidated.

Instead of repeating full sentences after every step, later UI may use concise steps such as:

1. Use 1 eDVD manually.
2. Checkpoint + Refresh.
3. Take 1 Ecstasy manually.
4. Checkpoint + Refresh.
5. Train.

If a step is withheld by H1/H2, the step itself should show the limitation rather than pretending execution is available.

## Confirmation surfaces

Owner live testing showed a usability defect: after successful effect confirmation, the form rerenders with an unchecked box, making a successful confirmation look as though nothing happened.

Polish direction:

- successful current evidence should transform into an acknowledged state;
- do not leave an identical blank confirmation form as the primary visual after success;
- show confirmation scope and epoch without implying durable persistence;
- provide an explicit edit/change action when appropriate.

Example direction:

`Current effects confirmed · Epoch 4`

`Inventory confirmed for selected plan · item-local current proof`

with an `Edit confirmation` affordance.

The underlying evidence remains in-memory/current-epoch only and must still clear on approved invalidation/new refresh/reload/key change as already implemented.

## H1/H2 limitation presentation

H1 and H2 are known research/evidence gates, not ordinary form errors.

Beginner direction:

- present them as concise amber limitation cards/callouts;
- explain the dependent action being withheld;
- never imply the player can fill in `worldDiabetesDay` manually;
- never use local-clock guessing to make H1 actionable.

Advanced should retain exact machine-level state such as:

`OPEN_LIVE_EVIDENCE_REQUIRED`

plus full relevant diagnostics.

## Checkpoint language

The current `State changed / checkpoint reached` control is behaviorally correct but architecturally wordy for beginner mode.

Working beginner wording direction:

`I performed this step`

or an equivalent human phrase.

On activation, the UI should clearly transition to:

`State changed. Refresh & Plan to continue.`

The control still performs only invalidation. It must never perform the Torn action itself.

The term `checkpoint` may remain visible in Advanced/diagnostics.

Final copy is not frozen by this discussion checkpoint.

## Advanced presentation

Advanced remains the transparency surface and must not alter ranking.

Polish direction:

- keep Plan, State, Sources, Economics, Alternatives, Model and Rejected/Diagnostics;
- favor structured accordions/sections over giant undifferentiated JSON walls where practical;
- preserve raw/machine detail somewhere inspectable;
- consider a later sanitized Copy diagnostics control only if its privacy boundary is separately specified.

No diagnostics control may expose the API key or private durable exports by accident.

## Mobile layout and safe area

Preserve the successful single-column, full/near-full-screen TornPDA direction.

Polish requirements to freeze later:

- no horizontal scrolling for essential content;
- sticky Advisor header;
- touch targets at least approximately 44 px;
- safe bottom padding so TornPDA/native controls do not crowd Advisor actions;
- viewport/safe-area handling should consider `env(safe-area-inset-*)` where supported;
- compact HUD remains draggable and viewport-clamped.

## Items intentionally still open in [D]

Do not treat these as frozen yet:

- exact dark/light palette values;
- exact scrim opacity;
- exact HUD/panel opacity;
- blur/no-blur final policy;
- border radii and shadow strengths;
- exact typography scale;
- exact status-chip shapes;
- exact iconography;
- exact Close visual;
- exact checkpoint beginner wording;
- exact desktop max width;
- whether compact HUD uses the same visual density as expanded mode;
- exact Advanced structured-diagnostics layout.

## Boundaries

This discussion checkpoint does NOT:

- authorize product/runtime/test/generated-userscript edits;
- modify the frozen DQ-TRAIN-001J specification or 34 fixtures;
- close H1 or H2;
- change planner/adapters;
- change acquisition/freshness/epoch semantics;
- change storage;
- authorize gameplay controls;
- authorize merge/release.

No API key, player stats, item counts, Points balance, or raw private live payload is stored here.

## Next gate

Continue owner/assistant `[D]` until the visual language and remaining copy/interaction choices are settled.

Then use a separate explicit `[S]` step to freeze the bounded UI-polish delta and its acceptance expectations before any implementation amendment.

PR #135 remains draft/unmerged during this discussion.
