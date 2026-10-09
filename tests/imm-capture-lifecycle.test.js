const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime, start, result, trader, K, Element } = require('./helpers/imm-capture-harness.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const prices = [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }];
function importUrl(api, payload) {
  const compact = api.compactPriceCaptureResult(payload);
  return 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(compact)).toString('base64url');
}
function current(memory) { return JSON.parse(memory.get(K.queue)); }
function book(memory) { return JSON.parse(memory.get(K.book)); }

test('Torn persists exact A and readbacks it before provider navigation; provider storage is isolated', () => {
  const { torn, envelope, memory } = start();
  assert.equal(current(memory).entries[0].attemptsUsed, 1);
  assert.equal(torn.navigations.length, 1);
  const provider = runtime({ url: torn.navigations[0], clock: torn.clock });
  assert.equal(provider.memory.has(K.queue), false);
  assert.deepEqual(clone(provider.api.captureRequestFromWeav3rPage().envelope), envelope);
  assert.equal(provider.api.captureStoreContext().queue, null);
});

test('A inconclusive deadline returns no-price checkpoint; only Torn persists B; B is final', () => {
  const { torn, envelope, memory } = start();
  const provider = runtime({ url: torn.navigations[0], clock: torn.clock });
  assert.equal(provider.api.captureProviderAndReturn('weav3r', true), null);
  assert.equal(provider.timers.size, 1);
  provider.fireDeadline();
  const bridge = JSON.parse(provider.window.name.slice('TSIMM_PRICE_BRIDGE:'.length));
  assert.equal(bridge.compact.o, 'retry_needed');
  assert.equal(bridge.compact.e.attemptId, envelope.attemptId);
  assert.equal(bridge.compact.i.length, 0);
  assert.equal(provider.memory.has(K.queue), false);
  const before = memory.get(K.book);
  const checkpoint = torn.api.expandPriceCaptureResult(bridge.compact);
  const notice = torn.api.persistCaptureImport(checkpoint);
  assert.equal(notice.ok, true); assert.equal(memory.get(K.book), before);
  torn.api.continueFavoriteCaptureCarousel(notice);
  const B = current(memory).entries[0];
  assert.equal(B.attemptsUsed, 2); assert.notEqual(B.attemptId, envelope.attemptId);
  assert.equal(torn.navigations.length, 2);
  const Bbytes = memory.get(K.queue);
  torn.api.continueFavoriteCaptureCarousel(notice);
  assert.equal(memory.get(K.queue), Bbytes); assert.equal(torn.navigations.length, 2);
  const finalPage = runtime({ url: torn.navigations[1], clock: torn.clock });
  finalPage.api.captureProviderAndReturn('weav3r', true); finalPage.fireDeadline();
  const final = finalPage.api.expandPriceCaptureResult(JSON.parse(finalPage.window.name.slice('TSIMM_PRICE_BRIDGE:'.length)).compact);
  assert.equal(final.outcome, 'timeout'); assert.equal(final.envelope.attemptId, B.attemptId);
  assert.equal(torn.api.persistCaptureImport(result(B.envelope, { outcome: 'retry_needed', items: [], producedAt: torn.clock.now })).ok, false);
  const finalNotice = torn.api.persistCaptureImport(final); assert.equal(finalNotice.ok, true);
  torn.api.continueFavoriteCaptureCarousel(finalNotice);
  assert.equal(memory.has(K.queue), false); assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].outcome, 'timeout');
  assert.equal(book(memory)[0].pricePageItems[0].unitPrice, 500);
});

test('lost A handoff permits explicit B once; lost B result never resets allowance after restart', () => {
  const { torn, memory, envelope } = start();
  torn.clock.now += 120000;
  const restarted = runtime({ memory, clock: torn.clock });
  assert.equal(restarted.navigations.length, 0);
  assert.equal(current(memory).entries[0].attemptId, envelope.attemptId);
  assert.equal(restarted.api.launchFavoriteCaptureCarousel(), true);
  const B = current(memory).entries[0]; assert.equal(B.attemptsUsed, 2);
  const anotherRestart = runtime({ memory, clock: torn.clock });
  assert.equal(anotherRestart.api.launchFavoriteCaptureCarousel(), false);
  assert.equal(anotherRestart.navigations.length, 0);
  assert.equal(current(memory).entries[0].attemptId, B.attemptId);
});

for (const field of ['runId', 'entryId', 'attemptId', 'traderRecordId', 'expectedTornId', 'provider', 'sourceUrl', 'issuedAt', 'deadline', 'expiresAt']) {
  test(`corrupt ${field} is rejected before early, late and direct price writes`, () => {
    for (const path of ['early', 'late', 'save']) {
      const { torn, envelope, memory } = start(); torn.clock.now += 1000;
      const payload = result(envelope); payload.envelope = { ...envelope, [field]: typeof envelope[field] === 'number' ? envelope[field] + 1 : 'unrelated' };
      const beforeBook = memory.get(K.book), beforeQueue = memory.get(K.queue), ledger = memory.get(K.ledger);
      if (path === 'early') runtime({ memory, clock: torn.clock, url: importUrl(torn.api, payload), testMode: false });
      else if (path === 'late') { torn.setUrl(importUrl(torn.api, payload)); torn.api.consumeImportedPriceCapture(); }
      else torn.api.saveTraderPriceCapture(null, { captureResult: payload });
      assert.equal(memory.get(K.book), beforeBook, path); assert.equal(memory.get(K.queue), beforeQueue, path); assert.equal(memory.get(K.ledger), ledger, path);
    }
  });
}

