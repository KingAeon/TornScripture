# Proposition — Black Ledger Truth, Recovery, and Portability

Status: **DRAFT FOR OWNER DISCUSSION / NOT YET AUTHORIZED FOR EXECUTION**

Date: 2026-08-11

## Proposition

With the TornPDA native-storage qualification chapter formally closed, the next Age of Discovery chapter should establish the **truth contract for Black Ledger accounting and recovery** before any production persistence migration or completed-trade recovery release is authorized.

The central question is no longer where TornScriptures *can* store durable data.

It is:

> **What evidence is authoritative enough for TornScriptures to create, recover, deduplicate, reconcile, export, import, and protect a Black Ledger accounting event without inventing, losing, overwriting, or double-counting value?**

This proposition is research and protocol design only. It does not authorize runtime product changes, data migration, accounting mutation, or merge of an existing recovery PR.

## Why this should be next

The storage chapter established a credible durable backend candidate, but Black Ledger remains Class C data: accounting-critical, partially user-derived, and not guaranteed reconstructible in exact form.

The browser-cache incident demonstrated that TornScriptures must not confuse persistence with recoverability. A more durable live database helps, but it does not answer:

- when a trade is truly final
- how quickly Torn exposes the finished trade through official sources
- which trade fields are authoritative
- whether a trade ID is sufficient as permanent accounting identity
- how unsupported assets must fail closed
- how old/manual records reconcile with API-backed records
- what to do when a backup and live state disagree
- how to preserve user-authored trader/accounting information independently of the live backend

The existing API-backed completed-trade recovery PR #107 is currently open and unmerged. It has useful owner-test evidence, but Discovery should treat it as an implementation artifact to audit **after** the truth contract is established, not as proof of what the contract should be.

## Scope

This proposition combines two inseparable concerns:

1. **Accounting truth** — when and how a completed trade becomes a trustworthy Ledger event.
2. **Recoverability and portability** — how irreplaceable accounting/user-authored data can be restored or moved without destructive ambiguity.

The chapter should answer the current high-priority Black Ledger open questions and add an explicit portable-backup/reconciliation contract.

## Track A — completion finality and API visibility

### Goal

Measure the relationship between Torn's visible final completed-trade state and official API visibility.

### Questions

- At what exact point does the visible trade flow become final for accounting purposes?
- How long after the final completion screen does a finished-trade list expose the trade?
- How long after completion does detailed trade data become available?
- Are list and detail visibility simultaneous?
- Is there observable cache delay or inconsistent freshness?
- Can a just-completed trade disappear/reappear or change representation during the first minutes?

### Controlled evidence

Use one deliberately low-value ordinary money-for-items trade.

Record:
- trade ID
- owner Torn ID
- counterparty Torn ID
- exact visible-finality timestamp
- first finished-list visibility timestamp
- first detailed-trade visibility timestamp
- response timestamps/cache metadata when exposed
- repeated read behavior during the bounded observation window

The test trade must not be accounting-significant merely for research.

## Track B — exact trade semantics

### Goal

Establish the exact live response semantics for the trade shape TornScriptures actually wants to support.

### Required evidence

For a controlled ordinary sale, capture a sanitized detailed-trade response and reconcile it field-for-field against the current official Torn API contract at execution time.

Determine exactly how to identify:
- owner versus counterparty
- owner outgoing items by item ID and quantity
- owner cash
- counterparty cash
- net proceeds
- completion time
- trade ID
- unexpected/unsupported assets

### Fail-closed asset matrix

The documented trade model has historically included more than ordinary Money + Item exchange shapes. Discovery must produce an explicit matrix:

- supported and recordable
- review-only
- unsupported and rejected
- impossible/unknown pending evidence

Barter, properties, company/faction assets, NAP-like assets, mixed money directions, malformed quantities and ambiguous ownership must never be silently coerced into a normal cash sale.

## Track C — permanent identity and deduplication

### Goal

Determine what makes one accounting event permanently the same event.

### Questions

- Is Torn trade ID stable and sufficient as the primary immutable transaction identity?
- Does finished-list identity always reconcile exactly with detailed-trade identity?
- What should a canonical fingerprint include, and should it be secondary rather than primary?
- How should older manually recorded sales be detected when they predate API identity metadata?
- What constitutes a hard duplicate versus a review warning?
- Can two legitimate trades share the same content/time fingerprint?

### Desired outcome

A durable identity hierarchy, for example conceptually:

```text
official immutable transaction ID
        ↓
verified API provenance
        ↓
canonical semantic fingerprint
        ↓
legacy/manual heuristic only when exact identity is unavailable
```

The exact hierarchy must come from evidence, not this example.

## Track D — least privilege and key trust

### Goal

Establish the smallest permission footprint required for completed-trade truth and recovery.

### Questions

- Which current Torn v2 selections are strictly necessary?
- What access level is required for each?
- What does `/key/info` report for the minimal key?
- Can completed-trade recovery function without inventory access?
- Which permissions belong to existing IMM functionality rather than Black Ledger recovery itself?
- How does TornPDA managed-key injection interact with the required custom selections on the current app version?
- How should insufficient or inconclusive permission states fail without accounting mutation?

### Output

A Black Ledger permission matrix separating:
- recovery-required permissions
- IMM-required permissions
- optional diagnostics
- unrelated permissions that should not be requested

## Track E — recovery and reconciliation

### Goal

Define how TornScriptures reconstructs missing accounting state without overwriting valid later state.

Recovery must be **review-first and merge-oriented**, never blind replacement.

### Scenarios to model

