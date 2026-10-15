// N4/N5 independent 85-case fixture retained with unchanged assertions.
// Source: PR #139 issuecomment-6112233636; only its harness import is relocated.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {start,runtime,result,trader,K}=require('./helpers/imm-capture-harness.cjs');
const queue=m=>m.has(K.queue)?JSON.parse(m.get(K.queue)):null;
const tick=()=>new Promise(r=>setImmediate(r));
const protectedKeys=[K.ledger,'tornscripture-imm-pending-purchase-v1','tornscripture-imm-pending-trade-sale-v1','tornscripture-imm-unresolved-trade-journal-v1','tornscripture-imm-api-key-v1','tornscripture-imm-api-key-profile-v1'];
function guard(memory){for(const key of protectedKeys)if(!memory.has(key))memory.set(key,JSON.stringify({sentinel:key,exact:' preserved '}));const saved=new Map(protectedKeys.map(k=>[k,memory.get(k)]));return()=>{for(const[k,v]of saved)assert.equal(memory.get(k),v,k);};}
async function hold(p){let release,entered;const ready=new Promise(r=>entered=r);const done=p.nativeLocks.request(p.lockName,{mode:'exclusive'},()=>{entered();return new Promise(r=>release=r);});await ready;return{release,done};}
function importURL(p,payload){return'https://www.torn.com/index.php?tsimmPriceImport='+Buffer.from(JSON.stringify(p.api.compactPriceCaptureResult(payload))).toString('base64url');}
async function route(p,memory,payload,mode){if(mode==='early')await runtime({memory,clock:p.clock,url:importURL(p,payload),testMode:false}).ready;else if(mode==='ordinary'){p.setUrl(importURL(p,payload));await p.api.consumeImportedPriceCapture();}else if(mode==='direct')await p.api.saveTraderPriceCapture(null,{captureResult:payload});else await p.api.persistCaptureImport(payload);}
async function providerTerminal(outcome){const saved=trader();if(outcome==='parser_failure')saved.pricePageUrl='https://tornexchange.com/prices/VladBull';const run=await start([saved]);run.torn.clock.now+=1000;const u=new URL(run.torn.navigations[0]);if(outcome==='identity_mismatch')u.pathname='/pricelist/9';const provider=runtime({url:u.href,name:run.torn.window.name,clock:run.torn.clock,items:['captured','parser_failure'].includes(outcome)?[{itemId:1,itemName:'Fixture Item',unitPrice:1000}]:[],statement:outcome==='explicitly_empty'?'This pricelist is empty.':outcome==='explicitly_unavailable'?'This trader is closed.':''});if(outcome==='parser_failure')provider.document.querySelectorAll('table')[0].querySelector('thead tr').selectors['th,td'][1].textContent='Quantity';const payload=provider.api.captureProviderAndReturn(run.envelope.provider,true);assert.equal(payload.outcome,outcome);return{...run,payload};}

for(const outcome of ['captured','explicitly_empty','explicitly_unavailable','parser_failure','identity_mismatch'])for(const recovery of ['notice','lost-notice','Skip'])test(`Fresh N1 ${outcome} via ${recovery} with Retry waiting behind commit`,async()=>{const r=await providerTerminal(outcome);const check=guard(r.memory),lock=await hold(r.torn);const write=r.torn.api.persistCaptureImport(r.payload),other=runtime({memory:r.memory,clock:r.torn.clock}),retry=other.api.launchFavoriteCaptureCarousel();await tick();lock.release();await lock.done;const notice=await write;assert.equal(notice.ok,true);const book=r.memory.get(K.book);assert.equal(await retry,false);assert.equal(other.navigations.length,0);assert.equal(queue(r.memory).entries[0].attemptsUsed,1);if(recovery==='Skip')assert.equal(await other.api.skipCurrentCaptureCarousel(),true);else await other.api.continueFavoriteCaptureCarousel(recovery==='notice'?notice:null);assert.equal(r.memory.has(K.queue),false);assert.equal(JSON.parse(r.memory.get(K.result)).outcomes[0].outcome,outcome);assert.equal((await other.api.persistCaptureImport(r.payload)).ok,false);assert.equal(r.memory.get(K.book),book);check();});

