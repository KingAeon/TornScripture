# BL-R01B v2.2 implementation evidence and acceptance gates

## HEV-01 historical proof contract and harness recovery (2026-10-21 UTC)

Authority: [owner-frozen HEV-01 through HEV-06](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6286918190), the owner's consolidated implementation brief, GG-UI-01 provenance exception, and subsequent receipt-harness portability/recovery authorization. This section supersedes earlier claims of sufficient historical semantic validation; sections below retain their historical implementation evidence.

The original candidate is `6535ee86ee907951938118a201f247702ea1304e`, tree `900b2da195aa58e13e163bd6722a192fc0f6496b`, sole parent `e9d46125566136ca35224af186a33b5a5f153d7d`. Historical comparisons retain approved base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Live main is separately approved `529400117f727da31a058b7941c29693f40bb1b3`, exactly one GG-UI-01 commit ahead of that base. No rebase or integration occurred. **Issue #142 reconciliation and independent integration regression remain mandatory before merge/release.** IMM 0.19.39 and Report 0.2.3 remain the draft pair; tester installations and release metadata are untouched.

### Executable preflight and isolated harness commit

The complete, clean, non-shallow checkout has executable Git 2.52.0 and Node v24.19.0, accessible history, native Node Web Locks, full diff inspection and Git object integrity. The **original unmodified baseline did not pass** in this execution environment. The focused receipt-identity test failed in under one second at both 15-second and 120-second limits: its historical Report loader's `execFileSync` throws `spawnSync git EPERM`, despite Git status 0, no signal, and complete output. An asynchronous Git call returns identical bytes. Resource/deadlock/timeout explanations were not substituted for that evidence.

Owner-authorized isolated test-only commit: **`602396de14a0edad7460d89720f9c8bd96fd61ef`**, tree **`bf2d98e95e406b369a09da85049ac552e46c787b`**, sole parent **`6535ee86ee907951938118a201f247702ea1304e`**. Only `tests/imm-receipt-identity.test.js` changes: promisified `execFile`, async `loadReport`, and five awaited call sites; no assertion changes. Git arguments, cwd, UTF-8 decoding and rejection on failed retrieval remain intact. The genuine pinned `269982d2d8a7148af40f5640c901348095a05b5c:TornScripture-IMM-Trader-Report.user.js` remains 41,079 bytes, SHA-256 `bfdbab622ddfd77fab841d10e0bff9ada1b6e37b5b81d3d3a71117b44ca8cec0`. The corrected focused baseline is **82/82**; corrected full baseline **1479/1479**, at the original **15000 ms** timeout. No timeout exception, fixture cache, fallback or exclusion was introduced. Verified blob/tree/commit readback preceded the expected-head, non-force branch update.

HEV implementation starts from that test-only commit. Its product source is byte-identical to the original candidate. Before product editing, actual production Export, initialized queue start/launch, independent provider scan/parser/bridge, and Torn document-start return reproduced the published contradictory TornExchange-provider/Weav3r-source witness: **500→1000**, **7→8**, old expired proof erased and `ok:true/captured/count:1`. Complete before/after synthetic storage and notices were retained. The final 202-case equivalent matrix against exact original product source is **112 PASS / 90 FAIL**, including raw overflow-export preservation. No original independent assertion was weakened.

### One semantic model, separate liveness

- `captureEnvelope` is now the canonical pure issuance-integrity predicate shared by live and historical use. It requires exact uncoerced recognized fields, supported intent, positive integral Torn identity, recognized canonical provider/source and numeric Weav3r route ownership. It reuses `captureSource` and the existing 60-second/15-minute span rules, adding `issuedAt < deadline <= expiresAt`. Unknown envelope formats reject. It **does not compare historical clocks with today or a historical run with the current queue**. `captureCurrentAttemptEnvelope` retains the separate queue/current-attempt/liveness rules.
- New `captureTraderProofOwner` shares unique stable ownership and consistent independent Torn IDs between live admission and persisted proof. `validateTraderCaptureEvidence` retains global replay-triplet uniqueness, including expired receipts; rejects wrong/unknown replay and terminal shapes; binds each terminal to its exact recorded replay and owner, resolving stable IDs before manual `torn:<id>` aliases. Existing recordId→uuid→string-ID precedence and supported legacy record identity parsing remain. No Torn identity is inferred from a TornExchange slug.
- H0 legacy absence/null terminal stays compatible. H1 replay-only evidence remains consumed partial proof, not completion. H2 complete proof, including genuinely expired proof and supported negative/local outcomes, remains valid history. H3 malformed/contradictory/unsupported proof blocks unsafe writes and remains preserved. No schema, migration, storage key or replacement proof is introduced.
- `normalizeTrader` preserves raw provider proof instead of coercing/stripping it. `normalizeTraders` retains evidence-bearing duplicate rows for validation. `copyTradersJson` preserves original JSON text, including unsupported overflowing numeric literals such as `1e400`, while retaining the existing array-export wrapper/schema. Wrapper metadata is preserved. Unparseable/container-invalid storage still requires preserving the literal storage value separately.
- `saveTraderPriceCapture` validates the whole fresh book before direct/receipt composition or completed-arm cleanup. `captureTerminalReceipt` and `continueFavoriteCaptureCarousel` reject unauthenticated completion/recovery across the whole book. The single book sink, snapshot/readback/rollback, exclusive transition, A/B issuance budgets, independent page proof, parser and matching Report source remain in place.

### Complete current writer map

Repository key/call audit and AST inventory find exactly **four direct callers of the existing `writeCaptureTraders` sink**, with its sole commit and rollback storage writes. No additional sink was discovered. Each caller freshly reads raw book/queue/pending under the existing native exclusive transition; old proof is validated before lossy composition, the proposed full book is validated under the same model, and exact snapshots/grant are checked immediately before persistence. Critical bodies remain synchronous.

| Paths | Admission/composition and executable evidence |
|---|---|
| A: provider direct/public/ordinary/document-start and initialized round trip | `persistCaptureImport` already checks the entire old book before expiry pruning/terminal replacement; the stronger shared model now rejects semantic H3. Both positive/unavailable returns, current/unrelated traders, raw Export and exact bytes/count/queue/pending/neighbor preservation are exercised. Healthy expired proof prunes only after validation. |
| B: manual provider confirmation and direct price writer | Provider results delegate to A; direct price saves validate before transformation. Manual confirmation remains independent. Healthy/declined confirmation and bad-history controls run. |
| C: receipt new capture, completed recovery, duplicate/rearm/partial states | `saveTraderPriceCapture` now validates before marker recovery/pruning or pending cleanup. H3 cannot claim already-captured or consume the arm. Existing strong-arm/retention/readback/cleanup behavior remains covered. The deliberately separate Ledger counterparty metadata/timestamp link remains its established R8 exception; lots, allocations, cash, profit, sale/audit identities and seven neighbors remain exact. |
| D/E: metadata/profile/rating/roles/classification/hide/restore/add/delete/cache and JSON upsert | `saveTraders` checks authoritative raw history before merging requested metadata and checks the proposed union. JSON validates incoming raw proof before normalization/upsert, preserving valid-prefix semantics. Current/other/incoming H3 and actual event writers are challenged; stale-cache protection remains covered. |
| F: matching Report move/disconnect/verified Undo | `saveTraderBookSnapshot` validates fresh old/proposed books under the core grant. Report transforms only a local copy; proof stays on its owner. Rejected actions write no backup/reload; healthy actions and exact `expectedAfter`/later-observation guards pass. Report source is unchanged. |
| G: Retry/Skip/Cancel/finish/restart/expiry/continuations | Book writes delegate to A. Completed-capture claims require whole-book-valid linked proof. Explicit Retry retains A/B limits; explicit Cancel preserves H3 and reports no capture. Established queue-only Skip for an already-consumed partial/inconsistent attempt remains available, preserving book bytes and recording only `user_skipped`; Skip requiring a new unsafe terminal write rejects. N1–N5 and new controls exercise this distinction. |

