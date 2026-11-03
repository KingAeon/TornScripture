const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime, start, trader, result, K, Element } = require('./helpers/imm-capture-harness.cjs');
const prices = [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }];
const queue = memory => memory.has(K.queue) ? JSON.parse(memory.get(K.queue)) : null;
function fire(page, delay) {
  const [id, timer] = [...page.timers].find(([, timer]) => timer.delay === delay);
  page.clock.now = timer.at; page.timers.delete(id); timer.fn();
}

// Adapted from the independent V1 fixtures. The harness does not replace production functions; native Web Locks make their transition API asynchronous.
const tick = () => new Promise(resolve => setImmediate(resolve));
async function hold(page) {
  let release, entered;
  const granted = new Promise(resolve => { entered = resolve; });
  const done = page.nativeLocks.request(page.lockName, { mode: 'exclusive' }, () => {
    entered(); return new Promise(resolve => { release = resolve; });
  });
  await granted;
  return { release, done };
}

test('V1-01: completed cross-tab Cancel ahead of waiting Retry never resurrects A or B', async () => {
  const { torn, memory } = await start();
  const other = runtime({ memory, clock: torn.clock });
  const holder = await hold(torn);
  const cancel = other.api.cancelFavoriteCaptureCarousel();
  const retry = torn.api.launchFavoriteCaptureCarousel();
  await tick();
  holder.release(); await holder.done; await cancel;
  const canceledBytes = memory.get(K.queue);
  assert.equal(canceledBytes, undefined);
  assert.equal(await retry, false);
  assert.equal(memory.get(K.queue), canceledBytes);
  assert.equal(torn.navigations.length, 1);
});

test('V1-02: a numeric quantity cannot substitute for a blank buy-price cell', async () => {
  const saved = trader(); saved.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
  const { torn, memory } = (await start([saved]));
  const page = runtime({ url: torn.navigations[0], name: torn.window.name,
    clock: torn.clock, items: prices });
  const table = page.document.querySelectorAll('table')[0];
  table.querySelector('thead tr').selectors['th,td'].push(new Element('Quantity'));
  const row = table.querySelectorAll('tbody tr')[0]; row.children[1].textContent = '';
  const qty = new Element('25'); qty.tagName = 'TD'; row.children.push(qty);
  table.textContent = 'Item Name Buy Price Quantity Fixture Item 25';
  const before = JSON.parse(memory.get(K.book))[0];
  const capture = page.api.captureProviderAndReturn('tornexchange', true);
  if (capture) (await torn.api.persistCaptureImport(capture));
  assert.notEqual(capture?.outcome, 'captured');
  const after = JSON.parse(memory.get(K.book))[0];
  for (const field of ['pricePageItems', 'pricePageCapturedAt', 'pricePageUrl', 'pricePageCaptureCount']) {
    assert.deepEqual(after[field], before[field]);
  }
});

test('V1-03: the scheduled watch dock must label unavailable quotes historical', async () => {
  const failed = { ...trader(), pricePageLastOutcome: 'explicitly_unavailable',
    pricePageLastReason: 'Closed at last check' };
  const page = runtime({ memory: new Map([[K.book, JSON.stringify([failed])]]) });
  const overlay = page.document.createElement('section');
  overlay.id = 'tornscripture-imm-trader-deals-addon';
  const row = new Element(); row.selectors['.td-row-title strong'] = [new Element('Fixture Item')];
  overlay.selectors['.td-head strong'] = [new Element('> VladBull_DEALS')];
  overlay.selectors['.td-row'] = [row];
  (await page.api.startSavedTraderCaptureCarousel('all')); fire(page, 100);
  const html = page.document.getElementById('tsimm-watch-dock').innerHTML;
  assert.match(html, /historical|not reverified|unavailable/i);
  assert.doesNotMatch(html, /This trader pays/);
});

test('V1-04: a supported recordId-only trader must complete its committed capture', async () => {
  const saved = trader(); saved.recordId = saved.id; delete saved.id;
  const { torn, memory, envelope } = (await start([saved])); torn.clock.now += 1000;
  const notice = (await torn.api.persistCaptureImport(result(envelope)));
  assert.equal(notice.ok, true);
  const complete = (await torn.api.continueFavoriteCaptureCarousel(notice));
  const skipped = (await torn.api.skipCurrentCaptureCarousel());
  assert.equal(complete, true);
  assert.equal(memory.has(K.queue), false);
});

