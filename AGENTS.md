# TornScriptures Agent Guide

This file defines the standing rules for AI coding agents, automations, and contributors working in this repository. Task-specific instructions may add restrictions, but they may not silently weaken the safety, compatibility, accounting, verification, or release rules below.

## Project doctrine

TornScriptures is developed through discussion, specification, isolated implementation, verification, and explicit release.

Stable code and user data are protected above speed. Coding agents implement approved specifications but do not define product direction or merge their own work. Accounting paths fail closed. Persistent changes require tests and recovery plans. No tool is trusted until it proves the complete repository-to-verification workflow.

## Authority

1. **Project owner:** decides product behavior, acceptable compromises, spending, manual-test outcomes, and merge authorization.
2. **Project assistant:** converts rough requests into scope, risks, acceptance criteria, tool choice, review findings, and release recommendations.
3. **Coding agent:** implements the approved specification on an isolated branch and reports evidence.
4. No coding agent may merge, enable auto-merge, push product changes directly to `main`, or reinterpret approval of a design as authorization to release code.

Read `docs/PROJECT-CHARTER.md`, `docs/ASSISTANT-OPERATING-RULES.md`, `docs/DEVELOPMENT-WORKFLOW.md`, and `docs/LEDGER-INVARIANTS.md` when the task touches their scope.

## Project purpose

TornScriptures is a collection of quality-of-life userscripts and utilities for Torn. Its tools organize, calculate, record, and visualize information already available to the player. They must not silently play the game, make decisions for the player, or perform unapproved gameplay actions.

## Repository landmarks

Primary userscripts currently include:

- `TornScripture-Item-Market-Margin.user.js`: Item Market Margin, abbreviated IMM. This is the most actively developed script and includes market overlays, trader tools, purchase and sale tracking, Priced Trade, Trade Exit Audit, and Black Ledger accounting systems.
- `TornScripture-War-Intelligence-HUD.user.js`: War Intelligence HUD, abbreviated WIH. It records visible faction observations locally and provides history, diagnostics, and reports.
- `TornScripture-Inventory-Sales-HUD.user.js`: Inventory Sales HUD, abbreviated ISH. It performs user-triggered inventory scans and builds local sale plans.
- `data/`: shareable configuration and example data. Never place API keys, private inventory exports, or personal data here.
- `.github/`: issue forms, pull-request templates, and maintained repository automation.
- `docs/`: project governance, architecture, invariants, decisions, roadmaps, and workflow documentation.
- `scripts/`: maintained development utilities only. Do not leave one-use patchers behind unless the project owner explicitly approves their retention.

Before editing a file, read its userscript metadata block, `SAFETY BOUNDARY`, application constants, storage keys, and the complete functions involved in the requested behavior.

## Project modes

Every request belongs to one mode:

- **Discussion:** explore behavior, alternatives, and priority. No repository changes.
- **Specification:** freeze scope, exclusions, invariants, tests, and manual gates. No product changes.
- **Implementation:** edit only an isolated feature branch according to the approved specification.
- **Verification:** run tests, inspect the diff, and make only evidence-driven corrections.
- **Release:** perform final checks and merge only after explicit owner authorization.

An idea, question, screenshot, feasibility request, or statement of preference is not implementation approval.

## Risk tiers

Classify work before implementation:

### Tier 0: no code

Research, planning, naming, roadmaps, issue writing, PR review, test planning, and release notes.

### Tier 1: low risk

Documentation, static wording, read-only diagnostics, simple presentation, nonpersistent display changes, and test fixtures.

### Tier 2: medium risk

Persistent UI preferences, trader classifications, filters, read-only API panels, known event handlers, and mobile-layout behavior.

### Tier 3: high risk

Ledger mutations, FIFO, purchase or sale recording, recovery, deduplication, storage migrations, cross-page state, receipts, and external trade reconstruction.

### Tier 4: critical architecture

Storage replacement, ledger-model redesign, userscript modularization, servers, shared databases, authentication, public multi-user synchronization, and irreversible migrations.

Tier 3 and Tier 4 work require a full executable repository workspace, baseline tests, dedicated tests, rollback, manual TornPDA verification, Ledger Integrity, and explicit merge authorization.

## Required toolchain preflight

Before editing product code, report and verify:

- repository: `KingAeon/TornScripture`
- requested base branch and exact base commit SHA
- current userscript version
- clean working tree
- commands available for syntax and test execution
- relevant existing tests and their baseline result
- dedicated feature branch
- ability to inspect the complete diff and publish a verified commit

Stop before product edits when:

- the repository cannot be fully materialized
- baseline tests cannot be executed
- the base SHA differs from the specification
- the working tree is not understood
- the environment cannot inspect the final diff
- the tool cannot publish to an isolated branch

A GitHub connector that can read or write repository objects is not automatically a substitute for a checked-out repository and executable test workspace.

