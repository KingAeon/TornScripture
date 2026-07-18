# IMM v0.4.0 testing notes

## What changed

### Profit display repair

- Partial ledger coverage no longer turns a missing full-profit value into green `+$0`.
- Full coverage displays **Actual sale profit**.
- Partial coverage displays **Tracked sale profit**, calculated only from the quantities covered by recorded purchase lots.
- Existing v0.3.2 partial sale records are repaired when loaded: their stored `$0` placeholder is ignored and their tracked-profit figure is used.

### Gold opportunity tier

Default tiers are:

- Gold: positive profit, at least 0.25% ROI, and at least $1,000 profit per item.
- Green: positive profit, at least 0.25% ROI, and at least $100 profit per item.
- Purple: positive, but below one of the configured thresholds.
- Red: no profit at the 99% trader payout.

Both Gold and Green per-item thresholds are editable in the IMM panel.

### Trader Book

The new Traders button opens a local directory with:

- Trader name and Torn user ID
- Personal 0-to-5 rating
- Preferred payout percentage
- Freeform notes
- Start trade and Profile links when a user ID is saved
- Local trade count, cash received, tracked profit, observed payout, and last recorded trade
- JSON export and import

On a recognized trade page, use **Save trader** to prefill the current counterparty. If IMM cannot find the player ID in the page, enter it when prompted.

## First checks

1. Reopen the partial-coverage trade that showed `195/196`.
2. Confirm it now says **Tracked sale profit** and no longer shows green `+$0`.
3. Open an Item Market listing with more than $1,000 profit per item and verify that it appears gold.
4. Change the Gold profit threshold and verify the page rescans.
5. On a trade page, press **Save trader**, add the Torn ID, rating, and notes.
6. Open **Traders**, verify Start trade and Profile links, then export the Trader Book JSON.

## Important boundary

Trader ratings and notes are personal local records. IMM does not message, rate, report, or contact players automatically.
