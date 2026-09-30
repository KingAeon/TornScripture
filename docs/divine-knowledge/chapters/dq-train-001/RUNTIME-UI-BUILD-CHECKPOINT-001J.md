# DQ-TRAIN-001J — Runtime/UI implementation checkpoint

State: **IMPLEMENTED / AUTOMATED REGRESSIONS PASS / INDEPENDENT [V][WORK] AND OWNER BROWSER GATES PENDING / UNMERGED**

Owner authorization: `[B][WORK]`, 2026-09-30. Repository: `KingAeon/TornScripture`.

Authoritative base: `776d8e8044f317cd8feca58fb5197710b9c69b64`.
Branch: `agent/training-runtime-ui-001j-build`.
Tested product implementation head: `4a6670d919223e92dc468ee31f576069947edd45`.
Product tree: `da177cb76dd3af0d255dd4475df02a01cc440531`.

This checkpoint is a subsequent documentation commit. The final branch head, including this checkpoint, must be pinned from draft PR metadata in the independent verification request; a commit cannot contain its own resulting SHA. Product bytes are identical to the tested implementation head above.

PR #134 froze the specification at independently verified head `49fe20463c2e1568cc953e729129a8aa92ee5f38` and merged at the authoritative base. PR #133/J-P was independently verified at `7b1b31c60efcd8cbd0c13d32ee1d44fa84b7bcf0` and is already contained in that base. The frozen specification, fixtures, historical checkpoints, planner, and adapters remain byte-for-byte unchanged.

## Preflight

The complete Git repository was cloned and checked out at the exact base with a clean tree. Git 2.51.1, Node v24.19.0, and Python 3.12.14 were available. Python validates documentation/fixtures; the product has no Python dependency. The isolated branch was created locally and published at the exact baseline before product edits. Local executable tests and complete diff inspection were available.

Baseline commands and results:

- `node --test tests/training-advisor-pure.test.js tests/training-advisor-adapters.test.js`: **162/162**.
- `node --test tests/*.test.js`: **399/399**, 21 suites.

Publication uses the GitHub connector's Git object operations. Every published blob equals its local tested Git blob; the remote tree equals `git write-tree`. The published product commit was fetched into the executable workspace, with exact parent/tree equality verified. No product changes were pushed to `main`.

## Files

Product and tests added:

- `src/training-advisor-runtime.js`
- `src/training-advisor-ui.js`
- `scripts/build-training-advisor.js`
- `TornScripture-Training-Advisor.user.js`
- `tests/helpers/training-advisor-fixtures.js`
- `tests/training-advisor-runtime.test.js`
- `tests/training-advisor-ui.test.js`
- `tests/training-advisor-build.test.js`

Documentation added/updated:

- this checkpoint;
- `docs/divine-knowledge/NOW.md`;
- Training chapter/domain indexes;
- the mutable Training chapter row in `OPEN-NODES.ndjson`;
- one appended `CHANGELOG.ndjson` event.

IMM, ISH, WIH, the hub, Casino, DQ-EXT, workflows, package/dependency configuration, and unrelated repository files are unchanged.

## Architecture and build

The canonical CommonJS planner and adapters are embedded as exact source bytes in private module capsules. Runtime code acquires sources, controls observation sessions, and passes inputs to the canonical adapter and planner. UI code presents their outputs and gathers preferences/current confirmation. There are **no changes or integration exports** in either canonical module.

Version: **0.1.0**. The standalone userscript uses the repository's naming/metadata conventions, `@grant none`, TornPDA's managed-key placeholder, and document-idle startup. No package manager, bundler, npm dependency, production `@require`, runtime source fetch, remote planner, backend, or `eval` is introduced.

Build commands:

```bash
node scripts/build-training-advisor.js
node scripts/build-training-advisor.js --check
```

