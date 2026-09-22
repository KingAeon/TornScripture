# DQ-CASINO-001 — Casino Analysis Engine Research

State: **ACTIVE RESEARCH GATHERING**

Working product label: **TornScriptures Casino Advisor**

## Discovery question

How can TornScriptures provide mathematically rigorous, transparent decision support
across Torn's casino games using only authorized API data and information on the page
the player is actively viewing, while keeping every wager and gameplay action under
human control?

## Owner-approved direction

Research every applicable casino game rather than stopping at Blackjack and Poker.
Start with a shallow evidence sweep across the casino, record official mechanics,
derived formulas, community claims, unknowns, and falsification tests, then choose the
implementation order from evidence.

The eventual product should be one installed Casino Advisor userscript with isolated
game modules and shared mathematical infrastructure.

## Evidence model

Use these statuses on substantive casino claims:

- **OFFICIAL**
- **DERIVED**
- **OBSERVED**
- **COMMUNITY**
- **TESTING**
- **REJECTED**

A community claim does not become a fact through repetition. Unknown Torn-specific
mechanics must remain visible as unknown until official evidence or controlled
observation resolves them.

## Scripting boundary — current official baseline

**OFFICIAL, rechecked 2026-09-22.** Torn's January 2026 scripting clarification says
software may rely on Torn API data or data from a page the player manually loaded and
is actively viewing. It may not make additional non-API Torn requests, scrape pages
not actively viewed, bypass CAPTCHA, or extract data from unfocused pages to send
elsewhere, generate alerts, or draw attention.

Source:
- https://www.torn.com/forums.php?a=0&b=0&f=1&p=threads&t=16534470

Therefore the candidate architecture remains:

`actively viewed casino page / authorized API -> local parser -> local math -> HUD -> human action`

No automatic betting, Hit/Stand, Call/Fold, spin, roll, shot, or unattended play is
part of this research track.

## Shallow casino survey — 2026-09-22

### Blackjack

**OFFICIAL.** Torn currently documents eight decks shuffled together; a shuffle after
every game; dealer stands on soft 17; double on any initial deal; split equal-value
initial cards including aces; double after split; no re-splitting; surrender returns
half the original bet; insurance against a dealer Ace pays 2:1; natural Blackjack
pays 2.5x the original bet; and Six-Card Charlie beats everything except Blackjack
and another Six-Card Charlie.

Source:
- https://wiki.torn.com/wiki/Blackjack

**Research value:** very high. A Torn-specific exact EV engine is preferable to a
generic basic-strategy chart.

**OFFICIAL staff clarification, 2026-01-06.** Chedburn separately stated Torn's
current Blackjack rules as: eight decks, dealer stands soft 17, **early surrender**,
**hit after split aces**, double after split, double any two cards, Blackjack pays
3:2, Six-Card Charlie, and one split only. He said Torn consulted Michael Shackleford
(Wizard of Odds) in 2021 and paraphrased the analysis as a 0.37% player edge when
played to absolute perfection. This staff-attributed edge is a research target to
reproduce independently, not a substitute for our own solver validation.

Source:
- https://www.torn.com/forums.php?p=threads&t=16486332

**Open:** dealer hole-card/peek behavior, insurance interaction, dealer handling of
split hands, push edge cases, current wager limit, exact visible DOM contract, and
settlement rounding.

### Poker

**OFFICIAL.** Torn Poker is PVP Texas Hold'em-style cash play, currently with
permanent tables, two private cards, flop/turn/river, best five-card hand, split pots
for tied best hands, and configurable table behavior including No Pre-flop.

Source:
- https://wiki.torn.com/wiki/Poker

**COMMUNITY.** Existing Torn poker guides describe main and side-pot handling, and
multiple userscripts already calculate visible-hand winning odds. A June 2026 forum
discussion states Torn Poker has no rake, but this has not yet been promoted to an
official mechanic in this ledger.

