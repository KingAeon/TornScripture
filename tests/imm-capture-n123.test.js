const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime, start, result, trader, K, Element } = require('./helpers/imm-capture-harness.cjs');
const prices = [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }];
const q = memory => memory.has(K.queue) ? JSON.parse(memory.get(K.queue)) : null;
const tick = () => new Promise(resolve => setImmediate(resolve));
const urlFor = (p, payload) => 'https://www.torn.com/index.php?tsimmPriceImport=' +
  Buffer.from(JSON.stringify(p.api.compactPriceCaptureResult(payload))).toString('base64url');
async function held(p) {
  let release, enter;
  const entered = new Promise(resolve => { enter = resolve; });
  const done = p.nativeLocks.request(p.lockName, {mode:'exclusive'}, () => {
    enter(); return new Promise(resolve => {release = resolve;});
  });
  await entered; return {release, done};
}
function sentinels(memory) {
  const keys = [K.ledger, 'tornscripture-imm-pending-purchase-v1',
    'tornscripture-imm-pending-trade-sale-v1', 'tornscripture-imm-trade-journal-v1',
    'tornscripture-imm-receipt-audits-v1', 'tornscripture-imm-api-key-v1'];
  for (const key of keys) if (!memory.has(key)) memory.set(key, JSON.stringify({sentinel:key}));
  const original = new Map(keys.map(key => [key,memory.get(key)]));
  return () => {for (const [key, bytes] of original) assert.equal(memory.get(key),bytes,key);};
}

