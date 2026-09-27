'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const a = require('../src/training-advisor-adapters.js');
const planner = require('../src/training-advisor-pure.js');
const root = path.join(__dirname,'../docs/divine-knowledge/chapters/dq-train-001');
const fixtures = require(path.join(root,'ADAPTER-FIXTURES-001D.json'));
const mechanicsFixtures = require(path.join(root,'ITEM-MECHANIC-FIXTURES-001D.json'));
const cases = Object.fromEntries(fixtures.cases.map(c=>[c.id,c]));
const mechanicCases = Object.fromEntries(mechanicsFixtures.cases.map(c=>[c.id,c]));
const time = '2026-09-27T06:00:00Z';
const sources = {bars:'/user/bars',cooldowns:'/user/cooldowns',battlestats:'/user/battlestats',
  userGym:'/user/gym',tornGyms:'/torn/gyms',perks:'/user/perks',refills:'/user/refills',
  drugInventory:'/user/inventory?cat=Drug',boosterInventory:'/user/inventory?cat=Booster',
  candyInventory:'/user/inventory?cat=Candy'};
const meta = (key,freshness='LIVE')=>({sourceId:sources[key],requestedSelection:sources[key],
  requestSucceeded:true,observedAt:time,freshness});
const emptyPerks = ()=>Object.fromEntries(['faction','property','job','education','enhancer',
  'book','stock','merit'].map(k=>[k,[]]));
const activeState = {effectsComplete:true,materialPreparationEffects:[],worldDiabetesDay:'INACTIVE',
  effectEvidence:{sourceId:'APPROVED_EFFECT_STATE',observedAt:time,freshness:'FRESH'},
  eventEvidence:{sourceId:'APPROVED_SERVER_EVENT',observedAt:time,freshness:'FRESH',
    verifiedInactive:true}};
const noop = {items:[],sourceId:'TRUSTED_MARKET',observedAt:time,freshness:'FRESH'};
const page = (category,items=[],next=null,total=items.length,timestamp=1800000000)=>({
  inventory:{items,timestamp},_metadata:{links:{prev:null,next},total}});
function normalize(input={}) {
  const sourceMeta=Object.fromEntries(Object.keys(input.sources || {}).filter(k=>sources[k])
    .map(k=>[k,meta(k,k.endsWith('Inventory')?'FRESH':'LIVE')]));
  return a.normalizeTrainingSources({targetStat:'speed',dynamicState:activeState,
    ...input,sourceMeta:{...sourceMeta,...input.sourceMeta}});
}
function fixture(id) {assert.ok(cases[id],id); return cases[id];}
function mech(id) {assert.ok(mechanicCases[id],id); return mechanicCases[id];}

