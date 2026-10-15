const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, hold, secondContext, turn, feedback, bookWrites, runtime, K, PENDING, RECEIPT } = require('./helpers/imm-receipt-harness.cjs');

function retryAvailable(p) {
  assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.ok(p.overlay.innerHTML.includes('receipt-link-pending-trader'));
  assert.doesNotMatch(p.overlay.innerHTML.match(/<button[^>]*receipt-link-pending-trader[^>]*>/)[0], /disabled/);
  p.assertInput(RECEIPT);
}

test('real receipt action assimilates native grant and synchronous writer result with actual count', async () => {
  const p = await fixture(); p.link();
  assert.equal(p.memory.get(K.book), p.originalBook);
  assert.equal(p.memory.get(PENDING), p.originalPending);
  await p.drain();
  assert.equal(bookWrites(p).length, 1);
  assert.equal(JSON.parse(p.memory.get(K.book))[0].pricePageItems[0].unitPrice, 1000);
  assert.equal(p.memory.get(PENDING), undefined);
  assert.match(feedback(p).at(-1), /linked to this receipt.*1 prices captured/);
  p.assertInput(RECEIPT); p.assertAccounting();
});

test('held native competing lock retains original armed intent and unpreviewed receipt input', async () => {
  const p = await fixture(), holder = await hold(p);
  try {
    p.link(); await turn();
    assert.equal(p.memory.get(PENDING), p.originalPending);
    assert.equal(p.memory.get(K.book), p.originalBook);
    assert.ok(p.overlay.innerHTML.includes('receipt-link-pending-trader'));
    p.assertInput(RECEIPT);
    assert.ok(p.state.receiptTraderLinkPending);
  } finally { holder.release(); await holder.task; }
  await p.drain(); assert.equal(bookWrites(p).length, 1); p.assertAccounting();
});

for (const mode of ['denied', 'null']) test(`${mode} lock retains receipt-specific retry and accurate failure feedback`, async () => {
  const p = await fixture(); p.failLocks(mode); p.link(); await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); retryAvailable(p);
  assert.ok(feedback(p).some(text => /coordination unavailable or interrupted/.test(text)));
  assert.match(feedback(p).at(-1), /linked to this receipt.*prices not saved.*retry this receipt/);
  p.assertAccounting();
});

for (const interrupted of ['visibility', 'pagehide', 'timeout']) test(`${interrupted} aborts the native waiter without losing receipt recovery`, async () => {
  const p = await fixture(), holder = await hold(p);
  p.link(); await turn();
  if (interrupted === 'visibility') { p.document.hidden = true; p.fireEvent('visibilitychange'); }
  else if (interrupted === 'pagehide') p.fireEvent('pagehide');
  else { const [id, timer] = [...p.timers].find(([, entry]) => entry.delay === 5000); p.timers.delete(id); timer.fn(); }
  await p.drain(); holder.release(); await holder.task; await turn();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(bookWrites(p).length, 0);
  retryAvailable(p); assert.match(feedback(p).at(-1), /prices not saved/); p.assertAccounting();
});

for (const fault of ['set', 'readback']) test(`Trader Book ${fault} failure preserves exact bytes and retries without repaste`, async () => {
  const p = await fixture(); p.faults[fault] = K.book; p.faults.readbackOnce = true;
  p.link(); await p.drain();
  assert.equal(p.sandbox.localStorage.getItem(K.book), p.originalBook);
  retryAvailable(p); assert.ok(feedback(p).some(text => /Capture persistence failed/.test(text)));
  p.assertAccounting();
  p.faults.set = null; p.link(); await p.drain();
  assert.equal(JSON.parse(p.memory.get(K.book))[0].pricePageCaptureCount, 8);
  assert.equal(p.memory.get(PENDING), undefined); p.assertInput(RECEIPT); p.assertAccounting();
});

test('an intervening production queue rejects receipt capture without queue hijack or intent loss', async () => {
  const p = await fixture(), other = runtime({ memory: p.memory, clock: p.clock }); await other.ready;
  await other.api.startSavedTraderCaptureCarousel('all');
  const queue = p.memory.get(K.queue); p.memory.delete(K.queue);
  const holder = await hold(p); p.link(); await turn();
  p.memory.set(K.queue, queue); holder.release(); await holder.task; await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(p.memory.get(K.queue), queue);
  retryAvailable(p); assert.ok(feedback(p).some(text => /Finish or cancel the carousel/.test(text)));
  p.assertAccounting();
});

test('duplicate pending receipt taps make one price write and one metadata link', async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  p.link(); p.link(); assert.match(feedback(p).at(-1), /already pending/);
  assert.equal(p.writes.filter(([key]) => key === K.ledger).length, 1);
  holder.release(); await holder.task; await p.drain();
  assert.equal(bookWrites(p).length, 1); p.assertAccounting();
});