for(const part of ['last-only','replay-only','bad-envelope','bad-outcome'])test(`Fresh partial committed receipt ${part} blocks Retry and permits queue-only Skip`,async()=>{const r=await providerTerminal('captured');assert.equal((await r.torn.api.persistCaptureImport(r.payload)).ok,true);const raw=JSON.parse(r.memory.get(K.book));if(part==='last-only')delete raw[0].pricePageCaptureReceipts;else if(part==='replay-only')delete raw[0].pricePageLastCaptureReceipt;else if(part==='bad-envelope')raw[0].pricePageLastCaptureReceipt.envelope.expectedTornId='2321305';else raw[0].pricePageLastCaptureReceipt.outcome='bogus';r.memory.set(K.book,JSON.stringify(raw));const before=new Map(r.memory),check=guard(r.memory);assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),false);assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(null),false);assert.equal((await r.torn.api.persistCaptureImport(r.payload)).ok,false);assert.equal(r.memory.get(K.queue),before.get(K.queue));assert.equal(await r.torn.api.skipCurrentCaptureCarousel(),true);assert.equal(r.memory.get(K.book),before.get(K.book));assert.equal(JSON.parse(r.memory.get(K.result)).outcomes[0].outcome,'user_skipped');check();});

const mutations={
 'status-ready':q=>q.status='ready','status-missing':q=>delete q.status,'status-null':q=>q.status=null,'status-trimmed':q=>q.status=' launched ',
 'entry-terminal':q=>q.entries[0].outcome='captured','cursor-negative':q=>q.cursor=-1,'cursor-fraction':q=>q.cursor=.5,'cursor-null':q=>q.cursor=null,
 'entry-count-zero':q=>q.entries[0].attemptsUsed=0,'entry-count-three':q=>q.entries[0].attemptsUsed=3,'entry-count-fraction':q=>q.entries[0].attemptsUsed=1.5,
 'launchedAt-null':q=>q.launchedAt=null,'expected-null':q=>q.entries[0].envelope.expectedTornId=null,'expected-boolean':q=>q.entries[0].envelope.expectedTornId=true,
 'source-object':q=>q.entries[0].envelope.sourceUrl={url:q.entries[0].envelope.sourceUrl},'provider-trimmed':q=>q.entries[0].envelope.provider=' weav3r ',
 'issued-null':q=>q.entries[0].envelope.issuedAt=null,'deadline-inverted':q=>q.entries[0].envelope.deadline=q.entries[0].envelope.issuedAt,
 'expiry-inverted':q=>q.entries[0].envelope.expiresAt=q.entries[0].envelope.issuedAt-1,'clock-future':q=>q.entries[0].envelope.issuedAt+=10000,
 'intent-object':q=>q.entries[0].envelope.intent={type:'carousel'},'runId-number':q=>q.entries[0].envelope.runId=42,
 'entry-null':q=>q.entries[0]=null,'envelope-array':q=>q.entries[0].envelope=[], 'entries-object':q=>q.entries={'0':q.entries[0]}
};
for(const [name,mutate]of Object.entries(mutations))test(`Fresh raw authority ${name} preserves all four import paths`,async()=>{for(const mode of ['early','ordinary','direct','persist']){const r=await start();r.torn.clock.now+=1000;const raw=queue(r.memory);mutate(raw);r.memory.set(K.queue,JSON.stringify(raw));const check=guard(r.memory),before=new Map(r.memory);await route(r.torn,r.memory,result(r.envelope),mode);assert.deepEqual(r.memory,before,mode);assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(null),false);assert.deepEqual(r.memory,before);check();}});

for(const field of ['runId','entryId','attemptId','traderRecordId','intent','provider','sourceUrl','expectedTornId','issuedAt','deadline','expiresAt'])test(`Fresh terminal receipt plus malformed ${field} is passive and safely recoverable`,async()=>{const r=await providerTerminal('captured');assert.equal((await r.torn.api.persistCaptureImport(r.payload)).ok,true);const raw=queue(r.memory);delete raw.entries[0].envelope[field];r.memory.set(K.queue,JSON.stringify(raw));const check=guard(r.memory),before=new Map(r.memory);assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),false);assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(null),false);assert.equal((await r.torn.api.persistCaptureImport(r.payload)).ok,false);assert.deepEqual(r.memory,before);await r.torn.api.cancelFavoriteCaptureCarousel();assert.equal(r.memory.has(K.queue),false);assert.equal(r.memory.get(K.book),before.get(K.book));check();});

test('Fresh valid lost A mints B once; delayed A and no C preserve bytes',async()=>{const r=await start();r.torn.clock.now+=900001;const check=guard(r.memory),book=r.memory.get(K.book);assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),true);const bytes=r.memory.get(K.queue);assert.equal(queue(r.memory).entries[0].attemptsUsed,2);assert.equal((await r.torn.api.persistCaptureImport(result(r.envelope))).ok,false);assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),false);assert.equal(r.memory.get(K.queue),bytes);assert.equal(r.memory.get(K.book),book);check();});
test('Fresh malformed B Skip preserves allowance and gives next trader A',async()=>{const r=await start([trader(),trader('next',2,'Next')]);assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),true);const raw=queue(r.memory);raw.entries[0].envelope.traderRecordId='next';r.memory.set(K.queue,JSON.stringify(raw));const check=guard(r.memory),book=r.memory.get(K.book);assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),false);assert.equal(await r.torn.api.skipCurrentCaptureCarousel(),true);assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),true);const q=queue(r.memory);assert.equal(q.entries[0].attemptsUsed,2);assert.equal(q.entries[1].attemptsUsed,1);assert.equal(q.entries[1].envelope.traderRecordId,'next');assert.equal(r.memory.get(K.book),book);check();});

