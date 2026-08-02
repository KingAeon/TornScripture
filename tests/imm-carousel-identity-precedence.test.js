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

const EXPECTED_USER_ID = 910000001;
const UNRELATED_USER_ID = 910000002;
const REQUESTED_TRADER = {
  traderId: 'queued-trader',
  userId: EXPECTED_USER_ID,
  name: 'Queued Trader',
  profileUrl: `https://www.torn.com/profiles.php?XID=${EXPECTED_USER_ID}`,
};
const REQUEST = {
  type: 'request',
  autoReturn: true,
  trader: REQUESTED_TRADER,
  returnUrl: 'https://www.torn.com/index.php',
};
const CAPTURED_ITEMS = Array.from({ length: 307 }, (_, index) => ({
  itemId: index + 1,
  itemName: `Fixture Item ${index + 1}`,
  unitPrice: 1000 + index,
  quantity: 1,
}));

function profileAnchor(userId, label) {
  return {
    href: `https://www.torn.com/profiles.php?XID=${userId}`,
    innerText: label,
    textContent: label,
    title: '',
    getAttribute(name) {
      return name === 'aria-label' ? label : null;
    },
  };
}

const unrelatedAnchor = profileAnchor(UNRELATED_USER_ID, 'Made by site owner');
const requestedAnchor = profileAnchor(EXPECTED_USER_ID, 'View Profile');
const heading = { innerText: "Queued Trader's Pricelist", textContent: "Queued Trader's Pricelist" };
const resultBridges = [];
const pageSandbox = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  location: {
    href: `https://weav3r.dev/pricelist/${EXPECTED_USER_ID}`,
    pathname: `/pricelist/${EXPECTED_USER_ID}`,
  },
  document: {
    title: "Queued Trader's Pricelist",
    querySelectorAll(selector) {
      if (selector.includes('profiles.php?XID=')) return [unrelatedAnchor, requestedAnchor];
      return [heading];
    },
  },
  state: { weav3rCapturePreview: null },
  captureRequestFromWeav3rPage() {
    return REQUEST;
  },
  userIdFromUrl(value) {
    const match = String(value || '').match(/[?&#](?:XID|userID)=(\d+)/i)
      || String(value || '').match(/\/profiles\.php\/(\d+)/i);
    return match ? Number(match[1]) : null;
  },
  normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },
  normalizeName(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  },
  normalizeHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '')) ? String(value) : '';
  },
  cleanWeav3rPriceListUrl(value) {
    return String(value || '').split('#')[0];
  },
  captureWeav3rPriceItems() {
    return CAPTURED_ITEMS;
  },
  compactPriceCaptureResult(result) {
    return {
      v: 1,
      p: 'weav3r',
      t: result.trader,
      u: result.sourceUrl,
      l: result.title,
      c: result.capturedAt,
      i: result.items.map((item) => [item.itemId, item.unitPrice]),
    };
  },
  writePriceBridgeWindowName(payload) {
    resultBridges.push(payload);
    return true;
  },
};

vm.createContext(pageSandbox);
for (const name of [
  'weav3rTraderIdentity',
  'weav3rCaptureIdentityMismatch',
  'createWeav3rCaptureResult',
]) {
  vm.runInContext(extractNamedFunction(name), pageSandbox, { filename: scriptPath });
}

const identity = pageSandbox.weav3rTraderIdentity();
assert.equal(identity.userId, EXPECTED_USER_ID, 'the pricelist path should own page identity');
assert.equal(identity.name, REQUESTED_TRADER.name, 'the pricelist heading should corroborate the requested trader');
assert.equal(identity.profileUrl, requestedAnchor.href, 'the later matching profile link should be selected');
assert.notEqual(identity.profileUrl, unrelatedAnchor.href, 'an earlier unrelated profile link must be ignored');
assert.match(identity.tradeUrl, new RegExp(`userID=${EXPECTED_USER_ID}$`));
assert.equal(
  pageSandbox.weav3rCaptureIdentityMismatch(REQUEST, identity, pageSandbox.location.href),
  null,
  'matching request, path, heading, and profile should pass identity validation',
);

