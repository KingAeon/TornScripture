# TESTING-v0.19.35.md — Owner TornPDA Release Gate

**Feature:** IMM API-backed Black Ledger completed-trade recovery  
**Issue:** #97  
**IMM version:** 0.19.35  
**Risk tier:** Tier 3  
**Primary environment:** TornPDA  
**Manual verification status:** Pending owner run

This is the live release gate, not a synthetic torture test. Use one low-value, ordinary completed cash-for-items sale with full Black Ledger FIFO coverage. Do not manufacture duplicate sales, barter trades, unsupported assets, corrupted payloads, rollback failures, or import scenarios in the live Ledger merely to exercise edge cases. Those cases belong to the automated production-path suite unless they occur naturally.

---

## 1. Freeze the release candidate

1. Use the exact PR #107 release-candidate commit recorded in the PR body after housekeeping is complete.
2. Install IMM into TornPDA from a raw GitHub URL pinned to that exact commit SHA, not from `main` and not from the mutable branch name.
3. Fully reload TornPDA/Torn.
4. Confirm IMM visibly reports version `0.19.35`.
5. Do not update or replace the script until the owner gate is complete.

If the installed version is not `0.19.35`, stop.

---

## 2. Protect the Ledger before testing

1. Open Black Ledger and run **Ledger Integrity**.
2. Record whether the pre-test report passes and preserve a screenshot if practical.
3. Use **Copy JSON** and save the complete pre-test Ledger JSON outside TornPDA.
4. Keep this backup unchanged until the release decision is complete.
5. Choose one low-value completed Torn sale that:
   - exchanged ordinary catalog items for money,
   - has no barter or unsupported assets,
   - has known purchase lots in Black Ledger,
   - has enough open FIFO quantity to cover the full outgoing quantity.
6. Record the expected trade ID, counterparty, item quantities, cash received, and relevant pre-test lot quantities where practical.

Do not use a high-value trade merely to make the test more realistic. Accounting correctness does not improve with a larger blast radius.

---

## 3. Open recovery and verify endpoint gating

1. Open Black Ledger → **Recover recent API trade**.
2. Confirm the overlay progresses through **Validating trade endpoint permission…** before recent trades are offered.
3. A usable recovery list must appear only after endpoint permission is positively validated.
4. Confirm the target completed trade appears with the correct trade ID, counterparty, and completion age/time.
5. Active/non-finished trades must not be presented as completed recovery candidates.

If permission is reported as insufficient or inconclusive, or the target trade identity is wrong, stop. Do not attempt to force the flow forward.

---

## 4. First review pass: inspect and cancel

1. Select **Review** for the controlled target trade.
2. Before recording anything, verify the review shows:
   - API Trade ID matching the selected trade,
   - completed timestamp,
   - counterparty name and Torn ID,
   - counterparty cash,
   - owner cash contributed, if any,
   - net proceeds = counterparty cash − owner cash,
   - every outgoing item and aggregated quantity,
   - FIFO lots and quantities proposed for consumption,
   - total FIFO cost basis,
   - realized profit.
3. Compare those values with the actual Torn trade and the known Ledger lots.
4. Close the review with **×** or **← Back** without recording.
5. Reopen Black Ledger and verify:
   - no new sale exists,
   - no lot quantity changed,
   - the target trade is still available for recovery.

Any mutation during this cancel pass is a release blocker.

---

## 5. Second review pass: confirm exactly once

1. Reopen **Recover recent API trade** and select the same target trade.
2. Verify the review values again. Do not rely on the first review from memory.
3. Confirm the FIFO allocation still covers the entire outgoing quantity.
4. Press the explicit **✓ Record sale — consume N lot units** button exactly once.
5. Verify the success toast identifies the API trade and reports profit.
6. Open Black Ledger and confirm:
   - exactly one new sale record exists for the trade,
   - the recorded counterparty is correct,
   - `soldAt` corresponds to the API completion time,
   - the sale quantities match the Torn trade,
   - FIFO allocations match the preview,
   - each affected lot was reduced by exactly the displayed quantity,
   - unaffected lots did not change,
   - cost basis and realized profit match the review.

