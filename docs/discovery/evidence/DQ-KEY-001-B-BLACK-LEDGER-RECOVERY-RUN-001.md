# DQ-KEY-001-B — Black Ledger Recovery-Only Permission Run 001

Status: **STABLE IMM PERMISSION PASS / NON-MUTATING REVIEW BLOCKED ONLY BY LOCAL CATALOG GAP**

Date: 2026-08-20

## Safety note

The owner supplied Swagger screenshots, sanitized response text, and TornPDA stable-IMM screenshots from the controlled test. Raw API key material is not copied, retained, quoted, or committed in TornScriptures evidence. Screenshots are not committed.

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

## Stable IMM v0.19.36 run

The same capability-limited key was then configured in the stable TornPDA IMM and Black Ledger → **Recover recent API trade** was opened.

Observed:

- stable IMM accepted the key rather than rejecting it as broadly insufficient;
- the recovery overlay successfully loaded **86 finished trades**;
- known completed trades including `7210016` and `7188680` were visible with Review actions;
- pre-existing Ledger Integrity UI remained green with **No integrity issues found**;
- therefore stable IMM's permission validation and finished-trade list path both operate with the recovery-only key and do not require `user:inventory` or `user:itemmarket`.

### Review attempt

A finished candidate was opened for review. Stable IMM stopped before constructing the accounting review with the exact fail-closed message:

> Item ID 271 is not in the catalog. Sync the item catalog first. Name-only lookup is not permitted. Payload quarantined.

This is **not a permission failure**. It is a local catalog-state prerequisite failure after permission/list/detail access has already succeeded.

The behavior is consistent with the released Black Ledger safety contract: an exact trade item ID that cannot be resolved in the local catalog must not be guessed by name, and the payload is quarantined rather than partially or inventively interpreted.

No accounting confirmation was reached, and no sale recording was authorized during this run.

## Current conclusion

The stable TornScriptures implementation has now proven the critical least-privilege boundary far enough to distinguish permission from local-data readiness:

- restricted Custom key accepted by stable IMM: **PASS**
- finished-trade permission/list path: **PASS**
- direct trade-detail API capability under same key: **PASS**
- `torn:items` API capability under same key: **PASS**
- review construction: **BLOCKED BY INCOMPLETE LOCAL CATALOG, NOT BY PERMISSION**
- ledger mutation: **NOT ATTEMPTED / NOT AUTHORIZED**

This is evidence that `user:inventory` and `user:itemmarket` are not prerequisites for Black Ledger completed-trade recovery permission or trade-source access.

## Remaining gate before KEY-001-B is fully closed

1. Using the same restricted key, refresh/sync the stable IMM item catalog from Torn.
2. Confirm the catalog sync succeeds, which should independently exercise the already-proven `torn:items` grant through the product UI.
3. Reopen Recover recent API trade.
4. Select a safe finished trade whose outgoing item IDs are present after catalog refresh.
5. Reach the non-mutating recovery review and verify it populates.
6. **Stop before `Record sale`.**

If a freshly synchronized catalog still omits a trade item ID that the official `/torn/items` response contains, record that separately as catalog normalization/cache debt rather than broadening the API key.

## Optional evidence improvement

A sanitized `/key/info` User selection array showing `trades` and `trade` would strengthen the retained record, but it is no longer required to prove functional access because both corresponding endpoints returned live HTTP 200 responses under the same key and stable IMM successfully loaded the finished-trade list.

## Product effect

None. This evidence does not authorize changing stable key prompts, recovery behavior, catalog behavior, or accounting mutation.