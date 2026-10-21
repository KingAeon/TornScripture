const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { result, Element } = require('./helpers/imm-capture-harness.cjs');
const { fixture, hold, secondContext, turn, feedback, bookWrites, runtime, K, PENDING, RECEIPT } = require('./helpers/imm-receipt-harness.cjs');

const book = p => JSON.parse(p.memory.get(K.book));
const rows = p => Array.isArray(book(p)) ? book(p) : book(p).traders;
const saved = p => rows(p).find(entry => entry.id === 'a' || entry.recordId === 'a');
async function loadReport(p, baseline = false) {
  const reportPath = path.join(__dirname, '..', 'TornScripture-IMM-Trader-Report.user.js');
  const source = baseline ? (await execFileAsync('git', ['show', '269982d2d8a7148af40f5640c901348095a05b5c:TornScripture-IMM-Trader-Report.user.js'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' })).stdout : fs.readFileSync(reportPath, 'utf8');
  p.reportAlerts = []; p.reloads = 0;
  p.sandbox.alert = message => p.reportAlerts.push(message);
  p.sandbox.location.reload = () => { p.reloads++; };
  vm.runInContext(source, p.sandbox, { filename: reportPath });
  p.reportClick = async (action, id = 'a') => {
    const target = new Element(); target.dataset = { td: action, tsimmTraderId: id };
    target.closest = selector => (action === 'open' && selector === '[data-tsimm-deals-open]')
      || (action !== 'open' && selector === '[data-td]') ? target : null;
    const event = { target, preventDefault() {}, stopPropagation() {} };
    await Promise.all(p.events.click.map(callback => callback(event)));
  };
}
function markers(p, entries) {
  const raw = book(p), traders = Array.isArray(raw) ? raw : raw.traders;
  traders.find(entry => entry.id === 'a').receiptLinkCompletions = entries;
  p.memory.set(K.book, JSON.stringify(raw));
}
function marker(p, i = 1, retainUntil = p.clock.now + 90000000) {
  const armExpiresAt = retainUntil - 86400000;
  return { armId: i.toString(16).padStart(32, '0'), saleId: 'old-sale-' + i,
    capturedAt: armExpiresAt - 3600000, armExpiresAt, retainUntil, parsedCount: 1, sourceType: 'receipt-audit' };
}
function failCleanup(p, after = false) {
  const remove = p.sandbox.localStorage.removeItem;
  p.sandbox.localStorage.removeItem = key => {
    if (key !== PENDING) return remove(key);
    if (after) remove(key);
    throw new Error('injected cleanup exception');
  };
  return () => { p.sandbox.localStorage.removeItem = remove; };
}

for (const id of ['a', 'b']) test('Q-A1: committed cross-context ' + id + ' rearm at identical millisecond invalidates waiting old receipt', async () => {
  const p = await fixture({ twoTraders: true }), q = await secondContext(p), held = await hold(p);
  const old = JSON.parse(p.originalPending), armed = q.arm(id);
  await turn(); p.link(); await turn();
  assert.equal(p.memory.get(PENDING), p.originalPending, 'request has not committed ahead of the held lock');
  held.release(); await held.task; await armed; await p.drain();
  const newer = JSON.parse(p.memory.get(PENDING));
  assert.notEqual(newer.armId, old.armId); assert.equal(newer.armedAt, old.armedAt);
  assert.equal(newer.traderId, id); assert.equal(bookWrites(p).length, 0);
  assert.equal(p.memory.get(K.book), p.originalBook); p.assertAccounting();
});

test('capture committed before a queued rearm saves once and leaves the newer arm intact', async () => {
  const p = await fixture(), q = await secondContext(p), held = await hold(p);
  p.link(); await turn(); const armed = q.arm('a'); await turn();
  held.release(); await held.task; await p.drain(); await armed;
  assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.notEqual(JSON.parse(p.memory.get(PENDING)).armId, JSON.parse(p.originalPending).armId);
  assert.equal(saved(p).receiptLinkCompletions[0].armId, JSON.parse(p.originalPending).armId);
  p.assertAccounting();
});

for (const after of [false, true]) test('Q-A2: cleanup exception ' + (after ? 'after' : 'before') + ' removal preserves actual verified success', async () => {
  const p = await fixture(); failCleanup(p, after); p.link(); await p.drain();
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(bookWrites(p).length, 1);
  assert.equal(saved(p).receiptLinkCompletions.length, 1);
  assert.match(feedback(p).at(-1), /1 prices captured/);
  assert.doesNotMatch(feedback(p).at(-1), /prices not saved|outcome indeterminate/);
  if (after) { assert.equal(p.memory.get(PENDING), undefined); assert.equal(p.state.pendingTraderCapture, null); }
  else {
    assert.equal(p.memory.get(PENDING), p.originalPending); assert.ok(p.state.pendingTraderCapture);
    assert.match(feedback(p).at(-1), /cleanup unresolved/);
    assert.match(p.overlay.innerHTML, /Already captured.*cleanup unresolved/);
  }
  p.assertInput(RECEIPT); p.assertAccounting();
});

test('Q-A2: unreadable cleanup recovery cannot erase verified price success or null cached intent', async () => {
  const p = await fixture(), get = p.sandbox.localStorage.getItem; let unreadable = false;
  p.sandbox.localStorage.removeItem = key => { if (key === PENDING) { unreadable = true; throw Error('remove'); } p.memory.delete(key); };
  p.sandbox.localStorage.getItem = key => { if (key === PENDING && unreadable) throw Error('recovery read'); return get(key); };
  p.link(); await p.drain();
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.ok(p.state.pendingTraderCapture);
  assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /1 prices captured.*cleanup state unknown/); p.assertAccounting();
});

test('Q-A3: two cooperating callers and persistent removal faults commit one marker, write and increment', async () => {
  const p = await fixture(), q = await secondContext(p), held = await hold(p);
  failCleanup(p); failCleanup(q); p.link(); q.link(); await turn();
  held.release(); await held.task; await p.drain(); await q.drain();
  assert.equal(bookWrites(p).length + bookWrites(q).length, 1);
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(saved(p).receiptLinkCompletions.length, 1);
  assert.match(feedback(q).at(-1), /already captured.*no new price write/);
  assert.equal(p.memory.get(PENDING), p.originalPending); p.assertAccounting();
});

test('reload and retry reconcile a completed arm without a second price write', async () => {
  const p = await fixture(); failCleanup(p); p.link(); await p.drain();
  const q = await secondContext(p); q.link(); await q.drain();
  assert.equal(bookWrites(q).length, 0); assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.match(feedback(q).at(-1), /already captured.*no new price write/);
  assert.equal(p.memory.get(PENDING), undefined); p.assertAccounting();
});

test('arm identity, rather than sale identity, rejects replay against another receipt', async () => {
  const p = await fixture(); failCleanup(p); p.link(); await p.drain();
  p.open('sale-other'); p.link(); await p.drain();
  assert.equal(bookWrites(p).length, 1); assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.equal(saved(p).receiptLinkCompletions[0].saleId, 'sale-original');
  assert.match(feedback(p).at(-1), /already captured.*no new price write/);
  const ledger = JSON.parse(p.memory.get(K.ledger));
  assert.equal(ledger.sales[1].counterparty, 'VladBull', 'second deliberate metadata link remains separate');
  assert.deepEqual(ledger.lots, JSON.parse(p.originalLedger).lots);
  for (const [key, value] of p.protectedBytes) assert.equal(p.memory.get(key), value);
});

for (const mode of ['missing', 'throws', 'invalid', 'uuid-only']) test('strong identity generation: ' + mode, async () => {
  const p = await fixture(), old = p.memory.get(PENDING);
  p.sandbox.crypto = mode === 'missing' ? undefined : mode === 'throws' ? { getRandomValues() { throw Error('unavailable'); } }
    : mode === 'invalid' ? { randomUUID: () => 'weak-id' } : { randomUUID: () => webcrypto.randomUUID() };
  await p.arm('a'); await p.drain();
  if (mode === 'uuid-only') {
    const pending = JSON.parse(p.memory.get(PENDING));
    assert.match(pending.armId, /^[a-f0-9-]{36}$/); assert.notEqual(pending.armId, JSON.parse(old).armId);
    assert.equal(pending.expiresAt - pending.armedAt, 3600000);
  } else {
    assert.equal(p.memory.get(PENDING), old);
    assert.doesNotMatch(feedback(p).at(-1), /armed for the next/);
  }
  assert.equal(bookWrites(p).length, 0);
});

for (const fault of ['set', 'readback']) test('arming ' + fault + ' failure never claims armed or silently renews prior authority', async () => {
  const p = await fixture(); p.faults[fault] = PENDING; p.faults.readbackOnce = true;
  await p.arm('a'); await p.drain();
  assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /could not be verified/);
  assert.doesNotMatch(feedback(p).at(-1), /armed for the next/);
});

test('clear waits for verified commit and failed removal preserves local and durable intent', async () => {
  const p = await fixture(), held = await hold(p); failCleanup(p);
  const cleared = p.clickAction('trader-clear-capture'); await turn();
  assert.equal(p.memory.get(PENDING), p.originalPending); assert.ok(p.state.pendingTraderCapture);
  held.release(); await held.task; await cleared;
  assert.equal(p.memory.get(PENDING), p.originalPending); assert.ok(p.state.pendingTraderCapture);
  assert.match(feedback(p).at(-1), /clear unresolved/);
});

test('after-removal clear exception reconciles absence and confirms clear', async () => {
  const p = await fixture(); failCleanup(p, true); await p.clickAction('trader-clear-capture');
  assert.equal(p.memory.get(PENDING), undefined); assert.equal(p.state.pendingTraderCapture, null);
  assert.match(feedback(p).at(-1), /capture cleared/);
});

test('an old queued clear cannot erase an arm committed ahead of it', async () => {
  const p = await fixture(), q = await secondContext(p), held = await hold(p);
  const armed = q.arm('a'); await turn(); const cleared = p.clickAction('trader-clear-capture'); await turn();
  held.release(); await held.task; await armed; await cleared;
  assert.notEqual(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /clear unresolved/);
});

test('legacy pending records remain byte-identical and require deliberate rearming for receipt save', async () => {
  const p = await fixture(), legacy = JSON.parse(p.originalPending); delete legacy.armId;
  const bytes = JSON.stringify(legacy); p.memory.set(PENDING, bytes); p.open(); p.link(); await p.drain();
  assert.equal(p.memory.get(PENDING), bytes); assert.equal(p.memory.get(K.book), p.originalBook);
  assert.match(feedback(p).at(-1), /Legacy.*re-arm/); p.assertInput(RECEIPT); p.assertAccounting();
  p.clickAction('receipt-audit-close'); p.open('sale-original', ''); p.assertInput(RECEIPT);
  await p.arm('a'); p.link(); await p.drain(); assert.equal(saved(p).pricePageCaptureCount, 8);
});

for (const [name, change] of [
  ['short ID', arm => { arm.armId = 'bad'; }], ['padded ID', arm => { arm.armId += ' '; }],
  ['null ID', arm => { arm.armId = null; }], ['missing expiry', arm => { delete arm.expiresAt; }],
  ['extended lifetime', arm => { arm.expiresAt += 1; }], ['future arm', arm => { arm.armedAt += 1; }],
  ['coerced time', arm => { arm.armedAt = String(arm.armedAt); }], ['invalid trader', arm => { arm.userId = 0; }],
]) test('malformed arm fails closed without normalization renewal: ' + name, async () => {
  const p = await fixture(), arm = JSON.parse(p.originalPending); change(arm);
  const bytes = JSON.stringify(arm); p.memory.set(PENDING, bytes); p.link(); await p.drain();
  assert.equal(p.memory.get(PENDING), bytes); assert.equal(p.memory.get(K.book), p.originalBook);
  assert.equal(bookWrites(p).length, 0); assert.doesNotMatch(feedback(p).at(-1), /prices captured/);
  p.clickAction('receipt-audit-close'); p.open('sale-original', ''); p.assertInput(RECEIPT);
});

for (const [name, change] of [
  ['non-array', () => null], ['bad ID', list => { list[0].armId = 'bad'; return list; }],
  ['duplicate ID', list => [list[0], list[0]]], ['retention too short', list => { list[0].retainUntil--; return list; }],
  ['zero count', list => { list[0].parsedCount = 0; return list; }], ['wrong source', list => { list[0].sourceType = 'provider'; return list; }],
  ['raw receipt field', list => { list[0].rawText = 'must not persist'; return list; }],
  ['coerced clock', list => { list[0].capturedAt = String(list[0].capturedAt); return list; }],
]) test('completion corruption blocks capture and preserves exact evidence: ' + name, async () => {
  const p = await fixture(); markers(p, change([marker(p)])); const before = p.memory.get(K.book);
  const normalized = p.api.normalizeTraders(book(p));
  assert.deepEqual(JSON.parse(JSON.stringify(normalized[0].receiptLinkCompletions)), saved(p).receiptLinkCompletions);
  p.link(); await p.drain(); assert.equal(p.memory.get(K.book), before); assert.equal(bookWrites(p).length, 0);
  assert.match(feedback(p).at(-1), /malformed|collid/); p.assertAccounting();
});

for (const offset of [-1, 0, 1]) test('64-slot retention boundary at deadline offset ' + offset, async () => {
  const p = await fixture(), deadline = p.clock.now + 1;
  markers(p, Array.from({ length: 64 }, (_, i) => marker(p, i + 1, deadline)));
  p.clock.now = deadline + offset;
  const expected = JSON.parse(p.expectedLedger); expected.updatedAt = new Date(p.clock.now).toISOString(); p.expectedLedger = JSON.stringify(expected);
  const before = p.memory.get(K.book); p.link(); await p.drain();
  if (offset <= 0) { assert.equal(p.memory.get(K.book), before); assert.match(feedback(p).at(-1), /64.*protected/); }
  else { assert.equal(saved(p).receiptLinkCompletions.length, 1); assert.equal(saved(p).pricePageCaptureCount, 8); }
  p.assertAccounting();
});

test('retention preserves every live marker, prunes expired entries only on coordinated write', async () => {
  const p = await fixture(), live = marker(p, 1), expired = marker(p, 2, p.clock.now - 1);
  markers(p, [live, expired]); const before = p.memory.get(K.book);
  p.api.normalizeTraders(book(p)); assert.equal(p.memory.get(K.book), before);
  p.link(); await p.drain();
  assert.deepEqual(saved(p).receiptLinkCompletions[0], live); assert.equal(saved(p).receiptLinkCompletions.length, 2);
  const current = saved(p).receiptLinkCompletions[1], arm = JSON.parse(p.originalPending);
  assert.equal(current.retainUntil, arm.expiresAt + 86400000); assert.equal(current.parsedCount, 1);
  assert.deepEqual(Object.keys(current).sort(), ['armId', 'saleId', 'capturedAt', 'armExpiresAt', 'retainUntil', 'parsedCount', 'sourceType'].sort());
  p.assertAccounting();
});

test('a cached edit queued behind capture preserves the new snapshot, counter and completion', async () => {
  const p = await fixture(), q = await secondContext(p), held = await hold(p);
  p.link(); await turn(); const changed = q.clickAction('trader-hide', undefined, 'a'); await turn();
  held.release(); await held.task; await p.drain(); await changed;
  assert.equal(saved(p).disposition, 'hidden'); assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.equal(saved(p).pricePageItems[0].unitPrice, 1000); assert.equal(saved(p).receiptLinkCompletions.length, 1);
  p.assertAccounting();
});

for (const action of ['trader-hide', 'trader-restore', 'trader-avoid', 'trader-journal-add', 'trader-edit']) test('ordinary writer preserves live evidence and unknown fields: ' + action, async () => {
  const p = await fixture();
  const raw = book(p); raw[0].unknownFuture = { exact: 'preserve me' }; p.memory.set(K.book, JSON.stringify({ unknownWrapper: { keep: 1 }, traders: raw }));
  p.link(); await p.drain(); const completed = JSON.stringify(saved(p).receiptLinkCompletions);
  const answers = action === 'trader-edit' ? ['VladBull', '2321305', '3', '99', 'updated note'] : ['other'];
  p.sandbox.prompt = () => answers.shift() ?? '';
  await p.clickAction(action, undefined, 'a'); await p.drain();
  assert.equal(JSON.stringify(saved(p).receiptLinkCompletions), completed); assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.deepEqual(saved(p).unknownFuture, { exact: 'preserve me' }); assert.deepEqual(book(p).unknownWrapper, { keep: 1 });
  p.assertAccounting();
});

test('stale import and fresh export retain completion, price history, provider receipts and wrapper fields', async () => {
  const p = await fixture(); const old = book(p);
  old[0].pricePageCaptureReceipts = [{ runId: 'provider-run', entryId: 'provider-entry', attemptId: 'provider-attempt', expiresAt: p.clock.now + 60000 }];
  old[0].extra = { stable: true }; p.memory.set(K.book, JSON.stringify({ traders: old, wrapperVersion: 'keep' }));
  const stale = JSON.parse(JSON.stringify(old)); delete stale[0].receiptLinkCompletions;
  p.link(); await p.drain(); const after = JSON.parse(JSON.stringify(saved(p)));
  p.sandbox.prompt = () => JSON.stringify({ traders: stale }); await p.clickAction('traders-import'); await p.drain();
  for (const key of ['pricePageItems', 'pricePageCaptureCount', 'pricePageCapturedAt', 'previousPricePageUrl', 'receiptLinkCompletions', 'pricePageCaptureReceipts']) assert.deepEqual(saved(p)[key], after[key], key);
  let exported; p.sandbox.navigator.clipboard = { async writeText(text) { exported = text; } };
  await p.clickAction('traders-copy'); await turn();
  assert.deepEqual(JSON.parse(exported), book(p)); assert.equal(book(p).wrapperVersion, 'keep'); p.assertAccounting();
});

test('protected trader deletion is refused without deleting capture evidence', async () => {
  const p = await fixture(); p.link(); await p.drain(); const before = p.memory.get(K.book);
  await p.clickAction('trader-delete', undefined, 'a'); await p.drain();
  assert.equal(p.memory.get(K.book), before); assert.equal(p.state.traders.length, 1);
  assert.match(feedback(p).at(-1), /retention deadline/); p.assertAccounting();
});

test('unreadable persisted authority blocks capture and preserves recovery text', async () => {
  const p = await fixture(), get = p.sandbox.localStorage.getItem;
  p.sandbox.localStorage.getItem = key => { if (key === K.book) throw Error('unreadable book'); return get(key); };
  p.link(); await p.drain();
  assert.equal(bookWrites(p).length, 0); assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /prices not saved/); p.assertInput(RECEIPT); p.assertAccounting();
});

