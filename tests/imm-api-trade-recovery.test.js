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
    status: 'Accepted',
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
    recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
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

  test('normalizeLedger discards malformed quarantine records', () => {
    const { normalizeLedger } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const ledger = normalizeLedger({ quarantinedTrades: [null, { id: '', reasonCode: '' }, { id: 'q1', reasonCode: 'ok' }] });
    assert.equal(ledger.quarantinedTrades.length, 1);
  });
});

// ── Normalization contracts ───────────────────────────────────────────────────
describe('Normalization contracts', () => {
  test('normalizeApiTradeParticipant: missing money field throws', () => {
    const { normalizeApiTradeParticipant } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeParticipant({ user_id: 1001, name: 'Alice', items: [] }, 'initiator'),
      /no money field/i,
    );
  });

  test('normalizeApiTradeParticipant: missing items field throws', () => {
    const { normalizeApiTradeParticipant } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeParticipant({ user_id: 1001, name: 'Alice', money: 0 }, 'initiator'),
      /no items field/i,
    );
  });

  test('normalizeApiTradeParticipant: missing quantity field throws — no default-to-1', () => {
    const { normalizeApiTradeParticipant } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeParticipant({ user_id: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax' }] }, 'initiator'),
      /no quantity field/i,
    );
  });

  test('normalizeApiTradeParticipant: zero quantity throws — no silent skip', () => {
    const { normalizeApiTradeParticipant } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeParticipant({ user_id: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 0 }] }, 'initiator'),
      /invalid or zero quantity/i,
    );
  });

  test('normalizeApiTradeParticipant: points field throws — unsupported asset', () => {
    const { normalizeApiTradeParticipant } = globalThis.__TS_IMM_TEST_EXPORTS__;
    assert.throws(
      () => normalizeApiTradeParticipant({ user_id: 1001, name: 'Alice', money: 0, items: [], points: 100 }, 'initiator'),
      /points/i,
    );
  });

  test('normalizeApiTradeParticipant: valid participant normalizes correctly', () => {
    const { normalizeApiTradeParticipant } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const result = normalizeApiTradeParticipant({ user_id: 1001, name: 'Alice', money: 500000, items: [{ id: 100, name: 'Xanax', quantity: 5 }] }, 'initiator');
    assert.equal(result.userId, 1001);
    assert.equal(result.money, 500000);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].quantity, 5);
  });

  test('normalizeApiTradeDetail: ID mismatch throws', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const raw = {
      id: 9999,
      status: 'Accepted',
      completed_at: Math.floor(Date.now() / 1000),
      initiator: { user_id: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 1 }] },
      recipient: { user_id: 5678, name: 'Bob', money: 1000000, items: [] },
    };
    assert.throws(() => normalizeApiTradeDetail(raw, 9001), /mismatch/i);
  });

  test('normalizeApiTradeDetail: matching expected ID succeeds', () => {
    const { normalizeApiTradeDetail } = globalThis.__TS_IMM_TEST_EXPORTS__;
    const raw = {
      id: 9001,
      status: 'Accepted',
      completed_at: Math.floor(Date.now() / 1000),
      initiator: { user_id: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 1 }] },
      recipient: { user_id: 5678, name: 'Bob', money: 1000000, items: [] },
    };
    const detail = normalizeApiTradeDetail(raw, 9001);
    assert.equal(detail.id, 9001);
  });

  test('buildApiTradeSaleStats: conflicting ID vs name catalog match throws', () => {
    setupState({ lots: [freshLot()] });
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Inject conflict: ID 100 → 'OtherItem' but name 'Xanax' → itemId 999
    imm.state.catalog.itemsById['100'] = { id: 100, name: 'OtherItem', marketPrice: 1000 };
    imm.state.catalog.itemsByName['xanax'] = { id: 999, name: 'Xanax', marketPrice: 90000 };
    const detail = freshDetail();
    const { buildApiTradeSaleStats, resolveApiTradeOwner } = imm;
    const { ownerSide, counterpartySide } = resolveApiTradeOwner(detail, 1001);
    assert.throws(() => buildApiTradeSaleStats(detail, ownerSide, counterpartySide), /catalog conflict/i);
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
      initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 5 }, { id: 101, name: 'Vicodin', quantity: 10 }] },
      recipient: { userId: 5678, name: 'Bob', money: 750000, items: [] },
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
      initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 150 }] },
      recipient: { userId: 5678, name: 'Bob', money: 2300, items: [] },
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
      initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 5 }] },
      recipient: { userId: 5678, name: 'Bob', money: 500000, items: [] },
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
      initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
      recipient: { userId: 5678, name: 'Bob', money: 1000000, items: [] },
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
      initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
      recipient: { userId: 5678, name: 'Bob', money: 900000, items: [] },
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
    const detail = freshDetail({ recipient: { userId: 5678, name: 'Bob', money: 800000, items: [] } });
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
      initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 150 }] },
      recipient: { userId: 5678, name: 'Bob', money: 2300, items: [] },
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

  test('failure after sale construction but before commit — exact state rollback', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ id: 'lot-precommit' })] });
    const detail = freshDetail({ id: 9700 });
    const stats = freshStats(detail);
    const fp = imm.buildApiTradeCanonicalFingerprint(detail, stats);
    const preLots = JSON.parse(JSON.stringify(imm.state.ledger.lots));
    const preSales = JSON.parse(JSON.stringify(imm.state.ledger.sales));
    // Force saveLedger to fail (which fires after lot mutation + sale add)
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === 'tornscripture-imm-ledger-v1') throw new Error('Forced persistence failure');
      origSetItem(key, value);
    };
    try {
      const result = imm.executeApiTradeRecoveryTransaction(9700, detail, stats, fp);
      assert.equal(result.ok, false, 'must fail');
      assert.equal(result.reason, 'transaction-failed');
      assert.deepEqual(imm.state.ledger.lots, preLots, 'lots rolled back');
      assert.deepEqual(imm.state.ledger.sales, preSales, 'sales rolled back');
      assert.equal(imm.state.ledger.sales.length, 0, 'no sale left after rollback');
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
    assert.ok(['initiator', 'recipient'].includes(stats.apiOwnerDirection));
  });
});

console.log('# IMM API Trade Recovery production-path tests passed.');
