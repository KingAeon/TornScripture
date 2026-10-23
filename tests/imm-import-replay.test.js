const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runtime, trader, result, K, Element } = require('./helpers/imm-capture-harness.cjs');
const { hold, turn } = require('./helpers/imm-receipt-harness.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
const root = p => JSON.parse(p.memory.get(K.book));
const rows = p => Array.isArray(root(p)) ? root(p) : root(p).traders;
const saved = (p, id = 'a') => rows(p).find(t => (t.recordId || t.uuid || t.id) === id);
const feedback = p => p.elements.filter(e => e.id === 'tsimm-toast').at(-1)?.textContent || '';
const neighbors = ['tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1',
  'tornscripture-imm-unresolved-trade-journal-v1', 'tornscripture-imm-api-key-v1',
  'tornscripture-imm-api-key-profile-v1', 'tornscripture-imm-ledger-cleanup-backup-v1',
  'tornscripture-imm-inventory-v1'];

async function setup({ records = [trader()], wrapped = false } = {}) {
  const memory = new Map([[K.book, JSON.stringify(wrapped ? { futureRoot: { keep: 7 }, traders: records } : records)]]);
  const p = runtime({ memory, testMode: false, productionEvents: true });
  await p.ready; await turn(); await turn();
  const tasks = [], request = p.sandbox.navigator.locks.request;
  p.sandbox.navigator.locks.request = (...args) => { const task = request(...args); tasks.push(task); return task; };
  p.drain = async () => { await turn(); await Promise.allSettled(tasks); await turn(); };
  p.api._state.ledger = p.api.normalizeLedger({ lots: [{ id: 'lot', itemId: 1, itemName: 'Fixture Item',
    quantity: 10, remainingQuantity: 8, unitCost: 500 }], sales: [{ id: 'sale', tradeId: '777',
    counterparty: 'Unrelated Buyer', counterpartyId: 888, cashReceived: 2000, trackedCostBasis: 1000,
    realizedProfit: 1000, items: [{ itemId: 1, itemName: 'Fixture Item', quantity: 2,
      allocations: [{ lotId: 'lot', quantity: 2, unitCost: 500 }] }],
    receiptAudit: { rawText: 'original audit', items: [], totalValue: 2000 } }] });
  memory.set(K.ledger, JSON.stringify(p.api._state.ledger));
  for (const key of neighbors) memory.set(key, JSON.stringify({ sentinel: key, exact: ' keep bytes ' }));
  const guards = new Map([K.ledger, ...neighbors].map(key => [key, memory.get(key)]));
  p.check = () => { for (const [key, bytes] of guards) assert.equal(memory.get(key), bytes, key); };
  p.owner = runtime({ memory, clock: p.clock }); await p.owner.ready;
  return p;
}

async function capture(p, outcome = 'captured', id = 'a') {
  assert.equal(await p.owner.api.startSavedTraderCaptureCarousel('all', p.owner.api.normTraders().filter(t => t.id === id)), true);
  assert.equal(await p.owner.api.launchFavoriteCaptureCarousel(), true);
  const e = JSON.parse(p.memory.get(K.queue)).entries[0].envelope;
  p.clock.now += 1000;
  const evidence = { kind: 'weav3r-route', tornId: e.expectedTornId };
  if (outcome === 'explicitly_unavailable') evidence.statement = 'This trader is unavailable.';
  if (outcome === 'explicitly_empty') evidence.statement = 'This pricelist is empty.';
  if (outcome === 'parser_failure') evidence.recognizable = true;
  if (outcome === 'identity_mismatch') evidence.tornId++;
  if (outcome === 'timeout') p.clock.now = e.deadline;
  const value = result(e, { outcome, evidence, producedAt: p.clock.now, items: outcome === 'captured'
    ? [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1234 }] : [] });
  const notice = await p.owner.api.persistCaptureImport(value); assert.equal(notice.ok, true);
  await p.owner.api.continueFavoriteCaptureCarousel(notice); assert.equal(p.memory.has(K.queue), false);
  return value;
}

