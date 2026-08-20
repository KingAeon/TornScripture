# TornPDA Native Storage Evidence — Settings Clear Controls

Status: **official-source finding / Age of Discovery**

Reviewed: 2026-08-10

TornPDA source reviewed: `lib/pages/settings/settings_browser.dart`

This note records an important distinction in TornPDA v3.15's current Browser settings UI.

## Browser cache → Clear

Current TornPDA source renders a settings row labeled **Browser cache** with a **Clear** button.

The button calls:

`_webViewProvider.clearCacheAndTabs()`

and reports:

`Browser cache and tabs have been reset!`

This is the correct control for TornScriptures Phase H because it targets browser cache/tabs rather than the native userscript-storage database.

## Userscript storage → Clear

Current TornPDA source separately renders a settings row labeled **Userscript storage** with its own **Clear** button.

Before acting, TornPDA shows a confirmation explaining that the action:

- deletes all data userscripts saved through TornPDA native storage
- does not delete the userscripts themselves
- expects scripts to rebuild data as needed

After confirmation, the implementation calls:

`ScriptStorage.deleteAll()`

## Consequence for TornScriptures

This is a first-class durability boundary.

Even if `PDA_storage` survives browser-cache clearing, reloads, restarts, tab recreation and normal userscript updates, TornPDA deliberately provides the user with an application control that can erase **all native userscript data**.

Therefore:

1. `PDA_storage` must not be described as impossible to lose.
2. Any future use for irreplaceable TornScriptures data requires independent export/backup/restore behavior.
3. Public TornScriptures documentation would need to distinguish **Browser cache** from **Userscript storage** clearly.
4. Phase H must press only **Browser cache → Clear**.
5. **Userscript storage → Clear must not be pressed during the current persistence-marker sequence.** A destructive-clear/recovery experiment, if ever useful, should be a separate controlled test after all persistence evidence is preserved.

## Architecture action

None. This is a platform-capability/lifecycle finding only.
