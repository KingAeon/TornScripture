# IMM v0.9.0 testing

## What changed

- Blue is now an NPC **buyback** alert only.
- IMM compares the visible Item Market listing price against the catalog `sell_price`, meaning the amount an NPC store pays the player.
- NPC shop purchase prices and overseas source-price notices no longer create blue Item Market badges.
- A trader can be armed temporarily for the next receipt or pricing page.
- Capturing the page stores its Torn URL, page title, parsed item prices, capture time, and change count on the trader record.
- Trader Book adds **Open prices**, **Open & recapture**, and **Arm price capture** actions.
- An armed trader can also be linked from the receipt-audit window.

## 1. Upgrade and catalog check

1. Replace the previous userscript with `TornScripture-Item-Market-Margin.user.js`.
2. Confirm the panel reports **v0.9.0**.
3. Press **Sync values** once.
4. Confirm the sync finishes without an API error.

## 2. NPC buyback blue test

1. Open an Item Market category containing an item whose NPC `sell_price` is above a visible listing price, such as Shark Fin when a listing is below its NPC payout.
2. Confirm the card or listing becomes blue.
3. Confirm the badge reads approximately:
   - `NPC pays +$X ea`
   - `Ⓢ $NPC_PAYOUT · listed $LISTING_PRICE`
4. Open a listing priced at or above the NPC payout and confirm it is not blue because of the NPC rule.
5. Visit an overseas shop and confirm the shop's purchase cost does not itself create a blue Item Market notice later.

## 3. Temporary trader capture

1. Open a saved trader in **Trader Book** and press **Arm price capture**.
   - Alternate route: open a player's profile and press **Arm price capture** in IMM.
2. Confirm the panel shows the trader as armed with an expiry countdown.
3. Open the trader's receipt or pricing page.
4. Wait for its prices to finish loading, then press **Capture this page**.
5. Confirm the armed notice clears and a success toast reports the number of prices captured, or that the page was linked when no prices could be parsed.
6. Open Trader Book and confirm the trader now shows:
   - saved price-page count
   - last price-check time
   - last change count
   - **Open prices**
   - **Open & recapture** for Torn pages

## 4. One-click recapture

1. In Trader Book, press **Open & recapture**.
2. Confirm IMM navigates to the saved Torn page.
3. After the page loads, confirm IMM automatically checks it and reports the captured or changed price count.
4. Return to Trader Book and confirm the last-check time updated.
5. If the page contains no parseable prices, confirm the previous stored snapshot is preserved rather than erased.

## 5. Receipt-audit linking

1. Arm a trader.
2. Open Ledger, select a recorded sale, and open its receipt audit.
3. Paste or load the receipt/pricing information.
4. Press **Link [trader] + save page**.
5. Confirm the sale is linked to that trader and the receipt URL/prices are saved on the trader record.

## Regression checks

- Existing gold, green, purple, and red trader-margin badges still work.
- Overseas profit badges and the load planner still work.
- Purchase capture, Ledger, trade verification, Trader Book profiles, and receipt audits still open normally.
- Existing trader and ledger data remain present after upgrading.

## Diagnostics to send if something fails

Press **Copy diagnostics** on the affected page and include:

- the copied diagnostics
- a screenshot
- the item or trader name
- the page type and address with any private tokens removed
- whether prices were visible before Capture this page was pressed