Sources:
- https://www.torn.com/forums.php?a=0&b=0&f=61&p=threads&t=16220471
- https://www.torn.com/forums.php?p=threads&t=16394588
- https://www.torn.com/forums.php?a=0&b=0&f=15&p=threads&t=16573539

**Research value:** very high. Candidate features include exact hand recognition,
outs, draw probability, pot odds, equity against explicitly defined ranges, and
browser-local observations of actions the user actually witnessed.

**Open:** official rake status, odd-chip and side-pot edge cases, visible action-history
contract, player-history retention boundary, and range-model presentation so estimates
cannot be mistaken for known opponent cards.

### High-Low

**OFFICIAL.** The next card is guessed higher or lower; Ace is high and 2 is low.
The displayed modifier varies from 15% to 35% based on the global ratio of money won
to money lost. A successful hand increases the pot; an incorrect guess loses it.
The player may cash the full pot after a hand or 50% after seeing the dealer card.

Source:
- https://wiki.torn.com/wiki/High-Low

**COMMUNITY.** Historical guides claim cards persist until a deck shuffle and that
ties replay without losing the pot. A current 2026 PDA-compatible userscript reports
automatic card tracking, shuffle detection, remaining-card counts, and best
Higher/Lower calculation. Community sources disagree over the deck size, so deck
composition is not yet verified.

Sources:
- https://www.torn.com/forums.php?a=0&b=0&f=61&p=threads&t=15960774
- https://www.torn.com/forums.php?a=0&b=0&f=67&p=threads&t=16501504
- https://www.torn.com/forums.php?p=threads&t=16362931

**Research value:** high. If deck/shuffle behavior is verified, exact conditional
remaining-card probabilities and continue-versus-cash-out EV become possible.

**Open IDs:**
- `HL-H01` — exact deck size / composition.
- `HL-H02` — exact shuffle trigger.
- `HL-H03` — current tie settlement.
- `HL-H04` — exact pot multiplier arithmetic and rounding.

### Keno

**OFFICIAL.** Players select 1–10 numbers from 80; Torn draws 10 at random. The Wiki
publishes the complete payout multiplier table, wager range ($10 to $1,000,000),
repeat behavior, and $10 billion maximum win per bet.

Source:
- https://wiki.torn.com/wiki/Keno

**DERIVED.** For `k` selected numbers and exactly `m` matches:

`P(X=m) = C(k,m) * C(80-k,10-m) / C(80,10)`

Using the currently documented payout table as gross payout multipliers gives these
uncapped expected gross returns:

| Picks | RTP | House edge |
| ---: | ---: | ---: |
| 1 | 100.0000% | 0.0000% |
| 2 | 98.4177% | 1.5823% |
| 3 | 97.3101% | 2.6899% |
| 4 | 99.1303% | 0.8697% |
| 5 | 99.1319% | 0.8681% |
| 6 | 99.7605% | 0.2395% |
| 7 | 98.4713% | 1.5287% |
| 8 | 99.4884% | 0.5116% |
| 9 | 99.5128% | 0.4872% |
| 10 | 98.8079% | 1.1921% |

The one-pick result independently matches a longstanding community Keno analysis,
and the six-pick result implies an expected loss of about $240 per $100,000 wager,
also matching that community calculation.

Community cross-check:
- https://www.torn.com/forums.php?a=0&b=0&f=61&p=threads&t=16162524

**Research value:** high for exact risk/return explanation, but little live tactical
prediction because selected number identities are symmetric if Torn's stated random
draw is functioning as documented.

**DERIVED cap result.** At the documented $1,000,000 maximum stake, the $10b win cap
only truncates payout multipliers above 10,000x. Under the current table this affects
9-pick 9/9 (50,000x), and 10-pick 9/10 (50,000x) and 10/10 (100,000x).
The capped maximum-stake RTP becomes approximately **99.512659% for 9 picks** and
**98.806174% for 10 picks**. Lower pick counts and lower stakes remain unaffected by
the cap under the published table.

