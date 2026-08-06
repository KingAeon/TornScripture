# COPILOT PREFLIGHT

- Date (UTC): 2026-08-06
- Agent: GitHub Copilot Coding Agent (`@copilot`)
- Repository: `KingAeon/TornScripture`
- Linked issue: #102
- Current correction branch: `copilot/validate-github-copilot-workflow`
- Required base branch: `main`
- Required base SHA: `d0bdd435c292bdd8fe5bf192d98a487c3282ad5e`
- Starting IMM version: `0.19.33`
- Capability verdict: `PASS`

## Scope and restrictions

This is a documentation-only tooling preflight. No `.user.js`, test, workflow, governance, storage, API, release-metadata, or Issue #97 behavior change is permitted. The work remains on the existing draft PR branch and remains unmerged.

## Governing instructions read

- `/home/runner/work/TornScripture/TornScripture/AGENTS.md`
- `/home/runner/work/TornScripture/TornScripture/.github/copilot-instructions.md`
- `/home/runner/work/TornScripture/TornScripture/docs/PROJECT-CHARTER.md`
- `/home/runner/work/TornScripture/TornScripture/docs/MUTUAL-COVENANT.md`
- `/home/runner/work/TornScripture/TornScripture/docs/DEVELOPMENT-WORKFLOW.md`
- `/home/runner/work/TornScripture/TornScripture/docs/LEDGER-INVARIANTS.md`
- `/home/runner/work/TornScripture/TornScripture/docs/DECISION-REGISTER.md`

### Restrictions confirmed from those instructions

- Work only from approved Issue #102 on an isolated branch, never `main`.
- Keep scope to the single preflight artifact and avoid unrelated cleanup.
- Run existing baseline checks before edits and stop if they fail.
- Record exact SHA, branch, working-tree state, commands, and results.
- Do not claim browser or TornPDA validation that did not occur.
- Do not merge or treat passing checks as merge authorization.

## Repository materialization and clean-tree proof

- Repository path: `/home/runner/work/TornScripture/TornScripture`
- Verified base ref: `refs/remotes/origin/main`
- Verified base SHA: `d0bdd435c292bdd8fe5bf192d98a487c3282ad5e`
- Active branch before edit: `copilot/validate-github-copilot-workflow`
- `git status --short` before edit: clean

## Repository structure summary

Top-level workspace contents include:

- userscripts: `TornScripture-Item-Market-Margin.user.js`, `TornScripture-War-Intelligence-HUD.user.js`, `TornScripture-Inventory-Sales-HUD.user.js`
- baseline Node tests under `/home/runner/work/TornScripture/TornScripture/tests`
- additional Python Playwright probes: `test_playwright.py`, `test_market_playwright.py`, `test_compact_playwright.py`
- governance and workflow docs under `/home/runner/work/TornScripture/TornScripture/docs`

## Available validation surface discovered

### Runtimes

- `node --version` → `v22.23.1`
- `npm --version` → `10.9.8`
- `python3 --version` → `Python 3.12.3`

### Existing baseline checks discovered and run

```text
git fetch --unshallow origin && git fetch origin main:refs/remotes/origin/main && git fetch origin copilot/validate-github-copilot-workflow:refs/remotes/origin/copilot/validate-github-copilot-workflow
  exit 0
  verified origin/main=d0bdd435c292bdd8fe5bf192d98a487c3282ad5e
  verified origin/copilot/validate-github-copilot-workflow=3ff44be87cd3019595c8ebb081d94354239eda20

git branch --show-current
  copilot/validate-github-copilot-workflow

git status --short
  clean

node --check TornScripture-Item-Market-Margin.user.js
  exit 0

node --check TornScripture-War-Intelligence-HUD.user.js
  exit 0

node --check TornScripture-Inventory-Sales-HUD.user.js
  exit 0

node --test tests/imm-carousel-zero-price-mismatch.test.js
  pass

node --test tests/imm-carousel-identity-precedence.test.js
  pass

node --test tests/inventory-sales-core.test.js
  pass
```

## Discovered checks not run

```text
python test_playwright.py
python test_market_playwright.py
python test_compact_playwright.py
```

Reasons:

- all three import `playwright.sync_api`, but Python `playwright` is not installed in this workspace
- all three require fixture root `/mnt/data/tornscripture-item-market-margin-v0.2.1`, which is absent here
- no speculative dependency install or synthetic fixture fabrication was allowed for this preflight

## Existing remote publication state verified

- Remote draft PR: `#103` `Copilot preflight: validate repository workflow`
- Remote PR branch: `copilot/validate-github-copilot-workflow`
- Remote PR base: `main` @ `d0bdd435c292bdd8fe5bf192d98a487c3282ad5e`
- Remote PR state at correction start: draft, open, unmerged
- Remote PR file list at correction start: no changed files, so recreating this report is the only intended diff

## Files changed

```text
docs/tooling/COPILOT-PREFLIGHT.md
```

## Final local state after report recreation

- `git status --short --untracked-files=all` after report creation: `?? docs/tooling/COPILOT-PREFLIGHT.md`
- final diff summary after report creation: one new path, `docs/tooling/COPILOT-PREFLIGHT.md`
- `git diff --check`: exit 0

## Environment and permission limitations

- This correction pass reuses the existing PR branch and existing draft PR by owner instruction; it does not open a new branch or new PR.
- Browser, Torn, and TornPDA runtime behavior were not exercised in this environment.
- Playwright-based Python checks remain unavailable because both the module and required fixture directory are missing.

## Result statement

The repository workspace was materialized, the required baseline SHA and IMM version were verified, the governing instructions were read, the applicable baseline checks passed, the existing isolated PR branch was updateable, and the branch diff was intentionally constrained to this single report file for publication back to the existing draft PR.

**No browser or TornPDA behavior was tested or claimed in this preflight.**