test('indeterminate write and failed rollback require completion reconciliation before another write', async () => {
  const p = await fixture(), storage = p.sandbox.localStorage, get = storage.getItem, set = storage.setItem;
  let attempted = false;
  storage.setItem = (key, value) => {
    if (key === K.book) { if (attempted) throw Error('rollback denied'); attempted = true; }
    set(key, value);
  };
  storage.getItem = key => { if (key === K.book && attempted) throw Error('readback and recovery denied'); return get(key); };
  p.link(); await p.drain();
  assert.match(feedback(p).at(-1), /outcome indeterminate/); assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(bookWrites(p).length, 1);
  storage.getItem = get; storage.setItem = set;
  p.link(); await p.drain(); assert.match(feedback(p).at(-1), /already captured.*no new price write/);
  assert.equal(bookWrites(p).length, 1); assert.equal(saved(p).pricePageCaptureCount, 8); p.assertAccounting();
});

test('a receipt-completed arm cannot be repeated through direct manual page capture', async () => {
  const p = await fixture(); failCleanup(p); p.link(); await p.drain();
  await p.clickAction('trader-capture-current-page'); await p.drain();
  assert.equal(bookWrites(p).length, 1); assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.match(feedback(p).at(-1), /already captured/); p.assertAccounting();
});