test('late A success after B, old-run replay, manual collision, legacy v1 and spoofed window.name do not write', () => {
  const { torn, envelope, memory } = start(); torn.clock.now += 1000;
  const A = result(envelope);
  torn.api.launchFavoriteCaptureCarousel();
  const before = memory.get(K.book), B = memory.get(K.queue);
  assert.equal(torn.api.persistCaptureImport(A).ok, false);
  assert.equal(memory.get(K.queue), B);
  const manual = { ...A, envelope: { ...envelope, intent: 'manual' } };
  assert.equal(torn.api.persistCaptureImport(manual, true).ok, false);
  const legacy = { ...A, envelope: null }; assert.equal(torn.api.persistCaptureImport(legacy).ok, false);
  torn.window.name = 'TSIMM_PRICE_BRIDGE:' + JSON.stringify({ type: 'result', compact: { v: 1, t: { userId: 2321305 }, i: [[1, 9999999]] } });
  torn.api.consumeImportedPriceCapture(); assert.equal(memory.get(K.book), before);
  torn.api.cancelFavoriteCaptureCarousel(); torn.api.startSavedTraderCaptureCarousel('all'); torn.api.launchFavoriteCaptureCarousel();
  const newBook = memory.get(K.book), newQueue = memory.get(K.queue), summary = memory.get(K.result);
  assert.equal(torn.api.persistCaptureImport(A).ok, false); assert.equal(memory.get(K.book), newBook); assert.equal(memory.get(K.queue), newQueue); assert.equal(memory.get(K.result), summary);
});

test('capture completion is exactly once; lost completion notice recovers committed receipt without a new price write', () => {
  const { torn, envelope, memory } = start([trader(), trader('c', 2321306, 'Next')]); torn.clock.now += 1000;
  const payload = result(envelope), notice = torn.api.persistCaptureImport(payload);
  const after = memory.get(K.book);
  assert.equal(notice.ok, true); assert.equal(torn.api.persistCaptureImport(payload).ok, false);
  const restarted = runtime({ memory, clock: torn.clock });
  restarted.api.continueFavoriteCaptureCarousel(null);
  assert.equal(current(memory).cursor, 1); assert.equal(memory.get(K.book), after);
  const q = memory.get(K.queue); restarted.api.continueFavoriteCaptureCarousel(notice);
  assert.equal(memory.get(K.queue), q); assert.equal(book(memory)[0].pricePageCaptureCount, 8);
});

for (const fault of ['set', 'readback']) {
  test(`queue ${fault} failure blocks A and B navigation; trader ${fault} failure blocks completion`, () => {
    const t = runtime({ memory: new Map([[K.book, JSON.stringify([trader()])]]) });
    t.api.startSavedTraderCaptureCarousel('all'); t.faults[fault] = K.queue;
    assert.equal(t.api.launchFavoriteCaptureCarousel(), false); assert.equal(t.navigations.length, 0);
    const { torn, memory, envelope } = start();
    const oldQueue = memory.get(K.queue); torn.faults[fault] = K.queue;
    assert.equal(torn.api.launchFavoriteCaptureCarousel(), false); assert.equal(torn.navigations.length, 1);
    torn.faults[fault] = null; assert.equal(memory.get(K.queue), oldQueue);
    torn.clock.now += 1000; torn.faults[fault] = K.book;
    const oldBook = memory.get(K.book); assert.equal(torn.api.persistCaptureImport(result(envelope)).ok, false);
    assert.equal(memory.get(K.book), oldBook); assert.equal(memory.get(K.queue), oldQueue);
  });
}

test('provider reload retains issuance deadline; inactive page tears down; unrelated/expired route never navigates', () => {
  const { torn, envelope } = start(); torn.clock.now += 59000;
  const p = runtime({ url: torn.navigations[0], clock: torn.clock });
  p.api.captureProviderAndReturn('weav3r', true);
  assert.equal([...p.timers.values()][0].delay, 1000);
  p.api.stopProviderCapture(); assert.equal(p.timers.size, 0);
  const unsupported = runtime({ url: 'https://weav3r.dev/unrelated', name: torn.window.name, clock: torn.clock });
  unsupported.api.captureProviderAndReturn('weav3r', true); assert.equal(unsupported.navigations.length, 0);
  torn.clock.now = envelope.expiresAt + 1;
  const expired = runtime({ url: torn.navigations[0], clock: torn.clock });
  expired.api.captureProviderAndReturn('weav3r', true); assert.equal(expired.navigations.length, 0);
});

test('after-deadline parse is refused; bounded completion may be delivered within TTL without renewing capture time', () => {
  const { torn, envelope, memory } = start(); torn.clock.now = envelope.deadline + 1000;
  const page = runtime({ url: torn.navigations[0], clock: torn.clock, items: prices });
  assert.equal(page.api.createWeav3rCaptureResult().result.items.length, 0);
  const before = memory.get(K.book);
  assert.equal(torn.api.persistCaptureImport(result(envelope, { producedAt: envelope.deadline + 1 })).ok, false);
  assert.equal(memory.get(K.book), before);
  const bounded = torn.api.persistCaptureImport(result(envelope, { producedAt: envelope.deadline - 1 }));
  assert.equal(bounded.ok, true); assert.equal(book(memory)[0].pricePageCapturedAt, new Date(envelope.deadline - 1).toISOString());
});

