# WORK TRANSFER — CA-01 Blackjack Pure Math Engine — 2026-10-05

State: **[B][WORK] AUTHORIZED / TOOLCHAIN PREFLIGHT BLOCKED BEFORE PRODUCT EDITS**

## Mission

Implement the first TornScriptures Casino Advisor product slice: a **pure,
parameterized Blackjack Math Engine** that follows the merged CA-01 specification,
contains no browser/TornPDA/UI/network/storage/gameplay integration, and never invents
unresolved Torn mechanics.

## Exact baseline

- Repository: `KingAeon/TornScripture`
- Base branch: `main`
- Exact post-spec main SHA:
  `c95136b08ad8cc3f8cc4c4ac2ae7462cebaa2475`
- Verified specification merge: PR #137
- Implementation branch:
  `agent/casino-blackjack-math-001-build`

Do not rebase or silently change the base. If main movement must be adopted, stop and
request a new explicit baseline.

## Authoritative specification

Read in order:

1. `AGENTS.md`
2. `docs/divine-knowledge/NOW.md`
3. `docs/divine-knowledge/domains/casino-analysis/INDEX.md`
4. `docs/divine-knowledge/chapters/dq-casino-002/INDEX.md`
5. `docs/divine-knowledge/chapters/dq-casino-002/VERIFICATION-2026-10-05.md`
6. `docs/divine-knowledge/chapters/dq-casino-002/LIVE-VERIFICATION.md`

The implementation must not broaden beyond the merged CA-01 contract.

## Required product slice

Create a pure CommonJS-compatible module, following the repository's established
pure-module pattern, with deterministic Node tests.

Candidate paths unless repository inspection finds a stronger existing owner:

- `src/casino-blackjack-pure.js`
- `tests/casino-blackjack-pure.test.js`

No userscript integration is in scope.

### Required engine capabilities

- value-count representation for an eight-deck Blackjack shoe;
- hand evaluator:
  - hard total;
  - best total;
  - hard/soft;
  - bust;
  - natural Blackjack;
  - card count;
  - Six-Card Charlie terminal state;
  - equal-value split eligibility;
- finite-shoe next-card probabilities;
- dealer terminal recursion for S17;
- action EV for:
  - Stand;
  - Hit;
  - Double;
  - Surrender;
  - Insurance;
  - Split;
- explicit rule profile;
- explicit `dealer_blackjack_exposure`:
  - `OBO`
  - `ENHC_FULL`
  - reject/unresolved when a single profile is required;
- explicit `split_shoe_policy`:
  - `SHARED_DEPLETION`
  - `FRESH_BRANCH_SHOE`
  - `HYBRID`
  - reject/unresolved when exact semantics are required;
- fresh dealer hand per split branch;
- Six-Card Charlie precedence:
  - natural Blackjack beats 6CC;
  - 6CC vs 6CC compares total;
- parameterized insurance stake `i` with verified 2:1 payout;
- uncertainty-envelope evaluation:
  - evaluate candidate profiles independently;
  - per-profile action EV;
  - per-action EV interval;
  - `robust_best_action` only when every plausible candidate profile agrees;
  - explicit disagreement/unresolved rules otherwise.

## Safety invariants

- pure module only;
- no Torn API calls;
- no DOM access;
- no page-response interception;
- no storage;
- no timers/listeners/observers;
- no wager placement;
- no gameplay action;
- no UI;
- no userscript;
- no hidden-state inference;
- no cross-hand card counting;
- no guessed OBO/full-loss rule;
- no guessed split-shoe policy;
- unavailable actions must never be recommended;
- malformed/depleted-card state fails closed.

## Explicit exclusions

Do not implement:

- TornPDA/browser adapter;
- `blackjackData` interception;
- HUD or settings;
- session tracking;
- bankroll tracking;
- betting strategy or bet sizing;
- card counting across games;
- Poker, High-Low, RR, Keno, or any other casino game;
- BJ-V01/BJ-V02B mechanic resolution;
- live Torn requests;
- automated Hit/Stand/Double/Split/Surrender/Insurance;
- userscript version bump.

## Validation requirements

Pre-edit baseline:

```bash
git status --short
git rev-parse HEAD
node --version
node --check src/training-advisor-pure.js
node --test tests/*.test.js
```

Expected historical baseline from the last executable checkpoints is at least the
known full repository suite, but **do not substitute historical counts for an actual
run on this exact baseline**.

After implementation:

```bash
node --check src/casino-blackjack-pure.js
node --check tests/casino-blackjack-pure.test.js
node --test tests/casino-blackjack-pure.test.js
node --test tests/*.test.js
git diff --check main...HEAD
```

### Dedicated deterministic fixtures/tests

At minimum cover:

1. fresh eight-deck counts sum to 416;
2. visible-card removal and invalid negative depletion;
3. Ace soft/hard evaluation;
4. natural Blackjack detection;
5. mixed 10/J/Q/K equal-value split eligibility;
6. S17 dealer recursion probabilities sum to 1;
7. surrender EV exactly -0.5 when available;
8. insurance break-even at p=1/3 for arbitrary positive stake `i`;
9. OBO vs ENHC_FULL produces distinct affected-state EV where expected;
10. unavailable actions excluded;
11. Six-Card Charlie terminal precedence;
12. split fresh-dealer semantics;
13. each split-shoe candidate policy is independently callable;
14. uncertainty envelope marks a robust action only when all candidate profiles agree;
15. uncertainty envelope reports disagreement rather than collapsing it;
16. deterministic input ordering / canonical output;
17. input immutability;
18. malformed rule/state fails closed.

If external dealer-distribution or strategy-grid numeric fixtures are added, record
their source and exact profile assumptions. Do not use an aggregate +0.37/+0.38 edge
to identify BJ-V01.

## Protected regressions

The full repository Node suite must remain green.

No existing Training Advisor source/test behavior may change.

No userscript/runtime/browser file may change.

## Stop conditions

Stop rather than improvise if:

- repository cannot be fully materialized;
- exact base SHA cannot be checked out;
- working tree is not clean/understood;
- Node baseline tests cannot execute;
- baseline tests fail;
- implementation requires a browser adapter/UI/network path;
- BJ-V01 or BJ-V02B would need to be guessed;
- Split implementation cannot express the three candidate shoe policies without a
  larger architecture than this specification;
- two correction cycles reveal a deeper architectural flaw.

## Deliverables

- pure source module;
- focused deterministic test suite;
- bounded documentation/checkpoint update;
- isolated implementation commit(s);
- draft PR;
- exact validation commands/results;
- complete diff review;
- rollback instructions;
- explicit unmerged status.

## Manual verification

None required for this pure slice because it has no browser/runtime integration.
Manual TornPDA testing begins only in the later adapter/HUD phase.

## Rollback

Leave the implementation PR unmerged, or revert the bounded implementation commit(s).
There are no storage migrations, user data, or live release bytes in this slice.

## No-merge rule

Coding/verification agents must not merge, mark ready, or enable auto-merge. Owner
merge authorization remains separate after independent verification.

## Current preflight evidence

The current chat environment can verify GitHub state and publish isolated branches,
but its local container cannot resolve GitHub and therefore cannot materialize the
repository or execute the required exact-baseline test suite.

Per `AGENTS.md` and `DEVELOPMENT-WORKFLOW.md`, **product edits are blocked until a
full executable repository workspace is available**. This is a toolchain block, not a
specification block.
