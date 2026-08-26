# Black Ledger Domain

Accounting truth and advisory market intelligence are separate layers.

Stable IMM v0.19.36 includes completed-trade API recovery using finished trades + participated trade detail + Torn item catalog under local accounting prerequisites.

Minimum recovery capability established by DQ-KEY-001: `user:trades` + `user:trade` + `torn:items` + local FIFO/accounting state. `user:inventory`, `user:itemmarket`, `user:log`, and Full access are not required for that completed-trade recovery path.

External trader quotes may support expectations/comparison but must not mutate cost basis or realized accounting merely because a price exists.

Read `docs/LEDGER-INVARIANTS.md` before any accounting change.
