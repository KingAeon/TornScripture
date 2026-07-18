# IMM v0.4.1 testing

## Purpose

This build repairs trader identity capture and sale-to-trader history linking.

## Profile capture test

1. Open a trader's Torn profile page, for example `profiles.php?XID=...`.
2. Expand IMM.
3. Confirm the panel shows `profile`, the detected Torn ID, and whether a horizontal banner was found.
4. Press **Capture profile**.
5. Enter only your rating, preferred payout percentage, and notes. The name, ID, profile link, trade link, and detected banner are captured from the page.
6. Open **Traders**.
7. Tap the trader's banner or name. It should open that profile.
8. Press **Start trade**. It should open Torn's start-trade page for that player.

If no suitable horizontal banner is present, the trader's name becomes the profile button instead.

## Existing completed-sale link test

This build normalizes legacy headings such as `Slurpas' items traded` to `Slurpas`.

After capturing the matching profile, previously recorded sales should immediately appear in that trader's:

- recorded trade count
- cash received
- tracked profit
- observed payout
- last trade date

This only adds trader identity metadata to an existing sale record. It does not consume ledger quantities again.

If the completed trade was never recorded in the ledger at all, reopen its **view** page and scan or record the completed sale there first. A profile page alone cannot reconstruct a missing trade manifest.

## Regression checks

- Item Market overlays still scan.
- Trade manifests still scan and calculate 99% targets.
- Existing trader notes, ratings, ledger lots, and sale history remain intact.
- Capturing the same profile twice updates the existing trader instead of making a duplicate.
