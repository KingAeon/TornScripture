# TornScriptures Copilot Instructions

Before acting, read `AGENTS.md` and the relevant files under `docs/`, especially `PROJECT-CHARTER.md`, `DEVELOPMENT-WORKFLOW.md`, `LEDGER-INVARIANTS.md`, and `DECISION-REGISTER.md`.

## Required behavior

- Work only from a linked, approved issue or task specification.
- Use an isolated branch. Never edit or push product changes directly to `main`.
- Report the exact base SHA, starting userscript version, and clean working-tree state before editing.
- Run the existing baseline checks before changing product code. Stop and report if baseline checks fail.
- Keep changes inside approved scope. Avoid unrelated cleanup, renaming, formatting churn, or architecture rewrites.
- Reuse existing owners, helpers, storage keys, and safety gates rather than creating parallel implementations.
- Treat TornPDA on Android as a first-class environment.
- Never invent Torn behavior, API data, participants, items, cash, quantities, or successful browser testing.
- Persistent and accounting paths fail closed when source data is incomplete or ambiguous.
- Never commit API keys, cookies, session data, private exports, or personal inventory data.
- Run the narrowest relevant automated checks and report exact commands and results.
- Provide manual TornPDA test steps when browser behavior changes.
- Do not merge, enable auto-merge, or treat passing tests as owner release authorization.

## Stop conditions

Stop and report instead of improvising when:

- the repository, baseline SHA, branch, or task scope is unclear
- baseline tests fail before changes
- a required API shape differs from the approved contract
- the task would require an unapproved migration or protected-system rewrite
- ledger coverage, transaction identity, ownership, or source truth is ambiguous
- the requested result cannot be verified in the available environment

Complete responses must state what changed, files touched, validation performed, manual testing still needed, assumptions, risks, and intentionally untouched systems.
