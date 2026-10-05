# CA-01 Independent Verification — 2026-10-05

Result: **PASS — OWNER MERGE DECISION PENDING**

## Verification target

- Repository: `KingAeon/TornScripture`
- Exact current-main base: `b8474253237e63485100fdcc51b2cb82530d2efc`
- Reconciliation PR: #137
- V1 reconciliation head before verification corrections:
  `5b465bbe8e863f1492a4a15254827cb393663c8e`
- V2 corrected specification head before this report:
  `2d0d94141c046f9d4891d0598c82005642e9b4a8`

## Scope verification

The reconciled branch is based directly on exact current main and contains only
`docs/divine-knowledge/**` changes.

No product source, userscript, test, workflow, storage, release, or version metadata
is changed.

Shared registries were checked against current main. All non-casino entries in
OPEN-NODES, DECISIONS, GRAPH, LESSONS, and CHANGELOG remain byte-equivalent in order
and content. The non-casino portion of NOW is also preserved.

## Static findings and bounded corrections

The first V2 read found five inherited specification inconsistencies from stale
PR #121:

1. Split still contained an obsolete "shared finite-shoe depletion" requirement even
   though BJ-V02B explicitly left split-shoe accounting unresolved.
2. The candidate profile used a vague dealer-blackjack-resolution field instead of
   the later explicit OBO / ENHC_FULL exposure enum.
3. Insurance EV hard-coded a half-bet stake while BJ-V04B still leaves exact stake
   control/rounding open.
4. An earlier stop line still said BJ-V01/BJ-V02B blocked implementation entirely,
   contradicting the later approved uncertainty-envelope design.
5. The global-edge fixture wording could be read as requiring every candidate rule
   model to reproduce the same +0.37/+0.38 benchmark.

Those findings were corrected before PASS.

The verified contract now:
- parameterizes `dealer_blackjack_exposure`;
- parameterizes `split_shoe_policy`;
- parameterizes insurance stake size `i`;
- keeps the final single Torn rule profile unfrozen while allowing a separately
  authorized parameterized core;
- uses aggregate edge only as a profile-matched validation benchmark.

## Mathematical verification

Insurance with stake `i` base-wager units and a 2:1 net payout has:

`EV = i * (2p - (1-p)) = i * (3p - 1)`

so break-even remains `p = 1/3` independently of stake size.

For the BJ-V02B uncertainty bound, if `m` differently treated labeled cards are
removed from an `N`-card population, total-variation distance between the full and
depleted uniform next-card distributions is exactly `m/N`. The recorded examples
for an N=400 lower-bound population (1=>0.25%, 3=>0.75%, 4=>1%, 6=>1.5%, 8=>2%,
10=>2.5%) are correct. Rank aggregation can only reduce that distance.

This bound is not used as permission to ignore composition changes; the spec correctly
requires multi-profile evaluation and fail-closed disagreement.

## Current Torn mechanics recheck

Rechecked 2026-10-05:

- Official Torn Wiki still documents eight decks, S17, DOA, equal-value split
  including aces, DAS, no re-split, 6CC behavior, insurance, and the shuffle-every-game
  patch history.
- Chedburn's 2026 staff statement still describes early surrender, hit after split
  aces, DAS, DOA, 3:2 Blackjack, 6CC, and one split only, with approximately +0.37%
  player edge under perfect play.
- Patch list #451, covering 2026-09-22 through 2026-09-29, contains no Blackjack or
  casino-mechanic change. At verification time the current Announcements index shows
  #451 as the latest patch list.
- The 2024 admin split ruling still confirms a new dealer hand for each Torn split
  hand.
- The 2024 admin insurance ruling still confirms insurance as a separate 2:1 side bet
  while dealer Blackjack loses the main wager.
- Current public TornTools source still observes the active page's already-occurring
  `sid=blackjackData` state and reads dealer/player hands and `availableActions`.

Sources:
- https://wiki.torn.com/wiki/Black_Jack
- https://www.torn.com/forums.php?p=threads&t=16486332
- https://www.torn.com/forums.php?a=0&b=0&f=1&p=threads&t=16606699
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16387030
- https://www.torn.com/forums.php?a=0&b=0&f=19&p=threads&t=16416107
- https://github.com/Mephiles/torntools_extension/blob/main/src/common/features/blackjack-strategy/blackjack-strategy.ts
- https://www.beatingbonuses.com/bjstrategy.php?btn=Generate+Strategy&charlie=on&das=on&decks=8&doubleon=any2cards&dsa=on&opt=1&peek=off&soft17=stand&surrender=earlyf
- https://wizardofodds.com/games/blackjack/rule-variations/
- https://wizardofodds.com/games/blackjack/effect-of-removal/

No current authoritative evidence found in this pass resolves:
- `BJ-V01`: OBO versus ENHC_FULL extra-exposure settlement;
- `BJ-V02B`: exact cross-split shoe/depletion policy.

Their continued explicit uncertainty is therefore correct.

## Verification meaning

PASS means the CA-01 **documentation/specification** is coherent, current enough to
serve as a post-merge implementation contract, and does not require the engine to
invent unresolved Torn mechanics.

PASS does **not** mean:
- BJ-V01 or BJ-V02B is resolved;
- the final single Torn rule profile is frozen;
- any Blackjack code exists;
- any browser/TornPDA implementation has been tested;
- PR #137 is merged;
- [B][WORK] implementation is authorized.

## Required next step

Owner decides whether to merge verified PR #137.

Only after that merge may a separate owner-authorized `[B][WORK]` task start from
the exact resulting main SHA and implement the pure parameterized Blackjack Math
Engine with deterministic tests. Adapter/HUD work remains later.