**Open:** record variance, loss-frequency, tail-risk, and bankroll-distribution metrics
so the advisor does not reduce a high-variance game to a single RTP number.

### Craps

**OFFICIAL but incomplete.** The Wiki documents Torn's come-out and point cycle:
Pass wins 7/11 and loses 2/3/12 on the come-out; 4/5/6/8/9/10 establish the point;
afterward Pass wins by making the point before 7 and Don't Pass wins if 7 arrives
first. The Wiki explicitly says the article is under construction.

Source:
- https://wiki.torn.com/wiki/Craps

**COMMUNITY / OBSERVATION LEADS.** Current player discussion reports that odds bets
are available and that Torn caps odds at 3x, but this needs live verification. Older
and newer community explanations support the Wiki's Torn-specific treatment of 12
on Don't Pass rather than silently importing standard-casino assumptions.

Sources:
- https://www.torn.com/forums.php?a=0&b=0&f=15&p=threads&t=16470166
- https://www.torn.com/forums.php?a=0&b=0&f=3&p=threads&t=16026051

**Research value:** high once every Torn wager and payout is mapped. Dice
combinatorics are exact after the Torn-specific rules are frozen.

**Open IDs:**
- `CR-H01` — complete Torn bet/payout map.
- `CR-H02` — current odds-bet cap and payouts.
- `CR-H03` — confirm every Don't Pass / Don't Come exception rather than assuming
  real-casino rules.

### Russian Roulette

**OFFICIAL.** One bullet is chambered; players alternate firing at their own foot
until it fires. One shot per turn is default; 25 wins unlocks two shots and 100 wins
unlocks three.

Source:
- https://wiki.torn.com/wiki/Russian_Roulette

**DERIVED.** Under the ordinary six-position, one-bullet-without-replacement model,
if `r` possible chamber positions remain and a player commits to `s` consecutive
shots, the probability the bullet occurs during that turn is `s / r`.

A uniformly preselected bullet position and sequential conditional hazards
`1/r, 1/(r-1), ...` are distributionally equivalent. Merely observing shot
sequences cannot distinguish those two implementation descriptions. The research
question is therefore not "fixed chamber versus conditional draw" by itself, but
whether Torn follows that without-replacement distribution at all or applies some
different/randomized modifier.

**COMMUNITY.** Torn forum discussions contain conflicting claims about fixed chamber
positions, per-shot resolution, and supposed hidden "luck" effects. None is promoted
to fact. Existing RR tracker tools generally describe the game as 50/50 overall.

Candidate source:
- https://www.torn.com/forums.php?a=0&b=0&f=67&p=threads&t=16486015

**Research value:** potentially high for state risk, multi-shot risk allocation,
session statistics, and explaining what extra shots do and do not mathematically
change.

**Open IDs:**
- `RR-H01` — verify the six-position without-replacement probability model.
- `RR-H02` — determine whether any documented player/game modifiers alter shot odds.
- `RR-H03` — map exact turn/state transitions for one-, two-, and three-shot choices.

### Roulette

**OFFICIAL source gap.** The current Torn Wiki page is very sparse and does not
document wheel layout or all payouts.

Source:
- https://wiki.torn.com/wiki/Roulette

**COMMUNITY.** Multiple Torn guides describe the current game as a European-style
single-zero, 37-space wheel with the usual approximately 2.7% house edge. This must
be verified from current visible game rules before becoming an implementation fact.

Candidate source:
- https://www.torn.com/forums.php?a=0&b=0&f=15&p=threads&t=16446509

**Research value:** moderate. Exact bet probability, payout, exposure, and house edge
are useful; previous spins must never be presented as predictive if spins are
independent.

**Open:** live wheel layout, payout table, wager limits, compound-bet handling.

### Lottery

