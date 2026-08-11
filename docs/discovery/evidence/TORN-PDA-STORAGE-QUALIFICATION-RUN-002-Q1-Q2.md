# TornPDA Storage Qualification Evidence — Run 002 / Q1-Q2

Status: **PASS — scaling, realistic record shapes, batching, integrity, and cleanup**

Date: 2026-08-11

Probe: `TornPDA Storage Qualification Probe v0.1.1`

Phase: `Q1/Q2 scaling and batch profile`

This file preserves the owner-provided live qualification result from the tested Android/TornPDA environment. It is discovery evidence only and does not authorize a production storage migration.

## Baseline

- URL: `https://www.torn.com/index.php`
- Android 16 / Samsung SM-S938U
- WebView Chrome 150.0.7871.181
- `PDA_storage` available: yes
- cleanup before run: 0 keys deleted, 0 errors
- baseline usage: 0 bytes
- quota: 10,485,760 bytes (10 MiB)
- control record usage after write: 194 bytes

## Overall result

- scaling cases: 8/8 PASS
- batch profile: PASS
- control record intact at end: yes
- namespace returned to clean baseline: yes
- final usage: 0 bytes
- aborted: no
- overall summary pass: **true**

Every scaling case showed:

- exact UTF-8 key + JSON-value byte-accounting match
- exact serialized round-trip equality
- matching compact hashes
- cleanup back to the 194-byte control baseline after each case
- no unexplained mutation

## Scaling results

| Shape | Approx payload | Actual JSON bytes | Records | set ms | get ms | loadAll ms | PASS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| unicode-text | 64 KiB | 65,588 | — | 5.5 | 3.8 | — | yes |
| blob-like | 64 KiB | 65,536 | — | 4.4 | 3.2 | — | yes |
| blob-like | 256 KiB | 262,144 | — | 16.0 | 10.1 | — | yes |
| blob-like | 1 MiB | 1,048,576 | — | 83.0 | 43.8 | 46.8 | yes |
| ledger-like | 64 KiB target | 68,070 | 100 | 6.9 | 4.2 | — | yes |
| ledger-like | 256 KiB target | 273,308 | 401 | 22.5 | 15.9 | — | yes |
| ledger-like | 1 MiB target | 1,096,188 | 1,605 | 94.7 | 63.3 | 86.1 | yes |
| history-like | 1 MiB target | 1,066,957 | 3,615 | 97.6 | 87.1 | 72.9 | yes |

### Byte-accounting examples

The source-derived contract predicted storage usage as UTF-8 key bytes plus UTF-8 JSON-value bytes. Live results matched exactly in every case.

Examples:

- Unicode 64 KiB: expected 65,682 bytes, observed 65,682 bytes
- Blob 1 MiB: expected 1,048,666 bytes, observed 1,048,666 bytes
- Ledger-like ~1 MiB: expected 1,096,282 bytes, observed 1,096,282 bytes
- History-like ~1 MiB: expected 1,067,053 bytes, observed 1,067,053 bytes

This live-verifies the byte-accounting contract for ASCII-heavy, Unicode, and high-object-count JSON shapes on the tested environment.

## Shape observations

The 1 MiB blob-like case completed in approximately 83 ms set / 43.8 ms get.

The realistic record-heavy shapes were somewhat more expensive:

- ledger-like ~1.096 MiB: 94.7 ms set / 63.3 ms get / 86.1 ms loadAll
- history-like ~1.067 MiB with 3,615 records: 97.6 ms set / 87.1 ms get / 72.9 ms loadAll

These are still well below the probe's conservative 5,000 ms slow-operation stop threshold. The result suggests JSON/object shape matters measurably, especially on reads, and architecture should avoid assuming one scalar/blob timing represents all datasets.

## Q2 batch profile

Four approximately 256 KiB values were written/read as one approximately 1 MiB workload.

- entry count: 4
- expected accounting delta: 1,048,860 bytes
- observed accounting delta: 1,048,860 bytes
- accounting exact: yes
- `setMany`: 95.4 ms
- `getMany`: 40.0 ms
- all four entries exact: yes
- all expected/actual hashes matched
- cleanup returned to control baseline: yes
- batch PASS: **true**

The live timing does not show `setMany()` being inherently faster than a single similarly sized blob write; its value remains reduction of JavaScript/native bridge crossings and atomic whole-batch quota handling. `getMany()` performed well in this four-entry case despite TornPDA's native implementation internally iterating individual key reads.

## Integrity and cleanup

A 194-byte control record remained unchanged while large synthetic values were repeatedly created and deleted.

At the end of Q1/Q2:

- control intact: yes
- final cleanup deleted the one remaining control key without error
- final namespace usage: 0 bytes / 10,485,760-byte quota
- cleanup returned to clean Q0 baseline: yes

This is important evidence that the tested workload did not leave orphaned qualification records or unexplained usage drift.

## Gate decision

**Q1/Q2 qualification: PASS.**

On the tested environment, `PDA_storage` has now live-verified:

1. exact source-contract byte accounting for Unicode, blob-like and record-heavy JSON
2. exact round-trip integrity through approximately 1 MiB single values
3. realistic IMM-like ledger records through 1,605 records / ~1.096 MiB
4. high-object-count history data through 3,615 records / ~1.067 MiB
5. `loadAll()` integrity for the largest tested values
6. approximately 1 MiB `setMany()` / `getMany()` correctness
7. control-record integrity while large values churn
8. exact cleanup back to a zero-byte namespace

The next planned gate is Q3 default-quota rejection and atomicity. Q3 remains a separate deliberate action.

## Evidence boundary

This result does **not** establish:

- behavior above approximately 1 MiB single values
- behavior at 10 MiB quota pressure
- rejected-write atomicity (Q3)
- concurrent multi-tab write safety (later Q4)
- desktop/userscript-manager behavior
- suitability as sole Black Ledger authority
- authorization for production migration

Architecture action: **none. QUALIFIED / DISCOVERED ONLY.**