function legacy(){const clock={now:Date.parse('2026-10-09T21:00:00Z')};const raw={schemaVersion:3,id:'session-v3',status:'launched',cursor:0,entries:[{traderId:'a',traderName:'VladBull',userId:2321305,pricePageUrl:'https://weav3r.dev/pricelist/2321305'}],startedAt:clock.now-1000,expiresAt:clock.now+43199000};const memory=new Map([[K.book,JSON.stringify([trader()])]]),session=new Map([[K.queue,JSON.stringify(raw)]]);const page=runtime({memory,session,clock});return{memory,session,clock,page};}
for(const fault of ['local-read','session-read','migration-readback','denied','null-grant','pagehide'])test(`Fresh session-only Cancel ${fault} retains recoverability and no late navigation`,async()=>{const r=legacy();const check=guard(r.memory),before=new Map(r.memory),session=r.session.get(K.queue);let lock;if(fault==='local-read')r.page.sandbox.localStorage.getItem=()=>{throw Error('unreadable local');};if(fault==='session-read')r.page.sandbox.sessionStorage.getItem=()=>{throw Error('unreadable session');};if(fault==='migration-readback')r.page.faults.readback=K.queue;if(fault==='denied')r.page.sandbox.navigator.locks={request:()=>Promise.reject(Error('denied'))};if(fault==='null-grant')r.page.sandbox.navigator.locks={request:(_,__,cb)=>Promise.resolve(cb(null))};if(fault==='pagehide')lock=await hold(r.page);const pending=r.page.api.cancelFavoriteCaptureCarousel();if(lock){await tick();r.page.fireEvent('pagehide');}await pending;if(lock){lock.release();await lock.done;await tick();}assert.deepEqual(r.memory,before);assert.equal(r.session.get(K.queue),session);assert.equal(r.page.navigations.length,0);check();});
for(const action of ['migrate','cancel','replace'])test(`Fresh session Cancel waiting behind another tab ${action}`,async()=>{const r=legacy(),lock=await hold(r.page);const peer=runtime({memory:r.memory,session:r.session,clock:r.clock});let first;if(action==='migrate')first=peer.api.activeFavoriteCaptureCarousel();else if(action==='cancel')first=peer.api.cancelFavoriteCaptureCarousel();else first=peer.api.startSavedTraderCaptureCarousel('all');const waiting=r.page.api.cancelFavoriteCaptureCarousel();await tick();lock.release();await lock.done;await first;await waiting;if(action==='replace'){// The new start is blocked by the supported same-session legacy run, not a replacement.
 assert.equal(r.memory.has(K.queue),false);
}else assert.equal(r.memory.has(K.queue),false);assert.equal(r.session.has(K.queue),false);assert.equal(r.page.navigations.length,0);});
test('Fresh separate-session replacement defeats delayed legacy Cancel under actual native lock',async()=>{const r=legacy(),lock=await hold(r.page),peer=runtime({memory:r.memory,clock:r.clock});const newer=peer.api.startSavedTraderCaptureCarousel('all');const cancel=r.page.api.cancelFavoriteCaptureCarousel();await tick();lock.release();await lock.done;assert.equal(await newer,true);const bytes=new Map(r.memory);assert.equal(await cancel,false);assert.deepEqual(r.memory,bytes);assert.equal(r.session.has(K.queue),true);assert.notEqual(queue(r.memory).id,'session-v3');});

