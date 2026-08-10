# TornPDA Capability Registry

Status: **Age of Discovery / DISCOVERED ONLY**

Last broad review: **2026-08-10**

TornPDA baseline reviewed:

- TornPDA version in `master`: `3.15.0+673`
- v3.15.0 changelog date: `08 August 2026`
- Developer storage guide: `userscripts/TornPDA_Storage.md`
- Userscript platform guide: `userscripts/README.md`
- Native storage implementation: `lib/utils/script_storage.dart`
- Userscript identity/injection implementation: `lib/models/userscript_model.dart`, `lib/providers/userscripts_provider.dart`, `lib/utils/js_snippets/remote_snippets.dart`
- Userscript import/export implementation: `lib/pages/settings/userscripts_page.dart`

This registry records capabilities of TornPDA as a TornScriptures runtime platform. It is separate from the Torn API capability registry. Nothing in this file authorizes a TornScriptures storage migration or runtime change.

## 1. CAP-PDA-STORAGE-001: Native per-script storage

**Surface:** `PDA_storage`

**Evidence:** Maintained TornPDA developer documentation plus current app source.

**Introduced/publicized:** TornPDA v3.15.0.

### Purpose

TornPDA provides an app-backed key/value store for userscripts that is separate from the Torn page's browser `localStorage`. The developer guide recommends it for sizeable caches, datasets and history, especially when data should survive a browser-cache clear.

### Backing store

Current implementation uses SQLite in TornPDA's application documents directory rather than WebView/browser storage.

### Capacity

Current source defines:

- 10 MiB default quota per installed userscript namespace
- user-adjustable per-script quota up to 50 MiB
- 250 MiB global native-script-storage cap

The implementation can report both per-script quota exhaustion (`QuotaExceeded`) and global exhaustion (`GlobalQuotaExceeded`).

### API

The injected API is asynchronous and currently exposes:

- `get(key, defaultValue)`
- `getMany(keys)`
- `loadAll()`
- `list()`
- `set(key, value)`
- `setMany(object)`
- `delete(key)`
- `usage()`

Values must be JSON-serializable.

### Performance guidance

Every native-storage operation crosses the app/WebView bridge. TornPDA's guide therefore recommends loading data once, operating in memory, and batching persistence with `setMany` rather than using many hot-path single-key calls.

### Namespace identity and lifecycle

Each TornPDA-installed userscript receives an immutable UUID-like `storageId`. TornPDA binds `PDA_storage` to that ID inside the userscript's injected closure.

Current app comments and behavior establish that the namespace:

- survives a normal script rename
- survives normal updates of that installed script model
- is separated from other userscript namespaces
- is deleted when that userscript is removed
- may be garbage-collected when its script is no longer installed

The namespace separation prevents accidental key collisions. TornPDA explicitly says this is **not** a security sandbox against other installed scripts.

### Browser-cache durability

TornPDA documents native storage as unaffected by clearing browser/WebView cache. This is a material advantage for large datasets compared with page `localStorage`.

### Important durability boundary

The current app implementation does **not** make this an infallible database.

If the native storage database cannot be opened because it is corrupt/unreadable, current source deletes and recreates it, explicitly describing the store as a disposable cache. The database is also deleted/recreated on an application downgrade that encounters a newer schema.

Therefore:

> `PDA_storage` is more durable than WebView cache/localStorage for its intended use, but current TornPDA source does not justify treating it as the sole unbacked home of irreplaceable accounting records.

This is especially important for Black Ledger.

### Bridge availability

The injected bridge waits for the TornPDA platform-ready event. TornPDA notes that the Flutter bridge can be absent in some frames, including cross-origin subframes. In that situation the JavaScript storage wrapper returns method fallbacks rather than reaching native storage.

This matters to TornScriptures because IMM also runs on external trader-price origins.

### Current TornScriptures use

None. Stable TornScriptures currently does not call `PDA_storage`.

### Potential source fit

**Strong candidates for later evaluation:**

- large Torn item/catalog caches
- trader price datasets and history
- future market-history snapshots
- reconstructible diagnostic/history datasets
- possibly War Intelligence history, subject to comparison against its existing IndexedDB design

**Poor candidates for a blind first migration:**

- tiny settings and preferences
- session-only handoffs
- document-start state that must be available synchronously
- pending purchase/trade/capture handoffs whose timing depends on immediate synchronous browser state
- API key storage merely for isolation/security

**Accounting-critical candidate:** Undecided. Black Ledger use would require a separate Tier 4 storage design, proven migration, export/backup, restore, integrity and rollback behavior before native storage could become an authoritative primary store.

**Decision:** DISCOVERED ONLY.

## 2. CAP-PDA-STORAGE-002: Per-script isolation conflicts with current cross-script sharing

**Evidence:** TornPDA source + current TornScriptures source.

TornPDA native storage automatically binds each installed userscript to a separate namespace.

Current TornScriptures is still distributed as multiple scripts. Some components intentionally share browser-local values. For example, IMM and Inventory Sales HUD currently reference shared catalog/API-key storage names in `localStorage`.

### Significance

Moving each current userscript independently from shared `localStorage` to `PDA_storage` would not preserve that cross-script sharing automatically. It could instead create separate copies or remove an existing communication path.

This is not necessarily a flaw in TornPDA. It is an architectural mismatch between per-script native storage and TornScriptures' current multi-script packaging.

