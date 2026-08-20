# DQ-KEY-001 — Minimum API Permission and Source-Ownership Matrix

Status: **CHECKPOINT READY / MINIMUM-PERMISSION LIVE PROBES COMPLETE**

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

## 2. Permission model learned during this chapter

### Exact Custom grants

For private/custom capabilities such as `user:inventory`, `user:trades`, `user:trade`, `torn:items`, and `user:bazaar`, live testing showed that a Custom key can operate with broad `access.level: 0` while exact capability grants remain usable.

Therefore broad numeric level is not the primary TornScriptures permission truth.

### `/key/info`

`/key/info` is a strong source for:

- key owner identity;
- key type/level;
- faction/company privilege flags;
- exact private/custom selections that Torn enumerates.

However, KEY-001-C proved that `/key/info` is **not a universal manifest of Public endpoint capability**: `GET /faction/{id}/members` succeeded while `members` was not enumerated in the Faction selection array.

Future validation must distinguish private/custom grants from Public endpoint capability rather than applying one exact-array rule to everything.

### Source ownership remains separate from permission

Permission answers **can we access it?**

Freshness/authority answers **should this source own the product decision?**

DQ-KEY-001 closes the first question for the tested capabilities. Market freshness, page-vs-API ownership, and third-party source contracts remain separate Discovery work.

## 3. Minimum permission/source matrix

| Domain / capability | Exact source / capability | Torn broad tier or live key behavior | Source owner | Current minimum conclusion | Remaining limitation / deferred question |
|---|---|---|---|---|---|
| Core — key owner and permission diagnostics | `GET /key/info` | available to tested keys | Official API | **BASELINE DIAGNOSTIC SOURCE** | Public endpoint capability may exceed enumerated selection names |
| Core — request history | `GET /key/log` | available, but exposes request/IP history | Official API | **OPTIONAL ONLY** | Not required by current domains |
| Market/Trader — Torn catalog identity/value | `torn:items` | Public; live Custom key worked at level 0 | Official API | **BASELINE FOR CATALOG USERS** | broad vs targeted efficiency remains DQ-CATALOG-001 |
| Market/Trader — official Item Market snapshot | `market:itemmarket` | Public | Official API | **OPTIONAL / SOURCE OWNERSHIP OPEN** | freshness versus rendered page remains DQ-MARKET |
| Market/Trader — Weav3r/TornExchange prices | provider pages | no Torn API permission | Third party | **NO TORN PERMISSION** | provider freshness/availability remains DQ-EXT |
| Black Ledger — finished trade discovery | `user:trades` | Custom worked live at level 0 | Official API | **REQUIRED** | exact finality-to-visibility delay remains separate DQ-TRADE work |
| Black Ledger — detailed trade truth | `user:trade` | Custom worked live at level 0 | Official API | **REQUIRED** | unsupported asset classes remain product boundary questions |
| Black Ledger — exact item identity | `torn:items` | Public; worked live at level 0 | Official API | **REQUIRED BY CURRENT RELEASE** | targeted catalog optimization may come later |
| Black Ledger — FIFO/cost basis/dedupe | local Black Ledger dataset | no API permission | Local | **REQUIRED LOCAL AUTHORITY** | Class C backup/recovery contract remains storage concern |
| Black Ledger — current inventory snapshot | `user:inventory` | Minimal/custom | Official API | **NOT REQUIRED FOR COMPLETED-TRADE RECOVERY** | useful for reconciliation only |
| Black Ledger — own Item Market listings | `user:itemmarket` | Limited | Official API | **NOT REQUIRED FOR COMPLETED-TRADE RECOVERY** | separate listing reconciliation concern |
| Inventory — inventory scan | `user:inventory` | live Custom key, level 0, HTTP 200 | Official API | **REQUIRED FOR API INVENTORY SCAN** | endpoint is explicitly category-cached |
| Inventory — catalog enrichment | `torn:items` | Public | Official API | **BASELINE WITH INVENTORY** | catalog update strategy separate |
| Inventory/Bazaar — own Item Market listings | `user:itemmarket` | Limited | Official API | **OPTIONAL RECONCILIATION** | freshness not yet measured |
| Inventory/Bazaar — owner Bazaar | `user:bazaar` v1 fallback | live Custom key, level 0; grant explicitly enumerated | Official API legacy fallback | **PERMISSION PROVEN** | populated listing schema and practical cache behavior deferred |
| Inventory/Bazaar — public Bazaar directory | `market:bazaar` | Public | Official API | **OPTIONAL PUBLIC SOURCE** | directory semantics/freshness remain Bazaar Discovery work |
| War Intelligence candidate — faction member/status roster | `GET /faction/{id}/members` | Public endpoint worked with `access.faction:false` | Official API | **PUBLIC CAPABILITY PROVEN** | freshness/page ownership and Hospital behavior deferred |
| War Intelligence — other members' revive preferences | same member endpoint plus faction privilege | no-privilege run returned `Unknown` for other members | Official API | **NOT AVAILABLE IN OBSERVED BASELINE** | owner’s own row exposed its own real setting; broader privilege comparison not needed now |
| War Intelligence — rendered observation history | faction page observer | no Torn API permission | Rendered/page state + Local | **CURRENT RELEASED SOURCE** | future API/page source ownership undecided |

## 4. Live proof summary

### KEY-001-A — Inventory

**FULL PASS.**

- Custom key
- broad level `0`
- User selections contained `inventory`
- `/user/inventory` returned HTTP 200 with real inventory data

