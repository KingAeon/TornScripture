# TornPDA Native Storage Verification Protocol

Status: **Age of Discovery / controlled live verification**

Probe: [`probes/TornPDA-Storage-Probe.user.js`](probes/TornPDA-Storage-Probe.user.js)

Target platform baseline: TornPDA v3.15.0 or later with documented `PDA_storage` support.

This protocol verifies TornPDA native userscript storage on the owner's real device before TornScriptures considers any production migration. It does not authorize changing IMM, ISH, WIH, Black Ledger, API-key storage, or other runtime behavior.

## Safety boundary

The probe:

- does not request or read a Torn API key
- makes no Torn API requests
- makes no gameplay requests
- does not read or write known IMM, ISH, WIH, Black Ledger, trader, purchase, or receipt keys
- uses only keys beginning `ts-discovery-storage-probe:` inside its TornPDA-assigned native namespace
- removes its ordinary contract-test keys after each safe test run
- v0.1.1 retains only the explicitly user-created persistence marker plus a tiny bounded lifecycle log used to prove page/WebView recreation
- keeps at most 12 persisted lifecycle entries
- does not force quota exhaustion in v0.1.1

**Do not uninstall the probe while testing persistence.** Current TornPDA source intentionally deletes a userscript's native-storage namespace when that script is removed.

## Probe revisions

### v0.1.0

Initial contract and persistence-marker probe.

### v0.1.1

Adds lifecycle diagnostics without changing the persistence-marker key or userscript identity:

- calls documented `PDA_getTabState`
- listens for documented `tornpda:tabState` events
- displays current TornPDA tab UID, active state and WebView visibility
- records one small lifecycle entry each time the probe userscript is genuinely loaded/recreated
- stores a random per-load ID, timestamp, probe version, URL and tab-state snapshot
- bounds the persisted lifecycle log to the most recent 12 entries

The lifecycle log exists only to distinguish a page that remained alive from a page/WebView that was released and later recreated.

## Evidence to capture

For each checkpoint record:

- TornPDA version
- probe version
- device/platform
- date/time
- whether `PDA_storage` is detected
- safe-test pass/fail summary
- `usage().used` and `usage().quota`
- operation latency values from the report
- persistence-marker ID
- whether the marker survived the checkpoint
- for v0.1.1+, current load ID, TornPDA tab UID and lifecycle-entry count when relevant
- any toast, exception, reload, blank page, or other abnormal behavior

A copied JSON report or screenshot is preferred over recollection.

## Phase A — Initial contract test

1. Install the probe as its own userscript in TornPDA.
2. Open an ordinary `https://www.torn.com/` page.
3. Confirm the probe panel says `PDA_storage detected: YES`.
4. Press **Run safe tests** once.
5. Do not navigate away until the report finishes.
6. Press **Copy report** and preserve the JSON in the TornScriptures discussion.

Expected checks include:

- storage availability
- primitive/object/array JSON round trips
- missing-key default behavior
- `setMany` / `getMany`
- `loadAll`
- `delete`
- `list`
- `usage`
- operation timing
- best-effort cleanup of ephemeral probe keys

**Gate A:** Stop if any normal contract check fails. Do not proceed to persistence testing until the failure is understood.

## Phase B — Ordinary page reload persistence

1. Press **Write persistence marker**.
2. Record the marker ID displayed by the probe.
3. Reload the current Torn page normally.
4. After the probe panel returns, press **Check marker**.
5. Record whether the same marker exists.

**Expected:** marker survives.

## Phase C — Torn navigation / WebView recreation

1. Keep the marker from Phase B.
2. Navigate to several unrelated Torn pages.
3. Return to a normal Torn page where the probe injects.
4. Press **Check marker**.

If TornPDA naturally recreates/reloads the WebView during this process, note that fact.

**Expected:** marker survives.

## Phase D — Disable / enable userscript

1. Keep the marker.
2. Disable the probe from TornPDA's User scripts screen without deleting it.
3. Navigate or reload once so the probe is genuinely absent.
4. Re-enable the same installed probe.
5. Open Torn and press **Check marker**.

**Expected:** marker survives because the installed script namespace should remain the same.

## Phase E — TornPDA app restart

1. Keep the marker.
2. Fully close TornPDA using the normal app-switcher/app-close path or force-stop it for a stronger restart checkpoint.
3. Reopen TornPDA.
4. Open Torn and press **Check marker**.

Record whether the browser tab itself was restored, rebuilt, or otherwise changed.

**Expected:** marker survives.

An Android app-cache clear may be recorded as additional evidence if performed, but it is not automatically equivalent to Phase H unless the cache-clearing surface is confirmed to match TornPDA's browser-cache control.

## Phase F — Background/tab-sleep behavior

TornPDA v3.15.0 added configurable unused-tab sleeping and Android background tab release behavior. Probe v0.1.1 adds lifecycle diagnostics so this phase does not rely only on elapsed time or visual guesswork.

### Before sleep/background release

