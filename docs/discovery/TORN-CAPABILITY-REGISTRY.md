# Torn Capability Registry

Status: **Age of Discovery / DISCOVERED ONLY**

Last broad review: **2026-08-10**

Official baseline reviewed:

- Torn API documentation: `https://www.torn.com/api.html`
- Torn API v2 OpenAPI: `https://www.torn.com/swagger/openapi.json`
- OpenAPI version at review: `6.6.1`
- API v2 base URL: `https://api.torn.com/v2`

This registry records capabilities before architecture. Nothing in this file authorizes a runtime change.

## 1. General Torn API capabilities and constraints

### API authentication

**Evidence:** Official

The v2 OpenAPI security scheme uses the `Authorization` header with the `ApiKey <key>` format. TornScriptures IMM and ISH already use that documented header style.

**Architecture relevance:** Authentication behavior is known and should be shared rather than reinvented if TornScriptures later consolidates API handling.

**State:** Assessed, currently used.

### Access levels and custom keys

**Evidence:** Official

Torn supports normal access levels as well as custom keys that can grant exact selections. The current key can be introspected with `/key/info`.

A custom key is useful for least-privilege product design, but Torn's guidance still requires strong handling of custom keys. A narrowly selected key should not be treated casually merely because it exposes fewer selections.

**Architecture relevance:** Future public TornScriptures releases should be able to explain exactly which selection each domain needs and why.

**State:** Assessed; live least-privilege matrix not yet built.

### Request limit

**Evidence:** Official API documentation

Torn documents a limit of 100 individual requests per minute across a user's API keys.

**Architecture relevance:** Staying below the limit is not the design target. TornScriptures should retrieve only what it needs, reuse data where appropriate, and record the request cost of candidate sources.

**State:** Assessed.

### Service and global caching

**Evidence:** Official API documentation and endpoint contracts

Torn documents a normal service cache of up to roughly 30 seconds for many requests. A request `timestamp` parameter exists to bypass applicable service cache. Some selections are globally cached and cannot be forced fresh by the client.

Known globally cached selections listed in the API documentation at this review include:

- `market:itemmarket`
- `market:properties`
- `market:rentals`
- `company:companies`
- `user:bazaar`
- `torn:bounties`
- `user:bounties`

Individual endpoints can define stronger caching rules. `/user/inventory`, for example, explicitly documents a one-hour cache per category.

**Important:** Browser `fetch(..., { cache: 'no-store' })` controls browser caching. It is not evidence that Torn's server-side or global cache was bypassed.

**State:** Assessed generally; endpoint-specific freshness must be recorded separately.

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

**Evidence:** Official

**Permission:** Available to an API key for inspecting itself.

**Stability:** Stable

**Provides:**

- key owner identity
- key access information
- granted selections grouped by section
- custom permission details where applicable
- log permission information

**Current TornScriptures use:** IMM already probes this endpoint during key checks.

**Potential value:** Exact permission diagnosis and a future least-privilege setup explanation.

**Live verification:** Existing IMM use is evidence that TornScriptures can call it, but the full current response contract has not yet been recorded from a controlled live sample in this discovery phase.

**Decision:** DISCOVERED ONLY for any new behavior.

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

**Evidence:** Official + already used by IMM/ISH

**Permission:** Limited

**Stability:** Stable

**Freshness:** Explicitly cached for one hour per category.

**Request shape:** Category-based with pagination; current limit supports up to 250 entries per page.

**Provides:** Item ID, amount, equipped state, name, faction-owned flag, UID where applicable, inventory timestamp and response metadata.

**Current TornScriptures use:**

- IMM inventory reconciliation
- Inventory Sales HUD user-triggered category scan

**Important limitation:** The one-hour-per-category cache means this endpoint is not automatically suitable as immediate proof that a just-completed purchase, sale, or trade changed inventory.

**Possible later comparison:** Planning/reconciliation snapshot versus visible or application-state sources for immediate changes.

**Decision:** Existing use remains unchanged. DISCOVERED ONLY for future architecture.

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

**Evidence:** Official

**Permission:** Limited

**Stability:** Stable

**Categories:** `ongoing` (default) and `finished`.

**Provides:** Trade identity, the two participant records and category-dependent timing information. Finished trades populate `completed_at`. Ongoing trades populate ongoing timing fields.

**Important endpoint behavior:** For ongoing trades, limit/offset/sort are documented as unused. Finished trade requests can use the supported range/list controls.

**Current TornScriptures use:** Not in stable IMM v0.19.33. An API-backed recovery implementation existed briefly in v0.19.34 and was reverted.

**Discovery lesson:** An endpoint being appropriate in principle is not enough. The exact current response contract and a controlled live finished-trade response must be recorded before another accounting implementation is specified.

**Decision:** DISCOVERED ONLY. High-priority live verification candidate.

### CAP-USER-004: Detailed participated trade

**Endpoint:** `GET /user/{tradeId}/trade`

**Evidence:** Official

**Permission:** Limited

**Stability:** Stable

**Scope:** Only trades in which the key owner participated can be requested.

**Current schema:** The detailed trade extends the base trade with `items`, where each trade entry identifies its contributing `user_id`, asset type, and type-specific details.

Known asset variants in the current schema include:

- Money
- Item
- Faction
- Company
- Property
- NAP

Money entries carry an amount. Item entries carry item ID, UID when applicable, and amount.

**Why this matters:** Ownership is represented per trade entry. Future reconstruction must follow the official schema rather than inventing a seller/buyer nested-offer shape.