test('V1-05: missing queue expiry must fail closed before early, late and direct writes', async () => {
  const observations = [];
  for (const mode of ['early', 'late', 'direct']) {
    const { torn, memory, envelope } = (await start()); torn.clock.now += 1000;
    const malformed = queue(memory); delete malformed.expiresAt;
    memory.set(K.queue, JSON.stringify(malformed));
    const before = memory.get(K.book), payload = result(envelope);
    const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(
      JSON.stringify(torn.api.compactPriceCaptureResult(payload))).toString('base64url');
    if (mode === 'early') await runtime({ memory, clock: torn.clock, url, testMode: false }).ready;
    else if (mode === 'late') { torn.setUrl(url); (await torn.api.consumeImportedPriceCapture()); }
    else (await torn.api.saveTraderPriceCapture(null, { captureResult: payload }));
    observations.push({ mode, mutated: memory.get(K.book) !== before });
  }
  assert.ok(observations.every(x => !x.mutated));
});

test('V1 control: actual Weav3r initializer retains wrong-ID zero-price recovery', async () => {
  const { torn, memory } = (await start([trader(), trader('next', 2, 'Next')]));
  const url = new URL(torn.navigations[0]); url.pathname = '/pricelist/9';
  const page = runtime({ url: url.href, clock: torn.clock, pageId: 9 });
  page.api.initializeWeav3rPriceCapture(); fire(page, 700);
  assert.equal(page.navigations.length, 1); assert.equal(page.writes.length, 0);
  const returned = runtime({ url: page.navigations[0], memory,
    clock: torn.clock, testMode: false }); await returned.ready;
  const notice = JSON.parse(returned.session.get(K.notice));
  assert.equal(notice.outcome, 'identity_mismatch');
  (await torn.api.continueFavoriteCaptureCarousel(notice));
  assert.equal(queue(memory).cursor, 1);
  const bytes = memory.get(K.queue); (await torn.api.continueFavoriteCaptureCarousel(notice));
  assert.equal(memory.get(K.queue), bytes);
});

test('V1 control: actual Weav3r initializer waits on matching zero and returns a positive page', async () => {
  const { torn } = (await start());
  const empty = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock });
  empty.api.initializeWeav3rPriceCapture(); fire(empty, 700);
  assert.equal(empty.navigations.length, 0);
  assert.equal(JSON.parse(empty.window.name.slice('TSIMM_PRICE_BRIDGE:'.length)).type, 'request');
  const loaded = runtime({ url: torn.navigations[0], clock: torn.clock, items: prices });
  loaded.api.initializeWeav3rPriceCapture(); fire(loaded, 700);
  assert.equal(loaded.navigations.length, 1); assert.equal(loaded.writes.length, 0);
  assert.equal(JSON.parse(loaded.window.name.slice('TSIMM_PRICE_BRIDGE:'.length)).compact.o, 'captured');
});

test('V1 control: actual TornExchange initializer exposes carrier-loss manual fallback', async () => {
  const page = runtime({ url: 'https://tornexchange.com/prices/VladBull', items: prices });
  page.api.initializeTornExchangePriceCapture(); fire(page, 650);
  assert.equal(page.navigations.length, 0); assert.equal(page.writes.length, 0);
  assert.match(page.document.getElementById('tsimm-tornexchange-capture')?.innerHTML ||
    page.elements.map(x => x.innerHTML).join(''), /Manual-only: request transport is unverified or missing/);
});

for (const boundary of ['last-read', 'pre-write']) {
  test(`V1-01 original ${boundary} injection: Cancel waits for the issued B transaction, then invalidates it`, async () => {
    const { torn, memory } = await start();
    const other = runtime({ memory, clock: torn.clock });
    const ledger = memory.get(K.ledger);
    let cancel, injected = false, reads = 0, issuedB = false;
    const store = torn.sandbox.localStorage;
    const get = store.getItem.bind(store), set = store.setItem.bind(store);
    function inject() {
      injected = true;
      cancel = other.api.cancelFavoriteCaptureCarousel();
      // It is a waiting request, not a completed cancellation. The original
      // fixture's synchronous Cancel completion is now excluded by native locks.
      assert.equal(memory.has(K.queue), true);
    }
    if (boundary === 'last-read') store.getItem = key => {
      if (key === K.queue && ++reads === 2 && !injected) inject();
      return get(key);
    };
    store.setItem = (key, value) => {
      if (boundary === 'pre-write' && key === K.queue && !injected) inject();
      set(key, value);
      if (key === K.queue && JSON.parse(value).entries[0].attemptsUsed === 2) issuedB = true;
    };
    torn.window.location.assign = value => {
      assert.equal(queue(memory).entries[0].attemptsUsed, 2);
      torn.navigations.push(value);
    };
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), true);
    assert.equal(injected, true);
    assert.equal(issuedB, true);
    assert.equal(torn.navigations.length, 2, 'B decision occurs before Cancel can complete');
    await cancel;
    assert.equal(memory.has(K.queue), false);
    assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
    assert.equal(torn.navigations.length, 2);
    assert.equal(memory.get(K.ledger), ledger);
  });
}