### Acceptance evidence and limitations

New `tests/imm-historical-evidence.test.js` contains **202** production-path cases: provider/source/canonical URL/ownership/timing/shape/outcome/format challenges; current, unrelated and imported history; terminal/replay/alias contradictions; manual/direct/receipt/metadata/JSON/Report/control surfaces; initialized round trips; native-lock fresh reread; H0/H1/H2 compatibility, genuine expired pruning, retained unexpired proof, exactly-once and raw overflow Export. Rejections compare raw stored values and attempted writes, real nonempty synthetic Ledger/allocations/audit plus neighboring sentinels, authority and truthful results. Receipt tests explicitly preserve only the already-authorized metadata-link delta.

Final maintained acceptance is **1681/1681**, including the 202 new cases; the required full command passes all 17 files at the original 15000 ms timeout. Per-file executions expose every assertion total because this environment's isolated runner displays only file-level summaries; inventory is its existing standalone assertion-file case. Final groups have zero failures, cancellations, skips and TODOs. Original 1479 cases remain, including lifecycle/coordination/N1–N5, import/metadata, receipt/Report, inventory, accounting/API recovery and Training.

Published fixtures recovered without changing their assertions: canonical G1–G4 **18/18** (SHA-256 `8b6fb499f4a12b5cf2120afa4c230264f6e215aef2d98ce941a561b5c6d22687`), original Q-M1 **1/1** (`5740f3899daad10b6beecce14fae31732a757ec725a8ace2b8d9086ae089cc11`), original initialized V1 witness **1/1** (`54fb343e27fe59df03bf9bb3dea88749e915e2f1d71dac7b2f3e64d858307308`), original Q1–Q4 **4/4**, and established receipt/Report including A1–A3 **51/51**. The external receipt host received exactly the dependency corrections explicitly published in Q comment 6185316250 (native Web Crypto, awaited click callbacks and initial arm); assertion files remain unchanged. Its initial unadapted dependency failure is retained in logs. Genuine historical Report source comes from a detached exact Git worktree. One 51-case test characterizes unsafe historical Report behavior, not the matching companion.

The original external **34-case V1-ME-01**, **55-case Q** and **45-case established Q-M1** bundles were not available in this workspace or the published code fences. No unchanged pass is claimed for them. Their documented production-path witnesses are covered by the 202 new cases and maintained 68-case provider/47-case import suites, alongside the recovered original minimal/G/Q/receipt assertions. This is author evidence, **not independent acceptance**.

All **21 protected declarations and bodies** are AST-extracted and byte-identical to approved base, original candidate and test-only starting commit. The receipt-link handler is also unchanged by HEV. IMM retains **25 listeners / 35 timeout sites / 1 interval / 5 MutationObservers / 6 fetch calls**; Report source is byte-identical. No accounting, endpoint, permission, key/schema, release metadata, coordinator, lock, timer, observer or gameplay change is introduced. Complete amendment/base diffs, syntax/object integrity, source parity and exact final commit/tree/sole-parent evidence accompany the consolidated PR author comment.

Commands (checkout `/workspace/TornScripture`; external evidence under `/workspace/hev-evidence`):

```bash
node --test --test-reporter=tap --test-timeout=15000 tests/imm-receipt-identity.test.js
node --test --test-reporter=tap --test-timeout=15000 tests/*.test.js
node --test-reporter=tap --test-timeout=15000 tests/imm-historical-evidence.test.js
# Assertion-level reporting: execute each maintained file with these flags, without --test.
node --test-reporter=tap --test-timeout=15000 tests/<each-file>.test.js
TSIMM_TEST_SCRIPT="$PWD/TornScripture-Item-Market-Margin.user.js" node --test --test-reporter=tap --test-timeout=15000 /workspace/hev-evidence/external/{gaps,minimal-import-collision,receipt-contract,adversarial}.test.cjs
TSIMM_REVIEW_REPO="$PWD" TSIMM_TEST_SCRIPT="$PWD/TornScripture-Item-Market-Margin.user.js" node --test-reporter=tap --test-timeout=15000 /workspace/hev-evidence/original-minimal-v1.test.cjs
node /workspace/hev-evidence/audit-hev.cjs
git ls-files -z '*.js' '*.cjs' | xargs -0 -n1 node --check
git diff --check
git diff --cached --check
git diff --check c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475 HEAD
git fsck --full
```

### Recovery and remaining owner gates

On H3 rejection, stop capture, preserve/export the current raw Trader Book, Ledger and Report backup, and review the contradictory evidence. Do not delete, normalize, expire away or replace proof to force acceptance. A failed write preserves existing rollback/readback/indeterminate semantics; indeterminate storage requires readable reconciliation before retry. User controls retain their established safe queue-only behavior; no automatic repair/migration is supplied.

Before any separately authorized desktop/TornPDA testing, preserve those raw exports, installed source hashes and baseline Ledger Integrity. Use one exact reviewed IMM/Report pair or disable Report; close/reload older tabs. Live provider transport/identity, manual confirmation, early/ordinary diagnostics, actual clipboard export, A/B/lifecycle/BFCache/process-kill, stale/duplicate/partial recovery and Report operations remain manual gates. Require unchanged accounting exports and **Ledger Integrity PASS**. Node VM fixtures/native Node locks do not establish live browser acceptance.

Any owner-chosen rollback must first preserve newer raw history and cancel/export in-flight authority. The immediate HEV parent `602396de...` contains the known semantic-history defect; reinstalling it is not an automatic recovery and capture must stay disabled with H3. Never restore a stale backup over newer data. Stable downgrade requires separate owner control, exporting/canceling v4 queues/pending authority and disabling the draft pair; no data/accounting reset is authorized.

After the correction commit and consolidated author evidence are published, **STOP**. PR #139 stays OPEN/DRAFT/UNMERGED. Fresh independent Q, full V1, owner V2/Ledger Integrity, Issue #142 integration verification and explicit merge/release remain separate gates; none is initiated by this assignment.

## Bounded V1-ME-01 provider evidence correction (2026-10-20 UTC)

Authority: [owner-frozen ME-F1–ME-F5](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6284966843) and [independent full V1 blocker](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6283855469), followed by the owner's separate `[B][WORK]` implementation assignment. Starting head `e9d46125566136ca35224af186a33b5a5f153d7d`, tree `02e20c88ffa3cbf8217feb95a202847928ff657d`, sole parent `b891b6f4a2c7782a111f55c5da9a2060a754f2b5`; approved main/base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Live PR/ref/commit checks matched these pins. The complete non-shallow checkout was clean before edits. IMM **0.19.39** and Report **0.2.3** remain drafts; stable/tester **0.19.37** is untouched.

### Reproduction and correction boundary