test('TornExchange no carrier is manual-only; copied ID is not proof; supported independent Profile succeeds conditionally', () => {
  const t = trader(); t.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
  const { torn } = start([t]);
  const lost = runtime({ url: torn.navigations[0], clock: torn.clock, items: prices });
  assert.equal(lost.api.tornExchangeCaptureRequest(), null);
  lost.api.captureProviderAndReturn('tornexchange', true); assert.equal(lost.navigations.length, 0);
  const unknown = runtime({ url: torn.navigations[0], name: torn.window.name, pageId: null, clock: torn.clock, items: prices });
  assert.equal(unknown.api.tornExchangeTraderIdentity().userId, null);
  assert.equal(unknown.api.createTornExchangeCaptureResult().result.items.length, 1);
  assert.match(unknown.window.name, /"type":"request"/);
  const failed = unknown.api.captureProviderAndReturn('tornexchange', true); assert.equal(failed.outcome, 'identity_mismatch');
  const verified = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock, items: prices });
  const success = verified.api.captureProviderAndReturn('tornexchange', true); assert.equal(success.outcome, 'captured');
  assert.equal(success.evidence.kind, 'tornexchange-profile');
});

test('direct unarmed manual capture has fresh intent, visible target confirmations, independent identity and replay protection', () => {
  const p = runtime({ url: 'https://weav3r.dev/pricelist/2321305', items: prices });
  const captured = p.api.captureProviderAndReturn('weav3r', false); assert.equal(captured.envelope.intent, 'manual');
  const t = runtime({ url: p.navigations[0], clock: p.clock });
  t.api.consumeImportedPriceCapture(); assert.equal(book(t.memory)[0].userId, 2321305);
  const before = t.memory.get(K.book); t.setUrl(p.navigations[0]); t.api.consumeImportedPriceCapture(); assert.equal(t.memory.get(K.book), before);
  const canceled = runtime({ url: 'https://tornexchange.com/prices/VladBull', items: prices, confirmed: false });
  assert.equal(canceled.api.captureProviderAndReturn('tornexchange', false), null); assert.equal(canceled.window.name, ''); assert.equal(canceled.writes.length, 0);
});

test('armed manual ID mismatch cannot emit a success; manual collision cannot overwrite or complete a queued entry', () => {
  const { torn, memory } = start();
  const p = runtime({ url: 'https://weav3r.dev/pricelist/2321305', items: prices, clock: torn.clock });
  p.api.captureProviderAndReturn('weav3r', false);
  const before = memory.get(K.book), q = memory.get(K.queue);
  const returning = runtime({ url: p.navigations[0], memory, clock: torn.clock }); returning.api.consumeImportedPriceCapture();
  assert.equal(memory.get(K.book), before); assert.equal(memory.get(K.queue), q);
  const wrong = runtime({ url: 'https://tornexchange.com/prices/Other', name: torn.window.name, pageId: 9, items: prices });
  const outcome = wrong.api.captureProviderAndReturn('tornexchange', false); assert.equal(outcome, null);
});

test('affirmative final empty/unavailable evidence is distinct from zero rows and preserves historical snapshot and URL bytes', () => {
  for (const [outcome, statement] of [['explicitly_empty', 'This pricelist is empty.'], ['explicitly_unavailable', 'This trader is not buying.']]) {
    const { torn, memory } = start();
    const before = book(memory)[0], ledger = memory.get(K.ledger);
    const page = runtime({ url: torn.navigations[0], clock: torn.clock, statement });
    const payload = page.api.captureProviderAndReturn('weav3r', true); assert.equal(payload.outcome, outcome);
    const notice = torn.api.persistCaptureImport(payload); assert.equal(notice.ok, true);
    const after = book(memory)[0];
    for (const field of ['pricePageItems', 'pricePageCapturedAt', 'pricePageUrl', 'previousPricePageUrl', 'pricePageCaptureCount', 'pricePageLastChangedCount']) assert.deepEqual(after[field], before[field], field);
    assert.equal(memory.get(K.ledger), ledger); assert.equal(torn.api.traderCaptureHistorical(after), true);
  }
  const page = runtime({ url: 'https://weav3r.dev/pricelist/2321305' });
  assert.equal(page.api.providerPageOutcome('weav3r', [], { tornId: 2321305 }).outcome, 'loading_or_inconclusive');
});