**OFFICIAL.** Torn documents Daily Dime (daily), Lucky Shot (weekly), and Holy Grail
(monthly), with ticket prices and casino-token requirements.

Source:
- https://wiki.torn.com/wiki/Lottery

**DERIVED candidate.** If the actively viewed page exposes both the user's ticket
count and total eligible tickets, exact win probability is
`user_tickets / total_tickets`. Expected value additionally requires the prize
value and treatment of casino-token opportunity cost.

**Research value:** moderate.

**Open:** verify current live page fields and whether total entries/prize pools needed
for exact EV are visible.

### Slots

**OFFICIAL.** Torn publishes wager levels and states that jackpot probability rises
with wager size, including a relative x2 chance at $100 and x64 at $10m. The public
documentation does not publish the base jackpot probability or reel-symbol
distribution.

Source:
- https://wiki.torn.com/wiki/Slots

**Research value:** statistical rather than tactical. Session tracking and empirical
return analysis may be useful; there is currently no evidence basis for a next-spin
oracle.

**Open:** official/observable full payout table, jackpot base probability, whether
sufficient public aggregate data exists to estimate return by wager size.

### Spin The Wheel

**OFFICIAL.** Torn has three daily wheels with fixed entry prices and published prize
lists. The Wiki warns that client-side animation can display the wrong result and
that Last Spins is authoritative.

Source:
- https://wiki.torn.com/wiki/Spin_The_Wheel

**COMMUNITY.** Players commonly claim the outcome is predetermined before the visible
wheel stops, but this is not yet treated as an official mechanic.

**Research value:** statistical. Prize valuation and empirically estimated outcome
frequencies may be useful; timing of the Stop button will not be treated as skill
without compelling evidence.

### Bookie

**OFFICIAL.** Torn Bookie uses real-world sports, receives live odds from an outside
provider, locks the displayed odds at bet placement, and supports multiple market
types.

Source:
- https://wiki.torn.com/wiki/Bookie

**DERIVED.** Decimal odds `o` imply break-even probability `1/o`. For mutually
exclusive outcomes, `sum(1/o_i)-1` measures the displayed market overround when the
market structure supports that interpretation.

**Research value:** high for odds normalization and price/value explanation. Predicting
real sporting outcomes is a separate external-data research problem and is not
silently included in the casino engine.

### Existing community tools

Current community tools show that several desired read-only/advisory patterns already
exist in Torn:

- 2026 High-Low tracker with PDA support, visible-card tracking and recommendations;
- Poker winning-odds calculators;
- Blackjack quality-of-life/session tracker;
- Russian Roulette history/statistics tracker;
- Keno number/statistics tools.

These are research references, not code to copy blindly. Their assumptions, legality
under current rules, DOM selectors, and mathematical correctness must be reviewed
before any architecture is borrowed.

## CA-00 research sequence

- **CA-00A — Evidence schema:** established.
- **CA-00B — Shallow sweep:** active; first pass recorded above.
- **CA-00C — Unknown/hypothesis registry:** active.
- **CA-00D — Shared-engine map:** pending after game-mechanics sweep.
- **CA-00E — Implementation order:** decide only after evidence coverage is adequate.

No product code is authorized by this chapter.

## Candidate shared engines

Research currently points toward:

- card/rank/deck representation;
- exact combinatorics and probability;
- expected-value / payout / house-edge engine;
- Texas Hold'em hand evaluator and equity engine;
- dice outcome engine;
- state-machine / turn-state representation;
- provenance + uncertainty display model;
- browser-local session/observation store;
- TornPDA-safe active-page DOM adapter layer.

## Validation rules before specification

- Every Torn-specific mechanic used for advice has provenance and a checked date.
- Official, derived, observed, and community claims remain visibly distinct.
- Any formula with Torn-specific payout assumptions has deterministic fixtures.
- Historical observations are not treated as evidence of future independent outcomes.
- Mutable rules and page contracts are rechecked before implementation.
- The UI must not imply certainty beyond the evidence.
- The final tool remains advisory unless a later owner-approved specification
  separately validates a user-triggered action.


