# TornPDA Storage Local Concurrency Evidence — Run 003 / Q4-L4

Status: **PASS — near-quota concurrent calls resolved safely**

Date: 2026-08-11

Probe: `TornPDA Storage Local Concurrency Probe v0.1.0`

Phase: `Q4-L4 same-context near-quota concurrent writes`

This file preserves the owner-provided live result from the tested Android/TornPDA environment. It is Discovery evidence only and does not authorize production storage migration.

## Baseline

- cleanup before run: 0 keys deleted, 0 errors
- baseline usage: 0 bytes
- quota: 10,485,760 bytes (10 MiB)

A sentinel/control record was written before quota pressure.

## Fill and geometry

The probe filled its own disposable namespace with exact accounting:

- eight fill operations at 1,048,576 bytes each
- one final fill operation at 524,020 bytes
- every fill operation matched expected byte accounting exactly

Immediately before the candidate race:

- used: 8,912,812 bytes
- remaining: 1,572,948 bytes
- candidate A accounting delta: 1,048,632 bytes
- candidate B accounting delta: 1,048,632 bytes
- combined candidate delta: 2,097,264 bytes

Required geometry held:

```text
remaining > candidate A
remaining > candidate B
remaining < candidate A + candidate B
```

Therefore either candidate fit individually, but both could not fit together without exceeding the 10 MiB namespace quota.

## Concurrent candidate calls

The two `PDA_storage.set()` calls were submitted from one active execution context.

- issue separation: 0.1 ms
- issuance window: 0.1 ms
- total await time: 59.5 ms

Outcome:

- candidate A: fulfilled
- candidate B: rejected with `QuotaExceeded`
- rejected error prospective used value: 11,010,076 bytes
- quota reported in error: 10,485,760 bytes

The successful candidate was exact. The rejected candidate was absent.

Post-race usage:

- 9,961,444 / 10,485,760 bytes

The namespace remained below quota.

## Integrity

- successful candidate exact: yes
- rejected candidate absent: yes
- critical over-quota condition: no
- critical corruption: no
- sentinel intact: yes
- all fill records intact: yes

This is the safe serialized/rechecked outcome defined by the protocol.

## Cleanup

- 11 Q4-L keys deleted
- cleanup errors: none
- final usage: 0 / 10,485,760 bytes
- returned to baseline: yes

## Interpretation

Q4-L4 provides strong live evidence that, on the tested TornPDA environment, two near-simultaneously submitted same-context native-storage writes do not both pass stale quota checks and drive the namespace over its configured 10 MiB limit.

The observed behavior was effectively safe serialization/rechecking: one write committed, then the competing write observed the resulting quota state and failed cleanly with `QuotaExceeded`.

Combined with Q4-L1/L2/L3, the same-context concurrency qualification now shows:

1. different-key paired writes behaved correctly across five attempts
2. same-key paired writes produced one complete final value with no corruption across five attempts
3. disjoint concurrent `setMany()` batches remained complete and exact across five attempts
4. near-quota paired writes preserved the quota invariant and existing data
5. cleanup returned exactly to a zero-byte namespace

## Architecture implication

Current evidence does **not** justify imposing a TornScriptures single-writer/lease mechanism solely to protect ordinary `PDA_storage` writes or per-script quota enforcement on this tested path.

A centralized TornScriptures `StorageService` remains recommended for schema ownership, batching, migrations, logical transactions, integrity checks, backup/export, and policy. Application-level coordination may still be necessary for higher-level multi-record invariants or if future true multi-WebView evidence reveals behavior not reproduced by same-context paired calls.

The earlier Q4-A two-tab timer test remains inconclusive for true simultaneous multi-tab execution because the hidden tab fired 678 ms after the visible tab. That scheduling constraint is separate from the backend/API concurrency result established here.

No production data, gameplay state, browser cache, user quota setting, or TornScripture runtime behavior was changed.

Architecture action: **DISCOVERY RESULT — ordinary same-context native concurrency qualified; no mandatory single-writer lease indicated by current evidence.**
