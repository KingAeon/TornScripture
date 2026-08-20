# DQ-KEY-001 — Live Permission Verification Protocol

Status: **DISCOVERY PROTOCOL / NO PRODUCT MUTATION**

Date: 2026-08-20

Companion: `DQ-KEY-001-MINIMUM-PERMISSION-MATRIX.md`

## Purpose

Verify the few permission boundaries that official documentation alone cannot close for TornScriptures.

This protocol is intentionally small. It does not require a new userscript, does not require an accounting-significant transaction, and does not authorize any change to stable runtime behavior.

## Safety rules

1. Never paste an API key into chat, GitHub, issue comments, screenshots, or Discovery evidence.
2. Use Torn's own API/custom-key UI to create test keys.
3. Give each temporary key only the exact selections required by that test.
4. Delete temporary test keys after the evidence is captured if they are no longer needed.
5. Record only sanitized `/key/info` fields and pass/fail behavior.
6. Do not deliberately create a costly trade, listing, or faction action for this protocol.
7. No test may mutate Black Ledger simply to prove API permission behavior.

## Evidence format

For each run record:

- date/time
- environment: TornPDA or desktop browser
- test ID
- custom selections granted, by name only
- `/key/info` access type and granted-selection arrays, with the raw key removed
- target endpoint
- HTTP/API success or Torn error code
- whether the response contained the expected structural fields
- cache/freshness notes where relevant
- conclusion

Do not retain IP values from `/key/log` for this chapter.

---

## KEY-001-A — Minimal inventory custom key

### Goal

Confirm the current OpenAPI claim that inventory no longer requires a broad Limited key and that an exact custom grant behaves as expected.

### Temporary key

Grant only:

- User → `inventory`
- Torn → `items` only if the test interface/tool also needs catalog enrichment; omit it for the pure permission test

Do not add `itemmarket`, `trades`, `trade`, or `log`.

### Calls

1. `GET /v2/key/info`
2. `GET /v2/user/inventory?cat=Flower&limit=20`

A different ordinary inventory category may be used if Flower is inconvenient.

### Pass criteria

- `/key/info` identifies the key as Custom and reports `user:inventory` among granted selections.
- `/user/inventory` succeeds without unrelated Limited selections.
- Response contains the expected inventory structure or an empty valid inventory response rather than permission error 16.

### Failure interpretation

- Error 16 with the exact custom grant means current custom-key behavior differs from our reading of the OpenAPI and must be investigated before correcting onboarding.
- Empty inventory is not failure if the response is otherwise valid.

---

## KEY-001-B — Black Ledger recovery-only custom key

### Goal

Prove that the released completed-trade recovery capability is separable from IMM's broader inventory/listing permission bundle.

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
- Prefer a previously recorded/tested trade where possible.
- Do not create an accounting-significant trade solely for this test.
- The test may stop at list/detail/review evidence. It does not need to record a sale.

### Calls/evidence

1. `/key/info`
2. `/user/trades?cat=finished`
3. `/user/{tradeId}/trade` for one safe finished candidate
4. `/torn/items` or the catalog state required by the stable v0.19.36 review path

### Pass criteria

- exact grants are visible in `/key/info`;
- finished-trade list succeeds;
- selected participated-trade detail succeeds;
- catalog resolution succeeds;
- review can be constructed without requiring `user:inventory` or `user:itemmarket`;
- no ledger mutation is required for the permission test.

### Important product boundary

If stable IMM's current UI refuses the key solely because it assumes a broad Limited key despite the endpoint calls succeeding, record that as **UX validation debt**, not as evidence that the feature itself needs more permission.

---

## KEY-001-C — Public War Intelligence candidate

### Goal

Confirm that the structured fields current WIH cares about are available through `faction:members` without privileged faction API access.

### Temporary key

Grant only:

- Faction → `members`

Do not enable faction API permission merely for this test unless a second comparison run explicitly needs it.

### Call

`GET /v2/faction/{factionId}/members`

Use a faction whose rendered page can also be observed safely.

### Pass criteria

For representative members confirm the response includes the fields needed for later source comparison, especially:

- user ID/name
- `last_action`
- current `status`
- state / until timing where applicable

Record `revive_setting` separately.

### Optional second run

If the owner legitimately has faction API access, repeat for the owner's own faction only to determine whether the practical response difference is limited to the documented `revive_setting` enrichment.

Do not request faction privilege solely to enrich TornScriptures.

---

## KEY-001-D — Owner Bazaar fallback

### Goal

Resolve the legacy `user:bazaar` uncertainty before Inventory/Bazaar architecture uses it.

### Temporary key

Grant exactly:

- User → `bazaar`

The selection currently falls back to API v1.

### Evidence

1. `/key/info` granted-selection representation
2. owner `user:bazaar` response shape
3. whether the response is valid with the exact custom key
4. timestamped repeated reads sufficient to characterize obvious cache behavior without excessive polling
5. fields useful to owner inventory/listing features

### Cache discipline

Do not poll rapidly. The purpose is to establish the contract, not to hammer Torn's API. A small bounded comparison around a naturally occurring Bazaar change is preferable.

### Pass criteria

- exact custom selection is accepted;
- response fields can be catalogued;
- cache behavior can be described without guessing.

---

## KEY-001-E — Core `/key/info` sufficiency

### Goal

Confirm what Core can learn without `user:basic`.

### Evidence

From sanitized `/key/info`, record whether the current live response includes:

- owner user ID
- faction ID or null
- company ID or null
- access type/level
- faction/company flags
- per-section granted selections

Do not record the raw key.

### Conclusion rule

If Core only needs stable owner ID and permission diagnostics, `user:basic` is not required. If product UX later requires owner display name or other profile fields, that becomes a separately justified Public selection.

---

## Completion rule for this protocol

DQ-KEY-001 does not require every future domain source to be live-tested before useful conclusions can be drawn.

The chapter can reach a checkpoint when:

- the official-contract matrix is current;
- inventory custom permission is live-confirmed;
- Black Ledger's recovery-only custom set is live-confirmed or an exact blocker is documented;
- `faction:members` Public behavior is live-confirmed for WIH-relevant fields;
- owner `user:bazaar` is either characterized or explicitly retained as an unresolved legacy edge;
- remaining source-freshness questions are correctly handed to their existing DQ-MARKET, DQ-WIH, DQ-BAZAAR or DQ-EXT questions rather than silently answered here.
