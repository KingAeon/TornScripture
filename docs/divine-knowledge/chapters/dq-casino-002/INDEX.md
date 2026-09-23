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
split_dealer_resolution = fresh_dealer_per_split_hand
six_card_charlie_precedence = loses_to_blackjack; vs_6CC_high_total_wins
settlement_rounding = UNFROZEN
```

The remaining `UNFROZEN` fields are hard gates for the final Torn rule profile.
`split_dealer_resolution` is now staff-confirmed at the behavioral level, while exact
finite-shoe depletion/reuse across the second split settlement still needs one live
fixture before the split EV implementation is considered exact.

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

**OFFICIAL ADMIN, 2024.** Torn resolves split hands against separate dealer hands.
A player reported that the dealer's visible upcard is restored for the second split
hand while the dealer's remaining cards are re-dealt; Torn admin aurel1 replied that
this is how Torn Blackjack works and had worked that way for nine years.

Source:
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16387030

Therefore the behavioral profile is frozen to **fresh dealer per split hand**, not the
conventional shared-dealer-hand model.

One narrower question remains: exact finite-shoe accounting between the two split
settlements. The visible upcard is reused, so the solver must not assume ordinary
physical-shoe depletion semantics without a current state/log fixture. Track this as
`BJ-V02B`.

## Six-Card Charlie

A non-busted six-card hand must be represented as a distinct terminal state rather
than as an ordinary point total.

**OFFICIAL.** The current Torn Wiki states that a Six-Card Charlie beats every holding
except Blackjack and another Six-Card Charlie; if both sides have a Six-Card Charlie,
the higher total wins. A 2022 admin response separately confirmed that a natural
Blackjack beats a Six-Card Charlie.

Sources:
- https://wiki.torn.com/wiki/Blackjack
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16307168

The terminal precedence is therefore no longer open. Remaining Charlie questions are
limited to split-hand presentation and payout/rounding edge cases.

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

### BJ-V02A — split dealer resolution — RESOLVED

**OFFICIAL ADMIN.** Torn uses a fresh dealer hand for each split hand rather than one
shared dealer result. This behavior was explicitly reported as intended, not a bug, in
March 2024.

Source:
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16387030

### BJ-V02B — split finite-shoe accounting — STILL OPEN

Capture one naturally occurring split through complete settlement and preserve the
visible card sequence.

Resolve:

- which visible cards are removed from the eight-deck composition before the second
  split hand begins;
- whether the repeated dealer upcard is logically reused without a second depletion;
- whether dealer hole/draw cards from the first split settlement affect probabilities
  for the second.

This is now a narrow exactness gate rather than an unknown dealer-resolution model.

### BJ-V03 — split aces

Capture a natural split-aces opportunity.

Resolve:

- Hit control is present after splitting;
- Double availability after split aces;
- Charlie behavior if six cards are somehow reached;
- settlement consistency.

### BJ-V04A — insurance payout/settlement — RESOLVED

**OFFICIAL ADMIN, 2024.** Insurance is a separate side bet paying 2:1. Dealer
Blackjack still loses the main wager. An admin-confirmed example used a half-stake
insurance bet and a 2:1 insurance win.

A 2022 admin response also states that when the insurance bet wins, Torn does not
continue to offer Hit/Stand afterward.

Sources:
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16416107
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16311816

### BJ-V04B — insurance stake control / rounding — STILL OPEN

On a dealer Ace hand, record:
- whether insurance is fixed at 50% of the base wager or configurable up to 50%;
- displayed rounding for wagers that do not divide cleanly.

The 2:1 settlement itself is no longer open.

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
BJ-V01 and BJ-V02B are resolved. BJ-V02A and BJ-V04A are now resolved by admin
evidence. BJ-V03, BJ-V04B, and BJ-V05 may be captured opportunistically but should be
resolved before claiming full Torn-rule fidelity.

Next after live-rule freeze:
- owner review of the CA-01 specification;
- then, if authorized, pure Blackjack Math Engine implementation before HUD/adapters.

## CA-01 evidence deepening — post-PR#120 merge

### BJ-V01 confidence increased, but exact exposure sequence remains the final major gate

Three independent lines now converge on **no initial dealer-Blackjack check**:

1. a 2021 Torn forum post reproduces the then-announced favorable rule set including
   "No dealer blackjack check";
2. current public TornTools-derived Blackjack strategy is explicitly configured with
   dealer peek disabled;
3. a 2025 player report describes Torn allowing Split/Double against a dealer natural
   Blackjack.

Sources:
- https://www.torn.com/forums.php?a=0&b=0&f=15&p=threads&t=16227363
- https://github.com/vagos9821/torn-tools-v/blob/main/extension/scripts/features/blackjack-strategy/ttBlackjackStrategy.js
- https://www.torn.com/forums.php?a=0rh%3D2&b=0&f=2&p=threads&start=20&t=16486332

This is now **HIGH-CONFIDENCE COMMUNITY / CURRENT OBSERVATION**, but not promoted to
OFFICIAL because the 2021 wording is reproduced by a player rather than preserved in
an identified staff post, and Chedburn's 2026 rules summary does not explicitly list
peek behavior.

The remaining live question is therefore narrower than before: not "does Torn look
like a no-peek game?" but **exactly how extra Double/Split exposure is settled when
the dealer ultimately reveals a natural Blackjack**.

Insurance is a special branch: admin evidence confirms that a winning insurance bet
ends the hand rather than allowing Hit/Stand to continue, so the solver must model
insurance acceptance as a possible immediate dealer-Blackjack resolution path.


## Live owner observations — 2026-09-23

Evidence source: owner-supplied TornPDA screenshots from ordinary $10,000 Blackjack
hands. Screenshots remain outside Divine Knowledge; only the nonprivate behavioral
observations are stored here.

### BJ-O01 — per-hand shuffle banner — OBSERVED

Across multiple newly dealt hands, the active Blackjack page visibly displayed
`Decks have been shuffled`.

This independently supports the documented shuffle-every-game rule and reinforces
the decision to exclude cross-hand card counting from the advisor.

### BJ-O02 — Ace-upcard action state — OBSERVED

With dealer Ace showing and player 6 + K = hard 16, the page rendered the normal
Hit/Stand controls plus Insurance/Surrender controls. The player was able to Hit,
drawing a 3 for 19; the dealer later resolved A + 4 + 5 = 20.

This does **not** resolve dealer-natural no-peek exposure because this dealer did not
have Blackjack. It does confirm that the Ace-upcard decision state is represented
before dealer resolution and that the hidden-card slot is present in the UI.

### BJ-V05 — mixed ten-value split eligibility — RESOLVED / OBSERVED

With dealer 3 showing and player K + Q = 20, Torn offered **Split** despite the two
cards having different ranks. The player split them successfully.

Therefore Torn's "equal value" split rule is literal for ten-value cards: mixed
10/J/Q/K combinations may be split when Torn offers the action.

Rule-profile consequence:
`split_equal_value = true` is now supported by both documentation and current live
observation.

### BJ-O03 — split stake equals base stake — OBSERVED

Base wager was $10,000. Immediately after splitting K/Q, the displayed cash balance
fell by an additional $10,000.

Therefore the split action adds one additional base-wager unit for the second hand.

### BJ-O04 — split hand settles independently — OBSERVED CONSISTENT WITH ADMIN RULE

The captured second split branch showed Q + 3 + 8 = 21 against dealer
3 + J + 9 = 22 and displayed `You won $20,000`.

The cash balance moved from $7,176,042 after the split stake was deducted to
$7,196,042 at this settlement, consistent with a $20,000 return on one $10,000 split
hand. Relative to the pre-split-hand bankroll sequence, the screenshots are
consistent with the other split branch having lost, yielding approximately net-zero
for the overall original+split pair.

This is live evidence consistent with the admin-confirmed independent split-hand
settlement model, but the screenshots do not preserve the first dealer branch's full
card sequence. Therefore **BJ-V02B finite-shoe accounting remains open**.

### Evidence status after this batch

Resolved or strengthened:
- shuffle every game: OFFICIAL + OBSERVED;
- mixed ten-value split eligibility: OFFICIAL wording + OBSERVED;
- split adds one full base wager: OBSERVED;
- independent split-hand payout behavior: OFFICIAL ADMIN + OBSERVED consistency.

Still critical:
- `BJ-V01` exact extra-exposure loss when dealer ultimately has a natural Blackjack;
- `BJ-V02B` exact finite-shoe depletion/reuse between split dealer branches.

Secondary:
- split aces controls;
- insurance stake configurability / rounding.


## CA-01 model-discrimination pass — 2026-09-23

Public research was continued specifically against the two remaining hard gates rather
than collecting more generic Blackjack material.

### BJ-V01 — dealer-natural extra-exposure policy

The remaining ambiguity is now represented explicitly as two candidate settlement
policies:

- `OBO` — dealer Blackjack takes the original wager only; optional Double/Split
  exposure is returned/pushed.
- `ENHC_FULL` — dealer Blackjack takes all active exposure, including Double/Split
  additions.

Evidence:

1. **HISTORICAL COMMUNITY (2014):** an old Torn Blackjack guide explicitly states
   "Only original bets are lost on dealer blackjack."
   Source:
   - https://www.torn.com/forums.php?a=0&b=0&f=17&p=threads&t=15927051

2. **CURRENT COMMUNITY OBSERVATION (2025):** a player with real-world dealing
   experience reports Torn currently allows Split/Double before a dealer natural is
   finally resolved. This confirms no-immediate-peek behavior, but does not state what
   happens to the extra stake.
   Source:
   - https://www.torn.com/forums.php?a=0rh%3D2&b=0&f=2&p=threads&start=20&t=16486332

3. **OFFICIAL STAFF EDGE TARGET (2026):** Chedburn reports approximately +0.37%
   perfect-play player edge under Torn's current rules.
   Source:
   - https://www.torn.com/forums.php?a=0rh%3D92&b=0&f=17&p=threads&start=340&t=16486332

4. **EXTERNAL CALCULATOR CAUTION:** Beating Bonuses defines its "Dealer Does Not Peek"
   setting as the European-style case where the full doubled/split bet is lost on
   dealer Blackjack. With the published Torn-like settings (8 decks, S17, DOA, DAS,
   hit split aces, 6-card Charlie, full early surrender, no re-split) its strategy
   calculator reports approximately **+0.38% player edge**.
   Sources:
   - https://www.beatingbonuses.com/houseedge.htm
   - https://www.beatingbonuses.com/bjstrategy.php?decks=8&soft17=stand&doubleon=any2cards&peek=off&das=on&dsa=on&charlie=on&surrender=earlyf&opt=1&btn=Generate+Strategy

5. **EXTERNAL RULE SEMANTICS:** Wizard of Odds distinguishes OBO from full-loss
   no-hole-card treatment; OBO is mathematically equivalent to ordinary peek
   protection for Double/Split exposure, while full-loss no-hole-card treatment is a
   separate player penalty.
   Sources:
   - https://wizardofodds.com/games/australian-blackjack/
   - https://wizardofodds.com/games/blackjack/rule-variations/

**Conclusion:** Chedburn's headline +0.37% benchmark cannot by itself resolve OBO
versus full-loss treatment. A third-party full-loss no-peek calculator lands near the
same aggregate edge once Torn's other favorable rules are included. The 2014 OBO
statement is useful historical evidence but predates the 2021 rules retuning.

Therefore `BJ-V01` remains **TESTING / HIGH-CONFIDENCE NO-PEEK, UNRESOLVED EXPOSURE
SETTLEMENT**. Do not freeze OBO or ENHC_FULL without a current settlement specimen or
authoritative staff statement.

### BJ-V02B — split shoe/card-accounting policy

Three candidate models are now explicit:

- `SPLIT_SHARED_DEPLETION` — all cards exposed in split branch 1 remain removed for
  branch 2; dealer upcard is logically reused once.
- `SPLIT_FRESH_BRANCH_SHOE` — branch 2 is dealt from a newly shuffled eight-deck
  population while preserving the same displayed dealer upcard.
- `SPLIT_HYBRID` — player split cards remain part of one round state, but Torn
  regenerates dealer-side state for each branch with special card-accounting rules.

Evidence:

- **OFFICIAL ADMIN (2024):** Torn intentionally reuses the dealer face-up card but
  deals a new dealer hand for the second split branch.
  Source:
  - https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16387030

- **HISTORICAL COMMUNITY REPORT OF DEV BEHAVIOR (2017):** players reported that the
  shuffle condition was checked when Split was taken and that, if triggered, a new
  second deck could be used during the split. This is pre-2018 and therefore cannot
  be treated as current mechanics, but it proves Torn's split implementation has
  historically had special deck-state behavior rather than being a conventional
  physical-shoe split.
  Source:
  - https://www.torn.com/forums.php?p=threads&t=16012389

- **OFFICIAL PATCH HISTORY:** Blackjack has shuffled after every game since
  2018 and uses eight decks since 2021.
  Source:
  - https://wiki.torn.com/wiki/Black_Jack

- **OWNER LIVE OBSERVATION (2026-09-23):** the second K/Q split branch reused the same
  dealer 3 upcard and independently generated a new dealer draw sequence, matching the
  admin-described behavior. The first branch's full dealer sequence was not captured,
  so depletion across branches remains unobservable from that specimen.

**Conclusion:** `BJ-V02B` remains open, but the uncertainty is now isolated to a
small rule-policy surface. The solver must not bury this in the generic deck class.

### Architecture consequence

Two previously implicit mechanics are promoted to explicit rule-profile enums:

```text
dealer_blackjack_exposure =
  OBO
  | ENHC_FULL
  | UNFROZEN