for (const mode of ['denied', 'null', 'visibility', 'pagehide']) test('arming cannot claim success after ' + mode + ' acquisition', async () => {
  const p = await fixture(); const old = p.memory.get(PENDING);
  if (mode === 'denied' || mode === 'null') { p.failLocks(mode); await p.arm('a'); }
  else {
    const held = await hold(p), armed = p.arm('a'); await turn();
    if (mode === 'visibility') { p.document.hidden = true; p.fireEvent('visibilitychange'); }
    else p.fireEvent('pagehide');
    await armed; held.release(); await held.task;
  }
  assert.equal(p.memory.get(PENDING), old); assert.equal(p.state.pendingTraderCapture.armId, JSON.parse(old).armId);
  assert.doesNotMatch(feedback(p).at(-1), /armed for the next/);
});

test('a recoverable failure retains edits through close/reopen without manufacturing an arm', async () => {
  const p = await fixture(), arm = JSON.parse(p.originalPending); arm.armId = 'invalid';
  p.memory.set(PENDING, JSON.stringify(arm)); p.link(); await p.drain();
  p.input.value = '  revised text after rejection\n'; p.clickAction('receipt-audit-close');
  p.open('sale-original', ''); p.assertInput('  revised text after rejection\n');
  assert.equal(p.memory.get(PENDING), JSON.stringify(arm)); assert.equal(bookWrites(p).length, 0);
});

