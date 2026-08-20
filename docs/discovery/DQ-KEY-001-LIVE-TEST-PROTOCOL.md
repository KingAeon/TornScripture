# DQ-KEY-001 — Live Permission Verification Protocol

Status: **DISCOVERY PROTOCOL / A-D EXECUTED / NO PRODUCT MUTATION**

Date: 2026-08-20

Companion: `DQ-KEY-001-MINIMUM-PERMISSION-MATRIX.md`

## Purpose

Verify the few permission boundaries that official documentation alone cannot close for TornScriptures.

This protocol is intentionally small. It does not require a new userscript, does not require an accounting-significant transaction, and does not authorize any change to stable runtime behavior.

## Safety rules

1. Never retain or publish raw API keys in chat excerpts, GitHub evidence, screenshots, or logs.
2. Use Torn's own API/custom-key UI to create temporary test keys.
3. Give each temporary key only the exact selections required by that test.
4. Revoke exposed or no-longer-needed temporary keys after evidence is captured.
5. Record only sanitized `/key/info` fields and pass/fail behavior.
6. Do not deliberately create a costly trade, Bazaar listing, or faction action solely for this protocol.
7. No test may mutate Black Ledger merely to prove API permission behavior.

## Evidence format

For each run record:

- date/time;
- environment;
- test ID;
- intended custom selections by name only;
- sanitized `/key/info` access type/level and relevant selection arrays;
- target endpoint;
- HTTP/API success or Torn error;
- expected structural fields;
- cache/freshness notes only when directly observed;
- conclusion.

Do not retain raw keys or `/key/log` IP values for this chapter.

---

## KEY-001-A — Minimal inventory custom key

### Goal

Confirm that inventory does not require a generic Limited key and that an exact `user:inventory` Custom grant works.

### Temporary key

Grant only:

- User → `inventory`

Do not add `itemmarket`, `trades`, `trade`, or `log` for the pure permission test.

### Calls

1. `GET /v2/key/info`
2. `GET /v2/user/inventory?cat=Flower&limit=20`

### Pass criteria

- `/key/info` identifies the key as Custom and includes `inventory` in the User selections;
- `/user/inventory` succeeds without unrelated Limited selections;
- an empty but valid inventory response counts as success.

### Live disposition

**FULL PASS.** The tested Custom key reported broad level 0 with `inventory` present, and `/user/inventory` returned HTTP 200 with real data.

---

## KEY-001-B — Black Ledger recovery-only custom key

### Goal

Prove that released completed-trade recovery is separable from IMM's broader inventory/listing permission bundle.

### Temporary key

Grant only:

- User → `trades`
- User → `trade`
- Torn → `items`

Do not add:

- User → `inventory`
- User → `itemmarket`
- User → `log`

### Preconditions

- Use an already-finished ordinary trade in which the owner participated.
- Do not create an accounting-significant trade solely for this test.
- No ledger mutation is required.

### Calls/evidence

1. `/key/info`
2. `/user/trades?cat=finished`
3. `/user/{tradeId}/trade`
4. `/torn/items` or the stable catalog path
5. stable IMM recovery flow through every permission-dependent gate that the current local accounting state can legitimately reach

### Pass criteria

The permission boundary passes when:

- finished-trade list access succeeds;
- detailed participated-trade access succeeds;
- exact catalog access/resolution succeeds;
- stable IMM accepts the restricted key;
- the flow reaches either a non-mutating review or a clearly local/accounting fail-closed prerequisite after all permission-dependent gates;
- no `user:inventory` or `user:itemmarket` permission is required.

A local FIFO/catalog/accounting prerequisite is not a permission failure when permission-dependent calls and product gates have already succeeded.

### Live disposition

**FULL PASS FOR THE PERMISSION BOUNDARY.** Swagger returned live 200 responses for `user:trades`, `user:trade`, and `torn:items`. Stable IMM accepted the same restricted key, loaded finished trades, resolved trade detail and catalog state, and then correctly stopped on a local FIFO-coverage prerequisite. No sale was recorded.

---

## KEY-001-C — Public faction-member capability

### Goal

Map what `GET /v2/faction/{id}/members` exposes without faction API privilege before any future War Intelligence source decision.

### Temporary key

Use a narrow Custom/Public-capability test key. Do not enable faction API privilege solely for this run.

### Call

`GET /v2/faction/{factionId}/members`

### Pass criteria

For representative members confirm the response exposes useful structured identity/activity/status fields without faction privilege. Record privilege-dependent or degraded fields separately.

### Live disposition

**FULL PASS FOR THE PUBLIC CAPABILITY BOUNDARY.** The live response exposed member identity, Online/Idle/Offline activity, Okay/Traveling/Abroad status variants, travel direction/location, aircraft type, faction position and state flags while `access.faction` remained false.

Observed limitations:

- other members' `revive_setting` values were `Unknown`;
- the key owner's own revive setting remained visible;
- observed Traveling/Abroad rows had `status.until: null`;
- Hospital-state shape was not naturally observed;
- `/key/info` did not enumerate `members`, so exact selection enumeration is not a universal Public-endpoint capability manifest.

Freshness and page-vs-API ownership remain future War Discovery questions.

---

## KEY-001-D — Owner Bazaar fallback

### Goal

Resolve the minimum permission and empty/closed-state behavior of legacy `user:bazaar` without forcing gameplay changes.

### Temporary key

Grant exactly:

- User → `bazaar`

The selection currently falls back to API v1 behavior.

### Evidence

1. `/key/info` representation;
2. owner `user:bazaar` response shape;
3. whether the exact Custom key is accepted.

Populated listing-row semantics and practical cache behavior are separate evidence and should be collected only from a natural Bazaar state or separately approved Bazaar Discovery run.

### Pass criteria for DQ-KEY-001

- exact Custom `user:bazaar` selection is accepted;
- `/key/info` exposes the grant or the discrepancy is documented;
- the owner endpoint returns a valid structural response;
- any unobserved populated-row/cache behavior is explicitly deferred rather than guessed.

### Live disposition

**PASS FOR PERMISSION + EMPTY/CLOSED-STATE CONTRACT.** `/key/info` reported Custom, broad level 0, and explicitly included `bazaar` in User selections. The owner endpoint returned:

```json
{
  "bazaar_is_open": false,
  "bazaar_exists": true,
  "bazaar": []
}
```

Populated listing schema and practical cache/freshness behavior remain deferred.

---

## KEY-001-E — Core `/key/info` sufficiency

### Goal

Determine what Core can learn from `/key/info` without requiring `user:basic` merely for permission diagnostics.

### Evidence

Across the A-D live runs, sanitized `/key/info` repeatedly exposed:

- owner user ID;
- faction ID;
- company ID;
- access type/level;
- faction/company flags;
- per-section selection arrays.

### Current conclusion

For stable owner ID and permission diagnostics, `/key/info` is sufficient. `user:basic` remains separately justified only if future UX genuinely needs additional profile/display fields.

---

## Completion rule

DQ-KEY-001 reaches checkpoint when:

- the official-contract matrix is current;
- inventory minimum permission is live-confirmed;
- Black Ledger recovery minimum permission is live-confirmed or an exact permission blocker is documented;
- Public faction-member capability is live-characterized with limitations recorded;
- owner Bazaar minimum permission/empty-state behavior is characterized or explicitly retained as an unresolved legacy edge;
- remaining freshness, populated-response, source-ownership, and runtime-packaging questions are handed to their proper Discovery chapters rather than silently answered here.

That completion rule is satisfied by the 2026-08-20 A-D evidence set. This protocol authorizes no product/runtime change.