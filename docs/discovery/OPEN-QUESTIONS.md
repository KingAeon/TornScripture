# TornScriptures Discovery Open Questions

This file records unresolved questions that must not be silently converted into assumptions. Closing a question requires evidence and should update the Capability Registry and Discovery Log.

Priority labels describe research value, not implementation priority.

## 1. Black Ledger and completed trades

### DQ-TRADE-001 — When does a finished trade become visible through v2?

**Priority:** High

Measure the delay, if any, between Torn's final completed-trade screen and appearance in `GET /user/trades?cat=finished`.

Record:

- TornPDA/desktop environment
- trade ID
- final completion time
- first API-visible time
- whether API service caching affects the result

Do not use an accounting-significant trade merely for testing.

### DQ-TRADE-002 — What is the exact live detailed-trade response for our normal sales?

**Priority:** High

Capture a sanitized controlled response from `GET /user/{tradeId}/trade` for a low-value completed money-for-items trade and compare it field-for-field with the current OpenAPI.

Required before another Black Ledger API recovery specification.

### DQ-TRADE-003 — What unsupported asset combinations must fail closed?

**Priority:** High

The documented trade item union includes Money, Item, Faction, Company, Property and NAP. Determine which combinations TornScriptures would ever support and which must remain review-only or rejected.

No product decision yet.

### DQ-TRADE-004 — What is the smallest acceptable key for finished-trade recovery?

**Priority:** High

Determine exact custom selection(s), key-info representation, TornPDA compatibility and whether a user can grant only what the feature needs without weakening usability.

### DQ-TRADE-005 — Can finished-trade identity safely replace content/time heuristics as primary deduplication?

**Priority:** High

Requires live confirmation of trade ID persistence and response consistency. Do not redesign current ledger identity during discovery.

## 2. Inventory and reconciliation

### DQ-INV-001 — What does the one-hour-per-category inventory cache do after a live buy/sale/trade?

**Priority:** High

Measure whether:

- the category remains the old snapshot for the entire hour
- different request timestamps matter
- categories refresh independently as documented
- any metadata exposes the snapshot's effective age

### DQ-INV-002 — What is the best immediate source for inventory change?

**Priority:** High

Compare, without implementation:

- Torn's visible page state
- documented API inventory
- own Item Market listing data
- transaction-specific API/history sources
- legitimate browser application state already delivered to the user's page

The goal is not to find a hidden shortcut. The goal is to identify the least fragile truthful source.

### DQ-INV-003 — Are IMM and ISH duplicating catalog/inventory retrieval unnecessarily?

**Priority:** Medium

Map request cadence, local storage duplication and feature ownership before considering a shared source.

## 3. Item Market and pricing

### DQ-MARKET-001 — What are the practical cache delays for public Item Market responses?

**Priority:** High

Record actual `cache_timestamp` / `cache_delay` behavior across representative items and compare with the visible market page.

### DQ-MARKET-002 — Which source is freshest for the user's active market decision?

**Priority:** High

Compare API listing state and visible-page listing state without assuming either wins globally.

### DQ-MARKET-003 — How much listing depth can the API expose economically?

**Priority:** Medium

Assess pagination, request counts, duplicate/changed listings and whether depth information adds real value to future market-history analysis.

### DQ-MARKET-004 — Does Torn expose any official historical market series we have not yet catalogued?

**Priority:** High

Search all current Market, Torn and relevant user selections before building local historical collection solely because we assume history is unavailable.

## 4. Bazaar capabilities

### DQ-BAZAAR-001 — What exactly does the `user:bazaar` v1 fallback provide today?

**Priority:** High

The current v2 user selection enum contains Bazaar through fallback behavior and the API docs identify `user:bazaar` as globally cached. Record its exact response, permissions, freshness and limitations before designing Bazaar inventory features.

### DQ-BAZAAR-002 — How often and by what rules do public Bazaar directories update?

**Priority:** Medium

Determine practical freshness and whether weekly directory labels are ranking snapshots, rolling measures, or something else documented by Torn.

### DQ-BAZAAR-003 — What does the item-specialized Bazaar directory provide beyond discoverability?

**Priority:** Medium

Inspect exact response fields and determine whether it contains price/listing information or only directory identity/ranking data.

## 5. War Intelligence

### DQ-WIH-001 — How fresh is `/faction/{id}/members` compared with the rendered faction page?

**Priority:** High

For controlled observations, compare:

- `last_action.timestamp`
- activity status
- life status/state
- hospital/jail/travel `until` timing
- time of page-rendered change
- time of API-observed change

### DQ-WIH-002 — What request cadence would a faction-wide API source require?

**Priority:** High

