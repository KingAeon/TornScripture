# IMM v0.5.2 testing

## Fixed regression

v0.5.1's fast scanner only accepted prices held as direct text inside one DOM node. Torn's category tiles may split the lowest price and market quantity into nested spans, such as:

```html
<div><span>$251</span> <span>(122,491)</span></div>
```

That made the category page report zero candidates and removed all margin marks.

v0.5.2 keeps the fast direct-text path, then falls back to combined visible text only when needed. It also avoids resolving an item-listing value when no seller rows exist, preventing category pages from being misreported as a specific item listing.

## Test

1. Replace v0.5.1 with v0.5.2.
2. Open an Item Market category such as Flowers.
3. Confirm tiles receive gold, green, purple, or red overlays.
4. Switch into an individual item and confirm seller rows are marked quickly.
5. Switch back to the category page and confirm marks return.
6. Copy diagnostics if either view reports zero candidates after the page is visibly loaded.

Existing catalog, ledger, traders, sales, audits, and settings use unchanged storage keys.
