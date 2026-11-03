const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, feedback, bookWrites, K, PENDING } = require('./helpers/imm-receipt-harness.cjs');
const valid = 'Fixture Item x2 @ $1234 = $2468';
const saved = p => JSON.parse(p.memory.get(K.book)).find(row => row.id === 'a');
async function attempt(input) {
  const p = await fixture({ twoTraders: true }); p.input.value = input;
  const before = { book: p.memory.get(K.book), arm: p.memory.get(PENDING) };
  await p.link(); await p.drain();
  return { p, before };
}
function rejected(p, before, input) {
  assert.equal(p.memory.get(K.book), before.book, 'whole malformed receipt preserves raw book');
  assert.equal(bookWrites(p).length, 0, 'admission failure never reaches book writer');
  assert.equal(p.memory.get(PENDING), before.arm, 'strong arm retained exactly');
  assert.equal(saved(p).pricePageItems[0].unitPrice, 500);
  assert.equal(saved(p).pricePageCaptureCount, 7);
  assert.equal(saved(p).pricePageCapturedAt, '2026-10-01T12:00:00.000Z');
  assert.equal(saved(p).receiptLinkCompletions.length, 0);
  assert.match(feedback(p).at(-1), /not captured: invalid price/i);
  assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
  assert.equal(p.input.value, input); p.assertInput(input); p.assertAccounting();
}
const malformed = [
  ...['Infinity', 'NaN', '1e400'].map(token => `Other Item x0 @ $${token}`),
  ...['0', '-1', '1.5', '1e400', 'Infinity', 'NaN', 'bad', '9007199254740992', '1,,2', ''].map(q => `Other Item x${q} @ $1234 = $2468`),
  ...['-1', '0', '1.5', '1e400', 'Infinity', 'NaN', 'bad'].map(q => `${q} x Other Item @ $1234 = $2468`),
  ...['Infinity', '-Infinity', 'NaN', '1e400', '1e3', 'bad', '12oops', '1.2.3', '1,,234', '1,23', ''].map(token => `Other Item x2 @ $${token} = $2468`),
  'Other Item x2 @ $1234 = $Infinity', 'Other Item x2 @ $1234 = $1e400',
  'Other Item x2 @ $1234 = $1.2.3', 'Other Item x2 @ missing',
  'Other Item x2', 'Other Item x2 @ $0 = $2468', 'Other Item x2 @ $1234 = $0',
  'Other Item x2 @ $1' + '0'.repeat(309),
  'Other Item x2 @ $' + '1' + '0'.repeat(308),
  '2xOther Item @ $NaN', '-1xOther Item @ $1234',
];
for (const bad of malformed) for (const order of ['valid-first', 'invalid-first'])
  test(`whole receipt rejects ${order}: ${bad}`, async () => {
    const input = order === 'valid-first' ? valid + '\n' + bad : bad + '\n' + valid;
    const { p, before } = await attempt(input); rejected(p, before, input);
    await p.link(); await p.drain(); rejected(p, before, input);
  });
for (const input of ['Other Item x0 @ $Infinity', 'Other Item x-1 @ $1234', 'Other Item x2 @ $NaN', 'Other Item x2 @ missing'])
  test('no surviving parsed items still reject: ' + input, async () => {
    const { p, before } = await attempt(input); rejected(p, before, input);
  });
const healthy = [valid, 'Fixture Item × 2 @ $1,234 = $2,468', '2 x Fixture Item @ $1,234 = $2,468',
  '2xFixture Item @ $1234 = $2468', 'Fixture Itemx2 @ $1234 = $2468',
  'Fixture Item x2 $2468', 'Fixture Item x2 @ $1,234 (total $2,468)',
  'Fixture Item x2 @ $1234.50 = $2469.00', 'Fixture Item x1 @ $.50 = $.50'];
for (const input of healthy) test('supported finite format retains exactly-once save: ' + input, async () => {
  const { p } = await attempt(input); const a = saved(p);
  const expected = input.includes('1234.50') ? 1234.5 : input.includes('$.50') ? 0.5 : 1234;
  assert.equal(a.pricePageItems[0].unitPrice, expected); assert.equal(a.pricePageCaptureCount, 8);
  assert.equal(a.receiptLinkCompletions.length, 1); assert.equal(a.receiptLinkCompletions[0].parsedCount, 1);
  assert.equal(p.memory.has(PENDING), false); assert.equal(bookWrites(p).length, 1); p.assertAccounting();
  await p.link(); await p.drain(); assert.equal(bookWrites(p).length, 1);
});
const benign = [
  'Notes: saved $20 on this trade', 'Heading: prices in $USD', 'Budget is $Infinity for this example.',
  'https://www.torn.com/trade.php?ID=987654&note=$NaN', 'Total: $2468',
  'Grand total: $2468', 'Receipt total: $2468', 'Cash received: $2468',
  'Thanks for your $2468 purchase', 'Buyer: Example $100', 'Seller: Example $100',
  'Receipt heading $USD', 'Trade completed $2468',
];
for (const line of benign) test('benign currency prose preserves healthy capture: ' + line, async () => {
  const { p } = await attempt(line + '\n' + valid + '\n' + line);
  assert.equal(saved(p).pricePageItems[0].unitPrice, 1234);
  assert.equal(saved(p).receiptLinkCompletions[0].parsedCount, 1);
  assert.equal(bookWrites(p).length, 1); assert.equal(p.memory.has(PENDING), false); p.assertAccounting();
});
