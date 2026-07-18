# IMM v0.3.0 Ledger Test

## What this phase adds

- Separate local purchase lots. Purchases are not averaged together.
- Captures Item Market confirmation details after the player presses Torn's normal **Yes** button.
- Waits for a Torn success signal before automatically recording the lot.
- Shows a pending purchase card with manual **Record completed** and **Discard** fallbacks.
- Ledger review screen with edit, delete, clear, copy JSON, import JSON, and manual lot entry.
- Stores market value and 99% trader value as they were when the lot was recorded.
- Ledger schema already includes source, country, and location fields for future overseas capture.

## First live test

1. Replace IMM v0.2.3 with v0.3.0.
2. Open a profitable Item Market listing.
3. Buy a very small quantity for the first test.
4. Press Torn's normal **Yes** confirmation.
5. Watch for an IMM message that the lot was recorded.
6. Open **Ledger** and verify item name, quantity, paid each, total cost, market value, trader value, and expected profit.

If Torn confirms the purchase but IMM leaves it pending, press **Record completed**, then copy diagnostics. The diagnostics include recent purchase signals without including the API key.

## Not included yet

- Automatic overseas-shop purchase capture.
- Assigning ledger lots to trades.
- FIFO, LIFO, or manual lot consumption.
- Realized-profit reporting.
