# DQ-KEY-001 — Minimum API Permission and Source-Ownership Matrix

Status: **ACTIVE DISCOVERY / INITIAL OFFICIAL-CONTRACT PASS COMPLETE / LIVE EDGE CASES OPEN**

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

A Torn custom key can grant exact selections. For TornScriptures least-privilege design, the selection is the primary unit of permission reasoning.

Examples:

- `user:inventory`
- `user:trades`
- `torn:items`
- `faction:members`

### Broad access tier

Torn also exposes Public Only, Minimal Access, Limited Access and Full Access key levels. These are useful compatibility labels, but they are not precise enough to define TornScriptures' minimum trust boundary when custom keys can grant exact selections.

### Source owner

Each fact should be classified as one of:

- **Official API** — documented Torn API contract
- **Rendered/page state** — information delivered to the user's Torn page
- **Third party** — external provider such as Weav3r or TornExchange
- **Local** — TornScriptures-owned data such as Black Ledger lots, observations, settings or cached evidence

### Required versus conditional

- **Required** means the named capability cannot truthfully operate without that source under its current supported contract.
- **Conditional** means the selection is needed only when a related optional feature is enabled or when that domain assumes ownership of a neighboring concern.
- **Not required** means another current source already owns the fact and the permission should not be requested merely for convenience.

## 3. Key-introspection foundation

### `/key/info`

Current official contract:

- Stable
- available for any key
- returns granted selections grouped by section
- returns key access level and type
- returns key owner user ID, faction ID and company ID
- returns faction/company access flags
- returns log-permission metadata

**DQ-KEY-001 consequence:** TornScriptures can validate actual selection grants instead of guessing capability from a broad key-level label.

For an eventual permission report, the truth source should be `/key/info`, not local inference alone.

### `/key/log`

Current official contract:

- Stable
- available for any key
- exposes up to the last 250 request-log entries, with at most 100 rows per request
- entries include timestamp, request type, selections, target ID, comment and IP

**DQ-KEY-001 consequence:** useful for later request-audit research, but **not required by any current domain baseline**. Because it exposes IP/request-history information and the call itself consumes/logs API usage, it remains optional under DQ-KEY-004.

## 4. Initial minimum matrix

The table below is the first official-contract pass. `OPEN` rows still require live or source-comparison evidence before the chapter can be closed.