test('V1-01 two waiting Retry controls issue only one B, and never a third attempt', async () => {
  const { torn, memory } = await start();
  const other = runtime({ memory, clock: torn.clock });
  const holder = await hold(torn);
  const first = torn.api.launchFavoriteCaptureCarousel(), duplicate = other.api.launchFavoriteCaptureCarousel();
  await tick(); holder.release(); await holder.done;
  assert.equal(await first, true); assert.equal(await duplicate, false);
  assert.equal(queue(memory).entries[0].attemptsUsed, 2);
  assert.equal(torn.navigations.length, 2); assert.equal(other.navigations.length, 0);
  assert.equal(await other.api.launchFavoriteCaptureCarousel(), false);
});

test('V1-01 a waiting old-run Retry cannot issue an attempt for a replacement run', async () => {
  const { torn, memory } = await start();
  let allow;
  const delayed = new Promise(resolve => { allow = resolve; });
  const waiting = runtime({ memory, clock: torn.clock, locks: {
    request: async (_, options, callback) => { await delayed; return torn.nativeLocks.request(torn.lockName, options, callback); },
  } });
  const oldRun = queue(memory).id;
  const retry = waiting.api.launchFavoriteCaptureCarousel();
  await torn.api.cancelFavoriteCaptureCarousel();
  assert.equal(await torn.api.startSavedTraderCaptureCarousel('all'), true);
  const replacement = memory.get(K.queue);
  assert.notEqual(queue(memory).id, oldRun);
  allow(); assert.equal(await retry, false);
  assert.equal(memory.get(K.queue), replacement);
  assert.equal(waiting.navigations.length, 0);
  assert.equal(queue(memory).entries[0].attemptsUsed, 0);
});

test('V1-01 duplicate concurrent results commit one receipt and one successful capture', async () => {
  const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
  const other = runtime({ memory, clock: torn.clock });
  const values = await Promise.all([torn.api.persistCaptureImport(result(envelope)), other.api.persistCaptureImport(result(envelope))]);
  assert.equal(values.filter(x => x.ok).length, 1);
  const stored = JSON.parse(memory.get(K.book))[0];
  assert.equal(stored.pricePageCaptureCount, 8); assert.equal(stored.pricePageCaptureReceipts.length, 1);
});

for (const mode of ['early', 'late', 'direct', 'persist']) {
  test(`V1-01 ${mode} import waits for exclusion and rejects a Cancel completed ahead of it`, async () => {
    const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
    const holder = await hold(torn);
    const other = runtime({ memory, clock: torn.clock });
    const cancel = other.api.cancelFavoriteCaptureCarousel();
    const payload = result(envelope), before = memory.get(K.book);
    const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(torn.api.compactPriceCaptureResult(payload))).toString('base64url');
    let pending, early;
    if (mode === 'early') { early = runtime({ memory, clock: torn.clock, url, testMode: false }); pending = early.ready; }
    else if (mode === 'late') { torn.setUrl(url); pending = torn.api.consumeImportedPriceCapture(); }
    else if (mode === 'direct') pending = torn.api.saveTraderPriceCapture(null, { captureResult: payload });
    else pending = torn.api.persistCaptureImport(payload);
    await tick();
    assert.equal(memory.get(K.book), before);
    if (early) { assert.equal(early.writes.length, 0); assert.equal(early.navigations.length, 0); }
    holder.release(); await holder.done; await cancel; await pending;
    assert.equal(memory.has(K.queue), false);
    const after = JSON.parse(memory.get(K.book))[0], original = JSON.parse(before)[0];
    for (const key of ['pricePageItems', 'pricePageCapturedAt', 'pricePageUrl', 'pricePageCaptureCount']) assert.deepEqual(after[key], original[key]);
    assert.equal(after.pricePageLastOutcome, 'canceled');
    assert.equal((early || torn).writes.filter(([key]) => key === K.book).length, 0, 'only the explicit Cancel may record non-price attempt metadata');
  });
}