## Deepening pass — 2026-09-22

### Cross-casino official baseline

**OFFICIAL staff statement.** In January 2026, Chedburn stated that most Torn casino
games are slightly house-favoured, while identifying Russian Roulette, Poker, and
Lottery as exceptions with "equal ratios", and Spin the Wheel as producing more value
than it takes in. This is useful directional evidence, but "equal ratios" must not be
silently translated into a game-specific probability model. In PVP games it may simply
describe zero-sum / no-house behavior.

Source:
- https://www.torn.com/forums.php?p=threads&t=16486332

### Blackjack rule freeze candidate

The 2026 Chedburn statement resolves two previously open mechanics:

- `BJ-R01` — surrender type: **early surrender** — OFFICIAL.
- `BJ-R02` — split aces may be hit — OFFICIAL.

It also confirms no re-split, double after split, double any two cards, 3:2 Blackjack,
eight decks, soft-17 stand, and Six-Card Charlie.

The quoted/paraphrased consultant decomposition was:

- base house edge: 0.42%;
- Six-Card Charlie contribution: 0.16% to the player;
- early surrender versus ten: 0.24%;
- early surrender versus ace: 0.39%;
- stated net: -0.37% house edge, i.e. +0.37% player edge under perfect play.

This decomposition remains **OFFICIAL STAFF-ATTRIBUTED / NOT YET INDEPENDENTLY
REPRODUCED**. Our solver must reproduce or explain any discrepancy before the value is
used in product copy.

### High-Low evidence convergence

Current community observations are increasingly consistent with a persistent
single-deck model:

- historical guides describe a 52-card deck and card counting between shuffles;
- recent 2026 player discussion says the game visibly announces shuffles and describes
  a reset when 32 cards remain;
- a current PDA-compatible tracker advertises automatic visible-card tracking,
  shuffle/reset detection, remaining-card counts, and Higher/Lower calculation.

This raises confidence in `HL-H01` / `HL-H02`, but they remain **COMMUNITY /
TESTING** until current live observations reproduce the deck size, no-duplicate
behavior, and exact reset point.

An advisor should distinguish:
1. probability of Higher;
2. probability of Lower;
3. tie probability and treatment;
4. expected pot change after the global 15–35% modifier;
5. cash-out value now versus continuing.

### Craps contradiction registry

A direct contradiction now exists:

- the current Torn Wiki says Don't Pass wins on 2, 3, **or 12** on the come-out;
- community descriptions of the live game have described 12 as a push, matching
  conventional craps.

Therefore `CR-H03` is a priority falsification target. We must not use a generic
casino craps table until the live Torn behavior is observed.

Community reports also describe an odds bet capped at 3x. Add:

- `CR-H04` — verify whether Torn odds wagers pay true odds and map exact point-specific
  payouts.

### Russian Roulette strategy math

Under the six-position one-bullet without-replacement candidate model, define `r`
remaining possible positions and `s` consecutive shots taken this turn.

- immediate loss probability for the acting player: `s / r`;
- survive-turn probability: `(r-s) / r`.

A minimax dynamic program under this model, with each player choosing 1–3 shots where
unlocked, gives an important candidate conclusion:

- at the fresh `r=6` state, taking one shot preserves a 50% game-win probability;
- voluntarily taking two shots reduces the acting player's game-win probability to
  1/3;
- taking three at the fresh state is also no better than 1/3;
- extra shots can tie the one-shot value in certain late states, but did not improve
  optimal win probability in the tested state space.

This is **DERIVED CONDITIONAL ON RR-H01**, not a Torn fact. It does support the user's
initial intuition in a narrower form: extra shots change which future chamber
positions belong to which player, but without private information that reallocation
does not itself steer the hidden bullet to the opponent. It is usually additional
exposure.

