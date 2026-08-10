# TornPDA Native Storage Qualification Protocol

Status: **Age of Discovery / controlled live verification**

Purpose: move beyond basic `PDA_storage` availability/durability and qualify the behaviors TornScriptures would actually depend on before any production storage architecture is designed.

Probe: [`probes/TornPDA-Storage-Qualification-Probe.user.js`](probes/TornPDA-Storage-Qualification-Probe.user.js)

This protocol is documentation/research only. Passing it does **not** authorize a TornScriptures runtime migration.

## Why this phase exists

The first storage probe established that TornPDA native storage is available, survives major browser/WebView lifecycle events on the tested Android environment, and remains available across Torn, TornExchange, and Weav3r top-level contexts.

That is not enough to design a storage layer.

The next questions are engineering questions:

- how read/write latency scales with payload size;
- whether record-heavy JSON behaves differently from one large scalar/blob-like value;
- whether the app-reported byte accounting matches predictable UTF-8 JSON size, including multibyte Unicode text;
- whether batch operations behave as documented and are useful for TornScriptures workloads;
- whether cleanup reliably returns the namespace to baseline;
- whether quota rejection leaves previously valid records untouched;
- whether an over-quota `setMany()` is all-or-nothing from the userscript's point of view;
- what concurrency risks remain before multiple TornPDA tabs may write the same namespace.

## Source-derived storage contract relevant to this phase

Current TornPDA source (`lib/utils/script_storage.dart`) shows:

- values are JSON-encoded and stored as TEXT in SQLite;
- stored byte accounting is UTF-8 bytes of the key plus UTF-8 bytes of the JSON-encoded value;
- default per-script quota is 10 MiB;
- user-adjustable maximum per-script quota is 50 MiB;
- global native-userscript-storage cap is 250 MiB;
- `set()` computes the prospective namespace/global size before inserting;
- `setMany()` JSON-encodes the whole requested object, computes the total delta, performs quota checks, then commits a SQLite batch;
- `getMany()` is implemented by iterating requested keys through the single-key read path;
- quota failures are returned as `QuotaExceeded` or `GlobalQuotaExceeded` and are surfaced to JavaScript as thrown errors by the TornPDA bridge;
- the source does not show a dedicated operation-level lock or transaction spanning each quota-check/read calculation and later individual `set()` insert. This is an **inference requiring later concurrency testing**, not a confirmed bug.

Current TornPDA settings also expose per-script native-storage quota adjustment from 10 MiB up to 50 MiB. This qualification intentionally uses the default 10 MiB namespace unless a result explicitly says otherwise.

TornPDA's maintained `PDA_storage` developer guide independently recommends load-once/batched-write patterns because every native operation crosses the WebView/app bridge. Its own optional quota test fills a disposable script namespace with 1 MiB chunks until `QuotaExceeded`, then deletes them. The TornScriptures qualification uses the same documented error contract but stops around 80% before constructing bounded rejection cases, so it can test atomicity without blindly filling to the cap.

## Safety boundary

The qualification probe:

- is a separate disposable userscript with its own immutable TornPDA storage namespace;
- matches only normal Torn top-level pages for this phase and exits immediately in subframes;
- uses only keys beginning `ts-discovery-storage-qualification:`;
- never reads or writes IMM, ISH, WIH, Black Ledger, API-key, trader, purchase, receipt, or prior probe keys;
- makes no Torn API requests;
- performs no gameplay action;
- generates only synthetic data;
- deletes large synthetic values after each scaling case;
- automatically stops the scaling run if a storage operation fails or becomes abnormally slow;
- keeps quota testing behind a separate explicit button and a second confirmation press within a 30-second arm window;
- refuses the v0.1.0 quota test unless the new probe namespace reports the untouched 10 MiB default quota;
- never tests TornPDA's 250 MiB global cap;
- never asks the owner to clear browser cache, app data, native userscript storage, or production data.

### Destructive-test rule

Following the Phase H IMM local-state loss, no future cache/site/app/native-storage destructive test may proceed unless all potentially affected production TornScriptures data is independently backed up or the test runs in an isolated disposable environment.

