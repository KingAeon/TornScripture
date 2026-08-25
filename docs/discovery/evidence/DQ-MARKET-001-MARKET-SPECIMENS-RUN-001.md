# DQ-MARKET-001 — Market Specimens Run 001

Status: **LIVE VERIFIED / SANITIZED / EVIDENCE SATURATION REACHED**

Date: 2026-08-25

Official sources:

- `GET /v2/torn/{ids}/items`
- `GET /v2/market/{id}/itemmarket`
- rendered Torn Item Market page for the bounded Xanax page/API comparison

No raw API key, authorization header, generated curl command, or unnecessary account identifier is retained here.

## Goal

Observe enough distinct official-market structures to determine whether Torn catalog `market_price`, Item Market `average_price`, current executable listing floor, listing depth and nonstackable equipment attributes are distinct concepts that TornScriptures must preserve separately.

## Catalog snapshot

One batched specific-item catalog query captured the six fixed specimens.

| Item | ID | Catalog type | Catalog `market_price` | Circulation | Catalog notes |
|---|---:|---|---:|---:|---|
| Dual 92G Berettas | 21 | Weapon / Pistol | $3,755,741 | 68,587 | Equipment details populated; Torn/foreign shop sell reference $900,000 |
| Xanax | 206 | Drug | $852,268 | 8,791,283 | Travel/vendor references; no catalog equipment details |
| Panda Plushie | 274 | Plushie | $45,631 | 8,586,393 | China buy reference $400; sell reference $300 |
| African Violet | 282 | Flower | $48,328 | 7,500,584 | South Africa buy reference $2,000; sell reference $1,500 |
| Boxing Gloves | 330 | Booster | $448,081,666 | 9,240 | Torn shop buy reference $450,000,000 |
| Cesium-137 | 336 | Material | $495,000,000 | 7,176 | No vendor; catalog sell reference $500,000,000 |

Catalog fields were preserved as separate references. Shop/vendor values were not treated as current Item Market prices.

## Cross-specimen price summary

| Specimen | Catalog `market_price` | Item Market `average_price` | Observed first-page floor | Floor vs average | Floor vs catalog | Listing records |
|---|---:|---:|---:|---:|---:|---:|
| Xanax #206 | $852,268 | $851,096 | $873,000 | +2.57% | +2.43% | 193 at first capture |
| Panda Plushie #274 | $45,631 | $45,328 | $45,000 | -0.72% | -1.38% | 133 |
| Cesium-137 #336 | $495,000,000 | $489,000,000 | $555,000,000 | +13.50% | +12.12% | 16 |
| Boxing Gloves #330 | $448,081,666 | $449,121,427 | $470,000,000 | +4.65% | +4.89% | 21 |
| African Violet #282 | $48,328 | $48,031 | $47,950 | -0.17% | -0.78% | 248 |
| Dual 92G Berettas #21 | $3,755,741 | $5,999,225 | $3,999,225 | -33.34% | +6.48% | 279 |

These comparisons demonstrate that the three price concepts are not interchangeable and that their relationship changes materially by market structure.

---

## Specimen A — Xanax #206

Role: deep/high-liquidity active stackable market.

### API observation 1

`cache_timestamp: 1787334782`

`cache_delay: 30`

`average_price: 851096`

`_metadata.total: 193`

First 20 listing rows:

```text
873000 x5
873095 x3
873100 x5
873788 x26
873999 x17
874000 x57
874000 x2
875700 x16
875844 x457
875900 x1000
876000 x20
876100 x18
876834 x8
876999 x137
877975 x28
878772 x15
879876 x700
879879 x13
880000 x15
880000 x1
```

The first 20 rows represented 2,543 Xanax, proving that `_metadata.total` is not unit quantity. Identical-price rows remained separate.

### Rendered-page observation around 12:58 local time

The rendered Item Market showed the same deeper book structure while several low-end rows had naturally changed. Relevant visible rows included:

```text
850000 x1
873095 x2
873785 x8
873788 x26
873999 x17
874000 x57
874000 x2
875700 x16
875844 x457
875900 x1000
```

Seller identity was visible on the rendered page, while the public Item Market API rows used in this run did not expose seller identity.

