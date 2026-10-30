const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { runtime, trader, result, K, Element } = require('./helpers/imm-capture-harness.cjs');
const { hold, turn } = require('./helpers/imm-receipt-harness.cjs');
const BACKUP = 'tornscripture-imm-trader-link-backup-v1';
const NEIGHBORS = ['tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1',
  'tornscripture-imm-unresolved-trade-journal-v1', 'tornscripture-imm-api-key-v1', 'tornscripture-imm-api-key-profile-v1',
  'tornscripture-imm-ledger-cleanup-backup-v1', 'tornscripture-imm-inventory-v1'];
const CAPTURE = ['pricePageUrl', 'previousPricePageUrl', 'pricePageProvider', 'pricePageTitle', 'pricePageItems',
  'pricePageCapturedAt', 'pricePageLastCheckedAt', 'pricePageLastOutcome', 'pricePageLastReason', 'pricePageCaptureCount',
  'pricePageAttemptCount', 'pricePageLastChangedCount', 'pricePageLastResult', 'pricePageCaptureReceipts',
  'pricePageLastCaptureReceipt', 'receiptLinkCompletions', 'pricesCapturedAt', 'pricingPageUrl', 'pricingItems', 'pricingPageTitle'];
const book = p => JSON.parse(p.memory.get(K.book));
const records = p => Array.isArray(book(p)) ? book(p) : book(p).traders;
const saved = (p, id = 'a') => records(p).find(t => (t.recordId || t.uuid || t.id) === id);
const copy = value => JSON.parse(JSON.stringify(value));
const feedback = p => p.elements.filter(e => e.id === 'tsimm-toast').map(e => e.textContent).at(-1) || '';
function assertCapture(actual, expected) { for (const key of CAPTURE) assert.deepEqual(actual[key], expected[key], key); }

async function setup({ traders = [trader()], wrapper = false } = {}) {
  const raw = traders.map(t => ({ ...t, unknown: { keep: true }, pricePageLastOutcome: 'captured' }));
  const memory = new Map([[K.book, JSON.stringify(wrapper ? { traders: raw, wrapperFuture: { keep: 7 } } : raw)]]);
  const p = runtime({ memory, testMode: false, productionEvents: true });
  await p.ready; await turn(); await turn();
  p.state = p.api._state; p.tasks = [];
  const request = p.sandbox.navigator.locks.request;
  p.sandbox.navigator.locks.request = (...args) => { const t = request(...args); p.tasks.push(t); return t; };
  p.drain = async () => { await turn(); await Promise.allSettled(p.tasks); await turn(); };
  p.state.ledger = p.api.normalizeLedger({ lots: [{ id: 'lot', itemId: 1, itemName: 'Fixture Item', quantity: 8,
    remainingQuantity: 6, unitCost: 100, capturedAt: '2026-10-01T12:00:00Z' }], sales: [{ id: 'sale', tradeId: '887766',
    counterparty: 'Unrelated Buyer', counterpartyId: 888, cashReceived: 500, trackedCostBasis: 200, realizedProfit: 300,
    items: [{ itemId: 1, itemName: 'Fixture Item', quantity: 2, allocations: [{ lotId: 'lot', quantity: 2, unitCost: 100 }] }],
    receiptAudit: { rawText: 'original audit', items: [], totalValue: 500 } }] });
  memory.set(K.ledger, JSON.stringify(p.state.ledger));
  for (const key of NEIGHBORS) memory.set(key, JSON.stringify({ sentinel: key, bytes: ' unchanged ' }));
  const guards = new Map([K.ledger, ...NEIGHBORS].map(key => [key, memory.get(key)]));
  p.check = () => { for (const [key, bytes] of guards) assert.equal(memory.get(key), bytes, key); };
  p.owner = runtime({ memory, clock: p.clock }); await p.owner.ready;
  p.sandbox.prompt = () => 'updated note';
  return p;
}

