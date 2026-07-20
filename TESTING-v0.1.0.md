# IMM Trader Price Report Add-on v0.1.0

## Why this is separate

This add-on leaves the confirmed-working IMM v0.9.1 file untouched. It reads IMM's saved traders, captured pricelists, catalog cache, and open ledger lots only after the Trader Book is opened.

## Install

1. Keep **TornScripture - Item Market Margin v0.9.1** installed and enabled.
2. Add `TornScripture-IMM-Trader-Report.user.js` as a second userscript in TornPDA.
3. Leave injection time at **END**.
4. Open a fresh Torn page.

## Test

1. Open IMM and press **Traders**.
2. A trader with captured prices should have a blue **Price report** button.
3. Open the report and confirm four groups appear:
   - Sell to trader
   - Near target
   - Withhold
   - No market value
4. Confirm the report uses the trader's saved target percentage, normally 99%.
5. Change **Near range** and confirm items move between Near and Withhold.
6. Use **Owned only** and confirm it filters using open IMM ledger lots.
7. Search and sorting should update without closing the report.
8. Press **Copy report** and paste into a note to verify tab-separated output.

## Important

- This add-on does not request or store an API key.
- Use the main IMM **Sync values** button before relying on a report.
- Deleting or disabling the add-on does not remove IMM traders, captures, ledger lots, or settings.
