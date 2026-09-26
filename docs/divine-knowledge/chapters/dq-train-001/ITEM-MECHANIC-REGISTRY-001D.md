# DQ-TRAIN-001D — v0.1 Training Item Mechanic Registry Candidate

Status: **V0.1 MECHANIC SUBSET VERIFICATION-READY CANDIDATE; OWNER FREEZE PENDING; RUNTIME IMPLEMENTATION NOT AUTHORIZED**

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
- drug cooldown: documented conservative envelope 200–231 minutes
- type: Drug

Planner boundary:

- overdose remains a separate adverse outcome with no invented probability;
- Ecstasy is an action after the required observed drug-cooldown checkpoint;
- quarter-hour Happy-reset timing remains a separate readiness concern;
- current Torn Wiki sources are internally inconsistent at the upper endpoint: the item-specific Ecstasy page says 200–231 minutes while the generic Drugs table says 200–230. v0.1 records the conservative 200–231 documented envelope and does not use either value as an exact future cooldown.

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

## Dynamic item modifiers — v0.1 frozen subset

Current mechanics can modify Candy Happy, consumable cooldown, eDVD Happy, and maximum booster cooldown through faction/company/book/event effects.

**v0.1 deliberately does not numerically model those dynamic item modifiers.**

Supported in v0.1:

- base Candy Happy values from the registry;
- base Candy booster cooldown of 30 minutes;
- base eDVD +2,500 Happy / +6h booster cooldown;
- base Xanax and Ecstasy success-path effects;
- base maximum booster cooldown of 24 hours **only when a complete verified perk set contains no material booster-maximum modifier**.

Not numerically supported in v0.1:

- faction Candy-effect bonuses;
- Grocery Store Absorption;
- Grocery/Restaurant consumable-cooldown reductions;
- Yes Please Diabetes;
- Self Control Is For Losers;
- World Diabetes Day;
- eDVD company specials;
- faction maximum-booster-cooldown additions;
- any other item/booster/drug/Happy modifier not explicitly frozen elsewhere.

Fail-closed rule:

1. begin from base mechanics only;
2. inspect the complete verified perk/effect state;
3. if a potentially material string/effect mentions Candy, booster cooldown, consumable cooldown, eDVD, Happy-item effect, drug effect, or another preparation mechanic not frozen here, mark the affected preparation capability unsupported;
4. do **not** assume the modifier is zero and do **not** attempt generic percentage parsing.

The owner's current live `/user/perks` sample contained no such item-preparation modifier, so base mechanics are valid for the observed account state.

## Booster maximum

Official current mechanics give a base maximum booster cooldown of 24 hours, while faction Voracity may extend it by up to another 24 hours.

v0.1 normalization is intentionally conservative:

- if the complete verified perk/effect state contains no material maximum-booster-cooldown modifier, derive `boosterMaxSeconds = 86400`;
- if any maximum-booster-cooldown modifier is present, `boosterMaxSeconds` is unknown/unsupported in v0.1 and booster-preparation planning fails closed;
- `/user/cooldowns.booster` remains the independent observed current countdown.

This avoids inventing a parser from an unobserved positive specimen while still supporting ordinary accounts/factions safely.

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

## Frozen v0.1 boundary

The v0.1 specification supports the base mechanics above and intentionally fails closed when a dynamic item-preparation modifier is detected.

Remaining work before adapter implementation:

1. verify synthetic, nonprivate registry fixtures;
2. verify the complete PR #124 documentation diff;
3. obtain explicit owner build authorization for adapters.

No runtime implementation is authorized by this specification freeze.
