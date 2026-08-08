/**
 * Regression for the v0.19.35 startup failure caused by restoring a persisted
 * API-trade permission record before the script's permission-state constant was
 * initialized. This must exercise full script evaluation, not only exported
 * helpers, because the failure occurs while the top-level state object loads.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function makeElement() {
  return {
    id: '',
    className: '',
    textContent: '',
    type: '',
    src: '',
    style: {},
    dataset: {},
    innerHTML: '',
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    closest() { return null; },
    matches() { return false; },
    getAttribute() { return null; },
    setAttribute() {},
    addEventListener() {},
    appendChild() {},
    append() {},
    remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    isConnected: false,
  };
}

test('full startup survives and restores a persisted validated tradePermission record', () => {
  const ledgerKey = 'tornscripture-imm-ledger-v1';
  const persistedPermission = {
    state: 'validated',
    validatedAt: '2026-08-08T07:00:00.000Z',
    keyFingerprint: 'kfp-deadbeef-8',
    endpoint: 'https://api.torn.com/v2/user/trades',
    schemaMarker: 'v2-user-trades',
  };
  const memory = new Map([
    [ledgerKey, JSON.stringify({
      schema: 'tornscripture-imm-ledger',
      schemaVersion: 6,
      updatedAt: '2026-08-08T07:00:00.000Z',
      lots: [],
      sales: [],
      quarantinedTrades: [],
      tradePermission: persistedPermission,
    })],
  ]);

  global.localStorage = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); },
  };
  global.sessionStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };

  const bodyEl = makeElement();
  const headEl = makeElement();
  global.document = {
    readyState: 'complete',
    getElementById() { return null; },
    body: bodyEl,
    head: headEl,
    documentElement: makeElement(),
    createElement() { return makeElement(); },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  global.window = { name: '', addEventListener() {}, removeEventListener() {} };
  global.location = {
    href: 'https://www.torn.com/index.php',
    hostname: 'www.torn.com',
    hash: '',
    replace() {},
  };
  global.MutationObserver = class { observe() {} disconnect() {} };

  globalThis.__TS_IMM_TEST_MODE__ = true;
  delete globalThis.__TS_IMM_TEST_EXPORTS__;

  const scriptPath = process.env.TSIMM_TEST_SCRIPT
    ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
    : path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.doesNotThrow(
    () => vm.runInThisContext(source, { filename: scriptPath }),
    'full userscript evaluation must not throw when tradePermission already exists in Ledger storage',
  );

  const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
  assert.ok(imm, '__TS_IMM_TEST_EXPORTS__ must be created after successful startup');
  assert.deepEqual(imm.state.ledger.tradePermission, persistedPermission);
});
