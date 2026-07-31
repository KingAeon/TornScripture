# Black Ledger Acquisitions Desk

## Status

Deferred design contract. This document reserves the buy-side architecture without changing Item Market Margin runtime behavior.

Current foundation at IMM v0.19.17 already owns:

- purchase capture after Torn reports success
- purchase lots and remaining quantities
- FIFO sale allocations
- realized-profit recording
- capital-source tracking
- receipt audits
- read-only ledger integrity reporting

The Acquisitions Desk must extend these owners. It must not create a second ledger, lot allocator, purchase recorder, receipt store, or trader store.

## Purpose

Black Ledger currently helps evaluate market purchases and account for later sales. The Acquisitions Desk will eventually let sellers bring inventory to the user through published buy prices and incoming Torn trades.

The intended loop is:

1. Black Ledger calculates a conservative maximum buy price.
2. A public pricelist advertises the current offer.
3. A seller opens a Torn trade.
4. Black Ledger evaluates the visible trade manifest.
5. The user reviews the recommendation and independently performs every Torn action.
6. A completed purchase creates normal Black Ledger lots.
7. A customer receipt and an internal acquisition receipt are generated from the same recorded transaction.
8. Later sales consume those lots through the existing FIFO allocation path.

## Non-negotiable boundaries

- No unattended buying, accepting, sending money, or completing trades.
- Recommendations and field filling remain visibly separate from Torn actions.
- Every gameplay-changing action remains user-triggered.
- No external service becomes the authoritative accounting store.
- Black Ledger remains the source of truth for lots, allocations, costs, and realized profit.
- Weaver and TornExchange integrations are adapters, not replacement ledgers.
- Existing storage keys and ledger schemas remain backward compatible.
- Customer receipts never reveal internal exit prices, target margins, or projected profit.

## Deferred feature modules

### Public buying pricelist

Publishes the final amount currently offered for supported items. Prices may eventually account for:

- conservative expected bazaar exit
- minimum target profit
- volatility buffer
- current inventory exposure
- reserved-for-set quantities
- available trading capital
- item-specific quantity limits
- temporary event adjustments

### Incoming trade analysis

Reads the visible Torn trade manifest and produces a recommendation for each line:

- Approved
- Caution
- Declined

The analysis may display offered value, expected exit value, projected gross profit, projected margin, current inventory, remaining item limit, and the reason for any warning.

It must not accept, complete, or fund a trade automatically.

### Quantity and capital limits

The first pilot rules remain:

- maximum Black Ledger exposure: $6,000,000 Torn cash or 25% of liquid cash, whichever is lower
- museum pilot inventory: up to five plushie sets and five flower sets
- initial strategy: three set-equivalents available for individual sales and two retained as complete sets

These values must eventually be configurable rather than hard-coded into accounting logic.

### Receipts

Two views should be generated from one recorded acquisition.

Customer receipt:

- seller identity
- Torn trade identifier when available
- date and time
- item names, quantities, unit prices, and line totals
- total payment
- manual adjustments disclosed without internal strategy data
- Black Ledger receipt identifier

Internal acquisition receipt:

- all customer receipt fields
- pricing reference and timestamp
- expected exit value
- target margin and projected profit
- rule or limit overrides and reasons
- created lot identifiers
- adapter source, such as Weaver or TornExchange

### Supplier history

Supplier records should reuse or extend the existing trader book rather than creating a parallel contact system. Future supplier views may summarize purchase volume, receipt count, average margin, sell-through, disputes, notes, and hidden or avoided status.

## Lot-provenance contract

Before Acquisitions Desk UI work begins, a normal purchase lot must be able to preserve optional acquisition provenance without affecting existing market purchases.

Candidate optional fields:

- `counterpartyUserId`
- `counterpartyName`
- `tradeId`
- `receiptId`
- `receiptProvider`
- `pricingReference`
- `pricingReferenceAt`
- `expectedExitUnitValue`
- `targetMarginPercent`
- `projectedProfitTotal`
- `overrideReason`

Implementation requirements:

- normalize missing values safely
- do not require these fields for existing lots
- preserve them during import, export, cleanup, reconciliation, and lot editing
- never use projected profit as realized profit
- continue using actual sale allocations for realized-profit calculations
- keep receipt identifiers stable after creation

This contract is intentionally descriptive. No schema change is authorized by this document alone.

## Delivery order

### Track A: finish Black Ledger accounting and inventory strategy

1. Keep purchase capture, lots, allocations, realized profit, reconciliation, and integrity checks stable.
2. Add the merchant-strategy layer for individual stock, reserved-for-set stock, and mixed strategy.
3. Show reserved versus freely sellable quantity.
4. Show complete-set capacity and missing set pieces.
5. Improve supplier and trader history using the existing trader book.
6. Complete ledger reporting and cleanup safeguards.

### Track B: Acquisitions Desk

1. Approve and implement the optional lot-provenance schema.
2. Add a read-only incoming trade evaluator.
3. Add customer and internal receipt rendering.
4. Add configurable buy rules and inventory limits.
5. Add a Weaver adapter.
6. Add a TornExchange adapter.
7. Add public pricelist publishing only after the internal price engine and limits are trustworthy.

## First implementation gate

The Acquisitions Desk must not begin until the current Track A patch is selected and validated. The next runtime patch should remain focused on Black Ledger inventory strategy rather than trade intake.

The safest first runtime target is:

> Classify lot quantities as individual stock, reserved for sets, or mixed, then calculate freely sellable quantity, complete-set capacity, and missing pieces without changing purchase or sale capture.

That patch is read-mostly, uses the existing lots, and gives future buying limits the inventory awareness they need.

## Validation expectations for future work

For each runtime patch:

- run `node --check TornScripture-Item-Market-Margin.user.js`
- run `git diff --check`
- verify `recordTradeSale`, `pricedTradeRenderRowBadge`, `pricedTradeEnsureNativeMaxButton`, and `normalizeLedger` still exist
- verify no storage key was renamed
- verify no purchase, sale, listing, trade, or payment action became automatic
- provide desktop and TornPDA manual smoke tests

Documentation-only changes do not require an IMM version bump.
