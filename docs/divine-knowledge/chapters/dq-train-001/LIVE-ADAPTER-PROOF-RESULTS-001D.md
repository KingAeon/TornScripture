# DQ-TRAIN-001D — Live Adapter Proof Results

Status: **RUN A PROVISIONALLY PASSED; RUN B PASSED FOR SCHEMA/SEMANTICS; PERMISSION DETAIL FOLLOW-UP REMAINS; NO RUNTIME IMPLEMENTATION AUTHORIZED**

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

## Run B1 — `/user/battlestats`

The owner supplied a live response in chat. Raw stat values are intentionally not committed.

Observed schema/semantics:

- all four battle-stat objects were present;
- each stat exposed `value`, aggregate `modifier`, and detailed `modifiers[]`;
- one stat carried a nonzero company-derived modifier while the others had no active modifier;
- `total` matched the raw stat-value family rather than requiring the adapter to fold temporary modifier percentages into the trained-stat input.

Adapter consequences:

1. The planner's trained stat `S` should normalize from `battlestats.<stat>.value`, not from a combat-modified effective value.
2. `battlestats.<stat>.modifier` and `modifiers[]` are separate observed combat/stat modifiers and MUST NOT be silently reinterpreted as gym-gain perks.
3. A material modifier string may still matter elsewhere, but it needs independent source classification before entering `gainPerks`.
4. Raw battle-stat values remain private runtime state and stay outside Divine Knowledge.

## Run B2 — `/user/gym`

Live response identified active gym ID **14**, name **Complete Cardio**.

Adapter consequences:

1. `/user/gym` is live-proven to return active gym identity in the expected shape under the owner's current key.
2. The current description-versus-key-parameter permission discrepancy is **not yet resolved as a minimum-permission claim**, because this run did not isolate the exact smallest grant.
3. Active gym identity can join to the public gym catalog by exact numeric ID.

## Run B3 — `/torn/gyms`

The owner supplied the live catalog response. Only the active-gym semantic row is retained here.

For gym ID **14 / Complete Cardio**, live values were:

- class: Middleweight;
- Energy cost: **10**;
- Strength modifier: **5.5**;
- Speed modifier: **5.8**;
- Defense modifier: **5.5**;
- Dexterity modifier: **5.2**;
- note: none.

Cross-check:

- these values exactly match the Complete Cardio inputs used during DQ-TRAIN-001B calibration;
- the API catalog modifiers are already in the planner's familiar dot scale for this observed gym;
- no ten-times conversion is needed for the current `/torn/gyms` response;
- `energy_cost` maps directly to the internal train Energy cost used by the frozen planner.

Adapter consequences:

1. The active-gym join `/user/gym.gym.id -> /torn/gyms[id]` is live-proven for Complete Cardio.
2. The current gym catalog can supply `gym.energyPerTrain` and per-stat `gym.dots` directly for this observed row.
3. Because `/torn/gyms` is officially marked Unstable, any future adapter needs structural validation/schema guarding and must fail closed on a changed shape or missing active row.
4. Specialist-gym notes demonstrate that `note` is semantically material in the catalog and must not be discarded globally, even though Complete Cardio has no note.

## Run B disposition

**PASS for response shape, active-gym join, raw-stat semantics, and Complete Cardio unit normalization.**

Remaining permission detail:

- the minimum exact grant for `/user/gym` remains unresolved because this live run proved success under the current key but did not isolate Public-versus-Minimal behavior;
- this does not block Run C/D, but the permission contract must be resolved before adapter freeze.

## Next evidence

Run C: `/user/perks` training-relevant strings and permission behavior.

Run D: `/user/refills` live response semantics.

After C/D, the adapter source map can be tightened substantially before the planning-inventory pass.
