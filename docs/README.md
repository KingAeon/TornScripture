# TornScriptures Documentation

## Governance index

Use these documents together:

- [`../AGENTS.md`](../AGENTS.md): standing instructions for coding agents and repository contributors.
- [`PROJECT-CHARTER.md`](PROJECT-CHARTER.md): authority, roles, project modes, interpretation defaults, work limits, and merge authority.
- [`MUTUAL-COVENANT.md`](MUTUAL-COVENANT.md): bilateral commitments, checks and balances, rights to object or pause, and accountability for both owner and assistant.
- [`ASSISTANT-OPERATING-RULES.md`](ASSISTANT-OPERATING-RULES.md): restrictions and responsibilities governing the project assistant.
- [`LEDGER-INVARIANTS.md`](LEDGER-INVARIANTS.md): non-negotiable Black Ledger accounting, FIFO, deduplication, recovery, and integrity rules.
- [`DEVELOPMENT-WORKFLOW.md`](DEVELOPMENT-WORKFLOW.md): toolchain preflight, implementation, review, manual testing, release, and failure handling.
- [`ROADMAP.md`](ROADMAP.md): active sequence, risk tiers, coding-budget classes, tool recommendations, and backlog.
- [`CODING-TASK-TEMPLATE.md`](CODING-TASK-TEMPLATE.md): reusable implementation brief for Codex, Copilot, Aider, OpenCode, Cursor, or another coding agent.
- [`DECISION-REGISTER.md`](DECISION-REGISTER.md): durable architecture and process decisions with revisit conditions.

## Which document answers what?

| Question | Read |
|---|---|
| Who may decide, implement, review, or merge? | Project Charter |
| How are the owner and assistant both held accountable? | Mutual Governance Covenant |
| How should the assistant interpret my rough request? | Assistant Operating Rules |
| What must a coding agent do before editing? | AGENTS.md and Development Workflow |
| Can this ledger transaction be recorded safely? | Ledger Invariants |
| Which project is next and what tool should handle it? | Roadmap |
| What prompt should be sent to a coding agent? | Coding Task Template |
| Why was a previous route rejected? | Decision Register |

## GitHub intake

- New ideas use `.github/ISSUE_TEMPLATE/feature.yml`.
- Defects use `.github/ISSUE_TEMPLATE/bug.yml`.
- Pull requests use `.github/pull_request_template.md`.

The forms are not intended to make the owner write formal specifications. They preserve evidence and give the assistant enough structure to refine the request.

## Governing sequence

`discussion → specification → toolchain preflight → isolated implementation → verification → owner authorization → release`

When documents conflict, use this priority:

1. owner instruction for the specific task
2. safety and data-protection invariants
3. project charter and mutual covenant
4. assistant and agent operating rules
5. development workflow
6. roadmap priority

A task-specific instruction may clarify behavior but should not silently weaken safety, data integrity, mutual accountability, or exclusive owner merge authority.
