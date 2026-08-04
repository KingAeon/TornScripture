# Black Ledger Invariants

## Purpose

Black Ledger records purchase lots, remaining quantities, sales, cost basis, realized profit, recovery actions, and audit evidence. These records represent financial history. A feature that cannot prove a safe mutation must leave the ledger unchanged.

These invariants apply to all automated, API-backed, DOM-backed, imported, and manually recovered transactions.

## Governing principle

**No source truth, no mutation.**

Convenience is secondary to preserving accurate historical quantities and costs.

## Source-data requirements

A sale or purchase mutation must have sufficient evidence for the fields it records.

For a completed trade sale, the source must establish:

- transaction identity
- completion state
- owner identity
- counterparty identity
- outgoing item IDs or reliably normalized item identities
- exact outgoing quantities
- counterparty money
- owner money, when any
- net proceeds
- completion time when available
- provenance of the captured data

Do not substitute estimates, market totals, target payouts, or visible totals for actual transaction values.

## Fail-closed conditions

Do not record or consume ledger quantities when any required fact is:

- missing
- ambiguous
- contradictory
- unsupported
- malformed
- only inferred from page location
- based on a stale or mismatched counterparty
- based on partial ledger coverage
- dependent on an undocumented API response

The safe result is a clear `not recorded` or `review required` state plus useful diagnostics and recovery guidance.

## Lot identity and provenance

Every purchase lot must preserve its stable identity and source information.

A lot should retain, as applicable:

- lot ID
- item identity
- acquired quantity
- remaining quantity
- unit cost and total cost
- acquisition time
- acquisition source
- capital source
- transaction or receipt identity
- audit notes

Do not merge lots in a way that destroys distinct costs, dates, sources, or receipt evidence unless the approved feature explicitly defines a reversible consolidation.

## Quantity conservation

For every lot:

- remaining quantity must never be negative
- consumed quantity must not exceed acquired quantity
- edits, recovery, cleanup, and deduplication must preserve quantity conservation
- canceling a review must change no quantity
- failed recording must change no quantity
- retrying the same transaction must not change quantity twice

For an item across all lots:

`acquired quantity = remaining quantity + quantities consumed by valid sales + quantities removed by explicitly documented corrections`

Any exception requires a visible audit record.

## FIFO

When Black Ledger uses FIFO:

1. consume the oldest eligible open lot first
2. preserve deterministic ordering for equal timestamps
3. consume only the quantity supported by the transaction source
4. record which lots and quantities were consumed
5. calculate cost basis from the actual consumed lot costs
6. leave unconsumed balances intact
7. produce the same allocation when the same valid plan is recomputed before mutation

Do not replace FIFO with average cost, latest cost, market value, target payout, or estimated value without a separately approved architecture and migration plan.

## Full-coverage requirement

Automatic or API-backed sale recording must fail closed when the ledger cannot cover the full outgoing quantity.

Examples:

- zero tracked quantity: do not record
- partial tracked quantity: do not automatically record
- unknown item mapping: do not record
- unsupported counterparty-provided items or non-item assets: do not record unless explicitly supported by a reviewed design

Manual recovery may remain available, but it must make missing coverage visible and must not silently fabricate purchase cost.

## Transaction identity and deduplication

Every recorded transaction needs a stable primary identity when the source provides one.

Preferred sale identity order:

1. official API transaction or trade ID
2. existing authoritative Torn transaction ID
3. stable capture ID produced by the approved source path
4. content-and-time fingerprint for manual or legacy records

Secondary deduplication should consider:

- counterparty identity
- item identities and quantities
- net proceeds
- completion time window
- source URL or receipt identity when reliable

A duplicate event, page reload, retry, reopened trade, repeated API response, or second recovery attempt must not:

- create a second sale
- consume FIFO quantities again
- create a second receipt for the same mutation
- alter realized profit again

Deduplication must also detect a matching earlier manual recovery when later official data becomes available.

## Mutation boundary

Plan first, mutate second.

A high-risk transaction flow should:

1. normalize source data
2. validate ownership and completion
3. reject unsupported entries
4. map items
5. calculate net money
6. detect duplicates
7. produce a FIFO allocation plan
8. verify full coverage
9. display the required review
10. mutate only after the approved confirmation condition
11. persist sale and lot changes together as one logical operation
12. report the resulting sale identity and allocations

Do not partially persist a sale when lot mutation fails, or partially consume lots when sale persistence fails.

## Review-first recovery

The first release of any new recovery source should be review-first.

The review must display:

- counterparty name and Torn ID
- source transaction ID
- completion time
- every outgoing item and quantity
- counterparty cash
- owner cash
- net proceeds
- FIFO lots and quantities to be consumed
- cost basis
- realized profit
- unsupported, unmatched, or partially covered data

