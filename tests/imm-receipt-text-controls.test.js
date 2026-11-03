const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, feedback, bookWrites, K, PENDING, hold, turn } = require('./helpers/imm-receipt-harness.cjs');

const valid = 'Fixture Item x2 @ $1234 = $2468';
const quantityFirst = '2 x Fixture Item @ $1,234 = $2,468';
const huge = '1' + '0'.repeat(308);
const saved = p => JSON.parse(p.memory.get(K.book)).find(row => row.id === 'a');
const supported = [
  [`Other Item x2 $${huge}`, Number(huge) / 2],
  ['Other Item x2 $2468', 1234],
  ['2 x Other Item $2468', 1234],
  ['Other Item × 2 $2,468', 1234],
  ['Other Item x2 @ $1234 = $2468', 1234],
  ['2 x Other Item @ $1,234 = $2,468', 1234],
];
for (const [row, expected] of supported) for (const order of ['first', 'last'])
  test(`finite text row ${order} retains supported unit/total fallback: ${row}`, async () => {
    const p = await fixture({ twoTraders: true });
    const input = order === 'first' ? `${row}\n${valid}` : `${valid}\n${row}`;
    p.input.value = input; await p.link(); await p.drain();
    const a = saved(p);
    assert.equal(a.pricePageItems.length, 2);
    assert.equal(a.pricePageItems.find(item => item.itemName === 'Other Item').unitPrice, expected);
    assert.equal(a.pricePageItems.find(item => item.itemName === 'Fixture Item').unitPrice, 1234);
    assert.equal(a.pricePageCaptureCount, 8);
    assert.equal(a.receiptLinkCompletions.length, 1);
    assert.equal(a.receiptLinkCompletions[0].parsedCount, 2);
    assert.equal(bookWrites(p).length, 1); assert.equal(p.memory.has(PENDING), false);
    assert.match(feedback(p).at(-1), /2 prices captured/); p.assertAccounting();
    await p.link(); await p.drain(); assert.equal(bookWrites(p).length, 1);
  });

for (const row of [`Other Item x2 @$${huge}`, 'Other Item x2 @ $-0.5 = $2',
  '2 × Other Item @ missing', 'Other Item x 0 @ $Infinity',
  'Other Itemx0 @ $NaN', 'Other Itemx-1 @ $1234 = $2468']) for (const order of ['first', 'last'])
  test(`malformed text row ${order} remains whole-capture rejection: ${row}`, async () => {
    const p = await fixture({ twoTraders: true });
    const input = order === 'first' ? `${row}\n${valid}` : `${valid}\n${row}`;
    p.input.value = input;
    for (let click = 0; click < 2; click++) {
      await p.link(); await p.drain();
      assert.equal(p.memory.get(K.book), p.originalBook);
      assert.equal(p.memory.get(PENDING), p.originalPending);
      assert.equal(bookWrites(p).length, 0);
      assert.match(feedback(p).at(-1), /not captured: invalid price/i);
      p.assertInput(input); p.assertAccounting();
    }
  });

for (const input of ['Widget x 2 @ $1234 = $2468', 'Widget × 2 @ $1234 = $2468',
  'Widgetx2 @ $1234 = $2468', '2xWidget @ $1234 = $2468'])
  test(`supported compact or spaced single-name row captures once: ${input}`, async () => {
    const p = await fixture(); p.input.value = input;
    await p.link(); await p.drain();
    assert.equal(saved(p).pricePageItems[0].itemName, 'Widget');
    assert.equal(saved(p).pricePageItems[0].unitPrice, 1234);
    assert.equal(saved(p).pricePageItems[0].quantity, 2);
    assert.equal(saved(p).pricePageCaptureCount, 8);
    assert.equal(saved(p).receiptLinkCompletions[0].parsedCount, 1);
    assert.equal(p.memory.has(PENDING), false); assert.equal(bookWrites(p).length, 1);
    p.assertAccounting(); await p.link(); await p.drain(); assert.equal(bookWrites(p).length, 1);
  });

for (const mode of ['denied', 'null']) test(`quantity-first finite receipt retains arm after ${mode} native grant`, async () => {
  const p = await fixture(); p.input.value = quantityFirst; p.failLocks(mode);
  await p.link(); await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook);
  assert.equal(p.memory.get(PENDING), p.originalPending); assert.equal(bookWrites(p).length, 0);
  assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
  p.assertInput(quantityFirst); p.assertAccounting();
});

for (const fault of ['set', 'readback']) test(`quantity-first receipt ${fault} fault preserves raw book and retry`, async () => {
  const p = await fixture(); p.input.value = quantityFirst;
  p.faults[fault] = K.book; p.faults.readbackOnce = true;
  await p.link(); await p.drain();
  assert.equal(p.memory.get(K.book), p.originalBook);
  assert.equal(p.memory.get(PENDING), p.originalPending);
  assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
  p.assertInput(quantityFirst); p.assertAccounting();
  delete p.faults[fault]; await p.link(); await p.drain();
  assert.equal(saved(p).pricePageItems[0].unitPrice, 1234);
  assert.equal(saved(p).pricePageCaptureCount, 8);
  assert.equal(saved(p).receiptLinkCompletions.length, 1);
  assert.equal(p.memory.has(PENDING), false); p.assertAccounting();
});

for (const id of ['a', 'b']) test(`quantity-first waiting receipt preserves newer ${id} arm`, async () => {
  const p = await fixture({ twoTraders: true }), holder = await hold(p);
  p.input.value = quantityFirst;
  const armed = p.arm(id); await turn(); const linked = p.link(); await turn();
  holder.release(); await holder.task; await armed; await linked; await p.drain();
  assert.notEqual(p.memory.get(PENDING), p.originalPending);
  assert.equal(JSON.parse(p.memory.get(PENDING)).traderId, id);
  assert.equal(p.memory.get(K.book), p.originalBook); assert.equal(bookWrites(p).length, 0);
  assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
  p.assertInput(quantityFirst); p.assertAccounting();
});
