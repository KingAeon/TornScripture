'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../src/training-advisor-ui.js');
const runtime=require('../src/training-advisor-runtime.js');
const frozen=require('../docs/divine-knowledge/chapters/dq-train-001/RUNTIME-UI-INTEGRATION-FIXTURES-001J.json');
const {harness,v2Responses}=require('./helpers/training-advisor-fixtures.js');
const id=prefix=>frozen.cases.find(f=>f.id.startsWith(prefix+'_')).id;
function snapshot({status='READY',reason=null,confidence='SUPPORTED_EXTRAPOLATION',nextAction='TRAIN',actions}={}) {
  const plan={id:'SYNTHETIC_PLAN',fingerprint:'SYNTHETIC_PLAN',target:{stat:'speed',allocationMode:'TARGET_STAT'},
    actions:actions || [{action:'VERIFY_STATE'},{action:'TRAIN',targetStat:'speed',energySpent:150}],
    readiness:{status,reason,nextAction},confidence:{level:confidence},simulation:{modeledGain:1234.56789},
    resources:{ownedItemsConsumed:{},boughtItems:{}},economics:{newCashRequired:0,marketValueOfOwnedItemsConsumed:0,
      pointsConsumed:0,naturalEnergyLost:0,boosterCooldownSeconds:0},timing:{waitSeconds:0},explanation:{modelId:'vladar-v2-pre50m-v1'}};
  return {phase:'CURRENT',epoch:1,preferences:runtime.preferences({targetStat:'speed'}),connection:'Synthetic mock',atomic:false,
    normalized:{observedState:{energy:150,happy:4000,stats:{speed:90000},gym:{name:'Complete Cardio'}},
      capabilities:{marketComparison:false},fields:{energy:{value:150,sourceId:'/user/bars',observedAt:'2026-09-30T21:00:00Z',freshness:'LIVE'},
        inventory:{}},sourceStatus:{bars:{sourceId:'/user/bars',freshness:'LIVE'}},unsupported:[]},
    recommendation:{status:'ok',primaryPlan:plan,alternatives:[],objective:'BALANCED',explanation:['Selected by BALANCED'],rejectedPlans:[]}};
}
const html=s=>ui.fullHtml(s,ui.buildView(s));
test('beginner missing evidence separates bars refresh, current effects and open gates',()=>{
  const s=snapshot();s.recommendation={status:'NO_SAFE_RECOMMENDATION',reason:'DATA_MISSING',primaryPlan:null};
  for (const name of ['energy','naturalEnergyMax','naturalRegen','happy','ordinaryHappy'])
    s.normalized.fields[name]={value:null,sourceId:'/user/bars',reason:'SCHEMA_MISMATCH'};
  s.normalized.fields.effectState={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.boosterMaxSeconds={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.worldDiabetesDay={value:null,reason:'UNSUPPORTED_EFFECT'};
  const v=ui.buildView(s),text=html(s),panel=text.match(/<section><h3>No safe recommendation<\/h3>[\s\S]*?<\/section>/)[0];
  assert.match(v.next,/\/user\/bars.*Refresh & Plan/);
  assert.deepEqual(v.missing.map(x=>x.field),['bars','effectState']);
  assert.match(panel,/Confirm current effects below.*replan immediately/);
  assert.match(panel,/Booster capacity depends on verified effect and mechanic evidence/);
  assert.doesNotMatch(panel,/worldDiabetesDay|boosterMaxSeconds|naturalEnergyMax|naturalRegen/);
  assert.match(text,/H1 open/);assert.match(text,/H2 open/);
  assert.doesNotMatch(text,/name="worldDiabetesDay"|Provide the missing current input, then refresh/);
  assert.deepEqual(v.advanced['Rejected / Diagnostics'].missing.map(x=>x.field),
    ['energy','naturalEnergyMax','naturalRegen','happy','ordinaryHappy','effectState','boosterMaxSeconds','worldDiabetesDay']);
  assert.equal(v.advanced.Sources.fields.worldDiabetesDay.reason,'UNSUPPORTED_EFFECT');
});
test('selected-plan inventory and current Points guidance asks for immediate confirmation replan',async()=>{
  const h=harness({fail:['money']});h.input.bars.energy.current=10;
  h.advisor.setPreferences({objective:'MAXIMUM_GAIN',allowItems:false,allowRefill:true});
  let s=await h.advisor.refresh();assert.match(ui.buildView(s).next,/Confirm current Points below.*replan immediately/);
  s=h.advisor.confirmPoints(30);assert.equal(ui.buildView(s).readiness,'READY');
  const owned=snapshot({status:'NEEDS_REFRESH',reason:'DATA_STALE',nextAction:'refresh inventory'});
  owned.recommendation.primaryPlan.resources.ownedItemsConsumed={xanax:1};
  const v=ui.buildView(owned);assert.match(v.next,/Confirm the selected-plan owned quantities below.*replan immediately/);
  assert.match(v.reasonText,/replan immediately/);
  assert.doesNotMatch(v.next,/refresh/i);
});
test('H1 execution proof is an open gate rather than a user-fillable confirmation',async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});
  const s=h.advisor.confirmEffects(true),v=ui.buildView(s),before=structuredClone(s.recommendation);
  assert.equal(s.recommendation.readiness.nextAction,'confirm safe quarter-hour window');
  assert.match(v.next,/H1 open.*withheld.*approved timing proof/);
  assert.doesNotMatch(v.next,/confirm safe quarter-hour window/i);
  assert.equal(v.advanced['Rejected / Diagnostics'].nextAction,'confirm safe quarter-hour window');
  assert.deepEqual(h.advisor.snapshot().recommendation,before);assert.equal(v.reason,'DATA_MISSING');
});
test('unsupported booster evidence and elevated ordinary Happy remain explicit limitations',()=>{
  const s=snapshot();s.recommendation={status:'NO_SAFE_RECOMMENDATION',reason:'UNSUPPORTED_EFFECT',primaryPlan:null};
  s.normalized.fields.ordinaryHappy={value:null,reason:'ORDINARY_HAPPY_ELEVATED_UNVERIFIED'};
  s.normalized.fields.effectState={value:[],freshness:'LIVE'};
  s.normalized.fields.boosterMaxSeconds={value:null,reason:'UNSUPPORTED_EFFECT'};
  const v=ui.buildView(s);assert.match(html(s),/Ordinary Happy.*verified elevated-Happy mapping/);
  assert.match(html(s),/Booster capacity.*unsupported.*withheld/);
  assert.ok(v.missing.every(x=>x.kind==='limitation'));
});
test('optional missing preparation evidence does not replace a genuine model-domain blocker',()=>{
  const s=snapshot();s.recommendation={status:'NO_SAFE_RECOMMENDATION',reason:'MODEL_OUT_OF_DOMAIN',primaryPlan:null};
  s.normalized.fields.effectState={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.worldDiabetesDay={value:null,reason:'UNSUPPORTED_EFFECT'};
  const v=ui.buildView(s);assert.match(v.next,/supported 50m model domain/);
  assert.equal(v.reason,'MODEL_OUT_OF_DOMAIN');assert.doesNotMatch(v.next,/Confirm|Refresh/);
});
test(id('J-C1'),()=>{
  const s=snapshot(),v=ui.buildView(s);assert.equal(v.readiness,'READY');assert.equal(v.confidence,'SUPPORTED_EXTRAPOLATION');
  assert.match(html(s),/ta-ready">READY/);assert.match(html(s),/Confidence: SUPPORTED/);
  assert.match(v.next,/Train speed manually/);assert.match(v.next,/I completed this step, then Refresh & Plan/);
  assert.equal(v.reason,null);assert.doesNotMatch(html(s),/Provide the missing current input/);
});
test(id('J-C2'),()=>{
  const s=snapshot({status:'WAITING',reason:'COOLDOWN_BLOCKED',nextAction:'wait for checkpoint',
    actions:[{action:'TAKE_XANAX'},{action:'WAIT',checkpoint:'DRUG_COOLDOWN'},{action:'VERIFY_STATE'}]});
  assert.equal(ui.buildView(s).readiness,'WAITING');assert.match(html(s),/Wait for the checkpoint/);
  assert.doesNotMatch(html(s),/\d\d:\d\d|6 hours|8 hours/);assert.match(html(s),/Refresh &amp; Plan/);
});
test(id('J-C3'),()=>{
  const s=snapshot({status:'NEEDS_REFRESH',reason:'DATA_MISSING',nextAction:'refresh energy'}),v=ui.buildView(s);
  assert.equal(v.readiness,'NEEDS_REFRESH');assert.equal(v.next,'refresh energy');
  assert.equal(v.reason,'DATA_MISSING');assert.equal(v.advanced['Rejected / Diagnostics'].reason,'DATA_MISSING');
});
test(id('J-C4'),()=>{
  const s=snapshot({status:'NEEDS_ITEMS',reason:'RESOURCE_MISSING',nextAction:'obtain and verify required items'});
  s.recommendation.primaryPlan.resources={ownedItemsConsumed:{xanax:1},boughtItems:{eroticDvd:2}};
  const text=html(s);assert.match(text,/NEEDS ITEMS/);assert.match(text,/Uses \(owned\): Xanax ×1/);
  assert.match(text,/Need to acquire: eDVD ×2/);assert.doesNotMatch(text,/name="ecstasy"/);
});
test(id('J-C5'),()=>{
  for (const reason of ['BOOSTER_LIMIT_REACHED','TIMING_UNSAFE','CAPABILITY_UNAVAILABLE']) {
    const s=snapshot({status:'BLOCKED',reason,nextAction:'wait for booster capacity'});
    const v=ui.buildView(s);assert.equal(v.readiness,'BLOCKED');assert.equal(v.reason,reason);
    assert.equal(v.advanced['Rejected / Diagnostics'].reason,reason);
    assert.match(html(s),reason==='BOOSTER_LIMIT_REACHED'?/Wait for booster capacity/:reason==='TIMING_UNSAFE'?/Happy reset timing/:/source is unavailable/);
  }
});
test(id('J-C6'),()=>{
  const s=snapshot({status:'NEEDS_REFRESH',reason:'DATA_MISSING',confidence:'EXPERIMENTAL'}),v=ui.buildView(s);
  assert.equal(v.readiness,'NEEDS_REFRESH');assert.equal(v.confidence,'EXPERIMENTAL');
  assert.match(html(s),/Confidence: EXPERIMENTAL/);assert.doesNotMatch(html(s),/ta-ready">EXPERIMENTAL/);
});
test(id('J-C7'),()=>{
  const s=snapshot();s.recommendation.primaryPlan.resources={ownedItemsConsumed:{xanax:1,eroticDvd:2,ecstasy:1},
    boughtItems:{eroticDvd:3,candy37:10}};
  const text=html(s),form=text.match(/<form data-form="inventory">[\s\S]*?<\/form>/)[0];
  for (const [key,quantity] of Object.entries(s.recommendation.primaryPlan.resources.ownedItemsConsumed)) {
    assert.match(form,new RegExp(`name="${key}"`));assert.match(form,new RegExp(`plan needs ${quantity}`));
  }
  assert.equal((form.match(/<input /g) || []).length,3);assert.doesNotMatch(form,/name="candy37"/);
  assert.match(text,/Need to acquire: eDVD ×3 · candy37 ×10/);assert.match(form,/Only these item keys gain current proof/);
});
test(id('J-C8'),async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.setPreferences({objective:'MAXIMUM_GAIN',prohibitedItems:['eroticDvd','ecstasy']});
  const before=h.advisor.confirmEffects(true);assert.equal(before.normalized.observedState.inventory.xanax,5);
  const lower=h.advisor.confirmInventory({xanax:1});assert.equal(lower.normalized.observedState.inventory.xanax,1);
  assert.match(html(lower),/Current confirmed inventory: Xanax ×1/);
  const zero=h.advisor.confirmInventory({xanax:0});assert.match(html(zero),/Current confirmed inventory: Xanax ×0/);
  assert.notEqual(ui.buildView(zero).identity,ui.buildView(before).identity);
});
test(id('J-C9'),()=>{
  const s=snapshot();assert.equal(ui.buildView(s).status,'ok');
  assert.match(html(s),/Cost comparison unavailable; no market prices supplied/);
  assert.match(html(s),/Approximate expected gain<\/dt><dd>1,230/);assert.doesNotMatch(html(s),/New cash: \$?0/);
});
test(id('J-C10'),()=>{
  const s=snapshot();s.recommendation={status:'NO_SAFE_RECOMMENDATION',reason:'UNSUPPORTED_EFFECT',primaryPlan:null};
  s.normalized.fields.gym={value:null,reason:'SCHEMA_MISMATCH'};
  const v=ui.buildView(s),text=html(s);assert.match(text,/No safe recommendation/);assert.match(text,/Known: Energy: 150/);
  assert.match(text,/Gym evidence \(\/user\/gym \+ \/torn\/gyms\)/);assert.match(text,/material gym, modifier, or item effect is unsupported/);
  assert.equal(v.advanced['Rejected / Diagnostics'].reason,'UNSUPPORTED_EFFECT');assert.ok(v.next);
});
test(id('J-C11'),()=>{
  const s=snapshot();s.recommendation.alternatives=Array.from({length:20},(_,i)=>({...structuredClone(s.recommendation.primaryPlan),
    id:'ALT_'+i,simulation:{modeledGain:1000-i*10},economics:{newCashRequired:i},timing:{waitSeconds:i*60}}));
  const v=ui.buildView(s);assert.equal(v.alternatives.length,3);const text=html(s);
  assert.equal((text.match(/gain .*?difference · new cash/g) || []).length,3);assert.doesNotMatch(text,/ALT_19/);
  assert.equal(v.advanced.Alternatives.length,20);
  s.recommendation.alternatives[0].timing={};assert.match(html(s),/wait Unavailable min difference/);
});
test(id('J-C12'),async()=>{
  const h=harness();const before=await h.advisor.refresh();h.advisor.setPreferences({mode:'advanced'});
  const after=h.advisor.snapshot();assert.deepEqual(after.recommendation,before.recommendation);
  assert.equal(after.epoch,before.epoch);assert.equal(h.requests.length,11);
  const advanced=ui.fullHtml(after,ui.buildView(after),{tab:'Advanced'});
  for (const section of ['Current State','Sources & Freshness','Selected Plan','Evidence & Confirmations','Economics','Model & Mechanics','Other / Rejected Routes','Diagnostics'])
    assert.match(advanced,new RegExp(`<h3>${section}</h3>`));
  assert.match(advanced,/observedAt/);assert.match(advanced,/cacheClass/);assert.match(advanced,/vladar-v2-pre50m-v1/);
});
test(id('J-C13'),()=>{
  for (const action of [{action:'TAKE_XANAX'},{action:'USE_BOOSTER',item:'eroticDvd',quantity:1},
    {action:'TAKE_ECSTASY'},{action:'TRAIN',targetStat:'speed',energySpent:150},{action:'USE_REFILL'}]) {
    const s=snapshot({actions:[action,{action:'VERIFY_STATE'}]}),text=html(s);
    assert.match(ui.buildView(s).next,/manually in Torn/);
    const labels=[...text.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m=>m[1]);
    assert.ok(labels.every(label=>!/^Take |^Use |^Train |^Buy |^Spend /i.test(label)));
    assert.ok([...text.matchAll(/data-action="([^"]+)"/g)].every(m=>['close','refresh','tab-Plan','tab-Options','tab-Advanced','checkpoint','compare','edit-effects','edit-inventory','forget-key'].includes(m[1])));
  }
});
test(id('J-C14'),async()=>{
  const h=harness();const first=await h.advisor.refresh();h.advisor.invalidate();h.input.bars.energy.current=100;
  const second=await h.advisor.refresh();assert.equal(second.epoch,first.epoch+1);
  assert.notEqual(ui.buildView(second).identity,ui.buildView(first).identity);
  assert.equal(second.normalized.observedState.energy,100);
});
test(id('J-C15'),async()=>{
  const h=harness();await h.advisor.refresh();h.advisor.setPreferences({theme:'Light',mode:'advanced',collapsed:true,position:{x:45,y:90}});
  const restarted=harness({storage:h.store}).advisor.snapshot();assert.equal(restarted.normalized,null);assert.equal(restarted.recommendation,null);
  assert.deepEqual(restarted.preferences.position,{x:45,y:90});assert.equal(restarted.preferences.mode,'advanced');
  assert.equal(restarted.preferences.collapsed,true);assert.equal(restarted.preferences.theme,'Light');assert.equal(h.store.map.size,1);
});
test('objective mapping, viewport clamping, touch layout and hostile text escaping',()=>{
  assert.deepEqual(runtime.OBJECTIVES,{Balanced:'BALANCED','Biggest Gain':'MAXIMUM_GAIN','Best Value':'BEST_VALUE',
    'Stay Under Budget':'BUDGET_CAP','Use What I Own':'USE_MY_INVENTORY','Train Soonest':'FASTEST_USEFUL'});
  assert.deepEqual(ui.clamp({x:900,y:-1},340,200,{width:360,height:640}),{x:20,y:0});
  assert.deepEqual(ui.clamp({x:50,y:90},400,900,{width:320,height:640}),{x:0,y:0});
  assert.match(ui.CSS,/touch-action:none/);assert.match(ui.CSS,/min-height:44px/);
  assert.match(ui.CSS,/@media\(max-width:600px\)/);assert.match(ui.CSS,/white-space:pre-wrap/);
  assert.doesNotMatch(ui.CSS,/:hover/);assert.match(ui.CSS,/data-theme=Auto/);
  assert.equal(ui.resolveTheme('Auto',{markers:'torn-dark-mode'}),'Dark');
  assert.equal(ui.resolveTheme('Auto',{background:'rgb(20, 20, 20)'}),'Dark');
  assert.equal(ui.resolveTheme('Auto',{prefersDark:true}),'Dark');
  assert.equal(ui.resolveTheme('Light',{prefersDark:true,markers:'dark'}),'Light');
  assert.equal(ui.resolveTheme('Auto',{background:'rgba(0, 0, 0, 0)'}),'Light');
  const s=snapshot();s.recommendation.explanation=['<img src=x onerror=alert(1)>'];
  assert.doesNotMatch(html(s),/<img src=x/);assert.match(html(s),/&lt;img/);
});
// Minimal event surface exercises ownership/lifecycle without pretending it is a real WebView.
function dom() {
  class Element {
    constructor(){this.handlers=new Map();this.style={};this.dataset={};this.offsetWidth=300;this.offsetHeight=200;this.innerHTML='';}
    addEventListener(type,handler){if (!this.handlers.has(type)) this.handlers.set(type,new Set());this.handlers.get(type).add(handler);}
    removeEventListener(type,handler){this.handlers.get(type)?.delete(handler);}
    fire(type,event){for (const handler of this.handlers.get(type) || []) handler(event);}
    appendChild(child){elements.push(child);}
    querySelector(){return hud;}
    querySelectorAll(){return [];}
    contains(target){return target.inside===true;}
    setPointerCapture(){}
    remove(){elements.splice(elements.indexOf(this),1);}
  }
  const elements=[],hud=new Element(),document=new Element(),window=new Element();
  document.head=new Element();document.body=new Element();document.createElement=()=>new Element();
  document.getElementById=id=>elements.find(e=>e.id===id);window.innerWidth=360;window.innerHeight=640;
  window.FormData=class extends Map {constructor(form){super(Object.entries(form.values));}};
  return {document,window,elements,hud};
}
test('mounted HUD navigation, pointer drag, checkpoint, visibility and cleanup are bounded',async()=>{
  const d=dom(),h=harness();await h.advisor.refresh();const mounted=ui.mount({...d,advisor:h.advisor});
  assert.equal(ui.mount({...d,advisor:h.advisor}),null);assert.equal(d.elements.length,2);
  const root=d.document.getElementById(ui.ROOT_ID),target=action=>({inside:true,closest:()=>({dataset:{action}})});
  root.fire('click',{target:target('open')});assert.match(root.innerHTML,/role="dialog"/);
  const before=h.advisor.snapshot().recommendation;root.fire('click',{target:target('mode')});
  assert.deepEqual(h.advisor.snapshot().recommendation,before);assert.match(root.innerHTML,/<h3>Sources & Freshness<\/h3>/);
  root.fire('pointerdown',{target:{closest:selector=>selector==='[data-drag]'},pointerId:1,clientX:10,clientY:10,preventDefault(){}});
  root.fire('pointermove',{pointerId:1,clientX:900,clientY:900});root.fire('pointerup',{pointerId:1});
  assert.deepEqual(h.advisor.snapshot().preferences.position,{x:60,y:440});
  root.fire('click',{target:target('collapse')});assert.equal(h.advisor.snapshot().preferences.collapsed,true);
  root.fire('click',{target:target('checkpoint')});assert.equal(h.advisor.snapshot().phase,'NEEDS_REFRESH');
  root.fire('click',{target:target('refresh')});await h.advisor.refresh();assert.equal(h.advisor.snapshot().epoch,2);
  d.document.hidden=true;d.document.fire('visibilitychange',{});assert.equal(h.advisor.snapshot().phase,'CURRENT');
  mounted.dispose();assert.equal(d.elements.length,0);assert.equal(h.timers.size,0);
  for (const element of [root,d.document,d.window]) for (const set of element.handlers.values()) assert.equal(set.size,0);
});
test('hiding and showing the document preserves the epoch and selected-plan confirmation',async()=>{
  const d=dom(),h=harness();await h.advisor.refresh();h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});
  h.advisor.confirmEffects(true);const before=h.advisor.confirmInventory(h.advisor.snapshot().recommendation.primaryPlan.resources.ownedItemsConsumed);
  const mounted=ui.mount({...d,advisor:h.advisor});
  for (const hidden of [true,false]) {d.document.hidden=hidden;d.document.fire('visibilitychange',{});
    assert.deepEqual(h.advisor.snapshot(),before);}
  mounted.dispose();
});
test('unrelated Torn links, buttons, inputs and form submissions preserve current proof; checkpoint clears it',async()=>{
  const d=dom(),h=harness();await h.advisor.refresh();h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});
  h.advisor.confirmEffects(true);const before=h.advisor.confirmInventory(h.advisor.snapshot().recommendation.primaryPlan.resources.ownedItemsConsumed);
  const mounted=ui.mount({...d,advisor:h.advisor}),root=d.document.getElementById(ui.ROOT_ID);
  for (const tagName of ['a','button','input']) {
    d.document.fire('click',{target:{inside:false,closest:()=>({tagName})}});
    assert.deepEqual(h.advisor.snapshot(),before);
  }
  d.document.fire('submit',{target:{inside:false}});assert.deepEqual(h.advisor.snapshot(),before);
  root.fire('click',{target:{inside:true,closest:()=>({dataset:{action:'checkpoint'}})}});
  const changed=h.advisor.snapshot();assert.equal(changed.phase,'NEEDS_REFRESH');
  assert.equal(changed.normalized.fields.inventory.confirmation,undefined);
  assert.equal(changed.normalized.fields.energy.freshness,'STALE');
  root.fire('click',{target:{inside:true,closest:()=>({dataset:{action:'open'}})}});
  assert.match(root.innerHTML,/State changed. Refresh &amp; Plan to continue\./);
  assert.doesNotMatch(root.innerHTML,/expires after state changes or 60 seconds/);
  mounted.dispose();
});
test('mounted preference and confirmation forms route explicit input into the canonical runtime',async()=>{
  const d=dom(),h=harness();await h.advisor.refresh();const mounted=ui.mount({...d,advisor:h.advisor});
  const root=d.document.getElementById(ui.ROOT_ID);
  const submit=(name,values)=>root.fire('submit',{preventDefault(){},target:{dataset:{form:name},values}});
  submit('preferences',{objective:'MAXIMUM_GAIN',targetStat:'speed',allowItems:'on',prohibited_ecstasy:'on',
    prohibited_eroticDvd:'on',maxWaitMinutes:'0',theme:'Dark',riskPolicy:'ALLOW_SUPPORTED'});
  assert.equal(h.advisor.snapshot().preferences.objective,'MAXIMUM_GAIN');
  assert.deepEqual([...h.advisor.snapshot().preferences.prohibitedItems].sort(),['ecstasy','eroticDvd']);
  submit('effects',{none:'on'});assert.equal(h.advisor.snapshot().normalized.capabilities.xanaxPreparation,true);
  submit('inventory',{xanax:'0'});assert.equal(h.advisor.snapshot().normalized.observedState.inventory.xanax,0);
  submit('points',{points:'30'});assert.equal(h.advisor.snapshot().normalized.observedState.pointsAvailable,30);
  assert.equal(h.requests.length,11);mounted.dispose();
});
test('all mounted current confirmations immediately replan in one epoch; refresh and checkpoint clear proof',async()=>{
  const d=dom(),h=harness({input:v2Responses(),fail:['battlestats','money']});
  h.advisor.setPreferences({objective:'MAXIMUM_GAIN',prohibitedItems:['eroticDvd','ecstasy'],allowRefill:true});
  const initial=await h.advisor.refresh(),mounted=ui.mount({...d,advisor:h.advisor});
  const root=d.document.getElementById(ui.ROOT_ID);
  const submit=(name,values)=>root.fire('submit',{preventDefault(){},target:{dataset:{form:name},values}});
  assert.match(ui.buildView(initial).next,/Confirm all four current raw battle stats below.*replan immediately/);
  submit('stats',{strength:'25000',speed:'90000',defense:'5000',dexterity:'5000'});
  assert.equal(h.advisor.snapshot().normalized.capabilities.manualStats,true);
  assert.equal(h.advisor.snapshot().recommendation.status,'ok');
  submit('effects',{none:'on'});assert.equal(h.advisor.snapshot().normalized.capabilities.xanaxPreparation,true);
  submit('inventory',{xanax:'0'});assert.equal(h.advisor.snapshot().normalized.observedState.inventory.xanax,0);
  submit('points',{points:'30'});const confirmed=h.advisor.snapshot();
  assert.equal(confirmed.normalized.observedState.pointsAvailable,30);
  assert.equal(confirmed.normalized.fields.inventory.confirmation.value.xanax,0);
  assert.equal(confirmed.phase,'CURRENT');assert.equal(confirmed.epoch,initial.epoch);assert.equal(h.requests.length,11);
  assert.doesNotMatch(root.innerHTML,/Provide the missing current input, then refresh/);
  const fresh=await h.advisor.refresh();assert.equal(fresh.epoch,initial.epoch+1);
  assert.equal(fresh.normalized.capabilities.manualStats,false);assert.equal(fresh.normalized.fields.effectState.value,null);
  assert.equal(fresh.normalized.fields.inventory.confirmation,undefined);assert.equal(fresh.normalized.fields.points.value,null);
  submit('stats',{strength:'25000',speed:'90000',defense:'5000',dexterity:'5000'});submit('effects',{none:'on'});
  submit('inventory',{xanax:'1'});submit('points',{points:'30'});
  root.fire('click',{target:{inside:true,closest:()=>({dataset:{action:'checkpoint'}})}});
  const checkpoint=h.advisor.snapshot();assert.equal(checkpoint.phase,'NEEDS_REFRESH');
  assert.equal(checkpoint.normalized.fields.inventory.confirmation,undefined);
  assert.equal(checkpoint.normalized.fields.energy.freshness,'STALE');
  assert.equal(checkpoint.normalized.fields.effectState.value,null);assert.equal(checkpoint.normalized.fields.points.value,null);
  mounted.dispose();
});
