# TornPDA Cross-Origin Native Storage Evidence — Run 002 / Weav3r

Status: **PASS — bidirectional top-level namespace continuity**

Date: 2026-08-10

Capability under test: TornPDA `PDA_storage`

Probe: `TornPDA Cross-Origin Storage Probe v0.1.0`

This evidence file records the owner-provided live result for Torn ↔ Weav3r top-level native-storage continuity. It does not authorize replacing IMM's current cross-origin capture mechanisms.

## Torn baseline marker

The Torn-created marker used throughout the test was:

- marker ID: `1786398247653-yc1yhj0i`
- createdAt: `2026-08-10T21:44:07.653Z`
- origin: `https://www.torn.com`
- href: `https://www.torn.com/gym.php`

## Torn local round-trip confirmation

Before the Weav3r proof, the probe successfully completed a Torn-side native-storage round trip:

- checkedAt: `2026-08-10T22:01:22.836Z`
- origin: `https://www.torn.com`
- hostKind: `torn`
- `PDA_storage` available: yes
- round-trip pass: yes
- token written/read unchanged: `1786399282827-untg3fq9`

The snapshot also still contained the previously preserved TornExchange proof, confirming the cross-origin probe namespace remained intact before the Weav3r step.

## Weav3r proof write

At `https://weav3r.dev/travel-stock`, the same installed probe reported:

- `PDA_storage` available: yes
- Torn marker visible unchanged: `1786398247653-yc1yhj0i`
- external proof written successfully
- proof ID: `1786399311859-hkgz636f`
- provider: `weav3r`
- proof origin: `https://weav3r.dev`
- proof href: `https://weav3r.dev/travel-stock`
- `sawTornMarkerId`: `1786398247653-yc1yhj0i`

This establishes that the Weav3r top-level context could read the marker originally written from Torn and then write a new record into the same installed userscript namespace.

## Weav3r local round trip

Owner then ran the dedicated local round-trip test on Weav3r:

- checkedAt: `2026-08-10T22:03:31.877Z`
- origin: `https://weav3r.dev`
- hostKind: `weav3r`
- `PDA_storage` available: yes
- result: **PASS**
- token: `1786399411871-iyvfuaeu`
- expected and actual values matched exactly
- Torn marker still visible unchanged
- Weav3r external proof still visible unchanged

Observed native-storage usage during this report: 598 bytes of a 10,485,760-byte quota.

## Return-to-Torn proof

After returning to Torn, the owner captured a manual snapshot at `2026-08-10T22:03:55.736Z`.

The Torn context reported:

- `PDA_storage` available: yes
- original Torn marker still present: `1786398247653-yc1yhj0i`
- Weav3r proof readable unchanged: `1786399311859-hkgz636f`
- proof provider: `weav3r`
- proof origin: `https://weav3r.dev`
- `sawTornMarkerId`: `1786398247653-yc1yhj0i`

This is the required return-path evidence that data written from Weav3r is visible again from Torn through the same installed probe namespace.

## Gate decision

**Weav3r cross-origin continuity: PASS.**

The owner-provided sequence establishes all protocol requirements for the tested top-level Weav3r context:

1. the same installed userscript ran on Torn and Weav3r
2. `PDA_storage` was available in both contexts
3. Weav3r read the Torn-created marker unchanged
4. Weav3r completed an independent native-storage write/read round trip
5. Weav3r wrote an external proof tied to the Torn marker
6. Torn subsequently read that Weav3r-written proof unchanged

Together with Run 001 / TornExchange, this establishes live-verified top-level native-storage continuity across the three current IMM execution environments tested so far: Torn, TornExchange, and Weav3r.

## Evidence boundary

This result does **not** establish:

- cross-origin iframe/subframe bridge availability
- desktop userscript-manager behavior
- suitability for synchronous `document-start` handoffs
- lower latency or greater correctness than IMM's current URL/`window.name` bridge
- authorization to remove or replace existing IMM capture paths
- suitability for Black Ledger authoritative storage

Architecture action: **none. DISCOVERED ONLY.**
