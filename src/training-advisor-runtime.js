'use strict';

// Acquisition and session control only. Calculation and normalization stay canonical.
const planner = require('./training-advisor-pure.js');
const adapters = require('./training-advisor-adapters.js');
const VERSION = '0.1.0';
const PREFS_KEY = 'tornscripture-training-settings-v1';
const API_KEY = 'tornscripture-training-api-key-v1';
const SOURCES = Object.freeze({bars:'/user/bars', cooldowns:'/user/cooldowns',
  battlestats:'/user/battlestats', userGym:'/user/gym', tornGyms:'/torn/gyms',
  perks:'/user/perks', refills:'/user/refills', money:'/user/money',
  drugInventory:'/user/inventory?cat=Drug', boosterInventory:'/user/inventory?cat=Booster',
  candyInventory:'/user/inventory?cat=Candy'});
const DEFAULTS = Object.freeze({objective:'BALANCED', targetStat:'strength',
  statAllocationMode:'TARGET_STAT', allowItems:true, allowRefill:false,
  maxWaitSeconds:0, riskPolicy:'ALLOW_SUPPORTED', pointLimit:30,
  prohibitedItems:[], ownedItemsOnly:true, mode:'beginner', theme:'Auto',
  collapsed:false, position:{x:12,y:100}});
const OBJECTIVES = Object.freeze({Balanced:'BALANCED', 'Biggest Gain':'MAXIMUM_GAIN',
  'Best Value':'BEST_VALUE', 'Stay Under Budget':'BUDGET_CAP',
  'Use What I Own':'USE_MY_INVENTORY', 'Train Soonest':'FASTEST_USEFUL'});
