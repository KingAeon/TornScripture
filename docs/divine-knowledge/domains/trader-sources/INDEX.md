# Trader Sources Domain

Active chapter: **DQ-EXT-001**.

Providers under study: Weav3r and TornExchange.

Locked decision: a numeric trader quote alone is not actionable. Buying state, item/category support, and applicable conditions must support the quote.

Distinguish at least:

- trader buy quote;
- provider-derived market/reference value;
- quote freshness;
- pricelist freshness;
- trader activity;
- provider/source lineage;
- availability/exclusion/bulk conditions.

Known platform fact: TornPDA top-level native `PDA_storage` continuity was live-proven across Torn, TornExchange, and Weav3r. This establishes transport capability only, not price correctness/freshness.

Issue #78 depends on this domain's eventual freshness/availability conclusions.