The capability may fit substantially better after, or as part of, the eventual one-install modular TornScriptures architecture, where one installed suite could own one namespace and internally share data between modules.

**Decision:** DISCOVERED ONLY. Do not migrate shared keys individually without a deliberate ownership design.

## 3. CAP-PDA-STORAGE-003: Async-only storage changes startup semantics

**Evidence:** TornPDA developer documentation and wrapper source.

`PDA_storage` has no synchronous read equivalent. All native reads and writes are asynchronous.

### Current TornScriptures contrast

IMM and ISH contain many synchronous `localStorage` reads during initialization. IMM also has document-start and early cross-page/cross-origin capture paths where immediate state can matter before the normal application finishes initializing.

### Significance

A storage migration cannot safely be implemented as a mechanical `localStorage.getItem()` to `await PDA_storage.get()` replacement. It would change control flow, initialization timing and potentially race behavior.

A future storage abstraction may need to classify data by timing requirement, for example:

- small synchronous bootstrap/session state: browser `localStorage`/`sessionStorage`
- large asynchronous durable datasets: TornPDA native storage when available, with a desktop-compatible backend such as IndexedDB
- accounting truth: separate explicit durability and backup policy

This is a research hypothesis, not an approved architecture.

**Decision:** DISCOVERED ONLY.

## 4. CAP-PDA-PORTABILITY-001: Standard `.user.js` import/export

**Evidence:** TornPDA v3.15.0 changelog and current userscript-page implementation.

TornPDA can export selected userscripts as standard `.user.js` files and import a `.user.js` file. This improves movement of script **source code** between TornPDA and desktop userscript managers such as Tampermonkey or Violentmonkey.

### Critical limitation: source portability is not data portability

The current `.user.js` export implementation writes the userscript's raw `source` to the file. It does not bundle `PDA_storage` contents.

Likewise, importing a raw `.user.js` constructs an installed userscript model from the source. Native persisted datasets are not carried inside that file.

TornPDA itself warns that scripts depending on PDA-specific features may need manual adaptation on desktop.

### Significance for TornScriptures

If TornScriptures eventually stores substantial user data in `PDA_storage`, standard `.user.js` export cannot be our backup/device-migration/accounting-export mechanism.

TornScriptures would still need its own explicit data export/import format for any information users must be able to move between:

- TornPDA and desktop
- devices
- fresh installations
- recovery environments

**Decision:** DISCOVERED ONLY.

## 5. Current TornScriptures storage map relevant to this capability

### IMM v0.19.33

Current safety boundary says API key, catalog cache, pending purchase, purchase lots, sale history, trader book, favorites, watched items and receipt audits remain in browser local storage.

IMM has numerous additional local/session keys for reconciliation, early capture and cross-page workflows.

### Inventory Sales HUD v0.3.0

Uses browser `localStorage` for API key, settings, rules, inventory, catalog and price configuration. It shares some key names/data with IMM.

### War Intelligence HUD v0.7.1

Already uses IndexedDB for observation/player history and a separate IndexedDB health store, with `localStorage` for smaller settings/session information.

### Implication

There is no single correct TornScriptures-wide migration target. Each dataset needs to be classified by:

- reconstructibility
- size/growth
- synchronous startup requirement
- cross-script sharing requirement
- desktop portability
- consequence of data loss
- backup/recovery requirement

## 6. Preliminary data-class fit matrix

| Data class | Native-storage fit today | Reason |
| --- | --- | --- |
| Item/catalog cache | Strong candidate | Potentially sizeable, reconstructible, no need to risk shared browser quota |
| Trader price history | Strong candidate | Growing dataset; can be exported/rebuilt if designed correctly |
| Future market history | Strong candidate | Native storage directly addresses long-running history capacity |
| WIH observations | Worth comparison | Growing history and cache-clear survival are attractive, but IndexedDB already exists and works |
| Settings/favorites | Low urgency | Small; migration complexity likely exceeds capacity benefit |
| Session/carousel/handoff state | Poor candidate | Small and often timing/synchronous-lifecycle sensitive |
| API key | No automatic security benefit | Namespace is not a security sandbox; key policy should be decided separately |
| Black Ledger accounting | High-value but high-risk research candidate | Capacity/durability attractive, but current TornPDA failure lifecycle requires independent backup/recovery before sole-authority use |

This matrix is intentionally preliminary and does not authorize moving any data.

## 7. Discovery conclusions

1. TornPDA 3.15 materially expands what a heavy TornScriptures userscript can store without competing with Torn/WebView `localStorage`.
2. The feature is especially promising for datasets that grow over time.
3. Native storage is asynchronous and must be treated as a different execution model, not a drop-in replacement.
4. Per-script isolation is beneficial for collision avoidance but conflicts with some current TornScriptures cross-script sharing.
5. Browser-cache survival is real, but the current TornPDA implementation still contains destructive recovery paths for corruption/downgrade and deletes storage on userscript removal.
6. Standard `.user.js` portability moves source code, not native stored data.
7. A future TornScriptures storage layer should preserve desktop compatibility rather than requiring TornPDA.
8. Black Ledger must not move to native storage as its sole unbacked authoritative database merely because the capacity is larger.
9. The capability is important enough to include in future storage/modularization design, but implementation is deliberately deferred until the open questions are answered.

**Architecture action:** None. **DISCOVERED ONLY.**
