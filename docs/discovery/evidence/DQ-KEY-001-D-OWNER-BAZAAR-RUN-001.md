# DQ-KEY-001-D — Owner Bazaar Capability Run 001

Status: **PARTIAL PASS / OWNER EMPTY-STATE SHAPE PROVEN / LISTING SHAPE AND CACHE BEHAVIOR OPEN**

Date: 2026-08-20

## Purpose

Characterize the current owner-Bazaar API behavior under a narrowly scoped Custom key without forcing a gameplay change solely for Discovery.

This is capability evidence only. It does not authorize Bazaar implementation, listing automation, or polling.

## Live response observed

The owner supplied the following sanitized owner-Bazaar response:

```json
{
  "bazaar_is_open": false,
  "bazaar_exists": true,
  "bazaar": []
}
```

## What this proves

- the owner-Bazaar request succeeded under the test setup;
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

Do **not** mutate Bazaar state merely to complete this notebook. Listing-shape and freshness evidence should be collected later from a naturally populated Bazaar or during a separately approved Bazaar Discovery run.

The current DQ-KEY-001 requirement is satisfied far enough to know that the owner-Bazaar capability exists and that its empty/closed-state contract is structurally usable, while the remaining legacy/freshness questions stay explicitly open.

## Security

No raw API key or screenshot is committed in this evidence file.

## Product effect

None.