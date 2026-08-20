# TornPDA Native Storage Evidence — Run 005 / Phase G

Status: **PASS — in-place userscript update persistence**

Date: 2026-08-10

Capability under test: TornPDA `PDA_storage`

Probe transition: `0.1.0` → `0.1.1`

This evidence file records the owner-provided live result for the controlled in-place userscript update checkpoint. It does not authorize any TornScriptures production storage migration.

## Existing persistence marker

The marker was created under probe v0.1.0 and had already survived reload, normal Torn navigation, disable/re-enable, TornPDA force-stop/reopen, and the owner's combined Android app-cache-clear sequence.

- marker ID: `1786363793158-bi95tvi6`
- createdAt: `2026-08-10T12:09:53.158Z`
- original href: `https://www.torn.com/item.php`

## Owner-provided v0.1.1 lifecycle report

```json
{
  "checkedAt": "2026-08-10T12:38:15.441Z",
  "probeVersion": "0.1.1",
  "currentLoadId": "1786365475478-d9eda6xz",
  "currentHref": "https://www.torn.com/item.php",
  "nativeStorageAvailable": true,
  "tabStateBridgeAvailable": true,
  "currentTabState": {
    "capturedAt": "2026-08-10T12:38:15.441Z",
    "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
    "isActiveTab": true,
    "isWebViewVisible": true
  },
  "inMemoryTabEvents": [
    {
      "reason": "script-load",
      "capturedAt": "2026-08-10T12:37:55.481Z",
      "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
      "isActiveTab": true,
      "isWebViewVisible": true
    },
    {
      "reason": "tornpda:tabState",
      "capturedAt": "2026-08-10T12:37:55.649Z",
      "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
      "isActiveTab": true,
      "isWebViewVisible": true
    },
    {
      "reason": "manual-check",
      "capturedAt": "2026-08-10T12:38:15.441Z",
      "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
      "isActiveTab": true,
      "isWebViewVisible": true
    }
  ],
  "persistenceMarker": {
    "id": "1786363793158-bi95tvi6",
    "createdAt": "2026-08-10T12:09:53.158Z",
    "href": "https://www.torn.com/item.php",
    "userAgent": "Mozilla/5.0 (Linux; Android 16; SM-S938U Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 com.manuito.tornpda ##deviceBrand=samsung##deviceModel=SM-S938U##deviceSoftware=BP4A.251205.006##"
  },
  "lifecycleLog": [
    {
      "loadId": "1786365475478-d9eda6xz",
      "loadedAt": "2026-08-10T12:37:55.481Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/item.php",
      "tabState": {
        "capturedAt": "2026-08-10T12:37:55.481Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    }
  ]
}
```

## Findings

1. The existing v0.1.0 persistence marker remained readable after the probe was updated in place to v0.1.1.
2. The marker ID and original creation timestamp were unchanged.
3. `PDA_storage` remained available after the update.
4. TornPDA's tab-state bridge was available in the updated script context.
5. A fresh v0.1.1 load ID is expected because the updated userscript executed after the update/reload. That load ID is not a replacement for the native persistence marker.
6. The tab-state bridge reported a stable tab UID during the captured v0.1.1 session: `0b5906f5-dac5-45dc-9fe6-3aedb4472ecb`.
7. The first lifecycle log contains one v0.1.1 script-load entry, which is the correct baseline for later sleep/WebView-recreation comparison.

## Gate decision

**Phase G: PASS.**

The observed behavior matches TornPDA's documented/source model in which an installed userscript keeps its native storage identity through a normal in-place update.

This result materially improves confidence that reconstructible TornScriptures datasets could survive ordinary userscript updates if a future storage abstraction uses `PDA_storage` correctly.

It does **not** establish uninstall/reinstall persistence, which is not expected, and it does not qualify native storage as the sole unbacked authority for Black Ledger.

## Next evidence target

Phase F background/tab-sleep/WebView recreation. Probe v0.1.1 now records tab UID, visibility/active state, load IDs, and a bounded native lifecycle log so the next test can distinguish simple backgrounding from genuine page/WebView recreation.
