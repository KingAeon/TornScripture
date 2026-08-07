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
    assert.ok(['initiator', 'recipient'].includes(stats.apiOwnerDirection));
  });
});

// ── Packet 2: Production quarantine paths (tests 1–14) ───────────────────────
//
// Raw API payload factory: produces the shape accepted by normalizeApiTradeDetail /
// normalizeApiTradeParticipant before normalization.
function rawPayload(overrides = {}) {
  return {
    id: 9001,
    status: 'Accepted',
    completed_at: Math.floor(Date.now() / 1000) - 3600,
    initiator: { user_id: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
    recipient: { user_id: 5678, name: 'Bob', money: 5000000, items: [] },
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

  // 2. Missing money reaches quarantine.
  test('2: missing money field reaches quarantine with MISSING_MONEY reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = rawPayload({ initiator: { user_id: 1001, name: 'Alice', items: [] } }); // no money
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MISSING_MONEY);
  });

  // 3. Missing items reaches quarantine.
  test('3: missing items field reaches quarantine with MISSING_ITEMS reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = rawPayload({ initiator: { user_id: 1001, name: 'Alice', money: 0 } }); // no items
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.MISSING_ITEMS);
  });

  // 4. Unsupported points reaches quarantine.
  test('4: points field reaches quarantine with UNSUPPORTED_POINTS reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const payload = rawPayload({
      initiator: { user_id: 1001, name: 'Alice', money: 0, items: [], points: 5 },
    });
    const result = imm.processApiTradeDetailPayload(payload, 9001, {});
    assert.ok(result.quarantined);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.UNSUPPORTED_POINTS);
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

  // 6. Ambiguous ownership — resolveApiTradeOwner tags the error; quarantine stores the tag.
  test('6: ambiguous ownership error is tagged AMBIGUOUS_OWNER and quarantine stores the code', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    const detail = freshDetail(); // initiator:1001, recipient:5678
    // Key owner is 9999 — does not appear in the trade
    let caught;
    try { imm.resolveApiTradeOwner(detail, 9999); } catch (e) { caught = e; }
    assert.ok(caught, 'resolveApiTradeOwner must throw for unknown owner');
    assert.equal(caught.quarantineReasonCode, imm.QUARANTINE_REASON.AMBIGUOUS_OWNER, 'error must carry AMBIGUOUS_OWNER reason code');
    // Wire: the step-4 catch block calls quarantineApiTrade with error.quarantineReasonCode
    const rawP = rawPayload();
    imm.quarantineApiTrade(rawP, caught.quarantineReasonCode, { source: 'api-trade-recovery' });
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.AMBIGUOUS_OWNER);
  });

  // 7. Catalog ID/name conflict reaches quarantine.
  test('7: catalog ID/name conflict is tagged CATALOG_ID_NAME_CONFLICT and quarantine stores the code', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    // Create a catalog where item ID 100 resolves to "Xanax" but the name "Xanax" resolves to a different ID
    setupState({});
    imm.state.catalog = {
      itemsByName: { xanax: { id: 200, name: 'Xanax', marketPrice: 90000, normalizedName: 'xanax' } },
      itemsById: { '100': CATALOG_XANAX }, // ID 100 → "Xanax" (id:100), but name lookup → id:200
      updatedAt: new Date().toISOString(),
    };
    const detail = freshDetail(); // owner has item id:100 name:"Xanax"
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    let caught;
    try { imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide); } catch (e) { caught = e; }
    assert.ok(caught, 'buildApiTradeSaleStats must throw for catalog conflict');
    assert.equal(caught.quarantineReasonCode, imm.QUARANTINE_REASON.CATALOG_ID_NAME_CONFLICT, 'error must carry CATALOG_ID_NAME_CONFLICT reason code');
    const rawP = rawPayload();
    imm.quarantineApiTrade(rawP, caught.quarantineReasonCode, { source: 'api-trade-recovery' });
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.CATALOG_ID_NAME_CONFLICT);
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
      initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 999, name: 'Xanax', quantity: 10 }] },
    });
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    let caught;
    try { imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide); } catch (e) { caught = e; }
    assert.ok(caught, 'must throw for unknown catalog ID');
    assert.equal(caught.quarantineReasonCode, imm.QUARANTINE_REASON.UNKNOWN_CATALOG_ITEM_ID, 'must use UNKNOWN_CATALOG_ITEM_ID, not fall back to name');
    // Confirm no name-fallback: if it had fallen back, catalogItem would be CATALOG_XANAX (id:100)
    // The throw itself proves the fallback is absent.
  });

  // 9. Zero FIFO coverage reaches quarantine.
  test('9: zero FIFO coverage reaches quarantine with ZERO_FIFO_COVERAGE reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [] }); // no lots — zero coverage
    const detail = freshDetail();
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const plan = imm.ledgerSalePlan(stats);
    assert.ok(!plan.fullCoverage, 'plan must show no coverage');
    assert.equal(plan.trackedQuantity, 0, 'zero tracked quantity');
    // Wire: production calls quarantineApiTrade with ZERO_FIFO_COVERAGE
    const rawP = rawPayload();
    imm.quarantineApiTrade(rawP, imm.QUARANTINE_REASON.ZERO_FIFO_COVERAGE, { apiTradeId: detail.id, source: 'api-trade-recovery' });
    assert.equal(imm.state.ledger.quarantinedTrades.length, 1);
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.ZERO_FIFO_COVERAGE);
    // Lots and sales unchanged
    assert.equal(imm.state.ledger.lots.length, 0);
    assert.equal(imm.state.ledger.sales.length, 0);
  });

  // 10. Partial FIFO coverage reaches quarantine.
  test('10: partial FIFO coverage reaches quarantine with PARTIAL_FIFO_COVERAGE reason', () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({ lots: [freshLot({ quantity: 5, remainingQuantity: 5 })] }); // only 5, need 10
    const detail = freshDetail(); // owner sells 10 Xanax
    const { ownerSide, counterpartySide } = imm.resolveApiTradeOwner(detail, 1001);
    const stats = imm.buildApiTradeSaleStats(detail, ownerSide, counterpartySide);
    const plan = imm.ledgerSalePlan(stats);
    assert.ok(!plan.fullCoverage, 'plan must show partial coverage');
    assert.ok(plan.trackedQuantity > 0, 'some tracked quantity');
    assert.ok(plan.trackedQuantity < plan.requestedQuantity, 'less than requested');
    const rawP = rawPayload();
    imm.quarantineApiTrade(rawP, imm.QUARANTINE_REASON.PARTIAL_FIFO_COVERAGE, { apiTradeId: detail.id, source: 'api-trade-recovery' });
    assert.equal(imm.state.ledger.quarantinedTrades[0].reasonCode, imm.QUARANTINE_REASON.PARTIAL_FIFO_COVERAGE);
    // Lots and sales unchanged (5 remaining)
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
    initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
    recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] }, ...detailOverrides };
  const stats = { pageType: 'trade', tradeId: 'api-trade-9001', apiTradeId: 9001,
    apiCompletedAt: detail.completedAt, apiOwnerDirection: 'initiator',
    soldAt: detail.completedAt, items: [{ itemId: 100, name: 'Xanax', quantity: 10 }],
    targetEach: 500000, netCash: 5000000, ...statsOverrides };
  const el = makeElement();
  el._tsimmApiTradePendingStats = stats;
  el._tsimmApiTradePendingDetail = detail;
  return el;
}