**Current TornScriptures use:** Not in stable v0.19.33.

**Decision:** DISCOVERED ONLY. High-priority live verification candidate before Black Ledger recovery is revisited.

### CAP-USER-005: User logs

**Endpoint:** `GET /user/log`

**Evidence:** Official

**Permission:** Full access for the selection. Custom log permissions can narrow log categories/types, but the key still deserves strong security handling.

**Stability:** Stable

**Capabilities:** Filter logs by documented log/category/time/target controls.

**Potential value:** Logs may contain authoritative historical events unavailable elsewhere.

**Permission warning:** This is not a cheap universal substitute for Limited/Public sources. Permission cost is part of source efficiency.

**Current TornScriptures use:** None known.

**Decision:** DISCOVERED ONLY. Use only when a lower-privilege source cannot satisfy a future requirement.

## 5. Torn item-catalog capabilities

### CAP-TORN-001: Item catalog by category

**Endpoint:** `GET /torn/items`

**Evidence:** Official + currently used by IMM

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

**Current TornScriptures use:** IMM syncs `GET /torn/items` and stores catalog values locally.

**Decision:** Existing use remains unchanged.

### CAP-TORN-002: Specific item catalog lookup

**Endpoint:** `GET /torn/{ids}/items`

**Evidence:** Official + currently used by ISH

**Permission:** Public

**Stability:** Stable

**Behavior:** Accepts one or multiple comma-separated item IDs. The contract states that details are populated when available.

**Current TornScriptures use:** Inventory Sales HUD batches relevant item IDs to enrich inventory data.

**Potential efficiency question:** Later compare full-catalog synchronization against demand-driven specific-ID lookup for each product domain. Do not optimize until actual request/storage/use patterns are measured.

**Decision:** Existing use remains unchanged.

## 6. Public market and Bazaar capabilities

### CAP-MARKET-001: Public Item Market listings for an item

**Endpoint:** `GET /market/{id}/itemmarket`

**Evidence:** Official

**Permission:** Public

**Stability:** Stable

**Freshness:** Globally cached. The response exposes cache provenance including a cache timestamp and may expose cache delay information.

**Capabilities:** Item/listing information, pagination and optional weapon-bonus filtering.

**Important limitation:** Because this source is globally cached, it must not automatically replace visible market-page information when immediate listing state matters.

**Potential value:** Reproducible market snapshots with explicit cache provenance for later market-history research.

**Current TornScriptures use:** IMM currently reads visible Item Market information and Torn catalog values rather than using this endpoint as its primary visible-listing source.

**Decision:** DISCOVERED ONLY.

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

**Evidence:** Official

**Permission:** Public

**Stability:** Stable

**Member data includes:**

- user ID and name
- faction position and level
- days in faction
- wall/organized-crime and related flags
- structured `last_action`
- structured current `status`

Current `last_action` contains a timestamp, relative text and activity status. Current user status includes description/details/state/until/color, with documented state values such as Abroad, Dormant, Fallen, Federal, Hospital, Jail, Okay and Traveling.

**Current TornScriptures alternative:** War Intelligence HUD currently makes no Torn API calls. It observes user-opened faction pages, parses rendered status/last-action information, and persists observations locally.

**Potential significance:** Torn already provides several signals WIH currently extracts from the page as structured Stable/Public data and can return them for a faction in one response.

**What this does NOT decide:** It does not prove API freshness is adequate for war observation, that continuous API collection fits the product boundary, or that the page observer should be removed. Those questions require measured comparison.

**Decision:** DISCOVERED ONLY. High-priority source-comparison candidate.

### CAP-USER-006: Public user profile information

**Endpoint examples:** `GET /user/{id}/basic`, `GET /user/{id}/profile`

**Evidence:** Official

**Permission:** Public

**Stability:** Stable

**Relevance:** Basic/profile responses expose structured player status, and profile provides richer user information including last-action data.

**Efficiency note:** For faction-wide War Intelligence, one faction-member request may be more request-efficient than per-player profile requests if its freshness and fields are sufficient. This is a hypothesis to measure, not an architecture decision.

**Decision:** DISCOVERED ONLY.

## 8. Current TornScriptures API-source map

This is a first repository snapshot, not yet a complete codebase network audit.

### IMM v0.19.33

Known official endpoints declared in stable IMM:

- `/torn/items`
- `/user/inventory`
- `/user/itemmarket`
- `/key/info`

IMM sends the key only to Torn's official API and stores API/catalog/accounting data browser-locally under its current safety boundary.

### Inventory Sales HUD v0.3.0

Known official API pattern:

- `/user/inventory` category scans
- `/torn/{ids}/items` batched catalog enrichment

Scans are user-triggered. The HUD supports the TornPDA managed-key placeholder and browser-local key storage.

### War Intelligence HUD v0.7.1

The current safety boundary explicitly makes no Torn API calls and no background page requests. It observes rendered pages and stores observations in IndexedDB/local browser state.

### Trader-price tools

Current IMM trader-price workflows also use external price providers such as Weav3r and TornExchange. Their contracts, freshness, privacy, failure behavior and overlap with official Torn sources have **not yet been assessed in this discovery phase**.

## 9. Section-selection catalogue snapshot

The following names were catalogued from the 2026-08-10 v2 OpenAPI selection enums. Catalogue presence does not mean each selection has been individually assessed.

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
10. Re-check the OpenAPI version and relevant contracts before any delayed implementation, because v2 is still evolving.