for (const failure of ['missing', 'denied', 'null-grant', 'synchronous-throw', 'getter-throw']) {
  test(`document-start ${failure} locks fail closed, preserve all bytes and do not navigate`, async () => {
    const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
    const bytes = new Map(memory);
    const locks = failure === 'missing' ? null : { request: failure === 'denied' ? () => Promise.reject(Error('denied'))
      : failure === 'null-grant' ? (_, __, cb) => Promise.resolve(cb(null)) : () => { throw Error('unavailable'); } };
    const payload = result(envelope);
    const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(torn.api.compactPriceCaptureResult(payload))).toString('base64url');
    // document-start runs before application constants, body initialization or
    // the exported API. A throwing locks getter is exercised on ordinary retry.
    const page = runtime({ memory, clock: torn.clock, url, locks, testMode: true });
    await page.ready;
    assert.deepEqual(memory, bytes); assert.equal(page.writes.length, 0); assert.equal(page.navigations.length, 0);
    if (failure === 'getter-throw') Object.defineProperty(page.sandbox.navigator, 'locks', { get() { throw Error('denied getter'); } });
    assert.equal((await page.api.consumeImportedPriceCapture()).ok, false);
    assert.deepEqual(memory, bytes); assert.equal(page.navigations.length, 0);
    assert.match(JSON.parse(page.session.get(K.notice)).error, /coordination unavailable or interrupted/);
  });
}

for (const interruption of ['deadline', 'pagehide', 'hidden']) {
  test(`waiting ${interruption} aborts native acquisition with no late mutation or navigation`, async () => {
    const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
    const page = runtime({ memory, clock: torn.clock });
    const holder = await hold(torn), bytes = new Map(memory);
    const pending = page.api.persistCaptureImport(result(envelope));
    const retry = page.api.launchFavoriteCaptureCarousel();
    await tick();
    if (interruption === 'deadline') fire(page, 5000);
    else if (interruption === 'hidden') { page.document.hidden = true; page.fireEvent('visibilitychange'); }
    else page.fireEvent('pagehide');
    // Fire the second bounded waiter deadline too.
    if (interruption === 'deadline') fire(page, 5000);
    assert.equal((await pending).ok, false); assert.equal(await retry, false);
    assert.deepEqual(memory, bytes); assert.equal(page.navigations.length, 0);
    holder.release(); await holder.done; await tick();
    assert.deepEqual(memory, bytes); assert.equal(page.navigations.length, 0);
    assert.equal([...page.timers.values()].filter(t => t.delay === 5000).length, 0);
  });
}

test('all queue, receipt, migration, expiry, rollback and navigation decisions occur inside the native grant', async () => {
  const memory = new Map([[K.book, JSON.stringify([trader()])]]);
  let inside = false, grants = 0;
  const p = runtime({ memory });
  p.sandbox.navigator.locks = { request: (_, options, callback) => p.nativeLocks.request(p.lockName, options, lock => {
    inside = true; grants++;
    try { const value = callback(lock); assert.equal(typeof value?.then, 'undefined'); return value; }
    finally { inside = false; }
  }) };
  const storage = p.sandbox.localStorage;
  for (const method of ['setItem', 'removeItem']) {
    const original = storage[method].bind(storage);
    storage[method] = (key, ...args) => {
      if ([K.book, K.queue, K.result].includes(key)) assert.equal(inside, true, `${key} ${method}`);
      return original(key, ...args);
    };
  }
  p.window.location.assign = value => { assert.equal(inside, true); p.navigations.push(value); };
  assert.equal(await p.api.startSavedTraderCaptureCarousel('all'), true);
  assert.equal(await p.api.launchFavoriteCaptureCarousel(), true);
  p.clock.now += 1000;
  let payload = result(queue(memory).entries[0].envelope);
  p.faults.readback = K.book;
  assert.equal((await p.api.persistCaptureImport(payload)).ok, false);
  p.faults.readback = null; storage.getItem(K.book); // drain the fixture's rollback-write readback fault
  assert.equal((await p.api.persistCaptureImport(payload)).ok, true);
  assert.equal(await p.api.continueFavoriteCaptureCarousel(null), true);
  await p.api.startSavedTraderCaptureCarousel('all'); await p.api.launchFavoriteCaptureCarousel();
  await p.api.skipCurrentCaptureCarousel();
  await p.api.startSavedTraderCaptureCarousel('all'); await p.api.launchFavoriteCaptureCarousel();
  const legacy = queue(memory); legacy.schemaVersion = 3; memory.set(K.queue, JSON.stringify(legacy));
  assert.equal((await p.api.activeFavoriteCaptureCarousel()).status, 'unverified');
  await p.api.cancelFavoriteCaptureCarousel();
  await p.api.startSavedTraderCaptureCarousel('all');
  p.clock.now = queue(memory).expiresAt + 1;
  assert.equal(await p.api.activeFavoriteCaptureCarousel(), null);
  assert.equal(grants, 14);
});