The generator uses only Node `fs`, `path`, and `crypto`. It embeds SHA-256 hashes of all four canonical/integration input sources and the generator itself. It does not incorporate wall-clock time, randomness, network results, or machine-specific paths.

Two consecutive CLI builds were byte-identical; the checked-in artifact equals regeneration. Final artifact SHA-256:

`fc1aa3248881f2b9ba1d1680161b6135cb0980817bf8f2254cca8a179e42eced`

VM tests exercise all 14 frozen math cases, 17 source-adapter cases, five stack-cap cases, valid/malformed inventory confirmation, planner parity, runtime acquisition, confirmation, and presentation against the generated artifact. Deliberately changing embedded `happyGain: 75` to `74` fails drift verification. Test mode returns the bounded test surface before DOM, networking, storage, or timer startup.

## Acquisition and session control

One user-triggered **Refresh & Plan** creates a new epoch. Concurrent invocations share its in-flight promise; UI refresh controls are disabled during it. Each source retains independent observation metadata. The UI explicitly says the responses are not an atomic Torn server snapshot.

Approved GET endpoints, all under `https://api.torn.com/v2`:

- `/user/bars`, `/user/cooldowns`, `/user/battlestats`, `/user/gym`, `/user/perks`, `/user/refills`, `/user/money`;
- `/torn/gyms`;
- `/user/inventory?cat=Drug|Booster|Candy`.

Responses unwrap only approved selection envelopes before canonical normalization. Schema changes remain adapter-local failures. Inventory pagination is restricted to the identical official endpoint/category, canonicalized for adapter link checks, and bounded at 20 pages/category. Foreign URLs, unexpected query keys, category changes, redirects, and cycles fail locally. Requests have 15-second abort deadlines; there are no retries, heartbeats, intervals, or background API polls.

Inventory/catalog caches are in memory for up to one hour. Cached inventory retains its original observation/source timestamp and remains planning-grade. Rejected/incomplete cached sources can be reacquired on the next manual refresh. Cache revision guards prevent an old key's in-flight response from becoming another key's inventory cache.

Execution-sensitive evidence expires conservatively at 60 seconds from epoch start. A one-shot expiry invalidates it; synchronous clock checks also prevent a suspended timer from preserving authority. Leaving the foreground, interacting with Torn controls outside the Advisor, or pressing the checkpoint control invalidates it. After a player action, the user must refresh and replan. Countdown-zero wording never modifies canonical freshness or cooldown state. Disposal aborts active requests and removes timers/listeners; no polling/observer architecture is added.

## Confirmation and fail-closed boundaries

The required-item form contains only the selected plan's positive owned consumption. Actual confirmation receives the runtime's event timestamp, is filtered to those requested keys, and is then normalized by unchanged J-P logic. Lower quantities and zero override category-cache quantities. Contradiction reruns `recommend`; the old plan is not advanced. Partial proof leaves aggregate execution inventory false. Bought resources remain separate and acquisition-gated. No confirmation survives a new epoch, expiry, material change, reload, or key change.

Automatic battle-stat failure offers the existing explicit complete manual-stat path; automatic capability remains unavailable. `/user/money.money.points` establishes separate current Points proof through the existing current-proof adapter input. Failure never infers Points from refills; explicit current Points entry is available. Refill availability, configured 30-Point cost, sufficient current Points, natural-max fill, and sequential 1,150E semantics remain canonical.

Item preparation requires complete canonical perk/effect support plus explicit current attestation that there are no other material preparation effects. This attestation is current evidence, not a stored preference. Unsupported perk strings continue to suppress dependent mechanics. No missing effect state is automatically replaced by an empty effect array.

**H1 remains OPEN_LIVE_EVIDENCE_REQUIRED:** no authoritative timing input is emitted from `happy.tick_time` or the local clock. Ecstasy readiness stays fail-closed under canonical timing rules.

