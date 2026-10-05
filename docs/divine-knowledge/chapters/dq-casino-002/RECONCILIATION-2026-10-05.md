# CA-01 Reconciliation Record — 2026-10-05

Status: **V1 COMPLETE / V2 PENDING**

## Inputs

- Repository: `KingAeon/TornScripture`
- Exact current-main baseline: `b8474253237e63485100fdcc51b2cb82530d2efc`
- Historical CA-01 draft: PR #121
- Historical CA-01 head: `baa7b90581cda4670258332c061444f550f104b9`
- Reconciliation branch: `docs/casino-ca01-reconcile-2026-10-05`

## Reason

PR #121 was created from `main@ad8cbbd753471088a2cd5aaf7e1d8ed2dad164fe`.
Subsequent TornScriptures Training Advisor work advanced main and modified several
shared Divine Knowledge registries. The old PR therefore could not be used as an
implementation baseline without risking stale-state regression.

## Reconciliation method

The fresh branch was created from exact current main. CA-01's chapter and live
verification sheet were restored from PR #121. Shared Divine Knowledge files were
merged by Casino-specific IDs/events/edges only so later Training state remained
authoritative.

No product source, test, userscript, workflow, storage, or release file was copied
from the old branch.

## V1 exit criteria

- branch starts from exact current main;
- CA-01 specification and live observations are present;
- newer main state is preserved;
- branch-to-main diff is documentation-only under `docs/divine-knowledge/**`;
- NDJSON registries parse line-by-line;
- no merge and no implementation occurs before V2.

V2 must independently re-read the reconciled specification, inspect the complete
branch-to-main diff, recheck mutable Torn Blackjack mechanics, and record PASS/BLOCK
findings before the owner decides whether to merge.
