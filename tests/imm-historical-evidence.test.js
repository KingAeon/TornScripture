'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runtime, trader, result, K, Element } = require('./helpers/imm-capture-harness.cjs');
const { fixture, secondContext, turn, hold, PENDING } = require('./helpers/imm-receipt-harness.cjs');
const NOW = Date.parse('2026-10-09T21:00:00Z');
const BACKUP = 'tornscripture-imm-trader-link-backup-v1';
const NEIGHBORS = [BACKUP, 'tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1',
  'tornscripture-imm-unresolved-trade-journal-v1', 'tornscripture-imm-api-key-v1',
  'tornscripture-imm-api-key-profile-v1', 'tornscripture-imm-ledger-cleanup-backup-v1', 'tornscripture-imm-inventory-v1'];
const clone = value => JSON.parse(JSON.stringify(value));
const rows = p => { const raw = JSON.parse(p.memory.get(K.book)); return Array.isArray(raw) ? raw : raw.traders; };
const saved = p => rows(p).find(t => (t.recordId || t.uuid || t.id) === 'a');
function historical(t = trader(), outcome = 'captured') {
  const e = { intent: 'carousel', runId: 'old-run-' + t.id, entryId: 'old-entry-' + t.id,
    attemptId: 'old-attempt-' + t.id, traderRecordId: t.id, expectedTornId: t.userId,
    provider: 'weav3r', sourceUrl: `https://weav3r.dev/pricelist/${t.userId}`,
    issuedAt: NOW - 1000000, deadline: NOW - 940000, expiresAt: NOW - 100000 };
  const r = { runId: e.runId, entryId: e.entryId, attemptId: e.attemptId, expiresAt: e.expiresAt };
  return { ...t, pricePageCaptureReceipts: [r], pricePageLastCaptureReceipt: { ...r, envelope: e, outcome } };
}
const envelopeChange = change => t => change(t.pricePageLastCaptureReceipt.envelope);
const invalid = [
  ['unknown provider', envelopeChange(e => { e.provider = 'future-provider'; })],
  ['TornExchange with Weav3r source', envelopeChange(e => { e.provider = 'tornexchange'; })],
  ['Weav3r with TornExchange source', envelopeChange(e => { e.sourceUrl = 'https://tornexchange.com/prices/vladbull'; })],
  ['foreign numeric route', envelopeChange(e => { e.sourceUrl = `https://weav3r.dev/pricelist/${e.expectedTornId === 123456 ? 2321305 : 123456}`; })],
  ...['http://weav3r.dev/pricelist/2321305', 'https://weav3r.dev:444/pricelist/2321305',
    'https://u:p@weav3r.dev/pricelist/2321305', 'https://example.com/pricelist/2321305',
    'https://weav3r.dev/pricelist/2321305/extra', 'https://www.weav3r.dev/pricelist/2321305',
    'https://weav3r.dev/pricelist/2321305/', 'https://weav3r.dev/pricelist/2321305?proof=1',
    'https://weav3r.dev/pricelist/2321305#proof', 'https://weav3r.dev:443/pricelist/2321305',
    'https://WEAV3R.dev/pricelist/2321305'].map(url => [url, envelopeChange(e => { e.sourceUrl = url; })]),
  ['deadline after expiry', t => { const e = t.pricePageLastCaptureReceipt.envelope; e.expiresAt = e.deadline - 1;
    t.pricePageLastCaptureReceipt.expiresAt = e.expiresAt; t.pricePageCaptureReceipts[0].expiresAt = e.expiresAt; }],
  ['deadline at issuance', envelopeChange(e => { e.deadline = e.issuedAt; })],
  ['deadline span too long', envelopeChange(e => { e.deadline = e.issuedAt + 60001; })],
  ['TTL span too long', envelopeChange(e => { e.expiresAt = e.issuedAt + 900001; })],
  ...['issuedAt', 'deadline', 'expiresAt', 'expectedTornId'].map(key => ['coerced ' + key, envelopeChange(e => { e[key] = String(e[key]); })]),
  ['unknown envelope format', envelopeChange(e => { e.schemaVersion = 5; })],
  ['unknown terminal format', t => { t.pricePageLastCaptureReceipt.schemaVersion = 5; }],
  ['unknown replay format', t => { t.pricePageCaptureReceipts[0].schemaVersion = 5; }],
  ['invalid intent', envelopeChange(e => { e.intent = 'background'; })],
  ['fractional Torn ID', envelopeChange(e => { e.expectedTornId += 0.5; })],
  ['padded trader ID', envelopeChange(e => { e.traderRecordId += ' '; })],
  ['foreign trader ID', envelopeChange(e => { e.traderRecordId = e.traderRecordId === 'b' ? 'a' : 'b'; })],
  ['foreign Torn ID', envelopeChange(e => { e.expectedTornId = e.expectedTornId === 123456 ? 2321305 : 123456; })],
  ['unknown outcome', t => { t.pricePageLastCaptureReceipt.outcome = 'retry_needed'; }],
  ['false terminal', t => { t.pricePageLastCaptureReceipt = false; }],
  ['array terminal', t => { t.pricePageLastCaptureReceipt = []; }],
  ['orphan terminal', t => { t.pricePageCaptureReceipts = []; }],
  ['receipt expiry mismatch', t => { t.pricePageLastCaptureReceipt.expiresAt--; }],
  ['null replay', t => { t.pricePageCaptureReceipts = null; }],
  ['array replay record', t => { t.pricePageCaptureReceipts = [[]]; }],
  ['duplicate expired replay', t => { t.pricePageCaptureReceipts.push(clone(t.pricePageCaptureReceipts[0])); }],
  ['non-numeric replay expiry', t => { t.pricePageCaptureReceipts[0].expiresAt = 'expired'; }],
  ...['runId', 'entryId', 'attemptId'].map(key => ['invalid replay ' + key, t => { t.pricePageCaptureReceipts[0][key] = ' padded '; }]),
];
function malformed(change = invalid[1][1], t = historical()) { change(t); return t; }
async function initialized(records = [historical(), trader('b', 123456, 'Other Trader')]) {
  const memory = new Map([[K.book, JSON.stringify({ futureWrapperMetadata: { preserve: true }, traders: records })]]);
  const clock = { now: NOW };
  const p = runtime({ memory, clock, testMode: false, productionEvents: true });
  await p.ready; await turn(); await turn();
  p.state = p.api._state;
  p.core = runtime({ memory, clock }); await p.core.ready;
  p.carousel = p.window.__TSIMM_WATCHLIST_API__;
  const ledger = p.core.api.normalizeLedger({ lots: [{ id: 'lot', itemId: 1, itemName: 'Fixture Item', quantity: 8,
    remainingQuantity: 6, unitCost: 500, capturedAt: '2026-10-01T12:00:00Z', fundingSource: 'personal' }],
  sales: [{ id: 'sale', tradeId: '887766', fingerprint: 'sale-fixture', soldAt: '2026-10-02T12:00:00Z', cashReceived: 2000,
    trackedCostBasis: 1000, realizedProfit: 1000, trackedProfit: 1000, requestedQuantity: 2, trackedQuantity: 2, fullCoverage: true,
    items: [{ itemId: 1, itemName: 'Fixture Item', quantity: 2, trackedQuantity: 2, costBasis: 1000, proceeds: 2000, realizedProfit: 1000,
      allocations: [{ lotId: 'lot', quantity: 2, unitCost: 500, costBasis: 1000, proceeds: 2000, realizedProfit: 1000 }] }],
    receiptAudit: { provider: 'unknown', rawText: 'synthetic original audit', totalValue: 2000, saleCash: 2000, status: 'green', items: [] } }] });
  assert.equal(ledger.lots.length, 1); assert.equal(ledger.sales[0].items.length, 1); assert.equal(ledger.sales[0].items[0].allocations.length, 1);
  memory.set(K.ledger, JSON.stringify(ledger));
  for (const key of NEIGHBORS) memory.set(key, JSON.stringify({ sentinel: key, exact: ' original bytes ' }));
  return p;
}
function snapshot(p) {
  return { bytes: [...p.memory], writes: [...p.writes, ...(p.core?.writes || [])].filter(([k]) => k === K.book).length };
}
function unchanged(p, before) {
  assert.deepEqual([...p.memory], before.bytes, 'every raw persistent value, including queue/pending/Ledger/backup, stays exact');
  assert.equal(snapshot(p).writes, before.writes, 'no attempted book write');
}
const feedback = p => [...p.elements, ...(p.core?.elements || [])].filter(el => ['tsimm-toast', 'tsimm-watch-toast'].includes(el.id)).map(el => el.textContent).join('\n');
async function rawExport(p, rawText = false) {
  let exported; p.sandbox.navigator.clipboard = { writeText: async text => { exported = text; } };
  await p.clickAction('traders-copy'); await turn(); return rawText ? exported : JSON.parse(exported);
}
async function launch(p) {
  assert.equal(await p.carousel.startSavedTraderCaptureCarousel('all'), true);
  assert.equal(await p.carousel.launchFavoriteCaptureCarousel(), true);
  p.envelope = JSON.parse(p.memory.get(K.queue)).entries[0].envelope; p.clock.now += 1000;
}
function payload(p, outcome = 'captured') {
  return result(p.envelope, { producedAt: p.clock.now, outcome, items: outcome === 'captured' ? undefined : [],
    evidence: { kind: 'weav3r-route', tornId: p.envelope.expectedTornId,
      ...(outcome === 'explicitly_unavailable' ? { statement: 'This trader is unavailable.' } : {}) } });
}
async function deliver(p, route, incoming = payload(p)) {
  const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(p.core.api.compactPriceCaptureResult(incoming))).toString('base64url');
  if (route === 'save') return p.core.api.saveTraderPriceCapture(null, { captureResult: incoming });
  if (route === 'ordinary') { p.core.setUrl(url); return p.core.api.consumeImportedPriceCapture(); }
  if (route === 'early') { const returned = runtime({ memory: p.memory, clock: p.clock, url, testMode: false }); await returned.ready; return JSON.parse(returned.session.get(K.notice)); }
  return p.core.api.persistCaptureImport(incoming);
}
function rejected(notice) {
  assert.equal(notice.ok, false); assert.equal(notice.rejected, true);
  assert.notEqual(notice.outcome, 'captured'); assert.equal(notice.count, undefined);
  assert.match(notice.error, /export|preserve|unreadable/i);
}

