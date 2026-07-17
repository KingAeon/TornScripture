const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const memory = new Map();
global.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
};
global.__TS_ISH_TEST_MODE__ = true;

const scriptPath = path.join(__dirname, '..', 'TornScripture-Inventory-Sales-HUD.user.js');
vm.runInThisContext(fs.readFileSync(scriptPath, 'utf8'), { filename: scriptPath });
const core = global.__TS_ISH_TEST_EXPORTS__;

assert.ok(core, 'test exports should be available');

const normalized = core.normalizeApiItem({
  id: 206,
  amount: 12,
  name: 'Test Plushie',
  type: 'Plushie',
  equipped: false,
});
assert.deepEqual(normalized, {
  itemId: 206,
  name: 'Test Plushie',
  category: 'Plushie',
  amount: 12,
  uid: null,
  equipped: false,
  factionOwned: false,
});

assert.equal(core.isEquipmentCategory('Primary Weapon'), true);
assert.equal(core.isEquipmentCategory('Armor'), true);
assert.equal(core.isEquipmentCategory('Primary'), true);
assert.equal(core.isEquipmentCategory('Secondary'), true);
assert.equal(core.isEquipmentCategory('Melee'), true);
assert.equal(core.isEquipmentCategory('Temporary'), true);
assert.equal(core.isEquipmentCategory('Plushie'), false);
assert.equal(core.isEquipmentItem({ category: 'Unknown', uid: 1234 }), true);
assert.equal(core.isEquipmentItem({ category: 'Flower', uid: null }), false);

const aggregated = core.aggregateInventory([
  core.normalizeApiItem({ id: 1, amount: 2, name: 'Flower', type: 'Flower' }),
  core.normalizeApiItem({ id: 1, amount: 3, name: 'Flower', type: 'Flower' }),
  core.normalizeApiItem({ id: 2, amount: 1, name: 'Sword A', type: 'Melee Weapon', uid: 10 }),
  core.normalizeApiItem({ id: 2, amount: 1, name: 'Sword B', type: 'Melee Weapon', uid: 11 }),
]);
assert.equal(aggregated.find((item) => item.itemId === 1).amount, 5);
assert.equal(aggregated.filter((item) => item.itemId === 2).length, 2);

assert.equal(core.extractInventoryItems({ inventory: { items: [{ id: 1 }] } }).length, 1);
assert.equal(core.extractInventoryTotal({ inventory: { total: 245 } }), 245);

assert.equal(core.INVENTORY_CATEGORIES.length, 25);
assert.equal(new Set(core.INVENTORY_CATEGORIES).size, 25);
assert.ok(core.INVENTORY_CATEGORIES.includes('Flower'));
assert.ok(core.INVENTORY_CATEGORIES.includes('Defensive'));
const inventoryUrl = core.inventoryRequestUrl('Energy Drink', 100);
assert.equal(inventoryUrl.pathname, '/v2/user/inventory');
assert.equal(inventoryUrl.searchParams.get('cat'), 'Energy Drink');
assert.equal(inventoryUrl.searchParams.get('offset'), '100');
assert.equal(inventoryUrl.searchParams.get('limit'), '100');

const catalogUrl = core.catalogRequestUrl([206, 207, 206, 'bad']);
assert.equal(catalogUrl.pathname, '/v2/torn/206,207/items');
const catalogItem = core.normalizeCatalogItem({
  id: 206,
  name: 'Test Plushie',
  type: 'Plushie',
  is_tradable: true,
  circulation: 123456,
  value: {
    vendor: { name: 'Bits n Bobs', country: 'Mexico' },
    buy_price: 800,
    sell_price: 400,
    market_price: 950,
  },
});
assert.deepEqual(catalogItem, {
  itemId: 206,
  name: 'Test Plushie',
  type: 'Plushie',
  marketPrice: 950,
  shopBuyPrice: 800,
  shopSellPrice: 400,
  vendorName: 'Bits n Bobs',
  vendorCountry: 'Mexico',
  isTradable: true,
  circulation: 123456,
});
const cachedCatalog = core.normalizeCatalog({
  updatedAt: '2026-07-17T00:00:00.000Z',
  items: { 206: catalogItem },
});
assert.equal(cachedCatalog.items['206'].marketPrice, 950);
assert.equal(cachedCatalog.items['206'].shopSellPrice, 400);
const mergedPrices = core.mergeItemPrices(
  { marketValue: 100, citySellPrice: 50 },
  catalogItem
);
assert.equal(mergedPrices.marketPrice, 950);
assert.equal(mergedPrices.shopSellPrice, 400);
assert.equal(mergedPrices.shopBuyPrice, 800);
const fallbackPrices = core.mergeItemPrices({ marketValue: 100, citySellPrice: 50 }, null);
assert.equal(fallbackPrices.marketPrice, 100);
assert.equal(fallbackPrices.shopSellPrice, 50);

assert.equal(core.shouldRecommendStore({ marketPrice: 2924, shopSellPrice: 3100 }), true);
assert.equal(core.shouldRecommendStore({ marketPrice: 0, shopSellPrice: 5 }), true);
assert.equal(core.shouldRecommendStore({ marketPrice: null, shopSellPrice: 5 }), true);
assert.equal(core.shouldRecommendStore({ marketPrice: 938, shopSellPrice: 5 }), false);
assert.equal(core.shouldRecommendStore({ marketPrice: 3100, shopSellPrice: 3100 }), false);
assert.equal(core.shouldRecommendStore({ marketPrice: 0, shopSellPrice: 0 }), false);

const config = core.normalizePriceConfig({
  schema: 'tornscripture-trader-prices',
  schemaVersion: 1,
  traders: [{ id: 'a', name: 'Trader A' }],
  items: { 1: { traderPrices: { a: 100 } } },
});
assert.equal(config.traders[0].active, true);
assert.equal(config.items['1'].traderPrices.a, 100);
assert.equal(core.isPriceConfig(config), true);
assert.equal(core.isPriceConfig({ schema: 'other', traders: [], items: {} }), false);

console.log('Inventory Sales HUD core tests passed.');