for (const boundary of ['after-validation','immediately-before-B-write']) {
  test('Former V1-01 '+boundary+': granted Retry excludes Cancel until its B decision', async () => {
    const {torn,memory}=await start();const other=runtime({memory,clock:torn.clock});
    const check=sentinels(memory);let cancel, injected=false, reads=0, heldNow=false;
    torn.sandbox.navigator.locks={request:(_,opts,cb)=>torn.nativeLocks.request(torn.lockName,opts,lock=>{
      heldNow=true;try{return cb(lock);}finally{heldNow=false;}
    })};
    const get=torn.sandbox.localStorage.getItem.bind(torn.sandbox.localStorage);
    const set=torn.sandbox.localStorage.setItem.bind(torn.sandbox.localStorage);
    function inject(){assert.equal(heldNow,true);injected=true;cancel=other.api.cancelFavoriteCaptureCarousel();assert.equal(q(memory).status,'launched');}
    torn.sandbox.localStorage.getItem=key=>{if(boundary==='after-validation'&&key===K.queue&&++reads===2&&!injected)inject();return get(key);};
    torn.sandbox.localStorage.setItem=(key,value)=>{if(boundary==='immediately-before-B-write'&&key===K.queue&&!injected)inject();assert.equal(heldNow,true);set(key,value);};
    torn.window.location.assign=value=>{assert.equal(heldNow,true);assert.equal(q(memory).entries[0].attemptsUsed,2);torn.navigations.push(value);};
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(),true);assert.equal(injected,true);
    await cancel;assert.equal(memory.has(K.queue),false);assert.equal(await torn.api.launchFavoriteCaptureCarousel(),false);
    assert.equal(torn.navigations.length,2);check();
  });
}
test('Former V1-01: completed Cancel ahead of a queued Retry prevents any B',async()=>{
  const {torn,memory}=await start();const other=runtime({memory,clock:torn.clock});const hold=await held(torn);
  const cancel=other.api.cancelFavoriteCaptureCarousel(),retry=torn.api.launchFavoriteCaptureCarousel();
  await tick();hold.release();await hold.done;await cancel;assert.equal(await retry,false);
  assert.equal(memory.has(K.queue),false);assert.equal(torn.navigations.length,1);
});
test('Waiting Cancel cannot retarget a newer run; waiting capture cannot import into it',async()=>{
  const {torn,memory,envelope}=await start();torn.clock.now+=1000;
  let allow;const barrier=new Promise(resolve=>{allow=resolve;});
  const delayed=runtime({memory,clock:torn.clock,locks:{request:async(_,opts,cb)=>{await barrier;return torn.nativeLocks.request(torn.lockName,opts,cb);}}});
  const cancel=delayed.api.cancelFavoriteCaptureCarousel(),capture=delayed.api.persistCaptureImport(result(envelope));
  await tick();await torn.api.cancelFavoriteCaptureCarousel();await torn.api.startSavedTraderCaptureCarousel('all');
  const bytes=new Map(memory);allow();assert.equal(await cancel,false);assert.equal((await capture).ok,false);assert.deepEqual(memory,bytes);
});
for(const failure of ['absent','throwing-request','denied','null-grant','throwing-getter']){
  test('Independent '+failure+' locks reject every ordinary capture/control without mutation',async()=>{
    const {torn,memory,envelope}=await start();torn.clock.now+=1000;const bytes=new Map(memory);
    if(failure==='throwing-getter')Object.defineProperty(torn.sandbox.navigator,'locks',{get(){throw Error('fixture getter');}});
    else torn.sandbox.navigator.locks=failure==='absent'?null:{request:failure==='denied'?()=>Promise.reject(Error('denied')):failure==='null-grant'?(_,__,cb)=>Promise.resolve(cb(null)):()=>{throw Error('fixture request');}};
    assert.equal((await torn.api.persistCaptureImport(result(envelope))).ok,false);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(),false);assert.equal(await torn.api.skipCurrentCaptureCarousel(),false);
    assert.equal(await torn.api.cancelFavoriteCaptureCarousel(),false);assert.equal(await torn.api.startSavedTraderCaptureCarousel('all'),false);
    assert.deepEqual(memory,bytes);assert.equal(torn.navigations.length,1);
  });
}
for(const interruption of ['pagehide','visibility','five-second-acquisition-timeout']){
  test('Independent waiter '+interruption+' rejects without late grant side effects',async()=>{
    const {torn,memory,envelope}=await start();torn.clock.now+=1000;const hold=await held(torn),bytes=new Map(memory);
    const page=runtime({memory,clock:torn.clock});const pending=page.api.persistCaptureImport(result(envelope));await tick();
    if(interruption==='pagehide')page.fireEvent('pagehide');
    else if(interruption==='visibility'){page.document.hidden=true;page.fireEvent('visibilitychange');}
    else {const [id,timer]=[...page.timers].find(([,t])=>t.delay===5000);page.timers.delete(id);timer.fn();}
    assert.equal((await pending).ok,false);hold.release();await hold.done;await tick();assert.deepEqual(memory,bytes);
    assert.equal(page.navigations.length,0);assert.equal([...page.timers.values()].filter(t=>t.delay===5000).length,0);
  });
}
test('Independent rollback holds exclusion through failed readback and restoration',async()=>{
  const {torn,memory,envelope}=await start();torn.clock.now+=1000;const original=memory.get(K.book);let inside=false,restored=false;
  torn.sandbox.navigator.locks={request:(_,opts,cb)=>torn.nativeLocks.request(torn.lockName,opts,lock=>{inside=true;try{return cb(lock);}finally{inside=false;}})};
  const set=torn.sandbox.localStorage.setItem.bind(torn.sandbox.localStorage);
  torn.sandbox.localStorage.setItem=(key,value)=>{assert.equal(inside,true);if(key===K.book&&value===original)restored=true;set(key,value);};
  torn.faults.readback=K.book;assert.equal((await torn.api.persistCaptureImport(result(envelope))).ok,false);
  assert.equal(restored,true);assert.equal(memory.get(K.book),original);assert.equal(torn.navigations.length,1);
});
test('Independent document-start valid return waits for exclusion and stops boot after replace',async()=>{
  const {torn,memory,envelope}=await start();torn.clock.now+=1000;const hold=await held(torn);
  const page=runtime({memory,clock:torn.clock,url:urlFor(torn,result(envelope)),testMode:false});await tick();
  assert.equal(page.api,undefined);assert.equal(page.writes.length,0);assert.equal(page.navigations.length,0);
  hold.release();await hold.done;await page.ready;assert.equal(page.writes.filter(([key])=>key===K.book).length,1);
  assert.equal(page.navigations.length,1);assert.equal(page.window.__TSIMM_WATCHLIST_API__,undefined);
});
test('Independent ordinary test bootstrap initializes synchronously without requiring locks',async()=>{
  const page=runtime({locks:null});assert.equal(page.window.__TSIMM_WATCHLIST_API__.status().version,'0.19.41');
  assert.equal(page.api.normalizeTrader(trader()).id,'a');await page.ready;assert.equal(page.writes.length,0);
});
for(const price of ['', 'N/A', '1e3', '$1,23', '25 items', 'Infinity']){
  test('Former V1-02 cell '+JSON.stringify(price)+' cannot use quantity or ID',async()=>{
    const saved=trader();saved.pricePageUrl='https://tornexchange.com/prices/VladBull';const {torn,memory}=await start([saved]);
    const page=runtime({url:torn.navigations[0],name:torn.window.name,clock:torn.clock,items:prices});
    const table=page.document.querySelectorAll('table')[0],header=table.querySelector('thead tr'),row=table.querySelectorAll('tbody tr')[0];
    header.selectors['th,td'].push(new Element('Quantity'),new Element('Item ID'));
    row.children[1].textContent=price;for(const number of ['25','123']){const cell=new Element(number);cell.tagName='TD';row.children.push(cell);}
    const before=JSON.parse(memory.get(K.book))[0],payload=page.api.captureProviderAndReturn('tornexchange',true);
    assert.equal(payload.outcome,'parser_failure');await torn.api.persistCaptureImport(payload);
    const after=JSON.parse(memory.get(K.book))[0];for(const key of ['pricePageItems','pricePageCapturedAt','pricePageUrl','pricePageCaptureCount'])assert.deepEqual(after[key],before[key]);
  });
}
test('Independent duplicate Buy Price columns reject authority',()=>{
  const page=runtime({url:'https://tornexchange.com/prices/VladBull',items:prices});
  const table=page.document.querySelectorAll('table')[0];table.querySelector('thead tr').selectors['th,td'].push(new Element('Buy Price'));
  const cell=new Element('$100000');cell.tagName='TD';table.querySelectorAll('tbody tr')[0].children.push(cell);
  assert.equal(page.api.captureTornExchangePriceItems().length,0);
  assert.equal(page.api.providerPageOutcome('tornexchange',[],page.api.providerIdentityEvidence('tornexchange')).outcome,'parser_failure');
});
test('Former V1-03 actual dock re-renders same selected quote success/failure/success',()=>{
  const saved={...trader(),pricePageLastOutcome:'captured'};const memory=new Map([[K.book,JSON.stringify([saved])]]),page=runtime({memory});
  const overlay=page.document.createElement('section');overlay.id='tornscripture-imm-trader-deals-addon';
  overlay.selectors['.td-head strong']=[new Element('> VladBull_DEALS')];const row=new Element();row.selectors['.td-row-title strong']=[new Element('Fixture Item')];overlay.selectors['.td-row']=[row];
  for(const [outcome,price]of [['captured',500],['explicitly_unavailable',650],['captured',700]]){
    memory.set(K.book,JSON.stringify([{...saved,pricePageLastOutcome:outcome,pricePageLastReason:outcome==='captured'?'':'Closed',pricePageItems:[{...prices[0],unitPrice:price}]}]));
    page.api.renderWatchDock();const html=page.document.getElementById('tsimm-watch-dock').innerHTML;assert.match(html,new RegExp('\\$'+price));assert.doesNotMatch(html,/This trader pays|BEST EXIT|buy below/i);
    assert.match(html,outcome==='captured'?/Captured indicative quote/:/Historical \/ not reverified/);
    if(outcome!=='captured'){assert.match(html,/last captured|last attempted/);assert.match(html,/traders-open/);}
  }
});
for(const identity of ['id','recordId','uuid']){
  test('Former V1-04 '+identity+' wrapper/receipt/Skip preserves precedence and accounting',async()=>{
    const raw=trader();delete raw.id;raw[identity]='a';const {torn,memory,envelope}=await start([raw]);
    memory.set(K.book,JSON.stringify({traders:[raw],keep:{unknown:true}}));const check=sentinels(memory);torn.clock.now+=1000;
    const notice=await torn.api.persistCaptureImport(result(envelope));assert.equal(notice.ok,true);assert.equal(notice.traderId,'a');
    assert.equal(await runtime({memory,clock:torn.clock}).api.skipCurrentCaptureCarousel(),true);assert.equal(memory.has(K.queue),false);
    assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].outcome,'captured');const saved=JSON.parse(memory.get(K.book));
    assert.deepEqual(saved.keep,{unknown:true});assert.equal(saved.traders[0][identity],'a');check();
  });
}
test('Independent ambiguous record identity rejects before price mutation',async()=>{
  const {torn,memory,envelope}=await start();torn.clock.now+=1000;memory.set(K.book,JSON.stringify([trader(),trader('b',9,'Other')].map(t=>({...t,recordId:'a'}))));
  const bytes=new Map(memory);assert.equal((await torn.api.persistCaptureImport(result(envelope))).ok,false);assert.deepEqual(memory,bytes);
});
test('Former V1-05 malformed/nonfinite lifetime preserved on all import routes',async()=>{
  for(const mutation of ['missing','nonfinite-json','numeric-string','future','inverted','expired','over-12h'])for(const mode of ['early','ordinary','direct','persist']){
    const {torn,memory,envelope}=await start();torn.clock.now+=1000;const queue=q(memory);
    if(mutation==='missing')delete queue.expiresAt;else if(mutation==='numeric-string')queue.expiresAt=String(queue.expiresAt);
    else if(mutation==='future')queue.startedAt=torn.clock.now+1;else if(mutation==='inverted')queue.expiresAt=queue.startedAt-1;
    else if(mutation==='expired')queue.expiresAt=torn.clock.now;else if(mutation==='over-12h')queue.expiresAt=queue.startedAt+43200001;
    if(mutation==='nonfinite-json')queue.expiresAt='NONFINITE_FIXTURE';
    let raw=JSON.stringify(queue);if(mutation==='nonfinite-json')raw=raw.replace('"NONFINITE_FIXTURE"','1e999');memory.set(K.queue,raw);
    const bytes=new Map(memory),payload=result(envelope);
    if(mode==='early')await runtime({memory,clock:torn.clock,url:urlFor(torn,payload),testMode:false}).ready;
    else if(mode==='ordinary'){torn.setUrl(urlFor(torn,payload));await torn.api.consumeImportedPriceCapture();}
    else if(mode==='direct')await torn.api.saveTraderPriceCapture(null,{captureResult:payload});else await torn.api.persistCaptureImport(payload);
    assert.deepEqual(memory,bytes,mutation+' '+mode);
  }
});

