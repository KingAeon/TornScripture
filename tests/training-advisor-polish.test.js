'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const planner=require('../src/training-advisor-pure.js');
const runtime=require('../src/training-advisor-runtime.js');
const ui=require('../src/training-advisor-ui.js');
const build=require('../scripts/build-training-advisor.js');
const frozen=require('../docs/divine-knowledge/chapters/dq-train-001/UI-POLISH-ROUTE-SELECTION-FIXTURES-001K.json');
const {harness,storage}=require('./helpers/training-advisor-fixtures.js');
const checks=new Map();
const check=(prefix,fn)=>checks.set(frozen.cases.find(c=>c.id.startsWith(prefix+'_')).id,fn);
const html=(s,session={})=>ui.fullHtml(s,ui.buildView(s),session);
function state(overrides={}) {
  return {energy:150,naturalEnergyMax:150,stackCap:1000,happy:4000,ordinaryHappy:4000,
    stats:{strength:25000,speed:90000,defense:5000,dexterity:5000},targetStat:'speed',
    gym:{dots:5.8,energyPerTrain:10},inventory:{eroticDvd:5,candy37:3,ecstasy:1,xanax:1},
    cooldowns:{drugSeconds:0,boosterSeconds:0,boosterMaxSeconds:86400},
    gainPerks:[],activeEffects:[],freshness:{energy:'LIVE',happy:'LIVE',gym:'FRESH',gainModifiers:'FRESH',
      inventory:'FRESH',boosterCooldown:'LIVE',drugCooldown:'LIVE'},...overrides};
}
const mechanics={eroticDvd:{happy:2500,cooldownSeconds:21600,replacementValueEach:100},
  candy37:{happy:25,cooldownSeconds:1800,replacementValueEach:1},ecstasy:{happyMultiplier:2,replacementValue:10}};
