const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = process.env.TSIMM_TEST_SCRIPT
  ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
  : path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function extractNamedFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist in IMM`);
  const parametersEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', parametersEnd);
  assert.notEqual(bodyStart, -1, `${name} should have a body`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const timers = [];
const assignments = [];
const bridgeWrites = [];
const traderStoreWrites = [];
const toasts = [];
const prefix = 'TSIMM_PRICE_BRIDGE:';
let request;
let identity;
let parsedItems;
let queue;
let savedQueue;
let continuationCount = 0;

const sandbox = {
  console,
  Date,
  JSON,
  Math,
  URL,
  TextEncoder,
  TextDecoder,
  EARLY_CAPTURE: { bridgePrefix: prefix },
  document: { title: "Wrong Trader's Pricelist" },
  location: { href: 'https://weav3r.dev/pricelist/910000002' },
  window: {
    name: '',
    location: {
      assign(url) {
        assignments.push(url);
      },
    },
  },
  state: {
    weav3rCaptureTimer: null,
    weav3rAutoReturnTimer: null,
    weav3rCapturePreview: null,
  },
  localStorage: {
    setItem(key, value) {
      traderStoreWrites.push([key, value]);
    },
  },
  setTimeout(callback) {
    timers.push(callback);
    return timers.length;
  },
  clearTimeout() {},
  normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },
  normalizeName(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  },
  normalizeHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '')) ? String(value) : '';
  },
  cleanSupportedPricePageUrl(value) {
    return String(value || '');
  },
  cleanWeav3rPriceListUrl(value) {
    return String(value || '');
  },
  compactTraderCaptureIdentity(value) {
    return value || {};
  },
  compactPriceCaptureResult(value) {
    return value;
  },
  captureRequestFromWeav3rPage() {
    return request;
  },
  weav3rTraderIdentity() {
    return identity;
  },
  captureWeav3rPriceItems() {
    return parsedItems;
  },
  renderWeav3rCapturePanel() {},
  toast(message) {
    toasts.push(message);
  },
  formatInteger(value) {
    return String(value);
  },
  returnUrlWithPriceCapture() {
    return request.returnUrl;
  },
  earlyClean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },
  clean(value) {
    return String(value ?? '').trim();
  },
  key(value) {
    return String(value ?? '').trim().toLowerCase();
  },
  activeFavoriteCaptureCarousel() {
    return queue;
  },
  saveFavoriteCaptureCarousel(value) {
    savedQueue = value ? JSON.parse(JSON.stringify(value)) : null;
    queue = savedQueue;
  },
  finishFavoriteCaptureCarousel() {
    throw new Error('The two-entry queue should not finish after its first failure');
  },
  showFavoriteToast() {},
  scheduleFavoriteCaptureCarouselContinuation() {
    continuationCount += 1;
  },
};

function readBridge() {
  if (!sandbox.window.name.startsWith(prefix)) return null;
  return JSON.parse(sandbox.window.name.slice(prefix.length));
}

sandbox.readPriceBridgeWindowName = readBridge;
sandbox.writePriceBridgeWindowName = (payload) => {
  const previous = readBridge();
  const bridged = {
    ...payload,
    previousWindowName: previous?.previousWindowName || '',
  };
  bridgeWrites.push(bridged);
  sandbox.window.name = `${prefix}${JSON.stringify(bridged)}`;
  return bridged;
};

vm.createContext(sandbox);
for (const name of [
  'consumeEarlyBridgeFailureNotice',
  'weav3rCaptureIdentityMismatch',
  'returnToTornWithPriceCaptureFailure',
  'createWeav3rCaptureResult',
  'goBackToTornWithWeav3rCapture',
  'scheduleWeav3rCaptureScan',
  'continueFavoriteCaptureCarousel',
]) {
  vm.runInContext(extractNamedFunction(name), sandbox, { filename: scriptPath });
}

function setRequestBridge() {
  sandbox.window.name = `${prefix}${JSON.stringify({
    version: 1,
    type: 'request',
    trader: request.trader,
    returnUrl: request.returnUrl,
    autoReturn: true,
    previousWindowName: '',
  })}`;
}

function runNextTimer() {
  const callback = timers.shift();
  assert.ok(callback, 'a timer callback should be scheduled');
  callback();
}

request = {
  type: 'request',
  autoReturn: true,
  trader: { traderId: 'queued-trader', userId: 910000001, name: 'Queued Trader' },
  returnUrl: 'https://www.torn.com/index.php',
};
identity = { traderId: 'queued-trader', userId: 910000002, name: 'Wrong Trader' };
parsedItems = [];
queue = {
  entries: [
    { traderId: 'queued-trader', traderName: 'Queued Trader', userId: 910000001 },
    { traderId: 'next-trader', traderName: 'Next Trader', userId: 910000003 },
  ],
  cursor: 0,
  completed: [],
  failed: [],
  status: 'launched',
  currentTraderId: 'queued-trader',
  currentTraderName: 'Queued Trader',
  lastError: '',
};
setRequestBridge();

sandbox.scheduleWeav3rCaptureScan(0);
runNextTimer();

assert.equal(assignments.at(-1), request.returnUrl, 'zero-price mismatch should return to Torn');
assert.equal(readBridge()?.type, 'failure', 'mismatch should replace the request bridge with a failure');
assert.equal(bridgeWrites.filter((entry) => entry.type === 'result').length, 0, 'mismatch must not create a price result');
assert.equal(traderStoreWrites.length, 0, 'mismatch must not write trader prices');

const notice = sandbox.consumeEarlyBridgeFailureNotice();
assert.equal(notice.expectedTraderId, 'queued-trader');
assert.equal(sandbox.window.name, '', 'failure bridge should be consumed after returning to Torn');
sandbox.continueFavoriteCaptureCarousel(notice);

assert.equal(savedQueue.cursor, 1, 'failed entry should advance exactly once');
assert.deepEqual(savedQueue.failed, ['Queued Trader']);
assert.equal(savedQueue.status, 'ready');
assert.equal(savedQueue.currentTraderId, '');
assert.equal(savedQueue.currentTraderName, '');
assert.equal(continuationCount, 1, 'next queued trader should be scheduled');

sandbox.continueFavoriteCaptureCarousel(notice);
assert.equal(savedQueue.cursor, 1, 'replayed failure notice must not advance the next trader');
assert.deepEqual(savedQueue.failed, ['Queued Trader'], 'failed trader should be recorded once');
assert.equal(savedQueue.status, 'ready', 'persisted queue must not reload as stranded/launched');

assignments.length = 0;
bridgeWrites.length = 0;
timers.length = 0;
identity = { traderId: 'queued-trader', userId: 910000001, name: 'Queued Trader' };
sandbox.location.href = 'https://weav3r.dev/pricelist/910000001';
parsedItems = [];
setRequestBridge();
sandbox.scheduleWeav3rCaptureScan(0);
runNextTimer();
assert.equal(assignments.length, 0, 'matching page with zero prices must wait instead of returning');
assert.equal(readBridge()?.type, 'request', 'matching zero-price scan must preserve its request bridge');
assert.equal(bridgeWrites.length, 0, 'matching zero-price scan must not create a result');

parsedItems = [{ itemId: 1, itemName: 'Fixture Item', unitPrice: 1000 }];
sandbox.scheduleWeav3rCaptureScan(0);
runNextTimer();
assert.equal(readBridge()?.type, 'result', 'matching page with prices should create a result bridge');
runNextTimer();
assert.equal(assignments.at(-1), request.returnUrl, 'successful capture should return to Torn');
assert.equal(traderStoreWrites.length, 0, 'external-page capture should not write the Torn trader store directly');

console.log('IMM carousel zero-price mismatch handoff tests passed.');
