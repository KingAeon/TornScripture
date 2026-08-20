# TornPDA Native Storage Concurrency Qualification Protocol

Status: **Age of Discovery / design before probe implementation**

Purpose: determine whether one installed TornPDA userscript can safely rely on a shared `PDA_storage` namespace when multiple top-level TornPDA tabs may write concurrently, and whether TornScriptures requires its own single-writer/lease discipline.

This protocol follows the successful Q0-Q3 qualification of availability, lifecycle durability, cross-origin continuity, ~1 MiB realistic workloads, batching, exact byte accounting, quota rejection and failed-write atomicity.

Passing Q4 does **not** authorize production migration.

## Why Q4 exists

Current TornPDA source shows `set()` performing a sequence conceptually equivalent to:

1. read old entry size
2. read namespace quota/usage
3. calculate prospective namespace size
4. read global usage
5. calculate prospective global size
6. insert/replace the value

The source does not visibly wrap that entire check-and-insert sequence in a per-namespace lock or one explicit application-level transaction.

`setMany()` similarly calculates batch delta and quota state before committing a database batch.

This does **not** prove a race exists. SQLite/sqflite serialization and connection behavior may prevent problematic interleavings in practice. Q4 exists to observe the actual TornPDA behavior rather than infer it.

## Safety boundary

Q4 must:

- use one dedicated disposable Discovery userscript namespace
- use only `ts-discovery-storage-concurrency:` keys
- never read or write IMM, ISH, WIH, Black Ledger, trader, API-key, purchase, receipt or qualification-probe data
- make no Torn API request
- perform no gameplay action
- never clear browser cache, app data or native userscript storage
- never test the 250 MiB global cap
- never alter the user's native-storage quota as part of the test
- clean all Q4 keys after each completed run
- preserve a compact JSON report without embedding large payload bodies

Near-quota testing must use only the dedicated Q4 namespace and must clean back to its initial baseline.

## Concurrency validity rule

A concurrency result is valid only if the participants actually execute their target storage calls close enough together to create a meaningful overlap opportunity.

Each participant must record at minimum:

- participant ID
- TornPDA tab UID when available
- scheduled fire time
- actual local fire timestamp
- call start timestamp
- call completion timestamp

The report must calculate the absolute difference between participant call-start timestamps.

Initial interpretation bands:

- **<= 25 ms:** strong concurrency attempt
- **26-100 ms:** usable but weaker concurrency attempt; preserve exact timing
- **> 100 ms:** inconclusive for race qualification; do not call PASS or FAIL for absence of a race

These thresholds are Discovery heuristics, not TornPDA guarantees. They may be revised after first live timing evidence.

## Coordination design

Use two top-level TornPDA tabs running the same installed Q4 probe.

The shared native namespace may be used to distribute a run plan, but target calls must be locally scheduled before the fire time so the coordination read itself is not part of the race window.

Recommended sequence:

1. Coordinator creates a run ID and a fire time several seconds in the future.
2. Both tabs join the run and write participant metadata.
3. Each tab reads and locally arms the same fire timestamp.
4. Each tab stops polling sufficiently before the fire time.
5. Both tabs execute their target operation based on the local clock.
6. Each tab writes its result/telemetry only after the target operation returns.
7. Coordinator reads both results and computes actual start separation.

If TornPDA background-tab scheduling prevents meaningful simultaneous execution, preserve that fact as a platform constraint and test with a supported mode where two WebViews remain runnable/visible if available. Do not disguise sequential execution as concurrency.

## Q4-A — simultaneous different-key writes

Goal: establish the baseline behavior of concurrent independent writes.

Both tabs simultaneously write similarly sized synthetic values to different keys.

Initial payload size: approximately 256 KiB per tab.

Verify:

- both operations resolve successfully
- both keys exist afterward
- both payload hashes match
- namespace usage equals exact expected accounting
- no unrelated key changes
- cleanup returns to baseline

A valid PASS means different-key concurrent writes behaved correctly for the observed start separation.

## Q4-B — simultaneous same-key writes

Goal: characterize last-writer behavior and detect corruption.

Both tabs simultaneously write distinct, self-identifying payloads of approximately 256 KiB to the same key.

Each payload includes:

- participant ID
- run ID
- token
- payload hash/check material

Verify:

- both calls either resolve or report exact errors
- final stored value is exactly one complete participant payload
- final value hash matches that participant's expected hash
- no mixed/corrupt payload occurs
- exact final storage accounting is correct

Expected acceptable behavior is deterministic or nondeterministic **last complete writer wins**. The protocol does not require which participant wins.

