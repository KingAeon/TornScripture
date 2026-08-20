# TornScriptures Current Storage Inventory

Status: **Age of Discovery / source inventory only**

Reviewed baseline: `main` at `a5dea932df186b8d5d2e2805e4eef837f6edf0f7`

Reviewed: 2026-08-10

Purpose: record what stable TornScriptures currently persists, where it persists it, and the consequence class of that data before any storage architecture or migration is discussed.

This file is **not** a migration plan. A dataset being listed as a good `PDA_storage` candidate does not authorize moving it.

## 1. Storage surfaces currently in use

### Browser `localStorage`

Used heavily by Item Market Margin (IMM), Inventory Sales HUD (ISH), the IMM trader companion/report scripts, and for smaller War Intelligence HUD (WIH) settings/session metadata.

Properties relevant to Discovery:

- synchronous reads/writes
- same-origin browser storage
- currently useful for IMM's document-start and cross-page workflows
- some TornScriptures scripts deliberately share the same key names
- competes with browser/WebView storage capacity
- vulnerable to browser-site/cache/storage clearing depending on environment

### Browser `sessionStorage`

Used for short-lived tab/session identity or handoff/notices. Confirmed examples include:

- WIH collector tab identity: `sk-wih-collector-tab-id-v1`
- IMM early trader-capture result notice: `tornscripture-imm-core-capture-notice-v1`

IMM also declares storage identifiers explicitly named as recapture/carousel session keys; exact call-site ownership remains to be frozen before any storage migration decision.

### `window.name` / URL transport

IMM uses non-database transport for early cross-origin trader-price capture:

- `window.name` bridge prefix: `TSIMM_PRICE_BRIDGE:`
- URL import parameter: `tsimmPriceImport`

This is workflow transport, not long-term persistence. It should not be conflated with a storage-backend migration.

### IndexedDB

WIH uses IndexedDB for its growing historical datasets:

- DB: `script-kitty-war-intel`
  - store: `observations`
  - store: `players`
- DB: `script-kitty-war-intel-health`
  - store: `collectorHealth`

WIH's own safety boundary explicitly describes observations as locally stored in IndexedDB.

### TornPDA-managed API-key injection

IMM and ISH can receive TornPDA's managed API key through the `###PDA-APIKEY###` placeholder.

This is not TornScriptures-owned persistence and should be treated separately from browser `localStorage` and TornPDA `PDA_storage`.

## 2. IMM v0.19.33 storage inventory

Stable IMM states that the API key, catalog cache, pending purchase, purchase lots, sale history, trader book, favorites, watched items, and receipt audits remain in browser local storage.

The stable `APP` contract currently declares these persistence identifiers:

| Key / identifier | Current role | Preliminary consequence class | Native-storage research fit |
| --- | --- | --- | --- |
| `tornscripture-imm-api-key-v1` | locally entered Torn API key | secret / user configuration | **Low reason to move**; TornPDA-managed key already exists and native namespace is not a security sandbox |
| `tornscripture-ish-api-key-v1` | shared ISH API key fallback | secret / cross-script shared | **Poor blind candidate**; per-script native namespaces would break current sharing |
| `tornscripture-imm-catalog-v1` | IMM Torn item catalog cache | reconstructible cache | **Strong candidate** after payload/performance testing |
| `tornscripture-ish-torn-catalog-v1` | shared ISH catalog cache | reconstructible cross-script cache | Capacity fit is strong, ownership fit is unresolved because native namespaces are per script |
| `tornscripture-imm-settings-v1` | IMM settings/UI and ledger strategy configuration | user-authored configuration | Small; backup matters more than capacity |
| `tornscripture-imm-ledger-v1` | purchase lots, remaining quantity, sale/accounting history | **irreplaceable accounting truth** | High-value future candidate only with independent export/backup/restore/integrity guarantees |
| `tornscripture-imm-ledger-cleanup-backup-v1` | reversible ledger-cleanup backup | critical recovery data | Must not be made less independent from the ledger it protects without deliberate recovery design |
| `tornscripture-imm-inventory-v1` | last inventory snapshot/cache | reconstructible / refreshable snapshot | Candidate; freshness semantics matter more than capacity |
| `tornscripture-imm-inventory-baseline-v1` | inventory reconciliation baseline | workflow/reconciliation state | Needs call-site/lifecycle review before classification |
| `tornscripture-imm-sell-priority-v1` | sell-priority state | derived/user-influenced state | Needs call-site review; likely low capacity pressure |
| `tornscripture-imm-api-key-profile-v1` | API-key profile/introspection cache | reconstructible metadata | Candidate but very low urgency |
| `tornscripture-imm-inventory-reconcile-intent-v1` | reconciliation workflow intent | transient workflow state | **Poor blind candidate**; timing/synchronous behavior likely more important than size |
| `tornscripture-imm-traders-v1` | trader book, captured prices, disposition, relationship data/journal | **mixed: user-authored + reconstructible capture data** | Important future candidate, but mixed consequence classes need separation/backup policy first |
| `tornscripture-imm-trader-view-v1` | trader UI view state | small preference | Low urgency |
| `tornscripture-imm-pending-trader-capture-v1` | cross-page/cross-origin capture handoff | transient timing-sensitive state | **Poor blind candidate**; document-start/synchronous behavior is valuable |
| `tornscripture-imm-price-recapture-v1` | recapture session identifier/state | session/workflow | Keep in session-class storage unless later evidence says otherwise |
| `tornscripture-imm-favorite-recapture-carousel-v1` | favorite-carousel session state | session/workflow | Keep in session-class storage unless later evidence says otherwise |
| `tornscripture-imm-trader-recapture-result-v1` | recapture result state | workflow/result | Needs call-site review |
| `tornscripture-imm-pending-purchase-v1` | pending purchase capture/reconciliation | transaction-critical transient state | **Poor first migration candidate**; immediate availability/recovery semantics matter more than capacity |
| `tornscripture-imm-pending-trade-sale-v1` | pending trade-sale capture | transaction-critical transient state | **Poor first migration candidate** for same reason |
| `tornscripture-imm-recent-purchase-fingerprints-v1` | cross-channel purchase dedupe | reconstructible/transaction guard | Small but correctness-sensitive; backend change should not precede lifecycle analysis |
| `tornscripture-imm-purchase-privacy-v1` | purchase privacy/migration marker | small schema/migration state | Low capacity benefit; keep simple |

### Important IMM discovery: `traders-v1` mixes data classes

The trader book is not merely a cache.

The same record can contain:

- trader identity
- captured/pricelist prices
- price-page metadata and timestamps
- disposition such as normal/avoid/hidden
- avoid reasons
- relationship roles
- relationship journal entries and notes

Captured prices may be reconstructible. User classifications and journal notes are not necessarily reconstructible.

Therefore the trader book cannot safely be labeled simply "cache" for storage decisions. This mixed ownership is a future architecture question, not a reason to migrate it wholesale.

### Important IMM discovery: early capture is intentionally synchronous

IMM runs at `document-start` and its early trader-price capture immediately reads/writes `localStorage`, uses `sessionStorage` for notices, and uses URL/`window.name` transport across external trader-price pages.

That path is exactly the kind of workflow where an async-only native backend could introduce races if used mechanically.

## 3. ISH v0.3.0 storage inventory

ISH declares six browser-local persistence keys:

| Key | Role | Preliminary consequence class | Native-storage research fit |
| --- | --- | --- | --- |
| `tornscripture-ish-api-key-v1` | local API key | secret/configuration | Low reason to move; TornPDA managed key already exists |
| `tornscripture-ish-settings-v1` | HUD/settings state | user configuration | Small; low urgency |
| `tornscripture-ish-rules-v1` | keep/trader/store/trash rules | user-authored configuration | Backup/portability matters more than capacity |
| `tornscripture-ish-inventory-v1` | inventory snapshot | reconstructible/refreshable | Candidate |
| `tornscripture-ish-torn-catalog-v1` | Torn item catalog | reconstructible cache | Strong capacity candidate, but currently shared with IMM |
| `tornscripture-ish-price-config-v1` | trader price configuration | externally refreshable/configuration mix | Candidate only after ownership/source review |

ISH explicitly says its API key and inventory remain in browser local storage today.

## 4. WIH v0.7.1 storage inventory

### IndexedDB historical stores

WIH already separates its growing historical data from `localStorage`:

- observations
- player records
- collector-health records

This is the most obvious existing backend to compare against `PDA_storage`, but **not** an automatic migration candidate because IndexedDB already provides database-oriented behavior and the feature is working.

### Browser-local small state

WIH uses:

- `sk-wih-settings-v1` for settings, watch lists, aliases, retention and HUD state
- `sk-wih-war-sessions-v1` for up to the most recent 30 war-session records
- `sk-wih-collector-tab-id-v1` in `sessionStorage` for per-tab collector identity

This is an example where TornScriptures already naturally uses multiple storage classes according to data behavior.

## 5. IMM companion/report scripts