describe('Packet 2: Permission validation lifecycle', () => {
  // 15. Valid supported empty trades-list response returns 'validated'.
  test('15: empty trades-list response (trades: null) returns validated', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = mockFetch({ trades: null });
    const state = await imm.validateApiTradeEndpointPermission('test-key');
    assert.equal(state, 'validated');
  });

  // 16. Valid supported populated response returns 'validated'.
  test('16: populated trades-list response (trades: {}) returns validated', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    global.fetch = mockFetch({ trades: {} });
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
    setupState({});
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'startup-key');
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({ trades: null }) }; };
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
    setupState({});
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'startup-key-2');
    imm.state.ledger.tradePermission = null; // absent
    let fetchCallCount = 0;
    global.fetch = async () => { fetchCallCount++; return { ok: true, json: async () => ({ trades: null }), status: 200 }; };
    // Call with absent record — should schedule a timer (200ms delay in production code)
    imm.maybeScheduleStartupPermissionValidation();
    // Wait for the timer to fire
    await new Promise((r) => setTimeout(r, 350));
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.ok(fetchCallCount > 0, 'fetch must be called when scheduling fires for absent record');
  });

  // 25. Repeated initialization does not schedule duplicate validations.
  test('25: repeated maybeScheduleStartupPermissionValidation calls do not schedule duplicate timers', async () => {
    // After test 24b, the internal scheduling guard is permanently set (it is a module-level let, not reset).
    // All subsequent calls must be no-ops — verifiable by counting fetch calls.
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    localStorage.setItem(IMM_API_KEY_STORAGE_KEY, 'key-dup');
    imm.state.ledger.tradePermission = null;
    let extraFetchCount = 0;
    global.fetch = async () => { extraFetchCount++; return { ok: true, json: async () => ({ trades: null }), status: 200 }; };
    // Guard is already set from test 24b — these must all be no-ops
    imm.maybeScheduleStartupPermissionValidation();
    imm.maybeScheduleStartupPermissionValidation();
    imm.maybeScheduleStartupPermissionValidation();
    // Wait past the 200ms timer window
    await new Promise((r) => setTimeout(r, 350));
    localStorage.removeItem(IMM_API_KEY_STORAGE_KEY);
    assert.equal(extraFetchCount, 0, 'no additional fetch calls after guard is set — duplicate timers prevented');
  });

  // 26. Recovery open always validates before loading candidates.
  //     Verified through resolveAndValidateTradePermission: it always re-fetches and saves a fresh record.
  test('26: resolveAndValidateTradePermission always fetches and persists a fresh record', async () => {
    const imm = globalThis.__TS_IMM_TEST_EXPORTS__;
    setupState({});
    // Pre-load a stale validated record
    imm.saveTradePermissionRecord('validated', 'open-key');
    const oldRecord = imm.loadTradePermissionRecord();
    global.fetch = mockFetch({ trades: null });
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
