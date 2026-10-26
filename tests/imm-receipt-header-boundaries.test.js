const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, feedback, bookWrites, K, PENDING } = require('./helpers/imm-receipt-harness.cjs');
const good = 'Fixture Item x2 @ $1234 = $2468';
for (const name of ['Cash Item:', 'Cash Item;', 'Receipt: Other Item:', 'Receipt: Other Item;'])
  for (const evidence of ['x0 @ $Infinity', 'x2 @ unavailable = $2468', 'x0 $Infinity'])
    for (const first of [false, true]) test(`punctuated header row rejects ${first}: ${name} ${evidence}`, async () => {
      const p = await fixture(); const bad = `${name} ${evidence}`;
      const input = first ? bad + '\n' + good : good + '\n' + bad;
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
