# TornScriptures Age of Discovery — Current Status

Status: **ACTIVE / RELEASED TO MAIN / READY FOR DQ-KEY-001**

Date: 2026-08-20

This file is the current-state index for the Age of Discovery. Historical discovery logs, protocols, propositions, and evidence remain preserved as written. When an older document describes a question or release state that later work resolved, this file records the newer truth rather than rewriting the historical evidence.

## Current repository baseline

- Stable branch: `main`
- Stable main SHA after the Discovery checkpoint release: `8944dcd9c9ae5b0d2994322efcff2c8e579b36b5`
- Stable IMM: `0.19.36`
- API-backed Black Ledger completed-trade recovery: released through PR #107; merge commit `25fe4936b87697427cfaa1db99fffa907ba07126`
- Age of Discovery checkpoint: released through PR #109; exact reviewed head `fffef3e2ae9236d5b8684a029420c989b488d45c`
- Discovery merge commit on `main`: `8944dcd9c9ae5b0d2994322efcff2c8e579b36b5`
- Current active repository work: housekeeping only on `docs/housekeeping-2026-08-20`

The Discovery notebook is now durable project knowledge on `main`. Open questions remain open research targets; they are no longer stranded on a research-only branch.

## Storage chapter

The TornPDA native-storage qualification chapter is **closed for the current Discovery cycle**.

The evidence supports the provisional architecture recorded in `TORNSCRIPTURE-STORAGE-ARCHITECTURE-DECISION.md`:

- timing-critical synchronous state may remain in memory, session/browser storage, URL state, or `window.name` where timing requires it;
- substantial reconstructible data should eventually use the centralized storage service, with TornPDA `PDA_storage` the preferred durable backend candidate on TornPDA;
- irreplaceable accounting and user-authored data must never rely on one unbacked copy;
- Black Ledger requires independent backup/recovery guarantees before any Class C migration;
- the first eventual storage-abstraction pilot should use reconstructible data, with the Torn item catalog currently preferred.

No production storage migration is authorized by Discovery alone.

## Black Ledger completed-trade chapter after v0.19.36

PR #107 moved several questions from theory into tested product evidence.

The released recovery path now establishes for the current supported transaction boundary:

- official finished-trade list identity is used to select a candidate;
- detailed trade identity is reconciled with the selected list entry before accounting review;
- participant ownership is resolved by Torn ID;
- ordinary outgoing catalog items are aggregated by exact item ID;
- counterparty cash and owner cash are used to calculate positive net proceeds;
- review is non-mutating;
- full FIFO coverage is required;
- exact API trade ID is the primary permanent duplicate guard;
- canonical API fingerprint is a secondary exact guard;
- likely legacy/manual duplicates are blocked through a bounded content/time heuristic;
- malformed, ambiguous, unsupported, partially covered, or unreconciled trades fail closed;
- the final accounting mutation is explicit-confirmation gated and atomic;
- the owner-tested TornPDA release candidate recorded exactly one controlled sale, survived reload, blocked duplicate recovery, and passed Ledger Integrity.

This does not mean every historical Black Ledger Discovery question is globally closed. It means the released v0.19.36 contract now supplies production evidence that future Discovery must treat as part of the factual baseline.

## Reclassified trade questions

### DQ-TRADE-001 — API visibility delay after visible finality

**Status: OPEN.**

v0.19.36 proved that finished trades can be recovered after completion, but the project did not perform a bounded timestamp study measuring the exact delay from Torn's final visible completion message to first list/detail API visibility.

### DQ-TRADE-002 — Exact live detailed-trade semantics

**Status: SUBSTANTIALLY ANSWERED FOR THE SUPPORTED ORDINARY SALE PATH.**

The released recovery path was validated against a real completed cash-for-items trade on TornPDA. Future work should preserve sanitized schema evidence where useful, but implementation must no longer be discussed as if no live trade semantics have ever been verified.

### DQ-TRADE-003 — Unsupported asset combinations

**Status: CURRENT PRODUCT BOUNDARY DECIDED; BROADER FUTURE QUESTION OPEN.**

v0.19.36 records only ordinary cash-for-items sales with complete FIFO coverage. Counterparty items/barter, unsupported asset types, unknown assets, non-positive proceeds, malformed data, and partial FIFO fail closed. Discovery may later evaluate whether any currently unsupported asset should ever become supported, but no such expansion is authorized.

### DQ-TRADE-004 — Minimum key footprint

**Status: PARTIALLY ANSWERED.**

Owner testing established a working least-privilege custom key footprint for the current IMM installation:

- User → `inventory`
- User → `itemmarket`
- User → `trades`
- User → `trade`
- Torn → `items`

The still-open question is the broader TornScriptures domain permission matrix and the distinction between permissions required by Black Ledger recovery itself versus permissions required elsewhere in IMM.

### DQ-TRADE-005 — Permanent deduplication identity

**Status: ANSWERED FOR CURRENT RECOVERY ARCHITECTURE.**

The current hierarchy is:

1. exact API trade ID;
2. exact canonical API fingerprint;
3. legacy/manual content-time heuristic only where exact API identity is unavailable.

This hierarchy is released behavior and should be treated as the current accounting identity contract unless later evidence justifies a separate owner-approved redesign.

## Current highest-value Discovery frontier

The next recommended research chapter is **minimum permissions and source ownership across TornScriptures domains**.

Primary target: DQ-KEY-001.

Build a domain-by-domain matrix for:

- Core identity and key diagnostics
- Market / Trader Intelligence
- Black Ledger
- Inventory / Bazaar
- War Intelligence

For each capability record:

- exact Torn API selection or other source;
- required access level;
- why the permission/source is needed;
- whether the domain can function without it;
- whether data is cached and how that affects authority/freshness;
- whether the source is official, page-derived, third-party, or local;
- whether a lower-permission source can provide the same truthful result.

This matrix should be completed before designing a centralized API client or public onboarding flow so TornScriptures does not request a broad key merely for convenience.

## Other high-value open frontiers

After the permission matrix, priority remains on:

- inventory freshness and immediate post-transaction truth;
- Item Market cache behavior and official historical availability;
- Bazaar API/directory capabilities;
- WIH API freshness versus rendered-page observations;
- legitimate structured page/application state already delivered by Torn;
- Weav3r and TornExchange source/freshness guarantees;
- portable backup and reconciliation contracts for Class C data;
- OpenAPI change detection and discovery reverification cadence.

## Housekeeping checkpoint

Before DQ-KEY-001 begins, the project is performing one documentation/bookkeeping-only cleanup pass.

The current branch cleanup map is recorded in `docs/BRANCH-CLEANUP-AUDIT.md`. This housekeeping work does not alter production userscripts, APIs, storage schemas, tests, or runtime behavior.

After housekeeping is released, Discovery resumes from DQ-KEY-001 unless a severe stable-release defect or owner-approved reprioritization intervenes.