test('two cooperating receipt contexts consume one shared armed intent under the native grant', async () => {
  const p = await fixture(), other = await secondContext(p), holder = await hold(p);
  p.link(); other.link(); await turn(); holder.release(); await holder.task;
  await p.drain(); await other.drain();
  assert.equal(bookWrites(p).length + bookWrites(other).length, 1);
  assert.equal(JSON.parse(p.memory.get(K.book))[0].pricePageCaptureCount, 8);
  assert.equal(p.memory.get(PENDING), undefined);
  assert.equal(other.state.pendingTraderCapture, null);
  p.assertAccounting();
});

for (const id of ['b', 'a']) test(`rearming ${id === 'a' ? 'same trader in the same millisecond' : 'a different trader'} before grant cancels the old price intent only`, async () => {
  const p = await fixture({ twoTraders: true }), holder = await hold(p);
  const armed = p.arm(id); await turn(); p.link(); await turn();
  holder.release(); await holder.task; await armed; await p.drain();
  const newer = p.memory.get(PENDING);
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(p.memory.get(PENDING), newer);
  assert.equal(p.state.pendingTraderCapture.traderId, id); assert.match(feedback(p).at(-1), /prices not saved/);
  p.assertAccounting();
});

test('a new arming after verified writer completion survives the older await continuation', async () => {
  const p = await fixture({ twoTraders: true });
  let rearmed = false;
  p.sandbox.navigator.locks.request = (name, options, callback) => {
    const task = p.nativeRequest(name, options, lock => { const value = callback(lock); if (!rearmed) { rearmed = true; p.arm('b'); } return value; });
    p.requests.push(task); return task;
  };
  p.link(); await p.drain();
  assert.equal(p.state.pendingTraderCapture.traderId, 'b');
  assert.equal(JSON.parse(p.memory.get(PENDING)).traderId, 'b');
  assert.equal(bookWrites(p).length, 1); p.assertAccounting();
});

test('explicit clearing before grant never recreates the original intent or saves prices', async () => {
  const p = await fixture(), holder = await hold(p);
  const cleared = p.clickAction('trader-clear-capture'); await turn(); p.link(); await turn();
  holder.release(); await holder.task; await cleared; await p.drain();
  assert.equal(p.memory.get(PENDING), undefined); assert.equal(p.state.pendingTraderCapture, null);
  assert.equal(p.memory.get(K.book), p.originalBook); p.assertAccounting();
});

test('intent expiry before grant has no price write, resurrection or retry-success claim', async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  p.clock.now = JSON.parse(p.originalPending).expiresAt + 1;
  holder.release(); await holder.task; await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(p.memory.get(PENDING), undefined);
  assert.doesNotMatch(feedback(p).at(-1), /prices captured|Armed capture kept/); p.assertAccounting();
});

for (const change of ['clear', 'replace']) test(`another context ${change}s the persisted arm while this receipt waits`, async () => {
  const p = await fixture({ twoTraders: true }), other = await secondContext(p), holder = await hold(p);
  const changed = change === 'clear' ? other.clickAction('trader-clear-capture') : other.arm('b');
  await turn(); p.link(); await turn();
  holder.release(); await holder.task; await changed; await p.drain();
  const bytes = p.memory.get(PENDING);
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(p.memory.get(PENDING), bytes);
  assert.equal(p.state.pendingTraderCapture?.traderId ?? null, change === 'clear' ? null : 'b');
  p.assertAccounting();
});

test('expired cached arm cannot remove a replacement persisted by another context', async () => {
  const p = await fixture({ twoTraders: true }), other = await secondContext(p), holder = await hold(p);
  const armed = other.arm('b'); await turn(); p.link(); await turn();
  p.clock.now = JSON.parse(p.originalPending).expiresAt + 1;
  holder.release(); await holder.task; await armed; await p.drain();
  const bytes = p.memory.get(PENDING);
  assert.equal(p.memory.get(PENDING), bytes); assert.equal(p.state.pendingTraderCapture.traderId, 'b');
  assert.equal(p.memory.get(K.book), p.originalBook); p.assertAccounting();
});

test('closing the receipt while saving never reopens or replaces the draft on completion', async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  p.clickAction('receipt-audit-close'); holder.release(); await holder.task; await p.drain();
  assert.equal(p.document.getElementById('tornscripture-imm-receipt-audit'), null);
  assert.equal(p.state.receiptAuditDraft, null);
  assert.match(feedback(p).at(-1), /receipt sale-original.*1 prices captured/);
  assert.doesNotMatch(feedback(p).at(-1), /this receipt/); p.assertAccounting();
});

for (const id of ['sale-other', 'sale-original']) test(`opening ${id === 'sale-original' ? 'a fresh draft of the same receipt' : 'another receipt'} cannot be overwritten by old completion`, async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  const newerDraft = p.open(id, 'newer pasted text');
  newerDraft.rawText = 'newer pasted text';
  const html = p.overlay.innerHTML;
  holder.release(); await holder.task; await p.drain();
  assert.equal(p.state.receiptAuditDraft, newerDraft); assert.equal(p.overlay.innerHTML, html);
  assert.equal(p.input.value, 'newer pasted text');
  assert.match(feedback(p).at(-1), /receipt sale-original.*1 prices captured/);
  assert.doesNotMatch(feedback(p).at(-1), /this receipt/); p.assertAccounting();
});