If the transaction reports an integrity/rollback warning, stop all further recovery attempts and follow the rollback section below.

---

## 6. Reload and prove duplicate protection

1. Fully reload the Torn page/TornPDA after the successful recovery.
2. Reopen Black Ledger → **Recover recent API trade**.
3. Confirm the recorded API trade is no longer offered as an eligible candidate.
4. Confirm no second sale appeared and no FIFO quantity changed again.
5. Reopen the Ledger sale list and verify the recovered sale still has one stable record after reload.

A second record or second lot reduction is a release blocker.

---

## 7. Post-test Integrity and backup evidence

1. Run **Ledger Integrity** again.
2. The recovered sale must not create duplicate identities, orphaned lot references, negative quantities, allocation disagreements, or accounting-total errors.
3. Use **Copy JSON** once more and preserve the post-test JSON separately from the pre-test backup.
4. Do not overwrite the pre-test backup with the post-test export.

A clean Integrity result is required but is not, by itself, proof that the source trade was interpreted correctly. The review comparisons above must also pass.

---

## 8. Supplemental checks

These are useful observations but should not be manufactured in the live Ledger solely for release testing.

### Permission/key failure

If recovery naturally encounters an invalid, insufficient, timed-out, or inconclusive permission state, verify recovery remains disabled and no accounting mutation occurs. Do not intentionally destroy a working key configuration just to create this condition.

### Likely manual duplicate

If the selected API trade already has a genuine prior manual recovery, the review should surface the likely duplicate and disable confirmation. Do not create a fake duplicate sale for this test.

### Unsupported or partial trade

If a naturally available trade contains barter/unsupported assets, unknown catalog data, zero/negative net proceeds, or incomplete FIFO coverage, recovery must fail closed with no partial mutation. Do not create such a trade merely for testing.

### Manual missed-sale recovery

The existing **Recover missed sale** path remains the outage fallback. It does not need a new artificial Ledger mutation for this release gate unless the owner independently needs to use it.

### Import/export fidelity

The automated suite covers normalization/import/export compatibility. For the owner gate, preserving both the pre-test and post-test **Copy JSON** exports is sufficient. Do not import over the live Ledger merely to prove the button works.

---

## Prohibited results

The release fails if any of the following occurs:

- ledger mutation during review, cancel, close, back navigation, or fetch failure,
- mutation before explicit confirmation,
- incorrect trade/counterparty identity,
- missing or invented trade values,
- partial FIFO mutation,
- FIFO allocation that differs from the displayed plan,
- the same API trade consuming FIFO quantities twice,
- a likely manual duplicate being confirmable,
- recovery proceeding without positively validated endpoint permission,
- API key exposure outside its designated local key handling,
- any automatic Torn gameplay action such as buying, listing, selling, accepting, or completing a trade.

---

## Rollback and incident preservation

**Stable recovery point:** IMM `0.19.33` at `a5dea932df186b8d5d2e2805e4eef837f6edf0f7`.

If anything suspicious occurs after confirmation:

1. Stop using API trade recovery. Do not retry the same trade to investigate.
2. Preserve the anomalous post-failure Ledger JSON separately if it can be exported safely.
3. Preserve screenshots/error text and the exact tested PR head SHA.
4. Restore the untouched pre-test Ledger JSON if accounting state is incorrect.
5. Reinstall stable IMM `0.19.33` from the exact stable commit if the release candidate itself must be abandoned.
6. Do not delete the failed release branch or evidence until the defect is understood.

The v0.19.35 changes are additive. No storage-key rename or destructive migration is part of this release, and historical records remain readable through the approved normalization path.

---

## Owner result to record

After the run, record:

- exact tested commit SHA,
- TornPDA/IMM version observed,
- pre-test backup saved: yes/no,
- pre-test Integrity: pass/fail,
- review values correct: yes/no,
- cancel produced zero mutation: yes/no,
- confirm produced exactly one sale: yes/no,
- FIFO quantities/cost basis/profit correct: yes/no,
- reload blocked duplicate recovery: yes/no,
- post-test Integrity: pass/fail,
- post-test JSON preserved: yes/no,
- screenshots/diagnostics for any failure.

Do not mark manual verification complete unless this owner gate was actually performed.