| Domain / capability | Exact source or selection | Broad tier documented by Torn | Source owner | Requirement | Can capability function without it? | Freshness / trust note | Current conclusion |
|---|---|---|---|---|---|---|---|
| Core — inspect key owner and grants | `GET /key/info` | Available for any key | Official API | Required for exact permission diagnostics; not a separately justified broad permission | Core can operate without diagnostics, but cannot truthfully explain grants without it | Stable self-introspection | **BASELINE** |
| Core — display own basic profile/name | `GET /user/basic` / `user:basic` | Public | Official API | Conditional | Yes, if display name is already available from legitimate page/local context; key owner ID itself is already in `/key/info` | Stable | **OPTIONAL** |
| Core — API request history | `GET /key/log` | Available for any key | Official API | Optional diagnostics only | Yes | Contains IP/request history; up to 250 stored entries | **NOT BASELINE** |
| Market/Trader — Torn item identity/value catalog | `GET /torn/items` or targeted `GET /torn/{ids}/items`; `torn:items` | Public | Official API | Required wherever exact Torn item IDs/names/catalog values are needed | Current IMM/ISH catalog-dependent behavior cannot fully function without catalog evidence | Stable; broad vs targeted efficiency remains DQ-CATALOG-001 | **BASELINE FOR CATALOG USERS** |
| Market/Trader — official Item Market snapshot | `GET /market/{id}/itemmarket`; `market:itemmarket` | Public | Official API | Conditional | Yes for today's visible-page IMM decisions; no for a future API-derived market-history snapshot | Globally cached; visible page may be fresher for active decisions | **OPTIONAL / SOURCE-COMPARISON OPEN** |
| Market/Trader — Weav3r trader prices | Weav3r price page | No Torn API selection | Third party | Conditional to Weav3r workflows | Yes, if that trader/provider is not used | Freshness/availability contract still open under DQ-EXT | **NO TORN PERMISSION** |
| Market/Trader — TornExchange trader prices | TornExchange price page | No Torn API selection | Third party | Conditional to TornExchange workflows | Yes | Freshness/availability contract still open under DQ-EXT | **NO TORN PERMISSION** |
| Market/Trader — owner's active Item Market listings | `GET /user/itemmarket`; `user:itemmarket` | Limited | Official API | Conditional, and may belong more naturally to Inventory/Bazaar reconciliation than Market/Trader | Yes for market/trader pricing itself | Stable; practical post-change freshness not yet measured | **DO NOT PUT IN MARKET BASELINE YET** |
| Black Ledger — finished trade list | `GET /user/trades?cat=finished`; `user:trades` | Limited | Official API | Required for released API completed-trade recovery | No, not for API recovery | Stable; exact visibility delay after finality remains DQ-TRADE-001 | **REQUIRED** |
| Black Ledger — exact detailed trade contents | `GET /user/{tradeId}/trade`; `user:trade` | Limited | Official API | Required for released API completed-trade recovery | No | Stable; only participated trades; live ordinary-sale semantics already owner-tested | **REQUIRED** |
| Black Ledger — exact item catalog identity | `GET /torn/items`; `torn:items` | Public | Official API | Required by current released recovery because unknown trade item IDs fail closed and name fallback is forbidden | Not under current v0.19.36 recovery contract | Stable; could later use targeted IDs without changing the selection name | **REQUIRED BY CURRENT RELEASE** |
| Black Ledger — FIFO lots, cost basis, sales, dedupe history | Black Ledger local dataset | None | Local | Required | No | Irreplaceable Class C data; API must not replace local accounting truth | **REQUIRED LOCAL AUTHORITY** |
| Black Ledger — current inventory snapshot | `user:inventory` | Minimal | Official API | Not required to reconstruct/record an already completed supported sale; conditional for reconciliation | Yes for released trade recovery | Explicit one-hour-per-category cache makes it unsuitable as immediate completion proof | **EXCLUDE FROM RECOVERY MINIMUM** |
| Black Ledger — owner's active Item Market listings | `user:itemmarket` | Limited | Official API | Not required for completed-trade recovery | Yes | Separate inventory/listing reconciliation concern | **EXCLUDE FROM RECOVERY MINIMUM** |
| Inventory/Bazaar — user inventory snapshot | `GET /user/inventory`; `user:inventory` | **Minimal** | Official API | Required for API inventory scan/planning | No for API-driven inventory scan; page state could support different narrow features | Explicitly cached one hour per category | **REQUIRED FOR INVENTORY SCAN** |
| Inventory/Bazaar — exact catalog enrichment | `torn:items` | Public | Official API | Required by current ISH enrichment and many inventory classifications | Basic quantity-only inventory can exist without enrichment, but product behavior loses item/value metadata | Stable | **BASELINE WITH INVENTORY** |
| Inventory/Bazaar — owner's active Item Market listings | `user:itemmarket` | Limited | Official API | Conditional for listing-aware reconciliation | Yes for pure inventory planning | Stable; freshness study still open | **OPTIONAL RECONCILIATION** |
| Inventory/Bazaar — owner's Bazaar contents | `user:bazaar` v1 fallback | Custom selection supported; broad-tier/freshness behavior requires care | Official API legacy fallback | Conditional for owner-Bazaar inventory/listing features | Yes for inventory-only features | OpenAPI marks `user:bazaar` as v1 fallback. Torn changelog states own-Bazaar global cache was removed for Custom/Limited/Full keys; live current response still needs verification | **OPEN / DO NOT GENERALIZE** |
| Inventory/Bazaar — public Bazaar directory | `GET /market/bazaar`; `market:bazaar` | Public | Official API | Conditional to Bazaar discovery/market-intelligence features | Yes for owner inventory | Stable directory, not owner's Bazaar contents | **OPTIONAL PUBLIC SOURCE** |
| Inventory/Bazaar — item-specialized Bazaar directory | `GET /market/{id}/bazaar`; `market:bazaar` | Public | Official API | Conditional | Yes | Stable; exact directory semantics/freshness still DQ-BAZAAR-002/003 | **OPTIONAL PUBLIC SOURCE** |
| War Intelligence — faction-wide structured member/status data | `GET /faction/{id}/members`; `faction:members` | Public | Official API | Candidate baseline API source, not yet authorized runtime source | Yes: current WIH operates entirely from rendered pages | Stable; freshness versus page observer remains DQ-WIH-001 | **PUBLIC CANDIDATE** |
| War Intelligence — member `revive_setting` enrichment | `faction:members` plus faction API permission when querying own faction | Public endpoint + faction permission for populated field | Official API | Not required for current WIH purpose | Yes | Without faction permission `revive_setting` is `Unknown`; other member/status fields remain available | **DO NOT REQUEST FACTION PRIVILEGE BY DEFAULT** |
| War Intelligence — rendered status observation/history | Current faction-page observer | None | Rendered/page state + Local | Required by current released WIH behavior | Current WIH would not function as designed without page observations | Runtime freshness and background behavior differ from API and must be measured | **CURRENT AUTHORITY FOR RELEASED WIH** |

## 5. Immediate corrections to earlier Discovery assumptions

### Correction A — `/user/inventory` is Minimal, not Limited

The 2026-08-10 registry recorded `/user/inventory` as Stable/Limited. The current 6.11.1 OpenAPI explicitly states **Requires minimal access key**.

This is a real permission reduction and should be corrected in the Capability Registry.

It also proves why permission requirements must be revalidated against the current official contract rather than copied indefinitely from older notes.

### Correction B — released Black Ledger recovery has a smaller feature-specific footprint than current IMM packaging

