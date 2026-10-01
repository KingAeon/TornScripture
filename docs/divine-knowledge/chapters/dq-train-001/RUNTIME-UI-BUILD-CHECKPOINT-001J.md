# DQ-TRAIN-001J / 001K - Runtime/UI implementation checkpoint

Current state: **0.1.2 BOUNDED UI CORRECTIONS / AUTOMATED PASS / OWNER BROWSER AND INDEPENDENT IMPLEMENTATION VERIFICATION PENDING / PR #135 DRAFT, OPEN, UNMERGED, UNRELEASED / H1/H2 OPEN**

## Current bounded static-verification correction - 2026-10-01

The owner authorized two bounded fixes after static verification of exact head `e674345d9e787d0bce80eef87c018a397815d6e1`: K-A5 lacked a guaranteed Close width, and Beginner evidence was preference-scoped instead of effective-route-scoped under 001K section 20. This is an executable build/validation pass, not a new independent reviewer or live browser smoke result.

| Reference | Exact value |
| --- | --- |
| Main / PR base / merge base | `b8474253237e63485100fdcc51b2cb82530d2efc` |
| Starting PR head | `e674345d9e787d0bce80eef87c018a397815d6e1` |
| Tested correction product commit | `9837276160d897ff08b565a8553ef7bf94a3da38` |
| Tested correction tree | `cd473f56847ac84608d5200c58ce1a19651d03f5` |
| Existing branch / PR | `agent/training-runtime-ui-001j-build` / #135 |
| Version | `0.1.2` (AGENTS patch rule; matching markers updated) |
| Generated artifact SHA-256 | `648fd0ac1f807fc71602a083b74f0ba2cc8ae1258ec8aa2e96ebb6172ff7b2b6` |

The documentation-inclusive amended head is pinned from live PR metadata in the completion report; it cannot be self-recorded inside its own commit. The final documentation tree retains these tested product bytes. Starting preflight confirmed exact repository, branch, base/head and open/draft/unmerged PR, clean complete executable checkout, Git/Node/Python, build/test/diff and publication capability. Existing focused baseline **283/283** and full baseline **520/520 across 21 suites** passed before edits. Strengthened tests reproduced both findings at the starting implementation, including K-A5 width and preference-only preparation/Points prompting.

### Corrections and exact scope

- UI: Close-only `button[data-action=close]{min-width:44px}` combines with existing minimum height 44px, preserving the accessible label and neutral color. No global button width/layout change.
- UI: a presentation-only dependency helper reads the exact effective canonical route actions. Preparation/effect evidence depends on TAKE_XANAX / TAKE_ECSTASY / USE_BOOSTER; booster-capacity guidance depends on USE_BOOSTER; Points/refill guidance depends on USE_REFILL. Preferences supply recovery context only when no effective plan exists. Advanced retains the full applicable current-epoch ledger. Inventory proof scope, confirmation transformation, canonical readiness/ranking and H1/H2 are unchanged.
- Tests: strengthen K-A5 to verify both dimensions; use genuine preparation routes in stale/evidence-transformation tests; add six focused regressions for Train Now suppression, non-refill suppression, preparation retention, refill retention, Advanced ledger and no-safe recovery. Frozen fixtures/specifications are not edited.
- Product/test files: `src/training-advisor-ui.js`, version-only `src/training-advisor-runtime.js` and `scripts/build-training-advisor.js`, regenerated `TornScripture-Training-Advisor.user.js`, `tests/training-advisor-polish.test.js`, version assertions in `tests/training-advisor-build.test.js`.
- Continuity files: this checkpoint, NOW, chapter/domain indexes, only the Training row in OPEN-NODES and one appended CHANGELOG event. All historical changelog/checkpoint evidence is retained.

### Fresh executable evidence

| Exact command / check | Result |
| --- | --- |
| `node --test --test-reporter=tap tests/training-advisor-pure.test.js` | 109/109 PASS |
| `node --test --test-reporter=tap tests/training-advisor-adapters.test.js` | 53/53 PASS |
| `node --test --test-reporter=tap tests/training-advisor-runtime.test.js` | 30/30 PASS |
| `node --test --test-reporter=tap tests/training-advisor-ui.test.js` | 26/26 PASS |
| `node --test --test-reporter=tap tests/training-advisor-build.test.js` | 11/11 PASS |
| `node --test --test-reporter=tap tests/training-advisor-polish.test.js` | 60/60 PASS |
| `node --test --test-reporter=tap tests/training-advisor-*.test.js` | 289/289 PASS |
| `node --test --test-reporter=tap tests/*.test.js` | 526/526 PASS, 21 suites |
| `node --check` for each of all four canonical modules, six Training tests, helper, generator and generated artifact | 13/13 PASS |
| `node scripts/build-training-advisor.js` twice, byte comparison against each other and checked-in artifact | byte-identical PASS |
| `node scripts/build-training-advisor.js --check` | PASS |
| Independent embedded source hashes / deliberate core drift rejection / generated-artifact VM parity / test-mode side-effect guard / smart-quote guard | PASS |
| Independent frozen case-ID to passed TAP mapping | J 34/34 (11/8/15); K 46/46 (11/14/21) PASS |
| Whole-recommendation comparison against pre-001K planner at `4067c82c52439e97bb22856ac5e3e451d6a33591`, excluding only routeOptions and marginalFinalBooster | 288/288 PASS |
| `git diff b8474253237e63485100fdcc51b2cb82530d2efc..HEAD --check` and starting-head whitespace check | PASS |
| JSON/NDJSON parse, unique IDs/history, Markdown heading/fence/local-link, version/provenance/secret/private-data/scope audits | PASS |

Canonical pure planner/adapters are byte-equal to the starting head; all frozen J/K specifications, fixtures and prior Training JSON files are byte-equal to authoritative main. The complete reconciled 16-file PR diff remains Training-only: inherited additive 001K planner projection, existing runtime/UI/build/tests and active continuity. No unrelated IMM/ISH/WIH/hub/DQ-EXT/casino/trade/market/workflow/dependency/backend/storage changes.