The future RR module should be able to show both:
- immediate turn risk; and
- whole-game win probability conditional on the verified Torn state model.

### Roulette

Current community guides consistently describe Torn as European-style single-zero
roulette with 37 spaces (0–36) and standard payouts. If live observation confirms
that rule set, standard wagers all carry the familiar `1/37 ≈ 2.7027%` house edge.

Until the live wheel and payout table are checked:

- `ROU-H01` — verify 0–36 single-zero layout;
- `ROU-H02` — verify each payout class;
- `ROU-H03` — verify current per-position and aggregate wager limits.

Past-spin history may be displayed descriptively, but streaks must not be converted
into predictive advice without evidence of non-independent outcomes.

### Slots

The official Wiki publishes the current visible pay table:

- Pinata 2x;
- Duck Hunting 3x;
- Flock O'Ducks 3x;
- Serious Duck Hunting 4x;
- Radioactive 2000x;
- Jackpot = progressive jackpot.

It also publishes stakes from $10 through $10m and relative jackpot-chance scaling
from x2 at $100 to x64 at $10m, but not the base jackpot probability or reel-symbol
distribution.

Therefore exact Slots RTP cannot currently be derived from the public rule table
alone. Historical/session logs can estimate empirical return, but no next-spin
prediction is justified.

### Spin the Wheel

**OFFICIAL.** The current Wiki lists the three daily wheels, entry prices, prize
lists, once-per-day limit, free-spin outcomes, hospitalization outcomes, and warns
that the client animation can display an incorrect result while Last Spins is
authoritative.

**OFFICIAL historical/staff statement.** Chedburn's launch announcement said the
wheel system was designed to give out more value on average than it received. The
2026 Chedburn casino post repeated that Spin the Wheel produces more value than it
takes in.

**COMMUNITY EMPIRICAL.** TDup's Leslie Wheels Profitability project collected hundreds
of thousands of contributed spins. Its 2024 update reported 888,371 spins from 1,705
players and, using then-current item/point values, estimated:
- Awesome: about -$42k per spin;
- Mediocrity: about +$65k per spin;
- Lame: about +$3.5k per spin.

Earlier snapshots estimated Private Island probability around 0.04–0.05%.

This apparent tension is not necessarily a mechanical contradiction. Wheel outcome
probabilities can remain fixed while market-valued prizes such as points, items, and
properties change price. Consequently TornScriptures should treat **probability
estimation** and **current prize valuation** as separate inputs.

Open:
- `WHEEL-H01` — verify whether current outcome probabilities remain compatible with
  the large historical sample;
- `WHEEL-H02` — determine whether Stop timing has any causal effect. Community claims
  say the result is predetermined; current evidence is insufficient to elevate this
  to OFFICIAL;
- `WHEEL-H03` — build a live EV model that revalues mutable prizes instead of storing
  old profitability conclusions.

### Lottery

The official Wiki confirms:
- Daily Dime: $100 + 1 token per ticket;
- Lucky Shot: $10,000 + 1 token per ticket;
- Holy Grail: $1,000,000 + 1 token per ticket;
- Lottery Voucher: 100 Lucky Shot entries.

Chedburn's 2026 "equal ratios" description is consistent with the lottery acting as a
participant-funded game rather than a conventional fixed house-edge game, but the
exact current payout-pool construction still needs to be frozen.

For a drawing with `u` user tickets among `T` eligible tickets:
`P(win) = u / T`.

For buying `n` additional tickets when the player already owns `u` and the field
currently contains `T`, the post-purchase probability is:
`P(win after purchase) = (u+n)/(T+n)`.

A correct EV display also needs jackpot value, token opportunity cost, and whether
additional-ticket purchases themselves increase the jackpot/pool.

### Poker

The official Poker page documents PVP Texas Hold'em mechanics and split pots. Current
community discussion continues to describe Torn Poker as having no rake; Chedburn's
2026 "equal ratios" statement is consistent with no house take, but it is not an
explicit current rake specification.