split_shoe_policy =
  SHARED_DEPLETION
  | FRESH_BRANCH_SHOE
  | HYBRID
  | UNFROZEN
```

This lets deterministic fixtures be written for each candidate mathematical model
without pretending the Torn-specific choice has already been proven.

### Research stop condition for these two gates

Additional generic strategy guides no longer add meaningful evidence.

Close `BJ-V01` only with:
- current live settlement after Double/Split into dealer natural; or
- a current authoritative Torn statement describing extra-bet settlement.

Close `BJ-V02B` only with:
- one complete current split card sequence with both dealer branches; or
- current structured page-state evidence that exposes enough deck/branch state to
  distinguish the models.

Until then, both remain explicit uncertainty rather than guessed constants.


## Uncertainty-envelope pass — 2026-09-23

The remaining unknowns were tested for whether they truly need to block the entire
Blackjack engine or only the states they can influence.

### BJ-V01 is strategy-critical, but localized

The dealer-natural exposure rule matters only when the player creates additional
wager exposure before a possible dealer Blackjack, principally Double and Split
against dealer Ace/10.

Wizard of Odds distinguishes:

- protected/original-bet-only treatment, where optional extra exposure is not lost to
  the dealer natural; and
- European/no-hole-card full-loss treatment, where doubles and splits are also lost.

Wizard explicitly notes that full-loss no-hole-card strategy changes include hitting
11 versus dealer 10 rather than doubling. The current Torn-like Beating Bonuses
full-loss/no-peek profile likewise says **Hit 11 vs 10**.

Sources:
- https://wizardofodds.com/ask-the-wizard/blackjack/no-peek/
- https://wizardofodds.com/games/blackjack/rule-variations/
- https://www.beatingbonuses.com/bjstrategy.php?decks=8&soft17=stand&doubleon=any2cards&peek=off&das=on&dsa=on&charlie=on&surrender=earlyf&opt=1&btn=Generate+Strategy

Therefore `BJ-V01` cannot be hand-waved away as a small EV correction. It can change
the actual optimal action.

However, ordinary Hit/Stand branches do not create extra wager exposure. The unknown
OBO-vs-full-loss policy therefore does not contaminate every Blackjack state.

### BJ-V02B is composition-sensitive, but can be bounded

Assume two candidate second-split models differ only in whether `m` already exposed
cards remain depleted from a remaining population of `N` labeled cards.

The total-variation distance between:

- a uniform draw from all `N` cards, and
- a uniform draw from the `N-m` surviving cards

is exactly:

`TV = m / N`

Aggregating labeled cards into Blackjack ranks can only reduce that distance.

With an eight-deck shoe and at least 400 cards still in the relevant population, the
next-card distribution therefore differs by no more than:

| Differently treated cards | Maximum TV distance |
| ---: | ---: |
| 1 | 0.25% |
| 3 | 0.75% |
| 4 | 1.00% |
| 6 | 1.50% |
| 8 | 2.00% |
| 10 | 2.50% |

This is a distribution bound, not a claim about Torn's actual split implementation.

The effect is small but not safely ignorable. Wizard of Odds gives a concrete
eight-deck example where accounting for only three removed cards is enough to change
the preferred play on a 16-vs-10 boundary. Its general effect-of-removal analysis
likewise shows that individual removed ranks measurably move Blackjack EV.

Sources:
- https://wizardofodds.com/ask-the-wizard/blackjack/card-counting/
- https://wizardofodds.com/games/blackjack/effect-of-removal/

Therefore `BJ-V02B` matters for exact composition-dependent advice, especially near
decision boundaries, but it does **not** need to block the entire solver.

### Proposed uncertainty-aware solver contract

The pure engine should support evaluating more than one rule profile for the same
visible state:

```text
RuleEnvelopeAnalysis
  candidate_profiles[]
  per_profile[action].ev_net
  ev_interval[action] = [minimum, maximum]
  robust_best_action
  disagreement
  unresolved_rules[]
  provenance[]