Before editing, all **1411/1411** maintained tests passed. The original independent 34-case fixture was available and copied byte-identically (SHA-256 `c581f672f4f8e319b0a7158ef175210bb106d2443b2096a9f09396d5f004c622`): **26/34 PASS, eight failures**. Its separate minimal initialized round-trip fixture (SHA-256 `54fb343e27fe59df03bf9bb3dea88749e915e2f1d71dac7b2f3e64d858307308`) failed **0/1**. The actual Export action first retained the unreadable historical receipt. A fully initialized provider scan and document-start Torn return then erased it, changed price **500→1000** and count **7→8**, and reported `ok:true`, `outcome:captured`, `count:1`. Null replay and inconsistent terminal evidence reproduced the same admission gap. Production validators, parser, authority, lock and writer decisions were not substituted.

The product correction changes only two existing functions:

- `persistCaptureImport` validates the full freshly reread authoritative book with existing `validateTraderCaptureEvidence` inside the current exclusive transition, before authority admission, receipt pruning, terminal replacement or observation composition. Rejected history remains stored unchanged and returns the validator's preserve/export/review diagnostic.
- `writeCaptureTraders` upgrades its existing old/proposed receipt-link checks to that same validator, which includes receipt-link checks and provider replay/terminal checks. The complete proposed book must pass before snapshot recheck, mutation and readback. This separately blocks a new provider receipt colliding with another trader's otherwise valid historical proof, including expired ownership.

No validator, provider parser/identity rule, queue control, coordination design or Report source is changed. The existing snapshot/readback/rollback and indeterminate-storage reporting remain in place. Both checks are necessary: a proposed-book check alone would accept history already erased during composition; an existing-book check alone would permit a collision introduced by the new observation.

### Executed author acceptance

The unchanged independent suite now passes **34/34**, and its separate minimal round trip **1/1**. New maintained `tests/imm-provider-evidence.test.js` adds **68** cases: unreadable/null/nonfinite/coerced/zero expiry, missing/invalid replay identities, null/wrong-shaped replay fields, duplicates, inconsistent terminals, corruption on another trader, positive/unavailable returns, public wrapper/ordinary/document-start imports, full initialized round trips, whole-proposed-book foreign ownership, fresh reread after waiting for the native grant, manual confirmation, pending retention, raw Export, direct price writer, valid expiry pruning, legacy absence, partial replay and receipt-link markers, exactly-once behavior and explicit recovery. Rejected attempts compare all raw persistent bytes, including queue, pending authority, complete nonempty Ledger, Report backup/settings and seven adjacent stores. Valid pruning has its own passing commit-boundary controls.

Complete maintained suite: **1479/1479 PASS**, 21 suites, including the new 68. Unchanged historical author reruns: canonical G1–G4 **18/18**; original Q-M1 **1/1**; established Q-M1 **45/45**; original receipt Q1–Q4 **4/4**; established receipt/Report including A1–A3 **51/51** (one case characterizes the unsafe historical companion, not the matching current Report). The latter groups were executed together: **119/119**. Existing N1–N5, lifecycle/coordination, accounting/API recovery, inventory and Training regressions are included in the complete suite. Counts overlap and are not additive. Final acceptance groups have zero failures, skips, cancellations or TODOs. These are implementation-author reruns, not independent Q/V1 verdicts.

Commands from the checkout, with external fixtures in sibling `evidence/`:

```bash
node --test --test-reporter=tap --test-timeout=15000 tests/*.test.js
TSIMM_REVIEW_REPO="$PWD" node --test --test-reporter=tap --test-timeout=15000 ../evidence/fresh-v1.test.cjs ../evidence/minimal-v1-malformed-proof.test.cjs
TSIMM_TEST_SCRIPT="$PWD/TornScripture-Item-Market-Margin.user.js" node --test --test-reporter=tap --test-timeout=15000 ../evidence/original-gaps-canonical.test.cjs ../evidence/minimal-import-collision.test.cjs ../evidence/established-qm1.test.cjs ../evidence/receipt-independent/receipt-contract.test.cjs ../evidence/receipt-independent/adversarial.test.cjs
git ls-files -z '*.js' '*.cjs' | xargs -0 -n1 node --check
git diff --check
git diff --cached --check
git diff --check c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475 HEAD
git fsck --full
```

All **30** tracked JS/CJS paths pass syntax checks. Acorn AST extraction confirms all **21 protected full declarations and bodies** match both the approved base and starting head; only the two functions above change in IMM, with no added/removed named functions. Matching Report and the previously permitted receipt-link handler are unchanged by this amendment. Full diff, hashes, exact resulting head/tree/parent and published parity are recorded in the consolidated `[B]` PR evidence comment. Publication uses connected GitHub Git objects and an expected-head non-force branch update because native Git push has no credentials.

### Recovery, effects and remaining manual gates

A rejected capture does not change Trader Book bytes, prices, counts, clocks, terminal evidence, queue position/budget, pending arm or unrelated stores. Early URL cleanup retains a truthful session rejection notice; ordinary imports show the diagnostic and do not continue the queue. Raw Export remains available for the documented malformed historical JSON records. If JSON/container storage is unreadable, or exact original textual bytes are needed, preserve the literal storage value separately rather than replacing it with a normalized export. Do not delete a malformed receipt to force capture acceptance.

Explicit Retry remains within the original two-attempt budget. Skip refuses a terminal write while the historical book is malformed, preserves authority and explains export/recovery; explicit Cancel can still end the run without rewriting that history or claiming a capture. Export/review the evidence before deliberate recovery. Existing unsupported-legacy and partial receipt-link recovery behavior remains covered by the maintained suite. No automatic repair or migration is introduced.

Before any separately authorized owner desktop/TornPDA test, preserve raw Trader Book, Ledger and Report-backup exports plus installed source hashes; use exactly the reviewed IMM/Report pair or disable Report, and close/reload older cooperating tabs. Verify visible early/ordinary rejection and cleanup notices, manual confirmation, malformed-book Export, lost-return Retry/Skip/Cancel, valid expired pruning, one healthy capture and duplicate return, positive/unavailable outcomes, actual provider transport and matching Report operations. Require unchanged no-accounting Ledger exports and Ledger Integrity PASS. Node VM DOM/storage/timer/clipboard/navigation fixtures and native Node locks do not establish real Android/browser, BFCache, process-kill or provider-markup acceptance.

Rollback of this amendment means reinstalling exact feature head `e9d46125566136ca35224af186a33b5a5f153d7d` only after preserving current raw evidence and canceling/exporting in-flight authority. That older feature head contains this known defect; disable capture if malformed history exists. Do not restore stale backups over newer stored history. For a separately chosen stable downgrade, preserve all raw data, cancel/export v4 queues and pending authority, disable the draft pair and follow the stable **0.19.37** instructions below; do not resume v4 queues under v3 or apply an old Report Undo. No accounting reset is part of rollback.

This amendment changes no top-level storage key, schema, endpoint, credential, version/release metadata, listener, timer, observer, lock, gameplay action or accounting behavior. PR #139 remains **OPEN / DRAFT / UNMERGED**. Stop after author implementation publication. Fresh independent focused **[Q]**, separately authorized full **[V1]**, owner **[V2]** plus Ledger Integrity and exact-head review, and explicit merge/release authorization remain separate gates.

## Bounded Q-M1 import admission correction (2026-10-20 UTC)

