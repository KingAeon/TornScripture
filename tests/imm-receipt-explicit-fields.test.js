const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, feedback, bookWrites, K, PENDING } = require('./helpers/imm-receipt-harness.cjs');

const good = 'Fixture Item x2 @ $1234 = $2468';
const row = p => JSON.parse(p.memory.get(K.book)).find(entry => entry.id === 'a');
const snapshots = [];
test.after(() => {
  if (process.env.ADMISSION_RAW) require('node:fs').writeFileSync(process.env.ADMISSION_RAW,
    JSON.stringify(snapshots, null, 2) + '\n');
});
const snapshot = p => ({ memory: Object.fromEntries(p.memory), session: Object.fromEntries(p.session),
  input: p.input.value, feedback: feedback(p), writes: p.writes.slice() });

async function rejectReceipt(input) {
  const p = await fixture({ twoTraders: true }); p.input.value = input;
  const before = snapshot(p);
  for (let click = 0; click < 2; click++) {
    await p.link(); await p.drain();
    snapshots.push({ input, click, before, after: snapshot(p) });
    assert.equal(p.memory.get(K.book), before.memory[K.book], 'raw book unchanged');
    assert.equal(bookWrites(p).length, 0, 'no price write');
    assert.equal(p.memory.get(PENDING), before.memory[PENDING], 'exact strong arm retained');
    assert.equal(row(p).pricePageItems[0].unitPrice, 500);
    assert.equal(row(p).pricePageCaptureCount, 7);
    assert.equal(row(p).pricePageCapturedAt, '2026-10-01T12:00:00.000Z');
    assert.equal(row(p).receiptLinkCompletions.length, 0);
    assert.match(feedback(p).at(-1), /not captured: invalid price/i);
    assert.doesNotMatch(feedback(p).at(-1), /\d+ prices captured/);
    p.assertInput(input); p.assertAccounting();
  }
  return p;
}

const invalid = [];
for (const value of ['Infinity', 'NaN', '1e400', '-1', 'unavailable', '', '1234oops',
  '1234 USD', '1,23', '1.2.3', '+1234', '0x10', '1e3', '1234/1', '$$1234', '€1234']) {
  invalid.push(`Other Item x2 @ ${value} = $2468`);
  invalid.push(`Other Item x2 @ $1234 = ${value}`);
}
invalid.push('Other Item x2 @ $1234 extra = $2468', 'Other Item x2 @ $1234 = $2468 extra',
  'Other Item x2 @ = $2468', 'Other Item x2 @@ $1234 = $2468',
  'Other Item x2 @ $1234 == $2468', 'Other Item x2 = $2468 @ $1234',
  'Other Item x2 @ $1234 (total Infinity)', 'Other Item x2 @ $1234 (total $2,46,8)',
  'Other Item x2 @ $1234 (total $2468oops)');
for (const prefix of ['Cash Item', 'Receipt: Other Item', 'Total Item', 'Grand total Item',
  'Thanks Item', 'Trade Item', 'Seller Item', 'Buyer Item']) {
  invalid.push(`${prefix} x0 @ $Infinity`, `${prefix} x2 @ NaN = $2468`);
}
for (const value of ['0', '-2', '1.5', '1e400', '9007199254740992', '2oops', '2/1', '2,00'])
  invalid.push(`Cash Item x${value} @ $1234 = $2468`);

for (const bad of invalid) for (const first of [false, true])
  test(`atomic explicit-field rejection ${first ? 'first' : 'last'}: ${bad}`, async () => {
    await rejectReceipt(first ? bad + '\n' + good : good + '\n' + bad);
  });

// Prefix-less finite fields already accepted by the frozen parser retain its
// existing interpretation; admission adds lexical validation, not audit math.
const finite = [
  ['Other Item x2 @ 1234 = $2468', 1234],
  ['Other Item x2 @ $1234 = 2468', 617],
  ['Other Item x2 @ $1,234 = $2,468', 1234],
  ['Other Item x2 @ $ 1,234 = $ 2,468', 1234],
  ['Other Item x2 @$1234=$2468', 1234],
  ['Other Item x2 @ $1234 (total $2468)', 1234],
  ['Other Item x2 $2468', 1234],
  ['2 × Other Item $2468', 1234],
  ['Other Item\u00a0×\u00a02 @ $0.5 = $1', .5],
  ['2 x Cash Item @ $1234 = $2468', 1234],
  ['2 x Receipt: Other Item @ $1234 = $2468', 1234],
  // No new equation/rounding policy: the existing explicit finite parser
  // accepts this unit and total independently.
  ['Other Item x2 @ $1234.5 = $2468', 1234.5],
];
for (const [line, expected] of finite) for (const first of [false, true])
  test(`finite compatibility ${first ? 'first' : 'last'}: ${line}`, async () => {
    const p = await fixture({ twoTraders: true });
    p.input.value = first ? line + '\n' + good : good + '\n' + line;
    const before = snapshot(p);
    await Promise.all([p.link(), p.link()]); await p.drain();
    snapshots.push({ input: p.input.value, before, after: snapshot(p) });
    assert.equal(bookWrites(p).length, 1); assert.equal(p.memory.has(PENDING), false);
    assert.equal(row(p).pricePageCaptureCount, 8);
    assert.equal(row(p).receiptLinkCompletions[0].parsedCount, 2);
    const other = row(p).pricePageItems.find(item => item.itemName !== 'Fixture Item');
    assert.equal(other.unitPrice, expected);
    p.assertAccounting(); await p.link(); await p.drain(); assert.equal(bookWrites(p).length, 1);
  });

const benign = ['Total: $2468', 'Grand total: $2468', 'Receipt total: $2468',
  'Cash received: $2468', 'Thanks for your $2468 purchase', 'Buyer: Example $100',
  'Seller: Example $100', 'https://example.test/receipt?note=$Infinity',
  'Receipt: "Other Item x0 @ $Infinity" is a quoted example.',
  'Cash: “Other Item x0 @ $NaN” is a quoted example.',
  'Receipt: Other Item is quoted here; quantity x price is documentation, budget $Infinity.',
];
for (const line of benign) test('benign heading remains ignored: ' + line, async () => {
  const p = await fixture(); p.input.value = line + '\n' + good + '\n' + line;
  await p.link(); await p.drain();
  assert.equal(bookWrites(p).length, 1); assert.equal(row(p).pricePageItems[0].unitPrice, 1234);
  assert.equal(row(p).receiptLinkCompletions[0].parsedCount, 1); p.assertAccounting();
});

test('invalid evidence can be corrected and retried with the same arm exactly once', async () => {
  const p = await rejectReceipt(good + '\nOther Item x2 @ Infinity = $2468');
  p.input.value = good + '\nOther Item x2 @ $1234 = $2468';
  await p.link(); await p.drain(); await p.link(); await p.drain();
  assert.equal(bookWrites(p).length, 1); assert.equal(row(p).pricePageCaptureCount, 8);
  assert.equal(row(p).receiptLinkCompletions[0].parsedCount, 2);
  assert.equal(p.memory.has(PENDING), false); p.assertAccounting();
});
