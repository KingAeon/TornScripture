# TornPDA Storage Local Concurrency Evidence — Run 002 / Q4-L1 through Q4-L3

Status: **PASS — ordinary same-context concurrent native-storage calls**

Date: 2026-08-11

Probe: `TornPDA Storage Local Concurrency Probe v0.1.0`

Phase: `Q4-L ordinary same-context concurrency`

This file preserves the owner-provided live result from the tested Android/TornPDA environment. It is Discovery evidence only and does not authorize production migration.

## Environment

- URL: `https://www.torn.com/index.php`
- Android 16 / Samsung SM-S938U
- WebView Chrome 150.0.7871.181
- baseline usage: 0 bytes
- quota: 10,485,760 bytes
- cleanup before run: 0 keys deleted, 0 errors

## Overall result

- Q4-L1 different-key paired `set()`: 5/5 PASS
- Q4-L2 same-key paired `set()`: 5/5 PASS
- Q4-L3 disjoint paired `setMany()`: 5/5 PASS
- maximum measured JavaScript issue separation: 0.1 ms
- aborted: no
- final cleanup errors: none
- final usage: 0 bytes
- cleanup returned to baseline: yes
- overall summary pass: **true**

The probe deliberately submitted paired native-storage calls from one active execution context so Android hidden-tab scheduling was not part of the concurrency window.

Important evidence boundary: the 0 to 0.1 ms issue separation proves the JavaScript/bridge calls were submitted essentially together. It does not independently prove the exact overlap interval of Dart, sqflite, or SQLite internals.

## Q4-L1 — different-key paired set()

Five attempts, each writing two distinct approximately 256 KiB payloads.

Results across all five attempts:

- paired issue separation: 0 to 0.1 ms
- both calls fulfilled in every attempt
- both stored payloads exact in every attempt
- every expected/actual compact hash matched
- expected storage delta per attempt: 524,424 bytes
- observed storage delta per attempt: 524,424 bytes
- accounting exact in every attempt
- cleanup returned to baseline after every attempt

Total paired-await durations were 16.0 to 40.1 ms.

Q4-L1 result: **PASS**.

## Q4-L2 — same-key paired set()

Five attempts, each submitting distinct A and B payloads to the same native key.

Results across all five attempts:

- paired issue separation: 0 to 0.1 ms
- both calls fulfilled in every attempt
- final value was one complete valid payload in every attempt
- no mixed/truncated/corrupt value observed
- participant B was the final winner in all five attempts
- final hash exactly matched B's expected hash in all five attempts
- observed final accounting delta: 262,217 bytes in every attempt
- accounting exact in every attempt
- cleanup returned to baseline after every attempt

The repeated B-wins result is consistent with ordered/serialized completion for calls submitted A then B in this tested path, but five observations are not a universal ordering guarantee.

Q4-L2 result: **PASS for integrity / last-complete-writer behavior**.

## Q4-L3 — disjoint paired setMany()

Five attempts. Each side wrote four approximately 64 KiB entries, for eight independent entries per attempt.

Results across all five attempts:

- paired issue separation: 0 ms in every attempt
- both `setMany()` calls fulfilled in every attempt
- all eight entries exact in every attempt
- all expected/actual hashes matched
- no partial batch member loss
- expected storage delta per attempt: 524,848 bytes
- observed storage delta per attempt: 524,848 bytes
- accounting exact in every attempt
- cleanup returned to baseline after every attempt

Total paired-await durations were 16.5 to 22.0 ms.

Q4-L3 result: **PASS**.

## Interpretation

This is strong live evidence that TornPDA's `PDA_storage` path behaves correctly for ordinary paired writes submitted essentially simultaneously from one active JavaScript execution context:

1. independent keys remain exact
2. same-key contention resolves to one complete value rather than corruption
3. disjoint batches remain complete and exact
4. byte accounting remains exact
5. cleanup remains exact

The same-key outcome was B in all five attempts, which suggests the tested bridge/backend path preserved effective submission order strongly enough for the later-submitted value to win. This observation must not be promoted to a formal ordering contract without source-level guarantee or broader testing.

## Q4-L4 gate

The ordinary local-concurrency suite is healthy enough to justify the separately armed near-quota concurrency test. Q4-L4 remains the architecture-critical case because TornPDA source performs quota/usage checks before the final insert without an explicit namespace-wide lock visible around the full sequence.

Q4-L4 should begin with one controlled attempt only, using the untouched default 10 MiB quota and the disposable Q4-L namespace. Review the first result before any repetition.

## Evidence boundary

This result does **not** establish:

- actual simultaneous execution inside SQLite
- multi-tab hidden-WebView concurrency
- cross-device behavior
- behavior at quota pressure
- a contractual same-key ordering guarantee
- suitability as sole authority for Black Ledger
- authorization for production migration

Architecture action: **none. DISCOVERY ONLY.**