test('zero positive prices write no completion marker or saved-price claim', async () => {
  const p = await fixture(); p.input.value = 'no supported receipt prices'; p.link(); await p.drain();
  assert.deepEqual(saved(p).receiptLinkCompletions, []); assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /no supported prices/); p.assertAccounting();
});

test('relationship role change uses its registered production change handler and retains completion', async () => {
  const p = await fixture(); p.link(); await p.drain(); const before = saved(p).receiptLinkCompletions;
  const target = new Element(); target.dataset = { tsimmTraderId: 'a' }; target.value = 'both';
  target.closest = selector => selector === '[data-tsimm-trader-role]' ? target : null;
  for (const callback of p.events.change) callback({ target });
  await p.drain();
  assert.deepEqual(saved(p).relationshipRoles, ['buyer', 'supplier']);
  assert.deepEqual(saved(p).receiptLinkCompletions, before); p.assertAccounting();
});

test('new trader creation cannot remove another trader completion from cached state', async () => {
  const p = await fixture(), q = await secondContext(p); p.link(); await p.drain();
  const answers = ['New Trader', '345678', '1', '99', 'new note']; q.sandbox.prompt = () => answers.shift();
  await q.clickAction('trader-add'); await q.drain();
  assert.equal(rows(p).length, 2); assert.equal(saved(p).receiptLinkCompletions.length, 1);
  assert.equal(saved(p).pricePageCaptureCount, 8); p.assertAccounting();
});

