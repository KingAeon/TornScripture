const assert = require('node:assert/strict');
const { runtime, trader, K, Element } = require('./imm-capture-harness.cjs');

const PENDING = 'tornscripture-imm-pending-trader-capture-v1';
const PROTECTED = ['tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1',
  'tornscripture-imm-unresolved-trade-journal-v1', 'tornscripture-imm-api-key-v1',
  'tornscripture-imm-api-key-profile-v1', 'tornscripture-imm-ledger-cleanup-backup-v1',
  'tornscripture-imm-inventory-v1'];
const RECEIPT = JSON.stringify({ items: [{ itemId: 1, itemName: 'Fixture Item', quantity: 2, unitPrice: 1000 }],
  totalValue: 2000, receiptUrl: 'https://www.torn.com/trade.php?ID=987654' });
const turn = () => new Promise(resolve => setImmediate(resolve));
const feedback = p => p.elements.filter(el => ['tsimm-toast', 'tsimm-watch-toast'].includes(el.id)).map(el => el.textContent);
const bookWrites = p => p.writes.filter(([key]) => key === K.book);

function attach(p) {
  p.state = p.api._state;
  p.requests = [];
  p.nativeRequest = p.sandbox.navigator.locks.request;
  p.sandbox.navigator.locks.request = (...args) => {
    const task = p.nativeRequest(...args); p.requests.push(task); return task;
  };
  p.open = (id = 'sale-original', raw = RECEIPT) => {
    p.clickAction('receipt-audit-open', id);
    p.overlay = p.document.getElementById('tornscripture-imm-receipt-audit');
    p.input = new Element(); p.input.value = raw;
    p.document.fixtureSelectors = { '#tornscripture-imm-receipt-audit [data-tsimm-receipt-input]': p.input };
    return p.state.receiptAuditDraft;
  };
  p.link = () => p.clickAction('receipt-link-pending-trader');
  p.arm = id => p.clickAction('trader-arm-capture', undefined, id);
  p.drain = async () => {
    await turn(); await Promise.allSettled(p.requests); await turn();
    assert.equal(p.state.receiptTraderLinkPending, null, 'UI request guard settles');
  };
  p.failLocks = mode => {
    p.sandbox.navigator.locks.request = (_, options, callback) => {
      const task = mode === 'null' ? Promise.resolve().then(() => callback(null))
        : Promise.reject(new Error('fixture denied lock'));
      p.requests.push(task); return task;
    };
  };
  p.assertInput = raw => {
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    assert.ok(p.overlay.innerHTML.includes(`>${escaped}</textarea>`), 'production textarea retains input');
    assert.equal(p.state.receiptAuditDraft.rawText, raw);
  };
  return p;
}

async function fixture({ twoTraders = false } = {}) {
  const traders = [trader(), ...(twoTraders ? [trader('b', 123456, 'Other Trader')] : [])];
  const memory = new Map([[K.book, JSON.stringify(traders)]]);
  const p = runtime({ memory, testMode: false, productionEvents: true });
  await p.ready; await turn(); await turn(); attach(p);
  assert.equal(p.state.initialized, true);
  assert.ok(p.events.click.length >= 4, 'actual production listeners initialized');
  memory.set(K.book, JSON.stringify(p.state.traders));
  const sale = { id: 'sale-original', tradeId: '987654', fingerprint: 'original-sale',
    soldAt: '2026-10-02T12:00:00.000Z', saleUrl: 'https://www.torn.com/trade.php?ID=987654',
    counterparty: 'Old Counterparty', counterpartyId: 7, cashReceived: 2000, myCash: 0,
    targetTotal: 2000, trackedCostBasis: 1000, realizedProfit: 1000, trackedProfit: 1000,
    requestedQuantity: 2, trackedQuantity: 2, fullCoverage: true,
    items: [{ itemId: 1, itemName: 'Fixture Item', quantity: 2, trackedQuantity: 2, costBasis: 1000,
      proceeds: 2000, realizedProfit: 1000, allocations: [{ lotId: 'lot-original', quantity: 2,
        unitCost: 500, costBasis: 1000, proceeds: 2000, realizedProfit: 1000 }] }],
    receiptAudit: { provider: 'unknown', rawText: 'original audit', totalValue: 2000,
      saleCash: 2000, status: 'green', items: [] } };
  p.state.ledger = p.api.normalizeLedger({ updatedAt: '2026-10-01T12:00:00.000Z',
    lots: [{ id: 'lot-original', itemId: 1, itemName: 'Fixture Item', quantity: 10,
      remainingQuantity: 8, unitCost: 500, capturedAt: '2026-10-01T12:00:00.000Z', fundingSource: 'personal' }],
    sales: [sale, { ...sale, id: 'sale-other', tradeId: '987655', fingerprint: 'other-sale' }] });
  memory.set(K.ledger, JSON.stringify(p.state.ledger));
  for (const key of PROTECTED) memory.set(key, JSON.stringify({ sentinel: key, exact: ' original bytes ' }));
  p.protectedBytes = new Map(PROTECTED.map(key => [key, memory.get(key)]));
  p.arm('a'); p.open();
  assert.ok(p.overlay.innerHTML.includes('data-tsimm-action="receipt-link-pending-trader"'));
  p.originalBook = memory.get(K.book); p.originalPending = memory.get(PENDING);
  p.originalLedger = memory.get(K.ledger);
  const expected = JSON.parse(p.originalLedger);
  expected.updatedAt = new Date(p.clock.now).toISOString();
  const armedTrader = p.state.traders.find(entry => entry.id === 'a');
  Object.assign(expected.sales[0], { counterparty: armedTrader.name,
    counterpartyId: armedTrader.userId, counterpartyProfileUrl: armedTrader.profileUrl });
  p.expectedLedger = JSON.stringify(expected);
  p.assertAccounting = () => {
    assert.equal(p.sandbox.localStorage.getItem(K.ledger), p.expectedLedger,
      'only original receipt counterparty metadata/timestamp changes');
    for (const [key, bytes] of p.protectedBytes) assert.equal(p.sandbox.localStorage.getItem(key), bytes, key);
    assert.equal(p.state.ledger.sales.length, 2);
    assert.equal(p.navigations.length, 0, 'no gameplay/navigation action');
  };
  p.writes.length = 0;
  return p;
}

async function hold(p) {
  let release, acquired;
  const ready = new Promise(resolve => { acquired = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const task = p.nativeLocks.request(p.lockName, { mode: 'exclusive' }, () => { acquired(); return wait; });
  await ready; return { release, task };
}

async function secondContext(p) {
  const other = runtime({ memory: p.memory, clock: p.clock, testMode: false, productionEvents: true });
  await other.ready; await turn(); await turn(); attach(other);
  // Initialization precedes the actual test. Restore its protected staging sentinels.
  for (const [key, bytes] of p.protectedBytes) p.memory.set(key, bytes);
  other.open(); other.writes.length = 0;
  return other;
}

module.exports = { fixture, hold, secondContext, turn, feedback, bookWrites, runtime, K, PENDING, RECEIPT };
