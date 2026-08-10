# TornPDA Cross-Origin Native Storage Verification Protocol

Status: **Age of Discovery / controlled live verification**

Probe: [`probes/TornPDA-Cross-Origin-Storage-Probe.user.js`](probes/TornPDA-Cross-Origin-Storage-Probe.user.js)

Purpose: determine whether one installed TornPDA userscript receives access to the same `PDA_storage` namespace when executing as a top-level page on Torn, Weav3r, and TornExchange.

This is relevant because stable IMM executes on all three origins and currently uses URL/`window.name`/browser-storage handoff mechanisms for trader-price capture. A positive result does not authorize replacing those mechanisms; it only establishes a native platform capability for later architecture comparison.

## Safety boundary

The probe:

- is a separate installed userscript from the durability probe
- uses only keys beginning `ts-discovery-cross-origin-probe:`
- does not read or write IMM, ISH, WIH, Black Ledger, API-key, trader, purchase, or receipt storage
- makes no Torn API requests
- performs no gameplay actions
- stores only tiny diagnostic markers
- can delete only its own three diagnostic keys

## Target origins

- `https://www.torn.com/*`
- `https://weav3r.dev/*`
- `https://www.weav3r.dev/*`
- `https://tornexchange.com/*`
- `https://www.tornexchange.com/*`

## Phase X1 — Torn baseline

1. Install the cross-origin probe as a **new separate userscript**. Do not replace the original TornPDA storage probe.
2. Open a normal Torn page.
3. Confirm the panel reports `PDA_storage: YES`.
4. Press **Write Torn marker**.
5. Press **Local round trip**.
6. Copy the report.

Expected:

- Torn marker exists
- local round trip passes
- native storage is available

## Phase X2 — Weav3r continuity

1. Keep the same cross-origin probe installed.
2. Navigate TornPDA to a normal top-level Weav3r pricelist page used by IMM.
3. Confirm the probe panel appears.
4. Press **Check shared marker**.
5. Confirm the marker ID matches the Torn marker created in X1.
6. Press **Local round trip**.
7. Press **Write external proof**.
8. Copy the report.

Expected:

- `PDA_storage` is available on the top-level Weav3r page
- the Torn-created marker is visible unchanged
- local read/write works
- external proof records `provider: weav3r` and the Torn marker ID

If the panel does not appear, or native storage is unavailable, record that result rather than improvising a workaround.

## Phase X3 — Return-to-Torn proof

1. Return to a normal Torn page.
2. Press **Check shared marker**.
3. Copy the report.

Expected:

- original Torn marker remains present
- the external proof written on Weav3r is now visible from Torn

This bidirectional observation is stronger evidence than a one-way read alone.

## Phase X4 — TornExchange continuity

Repeat X2 using a normal top-level TornExchange prices page used by IMM, then return to Torn and confirm the external proof is visible.

Note: writing TornExchange proof will replace the single `external-proof` diagnostic record written by Weav3r. Preserve the Weav3r report before doing X4.

## Interpretation

### PASS — shared top-level namespace

A provider passes if:

- the same installed probe runs on Torn and that provider
- `PDA_storage` is available in both contexts
- a marker created on Torn is readable unchanged on the provider
- a provider-written proof is readable after returning to Torn
- local round-trip storage works on the provider

### PARTIAL

Examples:

- probe injects but native storage is unavailable
- Torn marker can be read but provider writes fail
- provider works only on one hostname variant

### FAIL / unsupported

The provider context cannot access the installed script's native namespace in a useful top-level workflow.

## Evidence boundary

A PASS establishes top-level origin continuity for this installed probe on the tested TornPDA environment. It does not automatically establish:

- cross-origin iframe/subframe behavior
- behavior in desktop userscript managers
- suitability for synchronous document-start handoffs
- lower latency than the current `window.name`/URL bridge
- transaction correctness
- authorization to remove existing IMM capture paths

## Cleanup

After all provider reports are preserved, press **Clear probe data** from any context where native storage is available. This removes only the cross-origin probe's own diagnostic keys.