test('malformed imported completion evidence is rejected before any book write', async () => {
  const p = await fixture(); const incoming = book(p); incoming[0].receiptLinkCompletions = [marker(p)]; incoming[0].receiptLinkCompletions[0].parsedCount = 0;
  p.sandbox.prompt = () => JSON.stringify(incoming); await p.clickAction('traders-import'); await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(bookWrites(p).length, 0);
  assert.match(feedback(p).at(-1), /malformed/);
});

test('read-only export preserves corrupt evidence even when pending authority is malformed', async () => {
  const p = await fixture(); markers(p, null); p.memory.set(PENDING, 'not-json');
  let exported; p.sandbox.navigator.clipboard = { async writeText(text) { exported = text; } };
  await p.clickAction('traders-copy');
  assert.deepEqual(JSON.parse(exported).traders, book(p)); assert.equal(p.memory.get(PENDING), 'not-json');
  assert.equal(bookWrites(p).length, 0);
});

test('colliding arm completion evidence across traders fails closed', async () => {
  const p = await fixture({ twoTraders: true }), raw = book(p), entry = marker(p);
  for (const trader of raw) trader.receiptLinkCompletions = [entry];
  p.memory.set(K.book, JSON.stringify(raw)); const before = p.memory.get(K.book);
  p.link(); await p.drain(); assert.equal(p.memory.get(K.book), before);
  assert.equal(bookWrites(p).length, 0); assert.match(feedback(p).at(-1), /collid/); p.assertAccounting();
});

