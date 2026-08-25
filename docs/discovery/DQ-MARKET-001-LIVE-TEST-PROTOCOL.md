# DQ-MARKET-001 — Live Official Market Source Protocol

Status: **DISCOVERY PROTOCOL / LIVE RUN COMPLETE / NO PRODUCT MUTATION**

Date: 2026-08-25

Baseline branch point: `main` at `b29c9857bdb3cc78889a4e6cf0a633007c7b5cbc`

Observed Torn OpenAPI during the live run: `6.12.0`

Build-time Torn OpenAPI recheck: `6.13.1`

Companion documents:

- `DQ-MARKET-001-OFFICIAL-SOURCE-MATRIX.md`
- `evidence/DQ-MARKET-001-PERMISSION-AB-RUN-001.md`
- `evidence/DQ-MARKET-001-MARKET-SPECIMENS-RUN-001.md`
- `DQ-MARKET-001-CHECKPOINT-2026-08-25.md`

## Purpose

Determine what the official Torn item-catalog and Item Market sources actually mean before TornScriptures uses them for stronger market intelligence.

The protocol separates three concepts that must not be assumed equivalent:

1. catalog `value.market_price` from `GET /v2/torn/{ids}/items`;
2. Item Market `item.average_price` from `GET /v2/market/{id}/itemmarket`;
3. the currently executable sell-side book represented by Item Market listing rows.

It also records permission behavior, cache provenance, page/API correspondence, stackable versus nonstackable listing shape, and market-depth limitations.

## Safety and scope rules

1. Discovery only. No userscript or product behavior changes are authorized.
2. No automatic buying, selling, listing, accepting, repricing, or money movement.
3. Prefer natural market movement. Do not manufacture transactions merely to force a price change.
4. Do not retain raw API keys, generated authorization headers, or Swagger curl commands.
5. Record sanitized `/key/info` capability evidence only when permission behavior is under test.
6. Keep raw observations separate from derived interpretation.
7. Do not call a source real-time or claim exact propagation latency without a near-simultaneous controlled measurement.
8. A request `timestamp` value is used only to make otherwise-identical requests unique and bypass applicable ordinary service-cache reuse. It does not force Torn's globally cached Item Market source to regenerate.
9. Pagination calls made against different `cache_timestamp` values must not be represented as one atomic order-book snapshot.
10. No external providers are assessed in this chapter.

## Official sources under test

### A. Specific Torn item catalog

Endpoint:

`GET /v2/torn/{ids}/items`

Capture:

- item ID and name;
- catalog `type` and `sub_type`;
- tradability;
- `value.market_price`;
- `value.buy_price` and `value.sell_price` where present;
- vendor/shop references where relevant;
- circulation;
- whether equipment `details` are populated.

The catalog response is a reference/enrichment source. It is not assumed to be a live executable listing book.

### B. Public Item Market

Endpoint:

`GET /v2/market/{id}/itemmarket`

Use a bounded first-page sample with `limit=20`, `offset=0`, and a unique request `timestamp` value for repeated calls.

Capture:

- `item.id`;
- `item.name`;
- Item Market `item.type`;
- `item.average_price`;
- raw listing rows in returned order;
- stackable `price` and `amount`;
- nonstackable `item_details` including UID, stats, bonuses and rarity when present;
- `cache_timestamp`;
- `cache_delay` when present;
- `_metadata.total`;
- pagination links.

Do not aggregate identical-price rows in the evidence record. Derived price-level aggregation may be calculated later, but the original listing rows are the source observation.

### C. Rendered Torn Item Market page

Use a rendered-page observation only when it answers a source-semantic or freshness question that the API alone cannot close.

Capture:

- local observation time;
- visible floor price and quantity;
- several visible rows sufficient to compare with the API;
- seller identity only as evidence that the page carries a field omitted by the API;
- no unnecessary personal information.

The rendered page is not automatically declared superior or inferior to the API.