// Verbatim V1 assertions: red at d740a3b, maintained for the N1–N3 correction.
for(const outcome of ['captured','explicitly_empty','explicitly_unavailable','parser_failure','identity_mismatch']){
  test('N1 terminal '+outcome+' receipt must prevent Retry from issuing B',async()=>{
    const saved=trader();if(outcome==='parser_failure')saved.pricePageUrl='https://tornexchange.com/prices/VladBull';
    const {torn,memory,envelope}=await start([saved]);torn.clock.now+=1000;const check=sentinels(memory);
    const source=new URL(torn.navigations[0]);if(outcome==='identity_mismatch')source.pathname='/pricelist/9';
    const provider=runtime({url:source.href,name:torn.window.name,clock:torn.clock,
      items:['captured','parser_failure'].includes(outcome)?prices:[],
      statement:outcome==='explicitly_empty'?'This pricelist is empty.':outcome==='explicitly_unavailable'?'This trader is closed.':''});
    if(outcome==='parser_failure')provider.document.querySelectorAll('table')[0].querySelector('thead tr').selectors['th,td'][1].textContent='Quantity';
    const payload=provider.api.captureProviderAndReturn(envelope.provider,true);assert.equal(payload.outcome,outcome);
    const notice=await torn.api.persistCaptureImport(payload);assert.equal(notice.ok,true);const other=runtime({memory,clock:torn.clock});
    const launched=await other.api.launchFavoriteCaptureCarousel();const completes=await torn.api.continueFavoriteCaptureCarousel(notice);check();
    console.log('N1 observed',JSON.stringify({outcome,launched,attemptsUsed:q(memory)?.entries[0].attemptsUsed,delayedACompletes:completes,navigation:other.navigations.length}));
    assert.equal(launched,false,'A already has a committed terminal receipt; it cannot issue B');
  });
}
for(const field of ['runId','entryId','attemptId','traderRecordId']){
  test('N2 contradictory persisted envelope '+field+' must block every import path',async()=>{
    const observations=[];
    for(const mode of ['early','ordinary','direct','persist']){
      const {torn,memory,envelope}=await start();torn.clock.now+=1000;const queue=q(memory);queue.entries[0].envelope[field]='contradictory';memory.set(K.queue,JSON.stringify(queue));
      const before=memory.get(K.book),check=sentinels(memory),payload=result(envelope);
      if(mode==='early')await runtime({memory,clock:torn.clock,url:urlFor(torn,payload),testMode:false}).ready;
      else if(mode==='ordinary'){torn.setUrl(urlFor(torn,payload));await torn.api.consumeImportedPriceCapture();}
      else if(mode==='direct')await torn.api.saveTraderPriceCapture(null,{captureResult:payload});else await torn.api.persistCaptureImport(payload);
      check();observations.push({mode,mutated:memory.get(K.book)!==before});
    }
    console.log('N2 observed',field,JSON.stringify(observations));assert.equal(observations.some(x=>x.mutated),false,'Contradictory current envelope cannot authorize a price write');
  });
}
test('N3 first Cancel must close a supported session-only legacy queue',async()=>{
  const clock={now:Date.parse('2026-10-09T21:00:00Z')};
  const old={schemaVersion:3,id:'legacy-session-run',status:'launched',cursor:0,
    entries:[{traderId:'a',traderName:'VladBull',userId:2321305,pricePageUrl:'https://weav3r.dev/pricelist/2321305'}],startedAt:clock.now-1000,expiresAt:clock.now+43200000-1000};
  const session=new Map([[K.queue,JSON.stringify(old)]]),memory=new Map([[K.book,JSON.stringify([trader()])]]),page=runtime({memory,session,clock});
  assert.equal(page.api.peekFavoriteCaptureCarousel().status,'unverified');
  const cancel=await page.api.cancelFavoriteCaptureCarousel();console.log('N3 observed',JSON.stringify({cancel,sessionRetained:session.has(K.queue),localQueue:memory.has(K.queue)}));
  assert.equal(session.has(K.queue),false,'Cancel must work without a preliminary migration control');
});

