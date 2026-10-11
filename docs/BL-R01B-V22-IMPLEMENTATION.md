# BL-R01B v2.2 implementation evidence and acceptance gates

Status: N4–N5 corrected in the separately owner-authorized bounded raw-state consistency pass after [independent V1 BLOCKED at e11fcfc](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6112233636). Author-side executable validation passes; fresh independent exact-head [V1] is required. Owner TornPDA/desktop [V2] and Ledger Integrity remain on hold until V1 PASS. This branch is not a release. Exact published SHA/tree are recorded in the PR conversation, avoiding a self-referential commit hash here.

## Current bounded N4–N5 correction and raw-state audit (2026-10-11)

Owner authority: the submitted `[B][WORK] Fresh Thread, Divine Knowledge Refresh and Bounded N4–N5 Correction` instruction authorizes the underlying raw-state/normalization repair on the same existing draft PR/branch, within frozen BL-R01B v2.2. It does not authorize release or a storage redesign. Approved main/base is `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`; exact amendment parent is `e11fcfc298a1faa20c174a6fe02c714e264fcee6`, tree `ac79f7f9cf39e355e04cd6b902794e0b47194376`, sole parent `d740a3bd7979d2904ee6f0131bf334752b9e50cf`.

Full AGENTS/Divine Knowledge/governance refresh and canonical reports/complete fixtures preceded the raw-state audit. NOW's October 5 main `b8474253…` and IMM/Black Ledger stable 0.19.36 are stale; actual approved main remains stable 0.19.37. No unrelated knowledge cleanup, Casino or Training status inference/edit. A fresh complete non-shallow clean executable checkout on the required branch matched all 212 published blobs and pinned history; native refs and connected PR/tree/parent readbacks agreed. A same-head expected-SHA non-force update proved the existing-branch publication route before product edits. Git 2.51.1, Node v24.19.0, Python 3.12.14; `TSIMM_TEST_SCRIPT` unset.

Pre-edit independent results matched the current report: **643 full / 400 protected / 246 focused PASS**, prior unchanged **38/38 and 3/3**, new unchanged **85 = 67 pass / 18 fail** and **minimal 0/3**, **23/23 syntax**, **22 protected bodies identical**. Full TAP streams/exits were captured; no author logs were reused as proof. The current independent fixture's assertions were not weakened.

### Raw-state lifecycle and supported combinations

Audit covered loading/v3 migration, status, issued envelope/count, cursor/entry binding, receipt identity, A/B issuance/navigation, all four import routes, completion/lost notice/Skip/Cancel, saving/summary and Web Lock revalidation. Two root causes explained the evidence: normalization defaulted/cleaned ready status and synthesized authority, while launch guarded receipts only in launched state; normalization filtered array positions while completion validated a different raw current entry. Saving repeated that normalization.

| Raw persisted combination | Supported behavior |
|---|---|
| Exact v4 ready; unique stable IDs and integer cursor; current count 0, empty attempt/outcome, null envelope, cleared current identity/launch timestamp, coherent source/identity | A may issue after raw validation and no matching consumed same-run/entry receipt, then persist/readback and navigate under exclusion. |
| Exact coherent launched A, count 1, no consumed receipt | Explicit lost-A Retry or validated retry_needed(A) may issue B once. |
| Coherent launched A with full committed terminal receipt | No B. Notice/lost notice/Skip reconciles the same entry once within existing TTL. |
| Partial consumed receipt or malformed issued authority | No retry/replay or invented terminal success; safe explicit queue-only Skip/Cancel. |
| Coherent launched B, count 2 | Valid terminal B can complete; Retry cannot issue C. |
| Ready/missing/null/blank/padded status carrying issued authority or nonzero/unknown count | No attempt/import/automatic completion; passive raw bytes unchanged. Position-bound explicit Skip/Cancel only. |
| Earlier malformed display/source field with intact stable IDs/positions | Retain every entry; Beta's receipt still completes Beta, Gamma remains queued with its own A allowance. |
| Null/nonobject entry, missing/duplicate stable ID, malformed cursor | Preserve positions and raw authority, block execution and ambiguous Skip; explicit Cancel archives the original array cardinality. Unreadable/non-array storage needs export/restore. |
| Malformed following entry | It cannot inherit authority; current validation is required at its own turn. |
| Supported v3 launched | Preserve positions/stable identities; current usage unknown, no B. Explicit Skip may reach a genuinely unissued later entry. |
| V3 ready with issued/coercible fields, malformed status, or unknown/coerced schema | No normalization into a new allowance; malformed status stays byte-preserved until explicit recovery. |

**Invariant A:** v4 normalization preserves raw authority values, status is never defaulted/trimmed into ready, cursor/count/clock are not coerced, and envelopes/IDs are not reconstructed. Start explicitly constructs fresh IDs and an unissued ready state. Ready and launched predicates inspect raw storage under the existing grant before issuance/import/navigation; consumed same-entry receipts also block an apparent count-zero reset. Queue serialization does not re-normalize authority. Supported v3 migration remains conservative and cannot give malformed/coercible future counts a fresh A.