This qualification phase does not require any such destructive platform control.

## Phase Q0 — Preflight

Before either benchmark:

1. Disable the earlier Discovery panels if they obstruct the qualification probe. Do not delete them merely to make room.
2. Install the qualification probe as a new userscript.
3. Open a normal Torn page.
4. Confirm the panel reports `PDA_storage: YES`.
5. Press **Preflight**.
6. Confirm `bridgeReady: true` and the reported quota is the new probe's default 10 MiB (`10485760` bytes).

If native storage is unavailable, the bridge reports no usable quota, or the quota differs unexpectedly, stop and preserve the preflight report.

## Phase Q1 — Shape-aware scaling benchmark

The probe runs bounded synthetic cases, cleaning each large value before advancing.

### Payload classes

**Unicode text**

A bounded synthetic text payload containing emoji, accented Latin text, Japanese characters, typographic quotes and apostrophes. This is a small accounting-control case proving that TornScriptures' browser-side `TextEncoder` expectation agrees with TornPDA's UTF-8 accounting for multibyte text, not just ASCII.

**Blob-like**

A small metadata object containing one large ASCII data field. This minimizes object count and helps isolate bridge/SQLite throughput from object-heavy JSON traversal.

**Ledger-like**

An array of synthetic IMM-style purchase-lot records with realistic fields such as item identity, quantities, unit cost, expected profit, timestamps, URLs, funding source, capture method, status and notes. No real owner transactions are copied into the probe.

**History-like**

An array of many smaller observation-style records intended to create higher object/key count for a similar serialized byte size.

### Initial sizes

v0.1.0 intentionally starts conservatively:

- approximately 64 KiB Unicode accounting control;
- blob-like values at approximately 64 KiB, 256 KiB and 1 MiB;
- ledger-like values at approximately 64 KiB, 256 KiB and 1 MiB;
- one history-like value at approximately 1 MiB.

The point is to establish scaling behavior before deciding whether 2–4 MiB single-value tests are useful. Larger single-value testing is **not automatically required**.

### Measurements per case

The probe records:

- payload class;
- target bytes and actual JSON UTF-8 bytes;
- record count where relevant;
- key UTF-8 bytes;
- expected TornPDA accounting delta (`key bytes + JSON value bytes`);
- synthetic payload generation time;
- JSON stringify time;
- `PDA_storage.set()` duration and approximate MiB/s;
- observed `usage()` delta after write;
- whether observed byte accounting equals expected byte accounting exactly;
- `PDA_storage.get()` duration and approximate MiB/s;
- exact serialized round-trip equality;
- expected/actual compact hashes;
- verification/stringification duration;
- `loadAll()` duration for selected largest cases;
- delete duration;
- whether usage returns exactly to the per-run control baseline after deletion.

A small control/sentinel record remains present while the large cases come and go. It is checked between cases so a large write cannot silently mutate unrelated data and still receive a PASS.

### Automatic stop conditions

The scaling run aborts and cleans its own namespace if:

- the qualification namespace cannot first be cleaned reliably;
- the native bridge reports no usable quota;
- a write/read/delete throws;
- round-trip verification fails;
- byte accounting is inconsistent;
- the control record changes;
- cleanup does not return to control baseline;
- a measured storage bridge operation exceeds the probe's conservative 5-second slow-operation threshold.

An abort is evidence, not something to work around during the same run.

## Phase Q2 — Batch profile

After Q1 cases pass, the same run compares an approximately 1 MiB total workload split into four approximately 256 KiB values using:

- one `setMany()` native call;
- one `getMany()` native call;
- exact verification of every entry;
- cleanup by key.

The batch report records total serialized/accounted bytes, write/read duration and approximate throughput, exact round-trip verification for every entry, usage delta, and cleanup return-to-baseline.

This is particularly relevant because TornPDA recommends batching native calls, while `getMany()` internally still performs per-key database reads inside one native handler invocation.