```

A recommendation is **robust** only if every currently plausible rule profile selects
the same best available action.

If profiles disagree, the advisor must not collapse the result into a fake certainty.
It should instead surface something like:

```text
11 vs dealer 10

OBO model ........ DOUBLE
Full-loss model .. HIT

TORN RULE UNRESOLVED
No single verified recommendation yet.
```

For second split branches, the engine can evaluate the known endpoints and, where the
uncertainty is simply which first-branch cards remain depleted, enumerate the feasible
restore/deplete subsets. If every plausible composition yields the same best action,
the recommendation is robust despite `BJ-V02B` remaining unknown.

### Gate reclassification proposal

**BJ-V01**
- remains a hard gate for claiming a single verified Torn recommendation in affected
  Double/Split vs Ace/10 states;
- does not block math-engine architecture, ordinary Hit/Stand states, or a
  parameterized solver.

**BJ-V02B**
- should be downgraded from "blocks the Blackjack engine" to "blocks exact verified
  second-split composition EV when candidate models disagree";
- does not affect unsplit hands at all;
- can be safely handled by an uncertainty envelope plus fail-closed disagreement
  behavior.

### CA-01 specification maturity

At this point, no unresolved mechanic requires us to guess inside the pure engine.
Both remaining uncertainties have explicit parameters, evidence states, and safe
failure behavior.

Therefore CA-01 is now **specification-ready for owner review** even though the final
single Torn rule profile is not fully frozen.

Implementation remains unauthorized until owner review/approval. If authorized, the
first implementation unit should be the pure, parameterized Blackjack Math Engine
with deterministic tests; active-page adapter and HUD come afterward.