**Invariant B:** normalization never filters or drops array positions. Completion/Skip bind the exact raw cursor/current stable entry; malformed structural identity blocks execution. Explicit advancement clears current identity/launch timestamp without resetting another entry's count. Summary cardinality/IDs retain the original positions; malformed IDs are omitted rather than trimmed into another record, and `captured` needs a coherent matching committed receipt. Display name arrays derive from the validated summary outcomes. Safe malformed Skip changes only its intended queue entry; prices/receipts stay unchanged.

No new queue owner, key, schema version, storage architecture, browser listener/timer/observer, endpoint or gameplay action. The existing lock and synchronous critical sections, 60s issued deadline, 15m request TTL, 12h queue TTL and seven-day summary remain. All five previously repaired V1 findings and N1–N3 retain their production behavior. All 22 protected financial/recovery function bodies and the safety boundary remain byte-identical to approved base.

### Maintained production-path tests and final results

Only three files change in this amendment: IMM, this directly relevant evidence, and new `tests/imm-capture-n45.test.js`. Cumulative PR inventory is nine files (previous eight plus N4/N5 tests). Existing tests/harness remain unchanged. Five version markers remain 0.19.39 for this draft amendment; exact SHA/tree distinguish candidates. Release-ready versioning remains a separate gated decision.

The new file has **554 cases**: unchanged independent 85-case assertions (only harness import relocated), **378** cross-product cases (ready/launched/unverified × 0/1/2 counts × absent/coherent/contradictory envelope × committed/uncommitted × seven entry-position conditions), and **91** recovery/identity/migration/summary/waiting controls. Full userscript, actual production paths and genuine native Node Web Locks execute; no replacement authority/queue mock. Exact Trader Book/queue/protected-store bytes are asserted on rejection. All original N4/N5 failures and prior 38/3 external expectations remain intact.

Development calibration: three new matrix assertions initially treated an exhausted Retry as rejection of a valid B result. They were corrected to require valid B completion without C. Static review also added missing-ready-field cases and removed a possible null-source normalization exception. Original independent assertions were unchanged.

| Final check | Result | Exit |
|---|---:|---:|
| Full supported Node suite | **1197/1197**, 21 suites | 0 |
| Protected regressions | **400/400**, 21 suites | 0 |
| Focused production paths | **800/800** | 0 |
| Maintained N4/N5 file, included above | **554/554** | 0 |
| Unchanged prior external adversarial / minimal | **38/38**, **3/3** | 0 / 0 |
| Unchanged current external adversarial / minimal | **85/85**, **3/3** | 0 / 0 |
| Every tracked JS/CJS, individually | **24/24** | all 0 |
| Complete staged/base/amendment diff checks | PASS | all 0 |
| Protected financial/recovery regions vs approved base | **22/22 byte-identical** | 0 |

All final groups have zero failures/cancellations/skips/todos; counts overlap. Commands, from the candidate checkout:

```bash
node --test --test-reporter=tap tests/imm-api-trade-recovery.test.js tests/imm-capture-coordination.test.js tests/imm-capture-lifecycle.test.js tests/imm-capture-n123.test.js tests/imm-capture-n45.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js tests/imm-startup-persisted-permission.test.js tests/inventory-sales-core.test.js tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js
node --test --test-reporter=tap tests/imm-api-trade-recovery.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js tests/imm-startup-persisted-permission.test.js tests/inventory-sales-core.test.js tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js
node --test --test-reporter=tap tests/imm-capture-coordination.test.js tests/imm-capture-lifecycle.test.js tests/imm-capture-n123.test.js tests/imm-capture-n45.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js
node --test --test-reporter=tap tests/imm-capture-n45.test.js
node --test --test-reporter=tap ../n45-evidence/fixture-6106507705-1.cjs
node --test --test-reporter=tap ../n45-evidence/fixture-6106507705-0.cjs
node --test --test-reporter=tap ../n45-evidence/fixture-6112233636-1.cjs
node --test --test-reporter=tap ../n45-evidence/fixture-6112233636-0.cjs
git ls-files '*.js' '*.cjs'
node --check <each-returned-path>
git diff --check
git diff --cached --check
git diff --check c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475
git diff --check e11fcfc298a1faa20c174a6fe02c714e264fcee6
```

### Fresh independent gate, browser limits and rollback

Request fresh independent exact-head executable/adversarial **[V1]**, with live refs/tree/parent/all bytes, full frozen contract, both original 38/3 and current 85/3 fixtures, maintained matrix review, new negatives, original V1-01–05/N1–N3 controls, all supported/protected/focused/syntax/diff/storage checks and 22 protected-body comparisons. Author PASS is not independent V1. Owner [V2]/Ledger Integrity stays on hold until V1 PASS; no merge/ready/auto-merge/release/main authority.

Everything above is Node VM/DOM simulation, with native Node lock contention. Owner TornPDA Web Locks capability qualification is not product acceptance. Real provider markup/identity, carrier retention, document-start readiness, desktop managers, touch/layout, BFCache/Android kill/close, older noncooperating writers and multi-key interrupted persistence/rollback remain live risks. Preserved async receipt/local-recapture caller feedback/cleanup timing was reviewed and not rewritten. After request TTL, lost-notice completion still rejects; explicit Skip may record user_skipped while preserving committed Trader Book data. No TTL policy expansion. Pre-correction ready queues retaining old issued/current timestamp fields deliberately become unverified; use explicit safe recovery, never automatic budget repair.

