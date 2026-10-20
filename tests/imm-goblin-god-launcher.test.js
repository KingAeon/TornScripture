const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { before, test } = require('node:test');

const storage = new Map();
const elementsById = new Map();
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
    appendChild() {},
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
  body: Object.assign(makeElement(), {
    appendChild(element) {
      element.isConnected = true;
      if (element.id) elementsById.set(element.id, element);
    },
  }),
  head: Object.assign(makeElement(), {
    appendChild(element) {
      element.isConnected = true;
      if (element.id) elementsById.set(element.id, element);
    },
  }),
  documentElement: { clientWidth: 400, clientHeight: 800 },
  createElement() { return makeElement(); },
  getElementById(id) { return elementsById.get(id) || null; },
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
global.window = {
  innerWidth: 400,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  getComputedStyle() {
    return {
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
    };
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
  const panel = {
    isConnected: true,
    style: { left: '340px', top: '300px' },
    classList: { contains(name) { return name === 'tsimm-collapsed'; } },
    getBoundingClientRect() {
      return {
        left: Number.parseFloat(this.style.left) || 0,
        top: Number.parseFloat(this.style.top) || 0,
        width: 52,
        height: 52,
      };
    },
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
