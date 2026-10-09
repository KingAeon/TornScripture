const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime, start, trader, K } = require('./helpers/imm-capture-harness.cjs');

// PR #91 assertions retained through the full production runtime. Under v2.2 a
// preview cannot publish the former provisional bridge; final validation owns it.
test('Weav3r numeric route precedes unrelated profile links and captures 307 prices exactly once', () => {
  const expectedId = 910000001;
  const saved = trader('queued-trader', expectedId, 'Queued Trader');
  saved.pricePageItems = []; saved.pricePageCaptureCount = 0;
  const { torn, memory } = start([saved]);
  const items = Array.from({ length: 307 }, (_, index) => ({ itemId: index + 1, itemName: `Fixture Item ${index + 1}`, unitPrice: 1000 + index }));
  const page = runtime({ url: torn.navigations[0], clock: torn.clock, pageId: expectedId, pageName: saved.name, items });
  const request = page.api.captureRequestFromWeav3rPage();
  const identity = page.api.weav3rTraderIdentity();
  assert.equal(identity.userId, expectedId);
  assert.equal(identity.name, saved.name);
  assert.equal(identity.profileUrl, `https://www.torn.com/profiles.php?XID=${expectedId}`);
  assert.notEqual(identity.profileUrl, 'https://www.torn.com/profiles.php?XID=99999');
  assert.match(identity.tradeUrl, new RegExp(`userID=${expectedId}$`));
  assert.equal(page.api.weav3rCaptureIdentityMismatch(request, identity, page.window.location.href), null);
  const preview = page.api.createWeav3rCaptureResult();
  assert.equal(preview.mismatch, null); assert.equal(preview.result.items.length, 307);
  assert.equal(page.window.name, '', 'preview must not produce a consumable result');
  assert.match(page.api.weav3rCaptureIdentityMismatch(request, { ...identity, userId: 910000002 }, 'https://weav3r.dev/pricelist/910000002').reason, /Saved URL points to Torn ID/);
  const success = page.api.captureProviderAndReturn('weav3r', true);
  assert.equal(success.outcome, 'captured'); assert.equal(success.items.length, 307);
  assert.equal(JSON.parse(page.window.name.slice('TSIMM_PRICE_BRIDGE:'.length)).type, 'result');
  assert.equal(page.navigations.length, 1); assert.equal(page.writes.length, 0);
  const ledger = memory.get(K.ledger);
  const returned = runtime({ url: page.navigations[0], memory, clock: torn.clock, testMode: false });
  const stored = JSON.parse(memory.get(K.book));
  assert.equal(stored.length, 1); assert.equal(stored[0].id, saved.id); assert.equal(stored[0].userId, expectedId);
  assert.equal(stored[0].pricePageItems.length, 307); assert.equal(stored[0].pricePageUrl, saved.pricePageUrl);
  assert.equal(stored[0].pricePageCaptureCount, 1);
  assert.equal(returned.writes.filter(([key]) => key === K.book).length, 1);
  assert.equal(returned.navigations.length, 1); assert.equal(returned.session.has(K.notice), true);
  assert.equal(memory.get(K.ledger), ledger);
  const before = memory.get(K.book);
  runtime({ url: page.navigations[0], memory, clock: torn.clock, testMode: false });
  assert.equal(memory.get(K.book), before, 'replayed early import cannot replace prices twice');
});
