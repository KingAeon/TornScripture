# DQ-MARKET-001 — Official Torn Market Source Matrix

Status: **LIVE SOURCE SEMANTICS VERIFIED / DISCOVERY ONLY**

Date: 2026-08-25

Baseline branch point: `main` at `b29c9857bdb3cc78889a4e6cf0a633007c7b5cbc`

Observed Torn OpenAPI during live collection: `6.12.0`

Build-time OpenAPI recheck: `6.13.1`

## Purpose

Map what each official Torn market-related source owns and prevent TornScriptures from collapsing unlike concepts into a generic `price` field.

The central finding is that catalog reference value, Item Market average value, and current executable asking prices are related but not interchangeable.

## Source ownership matrix

| Information | Official source | Live status | Meaning / limitation |
|---|---|---|---|
| Item identity | `/torn/{ids}/items`, `/market/{id}/itemmarket` | Verified | IDs/names align for tested items. |
| Catalog classification | `/torn/{ids}/items` | Verified | `type`/`sub_type` describe catalog classification. Do not overwrite with Item Market `type`. |
| Catalog market reference | `/torn/{ids}/items` → `value.market_price` | Verified | Reference market value. Not a current executable ask. |
| Vendor/shop reference | `/torn/{ids}/items` → `value.vendor`, `value.shops`, buy/sell fields | Verified | Separate economic reference. Must not be collapsed into market price. |
| Circulation | `/torn/{ids}/items` → `circulation` | Verified | Total circulation reference, not current market supply. |
| Item Market average | `/market/{id}/itemmarket` → `item.average_price` | Verified | Distinct reference field. Live specimens prove it can differ materially from both catalog `market_price` and current floor. |
| Current listing price | `/market/{id}/itemmarket` → `listings[].price` | Verified | Current asking price inside Torn's globally cached Item Market snapshot. |
| Stackable listing amount | `/market/{id}/itemmarket` → `listings[].amount` | Verified | Units in one listing row. Must be summed separately for unit depth. |
| Listing-record count | `/market/{id}/itemmarket` → `_metadata.total` | Verified | Number of listing records, not total item quantity. |
| Cache provenance | `/market/{id}/itemmarket` → `cache_timestamp`, `cache_delay` | Verified | Every observed specimen returned `cache_delay: 30`; exact page-to-API propagation latency remains unmeasured. |
| Seller identity | Rendered Item Market page | Verified on Xanax page | Page exposes seller/Anonymous state; public Item Market API listing rows did not expose seller identity in the tested schema. |
| Nonstackable UID | `/market/{id}/itemmarket` → `item_details.uid` | Verified | Distinguishes individual equipment instances. |
| Nonstackable stats | `/market/{id}/itemmarket` → `item_details.stats` | Verified | Damage/accuracy/armor/quality can vary by UID. |
| Nonstackable bonuses/rarity | `/market/{id}/itemmarket` → `item_details.bonuses`, `rarity` | Verified | Equipment value can depend on per-instance attributes even when empty/null in a specimen. |
| Historical trend | Not established by this chapter | Deferred | Current Item Market snapshots are not a substitute for validated historical graph/history sources. |
| External/trader value | Weav3r, TornExchange, trader-specific sources | Deferred | DQ-EXT-001 must determine definitions and freshness before comparison/use. |

## Permission finding

Official OpenAPI classifies `GET /market/{id}/itemmarket` as requiring a Public access key and as globally cached.

Live Custom-key behavior added an important nuance:

- with Market selections limited to baseline/default entries and without `itemmarket`, `GET /market/206/itemmarket` returned Torn error 16: access level not high enough;
- after explicitly adding Market → `itemmarket`, `/key/info` enumerated that selection and the same endpoint succeeded;
- the key still reported `access.level: 0` and `access.type: Custom`.

Conclusion:

Public is an endpoint sensitivity/access classification, but a deliberately narrow Custom key may still require the exact capability grant. TornScriptures permission UX must reason about required capabilities rather than broad level alone.

Do not universalize the `/key/info` enumeration rule to all Public endpoints. DQ-KEY-001 separately observed `/faction/{id}/members` succeeding without `members` appearing in `/key/info`.

## Three price concepts

### 1. Catalog `value.market_price`

Observed through `/torn/{ids}/items`.

