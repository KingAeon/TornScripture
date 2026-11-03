const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js'), 'utf8');
const TRADERS_KEY = 'tornscripture-imm-traders-v1';
const LEDGER_KEY = 'tornscripture-imm-ledger-v1';
const PRICE_INDEX_KEY = 'tornscripture-imm-trader-price-index-v1';
const REPORT_BACKUP_KEY = 'tornscripture-imm-trader-link-backup-v1';
const UNDO_KEY = 'tornscripture-imm-native-trader-link-undo-v1';
const PENDING_CAPTURE_KEY = 'tornscripture-imm-pending-trader-capture-v1';
const PRICE_RECAPTURE_KEY = 'tornscripture-imm-price-recapture-v1';
const LINK_FIELDS = [
  'pricePageUrl',
  'pricingPageUrl',
  'receiptPageUrl',
  'previousPricePageUrl',
  'pricePageProvider',
  'pricingProvider',
  'pricePageTitle',
  'pricingPageTitle',
  'pricePageItems',
  'pricingItems',
  'pricePageCapturedAt',
  'pricesCapturedAt',
  'pricePageLastCheckedAt',
  'pricePageCaptureCount',
  'pricePageLastChangedCount',
  'pricePageLastResult',
];

function makePriceRecord(id, name, pricePageUrl, unitPrice) {
  return {
    recordId: id,
    name,
    userId: id === 'source-1' ? 101 : 202,
    profileUrl: `https://www.torn.com/profiles.php?XID=${id === 'source-1' ? 101 : 202}`,
    rating: 4,
    targetPercent: 97,
    disposition: 'avoid',
    relationshipRoles: ['supplier'],
    relationshipJournal: [{ id: `${id}-journal`, text: 'synthetic note', createdAt: '2026-01-01T00:00:00.000Z' }],
    recordedTradeHistory: [{ id: `${id}-history`, cash: 12345 }],
    notes: `private fixture note ${id}`,
    updatedAt: '2026-01-02T00:00:00.000Z',
    opaqueExtension: { keep: `${id}-opaque` },
    pricePageUrl,
    previousPricePageUrl: 'https://prices.example.test/previous',
    pricePageProvider: 'weav3r',
    pricePageTitle: `${name} captured list`,
    pricePageItems: [{
      itemId: id === 'source-1' ? 11 : 22,
      itemName: `${name} fixture item`,
      unitPrice,
      sourceText: 'synthetic',
    }],
    pricePageCapturedAt: '2026-01-03T00:00:00.000Z',
    pricePageLastCheckedAt: '2026-01-04T00:00:00.000Z',
    pricePageCaptureCount: 7,
    pricePageLastChangedCount: 2,
    pricePageLastResult: 'changed',
  };
}

function makeStore({ source = makePriceRecord('source-1', 'Source Trader', 'https://prices.example.test/source', 100), destination = makePriceRecord('target-1', 'Target Trader', '', 200), shape = 'object' } = {}) {
  const traders = [source, destination];
  return shape === 'object'
    ? { schema: 'synthetic-trader-book', extension: { preserve: true }, traders }
    : traders;
}