for (const [name, change] of invalid) for (const target of ['current', 'other']) test(`HEV raw historical ${name}: ${target} trader`, async () => {
  const records = [historical(), historical(trader('b', 123456, 'Other Trader'))];
  change(records[target === 'current' ? 0 : 1]);
  const p = await initialized(records); await launch(p); const before = snapshot(p);
  rejected(await deliver(p, 'persist')); unchanged(p, before);
  assert.deepEqual((await rawExport(p)).traders, records); unchanged(p, before);
});
for (const [name, change] of invalid) test('HEV raw incoming JSON proof: ' + name, async () => {
  const p = await initialized([trader()]), incoming = historical(trader('c', 999, 'New Trader')); change(incoming);
  p.sandbox.prompt = () => JSON.stringify([incoming]); const before = snapshot(p);
  await p.clickAction('traders-import'); await turn(); await turn(); unchanged(p, before);
  assert.doesNotMatch(feedback(p), /Imported \d+ traders/); assert.match(feedback(p), /export|preserve/i);
});
for (const route of ['persist', 'save', 'ordinary', 'early']) for (const outcome of ['captured', 'explicitly_unavailable']) test(`HEV provider/source contradiction through ${route}: ${outcome}`, async () => {
  const p = await initialized([malformed(), trader('b', 123456, 'Other Trader')]); await launch(p);
  const before = snapshot(p), notice = await deliver(p, route, payload(p, outcome));
  rejected(notice); unchanged(p, before);
  assert.equal(await p.carousel.continueFavoriteCaptureCarousel(notice), false); unchanged(p, before);
});

