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
- Stable main SHA after the Age of Discovery checkpoint: `8944dcd9c9ae5b0d2994322efcff2c8e579b36b5`
- IMM release: `0.19.36`
- API-backed Black Ledger completed-trade recovery: released through PR #107
- Age of Discovery notebook: released through PR #109
- TornPDA native-storage qualification: closed for the current Discovery cycle
- Current active work: documentation/bookkeeping housekeeping only on `docs/housekeeping-2026-08-20`
- Next research chapter after housekeeping: DQ-KEY-001, minimum API permission and source-ownership matrix

## Architectural destination

The preferred long-term product is **one installable TornScriptures suite where practical, implemented internally as a modular monolith**.

The user-facing goal is not one enormous unstructured file and not a hub surrounded by dozens of tiny add-ons. The intended shape is:

1. **TornScriptures Core Hub**
   - navigation and shared panel shell
   - API-key and player-identity handling
   - theme, mobile behavior, settings, and feature toggles
   - shared storage, backup, import/export, diagnostics, and module registration
2. **Market and Trader domain**
   - Item Market Margin
   - trader pricing, routing, classifications, alternate prices, and market analytics
3. **Black Ledger domain**
   - purchase lots, capital sources, FIFO, sales, receipts, recovery, and audits
4. **Inventory and Bazaar domain**
   - inventory planning, bazaar stock, listing strategy, sets, restocking, and sell-through visibility
5. **War Intelligence domain**
   - faction observations, history, reports, and diagnostics

A feature should normally become a toggle or component inside one of these domains rather than a new installable add-on.

A separate script is justified only when at least one strong boundary exists:

- substantially different pages or external origins
- permissions that should not be granted to the main suite
- a distinct data lifecycle
- failure isolation from accounting systems
- a largely separate audience or purpose
- unacceptable loading or maintenance cost inside the main suite

Developer packaging and user packaging are separate decisions. Future source code may be split into maintained modules and built into one user-facing installation without forcing users to manage many installations.

This architecture remains a Tier 4 destination. It must not rewrite stable storage without a staged migration, rollback plan, and strong automated coverage.

## Current projects