After fresh V1 PASS, separate owner V2 must add ready/issued contradiction no-write/recovery and Alpha→Beta→Gamma notice/lost-notice/Skip/Cancel/reload controls to the existing checklist below, using backed-up Trader Book/Ledger and exact unchanged accounting bytes plus Ledger Integrity. Rollback: preserve exports, explicitly Cancel/export unresolved review queue/summary, disable review IMM and reinstall approved-base stable 0.19.37. Never resume v4 in-flight state under v3 or bulk-reset accounting. This work remains unmerged.

## Prior bounded N1–N3 correction at e11fcfc (historical)

Owner authority: the submitted `[B][WORK] Fresh Thread, Divine Knowledge Refresh and Bounded N1–N3 Correction` instruction authorizes these three corrections on existing draft #139/branch only, superseding the prior blocked disposition for implementation scope, not certifying this new product candidate. Approved main/base remains `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Exact correction parent is `d740a3bd7979d2904ee6f0131bf334752b9e50cf`, tree `2266423893229a03e16b4898979893f137ee51fa`. Its sole parent is `0d2da7a6e4c295c277c0e40b502b2c56dca7311c`.

The full Divine Knowledge bootstrap, relevant domain indexes/DQ-EXT-001 and governing documents were refreshed against live GitHub. NOW still records October 5 `b8474253…`; IMM/Black Ledger indexes still say stable 0.19.36, while approved main is 0.19.37 and this draft is 0.19.39. Current frozen issue #78 and PR #139 evidence govern. No unrelated memory cleanup, Casino or Training status inference/edit was performed.

Executable preflight: complete non-shallow clean worktree on the required branch, 790 reachable commits and connectivity check PASS; all 211 remote blob paths/SHAs and worktree bytes match the starting tree. Complete approved-base and prior-correction binary diffs were materialized/inspected. Live native main/branch/PR-head refs and connected PR base/head/draft state matched every handoff pin. A connected same-head, expected-SHA, non-force branch update proved the publication route. Native authenticated Git push failed for missing credentials and was not used; local Git/Node plus connected Git objects/ref publication remains the verified route.

Pre-edit fresh results: full **521/521**, protected **400/400**, focused **124/124**, exits 0. The full independent report and both JavaScript fixtures were fetched from comment `6106507705`; their assertions were not altered. Extracted outside-repository fixtures reproduced exactly **28 pass / 10 fail** and **0 pass / 3 fail**, exits 1: five N1 terminal outcomes, four N2 nested identity variants and one N3 session-only Cancel.

| Finding | Bounded production correction and recovery |
|---|---|
| N1 committed terminal A bypassed by Retry | Under the existing grant, Retry requires a self-consistent current persisted attempt, exact unique trader/Torn identity, matching last terminal receipt with complete envelope/expiry, and its matching consumed-receipt record. It **fails closed without B**, with explicit Skip recovery guidance; existing completion/Skip consumes the committed result once. No loose last-outcome flag proves commitment. Partial matching receipts block Retry/replay but cannot prove terminal success; explicit Skip may close that entry without changing its trader bytes. Genuinely uncommitted/lost A, including after request TTL, and valid `retry_needed(A)` still issue B once; never C. |
| N2 inconsistent persisted envelope authority | Shared pure `captureCurrentAttemptEnvelope` checks raw schema/cursor, queue/run/current-entry/attempt/trader IDs, intent, provider/canonical source, expected Torn ID, issuance/deadline/transport/lifetime clocks, launched timestamp, budget and unconsumed entry state. Raw values must equal their validated representation; numeric-string/trim normalization cannot confer authority. All four import routes, completion and relevant navigation use this check. Malformed launched queues present as unverified; passive rejection preserves raw storage. Explicit Skip/Cancel may close/advance the queue with no price or terminal capture-receipt write based on contradictory authority. |
| N3 session-only v3 first Cancel | Snapshot the actual local run or supported schema-v3 session fallback before waiting, then revalidate that run ID under exclusion. A different local replacement rejects; migration of the same intended legacy run can be canceled. No inferred legacy budget, implicit retry or bulk reset. |

This correction changes only **three files**: the IMM userscript, new `tests/imm-capture-n123.test.js`, and this evidence document. The cumulative PR has **eight files**, adding the new test to the previous seven-file inventory below. Existing maintained tests/harness are unchanged. All five IMM version markers remain **0.19.39** for this draft amendment; distinguish candidates by exact SHA/tree. This is not a release-ready version decision; release still requires the project's patch-version rule and separate owner authorization.

The new maintained file executes **122 cases**: the prior independent 38-case fixture with the same assertions (only the harness import adapted to its maintained location), plus **84** bounded controls. Controls include all five terminal outcomes, partial/malformed receipts, a store acquiring before a waiting Retry, all envelope fields missing/contradictory/coerced, enclosing queue/entry contradictions, all four write routes, 20 combined committed-terminal/corrupt-ID cases, safe malformed-B Skip to the next trader without C, real exclusion over legacy first Cancel, same-run migration versus different-run replacement, and denied-lock/persistence recovery. Ledger/purchase/sale/API sentinels and the actual unresolved-trade-journal key are preserved. Receipt audits remain within the protected Ledger bytes.

