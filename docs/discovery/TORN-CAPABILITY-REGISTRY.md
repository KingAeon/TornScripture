# Torn Capability Registry

Status: **Age of Discovery / LIVE-VERIFIED CAPABILITIES RECORDED / NO NEW PRODUCT AUTHORITY**

Last broad review: **2026-08-25**

Official baseline reviewed:

- Torn API documentation: `https://www.torn.com/api.html`
- Torn API v2 OpenAPI: `https://www.torn.com/swagger/openapi.json`
- DQ-KEY-001 live baseline: `6.11.1`
- DQ-MARKET-001 live-run baseline: `6.12.0`
- build-time OpenAPI recheck: `6.13.1`
- API v2 base URL: `https://api.torn.com/v2`

This registry records capabilities before architecture. Nothing in this file authorizes a runtime change.

## 1. General Torn API capabilities and constraints

### API authentication

**Evidence:** Official

The v2 OpenAPI security scheme uses the `Authorization` header with the `ApiKey <key>` format. TornScriptures IMM and ISH already use that documented header style.

**Architecture relevance:** Authentication behavior is known and should be shared rather than reinvented if TornScriptures later consolidates API handling.

**State:** Assessed, currently used.

### Access levels and custom keys

**Evidence:** Official + DQ-KEY-001 live + DQ-MARKET-001 live

Torn supports normal access levels as well as Custom keys that can grant exact selections. The current key can be introspected with `/key/info`.

DQ-KEY-001 established that broad access level is not the permission truth for Custom keys. Exact Custom grants including `user:inventory`, `user:trades`, `user:trade` and `user:bazaar` operated while `/key/info` still reported broad `access.level: 0`.

DQ-MARKET-001 added a complementary Public-tier nuance: a narrow Custom key without Market → `itemmarket` received Torn error 16 from `GET /market/{id}/itemmarket`; adding exact Market → `itemmarket` made the endpoint succeed while broad level remained 0.

However, DQ-KEY-001 also observed the Public `/faction/{id}/members` endpoint succeeding without `members` being enumerated in `/key/info`. Therefore `/key/info` exact-selection enumeration is powerful for Custom/private grants but is not a universal manifest for every Public capability.

A narrowly selected key still deserves strong handling merely because it exposes fewer selections.

**Architecture relevance:** Future TornScriptures permission UX should explain feature-specific capabilities and validate them according to the endpoint's actual contract rather than requiring a generic Limited/Full label.

**State:** Live least-privilege evidence exists for DQ-KEY-001 A-D and DQ-MARKET-001 Item Market access. Runtime packaging/onboarding remains future work.

### Request limit

**Evidence:** Official API documentation

Torn documents a limit of 100 individual requests per minute across a user's API keys.

**Architecture relevance:** Staying below the limit is not the design target. TornScriptures should retrieve only what it needs, reuse data where appropriate, and record the request cost of candidate sources.

**State:** Assessed.

### Service and global caching

**Evidence:** Official API documentation + endpoint contracts + DQ-MARKET-001 live

Torn documents a normal service cache of up to roughly 30 seconds for many requests. A request `timestamp` parameter exists to bypass applicable service-cache reuse. Some selections are globally cached and cannot be forced fresh by the client.

Known globally cached selections include:

- `market:itemmarket`
- `market:properties`
- `market:rentals`
- `company:companies`
- `user:bazaar`
- `torn:bounties`
- `user:bounties`

Individual endpoints can define stronger caching rules. `/user/inventory`, for example, explicitly documents a one-hour cache per category.

DQ-MARKET-001 repeatedly observed `cache_delay: 30` in Item Market responses and advancing cache timestamps/book states. This proves short-timescale refresh behavior for the tested runs, not an exact 30-second rendered-page-to-API propagation guarantee.

**Important:** Browser `fetch(..., { cache: 'no-store' })` controls browser caching. It is not evidence that Torn's server-side or global cache was bypassed.

