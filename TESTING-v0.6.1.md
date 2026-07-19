# IMM v0.6.1 Overseas Detection Hotfix

## What failed in v0.6.0

The live Torn overseas shop uses the `shops.php` route and cart-style buy controls. The first overseas detector expected older foreign-shop route names or visible quantity inputs, so IMM classified the page as unsupported and removed its own panel.

## What changed

- Recognizes `shops.php` as a shop route.
- Recognizes Torn's live table structure: General Store, Stock, Cost, Buy, Arms Dealer, and Black Market.
- Accepts cart links and buy icons even when no quantity input exists until the cart is pressed.
- Recognizes Torn travel abbreviations such as `HAW` and resolves them to the full country/location name.
- Keeps the configurable travel load limit, overseas margin badges, load planner, and overseas purchase capture.

## Test in Hawaii

1. Replace v0.6.0 with v0.6.1.
2. Reload the overseas shop page.
3. Confirm the collapsed IMM button appears at the right edge.
4. Open IMM and confirm the page type reads `overseas shop`.
5. Confirm Hawaii is shown and the Travel load limit defaults to 21.
6. Confirm shop rows receive gold, green, purple, or red margin markings.
7. Make one small test purchase and confirm a new overseas ledger lot is created with the item, quantity, shop cost, Hawaii, and expected 99% profit.

The already completed 21x Shark Fin purchase from the screenshot may need one manual ledger entry because v0.6.0 did not recognize the page while its success message appeared.