The single $850,000 unit demonstrated why a one-unit floor and a quantity-supported price level are economically different even when both are truthful listing observations.

### API observation 2

`cache_timestamp: 1787335719`

`cache_delay: 30`

`average_price: 851096`

`_metadata.total: 190`

Relevant low/deep rows:

```text
873788 x5
873999 x17
874000 x57
874000 x2
875700 x16
875844 x457
875900 x1000
...
883000 x4289
```

The earlier $850,000 listing and several small lower rows were gone. The Item Market `average_price` remained unchanged while the executable book moved.

The first 20 rows in this observation represented 6,810 Xanax, dominated by deeper walls.

### Rendered-page observation around 13:11 local time

Relevant visible rows:

```text
874000 x55
874000 x2
875700 x16
875844 x457
875900 x1000
```

Compared with API observation 2, the $873,788 and $873,999 rows had disappeared and the $874,000 x57 row had reduced to x55.

### API observation 3

`cache_timestamp: 1787336081`

`cache_delay: 30`

`average_price: 851096`

`_metadata.total: 190`

Relevant first rows:

```text
873995 x3
873995 x26
874000 x51
874000 x2
875700 x16
875844 x457
875900 x1000
```

New $873,995 rows appeared after the rendered 13:11 observation, proving that the API snapshot itself advanced and continued reflecting natural market movement.

### Xanax conclusion

- rendered page and API are strongly consistent representations of the same underlying listing book;
- individual listing rows remain separate even at identical prices;
- low-end rows can move rapidly while deeper walls remain stable;
- catalog `market_price` and Item Market `average_price` remained close to each other but did not equal the current executable floor;
- `average_price` remained stable through multiple observable book changes;
- every API sample returned `cache_delay: 30`;
- exact rendered-page-to-API propagation latency was not isolated and is not claimed.

---

## Specimen B — Panda Plushie #274

Role: ordinary deep stackable control.

`cache_timestamp: 1787678728`

`cache_delay: 30`

`average_price: 45328`

`_metadata.total: 133`

First 20 rows:

```text
45000 x16
45000 x17
45290 x18
45300 x4
45985 x28
45990 x18
46000 x10
46000 x10
46000 x14
46500 x10
46500 x20
46888 x17
47255 x20
47260 x13
47270 x65
47320 x28
47328 x25
47500 x28
47500 x18
48000 x72
```

First-page quantity: 451 units.

Notable depth:

- $45,000: 33 units across two listing rows;
- $46,000: 34 units across three rows;
- $46,500: 30 units across two rows.

Conclusion: deep/tightly clustered market where floor, catalog `market_price` and Item Market `average_price` were all close, but identical-price rows still remained separate.

---

## Specimen C — Cesium-137 #336

Role: extremely thin stackable material market.

`cache_timestamp: 1787678934`

`cache_delay: 30`

`average_price: 489000000`

`_metadata.total: 16`

Complete returned market book:

```text
555000000 x1
559000000 x3
567000000 x1
599000000 x1
600000000 x1
600000000 x2
700000000 x1
740000000 x1
790000000 x1
795000000 x1
800000000 x3
888888888 x1
999999999 x1
1000000000 x1
1040000000 x2
999999999999 x1
```

Total listed units: 22.

Catalog circulation: 7,176.

Observed listed units represented roughly 0.31% of circulation.

The executable floor was $66,000,000 above Item Market `average_price` and $60,000,000 above catalog `market_price`.

Conclusion: official reference values can sit materially below every current executable listing in an extremely thin market. Extreme high asks prove that naïvely averaging raw current asks would also be unsafe.

---

## Specimen D — Boxing Gloves #330

Role: high-value thin stackable market.

### First page

`cache_timestamp: 1787679085`

`cache_delay: 30`

`average_price: 449121427`

`_metadata.total: 21`

First 20 rows:

```text
470000000 x1
490999989 x1
491999999 x1
493000000 x1
493357138 x1
493357143 x1
496999990 x1
499999999 x1
500000000 x1
535000000 x1
550000000 x1
559000009 x1
559999994 x1
559999999 x1
560000000 x1
700000000 x1
744495000 x1
750000000 x1
888888888 x1
999999999 x1
```

Every visible row represented one unit.

Catalog references:

