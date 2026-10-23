'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, trader, result, K } = require('./helpers/imm-capture-harness.cjs');
const { turn, hold } = require('./helpers/imm-receipt-harness.cjs');

// Whole production script, real native locks and real import/write decisions.
// Only DOM, storage, clocks, timers and navigation are host fixtures.
const PENDING = 'tornscripture-imm-pending-trader-capture-v1';
const BACKUP = 'tornscripture-imm-trader-link-backup-v1';
const NEIGHBORS = [BACKUP, 'tornscripture-imm-settings-v1',
  'tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1',
  'tornscripture-imm-unresolved-trade-journal-v1', 'tornscripture-imm-api-key-v1',
  'tornscripture-imm-api-key-profile-v1', 'tornscripture-imm-ledger-cleanup-backup-v1',
  'tornscripture-imm-inventory-v1'];
const clone = value => JSON.parse(JSON.stringify(value));
const bookWriteCount = p => [...p.writes, ...p.core.writes].filter(([key]) => key === K.book).length;
function snapshot(p) { const before = new Map(p.memory); before.bookWrites = bookWriteCount(p); return before; }
const rows = p => JSON.parse(p.memory.get(K.book)).traders;
const receipt = (now, fields = {}) => ({ runId: 'historical-run', entryId: 'historical-entry',
  attemptId: 'historical-attempt', expiresAt: now + 10000, ...fields });
const feedback = p => [...p.elements, ...p.core.elements].filter(el => ['tsimm-toast', 'tsimm-watch-toast'].includes(el.id)).map(el => el.textContent).join('\n');

async function initialized(memory, clock) {
  const p = runtime({ memory, clock, testMode: false, productionEvents: true });
  await p.ready; await turn(); await turn();
  p.carousel = p.window.__TSIMM_WATCHLIST_API__;
  p.core = runtime({ memory, clock: p.clock }); await p.core.ready;
  return p;
}
async function setup() {
  const memory = new Map([[K.book, JSON.stringify({ wrapperFuture: { keep: 7 },
    traders: [trader(), trader('b', 123456, 'Other Trader')] })]]);
  const p = await initialized(memory);
  assert.equal(await p.carousel.startSavedTraderCaptureCarousel('all'), true);
  assert.equal(await p.carousel.launchFavoriteCaptureCarousel(), true);
  p.envelope = JSON.parse(memory.get(K.queue)).entries[0].envelope;
  const ledger = p.core.api.normalizeLedger({ lots: [{ id: 'lot', itemId: 1, quantity: 8,
    remainingQuantity: 6, unitCost: 100 }], sales: [{ id: 'sale', tradeId: '887766',
    cashReceived: 500, trackedCostBasis: 200, realizedProfit: 300,
    items: [{ itemId: 1, quantity: 2, allocations: [{ lotId: 'lot', quantity: 2, unitCost: 100 }] }] }] });
  memory.set(K.ledger, JSON.stringify(ledger));
  memory.set(PENDING, JSON.stringify({ traderId: 'a', userId: 2321305, traderName: 'VladBull',
    armId: 'a'.repeat(32), armedAt: p.clock.now, expiresAt: p.clock.now + 3600000 }));
  for (const key of NEIGHBORS) memory.set(key, JSON.stringify({ sentinel: key, keep: ' exact bytes ' }));
  p.clock.now += 1000;
  return p;
}
function storeRows(p, records) {
  const raw = JSON.parse(p.memory.get(K.book)); raw.traders = records;
  p.memory.set(K.book, JSON.stringify(raw));
}
function payload(p, outcome = 'captured') {
  return result(p.envelope, { outcome, producedAt: p.clock.now,
    items: outcome === 'captured' ? undefined : [], evidence: {
      kind: 'weav3r-route', tornId: p.envelope.expectedTornId,
      ...(outcome === 'explicitly_unavailable' ? { statement: 'This trader is unavailable.' } : {}),
    } });
}
function importUrl(p, incoming) {
  return 'https://www.torn.com/index.php?tsimmPriceImport=' +
    Buffer.from(JSON.stringify(p.core.api.compactPriceCaptureResult(incoming))).toString('base64url');
}
async function deliver(p, incoming, route = 'persist') {
  if (route === 'save') return p.core.api.saveTraderPriceCapture(null, { captureResult: incoming });
  if (route === 'ordinary') { p.core.setUrl(importUrl(p, incoming)); return p.core.api.consumeImportedPriceCapture(); }
  if (route === 'early') {
    const returned = runtime({ memory: p.memory, clock: p.clock, url: importUrl(p, incoming), testMode: false });
    await returned.ready;
    assert.equal(returned.navigations.length, 1, 'cosmetic cleanup keeps a diagnostic notice');
    assert.doesNotMatch(returned.navigations[0], /tsimmPriceImport/);
    return JSON.parse(returned.session.get(K.notice));
  }
  return p.core.api.persistCaptureImport(incoming);
}
async function rawExport(p) {
  let exported;
  p.sandbox.navigator.clipboard = { writeText: async value => { exported = value; } };
  await p.clickAction('traders-copy'); await turn();
  return JSON.parse(exported).traders;
}
function assertRejected(p, before, notice) {
  assert.equal(notice.ok, false); assert.equal(notice.rejected, true);
  assert.notEqual(notice.outcome, 'captured'); assert.equal(notice.count, undefined);
  assert.match(notice.error, /export|preserve|unreadable/i);
  assert.deepEqual([...p.memory], [...before], 'all raw persistent storage remains exact');
  assert.equal(bookWriteCount(p), before.bookWrites);
}

