# Training Advisor normalized source adapters

`src/training-advisor-adapters.js` implements the frozen DQ-TRAIN-001D v0.1 adapter contract as a pure CommonJS module. It does not fetch, store, render, schedule, or use items. `normalizeTrainingSources` accepts already acquired source responses and returns `observedState`, `itemMechanics`, `marketSnapshot`, `timing`, field provenance, source status, and local capability results for `src/training-advisor-pure.js`.

## Caller contract

```js
const {normalizeTrainingSources} = require('../src/training-advisor-adapters.js');
const normalized = normalizeTrainingSources({
  targetStat: 'speed',
  sources: {bars, cooldowns, battlestats, userGym, tornGyms, perks, refills,
    drugInventory, boosterInventory, candyInventory},
  sourceMeta: {
    bars: {sourceId:'/user/bars',requestedSelection:'/user/bars',
      requestSucceeded:true,observedAt:'2026-09-27T06:00:00Z',freshness:'LIVE'}
    // Provide equivalent independent evidence for each other source.
  }
});
```

The acquisition layer must establish `sourceId`, `requestSucceeded`, `observedAt`, and an honest `freshness` (`LIVE`, `FRESH`, `STALE`, `UNKNOWN`) for each selection. The adapter never reads the clock or declares an unverified payload LIVE. API inventory is limited to FRESH for planning even when its HTTP response is current. Multi-page category input is an array with `pageId` linking `_metadata.links.next` and `.prev`, stable timestamp and total, and a terminal null `next`.

**DQ-TRAIN-001J-P selected-plan confirmation:** `confirmedInventory={sourceId,confirmedCurrent:true,observedAt,freshness:'LIVE',quantities}` may contain only required registry keys. Valid explicit current quantities, including zero, override cached values for those keys and emit `observedState.inventoryFreshnessByItem[key]='LIVE'`. Unknown keys, invalid quantities, and missing/noncurrent/stale proof cannot grant readiness. `fields.inventory.confirmation` retains accepted quantities and their source/observation evidence. Other API quantities and category cache metadata stay planning-grade; no missing quantity is invented.

The planner checks each consumed item's current proof and enough available quantity. Partial confirmation may therefore make a selected plan READY while aggregate `inventoryFreshness` stays FRESH/UNKNOWN and `capabilities.inventoryExecution` stays false. That capability continues to describe complete inventory, not selected-plan readiness. The old `complete:true` all-registry confirmation remains compatible and promotes the aggregate class. Callers must normalize and replan after contradictory confirmation or material state changes; there is no clock, persistent confirmation, or runtime event machinery in this correction. See the [bounded correction contract](divine-knowledge/chapters/dq-train-001/SELECTED-INVENTORY-CONFIRMATION-CORRECTION-001J-P.md).

`dynamicState` must contain `effectsComplete:true`, `materialPreparationEffects:[]` and a fresh `effectEvidence` with `sourceId` and `observedAt` before base item effects become available. Base Candy additionally requires `worldDiabetesDay:'INACTIVE'` and independent fresh `eventEvidence` with `verifiedInactive:true`. No event determination, server clock, API request, or timer is implemented here. Without the proof, Candy is omitted from planner mechanics. Unsupported modifier strings or explicit dynamic effects omit only affected preparation classes; source inventory remains visible. Unknown gain modifiers or a material gym note suppress gain prediction.

The versioned registry records base Xanax, Ecstasy, eDVD, and 11 Candy IDs. Drug cooldown ranges are provenance only: no future exact cooldown is emitted. A complete verified perk/effect state without maximum-booster modifiers derives the 86,400-second pre-use threshold. The daily Point refill fills to the natural Energy maximum, uses the historical `refills.energy` **used** polarity, and costs the configured 30 Points. A positive `special_count` blocks the paid path. `pointsAvailable` requires separate current proof; the source refills response does not provide it.

**DQ-TRAIN-001I Energy stack cap:** `ENERGY_STACK_CAP_MECHANIC` supplies `observedState.stackCap=1000` and `fields.stackCap={value:1000,provenance:'CONFIGURED',freshness:'FRESH',sourceId:'TORN_ENERGY_STACK_CAP_V1',observedAt:null,cacheClass:'VERSIONED_MECHANIC',verifiedAt:'2026-09-27'}`. This audited project mechanic is independent of `naturalEnergyMax`, which continues to come from `/user/bars.energy.maximum`. No live Wiki fetch occurs. An explicit `configuredMechanics.energyStackCap` other than 1000 is a `MECHANIC_VERSION_MISMATCH`, not a player override; the adapter omits the authoritative cap and Xanax route.

With a valid stack cap and complete fresh supported effect evidence, the adapter emits `observedState.xanax={energyGain:250}`, `itemMechanics.xanax={energyGain:250,happyGain:75}`, and `xanaxPreparation:true`. An unsupported material drug effect or missing effect proof suppresses the planner-facing Xanax projection locally, leaving the general Energy cap available. The observed current drug cooldown gates the next use. No `xanax.cooldownSeconds` is emitted; each later use requires another observed checkpoint and replanning. The pure planner applies +75 Happy once for an immediate use and treats delayed observed Happy as authoritative. Point refills still fill to `naturalEnergyMax`; the 1,150E route remains stack training followed by refill, verification, and ordinary-bar training.

Market prices enter only through a separately approved normalized `marketInput`, with a typed `EXECUTABLE_NEW_CASH` price and/or `OWNED_REPLACEMENT_VALUE`. Catalog/average prices are never silently treated as a buy quote. Player-supplied preference values, item availability, and economic valuation remain separate caller inputs. General recommendation searches always receive `calibratedDomain:false`; this module does not assert that an entire candidate set lies in a B1–B4 observed lane. Without a verified safe quarter-hour timing proof, `timing.safeQuarterWindow` remains unknown, leaving Happy preparation at `NEEDS_REFRESH` for execution.

## Verification and limits

Run `node --check src/training-advisor-adapters.js`, `node --check tests/training-advisor-adapters.test.js`, `node --test tests/training-advisor-adapters.test.js tests/training-advisor-pure.test.js`, and `node --test tests/*.test.js`. Tests exercise all 17 adapter, 16 item-mechanic, and five stack-cap frozen fixtures plus cross-source freshness, pagination, permission, planner integration, and fail-closed regression checks. The frozen JSON fixture files are unchanged.

Source acquisition, actual permission checks, server-event proof, confirmed Points and inventory UI, market-provider integration, manual browser/TornPDA checks, and user-facing recommendations require later authorization and verification. Revert the implementation commit on the isolated branch to roll back; there are no storage keys or migration effects.