A batch PASS means only that the tested workload behaved correctly and measurably. It does not imply that TornScriptures should store every dataset in many chunks.

## Phase Q3 — Default-quota rejection and atomicity

Quota testing is a **separate explicit action after Q1/Q2 results are reviewed**.

The v0.1.0 quota test is designed around a fresh default 10 MiB qualification namespace. The first press only arms Q3 for 30 seconds; a second press during that window is required to begin allocation.

### Procedure performed by the probe

1. Clean stale qualification keys and refuse to continue if cleanup reports an error.
2. Record baseline usage and quota.
3. Refuse to run unless the effective quota is exactly the untouched 10 MiB default.
4. Write a small sentinel/control record.
5. Fill the disposable namespace to roughly 80% of its reported quota using bounded synthetic chunks of at most about 1 MiB each.
6. Verify exact source-contract byte accounting for every successful fill chunk.
7. Record pre-failure usage.
8. Attempt one additional value whose calculated encoded size exceeds the remaining namespace quota by a modest margin, while enforcing a 3 MiB single-rejection safety ceiling.
9. Expect JavaScript error code `QuotaExceeded`.
10. Verify:
   - the rejected key does not exist;
   - namespace usage did not increase;
   - the sentinel is unchanged;
   - previously successful fill records remain readable and structurally intact.
11. Attempt a two-entry `setMany()` where each individual member is smaller than the remaining free space but the combined batch exceeds it.
12. Expect `QuotaExceeded` and verify **neither** batch key was inserted.
13. Verify sentinel and fill records again.
14. Delete all qualification keys.
15. Confirm namespace usage returns exactly to the initial clean baseline.

### Guardrails

The quota action refuses or stops rather than scaling indefinitely if the namespace quota is unexpected. v0.1.0 qualifies only the normal 10 MiB default, not a 50 MiB override.

The global 250 MiB cap is explicitly **not tested**. Filling hundreds of megabytes for Discovery would provide little product value and unnecessary device risk.

## Phase Q4 — Multi-tab/concurrent-write qualification (later)

Do not fold concurrency into the first large-payload run.

Current source suggests a question worth controlled testing: quota calculations and individual writes are not visibly enclosed by one per-namespace lock/transaction across the entire check-and-insert sequence.

Later tests should separately examine:

- simultaneous writes to different keys;
- simultaneous writes to the same key;
- integrity after concurrent multi-tab activity;
- whether concurrent near-quota writers can both pass stale quota checks;
- whether usage can temporarily or persistently exceed the effective quota;
- whether a confirmed race should be reported upstream to TornPDA before TornScriptures relies on concurrent writers.

No quota-race exploit is included in v0.1.0.

## Initial qualification gate

Before `PDA_storage` is considered technically qualified for a first non-critical TornScriptures storage pilot, the tested environment should show:

- Q0 usable native bridge and expected default quota;
- exact UTF-8 accounting for the Unicode control;
- correct Q1 scaling behavior through at least ~1 MiB realistic record-heavy payloads;
- exact payload round-trip integrity;
- byte accounting consistent with the source contract;
- unrelated control data remaining unchanged;
- cleanup returning to baseline;
- acceptable measured bridge/database latency for the tested payload classes;
- Q2 batch operations behaving correctly;
- Q3 quota rejection leaving existing records unchanged;
- Q3 failed `setMany()` showing no partial insertion;
- no unexplained storage mutation.

Even a full PASS does **not** qualify native storage as sole Black Ledger authority and does **not** authorize a production migration.

## Evidence capture

The probe report must remain compact. It must not copy synthetic megabyte payloads into the report.

For each run preserve:

- probe version;
- date/time;
- device/user agent;
- URL;
- reported quota;
- per-case actual bytes and record counts where relevant;
- timings/throughput;
- verification results/hashes;
- usage deltas;
- cleanup result;
- failure codes where expected;
- abort reason, if any.

Owner-pasted JSON is preferred so exact numbers can be committed into `docs/discovery/evidence/`.

## Architecture action

None. **DISCOVERED / QUALIFIED ONLY.**
