# TornScriptures Development Workflow

## Purpose

This workflow turns project discussion into tested, reviewable, and reversible releases while controlling coding-agent cost.

## Lifecycle

Every substantial project moves through:

1. Discussion
2. Specification
3. Toolchain preflight
4. Implementation
5. Automated verification
6. Assistant review
7. Manual TornPDA verification
8. Release authorization
9. Merge and cleanup
10. Post-release confirmation

Skipping a phase requires an explicit reason. High-risk accounting work does not skip phases.

## Phase 1: discussion

No product code changes.

Resolve:

- user problem
- desired outcome
- user-facing behavior
- dependencies
- alternatives
- likely risk
- likely tool class
- current roadmap priority

Capture adjacent ideas without automatically adding them to scope.

## Phase 2: specification

Create or update a GitHub issue using the coding task structure.

Freeze:

- mission
- baseline
- required behavior
- existing architecture to reuse
- scope
- exclusions
- safety invariants
- acceptance criteria
- automated tests
- protected regressions
- manual test plan
- rollback
- stop conditions
- coding budget

No coding agent should be asked to host unresolved product debate.

## Phase 3: toolchain preflight

Before product edits, the selected coding environment must prove:

1. full repository materialization
2. correct base branch and exact SHA
3. clean working tree
4. required runtimes and commands
5. baseline syntax and relevant tests
6. isolated feature branch creation
7. complete diff inspection
8. verified commit publication

A preflight task should make no product changes.

### Preflight report

Require:

- repository path
- base branch
- base SHA
- userscript version
- `git status`
- test commands
- test results
- environment limitations

Stop if the baseline is not reproducible.

## Tool selection

### This chat plus GitHub connector

Use for:

- discussion
- research
- issue and roadmap writing
- documentation-only changes when full-file writes and diff review are sufficient
- PR review
- branch and PR administration
- release authorization and merge

Do not treat it as a full coding workspace unless it can execute the required tests against the complete repository.

### Codex or equivalent strong full-repository agent

Use for:

- Tier 3 and Tier 4 work
- multi-file stateful changes
- API integration touching persistent data
- migrations
- FIFO, deduplication, purchase, sale, or receipt logic
- major architecture

### GitHub Copilot cloud agent

Use for:

- issue-to-PR implementation
- Tier 1 and Tier 2 work
- Tier 3 only after toolchain proof and with full review and manual gates

The assistant may review and steer through GitHub issues and PR comments.

### Aider or OpenCode

Use locally when the owner establishes a checked-out repository and is comfortable relaying prompts.

- Aider: controlled, bounded Git-oriented edits
- OpenCode: broader local autonomous work with explicit permissions

Use strong models for high-risk work. Free local models are not automatically appropriate for accounting-critical changes.

## Risk and coding-budget classes

| Risk | Typical work | Tool class | Coding budget |
|---|---|---|---|
| Tier 0 | planning, research, review | chat and GitHub | none |
| Tier 1 | docs, wording, read-only diagnostics | connector, free agent, local tool | light |
| Tier 2 | persistent UI, filters, read-only API | capable agent | standard |
| Tier 3 | ledger, FIFO, recovery, migrations | strong full-repo agent | premium |
| Tier 4 | storage redesign, servers, public sync | strong agent plus architecture review | premium, staged |

## Branch rules

- Branch from the exact approved baseline.
- Use a descriptive branch name.
- One branch should have one primary mission.
- Do not mix unrelated cleanup.
- Keep `main` free from experiments and temporary tooling.

Suggested prefixes:

- `fix/`
- `feature/`
- `docs/`
- `test/`
- `chore/`
- `agent/` for coding-agent work when useful

## Implementation pass

The primary implementation request should include:

- code
- focused tests
- protected regressions
- cleanup of replaced code
- documentation
- version markers when release code changes
- PR description
- manual test steps

The agent must stop rather than invent behavior outside the specification.

## Automated verification

At minimum for changed userscripts:

```bash
node --check path/to/script.user.js
git diff --check
```

