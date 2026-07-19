# IMM v0.6.0 Overseas Testing

## What this build adds

- Detects Torn foreign-shop pages while travelling.
- Adds the same gold, green, purple, and red profit treatment to visible foreign-shop items.
- Uses the existing IMM rule: `floor(market value × 99%) - overseas purchase price`.
- Adds a load planner with a configurable default capacity of **21**.
- Detects the currently carried load when Torn displays a value such as `3/21`.
- Builds a best-visible-load plan by filling the remaining slots with the highest positive profit per item, limited by visible stock.
- Shows planned purchase cost, 99% trader return, and expected trip profit.
- Shows open overseas ledger cargo, cost basis, trader return, and expected profit.
- Extends purchase capture to overseas success messages when Torn exposes enough text to identify item, quantity, and total cost.

## First live test

1. Replace the prior IMM script with v0.6.0.
2. Travel abroad and open the foreign item shop.
3. Confirm the IMM panel identifies the page as **overseas shop**.
4. Check that each visible item has a profit badge.
5. Confirm the load planner uses **21** unless you change **Travel load limit**.
6. Compare the detected current load with Torn's displayed carried-item count.
7. Make one small purchase.
8. Open the ledger and verify the lot is marked as `overseas`, includes the country when detected, and contains the correct quantity and price.

## Planner behavior

- Every item is treated as consuming one configured load slot.
- Only positive-profit items are added to the suggested load.
- Visible stock limits the suggested quantity.
- The plan is informational and never presses Buy or changes Torn's quantity fields.
- If Torn does not expose the current carried count, IMM assumes zero occupied slots and says so in the panel.

## Known first-test boundary

Torn's foreign-shop layout can vary between desktop, mobile, and TornPDA. If the panel appears but rows are not marked, press **Copy diagnostics** and provide it with a screenshot of the shop. Manual ledger entry remains available if Torn's purchase-success message is not readable.
