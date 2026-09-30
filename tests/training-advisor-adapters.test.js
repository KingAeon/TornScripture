'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const a = require('../src/training-advisor-adapters.js');
const planner = require('../src/training-advisor-pure.js');
const root = path.join(__dirname,'../docs/divine-knowledge/chapters/dq-train-001');
const fixtures = require(path.join(root,'ADAPTER-FIXTURES-001D.json'));
const mechanicsFixtures = require(path.join(root,'ITEM-MECHANIC-FIXTURES-001D.json'));
const stackFixtures = require(path.join(root,'STACK-CAP-FIXTURES-001I.json'));
const cases = Object.fromEntries(fixtures.cases.map(c=>[c.id,c]));
const mechanicCases = Object.fromEntries(mechanicsFixtures.cases.map(c=>[c.id,c]));
const stackCases = Object.fromEntries(stackFixtures.cases.map(c=>[c.id,c]));
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
test('S1-S5 all five frozen 001I fixture IDs are unique',()=>{
  assert.equal(stackFixtures.status,'FROZEN');
  assert.equal(stackFixtures.cases.length,5);
  assert.equal(Object.keys(stackCases).length,5);
  assert.deepEqual(Object.keys(stackCases),[
    'STACK_CAP_VERSIONED_001','STACK_CAP_DISTINCT_FROM_NATURAL_MAX_001',
    'XANAX_ADAPTER_ENABLE_001','XANAX_DYNAMIC_DRUG_EFFECT_FAIL_CLOSED_001',
    'STACK_CAP_VERSION_MISMATCH_FAIL_CLOSED_001']);
});
for (const [index,f] of stackFixtures.cases.entries()) test(`S${index+1} ${f.id}`,()=>{
  const configuredMechanics=f.input.configuredMechanics;
  const bars=f.input.bars;
  const dynamicState=f.input.unsupportedDrugEffect ? {...activeState,
    materialPreparationEffects:[{scope:'drugEffect',description:'unsupported Xanax modifier'}]} : activeState;
  const r=normalize({configuredMechanics,dynamicState,
    sources:{perks:emptyPerks(),...(bars ? {bars} : {})}});
  if (f.id==='STACK_CAP_VERSIONED_001') {
    assert.equal(r.observedState.stackCap,f.expected.observedState.stackCap);
    for (const [key,value] of Object.entries(f.expected.field))
      assert.equal(r.fields.stackCap[key],value,key);
    assert.equal(r.fields.stackCap.verifiedAt,stackFixtures.verifiedAt);
    assert.equal(r.fields.stackCap.observedAt,null);
    assert.notEqual(r.fields.stackCap.sourceId,'/user/bars');
    assert.equal(r.capabilities.xanaxPreparation,f.expected.capabilityAvailable);
  } else if (f.id==='STACK_CAP_DISTINCT_FROM_NATURAL_MAX_001') {
    assert.equal(r.observedState.naturalEnergyMax,f.expected.naturalEnergyMax);
    assert.equal(r.observedState.stackCap,f.expected.stackCap);
    assert.equal(r.fields.naturalEnergyMax.sourceId,'/user/bars');
    assert.notEqual(r.fields.naturalEnergyMax.sourceId,r.fields.stackCap.sourceId);
    assert.notEqual(r.observedState.naturalEnergyMax,r.observedState.stackCap);
  } else if (f.id==='XANAX_ADAPTER_ENABLE_001') {
    assert.deepEqual(r.itemMechanics.xanax,f.input.itemMechanics.xanax);
    assert.equal(r.observedState.stackCap,f.expected.observedState.stackCap);
    assert.deepEqual(r.observedState.xanax,f.expected.observedState.xanax);
    assert.equal(r.capabilities.xanaxPreparation,f.expected.xanaxPreparation);
    assert.equal(r.unsupported.some(x=>x.capability==='xanaxPreparation'),false);
  } else if (f.id==='XANAX_DYNAMIC_DRUG_EFFECT_FAIL_CLOSED_001') {
    assert.equal(r.observedState.stackCap,f.expected.observedState.stackCap);
    assert.equal(r.itemMechanics.xanax,undefined);
    assert.equal(r.observedState.xanax,undefined);
    assert.equal(Object.hasOwn(r.observedState,'xanax'),false);
    assert.equal(r.capabilities.xanaxPreparation,f.expected.xanaxPreparation);
    assert.ok(r.unsupported.some(x=>x.capability==='xanaxPreparation' && x.reason===f.expected.reason));
    assert.equal(r.capabilities.bars,false);
    assert.equal(r.capabilities.drugPreparation,false);
  } else if (f.id==='STACK_CAP_VERSION_MISMATCH_FAIL_CLOSED_001') {
    assert.equal(r.observedState.stackCap,undefined);
    assert.equal(r.observedState.xanax,undefined);
    assert.equal(Object.hasOwn(r.observedState,'stackCap'),false);
    assert.equal(Object.hasOwn(r.observedState,'xanax'),false);
    assert.equal(r.capabilities.xanaxPreparation,f.expected.xanaxPreparation);
    assert.equal(r.fields.stackCap.reason,f.expected.reason);
    assert.ok(r.unsupported.some(x=>x.capability==='xanaxPreparation' && x.reason===f.expected.reason));
  }
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
test('cached inventory never becomes LIVE by a fresh HTTP fetch; partial confirmation never promotes all inventory',()=>{
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

const currentInventoryConfirmation = quantities => ({sourceId:'PLAYER_CONFIRMED_INVENTORY',
  confirmedCurrent:true,quantities,observedAt:time,freshness:'LIVE'});
const confirmationSources = () => ({drugInventory:page('Drug',[{id:206,amount:5},{id:197,amount:1}]),
  boosterInventory:page('Booster',[{id:366,amount:2}]),
  candyInventory:page('Candy',[{id:37,amount:7}])});
test('J-P1 required-only confirmation overlays quantities with item-local LIVE proof',()=>{
  const r=normalize({sources:confirmationSources(),confirmedInventory:
    currentInventoryConfirmation({xanax:1,eroticDvd:2,ecstasy:1})});
  assert.deepEqual(r.observedState.inventoryFreshnessByItem,
    Object.fromEntries(Object.values(a.ITEM_REGISTRY).map(item=>[item.key,
      ['xanax','eroticDvd','ecstasy'].includes(item.key)?'LIVE':'FRESH'])));
  assert.equal(r.observedState.inventory.xanax,1);
  assert.equal(r.observedState.inventory.candy37,7);
  assert.equal(r.observedState.inventoryFreshness,'FRESH');
  assert.equal(r.observedState.freshness.inventory,'FRESH');
  assert.equal(r.capabilities.inventoryExecution,false);
  assert.deepEqual(r.fields.inventory.confirmation.value,{xanax:1,eroticDvd:2,ecstasy:1});
  assert.equal(r.fields.inventory.confirmation.observedAt,time);
  assert.equal(r.fields.inventory.confirmation.cacheClass,'PLAYER_CONFIRMATION');
  assert.equal(r.inventory.Drug.freshness,'FRESH');
});
test('J-P2 explicit zero and missing API inventory never invent unrelated quantities',()=>{
  const r=normalize({confirmedInventory:currentInventoryConfirmation({xanax:0})});
  assert.equal(r.observedState.inventory.xanax,0);
  assert.deepEqual(r.observedState.inventoryFreshnessByItem,{xanax:'LIVE'});
  assert.equal(Object.hasOwn(r.observedState.inventory,'ecstasy'),false);
  assert.equal(r.observedState.inventoryFreshness,'UNKNOWN');
  assert.equal(r.capabilities.inventoryExecution,false);
});
test('J-P3 unverified, stale, malformed or unknown-item confirmations cannot promote quantities',()=>{
  for (const patch of [{confirmedCurrent:false},{freshness:'FRESH'},{freshness:'STALE'},
    {observedAt:null},{quantities:{xanax:-1}},{quantities:{xanax:0.5}},
    {quantities:{xanax:'1'}},{quantities:{xanax:Number.MAX_SAFE_INTEGER+1}},
    {quantities:{unknownItem:1}}]) {
    const r=normalize({sources:confirmationSources(),confirmedInventory:
      {...currentInventoryConfirmation({xanax:1}),...patch}});
    assert.equal(r.observedState.inventory.xanax,5,JSON.stringify(patch));
    assert.equal(r.observedState.inventoryFreshnessByItem.xanax,'FRESH');
    assert.equal(r.fields.inventory.confirmation,undefined);
    assert.equal(Object.hasOwn(r.observedState.inventory,'unknownItem'),false);
  }
});
test('J-P4 complete confirmation preserves the existing all-registry LIVE path',()=>{
  const quantities=Object.fromEntries(Object.values(a.ITEM_REGISTRY).map(item=>[item.key,0]));
  quantities.xanax=1;
  const r=normalize({sources:confirmationSources(),confirmedInventory:
    {...currentInventoryConfirmation(quantities),complete:true}});
  assert.deepEqual(r.observedState.inventory,quantities);
  assert.ok(Object.values(r.observedState.inventoryFreshnessByItem).every(f=>f==='LIVE'));
  assert.equal(r.observedState.inventoryFreshness,'LIVE');
  assert.equal(r.capabilities.inventoryExecution,true);
});
function confirmationSnapshot(quantities,sources={}) {
  return normalize({sources:{...confirmationSources(),...fixture('BARS_DONATOR_ORDINARY_001').sources,
    cooldowns:{drug:0,booster:0},...fixture('BATTLESTATS_RAW_VALUE_001').sources,
    ...fixture('COMPLETE_CARDIO_JOIN_001').sources,perks:emptyPerks(),...sources},
    confirmedInventory:quantities && currentInventoryConfirmation(quantities),
    timingInput:{sourceId:'SYNTHETIC_VERIFIED_WINDOW',confirmedCurrent:true,
      observedAt:time,freshness:'LIVE',safeQuarterWindow:true}});
}
const confirmationRecommendation = r => planner.recommend({observedState:r.observedState,
  itemMechanics:r.itemMechanics,timing:r.timing,
  preferences:{objective:'MAXIMUM_GAIN',allowItems:true,maxWaitSeconds:0}});
test('J-P5 adapter-to-planner selected-plan confirmation grants READY without promoting alternatives',()=>{
  const before=confirmationRecommendation(confirmationSnapshot());
  assert.equal(before.readiness.status,'NEEDS_REFRESH');
  const needed=before.primaryPlan.resources.ownedItemsConsumed;
  assert.deepEqual(needed,{xanax:1});
  const after=confirmationRecommendation(confirmationSnapshot(needed));
  assert.equal(after.readiness.status,'READY');
  assert.equal(after.primaryPlan.fingerprint,before.primaryPlan.fingerprint);
  assert.deepEqual(after.outcome,before.outcome);
  assert.deepEqual(after.economics,before.economics);
  assert.deepEqual(after.primaryPlan.confidence,before.primaryPlan.confidence);
  const r=confirmationSnapshot(needed);
  const unrelated=planner.planReadiness({actions:[{action:'TRAIN'}],
    resources:{ownedItemsConsumed:{candy37:1}}},r.observedState);
  assert.equal(unrelated.status,'NEEDS_REFRESH');
});
test('J-P6 conflicting confirmation changes the next recommendation without reusing cached resource counts',()=>{
  const before=confirmationRecommendation(confirmationSnapshot());
  const r=confirmationSnapshot({xanax:0,eroticDvd:0,ecstasy:0});
  const after=confirmationRecommendation(r);
  assert.equal(planner.compareRecommendationIdentity(before.primaryPlan,after.primaryPlan)
    .recommendationIdentityChanged,true);
  assert.deepEqual(after.primaryPlan.resources.ownedItemsConsumed,{});
  assert.equal(after.primaryPlan.actions.some(x=>['TAKE_XANAX','TAKE_ECSTASY','USE_BOOSTER']
    .includes(x.action)),false);
  assert.equal(planner.planReadiness(before.primaryPlan,r.observedState,before.timing).status,'NEEDS_ITEMS');
});
test('J-P12 Happy preparation confirms just the selected boosters and Ecstasy with timing still required',()=>{
  const sources={drugInventory:page('Drug',[{id:197,amount:1}]),candyInventory:page('Candy',[])};
  const before=confirmationRecommendation(confirmationSnapshot(undefined,sources));
  const needed=before.primaryPlan.resources.ownedItemsConsumed;
  assert.deepEqual(needed,{eroticDvd:2,ecstasy:1});
  const r=confirmationSnapshot(needed,sources);
  const after=confirmationRecommendation(r);
  assert.equal(after.readiness.status,'READY');
  assert.equal(after.primaryPlan.fingerprint,before.primaryPlan.fingerprint);
  assert.deepEqual(after.outcome,before.outcome);
  assert.equal(r.observedState.inventoryFreshnessByItem.xanax,'FRESH');
  assert.equal(planner.planReadiness(after.primaryPlan,r.observedState,{}).status,'NEEDS_REFRESH');
});
test('J-P13 invalid keys stay isolated and confirmation is not retained by a later normalization',()=>{
  const input={sources:confirmationSources(),confirmedInventory:
    currentInventoryConfirmation({xanax:0,ecstasy:-1,unknownItem:9})};
  const before=structuredClone(input);
  const r=normalize(input);
  assert.deepEqual(input,before);
  assert.deepEqual(r.fields.inventory.confirmation.value,{xanax:0});
  assert.equal(r.observedState.inventory.ecstasy,1);
  assert.equal(r.observedState.inventoryFreshnessByItem.ecstasy,'FRESH');
  const later=normalize({sources:confirmationSources()});
  assert.equal(later.observedState.inventory.xanax,5);
  assert.equal(later.observedState.inventoryFreshnessByItem.xanax,'FRESH');
  assert.equal(later.fields.inventory.confirmation,undefined);
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
test('S3/S6/X8 supported Xanax projects one immediate +75 Happy checkpoint without future cooldown',()=>{
  const bars=structuredClone(fixture('BARS_DONATOR_ORDINARY_001').sources.bars);
  bars.energy.current=500;
  const r=normalize({sources:{perks:emptyPerks(),...fixture('BARS_DONATOR_ORDINARY_001').sources,
    bars,...fixture('COOLDOWNS_POSITIVE_BOOSTER_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources,
    ...fixture('COMPLETE_CARDIO_JOIN_001').sources,
    drugInventory:page('Drug',[{id:206,amount:1}]),
    boosterInventory:page('Booster',[]),candyInventory:page('Candy',[])}});
  assert.equal(a.ITEM_REGISTRY[206].happyGain,75);
  assert.deepEqual(r.itemMechanics.xanax,{energyGain:250,happyGain:75});
  assert.deepEqual(r.observedState.xanax,{energyGain:250});
  assert.equal(r.observedState.stackCap,1000);
  assert.equal(r.capabilities.xanaxPreparation,true);
  assert.equal(Object.hasOwn(r.observedState.xanax,'cooldownSeconds'),false);
  const candidates=planner.generateEnergyCandidates({...r.observedState,maxWaitSeconds:28800});
  const xanax=candidates.filter(candidate=>candidate.type==='WAIT_XANAX');
  assert.equal(xanax.length,1);
  assert.equal(xanax[0].xanaxUses,1);
  assert.deepEqual(xanax[0].actions,[{action:'TAKE_XANAX'}]);
  assert.equal(xanax[0].postDrugCooldownSeconds,null);
  const plan=planner.composePlan({state:r.observedState,energy:xanax[0],itemMechanics:r.itemMechanics});
  assert.equal(plan.reason,undefined);
  assert.equal(plan.simulation.trains[0].happyBefore,4075);
  assert.equal(plan.preEcstasyHappy,4075);
  assert.equal(plan.actions.filter(action=>action.action==='TAKE_XANAX').length,1);
  assert.equal(r.observedState.inventoryFreshness,'FRESH');
  assert.equal(r.capabilities.inventoryExecution,false);
  const blocked=normalize({sources:{bars,cooldowns:{drug:3600,booster:0},perks:emptyPerks()}});
  assert.equal(planner.generateEnergyCandidates({...blocked.observedState,maxWaitSeconds:0})
    .some(candidate=>candidate.type==='WAIT_XANAX'),false);
  const afterWait=planner.generateEnergyCandidates({...blocked.observedState,maxWaitSeconds:3600})
    .filter(candidate=>candidate.type==='WAIT_XANAX');
  assert.equal(afterWait.length,1);
  assert.equal(afterWait[0].xanaxUses,1);
  assert.deepEqual(afterWait[0].actions.slice(0,1),
    [{action:'WAIT',seconds:3600,checkpoint:'DRUG_COOLDOWN'}]);
});
test('S4 unsupported drug effect leaves unrelated gain prediction available',()=>{
  const r=normalize({sources:{...fixture('BARS_DONATOR_ORDINARY_001').sources,
    ...fixture('BATTLESTATS_RAW_VALUE_001').sources,
    ...fixture('COMPLETE_CARDIO_JOIN_001').sources,perks:emptyPerks()},
  dynamicState:{...activeState,materialPreparationEffects:[
    {scope:'drugEffect',description:'unsupported Xanax modifier'}]}});
  assert.equal(r.observedState.stackCap,1000);
  assert.equal(r.observedState.xanax,undefined);
  assert.equal(r.capabilities.xanaxPreparation,false);
  assert.equal(r.capabilities.gymPrediction,true);
  assert.equal(r.capabilities.gainPrediction,true);
  assert.ok(r.unsupported.some(x=>x.capability==='xanaxPreparation' && x.reason==='UNSUPPORTED_EFFECT'));
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
