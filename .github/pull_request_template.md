# TornScriptures Pull Request

## Linked project

- Issue: #
- Project mode: Implementation / Verification / Release
- Risk tier: Tier 0 / 1 / 2 / 3 / 4
- Coding-budget class: None / Light / Standard / Premium / Staged premium

## Baseline

- Base branch:
- Exact base SHA:
- Starting userscript/version:
- Head branch:
- Exact head SHA:

## Mission

Describe the one primary outcome of this pull request.

## What changed

- 
- 
- 

## Why this architecture

Explain the source of truth, existing owners reused, and why this route is safer or more maintainable than alternatives.

## In scope

- 
- 

## Explicitly out of scope

- 
- 

## Safety and invariant review

- [ ] Userscript `SAFETY BOUNDARY` remains accurate.
- [ ] No unattended gameplay action was added.
- [ ] API keys are sent only to official Torn endpoints.
- [ ] No key, cookie, session data, private export, or personal inventory data is committed.
- [ ] Existing counterparty and confirmation gates were not weakened.
- [ ] Repeated initialization cannot create duplicate listeners, timers, observers, panels, badges, or controls.
- [ ] Persistent mutations fail closed when source data is incomplete or ambiguous.
- [ ] Black Ledger work follows `docs/LEDGER-INVARIANTS.md`.
- [ ] Cancel, failure, retry, reload, and duplicate paths have defined behavior.

## Persistent-data impact

- Storage keys added, removed, or renamed:
- Schema or normalization changes:
- Migration behavior:
- Import/export impact:
- Rollback compatibility:

Write `None` where applicable.

## Runtime surface changes

- API endpoints added or removed:
- Event listeners added or removed:
- Timers added or removed:
- MutationObservers added or removed:
- DOM ownership IDs added or removed:
- Permissions or userscript metadata changed:

Write `None` where applicable.

## Changed files

- 

## Automated validation

List exact commands and results.

```text
command: result
```

Required minimum for changed userscripts:

```bash
node --check path/to/changed-script.user.js
git diff --check
```

Protected regressions run:

- 

Checks not run and reason:

- 

## Manual verification

- Environment: TornPDA / Tampermonkey / Violentmonkey / other
- Exact branch build and head SHA:
- Backup taken:
- Torn page:
- Setup:
- Actions:
- Expected visible result:
- Expected stored result:
- Prohibited result:
- Reload/retry result:
- Ledger Integrity result when applicable:

Do not mark manual verification complete unless it was actually performed.

## Rollback

- Prior stable version and commit:
- Reinstall path:
- Data restore procedure:
- Migration caveats:

## Known limitations and assumptions

- 

## Review status

- [ ] Complete diff inspected.
- [ ] Scope matches the linked issue.
- [ ] No unrelated cleanup or formatting churn.
- [ ] Assistant review complete.
- [ ] Required coding-agent corrections complete.
- [ ] Manual owner gate complete.
- [ ] Exact release head SHA recorded.

## Merge gate

- [ ] This pull request remains unmerged.
- [ ] Auto-merge is disabled.
- [ ] The coding agent has not merged its own work.
- [ ] The project owner explicitly authorized merging this exact pull request and head SHA.

Owner merge authorization:

> Pending

## Post-merge checklist

- [ ] Verify `main` head.
- [ ] Verify released userscript version.
- [ ] Verify raw install/update URL when applicable.
- [ ] Close linked issue.
- [ ] Record branch deletion status.
- [ ] Update roadmap and decision register.
