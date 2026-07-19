# Item Market Margin v0.5.1 performance hotfix

## What changed

- Replaced the old 450 ms reset-on-every-mutation debounce with a two-pass scanner:
  - a fast leading scan after roughly 35 ms
  - one verification scan after the page has been quiet for roughly 520 ms
- Limited scans to no more than about once every 90 ms during heavy Item Market rendering.
- Existing category and listing badges are updated in place instead of being removed and rebuilt on every scan.
- Stale badges are pruned only after the replacement page has been scanned.
- DOM changes inside IMM's Ledger, Trader Book, receipt audit, panel, and generated badges no longer trigger market rescans.
- Unrelated page text changes are ignored unless they resemble Item Market, trade, or profile data.
- Added a page-transition guard so a new item ID cannot be applied to the previous item's still-visible listing rows.
- Receipt auditing, ledger lots, sales, trader profiles, and the 99% calculation policy are unchanged.

## Live test

1. Replace v0.5.0 with v0.5.1 and reload TornPDA's webview.
2. Open an Item Market listing with multiple sellers.
3. Switch between several items using Torn's back/category controls.
4. Confirm badges appear quickly rather than waiting for the page to fully settle.
5. Confirm existing badges do not disappear and reappear during the quiet verification pass.
6. Confirm every visible seller row has no more than one IMM badge.
7. Change the gold/green thresholds and confirm the existing badges recolor without duplicating.
8. Open the Ledger, Trader Book, and receipt audit. Interacting with those overlays should not cause listing badges to refresh behind them.
9. Smoke-test one trade manifest and one purchase capture to confirm those v0.5.0 features remain intact.

## Diagnostics to send if a page is still slow

After switching to the delayed page, press **Copy diagnostics** once prices finally appear and include:

- a screenshot taken before the prices appear
- a screenshot after they appear
- an estimate of the delay
- whether the delay happens on category tiles, seller listings, or both