## Release safety

`main` is effectively the live release channel because userscript `@downloadURL` and `@updateURL` metadata points to raw files on `main`.

Therefore:

1. Treat `main` as protected even when repository settings do not enforce it.
2. Do not push unreviewed `.user.js` changes directly to `main`.
3. Use a focused branch for product changes.
4. Show the owner the relevant diff and validation results before merge.
5. Documentation-only changes do not require a userscript version bump.
6. For a release-ready userscript change, increment the patch version unless another versioning decision is approved.
7. Update every matching version marker consistently, including metadata, ownership markers, header comments, and application constants.
8. Do not create temporary self-modifying release workflows, trigger files, patch runners, or placeholders on `main`.
9. Do not use `main` as a scratchpad or workflow-trigger surface.
10. Do not force-update `main` unless restoring an exact independently verified commit and the owner has authorized that action.
11. Keep rejected experiments on named branches long enough to document the evidence, then close them clearly as unmerged checkpoints.

## Non-negotiable product boundaries

- Preserve the safety boundary written inside each userscript.
- No unattended gameplay automation.
- No automatic buying, selling, listing, sending, accepting, attacking, traveling, training, or other gameplay actions.
- A helper may fill a field only when that behavior is already within the script's documented boundary and remains clearly user-triggered.
- Destructive or bulk actions require an explicit user action and confirmation.
- API calls must be intentional and documented. API keys may be sent only to the official Torn API.
- Never commit API keys, session data, cookies, private exports, or personal inventory data.
- Keep stored information browser-local unless the feature explicitly exports data at the user's request.
- Do not weaken counterparty verification, confirmation gates, or action-arming safeguards to make a feature appear more reliable.
- Never invent missing counterparty, item, quantity, money, ownership, or completion data.

## Scope discipline

Every implementation task must state:

- mission
- repository and baseline
- relevant context
- required behavior
- existing architecture to reuse
- safety invariants
- in-scope work
- explicit exclusions
- required tests
- protected regressions
- stop conditions
- deliverables
- manual verification plan
- rollback method
- no-merge rule

Implement the complete approved feature, its tests, cleanup, documentation, versioning, and manual instructions in one coherent pass when those items share architecture.

Do not bundle unrelated systems merely to reduce context reloads. For example, API trade recovery, bazaar branding, trader hiding, and mobile layout are separate projects even when they all live inside IMM.

## Change discipline

1. Restate the requested behavior and identify the affected script or subsystem.
2. Inspect before editing. Find the existing owner, render path, event binding, storage path, normalization path, and cleanup path.
3. Explain the likely root cause before proposing a bug repair.
4. Make the smallest coherent change that fixes the approved problem.
5. Avoid unrelated cleanup, renaming, formatting churn, or architectural rewrites.
6. Reuse existing helpers and ownership markers instead of creating parallel systems.
7. Ensure repeated initialization is safe and does not create duplicate panels, badges, buttons, observers, timers, or listeners.
8. Preserve existing storage keys and exported schemas whenever possible.
9. When stored data must change shape, add normalization or migration logic that remains backward compatible and reversible where practical.
10. Keep cleanup and deduplication reversible, especially for ledger data.
11. Do not silently delete historical records or reset user settings.
12. Keep comments focused on safety boundaries, non-obvious browser behavior, migrations, and invariants.
13. Stop when the approved change requires a larger architecture than the specification permits.

## Compatibility rules

- Treat TornPDA on Android as a first-class environment.
- Preserve Tampermonkey and Violentmonkey compatibility in normal desktop browsers.
- Do not assume Node.js APIs, build tooling, modules, or browser extensions exist inside the userscript runtime.
- Prefer standard browser APIs supported by modern Chromium WebViews.
- Account for Torn's dynamic page navigation, delayed rendering, recycled DOM nodes, and mobile layouts.
- Avoid fixed widths that overflow narrow screens.
- Interactive controls must remain usable by touch.
- Do not depend solely on hover behavior.
- Preserve dark, light, and automatic theme behavior where already supported.

## IMM protected systems

Item Market Margin is a large single-file application with several systems sharing state and DOM ownership. Before editing IMM, search for and understand all callers of the relevant functions and keys.

Treat these areas as protected unless the task specifically targets them:

- early trader price-page capture and handoff
- transaction and purchase capture
- purchase-lot and capital-source accounting
- Black Ledger normalization, deduplication, cleanup, and receipt audits
- completed-trade sale recording
- Priced Trade counterparty verification
- row-badge ownership and duplicate prevention
- Quick MAX and Override MAX arming and submission boundaries
- Trade Exit Audit read-only comparison behavior
- trader classification, hiding, and watchlists
- stored catalog and trader-book compatibility

At minimum, verify that these established functions still exist after broad IMM changes:

- `recordTradeSale`
- `pricedTradeRenderRowBadge`
- `pricedTradeEnsureNativeMaxButton`
- `normalizeLedger`

