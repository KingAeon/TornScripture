# IMM v0.5.0 testing

## Upgrade

Replace the previous Item Market Margin userscript with `TornScripture-Item-Market-Margin.user.js`.
Existing catalog values, purchase lots, recorded sales, trader records, settings, and profile captures use the same local-storage keys and should remain available.

## Trader banner test

1. Open **IMM → Traders**.
2. Find a trader captured from a profile page.
3. Confirm the trader's name is visibly layered over the captured banner.
4. Confirm the Torn ID appears under the name when available.
5. Tap the banner and confirm it opens that trader's Torn profile.
6. Confirm **Start trade**, rating, target payout, notes, and recorded-sale totals still work.

## Receipt audit test

1. Open **IMM → Ledger**.
2. Under **Sale history**, press **Audit sale** on a recorded trade.
3. Paste one of the following:
   - copied receipt JSON containing item names or IDs, quantities, item values, and a receipt total;
   - copied receipt text with one item per line, such as `Nessie Plushie x132 @ $23,701 = $3,128,532`;
   - a TornPDA receipt message or receipt URL.
4. Press **Parse preview**.
5. Review the overall status and each matched item.
6. Press **Save audit**.
7. Close and reopen the ledger. Confirm the saved audit status remains attached to that sale.

A receipt link by itself is saved as **Link saved**. It does not become a verified item audit until receipt details are pasted. This avoids silently guessing values from an external page.

## Audit colors

- **Gold verified:** receipt value is above the recorded 99% target.
- **Verified:** receipt value matches the recorded 99% target.
- **Below target:** items and quantities match, but payout is below target.
- **Mismatch:** receipt cash, item, or quantity differs from the recorded sale.
- **Needs review:** details are present but not fully priced.
- **Link saved:** only a receipt URL was available.

## Safety checks

- Parsing or saving a receipt audit must not change purchase-lot quantities.
- It must not consume ledger lots again.
- It must not rewrite the recorded trade cash, target, cost basis, or profit.
- Receipt text and links remain local to the browser and are included in ledger JSON exports.

## Formats intentionally deferred

Manual per-item receipt editing and screenshot recognition are not included in this build. A future parser can be expanded from real receipts that fail the current text/JSON matcher.