**State:** Assessed generally; Item Market cache provenance live-recorded; endpoint-specific freshness must still be recorded separately.

### Comment parameter and API request history

**Evidence:** Official

The v2 endpoints commonly accept a `comment` parameter. `/key/log` exposes recent API requests including metadata such as timestamp, request type, selections, ID, comment and IP.

**Architecture relevance:** TornScriptures already sends descriptive comments in several API calls. Key request history may later provide a user-visible audit or debugging source without inventing our own remote telemetry.

**State:** Assessed, not proposed for product use.

## 2. Discovery meta-capabilities

### CAP-META-001: Section lookup endpoints

**Evidence:** Official

Stable public `lookup` endpoints exist for major API sections, including User, Faction, Market, Torn, Company, Racing, Forum and Property. Their purpose is to return the selections available for that section.

Examples:

- `GET /user/lookup`
- `GET /faction/lookup`
- `GET /market/lookup`
- `GET /torn/lookup`
- `GET /company/lookup`
- `GET /racing/lookup`

**Why this matters:** The capability registry does not have to rely forever on a hand-maintained memory of selection names. A future research/maintenance tool could compare the current official lookup surface with a recorded snapshot and flag additions or removals.

**Permission:** Public

**Stability:** Stable

**Current TornScriptures use:** None known.

**Decision:** DISCOVERED ONLY.

### CAP-META-002: API server timestamp selections

**Evidence:** Official

Major sections expose stable public timestamp selections.

**Why this matters:** Torn server time may be useful later for source provenance or comparing local observation time with API time. It should not be assumed necessary until a concrete timing problem requires it.

**Decision:** DISCOVERED ONLY.

## 3. Key capabilities

### CAP-KEY-001: Inspect granted key permissions

**Endpoint:** `GET /key/info`

**Evidence:** Official + DQ-KEY-001 live + DQ-MARKET-001 live

**Permission:** Available to an API key for inspecting itself.

**Stability:** Stable

**Provides:**

- key owner identity
- key access information
- granted selections grouped by section
- custom permission details where applicable
- log permission information

**Current TornScriptures use:** IMM already probes this endpoint during key checks.

**Live verification:** DQ-KEY-001 A-D repeatedly captured sanitized `/key/info` responses sufficient for stable owner-ID and Custom-permission diagnostics. DQ-MARKET-001 used `/key/info` to prove the Market `itemmarket` Custom-selection A/B behavior.

**Important limitation:** Public capability cannot universally be inferred from exact selection-name enumeration, because DQ-KEY-001 observed faction members working while `members` was absent from the Faction selection array.

**Decision:** LIVE VERIFIED FOR DIAGNOSTICS. New runtime permission UX remains future specification.

### CAP-KEY-002: Inspect recent API requests

**Endpoint:** `GET /key/log`

**Evidence:** Official

**Stability:** Stable

**Provides:** Up to the key's recent request-history entries, with request metadata.

**Current TornScriptures use:** None known.

**Potential value:** Diagnostics, request-cost auditing, and proving which selections TornScriptures actually touched.

**Open concern:** Privacy and whether a local diagnostic adds enough value to justify surfacing IP/request history.

**Decision:** DISCOVERED ONLY.

## 4. User inventory, listings and trade capabilities

### CAP-USER-001: User inventory snapshot

**Endpoint:** `GET /user/inventory`

**Evidence:** Official + existing IMM/ISH use + DQ-KEY-001 live

**Permission:** Official endpoint requires a Minimal key. DQ-KEY-001 live-proved an exact Custom `user:inventory` grant working while broad `/key/info` level remained 0.

**Stability:** Stable

**Freshness:** Explicitly cached for one hour per category.

**Request shape:** Category-based with pagination; current limit supports up to 250 entries per page.

**Provides:** Item ID, amount, equipped state, name, faction-owned flag, UID where applicable, inventory timestamp and response metadata.

**Current TornScriptures use:**

- IMM inventory reconciliation
- Inventory Sales HUD user-triggered category scan