test('legacy v3 launched has unknown budget; Skip/Cancel then explicit new run; duplicate-name retry never targets both IDs', () => {
  const memory = new Map([[K.book, JSON.stringify([trader('a', 1, 'Same'), trader('b', 2, 'Same')])],
    [K.queue, JSON.stringify({ schemaVersion: 3, id: 'old', status: 'launched', cursor: 0, entries: [{ traderId: 'a', traderName: 'Same', userId: 1, pricePageUrl: 'https://weav3r.dev/pricelist/1' }], expiresAt: Date.parse('2026-10-10') })]]);
  const t = runtime({ memory }); const q = t.api.activeFavoriteCaptureCarousel();
  assert.equal(q.status, 'unverified'); assert.equal(q.entries[0].attemptsUsed, null);
  assert.equal(t.api.launchFavoriteCaptureCarousel(), false); t.api.cancelFavoriteCaptureCarousel();
  memory.set(K.result, JSON.stringify({ failed: ['Same'], finishedAt: t.clock.now }));
  assert.equal(t.api.retryFailedTraderCaptureCarousel(), false); assert.equal(memory.has(K.queue), false);
  memory.set(K.result, JSON.stringify({ failed: ['Same'], outcomes: [{ traderRecordId: 'a', outcome: 'timeout', attempted: true }], finishedAt: t.clock.now }));
  assert.equal(t.api.retryFailedTraderCaptureCarousel(), true); assert.equal(current(memory).entries.length, 1); assert.equal(current(memory).entries[0].traderId, 'a');
  assert.notEqual(current(memory).id, 'old');
});

test('every historical quote consumer excludes failed prices from current-best and gain calculations; cash stays independent', () => {
  const failed = { ...trader(), pricePageLastOutcome: 'explicitly_unavailable', pricePageLastReason: 'Closed at last check', pricePageCapturedAt: '2026-10-09T20:00:00Z', pricePageLastCheckedAt: '2026-10-09T21:00:00Z' };
  const good = { ...trader('b', 2, 'Good'), pricePageCapturedAt: '2026-10-09T20:00:00Z', pricePageLastOutcome: 'captured' };
  const memory = new Map([[K.book, JSON.stringify([failed, good])], ['tornscripture-imm-favorite-traders-v1', JSON.stringify({ entries: [{ traderId: 'a', traderName: 'VladBull' }, { traderId: 'b', traderName: 'Good' }] })]]);
  const t = runtime({ memory }); const a = t.api; const item = { itemId: 1, id: 1, name: 'Fixture Item', quantity: 2 };
  const quote = a.tradeExitQuoteForTrader(failed, item); assert.equal(quote.historical, true); assert.equal(quote.capturedAt, failed.pricePageCapturedAt);
  const quotes = a.singleItemTraderQuotes({ pageType: 'item listings', listingItemId: 1, listingItemName: item.name, listingLowestPrice: 100 });
  assert.equal(quotes.length, 1); assert.equal(quotes[0].traderId, 'b');
  assert.equal(a.pricedTradeBestTraderQuote(item, failed).trader.id, 'b');
  assert.equal(a.pricedTradeBestMatchHtml({ trader: good, quote: a.tradeExitQuoteForTrader(good, item) }, failed, quote, { trackedQuantity: 2 }), '');
  assert.match(a.pricedTradeCompactBadgeHtml({ profit: 99999 }, null, failed, quote), /HISTORICAL \/ UNVERIFIED/);
  assert.doesNotMatch(a.pricedTradeCompactBadgeHtml({ profit: 99999 }, null, failed, quote), /ROI|TOP PRICE|more/);
  for (const html of [a.traderCardHtml(failed), a.traderCompactRowHtml(failed), a.traderDossierHtml(failed)]) {
    assert.match(html, /Historical; not reverified/); assert.match(html, /last captured/); assert.match(html, /last attempted/); assert.match(html, /Closed at last check/);
  }
  a.renderPricedTradePanel({ status: 'verified', trader: failed });
  assert.ok(t.elements.some(el => /Historical; not reverified/.test(el.innerHTML)));
  const norm = a.normTraders(); assert.equal(norm.find(x => x.id === 'a').captured, failed.pricePageCapturedAt);
  assert.equal(a.traderCaptureFresh(norm.find(x => x.id === 'a')), true, 'failed check does not change successful capture-selection age');
  const exits = a.exitsForItem(item); assert.equal(a.bestExit(exits).traderId, 'b');
  memory.set(K.book, JSON.stringify([failed])); a.state.traders = a.normalizeTraders([failed]);
  const historicalExits = a.exitsForItem(item); assert.equal(a.bestExit(historicalExits).status, 'historical');
  const audit = a.buildTradeExitAudit({ tradeItems: [item], tradeCounterparty: 'VladBull', tradeCounterpartyId: 2321305 });
  assert.equal(audit.bestKnownTotal, 0); assert.equal(audit.actionableTypes, 0);
  const live = a.buildTradeExitAudit({ tradeItems: [item], tradeNetCash: 2468, tradeCounterparty: 'VladBull', tradeCounterpartyId: 2321305 });
  assert.equal(live.items[0].currentQuote.source, 'live trade cash'); assert.equal(live.items[0].currentQuote.unitPrice, 1234);
});

test('unknown legacy captured time is not backfilled from checked time; summary expires after seven days', () => {
  const old = { ...trader(), pricePageCapturedAt: null, pricePageLastCheckedAt: '2026-10-09T21:00:00Z' };
  const t = runtime({ memory: new Map([[K.book, JSON.stringify([old])]]) });
  assert.equal(t.api.normTraders()[0].captured, null); assert.equal(t.api.tradeExitQuoteForTrader(old, { itemId: 1 }).historical, true);
  t.memory.set(K.result, JSON.stringify({ finishedAt: t.clock.now - 8 * 86400000, failed: ['old'] }));
  assert.equal(t.api.lastCaptureRefreshResult(), null);
});

