# DQ-KEY-001-A — Inventory Minimal Permission Run 001

Status: **PARTIAL PASS / FUNCTIONAL ENDPOINT CLAIM LIVE-CONFIRMED / KEY-INFO GRANT CAPTURE STILL OPEN**

Date: 2026-08-20

## Safety note

The owner supplied screenshots of Torn Swagger during the controlled test. Swagger's generated curl example visibly included the temporary API key. The raw key is intentionally **not copied, retained, quoted, or committed** in TornScriptures evidence. The owner was instructed to revoke/delete that temporary key immediately and use a fresh temporary key for any further test.

No screenshot containing the key is committed to the repository.

## Test intent

Test the current official claim that `GET /v2/user/inventory` operates at Minimal access and can succeed without unrelated Limited selections.

The intended temporary custom grant was:

- User → `inventory`

No `itemmarket`, `trades`, `trade`, or `log` grant was intended for this run.

## Observed request

Swagger executed:

- endpoint: `GET /v2/user/inventory`
- `cat=Flower`
- `offset=0`
- `limit=20`

## Observed result

- HTTP status: **200**
- response contained the expected `inventory.items` structure
- returned ordinary Flower inventory rows with item ID, amount, equipped state, name, UID, and faction-owned state
- no permission error was returned

The response body contained real owner inventory data, so this was not merely an example/schema response.

## Conclusion

The **functional endpoint half of KEY-001-A passes**: Torn's current `/user/inventory` endpoint accepts the tested Minimal/custom configuration and returns valid inventory data without requiring the broader Limited-key bundle currently requested by stable IMM.

This supports the DQ-KEY-001 correction that `user:inventory` should be treated as a Minimal, capability-specific permission rather than folded into a generic Limited requirement.

## Remaining evidence before KEY-001-A is fully closed

The supplied screenshots did not include a sanitized `/key/info` response proving the exact live granted-selection array. A new temporary key should be used because the first key was exposed in Swagger's curl output.

For the follow-up, record only sanitized `/key/info` fields sufficient to establish:

- key type/access representation
- User granted selections includes `inventory`
- no unrelated User selections were intentionally granted

Do not capture or commit the generated curl authorization header.

## Product effect

None. This evidence does not authorize changing stable key prompts or API behavior.