test('expired completion permits a deliberate trader deletion after its retention deadline', async () => {
  const p = await fixture(); markers(p, [marker(p, 1, p.clock.now - 1)]);
  await p.clickAction('trader-delete', undefined, 'a'); await p.drain();
  assert.deepEqual(rows(p), []); assert.equal(bookWrites(p).length, 1);
  assert.equal(p.memory.get(K.ledger), p.originalLedger);
});

for (const path of ['early', 'ordinary', 'direct', 'import']) test('provider ' + path + ' capture preserves separate receipt completion and replay semantics', async () => {
  const p = await fixture();
  p.input.value = JSON.stringify({ ...JSON.parse(RECEIPT), receiptUrl: 'https://weav3r.dev/pricelist/2321305' });
  failCleanup(p); p.link(); await p.drain();
  const completion = JSON.stringify(saved(p).receiptLinkCompletions), owner = runtime({ memory: p.memory, clock: p.clock }); await owner.ready;
  await owner.api.startSavedTraderCaptureCarousel('all'); await owner.api.launchFavoriteCaptureCarousel();
  const queue = JSON.parse(p.memory.get(K.queue)), envelope = queue.entries[queue.cursor].envelope;
  p.clock.now += 1000; const payload = result(envelope);
  const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(owner.api.compactPriceCaptureResult(payload))).toString('base64url');
  if (path === 'early') await runtime({ memory: p.memory, clock: p.clock, url }).ready;
  else if (path === 'ordinary') { owner.setUrl(url); await owner.api.consumeImportedPriceCapture(); }
  else if (path === 'direct') await owner.api.saveTraderPriceCapture(null, { captureResult: payload });
  else assert.equal((await owner.api.persistCaptureImport(payload)).ok, true);
  assert.equal(JSON.stringify(saved(p).receiptLinkCompletions), completion);
  assert.equal(saved(p).pricePageCaptureCount, 9); assert.equal(saved(p).pricePageCaptureReceipts.length, 1);
  const before = p.memory.get(K.book); assert.equal((await owner.api.persistCaptureImport(payload)).ok, false);
  assert.equal(p.memory.get(K.book), before); assert.equal(p.memory.get(PENDING), p.originalPending); p.assertAccounting();
});

