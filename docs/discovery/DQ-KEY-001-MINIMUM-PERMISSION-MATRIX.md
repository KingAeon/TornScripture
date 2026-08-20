# DQ-KEY-001 — Minimum API Permission and Source-Ownership Matrix

Status: **ACTIVE DISCOVERY / KEY-001-A-B-C LIVE-CONFIRMED / OWNER BAZAAR EDGE OPEN**

Date opened: 2026-08-20

Repository baseline: `main` at `9b5c1b8407d7f88fefd33eba4ed80a12b0a8e1c6`

Official Torn baseline rechecked for this chapter:

- OpenAPI: `https://www.torn.com/swagger/openapi.json`
- OpenAPI version observed: `6.11.1`
- API v2 base URL: `https://api.torn.com/v2`
- Torn API custom-key builder/documentation: `https://www.torn.com/api.html`

This chapter is Discovery only. It does not authorize a centralized API client, key-manager rewrite, storage migration, new API polling, new third-party requests, or any runtime permission change.

## 1. Question

What is the smallest truthful Torn API/source footprint each TornScriptures domain needs, and which permissions are merely artifacts of today's script packaging rather than requirements of the underlying capability?

The goal is not to find one broad key that makes every feature work. The goal is to know exactly which source owns each fact and exactly which permission, if any, is required to obtain it.

## 2. Terminology

### Selection permission

A Torn custom key can grant exact selections. For private/custom capabilities, the selection is the primary unit of least-privilege reasoning.

Examples:

- `user:inventory`
- `user:trades`
- `user:trade`
- `torn:items`

### Public capability

KEY-001-C established that Public v2 endpoints are a special case: a Public endpoint may be usable even when its endpoint/selection name is **not** enumerated in `/key/info`.

Therefore TornScriptures must not mechanically interpret `/key/info` selection arrays as a complete manifest of every Public endpoint a key can call.

For Public endpoints, the current safer capability test is:

1. current official Torn access-tier contract; plus
2. bounded functional endpoint verification where needed.

### Broad access tier

Torn also exposes Public Only, Minimal Access, Limited Access and Full Access key levels. These are useful compatibility labels, but they are not precise enough to define TornScriptures' minimum trust boundary when Custom keys can grant exact private selections and Public endpoints can remain callable independently of exact selection enumeration.

### Source owner

Each fact should be classified as one of:

- **Official API** — documented Torn API contract
- **Rendered/page state** — information delivered to the user's Torn page
- **Third party** — external provider such as Weav3r or TornExchange
- **Local** — TornScriptures-owned data such as Black Ledger lots, observations, settings or cached evidence

### Required versus conditional

- **Required** means the named capability cannot truthfully operate without that source under its current supported contract.
- **Conditional** means the source/selection is needed only when a related optional feature is enabled or when that domain assumes ownership of a neighboring concern.
- **Not required** means another current source already owns the fact and the permission should not be requested merely for convenience.

## 3. Key-introspection foundation

### `/key/info`

Current official contract:

- Stable
- available for any key
- returns selections grouped by section
- returns key access level and type
- returns key owner user ID, faction ID and company ID
- returns faction/company access flags
- returns log-permission metadata

### Live interpretation after KEY-001-A/B/C

`/key/info` is a strong permission-truth source for exact private/custom capabilities. KEY-001-A and KEY-001-B showed exact custom grants behaving as expected while the broad numeric level remained `0`.

However, KEY-001-C showed that `GET /faction/{id}/members` succeeded as a Public capability even though `members` was absent from the returned Faction selection array.

**DQ-KEY-001 consequence:** `/key/info` should remain the future diagnostic truth source for key identity, broad access flags and exact private grants, but it must not be treated as a universal deny-list for Public endpoints.

### `/key/log`

Current official contract:

- Stable
- available for any key
- exposes up to the last 250 request-log entries, with at most 100 rows per request
- entries include timestamp, request type, selections, target ID, comment and IP

**DQ-KEY-001 consequence:** useful for later request-audit research, but **not required by any current domain baseline**. Because it exposes IP/request-history information and the call itself consumes/logs API usage, it remains optional under DQ-KEY-004.