**Important limitation:** The one-hour-per-category cache means this endpoint is not automatically suitable as immediate proof that a just-completed purchase, sale, or trade changed inventory.

**Possible later comparison:** Planning/reconciliation snapshot versus visible or application-state sources for immediate changes.

**Decision:** Existing use remains unchanged. Minimum permission live-proven; future architecture remains separate.

### CAP-USER-002: User's active Item Market listings

**Endpoint:** `GET /user/itemmarket`

**Evidence:** Official + already used by IMM

**Permission:** Limited

**Stability:** Stable

**Provides:** The user's own Item Market listings with listing ID, price, average price, amount, anonymity, amount still available, item information and pagination metadata.

**Current TornScriptures use:** IMM includes this source in inventory/listing reconciliation.

**Open question:** Practical freshness after listing changes has not yet been measured during discovery.

**Decision:** Existing use remains unchanged.

### CAP-USER-003: List user's trades

**Endpoint:** `GET /user/trades`

**Evidence:** Official + DQ-KEY-001 live + released Black Ledger recovery

**Permission:** Official contract is Limited. DQ-KEY-001 live-proved exact Custom `user:trades` capability under broad level 0 for the completed-trade recovery use case.

**Stability:** Stable

**Categories:** `ongoing` (default) and `finished`.

**Provides:** Trade identity, the two participant records and category-dependent timing information. Finished trades populate `completed_at`. Ongoing trades populate ongoing timing fields.

**Important endpoint behavior:** Completed-trade recovery must explicitly request `cat=finished`; default category is ongoing.

**Current TornScriptures use:** Stable IMM v0.19.36 uses finished-trade listing as part of bounded Black Ledger completed-trade API recovery.

**Decision:** LIVE VERIFIED AND USED BY RELEASED RECOVERY. No broader trade behavior implied.

### CAP-USER-004: Detailed participated trade

**Endpoint:** `GET /user/{tradeId}/trade`

**Evidence:** Official + DQ-KEY-001 live + released Black Ledger recovery

**Permission:** Official contract is Limited. DQ-KEY-001 live-proved exact Custom `user:trade` capability under broad level 0 for participated finished trades.

**Stability:** Stable

**Scope:** Only trades in which the key owner participated can be requested.

**Current schema:** The detailed trade extends the base trade with `items`, where each trade entry identifies its contributing `user_id`, asset type, and type-specific details.

Known asset variants include:

- Money
- Item
- Faction
- Company
- Property
- NAP

Money entries carry an amount. Item entries carry item ID, UID when applicable, and amount.

**Why this matters:** Ownership is represented per trade entry. Reconstruction must follow the official schema rather than inventing a seller/buyer nested-offer shape.

**Current TornScriptures use:** Stable IMM v0.19.36 uses participated-trade detail inside completed-trade recovery, subject to Black Ledger's local accounting prerequisites and fail-closed review/mutation rules.

**Decision:** LIVE VERIFIED AND USED BY RELEASED RECOVERY.

### CAP-USER-005: User logs

**Endpoint:** `GET /user/log`

**Evidence:** Official

**Permission:** Full access for the selection. Custom log permissions can narrow log categories/types, but the key still deserves strong security handling.

**Stability:** Stable

**Capabilities:** Filter logs by documented log/category/time/target controls.

**Potential value:** Logs may contain authoritative historical events unavailable elsewhere.

**Permission warning:** This is not a cheap universal substitute for lower-privilege sources. Permission cost is part of source efficiency.

**Current TornScriptures use:** None known.

**Decision:** DISCOVERED ONLY. Use only when a lower-privilege source cannot satisfy a future requirement.

## 5. Torn item-catalog capabilities

### CAP-TORN-001: Item catalog by category

**Endpoint:** `GET /torn/items`

**Evidence:** Official + currently used by IMM + DQ-KEY-001 live catalog recovery

**Permission:** Public

**Stability:** Stable