Storage keys stay `tornscripture-training-settings-v1` and `tornscripture-training-api-key-v1`; no additions, migration, preference reset or durable route selection/current state. Runtime and generator differ from starting head only by version. UI mount/handlers are byte-identical. Eleven existing official Torn GET selections, Authorization-only keys, request/cache bounds and advisory controls are unchanged. No new network/listener/timer/observer, 60-second authority TTL, polling or blanket page invalidation.

### Remaining owner gates and rollback

Repeat TornPDA Android END injection with managed key/actual requests, bars/stats/gym/current epoch; mobile HUD/grip/clamp/collapse and modal stacking/44x44 Close/sticky tabs; Auto/Dark/Light/narrow safe-area layout. Verify Train Now hides unrelated effects/Points despite enabled preferences; select preparation/refill routes to restore only relevant confirmation; Advanced still exposes applicable evidence; accepted confirmation transforms; exact route selection/resources/NEXT, lower/zero replan and proof re-scoping; Apply/theme-only behavior, checkpoint/stale/new refresh, >60-second/hide-show/navigation neutrality and reload without authority/selection.

Repeat desktop Tampermonkey/Violentmonkey local key/actual API/CORS, HUD/centered modal/focus/Escape/Close, route-scoped Plan versus Advanced evidence, confirmation/Options/Compare/checkpoint, themes/reduced motion, HUD/settings persistence and reload/key invalidation. Synthetic DOM/VM tests do not prove live browser layout or networking. Prior 001J owner smoke results remain historical evidence; this corrected 001K live smoke is pending. H1/H2 remain open/fail-closed. No control consumes drugs/items, trains, refills, buys or performs unattended gameplay.

Immediate rollback: disable/uninstall the test userscript. Repository rollback: revert the bounded correction product commit and its continuity commit on this existing branch to restore exact starting product bytes/version; retain earlier reconciliation/001K work and history. No force update, main change or storage migration. Keep PR #135 draft/open/unmerged/unreleased and stop at owner/manual verification.

## Historical checkpoint at the statically reviewed starting head

The entire earlier checkpoint below is retained verbatim. Its heads, version, counts and pending status describe that earlier record; current correction evidence is above.

Current state: **001K IMPLEMENTED / AUTOMATED PASS / OWNER BROWSER AND INDEPENDENT IMPLEMENTATION VERIFICATION PENDING / PR #135 DRAFT, OPEN, UNMERGED, UNRELEASED / H1/H2 OPEN**

## Current 001K implementation and reconciliation

Separate owner `[B][WORK]` authorization: 2026-10-01. Risk Tier 2: advisory calculation, read-only acquisition, mobile presentation and sanitized local preferences. No accounting or storage migration.

| Reference | Exact value |
| --- | --- |
| Repository | `KingAeon/TornScripture` |
| Authoritative reconciled main | `b8474253237e63485100fdcc51b2cb82530d2efc` |
| Independently verified spec PR #136 head | `0b17df647129634675913b8f7c9ad2844986609c` |
| Previous PR #135 head | `4067c82c52439e97bb22856ac5e3e451d6a33591` |
| Previous product-bearing predecessor | `f309913a223520e720701d5e5c25cb092796b618` |
| Original 001J base | `776d8e8044f317cd8feca58fb5197710b9c69b64` |
| Ordinary two-parent reconciliation | `0e435bd1e4f3262e77c72b370e9bf35e64b55bba` |
| Tested implementation commit | `6a6cfdaf4097b4d7a4266e325d5e7e67380ad76d` |
| Tested product tree | `fa9db6a71acbaf84938b0b12fcee94a027626a26` |
| Existing branch | `agent/training-runtime-ui-001j-build` |
| Training Advisor version | `0.1.1` |

The final documentation-inclusive branch SHA is reported from live PR metadata at handoff; a commit cannot contain its own SHA. This documentation amendment preserves the exact tested product/test blobs above.

Full executable preflight confirmed repository/branch/main/previous head and live PR draft/open/unmerged state; complete nonshallow materialization, clean understood worktree, executable Git 2.51.1 / Node v24.19.0 / Python 3.12.14, tests/build/full-diff inspection, and publication/readback capability. Baseline Training tests passed **229/229** both before and after reconciliation; baseline generation check passed. Reconciliation preserved history with parents in order previous PR head and authoritative main. Only active continuity records conflicted; their histories were retained. All prior product bytes and merged 001K specification/fixture bytes were preserved before implementation. Merge base with current main is the authoritative main above. No branch recreation, rebase, force push or main update.

### Architecture and exact files

Product/test amendment:

- `src/training-advisor-pure.js`: additive canonical route-option curation and final-included-booster metadata; existing primaryPlan/rank/math semantics preserved.
- `src/training-advisor-runtime.js`: in-memory exact selection/effective-plan owner, proof re-scoping, stale context, same-epoch Apply & Replan and supported weakest-stat target mapping.
- `src/training-advisor-ui.js`: frozen visual/navigation/modal/HUD/confirmation/route presentation.
- `scripts/build-training-advisor.js`: patch version `0.1.1`.
- `TornScripture-Training-Advisor.user.js`: deterministic regeneration from canonical sources.
- `tests/training-advisor-polish.test.js`: 46 frozen K IDs mapped one-to-one plus eight scope/lifecycle/parity regressions.
- `tests/training-advisor-ui.test.js`: approved 001K human presentation assertions; frozen J fixture file untouched.
- `tests/training-advisor-build.test.js`: consistent patch-version assertion; drift/normalization guards retained.

Active continuity updates: this checkpoint, `NOW.md`, Training chapter/domain indexes, only the Training row in `OPEN-NODES.ndjson`, and one appended `CHANGELOG.ndjson` event. Ordinary reconciliation also retains the merged 001K specification, fixtures and historical discussion supersession note exactly as main. Historical evidence below is not rewritten.

