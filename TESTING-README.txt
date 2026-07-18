TornScripture - Item Market Margin v0.1.0
PHASE-ONE TEST BUILD

WHAT THIS TESTS
- Category-page detection of item name, lowest market price, and displayed market quantity.
- 99% trader-payout comparison using Torn's official market value.
- Purple badges for positive but minor margins.
- Green badges for margins meeting both default thresholds:
    $100 profit per item
    0.25% ROI
- Item-detail listing detection with profit per item, whole-lot profit, and ROI.
- Dynamic rescanning as Torn changes pages without a full reload.

INSTALL
1. Open TornPDA Script Manager.
2. Import or paste TornScripture-Item-Market-Margin.user.js.
3. Save and enable it.
4. Open Torn's Item Market.

FIRST RUN
1. Open the small IMM panel.
2. Press Sync values once.
3. The script automatically reuses the API key saved by Inventory Sales HUD when available.
4. If no key is found, enter a Limited Access Torn API key when prompted.

WHAT TO CHECK
A. Category page
- Profitable items should receive a badge in the upper-right of their tile.
- Purple means positive but below the green thresholds.
- Green means it meets both green thresholds.
- Losing items are intentionally left unmarked on the category page.

B. Individual item page
- Visible seller rows should gain profit per item, total lot profit, and ROI.
- Losing rows are shown in gray during this test phase.
- The displayed Value on Torn is used for the 99% calculation.

IF SOMETHING IS WRONG
- Press Scan page once.
- Press Copy diagnostics.
- Send the copied text together with a screenshot of the affected page.

SAFETY
This script never clicks Buy and never submits a market action. All purchases remain manual.
