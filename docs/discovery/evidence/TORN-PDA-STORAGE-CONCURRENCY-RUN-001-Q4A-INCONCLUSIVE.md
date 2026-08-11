# TornPDA Storage Concurrency Evidence — Run 001 / Q4-A

Status: **INCONCLUSIVE FOR CONCURRENCY — storage integrity PASS, scheduler separation too large**

Date: 2026-08-11

Probe: `TornPDA Storage Concurrency Probe v0.1.0`

Phase: `Q4-A simultaneous different-key writes`

This file preserves the owner-provided live result from the tested Android/TornPDA environment. The purpose of Q4-A v0.1.0 was first to prove whether two TornPDA tabs could create a meaningful concurrency window for native-storage calls.

## Environment

- URL: `https://www.torn.com/index.php`
- Android 16 / Samsung SM-S938U
- WebView Chrome 150.0.7871.181
- native storage available: yes
- default quota: 10,485,760 bytes
- baseline usage: 0 bytes

## Run

- run id: `q4a-1786419721513-17x4na`
- created: `2026-08-11T03:42:01.513Z`
- armed: `2026-08-11T03:42:05.646Z`
- scheduled fire: `2026-08-11T03:42:17.646Z`
- pre-race usage: 33,170 bytes

Participants:

- slot 0 / coordinator
  - participant: `p-1786419720466-yrhv3i73`
  - tab UID: `0b5906f5-dac5-45dc-9fe6-3aedb4472ecb`
  - target call executed while hidden / unfocused
- slot 1
  - participant: `p-1786418450599-2c9zx0uu`
  - tab UID: `6bb742b1-94aa-4c71-896d-6948859c7a57`
  - target call executed while visible / focused

## Timing

Slot 1 / visible tab:

- started `2026-08-11T03:42:17.663Z`
- fired 17 ms late
- native set duration 27.0 ms

Slot 0 / hidden tab:

- started `2026-08-11T03:42:18.341Z`
- fired 695 ms late
- native set duration 50.3 ms

Actual start separation: **678 ms**.

The Q4 protocol treats >100 ms as inconclusive. Therefore this run does not prove simultaneous multi-tab native-storage behavior.

## Storage integrity

Despite the scheduling separation, both target writes completed successfully.

Each target stored a separate approximately 256 KiB payload.

- slot 0 expected hash `0e15b82b`, actual `0e15b82b`
- slot 1 expected hash `1b5bfdbd`, actual `1b5bfdbd`
- both target records present
- both exact
- both operations successful

Accounting:

- each target accounting delta: 262,215 bytes
- expected usage before cleanup: 557,600 bytes
- observed usage before cleanup: 557,600 bytes
- accounting exact: yes

Storage-integrity result: **PASS**.

## Cleanup

- 7 Q4-A keys deleted
- cleanup errors: none
- final usage: 0 / 10,485,760 bytes
- returned to baseline: yes

## Interpretation

This is a useful negative result for the initial timer-based race harness.

The visible tab's scheduled callback ran very near the requested time, while the hidden tab's callback was delayed by approximately 695 ms. The 678 ms start separation is too large to treat the two native writes as a valid concurrency attempt.

Observed evidence on this run is consistent with background/inactive-tab JavaScript scheduling being delayed enough to defeat a timer-synchronized two-tab race. This should not yet be generalized to all TornPDA hidden-tab scheduling paths or all devices.

The result does establish that two distinct TornPDA tabs can share the same installed-script native namespace and independently write different keys with exact integrity and accounting, but not simultaneously enough to answer the backend-concurrency question.

## Q4 design implication

Do not repeat the same timer-only Q4-A method and count separated calls as concurrency evidence.

Before Q4-B/C/D, redesign the harness around a trigger that does not depend solely on hidden-tab timers, and/or introduce deterministic concurrent native bridge calls from one execution context as a separate backend-concurrency qualification.

Potential follow-up methods to evaluate before implementation:

1. a same-context `Promise.allSettled()` native-call concurrency test to establish whether the TornPDA bridge/backend can receive overlapping calls without relying on Android tab scheduling
2. a two-tab event-driven trigger such as `BroadcastChannel` if live preflight proves cross-WebView event delivery is prompt while one tab is hidden
3. preserve multi-tab scheduling behavior as its own architectural finding even if backend concurrency is tested by another method

No production data, cache controls, or TornScripture runtime behavior were touched.

Architecture action: **none. DISCOVERY ONLY.**
