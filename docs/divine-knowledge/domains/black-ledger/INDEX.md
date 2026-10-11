# Black Ledger Domain

Accounting truth and advisory market intelligence are separate layers.

The prior 0.19.36 stable baseline is historical. At the 2026-10-11 checkpoint, approved main runs IMM **0.19.37**, while draft PR #139 proposes **0.19.39**, without independent [V1] PASS. Recheck mutable refs. Read [PR-139-STATUS-2026-10-11.md](PR-139-STATUS-2026-10-11.md) and the [assistant-first tool gate](../tooling/ASSISTANT-FIRST-GATE.md).

Historical IMM v0.19.36 includes completed-trade API recovery using finished trades + participated trade detail + Torn item catalog under local accounting prerequisites.

Minimum recovery capability established by DQ-KEY-001: `user:trades` + `user:trade` + `torn:items` + local FIFO/accounting state. `user:inventory`, `user:itemmarket`, `user:log`, and Full access are not required for that completed-trade recovery path.

External trader quotes may support expectations/comparison but must not mutate cost basis or realized accounting merely because a price exists.

Read `docs/LEDGER-INVARIANTS.md` before any accounting change.
