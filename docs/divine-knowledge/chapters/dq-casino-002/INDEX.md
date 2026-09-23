# DQ-CASINO-002 — CA-01 Blackjack Specification and Live Rule Freeze

State: **SPECIFICATION PREP / LIVE RULE GATES**

Parent research:
- `../dq-casino-001/INDEX.md`

Working product:
- **TornScriptures Casino Advisor**
- First game module: **Blackjack**

## Why CA-01 starts here

CA-00 ranked Blackjack as the first specification candidate because the current rule
set is unusually well documented, the action space is finite, public active-page
state is rich, and the solver can be validated against independent mathematical
benchmarks before any HUD is trusted.

This chapter does **not** authorize product code. It freezes the intended mathematical
contract as far as current evidence permits and isolates the remaining Torn-specific
live-rule gates.

## Current evidence baseline — rechecked 2026-09-22

### Torn staff rule set

**OFFICIAL STAFF.** Chedburn's January 2026 statement lists:

- eight decks;
- dealer stands on soft 17;
- early surrender;
- hit after split aces;
- double after split;
- double on any two cards;
- Blackjack pays 3:2;
- Six-Card Charlie;
- one split only / no re-split.

Chedburn also stated that Michael Shackleford was consulted in 2021 and paraphrased
the resulting perfect-play estimate as approximately **+0.37% player edge**.

Source:
- https://www.torn.com/forums.php?p=threads&t=16486332

This value is a validation target, not an axiom.

### Independent strategy benchmark

A current Beating Bonuses strategy calculator configured for:

- 8 decks;
- S17;
- dealer does not peek;
- full early surrender;
- double any two;
- double after split;
- hit split aces;
- Six-Card Charlie;
- no re-split;

reports approximately **-0.38% house edge**, i.e. about **+0.38% player edge**.

Source:
- https://www.beatingbonuses.com/bjstrategy.php?btn=Generate+Strategy&charlie=on&das=on&decks=8&doubleon=any2cards&dsa=on&opt=1&peek=off&soft17=stand&surrender=earlyf

The close agreement with Chedburn's +0.37% estimate is encouraging but does not prove
that every Torn settlement detail matches the calculator's model.

### External dealer-probability reference

Wizard of Odds publishes exact dealer terminal distributions for eight-deck S17
Blackjack and separately distinguishes checked-hole-card and no-hole-card rules.

Sources:
- https://wizardofodds.com/games/blackjack/dealer-odds-blackjack-us-rules/
- https://wizardofodds.com/games/blackjack/expected-values/
- https://wizardofodds.com/games/blackjack/appendix/9/euro-8ds17r4/

These references give deterministic fixtures for our dealer recursion, but the correct
fixture family depends on Torn's current dealer-blackjack handling.

## Rule profile candidate

The solver should use an explicit serializable rule profile rather than burying Torn
rules in conditionals.

Candidate profile:

```text
decks = 8
shuffle = every_game
dealer_soft_17 = stand
blackjack_payout_net = 1.5
surrender = early
double = any_initial_two
double_after_split = true
split_limit = 1
split_aces_hit = true
split_equal_value = true
six_card_charlie = true
insurance = offered_vs_ace
insurance_payout = 2_to_1
dealer_blackjack_resolution = UNFROZEN
split_dealer_resolution = UNFROZEN
settlement_rounding = UNFROZEN
```

The three `UNFROZEN` fields are hard gates for the final Torn rule profile.

## Card model

Blackjack does not require suits for strategy. The math core can represent the
fresh eight-deck shoe as value counts:

- A: 32
- 2 through 9: 32 each
- ten-value cards: 128

Total: 416 cards.

Because Torn is documented as shuffling after every game, cross-hand card counting is
not part of the design. **Within the current game**, already visible cards still change
the exact finite-shoe probabilities and should be removed from the local model.

For any remaining value `r`:

