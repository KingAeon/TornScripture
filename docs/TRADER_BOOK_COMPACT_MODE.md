# Black Ledger Compact Trader Book

## Status

Implementation contract for issue #76.

- Target script: `TornScripture-Item-Market-Margin.user.js`
- Working branch: `agent/compact-trader-book`
- Target release: IMM `0.19.22`
- Product track: Track A, Trader Book usability
- Explicitly deferred: trader-price refresh reliability tracked in issue #78, acquisition accounting, Acquisitions Desk, and gameplay automation

## Goal

Make the Trader Book useful for rapid mobile scanning while preserving the existing detailed cards and Trader Dossiers.

The compact list is an index. The Trader Dossier remains the full relationship and accounting record.

Do not create another trader store, overlay owner, accounting source, or contact system.

## Existing owners to extend

Inspect and extend the current owners before editing:

- `APP.tradersStorageKey` / `tornscripture-imm-traders-v1`
- `APP.traderViewStorageKey`
- `state.traderUi`
- `saveTraderView`
- `renderTraders`
- `traderCardHtml`
- `traderDossierHtml`
- `traderStats`
- existing sorting, hidden filtering, favorites, dispositions, price-page state, and dossier actions
- the centralized `IMM_LAYERS` overlay convention introduced in IMM `0.19.21`

Preserve the one existing Trader Book overlay owner and the fixed overlay behavior.

## Product decisions

### Two remembered views

Provide a clearly labeled toggle:

- Compact
- Detailed

Store the selected mode only as an optional property under the existing trader-view storage key. Do not add a new storage key.

Recommended normalized property:

```js
mode: 'compact' | 'detailed'
```

Accept missing or malformed values safely.

### Default behavior

When no valid saved preference exists:

- use Compact on narrow/mobile viewports, including TornPDA
- use Detailed on wider desktop viewports

Once the user explicitly chooses a mode, preserve it across reloads and viewport changes.

Do not repeatedly overwrite the stored choice based on screen width.

### Compact-row purpose

Compact mode must allow several traders to be visible per mobile screen. Aim for roughly three or more ordinary rows on a modern phone without requiring microscopic text.

Each compact row should prioritize:

- trader name
- favorite state
- Normal / Avoid / Hidden disposition
- relationship role where useful
- target payout percentage
- observed/effective payout when available
- completed trade count
- cash received
- recent relationship activity or last recorded trade
- price-page freshness or unavailable state using current stored facts
- one prominent `Open dossier` action

Keep unavailable metrics honest. Do not display `0` where the true state is unknown.

### Secondary actions

Do not place the entire detailed action farm on every compact row.

Use one of these focused patterns:

1. a small explicit `More` or disclosure control that expands only that row, or
2. move secondary actions into the dossier while retaining only the actions essential for rapid use.

At minimum, compact mode must preserve access to:

- Open dossier
- Favorite toggle
- Profile when available
- Start trade or priced trade when currently allowed
- Price page when available
- Edit / classification controls through either row expansion or dossier

Expanded state may remain session-only. It does not need a new persisted field.

Never make the whole row an ambiguous gameplay action. Opening a dossier is safe; starting a trade must remain an explicit labeled control.

## Detailed mode

Detailed mode must preserve the current Trader Book cards and behavior from IMM `0.19.21` unless a small shared layout cleanup is strictly necessary.

Do not remove current fields, controls, classifications, or captured price information.

## Header and controls

Keep the existing Trader Book summary, sort selector, add/import/export controls, hidden toggle, and other established controls.

Place the Compact / Detailed control near sorting so the scanning controls read as one toolbar.

On mobile:

- controls must wrap cleanly
- select and toggle targets must be touch-friendly
- no horizontal overflow
- the trader list must retain vertical scrolling inside the modal

## Sorting and filtering

Both modes must use the exact same filtered and sorted trader sequence.

Changing modes must not:

- reset the selected sort
- change hidden visibility
- reorder traders independently
- lose the active filter state
- alter favorite, disposition, role, or price data

Missing metrics must remain null-safe and sort last according to existing rules.

## Compact-row visual rules

- no full-width banner image by default in compact rows
- a small thumbnail may be used only if it does not materially increase row height
- long names must wrap or truncate without pushing controls off-screen
- status chips should remain legible at narrow widths
- use a compact metric grid or two-line summary rather than a long vertical field list
- avoid tiny text below practical touch/mobile readability
- retain dark/light/automatic theme behavior
- avoid horizontal page or modal overflow

The design should remain recognizably Black Ledger rather than becoming a generic table.