Development fixture calibration: one newly authored waiting-Cancel assertion initially compared every session key, incorrectly rejecting the established diagnostic notice. It now verifies unchanged original session queue/keys plus exactly the expected rejection diagnostic. All original independent assertions remain untouched; no product behavior was changed for that fixture assumption.

### Prior e11fcfc executable commands and outcomes (historical)

Python `subprocess.run` captured complete TAP streams and final exits. Git 2.51.1 / Node v24.19.0; `TSIMM_TEST_SCRIPT` unset. Groups overlap and are not additive unique counts.

```bash
# Complete supported suite: 643/643, 21 suites, exit 0
node --test --test-reporter=tap tests/imm-api-trade-recovery.test.js tests/imm-capture-coordination.test.js tests/imm-capture-lifecycle.test.js tests/imm-capture-n123.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js tests/imm-startup-persisted-permission.test.js tests/inventory-sales-core.test.js tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js

# Protected regressions: 400/400, 21 suites, exit 0
node --test --test-reporter=tap tests/imm-api-trade-recovery.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js tests/imm-startup-persisted-permission.test.js tests/inventory-sales-core.test.js tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js

# Focused: 246/246, exit 0
node --test --test-reporter=tap tests/imm-capture-coordination.test.js tests/imm-capture-lifecycle.test.js tests/imm-capture-n123.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js

# Exact unmodified fixtures extracted from the independent report, outside checkout:
node --test --test-reporter=tap ../n123-evidence/v1-independent.test.cjs
node --test --test-reporter=tap ../n123-evidence/v1-minimal-blockers.test.cjs
# 38/38 and 3/3 respectively, exits 0

git ls-files '*.js' '*.cjs'
node --check <each-returned-path>
# 23/23 individual syntax exits 0
git diff --check
git diff --cached --check
git diff --check c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475
git diff --check d740a3bd7979d2904ee6f0131bf334752b9e50cf
```

All final test groups have zero failures/cancellations/skips/todos. The 22 complete protected financial/recovery function regions were freshly compared byte-for-byte to the approved base: all identical. Safety-boundary text and storage-key literals are unchanged. No storage key/schema/migration, listener, timer, observer, network endpoint, gameplay action, UI ownership or financial arithmetic was added or removed by N1–N3. The existing schema 4 and migration/summary ownership remain.

The asynchronous receipt/local-recapture callers noted by V1 were inspected: they do not participate in these carousel authority corrections. Their preexisting feedback/cleanup timing remains a later live acceptance risk; no unrelated handler rewrite or financial PASS is inferred from preserved function bodies.

Next gate: request one **fresh independent exact-head [V1]**, using the original external fixtures plus the maintained combined controls, full/protected/focused suites, syntax/diff checks and protected byte comparison. No author test substitutes for independent V1. V2 remains on hold. After V1 PASS, owner acceptance must cover the existing checklist below, committed-terminal Retry/Skip recovery, malformed-envelope no-write and explicit recovery, session-only first Cancel and delayed replacement isolation, actual document-start/browser lifecycle, real provider identity/markup/carrier and unchanged Ledger export plus Ledger Integrity. Native Web Locks browser qualification is not product acceptance. No live browser/gameplay, infrastructure or spending was performed.

Rollback remains stable IMM 0.19.37 from the approved base after disabling review IMM and preserving Trader Book/Ledger backups. Cancel/export unresolved review queue/summary deliberately before downgrading; do not resume schema-v4 state in a v3 runtime or reset accounting. The remaining historical evidence below describes the prior implementation and first correction, not independent acceptance of this amendment.

## Authority and executable preflight