// New contract failures: expected results stay fail-closed.
test('N4 contradictory ready/zero-count state must not reset an already-issued allowance',async()=>{const r=await providerTerminal('captured');assert.equal((await r.torn.api.persistCaptureImport(r.payload)).ok,true);const raw=queue(r.memory);raw.status='ready';raw.entries[0].attemptsUsed=0;r.memory.set(K.queue,JSON.stringify(raw));const check=guard(r.memory),first=r.envelope.attemptId;const reset=await r.torn.api.launchFavoriteCaptureCarousel();const second=queue(r.memory).entries[0].attemptId;const again=await r.torn.api.launchFavoriteCaptureCarousel();const third=queue(r.memory).entries[0].attemptId;console.log('N4 allowance',JSON.stringify({reset,again,distinctAttempts:new Set([first,second,third]).size,navigations:r.torn.navigations.length,persistedCount:queue(r.memory).entries[0].attemptsUsed}));check();assert.equal(reset,false);assert.equal(again,false);assert.equal(r.torn.navigations.length,1);});
for(const status of ['ready','missing','null','blank','trimmed-ready'])for(const committed of [false,true])test(`N4 ${status} status cannot launder an issued A, committed=${committed}`,async()=>{const r=await start();r.torn.clock.now+=1000;if(committed)assert.equal((await r.torn.api.persistCaptureImport(result(r.envelope))).ok,true);const raw=queue(r.memory);if(status==='missing')delete raw.status;else raw.status=status==='null'?null:status==='blank'?'':status==='trimmed-ready'?' ready ':'ready';r.memory.set(K.queue,JSON.stringify(raw));const check=guard(r.memory),before=new Map(r.memory),other=runtime({memory:r.memory,clock:r.torn.clock});const launched=await other.api.launchFavoriteCaptureCarousel();console.log('N4',JSON.stringify({status,committed,launched,navigation:other.navigations.length,attempts:queue(r.memory).entries[0].attemptsUsed}));check();assert.equal(launched,false,'Ready cannot mean unissued when a persisted attempt already exists');assert.deepEqual(r.memory,before);assert.equal(other.navigations.length,0);});
for(const field of ['runId','entryId','attemptId','traderRecordId'])test(`N4 ready plus contradictory ${field} must not mint valid B or write again`,async()=>{const r=await start();r.torn.clock.now+=1000;assert.equal((await r.torn.api.persistCaptureImport(result(r.envelope))).ok,true);const raw=queue(r.memory);raw.status='ready';raw.entries[0].envelope[field]='contradictory';r.memory.set(K.queue,JSON.stringify(raw));const check=guard(r.memory),book=r.memory.get(K.book),other=runtime({memory:r.memory,clock:r.torn.clock});const launched=await other.api.launchFavoriteCaptureCarousel();const issued=queue(r.memory).entries[0].envelope;other.clock.now+=1000;const second=await other.api.persistCaptureImport(result(issued,{items:[{itemId:1,itemName:'Fixture Item',unitPrice:2000}],producedAt:other.clock.now}));console.log('N4 laundering',JSON.stringify({field,launched,secondAccepted:second.ok,bookChanged:r.memory.get(K.book)!==book,attempts:queue(r.memory).entries[0].attemptsUsed}));check();assert.equal(launched,false);assert.equal(second.ok,false);assert.equal(r.memory.get(K.book),book);});
for(const recovery of ['notice','lost-notice','Skip'])test(`N5 filtered prior entry cannot credit the subsequent trader via ${recovery}`,async()=>{const r=await start([trader(),trader('b',2,'Beta'),trader('c',3,'Gamma')]);r.torn.clock.now+=1000;await r.torn.api.continueFavoriteCaptureCarousel(await r.torn.api.persistCaptureImport(result(r.envelope)));assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(),true);const b=queue(r.memory).entries[1].envelope;r.torn.clock.now+=1000;const notice=await r.torn.api.persistCaptureImport(result(b));assert.equal(notice.ok,true);const raw=queue(r.memory);raw.entries[0].traderName='';r.memory.set(K.queue,JSON.stringify(raw));const check=guard(r.memory),book=r.memory.get(K.book);if(recovery==='Skip')await r.torn.api.skipCurrentCaptureCarousel();else await r.torn.api.continueFavoriteCaptureCarousel(recovery==='notice'?notice:null);const summary=r.memory.has(K.result)?JSON.parse(r.memory.get(K.result)):null;console.log('N5',JSON.stringify({recovery,remaining:queue(r.memory),summary}));check();assert.equal(r.memory.get(K.book),book);const gamma=summary?.outcomes.find(x=>x.traderRecordId==='c');assert.notEqual(gamma?.outcome,'captured','Beta receipt cannot complete never-launched Gamma');assert.equal(r.memory.has(K.queue),true,'Gamma must remain unattempted and queued, or malformed raw queue preserved');});