test('mixed success/final unavailable/success advances each stable ID exactly once and preserves every protected storage byte', () => {
  const { torn, memory } = start([trader(), trader('b', 2, 'Closed'), trader('c', 3, 'Good')]);
  const protectedKeys = ['tornscripture-imm-api-key-v1', 'tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1', 'tornscripture-imm-trade-journal-v1', 'tornscripture-imm-receipt-audits-v1', K.ledger];
  for (const key of protectedKeys) if (!memory.has(key)) memory.set(key, 'fixture: exact protected bytes ' + key);
  const snapshot = new Map(protectedKeys.map(key => [key, memory.get(key)]));
  for (const [index, outcome] of ['captured', 'explicitly_unavailable', 'captured'].entries()) {
    const e = current(memory).entries[index].envelope; torn.clock.now += 1000;
    const payload = result(e, { outcome, items: outcome === 'captured' ? prices : [], producedAt: torn.clock.now,
      evidence: { kind: 'weav3r-route', tornId: e.expectedTornId, statement: 'This trader is not buying.' } });
    const notice = torn.api.persistCaptureImport(payload); assert.equal(notice.ok, true);
    torn.api.continueFavoriteCaptureCarousel(notice);
    const bytes = memory.get(K.book), queue = memory.get(K.queue);
    assert.equal(torn.api.persistCaptureImport(payload).ok, false);
    torn.api.continueFavoriteCaptureCarousel(notice);
    assert.equal(memory.get(K.book), bytes); assert.equal(memory.get(K.queue), queue);
    if (index < 2) torn.api.launchFavoriteCaptureCarousel();
  }
  const summary = JSON.parse(memory.get(K.result));
  assert.deepEqual(summary.outcomes.map(e => e.traderRecordId), ['a', 'b', 'c']);
  assert.deepEqual(summary.outcomes.map(e => e.outcome), ['captured', 'explicitly_unavailable', 'captured']);
  assert.equal(book(memory)[1].pricePageItems[0].unitPrice, 500);
  for (const [key, value] of snapshot) assert.equal(memory.get(key), value, key);
  assert.ok(torn.writes.every(([key]) => [K.book, K.queue, K.result].includes(key)));
});

test('malformed trader, queue or pending store is preserved; neither imports nor new runs overwrite it', () => {
  for (const key of [K.book, K.queue, 'tornscripture-imm-pending-trader-capture-v1']) {
    const { torn, memory, envelope } = start(); torn.clock.now += 1000;
    memory.set(key, '{broken JSON'); const bytes = new Map(memory);
    assert.equal(torn.api.persistCaptureImport(result(envelope), true).ok, false);
    assert.equal(torn.api.startSavedTraderCaptureCarousel('all'), false);
    assert.equal(torn.api.startFavoriteCaptureCarousel(), false);
    assert.deepEqual(memory, bytes);
  }
});

test('failed summary readback preserves closed queue and recovers outcomes when storage is available', () => {
  const { torn, memory, envelope } = start(); torn.clock.now += 1000;
  const notice = torn.api.persistCaptureImport(result(envelope));
  torn.faults.readback = K.result; torn.api.continueFavoriteCaptureCarousel(notice);
  assert.equal(current(memory).status, 'complete'); assert.equal(torn.navigations.length, 1);
  torn.faults.readback = null;
  const recovered = runtime({ memory, clock: torn.clock });
  assert.equal(recovered.api.activeFavoriteCaptureCarousel(), null);
  assert.equal(memory.has(K.queue), false); assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].outcome, 'captured');
});

test('manual armed capture binds exact saved record; wrong pending ID and declined Torn confirmation have no write', () => {
  const saved = trader();
  const torn = runtime({ memory: new Map([[K.book, JSON.stringify([saved])]]) });
  torn.api.requestTraderPriceRecapture(saved.id);
  const p = runtime({ url: torn.navigations[0], name: torn.window.name, items: prices, clock: torn.clock });
  const capture = p.api.captureProviderAndReturn('weav3r', false);
  assert.equal(capture.envelope.traderRecordId, saved.id);
  torn.memory.set('tornscripture-imm-pending-trader-capture-v1', JSON.stringify({ traderId: saved.id, userId: 9, expiresAt: torn.clock.now + 900000 }));
  const old = torn.memory.get(K.book);
  assert.equal(torn.api.persistCaptureImport(capture, true).ok, false); assert.equal(torn.memory.get(K.book), old);
  torn.memory.delete('tornscripture-imm-pending-trader-capture-v1');
  const decline = runtime({ memory: torn.memory, clock: torn.clock, url: p.navigations[0], confirmed: false });
  decline.api.consumeImportedPriceCapture(); assert.equal(torn.memory.get(K.book), old);
  assert.equal(torn.api.persistCaptureImport(capture, true).ok, true);
  assert.equal(book(torn.memory).length, 1); assert.equal(book(torn.memory)[0].id, saved.id);
});