// Additional bounded correction controls. All authority/queue methods above
// and below execute the full userscript under genuine native exclusion.
const terminalOutcomes = ['captured', 'explicitly_empty', 'explicitly_unavailable', 'parser_failure', 'identity_mismatch'];
async function terminalFixture(outcome, traders = null) {
  const saved = trader();
  if (outcome === 'parser_failure') saved.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
  const run = await start(traders || [saved]);
  run.torn.clock.now += 1000;
  const source = new URL(run.torn.navigations[0]);
  if (outcome === 'identity_mismatch') source.pathname = '/pricelist/9';
  const provider = runtime({ url: source.href, name: run.torn.window.name, clock: run.torn.clock,
    items: ['captured', 'parser_failure'].includes(outcome) ? prices : [],
    statement: outcome === 'explicitly_empty' ? 'This pricelist is empty.'
      : outcome === 'explicitly_unavailable' ? 'This trader is closed.' : '' });
  if (outcome === 'parser_failure') provider.document.querySelectorAll('table')[0]
    .querySelector('thead tr').selectors['th,td'][1].textContent = 'Quantity';
  const payload = provider.api.captureProviderAndReturn(run.envelope.provider, true);
  assert.equal(payload.outcome, outcome);
  const notice = await run.torn.api.persistCaptureImport(payload);
  assert.equal(notice.ok, true);
  return { ...run, notice, payload };
}
function protectedBytes(memory) {
  const keys = [K.ledger, 'tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1',
    'tornscripture-imm-unresolved-trade-journal-v1', 'tornscripture-imm-api-key-v1',
    'tornscripture-imm-api-key-profile-v1'];
  for (const key of keys) if (!memory.has(key)) memory.set(key, JSON.stringify({ preserved: key }));
  const bytes = new Map(keys.map(key => [key, memory.get(key)]));
  return () => { for (const [key, value] of bytes) assert.equal(memory.get(key), value, key); };
}