- Repository: `KingAeon/TornScripture`.
- Exact approved base: `main@c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`.
- Branch: `agent/bl-r01b-v22-trader-refresh-implementation`, rooted directly at that commit, using a fresh full worktree. Neither the proof branch nor the stopped v2.1 worktree is its parent.
- [Frozen v2.2 specification](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6078502732), [independent specification PASS](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6078562226), [owner freeze](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6089767188).
- [Protocol blocker/findings](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6078348502) and [prior executable/publication preflight](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6077700883).
- Read `AGENTS.md`, Project Charter, Assistant Operating Rules, Development Workflow, Ledger Invariants, Divine Knowledge INDEX/NOW/AUTHORITY and the relevant IMM, Black Ledger, external trader, tooling and DQ-EXT-001 capture-continuity nodes.
- Rechecked GitHub `refs/heads/main` and `git ls-remote --heads origin main`: exact approved SHA. `git remote get-url origin` identifies the specified repository. `git rev-parse HEAD` matched the base before edits; `git status --porcelain=v1` was empty; `git rev-parse --is-shallow-repository` returned `false`. Git `2.51.1`; Node `v24.19.0`; complete original checkout: 207 tracked files.
- Baseline: all 19 existing JavaScript files passed `node --check`; all seven existing test files passed direct execution; full supported baseline suite passed **399/399**, 21 suites, zero failures/skips/cancellations/todos. Exact base-to-head diff inspection and native Git object fetch are available.
- Resume preflight pinned the unchanged blocked head `0d2da7a6e4c295c277c0e40b502b2c56dca7311c` / tree `32ab1810b678a703b69f070a810e6a8ff3e4a7f0`, the existing required branch and draft/unmerged PR #139. Clean non-shallow checkout; main/PR base unchanged. Fresh base suite **399/399**; blocked-head suite **446/446**; original independent fixtures **3 passing / 5 failing**, plus the extra pre-write Cancel fixture **1 failing**, before editing.
- [Resume authorization](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6106030545), [independent V1 findings/fixtures](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6092374166), [pre-write race and prior qualification blocker](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6096198364), [shared-lock/abort evidence](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6105808085), [holder-tab close qualification PASS](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6105842350). The owner accepted the observed TornPDA Android 16 / Chromium WebView 153 qualification for this bounded correction.
- Publication uses the proven combined route: local executable workspace → connected GitHub blobs/tree/commit/existing branch update → native fetch and exact tree/diff readback → existing draft PR #139. No second PR. Authenticated native `git push` remains unproven and is not claimed.

## Modified files and version

| File | Change |
|---|---|
| `TornScripture-Item-Market-Margin.user.js` | Shared capture authorization, existing queue/schema extension, provider deadline/checkpoint lifecycle, historical read guards; five version markers `0.19.37` → original `0.19.38` → corrected `0.19.39` |
| `tests/helpers/imm-capture-harness.cjs` | Full production userscript VM, origin-scoped real Node Web Locks, asynchronous document-start readiness, controllable timers, provider DOM and persistence faults |
| `tests/imm-capture-coordination.test.js` | 75 maintained production cases: original eight V1 fixtures, both race boundaries, contention/abort/denial, legacy aliases, Buy Price provenance, dock refresh and malformed expiry across all write paths |
| `tests/imm-capture-lifecycle.test.js` | 46 production-path lifecycle/storage/read-safety tests |
| `tests/imm-carousel-identity-precedence.test.js` | Preserve PR #91 numeric-route/link precedence and 307-price capture assertions through the production runtime |
| `tests/imm-carousel-zero-price-mismatch.test.js` | Preserve wrong-ID zero-price failure, one cursor advance, replay rejection and matching zero-price waiting/success coverage |
| `docs/BL-R01B-V22-IMPLEMENTATION.md` | This evidence, migration, limitations and owner acceptance/rollback guide |

The two protected carousel fixtures previously stubbed parsing and expected a provisional v1 success bridge. Their protocol expectations now require v2.2 final validation and prohibit a preview bridge. Their identity, price preservation and queue progression assertions remain, with real production parsers and early/late storage paths. Other protected test files are unchanged.

## Capture authority and persistence

`captureAuthorityDecision` is a shared pure decision used by early imports, ordinary imports and `saveTraderPriceCapture` before any carousel-origin trader-book mutation. It requires the live schema-v4 Torn queue, exact run/entry/attempt/record, original issued clock/deadline/TTL, supported canonical source, independent expected Torn identity and an unconsumed result. Only Torn controls queue issuance. Exact book/queue/pending snapshots are reread immediately before the write; set/readback failures block automatic continuation and attempt to restore previous book/queue bytes.

Automatic imports never create a trader. A fresh direct manual button interaction creates separate short-lived authority, requires independent page identity and visible provider/Torn target confirmations, and can resolve an exact armed record or one unambiguous Torn ID. Missing intent/v1 automatic results, name-only matching and active-carousel manual collisions cannot write. Malformed stored JSON is preserved and blocks imports/new runs. Missing, nonfinite, nonnumeric, inverted, future-start or over-12-hour persisted queue lifetime blocks every capture-store path independently of request expiry. Passive inspection cannot repair those bytes into capture authority; explicit Skip/Cancel remains available. Cleanup removes the offending result, preserving an unrelated current request.

A committed terminal receipt permits Torn to recover a missing completion notice without importing prices twice. Request replay receipts are bounded to 64 live receipts per trader; imports fail closed rather than discard live replay protection. Expired receipts may be removed on a later valid import. These correlators protect state identity/replay; they do not authenticate provider truth.

## Coordinated Torn-origin transitions (V1-01)

The native exclusive Web Lock `tornscripture-imm-capture-transition-v1` covers the existing Torn queue owner, document-start imports/failure notices, ordinary imports, direct capture saves, manual capture saves, creation, A/B issuance, completion, receipt recovery, Skip, Cancel, migration, expiry, summaries, persistence readback/rollback and the navigation decision. Authority is read and validated fresh after grant. Critical bodies are synchronous; nested calls remain inside the same grant. There is no localStorage lease/CAS, provider-owned queue, new persistent key or background lock poller.

A pre-grant snapshot binds user intent, not authority. Retry/entry controls reject changed queue bytes after waiting. Cancel binds the run ID: it can cancel that same run's B issued ahead of it, but cannot cancel a replacement run. Exclusion linearizes both original race boundaries: a completed Cancel ahead of Retry prevents B; a Cancel requested while Retry already holds exclusion waits until that tracked B decision finishes, then closes the same run. Post-write readback alone is not claimed as cross-tab atomicity.