Stable IMM v0.19.36 currently declares official endpoints for:

- `torn:items`
- `user:inventory`
- `user:itemmarket`
- `user:trades`
- `user:trade`
- `/key/info`

The current UI still asks the user to enter a generic **Limited Access API key**.

However, inspection of the released recovery contract shows the completed-trade recovery capability itself requires:

1. `user:trades`
2. `user:trade`
3. `torn:items` under the current exact-ID catalog rule

`user:inventory` and `user:itemmarket` belong to other IMM reconciliation behavior and are not required to reconstruct and record an already completed supported trade.

This does **not** authorize a runtime key prompt change. It establishes the first feature-specific least-privilege boundary for later design.

### Correction C — WIH does not need privileged faction API access for its core structured candidate source

`GET /faction/{id}/members` requires only Public access. Torn documents additional faction permission only for the `revive_setting` enrichment on the user's own faction.

Therefore no evidence currently justifies asking War Intelligence users for Limited/Full access or faction API permission merely to obtain the member/status fields we are evaluating.

## 6. Provisional domain permission sets

These are **research sets**, not key-builder links and not runtime requirements.

### Core

Minimum diagnostic source:

- `/key/info` (available to any key)

Optional only:

- `user:basic` when a trustworthy display name is actually needed
- `/key/log` for a separately approved diagnostic/audit feature

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
- `torn:items` — Public

Conditional additions:

- `user:itemmarket` — Limited, only for own Item Market listing reconciliation
- `user:bazaar` — exact custom selection for future owner-Bazaar features; legacy/freshness behavior still requires live verification
- `market:bazaar` — Public, only for public directory features

### War Intelligence

Current released implementation:

- no Torn API permission
- rendered faction page + local observation history

Candidate API source under Discovery:

- `faction:members` — Public

Do not request faction API privilege by default. The only explicitly documented extra benefit identified in the current member contract is populated `revive_setting` for one's own faction.

## 7. One-key versus domain-key architecture is intentionally NOT decided

The existence of a union of selections does not answer whether TornScriptures should eventually use:

- one custom key containing all enabled-domain selections;
- separate domain keys;
- TornPDA's managed key where available plus optional custom keys;
- a hybrid fallback.

That decision depends directly on DQ-KEY-002: actual TornPDA managed-key injection behavior and whether the user can reason about/select exact grants cleanly.

DQ-KEY-001 should first establish the permission/source truth. Packaging that truth into onboarding comes later.

## 8. Open evidence required before DQ-KEY-001 can close

1. **`user:bazaar` live contract**
   - capture a sanitized owner-Bazaar response with an exact custom selection;
   - verify current key-info representation;
   - verify practical cache behavior for owner versus public access;
   - confirm what useful owner listing fields survive the v1 fallback.

2. **Inventory permission live confirmation**
   - create/use an exact custom key with `user:inventory` but without unrelated Limited selections;
   - confirm `/key/info` reports the exact grant;
   - confirm `/user/inventory` succeeds with the current Minimal/custom permission behavior.

3. **Black Ledger recovery-only custom key**
   - use a controlled custom key containing only `user:trades`, `user:trade`, and `torn:items` (plus Torn's automatic/default introspection behavior);
   - verify released recovery can list/review a safe already-finished trade without `user:inventory` or `user:itemmarket`;
   - do not create an accounting-significant trade solely for this test.

4. **War Intelligence permission proof**
   - verify `faction:members` with a Public/custom selection key returns the status/last-action fields current WIH cares about without faction API permission;
   - separately record whether the only observed difference is `revive_setting` or whether other fields vary in practice.

5. **Market/Trader ownership boundary**
   - finish DQ-MARKET-001/002 and DQ-EXT source/freshness work before deciding whether `market:itemmarket` belongs in the default Market/Trader key footprint.

## 9. Current chapter conclusions

Already strong enough to carry forward:

- `/key/info` should be the permission truth source for future diagnostics.
- Least privilege should be expressed in exact selections, not simply "use a Limited key."
- `user:inventory` is currently Minimal according to official OpenAPI 6.11.1.
- Black Ledger completed-trade recovery has a narrower feature-specific permission set than the current monolithic IMM prompt implies.
- `faction:members` is Public and does not justify privileged faction access for baseline WIH status observation.
- public market/Bazaar sources should not be confused with owner-private listing/inventory sources.
- source freshness and source authority remain separate dimensions.

Not yet decided:

- one key versus multiple keys;
- TornPDA managed-key versus custom-key onboarding;
- whether official Item Market API snapshots should become a default Market/Trader source;
- owner-Bazaar exact permission/freshness contract;
- any runtime permission prompt change.

## 10. Release posture

This file is a Discovery notebook and matrix. It may be updated as controlled evidence arrives.

No product/runtime change is authorized by this document. A future implementation must receive its own specification, risk classification, tests, owner TornPDA gate where appropriate, and exact-head merge authorization.