for (const outcome of terminalOutcomes) {
  test(`N1 ${outcome}: exact committed receipt recovers once after blocked Retry`, async () => {
    const { torn, memory, envelope, notice, payload } = await terminalFixture(outcome);
    const check = protectedBytes(memory), book = memory.get(K.book), queue = memory.get(K.queue);
    const other = runtime({ memory, clock: torn.clock });
    assert.equal(await other.api.launchFavoriteCaptureCarousel(), false);
    assert.equal(memory.get(K.queue), queue);
    assert.equal(q(memory).entries[0].attemptsUsed, 1);
    assert.equal(other.navigations.length, 0);
    assert.equal(await other.api.skipCurrentCaptureCarousel(), true);
    assert.equal(memory.has(K.queue), false);
    const summary = memory.get(K.result);
    assert.equal(JSON.parse(summary).outcomes[0].outcome, outcome);
    assert.equal(JSON.parse(summary).outcomes[0].attemptId, envelope.attemptId);
    assert.equal(await torn.api.continueFavoriteCaptureCarousel(notice), false);
    assert.equal((await torn.api.persistCaptureImport(payload)).ok, false);
    assert.equal(memory.get(K.book), book);
    assert.equal(memory.get(K.result), summary);
    check();
  });
}

test('N1 waiting Retry sees a terminal store that acquired exclusion ahead of it', async () => {
  const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
  const check = protectedBytes(memory), holder = await held(torn);
  const capture = torn.api.persistCaptureImport(result(envelope));
  const other = runtime({ memory, clock: torn.clock });
  const retry = other.api.launchFavoriteCaptureCarousel();
  await tick(); holder.release(); await holder.done;
  assert.equal((await capture).ok, true);
  assert.equal(await retry, false);
  assert.equal(q(memory).entries[0].attemptsUsed, 1);
  assert.equal(other.navigations.length, 0);
  assert.equal(await other.api.continueFavoriteCaptureCarousel(null), true);
  assert.equal(memory.has(K.queue), false); check();
});

