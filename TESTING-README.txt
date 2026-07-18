TornScripture - Item Market Margin v0.1.1
PHASE-ONE AUDIT BUILD

WHAT CHANGED
- Trader payout is now hard-locked to:
    floor(Torn Market Value × 0.99)
- Profit is always:
    99% trader payout − visible listing price
- Every badge now shows the source Market Value and calculated 99% payout.
- Red badges and red outlines now identify non-profitable category tiles and seller rows.
- Purple remains a positive minor margin.
- Green remains a positive margin meeting both configured green thresholds.

DEFAULT COLOR LOGIC
- Green:
    Profit is positive
    Profit each is at least $100
    ROI is at least 0.25%
- Purple:
    Profit is positive, but misses one or both green thresholds
- Red:
    Listing price is equal to or above the 99% trader payout

EXAMPLE
African Violet Market Value: $56,390
99% trader payout: floor($56,390 × 0.99) = $55,826

A listing at $55,800:
$55,826 − $55,800 = +$26 each
This is purple under the default thresholds.

A listing at $55,994:
$55,826 − $55,994 = -$168 each
This is red.

INSTALL
1. Replace v0.1.0 with TornScripture-Item-Market-Margin.user.js from this folder.
2. Save and enable it in TornPDA.
3. Open Torn's Item Market.
4. Press Scan page if TornPDA does not refresh the page immediately.

WHAT TO CHECK
A. Category page
- All recognized item tiles should now show a badge while red display is enabled.
- Each badge should show:
    profit or loss per item
    Torn Market Value
    calculated 99% payout
    ROI
- Confirm the tile's visible lowest price produces the shown margin.

B. Individual item page
- Every recognized seller row should show the same Market Value and 99% payout.
- The row's visible listing price and quantity should produce the displayed unit and lot result.

HUD CHECKBOX
- "Show red non-profitable items" can hide red badges after testing.
- Keep it enabled for this audit pass.

IF SOMETHING IS WRONG
- Press Scan page once.
- Press Copy diagnostics.
- Send the copied text with a screenshot.

SAFETY
The script never clicks Buy and never submits a market action. All purchases remain manual.