Conclusion: inventory scanning does not justify a generic Limited key requirement.

### KEY-001-B — Black Ledger completed-trade recovery

**FULL PASS FOR MINIMUM-PERMISSION BOUNDARY.**

Restricted Custom grants:

- `user:trades`
- `user:trade`
- `torn:items`

Live Swagger calls all returned HTTP 200. Stable IMM v0.19.36 accepted the restricted key, loaded 86 finished trades, traversed permission/list/detail/catalog stages, and then stopped only at legitimate local readiness guards. No accounting mutation was performed.

Conclusion: `user:inventory`, `user:itemmarket`, `user:log`, and Full access are not prerequisites for released completed-trade recovery.

### KEY-001-C — Public faction member/status capability

**FULL PASS FOR PUBLIC CAPABILITY BOUNDARY.**

Without faction API privilege, live member data exposed:

- identity, level, faction tenure and position;
- Online / Idle / Offline activity states;
- last-action timestamps/relative values;
- Okay / Traveling / Abroad Torn states;
- directional travel descriptions;
- `plane_image_type` values such as `light_aircraft` and `airliner`;
- revivable/wall/OC/early-discharge flags.

Observed Traveling/Abroad examples had `status.until: null`, so travel ETA is not proven available through this source.

Other members' `revive_setting` values were `Unknown`, while the key owner's own row exposed its real setting even with `access.faction:false`.

`/key/info` did not enumerate `members`, despite the Public endpoint succeeding.

Conclusion: baseline structured member/status data does not justify faction API privilege. War freshness and source ownership remain future Discovery work.

### KEY-001-D — Owner Bazaar

**PASS FOR PERMISSION + EMPTY/CLOSED-STATE CONTRACT.**

Live `/key/info` showed:

- Custom key
- broad level `0`
- User selections explicitly included `bazaar`

Live owner-Bazaar response:

```json
{
  "bazaar_is_open": false,
  "bazaar_exists": true,
  "bazaar": []
}
```

Conclusion: exact Custom `user:bazaar` access works and is introspectable. Populated listing-row schema and cache/freshness behavior are intentionally deferred until a naturally populated Bazaar or later Bazaar Discovery run.

## 5. Corrections to earlier TornScriptures assumptions

### Inventory access

Earlier Discovery notes labeled `/user/inventory` as Limited. Current OpenAPI 6.11.1 and live Custom-key testing establish the practical minimum as Minimal/custom.

### Black Ledger packaging versus feature minimum

Stable IMM currently contains multiple API-consuming concerns. The union of those selections is **not** the minimum for Black Ledger recovery itself.

### War permission assumption

Structured faction member/status data is available without faction API privilege. Privilege should not be requested by default merely for the baseline roster/status fields.

### `/key/info` validation rule

Exact selection presence is useful for private/custom grants but cannot be generalized to Public endpoints. Public capability may work without endpoint-name enumeration in `/key/info`.

## 6. Provisional feature-specific permission sets

These are research conclusions, not onboarding implementation.

### Core diagnostics

- `/key/info`

Optional only:

- `/key/log` for a separately approved audit/diagnostic feature
- `user:basic` only if future UX needs profile information not already available from legitimate context

### Market / Trader

Baseline capability sources currently justify:

- `torn:items` for catalog identity/value
- rendered Item Market page for current active-decision workflows
- optional third-party provider pages where configured

Do not add `user:itemmarket` merely because another IMM subdomain uses it.

### Black Ledger recovery

Minimum released recovery set:

- `user:trades`
- `user:trade`
- `torn:items`

Plus local Black Ledger accounting state.

### Inventory / Bazaar

Inventory scan baseline:

- `user:inventory`
- `torn:items`

Conditional:

- `user:itemmarket` for own-listing reconciliation
- `user:bazaar` for owner-Bazaar features
- `market:bazaar` for public directory features

### Future War Intelligence

Capability floor currently proven:

- Public `faction/{id}/members`

Do not request faction API privilege by default. Page/API freshness and final source ownership remain undecided.

## 7. Deliberately deferred questions

The following are **not blockers** to the DQ-KEY-001 minimum-permission checkpoint:

- Market Item Market API freshness versus rendered page state;
- Weav3r/TornExchange source freshness and replacement possibilities;
- faction member API freshness versus rendered-page observer;
- live Hospital-state member shape;
- owner Bazaar populated listing-row schema;
- owner Bazaar practical cache behavior;
- one-key versus domain-key packaging;
- TornPDA managed-key versus custom-key onboarding.

Those questions already belong to DQ-MARKET, DQ-EXT, future War Discovery, Bazaar Discovery, or DQ-KEY-002.

## 8. Chapter conclusion

DQ-KEY-001 has established the minimum-permission boundary far enough to checkpoint:

- Inventory minimum: **proven**
- Black Ledger recovery minimum: **proven**
- Public faction member/status capability: **proven with limitations recorded**
- Owner Bazaar permission/empty-state contract: **proven**

The central architectural lesson is:

> TornScriptures should ask for the smallest capability each enabled feature actually needs, validate it according to that capability's access model, and keep source freshness/authority separate from permission level.

This does **not** yet decide one key versus multiple keys or authorize runtime prompt changes.

## 9. Release posture

This file is a Discovery checkpoint, not product code.

Before merge:

- verify PR #111 remains documentation-only;
- verify completed probes are represented consistently across protocol/evidence/checkpoint files;
- run the normal TornScriptures release gate;
- require exact-head owner merge authorization.

No product/runtime change is authorized by this document.