async function action(p, name, id = 'a') {
  await p.clickAction(name, undefined, id); await p.drain();
}
async function importRows(p, records) {
  p.sandbox.prompt = () => JSON.stringify(records); await action(p, 'traders-import');
}
function foreign(p, owner = 'a') {
  return { ...trader('c', 999, 'Different historical trader'),
    pricePageCaptureReceipts: copy(saved(p, owner).pricePageCaptureReceipts) };
}
function report(p) {
  p.alerts = []; p.reloads = 0;
  p.sandbox.alert = value => p.alerts.push(value); p.sandbox.location.reload = () => p.reloads++;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'TornScripture-IMM-Trader-Report.user.js'), 'utf8'), p.sandbox);
  p.report = async name => {
    const target = new Element(); target.dataset = { td: name, tsimmTraderId: 'a' };
    target.closest = selector => (name === 'open' && selector === '[data-tsimm-deals-open]')
      || (name !== 'open' && selector === '[data-td]') ? target : null;
    await Promise.all(p.events.click.map(fn => fn({ target, preventDefault() {}, stopPropagation() {} })));
    await p.drain();
  };
}

for (const expired of [false, true]) for (const owner of ['a', 'b']) test(`Q-M1 collision refuses before write: expired=${expired}, owner=${owner}`, async () => {
  const p = await setup({ records: [trader(), trader('b', 777, 'Other')], wrapped: true });
  await capture(p, 'captured', owner);
  if (expired) p.clock.now += 900001;
  const before = p.memory.get(K.book), writes = p.writes.length;
  const incoming = foreign(p, owner);
  assert.equal(incoming.pricePageLastCaptureReceipt, undefined);
  assert.equal(incoming.receiptLinkCompletions, undefined);
  await importRows(p, [incoming]);
  assert.equal(p.memory.get(K.book), before); assert.equal(p.writes.length, writes);
  assert.match(feedback(p), /colliding/); assert.doesNotMatch(feedback(p), /Imported/);
  p.sandbox.prompt = () => 'Usable note after rejected import'; await action(p, 'trader-journal-add', owner);
  assert.equal(saved(p, owner).relationshipJournal.at(-1).text, 'Usable note after rejected import');
  // Management remains usable once the existing provider retention permits it.
  p.clock.now += 900001;
  const withNote = p.memory.get(K.book); report(p); await p.report('open'); await p.report('disconnect');
  assert.equal(p.reloads, 1); assert.deepEqual(p.alerts, []);
  await p.report('undo'); assert.equal(p.reloads, 2); assert.equal(p.memory.get(K.book), withNote); p.check();
});

for (const malformed of ['terminal', 'duplicate-incoming', 'null-proof']) test('malformed import group rejects exact bytes: ' + malformed, async () => {
  const p = await setup(); await capture(p); const incoming = foreign(p);
  let list = [incoming];
  if (malformed === 'terminal') incoming.pricePageLastCaptureReceipt = copy(saved(p).pricePageLastCaptureReceipt);
  if (malformed === 'duplicate-incoming') list = [incoming, { ...incoming, id: 'd', userId: 1001 }];
  if (malformed === 'null-proof') incoming.pricePageCaptureReceipts = [null];
  const before = p.memory.get(K.book); await importRows(p, list);
  assert.equal(p.memory.get(K.book), before); assert.match(feedback(p), /evidence|collid/);
  assert.doesNotMatch(feedback(p), /Imported/); p.check();
});

for (const alias of ['id', 'recordId', 'uuid']) for (const marked of [false, true]) test(`legitimate distinct proof import preserves aliases and wrappers: ${alias}, marked=${marked}`, async () => {
  const p = await setup({ records: [trader('a', 2321305, 'Same')], wrapped: true }); await capture(p);
  const original = copy(saved(p)), incoming = trader('c', 999, 'Same');
  if (alias !== 'id') { incoming[alias] = 'c'; delete incoming.id; }
  incoming.unknown = { keep: 'future' }; incoming.pricingItems = copy(incoming.pricePageItems);
  incoming.pricingPageUrl = incoming.pricePageUrl; incoming.pricesCapturedAt = incoming.pricePageCapturedAt;
  incoming.pricePageCaptureReceipts = [{ runId: 'distinct-run', entryId: 'distinct-entry', attemptId: 'distinct-attempt', expiresAt: p.clock.now - 1 }];
  if (marked) incoming.receiptLinkCompletions = [{ armId: '1'.repeat(32), saleId: 'historical-sale',
    capturedAt: p.clock.now - 1000, armExpiresAt: p.clock.now + 1000, retainUntil: p.clock.now + 86401000,
    parsedCount: 1, sourceType: 'receipt-audit' }];
  await importRows(p, { traders: [incoming], importExtension: { future: true } });
  assert.equal(rows(p).length, 2); assert.deepEqual(saved(p), original);
  const added = saved(p, 'c'); assert.equal(added[alias], 'c'); assert.equal(added.userId, 999);
  assert.deepEqual(added.unknown, incoming.unknown); assert.deepEqual(root(p).futureRoot, { keep: 7 });
  for (const key of ['pricePageCaptureReceipts', 'pricingItems', 'pricingPageUrl', 'pricesCapturedAt']) assert.deepEqual(added[key], incoming[key]);
  if (marked) assert.deepEqual(added.receiptLinkCompletions, incoming.receiptLinkCompletions);
  assert.equal(added.pricePageLastOutcome, 'imported_unverified');
  assert.match(feedback(p), /Imported 1 traders/);
  const reader = runtime({ memory: p.memory, clock: p.clock }); await reader.ready;
  assert.equal(reader.api.tradeExitQuoteForTrader(added, { itemId: 1 }).historical, true);
  assert.equal(reader.api.singleItemTraderQuotes({ pageType: 'item listings', listingItemId: 1 }).some(q => q.trader?.userId === 999), false); p.check();
});

