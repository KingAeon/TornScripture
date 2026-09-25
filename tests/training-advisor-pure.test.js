'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const m = require('../src/training-advisor-pure.js');
const root = path.join(__dirname,'../docs/divine-knowledge/chapters/dq-train-001');
const math = require(path.join(root,'MATH-ENGINE-FIXTURES-001A.json'));
const policy = require(path.join(root,'PLANNER-POLICY-FIXTURES-001C.json'));
const strategy = require(path.join(root,'PLANNER-STRATEGY-FIXTURES-001C.json'));
const liveFreshness = {energy:'LIVE',happy:'LIVE',drugCooldown:'LIVE',boosterCooldown:'LIVE',
  inventory:'LIVE',gym:'FRESH',gainModifiers:'FRESH'};
function near(actual, expected) {
  const target = Number(expected);
  assert.ok(Math.abs(actual-target) <= math.arithmeticProfile.absoluteTolerance +
    Math.abs(target)*math.arithmeticProfile.relativeTolerance,`${actual} != ${target}`);
}
for (const f of math.helperFixtures.happyMultiplier) test(`math Happy multiplier ${f.happy}`,()=>{
  near(m.happyMultiplier(f.happy).logarithm,f.lnRound4);
  near(m.happyMultiplier(f.happy).multiplier,f.multiplierRound4);
});
for (const f of math.helperFixtures.happyLoss) test(`math Happy loss ${f.energyPerTrain}/${f.roll}`,()=>{
  assert.equal(m.happyLoss(f.energyPerTrain,f.roll),f.loss);
});
for (const f of math.cases) test(`frozen math ${f.id}`,()=>{
  const result = m.simulateTraining(f.input);
  assert.equal(result.status,f.expected.status);
  if (f.expected.reason) return assert.equal(result.reason,f.expected.reason);
  assert.equal(result.model.status,math.modelStatus);
  near(result.totalGain,f.expected.totalGain);
  near(result.end.stat,f.expected.finalStat);
  assert.equal(result.end.happy,f.expected.finalHappy);
  assert.equal(result.energySpent,f.expected.energySpent);
  if (f.expected.canonicalPerkOrder) assert.deepEqual(result.canonicalPerkOrder,f.expected.canonicalPerkOrder);
  if (f.expected.trainTrace) for (const trace of f.expected.trainTrace) {
    for (const [key,value] of Object.entries(trace)) {
      if (typeof value === 'string') near(result.trains[trace.index][key],value);
      else assert.equal(result.trains[trace.index][key],value);
    }
  }
});
for (const f of policy.rankingCases) test(`frozen policy ${f.id}`,()=>{
  const r=m.rankCandidates(f);
  assert.equal(r.status,'ok');
  assert.equal(r.selected.id,f.expected.selected);
  for (const item of [...(f.expected.excluded||[]),...(f.expected.rejected||[])])
    assert.ok(r.excluded.some(x=>x.id===item.id && x.reason===item.reason));
  if (f.expected.advancedReason) assert.ok(r.advancedReasons.includes(f.expected.advancedReason));
  if (f.expected.retainAlternative) assert.ok(r.alternatives.some(x=>x.id===f.expected.retainAlternative));
  for (const [id,expected] of Object.entries(f.expected.diagnostics||{})) {
    for (const [field,value] of Object.entries(expected)) assert.equal(r.diagnostics[id][field],value);
  }
  assert.equal(m.rankCandidates({...f,candidates:[...f.candidates].reverse()}).selected.id,f.expected.selected);
});
const byId=Object.fromEntries(strategy.cases.map(x=>[x.id,x]));
test('frozen strategy TRAIN_NOW_001',()=>{
  const f=byId.TRAIN_NOW_001;
  const e=m.generateEnergyCandidates({...f.input.observedState,maxWaitSeconds:0});
  assert.deepEqual(e.map(x=>x.type),f.expected.candidateFamilies);
  const p=m.composePlan({state:f.input.observedState,energy:e[0]});
  assert.deepEqual(p.actions.map(x=>({action:x.action,...(x.targetStat?{targetStat:x.targetStat,trainCount:x.trainCount,energySpent:x.energySpent}:{})})),f.expected.primaryStructure);
});
test('frozen strategy FULL_EDVD_ECSTASY_001',()=>{
  const f=byId.FULL_EDVD_ECSTASY_001;
  // The frozen action fixture assumes validated execution state; normalize its freshness explicitly.
  const state={...f.input.observedState,freshness:liveFreshness,gainPerks:[],activeEffects:[]};
  const p=m.composePlan({state,energy:m.generateEnergyCandidates({...state,stackCap:1000})[0],
    recipe:{items:[{id:'eroticDvd',quantity:5,owned:5,newCashEach:0,replacementValueEach:0}],useEcstasy:true},
    itemMechanics:{eroticDvd:{happy:f.input.itemMechanics.eroticDvdHappy,
      cooldownSeconds:f.input.itemMechanics.eroticDvdCooldownSeconds},
      ecstasy:{happyMultiplier:f.input.itemMechanics.ecstasyHappyMultiplier,replacementValue:0}},
    timing:f.input.timing});
  assert.equal(p.preEcstasyHappy,f.expected.preEcstasyHappy);
  assert.equal(p.postEcstasyHappy,f.expected.postEcstasyHappy);
  assert.deepEqual(p.actions.map(({action,item,quantity,expectedHappy,targetStat,trainCount,energySpent})=>({action,
    ...(item?{item,quantity}:{}),...(expectedHappy?{expectedHappy}:{}),
    ...(targetStat?{targetStat,trainCount,energySpent}:{})})),f.expected.actionStructure);
  assert.equal(p.readiness.status,f.expected.readiness);
});
test('frozen strategy CANDY_FRONTIER_001',()=>{
  const f=byId.CANDY_FRONTIER_001;
  const result=m.generateHappyFrontier(f.input);
  assert.deepEqual(result.dominatedItemIds,f.expected.dominatedItemIds);
  assert.deepEqual(result.frontier.map(c=>({cheap:c.bundle.cheapBought||0,strong:c.bundle.strongBought||0,
    happy:c.happy,newCash:c.newCash})),f.expected.frontier);
  assert.deepEqual(m.generateHappyFrontier({...f.input,items:[...f.input.items].reverse()}).frontier,result.frontier);
});
test('frozen strategy OWNED_SUBSTITUTION_001',()=>{
  const f=byId.OWNED_SUBSTITUTION_001;
  const r=m.generateHappyFrontier(f.input);
  for (const expected of f.expected.rawCandidatesInclude) assert.ok(r.rawCandidates.some(c=>
    Object.keys(c.bundle).length===Object.keys(expected.bundle).length &&
    Object.entries(expected.bundle).every(([key,value])=>c.bundle[key]===value) &&
      c.newCash===expected.newCash && c.happy===expected.happy));
  for (const expected of f.expected.frontierRetains) assert.ok(r.frontier.some(c=>
    Object.keys(c.bundle).length===Object.keys(expected.bundle).length &&
    Object.entries(expected.bundle).every(([key,value])=>c.bundle[key]===value)));
  for (const expected of f.expected.frontierPrunes) assert.ok(!r.frontier.some(c=>
    Object.keys(c.bundle).length===Object.keys(expected.bundle).length &&
    Object.entries(expected.bundle).every(([key,value])=>c.bundle[key]===value)));
});
test('frozen strategy ENERGY_CHECKPOINT_001',()=>{
  const f=byId.ENERGY_CHECKPOINT_001;
  const r=m.generateEnergyCandidates(f.input);
  assert.deepEqual(r.map(x=>({type:x.type,energyAtTraining:x.energyAtTraining,waitSeconds:x.waitSeconds,
    ...(x.xanaxUses?{xanaxUses:x.xanaxUses}:{})})),f.expected.meaningfulCandidates);
});
test('frozen strategy REFILL_CAP_001',()=>{
  const f=byId.REFILL_CAP_001;
  const r=m.generateEnergyCandidates(f.input).find(x=>x.type==='REFILL');
  for (const [k,v] of Object.entries(f.expected.refillCandidate)) assert.equal(r[k],v);
});
test('frozen strategy CAPPED_NATURAL_LOSS_001',()=>{
  const f=byId.CAPPED_NATURAL_LOSS_001;
  assert.equal(m.naturalEnergyLost(f.input),f.expected.naturalEnergyLost);
});
test('frozen strategy MICRO_JUMP_001',()=>{
  const f=byId.MICRO_JUMP_001;
  const state={energy:f.input.energy,naturalEnergyMax:f.input.naturalEnergyMax,happy:f.input.happy,
    inventory:f.input.inventory,gym:{energyPerTrain:10,dots:5},targetStat:'speed',stats:{speed:10000},
    cooldowns:{boosterMaxSeconds:4},calibratedDomain:false};
  const r=m.recommend({observedState:state,preferences:{allowItems:true,maxWaitSeconds:0},
    itemMechanics:{syntheticCandy:{happy:f.input.syntheticCandyMechanics.happyEach,cooldownSeconds:1,
      replacementValueEach:1},ecstasy:{happyMultiplier:2,replacementValue:1}}});
  assert.ok(r.primaryPlan);
  assert.deepEqual([...new Set([r.primaryPlan,...r.alternatives].map(p=>p.actions.some(a=>a.action==='TAKE_ECSTASY')?'MICRO_JUMP':'TRAIN_NOW'))].sort(),
    [...f.expected.candidateFamilies].sort());
  assert.ok(![r.primaryPlan,...r.alternatives].some(p=>p.actions.some(a=>a.action==='TAKE_XANAX')));
});
test('frozen strategy OBSERVATION_OVERRIDES_PREDICTION_001',()=>{
  const f=byId.OBSERVATION_OVERRIDES_PREDICTION_001;
  const r=m.resolveObserved(f.input.predictedAfterEcstasy,f.input.observedAfterEcstasy);
  assert.equal(r.state.happy,f.expected.subsequentSimulationHappy);
  assert.equal(r.reason,f.expected.reason);
  assert.equal(r.reSimulateRemainingPlan,f.expected.reSimulateRemainingPlan);
});
test('frozen strategy UNSUPPORTED_EFFECT_LOCALITY_001',()=>{
  const f=byId.UNSUPPORTED_EFFECT_LOCALITY_001;
  const r=m.capabilities({activeEffects:[f.input.activeEffect],inventory:{},stats:{speed:100},
    targetStat:'speed',happy:100,gym:{dots:5}},{items:{}});
  assert.equal(r.canPredictGain,f.expected.canPredictAffectedGain);
  assert.equal(r.canUseInventory,f.expected.canUseInventory);
  assert.equal(r.canCompareMarket,f.expected.canCompareMarket);
  assert.equal(r.reason,f.expected.reason);
});
test('frozen strategy PARTIAL_50M_PLAN_001',()=>{
  const f=byId.PARTIAL_50M_PLAN_001;
  const resolved=m.simulateResolvedBoundary({modelMaxStartStat:50000000,startStat:f.input.startStat,
    internalTrainGains:f.input.syntheticResolvedGainSequence,energyPerTrain:f.input.energyPerTrain,
    availableEnergy:f.input.energy});
  assert.equal(resolved.modeledTrainCount,f.expected.modeledTrainCount);
  assert.equal(resolved.endingModeledStat,f.expected.modeledEndStat);
  assert.equal(resolved.remainingEnergy,f.expected.remainingEnergy);
  assert.equal(resolved.eligibleForFullOutcomeRanking,f.expected.fullOutcomeRankable);
  const modeled=m.simulatePlanTraining({modelId:m.MODEL_ID,stat:{kind:'speed',value:49999999},
    happy:1000,gym:{dots:5,energyPerTrain:10},gainPerks:[],energy:20});
  assert.equal(modeled.status,'partial');
  assert.equal(modeled.modeledTrainCount,1);
  assert.equal(modeled.reason,f.expected.reason);
  assert.equal(modeled.fullOutcomeRankable,f.expected.fullOutcomeRankable);
});
for (const f of policy.capabilityAndStateCases) test(`frozen policy state ${f.id}`,()=>{
  const {context,expected}=f;
  switch(f.id) {
    case 'STALE_INVENTORY_EXECUTION_001': {
      const r=m.planReadiness({actions:[{action:'USE_BOOSTER'}],resources:{ownedItemsConsumed:{candy:1}}},context);
      assert.equal(r.status,expected.readiness); assert.equal(r.reason,expected.reason); break;
    }
    case 'MARKET_UNAVAILABLE_001': {
      const r=m.capabilities({stats:{speed:100},targetStat:'speed',happy:100,gym:{dots:5}}, {available:false});
      assert.equal(r.canPredictGain,expected.canPredictGain);
      assert.equal(r.canCompareCost,expected.canCompareCost);
      const ranked=m.rankCandidates({objective:'BALANCED',candidates:[{id:'unknown',fingerprint:'unknown',
        confidence:'CALIBRATED',expectedGain:100,economicValueConsumed:null}]});
      assert.equal(ranked.reason,expected.priceObjectiveStatus);break;
    }
    case 'UNSUPPORTED_MODIFIER_001': {
      const r=m.recommend({observedState:{energy:100,naturalEnergyMax:100,happy:100,
        gym:{dots:5,energyPerTrain:10},stats:{speed:100},targetStat:'speed',
        activeEffects:[{support:'UNSUPPORTED',affects:['gymGain']}]}});
      assert.equal(r.status,expected.status);assert.equal(r.reason,expected.reason);break;
    }
    case 'QUARTER_HOUR_UNSAFE_001': {
      const r=m.planReadiness({actions:[{action:'TAKE_ECSTASY'}]}, {},
        {safeQuarterWindow:context.secondsUntilReset >= context.executionTimeEstimateSeconds});
      assert.equal(r.status,expected.readiness); assert.equal(r.reason,expected.reason); assert.equal(r.nextAction,expected.nextAction);break;
    }
    case 'OVERDOSE_INTERRUPT_001': {
      const r=m.replanOnEvent(context);
      assert.equal(r.phase,expected.phase);assert.equal(r.reason,expected.reason);
      assert.deepEqual(r.invalidate,expected.invalidate);assert.equal(r.modelContradiction,expected.modelContradiction);break;
    }
    case 'PLAYER_DEVIATION_001': {
      const r=m.replanOnEvent(context);
      assert.equal(r.reason,expected.reason); assert.equal(r.action,expected.action);
      assert.equal(r.preserveSpentResources,expected.preserveSpentResources);break;
    }
    case 'PRICE_REFRESH_IDENTITY_001': {
      const r=m.compareRecommendationIdentity(context.before,context.after);
      assert.equal(r.recommendationIdentityChanged,expected.recommendationIdentityChanged);
      assert.equal(r.economicsUpdated,expected.economicsUpdated);break;
    }
    case 'MODEL_50M_PARTIAL_001': {
      const r=m.simulateResolvedBoundary(context);
      for (const [k,v] of Object.entries(expected)) assert.equal(r[k],v);break;
    }
    case 'NO_SAFE_RECOMMENDATION_001': {
      const r=m.recommend({});assert.equal(r.status,expected.status);assert.equal(r.reason,expected.reason);break;
    }
  }
});
test('pure engine fail closed and leaves inputs unchanged',()=>{
  const input=structuredClone(math.cases[0].input), original=structuredClone(input);
  assert.deepEqual(m.simulateTraining(input),m.simulateTraining(input));
  assert.deepEqual(input,original);
  assert.equal(m.simulateTraining({...input,effects:[{id:'book'}]}).reason,'UNSUPPORTED_EFFECT');
  assert.equal(m.simulateTraining({...input,gainPerks:[{id:'x',rate:0.1},{id:'x',rate:0.2}]}).status,'invalid');
});
test('full planner composes a supported 1,000E five-DVD path and keeps it advisory',()=>{
  const state={energy:1000,naturalEnergyMax:150,stackCap:1000,happy:4275,
    stats:{speed:100000},targetStat:'speed',gym:{id:'complete_cardio',dots:5.8,energyPerTrain:10},
    cooldowns:{drugSeconds:0,boosterSeconds:0,boosterMaxSeconds:108000},
    inventory:{eroticDvd:5,ecstasy:1},calibratedDomain:true,freshness:liveFreshness,
    gainPerks:[],activeEffects:[]};
  const response=m.recommend({observedState:state,preferences:{objective:'MAXIMUM_GAIN'},
    itemMechanics:{eroticDvd:{happy:2500,cooldownSeconds:21600,replacementValueEach:100000},
      ecstasy:{happyMultiplier:2,replacementValue:200000}},timing:{safeQuarterWindow:true}});
  assert.equal(response.status,'ok');
  assert.equal(response.primaryPlan.preEcstasyHappy,16775);
  assert.equal(response.primaryPlan.postEcstasyHappy,33550);
  assert.equal(response.primaryPlan.simulation.modeledTrainCount,100);
  assert.equal(response.primaryPlan.economics.newCashRequired,0);
  assert.equal(response.primaryPlan.economics.marketValueOfOwnedItemsConsumed,700000);
  assert.equal(response.readiness.status,'READY');
  assert.equal(response.primaryPlan.actions.at(-1).action,'TRAIN');
  assert.ok(response.primaryPlan.actions.every(a=>!('execute' in a)));
});
test('owned and bought recipes preserve cash and replacement value separately',()=>{
  const state={inventory:{strong:2,cheap:4,ecstasy:1},cooldowns:{boosterMaxSeconds:4}};
  const mechanics={strong:{happy:180,cooldownSeconds:1,replacementValueEach:250000},
    cheap:{happy:100,cooldownSeconds:1,replacementValueEach:100000},
    ecstasy:{happyMultiplier:2,replacementValue:100000}};
  const market={items:[{id:'strong',newCashEach:150000,availableQuantity:2},
    {id:'cheap',newCashEach:100000,availableQuantity:2}]};
  const recipes=m.generateHappyRecipes(state,mechanics,market,{budgetNewCash:200000});
  assert.ok(recipes.some(x=>x.items.some(y=>y.id==='strong' && y.owned===2 && y.quantity===2) &&
    x.items.some(y=>y.id==='cheap' && y.owned===2 && y.quantity===2)));
  assert.ok(recipes.some(x=>x.items.some(y=>y.id==='strong' && y.quantity>y.owned) &&
    x.preparation.newCashRequired>0));
  assert.ok(recipes.every(x=>x.preparation.newCashRequired<=200000));
});
test('missing replacement quote preserves owned gain plans for gain-only objective',()=>{
  const state={energy:100,naturalEnergyMax:100,stackCap:1000,happy:4000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5.8,energyPerTrain:10},
    inventory:{candy:2,ecstasy:1},cooldowns:{drugSeconds:0,boosterMaxSeconds:2}};
  const itemMechanics={candy:{happy:250,cooldownSeconds:1},ecstasy:{happyMultiplier:2}};
  const r=m.recommend({observedState:state,preferences:{objective:'MAXIMUM_GAIN'},
    marketSnapshot:{available:false},itemMechanics,timing:{safeQuarterWindow:true}});
  assert.equal(r.status,'ok');
  assert.equal(r.primaryPlan.resources.ownedItemsConsumed.candy,2);
  assert.equal(r.primaryPlan.economics.economicValueConsumed,null);
  assert.equal(r.capabilities.canCompareCost,false);
  const priced=m.recommend({observedState:state,preferences:{objective:'BALANCED'},itemMechanics});
  assert.ok(priced.primaryPlan);
  assert.ok(!priced.primaryPlan.resources.ownedItemsConsumed.candy);
});
test('point refill is excluded if point quantity is unknown; no value is invented',()=>{
  const state={energy:100,naturalEnergyMax:150,stackCap:1000,happy:1000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5.8,energyPerTrain:10},
    pointRefill:{allowed:true,fillAmountPolicy:'natural_max'}};
  const r=m.recommend({observedState:state,preferences:{objective:'MAXIMUM_GAIN',allowRefill:true}});
  assert.equal(r.primaryPlan.actions.some(a=>a.action==='USE_REFILL'),false);
  assert.ok(r.rejectedPlans.some(p=>p.reason==='RESOURCE_MISSING'));
});
test('multiple explicit Xanax checkpoints are finite and keep wait identity stable',()=>{
  const base={energy:500,naturalEnergyMax:150,stackCap:1000,drugCooldownSeconds:600,
    maxWaitSeconds:1800,xanax:{energyGain:250,cooldownSeconds:600}};
  const options=m.generateEnergyCandidates(base);
  assert.deepEqual(options.map(x=>x.energyAtTraining),[500,750,1000]);
  assert.deepEqual(options.map(x=>x.waitSeconds),[0,600,1200]);
  const actions=options[1].actions;
  const fp=m.structuralFingerprint({targetStat:'speed',actions});
  assert.equal(fp,m.structuralFingerprint({targetStat:'speed',
    actions:actions.map(a=>a.action==='WAIT'?{...a,seconds:1}:a)}));
});
test('best value compares useful paid gains to strongest free baseline even if baseline is below useful floor',()=>{
  const r=m.rankCandidates({objective:'BEST_VALUE',riskPolicy:'ALLOW_SUPPORTED',referenceSessionGain:10000,
    candidates:[{id:'free',fingerprint:'free',confidence:'CALIBRATED',expectedGain:8000,economicValueConsumed:0},
      {id:'paid',fingerprint:'paid',confidence:'CALIBRATED',expectedGain:12000,economicValueConsumed:2000000}]});
  assert.equal(r.selected.id,'paid');
  assert.equal(r.diagnostics.paid.deltaGain,4000);
});
test('Xanax stack economics and owned-only constraint survive composition',()=>{
  const state={energy:750,naturalEnergyMax:150,stackCap:1000,happy:1000,happyAtCheckpoint:1000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5.8,energyPerTrain:10},
    xanax:{energyGain:250},cooldowns:{drugSeconds:3600},inventory:{xanax:0}};
  const options=m.generateEnergyCandidates({...state,maxWaitSeconds:3600});
  const wait=options.find(x=>x.type==='WAIT_XANAX');
  const p=m.composePlan({state,energy:wait,marketSnapshot:{items:{xanax:{newCashEach:1000000,
    replacementValueEach:1000000}}}});
  assert.equal(p.resources.boughtItems.xanax,1);
  assert.equal(p.economics.newCashRequired,1000000);
  assert.equal(p.readiness.status,'NEEDS_ITEMS');
  const result=m.recommend({observedState:state,marketSnapshot:{items:{xanax:{newCashEach:1000000}}},
    preferences:{objective:'MAXIMUM_GAIN',maxWaitSeconds:3600,ownedItemsOnly:true}});
  assert.equal(result.primaryPlan.actions.some(a=>a.action==='TAKE_XANAX'),false);
  assert.ok(result.rejectedPlans.some(x=>x.reason==='USER_RESOURCE_RESTRICTION'));
});
test('future Happy is required before a delayed plan receives a gain forecast',()=>{
  const state={energy:750,naturalEnergyMax:150,stackCap:1000,happy:1000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5.8,energyPerTrain:10},
    xanax:{energyGain:250},cooldowns:{drugSeconds:3600},inventory:{xanax:1},freshness:liveFreshness,
    gainPerks:[],activeEffects:[]};
  const option=m.generateEnergyCandidates({...state,maxWaitSeconds:3600}).find(x=>x.type==='WAIT_XANAX');
  const p=m.composePlan({state,energy:option});
  assert.equal(p.simulation.reason,'DATA_MISSING');
  assert.equal(p.projectedEndState,null);
  assert.equal(p.readiness.status,'WAITING');
});
test('unknown gain effect and unsupported gym loss cannot yield modeled recommendations',()=>{
  const state={energy:100,naturalEnergyMax:100,happy:1000,stats:{speed:1000},
    targetStat:'speed',gym:{dots:5.8,energyPerTrain:10},activeEffects:[{id:'book',affects:['gymGain']}]};
  assert.equal(m.recommend({observedState:state}).reason,'UNSUPPORTED_EFFECT');
  const plan=m.composePlan({state:{...state,activeEffects:[],gym:{...state.gym,happyLossModifier:0.5}},
    energy:m.generateEnergyCandidates(state)[0]});
  assert.equal(plan.simulation.reason,'UNSUPPORTED_EFFECT');
});
test('weakest-stat selection is deterministic; unfrozen allocation fails visibly',()=>{
  const observedState={energy:100,naturalEnergyMax:100,happy:1000,
    gym:{dots:5,energyPerTrain:10},stats:{strength:500,speed:1000,defense:100,dexterity:100},
    targetStat:'speed'};
  const r=m.recommend({observedState,preferences:{statAllocationMode:'WEAKEST_STAT'}});
  assert.equal(r.primaryPlan.target.stat,'defense');
  assert.equal(observedState.targetStat,'speed');
  const unsupported=m.recommend({observedState,preferences:{statAllocationMode:'BALANCED_STATS'}});
  assert.equal(unsupported.status,'NO_SAFE_RECOMMENDATION');
  assert.equal(unsupported.reason,'UNSUPPORTED_EFFECT');
});
test('a modeled train can cross 50m; the rest is diagnostic only',()=>{
  const state={energy:20,naturalEnergyMax:20,happy:1000,
    stats:{speed:49999999},gym:{dots:5,energyPerTrain:10},targetStat:'speed'};
  const r=m.recommend({observedState:state});
  assert.equal(r.status,'NO_SAFE_RECOMMENDATION');
  assert.equal(r.reason,'MODEL_OUT_OF_DOMAIN');
  assert.equal(r.rejectedPlans[0].reason,'MODEL_OUT_OF_DOMAIN');
});
test('cash reserve is a hard constraint and missing cash abstains',()=>{
  const state={energy:100,naturalEnergyMax:100,stackCap:1000,happy:1000,cash:1100000,
    stats:{speed:1000},gym:{dots:5.8,energyPerTrain:10},targetStat:'speed',
    inventory:{ecstasy:1},cooldowns:{drugSeconds:0}};
  const noCash=m.recommend({observedState:{...state,cash:undefined},
    preferences:{cashReserve:1000000}});
  assert.equal(noCash.reason,'DATA_MISSING');
  const r=m.recommend({observedState:state,preferences:{objective:'MAXIMUM_GAIN',cashReserve:1000000},
    itemMechanics:{ecstasy:{happyMultiplier:2,replacementValue:100}}});
  assert.equal(r.status,'ok');
  assert.ok(r.primaryPlan.economics.newCashRequired<=100000);
});
test('structural identity distinguishes ownership choices, not quoted prices',()=>{
  const actions=[{action:'USE_BOOSTER',item:'candy',quantity:1},{action:'TRAIN',targetStat:'speed',trainCount:10}];
  const owned=m.structuralFingerprint({actions,targetStat:'speed',ownedItemsConsumed:{candy:1}});
  const bought=m.structuralFingerprint({actions,targetStat:'speed',boughtItems:{candy:1}});
  assert.notEqual(owned,bought);
  assert.equal(owned,m.structuralFingerprint({actions,targetStat:'speed',ownedItemsConsumed:{candy:1}}));
});
test('Xanax sets the next drug checkpoint before Ecstasy',()=>{
  const state={energy:750,naturalEnergyMax:150,stackCap:1000,happy:3000,happyAtCheckpoint:3000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5,energyPerTrain:10},
    xanax:{energyGain:250,cooldownSeconds:3600},cooldowns:{drugSeconds:0,boosterSeconds:0,boosterMaxSeconds:108000},
    inventory:{xanax:1,ecstasy:1},freshness:liveFreshness,gainPerks:[],activeEffects:[]};
  const energy=m.generateEnergyCandidates({...state,maxWaitSeconds:3600}).find(x=>x.type==='WAIT_XANAX');
  const plan=m.composePlan({state,energy,recipe:{items:[],useEcstasy:true},
    itemMechanics:{xanax:{replacementValueEach:0},ecstasy:{happyMultiplier:2,replacementValue:0}},
    timing:{safeQuarterWindow:true}});
  const xanaxIndex=plan.actions.findIndex(x=>x.action==='TAKE_XANAX');
  const ecstasyIndex=plan.actions.findIndex(x=>x.action==='TAKE_ECSTASY');
  assert.ok(plan.actions.slice(xanaxIndex+1,ecstasyIndex).some(x=>x.action==='WAIT' && x.seconds===3600 &&
    x.checkpoint==='DRUG_COOLDOWN'));
  assert.ok(plan.actions.slice(xanaxIndex+1,ecstasyIndex).some(x=>x.action==='VERIFY_STATE'));
  assert.equal(plan.timing.waitSeconds,3600);
  assert.equal(plan.readiness.status,'WAITING');
  const unknown=m.composePlan({state:{...state,xanax:{energyGain:250}},
    energy:m.generateEnergyCandidates({...state,xanax:{energyGain:250},maxWaitSeconds:0})
      .find(x=>x.type==='WAIT_XANAX'),recipe:{items:[],useEcstasy:true},
    itemMechanics:{ecstasy:{happyMultiplier:2}},timing:{safeQuarterWindow:true}});
  assert.equal(unknown.reason,'DATA_MISSING');
  const bounded=m.recommend({observedState:state,preferences:{objective:'MAXIMUM_GAIN',maxWaitSeconds:0},
    itemMechanics:{xanax:{replacementValueEach:0},ecstasy:{happyMultiplier:2,replacementValue:0}},
    timing:{safeQuarterWindow:true}});
  assert.ok([bounded.primaryPlan,...bounded.alternatives].filter(Boolean).every(p=>
    !p.actions.some(a=>a.action==='TAKE_XANAX') || !p.actions.some(a=>a.action==='TAKE_ECSTASY')));
});
test('remaining booster capacity permits immediate use despite accumulated cooldown',()=>{
  const state={energy:150,naturalEnergyMax:150,happy:1000,stats:{speed:1000},targetStat:'speed',
    gym:{dots:5,energyPerTrain:10},inventory:{candy:1,ecstasy:1},freshness:liveFreshness,
    gainPerks:[],activeEffects:[],
    cooldowns:{drugSeconds:0,boosterSeconds:21600,boosterMaxSeconds:108000}};
  const recipes=m.generateHappyRecipes(state,{candy:{happy:500,cooldownSeconds:21600,
    replacementValueEach:0},ecstasy:{happyMultiplier:2,replacementValue:0}});
  const recipe=recipes.find(x=>x.items.some(y=>y.id==='candy'));
  assert.ok(recipe);
  const plan=m.composePlan({state,energy:m.generateEnergyCandidates(state)[0],recipe,
    itemMechanics:{candy:{happy:500,cooldownSeconds:21600},ecstasy:{happyMultiplier:2,replacementValue:0}},
    timing:{safeQuarterWindow:true}});
  assert.equal(plan.preEcstasyHappy,1500);
  assert.equal(plan.readiness.status,'READY');
  assert.equal(plan.actions.some(x=>x.action==='WAIT'),false);
});
test('natural Energy regenerates before Xanax and only capped ticks are lost',()=>{
  const states=m.generateEnergyCandidates({energy:50,naturalEnergyMax:150,stackCap:1000,
    drugCooldownSeconds:14400,maxWaitSeconds:14400,naturalRegen:{energy:5,everySeconds:600},
    xanax:{energyGain:250,cooldownSeconds:3600}});
  const after=states.find(x=>x.type==='WAIT_XANAX');
  assert.equal(after.energyAtTraining,400);
  assert.equal(after.naturalEnergyLost,20);
  const withoutRegen=m.generateEnergyCandidates({energy:50,naturalEnergyMax:150,stackCap:1000,
    drugCooldownSeconds:14400,maxWaitSeconds:14400,xanax:{energyGain:250}});
  assert.equal(withoutRegen.some(x=>x.type==='WAIT_XANAX'),false);
  const aboveCap=m.generateEnergyCandidates({energy:750,naturalEnergyMax:150,stackCap:1000,
    drugCooldownSeconds:3600,maxWaitSeconds:3600,xanax:{energyGain:250}})
    .find(x=>x.type==='WAIT_XANAX');
  assert.equal(aboveCap.naturalEnergyLost,null);
  const state={energy:750,naturalEnergyMax:150,stackCap:1000,happy:1000,happyAtCheckpoint:1000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5,energyPerTrain:10},
    xanax:{energyGain:250},cooldowns:{drugSeconds:3600},inventory:{xanax:1}};
  const comparison=m.recommend({observedState:state,preferences:{objective:'BALANCED',maxWaitSeconds:3600},
    itemMechanics:{xanax:{replacementValueEach:0}}});
  assert.equal(comparison.primaryPlan.actions.some(x=>x.action==='TAKE_XANAX'),false);
  assert.ok(comparison.rejectedPlans.some(x=>x.reason==='DATA_MISSING'));
});
test('usefulness reference uses ordinary Happy and requires it explicitly',()=>{
  const state={energy:150,naturalEnergyMax:150,happy:9000,ordinaryHappy:1000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5,energyPerTrain:10}};
  const expected=m.simulatePlanTraining({modelId:m.MODEL_ID,stat:{kind:'speed',value:1000},
    happy:1000,gym:state.gym,gainPerks:[],energy:150}).modeledGain;
  for (const objective of ['BEST_VALUE','USE_MY_INVENTORY','FASTEST_USEFUL']) {
    const result=m.recommend({observedState:state,preferences:{objective}});
    assert.equal(result.opportunitySummary.referenceSessionGain,expected);
    const unavailable=m.recommend({observedState:{...state,ordinaryHappy:undefined},preferences:{objective}});
    assert.equal(unavailable.status,'NO_SAFE_RECOMMENDATION');
    assert.equal(unavailable.reason,'DATA_MISSING');
  }
});
test('execution readiness requires field-level freshness while planning can proceed',()=>{
  const state={energy:150,naturalEnergyMax:150,happy:1000,stats:{speed:1000},targetStat:'speed',
    gym:{dots:5,energyPerTrain:10},gainPerks:[],activeEffects:[]};
  const base=m.recommend({observedState:state,preferences:{objective:'MAXIMUM_GAIN'}});
  assert.equal(base.status,'ok');
  assert.equal(base.readiness.status,'NEEDS_REFRESH');
  assert.equal(m.recommend({observedState:{...state,freshness:liveFreshness},
    preferences:{objective:'MAXIMUM_GAIN'}}).readiness.status,'READY');
  for (const field of ['energy','happy','gym','gainModifiers']) {
    const stale=m.recommend({observedState:{...state,freshness:{...liveFreshness,[field]:'STALE'}},
      preferences:{objective:'MAXIMUM_GAIN'}});
    assert.equal(stale.readiness.status,'NEEDS_REFRESH',field);
  }
  const withDrug={...state,inventory:{ecstasy:1},cooldowns:{drugSeconds:0},
    freshness:{...liveFreshness,drugCooldown:'STALE'}};
  const drug=m.recommend({observedState:withDrug,preferences:{objective:'MAXIMUM_GAIN'},
    itemMechanics:{ecstasy:{happyMultiplier:2,replacementValue:0}},timing:{safeQuarterWindow:true}});
  assert.equal(drug.readiness.status,'NEEDS_REFRESH');
  assert.equal(drug.primaryPlan.actions.some(a=>a.action==='TAKE_ECSTASY'),true);
  assert.equal(m.recommend({observedState:{...state,freshness:liveFreshness,activeEffects:undefined},
    preferences:{objective:'MAXIMUM_GAIN'}}).readiness.status,'NEEDS_REFRESH');
  const boosterState={...state,inventory:{candy:1,ecstasy:1},
    cooldowns:{drugSeconds:0,boosterSeconds:0,boosterMaxSeconds:1}};
  const mechanics={candy:{happy:500,cooldownSeconds:1,replacementValueEach:0},
    ecstasy:{happyMultiplier:2,replacementValue:0}};
  for (const field of ['boosterCooldown','inventory']) {
    const result=m.recommend({observedState:{...boosterState,freshness:{...liveFreshness,[field]:'STALE'}},
      preferences:{objective:'MAXIMUM_GAIN'},itemMechanics:mechanics,timing:{safeQuarterWindow:true}});
    assert.equal(result.primaryPlan.actions.some(a=>a.action==='USE_BOOSTER'),true);
    assert.equal(result.readiness.status,'NEEDS_REFRESH',field);
  }
});
test('finite combined Xanax and refill checkpoint reaches stack cap',()=>{
  const candidates=m.generateEnergyCandidates({energy:600,naturalEnergyMax:150,stackCap:1000,
    drugCooldownSeconds:0,maxWaitSeconds:0,xanax:{energyGain:250,cooldownSeconds:3600},
    pointRefill:{allowed:true,fillAmountPolicy:'natural_max',pointsRequired:25}});
  const combination=candidates.find(x=>x.energyAtTraining===1000 && x.xanaxUses===1 && x.pointsConsumed===25);
  assert.ok(combination);
  assert.deepEqual(combination.actions.map(x=>x.action),['TAKE_XANAX','USE_REFILL']);
  assert.equal(combination.discardedEnergy,0);
  const state={energy:600,naturalEnergyMax:150,stackCap:1000,happy:1000,
    stats:{speed:1000},targetStat:'speed',gym:{dots:5,energyPerTrain:10},
    inventory:{xanax:1},cooldowns:{drugSeconds:0},pointRefill:{allowed:true,
      fillAmountPolicy:'natural_max',pointsRequired:25}};
  const ranked=m.recommend({observedState:{...state,xanax:{energyGain:250,cooldownSeconds:3600}},
    preferences:{objective:'MAXIMUM_GAIN',allowRefill:true,pointLimit:25}});
  assert.equal(ranked.primaryPlan.actions.some(x=>x.action==='USE_REFILL'),true);
  assert.equal(ranked.primaryPlan.actions.some(x=>x.action==='TAKE_XANAX'),true);
  assert.equal(ranked.primaryPlan.economics.pointsConsumed,25);
});
test('owned unknown-value and known-value boosters can combine for Maximum Gain',()=>{
  const state={energy:100,naturalEnergyMax:100,happy:1000,stats:{speed:1000},targetStat:'speed',
    gym:{dots:5,energyPerTrain:10},inventory:{mystery:1,known:1,ecstasy:1},
    cooldowns:{drugSeconds:0,boosterSeconds:0,boosterMaxSeconds:2}};
  const itemMechanics={mystery:{happy:700,cooldownSeconds:1},
    known:{happy:500,cooldownSeconds:1,replacementValueEach:100},
    ecstasy:{happyMultiplier:2,replacementValue:0}};
  const recipes=m.generateHappyRecipes(state,itemMechanics);
  assert.ok(recipes.some(x=>x.items.length===2 && x.preparation.economicValueConsumed===null));
  const result=m.recommend({observedState:state,preferences:{objective:'MAXIMUM_GAIN'},
    itemMechanics,timing:{safeQuarterWindow:true}});
  assert.equal(result.primaryPlan.resources.ownedItemsConsumed.mystery,1);
  assert.equal(result.primaryPlan.resources.ownedItemsConsumed.known,1);
  assert.equal(result.primaryPlan.economics.economicValueConsumed,null);
});