test('legacy arm remains readable and a separate historical manual price save stays usable', async () => {
  const p = await fixture(), arm = JSON.parse(p.originalPending); delete arm.armId; p.memory.set(PENDING, JSON.stringify(arm));
  const owner = runtime({ memory: p.memory, clock: p.clock }); await owner.ready;
  const value = await owner.api.saveTraderPriceCapture(owner.api.state.traders[0], {
    url: 'https://www.torn.com/index.php', items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 777 }],
  });
  assert.equal(value.parsedCount, 1); assert.equal(saved(p).pricePageItems[0].unitPrice, 777);
  assert.equal(p.memory.get(PENDING), JSON.stringify(arm)); assert.equal(p.memory.get(K.ledger), p.originalLedger);
});

test('separate local account stores cannot share arm completion or capture counts', async () => {
  const p = await fixture(), q = await fixture(); failCleanup(p); p.link(); q.link(); await p.drain(); await q.drain();
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(saved(q).pricePageCaptureCount, 8);
  assert.notEqual(saved(p).receiptLinkCompletions[0].armId, saved(q).receiptLinkCompletions[0].armId);
  assert.equal(saved(p).receiptLinkCompletions.length, 1); assert.equal(saved(q).receiptLinkCompletions.length, 1);
  p.assertAccounting(); q.assertAccounting();
});

test('already-completed receipt cannot consume a newer arm introduced between the UI read and locked decision', async () => {
  const p = await fixture(); failCleanup(p); p.link(); await p.drain();
  const q = await secondContext(p); await q.arm('a'); const newer = p.memory.get(PENDING);
  // Model an independent process committing these production-created arm bytes
  // between the receipt UI's initial read and its later raw authority snapshot.
  p.memory.set(PENDING, p.originalPending);
  const set = p.sandbox.localStorage.setItem;
  p.sandbox.localStorage.setItem = (key, value) => { set(key, value); if (key === K.ledger) p.memory.set(PENDING, newer); };
  p.link(); await p.drain();
  assert.equal(p.memory.get(PENDING), newer); assert.equal(bookWrites(p).length, 1);
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.match(feedback(p).at(-1), /already captured/); p.assertAccounting();
});

test('normalization cannot hide valid or malformed completion evidence behind historical trader dedupe', async () => {
  const p = await fixture(), raw = book(p), marked = { ...raw[0], receiptLinkCompletions: [marker(p)] };
  const normalized = p.api.normalizeTraders([marked, { ...raw[0], id: 'another-record' }]);
  assert.equal(normalized.length, 2); assert.equal(normalized.find(entry => entry.id === 'a').receiptLinkCompletions.length, 1);
  const corrupt = p.api.normalizeTraders([{ ...marked, receiptLinkCompletions: null }, raw[0]]);
  assert.equal(corrupt.length, 2); assert.equal(corrupt[0].receiptLinkCompletions, null);
});

test('duplicate import records cannot normalize away malformed completion evidence', async () => {
  const p = await fixture(), raw = book(p);
  p.sandbox.prompt = () => JSON.stringify([{ ...raw[0], receiptLinkCompletions: null }, raw[0]]);
  await p.clickAction('traders-import'); await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(bookWrites(p).length, 0);
  assert.match(feedback(p).at(-1), /malformed/);
});