function createEnvironment(options = {}) {
  const initialStore = options.store || makeStore();
  const initialTraderRaw = typeof initialStore === 'string' ? initialStore : JSON.stringify(initialStore);
  const initialLedgerRaw = JSON.stringify({ schema: 'synthetic-ledger', lots: [{ id: 'lot-fixture', remainingQuantity: 3 }], sales: [{ id: 'sale-fixture', cashReceived: 7654 }] });
  const storage = new Map([
    [TRADERS_KEY, initialTraderRaw],
    [LEDGER_KEY, initialLedgerRaw],
    [PRICE_INDEX_KEY, '{"fixture":"index"}'],
    [REPORT_BACKUP_KEY, 'legacy-report-backup-must-not-change'],
    ...(options.extraStorage || []),
  ]);
  const session = new Map(options.sessionStorage || []);
  const elements = new Map();
  const overlay = { id: 'tornscripture-imm-traders', dataset: {}, innerHTML: '', isConnected: true };
  elements.set(overlay.id, overlay);
  if (options.reportEnabled) elements.set('tornscripture-imm-trader-report-style', { id: 'tornscripture-imm-trader-report-style' });
  const events = [];
  const listeners = [];
  const prompts = [];
  const errors = [];
  const failSetKeys = new Set();
  const failRemoveKeys = new Set();
  let confirmHandler = options.confirm || (() => true);
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) {
      if (failSetKeys.has(key)) throw new Error(`synthetic write failure for ${key}`);
      storage.set(key, String(value));
    },
    removeItem(key) {
      if (failRemoveKeys.has(key)) throw new Error(`synthetic remove failure for ${key}`);
      storage.delete(key);
    },
  };
  const sessionStorage = {
    getItem(key) { return session.has(key) ? session.get(key) : null; },
    setItem(key, value) { session.set(key, String(value)); },
    removeItem(key) { session.delete(key); },
  };
  const document = {
    readyState: 'complete',
    getElementById(id) { return elements.get(id) || null; },
    createElement(tagName) { return { tagName, style: {}, dataset: {}, remove() {}, select() {} }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(...args) { listeners.push(args); },
    head: { appendChild() {} },
    body: { appendChild() {} },
  };
  const window = {
    __TSIMM_WATCHLIST_API__: {},
    dispatchEvent(event) { events.push(event); },
    addEventListener() {},
  };
  const context = vm.createContext({
    __TS_IMM_TEST_MODE__: true,
    document,
    window,
    localStorage,
    sessionStorage,
    location: { href: 'https://www.torn.com/index.php', hostname: 'www.torn.com', hash: '' },
    navigator: {},
    URL,
    crypto: crypto.webcrypto,
    TextEncoder,
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    confirm(message) {
      prompts.push(message);
      return confirmHandler(message, environment);
    },
    setConfirm(handler) { confirmHandler = handler; },
    console: { error(...args) { errors.push(args); } },
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    MutationObserver: class { observe() {} disconnect() {} },
  });
  vm.runInContext(source, context, { filename: 'TornScripture-Item-Market-Margin.user.js' });
  const environment = {
    imm: context.__TS_IMM_TEST_EXPORTS__,
    storage,
    session,
    overlay,
    events,
    listeners,
    prompts,
    errors,
    failSetKeys,
    failRemoveKeys,
    setConfirm(handler) { confirmHandler = handler; },
    snapshotStorage() { return [...storage.entries()].sort(([a], [b]) => a.localeCompare(b)); },
    traderRoot() { return JSON.parse(storage.get(TRADERS_KEY)); },
  };
  environment.imm.state.traderUi.activeDealsId = options.activeId || 'source-1';
  environment.imm.state.traderUi.deals.manageOpen = true;
  return environment;
}

function withoutLinkFields(record) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !LINK_FIELDS.includes(key)));
}

