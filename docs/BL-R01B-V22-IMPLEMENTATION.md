# BL-R01B v2.2 implementation evidence and acceptance gates

Status: V1-01 through V1-05 corrected in the owner-authorized resume pass, syntax checked and Node regression tested; awaiting fresh independent exact-head [V1] and owner TornPDA/desktop [V2]. This branch is not a release. The final published SHA and draft PR are recorded in the PR description, avoiding a self-referential commit hash here.

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

## Executable verification

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

1. Export Trader Book and Black Ledger JSON; preserve original bytes, installed stable version and Ledger Integrity result. Keep backups outside Git. Close/reload every old IMM tab; enable only one IMM script/version in all Torn tabs. Use the exact reviewed branch/head and version 0.19.39 after owner authorization to test.
2. In two same-origin Torn tabs, complete Cancel before Retry and reverse their order. Completed Cancel must never be resurrected; a Cancel waiting behind a granted B must cancel that same run after the B decision. Try duplicate Retry, cancel then start a replacement run, hide/close the waiting tab and close the holder. Denied/unavailable locks in an isolated diagnostic profile must give visible no-write/no-navigation recovery, including document-start returns.
3. On TornPDA Android and relevant desktop, open Trader Book on Torn. Run favorites, stale, all and failed retry. Verify exact IDs, avoid/hidden exclusion, and valid → failed/empty/timeout/wrong-ID → valid progression. Use fixtures for adversarial provider cases that cannot safely be reproduced live. Never infer unavailable from zero rows alone.
4. Observe actual A issuance → provider deadline → Torn checkpoint/readback → B. Reload before expiry; the deadline must not restart. Lose A return: explicit Retry once. Lose B return: exhausted, Skip/Cancel only. No same-run C. Interrupt before userscript execution and switch apps; return manually to Torn without unattended rescue.
5. Verify Weav3r numeric route precedence, reset/stripped transport behavior and mismatched zero-price recovery. For TornExchange verify actual independent page ownership and whether `window.name` survives. Carrier loss must show manual-only recovery. No TE URL carrier is claimed qualified. On a supported Buy Price table, quantity/ID values with a blank, zero or unsupported price must not become a price; verify a real positive Buy Price control. Confirm direct unarmed and armed manual captures and mismatch/cancel no-write behavior.
6. Test duplicate notices, delayed A after B, canceled/old-run replay, identical names, recordId/uuid-only capture + lost-notice recovery + Skip, malformed expiry preservation and legacy v3 unknown allowance and explicit new-run recovery. Test storage denial/readback failure using an isolated test profile: no automatic navigation or reset allowance; original exports remain recoverable.
7. Inspect compact/detailed Trader Book, dossier, Best Trader Exits, Priced Trade best/row annotations, Trade Exit Audit and watched-market banners and the selected watch dock before/after a failure on the same item. A failed recent quote stays historical, age does not renew, and no gain/buy-below/top-buyer signal appears. Confirm real counterparty-verified Torn cash remains distinct. Native quantity/MAX actions must still require their established user arming.
8. Export Ledger again without performing accounting actions; require exact unchanged bytes and Ledger Integrity PASS. Record browser/TornPDA version, exact SHA, observations and screenshots. VM fixtures do not satisfy this live gate.
9. Rollback: cancel the review queue while storage works, disable review IMM, reinstall the script from base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475` / stable 0.19.37. Restore the backed-up Trader Book if needed through existing import UI. Keep Ledger untouched; restore its backup only if an independently identified integrity problem requires it. With IMM disabled, export and deliberately remove the review queue/summary keys if they cannot be canceled; do not let a downgraded v3 runtime resume a schema-v4 in-flight queue. No speculative migrations or bulk account-data resets.

The owner supplied limited live Web Locks qualification, not live acceptance of this corrected implementation. Product document-start acquisition, close/kill recovery, desktop lock support, browser carrier retention, real provider final-state markup, narrow Android layout and live Ledger Integrity remain unverified limitations. Local storage rollback is best effort if the storage medium itself remains unavailable; navigation stays blocked and backups are the recovery path. DQ-EXT-001C quote freshness/precedence work remains open. Independent [V1], owner [V2] and separate explicit merge/release authorization are required. Do not merge, mark ready, enable auto-merge, release or modify main from this implementation.