test('TornExchange incompatible loaded table cannot use fallback numeric cells as success; foreign and conflicting Profile links give no identity', () => {
  const saved = trader(); saved.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
  const { torn, memory } = start([saved]);
  const page = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock, items: prices });
  const table = page.document.querySelectorAll('table')[0]; table.textContent = 'Item Name Unsupported Quantity';
  const failure = page.api.captureProviderAndReturn('tornexchange', true);
  assert.equal(failure.outcome, 'parser_failure'); assert.equal(failure.items.length, 0);
  assert.equal(torn.api.persistCaptureImport(failure).ok, true); assert.equal(book(memory)[0].pricePageItems[0].unitPrice, 500);
  const p = runtime({ url: saved.pricePageUrl });
  const profile = p.document.querySelectorAll('a[href]').at(-1); profile.href = 'https://evil.invalid/profiles.php?XID=2321305';
  assert.equal(p.api.tornExchangeTraderIdentity().userId, null);
  const original = p.document.querySelectorAll.bind(p.document); profile.href = 'https://www.torn.com/profiles.php?XID=2321305';
  const another = new Element('Start Trade'); another.href = 'https://www.torn.com/trade.php#step=start&userID=9';
  p.document.querySelectorAll = selector => selector === 'a[href]' ? [...original(selector), another] : original(selector);
  assert.equal(p.api.tornExchangeTraderIdentity().userId, null);
});

test('qualified existing Weav3r hash survives window.name reset; contradictory hash never falls back; TornExchange gains no invented URL carrier', () => {
  const { torn } = start();
  const page = runtime({ url: torn.navigations[0], name: '', clock: torn.clock, items: prices });
  assert.equal(page.api.captureProviderAndReturn('weav3r', true).outcome, 'captured');
  const malformed = new URL(torn.navigations[0]); malformed.hash = 'tsimm-capture=broken';
  const bad = runtime({ url: malformed.href, name: torn.window.name, clock: torn.clock, items: prices });
  assert.equal(bad.api.captureRequestFromWeav3rPage(), null); bad.api.captureProviderAndReturn('weav3r', true); assert.equal(bad.navigations.length, 0);
  const te = runtime({ url: 'https://tornexchange.com/prices/VladBull#tsimm-capture=' + new URL(torn.navigations[0]).hash.slice(15), items: prices });
  assert.equal(te.api.tornExchangeCaptureRequest(), null); te.api.captureProviderAndReturn('tornexchange', true); assert.equal(te.navigations.length, 0);
});

test('repeated supported provider initialization is idempotent and pagehide clears every scheduled capture timer and observer', () => {
  for (const provider of ['weav3r', 'tornexchange']) {
    const saved = trader(); if (provider === 'tornexchange') saved.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
    const { torn } = start([saved]); const page = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock });
    const initialize = provider === 'weav3r' ? page.api.initializeWeav3rPriceCapture : page.api.initializeTornExchangePriceCapture;
    initialize(); const count = page.elements.length, timers = page.timers.size;
    initialize(); assert.equal(page.elements.length, count); assert.equal(page.timers.size, timers);
    page.api.captureProviderAndReturn(provider, true); page.fireEvent('pagehide');
    assert.equal(page.timers.size, 0); assert.equal(page.api.state[provider === 'weav3r' ? 'weav3rObserver' : 'tornExchangeObserver'].disconnected, true);
    page.api.captureProviderAndReturn(provider, true); assert.equal(page.navigations.length, 0);
  }
});

test('expired request is no-write; 12-hour queue expiry reports untouched entries unattempted without renewal', () => {
  const { torn, memory, envelope } = start([trader(), trader('b', 2)]);
  torn.clock.now = envelope.expiresAt + 1; const bookBefore = memory.get(K.book);
  assert.equal(torn.api.persistCaptureImport(result(envelope)).ok, false); assert.equal(memory.get(K.book), bookBefore);
  torn.clock.now = current(memory).expiresAt + 1;
  assert.equal(torn.api.activeFavoriteCaptureCarousel(), null);
  const outcomes = JSON.parse(memory.get(K.result)).outcomes;
  assert.equal(outcomes[0].outcome, 'expired'); assert.equal(outcomes[0].attempted, true);
  assert.equal(outcomes[1].outcome, 'expired'); assert.equal(outcomes[1].attempted, false);
  assert.equal(memory.get(K.book), bookBefore);
});

test('historical item-row annotations and watch banner show no best-exit, gain or buy threshold and offer recapture', () => {
  const failed = { ...trader(), pricePageLastOutcome: 'timeout' };
  const memory = new Map([[K.book, JSON.stringify([failed])],
    ['tornscripture-imm-favorite-traders-v1', JSON.stringify({ entries: [{ traderId: 'a', traderName: 'VladBull' }] })],
    ['tornscripture-imm-watched-items-v1', JSON.stringify({ entries: [{ itemId: 1, itemName: 'Fixture Item' }] })]]);
  const t = runtime({ memory }); const row = new Element('Fixture Item');
  const quantity = t.api.pricedTradeRenderRowBadge(row, failed, { id: 1, name: 'Fixture Item' });
  assert.equal(quantity.priced, true); assert.match(row.children[0].innerHTML, /HISTORICAL \/ UNVERIFIED/);
  assert.doesNotMatch(row.children[0].innerHTML, /ROI|TOP PRICE|more/);
  const title = new Element('Fixture Item'); title.tagName = 'H1'; title.parentElement = title;
  const original = t.document.querySelectorAll.bind(t.document);
  t.document.querySelectorAll = s => s.startsWith('h1,h2,h3,h4,') ? [title] : original(s);
  const panel = t.api.renderWatchPanel({ id: 1, name: 'Fixture Item' }, t.api.exitsForItem({ id: 1, name: 'Fixture Item' }));
  assert.match(panel.innerHTML, /HISTORICAL \/ NOT REVERIFIED/); assert.match(panel.innerHTML, /TRADER BOOK \/ RECAPTURE/);
  assert.doesNotMatch(panel.innerHTML, /BEST EXIT|buy below|buy threshold/i);
});