test('native Move preserves captured payload, compatibility aliases, and all unrelated records; Undo restores the exact before-image', async () => {
  const sourceRecord = makePriceRecord('source-1', 'Source Trader', 'https://prices.example.test/source', 100);
  sourceRecord.pricingPageUrl = sourceRecord.pricePageUrl;
  sourceRecord.receiptPageUrl = sourceRecord.pricePageUrl;
  sourceRecord.pricingProvider = 'WEAV3R';
  sourceRecord.pricingPageTitle = sourceRecord.pricePageTitle;
  sourceRecord.pricingItems = structuredClone(sourceRecord.pricePageItems);
  sourceRecord.pricesCapturedAt = sourceRecord.pricePageCapturedAt;
  const store = makeStore({ source: sourceRecord, destination: makePriceRecord('target-1', 'Target Trader', '', 200) });
  const env = createEnvironment({ store });
  const beforeRaw = env.storage.get(TRADERS_KEY);
  const before = JSON.parse(beforeRaw);
  const ledgerRaw = env.storage.get(LEDGER_KEY);
  const reportBackup = env.storage.get(REPORT_BACKUP_KEY);
  const linkHtml = env.imm.traderDealsHtml('source-1');
  assert.match(linkHtml, /Manage Link/);
  assert.match(linkHtml, /Move pricelist/);
  assert.match(linkHtml, /Disconnect pricelist/);

  assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), true);
  const after = env.traderRoot();
  const movedSource = after.traders.find((trader) => trader.recordId === 'source-1');
  const movedTarget = after.traders.find((trader) => trader.recordId === 'target-1');
  assert.deepEqual(movedSource, { ...withoutLinkFields(before.traders[0]) });
  assert.deepEqual(withoutLinkFields(movedTarget), withoutLinkFields(before.traders[1]));
  for (const field of LINK_FIELDS) {
    if (Object.hasOwn(sourceRecord, field)) assert.deepEqual(movedTarget[field], sourceRecord[field], `source payload field ${field}`);
    else assert.equal(Object.hasOwn(movedTarget, field), false, `source alias ${field} stays absent`);
  }
  assert.deepEqual(after.extension, before.extension);
  assert.equal(env.storage.get(LEDGER_KEY), ledgerRaw);
  assert.equal(env.storage.get(REPORT_BACKUP_KEY), reportBackup);
  assert.equal(env.storage.has(PRICE_INDEX_KEY), false);
  assert.ok(env.storage.has(UNDO_KEY));
  const savedUndo = JSON.parse(env.storage.get(UNDO_KEY));
  assert.match(savedUndo.beforeSha256, /^[a-f0-9]{64}$/);
  assert.match(savedUndo.afterSha256, /^[a-f0-9]{64}$/);
  assert.equal(env.events.length, 1);
  assert.match(env.imm.state.traderUi.deals.linkMessage, /Pricelist moved/);

  assert.equal(await env.imm.undoTraderPricelistLink(), true);
  assert.equal(env.storage.get(TRADERS_KEY), beforeRaw);
  assert.equal(env.storage.has(UNDO_KEY), false);
  assert.equal(env.storage.get(LEDGER_KEY), ledgerRaw);
  assert.equal(env.storage.get(REPORT_BACKUP_KEY), reportBackup);
  assert.equal(env.events.length, 2);
  assert.equal(await env.imm.undoTraderPricelistLink(), false);
  assert.equal(env.storage.get(TRADERS_KEY), beforeRaw);
});

test('native Move previews and replaces a populated destination without changing its unrelated fields', async () => {
  const source = makePriceRecord('source-1', 'Source Trader', 'https://prices.example.test/source', 100);
  const destination = makePriceRecord('target-1', 'Target Trader', 'https://prices.example.test/old-target', 200);
  const env = createEnvironment({ store: makeStore({ source, destination }) });
  const originalDestination = JSON.parse(JSON.stringify(destination));

  assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), true);
  assert.match(env.prompts[0], /Target Trader/);
  assert.match(env.prompts[0], /replaces 1 captured prices/);
  const result = env.traderRoot().traders.find((trader) => trader.recordId === 'target-1');
  assert.deepEqual(withoutLinkFields(result), withoutLinkFields(originalDestination));
  assert.equal(result.pricePageUrl, source.pricePageUrl);
  assert.equal(result.previousPricePageUrl, source.previousPricePageUrl);
});

test('Disconnect cancellation changes no storage; confirmed Disconnect changes only link fields and is undoable', async () => {
  const env = createEnvironment({ confirm: () => false });
  const before = env.snapshotStorage();
  assert.equal(await env.imm.disconnectTraderPricelist('source-1'), false);
  assert.deepEqual(env.snapshotStorage(), before);
  assert.equal(env.prompts.length, 1);

  env.setConfirm(() => true);
  const original = JSON.parse(env.storage.get(TRADERS_KEY));
  const ledgerRaw = env.storage.get(LEDGER_KEY);
  assert.equal(await env.imm.disconnectTraderPricelist('source-1'), true);
  const disconnected = env.traderRoot().traders.find((trader) => trader.recordId === 'source-1');
  assert.deepEqual(disconnected, withoutLinkFields(original.traders[0]));
  assert.deepEqual(withoutLinkFields(disconnected), withoutLinkFields(original.traders[0]));
  assert.equal(env.storage.get(LEDGER_KEY), ledgerRaw);
  assert.equal(env.storage.get(REPORT_BACKUP_KEY), 'legacy-report-backup-must-not-change');
  assert.equal(await env.imm.undoTraderPricelistLink(), true);
  assert.deepEqual(env.traderRoot(), original);
  assert.equal(env.storage.get(LEDGER_KEY), ledgerRaw);
});

