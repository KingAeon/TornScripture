'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const build=require('../scripts/build-training-advisor.js');
const planner=require('../src/training-advisor-pure.js');
const adapters=require('../src/training-advisor-adapters.js');
const frozen=require('../docs/divine-knowledge/chapters/dq-train-001/RUNTIME-UI-INTEGRATION-FIXTURES-001J.json');
const math=require('../docs/divine-knowledge/chapters/dq-train-001/MATH-ENGINE-FIXTURES-001A.json');
const sourceFixtures=require('../docs/divine-knowledge/chapters/dq-train-001/ADAPTER-FIXTURES-001D.json');
const stackFixtures=require('../docs/divine-knowledge/chapters/dq-train-001/STACK-CAP-FIXTURES-001I.json');
const {responses,storage,TIME}=require('./helpers/training-advisor-fixtures.js');
const root=path.resolve(__dirname,'..');
const artifact=()=>fs.readFileSync(path.join(root,build.OUTPUT),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const id=prefix=>frozen.cases.find(f=>f.id.startsWith(prefix+'_')).id;
function embedded() {
  const forbidden=()=>{throw new Error('test mode startup side effect');};
  const context=vm.createContext({__TS_TRAINING_ADVISOR_TEST_MODE__:true,URL,Intl,AbortController,
    fetch:forbidden,setTimeout:forbidden,clearTimeout:forbidden,setInterval:forbidden,
    get document(){return forbidden();},get localStorage(){return forbidden();}});
  vm.runInContext(artifact(),context,{filename:build.OUTPUT,timeout:2000});
  return context.__TS_TRAINING_ADVISOR_TEST_EXPORTS__;
}
test(id('J-B1'),()=>{
  const text=artifact();for (const file of build.INPUTS)
    assert.ok(text.includes(fs.readFileSync(path.join(root,file),'utf8')),file+' canonical bytes');
  assert.deepEqual(build.INPUTS.slice(0,2),['src/training-advisor-pure.js','src/training-advisor-adapters.js']);
  assert.match(text,/GENERATED: edit canonical src files/);
});
test(id('J-B2'),()=>{
  const text=build.generate();assert.equal(build.OUTPUT,'TornScripture-Training-Advisor.user.js');
  assert.match(text,/==UserScript==/);assert.match(text,/module.exports =/);
  assert.match(text,/factories\[id\]\(modules\[id\]/);assert.doesNotThrow(()=>new vm.Script(text));
});
test(id('J-B3'),()=>{
  const first=build.generate(),second=build.generate();assert.equal(first,second);
  assert.equal(crypto.createHash('sha256').update(first).digest('hex'),crypto.createHash('sha256').update(second).digest('hex'));
  assert.equal(first,artifact());assert.equal(build.verify(artifact()),true);
});
test(id('J-B4'),()=>{
  const changed=artifact().replace('happyGain: 75','happyGain: 74');assert.notEqual(changed,artifact());
  assert.throws(()=>build.verify(changed),/drift/);
  const e=embedded();for (const [file,hash] of Object.entries(e.provenance.hashes))
    assert.equal(hash,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),file);
});
test(id('J-B5'),()=>{
  const e=embedded();assert.deepEqual(Object.keys(e),['planner','adapters','runtime','ui','provenance']);
  for (const f of math.cases) assert.deepEqual(plain(e.planner.simulateTraining(f.input)),planner.simulateTraining(f.input),f.id);
  const time=new Date(TIME).toISOString();const sources=responses();
  const sourceMeta=Object.fromEntries(Object.entries(require('../src/training-advisor-runtime.js').SOURCES)
    .map(([key,sourceId])=>[key,{sourceId,requestedSelection:sourceId,requestSucceeded:true,observedAt:time,freshness:'LIVE'}]));
  for (const f of sourceFixtures.cases) {
    const input={targetStat:f.targetStat || 'speed',sources:f.sources,sourceMeta};
    assert.deepEqual(plain(e.adapters.normalizeTrainingSources(input)),plain(adapters.normalizeTrainingSources(input)),f.id);
  }
  const dynamicState={effectsComplete:true,materialPreparationEffects:[],effectEvidence:{sourceId:'SYNTHETIC_EFFECT',observedAt:time,freshness:'FRESH'}};
  for (const f of stackFixtures.cases) {
    const input={targetStat:'speed',sources,sourceMeta,dynamicState,configuredMechanics:f.input.configuredMechanics};
    const n=e.adapters.normalizeTrainingSources(input);
    assert.deepEqual(plain(n),plain(adapters.normalizeTrainingSources(input)),f.id);
    assert.deepEqual(plain(e.planner.recommend({...n,preferences:{objective:'MAXIMUM_GAIN'}})),
      plain(planner.recommend({...adapters.normalizeTrainingSources(input),preferences:{objective:'MAXIMUM_GAIN'}})),f.id);
  }
  for (const observedAt of [time,'2026-02-30T12:00:00Z','bad','']) {
    const input={targetStat:'speed',sources,sourceMeta,dynamicState,confirmedInventory:{sourceId:'PLAYER_CONFIRMED_INVENTORY',confirmedCurrent:true,
      observedAt,freshness:'LIVE',quantities:{xanax:0,eroticDvd:1}}};
    assert.deepEqual(plain(e.adapters.normalizeTrainingSources(input)),plain(adapters.normalizeTrainingSources(input)),observedAt);
  }
});
test(id('J-B6'),()=>{
  const text=artifact();assert.doesNotMatch(text,/^\/\/\s*@require\b/m);
  assert.doesNotMatch(text,/\beval\s*\(|new Function\s*\(|import\s*\(/);
  assert.doesNotMatch(text,/require\(['"](?:node:|https?:|[a-z])/);
  const urls=[...text.matchAll(/https:\/\/[^\s'"`]+/g)].map(m=>m[0]);
  assert.ok(urls.filter(u=>u.includes('api.torn.com')).length>0);
  assert.ok(urls.every(u=>u.startsWith('https://api.torn.com/') || u==='https://www.torn.com/*' || u.startsWith('https://github.com/KingAeon/TornScripture') ||
    u.startsWith('https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/')));
});
test(id('J-B7'),async()=>{
  const e=embedded(),calls=[],testKey='BOUNDARY_TEST_KEY';
  const a=e.runtime.createAdvisor({managedKey:testKey,storage:storage(),now:()=>TIME,setTimer:()=>1,clearTimer:()=>{},
    fetch:async(url,options)=>{calls.push({url,options});return {ok:false,status:403,json:async()=>({error:{code:16,error:testKey}})};}});
  const snapshot=await a.refresh();assert.equal(calls.length,11);
  assert.equal(JSON.stringify(snapshot).includes(testKey),false);
  assert.equal(e.ui.fullHtml(snapshot,e.ui.buildView(snapshot)).includes(testKey),false);
  for (const call of calls) {assert.equal(new URL(call.url).origin,'https://api.torn.com');assert.equal(call.url.includes(testKey),false);
    assert.equal(call.options.headers.Authorization,`ApiKey ${testKey}`);assert.equal(call.options.redirect,'error');}
  assert.match(artifact(),/###PDA-APIKEY###/);
});
test(id('J-B8'),()=>{
  assert.doesNotMatch(artifact(),/PDA_storage/);const e=embedded();
  assert.equal(e.runtime.createAdvisor({storage:storage()}).snapshot().phase,'NEEDS_REFRESH');
});
test('generated-artifact acquisition and presentation match canonical runtime',async()=>{
  const e=embedded(),sources=responses(),request=async url=>{const u=new URL(url),name=Object.keys(require('../src/training-advisor-runtime.js').SOURCES)
    .find(n=>{const p=new URL('https://api.torn.com/v2'+require('../src/training-advisor-runtime.js').SOURCES[n]);
      return p.pathname===u.pathname && p.searchParams.get('cat')===u.searchParams.get('cat');});
    return {ok:true,json:async()=>sources[name]};};
  const options={fetch:request,storage:storage(),managedKey:'TEST_BOUNDARY_KEY',now:()=>TIME,setTimer:()=>1,clearTimer:()=>{}};
  const a=e.runtime.createAdvisor(options),b=require('../src/training-advisor-runtime.js').createAdvisor({...options,storage:storage()});
  assert.deepEqual(plain(await a.refresh()),plain(await b.refresh()));
  a.setPreferences({objective:'MAXIMUM_GAIN'});b.setPreferences({objective:'MAXIMUM_GAIN'});
  assert.deepEqual(plain(a.confirmEffects(true)),plain(b.confirmEffects(true)));
  const owned=a.snapshot().recommendation.primaryPlan.resources.ownedItemsConsumed;
  assert.deepEqual(plain(a.confirmInventory(owned)),plain(b.confirmInventory(owned)));
  assert.deepEqual(plain(e.ui.buildView(a.snapshot())),require('../src/training-advisor-ui.js').buildView(b.snapshot()));
});
test('metadata, application and provenance versions agree',()=>{
  assert.equal(build.VERSION,'0.1.0');assert.equal(embedded().provenance.version,build.VERSION);
  assert.equal(require('../src/training-advisor-runtime.js').VERSION,build.VERSION);
  assert.match(artifact(),/\/\/ @version\s+0\.1\.0/);
});
