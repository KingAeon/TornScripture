const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const reportSource = fs.readFileSync(path.join(__dirname, '..', 'TornScripture-IMM-Trader-Report.user.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(__dirname, '..', 'TornScripture-IMM-Trader-Deals.user.js'), 'utf8');
const trader = {
  recordId: 'trader-1',
  name: 'Trader One',
  userId: 101,
  pricePageItems: [{ itemId: 10, itemName: 'Test Item', unitPrice: 100 }],
};

function createEnvironment(scripts, extraStorage = []) {
  const elementsById = new Map();
  const listeners = new Map();
  const observers = [];
  const timers = new Map();
  const intervals = [];
  const errors = [];
  const storage = new Map([
    ['tornscripture-imm-traders-v1', JSON.stringify([trader])],
    ['tornscripture-imm-catalog-v1', '{}'],
    ['tornscripture-ish-torn-catalog-v1', '{}'],
    ['tornscripture-imm-ledger-v1', '{}'],
    ...extraStorage,
  ]);
  let nextTimerId = 0;

  class Element {
    constructor(tagName = 'div') {
      this.tagName = tagName.toLowerCase();
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this.className = '';
      this.style = {};
      this.textContent = '';
      this._id = '';
      this.isConnected = false;
    }

    get id() { return this._id; }
    set id(value) {
      if (this._id && elementsById.get(this._id) === this) elementsById.delete(this._id);
      this._id = String(value);
      if (this._id) elementsById.set(this._id, this);
    }

    matches(selector) {
      return selector.split(',').some((part) => {
        const value = part.trim();
        if (value === '.tsimm-trader-card') return this.className.split(/\s+/).includes('tsimm-trader-card');
        if (value === '.tsimm-trader-actions') return this.className.split(/\s+/).includes('tsimm-trader-actions');
        if (value === '[data-tsimm-trader-id]') return Boolean(this.dataset.tsimmTraderId);
        if (value === '[data-tsimm-action="trader-edit"]') return this.dataset.tsimmAction === 'trader-edit';
        if (value === '[data-tsimm-action="trader-edit"][data-tsimm-trader-id]') {
          return this.dataset.tsimmAction === 'trader-edit' && Boolean(this.dataset.tsimmTraderId);
        }
        if (value === '[data-tsimm-deals-open]') return Boolean(this.dataset.tsimmDealsOpen);
        if (value === '[data-tsimm-deals-trader]') return Boolean(this.dataset.tsimmDealsTrader);
        return false;
      });
    }

    appendChild(child) {
      child.remove();
      child.parentElement = this;
      child.isConnected = true;
      if (child._id) elementsById.set(child._id, child);
      this.children.push(child);
      return child;
    }

    insertBefore(child, reference) {
      child.remove();
      child.parentElement = this;
      child.isConnected = true;
      if (child._id) elementsById.set(child._id, child);
      const index = this.children.indexOf(reference);
      this.children.splice(index < 0 ? this.children.length : index, 0, child);
      return child;
    }

    replaceChildren(...children) {
      for (const child of [...this.children]) child.remove();
      for (const child of children) this.appendChild(child);
    }

    remove() {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      }
      this.parentElement = null;
      this.isConnected = false;
      if (this._id && elementsById.get(this._id) === this) elementsById.delete(this._id);
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
      const matches = [];
      const visit = (element) => {
        for (const child of element.children) {
          if (child.matches(selector)) matches.push(child);
          visit(child);
        }
      };
      visit(this);
      return matches;
    }

    closest(selector) {
      for (let element = this; element; element = element.parentElement) {
        if (element.matches(selector)) return element;
      }
      return null;
    }

    getAttribute() { return null; }
    addEventListener() {}
  }

  const document = {
    readyState: 'complete',
    body: new Element('body'),
    head: new Element('head'),
    createElement(tagName) { return new Element(tagName); },
    getElementById(id) { return elementsById.get(id) || null; },
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const book = document.createElement('div');
  book.id = 'tornscripture-imm-traders';

  function makeCard() {
    const card = document.createElement('article');
    card.className = 'tsimm-trader-card';
    const identity = document.createElement('span');
    identity.dataset.tsimmTraderId = trader.recordId;
    card.appendChild(identity);
    const actions = document.createElement('div');
    actions.className = 'tsimm-trader-actions';
    card.appendChild(actions);
    const edit = document.createElement('button');
    edit.dataset.tsimmAction = 'trader-edit';
    edit.dataset.tsimmTraderId = trader.recordId;
    actions.appendChild(edit);
    return card;
  }

  book.appendChild(makeCard());
  document.body.appendChild(book);

  const window = { dispatchEvent() {} };
  const context = vm.createContext({
    document,
    window,
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    location: { reload() {} },
    navigator: {},
    console: { error(...args) { errors.push(args); } },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
    },
    setTimeout(callback) {
      const id = ++nextTimerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval(callback, delay) { intervals.push({ callback, delay }); return intervals.length; },
    CustomEvent: class {},
  });

  for (const script of scripts) vm.runInContext(script === 'report' ? reportSource : legacySource, context);

  function flushTimers() {
    let runs = 0;
    while (timers.size) {
      assert.ok(runs++ < 100, 'timer queue should settle');
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
    }
  }

  flushTimers();
  return {
    book,
    document,
    storage,
    observers,
    intervals,
    errors,
    flushTimers,
    rerender() {
      book.replaceChildren(makeCard());
      for (const observer of observers) observer.callback([], observer);
      flushTimers();
    },
    click(element) {
      for (const callback of listeners.get('click') || []) callback({ target: element });
    },
  };
}

function buttonCount(book, selector) {
  return book.querySelectorAll(selector).length;
}

function metadataName(source) {
  return source.match(/^\/\/ @name\s+(.+)$/m)?.[1]?.trim();
}

function versions(source) {
  return {
    metadata: source.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim(),
    internal: source.match(/version:\s*'([^']+)'/)?.[1],
  };
}

test('Report alone decorates and opens one styled Report button', () => {
  const env = createEnvironment(['report']);
  assert.deepEqual(env.errors, []);
  const button = env.book.querySelector('[data-tsimm-deals-open]');
  assert.ok(button);
  assert.equal(buttonCount(env.book, '[data-tsimm-deals-open]'), 1);
  assert.equal(buttonCount(env.book, '[data-tsimm-deals-trader]'), 0);

  const style = env.document.getElementById('tornscripture-imm-trader-report-style');
  assert.ok(style);
  assert.match(style.textContent, /#tornscripture-imm-traders \.tsimm-report-deals-button/);
  assert.equal(env.document.head.children.filter((child) => child.tagName === 'style').length, 1);
  assert.equal(env.intervals.length, 1);
  assert.equal(env.intervals[0].delay, 750);
  env.click(button);
  const overlay = env.document.getElementById('tornscripture-imm-trader-deals-addon');
  assert.ok(overlay);
  assert.match(overlay.innerHTML, /TRADER ONE_DEALS/);
});

test('legacy Deals alone retains its settings and opens one styled legacy button', () => {
  const savedSettings = JSON.stringify({ nearFloor: 91, bucket: 'all', search: 'item' });
  const env = createEnvironment(['legacy'], [['tornscripture-imm-trader-deals-settings-v1', savedSettings]]);
  const button = env.book.querySelector('[data-tsimm-deals-trader]');
  assert.ok(button);
  assert.equal(buttonCount(env.book, '[data-tsimm-deals-trader]'), 1);
  assert.equal(buttonCount(env.book, '[data-tsimm-deals-open]'), 0);
  assert.equal(env.storage.get('tornscripture-imm-trader-deals-settings-v1'), savedSettings);

  const style = env.document.getElementById('tornscripture-imm-trader-deals-legacy-style');
  assert.ok(style);
  assert.match(style.textContent, /#tornscripture-imm-traders \.tsimm-legacy-deals-button/);
  assert.doesNotMatch(style.textContent, /display:\s*none/);
  assert.equal(env.document.head.children.filter((child) => child.tagName === 'style').length, 1);
  assert.equal(env.intervals.length, 0);
  env.click(button);
  const overlay = env.document.getElementById('tornscripture-imm-trader-deals');
  assert.ok(overlay);
  assert.match(overlay.innerHTML, /Trader One Deals/);
});

for (const order of [['report', 'legacy'], ['legacy', 'report']]) {
  test(`Report owns the only Deals button in ${order.join(' then ')} load order and after re-render`, () => {
    const env = createEnvironment(order);
    const assertReportOwnership = () => {
      assert.equal(buttonCount(env.book, '[data-tsimm-deals-open]'), 1);
      assert.equal(buttonCount(env.book, '[data-tsimm-deals-trader]'), 0);
      assert.ok(env.document.getElementById('tornscripture-imm-trader-report-style'));
      assert.ok(env.document.getElementById('tornscripture-imm-trader-deals-legacy-style'));
      assert.equal(env.document.getElementById('tornscripture-imm-trader-deals-style'), null);
      assert.equal(env.document.head.children.filter((child) => child.tagName === 'style').length, 2);
      assert.equal(env.observers.length, 2);
      assert.equal(env.intervals.length, 1);
    };

    assertReportOwnership();
    const button = env.book.querySelector('[data-tsimm-deals-open]');
    env.click(button);
    assert.ok(env.document.getElementById('tornscripture-imm-trader-deals-addon'));
    assert.equal(env.document.getElementById('tornscripture-imm-trader-deals'), null);

    env.rerender();
    assertReportOwnership();
  });
}

test('the two installable scripts have distinct userscript-manager identities', () => {
  assert.notEqual(metadataName(reportSource), metadataName(legacySource));
  assert.deepEqual(versions(reportSource), { metadata: '0.2.4', internal: '0.2.4' });
  assert.deepEqual(versions(legacySource), { metadata: '0.1.2', internal: '0.1.2' });
});