1. Ledger is intact and one finished trade is missing.
2. Ledger backup is older than current live Ledger state.
3. Browser-local state was wiped but an old Ledger JSON backup exists.
4. API exposes finished trades newer than the backup.
5. A trade appears both as a legacy manual sale and as an API-identified candidate.
6. Purchase lots needed for FIFO are partially missing.
7. Trader/user-authored metadata is missing even though transaction evidence exists.
8. Backup contains records unknown to current live state.
9. Live state contains records newer than the backup.
10. Schema versions differ.

### Core rule

Recovery must classify every candidate change before mutation:

```text
safe additive recovery
known duplicate
conflict requiring owner review
insufficient evidence
unsupported
```

There should be no generic "restore this backup over current state" operation for Class C data.

## Track F — portable backup contract

### Goal

Design a TornScriptures-controlled portable backup format for irreplaceable data before Class C migration is considered.

### Proposed backup envelope fields to evaluate

- product/suite identifier
- export schema and schema version
- TornScriptures/IMM version
- exported-at timestamp
- Torn user/account identity where appropriate
- logical datasets included
- per-dataset schema versions
- record counts
- integrity/checksum metadata
- source backend/runtime metadata
- optional provenance/recovery notes

### Dataset boundaries

Do not assume "backup everything" is one giant JSON blob.

Evaluate separate logical sections for:
- Black Ledger accounting state
- purchase lots/FIFO basis
- sale/receipt/audit identity
- trader user-authored profile/disposition/notes
- reconstructible trader prices/history
- settings

The format should distinguish irreplaceable data from reconstructible cache so import/recovery policy can differ safely.

### Import requirements

A future import must support a **dry-run report before mutation** showing:
- exact records to add
- exact duplicates to ignore
- conflicts
- schema migrations required
- unsupported/unknown data
- data that would be preserved from current live state
- data that cannot be safely merged automatically

No import design should require the owner to choose between "trust current" and "replace all" when a safe record-level reconciliation is possible.

## Track G — audit existing recovery PR #107

Only after Tracks A-D establish the live truth/identity/permission contract should Discovery audit PR #107 against the new evidence.

The audit should classify each major behavior as:
- matches discovered contract
- unnecessarily strict but safe
- insufficiently strict
- based on stale API assumptions
- architecture-compatible but implementation-specific
- obsolete under the new contract

The existing owner test is valuable evidence of one working path, but it must not substitute for current contract verification.

### Merge rule

This proposition does **not** authorize merging PR #107.

A later merge recommendation, rejection, or redesign recommendation requires a separate owner discussion after the Discovery audit is complete.

## Proposed execution order

### Gate 0 — protocol and safety preparation

Before any live trade test:
- verify current official API/OpenAPI contract
- verify current TornPDA/API-key behavior
- preserve all current important TornScriptures data externally
- confirm test uses a low-value trade
- define exact timestamps/data to capture
- ensure no experimental path can mutate Black Ledger automatically

### Gate 1 — controlled completion timing

Observe one low-value trade from visible finality through finished-list and detail availability.

No Ledger mutation is required to answer the timing question.

### Gate 2 — exact semantic capture

Sanitize and preserve the detailed trade shape, ownership, assets and completion metadata.

### Gate 3 — permission minimization

Test only enough key combinations to establish the minimum reliable recovery permission set.

### Gate 4 — identity/dedup model

Use the live controlled trade plus historical/manual examples to define exact duplicate and legacy-warning rules.

### Gate 5 — recovery dry-run model

Build a non-mutating reconciliation report against copies/synthetic snapshots first. No production Ledger write.

### Gate 6 — portable backup/import contract

Specify and test export validation plus dry-run import/reconciliation using disposable copies.

### Gate 7 — PR #107 audit

Compare the existing implementation with the discovered contract and produce one of three recommendations:

1. retain/repair and later owner-gate
2. redesign before release
3. reject/replace

## Evidence classes

Every conclusion should continue using the Age of Discovery evidence model:

- Official Torn
- Platform documented
- Observed live
- Inferred/unstable
- External third party

Accounting-critical behavior requires either official contract plus controlled live confirmation or a documented fail-closed boundary where live confirmation is unavailable.

## Safety rules

During this proposition:

- no automatic gameplay action
- no automatic trade acceptance/completion
- no automatic Ledger recording
- no destructive import
- no blind backup restore
- no cache/storage clear tests
- no test that risks user-significant value merely to obtain evidence
- no production schema migration
- no PR #107 merge or readiness change without separate explicit owner authorization

Any live trade used for evidence should be deliberately low value and ordinary enough to isolate the contract being measured.

## Exit criteria

This Discovery chapter is complete only when we can answer, with preserved evidence:

1. what event constitutes observed trade finality
2. practical API visibility delay after finality
3. exact live ordinary-sale response semantics
4. supported and unsupported asset matrix
5. permanent transaction identity hierarchy
6. duplicate/reconciliation rules for API and legacy/manual sales
7. minimum Black Ledger recovery permission footprint
8. TornPDA key-path behavior relevant to that footprint
9. safe additive recovery model
10. conflict/fail-closed recovery rules
11. portable Class C backup envelope and dataset boundaries
12. dry-run import/reconciliation contract
13. current recommendation for PR #107

## Decision requested from owner

Authorize or revise this proposition as the next Age of Discovery chapter.

If authorized, the **first action is Gate 0 protocol preparation and current official-contract verification**, not a live trade and not a code change.

Proposition status: **DRAFT ONLY / NO EXECUTION AUTHORIZED.**
