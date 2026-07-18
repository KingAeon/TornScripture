TornScripture - Item Market Margin v0.2.0
==========================================

NEW: TRADE MANIFEST AUDIT

On Torn trade pages, IMM now attempts to:

1. Identify your side of the trade.
2. Read each manifested item and quantity on your side.
3. Match each item to the cached Torn market value.
4. Calculate the trader target as:

   sum(floor(item market value x 0.99) x quantity)

5. Read cash on the other side and subtract any cash on your side.
6. Compare the net cash you receive with the required 99% payout.

TRADE STATUS

Green  = net cash meets or exceeds the complete 99% manifest target.
Red    = detected cash is below the complete 99% manifest target.
Purple = cash is pending, an item is unmatched, or the page could not be fully read.

The panel shows:
- Full market value of your manifested items
- Required 99% payout
- Trader cash minus any cash you are contributing
- Difference from the required target
- Effective payout percentage
- Optional per-item 99% totals

FIRST LIVE TEST

1. Replace v0.1.1 with the v0.2.0 userscript.
2. Open an active trade containing your items.
3. Confirm IMM selected the correct side.
4. If needed, change "Your trade side" from Auto detect to Left or Right.
5. Compare the item quantities, 99% target, and detected trader cash.
6. Add or change the trade cash and confirm IMM updates automatically.

IMPORTANT TESTING GUARDRAILS

- If any item is unmatched, IMM labels the manifest incomplete and does not call
  the trade protected, even if the known subtotal looks correct.
- This version validates the trader's 99% payout. It does not yet store the exact
  purchase cost of items you actually bought, so it verifies the intended exit
  price rather than maintaining a historical realized-profit ledger.
- IMM never accepts, cancels, edits, or submits a trade.

If the live trade layout is not recognized, press "Copy diagnostics" and provide
that output with a screenshot of the trade page.
