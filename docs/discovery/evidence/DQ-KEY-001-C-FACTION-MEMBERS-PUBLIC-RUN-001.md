# DQ-KEY-001-C — Public Faction Members Capability Run 001

Status: **PASS FOR PUBLIC MEMBER/STATUS CAPABILITY / PRIVILEGED REVIVE DETAIL NOT AVAILABLE**

Date: 2026-08-20

## Safety note

The owner supplied Torn Swagger screenshots and sanitized JSON from a controlled live test. One screenshot's generated curl block exposed the temporary API key. The raw key is intentionally not copied, retained, quoted, or committed in TornScriptures evidence. Screenshots are not committed. The temporary key should be revoked after this run.

## Test intent

Map what Torn exposes through the public `GET /v2/faction/{id}/members` endpoint before any future War Intelligence design is committed.

This test is capability discovery only. It does not authorize War Intelligence implementation, polling, page/API source ownership, or privilege expansion.

## Key introspection

Sanitized live `/key/info` response showed:

- `access.type`: `Custom`
- `access.level`: `0`
- `access.faction`: `false`
- `access.company`: `false`
- Faction selections reported by `/key/info`: `timestamp`, `basic`, `lookup`
- `members` was not enumerated in the Faction selection array

### Important interpretation

Despite `members` not appearing in the `/key/info` Faction selection array, the public faction-members endpoint succeeded under the same key.

This means TornScriptures must not assume that every usable **Public** v2 endpoint will appear as an exact named grant in `/key/info`. The `/key/info` exact-selection-presence rule established for private/custom capabilities such as `user:inventory`, `user:trades`, and `user:trade` cannot be generalized mechanically to all Public endpoints.

For Public endpoints, current evidence says functional endpoint access plus the official access-tier contract is the safer capability test.

## Live faction-members request

Request:

`GET /v2/faction/51011/members?striptags=true`

Observed:

- successful live response with a real `members` array
- no faction API privilege was present (`access.faction: false`)
- representative members returned structured identity, activity, status, faction-position and state flags

Representative live member fields included:

- `id`
- `name`
- `level`
- `days_in_faction`
- `last_action.status`
- `last_action.timestamp`
- `last_action.relative`
- `status.description`
- `status.details`
- `status.state`
- `status.color`
- `status.until`
- `revive_setting`
- `position`
- `is_revivable`
- `is_on_wall`
- `is_in_oc`
- `has_early_discharge`

Two observed members were `Offline` with `status.state: "Okay"`; their `status.until` values were null.

## Privilege limitation observed

For the tested own-faction members, `revive_setting` returned:

`Unknown`

This matches Torn's current OpenAPI contract: `GET /faction/{id}/members` requires only a Public key, but `revive_setting` is populated for the user's own faction only when the key has faction permissions; otherwise it is `Unknown`.

Therefore the first proven privilege boundary is:

- member identity/activity/status fields: available without faction privilege
- `revive_setting`: degraded to `Unknown` without faction privilege

No current evidence justifies requesting faction API privilege merely to obtain the core member/status data.

## Additional public fields of possible future value

The current official schema also documents these member-level fields without making them conditional on faction privilege:

- `is_revivable`
- `is_on_wall`
- `is_in_oc` (documented to return false for members of other factions)
- `has_early_discharge`
- `last_action`
- `status`

The `status` schema supports `description`, `details`, `state`, `color`, `until`, and a `plane_image_type` field populated when state is `Traveling`.

These are capability facts only. Freshness, caching, war usefulness, and whether page state remains superior are still separate Discovery questions.

## Current conclusion

**KEY-001-C passes for the minimum-permission capability question.**

TornScriptures can obtain a structured faction member roster with identity, last-action state and timestamps, current Torn status state/details/timing, faction position, revivable/wall/OC/early-discharge flags using a Public-capability key with no faction API privilege.

The proven limitation is that `revive_setting` remains `Unknown` without faction permission.

A second important DQ-KEY-001 finding is that `/key/info` exact-selection enumeration is not a universal capability manifest for Public endpoints. Public endpoints may succeed even when the endpoint selection name is absent from the returned selection arrays.

## Follow-up evidence worth collecting later

Without changing the key or enabling faction privilege, one bounded follow-up can strengthen the future War Intelligence capability map:

1. capture one member whose `status.state` is not `Okay` (for example Hospital or Traveling) to verify live `details`/`until` behavior;
2. if naturally present, capture one `Online` or `Idle` member to confirm the live `last_action.status` variants;
3. do not enable faction privilege solely to compare `revive_setting`.

These are source-shape probes, not product implementation gates.

## Product effect

None. No War Intelligence implementation or permission expansion is authorized by this evidence.
