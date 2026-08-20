# DQ-KEY-001-B — Black Ledger Recovery-Only Permission Run 001

Status: **API BOUNDARY PASS / STABLE IMM REVIEW GATE STILL OPEN**

Date: 2026-08-20

## Safety note

The owner supplied Swagger screenshots and sanitized response text from the controlled test. Raw API key material is not copied, retained, quoted, or committed in TornScriptures evidence. Screenshots are not committed.

## Intended temporary custom grants

- User → `trades`
- User → `trade`
- Torn → `items`

The test intentionally excludes `user:inventory`, `user:itemmarket`, and `user:log`.

Torn may also report baseline/default selections such as `profile`, `timestamp`, `lookup`, `info`, or `log`; these are not treated as evidence that broader private capabilities were intentionally granted.

## `/key/info` evidence

Observed live Swagger response:

- HTTP 200
- `access.type`: `Custom`
- `access.level`: `0`
- `access.faction`: false
- `access.company`: false
- Torn selection array visibly includes `items`

The screenshots supplied for this stage did not preserve the complete User selection array, so direct retained `/key/info` evidence for both `trades` and `trade` is not complete. Functional endpoint behavior below independently proves both capabilities are usable under this key.

## `/user/trades` evidence

Swagger exposes `cat` as an explicit choice between:

- `ongoing`
- `finished`

This matches the current v2 contract and is recorded because it confirms the intended category boundary directly in the live interface.

### Ongoing run

Request:

`GET /v2/user/trades?cat=ongoing&limit=100&sort=DESC`

Observed:

- HTTP 200
- valid response structure
- `trades: []`

An empty ongoing list is a valid success, not a permission failure.

### Finished run

Request:

`GET /v2/user/trades?cat=finished&limit=100&sort=DESC`

Observed:

- HTTP 200
- real completed trade rows returned
- trade `7210016` present
- trade `7200716` also visible in retained evidence
- participant identity and completion/timestamp fields populated

This live-confirmed the `user:trades` capability under the restricted key.

## `/user/{tradeId}/trade` evidence

A finished ordinary cash-for-items trade was queried through the detailed trade endpoint. The owner supplied a sanitized live response for trade `7188680`.

Observed:

- HTTP 200
- `trade.id`: `7188680`
- `trade.type`: `finished`
- one `Money` asset row attributed to the counterparty
- eight `Item` asset rows attributed to the owner
- Money details contained a numeric amount
- Item details contained exact item IDs, nullable UID, and quantities
- participant identity and completion fields were populated

The response matches the released Black Ledger recovery model: the authoritative detail source identifies contribution ownership per asset entry and distinguishes Money from Item rows without requiring inventory or Item Market listing access.

This live-confirms the `user:trade` capability under the restricted key.

## `/torn/items` evidence

Request:

`GET /v2/torn/items?sort=ASC`

Observed:

- HTTP 200
- real `items` array returned
- catalog entries included exact item ID/name and catalog/value metadata

This live-confirms `torn:items` under the same restricted Custom key and proves the current recovery path can obtain its exact-ID catalog dependency without adding owner-private inventory/listing permissions.

## API-boundary conclusion

**PASS.** The recovery-only Custom key successfully exercised all three capability dependencies identified for released Black Ledger completed-trade recovery:

1. `user:trades` — finished-trade discovery
2. `user:trade` — authoritative participated-trade detail
3. `torn:items` — exact Torn item catalog identity

No evidence from this run requires `user:inventory`, `user:itemmarket`, `user:log`, or Full access for this recovery capability.

The broad key level remained `0`, reinforcing the DQ-KEY-001 finding that broad numeric access level is not a sufficient capability test for Custom keys. Required-selection presence plus functional endpoint access is the truthful boundary.

## Remaining gate before KEY-001-B is fully closed

Test stable IMM v0.19.36 using this same capability-limited key:

1. configure the key in stable IMM;
2. open Black Ledger API trade recovery;
3. validate permission/list access;
4. open a safe already-finished trade candidate;
5. reach the non-mutating recovery review successfully;
6. **stop before `Record sale`**.

The goal is to prove that the released TornScriptures implementation itself can traverse its recovery path without `user:inventory` or `user:itemmarket`, not merely that Torn's endpoints accept the key.

If stable IMM rejects the key because its UI assumes a generic Limited key despite the endpoint calls passing, record that as **permission-validation/UX debt**, not as evidence that the underlying recovery capability needs broader permission.

## Optional evidence improvement

A sanitized `/key/info` User selection array showing `trades` and `trade` would strengthen the retained record, but it is no longer required to prove functional access because both corresponding endpoints returned live HTTP 200 responses under the same key.

## Product effect

None. This evidence does not authorize changing stable key prompts, recovery behavior, or accounting mutation.