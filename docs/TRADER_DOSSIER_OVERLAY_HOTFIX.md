# Trader Dossier Overlay Hotfix

## Status

Focused implementation contract for issue #75.

- Runtime: `TornScripture-Item-Market-Margin.user.js`
- Release target: IMM `0.19.21`
- Branch: `agent/trader-dossier-overlay-hotfix`
- Scope: TornPDA overlay presentation only

## Observed failure

On TornPDA Android, opening an existing Trader Dossier can leave only a narrow strip visible at the left edge. Target Library and the main IMM panel remain visibly above most of the Trader Book overlay.

The dossier content itself renders and live Ledger-derived statistics work. The failure is modal layering and presentation, not trader data or accounting.

## Goal

Make the existing Trader Book overlay, including its internal dossier detail mode, behave as a true modal above ordinary IMM surfaces on TornPDA and desktop.

## Required behavior

- Keep exactly one Trader Book overlay owner: `APP.traderOverlayId`.
- Do not create a second dossier-specific overlay.
- Trader Book and dossier must render above the main IMM panel, Target Library, page badges, and other ordinary generated surfaces.
- Preserve intentional ordering for Ledger, receipt audit, confirmations, and toast notifications.
- Use a documented central overlay-layer convention rather than a one-off arbitrary z-index.
- Show a full-viewport dim backdrop.
- Center the modal with safe mobile padding.
- Dossier uses nearly the full available mobile width.
- Dossier scrolls vertically within the viewport.
- Long names, notes, item names, URLs, journal text, and transaction details wrap without horizontal overflow.
- Buttons and selects remain touch-friendly.
- Closing the Trader Book removes only its overlay and restores the underlying IMM interface.
- Repeated open, dossier open, back, close, and Torn navigation must not create duplicate overlays or controls.

## Implementation guidance

Inspect the complete stacking relationship among:

- `APP.panelId`
- `APP.traderOverlayId`
- `APP.ledgerOverlayId`
- `APP.receiptAuditOverlayId`
- Target Library and other generated IMM surfaces
- confirmation layers
- `#tsimm-toast`

Prefer named layer constants or CSS custom properties owned by IMM. Ordinary panels should sit below modal backdrops. Nested or higher-priority modal surfaces must remain intentionally ordered.

Do not paper over the failure by shrinking dossier typography or forcing a narrow width.

## Safety and non-goals

This hotfix must not change:

- trader records, roles, journals, favorites, dispositions, captured prices, or sorting
- Ledger lots, allocations, sales, cost basis, funding, receipts, or realized-profit calculations
- purchase or sale capture behavior
- Priced Trade counterparty safeguards
- Quick MAX or Override MAX
- Trade Exit Audit
- gameplay actions or automation boundaries
- compact Trader Book work tracked separately in issue #76

## Versioning

Update the five current IMM `0.19.20` runtime markers to `0.19.21`. Do not change unrelated script versions.

## Automated validation

Run and report:

```bash
node --check TornScripture-Item-Market-Margin.user.js
git diff --check
```

Verify:

- five `0.19.21` markers and zero stale `0.19.20` IMM owner markers
- protected functions remain exactly once
- storage-key set is unchanged
- no new trader or dossier overlay owner
- no new delegated or global event listener unless strictly necessary and explained
- Trader Dossier focused fixtures continue to pass
- overlay-layer ordering has a focused deterministic validation where practical
- diff is limited to the userscript and this contract unless another file is strictly necessary

## TornPDA smoke test

1. Install branch build over the existing IMM and confirm one enabled IMM at `0.19.21`.
2. Leave Target Library and the main IMM panel open.
3. Open Trader Book and confirm it is centered above ordinary panels with a full backdrop.
4. Open Heliumzx dossier and confirm the whole dossier is visible at near-full mobile width.
5. Confirm the linked sale still shows 1 trade, $191,106 cash received, +$13,116 tracked profit, and 97.5% observed payout.
6. Scroll through the dossier and confirm vertical scrolling, wrapping, and no horizontal page overflow.
7. Use Back to Trader Book, reopen the dossier, close the overlay, and navigate Torn repeatedly.
8. Confirm one Trader Book overlay and one internal dossier view only.
9. Confirm Ledger and receipt-audit modals still appear at their intended priority.
10. Confirm no purchase, sale, listing, removal, trade, payment, Quick MAX, or Override MAX action is triggered.

## Completion report

Report the exact root cause, layer convention introduced or reused, files changed, validation results, remaining manual tests, and any intentionally untouched systems. Keep the PR draft and unmerged until TornPDA smoke testing passes.