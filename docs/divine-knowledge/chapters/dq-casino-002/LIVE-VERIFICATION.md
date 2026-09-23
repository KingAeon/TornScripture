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

## BJ-V02 — split settlement

When you naturally receive a splittable hand:
1. record opening hand + dealer upcard;
2. Split;
3. capture both resulting hands;
4. play normally;
5. capture dealer resolution for each hand.

Key question:
- same dealer hand for both player hands, or a fresh dealer hand per split hand?

## BJ-V03 — split aces

When A/A appears:
- confirm Split button;
- after splitting, capture available Hit/Double controls;
- note whether either hand can continue normally.

## BJ-V04 — insurance numbers

With dealer Ace:
- record base bet;
- record offered insurance amount;
- if taken during an ordinary test, record settlement.

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

Once BJ-V01 and BJ-V02 are resolved, the mathematical rule profile can be frozen for
implementation planning.