- `market_price: 448081666`;
- shop `buy_price: 450000000`.

Those reference values were tightly clustered, while the current floor was $470,000,000 and one purchase could move the next available ask close to $491,000,000.

### Offset-20 observation

A separate `offset=20` request returned:

```text
9999999999 x1
```

with:

`cache_timestamp: 1787679175`

`cache_delay: 30`

The cache timestamp was 90 seconds newer than the first page. Therefore the two requests are preserved as separate observations and are not asserted to form one atomic 21-row snapshot.

Conclusion: thin/high-value market with one-unit depth, relatively anchored official reference values, and extreme high-end asks.

---

## Specimen E — African Violet #282

Role: travel/event-sensitive deep stackable market.

`cache_timestamp: 1787679326`

`cache_delay: 30`

`average_price: 48031`

`_metadata.total: 248`

First 20 rows:

```text
47950 x28
48000 x25
48000 x162
48000 x17
48000 x21
48025 x1
48500 x10
48995 x28
49999 x2
50000 x500
50000 x40
50000 x28
50134 x36
50450 x28
51000 x18
51395 x5
51489 x23
51500 x18
51930 x27
51951 x17
```

First-page quantity: 1,034 units.

Depth observations:

- at or below $48,000: 253 units;
- $50,000 across three rows: 568 units.

Conclusion: the floor was supported by meaningful quantity and official reference values were tightly clustered. Selection as an event-sensitive item does not imply that the item is volatile at every observation.

---

## Specimen F — Dual 92G Berettas #21

Role: nonstackable equipment market.

`cache_timestamp: 1787679426`

`cache_delay: 30`

`average_price: 5999225`

`_metadata.total: 279`

First-page floor: $3,999,225.

Catalog `market_price`: $3,755,741.

Catalog classification: `Weapon` / `Pistol`.

Item Market classification: `Secondary`.

Every observed listing used `amount: 1` and carried an `item_details` object with a unique UID and per-instance stats.

Representative rows:

```json
{
  "price": 3999225,
  "amount": 1,
  "item_details": {
    "uid": 1584052582,
    "stats": {
      "damage": 64.11,
      "accuracy": 30.41,
      "armor": null,
      "quality": 5.15
    },
    "bonuses": [],
    "rarity": null
  }
}
```

```json
{
  "price": 4998450,
  "amount": 1,
  "item_details": {
    "uid": 3229959315,
    "stats": {
      "damage": 65.31,
      "accuracy": 30.82,
      "armor": null,
      "quality": 21.28
    },
    "bonuses": [],
    "rarity": null
  }
}
```

Across the 20 captured rows, quality varied from 3.67 to 21.28 and damage/accuracy also varied by UID.

Conclusion:

- equipment is not economically fungible in the same way as stackable commodities;
- Item Market `average_price` can diverge sharply from catalog `market_price` and from current floor;
- per-UID stats/bonuses/rarity must remain available to any future equipment valuation design;
- identically named `type` fields across catalog and Item Market endpoints must not be assumed to share semantics.

---

## Cross-cutting findings

1. `value.market_price`, `item.average_price` and current listing floor are different concepts.
2. Their relationship varies substantially by market structure.
3. Item Market listing rows are individual rows, not aggregated price levels.
4. `_metadata.total` is listing-record count, not unit quantity.
5. Stackable depth requires summing `amount`.
6. A one-unit floor is economically different from a quantity-supported floor.
7. Extreme asking-price outliers occur naturally in thin markets.
8. Rendered Xanax rows and API rows strongly correspond to the same underlying listing book.
9. Every observed Item Market response returned `cache_delay: 30`, but exact page/API propagation latency was not measured.
10. Pagination requests with differing `cache_timestamp` values must not be silently stitched into an atomic full book.
11. Nonstackable equipment requires UID/stat-aware handling.
12. Same-named fields across endpoints can carry different semantic classifications.

## Evidence saturation decision

The six specimens produced distinct deep/volatile, deep/clustered, extremely thin/dislocated, thin/high-value, quantity-backed, and nonfungible-equipment behaviors.

A planned adaptive zero/near-zero-listing specimen was therefore not pursued. Additional ordinary examples were unlikely to change the chapter's source-semantic conclusions enough to justify more live collection.

## Product effect

None.