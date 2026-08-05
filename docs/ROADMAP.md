# TornScriptures Roadmap

## Purpose

This roadmap records project sequence, dependencies, risk, tool choice, and coding-budget expectations. It separates ideas from active implementation and protects premium coding usage for work that genuinely requires it.

## Status vocabulary

- **Idea:** captured but not discussed enough to schedule
- **Discussion:** behavior and priority under consideration
- **Specified:** scope and acceptance criteria are frozen
- **Toolchain gate:** waiting for or proving an implementation environment
- **Implementing:** coding branch active
- **Verifying:** automated or manual tests active
- **Released:** merged and confirmed on `main`
- **Paused:** preserved with a documented dependency or failure
- **Parked:** intentionally deferred

## Coding-budget classes

- **None:** chat, research, planning, GitHub administration, review
- **Light:** documentation, templates, wording, simple diagnostics, low-risk UI
- **Standard:** contained feature logic, persistent preferences, read-only API displays
- **Premium:** ledger mutation, FIFO, recovery, migrations, cross-page state, complex API integration
- **Staged premium:** critical architecture requiring design, migration, and phased release

## Active-work limits

- One active Tier 3 or Tier 4 implementation
- One active Tier 1 or Tier 2 side implementation
- Unlimited discussion and backlog capture

## Current stable baseline

- Repository: `KingAeon/TornScripture`
- Stable branch: `main`
- Baseline commit when this roadmap was created: `0c0005a70f6a6a31976ed2b06a14b8a49fbb9951`
- IMM release: `0.19.33`
- Stable result: favorite trader carousel routing and recovery tested in TornPDA and merged through PR #91

## Current projects

| Priority | Project | Problem and outcome | Dependencies | Risk | Recommended tool | Budget | Status | Success evidence | Fallback |
|---|---|---|---|---|---|---|---|---|---|
| Now | Project governance charter | Requests, tools, risks, and releases need one shared operating system | Owner review | Tier 1 | Chat + GitHub connector | Light | Implementing, Issue #98 | Docs/templates-only diff; owner approval | Keep existing `AGENTS.md` |
| Next | Coding-workspace preflight | A coding tool must prove the complete repo-to-test-to-PR loop before product work | Governance adoption | Tier 0/1 | Copilot/Codex/local agent candidate | Light | Discussion | Exact baseline, clean tree, baseline tests, no product diff | Reject inadequate tool |
| Next | API-backed Black Ledger completed-trade recovery | DOM capture cannot reliably preserve finished trade items and cash; recover through official trade data with review before FIFO mutation | Successful toolchain preflight; API contract validation | Tier 3 | Codex or strong GitHub cloud agent | Premium | Specified, Issue #97 | API parsing, fail-closed tests, live low-value TornPDA test, reload dedup, Ledger Integrity | Manual recovery |
| After #97 | Black Ledger recovery and audit stabilization | Make failures understandable, repairable, and auditable | API recovery result | Tier 2/3 | Strong agent; split by mutation risk | Standard/Premium | Discussion backlog | Recovery UX, exports, diagnostics, audit consistency | Existing manual tools |
| Later | Trader classification and hiding | Exclude undesirable traders while preserving reversible visibility | Stable trader-book storage | Tier 2 | Copilot/Aider/OpenCode/Codex | Standard | Discussion backlog | Persistence, reveal controls, no favorite-routing regression | Manual ignore list |
| Later | Alternate trader prices on single-item pages | Show top alternatives when a preferred trader is unavailable | Stable trader routing and price-book data | Tier 2 | Capable local or cloud agent | Standard | Discussion backlog | Accurate ranked alternatives, mobile fit, read-only behavior | Existing carousel |
| Later | Buy-side trader screen and generated purchase receipts | Support profitable inbound offers and purchase-side accounting | Black Ledger sale recovery and receipt foundations | Tier 3/4 | Codex or strong cloud agent | Premium/Staged | Parked pending accounting foundation | Bid boundaries, confirmed purchase, receipts, dedup, integrity | Manual purchase capture |
| Later | Bazaar operating system | Inventory selection, presentation, pricing strategy, and public-facing workflow | Reliable accounting and trader workflows | Tier 1-3 by subproject | Mixed tools | Mixed | Discussion backlog | Clear inventory states and measurable profitability | Manual bazaar process |

