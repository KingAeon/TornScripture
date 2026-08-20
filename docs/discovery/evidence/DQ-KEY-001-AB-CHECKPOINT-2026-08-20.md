# DQ-KEY-001 — A/B Live Permission Checkpoint

Date: 2026-08-20

Status: **KEY-001-A FULL PASS / KEY-001-B FULL PASS FOR PERMISSION BOUNDARY**

This checkpoint summarizes the first two owner-run least-privilege tests. Raw API keys and screenshots are intentionally not retained in the repository.

## KEY-001-A — Inventory

Live-proven:

- exact custom key type accepted;
- `/key/info` reported `access.type = Custom` and `access.level = 0`;
- User selections included `inventory` alongside Torn-provided baseline/default selections;
- `GET /v2/user/inventory?cat=Flower&offset=0&limit=20` returned HTTP 200 with real inventory rows;
- unrelated Limited selections were not required.

Conclusion: `user:inventory` is a capability-specific Minimal/custom grant. Broad key level alone is not a truthful capability test.

Additional discovery: custom-key validation should test for presence of required selections, not exact-array equality, because Torn supplies baseline/default selections around the intentional custom grant.

## KEY-001-B — Black Ledger completed-trade recovery

Live-proven through Swagger under one restricted Custom key:

- `user:trades` returned finished trades with HTTP 200;
- `user:trade` returned authoritative detailed finished-trade contents with HTTP 200;
- `torn:items` returned catalog data with HTTP 200;
- the key excluded `user:inventory` and `user:itemmarket`.

Live-proven in stable TornPDA IMM v0.19.36 under the same restricted key:

- stable IMM accepted the key;
- Black Ledger recovery loaded 86 finished trades;
- selected-trade processing advanced through trade-source access;
- an initial review attempt correctly failed closed on an incomplete local catalog;
- after catalog refresh, a second attempt advanced past catalog resolution and correctly failed closed because none of the selected outgoing items were covered by open purchase lots;
- no accounting mutation was attempted.

Conclusion: the released Black Ledger completed-trade recovery permission/source footprint is live-proven as:

- `user:trades`
- `user:trade`
- `torn:items`
- local Black Ledger FIFO/accounting state

`user:inventory`, `user:itemmarket`, `user:log`, and Full access are not required for this recovery capability.

The accounting review UI was not rendered in the second run only because the live Ledger lacked matching open FIFO lots. TornScriptures will not invent or manufacture accounting lots merely to force a deeper UI state. The FIFO quarantine is therefore recorded as the correct fail-closed outcome rather than a blocker to the permission conclusion.

## Next live frontier

Proceed to KEY-001-C: test `faction:members` as the Public/custom structured source candidate for War Intelligence, without granting privileged faction API access solely for the test.