for (const cell of ['', '0', 'N/A', '25 available', 'Item 25', '$-25', '1,23', 'Infinity']) {
  test(`V1-02 unsupported Buy Price ${JSON.stringify(cell)} cannot use Quantity or ID cells`, async () => {
    const saved = trader(); saved.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
    const { torn, memory } = await start([saved]);
    const page = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock, items: prices });
    const table = page.document.querySelectorAll('table')[0];
    table.querySelector('thead tr').selectors['th,td'].push(new Element('Quantity'), new Element('Item ID'));
    const row = table.querySelectorAll('tbody tr')[0]; row.children[1].textContent = cell;
    for (const value of ['25', '123']) { const el = new Element(value); el.tagName = 'TD'; row.children.push(el); }
    assert.equal(page.api.captureTornExchangePriceItems().length, 0);
    const capture = page.api.captureProviderAndReturn('tornexchange', true);
    assert.notEqual(capture?.outcome, 'captured');
    const before = JSON.parse(memory.get(K.book))[0];
    if (capture) await torn.api.persistCaptureImport(capture);
    const after = JSON.parse(memory.get(K.book))[0];
    for (const key of ['pricePageItems', 'pricePageCapturedAt', 'pricePageUrl', 'pricePageCaptureCount']) assert.deepEqual(after[key], before[key]);
  });
}

test('V1-02 recognized positive Buy Price wins over quantities; a partial table cannot publish success', async () => {
  const saved = trader(); saved.pricePageUrl = 'https://tornexchange.com/prices/VladBull';
  const { torn } = await start([saved]);
  const page = runtime({ url: torn.navigations[0], name: torn.window.name, clock: torn.clock, items: prices });
  const table = page.document.querySelectorAll('table')[0], row = table.querySelectorAll('tbody tr')[0];
  table.querySelector('thead tr').selectors['th,td'].push(new Element('Quantity'));
  const qty = new Element('999999'); qty.tagName = 'TD'; row.children.push(qty);
  row.children[1].textContent = '$1,000.50';
  assert.equal(page.api.captureTornExchangePriceItems()[0].unitPrice, 1000.5);
  const partial = new Element(); partial.children = [new Element('Other Item'), new Element(''), qty];
  table.selectors['tbody tr'].push(partial);
  assert.equal(page.api.captureProviderAndReturn('tornexchange', true).outcome, 'parser_failure');
});

for (const heading of ['Quantity', 'Price', 'Item ID', 'Sell Price']) {
  test(`V1-02 unsupported ${heading} heading never becomes buy-price authority`, () => {
    const page = runtime({ url: 'https://tornexchange.com/prices/VladBull', items: prices });
    const table = page.document.querySelectorAll('table')[0];
    table.querySelector('thead tr').selectors['th,td'][1].textContent = heading;
    assert.equal(page.api.captureTornExchangePriceItems().length, 0);
    assert.equal(page.api.providerPageOutcome('tornexchange', [], page.api.providerIdentityEvidence('tornexchange')).outcome, 'parser_failure');
  });
}

