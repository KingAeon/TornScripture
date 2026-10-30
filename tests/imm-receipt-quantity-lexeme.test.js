const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { fixture, K, PENDING, feedback, bookWrites, hold, turn } = require('./helpers/imm-receipt-harness.cjs');
const good = 'Fixture Item x2 @ $1234 = $2468';
const raw = [];
test.after(() => { if (process.env.QUANTITY_RAW) fs.writeFileSync(process.env.QUANTITY_RAW, JSON.stringify(raw, null, 2)); });
const snapshot = p => ({ memory: Object.fromEntries(p.memory), session: Object.fromEntries(p.session),
  input: p.input.value, writes: JSON.parse(JSON.stringify(p.writes)), feedback: feedback(p) });
const row = p => JSON.parse(p.memory.get(K.book)).find(entry => entry.id === 'a');
async function setup(catalog) {
  const p = await fixture({ twoTraders: true });
  if (catalog) {
    for (const [id, name] of [[2, 'Other Item'], [3, 'Cash Item'], [4, 'Receipt: Other Item']]) {
      const item = { id, name, normalizedName: name.toLowerCase().replace(/[^a-z0-9'+&-]+/g, ' ').trim() };
      p.state.catalog.itemsByName[item.normalizedName] = item; p.state.catalog.itemsById[id] = item;
    }
  }
  const book = JSON.parse(p.memory.get(K.book)), a = book.find(entry => entry.id === 'a');
  a.pricePageItems[0].condition = { opaque: ['retain', { nested: true }] };
  a.pricingItems = [{ id: 2, name: 'legacy', price: '500', qty: 1, unknown: [false, null] }];
  a.unknown = { retain: ' exact bytes ' }; p.memory.set(K.book, JSON.stringify(book));
  return p;
}
async function reject(p, input) {
  p.input.value = input; const before = snapshot(p);
  for (let click = 0; click < 2; click++) {
    await p.link(); await p.drain(); raw.push({ input, click, before, after: snapshot(p) });
    assert.equal(p.memory.get(K.book), before.memory[K.book]); assert.equal(bookWrites(p).length, 0);
    assert.equal(p.memory.get(PENDING), before.memory[PENDING]);
    const a = row(p); assert.equal(a.pricePageItems[0].unitPrice, 500); assert.equal(a.pricePageCaptureCount, 7);
    assert.equal(a.pricePageCapturedAt, '2026-10-01T12:00:00.000Z'); assert.equal(a.receiptLinkCompletions.length, 0);
    assert.match(feedback(p).at(-1), /not captured: invalid price/i);
    p.assertInput(input); p.assertAccounting();
  }
}
const corrupt = ['2;garbage', '2:garbage', '2(garbage)', '2|garbage', '2)garbage', '2[garbage]',
  '2/1', '2e3', '2e400', '2oops', '-2', '+2', '0', '1.5', '9007199254740992', '2,00',
  '2 ;garbage', '2 :garbage', '2 (garbage)', '2 | garbage'];
for (const catalog of [false, true]) for (const first of [false, true]) for (const quantity of corrupt)
  for (const form of ['name-first', 'quantity-first']) test(`full quantity ${catalog} ${first} ${form}: ${quantity}`, async () => {
    const p = await setup(catalog);
    const bad = form === 'name-first' ? `Other Item × ${quantity} @ $1234 = $2468`
      : `${quantity}xOther Item @ $1234 = $2468`;
    await reject(p, first ? bad + '\n' + good : good + '\n' + bad);
  });
const supported = ['Other Itemx2 @ $1234 = $2468', '2xOther Item @ $1234 = $2468',
  'Other Item × 2 @ $1234 (total $2468)', '2 × Other Item $2468',
  'Other Item x 2 $2468', 'Other Item x2 | @ $1234 = $2468',
  'Other Item x2; @ $1234 = $2468', 'Other Item x2: @ $1234 = $2468',
  'Other Item x1,234 @ $2 = $2468', '1,234 × Other Item @ $2 = $2468',
  'oThEr ItEm\u00a0×\u00a02 @ 1234 = $2468', 'Other Item x2 @ $1234 = 2468',
  '2 x Cash Item @ $1234 = $2468', '2 x Receipt: Other Item @ $1234 = $2468'];
for (const catalog of [false, true]) for (const first of [false, true]) for (const line of supported)
  test(`quantity compatibility ${catalog} ${first}: ${line}`, async () => {
    const p = await setup(catalog); p.input.value = (first ? line + '\n' + good : good + '\n' + line)
      + '\nReceipt: prices below\nCash received: $4936\nThanks for your purchase.';
    const before = snapshot(p); await Promise.all([p.link(), p.link()]); await p.drain();
    raw.push({ input: p.input.value, before, after: snapshot(p) });
    assert.equal(bookWrites(p).length, 1); assert.equal(row(p).pricePageCaptureCount, 8);
    assert.equal(row(p).receiptLinkCompletions[0].parsedCount, 2); assert.equal(p.memory.has(PENDING), false);
    await p.link(); await p.drain(); assert.equal(bookWrites(p).length, 1); p.assertAccounting();
  });
test('quantity rejection retains same arm for correction and exactly one write', async () => {
  const p = await setup(true); await reject(p, good + '\nOther Item x2(garbage) @ $1234 = $2468');
  p.input.value = good + '\nOther Item x2 @ $1234 = $2468';
  await p.link(); await p.drain(); await p.link(); await p.drain();
  assert.equal(bookWrites(p).length, 1); assert.equal(row(p).pricePageCaptureCount, 8);
  assert.equal(row(p).receiptLinkCompletions.length, 1); p.assertAccounting();
});
for (const mode of ['set', 'readback']) test('corrected quantity retains arm on writer failure ' + mode, async () => {
  const p = await setup(false); await reject(p, good + '\nOther Item x2;garbage @ $1234 = $2468');
  p.input.value = good; const before = snapshot(p); p.faults[mode] = K.book; p.faults.readbackOnce = true;
  await p.link(); await p.drain(); assert.equal(p.memory.get(K.book), before.memory[K.book]);
  assert.equal(p.memory.get(PENDING), before.memory[PENDING]); delete p.faults[mode];
  await p.link(); await p.drain(); await p.link(); await p.drain();
  assert.equal(row(p).pricePageCaptureCount, 8); assert.equal(row(p).receiptLinkCompletions.length, 1); p.assertAccounting();
});
test('corrected quantity waits for actual native exclusive grant', async () => {
  const p = await setup(false); await reject(p, good + '\nOther Item x2:garbage @ $1234 = $2468');
  p.input.value = good; const holder = await hold(p), task = p.link(); await turn();
  assert.equal(bookWrites(p).length, 0); holder.release(); await holder.task; await task; await p.drain();
  assert.equal(bookWrites(p).length, 1); assert.equal(row(p).receiptLinkCompletions.length, 1); p.assertAccounting();
});