test('explicit armed manual button starts a fresh manual window after the old deadline, never an automatic renewal', () => {
  for (const provider of ['weav3r', 'tornexchange']) {
    const saved = trader(); if (provider === 'tornexchange') saved.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
    const torn = runtime({ memory: new Map([[K.book, JSON.stringify([saved])]]) }); torn.api.requestTraderPriceRecapture(saved.id);
    torn.clock.now += 120000;
    const page = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock, items: prices });
    assert.equal((provider === 'weav3r' ? page.api.createWeav3rCaptureResult() : page.api.createTornExchangeCaptureResult()).result.items.length, 0);
    const capture = page.api.captureProviderAndReturn(provider, false);
    assert.equal(capture.envelope.intent, 'manual'); assert.equal(capture.envelope.issuedAt, torn.clock.now);
    assert.equal(capture.items.length, 1); assert.equal(torn.api.persistCaptureImport(capture, true).ok, true);
  }
});

test('capture object wrapper and arbitrary trader fields survive success and failure imports', () => {
  const { torn, memory, envelope } = start();
  const saved = book(memory)[0]; saved.unknownHistoricalField = { keep: ['all', 'bytes'] };
  memory.set(K.book, JSON.stringify({ traders: [saved], wrapperVersion: 3, unknownMetadata: { keep: true } }));
  torn.clock.now += 1000; assert.equal(torn.api.persistCaptureImport(result(envelope)).ok, true);
  const stored = JSON.parse(memory.get(K.book)); assert.equal(stored.wrapperVersion, 3);
  assert.deepEqual(stored.unknownMetadata, { keep: true }); assert.deepEqual(stored.traders[0].unknownHistoricalField, saved.unknownHistoricalField);
});

test('cleanup of an old URL cannot erase a different active request; invalid prices and exhausted receipts fail closed', () => {
  const { torn, memory, envelope } = start(); torn.clock.now += 1000;
  const request = torn.window.name;
  const stale = result({ ...envelope, attemptId: 'old' }); torn.setUrl(importUrl(torn.api, stale)); torn.api.consumeImportedPriceCapture();
  assert.equal(torn.window.name, request);
  const old = memory.get(K.book); assert.equal(torn.api.persistCaptureImport(result(envelope, { items: [null] })).ok, false); assert.equal(memory.get(K.book), old);
  const saved = book(memory)[0]; saved.pricePageCaptureReceipts = Array.from({ length: 64 }, (_, i) => ({ runId: 'old', entryId: String(i), attemptId: String(i), expiresAt: torn.clock.now + 900000 }));
  memory.set(K.book, JSON.stringify([saved])); const full = memory.get(K.book);
  assert.equal(torn.api.persistCaptureImport(result(envelope)).ok, false); assert.equal(memory.get(K.book), full);
});

test('malformed URL payload leaves a different active request intact', () => {
  const { torn, memory } = start(); const request = torn.window.name, bytes = memory.get(K.book);
  const returned = runtime({ url: 'https://www.torn.com/index.php?tsimmPriceImport=broken', memory, clock: torn.clock, name: request, testMode: false });
  assert.equal(returned.window.name, request); assert.equal(memory.get(K.book), bytes);
});

test('legacy launched current allowance stays unknown while the later unlaunched entry may start A after explicit Skip', () => {
  const { torn, memory } = start([trader(), trader('b', 2, 'Later')]);
  const old = current(memory); old.schemaVersion = 3;
  for (const entry of old.entries) { delete entry.envelope; delete entry.attemptsUsed; delete entry.attemptId; }
  memory.set(K.queue, JSON.stringify(old)); const runtimeAfterUpgrade = runtime({ memory, clock: torn.clock });
  const queue = runtimeAfterUpgrade.api.activeFavoriteCaptureCarousel();
  assert.equal(queue.status, 'unverified'); assert.equal(queue.entries[0].attemptsUsed, null); assert.equal(queue.entries[1].attemptsUsed, 0);
  assert.equal(runtimeAfterUpgrade.api.skipCurrentCaptureCarousel(), true);
  assert.equal(runtimeAfterUpgrade.api.launchFavoriteCaptureCarousel(), true);
  assert.equal(current(memory).entries[1].attemptsUsed, 1); assert.equal(current(memory).cursor, 1);
});

test('failed Skip metadata persistence blocks continuation; duplicate saved record IDs reject price authority', () => {
  const { torn, memory, envelope } = start([trader(), trader('b', 2)]);
  torn.faults.set = K.book; const before = memory.get(K.queue);
  assert.equal(torn.api.skipCurrentCaptureCarousel(), false); assert.equal(memory.get(K.queue), before); assert.equal(torn.navigations.length, 1);
  torn.faults.set = null; torn.clock.now += 1000; memory.set(K.book, JSON.stringify([trader(), trader()]));
  const duplicate = memory.get(K.book); assert.equal(torn.api.persistCaptureImport(result(envelope)).ok, false); assert.equal(memory.get(K.book), duplicate);
});

