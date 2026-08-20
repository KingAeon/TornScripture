# DQ-KEY-001-D — Owner Bazaar Capability Run 001

Status: **PASS FOR PERMISSION + EMPTY/CLOSED-STATE CONTRACT / POPULATED LISTING SHAPE AND CACHE BEHAVIOR DEFERRED**

Date: 2026-08-20

## Purpose

Characterize the current owner-Bazaar API behavior under a narrowly scoped Custom key without forcing a gameplay change solely for Discovery.

This is capability evidence only. It does not authorize Bazaar implementation, listing automation, or polling.

## `/key/info` evidence

The owner supplied a sanitized live `/key/info` response for the same test key.

Observed:

- `access.type`: `Custom`
- `access.level`: `0`
- `access.faction`: false
- `access.company`: false
- User selections included baseline entries plus explicit `bazaar`

Relevant User selection array:

```json
[
  "profile",
  "timestamp",
  "lookup",
  "bazaar"
]
```

This confirms owner Bazaar behaves like the private/custom capabilities tested earlier: the exact `user:bazaar` grant is explicitly enumerated in `/key/info` even though the broad numeric key level remains `0`.

This contrasts with the Public faction-members probe, where a usable Public endpoint was not enumerated by endpoint name in `/key/info`.

## Live owner-Bazaar response

The owner supplied the following sanitized response:

```json
{
  "bazaar_is_open": false,
  "bazaar_exists": true,
  "bazaar": []
}
```

## What this proves

- the owner-Bazaar request succeeds with an exact Custom `user:bazaar` grant;
- `/key/info` explicitly reports `bazaar` in the User selection array;
- a broad key level above `0` is not required for this exact Custom capability;
- Torn distinguishes Bazaar existence from Bazaar open/closed state;
- a Bazaar can exist while being closed;
- an existing closed Bazaar with no returned listings produces a valid empty `bazaar` array rather than an error;
- the top-level owner-Bazaar response currently exposes at least:
  - `bazaar_is_open`
  - `bazaar_exists`
  - `bazaar`

## What this does not prove

Because the tested Bazaar was closed/empty at capture time, this run does **not** establish:

- the schema of populated Bazaar listing rows;
- whether quantities/prices/item IDs are exposed exactly as needed for TornScriptures;
- practical freshness/cache behavior after a listing is added, removed, repriced, or the Bazaar is opened/closed;
- whether v1-fallback cache behavior differs materially between exact Custom and broader key types in current production behavior.

## Discovery decision

Do **not** mutate Bazaar state merely to complete this notebook. Populated listing-shape and freshness evidence should be collected later from a naturally populated Bazaar or during a separately approved Bazaar Discovery run.

For DQ-KEY-001, the permission question is closed far enough to establish the least-privilege boundary:

- exact capability: `user:bazaar`
- Custom key accepted
- broad level observed: `0`
- explicit grant visible in `/key/info`
- owner empty/closed-state response structurally valid

The remaining listing-shape/cache questions belong to Bazaar source-contract/freshness research rather than minimum-permission discovery.

## Security

No raw API key or screenshot is committed in this evidence file.

## Product effect

None.