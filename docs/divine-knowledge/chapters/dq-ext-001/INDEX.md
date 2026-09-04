# DQ-EXT-001

Status: ACTIVE DISCUSSION.

Central question:

> When TornScriptures receives a value from Weav3r or TornExchange, what does that value mean, how fresh/actionable is it, where did it originate, and which TornScriptures jobs is it trustworthy enough to support?

Locked owner decision:

> A numeric external trader price alone is not actionable. Surrounding pricelist state must support that the trader is actually buying the item/category and applicable conditions must be preserved.

## Progress

- **DQ-EXT-001A — Native Contract Audit:** completed. Provider-native price, freshness, activity, bulk/condition, and lineage semantics were mapped far enough to support live testing.
- **DQ-EXT-001B — Contract Falsification:** evidence-saturated enough to close. Adversarial tests separated numeric price existence from actionability and separated provider refresh state from trader/source freshness.
- **DQ-EXT-001C — Synchronized Official-vs-External Specimen Comparison:** next active step.

## High-confidence observations from 001A/001B

- Weav3r Search Deals can suppress an item-specific excluded buyer even when that trader's public pricelist still contains a numeric value for the item. In the controlled check, the same trader appeared for supported Xanax but not excluded Cesium-137.
- TornExchange `Prices last updated` behaves as provider/reference refresh evidence, not trader-edit freshness. Unrelated trader pages reset within seconds of one another while their `Last trade` ages differed substantially.
- A downstream provider refresh timestamp must not be used as the freshness timestamp of a mirrored source quote.
- TornExchange documents VladBull as a Weav3r-derived mirror. In a near-simultaneous sample, Panda Plushie, African Violet, Xanax, and Boxing Gloves prices matched Weav3r exactly, while provider metadata/timestamps/ratings remained independent.
- Numeric quote, trader activity, provider discovery eligibility, quantity/bulk conditions, exclusions, and source lineage are separate signals.
- Generic item-level equipment quotes must not be silently interpreted as UID-specific equipment valuation.

These observations are based on the 2026-08-27 provider-document review and owner-observed live tests. They are Discovery evidence, not a runtime precedence algorithm.

## Current model

Keep separate:

- official Torn market context;
- provider-derived market/reference context;
- trader buy quote;
- quote conditions and exclusions;
- provider reference freshness;
- source/mirror freshness when known;
- trader activity;
- discovery eligibility;
- source lineage;
- actionability conclusion.

Unknown freshness remains unknown rather than being inferred from another clock.

## DQ-EXT-001C next test

Use the familiar six DQ-MARKET specimens where supported:

1. Xanax
2. Panda Plushie
3. African Violet
4. Boxing Gloves
5. Cesium-137
6. Dual 92G Berettas

Capture a lightweight synchronized official Torn context (catalog `market_price`, Item Market `average_price`, executable low end/depth, cache timing) alongside external quote context (provider/trader, numeric quote, lineage, activity, eligibility, conditions/exclusions, mirror/native state, freshness known/unknown).

The goal is to compare meaning against meaning and then produce a fitness-by-purpose matrix, not crown one universal provider winner.

Explicitly not yet authorized: best-trader formula, stale-price discount formula, runtime source replacement, provider precedence algorithm.
