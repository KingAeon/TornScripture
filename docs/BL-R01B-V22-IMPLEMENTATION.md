# BL-R01B v2.2 implementation evidence and acceptance gates

Status: implemented, syntax checked and Node regression tested; awaiting independent exact-head [V1] and owner TornPDA/desktop [V2]. This branch is not a release. The final published SHA and draft PR are recorded in the PR description, avoiding a self-referential commit hash here.

## Authority and executable preflight

- Repository: `KingAeon/TornScripture`.
- Exact approved base: `main@c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`.
- Branch: `agent/bl-r01b-v22-trader-refresh-implementation`, rooted directly at that commit, using a fresh full worktree. Neither the proof branch nor the stopped v2.1 worktree is its parent.
- [Frozen v2.2 specification](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6078502732), [independent specification PASS](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6078562226), [owner freeze](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6089767188).
- [Protocol blocker/findings](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6078348502) and [prior executable/publication preflight](https://github.com/KingAeon/TornScripture/issues/78#issuecomment-6077700883).
- Read `AGENTS.md`, Project Charter, Assistant Operating Rules, Development Workflow, Ledger Invariants, Divine Knowledge INDEX/NOW/AUTHORITY and the relevant IMM, Black Ledger, external trader, tooling and DQ-EXT-001 capture-continuity nodes.
- Rechecked GitHub `refs/heads/main` and `git ls-remote --heads origin main`: exact approved SHA. `git remote get-url origin` identifies the specified repository. `git rev-parse HEAD` matched the base before edits; `git status --porcelain=v1` was empty; `git rev-parse --is-shallow-repository` returned `false`. Git `2.51.1`; Node `v24.19.0`; complete original checkout: 207 tracked files.
- Baseline: all 19 existing JavaScript files passed `node --check`; all seven existing test files passed direct execution; full supported baseline suite passed **399/399**, 21 suites, zero failures/skips/cancellations/todos. Exact base-to-head diff inspection and native Git object fetch are available.
- Publication uses the proven combined route: local executable workspace → connected GitHub blobs/tree/commit/new branch → native fetch and exact tree/diff readback → one draft PR. Authenticated native `git push` remains unproven and is not claimed.

## Modified files and version

| File | Change |
|---|---|
| `TornScripture-Item-Market-Margin.user.js` | Shared capture authorization, existing queue/schema extension, provider deadline/checkpoint lifecycle, historical read guards; five version markers `0.19.37` → `0.19.38` |
| `tests/helpers/imm-capture-harness.cjs` | Full production userscript VM, independent origin stores, controllable clock/timers, provider DOM fixtures and persistence faults |
| `tests/imm-capture-lifecycle.test.js` | 46 production-path lifecycle/storage/read-safety tests |
| `tests/imm-carousel-identity-precedence.test.js` | Preserve PR #91 numeric-route/link precedence and 307-price capture assertions through the production runtime |
| `tests/imm-carousel-zero-price-mismatch.test.js` | Preserve wrong-ID zero-price failure, one cursor advance, replay rejection and matching zero-price waiting/success coverage |
| `docs/BL-R01B-V22-IMPLEMENTATION.md` | This evidence, migration, limitations and owner acceptance/rollback guide |

The two protected carousel fixtures previously stubbed parsing and expected a provisional v1 success bridge. Their protocol expectations now require v2.2 final validation and prohibit a preview bridge. Their identity, price preservation and queue progression assertions remain, with real production parsers and early/late storage paths. Other protected test files are unchanged.

## Capture authority and persistence

`captureAuthorityDecision` is a shared pure decision used by early imports, ordinary imports and `saveTraderPriceCapture` before any carousel-origin trader-book mutation. It requires the live schema-v4 Torn queue, exact run/entry/attempt/record, original issued clock/deadline/TTL, supported canonical source, independent expected Torn identity and an unconsumed result. Only Torn controls queue issuance. Exact book/queue/pending snapshots are reread immediately before the write; set/readback failures block automatic continuation and attempt to restore previous book/queue bytes.

Automatic imports never create a trader. A fresh direct manual button interaction creates separate short-lived authority, requires independent page identity and visible provider/Torn target confirmations, and can resolve an exact armed record or one unambiguous Torn ID. Missing intent/v1 automatic results, name-only matching and active-carousel manual collisions cannot write. Malformed stored JSON is preserved and blocks imports/new runs. Cleanup removes the offending result, preserving an unrelated current request.

A committed terminal receipt permits Torn to recover a missing completion notice without importing prices twice. Request replay receipts are bounded to 64 live receipts per trader; imports fail closed rather than discard live replay protection. Expired receipts may be removed on a later valid import. These correlators protect state identity/replay; they do not authenticate provider truth.

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
| `parser_failure` | Recognizable TornExchange item table without a supported buy-price column | Terminal; keep old snapshot historical |
| `identity_mismatch` | Wrong independently observed ID or independently unknown provider ownership; supported correlated provider route, zero prices | Terminal failure; manual recovery, advance once |
| `unsupported_page` / unexpected route | Torn cannot establish a supported source/saved ID, or provider request is unqualified | No price import; queue reason/manual-only return and Skip/Cancel as applicable |
| `timeout` | Final B deadline, original authority/identity, zero prices | Terminal; historical snapshot, no third attempt |
| `user_skipped` | Explicit Torn Skip; current authority where still live | End this entry; invalidates its later results |
| `canceled` / `expired` | Torn control/queue expiry closes authority; summary distinguishes attempted and untouched entries | Explicit new owner-started run only |

Final-state text matching is conservative. Other wording, plain zero counts or refresh timestamps remain inconclusive. The literal fixtures prove classification behavior; actual provider empty/closed states have not been exercised live.

## Providers and migration

Weav3r retains the existing numeric `/pricelist/{TornID}` identity and existing hash request carrier. Unrelated profile links do not override the route. The fixtures exercise a reset `window.name`, contradictory hash rejection, 307 real-parser rows and wrong-ID zero rows.

TornExchange accepts independent, explicitly labeled Profile/View Profile or Start/Set Trade controls pointing to supported HTTPS Torn profile/trade routes, requiring one consistent Torn ID. Requested/echoed IDs, slugs and names are insufficient. No automatic mismatch override or provisional success bridge exists. **No new TornExchange hash/query carrier is enabled:** no real TornPDA/browser qualification was established. Existing `window.name` can be used conditionally when it survives and ownership is independently present. Carrier loss or unknown ownership exposes manual-only recapture/Retry/Skip and cannot become automatic quote success. Conditional VM success is not browser qualification.

Storage keys remain `tornscripture-imm-traders-v1`, `tornscripture-imm-favorite-recapture-carousel-v1` and `tornscripture-imm-trader-recapture-result-v1`. Queue/summary schema becomes 4; old name arrays remain display-compatible. Entries add stable IDs, current envelope/attempt, attempts-used and typed reason/outcome. Trader records add last outcome/reason, terminal-check count and replay/completion receipts. Existing trader fields and object store wrappers are preserved by shared imports.

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
| Favorite/all/stale/failed retry selection | Successful age only, exact IDs, avoid/hidden preserved; failed check cannot reset 72-hour selection age |

Pricing formulas, precedence, strategy, lot/sale recording, actual transaction arithmetic, FIFO, receipts, journal/recovery, API credentials, Casino and Training are unchanged. Twenty protected function sections were compared byte-for-byte with the base: ledger normalization/integrity, trade sale/lot accounting, journal/evidence/receipt normalization, completed-trade staging/recovery, imports, native MAX and purchase/network observers; all identical. Production fixtures also preserve protected-store byte sentinels and reject unauthorized store writes. This is synthetic evidence; owner Ledger export and Integrity checks remain required.

## Executable verification

All commands below ran from the full isolated worktree; final exit codes were zero.

| Direct command | Final result |
|---|---|
| `node tests/imm-capture-lifecycle.test.js` | 46 passing |
| `node tests/imm-carousel-identity-precedence.test.js` | 1 passing |
| `node tests/imm-carousel-zero-price-mismatch.test.js` | 2 passing |
| `node tests/imm-startup-persisted-permission.test.js` | 1 passing |
| `node tests/imm-api-trade-recovery.test.js` | 233 passing, 21 suites |
| `node tests/inventory-sales-core.test.js` | All existing assertions passed |
| `node tests/training-advisor-adapters.test.js` | 53 passing |
| `node tests/training-advisor-pure.test.js` | 109 passing |

Focused command: `node --test --test-reporter=tap tests/imm-capture-lifecycle.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js`: **49/49**; zero failures/skips/cancellations/todos.

Complete supported suite:

```bash
node --test --test-reporter=tap tests/imm-api-trade-recovery.test.js tests/imm-capture-lifecycle.test.js tests/imm-carousel-identity-precedence.test.js tests/imm-carousel-zero-price-mismatch.test.js tests/imm-startup-persisted-permission.test.js tests/inventory-sales-core.test.js tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js
```

Final **446/446**, 21 suites, zero failures/skips/cancellations/todos, versus baseline 399. The increase is 46 new lifecycle tests and one additional protected production carousel case. Development fixtures initially exposed a provider timeout reference error and missing VM/export support; these were corrected before final verification. No failed case is hidden or skipped in the final suite.

`node --check` ran individually for every path returned by `rg --files -g '*.js' -g '*.cjs'`: **21/21**, including all affected JavaScript and the new fixture helper. `git diff --check` passed. Complete product/test/document base-to-head diff and modified-file inventory were inspected. Published object/tree/PR readback is recorded in the PR description.

## Owner [V2] smoke checklist and rollback

1. Export Trader Book and Black Ledger JSON; preserve original bytes, installed stable version and Ledger Integrity result. Keep backups outside Git. Enable only one IMM script. Use the exact reviewed branch/head and version 0.19.38 after owner authorization to test.
2. On TornPDA Android and relevant desktop, open Trader Book on Torn. Run favorites, stale, all and failed retry. Verify exact IDs, avoid/hidden exclusion, and valid → failed/empty/timeout/wrong-ID → valid progression. Use fixtures for adversarial provider cases that cannot safely be reproduced live. Never infer unavailable from zero rows alone.
3. Observe actual A issuance → provider deadline → Torn checkpoint/readback → B. Reload before expiry; the deadline must not restart. Lose A return: explicit Retry once. Lose B return: exhausted, Skip/Cancel only. No same-run C. Interrupt before userscript execution and switch apps; return manually to Torn without unattended rescue.
4. Verify Weav3r numeric route precedence, reset/stripped transport behavior and mismatched zero-price recovery. For TornExchange verify actual independent page ownership and whether `window.name` survives. Carrier loss must show manual-only recovery. No TE URL carrier is claimed qualified. Confirm direct unarmed and armed manual captures and mismatch/cancel no-write behavior.
5. Test duplicate notices, delayed A after B, canceled/old-run replay, identical names, legacy v3 unknown allowance and explicit new-run recovery. Test storage denial/readback failure using an isolated test profile: no automatic navigation or reset allowance; original exports remain recoverable.
6. Inspect compact/detailed Trader Book, dossier, Best Trader Exits, Priced Trade best/row annotations, Trade Exit Audit and watched-market banners. A failed recent quote stays historical, age does not renew, and no gain/buy-below/top-buyer signal appears. Confirm real counterparty-verified Torn cash remains distinct. Native quantity/MAX actions must still require their established user arming.
7. Export Ledger again without performing accounting actions; require exact unchanged bytes and Ledger Integrity PASS. Record browser/TornPDA version, exact SHA, observations and screenshots. VM fixtures do not satisfy this live gate.
8. Rollback: cancel the review queue while storage works, disable review IMM, reinstall the script from base `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475` / stable 0.19.37. Restore the backed-up Trader Book if needed through existing import UI. Keep Ledger untouched; restore its backup only if an independently identified integrity problem requires it. With IMM disabled, export and deliberately remove the review queue/summary keys if they cannot be canceled; do not let a downgraded v3 runtime resume a schema-v4 in-flight queue. No speculative migrations or bulk account-data resets.

Browser carrier retention, real provider final-state markup, narrow Android layout and live Ledger Integrity remain unverified limitations. Local storage rollback is best effort if the storage medium itself remains unavailable; navigation stays blocked and backups are the recovery path. DQ-EXT-001C quote freshness/precedence work remains open. Independent [V1], owner [V2] and separate explicit merge/release authorization are required. Do not merge, mark ready, enable auto-merge, release or modify main from this implementation.
