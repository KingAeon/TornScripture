# Black Ledger Trader Dossiers

## Status

Implementation contract for the next focused Item Market Margin patch.

- Target script: `TornScripture-Item-Market-Margin.user.js`
- Target release: IMM `0.19.20`
- Working branch: `agent/trader-dossiers`
- Product track: Track A, Black Ledger accounting and history
- Explicitly deferred: Acquisitions Desk, incoming-trade evaluation, supplier purchase accounting, Weaver/TornExchange adapters, and public pricelist publishing

## Goal

Extend the existing Trader Book into **Trader Dossiers** that summarize the relationship and transaction history already proven by local Black Ledger data.

Do not create a second contact book, second trader store, or parallel accounting system.

The feature must remain read-only with respect to Torn gameplay. It may store browser-local classification and journal metadata only after explicit user actions.

## Existing owners to extend

Inspect and extend the established IMM owners before editing:

- `APP.tradersStorageKey` / `tornscripture-imm-traders-v1`
- `normalizeTrader`
- `normalizeTraders`
- `upsertTrader`
- `traderSalesFor`
- `traderStats`
- current Trader Book render path, filters, sorting, edit flow, price capture, favorites, and classification controls
- existing Ledger sale records and their FIFO allocations

Preserve early trader price-page capture and all compatibility with the current trader-store shapes.

## Product decisions

### One relationship book

A trader may be classified as:

- Buyer
- Supplier
- Both
- Unclassified

Use the existing trader record and storage key.

A completed Ledger sale linked by Torn user ID or normalized counterparty name is valid evidence that the trader has acted as a buyer. The UI may derive a Buyer role from linked sales without silently overwriting explicit stored role metadata.

Supplier status is user-classified only in this patch. Do not infer supplier purchase volume, margins, sell-through, or receipt totals because current purchase lots do not yet preserve acquisition counterparties.

### Existing notes remain valid

Preserve the existing `notes` string as a legacy/general note.

Add an append-only, timestamped relationship journal. New journal entries must not overwrite old entries.

Candidate normalized entry shape:

```js
{
  id: 'stable-local-id',
  createdAt: 'ISO timestamp',
  text: 'cleaned note text'
}
```

Requirements:

- browser-local only
- stable IDs after creation
- normalize malformed data safely
- trim empty entries
- preserve valid entries during reload and store normalization
- no silent deletion of the legacy `notes` field
- deleting a journal entry, if supported, requires an explicit action and confirmation

## Dossier contents

Open a dossier from each existing Trader Book card without creating a competing top-level Trader Book owner.

Prefer an internal detail mode within the existing Trader Book overlay. Repeated opening, closing, filtering, and Torn navigation must not create duplicate overlays, listeners, timers, or cards.

### Header and relationship data

Show:

- trader name and Torn user ID when known
- Buyer / Supplier / Both / Unclassified role
- favorite state
- Normal / Avoid / Hidden disposition
- avoid reasons
- user rating
- target payout percentage
- profile and trade links when available
- legacy/general note

### Proven sale history

Derive from the existing Ledger at render time. Do not copy sales into the trader record.

Show:

- completed sale count
- total cash received
- tracked realized profit
- effective payout percentage from cash received divided by recorded market total
- last completed sale date
- recent completed transactions
- top items sold by total quantity

Where sale records lack full FIFO coverage or profit data, label the missing or partial accounting honestly. Never manufacture profit.

Recent transaction rows should provide useful compact details such as:

- date
- sale ID or trade identifier when available
- cash received
- market reference total
- effective payout percentage
- tracked quantity versus untracked quantity
- realized or tracked profit when available
- receipt-audit status when available

Top-item summaries should aggregate existing sale item rows defensively using item ID when present and normalized item name otherwise. Show quantity and optionally cash/profit only where the stored sale-item schema supports it reliably.

### Price-page history

Reuse the trader’s existing captured pricelist fields.

Show:

- provider
- captured item count
- capture timestamp
- last checked timestamp
- capture count
- changed-item count from the last capture
- captured URL/title when available
- freshness state using existing project conventions where possible

Do not perform background price refreshes from the dossier.

### Supplier section

When Supplier or Both is selected, show a clear placeholder such as:

> Supplier accounting is not recorded yet. Future acquisition receipts will provide purchase volume, margin, sell-through, and dispute history.

Do not substitute manually written notes, captured public pricelists, or market purchases as supplier accounting evidence.

### Relationship journal

Show journal entries newest first with timestamp and text.

Provide an explicit Add note action. Use a mobile-safe prompt or in-overlay form consistent with current IMM patterns.

New entries append to the trader record and update `updatedAt`.

## Trader Book improvements

Extend, rather than replace, existing controls.

Add dossier opening from a trader card.

Add sorting options for:

- recent relationship activity
- completed sale volume or cash received
- tracked realized profit
- effective payout percentage

Preserve current sorts and filters unless there is a compelling compatibility reason. Hidden traders must remain excluded from normal recommendation paths exactly as they are now.

