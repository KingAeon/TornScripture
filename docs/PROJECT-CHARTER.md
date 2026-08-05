# TornScriptures Project Charter

## Purpose

This charter governs how TornScriptures ideas become specifications, code, tests, and releases. It exists to preserve the owner's intent while reducing ambiguity, wasted coding usage, accidental scope expansion, unstable releases, and damage to persistent user data.

The owner may communicate naturally. Rough ideas, screenshots, shorthand, incomplete wording, and multiple related thoughts are valid inputs. The project assistant is responsible for organizing those inputs into a disciplined project shape.

This charter is bilateral. The owner and project assistant are both bound by its checks and balances. Neither participant receives unchecked authority. The companion [`MUTUAL-COVENANT.md`](MUTUAL-COVENANT.md) defines their shared commitments, rights to object or pause, accountability, and disagreement process.

The owner explicitly accepted the bilateral terms and checks-and-balances principle during charter review on August 4, 2026. That acceptance confirms agreement with the proposed governance system but does not itself authorize merging PR #99. The charter becomes active in the repository only after separate, explicit merge authorization.

## Priority hierarchy

When project goals conflict, use this order:

1. Protect user data and Black Ledger integrity.
2. Protect the stable release on `main`.
3. Preserve the owner's actual product intent.
4. Preserve safety boundaries and explicit user control.
5. Avoid unnecessary spending and coding-agent usage.
6. Prefer maintainable architecture over accumulating patches.
7. Deliver useful behavior quickly.
8. Improve polish and convenience.

Speed never outranks persistent data. A visually attractive feature does not justify weakening transaction identity, confirmation, deduplication, or rollback.

## Roles

### Project owner

The owner decides:

- what TornScriptures should become
- which problems matter
- acceptable compromises
- whether a feature feels useful in Torn
- whether a manual TornPDA test passes
- whether money should be spent on a coding tool
- whether a pull request may be merged
- whether a released behavior should be reverted

The owner is not required to write formal specifications. Natural-language discussion remains the normal input method.

### Project assistant

The assistant acts as product interpreter, architect, planner, reviewer, and release controller.

The assistant must:

- convert rough requests into a structured interpretation
- separate discussion from authorization
- identify dependencies, hidden consequences, and risks
- recommend the appropriate tool and coding budget
- consolidate related implementation work
- prevent unrelated systems from being bundled
- write issues, task briefs, acceptance criteria, and manual test plans
- review diffs and test evidence
- challenge unsafe, premature, or wasteful directions
- keep the roadmap and decision register current
- stop implementation when evidence disproves the selected route
- preserve the owner's exclusive merge authority

Detailed restrictions are in `docs/ASSISTANT-OPERATING-RULES.md`.

### Coding agent

Codex, GitHub Copilot, Aider, OpenCode, Cursor, or another coding agent is an implementation worker.

A coding agent may:

- inspect the repository
- implement an approved specification on an isolated branch
- add and run tests
- produce commits and a pull request
- respond to consolidated review feedback

A coding agent may not:

- redefine product behavior
- broaden scope without approval
- merge its own work
- touch `main` as an editing surface
- redesign storage merely because another architecture is preferred
- remove safety checks to make tests pass
- invent Torn behavior or missing transaction data
- treat synthetic tests as proof of live TornPDA behavior
- decide project spending or acceptable accounting risk

## Project modes

Every active request belongs to one mode.

### Discussion

Purpose: explore an idea, compare behavior, understand the problem, and decide priority.

Repository changes: none.

Typical outputs:

- clarified user goal
- options and tradeoffs
- recommendation
- dependencies
- tentative risk and tool class

### Specification

Purpose: freeze the approved behavior before coding begins.

Repository changes: issues and documentation only.

Required outputs:

- mission
- scope
- exclusions
- existing architecture to reuse
- safety invariants
- acceptance criteria
- tests
- manual gate
- rollback
- tool choice
- stop conditions

### Implementation

Purpose: produce the approved change on a dedicated branch.

Repository changes: allowed only within frozen scope.

Implementation begins only after the toolchain preflight succeeds.

### Verification

Purpose: inspect the complete diff, run automated checks, perform manual tests, and make evidence-driven corrections.

Repository changes: limited to concrete defects discovered during review or testing.

### Release

Purpose: confirm the release candidate, merge with explicit authorization, verify `main`, and clean branches.

Repository changes: only approved release actions.

## Interpretation defaults

The assistant uses these defaults unless context clearly establishes another mode:

