# TornPDA Native Storage Live Verification Results

Status: **Age of Discovery / controlled live evidence**

Capability under test: `PDA_storage`

Protocol: [`TORN-PDA-STORAGE-TEST-PROTOCOL.md`](TORN-PDA-STORAGE-TEST-PROTOCOL.md)

Probe: [`probes/TornPDA-Storage-Probe.user.js`](probes/TornPDA-Storage-Probe.user.js)

This file records owner-provided live results from the disposable TornPDA storage probe. It does not authorize a TornScriptures production storage migration.

## Run 001 — Phase A initial contract test

**Result:** PASS

**Observed at:** 2026-08-10T12:07:13.454Z

**Page:** `https://www.torn.com/item.php`

**Probe version:** `0.1.0`

**Environment reported by user agent:**

- Android 16
- Samsung SM-S938U
- TornPDA WebView (`com.manuito.tornpda`)
- Chromium/WebView 150.0.7871.181

### Native-storage availability

- `PDA_storage` detected: **YES**
- Default quota reported by `usage()`: **10,485,760 bytes (10 MiB)**
- Usage before test: **0 bytes**
- Usage after cleanup: **0 bytes**

The zero-byte post-test result supports the probe's cleanup behavior for its ordinary ephemeral keys on this run.

### Contract checks

All **11 / 11** safe checks passed:

1. `PDA_storage` availability
2. string round trip
3. nested object round trip
4. array/mixed-value round trip
5. number round trip
6. boolean round trip
7. missing-key caller default
8. `setMany` / `getMany` batch round trip
9. `loadAll` visibility of probe keys
10. `delete` removes a key
11. `list` returns the remaining probe keys

No persistence marker existed during this run.

### Measured bridge timings

These are single-run, tiny-payload observations on one device. They are useful as a baseline but must **not** be extrapolated to large datasets without later measurement.

| Operation | Observed ms |
| --- | ---: |
| set string | 1.3 |
| get string | 0.4 |
| set object | 0.9 |
| get object | 1.7 |
| set array | 2.0 |
| get array | 0.3 |
| set number | 0.7 |
| get number | 0.3 |
| set boolean | 0.7 |
| get boolean | 0.3 |
| `setMany` | 1.5 |
| `getMany` | 0.4 |
| `loadAll` | 0.4 |

Observed tiny-payload operations completed in approximately **0.3–2.0 ms** during this run.

### What Run 001 establishes

On the owner's tested TornPDA/Android environment:

- the documented native-storage bridge is available to a normal installed userscript
- JSON-serializable primitive and structured values round-trip correctly for the tested examples
- batch operations work for the tested examples
- list/load/delete/default semantics behaved as expected
- the default 10 MiB quota reported by current TornPDA source is also observed live
- the probe cleaned its ordinary test data successfully in this run
- tiny bridge operations showed no obvious performance concern

### What Run 001 does **not** establish

This run does not yet prove:

- page-reload persistence
- navigation/WebView-recreation persistence
- script disable/enable persistence
- TornPDA restart persistence
- tab-sleep/background persistence
- in-place userscript-update persistence
- browser-cache-clear persistence
- large-payload throughput or memory behavior
- quota-rejection behavior
- device migration/backup behavior
- cross-origin/cross-frame availability
- suitability as an authoritative Black Ledger store

### Gate decision

**Phase A: PASS.**

The capability may proceed to Phase B persistence-marker testing under the existing protocol.

No production TornScriptures runtime change is authorized by this result.

## Run 002 — Phase C normal Torn navigation persistence

**Result:** PASS

**Observed:** 2026-08-10, immediately after Run 001 during the same TornPDA session.

**Probe version:** `0.1.0`

**Owner evidence:** three ordered screenshots supplied from the tested Android/TornPDA environment while moving through Torn screens.

### Marker identity

The same persistence marker remained readable throughout the observed sequence:

- marker ID: `1786363793158-bi95tvi6`
- marker created at: `2026-08-10T12:09:53.158Z`

Observed checks showed the marker age advancing approximately:

- first screenshot: ~0 seconds
- second screenshot: ~26 seconds
- third screenshot: ~51 seconds

The marker ID and original creation timestamp remained unchanged while its age increased. This distinguishes persistence from a new marker being silently created at each checkpoint.

### What Run 002 establishes

On the owner's tested TornPDA/Android environment:

- `PDA_storage` data remains readable across ordinary Torn navigation for the observed sequence
- the Torn page/userscript reinjection lifecycle did not replace or lose the native persistence marker
- the persistence marker remained bound to the same installed userscript namespace during the observed navigation

### Evidence boundary

The screenshots alone do not independently prove that an explicit browser/page reload occurred before the first image. Therefore:

- **Phase C normal Torn navigation: PASS**
- **Phase B ordinary page reload: awaiting explicit owner confirmation unless separately repeated**

This distinction is intentional so navigation evidence is not silently promoted into reload evidence.

### Gate decision

The native backend may proceed to the ordinary reload confirmation and, once that is established, disable/enable persistence testing.

No production TornScriptures runtime change is authorized by this result.
