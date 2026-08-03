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

let tradePage = true;
let control = {};
let scanCalls = 0;
const sandbox = {
  normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },
  pageLooksLikeTrade() {
    return tradePage;
  },
  nativeTradeAcceptanceControl() {
    return control;
  },
  scanPage() {
    scanCalls += 1;
  },
};
vm.createContext(sandbox);
for (const name of ['tradeAcceptanceActionLabel', 'captureTradeSnapshotBeforeAcceptance']) {
  vm.runInContext(extractNamedFunction(name), sandbox, { filename: scriptPath });
}

for (const label of ['Accept', 'Accept trade', 'Accept the trade', 'Confirm trade', 'Finalize trade', 'Complete trade']) {
  assert.equal(sandbox.tradeAcceptanceActionLabel(label), true, `${label} should be recognized`);
}
assert.equal(
  sandbox.tradeAcceptanceActionLabel('Yes', 'Are you sure you want to accept this trade?'),
  true,
  'trade acceptance confirmation should be recognized',
);
assert.equal(sandbox.tradeAcceptanceActionLabel('Yes', 'Delete this note?'), false);
assert.equal(sandbox.tradeAcceptanceActionLabel('No', 'Accept this trade?'), false);
assert.equal(sandbox.tradeAcceptanceActionLabel('Clear'), false);

tradePage = false;
control = {};
assert.equal(sandbox.captureTradeSnapshotBeforeAcceptance({ target: {} }), false);
assert.equal(scanCalls, 0);

tradePage = true;
control = null;
assert.equal(sandbox.captureTradeSnapshotBeforeAcceptance({ target: {} }), false);
assert.equal(scanCalls, 0);

control = {};
assert.equal(sandbox.captureTradeSnapshotBeforeAcceptance({ target: {} }), true);
assert.equal(scanCalls, 1, 'accepted trade click should synchronously scan once');

const listener = "document.addEventListener('click', captureTradeSnapshotBeforeAcceptance, true);";
const quickMaxListener = "document.addEventListener('click', handleQuickMaxClick, true);";
assert.notEqual(source.indexOf(listener), -1, 'capture listener should be registered');
assert.ok(source.indexOf(listener) < source.indexOf(quickMaxListener), 'capture listener should be first');

console.log('IMM pre-accept capture tests passed.');
