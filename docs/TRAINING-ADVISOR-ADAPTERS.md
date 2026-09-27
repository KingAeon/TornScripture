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

The acquisition layer must establish `sourceId`, `requestSucceeded`, `observedAt`, and an honest `freshness` (`LIVE`, `FRESH`, `STALE`, `UNKNOWN`) for each selection. The adapter never reads the clock or declares an unverified payload LIVE. API inventory is limited to FRESH for planning even when its HTTP response is current. A complete current player confirmation may promote inventory to LIVE only when it covers every v0.1 registry key; a partial confirmation cannot satisfy the planner's global inventory freshness gate. Multi-page category input is an array with `pageId` linking `_metadata.links.next` and `.prev`, stable timestamp and total, and a terminal null `next`.

`dynamicState` must contain `effectsComplete:true`, `materialPreparationEffects:[]` and a fresh `effectEvidence` with `sourceId` and `observedAt` before base item effects become available. Base Candy additionally requires `worldDiabetesDay:'INACTIVE'` and independent fresh `eventEvidence` with `verifiedInactive:true`. No event determination, server clock, API request, or timer is implemented here. Without the proof, Candy is omitted from planner mechanics. Unsupported modifier strings or explicit dynamic effects omit only affected preparation classes; source inventory remains visible. Unknown gain modifiers or a material gym note suppress gain prediction.

The versioned registry records base Xanax, Ecstasy, eDVD, and 11 Candy IDs. Drug cooldown ranges are provenance only: no future exact cooldown is emitted. A complete verified perk/effect state without maximum-booster modifiers derives the 86,400-second pre-use threshold. The daily Point refill fills to the natural Energy maximum, uses the historical `refills.energy` **used** polarity, and costs the configured 30 Points. A positive `special_count` blocks the paid path. `pointsAvailable` requires separate current proof; the source refills response does not provide it.

**Upstream Xanax limitation:** The current pure planner does not apply Xanax's documented +75 Happy to prepared training. A synthetic 500E / 1,000-Happy example composes `TAKE_XANAX -> TRAIN` at 750E but simulates the first train at 1,000 Happy, rather than 1,075. This adapter preserves the registry fact but omits `observedState.xanax`, withholding that Energy route until a separately authorized and verified planner correction. It also cannot derive an Energy stack cap from the approved 001D sources. This is a bounded v0.1 capability gap for independent [V], not a change to the frozen math fixtures.

Market prices enter only through a separately approved normalized `marketInput`, with a typed `EXECUTABLE_NEW_CASH` price and/or `OWNED_REPLACEMENT_VALUE`. Catalog/average prices are never silently treated as a buy quote. Player-supplied preference values, item availability, and economic valuation remain separate caller inputs. General recommendation searches always receive `calibratedDomain:false`; this module does not assert that an entire candidate set lies in a B1–B4 observed lane. Without a verified safe quarter-hour timing proof, `timing.safeQuarterWindow` remains unknown, leaving Happy preparation at `NEEDS_REFRESH` for execution.

## Verification and limits

Run `node --check src/training-advisor-adapters.js`, `node --check tests/training-advisor-adapters.test.js`, `node --test tests/training-advisor-adapters.test.js`, and `node --test tests/*.test.js`. Tests exercise all 17 adapter and 16 item-mechanic frozen fixtures plus cross-source freshness, pagination, permission, planner integration, and fail-closed regression checks. The frozen JSON fixture files are unchanged.

Source acquisition, actual permission checks, server-event proof, confirmed Points and inventory UI, market-provider integration, manual browser/TornPDA checks, and user-facing recommendations require later authorization and verification. Revert the implementation commit on the isolated branch to roll back; there are no storage keys or migration effects.