// Deliberate raw-state cross product. All setup/issuance/receipts use production
// paths; only persisted corruption is injected, never an authority replacement.
async function betaReady() {
  const r = await start([trader('a', 1, 'Alpha'), trader('b', 2, 'Beta'), trader('c', 3, 'Gamma')]);
  r.torn.clock.now += 1000;
  assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(await r.torn.api.persistCaptureImport(result(r.envelope))), true);
  assert.equal(queue(r.memory).cursor, 1);
  return r;
}
const positionMutations = {
  none: () => {}, 'prior-name': q => q.entries[0].traderName = '',
  'current-name': q => q.entries[1].traderName = '', 'following-name': q => q.entries[2].traderName = '',
  'prior-null': q => q.entries[0] = null, 'current-null': q => q.entries[1] = null,
  'following-null': q => q.entries[2] = null,
};
for (const status of ['ready', 'launched', 'unverified']) for (const count of [0, 1, 2])
for (const envelope of ['absent', 'coherent', 'contradictory']) for (const committed of [false, true])
for (const [position, mutate] of Object.entries(positionMutations)) {
  test(`N4/N5 matrix ${status}/${count}/${envelope}/committed=${committed}/${position}`, async () => {
    const r = await betaReady(), ready = queue(r.memory);
    let issued, payload;
    if (envelope !== 'absent' || committed) {
      assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
      if (count === 2 && envelope !== 'absent') assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
      issued = queue(r.memory).entries[1].envelope;
      r.torn.clock.now += 1000; payload = result(issued);
      if (committed) assert.equal((await r.torn.api.persistCaptureImport(payload)).ok, true);
    }
    const raw = envelope === 'absent' ? ready : queue(r.memory);
    raw.status = status; raw.entries[1].attemptsUsed = count;
    if (envelope === 'contradictory') raw.entries[1].envelope.entryId = raw.entries[2].entryId;
    mutate(raw); r.memory.set(K.queue, JSON.stringify(raw));
    const check = guard(r.memory), before = new Map(r.memory), navigation = r.torn.navigations.length;
    const expected = !committed && ['none', 'prior-name', 'following-name'].includes(position)
      && ((status === 'ready' && count === 0 && envelope === 'absent')
        || (status === 'launched' && count === 1 && envelope === 'coherent'));
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), expected);
    if (!expected) {
      assert.deepEqual(r.memory, before); assert.equal(r.torn.navigations.length, navigation);
      if (payload) {
        // An exhausted valid B may still complete; exhausted Retry is not an
        // invalid result. This is separate from malformed-authority rejection.
        const finalB = status === 'launched' && count === 2 && envelope === 'coherent' && !committed
          && ['none', 'prior-name', 'following-name'].includes(position);
        const notice = await r.torn.api.persistCaptureImport(payload);
        assert.equal(notice.ok, finalB);
        if (finalB) {
          assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(notice), true);
          assert.equal(queue(r.memory).cursor, 2); assert.equal(queue(r.memory).entries[1].attemptsUsed, 2);
          assert.equal(queue(r.memory).entries[1].outcome, 'captured'); assert.equal(queue(r.memory).entries[2].attemptsUsed, 0);
          assert.equal(r.torn.navigations.length, navigation);
        } else assert.deepEqual(r.memory, before);
      }
    } else {
      const after = queue(r.memory);
      assert.equal(after.cursor, 1); assert.equal(after.entries.length, 3);
      assert.equal(after.entries[1].traderId, 'b'); assert.equal(after.entries[1].attemptsUsed, count + 1);
      assert.equal(after.entries[1].envelope.traderRecordId, 'b');
      assert.equal(after.entries[2].attemptsUsed, 0); assert.equal(r.torn.navigations.length, navigation + 1);
      if (count === 1) {
        const bytes = new Map(r.memory);
        assert.equal((await r.torn.api.persistCaptureImport(payload)).ok, false);
        assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false);
        assert.deepEqual(r.memory, bytes);
      }
      assert.equal(r.memory.get(K.book), before.get(K.book));
    }
    check();
  });
}

for (const recovery of ['notice', 'lost-notice', 'Skip', 'Cancel'])
for (const malformed of ['name', 'source', 'userId']) {
  test(`N5 prior ${malformed} retains all IDs/positions through ${recovery} and Gamma`, async () => {
    const r = await betaReady(); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    const b = queue(r.memory).entries[1].envelope; r.torn.clock.now += 1000;
    const notice = await r.torn.api.persistCaptureImport(result(b)); assert.equal(notice.ok, true);
    const raw = queue(r.memory); raw.entries[0][malformed === 'name' ? 'traderName' : malformed === 'source' ? 'pricePageUrl' : 'userId'] = null;
    r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), book = r.memory.get(K.book), prior = JSON.stringify(raw.entries[0]);
    if (recovery === 'Cancel') {
      await r.torn.api.cancelFavoriteCaptureCarousel();
      const summary = JSON.parse(r.memory.get(K.result));
      assert.equal(summary.totalQueued, 3); assert.deepEqual(summary.outcomes.map(e => e.traderRecordId), ['a', 'b', 'c']);
      assert.notEqual(summary.outcomes[2].outcome, 'captured'); assert.equal(summary.outcomes[2].attempted, false);
    } else {
      if (recovery === 'Skip') assert.equal(await r.torn.api.skipCurrentCaptureCarousel(), true);
      else assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(recovery === 'notice' ? notice : null), true);
      const next = queue(r.memory); assert.equal(next.cursor, 2); assert.equal(next.entries.length, 3);
      assert.equal(next.entries[1].outcome, 'captured'); assert.equal(next.entries[2].outcome, '');
      assert.equal(JSON.stringify(next.entries[0]), prior); assert.equal(next.entries[2].attemptsUsed, 0);
      assert.equal(r.memory.get(K.book), book);
      assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
      const c = queue(r.memory).entries[2].envelope; assert.equal(c.traderRecordId, 'c');
      r.torn.clock.now += 1000;
      assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(await r.torn.api.persistCaptureImport(result(c))), true);
      const summary = JSON.parse(r.memory.get(K.result)); assert.equal(summary.totalQueued, 3);
      assert.deepEqual(summary.outcomes.map(e => e.traderRecordId), ['a', 'b', 'c']);
      assert.deepEqual(summary.outcomes.map(e => e.outcome), ['captured', 'captured', 'captured']);
      assert.equal(summary.outcomes.every(e => e.attempted && e.attemptId), true);
    }
    check();
  });
}

