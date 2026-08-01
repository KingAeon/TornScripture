# Trader Book Tools Decoration Restore

## Release target

IMM v0.19.24

## Problem

IMM v0.19.23 correctly removes Target Library and Trader Price Control when Compact Tools closes, but live TornPDA testing shows that opening Tools no longer mounts either decoration.

## Goal

Restore reliable open-state decoration without reintroducing stale or stranded panels.

## Requirements

- Compact Tools defaults closed with no decoration mounted.
- Opening Tools mounts exactly one Target Library and one Trader Price Control inside the explicit generation-bound decoration host.
- If `window.__TSIMM_WATCHLIST_API__?.decorateBook` is unavailable at the first attempt, use a bounded retry tied to the same overlay, render generation, open Tools element, and connected host.
- Closing Tools synchronously removes decorations and invalidates all pending retries.
- Switching Compact/Detailed, opening a dossier, closing/reopening Trader Book, replacing the overlay render, or detaching the host invalidates pending work.
- Detailed mode continues using its own explicit host.
- Never append to the Trader Book shell, list, dossier, or overlay root as a fallback.
- Preserve four-row Compact density after Tools closes.
- Preserve one overlay owner and all existing Trader Book data, sorting, filters, storage, accounting, and gameplay safeguards.

## Scope guard

Presentation and decoration lifecycle only. Do not change Trader Book accounting, Ledger behavior, storage keys, IMM_LAYERS, gameplay actions, or issue #78 price-refresh reliability.

## Validation

- `node --check TornScripture-Item-Market-Margin.user.js`
- `git diff --check`
- five `0.19.24` markers and zero stale `0.19.23` markers
- unchanged protected-function counts
- unchanged storage-key set
- listener, observer, interval, timeout, overlay-owner, and IMM_LAYERS comparisons
- fixtures for initial mount, delayed API availability, close-before-mount, repeated open/close, mode switch, dossier switch, overlay replacement, duplicate prevention, and Detailed-mode host behavior

## Manual smoke test after implementation

1. Install the branch build and confirm IMM v0.19.24.
2. Open Compact Trader Book with Tools closed and confirm four rows.
3. Open Tools and wait up to five seconds.
4. Confirm exactly one Target Library and one Trader Price Control appear.
5. Close Tools and wait five seconds.
6. Confirm both disappear and four rows return.
7. Repeat open/close three times.
8. Open Tools and switch Detailed, then back to Compact.
9. Open Tools and open a dossier, then Back.
10. Confirm one overlay, no duplicates, no horizontal overflow, and clean Ledger Integrity.

## Failure conditions

Do not merge if decorations fail to mount, remain after Tools closes, duplicate, leak into Detailed or dossier views, reduce Compact density after close, or alter storage, accounting, or gameplay behavior.