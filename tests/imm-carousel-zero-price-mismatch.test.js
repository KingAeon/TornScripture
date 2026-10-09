const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime, start, trader, K } = require('./helpers/imm-capture-harness.cjs');

test('zero-price mismatched route fails, preserves price provenance and advances exactly once', () => {
  const { torn, memory } = start([trader('queued-trader', 910000001, 'Queued Trader'), trader('next-trader', 910000003, 'Next Trader')]);
  const wrongUrl = new URL(torn.navigations[0]); wrongUrl.pathname = '/pricelist/910000002';
  const page = runtime({ url: wrongUrl.href, clock: torn.clock, pageId: 910000002, pageName: 'Wrong Trader' });
  const old = JSON.parse(memory.get(K.book))[0];
  const failure = page.api.captureProviderAndReturn('weav3r', true);
  assert.equal(failure.outcome, 'identity_mismatch'); assert.equal(failure.items.length, 0);
  assert.equal(JSON.parse(page.window.name.slice('TSIMM_PRICE_BRIDGE:'.length)).type, 'failure');
  assert.equal(page.writes.length, 0); assert.equal(page.navigations.length, 1);
  assert.equal(new URL(page.navigations[0]).hostname, 'www.torn.com');
  const returning = runtime({ memory, clock: torn.clock });
  returning.window.name = page.window.name;
  const notice = returning.api.consumeImportedPriceCapture();
  assert.equal(notice.ok, true); assert.equal(returning.window.name, '');
  const after = JSON.parse(memory.get(K.book))[0];
  for (const field of ['id', 'userId', 'pricePageItems', 'pricePageUrl', 'previousPricePageUrl', 'pricePageCapturedAt', 'pricePageCaptureCount', 'pricePageLastChangedCount']) assert.deepEqual(after[field], old[field], field);
  const queue = JSON.parse(memory.get(K.queue));
  assert.equal(queue.cursor, 1); assert.deepEqual(queue.failed, ['Queued Trader']);
  assert.equal(queue.status, 'ready'); assert.equal(queue.currentTraderId, ''); assert.equal(queue.currentTraderName, '');
  assert.ok([...returning.timers.values()].some(timer => timer.delay === 850));
  const queueBytes = memory.get(K.queue), bookBytes = memory.get(K.book);
  returning.api.continueFavoriteCaptureCarousel(notice);
  assert.equal(memory.get(K.queue), queueBytes); assert.equal(memory.get(K.book), bookBytes);
});

test('matching zero-price page waits without a bridge; validated populated page returns prices without provider-store writes', () => {
  const { torn } = start([trader('queued-trader', 910000001, 'Queued Trader')]);
  const empty = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock, pageId: 910000001, pageName: 'Queued Trader' });
  empty.api.captureProviderAndReturn('weav3r', true);
  assert.equal(empty.navigations.length, 0);
  assert.equal(JSON.parse(empty.window.name.slice('TSIMM_PRICE_BRIDGE:'.length)).type, 'request');
  assert.equal(empty.writes.length, 0); assert.equal(empty.timers.size, 1);
  const loaded = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock, pageId: 910000001, pageName: 'Queued Trader', items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] });
  const success = loaded.api.captureProviderAndReturn('weav3r', true);
  assert.equal(success.outcome, 'captured'); assert.equal(JSON.parse(loaded.window.name.slice('TSIMM_PRICE_BRIDGE:'.length)).type, 'result');
  assert.equal(loaded.navigations.length, 1); assert.equal(loaded.writes.length, 0);
});
