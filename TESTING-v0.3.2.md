# Item Market Margin v0.3.2 testing

## What changed

- Completed trade sales can now consume matching purchase lots from the local ledger.
- Purchase lots are consumed FIFO: the oldest matching open lot is used first.
- Sold quantities reduce `remainingQuantity`; fully consumed lots become `closed` and no longer count as invested/on-hand stock.
- The trade card now previews ledger cost basis, ledger coverage, and actual sale profit.
- Completed trades are recorded automatically only when Torn clearly exposes a completed trade/log state and the ledger covers every sold quantity.
- A **Record completed sale** button is available for manual confirmation or partial ledger coverage.
- Ledger schema v2 adds sale history, realized profit, per-lot sale allocations, and closed-lot history.
- Existing v0.3.1 lots migrate automatically. A zero remaining quantity now stays zero after reload.

## First test

1. Replace v0.3.1 with v0.3.2.
2. Open the completed trade.
3. Press **Scan page**.
4. Check the new lines:
   - Ledger cost basis
   - Ledger coverage
   - Actual sale profit
   - Ledger sale state
5. If the trade is recognized as completed and every quantity exists in the ledger, it should record automatically.
6. Otherwise, press **Record completed sale** and review the confirmation.
7. Open the Ledger and verify:
   - sold quantities were removed from `remaining`
   - invested and expected totals fell
   - realized profit increased
   - the sale appears in Sale history

## Safety behavior

- IMM does not alter the Torn trade.
- The manual record button changes only IMM's browser-local ledger.
- A trade ID/fingerprint prevents the same sale from being recorded twice.
- Partial coverage is clearly labeled and reports tracked profit rather than pretending the missing cost basis is known.
