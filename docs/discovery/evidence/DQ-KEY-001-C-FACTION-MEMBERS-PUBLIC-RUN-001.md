# DQ-KEY-001-C — Public Faction Members Capability Run 001

Status: **PASS FOR PUBLIC MEMBER/STATUS CAPABILITY / LIVE PRIVILEGE BOUNDARY REFINED**

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
- `status.plane_image_type` when traveling
- `revive_setting`
- `position`
- `is_revivable`
- `is_on_wall`
- `is_in_oc`
- `has_early_discharge`

## Activity-state variants live-confirmed

The same response contained real examples of all three last-action states currently relevant to TornScriptures observation logic:

- `Online`
- `Idle`
- `Offline`

This proves the public response can distinguish those activity states without faction API privilege.

## Torn status variants live-confirmed

The same response contained these status-state examples:

### Okay

- `status.state`: `Okay`
- `description`: `Okay`
- `color`: `green`
- `details`: null
- `until`: null

### Traveling

Multiple members returned:

- `status.state`: `Traveling`
- directional descriptions such as `Traveling from Torn to Argentina` or `Traveling from Argentina to Torn`
- `color`: `blue`
- `details`: null
- `until`: null
- `plane_image_type`: observed as both `light_aircraft` and `airliner`

This establishes a useful capability and a limitation at the same time: the endpoint exposes direction/destination text and plane type, but the live examples did **not** provide a populated `status.until` travel ETA.

### Abroad

At least one member returned:

- `status.state`: `Abroad`
- a location-bearing description such as `In China`
- `color`: `blue`
- `details`: null
- `until`: null

No Hospital-state member was naturally present in this captured roster, so live Hospital `details`/`until` behavior remains unproven by this run.

## Revive-setting privilege boundary: live behavior differs from the broad documentation wording

Most members in the owner’s faction returned:

`revive_setting: "Unknown"`

However, the key owner’s own member row returned a real value:

`revive_setting: "Everyone"`

This occurred while `/key/info` still reported `access.faction: false`.

Therefore the live behavior is more nuanced than a blanket statement that all `revive_setting` values are `Unknown` without faction permission.

Current live evidence supports this narrower rule:

- the key owner can see **their own** revive setting in the faction-members response even without faction API privilege;
- other faction members’ revive settings remained `Unknown` in this run;
- broader visibility of other members’ revive settings still appears to require faction permission.

Torn OpenAPI 6.11.1 currently documents `/faction/{id}/members` as Public and states that `revive_setting` is populated for an own-faction request when faction permissions are present, otherwise `Unknown`. The live self-row is therefore a documented-contract edge/discrepancy worth preserving rather than smoothing over.

No current evidence justifies requesting faction API privilege merely to obtain core member/status data.

## Other public fields of possible future value

Live response also confirmed meaningful variation in:

- `is_revivable`
- `is_in_oc`
- `position`
- `days_in_faction`

The official schema documents:

- `is_on_wall` as territory-wall defense state;
- `is_in_oc` as organized-crime participation, with false documented for members of other factions;
- `has_early_discharge` as hospital early-discharge eligibility.

These remain capability facts only. Freshness, caching, war usefulness, polling cadence, and whether rendered page state is superior are separate Discovery questions.

## Current conclusion

**KEY-001-C passes for the minimum-permission capability question.**

TornScriptures can obtain a structured faction member roster with identity, Online/Idle/Offline last-action state and timestamps, current Torn status state and descriptions, travel/abroad location direction, plane type, faction position, and revivable/wall/OC/early-discharge flags using a Public-capability key with no faction API privilege.

Proven limitations and caveats:

1. `/key/info` does not enumerate `members` even though the Public endpoint works.
2. Other members’ `revive_setting` values were `Unknown` without faction privilege.
3. The key owner’s own revive setting was visible despite `access.faction: false`, a live exception to the broad OpenAPI wording.
4. Traveling/Abroad responses in this run had `status.until: null`, so a ready-made travel ETA is not proven available from this endpoint.
5. Hospital-state `details`/`until` behavior remains live-unverified because no hospitalized member was naturally present.

These limitations should be known before any future War Intelligence architecture is designed.

## Product effect

None. No War Intelligence implementation or permission expansion is authorized by this evidence.
