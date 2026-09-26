# DQ-TRAIN-001D — Live Adapter Proof Protocol 001

Status: **OWNER-ASSISTED LIVE PROOF READY; NO RUNTIME IMPLEMENTATION AUTHORIZED**

Prepared: 2026-09-25
Branch: docs/training-advisor-adapter-discovery-001d
Depends on: ADAPTER-SOURCE-MAP-001D.md

## Purpose

Capture the smallest safe live specimens needed to freeze Training Advisor source mappings, freshness semantics, and permission requirements.

This protocol deliberately avoids raw API-key storage, full inventory exports, or private player-state archival. The owner may paste live responses into chat for analysis; Divine Knowledge stores only sanitized schema/semantic conclusions unless the owner explicitly requests otherwise.

## Safety

Never paste or commit API keys, Authorization headers, browser cookies, session tokens, raw Swagger curl commands containing credentials, or irrelevant private identifiers. When using Torn Swagger, copy the response body only.

## Current contract baseline

Official Torn API v2 OpenAPI version: **6.13.6**, checked 2026-09-25.

- GET /user/bars: Minimal, Stable; energy and happy each expose current, maximum, increment, interval, tick_time, full_time.
- GET /user/cooldowns: Minimal, Stable; exposes integer seconds for drug, medical, booster.
- GET /user/battlestats: Limited, Stable; exposes Strength/Defense/Speed/Dexterity detail plus total.
- GET /user/gym: Stable; description says Minimal while declared key parameter says Public. Live permission behavior must resolve this discrepancy.
- GET /torn/gyms: Public, Unstable; exposes gym ID/name/class, energy_cost, stat modifiers, cost and note.
- GET /user/perks: Stable; description says Minimal while declared key parameter says Public. Response is categorized arrays of strings.
- GET /user/refills: Minimal, Stable; exposes refill availability booleans.
- GET /user/inventory: Minimal, Stable, explicitly cached 1 hour per category.

## Run A — Bars and cooldowns

### A1. /user/bars

Capture only the energy and happy objects with current, maximum, increment, interval, tick_time and full_time.

Questions this proves:

1. Is owner Energy maximum 150?
2. Does Energy increment equal 5 and interval equal 600 seconds for the donator account?
3. Does Happy maximum represent the ordinary/base Happy used by the planner even while current Happy may be elevated?
4. What are the semantics of tick_time and full_time in a live response?
5. Are current/max values immediately consistent with the visible Torn bars?

For the strongest ordinaryHappy proof, one ordinary-Happy sample establishes the candidate semantics; a later elevated-Happy sample can confirm that happy.maximum does not rise with temporary Happy.

### A2. /user/cooldowns

Capture only cooldowns.drug, cooldowns.medical and cooldowns.booster.

Record whether the visible Torn cooldown values approximately agree at capture time. Exact second-for-second equality is not required if page/API observations are not simultaneous.

### A acceptance

A passes when bars/cooldowns return successfully under the intended key, fields match the current schema, Energy natural-cap/regen semantics are coherent, Happy maximum semantics are not contradicted, cooldown values behave as countdown state, and no cache behavior is observed that would prevent planner freshness use.

## Run B — Stats and gym

### B1. /user/battlestats

Do not commit raw values. For analysis, the owner may paste the response privately in chat.

Sanitized Divine Knowledge may retain only that all four fields are present, each detail contains value/modifier/modifiers, whether value is the correct raw trained-stat input, and any material distinction between raw value and temporary combat modifier.

### B2. /user/gym

Capture only gym.id and gym.name. Record whether the intended narrow key succeeds, resolving the current description/parameter access mismatch.

### B3. /torn/gyms

From the full response, extract only the row whose ID matches /user/gym. Capture id, name, class, energy_cost, modifiers.strength/speed/defense/dexterity, and note.

Acceptance: IDs join exactly; Complete Cardio values reconcile with the previously calibrated 10E and 5.5/5.8/5.5/5.2 familiar dot values or the adapter unit conversion is explicit; note is inspected for special behavior; because the endpoint is Unstable, future implementation includes a schema/version guard.

## Run C — Perks

Call /user/perks. The owner does not need to paste unrelated perk strings. Capture only strings plausibly affecting gym gains, Happy loss, booster/candy effectiveness or cooldown, drug effects/cooldown, Energy, or training specials/books/events, preserving category.

Each relevant string is classified as SUPPORTED_NUMERIC_GAIN, SUPPORTED_NON_GAIN_MECHANIC, UNSUPPORTED_MATERIAL_EFFECT, IRRELEVANT_TO_TRAINING, or UNKNOWN. Unknown potentially material strings fail closed.

## Run D — Refill state

Call /user/refills. Capture refills.energy, refills.nerve, refills.token and refills.special_count. For Training Advisor, only energy availability is a core v0.1 input. Point price/value remains separate.

## Run E — Inventory planning snapshot

Inventory permission and broad response shape are already live-proven by DQ-KEY-001. DQ-TRAIN-001D needs only training-relevant items and cache behavior. Do not commit a full inventory dump.

For each relevant item normalize only itemId, amount, inventoryTimestamp and category. Candidate core items: Xanax, Ecstasy, Erotic DVD, and selected candy exemplars actually supported by the planned mechanic registry.

Because /user/inventory is explicitly one-hour cached per category, this can establish planning inventory but not LIVE execution inventory.

## Run F — Optional elevated-Happy confirmation

At any future naturally occurring elevated-Happy session, capture only the bars Energy/Happy fields again. Purpose: confirm happy.current can exceed happy.maximum and happy.maximum remains the ordinary/base Happy reference.

## Result recording

Each run records endpoint, OpenAPI version, HTTP success/failure, intended key capability, observed response shape, semantic result, freshness/cache result, redactions performed, adapter disposition and open uncertainty. No raw key is ever recorded.

## Freeze gate

DQ-TRAIN-001D becomes specification-ready when A through D are live-proven, B3 unit normalization is resolved, relevant C strings have an explicit parser disposition, inventory remains deliberately planning-only unless a stronger execution source is separately proven, and sanitized adapter fixtures can be written without private player values.

At that point we freeze adapter fixtures and request separate [B] authorization for adapter implementation.