## Permission A/B protocol

Goal: determine whether a Custom key that is broad level 0 can call the official Public-tier Item Market endpoint without explicitly granting the Market `itemmarket` capability.

A-side:

1. Use a narrow Custom key where `/key/info` shows Market selections without `itemmarket`.
2. Call `GET /v2/market/206/itemmarket`.
3. Record success or Torn error only.

B-side:

1. Add exactly Market → `itemmarket` to the same Custom-key capability set while retaining Torn → `items` for catalog work.
2. Confirm `/key/info` now enumerates `itemmarket` under Market selections.
3. Retry `GET /v2/market/206/itemmarket`.
4. Record success or failure.

Pass condition:

A/B behavior clearly establishes whether exact selection presence matters for this Custom key. Do not generalize that behavior to all Public endpoints because DQ-KEY-001 already observed a Public faction-members endpoint succeeding without `members` being enumerated in `/key/info`.

## Specimen basket

The live run uses six deliberately different market structures:

1. Xanax #206 — deep/high-liquidity and naturally active.
2. Panda Plushie #274 — ordinary deep stackable control.
3. Cesium-137 #336 — extremely thin material market.
4. Boxing Gloves #330 — thin high-value booster market.
5. African Violet #282 — travel/event-sensitive stackable with meaningful depth.
6. Dual 92G Berettas #21 — nonstackable equipment specimen with UID/stat-specific listings.

A seventh zero/near-zero-listing adaptive specimen was considered but not required once the six fixed specimens produced distinct market behaviors and the chapter reached evidence saturation.

## Static comparison method

For each specimen:

1. Preserve the catalog `market_price` and circulation snapshot.
2. Query the Item Market first page.
3. Record `average_price`, current floor, listing-record count and raw listing rows.
4. For stackables, distinguish listing-row count from summed unit quantity.
5. Note whether the lowest price is backed by one/few units or meaningful quantity.
6. Preserve obviously extreme asks as evidence rather than deleting them from the raw observation.
7. Do not define a future valuation formula from the specimen alone.

## Xanax rendered/API comparison

Xanax is the bounded page/API specimen because natural market movement was frequent enough to reveal row changes without manipulating the market.

Protocol:

1. Capture an API snapshot and its `cache_timestamp`/`cache_delay`.
2. Observe the rendered page several minutes later and compare visible listing rows.
3. Re-query the API with a unique request `timestamp`.
4. Re-observe the rendered page.
5. Re-query again to prove that the API book itself advances over time.

Interpretation rule:

The sequence may establish that the page and API represent the same underlying listing book and that the API refreshes on a short timescale. It does not establish exact page-to-API propagation latency unless the two sources are observed closely enough to isolate cache lag from ordinary trades/listing changes.

## Pagination rule discovered during Boxing Gloves

The first Boxing Gloves page returned 20 of 21 listing records. A follow-up call at `offset=20` returned the final listing, but its `cache_timestamp` differed from the first page by 90 seconds.

Therefore:

- both observations are valid evidence of market shape and extreme asks;
- they must not be reconstructed or described as one exact 21-row atomic book;
- future full-book collection that depends on atomic consistency must require matching snapshot provenance or otherwise represent pages as separate observations.

## Stop condition

Stop live collection when the selected specimens have demonstrated materially distinct source behaviors and additional ordinary specimens would mostly repeat existing evidence.

DQ-MARKET-001 reached that condition after the six fixed specimens.

## Explicit non-goals

This protocol does not define:

- a TornScriptures executable-price formula;
- outlier-trimming thresholds;
- depth-weighted valuation rules;
- market confidence scores;
- historical-price storage;
- Market Pulse signals;
- event forecasts;
- inventory equity or Value at Risk;
- Weav3r or TornExchange source contracts;
- trader offer semantics;
- Bazaar pricing;
- automated polling cadence.

Those require separate Discovery/specification after this source baseline is recorded.

## Product effect

None.