# Black Ledger: Compact Trader Book Density

## Release target

IMM `0.19.23`

## Tracking

Implements issue #80 after live TornPDA validation of IMM `0.19.22`.

## Problem

Compact mode is functionally correct, but it still behaves like a smaller detailed card. On a typical TornPDA phone viewport, the title, controls, six boxed metrics, and action row leave room for roughly one trader per screen. Compact mode must become a fast index.

## Product outcome

On a typical phone viewport, after the modal title, at least two ordinary collapsed trader rows must be simultaneously visible without shrinking touch targets below a practical size.

Compact mode should answer, at a glance:

- Who is this trader?
- Are they normal, avoided, or hidden?
- Are they a buyer, supplier, both, or unclassified?
- What payout do they target and what payout have we observed?
- Have we completed trades, and roughly how much cash is linked?
- How recent is the relationship and price information?
- Where do I open the full dossier?

Detailed mode and Trader Dossiers remain the full record.

## Required compact-toolbar behavior

When Compact mode is active on narrow/mobile viewports:

1. Keep the modal title and close control.
2. Replace the tall controls block with one compact toolbar containing:
   - sort select,
   - Compact / Detailed control,
   - a clearly labeled `Tools` disclosure.
3. Move Add trader, hidden visibility, Copy JSON, and Import JSON into the Tools disclosure.
4. Tools must default closed in Compact mode.
5. Opening Tools may increase height, but closing it must restore the dense layout.
6. Sort, mode, and hidden state must continue using the existing trader-view owner and persistence rules.
7. Detailed mode may retain the current control presentation unless sharing the compact toolbar is clearly safer and does not alter existing behavior.

Do not make controls undiscoverable or icon-only without accessible labels.

## Required compact-row structure

Each collapsed compact row should use a dense, touch-friendly structure rather than six separate metric boxes.

Recommended structure:

### Line 1: identity

- trader name
- Torn ID in muted text
- favorite control

### Line 2: state

- Normal / Avoid / Hidden chip
- Buyer / Supplier / Both / Unclassified chip
- optional stale/closed-price chip only if already supported by current data; do not implement issue #78 here

### Line 3: financial summary

Use a compact inline summary, for example:

- `Target 99.0%`
- `Observed 97.5%` or `Observed unavailable`
- `1 trade`
- `$191,106 cash`

Unknown values must remain honest. Do not convert missing history into zero activity.

### Line 4: freshness and actions

- relationship recency
- price freshness
- prominent `Open dossier`
- `More` disclosure

The exact visual grouping may differ, but it must achieve the density gate and preserve clarity.

## More disclosure

The existing secondary controls remain available through the row's More disclosure:

- Profile
- Price page
- Start trade / Start priced trade
- Open and recapture
- Arm price capture
- Favorite where appropriate
- Edit
- Delete
- Avoid / Hide / Restore and related classification controls
- Deals count/action

Opening More must expand only that trader row. It must not trigger navigation, capture, or gameplay actions by itself.

## Density acceptance gate

At TornPDA portrait width around 360 to 430 CSS pixels:

- at least two ordinary collapsed compact rows must fit below the modal title at once,
- a third row should be at least partially visible where viewport height reasonably allows,
- the toolbar must not consume more vertical space than one compact row when Tools is closed,
- no horizontal overflow may appear,
- touch targets must remain practical,
- long names and values must wrap or truncate safely.

Do not satisfy the gate by making fonts unreadably small or touch targets tiny.

## Shared sequence and state

Compact and Detailed must continue consuming the exact same filtered and sorted trader sequence.

Preserve:

- sort persistence,
- Compact / Detailed persistence,
- hidden visibility state,
- favorites,
- dispositions,
- relationship roles,
- price-page history,
- Trader Dossier state and Back behavior,
- IMM `IMM_LAYERS` overlay convention,
- one Trader Book overlay owner,
- Target Library ownership and delayed-decoration guard,
- existing Ledger-derived statistics.

## Scope boundaries

Presentation only.

Do not change:

- trader storage ownership or schema beyond existing v0.19.22 view fields,
- Ledger lots, sales, allocations, costs, funding, profit, receipts, or integrity,
- purchase or sale capture,
- price-refresh queue reliability tracked in issue #78,
- Priced Trade, Quick MAX, Override MAX, or Trade Exit Audit,
- gameplay or automation boundaries,
- dossier accounting or supplier placeholders.

