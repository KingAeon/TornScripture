# TESTING-v0.19.34.md — Manual Verification Plan

**Feature:** IMM API-backed Black Ledger completed-trade recovery  
**Issue:** #97  
**IMM version:** 0.19.34  
**Risk tier:** Tier 3  
**Environment:** TornPDA on Android (primary) · Tampermonkey on desktop (secondary)

---

## Prerequisites

1. GOBLIN GOD API key configured with `user → inventory`, `user → itemmarket`, `torn → items`.
2. Run **Check permissions** in the Ledger and confirm all four endpoints show ✓ (especially that the owner Torn ID is populated in the key profile).
3. Item catalog synced (recent values present).
4. At least one completed Torn trade present on the account within the API's retention window.
5. Purchase lots with open quantity for items sold in the target trade.
6. JSON backup exported via **Copy JSON** before starting any live mutation tests.

---

## Test cases

### T1 — API permission or key failure produces no mutation

1. Remove the API key (paste blank).
2. Open Ledger → **Recover recent API trade**.
3. Observe: overlay shows "No API key configured" message.
4. Confirm: no ledger mutation, lots and sales unchanged.
5. Re-configure the key.
6. With a valid key but key profile not yet verified (never ran **Check permissions**):
   - Open Ledger → **Recover recent API trade**.
   - Observe: overlay shows "API key owner identity is unknown" message.
   - No mutation.

---

### T2 — Recent finished trades load and a trade can be selected

1. Open Ledger → **Recover recent API trade**.
2. Observe: overlay shows "Loading recent trades…" briefly, then a list of finished trades.
3. Each entry shows Trade #ID, counterparty name if available, and relative time.
4. Active/non-finished trades must not appear.
5. Trades already recorded must not appear.
6. Tap **Review** on a trade with owned-item FIFO lots present.

---

### T3 — Review displays correct data (non-mutating)

1. Perform step T2 and tap **Review** on a valid trade.
2. Verify the review screen shows:
   - **API Trade ID** matching the selected trade
   - **Completed** timestamp from the API response
   - **Counterparty** name and Torn ID
   - **Counterparty cash** (their money_offer)
   - **My cash contributed** (if any)
   - **Net proceeds** = counterparty cash − my cash
   - **FIFO cost basis** computed from open purchase lots
   - **Realized profit** = net proceeds − FIFO cost basis
   - Each outgoing item with aggregated quantity and matching lot details
3. Open lot quantities in the Ledger remain unchanged after viewing this screen.
4. Close overlay: lots and sales remain unchanged.

---

### T4 — Cancel leaves ledger and inventory unchanged

1. Perform T2 → T3.
2. Press **× (close)** or **← Back** at any step.
3. Verify no new sale record appears in the Sale audits tab.
4. Verify open lot quantities are unchanged.

---

### T5 — Confirm records exactly one sale and consumes exact FIFO quantities

1. Perform T2 → T3.
2. Note the open lot quantities for the outgoing items (before confirm).
3. Press **✓ Record sale — consume N lot units**.
4. Verify toast: "API trade #XXXX recovered. Profit +$…"
5. Open Ledger → Sale audits:
   - One new sale record appears with counterparty and trade ID.
   - `soldAt` matches the API completion timestamp.
   - FIFO allocations match what was shown in the review.
6. Open Ledger → Current holdings:
   - Lot quantities reduced by exactly the sold quantities.
   - No more, no less.

---

### T6 — Reload/reopen does not offer or record the same API trade again

1. After completing T5, reload the Torn page.
2. Open Ledger → **Recover recent API trade**.
3. Verify the previously recorded trade does NOT appear in the candidate list.
4. If somehow it could appear, verify pressing **Review** shows it is already recorded and does not allow confirm.

---

### T7 — Likely prior manual recovery is blocked or surfaced

1. Manually record a sale for the same item/quantity/proceeds using **Recover missed sale** (manual path).
2. Open Ledger → **Recover recent API trade** and select a matching finished API trade.
3. Verify the review screen shows a ⚠ warning about likely manual duplicates detected.
4. Verify the confirm button is visually highlighted (amber outline) to indicate caution.
5. Confirm must not be silently hidden — the user must explicitly decide.

---

### T8 — Unsupported or partially covered trades fail closed

1. Attempt recovery of a trade where:
   - Counterparty contributed items (barter) — expect: error, no confirm button.
   - Owner contributed no items — expect: error, no confirm button.
   - Net proceeds are zero or negative — expect: error, no confirm button.
   - Some outgoing items have no matching lots — expect: error showing partial coverage message.
   - Catalog not synced for an item — expect: error asking to sync catalog.
2. In all cases: no mutation, no partial lot consumption.

---

### T9 — Manual missed-sale recovery still works

1. Open Ledger → **Recover missed sale** (the existing manual path).
2. Enter item name, quantity, cash received.
3. Confirm: sale is recorded normally.
4. Verify the new API recovery flow did not break this path.

---

### T10 — Backup/export remains usable

1. After running T5, open Ledger → **Copy JSON**.
2. Inspect the JSON:
   - The new sale record should include standard fields: `id`, `fingerprint` (`trade:api-trade-XXXX`), `counterparty`, `cashReceived`, `items`, `soldAt`, etc.
   - Existing records without API fields remain readable.
3. Import the JSON into a fresh Ledger via **Import JSON**.
4. Verify the imported sale is visible in Sale audits.

---

### T11 — Ledger Integrity passes after valid recovery

1. After T5, open Ledger → **Integrity** tab.
2. Verify no new integrity issues are reported.
3. The recovered sale should not produce orphaned lot references.

---

### T12 — Repeated confirmation cannot duplicate

1. After T5, with the overlay closed, reopen Ledger → **Recover recent API trade**.
2. The completed trade should not be listed.
3. If the overlay is somehow reopened with stale state mid-confirm, the confirm handler checks `apiTradeAlreadyRecorded` before mutating and aborts.

---

## Expected prohibited results (must NEVER happen)

- Any ledger mutation on cancel, close, back navigation, or fetch failure.
- Any mutation before the user presses the explicit **✓ Record sale** button.
- The same API trade consuming FIFO lots more than once.
- Partial lot consumption on unsupported or ambiguous trades.
- API key exposed in logs, DOM, localStorage (other than the designated key storage).
- Any gameplay action (no buying, listing, selling, accepting trade).

---

## Rollback

- Prior stable version: IMM `0.19.33` at `a5dea932df186b8d5d2e2805e4eef837f6edf0f7`
- Reinstall: replace the userscript with the prior version from the stable commit.
- Additive fields only (`soldAt` from API completion time on API-recovered sales); no storage key rename or destructive migration.
- Old records remain fully readable after rollback.
- Export/import backup before any live testing to allow restore.

---

## Notes

- No claim of TornPDA or browser success may be made by the coding agent. The owner must perform these steps and record the results.
- Manual verification status: **Pending owner run.**