const capture = pageSandbox.createWeav3rCaptureResult();
assert.equal(capture.mismatch, null);
assert.equal(capture.result.items.length, 307);
assert.equal(resultBridges.length, 1, 'successful external capture should create one result bridge');
assert.equal(resultBridges[0].type, 'result');

const wrongPathIdentity = {
  ...identity,
  userId: UNRELATED_USER_ID,
  name: 'Wrong Trader',
};
const wrongPathMismatch = pageSandbox.weav3rCaptureIdentityMismatch(
  REQUEST,
  wrongPathIdentity,
  `https://weav3r.dev/pricelist/${UNRELATED_USER_ID}`,
);
assert.match(wrongPathMismatch.reason, /Saved URL points to Torn ID/);

const compact = resultBridges[0].compact;
const initialTraders = [{
  id: REQUESTED_TRADER.traderId,
  name: REQUESTED_TRADER.name,
  normalizedName: 'queued trader',
  userId: EXPECTED_USER_ID,
  pricePageItems: [],
  pricePageCaptureCount: 0,
}];
const traderStoreWrites = [];
const replacements = [];
const notices = [];
const EARLY_CAPTURE = {
  importQueryKey: 'tsimmPriceImport',
  tradersKey: 'tornscripture-imm-traders-v1',
  pendingKey: 'tornscripture-imm-pending-trader-capture-v1',
  noticeKey: 'tornscripture-imm-core-capture-notice-v1',
};
const tornSandbox = {
  console,
  Date,
  JSON,
  URL,
  EARLY_CAPTURE,
  location: {
    href: 'https://www.torn.com/index.php?tsimmPriceImport=fixture',
    replace(value) {
      replacements.push(value);
    },
  },
  localStorage: {
    setItem(key, value) {
      traderStoreWrites.push([key, value]);
    },
    removeItem() {},
  },
  sessionStorage: {
    setItem(key, value) {
      notices.push([key, value]);
    },
  },
  earlyDecodeBase64Url() {
    return compact;
  },
  earlyCaptureItems() {
    return CAPTURED_ITEMS;
  },
  earlyLoadJson(key) {
    if (key === EARLY_CAPTURE.pendingKey) return { ...REQUESTED_TRADER };
    if (key === EARLY_CAPTURE.tradersKey) return JSON.parse(JSON.stringify(initialTraders));
    return null;
  },
  earlyClean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },
  earlyNameKey(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9'+&-]+/g, ' ').trim();
  },
  earlyChangedCount(previous, next) {
    return next.length - previous.length;
  },
  earlyClearBridgeName() {},
};

vm.createContext(tornSandbox);
for (const name of [
  'earlyFindTraderIndex',
  'earlyCaptureIdentityMismatch',
  'runEarlyCapturePreflight',
]) {
  vm.runInContext(extractNamedFunction(name), tornSandbox, { filename: scriptPath });
}

assert.equal(tornSandbox.runEarlyCapturePreflight(), true, 'Torn should consume the successful capture');
assert.equal(traderStoreWrites.length, 1, 'successful import should write the trader store exactly once');
assert.equal(traderStoreWrites[0][0], EARLY_CAPTURE.tradersKey);
const storedTraders = JSON.parse(traderStoreWrites[0][1]);
assert.equal(storedTraders.length, 1);
assert.equal(storedTraders[0].id, REQUESTED_TRADER.traderId);
assert.equal(storedTraders[0].userId, EXPECTED_USER_ID);
assert.equal(storedTraders[0].pricePageItems.length, 307);
assert.equal(storedTraders[0].pricePageUrl, `https://weav3r.dev/pricelist/${EXPECTED_USER_ID}`);
assert.equal(replacements.length, 1);
assert.equal(notices.length, 1);

console.log('IMM carousel identity precedence tests passed.');
