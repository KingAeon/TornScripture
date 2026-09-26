# Torn API Domain

Canonical detailed registry: `docs/discovery/TORN-CAPABILITY-REGISTRY.md`.

Recent Discovery anchors:

- DQ-TRAIN-001D live/source recheck: OpenAPI 6.13.6.

- DQ-KEY-001 live baseline: OpenAPI 6.11.1.
- DQ-MARKET-001 live baseline: 6.12.0.
- DQ-MARKET-001 build-time recheck: 6.13.1.

Standing maintenance lesson: on API version change, consult Torn's official changelog first, then inspect/diff only TornScriptures-relevant capabilities unless broader review is justified.

Broad access level is not sufficient permission truth for Custom keys. Preserve capability-specific behavior and exact-grant evidence without universalizing `/key/info` enumeration.

Never store raw API keys in this subtree.

DQ-TRAIN-001D adapter note (2026-09-26): bars/cooldowns/battlestats/gym/gyms/perks/refills/inventory mappings were live-proven or bounded as recorded in the training chapter. `/user/gym` and `/user/perks` retain documentation/access-label ambiguity and are treated capability-first; `/torn/gyms` remains Unstable; `/user/inventory` remains one-hour-per-category cached and planning-only for execution freshness. No runtime adapter implementation is authorized by this record.
