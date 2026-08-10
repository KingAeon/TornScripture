# TornPDA Cross-Origin Native Storage Evidence — Run 001 / TornExchange

Status: **PASS — Torn ↔ TornExchange top-level native namespace continuity**

Date: 2026-08-10

Probe: `TornPDA-Cross-Origin-Storage-Probe.user.js` v0.1.0

Protocol: `TORN-PDA-CROSS-ORIGIN-STORAGE-PROTOCOL.md`

This evidence records an owner-provided live run on TornPDA/Android. It establishes a platform capability only and does not authorize replacing IMM's current cross-origin capture/transport paths.

## Torn baseline

A marker was created from Torn:

- marker ID: `1786398247653-yc1yhj0i`
- createdAt: `2026-08-10T21:44:07.653Z`
- origin: `https://www.torn.com`
- href: `https://www.torn.com/gym.php`

At `2026-08-10T21:55:54.207Z`, a Torn snapshot reported:

- `nativeStorageAvailable: true`
- the same Torn marker readable unchanged
- `externalProof: null`
- usage: 183 / 10,485,760 bytes

## TornExchange proof

The owner then used the same installed probe on TornExchange rather than Weav3r.

TornExchange successfully created this external proof:

- proof ID: `1786399028606-3fiy24cy`
- writtenAt: `2026-08-10T21:57:08.606Z`
- provider: `tornexchange`
- origin: `https://tornexchange.com`
- href: `https://tornexchange.com/`
- `sawTornMarkerId: 1786398247653-yc1yhj0i`

The probe's `writeExternalProof()` contract only writes this record after:

1. `PDA_storage` is available in the external provider context,
2. the provider reads the Torn-created marker from the native namespace,
3. the provider then writes the external proof into that same native namespace.

Therefore the TornExchange proof is direct evidence that TornExchange both read from and wrote to the installed probe's TornPDA native namespace.

## Return-to-Torn proof

At `2026-08-10T21:57:45.556Z`, a new Torn snapshot reported:

- `nativeStorageAvailable: true`
- the original Torn marker still present unchanged
- the TornExchange-written external proof present unchanged
- usage: 439 / 10,485,760 bytes

This completes the bidirectional observation:

`Torn writes marker → TornExchange reads marker + writes proof → Torn reads TornExchange proof`

## Dedicated local-round-trip note

The owner did not preserve a separate TornExchange `Local round trip` report in the evidence supplied here.

That prevents claiming the exact dedicated round-trip button result from the preserved artifact. However, the provider's successful read of the Torn marker followed by a successful write of `externalProof`, and Torn's later successful read of that proof, independently establish useful top-level native read/write continuity for the tested workflow.

## Gate decision

**TornExchange top-level continuity: PASS.**

On the tested TornPDA environment, one installed userscript can use the same `PDA_storage` namespace from both `https://www.torn.com` and `https://tornexchange.com` top-level pages.

This does not yet establish:

- Weav3r continuity
- iframe/subframe continuity
- desktop userscript-manager behavior
- document-start/synchronous suitability
- latency or correctness superiority over IMM's current URL/`window.name` bridge
- authorization to change production IMM

Next provider target: Weav3r, when convenient.