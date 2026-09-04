# DQ-TRADE-001/002 — Trade Finality and API Visibility

Status: **DEFERRED OPTIONAL RESEARCH**

Original checkpoint: 2026-08-30

Reconciled: 2026-09-03

## Historical purpose

The approved design would have measured the delay between Torn's visible final
trade message and official v2 finished-list/detail visibility using one
low-value specimen, an observation-only probe, paired four-second samples, and
two identical normalized detail responses before calling the payload stable.

No probe was implemented and no specimen was conducted for this design.

## What changed

IMM v0.19.37 shipped the Unresolved Trade Journal through PR #116. Controlled
TornPDA testing proved the accounting behavior needed for the current product:

- the authoritative final message can be recognized;
- TornPDA may remove the live item/cash manifest before a complete snapshot is
  preserved;
- missing evidence fails closed without a Ledger mutation;
- the official API journal can hydrate, review, and consume the same trade once;
- FIFO and Ledger Integrity remained correct.

Therefore the paired timing probe is no longer the next project action. Exact
API visibility delay remains a legitimate measurement question, but it is not a
release blocker for the supported review-first recovery path.

## Preserved design boundary

If exact latency becomes decision-critical later, any revived probe must remain
observation-only, keep the API key memory-only, never press Torn controls, never
mutate product or Ledger storage, and use the authoritative completion message
rather than a route as T0 evidence.

## Historical local observation

After the earlier TornPDA cache loss, **Sync values** restored IMM catalog and
reference data and the normal Item Market borders returned. This showed that the
missing borders were tied to missing catalog/reference state rather than the
Ledger or Trader Book.

## Current next action

Continue DQ-EXT-001 external-provider contract work. Revisit this chapter only
if exact finished/detail visibility timing becomes necessary for a future design.