for (const bad of [true, false]) test('HEV initialized provider-to-Torn return, raw Export and exact stored-book witness: bad=' + bad, async () => {
  const old = bad ? malformed() : historical(), p = await initialized([old]);
  assert.deepEqual((await rawExport(p)).traders, [old]); await launch(p); const before = snapshot(p);
  const provider = runtime({ url: p.navigations[0], clock: p.clock, testMode: false,
    items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] }); await provider.ready;
  const scan = [...provider.timers.values()].find(t => t.delay === 700); assert.ok(scan);
  p.clock.now = scan.at; scan.fn(); assert.equal(provider.navigations.length, 1);
  const returned = runtime({ memory: p.memory, clock: p.clock, url: provider.navigations[0], testMode: false }); await returned.ready;
  const notice = JSON.parse(returned.session.get(K.notice));
  if (process.env.TSIMM_HEV_WITNESS_DIR) fs.writeFileSync(path.join(process.env.TSIMM_HEV_WITNESS_DIR, `roundtrip-${bad}.json`), JSON.stringify({ before: before.bytes,
    after: [...p.memory], exported: await rawExport(p), notice }, null, 2));
  if (bad) { rejected(notice); unchanged(p, before); assert.deepEqual((await rawExport(p)).traders, [old]); }
  else { assert.equal(notice.ok, true); assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(saved(p).pricePageItems[0].unitPrice, 1000); assert.equal(saved(p).pricePageCaptureReceipts.length, 1); }
});

