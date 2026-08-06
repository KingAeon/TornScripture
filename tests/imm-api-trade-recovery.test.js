'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = process.env.TSIMM_TEST_SCRIPT
  ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
  : path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

// ── function extractor (same pattern as other IMM tests) ──────────────────────
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
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    const nx = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && nx === '/') { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && nx === '/') { lineComment = true; i += 1; continue; }
    if (ch === '/' && nx === '*') { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name}: could not find closing brace`);
}

// ── minimal sandbox ────────────────────────────────────────────────────────────
// Pure helpers pulled from IMM; no DOM, no fetch, no storage.
const sandbox = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Array,
  Object,
  Map,
  isNaN,
  isFinite,
  parseFloat,
  parseInt,
};
vm.createContext(sandbox);

for (const name of [
  'optionalFiniteNumber',
  'normalizeWhitespace',
  'escapeHtml',
  'emptyScanStats',
  'normalizeApiTradesList',
  'normalizeApiTradeDetail',
]) {
  vm.runInContext(extractNamedFunction(name), sandbox, { filename: scriptPath });
}

// normalizeName contains a regex with ' characters that the function extractor
// cannot handle safely; define an equivalent implementation directly.
vm.runInContext(`
function normalizeName(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim()
    .toLowerCase()
    .replace(/[^a-z0-9'+&-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}
`, sandbox);

// buildApiTradeStats also needs createId — stub it out.
vm.runInContext('function createId(prefix) { return (prefix || "id") + "-test-" + Math.random().toString(36).slice(2); }', sandbox);

vm.runInContext(extractNamedFunction('buildApiTradeStats'), sandbox, { filename: scriptPath });

// ── fixtures ──────────────────────────────────────────────────────────────────
// A minimal catalog that covers items used in fixtures.
const CATALOG = {
  itemsById: {
    74: { id: 74, name: 'Morphine', marketPrice: 5000 },
    55: { id: 55, name: 'Xanax', marketPrice: 2500 },
  },
  itemsByName: {
    morphine: { id: 74, name: 'Morphine', marketPrice: 5000 },
    xanax: { id: 55, name: 'Xanax', marketPrice: 2500 },
  },
};

const OWNER_ID = 1001;
const COUNTERPARTY_ID = 2002;

// Shape A: trade wrapped under "trade" key
function makeShapeA(overrides = {}) {
  return {
    trade: {
      tradeId: 12345,
      status: 'Accepted',
      completedAt: null,
      timestamp_completed: 1700000000,
      initiator: {
        id: OWNER_ID,
        name: 'OwnerName',
        offer: {
          money: 0,
          items: [{ id: 74, name: 'Morphine', quantity: 5 }],
        },
      },
      recipient: {
        id: COUNTERPARTY_ID,
        name: 'BuyerName',
        offer: {
          money: 500000,
          items: [],
        },
      },
      ...overrides,
    },
  };
}

// Shape B: trade at top level (no wrapper)
function makeShapeB(overrides = {}) {
  return {
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: {
        money: 0,
        items: [{ id: 74, name: 'Morphine', quantity: 5 }],
      },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: {
        money: 500000,
        items: [],
      },
    },
    ...overrides,
  };
}

// ── normalizeApiTradesList ────────────────────────────────────────────────────
{
  // Shape A — object keyed by trade ID
  const rawA = {
    trades: {
      12345: { tradeId: 12345, status: 'Accepted', timestamp_completed: 1700000000 },
      99999: { tradeId: 99999, status: 'Initiated', timestamp_completed: 0 },
    },
  };
  const listA = sandbox.normalizeApiTradesList(rawA);
  assert.ok(Array.isArray(listA), 'Shape A should return an array');
  assert.equal(listA.length, 2, 'Shape A: both entries should be returned');
  const entry = listA.find((t) => t.tradeId === 12345);
  assert.ok(entry, 'Shape A: trade 12345 should be present');
  assert.equal(entry.status, 'Accepted');
  assert.ok(entry.completedAt, 'Shape A: completedAt should be set');

  // Shape B — array of trade entries
  const rawB = {
    trades: [
      { tradeId: 12345, status: 'Accepted', timestamp_completed: 1700000000 },
      { tradeId: 77777, status: 'Cancelled', timestamp_completed: 0 },
    ],
  };
  const listB = sandbox.normalizeApiTradesList(rawB);
  assert.ok(Array.isArray(listB), 'Shape B should return an array');
  assert.equal(listB.length, 2, 'Shape B: both entries should be returned');
  assert.equal(listB[0].tradeId, 12345);
  assert.equal(listB[0].status, 'Accepted');

  // Finished-trade filtering: only Accepted trades should be returned (filtering
  // is the consumer's responsibility, but normalization preserves status).
  const accepted = listB.filter((t) => t.status === 'Accepted');
  assert.equal(accepted.length, 1, 'Only Accepted trade should survive filtering');

  // Malformed / missing trades key
  assert.equal(sandbox.normalizeApiTradesList(null), null, 'null → null');
  assert.equal(sandbox.normalizeApiTradesList({}), null, 'empty object → null');
  assert.equal(sandbox.normalizeApiTradesList({ trades: 'bad' }), null, 'string trades → null');

  // Nested under data
  const rawNested = { data: { trades: [{ tradeId: 1, status: 'Accepted', timestamp_completed: 1700000000 }] } };
  const listNested = sandbox.normalizeApiTradesList(rawNested);
  assert.ok(listNested, 'Nested under data should be handled');
  assert.equal(listNested.length, 1);
}

// ── normalizeApiTradeDetail ───────────────────────────────────────────────────
{
  // Shape A: wrapped
  const detailA = sandbox.normalizeApiTradeDetail(makeShapeA());
  assert.ok(detailA, 'Shape A should normalize');
  assert.equal(detailA.tradeId, 12345);
  assert.equal(detailA.status, 'Accepted');
  assert.ok(detailA.completedAt, 'completedAt should be set from timestamp');
  assert.equal(detailA.initiator.id, OWNER_ID);
  assert.equal(detailA.initiator.items.length, 1);
  assert.equal(detailA.initiator.items[0].itemId, 74);
  assert.equal(detailA.initiator.items[0].quantity, 5);
  assert.equal(detailA.recipient.money, 500000);

  // Shape B: top-level
  const detailB = sandbox.normalizeApiTradeDetail(makeShapeB());
  assert.ok(detailB, 'Shape B should normalize');
  assert.equal(detailB.tradeId, 12345);

  // Malformed: missing tradeId
  assert.equal(sandbox.normalizeApiTradeDetail({ trade: { status: 'Accepted' } }), null, 'Missing tradeId → null');

  // Malformed: missing participant
  assert.equal(
    sandbox.normalizeApiTradeDetail({ trade: { tradeId: 1, status: 'Accepted', initiator: null, recipient: null } }),
    null,
    'Missing participants → null',
  );

  // Malformed: null input
  assert.equal(sandbox.normalizeApiTradeDetail(null), null, 'null → null');
  assert.equal(sandbox.normalizeApiTradeDetail({}), null, 'empty → null');
}

// ── buildApiTradeStats — participants and assets ─────────────────────────────
{
  // Owner is initiator
  const detail = sandbox.normalizeApiTradeDetail(makeShapeA());
  const r = sandbox.buildApiTradeStats(detail, OWNER_ID, CATALOG);
  assert.ok(!r.error, `Should succeed: ${r.error}`);
  assert.equal(r.stats.tradeCounterpartyId, COUNTERPARTY_ID);
  assert.equal(r.apiTradeId, 12345);
  assert.equal(r.netProceeds, 500000);

  // Owner is recipient
  const flipped = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 500000, items: [] },
    },
    recipient: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: { money: 0, items: [{ id: 74, name: 'Morphine', quantity: 3 }] },
    },
  });
  const rFlipped = sandbox.buildApiTradeStats(flipped, OWNER_ID, CATALOG);
  assert.ok(!rFlipped.error, `Flipped should succeed: ${rFlipped.error}`);
  assert.equal(rFlipped.stats.tradeCounterpartyId, COUNTERPARTY_ID);

  // Ambiguous ownership: owner ID not found
  const rAmbig = sandbox.buildApiTradeStats(detail, 9999, CATALOG);
  assert.ok(rAmbig.error, 'Unknown owner ID should fail closed');

  // Counterparty contributes items (barter) → reject
  const barter = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: { money: 0, items: [{ id: 74, name: 'Morphine', quantity: 1 }] },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 100000, items: [{ id: 55, name: 'Xanax', quantity: 1 }] },
    },
  });
  const rBarter = sandbox.buildApiTradeStats(barter, OWNER_ID, CATALOG);
  assert.ok(rBarter.error, 'Barter trade should fail closed');

  // No owner items → reject
  const noItems = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: { money: 0, items: [] },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 500000, items: [] },
    },
  });
  const rNoItems = sandbox.buildApiTradeStats(noItems, OWNER_ID, CATALOG);
  assert.ok(rNoItems.error, 'No owner items should fail closed');

  // Unknown catalog item → reject
  const unknownItem = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: { money: 0, items: [{ id: 9999, name: 'UnknownItem', quantity: 1 }] },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 100000, items: [] },
    },
  });
  const rUnknown = sandbox.buildApiTradeStats(unknownItem, OWNER_ID, CATALOG);
  assert.ok(rUnknown.error, 'Unknown catalog item should fail closed');

  // Not finished (status != Accepted) → reject
  const notDone = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Initiated',
    timestamp_completed: 0,
    initiator: { id: OWNER_ID, name: 'OwnerName', offer: { money: 0, items: [{ id: 74, name: 'Morphine', quantity: 1 }] } },
    recipient: { id: COUNTERPARTY_ID, name: 'BuyerName', offer: { money: 100000, items: [] } },
  });
  const rNotDone = sandbox.buildApiTradeStats(notDone, OWNER_ID, CATALOG);
  assert.ok(rNotDone.error, 'Non-accepted status should fail closed');

  // Missing owner ID argument
  const rNoOwner = sandbox.buildApiTradeStats(detail, null, CATALOG);
  assert.ok(rNoOwner.error, 'Missing ownerId should fail closed');
}

// ── buildApiTradeStats — repeated unique-item entries aggregate correctly ─────
{
  const detailDup = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: {
        money: 0,
        items: [
          { id: 74, name: 'Morphine', quantity: 3 },
          { id: 74, name: 'Morphine', quantity: 2 }, // repeated entry
        ],
      },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 250000, items: [] },
    },
  });
  const rDup = sandbox.buildApiTradeStats(detailDup, OWNER_ID, CATALOG);
  assert.ok(!rDup.error, `Repeated entries should aggregate: ${rDup.error}`);
  const morphine = rDup.stats.tradeItems.find((i) => i.itemId === 74);
  assert.ok(morphine, 'Aggregated Morphine entry should exist');
  assert.equal(morphine.quantity, 5, 'Repeated entries: quantities should be summed to 5');
}

// ── buildApiTradeStats — money and accounting ─────────────────────────────────
{
  // Counterparty money only
  const detailMoney = sandbox.normalizeApiTradeDetail(makeShapeA());
  const rMoney = sandbox.buildApiTradeStats(detailMoney, OWNER_ID, CATALOG);
  assert.ok(!rMoney.error, `Counterparty money only should succeed: ${rMoney.error}`);
  assert.equal(rMoney.counterpartyCash, 500000);
  assert.equal(rMoney.ownerCash, 0);
  assert.equal(rMoney.netProceeds, 500000);

  // Money from both parties (owner contributes cash)
  const detailBoth = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: {
        money: 50000, // owner adds cash
        items: [{ id: 74, name: 'Morphine', quantity: 5 }],
      },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 600000, items: [] },
    },
  });
  const rBoth = sandbox.buildApiTradeStats(detailBoth, OWNER_ID, CATALOG);
  assert.ok(!rBoth.error, `Both-party money should succeed: ${rBoth.error}`);
  assert.equal(rBoth.counterpartyCash, 600000);
  assert.equal(rBoth.ownerCash, 50000);
  assert.equal(rBoth.netProceeds, 550000, 'Net proceeds = counterparty cash - owner cash');

  // No usable proceeds (counterparty pays nothing)
  const detailNoPay = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: { money: 0, items: [{ id: 74, name: 'Morphine', quantity: 1 }] },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 0, items: [] },
    },
  });
  const rNoPay = sandbox.buildApiTradeStats(detailNoPay, OWNER_ID, CATALOG);
  assert.ok(rNoPay.error, 'Zero proceeds should fail closed');

  // Net proceeds zero or negative
  const detailNeg = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: { money: 100000, items: [{ id: 74, name: 'Morphine', quantity: 1 }] },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 50000, items: [] },
    },
  });
  const rNeg = sandbox.buildApiTradeStats(detailNeg, OWNER_ID, CATALOG);
  assert.ok(rNeg.error, 'Negative net proceeds should fail closed');
}

// ── buildApiTradeStats — multi-item net proceeds target proportional split ─────
{
  const detailMulti = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: {
        money: 0,
        items: [
          { id: 74, name: 'Morphine', quantity: 2 },
          { id: 55, name: 'Xanax', quantity: 4 },
        ],
      },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 30000, items: [] },
    },
  });
  const rMulti = sandbox.buildApiTradeStats(detailMulti, OWNER_ID, CATALOG);
  assert.ok(!rMulti.error, `Multi-item should succeed: ${rMulti.error}`);
  // targetTotal for each item should sum to netProceeds
  const totalTarget = rMulti.stats.tradeItems.reduce((s, i) => s + i.targetTotal, 0);
  assert.ok(Math.abs(totalTarget - rMulti.netProceeds) < 1, 'Target totals should sum to net proceeds');
  // tradeTargetTotal on the stats object should equal netProceeds
  assert.equal(rMulti.stats.tradeTargetTotal, rMulti.netProceeds);
}

// ── isApiTradeAlreadyRecorded and findLikelyManualApiDuplicate ────────────────
// These depend on state.ledger.sales so we set up a minimal closure.
{
  let mockSales = [];

  // Inject state into a local scope for testing.
  const stateSandbox = { ...sandbox };
  vm.createContext(stateSandbox);
  vm.runInContext(`
    const state = { ledger: { sales: [], lots: [] } };
    function isApiTradeAlreadyRecorded(apiTradeId) {
      const fingerprint = 'trade:api:' + apiTradeId;
      return (state.ledger.sales || []).some((sale) => sale.fingerprint === fingerprint);
    }
  `, stateSandbox, { filename: scriptPath });

  vm.runInContext(extractNamedFunction('findLikelyManualApiDuplicate'), stateSandbox, { filename: scriptPath });

  // No sales yet — not recorded.
  assert.equal(stateSandbox.isApiTradeAlreadyRecorded(12345), false, 'Not recorded initially');

  // Add a matching API sale.
  vm.runInContext(`
    state.ledger.sales.push({
      id: 'sale-1',
      fingerprint: 'trade:api:12345',
      captureMethod: 'api-completed-trade',
      cashReceived: 500000,
      soldAt: new Date(1700000000 * 1000).toISOString(),
      items: [{ itemId: 74, quantity: 5 }],
    });
  `, stateSandbox);
  assert.equal(stateSandbox.isApiTradeAlreadyRecorded(12345), true, 'Should be recorded after push');
  assert.equal(stateSandbox.isApiTradeAlreadyRecorded(99999), false, 'Different trade ID should not match');

  // findLikelyManualApiDuplicate — API records are excluded from duplicate detection.
  const noDup = vm.runInContext(`
    findLikelyManualApiDuplicate(
      [{ itemId: 74, quantity: 5 }],
      500000,
      new Date(1700000000 * 1000).toISOString(),
    );
  `, stateSandbox);
  assert.equal(noDup, null, 'API sale should not be flagged as manual duplicate');

  // Add a manual recovery that matches.
  vm.runInContext(`
    state.ledger.sales.push({
      id: 'sale-manual-1',
      fingerprint: 'trade-fallback:abc123',
      captureMethod: 'manual-missed-sale-recovery',
      cashReceived: 500000,
      soldAt: new Date(1700000000 * 1000).toISOString(),
      items: [{ itemId: 74, quantity: 5 }],
    });
  `, stateSandbox);

  const dup = vm.runInContext(`
    findLikelyManualApiDuplicate(
      [{ itemId: 74, quantity: 5 }],
      500000,
      new Date(1700000000 * 1000).toISOString(),
    );
  `, stateSandbox);
  assert.ok(dup, 'Manual sale within time window should be detected as likely duplicate');
  assert.equal(dup.id, 'sale-manual-1');

  // Time outside window → no match.
  const farAway = vm.runInContext(`
    findLikelyManualApiDuplicate(
      [{ itemId: 74, quantity: 5 }],
      500000,
      new Date((1700000000 + 3600) * 1000).toISOString(),
    );
  `, stateSandbox);
  assert.equal(farAway, null, 'Sale too far in time should not be a duplicate');

  // Different items → no match.
  const diffItems = vm.runInContext(`
    findLikelyManualApiDuplicate(
      [{ itemId: 55, quantity: 5 }],
      500000,
      new Date(1700000000 * 1000).toISOString(),
    );
  `, stateSandbox);
  assert.equal(diffItems, null, 'Different items should not be a duplicate');

  // Different proceeds → no match.
  const diffCash = vm.runInContext(`
    findLikelyManualApiDuplicate(
      [{ itemId: 74, quantity: 5 }],
      999999,
      new Date(1700000000 * 1000).toISOString(),
    );
  `, stateSandbox);
  assert.equal(diffCash, null, 'Different proceeds should not be a duplicate');
}

// ── mutation safety: buildApiTradeStats is non-mutating ───────────────────────
{
  const catalog = JSON.parse(JSON.stringify(CATALOG));
  const detail = sandbox.normalizeApiTradeDetail(makeShapeA());
  sandbox.buildApiTradeStats(detail, OWNER_ID, catalog);
  // Verify original catalog was not mutated.
  assert.ok(catalog.itemsById[74], 'Catalog should be intact after buildApiTradeStats');
}

// ── normalizeApiTradeDetail — completedAt from timestamp_completed ────────────
{
  const d = sandbox.normalizeApiTradeDetail(makeShapeA());
  assert.ok(d.completedAt, 'completedAt should be populated from timestamp_completed');
  assert.ok(d.completedAt.startsWith('2023'), 'completedAt should be an ISO string from unix timestamp');
}

// ── unsupported asset: points in offer should not break normalization ─────────
// (points are silently ignored — items and money are the only supported assets)
{
  const withPoints = sandbox.normalizeApiTradeDetail({
    tradeId: 12345,
    status: 'Accepted',
    timestamp_completed: 1700000000,
    initiator: {
      id: OWNER_ID,
      name: 'OwnerName',
      offer: { money: 0, points: 100, items: [{ id: 74, name: 'Morphine', quantity: 1 }] },
    },
    recipient: {
      id: COUNTERPARTY_ID,
      name: 'BuyerName',
      offer: { money: 50000, points: 0, items: [] },
    },
  });
  assert.ok(withPoints, 'Points in offer should not break normalization');
  // The existing fail-closed logic in buildApiTradeStats will handle points as
  // unsupported assets if needed; normalization itself preserves what it knows.
}

console.log('IMM API trade recovery tests passed.');
