# DQ-TRAIN-001D — Live Adapter Proof Results

Status: **RUN A PROVISIONALLY PASSED; RUN B PASSED; RUN C PERK NORMALIZATION PASSED FOR CURRENT TRAINING MODIFIERS; RUN D SHAPE PASSED WITH BOOLEAN POLARITY FOLLOW-UP; NO RUNTIME IMPLEMENTATION AUTHORIZED**

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


## Run C — `/user/perks`

The owner supplied the live perks response. Raw unrelated perk lists are not retained as product state; only training-relevant semantic conclusions are recorded.

Training-relevant current strings:

- Faction: **+7% Strength gym gains**;
- Faction: **+7% Speed gym gains**;
- Faction: **+6% Defense gym gains**;
- Faction: **+6% Dexterity gym gains**;
- Property: **+2% gym gains**;
- Job: **+25% passive Dexterity**.

Classification:

- the four faction gym-gain strings are `SUPPORTED_NUMERIC_GAIN`, stat-scoped;
- the property +2% gym-gain string is `SUPPORTED_NUMERIC_GAIN`, all-stat scoped;
- the passive Dexterity job string is **not a gym-gain modifier** and must not enter the planner's `gainPerks`; it is independently visible in battlestats as a combat/stat modifier;
- current education/enhancer/merit strings are unrelated to supported gym-gain arithmetic;
- current book and stock arrays were empty;
- no active perk string in this sample advertised a Happy-loss, booster-cooldown, candy-effect, drug-effect, or Energy-training special.

Cross-check with calibration:

- the +2% property and +7/+7/+6/+6 faction gym-gain values exactly match the modifier inputs used in DQ-TRAIN-001B observed calibration;
- the adapter can therefore construct the current supported gain-perk set from these specifically recognized strings without inferring from battlestats combat modifiers.

Parser consequence:

A future adapter should use a small explicit recognized-pattern registry for supported training strings, not a generic "find any percentage" parser. Unknown potentially material training strings must fail closed or downgrade the affected capability.

Permission consequence:

The current key successfully returned `/user/perks`, but this does not resolve the official description-versus-key-parameter Minimal/Public mismatch as a least-privilege claim.

## Run D — `/user/refills`

The owner supplied a live response with boolean fields for Energy, nerve and token plus integer `special_count`. All three booleans were false and the special count was zero in this sample.

Current official OpenAPI 6.13.6 documents `/user/refills` as Minimal + Stable and confirms these field types, but does not describe the boolean polarity.

Historical API context matters: the previous v1 shape used names such as `energy_refill_used`, and Torn's 2025 v2 refactor announcement described the refills change as field renaming. Therefore the adapter MUST NOT prematurely interpret `energy:false` as "refill unavailable." A plausible continuity interpretation is "not used", which would imply the opposite.

Run D disposition:

- response shape and source are live-proven;
- boolean polarity remains a bounded semantic follow-up before adapter freeze;
- until resolved, `refills.energy` must not be mapped directly to `pointRefill.allowed`.

A controlled proof can resolve this cheaply by comparing the API field with the visible Points refill state before and after a routine daily refill, without purchasing an extra refill solely for testing.

## Next evidence — planning inventory

Use `GET /user/inventory` with category filters:

1. `cat=Drug` for Xanax/Ecstasy;
2. `cat=Booster` for Erotic DVD and other booster-class training items;
3. `cat=Candy` for supported candy candidates.

The current OpenAPI inventory category enum explicitly includes Drug, Booster and Candy. Each category is cached for one hour, so this evidence is planning-only by design.

For repository evidence retain only category, inventory timestamp, and whether required training-item IDs/amounts can be normalized. Raw full inventory contents remain private.
