# Casino Analysis Domain

Status: **ACTIVE RESEARCH / PRODUCT SPECIFICATION NOT FROZEN**

## Purpose

Develop a TornScriptures casino decision-support system that reads only information
legitimately visible to the player on the actively viewed casino page (or authorized
Torn API data), performs local mathematics and state analysis, and explains the
available choices without playing the game for the user.

The intended product is one **Casino Advisor** userscript with modular game engines
sharing common probability, card, dice, expected-value, session, and UI components.

## Product boundary

The advisor may parse visible game state, calculate probabilities and expected value,
preserve browser-local observations from sessions the user actively viewed, and
explain assumptions and uncertainty. Every wager and gameplay action remains human.

It must not automatically place wagers or gameplay actions, obtain hidden state,
issue unapproved non-API Torn requests, scrape casino pages that are not actively
viewed, or present community theory as verified mechanics.

## Evidence classes

- **OFFICIAL** — Torn Wiki, Torn staff statements, patch notes, or visible game rules.
- **DERIVED** — mathematics directly derived from verified mechanics.
- **OBSERVED** — repeatable behavior measured during actively viewed Torn play.
- **COMMUNITY** — player guides, forum claims, or existing tools not independently proven.
- **TESTING** — plausible hypothesis awaiting controlled evidence.
- **REJECTED** — claim contradicted by stronger evidence.

## Active chapter

- `../../chapters/dq-casino-001/INDEX.md` — CA-00 research ledger, shallow survey
  of all Torn casino games, unknown-mechanics registry, and shared-engine discovery.

## Knowledge rule

Durable rules, formulas, evidence status, provenance, and nonprivate test vectors may
be stored in Divine Knowledge. Mutable live casino state, player bankrolls, private
hand histories, and other personal session data remain browser-local or live and are
not committed here.