test('failed expiry finalization or legacy migration cannot be bypassed by starting a replacement run', () => {
  for (const scenario of ['expired', 'legacy']) {
    const { torn, memory } = start();
    if (scenario === 'expired') torn.clock.now = current(memory).expiresAt + 1;
    else { const old = current(memory); old.schemaVersion = 3; memory.set(K.queue, JSON.stringify(old)); }
    const before = memory.get(K.queue); torn.faults.set = K.queue;
    assert.equal(torn.api.startSavedTraderCaptureCarousel('all'), false);
    assert.equal(memory.get(K.queue), before); assert.equal(torn.navigations.length, 1);
  }
});

test('failure to clear previous summary leaves a tracked ready run and blocks initial navigation', () => {
  const memory = new Map([[K.book, JSON.stringify([trader()])], [K.result, '{"failed":["old"],"finishedAt":1}']]);
  const t = runtime({ memory }); const summary = memory.get(K.result); t.faults.set = K.result;
  assert.equal(t.api.startSavedTraderCaptureCarousel('all'), false);
  assert.equal(t.navigations.length, 0); assert.equal(current(memory).entries[0].attemptsUsed, 0); assert.equal(memory.get(K.result), summary);
});

test('successful production B return stores once, completes once and never issues a third attempt', () => {
  const { torn, memory } = start();
  const A = runtime({ url: torn.navigations[0], clock: torn.clock }); A.api.captureProviderAndReturn('weav3r', true); A.fireDeadline();
  const returnedA = runtime({ url: A.navigations[0], memory, clock: torn.clock, testMode: false });
  const checkpoint = JSON.parse(returnedA.session.get(K.notice)); torn.api.continueFavoriteCaptureCarousel(checkpoint);
  const entry = current(memory).entries[0]; assert.equal(entry.attemptsUsed, 2);
  const B = runtime({ url: torn.navigations[1], clock: torn.clock, items: prices }); const success = B.api.captureProviderAndReturn('weav3r', true);
  assert.equal(success.envelope.attemptId, entry.attemptId);
  const returnedB = runtime({ url: B.navigations[0], memory, clock: torn.clock, testMode: false });
  const notice = JSON.parse(returnedB.session.get(K.notice)); torn.api.continueFavoriteCaptureCarousel(notice);
  assert.equal(memory.has(K.queue), false); assert.equal(book(memory)[0].pricePageCaptureCount, 8);
  const bytes = memory.get(K.book), summary = memory.get(K.result);
  runtime({ url: B.navigations[0], memory, clock: torn.clock, testMode: false }); torn.api.continueFavoriteCaptureCarousel(notice);
  assert.equal(memory.get(K.book), bytes); assert.equal(memory.get(K.result), summary); assert.equal(torn.navigations.length, 2);
});

test('favorite/all/stale selection preserves dispositions and uses successful age rather than the latest failed check', () => {
  const aged = { ...trader(), pricePageLastOutcome: 'timeout', pricePageLastCheckedAt: '2026-10-09T21:00:00Z' };
  const fresh = { ...trader('b', 2, 'Fresh'), pricePageCapturedAt: '2026-10-09T20:00:00Z', pricePageLastOutcome: 'captured' };
  const avoid = { ...trader('c', 3, 'Avoid'), disposition: 'avoid' }, hidden = { ...trader('d', 4, 'Hidden'), disposition: 'hidden' };
  const memory = new Map([[K.book, JSON.stringify([aged, fresh, avoid, hidden])], ['tornscripture-imm-favorite-traders-v1', JSON.stringify({ entries: [{ traderId: 'b', traderName: 'Fresh' }] })]]);
  const t = runtime({ memory }); const selection = t.api.savedTraderCaptureSelection();
  assert.deepEqual(clone(selection.eligible.map(x => x.id)), ['a', 'b']); assert.deepEqual(clone(selection.stale.map(x => x.id)), ['a']); assert.deepEqual(clone(selection.fresh.map(x => x.id)), ['b']);
  assert.deepEqual(clone(selection.excluded.map(x => x.id)), ['c', 'd']);
  assert.equal(t.api.startFavoriteCaptureCarousel(), true); assert.equal(current(memory).mode, 'favorite'); assert.equal(current(memory).entries[0].traderId, 'b');
  t.api.cancelFavoriteCaptureCarousel(); assert.equal(t.api.startSavedTraderCaptureCarousel('stale'), true); assert.equal(current(memory).entries[0].traderId, 'a');
});

test('authority changed between initial validation and persistence is rejected before any trader-store write', () => {
  const { torn, memory, envelope } = start(); torn.clock.now += 1000;
  const get = torn.sandbox.localStorage.getItem.bind(torn.sandbox.localStorage); let queueReads = 0;
  torn.sandbox.localStorage.getItem = key => {
    if (key === K.queue && ++queueReads === 2) { const q = current(memory); q.status = 'canceled'; memory.set(K.queue, JSON.stringify(q)); }
    return get(key);
  };
  const old = memory.get(K.book), count = torn.writes.filter(([key]) => key === K.book).length;
  assert.equal(torn.api.persistCaptureImport(result(envelope)).ok, false);
  assert.equal(memory.get(K.book), old); assert.equal(torn.writes.filter(([key]) => key === K.book).length, count);
});