**Behavior:** Default category is `All`. The contract says equipment `details` are not populated for the `All` request.

**Base item data includes:**

- ID and name
- description/effect/requirement
- image
- item type/subtype
- tradability and city-find flags
- vendor information when available
- buy price / sell price where applicable
- market price
- circulation
- equipment details when populated

**Current TornScriptures use:** IMM syncs `GET /torn/items` and stores catalog values locally. Stable Black Ledger recovery can require catalog resolution before review.

**Decision:** Existing use remains unchanged.

### CAP-TORN-002: Specific item catalog lookup

**Endpoint:** `GET /torn/{ids}/items`

**Evidence:** Official + currently used by ISH + DQ-MARKET-001 live

**Permission:** Public

**Stability:** Stable

**Behavior:** Accepts one or multiple comma-separated item IDs. The contract states that details are populated when available.

**Live DQ-MARKET-001 evidence:** A batched lookup for six specimens returned catalog identity, value references, circulation and populated equipment details for Dual 92G Berettas.

**Current TornScriptures use:** Inventory Sales HUD batches relevant item IDs to enrich inventory data.

**Potential efficiency question:** Later compare full-catalog synchronization against demand-driven specific-ID lookup for each product domain. Do not optimize until actual request/storage/use patterns are measured.

**Decision:** LIVE VERIFIED; existing use remains unchanged.

## 6. Public market and Bazaar capabilities

### CAP-MARKET-001: Public Item Market listings for an item

**Endpoint:** `GET /market/{id}/itemmarket`

**Evidence:** Official + DQ-MARKET-001 live

**Permission:** Official contract: Public. Controlled Custom-key testing showed that a deliberately narrow Custom key required explicit Market → `itemmarket`; absence produced Torn error 16 and adding the selection produced success while broad access remained level 0.

**Stability:** Stable

**Freshness:** Globally cached. Every DQ-MARKET-001 live response returned `cache_delay: 30`, and repeated Xanax responses advanced to newer cache timestamps and book states. Exact rendered-page-to-API propagation latency was not measured and no exact 30-second freshness guarantee is claimed.

**Capabilities live-proven:**

- item identity and Item Market classification;
- `item.average_price`;
- individual listing rows;
- stackable price and amount;
- listing-record total and pagination;
- cache timestamp/delay;
- nonstackable UID, per-instance stats, bonuses and rarity fields.

**Source-semantic findings:**

- listing rows are not aggregated price levels;
- `_metadata.total` counts listing rows rather than total units;
- catalog `value.market_price`, Item Market `item.average_price` and executable listing floor are distinct concepts;
- a one-unit floor is economically different from a quantity-supported floor;
- thin markets can contain extreme asking-price outliers;
- nonstackable equipment is a UID/stat-aware valuation problem;
- identical `type` field names across catalog and Item Market sources can represent different classifications.

**Rendered-page comparison:** Xanax page rows and API rows strongly corresponded to the same underlying listing book. The page exposed seller identity that was absent from the tested public API listing rows.

**Current TornScriptures use:** IMM currently reads visible Item Market information and Torn catalog values rather than using this endpoint as its primary visible-listing source.

**Decision:** LIVE VERIFIED FOR SOURCE SEMANTICS AND CACHE PROVENANCE. No runtime source replacement or valuation algorithm authorized.

### CAP-MARKET-002: Weekly/specialized Bazaar directory

**Endpoint:** `GET /market/bazaar`

**Evidence:** Official

**Permission:** Public

**Stability:** Stable

**Capabilities:** Public Bazaar discovery across weekly and specialized directory categories. Current weekly groupings include concepts such as busiest, popular, trending, top-grossing, bulk, bargain and dollar-sale directories. Entries expose Bazaar owner identity and whether the Bazaar is open.

**Important distinction:** This is a public Bazaar directory. It is not the same thing as the key owner's own Bazaar inventory/listings.

**Current TornScriptures use:** None known.