1. Keep the existing persistence marker.
2. Under probe v0.1.1, press **Check lifecycle / tab state**.
3. Preserve the report or screenshot showing:
   - current load ID
   - tab UID
   - lifecycle-entry count
   - `isActiveTab`
   - `isWebViewVisible`
4. Note TornPDA's current Memory/tab-sleep configuration if visible.

### Trigger the lifecycle event

Use one controlled route that is actually available on the device:

- leave the probe tab unused longer than TornPDA's configured unused-tab sleep threshold while using another tab, or
- background TornPDA long enough for the enabled Android background-release behavior to release browser content

Do not force-stop the app for this phase; Phase E already owns full application restart.

### After returning

1. Return to the same Torn tab.
2. Press **Check marker** and confirm the original marker still exists.
3. Press **Check lifecycle / tab state**.
4. Preserve the report.
5. Press **Run safe tests** once more and copy the report.

### Interpretation

A strong Phase F result is:

- original marker survives
- native storage remains usable
- lifecycle log shows a new probe load when TornPDA actually recreated the page/WebView
- tab-state data remains available after resume
- post-resume safe contract tests still pass

If the lifecycle count/load ID does not change, storage persistence may still be fine, but the run does not prove WebView recreation. Record it as an ordinary background survival observation rather than over-claiming a sleep/recreation test.

**Expected:** native data survives even when the page/WebView is actually released and later recreated.

## Phase G — In-place userscript update

**Status: READY. Probe v0.1.1 is intentionally prepared for this checkpoint.**

This phase must use TornPDA's ordinary update path. Do not delete/re-add the probe.

1. Keep the existing persistence marker created under probe v0.1.0.
2. From TornPDA's existing installed probe entry, use its normal update/check-for-update path so v0.1.0 becomes v0.1.1 in place.
3. Confirm the installed script now reports **v0.1.1**.
4. Return to Torn.
5. Press **Check marker**.
6. Confirm the marker ID is still the original marker.
7. Press **Check lifecycle / tab state** and preserve the report.

Expected from current TornPDA source:

- marker survives because the installed script keeps its storage ID through an ordinary update
- v0.1.1 begins a bounded lifecycle log in the same native namespace
- current tab-state diagnostics are available without changing product data

**Failure boundary:** if TornPDA's UI offers only delete/reinstall rather than an ordinary update for this probe installation, stop. Do not simulate an update by removing the script because removal intentionally deletes the namespace.

## Phase H — TornPDA browser cache clear

This is a late checkpoint because it can alter the browsing session even though TornPDA documents native script storage as surviving browser-cache clearing.

Before proceeding:

- preserve the Phase A/F reports
- preserve the persistence-marker ID
- confirm no unrelated TornScriptures test depends on current browser-cache state

Then:

1. Keep the probe installed.
2. Clear TornPDA browser cache using TornPDA's normal browser-cache control. Do **not** wipe app data and do **not** uninstall the probe.
3. Return to Torn.
4. Press **Check marker**.
5. Press **Check lifecycle / tab state** under v0.1.1.
6. Run **Run safe tests** again and copy the report.

**Expected:** marker and lifecycle data survive browser-cache clearing and native operations remain healthy.

## Phase I — Quota/error behavior

Not part of probe v0.1.1's automatic test.

Reason: forcing a rejection would require intentionally constructing a payload near or above the script's current 10–50 MiB native quota. That is unnecessary until basic behavior is proven and may create avoidable memory pressure on mobile.

Before a quota test is added, specify:

- exact maximum allocation allowed for the probe
- how an expected `QuotaExceeded` is distinguished from bridge/runtime failure
- how partial-write absence is verified
- how all generated test data is cleaned up
- whether the current user-adjusted quota makes the test unreasonable on the device

## Phase J — Delete/reinstall behavior

Do **not** perform this as a persistence expectation test.

Current TornPDA source explicitly calls `ScriptStorage.deleteNamespace(storageId)` when an installed userscript is removed. Therefore loss of the marker after deletion is expected behavior, not a defect.

A future migration/recovery test may deliberately confirm this only after all useful persistence evidence is recorded.

## Passing threshold for first discovery gate

The native backend is considered **live-verified for non-critical candidate use** only after:

- Phase A passes without unexplained failures
- reload/navigation persistence passes
- disable/enable persistence passes
- TornPDA restart persistence passes
- at least one verified WebView recreation/tab-sleep scenario passes when available
- no operation exhibits unexplained data mutation
- latency is acceptable for load-once/batch-write usage

Browser-cache persistence should be verified before calling the backend a superior durable replacement for browser-local caches.

This threshold still does **not** qualify `PDA_storage` as the sole authority for Black Ledger or other irreplaceable accounting data.

## Result states

- **PASS — candidate backend:** suitable to advance into TornScriptures storage-inventory/source-fit discussion for reconstructible data.
- **PARTIAL:** useful capability exists, but one or more lifecycle or performance constraints need architecture treatment.
- **FAIL / unsuitable:** observed behavior makes it materially less reliable than the current source for the intended class of data.
- **INCONCLUSIVE:** environment/test conditions did not establish the result.