Canonical `routeOptions` are maximum seven distinct exact fingerprints. Current winner comes first; existing MAXIMUM_GAIN, valid BEST_VALUE and valid USE_MY_INVENTORY winners follow, with duplicate roles accumulated. USE WHAT I OWN requires no bought quantity and known zero cash; otherwise LOWEST NEW CASH. Highest-gain supported preparation-family representatives fill remaining slots, ordered deterministically by structural signature (distinct booster IDs, Ecstasy, Xanax, refill or TRAIN_ONLY). Every option references an already generated/simulated canonical plan and reuses existing objective policy. Unavailable economics/reference evidence omits dependent roles. The UI does not rank, simulate, splice recipes or invent economic/marginal data.

Existing `primaryPlan` remains the objective winner. Runtime owns ephemeral selected fingerprint and resolves only an exact current canonical route. Route change clears selected-plan inventory proof, preserves valid other current evidence and replans in the same epoch. Confirmations request only effective-route owned quantities; bought items stay separate. Lower/zero contradiction still replans and clears a fingerprint that no longer exists. Refresh, key change, dispose/reload and Apply & Replan clear selection. Apply also clears route-scoped inventory proof when returning to the winner, even with unchanged preferences. Close/reopen may preserve selection in memory. Checkpoint preserves old selected context visibly stale, clears authority/proof and disables execution-affecting controls. Theme/HUD changes neither replan nor clear selection.

Canonical `marginalFinalBooster` identifies the final included item/unit, uses the existing modeled without-final-booster delta, and reports only derivable unit economic delta. Currently legal fifth eDVD and exact-max four-eDVD/conditional later fifth remain distinct. A later booster requires checkpoint/observation/replan; future gain is unavailable. No fourth-unit gain is labeled as fifth-unit gain. Candy quantities come from canonical recipes. No math/mechanic or ranking objective changed. A separate 288-scenario whole-recommendation comparison against the previous pure module passed after excluding only additive metadata.

### UI, lifecycle, persistence and network

Midnight Ledger dark and frozen opaque Light translation, Auto/Dark/Light, exact 0.98 expanded / 0.94 HUD dark surfaces, 0.76 scrim, and restrained 2px blue-to-cyan accent. Explicit fixed isolated root owns scrim/HUD/expanded layers above ordinary Torn document content; no Torn selector hiding or required blur. Sticky identity/44px Close, Plan/Options/Advanced tabs and state strip precede scrolling safe-area content. Plan opens initially and after Refresh/Apply. NEXT is strongest; readiness and violet confidence remain separate. H1/H2 are presentation-only research gates with canonical reasons visible in Advanced; dependent instructions are withheld. No worldDiabetesDay input or local-clock timing guess.

Successful current effect/inventory confirmation transforms into epoch-scoped acknowledgment with Change/Edit. Missing-source refresh differs from same-epoch manual confirmation. Staged Options reuse approved objective/resource/risk/economic preferences; supported Target/Weakest stat maps through canonical normalization. Structured Advanced retains full raw objects one level deeper and never changes selection/ranking. Compare Routes is a Plan subview with collapsed exact-route cards, truthful Cash needed / Owned value used / Total resource value / Points used and unavailable-price labels. Compact HUD excludes inventory/economics/diagnostics/checkpoint controls; collapsed chip never auto-expands. Only dedicated grip is draggable and fully clamps; controls do not drag.

Unchanged durable keys: `tornscripture-training-settings-v1`, `tornscripture-training-api-key-v1`. No keys added/renamed and no migration/reset. Settings add only the approved `statAllocationMode` preference (default TARGET_STAT); old sanitized preferences/HUD position/collapse/theme remain compatible. Selection, staged options, observed player state, confirmations, recommendation/history and API/cache data remain memory-only. No PDA_storage.

Owned UI adds root input/change staging and root keydown Escape/focus handling to the existing click/submit/pointer lifecycle; optional color-scheme/window resize ownership remains. All listeners dispose with the mounted surface. No document-wide/capture/visibility invalidation listener, MutationObserver, polling or new timer. Existing bounded 15-second request abort timers and one-hour memory planning caches remain separate from authority. CURRENT survives time, hide/show and unrelated interactions until explicit approved transition. Countdown zero remains nonauthoritative. No new endpoint or price provider; all existing eleven source selections/GETs, bars unwrap, concurrency, bounded pagination, foreign/query/redirect rejection, key revision/redaction and Authorization-only official Torn key boundary remain intact. Startup acquires nothing. No GitHub/CDN runtime import, remote planner, backend or dependency addition. Controls only observe/replan/compare/confirm/select/invalidate; no item/drug/refill use, training, buying or unattended action.

### Executed validation

| Exact command/check | PASS result |
| --- | --- |
| `node --test --test-reporter=tap tests/training-advisor-pure.test.js` | 109/109 |
| `node --test --test-reporter=tap tests/training-advisor-adapters.test.js` | 53/53; 162 existing canonical tests total |
| `node --test --test-reporter=tap tests/training-advisor-runtime.test.js` | 30/30 |
| `node --test --test-reporter=tap tests/training-advisor-ui.test.js` | 26/26 |
| `node --test --test-reporter=tap tests/training-advisor-build.test.js` | 11/11; 67 existing runtime/UI/build tests total |
| `node --test --test-reporter=tap tests/training-advisor-polish.test.js` | 54/54; all 46 K IDs plus eight additional regressions |
| `node --test --test-reporter=tap tests/training-advisor-*.test.js` | 283/283 |
| `node --test --test-reporter=tap tests/*.test.js` | 520/520 across 21 suites |
| `node --check` for every JS added/changed against reconciled main and canonical adapters | 11/11 |
| `node scripts/build-training-advisor.js` twice; saved byte comparisons | Byte-identical and equals checked-in bytes |
| `node scripts/build-training-advisor.js --check` | PASS |
| All five independent provenance SHA-256 comparisons | PASS |
| Deliberate embedded +75-to-+74 drift rejection and generated VM parity | PASS in build/polish tests |
| Four-quote scan / post-normalization syntax / bounded test-mode surface | PASS in build tests |
| Frozen J acceptance IDs | 34/34: 11 acquisition, 8 packaging, 15 UI |
| Frozen K acceptance IDs | 46/46: 11 visual, 14 UX, 21 routes; mapped executable assertions |
| Historical recommendation parity excluding additive metadata | 288/288 deterministic scenarios |
| `git diff --check`; complete reconciled diff review | PASS |
| JSON IDs, NDJSON parse/history, Markdown headings/fences/local links, version/scope/secret scans | PASS |