Acquisition waits at most five seconds; pagehide/hidden visibility abort pending waiters, and all acquisition timers are cleared. Missing/not-ready/throwing/denied locks, null grants and aborted waiters fail closed without price writes or navigation. Pagehide during document-start waiting prevents application boot after interruption. Normal startup remains synchronous when no early capture is present; only actual early work awaits exclusion. Fixtures exercise this production entry path before application constants/initialization, rather than stubbing it. The live owner qualification used document-end and does not itself prove product document-start behavior.

Native locks coordinate cooperating same-origin review-version tabs. They cannot exclude an already-running older IMM version, manual DevTools writes or another noncooperating script. Close/reload all IMM tabs and run only one installed review version for V2. Exclusion is not a multi-key database transaction: a killed holder can leave a tracked issued attempt or committed receipt; existing interruption/receipt recovery still owns recovery. Rollback on storage failure remains best effort.

The shared writer also preserves wrappers, raw legacy identities and unknown fields for intentional local manual price saves. It writes only the Trader Book, bypassing the general trader upsert's sale-link side effects; receipt/accounting handlers themselves remain byte-identical to the approved base. A preexisting misspelled manual-save return field is corrected to retain the established result contract. No financial record is altered by a price-only save.

## Torn-owned attempts and recovery

A launch persists and reads back `launched` A with `attemptsUsed=1`, stable entry/record IDs, canonical source, issue time, 60-second deadline and 15-minute transport expiry. Reloads reuse the issued deadline. One supported active provider page may return prices/conclusive failure or a zero-price `retry_needed(A)` at the deadline. Torn validates that checkpoint and alone persists/readbacks B with a new attempt ID and `attemptsUsed=2` before navigating. B is final; no automatic third attempt exists.

Lost A handoff or a page that never executes the script requires explicit Torn Retry to issue B once. Lost B return exposes exhausted Retry and Skip/Cancel. Pagehide or hidden visibility stops the provider watchdog, debounces and observers; there is no off-page rescue. Existing Torn UI scheduling/interval ownership remains. Initializers are idempotent; the former untracked second provider rescans and delayed return timers are removed. No endpoint, API schedule, background service or gameplay action is added.

The 60-second production window, 15-minute request/return TTL, 12-hour queue TTL and seven-day result summary expiry are separate. Delivery after the deadline can succeed only for a bounded production timestamp within the same still-current attempt. Expired messages cannot renew an attempt. Failed summary persistence retains a closed queue for recovery; failed expiry/migration cannot be bypassed by overwriting the unresolved run.

| Outcome | Admissible evidence and effect | Retry/recovery |
|---|---|---|
| `captured` | Independent matching source/identity, nonempty supported positive prices, production inside issued window; replace snapshot and successful capture time once | Terminal, advance once |
| `explicitly_empty` | Native main heading/status explicitly says “This pricelist is empty” (including the supported trader-pricelist wording); zero new prices | Terminal; old snapshot historical |
| `explicitly_unavailable` | Native main heading/status explicitly says the trader is not buying/unavailable/closed; zero new prices | Terminal; old snapshot historical |
| `loading_or_inconclusive` | Zero rows without affirmative final evidence | Transient; page-active wait within original deadline, no price write |
| `retry_needed` | Original current A at its deadline, independent matching identity, zero prices | Nonterminal; only Torn may checkpoint B |
| `parser_failure` | Recognizable TornExchange item table without supported positive Buy Price evidence | Terminal; keep old snapshot historical |
| `identity_mismatch` | Wrong independently observed ID or independently unknown provider ownership; supported correlated provider route, zero prices | Terminal failure; manual recovery, advance once |
| `unsupported_page` / unexpected route | Torn cannot establish a supported source/saved ID, or provider request is unqualified | No price import; queue reason/manual-only return and Skip/Cancel as applicable |
| `timeout` | Final B deadline, original authority/identity, zero prices | Terminal; historical snapshot, no third attempt |
| `user_skipped` | Explicit Torn Skip; current authority where still live | End this entry; invalidates its later results |
| `canceled` / `expired` | Torn control/queue expiry closes authority; summary distinguishes attempted and untouched entries | Explicit new owner-started run only |

Final-state text matching is conservative. Other wording, plain zero counts or refresh timestamps remain inconclusive. The literal fixtures prove classification behavior; actual provider empty/closed states have not been exercised live.

## Providers and migration

Weav3r retains the existing numeric `/pricelist/{TornID}` identity and existing hash request carrier. Unrelated profile links do not override the route. The fixtures exercise a reset `window.name`, contradictory hash rejection, 307 real-parser rows and wrong-ID zero rows.