test('an imported marked record without trader identity fails before normalization can drop it', async () => {
  const p = await fixture(), raw = book(p);
  p.sandbox.prompt = () => JSON.stringify([{ id: 'broken-record', receiptLinkCompletions: [marker(p)] }, raw[0]]);
  await p.clickAction('traders-import'); await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(bookWrites(p).length, 0);
});

test('baseline companion Undo characterizes actual removal of a later receipt completion', async () => {
  const p = await fixture();
  p.memory.set('tornscripture-imm-trader-link-backup-v1', JSON.stringify({ root: JSON.parse(p.originalBook) }));
  failCleanup(p); p.link(); await p.drain(); assert.equal(saved(p).receiptLinkCompletions.length, 1);
  await loadReport(p, true); await p.reportClick('undo');
  assert.equal(saved(p).pricePageCaptureCount, 7); assert.deepEqual(saved(p).receiptLinkCompletions, []);
  assert.equal(p.memory.get(PENDING), p.originalPending); p.assertAccounting();
});

for (const action of ['disconnect', 'move', 'undo']) test('companion ' + action + ' cannot overwrite a protected receipt snapshot/completion', async () => {
  const p = await fixture({ twoTraders: true });
  p.memory.set('tornscripture-imm-trader-link-backup-v1', JSON.stringify({ root: JSON.parse(p.originalBook) }));
  failCleanup(p); p.link(); await p.drain(); const before = p.memory.get(K.book);
  await loadReport(p); await p.reportClick('open');
  assert.ok(p.document.getElementById('tornscripture-imm-trader-deals-addon'));
  const target = new Element(); target.value = 'b';
  p.document.fixtureSelectors['#tornscripture-imm-trader-deals-addon [data-td-move-target]'] = target;
  await p.reportClick(action); await p.drain();
  assert.equal(p.memory.get(K.book), before); assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.equal(p.reloads, 0); assert.equal(p.reportAlerts.length, 1);
  assert.match(p.reportAlerts[0], /protected|retention/); p.assertAccounting();
});

test('companion cached snapshot queued behind receipt capture rejects stale whole-book write', async () => {
  const p = await fixture(), held = await hold(p); await loadReport(p); await p.reportClick('open');
  p.link(); await turn(); const changed = p.reportClick('disconnect'); await turn();
  assert.equal(p.memory.get(K.book), p.originalBook);
  held.release(); await held.task; await p.drain(); await changed;
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(saved(p).receiptLinkCompletions.length, 1);
  assert.equal(bookWrites(p).length, 1); assert.match(p.reportAlerts[0], /changed while waiting/); p.assertAccounting();
});

for (const mode of ['missing-core', 'denied', 'null']) test('companion writer fails closed with ' + mode, async () => {
  const p = await fixture(); await loadReport(p); await p.reportClick('open');
  if (mode === 'missing-core') delete p.window.__TSIMM_WATCHLIST_API__.saveTraderBookSnapshot;
  else p.failLocks(mode);
  await p.reportClick('disconnect'); await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(bookWrites(p).length, 0);
  assert.equal(p.reportAlerts.length, 1); assert.equal(p.reloads, 0);
});

test('companion unprotected historical disconnect remains coordinated and usable', async () => {
  const p = await fixture(), ledger = p.memory.get(K.ledger); await loadReport(p); await p.reportClick('open');
  await p.reportClick('disconnect'); await p.drain();
  assert.equal(saved(p).pricePageCaptureCount, 0); assert.deepEqual(saved(p).pricePageItems, []);
  assert.equal(bookWrites(p).length, 1); assert.equal(p.reloads, 1); assert.deepEqual(p.reportAlerts, []);
  assert.equal(p.memory.get(K.ledger), ledger); assert.equal(p.memory.get(PENDING), p.originalPending);
});

test('valid import with reordered completion fields preserves the same proof and capture count', async () => {
  const p = await fixture(); p.link(); await p.drain();
  const original = JSON.stringify(saved(p).receiptLinkCompletions), incoming = book(p);
  incoming[0].receiptLinkCompletions = incoming[0].receiptLinkCompletions.map(entry => Object.fromEntries(Object.entries(entry).reverse()));
  p.sandbox.prompt = () => JSON.stringify(incoming); await p.clickAction('traders-import'); await p.drain();
  assert.equal(JSON.stringify(saved(p).receiptLinkCompletions), original); assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.match(feedback(p).at(-1), /Imported 1 traders/); p.assertAccounting();
});
