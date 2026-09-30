'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const runtime=require('../src/training-advisor-runtime.js');
const adapters=require('../src/training-advisor-adapters.js');
const planner=require('../src/training-advisor-pure.js');
const frozen=require('../docs/divine-knowledge/chapters/dq-train-001/RUNTIME-UI-INTEGRATION-FIXTURES-001J.json');
const fixture=(prefix)=>frozen.cases.find(f=>f.id.startsWith(prefix+'_'));
const {harness,responses,storage,TIME,key}=require('./helpers/training-advisor-fixtures.js');
for (const f of frozen.cases.filter(f=>f.layer==='acquisition')) assert.ok(f.expected.length && f.given.length);
test(fixture('J-A1').id,async()=>{
  const h=harness();const first=h.advisor.refresh(),second=h.advisor.refresh();assert.equal(first,second);
  const s=await first;assert.equal(s.epoch,1);assert.equal(s.phase,'CURRENT');assert.equal(s.atomic,false);
  assert.equal(s.recommendation.status,'ok');assert.equal(s.normalized.capabilities.gainPrediction,true);
  assert.equal(h.requests.length,11);assert.equal(h.timers.size,1); // one expiry, no polling
  assert.equal(s.normalized.fields.energy.sourceId,'/user/bars');
  assert.equal(s.normalized.fields.energy.observedAt,new Date(TIME).toISOString());
  assert.equal(s.normalized.fields.energy.freshness,'LIVE');
  assert.equal(s.normalized.fields.stackCap.value,1000);assert.equal(s.normalized.observedState.naturalEnergyMax,150);
  for (const request of h.requests) assert.equal(request.options.method,'GET');
});
test(fixture('J-A2').id,async()=>{
  const h=harness({fail:['drugInventory']});const s=await h.advisor.refresh();
  assert.equal(s.normalized.sourceStatus.drugInventory.reason,'CAPABILITY_UNAVAILABLE');
  assert.equal(s.normalized.capabilities.bars,true);assert.equal(s.normalized.capabilities.gainPrediction,true);
  assert.equal(s.recommendation.status,'ok');assert.equal(JSON.stringify(s).includes(key),false);
});
test(fixture('J-A3').id,async()=>{
  const h=harness();let s=await h.advisor.refresh();h.advance(1000);s=await h.advisor.refresh();
  assert.equal(h.requests.length,18); // seven fresh player sources; catalog and three inventory caches reused
  assert.equal(s.normalized.observedState.inventoryFreshness,'FRESH');
  assert.equal(s.normalized.observedState.inventoryFreshnessByItem.xanax,'FRESH');
  assert.equal(s.normalized.capabilities.inventoryExecution,false);
  assert.equal(s.normalized.fields.inventory.Drug.cacheClass,'CATEGORY_1H');
  assert.equal(s.normalized.sourceStatus.drugInventory.observedAt,new Date(TIME).toISOString());
  assert.notEqual(s.normalized.fields.energy.observedAt,s.normalized.sourceStatus.drugInventory.observedAt);
  h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});s=h.advisor.confirmEffects(true);
  assert.equal(s.recommendation.primaryPlan.readiness.status,'NEEDS_REFRESH');
});
test(fixture('J-A4').id,async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});
  let s=h.advisor.confirmEffects(true);const owned=s.recommendation.primaryPlan.resources.ownedItemsConsumed;
  assert.ok(Object.keys(owned).length);
  h.advance(2000);const supplied={...owned,unrelated:200,candy37:100};s=h.advisor.confirmInventory(supplied);
  assert.deepEqual(s.normalized.fields.inventory.confirmation.value,owned);
  assert.equal(s.normalized.fields.inventory.confirmation.observedAt,new Date(TIME+2000).toISOString());
  assert.equal(s.normalized.capabilities.inventoryExecution,false);
  for (const item of Object.keys(owned)) assert.equal(s.normalized.observedState.inventoryFreshnessByItem[item],'LIVE');
  assert.equal(s.normalized.observedState.inventoryFreshnessByItem.candy37,'FRESH');
  // The frozen selected-plan two-item example uses the unchanged canonical overlay boundary.
  const overlay=adapters.adaptInventory({}, {},{sourceId:'PLAYER_CONFIRMED_INVENTORY',confirmedCurrent:true,
    observedAt:new Date(TIME+2000).toISOString(),freshness:'LIVE',quantities:{xanax:1,eroticDvd:2}});
  assert.deepEqual(overlay.inventory,{xanax:1,eroticDvd:2});assert.equal(overlay.inventoryFreshness,'UNKNOWN');
});
test(fixture('J-A5').id,async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});
  h.advisor.confirmEffects(true);const plan=h.advisor.snapshot().recommendation.primaryPlan;
  h.advisor.confirmInventory(plan.resources.ownedItemsConsumed);
  let s=h.advisor.invalidate();assert.equal(s.phase,'NEEDS_REFRESH');
  assert.notEqual(s.normalized.observedState.inventoryFreshnessByItem.xanax,'LIVE');
  assert.throws(()=>h.advisor.confirmInventory({xanax:1}),/Refresh & Plan/);
  h.input.bars.energy.current=400;s=await h.advisor.refresh();assert.equal(s.epoch,2);
  assert.equal(s.normalized.observedState.energy,400);assert.equal(s.normalized.fields.inventory.confirmation,undefined);
  assert.notEqual(s.recommendation.primaryPlan.id,plan.id);
});
test(fixture('J-A6').id,async()=>{
  const h=harness();h.input.cooldowns.drug=1;const before=await h.advisor.refresh();h.advance(2000);
  assert.match(runtime.countdown(1,before.normalized.fields.drugCooldown.observedAt,TIME+2000),/Refresh now/);
  assert.deepEqual(h.advisor.snapshot().normalized,before.normalized);
  assert.equal(h.advisor.snapshot().normalized.observedState.cooldowns.drugSeconds,1);
  assert.equal(h.requests.length,11);
});
test(fixture('J-A7').id,async()=>{
  const h=harness();h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});const s=await h.advisor.refresh();
  assert.equal(s.recommendation.status,'ok');assert.equal(s.normalized.capabilities.marketComparison,false);
  assert.equal(s.normalized.marketSnapshot.available,false);
  assert.equal(s.normalized.marketSnapshot.items.xanax,undefined);
});
test(fixture('J-A8').id,async()=>{
  const h=harness({fail:['battlestats']});await h.advisor.refresh();
  const s=h.advisor.confirmStats({strength:25000,speed:90000,defense:5000,dexterity:5000});
  assert.equal(s.normalized.capabilities.automaticStats,false);assert.equal(s.normalized.capabilities.manualStats,true);
  assert.equal(s.normalized.capabilities.gainPrediction,true);assert.equal(s.recommendation.status,'ok');
  assert.equal(s.normalized.sourceStatus.battlestats.reason,'CAPABILITY_UNAVAILABLE');
  assert.equal(s.normalized.fields.stats.sourceId,'PLAYER_CONFIRMED_STATS');
});
test(fixture('J-A9').id,async()=>{
  const input=responses();input.tornGyms={unexpected:'schema'};const h=harness({input});const s=await h.advisor.refresh();
  assert.equal(s.normalized.capabilities.gymPrediction,false);assert.equal(s.normalized.capabilities.inventoryPlanning,true);
  assert.equal(s.normalized.capabilities.bars,true);assert.equal(s.recommendation.status,'NO_SAFE_RECOMMENDATION');
  assert.equal(s.normalized.fields.gym.reason,'SCHEMA_MISMATCH');
});
test(fixture('J-A10').id,async()=>{
  const h=harness();h.input.bars.happy.tick_time=899;await h.advisor.refresh();
  h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});const s=h.advisor.confirmEffects(true);
  assert.deepEqual(s.normalized.timing,{});
  const result=planner.recommend({...s.normalized,preferences:{objective:'MAXIMUM_GAIN',prohibitedItems:['xanax']}});
  assert.ok(result.primaryPlan.actions.some(a=>a.action==='TAKE_ECSTASY'));
  assert.equal(result.readiness.status,'NEEDS_REFRESH');assert.equal(result.readiness.nextAction,'confirm safe quarter-hour window');
});
test(fixture('J-A11').id,async()=>{
  const h=harness();await h.advisor.refresh();const s=h.advisor.confirmEffects(true);
  assert.equal(s.normalized.capabilities.candyPreparation,false);
  assert.equal(s.normalized.itemMechanics.candy37,undefined);
  assert.equal(s.normalized.fields.worldDiabetesDay.reason,'UNSUPPORTED_EFFECT');
  assert.ok(s.normalized.itemMechanics.xanax);assert.equal(s.recommendation.status,'ok');
  assert.equal(h.requests.some(r=>r.url.includes('calendar')),false);
});
test('current Points require independent money evidence; denied money needs explicit current confirmation',async()=>{
  const h=harness({fail:['money']});h.input.bars.energy.current=10;
  h.advisor.setPreferences({objective:'MAXIMUM_GAIN',allowItems:false,allowRefill:true});
  let s=await h.advisor.refresh();assert.equal(s.normalized.observedState.pointsAvailable,undefined);
  assert.equal(s.normalized.capabilities.paidRefillExecution,false);assert.equal(s.recommendation.readiness.status,'NEEDS_REFRESH');
  s=h.advisor.confirmPoints(30);assert.equal(s.normalized.capabilities.paidRefillExecution,true);
  assert.equal(s.recommendation.primaryPlan.projectedEndState.energy,0);assert.equal(s.recommendation.readiness.status,'READY');
  assert.equal(s.recommendation.primaryPlan.resources.energySpent,150);
  h.advisor.invalidate();assert.equal(h.advisor.snapshot().normalized.observedState.pointsAvailable,undefined);
});
test('expiry and foreground changes invalidate confirmations without polling',async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.confirmEffects(true);h.advance(60_001);h.expire();
  assert.equal(h.advisor.snapshot().phase,'NEEDS_REFRESH');assert.equal(h.requests.length,11);
  assert.equal(h.advisor.snapshot().normalized.capabilities.xanaxPreparation,false);
  assert.throws(()=>h.advisor.confirmEffects(true),/Refresh & Plan/);
});
test('foreground state change during a slow refresh cannot restore stale authority',async()=>{
  let unblock;const pending=new Promise(resolve=>{unblock=resolve;});
  const h=harness({fetchOverride:async()=>{await pending;return {ok:true,json:async()=>({})};}});
  const refresh=h.advisor.refresh();h.advisor.invalidate();unblock();const s=await refresh;
  assert.equal(s.phase,'NEEDS_REFRESH');assert.equal(h.timers.size,0);
});
test('bounded same-category pagination and local failure on foreign links',async()=>{
  const input=responses(),h=harness({input});let calls=0;
  const first='https://api.torn.com/v2/user/inventory?cat=Drug&limit=100';
  const next='https://api.torn.com/v2/user/inventory?cat=Drug&limit=100&offset=100';
  const pages=[{inventory:{items:[{id:206,amount:1}],timestamp:1800000000},
    _metadata:{total:2,links:{prev:null,next}}},
  {inventory:{items:[{id:197,amount:2}],timestamp:1800000000},_metadata:{total:2,links:{prev:first,next:null}}}];
  const multi=harness({fetchOverride:async(url)=>{const u=new URL(url);const name=Object.keys(runtime.SOURCES).find(n=>
    '/v2'+runtime.SOURCES[n].split('?')[0]===u.pathname && (new URL('https://api.torn.com/v2'+runtime.SOURCES[n])).searchParams.get('cat')===u.searchParams.get('cat'));
    return {ok:true,json:async()=>name==='drugInventory' ? structuredClone(pages[calls++]) : structuredClone(input[name])};}});
  let s=await multi.advisor.refresh();assert.equal(s.normalized.inventory.Drug.complete,true);assert.equal(calls,2);
  pages[0]._metadata.links.next='https://example.com/stolen';calls=0;
  const foreign=harness({fetchOverride:async(url)=>{const u=new URL(url);const cat=u.searchParams.get('cat');
    assert.equal(u.origin,'https://api.torn.com');return {ok:true,json:async()=>cat==='Drug'?pages[0]:{}};}});
  s=await foreign.advisor.refresh();assert.equal(s.normalized.inventory.Drug.complete,false);
});
test('key errors are redacted, missing key makes no request, only allowlisted requests can carry key',async()=>{
  const h=harness({managedKey:'###PDA-APIKEY###'});const s=await h.advisor.refresh();assert.equal(h.requests.length,0);
  assert.equal(s.normalized.sourceStatus.bars.reason,'CAPABILITY_UNAVAILABLE');
  for (const link of ['https://example.com/user/inventory?cat=Drug',
    'https://api.torn.com/v2/user/inventory?cat=Drug&key=secret',
    'https://api.torn.com/v2/user/inventory?cat=Candy',
    'https://api.torn.com/v2/user/inventory?cat=Drug#fragment'])
    assert.throws(()=>runtime.requestUrl(runtime.SOURCES.drugInventory,link));
  assert.throws(()=>runtime.requestUrl('/user/messages'));
  const store=storage();store.setItem(runtime.API_KEY,'LOCAL_TEST_KEY');
  assert.equal(runtime.resolveKey('###PDA-APIKEY###',store),'LOCAL_TEST_KEY');assert.equal(runtime.resolveKey(key,store),key);
});
test('live confirmation zero and lower quantities replace planning values and force a new recommendation',async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.setPreferences({objective:'MAXIMUM_GAIN',prohibitedItems:['eroticDvd','ecstasy']});
  let s=h.advisor.confirmEffects(true);assert.equal(s.recommendation.primaryPlan.resources.ownedItemsConsumed.xanax,1);
  const original=s.recommendation.primaryPlan.id;s=h.advisor.confirmInventory({xanax:1});
  assert.equal(s.normalized.observedState.inventory.xanax,1);
  s=h.advisor.confirmInventory({xanax:0});assert.equal(s.normalized.observedState.inventory.xanax,0);
  assert.notEqual(s.recommendation.primaryPlan.id,original);assert.equal(s.normalized.fields.inventory.confirmation.value.xanax,0);
  h.advisor.confirmInventory({xanax:-1});assert.equal(h.advisor.snapshot().normalized.fields.inventory.confirmation,undefined);
});
test('preferences alone persist; corrupt/live-data input never becomes stored authority',async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.confirmEffects(true);
  h.advisor.setPreferences({objective:'MAXIMUM_GAIN',theme:'Dark',energy:1000,inventory:{xanax:500},currentPoints:100});
  assert.equal(h.store.map.size,1);const saved=JSON.parse(h.store.getItem(runtime.PREFS_KEY));
  for (const field of ['energy','inventory','currentPoints','recommendation','confirmedInventory']) assert.equal(saved[field],undefined);
  const reload=harness({storage:h.store});assert.equal(reload.advisor.snapshot().preferences.objective,'MAXIMUM_GAIN');
  assert.equal(reload.advisor.snapshot().normalized,null);assert.equal(reload.advisor.snapshot().recommendation,null);
});
test('per-request timeout degrades one capability and clears bounded timers',async()=>{
  const h=harness(),input=responses();let clock=TIME,serial=0;
  const timers=new Map();
  const a=runtime.createAdvisor({storage:storage(),managedKey:key,now:()=>clock,
    setTimer:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimer:id=>timers.delete(id),
    fetch:async(url,options)=>{
      if (url.includes('/battlestats')) return new Promise((resolve,reject)=>{
        options.signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true});
      });
      const u=new URL(url),name=Object.keys(runtime.SOURCES).find(n=>{const p=new URL('https://api.torn.com/v2'+runtime.SOURCES[n]);
        return p.pathname===u.pathname && p.searchParams.get('cat')===u.searchParams.get('cat');});
      return {ok:true,json:async()=>input[name]};
    }});
  const pending=a.refresh();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(timers.size,1);timers.values().next().value.fn();const s=await pending;
  assert.equal(s.normalized.sourceStatus.battlestats.reason,'DATA_MISSING');assert.equal(s.normalized.capabilities.bars,true);
  assert.equal(timers.size,1);assert.equal(timers.values().next().value.ms,60_000);
  clock+=60_001;assert.equal(a.snapshot().phase,'NEEDS_REFRESH');assert.equal(timers.size,0);
  h.advisor.dispose();
});
test('malformed cached source may be reacquired on the next user refresh',async()=>{
  const input=responses();input.tornGyms={unexpected:true};const h=harness({input});
  await h.advisor.refresh();input.tornGyms=responses().tornGyms;
  const s=await h.advisor.refresh();assert.equal(s.normalized.capabilities.gymPrediction,true);
  assert.equal(h.requests.filter(r=>r.url.includes('/torn/gyms')).length,2);
});
test('changing the local key during refresh cannot reuse the previous account inventory cache',async()=>{
  const store=storage();store.setItem(runtime.API_KEY,'OLD_SYNTHETIC_KEY');let unblock;
  const pending=new Promise(resolve=>{unblock=resolve;});const input=responses(),requests=[];
  const h=harness({storage:store,managedKey:'###PDA-APIKEY###',fetchOverride:async(url,options)=>{
    requests.push(options.headers.Authorization);const old=options.headers.Authorization.includes('OLD_');
    if (old) await pending;
    const u=new URL(url),name=Object.keys(runtime.SOURCES).find(n=>{const p=new URL('https://api.torn.com/v2'+runtime.SOURCES[n]);
      return p.pathname===u.pathname && p.searchParams.get('cat')===u.searchParams.get('cat');});
    const value=structuredClone(input[name]);if (name==='drugInventory') value.inventory.items[0].amount=old?5:1;
    return {ok:true,json:async()=>value};
  }});
  const first=h.advisor.refresh();await new Promise(resolve=>setImmediate(resolve));
  h.advisor.setKey('NEW_SYNTHETIC_KEY');unblock();assert.equal((await first).phase,'NEEDS_REFRESH');
  const second=await h.advisor.refresh();assert.equal(second.normalized.observedState.inventory.xanax,1);
  assert.equal(requests.filter(r=>r==='ApiKey NEW_SYNTHETIC_KEY').length,11);
});
test('disposing while a refresh is in flight leaves no timers or subscriptions behind',async()=>{
  let unblock;const pending=new Promise(resolve=>{unblock=resolve;});
  const h=harness({fetchOverride:async()=>{await pending;return {ok:true,json:async()=>({})};}});
  let notifications=0;h.advisor.subscribe(()=>notifications++);
  const refresh=h.advisor.refresh();await new Promise(resolve=>setImmediate(resolve));
  h.advisor.dispose();const before=notifications;assert.equal(h.timers.size,0);unblock();
  const s=await refresh;assert.equal(s.phase,'NEEDS_REFRESH');assert.equal(h.timers.size,0);
  assert.equal(notifications,before);await assert.rejects(h.advisor.refresh(),/disposed/);
});