Do not duplicate these systems with a second implementation. Repair or extend the existing owner.

## Black Ledger accounting rules

Read `docs/LEDGER-INVARIANTS.md` before changing purchases, lots, sales, recovery, receipts, deduplication, import/export, or integrity logic.

At minimum:

- Never consume FIFO lots without complete and reviewable source data.
- Unknown, partial, unsupported, malformed, or ambiguous transactions fail closed.
- A retry, reload, reopened page, duplicated event, or repeated API response must not consume quantities twice.
- Manual recovery remains available when automatic or API recovery is unavailable.
- Synthetic tests do not replace TornPDA manual verification.
- A failed transaction capture must leave existing lots and sale history unchanged.
- Storage migrations require a normalization path, compatibility plan, export backup, and rollback strategy.

## WIH data rules

- Preserve existing IndexedDB and local-storage identifiers so upgrades do not erase history.
- Do not manufacture certainty from incomplete observation coverage.
- Reports must distinguish observations, gaps, and inference.
- Keep import, export, purge, and diagnostics usable on Android.
- Avoid background requests or gameplay actions unless the owner explicitly redesigns the product boundary.

## ISH data rules

- Inventory scans remain user-triggered.
- Weapons and armor remain protected from automatic sale recommendations.
- The script must not sell, send, list, or trash items.
- Keep API keys and inventory data local.
- Preserve the TornPDA managed-key placeholder.
- Recommendations must remain distinguishable from actions.

## Stop conditions

Stop and report instead of improvising when:

- baseline tests fail before changes
- source data differs materially from the specification
- a storage migration becomes necessary but was not approved
- accounting ownership or transaction identity is ambiguous
- the diff expands beyond approved scope
- an external API response is undocumented or incomplete
- a real-world test disproves the selected architecture
- two correction cycles expose architectural uncertainty
- required tests cannot be executed
- the agent would need to touch `main`
- the only path forward is to weaken a safety boundary or confirmation gate

One bounded diagnostic may be proposed after a real-world failure. Do not stack selectors, listeners, timers, retries, or compatibility layers onto a disproven approach.

## Validation

Run the narrowest checks that cover the change, then report exactly what ran and whether it passed.

For any changed userscript:

```bash
node --check path/to/changed-script.user.js
git diff --check
```

Also verify:

- the metadata version matches the internal application version for release changes
- no API key, secret, private export, or generated personal data entered the diff
- no duplicate DOM ownership IDs, badges, panels, timers, observers, or listeners were introduced
- existing storage keys were not renamed accidentally
- mobile layout does not gain obvious horizontal overflow
- the safety boundary still accurately describes behavior

For IMM changes, search for the protected functions listed above and run focused checks for the edited subsystem.

For documentation-only changes:

- confirm no `.user.js`, test, workflow, storage, or release metadata changed
- inspect Markdown links and headings
- validate YAML syntax for issue forms
- inspect the complete branch-to-main diff

If automated browser tests are unavailable, provide a concise manual smoke-test checklist instead of claiming the feature is fully tested.

## Manual smoke-test expectations

A useful smoke test names:

- the Torn page to open
- the user action to perform
- the expected visible result
- the expected stored-data result, when applicable
- what must not happen
- desktop and TornPDA checks when UI or DOM behavior changed
- reload or retry behavior when persistent data changed

## Verification language

Distinguish these states precisely:

- designed
- implemented
- syntax-checked
- unit-tested
- regression-tested
- manually tested
- merged
- released

A design is not an implementation. A passing fixture is not a real TornPDA test. An open PR is not a release.

## Required completion report

After completing a task, report:

1. base SHA and resulting head SHA
2. what changed and why
3. files touched
4. scope completed and scope intentionally untouched
5. exact validation commands and results
6. storage keys or schemas changed
7. event listeners, timers, observers, or network endpoints added or removed
8. manual tests still required
9. risks, assumptions, and known limitations
10. rollback method
11. explicit statement that the work remains unmerged

Never claim a browser behavior was tested unless it was actually exercised in a browser environment.

## Coding-budget discipline

- Do not spend coding-agent usage during unresolved product debate.
- Prefer one primary implementation pass, one consolidated review pass, and at most one bounded evidence-driven correction.
- Use lower-cost tools for Tier 1 work and well-contained Tier 2 work.
- Reserve strong full-repository agents for Tier 3 and Tier 4 work.
- Review a complete PR before requesting another paid agent pass.
- Preserve context in issues, documentation, tests, commits, and PR descriptions so later agents do not rediscover settled decisions.
- Pause and re-scope rather than repeatedly patching an architecture that no longer explains the evidence.

## Communication

Be direct and factual. A blocked feature is not a failed project. State whether a route failed, a task is paused, or a stronger workspace is required. Never claim success that the available evidence does not support.