test('stale or concurrent edits refuse mutation and Undo without overwriting the changed data', async (t) => {
  await t.test('stale view refuses before confirmation', async () => {
    const env = createEnvironment();
    const changed = env.traderRoot();
    changed.traders[1].notes = 'changed in another tab';
    env.storage.set(TRADERS_KEY, JSON.stringify(changed));
    const before = env.snapshotStorage();
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), false);
    assert.deepEqual(env.snapshotStorage(), before);
    assert.equal(env.prompts.length, 0);
    assert.match(env.imm.state.traderUi.deals.linkMessage, /changed after this view was loaded/);
  });

  await t.test('concurrent edit during confirmation aborts before primary write', async () => {
    const env = createEnvironment({
      confirm(message, current) {
        const changed = current.traderRoot();
        changed.traders[1].notes = 'concurrent confirmation edit';
        current.storage.set(TRADERS_KEY, JSON.stringify(changed));
        return true;
      },
    });
    const ledgerRaw = env.storage.get(LEDGER_KEY);
    const reportBackup = env.storage.get(REPORT_BACKUP_KEY);
    const indexRaw = env.storage.get(PRICE_INDEX_KEY);
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), false);
    assert.equal(env.traderRoot().traders[1].notes, 'concurrent confirmation edit');
    assert.equal(env.storage.has(UNDO_KEY), false);
    assert.equal(env.storage.get(LEDGER_KEY), ledgerRaw);
    assert.equal(env.storage.get(REPORT_BACKUP_KEY), reportBackup);
    assert.equal(env.storage.get(PRICE_INDEX_KEY), indexRaw);
  });

  await t.test('Undo refuses an unrelated edit after a successful operation', async () => {
    const env = createEnvironment();
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), true);
    const edited = env.traderRoot();
    edited.traders[1].notes = 'manual edit after move';
    env.storage.set(TRADERS_KEY, JSON.stringify(edited));
    const afterEdit = env.storage.get(TRADERS_KEY);
    const snapshot = env.storage.get(UNDO_KEY);
    const indexRaw = env.storage.get(PRICE_INDEX_KEY);
    assert.equal(await env.imm.undoTraderPricelistLink(), false);
    assert.equal(env.storage.get(TRADERS_KEY), afterEdit);
    assert.equal(env.storage.get(UNDO_KEY), snapshot);
    assert.equal(env.storage.get(PRICE_INDEX_KEY), indexRaw);
    assert.match(env.imm.state.traderUi.deals.linkMessage, /Undo was refused|changed after this view was loaded/);
  });
});

test('failed recovery and primary writes leave trader data, prior undo, Report backup, and price index unchanged', async (t) => {
  await t.test('failed recovery write aborts before trader mutation', async () => {
    const env = createEnvironment();
    const before = env.snapshotStorage();
    env.failSetKeys.add(UNDO_KEY);
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), false);
    env.failSetKeys.clear();
    assert.deepEqual(env.snapshotStorage(), before);
    assert.match(env.imm.state.traderUi.deals.linkMessage, /could not verify the recovery snapshot/);
  });

  await t.test('failed Trader Book write restores the previous empty undo key', async () => {
    const env = createEnvironment();
    const before = env.snapshotStorage();
    env.failSetKeys.add(TRADERS_KEY);
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), false);
    env.failSetKeys.clear();
    assert.deepEqual(env.snapshotStorage(), before);
    assert.match(env.imm.state.traderUi.deals.linkMessage, /original trader data.*restored/);
  });

  await t.test('failed price-index invalidation rolls back Trader Book and recovery snapshot', async () => {
    const env = createEnvironment();
    const before = env.snapshotStorage();
    env.failRemoveKeys.add(PRICE_INDEX_KEY);
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), false);
    env.failRemoveKeys.clear();
    assert.deepEqual(env.snapshotStorage(), before);
    assert.match(env.imm.state.traderUi.deals.linkMessage, /could not invalidate the trader price-index cache/);
  });

  await t.test('stale prior native snapshot is not silently replaced', async () => {
    const env = createEnvironment();
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), true);
    const snapshot = env.storage.get(UNDO_KEY);
    const edited = env.traderRoot();
    edited.traders[1].notes = 'unrelated edit';
    env.storage.set(TRADERS_KEY, JSON.stringify(edited));
    env.imm.state.traderStorageVersion = env.storage.get(TRADERS_KEY);
    env.imm.state.traderUi.activeDealsId = 'target-1';
    const staleStore = env.storage.get(TRADERS_KEY);
    assert.equal(await env.imm.disconnectTraderPricelist('target-1'), false);
    assert.equal(env.storage.get(TRADERS_KEY), staleStore);
    assert.equal(env.storage.get(UNDO_KEY), snapshot);
    assert.match(env.imm.state.traderUi.deals.linkMessage, /prior native undo snapshot is stale or corrupt/);
  });

  await t.test('corrupt before-image is refused visibly', async () => {
    const env = createEnvironment();
    assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), true);
    const snapshot = JSON.parse(env.storage.get(UNDO_KEY));
    snapshot.beforeRaw = 'not-a-trader-book';
    env.storage.set(UNDO_KEY, JSON.stringify(snapshot));
    const currentRaw = env.storage.get(TRADERS_KEY);
    const changedSnapshot = env.storage.get(UNDO_KEY);
    assert.equal(await env.imm.undoTraderPricelistLink(), false);
    assert.equal(env.storage.get(TRADERS_KEY), currentRaw);
    assert.equal(env.storage.get(UNDO_KEY), changedSnapshot);
    assert.match(env.imm.state.traderUi.deals.linkMessage, /malformed|incomplete|corrupt/i);
  });
});

