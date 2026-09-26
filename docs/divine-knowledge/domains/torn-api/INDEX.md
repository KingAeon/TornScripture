# Torn API Domain

Canonical detailed registry: `docs/discovery/TORN-CAPABILITY-REGISTRY.md`.

Recent Discovery anchors:

- DQ-TRAIN-001D recheck 2026-09-25: OpenAPI **6.13.6**.

- DQ-KEY-001 live baseline: OpenAPI 6.11.1.
- DQ-MARKET-001 live baseline: 6.12.0.
- DQ-MARKET-001 build-time recheck: 6.13.1.

Standing maintenance lesson: on API version change, consult Torn's official changelog first, then inspect/diff only TornScriptures-relevant capabilities unless broader review is justified.

Broad access level is not sufficient permission truth for Custom keys. Preserve capability-specific behavior and exact-grant evidence without universalizing `/key/info` enumeration.

Never store raw API keys in this subtree.

Training Adapter note (2026-09-25): current `/user/bars`, `/user/cooldowns`, `/user/battlestats`, `/user/inventory`, `/user/gym`, `/user/perks`, `/user/refills`, and `/torn/gyms` contracts were rechecked for DQ-TRAIN-001D. `/user/gym` and `/user/perks` still have description/key-parameter access mismatches; `/torn/gyms` remains Unstable; `/user/inventory` remains one-hour-per-category cached. See `../../chapters/dq-train-001/ADAPTER-SOURCE-MAP-001D.md`. No runtime change is authorized by this recheck.
