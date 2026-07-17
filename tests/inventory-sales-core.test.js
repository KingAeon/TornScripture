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