test('legitimate distinct terminal envelope stays intact on imported historical prices', async () => {
  const p = await setup(); await capture(p); const incoming = foreign(p), original = copy(saved(p));
  incoming.pricePageCaptureReceipts[0].runId = 'distinct-run';
  incoming.pricePageCaptureReceipts[0].entryId = 'distinct-entry';
  incoming.pricePageCaptureReceipts[0].attemptId = 'distinct-attempt';
  const receipt = incoming.pricePageCaptureReceipts[0];
  incoming.pricePageLastCaptureReceipt = { ...receipt, outcome: 'captured', envelope: {
    ...copy(original.pricePageLastCaptureReceipt.envelope), ...receipt,
    traderRecordId: 'c', expectedTornId: 999, sourceUrl: incoming.pricePageUrl,
  } };
  await importRows(p, [incoming]); assert.deepEqual(saved(p), original);
  assert.deepEqual(saved(p, 'c').pricePageLastCaptureReceipt, incoming.pricePageLastCaptureReceipt);
  assert.equal(saved(p, 'c').pricePageLastOutcome, 'imported_unverified'); assert.match(feedback(p), /Imported 1/); p.check();
});

for (const alias of ['recordId', 'uuid']) test('foreign proof collision cannot bypass raw identity alias ' + alias, async () => {
  const owner = trader(); owner[alias] = 'a'; delete owner.id;
  const p = await setup({ records: [owner], wrapped: true }); await capture(p);
  const incoming = foreign(p); incoming[alias] = 'c'; delete incoming.id;
  const before = p.memory.get(K.book); await importRows(p, { traders: [incoming] });
  assert.equal(p.memory.get(K.book), before); assert.match(feedback(p), /colliding/); p.check();
});

test('ordinary historical import without proof remains available and unverified', async () => {
  const p = await setup(); await capture(p, 'explicitly_unavailable'); const original = copy(saved(p));
  await importRows(p, [trader('c', 999, 'Historical')]); assert.deepEqual(saved(p), original);
  assert.equal(saved(p, 'c').pricePageLastOutcome, 'imported_unverified'); assert.match(feedback(p), /Imported 1/); p.check();
});

test('later bad row does not persist or report full batch success; deliberate valid prefix remains', async () => {
  const p = await setup(); await capture(p); const original = copy(saved(p));
  await importRows(p, [trader('d', 1001, 'A valid first row'), { ...foreign(p), name: 'Z colliding later row' }]);
  assert.deepEqual(saved(p), original); assert.ok(saved(p, 'd')); assert.equal(saved(p, 'c'), undefined);
  assert.match(feedback(p), /colliding/); assert.doesNotMatch(feedback(p), /Imported/); p.check();
});

for (const outcome of ['captured', 'explicitly_unavailable', 'explicitly_empty', 'parser_failure', 'identity_mismatch', 'timeout']) test('stale legitimate import retains full provider outcome: ' + outcome, async () => {
  const p = await setup(); const stale = copy(p.api._state.traders); await capture(p, outcome);
  const original = copy(saved(p)); stale[0].notes = 'legitimate imported note';
  await importRows(p, stale);
  const expected = { ...original, notes: 'legitimate imported note' };
  // Non-capture metadata is deliberately normalized by the existing upsert.
  for (const [key, value] of Object.entries(original)) if (key.startsWith('pricePage') || key === 'previousPricePageUrl') assert.deepEqual(saved(p)[key], value, key);
  assert.equal(saved(p).notes, expected.notes); assert.match(feedback(p), /Imported 1/); p.check();
});

