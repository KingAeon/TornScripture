# TornPDA Discovery Open Questions

Status: **Age of Discovery / unresolved**

These questions follow from the 2026-08-10 review of TornPDA v3.15.0 native userscript storage and `.user.js` portability. They are research questions, not implementation tasks.

Closing a question requires evidence and should update `TORN-PDA-CAPABILITY-REGISTRY.md`.

## DQ-PDA-001 — Exact storage lifecycle across updates, deletion and reinstall

**Priority:** High

Verify in controlled TornPDA use:

- normal remote userscript update
- script rename
- disable/re-enable
- script deletion
- deletion followed by reinstall from the same URL
- app update
- app downgrade where practical/safe

The source establishes several expected behaviors, but TornScriptures should live-verify the lifecycle before trusting important data to it.

## DQ-PDA-002 — App/device backup and migration behavior

**Priority:** High

Determine whether `PDA_storage` contents are included in any TornPDA:

- local backup
- cloud backup
- device migration
- Android/iOS application backup mechanism
- full app restore

Do not infer this from userscript-list backup. The SQLite data must be checked explicitly.

## DQ-PDA-003 — Native-storage export/import for TornScriptures data

**Priority:** High

Standard `.user.js` export moves source only. Determine what TornScriptures-owned export format would be needed for native datasets and whether one common export can round-trip between TornPDA and desktop backends.

Accounting data, if ever stored natively, must have an independent recovery/export path.

## DQ-PDA-004 — Practical latency at realistic dataset sizes

**Priority:** Medium

Measure `loadAll`, `getMany`, `setMany` and `usage` with representative sizes rather than synthetic single values.

Potential classes:

- hundreds of KiB
- 1 MiB
- 5 MiB
- near default 10 MiB quota

Record startup latency, write latency, WebView responsiveness and whether large JSON serialization itself becomes the bottleneck.

## DQ-PDA-005 — Best storage backend by TornScriptures data class

**Priority:** High

Build a measured matrix for:

- settings/preferences
- session handoffs
- API/catalog caches
- trader data
- market history
- WIH observations
- Black Ledger lots/sales/receipts

Compare:

- `localStorage`
- `sessionStorage`
- IndexedDB
- `PDA_storage`
- desktop userscript-manager storage where relevant

The goal is not one universal backend. It is the least fragile backend for each lifecycle.

## DQ-PDA-006 — Cross-origin and frame behavior relevant to IMM

**Priority:** High

IMM also runs on external trader-price origins. Verify where TornPDA binds a usable `PDA_storage` instance and where the bridge returns fallbacks.

Test at minimum:

- top-level Torn page
- top-level Weav3r price page
- top-level TornExchange price page
- any relevant subframe or popup/navigation pattern used by the capture workflow

Do not migrate early-capture state until this is understood.

## DQ-PDA-007 — Cross-script shared-data strategy

**Priority:** High

IMM and ISH currently share some browser-local keys. Native TornPDA storage uses a separate namespace per installed script.

Determine whether the correct future path is:

- keep shared browser data until modularization
- deliberately duplicate/reconcile data
- introduce a shared source outside native per-script storage
- wait for the one-install TornScriptures suite so one namespace owns shared services

No solution is selected during discovery.

## DQ-PDA-008 — Quota and global-cap failure UX

**Priority:** Medium

Verify live behavior for both:

- `QuotaExceeded`
- `GlobalQuotaExceeded`

Determine what TornPDA itself displays and what TornScriptures should do to fail gracefully without corrupting or silently truncating data.

## DQ-PDA-009 — What must remain synchronously available at startup

**Priority:** High

Inventory IMM/ISH/WIH state that is read before asynchronous initialization can safely complete.

Pay special attention to:

- document-start early trader capture
- pending purchase correlation
- trade/counterparty handoff state
- favorite recapture carousel/session state
- duplicate-prevention fingerprints

This will define the boundary between small synchronous browser state and larger asynchronous storage.

## DQ-PDA-010 — Can Black Ledger ever use native storage as a primary backend?

**Priority:** High

Do not answer based on capacity alone.

Required evidence/design questions include:

- independent export and recovery
- integrity verification/checksums
- atomic or recoverable mutation semantics
- migration from current ledger storage
- rollback to the prior backend
- behavior after TornPDA corruption recovery
- behavior after script deletion/reinstall
- device migration
- desktop compatibility
- duplicate prevention after restore

Until these are answered, `PDA_storage` must not become the sole unbacked authoritative Black Ledger store.

## DQ-PDA-011 — WIH IndexedDB versus TornPDA native storage

**Priority:** Medium

WIH already has a purpose-built IndexedDB observation store. Compare the actual advantages of native storage before considering migration:

- capacity
- cache-clear survival
- write/read latency
- indexing/query needs
- export/import complexity
- desktop portability
- existing stability

A new mechanism is not automatically better than a working one.

## DQ-PDA-012 — Supported-platform behavior

**Priority:** Medium

Confirm real public behavior on the TornPDA platforms TornScriptures intends to support. The current implementation has cross-platform database code, but product compatibility should be based on live supported environments rather than source inference alone.

## DQ-PDA-013 — Safe migration method for any future dataset

**Priority:** High

Before migrating a persistent dataset, define and test a reversible sequence such as:

1. read old source
2. normalize/validate
3. write new backend
4. read back and verify counts/checksum/invariants
5. mark migration complete
6. retain old source or a recovery export through a confidence period
7. only later remove obsolete data when explicitly safe

Accounting migrations require stronger gates than reconstructible caches.

## DQ-PDA-014 — Does native storage materially reduce current failure risk?

**Priority:** High

Measure current TornScriptures storage usage and actual failure pressure before migrating simply because more capacity exists.

Record per-domain approximate sizes and growth rates. This will identify where native storage solves a real problem versus where it merely changes technology.