## 4. Current minimum matrix

| Domain / capability | Exact source or selection | Broad tier documented by Torn | Source owner | Requirement | Can capability function without it? | Freshness / trust note | Current conclusion |
|---|---|---|---|---|---|---|---|
| Core — inspect key owner and grants | `GET /key/info` | Available for any key | Official API | Required for exact permission diagnostics; not a separately justified broad permission | Core can operate without diagnostics, but cannot truthfully explain private grants without it | Stable self-introspection; not exhaustive for Public endpoint capability | **BASELINE WITH PUBLIC-ENDPOINT CAVEAT** |
| Core — display own basic profile/name | `GET /user/basic` / `user:basic` | Public | Official API | Conditional | Yes, if display name is already available from legitimate page/local context; key owner ID itself is already in `/key/info` | Stable | **OPTIONAL** |
| Core — API request history | `GET /key/log` | Available for any key | Official API | Optional diagnostics only | Yes | Contains IP/request history; up to 250 stored entries | **NOT BASELINE** |
| Market/Trader — Torn item identity/value catalog | `GET /torn/items` or targeted `GET /torn/{ids}/items`; `torn:items` | Public | Official API | Required wherever exact Torn item IDs/names/catalog values are needed | Current IMM/ISH catalog-dependent behavior cannot fully function without catalog evidence | Stable; broad vs targeted efficiency remains DQ-CATALOG-001 | **BASELINE FOR CATALOG USERS** |
| Market/Trader — official Item Market snapshot | `GET /market/{id}/itemmarket`; `market:itemmarket` | Public | Official API | Conditional | Yes for today's visible-page IMM decisions; no for a future API-derived market-history snapshot | Globally cached; visible page may be fresher for active decisions | **OPTIONAL / SOURCE-COMPARISON OPEN** |
| Market/Trader — Weav3r trader prices | Weav3r price page | No Torn API selection | Third party | Conditional to Weav3r workflows | Yes, if that trader/provider is not used | Freshness/availability contract still open under DQ-EXT | **NO TORN PERMISSION** |
| Market/Trader — TornExchange trader prices | TornExchange price page | No Torn API selection | Third party | Conditional to TornExchange workflows | Yes | Freshness/availability contract still open under DQ-EXT | **NO TORN PERMISSION** |
| Market/Trader — owner's active Item Market listings | `GET /user/itemmarket`; `user:itemmarket` | Limited | Official API | Conditional, and may belong more naturally to Inventory/Bazaar reconciliation than Market/Trader | Yes for market/trader pricing itself | Stable; practical post-change freshness not yet measured | **DO NOT PUT IN MARKET BASELINE YET** |
| Black Ledger — finished trade list | `GET /user/trades?cat=finished`; `user:trades` | Limited | Official API | Required for released API completed-trade recovery | No, not for API recovery | Stable; exact visibility delay after finality remains DQ-TRADE-001 | **REQUIRED / LIVE-PROVEN** |
| Black Ledger — exact detailed trade contents | `GET /user/{tradeId}/trade`; `user:trade` | Limited | Official API | Required for released API completed-trade recovery | No | Stable; only participated trades; live ordinary-sale semantics owner-tested | **REQUIRED / LIVE-PROVEN** |
| Black Ledger — exact item catalog identity | `GET /torn/items`; `torn:items` | Public | Official API | Required by current released recovery because unknown trade item IDs fail closed and name fallback is forbidden | Not under current v0.19.36 recovery contract | Stable; could later use targeted IDs without changing source ownership | **REQUIRED BY CURRENT RELEASE / LIVE-PROVEN** |
| Black Ledger — FIFO lots, cost basis, sales, dedupe history | Black Ledger local dataset | None | Local | Required | No | Irreplaceable Class C data; API must not replace local accounting truth | **REQUIRED LOCAL AUTHORITY** |
| Black Ledger — current inventory snapshot | `user:inventory` | Minimal | Official API | Not required to reconstruct/record an already completed supported sale; conditional for reconciliation | Yes for released trade recovery | Explicit one-hour-per-category cache makes it unsuitable as immediate completion proof | **EXCLUDE FROM RECOVERY MINIMUM** |
| Black Ledger — owner's active Item Market listings | `user:itemmarket` | Limited | Official API | Not required for completed-trade recovery | Yes | Separate inventory/listing reconciliation concern | **EXCLUDE FROM RECOVERY MINIMUM** |
| Inventory/Bazaar — user inventory snapshot | `GET /user/inventory`; `user:inventory` | **Minimal** | Official API | Required for API inventory scan/planning | No for API-driven inventory scan; page state could support different narrow features | Explicitly cached one hour per category | **REQUIRED FOR INVENTORY SCAN / LIVE-PROVEN** |
| Inventory/Bazaar — exact catalog enrichment | `torn:items` | Public | Official API | Required by current ISH enrichment and many inventory classifications | Basic quantity-only inventory can exist without enrichment, but product behavior loses item/value metadata | Stable | **BASELINE WITH INVENTORY** |
| Inventory/Bazaar — owner's active Item Market listings | `user:itemmarket` | Limited | Official API | Conditional for listing-aware reconciliation | Yes for pure inventory planning | Stable; freshness study still open | **OPTIONAL RECONCILIATION** |
| Inventory/Bazaar — owner's Bazaar contents | `user:bazaar` v1 fallback | Custom selection supported; broad-tier/freshness behavior requires care | Official API legacy fallback | Conditional for owner-Bazaar inventory/listing features | Yes for inventory-only features | OpenAPI marks `user:bazaar` as v1 fallback. Current live response/freshness behavior still needs verification | **OPEN / DO NOT GENERALIZE** |
| Inventory/Bazaar — public Bazaar directory | `GET /market/bazaar`; `market:bazaar` | Public | Official API | Conditional to Bazaar discovery/market-intelligence features | Yes for owner inventory | Stable directory, not owner's Bazaar contents | **OPTIONAL PUBLIC SOURCE** |
| Inventory/Bazaar — item-specialized Bazaar directory | `GET /market/{id}/bazaar`; `market:bazaar` | Public | Official API | Conditional | Yes | Stable; exact directory semantics/freshness still DQ-BAZAAR-002/003 | **OPTIONAL PUBLIC SOURCE** |
| War Intelligence — faction-wide structured member/status data | `GET /faction/{id}/members` | Public | Official API | Candidate baseline API source, not yet authorized runtime source | Yes: current WIH operates entirely from rendered pages | Live-proven without faction privilege; freshness versus page observer remains DQ-WIH-001 | **PUBLIC CAPABILITY / LIVE-PROVEN** |
| War Intelligence — activity presence | `last_action.status/timestamp/relative` in faction members | Public | Official API | Candidate source | Yes; current page observer already supplies activity observations | Live examples confirmed `Online`, `Idle`, `Offline` | **LIVE-PROVEN SHAPE** |
| War Intelligence — Torn state | `status` in faction members | Public | Official API | Candidate source | Yes | Live examples confirmed `Okay`, `Traveling`, `Abroad`; Hospital remains unobserved in this run | **LIVE-PROVEN PARTIAL STATE SET** |
| War Intelligence — travel direction/vehicle | `status.description`, `plane_image_type` | Public | Official API | Optional enrichment | Yes | Live descriptions identify travel direction/location; plane type observed as `light_aircraft` and `airliner`; `status.until` remained null in all travel/abroad examples | **LIVE-PROVEN, ETA NOT PROVEN** |
| War Intelligence — member `revive_setting` | faction-members response | Public endpoint; faction privilege affects broader visibility | Official API | Not required for baseline status intelligence | Yes | Live run with `access.faction:false`: key owner's own value visible; other members `Unknown`. This is more nuanced than current OpenAPI wording | **LIMITED WITHOUT FACTION PRIVILEGE / SELF-ROW EXCEPTION** |
| War Intelligence — rendered status observation/history | Current faction-page observer | None | Rendered/page state + Local | Required by current released WIH behavior | Current WIH would not function as designed without page observations | Runtime freshness and background behavior differ from API and must be measured | **CURRENT AUTHORITY FOR RELEASED WIH** |

