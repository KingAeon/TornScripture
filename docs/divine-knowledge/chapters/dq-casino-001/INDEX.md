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

**Open:** surrender timing/type, dealer hole-card peek behavior, split-ace restrictions,
push/insurance edge cases, wager limits, exact visible DOM contract, and exact
rounding/settlement behavior.

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

**Open:** quantify the $10b payout cap at every affected wager/pick combination and
record variance/tail-risk metrics.

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