for (const importFirst of [false, true]) for (const proof of [false, true]) for (const outcome of ['captured', 'explicitly_unavailable']) test(`native import/provider ordering: importFirst=${importFirst}, foreignProof=${proof}, ${outcome}`, async () => {
  const p = await setup(); await p.owner.api.startSavedTraderCaptureCarousel('all'); await p.owner.api.launchFavoriteCaptureCarousel();
  const e = JSON.parse(p.memory.get(K.queue)).entries[0].envelope, incoming = trader('c', 999, 'New historical trader');
  if (proof) incoming.pricePageCaptureReceipts = [{ runId: e.runId, entryId: e.entryId, attemptId: e.attemptId, expiresAt: e.expiresAt }];
  const barrier = await hold(p); p.clock.now += 1000; let importing, saving;
  const payload = result(e, outcome === 'captured' ? {} : { outcome, items: [], evidence: { kind: 'weav3r-route', tornId: e.expectedTornId, statement: 'This trader is unavailable.' } });
  if (importFirst) { importing = importRows(p, [incoming]); await turn(); saving = p.owner.api.persistCaptureImport(payload); }
  else { saving = p.owner.api.persistCaptureImport(payload); await turn(); importing = importRows(p, [incoming]); }
  barrier.release(); await barrier.task; const notice = await saving; assert.equal(notice.ok, true); await importing;
  assert.equal(saved(p).pricePageLastOutcome, outcome);
  assert.equal(saved(p).pricePageCaptureCount, outcome === 'captured' ? 8 : 7); assert.equal(saved(p).pricePageCaptureReceipts.length, 1);
  if (proof) { assert.equal(saved(p, 'c'), undefined); assert.match(feedback(p), /Finish or cancel/); }
  else { assert.ok(saved(p, 'c')); assert.equal(saved(p, 'c').pricePageLastOutcome, 'imported_unverified'); }
  await p.owner.api.continueFavoriteCaptureCarousel(notice);
  assert.equal((await p.owner.api.persistCaptureImport(payload)).ok, false); p.check();
});

test('waiting stale import validates the freshly reread post-capture book', async () => {
  const p = await setup(), barrier = await hold(p); const incoming = trader('c', 999, 'New historical trader');
  const fresh = [trader('b', 777, 'New owner')]; fresh[0].pricePageCaptureReceipts = [{ runId: 'fresh', entryId: 'fresh-entry', attemptId: 'fresh-attempt', expiresAt: p.clock.now + 1 }];
  incoming.pricePageCaptureReceipts = copy(fresh[0].pricePageCaptureReceipts);
  const importing = importRows(p, [incoming]); await turn();
  // Simulate a noncooperating storage replacement while the ordinary writer waits.
  p.memory.set(K.book, JSON.stringify(fresh)); barrier.release(); await barrier.task; await importing;
  assert.equal(p.memory.get(K.book), JSON.stringify(fresh)); assert.equal(saved(p, 'c'), undefined);
  assert.match(feedback(p), /colliding/); p.check();
});

for (const mode of ['missing', 'null', 'denied', 'pagehide', 'visibility', 'timeout']) test('import lock ' + mode + ' fails closed', async () => {
  const p = await setup(); const before = p.memory.get(K.book); let barrier;
  if (mode === 'missing') p.sandbox.navigator.locks = undefined;
  else if (mode === 'null') p.sandbox.navigator.locks.request = (_, __, fn) => Promise.resolve(fn(null));
  else if (mode === 'denied') p.sandbox.navigator.locks.request = () => Promise.reject(Error('denied'));
  else barrier = await hold(p);
  const importing = importRows(p, [trader('c', 999, 'New historical trader')]); await turn();
  if (mode === 'pagehide') p.fireEvent('pagehide');
  if (mode === 'visibility') { p.document.hidden = true; p.fireEvent('visibilitychange'); }
  if (mode === 'timeout') { const timer = [...p.timers.values()].find(t => t.delay === 5000); assert.ok(timer); timer.fn(); }
  if (barrier) { barrier.release(); await barrier.task; }
  await importing; assert.equal(p.memory.get(K.book), before); assert.doesNotMatch(feedback(p), /Imported/);
  assert.match(feedback(p), /coordination unavailable or interrupted/); p.check();
});

