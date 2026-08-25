# DQ-MARKET-001 — Chapter Checkpoint

Status: **OFFICIAL MARKET SOURCE LIVE PROBES COMPLETE / VERIFICATION READY**

Date: 2026-08-25

Baseline: `main` at `b29c9857bdb3cc78889a4e6cf0a633007c7b5cbc`

Stable IMM observed during this chapter: `0.19.36`

Torn OpenAPI observed during live collection: `6.12.0`

Torn OpenAPI build-time recheck: `6.13.1`

## Purpose

DQ-MARKET-001 asks what Torn's official item catalog, public Item Market API and rendered Item Market page actually represent before TornScriptures assigns market-intelligence authority to any of them.

This checkpoint records Discovery evidence only. It authorizes no runtime API polling, source replacement, valuation formula, storage change, Market Pulse implementation, trader-source integration, buying, selling, listing or accounting mutation.

## Permission boundary

Status: **LIVE PASS WITH CUSTOM-KEY NUANCE RECORDED**

Official OpenAPI describes `GET /market/{id}/itemmarket` as a Stable, globally cached endpoint requiring a Public access key.

Controlled Custom-key A/B evidence established:

- Custom level 0 without Market → `itemmarket`: Torn error 16;
- exact Market → `itemmarket` added: endpoint succeeded;
- `/key/info` then explicitly enumerated `itemmarket`;
- broad access remained `level: 0 / Custom`.

Conclusion:

TornScriptures must reason about required capabilities, not broad access level alone. This result does not override DQ-KEY-001's separate finding that some Public endpoint capability can succeed without exact endpoint-name enumeration in `/key/info`.

## Official source ownership

### Catalog `value.market_price`

Source:

`GET /v2/torn/{ids}/items`

Live-proven as an official reference value alongside item identity, circulation, shop/vendor references and equipment catalog details.

It is not a current executable Item Market floor.

### Item Market `item.average_price`

Source:

`GET /v2/market/{id}/itemmarket`

Live-proven as a distinct official Item Market reference field.

It is not interchangeable with catalog `market_price` or the currently cheapest listing.

### Current executable sell-side book

Source:

`listings[]` from `GET /v2/market/{id}/itemmarket`

Live-proven to expose individual listing rows in price order. Identical prices may appear as multiple separate rows.

For stackables, `amount` is listing quantity and must be summed separately from `_metadata.total`, which is listing-record count.

## Six-specimen disposition

| Specimen | Market structure | Main finding |
|---|---|---|
| Xanax #206 | Deep / highly active | Small low-end rows moved quickly ahead of large deeper walls; page/API strongly corresponded. |
| Panda Plushie #274 | Deep / clustered | Floor and both official reference values were tightly grouped; duplicate price rows still remained separate. |
| Cesium-137 #336 | Extremely thin / dislocated | Every current executable listing was materially above official reference values; extreme asks reached nearly $1 trillion. |
| Boxing Gloves #330 | Thin / high-value / anchored | Official reference values clustered near $449m while one-unit executable asks began at $470m; tail contained extreme asks. |
| African Violet #282 | Deep / quantity-backed floor | Hundreds of units supported the low price region; event-sensitive selection was not currently volatile. |
| Dual 92G Berettas #21 | Nonfungible equipment | UID-specific stats make equipment a different valuation problem; Item Market and catalog `type` fields use different classifications. |

The planned adaptive zero/near-zero-listing specimen was dropped after evidence saturation. The fixed six already established the source-semantic distinctions needed by this chapter.

## Reference-value findings

Across the specimens:

- catalog `market_price` and Item Market `average_price` could be close or far apart;
- the executable floor could sit above or below both reference values;
- thin markets could place all executable supply materially above the official reference values;
- a one-unit floor could be fragile while a floor backed by hundreds of units was more representative of available supply;
- raw current asks can contain enormous outliers, so naïve arithmetic over asking prices is not a safe valuation design;
- nonstackable equipment breaks simple fungible-item assumptions.

Therefore DQ-MARKET-001 does not define a single TornScriptures "true price".

## Rendered page versus API

Xanax was used for the bounded source-comparison sequence.

Live observations established:

- rendered listing rows and API listing rows strongly matched as views of the same underlying market book;
- the rendered page exposed seller identity while tested public API listing rows did not;
- natural listings and quantities changed between observations;
- repeated API calls advanced to newer `cache_timestamp` values and newer book states;
- Item Market `average_price` remained unchanged while the visible/executable book moved.

Conclusion:

The official API is a structured cached market-book source, while the rendered page provides closely related current page state with additional presentation fields. This chapter does not declare one universally superior.

## Freshness conclusion

Every captured Item Market response returned:

`cache_delay: 30`

The API demonstrably refreshed on a short timescale and tracked natural market changes.

Safe wording:

> `market:itemmarket` returned `cache_delay: 30` throughout the observed runs. API and rendered Item Market observations were strongly consistent with the same underlying listing book and the API demonstrably refreshed on short timescales. The experiment did not measure exact rendered-page-to-API propagation latency, so no exact 30-second freshness guarantee is claimed.

## Pagination provenance

A Boxing Gloves `offset=20` request occurred against a cache timestamp 90 seconds newer than the first page.

Conclusion:

Separate paginated responses must preserve snapshot provenance. Pages with different cache timestamps must not be silently presented as one atomic order book.

## Stackable versus nonstackable boundary

Stackables can be reasoned about as price/quantity supply rows.

Nonstackable equipment requires preserving at least:

- UID;
- per-instance stats;
- bonuses;
- rarity when populated;
- source-specific classification semantics.

No future market architecture should silently funnel both classes through one undifferentiated valuation contract.

## DQ-EXT-001 handoff

Official Torn source semantics are now sufficiently mapped to compare external providers without using a fuzzy definition of "Torn price."

DQ-EXT-001 should determine, for Weav3r and TornExchange at minimum:

- what each published value means;
- whether it is a sell listing, trader buy offer, historical/derived estimate or another construct;
- timestamp/freshness behavior;
- item coverage;
- failure/empty behavior;
- request/privacy contract;
- divergence from official catalog reference, Item Market average and executable book;
- suitability by TornScriptures domain rather than one universal source ranking.

No external provider is authorized as authoritative merely because its number appears closer to a selected specimen's floor.

## Market Pulse and future intelligence handoff

DQ-MARKET-001 provides current-source provenance and liquidity context, not historical trend truth.

Market Pulse #85 and Event Outlook / Inventory Equity / Value at Risk #108 still require validated history/graph behavior, event mapping, uncertainty handling and replay validation before stronger predictive language.

Current market-book data may later enrich those systems with present liquidity/depth context, but it must not substitute for historical evidence.

## Remaining questions that do not block this checkpoint

- exact rendered-page-to-API propagation latency;
- the private calculation formulas behind Torn `average_price` and catalog `market_price`;
- atomic full-book pagination guarantees, if any;
- zero-listing/empty market shape under a naturally observed specimen;
- weapon bonus/rarity populated-market examples;
- historical graph/source contracts;
- external source freshness and semantics;
- future executable-price/confidence algorithms.

These are separate Discovery questions, not blockers to the official-source semantic baseline.

## Product effect

None.

## Next governance step

Run normal `[V]` verification against the documentation branch. If verification passes, proceed later to `[R]` release gate. Neither this checkpoint nor `[R]` authorizes merge; merge remains owner-exclusive and exact-head gated.