Authority: [frozen Q-M1 specification](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6271271680), [owner implementation authorization](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6275542648), and [independent blocker with original production fixture](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6254602280). Starting head `b891b6f4a2c7782a111f55c5da9a2060a754f2b5`, tree `19b3afb0e0be61906219531e2886f0e311aa5d01`, sole parent `7c68a0df7dea29cff928314d9766ab9dfa0ab005`; approved main/base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Existing PR #139 and its branch only; IMM **0.19.39**, matching Report **0.2.3**, released IMM **0.19.37** unchanged.

The clean, full, non-shallow local clone exactly matched all **217** published starting blobs. Fresh GitHub PR/ref/tree checks matched every immutable pin. Node v24.19.0 executes the complete production userscript with native Node Web Locks. The unchanged published Q-M1 fixture (SHA-256 `5740f3899daad10b6beecce14fae31732a757ec725a8ace2b8d9086ae089cc11`) failed before edits: import persisted another trader's replay identity and reported success. The original maintained baseline passed **1364/1364**. Native Git push lacks credentials; publication uses connected GitHub Git objects and an expected-head, non-force update of the existing branch, with exact local/published tree verification.

### Minimal existing-writer enforcement

`saveTraders()` already rereads authoritative storage inside the existing exclusive capture transition, validates the old book, and composes the proposed rows. It now calls existing `validateTraderCaptureEvidence(traders)` on that complete proposed book immediately before `writeCaptureTraders()`. This is one validator call plus its explanatory comment. Individually valid imports cannot acquire another row's provider run/entry/attempt identity, even after receipt expiry. Malformed or conflicting evidence is preserved and rejected before any offending-row write or success feedback.

Every ordinary JSON import/upsert reaches this boundary; existing-record edits preserve authoritative capture fields and new-record additions validate the combined book. Companion snapshot operations already validate their whole proposed records. The shared provider/receipt writer, provider authority decision, normalization, queue protocol and lock are byte-identical to the starting source. This correction adds no schema, key, migration, coordinator, endpoint, listener, timer, observer, permission, accounting or gameplay change. The matching Report script is unchanged.

### Author validation

New `tests/imm-import-replay.test.js` runs **47** production-event cases: fresh/expired collisions against either existing owner, aliases, inconsistent/null/duplicate proof, distinct legitimate proof and terminal envelopes, marked/unmarked legacy imports and wrappers, unknown fields, historical-unverified prices, all six provider outcomes, both native import/provider lock orders for positive/unavailable observations, active queues, fresh authoritative reread, changed prewrite snapshots, missing/null/denied/interrupted locks, set/readback/rollback faults and deliberate recovery, malformed raw-book export, ordinary add/edit upserts, and matching Report disconnect/safe Undo after rejection. Every witness compares complete Ledger bytes plus seven adjacent sentinels.

Final executed results: **1411/1411** complete maintained tests (including the new 47), original unchanged Q-M1 **1/1**, original unchanged V1-G1–G4 **18/18**, original receipt Q1–Q4 **4/4**, established external receipt/companion suite **51/51** (50 acceptance cases plus one historical unsafe-Report characterization), and **33/33** remaining prior external metadata/Undo cases. The old full-suite Q-M1 case describes the broken follow-up behavior, so that single case is explicitly excluded from the 33-case replay; the unchanged original Q-M1 acceptance fixture and new corrected follow-up tests cover it. These are author reruns, not a fresh independent Q. Final groups have zero failures/cancellations/skips/todos; overlapping counts are not additive. All tracked JS/CJS syntax checks, whitespace/object-integrity checks and **21/21** frozen protected-body comparisons to approved base pass. Exact source/tree/parent, file hashes, command exits and publication readback appear in the consolidated author report.

One new batch fixture initially assumed caller order, but existing `normalizeTraders()` sorts incoming rows. Its names were corrected to exercise a genuinely later colliding row; no original assertion or maintained test was weakened. Existing valid-prefix persistence remains possible if a later row fails, with no offending row or full-success toast. Whole-batch atomicity remains outside the frozen scope. Indeterminate storage failure can leave a legitimate row committed; feedback requires review and deliberate retry, never automatic cleanup or proof deletion.

### Remaining manual gate and rollback

Before any separately authorized live testing, export raw Trader Book, Ledger and Report backup; use only this exact IMM/Report pair or disable Report. In Torn's Trader Book on desktop and TornPDA, import a distinct historical trader, then a one-row foreign-proof collision before and after expiry: the legitimate import stays historical, the collision shows failure, and raw book/Ledger bytes remain exact. Add a note afterward; after protected retention, disconnect and safe Undo must work without proof moving between traders. Reload and compare exports; require Ledger Integrity PASS. Synthetic VM/native-lock tests do not establish browser, provider transport, BFCache or process-kill acceptance.

For this two-line correction, revert its commit on this same feature branch to restore the exact starting code; retain exports and do not erase proof. For runtime downgrade, follow the existing queue/pending-authority export/cancel instructions below, disable both review scripts, and return to stable **0.19.37** without resetting accounting/history or applying old Report Undo over newer data. No new migration requires reversal.

PR #139 remains **DRAFT / UNMERGED** and main unchanged. Stop after author publication. Fresh independent targeted Q, full V1, owner V2 and merge/release each require their own subsequent authorization.

## Bounded V1-01/V1-02 and provider-only Undo correction (2026-10-18)

Authority: [owner-frozen correctness amendment](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6252193836), the owner's exact-pinned B assignment, [independent full V1 failures and original fixtures](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6251472357), and [preceding targeted Q](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6185316250). Starting head `7c68a0df7dea29cff928314d9766ab9dfa0ab005`, tree `3ec58a3af3a6d31753467a8cc3254d2589a999ff`, approved main/base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Same existing branch and draft PR #139. IMM remains unreleased **0.19.39**, Report **0.2.3**; stable/tester **0.19.37** and global update metadata are unchanged.

The exact original external fixture was retrieved from the published V1 comment and reproduced **14/18 PASS, four FAIL** before edits. Its unchanged assertions now pass **18/18**. Full production Report Undo independently restored an older marker-free book after both a newer provider success and an explicit-unavailable observation on the starting source; those two characterization passes assert the unsafe starting behavior, not candidate acceptance.

### Existing writer and metadata intent

`saveTraders` now binds the requested record and deliberate metadata fields before waiting, rereads the raw book under the existing native capture lock, and changes only that record's selected metadata. Current provider snapshots, successful/attempt clocks, terminal state/reasons/counts, source/legacy aliases and both replay-proof domains remain authoritative regardless of receipt-link markers. Unrelated rows added by other tabs are preserved. Journal notes merge by existing note identity; stale notes do not overwrite unrelated roles or notes. Existing aliases are not rewritten. Removed/replaced/ambiguous identities fail closed instead of silently recreating or retargeting a record.

Upsert/import distinguishes stable IDs and known Torn IDs from display names, so different known IDs sharing a name do not merge. Incoming capture proof is validated raw before import normalization. A new imported trader, or historical rows imported into a genuinely bare existing record, is labeled `imported_unverified`, not a newly verified provider success. Existing observations and proof are preserved. A new proof-bearing record cannot be imported into an active carousel. Normal notes, ratings, roles, classifications, hide/restore, profile metadata and safe imports remain available. Raw export remains available for corrupt evidence.