for (const malformed of ['prior-null', 'current-null', 'following-null', 'duplicate-entry', 'duplicate-trader', 'missing-entry', 'cursor-string', 'cursor-fraction', 'cursor-negative', 'cursor-overflow']) {
  test(`N5 structural ${malformed} is passive; Cancel archives every original position`, async () => {
    const r = await betaReady(); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    const issued = queue(r.memory).entries[1].envelope; r.torn.clock.now += 1000;
    const raw = queue(r.memory);
    if (positionMutations[malformed]) positionMutations[malformed](raw);
    else if (malformed === 'duplicate-entry') raw.entries[0].entryId = raw.entries[1].entryId;
    else if (malformed === 'duplicate-trader') raw.entries[0].traderId = raw.entries[1].traderId;
    else if (malformed === 'missing-entry') delete raw.entries[0].entryId;
    else raw.cursor = malformed === 'cursor-string' ? '1' : malformed === 'cursor-fraction' ? 1.5 : malformed === 'cursor-negative' ? -1 : 4;
    r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), before = new Map(r.memory);
    const view = r.torn.api.peekFavoriteCaptureCarousel(); assert.equal(view.entries.length, 3); assert.equal(view.cursor, raw.cursor);
    assert.equal(view.status, 'unverified');
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false);
    assert.equal(await r.torn.api.continueFavoriteCaptureCarousel(null), false);
    assert.equal(await r.torn.api.skipCurrentCaptureCarousel(), false);
    assert.equal((await r.torn.api.persistCaptureImport(result(issued))).ok, false); assert.deepEqual(r.memory, before);
    await r.torn.api.cancelFavoriteCaptureCarousel(); assert.equal(r.memory.has(K.queue), false);
    assert.equal(JSON.parse(r.memory.get(K.result)).totalQueued, 3); assert.equal(r.memory.get(K.book), before.get(K.book)); check();
  });
}

for (const field of ['id', 'cursor', 'status', 'currentTraderId', 'currentTraderName', 'launchedAt', 'entryId', 'traderId', 'userId', 'pricePageUrl', 'attemptId', 'attemptsUsed', 'envelope', 'outcome']) {
  test(`N4 unissued ready raw ${field} is not normalized into A`, async () => {
    const r = await betaReady(), raw = queue(r.memory);
    const target = ['id', 'cursor', 'status', 'currentTraderId', 'currentTraderName', 'launchedAt'].includes(field) ? raw : raw.entries[1];
    const old = target[field]; target[field] = typeof old === 'number' ? String(old) : old === null ? [] : old === '' ? null : ' ' + old + ' ';
    r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), before = new Map(r.memory);
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false); assert.deepEqual(r.memory, before);
    assert.equal(r.torn.api.peekFavoriteCaptureCarousel().entries.length, 3); check();
  });
}

for (const state of ['ready', 'missing', 'null', 'blank', 'padded-ready']) for (const count of [0, 1, 2]) {
  test(`N4 issued ${count} plus ${state} offers queue-only Skip, then Gamma A`, async () => {
    const r = await betaReady(); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    if (count === 2) assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    const issued = queue(r.memory).entries[1].envelope; r.torn.clock.now += 1000;
    assert.equal((await r.torn.api.persistCaptureImport(result(issued))).ok, true);
    const raw = queue(r.memory); raw.entries[1].attemptsUsed = count;
    if (state === 'missing') delete raw.status; else raw.status = state === 'null' ? null : state === 'blank' ? '' : state === 'padded-ready' ? ' ready ' : state;
    r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), book = r.memory.get(K.book);
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false);
    assert.equal(await r.torn.api.skipCurrentCaptureCarousel(), true);
    const next = queue(r.memory); assert.equal(next.cursor, 2); assert.equal(next.entries[1].attemptsUsed, count);
    assert.equal(next.entries[1].envelope.attemptId, issued.attemptId); assert.equal(next.entries[1].outcome, 'user_skipped');
    assert.equal(next.entries[2].attemptsUsed, 0); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    assert.equal(queue(r.memory).entries[2].envelope.traderRecordId, 'c'); assert.equal(r.memory.get(K.book), book); check();
  });
}