Canceling must leave all ledger state unchanged.

Automatic recording may be considered later only after the review-first route has proven reliable in repeated live use and has separate owner approval.

## Manual recovery

Manual missed-sale recovery remains the emergency fallback for:

- API outage
- unsupported legacy transaction
- incomplete historical source data the owner can independently verify
- a failed automatic capture that preserved enough evidence for human review

Manual recovery must:

- require deliberate user action
- display or request the values being recorded
- avoid pretending manually entered data came from an official source
- produce an audit note identifying manual recovery
- participate in duplicate detection
- preserve rollback or correction information

## Current trade-capture decision

As of 2026-08-04:

- the final Torn message `Trade was accepted and is now complete!` is valid completion evidence
- `#step=logview` alone is not completion evidence
- first acceptance and mutual-acceptance wording remain pending
- mobile DOM pre-accept capture did not reliably produce participant, item, or cash data
- touch and pointer timing probes did not repair the missing manifest
- DOM-backed automatic trade reconstruction is rejected as the primary architecture
- the planned replacement is review-first recovery through Torn API v2 finished-trade data

Reference: closed checkpoint PR #92 and open implementation issue #97.

Do not restart acceptance-button selectors, touch probes, or vanished-DOM reconstruction without new evidence that materially changes this decision.

## Normalization and migration

Persistent schema changes require:

- explicit specification
- old-shape fixtures
- new-shape fixtures
- normalization that accepts supported historical data
- version or migration identification where needed
- preservation of unknown fields when practical
- export backup before manual testing
- rollback plan
- Ledger Integrity after migration

Do not rename storage keys or reset stored data merely to simplify implementation.

## Import and export

Exports are recovery assets.

Ledger export should preserve enough information to reconstruct:

- lots
- remaining quantities
- sales
- allocations
- capital sources
- receipt and audit identities
- schema version

Import must validate structure before replacing live state. Invalid or unsupported imports must not partially overwrite the ledger.

## Cleanup and deduplication

Cleanup tools must be conservative and reviewable.

- identify why records are believed to be duplicates
- preserve a backup or reversible record where practical
- do not remove quantities or costs merely because records look similar
- distinguish exact duplicate identity from coincidentally similar transactions
- show the affected records before destructive cleanup
- run Ledger Integrity after cleanup

## Integrity checks

Ledger Integrity should detect or help expose:

- negative remaining quantities
- consumed quantities exceeding acquired quantities
- missing lot references from sale allocations
- duplicated stable transaction identities
- inconsistent allocation totals
- malformed numeric values
- missing required identities
- schema normalization failures
- sale totals that do not reconcile with allocations

A passing integrity check is necessary but not sufficient for release. It does not prove that the original transaction source was interpreted correctly.

## Testing requirements

High-risk ledger work requires tests for:

- successful full-coverage allocation
- zero coverage rejection
- partial coverage rejection
- unknown item rejection
- unsupported asset rejection
- owner and counterparty ambiguity
- money contributed by both parties
- repeated unique-item rows
- exact transaction-ID deduplication
- content-and-time deduplication
- cancellation with no mutation
- failure with no mutation
- confirmation consuming quantities exactly once
- retry and reload stability
- old stored-data normalization
- import/export compatibility when affected
- Ledger Integrity after mutation

Protected regressions must cover existing purchase capture, sale history, trader tools, carousel behavior, inventory sales, and any subsystem sharing edited state.

## Manual release gate

Before merging a Tier 3 Black Ledger change:

1. export Ledger JSON
2. record the branch build and exact head SHA
3. use a low-value controlled transaction
4. verify source identity and displayed review
5. confirm item quantities and money
6. confirm FIFO allocations and cost basis
7. confirm realized profit
8. cancel once and verify no mutation when cancellation is part of the flow
9. complete once and verify exactly one sale
10. reload or retry and verify no duplicate or second lot reduction
11. run Ledger Integrity
12. preserve screenshots or diagnostics for any failure
13. obtain explicit merge authorization

## Rollback

Every high-risk release must state:

- how to reinstall the prior stable userscript
- how to restore Ledger JSON
- which storage or schema changes require special handling
- whether new records remain readable by the prior version
- which branch and commit contain the rejected release

## Prohibited shortcuts

Do not:

- create a sale from target payout instead of actual money
- assume the other participant is the trader without identity proof
- assume completion from route alone
- reduce lots before duplicate detection
- mutate partially covered transactions automatically
- treat a market price as purchase cost
- treat an API list summary as a detailed manifest unless the schema proves it
- hide unsupported entries to make a review appear clean
- mark a transaction recorded when persistence or allocation failed
- weaken tests to accommodate incorrect output

## Amendment

Changes to these invariants require owner-approved documentation and, when behavior changes, corresponding implementation tests and migration review.