Provider replay and terminal evidence is validated before these management writes; malformed/colliding proof is preserved and blocks the write. The provider authority decision, parser, queue protocol and receipt writer are not replaced. The established raw writer returns its already verified serialized bytes to the constrained companion adapter; it adds no second persistence mechanism.

### Matching companion operations and Undo

The core snapshot adapter accepts reviewed move/disconnect/Undo intent, exact current-book bytes, unambiguous trader identities and valid proof. Live provider replay receipts now protect price/count fields as retained receipt-link markers already did. Even expired historical provider proof stays with its original trader during deliberate transformations. Moved prices are `reassigned_unverified`; disconnected prices are historical/disconnected. No source run/entry/attempt authority is copied to a target trader.

After a verified move/disconnect, Report saves the existing backup's original `root`/`shape` plus optional **`expectedAfter`**, the exact serialized post-operation book returned inside the core grant. No new top-level key or backup migration is added. Undo must match that postimage under the same native lock, in addition to the ordinary acquisition snapshot check. Any intervening capture or book change refuses the stale restore without book mutation, backup removal, success or reload. A legitimate Undo with no intervening change still restores the reviewed record data and preserves wrapper metadata.

Legacy root-only backups remain readable and retained, but lack proof of the state following their operation; automatic Undo is refused with export/review guidance. This is the frozen fail-closed compatibility policy, not a destructive migration. A failed backup write after a verified operation accurately reports that the change saved but Undo is unverified. Undo write/readback failure preserves its backup and does not reload. Older noncooperating IMM/Report copies remain unsafe; matching source bytes, not identical version labels, are required.

### Freshness and evidence

`traderCaptureFresh` accepts finite age from zero through exactly 72 hours. Future observations, invalid/missing dates and 72h+1ms are not fresh; future quotes remain historical and excluded from current recommendations. Other timeout/request/queue/summary/retention periods are unchanged. The separate seven-day invalid-summary-clock characterization is outside this amendment.

New maintained `tests/imm-capture-metadata.test.js` runs whole production files and actual event handlers with synthetic DOM/storage/clocks and native Node Web Locks. Its 54 cases cover metadata/positive and negative observations, early return/replay, both lock orders, aliases/wrappers, import/identity and journal compatibility, current/future/72h boundaries, provider-only Undo before/after retention expiry, legitimate Undo, deliberate move/disconnect, raw corruption/export and persistence/rollback/backup faults. Existing 113 receipt-link/identity cases remain unchanged and pass. Full suite, exact final head/tree, hashes, syntax/diff/protected-body receipts and test totals are published in the consolidated author evidence comment; development assertions are not independent Q or V1.

### Gates and rollback

No protected accounting function, FIFO/lot/sale/cash/profit path, receipt audit, credential, provider identity/parser, A/B queue authority, listener/timer/observer, endpoint or release version is changed. The other 21 protected bodies remain byte-identical to approved base. Tests preserve complete Ledger and seven neighboring storage sentinels; only the previously authorized receipt metadata exception applies to existing receipt tests.

Before separately authorized live acceptance, export raw Trader Book, Ledger and the existing Report backup; disable older copies. Test stale ordinary edits around successful/failed provider returns and real Undo refusal, legitimate Undo, manual captures, receipt reconciliation and Ledger Integrity on TornPDA and desktop. These Node tests do not establish browser transport, document-start, clipboard/touch, BFCache or process-loss behavior.

Rollback is data-preserving: retain exports, cancel/export v4 queues and clear/export candidate pending authority while reviewed controls work, disable both reviewed scripts, then return to stable IMM 0.19.37 and baseline Report. Do not resume v4 queues under v3, reuse candidate arms, restore stale backups over newer evidence, or reset accounting/history. If storage is unreadable, keep captures disabled for explicit recovery. The optional `expectedAfter` backup field is ignored by old Report, whose Undo is not safe against newer capture state; do not use old Undo on candidate-era data.

After publishing this bounded correction, **STOP**. Fresh independent targeted Q on the new exact head is the next gate; repeat full V1, owner TornPDA/desktop V2 plus Ledger Integrity, and merge/release each require their later authorization. No tester upgrade or infrastructure spending occurs.

Status: the owner-authorized durable receipt-link identity/completion correction below supersedes the older author-side receipt correction. Independent Q remains BLOCKED on the starting candidate; no fresh independent Q or full V1 is claimed or initiated by this implementation. PR #139 remains a draft, not a release. Exact publication head/tree are recorded in the PR evidence comment rather than self-referentially here.

## Durable receipt identity and completion correction (2026-10-15 UTC)

Authority: [final owner-approved frozen contract 6161688824](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6161688824), [expanded-scope approval and source review 6161619508](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6161619508), and the owner's exact-pinned `[B][WORK]` implementation assignment. Evidence: [fresh independent Q-A1/A2/A3 blockers](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6158135763), [original Q and complete production-event fixtures](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6115230919), [previous author report](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6118762138).

Repository `KingAeon/TornScripture`; same branch `agent/bl-r01b-v22-trader-refresh-implementation` and existing draft PR #139. Starting head `269982d2d8a7148af40f5640c901348095a05b5c`, tree `fbbb886768d97c55bc60f82350ff1eead7f82e63`, immediate parent `2463e0cbcc42cebb9117daacd3c0d8791c388921`. Approved main/base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Candidate remains IMM **0.19.39**; stable **0.19.37** and global update metadata are untouched.

### Preflight and root cause

Full AGENTS/Divine Knowledge/governance/bootstrap and canonical contract/evidence refresh preceded product edits. NOW's October 5 snapshot was treated as stale. Fresh clean full non-shallow clone, exact main/head/tree/parent and OPEN/DRAFT/UNMERGED PR state matched; Git 2.51.1, Node v24.19.0, native Node Web Locks, complete diff inspection and individual tracked JS/CJS syntax checks were available. Native push lacks credentials; the connected GitHub expected-SHA non-force update of the existing branch to its same head succeeded before edits, proving isolated publication without moving it.

Fresh starting-source results: full maintained **1,228/1,228**, original unchanged Q acceptance **4/4**, independently published minimal Q-A blockers **0/3 PASS, 3 FAIL**; exits 0/0/1 respectively. All had zero cancellations/skips/todos. Starting syntax **26/26**. The three blockers match the report: different arms could serialize identically; cleanup exceptions escaped after a verified save; and no durable completed-arm identity prevented another caller from writing again. Accounting sentinels remained exact apart from the deliberate original sale counterparty metadata and Ledger timestamp.

### One completion boundary, existing storage and lock