TornExchange prices require one recognized Buy Price column and a positive currency value from that exact cell; quantities, IDs, generic Price/Sell Price columns and numeric text fallbacks cannot supply it. Incomplete recognized item tables cannot publish partial success. TornExchange accepts independent, explicitly labeled Profile/View Profile or Start/Set Trade controls pointing to supported HTTPS Torn profile/trade routes, requiring one consistent Torn ID. Requested/echoed IDs, slugs and names are insufficient. No automatic mismatch override or provisional success bridge exists. **No new TornExchange hash/query carrier is enabled:** no real TornPDA/browser qualification was established. Existing `window.name` can be used conditionally when it survives and ownership is independently present. Carrier loss or unknown ownership exposes manual-only recapture/Retry/Skip and cannot become automatic quote success. Conditional VM success is not browser qualification.

Storage keys remain `tornscripture-imm-traders-v1`, `tornscripture-imm-favorite-recapture-carousel-v1` and `tornscripture-imm-trader-recapture-result-v1`. Queue/summary schema becomes 4; old name arrays remain display-compatible. Entries add stable IDs, current envelope/attempt, attempts-used and typed reason/outcome. Trader records add last outcome/reason, terminal-check count and replay/completion receipts. Existing trader fields and object store wrappers are preserved by shared imports and local manual price saves. Stable identity uses the baseline precedence `recordId` → `uuid` → string `id`, including notices, recovery and Skip. Skip after a committed receipt completes that receipt once instead of replacing it with a conflicting Skip result.

A schema-v3 launched current entry has unknown allowance and migrates to `unverified`, with Skip/Cancel and an explicitly new run after closing it. It cannot be relabeled A or silently credited B. Later unlaunched entries have zero issued attempts; a ready current legacy entry may start A. Completed legacy identity/outcomes remain unverified. Failed-retry summaries target exact record IDs. A legacy failed name maps only to one present matching record; ambiguous names require owner selection/arming.

Existing `pricePageCaptureCount` values are retained. Supported external successful imports increment once; failed/checkpoint outcomes do not. The preexisting direct Torn-page path still counts checks, including zero-price checks. `pricePageAttemptCount` records accepted terminal checks, not issued attempts; the queue's `attemptsUsed` alone owns the two-try allowance. No failed result changes saved prices, successful capture time, URL history, successful capture count or changed-price count.

## Freshness/read-path matrix

Successful capture time alone establishes capture age and the unchanged 72h/168h buckets. Last attempted check is separate. Provider refresh metadata is labeled as provider metadata, not trader-authored quote freshness; trader-authored freshness remains unknown. Failed/empty/unavailable/timed-out quotes remain historical and cannot be current-best/buy opportunities. Successful prices are indicative, with buying terms unverified.

| Production consumer | Guard and fixture evidence |
|---|---|
| `tradeExitQuoteForTrader` / `singleItemTraderQuotes` | Successful capture clock only; failed archives excluded from best-exit ranking; Trader Book recovery link |
| Priced Trade best match / differences / compact badges | Historical current/alternative quotes cannot produce top-match/gain assertions; descriptive historical unit price remains |
| `pricedTradeRenderRowBadge` | Historical/unverified annotation, no projected profit/ROI; existing user-armed native MAX controls preserved |
| `buildTradeExitAudit` | Historical alternatives excluded from best-known actionable totals; live verified Torn cash remains separate and unchanged |
| `renderPricedTradePanel`, compact/detailed Trader Book, dossier | Last capture/check, failure reason and indicative/historical status shown separately; archived item rows/source retained |
| `normTraders`, `exitsForItem` / `bestExit` / `renderWatchPanel` | Failed prices cannot produce BEST EXIT/buy threshold signals; historical references have Trader Book recapture action; market health receives no historical current quote |
| `renderWatchDock` | Same selected record/item is re-read from storage on every render; failed prices show historical/not reverified, capture/attempt provenance and Trader Book recapture; successful quotes remain indicative |
| Favorite/all/stale/failed retry selection | Successful age only, exact IDs, avoid/hidden preserved; failed check cannot reset 72-hour selection age |

Pricing formulas, precedence, strategy, lot/sale recording, actual transaction arithmetic, FIFO, receipts, journal/recovery, API credentials, Casino and Training are unchanged. Twenty-two protected function sections were compared byte-for-byte with the base: ledger normalization/integrity, trade sale/lot accounting, journal/evidence/receipt normalization, completed-trade staging/recovery, imports, native MAX and purchase/network observers, receipt-link and sale-link handlers; all identical. Production fixtures also preserve protected-store byte sentinels and reject unauthorized store writes. This is synthetic evidence; owner Ledger export and Integrity checks remain required.

## Prior executable verification at d740a3b (historical)

All final commands below ran from the executable worktree, with zero exits and complete TAP summaries. Python `subprocess.run` captured/drained stdout before writing evidence; some shell-redirected preflight attempts exited zero with incomplete output and were not treated as passing evidence.

```bash
# Complete supported suite: 521/521, 21 suites
node --test --test-reporter=tap tests/imm-api-trade-recovery.test.js tests/imm-capture-lifecycle.test.js tests/imm-capture-coordination.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js tests/imm-startup-persisted-permission.test.js tests/inventory-sales-core.test.js tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js

# Protected suite: 400/400, 21 suites
node --test --test-reporter=tap tests/imm-api-trade-recovery.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js tests/imm-startup-persisted-permission.test.js tests/inventory-sales-core.test.js tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js

# Focused production paths: 124/124
node --test --test-reporter=tap tests/imm-capture-coordination.test.js tests/imm-capture-lifecycle.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js
```

