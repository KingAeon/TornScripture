# TornScriptures Storage Architecture Decision

Status: **PROVISIONAL / DISCOVERY-APPROVED**

Date: 2026-08-11

This document records the storage architecture direction agreed during the Age of Discovery after TornPDA native-storage lifecycle, cross-origin, scaling, batching, quota and atomicity qualification.

It is an architecture decision record, not authorization to migrate production data.

## Decision

TornScriptures will use a **hybrid persistence architecture behind a centralized storage service**, with storage policy determined by data class rather than by one universal backend.

### Class A — immediate / synchronous state

Use synchronous page/browser mechanisms only where timing requires them.

Examples:
- document-start flags
- pending capture handoffs
- transient navigation/session state
- short-lived carousel/progress state
- early cross-origin handoff state that must exist before async native storage can answer

Candidate mechanisms include memory, `sessionStorage`, carefully bounded `localStorage`, URL state and `window.name` where justified.

These mechanisms are not to be treated as durable warehouses merely because they are synchronous.

### Class B — durable but reconstructible data

On TornPDA, `PDA_storage` becomes the preferred candidate backend for substantial reconstructible datasets after a storage abstraction exists.

Examples:
- Torn item catalog/cache
- reconstructible market/trader price captures
- derived inventory datasets
- bounded historical observations whose source can be reacquired

The first eventual production pilot should come from this class, not from Black Ledger or other irreplaceable data.

### Class C — irreplaceable / user-authored / accounting data

Examples:
- Black Ledger purchase lots and sale history
- cost basis and receipts
- trader notes, user dispositions, hidden/avoid reasons and relationship metadata
- any record whose exact user-entered state cannot be guaranteed recoverable from Torn or another authoritative source

`PDA_storage` may eventually participate as the live TornPDA backend for this class, but it must never be the only unbacked copy.

This class requires TornScriptures-controlled backup/export, integrity checks, schema/version metadata, and recovery/import tooling before migration is considered safe.

## Central storage service

Product modules should depend on logical storage contracts, not direct backend calls.

Conceptually:

```text
TornScripture modules
        ↓
StorageService
        ↓
backend selected by runtime + data class
```

Likely backends include TornPDA `PDA_storage`, browser IndexedDB, and small synchronous browser/session state where required.

The storage service should own:
- serialization/versioning
- migration
- usage accounting
- quota-aware behavior
- pruning policy for reconstructible data
- integrity verification
- portable export/import where required
- diagnostics

## Data-shape rule

Do not mechanically move existing monolithic `localStorage` blobs into `PDA_storage`.

Mixed-consequence datasets should be decomposed by consequence and lifecycle.

The current trader book is the clearest example. Captured trader prices are largely reconstructible, while user-authored notes/dispositions/relationship metadata may be irreplaceable. These should eventually become separate logical records even if the UI still renders one trader card.

A future shape may resemble:

```text
trader-profile/{id}       user-authored metadata and disposition
trader-price/{id}/{source} current reconstructible price capture
trader-history/{id}/...    optional reconstructible historical observations
```

This permits safe pruning of price history without deleting user-authored trader intelligence.

## Quota policy

TornPDA currently provides 10 MiB per installed userscript by default and permits the user to raise an individual script to 50 MiB.

TornScriptures should not be designed around asking every user to increase that limit.

Preferred product behavior:
- know current native-storage usage
- classify what is safe to prune
- warn before exhaustion
- prune or compact reconstructible data when appropriate
- preserve irreplaceable data
- offer an increased quota only as an optional capacity decision

The live Q3 result showed clean `QuotaExceeded` rejection and no partial mutation at the default limit on the tested environment.

## Write-shape policy

The Q1/Q2 live benchmark showed ~1 MiB values are practical on the tested device, but record-heavy JSON costs more than one flat blob and rewriting a large monolithic value for tiny changes is undesirable.

Future storage design should prefer bounded logical records/chunks plus deliberate batching/debouncing rather than giant frequently rewritten blobs.

## Cross-origin policy

Live evidence established one installed TornPDA userscript can see the same native namespace on top-level Torn, TornExchange and Weav3r pages.

This creates a durable cross-origin data lane but does not eliminate synchronous handoff mechanisms automatically.

Rule:
- use fast synchronous handoff mechanisms when document-start/timing requires them
- normalize/validate captured data
- persist durable results through the storage service

Do not remove IMM URL/`window.name`/early-capture paths solely because native cross-origin storage exists.

## One-install direction

The shared native namespace per installed userscript strengthens the long-term modular-monolith direction for TornScriptures.

A future single installed TornScripture suite could expose one internal storage/API layer to IMM, inventory, Black Ledger, trader intelligence and WIH modules instead of attempting to coordinate multiple independent TornPDA storage namespaces.

This is architectural evidence only. It does not authorize immediate consolidation of the current scripts.

## Black Ledger rule

Black Ledger requires a stronger persistence contract than backend selection alone.

A future design should include:

```text
live authoritative dataset
+ append/change journal
+ schema/version metadata
+ integrity checks
+ periodic portable backup
+ recovery/import tooling
```

A simple `PDA_storage.set("ledger", ledger)` migration is explicitly not sufficient.

## First eventual production pilot

When implementation is later authorized, the first storage-abstraction pilot should use a **large reconstructible dataset**, with the Torn item catalog currently the preferred candidate.

Why:
- substantial enough to exercise the abstraction
- frequently used
- currently contributes browser-local pressure
- reacquirable from Torn if lost
- no accounting/user-authored consequence

Black Ledger is not the first pilot.

## Remaining architecture gate

Before relying on one native namespace from multiple TornPDA tabs, complete Q4 concurrency qualification.

Q4 should separately test:
1. simultaneous writes to different keys
2. simultaneous writes to the same key
3. concurrent/batched writes
4. concurrent near-quota writes

The near-quota case determines whether TornScriptures needs its own single-writer/lease discipline around storage operations.

## Current verdict

**Hybrid storage, centralized behind a TornScripture storage service. TornPDA native storage is the preferred durable backend candidate for substantial data on TornPDA; synchronous browser mechanisms remain for timing-critical state; irreplaceable data receives independent backup/recovery guarantees; migration begins with reconstructible data.**

Architecture status: **AGREED IN DISCOVERY / NO PRODUCTION MIGRATION AUTHORIZED.**
