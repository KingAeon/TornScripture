# IMM v0.19.37 Unresolved Trade Journal Test Plan

Issue: #115  
Risk: Tier 3  
Base: `main` at `cd9d6798a0b284d176d81fadb148a55511fe3c1c`

## Scope

IMM v0.19.37 extends the existing API Trade Recovery overlay with an isolated,
non-accounting journal for finished trades. Finished-trade list rows are saved
as lightweight discovery records. Exact item and money evidence is requested
only when the owner selects a row.

The journal never consumes purchase lots, creates sales, assigns cost basis, or
calculates realized profit. Only an ordinary cash-for-items trade with complete
FIFO coverage can reach the existing confirmation-gated Black Ledger path.

## Storage

New isolated key:

- `tornscripture-imm-unresolved-trade-journal-v1`

The key stores owner/counterparty Torn IDs, official trade ID, completion time,
sanitized item/money evidence, classification, archive state, and status audit
events. It does not store participant names, API keys, unrestricted raw API
responses, purchase lots, or sales.

No existing storage key or Ledger schema is renamed or migrated.

## Automated verification

Run:

```bash
node --check TornScripture-Item-Market-Margin.user.js
node tests/imm-api-trade-recovery.test.js
node tests/inventory-sales-core.test.js
node tests/imm-carousel-identity-precedence.test.js
node tests/imm-carousel-zero-price-mismatch.test.js
node tests/imm-startup-persisted-permission.test.js
git diff --check
```

Focused journal coverage includes:

- idempotent discovery by authoritative trade ID
- discovery records without stored participant names
- malformed-row rejection and normalized round-trip
- lazy evidence hydration
- full FIFO classification without mutation
- zero and partial FIFO classification without mutation
- barter/unsupported classification without mutation
- archive, restore, cached-evidence deletion, and forget controls
- immutable first evidence when a later payload conflicts
- TornPDA `#/step=accept2` finality using the authoritative
  `Trade was accepted and is now complete!` message
- pre-final `accept2`, mutual-acceptance wording, and route-only `logview`
  rejection with no mutation
- preserved live-snapshot restoration and exactly-once full-FIFO auto-recording
- sanitized finality and pending-snapshot diagnostics
- protected API recovery, FIFO, rollback, permission, startup, carousel, and
  Inventory Sales regressions

## TornPDA manual gate

1. Copy the current Ledger JSON and note the installed stable version.
2. Install the exact v0.19.37 branch build and confirm only one IMM is enabled.
3. Open Black Ledger, then **Recover API trade**.
4. Confirm the finished-trades list loads and creates journal rows without
   requesting every trade detail.
5. Close and reopen recovery. Confirm rows do not duplicate and discovery audit
   events do not multiply.
6. Open one trade that has complete local FIFO coverage. Confirm it becomes
   **Accounting-ready** and the review shows the existing exact FIFO plan.
7. Back out without confirming. Confirm lots, remaining quantities, sales, and
   realized profit remain unchanged.
8. Open one trade with zero or partial local coverage. Confirm it appears under
   **Needs review** as **Missing FIFO coverage** and cannot record a sale.
9. If available, open a barter, gift, or unsupported-asset trade. Confirm it is
   classified **Unsupported exchange** and cannot reach confirmation.
10. Archive and restore one unresolved row. Reload and confirm the state
    persists.
11. Delete cached evidence for one row. Confirm the discovery record remains and
    details can be fetched again.
12. Forget one harmless journal row after copying the journal JSON. Reopen the
    API recovery overlay and confirm the official trade is rediscovered.
13. Copy journal JSON and verify it contains no participant names or API key.
14. Confirm one low-value accounting-ready sale only if desired. Reopen recovery
    and confirm it appears as **Recorded** and FIFO quantities changed once.
15. Reload and verify the sale does not record again.
16. Run Ledger Integrity and require a pass.
17. Repeat the overlay/tabs/actions on desktop and verify no obvious narrow-screen
    overflow or unusable touch controls in TornPDA.

## TornPDA finality repair gate

The original v0.19.37 candidate failed to recognize TornPDA's completed state at
`#/step=accept2`. Test the repaired candidate with one new low-value trade only
after a complete live snapshot exists:

1. Before accepting, confirm IMM shows the exact outgoing items, actual cash,
   and full FIFO coverage.
2. Complete both Torn confirmations and remain on the final message
   `Trade was accepted and is now complete!`.
3. Confirm the sale records automatically exactly once, reaches **Recorded** in
   the journal, and consumes the expected FIFO quantity once.
4. Reload or rescan the final page. Confirm no second sale or second lot
   reduction occurs.
5. Run Ledger Integrity and require a pass.
6. If auto-recording does not occur, copy diagnostics before API recovery. The
   `tradeFinality` block must report the route step, current trade ID, completion
   evidence, and sanitized pending-snapshot state without participant names.

The route alone is never completion evidence. A pre-final `accept2` screen,
`logview`, or mutual-acceptance wording must not record or consume anything.

## Stop conditions

Stop testing and do not merge if:

- opening or refreshing the journal changes lots or sales
- a partial/zero-coverage trade can reach confirmation
- participant names or the API key appear in journal storage/export
- duplicate journal rows or duplicate sale mutations appear
- a route without the authoritative final completion message records a sale
- list discovery triggers detail requests for every historical trade
- evidence conflicts overwrite the first preserved evidence
- Ledger Integrity fails

## Rollback

Reinstall IMM v0.19.36 from `main`. The isolated journal key may remain inert or
be forgotten row-by-row from the branch UI before rollback. Existing Ledger,
lots, sales, API key, trader book, and pending-purchase keys are untouched.