Measure actual freshness first. Then calculate request cost for realistic war monitoring. Do not assume one-minute polling or any cadence during discovery.

### DQ-WIH-003 — What does the API lose that the rendered-page observer currently preserves?

**Priority:** High

Examples to test rather than assume:

- visible wall/war context
- UI-only status wording
- observation provenance
- page-specific membership context
- behavior when WebView/background execution pauses

### DQ-WIH-004 — Could API and page observations complement each other instead of replacing one another?

**Priority:** Medium

Architecture question intentionally deferred until DQ-WIH-001 through 003 have evidence.

## 6. API key UX, permissions and trust

### DQ-KEY-001 — What is TornScriptures' minimum permission matrix by domain?

**Priority:** High

Build a matrix for:

- Core identity/key diagnostics
- Market/Trader
- Black Ledger
- Inventory/Bazaar
- War Intelligence

Record exact selection, access level, reason, and whether the feature can function without it.

### DQ-KEY-002 — How does TornPDA managed-key injection interact with custom keys?

**Priority:** High

Verify actual TornPDA behavior before designing a custom-key onboarding flow.

### DQ-KEY-003 — Should TornScriptures eventually display an API permission/use report?

**Priority:** Medium

Potentially derive from `/key/info` and local source declarations. Evaluate whether it improves user trust without exposing sensitive information.

### DQ-KEY-004 — Can `/key/log` help us prove request efficiency without creating privacy concerns?

**Priority:** Medium

Assess what would be displayed, whether IP information should be ignored, and whether local counters are sufficient instead.

## 7. Torn catalog and item metadata

### DQ-CATALOG-001 — Broad catalog versus targeted item lookup

**Priority:** Medium

Compare request count, payload size, storage size, refresh needs and domain use cases for:

- `GET /torn/items`
- `GET /torn/{ids}/items`

Do not optimize only for payload size if future analytics legitimately needs the broad catalog.

### DQ-CATALOG-002 — Which catalog values are volatile and how fresh are they?

**Priority:** High

Market price is embedded in item catalog value data. Establish its update semantics before treating it as a live market price rather than a reference value.

## 8. Torn page and browser application state

### DQ-PAGE-001 — What structured data does Torn already deliver to the browser for our relevant pages?

**Priority:** High

Investigate legitimately available page/application state on:

- Item Market
- trade pages
- inventory
- Bazaar
- faction/member pages

Classify each finding:

- documented/supported
- visible-page derived
- embedded but undocumented
- transient/internal

Do not call undocumented internal data an API and do not make architecture depend on it merely because it is convenient.

### DQ-PAGE-002 — Which current DOM observers/pollers exist because we lacked an official source?

**Priority:** High

Inventory the current scripts' observers, timers, page scans and network interceptions later, then match each to the Capability Registry. This is an architecture-audit input, not a refactor authorization.

### DQ-PAGE-003 — Which page-state sources are more authoritative than API because of cache delay?

**Priority:** High

Identify these cases explicitly rather than applying a global API-first rule.

## 9. Third-party trader sources

### DQ-EXT-001 — What are Weav3r's documented price-source and freshness guarantees?

**Priority:** High

Record:

- official documentation/terms
- how price pages are generated
- update cadence
- item identity guarantees
- failure modes
- whether TornScriptures is scraping rendered pages or consuming a supported export/API

### DQ-EXT-002 — What are TornExchange's documented price-source and freshness guarantees?

**Priority:** High

Use the same evidence fields as Weav3r.

### DQ-EXT-003 — Does Torn expose an official source that can replace any third-party dependency without losing trader-specific payout information?

**Priority:** High

Do not assume yes. Trader-specific offered prices may be inherently external/user-published data.

## 10. Public release and trust

### DQ-TRUST-001 — What API/privacy disclosure should every TornScriptures user be able to inspect?

**Priority:** Medium

Potential future disclosure generated from the registry:

- exact selections used
- why each is used
- where the key is stored
- where user data is stored
- what is never transmitted to TornScriptures
- external services contacted by each optional feature

### DQ-TRUST-002 — Can optional domains request only their own permissions?

**Priority:** Medium

This is important to the long-term modular-monolith idea, but no architecture should be selected until the permission matrix exists.

## 11. Discovery maintenance

### DQ-META-001 — How should we detect OpenAPI changes over time?

**Priority:** Medium

A later lightweight research tool could compare:

- OpenAPI version
- lookup selection lists
- endpoint stability/access descriptions
- schemas for capabilities TornScriptures actually depends on

This is maintenance tooling, not product runtime functionality.

### DQ-META-002 — Which discoveries require periodic live reverification?

**Priority:** Medium

Develop a cadence based on volatility. API contracts and third-party providers likely need more frequent rechecks than stable local accounting invariants.
