# IMM v0.3.1 purchase capture test

This hotfix keeps the v0.3.0 ledger and adds a second automatic capture path.

## What changed

Torn's mobile Item Market can display a successful purchase message even when the script misses the earlier Yes confirmation click. IMM now recognizes messages in this form directly:

`You bought 57x Peony from SellerName for a total of $2,850,000`

That message can create the purchase lot without an existing pending card.

## Test

1. Keep the manually added Peony lot already in the ledger.
2. Replace v0.3.0 with v0.3.1 and reload the Item Market.
3. Make one small new purchase.
4. Confirm the ledger count increases automatically.
5. Verify item, quantity, unit cost, total cost, market value, trader value, and expected profit.

IMM suppresses repeated reads of the same success message for two minutes so a single Torn message should produce only one lot.

If automatic capture misses again, copy diagnostics before manually adding the lot.
