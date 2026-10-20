const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { before, test } = require('node:test');

const storage = new Map();
const elementsById = new Map();
const listenerRegistrations = [];
global.localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, String(value)); },
};

function makeElement() {
  const classes = new Set();
  return {
    id: '',
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    classList: {
      toggle(name, force) {
        if (force === undefined ? !classes.has(name) : force) classes.add(name);
        else classes.delete(name);
      },
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    appendChild(element) {
      element.isConnected = true;
      if (element.id) elementsById.set(element.id, element);
    },
    remove() {
      this.isConnected = false;
      if (this.id) elementsById.delete(this.id);
    },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

global.document = {
  readyState: 'complete',
  body: makeElement(),
  head: makeElement(),
  documentElement: { clientWidth: 400, clientHeight: 800 },
  createElement() { return makeElement(); },
  getElementById(id) { return elementsById.get(id) || null; },
  addEventListener(type, listener, options) {
    listenerRegistrations.push(['document', type, listener, options]);
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
global.window = {
  innerWidth: 400,
  innerHeight: 800,
  addEventListener(type, listener, options) {
    listenerRegistrations.push(['window', type, listener, options]);
  },
  removeEventListener() {},
  getComputedStyle() {
    return {
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
    };
  },
  visualViewport: {
    offsetLeft: 0,
    offsetTop: 0,
    width: 400,
    height: 800,
    scale: 1,
    addEventListener(type, listener, options) {
      listenerRegistrations.push(['visualViewport', type, listener, options]);
    },
  },
};
global.location = {
  href: 'https://www.torn.com/index.php',
  hostname: 'www.torn.com',
  hash: '',
};
global.MutationObserver = class { observe() {} disconnect() {} };
globalThis.__TS_IMM_TEST_MODE__ = true;

let imm;
before(() => {
  const scriptPath = path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');
  vm.runInThisContext(fs.readFileSync(scriptPath, 'utf8'), { filename: scriptPath });
  imm = globalThis.__TS_IMM_TEST_EXPORTS__;
  assert.ok(imm, 'IMM test exports must be available');
});

function makeLauncher() {
  const scale = 1;
  const origin = { left: 0, top: 0 };
  const panel = {
    isConnected: true,
    offsetWidth: 52,
    offsetHeight: 52,
    style: { left: '340px', top: '300px' },
    classList: { contains(name) { return name === 'tsimm-collapsed'; } },
    getBoundingClientRect() {
      return {
        left: origin.left + (Number.parseFloat(this.style.left) || 0) * scale,
        top: origin.top + (Number.parseFloat(this.style.top) || 0) * scale,
        width: 52 * scale,
        height: 52 * scale,
      };
    },
    setPointerCapture() {},
    hasPointerCapture() { return false; },
  };
  const button = {
    isConnected: true,
    setPointerCapture() {},
    hasPointerCapture() { return false; },
    closest(selector) {
      if (selector === '[data-tsimm-launcher]') return this;
      if (selector === '#tornscripture-imm-panel') return panel;
      return null;
    },
  };
  return { panel, button };
}

function makeScaledLauncher(scale = 0.65, origin = { left: 12, top: 18 }) {
  const { panel, button } = makeLauncher();
  panel.scale = scale;
  panel.origin = origin;
  panel.offsetWidth = 52;
  panel.offsetHeight = 52;
  panel.getBoundingClientRect = function getBoundingClientRect() {
    return {
      left: origin.left + (Number.parseFloat(this.style.left) || 0) * scale,
      top: origin.top + (Number.parseFloat(this.style.top) || 0) * scale,
      width: 52 * scale,
      height: 52 * scale,
    };
  };
  return { panel, button };
}

function pointerEvent(button, pointerId, x, y, extra = {}) {
  return {
    target: button,
    pointerId,
    button: 0,
    clientX: x,
    clientY: y,
    preventDefault() { this.defaultPrevented = true; },
    ...extra,
  };
}

test('saved launcher positions normalize, clamp to safe areas, and fail closed on unavailable storage', () => {
  const safeViewport = {
    width: 360,
    height: 640,
    safeArea: { top: 24, right: 12, bottom: 30, left: 10 },
  };
  assert.deepEqual(
    imm.normalizeLauncherPosition({ schemaVersion: 1, side: 'left', top: 900 }),
    { schemaVersion: 1, side: 'left', top: 900 },
  );
  assert.equal(imm.normalizeLauncherPosition({ schemaVersion: 1, side: 'center', top: 10 }), null);
  assert.equal(imm.normalizeLauncherPosition({ schemaVersion: 1, side: 'right', top: Infinity }), null);
  assert.deepEqual(
    imm.clampLauncherPosition({ schemaVersion: 1, side: 'left', top: 900 }, safeViewport),
    { schemaVersion: 1, side: 'left', top: 550 },
  );
  assert.deepEqual(
    imm.defaultLauncherPosition(safeViewport),
    { schemaVersion: 1, side: 'right', top: 248 },
  );

  const blockedStorage = {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); },
  };
  assert.equal(imm.loadLauncherPosition(blockedStorage), null);
  assert.equal(
    imm.saveLauncherPosition({ schemaVersion: 1, side: 'right', top: 100 }, blockedStorage),
    false,
  );
});

test('mouse drag snaps to the left edge, persists position, and suppresses the generated click', () => {
  const { panel, button } = makeLauncher();
  imm.state.settings.collapsed = true;
  imm.state.launcherPosition = { schemaVersion: 1, side: 'right', top: 300 };
  imm.state.launcherSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  imm.state.launcherPointerGesture = null;
  imm.state.launcherSuppressClick = false;

  imm.handleLauncherPointerDown(pointerEvent(button, 1, 365, 320, { pointerType: 'mouse' }));
  imm.handleLauncherPointerMove(pointerEvent(button, 1, 50, 410, { pointerType: 'mouse' }));
  assert.equal(panel.style.left, '25px');
  assert.equal(panel.style.top, '390px');
  imm.handleLauncherPointerUp(pointerEvent(button, 1, 50, 410, { pointerType: 'mouse' }));

  assert.equal(imm.state.launcherPosition.side, 'left');
  assert.equal(imm.state.launcherPosition.top, 390);
  assert.equal(panel.style.left, '8px');
  assert.equal(imm.loadLauncherPosition().side, 'left');
  const ghostClick = {
    target: button,
    detail: 1,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  assert.equal(imm.suppressDraggedLauncherClick(ghostClick), true);
  assert.equal(ghostClick.defaultPrevented, true);
  assert.equal(ghostClick.stopped, true);
});

test('touch drag snaps right while a stationary tap or keyboard activation remains a toggle click', () => {
  const { panel, button } = makeLauncher();
  imm.state.settings.collapsed = true;
  imm.state.launcherPosition = { schemaVersion: 1, side: 'left', top: 300 };
  imm.state.launcherSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  imm.state.launcherPointerGesture = null;
  imm.state.launcherSuppressClick = false;
  panel.style.left = '8px';
  panel.style.top = '300px';

  imm.handleLauncherPointerDown(pointerEvent(button, 2, 20, 320, { pointerType: 'touch' }));
  imm.handleLauncherPointerMove(pointerEvent(button, 2, 26, 322, { pointerType: 'touch' }));
  assert.equal(imm.state.launcherPointerGesture.moved, false, 'motion under the threshold is not a drag');
  imm.handleLauncherPointerUp(pointerEvent(button, 2, 26, 322, { pointerType: 'touch' }));
  assert.equal(imm.state.launcherSuppressClick, false, 'stationary tap remains a native button click');

  imm.handleLauncherPointerDown(pointerEvent(button, 3, 20, 320, { pointerType: 'touch' }));
  imm.handleLauncherPointerMove(pointerEvent(button, 3, 380, 500, { pointerType: 'touch' }));
  assert.equal(imm.state.launcherPointerGesture.moved, true);
  imm.handleLauncherPointerUp(pointerEvent(button, 3, 380, 500, { pointerType: 'touch' }));
  assert.equal(imm.state.launcherPosition.side, 'right');
  assert.equal(panel.style.left, '340px');

  imm.state.launcherSuppressClick = true;
  const keyboardClick = {
    target: button,
    detail: 0,
    preventDefault() {},
    stopImmediatePropagation() {},
  };
  assert.equal(imm.suppressDraggedLauncherClick(keyboardClick), false);
  assert.equal(imm.state.launcherSuppressClick, false);
});

test('pointer cancellation clears transient drag state without persisting a partial move', () => {
  const { panel, button } = makeLauncher();
  imm.state.settings.collapsed = true;
  imm.state.launcherPosition = { schemaVersion: 1, side: 'right', top: 300 };
  imm.state.launcherSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  imm.state.launcherPointerGesture = null;
  imm.state.launcherSuppressClick = false;
  storage.delete('tornscripture-imm-launcher-position-v1');

  imm.handleLauncherPointerDown(pointerEvent(button, 4, 365, 320));
  imm.handleLauncherPointerMove(pointerEvent(button, 4, 50, 410));
  imm.handleLauncherPointerCancel(pointerEvent(button, 4, 50, 410));

  assert.equal(imm.state.launcherPointerGesture, null);
  assert.equal(imm.state.launcherSuppressClick, false);
  assert.equal(panel.style.left, '340px');
  assert.equal(storage.has('tornscripture-imm-launcher-position-v1'), false);
});

test('mouse and touch movement track 1:1 through a scaled containing block before edge snap', () => {
  const { panel, button } = makeScaledLauncher(0.65);
  imm.state.settings.collapsed = true;
  imm.state.launcherPosition = { schemaVersion: 1, side: 'right', top: 300 };
  imm.state.launcherSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const initial = panel.getBoundingClientRect();

  imm.handleLauncherPointerDown(pointerEvent(button, 11, initial.left + 12, initial.top + 20, { pointerType: 'mouse' }));
  imm.handleLauncherPointerMove(pointerEvent(button, 11, initial.left + 112, initial.top + 85, { pointerType: 'mouse' }));
  const afterMouseMove = panel.getBoundingClientRect();
  assert.equal(afterMouseMove.left - initial.left, 100);
  assert.equal(afterMouseMove.top - initial.top, 65);
  imm.handleLauncherPointerUp(pointerEvent(button, 11, initial.left + 112, initial.top + 85, { pointerType: 'mouse' }));
  assert.equal(imm.state.launcherPosition.side, 'right');

  const touchStart = panel.getBoundingClientRect();
  imm.handleLauncherPointerDown(pointerEvent(button, 12, touchStart.left + 14, touchStart.top + 14, { pointerType: 'touch' }));
  imm.handleLauncherPointerMove(pointerEvent(button, 12, touchStart.left - 166, touchStart.top + 94, { pointerType: 'touch' }));
  const afterTouchMove = panel.getBoundingClientRect();
  assert.ok(Math.abs((afterTouchMove.left - touchStart.left) - (-180)) < 1e-8);
  assert.ok(Math.abs((afterTouchMove.top - touchStart.top) - 80) < 1e-8);
  imm.handleLauncherPointerUp(pointerEvent(button, 12, touchStart.left - 166, touchStart.top + 94, { pointerType: 'touch' }));
  assert.equal(imm.state.launcherPosition.side, 'left');
});

test('mid-drag panel re-render retains capture owner and keeps tracking the live finger', () => {
  const { panel, button } = makeLauncher();
  panel.id = 'tornscripture-imm-panel';
  panel.style.left = '200px';
  panel.offsetWidth = 52;
  panel.offsetHeight = 52;
  panel.innerHTML = '';
  panel.querySelector = () => null;
  panel.classList.toggle = () => {};
  elementsById.set(panel.id, panel);
  imm.state.settings.collapsed = true;
  imm.state.launcherPosition = { schemaVersion: 1, side: 'right', top: 300 };
  imm.state.launcherSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const initial = panel.getBoundingClientRect();
  imm.handleLauncherPointerDown(pointerEvent(button, 13, initial.left + 18, initial.top + 18, { pointerType: 'touch' }));

  assert.equal(imm.state.launcherPointerGesture.captureTarget, panel);
  button.isConnected = false;
  imm.renderPanel();
  imm.handleLauncherPointerMove(pointerEvent(panel, 13, initial.left + 80, initial.top + 62, { pointerType: 'touch' }));
  const moved = panel.getBoundingClientRect();
  assert.equal(moved.left - initial.left, 62);
  assert.equal(moved.top - initial.top, 44);
  imm.handleLauncherPointerUp(pointerEvent(panel, 13, initial.left + 80, initial.top + 62, { pointerType: 'touch' }));
  assert.equal(imm.state.launcherPointerGesture, null);
  assert.equal(imm.state.launcherSuppressClick, true);

  const rerenderGhostClick = {
    target: panel,
    detail: 1,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  assert.equal(imm.suppressDraggedLauncherClick(rerenderGhostClick), true);
  assert.equal(rerenderGhostClick.defaultPrevented, true);
});

test('collapsed rendering remains one accessible launcher and expansion clears its position override', () => {
  imm.state.settings.collapsed = true;
  imm.state.launcherPosition = { schemaVersion: 1, side: 'right', top: 300 };
  imm.state.launcherSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

  imm.renderPanel();
  const panel = document.getElementById('tornscripture-imm-panel');
  assert.ok(panel);
  assert.equal(panel.style.left, '340px');
  assert.match(panel.innerHTML, /data-tsimm-launcher/);
  assert.match(panel.innerHTML, /aria-label="Open GOBLIN GOD IMM panel"/);
  assert.match(panel.innerHTML, /aria-expanded="false"/);

  imm.renderPanel();
  assert.equal(document.getElementById('tornscripture-imm-panel'), panel);
  assert.equal((panel.innerHTML.match(/data-tsimm-launcher/g) || []).length, 1);

  imm.state.settings.collapsed = false;
  imm.renderPanel();
  assert.equal(panel.style.left, '');
  assert.equal(panel.style.top, '');
  assert.match(panel.innerHTML, /aria-label="Collapse GOBLIN GOD IMM panel"/);
  assert.match(panel.innerHTML, /aria-expanded="true"/);
});

test('repeated launcher binding registers each delegated listener only once', () => {
  const before = listenerRegistrations.length;
  imm.state.launcherInteractionsBound = false;
  imm.bindLauncherInteractions();
  const first = listenerRegistrations.slice(before);
  imm.bindLauncherInteractions();
  const repeated = listenerRegistrations.slice(before);

  assert.equal(first.length, 10);
  assert.equal(repeated.length, first.length);
  assert.equal(first.filter(([owner, type]) => owner === 'document' && type.startsWith('pointer')).length, 4);
  assert.equal(first.filter(([owner, type]) => owner === 'document' && type === 'lostpointercapture').length, 1);
  assert.equal(first.filter(([owner, type]) => owner === 'window' && type === 'resize').length, 1);
  assert.equal(first.filter(([owner]) => owner === 'visualViewport').length, 2);
});

test('viewport bounds follow the visual viewport offsets and scale', () => {
  const previous = window.visualViewport;
  window.visualViewport = {
    offsetLeft: 80,
    offsetTop: 35,
    width: 240,
    height: 360,
    scale: 1.7,
  };
  const viewport = imm.launcherViewport();
  assert.deepEqual(
    imm.clampLauncherPosition({ schemaVersion: 1, side: 'right', top: 900 }, viewport),
    { schemaVersion: 1, side: 'right', top: 335 },
  );
  window.visualViewport = previous;
});