async function capture(p, outcome = 'captured', { early = false, finish = false, id = 'a' } = {}) {
  const choices = p.owner.api.normTraders().filter(t => t.id === id);
  assert.equal(await p.owner.api.startSavedTraderCaptureCarousel('all', choices), true);
  assert.equal(await p.owner.api.launchFavoriteCaptureCarousel(), true);
  const envelope = JSON.parse(p.memory.get(K.queue)).entries[0].envelope;
  p.clock.now += 1000;
  const evidence = { kind: 'weav3r-route', tornId: envelope.expectedTornId };
  if (outcome === 'explicitly_unavailable') evidence.statement = 'This trader is unavailable.';
  if (outcome === 'explicitly_empty') evidence.statement = 'This pricelist is empty.';
  if (outcome === 'parser_failure') evidence.recognizable = true;
  if (outcome === 'identity_mismatch') evidence.tornId = envelope.expectedTornId + 1;
  if (outcome === 'timeout') p.clock.now = envelope.deadline;
  const payload = result(envelope, { outcome, items: outcome === 'captured' ? undefined : [], evidence,
    producedAt: p.clock.now, reason: outcome === 'captured' ? '' : outcome });
  let notice;
  if (early) {
    const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(p.owner.api.compactPriceCaptureResult(payload))).toString('base64url');
    const page = runtime({ memory: p.memory, clock: p.clock, url }); await page.ready;
    assert.equal(page.navigations.length, 1); notice = null;
  } else { notice = await p.owner.api.persistCaptureImport(payload); assert.equal(notice.ok, true); }
  if (finish) await p.owner.api.continueFavoriteCaptureCarousel(notice);
  return payload;
}

async function edit(p, action, id = 'a') {
  if (action === 'import') {
    const raw = copy(p.state.traders); raw.find(t => t.id === id).notes = 'imported note';
    p.sandbox.prompt = () => JSON.stringify(raw); await p.clickAction('traders-import');
  } else if (action === 'roles') {
    const target = new Element(); target.dataset = { tsimmTraderId: id }; target.value = 'both';
    target.closest = selector => selector === '[data-tsimm-trader-role]' ? target : null;
    for (const callback of p.events.change) callback({ target });
  } else {
    if (action === 'trader-edit') {
      const old = p.state.traders.find(t => t.id === id), answers = [old.name, String(old.userId), '4', '98', 'reviewed note'];
      p.sandbox.prompt = () => answers.shift();
    }
    await p.clickAction(action, undefined, id);
  }
  await p.drain();
}

for (const outcome of ['captured', 'explicitly_unavailable']) for (const action of ['trader-journal-add', 'trader-edit', 'roles', 'trader-avoid', 'trader-hide', 'trader-restore', 'import']) {
  test(`metadata ${action} preserves newer ${outcome} capture and aliases`, async () => {
    const t = trader(); t.recordId = 'a'; t.id = 'legacy-other'; t.pricesCapturedAt = t.pricePageCapturedAt;
    t.pricingItems = copy(t.pricePageItems); t.pricingPageUrl = t.pricePageUrl;
    const p = await setup({ traders: [t], wrapper: true });
    const payload = await capture(p, outcome, { early: true }), before = copy(saved(p)), queue = p.memory.get(K.queue);
    await edit(p, action); assertCapture(saved(p), before);
    assert.equal(saved(p).recordId, 'a'); assert.equal(saved(p).id, 'legacy-other');
    assert.deepEqual(saved(p).unknown, { keep: true }); assert.deepEqual(book(p).wrapperFuture, { keep: 7 });
    assert.equal(p.memory.get(K.queue), queue); assert.equal((await p.owner.api.persistCaptureImport(payload)).ok, false);
    if (action === 'trader-journal-add') assert.equal(saved(p).relationshipJournal.at(-1).text, 'updated note');
    if (action === 'trader-edit') { assert.equal(saved(p).rating, 4); assert.equal(saved(p).notes, 'reviewed note'); }
    if (action === 'roles') assert.deepEqual(saved(p).relationshipRoles, ['buyer', 'supplier']);
    if (action === 'import') assert.equal(saved(p).notes, 'imported note');
    if (outcome !== 'captured') {
      const reader = runtime({ memory: p.memory, clock: p.clock }); await reader.ready;
      assert.equal(reader.api.tradeExitQuoteForTrader(saved(p), { itemId: 1 }).historical, true);
      assert.equal(reader.api.singleItemTraderQuotes({ pageType: 'item listings', listingItemId: 1 }).length, 0);
    }
    p.check();
  });
}

