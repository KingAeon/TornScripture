# DQ-KEY-001-A — Inventory Minimal Permission Run 001

Status: **PARTIAL PASS / FUNCTIONAL ENDPOINT + CUSTOM KEY TYPE LIVE-CONFIRMED / EXACT USER GRANT ARRAY STILL OPEN**

Date: 2026-08-20

## Safety note

The owner supplied screenshots of Torn Swagger during the controlled test. Swagger's generated curl example visibly included the temporary API key. The raw key is intentionally **not copied, retained, quoted, or committed** in TornScriptures evidence. The owner was instructed to revoke/delete that temporary key immediately and use a fresh temporary key for any further test.

No screenshot containing the key is committed to the repository.

## Test intent

Test the current official claim that `GET /v2/user/inventory` operates at Minimal access and can succeed without unrelated Limited selections.

The intended temporary custom grant was:

- User → `inventory`

No `itemmarket`, `trades`, `trade`, or `log` grant was intended for this run.

## Observed inventory request

Swagger executed:

- endpoint: `GET /v2/user/inventory`
- `cat=Flower`
- `offset=0`
- `limit=20`

## Observed inventory result

- HTTP status: **200**
- response contained the expected `inventory.items` structure
- returned ordinary Flower inventory rows with item ID, amount, equipped state, name, UID, and faction-owned state
- no permission error was returned

The response body contained real owner inventory data, so this was not merely an example/schema response.

## Observed `/key/info` follow-up

A subsequent live Swagger call to `GET /v2/key/info` returned:

- HTTP status: **200**
- `access.type`: **Custom**
- `access.level`: **0**
- `access.faction`: false
- `access.company`: false
- key-info response included grouped section-selection data and owner identity fields

The supplied crop did **not** include the User selections array, so the exact `user:inventory` grant is not yet directly visible in retained evidence.

### Discovery significance

This proves that Torn can execute the tested inventory request under an exact-selection **Custom** key even when the broad numeric access level reports `0`. Therefore broad access level alone is not a sufficient capability test for TornScriptures. Exact granted selections are the more truthful permission unit.

## Conclusion

Two parts of KEY-001-A now pass:

1. Torn's current `/user/inventory` endpoint succeeds under the tested custom/minimal configuration and returns valid owner inventory data.
2. `/key/info` identifies the active test key as `Custom` with broad access level `0`.

This strengthens the DQ-KEY-001 rule that `user:inventory` should be treated as a capability-specific exact selection rather than folded into a generic Limited-key requirement.

## Remaining evidence before KEY-001-A is fully closed

Capture only the sanitized portion of the same/new `/key/info` response that shows the **User granted selections array**, specifically whether it contains `inventory`.

Do not include the generated curl block or authorization header. The exact raw key must not be retained anywhere in Discovery evidence.

Once `inventory` is directly observed in the User selection array, KEY-001-A can be marked **FULL PASS**.

## Product effect

None. This evidence does not authorize changing stable key prompts or API behavior.