test('changed prewrite storage snapshot rejects without overwriting the replacement', async () => {
  const p = await setup(), storage = p.sandbox.localStorage, get = storage.getItem;
  const replacement = JSON.stringify([trader('b', 777, 'Replacement')]); let reads = 0;
  storage.getItem = key => { if (key === K.book && ++reads === 2) p.memory.set(K.book, replacement); return get(key); };
  await importRows(p, [trader('c', 999, 'New historical trader')]);
  assert.equal(p.memory.get(K.book), replacement); assert.match(feedback(p), /storage changed/); p.check();
});

for (const fault of ['set', 'readback', 'rollback']) test('import persistence ' + fault + ' reports failure and preserves provider proof', async () => {
  const p = await setup(); await capture(p); const before = p.memory.get(K.book), original = copy(saved(p));
  const storage = p.sandbox.localStorage, get = storage.getItem, set = storage.setItem;
  if (fault === 'set') p.faults.set = K.book;
  if (fault === 'readback') { p.faults.readback = K.book; p.faults.readbackOnce = true; }
  if (fault === 'rollback') {
    let attempted = false;
    storage.setItem = (key, value) => { if (key === K.book) { if (attempted) throw Error('rollback failed'); attempted = true; } set(key, value); };
    storage.getItem = key => { if (key === K.book && attempted) throw Error('unreadable'); return get(key); };
  }
  await importRows(p, [trader('c', 999, 'New historical trader')]); assert.deepEqual(saved(p), original);
  assert.match(feedback(p), fault === 'rollback' ? /indeterminate/ : /persistence failed/);
  assert.doesNotMatch(feedback(p), /Imported/);
  if (fault !== 'rollback') assert.equal(p.memory.get(K.book), before);
  storage.getItem = get; storage.setItem = set; p.faults.set = null; p.faults.readback = null;
  // An indeterminate write may already contain the legitimate row; never erase it to retry.
  await importRows(p, [trader('c', 999, 'New historical trader')]);
  assert.equal(rows(p).filter(t => t.id === 'c').length, 1); assert.deepEqual(saved(p), original); assert.match(feedback(p), /Imported 1/); p.check();
});

for (const corrupt of ['collision', 'terminal', 'null']) test('preexisting malformed book rejects import and preserves raw export: ' + corrupt, async () => {
  const p = await setup(); await capture(p); const raw = root(p);
  if (corrupt === 'collision') raw.push(foreign(p));
  if (corrupt === 'terminal') raw[0].pricePageLastCaptureReceipt.envelope.expectedTornId++;
  if (corrupt === 'null') raw[0].pricePageCaptureReceipts = [null];
  p.memory.set(K.book, JSON.stringify(raw)); const before = p.memory.get(K.book);
  await importRows(p, [trader('d', 1001, 'Valid historical trader')]); assert.equal(p.memory.get(K.book), before);
  assert.doesNotMatch(feedback(p), /Imported/); let exported;
  p.sandbox.navigator.clipboard = { async writeText(value) { exported = value; } }; await action(p, 'traders-copy');
  assert.deepEqual(JSON.parse(exported).traders, raw); assert.equal(p.memory.get(K.book), before); p.check();
});

test('ordinary add and edit upserts cannot bypass the same admission guard', async () => {
  const p = await setup(); await capture(p); const original = copy(saved(p));
  let answers = ['New trader', '999', '4', '99', 'new note']; p.sandbox.prompt = () => answers.shift();
  await action(p, 'trader-add'); assert.equal(rows(p).length, 2); assert.deepEqual(saved(p), original);
  const id = rows(p).find(t => t.userId === 999).id;
  answers = ['Renamed trader', '999', '5', '98', 'edited note']; await action(p, 'trader-edit', id);
  assert.equal(saved(p, id).notes, 'edited note'); assert.deepEqual(saved(p), original);
  // A preexisting collision is refused by non-import upserts too, with no ledger linking.
  const raw = root(p); raw.push(foreign(p)); p.memory.set(K.book, JSON.stringify(raw)); const before = p.memory.get(K.book);
  answers = ['Another trader', '1001', '4', '99', 'blocked note']; await action(p, 'trader-add');
  assert.equal(p.memory.get(K.book), before); assert.match(feedback(p), /colliding/); p.check();
});