for (const loose of ['pricePageLastOutcome', 'pricePageLastResult']) {
  test(`N1 loose ${loose} is not proof of a committed terminal receipt`, async () => {
    const { torn, memory } = await start();
    const raw = JSON.parse(memory.get(K.book)); raw[0][loose] = 'captured';
    memory.set(K.book, JSON.stringify(raw));
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), true);
    assert.equal(q(memory).entries[0].attemptsUsed, 2);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
    assert.equal(torn.navigations.length, 2);
  });
}

for (const mutation of ['missing-replay-record', 'wrong-expiry', 'wrong-provider', 'coerced-clock', 'nonterminal-outcome']) {
  test(`N1 ${mutation}: incomplete consumed receipt blocks Retry and permits explicit safe Skip`, async () => {
    const { torn, memory, payload } = await terminalFixture('captured');
    const raw = JSON.parse(memory.get(K.book)), receipt = raw[0].pricePageLastCaptureReceipt;
    if (mutation === 'missing-replay-record') raw[0].pricePageCaptureReceipts = [];
    else if (mutation === 'wrong-expiry') receipt.expiresAt += 1;
    else if (mutation === 'wrong-provider') receipt.envelope.provider = 'tornexchange';
    else if (mutation === 'coerced-clock') receipt.envelope.issuedAt = String(receipt.envelope.issuedAt);
    else receipt.outcome = 'retry_needed';
    memory.set(K.book, JSON.stringify(raw));
    const book = memory.get(K.book), check = protectedBytes(memory);
    assert.equal((await torn.api.persistCaptureImport(payload)).ok, false);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
    assert.equal(await torn.api.continueFavoriteCaptureCarousel(null), false);
    assert.equal(await torn.api.skipCurrentCaptureCarousel(), true);
    assert.equal(memory.get(K.book), book);
    assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].outcome, 'user_skipped');
    assert.equal(memory.has(K.queue), false); check();
  });
}

for (const elapsed of [1000, 900001]) {
  test(`N1 genuinely uncommitted A after ${elapsed}ms can still issue B once`, async () => {
    const { torn, memory, envelope } = await start(); torn.clock.now += elapsed;
    const check = protectedBytes(memory);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), true);
    const b = q(memory).entries[0];
    assert.equal(b.attemptsUsed, 2); assert.notEqual(b.attemptId, envelope.attemptId);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
    assert.equal((await torn.api.persistCaptureImport(result(envelope))).ok, false);
    assert.equal(torn.navigations.length, 2); check();
  });
}

test('N1 valid retry_needed A remains a nonterminal checkpoint with exactly one B', async () => {
  const { torn, memory, envelope } = await start(); torn.clock.now = envelope.deadline;
  const payload = result(envelope, { outcome: 'retry_needed', items: [], producedAt: envelope.deadline });
  const notice = await torn.api.persistCaptureImport(payload);
  assert.equal(notice.ok, true);
  const book = memory.get(K.book);
  assert.equal(await torn.api.continueFavoriteCaptureCarousel(notice), true);
  assert.equal(q(memory).entries[0].attemptsUsed, 2);
  assert.equal(await torn.api.continueFavoriteCaptureCarousel(notice), false);
  assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
  assert.equal(memory.get(K.book), book); assert.equal(torn.navigations.length, 2);
});

const envelopeFields = ['runId', 'entryId', 'attemptId', 'traderRecordId', 'intent', 'provider', 'sourceUrl',
  'expectedTornId', 'issuedAt', 'deadline', 'expiresAt'];
