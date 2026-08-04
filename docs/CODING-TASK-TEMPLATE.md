# TornScriptures Coding Task Template

Use this template for Codex, GitHub Copilot, Aider, OpenCode, Cursor, or another coding agent. Remove sections that are genuinely irrelevant, but do not omit safety, validation, stop conditions, or no-merge instructions from product-code tasks.

---

## Mission

State one clear outcome.

Example:

> Implement review-first recovery of completed Black Ledger trades through Torn API v2 without relying on the mobile trade DOM.

## Project mode

- Mode: Implementation
- Risk tier: Tier 0 / 1 / 2 / 3 / 4
- Coding-budget class: None / Light / Standard / Premium / Staged premium

## Repository and baseline

- Repository: `KingAeon/TornScripture`
- Base branch: `<branch>`
- Exact base SHA: `<sha>`
- Current userscript/version: `<script and version>`
- Feature branch: `<branch>`
- Linked issue: `#<number>`

## Toolchain preflight

Before product edits:

1. materialize the complete repository
2. check out the exact base SHA
3. show `git status`
4. report current userscript version
5. run baseline syntax and relevant tests
6. confirm required commands exist
7. stop if the baseline is not reproducible

Report the preflight before or with the implementation evidence.

## Context

Include only history needed to understand this task.

- Current behavior:
- Confirmed problem:
- Evidence:
- Previous attempts:
- Decisions already made:
- Relevant PRs/issues:

Do not ask the coding agent to rediscover settled product decisions from unrelated repository history.

## Required user-facing behavior

Describe exactly what the user should see and do.

1.
2.
3.

## Existing architecture to reuse

List functions, storage paths, owners, patterns, or tests that remain authoritative.

- `<function or subsystem>`
- `<storage or normalization path>`
- `<existing test>`

Do not create a parallel implementation when an existing owner should be extended.

## Safety invariants

- Preserve userscript `SAFETY BOUNDARY`.
- Preserve browser-local data unless export is explicitly requested.
- Send API keys only to official Torn API endpoints.
- Never perform unattended gameplay actions.
- Never invent missing transaction data.
- Repeated initialization must not create duplicate listeners, timers, observers, panels, or badges.
- Persistent mutations must be deterministic, deduplicated, and recoverable.
- Additional task-specific invariants:
  -
  -

For Black Ledger work, read and obey `docs/LEDGER-INVARIANTS.md`.

## In scope

- 
- 
- 

## Explicitly out of scope

- 
- 
- 

Do not broaden scope without stopping and reporting the dependency.

## Required implementation

### Data source

Describe authoritative input and normalization requirements.

### State and storage

Describe storage keys, schema expectations, compatibility, and migrations.

### UI and interaction

Describe controls, confirmation, mobile behavior, and empty/error states.

### Deduplication and retries

Describe stable identity, secondary fingerprinting, and repeated-action behavior.

### Error handling

Describe fail-closed states and user-visible recovery guidance.

## Required tests

Add focused tests for:

- successful path
- empty or missing data
- malformed data
- ambiguous identity
- duplicates and retries
- cancellation
- persistence or normalization
- task-specific edge cases

List exact named cases:

1.
2.
3.

## Protected regressions

Run and preserve:

- userscript syntax
- `git diff --check`
- affected subsystem tests
- related protected-system tests
- task-specific established regressions

Exact commands expected:

```bash
# Add commands here
```

## Change-budget guardrails

Report changes to:

- userscript version markers
- storage keys
- exported schema
- API endpoints
- event listeners
- timers
- MutationObservers
- DOM ownership IDs
- gameplay-action boundaries

Do not introduce unrelated formatting churn.

## Stop conditions

Stop and report instead of improvising when:

- baseline tests fail
- base SHA differs
- required source data is unavailable or contradicts the specification
- a new migration is required but not approved
- accounting ownership is ambiguous
- the diff must exceed approved scope
- tests cannot be executed
- the environment would need to edit `main`
- a safety gate would need to be weakened
- two attempts reveal architectural uncertainty

## Deliverables

Provide:

- implementation
- focused tests
- protected regression results
- cleanup of replaced code
- documentation updates
- consistent version update when product code changes
- changed-file summary
- exact commands and results
- storage/network/event change report
- known limitations
- manual test plan
- rollback plan
- draft PR description

## Manual TornPDA verification

State:

1. exact branch build and head SHA
2. backup required
3. page to open
4. setup data
5. user actions
6. expected visible result
7. expected stored result
8. prohibited result
9. reload/retry check
10. integrity check

Do not claim this manual test passed unless it was actually performed.

## No-merge rule

Do not merge, enable auto-merge, or modify `main`.

Leave the branch and PR ready for assistant review, owner TornPDA testing, and explicit owner authorization.

---

## Compact task header

Use this at the top of the owner's review message:

> **Project:** `<name>`  
> **Mode:** Implementation  
> **Risk:** `<tier>`  
> **Recommended tool:** `<tool>`  
> **Baseline:** `<version and SHA>`  
> **Scope:** `<one sentence>`  
> **Excluded:** `<one sentence>`  
> **Expected passes:** one implementation, one consolidated review, one bounded repair  
> **Manual gate:** `<summary>`  
> **Merge:** owner authorization required