function recommendation(overrides={}) {
  return planner.recommend({observedState:state(),preferences:{objective:'BALANCED'},itemMechanics:mechanics,...overrides});
}
function snapshot(rec=recommendation()) {
  return {phase:'CURRENT',epoch:4,version:runtime.VERSION,connection:'TornPDA managed key',atomic:false,
    preferences:runtime.preferences(),recommendation:rec,effectivePlan:rec.primaryPlan,selectedRouteFingerprint:null,
    normalized:{observedState:state(),capabilities:{marketComparison:true,automaticStats:true},
      fields:{inventory:{},effectState:{value:[],freshness:'LIVE'},worldDiabetesDay:{value:null,reason:'UNSUPPORTED_EFFECT'}},sourceStatus:{},unsupported:[]}};
}
async function prepared() {
  const h=harness();await h.advisor.refresh();h.advisor.confirmEffects(true);return h;
}
function option(s,action) {return s.recommendation.routeOptions.find(o=>o.plan.actions.some(a=>a.action===action));}
function dom() {
  const elements=[];let document;
  class Element {
    constructor(){this.handlers=new Map();this.style={};this.dataset={};this.offsetWidth=300;this.offsetHeight=200;this.innerHTML='';}
    addEventListener(type,fn){if (!this.handlers.has(type)) this.handlers.set(type,new Set());this.handlers.get(type).add(fn);}
    removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);}
    fire(type,event){for (const fn of this.handlers.get(type) || []) fn(event);}
    appendChild(child){elements.push(child);}
    querySelector(selector){return selector==='.ta-hud' ? hud : null;}
    querySelectorAll(){return [];}
    setPointerCapture(){}
    getBoundingClientRect(){const left=parseFloat(this.style.left)||0,top=parseFloat(this.style.top)||0;
      return {left,top,width:this.offsetWidth,height:this.offsetHeight,right:left+this.offsetWidth,bottom:top+this.offsetHeight};}
    focus(){document.activeElement=this;}
    remove(){elements.splice(elements.indexOf(this),1);}
  }
  const hud=new Element();document=new Element();const window=new Element();
  document.head=new Element();document.body=new Element();document.createElement=()=>new Element();
  document.getElementById=id=>elements.find(e=>e.id===id);window.innerWidth=360;window.innerHeight=640;
  window.FormData=class extends Map {constructor(form){super(Object.entries(form.values));}};
  return {document,window,hud,elements};
}
function mounted(h) {
  const d=dom(),m=ui.mount({...d,advisor:h.advisor}),root=d.document.getElementById(ui.ROOT_ID);
  const click=(action,extra={})=>root.fire('click',{target:{closest:()=>({dataset:{action,...extra}})}});
  const submit=(form,values)=>root.fire('submit',{preventDefault(){},target:{dataset:{form},values}});
  return {...d,root,click,submit,dispose:()=>m.dispose()};
}
check('K-A1',async()=>{
  assert.match(ui.CSS,/position:fixed;inset:0;z-index:2147483647;isolation:isolate/);
  for (const [layer,z] of [['ta-scrim',1],['ta-hud',2],['ta-overlay',3]])
    assert.match(ui.CSS,new RegExp(`\\.${layer}[^}]*position:fixed[^}]*z-index:${z}`));
  const h=await prepared(),d=mounted(h);d.click('open');assert.match(d.root.innerHTML,/ta-scrim/);
  assert.match(d.root.innerHTML,/role="dialog" aria-modal="true"/);assert.match(d.root.innerHTML,/inert aria-hidden/);d.dispose();
});
check('K-A2',()=>{
  const {scrim,...tokens}=frozen.designTokens.dark;assert.deepEqual(ui.THEMES.Dark,tokens);
  for (const value of Object.values(tokens).filter(x=>typeof x==='string')) assert.ok(ui.CSS.includes(value));
  assert.ok(ui.CSS.includes(scrim));assert.match(ui.CSS,/rgba\(17, 23, 34, 0\.98\)/);
  assert.match(ui.CSS,/rgba\(17, 23, 34, 0\.94\)/);assert.doesNotMatch(ui.CSS,/backdrop-filter|blur\(/);
});
check('K-A3',()=>{
  assert.match(ui.CSS,/\.ta-sticky\{position:sticky;top:0;flex-shrink:0/);
  assert.match(ui.CSS,/\.ta-body\{overflow:auto/);
  const s=html(snapshot());assert.ok(s.indexOf('ta-header')<s.indexOf('ta-tabs'));
  assert.ok(s.indexOf('ta-tabs')<s.indexOf('ta-state-strip'));assert.ok(s.indexOf('ta-state-strip')<s.indexOf('ta-body'));
  assert.match(ui.CSS,/env\(safe-area-inset-bottom\)/);assert.match(ui.CSS,/max-width:820px/);
});
check('K-A4',async()=>{
  const h=await prepared(),d=mounted(h),before=h.advisor.snapshot().recommendation;
  d.click('open');d.click('tab-Advanced');assert.match(d.root.innerHTML,/data-tab="Advanced"/);
  d.click('close');d.click('open');assert.match(d.root.innerHTML,/data-tab="Plan"/);
  assert.deepEqual(h.advisor.snapshot().recommendation,before);d.dispose();
});
check('K-A5',()=>{
  assert.match(html(snapshot()),/data-action="close" aria-label="Close Training Advisor">X/);
  const controls=ui.CSS.match(/button,[^{]+select\{([^}]+)\}/)[1];
  const close=ui.CSS.match(/button\[data-action=close\]\{([^}]+)\}/)?.[1] || '';
  for (const dimension of ['width','height']) {
    const expression=new RegExp(`min-${dimension}:(\\d+)px`);
    const value=close.match(expression)?.[1] || controls.match(expression)?.[1];
    assert.ok(Number(value)>=44,`Close min-${dimension} must be at least 44px`);
  }
  assert.doesNotMatch(close,/blocked|#E26464|#B63A3A/);
});
check('K-A6',()=>{
  const s=snapshot();s.effectivePlan={...s.effectivePlan,readiness:{status:'READY',reason:null,nextAction:'TRAIN'}};
  const v=ui.buildView(s),text=html(s);assert.equal(v.readiness,'READY');assert.equal(v.confidence,'SUPPORTED_EXTRAPOLATION');
  assert.match(text,/ta-ready">READY/);assert.match(text,/ta-confidence">Confidence: SUPPORTED/);
});
check('K-A7',()=>{
  assert.match(ui.CSS,/@media\(prefers-reduced-motion:reduce\)[\s\S]*transition:none!important;animation:none!important/);
  assert.match(ui.CSS,/150ms/);assert.doesNotMatch(ui.CSS,/animation:.*infinite/);
});
check('K-A8',async()=>{
  const h=await prepared(),d=mounted(h);assert.match(d.root.innerHTML,/NEXT:/);assert.match(d.root.innerHTML,/data-action="refresh"/);
  assert.match(d.root.innerHTML,/data-action="open"/);assert.doesNotMatch(d.root.innerHTML,/data-form=|Cash needed|Owned value|I completed this step|vladar|observedAt/);d.dispose();
});
check('K-A9',async()=>{
  const h=await prepared(),d=mounted(h);d.click('collapse');assert.match(d.root.innerHTML,/ta-collapsed/);
  h.advisor.invalidate();assert.match(d.root.innerHTML,/TA \| REFRESH/);assert.match(d.root.innerHTML,/ta-collapsed/);
  await h.advisor.refresh();assert.equal(h.advisor.snapshot().preferences.collapsed,true);d.dispose();
});
check('K-A10',()=>{
  assert.deepEqual(ui.THEMES.Light,frozen.designTokens.light);assert.match(ui.CSS,/rgba\(244, 247, 251, 1\)/);
  assert.equal(ui.resolveTheme('Auto',{prefersDark:true}),'Dark');assert.equal(ui.resolveTheme('Auto',{}),'Light');
});
check('K-B1',()=>{
  const s=html(snapshot()).split('<section class="ta-plan-identity">')[1];let previous=-1;
  for (const marker of ['<h2>','class="ta-chip ta-','ta-confidence','class="ta-next"','<h3>Outcome','<h3>Resources','<h3>Ordered steps','<h3>Why this plan?','Compare Routes','You act in Torn.']) {
    const index=s.indexOf(marker);assert.ok(index>previous,marker);previous=index;
  }
  assert.match(ui.CSS,/ta-next>p\{font-size:17px;font-weight:650/);assert.match(ui.CSS,/dd\{[^}]*font-size:14px/);
});
check('K-B2',async()=>{
  const h=harness();await h.advisor.refresh();const s=h.advisor.snapshot(),v=ui.buildView(s);
  assert.equal(v.readiness,'READY');assert.match(v.next,/Train .*manually in Torn/);assert.match(html(s),/I completed this step/);
});
check('K-B3',async()=>{
  const h=await prepared(),d=mounted(h);h.advisor.selectRoute(option(h.advisor.snapshot(),'TAKE_ECSTASY').fingerprint);
  d.click('open');const before=ui.buildView(h.advisor.snapshot());d.click('checkpoint');
  assert.equal(h.advisor.snapshot().phase,'NEEDS_REFRESH');assert.equal(ui.buildView(h.advisor.snapshot()).identity,before.identity);
  assert.match(d.root.innerHTML,/ta-stale/);assert.match(d.root.innerHTML,/NEEDS REFRESH/);
  assert.match(d.root.innerHTML,/data-action="compare" disabled/);assert.match(d.root.innerHTML,/<fieldset disabled>/);d.dispose();
});
check('K-B4',async()=>{
  const h=harness();await h.advisor.refresh();const d=mounted(h);d.click('open');d.click('tab-Advanced');
  assert.match(d.root.innerHTML,/data-form="effects"/);d.submit('effects',{none:'on'});
  assert.match(d.root.innerHTML,/Preparation effects confirmed/);assert.match(d.root.innerHTML,/Current for Epoch 1/);
  assert.doesNotMatch(d.root.innerHTML,/data-form="effects"/);
  d.click('tab-Plan');
  h.advisor.setPreferences({objective:'MAXIMUM_GAIN',prohibitedItems:['eroticDvd','ecstasy']});
  d.submit('inventory',{xanax:'1'});assert.match(d.root.innerHTML,/Preparation effects confirmed/);
  assert.match(d.root.innerHTML,/Required inventory confirmed/);assert.match(d.root.innerHTML,/Current for Epoch 1/);
  assert.doesNotMatch(d.root.innerHTML,/data-form="inventory"|data-form="effects"/);
  d.click('edit-inventory');assert.match(d.root.innerHTML,/name="xanax"[^>]*value="1"/);d.dispose();
});
check('K-B5',async()=>{
  const h=await prepared(),s=h.advisor.snapshot(),route=option(s,'TAKE_ECSTASY');h.advisor.selectRoute(route.fingerprint);
  const selected=h.advisor.snapshot(),v=ui.buildView(selected);assert.equal(v.readiness,'NEEDS_REFRESH');assert.equal(v.readinessLabel,'RESEARCH GATE');
  assert.match(html(selected),/PLAYER SELECTED/);assert.doesNotMatch(v.next,/Take 1 Ecstasy/);
  assert.doesNotMatch(v.sequence.join(' '),/Take 1 Ecstasy/);assert.match(html(selected,{tab:'Advanced'}),/confirm safe quarter-hour window/);
});
check('K-B6',async()=>{
  const h=await prepared(),s=h.advisor.snapshot();assert.equal(s.normalized.itemMechanics.candy37,undefined);
  assert.match(html(s),/H2 open/);assert.doesNotMatch(html(s),/name="worldDiabetesDay"/);
  assert.equal(s.recommendation.primaryPlan.readiness.status,'READY');
});
check('K-B7',async()=>{
  const h=await prepared(),d=mounted(h);d.click('open');d.click('tab-Options');const before=h.advisor.snapshot(),calls=h.requests.length;
  const values={objective:'MAXIMUM_GAIN',targetStat:'speed',maxWaitMinutes:'0',allowItems:'on',ownedItemsOnly:'on',pointLimit:'30',riskPolicy:'ALLOW_SUPPORTED'};
  d.root.fire('change',{target:{name:'objective',closest:()=>({values})}});
  assert.deepEqual(h.advisor.snapshot(),before);d.submit('preferences',values);
  assert.equal(h.advisor.snapshot().preferences.objective,'MAXIMUM_GAIN');assert.equal(h.advisor.snapshot().epoch,before.epoch);
  assert.equal(h.requests.length,calls);assert.match(d.root.innerHTML,/data-tab="Plan"/);d.dispose();
});
check('K-B8',async()=>{
  const h=await prepared(),d=mounted(h);d.click('open');d.click('tab-Options');const before=h.advisor.snapshot();
  d.root.fire('change',{target:{name:'theme',value:'Dark',closest:()=>({values:{objective:'MAXIMUM_GAIN',targetStat:'speed',allowItems:'on',ownedItemsOnly:'on'}})}});
  const after=h.advisor.snapshot();assert.deepEqual(after.recommendation,before.recommendation);assert.deepEqual(after.normalized,before.normalized);
  assert.equal(after.preferences.objective,before.preferences.objective);assert.equal(after.preferences.theme,'Dark');assert.match(d.root.innerHTML,/value="MAXIMUM_GAIN" selected/);d.dispose();
});
check('K-B9',async()=>{
  const h=await prepared(),d=mounted(h);d.click('open');const before=h.advisor.snapshot();d.click('tab-Advanced');
  for (const name of ['Current State','Sources & Freshness','Selected Plan','Evidence & Confirmations','Economics','Model & Mechanics','Other / Rejected Routes','Diagnostics']) assert.ok(d.root.innerHTML.includes('<h3>'+name+'</h3>'));
  assert.match(d.root.innerHTML,/<details><summary>View raw/);assert.deepEqual(h.advisor.snapshot(),before);
  assert.doesNotMatch(d.root.innerHTML,/Copy diagnostics/);d.dispose();
});
check('K-B10',()=>{
  const text=html(snapshot());for (const name of ['Cash needed','Owned value used','Total resource value','Points used']) assert.ok(text.includes(name));
  assert.doesNotMatch(text,/Points: 0/);assert.match(html(snapshot(),{tab:'Advanced'}),/Available Points/);
});
check('K-B11',()=>{
  const s=snapshot();s.effectivePlan=structuredClone(s.effectivePlan);s.effectivePlan.economics={newCashRequired:null,marketValueOfOwnedItemsConsumed:null,economicValueConsumed:null,pointsConsumed:0};
  assert.match(html(s),/<dt>Cash needed<\/dt><dd>Price unavailable/);assert.doesNotMatch(html(s),/\$0/);
});
check('K-B12',async()=>{
  const h=harness();await h.advisor.refresh();const d=mounted(h);d.click('open');assert.match(d.root.innerHTML,/I completed this step/);
  const calls=h.requests.length;d.click('checkpoint');assert.equal(h.requests.length,calls);assert.equal(h.advisor.snapshot().phase,'NEEDS_REFRESH');d.dispose();
});
check('K-B13',()=>{
  const text=html(snapshot());const labels=[...text.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m=>m[1]);
  assert.ok(labels.every(label=>!/^Take |^Use (?!this plan)|^Train |^Buy |^Spend /i.test(label)));
  const source=fs.readFileSync('src/training-advisor-ui.js','utf8');assert.doesNotMatch(source,/\.click\(|\.submit\(|fetch\(/);
});
check('K-B14',async()=>{
  const h=await prepared(),d=mounted(h);d.click('open');d.click('compare');assert.match(d.root.innerHTML,/data-tab="Plan"/);
  assert.equal((d.root.innerHTML.match(/role="dialog"/g)||[]).length,1);assert.match(d.root.innerHTML,/<details class="ta-route">/);
  assert.doesNotMatch(d.root.innerHTML,/<details class="ta-route" open/);d.click('back-plan');assert.match(d.root.innerHTML,/ta-plan-identity/);d.dispose();
});
check('K-C1',()=>{
  const input={observedState:state(),preferences:{objective:'BALANCED'},itemMechanics:mechanics};const before=structuredClone(input),rec=planner.recommend(input);
  assert.ok(rec.routeOptions.length);assert.equal(rec.routeOptions[0].fingerprint,rec.primaryPlan.fingerprint);
  assert.ok(rec.routeOptions.every(option=>option.fingerprint===option.plan.fingerprint));assert.deepEqual(input,before);
  assert.deepEqual(planner.recommend(input),rec);assert.doesNotMatch(fs.readFileSync('src/training-advisor-ui.js','utf8'),/rankCandidates|simulateTraining|simulatePlan|composePlan/);
});
function canonicalCandidates(count=10) {
  const s=state({inventory:{},cooldowns:{drugSeconds:0,boosterSeconds:0,boosterMaxSeconds:100}}),candidates=[];
  for (let index=0;index<count;index++) {
    const id='synthetic'+index;s.inventory[id]=1;
    const plan=planner.composePlan({state:s,energy:planner.generateEnergyCandidates(s)[0],
      recipe:{items:[{id,quantity:1,owned:1,newCashEach:0,replacementValueEach:index}],useEcstasy:false},
      itemMechanics:{[id]:{happy:100+index,cooldownSeconds:1}}});
    candidates.push({id:plan.id,fingerprint:plan.fingerprint,plan,confidence:plan.confidence.level,
      expectedGain:plan.simulation.modeledGain,economicValueConsumed:plan.economics.economicValueConsumed,
      newCashRequired:0,boughtItemsCount:0,pointsConsumed:0,timeToCompletionHours:0});
  }
  return candidates;
}
check('K-C2',()=>{
  const candidates=canonicalCandidates(),constraints={referenceSessionGain:0},ranking=planner.rankCandidates({candidates,...constraints});
  const routes=planner.projectRouteOptions(candidates,ranking,constraints);assert.equal(routes.length,7);
  assert.equal(new Set(routes.map(o=>o.fingerprint)).size,7);assert.ok(routes.some(o=>o.roles.length>1));
  assert.deepEqual(planner.projectRouteOptions([...candidates].reverse(),ranking,constraints),routes);
  for (const [objective,role] of [['MAXIMUM_GAIN','HIGHEST GAIN'],['BEST_VALUE','BEST VALUE'],['USE_MY_INVENTORY','USE WHAT I OWN']]) {
    const winner=planner.rankCandidates({candidates,...constraints,objective}).selected;
    assert.ok(routes.find(o=>o.fingerprint===winner.fingerprint).roles.includes(role));
  }
});
check('K-C3',()=>{
  const candidates=canonicalCandidates().map(c=>({...c,economicValueConsumed:null}));
  const r=planner.projectRouteOptions(candidates,{selected:null},{});
  assert.ok(r.length);assert.ok(r.some(o=>o.roles.includes('HIGHEST GAIN')));assert.ok(r.every(o=>!o.roles.includes('BEST VALUE') && !o.roles.includes('USE WHAT I OWN')));
});
check('K-C4',()=>{
  const rec=recommendation(),signatures=rec.routeOptions.map(o=>o.preparationSignature);
  assert.ok(signatures.some(s=>s.includes('eroticDvd')));assert.ok(signatures.some(s=>s.includes('candy37')));
  for (const option of rec.routeOptions) assert.equal(option.preparationSignature,planner.preparationSignature(option.plan));
  assert.equal(planner.preparationSignature({actions:[{action:'TRAIN'}]}),'TRAIN_ONLY');
});
check('K-C5',async()=>{
  const h=await prepared(),before=h.advisor.snapshot(),route=option(before,'TAKE_ECSTASY');
  const after=h.advisor.selectRoute(route.fingerprint);assert.equal(after.effectivePlan.fingerprint,route.fingerprint);
  assert.deepEqual(after.recommendation.primaryPlan,before.recommendation.primaryPlan);assert.equal(after.preferences.objective,before.preferences.objective);
  assert.match(html(after),/PLAYER SELECTED/);assert.throws(()=>h.advisor.selectRoute('fabricated'),/exact current canonical route/);
});
check('K-C6',async()=>{
  const h=await prepared(),route=option(h.advisor.snapshot(),'TAKE_ECSTASY'),s=h.advisor.selectRoute(route.fingerprint);
  assert.equal(s.effectivePlan.readiness.status,route.plan.readiness.status);assert.deepEqual(s.normalized.timing,{});
  assert.equal(s.normalized.itemMechanics.candy37,undefined);assert.equal(s.normalized.fields.inventory.confirmation,undefined);
});
check('K-C7',async()=>{
  const h=await prepared();
  const xanax=h.advisor.snapshot().recommendation.routeOptions.find(o=>o.plan.actions.some(a=>a.action==='TAKE_XANAX') && !o.plan.actions.some(a=>a.action==='TAKE_ECSTASY'));
  h.advisor.selectRoute(xanax.fingerprint);h.advisor.confirmInventory({xanax:1});
  const before=h.advisor.snapshot(),route=option(before,'TAKE_ECSTASY'),s=h.advisor.selectRoute(route.fingerprint);
  assert.equal(s.normalized.fields.inventory.confirmation,undefined);assert.equal(s.normalized.observedState.inventoryFreshnessByItem.xanax,'FRESH');
  assert.deepEqual(s.normalized.fields.effectState,before.normalized.fields.effectState);assert.deepEqual(s.normalized.fields.points,before.normalized.fields.points);
  assert.equal(s.epoch,before.epoch);const submitted={...s.effectivePlan.resources.ownedItemsConsumed,xanax:99,candy37:99};
  const confirmed=h.advisor.confirmInventory(submitted);assert.deepEqual(Object.keys(confirmed.normalized.fields.inventory.confirmation.value).sort(),Object.keys(s.effectivePlan.resources.ownedItemsConsumed).sort());
  assert.equal(confirmed.normalized.capabilities.inventoryExecution,false);
});
test('001K Apply & Replan clears selected-route inventory proof even when preferences are unchanged',async()=>{
  const h=await prepared(),route=option(h.advisor.snapshot(),'TAKE_ECSTASY');
  h.advisor.selectRoute(route.fingerprint);h.advisor.confirmInventory(route.plan.resources.ownedItemsConsumed);
  const before=h.advisor.snapshot(),calls=h.requests.length;
  assert.ok(before.normalized.fields.inventory.confirmation);
  const after=h.advisor.applyPreferences(before.preferences);
  assert.equal(after.selectedRouteFingerprint,null);assert.equal(after.normalized.fields.inventory.confirmation,undefined);
  assert.equal(after.epoch,before.epoch);assert.equal(h.requests.length,calls);
  assert.deepEqual(after.effectivePlan,after.recommendation.primaryPlan);
  assert.deepEqual(after.normalized.fields.effectState,before.normalized.fields.effectState);
});
test('001K Close restores focus to the newly rendered HUD Open control',async()=>{
  const h=await prepared(),d=mounted(h);d.click('open');
  let focused=false;
  const query=d.root.querySelector.bind(d.root);
  d.root.querySelector=selector=>selector==='[data-action=open]' ? {focus(){focused=true;}} : query(selector);
  d.click('close');assert.equal(focused,true);d.dispose();
});
check('K-C8',async()=>{
  const h=await prepared();h.advisor.selectRoute(option(h.advisor.snapshot(),'TAKE_ECSTASY').fingerprint);
  const old=h.advisor.snapshot(),pending=h.advisor.refresh();assert.equal(h.advisor.snapshot().selectedRouteFingerprint,null);
  const after=await pending;assert.equal(after.epoch,old.epoch+1);assert.deepEqual(after.effectivePlan,after.recommendation.primaryPlan);
});
check('K-C9',async()=>{
  const h=await prepared();h.advisor.selectRoute(option(h.advisor.snapshot(),'TAKE_ECSTASY').fingerprint);
  const before=h.advisor.snapshot(),calls=h.requests.length,after=h.advisor.setPreferences({objective:'MAXIMUM_GAIN'});
  assert.equal(after.selectedRouteFingerprint,null);assert.equal(after.epoch,before.epoch);assert.equal(h.requests.length,calls);
  assert.deepEqual(after.effectivePlan,after.recommendation.primaryPlan);
});
check('K-C10',async()=>{
  const h=await prepared(),d=mounted(h);d.click('open');const route=option(h.advisor.snapshot(),'TAKE_ECSTASY');d.click('select-route',{fingerprint:route.fingerprint});
  const before=h.advisor.snapshot();d.click('close');d.click('open');assert.deepEqual(h.advisor.snapshot(),before);
  assert.match(d.root.innerHTML,/PLAYER SELECTED/);d.dispose();
});
check('K-C11',()=>{
  const s=snapshot(),route=s.recommendation.routeOptions[0],text=ui.compareHtml(s);
  for (const value of ['Cash needed','Owned value used','Points used','Total resource value','Approximate gain','Confidence:','wait','Use this plan']) assert.ok(text.includes(value));
  assert.ok(text.includes('$'+ui.approximate(route.plan.economics.newCashRequired)));
});
check('K-C12',()=>{
  const s=snapshot();for (const option of s.recommendation.routeOptions) for (const field of ['newCashRequired','marketValueOfOwnedItemsConsumed','economicValueConsumed']) option.plan.economics[field]=null;
  const text=ui.compareHtml(s);assert.match(text,/Price unavailable/);assert.doesNotMatch(text,/\$0/);
});
function dvdPlan(maximum=86400) {
  const s=state({cooldowns:{drugSeconds:0,boosterSeconds:0,boosterMaxSeconds:maximum}});
  return planner.recommend({observedState:s,preferences:{objective:'MAXIMUM_GAIN'},itemMechanics:mechanics}).primaryPlan;
}
check('K-C13',()=>{
  const plan=dvdPlan(),m=plan.marginalFinalBooster;assert.equal(m.item,'eroticDvd');assert.equal(m.gain,plan.marginalGainFromFinalBooster);
  const reduced=planner.composePlan({state:state(),energy:planner.generateEnergyCandidates(state())[0],
    recipe:{items:plan.boosterUseSequence.map((use,index,array)=>({id:use.item,quantity:use.quantity-(index===array.length-1?1:0),owned:use.quantity-(index===array.length-1?1:0),newCashEach:0,replacementValueEach:mechanics[use.item].replacementValueEach})).filter(item=>item.quantity),useEcstasy:true},itemMechanics:mechanics});
  assert.equal(m.gain,plan.simulation.modeledGain-reduced.simulation.modeledGain);assert.equal(m.economicDelta,100);
});
check('K-C14',()=>{
  const plan=dvdPlan(108000);assert.equal(plan.resources.ownedItemsConsumed.eroticDvd,5);assert.equal(plan.marginalFinalBooster.itemOrdinal,5);
  const s=snapshot();s.effectivePlan=plan;assert.match(html(s),/Final included booster: eDVD #5/);assert.equal(plan.nextBoosterCheckpoint,undefined);
});
check('K-C15',()=>{
  const plan=dvdPlan();assert.equal(plan.resources.ownedItemsConsumed.eroticDvd,4);assert.ok(plan.nextBoosterCheckpoint);
  const s=snapshot();s.effectivePlan=plan;const text=html(s);assert.match(text,/Conditional later eDVD/);assert.match(text,/replan after checkpoint. Future gain unavailable/);
  assert.equal(plan.nextBoosterCheckpoint.gain,undefined);assert.equal(plan.actions.some(a=>a.action==='WAIT'),false);
});
check('K-C16',()=>{
  const plan=dvdPlan(),s=snapshot();s.effectivePlan=plan;const text=html(s);
  assert.match(text,/Final included booster: eDVD #4/);assert.doesNotMatch(text,/Final included booster: eDVD #5|fifth.*gain \d/);
});
check('K-C17',()=>{
  const rec=recommendation(),candy=rec.routeOptions.find(o=>o.plan.boosterUseSequence?.some(use=>use.item==='candy37'));
  assert.ok(candy);const quantity=candy.plan.resources.ownedItemsConsumed.candy37;
  const text=ui.compareHtml(snapshot(rec));assert.ok(text.includes('candy37 ×'+quantity));assert.doesNotMatch(text,/49 lollipops/);
});
check('K-C18',async()=>{
  for (const transition of ['setKey','dispose']) {
    const h=await prepared();h.advisor.selectRoute(option(h.advisor.snapshot(),'TAKE_ECSTASY').fingerprint);
    if (transition==='setKey') h.advisor.setKey('SYNTHETIC_NEW_KEY');else h.advisor.dispose();
    assert.equal(h.advisor.snapshot().selectedRouteFingerprint,null);assert.equal(h.advisor.snapshot().phase,'NEEDS_REFRESH');
    const saved=h.store.getItem(runtime.PREFS_KEY) || '';assert.doesNotMatch(saved,/selectedRoute|fingerprint|recommendation/);
  }
});
check('K-C19',async()=>{
  const h=await prepared(),before=h.advisor.snapshot(),route=option(before,'TAKE_ECSTASY'),s=h.advisor.selectRoute(route.fingerprint),v=ui.buildView(s);
  assert.equal(v.identity,route.fingerprint);assert.equal(v.gain,route.plan.simulation.modeledGain);
  assert.deepEqual(v.owned,ui.ownedRequirements(route.plan));assert.equal(v.reason,route.plan.readiness.reason);
  assert.notEqual(v.identity,before.recommendation.primaryPlan.fingerprint);assert.equal(v.readinessLabel,'RESEARCH GATE');
});
check('K-C20',async()=>{
  const h=await prepared();h.advisor.selectRoute(option(h.advisor.snapshot(),'TAKE_ECSTASY').fingerprint);assert.equal(h.requests.length,11);
  assert.equal(h.advisor.snapshot().normalized.marketSnapshot.available,false);assert.match(html(h.advisor.snapshot()),/Price unavailable/);
  assert.equal(Object.keys(runtime.SOURCES).length,11);assert.doesNotMatch(fs.readFileSync('src/training-advisor-ui.js','utf8'),/https?:\/\//);
});
check('K-A11',()=>{
  assert.match(ui.CSS,/ta-overlay::before\{[^}]*height:2px;[^}]*linear-gradient\(90deg,var\(--action\),var\(--telemetry\)\)/);
  assert.doesNotMatch(ui.CSS,/glow|box-shadow|text-shadow/);
});
check('K-C21',()=>{
  const candidates=canonicalCandidates(1);candidates[0].newCashRequired=100;candidates[0].boughtItemsCount=1;
  candidates[0].plan.resources.boughtItems={synthetic0:1};candidates[0].plan.economics.newCashRequired=100;
  const constraints={referenceSessionGain:0},ranking=planner.rankCandidates({candidates,objective:'MAXIMUM_GAIN'});
  const [route]=planner.projectRouteOptions(candidates,ranking,constraints);
  assert.ok(route.roles.includes('LOWEST NEW CASH'));assert.ok(!route.roles.includes('USE WHAT I OWN'));
});
assert.equal(frozen.cases.length,46);assert.equal(checks.size,46);
assert.deepEqual([...checks.keys()].sort(),frozen.cases.map(c=>c.id).sort());
for (const f of frozen.cases) test(f.id,checks.get(f.id));

test('001K hard constraints govern every curated route and unsupported outcomes never enter projection',()=>{
  const input={observedState:state(),itemMechanics:mechanics,preferences:{objective:'MAXIMUM_GAIN',prohibitedItems:['eroticDvd'],ownedItemsOnly:true,budgetNewCash:0,pointLimit:0,maxWaitSeconds:0,maxWaitHours:0}};
  for (const option of planner.recommend(input).routeOptions) {
    assert.equal(option.plan.simulation.status,'ok');assert.equal(option.plan.resources.ownedItemsConsumed.eroticDvd,undefined);
    assert.deepEqual(option.plan.resources.boughtItems,{});assert.equal(option.plan.economics.pointsConsumed,0);
    assert.equal(option.plan.economics.newCashRequired,0);assert.equal(option.plan.timing.waitSeconds,0);
  }
  const partial=planner.recommend({...input,observedState:state({stats:{speed:49999999}})});
  assert.deepEqual(partial.routeOptions,[]);
});
test('001K weakest-stat mapping uses canonical target-specific gym/perks without an acquisition',async()=>{
  const h=await prepared(),before=h.requests.length;
  h.input.perks.faction=['+ 10% defense gym gains'];await h.advisor.refresh();
  const s=h.advisor.setPreferences({statAllocationMode:'WEAKEST_STAT',allowItems:false});
  assert.equal(s.effectivePlan.target.stat,'defense');assert.equal(s.normalized.observedState.targetStat,'defense');
  assert.equal(s.normalized.observedState.gym.dots,h.input.tornGyms.find(g=>g.id===h.input.userGym.gym.id).modifiers.defense);
  assert.deepEqual(s.normalized.observedState.gainPerks,[{id:'faction:gym:defense',rate:.1}]);assert.equal(h.requests.length,before+7);
});
test('001K selected-route lower/zero proof still contradicts planning and replans without carrying old exact selection',async()=>{
  const h=await prepared(),route=option(h.advisor.snapshot(),'TAKE_ECSTASY');h.advisor.selectRoute(route.fingerprint);
  const s=h.advisor.confirmInventory(Object.fromEntries(Object.keys(route.plan.resources.ownedItemsConsumed).map(key=>[key,0])));
  assert.equal(s.selectedRouteFingerprint,null);assert.notEqual(s.effectivePlan.fingerprint,route.fingerprint);
  for (const key of Object.keys(route.plan.resources.ownedItemsConsumed)) assert.equal(s.normalized.observedState.inventory[key],0);
  assert.equal(s.normalized.capabilities.inventoryExecution,false);
});
test('001K theme/HUD preferences retain selection; checkpoint makes it context only; stale selection rejects',async()=>{
  const h=await prepared(),route=option(h.advisor.snapshot(),'TAKE_ECSTASY');h.advisor.selectRoute(route.fingerprint);
  const before=h.advisor.snapshot();h.advisor.setPreferences({theme:'Light',collapsed:true,position:{x:2,y:3}});
  assert.equal(h.advisor.snapshot().selectedRouteFingerprint,route.fingerprint);assert.deepEqual(h.advisor.snapshot().recommendation,before.recommendation);
  h.advisor.invalidate();assert.equal(ui.buildView(h.advisor.snapshot()).readiness,'NEEDS_REFRESH');
  assert.equal(ui.buildView(h.advisor.snapshot()).identity,route.plan.id);
  assert.deepEqual(ui.buildView(h.advisor.snapshot()).advanced.Plan,route.plan);
  assert.throws(()=>h.advisor.selectRoute(route.fingerprint),/Refresh & Plan/);
});
test('001K control areas do not drag; grip clamps; no new timer or page-wide invalidation listener',async()=>{
  const h=await prepared(),d=mounted(h),before=h.advisor.snapshot().preferences.position;
  d.root.fire('pointerdown',{target:{closest:()=>true},pointerId:1,clientX:10,clientY:10,preventDefault(){throw Error('control dragged');}});
  d.root.fire('pointermove',{pointerId:1,clientX:900,clientY:900});d.root.fire('pointerup',{pointerId:1});assert.deepEqual(h.advisor.snapshot().preferences.position,before);
  d.root.fire('pointerdown',{target:{closest:selector=>selector==='[data-drag]'},pointerId:2,clientX:10,clientY:10,preventDefault(){}});
  d.root.fire('pointermove',{pointerId:2,clientX:900,clientY:900});d.root.fire('pointerup',{pointerId:2});assert.deepEqual(h.advisor.snapshot().preferences.position,{x:60,y:440});
  assert.equal(d.document.handlers.size,0);assert.equal(h.timers.size,0);d.dispose();for (const set of d.root.handlers.values()) assert.equal(set.size,0);
});
test('001K generated-artifact route projection/selection and confirmation UI have VM parity',async()=>{
  const context=vm.createContext({__TS_TRAINING_ADVISOR_TEST_MODE__:true,URL,Intl,AbortController});
  vm.runInContext(build.generate(),context);const e=context.__TS_TRAINING_ADVISOR_TEST_EXPORTS__,plain=v=>JSON.parse(JSON.stringify(v));
  const rec=recommendation();assert.deepEqual(plain(e.planner.recommend({observedState:state(),preferences:{objective:'BALANCED'},itemMechanics:mechanics})),rec);
  const h=await prepared(),s=h.advisor.selectRoute(option(h.advisor.snapshot(),'TAKE_ECSTASY').fingerprint);
  assert.deepEqual(plain(e.ui.buildView(s)),ui.buildView(s));assert.equal(e.ui.fullHtml(s,e.ui.buildView(s)),html(s));
});

test('001K Beginner Train Now suppresses preference-only preparation prompts and forms',()=>{
  const s=snapshot(recommendation({preferences:{objective:'BALANCED',allowItems:false}}));
  s.preferences.allowItems=true;s.normalized.fields.effectState={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.boosterMaxSeconds={value:null,reason:'DATA_MISSING'};
  assert.ok(s.effectivePlan.actions.every(a=>!['TAKE_XANAX','TAKE_ECSTASY','USE_BOOSTER'].includes(a.action)));
  assert.doesNotMatch(html(s),/data-form="effects"|Preparation effects confirmed/);
  assert.ok(ui.buildView(s).missing.every(x=>!['effectState','boosterMaxSeconds'].includes(x.field)));
});
test('001K Beginner non-refill route suppresses preference-only Points/refill prompts and forms',()=>{
  const s=snapshot();s.preferences.allowRefill=true;
  s.normalized.fields.points={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.pointRefill={value:null,reason:'DATA_MISSING'};
  assert.ok(!s.effectivePlan.actions.some(a=>a.action==='USE_REFILL'));
  assert.doesNotMatch(html(s),/data-form="points"/);
  assert.ok(ui.buildView(s).missing.every(x=>!['points','pointRefill'].includes(x.field)));
});
test('001K Beginner effective preparation route keeps required effect and booster evidence visible',()=>{
  const s=snapshot(),route=s.recommendation.routeOptions.find(o=>
    o.plan.actions.some(a=>a.action==='TAKE_ECSTASY') && o.plan.actions.some(a=>a.action==='USE_BOOSTER'));
  assert.ok(route);s.effectivePlan=route.plan;s.selectedRouteFingerprint=route.fingerprint;
  s.preferences.allowItems=false;s.normalized.fields.effectState={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.boosterMaxSeconds={value:null,reason:'DATA_MISSING'};
  assert.match(html(s),/data-form="effects"/);assert.ok(ui.buildView(s).missing.some(x=>x.field==='effectState'));
  assert.equal(ui.buildView(s).readinessLabel,'RESEARCH GATE');assert.match(html(s),/H1 open/);
  s.normalized.fields.effectState={value:[],freshness:'LIVE'};
  assert.match(html(s),/Preparation effects confirmed/);assert.ok(ui.buildView(s).missing.some(x=>x.field==='boosterMaxSeconds'));
  assert.doesNotMatch(html(s),/data-form="effects"/);
});
test('001K Beginner effective refill route keeps required current Points evidence visible',()=>{
  const current=state({energy:10,pointsAvailable:35,pointRefill:{allowed:true,fillAmountPolicy:'natural_max',pointsRequired:30}});
  current.freshness.points=current.freshness.pointRefill='LIVE';
  const s=snapshot(recommendation({observedState:current,preferences:{objective:'MAXIMUM_GAIN',allowItems:false,allowRefill:true}}));
  s.effectivePlan=option(s,'USE_REFILL').plan;s.preferences.allowRefill=false;
  s.normalized.fields.points={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.pointRefill={value:null,reason:'DATA_MISSING'};
  assert.match(html(s),/data-form="points"/);assert.ok(ui.buildView(s).missing.some(x=>x.field==='points'));
  assert.ok(ui.buildView(s).missing.some(x=>x.field==='pointRefill'));
});
test('001K Advanced keeps full applicable evidence despite Beginner route suppression',()=>{
  const s=snapshot(recommendation({preferences:{objective:'BALANCED',allowItems:false}}));
  s.preferences.allowItems=s.preferences.allowRefill=false;
  s.normalized.fields.effectState={value:null,reason:'DATA_MISSING'};
  s.normalized.fields.points={value:null,reason:'DATA_MISSING'};
  assert.doesNotMatch(html(s),/data-form="effects"|data-form="points"/);
  const advanced=html(s,{tab:'Advanced'});assert.match(advanced,/data-form="effects"/);assert.match(advanced,/data-form="points"/);
  s.normalized.fields.effectState={value:[],freshness:'LIVE'};
  assert.match(html(s,{tab:'Advanced'}),/Preparation effects confirmed/);
});
test('001K no-safe-plan recovery retains current confirmation guidance without changing recommendation',()=>{
  const s=snapshot();s.effectivePlan=null;s.recommendation={status:'NO_SAFE_RECOMMENDATION',reason:'DATA_MISSING',primaryPlan:null};
  s.preferences.allowItems=s.preferences.allowRefill=true;
  s.normalized.fields.effectState={value:null,reason:'DATA_MISSING'};s.normalized.fields.points={value:null,reason:'DATA_MISSING'};
  const before=structuredClone(s),view=ui.buildView(s),text=html(s);
  assert.match(text,/No safe recommendation/);assert.match(text,/data-form="effects"/);assert.match(text,/data-form="points"/);
  assert.ok(view.missing.some(x=>x.field==='effectState'));assert.ok(view.missing.some(x=>x.field==='points'));
  assert.deepEqual(s,before);
});
