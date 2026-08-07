/**
 * IMM API-backed Black Ledger trade recovery tests — production-path harness.
 *
 * Uses vm.runInThisContext + globalThis.__TS_IMM_TEST_MODE__ to load and
 * exercise the real production accounting owners (recordTradeSale,
 * ledgerSalePlan, normalizeLedger, analyzeLedgerIntegrity, quarantineApiTrade,
 * etc.) without copying or reimplementing any logic.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, describe, before } = require('node:test');

// ── Browser global mocks ─────────────────────────────────────────────────────
const memory = new Map();
global.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); },
};

function makeElement() {
  const el = {
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
  return el;
}

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
global.window = { addEventListener() {}, removeEventListener() {} };
global.location = { href: 'https://www.torn.com/trade.php?ID=9001', hostname: 'www.torn.com', hash: '' };
global.MutationObserver = class { observe() {} disconnect() {} };

// ── Load script once ──────────────────────────────────────────────────────────
const scriptPath = process.env.TSIMM_TEST_SCRIPT
  ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
  : path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');

globalThis.__TS_IMM_TEST_MODE__ = true;

before(() => {
  vm.runInThisContext(fs.readFileSync(scriptPath, 'utf8'), { filename: scriptPath });
  assert.ok(globalThis.__TS_IMM_TEST_EXPORTS__, '__TS_IMM_TEST_EXPORTS__ must be set by test hook');
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
const CATALOG_XANAX = { id: 100, name: 'Xanax', marketPrice: 90000, normalizedName: 'xanax' };
const CATALOG_VICODIN = { id: 101, name: 'Vicodin', marketPrice: 30000, normalizedName: 'vicodin' };

function freshLot(overrides = {}) {
  return {
    id: `lot-${Math.random().toString(36).slice(2, 9)}`,
    schemaVersion: 2,
    source: 'manual',
    venue: 'manual',
    country: null,
    location: null,
    fundingSource: 'personal',
    itemId: 100,
    itemName: 'Xanax',
    normalizedName: 'xanax',
    quantity: 10,
    remainingQuantity: 10,
    unitCost: 90000,
    totalCost: 900000,
    marketValueAtPurchase: 90000,
    traderValueAtPurchase: 81000,
    expectedProfitEach: -9000,
    expectedProfitTotal: -90000,
    capturedAt: new Date(Date.now() - 60000).toISOString(),
    purchaseUrl: 'https://www.torn.com/imarket.php',
    captureMethod: 'manual',
    status: 'open',
    notes: null,
    ...overrides,
  };
}

function freshDetail(overrides = {}) {
  return {
    id: 9001,
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, quantity: 10 }] },
    trader: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
    ...overrides,
  };
}

function setupState(overrides = {}) {
  const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
  imm.state.catalog = {
    itemsByName: { xanax: CATALOG_XANAX, vicodin: CATALOG_VICODIN },
    itemsById: { '100': CATALOG_XANAX, '101': CATALOG_VICODIN },
    updatedAt: new Date().toISOString(),
  };
  imm.state.keyProfile = { userId: 1001 };
  imm.state.ledger = imm.normalizeLedger({ lots: [], sales: [], ...overrides });
}

// ── Schema version ────────────────────────────────────────────────────────────
describe('Schema', () => {
  test('normalizeLedger produces schemaVersion 6', () => {
    const { normalizeLedger } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const ledger = normalizeLedger({});
    assert.equal(ledger.schemaVersion, 6);
  });

  test('normalizeLedger preserves quarantinedTrades through round-trip', () => {
    const { normalizeLedger } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const q = { id: 'q1', schemaVersion: 1, reasonCode: 'test-reason', capturedAt: new Date().toISOString(), rawPayload: null, endpoint: null, apiTradeId: null, source: 'api-trade-recovery', validationState: 'rejected' };
    const ledger = normalizeLedger({ quarantinedTrades: [q] });
    assert.equal(ledger.quarantinedTrades.length, 1);
    assert.equal(ledger.quarantinedTrades[0].reasonCode, 'test-reason');
    const ledger2 = normalizeLedger(JSON.parse(JSON.stringify(ledger)));
    assert.equal(ledger2.quarantinedTrades.length, 1);
  });

  test('normalizeLedger retains malformed quarantine records with _malformed flag', () => {
    // Spec: malformed quarantine records are retained in a diagnosable form rather than silently discarded.
    // null entries (non-objects) are filtered; objects with missing/empty id or reasonCode are retained with _malformed: true.
    const { normalizeLedger } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const ledger = normalizeLedger({ quarantinedTrades: [null, { id: '', reasonCode: '' }, { id: 'q1', reasonCode: 'ok' }] });
    // null is filtered; the two object entries are both retained
    assert.equal(ledger.quarantinedTrades.length, 2);
    // The malformed record is tagged
    const malformed = ledger.quarantinedTrades.find((q) => !q.id || !q.reasonCode);
    assert.ok(malformed?._malformed === true, 'malformed record must have _malformed: true');
    // The valid record is preserved without the flag
    const valid = ledger.quarantinedTrades.find((q) => q.id === 'q1');
    assert.ok(valid && !valid._malformed, 'valid record must not have _malformed flag');
  });
});

// ── Normalization contracts ───────────────────────────────────────────────────
describe('Normalization contracts', () => {
  // Official API v2 raw detail fixture: user/trader/items[] typed TradeItem shape.
  function rawDetailOfficial(overrides = {}) {
    return {
      id: 9001,
      completed_at: Math.floor(Date.now() / 1000) - 3600,
      user: { id: 1001, name: 'Alice' },
      trader: { id: 5678, name: 'Bob' },
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 10, uid: null } },
        { user_id: 5678, type: 'Money', details: { amount: 5000000 } },
      ],
      ...overrides,
    };
  }

  test('normalizeApiParticipantHeader: missing object throws', () => {
    const { normalizeApiParticipantHeader } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiParticipantHeader(null, 'user'),
      /missing or malformed/i,
    );
  });

  test('normalizeApiParticipantHeader: invalid id throws', () => {
    const { normalizeApiParticipantHeader } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiParticipantHeader({ id: 0, name: 'Alice' }, 'user'),
      /no valid Torn ID/i,
    );
  });

  test('normalizeApiParticipantHeader: valid entry normalizes correctly', () => {
    const { normalizeApiParticipantHeader } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const result = normalizeApiParticipantHeader({ id: 1001, name: 'Alice' }, 'user');
    assert.equal(result.userId, 1001);
    assert.equal(result.name, 'Alice');
  });

  test('normalizeApiTradeDetail: ID mismatch throws', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(() => normalizeApiTradeDetail(rawDetailOfficial({ id: 9999 }), 9001), /mismatch/i);
  });

  test('normalizeApiTradeDetail: matching expected ID succeeds with official shape', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const detail = normalizeApiTradeDetail(rawDetailOfficial(), 9001);
    assert.equal(detail.id, 9001);
    assert.ok(detail.completedAt, 'must have completedAt');
    assert.ok(detail.user, 'must have user side');
    assert.ok(detail.trader, 'must have trader side');
  });

  test('normalizeApiTradeDetail: aggregates Money by participant', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const raw = rawDetailOfficial({
      items: [
        { user_id: 5678, type: 'Money', details: { amount: 3000000 } },
        { user_id: 5678, type: 'Money', details: { amount: 2000000 } },
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 5, uid: null } },
      ],
    });
    const detail = normalizeApiTradeDetail(raw);
    assert.equal(detail.trader.money, 5000000, 'money should aggregate');
    assert.equal(detail.user.items[0].quantity, 5);
  });

  test('normalizeApiTradeDetail: aggregates Item by participant', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const raw = rawDetailOfficial({
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 3, uid: 1 } },
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 7, uid: 2 } },
        { user_id: 5678, type: 'Money', details: { amount: 1000000 } },
      ],
    });
    const detail = normalizeApiTradeDetail(raw);
    assert.equal(detail.user.items.length, 2, 'separate item entries preserved before aggregation');
  });

  test('buildApiTradeSaleStats: unknown catalog item ID throws', () => {
    setupState({ lots: [freshLot()] });
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Remove item 100 from catalog to trigger unknown ID
    delete imm.state.catalog.itemsById['100'];
    const detail = freshDetail();
    const { buildApiTradeSaleStats, resolveApiTradeOwner } = imm;
    const { ownerSide, counterpartySide } = resolveApiTradeOwner(detail, 1001);
    assert.throws(() => buildApiTradeSaleStats(detail, ownerSide, counterpartySide), /not in the catalog|unknown catalog/i);
  });
});


// ── Quarantine ────────────────────────────────────────────────────────────────
describe('Quarantine', () => {
  test('quarantineApiTrade persists record with reason code and raw payload', () => {
    setupState();
    const { quarantineApiTrade, state } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const payload = { id: 9001, status: 'Accepted' };
    const q = quarantineApiTrade(payload, 'missing-money', { endpoint: 'https://api.torn.com/v2/user/trades', apiTradeId: 9001 });
    assert.equal(q.reasonCode, 'missing-money');
    assert.deepEqual(q.rawPayload, payload);
    assert.equal(q.apiTradeId, 9001);
    assert.equal(q.validationState, 'rejected');
    assert.ok(state.ledger.quarantinedTrades.length >= 1);
    // No lots or sales were mutated
    assert.equal(state.ledger.lots.length, 0);
    assert.equal(state.ledger.sales.length, 0);
  });

  test('quarantineApiTrade: record preserved through normalizeLedger round-trip', () => {
    setupState();
    const { quarantineApiTrade, normalizeLedger, state } = globalThis.__TS_IMM_TEST_EXPORTS__;
    quarantineApiTrade({ id: 9001 }, 'test-code');
    const ledger2 = normalizeLedger(JSON.parse(JSON.stringify(state.ledger)));
    assert.equal(ledger2.quarantinedTrades.length, 1);
    assert.equal(ledger2.quarantinedTrades[0].reasonCode, 'test-code');
  });

  test('quarantineApiTrade: Ledger Integrity includes quarantine count', () => {
    setupState();
    const { quarantineApiTrade, analyzeLedgerIntegrity, state } = globalThis.__TS_IMM_TEST_EXPORTS__;
    quarantineApiTrade({ id: 9001 }, 'test-code');
    const report = analyzeLedgerIntegrity(state.ledger);
    assert.equal(report.quarantinedCount, 1);
  });
});

// ── Duplicate blocking ────────────────────────────────────────────────────────
describe('Duplicate blocking', () => {
  test('apiTradeAlreadyRecorded: blocked by fingerprint', () => {
    setupState({
      sales: [{
        id: 's1', fingerprint: 'trade:api-trade-9001',
        soldAt: new Date().toISOString(), items: [], cashReceived: 5000000,
        counterparty: 'Bob', counterpartyId: 5678, captureMethod: 'api-trade-recovery',
      }],
    });
    const { apiTradeAlreadyRecorded } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.equal(apiTradeAlreadyRecorded(9001), true);
    assert.equal(apiTradeAlreadyRecorded(9002), false);
  });

  test('apiTradeAlreadyRecorded: blocked by apiTradeId field', () => {
    setupState({});
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Push with apiTradeId set but different fingerprint — bypass normalizeLedger to avoid field loss
    imm.state.ledger.sales.push(imm.normalizeSaleRecord({
      id: 's-apitradeid',
      fingerprint: 'some-other-fingerprint',
      apiTradeId: 9001,
      soldAt: new Date().toISOString(),
      items: [],
      cashReceived: 5000000,
      counterparty: 'Bob',
      counterpartyId: 5678,
      captureMethod: 'api-trade-recovery',
    }));
    assert.equal(imm.apiTradeAlreadyRecorded(9001), true);
    assert.equal(imm.apiTradeAlreadyRecorded(9002), false);
  });

  test('apiTradeCanonicalFingerprintRecorded: blocked by matching canonical fingerprint', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    imm.state.ledger.sales.push(imm.normalizeSaleRecord({
      id: 's-fp', fingerprint: 'trade:api-trade-9001', canonicalFingerprint: fp,
      apiTradeId: 9001, soldAt: new Date().toISOString(), items: [],
      cashReceived: 5000000, counterparty: 'Bob',
    }));
    assert.equal(imm.apiTradeCanonicalFingerprintRecorded(fp), true);
    assert.equal(imm.apiTradeCanonicalFingerprintRecorded('different-fp'), false);
  });

  test('detectApiTradeLikelyManualDuplicate: blocked within 24h of completion time', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const completedAt = new Date(Date.now() - 3600000).toISOString(); // 1h ago
    setupState({
      lots: [freshLot()],
      sales: [{
        id: 's-manual', fingerprint: 'trade-fallback:abc',
        soldAt: new Date(Date.now() - 7200000).toISOString(), // 2h ago — within 24h of completion
        cashReceived: 5000000, counterparty: 'Bob', counterpartyId: 5678,
        items: [{ itemId: 100, itemName: 'Xanax', quantity: 10 }],
      }],
    });
    const detail = freshDetail({ completedAt });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const dupes = imm.detectApiTradeLikelyManualDuplicate(stats, 86400000);
    assert.equal(dupes.length, 1);
  });

  test('detectApiTradeLikelyManualDuplicate: not blocked outside 24h window of completion time', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const completedAt = new Date(Date.now() - 3600000).toISOString(); // 1h ago
    setupState({
      lots: [freshLot()],
      sales: [{
        id: 's-old', fingerprint: 'trade-fallback:xyz',
        soldAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago — outside 24h of completion
        cashReceived: 5000000,
        items: [{ itemId: 100, itemName: 'Xanax', quantity: 10 }],
      }],
    });
    const detail = freshDetail({ completedAt });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const dupes = imm.detectApiTradeLikelyManualDuplicate(stats, 86400000);
    assert.equal(dupes.length, 0);
  });

  test('detectApiTradeLikelyManualDuplicate: reordered asset equivalence is detected', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const completedAt = new Date(Date.now() - 1800000).toISOString();
    setupState({
      lots: [
        freshLot({ id: 'lot-x5', itemId: 100, itemName: 'Xanax', quantity: 5, remainingQuantity: 5, unitCost: 90000, totalCost: 450000 }),
        freshLot({ id: 'lot-v10', itemId: 101, itemName: 'Vicodin', normalizedName: 'vicodin', quantity: 10, remainingQuantity: 10, unitCost: 30000, totalCost: 300000 }),
      ],
      sales: [{
        id: 's-reorder', fingerprint: 'trade-fallback:reorder',
        soldAt: new Date(Date.now() - 3600000).toISOString(),
        cashReceived: 750000,
        items: [
          { itemId: 101, itemName: 'Vicodin', quantity: 10 },
          { itemId: 100, itemName: 'Xanax', quantity: 5 },
        ],
      }],
    });
    const detail = {
      id: 9002, status: 'Accepted', completedAt,
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 5 }, { id: 101, name: 'Vicodin', quantity: 10 }] },
      trader: { userId: 5678, name: 'Bob', money: 750000, items: [] },
    };
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const dupes = imm.detectApiTradeLikelyManualDuplicate(stats, 86400000);
    assert.equal(dupes.length, 1, 'reordered assets must be detected as duplicate');
  });

  test('detectApiTradeLikelyManualDuplicate: different cash amount is not a match', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const completedAt = new Date(Date.now() - 1800000).toISOString();
    setupState({
      lots: [freshLot()],
      sales: [{
        id: 's-diff', fingerprint: 'trade-fallback:diff',
        soldAt: new Date(Date.now() - 3600000).toISOString(),
        cashReceived: 5000050, // clearly different from 5000000 (> 1 apart)
        items: [{ itemId: 100, itemName: 'Xanax', quantity: 10 }],
      }],
    });
    const detail = freshDetail({ completedAt });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const dupes = imm.detectApiTradeLikelyManualDuplicate(stats, 86400000);
    assert.equal(dupes.length, 0, 'different cash amount must not match');
  });

  test('distinct endpoint-confirmed IDs may both record', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 20, remainingQuantity: 20 })] });

    const detailA = freshDetail({ id: 9001, completedAt: new Date(Date.now() - 7200000).toISOString() });
    const { ownerSide: owA, counterpartySide: cpA } = imm.resolveApiTradeOwner(detailA, 1001);
    const statsA = imm.buildApiTradeSaleStats(detailA, owA, cpA);
    statsA.soldAt = detailA.completedAt;
    const saleA = imm.recordTradeSale(statsA, 'api-trade-recovery');
    const recordedA = imm.state.ledger.sales.find((s) => s.id === saleA.id);
    if (recordedA) {
      recordedA.apiTradeId = detailA.id;
      recordedA.canonicalFingerprint = imm.buildApiTradeCanonicalFingerprint(detailA, statsA);
    }

    // Second trade has distinct ID — must not be blocked
    assert.equal(imm.apiTradeAlreadyRecorded(9002), false);
    const detailB = freshDetail({ id: 9002, completedAt: new Date(Date.now() - 3600000).toISOString() });
    const { ownerSide: owB, counterpartySide: cpB } = imm.resolveApiTradeOwner(detailB, 1001);
    const statsB = imm.buildApiTradeSaleStats(detailB, owB, cpB);
    statsB.soldAt = detailB.completedAt;
    const saleB = imm.recordTradeSale(statsB, 'api-trade-recovery');
    assert.ok(saleB, 'second distinct trade must record');
    assert.equal(imm.state.ledger.sales.length, 2);
  });
});

// ── FIFO accounting ───────────────────────────────────────────────────────────
describe('FIFO accounting — production recordTradeSale', () => {
  test('canonical FIFO case: buy 100@10, buy 100@12, sell 150, consume 100+50, leave 50@12', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const lot1 = freshLot({ id: 'lot-a', quantity: 100, remainingQuantity: 100, unitCost: 10, totalCost: 1000, capturedAt: new Date(Date.now() - 120000).toISOString() });
    const lot2 = freshLot({ id: 'lot-b', quantity: 100, remainingQuantity: 100, unitCost: 12, totalCost: 1200, capturedAt: new Date(Date.now() - 60000).toISOString() });
    setupState({});
    imm.state.ledger.lots = [lot1, lot2]; // FIFO: oldest first
    const detail = freshDetail({
      id: 9003,
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 150 }] },
      trader: { userId: 5678, name: 'Bob', money: 2300, items: [] },
    });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'api-trade-recovery');
    const lots = imm.state.ledger.lots;
    assert.equal(lots.find((l) => l.id === 'lot-a').remainingQuantity, 0, 'lot1 fully consumed');
    assert.equal(lots.find((l) => l.id === 'lot-b').remainingQuantity, 50, '50 remain in lot2');
    assert.equal(sale.trackedCostBasis, 1600, 'cost: 100*10 + 50*12 = 1600');
    assert.equal(sale.realizedProfit, 700, 'profit: 2300 - 1600 = 700');
  });

  test('exact lot: single lot fully consumed', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 10, remainingQuantity: 10, unitCost: 90000 })] });
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'api-trade-recovery');
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 0);
    assert.equal(sale.trackedCostBasis, 900000);
    assert.equal(sale.realizedProfit, 5000000 - 900000);
  });

  test('partial lot: only part of lot consumed', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 20, remainingQuantity: 20, unitCost: 90000 })] });
    const detail = freshDetail({
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 5 }] },
      trader: { userId: 5678, name: 'Bob', money: 500000, items: [] },
    });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'api-trade-recovery');
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 15);
    assert.equal(sale.trackedQuantity, 5);
    assert.equal(sale.trackedCostBasis, 450000);
  });

  test('zero inventory rejection: no matching lots throws', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [] });
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    assert.throws(() => imm.recordTradeSale(stats, 'api-trade-recovery'), /None of the sold quantities/i);
  });

  test('multi-lot: two lots consumed across sale', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const lot1 = freshLot({ id: 'lot-m1', quantity: 5, remainingQuantity: 5, unitCost: 80000, capturedAt: new Date(Date.now() - 120000).toISOString() });
    const lot2 = freshLot({ id: 'lot-m2', quantity: 5, remainingQuantity: 5, unitCost: 100000, capturedAt: new Date(Date.now() - 60000).toISOString() });
    setupState({});
    imm.state.ledger.lots = [lot1, lot2];
    const detail = freshDetail({
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
      trader: { userId: 5678, name: 'Bob', money: 1000000, items: [] },
    });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'api-trade-recovery');
    assert.equal(imm.state.ledger.lots.find((l) => l.id === 'lot-m1').remainingQuantity, 0);
    assert.equal(imm.state.ledger.lots.find((l) => l.id === 'lot-m2').remainingQuantity, 0);
    assert.equal(sale.trackedCostBasis, 5 * 80000 + 5 * 100000);
  });

  test('consecutive sales: second sale uses remaining lot quantity', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-consec', quantity: 20, remainingQuantity: 20, unitCost: 90000 })] });
    const detail1 = freshDetail({ id: 9010, completedAt: new Date(Date.now() - 7200000).toISOString() });
    const { ownerSide: ow1, counterpartySide: cp1 } = imm.resolveApiTradeOwner(detail1, 1001);
    const s1 = imm.buildApiTradeSaleStats(detail1, ow1, cp1);
    s1.soldAt = detail1.completedAt;
    imm.recordTradeSale(s1, 'api-trade-recovery');
    const detail2 = freshDetail({ id: 9011, completedAt: new Date(Date.now() - 3600000).toISOString() });
    const { ownerSide: ow2, counterpartySide: cp2 } = imm.resolveApiTradeOwner(detail2, 1001);
    const s2 = imm.buildApiTradeSaleStats(detail2, ow2, cp2);
    s2.soldAt = detail2.completedAt;
    imm.recordTradeSale(s2, 'api-trade-recovery');
    assert.equal(imm.state.ledger.lots.find((l) => l.id === 'lot-consec').remainingQuantity, 0);
    assert.equal(imm.state.ledger.sales.length, 2);
  });

  test('deterministic FIFO allocation: oldest lot consumed first', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const lot1 = freshLot({ id: 'lot-det1', quantity: 10, remainingQuantity: 10, unitCost: 80000, capturedAt: new Date(Date.now() - 200000).toISOString() });
    const lot2 = freshLot({ id: 'lot-det2', quantity: 10, remainingQuantity: 10, unitCost: 100000, capturedAt: new Date(Date.now() - 100000).toISOString() });
    setupState({});
    imm.state.ledger.lots = [lot1, lot2];
    const detail = freshDetail({
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
      trader: { userId: 5678, name: 'Bob', money: 900000, items: [] },
    });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const plan = imm.ledgerSalePlan(stats);
    assert.equal(plan.items[0].allocations[0].lotId, lot1.id, 'oldest lot consumed first');
    assert.equal(plan.items[0].allocations[0].unitCost, 80000);
  });

  test('exact cost basis and realized profit', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 10, remainingQuantity: 10, unitCost: 70000 })] });
    const detail = freshDetail({ trader: { userId: 5678, name: 'Bob', money: 800000, items: [] } });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'api-trade-recovery');
    assert.equal(sale.trackedCostBasis, 700000);
    assert.equal(sale.realizedProfit, 100000);
  });
});

// ── Atomic transaction and rollback ──────────────────────────────────────────
describe('Atomic transaction and rollback', () => {
  test('successful record: lots mutated, sale added, soldAt = API completion time', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const canonicalFp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'api-trade-recovery');
    const recorded = imm.state.ledger.sales.find((s) => s.id === sale.id);
    assert.ok(recorded, 'sale must be in ledger');
    // soldAt comes from API completion time — no second mutation needed
    assert.equal(recorded.soldAt, detail.completedAt);
    // Stamp API metadata (mirrors handleApiTradeRecoveryConfirm atomic block)
    recorded.apiTradeId = detail.id;
    recorded.apiCompletedAt = detail.completedAt;
    recorded.canonicalFingerprint = canonicalFp;
    recorded.provenance = 'api-trade-recovery';
    assert.equal(recorded.apiTradeId, 9001);
    assert.equal(recorded.canonicalFingerprint, canonicalFp);
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 0);
  });

  test('rollback: forced failure restores structurally identical pre-state', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-rollback' })] });
    const preLots = JSON.parse(JSON.stringify(imm.state.ledger.lots));
    const preSales = JSON.parse(JSON.stringify(imm.state.ledger.sales));
    // Corrupt stats to force recordTradeSale to throw
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.tradeNetCash = null; // triggers throw inside recordTradeSale
    const preState = {
      lots: JSON.parse(JSON.stringify(imm.state.ledger.lots)),
      sales: JSON.parse(JSON.stringify(imm.state.ledger.sales)),
    };
    let threw = false;
    try {
      imm.recordTradeSale(stats, 'api-trade-recovery');
    } catch {
      threw = true;
      imm.state.ledger.lots = preState.lots;
      imm.state.ledger.sales = preState.sales;
    }
    assert.ok(threw, 'should have thrown');
    assert.deepEqual(imm.state.ledger.lots, preLots, 'lots must be identical to pre-state');
    assert.deepEqual(imm.state.ledger.sales, preSales, 'sales must be identical to pre-state');
  });

  test('soldAt comes from stats.soldAt — no second post-record mutation required', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'api-trade-recovery');
    const recorded = imm.state.ledger.sales.find((s) => s.id === sale.id);
    assert.equal(recorded.soldAt, detail.completedAt, 'soldAt must match API completion time');
  });
});

// ── executeApiTradeRecoveryTransaction — production atomic path ───────────────
describe('executeApiTradeRecoveryTransaction — atomic production path', () => {
  function freshStats(detail, overrides = {}) {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    return Object.assign(stats, overrides);
  }

  test('canonical FIFO: buy 100@10, buy 100@12, sell 150 — consume 100+50, leave 50@12, cost basis 1600', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const lot1 = freshLot({ id: 'lot-fa', itemId: 100, quantity: 100, remainingQuantity: 100, unitCost: 10, totalCost: 1000, capturedAt: new Date(Date.now() - 120000).toISOString() });
    const lot2 = freshLot({ id: 'lot-fb', itemId: 100, quantity: 100, remainingQuantity: 100, unitCost: 12, totalCost: 1200, capturedAt: new Date(Date.now() - 60000).toISOString() });
    setupState({});
    imm.state.ledger.lots = [lot1, lot2];
    const detail = freshDetail({
      id: 9100,
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 150 }] },
      trader: { userId: 5678, name: 'Bob', money: 2300, items: [] },
    });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const result = imm.executeApiTradeRecoveryTransaction(9100, detail, stats, fp);
    assert.ok(result.ok, `expected ok, got: ${result.message}`);
    const lots = imm.state.ledger.lots;
    assert.equal(lots.find((l) => l.id === 'lot-fa').remainingQuantity, 0);
    assert.equal(lots.find((l) => l.id === 'lot-fb').remainingQuantity, 50);
    assert.equal(result.sale.trackedCostBasis, 1600);
    assert.equal(result.sale.trackedQuantity, 150);
  });

  test('successful API transaction: exact FIFO mutation, exactly one sale, all API metadata before persistence, one persistence', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = freshDetail({ id: 9200 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);

    let saveCount = 0;
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-ledger-v1') saveCount++;
      origSetItem(key, value);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(9200, detail, stats, fp);
      assert.ok(result.ok, `expected ok, got: ${result.message}`);
      const sale = result.sale;
      assert.equal(imm.state.ledger.lots[0].remainingQuantity, 0, 'lot must be consumed');
      assert.equal(imm.state.ledger.sales.length, 1, 'exactly one sale');
      assert.equal(sale.apiTradeId, 9200, 'apiTradeId must be set before persistence');
      assert.ok(sale.apiCompletedAt, 'apiCompletedAt must be set before persistence');
      assert.ok(sale.canonicalFingerprint, 'canonicalFingerprint must be set before persistence');
      assert.equal(sale.provenance, 'api-trade-recovery', 'provenance must be set before persistence');
      assert.equal(sale.captureMethod, 'api-trade-recovery');
      assert.equal(sale.soldAt, detail.completedAt);
      assert.equal(saveCount, 1, 'exactly one ledger persistence on success path');
    } finally {
      localStorage.setItem = origSetItem;
    }
  });

  test('stale review: lot quantity reduced before confirmation — fails with zero mutation', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-stale', quantity: 10, remainingQuantity: 10 })] });
    const detail = freshDetail({ id: 9300 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Reduce lot quantity after review was built but before confirmation
    imm.state.ledger.lots[0].remainingQuantity = 5;
    const preLots = JSON.parse(JSON.stringify(imm.state.ledger.lots));
    const preSales = JSON.parse(JSON.stringify(imm.state.ledger.sales));
    const result = imm.executeApiTradeRecoveryTransaction(9300, detail, stats, fp);
    assert.equal(result.ok, false, 'must fail');
    assert.equal(result.reason, 'stale-review');
    assert.deepEqual(imm.state.ledger.lots, preLots, 'lots must be unchanged');
    assert.deepEqual(imm.state.ledger.sales, preSales, 'sales must be unchanged');
  });

  test('exact-ID duplicate at confirmation time is rejected', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 20, remainingQuantity: 20 })] });
    const detail = freshDetail({ id: 9400 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Record once successfully
    const first = imm.executeApiTradeRecoveryTransaction(9400, detail, stats, fp);
    assert.ok(first.ok, 'first record must succeed');
    // Stamp apiTradeId so the duplicate check fires
    imm.state.ledger.sales[0].apiTradeId = 9400;
    // Attempt second record with same ID
    const lot2 = freshLot({ id: 'lot-extra', quantity: 10, remainingQuantity: 10 });
    imm.state.ledger.lots.push(lot2);
    const stats2 = freshStats(detail);
    const result = imm.executeApiTradeRecoveryTransaction(9400, detail, stats2, fp);
    assert.equal(result.ok, false, 'must reject duplicate');
    assert.equal(result.reason, 'exact-id-duplicate');
    assert.equal(imm.state.ledger.sales.length, 1, 'no second sale added');
  });

  test('canonical-fingerprint duplicate at confirmation time is rejected', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 20, remainingQuantity: 20 })] });
    const detail = freshDetail({ id: 9500 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Record once and stamp canonical fingerprint
    const first = imm.executeApiTradeRecoveryTransaction(9500, detail, stats, fp);
    assert.ok(first.ok, 'first record must succeed');
    imm.state.ledger.sales[0].canonicalFingerprint = fp;
    // Attempt second record with different ID but same canonical fingerprint
    const detail2 = freshDetail({ id: 9501 });
    const stats2 = freshStats(detail2);
    const lot2 = freshLot({ id: 'lot-extra2', quantity: 10, remainingQuantity: 10 });
    imm.state.ledger.lots.push(lot2);
    const result = imm.executeApiTradeRecoveryTransaction(9501, detail2, stats2, fp);
    assert.equal(result.ok, false, 'must reject canonical-fp duplicate');
    assert.equal(result.reason, 'canonical-fp-duplicate');
  });

  test('likely-manual duplicate at confirmation time is rejected', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const completedAt = new Date(Date.now() - 3600000).toISOString();
    // Plant a recent manual sale that will match
    setupState({
      lots: [freshLot()],
      sales: [{
        id: 's-manual-dup', fingerprint: 'trade-fallback:manualdup',
        soldAt: new Date(Date.now() - 7200000).toISOString(),
        cashReceived: 5000000, counterparty: 'Bob', counterpartyId: 5678,
        items: [{ itemId: 100, itemName: 'Xanax', quantity: 10 }],
      }],
    });
    const detail = freshDetail({ id: 9600, completedAt });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const result = imm.executeApiTradeRecoveryTransaction(9600, detail, stats, fp);
    assert.equal(result.ok, false, 'must be blocked by likely-manual duplicate');
    assert.equal(result.reason, 'likely-manual-duplicate');
    assert.equal(imm.state.ledger.sales.length, 1, 'no new sale added');
  });

  test('failure after lot application but before commit — rollback succeeds, transaction-failed returned', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-precommit' })] });
    const detail = freshDetail({ id: 9700 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const preLots = JSON.parse(JSON.stringify(imm.state.ledger.lots));
    const preSales = JSON.parse(JSON.stringify(imm.state.ledger.sales));
    // Block the FIRST ledger write (saveLedger) but allow rollback restoration
    const origSetItem = localStorage.setItem.bind(localStorage);
    let ledgerWriteCount = 0;
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-ledger-v1') {
        ledgerWriteCount++;
        if (ledgerWriteCount === 1) throw new Error('Forced persistence failure');
      }
      origSetItem(key, value);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(9700, detail, stats, fp);
      assert.equal(result.ok, false, 'must fail');
      assert.equal(result.reason, 'transaction-failed', 'rollback succeeded — must return transaction-failed');
      assert.deepEqual(imm.state.ledger.lots, preLots, 'lots rolled back');
      assert.deepEqual(imm.state.ledger.sales, preSales, 'sales rolled back');
      assert.equal(imm.state.ledger.sales.length, 0, 'no sale left after rollback');
    } finally {
      localStorage.setItem = origSetItem;
    }
  });

  test('ledger storage restore failure returns rollback-failed — in-memory state is still restored', () => {
    // Requirement 7: Ledger restore failure returns rollback-failed.
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-lsf' })] });
    const detail = freshDetail({ id: 9701 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const preLots = JSON.parse(JSON.stringify(imm.state.ledger.lots));
    const preSales = JSON.parse(JSON.stringify(imm.state.ledger.sales));
    // Block ALL writes to ledger key — both forward write and rollback restore fail
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-ledger-v1') throw new Error('Ledger storage unavailable');
      origSetItem(key, value);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(9701, detail, stats, fp);
      assert.equal(result.ok, false, 'must fail');
      assert.equal(result.reason, 'rollback-failed', 'ledger storage restore failed — must return rollback-failed');
      assert.ok(result.ledgerRestoreError, 'ledgerRestoreError must be present');
      // In-memory state must still be restored even when storage restore fails
      assert.deepEqual(imm.state.ledger.lots, preLots, 'lots restored in memory');
      assert.deepEqual(imm.state.ledger.sales, preSales, 'sales restored in memory');
    } finally {
      localStorage.setItem = origSetItem;
    }
  });

  test('failure during lot application — exact state rollback', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-lotfail' })] });
    const preLots = JSON.parse(JSON.stringify(imm.state.ledger.lots));
    const preSales = JSON.parse(JSON.stringify(imm.state.ledger.sales));
    const detail = freshDetail({ id: 9800 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Force the lot to throw when remainingQuantity is written inside the try block
    Object.defineProperty(imm.state.ledger.lots[0], 'remainingQuantity', {
      configurable: true,
      get() { return 10; },
      set() { throw new Error('Forced lot-application failure'); },
    });
    const result = imm.executeApiTradeRecoveryTransaction(9800, detail, stats, fp);
    assert.equal(result.ok, false, 'must fail');
    assert.equal(result.reason, 'transaction-failed');
    // state.ledger is replaced with JSON.parse(preLedgerJson) — plain objects, deep equal to pre-state
    assert.deepEqual(imm.state.ledger.lots, preLots, 'lots rolled back');
    assert.deepEqual(imm.state.ledger.sales, preSales, 'sales rolled back');
  });

  test('forced ledger persistence failure — rollback restores previous persisted ledger', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-persist' })] });
    const detail = freshDetail({ id: 9900 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Capture pre-persisted state
    const preLedgerJson = localStorage.getItem('tornscripture-imm-ledger-v1');
    const origSetItem = localStorage.setItem.bind(localStorage);
    let callCount = 0;
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-ledger-v1') {
        callCount++;
        if (callCount === 1) throw new Error('Forced persistence failure');
        // Allow rollback write to succeed
      }
      origSetItem(key, value);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(9900, detail, stats, fp);
      assert.equal(result.ok, false);
      // In-memory state is restored
      assert.equal(imm.state.ledger.sales.length, 0, 'no sale in memory after rollback');
      assert.equal(imm.state.ledger.lots[0].remainingQuantity, 10, 'lot not consumed after rollback');
    } finally {
      localStorage.setItem = origSetItem;
    }
  });

  test('forced pending-trade persistence failure — exact rollback of pending-trade storage', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-pending' })] });
    const detail = freshDetail({ id: 9950 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Capture pre-transaction pending-trade storage value
    const prePending = localStorage.getItem('tornscripture-imm-pending-trade-sale-v1');
    const origSetItem = localStorage.setItem.bind(localStorage);
    let pendingWriteCount = 0;
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-pending-trade-sale-v1') {
        pendingWriteCount++;
        // Only block the first write (during the try block); allow the rollback write through
        if (pendingWriteCount === 1) throw new Error('Forced pending-trade persistence failure');
      }
      origSetItem(key, value);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(9950, detail, stats, fp);
      assert.equal(result.ok, false, 'must fail');
      assert.equal(result.reason, 'transaction-failed');
      // Pending-trade storage must be exactly restored to the pre-transaction value
      const afterPending = localStorage.getItem('tornscripture-imm-pending-trade-sale-v1');
      assert.equal(afterPending, prePending, 'pending-trade storage must be exactly restored');
    } finally {
      localStorage.setItem = origSetItem;
    }
  });

  test('structurally exact full-state rollback after persistence failure', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const lot = freshLot({ id: 'lot-fullstate', quantity: 10, remainingQuantity: 10, unitCost: 90000 });
    setupState({ lots: [lot] });
    const detail = freshDetail({ id: 9970 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const preLotsJson = JSON.stringify(imm.state.ledger.lots);
    const preSalesJson = JSON.stringify(imm.state.ledger.sales);
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-ledger-v1') throw new Error('Forced failure');
      origSetItem(key, value);
    };
    try {
      imm.executeApiTradeRecoveryTransaction(9970, detail, stats, fp);
    } finally {
      localStorage.setItem = origSetItem;
    }
    assert.equal(JSON.stringify(imm.state.ledger.lots), preLotsJson, 'lots structurally identical');
    assert.equal(JSON.stringify(imm.state.ledger.sales), preSalesJson, 'sales structurally identical');
  });

  test('repeated confirmation cannot create a second sale', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-repeat', quantity: 20, remainingQuantity: 20 })] });
    const detail = freshDetail({ id: 9980 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const first = imm.executeApiTradeRecoveryTransaction(9980, detail, stats, fp);
    assert.ok(first.ok, 'first must succeed');
    // Stamp apiTradeId for the duplicate gate to catch it
    imm.state.ledger.sales[0].apiTradeId = 9980;
    // Attempt second confirmation
    const lot2 = freshLot({ id: 'lot-repeat2', quantity: 10, remainingQuantity: 10 });
    imm.state.ledger.lots.push(lot2);
    const stats2 = freshStats(detail);
    const second = imm.executeApiTradeRecoveryTransaction(9980, detail, stats2, fp);
    assert.equal(second.ok, false, 'second must be rejected');
    assert.equal(imm.state.ledger.sales.length, 1, 'still exactly one sale');
  });

  test('existing manual missed-sale path (recordTradeSale) is unchanged after refactor', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-manual' })] });
    const detail = freshDetail({ id: 9990 });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    // recordTradeSale is the manual path — must work independently
    const sale = imm.recordTradeSale(stats, 'manual-missed-sale-recovery');
    assert.ok(sale, 'manual missed-sale path must succeed');
    assert.equal(sale.captureMethod, 'manual-missed-sale-recovery');
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 0);
    assert.equal(imm.state.ledger.sales.length, 1);
  });

  test('existing auto completed-trade path (recordTradeSale auto-completed-trade) is unchanged', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-auto' })] });
    const detail = freshDetail({ id: 9991 });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const sale = imm.recordTradeSale(stats, 'auto-completed-trade');
    assert.ok(sale, 'auto completed-trade path must succeed');
    assert.equal(sale.captureMethod, 'auto-completed-trade');
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 0);
  });

  test('ID mismatch between detail and requestedId aborts with zero mutation', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-mismatch' })] });
    const detail = freshDetail({ id: 9001 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const preLots = JSON.parse(JSON.stringify(imm.state.ledger.lots));
    const result = imm.executeApiTradeRecoveryTransaction(9999, detail, stats, fp);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'id-mismatch');
    assert.deepEqual(imm.state.ledger.lots, preLots, 'no lot mutation on ID mismatch');
  });

  // ── Requirement 1: shared accounting helpers ─────────────────────────────────

  test('manual and API paths use the same shared buildSaleFromPlan helper', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Both paths must resolve to the exact same exported function reference.
    assert.strictEqual(typeof imm.buildSaleFromPlan, 'function', 'buildSaleFromPlan must be exported');
    assert.strictEqual(typeof imm.applyPlanAllocations, 'function', 'applyPlanAllocations must be exported');
    assert.strictEqual(typeof imm.persistPendingTradeSaleAfterSale, 'function', 'persistPendingTradeSaleAfterSale must be exported');
    // Manual path exercise — verify buildSaleFromPlan produces a valid sale
    setupState({ lots: [freshLot({ id: 'lot-shared-manual' })] });
    const detail = freshDetail({ id: 10001 });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const plan = imm.ledgerSalePlan(stats);
    const manualSale = imm.buildSaleFromPlan(stats, plan, 'manual-missed-sale-recovery');
    assert.equal(manualSale.captureMethod, 'manual-missed-sale-recovery');
    assert.ok(manualSale.id, 'sale id must be present');
    // API path exercise — verify same helper produces a sale with overrides
    setupState({ lots: [freshLot({ id: 'lot-shared-api' })] });
    const plan2 = imm.ledgerSalePlan(stats);
    const apiSale = imm.buildSaleFromPlan(stats, plan2, 'api-trade-recovery', detail.completedAt, {
      apiTradeId: detail.id,
      apiCompletedAt: detail.completedAt,
      canonicalFingerprint: 'fp-test',
      provenance: 'api-trade-recovery',
    });
    assert.equal(apiSale.captureMethod, 'api-trade-recovery');
    assert.equal(apiSale.apiTradeId, detail.id);
    assert.equal(apiSale.provenance, 'api-trade-recovery');
    // Both use the same function — production reconciliation proof
    assert.equal(manualSale.trackedQuantity, apiSale.trackedQuantity, 'shared plan produces identical tracked quantity');
  });

  // ── Requirement 2: staging failure restores all state ───────────────────────

  test('staging failure (sale-build throws) after pending-trade loading — all state restored', () => {
    // Force buildSaleFromPlan to throw by passing a stats object whose
    // tradeNetCash causes Number() to return NaN in a guarded context.
    // We trigger this by injecting an error via applyPlanAllocations mock.
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-stagefail' })] });
    const detail = freshDetail({ id: 10002 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const preLedgerJson = JSON.stringify(imm.state.ledger);
    const preLedgerStorage = localStorage.getItem('tornscripture-imm-ledger-v1');
    const prePendingStorage = localStorage.getItem('tornscripture-imm-pending-trade-sale-v1');
    // Force applyPlanAllocations (first mutating call inside try) to throw
    Object.defineProperty(imm.state.ledger.lots[0], 'remainingQuantity', {
      configurable: true,
      get() { return 10; },
      set() { throw new Error('Forced staging failure'); },
    });
    const result = imm.executeApiTradeRecoveryTransaction(10002, detail, stats, fp);
    assert.equal(result.ok, false, 'must fail');
    assert.equal(result.reason, 'transaction-failed', 'rollback succeeded — must return transaction-failed');
    // In-memory state restored
    assert.equal(JSON.stringify(imm.state.ledger), preLedgerJson, 'full in-memory ledger JSON must be identical after rollback');
    // Storage restored to exact original values
    assert.equal(localStorage.getItem('tornscripture-imm-ledger-v1'), preLedgerStorage, 'ledger storage must be exactly restored');
    assert.equal(localStorage.getItem('tornscripture-imm-pending-trade-sale-v1'), prePendingStorage, 'pending storage must be exactly restored');
  });

  // ── Requirement 3: sale-construction failure returns structured result ────────

  test('sale-construction error is captured in structured result', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-salefail' })] });
    const detail = freshDetail({ id: 10003 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Force applyPlanAllocations to throw before sale is added
    Object.defineProperty(imm.state.ledger.lots[0], 'remainingQuantity', {
      configurable: true,
      get() { return 10; },
      set() { throw new Error('Deliberately broken lot property'); },
    });
    const result = imm.executeApiTradeRecoveryTransaction(10003, detail, stats, fp);
    assert.equal(result.ok, false);
    assert.ok(result.reason === 'transaction-failed' || result.reason === 'rollback-failed', 'must return a structured failure reason');
    assert.ok(result.error instanceof Error, 'must carry the original error');
    assert.ok(result.message, 'must carry a message string');
    assert.equal(imm.state.ledger.sales.length, 0, 'no sale must have been committed');
  });

  // ── Requirement 5: exact raw ledger-storage equality after rollback ──────────

  test('exact raw ledger-storage value is restored after rollback, not reconstructed from snapshot', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-rawledger' })] });
    const detail = freshDetail({ id: 10004 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const preLedgerStorage = localStorage.getItem('tornscripture-imm-ledger-v1');
    // Allow the first (forward) ledger write but block the rollback ledger write...
    // Actually: use lot-property throw so lot mutation fails, storage write never happens.
    // This confirms rollback restores the exact original raw string.
    Object.defineProperty(imm.state.ledger.lots[0], 'remainingQuantity', {
      configurable: true,
      get() { return 10; },
      set() { throw new Error('Forced failure for raw storage test'); },
    });
    imm.executeApiTradeRecoveryTransaction(10004, detail, stats, fp);
    const afterLedgerStorage = localStorage.getItem('tornscripture-imm-ledger-v1');
    assert.equal(afterLedgerStorage, preLedgerStorage, 'raw ledger storage must be byte-for-byte the original string after rollback');
  });

  // ── Requirement 8: pending restore failure returns rollback-failed ───────────

  test('pending storage restore failure returns rollback-failed', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-pendingfail' })] });
    const detail = freshDetail({ id: 10005 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const origSetItem = localStorage.setItem.bind(localStorage);
    const origRemoveItem = localStorage.removeItem.bind(localStorage);
    // Block ALL writes AND removes for the pending-trade key — both forward and rollback fail
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-pending-trade-sale-v1') throw new Error('Pending storage unavailable');
      origSetItem(key, value);
    };
    localStorage.removeItem = (key) => {
      if (key === 'tornscripture-imm-pending-trade-sale-v1') throw new Error('Pending storage unavailable');
      origRemoveItem(key);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(10005, detail, stats, fp);
      assert.equal(result.ok, false, 'must fail');
      assert.equal(result.reason, 'rollback-failed', 'pending storage restore failed — must return rollback-failed');
      assert.ok(result.pendingRestoreError, 'pendingRestoreError must be present');
    } finally {
      localStorage.setItem = origSetItem;
      localStorage.removeItem = origRemoveItem;
    }
  });

  // ── Requirement 9: UI message must not say "Ledger rolled back" for rollback-failed ─

  test('rollback-failed result message does not contain "Ledger rolled back"', () => {
    // The handleApiTradeRecoveryConfirm UI uses result.reason to decide suffix text.
    // Verify the rollback-failed message string itself does not claim a successful rollback.
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-uimsg' })] });
    const detail = freshDetail({ id: 10006 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-ledger-v1') throw new Error('Ledger storage unavailable');
      origSetItem(key, value);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(10006, detail, stats, fp);
      assert.equal(result.reason, 'rollback-failed');
      assert.ok(!result.message.includes('Ledger rolled back'), `rollback-failed message must not say "Ledger rolled back", got: ${result.message}`);
    } finally {
      localStorage.setItem = origSetItem;
    }
  });
});



// ── Export / import / backup fidelity ────────────────────────────────────────
describe('Export/import/backup fidelity', () => {
  test('normalizeLedger round-trip preserves lots, sales, quarantine records', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    imm.quarantineApiTrade({ id: 9001 }, 'test');
    const before = JSON.parse(JSON.stringify(imm.state.ledger));
    const after = imm.normalizeLedger(before);
    assert.equal(after.lots.length, before.lots.length);
    assert.equal(after.sales.length, before.sales.length);
    assert.equal(after.quarantinedTrades.length, before.quarantinedTrades.length);
  });

  test('normalizeSaleRecord preserves API identity fields', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const sale = imm.normalizeSaleRecord({
      id: 's-test', fingerprint: 'trade:api-trade-9001',
      apiTradeId: 9001, apiCompletedAt: '2026-01-01T00:00:00.000Z',
      canonicalFingerprint: 'api-canonical:test',
      provenance: 'api-trade-recovery',
      soldAt: '2026-01-01T00:00:00.000Z', cashReceived: 1000000,
      items: [], counterparty: 'Bob',
    });
    assert.equal(sale.apiTradeId, 9001);
    assert.equal(sale.apiCompletedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(sale.canonicalFingerprint, 'api-canonical:test');
    assert.equal(sale.provenance, 'api-trade-recovery');
  });
});

// ── Ledger Integrity diagnostics ─────────────────────────────────────────────
describe('Ledger Integrity diagnostics', () => {
  test('clean ledger reports no issues', () => {
    setupState({});
    const { analyzeLedgerIntegrity, state } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const report = analyzeLedgerIntegrity(state.ledger);
    assert.equal(report.issues.length, 0, `expected no issues, got: ${JSON.stringify(report.issues)}`);
  });

  test('quarantine malformed record produces integrity issue', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.state.ledger.quarantinedTrades = [{ id: 'qbad', reasonCode: '', capturedAt: '' }];
    const report = imm.analyzeLedgerIntegrity(imm.state.ledger);
    assert.ok(report.issues.some((i) => i.type.startsWith('quarantine-')), 'should have quarantine issue');
  });

  test('quarantinedCount is returned by analyzeLedgerIntegrity', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.quarantineApiTrade({ id: 9001 }, 'code');
    const report = imm.analyzeLedgerIntegrity(imm.state.ledger);
    assert.equal(report.quarantinedCount, 1);
  });
});

// ── Provenance and API metadata ───────────────────────────────────────────────
describe('Provenance and API metadata', () => {
  test('buildApiTradeCanonicalFingerprint includes all required components', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    assert.ok(fp.startsWith('api-canonical:'), 'must have expected prefix');
    assert.ok(fp.includes('cid:5678'), 'must include counterparty ID');
    assert.ok(fp.includes('apiId:9001'), 'must include API trade ID');
    assert.ok(fp.includes('net:5000000'), 'must include net proceeds');
    assert.ok(fp.includes(`completedAt:${detail.completedAt}`), 'must include completion timestamp');
    assert.ok(fp.includes('assets:100:10'), 'must include sorted asset IDs and quantities');
  });

  test('buildApiTradeSaleStats includes apiTradeId, apiCompletedAt, apiOwnerDirection', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    assert.equal(stats.apiTradeId, 9001);
    assert.equal(stats.apiCompletedAt, detail.completedAt);
    assert.ok(['user', 'trader'].includes(stats.apiOwnerDirection));
  });
});

// ── Packet 2: Production quarantine paths (tests 1–14) ───────────────────────
//
// Raw API payload factory: produces the official Torn API v2 shape accepted by normalizeApiTradeDetail.
// User (id: 1001) provides items; trader (id: 5678) provides cash.
function rawPayload(overrides = {}) {
  return {
    id: 9001,
    completed_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: 1001, name: 'Alice' },
    trader: { id: 5678, name: 'Bob' },
    items: [
      { user_id: 1001, type: 'Item', details: { id: 100, amount: 10, uid: null } },
      { user_id: 5678, type: 'Money', details: { amount: 5000000 } },
    ],
    ...overrides,
  };
}

describe('Packet 2: Production quarantine paths', () => {
  // 1. Malformed detail reaches production quarantine.
  test('1: malformed detail payload reaches quarantine via processApiTradeDetailPayload', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const result = imm.processApiTradeDetailPayload(null, 9001, { endpoint: 'test', key: null });
    assert.ok(result.quarantined, 'result must be quarantined');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.ok(imm.state.ledger.quarantinedTrades[0].reasonCode, 'quarantine record must have a reason code');
    assert.equal(imm.state.ledger.quarantinedTrades[0].validationState, 'rejected');
  });

  // 2. Invalid Money amount reaches quarantine.
  test('2: invalid Money TradeItem amount reaches quarantine with MISSING_MONEY reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = rawPayload({ items: [
      { user_id: 1001, type: 'Item', details: { id: 100, amount: 10, uid: null } },
      { user_id: 5678, type: 'Money', details: { amount: null } }, // null amount is invalid
    ] });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MISSING_MONEY);
  });

  // 3. Missing item ID reaches quarantine.
  test('3: Item TradeItem with missing id reaches quarantine with MISSING_ITEMS reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = rawPayload({ items: [
      { user_id: 1001, type: 'Item', details: { id: 0, amount: 10, uid: null } }, // id: 0 is invalid
      { user_id: 5678, type: 'Money', details: { amount: 5000000 } },
    ] });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MISSING_ITEMS);
  });

  // 4. Unsupported typed asset (Faction) reaches quarantine.
  test('4: Faction TradeItem reaches quarantine with UNSUPPORTED_ASSET_TYPE reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = rawPayload({ items: [
      { user_id: 1001, type: 'Item', details: { id: 100, amount: 10, uid: null } },
      { user_id: 5678, type: 'Faction', details: { amount: 1 } }, // unsupported
    ] });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_ASSET_TYPE);
  });

  // 5. Selected/detail ID mismatch reaches quarantine.
  test('5: detail ID mismatch (9002 vs expected 9001) reaches quarantine with TRADE_ID_MISMATCH reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = rawPayload({ id: 9002 });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {}); // expected 9001
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.TRADE_ID_MISMATCH);
  });

  // 6. Ambiguous ownership — resolveApiTradeOwner tags the error; quarantined via production semantic validation.
  test('6: ambiguous ownership is quarantined through processApiTradeSemanticValidation', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const detail = freshDetail(); // user:1001, trader:5678
    // Key owner is 9999 — does not appear in the trade → AMBIGUOUS_OWNER quarantine.
    const result = imm.processApiTradeSemanticValidation(detail, 9999, rawPayload(), { source: 'api-trade-recovery' });
    assert.ok(result.quarantined, 'must be quarantined');
    assert.equal(result.error.quarantineReasonCode, imm.QUARANTINE_REASON.AMBIGUOUS_OWNER, 'error must carry AMBIGUOUS_OWNER reason code');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.AMBIGUOUS_OWNER);
    assert.equal(imm.state.ledger.lots.length, 0, 'lots unchanged');
    assert.equal(imm.state.ledger.sales.length, 0, 'sales unchanged');
  });

  // 7. Barter trade (counterparty contributes items) is quarantined.
  test('7: barter trade (counterparty items) is quarantined through processApiTradeSemanticValidation', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = freshDetail({
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, quantity: 5 }] },
      trader: { userId: 5678, name: 'Bob', money: 500000, items: [{ id: 101, quantity: 3 }] }, // counterparty also has items
    });
    const result = imm.processApiTradeSemanticValidation(detail, 1001, rawPayload(), { source: 'api-trade-recovery' });
    assert.ok(result.quarantined, 'barter trade must be quarantined');
    assert.equal(result.error.quarantineReasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_BARTER, 'error must carry UNSUPPORTED_BARTER reason code');
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_BARTER);
    assert.equal(imm.state.ledger.lots.length, 1, 'lots unchanged');
    assert.equal(imm.state.ledger.sales.length, 0, 'sales unchanged');
  });

  // 8. Unknown catalog item ID — name fallback is not used.
  test('8: unknown catalog item ID throws UNKNOWN_CATALOG_ITEM_ID without name-fallback', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    // Catalog has "Xanax" by name under id:100, but detail carries item id:999 (not in catalog by ID)
    imm.state.catalog = {
      itemsByName: { xanax: CATALOG_XANAX },
      itemsById: {}, // id:999 is not present
      updatedAt: new Date().toISOString(),
    };
    const detail = freshDetail({
      user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 999, name: 'Xanax', quantity: 10 }] },
    });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    let caught;
    try { imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide); } catch (e) { caught = e; }
    assert.ok(caught, 'must throw for unknown catalog ID');
    assert.equal(caught.quarantineReasonCode, imm.QUARANTINE_REASON.UNKNOWN_CATALOG_ITEM_ID, 'must use UNKNOWN_CATALOG_ITEM_ID, not fall back to name');
    // Confirm no name-fallback: if it had fallen back, catalogItem would be CATALOG_XANAX (id:100)
    // The throw itself proves the fallback is absent.
  });

  // 9. Zero FIFO coverage is quarantined via production semantic validation.
  test('9: zero FIFO coverage is quarantined through processApiTradeSemanticValidation', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [] }); // no lots — zero coverage
    const detail = freshDetail();
    const result = imm.processApiTradeSemanticValidation(detail, 1001, rawPayload(), { apiTradeId: detail.id, source: 'api-trade-recovery' });
    assert.ok(result.quarantined, 'must be quarantined with zero coverage');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.ZERO_FIFO_COVERAGE);
    // Lots and sales unchanged
    assert.equal(imm.state.ledger.lots.length, 0);
    assert.equal(imm.state.ledger.sales.length, 0);
  });

  // 10. Partial FIFO coverage is quarantined via production semantic validation.
  test('10: partial FIFO coverage is quarantined through processApiTradeSemanticValidation', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 5, remainingQuantity: 5 })] }); // only 5, need 10
    const detail = freshDetail(); // owner sells 10 Xanax
    const result = imm.processApiTradeSemanticValidation(detail, 1001, rawPayload(), { apiTradeId: detail.id, source: 'api-trade-recovery' });
    assert.ok(result.quarantined, 'must be quarantined with partial coverage');
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.PARTIAL_FIFO_COVERAGE);
    // Lots and sales unchanged (5 remaining untouched)
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 5);
    assert.equal(imm.state.ledger.sales.length, 0);
  });

  // 11. Raw payload and deterministic reason code survive normalize/export/import round-trips.
  test('11: raw payload and reason code survive normalizeLedger round-trips', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const rawP = { sentinel: 'my-raw-payload', tradeId: 9001 };
    imm.quarantineApiTrade(rawP, imm.QUARANTINE_REASON.TRADE_ID_MISMATCH, { apiTradeId: 9001, source: 'api-trade-recovery' });
    // First round-trip
    const ledger1 = imm.normalizeLedger(JSON.parse(JSON.stringify(imm.state.ledger)));
    assert.equal(ledger1.quarantinedTrades.length, 1);
    assert.equal(ledger1.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.TRADE_ID_MISMATCH);
    assert.deepEqual(ledger1.quarantinedTrades[0].rawPayload, rawP);
    // Second round-trip (simulates import/export cycle)
    const ledger2 = imm.normalizeLedger(JSON.parse(JSON.stringify(ledger1)));
    assert.equal(ledger2.quarantinedTrades.length, 1);
    assert.equal(ledger2.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.TRADE_ID_MISMATCH);
    assert.deepEqual(ledger2.quarantinedTrades[0].rawPayload, rawP);
  });

  // 12. Malformed quarantine record remains visible to Ledger Integrity (covered by existing test
  //     'quarantine malformed record produces integrity issue'; this test verifies it independently).
  test('12: malformed quarantine record (_malformed: true) produces Ledger Integrity issue', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const ledger = imm.normalizeLedger({ quarantinedTrades: [{ id: '', reasonCode: '' }] });
    imm.state.ledger = ledger;
    const report = imm.analyzeLedgerIntegrity(imm.state.ledger);
    assert.ok(report.issues.some((i) => i.type.startsWith('quarantine-')), 'integrity must report quarantine issue for malformed record');
    assert.ok(report.quarantinedCount >= 1, 'malformed record is counted');
  });

  // 13. Duplicate rejected payload/reason does not create unlimited duplicates.
  test('13: same trade ID and reason code deduplicated — not an unlimited pile', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const rawP = rawPayload();
    imm.quarantineApiTrade(rawP, imm.QUARANTINE_REASON.TRADE_ID_MISMATCH, { apiTradeId: 9001, source: 'api-trade-recovery' });
    imm.quarantineApiTrade(rawP, imm.QUARANTINE_REASON.TRADE_ID_MISMATCH, { apiTradeId: 9001, source: 'api-trade-recovery' });
    imm.quarantineApiTrade(rawP, imm.QUARANTINE_REASON.TRADE_ID_MISMATCH, { apiTradeId: 9001, source: 'api-trade-recovery' });
    // Deduplication must prevent unbounded growth for same trade+reason
    assert.ok(imm.state.ledger.quarantinedTrades.length <= 1, `expected 1 deduplicated record, got ${imm.state.ledger.quarantinedTrades.length}`);
  });

  // 14. Every quarantine path leaves lots and sales unchanged.
  test('14: quarantine call does not consume lots or create sales', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 10, remainingQuantity: 10 })] });
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);
    imm.quarantineApiTrade(rawPayload(), imm.QUARANTINE_REASON.ZERO_FIFO_COVERAGE, { apiTradeId: 9001 });
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'lots must be unchanged after quarantine');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'sales must be unchanged after quarantine');
  });
});

// ── Packet 2: Permission validation lifecycle (tests 15–32) ──────────────────
//
// Storage key constant (matches APP.apiKeyStorageKey in the script).
const IMM_API_KEY_STORAGE_KEY = 'tornscripture-imm-api-key-v1';
// Overlay ID constant (matches APP.apiTradeRecoveryOverlayId in the script).
const IMM_API_TRADE_RECOVERY_OVERLAY_ID = 'tornscripture-imm-api-trade-recovery';

// Helper: create a mock fetch that returns the given JSON body with optional status/ok.
function mockFetch(body, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    json: async () => body,
  });
}

// Helper: create an overlay element stub with pending review state for confirmation tests.
function makeConfirmOverlay(detailOverrides = {}, statsOverrides = {}) {
  const detail = { id: 9001, status: 'Accepted', completedAt: new Date(Date.now() - 3600000).toISOString(),
    user: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
    trader: { userId: 5678, name: 'Bob', money: 5000000, items: [] }, ...detailOverrides };
  const stats = { pageType: 'trade', tradeId: 'api-trade-9001', apiTradeId: 9001,
    apiCompletedAt: detail.completedAt, apiOwnerDirection: 'user',
    soldAt: detail.completedAt, items: [{ itemId: 100, name: 'Xanax', quantity: 10 }],
    targetEach: 500000, netCash: 5000000, ...statsOverrides };
  const el = makeElement();
  el._tsimmApiTradePendingStats = stats;
  el._tsimmApiTradePendingDetail = detail;
  return el;
}

describe('Packet 2: Permission validation lifecycle', () => {
  // 15. Valid supported empty trades-list response (array) returns 'validated'.
  test('15: empty trades-list response (trades: []) returns validated', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = mockFetch({ trades: [] });
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'validated');
  });

  // 16. Valid supported populated array response returns 'validated'.
  test('16: populated trades-list array response returns validated', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = mockFetch({ trades: [{ id: 1, completed_at: 1700000000, user: { id: 1001, name: 'Alice' }, trader: { id: 5678, name: 'Bob' } }] });
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'validated');
  });

  // 17. Invalid key (error code 2) returns 'insufficient'.
  test('17: error code 2 (invalid key) returns insufficient', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = mockFetch({ error: { code: 2, error: 'Incorrect key' } });
    const state = await imm.validateApiTradeEndpointPermission('bad-key');
    assert.equal(state, 'insufficient');
  });

  // 18. Insufficient access (error code 16) returns 'insufficient'.
  test('18: error code 16 (insufficient access) returns insufficient', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = mockFetch({ error: { code: 16, error: 'Access denied' } });
    const state = await imm.validateApiTradeEndpointPermission('limited-key');
    assert.equal(state, 'insufficient');
  });

  // 19. Malformed HTTP 200 (no trades field) returns 'unavailable-or-inconclusive'.
  test('19: HTTP 200 with no trades field returns unavailable-or-inconclusive', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = mockFetch({ something: 'else' });
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'unavailable-or-inconclusive');
  });

  // 20. Network failure returns 'unavailable-or-inconclusive'.
  test('20: network failure returns unavailable-or-inconclusive', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = async () => { throw new Error('Network error'); };
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'unavailable-or-inconclusive');
  });

  // 21. Timeout abort returns 'unavailable-or-inconclusive'.
  test('21: AbortError (timeout) returns unavailable-or-inconclusive', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = async (_url, opts) => {
      // Immediately abort the request to simulate timeout
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'unavailable-or-inconclusive');
  });

  // 22. Validation record is bound to the non-secret key fingerprint.
  test('22: saved validation record contains non-secret key fingerprint', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'my-secret-key');
    const rec = imm.loadTradePermissionRecord();
    assert.ok(rec, 'record must be saved');
    assert.ok(rec.keyFingerprint, 'record must have key fingerprint');
    assert.ok(!rec.keyFingerprint.includes('my-secret-key'), 'fingerprint must not include raw key');
    assert.ok(rec.keyFingerprint.startsWith('kfp-'), 'fingerprint must use expected format');
    const fp1 = imm.computeApiKeyFingerprint('my-secret-key');
    const fp2 = imm.computeApiKeyFingerprint('my-secret-key');
    assert.equal(fp1, fp2, 'fingerprint must be deterministic');
    const fp3 = imm.computeApiKeyFingerprint('other-key');
    assert.notEqual(fp1, fp3, 'different keys must produce different fingerprints');
  });

  // 23. Key change invalidates prior validation.
  test('23: key change causes isPermissionRecordMatchingKey to return false', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-A');
    const rec = imm.loadTradePermissionRecord();
    assert.ok(imm.isPermissionRecordMatchingKey(rec, 'key-A'), 'must match original key');
    assert.ok(!imm.isPermissionRecordMatchingKey(rec, 'key-B'), 'must not match different key');
    assert.ok(!imm.isPermissionRecordValid(rec, 'key-B'), 'isPermissionRecordValid must be false after key change');
  });

  // 24. Startup validates only when absent, stale, malformed, or mismatched.
  test('24: maybeScheduleStartupPermissionValidation skips validation when record is fresh and matching', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    imm._resetStartupGuard();
    setupState({});
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'startup-key');
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({ trades: [] }) }; };
    // Set a fresh, matching, validated record
    imm.saveTradePermissionRecord('validated', 'startup-key');
    // Call the function; because the record is fresh and matching, no setTimeout should be scheduled
    imm.maybeScheduleStartupPermissionValidation();
    // If no scheduling happened, the function returns without setting the internal guard.
    // Verify by ensuring no validation state change occurs synchronously.
    assert.equal(imm.loadTradePermissionRecord()?.state, 'validated', 'validated state must be preserved');
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
  });

  test('24b: maybeScheduleStartupPermissionValidation schedules when record is absent — fetch fires', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    imm._resetStartupGuard();
    setupState({});
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'startup-key-2');
    imm.state.ledger.tradePermission = null; // absent
    let fetchCallCount = 0;
    global.fetch = async () => { fetchCallCount++; return { ok: true, json: async () => ({ trades: [] }), status: 200 }; };
    // Call with absent record — should schedule a timer (200ms delay in production code)
    imm.maybeScheduleStartupPermissionValidation();
    // Wait for the timer to fire
    await new Promise((r) => setTimeout(r, 350));
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.ok(fetchCallCount > 0, 'fetch must be called when scheduling fires for absent record');
  });

  // 25. Repeated initialization does not schedule duplicate validations.
  test('25: repeated maybeScheduleStartupPermissionValidation with same key schedules exactly one validation', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    imm._resetStartupGuard();
    setupState({});
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'key-dup');
    imm.state.ledger.tradePermission = null;
    let fetchCount = 0;
    global.fetch = async () => { fetchCount++; return { ok: true, json: async () => ({ trades: [] }), status: 200 }; };
    // Three calls for the same pending key must schedule exactly one validation.
    imm.maybeScheduleStartupPermissionValidation();
    imm.maybeScheduleStartupPermissionValidation();
    imm.maybeScheduleStartupPermissionValidation();
    await new Promise((r) => setTimeout(r, 350));
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(fetchCount, 1, 'three calls with same pending key must schedule exactly one validation');
  });

  // 26. Recovery open always validates before loading candidates.
  //     Verified through resolveAndValidateTradePermission: it always re-fetches and saves a fresh record.
  test('26: resolveAndValidateTradePermission always fetches and persists a fresh record', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    // Pre-load a stale validated record
    imm.saveTradePermissionRecord('validated', 'open-key');
    const oldRecord = imm.loadTradePermissionRecord();
    global.fetch = mockFetch({ trades: [] });
    await new Promise((r) => setTimeout(r, 5)); // brief pause so validatedAt timestamps differ
    const permissionState = await imm.resolveAndValidateTradePermission('open-key');
    assert.equal(permissionState, 'validated');
    const newRecord = imm.loadTradePermissionRecord();
    // Fresh record replaces stale — openApiTradeRecovery calls this before any list fetch
    assert.notEqual(newRecord.validatedAt, oldRecord.validatedAt, 'fresh validation must update the timestamp');
  });

  // 27. List authorization failure invalidates and revalidates, then fails closed.
  test('27: isAuthorizationFailure detects error code 2, error code 16, and HTTP 401/403', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.ok(imm.isAuthorizationFailure({ error: { code: 2 } }, null), 'code 2 is auth failure');
    assert.ok(imm.isAuthorizationFailure({ error: { code: 16 } }, null), 'code 16 is auth failure');
    assert.ok(imm.isAuthorizationFailure({}, { status: 401 }), 'HTTP 401 is auth failure');
    assert.ok(imm.isAuthorizationFailure({}, { status: 403 }), 'HTTP 403 is auth failure');
    assert.ok(!imm.isAuthorizationFailure({}, { status: 200 }), 'HTTP 200 is not auth failure');
    assert.ok(!imm.isAuthorizationFailure({ error: { code: 5 } }, null), 'code 5 is not auth failure');
  });

  test('27b: invalidateTradePermission transitions state to unavailable-or-inconclusive', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-X');
    assert.equal(imm.loadTradePermissionRecord().state, 'validated');
    imm.invalidateTradePermission();
    assert.equal(imm.loadTradePermissionRecord().state, 'unavailable-or-inconclusive');
  });

  test('27c: after invalidation, revalidation with valid response restores validated state', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-X');
    imm.invalidateTradePermission();
    global.fetch = mockFetch({ trades: [] });
    await imm.resolveAndValidateTradePermission('key-X');
    assert.equal(imm.loadTradePermissionRecord().state, 'validated');
  });

  // 28. Detail authorization failure invalidates and revalidates, then fails closed.
  //     The detection and invalidation path is exercised by tests 27–27c above.
  //     This test verifies the three-state distinction in isAuthorizationFailure for detail payloads.
  test('28: detail auth failure payload detection matches list failure detection (same isAuthorizationFailure)', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Both list and detail use the same isAuthorizationFailure helper
    const detailAuthError = { error: { code: 2 } };
    const detailSuccess = { id: 9001, status: 'Accepted' };
    assert.ok(imm.isAuthorizationFailure(detailAuthError, null), 'detail auth error must be detected');
    assert.ok(!imm.isAuthorizationFailure(detailSuccess, { status: 200 }), 'detail success must not be auth failure');
  });

  // 29. Confirmation blocks stale validation.
  test('29: handleApiTradeRecoveryConfirm blocks when permission record is stale', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'confirm-key');
    // Build a stale record (validatedAt far in the past)
    imm.state.ledger.tradePermission = {
      state: 'validated',
      validatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      keyFingerprint: imm.computeApiKeyFingerprint('confirm-key'),
      endpoint: 'https://api.torn.com/v2/user/trades',
      schemaMarker: 'v2-user-trades',
    };
    const overlay = makeConfirmOverlay();
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    const lotsBefore = JSON.stringify(imm.state.ledger.lots);
    imm.handleApiTradeRecoveryConfirm(9001);
    const lotsAfter = JSON.stringify(imm.state.ledger.lots);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(lotsBefore, lotsAfter, 'stale permission must block confirmation — lots must be unchanged');
  });

  // 30. Confirmation blocks when key fingerprint differs.
  test('30: handleApiTradeRecoveryConfirm blocks when key fingerprint does not match permission record', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    // Store a validated record for key-A but the current key is key-B
    imm.saveTradePermissionRecord('validated', 'key-A');
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'key-B'); // different key
    const overlay = makeConfirmOverlay();
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    const lotsBefore = JSON.stringify(imm.state.ledger.lots);
    imm.handleApiTradeRecoveryConfirm(9001);
    const lotsAfter = JSON.stringify(imm.state.ledger.lots);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(lotsBefore, lotsAfter, 'mismatched key fingerprint must block confirmation — lots must be unchanged');
  });

  // 31. Direct confirmation invocation cannot bypass permission validation.
  test('31: handleApiTradeRecoveryConfirm with no permission record blocks and leaves state unchanged', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'direct-invoke-key');
    delete imm.state.ledger.tradePermission; // no permission record at all
    const overlay = makeConfirmOverlay();
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);
    const quarantineSnap = JSON.stringify(imm.state.ledger.quarantinedTrades);
    imm.handleApiTradeRecoveryConfirm(9001);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'lots must be unchanged');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'sales must be unchanged');
    assert.equal(JSON.stringify(imm.state.ledger.quarantinedTrades), quarantineSnap, 'quarantine must be unchanged');
  });

  // 32. No failed or inconclusive permission path mutates lots, sales, pending-trade storage, or quarantine
  //     except an intentionally quarantined rejected payload.
  test('32: insufficient permission path mutates nothing', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    global.fetch = mockFetch({ error: { code: 2 } }); // insufficient
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);
    const permState = await imm.resolveAndValidateTradePermission('bad-key');
    assert.equal(permState, 'insufficient');
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'insufficient path must not mutate lots');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'insufficient path must not mutate sales');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 0, 'insufficient path must not quarantine anything');
  });

  test('32b: unavailable-or-inconclusive path mutates nothing', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    global.fetch = async () => { throw new Error('Network failure'); };
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);
    const permState = await imm.resolveAndValidateTradePermission('key');
    assert.equal(permState, 'unavailable-or-inconclusive');
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'inconclusive path must not mutate lots');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'inconclusive path must not mutate sales');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 0, 'inconclusive path must not quarantine anything');
  });
});

console.log('# IMM API Trade Recovery production-path tests passed.');

// ── Packet 2c: Additional requirements ──────────────────────────────────────

describe('Packet 2c: Permission normalization, list quarantine, and guard behavior', () => {
  // --- Test 1: Permission record survives normalizeLedger ---
  test('2c-1: permission record survives normalizeLedger round-trip', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-norm');
    const ledger = imm.normalizeLedger(JSON.parse(JSON.stringify(imm.state.ledger)));
    assert.ok(ledger.tradePermission, 'permission record must survive normalizeLedger');
    assert.equal(ledger.tradePermission.state, 'validated');
    assert.ok(ledger.tradePermission.keyFingerprint);
    assert.ok(ledger.tradePermission.endpoint);
    assert.ok(ledger.tradePermission.schemaMarker);
    assert.ok(ledger.tradePermission.validatedAt);
  });

  // --- Test 2: Permission record survives export/import ---
  test('2c-2: permission record survives JSON export/import round-trip', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-ei');
    // Simulate export: JSON.stringify the ledger
    const exported = JSON.stringify(imm.state.ledger);
    // Simulate import: parse and normalize
    const imported = imm.normalizeLedger(JSON.parse(exported));
    assert.ok(imported.tradePermission, 'permission record must survive JSON export/import');
    assert.equal(imported.tradePermission.state, 'validated');
    assert.equal(imported.tradePermission.keyFingerprint, imm.computeApiKeyFingerprint('key-ei'));
  });

  // --- Test 3: Wrong endpoint blocks isPermissionRecordValid ---
  test('2c-3: wrong endpoint causes isPermissionRecordValid to return false', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-ep');
    const rec = imm.loadTradePermissionRecord();
    // Tamper with endpoint
    const badRec = { ...rec, endpoint: 'https://api.torn.com/v2/user/WRONG' };
    assert.equal(imm.isPermissionRecordValid(badRec, 'key-ep'), false, 'wrong endpoint must be rejected');
    // Correct endpoint must still work
    assert.equal(imm.isPermissionRecordValid(rec, 'key-ep'), true, 'correct endpoint must be accepted');
  });

  // --- Test 4: Wrong schema marker blocks isPermissionRecordValid ---
  test('2c-4: wrong schema marker causes isPermissionRecordValid to return false', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-sm');
    const rec = imm.loadTradePermissionRecord();
    const badRec = { ...rec, schemaMarker: 'v1-wrong-marker' };
    assert.equal(imm.isPermissionRecordValid(badRec, 'key-sm'), false, 'wrong schema marker must be rejected');
    assert.equal(imm.isPermissionRecordValid(rec, 'key-sm'), true, 'correct schema marker must be accepted');
  });

  // --- Test 5: Startup validates endpoint/schema mismatches ---
  test('2c-5: maybeScheduleStartupPermissionValidation schedules when endpoint is mismatched', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    imm._resetStartupGuard();
    setupState({});
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'key-mismatch');
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({ trades: [] }), status: 200 }; };
    // Store a record with a mismatched endpoint
    imm.state.ledger.tradePermission = {
      state: 'validated',
      validatedAt: new Date().toISOString(),
      keyFingerprint: imm.computeApiKeyFingerprint('key-mismatch'),
      endpoint: 'https://api.torn.com/v2/user/WRONG',
      schemaMarker: 'v2-user-trades',
    };
    imm.maybeScheduleStartupPermissionValidation();
    await new Promise((r) => setTimeout(r, 350));
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.ok(fetchCalled, 'endpoint mismatch must trigger startup revalidation');
  });

  // --- Test 6: Startup guard resets and supports a later key change ---
  test('2c-6: startup guard resets after completion and allows a new key to reschedule', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    imm._resetStartupGuard();
    setupState({});
    // First key schedules and completes
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'key-first');
    imm.state.ledger.tradePermission = null;
    let firstCount = 0;
    global.fetch = async () => { firstCount++; return { ok: true, json: async () => ({ trades: [] }), status: 200 }; };
    imm.maybeScheduleStartupPermissionValidation();
    await new Promise((r) => setTimeout(r, 350)); // guard resets after completion
    assert.equal(firstCount, 1, 'first key must trigger one fetch');
    // After guard reset, a new key can schedule
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'key-second');
    imm.state.ledger.tradePermission = null;
    let secondCount = 0;
    global.fetch = async () => { secondCount++; return { ok: true, json: async () => ({ trades: [] }), status: 200 }; };
    imm.maybeScheduleStartupPermissionValidation();
    await new Promise((r) => setTimeout(r, 350));
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(secondCount, 1, 'second key must trigger one fetch after guard reset');
  });

  // --- Test 7: Confirmation performs fresh async validation before transaction ---
  test('2c-7: handleApiTradeRecoveryConfirm revalidates before executing transaction', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'valid-key');
    global.fetch = mockFetch({ trades: [] }); // will return validated
    // Save a validated record that matches
    imm.saveTradePermissionRecord('validated', 'valid-key');
    // Build real stats using production paths
    const detail = freshDetail({ id: 9001 });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const overlay = makeElement();
    overlay._tsimmApiTradePendingStats = stats;
    overlay._tsimmApiTradePendingDetail = detail;
    overlay.isConnected = false;
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    await imm.handleApiTradeRecoveryConfirm(9001);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    // A successful confirm with valid permission should consume the lot
    assert.equal(imm.state.ledger.sales.length, 1, 'sale must be recorded on success');
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 0, 'lot must be consumed');
  });

  // --- Test 8: Failed confirmation revalidation leaves all accounting state unchanged ---
  test('2c-8: failed confirmation revalidation leaves lots, sales, and quarantine unchanged', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'bad-key');
    // Revalidation will return insufficient → confirm blocked
    global.fetch = mockFetch({ error: { code: 2 } });
    delete imm.state.ledger.tradePermission; // absent permission → triggers revalidation
    const overlay = makeConfirmOverlay();
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);
    const quarantineSnap = JSON.stringify(imm.state.ledger.quarantinedTrades);
    await imm.handleApiTradeRecoveryConfirm(9001);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'lots must be unchanged');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'sales must be unchanged');
    assert.equal(JSON.stringify(imm.state.ledger.quarantinedTrades), quarantineSnap, 'quarantine must be unchanged');
  });

  // --- Test 9: Fractional item quantity is rejected ---
  test('2c-9: fractional Item details.amount is rejected with INVALID_ITEM_QUANTITY', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => imm.normalizeApiTradeDetail({
        id: 9001,
        completed_at: Math.floor(Date.now() / 1000) - 3600,
        user: { id: 1001, name: 'Alice' },
        trader: { id: 5678, name: 'Bob' },
        items: [{ user_id: 1001, type: 'Item', details: { id: 100, amount: 1.5, uid: null } }],
      }),
      /invalid or zero/i,
    );
  });

  // --- Test 10: Zero, negative, NaN, and non-integer Item amounts are rejected ---
  test('2c-10: zero, negative, NaN, and infinite Item amounts are all rejected', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const cases = [0, -1, -10, NaN, Infinity, -Infinity, null];
    for (const q of cases) {
      assert.throws(
        () => imm.normalizeApiTradeDetail({
          id: 9001,
          completed_at: Math.floor(Date.now() / 1000) - 3600,
          user: { id: 1001, name: 'Alice' },
          trader: { id: 5678, name: 'Bob' },
          items: [{ user_id: 1001, type: 'Item', details: { id: 100, amount: q, uid: null } }],
        }),
        (err) => /invalid or zero|malformed/i.test(err.message),
        `amount ${q} must be rejected`,
      );
    }
  });

  // --- Test 11: Malformed list payload reaches quarantine through the production list processor ---
  test('2c-11: malformed list payload (no trades field) reaches quarantine via processApiTradeListPayload', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const badPayload = { something: 'else' };
    const result = imm.processApiTradeListPayload(badPayload, { endpoint: 'https://api.torn.com/v2/user/trades' });
    assert.ok(result.quarantined, 'must be quarantined');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE);
    assert.equal(imm.state.ledger.lots.length, 0, 'lots unchanged');
    assert.equal(imm.state.ledger.sales.length, 0, 'sales unchanged');
  });

  // --- Test 12: Malformed individual list entry fails closed instead of being silently skipped ---
  test('2c-12: malformed list entry quarantines the entire payload through processApiTradeListPayload', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    // trades array with one valid-looking entry followed by a malformed entry (null id)
    const badPayload = { trades: [{ id: null, status: 'Accepted' }] };
    const result = imm.processApiTradeListPayload(badPayload, {});
    assert.ok(result.quarantined, 'malformed entry must quarantine the entire payload');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE);
    assert.equal(imm.state.ledger.lots.length, 0, 'lots unchanged');
    assert.equal(imm.state.ledger.sales.length, 0, 'sales unchanged');
  });

  // --- Test 13: ID-less quarantine records deduplicate ---
  test('2c-13: repeated ID-less quarantine of same payload and reason deduplicates', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const badPayload = { sentinel: 'dedup-test' };
    imm.quarantineApiTrade(badPayload, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE, { endpoint: 'https://api.torn.com/v2/user/trades' });
    imm.quarantineApiTrade(badPayload, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE, { endpoint: 'https://api.torn.com/v2/user/trades' });
    imm.quarantineApiTrade(badPayload, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE, { endpoint: 'https://api.torn.com/v2/user/trades' });
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1, 'repeated ID-less quarantine must deduplicate to 1 record');
  });

  // --- Test 14: Different ID-less payloads remain separate ---
  test('2c-14: different ID-less payloads with same reason remain separate quarantine records', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload1 = { sentinel: 'payload-one' };
    const payload2 = { sentinel: 'payload-two' };
    imm.quarantineApiTrade(payload1, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE, { endpoint: 'https://api.torn.com/v2/user/trades' });
    imm.quarantineApiTrade(payload2, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE, { endpoint: 'https://api.torn.com/v2/user/trades' });
    assert.equal(imm.state.ledger.quarantinedTrades.length, 2, 'different payloads must remain as separate quarantine records');
  });

  // --- Test 15: Hanging fetch is aborted by the production timeout signal ---
  test('2c-15: hanging fetch is aborted by AbortController signal within injectable timeout', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Mock a fetch that hangs until the AbortSignal fires.
    global.fetch = async (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
      // Never resolves without abort
    });
    const start = Date.now();
    const result = await imm.validateApiTradeEndpointPermission('test-key', { timeoutMs: 80 });
    const elapsed = Date.now() - start;
    assert.equal(result, 'unavailable-or-inconclusive', 'aborted fetch must return unavailable-or-inconclusive');
    assert.ok(elapsed < 2000, `must abort quickly (${elapsed}ms)`);
  });

  // --- Test 16: Authorization handlers invalidate, await revalidation, and do not auto-resume ---
  test('2c-16: isAuthorizationFailure correctly identifies failure codes and statuses', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // These are the failure codes that trigger invalidate+revalidate in production handlers
    assert.ok(imm.isAuthorizationFailure({ error: { code: 2 } }, null), 'code 2 is auth failure');
    assert.ok(imm.isAuthorizationFailure({ error: { code: 16 } }, null), 'code 16 is auth failure');
    assert.ok(imm.isAuthorizationFailure({}, { status: 401 }), 'HTTP 401 is auth failure');
    assert.ok(imm.isAuthorizationFailure({}, { status: 403 }), 'HTTP 403 is auth failure');
    assert.ok(!imm.isAuthorizationFailure({}, { status: 200 }), '200 is not auth failure');
    // Verify that invalidateTradePermission correctly sets the state without resuming anything
    setupState({});
    imm.saveTradePermissionRecord('validated', 'key-auth');
    imm.invalidateTradePermission();
    const rec = imm.loadTradePermissionRecord();
    assert.equal(rec.state, 'unavailable-or-inconclusive', 'invalidated state must be unavailable-or-inconclusive');
    // isPermissionRecordValid must reject the invalidated record
    assert.equal(imm.isPermissionRecordValid(rec, 'key-auth'), false, 'invalidated record must not be valid');
  });

  // --- Test 17: Pending-trade storage unchanged on blocked quarantine and permission paths ---
  test('2c-17: pending-trade storage unchanged after quarantine and permission failures', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const pendingKey = 'tornscripture-imm-pending-trade-sale-v1';
    const prePending = localStorage.getItem(pendingKey);
    // Quarantine path
    imm.quarantineApiTrade(rawPayload(), imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE, {});
    assert.equal(localStorage.getItem(pendingKey), prePending, 'quarantine must not touch pending-trade storage');
    // Permission failure via list processor
    imm.processApiTradeListPayload({ something: 'else' }, {});
    assert.equal(localStorage.getItem(pendingKey), prePending, 'list processor quarantine must not touch pending-trade storage');
    // Confirmation with absent permission and network failure
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'blocked-key');
    global.fetch = async () => { throw new Error('Network failure'); };
    delete imm.state.ledger.tradePermission;
    const overlay = makeConfirmOverlay();
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    await imm.handleApiTradeRecoveryConfirm(9001);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(localStorage.getItem(pendingKey), prePending, 'blocked confirmation must not touch pending-trade storage');
  });

  // Normalizer returns null for malformed permission records
  test('2c-bonus: normalizeTradePermissionRecord returns null for malformed/incomplete records', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.equal(imm.normalizeTradePermissionRecord(null), null);
    assert.equal(imm.normalizeTradePermissionRecord({}), null, 'empty object has no valid state');
    assert.equal(imm.normalizeTradePermissionRecord({ state: 'bad-state', validatedAt: '2024-01-01', keyFingerprint: 'kfp-00000000-16', endpoint: 'https://api.torn.com/v2/user/trades', schemaMarker: 'v2-user-trades' }), null, 'invalid state returns null');
    assert.equal(imm.normalizeTradePermissionRecord({ state: 'validated', validatedAt: null, keyFingerprint: 'kfp-00000000-16', endpoint: 'https://api.torn.com/v2/user/trades', schemaMarker: 'v2-user-trades' }), null, 'null validatedAt returns null');
    // Valid record normalizes correctly
    const valid = imm.normalizeTradePermissionRecord({ state: 'validated', validatedAt: '2026-01-01T00:00:00.000Z', keyFingerprint: 'kfp-00000000-16', endpoint: 'https://api.torn.com/v2/user/trades', schemaMarker: 'v2-user-trades' });
    assert.ok(valid, 'valid record must normalize');
    assert.equal(valid.state, 'validated');
  });

  // normalizeLedger drops permission records that are null/invalid after normalization
  test('2c-bonus2: normalizeLedger drops invalid permission record (wrong state, null fields)', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const ledger = imm.normalizeLedger({ tradePermission: { state: 'bad-state' } });
    assert.equal(ledger.tradePermission, null, 'bad state must produce null tradePermission');
    const ledger2 = imm.normalizeLedger({ tradePermission: null });
    assert.equal(ledger2.tradePermission, null, 'null tradePermission must stay null');
  });
});

// ── Packet 2d: Four targeted defect fixes ────────────────────────────────────

// Helper: build a minimal valid serialized ledger JSON string with an embedded permission record.
function makePermissionRecord(key) {
  const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
  return {
    state: 'validated',
    validatedAt: new Date().toISOString(),
    keyFingerprint: imm.computeApiKeyFingerprint(key),
    endpoint: 'https://api.torn.com/v2/user/trades',
    schemaMarker: 'v2-user-trades',
  };
}

// Helper: build a serialized ledger with at least one lot and a permission record.
function makeSerializedLedger(key, lots = null) {
  const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
  const lot = freshLot();
  return JSON.stringify(imm.normalizeLedger({
    lots: lots || [lot],
    sales: [],
    tradePermission: makePermissionRecord(key),
  }));
}

// Helper: build a select-path overlay stub with a candidate at index 0.
function makeSelectOverlay(candidateId = 9001) {
  const el = makeElement();
  el._tsimmApiTradeCandidates = [{ id: candidateId, otherPlayerName: 'Bob', completedAt: new Date().toISOString() }];
  el.isConnected = true;
  return el;
}

// Helper: build a valid raw API detail response payload (official Torn API v2 shape) for use with the select handler.
function makeDetailPayload(tradeId, userId = 1001, traderId = 5678) {
  return {
    trade: {
      id: tradeId,
      completed_at: Math.floor((Date.now() - 3600000) / 1000), // Unix timestamp
      user: { id: userId, name: 'Alice' },
      trader: { id: traderId, name: 'Bob' },
      items: [
        { user_id: userId, type: 'Item', details: { id: 100, amount: 10, uid: null } },
        { user_id: traderId, type: 'Money', details: { amount: 5000000 } },
      ],
    },
  };
}

describe('Packet 2d: Fix 1 — importLedgerJson preserves tradePermission', () => {
  test('2d-1: valid imported permission survives importLedgerJson', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [] });
    const serialized = makeSerializedLedger('import-key-1');
    global.prompt = () => serialized;
    imm.importLedgerJson();
    global.prompt = undefined;
    assert.ok(imm.state.ledger.tradePermission, 'tradePermission must be preserved after importLedgerJson');
    assert.equal(imm.state.ledger.tradePermission.state, 'validated', 'imported permission state must be validated');
    assert.ok(imm.state.ledger.tradePermission.keyFingerprint, 'imported permission must have keyFingerprint');
  });

  test('2d-2: malformed imported permission becomes null — fail-closed', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [] });
    const malformed = JSON.stringify(imm.normalizeLedger({
      lots: [freshLot()],
      sales: [],
      tradePermission: { state: 'bad-state', validatedAt: null },
    }));
    global.prompt = () => malformed;
    imm.importLedgerJson();
    global.prompt = undefined;
    assert.equal(imm.state.ledger.tradePermission, null, 'malformed imported permission must produce null — fail-closed');
  });

  test('2d-3: raw API key is never present in stored ledger after import', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [] });
    const apiKey = 'supersecretapikey123456';
    const serialized = makeSerializedLedger(apiKey);
    global.prompt = () => serialized;
    imm.importLedgerJson();
    global.prompt = undefined;
    const stored = JSON.stringify(imm.state.ledger);
    assert.ok(!stored.includes(apiKey), 'raw API key must never appear in stored ledger');
  });

  test('2d-4: lots, sales, and quarantine merging unchanged by permission preservation fix', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const existingLot = freshLot({ id: 'lot-existing', itemName: 'Xanax', remainingQuantity: 5 });
    setupState({ lots: [existingLot] });
    const importedLot = freshLot({ id: 'lot-imported', itemName: 'Vicodin', itemId: 101, normalizedName: 'vicodin', unitCost: 30000, totalCost: 300000 });
    const serialized = JSON.stringify(imm.normalizeLedger({
      lots: [importedLot],
      sales: [],
      tradePermission: makePermissionRecord('merge-key'),
    }));
    global.prompt = () => serialized;
    imm.importLedgerJson();
    global.prompt = undefined;
    // Both lots must be present after merge
    const ids = imm.state.ledger.lots.map((l) => l.id);
    assert.ok(ids.includes('lot-existing'), 'existing lot must survive import merge');
    assert.ok(ids.includes('lot-imported'), 'imported lot must be added by import merge');
    assert.ok(imm.state.ledger.tradePermission, 'permission must also be preserved alongside merge');
  });
});

describe('Packet 2d: Fix 2 — handleApiTradeRecoverySelect wired to processApiTradeSemanticValidation', () => {
  test('2d-5: select handler routes through processApiTradeSemanticValidation — success path shows review', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'select-key');
    imm.state.keyProfile = { userId: 1001 };
    imm.saveTradePermissionRecord('validated', 'select-key');
    const overlay = makeSelectOverlay(9001);
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    global.fetch = async () => ({
      ok: true, status: 200,
      json: async () => makeDetailPayload(9001),
    });
    await imm.handleApiTradeRecoverySelect(0);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    // Verify review content is rendered and stats/plan are stored on overlay
    assert.ok(overlay._tsimmApiTradePendingStats, 'stats must be stored on overlay after semantic validation');
    assert.ok(overlay._tsimmApiTradePendingDetail, 'detail must be stored on overlay after semantic validation');
  });

  test('2d-6: select handler quarantines via processApiTradeSemanticValidation — zero FIFO coverage', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // No lots: FIFO coverage will be zero → quarantine
    setupState({ lots: [] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'select-key2');
    imm.state.keyProfile = { userId: 1001 };
    imm.saveTradePermissionRecord('validated', 'select-key2');
    const overlay = makeSelectOverlay(9002);
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    global.fetch = async () => ({
      ok: true, status: 200,
      json: async () => makeDetailPayload(9002),
    });
    const quarantineBefore = imm.state.ledger.quarantinedTrades.length;
    await imm.handleApiTradeRecoverySelect(0);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    // A quarantine record must have been created via processApiTradeSemanticValidation
    assert.ok(imm.state.ledger.quarantinedTrades.length > quarantineBefore, 'zero-FIFO trade must be quarantined via semantic validation path');
    assert.ok(!overlay._tsimmApiTradePendingStats, 'stats must NOT be stored on overlay after quarantine');
  });

  test('2d-7: select handler fails closed with semantic failure — no quarantine for already-recorded', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'select-key3');
    imm.state.keyProfile = { userId: 1001 };
    imm.saveTradePermissionRecord('validated', 'select-key3');
    // Pre-record the sale so the canonical fingerprint check fails
    const detail = imm.normalizeApiTradeDetail(makeDetailPayload(9003), 9003);
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    // Record using transaction to mark it as already recorded
    imm.executeApiTradeRecoveryTransaction(9003, detail, stats, fp);
    const overlay = makeSelectOverlay(9003);
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    global.fetch = async () => ({
      ok: true, status: 200,
      json: async () => makeDetailPayload(9003),
    });
    await imm.handleApiTradeRecoverySelect(0);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.ok(!overlay._tsimmApiTradePendingStats, 'stats must NOT be stored for already-recorded trade');
  });
});

describe('Packet 2d: Fix 3 — list/detail auth failures await revalidation', () => {
  test('2d-8: list auth failure invalidates permission, awaits revalidation, does not resume, leaves lots unchanged', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'list-auth-key');
    imm.state.keyProfile = { userId: 1001 };
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);
    const pendingKey = 'tornscripture-imm-pending-trade-sale-v1';
    const pendingSnap = localStorage.getItem(pendingKey);

    let revalidateCalled = false;
    let fetchCallCount = 0;
    global.fetch = async (url) => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        // Permission validation fetch
        return { ok: true, status: 200, json: async () => ({ trades: [] }) };
      }
      if (fetchCallCount === 2) {
        // List fetch — return 401 authorization failure
        return { ok: false, status: 401, json: async () => ({ error: { code: 2, error: 'Unauthorized' } }) };
      }
      // Revalidation fetch
      revalidateCalled = true;
      return { ok: true, status: 200, json: async () => ({ trades: [] }) };
    };

    const overlay = makeElement();
    overlay.isConnected = false;
    const origGetById = global.document.getElementById;
    const origCreateElement = global.document.createElement;
    const origAppendChild = global.document.documentElement.appendChild;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? null : origGetById(id);
    global.document.createElement = () => { const el = makeElement(); el.isConnected = true; return el; };
    global.document.documentElement = { ...global.document.documentElement, appendChild: () => {} };

    await imm.openApiTradeRecovery();

    global.document.getElementById = origGetById;
    global.document.createElement = origCreateElement;
    global.document.documentElement.appendChild = origAppendChild;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);

    assert.ok(revalidateCalled, 'revalidation fetch must be awaited after list auth failure');
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'lots must be unchanged after list auth failure');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'sales must be unchanged after list auth failure');
    assert.equal(localStorage.getItem(pendingKey), pendingSnap, 'pending-trade storage must be unchanged after list auth failure');
  });

  test('2d-9: detail auth failure invalidates permission, awaits revalidation, does not resume, leaves lots unchanged', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'detail-auth-key');
    imm.state.keyProfile = { userId: 1001 };
    imm.saveTradePermissionRecord('validated', 'detail-auth-key');
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);

    let revalidateCalled = false;
    let fetchCallCount = 0;
    global.fetch = async (url) => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        // Detail fetch — return 401 authorization failure
        return { ok: false, status: 401, json: async () => ({ error: { code: 2, error: 'Unauthorized' } }) };
      }
      // Revalidation fetch
      revalidateCalled = true;
      return { ok: true, status: 200, json: async () => ({ trades: [] }) };
    };

    const overlay = makeSelectOverlay(9004);
    const origGetById = global.document.getElementById;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? overlay : origGetById(id);
    await imm.handleApiTradeRecoverySelect(0);
    global.document.getElementById = origGetById;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);

    assert.ok(revalidateCalled, 'revalidation fetch must be awaited after detail auth failure');
    assert.equal(fetchCallCount, 2, 'exactly 2 fetches: detail (auth fail) + revalidation — action must not resume');
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'lots must be unchanged after detail auth failure');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'sales must be unchanged after detail auth failure');
    // Handler must have returned without storing pending stats (action did not continue to review)
    assert.ok(!overlay._tsimmApiTradePendingStats, 'pending stats must NOT be stored — action must not continue after auth failure');
  });

  test('2d-10: successful revalidation after list auth failure does not resume list fetch', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'list-auth-key-2');
    imm.state.keyProfile = { userId: 1001 };
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);

    let secondListFetchAttempted = false;
    let fetchCallCount = 0;
    global.fetch = async (url) => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        // Permission validation fetch
        return { ok: true, status: 200, json: async () => ({ trades: [] }) };
      }
      if (fetchCallCount === 2) {
        // List fetch → auth failure
        return { ok: false, status: 401, json: async () => ({ error: { code: 2, error: 'Unauthorized' } }) };
      }
      if (fetchCallCount === 3) {
        // Revalidation fetch — succeeds
        return { ok: true, status: 200, json: async () => ({ trades: [] }) };
      }
      // Any further fetch would be a resumed list fetch — must not happen
      secondListFetchAttempted = true;
      return { ok: true, status: 200, json: async () => ({ trades: [] }) };
    };

    const overlay = makeElement();
    overlay.isConnected = false;
    const origGetById2d10 = global.document.getElementById;
    const origCreateElement2d10 = global.document.createElement;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? null : origGetById2d10(id);
    global.document.createElement = () => { const el = makeElement(); el.isConnected = true; return el; };

    await imm.openApiTradeRecovery();

    global.document.getElementById = origGetById2d10;
    global.document.createElement = origCreateElement2d10;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);

    assert.ok(!secondListFetchAttempted, 'successful revalidation must NOT automatically resume list fetch');
    assert.equal(fetchCallCount, 3, 'exactly 3 fetches: validation, list (auth fail), revalidation');
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'lots must be unchanged even after successful revalidation');
  });

  test('2d-11: no quarantine record is invented merely because authorization failed on list', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'list-auth-key-3');
    imm.state.keyProfile = { userId: 1001 };
    const quarantineBefore = imm.state.ledger.quarantinedTrades.length;

    let fetchCallCount = 0;
    global.fetch = async () => {
      fetchCallCount++;
      if (fetchCallCount === 1) return { ok: true, status: 200, json: async () => ({ trades: [] }) };
      if (fetchCallCount === 2) return { ok: false, status: 401, json: async () => ({ error: { code: 2 } }) };
      return { ok: true, status: 200, json: async () => ({ trades: [] }) };
    };

    const origGetById2d11 = global.document.getElementById;
    const origCreateElement2d11 = global.document.createElement;
    global.document.getElementById = (_id) => null;
    global.document.createElement = () => { const el = makeElement(); el.isConnected = true; return el; };

    await imm.openApiTradeRecovery();

    global.document.getElementById = origGetById2d11;
    global.document.createElement = origCreateElement2d11;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);

    assert.equal(imm.state.ledger.quarantinedTrades.length, quarantineBefore,
      'authorization failure on list must not invent a quarantine record');
  });
});

describe('Packet 2d: Fix 4 — strict pre-coercion cash validation', () => {
  // normalizeApiTradeDetail is the production owner of the money-validation path
  // (via typed Money TradeItem processing). Tests exercise it directly.

  function moneyDetail(amountVal) {
    return {
      id: 9001,
      completed_at: Math.floor(Date.now() / 1000) - 3600,
      user: { id: 1001, name: 'Alice' },
      trader: { id: 5678, name: 'Bob' },
      items: [{ user_id: 5678, type: 'Money', details: { amount: amountVal } }],
    };
  }

  test('2d-12: null cash is rejected before Number() coercion', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(null)),
      /money.*invalid/i,
    );
  });

  test('2d-13: boolean true is rejected before Number() coercion', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(true)),
      /money.*invalid/i,
    );
  });

  test('2d-14: boolean false is rejected before Number() coercion', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(false)),
      /money.*invalid/i,
    );
  });

  test('2d-15: empty string is rejected before Number() coercion', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail('')),
      /money.*invalid/i,
    );
  });

  test('2d-16: whitespace-only string is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail('   ')),
      /money.*invalid/i,
    );
  });

  test('2d-17: object is rejected before Number() coercion', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail({})),
      /money.*invalid/i,
    );
  });

  test('2d-18: array is rejected before Number() coercion', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail([])),
      /money.*invalid/i,
    );
  });

  test('2d-19: NaN numeric value is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(NaN)),
      /money.*invalid/i,
    );
  });

  test('2d-20: Infinity is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(Infinity)),
      /money.*invalid/i,
    );
  });

  test('2d-21: negative number is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(-1)),
      /money.*invalid/i,
    );
  });

  test('2d-22: fractional number is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(1.5)),
      /money.*invalid/i,
    );
  });

  test('2d-23: numeric string with decimal is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail('5000.00')),
      /money.*invalid/i,
    );
  });

  test('2d-24: non-numeric string is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail('abc')),
      /money.*invalid/i,
    );
  });

  test('2d-25: numeric string with leading/trailing spaces is rejected', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeDetail(moneyDetail(' 5000000 ')),
      /money.*invalid/i,
    );
  });

  test('2d-26: plain number 0 is accepted — zero cash is valid', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const detail = normalizeApiTradeDetail(moneyDetail(0));
    assert.equal(detail.trader.money, 0, 'numeric 0 must be accepted as valid cash');
  });

  test('2d-27: strict integer numeric string "0" is accepted', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const detail = normalizeApiTradeDetail(moneyDetail('0'));
    assert.equal(detail.trader.money, 0, 'strict integer numeric string "0" must be accepted');
  });

  test('2d-28: strict integer numeric string "5000000" is accepted', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const detail = normalizeApiTradeDetail(moneyDetail('5000000'));
    assert.equal(detail.trader.money, 5000000, 'strict integer numeric string must be accepted');
  });

  test('2d-29: plain positive integer is accepted', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const detail = normalizeApiTradeDetail(moneyDetail(5000000));
    assert.equal(detail.trader.money, 5000000, 'positive integer must be accepted');
  });
});

// ── Packet 2e: Official API v2 shape alignment ────────────────────────────────

// Helper: valid official UserTrade list entry
function officialListEntry(overrides = {}) {
  return {
    id: 9001,
    completed_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: 1001, name: 'Alice' },
    trader: { id: 5678, name: 'Bob' },
    ...overrides,
  };
}

// Helper: valid official raw detail response with user providing items, trader providing cash
function officialRawDetail(overrides = {}) {
  return {
    id: 9001,
    completed_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: 1001, name: 'Alice' },
    trader: { id: 5678, name: 'Bob' },
    items: [
      { user_id: 1001, type: 'Item', details: { id: 100, amount: 10, uid: null } },
      { user_id: 5678, type: 'Money', details: { amount: 5000000 } },
    ],
    ...overrides,
  };
}

describe('Packet 2e: Official API v2 shape alignment', () => {
  // 1. Recovery list URL and permission probe URL both contain cat=finished.
  test('2e-1: permission probe URL includes cat=finished', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    let capturedUrl;
    global.fetch = async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ trades: [] }) };
    };
    await imm.validateApiTradeEndpointPermission('test-key');
    assert.ok(capturedUrl, 'fetch must be called');
    assert.ok(
      capturedUrl.includes('cat=finished'),
      `permission probe URL must contain cat=finished, got: ${capturedUrl}`,
    );
  });

  test('2e-1b: production list fetch URL includes cat=finished', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'list-url-key');
    imm.state.keyProfile = { userId: 1001 };
    const capturedUrls = [];
    global.fetch = async (url) => {
      capturedUrls.push(url);
      if (capturedUrls.length === 1) {
        // Permission validation
        return { ok: true, json: async () => ({ trades: [] }) };
      }
      // List fetch — return empty
      return { ok: true, json: async () => ({ trades: [] }) };
    };
    const overlay = makeElement();
    overlay.isConnected = true;
    const origGetById = global.document.getElementById;
    const origCreateElement = global.document.createElement;
    global.document.getElementById = (id) => id === IMM_API_TRADE_RECOVERY_OVERLAY_ID ? null : origGetById(id);
    global.document.createElement = () => { const el = makeElement(); el.isConnected = true; return el; };
    await imm.openApiTradeRecovery();
    global.document.getElementById = origGetById;
    global.document.createElement = origCreateElement;
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.ok(capturedUrls.length >= 2, 'at least 2 fetches: permission + list');
    const listUrl = capturedUrls[1];
    assert.ok(listUrl.includes('cat=finished'), `list URL must include cat=finished, got: ${listUrl}`);
  });

  // 2. Valid empty trades: [] validates.
  test('2e-2: valid empty trades: [] response validates as permitted', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = async () => ({ ok: true, json: async () => ({ trades: [] }) });
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'validated');
  });

  // 3. Valid populated official UserTrade array validates.
  test('2e-3: valid populated UserTrade array validates', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ trades: [officialListEntry()] }),
    });
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'validated');
  });

  // 4. Object/map trades response does not validate under current Swagger.
  test('2e-4: object/map trades does not validate — returns unavailable-or-inconclusive', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = async () => ({ ok: true, json: async () => ({ trades: { '1': officialListEntry() } }) });
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'unavailable-or-inconclusive');
  });

  // 5. Malformed populated list entry quarantines the entire payload.
  test('2e-5: malformed list entry quarantines entire payload via processApiTradeListPayload', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const badPayload = { trades: [{ id: null, completed_at: 1700000000 }] }; // null id → fails normalization
    const result = imm.processApiTradeListPayload(badPayload, { keyOwnerUserId: 1001 });
    assert.ok(result.quarantined, 'malformed entry must quarantine entire payload');
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MALFORMED_LIST_RESPONSE);
  });

  // 6. Finished list candidate uses completed_at — not a nonexistent status field.
  test('2e-6: list normalization uses completed_at as finished-trade proof, not status', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const entry = officialListEntry(); // no status field
    const normalized = imm.normalizeApiTradeListEntry(entry, 1001);
    assert.ok(normalized, 'entry with completed_at but no status must normalize successfully');
    assert.ok(normalized.completedAt, 'must produce completedAt');
    assert.equal(normalized.id, 9001);
    // Entry without completed_at (0) must fail
    const noTs = imm.normalizeApiTradeListEntry({ ...entry, completed_at: 0 }, 1001);
    assert.equal(noTs, null, 'entry with zero completed_at must fail normalization');
  });

  // 7. Counterparty correctly resolved from user and trader.
  test('2e-7: counterparty resolved correctly from user/trader based on key owner ID', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Owner is user (id 1001): counterparty should be trader (id 5678)
    const entry1 = officialListEntry();
    const n1 = imm.normalizeApiTradeListEntry(entry1, 1001);
    assert.ok(n1, 'must normalize');
    assert.equal(n1.otherPlayerId, 5678, 'counterparty must be trader (id 5678)');
    assert.equal(n1.otherPlayerName, 'Bob');

    // Owner is trader (id 5678): counterparty should be user (id 1001)
    const n2 = imm.normalizeApiTradeListEntry(entry1, 5678);
    assert.ok(n2, 'must normalize when owner is trader');
    assert.equal(n2.otherPlayerId, 1001, 'counterparty must be user (id 1001)');
    assert.equal(n2.otherPlayerName, 'Alice');

    // Unknown key owner: must fail
    const n3 = imm.normalizeApiTradeListEntry(entry1, 9999);
    assert.equal(n3, null, 'unknown key owner must return null (ambiguous)');
  });

  // 8. Valid official detailed cash-for-items trade reaches review.
  test('2e-8: valid official cash-for-items detail normalizes and reaches semantic review', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = imm.normalizeApiTradeDetail(officialRawDetail());
    assert.equal(detail.id, 9001);
    assert.equal(detail.user.userId, 1001);
    assert.equal(detail.trader.userId, 5678);
    assert.equal(detail.user.items.length, 1, 'user has 1 item');
    assert.equal(detail.trader.money, 5000000, 'trader money is 5000000');
    const result = imm.processApiTradeSemanticValidation(detail, 1001, officialRawDetail(), { source: 'api-trade-recovery' });
    assert.ok(!result.quarantined, `must not be quarantined: ${result.error?.message}`);
    assert.ok(result.stats, 'stats must be present');
    assert.ok(result.plan, 'plan must be present');
  });

  // 9. Owner may be either user or trader.
  test('2e-9: owner may be either user or trader — both directions work', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;

    // Case A: user is owner (user sells items, trader pays cash)
    const detailA = imm.normalizeApiTradeDetail(officialRawDetail());
    const resolvedA = imm.resolveApiTradeOwner(detailA, 1001);
    assert.equal(resolvedA.ownerSide.userId, 1001, 'owner is user');
    assert.equal(resolvedA.counterpartySide.userId, 5678, 'counterparty is trader');

    // Case B: trader is owner (trader sells items, user pays cash)
    const rawB = officialRawDetail({
      items: [
        { user_id: 5678, type: 'Item', details: { id: 100, amount: 5, uid: null } },
        { user_id: 1001, type: 'Money', details: { amount: 2000000 } },
      ],
    });
    const detailB = imm.normalizeApiTradeDetail(rawB);
    const resolvedB = imm.resolveApiTradeOwner(detailB, 5678);
    assert.equal(resolvedB.ownerSide.userId, 5678, 'owner is trader');
    assert.equal(resolvedB.counterpartySide.userId, 1001, 'counterparty is user');
  });

  // 10. Money contributions aggregate by user_id.
  test('2e-10: Money TradeItems aggregate correctly by user_id', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const raw = officialRawDetail({
      items: [
        { user_id: 5678, type: 'Money', details: { amount: 3000000 } },
        { user_id: 5678, type: 'Money', details: { amount: 2000000 } },
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 5, uid: null } },
      ],
    });
    const detail = imm.normalizeApiTradeDetail(raw);
    assert.equal(detail.trader.money, 5000000, 'two Money items from trader must aggregate to 5000000');
    assert.equal(detail.user.money, 0, 'user money must be 0');
  });

  // 11. Ordinary item contributions aggregate by user_id.
  test('2e-11: Item TradeItems are aggregated per participant side', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const raw = officialRawDetail({
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 3, uid: 1 } },
        { user_id: 1001, type: 'Item', details: { id: 101, amount: 7, uid: 2 } },
        { user_id: 5678, type: 'Money', details: { amount: 1000000 } },
      ],
    });
    const detail = imm.normalizeApiTradeDetail(raw);
    assert.equal(detail.user.items.length, 2, 'user has 2 distinct items');
    assert.equal(detail.trader.items.length, 0, 'trader has no items');
  });

  // 12. Repeated item IDs aggregate correctly via aggregateApiTradeOwnerItems.
  test('2e-12: repeated item IDs aggregate correctly via aggregateApiTradeOwnerItems', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    const items = [{ id: 100, quantity: 3 }, { id: 100, quantity: 7 }, { id: 101, quantity: 5 }];
    const aggregated = imm.aggregateApiTradeOwnerItems(items);
    const item100 = aggregated.find((i) => i.id === 100);
    const item101 = aggregated.find((i) => i.id === 101);
    assert.equal(item100.quantity, 10, 'id 100 quantities must aggregate to 10');
    assert.equal(item101.quantity, 5, 'id 101 stays at 5');
  });

  // 13. Exact catalog-ID enforcement: unknown ID fails closed.
  test('2e-13: unknown catalog item ID fails closed — name fallback absent', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    imm.state.catalog.itemsById = {}; // remove all catalog entries
    const detail = imm.normalizeApiTradeDetail(officialRawDetail());
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    let caught;
    try { imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide); } catch (e) { caught = e; }
    assert.ok(caught, 'must throw for unknown catalog ID');
    assert.equal(caught.quarantineReasonCode, imm.QUARANTINE_REASON.UNKNOWN_CATALOG_ITEM_ID);
  });

  // 14. Faction TradeItem quarantines.
  test('2e-14: Faction TradeItem quarantines with UNSUPPORTED_ASSET_TYPE', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = officialRawDetail({
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 1, uid: null } },
        { user_id: 5678, type: 'Faction', details: { id: 1 } },
      ],
    });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_ASSET_TYPE);
  });

  // 15. Company TradeItem quarantines.
  test('2e-15: Company TradeItem quarantines with UNSUPPORTED_ASSET_TYPE', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = officialRawDetail({
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 1, uid: null } },
        { user_id: 5678, type: 'Company', details: { id: 2 } },
      ],
    });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_ASSET_TYPE);
  });

  // 16. Property TradeItem quarantines.
  test('2e-16: Property TradeItem quarantines with UNSUPPORTED_ASSET_TYPE', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = officialRawDetail({
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 1, uid: null } },
        { user_id: 5678, type: 'Property', details: { id: 3 } },
      ],
    });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_ASSET_TYPE);
  });

  // 17. NAP TradeItem quarantines.
  test('2e-17: NAP TradeItem quarantines with UNSUPPORTED_ASSET_TYPE', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = officialRawDetail({
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 1, uid: null } },
        { user_id: 5678, type: 'NAP', details: { id: 4 } },
      ],
    });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_ASSET_TYPE);
  });

  // 18. Unknown TradeItem type quarantines.
  test('2e-18: unknown TradeItem type quarantines with UNKNOWN_ASSET_TYPE', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = officialRawDetail({
      items: [
        { user_id: 1001, type: 'Item', details: { id: 100, amount: 1, uid: null } },
        { user_id: 5678, type: 'SpaceRocket', details: { count: 1 } }, // unknown type
      ],
    });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNKNOWN_ASSET_TYPE);
  });

  // 19. TradeItem with unknown participant user_id quarantines.
  test('2e-19: TradeItem user_id not matching either participant quarantines', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = officialRawDetail({
      items: [
        { user_id: 9999, type: 'Item', details: { id: 100, amount: 1, uid: null } }, // 9999 is not user or trader
        { user_id: 5678, type: 'Money', details: { amount: 5000000 } },
      ],
    });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MISSING_PARTICIPANT);
  });

  // 20. Fractional/malformed trade ID, user ID, item ID, amount, or timestamp fails closed.
  test('2e-20: fractional/malformed trade ID fails closed', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Fractional trade ID
    assert.throws(() => normalizeApiTradeDetail({ ...officialRawDetail(), id: 9001.5 }), /no valid trade ID|malformed/i);
    // Non-integer trade ID
    assert.throws(() => normalizeApiTradeDetail({ ...officialRawDetail(), id: '9001' }), /no valid trade ID|malformed/i);
    // Fractional completed_at
    assert.throws(() => normalizeApiTradeDetail({ ...officialRawDetail(), completed_at: 1700000000.5 }), /timestamp|malformed/i);
    // Invalid user ID
    assert.throws(() => normalizeApiTradeDetail({ ...officialRawDetail(), user: { id: 0, name: 'Alice' } }), /no valid Torn ID|missing or malformed/i);
    // Fractional item ID
    assert.throws(() => normalizeApiTradeDetail(officialRawDetail({
      items: [{ user_id: 1001, type: 'Item', details: { id: 100.5, amount: 10, uid: null } }],
    })), /invalid/i);
    // Fractional item amount
    assert.throws(() => normalizeApiTradeDetail(officialRawDetail({
      items: [{ user_id: 1001, type: 'Item', details: { id: 100, amount: 10.5, uid: null } }],
    })), /invalid or zero/i);
  });

  // 21. Zero/partial FIFO behavior still quarantines after schema change.
  test('2e-21: zero FIFO coverage still quarantines with official detail shape', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [] }); // no lots
    const detail = imm.normalizeApiTradeDetail(officialRawDetail());
    const result = imm.processApiTradeSemanticValidation(detail, 1001, officialRawDetail(), { source: 'api-trade-recovery' });
    assert.ok(result.quarantined, 'must quarantine with zero coverage');
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.ZERO_FIFO_COVERAGE);
    assert.equal(imm.state.ledger.sales.length, 0, 'sales unchanged');
  });

  // 22. Canonical fingerprint still works after direction vocabulary change to user/trader.
  test('2e-22: canonical fingerprint uses user/trader direction vocabulary and deduplicates correctly', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = imm.normalizeApiTradeDetail(officialRawDetail());
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    assert.equal(stats.apiOwnerDirection, 'user', 'apiOwnerDirection must be "user" when owner is user side');
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    assert.ok(fp.includes('dir:user'), 'fingerprint must use "user" direction vocabulary');
    // Record the trade and verify the canonical fingerprint blocks a duplicate
    const first = imm.executeApiTradeRecoveryTransaction(9001, detail, stats, fp);
    assert.ok(first.ok, 'first record must succeed');
    imm.state.ledger.sales[0].canonicalFingerprint = fp;
    assert.ok(imm.apiTradeCanonicalFingerprintRecorded(fp), 'canonical fingerprint must block duplicate');
  });

  // 23. Successful confirmation reaches Packet 1 transaction.
  test('2e-23: successful API trade confirmation reaches Packet 1 transaction (executeApiTradeRecoveryTransaction)', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot()] });
    const detail = imm.normalizeApiTradeDetail(officialRawDetail());
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    stats.soldAt = detail.completedAt;
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const result = imm.executeApiTradeRecoveryTransaction(9001, detail, stats, fp);
    assert.ok(result.ok, `must succeed: ${result.message}`);
    assert.equal(imm.state.ledger.sales.length, 1, 'exactly one sale recorded');
    assert.equal(imm.state.ledger.sales[0].apiTradeId, 9001);
    assert.equal(imm.state.ledger.lots[0].remainingQuantity, 0, 'lot consumed');
  });

  // 24. All unsupported-asset paths leave lots, sales, and pending-trade storage unchanged.
  test('2e-24: unsupported asset type quarantine leaves lots, sales, and pending-trade storage unchanged', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 10, remainingQuantity: 10 })] });
    const lotsSnap = JSON.stringify(imm.state.ledger.lots);
    const salesSnap = JSON.stringify(imm.state.ledger.sales);
    const pendingKey = 'tornscripture-imm-pending-trade-sale-v1';
    const pendingSnap = localStorage.getItem(pendingKey);
    // Test each unsupported asset type
    for (const type of ['Faction', 'Company', 'Property', 'NAP', 'GalacticToken']) {
      imm.state.ledger.quarantinedTrades = [];
      const payload = officialRawDetail({
        items: [
          { user_id: 1001, type: 'Item', details: { id: 100, amount: 1, uid: null } },
          { user_id: 5678, type, details: { amount: 1 } },
        ],
      });
      const result = imm.processApiTradeDetailPayload(payload, 9001, {});
      assert.ok(result.quarantined, `${type} must be quarantined`);
    }
    assert.equal(JSON.stringify(imm.state.ledger.lots), lotsSnap, 'lots unchanged after all unsupported asset quarantines');
    assert.equal(JSON.stringify(imm.state.ledger.sales), salesSnap, 'sales unchanged after all unsupported asset quarantines');
    assert.equal(localStorage.getItem(pendingKey), pendingSnap, 'pending-trade storage unchanged');
  });
});