## 5. Corrections and discoveries that change prior assumptions

### Correction A — `/user/inventory` is Minimal, not Limited

The 2026-08-10 registry recorded `/user/inventory` as Stable/Limited. Current OpenAPI 6.11.1 states **Requires minimal access key**.

KEY-001-A then live-confirmed an exact Custom inventory key at broad `level: 0` could successfully call `/user/inventory`.

### Correction B — released Black Ledger recovery has a smaller feature-specific footprint than current IMM packaging

Stable IMM v0.19.36 currently contains official API concerns for catalog, inventory, own Item Market listings and completed-trade recovery. Its current UI packaging still describes a generic Limited key.

KEY-001-B live-confirmed that the completed-trade recovery capability itself can operate with:

1. `user:trades`
2. `user:trade`
3. `torn:items`

without `user:inventory`, `user:itemmarket`, `user:log` or Full access.

Stable IMM accepted that restricted key, loaded 86 finished trades, fetched detail/catalog data, and advanced until a legitimate local FIFO precondition stopped review. No accounting mutation was needed.

### Correction C — Public endpoint capability is not fully enumerated by `/key/info`

KEY-001-C used a Custom key reporting:

- `access.level: 0`
- `access.faction: false`
- Faction selection array containing only baseline values such as `timestamp`, `basic`, `lookup`

