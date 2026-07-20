# Item Market Margin v0.8.0 NPC Store Check

## What changed

- Added a blue NPC-store category on Item Market category tiles and individual seller rows.
- Blue means the same item can be bought from an NPC store for less than the visible Item Market price.
- The badge shows the NPC price, savings per item, total lot savings, and the best known shop/location.
- `Sync values` now keeps Torn's catalog buy price and also attempts one `cityshops` request for exact Torn City store names and prices.
- Overseas shop scans now remember the live item price, country, and nearby shop name locally in the browser.
- Overseas prices are learned automatically when the overseas shop page is opened. No extra market-listing API calls are made.
- Existing gold, green, purple, red, overseas-profit, ledger, trade, trader, and receipt-audit behavior remains intact.

## Important meaning

- **Blue:** an NPC source is cheaper than the Item Market listing.
- **Gold / green / purple / red:** existing 99%-trader margin tiers when the Item Market remains the relevant purchase source.
- A catalog-only NPC price is displayed as `from` because the catalog does not always identify the exact shop or a variable overseas price.
- Once an overseas page is visited, IMM stores the observed exact price and labels the country/shop when detected.

## First test

1. Replace the current script with v0.8.0 and reload TornPDA.
2. Open IMM and press **Sync values**.
3. Confirm the toast reports item values and an NPC listing count. If city-shop syncing is unavailable, catalog NPC prices still load.
4. Open the Item Market category containing **Shark Fin**.
5. Confirm Shark Fin receives a blue outline when the lowest market price is above the NPC buy price.
6. Open Shark Fin seller listings and confirm qualifying rows receive blue badges.
7. Confirm each badge shows:
   - NPC price
   - savings per item
   - total savings for the lot
   - shop/location source when known
8. Confirm gold, green, purple, and red items still behave normally when no cheaper NPC source exists.

## Overseas learning test

1. Travel to an overseas destination and open its `shops.php` page.
2. Confirm the existing overseas profit badges and load planner still appear.
3. Leave the page open long enough for IMM to scan the visible shops.
4. Return to the Item Market and open one of the items seen overseas.
5. Confirm its blue badge uses the observed overseas price and shows the country plus `travel`.
6. If the overseas price changes on a later visit, IMM should update the current price while retaining the observed minimum and maximum internally.

## Regression checks

- Item Market category scanning remains fast.
- Individual seller rows receive only one badge each.
- Overseas load planning and purchase capture still work.
- Ledger lots, sales, trader profiles, trade verification, and receipt auditing remain unchanged.
- API keys and learned NPC prices remain in local browser storage.
