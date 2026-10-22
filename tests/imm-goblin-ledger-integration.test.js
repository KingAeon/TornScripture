'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, start, trader, K, Element } = require('./helpers/imm-capture-harness.cjs');
const POSITION = 'tornscripture-imm-launcher-position-v1';
const SETTINGS = 'tornscripture-imm-settings-v1';
const PANEL = 'tornscripture-imm-panel';
const PENDING = 'tornscripture-imm-pending-trader-capture-v1';

// Production listeners/renderers run unchanged. Geometry and pointer dispatch are
// synthetic DOM fixtures; these do not qualify desktop or TornPDA acceptance.
async function ui(options = {}, geometry = { scale: 1, origin: { left: 0, top: 0 } }) {
  const p = runtime({ url: 'https://www.torn.com/item.php', testMode: false, productionEvents: true, ...options });
  await p.ready;
  p.state = p.api._state;
  p.window.getComputedStyle = () => ({ paddingTop: '20px', paddingRight: '12px', paddingBottom: '30px', paddingLeft: '10px' });
  const configureGeometry = panel => {
    panel.offsetWidth = panel.offsetHeight = 52;
    panel.getBoundingClientRect = () => ({ left: geometry.origin.left + (parseFloat(panel.style.left) || 0) * geometry.scale,
      top: geometry.origin.top + (parseFloat(panel.style.top) || 0) * geometry.scale,
      width: 52 * geometry.scale, height: 52 * geometry.scale });
    return panel;
  };
  // Install coherent geometry before the initial collapsed render. The shared
  // harness's fixed rectangle deliberately does not model inline coordinates.
  const createElement = p.document.createElement;
  p.document.createElement = tag => {
    const element = createElement(tag);
    return tag === 'section' ? configureGeometry(element) : element;
  };
  if (!p.document.getElementById(PANEL)) {
    const scan = [...p.timers.values()].find(t => t.delay === 120);
    assert.ok(scan, 'ordinary initialized scan scheduled');
    scan.fn();
  }
  p.panel = p.document.getElementById(PANEL);
  assert.ok(p.panel, 'production creates its panel');
  configureGeometry(p.panel);
  return p;
}
function button(p, provider = false) {
  const el = new Element();
  el.dataset = provider ? { tsimmWeav3rAction: 'toggle' } : { tsimmAction: 'toggle' };
  el.closest = selector => selector === '[data-tsimm-launcher]' ? el : selector === `#${PANEL}` ? p.panel
    : selector === (provider ? '[data-tsimm-weav3r-action]' : '[data-tsimm-action]') ? el : null;
  return el;
}
async function dispatch(p, type, target, extra = {}) {
  const event = { type, target, button: 0, pointerId: 1, clientX: 200, clientY: 300, detail: 1,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() {},
    stopImmediatePropagation() { this.stopped = true; }, ...extra };
  for (const listener of p.events[type] || []) {
    await listener(event);
    if (event.stopped) break;
  }
  return event;
}
function guard(p) {
  const keys = [K.book, K.queue, K.ledger, PENDING, 'tornscripture-imm-trader-link-backup-v1',
    'tornscripture-imm-pending-purchase-v1', 'tornscripture-imm-pending-trade-sale-v1',
    'tornscripture-imm-unresolved-trade-journal-v1', 'tornscripture-imm-api-key-v1',
    'tornscripture-imm-api-key-profile-v1', 'tornscripture-imm-ledger-cleanup-backup-v1', 'tornscripture-imm-inventory-v1'];
  for (const key of keys) if (!p.memory.has(key) && ![K.queue, PENDING].includes(key)) p.memory.set(key, JSON.stringify({ sentinel: key }));
  const before = new Map(keys.map(key => [key, p.memory.get(key)]));
  const writeStart = p.writes.length;
  return () => {
    for (const [key, value] of before) assert.equal(p.memory.get(key), value, key);
    assert.ok(p.writes.slice(writeStart).every(([key]) => [POSITION, SETTINGS].includes(key)), 'UI writes only UI preferences');
  };
}
async function collapse(p, provider = false) {
  if (!p.state.settings.collapsed) await dispatch(p, 'click', button(p, provider));
  assert.equal(p.state.settings.collapsed, true);
  assert.equal((p.panel.innerHTML.match(/data-tsimm-launcher/g) || []).length, 1);
}

for (const provider of [false, true]) test(`integrated ${provider ? 'Weav3r' : 'Torn'} tap/keyboard toggles one panel and preserves protected stores`, async () => {
  const p = await ui(provider ? { url: 'https://weav3r.dev/pricelist/2321305' } : {});
  const unchanged = guard(p);
  await collapse(p, provider);
  const original = p.panel;
  for (const detail of [1, 0, 1, 0]) {
    await dispatch(p, 'pointerdown', button(p, provider));
    await dispatch(p, 'pointerup', button(p, provider));
    await dispatch(p, 'click', button(p, provider), { detail });
    assert.equal(p.document.getElementById(PANEL), original);
    assert.equal(p.elements.filter(el => el.id === PANEL && el.isConnected).length, 1);
    assert.equal((p.panel.innerHTML.match(/data-tsimm-launcher/g) || []).length, 1);
  }
  assert.equal(p.state.settings.collapsed, true);
  assert.equal(p.navigations.length, 0);
  unchanged();
});