- Every deliberate arm generates a fresh ID once using 16 cryptographically random bytes (128 bits), or supported `crypto.randomUUID()` when `getRandomValues` is absent. No timestamp/Math.random/createId fallback. Missing, throwing or malformed crypto results fail closed. Arming writes/readbacks under the existing exclusive lock before reporting success. Timestamps are safe integer epoch milliseconds, never synthesized on read, and expire within the unchanged one-hour window.
- The existing pending key adds optional `armId`. Generated 128-bit IDs are 32 lowercase hex digits; UUID fallback is strict lowercase UUID v4. Normalization preserves identity and clocks exactly. Legacy records without the field remain stored/readable, are never auto-upgraded/deleted, and require deliberate rearming for receipt-link pricing. Passive expiry inspection performs no durable cleanup.
- The existing Trader Book trader adds optional `receiptLinkCompletions`. Canonical fields are `{armId, saleId, capturedAt, armExpiresAt, retainUntil, parsedCount, sourceType:'receipt-audit'}`; all three clocks are positive safe integer epoch milliseconds, count is a positive safe integer, sale ID is a trimmed bounded string. No raw receipt text or extra fields enter markers. Missing field means empty evidence. Malformed lists/entries, conflicting/colliding arm IDs or unreadable storage fail closed rather than being normalized away.
- Under `tornscripture-imm-capture-transition-v1`, receipt save rereads actual pending/book state, reconciles an existing completed arm before any replay write, and validates current original arm/trader/expiry before a new capture. Positive prices, updated snapshot, capture-count increment and marker enter **one serialized Trader Book write with exact readback**. Arm ID is the replay identity even when a caller selects another sale. There is no separate marker write, key, lock, lease, CAS or coordinator.
- Completion retention ends no earlier than `armExpiresAt + 86,400,000ms`. Entries with `retainUntil >= now` remain protected; prune only when `retainUntil < now`, under the same coordinated verified write. At most 64 entries per trader; saturation refuses capture with wait/export guidance. Normalization never prunes. Protected trader deletion is refused with Hide/wait guidance; deletion after retention remains available.
- Arm/clear order is verified mutation under the granted lock, not tap time. A rearm/clear committed ahead of an old receipt invalidates it; one committed after capture survives. A queued clear targets its observed bytes. Receipt finalization additionally matches the original arm ID, so a replacement between UI read and raw snapshot cannot be consumed. Expiry cleanup likewise binds the original arm ID and bytes.
- Once price/marker readback succeeds, cleanup is separate best-effort finalization. Pending remove exceptions are caught inside the grant and reconciled by rereading raw storage, including exceptions after mutation. Local pending state is not nulled before confirmed removal/reconciliation. Feedback distinguishes captured with actual count, already captured/no new write, captured/cleanup unresolved or unknown, not captured, and outcome indeterminate. A failed readback/rollback that cannot establish original bytes is indeterminate; no automatic retry occurs. A later deliberate action must first reconcile readable authoritative completion evidence.
- Ledger counterparty name/ID/profile plus timestamp remain the deliberate independent metadata link. No accounting, saved receipt-audit, lot, sale identity, quantity, cash, cost or profit mutation is added. Zero-price direct-check count/history semantics remain historical behavior, with no successful-price claim or completion marker.

### Every actual writer and compatibility surface

All current repository Trader Book writes converge on `writeCaptureTraders` (already used by early/ordinary/provider/manual capture), including coordinated `saveTraders` and the companion adapter described below. `saveTraders` snapshots requested edits, rereads the actual book under the existing lock, unions protected completion evidence and preserves its latest price/counter/history/provider-receipt fields before writing. Every writer validates that no live marker or its owner disappears. This is focused field preservation, not a replacement Trader Book architecture or general conflict-resolution system; unrelated concurrent user edits retain historical last-writer semantics.

`normalizeTrader` retains unknown fields and completion evidence, including malformed evidence for fail-closed validation. `normalizeTraders` keeps evidence-bearing duplicate rows individually so historical display dedupe cannot erase markers. Import validates raw records before normalization. Array and existing `{traders:[]}` wrapper shapes, wrapper metadata, raw stable identity aliases and unknown trader fields survive actual stored updates. Export rereads the raw book instead of a cached normalized snapshot and can back up malformed evidence even when pending/queue authority is corrupt. Imports merge trader records using the existing identity policy; they do not replace existing wrapper metadata with metadata from a different export.

Creation, profile capture/arming, upsert, editing, avoid/hide/restore/delete, relationship roles/journal and JSON import now await the coordinated save before success feedback or the existing sale-link continuation. `linkRecordedSalesToTrader` itself is unchanged. Receipt UI displays legacy-rearm and completed/cleanup guidance, retains rejected unpreviewed text for explicit close/reopen, scopes late completion to its original draft, and refreshes current surrounding panels without redrawing a newer receipt.

Provider capture parsing, authority, replay receipts and queue/A/B behavior are unchanged. Their existing raw writers preserve the new field. A provider manual envelope does not contain `armId`, so it cannot safely consume a newer strong pending arm just because trader/timestamp match: strong arms stay available for deliberate Clear/rearm; safe legacy cleanup remains coordinated. Direct Torn-page/manual consumers bind original pending bytes, preserve failed/zero-price recovery and refuse reuse of a receipt-completed arm. Independent provider-envelope captures remain independent captures and retain their original replay rules.

### Companion writer found by repository-wide audit

The initial core-only inventory missed `TornScripture-IMM-Trader-Report.user.js`. The repository-wide search caught its `saveRawTraderRecords` and direct `undoLastLinkChange` writes before publication. A full baseline companion-script production-click characterization proves Undo restores a pre-capture book, removes the later completion and resets count 8 -> 7 while a failed-cleanup arm survives. Passing core-only suites would therefore have been insufficient.

The bounded integration reuses existing `captureTransition` and `writeCaptureTraders`, not a second lock/coordinator. New core `saveTraderBookSnapshot(expectedBytes, records)` rereads actual storage under the same grant, rejects a changed snapshot or active queue, validates marker retention, and refuses changing protected price/count fields before retention expiry. The existing watchlist JavaScript API exposes only this constrained snapshot save. Report move/disconnect/Undo await it before reload or success. Missing matching core, denied/null lock, malformed storage, stale snapshot or protected old backup fail closed. Raw wrappers/unknown current wrapper metadata remain intact; Undo restores reviewed record data rather than overwriting current wrapper metadata from an older root. Existing backup/settings keys and ordinary unprotected management remain. Report version markers stay internally consistent at 0.2.3 for this unreleased branch; its main update URLs are untouched.

Changed Report functions: `rawTraderRecords`, `saveRawTraderRecords`, `disconnectActivePricelist`, `moveActivePricelist`, `undoLastLinkChange`, and existing `bindEvents` callback. No general Report UI, pricing formula or storage architecture rewrite. The older `TornScripture-IMM-Trader-Deals.user.js` only reads this book and needs no edit. Repository-wide raw-key/call-path inspection confirms no remaining direct current Report book writer. Close/disable old noncooperating Report copies as well as old IMM tabs before later live testing; use the matching reviewed Report only if that companion is enabled.

### Changed functions and files

The sole changed member of the frozen 22 protected functions is the expressly authorized `linkPendingTraderToReceiptAudit`. The other **21** remain byte-identical to approved base, including `linkRecordedSalesToTrader`, all accounting/recovery/receipt normalization, native MAX, purchase privacy and network-observer bodies. The existing lock, capture authority, provider-persistence and carousel ownership function bodies remain byte-identical to the starting candidate.

Immediately necessary near-protected changes: `writeCaptureTraders`; `normalizeTrader`, `normalizeTraders`, `saveTraders`; `normalizePendingTraderCapture`, `savePendingTraderCapture`, `activePendingTraderCapture`, `traderForPendingCapture`, `clearPendingTraderCapture`, `armTraderForPriceCapture`, `armCurrentProfileTrader`; `saveTraderPriceCapture`, `captureCurrentPricePageForTrader`; `renderReceiptAudit`, `preserveReceiptTraderLinkInput`, `pendingTraderCaptureHtml`; `upsertTrader`, `saveCurrentTrader`, `saveCurrentProfileTrader`, `editTrader`, `setTraderRelationshipRoles`, `addTraderRelationshipJournalEntry`, `markTraderAvoid`, `hideTrader`, `restoreTrader`, `deleteTrader`, `copyTradersJson`, `importTradersJson`; existing `bindPanelEvents` click callback awaits these persistence results. Six identity/evidence/pending/UI helpers plus one constrained companion snapshot adapter are added. The existing watchlist JavaScript API exposes that adapter; it is not a network endpoint, lock or new coordinator. The companion Report integration below is the only other product file change.