## Data and accounting rules

All metrics remain derived from existing trader records and live Ledger sales.

Do not copy sale totals into trader records.

Do not change:

- `traderSalesFor`
- FIFO allocation
- realized-profit calculation
- purchase or sale capture
- receipt auditing
- trader-price capture semantics
- target payout calculations

Compact mode is presentation only, plus its remembered view preference.

## Interaction and ownership safety

- one Trader Book overlay owner only
- no compact-specific overlay
- no new top-level event listener
- use existing delegated handlers
- no new MutationObserver or recurring timer
- repeated mode switching must not duplicate cards, controls, Target Library, listeners, or overlays
- opening a dossier and returning must restore the chosen mode, sort, filters, and scroll behavior reasonably

## Safety boundary

This patch must not:

- buy, sell, list, remove, send, accept, pay, or complete anything in Torn
- alter Quick MAX, Override MAX, Priced Trade verification, or Trade Exit Audit safeguards
- change Ledger lots, sales, costs, allocations, funding, or receipts
- implement issue #78 trader-price queue recovery
- begin Acquisitions Desk work

## Versioning

Update every matching IMM `0.19.21` runtime/version marker to `0.19.22`:

- userscript metadata
- core ownership markers
- header comment
- `APP.version`
- any other exact current IMM version marker

Do not change unrelated script versions.

## Required automated validation

Run and report exact results for:

```bash
node --check TornScripture-Item-Market-Margin.user.js
git diff --check
```

Also verify:

- `0.19.22` appears in every required IMM marker
- no stale `0.19.21` owner marker remains
- storage-key set is unchanged
- no new event listener, MutationObserver, recurring timer, or overlay owner was added
- `recordTradeSale` exists exactly once
- `pricedTradeRenderRowBadge` exists exactly once
- `pricedTradeEnsureNativeMaxButton` exists exactly once
- `normalizeLedger` exists exactly once
- `normalizeTrader` exists exactly once
- `traderSalesFor` exists exactly once
- `traderStats` exists exactly once
- `renderTraders` exists exactly once
- `traderCardHtml` exists exactly once
- `traderDossierHtml` exists exactly once
- existing `IMM_LAYERS` ordering remains intact
- no secrets or private exports entered the diff

Add focused fixtures or a temporary harness for:

1. missing mode defaults to Compact on narrow viewport and Detailed on wide viewport
2. saved Compact and Detailed preferences override viewport defaults
3. malformed mode normalizes safely
4. mode persistence stays inside the existing trader-view object
5. compact and detailed modes use the same sorted/filtered trader sequence
6. unknown payout/profit/freshness values render without `NaN`, `Infinity`, or fake zeroes
7. compact row rendering is deterministic
8. repeated mode switches do not duplicate trader rows or controls
9. dossier open/back preserves the selected mode and sort state
10. Avoid and Hidden traders retain their existing behavior

Remove one-use fixture files afterward unless they are intentionally useful.

## Manual TornPDA smoke test

1. Install the branch build and confirm one IMM at `0.19.22`.
2. Open Trader Book with 20+ saved traders.
3. Confirm Compact is selected by default on TornPDA when no saved mode exists.
4. Confirm several trader rows are visible on one screen.
5. Verify Heliumzx shows the known live figures where applicable: one recorded sale, `$191,106` cash received, `97.5%` observed payout, and the correct recent date.
6. Open Heliumzx dossier and return; confirm the book remains in Compact mode with the prior sort/filter state.
7. Toggle Detailed and confirm the established full card appears with existing controls intact.
8. Reload Torn and confirm the chosen mode persists.
9. Exercise every sort in both modes; confirm identical order and no broken values.
10. Toggle hidden traders and confirm current Normal/Avoid/Hidden rules remain unchanged.
11. Test favorite, profile, price page, dossier, and explicit trade actions through their intended controls.
12. Repeat Compact/Detailed, dossier open/back, close/reopen, and Torn navigation; confirm one overlay and no duplicate cards or controls.
13. Confirm no horizontal overflow and all controls work by touch.
14. Open Black Ledger Integrity and confirm no issues.
15. Confirm no compact-mode action triggers an unintended Torn gameplay action.

## Desktop smoke test

Repeat the core mode, persistence, sorting, filtering, dossier-return, and duplicate-owner tests. Confirm Detailed is the default on a wide viewport only when no preference has been stored.

## Completion report

The PR must state:

1. exact UI structure and defaults
2. storage/migration decision
3. files changed
4. exact validation results
5. manual tests still required
6. risks and intentionally untouched systems