for (const provider of [false, true]) test(`integrated ${provider ? 'Weav3r' : 'Torn'} seven-pixel threshold, capture transfer, ghost click and next tap`, async () => {
  const p = await ui(provider ? { url: 'https://weav3r.dev/pricelist/2321305' } : {});
  const unchanged = guard(p); await collapse(p, provider);
  let captured = false;
  p.panel.setPointerCapture = () => { captured = true; };
  p.panel.hasPointerCapture = () => captured;
  p.panel.releasePointerCapture = () => { captured = false; };
  const el = button(p, provider);
  await dispatch(p, 'pointerdown', el);
  await dispatch(p, 'pointermove', el, { clientX: 207 });
  assert.equal(p.state.launcherPointerGesture.moved, false);
  assert.equal(captured, false);
  await dispatch(p, 'pointermove', el, { clientX: 208 });
  assert.equal(p.state.launcherPointerGesture.moved, true);
  assert.equal(captured, true);
  // A production toggle rerenders the same owner; subsequent capture must not
  // be canceled by an old target's expected capture-transfer notification.
  await dispatch(p, 'lostpointercapture', el);
  assert.ok(p.state.launcherPointerGesture);
  await dispatch(p, 'pointerup', p.panel, { clientX: 35, clientY: 420 });
  assert.equal(captured, false);
  assert.equal(p.state.launcherPosition.side, 'left');
  assert.equal((await dispatch(p, 'click', p.panel)).stopped, true);
  assert.equal(p.state.settings.collapsed, true);
  await dispatch(p, 'pointerdown', button(p, provider));
  await dispatch(p, 'pointerup', button(p, provider));
  await dispatch(p, 'click', button(p, provider));
  assert.equal(p.state.settings.collapsed, false);
  assert.equal(p.panel.style.left, '');
  unchanged();
});

test('saved released v1 placement and collapsed preference survive initialized reload', async () => {
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  const traces = [];
  const trace = (p, stage, geometry) => traces.push({ stage, geometry, rect: p.panel.getBoundingClientRect(),
    offsetWidth: p.panel.offsetWidth, offsetHeight: p.panel.offsetHeight, style: { ...p.panel.style },
    safeArea: { ...p.state.launcherSafeAreaInsets }, viewport: { width: p.window.innerWidth, height: p.window.innerHeight },
    persisted: p.memory.get(POSITION) });
  for (const scale of [1, 0.65, 1.4]) {
  const geometry = { scale, origin: { left: 12, top: 18 } };
  const memory = new Map([[POSITION, '{"schemaVersion":1,"side":"left","top":345}'],
    [SETTINGS, '{"collapsed":true}'], [K.book, JSON.stringify([trader()])]]);
  const p = await ui({ memory }, geometry); const unchanged = guard(p);
  const initial = p.panel.getBoundingClientRect(); trace(p, 'initial-left', geometry);
  close(initial.left - p.state.launcherSafeAreaInsets.left, 8);
  close(initial.top, 345);
  await dispatch(p, 'pointerdown', button(p), { clientX: initial.left + 12, clientY: initial.top + 12 });
  await dispatch(p, 'pointermove', button(p), { clientX: initial.left + 132, clientY: initial.top + 62 });
  const moved = p.panel.getBoundingClientRect(); trace(p, 'tracking', geometry);
  close(moved.left - initial.left, 120); close(moved.top - initial.top, 50);
  await dispatch(p, 'pointerup', p.panel, { clientX: 380, clientY: initial.top + 62 });
  trace(p, 'right-snap', geometry);
  const snapped = p.panel.getBoundingClientRect();
  close(p.window.innerWidth - p.state.launcherSafeAreaInsets.right - snapped.left - snapped.width, 8);
  const stored = memory.get(POSITION);
  unchanged();
  const next = await ui({ memory }, geometry); trace(next, 'right-reload', geometry);
  assert.equal(next.state.launcherPosition.side, 'right');
  assert.equal(next.state.launcherPosition.top, JSON.parse(stored).top);
  assert.equal(next.state.settings.collapsed, true);
  close(next.panel.getBoundingClientRect().top, JSON.parse(stored).top);
  close(next.panel.getBoundingClientRect().left, snapped.left);
  const nextUnchanged = guard(next), right = next.panel.getBoundingClientRect();
  await dispatch(next, 'pointerdown', button(next), { clientX: right.left + 12, clientY: right.top + 12 });
  await dispatch(next, 'pointermove', button(next), { clientX: 40, clientY: right.top + 72 });
  await dispatch(next, 'pointerup', next.panel, { clientX: 40, clientY: right.top + 72 });
  trace(next, 'left-snap', geometry); nextUnchanged();
  close(next.panel.getBoundingClientRect().left - next.state.launcherSafeAreaInsets.left, 8);
  const leftStored = memory.get(POSITION), reloaded = await ui({ memory }, geometry);
  trace(reloaded, 'left-reload', geometry);
  assert.equal(reloaded.state.launcherPosition.side, 'left');
  assert.equal(reloaded.state.launcherPosition.top, JSON.parse(leftStored).top);
  close(reloaded.panel.getBoundingClientRect().top, JSON.parse(leftStored).top);
  close(reloaded.panel.getBoundingClientRect().left - reloaded.state.launcherSafeAreaInsets.left, 8);
  for (const page of [p, next, reloaded]) {
    assert.equal(page.elements.filter(el => el.id === PANEL && el.isConnected).length, 1);
    assert.equal((page.panel.innerHTML.match(/data-tsimm-launcher/g) || []).length, 1);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) assert.equal(page.events[type].length, 1);
  }
  }
  if (process.env.TSIMM_GEOMETRY_TRACE) require('node:fs').writeFileSync(process.env.TSIMM_GEOMETRY_TRACE, JSON.stringify(traces, null, 2));
});