Generated userscript SHA-256:

`bf74185164dac5d0eb16ce6975e4422d567d3b48645e8584a76dc576866f079e`

Canonical adapters and all frozen specifications/Training JSON remain byte-for-byte equal to authoritative main. Pure planner changes are only the authorized additive projection/metadata. Protected math/model/domain/50m/ranking, natural-max/sequential refill, threshold/legal mixed frontier, Xanax +250E/+75 Happy once, 1000E stack distinction, no invented future cooldown, J-P timestamp/owned-bought proof, ordinaryHappy/regeneration, local failures/CAPABILITY_UNAVAILABLE and unresolved H1/H2 regressions pass. Complete final diff excludes unrelated IMM/ISH/WIH/hub, casino/trade/market/DQ-EXT, workflows/dependencies/backend/storage edits.

### Owner manual gates and rollback

Prior owner 001J live smoke PASS is recorded in the historical discussion: END injection, HUD/expanded rendering, managed key, real bars/stats/gym/current epoch, ordinary training guidance, checkpoint/new refresh, same-epoch effect/item proof, lower/zero override and refresh reset. Those results are not a live test of new 001K presentation. Synthetic DOM/VM coverage does not establish TornPDA stacking, WebView pointer/focus behavior or extension CORS compatibility.

TornPDA Android, on a normal Torn page with END injection:

1. Install the commit-pinned 0.1.1 artifact; verify managed key, no startup API traffic, HUD/chip/drag/clamp/collapse and no auto-expansion.
2. Open Plan. Verify Advisor header/Close/tabs/state strip paint above ordinary Torn navbar/sticky/tooltip elements, mobile full screen, safe areas, narrow screen/rotation and Auto/Dark/Light. Close/reopen retains in-memory choice while returning to Plan.
3. Refresh; confirm actual Energy/Happy/stats/gym, CURRENT/new epoch, source-local provenance and explicit API failures distinct from current-confirmation remedies.
4. Compare collapsed canonical routes, expand exact recipe/owned/acquisition/economics/marginal details, select a different route. PLAYER SELECTED, NEXT/resources/readiness must agree; no gameplay occurs. Missing prices must never be zero. H1 Ecstasy/H2 Candy gates remain withheld.
5. Confirm relevant effects and effective-route owned quantities. Verify acknowledgment/Edit, same-epoch replan, lower/zero contradiction and re-scoped proof after route change; unrelated current evidence remains valid.
6. Stage Options without changing recommendation, Apply & Replan without API/new epoch and with selection/proof reset; theme-only changes preserve recommendation. Advanced is structured/raw-transparent, key-free and does not rerank.
7. Perform any chosen Torn action manually, then I completed this step: old selected plan becomes stale/readable, NEEDS REFRESH dominates, execution-affecting controls disable; Refresh creates new proof. Wait >60 seconds and hide/show/unrelated navigation must remain neutral. Reload keeps approved preferences only.

Desktop Tampermonkey/Violentmonkey:

1. Install the pinned artifact, configure local fallback key, verify actual API/CORS Refresh, bounded centered overlay and touch/keyboard-visible controls (Close, Escape, focus cycle/return).
2. Verify HUD grip versus controls, resize/clamp/collapse, Plan/Options/Advanced/Compare selection and confirmed evidence behavior, themes/reduced motion, stale checkpoint flow and unknown economics.
3. Verify settings/HUD persistence, reload without live authority/selection/confirmation, key exclusion from diagnostics and Forget key account-cache invalidation. No control performs Torn gameplay.

Rollback: disable/uninstall the test artifact for immediate local recovery. Revert the 001K implementation and accompanying continuity commit(s) on this existing branch (no force update/main change) to restore reconciled 001J product bytes/version; the ordinary merge may remain to retain the merged specification. If reverting the reconciliation itself is separately authorized, use its first parent to restore exact previous PR head. No durable state migration is involved; preferences remain backward compatible. Keep PR #135 draft/open/unmerged/unreleased. Stop at repeated owner manual smoke and independent implementation verification; no ready/auto-merge/merge/release action is authorized.

## Historical 001J implementation evidence

The following checkpoint preserves the preceding implementation, defect corrections and results as recorded. Its versions/heads/pending gates describe those earlier checkpoints, not current 001K status.

State: **OWNER TORNPDA STARTUP/KEY/STATS/GYM SMOKE PASS / BARS NORMALIZATION AND INPUT GUIDANCE CORRECTED / AUTOMATED REGRESSIONS PASS / REPEATED OWNER BROWSER GATES PENDING / UNMERGED**

Owner authorization: `[B][WORK]`, 2026-09-30; bounded TornPDA quote compatibility and subsequent bars/input-guidance amendments, 2026-10-01. Repository: `KingAeon/TornScripture`.

Authoritative base: `776d8e8044f317cd8feca58fb5197710b9c69b64`.
Branch: `agent/training-runtime-ui-001j-build`.
Tested amended product head: `0ba12a007f0b1fe241b63b563586bb543990e679`.
Product tree: `a0bcf678b9a563b3b2df15d1fc84c9b3a22c4782`.
Previous quote-corrected draft / owner smoke head: `efbe6b34a36dc72896c54f0c29f388cbebd02765`.
Previous independently verified draft head: `f9c37b181c22a23f093830e33d987abdfeb7d380` (PASS; owner browser gates remained pending).