const clone = value => JSON.parse(JSON.stringify(value));
const validKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value.trim());
function preferences(input = {}) {
  const out = clone(DEFAULTS);
  if (!input || typeof input !== 'object') return out;
  if (Object.values(OBJECTIVES).includes(input.objective)) out.objective=input.objective;
  if (['strength','speed','defense','dexterity'].includes(input.targetStat)) out.targetStat=input.targetStat;
  for (const key of ['allowItems','allowRefill','ownedItemsOnly','collapsed'])
    if (typeof input[key] === 'boolean') out[key]=input[key];
  for (const key of ['budgetNewCash','pointValue','pointLimit','maxWaitSeconds'])
    if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key]>=0) out[key]=input[key];
  if (['CALIBRATED_ONLY','ALLOW_SUPPORTED','ALLOW_EXPERIMENTAL'].includes(input.riskPolicy)) out.riskPolicy=input.riskPolicy;
  if (['beginner','advanced'].includes(input.mode)) out.mode=input.mode;
  if (['Auto','Dark','Light'].includes(input.theme)) out.theme=input.theme;
  if (Array.isArray(input.prohibitedItems)) out.prohibitedItems=[...new Set(input.prohibitedItems
    .filter(key=>Object.values(adapters.ITEM_REGISTRY).some(item=>item.key===key)))];
  if (Number.isFinite(input.position?.x) && Number.isFinite(input.position?.y)) out.position={x:input.position.x,y:input.position.y};
  return out;
}
function loadPreferences(storage) {
  try { return preferences(JSON.parse(storage.getItem(PREFS_KEY) || 'null')); }
  catch { return preferences(); }
}
function resolveKey(managed, storage) {
  if (validKey(managed)) return managed.trim();
  try { const value=storage.getItem(API_KEY); return validKey(value) ? value.trim() : ''; }
  catch { return ''; }
}
// Do not follow an API-supplied URL blindly: neither keys nor redirects may leave Torn.
function requestUrl(source, pageLink) {
  if (!Object.values(SOURCES).includes(source)) throw new Error('UNAPPROVED_SOURCE');
  const expected=new URL('https://api.torn.com/v2'+source);
  const url=pageLink ? new URL(pageLink,expected) : expected;
  if (url.origin!==expected.origin || url.pathname!==expected.pathname || url.username || url.password ||
      url.hash || url.searchParams.get('cat')!==expected.searchParams.get('cat')) throw new Error('UNAPPROVED_PAGE');
  for (const key of url.searchParams.keys()) if (!['cat','offset','limit','comment'].includes(key))
    throw new Error('UNAPPROVED_PAGE');
  url.searchParams.set('comment','TornScripture Training Advisor');
  if (source.includes('/inventory')) { if (!url.searchParams.has('limit')) url.searchParams.set('limit','100'); }
  return url;
}
function pageIdentity(link, source) {
  const url=requestUrl(source,link);
  url.searchParams.delete('comment');
  url.searchParams.sort();
  return url.href;
}
function unwrap(key,payload) {
  if (key==='cooldowns') return payload.cooldowns ?? payload;
  if (key==='perks') return payload.perks ?? payload;
  if (key==='refills') return payload.refills ?? payload;
  if (key==='battlestats') return payload.battlestats ?? payload;
  if (key==='tornGyms') return payload.gyms ?? payload;
  return payload;
}
function countdown(seconds, observedAt, now) {
  if (!Number.isFinite(seconds) || !Number.isFinite(Date.parse(observedAt))) return 'Unknown; refresh';
  const remaining=Math.max(0,Math.ceil(seconds-(now-Date.parse(observedAt))/1000));
  return remaining ? `${remaining}s observed wait; refresh at checkpoint` : 'Refresh now; countdown is not current proof';
}
function createAdvisor({fetch:fetcher, storage, managedKey='', now=()=>Date.now(),
  setTimer=setTimeout, clearTimer=clearTimeout, liveWindowMs=60_000} = {}) {
  let prefs=loadPreferences(storage), epoch=0, inFlight=null, expiry=null, invalidation=0, keyRevision=0, disposed=false;
  let raw={}, meta={}, normalized=null, recommendation=null, phase='NEEDS_REFRESH', startedAt=null, completedAt=null;
  let inventoryConfirmation, manualInput, effectState, pointsConfirmation;
  const cache=new Map(), subscribers=new Set(), pendingRequests=new Map();
  const iso=()=>new Date(now()).toISOString();
  const clearExpiry=()=>{if (expiry!=null) clearTimer(expiry); expiry=null;};
  const current=()=>phase==='CURRENT' && completedAt!=null &&
    now()-Date.parse(startedAt)<liveWindowMs;
  function snapshot() {
    // A suspended browser timer is never a reason to retain execution authority.
    if (phase==='CURRENT' && !current()) invalidate();
    const value={version:VERSION, epoch, phase, startedAt, completedAt, atomic:false,
      preferences:prefs, normalized, recommendation, acquisition:meta,
      connection:resolveKey(managedKey,storage) ? validKey(managedKey) ? 'TornPDA managed key' : 'Local browser key' : 'Not connected'};
    const key=resolveKey(managedKey,storage);
    const serialized=JSON.stringify(value);
    return JSON.parse(key ? serialized.split(key).join('[REDACTED]') : serialized);
  }
  const notify=()=>{for (const listener of subscribers) listener(snapshot());};
  function replan() {
    normalized=adapters.normalizeTrainingSources({sources:raw,sourceMeta:meta,
      targetStat:prefs.targetStat, manualInput, dynamicState:effectState,
      confirmedInventory:inventoryConfirmation,currentPoints:pointsConfirmation});
    // A rejected/incomplete cache is a meaningful reason to reacquire on the next manual refresh.
    if (normalized.fields.gym.reason==='SCHEMA_MISMATCH') cache.delete('tornGyms');
    for (const [name,category] of [['drugInventory','Drug'],['boosterInventory','Booster'],['candyInventory','Candy']])
      if (!normalized.inventory[category].complete) cache.delete(name);
    // H1/H2 are intentionally absent. A local clock or a calendar candidate is not proof.
    recommendation=planner.recommend({...normalized,preferences:{...prefs,maxWaitHours:prefs.maxWaitSeconds/3600}});
    notify(); return snapshot();
  }
  function invalidate() {
    invalidation++; clearExpiry(); inventoryConfirmation=manualInput=effectState=pointsConfirmation=undefined;
    for (const [key,value] of Object.entries(meta)) if (!key.endsWith('Inventory') && key!=='tornGyms')
      value.freshness=value.requestSucceeded ? 'STALE' : 'UNKNOWN';
    phase=inFlight ? 'REFRESHING' : 'NEEDS_REFRESH';
    return replan();
  }
  function requireCurrent() {
    if (!current()) {invalidate(); throw new Error('Refresh & Plan before current confirmation');}
  }
  async function request(source,key,pageLink) {
    const controller=new AbortController();
    const timeout=setTimer(()=>controller.abort(),15_000);
    pendingRequests.set(controller,timeout);
    try {
      const response=await fetcher(requestUrl(source,pageLink).href,{method:'GET',
        headers:{Accept:'application/json',Authorization:`ApiKey ${key}`},
        credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      const payload=await response.json();
      if (!response.ok || payload?.error) {
        // Never retain server/free-text errors, which can echo credentials or request URLs.
        const code=Number(payload?.error?.code);
        const denied=response.status===401 || response.status===403 || [2,16].includes(code);
        throw new Error(denied ? 'CAPABILITY_UNAVAILABLE' : 'DATA_MISSING');
      }
      return payload;
    } finally {clearTimer(timeout);pendingRequests.delete(controller);}
  }
  async function acquire(name,key,revision) {
    const source=SOURCES[name], cached=cache.get(name), age=cached ? now()-cached.fetchedAt : Infinity;
    const ttl=name.endsWith('Inventory') ? 3600_000 : name==='tornGyms' ? 3600_000 : 0;
    if (ttl && cached?.revision===revision && age>=0 && age<ttl) return clone(cached.result);
    let result;
    try {
      let payload=await request(source,key), value=unwrap(name,payload);
      const observedAt=iso();
      if (name.endsWith('Inventory')) {
        const pages=[], seen=new Set();
        let link=null;
        for (let count=0;count<20;count++) {
          const id=pageIdentity(link || requestUrl(source).href,source);
          if (seen.has(id)) throw new Error('DATA_MISSING');
          seen.add(id);
          const links=payload?._metadata?.links;
          pages.push({...payload,pageId:id,_metadata:{...payload._metadata,
            ...(links ? {links:{prev:links.prev==null ? null : pageIdentity(links.prev,source),
              next:links.next==null ? null : pageIdentity(links.next,source)}} : {})}});
          if (!links?.next) break;
          link=links.next;
          if (count===19) throw new Error('DATA_MISSING');
          payload=await request(source,key,link);
        }
        value=pages;
      }
      result={value,meta:{sourceId:source,requestedSelection:source,requestSucceeded:true,
        observedAt,freshness:ttl ? 'FRESH' : 'LIVE',
        ...(name.endsWith('Inventory') && value[0]?.inventory?.timestamp!=null ?
          {sourceTimestamp:value[0].inventory.timestamp} : {})}};
      if (ttl && revision===keyRevision && !disposed) cache.set(name,{revision,fetchedAt:now(),result:clone(result)});
    } catch (error) {
      const permissionFailure=error?.message==='CAPABILITY_UNAVAILABLE';
      result={value:permissionFailure ? {status:'PERMISSION_DENIED'} : null,
        meta:{sourceId:source,requestedSelection:source,requestSucceeded:false,
          observedAt:iso(),freshness:'UNKNOWN',permissionFailure}};
    }
    return result;
  }
  function refresh() {
    if (disposed) return Promise.reject(new Error('Advisor disposed'));
    if (inFlight) return inFlight;
    clearExpiry(); epoch++; invalidation++;
    inventoryConfirmation=manualInput=effectState=pointsConfirmation=undefined;
    raw={}; meta={}; normalized=recommendation=null;
    phase='REFRESHING'; startedAt=iso(); completedAt=null;
    const token=invalidation, key=resolveKey(managedKey,storage), revision=keyRevision;
    // Defer work one microtask so concurrent callers share the same promise.
    inFlight=Promise.resolve().then(async()=>{
      await Promise.all(Object.entries(SOURCES).map(async([name,source])=>{
        const result=key ? await acquire(name,key,revision) : {value:{status:'PERMISSION_DENIED'},
          meta:{sourceId:source,requestedSelection:source,requestSucceeded:false,permissionFailure:true,
            observedAt:iso(),freshness:'UNKNOWN'}};
        raw[name]=result.value; meta[name]=result.meta;
      }));
      if (disposed) return snapshot();
      completedAt=iso(); phase=token===invalidation && now()-Date.parse(startedAt)<liveWindowMs ? 'CURRENT' : 'NEEDS_REFRESH';
      const points=raw.money?.money?.points;
      if (phase==='CURRENT' && meta.money.requestSucceeded && Number.isSafeInteger(points) && points>=0)
        pointsConfirmation={sourceId:SOURCES.money,confirmedCurrent:true,observedAt:meta.money.observedAt,
          freshness:'LIVE',value:points};
      if (phase!=='CURRENT') for (const [name,value] of Object.entries(meta))
        if (!name.endsWith('Inventory') && name!=='tornGyms' && value.requestSucceeded) value.freshness='STALE';
      replan();
      if (phase==='CURRENT') expiry=setTimer(()=>{expiry=null;invalidate();},
        Math.max(0,liveWindowMs-(now()-Date.parse(startedAt))));
      return snapshot();
    }).finally(()=>{inFlight=null;notify();});
    notify(); return inFlight;
  }
  return Object.freeze({refresh, invalidate, snapshot,
    subscribe(listener) {if (!disposed) subscribers.add(listener);return ()=>subscribers.delete(listener);},
    setPreferences(input) {
      const before=JSON.stringify(Object.fromEntries(Object.entries(prefs).filter(([key])=>
        !['mode','theme','position','collapsed'].includes(key))));
      prefs=preferences({...prefs,...input});
      try {storage.setItem(PREFS_KEY,JSON.stringify(prefs));} catch { /* memory-only still works */ }
      const after=JSON.stringify(Object.fromEntries(Object.entries(prefs).filter(([key])=>
        !['mode','theme','position','collapsed'].includes(key))));
      if (normalized && before!==after) {if (!current() && phase!=='REFRESHING') invalidate();else replan();} else notify();
      return snapshot();
    },
    setKey(value) {
      if (value && !validKey(value)) throw new Error('Enter a valid local key');
      if (value) storage.setItem(API_KEY,value.trim());else storage.removeItem(API_KEY);
      keyRevision++;cache.clear(); return invalidate();
    },
    confirmInventory(quantities) {
      requireCurrent();
      const required=recommendation?.primaryPlan?.resources?.ownedItemsConsumed || {};
      const accepted={};
      for (const [key,value] of Object.entries(quantities || {})) if (required[key]>0 &&
        Number.isSafeInteger(value) && value>=0) accepted[key]=value;
      // An explicit confirmation event replaces prior confirmation; cached quantities are never copied.
      inventoryConfirmation={sourceId:'PLAYER_CONFIRMED_INVENTORY',confirmedCurrent:true,
        observedAt:iso(),freshness:'LIVE',quantities:accepted};
      return replan();
    },
    confirmStats(stats) {
      requireCurrent(); manualInput={stats:clone(stats),confirmed:true,observedAt:iso(),freshness:'LIVE'};
      return replan();
    },
    confirmEffects(noOtherMaterialEffects) {
      requireCurrent(); effectState=noOtherMaterialEffects===true ? {effectsComplete:true,
        materialPreparationEffects:[],effectEvidence:{sourceId:'PLAYER_CONFIRMED_EFFECT_STATE',
          observedAt:iso(),freshness:'LIVE'}} : undefined;
      return replan();
    },
    confirmPoints(value) {
      requireCurrent(); pointsConfirmation={sourceId:'PLAYER_CONFIRMED_POINTS',confirmedCurrent:true,
        observedAt:iso(),freshness:'LIVE',value};return replan();
    },
    dispose() {
      disposed=true;invalidation++;phase='NEEDS_REFRESH';clearExpiry();
      inventoryConfirmation=manualInput=effectState=pointsConfirmation=undefined;
      for (const [controller,timeout] of pendingRequests) {clearTimer(timeout);controller.abort();}
      subscribers.clear();
    }
  });
}
module.exports={VERSION,PREFS_KEY,API_KEY,SOURCES,DEFAULTS,OBJECTIVES,preferences,
  loadPreferences,resolveKey,requestUrl,countdown,createAdvisor};
