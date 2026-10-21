# Black Ledger Market-Intelligence Vision and Resume Handoff

Status: **OWNER-APPROVED DIRECTION / DISCUSSION HANDOFF** (2026-10-08)
Scope: TornScriptures IMM, Black Ledger, and adjacent advisory market tooling.
Authority: owner conversation, 2026-10-08. This document is not a frozen specification, implementation authorization, spending approval, or merge authorization.

## Owner decision

The owner accepts the full long-term vision: evolve Black Ledger from an inventory/trading assistant into a comprehensive **Torn market-intelligence and decision-support platform**. The ambition is not limited to current quotes or inventory views. Build incrementally on existing TornScriptures capabilities rather than starting over. Do not infer permission to implement all features at once.

Near-term working priority when project work resumes:
1. **Black Ledger / IMM first:** read-only repository/current-runtime reconnaissance and recovery plan to resume reliable market/trader operations.
2. **Divine Casino second:** reconcile actual post-CA-01-merge repository state and authorized next Blackjack Math Engine step before any build.
3. **Training Advisor third/parked for the session:** preserve unfinished draft PR and its independent verification gates; no abandonment or incidental edits.

Resume both Black Ledger and Casino if time/credits permit, but do not bundle their changes.

## Approved product horizon (direction, not implementation contracts)

1. **Market intelligence:** provenance-aware official Item Market/catalog/third-party trader observations; distinguish catalog market_price, average_price, executable order-book floor, trader's conditional buy offer, last observed quote, and genuinely sourced historical series. Track freshness, availability, spread, volatility, trend, and uncertainty. Collect local history over time if the official sources do not provide it. Never fabricate an historical trend or claim a predicted reversal from a current snapshot.
2. **Opportunity engine:** identify potentially undervalued items and feasible resale/trader opportunities; compare expected net profit, ROI, required capital, cash-conversion time, observed liquidity, purchase limits, fees, condition/quantity restrictions, and execution risk. An attractive theoretical margin is not proof of a realizable sale. Surface clear rationales, assumptions, and confidence.
3. **Inventory and portfolio command:** browser-local holdings, cost basis, FIFO-covered lots, realized trading P&L, unrealized marks (labeled as estimates), inventory equity, cash tied up, available capital, slow-moving inventory, and reconciliation. Strictly preserve ledger integrity, unknown-basis handling, API journal review/consume, deduplication, and user-controlled recovery.
4. **Market alerts:** watched prices, thresholds, exceptional spreads, data freshness/unavailability, and cautiously labeled bottoming or reversal candidates only after evidence supports the model. Avoid spam and false precision; investigate notification feasibility on TornPDA before promising background monitoring.
5. **Analytical advisor:** explanation-led ranking, scenario/risk analysis, historical-source evaluation, and later *validated* predictive experiments. Separate measurable observation from hypothesis. Do not present expected profits or forecasts as guarantees.
6. **TornPDA command center:** readable touch-friendly responsive UI; integrate information from IMM/Black Ledger, Casino Advisor, and Training Advisor as distinct modules with limited, reviewed shared infrastructure. No forced cross-module coupling, server, or cloud database without separately approved architectural review.

Optional owner-facing motivation: a **Private Island funding tracker** to show progress from a live/browser-local balance toward a user-set milestone and separate realized trading profits from speculative asset valuations. Do not commit the owner's actual balances, inventory, spending details, accounts, or personal data to the repository.

## Non-negotiable boundaries

- Remain **advisory and user-triggered**. No automatic market buying, selling, repricing, listing, transferring, wagering, training, or unattended gameplay.
- Torn API usage is explicit, authorized and compliant with current Torn capabilities/rules. Third-party data must pass source, permission, freshness, and actionability checks. Do not invent or bypass restricted sources.
- Keep personal ledger/inventory/market watch data local unless the owner explicitly approves an export or later architecture.
- Market intelligence cannot silently write to the Black Ledger accounting source of truth. Read `docs/LEDGER-INVARIANTS.md` before any lot, sale, recovery, or storage work.
- Maintain the existing provider contract and lifecycle work (DQ-EXT-001), official price concepts (DQ-MARKET-001), and open issue dependencies such as #78, #85, and #108. Verify their *current* status before committing to a sequence.
- Do not casually spend Codex/Work credits, Torn currency, money, or infrastructure costs. Do not assume external hosting is needed.
- Follow `AGENTS.md`: discussion → specification → isolated implementation → independent verification → owner merge/release authorization. Vision acceptance does **not** waive any gate.

## First return session: discussion + read-only reconnaissance

1. Read `docs/divine-knowledge/INDEX.md`, `NOW.md`, relevant domain indices, this handoff, `AGENTS.md`, and canonical IMM/casino/accounting documents. Recheck current main SHA, open PRs, stable IMM version, and actual TornPDA behavior rather than trusting old snapshot lines.
2. Map working versus broken IMM inventory, trader capture, trader comparisons, bazaar/market UI, price history, journal and alerts; list unresolved bugs and relevant branch/PR candidates. Safeguard browser-local storage/export before any migration or reset.
3. Identify the smallest useful **Black Ledger restoration milestone** that improves reliable actionable price comparisons without touching accounting or multiplying scope. Discuss cost, risk, acceptance criteria, test coverage, and manual TornPDA checks with owner.
4. In a separate casino lane, confirm CA-01 PR#137 is merged at the time of analysis (it was merged as of 2026-10-08, main `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`). Recheck current main and reviewed Blackjack rule uncertainty; determine whether prior owner authorization covers the next bounded pure engine work. Do not invent rule closures or build without the required exact-base preflight.
5. Keep Training Advisor PR#135 separate and untouched unless the owner explicitly reprioritizes.

## Handoff instruction for the next assistant

Begin in **[D] discussion / read-only audit**, not automatic feature implementation. Acknowledge the approved complete market-intelligence vision, inspect live GitHub sources, and return a short prioritized plan with distinct Black Ledger and Casino tracks, blockers, earliest safe feature slice, and the exact approvals still needed. Explicitly distinguish durable owner-approved direction from mutable repository/game mechanics.

Provenance: owner conversation and project-assistant roadmap discussion on 2026-10-08; repository state observation from GitHub connector on 2026-10-08. Existing canonical governance remains controlling.
