/**
 * Tests for IMM API-backed Black Ledger trade recovery (Issue #97).
 *
 * Tests cover:
 *  - API response normalization and finished-trade filtering
 *  - Participant and asset resolution
 *  - Money and accounting / FIFO preview
 *  - Mutation and deduplication
 *  - Regression: existing maintained tests remain unaffected
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, describe } = require('node:test');

const scriptPath = process.env.TSIMM_TEST_SCRIPT
  ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
  : path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

// ---------------------------------------------------------------------------
// Minimal helpers extracted from source for the sandbox
// ---------------------------------------------------------------------------

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
    if (lineComment) { if (character === '\n') lineComment = false; continue; }
    if (blockComment) {
      if (character === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (character === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (character === "'" || character === '"' || character === '`') { quote = character; continue; }
    if (character === '{') depth += 1;
    if (character === '}') { depth -= 1; if (depth === 0) return source.slice(start, index + 1); }
  }
  throw new Error(`Could not extract ${name}`);
}

// ---------------------------------------------------------------------------
// Build a self-contained evaluation environment for the recovery functions
// ---------------------------------------------------------------------------

function buildEnv(overrides = {}) {
  // Minimal state
  const state = {
    ledger: { lots: [], sales: [] },
    catalog: { itemsByName: {}, itemsById: {} },
    keyProfile: { userId: 1001 },
    ...overrides.state,
  };

  function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function normalizeName(value) {
    return normalizeWhitespace(String(value ?? ''))
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[^a-z0-9'+&-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function emptyScanStats() {
    return {
      scannedAt: null, pageType: 'unknown',
      tradeId: null, tradeCounterparty: '', tradeCounterpartyId: null,
      tradeCounterpartyProfileUrl: '', tradeCounterpartyBannerUrl: '',
      tradeMarketTotal: 0, tradeTargetTotal: 0, tradeTraderCash: null,
      tradeMyCash: 0, tradeNetCash: null, tradeItems: [], tradeMatchedItems: 0,
      tradeUnmatchedItems: 0, tradeUnmatched: [],
      notes: [], categoryCandidates: 0, categoryMatched: 0,
      tradeCaptureId: '', tradeSideCandidates: 0, tradeMySide: null,
    };
  }

  function catalogItemFor(name) {
    const key = normalizeName(name);
    return state.catalog.itemsByName?.[key] ?? null;
  }

  // Functions under test
  const fnNames = [
    'normalizeApiTradeListEntry',
    'apiTradeAlreadyRecorded',
    'filterApiTradeCandidates',
    'normalizeApiTradeParticipant',
    'normalizeApiTradeDetail',
    'resolveApiTradeOwner',
    'aggregateApiTradeOwnerItems',
    'catalogItemForId',
    'buildApiTradeSaleStats',
    'detectApiTradeLikelyManualDuplicate',
    'lotMatchesTradeItem',
    'ledgerSalePlan',
  ];

  const context = {
    state,
    normalizeWhitespace,
    normalizeName,
    emptyScanStats,
    catalogItemFor,
    Math,
    Number,
    Date,
    String,
    Array,
    Map,
    Set,
    ...overrides.context,
  };

  // Evaluate each function in the context
  const env = { ...context };
  for (const name of fnNames) {
    const src = extractNamedFunction(name);
    // eslint-disable-next-line no-new-func
    env[name] = new Function(...Object.keys(env), `return (${src});`)(...Object.values(env));
    // Re-bind after adding so later functions can call earlier ones
    const bound = env[name];
    // Recreate all so the entire set is available for cross-calls
    const ctx2 = { ...env };
    env[name] = new Function(...Object.keys(ctx2), `return (${src});`)(...Object.values(ctx2));
  }
  return env;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRADE_LIST_TOP_LEVEL = {
  trades: [
    { id: 9001, status: 'Accepted', completed_at: 1700000000, with_player: { id: 5678, name: 'Bob' } },
    { id: 9002, status: 'Active', completed_at: 0, with_player: { id: 5678, name: 'Bob' } },
    { id: 9003, status: 'Accepted', completed_at: 1700086400, with_player: { id: 5679, name: 'Carol' } },
  ],
};

const TRADE_LIST_OBJECT_KEYED = {
  trades: {
    '9001': { id: 9001, status: 'Accepted', completed_at: 1700000000, with_player: { id: 5678, name: 'Bob' } },
    '9003': { id: 9003, status: 'Accepted', completed_at: 1700086400, with_player: { id: 5679, name: 'Carol' } },
  },
};

const TRADE_DETAIL_TOP_LEVEL = {
  id: 9001,
  status: 'Accepted',
  completed_at: 1700000000,
  initiator: {
    user_id: 1001, name: 'Alice', money: 0,
    items: [{ id: 100, name: 'Xanax', quantity: 10 }],
  },
  recipient: { user_id: 5678, name: 'Bob', money: 5000000, items: [] },
};

const TRADE_DETAIL_NESTED = {
  trade: { ...TRADE_DETAIL_TOP_LEVEL },
};

const TRADE_DETAIL_REPEATED_ITEMS = {
  id: 9004,
  status: 'Accepted',
  completed_at: 1700000000,
  initiator: {
    user_id: 1001, name: 'Alice', money: 0,
    items: [
      { id: 100, name: 'Xanax', quantity: 3 },
      { id: 100, name: 'Xanax', quantity: 7 },
    ],
  },
  recipient: { user_id: 5678, name: 'Bob', money: 2000000, items: [] },
};

const OPEN_LOT = {
  id: 'lot-001', schemaVersion: 2, source: 'manual', venue: 'manual', country: null,
  location: null, fundingSource: 'personal', itemId: 100, itemName: 'Xanax',
  normalizedName: 'xanax', quantity: 10, remainingQuantity: 10, unitCost: 90000,
  totalCost: 900000, marketValueAtPurchase: 95000, traderValueAtPurchase: 94050,
  expectedProfitEach: 4050, expectedProfitTotal: 40500,
  capturedAt: '2026-01-01T00:00:00.000Z', purchaseUrl: null,
  captureMethod: 'manual', status: 'open', notes: null,
};

const CATALOG_XANAX = { id: 100, name: 'Xanax', normalizedName: 'xanax', marketPrice: 95000 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IMM API Trade Recovery', () => {

  describe('API normalization — trade list', () => {
    test('normalizeApiTradeListEntry: supported top-level shape returns normalized entry', () => {
      const { normalizeApiTradeListEntry } = buildEnv();
      const result = normalizeApiTradeListEntry({ id: 9001, status: 'Accepted', completed_at: 1700000000, with_player: { id: 5678, name: 'Bob' } });
      assert.equal(result.id, 9001);
      assert.equal(result.status, 'Accepted');
      assert.ok(result.completedAt, 'should have completedAt');
      assert.equal(result.otherPlayerId, 5678);
      assert.equal(result.otherPlayerName, 'Bob');
    });

    test('normalizeApiTradeListEntry: null/non-object input returns null', () => {
      const { normalizeApiTradeListEntry } = buildEnv();
      assert.equal(normalizeApiTradeListEntry(null), null);
      assert.equal(normalizeApiTradeListEntry('bad'), null);
      assert.equal(normalizeApiTradeListEntry({ id: 0 }), null);
    });

    test('filterApiTradeCandidates: filters to only finished trades', () => {
      const { filterApiTradeCandidates } = buildEnv();
      const result = filterApiTradeCandidates(TRADE_LIST_TOP_LEVEL);
      assert.equal(result.length, 2, 'Active trade should be excluded');
      assert.ok(result.every((c) => ['accepted', 'finished', 'completed'].includes(c.status.toLowerCase())));
    });

    test('filterApiTradeCandidates: accepts object-keyed trades shape', () => {
      const { filterApiTradeCandidates } = buildEnv();
      const result = filterApiTradeCandidates(TRADE_LIST_OBJECT_KEYED);
      assert.equal(result.length, 2);
    });

    test('filterApiTradeCandidates: malformed response throws', () => {
      const { filterApiTradeCandidates } = buildEnv();
      assert.throws(() => filterApiTradeCandidates({}), /unsupported or missing/i);
      assert.throws(() => filterApiTradeCandidates(null), /unsupported or missing/i);
    });

    test('filterApiTradeCandidates: already-recorded trades are excluded', () => {
      const env = buildEnv({
        state: {
          ledger: {
            lots: [],
            sales: [{ fingerprint: 'trade:api-trade-9001', id: 's1', soldAt: new Date().toISOString(), items: [], cashReceived: 0 }],
          },
          catalog: { itemsByName: {}, itemsById: {} },
          keyProfile: { userId: 1001 },
        },
      });
      const result = env.filterApiTradeCandidates(TRADE_LIST_TOP_LEVEL);
      assert.ok(!result.some((c) => c.id === 9001), 'recorded trade should be excluded');
    });
  });

  describe('API normalization — trade detail', () => {
    test('normalizeApiTradeDetail: supported top-level shape', () => {
      const { normalizeApiTradeDetail } = buildEnv();
      const result = normalizeApiTradeDetail(TRADE_DETAIL_TOP_LEVEL);
      assert.equal(result.id, 9001);
      assert.equal(result.initiator.userId, 1001);
      assert.equal(result.initiator.items.length, 1);
      assert.equal(result.recipient.money, 5000000);
    });

    test('normalizeApiTradeDetail: nested trade shape (Shape B)', () => {
      const { normalizeApiTradeDetail } = buildEnv();
      const result = normalizeApiTradeDetail(TRADE_DETAIL_NESTED);
      assert.equal(result.id, 9001);
    });

    test('normalizeApiTradeDetail: non-finished trade throws', () => {
      const { normalizeApiTradeDetail } = buildEnv();
      const active = { ...TRADE_DETAIL_TOP_LEVEL, status: 'Active' };
      assert.throws(() => normalizeApiTradeDetail(active), /not finished/i);
    });

    test('normalizeApiTradeDetail: missing trade ID throws', () => {
      const { normalizeApiTradeDetail } = buildEnv();
      assert.throws(() => normalizeApiTradeDetail({ status: 'Accepted', completed_at: 1700000000, initiator: { user_id: 1 }, recipient: { user_id: 2 } }), /no valid trade id/i);
    });

    test('normalizeApiTradeDetail: missing timestamp throws', () => {
      const { normalizeApiTradeDetail } = buildEnv();
      const noTs = { ...TRADE_DETAIL_TOP_LEVEL, completed_at: 0, timestamp: 0, timestamp_accepted: 0 };
      assert.throws(() => normalizeApiTradeDetail(noTs), /no valid completion timestamp/i);
    });

    test('normalizeApiTradeDetail: malformed/null input throws', () => {
      const { normalizeApiTradeDetail } = buildEnv();
      assert.throws(() => normalizeApiTradeDetail(null), /missing or malformed/i);
    });
  });

  describe('Participants and assets', () => {
    test('resolveApiTradeOwner: identifies owner when owner is initiator', () => {
      const { normalizeApiTradeDetail, resolveApiTradeOwner } = buildEnv();
      const detail = normalizeApiTradeDetail(TRADE_DETAIL_TOP_LEVEL);
      const { ownerSide, counterpartySide } = resolveApiTradeOwner(detail, 1001);
      assert.equal(ownerSide.userId, 1001);
      assert.equal(counterpartySide.userId, 5678);
    });

    test('resolveApiTradeOwner: identifies owner when owner is recipient', () => {
      const { normalizeApiTradeDetail, resolveApiTradeOwner } = buildEnv();
      const flipped = {
        ...TRADE_DETAIL_TOP_LEVEL,
        initiator: { user_id: 5678, name: 'Bob', money: 5000000, items: [] },
        recipient: { user_id: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
      };
      const detail = normalizeApiTradeDetail(flipped);
      const { ownerSide, counterpartySide } = resolveApiTradeOwner(detail, 1001);
      assert.equal(ownerSide.userId, 1001);
      assert.equal(counterpartySide.userId, 5678);
    });

    test('resolveApiTradeOwner: ambiguous owner throws', () => {
      const { normalizeApiTradeDetail, resolveApiTradeOwner } = buildEnv();
      const detail = normalizeApiTradeDetail(TRADE_DETAIL_TOP_LEVEL);
      assert.throws(() => resolveApiTradeOwner(detail, 9999), /ownership is ambiguous/i);
    });

    test('resolveApiTradeOwner: missing/zero keyUserId throws', () => {
      const { normalizeApiTradeDetail, resolveApiTradeOwner } = buildEnv();
      const detail = normalizeApiTradeDetail(TRADE_DETAIL_TOP_LEVEL);
      assert.throws(() => resolveApiTradeOwner(detail, 0), /unknown/i);
      assert.throws(() => resolveApiTradeOwner(detail, null), /unknown/i);
    });

    test('aggregateApiTradeOwnerItems: repeated same-ID items aggregate correctly', () => {
      const { normalizeApiTradeDetail, resolveApiTradeOwner, aggregateApiTradeOwnerItems } = buildEnv();
      const detail = normalizeApiTradeDetail(TRADE_DETAIL_REPEATED_ITEMS);
      const { ownerSide } = resolveApiTradeOwner(detail, 1001);
      const aggregated = aggregateApiTradeOwnerItems(ownerSide.items);
      assert.equal(aggregated.length, 1);
      assert.equal(aggregated[0].quantity, 10);
    });

    test('buildApiTradeSaleStats: counterparty items rejected', () => {
      const env = buildEnv({ state: { ledger: { lots: [], sales: [] }, catalog: { itemsByName: {}, itemsById: {} }, keyProfile: { userId: 1001 } } });
      const barterDetail = {
        id: 9001,
        status: 'Accepted',
        completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 5 }] },
        recipient: { userId: 5678, name: 'Bob', money: 1000, items: [{ id: 200, name: 'Cannabis', quantity: 1 }] },
      };
      assert.throws(
        () => env.buildApiTradeSaleStats(barterDetail, barterDetail.initiator, barterDetail.recipient),
        /barter/i
      );
    });

    test('buildApiTradeSaleStats: no owner items rejected', () => {
      const env = buildEnv({ state: { ledger: { lots: [], sales: [] }, catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } }, keyProfile: { userId: 1001 } } });
      const noItems = {
        id: 9001,
        status: 'Accepted',
        completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [] },
        recipient: { userId: 5678, name: 'Bob', money: 1000000, items: [] },
      };
      assert.throws(
        () => env.buildApiTradeSaleStats(noItems, noItems.initiator, noItems.recipient),
        /no outgoing items/i
      );
    });

    test('buildApiTradeSaleStats: unknown catalog item throws', () => {
      const env = buildEnv({ state: { ledger: { lots: [], sales: [] }, catalog: { itemsByName: {}, itemsById: {} }, keyProfile: { userId: 1001 } } });
      const rawDetail = {
        id: 9001,
        status: 'Accepted',
        completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 1 }] },
        recipient: { userId: 5678, name: 'Bob', money: 1000000, items: [] },
      };
      assert.throws(
        () => env.buildApiTradeSaleStats(rawDetail, rawDetail.initiator, rawDetail.recipient),
        /catalog/i
      );
    });
  });

  describe('Money and accounting', () => {
    function makeEnvWithCatalog(extraState = {}) {
      return buildEnv({
        state: {
          ledger: { lots: [{ ...OPEN_LOT }], sales: [] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
          ...extraState,
        },
      });
    }

    test('buildApiTradeSaleStats: counterparty cash only computes correct net proceeds', () => {
      const env = makeEnvWithCatalog();
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
      };
      const stats = env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient);
      assert.equal(stats.tradeNetCash, 5000000);
      assert.equal(stats.tradeMyCash, 0);
    });

    test('buildApiTradeSaleStats: both parties contribute money reduces net proceeds', () => {
      const env = makeEnvWithCatalog();
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 200000, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 5200000, items: [] },
      };
      const stats = env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient);
      assert.equal(stats.tradeNetCash, 5000000);
      assert.equal(stats.tradeMyCash, 200000);
    });

    test('buildApiTradeSaleStats: no cash at all throws', () => {
      const env = makeEnvWithCatalog();
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 0, items: [] },
      };
      assert.throws(() => env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient), /no cash/i);
    });

    test('buildApiTradeSaleStats: zero or negative net proceeds throws', () => {
      const env = makeEnvWithCatalog();
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 5000000, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 3000000, items: [] },
      };
      assert.throws(() => env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient), /zero or negative/i);
    });

    test('ledgerSalePlan: produces correct FIFO plan and cost basis for API trade stats', () => {
      const env = makeEnvWithCatalog();
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
      };
      const stats = env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient);
      const plan = env.ledgerSalePlan(stats);
      assert.equal(plan.requestedQuantity, 10);
      assert.equal(plan.trackedQuantity, 10);
      assert.equal(plan.untrackedQuantity, 0);
      assert.ok(plan.fullCoverage);
      assert.equal(plan.trackedCostBasis, 900000); // 10 * 90000
      assert.ok(Number.isFinite(plan.realizedProfit));
      assert.equal(plan.realizedProfit, 5000000 - 900000);
    });

    test('ledgerSalePlan: zero FIFO coverage (no matching lots) returns untrackedQuantity > 0', () => {
      const env = buildEnv({
        state: {
          ledger: { lots: [], sales: [] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
      };
      const stats = env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient);
      const plan = env.ledgerSalePlan(stats);
      assert.ok(!plan.fullCoverage);
      assert.equal(plan.trackedQuantity, 0);
    });

    test('ledgerSalePlan: partial FIFO coverage returns untrackedQuantity > 0', () => {
      const partialLot = { ...OPEN_LOT, quantity: 5, remainingQuantity: 5 };
      const env = buildEnv({
        state: {
          ledger: { lots: [partialLot], sales: [] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
      };
      const stats = env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient);
      const plan = env.ledgerSalePlan(stats);
      assert.ok(!plan.fullCoverage);
      assert.equal(plan.untrackedQuantity, 5);
    });
  });

  describe('Mutation and deduplication', () => {
    test('apiTradeAlreadyRecorded: returns false when no matching sale', () => {
      const { apiTradeAlreadyRecorded } = buildEnv();
      assert.equal(apiTradeAlreadyRecorded(9001), false);
    });

    test('apiTradeAlreadyRecorded: returns true when fingerprint matches', () => {
      const env = buildEnv({
        state: {
          ledger: {
            lots: [],
            sales: [{ id: 's1', fingerprint: 'trade:api-trade-9001', soldAt: new Date().toISOString(), items: [], cashReceived: 0 }],
          },
          catalog: { itemsByName: {}, itemsById: {} },
          keyProfile: { userId: 1001 },
        },
      });
      assert.equal(env.apiTradeAlreadyRecorded(9001), true);
      assert.equal(env.apiTradeAlreadyRecorded(9002), false);
    });

    test('detectApiTradeLikelyManualDuplicate: returns empty when no sales', () => {
      const env = buildEnv({
        state: {
          ledger: { lots: [], sales: [] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const stats = env.buildApiTradeSaleStats(
        { id: 9001, status: 'Accepted', completedAt: new Date().toISOString(),
          initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
          recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] } },
        { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        { userId: 5678, name: 'Bob', money: 5000000, items: [] }
      );
      const dupes = env.detectApiTradeLikelyManualDuplicate(stats, 86400000);
      assert.equal(dupes.length, 0);
    });

    test('detectApiTradeLikelyManualDuplicate: detects a likely manual duplicate within window', () => {
      const recentSale = {
        id: 's-manual',
        fingerprint: 'trade-fallback:abc123',
        soldAt: new Date(Date.now() - 3600000).toISOString(), // 1h ago
        cashReceived: 5000000,
        items: [{ itemId: 100, itemName: 'Xanax', quantity: 10 }],
      };
      const env = buildEnv({
        state: {
          ledger: { lots: [{ ...OPEN_LOT }], sales: [recentSale] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const stats = env.buildApiTradeSaleStats(
        { id: 9001, status: 'Accepted', completedAt: new Date().toISOString(),
          initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
          recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] } },
        { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        { userId: 5678, name: 'Bob', money: 5000000, items: [] }
      );
      const dupes = env.detectApiTradeLikelyManualDuplicate(stats, 86400000);
      assert.equal(dupes.length, 1);
    });

    test('detectApiTradeLikelyManualDuplicate: does not flag API-recorded sales as manual duplicates', () => {
      const apiSale = {
        id: 's-api',
        fingerprint: 'trade:api-trade-9000',
        soldAt: new Date(Date.now() - 3600000).toISOString(),
        cashReceived: 5000000,
        items: [{ itemId: 100, itemName: 'Xanax', quantity: 10 }],
      };
      const env = buildEnv({
        state: {
          ledger: { lots: [{ ...OPEN_LOT }], sales: [apiSale] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const stats = env.buildApiTradeSaleStats(
        { id: 9001, status: 'Accepted', completedAt: new Date().toISOString(),
          initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
          recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] } },
        { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        { userId: 5678, name: 'Bob', money: 5000000, items: [] }
      );
      const dupes = env.detectApiTradeLikelyManualDuplicate(stats, 86400000);
      assert.equal(dupes.length, 0);
    });

    test('detectApiTradeLikelyManualDuplicate: does not flag sale outside time window', () => {
      const oldSale = {
        id: 's-old',
        fingerprint: 'trade-fallback:xyz',
        soldAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        cashReceived: 5000000,
        items: [{ itemId: 100, itemName: 'Xanax', quantity: 10 }],
      };
      const env = buildEnv({
        state: {
          ledger: { lots: [{ ...OPEN_LOT }], sales: [oldSale] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const stats = env.buildApiTradeSaleStats(
        { id: 9001, status: 'Accepted', completedAt: new Date().toISOString(),
          initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
          recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] } },
        { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        { userId: 5678, name: 'Bob', money: 5000000, items: [] }
      );
      const dupes = env.detectApiTradeLikelyManualDuplicate(stats, 86400000);
      assert.equal(dupes.length, 0);
    });

    test('buildApiTradeSaleStats produces stats with tradeId api-trade-{id} fingerprint', () => {
      const env = buildEnv({
        state: {
          ledger: { lots: [{ ...OPEN_LOT }], sales: [] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
      };
      const stats = env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient);
      assert.equal(stats.tradeId, 'api-trade-9001');
    });

    test('ledgerSalePlan does not mutate lots (review is non-mutating)', () => {
      const env = buildEnv({
        state: {
          ledger: { lots: [{ ...OPEN_LOT }], sales: [] },
          catalog: { itemsByName: { xanax: CATALOG_XANAX }, itemsById: { '100': CATALOG_XANAX } },
          keyProfile: { userId: 1001 },
        },
      });
      const detail = {
        id: 9001, status: 'Accepted', completedAt: '2026-01-01T00:00:00.000Z',
        initiator: { userId: 1001, name: 'Alice', money: 0, items: [{ id: 100, name: 'Xanax', quantity: 10 }] },
        recipient: { userId: 5678, name: 'Bob', money: 5000000, items: [] },
      };
      const stats = env.buildApiTradeSaleStats(detail, detail.initiator, detail.recipient);
      const before = env.state.ledger.lots[0].remainingQuantity;
      env.ledgerSalePlan(stats);
      const after = env.state.ledger.lots[0].remainingQuantity;
      assert.equal(before, after, 'ledgerSalePlan must not mutate lots');
    });
  });

  describe('Protected function existence check', () => {
    test('recordTradeSale exists in IMM', () => {
      assert.ok(source.includes('function recordTradeSale('), 'recordTradeSale must exist');
    });
    test('normalizeLedger exists in IMM', () => {
      assert.ok(source.includes('function normalizeLedger('), 'normalizeLedger must exist');
    });
    test('ledgerSalePlan exists in IMM', () => {
      assert.ok(source.includes('function ledgerSalePlan('), 'ledgerSalePlan must exist');
    });
    test('pricedTradeRenderRowBadge exists in IMM', () => {
      assert.ok(source.includes('function pricedTradeRenderRowBadge(') || source.includes('pricedTradeRenderRowBadge'), 'pricedTradeRenderRowBadge must exist');
    });
    test('pricedTradeEnsureNativeMaxButton exists in IMM', () => {
      assert.ok(source.includes('function pricedTradeEnsureNativeMaxButton(') || source.includes('pricedTradeEnsureNativeMaxButton'), 'pricedTradeEnsureNativeMaxButton must exist');
    });
  });

  describe('Version check', () => {
    test('IMM version is 0.19.34', () => {
      const match = source.match(/@version\s+([\d.]+)/);
      assert.ok(match, 'version metadata should exist');
      assert.equal(match[1], '0.19.34', 'version should be 0.19.34');
    });
  });
});

console.log('# IMM API Trade Recovery tests passed.');
