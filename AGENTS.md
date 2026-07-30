# TornScripture Agent Guide

This file defines the standing rules for AI coding agents working in this repository.
Task-specific instructions from the user still take priority, but agents must preserve the safety, compatibility, and release rules below unless the user explicitly changes them.

## Project purpose

TornScripture is a collection of quality-of-life userscripts and utilities for Torn.
Its tools organize, calculate, record, and visualize information that is already available to the player.
They must not silently play the game, make decisions for the player, or perform unapproved gameplay actions.

## Repository landmarks

Primary userscripts currently include:

- `TornScripture-Item-Market-Margin.user.js` - Item Market Margin, abbreviated IMM. This is the most actively developed script and includes market overlays, trader tools, purchase and sale tracking, Priced Trade, Trade Exit Audit, and the Black Ledger accounting systems.
- `TornScripture-War-Intelligence-HUD.user.js` - War Intelligence HUD, abbreviated WIH. It records visible faction observations locally and provides history, diagnostics, and reports.
- `TornScripture-Inventory-Sales-HUD.user.js` - Inventory Sales HUD, abbreviated ISH. It performs user-triggered inventory scans and builds local sale plans.
- `data/` - shareable configuration and example data. Never place API keys, private inventory exports, or personal data here.
- `.github/` - repository automation and workflows.
- `scripts/` - temporary or maintained development utilities. Do not leave one-use patchers behind unless the user explicitly wants them retained.

Before editing a file, read its userscript metadata block, `SAFETY BOUNDARY`, application constants, storage keys, and the complete functions involved in the requested behavior.

## Release safety

`main` is effectively the live release channel because userscript `@downloadURL` and `@updateURL` metadata points to raw files on `main`.

Therefore:

1. Do not push unreviewed `.user.js` changes directly to `main`.
2. Use a focused branch for code changes.
3. Show the user the relevant diff and validation results before merge.
4. Documentation-only changes do not require a userscript version bump.
5. For a release-ready userscript change, increment the patch version unless the user specifies another versioning decision.
6. Update every matching version marker consistently, including metadata, ownership markers, header comments, and application constants.
7. Do not create temporary self-modifying release workflows or trigger files unless the user explicitly requests that release method.

## Non-negotiable product boundaries

- Preserve the safety boundary written inside each userscript.
- No unattended gameplay automation.
- No automatic buying, selling, listing, sending, accepting, attacking, traveling, training, or other gameplay actions.
- A helper may fill a field only when that behavior is already within the script's documented boundary and remains clearly user-triggered.
- Destructive or bulk actions require an explicit user action and confirmation.
- API calls must be intentional and documented. API keys may be sent only to the official Torn API.
- Never commit API keys, session data, cookies, private exports, or personal inventory data.
- Keep stored information browser-local unless the feature explicitly exports data at the user's request.
- Do not weaken counterparty verification, confirmation gates, or action-arming safeguards to make a feature appear more reliable.

## Compatibility rules

- Treat TornPDA on Android as a first-class environment.
- Also preserve Tampermonkey and Violentmonkey compatibility in normal desktop browsers.
- Do not assume Node.js APIs, build tooling, modules, or browser extensions exist inside the userscript runtime.
- Prefer standard browser APIs supported by modern Chromium WebViews.
- Account for Torn's dynamic page navigation, delayed rendering, recycled DOM nodes, and mobile layouts.
- Avoid fixed widths that overflow narrow screens.
- Interactive controls must remain usable by touch.
- Do not depend solely on hover behavior.
- Preserve dark, light, and automatic theme behavior where already supported.

## Change discipline

1. Restate the requested behavior and identify the affected script or subsystem.
2. Inspect before editing. Find the existing owner, render path, event binding, storage path, and cleanup path.
3. Explain the likely root cause before proposing a patch when fixing a bug.
4. Make the smallest coherent change that fixes the issue.
5. Avoid unrelated cleanup, renaming, formatting churn, or architectural rewrites.
6. Reuse existing helpers and ownership markers instead of creating parallel systems.
7. Ensure repeated initialization is safe and does not create duplicate panels, badges, buttons, observers, timers, or listeners.
8. Preserve existing storage keys and exported schemas whenever possible.
9. When stored data must change shape, add normalization or migration logic that remains backward compatible.
10. Keep cleanup and deduplication reversible when practical, especially for ledger data.
11. Do not silently delete historical records or reset user settings.
12. Keep comments focused on safety boundaries, non-obvious browser behavior, migrations, and invariants.

## IMM protected systems

Item Market Margin is a large single-file application with several systems sharing state and DOM ownership. Before editing IMM, search for and understand all callers of the relevant functions and keys.

Treat these areas as protected unless the task specifically targets them:

- early trader price-page capture and handoff
- transaction and purchase capture
- purchase-lot and capital-source accounting
- Black Ledger normalization, deduplication, cleanup, and receipt audits
- completed trade sale recording
- Priced Trade counterparty verification
- row badge ownership and duplicate prevention
- Quick MAX and Override MAX arming and submission boundaries
- Trade Exit Audit read-only comparison behavior
- trader classification, hiding, and watchlists
- stored catalog and trader-book compatibility

At minimum, verify that these established functions still exist after broad IMM changes:

- `recordTradeSale`
- `pricedTradeRenderRowBadge`
- `pricedTradeEnsureNativeMaxButton`
- `normalizeLedger`

Do not duplicate these systems with a second implementation. Repair or extend the existing owner.

## WIH data rules

- Preserve the existing IndexedDB and local-storage identifiers so upgrades do not erase history.
- Do not manufacture certainty from incomplete observation coverage.
- Reports must distinguish observations, gaps, and inference.
- Keep import, export, purge, and diagnostics usable on Android.
- Avoid background requests or gameplay actions unless the user explicitly redesigns the product boundary.

## ISH data rules

- Inventory scans remain user-triggered.
- Weapons and armor remain protected from automatic sale recommendations.
- The script must not sell, send, list, or trash items.
- Keep API keys and inventory data local.
- Preserve the TornPDA managed-key placeholder.
- Recommendations must remain distinguishable from actions.

## Validation

Run the narrowest checks that cover the change, then report exactly what ran and whether it passed.

For any changed userscript:

```bash
node --check path/to/changed-script.user.js
git diff --check
```

Also verify:

- the metadata version matches the internal application version for release changes
- no API key, secret, private export, or generated personal data entered the diff
- no duplicate DOM ownership IDs, badges, panels, timers, observers, or listeners were introduced
- existing storage keys were not renamed accidentally
- mobile layout does not gain obvious horizontal overflow
- the safety boundary still accurately describes behavior

For IMM changes, search for the protected functions listed above and run focused checks for the edited subsystem.

If automated browser tests are unavailable, provide a concise manual smoke-test checklist instead of claiming the feature is fully tested.

## Manual smoke-test expectations

A useful smoke test should name:

- the Torn page to open
- the user action to perform
- the expected visible result
- the expected stored-data result, when applicable
- what must not happen
- desktop and TornPDA checks when the UI or DOM behavior changed

## Agent response format

After completing a task, report:

1. What changed
2. Why it changed
3. Files touched
4. Validation performed
5. Manual test steps still needed
6. Risks, assumptions, or intentionally untouched systems

Never claim a browser behavior was tested unless it was actually exercised in a browser environment.
