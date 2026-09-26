# DQ-TRAIN-001D — Live Adapter Proof Results

Status: **RUN A PROVISIONALLY PASSED; BOUNDED FOLLOW-UPS REMAIN; NO RUNTIME IMPLEMENTATION AUTHORIZED**

Date: 2026-09-25
OpenAPI baseline: 6.13.6

## Evidence handling

The owner supplied live `/user/bars` and `/user/cooldowns` response excerpts in chat. Raw private player state is not committed here. This record stores only nonidentifying semantic conclusions needed for adapter design.

## Run A1 — `/user/bars`

Observed live semantics:

- donator-class Energy natural maximum returned **150**;
- Energy natural regeneration returned **+5 every 600 seconds**;
- the sample was at the natural Energy cap;
- `energy.full_time` was `0` while capped;
- `energy.tick_time` remained a positive countdown while capped;
- Happy `current` equaled Happy `maximum` in this ordinary-Happy sample;
- Happy natural regeneration returned **+5 every 900 seconds**;
- `happy.full_time` was `0` while at ordinary maximum;
- `happy.tick_time` remained a positive countdown while full.

Adapter consequences:

1. `bars.energy.maximum` is supported as the account-specific natural Energy cap in the observed donator-class case.
2. `bars.energy.increment` + `bars.energy.interval` are supported candidates for explicit natural-regeneration timing.
3. A nonzero `tick_time` MUST NOT be interpreted as proof that regeneration will add Energy while already at/above the natural maximum.
4. `full_time == 0` is consistent with already being at the bar maximum in this sample.
5. `bars.happy.maximum` remains the leading candidate for `ordinaryHappy`; this ordinary-state sample is consistent with that mapping but does not by itself prove behavior during elevated temporary Happy.

Outstanding A1 proof:

- optional elevated-Happy specimen where `happy.current > happy.maximum` to prove `happy.maximum` remains the ordinary/base reference during temporary Happy;
- optional visible-page comparison if needed for freshness semantics.

## Run A2 — `/user/cooldowns`

Observed live semantics:

- drug cooldown field returned zero in the sample;
- medical cooldown field returned zero in the sample;
- booster cooldown field returned a positive integer number of seconds;
- the response shape matches the current documented schema.

Adapter consequences:

1. `/user/cooldowns` is live-proven as a direct source for current drug and booster cooldown seconds.
2. A positive booster cooldown is normal state, not evidence that booster use is automatically blocked; planner legality still depends on the separately normalized booster maximum/capacity.
3. The adapter must preserve the raw countdown semantics rather than convert any nonzero booster value into a boolean blocked state.

Outstanding A2 proof:

- booster maximum/capacity does not come from `/user/cooldowns`; source remains to be resolved from verified perks/faction mechanics or another authoritative current source;
- optional visible-page comparison if needed for final LIVE/FRESH classification.

## Run A disposition

**PROVISIONAL PASS sufficient to advance to Run B.**

The critical field shapes and Energy regeneration semantics are live-confirmed. The remaining A items are semantic strengthening rather than blockers for B1/B2/B3. `ordinaryHappy` remains guarded until elevated-Happy confirmation or equivalent stronger evidence.

## Next evidence

Run B:

1. `/user/battlestats` — private values may be pasted in chat; repository stores only schema/semantic conclusions.
2. `/user/gym` — capture active gym ID + name and whether the intended key succeeds.
3. `/torn/gyms` — capture only the active-gym row and reconcile Energy cost + stat modifiers against the calibrated Complete Cardio values.

No adapter, API runtime, UI, storage, timer, DOM, or gameplay implementation is authorized by this evidence.