| Amendment file | Necessity |
|---|---|
| `TornScripture-Item-Market-Margin.user.js` | Durable identity, atomic completion, narrow all-writer/arm-clear protection and constrained companion snapshot adapter |
| `TornScripture-IMM-Trader-Report.user.js` | Existing move/disconnect/Undo delegate to the core writer/grant; strict raw snapshots, no direct whole-book restore |
| `tests/helpers/imm-capture-harness.cjs` | Native host Web Crypto and awaiting actual async registered click handlers; no production methods replaced |
| `tests/helpers/imm-receipt-harness.cjs` | Wait for verified initial arming before starting a receipt fixture |
| `tests/imm-receipt-link.test.js` | Existing 31 acceptance cases, with committed-order scheduling and one-shot post-save rearm hook |
| `tests/imm-receipt-identity.test.js` | Production-handler adversarial identity/completion/storage/retention/normalization/import/provider cases |
| `docs/BL-R01B-V22-IMPLEMENTATION.md` | Current author evidence, format/recovery/rollback and next-gate record |

No top-level storage key, release/version marker, endpoint, credential, new listener, timer or observer is introduced. Existing core and Report document click callbacks become asynchronous; subscriptions and their counts stay the same. No network call is added. Frozen safety text is unchanged. Casino, Training, War/Inventory HUDs, main, PRs #138/#140 and tester installation are untouched.

### Author validation

Final author runs on the exact product/test bytes subsequently published:

| Check | PASS / total | Fail | Exit | Cancel / skip / todo |
|---|---:|---:|---:|---|
| Original unchanged Q1–Q4 assertion file | 4 / 4 | 0 | 0 | 0 / 0 / 0 |
| Q-A1/A2/A3 contract rerun | 3 / 3 | 0 | 0 | 0 / 0 / 0 |
| Existing receipt suite | 31 / 31 | 0 | 0 | 0 / 0 / 0 |
| New identity/completion/all-writer suite | 82 / 82 | 0 | 0 | 0 / 0 / 0 |
| Capture lifecycle | 46 / 46 | 0 | 0 | 0 / 0 / 0 |
| Capture coordination | 75 / 75 | 0 | 0 | 0 / 0 / 0 |
| N1–N3 | 122 / 122 | 0 | 0 | 0 / 0 / 0 |
| N4–N5 | 554 / 554 | 0 | 0 | 0 / 0 / 0 |
| Protected supported regressions | 400 / 400, 21 suites | 0 | 0 | 0 / 0 / 0 |
| Full supported repository suite | 1310 / 1310, 21 suites | 0 | 0 | 0 / 0 / 0 |
| Individual tracked JS/CJS syntax | 27 / 27 | 0 | all 0 | — |
| Frozen protected bodies vs approved base | 21 / 21 byte-identical | 0 | 0 | — |

Counts overlap. The new 82-case file includes one explicit unsafe baseline-companion characterization; all candidate acceptance cases pass. The independent Q verdict is not changed by these author reruns. Exact commands, TAP footer/hash receipts, complete diff/source checks and final source/tree readback are recorded in the implementation evidence comment on PR #139. Native Node Web Locks coordinate full production-file execution with synthetic DOM/storage/clock/host-fault schedules; this is not a browser or independent Q/V1 pass. Original Q1–Q4 assertion text stays unchanged; its external host fixture receives Web Crypto and awaits initial arming. Q-A1's old equal-byte setup is replaced with strong-ID same-millisecond arms and explicit committed-before-capture ordering; Q-A2/A3 retain their acceptance assertions. Both acquisition orders are tested. Production handlers, parsers, writer and lock methods are not simplified/mocked to claim success.

Development evidence is separate from final validation: the first pre-adaptation receipt run was interrupted because its old after-every-grant rearm hook also rearmed after the newly coordinated arm grant; the hook now runs once. Two retention-fixture failures were a backward clock invalidating the newly armed record and an expected Ledger timestamp not following the deliberately advanced clock. Four added provider fixtures initially selected the receipt's non-provider URL, so no queue existed; their actual receipt input now deliberately supplies the supported provider pricing URL. Consolidated source review added the original-arm-ID cleanup guard and raw-import/duplicate-normalization preservation. No frozen assertion, protected accounting test or provider rule was relaxed.

### Recovery, rollback, distribution and mandatory stop

After publication **STOP**. Do not initiate independent Q or V1. Required sequence: this B publication -> fresh independent targeted Q -> separately owner-authorized full independent V1 -> owner TornPDA/desktop V2 plus Ledger Integrity -> separate merge/release decision. An independent foundational contradiction returns to assistant-first architectural review, not automatic stacked repairs.

Before later owner-authorized live testing, export raw Trader Book and Ledger; preserve installed stable version and Ledger Integrity output. Close/reload all older/noncooperating IMM tabs and use only the explicitly reviewed candidate in cooperating tabs, with the matching reviewed Report companion or that companion disabled. Test same-millisecond cross-tab arm/clear orders, actual captured/already-captured/cleanup-unresolved feedback, storage denial, retention/saturation, edits/import/export, provider handoff, no duplicate count and unchanged accounting. Native browser lock support, real DOM/clipboard/touch, TornPDA Android lifecycle/process kill, userscript managers, provider carriers and live Ledger Integrity remain separate untested acceptance requirements. In-memory receipt recovery does not survive reload/process loss. Native locks coordinate cooperating same-origin versions only; no cross-version or multi-key database atomicity is claimed.

Recovery by outcome: **captured/cleanup unresolved** -> preserve/export, resolve storage, deliberately reconcile the same arm (no price rewrite) or Clear; **indeterminate** -> stop attempts until the actual book/completion state is readable, then reconcile deliberately; **legacy/invalid arm** -> preserve data, resolve corruption if present, deliberately re-arm without renewing the old record; **saturation** -> wait until an actual retention deadline passes or Hide the trader, never delete required evidence to make room. Do not restore an older marker-free book over an active candidate to force a retry.

Rollback before any release: preserve exports; deliberately cancel/export incompatible review queues and clear/export the pending capture while reviewed storage controls work; disable both reviewed IMM and reviewed Report (if enabled), and return to approved stable IMM 0.19.37 plus the baseline Report source at base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Do not resume schema-v4 queues under v3, reuse candidate pending arms after downgrade, or reset Trader Book/Ledger/inventory. Older builds do not protect these new completion fields, so keep the candidate raw export and do not resume the candidate against stale/downgraded evidence. If storage cannot be read/cleared, keep review operations disabled for explicit recovery rather than resetting data. Any branch revert is a separate authorized action, not part of this publication.

The outside tester remains on stable **0.19.37 until a separately approved full release**. No candidate/intermediate build is sent to them. Existing stable @updateURL/@downloadURL still track main; actual per-install update isolation is an owner/tester control, not a guarantee produced by this branch. No main/global metadata or installation change occurs here.

---

