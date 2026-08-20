# DQ-KEY-001-A — Inventory Minimal Permission Run 001

Status: **FULL PASS / LIVE-CONFIRMED**

Date: 2026-08-20

## Safety note

The owner supplied screenshots and a sanitized text copy of Torn Swagger output during the controlled test. Swagger's generated curl example exposed the temporary API key in screenshots. The raw key is intentionally **not copied, retained, quoted, or committed** in TornScriptures evidence. No screenshot containing the key is committed to the repository.

The temporary test key should be revoked/deleted after this run and must not be reused for later Discovery tests.

## Test intent

Test the current official claim that `GET /v2/user/inventory` operates at Minimal access and can succeed without unrelated Limited selections.

The intended custom capability grant was:

- User → `inventory`

No `itemmarket`, `trades`, `trade`, or `log` capability grant was intentionally added for this run.

## Observed inventory request

Swagger executed:

- endpoint: `GET /v2/user/inventory`
- `cat=Flower`
- `offset=0`
- `limit=20`

## Observed inventory result

- HTTP status: **200**
- response contained the expected `inventory.items` structure
- returned real owner Flower inventory rows
- rows included item ID, amount, equipped state, name, UID, and faction-owned state
- no permission error was returned

This was a live owner response, not Swagger's example/schema payload.

## Observed `/key/info`

A live `GET /v2/key/info` call returned HTTP **200**.

Sanitized access fields:

- `access.level`: `0`
- `access.type`: `Custom`
- `access.faction`: `false`
- `access.company`: `false`
- `access.log.custom_permissions`: `false`
- `access.log.available`: empty

The live grouped selection map included:

- User: `profile`, `timestamp`, `lookup`, **`inventory`**
- Company: `timestamp`, `profile`, `companies`, `lookup`
- Faction: `timestamp`, `basic`, `lookup`
- Market: `timestamp`, `lookup`
- Property: `property`, `timestamp`, `lookup`
- Torn: `timestamp`, `lookup`
- Racing: `timestamp`, `lookup`
- Forum: `timestamp`, `lookup`
- Key: `info`, `log`

Owner identity fields were also present in `/key/info`; numeric owner/faction/company identifiers are deliberately not required for this permission proof and are not repeated here.

## Discovery significance

### 1. `user:inventory` is live-proven under a Custom level-0 key

The functional endpoint and key introspection both pass. A Custom key reporting broad numeric access level `0` successfully called `/user/inventory`, and `/key/info` explicitly contained `inventory` in the User selection array.

Therefore broad access level alone is **not** a sufficient capability test for TornScriptures. Exact granted selections are the more truthful permission unit.

### 2. Selection arrays contain Torn-provided baseline/default capabilities

The live User selection array was not merely `["inventory"]`; it also contained `profile`, `timestamp`, and `lookup`. Other sections similarly exposed baseline Public selections even though those capabilities were not the purpose of the test.

Therefore a future TornScriptures permission validator must:

- test that every required capability selection is **present**;
- not require the returned selection array to equal only the user's intentional custom choices;
- distinguish required feature selections from Torn-provided baseline/default selections when explaining permissions to users.

This is an important onboarding/diagnostic rule for later design.

## Conclusion

**KEY-001-A FULL PASS.**

Live evidence establishes that:

1. `GET /user/inventory` succeeds under the tested Custom/Minimal capability configuration.
2. `/key/info` reports the active key as `Custom` with broad level `0`.
3. `/key/info` directly reports `inventory` in the User selection array.
4. Unrelated Limited selections such as `user:itemmarket`, `user:trades`, and `user:trade` are not required for the inventory call.
5. Torn adds baseline/default selections around the custom capability grant, so presence-based validation is required.

This closes the inventory-permission live-confirmation requirement for DQ-KEY-001.

## Product effect

None. This evidence does not authorize changing stable key prompts, onboarding, API behavior, or storage.