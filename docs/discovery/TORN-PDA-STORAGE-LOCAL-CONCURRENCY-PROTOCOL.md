# TornPDA Native Storage Local-Concurrency Qualification Protocol

Status: **Age of Discovery / Q4-L implementation protocol**

Purpose: qualify the end-to-end behavior of concurrently outstanding `PDA_storage` calls submitted from one active TornPDA userscript execution context, without relying on hidden-tab timers.

This protocol follows the Q0-Q3 native-storage qualification PASS and Q4-A, where shared-namespace integrity passed but concurrency was inconclusive because hidden-tab scheduling produced 678 ms call-start separation.

Passing Q4-L does **not** authorize production storage migration.

## Why Q4-L exists

Q4-A showed that a visible TornPDA tab fired 17 ms late while the hidden tab fired 695 ms late. That measured Android/TornPDA scheduling more than storage concurrency.

Q4-L removes that scheduler variable. One active execution context submits two `PDA_storage` calls back-to-back without awaiting the first before submitting the second.

Current TornPDA source forwards each storage request through `window.flutter_inappwebview.callHandler('PDA_storage', sid, method, payload)` and returns a Promise. Current `ScriptStorage._set()` and `_setMany()` do not visibly wrap their complete quota-check-and-write sequences in an explicit application-level per-namespace lock.

Important evidence boundary: Q4-L can prove the behavior of **concurrently outstanding JS/native bridge requests**. It cannot by itself prove that Dart callbacks or SQLite statements overlap internally. If TornPDA or sqflite serializes them before storage access, that serialization is itself a valid and architecture-relevant end-to-end outcome.

## Safety boundary

Q4-L must:

- use a separate disposable Discovery userscript namespace
- use only `ts-discovery-storage-local-concurrency:` keys
- never read or write IMM, ISH, WIH, Black Ledger, trader, API-key, purchase, receipt or other Discovery-probe keys
- make no Torn API requests and perform no gameplay action
- never clear browser cache, app data or TornPDA userscript storage
- never change the native-storage quota
- never test the 250 MiB global cap
- clean its own namespace after each variant
- require the untouched 10 MiB default quota for near-quota testing
- keep Q4-L4 near-quota pressure behind a separate double-arm action

## Concurrency submission rule

For each paired operation:

1. call operation A and retain its Promise
2. before awaiting A, call operation B and retain its Promise
3. await both together with `Promise.allSettled()`
4. record JS-side issue separation and total issuance window
5. verify persistent state only after both settle

Issue timing is preserved as JS-side submission timing, not mislabeled as native/SQLite start timing.

## Q4-L1 — concurrent different-key `set()`

Run five attempts. Each attempt submits two approximately 256 KiB `set()` calls to distinct keys.

Verify both Promises fulfill, both values exist and hash exactly, byte accounting is exact, and cleanup returns to the attempt baseline.

## Q4-L2 — concurrent same-key `set()`

Run five attempts. Each attempt submits two distinct approximately 256 KiB payloads to the same key.

Acceptable final state is complete last-writer-wins behavior: both requests fulfill and the final stored value is exactly payload A or payload B. The protocol does not require which wins. Final accounting must equal one complete stored key/value and cleanup must return to baseline.

Any mixed, truncated or otherwise corrupt final value is a critical FAIL.

## Q4-L3 — concurrent disjoint `setMany()`

Run five attempts. Each submitted batch contains four approximately 64 KiB values, about 256 KiB per batch, with disjoint keys.

Verify both batch Promises fulfill, all eight entries exist and are exact, no partial batch loss occurs, total accounting is exact, and cleanup returns to baseline.

## Q4-L4 — same-context near-quota race

Run only after Q4-L1/L2/L3 live results are reviewed. This variant is separately double-armed and uses the untouched 10 MiB default quota.

### Geometry

1. Clean only the Q4-L namespace.
2. Record the initial baseline.
3. Write a sentinel.
4. Build two distinct approximately 1 MiB candidate writes to separate keys.
5. Fill the disposable namespace so remaining quota satisfies:

```text
remaining > candidate A accounting bytes
remaining > candidate B accounting bytes
remaining < candidate A + candidate B accounting bytes
```

6. Verify exact fill accounting before the race.

### Race

Submit both candidate `set()` calls back-to-back without awaiting the first, then await both with `Promise.allSettled()`.

### Safe outcomes

**Serialized/rechecked:** one candidate succeeds intact, the other rejects with `QuotaExceeded`, the rejected key is absent, and final usage remains <= quota.

**Conservative dual rejection:** both reject with `QuotaExceeded`, both keys are absent, and final usage remains <= quota.

In either safe outcome the sentinel and fill records must remain exact, accounting must remain coherent, and cleanup must return to the pre-run baseline.

### Critical failure

- both candidates succeed and final usage exceeds the configured quota
- a successful value is corrupt or inexact
- a rejected write leaves data behind
- existing sentinel/fill data changes
- usage/accounting becomes inconsistent or unreadable

If geometry is not valid before submission, the run is invalid/inconclusive rather than PASS/FAIL.

## Repetition policy

Q4-L1/L2/L3 perform five attempts each in one bounded ordinary suite, meeting the existing Q4 repetition target without asking the owner to manually repeat fifteen runs.

Q4-L4 begins with **one** controlled near-quota attempt only. Review before any repetition.

## Architecture interpretation

If the ordinary suite and Q4-L4 are clean, concurrently outstanding storage calls appear safe end-to-end on the tested TornPDA environment. A centralized `StorageService` remains valuable for schema, batching, migration and consistency, but the evidence would not by itself require a single-writer lease solely for native-storage safety.

If the ordinary suite is clean but Q4-L4 permits the effective quota to be exceeded, adopt application-level single-writer/lease discipline for quota-sensitive persistence, and likely for all durable native writes for simplicity.

If same-key writes can corrupt data, single-writer coordination becomes mandatory for shared logical records before any production native-storage pilot.

If calls are transparently serialized by the bridge/backend, that is a safe and useful platform characteristic, not a failed concurrency test. Record the end-to-end behavior without claiming internal overlap.

## Evidence boundary

Q4-L does not answer hidden-tab prompt execution, true cross-tab simultaneous JS execution, internal Dart callback overlap, internal SQLite statement overlap, desktop/userscript-manager concurrency, or app/process crash behavior during a write.

Q4-A scheduling evidence remains a separate platform finding.

Architecture action before live Q4-L evidence: **NONE. DISCOVERY ONLY.**
