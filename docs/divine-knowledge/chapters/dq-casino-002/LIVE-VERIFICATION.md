# CA-01 Blackjack Live Verification Sheet

State: **OWNER/ASSISTANT OBSERVATION GUIDE — NO AUTOMATION**

Purpose: capture the few current Torn behaviors that public documentation cannot
settle reliably enough for the Blackjack solver.

Use the smallest comfortable wager. Do not force expensive states. If a state appears
naturally, capture it.

## What to send back

A screenshot is useful. A short screen recording is even better for ordering questions.
If neither is convenient, copy the visible text and note the action sequence.

Never include API keys, cookies, session tokens, or developer-console request headers.

## BJ-V01 — Ace/10 dealer ordering

When dealer shows Ace or 10, capture the screen **before choosing an action**.

Need:
- dealer upcard;
- your cards;
- visible buttons;
- whether Insurance appears;
- whether Surrender appears;
- whether dealer Blackjack is announced before you can act.

If dealer Blackjack is eventually revealed, note whether any Double/Split exposure
was already possible.

## BJ-V02A — split settlement model — RESOLVED

Torn admin evidence confirms a fresh dealer hand is used for each split hand.

## BJ-V02B — split card accounting

When you naturally receive a splittable hand:
1. record opening hand + dealer upcard;
2. Split;
3. capture the full visible card sequence for hand 1 and its dealer resolution;
4. capture the full visible card sequence for hand 2 and its dealer resolution.

Key questions:
- which cards appear to remain depleted for hand 2;
- how the repeated dealer upcard is represented;
- whether hand-1 dealer draws influence hand-2 composition.

## BJ-V03 — split aces

When A/A appears:
- confirm Split button;
- after splitting, capture available Hit/Double controls;
- note whether either hand can continue normally.

## BJ-V04A — insurance settlement — RESOLVED

Admin evidence confirms insurance is a separate 2:1 side bet and dealer Blackjack
still loses the main wager.

## BJ-V04B — insurance control / rounding

With dealer Ace:
- record base bet;
- record offered insurance amount;
- note whether the amount is fixed or adjustable;
- note rounding on an awkward base wager if one appears naturally.

There is no need to repeatedly buy insurance just to gather data.

## BJ-V05 — mixed ten-value split

If a natural 10/J, 10/Q, J/K, Q/K, etc. opening hand appears:
- simply note whether Split is offered.

## Fast report format

```text
BJ-Vxx
Bet:
Player:
Dealer:
Buttons:
Sequence:
Settlement:
Screenshot/video: yes/no
Notes:
```

Once BJ-V01 and BJ-V02B are resolved, the mathematical rule profile can be frozen for
implementation planning. BJ-V03, BJ-V04B, and BJ-V05 improve fidelity but are no
longer the main blockers.
