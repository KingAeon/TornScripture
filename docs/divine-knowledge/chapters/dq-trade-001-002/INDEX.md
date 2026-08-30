# DQ-TRADE-001/002 — Trade Finality + Detailed-Trade Truth

Status: **DESIGN APPROVED / PARKED FOR NEXT THREAD**

Checkpoint: 2026-08-30

## Purpose

Measure the delay and relationship between Torn's visible completed-trade finality and official v2 finished-trade/detail visibility, while capturing one exact low-value cash-for-item specimen without mutating Black Ledger.

Canonical open questions: `docs/discovery/OPEN-QUESTIONS.md` DQ-TRADE-001 and DQ-TRADE-002.

## Owner-approved design

- specimen: one cheap ordinary stackable item, quantity 1, cash-only trade with a trusted counterparty;
- test cash: `$1,234`;
- stable IMM disabled during the specimen so only the Discovery observer reacts;
- Discovery probe is observation-only and must never press Torn controls or mutate Black Ledger/product storage;
- T0 automatic DOM finality detector uses an exact allowlist containing:
  - `Trade was accepted and is now complete!`
  - `This trade is completed`
- manual **Mark final screen** exists only as fallback and downgrades timing quality;
- `#step=logview` alone is never completion evidence;
- API measurement uses paired finished-list + trade-detail requests every 4 seconds, with a unique timestamp/cache-bypass parameter where supported;
- after T0, paired measurement occurs immediately, then resumes the bounded cadence;
- two identical normalized completed-detail responses are required before declaring payload stability;
- report must distinguish FULL PASS, QUALIFIED PASS, INCONCLUSIVE, and CONTRACT MISMATCH;
- API key remains memory-only and must never appear in report/storage/repository evidence;
- nonsecret probe-run continuity may use a probe-owned session namespace only;
- no probe code or live trade has been authorized by this checkpoint.

## Truth hierarchy under test

1. visible Torn terminal completion message = immediate event/finality trigger candidate;
2. official trade ID + completed detailed-trade response = durable transaction/accounting authority candidate;
3. finished-trade list = index/recovery visibility source;
4. Black Ledger mutation remains out of scope for this Discovery specimen.

## Known local environment state

- current Ledger/Trader Book were lost during the earlier TornPDA browser-cache incident and remain a clean baseline;
- IMM catalog/reference values were also cleared by that incident;
- owner ran **Sync values** on 2026-08-30 and normal Item Market colored borders/annotations returned;
- therefore missing borders were tied to lost catalog/reference state, not to the empty Ledger or Trader Book.

## Next action

Begin the next TornScriptures thread here. First task is to turn the approved design into the formal DQ-TRADE-001/002 live-test protocol. Do not write the probe or conduct the trade until the protocol itself is reviewed and approved.