for (const field of envelopeFields) for (const mutation of ['missing', 'contradictory']) {
  test(`N2 raw envelope ${field} ${mutation}: all four write routes reject and preserve bytes`, async () => {
    for (const mode of ['early', 'ordinary', 'direct', 'persist']) {
      const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
      const raw = q(memory);
      if (mutation === 'missing') delete raw.entries[0].envelope[field];
      else raw.entries[0].envelope[field] = typeof envelope[field] === 'number' ? envelope[field] + 1 : 'contradictory';
      memory.set(K.queue, JSON.stringify(raw));
      const check = protectedBytes(memory), before = new Map(memory), payload = result(envelope);
      if (mode === 'early') await runtime({ memory, clock: torn.clock, url: urlFor(torn, payload), testMode: false }).ready;
      else if (mode === 'ordinary') { torn.setUrl(urlFor(torn, payload)); await torn.api.consumeImportedPriceCapture(); }
      else if (mode === 'direct') assert.equal((await torn.api.saveTraderPriceCapture(null, { captureResult: payload })).ok, false);
      else assert.equal((await torn.api.persistCaptureImport(payload)).ok, false);
      assert.deepEqual(memory, before, mode);
      assert.equal(torn.api.peekFavoriteCaptureCarousel().status, 'unverified');
      assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
      assert.deepEqual(memory, before); check();
    }
  });
}

for (const field of ['runId', 'entryId', 'attemptId', 'traderRecordId', 'issuedAt', 'deadline', 'expiresAt', 'expectedTornId']) {
  test(`N2 normalization cannot launder persisted ${field}`, async () => {
    const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
    const raw = q(memory), value = raw.entries[0].envelope[field];
    raw.entries[0].envelope[field] = typeof value === 'number' ? String(value) : ` ${value} `;
    memory.set(K.queue, JSON.stringify(raw));
    const bytes = new Map(memory);
    assert.equal(torn.api.peekFavoriteCaptureCarousel().status, 'unverified');
    assert.equal((await torn.api.persistCaptureImport(result(envelope))).ok, false);
    assert.equal(await torn.api.continueFavoriteCaptureCarousel(null), false);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
    assert.deepEqual(memory, bytes);
    assert.equal(await torn.api.skipCurrentCaptureCarousel(), true);
    assert.equal(memory.get(K.book), bytes.get(K.book));
    assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].outcome, 'user_skipped');
  });
}

for (const field of ['id', 'schemaVersion', 'cursor', 'currentTraderId', 'launchedAt', 'entryId', 'attemptId', 'traderId', 'userId', 'pricePageUrl', 'attemptsUsed']) {
  test(`N2 enclosing ${field} contradiction blocks before writes`, async () => {
    const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
    const raw = q(memory);
    const target = ['id', 'schemaVersion', 'cursor', 'currentTraderId', 'launchedAt'].includes(field) ? raw : raw.entries[0];
    const value = target[field]; target[field] = typeof value === 'number' ? String(value) : 'contradictory';
    memory.set(K.queue, JSON.stringify(raw));
    const bytes = new Map(memory);
    assert.equal((await torn.api.persistCaptureImport(result(envelope))).ok, false);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
    assert.deepEqual(memory, bytes);
  });
}

for (const outcome of terminalOutcomes) for (const field of ['runId', 'entryId', 'attemptId', 'traderRecordId']) {
  test(`N1/N2 committed ${outcome} with inconsistent ${field}: explicit recovery has no price/receipt write`, async () => {
    const { torn, memory, payload } = await terminalFixture(outcome);
    const raw = q(memory); raw.entries[0].envelope[field] = 'contradictory';
    memory.set(K.queue, JSON.stringify(raw));
    const check = protectedBytes(memory), before = new Map(memory), book = memory.get(K.book);
    assert.equal((await torn.api.persistCaptureImport(payload)).ok, false);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
    assert.equal(await torn.api.continueFavoriteCaptureCarousel(null), false);
    assert.deepEqual(memory, before);
    assert.equal(await torn.api.skipCurrentCaptureCarousel(), true);
    assert.equal(memory.has(K.queue), false);
    assert.equal(memory.get(K.book), book);
    assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].outcome, 'user_skipped');
    check();
  });
}

test('N2 malformed B can be skipped to the next trader without any third attempt', async () => {
  const { torn, memory } = await start([trader(), trader('next', 2, 'Next')]);
  assert.equal(await torn.api.launchFavoriteCaptureCarousel(), true);
  const raw = q(memory), b = raw.entries[0].attemptId;
  raw.entries[0].envelope.attemptId = 'contradictory'; memory.set(K.queue, JSON.stringify(raw));
  const book = memory.get(K.book);
  assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
  assert.equal(await torn.api.skipCurrentCaptureCarousel(), true);
  assert.equal(q(memory).cursor, 1); assert.equal(q(memory).entries[0].attemptsUsed, 2);
  assert.equal(q(memory).entries[0].attemptId, b);
  assert.equal(await torn.api.launchFavoriteCaptureCarousel(), true);
  assert.equal(q(memory).entries[1].attemptsUsed, 1);
  assert.equal(q(memory).entries[0].attemptsUsed, 2);
  assert.equal(memory.get(K.book), book); assert.equal(torn.navigations.length, 3);
});