Per-file results: coordination **75**, lifecycle **46**, identity precedence **1**, zero-price mismatch **2**, persisted-permission startup **1**, API trade recovery **233** (21 suites), inventory-sales existing assertions pass (Node counts the file as one), Training adapters **53**, Training pure **109**. All final groups: **0 failures, cancellations, skips or todos**. New cases add 75 to the blocked head's 446; baseline main remains 399. The original negative reproductions are failures captured before editing, not omitted final tests. Development runs found Cancel intent binding and fixture scheduling/readback assumptions; these were resolved before final verification.

Every tracked JavaScript/CJS path from `git ls-files` (including the new maintained test) was individually checked with `node --check`: **22/22**. `git diff --check` passed. Complete approved-base-to-head and blocked-head-to-correction diffs, all seven modified files, version markers, key/schema compatibility, production test calls and 22 protected function bodies were inspected. The two carousel regressions retain all assertions, awaiting real production acquisition/imports. No gameplay, credential, Casino or Training file changed. Published exact commit/tree/diff and draft/main readback are recorded on PR #139.

## Owner [V2] smoke checklist and rollback

1. After fresh independent V1 PASS and owner V2 authorization, export Trader Book and Black Ledger JSON; preserve original bytes, installed stable version and Ledger Integrity result. Keep backups outside Git. Close/reload every old IMM tab; enable only one IMM script/version in all Torn tabs. Use the exact reviewed branch/head and its documented version after owner authorization to test.
2. In two same-origin Torn tabs, complete Cancel before Retry and reverse their order. Completed Cancel must never be resurrected; a Cancel waiting behind a granted B must cancel that same run after the B decision. Try duplicate Retry, cancel then start a replacement run, hide/close the waiting tab and close the holder. Denied/unavailable locks in an isolated diagnostic profile must give visible no-write/no-navigation recovery, including document-start returns.
3. On TornPDA Android and relevant desktop, open Trader Book on Torn. Run favorites, stale, all and failed retry. Verify exact IDs, avoid/hidden exclusion, and valid → failed/empty/timeout/wrong-ID → valid progression. Use fixtures for adversarial provider cases that cannot safely be reproduced live. Never infer unavailable from zero rows alone.
4. Observe actual A issuance → provider deadline → Torn checkpoint/readback → B. Reload before expiry; the deadline must not restart. Lose A return: explicit Retry once. Lose B return: exhausted, Skip/Cancel only. No same-run C. Interrupt before userscript execution and switch apps; return manually to Torn without unattended rescue.
5. Verify Weav3r numeric route precedence, reset/stripped transport behavior and mismatched zero-price recovery. For TornExchange verify actual independent page ownership and whether `window.name` survives. Carrier loss must show manual-only recovery. No TE URL carrier is claimed qualified. On a supported Buy Price table, quantity/ID values with a blank, zero or unsupported price must not become a price; verify a real positive Buy Price control. Confirm direct unarmed and armed manual captures and mismatch/cancel no-write behavior.
6. Test duplicate notices, delayed A after B, canceled/old-run replay, identical names, recordId/uuid-only capture + lost-notice recovery + Skip, malformed expiry preservation and legacy v3 unknown allowance and explicit new-run recovery. Test storage denial/readback failure using an isolated test profile: no automatic navigation or reset allowance; original exports remain recoverable.
7. Inspect compact/detailed Trader Book, dossier, Best Trader Exits, Priced Trade best/row annotations, Trade Exit Audit and watched-market banners and the selected watch dock before/after a failure on the same item. A failed recent quote stays historical, age does not renew, and no gain/buy-below/top-buyer signal appears. Confirm real counterparty-verified Torn cash remains distinct. Native quantity/MAX actions must still require their established user arming.
8. Export Ledger again without performing accounting actions; require exact unchanged bytes and Ledger Integrity PASS. Record browser/TornPDA version, exact SHA, observations and screenshots. VM fixtures do not satisfy this live gate.
9. Rollback: cancel the review queue while storage works, disable review IMM, reinstall the script from base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475` / stable 0.19.37. Restore the backed-up Trader Book if needed through existing import UI. Keep Ledger untouched; restore its backup only if an independently identified integrity problem requires it. With IMM disabled, export and deliberately remove the review queue/summary keys if they cannot be canceled; do not let a downgraded v3 runtime resume a schema-v4 in-flight queue. No speculative migrations or bulk account-data resets.

The owner supplied limited live Web Locks qualification, not live acceptance of this corrected implementation. Product document-start acquisition, close/kill recovery, desktop lock support, browser carrier retention, real provider final-state markup, narrow Android layout and live Ledger Integrity remain unverified limitations. Local storage rollback is best effort if the storage medium itself remains unavailable; navigation stays blocked and backups are the recovery path. DQ-EXT-001C quote freshness/precedence work remains open. Independent [V1], owner [V2] and separate explicit merge/release authorization are required. Do not merge, mark ready, enable auto-merge, release or modify main from this implementation.
