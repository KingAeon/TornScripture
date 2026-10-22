'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trader, Element, runtime } = require('./helpers/imm-capture-harness.cjs');
const { fixture, hold, secondContext, turn, feedback, bookWrites, K, PENDING } = require('./helpers/imm-receipt-harness.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const rows = p => { const raw = JSON.parse(p.memory.get(K.book)); return Array.isArray(raw) ? raw : raw.traders; };
const saved = p => rows(p).find(t => t.id === 'a');
const canonical = () => ({ itemId: 1, itemName: 'Fixture Item', unitPrice: 500, quantity: 2,
  sourceText: 'captured original offer', condition: { minQuantity: 2, ownerEvidence: 'raw historical context', nested: [false, null, { future: ['a', 4] }] } });
const legacy = () => ({ id: 1, name: 'Fixture Item', price: '500', qty: 2, text: 'legacy original offer', condition: { minQuantity: 2 } });
function history(t, mode, now) {
  if (mode === 'H0') return t;
  const e = { intent: 'carousel', runId: `old-run-${t.id}`, entryId: `old-entry-${t.id}`,
    attemptId: `old-attempt-${t.id}`, traderRecordId: t.id, expectedTornId: t.userId,
    sourceUrl: `https://weav3r.dev/pricelist/${t.userId}`, provider: 'weav3r',
    issuedAt: now - 1000000, deadline: now - 940000, expiresAt: now - 100000 };
  const r = { runId: e.runId, entryId: e.entryId, attemptId: e.attemptId, expiresAt: e.expiresAt };
  t.pricePageCaptureReceipts = [r];
  if (mode === 'H2') t.pricePageLastCaptureReceipt = { ...r, envelope: e, outcome: 'captured' };
  return t;
}
const attemptFields = ['pricePageLastCheckedAt', 'pricePageCaptureCount', 'pricePageLastOutcome',
  'pricePageLastReason', 'pricePageLastResult', 'updatedAt'];
function historicalFields(row) { const value = clone(row); for (const key of attemptFields) delete value[key]; return value; }
function financialUnchanged(p) {
  assert.equal(p.memory.get(K.ledger), p.originalLedger);
  for (const [key, bytes] of p.protectedBytes) assert.equal(p.memory.get(key), bytes, key);
}
function rejectedReceipt(p, before) {
  assert.equal(p.memory.get(K.book), before.book, 'the entire original book remains byte-exact');
  assert.equal(p.memory.get(PENDING), before.arm, 'invalid price retains the exact strong arm');
  assert.equal(bookWrites(p).length, before.writes, 'invalid price never attempts a book write');
  assert.match(feedback(p).at(-1), /not captured: invalid price/i);
  assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
  p.assertInput(before.input); p.assertAccounting();
}
async function receiptAttempt(input, configure) {
  const p = await fixture({ twoTraders: true });
  if (configure) configure(p);
  p.input.value = input;
  const before = { book: p.memory.get(K.book), arm: p.memory.get(PENDING), writes: bookWrites(p).length, input };
  await p.link(); await p.drain();
  return { p, before };
}
function receipt(items, root = 'object') {
  const list = `[${items.join(',')}]`;
  if (root === 'array') return list;
  if (root === 'nested') return `{"metadata":[{"name":"not a receipt","unitPrice":12}],"data":{"receipt":{"entries":${list}}}}`;
  return `{"items":${list},"receiptUrl":"https://www.torn.com/trade.php?ID=987654"}`;
}
const unitAliases = ['unitPrice', 'unit_price', 'priceUsed', 'price_each', 'price', 'cost_each', 'item.price'];
function itemWithPrice(alias, literal, total = '2468') {
  const price = alias === 'item.price' ? `"item":{"price":${literal}}` : `"${alias}":${literal}`;
  return `{"itemId":1,"itemName":"Fixture Item","quantity":2,${price},"totalValue":${total}}`;
}

for (const root of ['array', 'wrapper']) for (const representation of ['canonical', 'aliases', 'pricing-only', 'both', 'empty', 'null', 'absent'])
  for (const mode of ['H0', 'H1', 'H2']) test(`RH raw ${root}/${representation}/${mode}: repeated actual empty checks preserve field presence and history`, async () => {
    const p = await fixture({ twoTraders: true });
    const t = history(trader(), mode, p.clock.now), other = history(trader('b', 123456, 'Other Trader'), 'H1', p.clock.now);
    t.pricePageItems = [canonical(), { ...legacy(), id: 2, name: 'Another Item' }];
    if (representation === 'aliases') t.pricePageItems = [legacy(), canonical()];
    if (representation === 'pricing-only' || representation === 'both') t.pricingItems = [legacy()];
    if (representation === 'pricing-only') {
      delete t.pricePageItems; t.pricingPageUrl = t.pricePageUrl; delete t.pricePageUrl;
      t.pricesCapturedAt = t.pricePageCapturedAt; delete t.pricePageCapturedAt;
      delete t.previousPricePageUrl; delete t.pricePageTitle;
    }
    if (representation === 'empty') t.pricePageItems = [];
    if (representation === 'null') { t.pricePageItems = null; t.pricePageCapturedAt = null; }
    if (representation === 'absent') { delete t.pricePageItems; delete t.pricingItems; }
    const raw = root === 'array' ? [t, other] : { schemaVersion: 3, unknown: { future: [1, false, null] }, traders: [t, other] };
    // This post-initialization authoritative update deliberately differs from the cached UI row.
    p.memory.set(K.book, JSON.stringify(raw));
    const old = clone(t), oldOther = clone(other), arm = p.memory.get(PENDING);
    p.document.body.cloneNode = () => new Element('A page with no supported prices');
    for (let attempt = 1; attempt <= 2; attempt++) {
      p.clock.now += 1000; await p.clickAction('trader-capture-current-page'); await turn();
      const next = saved(p);
      assert.deepEqual(historicalFields(next), historicalFields(old));
      assert.deepEqual(rows(p)[1], oldOther);
      assert.equal(Object.hasOwn(next, 'pricePageItems'), Object.hasOwn(old, 'pricePageItems'));
      assert.equal(Object.hasOwn(next, 'pricingItems'), Object.hasOwn(old, 'pricingItems'));
      assert.equal(next.pricePageCaptureCount, 7 + attempt, 'frozen check-count semantics stay distinct from success');
      assert.equal(next.pricePageLastOutcome, 'loading_or_inconclusive');
      assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
      if (root === 'wrapper') assert.deepEqual(JSON.parse(p.memory.get(K.book)).unknown, raw.unknown);
      assert.equal(p.memory.get(PENDING), arm); financialUnchanged(p);
    }
  });

const badPrices = ['1e400', '"1e400"', '"Infinity"', '-1e400', '"-Infinity"', '"NaN"', '"not a number"', 'null', 'true', '{}', '[]', '0'];
for (const alias of unitAliases) for (const bad of badPrices) test(`NF explicit ${alias}=${bad} cannot fallback to a positive total`, async () => {
  const { p, before } = await receiptAttempt(receipt([itemWithPrice(alias, bad)])); rejectedReceipt(p, before);
});
for (const alias of unitAliases) test(`NF mixed valid plus nonfinite ${alias} fails the whole price save`, async () => {
  const { p, before } = await receiptAttempt(receipt([itemWithPrice('unitPrice', '1234'), itemWithPrice(alias, '1e400')])); rejectedReceipt(p, before);
});
for (const total of ['totalValue', 'total_value', 'totalPrice', 'total_price', 'value', 'proceeds'])
  for (const bad of ['1e400', '"NaN"', 'null']) test(`NF explicit line ${total}=${bad} cannot be replaced by computed total`, async () => {
    const row = `{"itemId":1,"itemName":"Fixture Item","quantity":2,"unitPrice":1234,"${total}":${bad}}`;
    const { p, before } = await receiptAttempt(receipt([row])); rejectedReceipt(p, before);
  });
for (const invalid of [
  '{"itemId":1,"itemName":"Fixture Item","quantity":2,"unitPrice":1e308}',
  '{"itemId":1,"itemName":"Fixture Item","quantity":1e400,"unitPrice":1234}',
  '{"itemId":1,"itemName":"Fixture Item","quantity":9007199254740992,"unitPrice":1}',
  '{"itemId":1,"itemName":"Fixture Item","quantity":0.5,"unitPrice":1234}',
]) test(`NF invalid derived price/quantity ${invalid}`, async () => {
  const { p, before } = await receiptAttempt(receipt([invalid])); rejectedReceipt(p, before);
});
test('NF individually finite items whose aggregate overflows fail before completion', async () => {
  const row = '{"itemId":1,"itemName":"Fixture Item","quantity":1,"unitPrice":1e308}';
  const { p, before } = await receiptAttempt(receipt([row, row])); rejectedReceipt(p, before);
});
test('NF positive total whose derived unit underflows cannot become a no-price check', async () => {
  const { p, before } = await receiptAttempt(receipt(['{"itemId":1,"itemName":"Fixture Item","quantity":2,"totalValue":5e-324}']));
  rejectedReceipt(p, before);
});
for (const bad of ['{"itemId":1,"itemName":"Fixture Item","quantity":0,"unitPrice":1e400}',
  '{"itemId":1,"itemName":"Fixture Item","unitPrice":1e400}', 'false']) test(`NF raw rejected rows cannot disappear beside valid items: ${bad}`, async () => {
  const { p, before } = await receiptAttempt(receipt([itemWithPrice('unitPrice', '1234'), bad])); rejectedReceipt(p, before);
});
test('NF an entirely unsupported raw item cannot turn into an empty checked receipt', async () => {
  const { p, before } = await receiptAttempt(receipt(['{"itemId":1,"itemName":"Fixture Item","quantity":0,"unitPrice":1e400}']));
  rejectedReceipt(p, before);
});

for (const root of ['array', 'object', 'nested']) for (const mode of ['number', 'numeric-string', 'missing-unit-fallback'])
  test(`finite receipt ${root}/${mode} commits prices and marker once`, async () => {
    const row = mode === 'missing-unit-fallback'
      ? '{"itemId":1,"itemName":"Fixture Item","quantity":2,"totalValue":2468}'
      : itemWithPrice('unitPrice', mode === 'number' ? '1234' : '"1234"');
    const { p } = await receiptAttempt(receipt([row], root));
    const t = saved(p); assert.equal(t.pricePageItems[0].unitPrice, 1234);
    assert.equal(t.pricePageItems[0].quantity, 2); assert.equal(t.pricePageCaptureCount, 8);
    assert.equal(t.receiptLinkCompletions.length, 1); assert.equal(t.receiptLinkCompletions[0].parsedCount, 1);
    assert.equal(p.memory.has(PENDING), false); assert.equal(bookWrites(p).length, 1);
    assert.match(feedback(p).at(-1), /1 prices captured/); p.assertAccounting();
    await p.link(); await p.drain(); assert.equal(bookWrites(p).length, 1, 'duplicate click cannot capture again');
  });
for (const total of ['totalValue', 'total_value', 'totalPrice', 'total_price', 'value', 'proceeds'])
  test(`genuinely missing unit retains supported ${total}/quantity fallback`, async () => {
    const { p } = await receiptAttempt(receipt([`{"itemId":1,"itemName":"Fixture Item","quantity":2,"${total}":"2468"}`]));
    assert.equal(saved(p).pricePageItems[0].unitPrice, 1234); assert.equal(p.memory.has(PENDING), false); p.assertAccounting();
  });
for (const [price, quantity] of [[1e308, 1], [1234.5, 2]]) test(`finite price ${price} survives actual JSON storage without an economic cap`, async () => {
  const { p } = await receiptAttempt(receipt([JSON.stringify({ itemId: 1, itemName: 'Fixture Item', quantity, unitPrice: price })]));
  const item = saved(p).pricePageItems[0]; assert.equal(item.unitPrice, price);
  assert.ok(Number.isFinite(item.unitPrice * item.quantity)); assert.equal(p.memory.has(PENDING), false); p.assertAccounting();
});
test('the established all-zero receipt stays an unsuccessful check, retaining raw history and arm', async () => {
  const input = receipt(['{"itemId":1,"itemName":"Fixture Item","quantity":2,"unitPrice":0}']);
  const { p, before } = await receiptAttempt(input, p => { const t = rows(p); t.find(row => row.id === 'a').pricePageItems = [canonical()]; p.memory.set(K.book, JSON.stringify(t)); });
  assert.deepEqual(saved(p).pricePageItems, JSON.parse(before.book).find(row => row.id === 'a').pricePageItems);
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(p.memory.get(PENDING), before.arm);
  assert.equal(saved(p).receiptLinkCompletions?.length || 0, 0); assert.match(feedback(p).at(-1), /no supported prices found/); p.assertAccounting();
});
test('a zero observation cannot be dropped to manufacture a partial positive receipt', async () => {
  const { p, before } = await receiptAttempt(receipt([itemWithPrice('unitPrice', '1234'),
    '{"itemId":2,"itemName":"Other Item","quantity":1,"unitPrice":0}'])); rejectedReceipt(p, before);
});

for (const unitPrice of [Infinity, -Infinity, NaN, 'Infinity', 'bad', null]) test(`final direct save rejects ${String(unitPrice)} even without receipt preparation`, async () => {
  const p = await fixture(), before = p.memory.get(K.book), arm = p.memory.get(PENDING);
  const core = runtime({ memory: p.memory, clock: p.clock }); await core.ready;
  assert.equal(await core.api.saveTraderPriceCapture(core.api.state.traders.find(t => t.id === 'a'), {
    items: [{ itemId: 1, itemName: 'Fixture Item', quantity: 2, unitPrice }],
  }), null);
  assert.equal(p.memory.get(K.book), before); assert.equal(p.memory.get(PENDING), arm);
  assert.equal(bookWrites(p).length + bookWrites(core).length, 0); assert.match(feedback(core).at(-1), /not captured: invalid price/i); financialUnchanged(p);
});
test('final direct save rejects mixed unsupported rows before lossy filtering', async () => {
  const p = await fixture(), before = p.memory.get(K.book);
  const core = runtime({ memory: p.memory, clock: p.clock }); await core.ready;
  assert.equal(await core.api.saveTraderPriceCapture(core.api.state.traders.find(t => t.id === 'a'), { items: [canonical(), { nonsense: true }] }), null);
  assert.equal(p.memory.get(K.book), before); assert.equal(bookWrites(p).length + bookWrites(core).length, 0); financialUnchanged(p);
});
for (const mode of ['H1', 'H2']) test(`positive receipt preserves valid ${mode} provider proof independently`, async () => {
  const { p, before } = await receiptAttempt(receipt([itemWithPrice('unitPrice', '1234')]), p => {
    const t = rows(p); history(t.find(row => row.id === 'a'), mode, p.clock.now); p.memory.set(K.book, JSON.stringify(t));
  });
  const old = JSON.parse(before.book).find(row => row.id === 'a'), next = saved(p);
  assert.deepEqual(next.pricePageCaptureReceipts, old.pricePageCaptureReceipts);
  assert.deepEqual(next.pricePageLastCaptureReceipt, old.pricePageLastCaptureReceipt);
  assert.equal(next.pricePageItems[0].unitPrice, 1234); p.assertAccounting();
});
for (const target of [0, 1]) for (const route of ['receipt', 'empty-page']) test(`H3 ${target ? 'neighbor' : 'target'} proof blocks ${route} without normalization`, async () => {
  const p = await fixture({ twoTraders: true }), t = rows(p);
  const corrupt = t.find(row => row.id === (target === 0 ? 'a' : 'b'));
  history(corrupt, 'H2', p.clock.now); corrupt.pricePageLastCaptureReceipt.envelope.provider = 'unknown';
  p.memory.set(K.book, JSON.stringify(t)); const before = p.memory.get(K.book), arm = p.memory.get(PENDING);
  if (route === 'receipt') { await p.link(); await p.drain(); p.assertAccounting(); }
  else { p.document.body.cloneNode = () => new Element('No supported prices'); await p.clickAction('trader-capture-current-page'); await turn(); financialUnchanged(p); }
  assert.equal(p.memory.get(K.book), before); assert.equal(p.memory.get(PENDING), arm); assert.equal(bookWrites(p).length, 0);
});
for (const fault of ['set', 'readback']) for (const route of ['receipt', 'empty-page']) test(`${route} ${fault} failure preserves raw book and recoverable arm`, async () => {
  const p = await fixture(), t = rows(p); t[0].pricePageItems = [canonical()]; p.memory.set(K.book, JSON.stringify(t));
  const before = p.memory.get(K.book), arm = p.memory.get(PENDING);
  p.faults[fault] = K.book; p.faults.readbackOnce = true;
  if (route === 'receipt') { await p.link(); await p.drain(); p.assertAccounting(); }
  else { p.document.body.cloneNode = () => new Element('No supported prices'); await p.clickAction('trader-capture-current-page'); await turn(); financialUnchanged(p); }
  assert.equal(p.memory.get(K.book), before); assert.equal(p.memory.get(PENDING), arm);
  assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
});
test('raw overflowing historical extension remains exportable, with no lossy failed-check write', async () => {
  const p = await fixture(), t = rows(p); t[0].pricePageItems = [canonical()];
  t[0].pricePageItems[0].condition.future = 'RAW-OVERFLOW';
  const before = JSON.stringify({ traders: t, opaque: true }).replace('"RAW-OVERFLOW"', '1e400');
  p.memory.set(K.book, before); p.document.body.cloneNode = () => new Element('No supported prices');
  await p.clickAction('trader-capture-current-page'); await turn();
  assert.equal(p.memory.get(K.book), before); assert.equal(bookWrites(p).length, 0); financialUnchanged(p);
  let exported; p.sandbox.navigator.clipboard = { writeText: async value => { exported = value; } };
  await p.clickAction('traders-copy'); await turn(); assert.equal(exported, before);
});
test('rejected invalid prices cannot clear a concurrent newly committed strong arm', async () => {
  const p = await fixture({ twoTraders: true }), other = await secondContext(p), held = await hold(p);
  p.input.value = receipt([itemWithPrice('unitPrice', '1e400')]);
  const armed = other.arm('b'); await turn(); const attempted = p.link(); await turn();
  held.release(); await held.task; await armed; await attempted; await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(bookWrites(p).length, 0);
  assert.equal(JSON.parse(p.memory.get(PENDING)).traderId, 'b'); p.assertAccounting();
});
test('finite success with cleanup failure reconciles the original completion instead of capturing twice', async () => {
  const p = await fixture(); p.input.value = receipt([itemWithPrice('unitPrice', '1234')]);
  const remove = p.sandbox.localStorage.removeItem;
  p.sandbox.localStorage.removeItem = key => { if (key === PENDING) throw Error('cleanup'); return remove(key); };
  await p.link(); await p.drain(); await p.link(); await p.drain();
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(saved(p).receiptLinkCompletions.length, 1);
  assert.equal(bookWrites(p).length, 1); assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.match(feedback(p).at(-1), /already captured.*no new price write/); p.assertAccounting();
});

for (const token of ['Infinity', '-Infinity', 'NaN', '1e400', '1e3', 'bad', '1.2.3'])
  for (const position of ['unit', 'total']) test(`text receipt ${position} ${token} cannot disappear into a finite fallback`, async () => {
    const input = position === 'unit' ? `Fixture Item x2 @ $${token} = $2468` : `Fixture Item x2 @ $1234 = $${token}`;
    const { p, before } = await receiptAttempt(input); rejectedReceipt(p, before);
  });
for (const input of ['Fixture Item x2 @ $1,234 = $2,468', 'Fixture Item x2 @ $1,234 (total $2,468)', 'Fixture Item x2 $2,468'])
  test('supported formatted text receipt remains usable: '+input, async () => {
    const { p } = await receiptAttempt(input);
    assert.equal(saved(p).pricePageItems[0].unitPrice, 1234); assert.equal(saved(p).pricePageCaptureCount, 8);
    assert.equal(p.memory.has(PENDING), false); assert.equal(bookWrites(p).length, 1); p.assertAccounting();
  });
test('one malformed text line blocks all otherwise valid receipt prices', async () => {
  const { p, before } = await receiptAttempt('Fixture Item x2 @ $1234 = $2468\nOther Item x1 @ $Infinity = $20');
  rejectedReceipt(p, before);
});
test('all-zero text receipt retains the frozen non-successful check semantics', async () => {
  const { p, before } = await receiptAttempt('Fixture Item x2 $0');
  assert.deepEqual(saved(p).pricePageItems, JSON.parse(before.book).find(row => row.id === 'a').pricePageItems);
  assert.equal(saved(p).pricePageCaptureCount, 8); assert.equal(p.memory.get(PENDING), before.arm);
  assert.equal(saved(p).receiptLinkCompletions?.length || 0, 0); p.assertAccounting();
});