test('edits to the same receipt input during the wait survive completion rerender', async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  p.input.value = '  a newer pasted receipt\n';
  holder.release(); await holder.task; await p.drain();
  p.assertInput('  a newer pasted receipt\n'); p.assertAccounting();
});

test('zero supported prices keep historical quotes and armed retry with explicit non-success feedback', async () => {
  const p = await fixture(); p.input.value = JSON.stringify({ items: [{ name: 'Fixture Item', quantity: 2, unitPrice: 0 }] });
  p.link(); await p.drain();
  const before = JSON.parse(p.originalBook)[0], after = JSON.parse(p.memory.get(K.book))[0];
  assert.deepEqual(after.pricePageItems, before.pricePageItems);
  for (const key of ['pricePageCapturedAt', 'pricePageUrl', 'previousPricePageUrl']) assert.equal(after[key], before[key]);
  assert.equal(after.pricePageCaptureCount, 8, 'existing direct check-count semantics retained');
  assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /no supported prices found; previous prices kept/);
  assert.doesNotMatch(feedback(p).at(-1), /prices captured/); p.assertAccounting();
});

test('successful book persistence and intent consumption both occur inside the existing grant', async () => {
  const p = await fixture(); let granted = false;
  const set = p.sandbox.localStorage.setItem, remove = p.sandbox.localStorage.removeItem;
  p.sandbox.localStorage.setItem = (key, value) => { if (key === K.book) assert.equal(granted, true); set(key, value); };
  p.sandbox.localStorage.removeItem = key => { if (key === PENDING) assert.equal(granted, true); remove(key); };
  p.sandbox.navigator.locks.request = (name, options, callback) => {
    const task = p.nativeRequest(name, options, lock => { granted = true; try { return callback(lock); } finally { granted = false; } });
    p.requests.push(task); return task;
  };
  p.link(); await p.drain(); assert.equal(bookWrites(p).length, 1); p.assertAccounting();
});

test('a failed save closed during acquisition preserves unpreviewed text for explicit reopen', async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  p.input.value = '  edited receipt before close\n'; p.clickAction('receipt-audit-close');
  p.document.hidden = true; p.fireEvent('visibilitychange'); await p.drain();
  holder.release(); await holder.task;
  assert.equal(p.state.receiptAuditDraft, null);
  assert.equal(p.document.getElementById('tornscripture-imm-receipt-audit'), null);
  p.open('sale-original', ''); p.assertInput('  edited receipt before close\n');
  assert.equal(p.memory.get(PENDING), p.originalPending); p.assertAccounting();
});

test('switching receipts on failure retains original input for later reopen without changing the newer draft', async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  const newer = p.open('sale-other', 'another receipt input');
  p.document.hidden = true; p.fireEvent('visibilitychange'); await p.drain();
  holder.release(); await holder.task;
  assert.equal(p.state.receiptAuditDraft, newer); assert.equal(p.input.value, 'another receipt input');
  p.open('sale-original', ''); p.assertInput(RECEIPT); p.assertAccounting();
});

test('linking another displayed receipt while a save is pending cannot add a second Ledger link', async () => {
  const p = await fixture(), holder = await hold(p); p.link(); await turn();
  const newer = p.open('sale-other', 'another receipt input'); p.link();
  assert.equal(p.writes.filter(([key]) => key === K.ledger).length, 1);
  assert.equal(p.state.receiptAuditDraft, newer);
  holder.release(); await holder.task; await p.drain(); p.assertAccounting();
});

test('denied acquisition can retry the same receipt without rearming or repasting', async () => {
  const p = await fixture(); p.failLocks('denied'); p.link(); await p.drain(); retryAvailable(p);
  p.sandbox.navigator.locks.request = (...args) => {
    const task = p.nativeRequest(...args); p.requests.push(task); return task;
  };
  p.link(); await p.drain();
  assert.equal(bookWrites(p).length, 1); assert.equal(p.memory.get(PENDING), undefined);
  p.assertInput(RECEIPT); p.assertAccounting();
});

test('zero supported prices with no historical snapshot keep the intent without claiming capture success', async () => {
  const p = await fixture();
  const book = JSON.parse(p.memory.get(K.book)); book[0].pricePageItems = [];
  p.memory.set(K.book, JSON.stringify(book)); p.input.value = '';
  p.link(); await p.drain();
  assert.deepEqual(JSON.parse(p.memory.get(K.book))[0].pricePageItems, []);
  assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /no supported prices found/);
  assert.doesNotMatch(feedback(p).at(-1), /prices captured|previous prices kept/); p.assertAccounting();
});
