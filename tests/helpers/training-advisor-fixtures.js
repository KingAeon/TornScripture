'use strict';
const runtime=require('../../src/training-advisor-runtime.js');
const fixtures=require('../../docs/divine-knowledge/chapters/dq-train-001/ADAPTER-FIXTURES-001D.json');
const TIME=Date.parse('2026-09-30T21:00:00Z');
const key='SYNTHETIC_TEST_KEY';
function storage() {
  const map=new Map();return {map,getItem:key=>map.get(key) ?? null,
    setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
}
function responses() {
  const input=structuredClone(Object.assign({},...fixtures.cases.slice(0,5).map(f=>f.sources)));
  input.perks=Object.fromEntries(['faction','property','job','education','enhancer','book','stock','merit'].map(k=>[k,[]]));
  input.cooldowns={drug:0,booster:0};input.refills={energy:false,special_count:0};
  input.money={money:{points:35}};
  const page=(items)=>({inventory:{items,timestamp:1800000000},_metadata:{links:{next:null,prev:null},total:items.length}});
  input.drugInventory=page([{id:206,amount:5},{id:197,amount:1}]);
  input.boosterInventory=page([{id:366,amount:2}]);input.candyInventory=page([{id:37,amount:10}]);
  return input;
}
function harness({input=responses(),fail=[],storage:store=storage(),managedKey=key,fetchOverride}={}) {
  let clock=TIME;const requests=[],timers=new Map();let serial=0;
  const fetch=fetchOverride || (async(url,options)=>{
    requests.push({url,options});
    const u=new URL(url),name=Object.keys(runtime.SOURCES).find(n=>{
      const source=new URL('https://api.torn.com/v2'+runtime.SOURCES[n]);
      return source.pathname===u.pathname && source.searchParams.get('cat')===u.searchParams.get('cat');});
    return {ok:!fail.includes(name),status:fail.includes(name)?403:200,
      json:async()=>fail.includes(name)?{error:{code:16,error:key}}:structuredClone(input[name])};
  });
  const advisor=runtime.createAdvisor({fetch,storage:store,managedKey,now:()=>clock,
    setTimer:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimer:id=>timers.delete(id)});
  return {advisor,store,requests,timers,input,advance:ms=>{clock+=ms;},expire:()=>{for (const {fn} of [...timers.values()]) fn();}};
}
module.exports={harness,responses,storage,TIME,key};