This checkpoint is a subsequent documentation commit. The final branch head, including this checkpoint, is pinned from draft PR metadata in the owner completion report; a commit cannot contain its own resulting SHA. Product bytes are identical to the tested implementation head above.

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

Two consecutive CLI builds were byte-identical; the checked-in artifact equals regeneration. Historical freshness-correction artifact SHA-256 (superseded by the compatibility build below):

`e3a3de9aa432de7709e3e4173b89a97e678a04284a6c097c194881ae62008306`

VM tests exercise all 14 frozen math cases, 17 source-adapter cases, five stack-cap cases, valid/malformed inventory confirmation, planner parity, runtime acquisition, confirmation, and presentation against the generated artifact. Deliberately changing embedded `happyGain: 75` to `74` fails drift verification. Test mode returns the bounded test surface before DOM, networking, storage, or timer startup.

## Bounded author-side correction — 2026-10-01

Owner authorized amendment of existing draft PR #135 on the same branch, from `cc6d330a66f54faf2e0bb62ec40269632a574c26`. Original product head `4a6670d919223e92dc468ee31f576069947edd45` and its 162 existing / 50 new / 212 focused / 449 repository passes remain historical evidence. The pinned previous draft head was clean and reproduced those counts before correction.

At that previous head, synthetic execution reproduced the 60,000 ms authority timer, synchronous expiry after 60,001 ms clearing selected-plan confirmation, expiry-callback invalidation, hiding the document, and unrelated outside-Advisor link/button/input clicks and form submissions causing `NEEDS_REFRESH`. Those policies exceeded the frozen contract.

The amendment removes the authority TTL, expiry timer, synchronous elapsed-time check, 60-second UI claim, and page-wide visibility/click/submit invalidation. It introduces no replacement TTL, gameplay selectors, polling interval, or observer. Current epoch/confirmation survive elapsed time and ordinary browsing. Explicit invalidation, a new refresh, key change, and disposal/reload retain their proof-clearing behavior. Disposal also drops derived/raw in-memory evidence and prevents late request completion from repopulating it. The 15-second request abort deadline and one-hour planning caches are unchanged.

Product/test amendment files: `src/training-advisor-runtime.js`, `src/training-advisor-ui.js`, `tests/training-advisor-runtime.test.js`, `tests/training-advisor-ui.test.js`, and regenerated `TornScripture-Training-Advisor.user.js`. Documentation amendment: this checkpoint, NOW, chapter/domain indexes, the active Training open-node row, and one appended changelog event. No canonical, frozen, dependency, workflow, or unrelated files changed.

Amended product commit: `a151435e18de2a15eebbcd818cdc8ea1b296cebe`, parent `cc6d330a66f54faf2e0bb62ec40269632a574c26`; fetched and checked against the tested local tree. Final documentation-inclusive head is pinned in PR #135 metadata and the owner completion/independent-verification prompt.

Seven additional regressions plus corrected existing assertions prove persistent current epochs/confirmation beyond 60 seconds, nonauthoritative countdown zero, hide/show and unrelated navigation neutrality, explicit checkpoint/new-refresh/key invalidation, and memory-only disposal/reload. Full results below were executed after correction. Real TornPDA/desktop smoke tests remain pending.

## Bounded TornPDA source-normalization correction — 2026-10-01

The first owner live TornPDA Android startup smoke test failed at the previously independently verified draft head `f9c37b181c22a23f093830e33d987abdfeb7d380`: installation succeeded, injection was set to END, but no Training Advisor HUD appeared on a normal Torn page, both without a configured key and after setting one. API configuration does not govern HUD mounting. This live failure is owner evidence; it is not a verifier-performed browser test.

The known [TornPDA normalization evidence](../../../discovery/evidence/TORN-PDA-USERSCRIPT-SOURCE-NORMALIZATION.md) documents whole-source replacement of literal U+2018/U+2019 with ASCII apostrophes and U+201C/U+201D with ASCII double quotes before injection. Raw generated JavaScript parsed, but applying that exact transform reproduced `SyntaxError: Unexpected identifier 's'`: the U+2019 in the single-quoted `plan\u2019s` copy became an unescaped ASCII apostrophe. The second literal U+2019 was in the `TornPDA\u2019s` template copy. Each also occurred in the generated artifact: two canonical occurrences and two embedded occurrences.

The only product-source changes are ASCII-safe wording: `Obtain and verify the selected plan requirements.` and `TornPDA managed key takes priority.` No Unicode stripping or runtime normalization layer is added. The generated artifact is regenerated from unchanged canonical planner/adapters, unchanged runtime, and unchanged Node-core generator; only UI bytes and their provenance hash change.

The permanent build-suite test `TornPDA quote normalization cannot rewrite Training Advisor sources or artifact` scans every build input (planner, adapters, runtime, UI), the generator, and the checked-in userscript for exactly `[\u2018\u2019\u201C\u201D]`, then parses the post-normalization artifact. It failed against the original UI source and passes after correction. Existing J-B3/J-B4 guards still enforce regeneration/provenance and reject deliberate embedded-core drift. This is a hard automated build/release guard, not a live compatibility claim.

Tested compatibility product commit: `29a4b6bc80a59889cc336d43cbf166c601092309`, parent `f9c37b181c22a23f093830e33d987abdfeb7d380`; fetched into the executable workspace and verified against local tree `7ee992a75756c4c60cec91658b2058f8da6ac876`. The subsequent active-record commit preserves these tested product bytes. The final documentation-inclusive head is pinned in PR #135 metadata and the owner completion report.