Keep:
- `POK-H01` — verify current rake/fee behavior from the live table;
- `POK-H02` — verify side-pot and odd-chip settlement details;
- `POK-H03` — map exactly which opponent actions/history remain visible on the active
  page and may be stored browser-locally.

### Bookie

The current Wiki confirms live odds from an off-site provider, odds locked at bet
placement, final/non-cancellable wagers, cash-only betting, and a $1b per-event cap.

For decimal odds `o_i`, implied break-even probability is `q_i=1/o_i`.
For mutually exclusive and exhaustive outcomes, raw market overround is:

`overround = sum(q_i) - 1`.

A simple proportional no-vig normalization candidate is:

`p_i = q_i / sum(q_j)`.

That normalization describes the bookmaker market, not the true probability of the
sporting result. External predictive sports models remain a separate research track.

### API and historical-data contract

A valuable architecture improvement emerged from current API research.

**OFFICIAL.**
- API v2 added `user -> casino` in April 2026. It exposes current casino streak and
  remaining casino tokens.
- Torn marked `user -> casino` stable in August 2026.
- The endpoint is not a detailed game-history feed.
- User logs can expose historical casino activity; Torn's API supports querying log
  categories/types and time windows, subject to the user's key permissions.
- Forum examples show casino logs can include bet amount, win/loss, and detailed
  outcomes for games such as Slots, Roulette, High-Low, and Craps.
- RR log identifiers have been staff-confirmed historically for start/join/win/loss,
  but identifiers must be re-read from current `torn -> logtypes` rather than
  hardcoded forever.

Sources:
- https://www.torn.com/api.html
- https://www.torn.com/forums.php?a=0&b=0&f=63&p=threads&start=360&t=16401584
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16426246
- https://www.torn.com/forums.php?a=0&b=0&f=4&p=threads&t=16412158

Candidate data architecture:

`active page = live decision state`

`user/casino = streak + token state`

`optional authorized user/log import = historical self-analytics / validation corpus`

`browser local = derived session statistics and observations`

This split is preferable to using background page scraping for history.

## CA-00D — shared-engine map (opened)

Evidence is now sufficient to begin mapping reusable internals while CA-00B/CA-00C
continue.

1. **Probability Core**
   - exact rational/combinatorial calculations;
   - hypergeometric/binomial helpers;
   - conditional-probability trees;
   - uncertainty and confidence intervals for empirical estimates.

2. **EV / Payout Core**
   - gross/net return;
   - house edge / player edge;
   - caps and nonlinear payouts;
   - break-even thresholds;
   - dynamic market-value inputs separated from fixed game mechanics.

3. **Card Core**
   - rank/suit/deck model;
   - remaining-card accounting;
   - Blackjack recursive EV;
   - Hold'em evaluator, outs, and range equity;
   - High-Low deck-state probabilities.

4. **Dice Core**
   - two-dice outcome distribution;
   - Craps point-state transitions;
   - exact wager settlement.

5. **Turn-State Core**
   - Russian Roulette remaining-state model;
   - multi-action transitions;
   - state-machine representation reusable for Blackjack, High-Low, and Craps.

6. **Evidence / Provenance Core**
   - attach OFFICIAL / DERIVED / OBSERVED / COMMUNITY / TESTING / REJECTED state to
     advice;
   - expose assumptions next to calculated output;
   - fail closed when a Torn-specific mechanic is unresolved.

7. **Data Adapter Layer**
   - active-page DOM adapters by game;
   - optional stable Torn API selections;
   - optional authorized self-log history import;
   - no hidden/background-page scraping.

8. **Local Observation Store**
   - session results;
   - player-observed Poker tendencies;
   - empirical wheel/slots distributions;
   - validation fixtures;
   - no committed private hand histories or API credentials.

CA-00D is architectural research only. It is not a product-code authorization.
