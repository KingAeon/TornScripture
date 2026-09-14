# DQ-TRAIN-001 — Battle-Stat Training and Happy Jump Optimization

State: **ACTIVE RESEARCH SCOPING**

## Discovery question

How can TornScriptures accurately predict and optimize battle-stat training for a
specific player, including Happy Jumps and alternative strategies, while remaining
newbie-friendly, faction-shareable, transparent, and advisory?

## Owner-approved outcome

The desired product should answer:

> Given this player's current state, inventory, budget, available gym, perks, and
> activity window, what should they do next, why, and what improvement should they
> expect now and over time?

The beginner surface should reduce the answer to a safe next-action sequence.
An advanced surface may expose formulas, costs, assumptions, alternatives,
sensitivity, and prediction error.

Working label: **TornScriptures Training Advisor**, with **Happy Jump Navigator**
as its first major feature. These labels are not yet a locked branding decision.

## Preliminary research snapshot

The following are research leads captured from the 2026-09-14 discussion. They
must be rechecked and validated before becoming an implementation baseline.

### Gym-gain model candidate

The Torn Wiki currently cited this public model:

[
Gain = M \times G \times E \times [(a\ln(H+250)+c)S+d(H+250)+e]
]

Where the discussion interpreted:

- (M): applicable training modifiers;
- (G): gym dots for the trained stat;
- (E): energy spent;
- (H): Happy before the train;
- (S): the individual battle stat being trained, not combined battle-stat total.

Captured constants:

- (a = 3.480061091 \times 10^{-7})
- (c = 3.091619094 \times 10^{-6})
- (d = 6.82775184551527 \times 10^{-5})
- (e = -0.0301431777)

Candidate source: [Torn Wiki — Gym](https://wiki.torn.com/wiki/Gym)

The Happy term appears to have positive but diminishing marginal returns under
this candidate equation. Therefore maximum Happy, maximum immediate gain,
best gain per dollar, best gain per cooldown hour, and best long-term outcome
are separate optimization objectives.

### Consumable model candidates

- Ecstasy is expected to double current Happy, subject to current game limits and
  mechanics.
- Candy contributes Happy before Ecstasy and ordinarily competes for booster
  cooldown slots.
- Item-level modifier rounding may matter and must not be approximated by simply
  multiplying the final candy total.
- Higher-Happy candy can improve Happy per cooldown while cheap candy can improve
  Happy per dollar; live price and owned-inventory context decide which matters.
- Natural energy lost while stacking may change whether one large jump or several
  micro-jumps is superior.

Candidate sources:

- [Torn Wiki — Happy](https://wiki.torn.com/wiki/Happy)
- [Torn Wiki — Candy](https://wiki.torn.com/wiki/Candy)
- [Torn Wiki — Ecstasy](https://wiki.torn.com/wiki/Ecstasy)
- [Torn Wiki — Battle Stat](https://wiki.torn.com/wiki/Battle_Stat)
- [Community formula investigation](https://www.torn.com/forums.php?a=0&b=0&f=61&p=threads&t=16003284)
- [2026 community jump-strategy discussion](https://www.torn.com/forums.php?a=0&b=0&f=61&p=threads&t=16578875)

### Data and scripting candidates

Research indicated that Torn API v2 may expose inventory and gym-related data
suitable for a read-only advisor, but permissions, cache timing, response shape,
and current endpoint status are mutable and require live contract verification.

The eventual advisor must comply with current Torn scripting rules. Calculations,
API-backed state, page-visible information, timers, warnings, and recommendations
are the intended green zone. Any control that directly performs a Torn gameplay
request requires separate rule verification and owner specification.

Candidate sources:

- [Torn API changelog discussion](https://www.torn.com/forums.php?a=0&b=0&f=63&p=threads&t=16401584)
- [Torn scripting clarification](https://www.torn.com/forums.php?a=0&b=0&f=1&p=threads&t=16534470)
- Canonical local registry: `docs/discovery/TORN-CAPABILITY-REGISTRY.md`

## Research tracks

1. **Formula fidelity**
   - Verify the current official/public gym formula and constants.
   - Establish whether (S) is the trained stat and how gym dots and modifiers
     enter the equation.
   - Determine exact rounding and precision at each stage.
   - Determine whether batch training differs from repeated single trains.

2. **Modifier ordering**
   - Map property, faction, education, company, merit, book, event, gym, and other
     relevant modifiers.
   - Separate Happy modifiers, energy modifiers, gym multipliers, and final gain
     multipliers.
   - Record caps, exclusions, stacking order, and rounding.

3. **Strategy universe**
   - Ordinary natural-energy training.
   - Candy plus Ecstasy jumps.
   - Xanax-backed jumps and energy stacking.
   - eDVD and other Happy sources.
   - Short micro-jumps versus long stacks.
   - Refills and other player-selected resources where relevant.
   - Stat-balancing versus single-stat optimization.

4. **Economics and objectives**
   - Immediate stat gain.
   - Gain per energy, dollar, booster cooldown, drug cooldown, and active minute.
   - Opportunity cost from blocked natural regeneration or delayed training.
   - Projected 30/90/180-day outcome using sequentially updated stats.
   - Budget caps and owned-inventory substitution.
   - Sensitivity to price uncertainty and activity schedule.

5. **Live data contract**
   - Minimum Torn API permissions.
   - Inventory-category coverage and cache behavior.
   - Gym, battle-stat, energy, Happy, cooldown, perk, and property availability.
   - Page-visible fallback data and stale-data labeling.
   - Browser-local persistence without credential or private-data leakage.

6. **Player experience**
   - Beginner next-action card.
   - Readiness states such as waiting, stacking, consuming, training, complete,
     unsafe, and stale.
   - Quarter-hour Happy-reset and cooldown warnings.
   - Advanced explanation and comparison view.
   - TornPDA/Android touch and narrow-screen behavior.
   - Accessible language that teaches without overwhelming.

## Required validation before implementation

- Every implemented mechanic has current provenance and a checked date.
- Formula output is reproduced independently for deterministic fixtures.
- Exact rounding and modifier order are either proven or visibly marked uncertain.
- Predicted gains are compared with controlled real observations.
- Error is recorded; the UI does not display false precision.
- Mutable prices and player state are not hardcoded into the knowledge layer.
- The advisor remains read-only/advisory unless a later owner-approved
  specification explicitly validates a user-triggered action.
- No API key, session data, personal inventory, or private player export is
  committed.

## First specification candidate

A pure Training Math Engine should precede UI work. It should accept explicit,
serializable inputs and return predicted gains, resource usage, uncertainty,
and comparable strategies without DOM access, storage mutation, network access,
or gameplay actions.

This is a candidate direction, not implementation authorization. Scope, inputs,
rounding behavior, fixtures, and acceptance thresholds must be frozen in the
Specification mode before product code changes.