Do not add:

- a new storage key,
- a new overlay owner,
- a new event-listener owner,
- a new observer or timer owner,
- a parallel compact-trader data model.

## Versioning

Update all five IMM runtime/version markers from `0.19.22` to `0.19.23`.

## Automated validation

Run and report:

1. `node --check TornScripture-Item-Market-Margin.user.js`
2. `git diff --check`
3. five `0.19.23` markers and zero stale `0.19.22` markers
4. protected function-definition counts exactly once for:
   - `recordTradeSale`
   - `pricedTradeRenderRowBadge`
   - `pricedTradeEnsureNativeMaxButton`
   - `normalizeLedger`
   - `normalizeTrader`
   - `traderSalesFor`
   - `traderStats`
   - `renderTraders`
   - `traderCardHtml`
   - `traderDossierHtml`
5. storage-key set unchanged
6. listener, MutationObserver, interval, timeout-owner, and overlay-owner comparisons
7. `IMM_LAYERS` unchanged
8. focused fixtures covering:
   - compact toolbar default-closed Tools state,
   - Tools open/close determinism,
   - same filtered/sorted sequence in both modes,
   - unknown metric labels,
   - long-name rendering,
   - one row disclosure at a time or documented current behavior,
   - mode/sort/hidden persistence,
   - dossier Back preserving mode and sort,
   - repeated rendering without duplicate controls,
   - Detailed-mode regression preservation.

## Manual smoke test after implementation

### Install

1. Back up Trader Book JSON using the existing Copy JSON control.
2. Install the branch userscript from:
   `https://raw.githubusercontent.com/KingAeon/TornScripture/agent/compact-trader-density/TornScripture-Item-Market-Margin.user.js`
3. Confirm exactly one IMM script exists and version reads `0.19.23`.
4. Do not use the global userscript update button until the PR is merged.

### TornPDA density test

1. Open Torn Items with the main IMM panel visible.
2. Open Trader Book in Compact mode.
3. Leave Tools closed.
4. Capture a screenshot showing the modal title, compact toolbar, and trader list.
5. PASS only if at least two complete ordinary collapsed trader rows are simultaneously visible below the title on the test phone. A third partial row is preferred.
6. Confirm no horizontal overflow and no unreadably small controls.

### Toolbar test

1. Change sort and confirm order changes.
2. Open Tools and confirm Add trader, hidden toggle, Copy JSON, and Import JSON are reachable.
3. Close Tools and confirm the dense list height returns.
4. Reload Torn and confirm explicit mode and sort persistence remain correct.

### Trader-row test

1. Verify Heliumzx still displays the known linked history accurately where shown:
   - 1 completed sale
   - $191,106 cash received
   - 97.5% observed payout
   - +$13,116 tracked realized profit remains available in the dossier
2. Open More on one trader and confirm all secondary controls remain reachable.
3. Close More and confirm the row returns to dense height.
4. Open Heliumzx's dossier, then Back to Trader Book.
5. Confirm Compact mode, sort, scroll context where practical, and one overlay remain.

### Regression test

1. Switch to Detailed and confirm existing detailed cards remain intact.
2. Switch back to Compact.
3. Favorite a harmless trader, hide/show/restore a harmless trader, and confirm persistence.
4. Open and close Trader Book three times and navigate Torn.
5. Confirm no duplicate rows, controls, overlays, stuck backdrop, or unintended gameplay action.
6. Open Ledger Integrity and confirm it remains clean.

### Failure conditions

Do not merge if:

- fewer than two full collapsed rows fit on the test phone,
- toolbar controls become undiscoverable,
- More or dossier controls disappear,
- sorting/filtering/persistence resets,
- horizontal overflow appears,
- duplicate rows or overlays appear,
- any accounting or gameplay action changes unexpectedly.

### Rollback

If the branch build misbehaves:

1. Do not delete userscript storage.
2. Reinstall live main:
   `https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-Item-Market-Margin.user.js`
3. Confirm version returns to `0.19.22` until the hotfix is merged.
4. Restore Trader Book JSON only if trader data was unexpectedly altered.

## Delivery requirements

Commit and push only to `agent/compact-trader-density`.
Update the existing draft PR with exact implementation and validation results.
Keep the PR draft, open, unmerged, and not ready for review until the manual smoke test passes.