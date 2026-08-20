# TornPDA Browser-Cache Reset — Observed IMM Browser-Local Storage Impact

Status: **controlled owner observation / Age of Discovery**

Date: 2026-08-10

This note records an important safety finding discovered during the TornPDA native-storage durability work. It does not authorize a production storage migration.

## Observed sequence

During Phase H, the owner used TornPDA's own **Browser cache → Clear** control as required by the storage verification protocol.

The disposable TornPDA native-storage probe survived that operation and subsequently passed its safe contract checks.

Afterward, the owner observed that stable IMM browser-local state, including saved trader information and related IMM data, was no longer present.

Stable IMM v0.19.33 explicitly stores important product state in browser `localStorage`, including the ledger and trader book. The Discovery storage inventory also records this browser-local dependency.

## Evidence boundary

The owner observation establishes that, on the tested TornPDA/Android environment, the Browser cache reset sequence was associated with loss of IMM's browser-local persisted state while the separate TornPDA `PDA_storage` namespace survived.

This note does not claim that every browser/WebView storage surface on every platform is always cleared by this control, and it does not infer undocumented implementation details beyond the observed result.

## Consequence for TornScriptures

This is a first-class storage-design finding:

1. browser-local persistence and TornPDA native persistence have materially different lifecycle boundaries on the tested environment;
2. reconstructible browser-local caches can be rebuilt, but user-authored or accounting data needs independent protection;
3. future destructive browser/cache lifecycle testing must not begin until production datasets at risk have been exported or otherwise independently preserved;
4. a storage backend surviving a lifecycle test is not sufficient protection if another production backend is destroyed by the same test;
5. future TornScriptures storage architecture should expose explicit backup/export for irreplaceable data regardless of the selected primary backend.

## Test-safety rule added

For all future Discovery tests involving cache clear, site-data clear, storage reset, userscript-storage clear, uninstall/reinstall, app-data clear, or other destructive lifecycle controls:

**STOP unless every production TornScriptures dataset that could be affected has an independent current backup or the test is performed in an isolated disposable environment.**

No further destructive browser/cache test is required for the current TornPDA `PDA_storage` durability qualification.

## Recovery note

The owner located a previously saved IMM Ledger JSON export after the incident. That export is a historical accounting checkpoint, not a trader-book export and not automatically current truth. Recovery remains a separate product-data task from this Discovery evidence.

Architecture action: **none. DISCOVERED ONLY.**