function legacySessionFixture() {
  const clock = { now: Date.parse('2026-10-09T21:00:00Z') };
  const legacy = { schemaVersion: 3, id: 'legacy-session-run', status: 'launched', cursor: 0,
    entries: [{ traderId: 'a', traderName: 'VladBull', userId: 2321305, pricePageUrl: 'https://weav3r.dev/pricelist/2321305' }],
    startedAt: clock.now - 1000, expiresAt: clock.now + 43199000 };
  const session = new Map([[K.queue, JSON.stringify(legacy)]]);
  const memory = new Map([[K.book, JSON.stringify([trader()])]]);
  return { clock, legacy, session, memory, page: runtime({ memory, session, clock }) };
}

test('N3 first legacy Cancel occurs entirely under exclusion and never credits an attempt', async () => {
  const { page, memory, session } = legacySessionFixture();
  const book = memory.get(K.book), check = protectedBytes(memory); let inside = false;
  page.sandbox.navigator.locks = { request: (_, opts, cb) => page.nativeLocks.request(page.lockName, opts, lock => {
    inside = true; try { return cb(lock); } finally { inside = false; }
  }) };
  for (const storage of [page.sandbox.localStorage, page.sandbox.sessionStorage]) {
    for (const method of ['setItem', 'removeItem']) {
      const original = storage[method].bind(storage);
      storage[method] = (...args) => { assert.equal(inside, true); return original(...args); };
    }
  }
  await page.api.cancelFavoriteCaptureCarousel();
  assert.equal(session.has(K.queue), false); assert.equal(memory.has(K.queue), false);
  const summary = JSON.parse(memory.get(K.result));
  assert.equal(summary.runId, 'legacy-session-run'); assert.equal(summary.outcomes[0].attempted, false);
  assert.equal(summary.outcomes[0].outcome, 'canceled');
  assert.equal(memory.get(K.book), book); assert.equal(page.navigations.length, 0); check();
});

for (const replacement of ['different-run', 'same-run-migration']) {
  test(`N3 waiting session Cancel revalidates ${replacement} under exclusion`, async () => {
    const { page, memory, session, clock } = legacySessionFixture();
    let release; const barrier = new Promise(resolve => { release = resolve; });
    const waiting = runtime({ memory, session, clock, locks: { request: async (_, opts, cb) => {
      await barrier; return page.nativeLocks.request(page.lockName, opts, cb);
    } } });
    const cancel = waiting.api.cancelFavoriteCaptureCarousel(); await tick();
    if (replacement === 'different-run') {
      const other = runtime({ memory, clock });
      assert.equal(await other.api.startSavedTraderCaptureCarousel('all'), true);
      const bytes = new Map(memory), sessionBytes = new Map(session);
      release(); assert.equal(await cancel, false);
      assert.deepEqual(memory, bytes);
      for (const [key, value] of sessionBytes) assert.equal(session.get(key), value);
      assert.equal(session.size, sessionBytes.size + 1);
      assert.equal(JSON.parse(session.get(K.notice)).rejected, true);
      assert.notEqual(q(memory).id, 'legacy-session-run');
    } else {
      await page.api.activeFavoriteCaptureCarousel();
      assert.equal(q(memory).id, 'legacy-session-run');
      assert.equal(q(memory).entries[0].attemptsUsed, null);
      release(); await cancel;
      assert.equal(memory.has(K.queue), false); assert.equal(session.has(K.queue), false);
    }
  });
}

for (const failure of ['unavailable-locks', 'denied-locks', 'queue-write']) {
  test(`N3 legacy Cancel ${failure} preserves recoverable original storage`, async () => {
    const { page, memory, session } = legacySessionFixture();
    const bytes = new Map(memory), sessionQueue = session.get(K.queue);
    if (failure === 'unavailable-locks') page.sandbox.navigator.locks = null;
    else if (failure === 'denied-locks') page.sandbox.navigator.locks = { request: () => Promise.reject(Error('denied')) };
    else page.faults.set = K.queue;
    await page.api.cancelFavoriteCaptureCarousel();
    assert.deepEqual(memory, bytes); assert.equal(session.get(K.queue), sessionQueue);
    assert.equal(page.navigations.length, 0);
  });
}
