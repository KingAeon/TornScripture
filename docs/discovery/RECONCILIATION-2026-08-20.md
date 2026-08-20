# Age of Discovery Reconciliation — 2026-08-20

Status: **RECONCILED WITH RELEASED IMM v0.19.36 / HISTORICAL NOTES PRESERVED**

## Why this reconciliation exists

The Age of Discovery branch began from stable IMM v0.19.33 on August 10, 2026. While Discovery continued, the separate Black Ledger API-recovery line advanced through owner testing and was later released as IMM v0.19.36 through PR #107.

This created two kinds of drift:

1. Git history drift: Discovery was based on an older `main`.
2. knowledge drift: historical Discovery documents correctly described PR #107 and several trade questions as unresolved at the time, but those statements no longer describe the released product baseline.

Historical documents remain preserved as evidence. This reconciliation records the newer truth.

## Repository synchronization

On August 20, 2026:

- PR #107 was merged from exact owner-tested head `9afdf3766e0fbd108f10666c70f92f1916e0f0de`.
- Stable `main` advanced to merge commit `25fe4936b87697427cfaa1db99fffa907ba07126`.
- Stable IMM became `0.19.36`.
- Issue #97 closed as completed.
- The Discovery branch `docs/age-of-discovery` was merged with the new stable `main` without changing `main`.
- Discovery synchronization commit: `17fcff98d03b765fc80eadeafd6baff7b068f85b`.

The sync preserved the full Discovery history and the released v0.19.36 product history as separate parents of one merge commit. The Discovery branch did not overwrite or revert the released userscript.

## Storage qualification correction

The older PR #109 description still described native-storage qualification as pending.

That is stale.

The branch evidence establishes that TornPDA native-storage qualification was completed and formally closed for this Discovery cycle. The current architecture decision is recorded in `TORNSCRIPTURE-STORAGE-ARCHITECTURE-DECISION.md`.

The conclusion is hybrid persistence behind a centralized storage service, with data-class-specific backend policy and independent backup/recovery requirements for Class C accounting/user-authored data.

No production migration is authorized by this conclusion.

## PR #107 correction

`PROPOSITION-BLACK-LEDGER-TRUTH-RECOVERY.md` was written while PR #107 was still open and unmerged. Its references to #107 as an implementation artifact awaiting a later merge decision are historical and no longer describe current repository state.

Current truth:

- PR #107 is merged.
- IMM v0.19.36 is stable on `main`.
- API-backed Black Ledger completed-trade recovery is a released, review-first, confirmation-gated feature.
- The exact tested path used official finished-trade data, strict list/detail identity reconciliation, exact Torn participant IDs, exact item IDs, full FIFO coverage, exact trade-ID deduplication, canonical fingerprint backup protection, manual-duplicate blocking, fail-closed unsupported states, atomic accounting mutation, and Ledger Integrity verification.

Future Discovery should audit or refine this contract only when new evidence justifies doing so. It should not proceed from the obsolete premise that API recovery is still merely proposed.

## What PR #107 did not answer

The release does not close every Discovery question around trades.

Still open or only partially answered:

- exact measured delay between Torn's visible finality screen and first API list/detail visibility;
- the broader future policy for asset types deliberately unsupported by v0.19.36;
- the recovery-only minimum permission footprint separated from other IMM permissions;
- portable backup/reconciliation design for complete Class C recovery;
- behavior on desktop userscript managers where TornPDA-specific storage/runtime evidence does not apply.

These distinctions prevent successful implementation evidence from being stretched beyond what it actually proved.

## Current next research target

The next recommended Discovery chapter is the TornScriptures minimum-permission and source-ownership matrix, beginning with DQ-KEY-001.

The objective is to determine the smallest trustworthy source/permission footprint for each logical domain before any centralized API client or public onboarding design is specified.

The matrix should explicitly separate:

- Core identity/key diagnostics
- Market / Trader Intelligence
- Black Ledger
- Inventory / Bazaar
- War Intelligence

and should account for authority, freshness, cache behavior, permission burden, source type, and whether a lower-permission truthful source exists.

## Governance

This reconciliation changes project documentation only.

It does not authorize:

- a production storage migration;
- new API requests in product code;
- a new centralized API client;
- automatic trade recording;
- broader trade asset support;
- merger of PR #109 without a separate exact-head release review and explicit owner authorization.