test('V1-03 same-selected-item dock re-reads failure, latest price, source and recapture action', () => {
  const saved = trader(); saved.pricePageLastOutcome = 'captured';
  const memory = new Map([[K.book, JSON.stringify([saved])]]), p = runtime({ memory });
  const overlay = p.document.createElement('section'); overlay.id = 'tornscripture-imm-trader-deals-addon';
  const row = new Element(); row.selectors['.td-row-title strong'] = [new Element('Fixture Item')];
  overlay.selectors['.td-head strong'] = [new Element('> VladBull_DEALS')]; overlay.selectors['.td-row'] = [row];
  p.api.renderWatchDock();
  const dock = p.document.getElementById('tsimm-watch-dock');
  assert.match(dock.innerHTML, /Captured indicative quote/); assert.match(dock.innerHTML, /\$500/);
  const changed = { ...saved, pricePageLastOutcome: 'timeout', pricePageLastReason: 'Refresh inconclusive',
    pricePageItems: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 650 }] };
  memory.set(K.book, JSON.stringify([changed])); p.api.renderWatchDock();
  assert.match(dock.innerHTML, /Historical \/ not reverified/); assert.match(dock.innerHTML, /\$650/);
  assert.match(dock.innerHTML, /Refresh inconclusive/); assert.match(dock.innerHTML, /last captured/);
  assert.match(dock.innerHTML, /data-tsimm-action="traders-open"/);
  assert.doesNotMatch(dock.innerHTML, /This trader pays|\$500|BEST EXIT|buy below/i);
  memory.set(K.book, JSON.stringify([{ ...changed, pricePageLastOutcome: 'captured', pricePageItems: prices }]));
  p.api.renderWatchDock(); assert.match(dock.innerHTML, /Captured indicative quote/); assert.match(dock.innerHTML, /\$1,000/);
  assert.doesNotMatch(dock.innerHTML, /Historical \/ not reverified/);
});

for (const identity of ['id', 'recordId', 'uuid']) {
  for (const action of ['notice', 'receipt-restart', 'skip', 'skip-after-commit']) {
    test(`V1-04 ${identity}-only record safely performs ${action} without rewriting raw identity`, async () => {
      const saved = trader(); delete saved.id; saved[identity] = 'a'; saved.untouched = { bytes: ['keep'] };
      const { torn, memory, envelope } = await start([saved]); torn.clock.now += 1000;
      if (action === 'skip') assert.equal(await torn.api.skipCurrentCaptureCarousel(), true);
      else {
        const notice = await torn.api.persistCaptureImport(result(envelope)); assert.equal(notice.ok, true); assert.equal(notice.traderId, 'a');
        if (action === 'notice') assert.equal(await torn.api.continueFavoriteCaptureCarousel(notice), true);
        else if (action === 'receipt-restart') assert.equal(await runtime({ memory, clock: torn.clock }).api.continueFavoriteCaptureCarousel(null), true);
        else assert.equal(await torn.api.skipCurrentCaptureCarousel(), true);
      }
      assert.equal(memory.has(K.queue), false);
      const after = JSON.parse(memory.get(K.book))[0];
      assert.equal(after[identity], 'a'); assert.deepEqual(after.untouched, saved.untouched);
      for (const absent of ['id', 'recordId', 'uuid'].filter(x => x !== identity)) assert.equal(Object.hasOwn(after, absent), false);
      assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].traderRecordId, 'a');
      assert.equal(JSON.parse(memory.get(K.result)).outcomes[0].outcome, action === 'skip' ? 'user_skipped' : 'captured');
    });
  }
}

test('V1-04 baseline recordId > uuid > string id precedence and legacy Torn identity are consistent', async () => {
  const saved = trader('other'); saved.recordId = 'priority'; saved.uuid = 'secondary'; saved.tornId = saved.userId; delete saved.userId;
  const { torn, memory, envelope } = await start([saved]); torn.clock.now += 1000;
  assert.equal(envelope.traderRecordId, 'priority');
  assert.equal(torn.api.normalizeTrader(saved).id, 'priority'); assert.equal(torn.api.normTraders()[0].id, 'priority');
  const notice = await torn.api.persistCaptureImport(result(envelope)); assert.equal(notice.ok, true); assert.equal(notice.traderId, 'priority');
  assert.equal(await torn.api.continueFavoriteCaptureCarousel(notice), true);
  const raw = JSON.parse(memory.get(K.book))[0];
  assert.equal(raw.id, 'other'); assert.equal(raw.recordId, 'priority'); assert.equal(raw.uuid, 'secondary'); assert.equal(raw.tornId, saved.tornId);
});