for (const outcome of ['explicitly_empty', 'parser_failure', 'identity_mismatch', 'timeout']) test('ordinary note preserves terminal ' + outcome, async () => {
  const p = await setup(); await capture(p, outcome); const before = copy(saved(p)); await edit(p, 'trader-journal-add');
  assertCapture(saved(p), before); p.check();
});

for (const editFirst of [true, false]) test('native exclusion orders metadata/capture: editFirst=' + editFirst, async () => {
  const p = await setup(), held = await hold(p);
  const start = p.owner.api.startSavedTraderCaptureCarousel('all'); held.release(); await held.task; await start;
  await p.owner.api.launchFavoriteCaptureCarousel(); const e = JSON.parse(p.memory.get(K.queue)).entries[0].envelope;
  const barrier = await hold(p); p.clock.now += 1000; let editing, saving;
  if (editFirst) { editing = edit(p, 'trader-journal-add'); await turn(); saving = p.owner.api.persistCaptureImport(result(e)); }
  else { saving = p.owner.api.persistCaptureImport(result(e)); await turn(); editing = edit(p, 'trader-journal-add'); }
  barrier.release(); await barrier.task; assert.equal((await saving).ok, true); await editing;
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(saved(p).pricePageCaptureReceipts.length, 1);
  assert.equal(saved(p).relationshipJournal.at(-1).text, 'updated note'); p.check();
});

function loadReport(p) {
  p.alerts = []; p.reloads = 0; p.sandbox.alert = text => p.alerts.push(text); p.sandbox.location.reload = () => p.reloads++;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'TornScripture-IMM-Trader-Report.user.js'), 'utf8'), p.sandbox);
  p.report = async (action, id = 'a') => {
    const target = new Element(); target.dataset = { td: action, tsimmTraderId: id };
    target.closest = selector => (action === 'open' && selector === '[data-tsimm-deals-open]')
      || (action !== 'open' && selector === '[data-td]') ? target : null;
    await Promise.all(p.events.click.map(fn => fn({ target, preventDefault() {}, stopPropagation() {} }))); await p.drain();
  };
}

for (const outcome of ['captured', 'explicitly_unavailable']) for (const expired of [false, true]) test(`provider-only Undo refuses newer ${outcome}, expired=${expired}`, async () => {
  const p = await setup({ traders: [trader(), trader('b', 123456, 'Other')] }); loadReport(p);
  await p.report('open'); await p.report('disconnect'); assert.equal(p.reloads, 1);
  const backup = p.memory.get(BACKUP); assert.equal(JSON.parse(backup).expectedAfter, p.memory.get(K.book));
  await capture(p, outcome, { id: 'b', finish: true });
  if (expired) p.clock.now += 900001;
  const before = p.memory.get(K.book); p.reloads = 0; await p.report('undo');
  assert.equal(p.memory.get(K.book), before); assert.equal(p.memory.get(BACKUP), backup);
  assert.equal(p.reloads, 0); assert.match(p.alerts.at(-1), /protected|proof|Undo refused/); p.check();
});

test('verified ordinary disconnect and Undo restore legacy data without intervening capture', async () => {
  const p = await setup({ wrapper: true }); loadReport(p); const before = p.memory.get(K.book);
  await p.report('open'); await p.report('disconnect'); assert.equal(saved(p).pricePageItems.length, 0);
  assert.equal(p.reloads, 1); assert.equal(JSON.parse(p.memory.get(BACKUP)).expectedAfter, p.memory.get(K.book));
  await p.report('undo'); assert.equal(p.memory.get(K.book), before); assert.equal(p.reloads, 2);
  assert.equal(p.memory.has(BACKUP), false); assert.deepEqual(p.alerts, []); p.check();
});