const malformed = [
  ['unreadable expiry', (t, now) => { t.pricePageCaptureReceipts = [receipt(now, { expiresAt: 'unreadable' })]; }],
  ['null expiry', (t, now) => { t.pricePageCaptureReceipts = [receipt(now, { expiresAt: null })]; }],
  ['zero expiry', (t, now) => { t.pricePageCaptureReceipts = [receipt(now, { expiresAt: 0 })]; }],
  ['coerced expiry', (t, now) => { t.pricePageCaptureReceipts = [receipt(now, { expiresAt: String(now) })]; }],
  ...['runId', 'entryId', 'attemptId'].flatMap(key => [
    ['missing ' + key, (t, now) => { const r = receipt(now); delete r[key]; t.pricePageCaptureReceipts = [r]; }],
    ['invalid ' + key, (t, now) => { t.pricePageCaptureReceipts = [receipt(now, { [key]: ' padded ' })]; }],
  ]),
  ...[null, {}, 'opaque', 7, [null], [[]]].map(value => ['wrong replay shape ' + JSON.stringify(value),
    t => { t.pricePageCaptureReceipts = value; }]),
  ['duplicate attempt', (t, now) => { const r = receipt(now); t.pricePageCaptureReceipts = [r, clone(r)]; }],
  ['inconsistent terminal envelope', (t, now, e) => { const r = receipt(now);
    t.pricePageCaptureReceipts = [r]; t.pricePageLastCaptureReceipt = { ...r, outcome: 'captured', envelope: e }; }],
  ['missing terminal envelope', (t, now) => { const r = receipt(now);
    t.pricePageCaptureReceipts = [r]; t.pricePageLastCaptureReceipt = { ...r, outcome: 'captured' }; }],
  ['terminal without replay receipt', (t, now, e) => { t.pricePageCaptureReceipts = [];
    t.pricePageLastCaptureReceipt = { ...e, envelope: e, outcome: 'captured' }; }],
  ['invalid terminal outcome', (t, now, e) => { const r = { runId: e.runId, entryId: e.entryId, attemptId: e.attemptId, expiresAt: e.expiresAt };
    t.pricePageCaptureReceipts = [r]; t.pricePageLastCaptureReceipt = { ...r, envelope: e, outcome: 'invented' }; }],
  ['malformed receipt-link proof', t => { t.receiptLinkCompletions = null; }],
];
for (const [name, mutate] of malformed) for (const outcome of ['captured', 'explicitly_unavailable']) {
  test(`ME-F1 ${name} rejects ${outcome} without evidence loss`, async () => {
    const p = await setup(), records = rows(p);
    mutate(records[0], p.clock.now, p.envelope); storeRows(p, records);
    const before = snapshot(p), notice = await deliver(p, payload(p, outcome));
    assertRejected(p, before, notice);
    assert.deepEqual(await rawExport(p), clone(records));
    assert.deepEqual([...p.memory], [...before]);
  });
}
test('ME-F1 nonfinite parsed JSON expiry rejects without rewriting raw bytes', async () => {
  const p = await setup(), records = rows(p);
  records[0].pricePageCaptureReceipts = [receipt(p.clock.now, { expiresAt: 'OVERFLOW' })];
  storeRows(p, records);
  p.memory.set(K.book, p.memory.get(K.book).replace('"OVERFLOW"', '1e400'));
  assert.equal(rows(p)[0].pricePageCaptureReceipts[0].expiresAt, Infinity);
  const before = snapshot(p); assertRejected(p, before, await deliver(p, payload(p)));
});
for (const route of ['persist', 'save', 'ordinary', 'early']) for (const outcome of ['captured', 'explicitly_unavailable']) {
  test(`ME-F3 ${route} rejects malformed evidence in another trader: ${outcome}`, async () => {
    const p = await setup(), records = rows(p);
    records[1].pricePageCaptureReceipts = [receipt(p.clock.now, { expiresAt: 'unreadable' })];
    storeRows(p, records); const before = snapshot(p);
    const notice = await deliver(p, payload(p, outcome), route); assertRejected(p, before, notice);
    assert.equal(await p.carousel.continueFavoriteCaptureCarousel(notice), false);
    assert.deepEqual([...p.memory], [...before]);
    if (route === 'ordinary') assert.match(feedback(p), /export|preserve/i);
  });
}
for (const expired of [false, true]) {
  test('ME-F1 existing cross-trader collision is not pruned away; expired=' + expired, async () => {
    const p = await setup(), records = rows(p), r = receipt(p.clock.now, { expiresAt: p.clock.now + (expired ? -1 : 10000) });
    records.forEach(t => { t.pricePageCaptureReceipts = [clone(r)]; }); storeRows(p, records);
    const before = snapshot(p); assertRejected(p, before, await deliver(p, payload(p)));
  });
  test('ME-F2 complete proposed book refuses incoming attempt already owned by another trader; expired=' + expired, async () => {
    const p = await setup(), records = rows(p), e = p.envelope;
    records[1].pricePageCaptureReceipts = [{ runId: e.runId, entryId: e.entryId, attemptId: e.attemptId,
      expiresAt: expired ? p.clock.now - 1 : e.expiresAt }];
    storeRows(p, records); const before = snapshot(p);
    assertRejected(p, before, await deliver(p, payload(p)));
  });
}
test('ME-F1 authority is freshly read after the existing native grant', async () => {
  const p = await setup(), held = await hold(p), incoming = payload(p);
  const task = deliver(p, incoming); await turn();
  const records = rows(p); records[0].pricePageCaptureReceipts = null; storeRows(p, records);
  const before = snapshot(p); held.release(); await held.task;
  assertRejected(p, before, await task);
});
test('ME-F3 rejected capture retains Retry budget, safe Skip refusal and explicit Cancel recovery', async () => {
  const p = await setup(), records = rows(p); records[0].pricePageCaptureReceipts = null; storeRows(p, records);
  const before = snapshot(p), notice = await deliver(p, payload(p)); assertRejected(p, before, notice);
  assert.equal(await p.carousel.skipCurrentCaptureCarousel(), false, 'Skip cannot write a terminal over malformed history');
  assert.deepEqual([...p.memory], [...before]); assert.match(feedback(p), /export/i);
  assert.equal(await p.carousel.launchFavoriteCaptureCarousel(), true, 'explicit Retry still issues B once');
  const queue = JSON.parse(p.memory.get(K.queue)); assert.equal(queue.entries[0].attemptsUsed, 2);
  assert.equal(await p.carousel.launchFavoriteCaptureCarousel(), false, 'no third attempt');
  await p.carousel.cancelFavoriteCaptureCarousel();
  assert.equal(p.memory.has(K.queue), false); assert.equal(p.memory.get(K.book), before.get(K.book));
  assert.equal(JSON.parse(p.memory.get(K.result)).completed.length, 0);
  for (const [key, bytes] of before) if (![K.queue, K.result].includes(key)) assert.equal(p.memory.get(key), bytes, key);
});
for (const mode of ['legacy absence', 'partial replay', 'valid expired terminal', 'receipt-link marker']) {
  test('ME-F4 healthy capture, prune and exactly-once control: ' + mode, async () => {
    const p = await setup(), records = rows(p), now = p.clock.now;
    if (mode === 'partial replay') records[0].pricePageCaptureReceipts = [receipt(now)];
    if (mode === 'valid expired terminal') {
      const e = { ...p.envelope, runId: 'old-run', entryId: 'old-entry', attemptId: 'old-attempt',
        issuedAt: now - 900002, deadline: now - 840002, expiresAt: now - 2 };
      const r = { runId: e.runId, entryId: e.entryId, attemptId: e.attemptId, expiresAt: e.expiresAt };
      records[0].pricePageCaptureReceipts = [r]; records[0].pricePageLastCaptureReceipt = { ...r, envelope: e, outcome: 'captured' };
    }
    if (mode === 'receipt-link marker') records[0].receiptLinkCompletions = [{ armId: 'b'.repeat(32), saleId: 'sale',
      capturedAt: now - 100, armExpiresAt: now + 1000, retainUntil: now + 86401000, parsedCount: 1, sourceType: 'receipt-audit' }];
    storeRows(p, records); const before = snapshot(p), incoming = payload(p);
    const notice = await deliver(p, incoming); assert.equal(notice.ok, true); assert.equal(notice.outcome, 'captured');
    const saved = rows(p)[0]; assert.equal(saved.pricePageItems[0].unitPrice, 1000); assert.equal(saved.pricePageCaptureCount, 8);
    assert.equal(saved.pricePageCaptureReceipts.length, mode === 'partial replay' ? 2 : 1);
    assert.deepEqual(saved.receiptLinkCompletions, records[0].receiptLinkCompletions);
    const once = p.memory.get(K.book); assert.equal((await deliver(p, incoming)).ok, false); assert.equal(p.memory.get(K.book), once);
    for (const [key, bytes] of before) if (key !== K.book) assert.equal(p.memory.get(key), bytes, key);
  });
}
for (const malformed of [false, true]) test('manual confirmed import keeps pending authority on rejection; malformed=' + malformed, async () => {
  const p = await setup(); await p.carousel.cancelFavoriteCaptureCarousel();
  const records = rows(p); if (malformed) records[0].pricePageCaptureReceipts = null; storeRows(p, records);
  p.envelope = { ...p.envelope, intent: 'manual', runId: 'manual-run', entryId: 'manual-entry', attemptId: 'manual-attempt' };
  const before = snapshot(p), notice = await deliver(p, payload(p), 'ordinary');
  if (malformed) assertRejected(p, before, notice);
  else { assert.equal(notice.ok, true); assert.equal(rows(p)[0].pricePageCaptureCount, 8); }
  assert.equal(p.memory.get(PENDING), before.get(PENDING), 'provider result cannot consume a strong receipt arm');
});
test('shared write gate also protects ordinary direct price capture without a provider result', async () => {
  const p = await setup(); await p.carousel.cancelFavoriteCaptureCarousel();
  const records = rows(p); records[1].pricePageCaptureReceipts = null; storeRows(p, records);
  const before = snapshot(p);
  assert.equal(await p.core.api.saveTraderPriceCapture(p.core.api.state.traders.find(t => t.id === 'a'), {
    url: records[0].pricePageUrl, items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] }), null);
  assert.deepEqual([...p.memory], [...before]); assert.match(feedback(p), /export/i);
});
for (const malformed of [false, true]) test('complete initialized provider-to-Torn round trip and raw Export; malformed=' + malformed, async () => {
  const t = trader(); t.pricePageCaptureReceipts = [receipt(0, { expiresAt: malformed ? 'unreadable' : 1 })];
  const memory = new Map([[K.book, JSON.stringify([t])]]), owner = await initialized(memory);
  assert.deepEqual(await rawExport(owner), [t]);
  assert.equal(await owner.carousel.startSavedTraderCaptureCarousel('all'), true);
  assert.equal(await owner.carousel.launchFavoriteCaptureCarousel(), true);
  const before = memory.get(K.book), queue = memory.get(K.queue), ledger = memory.get(K.ledger);
  const provider = runtime({ url: owner.navigations[0], clock: owner.clock, testMode: false,
    items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] }); await provider.ready;
  const scan = [...provider.timers.values()].find(timer => timer.delay === 700); assert.ok(scan);
  owner.clock.now = scan.at; scan.fn(); assert.equal(provider.navigations.length, 1);
  const returned = runtime({ url: provider.navigations[0], memory, clock: owner.clock, testMode: false }); await returned.ready;
  const notice = JSON.parse(returned.session.get(K.notice)); assert.equal(notice.ok, !malformed);
  assert.equal(memory.get(K.queue), queue); assert.equal(memory.get(K.ledger), ledger);
  if (malformed) { assert.equal(memory.get(K.book), before); assert.match(notice.error, /export/i); assert.deepEqual(await rawExport(owner), [t]); }
  else { const saved = JSON.parse(memory.get(K.book))[0]; assert.equal(saved.pricePageCaptureCount, 8); assert.equal(saved.pricePageItems[0].unitPrice, 1000); assert.equal(saved.pricePageCaptureReceipts.length, 1); }
});