Recent relationship activity should use the newest trustworthy timestamp among linked completed sales, journal entries, captured price-page activity, disposition changes, and trader updates.

## Storage and migration

Keep `tornscripture-imm-traders-v1` unchanged as the sole trader-book key.

Add only backward-compatible optional trader fields, such as:

```js
relationshipRoles: []
relationshipJournal: []
```

Exact names may follow existing code style, but document the final choice in the PR.

Normalization requirements:

- accept missing fields
- accept a legacy scalar role if encountered
- restrict roles to `buyer` and `supplier`
- deduplicate roles
- normalize journal entries
- preserve old array and object-wrapped trader-store forms
- preserve price-page capture fields
- preserve favorites, rating, target percentage, disposition, hidden state, avoid reasons, URLs, notes, and timestamps

Do not rename storage keys or reset existing records.

## UI and accessibility

- TornPDA Android is first-class
- no fixed width that causes horizontal overflow
- controls must work by touch without hover
- long names, notes, URLs, and item names must wrap
- dossier sections may use native disclosure elements for compact mobile navigation
- closing the dossier must return to the current Trader Book state without losing filters or sort selection
- preserve dark, light, and automatic theme behavior

## Safety boundary

This patch must not:

- buy, sell, list, remove, send, accept, or complete anything in Torn
- add or alter Ledger lots, allocations, sales, costs, funding, or realized-profit calculations
- weaken Priced Trade counterparty verification
- alter Quick MAX or Override MAX behavior
- alter Trade Exit Audit removal or confirmation gates
- fetch external pricelists automatically
- begin Acquisitions Desk implementation

## Versioning

For the release-ready userscript patch, change every matching `0.19.19` IMM version marker to `0.19.20`, including:

- userscript metadata
- core ownership markers
- header comment
- `APP.version`
- any other exact current-version markers owned by IMM

Do not change unrelated script versions.

## Required implementation validation

Run and report exact results for:

```bash
node --check TornScripture-Item-Market-Margin.user.js
git diff --check
```

Also verify:

- `0.19.20` appears in every required IMM marker and no stale `0.19.19` owner marker remains
- `recordTradeSale` exists exactly once
- `pricedTradeRenderRowBadge` exists exactly once
- `pricedTradeEnsureNativeMaxButton` exists exactly once
- `normalizeLedger` exists exactly once
- `normalizeTrader` exists exactly once
- `traderSalesFor` exists exactly once
- `traderStats` exists exactly once
- existing storage-key strings were not renamed
- no API keys, cookies, private exports, or personal inventory data entered the diff
- only the focused userscript and this design document are touched unless another file is strictly necessary and explained

Add focused calculation fixtures or a temporary validation harness for:

- legacy trader normalization
- Buyer role derived from linked sales
- Supplier and Both role display
- journal normalization and append behavior
- trader-to-sale linking by user ID and name fallback
- partial/untracked sale accounting labels
- top-item aggregation
- sort ordering and null-safe metrics
- deterministic repeated dossier rendering

Do not retain a one-use patcher or fixture file unless it is intentionally useful to the repository.

## Manual TornPDA smoke test

1. Install the branch userscript over the current IMM and confirm one enabled IMM at version `0.19.20`.
2. Open Torn, open the existing Trader Book, and confirm existing traders, favorites, classifications, captured pricelists, and notes remain present.
3. Open a trader with recorded Ledger sales and confirm one dossier appears with sale count, cash, payout percentage, profit where tracked, recent transactions, and top items.
4. Confirm a linked completed sale is recognized by Torn user ID and that name fallback still works for older records.
5. Set the relationship role to Supplier and confirm the supplier-accounting placeholder appears without invented financial metrics.
6. Set the relationship role to Both and confirm buyer history remains visible beside the supplier placeholder.
7. Add two journal entries, close and reopen the dossier, then reload Torn and confirm both entries persist newest first.
8. Exercise the new sort options and confirm traders with missing metrics do not produce NaN, Infinity, or broken ordering.
9. Confirm Avoid and Hidden behavior remains unchanged in recommendations and normal Trader Book views.
10. Confirm price capture, profile links, trade links, and existing edit controls still work.
11. Confirm one Trader Book owner and one dossier view only after repeated open/close and Torn navigation.
12. Confirm no horizontal page overflow and all controls remain touch-usable.
13. Open Black Ledger Integrity and confirm no issues were introduced.
14. Confirm no Torn purchase, sale, listing, removal, trade, payment, Quick MAX, or Override MAX action is triggered by dossier controls.

## Desktop smoke test

Repeat the core Trader Book, dossier, persistence, sort, role, journal, and duplicate-owner checks in a desktop userscript manager.

## Completion report format

The implementation PR must report:

1. What changed
2. Why it changed
3. Files touched
4. Storage and migration decisions
5. Exact validation results
6. Manual tests still required
7. Risks, assumptions, and intentionally untouched systems
