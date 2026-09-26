# DQ-TRAIN-001D — v0.1 Training Item Mechanic Registry Candidate

Status: **DISCOVERY CANDIDATE; BASE MECHANICS SOURCED; DYNAMIC MODIFIER APPLICATION NOT YET FROZEN**

Prepared: 2026-09-26

Purpose: define the smallest explicit mechanic set the Training Advisor needs for v0.1 without parsing free-text item descriptions at runtime.

## Source posture

Primary current mechanic sources checked 2026-09-26:

- Torn Wiki — Xanax
- Torn Wiki — Ecstasy
- Torn Wiki — Erotic DVD
- Torn Wiki — Candy
- Torn Wiki — Item Cooldowns
- Torn Wiki — Energy
- Torn Wiki — Faction/Voracity

Stable item IDs for the owner's currently observed training inventory were also live-confirmed from `/user/inventory`. Exact private quantities are not retained here.

The registry stores **base mechanics**. Account-specific faction/company/book/event modifiers remain separate normalized state and MUST NOT be baked into item constants.

## Core drug mechanics

### Xanax — item 206

Base supported success-path effects:

- Energy: +250
- Happy: +75
- drug cooldown: random 360–480 minutes
- type: Drug

Planner boundary:

- overdose is a separate adverse outcome and is not assigned an invented probability;
- the registry MUST NOT collapse the 360–480 minute cooldown range to a fabricated exact value;
- a plan may use an already observed current drug cooldown;
- future multi-Xanax timing remains checkpoint/replan based unless an exact post-use cooldown is observed;
- any strategy requiring an exact future Xanax cooldown must abstain rather than substitute a midpoint.

### Ecstasy — item 197

Base supported success-path effects:

- Happy multiplier: ×2
- drug cooldown: random 200–231 minutes
- type: Drug

Planner boundary:

- overdose remains a separate adverse outcome with no invented probability;
- Ecstasy is an action after the required observed drug-cooldown checkpoint;
- quarter-hour Happy-reset timing remains a separate readiness concern.

## Core booster mechanic

### Erotic DVD — item 366

Base effect:

- Happy: +2,500
- booster cooldown added: 6 hours
- type: Booster

Dynamic modifiers:

- account/company specials may modify eDVD Happy in specific supported contexts;
- such modifiers must come from explicit recognized state, never from an assumed global multiplier.

## Candy base mechanics

All current Candy items use a base booster-cooldown addition of 30 minutes before account-specific consumable-cooldown modifiers.

Live-observed current inventory IDs plus current official base Happy:

| Item ID | Item | Base Happy | Base booster cooldown |
|---:|---|---:|---:|
| 37 | Bag of Bon Bons | 25 | 30m |
| 527 | Bag of Candy Kisses | 50 | 30m |
| 210 | Bag of Chocolate Kisses | 25 | 30m |
| 528 | Bag of Tootsie Rolls | 75 | 30m |
| 36 | Big Box of Chocolate Bars | 35 | 30m |
| 1028 | Birthday Cupcake | 250 | 30m |
| 35 | Box of Chocolate Bars | 25 | 30m |
| 39 | Box of Extra Strong Mints | 25 | 30m |
| 209 | Box of Sweet Hearts | 25 | 30m |
| 310 | Lollipop | 25 | 30m |
| 634 | Bag of Bloody Eyeballs | 75 | 30m |

The registry is intentionally not limited to items currently owned. Additional Candy IDs may be added from the same authoritative table when they become relevant to candidate generation.

## Candy modifiers

Current official mechanics permit Candy Happy to be modified by:

- faction Candy-effect upgrades;
- Grocery Store Absorption;
- the Yes Please Diabetes book;
- World Diabetes Day.

Consumable cooldown can also be modified by applicable company specials and the Self Control Is For Losers book.

These are **dynamic account/event state**, not item constants.

Runtime rule candidate:

1. begin from base Happy and base cooldown;
2. apply only explicitly recognized active modifiers with recorded provenance;
3. preserve the documented rounding order where frozen;
4. if a potentially material candy/cooldown modifier is present but unrecognized, mark affected Happy-prep planning unsupported rather than assuming zero.

The owner's current `/user/perks` sample contained no candy-effect, consumable-cooldown, active-book, or other training-special string, so the current observed account does not require such a modifier to explain the captured state.

## Booster maximum

Official current mechanics:

- base maximum booster cooldown: 24 hours;
- faction Voracity can add up to +24 hours, one hour per upgrade.

The current `/user/cooldowns` endpoint provides the present booster countdown but not the maximum.

Candidate source for account-specific maximum:

- recognized `/user/perks` faction string of the form `+ N hours maximum booster cooldown`, when present;
- base 24h only when the complete verified perk set proves no applicable maximum-booster-cooldown modifier.

This mapping still needs a live positive specimen or an independently frozen parser fixture before generic faction-shareable use.

## Inventory identity

The current live Drug/Candy/Booster category proof establishes:

- inventory item IDs are stable normalization keys;
- category snapshots are timestamped independently;
- complete pagination is required before absence may mean zero;
- inventory rows do not supply trusted training mechanics by themselves.

Therefore the planner joins:

```text
inventory item ID + amount
        |
        +--> versioned mechanic registry
        |
        +--> current MarketSnapshot
```

Inventory never becomes the mechanic source.

## Freeze blockers

Before this candidate becomes frozen adapter input:

1. resolve `/user/refills.energy` boolean polarity;
2. freeze recognized perk patterns for booster maximum and Candy modifiers, including fail-closed behavior;
3. decide whether v0.1 supports only base/currently observed candy modifiers or broader faction/company/book/event modifiers;
4. write synthetic, nonprivate registry fixtures;
5. verify the fixture parser independently.

No runtime implementation is authorized by this candidate.