for (const invalid of ['missing-expiry', 'null', 'text', 'empty', 'negative', 'infinite', 'future-start', 'missing-start', 'inverted', 'over-12h', 'expired', 'bad-cursor']) {
  test(`V1-05 ${invalid} persisted lifetime/cursor blocks every capture store path and preserves malformed bytes`, async () => {
    for (const mode of ['early', 'late', 'direct', 'persist']) {
      const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
      const malformed = queue(memory);
      if (invalid === 'missing-expiry') delete malformed.expiresAt;
      if (invalid === 'null') malformed.expiresAt = null;
      if (invalid === 'text') malformed.expiresAt = 'not a timestamp';
      if (invalid === 'empty') malformed.expiresAt = '';
      if (invalid === 'negative') malformed.expiresAt = -1;
      if (invalid === 'infinite') malformed.expiresAt = Infinity;
      if (invalid === 'future-start') malformed.startedAt = torn.clock.now + 1;
      if (invalid === 'missing-start') delete malformed.startedAt;
      if (invalid === 'inverted') malformed.expiresAt = malformed.startedAt;
      if (invalid === 'over-12h') malformed.expiresAt = malformed.startedAt + 43200001;
      if (invalid === 'expired') malformed.expiresAt = torn.clock.now;
      if (invalid === 'bad-cursor') malformed.cursor = '0';
      memory.set(K.queue, JSON.stringify(malformed));
      const bytes = new Map(memory), payload = result(envelope);
      const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(torn.api.compactPriceCaptureResult(payload))).toString('base64url');
      if (mode === 'early') await runtime({ memory, clock: torn.clock, url, testMode: false }).ready;
      else if (mode === 'late') { torn.setUrl(url); await torn.api.consumeImportedPriceCapture(); }
      else if (mode === 'direct') assert.equal((await torn.api.saveTraderPriceCapture(null, { captureResult: payload })).ok, false);
      else assert.equal((await torn.api.persistCaptureImport(payload)).ok, false);
      assert.deepEqual(memory, bytes, mode);
    }
  });
}

test('V1-05 malformed queue cannot be normalized into authority or bypassed by manual capture', async () => {
  const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
  const malformed = queue(memory); delete malformed.expiresAt;
  memory.set(K.queue, JSON.stringify(malformed)); const bytes = new Map(memory);
  assert.equal((await torn.api.activeFavoriteCaptureCarousel()).status, 'unverified');
  assert.equal(await torn.api.launchFavoriteCaptureCarousel(), false);
  assert.equal((await torn.api.persistCaptureImport({ ...result(envelope), envelope: { ...envelope, intent: 'manual' } }, true)).ok, false);
  assert.deepEqual(memory, bytes);
  await torn.api.cancelFavoriteCaptureCarousel(); assert.equal(memory.has(K.queue), false, 'explicit owner Cancel remains available');
});

test('document-start pagehide while waiting leaves no boot, write, timer or navigation after grant release', async () => {
  const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
  const holder = await hold(torn), bytes = new Map(memory);
  const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(torn.api.compactPriceCaptureResult(result(envelope)))).toString('base64url');
  const page = runtime({ memory, clock: torn.clock, url, testMode: false });
  await tick(); page.fireEvent('pagehide'); await page.ready;
  assert.equal(page.api, undefined); assert.equal(page.timers.size, 0);
  holder.release(); await holder.done; await tick();
  assert.deepEqual(memory, bytes); assert.equal(page.writes.length, 0); assert.equal(page.navigations.length, 0);
});

test('document-start locks not ready cannot write; a later explicit import uses a fresh native grant', async () => {
  const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
  const url = 'https://www.torn.com/index.php?tsimmPriceImport=' + Buffer.from(JSON.stringify(torn.api.compactPriceCaptureResult(result(envelope)))).toString('base64url');
  const page = runtime({ memory, clock: torn.clock, url, locks: null }); await page.ready;
  assert.equal(page.writes.length, 0); assert.equal(page.navigations.length, 0);
  page.sandbox.navigator.locks = { request: (_, opts, cb) => page.nativeLocks.request(page.lockName, opts, cb) };
  assert.equal((await page.api.consumeImportedPriceCapture()).ok, true);
  assert.equal(JSON.parse(memory.get(K.book))[0].pricePageCaptureCount, 8);
  assert.equal(memory.has(K.queue), false);
});

test('same-store provider-origin invocation cannot acquire Torn capture authority or mutate its store', async () => {
  const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
  // Deliberately share the fixture Map to prove origin validation independently
  // of the ordinary provider's distinct browser-local storage fixture.
  const provider = runtime({ memory, clock: torn.clock, url: torn.navigations[0] });
  const bytes = new Map(memory);
  assert.equal((await provider.api.persistCaptureImport(result(envelope))).ok, false);
  assert.deepEqual(memory, bytes); assert.equal(provider.navigations.length, 0); assert.equal(provider.writes.length, 0);
  assert.notEqual(provider.lockName, torn.lockName);
});