test('move after provider retention expiry keeps replay proof on its owner and marks moved prices historical', async () => {
  const p = await setup({ traders: [trader(), trader('b', 123456, 'Other')] }); await capture(p, 'captured', { finish: true });
  const proof = copy(saved(p).pricePageCaptureReceipts), last = copy(saved(p).pricePageLastCaptureReceipt); p.clock.now += 900001;
  loadReport(p); await p.report('open'); const target = new Element(); target.value = 'b';
  p.document.fixtureSelectors = { '#tornscripture-imm-trader-deals-addon [data-td-move-target]': target };
  await p.report('move'); assert.equal(p.reloads, 1); assert.deepEqual(p.alerts, []);
  assert.deepEqual(saved(p).pricePageCaptureReceipts, proof); assert.deepEqual(saved(p).pricePageLastCaptureReceipt, last);
  assert.equal(saved(p, 'b').pricePageCaptureReceipts, undefined); assert.equal(saved(p, 'b').pricePageLastOutcome, 'reassigned_unverified');
  assert.equal(saved(p, 'b').pricePageItems[0].unitPrice, 1000);
  const reader = runtime({ memory: p.memory, clock: p.clock }); await reader.ready;
  assert.equal(reader.api.tradeExitQuoteForTrader(saved(p, 'b'), { itemId: 1 }).historical, true);
  await p.report('undo'); assert.equal(saved(p).pricePageItems[0].unitPrice, 1000); assert.deepEqual(saved(p).pricePageCaptureReceipts, proof); p.check();
});

for (const action of ['move', 'disconnect']) test('live provider completion protects deliberate ' + action, async () => {
  const p = await setup({ traders: [trader(), trader('b', 123456, 'Other')] }); await capture(p, 'captured', { finish: true });
  loadReport(p); await p.report('open'); const target = new Element(); target.value = 'b';
  p.document.fixtureSelectors = { '#tornscripture-imm-trader-deals-addon [data-td-move-target]': target };
  const before = p.memory.get(K.book); await p.report(action);
  assert.equal(p.memory.get(K.book), before); assert.equal(p.reloads, 0); assert.match(p.alerts.at(-1), /protected/); p.check();
});

test('legacy backup without a verified postimage is retained and refused conservatively', async () => {
  const p = await setup(); p.memory.set(BACKUP, JSON.stringify({ root: book(p) })); loadReport(p);
  const before = p.memory.get(K.book), backup = p.memory.get(BACKUP); await p.report('undo');
  assert.equal(p.memory.get(K.book), before); assert.equal(p.memory.get(BACKUP), backup);
  assert.equal(p.reloads, 0); assert.match(p.alerts.at(-1), /legacy backup/); p.check();
});

for (const fault of ['set', 'readback']) test('metadata persistence ' + fault + ' restores exact bytes and reports no success', async () => {
  const p = await setup(); await capture(p); const before = p.memory.get(K.book); p.faults[fault] = K.book;
  if (fault === 'readback') p.faults.readbackOnce = true;
  await edit(p, 'trader-journal-add'); assert.equal(p.memory.get(K.book), before);
  assert.match(feedback(p), /persistence failed/); assert.doesNotMatch(feedback(p), /note added/); p.check();
});

for (const malformed of ['invalid-json', 'bad-replay', 'duplicate-replay', 'bad-terminal']) test('metadata rejects raw corrupt proof: ' + malformed, async () => {
  const p = await setup(); await capture(p); const raw = book(p);
  if (malformed === 'bad-replay') raw[0].pricePageCaptureReceipts = [null];
  if (malformed === 'duplicate-replay') raw[0].pricePageCaptureReceipts.push(copy(raw[0].pricePageCaptureReceipts[0]));
  if (malformed === 'bad-terminal') raw[0].pricePageLastCaptureReceipt.envelope.expectedTornId++;
  p.memory.set(K.book, malformed === 'invalid-json' ? 'invalid-json' : JSON.stringify(raw)); const before = p.memory.get(K.book);
  await edit(p, 'trader-journal-add'); assert.equal(p.memory.get(K.book), before); assert.doesNotMatch(feedback(p), /note added/); p.check();
});

test('import adds same-name distinct-ID historical trader without overwriting an existing capture', async () => {
  const p = await setup({ traders: [trader('a', 1, 'Same')] }); await capture(p, 'explicitly_unavailable'); const before = copy(saved(p));
  p.sandbox.prompt = () => JSON.stringify([trader('b', 2, 'Same')]); await p.clickAction('traders-import'); await p.drain();
  assert.equal(records(p).length, 2); assertCapture(saved(p), before); assert.equal(saved(p, 'b').userId, 2);
  assert.equal(saved(p, 'b').pricePageLastOutcome, 'imported_unverified'); p.check();
});

