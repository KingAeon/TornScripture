# Inventory Sales HUD

The Inventory Sales HUD is a read-only planning tool. It scans the key owner's
inventory only after a manual button press and creates a local sale plan. It
never sells, sends, lists, equips, or trashes an item.

## API keys and sharing

The published userscript contains TornPDA's `###PDA-APIKEY###` placeholder.
TornPDA replaces that placeholder with the key managed by each user's app, so
friends can install the same script without sharing a key.

Tampermonkey and Violentmonkey users enter their own Limited Access key in the
HUD settings. That key is stored in the browser's local storage and sent only
to `api.torn.com`. It is never included in rule exports, inventory-price data,
or the Git repository.

## Inventory scan

Torn's inventory endpoint returns one category per request. The HUD scans all
25 accepted category values sequentially and paginates within each category.
This avoids Torn's `Incorrect category` response when the `cat` parameter is
omitted and keeps the complete inventory scan below the normal API rate limit.

## Torn catalog prices

After inventory capture, the HUD batches the owned item IDs through Torn's
public item-catalog endpoint. The result is joined locally by item ID and adds:

- Torn's estimated market price
- the vendor or shop name and country
- the price the shop charges the player
- the price the shop pays the player
- whether the item is tradable
- circulation

Catalog results are cached locally and refreshed with every API inventory scan
or through the separate **Refresh Torn prices** button. The organizer shows all
three price concepts separately so a shop purchase price is never mistaken for
a sale payout.

Torn catalog values take priority for market and shop prices. The external
trader-price file's `marketValue` and `citySellPrice` fields remain offline
fallbacks when a catalog record or shop value is unavailable. Human trader
offers remain independent in `traderPrices`.

## Automatic store recommendations

An item is automatically assigned to **Sell to Store** only when the shop pays
strictly more than Torn's market estimate, or when no market estimate exists
and the shop pays a positive amount. An equal or better market estimate leaves
the item in **Needs Review** unless a trader price or another explicit default
classification applies.

Per-item manual choices still override this recommendation. Select
**Automatic** in an item's classification menu to remove a remembered manual
choice and return it to current price-based classification. A keep quantity can
be retained while the destination remains automatic. Equipment remains locked
in **Excluded Equipment** and cannot be reset or sold by the planner.

## Trader-price file

The HUD's shareable data boundary is `data/trader-prices.json`. Keeping prices
outside the userscript means trader updates do not require a script release.
The checked-in live file starts empty; `data/trader-prices.example.json` is a
non-live schema example.

```json
{
  "schema": "tornscripture-trader-prices",
  "schemaVersion": 1,
  "updatedAt": "2026-07-17T00:00:00.000Z",
  "traders": [
    {
      "id": "trader-id",
      "name": "Trader Name",
      "active": true,
      "website": "https://example.com/prices",
      "updatedAt": "2026-07-17T00:00:00.000Z"
    }
  ],
  "items": {
    "206": {
      "name": "Item Name",
      "marketValue": 100000,
      "citySellPrice": 50000,
      "classification": "trader",
      "traderPrices": {
        "trader-id": 90000
      }
    }
  }
}
```

Valid default classifications are `keep`, `trader`, `store`, `trash`, and
`review`. Missing price records default to `review`. Armor, Primary, Secondary,
Melee, Temporary, Defensive, categories containing Weapon, equipped items, and
uniquely identified equipment are always forced to `excluded`, regardless of
price data or a saved user rule.

## Future trader website connections

Each website connector should produce this same JSON schema. That keeps website
parsing and credentials out of the Torn userscript. Depending on a trader's
site, an adapter could be a permitted public-data fetch, a small manual import,
or a spreadsheet export. Site terms, authentication, CORS, and update frequency
must be reviewed separately for every trader before an automated adapter is
enabled.

The safe flow is:

1. A trader-specific adapter reads public pricing or an authorized export.
2. It validates item IDs, numeric prices, timestamps, and trader identity.
3. It writes the versioned trader-price JSON file without API keys or inventory.
4. The HUD refreshes that file and chooses the highest active trader price.
5. The user reviews and copies the sale plan; Torn actions remain manual.

## Local data

The HUD stores the API key (browser installs only), latest inventory response,
settings, price configuration, and item rules locally on the Torn origin. A
friend installing the script starts with their own empty local data. Rule
exports contain classifications and keep quantities, but never the API key.