`P(next = r) = count[r] / remaining_cards`

Composition-dependent decisions are therefore possible without retaining state across
games.

## Hand evaluator

The pure math engine must derive, for any ordered or unordered card multiset:

- hard total;
- best total <= 21 when an Ace can remain soft;
- soft/hard flag;
- bust state;
- natural Blackjack state;
- card count;
- Six-Card Charlie eligibility;
- pair / split eligibility under Torn's equal-value rule.

Ten, Jack, Queen, and King share Blackjack value 10. If current Torn permits splitting
any equal-value ten-card combination, the engine should obey the action availability
reported by Torn rather than assume exact-rank equality.

## Solver state

A solver input should be serializable and independent of the DOM:

```text
BlackjackState
  rule_profile
  remaining_counts
  dealer_upcard
  player_hands[]
  active_hand_index
  original_wager_units
  per_hand_wager_units[]
  available_actions[]
  insurance_state
  phase
  provenance
```

The active-page adapter may populate this state, but the math engine itself must not
know about selectors, network requests, TornPDA, or storage.

## Action EV contract

All action values should be returned in **net expected wager units** relative to the
original base wager, not gross payout.

Candidate result:

```text
ActionAnalysis
  action
  ev_net
  win_probability
  push_probability
  loss_probability
  assumptions[]
  evidence_status
  available
```

The advisor may rank available actions by EV and explain the difference, but it must
never click an action.

### Stand

For a terminal player total `t`, Stand EV is the probability-weighted settlement
against the dealer terminal distribution, with Blackjack/Charlie precedence handled
by the rule profile.

### Hit

For every possible next rank:

`EV_hit = sum_r P(r) * EV(state_after_draw_r)`

Terminal branches include bust, Charlie, and ordinary standing/continuation states.

### Double

If Double is legal, exactly one card is drawn and the hand then resolves as a doubled
wager:

`EV_double = sum_r P(r) * settlement_after_one_draw_and_stand(r)`

The dealer-blackjack loss rule must be parameterized because European/no-peek
settlement can make the player lose either all increased exposure or only the
original wager depending on implementation.

### Surrender

For standard half-loss settlement:

`EV_surrender = -0.5`

Early-surrender availability must come from the current state/action contract rather
than from dealer upcard alone.

### Insurance

If insurance stake is one-half base wager and pays 2:1, and `p` is the probability
the dealer has Blackjack under the verified Torn dealer-card model:

`EV_insurance = 0.5 * (2p - (1-p)) = 0.5 * (3p - 1)`

Break-even is therefore `p = 1/3`.

This formula must not be enabled until the exact Torn insurance/dealer-blackjack
sequence is live-verified.

### Split

Split is the most rule-sensitive branch.

The solver must support:

- exactly one split;
- shared finite-shoe depletion across both resulting hands;
- hit after split aces;
- double after split;
- no re-split;
- action availability returned by Torn;
- configurable dealer resolution model.

Two candidate dealer-resolution models must remain separate until live verification:

1. **shared dealer hand** — conventional settlement: one dealer result resolves both
   player hands;
2. **fresh dealer per split hand** — reported by some Torn players and materially
   different mathematically.

The solver must not approximate one model with the other.

## Six-Card Charlie

A non-busted six-card hand must be represented as a distinct terminal state rather
than as an ordinary point total.

Open settlement questions include:

- exact precedence against dealer natural Blackjack;
- whether dealer Charlie is independently possible/relevant;
- split-hand Charlie behavior;
- payout/rounding edge cases.

Current Torn documentation and staff statements make Charlie itself official, but the
solver should retain explicit terminal precedence instead of assuming generic casino
behavior.

## Active-page adapter candidate

Current public TornTools-derived code observes the active Blackjack page's already
occurring `sid=blackjackData` response and has seen fields including:

- `DB.result`;
- `dealer.hand`;
- `player.hand`;
- `player.score`;
- `player.lowestScore`;
- `availableActions`.