| Priority | Project | Problem and outcome | Dependencies | Risk | Recommended tool | Budget | Status | Success evidence | Fallback |
|---|---|---|---|---|---|---|---|---|---|
| Released | Project governance charter | Requests, tools, risks, and releases need one shared operating system | Owner review | Tier 1 | Chat + GitHub connector | Light | Released through PR #99 | Governance files present on `main`; owner acceptance | Amend through documentation PRs |
| Released | Roadmap, mode keys, and Copilot guidance | Record architecture, analytics, mode keys, and coding-agent strategy | Governance release | Tier 1 | Chat + GitHub connector | Light | Released through PR #101 | Documentation present on `main` | Amend through documentation PRs |
| Released | GitHub Copilot workflow preflight | Prove the repository-to-test-to-PR loop before product work | Governance | Tier 0/1 | GitHub Copilot Pro cloud agent | Light | Released through PR #103 | Repository materialization, baseline checks, isolated branch, draft PR | Use another full-repository agent if needed |
| Released | API-backed Black Ledger completed-trade recovery | Replace failed mobile-DOM reconstruction with official trade data and explicit review before FIFO mutation | Toolchain proof; API contract; owner TornPDA gate | Tier 3 | Strong full-repository agent | Premium | Released as IMM v0.19.36 through PR #107 | Real trade review/record, exact FIFO, reload dedup, Ledger Integrity | Manual missed-sale recovery |
| Released | Age of Discovery checkpoint | Preserve capability, runtime, storage, and source knowledge before new architecture | Stable main; controlled live evidence | Tier 1/2 research | Chat + GitHub connector | None/Light | Released through PR #109 | Discovery registries, protocols, evidence, current-status layer | Continue evidence in new Discovery chapters |
| Now | Repository housekeeping checkpoint | Remove stale project-state claims, refresh branch cleanup evidence, and triage open backlog before the next chapter | PR #109 release | Tier 0/1 | Chat + GitHub connector | None/Light | Implementing | No runtime diff; current branch audit; accurate roadmap/status/issue state | Leave unverified branches untouched |
| Next | DQ-KEY-001 minimum permission and source-ownership matrix | Determine the smallest trustworthy permission/source footprint for each TornScriptures domain | Housekeeping release; current Torn API contract | Tier 1/2 research | Chat + GitHub connector + official sources | None/Light | Discussion / Discovery | Domain matrix for Core, Market/Trader, Black Ledger, Inventory/Bazaar, WIH | Preserve current per-script key behavior |
| After DQ-KEY-001 | Inventory freshness and immediate transaction truth | One-hour category caching means inventory cannot automatically prove immediate post-transaction state | Permission/source matrix | Tier 2 research | Chat + GitHub + controlled owner tests | Standard if implementation follows | Discovery backlog | Measured cache behavior and source comparison | Current inventory snapshots plus transaction-specific sources |
| Later | Market-history foundation | Collect trustworthy local price/liquidity history for later analytics | Source-contract validation; storage policy | Tier 2 | Proven full-repository agent | Standard | Discussion backlog | Timestamped snapshots, provenance, freshness, gaps, bounded storage, export | Manual market review and external charts |
| Later | Market trend analytics and classification | Identify stagnant, rising, falling, bottoming-candidate, rebound, and overheated products with visible confidence | Sufficient market-history coverage and validation design | Tier 2/3 | Strong full-repository agent | Standard/Premium | Discussion backlog | Reproducible calculations, confidence, replay tests, false-positive tracking | Raw charts and neutral measurements only |
| Later | Bazaar operating system | Inventory selection, presentation, pricing strategy, and public-facing workflow | Reliable accounting, trader workflows, useful analytics | Tier 1-3 by subproject | Mixed tools | Mixed | Discussion backlog | Clear inventory states and measurable profitability | Manual bazaar process |
| Later | Buy-side trader screen and generated purchase receipts | Support profitable inbound offers and purchase-side accounting | Black Ledger foundations, permission/source map, validated analytics | Tier 3/4 | Strong full-repository agent | Premium/Staged | Parked | Bid boundaries, confirmed purchase, receipts, dedup, integrity | Manual purchase capture |
| Later | TornScriptures Modular Core and Hub Architecture | Replace single-file entanglement with maintained internal modules while preserving a small user-facing installation set | Stable accounting, proven workspace, automated coverage, migration design | Tier 4 | Strong agent plus architecture review | Staged premium | Discussion destination | Staged migration, compatibility, rollback, equal behavior, bounded modules | Continue stable standalone scripts |

## Phase 0: governance release — COMPLETE

Released through PR #99 and expanded through PR #101:

- project charter and mutual covenant
- assistant and agent operating rules
- Black Ledger invariants
- development workflow
- roadmap and decision register
- issue/PR templates
- optional mode keys
- modular-monolith direction
- coding-agent selection guidance

No runtime behavior is changed by governance documentation alone.

## Phase 1: prove the coding workspace — COMPLETE

GitHub Copilot's harmless preflight was released through PR #103. The project has since also demonstrated that routine repository administration and documentation can be handled directly through the GitHub connector without spending coding-agent credits.

Current tooling doctrine remains:

- use the lightest tool that can safely complete and verify the task;
- reserve Codex/premium agents for implementation where executable full-repository reasoning is materially useful;
- do not use coding agents for naming, issue writing, roadmap cleanup, or routine GitHub administration;
- no agent may merge without exact owner authorization.

## Phase 2: API-backed completed-trade recovery — COMPLETE FOR CURRENT BOUNDARY

Released as IMM `0.19.36` through PR #107.

Current supported boundary:

- user-triggered finished-trade lookup
- detailed trade fetch from official Torn API
- strict list/detail identity reconciliation
- Torn-ID participant ownership
- outgoing item aggregation by exact item ID
- net cash calculation
- full-coverage FIFO preview
- complete review screen
- explicit confirmation
- exact API trade-ID deduplication plus secondary protections
- fail-closed unsupported/ambiguous/partial cases
- manual recovery retained
- owner TornPDA verification and post-reload Ledger Integrity

Still open as research, not release blockers:

- exact measured API visibility delay after visible finality
- broader policy for unsupported asset combinations
- recovery-only permission minimum separated from other IMM permissions
- full portable Class C backup/reconciliation design

