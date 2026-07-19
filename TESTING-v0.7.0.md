# TornScripture Item Market Margin v0.7.0 testing

## Purchase ledger redesign

Open **IMM → Ledger**.

The ledger now opens on **Current holdings** and includes three pages:

1. **Current holdings**: lots with quantity remaining.
2. **Purchase history**: all purchase lots, with a live **Show sold purchases** toggle.
3. **Sale audits**: the existing completed-sale and receipt-audit records.

Each purchase card shows only the useful purchase information:

- Item obtained
- Original quantity
- Remaining quantity
- Price paid per item
- Total paid
- Possible profit when bought
- Possible profit now on the remaining quantity
- Open, partial, or sold status
- Purchase date

## Profit behavior

- **Possible profit when bought** uses the market value captured with the purchase and the original quantity.
- **Possible profit now** uses the latest synced catalog value and the remaining quantity.
- Fully sold lots show **Sold out** instead of a current possible-profit number.
- Missing values show **Original value unavailable** or **Current value unavailable** instead of a false loss.
- Gold, green, purple, and red use the existing IMM profit thresholds.

## Search and sorting

On Current holdings and Purchase history:

- Search filters by item name only.
- Sort choices: Newest, Oldest, Highest profit now, Item name, and Purchase price.
- The Show sold purchases toggle filters sold lots immediately.

## Seller privacy migration

On first v0.7.0 load:

- Existing `Seller: ...` text is removed from item-market lot notes and saved back to the ledger.
- New item-market purchases do not store the seller name.
- Old duplicate-detection fingerprints that may have contained a seller name are cleared.
- Trader names attached to actual sales and the Trader Book are not changed.

## Remote updates

The userscript header now includes explicit GitHub `@downloadURL` and `@updateURL` metadata. The GitHub main file must contain v0.7.0 before TornPDA can detect this release remotely.

## Suggested checks

1. Open the ledger and confirm it begins on Current holdings.
2. Search for a known item.
3. Open Purchase history and toggle sold purchases off and on.
4. Compare an open lot's original and current possible profit.
5. Confirm a sold lot displays Sold out.
6. Copy the ledger JSON and verify old item-market notes no longer contain `Seller:`.
7. Confirm the Sale audits page still opens existing receipt audits.