for (const action of ['ready-corruption', 'prior-corruption', 'commit', 'cancel', 'replace']) {
  test(`N4/N5 waiting Retry cannot bypass ${action} ahead of its native grant`, async () => {
    const r = await betaReady(); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    const lock = await hold(r.torn), issued = queue(r.memory).entries[1].envelope; r.torn.clock.now += 1000;
    let first;
    if (action === 'commit') first = r.torn.api.persistCaptureImport(result(issued));
    else if (action === 'cancel' || action === 'replace') first = r.torn.api.cancelFavoriteCaptureCarousel();
    const peer = runtime({ memory: r.memory, clock: r.torn.clock }), waiting = peer.api.launchFavoriteCaptureCarousel();
    await tick();
    if (action === 'ready-corruption' || action === 'prior-corruption') {
      const raw = queue(r.memory); if (action === 'ready-corruption') raw.status = 'ready'; else raw.entries[0] = null;
      r.memory.set(K.queue, JSON.stringify(raw));
    }
    lock.release(); await lock.done; await first;
    if (action === 'replace') assert.equal(await r.torn.api.startSavedTraderCaptureCarousel('all'), true);
    assert.equal(await waiting, false); assert.equal(peer.navigations.length, 0);
  });
}

for (const missing of ['prior', 'current', 'following']) {
  test(`N5 v3 migration retains malformed ${missing} position and unknown usage`, async () => {
    const r = await betaReady(); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    const raw = queue(r.memory); raw.schemaVersion = 3;
    for (const entry of raw.entries) { delete entry.entryId; delete entry.attemptId; delete entry.attemptsUsed; delete entry.envelope; }
    raw.entries[missing === 'prior' ? 0 : missing === 'current' ? 1 : 2].traderName = '';
    r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), book = r.memory.get(K.book);
    const page = runtime({ memory: r.memory, clock: r.torn.clock }), migrated = await page.api.activeFavoriteCaptureCarousel();
    assert.equal(migrated.entries.length, 3); assert.equal(migrated.cursor, 1); assert.equal(migrated.entries[1].traderId, 'b');
    assert.equal(migrated.entries[1].attemptsUsed, null); assert.equal(migrated.entries[2].attemptsUsed, 0);
    assert.equal(await page.api.launchFavoriteCaptureCarousel(), false); assert.equal(await page.api.skipCurrentCaptureCarousel(), true);
    assert.equal(queue(r.memory).cursor, 2); assert.equal(queue(r.memory).entries.length, 3);
    assert.equal(await page.api.launchFavoriteCaptureCarousel(), missing !== 'following');
    if (missing !== 'following') assert.equal(queue(r.memory).entries[2].attemptsUsed, 1);
    assert.equal(r.memory.get(K.book), book); check();
  });
}

for (const fault of ['last-only', 'replay-only', 'outcome-only', 'coerced-envelope']) {
  test(`N4 summary cannot manufacture captured from ${fault} receipt authority`, async () => {
    const r = await start(); r.torn.clock.now += 1000;
    assert.equal((await r.torn.api.persistCaptureImport(result(r.envelope))).ok, true);
    const raw = queue(r.memory); raw.status = 'ready'; raw.entries[0].outcome = 'captured';
    r.memory.set(K.queue, JSON.stringify(raw)); const book = JSON.parse(r.memory.get(K.book));
    if (fault === 'last-only') delete book[0].pricePageCaptureReceipts;
    else if (fault === 'replay-only') delete book[0].pricePageLastCaptureReceipt;
    else if (fault === 'outcome-only') { delete book[0].pricePageLastCaptureReceipt; delete book[0].pricePageCaptureReceipts; }
    else book[0].pricePageLastCaptureReceipt.envelope.issuedAt = String(r.envelope.issuedAt);
    r.memory.set(K.book, JSON.stringify(book)); const before = r.memory.get(K.book), check = guard(r.memory);
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false);
    await r.torn.api.cancelFavoriteCaptureCarousel(); assert.equal(r.memory.get(K.book), before);
    assert.equal(JSON.parse(r.memory.get(K.result)).outcomes[0].outcome, 'legacy_unverified');
    assert.deepEqual(JSON.parse(r.memory.get(K.result)).completed, []); check();
  });
}