test('stale creation preserves unrelated newer records and stale edit cannot resurrect a deleted trader', async () => {
  const p = await setup(), raw = book(p); raw.push(trader('b', 123456, 'Other')); p.memory.set(K.book, JSON.stringify(raw));
  await edit(p, 'trader-journal-add'); assert.equal(records(p).length, 2);
  p.memory.set(K.book, JSON.stringify([saved(p, 'b')])); const before = p.memory.get(K.book);
  await edit(p, 'trader-journal-add'); assert.equal(p.memory.get(K.book), before); assert.match(feedback(p), /removed/); p.check();
});

for (const delta of [0, -1, 1, 86400000, -259200000, -259200001]) test('capture freshness and selection boundary ' + delta, async () => {
  const now = Date.parse('2026-10-09T21:00:00Z'), t = { ...trader(), pricePageCapturedAt: new Date(now + delta).toISOString() };
  const p = runtime({ memory: new Map([[K.book, JSON.stringify([t])]]) }); await p.ready;
  const expected = delta <= 0 && delta >= -259200000;
  assert.equal(p.api.traderCaptureFresh(p.api.normTraders()[0]), expected);
  assert.equal(p.api.savedTraderCaptureSelection().stale.length, expected ? 0 : 1);
  if (delta > 0) { assert.equal(p.api.traderCaptureHistorical(t), true); assert.equal(p.api.singleItemTraderQuotes({ pageType: 'item listings', listingItemId: 1 }).length, 0); }
});

test('bare existing trader accepts imported historical rows without importing provider authority', async () => {
  const t = trader(); t.pricePageItems = []; t.pricePageCapturedAt = null; t.pricePageLastCheckedAt = null;
  t.pricePageCaptureCount = 0; t.pricePageLastResult = '';
  const p = await setup({ traders: [t] }); const raw = book(p); delete raw[0].pricePageLastOutcome; p.memory.set(K.book, JSON.stringify(raw));
  p.sandbox.prompt = () => JSON.stringify([trader()]); await p.clickAction('traders-import'); await p.drain();
  assert.equal(saved(p).pricePageItems.length, 1); assert.equal(saved(p).pricePageLastOutcome, 'imported_unverified');
  assert.equal(saved(p).pricePageLastCaptureReceipt, undefined); assert.equal(saved(p).pricePageCaptureReceipts, undefined);
  const reader = runtime({ memory: p.memory, clock: p.clock }); await reader.ready;
  assert.equal(reader.api.tradeExitQuoteForTrader(saved(p), { itemId: 1 }).historical, true); p.check();
});

test('metadata note preserves newer roles, unrelated rows and concurrent journal entries', async () => {
  const p = await setup(), raw = book(p);
  raw[0].relationshipRoles = ['supplier']; raw[0].notes = 'other-tab note';
  raw[0].relationshipJournal = [{ id: 'other-note', text: 'other-tab journal', createdAt: new Date(p.clock.now).toISOString() }];
  p.memory.set(K.book, JSON.stringify(raw)); await edit(p, 'trader-journal-add');
  assert.deepEqual(saved(p).relationshipRoles, ['supplier']); assert.equal(saved(p).notes, 'other-tab note');
  assert.equal(saved(p).relationshipJournal.length, 2); p.check();
});

test('unambiguous numeric-only legacy identity can save metadata without rewriting its raw ID', async () => {
  const t = trader(); t.id = t.userId; delete t.userId;
  const p = await setup({ traders: [t] }); await edit(p, 'trader-journal-add', p.state.traders[0].id);
  assert.equal(records(p)[0].id, 2321305); assert.equal(records(p)[0].relationshipJournal.at(-1).text, 'updated note'); p.check();
});

test('uuid-only provider state and same-name profile rename preserve exact authority', async () => {
  const t = trader(); t.uuid = 'a'; delete t.id;
  const p = await setup({ traders: [t] }); await capture(p, 'captured'); const before = copy(saved(p));
  const answers = ['Renamed Trader', '2321305', '5', '99', 'profile note']; p.sandbox.prompt = () => answers.shift();
  await p.clickAction('trader-edit', undefined, 'a'); await p.drain();
  assertCapture(saved(p), before); assert.equal(saved(p).uuid, 'a'); assert.equal(saved(p).id, undefined);
  assert.equal(saved(p).name, 'Renamed Trader'); assert.equal(saved(p).userId, 2321305); p.check();
});