Run focused subsystem tests and protected regressions identified in the issue.

Inspect and report:

- changed files
- version markers
- storage keys
- schema changes
- API endpoints
- event listeners
- timers
- observers
- ownership IDs
- data migrations

For documentation-only changes:

- inspect branch-to-main file list
- verify no userscript, test, workflow, or release metadata changed
- validate YAML issue forms
- inspect Markdown links and headings

## Assistant review

The assistant reviews the complete PR before requesting another paid agent pass.

Review for:

- scope compliance
- architectural duplication
- safety-boundary changes
- persistence and migration effects
- accounting invariants
- duplicate handling
- event lifecycle and repeated initialization
- TornPDA compatibility
- missing tests
- unsupported assumptions
- diff size and unrelated churn

Return one consolidated correction request where possible.

## Correction-cycle limit

Default maximum:

1. primary implementation pass
2. one consolidated correction pass
3. one bounded repair for a concrete automated or TornPDA defect

If uncertainty remains after that, pause and re-scope. Do not continue paying for patches to an unclear architecture.

## Manual verification

The manual plan must state:

- exact branch build and head SHA
- Torn page
- setup data
- owner action
- expected visible result
- expected stored-data result
- what must not happen
- reload or retry behavior
- desktop check when relevant
- TornPDA check when relevant
- backup and rollback

For ledger work, follow `docs/LEDGER-INVARIANTS.md`.

Synthetic tests are necessary evidence, not proof of live Torn behavior.

## Release gate

Before merge, confirm:

- correct PR
- exact head SHA
- approved scope
- automated checks passed
- assistant review complete
- manual gate passed
- storage and migration impact understood
- rollback documented
- known limitations accepted
- owner explicitly authorizes merge

No coding agent may merge its own work.

## Merge

Use the repository's approved merge method. Prefer a coherent history and avoid carrying disposable implementation noise when squash merge is appropriate.

After merge:

1. verify `main` head
2. verify released userscript version
3. verify raw install/update URL when applicable
4. close linked issue
5. record branch deletion status
6. update roadmap and decision register
7. retain rejected branches only when they preserve useful evidence

## Post-release

Confirm the released build independently from the branch build when the change is consequential.

For high-risk work:

- reload the main build
- verify persisted state
- rerun Ledger Integrity
- confirm no duplicate mutation
- preserve recovery export until confidence is established

## Failed implementation handling

When a route fails:

- stop mutation work
- protect `main`
- determine what the failure proves
- allow one bounded diagnostic when useful
- close the failed PR unmerged
- document successful and failed portions
- record replacement architecture
- remove temporary scaffolding
- update decision register and roadmap

Use precise labels:

- implementation failure
- architecture failure
- tooling failure
- manual-test failure

Do not label the whole project failed when only one route failed.

## Active-work regulation

At most:

- one Tier 3 or Tier 4 implementation
- one Tier 1 or Tier 2 side implementation

New ideas go to backlog unless they are required dependencies.

## Coding-agent communication loops

### Cloud agent through GitHub

1. assistant prepares issue
2. owner or assistant assigns agent when available
3. agent opens PR
4. assistant reviews through GitHub
5. agent receives consolidated comments
6. owner performs TornPDA test
7. owner authorizes merge
8. assistant merges and closes

### Local agent

1. assistant prepares task brief
2. owner runs agent in local clone
3. agent commits to branch
4. owner pushes branch
5. assistant reviews PR
6. owner relays one consolidated correction prompt when needed
7. owner performs TornPDA test
8. owner authorizes merge

The owner should not be required to ferry many small code fragments between systems.

## Documentation upkeep

Update durable project context when decisions change:

- `AGENTS.md`
- `docs/PROJECT-CHARTER.md`
- `docs/ASSISTANT-OPERATING-RULES.md`
- `docs/LEDGER-INVARIANTS.md`
- `docs/ROADMAP.md`
- `docs/DECISION-REGISTER.md`
- issue and PR descriptions
- tests

Project history should not depend on recovering an old chat thread.
