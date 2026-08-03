const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = process.env.TSIMM_TEST_SCRIPT
  ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
  : path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function extractNamedFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist in IMM`);
  const parametersEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', parametersEnd);
  assert.notEqual(bodyStart, -1, `${name} should have a body`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

let recordedSale = null;
let recordCalls = 0;
const toasts = [];
const sandbox = {
  console,
  location: {
    hash: '',
    href: 'https://www.torn.com/trade.php#step=logview&ID=123456',
  },
  document: { body: { innerText: '' } },
  normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },
  recordedSaleForStats() {
    return recordedSale;
  },
  optionalFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  },
  ledgerSalePlan() {
    return {
      fullCoverage: true,
      trackedQuantity: 1,
      untrackedQuantity: 0,
    };
  },
  recordTradeSale(stats, method) {
    recordCalls += 1;
    recordedSale = { id: 'sale-fixture', realizedProfit: 250, method };
    return recordedSale;
  },
  toast(message) {
    toasts.push(message);
  },
  formatMoney(value) {
    return `$${Number(value).toLocaleString('en-US')}`;
  },
};

vm.createContext(sandbox);
for (const name of ['tradeCompletionState', 'maybeAutoRecordCompletedTrade']) {
  vm.runInContext(extractNamedFunction(name), sandbox, { filename: scriptPath });
}

function completion(hash, text) {
  sandbox.location.hash = hash;
  sandbox.document.body.innerText = text;
  return sandbox.tradeCompletionState();
}

assert.equal(
  completion('#step=logview&ID=123456', '').completed,
  false,
  'opening the trade log must not prove completion',
);
assert.equal(
  completion('#step=logview&ID=123456', 'The trade was accepted by both parties.').completed,
  false,
  'mutual acceptance must remain pending',
);
assert.equal(
  completion('#step=logview&ID=123456', 'You have accepted the trade.').completed,
  false,
  'the first acceptance must remain pending',
);

for (const message of [
  'Trade was accepted and is now complete!',
  'This trade is completed.',
  'The trade has been successfully completed.',
  'The trade was completed.',
  'Trade completed successfully.',
  'This trade is complete.',
]) {
  const result = completion('#step=logview&ID=123456', message);
  assert.equal(result.completed, true, `${message} should prove finality`);
  assert.equal(result.source, 'completed trade message on trade log page');
}

const delayedRoute = completion('#step=view&ID=123456', 'This trade is completed.');
assert.equal(delayedRoute.completed, true, 'the final message should survive a delayed hash transition');
assert.equal(delayedRoute.source, 'completed trade message');
assert.equal(
  completion('#step=logview&ID=123456', 'View completed trades in your history.').completed,
  false,
  'navigation text about completed trades must not satisfy the finality gate',
);

recordedSale = null;
recordCalls = 0;
toasts.length = 0;
sandbox.location.hash = '#step=logview&ID=123456';
sandbox.document.body.innerText = 'The trade was accepted by both parties.';
const stats = {
  pageType: 'trade',
  tradeItems: [{ itemId: 1, name: 'Fixture Item', quantity: 1 }],
  tradeUnmatchedItems: 0,
  tradeNetCash: 1250,
  notes: [],
};
assert.equal(sandbox.maybeAutoRecordCompletedTrade(stats), null);
assert.equal(recordCalls, 0, 'auto-record must remain dormant through mutual acceptance');
assert.equal(stats.tradeCompleted, false);

sandbox.document.body.innerText = 'Trade was accepted and is now complete!';
const sale = sandbox.maybeAutoRecordCompletedTrade(stats);
assert.equal(recordCalls, 1, 'the final message should record exactly one sale');
assert.equal(sale.id, 'sale-fixture');
assert.equal(sale.method, 'auto-completed-trade');
assert.equal(stats.tradeCompleted, true);
assert.equal(toasts.length, 1);

sandbox.maybeAutoRecordCompletedTrade(stats);
assert.equal(recordCalls, 1, 'an already-recorded final trade must not duplicate the sale');

console.log('IMM trade finality tests passed.');