Source:
- https://github.com/vagos9821/torn-tools-v/blob/main/extension/scripts/features/blackjack-strategy/ttBlackjackStrategy.js

This is **COMMUNITY / MUTABLE** evidence.

Adapter preference remains:

1. already-delivered structured state on the actively viewed page;
2. stable semantic DOM;
3. structural/text fallback;
4. hashed CSS only as a last-resort compatibility probe.

The adapter must not issue an extra Torn request to acquire game state.

## Live rule gates before profile freeze

### BJ-V01 — dealer Blackjack sequence

Capture an ordinary hand with dealer Ace or ten where insurance/surrender/check
ordering is visible.

Resolve:

- is a hole card already present?
- does the dealer peek/check before player action?
- can early surrender occur before dealer Blackjack resolution?
- if the player doubles/splits before a dealer Blackjack is revealed, how much
  exposure is lost?

### BJ-V02 — split dealer resolution

Capture one naturally occurring split through complete settlement.

Resolve:

- does one dealer hand settle both player hands?
- or is a new dealer hand generated/resolved for each split hand?

This is a hard mathematical gate.

### BJ-V03 — split aces

Capture a natural split-aces opportunity.

Resolve:

- Hit control is present after splitting;
- Double availability after split aces;
- Charlie behavior if six cards are somehow reached;
- settlement consistency.

### BJ-V04 — insurance arithmetic

On a dealer Ace hand, record:

- base wager;
- insurance stake;
- displayed settlement on dealer Blackjack and non-Blackjack.

Resolve exact wager ratio and rounding.

### BJ-V05 — ten-value split eligibility

If a mixed ten-value opening hand such as 10/J or Q/K naturally appears, observe
whether Torn offers Split.

This confirms whether the official "equal value" wording is literal in the current UI.

## Validation fixtures

Before any HUD recommendation is considered trustworthy, the pure solver should pass:

1. **Dealer recursion fixtures**
   - reproduce published eight-deck S17 dealer distributions for the matching
     dealer-card model to tight numerical tolerance.

2. **Strategy-grid fixtures**
   - reproduce the Beating Bonuses action table for the exact matching candidate
     profile wherever the state assumptions align.

3. **Global edge fixture**
   - simulate/enumerate the initial-hand distribution and reproduce the external
     approximately +0.38% player edge and staff-attributed +0.37% target closely
     enough to explain any residual difference.

4. **Invariant fixtures**
   - surrender EV exactly -0.5 when available;
   - insurance break-even at dealer-Blackjack probability 1/3 under standard 2:1,
     half-bet insurance;
   - probabilities sum to 1 within floating-point tolerance;
   - unavailable actions never receive recommendations;
   - removed-card counts never become negative.

5. **Torn-specific live fixtures**
   - each BJ-V01 through BJ-V05 observation becomes a nonprivate deterministic test
     fixture once verified.

## Proposed advisor surface

The first Blackjack HUD should remain compact:

```text
BLACKJACK
You: 16
Dealer: 10

HIT        EV -0.539   <- best
STAND      EV -0.575
SURRENDER  unavailable

Difference: +0.036 wager units
Rules: Torn profile / verified
```

Advanced expansion may show:

- exact hand composition;
- action probabilities;
- rule assumptions;
- provenance;
- solver confidence;
- why a generic strategy chart differs.

No automation control belongs in the module.

## CA-01 stop line

We may continue refining the pure specification and gathering deterministic external
fixtures now.

We should **not freeze the final Torn rule profile or authorize implementation** until
BJ-V01 and BJ-V02 are resolved. BJ-V03–V05 may be captured opportunistically but
should be resolved before claiming full Torn-rule fidelity.

Next after live-rule freeze:
- owner review of the CA-01 specification;
- then, if authorized, pure Blackjack Math Engine implementation before HUD/adapters.
