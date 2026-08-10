# TornPDA Native Storage Evidence — Run 006 / Phase F

Status: **PASS — background/rest-tab WebView recreation persistence**

Date: 2026-08-10

Capability under test: TornPDA `PDA_storage`

Probe version: `0.1.1`

This evidence file records the owner-provided lifecycle report from the controlled Phase F test using TornPDA's tab-state diagnostics and the probe's bounded native lifecycle log. It does not authorize any TornScriptures production storage migration.

## Existing persistence marker

The same marker originated under probe v0.1.0 and survived all prior checkpoints, including the v0.1.0 → v0.1.1 in-place update.

- marker ID: `1786363793158-bi95tvi6`
- createdAt: `2026-08-10T12:09:53.158Z`
- original href: `https://www.torn.com/item.php`

## Owner-provided Phase F lifecycle report

```json
{
  "checkedAt": "2026-08-10T12:54:46.484Z",
  "probeVersion": "0.1.1",
  "currentLoadId": "1786366483884-kdp9asjb",
  "currentHref": "https://www.torn.com/item.php",
  "nativeStorageAvailable": true,
  "tabStateBridgeAvailable": true,
  "currentTabState": {
    "capturedAt": "2026-08-10T12:54:46.484Z",
    "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
    "isActiveTab": true,
    "isWebViewVisible": true
  },
  "inMemoryTabEvents": [
    {
      "reason": "script-load",
      "capturedAt": "2026-08-10T12:54:43.895Z",
      "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
      "isActiveTab": true,
      "isWebViewVisible": true
    },
    {
      "reason": "tornpda:tabState",
      "capturedAt": "2026-08-10T12:54:43.978Z",
      "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
      "isActiveTab": true,
      "isWebViewVisible": true
    },
    {
      "reason": "manual-check",
      "capturedAt": "2026-08-10T12:54:46.484Z",
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
    },
    {
      "loadId": "1786366257166-1d1isifo",
      "loadedAt": "2026-08-10T12:50:57.212Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/index.php",
      "tabState": {
        "capturedAt": "2026-08-10T12:50:57.212Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366261735-9hox9vjs",
      "loadedAt": "2026-08-10T12:51:01.742Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/page.php?sid=events",
      "tabState": {
        "capturedAt": "2026-08-10T12:51:01.742Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366270435-5cf6mb0g",
      "loadedAt": "2026-08-10T12:51:10.447Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/index.php",
      "tabState": {
        "capturedAt": "2026-08-10T12:51:10.447Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366285879-4wgjubsu",
      "loadedAt": "2026-08-10T12:51:25.889Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/page.php?sid=crimes#/burglary",
      "tabState": {
        "capturedAt": "2026-08-10T12:51:25.889Z",
        "uid": "9a2c93ef-4c72-4a90-9c26-de39fd4c532e",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366320191-6r5q9p2n",
      "loadedAt": "2026-08-10T12:52:00.203Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/index.php",
      "tabState": {
        "capturedAt": "2026-08-10T12:52:00.203Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366332463-m3yxv9ng",
      "loadedAt": "2026-08-10T12:52:12.471Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/page.php?sid=events",
      "tabState": {
        "capturedAt": "2026-08-10T12:52:12.471Z",
        "uid": "630b582a-7bca-4749-9320-656756faacc9",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366357596-15s4b65e",
      "loadedAt": "2026-08-10T12:52:37.613Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/index.php",
      "tabState": {
        "capturedAt": "2026-08-10T12:52:37.613Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366359649-r97qu3ys",
      "loadedAt": "2026-08-10T12:52:39.666Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/item.php",
      "tabState": {
        "capturedAt": "2026-08-10T12:52:39.666Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    },
    {
      "loadId": "1786366483884-kdp9asjb",
      "loadedAt": "2026-08-10T12:54:43.895Z",
      "probeVersion": "0.1.1",
      "href": "https://www.torn.com/item.php",
      "tabState": {
        "capturedAt": "2026-08-10T12:54:43.895Z",
        "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
        "isActiveTab": true,
        "isWebViewVisible": true
      }
    }
  ]
}
```

## Findings

1. The original native persistence marker remained readable and unchanged after the Phase F lifecycle sequence.
2. The logical probe tab UID remained `0b5906f5-dac5-45dc-9fe6-3aedb4472ecb` before and after the relevant recreation.
3. The probe had loaded on `https://www.torn.com/item.php` at `2026-08-10T12:52:39.666Z` with load ID `1786366359649-r97qu3ys`.
4. After the controlled background/rest-tab interval, the same logical tab and same URL loaded again at `2026-08-10T12:54:43.895Z` with a different load ID: `1786366483884-kdp9asjb`.
5. A changed load ID on the same preserved tab UID is evidence that the page/userscript execution context was recreated while TornPDA retained the logical tab identity.
6. The native marker survived that recreation, supporting the claim that `PDA_storage` persists independently of the individual WebView/page execution context in this tested lifecycle.
7. The lifecycle log also contains other TornPDA tab UIDs (`9a2c93ef-4c72-4a90-9c26-de39fd4c532e`, `630b582a-7bca-4749-9320-656756faacc9`), consistent with multiple-tab activity during the controlled test.
8. `PDA_storage` and the TornPDA tab-state bridge were both available after recovery.

## Evidence boundary

This test is strong evidence for the controlled background/rest-tab scenario performed by the owner. It does not prove every possible Android memory-pressure kill, OS process death, device reboot, app-data wipe, database corruption, or uninstall/reinstall lifecycle.

The report does not retain an in-memory `isWebViewVisible:false` event from the destroyed context, which is expected when a WebView execution context is discarded. The persistent lifecycle log provides the more useful before/after evidence: preserved tab UID, new load ID, and preserved native marker.

## Gate decision

**Phase F: PASS.**

With Runs 001–006, TornPDA native userscript storage has now passed the first discovery threshold for consideration as a **candidate backend for non-critical/reconstructible TornScriptures data** on the owner's tested environment:

- basic storage contract
- ordinary reload
- normal Torn navigation
- userscript disable/re-enable
- force-stop/reopen
- in-place userscript update
- controlled WebView/userscript recreation
- tiny-payload bridge latency showed no obvious concern

This still does **not** authorize a migration and does **not** qualify `PDA_storage` as the sole unbacked authority for Black Ledger or other irreplaceable records.

## Remaining high-value storage questions

- protocol-specific TornPDA browser-cache clear (Phase H)
- larger-payload throughput/memory behavior
- quota/error behavior if we decide it is worth forcing
- cross-origin/bridge availability relevant to trader-price pages
- data export/import and device migration
- desktop fallback behavior
- corruption/recovery implications
- production dataset classification and storage ownership
