# DQ-KEY-001 — Chapter Checkpoint

Status: **MINIMUM-PERMISSION LIVE PROBES COMPLETE / RELEASE GATE READY**

Date: 2026-08-20

Baseline: `main` at `9b5c1b8407d7f88fefd33eba4ed80a12b0a8e1c6`

Stable IMM observed during this chapter: `0.19.36`

Official Torn OpenAPI baseline rechecked for this chapter: `6.11.1`

## Purpose

DQ-KEY-001 asks what the smallest truthful Torn API/source footprint is for each TornScriptures domain and where broad key requirements are merely packaging artifacts.

This checkpoint records the live minimum-permission evidence gathered during the chapter. It is Discovery evidence only and authorizes no runtime permission, polling, storage, key-manager, or product change.

## KEY-001-A — Inventory

Status: **FULL PASS**

Live evidence established:

- exact Custom key with intentional `user:inventory` grant;
- `/key/info` returned `type: Custom` and broad `level: 0`;
- User selections included `inventory` alongside Torn baseline/default selections;
- `GET /v2/user/inventory?cat=Flower&offset=0&limit=20` returned HTTP 200 with real inventory data;
- unrelated Limited selections were not required.

Conclusion:

`user:inventory` is a Minimal/custom capability. TornScriptures should not describe inventory scanning as requiring a generic Limited key.

## KEY-001-B — Black Ledger completed-trade recovery

Status: **FULL PASS FOR MINIMUM-PERMISSION BOUNDARY**

Live evidence established under the restricted Custom key:

- `user:trades` successfully returned finished trades;
- `user:trade` successfully returned authoritative participated-trade detail;
- `torn:items` successfully returned real catalog data;
- stable IMM accepted the restricted key and loaded 86 finished trades;
- stable IMM progressed through key validation, finished-trade listing, detail fetch and catalog resolution;
- after catalog synchronization, the next stop was a legitimate local FIFO precondition because no outgoing items were covered by open purchase lots;
- no accounting mutation was performed.

Conclusion:

The released Black Ledger completed-trade recovery capability requires:

1. `user:trades`
2. `user:trade`
3. `torn:items`
4. local Black Ledger FIFO/accounting state

No live evidence requires `user:inventory`, `user:itemmarket`, `user:log`, or Full access for this capability. Reaching a rendered accounting review was not required once all permission-dependent gates had succeeded and the flow correctly stopped at a local FIFO prerequisite.

## KEY-001-C — Faction member/status capability

Status: **FULL PASS FOR PUBLIC CAPABILITY BOUNDARY**

Live evidence established with `access.faction: false`:

- `GET /v2/faction/{id}/members` returned a real member roster;
- identity, level, faction tenure and position were present;
- `last_action` distinguished Online, Idle and Offline;
- Torn status examples included Okay, Traveling and Abroad;
- Traveling descriptions exposed direction/location and `plane_image_type` values including `light_aircraft` and `airliner`;
- observed Traveling/Abroad examples had `status.until: null`, so travel ETA is not proven available through this source;
- other members' `revive_setting` values were `Unknown` without faction privilege;
- the key owner's own row exposed its real revive setting despite `access.faction: false`;
- `/key/info` did not enumerate `members`, despite the Public endpoint succeeding.

Conclusions:

- core structured faction member/status data is available without faction API privilege;
- privileged faction access is not justified merely for baseline member/status observation;
- other members' revive preferences remain hidden in the observed no-privilege response;
- `/key/info` exact selection enumeration is not a universal manifest of Public endpoint capability;
- War Intelligence freshness, page-vs-API ownership, Hospital-state behavior and product design remain separate future Discovery work.

## KEY-001-D — Owner Bazaar

Status: **PASS FOR PERMISSION + EMPTY/CLOSED-STATE CONTRACT**

Live `/key/info` evidence established:

- `access.type: Custom`;
- broad `access.level: 0`;
- User selections explicitly included `bazaar`.

Live owner-Bazaar response:

```json
{
  "bazaar_is_open": false,
  "bazaar_exists": true,
  "bazaar": []
}
```

Conclusions:

- exact Custom `user:bazaar` access functions at broad level 0;
- the grant is explicitly visible in `/key/info`;
- owner Bazaar existence and open/closed state are distinct fields;
- a closed/empty existing Bazaar returns a valid empty listing array;
- populated listing-row schema and practical cache/freshness behavior remain intentionally deferred until a naturally populated Bazaar or a separately approved Bazaar Discovery run.

## Core `/key/info` observation

Across the live A-D runs, sanitized `/key/info` repeatedly exposed owner user ID, faction ID, company ID, access type/level, faction/company flags, and per-section selections. For permission diagnostics and stable owner ID, no additional `user:basic` grant is currently justified.

## Cross-cutting findings

### 1. Broad key level is not the permission truth

Custom keys repeatedly operated at broad `level: 0` while exact private selections such as `inventory`, `trades`, `trade`, `items` and `bazaar` were usable.

Future TornScriptures permission UX should reason about required capabilities, not simply require a generic Limited/Full label.

### 2. `/key/info` is powerful but not universal

For private/custom capability grants, `/key/info` exact selection presence was useful and truthful.

For the Public faction-members endpoint, the endpoint succeeded even though `members` was not enumerated in the Faction selection array.

Therefore future validation must distinguish:

- private/custom grants: introspection plus functional validation as appropriate;
- Public endpoints: official access contract plus functional endpoint capability, without assuming endpoint-name enumeration.

### 3. Source authority and permission are separate questions

DQ-KEY-001 establishes what can be accessed with which permission. It does not decide whether an API source is fresh enough or superior to rendered page state for a specific product decision.

Examples intentionally deferred:

- Market Item Market API freshness versus rendered Item Market page;
- War faction-member API freshness versus page observer;
- owner Bazaar listing cache/freshness;
- third-party Weav3r/TornExchange source contracts.

### 4. Least privilege should be feature-specific

The current monolithic IMM packaging can contain capabilities from several domains. That does not justify treating the union of all selections as the minimum requirement for every feature.

Black Ledger recovery is the clearest live-proven example.

## Chapter checkpoint disposition

The live minimum-permission probes required for DQ-KEY-001 have reached a sufficient checkpoint:

- Inventory minimum: proven
- Black Ledger recovery minimum: proven
- Public faction member/status capability: proven with limitations recorded
- Owner Bazaar minimum permission and empty-state contract: proven
- Core `/key/info` diagnostic sufficiency: observed across the same live runs

Remaining open questions are not blockers to the minimum-permission matrix. They have been separated into source freshness, populated-response semantics, runtime packaging, TornPDA-managed-key behavior, and future-domain design work.

The matrix, protocol, evidence files, and PR description have been reconciled for release. The remaining action is the normal TornScriptures release gate and, if it passes, separate exact-head owner merge authorization.

## Product effect

None.