test('all frozen 001D fixture IDs are unique and present',()=>{
  assert.equal(fixtures.cases.length,17);
  assert.equal(Object.keys(cases).length,17);
  assert.equal(mechanicsFixtures.cases.length,16);
  assert.equal(Object.keys(mechanicCases).length,16);
});
test('BARS_DONATOR_ORDINARY_001 maps current, maximum, explicit regeneration, and guarded base Happy',()=>{
  const f=fixture('BARS_DONATOR_ORDINARY_001');
  const result=normalize({sources:f.sources});
  for (const key of ['energy','happy','ordinaryHappy','naturalEnergyMax'])
    assert.equal(result.observedState[key],f.expected[key]);
  assert.deepEqual(result.observedState.naturalRegen,f.expected.naturalRegen);
  assert.equal(result.fields.energy.freshness,'LIVE');
  assert.equal(result.fields.ordinaryHappy.reason,'ORDINARY_STATE_MAPPING_GUARDED');
  assert.equal(result.fields.energy.sourceId,'/user/bars');
  assert.equal(result.fields.energy.observedAt,time);
  assert.equal(planner.generateEnergyCandidates({...result.observedState,maxWaitSeconds:600})[0].energyAtTraining,150);
});
test('elevated ordinary Happy requires mapping proof; never substitute current Happy',()=>{
  const bars=structuredClone(fixture('BARS_DONATOR_ORDINARY_001').sources.bars);
  bars.happy.current=33550;
  const guarded=normalize({sources:{bars}});
  assert.equal(guarded.observedState.ordinaryHappy,undefined);
  assert.equal(guarded.fields.ordinaryHappy.reason,'ORDINARY_HAPPY_ELEVATED_UNVERIFIED');
  const verified=normalize({sources:{bars},sourceMeta:{bars:{...meta('bars'),
    ordinaryHappyVerifiedAtElevated:true}}});
  assert.equal(verified.observedState.ordinaryHappy,4000);
});
test('COOLDOWNS_POSITIVE_BOOSTER_001 retains countdown independently of maximum',()=>{
  const f=fixture('COOLDOWNS_POSITIVE_BOOSTER_001');
  const r=normalize({sources:f.sources});
  assert.equal(r.observedState.cooldowns.drugSeconds,f.expected.cooldowns.drugSeconds);
  assert.equal(r.observedState.cooldowns.boosterSeconds,f.expected.cooldowns.boosterSeconds);
  assert.equal(r.observedState.cooldowns.boosterMaxSeconds,undefined);
});
test('BATTLESTATS_RAW_VALUE_001 ignores combat modifiers',()=>{
  const f=fixture('BATTLESTATS_RAW_VALUE_001');
  const r=normalize({sources:f.sources});
  assert.deepEqual(r.observedState.stats,f.expected.stats);
  assert.equal(r.observedState.gainPerks,undefined);
  assert.equal(r.capabilities.automaticStats,true);
  assert.equal(r.fields.stats.provenance,'OBSERVED');
});
test('COMPLETE_CARDIO_JOIN_001 validates the complete catalog row and familiar dots',()=>{
  const f=fixture('COMPLETE_CARDIO_JOIN_001');
  const r=normalize({sources:f.sources,targetStat:f.targetStat});
  for (const [key,value] of Object.entries(f.expected.gym)) assert.equal(r.observedState.gym[key],value);
  assert.equal(r.fields.gym.provenance,'DERIVED');
  assert.equal(r.capabilities.gymPrediction,true);
});
test('PERKS_GAIN_PARSE_001 produces exact IDs and ignores passive Dexterity',()=>{
  const f=fixture('PERKS_GAIN_PARSE_001');
  const p=a.adaptPerks(f.sources.perks,meta('perks'));
  assert.deepEqual(p.gainPerksByTarget,f.expected.gainPerksByTarget);
  assert.deepEqual(p.excluded,f.expected.excluded);
  assert.equal(p.complete,true);
  const r=normalize({sources:{...fixture('BARS_DONATOR_ORDINARY_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources,
    ...fixture('COMPLETE_CARDIO_JOIN_001').sources,...f.sources}});
  assert.equal(r.capabilities.gainPrediction,true);
  assert.equal(planner.capabilities(r.observedState).canPredictGain,true);
});
test('PERKS_UNKNOWN_MATERIAL_001 blocks gain but leaves other source capabilities local',()=>{
  const f=fixture('PERKS_UNKNOWN_MATERIAL_001');
  const p=a.adaptPerks(f.sources.perks,meta('perks'));
  assert.equal(p.activeEffects.some(e=>e.support==='UNSUPPORTED' && e.affects.includes('gymGain')),true);
  const r=normalize({sources:{...f.sources,...fixture('BARS_DONATOR_ORDINARY_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources,...fixture('COMPLETE_CARDIO_JOIN_001').sources}});
  assert.equal(r.capabilities.gainPrediction,f.expected.canPredictGain);
  assert.equal(planner.capabilities(r.observedState).canPredictGain,false);
});
test('REFILL_FALSE/TRUE, special precedence, and 30-Point configuration match frozen cases',()=>{
  for (const id of ['REFILL_FALSE_MEANS_AVAILABLE_001','REFILL_TRUE_MEANS_USED_001',
    'REFILL_SPECIAL_COUNT_BLOCKS_PAID_001','REFILL_PAID_COST_30_001']) {
    const f=fixture(id), r=normalize({sources:f.sources,configuredMechanics:f.configuredMechanics});
    const expected=f.expected.pointRefill || f.expected.paidPointRefill;
    for (const [key,value] of Object.entries(expected)) if (key !== 'reason')
      assert.equal(r.observedState.pointRefill[key],value,id);
    if (expected.reason) assert.equal(r.fields.pointRefill.reason,expected.reason,id);
    assert.equal(r.observedState.pointRefill.pointsRequired,30);
    assert.equal(r.refillState.specialCount,f.sources.refills.special_count);
  }
  const wrong=normalize({sources:fixture('REFILL_PAID_COST_30_001').sources,
    configuredMechanics:{paidEnergyRefillPoints:25}});
  assert.equal(wrong.observedState.pointRefill,undefined);
});
test('INVENTORY_COMPLETE_ABSENCE_ZERO_001 uses ID, page proof and cached planning freshness',()=>{
  const f=fixture('INVENTORY_COMPLETE_ABSENCE_ZERO_001');
  const r=normalize({sources:f.sources});
  assert.equal(r.observedState.inventory.ecstasy,f.expected.inventory.ecstasy);
  assert.equal(r.observedState.inventory.xanax,f.expected.inventory.xanax);
  assert.equal(r.inventory.Drug.sourceTimestamp,f.expected.sourceTimestamp);
  assert.equal(r.inventory.Drug.freshness,f.expected.inventoryFreshness);
  assert.notEqual(r.observedState.inventoryFreshness,'LIVE');
  assert.equal(r.capabilities.inventoryExecution,false);
});
test('INVENTORY_INCOMPLETE_ABSENCE_UNKNOWN_001 preserves observed quantity, no absent-zero',()=>{
  const f=fixture('INVENTORY_INCOMPLETE_ABSENCE_UNKNOWN_001');
  const r=normalize({sources:f.sources});
  assert.equal(r.observedState.inventory.ecstasy,2);
  assert.equal(Object.hasOwn(r.observedState.inventory,'xanax'),false);
  assert.equal(r.inventory.Drug.reason,f.expected.reason);
});
test('SPECIAL_GYM_NOTE_FAIL_CLOSED_001 preserves note but suppresses prediction',()=>{
  const f=fixture('SPECIAL_GYM_NOTE_FAIL_CLOSED_001');
  const r=normalize({sources:{...f.sources,perks:emptyPerks(),
    ...fixture('BARS_DONATOR_ORDINARY_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources},targetStat:f.targetStat});
  for (const [key,value] of Object.entries(f.expected.gym)) assert.equal(r.fields.gym.value[key],value);
  assert.equal(r.capabilities.gymPrediction,false);
  assert.equal(r.capabilities.gainPrediction,false);
  assert.equal(planner.capabilities(r.observedState).canPredictGain,false);
  assert.equal(r.fields.gym.reason,f.expected.reason);
  assert.equal(r.observedState.calibratedDomain,false);
});
test('BATTLESTATS_DENIED_MANUAL_FALLBACK_001 accepts explicit manual input only',()=>{
  const f=fixture('BATTLESTATS_DENIED_MANUAL_FALLBACK_001');
  const denied=normalize({sources:f.sources,manualInput:{stats:f.manualInput.stats}});
  assert.equal(denied.capabilities.automaticStats,false);
  assert.equal(denied.observedState.stats,undefined);
  const r=normalize({sources:f.sources,manualInput:{stats:f.manualInput.stats,confirmed:true,
    observedAt:time,freshness:'FRESH'}});
  assert.deepEqual(r.observedState.stats,f.manualInput.stats);
  assert.equal(r.capabilities.manualStats,true);
  assert.equal(r.fields.stats.provenance,'CONFIGURED');
  assert.equal(r.sourceStatus.battlestats.permissionFailure,true);
});
test('GYM_SCHEMA_MISMATCH_LOCALITY_001 affects gym prediction but not other sources',()=>{
  const f=fixture('GYM_SCHEMA_MISMATCH_LOCALITY_001');
  const r=normalize({sources:f.sources,marketInput:{...noop,items:[{id:'xanax',newCashEach:1,
    availableQuantity:1,newCashConcept:'EXECUTABLE_NEW_CASH'}]}});
  assert.equal(r.capabilities.gymPrediction,false);
  assert.equal(r.fields.gym.reason,f.expected.reason);
  assert.equal(r.capabilities.marketComparison,true);
  assert.equal(r.observedState.gym,undefined);
  const joined=fixture('COMPLETE_CARDIO_JOIN_001').sources;
  const ambiguous=normalize({sources:{...joined,tornGyms:[...joined.tornGyms,...joined.tornGyms]}});
  assert.equal(ambiguous.capabilities.gymPrediction,false);
});
test('GENERAL_SEARCH_CALIBRATION_FAIL_CLOSED_001 never elevates open search confidence',()=>{
  const f=fixture('GENERAL_SEARCH_CALIBRATION_FAIL_CLOSED_001');
  const r=normalize({targetStat:f.normalizedState.targetStat,planningScope:f.planningScope});
  assert.equal(r.observedState.calibratedDomain,f.expected.calibratedDomain);
  assert.equal(r.capabilities.calibratedDomain,false);
});
test('REFILL_POINTS_BALANCE_UNKNOWN_NEEDS_REFRESH_001 leaves balance and readiness unknown',()=>{
  const f=fixture('REFILL_POINTS_BALANCE_UNKNOWN_NEEDS_REFRESH_001');
  const r=normalize({sources:f.sources,configuredMechanics:f.configuredMechanics});
  assert.equal(r.observedState.pointRefill.allowed,true);
  assert.equal(r.observedState.pointsAvailable,undefined);
  assert.equal(r.capabilities.paidRefillExecution,false);
  assert.equal(r.fields.points.reason,f.expected.reason);
  const confirmed=normalize({sources:f.sources,currentPoints:{sourceId:'PLAYER_CONFIRMED_POINTS',
    confirmedCurrent:true,value:50,observedAt:time,freshness:'LIVE'}});
  assert.equal(confirmed.observedState.pointsAvailable,50);
  assert.equal(confirmed.capabilities.paidRefillExecution,true);
});

test('frozen base registry items and random cooldown envelopes remain separate from planner mechanics',()=>{
  for (const id of ['XANAX_BASE_001','ECSTASY_BASE_001','EDVD_BASE_001',
    'CANDY_BASE_BONBONS_001','CANDY_BASE_CUPCAKE_001']) {
    const f=mech(id), actual=a.ITEM_REGISTRY[f.itemId];
    for (const [key,value] of Object.entries(f.expected)) if (key !== 'sourceNote')
      assert.deepEqual(actual[key],value,id);
  }
  assert.equal(a.ITEM_REGISTRY[206].cooldownSeconds,undefined);
  assert.equal(a.ITEM_REGISTRY[197].cooldownSeconds,undefined);
});
test('BOOSTER_MAX_BASE_ONLY_001 derives the base threshold only with complete verified effects',()=>{
  const f=mech('BOOSTER_MAX_BASE_ONLY_001');
  const complete=a.adaptPerks(emptyPerks(),meta('perks'));
  const r=a.projectItemMechanics(complete,activeState);
  assert.equal(r.boosterMaxSeconds,f.expected.boosterMaxSeconds);
  assert.equal(r.boosterMaxField.provenance,f.expected.provenance);
  assert.equal(!!r.itemMechanics.eroticDvd,f.expected.boosterPreparationSupported);
  assert.equal(a.projectItemMechanics(complete,{}).boosterMaxSeconds,null);
  assert.equal(a.projectItemMechanics(complete,{...activeState,effectEvidence:undefined}).boosterMaxSeconds,null);
});
for (const id of ['BOOSTER_MAX_DYNAMIC_FAIL_CLOSED_001','CANDY_DYNAMIC_FAIL_CLOSED_001',
  'CONSUMABLE_COOLDOWN_DYNAMIC_FAIL_CLOSED_001','EDVD_DYNAMIC_FAIL_CLOSED_001'])
  test(`${id} omits only affected planner-facing mechanics`,()=>{
    const f=mech(id), p=a.adaptPerks(emptyPerks(),meta('perks'));
    const r=a.projectItemMechanics(p,{...activeState,
      materialPreparationEffects:f.materialPreparationEffects});
    if (id.startsWith('BOOSTER_MAX')) assert.equal(r.boosterMaxSeconds,null);
    if (id.startsWith('CANDY') || id.startsWith('CONSUMABLE'))
      assert.equal(r.itemMechanics.candy37,undefined);
    if (id.startsWith('EDVD')) assert.equal(r.itemMechanics.eroticDvd,undefined);
    assert.equal(r.unsupported.some(x=>x.reason===f.expected.reason),true);
    assert.ok(a.ITEM_REGISTRY[37]);
  });
test('BOOSTER_ONE_ITEM_OVERCAP_001 and BOOSTER_AT_MAX_BLOCKED_001 use the planner threshold',()=>{
  for (const id of ['BOOSTER_ONE_ITEM_OVERCAP_001','BOOSTER_AT_MAX_BLOCKED_001']) {
    const f=mech(id);
    const r=planner.generateHappyRecipes({inventory:{ecstasy:1,eroticDvd:1},
      cooldowns:{boosterSeconds:f.state.currentBoosterSeconds,
        boosterMaxSeconds:f.state.boosterMaxSeconds}},
    {ecstasy:{happyMultiplier:2},eroticDvd:{happy:2500,cooldownSeconds:21600}},{});
    assert.equal(r.some(x=>x.items.some(item=>item.id==='eroticDvd')),f.expected.itemUseLegal,id);
    if (f.expected.itemUseLegal)
      assert.equal(f.state.currentBoosterSeconds+f.item.boosterCooldownSeconds,
        f.expected.resultingBoosterSeconds);
  }
});
test('FIVE_EDVD_BASE_MAX_CHECKPOINT_001 retains explicit wait/verify continuation',()=>{
  const f=mech('FIVE_EDVD_BASE_MAX_CHECKPOINT_001');
  const recipes=planner.generateHappyRecipes({inventory:{ecstasy:1,eroticDvd:5},
    cooldowns:{boosterSeconds:0,boosterMaxSeconds:86400}},
  {ecstasy:{happyMultiplier:2},eroticDvd:{happy:2500,cooldownSeconds:21600}},{});
  const four=recipes.find(x=>x.items.some(item=>item.quantity===4));
  assert.ok(four);
  assert.equal(four.nextBoosterCheckpoint.requiresBoosterSecondsBelow,f.expected.firstFourReachSeconds);
  assert.deepEqual(four.nextBoosterCheckpoint.actions.map(x=>x.action),['WAIT','VERIFY_STATE']);
});
for (const id of ['CANDY_EVENT_UNKNOWN_FAIL_CLOSED_001','CANDY_EVENT_ACTIVE_FAIL_CLOSED_001'])
  test(`${id} retains registry but omits Candy from planner projection`,()=>{
    const f=mech(id),p=a.adaptPerks(emptyPerks(),meta('perks'));
    const state=f.dynamicState.worldDiabetesDay === 'ACTIVE' ? 'ACTIVE' : undefined;
    const r=a.projectItemMechanics(p,{...activeState,worldDiabetesDay:state});
    assert.equal(r.itemMechanics.candy37,undefined);
    assert.equal(a.ITEM_REGISTRY[f.itemId].happyGain,25);
    assert.equal(r.unsupported.some(x=>x.reason===f.expected.reason),true);
  });
test('EDVD_UNSUPPORTED_PROJECTION_001 preserves inventory and omits mechanic',()=>{
  const f=mech('EDVD_UNSUPPORTED_PROJECTION_001');
  const r=normalize({sources:{perks:emptyPerks(),boosterInventory:page('Booster',
    [{id:f.itemId,name:'Erotic DVD',amount:3}])},dynamicState:{...activeState,
      materialPreparationEffects:[{scope:'eroticDvdEffect',description:'unsupported active'}]}});
  assert.equal(r.observedState.inventory.eroticDvd,3);
  assert.equal(r.itemMechanics.eroticDvd,undefined);
  assert.equal(r.capabilities.eroticDvdPreparation,false);
});
test('cached inventory never becomes LIVE by a fresh HTTP fetch; partial confirmation stays unready',()=>{
  const s={drugInventory:page('Drug',[{id:197,amount:1}])};
  const r=normalize({sources:s,sourceMeta:{drugInventory:meta('drugInventory','LIVE')},
    confirmedInventory:{sourceId:'PLAYER_CONFIRMED_INVENTORY',complete:true,
      confirmedCurrent:true,quantities:{ecstasy:1},observedAt:time,freshness:'LIVE'}});
  assert.equal(r.inventory.Drug.freshness,'FRESH');
  assert.notEqual(r.observedState.inventoryFreshness,'LIVE');
  const quantities=Object.fromEntries(Object.values(a.ITEM_REGISTRY).map(item=>[item.key,0]));
  quantities.ecstasy=1;
  const full=normalize({sources:s,confirmedInventory:{sourceId:'PLAYER_CONFIRMED_INVENTORY',
    complete:true,confirmedCurrent:true,quantities,observedAt:time,freshness:'LIVE'}});
  assert.equal(full.observedState.inventoryFreshness,'LIVE');
  assert.equal(full.fields.inventory.confirmation.provenance,'CONFIGURED');
  const stale=normalize({sources:s,sourceMeta:{drugInventory:meta('drugInventory','STALE')}});
  assert.equal(stale.observedState.inventory.ecstasy,undefined);
  assert.equal(stale.capabilities.inventoryPlanning,false);
  assert.equal(stale.inventory.Drug.reason,'DATA_STALE');
});
test('multi-page inventory requires linked pages, stable timestamps, and complete totals',()=>{
  const first={...page('Drug',[{id:197,amount:1}], 'p2',2),pageId:'p1'};
  const second={...page('Drug',[{id:206,amount:2}],null,2),pageId:'p2'};
  second._metadata.links.prev='p1';
  const good=normalize({sources:{drugInventory:[first,second]}});
  assert.equal(good.inventory.Drug.complete,true);
  assert.equal(good.observedState.inventory.xanax,2);
  const skipped=structuredClone(second);
  skipped.pageId='p3';
  const bad=normalize({sources:{drugInventory:[first,skipped]}});
  assert.equal(bad.inventory.Drug.reason,'INCOMPLETE_PAGINATION');
  assert.equal(Object.hasOwn(bad.observedState.inventory,'candy37'),false);
});
test('unknown item modifier from perk strings omits only its preparation class',()=>{
  const perks=emptyPerks();
  perks.faction.push('+ 25% happy gain from candy');
  const r=normalize({sources:{perks}});
  assert.equal(r.capabilities.candyPreparation,false);
  assert.equal(r.capabilities.eroticDvdPreparation,true);
  assert.equal(r.capabilities.drugPreparation,true);
  assert.equal(r.itemMechanics.candy37,undefined);
  assert.equal(r.itemMechanics.eroticDvd.happy,2500);
});
test('missing or denied perks never become zero gain modifiers in a planner recommendation',()=>{
  const samples={...fixture('BARS_DONATOR_ORDINARY_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources,
    ...fixture('COMPLETE_CARDIO_JOIN_001').sources};
  const r=normalize({sources:samples});
  assert.equal(r.capabilities.gainPrediction,false);
  assert.equal(planner.capabilities(r.observedState).canPredictGain,false);
  const output=planner.recommend({observedState:r.observedState,
    preferences:{targetStat:'speed',objective:'MAXIMUM_GAIN',allowItems:false}});
  assert.equal(output.status,'NO_SAFE_RECOMMENDATION');
});
test('source metadata, quarter-hour timing and typed economic inputs remain separate',()=>{
  const response=a.adaptBars(fixture('BARS_DONATOR_ORDINARY_001').sources.bars,
    {sourceId:'/user/bars',requestSucceeded:true,freshness:'LIVE'});
  assert.equal(response.fields.energy.freshness,'UNKNOWN');
  const market=a.adaptMarketSnapshot({...noop,items:[
    {id:'xanax',newCashEach:100,availableQuantity:2,newCashConcept:'CATALOG_MARKET_PRICE',
      replacementValueEach:99,replacementConcept:'OWNED_REPLACEMENT_VALUE'}]});
  assert.equal(market.items.xanax.newCashEach,undefined);
  assert.equal(market.items.xanax.replacementValueEach,99);
  const conflict=a.adaptMarketSnapshot({...noop,items:[
    {itemId:197,newCashConcept:'EXECUTABLE_NEW_CASH',newCashEach:10,availableQuantity:1},
    {itemId:197,newCashConcept:'EXECUTABLE_NEW_CASH',newCashEach:20,availableQuantity:1}]});
  assert.equal(conflict.available,false);
  assert.equal(conflict.items.ecstasy.newCashEach,undefined);
  const r=normalize({timingInput:{safeQuarterWindow:true,confirmedCurrent:false,
    sourceId:'SERVER_TIME',observedAt:time,freshness:'LIVE'}});
  assert.deepEqual(r.timing,{});
});
test('inactive event without its own verified evidence cannot enable base Candy',()=>{
  const p=a.adaptPerks(emptyPerks(),meta('perks'));
  const r=a.projectItemMechanics(p,{...activeState,eventEvidence:undefined});
  assert.equal(r.itemMechanics.candy37,undefined);
  assert.equal(r.boosterMaxSeconds,86400);
});
test('stale battle stats or refill state never become planner-authoritative',()=>{
  const f=fixture('BATTLESTATS_RAW_VALUE_001');
  const r=normalize({sources:{...f.sources,refills:{energy:false,special_count:0}},
    sourceMeta:{battlestats:meta('battlestats','STALE'),refills:meta('refills','UNKNOWN')}});
  assert.equal(r.fields.stats.freshness,'STALE');
  assert.equal(r.observedState.stats,undefined);
  assert.equal(r.observedState.pointRefill,undefined);
});
test('full normalized snapshot plans safely and preserves execution freshness gates',()=>{
  const f=fixture('BARS_DONATOR_ORDINARY_001');
  const response=normalize({sources:{...f.sources,...fixture('COOLDOWNS_POSITIVE_BOOSTER_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources,
    ...fixture('COMPLETE_CARDIO_JOIN_001').sources,perks:emptyPerks(),
    refills:{energy:false,special_count:0},
    drugInventory:page('Drug',[{id:197,amount:1}]),
    boosterInventory:page('Booster',[]),candyInventory:page('Candy',[])}});
  assert.equal(response.capabilities.gainPrediction,true);
  assert.equal(response.observedState.calibratedDomain,false);
  const ordinary=planner.recommend({observedState:response.observedState,
    itemMechanics:response.itemMechanics,marketSnapshot:response.marketSnapshot,
    timing:response.timing,preferences:{targetStat:'speed',objective:'MAXIMUM_GAIN',allowItems:false}});
  assert.equal(ordinary.status,'ok');
  assert.equal(ordinary.readiness.status,'READY');
  assert.equal(ordinary.primaryPlan.confidence.level,'SUPPORTED_EXTRAPOLATION');
  const happy=planner.recommend({observedState:response.observedState,
    itemMechanics:response.itemMechanics,marketSnapshot:response.marketSnapshot,
    timing:response.timing,preferences:{targetStat:'speed',objective:'MAXIMUM_GAIN',allowItems:true}});
  assert.equal(happy.status,'ok');
  assert.notEqual(happy.readiness.status,'READY');
  assert.equal(response.observedState.inventoryFreshness,'FRESH');
});
test('X8 Xanax registry mechanics remain withheld until stack cap has an approved source',()=>{
  const r=normalize({sources:{perks:emptyPerks(),...fixture('BARS_DONATOR_ORDINARY_001').sources,
    ...fixture('COOLDOWNS_POSITIVE_BOOSTER_001').sources}});
  assert.equal(a.ITEM_REGISTRY[206].happyGain,75);
  assert.deepEqual(r.itemMechanics.xanax,{energyGain:250,happyGain:75});
  assert.equal(r.observedState.xanax,undefined);
  assert.equal(r.observedState.stackCap,undefined);
  assert.equal(r.capabilities.xanaxPreparation,false);
  assert.equal(planner.generateEnergyCandidates({...r.observedState,stackCap:1000})
    .some(candidate=>candidate.actions.some(action=>action.action==='TAKE_XANAX')),false);
  assert.ok(r.unsupported.some(x=>x.capability==='xanaxPreparation' &&
    x.reason==='STACK_CAP_UNAVAILABLE'));
});
test('paid refill may plan from a verified unused state but unknown Points prevents READY',()=>{
  const bars=structuredClone(fixture('BARS_DONATOR_ORDINARY_001').sources.bars);
  bars.energy.current=50;
  const r=normalize({sources:{bars,...fixture('COOLDOWNS_POSITIVE_BOOSTER_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources,
    ...fixture('COMPLETE_CARDIO_JOIN_001').sources,
    perks:emptyPerks(),refills:{energy:false,special_count:0}}});
  const recommendation=planner.recommend({observedState:r.observedState,
    itemMechanics:r.itemMechanics,preferences:{targetStat:'speed',objective:'MAXIMUM_GAIN',
      allowRefill:true,allowItems:false}});
  assert.equal(recommendation.status,'ok');
  assert.equal(recommendation.primaryPlan.actions.some(x=>x.action==='USE_REFILL'),true);
  assert.equal(recommendation.readiness.status,'NEEDS_REFRESH');
  assert.equal(recommendation.readiness.reason,'DATA_MISSING');
});
test('malformed source and evidence shapes fail closed without throwing',()=>{
  const r=a.normalizeTrainingSources({sources:{drugInventory:{inventory:{items:42}}},
    sourceMeta:{drugInventory:null},dynamicState:null,configuredMechanics:null});
  assert.equal(r.capabilities.gainPrediction,false);
  assert.equal(r.capabilities.candyPreparation,false);
  assert.equal(r.inventory.Drug.complete,false);
  assert.equal(a.normalizeTrainingSources(null).capabilities.bars,false);
  const denied=a.adaptInventory({drugInventory:{...page('Drug',[{id:197,amount:2}]),
    status:'PERMISSION_DENIED'}},{drugInventory:meta('drugInventory','FRESH')});
  assert.equal(denied.inventory.ecstasy,undefined);
  assert.equal(denied.sourceStatuses.drugInventory.permissionFailure,true);
});
