const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scriptPath = process.env.TSIMM_TEST_SCRIPT ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
  : path.join(__dirname, '..', '..', 'TornScripture-Item-Market-Margin.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const K = { book: 'tornscripture-imm-traders-v1', queue: 'tornscripture-imm-favorite-recapture-carousel-v1',
  ledger: 'tornscripture-imm-ledger-v1', result: 'tornscripture-imm-trader-recapture-result-v1', notice: 'tornscripture-imm-core-capture-notice-v1' };
class Element {
  constructor(text = '') {
    this.textContent = this.innerText = text; this.innerHTML = ''; this.id = ''; this.dataset = {}; this.style = {};
    this.children = []; this.childNodes = []; this.isConnected = true; this.tagName = 'DIV';
    this.selectors = {}; this.attributes = {}; this.classes = new Set();
    this.classList = { add: (...s) => s.forEach(x => this.classes.add(x)), remove: (...s) => s.forEach(x => this.classes.delete(x)),
      contains: s => this.classes.has(s), toggle: (s, v) => v ? this.classes.add(s) : this.classes.delete(s) };
  }
  querySelectorAll(s) { return this.selectors[s] || []; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  closest() { return null; }
  matches() { return false; }
  getAttribute(s) { return this.attributes[s] || null; }
  setAttribute(s, v) { this.attributes[s] = v; }
  removeAttribute(s) { delete this.attributes[s]; }
  appendChild(el) { el.parentElement = this; this.children.push(el); return el; }
  append(el) { this.appendChild(el); }
  prepend(el) { this.appendChild(el); }
  remove() { this.isConnected = false; }
  getClientRects() { return [{}]; }
  getBoundingClientRect() { return { width: 100, height: 20, top: 0, left: 0 }; }
  addEventListener() {}
  contains(el) { return el === this; }
  insertAdjacentElement(_, el) { el.previousElementSibling = this; }
}
function trader(id = 'a', userId = 2321305, name = 'VladBull') {
  return { id, userId, name, normalizedName: name.toLowerCase(), disposition: 'normal',
    pricePageUrl: `https://weav3r.dev/pricelist/${userId}`, previousPricePageUrl: 'https://weav3r.dev/pricelist/1',
    pricePageItems: [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 500 }],
    pricePageCapturedAt: '2026-10-01T12:00:00.000Z', pricePageLastCheckedAt: '2026-10-01T12:00:00.000Z',
    pricePageCaptureCount: 7, pricePageLastChangedCount: 2, pricePageLastResult: 'captured' };
}
function runtime({ url = 'https://www.torn.com/index.php', memory = new Map(), session = new Map(), name = '',
  clock = { now: Date.parse('2026-10-09T21:00:00Z') }, testMode = true, confirmed = true, pageId = 2321305, pageName = 'VladBull', items = [], statement = '' } = {}) {
  let nextTimer = 0;
  const timers = new Map(), writes = [], navigations = [], events = {}, windowEvents = {}, elements = [];
  const faults = { set: null, readback: null };
  let failedReadback = null;
  const localStorage = { getItem(key) { if (failedReadback === key) { failedReadback = null; return 'bad-readback'; } return memory.get(key) ?? null; },
    setItem(key, value) { if (faults.set === key) throw Error('fixture persistence failure'); writes.push([key, String(value)]); memory.set(key, String(value)); if (faults.readback === key) failedReadback = key; },
    removeItem(key) { if (faults.set === key) throw Error('fixture remove failure'); memory.delete(key); } };
  const sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key) };
  const location = {};
  function setUrl(value) { const u = new URL(value); Object.assign(location, { href: u.href, origin: u.origin, pathname: u.pathname, hash: u.hash, hostname: u.hostname, search: u.search }); }
  setUrl(url); location.replace = value => navigations.push(value); location.assign = value => navigations.push(value);
  const profile = new Element('Profile'); profile.href = `https://www.torn.com/profiles.php?XID=${pageId}`;
  const attribution = new Element('Made by site owner'); attribution.href = 'https://www.torn.com/profiles.php?XID=99999';
  const heading = new Element(`${pageName}'s Pricelist`);
  const links = items.map(item => {
    const link = new Element(item.itemName); link.href = `https://weav3r.dev/item/${item.itemId}`;
    const price = new Element(`$${item.unitPrice}`); const row = new Element(`${item.itemName} $${item.unitPrice}`);
    link.parentElement = row; row.selectors['a[href*="/item/"]'] = [link]; row.selectors['span,div,p,strong,b,td'] = [price];
    return link;
  });
  const header = new Element(); header.selectors['th,td'] = [new Element('Item Name'), new Element('Buy Price')];
  const table = new Element('Item Name Buy Price'); table.selectors['thead tr'] = [header];
  table.selectors['tbody tr'] = items.map(item => {
    const row = new Element(); row.children = [new Element(item.itemName), new Element(`$${item.unitPrice}`)]; row.children.forEach(el => el.tagName = 'TD');
    const anchor = new Element(); anchor.attributes['href'] = `https://www.torn.com/item.php?itemID=${item.itemId}`;
    row.selectors['[href],[src],[data-item-id],[data-itemid],[data-id]'] = [anchor]; return row;
  });
  const document = { hidden: false, readyState: 'complete', title: `${pageName}'s Pricelist`, body: new Element(), head: new Element(), documentElement: new Element(),
    createElement() { const el = new Element(); elements.push(el); return el; }, getElementById: id => elements.find(el => el.id === id && el.isConnected) || null,
    createTreeWalker() { return { nextNode: () => null }; },
    addEventListener: (type, fn) => { (events[type] ||= []).push(fn); },
    querySelectorAll(selector) {
      if (selector === 'a[href*="/item/"]') return links;
      if (selector === 'a[href*="profiles.php?XID=" i]') return [attribution, ...(pageId ? [profile] : [])];
      if (selector === 'a[href]') return pageId ? [attribution, profile] : [attribution];
      if (selector.startsWith('h1,h2')) return [heading];
      if (selector.startsWith('main h1')) return statement ? [new Element(statement)] : [];
      if (selector === 'table') return items.length ? [table] : [];
      return [];
    }, querySelector() { return null; } };
  const DateClass = class extends Date { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } };
  const window = { name, location, addEventListener: (type, fn) => { (windowEvents[type] ||= []).push(fn); }, removeEventListener() {}, innerWidth: 400, innerHeight: 800 };
  class Document {}
  Object.setPrototypeOf(document, Document.prototype);
  const sandbox = { console, document, window, location, localStorage, sessionStorage, Element, HTMLElement: Element, Document,
    Node: { TEXT_NODE: 3 }, NodeFilter: { SHOW_TEXT: 4 }, Date: DateClass, URL, TextEncoder, TextDecoder, Uint8Array, Intl,
    atob: text => Buffer.from(text, 'base64').toString('binary'), btoa: text => Buffer.from(text, 'binary').toString('base64'),
    history: { state: null, replaceState(_, __, value) { setUrl(value); } }, navigator: {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    MutationObserver: class { observe() {} disconnect() { this.disconnected = true; } },
    confirm: () => confirmed, alert() {}, prompt: () => null,
    setTimeout(fn, delay = 0) { const id = ++nextTimer; timers.set(id, { fn, delay, at: clock.now + delay }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => ++nextTimer, clearInterval() {},
    __TS_IMM_TEST_MODE__: testMode };
  vm.createContext(sandbox); vm.runInContext(source, sandbox, { filename: scriptPath });
  const api = sandbox.__TS_IMM_TEST_EXPORTS__;
  return { api, sandbox, memory, session, timers, writes, navigations, faults, clock, document, window, setUrl, elements,
    fireDeadline() { const entry = [...timers].find(([, t]) => t.delay > 0 && t.delay <= 60000 && t.at - clock.now >= 10000);
      if (!entry) throw Error('No bounded attempt timer'); const [id, timer] = entry; clock.now = timer.at; timers.delete(id); timer.fn(); },
    fireEvent(type) { for (const fn of events[type] || []) fn(); for (const fn of windowEvents[type] || []) fn(); },
  };
}
function start(traders = [trader()]) {
  const memory = new Map([[K.book, JSON.stringify(traders)], [K.ledger, '{"schemaVersion":6,"lots":[],"sales":[],"sentinel":"exact bytes"}']]);
  const torn = runtime({ memory });
  torn.api.startSavedTraderCaptureCarousel('all'); torn.api.launchFavoriteCaptureCarousel();
  const queue = JSON.parse(memory.get(K.queue));
  return { torn, memory, queue, envelope: queue.entries[queue.cursor].envelope };
}
function result(envelope, { outcome = 'captured', items = [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }], producedAt = envelope.issuedAt + 1000,
  sourceUrl = envelope.sourceUrl, evidence = { kind: envelope.provider === 'weav3r' ? 'weav3r-route' : 'tornexchange-profile', tornId: envelope.expectedTornId }, reason = '' } = {}) {
  return { envelope, outcome, items, producedAt, sourceUrl, provider: envelope.provider, evidence, reason, trader: { name: 'VladBull', userId: evidence.tornId } };
}
module.exports = { runtime, start, result, trader, K, Element, scriptPath };