## Phase 0: adopt governance

Deliver:

- expanded `AGENTS.md`
- project charter
- assistant operating rules
- Black Ledger invariants
- development workflow
- roadmap
- coding task template
- decision register
- feature and bug issue forms
- PR template

No userscript or workflow changes.

## Phase 1: prove the coding workspace

The first task for any candidate coding environment is no-change preflight:

1. materialize `KingAeon/TornScripture`
2. check out the exact requested baseline
3. report the current IMM version
4. show a clean working tree
5. run existing syntax and relevant tests
6. confirm an isolated branch can be created
7. make no product changes
8. report limitations

Candidate order may be adjusted by cost and availability:

1. GitHub Copilot local or cloud preflight
2. Codex cloud or CLI
3. Aider with a capable model
4. OpenCode with explicit permissions

A tool that cannot prove the complete loop is not used for Tier 3 work.

## Phase 2: API-backed completed-trade recovery

Canonical issue: #97.

Required first release:

- user-triggered recent finished-trade lookup
- detailed trade fetch
- owner and counterparty identification
- outgoing item aggregation
- net cash calculation
- duplicate detection
- full-coverage FIFO preview
- complete review screen
- explicit confirmation
- fail-closed unsupported cases
- manual recovery retained
- tests and live TornPDA verification

Out of scope:

- more DOM acceptance hooks
- more touch probes
- automatic recording without review
- unrelated trader UI

## Phase 3: Black Ledger stabilization

Potential subprojects:

- visible API/recovery diagnostics
- transaction provenance display
- audit repair workflows
- import/export validation
- recovery duplicate reconciliation
- clearer lot allocation views
- integrity explanations and guided repair

Classify each subproject separately. Read-only diagnostics may be Tier 1 or Tier 2. Any mutation remains Tier 3.

## Phase 4: trader workflow refinement

Potential order:

1. trader classification and reversible hiding
2. alternate price display
3. availability and status hints
4. offer-generation workflow
5. purchase-side receipts

Do not combine all five into one implementation task.

## Phase 5: buy-side and bazaar expansion

Begin only after accounting foundations are dependable.

Potential projects:

- inbound offer boundaries
- expected margin and capital lock calculations
- purchase confirmation and receipts
- bazaar allocation of inventory
- stock-aging and sell-through visibility
- public trader-facing presentation

These features may be commercially useful but should not outrank ledger truth.

## Work that should not consume premium code usage

Use chat, GitHub, or light tools for:

- naming and branding
- bazaar descriptions
- roadmap updates
- issue and PR writing
- release notes
- branch cleanup
- research summaries
- test plans
- wording and labels
- static documentation
- simple read-only presentation changes

## Work that generally warrants premium code usage

Use a strong full-repository agent for:

- FIFO or lot mutation
- sale and purchase recording
- trade recovery
- deduplication
- storage migrations
- receipt reconciliation
- complex cross-page persistence
- new accounting sources
- critical API integrations
- major single-file refactors
- public or server-backed architecture

## Reprioritization rule

A new project may move ahead when:

- it is a dependency for the active project
- it fixes a severe stable-release defect
- it protects data or security
- the active project is formally paused
- its value materially exceeds the scheduled work and the owner approves the change

Do not reprioritize solely because a newer idea is more exciting.

## Roadmap maintenance

Update this file when:

- a project enters a new status
- risk or tool choice changes
- a dependency is discovered
- a route is rejected
- a project is released
- a new major backlog item is accepted

Record architecture decisions separately in `docs/DECISION-REGISTER.md`.
