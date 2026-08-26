# DQ-MARKET-001

Status: LANDED via PR #112.
Merge commit / bootstrap main: `cf18663fabf9282210498f6220bed063663c6bd3`.

Core conclusions:

- catalog `value.market_price`, Item Market `item.average_price`, and executable floor are distinct concepts;
- listing rows are individual records, not aggregated price levels;
- `_metadata.total` is listing-record count; stackable depth requires summing `amount`;
- thin books may contain pathological asking-price outliers;
- one-unit floors and quantity-backed floors have different economic meaning;
- API/rendered market observations strongly matched the same underlying book;
- every live sample returned `cache_delay: 30`, but exact page-to-API propagation latency was not measured;
- nonstackable equipment requires UID/stat-aware semantics;
- pages with different `cache_timestamp` values must not be silently stitched into one atomic book;
- narrow Custom keys required explicit `market:itemmarket` in the controlled test despite Public endpoint classification.

Six specimens: Xanax #206, Panda Plushie #274, Cesium-137 #336, Boxing Gloves #330, African Violet #282, Dual 92G Berettas #21.

Canonical evidence lives under `docs/discovery/DQ-MARKET-001-*` and `docs/discovery/evidence/DQ-MARKET-001-*`.
