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
- Governance release commit: `c9888ed6438b9962bbbbe80e2216c7453094961b`
- IMM release: `0.19.33`
- Stable product result: favorite trader carousel routing and recovery tested in TornPDA and merged through PR #91
- Governance result: bilateral charter, agent rules, ledger invariants, workflow, templates, and roadmap released through PR #99

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

Developer packaging and user packaging are separate decisions. Future source code may be split into maintained modules and built into one installable userscript without forcing the owner to manage many installations.

This architecture remains a Tier 4 destination. It must not interrupt Black Ledger recovery or rewrite stable storage without a staged migration, rollback plan, and strong automated coverage.

## Current projects

| Priority | Project | Problem and outcome | Dependencies | Risk | Recommended tool | Budget | Status | Success evidence | Fallback |
|---|---|---|---|---|---|---|---|---|---|
| Released | Project governance charter | Requests, tools, risks, and releases need one shared operating system | Owner review | Tier 1 | Chat + GitHub connector | Light | Released through PR #99 | Governance files present on `main`; owner acceptance; IMM unchanged | Amend through documentation PRs |
| Now | Roadmap and Copilot guidance amendment | Record architecture, analytics, mode keys, and first coding-agent strategy | Governance release | Tier 1 | Chat + GitHub connector | Light | Implementing, Issue #100 | Documentation-only diff and owner review | Keep released governance unchanged |
| Next | GitHub Copilot workflow preflight | Copilot must prove the complete repo-to-test-to-PR loop before product work | Issue #100 release; Copilot repository access; protected `main` | Tier 0/1 | GitHub Copilot Pro cloud agent | Light | Toolchain gate | Exact baseline, clean tree, baseline tests, isolated branch, harmless draft PR | Reject Copilot for product work and test Codex or a local agent |
| Next | API-backed Black Ledger completed-trade recovery | DOM capture cannot reliably preserve finished trade items and cash; recover through official trade data with review before FIFO mutation | Successful toolchain preflight; API contract validation | Tier 3 | Codex or a strong GitHub cloud agent proven by preflight | Premium | Specified, Issue #97 | API parsing, fail-closed tests, live low-value TornPDA test, reload dedup, Ledger Integrity | Manual recovery |
| After #97 | Black Ledger recovery and audit stabilization | Make failures understandable, repairable, and auditable | API recovery result | Tier 2/3 | Strong agent; split by mutation risk | Standard/Premium | Discussion backlog | Recovery UX, exports, diagnostics, audit consistency | Existing manual tools |
| Later | Market-history foundation | Begin collecting trustworthy local price and liquidity history that future analytics can evaluate | Stable accounting and data-source design | Tier 2 | Proven Copilot, Codex, or capable local agent | Standard | Discussion backlog | Timestamped snapshots, provenance, freshness, gaps, bounded storage, export | Manual market review and external charts |
| Later | Market trend analytics and classification | Identify stagnant, rising, falling, bottoming-candidate, rebound, and overheated products with visible confidence | Sufficient market-history coverage and validation design | Tier 2/3 | Strong full-repository agent | Standard/Premium | Discussion backlog | Reproducible calculations, confidence, replay tests, false-positive tracking | Raw charts and neutral measurements only |
| Later | Trader classification and hiding | Exclude undesirable traders while preserving reversible visibility | Stable trader-book storage | Tier 2 | Copilot/Aider/OpenCode/Codex | Standard | Discussion backlog | Persistence, reveal controls, no favorite-routing regression | Manual ignore list |
| Later | Alternate trader prices on single-item pages | Show top alternatives when a preferred trader is unavailable | Stable trader routing and price-book data | Tier 2 | Capable local or cloud agent | Standard | Discussion backlog | Accurate ranked alternatives, mobile fit, read-only behavior | Existing carousel |
| Later | Buy-side trader screen and generated purchase receipts | Support profitable inbound offers and purchase-side accounting | Black Ledger sale recovery, receipt foundations, and validated analytics | Tier 3/4 | Codex or strong cloud agent | Premium/Staged | Parked pending accounting foundation | Bid boundaries, confirmed purchase, receipts, dedup, integrity | Manual purchase capture |
| Later | TornScriptures Modular Core and Hub Architecture | Replace single-file entanglement with maintained internal modules while preserving a small user-facing installation set | Stable accounting, proven workspace, automated coverage, migration design | Tier 4 | Strong agent plus architecture review | Staged premium | Discussion destination | Staged migration, compatibility, rollback, equal behavior, bounded modules | Continue stable standalone scripts |
| Later | Bazaar operating system | Inventory selection, presentation, pricing strategy, and public-facing workflow | Reliable accounting, trader workflows, and useful analytics | Tier 1-3 by subproject | Mixed tools | Mixed | Discussion backlog | Clear inventory states and measurable profitability | Manual bazaar process |

## Phase 0: governance release

Released through PR #99:

- expanded `AGENTS.md`
- project charter and mutual covenant
- assistant operating rules
- Black Ledger invariants
- development workflow
- roadmap
- coding task template
- decision register
- feature and bug issue forms
- PR template

No userscript or workflow changes occurred.

## Phase 1: prove the coding workspace

The first task for a candidate coding environment is a harmless preflight:

1. materialize `KingAeon/TornScripture`
2. check out the exact requested baseline
3. read `AGENTS.md` and relevant governance documents
4. report the current IMM version
5. show a clean working tree
6. discover and run existing syntax and relevant tests
7. create an isolated branch
8. add only an approved tooling report
9. open a draft PR containing no product change
10. report limitations and stop conditions honestly

Candidate order:

1. GitHub Copilot Pro cloud-agent preflight
2. Codex cloud or CLI for premium or failed-preflight replacement work
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

## Phase 4: market-history foundation

The first analytics release should collect and display evidence without recommending purchases.

Potential observations:

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
- measure false positives
- separate event shocks from ordinary movement
- compare multiple time windows
- display uncertainty and liquidity visibly

Analytics may inform the owner. It must not buy, list, or move money automatically.

## Phase 6: trader workflow refinement

Potential order:

1. trader classification and reversible hiding
2. alternate price display
3. availability and status hints
4. offer-generation workflow
5. purchase-side receipts

Do not combine all five into one implementation task.

## Phase 7: buy-side and bazaar expansion

Begin only after accounting foundations are dependable.

Potential projects:

- inbound offer boundaries
- expected margin and capital lock calculations
- purchase confirmation and receipts
- bazaar allocation of inventory
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

Record architecture decisions separately in `docs/DECISION-REGISTER.md`.