**H2 remains OPEN_LIVE_EVIDENCE_REQUIRED:** no personalized Candy-event interval or verified inactive state is inferred. Affected Candy mechanics are withheld. Calendar acquisition is omitted while these candidate relationships cannot enable supported mechanics. No runtime Wiki request occurs.

No approved typed market provider is available in this integration. Market comparison is explicitly unavailable; no catalog/average/buy prices are invented. Gain-only planning continues when supported. Economic objectives preserve canonical abstention. No price provider or gameplay purchase control is added.

## UI and persistence

Compact HUD: pointer/touch drag, viewport clamp, collapse, readiness, selected-plan label, target stat, next instruction, Refresh & Plan, and Open. Expanded view: touch-sized controls, narrow-screen full overlay, desktop maximum width, approximate gain, costs/resources/wait, why selected, ordered checkpoints, at most three canonical alternatives, and Advanced access. Gameplay actions remain text only.

All six objective labels map exactly to canonical objectives; Balanced is default. Explicit target-stat selection is offered. No weighted sliders or unsupported balanced-stat allocation is introduced. Optional budget, max wait, item restrictions, refill policy, Point value, risk, mode, theme, HUD position, and collapse are player-authored preferences. Advanced sections show Plan, State, Sources, Economics, Alternatives, Model, and Rejected/Diagnostics without reranking a valid observation. READY and confidence remain separate; `EXPERIMENTAL` never becomes readiness. `CAPABILITY_UNAVAILABLE` is retained unchanged.

Auto theme follows Torn page/device markers and appearance; Dark/Light override it. Essential content wraps without horizontal table dependence. Every dynamic string is HTML-escaped.

Only two new local-storage keys:

- `tornscripture-training-settings-v1`: sanitized objective, target, target allocation mode, item/refill/owned-only policies, budget, Point value/limit, max wait, risk, item restrictions, mode, theme, HUD position, collapse;
- `tornscripture-training-api-key-v1`: optional desktop fallback key, using the existing repository local-key convention. TornPDA `###PDA-APIKEY###` takes priority.

No live bars, stats, Happy, cooldowns, Points, inventory responses, confirmation, recommendation, or history is persisted. No storage migration or `PDA_storage` dependency exists. Keys travel only in the official API Authorization header; request URLs, diagnostics, state snapshots, UI dumps, generated provenance, and repository documentation exclude credentials. Free-text API errors are discarded and snapshots redact the active key.

Listeners: Advisor click/submit/pointerdown/pointermove/pointerup/pointercancel; window resize; document visibilitychange and capture click/submit; optional device color-scheme change. DOM ownership: `tornscripture-training-advisor`, `tornscripture-training-style`. One refresh-expiry timer and bounded request abort timers; no interval or MutationObserver. Repeated initialization is guarded and disposal removes the owned lifecycle surface.

## Executed automated acceptance

Final product results:

| Validation | Result |
| --- | --- |
| Existing Training suites | 162/162 |
| New runtime/UI/build suites | 50/50 |
| All Training suites | 212/212 |
| Full repository | 449/449, 21 suites |
| Frozen 001J fixtures | All 34 executable: 11 acquisition / 8 packaging / 15 UI |
| New/changed JavaScript syntax | 8/8 |
| CLI double-build and checked-in regeneration | PASS |
| VM source/artifact parity and drift detection | PASS |
| Complete diff, scope/credential/version checks | PASS |
| Frozen Training JSON parse/unique IDs/unchanged bytes | PASS |
| Edited NDJSON parse/unique IDs; historical changelog prefix retained | PASS |
| Whitespace and Markdown local links | PASS |

Exact Node commands:

```bash
node --test tests/training-advisor-pure.test.js tests/training-advisor-adapters.test.js
node --test tests/training-advisor-runtime.test.js tests/training-advisor-ui.test.js tests/training-advisor-build.test.js
node --test tests/training-advisor-*.test.js
node --test tests/*.test.js
node scripts/build-training-advisor.js
node scripts/build-training-advisor.js --check
git diff 776d8e8044f317cd8feca58fb5197710b9c69b64..HEAD --check
```