## Phase 3: Age of Discovery — ACTIVE

The first Discovery checkpoint was released through PR #109.

Completed Discovery work includes:

- Torn API capability registry and open-question queue
- TornPDA runtime/storage capability registry
- native-storage lifecycle, scaling, batching, quota, cross-origin, and bounded concurrency qualification
- current TornScriptures storage inventory
- hybrid storage architecture decision with data classes
- Black Ledger recovery/current-state reconciliation
- durable evidence and disposable probes

TornPDA native-storage qualification is closed for the current cycle. Discovery does **not** authorize a production storage migration.

The next Discovery chapter after housekeeping is DQ-KEY-001: minimum API permissions and source ownership across all five domains.

## Phase 4: source truth, inventory freshness, and market-history foundation

After DQ-KEY-001, prioritize evidence needed to choose truthful sources before implementing shared API/storage infrastructure.

High-value questions include:

- inventory cache behavior after a buy, sale, or trade
- immediate source of inventory change
- Item Market cache provenance and practical delay
- official historical market availability
- Bazaar owner/directory capabilities and freshness
- WIH API freshness versus rendered-page observations
- legitimate structured page/application state already delivered by Torn
- Weav3r and TornExchange source/freshness guarantees

The first analytics implementation should collect and display evidence without making automatic purchases or account actions.

Potential market observations:

- timestamped item-price snapshots
- lowest visible prices and listing-depth proxies when available
- trader-price changes
- personal purchase costs and realized sale results
- source and freshness
- event-related annotations
- missing-data windows
- bounded retention and export

The storage and source design must distinguish observed facts from inferred trends.

## Phase 5: market trend analytics and validation

Potential calculations:

- short and medium moving averages
- price slope and acceleration
- drawdown from recent highs
- distance from recent lows
- volatility
- market-to-trader spread
- rebound persistence
- time spent in a narrow range
- liquidity or listing-depth proxy
- sample count, data freshness, and confidence

Potential classifications:

- stagnant
- rising
- falling
- sharp decline
- bottoming candidate
- early rebound
- overheated
- insufficient data

The first releases should use cautious language such as **potential accumulation zone** or **bottoming candidate** rather than an absolute **buy now** instruction.

Before stronger decision language is considered, the system must:

- replay historical signals
- track outcomes after each signal
- measure false positives and false negatives
- separate event shocks from ordinary movement
- compare multiple time windows
- display uncertainty and liquidity visibly

Analytics may inform the owner. It must not buy, list, sell, accept, or move money automatically.

## Phase 6: trader and Bazaar workflow refinement

Potential order depends on Discovery evidence, but likely work includes:

1. trader refresh reliability and stale-source handling
2. alternate trader-price display
3. Bazaar source/capability integration
4. offer-generation workflow
5. purchase-side receipts

Do not combine all of these into one implementation task.

## Phase 7: buy-side and Bazaar expansion

Begin only after accounting foundations and source ownership are dependable.

Potential projects:

- inbound offer boundaries
- expected margin and capital-lock calculations
- purchase confirmation and receipts
- Bazaar allocation of inventory
- stock-aging and sell-through visibility
- public trader-facing presentation

These features may be commercially useful but should not outrank ledger truth.

## Phase 8: modular core and hub migration

This phase begins only after stable behavior and sufficient automated coverage exist.

Required design work:

- inventory existing functional owners and storage keys
- define core services and the small domain boundary set
- decide build and release packaging
- preserve direct-install and update behavior
- stage migrations without rewriting all domains at once
- prove backward compatibility and rollback
- keep optional features toggleable without multiplying installable scripts unnecessarily

Do not use modularization as cover for unrelated product redesign.

## Work that should not consume premium code usage

Use chat, GitHub, or light tools for:

- naming and branding
- Bazaar descriptions
- roadmap updates
- issue and PR writing
- release notes
- branch cleanup
- research summaries
- test plans
- wording and labels
- static documentation
- source/permission inventory

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
- validated trend-classification engines that influence substantial spending
- major single-file refactors
- modular hub migration
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

Record architecture decisions separately in `docs/DECISION-REGISTER.md`. Use `docs/discovery/CURRENT-STATUS.md` as the first-stop current factual state for active Discovery work.