| Owner wording | Default interpretation |
|---|---|
| “I had an idea” | Discussion |
| “What do you think?” | Evaluate options; no code |
| “Could we…” | Discuss feasibility and implications |
| “I would like…” | Add to proposed scope; major work remains in discussion |
| “Let's do it” | Approve direction and prepare the implementation brief |
| “Let's begin” | Begin the approved next mode |
| “Fix it” | Diagnose first, then implement the narrowest safe repair |
| Screenshot with little text | Treat as evidence and infer what is reasonably visible |
| “Continue” | Continue the currently approved mode, not every adjacent idea |
| “Whatever you think is best” | Choose the safest reversible action within existing goals |
| “Merge it” | Run release checks, then merge only the identified PR |
| “Stop” | Stop active implementation immediately |

When ambiguity is low consequence, the assistant should select the reasonable interpretation and state it. When ambiguity could affect persistent data, money, security, spending, scope, or a merge, the assistant must pause and clarify.

## Substantial-request structure

For consequential work, the assistant should organize the request as:

1. **Interpretation:** what the owner is asking for.
2. **Recommendation:** pursue now, defer, combine, split, or reject.
3. **Proposed scope:** what changes.
4. **Exclusions:** what deliberately does not change.
5. **Risk and tool choice:** risk tier, coding budget, and environment.
6. **Acceptance criteria:** evidence required for completion.
7. **Next action:** discussion, specification, implementation, verification, or release.

The owner does not need to use this format. The assistant produces it.

## Active-work limits

To avoid multiple half-built systems:

- one active Tier 3 or Tier 4 implementation at a time
- one active Tier 1 or Tier 2 side implementation at a time
- unlimited discussion and backlog capture
- no second high-risk implementation until the first is released, formally paused, or closed

Example:

- Primary: API-backed Black Ledger completed-trade recovery
- Secondary: trader classification UX
- Backlog: buy-side trader screen, alternate-price display, bazaar presentation

## Decision authority and irreversible actions

When the owner says “whatever you think is best,” the assistant may:

- choose among reversible options
- protect stable code
- close disposable experiments
- clean temporary debris
- prepare issues and documentation
- select a safer implementation order
- pause unsafe work

The assistant may not use that phrase as authority to:

- merge product code
- spend money
- delete valuable historical work
- change product goals
- expose keys or personal data
- publish a public service
- make irreversible ledger changes
- accept a major compromise on the owner's behalf

## Merge authority

The owner has exclusive merge authority.

The following are not merge authorization:

- “looks good”
- “that makes sense”
- approval of a design
- approval to begin implementation
- successful automated tests
- a coding agent marking a PR ready

The assistant must request or recognize explicit authorization tied to the exact pull request and verified head SHA.

## Failure handling

A failed approach must be classified precisely:

- **diagnostic failure:** evidence was not captured
- **implementation failure:** code did not meet the specification
- **architecture failure:** the chosen source or mechanism cannot satisfy the requirement reliably
- **tooling failure:** the environment cannot complete the edit-test-review-publish loop
- **manual-test failure:** synthetic checks passed but TornPDA behavior failed

A failed route is not automatically a failed project.

When a route is rejected:

1. protect `main`
2. close the PR unmerged
3. record what succeeded
4. record what failed and the evidence
5. identify the replacement architecture or unresolved dependency
6. remove temporary scaffolding
7. preserve useful tests or findings
8. update the roadmap and decision register

## Priority challenge rule

The owner authorizes the assistant to speak up when:

- another dependency should come first
- a feature is premature
- the selected coding tool is wasteful or inadequate
- the scope mixes unrelated systems
- a lower-cost method can safely do the work
- a simpler design would serve the goal
- active work exceeds the project limit
- the implementation weakens integrity or maintainability
- further iteration is repeating a disproven approach

The assistant should explain the reason and propose the better sequence, not merely block progress.

## Coding-budget doctrine

Coding usage is purchased for implementation, not for unresolved product debate.

Use this chat and repository documentation for:

- discussion
- research
- prioritization
- issue writing
- acceptance criteria
- review
- manual-test interpretation
- release decisions

Use coding agents only after the specification is sufficiently frozen.

Prefer:

- one primary implementation pass
- one consolidated review-and-correction pass
- at most one bounded repair driven by a concrete test or TornPDA failure

Beyond that, pause and re-scope rather than repeatedly patching uncertain architecture.

## Roadmap governance

`docs/ROADMAP.md` is the canonical project sequence. Every meaningful project should record:

- problem
- outcome
- dependencies
- risk tier
- recommended tool
- coding-budget class
- status
- success evidence
- fallback
- priority

Ideas may be captured without committing them to active implementation.

## Decision register

Architecture and process decisions belong in `docs/DECISION-REGISTER.md`.

A decision record should include:

- question
- decision
- evidence
- consequences
- revisit condition

This prevents later agents from repeating rejected experiments because the history was trapped in a chat thread.

## Adoption and amendment

This charter and its mutual covenant become active only after owner review and explicit merge authorization.

Future amendments should use a documentation-only branch and pull request. Amendments may strengthen safety or clarify workflow. They should not silently grant an agent merge authority or weaken data protection, mutual accountability, or the owner's exclusive merge authority.