Historical quote-correction artifact SHA-256 (superseded by the bars/UX build below): `8d722e08d817fd1165c688f94572639242999618ac17733ef7afebf58690790e`.

| Executed compatibility validation | Result |
| --- | --- |
| Existing Training | 162/162 |
| Runtime/UI/build, including one added compatibility guard | 58/58 |
| Focused Training | 220/220 |
| Full repository | 457/457, 21 suites |
| Frozen J fixtures | 34/34, 11 acquisition / 8 packaging / 15 UI |
| Syntax checks, UI/build test/generated userscript | 3/3 |
| Six source/artifact files, four literal quote characters | Zero occurrences |
| CLI double build / checked-in regeneration / five provenance hashes | PASS |
| Intentional embedded-core drift rejection / generated-artifact VM parity | PASS |
| Canonical planner/adapters and frozen/historical chapter bytes versus authoritative base | Unchanged |
| Complete amendment diff / secrets / scope / JSON / NDJSON history / Markdown / whitespace | PASS |

Exact test commands use `node --test --test-reporter=tap` with the same file lists recorded below. Syntax commands are `node --check src/training-advisor-ui.js`, `node --check tests/training-advisor-build.test.js`, and `node --check TornScripture-Training-Advisor.user.js`. Two `node scripts/build-training-advisor.js` invocations and `cmp` prove identical builds and equality with the pre-regeneration artifact; `node scripts/build-training-advisor.js --check` verifies checked-in generation. SHA-256 is computed independently with `sha256sum`; Python separately scans all six files, validates embedded hashes and frozen bytes, and matches all 34 frozen IDs to executed TAP results. `git diff --check` passes.

No epoch/confirmation policy, API acquisition, Points/H1/H2 gate, key/storage behavior, controls, version, endpoint, listener, timer, observer, dependency, frozen expectation, or unrelated product changes. H1/H2 remain open. **Repeat the owner TornPDA Android smoke test after installing the amended pinned artifact; HUD startup, managed key injection, actual requests and the entire original mobile workflow are still pending.** Tampermonkey/Violentmonkey live API/CORS and reload gates also remain pending. The PR stays open/draft/unmerged/unreleased; no ready, auto-merge or release action is authorized.

## Bounded live-v2 bars and actionable-input correction — 2026-10-01

Owner-reported live TornPDA Android smoke at `efbe6b34a36dc72896c54f0c29f388cbebd02765` establishes **startup PASS after the quote correction**, successful END injection, compact HUD and expanded mobile UI rendering, managed-key injection PASS, real Refresh & Plan reaching CURRENT, successful `/user/battlestats`, and active gym resolution as Complete Cardio. These are owner-exercised live results, not verifier browser claims. Authentication was not the blocker. The same screen lacked Energy, natural maximum/regeneration, Happy and ordinary Happy together; bars response normalization remained BLOCKED. Repeated refresh while following the input instruction exposed a second bounded UX defect. No private player values, API key or raw response are recorded.

### Current official response-wrapper audit