test('initialized orientation/visual bounds cancel transient drag, clamp safe areas and preserve authority', async () => {
  const p = await ui(); const unchanged = guard(p); await collapse(p);
  await dispatch(p, 'pointerdown', button(p));
  await dispatch(p, 'pointermove', button(p), { clientX: 230, clientY: 450 });
  p.window.visualViewport = { offsetLeft: 30, offsetTop: 15, width: 240, height: 320 };
  p.state.launcherPosition = { schemaVersion: 1, side: 'right', top: 900 };
  for (const listener of p.windowEvents.orientationchange) listener();
  assert.equal(p.state.launcherPointerGesture, null);
  assert.equal(p.state.launcherPosition.top, 245);
  assert.equal(parseFloat(p.panel.style.left), 198);
  unchanged();
});

test('Weav3r repeated initialization/rerender retains one launcher subscription set and live capture owner', async () => {
  const p = runtime({ url: 'https://weav3r.dev/pricelist/2321305' }); await p.ready;
  p.api.bindLauncherInteractions(); p.api.initializeWeav3rPriceCapture();
  p.state = p.api.state; p.panel = p.document.getElementById(PANEL);
  p.panel.offsetWidth = p.panel.offsetHeight = 52;
  p.panel.getBoundingClientRect = () => ({ left: parseFloat(p.panel.style.left) || 0, top: parseFloat(p.panel.style.top) || 0, width: 52, height: 52 });
  await collapse(p, true);
  const counts = Object.fromEntries(Object.entries(p.events).map(([key, value]) => [key, value.length]));
  await dispatch(p, 'pointerdown', button(p, true));
  await dispatch(p, 'pointermove', button(p, true), { clientX: 230, clientY: 340 });
  const gesture = p.state.launcherPointerGesture;
  const scan = [...p.timers.values()].find(t => t.delay === 700); scan.fn();
  p.api.bindLauncherInteractions(); p.api.initializeWeav3rPriceCapture();
  assert.equal(p.state.launcherPointerGesture, gesture);
  assert.equal(p.document.getElementById(PANEL), p.panel);
  assert.deepEqual(Object.fromEntries(Object.entries(p.events).map(([key, value]) => [key, value.length])), counts);
  await dispatch(p, 'pointercancel', p.panel);
  assert.equal(p.state.launcherPointerGesture, null);
  assert.equal(p.navigations.length, 0);
});

test('Weav3r launcher preserves manual-only target-confirmation and no automatic return', async () => {
  const p = await ui({ url: 'https://weav3r.dev/pricelist/2321305', items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] });
  const unchanged = guard(p);
  await collapse(p, true); await dispatch(p, 'click', button(p, true));
  assert.match(p.panel.innerHTML, /Manual-only: no correlated request survived/);
  assert.match(p.panel.innerHTML, /requires target confirmation on Torn/);
  const scan = [...p.timers.values()].find(t => t.delay === 700); scan.fn();
  assert.equal(p.navigations.length, 0);
  unchanged();
});

for (const mode of ['identity mismatch', 'expired attempt']) test('Weav3r launcher preserves ' + mode + ' safeguards', async () => {
  const launched = await start();
  const url = mode === 'identity mismatch' ? launched.torn.navigations[0].replace('/pricelist/2321305', '/pricelist/123456') : launched.torn.navigations[0];
  const clock = { now: launched.envelope.issuedAt + (mode === 'expired attempt' ? 60001 : 1000) };
  const p = await ui({ url, clock, pageId: mode === 'identity mismatch' ? 123456 : 2321305,
    items: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }] });
  const unchanged = guard(p); await collapse(p, true); await dispatch(p, 'click', button(p, true));
  if (mode === 'identity mismatch') {
    assert.match(p.panel.innerHTML, /CAPTURE STOPPED/);
    assert.match(p.panel.innerHTML, /data-tsimm-weav3r-action="capture-return" disabled/);
  } else {
    assert.match(p.panel.innerHTML, /<strong class="tsimm-loss-text">0<\/strong><span>prices found/);
  }
  assert.equal(p.navigations.length, 0);
  unchanged();
});