## Bounded receipt-link asynchronous correction (2026-10-12)

Authority: [owner authorization 6116482125](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6116482125), [independent Q BLOCKED and complete fixtures](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6115230919), and [assistant-first caller audit](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6113407596). Starting head `2463e0cbcc42cebb9117daacd3c0d8791c388921`, tree `e2c945ec8d8ceee361e2b4dae88d374d18e1476f`; approved main/base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`. Same existing draft PR #139 and branch `agent/bl-r01b-v22-trader-refresh-implementation`.

Complete governance/Divine Knowledge refresh and current GitHub authorization preceded edits. Full non-shallow clean branch checkout, all 213 published blobs/worktree hashes, starting tree/refs and executable preflight matched. Git 2.51.1, Node v24.19.0 and Python 3.12.14; native Node Web Locks available. A same-head expected-SHA non-force update proved isolated-branch publication without changing its head. Starting full suite independently executed in this implementation workspace: **1197/1197**, exit 0. Unchanged Q acceptance assertions reproduced **0/4 pass, 4 fail**, exit 1. No implementation was attempted through a partial repository reader.

### Root cause and bounded mechanism

The protected receipt-link caller treated the Web Locks writer's Promise as a synchronous result, removed its armed capture before grant/readback and reset unpreviewed pasted text. The owner explicitly permits this one protected-handler exception. No other protected accounting/recovery function body changes.

- The actual document-click handler is asynchronous and awaits the existing `captureTransition`. Its synchronous critical callback revalidates the original normalized/persisted pending identity, expiry and page-local arming revision before invoking the unchanged `saveTraderPriceCapture` under the grant.
- Verified positive pricing consumes only that still-current intent **inside the same grant**, preventing another cooperating receipt caller from saving it again. Rejection, denied/null/aborted acquisition, write/readback failure, rollback, active queue and zero supported prices retain applicable recovery. Explicit clear/expiry/re-arm never manufactures or resurrects old intent. The existing separate deliberate Ledger counterparty metadata link still commits before capture and is not rolled back by capture failure.
- A page-local UI request guard blocks duplicate taps, including attempts to link another receipt while the first save is pending. A local arming revision distinguishes same-trader rearming even within the same millisecond; raw pending bytes distinguish cooperating contexts. These are ephemeral UI fields, not persistent capture authority or another coordinator.
- The original pasted text is retained in the receipt draft before any render. Same-draft edits during waiting survive settlement. One in-memory recovery draft supports deliberate close/reopen; switching/closing preserves the original input without an old completion reopening or overwriting the current draft. A completion for a closed/replaced draft names the original receipt ID rather than claiming the current receipt.
- Actual parsed counts are reported after success. Zero supported prices explicitly preserve existing historical quote behavior/check-count semantics and retain armed retry; they are not labeled saved pricing. Existing real lock/persistence/queue diagnostics still execute; the earlier Q never proved completely silent failure.

Only immediate integration surfaces change: handler, in-memory state, arm/clear revision increments and receipt rendering/open/close input preservation; shared test harness adds opt-in production-event exposure and one-shot readback faults. Existing capture writer, lock implementation, raw queue gates, A/B budget, persistent keys/schemas, identity precedence, accounting arithmetic and safety boundary remain unchanged. Five IMM markers remain **0.19.39** for this draft amendment; release versioning is a separate gate. The approved-base `preservedPrevious` ReferenceError is documented by Q and is not repaired here; the starting candidate's already-correct writer remains byte-identical.

### Production tests and author validation

New maintained **31-case** `tests/imm-receipt-link.test.js` uses the complete unmodified production file with normal initialization (`testMode:false`, opt-in CommonJS state exposure), registered production document-click actions, real parser/writer/renderers and native Node Web Locks. Synthetic DOM/storage/clock and explicit lock/storage faults do not constitute live TornPDA/browser acceptance. No production handler/writer/authority function is replaced.

Coverage includes normal/held/denied/null grants, visibility/pagehide/timer abort, storage write/readback rollback and retry without repaste, intervening production queue, duplicate taps, two cooperating receipt contexts, rearming before/after save, explicit clear/expiry, cross-tab replacement and expired cached intent, closed/switched/reopened drafts, unpreviewed input and later edits, zero prices with/without history, under-grant book write/intent cleanup, actual feedback and exact accounting/protected-store sentinels. Original lots, allocations, cash, costs, profit and saved receipt audits remain byte-identical; only deliberate sale counterparty fields and Ledger timestamp may change.

| Fresh corrected-workspace check | Result | Exit |
|---|---:|---:|
| Unchanged independent Q acceptance, author rerun | 4/4 | 0 |
| Maintained receipt regression | 31/31 | 0 |
| Capture lifecycle | 46/46 | 0 |
| Capture coordination | 75/75 | 0 |
| N1–N3 | 122/122 | 0 |
| N4–N5 | 554/554 | 0 |
| Protected supported regressions | 400/400, 21 suites | 0 |
| Full supported suite | 1228/1228, 21 suites | 0 |

All final groups have zero failures/cancellations/skips/todos; counts overlap. Exact commands/TAP exits, per-file syntax, diff/key/version/protected-body audits and immutable publication receipt are in the correction report/evidence. The other **21** protected regions are byte-identical to approved base; the one authorized handler differs. Development fixture calibration corrected an expected trader chosen by sorted index instead of armed ID and seeded historical items through existing normalization. Shared CommonJS exposure was made opt-in after two existing interrupted-startup assertions correctly caught an empty API object. No original Q or maintained capture/protected assertion was weakened; those failures remain recorded in development evidence.

### Next gates, manual checks and rollback

Mandatory order: **B correction → fresh independent targeted Q → separate owner authorization for full independent V1 → owner V2 TornPDA/desktop + Ledger Integrity → separate merge/release authorization**. Author regression PASS changes neither independent verdict. No automatic next gate, merge, mark-ready, auto-merge or release is authorized. Main and PR #140 stay untouched.

After those preceding gates and owner V2 authorization, export Trader Book/Ledger and use only the exact reviewed build in all cooperating tabs. On TornPDA and desktop: paste a receipt without Preview; link once and double-tap while waiting; inspect real success count and one book capture; force controlled lock denial/contention and storage failures in an isolated profile; retry without rearm/repaste; rearm/clear/expire while waiting; close/switch/reopen the receipt; confirm old completion never replaces the current draft; check zero-price historical preservation. Compare Ledger exports allowing only the deliberate counterparty metadata/timestamp change, and require original lot/sale arithmetic/receipt-audit data unchanged plus Ledger Integrity PASS.

Remaining risks: real browser DOM/touch/textarea behavior, userscript managers, TornPDA lifecycle/BFCache/process kill, cross-site carriers/provider markup and native browser lock support were not tested here. In-memory draft recovery does not survive reload/process loss. Locks exclude only cooperating same-origin versions; close/reload old IMM tabs. Persistent-storage failure/rollback remains best effort and existing multi-key interruption risks require backups/manual recovery.

Rollback: preserve exports and deliberately cancel/export any review queue/summary; disable the review build and reinstall stable IMM 0.19.37 at the approved base. Never resume schema-v4 in-flight state under a v3 runtime or reset accounting. For caller-only rollback before release, revert this single amendment on the existing feature branch under separate authorization. PR #139 remains DRAFT/UNMERGED.

## Prior bounded N4–N5 correction and raw-state audit (2026-10-11)

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
