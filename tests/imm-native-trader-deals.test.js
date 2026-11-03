const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const immSource = fs.readFileSync(path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(__dirname, '..', 'TornScripture-IMM-Trader-Report.user.js'), 'utf8');
const reportStyleId = 'tornscripture-imm-trader-report-style';

function createImm() {
  const elements = new Map();
  const timers = [];
  const clipboardWrites = [];
  const overlay = {
    dataset: {},
    innerHTML: '',
    isConnected: true,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    remove() {
      this.isConnected = false;
      elements.delete('tornscripture-imm-traders');
    },
  };
  elements.set('tornscripture-imm-traders', overlay);
  const context = vm.createContext({
    __TS_IMM_TEST_MODE__: true,
    document: {
      getElementById(id) { return elements.get(id) || null; },
      createElement() {
        return {
          style: {},
          remove() {},
          select() {},
        };
      },
      querySelector() { return null; },
      body: { appendChild() {} },
    },
    window: { __TSIMM_WATCHLIST_API__: {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { href: 'https://www.torn.com/index.php', hostname: 'www.torn.com', hash: '' },
    navigator: { clipboard: { async writeText(value) { clipboardWrites.push(value); } } },
    setTimeout(callback) { timers.push(callback); return timers.length; },
    clearTimeout() {},
    MutationObserver: class { observe() {} disconnect() {} },
    console: { error() {} },
  });
  vm.runInContext(immSource, context, { filename: 'TornScripture-Item-Market-Margin.user.js' });
  return { imm: context.__TS_IMM_TEST_EXPORTS__, elements, overlay, timers, clipboardWrites };
}

function makeTrader(id, name, pricePageItems = []) {
  return {
    id,
    name,
    normalizedName: name.toLowerCase(),
    userId: 101,
    rating: 0,
    targetPercent: 99,
    profileUrl: '',
    tradeUrl: '',
    bannerUrl: '',
    pricePageUrl: '',
    pricePageItems,
    pricePageLastCheckedAt: null,
    pricePageCapturedAt: null,
    pricePageLastChangedCount: 0,
    pricePageProvider: '',
    pricePageTitle: '',
    pricePageCaptureCount: 0,
    pricePageLastResult: '',
    disposition: 'normal',
    hiddenFromDisposition: 'normal',
    avoidReasons: [],
    relationshipRoles: [],
    relationshipJournal: [],
    notes: '',
  };
}

function setTraderData(imm, trader, catalogItems = [], lots = []) {
  imm.state.traders = [trader];
  imm.state.catalog = {
    itemsById: Object.fromEntries(catalogItems.map((item) => [String(item.id), {
      id: item.id,
      name: item.name,
      marketPrice: item.marketPrice,
    }])),
    itemsByName: Object.fromEntries(catalogItems.map((item) => [item.name.toLowerCase(), {
      id: item.id,
      name: item.name,
      marketPrice: item.marketPrice,
    }])),
  };
  imm.state.ledger = { lots, sales: [] };
}

function createReportOracle(trader, catalogItems, lots) {
  const storage = new Map([
    ['tornscripture-imm-traders-v1', JSON.stringify([trader])],
    ['tornscripture-imm-catalog-v1', JSON.stringify({ items: Object.fromEntries(catalogItems.map((item) => [String(item.id), item])) })],
    ['tornscripture-ish-torn-catalog-v1', '{}'],
    ['tornscripture-imm-ledger-v1', JSON.stringify({ lots, sales: [] })],
    ['tornscripture-imm-report-addon-settings-v1', '{}'],
  ]);
  const injected = reportSource.replace(
    '  function boot() {',
    '  globalThis.__TS_REPORT_TEST_API__ = { refreshData, reportRows, countRows, traders: () => traders };\n  function boot() {',
  );
  assert.notEqual(injected, reportSource, 'Report oracle test hook should be inserted');
  const context = vm.createContext({
    localStorage: { getItem(key) { return storage.get(key) ?? null; } },
  });
  vm.runInContext(injected, context, { filename: 'TornScripture-IMM-Trader-Report.user.js' });
  const report = context.__TS_REPORT_TEST_API__;
  report.refreshData(true);
  return { report, trader: report.traders()[0] };
}

test('native Deals matches Report v0.2.4 calculations on a 340-price fixture', () => {
  const fixtureItems = Array.from({ length: 340 }, (_, index) => {
    const bucket = Math.floor(index / 68);
    const unitPrice = [1000, 990, 970, 969, 500][bucket];
    return { itemId: index + 1, itemName: `Fixture ${index + 1}`, unitPrice };
  });
  const catalogItems = fixtureItems.slice(0, 272).map((item) => ({
    id: item.itemId,
    name: item.itemName,
    marketPrice: 1000,
  }));
  const lots = fixtureItems.filter((_, index) => index % 10 === 0).map((item) => ({
    itemId: item.itemId,
    itemName: item.itemName,
    remainingQuantity: 2,
    unitCost: 400,
  }));
  const trader = { recordId: 'fixture-trader', name: 'Fixture Trader', userId: 101, pricePageItems: fixtureItems };
  const { imm } = createImm();
  const nativeTrader = makeTrader('fixture-trader', trader.name, fixtureItems);
  setTraderData(imm, nativeTrader, catalogItems, lots);

  const nativeRows = imm.traderDealsRows(nativeTrader);
  const nativeCounts = imm.traderDealsCounts(nativeRows);
  const dealsView = imm.traderDealsHtml(nativeTrader.id);
  assert.match(dealsView, /Load 4 more/);
  assert.match(dealsView, /VS 99% ROUTE/);
  imm.state.traderUi.deals.controlsOpen = true;
  assert.match(imm.traderDealsHtml(nativeTrader.id), /Show all 340/);
  assert.match(imm.traderDealsHtml(nativeTrader.id), /Unknown market 68/);
  const { report, trader: reportTrader } = createReportOracle(trader, catalogItems, lots);
  const reportRows = report.reportRows(reportTrader);
  const reportCounts = report.countRows(reportRows);

  assert.equal(nativeRows.length, 340);
  assert.deepEqual(
    { all: nativeCounts.all, deals: nativeCounts.deals, premium: nativeCounts.premium, strong: nativeCounts.strong, near: nativeCounts.near, withhold: nativeCounts.withhold, unknown: nativeCounts.unknown, owned: nativeCounts.owned },
    { all: reportCounts.all, deals: reportCounts.deals, premium: reportCounts.premium, strong: reportCounts.strong, near: reportCounts.near, withhold: reportCounts.withhold, unknown: reportCounts.unknown, owned: reportCounts.owned },
  );
  for (let index = 0; index < nativeRows.length; index += 1) {
    const native = nativeRows[index];
    const reference = reportRows[index];
    assert.equal(native.bucket, reference.bucket, `bucket parity for row ${index}`);
    assert.equal(native.percent, reference.percent, `payout parity for row ${index}`);
    assert.equal(native.differenceVsMarket, reference.differenceVsMarket, `market delta parity for row ${index}`);
    assert.equal(native.differenceVs99, reference.differenceVs99, `99% route parity for row ${index}`);
    assert.equal(native.owned, reference.owned, `owned parity for row ${index}`);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(nativeCounts)),
    { all: 340, deals: 204, premium: 68, strong: 68, near: 68, withhold: 68, unknown: 68, owned: 34 },
  );
});

test('native Deals handles bucket boundaries, configurable near floor, and zero or missing market values', () => {
  const { imm } = createImm();
  const trader = makeTrader('boundary-trader', 'Boundary Trader', [
    { itemId: 1, itemName: 'Premium', unitPrice: 1000 },
    { itemId: 2, itemName: 'Strong', unitPrice: 990 },
    { itemId: 3, itemName: 'Near', unitPrice: 970 },
    { itemId: 4, itemName: 'Withhold', unitPrice: 969 },
    { itemId: 5, itemName: 'No market', unitPrice: 50 },
    { itemId: 6, itemName: 'Zero price', unitPrice: 0 },
  ]);
  setTraderData(imm, trader, [
    { id: 1, name: 'Premium', marketPrice: 1000 },
    { id: 2, name: 'Strong', marketPrice: 1000 },
    { id: 3, name: 'Near', marketPrice: 1000 },
    { id: 4, name: 'Withhold', marketPrice: 1000 },
    { id: 5, name: 'No market', marketPrice: 0 },
    { id: 6, name: 'Zero price', marketPrice: 1000 },
  ]);

  const rows = imm.traderDealsRows(trader);
  assert.deepEqual(rows.map((row) => row.bucket), ['premium', 'strong', 'near', 'withhold', 'unknown']);
  assert.equal(rows.find((row) => row.itemName === 'Near').percent, 97);

  imm.state.traderUi.deals.nearFloor = 98;
  assert.equal(imm.traderDealsRows(trader).find((row) => row.itemName === 'Near').bucket, 'withhold');
  assert.equal(imm.traderDealsRows(trader).find((row) => row.itemName === 'No market').percent, null);
});

test('OWNED filters intersect the selected bucket and search, sort, copy, and price-list links stay view-local', async () => {
  const { imm, clipboardWrites } = createImm();
  const trader = makeTrader('filters', 'Filters', [
    { itemId: 1, itemName: 'Alpha Apple', unitPrice: 1000 },
    { itemId: 2, itemName: 'Beta Pear', unitPrice: 990 },
    { itemId: 3, itemName: 'Beta Peach', unitPrice: 970 },
    { itemId: 4, itemName: 'Beta Plum', unitPrice: 960 },
    { itemId: 5, itemName: 'Beta Unknown', unitPrice: 500 },
  ]);
  trader.pricePageUrl = 'https://example.test/trader-prices';
  setTraderData(imm, trader, [
    { id: 1, name: 'Alpha Apple', marketPrice: 1000 },
    { id: 2, name: 'Beta Pear', marketPrice: 1000 },
    { id: 3, name: 'Beta Peach', marketPrice: 1000 },
    { id: 4, name: 'Beta Plum', marketPrice: 1000 },
  ], [
    { itemId: 1, itemName: 'Alpha Apple', remainingQuantity: 1 },
    { itemId: 3, itemName: 'Beta Peach', remainingQuantity: 2 },
    { itemId: 4, itemName: 'Beta Plum', remainingQuantity: 3 },
    { itemId: 5, itemName: 'Beta Unknown', remainingQuantity: 4 },
  ]);

  const rows = imm.traderDealsRows(trader);
  imm.state.traderUi.deals.bucket = 'deals';
  imm.state.traderUi.deals.ownedOnly = true;
  assert.deepEqual(
    JSON.parse(JSON.stringify(imm.filteredTraderDealsRows(rows).map((row) => row.itemName))),
    ['Alpha Apple', 'Beta Peach'],
  );
  imm.state.traderUi.deals.bucket = 'all';
  imm.state.traderUi.deals.ownedOnly = false;
  imm.state.traderUi.deals.search = 'beta';
  imm.state.traderUi.deals.sort = 'price';
  assert.deepEqual(
    JSON.parse(JSON.stringify(imm.filteredTraderDealsRows(rows).map((row) => row.itemName))),
    ['Beta Pear', 'Beta Peach', 'Beta Plum', 'Beta Unknown'],
  );
  assert.match(imm.traderDealsHtml('filters'), /OWNED 2 · EST\. RETURN/);
  assert.match(imm.traderDealsHtml('filters'), /not Ledger profit/);
  assert.match(imm.traderDealsHtml('filters'), /href="https:\/\/example\.test\/trader-prices">Open price list/);
  imm.state.traderUi.activeDealsId = trader.id;
  await imm.copyTraderDeals();
  assert.equal(clipboardWrites.length, 1);
  assert.match(clipboardWrites[0], /Beta Pear/);
  assert.doesNotMatch(clipboardWrites[0], /Alpha Apple/);
});

test('native Deals uses stable trader IDs and fails visibly for missing traders or prices', () => {
  const { imm, overlay } = createImm();
  const first = makeTrader('stable-one', 'Same Name', [{ itemId: 1, itemName: 'First item', unitPrice: 10 }]);
  const second = makeTrader('stable-two', 'Same Name', [{ itemId: 2, itemName: 'Second item', unitPrice: 20 }]);
  setTraderData(imm, first, [
    { id: 1, name: 'First item', marketPrice: 10 },
    { id: 2, name: 'Second item', marketPrice: 20 },
  ]);
  imm.state.traders.push(second);

  imm.openTraderDeals('stable-two');
  assert.match(overlay.innerHTML, /Second item/);
  assert.doesNotMatch(overlay.innerHTML, /First item/);
  imm.openTraderDeals('missing-id');
  assert.match(overlay.innerHTML, /could not be resolved by its stable ID/);
  imm.openTraderDeals('stable-one');
  imm.state.traders[0].pricePageItems = [];
  imm.openTraderDeals('stable-one');
  assert.match(overlay.innerHTML, /No saved price-page rows are available/);
});

test('compact and detailed Trader Book modes use one native control and can back out without duplicate rendering', () => {
  const { imm, overlay, elements, timers } = createImm();
  let currentOverlay = overlay;
  const trader = makeTrader('nav-trader', 'Navigation Trader', [{ itemId: 1, itemName: 'Xanax', unitPrice: 990 }]);
  setTraderData(imm, trader);

  for (const mode of ['compact', 'detailed']) {
    imm.state.traderUi.mode = mode;
    const card = mode === 'compact' ? imm.traderCompactRowHtml(trader) : imm.traderCardHtml(trader);
    assert.equal((card.match(/data-tsimm-action="trader-deals-open"/g) || []).length, 1);
    imm.openTraderDeals(trader.id);
    assert.match(currentOverlay.innerHTML, /Trader Deals · Navigation Trader/);
    assert.equal(imm.state.traderUi.activeDealsId, trader.id);
    const timerCount = timers.length;
    imm.renderTraders();
    assert.equal(timers.length, timerCount);
    assert.equal((currentOverlay.innerHTML.match(/data-tsimm-action="trader-deals-back"/g) || []).length, 1);
    imm.closeTraderDeals();
    assert.equal(imm.state.traderUi.activeDealsId, '');
    assert.match(currentOverlay.innerHTML, /GOBLIN GOD Trader Book/);
    assert.equal((currentOverlay.innerHTML.match(/data-tsimm-action="trader-deals-open"/g) || []).length, 1);
    imm.openTraderDeals(trader.id);
    imm.closeTraders();
    assert.equal(imm.state.traderUi.activeDealsId, '');
    const reopened = {
      dataset: {},
      innerHTML: '',
      isConnected: true,
      querySelector() { return null; },
      querySelectorAll() { return []; },
      remove() {
        this.isConnected = false;
        elements.delete('tornscripture-imm-traders');
      },
    };
    elements.set('tornscripture-imm-traders', reopened);
    imm.renderTraders();
    assert.match(reopened.innerHTML, /GOBLIN GOD Trader Book/);
    assert.doesNotMatch(reopened.innerHTML, /Trader Deals · Navigation Trader/);
    currentOverlay = reopened;
  }
});

test('Report v0.2.4 remains the sole Deals control when its existing style marker is present', () => {
  const { imm, elements, overlay } = createImm();
  const trader = makeTrader('coexist-trader', 'Coexist Trader', [{ itemId: 1, itemName: 'Xanax', unitPrice: 990 }]);
  setTraderData(imm, trader);
  assert.match(reportSource, /^\/\/ @version\s+0\.2\.4$/m);
  assert.match(reportSource, new RegExp(`styleId: '${reportStyleId}'`));
  assert.notEqual(imm.traderDealsButtonHtml(trader), '');
  assert.match(imm.traderDealsButtonHtml(trader), /data-tsimm-deals-open="1"/);

  elements.set(reportStyleId, { id: reportStyleId });
  assert.equal(imm.traderDealsAddonActive(), true);
  assert.equal(imm.traderDealsButtonHtml(trader), '');
  imm.openTraderDeals(trader.id);
  assert.equal(imm.state.traderUi.activeDealsId, '');
  assert.doesNotMatch(overlay.innerHTML, /Trader Deals · Coexist Trader/);
  assert.doesNotMatch(imm.traderCompactRowHtml(trader), /data-tsimm-action="trader-deals-open"/);
  assert.doesNotMatch(imm.traderCardHtml(trader), /data-tsimm-action="trader-deals-open"/);
});