Any mixed/truncated/invalid JSON result is a critical FAIL.

## Q4-C — simultaneous batched writes

Goal: characterize concurrent `setMany()` behavior.

Each tab prepares a distinct batch, initially four approximately 64 KiB values (~256 KiB total per participant), with no overlapping keys.

Both call `setMany()` concurrently.

Verify:

- exact outcome/error from each participant
- every successful batch member exists intact
- no partial member loss within a successful batch
- usage equals exact expected accounting
- no cross-batch corruption
- cleanup returns to baseline

A later optional variant may use one intentionally overlapping key, but only if the non-overlap case is clean and the result would inform architecture.

## Q4-D — near-quota concurrent writes

Goal: determine whether concurrent writers can collectively exceed the effective per-script quota even when each independently appears allowable before the race.

This is the architecture-critical Q4 case.

### Setup

1. Start from a clean Q4 namespace with the untouched default 10 MiB quota.
2. Write a sentinel/control record.
3. Fill the namespace to a bounded level that leaves enough remaining quota for **one** participant's candidate write but not for **both combined**.
4. Verify exact accounting and all fill records before arming the race.
5. Prepare equal candidate payloads in both tabs.

Example target geometry, to be computed from live `usage()` rather than hard-coded:

```text
remaining quota > candidate A
remaining quota > candidate B
remaining quota < candidate A + candidate B
```

### Race

Both tabs call `set()` on different candidate keys at the shared fire time.

### Valid outcomes

**Safe serialized outcome:**
- one write succeeds
- the other receives `QuotaExceeded`
- final usage <= quota
- successful payload intact
- rejected key absent
- sentinel/fill records intact

**Also safe if implementation rechecks/serializes differently:**
- both reject cleanly
- usage remains <= quota
- existing data intact

### Critical failure conditions

- both writes succeed and final usage exceeds effective quota
- accounting becomes inconsistent
- existing records are changed/corrupted
- rejected write leaves partial data
- storage becomes unreadable

If both writes succeed but final usage somehow remains <= quota because actual sizes differ from the computed setup, the geometry was invalid and the run is inconclusive rather than a race PASS.

## Q4-E — recovery/cleanup verification

After every Q4 variant:

- read sentinel if present
- verify all expected surviving records
- delete every Q4-prefixed key
- call `usage()`
- confirm exact return to the pre-run namespace baseline

Never proceed from one variant to the next with unexplained usage drift.

## Repetition policy

Concurrency races are probabilistic. One clean attempt is weak evidence.

For Q4-A through Q4-C, target at least 5 valid strong-concurrency attempts if the UI/runtime permits.

For Q4-D near-quota, begin with **one** carefully controlled valid attempt. Review the first result before repeating because it creates deliberate quota pressure.

Do not automatically loop dozens or hundreds of races. The purpose is qualification, not stress or exploitation.

## Architecture interpretation

### If Q4 is clean

TornScriptures may treat TornPDA native storage as capable of multi-tab access for normal operations, while still centralizing writes through `StorageService` for schema, batching and consistency reasons.

Clean Q4 does not remove the value of application-level coordination for complex multi-record transactions.

### If ordinary concurrent writes are safe but near-quota races fail

Adopt a TornScriptures **single-writer/lease discipline** for persistent native writes or at minimum for quota-sensitive operations.

Possible future patterns include:

- one logical writer tab elected by lease
- cooperative namespace lock with expiry/recovery
- append-to-queue + one writer drains
- conservative reserved free-space margin

The exact mechanism should be designed only after observing the failure mode.

### If same-key writes can corrupt data

Do not permit unconstrained multi-tab writes to shared logical records. Single-writer coordination becomes mandatory before any production pilot.

### If TornPDA cannot schedule inactive tabs concurrently

Record the platform constraint. Q4 may be partially untestable under normal tab mode, and architecture should not assume concurrency that the runtime does not actually permit.

## Evidence capture

Preserve per attempt:

- probe version
- date/time/device/user agent
- run ID
- participant IDs and tab UIDs
- scheduled fire timestamp
- actual call-start timestamps and separation
- operation type and payload accounting bytes
- completion times
- exact result/error codes
- post-operation usage/quota
- expected/actual hashes
- survivor/sentinel integrity
- cleanup result

Do not include full synthetic payloads in reports.

## Gate decision

Q4 is complete only when the evidence is strong enough to answer the architecture question:

> Does TornScriptures need its own single-writer/lease discipline for TornPDA native persistence?

Architecture action before live evidence: **NONE. DISCOVERY PROTOCOL ONLY.**
