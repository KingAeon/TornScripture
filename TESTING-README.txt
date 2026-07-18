TornScripture Item Market Margin v0.2.1 hotfix

What changed:
- Compact item-listing pages no longer need a visible "Value: $..." panel.
- IMM reads itemID from the Item Market URL and resolves that item's cached market value.
- Listing candidates are counted before value resolution, improving diagnostics.
- Diagnostics now show listingMarketValue, source, item ID, and item name.

Existing cache and settings are preserved because storage keys did not change.