`node --check` ran for every added JS file, including the generated artifact and fixture helper. Python checked JSON/NDJSON, byte equality against the base, IDs, complete changed-path scope, hashes, and Markdown references. Synthetic clock/source data are test fixtures, not live evidence.

Protected canonical regressions pass unchanged: vladar-v2-pre50m-v1 and calibration boundaries; 001A math; 001C policy/ranking; natural-max refill and 1,150E sequential route; booster pre-use threshold and legal mixed frontier; +250E/+75 Happy Xanax exactly once; absolute 1,000E versus natural maximum; no invented future Xanax cooldown; J-P valid/malformed confirmation, owned/bought separation, ordinaryHappy, regeneration, 50m limit, source-local capability failure, and H1/H2 gates.

## Owner manual gates — NOT exercised

TornPDA Android:

1. Install the branch's generated 0.1.0 userscript, enable the managed key path, open Torn, and locate the HUD. Before Refresh & Plan, no API traffic or current recommendation should appear.
2. Drag to screen edges, collapse/expand, Open/Close, rotate/use a narrow display, and check Auto/Dark/Light. Touch controls must work with no essential horizontal overflow.
3. Refresh & Plan; verify independent state/source observations, readiness, target, objective, recommendation, resources, and the manual NEXT instruction. Switch objectives and beginner/Advanced; opening Advanced must preserve recommendation identity.
4. For supported owned-item planning, explicitly confirm current effect state, then only required owned quantities. Confirm a lower quantity/zero and verify a replan plus item-local proof, with purchases separate.
5. Perform a routine manual Torn action or press the checkpoint control; observe invalidation, then Refresh & Plan and verify the new epoch/recommendation. No control may consume, train, refill, buy, or chain actions.
6. Reload: preferences/HUD state persist; live state and confirmation do not. Verify expiry/foreground behavior does not preserve authority.

Desktop Tampermonkey and Violentmonkey:

1. Install the same generated artifact; configure the local fallback key and explicitly Refresh & Plan.
2. Check compact/expanded layout, drag/clamp/collapse, preferences, objective changes, Advanced, required confirmation, and checkpoint flow.
3. Reload and verify preference/HUD persistence, absence of durable live authority, and key exclusion from diagnostics. Forget the local key and verify acquisition degrades.

Fixture/mock fail-closed checks: missing permission, planning-only/missing owned proof, missing Points, unsupported gym/effect, H1 timing, H2 event state, and missing market. The executable fixtures cover these; real WebView/extension/official endpoint behavior remains owner-gated. The minimal DOM event harness is not a TornPDA/browser smoke test.

## Limitations, rollback, independent handoff

H1/H2 are unresolved; Ecstasy timing and affected Candy support cannot be enabled by this build. No market/provider integration, calibrated-all-domain claim, future random cooldown, current cash-reserve input, active-duration estimate, or post-50m forecast is added. Explicit target-stat allocation is the available beginner allocation path. Permission/schema availability is established per source, never promised from a broad key-level label. The conservative 60-second confirmation/session window and foreground invalidation need usability smoke testing.

Before merge: leave the draft PR unmerged and disable/uninstall the test script. If separately authorized/merged later, revert both commits in this branch's baseline-to-head range and remove/disable the new Advisor artifact. Optionally remove only its two named local keys; other TornScriptures data is untouched. No data migration or irreversible state exists.

Independent `[V][WORK]` must pin the **final draft PR head**, prove the full executable workspace from the exact base, inspect the complete baseline-to-head diff, reproduce all commands/counts, preserve frozen documents/canonical bytes, check generated parity/drift, key/privacy and lifecycle boundaries, and evaluate this manual-gate distinction. Keep the PR draft/unmerged; no ready, auto-merge, release, or merge action is authorized. The owner completion report supplies the exact final-head prompt.
