# IMM v0.9.1 TornW3B pricelist capture

## What changed

- IMM now runs on public `weav3r.dev/pricelist/{TornID}` pages.
- A TornW3B pricelist can be captured directly from its visible item cards.
- The trader Torn ID is inferred from the pricelist URL/profile link and the trader name from the page heading.
- Captured prices and the exact pricelist address are carried back to Torn and stored in the Trader Book.
- Saved TornW3B pages support **Open & recapture**. The script opens the page, scans it, and returns to Torn automatically.
- Cross-domain transfer uses a same-tab bridge plus a compact return URL fallback. No API key or private Torn data is sent to Weav3r.

## First capture test

1. Install v0.9.1 and fully reload TornPDA.
2. Open `https://weav3r.dev/pricelist/3840107` in TornPDA.
3. Confirm the IMM panel identifies the trader and reports a large number of prices found.
4. Press **Capture & return to Torn**.
5. Confirm Torn reopens and shows a toast reporting the saved price count.
6. Open **Traders** and locate the trader by Torn ID.
7. Confirm the saved price page points to the TornW3B pricelist and the price count/timestamp are populated.

## One-click recapture test

1. In Trader Book, press **Open & recapture** for the saved TornW3B trader.
2. The pricelist should open with an IMM notice that recapture was requested.
3. After prices render, it should return to Torn automatically.
4. Confirm the timestamp updates and changed-price count is shown.

## Failure checks

- If the pricelist is still loading, IMM must not return with zero prices.
- Press **Rescan page** after the list finishes loading.
- A failed/empty capture must not erase the trader's prior snapshot.
- External pages other than `weav3r.dev/pricelist/{id}` must not activate this capture mode.