**Why recorded now:** This is an example of a useful official capability discovered before TornScriptures had designed a feature around it.

**Decision:** DISCOVERED ONLY.

### CAP-MARKET-003: Item-specialized Bazaar directory

**Endpoint:** `GET /market/{id}/bazaar`

**Evidence:** Official

**Permission:** Public

**Stability:** Stable

**Capability:** Returns the Bazaar directory specialized for a specific item.

**Current TornScriptures use:** None known.

**Decision:** DISCOVERED ONLY.

## 7. Faction/player-information capabilities relevant to War Intelligence

### CAP-FACTION-001: Public faction member list with structured status

**Endpoint:** `GET /faction/{id}/members`

**Evidence:** Official + DQ-KEY-001 live

**Permission:** Public capability live-proven with `access.faction: false`.

**Stability:** Stable

**Live-proven member data included:**

- user ID and name
- faction position and level
- days in faction
- wall/organized-crime and related flags
- structured `last_action`
- structured current `status`

DQ-KEY-001 observed Online, Idle and Offline activity plus Okay, Traveling and Abroad Torn states. Traveling/Abroad rows exposed direction/location and aircraft type, while observed `status.until` remained null.

**Privilege limitation:** Other members' `revive_setting` was generally `Unknown`; the key owner's own row exposed its real setting despite `access.faction: false`. `/key/info` did not enumerate `members` even though the endpoint succeeded.

**Current TornScriptures alternative:** War Intelligence HUD currently makes no Torn API calls. It observes user-opened faction pages, parses rendered status/last-action information, and persists observations locally.

**What this does NOT decide:** It does not prove API freshness is adequate for war observation, that continuous API collection fits the product boundary, or that the page observer should be removed. Hospital-state shape also remains naturally unobserved in this Discovery cycle.

**Decision:** LIVE VERIFIED FOR PUBLIC CAPABILITY BOUNDARY. Source/freshness/product design remains future Discovery.

### CAP-USER-006: Public user profile information

**Endpoint examples:** `GET /user/{id}/basic`, `GET /user/{id}/profile`

**Evidence:** Official

**Permission:** Public

**Stability:** Stable

**Relevance:** Basic/profile responses expose structured player status, and profile provides richer user information including last-action data.

**Efficiency note:** For faction-wide War Intelligence, one faction-member request may be more request-efficient than per-player profile requests if its freshness and fields are sufficient. This is a hypothesis to measure, not an architecture decision.

**Decision:** DISCOVERED ONLY.

## 8. Current TornScriptures API-source map

This is a repository snapshot, not yet a complete codebase network audit.

### IMM v0.19.36

Known official endpoints/capabilities in stable IMM include:

- `/torn/items`
- `/user/inventory`
- `/user/itemmarket`
- `/key/info`
- completed-trade recovery using `/user/trades?cat=finished`
- participated-trade detail using `/user/{tradeId}/trade`

IMM sends the key only to Torn's official API for these official sources and keeps catalog/accounting state browser-local under its current safety boundary.

### Inventory Sales HUD v0.3.0

Known official API pattern:

- `/user/inventory` category scans
- `/torn/{ids}/items` batched catalog enrichment

Scans are user-triggered. The HUD supports the TornPDA managed-key placeholder and browser-local key storage.

### War Intelligence HUD v0.7.1

The current safety boundary explicitly makes no Torn API calls and no background page requests. It observes rendered pages and stores observations in IndexedDB/local browser state.

### Trader-price tools

Current IMM trader-price workflows also use external price providers such as Weav3r and TornExchange. Their contracts, freshness, privacy, failure behavior and overlap with official Torn sources have **not yet been assessed in this Discovery phase**.

DQ-EXT-001 is the intended next source-comparison chapter after DQ-MARKET-001.

## 9. Section-selection catalogue snapshot

The following names were catalogued from the 2026-08-10 v2 OpenAPI selection enums. Catalogue presence does not mean each selection has been individually assessed. This list was not fully re-catalogued during DQ-KEY-001 or DQ-MARKET-001 and must not be treated as a 6.13.1 exhaustive enum snapshot.