test('legacy intentional manual page capture is coordinated and fails closed without locks', async () => {
  const memory = new Map([[K.book, JSON.stringify([trader()])], [K.ledger, 'exact ledger sentinel']]);
  const p = runtime({ memory });
  const saved = await p.api.saveTraderPriceCapture(p.api.state.traders[0], { url: 'https://www.torn.com/index.php', items: prices });
  assert.equal(saved.parsedCount, 1); assert.equal(saved.trader.pricePageItems[0].unitPrice, 1000);
  assert.equal(memory.get(K.ledger), 'exact ledger sentinel');
  const bytes = new Map(memory); p.sandbox.navigator.locks = null;
  assert.equal(await p.api.saveTraderPriceCapture(p.api.state.traders[0], { items: [{ ...prices[0], unitPrice: 9 }] }), null);
  assert.deepEqual(memory, bytes);
});

for (const available of [true, false]) {
  test(`document-start window.name failure notice ${available ? 'coordinates' : 'fails closed'} before ordinary initialization`, async () => {
    const { torn, memory, envelope } = await start(); torn.clock.now += 1000;
    const payload = result(envelope, { outcome: 'identity_mismatch', items: [], sourceUrl: 'https://weav3r.dev/pricelist/9', evidence: { kind: 'weav3r-route', tornId: 9 } });
    const bridge = 'TSIMM_PRICE_BRIDGE:' + JSON.stringify({ type: 'failure', compact: torn.api.compactPriceCaptureResult(payload) });
    const before = new Map(memory);
    const page = runtime({ memory, clock: torn.clock, name: bridge, locks: available ? undefined : null }); await page.ready;
    assert.equal(page.navigations.length, 0);
    if (available) {
      const saved = JSON.parse(memory.get(K.book))[0];
      assert.equal(saved.pricePageLastOutcome, 'identity_mismatch'); assert.equal(saved.pricePageItems[0].unitPrice, 500);
      assert.equal(page.window.name, ''); assert.equal(page.writes.filter(([key]) => key === K.book).length, 1);
      await page.api.continueFavoriteCaptureCarousel(null); assert.equal(memory.has(K.queue), false);
    } else { assert.deepEqual(memory, before); assert.equal(page.window.name, bridge); assert.equal(page.writes.length, 0); }
  });
}

test('legacy manual capture keeps wrapper, uuid, historical fields and every accounting store byte', async () => {
  const saved = trader(); saved.uuid = saved.id; delete saved.id; saved.unknown = { keep: [1, 2] };
  const memory = new Map([[K.book, JSON.stringify({ traders: [saved], wrapperVersion: 7, retained: 'metadata' })]]);
  const protectedKeys = [K.ledger, 'tornscripture-imm-pending-trade-sale-v1', 'tornscripture-imm-pending-purchase-v1',
    'tornscripture-imm-trade-journal-v1', 'tornscripture-imm-receipt-audits-v1', 'tornscripture-imm-api-key-v1'];
  for (const key of protectedKeys) memory.set(key, JSON.stringify({ sentinel: key, lots: [], sales: [] }));
  const bytes = new Map(protectedKeys.map(key => [key, memory.get(key)])), p = runtime({ memory });
  assert.equal((await p.api.saveTraderPriceCapture(p.api.state.traders[0], { items: prices })).parsedCount, 1);
  const after = JSON.parse(memory.get(K.book));
  assert.equal(after.wrapperVersion, 7); assert.equal(after.retained, 'metadata');
  assert.equal(after.traders[0].uuid, 'a'); assert.equal(Object.hasOwn(after.traders[0], 'id'), false);
  assert.deepEqual(after.traders[0].unknown, saved.unknown);
  for (const [key, value] of bytes) assert.equal(memory.get(key), value);
  assert.ok(p.writes.every(([key]) => key === K.book));
});

for (const failure of ['set', 'readback']) {
  test(`legacy manual ${failure} persistence failure rolls back the original trader bytes under exclusion`, async () => {
    const memory = new Map([[K.book, JSON.stringify([trader()])]]), p = runtime({ memory });
    const bytes = new Map(memory); p.faults[failure] = K.book;
    assert.equal(await p.api.saveTraderPriceCapture(p.api.state.traders[0], { items: prices }), null);
    assert.deepEqual(memory, bytes);
  });
}