test('a waiting metadata edit rejects an intervening Torn identity replacement', async () => {
  const p = await setup(), held = await hold(p); const editing = edit(p, 'trader-journal-add'); await turn();
  const raw = book(p); raw[0].userId = 777; p.memory.set(K.book, JSON.stringify(raw)); const before = p.memory.get(K.book);
  held.release(); await held.task; await editing;
  assert.equal(p.memory.get(K.book), before); assert.match(feedback(p), /identity changed/); p.check();
});

test('failed metadata rollback reports indeterminate and never claims a confirmed note', async () => {
  const p = await setup(); await capture(p); const st = p.sandbox.localStorage, get = st.getItem, set = st.setItem; let attempted = false;
  st.setItem = (key, value) => { if (key === K.book) { if (attempted) throw Error('rollback failed'); attempted = true; } set(key, value); };
  st.getItem = key => { if (key === K.book && attempted) throw Error('readback unreadable'); return get(key); };
  const proof = copy(saved(p).pricePageCaptureReceipts); await edit(p, 'trader-journal-add');
  assert.match(feedback(p), /indeterminate/); assert.doesNotMatch(feedback(p), /note added/);
  assert.deepEqual(saved(p).pricePageCaptureReceipts, proof); st.getItem = get; st.setItem = set; p.check();
});

test('raw export still preserves malformed provider evidence without normalizing it away', async () => {
  const p = await setup(), raw = book(p); raw[0].pricePageCaptureReceipts = [null]; p.memory.set(K.book, JSON.stringify(raw));
  let exported; p.sandbox.navigator.clipboard = { async writeText(value) { exported = value; } };
  const before = p.memory.get(K.book); await p.clickAction('traders-copy'); await p.drain();
  assert.deepEqual(JSON.parse(exported).traders, raw); assert.equal(p.memory.get(K.book), before); p.check();
});

test('Undo write/readback failure retains its verified backup and does not reload', async () => {
  const p = await setup(); loadReport(p); await p.report('open'); await p.report('disconnect');
  const before = p.memory.get(K.book), backup = p.memory.get(BACKUP); p.reloads = 0;
  p.faults.readback = K.book; p.faults.readbackOnce = true; await p.report('undo');
  assert.equal(p.memory.get(K.book), before); assert.equal(p.memory.get(BACKUP), backup);
  assert.equal(p.reloads, 0); assert.match(p.alerts.at(-1), /persistence failed/); p.check();
});

test('backup persistence fault reports committed operation and unavailable Undo truthfully', async () => {
  const p = await setup(); loadReport(p); p.faults.set = BACKUP; await p.report('open'); await p.report('disconnect');
  assert.equal(saved(p).pricePageItems.length, 0); assert.equal(p.reloads, 1);
  assert.match(p.alerts.at(-1), /change was saved.*Undo backup could not be verified/); p.check();
});

test('expired receipt-link marker permits deliberate disconnect while retained proof stays on its trader', async () => {
  const p = await setup(), raw = book(p), retainUntil = p.clock.now - 1;
  raw[0].receiptLinkCompletions = [{ armId: '1'.repeat(32), saleId: 'old-sale', capturedAt: retainUntil - 90000000,
    armExpiresAt: retainUntil - 86400000, retainUntil, parsedCount: 1, sourceType: 'receipt-audit' }];
  p.memory.set(K.book, JSON.stringify(raw)); loadReport(p); await p.report('open'); await p.report('disconnect');
  assert.equal(p.reloads, 1); assert.deepEqual(p.alerts, []); assert.deepEqual(saved(p).receiptLinkCompletions, raw[0].receiptLinkCompletions); p.check();
});

test('unarmed confirmed provider manual capture into an existing record stays editable without losing proof', async () => {
  const p = await setup();
  const page = runtime({ url: 'https://weav3r.dev/pricelist/2321305', clock: p.clock,
    items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 900 }] }); await page.ready;
  const returned = page.api.captureProviderAndReturn('weav3r', false); assert.equal(returned.envelope.traderRecordId, 'torn:2321305');
  p.owner.setUrl(page.navigations[0]); assert.equal((await p.owner.api.consumeImportedPriceCapture()).ok, true);
  const before = copy(saved(p)); await edit(p, 'trader-journal-add'); assertCapture(saved(p), before);
  assert.equal(saved(p).relationshipJournal.at(-1).text, 'updated note'); p.check();
});