Yet `GET /faction/{id}/members` succeeded and returned a real member roster.

Therefore exact `/key/info` selection presence must **not** become a universal Public-endpoint gate.

### Correction D — faction member data is richer without privilege than expected, but revive visibility has a narrow live exception

Without faction API privilege, the live own-faction roster exposed:

- identity, level, faction tenure and position
- Online/Idle/Offline last-action state and timestamps
- Okay/Traveling/Abroad Torn status
- travel direction/location text
- aircraft type for traveling members
- revivable/wall/OC/early-discharge flags

Most members' `revive_setting` values were `Unknown`, but the key owner's own row returned the actual value while `access.faction` remained false.

Current OpenAPI 6.11.1 broadly describes `revive_setting` as populated for own-faction requests with faction permission and `Unknown` otherwise. The live self-row is therefore an edge/discrepancy that must be preserved rather than normalized away.

## 6. Provisional domain permission/source sets

These are **research sets**, not key-builder links and not runtime requirements.

### Core

Minimum diagnostic source:

- `/key/info` (available to any key)

Optional only:

- `user:basic` when a trustworthy display name is actually needed
- `/key/log` for a separately approved diagnostic/audit feature

Public-endpoint caveat:

- absence of a Public endpoint name from `/key/info` is not by itself proof of lack of access.

### Market / Trader

Current baseline depends more on source ownership than private permission:

- `torn:items` — Public, for Torn catalog identity/value
- rendered Item Market page — no Torn API permission, current active-decision source
- Weav3r/TornExchange pages — no Torn API selection, optional third-party sources

Future optional official source:

- `market:itemmarket` — Public, for globally cached market snapshots/history research

Do not include `user:itemmarket` merely because the present IMM file also contains inventory reconciliation.

### Black Ledger

Minimum set for the **released v0.19.36 completed-trade recovery capability**:

- `user:trades`
- `user:trade`
- `torn:items`

Plus local Black Ledger Class C data as the accounting authority.

No current evidence requires `user:inventory`, `user:itemmarket`, `user:log`, or Full access for this recovery path.

### Inventory / Bazaar

Minimum for current API-driven inventory scan:

- `user:inventory` — Minimal
- `torn:items` — Public for enrichment/catalog identity where needed

Conditional additions:

- `user:itemmarket` — Limited, only for own Item Market listing reconciliation
- `user:bazaar` — exact custom selection for future owner-Bazaar features; legacy/freshness behavior still requires live verification
- `market:bazaar` — Public, only for public directory features

### War Intelligence

Current released implementation:

- no Torn API permission
- rendered faction page + local observation history

Candidate official API source under Discovery:

- Public `GET /faction/{id}/members`

Known capability without faction privilege:

- roster identity
- Online/Idle/Offline activity
- status state/description/color
- travel/abroad location direction and plane type
- position, level, days in faction
- revivable/wall/OC/early-discharge flags

Known limitations/caveats:

- other members' revive settings are hidden as `Unknown` without faction privilege;
- key owner's own revive setting was nevertheless visible in the live run;
- travel/abroad `status.until` was null in all observed examples, so ready-made travel ETA is not proven;
- Hospital live shape remains unverified;
- API freshness versus rendered page remains unresolved and is a separate WIH Discovery question.

Do not request faction API privilege by default based on current evidence.

## 7. One-key versus domain-key architecture is intentionally NOT decided

The existence of a union of selections does not answer whether TornScriptures should eventually use:

- one custom key containing all enabled-domain selections;
- separate domain keys;
- TornPDA's managed key where available plus optional custom keys;
- a hybrid fallback.

That decision depends directly on DQ-KEY-002: actual TornPDA managed-key injection behavior and whether the user can reason about/select exact grants cleanly.

DQ-KEY-001 should first establish the permission/source truth. Packaging that truth into onboarding comes later.

## 8. Evidence state before DQ-KEY-001 closes

### Closed/live-confirmed in this chapter

1. **Inventory minimum permission — KEY-001-A**
   - Custom key with `user:inventory`
   - `/key/info` showed Custom level 0 and inventory grant
   - `/user/inventory` returned HTTP 200

2. **Black Ledger recovery minimum — KEY-001-B**
   - `user:trades` + `user:trade` + `torn:items`
   - API list/detail/catalog all succeeded
   - stable IMM accepted key and traversed recovery until local catalog/FIFO readiness guards
   - no `user:inventory` or `user:itemmarket` needed

3. **Public faction-members capability — KEY-001-C**
   - faction API privilege false
   - public members endpoint succeeded
   - core member/activity/status fields live-confirmed
   - Public-endpoint `/key/info` enumeration caveat discovered
   - revive-setting self-row exception discovered

### Still open

4. **`user:bazaar` live contract — KEY-001-D**
   - capture sanitized owner-Bazaar response with an exact custom selection;
   - verify current key-info representation;
   - characterize obvious cache behavior without aggressive polling;
   - catalogue useful owner listing fields that survive the v1 fallback.

5. **Market/Trader ownership boundary**
   - finish DQ-MARKET-001/002 and DQ-EXT source/freshness work before deciding whether `market:itemmarket` belongs in the default Market/Trader footprint.

### Deferred to the future War Intelligence Discovery chapter

- Hospital-state live response shape
- API-versus-rendered-page freshness
- update cadence and background behavior
- whether API, observer, or hybrid should own current status truth
- product/UI design and final product name

These are not required to prove the permission floor discovered in KEY-001-C.

## 9. Current chapter conclusions

Strong enough to carry forward:

- `/key/info` should be the permission truth source for exact private/custom grants and key diagnostics, but is not an exhaustive Public endpoint capability manifest.
- Least privilege should be expressed in exact private selections plus explicit Public capability contracts, not simply "use a Limited key."
- `user:inventory` is Minimal and live-proven under an exact Custom key.
- Black Ledger completed-trade recovery has a live-proven feature-specific minimum of `user:trades` + `user:trade` + `torn:items`.
- Public faction-member data is already rich enough to establish a meaningful future War Intelligence source candidate without faction privilege.
- Faction privilege is not justified merely for baseline member/status intelligence.
- Public market/Bazaar sources must not be confused with owner-private listing/inventory sources.
- Source freshness and source authority remain separate dimensions.

Not yet decided:

- one key versus multiple keys;
- TornPDA managed-key versus custom-key onboarding;
- whether official Item Market API snapshots should become a default Market/Trader source;
- owner-Bazaar exact permission/freshness contract;
- any runtime permission prompt change;
- any War Intelligence architecture or product design.

## 10. Release posture

This file is a Discovery notebook and matrix. It may be updated as controlled evidence arrives.

No product/runtime change is authorized by this document. A future implementation must receive its own specification, risk classification, tests, owner TornPDA gate where appropriate, and exact-head merge authorization.