### `TornScripture-IMM-Trader-Deals.user.js` v0.1.1

Reads shared IMM data directly from current browser `localStorage`:

- `tornscripture-imm-traders-v1`
- `tornscripture-imm-catalog-v1`
- `tornscripture-ish-torn-catalog-v1`
- `tornscripture-imm-ledger-v1`

It also owns:

- `tornscripture-imm-trader-deals-settings-v1`

This makes the current shared-browser-storage coupling explicit: moving IMM data into a TornPDA per-script namespace would make this companion unable to read it unless packaging/ownership changes.

### `TornScripture-IMM-Trader-Report.user.js` v0.2.3

Reads shared IMM data from browser `localStorage` and declares:

- `tornscripture-imm-traders-v1`
- `tornscripture-imm-catalog-v1`
- `tornscripture-ish-torn-catalog-v1`
- `tornscripture-imm-ledger-v1`
- `tornscripture-imm-report-addon-settings-v1`
- `tornscripture-imm-trader-price-index-v1`
- `tornscripture-imm-trader-link-backup-v1`

The last two need exact call-site/consequence review before classification.

## 6. Cross-script dependency finding

Current TornScriptures persistence is **not** merely a set of independent per-script databases.

At least these records are intentionally shared across multiple installed scripts:

- ISH API key fallback
- Torn catalog data
- IMM trader book
- IMM ledger

`PDA_storage` intentionally isolates each installed userscript namespace. Therefore a mechanical per-script native migration would break some existing read paths even if every individual native write worked perfectly.

This materially strengthens the case for a future storage-service/ownership discussion, but does not predetermine whether that service belongs before or after one-install modular packaging.

## 7. Preliminary consequence classes

For future storage decisions, current data should be evaluated under at least these classes:

### Class A — transient/session

Examples:

- recapture/carousel state
- pending capture handoffs
- short-lived notices
- collector tab IDs

Primary concern: **timing and lifecycle**, not capacity.

### Class B — reconstructible caches

Examples:

- Torn item catalog
- inventory snapshots
- API-key profile metadata
- captured market/trader prices when a source can be revisited

Primary concern: **capacity, freshness, and efficient rebuild**.

This is the strongest initial research class for `PDA_storage`.

### Class C — user-authored configuration

Examples:

- settings
- sales rules
- trader disposition/reasons
- trader relationship notes
- watch lists/aliases

Primary concern: **portability and backup**, even when small.

### Class D — historical observations

Examples:

- WIH observations/health
- future market-price history
- future trader-price history

Primary concern: **growth, query model, retention, export, and recovery**.

Native TornPDA storage is attractive for growth/durability, while WIH demonstrates that IndexedDB may already be a suitable browser backend.

### Class E — accounting/transaction truth

Examples:

- IMM ledger lots
- sale history
- receipt/audit records that become authoritative
- future Black Ledger records

Primary concern: **correctness, atomicity, integrity, backup, restore, migration, and loss recovery**.

No backend qualifies for this class merely because it has more space or survives cache clearing.

## 8. First source-fit conclusions

1. TornPDA `PDA_storage` has now passed the first live-verification gate for non-critical/reconstructible data on the owner's tested device.
2. Stable TornScriptures has enough cross-script storage coupling that a blanket migration would be unsafe even if native storage itself is reliable.
3. Catalog/cache/history growth is the clearest area where the new capacity can help.
4. Early IMM transaction/trader handoffs should remain timing-first research subjects; async storage must not be introduced casually there.
5. The IMM trader book currently mixes reconstructible captures with user-created information, so it needs ownership/backup thinking before backend selection.
6. WIH already demonstrates a useful hybrid model: IndexedDB for large history, `localStorage` for small configuration, and `sessionStorage` for tab identity.
7. Black Ledger remains a separate durability problem. `PDA_storage` is promising infrastructure, not a backup strategy by itself.

**Architecture action:** None. **Discovery inventory only.**

## 9. Open follow-up work

- freeze exact call sites for IMM's recapture/carousel session identifiers
- classify inventory baseline/reconcile intent and trader recapture-result lifecycles precisely
- classify Trader Report price-index and link-backup ownership precisely
- measure current real-world storage sizes before deciding capacity pressure
- test larger `PDA_storage` payloads without forcing quota exhaustion
- verify protocol-specific TornPDA browser-cache clearing
- test native bridge availability on IMM's external trader-price top-level pages
- compare IndexedDB vs `PDA_storage` for history/query behavior rather than assuming native storage is superior
- define independent data export/import before any irreplaceable data moves