Useful as an official reference value and catalog enrichment field. It is not guaranteed to match the current cheapest executable Item Market listing.

### 2. Item Market `item.average_price`

Observed through `/market/{id}/itemmarket`.

This field stayed stable during multiple Xanax book changes and, for several stackable specimens, tracked catalog `market_price` closely. However, the Dual 92G Berettas specimen showed that the relationship can diverge drastically for nonfungible equipment.

This chapter does not infer Torn's private calculation method for `average_price`.

### 3. Executable current sell-side book

Observed through ordered Item Market listing rows.

The cheapest listing is a current floor inside the returned cache snapshot, but the economic meaning of that floor depends on quantity/depth. A one-unit floor and a floor supported by hundreds of units are not equivalent market conditions.

## Stackable-market semantics

The stackable specimens established:

- listing rows are not aggregated by price;
- the same price can occur in multiple rows;
- `_metadata.total` counts rows, not units;
- `amount` must be summed separately to reason about unit depth;
- small low-price listings can disappear while deeper walls remain stable;
- an extreme high ask is still a valid raw listing but may be economically unrepresentative;
- catalog/reference values can sit above, below, or far below the current floor depending on market structure.

Example patterns:

- Xanax: small moving low-end listings ahead of large deeper walls.
- Panda Plushie: tightly clustered reference values and floor.
- Cesium-137: current floor materially above both official reference values, with extremely sparse supply and huge outlier asks.
- Boxing Gloves: thin one-unit listings, high value, reference values relatively anchored but below the live floor.
- African Violet: a floor supported by meaningful quantity and a visible deeper price wall.

## Nonstackable-market semantics

Dual 92G Berettas proved that equipment must not be treated as a simple fungible stackable market.

Each observed row had:

- `amount: 1`;
- a unique UID;
- item-specific damage, accuracy and quality;
- bonuses array;
- rarity field.

The Item Market response called the item `type: "Secondary"`, while the catalog response classified it as `type: "Weapon"` and `sub_type: "Pistol"`.

Therefore fields with the same label across endpoints do not necessarily carry the same ontology. Preserve source-qualified semantics.

## Freshness classification

Official contract:

- Item Market is globally cached.

Live observations:

- every captured Item Market response returned `cache_delay: 30`;
- repeated Xanax calls produced advancing `cache_timestamp` values and newer book states;
- rendered Xanax rows and API rows strongly matched as representations of the same underlying listing book;
- natural market changes occurred between observations quickly enough that human screenshot/API loops could not isolate an exact propagation delay.

Safe wording:

> `market:itemmarket` returned `cache_delay: 30` throughout the observed runs. API and rendered Item Market observations were strongly consistent with the same underlying listing book and the API demonstrably refreshed on short timescales. The experiment did not measure exact rendered-page-to-API propagation latency, so no exact 30-second freshness guarantee is claimed.

## Pagination provenance

Pagination links expose offsets and total row count, but separate page calls can land on different global-cache snapshots.

The Boxing Gloves first page and final-row page had cache timestamps 90 seconds apart. They are valid separate observations, not one guaranteed atomic full-book image.

Future full-book logic that requires snapshot consistency must preserve provenance and fail closed or represent pagination uncertainty rather than silently stitching mismatched snapshots.

## What this matrix does not decide

It does not prescribe:

- a true-price formula;
- median, trimmed mean or VWAP rules;
- a minimum depth threshold;
- confidence scoring;
- outlier-removal policy;
- a buy/sell recommendation;
- historical trend calculation;
- external-source precedence;
- trader-offer precedence;
- an API polling schedule;
- replacement of current rendered-page behavior in stable TornScriptures.

## Handoffs

### DQ-EXT-001

Compare Weav3r and TornExchange against this official baseline. For every external value, determine whether it means a current listing, trader buy price, historical/derived value, estimate, or another concept before TornScriptures combines it with official fields.

### Market Pulse

Current-book data can support present liquidity and executable-price context, but it cannot substitute for validated historical trend/history data required by Market Pulse.

### Event Outlook / Inventory Equity / Value at Risk

Preserve provenance. Reference values, executable asks, historical observations and forecast outputs are separate layers. Advisory market intelligence must not alter Black Ledger accounting truth.

## Product effect

None.