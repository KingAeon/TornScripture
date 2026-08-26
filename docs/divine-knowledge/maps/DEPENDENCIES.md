# Dependency Map

## Current Discovery spine

`DQ-KEY-001` → `DQ-MARKET-001` → **`DQ-EXT-001`** → `DQ-KEY-002` → future War Intelligence Discovery

## Trader reliability

`DQ-EXT-001 freshness + availability semantics` → issue #78 remaining trader-refresh lifecycle.

## Market intelligence

`DQ-MARKET-001 current-source semantics` + `DQ-EXT-001 external semantics` + future `market-history source validation` → issue #85 Market Pulse.

Validated history + event mapping + uncertainty/replay validation + inventory position → issue #108 Event Outlook / Inventory Equity / VaR.

## Accounting boundary

Market intelligence and trader quotes may inform user decisions, but Black Ledger cost basis/FIFO/realized profit remain governed by accounting evidence and `docs/LEDGER-INVARIANTS.md`.