for (const value of ['0', null, false, -1, 'unknown']) {
  test(`N4 legacy coercible future count ${JSON.stringify(value)} never gains A through migration`, async () => {
    const r = await betaReady(); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    const raw = queue(r.memory); raw.schemaVersion = 3;
    for (const entry of raw.entries) { delete entry.envelope; delete entry.attemptId; delete entry.attemptsUsed; }
    raw.entries[2].attemptsUsed = value; r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), book = r.memory.get(K.book);
    assert.equal((await r.torn.api.activeFavoriteCaptureCarousel()).entries[2].attemptsUsed, null);
    assert.equal(await r.torn.api.skipCurrentCaptureCarousel(), true);
    const before = new Map(r.memory); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false);
    assert.deepEqual(r.memory, before); assert.equal(r.memory.get(K.book), book); check();
  });
}

for (const state of ['missing', null, '', ' ready ']) {
  test(`N4 malformed legacy status ${JSON.stringify(state)} remains byte-preserved until explicit Cancel`, async () => {
    const r = await start(); const raw = queue(r.memory); raw.schemaVersion = 3;
    if (state === 'missing') delete raw.status; else raw.status = state;
    r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), before = new Map(r.memory);
    assert.equal((await r.torn.api.activeFavoriteCaptureCarousel()).status, 'unverified');
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false); assert.deepEqual(r.memory, before);
    await r.torn.api.cancelFavoriteCaptureCarousel(); assert.equal(r.memory.has(K.queue), false);
    assert.equal(r.memory.get(K.book), before.get(K.book)); check();
  });
}

for (const routeMode of ['early', 'ordinary', 'direct', 'persist']) for (const position of ['prior-null', 'current-null', 'following-null']) {
  test(`N5 ${position} fails before ${routeMode} price writes and preserves raw bytes`, async () => {
    const r = await betaReady(); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), true);
    const issued = queue(r.memory).entries[1].envelope; r.torn.clock.now += 1000;
    const raw = queue(r.memory); positionMutations[position](raw); r.memory.set(K.queue, JSON.stringify(raw));
    const check = guard(r.memory), before = new Map(r.memory);
    await route(r.torn, r.memory, result(issued), routeMode); assert.deepEqual(r.memory, before); check();
  });
}

for (const field of ['traderId', 'entryId']) {
  test(`N5 malformed ${field} is not cleaned into retry identity by Cancel/summary`, async () => {
    const r = await betaReady(); const raw = queue(r.memory);
    raw.entries[1][field] = ' ' + raw.entries[1][field] + ' '; raw.failed = ['Beta'];
    raw.entries[1].outcome = 'timeout'; raw.entries[1].attemptsUsed = 1;
    r.memory.set(K.queue, JSON.stringify(raw)); const book = r.memory.get(K.book);
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false);
    await r.torn.api.cancelFavoriteCaptureCarousel();
    const summary = JSON.parse(r.memory.get(K.result)); assert.equal(summary.totalQueued, 3);
    assert.equal(summary.outcomes[1][field === 'traderId' ? 'traderRecordId' : 'entryId'], '');
    assert.equal(r.memory.get(K.book), book);
    if (field === 'traderId') assert.equal(await r.torn.api.retryFailedTraderCaptureCarousel(), false);
  });
}

test('N4 ready canonical route with a different Torn ID cannot spend an attempt or navigate', async () => {
  const r = await betaReady(), raw = queue(r.memory); raw.entries[1].pricePageUrl = 'https://weav3r.dev/pricelist/3';
  r.memory.set(K.queue, JSON.stringify(raw)); const check = guard(r.memory), before = new Map(r.memory), navigation = r.torn.navigations.length;
  assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false); assert.deepEqual(r.memory, before);
  assert.equal(r.torn.navigations.length, navigation); check();
});

test('N4 duplicate saved stable records cannot issue an uncommitted Retry', async () => {
  const r = await start(); r.memory.set(K.book, JSON.stringify([trader(), trader()]));
  const before = new Map(r.memory); assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false);
  assert.deepEqual(r.memory, before); assert.equal(r.torn.navigations.length, 1);
});

for (const field of ['pricePageUrl', 'userId', 'traderName']) {
  test(`N4 missing unissued ${field} remains visible/unverified without a normalization exception`, async () => {
    const r = await betaReady(), raw = queue(r.memory); delete raw.entries[1][field];
    r.memory.set(K.queue, JSON.stringify(raw)); const before = new Map(r.memory);
    assert.equal(r.torn.api.peekFavoriteCaptureCarousel().status, 'unverified');
    assert.equal(await r.torn.api.launchFavoriteCaptureCarousel(), false); assert.deepEqual(r.memory, before);
  });
}
