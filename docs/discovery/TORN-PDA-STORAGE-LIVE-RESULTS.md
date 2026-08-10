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

## Run 002 — Phases B and C reload/navigation persistence

**Result:** PASS

**Observed:** 2026-08-10, immediately after Run 001 during the same TornPDA session.

**Probe version:** `0.1.0`

**Owner evidence:** three ordered screenshots plus explicit owner confirmation of the sequence: write persistence marker, perform a normal Torn page reload, then navigate through several Torn pages and return.

### Marker identity

The same persistence marker remained readable throughout the observed sequence:

- marker ID: `1786363793158-bi95tvi6`
- marker created at: `2026-08-10T12:09:53.158Z`

Observed checks showed the marker age advancing approximately:

- first post-reload screenshot: ~0 seconds
- later navigation screenshot: ~26 seconds
- final returned-page screenshot: ~51 seconds

The marker ID and original creation timestamp remained unchanged while its age increased. This distinguishes persistence from a new marker being silently created at each checkpoint.

### What Run 002 establishes

On the owner's tested TornPDA/Android environment:

- **Phase B ordinary Torn page reload: PASS**
- **Phase C normal Torn navigation: PASS**
- `PDA_storage` data remains readable after a normal page reload
- `PDA_storage` data remains readable across several Torn page changes and return navigation
- the Torn page/userscript reinjection lifecycle did not replace or lose the native persistence marker
- the persistence marker remained bound to the same installed userscript namespace throughout the observed sequence

### Evidence boundary

This run does not yet establish:

- script disable/enable persistence
- full TornPDA application restart persistence
- tab-sleep/background WebView-release persistence
- in-place userscript update persistence
- browser-cache-clear persistence
- uninstall/reinstall persistence, which is not expected under TornPDA's documented namespace lifecycle

### Gate decision

**Phase B: PASS.**

**Phase C: PASS.**

The same marker may proceed to Phase D disable/enable testing without being rewritten.

No production TornScriptures runtime change is authorized by this result.

## Run 003 — Phase D disable/re-enable persistence

**Result:** PASS

**Observed:** 2026-08-10, same installed probe and same marker as Runs 001–002.

**Probe version:** `0.1.0`

**Owner-confirmed sequence:**

1. refresh Torn several times
2. disable the installed storage probe in TornPDA
3. reload Torn and confirm the probe was absent
4. re-enable the same installed probe without deleting/reinstalling it
5. reload Torn
6. check the existing persistence marker

### Marker evidence

The same marker remained readable after re-enable:

- marker ID: `1786363793158-bi95tvi6`
- original creation time: `2026-08-10T12:09:53.158Z`
- observed marker age after re-enable: approximately **290 seconds**
- screenshot check time: `2026-08-10T12:14:42.910Z`

### What Run 003 establishes

On the owner's tested TornPDA/Android environment:

- disabling an installed userscript does not delete its tested native-storage namespace
- re-enabling the same installed script restores access to the same persistence marker
- the observed behavior matches TornPDA's documented/source lifecycle distinction between disabling a script and removing it

### Gate decision

**Phase D: PASS.**

The same marker may proceed to application-restart testing without being rewritten.

No production TornScriptures runtime change is authorized by this result.

## Run 004 — Phase E force-stop/restart with additional Android app-cache clear

**Result:** PASS for Phase E; additional cache-clear evidence recorded with scope caution

**Observed:** 2026-08-10, immediately after Run 003.

**Probe version:** `0.1.0`

**Owner-confirmed sequence:**

1. close TornPDA
2. force-stop the TornPDA Android app
3. clear the app cache
4. reopen TornPDA
5. return to Torn
6. check the existing persistence marker

### Marker evidence

The same marker remained readable after the full sequence:

- marker ID: `1786363793158-bi95tvi6`
- original creation time: `2026-08-10T12:09:53.158Z`
- observed marker age after reopen: approximately **321 seconds**
- screenshot check time: `2026-08-10T12:15:14.617Z`

The original marker identity and creation timestamp were unchanged.

### What Run 004 establishes

On the owner's tested TornPDA/Android environment:

- **Phase E TornPDA full application restart/force-stop persistence: PASS**
- native probe data remained readable after TornPDA was closed and force-stopped
- native probe data also survived the owner's additional Android app-cache-clear action during the same sequence
- the native namespace was not dependent on the ordinary WebView/page lifetime for this tested case

### Cache-clear evidence boundary

The owner described an Android app-level cache clear as part of this sequence. This is useful durability evidence, but it is not automatically promoted to **Phase H TornPDA browser-cache-clear PASS**, because the protocol specifically calls for TornPDA's normal browser-cache control and the exact cache target/action was not independently isolated here.

Therefore:

- **Phase E: PASS**
- **Android app-cache-clear combined durability: PASS for the observed sequence**
- **Phase H TornPDA browser-cache-clear: still requires the protocol-specific checkpoint or equivalent confirmed action**

### Gate decision

The backend has now passed the basic contract, normal reload, Torn navigation, disable/re-enable, and full app restart/force-stop checkpoints on the owner's device.

It may proceed to Phase F background/tab-sleep behavior. Phase H remains separately available later if useful.

No production TornScriptures runtime change is authorized by this result.
