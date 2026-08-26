# DQ-EXT-001

Status: ACTIVE DISCUSSION.

Central question:

> When TornScriptures receives a value from Weav3r or TornExchange, what does that value mean, how fresh/actionable is it, where did it originate, and which TornScriptures jobs is it trustworthy enough to support?

Locked owner decision:

> A numeric external trader price alone is not actionable. Surrounding pricelist state must support that the trader is actually buying the item/category and applicable conditions must be preserved.

Discussion model currently separates:

- official Torn market context;
- provider-derived market/reference context;
- trader buy quote;
- actionability metadata.

Freshness should distinguish quote freshness, pricelist freshness, and trader activity.

Source lineage must distinguish native provider data from mirrored/imported data.

Current preferred test sequence:

1. establish each provider's native contract/documented semantics;
2. use a same-trader cross-provider mirror case as a controlled lineage/propagation experiment;
3. test a native Weav3r trader and a native TornExchange trader;
4. compare against a lightweight fresh Torn baseline using the DQ-MARKET specimen set where supported;
5. end with fitness-by-purpose rather than one universal provider ranking.

Explicitly not yet authorized: best-trader formula, stale-price discount formula, runtime source replacement, provider precedence algorithm.
