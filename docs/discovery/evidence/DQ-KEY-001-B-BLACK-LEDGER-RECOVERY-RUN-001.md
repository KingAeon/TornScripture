# DQ-KEY-001-B — Black Ledger Recovery-Only Permission Run 001

Status: **FULL PASS FOR DQ-KEY-001 PERMISSION BOUNDARY / REVIEW NOT REACHED ONLY BECAUSE CURRENT LEDGER HAS NO MATCHING OPEN FIFO LOTS**

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

The same capability-limited key was configured in the stable TornPDA IMM and Black Ledger → **Recover recent API trade** was opened.

Observed:

- stable IMM accepted the key rather than rejecting it as broadly insufficient;
- the recovery overlay successfully loaded **86 finished trades**;
- known completed trades including `7210016` and `7188680` were visible with Review actions;
- pre-existing Ledger Integrity UI remained green with **No integrity issues found**;
- therefore stable IMM's permission validation and finished-trade list path both operate with the recovery-only key and do not require `user:inventory` or `user:itemmarket`.

### First review attempt: catalog prerequisite

A finished candidate was opened for review. Stable IMM stopped before constructing the accounting review with the exact fail-closed message:

> Item ID 271 is not in the catalog. Sync the item catalog first. Name-only lookup is not permitted. Payload quarantined.

This was **not a permission failure**. It was a local catalog-state prerequisite failure after permission/list/detail access had already succeeded.

The owner then refreshed the item catalog through stable IMM using the same restricted key.

### Second review attempt: FIFO prerequisite

After catalog refresh, another finished-trade review attempt advanced past catalog identity resolution and stopped with the exact fail-closed message:

> None of the outgoing items are covered by open purchase lots. Payload quarantined.

This is a local Black Ledger accounting prerequisite, not an API-permission failure. The current Ledger had only two open lots and none covered the selected trade's outgoing items.

The transition from a missing-catalog error to a FIFO-coverage error proves stable IMM successfully crossed the following product-side gates under the restricted key:

1. key acceptance / permission validation;
2. finished-trade list retrieval;
3. selected trade detail retrieval;
4. exact catalog identity resolution after catalog refresh;
5. entry into FIFO eligibility evaluation.

No `user:inventory` or `user:itemmarket` permission was needed to reach that accounting-only boundary.

No accounting confirmation was reached and no sale recording was attempted or authorized.

## DQ-KEY-001-B conclusion

**FULL PASS for the permission question.**

The exact least-privilege source footprint for the released Black Ledger completed-trade recovery capability is live-proven as:

- `user:trades`
- `user:trade`
- `torn:items`
- local Black Ledger FIFO/accounting state

The following are **not required** for completed-trade recovery permission/source access:

- `user:inventory`
- `user:itemmarket`
- `user:log`
- Full access

A rendered non-mutating accounting review was not reached in this particular run only because the live Ledger had no matching open purchase lots. TornScriptures will not manufacture accounting lots merely to force the UI deeper. The fail-closed FIFO result is the correct product behavior and is sufficient to close the DQ-KEY-001 permission boundary because all permission-dependent product gates were already traversed.

If a naturally suitable future trade with matching open FIFO lots becomes available, reaching the review screen under the same restricted key may be recorded as supplemental evidence, but it is not required to keep DQ-KEY-001-B open.

## Product effect

None. This evidence does not authorize changing stable key prompts, recovery behavior, catalog behavior, or accounting mutation.