# Source Map

## Official Torn

Detailed capability registry: `docs/discovery/TORN-CAPABILITY-REGISTRY.md`.

Relevant current-market sources:

- `/torn/{ids}/items` — catalog identity/reference values/circulation/details.
- `/market/{id}/itemmarket` — Item Market average, listing rows, quantity, cache provenance, nonstackable per-instance data.
- rendered Item Market — closely related book presentation and seller identity not exposed in tested API rows.

## External trader providers

- Weav3r — DQ-EXT-001 semantics/freshness/actionability under study.
- TornExchange — DQ-EXT-001 semantics/freshness/actionability under study.

Do not call a trader quote `market truth` without preserving its source role.

## Platform transport

TornPDA native cross-origin storage continuity across Torn / TornExchange / Weav3r is live-proven for tested top-level contexts. Transport proof is not data-quality proof.
