# TornPDA Native Storage Evidence — Run 007 / Phase H

Status: **PASS — TornPDA browser-cache clear persistence**

Date: 2026-08-10

Capability under test: TornPDA `PDA_storage`

Probe version: `0.1.1`

This evidence file records the owner-provided live report after using TornPDA's own **Browser cache → Clear** control, then reopening Torn and rerunning the safe native-storage contract tests. It does not authorize any TornScriptures production storage migration.

## Existing persistence marker

The same marker originated under probe v0.1.0 and survived all previous lifecycle checkpoints.

- marker ID: `1786363793158-bi95tvi6`
- createdAt: `2026-08-10T12:09:53.158Z`
- original href: `https://www.torn.com/item.php`

## Owner-provided Phase H report

```json
{
  "probe": "TornPDA Storage Probe",
  "probeVersion": "0.1.1",
  "runAt": "2026-08-10T13:09:02.833Z",
  "href": "https://www.torn.com/index.php",
  "userAgent": "Mozilla/5.0 (Linux; Android 16; SM-S938U Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 com.manuito.tornpda ##deviceBrand=samsung##deviceModel=SM-S938U##deviceSoftware=BP4A.251205.006##",
  "nativeStorageAvailable": true,
  "tabStateBridgeAvailable": true,
  "currentLoadId": "1786367326124-jhc2vec3",
  "tests": [
    {"name":"PDA_storage availability","pass":true},
    {"name":"round-trip string","pass":true,"expected":"TornScriptures","actual":"TornScriptures"},
    {"name":"round-trip object","pass":true,"expected":{"source":"Age of Discovery","nested":{"ok":true},"n":17},"actual":{"source":"Age of Discovery","nested":{"ok":true},"n":17}},
    {"name":"round-trip array","pass":true,"expected":[1,"two",false,{"four":4}],"actual":[1,"two",false,{"four":4}]},
    {"name":"round-trip number","pass":true,"expected":123456789,"actual":123456789},
    {"name":"round-trip boolean","pass":true,"expected":true,"actual":true},
    {"name":"get missing key default","pass":true,"actual":{"fallback":true}},
    {"name":"setMany/getMany batch round-trip","pass":true,"actual":{"ts-discovery-storage-probe:batch-a":{"a":1},"ts-discovery-storage-probe:batch-b":["b",2]}},
    {"name":"loadAll sees probe namespace keys","pass":true,"probeKeys":["ts-discovery-storage-probe:persistence-marker","ts-discovery-storage-probe:lifecycle-log","ts-discovery-storage-probe:string","ts-discovery-storage-probe:object","ts-discovery-storage-probe:array","ts-discovery-storage-probe:number","ts-discovery-storage-probe:boolean","ts-discovery-storage-probe:batch-a","ts-discovery-storage-probe:batch-b"]},
    {"name":"delete removes key","pass":true,"actual":"__missing__"},
    {"name":"list returns probe keys","pass":true,"probeKeys":["ts-discovery-storage-probe:array","ts-discovery-storage-probe:batch-a","ts-discovery-storage-probe:batch-b","ts-discovery-storage-probe:boolean","ts-discovery-storage-probe:lifecycle-log","ts-discovery-storage-probe:number","ts-discovery-storage-probe:object","ts-discovery-storage-probe:persistence-marker"]}
  ],
  "latency": {
    "set ts-discovery-storage-probe:string": 1.4,
    "get ts-discovery-storage-probe:string": 0.3,
    "set ts-discovery-storage-probe:object": 0.9,
    "get ts-discovery-storage-probe:object": 0.4,
    "set ts-discovery-storage-probe:array": 0.7,
    "get ts-discovery-storage-probe:array": 0.2,
    "set ts-discovery-storage-probe:number": 0.7,
    "get ts-discovery-storage-probe:number": 0.3,
    "set ts-discovery-storage-probe:boolean": 0.9,
    "get ts-discovery-storage-probe:boolean": 0.4,
    "setMany": 2.1,
    "getMany": 0.4,
    "loadAll": 0.6
  },
  "usageBefore": {"used":3819,"quota":10485760},
  "usageAfter": {"used":3819,"quota":10485760},
  "persistenceMarker": {
    "id": "1786363793158-bi95tvi6",
    "createdAt": "2026-08-10T12:09:53.158Z",
    "href": "https://www.torn.com/item.php",
    "userAgent": "Mozilla/5.0 (Linux; Android 16; SM-S938U Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 com.manuito.tornpda ##deviceBrand=samsung##deviceModel=SM-S938U##deviceSoftware=BP4A.251205.006##"
  },
  "lifecycleEntries": 12,
  "tabState": {
    "capturedAt": "2026-08-10T13:09:02.859Z",
    "uid": "0b5906f5-dac5-45dc-9fe6-3aedb4472ecb",
    "isActiveTab": true,
    "isWebViewVisible": true
  },
  "notes": [
    "Quota exhaustion is intentionally not forced by v0.1.1. usage()/quota are recorded without allocating a 10-50 MiB failure payload.",
    "v0.1.1 keeps only the explicit persistence marker and a bounded lifecycle log; ordinary safe-test keys are removed."
  ],
  "summary": {"total":11,"passed":11,"failed":0}
}
```

## Findings

1. The original persistence marker remained readable after TornPDA's own browser-cache clear path.
2. `PDA_storage` remained available after the clear.
3. The complete safe contract rerun passed **11 / 11** checks.
4. Native storage usage was **3,819 bytes before and after** the safe test. The residual bytes are expected because v0.1.1 intentionally preserves the persistence marker and bounded lifecycle log while removing ordinary ephemeral test keys.
5. The reported native quota remained **10,485,760 bytes (10 MiB)**.
6. Tiny-payload bridge latency remained in the same broad range as Run 001, with observed operations approximately **0.2–2.1 ms**.
7. The logical tab UID reported after the browser-cache clear remained `0b5906f5-dac5-45dc-9fe6-3aedb4472ecb`. This is interesting but is not required for the Phase H conclusion; the storage result stands on the marker and native contract survival.
8. The probe had accumulated 12 bounded lifecycle entries, further confirming that the native namespace persisted across repeated execution-context recreation.

## Gate decision

**Phase H: PASS.**

On the owner's tested TornPDA/Android environment, TornPDA native userscript storage survived TornPDA's own **Browser cache → Clear** path while the storage contract remained functional afterward.

This closes the ordinary lifecycle/durability portion of the first TornPDA native-storage verification pass.

It does **not** establish:

- large-payload throughput or memory behavior
- quota-rejection/partial-write behavior
- external-origin bridge availability relevant to Weav3r/TornExchange
- device migration or backup behavior
- corruption recovery behavior
- desktop fallback behavior
- suitability as the sole unbacked authority for Black Ledger

No production TornScriptures runtime change is authorized by this result.