### User

`ammo`, `attacks`, `attacksfull`, `bars`, `basic`, `battlestats`, `bounties`, `calendar`, `casino`, `competition`, `cooldowns`, `crimes`, `discord`, `enlistedcars`, `equipment`, `events`, `faction`, `factionbalance`, `forumfeed`, `forumfriends`, `forumposts`, `forumsubscribedthreads`, `forumthreads`, `hof`, `honors`, `icons`, `inventory`, `itemmarket`, `itemmod`, `job`, `jobpoints`, `jobranks`, `list`, `log`, `lookup`, `medals`, `merits`, `messages`, `missions`, `money`, `networth`, `newevents`, `newmessages`, `notifications`, `organizedcrime`, `personalstats`, `profile`, `properties`, `property`, `races`, `racingrecords`, `refills`, `reports`, `revives`, `revivesfull`, `skills`, `snapshot`, `stocks`, `trades`, `trade`, `travel`, `timestamp`, `weaponexp`, `workstats`, `bazaar`, `criminalrecord`, `display`, `education`, `gym`, `perks`.

Some enum entries currently route to v1 fallback behavior. The fallback distinction must be recorded before TornScriptures relies on one.

### Faction

`applications`, `attacks`, `attacksfull`, `balance`, `basic`, `chain`, `chainreport`, `chains`, `contributors`, `crime`, `crimes`, `hof`, `lookup`, `members`, `news`, `positions`, `rackets`, `raidreport`, `raids`, `rankedwars`, `rankedwarreport`, `reports`, `revives`, `revivesfull`, `search`, `stats`, `territory`, `territoryownership`, `territorywarreport`, `territorywars`, `timestamp`, `upgrades`, `warfare`, `wars`, plus documented v1 fallback selections for several armory categories.

### Market

`auctionhouse`, `auctionhouselisting`, `bazaar`, `itemmarket`, `pointsmarket`, `properties`, `rentals`, `lookup`, `timestamp`.

### Torn

Native/current selections catalogued include `attacklog`, `bounties`, `calendar`, `crimes`, `education`, `elimination`, `eliminationteam`, `factionhof`, `factiontree`, `hof`, `honors`, `itemammo`, `itemmods`, `items`, `logcategories`, `logtypes`, `lookup`, `medals`, `merits`, `museum`, `organizedcrimes`, `properties`, `stocks`, `subcrimes`, `territory`, `timestamp`, with additional documented v1 fallback selections.

### Company

`applications`, `companies`, `employees`, `lookup`, `news`, `profile`, `snapshot`, `stock`, `timestamp`.

### Racing

`cars`, `carupgrades`, `lookup`, `race`, `races`, `records`, `timestamp`, `tracks`.

### Forum

`categories`, `lookup`, `posts`, `thread`, `threads`, `timestamp`.

### Property

`property`, `lookup`, `timestamp`.

### Key

`info`, `log`.

## 10. Registry rules going forward

1. Prefer official source evidence before implementation research elsewhere.
2. Record permission cost alongside runtime/request cost.
3. Record cache/freshness separately from authority.
4. Do not call a documented source "real-time" without evidence.
5. Do not treat page/application state as illegitimate merely because it is not an API, but classify undocumented state as fragile.
6. Do not assume an official API is a superior source when its cache, permission or schema makes it unsuitable.
7. Do not replace stable TornScriptures behavior during discovery.
8. For accounting-critical integrations, require exact schema plus a controlled live response before specification.
9. Preserve dead ends and unavailable capabilities in the Discovery Log/Open Questions so later agents do not repeat them.
10. Preserve source-qualified field semantics when two endpoints use the same field label differently.
11. Do not stitch paginated market responses into an atomic full-book claim when cache provenance differs.
12. Re-check the OpenAPI version and relevant contracts before any delayed implementation, because v2 is still evolving.