Before product edits, downloaded [official Torn OpenAPI](https://www.torn.com/swagger/openapi.json), version **6.13.6**, with a descriptive User-Agent. Schema SHA-256: `f6c076e923032177016f6615b1a7d2b06c0db6ddfec222b731123ecb760c193e`. This is a response-shape audit, not a claim that every endpoint was exercised live. No schema/dependency or endpoint is added to the product.

| Acquired endpoint | Official successful response | Existing consumer boundary / audit result |
| --- | --- | --- |
| `/user/bars` | `UserBarsResponse -> {bars: UserBars}` | **Only missing unwrap**: canonical adaptBars expects direct energy/happy |
| `/user/cooldowns` | `{cooldowns: {...}}` | Existing runtime unwrap matches direct cooldown adapter |
| `/user/battlestats` | `{battlestats: {...}}` | Existing runtime unwrap matches direct stat adapter |
| `/user/gym` | `{gym: {id, name}}` | Envelope retained intentionally; canonical adaptGym reads gym.id/name |
| `/user/perks` | `{perks: {...}}` | Existing runtime unwrap matches direct perk adapter |
| `/user/refills` | `{refills: {...}}` | Existing runtime unwrap matches direct refill adapter |
| `/user/money` | `{money: {...}}` | Envelope retained intentionally; runtime reads money.points for current proof |
| `/user/inventory` | `{inventory: {items, timestamp}, _metadata: {...}}` | Entire page retained intentionally for canonical pagination/provenance |
| `/torn/gyms` | `{gyms: [...]}` | Existing runtime unwrap matches canonical catalog array |

No other current wrapper mismatch was found. Additional wrappers were not added or removed.

### Reproduction and bounded correction

First added `official v2 wrapped bars normalize through canonical adapters with unchanged source evidence` against the previous product. It failed with `undefined !== 150` for Energy: HTTP success/source metadata were present, but the wrapper prevented canonical field normalization. The browser acquisition boundary now adds exactly `if (key==='bars') return payload.bars ?? payload;`. That is the entire runtime diff. Canonical adaptBars, arithmetic, ordinary-Happy rules, provenance/freshness policy, and direct synthetic inputs are unchanged.

The new synthetic v2 input includes wrapped bars with energy/happy/nerve/life/chain and uses the current envelope boundaries for every acquired endpoint. The passing regression proves Energy, naturalEnergyMax, naturalRegen, Happy, guarded ordinaryHappy, bars capability, `/user/bars` source IDs, LIVE observation timestamps and OBSERVED provenance. Its full normalized output equals the existing direct-input output. Missing/malformed wrappers fail closed locally. Existing frozen direct bars cases and elevated-Happy withholding retain canonical results. No adapter policy is duplicated in runtime.

UI-only evidence guidance replaces the undifferentiated null-field list and the instruction to provide current input then refresh. Missing source-backed Energy/Happy identifies `/user/bars` and Refresh & Plan; stats/Points/selected owned quantities/current effects direct the existing immediate-replan confirmation forms. Preparation effect evidence describes booster capacity as dependent on verified effect/mechanic evidence. Unsupported booster mechanics and elevated ordinary-Happy mapping remain explicit limitations. Optional preparation gaps do not replace a real 50m model-domain blocker. Material gameplay action wording explicitly names State changed / checkpoint reached, then Refresh & Plan. Form validation errors in CURRENT request corrected input and resubmission rather than a new epoch.

H1/H2 remain open and fail closed. Canonical `confirm safe quarter-hour window` is shown as the unavailable H1 timing gate; its unchanged machine nextAction remains in Advanced. H2/worldDiabetesDay never appears as a normal missing-input task and no override is offered. Dedicated H1/H2 messaging remains visible. Advanced retains all raw missing fields, source evidence, reasons, capabilities, unsupported entries and canonical nextAction. Presentation does not change recommendations, ranking, readiness states or reason codes.

Nine additional regressions (three runtime, six UI) cover wrapped/direct/malformed bars; actionable source/manual/gate guidance; genuine blocker preservation; and all four mounted confirmation forms replanning with no API request or epoch change. A fresh refresh still clears all old confirmations; explicit checkpoint still invalidates authority. Frozen J-C tests retain their frozen behavioral expectations while their assertions match the new actionable wording; frozen fixture/spec bytes are unchanged.

Tested product commit: `0ba12a007f0b1fe241b63b563586bb543990e679`, parent `efbe6b34a36dc72896c54f0c29f388cbebd02765`; fetched and matched to executable local tree `a0bcf678b9a563b3b2df15d1fc84c9b3a22c4782`. Product/test files: runtime, UI, their two tests, synthetic fixture helper, regenerated artifact. Active documentation: this checkpoint, NOW, chapter/domain indexes, only the Training open-node row, and one appended changelog event. Historical evidence remains intact. Final documentation-inclusive head is pinned in PR #135 metadata and completion report.

Current generated artifact SHA-256: `961dd9fc2c56eef9106d89403217db6661c05243d771cdd52610e82d515e4a36`.

| Final executed validation | Result |
| --- | --- |
| Existing canonical Training | 162/162 |
| Runtime/UI/build | 67/67 |
| All focused Training | 229/229 |
| Full repository | 466/466, 21 suites |
| Frozen J cases | 34/34, 11 acquisition / 8 packaging / 15 UI |
| Changed JavaScript syntax | 6/6 |
| Deterministic double CLI build / checked-in regeneration | PASS |
| Five provenance hashes / deliberate embedded-core drift rejection | PASS |
| Existing VM fixture parity plus wrapped-v2 acquisition/confirmation/UI artifact parity | PASS |
| Four-quote guard / zero target literals / post-normalization syntax | PASS |
| Canonical/frozen/historical chapter files versus authoritative base | 39 unchanged files |
| Complete diff/scope/secrets/version/JSON/NDJSON history/Markdown/whitespace | PASS |

Exact suite commands are `node --test --test-reporter=tap tests/training-advisor-pure.test.js tests/training-advisor-adapters.test.js`, `node --test --test-reporter=tap tests/training-advisor-runtime.test.js tests/training-advisor-ui.test.js tests/training-advisor-build.test.js`, `node --test --test-reporter=tap tests/training-advisor-*.test.js`, and `node --test --test-reporter=tap tests/*.test.js`. `node --check` ran for all six changed JS files. Two CLI builds, saved byte comparisons, `node scripts/build-training-advisor.js --check`, independent SHA-256, embedded hash checks, deliberate drift and side-effect-guarded artifact VM acquisition were executed. Python matched all 34 IDs to successful TAP results and checked frozen bytes/structured docs. Both base-to-head and previous-head amendment pass `git diff --check`.

No version bump, new endpoint, listener, timer, observer, storage key/schema, migration, dependency, polling, gameplay control or new authority rule. No 60-second TTL returns; caches, request deadlines, keys, Points, inventory separation, protected mechanics and all other products remain unchanged. **Repeat owner TornPDA smoke with the corrected pinned artifact to verify live bars normalization and input guidance.** Prior live startup/key/stats/gym PASS does not establish completion of mobile drag/themes/confirmation/checkpoint/authority persistence or desktop API/CORS/reload gates. PR #135 stays draft/open/unmerged/unreleased.

## Acquisition and session control

One user-triggered **Refresh & Plan** creates a new epoch. Concurrent invocations share its in-flight promise; UI refresh controls are disabled during it. Each source retains independent observation metadata. The UI explicitly says the responses are not an atomic Torn server snapshot.

Approved GET endpoints, all under `https://api.torn.com/v2`:

- `/user/bars`, `/user/cooldowns`, `/user/battlestats`, `/user/gym`, `/user/perks`, `/user/refills`, `/user/money`;
- `/torn/gyms`;
- `/user/inventory?cat=Drug|Booster|Candy`.

Responses unwrap only approved selection envelopes before canonical normalization. Schema changes remain adapter-local failures. Inventory pagination is restricted to the identical official endpoint/category, canonicalized for adapter link checks, and bounded at 20 pages/category. Foreign URLs, unexpected query keys, category changes, redirects, and cycles fail locally. Requests have 15-second abort deadlines; there are no retries, heartbeats, intervals, or background API polls.

Inventory/catalog caches are in memory for up to one hour. Cached inventory retains its original observation/source timestamp and remains planning-grade. Rejected/incomplete cached sources can be reacquired on the next manual refresh. Cache revision guards prevent an old key's in-flight response from becoming another key's inventory cache.

A completed successful refresh remains the current observation epoch until an explicit approved transition. Elapsed wall time, hiding/showing the document, and unrelated page interactions do not invalidate it. The user marks a material player action or VERIFY_STATE checkpoint with State changed / checkpoint reached, then Refresh & Plan to observe reality and replan. Countdown-zero wording requires refresh for the dependent checkpoint and never modifies canonical freshness/cooldown state or globally expires the epoch. Disposal discards current evidence, aborts active requests, and removes listeners/request timers; no polling/observer architecture is added.

## Confirmation and fail-closed boundaries

The required-item form contains only the selected plan's positive owned consumption. Actual confirmation receives the runtime's event timestamp, is filtered to those requested keys, and is then normalized by unchanged J-P logic. Lower quantities and zero override category-cache quantities. Contradiction reruns `recommend`; the old plan is not advanced. Partial proof leaves aggregate execution inventory false. Bought resources remain separate and acquisition-gated. No confirmation survives a new epoch, explicit material-state/checkpoint invalidation, disposal/reload, or key change. Confirmation does not disappear merely because 60 seconds elapsed.

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

Listeners: Advisor click/submit/pointerdown/pointermove/pointerup/pointercancel; window resize; optional device color-scheme change. Document visibilitychange and capture click/submit listeners were removed. DOM ownership: `tornscripture-training-advisor`, `tornscripture-training-style`. Only bounded 15-second in-flight request abort timers remain; no authority timer, interval, or MutationObserver. Repeated initialization is guarded and disposal removes the owned lifecycle surface. No storage keys, endpoints, or gameplay controls were added by the amendment.

## Executed automated acceptance

Historical freshness-correction results at `f9c37b181c22a23f093830e33d987abdfeb7d380` (the compatibility amendment adds one build test; current results are above):

| Validation | Result |
| --- | --- |
| Existing Training suites | 162/162 |
| New runtime/UI/build suites | 57/57 |
| All Training suites | 219/219 |
| Full repository | 456/456, 21 suites |
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

## Owner manual gates — repeated bars/input workflow and remaining browser checks pending

The initial pre-quote-correction startup failed. The subsequent owner smoke passed startup/END injection, compact and expanded mobile UI rendering, managed key, real CURRENT refresh, stats and gym acquisition. Bars normalization then failed and the input/refresh wording loop was observed. Repeat using the latest pinned bars/UX artifact. Desktop gates and remaining mobile interactions have not been claimed exercised.

TornPDA Android:

1. Install the branch's generated 0.1.0 userscript, enable the managed key path, open Torn, and locate the HUD. Before Refresh & Plan, no API traffic or current recommendation should appear.
2. Drag to screen edges, collapse/expand, Open/Close, rotate/use a narrow display, and check Auto/Dark/Light. Touch controls must work with no essential horizontal overflow.
3. Refresh & Plan; verify independent state/source observations, readiness, target, objective, recommendation, resources, and the manual NEXT instruction. Switch objectives and beginner/Advanced; opening Advanced must preserve recommendation identity.
4. For supported owned-item planning, explicitly confirm current effect state, then only required owned quantities. Confirm a lower quantity/zero and verify a replan plus item-local proof, with purchases separate.
5. After a material manual Torn action or VERIFY_STATE checkpoint, press State changed / checkpoint reached; observe invalidation, then Refresh & Plan and verify the new epoch/recommendation. No control may consume, train, refill, buy, or chain actions.
6. Wait beyond 60 seconds and hide/show Torn; ordinary links/buttons/inputs and unrelated form submissions must preserve the same epoch/confirmation. Explicit checkpoint/key change/new refresh must clear confirmation. Reload: preferences/HUD state persist; live state and confirmation do not.

7. Inspect `/user/bars` Energy/natural maximum/regeneration and Happy; ordinaryHappy follows the existing guarded mapping. Confirm current effects, selected owned quantities, manual stats or Points where applicable: each accepted submission replans immediately in the same epoch without a subsequent refresh. Refresh only to reacquire API evidence or after explicit checkpoint/material action. H1/H2 are open limitations, never normal fill-in tasks; Advanced retains raw missing/reason diagnostics.

Desktop Tampermonkey and Violentmonkey:

1. Install the same generated artifact; configure the local fallback key and explicitly Refresh & Plan.
2. Check compact/expanded layout, drag/clamp/collapse, preferences, objective changes, Advanced, required confirmation, and checkpoint flow.
3. Reload and verify preference/HUD persistence, absence of durable live authority, and key exclusion from diagnostics. Forget the local key and verify acquisition degrades.

Fixture/mock fail-closed checks: missing permission, planning-only/missing owned proof, missing Points, unsupported gym/effect, H1 timing, H2 event state, and missing market. The executable fixtures cover these; real WebView/extension/official endpoint behavior remains owner-gated. The minimal DOM event harness is not a TornPDA/browser smoke test.

## Limitations, rollback, independent handoff

H1/H2 are unresolved; Ecstasy timing and affected Candy support cannot be enabled by this build. No market/provider integration, calibrated-all-domain claim, future random cooldown, current cash-reserve input, active-duration estimate, or post-50m forecast is added. Explicit target-stat allocation is the available beginner allocation path. Permission/schema availability is established per source, never promised from a broad key-level label. Material gameplay changes require the explicit checkpoint/refresh workflow; generic navigation is not a gameplay detector. This correction has synthetic event coverage, not a real WebView smoke-test result.

Before merge: leave the draft PR unmerged and disable/uninstall the test script. If separately authorized/merged later, revert the implementation commits in this branch's baseline-to-head range and remove/disable the new Advisor artifact. Optionally remove only its two named local keys; other TornScriptures data is untouched. No data migration or irreversible state exists.

The prior independent `[V][WORK]` passed at `f9c37b181c22a23f093830e33d987abdfeb7d380`. Any subsequent independent verification must pin the **final amended draft PR head**, prove the full executable workspace from the exact base, inspect the complete baseline-to-head diff, reproduce all commands/counts, preserve frozen documents/canonical bytes, check generated parity/drift, key/privacy and lifecycle boundaries, and evaluate this manual-gate distinction. Keep the PR draft/unmerged; no ready, auto-merge, release, or merge action is authorized. The owner completion report supplies the exact final-head prompt.