const actions = ['trader-journal-add', 'trader-edit', 'trader-hide', 'trader-restore', 'trader-avoid', 'trader-delete', 'trader-add'];
for (const action of actions) for (const bad of [true, false]) test(`HEV metadata ${action}: bad=${bad}`, async () => {
  const p = await initialized([bad ? malformed() : historical()]);
  const answers = action === 'trader-edit' ? ['VladBull', '2321305', '4', '99', 'changed'] : action === 'trader-add' ? ['New Trader', '999', '4', '99', 'new'] : ['note'];
  p.sandbox.prompt = () => answers.shift() ?? '';
  const before = snapshot(p); await p.clickAction(action, undefined, 'a'); await turn(); await turn();
  if (bad) { unchanged(p, before); assert.match(feedback(p), /export|preserve/i); assert.doesNotMatch(feedback(p), /Relationship note added|Trader removed|Trader saved/); }
  else { assert.notEqual(p.memory.get(K.book), new Map(before.bytes).get(K.book)); }
});
for (const bad of [true, false]) for (const incoming of [true, false]) test(`HEV JSON upsert: bad=${bad}, incoming=${incoming}`, async () => {
  const p = await initialized([incoming ? trader() : bad ? malformed() : historical()]);
  const imported = incoming ? historical(trader('c', 999, 'New Trader')) : trader('c', 999, 'New Trader');
  if (bad && incoming) invalid[0][1](imported);
  p.sandbox.prompt = () => JSON.stringify([imported]); const before = snapshot(p);
  await p.clickAction('traders-import'); await turn(); await turn();
  if (bad) { unchanged(p, before); assert.doesNotMatch(feedback(p), /Imported \d+ traders/); }
  else { assert.equal(rows(p).length, 2); assert.match(feedback(p), /Imported 1 traders/); }
});
for (const bad of [true, false]) test('HEV direct manual price writer: bad=' + bad, async () => {
  const p = await initialized([bad ? malformed() : historical()]), before = snapshot(p);
  const notice = await p.core.api.saveTraderPriceCapture(p.core.api.state.traders[0], { url: 'https://weav3r.dev/pricelist/2321305',
    items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] });
  if (bad) { assert.equal(notice, null); unchanged(p, before); }
  else { assert.equal(notice.status, 'captured'); assert.equal(saved(p).pricePageCaptureCount, 8); }
});
for (const bad of [true, false]) for (const completed of [true, false]) test(`HEV receipt-link new/completed recovery: bad=${bad}, completed=${completed}`, async () => {
  const original = await fixture();
  if (completed) {
    const remove = original.sandbox.localStorage.removeItem;
    original.sandbox.localStorage.removeItem = key => { if (key === PENDING) throw Error('retained completed arm'); return remove(key); };
    original.link(); await original.drain();
  }
  const current = rows(original)[0], withHistory = historical(current); if (bad) invalid[1][1](withHistory);
  original.memory.set(K.book, JSON.stringify([withHistory]));
  const p = await secondContext(original), before = snapshot(p); p.link(); await p.drain();
  if (bad) {
    assert.equal(p.memory.get(K.book), new Map(before.bytes).get(K.book)); assert.equal(p.memory.get(PENDING), new Map(before.bytes).get(PENDING));
    assert.equal(snapshot(p).writes, before.writes); assert.match(feedback(p), /export|preserve/i); assert.doesNotMatch(feedback(p), /prices captured|already captured/);
  } else if (completed) { assert.equal(snapshot(p).writes, before.writes); assert.equal(p.memory.get(PENDING), undefined); }
  else { assert.equal(rows(p)[0].pricePageCaptureCount, 8); assert.equal(rows(p)[0].receiptLinkCompletions.length, 1); }
  original.assertAccounting();
});
async function report(p) {
  p.alerts = []; p.reloads = 0; p.sandbox.alert = message => p.alerts.push(message); p.sandbox.location.reload = () => { p.reloads++; };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'TornScripture-IMM-Trader-Report.user.js'), 'utf8'), p.sandbox);
  p.reportClick = async action => {
    const target = new Element(); target.dataset = { td: action, tsimmTraderId: 'a' };
    target.closest = selector => action === 'open' && selector === '[data-tsimm-deals-open]' || action !== 'open' && selector === '[data-td]' ? target : null;
    await Promise.all(p.events.click.map(fn => fn({ target, preventDefault() {}, stopPropagation() {} })));
  };
  await p.reportClick('open');
  const target = new Element(); target.value = 'b'; p.document.fixtureSelectors = { '#tornscripture-imm-trader-deals-addon [data-td-move-target]': target };
}
for (const action of ['move', 'disconnect', 'undo']) for (const bad of [true, false]) test(`HEV matching Report ${action}: bad=${bad}`, async () => {
  const p = await initialized([bad ? malformed() : historical(), trader('b', 123456, 'Other Trader')]); await report(p);
  if (action === 'undo') p.memory.set(BACKUP, JSON.stringify({ root: JSON.parse(p.memory.get(K.book)), expectedAfter: p.memory.get(K.book) }));
  const before = snapshot(p); await p.reportClick(action); await turn();
  if (bad) { unchanged(p, before); assert.equal(p.reloads, 0); assert.match(p.alerts.join('\n'), /export|preserve/i); }
  else { assert.equal(p.reloads, 1); assert.equal(p.alerts.length, 0); }
});
for (const bad of [true, false]) test('HEV Skip/Retry/Cancel recovery: bad=' + bad, async () => {
  const p = await initialized([bad ? malformed() : historical()]); await launch(p); const before = snapshot(p);
  if (bad) {
    assert.equal(await p.carousel.skipCurrentCaptureCarousel(), false); unchanged(p, before);
    assert.equal(await p.carousel.launchFavoriteCaptureCarousel(), true);
    assert.equal(JSON.parse(p.memory.get(K.queue)).entries[0].attemptsUsed, 2);
    assert.equal(await p.carousel.launchFavoriteCaptureCarousel(), false);
    await p.carousel.cancelFavoriteCaptureCarousel(); assert.equal(p.memory.has(K.queue), false);
    assert.equal(p.memory.get(K.book), new Map(before.bytes).get(K.book)); assert.equal(JSON.parse(p.memory.get(K.result)).completed.length, 0);
  } else { assert.equal(await p.carousel.skipCurrentCaptureCarousel(), true); assert.equal(saved(p).pricePageLastCaptureReceipt.outcome, 'user_skipped'); }
});
for (const mode of ['legacy', 'null terminal', 'partial replay', 'expired terminal', 'TornExchange slug', 'manual alias']) test('HEV compatible historical class: ' + mode, async () => {
  const t = historical();
  if (mode === 'legacy') { delete t.pricePageCaptureReceipts; delete t.pricePageLastCaptureReceipt; }
  if (mode === 'null terminal') t.pricePageLastCaptureReceipt = null;
  if (mode === 'partial replay') delete t.pricePageLastCaptureReceipt;
  if (mode === 'TornExchange slug') Object.assign(t.pricePageLastCaptureReceipt.envelope, { provider: 'tornexchange', sourceUrl: 'https://tornexchange.com/prices/not-a-torn-id' });
  if (mode === 'manual alias') Object.assign(t.pricePageLastCaptureReceipt.envelope, { intent: 'manual', traderRecordId: 'torn:2321305' });
  const p = await initialized([t]); await launch(p); const before = snapshot(p), notice = await deliver(p, 'persist');
  assert.equal(notice.ok, true); assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(saved(p).pricePageCaptureReceipts.length, 1);
  const once = snapshot(p); assert.equal((await deliver(p, 'persist')).ok, false); unchanged(p, once);
  for (const [key, value] of before.bytes) if (key !== K.book) assert.equal(p.memory.get(key), value, key);
  assert.deepEqual(JSON.parse(p.memory.get(K.book)).futureWrapperMetadata, { preserve: true });
});
for (const outcome of ['captured', 'explicitly_empty', 'explicitly_unavailable', 'parser_failure', 'identity_mismatch', 'timeout', 'user_skipped', 'canceled', 'expired']) test('HEV expired historical outcome is not live authorization: ' + outcome, async () => {
  const p = await initialized([historical(trader(), outcome)]), original = p.memory.get(K.book);
  p.sandbox.prompt = () => 'historical note'; await p.clickAction('trader-journal-add', undefined, 'a'); await turn(); await turn();
  assert.notEqual(p.memory.get(K.book), original); assert.equal(saved(p).pricePageLastCaptureReceipt.outcome, outcome);
});
for (const partial of [true, false]) test('HEV valid unexpired retained replay: partial=' + partial, async () => {
  const t = historical(), e = t.pricePageLastCaptureReceipt.envelope;
  Object.assign(e, { issuedAt: NOW - 1000, deadline: NOW + 59000, expiresAt: NOW + 899000 });
  t.pricePageCaptureReceipts[0].expiresAt = e.expiresAt; t.pricePageLastCaptureReceipt.expiresAt = e.expiresAt;
  if (partial) delete t.pricePageLastCaptureReceipt;
  const p = await initialized([t]); await launch(p); assert.equal((await deliver(p, 'persist')).ok, true);
  assert.equal(saved(p).pricePageCaptureReceipts.length, 2); assert.deepEqual(saved(p).pricePageCaptureReceipts[0], t.pricePageCaptureReceipts[0]);
});
for (const type of ['manual alias takeover', 'duplicate stable owner', 'contradictory independent ID', 'expired cross-trader tuple']) test('HEV ownership cannot be reassigned: ' + type, async () => {
  const t = historical(), other = trader('b', 123456, 'Other Trader');
  if (type === 'manual alias takeover') { Object.assign(t.pricePageLastCaptureReceipt.envelope, { intent: 'manual', traderRecordId: 'torn:2321305' }); other.id = 'torn:2321305'; }
  if (type === 'duplicate stable owner') other.id = 'a';
  if (type === 'contradictory independent ID') t.tornId = 123456;
  if (type === 'expired cross-trader tuple') other.pricePageCaptureReceipts = clone(t.pricePageCaptureReceipts);
  const p = await initialized([t, other]), before = snapshot(p); p.sandbox.prompt = () => 'note';
  await p.clickAction('trader-journal-add', undefined, 'a'); await turn(); await turn(); unchanged(p, before);
});
test('HEV normalization preserves unsupported raw proof and does not dedupe it away', async () => {
  const t = malformed(invalid.find(([name]) => name === 'unknown replay format')[1]);
  const p = await initialized([t]), normalized = p.core.api.normalizeTraders([t, { ...trader(), id: 'different-record' }]);
  assert.equal(normalized.length, 2); assert.deepEqual(normalized.find(row => row.id === 'a').pricePageCaptureReceipts, t.pricePageCaptureReceipts);
  const broken = { ...t, pricePageCaptureReceipts: null, pricePageLastCaptureReceipt: false };
  const norm = p.core.api.normalizeTrader(broken); assert.equal(norm.pricePageCaptureReceipts, null); assert.equal(norm.pricePageLastCaptureReceipt, false);
});
test('HEV fresh whole-book context after native lock wait rejects newly present semantic contradiction', async () => {
  const p = await initialized(); await launch(p); const held = await hold(p), task = deliver(p, 'persist'); await turn();
  const raw = JSON.parse(p.memory.get(K.book)); invalid[1][1](raw.traders[1] = historical(raw.traders[1])); p.memory.set(K.book, JSON.stringify(raw));
  const before = snapshot(p); held.release(); await held.task; rejected(await task); unchanged(p, before);
});
for (const bad of [true, false]) for (const confirmed of [true, false]) test(`HEV manual provider confirmation remains separate: bad=${bad}, confirmed=${confirmed}`, async () => {
  const p = await initialized([bad ? malformed() : historical()]); p.core.sandbox.confirm = () => confirmed;
  p.envelope = { ...historical().pricePageLastCaptureReceipt.envelope, intent: 'manual', runId: 'new-manual-run', entryId: 'new-entry', attemptId: 'new-attempt',
    issuedAt: NOW, deadline: NOW + 60000, expiresAt: NOW + 900000 }; p.clock.now += 1000;
  const before = snapshot(p), notice = await deliver(p, 'ordinary');
  assert.equal(notice.ok, !bad && confirmed); if (bad || !confirmed) unchanged(p, before); else assert.equal(saved(p).pricePageCaptureCount, 8);
});
for (const bad of [true, false]) test('HEV actual relationship-role change: bad=' + bad, async () => {
  const p = await initialized([bad ? malformed() : historical()]), before = snapshot(p), target = new Element();
  target.dataset = { tsimmTraderId: 'a' }; target.value = 'both'; target.closest = selector => selector === '[data-tsimm-trader-role]' ? target : null;
  for (const fn of p.events.change) fn({ target }); await turn(); await turn();
  if (bad) unchanged(p, before); else assert.deepEqual(saved(p).relationshipRoles, ['buyer', 'supplier']);
});
for (const wrapped of [true, false]) test('HEV overflowing JSON proof remains raw-exportable: wrapped=' + wrapped, async () => {
  const t = historical(); t.pricePageCaptureReceipts[0].expiresAt = 'OVERFLOW';
  const bytes = JSON.stringify(wrapped ? { unknownWrapper: 'keep', traders: [t] } : [t]).replace('"OVERFLOW"', '1e400');
  const memory = new Map([[K.book, bytes]]), p = runtime({ memory, testMode: false, productionEvents: true });
  await p.ready; await turn(); await turn();
  const before = snapshot(p), exported = await rawExport(p, true);
  assert.ok(exported.includes('"expiresAt":1e400')); if (wrapped) assert.equal(exported, bytes);
  assert.equal(p.api._state.traders[0].pricePageCaptureReceipts[0].expiresAt, Infinity); unchanged(p, before);
  const core = runtime({ memory, clock: p.clock }); await core.ready;
  assert.equal(await core.api.saveTraderPriceCapture(core.api.state.traders[0], { items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] }), null);
  assert.equal(memory.get(K.book), bytes);
});