test('ambiguous identities, malformed payloads, and matching pending capture/recapture fail closed', async (t) => {
  const cases = [
    {
      name: 'duplicate stable ID',
      store: makeStore({
        source: makePriceRecord('same-id', 'Source Trader', 'https://prices.example.test/source', 100),
        destination: makePriceRecord('same-id', 'Target Trader', '', 200),
      }),
    },
    {
      name: 'missing stable ID',
      store: makeStore({
        source: { ...makePriceRecord('source-1', 'Source Trader', 'https://prices.example.test/source', 100), recordId: '', id: 101 },
      }),
      activeId: 'trader-source trader',
    },
    {
      name: 'malformed item collection',
      store: makeStore({
        source: { ...makePriceRecord('source-1', 'Source Trader', 'https://prices.example.test/source', 100), pricePageItems: 'not-an-array' },
      }),
    },
    {
      name: 'pending cross-page capture for source',
      extraStorage: [[PENDING_CAPTURE_KEY, JSON.stringify({
        traderId: 'source-1',
        userId: 101,
        name: 'Source Trader',
        armedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      })]],
    },
    {
      name: 'pending cross-page recapture for destination',
      sessionStorage: [[PRICE_RECAPTURE_KEY, JSON.stringify({
        traderId: 'target-1',
        url: 'https://prices.example.test/target',
        requestedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      })]],
    },
  ];
  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      const env = createEnvironment(fixture);
      const before = env.snapshotStorage();
      assert.equal(await env.imm.moveTraderPricelist(fixture.activeId || 'source-1', 'target-1'), false);
      assert.deepEqual(env.snapshotStorage(), before);
      assert.equal(env.prompts.length, 0);
      assert.match(env.imm.state.traderUi.deals.linkMessage, /stable ID|malformed|pending|ambiguous/i);
    });
  }
});

test('Report co-install retains ownership and its undo backup; native controls stay unavailable', async () => {
  const env = createEnvironment({ reportEnabled: true });
  const before = env.snapshotStorage();
  const html = env.imm.traderDealsHtml('source-1');
  assert.doesNotMatch(html, /data-tsimm-action="trader-link-manage"/);
  assert.doesNotMatch(html, /Undo last native link change/);
  assert.equal(await env.imm.moveTraderPricelist('source-1', 'target-1'), false);
  assert.equal(await env.imm.undoTraderPricelistLink(), false);
  assert.deepEqual(env.snapshotStorage(), before);
  assert.equal(env.storage.get(REPORT_BACKUP_KEY), 'legacy-report-backup-must-not-change');
});

test('Act IV-B branch metadata identifies an isolated test build without live update URLs', () => {
  assert.match(source, /^\/\/ @name\s+TornScripture - Item Market Margin \(Act IV-B Test Build\)$/m);
  assert.match(source, /^\/\/ @namespace\s+https:\/\/github\.com\/KingAeon\/TornScripture\/act-iv-b-test$/m);
  assert.match(source, /^\/\/ @version\s+0\.19\.40$/m);
  assert.doesNotMatch(source, /^\/\/ @(?:downloadURL|updateURL)\b/m);
  assert.match(source, /version: '0\.19\.40'/);
});
