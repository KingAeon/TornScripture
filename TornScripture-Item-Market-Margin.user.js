// ==UserScript==
// @name         TornScripture - Item Market Margin
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.3.1
// @description  Audits item-market margins, verifies 99% trade payouts, and records purchase lots in a local ledger.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// ==/UserScript==

(() => {
  'use strict';

  /*
   * TORNSCRIPTURE - ITEM MARKET MARGIN v0.3.1
   *
   * SAFETY BOUNDARY
   * - Reads item names, lowest prices, market values, visible listing rows, and trade manifests.
   * - Torn catalog values are requested only when the user presses Sync values.
   * - The API key, catalog cache, pending purchase, and purchase ledger remain in this browser's local storage.
   * - The key is sent only to Torn's official API.
   * - Purchase capture begins only after the user presses Torn's normal confirmation button.
   * - The script never clicks Buy, submits purchases, lists items, or sells items.
   */

  const APP = Object.freeze({
    name: 'Item Market Margin',
    shortName: 'IMM',
    version: '0.3.1',
    panelId: 'tornscripture-imm-panel',
    styleId: 'tornscripture-imm-style',
    badgeClass: 'tsimm-margin-badge',
    categoryMark: 'tsimm-category-mark',
    listingMark: 'tsimm-listing-mark',
    tradeItemMark: 'tsimm-trade-item-mark',
    tradeBadgeClass: 'tsimm-trade-item-badge',
    ledgerOverlayId: 'tornscripture-imm-ledger',
    apiKeyStorageKey: 'tornscripture-imm-api-key-v1',
    sharedApiKeyStorageKey: 'tornscripture-ish-api-key-v1',
    catalogStorageKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogStorageKey: 'tornscripture-ish-torn-catalog-v1',
    settingsStorageKey: 'tornscripture-imm-settings-v1',
    ledgerStorageKey: 'tornscripture-imm-ledger-v1',
    pendingPurchaseStorageKey: 'tornscripture-imm-pending-purchase-v1',
    recentPurchaseFingerprintsStorageKey: 'tornscripture-imm-recent-purchase-fingerprints-v1',
    catalogUrl: 'https://api.torn.com/v2/torn/items',
    scanDelayMs: 450,
    catalogMaxAgeMs: 24 * 60 * 60 * 1000,
    pendingPurchaseMaxAgeMs: 30 * 60 * 1000,
    duplicatePurchaseWindowMs: 2 * 60 * 1000,
  });

  const PDA_API_KEY = '###PDA-APIKEY###';
  const TRADER_PERCENT = 99;

  const DEFAULT_SETTINGS = Object.freeze({
    collapsed: false,
    minimumProfitEach: 100,
    minimumRoiPercent: 0.25,
    showLossesDuringTesting: true,
    tradeSidePreference: 'auto',
    showTradeItemBreakdown: true,
  });

  const state = {
    settings: { ...structuredCloneSafe(DEFAULT_SETTINGS), ...loadJson(APP.settingsStorageKey, DEFAULT_SETTINGS) },
    catalog: mergeCatalogCaches(),
    ledger: normalizeLedger(loadJson(APP.ledgerStorageKey, {})),
    pendingPurchase: normalizePendingPurchase(loadJson(APP.pendingPurchaseStorageKey, null)),
    purchaseSignals: [],
    recentPurchaseFingerprints: loadJson(APP.recentPurchaseFingerprintsStorageKey, []),
    lastScan: emptyScanStats(),
    syncing: false,
    scanTimer: null,
    observer: null,
    initialized: false,
    networkObserversBound: false,
  };

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredCloneSafe(fallback);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === typeof fallback ? parsed : structuredCloneSafe(fallback);
    } catch {
      return structuredCloneSafe(fallback);
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function createId(prefix = 'id') {
    const random = Math.random().toString(36).slice(2, 9);
    return `${prefix}_${Date.now()}_${random}`;
  }

  function normalizeLedger(raw) {
    const sourceLots = Array.isArray(raw?.lots) ? raw.lots : Array.isArray(raw) ? raw : [];
    const lots = [];
    for (const candidate of sourceLots) {
      const itemName = normalizeWhitespace(candidate?.itemName ?? candidate?.name);
      const quantity = Math.max(0, Math.floor(Number(candidate?.quantity) || 0));
      const unitCost = Math.max(0, Number(candidate?.unitCost ?? candidate?.priceEach ?? candidate?.buyPrice) || 0);
      if (!itemName || quantity <= 0 || unitCost <= 0) continue;
      const marketValueAtPurchase = Math.max(0, Number(candidate?.marketValueAtPurchase ?? candidate?.marketValue) || 0);
      const traderValueAtPurchase = Math.max(
        0,
        Number(candidate?.traderValueAtPurchase) || traderPayout(marketValueAtPurchase)
      );
      const remainingQuantity = Math.max(
        0,
        Math.min(quantity, Math.floor(Number(candidate?.remainingQuantity) || quantity))
      );
      lots.push({
        id: normalizeWhitespace(candidate?.id) || createId('lot'),
        schemaVersion: 1,
        source: normalizeWhitespace(candidate?.source) || 'manual',
        venue: normalizeWhitespace(candidate?.venue) || normalizeWhitespace(candidate?.source) || 'manual',
        country: normalizeWhitespace(candidate?.country),
        location: normalizeWhitespace(candidate?.location),
        itemId: Number(candidate?.itemId) > 0 ? Number(candidate.itemId) : null,
        itemName,
        normalizedName: normalizeName(itemName),
        quantity,
        remainingQuantity,
        unitCost,
        totalCost: unitCost * quantity,
        marketValueAtPurchase,
        traderValueAtPurchase,
        expectedProfitEach: traderValueAtPurchase - unitCost,
        expectedProfitTotal: (traderValueAtPurchase - unitCost) * quantity,
        capturedAt: candidate?.capturedAt || candidate?.purchasedAt || new Date().toISOString(),
        purchaseUrl: normalizeWhitespace(candidate?.purchaseUrl),
        captureMethod: normalizeWhitespace(candidate?.captureMethod) || 'import',
        status: normalizeWhitespace(candidate?.status) || (remainingQuantity > 0 ? 'open' : 'closed'),
        notes: normalizeWhitespace(candidate?.notes),
      });
    }
    lots.sort((a, b) => Date.parse(b.capturedAt || '') - Date.parse(a.capturedAt || ''));
    return {
      schema: 'tornscripture-imm-ledger',
      schemaVersion: 1,
      updatedAt: raw?.updatedAt || null,
      lots,
    };
  }

  function normalizePendingPurchase(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const createdAtMs = Date.parse(raw.createdAt || raw.clickedAt || '');
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > APP.pendingPurchaseMaxAgeMs) return null;
    const itemName = normalizeWhitespace(raw.itemName);
    const quantity = Math.max(0, Math.floor(Number(raw.quantity) || 0));
    const totalCost = Math.max(0, Number(raw.totalCost) || 0);
    const unitCost = Math.max(0, Number(raw.unitCost) || (quantity > 0 ? totalCost / quantity : 0));
    if (!itemName || quantity <= 0 || unitCost <= 0) return null;
    return {
      id: normalizeWhitespace(raw.id) || createId('pending'),
      itemId: Number(raw.itemId) > 0 ? Number(raw.itemId) : null,
      itemName,
      quantity,
      unitCost,
      totalCost: totalCost || unitCost * quantity,
      marketValue: Math.max(0, Number(raw.marketValue) || 0),
      traderValue: Math.max(0, Number(raw.traderValue) || traderPayout(raw.marketValue)),
      source: normalizeWhitespace(raw.source) || 'item-market',
      createdAt: raw.createdAt || raw.clickedAt || new Date().toISOString(),
      purchaseUrl: normalizeWhitespace(raw.purchaseUrl) || location.href,
      confirmationText: normalizeWhitespace(raw.confirmationText),
    };
  }

  function saveLedger() {
    state.ledger.updatedAt = new Date().toISOString();
    saveJson(APP.ledgerStorageKey, state.ledger);
  }

  function savePendingPurchase() {
    if (state.pendingPurchase) saveJson(APP.pendingPurchaseStorageKey, state.pendingPurchase);
    else localStorage.removeItem(APP.pendingPurchaseStorageKey);
  }

  function ledgerSummary() {
    const lots = state.ledger.lots || [];
    return {
      lots: lots.length,
      itemTypes: new Set(lots.map((lot) => lot.normalizedName || normalizeName(lot.itemName))).size,
      quantity: lots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0),
      remainingQuantity: lots.reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0), 0),
      invested: lots.reduce((sum, lot) => sum + Number(lot.totalCost || 0), 0),
      expectedProfit: lots.reduce((sum, lot) => sum + Number(lot.expectedProfitTotal || 0), 0),
    };
  }

  function buildLedgerLot(source, captureMethod = 'manual') {
    const itemName = normalizeWhitespace(source?.itemName);
    const quantity = Math.max(1, Math.floor(Number(source?.quantity) || 1));
    const unitCost = Math.max(0, Number(source?.unitCost) || 0);
    const marketValueAtPurchase = Math.max(
      0,
      Number(source?.marketValueAtPurchase ?? source?.marketValue) || 0
    );
    const traderValueAtPurchase = Math.max(
      0,
      Number(source?.traderValueAtPurchase ?? source?.traderValue)
        || traderPayout(marketValueAtPurchase)
    );
    return {
      id: createId('lot'),
      schemaVersion: 1,
      source: normalizeWhitespace(source?.source) || 'item-market',
      venue: normalizeWhitespace(source?.venue) || normalizeWhitespace(source?.source) || 'item-market',
      country: normalizeWhitespace(source?.country),
      location: normalizeWhitespace(source?.location),
      itemId: Number(source?.itemId) > 0 ? Number(source.itemId) : null,
      itemName,
      normalizedName: normalizeName(itemName),
      quantity,
      remainingQuantity: quantity,
      unitCost,
      totalCost: unitCost * quantity,
      marketValueAtPurchase,
      traderValueAtPurchase,
      expectedProfitEach: traderValueAtPurchase - unitCost,
      expectedProfitTotal: (traderValueAtPurchase - unitCost) * quantity,
      capturedAt: source?.capturedAt || new Date().toISOString(),
      purchaseUrl: normalizeWhitespace(source?.purchaseUrl) || location.href,
      captureMethod,
      status: 'open',
      notes: normalizeWhitespace(source?.notes),
    };
  }

  function addLedgerLot(lot) {
    if (!lot?.itemName || !(lot.quantity > 0) || !(lot.unitCost > 0)) return false;
    state.ledger.lots.unshift(lot);
    saveLedger();
    renderLedger();
    renderPanel();
    return true;
  }

  function commitPendingPurchase(captureMethod = 'detected-success', signal = '') {
    const pending = state.pendingPurchase;
    if (!pending) return null;
    const lot = buildLedgerLot({
      ...pending,
      marketValueAtPurchase: pending.marketValue,
      traderValueAtPurchase: pending.traderValue,
      capturedAt: new Date().toISOString(),
      notes: signal ? `Capture signal: ${signal.slice(0, 180)}` : '',
    }, captureMethod);
    state.pendingPurchase = null;
    savePendingPurchase();
    addLedgerLot(lot);
    toast(`Ledger recorded ${formatInteger(lot.quantity)}× ${lot.itemName}.`);
    return lot;
  }

  function discardPendingPurchase(message = 'Pending purchase discarded.') {
    state.pendingPurchase = null;
    savePendingPurchase();
    renderPanel();
    toast(message);
  }

  function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function normalizeName(value) {
    return normalizeWhitespace(value)
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9'+&-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseNumber(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const cleaned = raw.replace(/[^\d.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function formatPercent(value) {
    const number = Number(value) || 0;
    const decimals = Math.abs(number) >= 10 ? 1 : 2;
    return `${number.toFixed(decimals)}%`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function emptyScanStats() {
    return {
      scannedAt: null,
      pageType: 'unknown',
      categoryCandidates: 0,
      categoryMatched: 0,
      categoryGood: 0,
      categoryMinor: 0,
      categoryLoss: 0,
      listingCandidates: 0,
      listingMatched: 0,
      listingGood: 0,
      listingMinor: 0,
      listingLoss: 0,
      visibleMarketValue: null,
      listingMarketValue: null,
      listingMarketValueSource: null,
      listingItemId: null,
      listingItemName: null,
      tradeSideCandidates: 0,
      tradeMySide: null,
      tradeSideSource: null,
      tradeItemRows: 0,
      tradeMatchedItems: 0,
      tradeUnmatchedItems: 0,
      tradeMarketTotal: 0,
      tradeTargetTotal: 0,
      tradeTraderCash: null,
      tradeMyCash: null,
      tradeNetCash: null,
      tradeDifference: null,
      tradeEffectivePercent: null,
      tradeStatus: 'not-scanned',
      tradeItems: [],
      tradeUnmatched: [],
      notes: [],
    };
  }

  function normalizeCatalogItem(raw) {
    const id = Number(raw?.id ?? raw?.itemId);
    const value = raw?.value && typeof raw.value === 'object' ? raw.value : {};
    const name = normalizeWhitespace(raw?.name);
    const marketPrice = parseNumber(raw?.marketPrice ?? value.market_price);
    if (!name || !Number.isFinite(marketPrice) || marketPrice <= 0) return null;
    return {
      id: Number.isFinite(id) && id > 0 ? id : null,
      name,
      normalizedName: normalizeName(name),
      marketPrice,
    };
  }

  function normalizeCatalog(rawCatalog) {
    const normalized = {
      updatedAt: rawCatalog?.updatedAt || null,
      itemsByName: {},
      itemsById: {},
    };
    const source = rawCatalog?.itemsByName || rawCatalog?.items || {};
    const entries = Array.isArray(source)
      ? source.map((item) => [String(item?.id ?? ''), item])
      : Object.entries(source);
    for (const [key, raw] of entries) {
      const item = normalizeCatalogItem({ ...raw, id: raw?.id ?? raw?.itemId ?? Number(key) });
      if (!item) continue;
      normalized.itemsByName[item.normalizedName] = item;
      if (item.id) normalized.itemsById[String(item.id)] = item;
    }
    return normalized;
  }

  function mergeCatalogCaches() {
    const own = normalizeCatalog(loadJson(APP.catalogStorageKey, {}));
    const shared = normalizeCatalog(loadJson(APP.sharedCatalogStorageKey, {}));
    const merged = {
      updatedAt: own.updatedAt || shared.updatedAt || null,
      itemsByName: { ...shared.itemsByName, ...own.itemsByName },
      itemsById: { ...shared.itemsById, ...own.itemsById },
    };
    return merged;
  }

  function catalogCount() {
    return Object.keys(state.catalog.itemsByName || {}).length;
  }

  function currentApiKey() {
    const managed = normalizeWhitespace(PDA_API_KEY);
    if (managed && managed !== '###PDA-APIKEY###' && !managed.includes('PDA-APIKEY')) return managed;
    return normalizeWhitespace(localStorage.getItem(APP.apiKeyStorageKey))
      || normalizeWhitespace(localStorage.getItem(APP.sharedApiKeyStorageKey));
  }

  function setApiKey() {
    const existing = currentApiKey();
    const next = prompt(
      'Enter a Torn Limited Access API key. It stays in this browser and is sent only to api.torn.com.',
      existing
    );
    if (next === null) return;
    const cleaned = normalizeWhitespace(next);
    if (!cleaned) {
      localStorage.removeItem(APP.apiKeyStorageKey);
      toast('Item Market Margin API key cleared.');
      renderPanel();
      return;
    }
    localStorage.setItem(APP.apiKeyStorageKey, cleaned);
    toast('API key saved locally.');
    renderPanel();
  }

  function catalogIsFresh() {
    const updated = Date.parse(state.catalog.updatedAt || '');
    return Number.isFinite(updated) && Date.now() - updated < APP.catalogMaxAgeMs;
  }

  function apiErrorMessage(payload, response) {
    const apiError = payload?.error;
    if (typeof apiError === 'string') return apiError;
    if (apiError?.error) return apiError.error;
    if (apiError?.message) return apiError.message;
    return `Torn API request failed (${response.status}).`;
  }

  async function syncCatalog() {
    if (state.syncing) return;
    const key = currentApiKey();
    if (!key) {
      toast('Set a Limited Access API key first.');
      setApiKey();
      return;
    }
    state.syncing = true;
    renderPanel();
    try {
      const url = new URL(APP.catalogUrl);
      url.searchParams.set('striptags', 'true');
      url.searchParams.set('comment', 'TornScripture Item Market Margin');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `ApiKey ${key}`,
        },
        credentials: 'omit',
        cache: 'no-store',
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`Torn item catalog returned unreadable data (${response.status}).`);
      }
      if (!response.ok || payload?.error) throw new Error(apiErrorMessage(payload, response));
      const rawItems = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      const itemsByName = {};
      const itemsById = {};
      for (const raw of rawItems) {
        const item = normalizeCatalogItem(raw);
        if (!item) continue;
        itemsByName[item.normalizedName] = item;
        if (item.id) itemsById[String(item.id)] = item;
      }
      if (!Object.keys(itemsByName).length) throw new Error('Torn returned no usable item values.');
      state.catalog = {
        updatedAt: new Date().toISOString(),
        itemsByName,
        itemsById,
      };
      saveJson(APP.catalogStorageKey, state.catalog);
      toast(`Loaded ${formatInteger(catalogCount())} item values.`);
      scheduleScan(50);
    } catch (error) {
      console.error('[TornScripture IMM] Catalog sync failed:', error);
      toast(error?.message || 'Catalog sync failed.');
    } finally {
      state.syncing = false;
      renderPanel();
    }
  }

  function formatInteger(value) {
    return new Intl.NumberFormat().format(Number(value) || 0);
  }

  function traderPayout(marketValue) {
    // Traders are modeled as paying exactly 99% of Torn's displayed market value.
    // Torn deals in whole dollars, so fractional cents are rounded down.
    return Math.floor((Number(marketValue) || 0) * TRADER_PERCENT / 100);
  }

  function marginFor(listingPrice, marketValue, quantity = 1) {
    const price = Number(listingPrice) || 0;
    const value = Number(marketValue) || 0;
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const payout = traderPayout(value);
    const profitEach = payout - price;
    const totalProfit = profitEach * qty;
    const investment = price * qty;
    const roiPercent = investment > 0 ? totalProfit / investment * 100 : 0;
    let tier = 'loss';
    if (profitEach > 0) {
      tier = profitEach >= Number(state.settings.minimumProfitEach)
        && roiPercent >= Number(state.settings.minimumRoiPercent)
        ? 'good'
        : 'minor';
    }
    return {
      price,
      value,
      payout,
      traderPercent: TRADER_PERCENT,
      qty,
      profitEach,
      totalProfit,
      investment,
      roiPercent,
      tier,
    };
  }

  function manifestTotals(items = []) {
    const rows = items.filter((item) => Number(item?.quantity) > 0 && Number(item?.marketPrice) > 0);
    const marketTotal = rows.reduce((sum, item) => sum + Number(item.marketPrice) * Number(item.quantity), 0);
    // Match the trader's per-item policy exactly: floor each unit to 99%, then multiply by quantity.
    const targetTotal = rows.reduce((sum, item) => sum + traderPayout(item.marketPrice) * Number(item.quantity), 0);
    const totalQuantity = rows.reduce((sum, item) => sum + Number(item.quantity), 0);
    return { marketTotal, targetTotal, totalQuantity, itemTypes: rows.length };
  }

  function pageLooksLikeTrade() {
    const href = location.href.toLowerCase();
    if (href.includes('/trade.php') || href.includes('trade.php')) return true;
    const bodyText = document.body?.innerText || '';
    return /\b(?:active\s+)?trade\b/i.test(bodyText)
      && /\b(?:no items in trade|add items|cancel trade|accept trade|trade with)\b/i.test(bodyText);
  }

  function visibleElement(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function dedupeNestedElements(elements) {
    const unique = [...new Set(elements)].filter(visibleElement);
    return unique.filter((element) => !unique.some((other) => other !== element && element.contains(other)));
  }

  function tradeItemRowElements(container) {
    if (Array.isArray(container?.rows)) return container.rows.filter(visibleElement);
    if (container?.element instanceof Element) container = container.element;
    if (!(container instanceof Element)) return [];
    const selectors = [
      // Torn's legacy/mobile trade layout may place every item-name DIV inside
      // one outer `li.color2`. Prefer those atomic name nodes so the whole
      // manifest is not mistaken for a single item.
      'li.color2 div.name',
      'li.color2 [class*="name___"]',
      'li.color2 [class*="desc___"] b',
      '[data-group="child"] .name',
      '[data-group="child"] [class*="name___"]',
      '[class*="item___"] [class*="name___"]',
      '[class*="item___"] [class*="desc___"] b',
      // Fall back to the row wrappers used by other Torn layouts.
      'li.color2',
      '[data-group="child"]',
      '[class*="item___"]',
      '[data-item-id]',
      'li[data-item]',
    ];
    const rows = selectors.flatMap((selector) => [...container.querySelectorAll(selector)]);
    const filtered = rows.filter((row) => {
      if (!visibleElement(row)) return false;
      if (row.closest(`#${APP.panelId}`)) return false;
      const text = normalizeWhitespace(row.innerText);
      if (!text || /no items in trade/i.test(text)) return false;
      if (/^(?:money|cash|points|property|company|faction)\b/i.test(text)) return false;
      return Boolean(row.querySelector('img')) || /\bx\s*[\d,]+\b/i.test(text) || /×\s*[\d,]+/.test(text);
    });
    return [...new Set(filtered)].filter((row) => !filtered.some((other) => other !== row && row.contains(other)));
  }

  function elementComesBefore(first, second) {
    if (!(first instanceof Node) || !(second instanceof Node) || first === second) return false;
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function tradeParticipantNames() {
    const selectors = '.title-black,[role="heading"],h1,h2,h3,h4,h5,div,span';
    const matches = [...document.querySelectorAll(selectors)]
      .filter((element) => visibleElement(element) && !element.closest(`#${APP.panelId}`))
      .map((element) => ({ element, text: normalizeWhitespace(element.innerText) }))
      .filter(({ text }) => /^Trade between\s+.+?\s+&\s+.+$/i.test(text) && text.length <= 180)
      .sort((a, b) => a.text.length - b.text.length);
    const match = matches[0]?.text.match(/^Trade between\s+(.+?)\s+&\s+(.+)$/i);
    return match ? [normalizeWhitespace(match[1]), normalizeWhitespace(match[2])] : [];
  }

  function exactParticipantHeading(name) {
    const normalized = normalizeName(name);
    if (!normalized) return null;
    const selectors = '.title-black,[role="heading"],h1,h2,h3,h4,h5,[class*="title___"],[class*="header___"],div,span';
    const candidates = [...document.querySelectorAll(selectors)].filter((element) => {
      if (!visibleElement(element) || element.closest(`#${APP.panelId}`)) return false;
      return normalizeName(element.innerText) === normalized;
    });
    return candidates.sort((a, b) => {
      const aPreferred = Number(a.matches('.title-black,[role="heading"],h1,h2,h3,h4,h5,[class*="title___"],[class*="header___"]'));
      const bPreferred = Number(b.matches('.title-black,[role="heading"],h1,h2,h3,h4,h5,[class*="title___"],[class*="header___"]'));
      return bPreferred - aPreferred || a.children.length - b.children.length;
    })[0] || null;
  }

  function exclusiveTradeSection(header, previousHeader, nextHeader, rows) {
    let node = header?.parentElement || null;
    let best = header;
    while (node && node !== document.body) {
      if ((previousHeader && node.contains(previousHeader)) || (nextHeader && node.contains(nextHeader))) break;
      if (!rows.length || rows.some((row) => node.contains(row))) best = node;
      node = node.parentElement;
    }
    return best instanceof Element ? best : header;
  }

  function cashValueBetweenHeaders(header, nextHeader) {
    const candidates = [...document.querySelectorAll('li,div,span,p,strong,b')].filter((element) => {
      if (!visibleElement(element) || element.closest(`#${APP.panelId}`)) return false;
      if (!elementComesBefore(header, element)) return false;
      if (nextHeader && !elementComesBefore(element, nextHeader)) return false;
      const text = normalizeWhitespace(element.innerText);
      if (!/no money in trade/i.test(text) && !/\$\s*[\d,]+\s+in trade/i.test(text)) return false;
      return ![...element.children].some((child) => {
        const childText = normalizeWhitespace(child.innerText);
        return /no money in trade/i.test(childText) || /\$\s*[\d,]+\s+in trade/i.test(childText);
      });
    });
    for (const element of candidates) {
      const text = normalizeWhitespace(element.innerText);
      if (/no money in trade/i.test(text)) return 0;
      const match = text.match(/\$\s*([\d,]+)\s+in trade/i);
      const value = match ? parseNumber(match[1]) : null;
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function stackedTradeSideCandidates() {
    const names = tradeParticipantNames();
    if (names.length !== 2) return [];
    const headers = names.map(exactParticipantHeading);
    if (headers.some((header) => !header) || headers[0] === headers[1]) return [];
    const ordered = names.map((name, index) => ({ name, header: headers[index] }))
      .sort((a, b) => elementComesBefore(a.header, b.header) ? -1 : 1);
    const allRows = tradeItemRowElements(document.body);
    return ordered.map((participant, index) => {
      const previousHeader = ordered[index - 1]?.header || null;
      const nextHeader = ordered[index + 1]?.header || null;
      const rows = allRows.filter((row) => elementComesBefore(participant.header, row)
        && (!nextHeader || elementComesBefore(row, nextHeader)));
      const element = exclusiveTradeSection(participant.header, previousHeader, nextHeader, rows);
      return {
        element,
        rows,
        side: index === 0 ? 'left' : 'right',
        rect: participant.header.getBoundingClientRect(),
        heading: participant.name,
        rowCount: rows.length,
        cashValue: cashValueBetweenHeaders(participant.header, nextHeader),
        source: 'stacked participant headings',
      };
    });
  }

  function tradeSideCandidates() {
    const explicitSelectors = [
      '.trade-cont .user.left',
      '.trade-cont .user.right',
      '.trade-cont .left.user',
      '.trade-cont .right.user',
      '.trade-cont > .user',
      '.trade-cont [class*="user___"]',
      '.trade-cont [class*="user_"]',
      'div.user.left',
      'div.user.right',
    ];
    let candidates = explicitSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
    candidates = [...new Set(candidates)].filter((element) => {
      if (!visibleElement(element)) return false;
      const text = normalizeWhitespace(element.innerText);
      if (!text || text.length > 16000) return false;
      return tradeItemRowElements(element).length > 0
        || /no items in trade/i.test(text)
        || /no money in trade/i.test(text)
        || /\$\s*[\d,]+\s+in trade/i.test(text)
        || /\b(?:money|cash)\b[^\n]{0,30}\$[\d,]+/i.test(text);
    });

    if (candidates.length < 2) {
      const stacked = stackedTradeSideCandidates();
      if (stacked.length === 2) return stacked;
      const itemRows = [...document.querySelectorAll('li.color2,[data-group="child"],[class*="item___"],li[data-item]')]
        .filter(visibleElement);
      for (const row of itemRows) {
        let node = row.parentElement;
        for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
          const classText = String(node.className || '').toLowerCase();
          const text = normalizeWhitespace(node.innerText);
          if (text.length > 16000) continue;
          if (/\b(left|right)\b/.test(classText) || /(?:left|right)___/.test(classText)) {
            candidates.push(node);
            break;
          }
        }
      }
    }

    candidates = dedupeNestedElements(candidates);
    const withMeta = candidates.map((element) => {
      const rect = element.getBoundingClientRect();
      const classText = String(element.className || '').toLowerCase();
      let side = null;
      if (/\bleft\b|left___|left_/.test(classText)) side = 'left';
      if (/\bright\b|right___|right_/.test(classText)) side = 'right';
      return {
        element,
        side,
        rect,
        heading: tradeSideHeading(element),
        rowCount: tradeItemRowElements(element).length,
        source: 'explicit side container',
      };
    });

    if (withMeta.length > 2) {
      const explicit = withMeta.filter((candidate) => candidate.side);
      if (explicit.some((candidate) => candidate.side === 'left') && explicit.some((candidate) => candidate.side === 'right')) {
        return [
          explicit.find((candidate) => candidate.side === 'left'),
          explicit.find((candidate) => candidate.side === 'right'),
        ];
      }
      return withMeta
        .sort((a, b) => b.rowCount - a.rowCount || a.rect.left - b.rect.left)
        .slice(0, 2)
        .sort((a, b) => a.rect.left - b.rect.left)
        .map((candidate, index) => ({ ...candidate, side: candidate.side || (index === 0 ? 'left' : 'right') }));
    }

    return withMeta
      .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top)
      .map((candidate, index) => ({ ...candidate, side: candidate.side || (index === 0 ? 'left' : 'right') }));
  }

  function tradeSideHeading(container) {
    const selectors = [
      '.title-black',
      '[role="heading"]',
      'h2,h3,h4,h5',
      '[class*="title___"]',
      '[class*="header___"]',
    ];
    for (const selector of selectors) {
      const element = container.querySelector(selector);
      const text = normalizeWhitespace(element?.innerText);
      if (text && text.length <= 120) return text;
    }
    const lines = String(container.innerText || '').split(/\n+/).map(normalizeWhitespace).filter(Boolean);
    return lines.find((line) => line.length <= 80 && !/^\$[\d,]+$/.test(line)) || '';
  }

  function currentUsernameCandidates() {
    const selectors = [
      'a[class*="menu-value"]',
      '[class*="menuValue"]',
      '[class*="userName"] a',
      '[class*="username"] a',
      'a[href*="profiles.php?XID="]',
    ];
    const names = new Set();
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (element.closest('.trade-cont') || element.closest(`#${APP.panelId}`)) continue;
        const text = normalizeWhitespace(element.innerText || element.textContent);
        if (text && text.length <= 60 && !/^\d+$/.test(text)) names.add(normalizeName(text));
      }
    }
    return [...names].filter(Boolean);
  }

  function determineMyTradeSide(sides) {
    const preference = state.settings.tradeSidePreference;
    if (preference === 'left' || preference === 'right') {
      const preferred = sides.find((side) => side.side === preference);
      if (preferred) return { side: preferred, source: `manual ${preference}` };
    }

    const directYou = sides.find((side) => /\b(?:you|your items|your offer)\b/i.test(side.heading));
    if (directYou) return { side: directYou, source: 'heading says you' };

    const usernames = currentUsernameCandidates();
    const usernameMatch = sides.find((side) => usernames.some((username) => normalizeName(side.heading).includes(username)));
    if (usernameMatch) return { side: usernameMatch, source: 'username heading match' };

    const editable = sides.map((side) => {
      const rows = tradeItemRowElements(side);
      const sideText = normalizeWhitespace([
        side.element?.innerText || '',
        ...rows.map((row) => row.innerText || ''),
      ].join(' '));
      const rowControls = rows.reduce((sum, row) => sum
        + row.querySelectorAll('input,button,select,[class*="delete"],[class*="remove"],[class*="trash"]').length, 0);
      return {
        side,
        controls: (side.element?.querySelectorAll?.('input,button,select,[class*="delete"],[class*="remove"],[class*="trash"]')?.length || 0) + rowControls,
        addText: /\b(?:add|remove) items?\b/i.test(sideText),
      };
    }).sort((a, b) => Number(b.addText) - Number(a.addText) || b.controls - a.controls);
    if (editable[0] && (editable[0].addText || editable[0].controls > (editable[1]?.controls || 0))) {
      return { side: editable[0].side, source: 'editable side' };
    }

    const left = sides.find((side) => side.side === 'left') || sides[0] || null;
    return left ? { side: left, source: 'assumed left; verify selector' } : { side: null, source: 'not found' };
  }

  function itemIdFromTradeRow(row) {
    const ancestors = [];
    let ancestor = row?.parentElement || null;
    for (let depth = 0; ancestor && depth < 4; depth += 1, ancestor = ancestor.parentElement) ancestors.push(ancestor);
    const elements = [row, ...row.querySelectorAll('[data-item-id],[data-itemid],[data-item],a[href],img[src]'), ...ancestors];
    for (const element of elements) {
      for (const value of [
        element.getAttribute?.('data-item-id'),
        element.getAttribute?.('data-itemid'),
        element.getAttribute?.('data-item'),
        element.getAttribute?.('href'),
        element.getAttribute?.('src'),
      ]) {
        const text = String(value || '');
        if (/^\d{1,6}$/.test(text)) return Number(text);
        const match = text.match(/(?:items?\/|item(?:id|ID)?[=/])(\d{1,6})(?:\D|$)/);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function parseTradeItemRow(row) {
    const text = normalizeWhitespace(row.innerText);
    if (!text || /no items in trade/i.test(text)) return null;
    const quantityMatch = text.match(/(?:\bx|×)\s*([\d,]+)\b/i);
    const dataQuantity = parseNumber(
      row.getAttribute('data-quantity')
      || row.getAttribute('data-qty')
      || row.querySelector('[data-quantity],[data-qty]')?.getAttribute('data-quantity')
      || row.querySelector('[data-quantity],[data-qty]')?.getAttribute('data-qty')
    );
    const quantity = Math.max(1, Math.floor(quantityMatch ? parseNumber(quantityMatch[1]) : (dataQuantity || 1)));
    const selectors = [
      'div.name',
      '.name-wrap .t-overflow',
      '[class*="desc___"] b',
      '[class*="name___"]',
      'img[alt]',
    ];
    let name = '';
    for (const selector of selectors) {
      const element = row.querySelector(selector);
      const candidate = selector === 'img[alt]'
        ? normalizeWhitespace(element?.getAttribute('alt'))
        : normalizeWhitespace(element?.innerText || element?.textContent);
      if (candidate && !/^(?:money|cash|points)$/i.test(candidate)) {
        name = candidate;
        break;
      }
    }
    if (!name) name = text;
    name = normalizeWhitespace(name
      .replace(/(?:\bx|×)\s*[\d,]+\b.*$/i, '')
      .replace(/\$[\d,.]+.*$/i, '')
      .replace(/\b(?:remove|details?)\b.*$/i, ''));
    if (!name || /^(?:money|cash|points|property|company|faction)$/i.test(name)) return null;
    return { row, name, quantity, itemId: itemIdFromTradeRow(row) };
  }

  function parseCombinedTradeItemRow(row) {
    const text = normalizeWhitespace(row?.innerText || '');
    const markerCount = (text.match(/(?:\bx|×)\s*[\d,]+\b/gi) || []).length;
    if (markerCount <= 1) return [];

    const matches = [];
    const catalogItems = Object.values(state.catalog.itemsByName || {})
      .filter((item) => item?.name)
      .sort((a, b) => b.name.length - a.name.length);
    for (const catalog of catalogItems) {
      const expression = new RegExp(String.raw`(?:^|\s)(${escapeRegExp(catalog.name)})\s*(?:x|×)\s*([\d,]+)(?=\s|$)`, 'gi');
      let match;
      while ((match = expression.exec(text))) {
        const leadingSpace = match[0].length - match[0].trimStart().length;
        const start = match.index + leadingSpace;
        const end = match.index + match[0].length;
        if (matches.some((existing) => start < existing.end && end > existing.start)) continue;
        matches.push({
          start,
          end,
          row,
          annotationRow: null,
          fallbackCombined: true,
          name: catalog.name,
          quantity: Math.max(1, Math.floor(parseNumber(match[2]) || 1)),
          itemId: catalog.id || null,
        });
      }
    }
    return matches.sort((a, b) => a.start - b.start);
  }

  function parseTradeItemsFromRow(row) {
    const combined = parseCombinedTradeItemRow(row);
    if (combined.length > 1) return combined;
    const parsed = parseTradeItemRow(row);
    return parsed ? [parsed] : [];
  }

  function cashFromTradeSide(side) {
    if (Number.isFinite(side?.cashValue)) return side.cashValue;
    if (!side?.element) return null;
    const sideText = normalizeWhitespace(side.element.innerText || '');
    if (/no money in trade/i.test(sideText)) return 0;
    const inTradeMatch = sideText.match(/\$\s*([\d,]+)\s+in trade/i);
    if (inTradeMatch) {
      const inTradeValue = parseNumber(inTradeMatch[1]);
      if (Number.isFinite(inTradeValue)) return inTradeValue;
    }
    const inputSelectors = [
      'input[name*="money" i]',
      'input[id*="money" i]',
      'input[class*="money" i]',
      'input[name*="cash" i]',
    ];
    for (const selector of inputSelectors) {
      const input = side.element.querySelector(selector);
      const value = parseNumber(input?.value);
      if (Number.isFinite(value)) return value;
    }

    const leafElements = [...side.element.querySelectorAll('span,div,p,strong,b,li')].filter((element) => {
      if ([...element.children].some((child) => /\$[\d,]+/.test(child.innerText || ''))) return false;
      return true;
    });
    for (const element of leafElements) {
      const text = normalizeWhitespace(element.innerText);
      if (!/\b(?:money|cash)\b/i.test(text)) continue;
      const match = text.match(/\$\s*([\d,]+)/) || text.match(/\b(?:money|cash)\b\s*:?-?\s*([\d,]+)/i);
      const value = match ? parseNumber(match[1]) : null;
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function clearTradeAnnotations() {
    document.querySelectorAll(`.${APP.tradeBadgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.tradeItemMark}`).forEach((element) => element.classList.remove(APP.tradeItemMark));
  }

  function addTradeItemBadge(item) {
    const annotationRow = item?.annotationRow === null ? null : (item?.annotationRow || item?.row);
    if (!state.settings.showTradeItemBreakdown || !annotationRow || !item.catalog) return;
    const badge = document.createElement('span');
    badge.className = APP.tradeBadgeClass;
    badge.dataset.tsimmGenerated = 'true';
    const marketTotal = item.catalog.marketPrice * item.quantity;
    const targetTotal = traderPayout(item.catalog.marketPrice) * item.quantity;
    badge.innerHTML = `<strong>Ⓣ ${escapeHtml(formatMoney(targetTotal))}</strong>`
      + `<span>Ⓜ ${escapeHtml(formatMoney(marketTotal))} · ${escapeHtml(formatInteger(item.quantity))} qty</span>`;
    annotationRow.classList.add(APP.tradeItemMark);
    annotationRow.appendChild(badge);
  }

  function scanTrade(stats) {
    const sides = tradeSideCandidates();
    stats.tradeSideCandidates = sides.length;
    if (sides.length < 2) {
      stats.tradeStatus = 'incomplete';
      stats.notes.push('Trade sides were not recognized. Copy diagnostics from the live trade page.');
      return;
    }

    const myResolution = determineMyTradeSide(sides);
    const mySide = myResolution.side;
    const otherSide = sides.find((side) => side !== mySide) || null;
    stats.tradeMySide = mySide?.side || null;
    stats.tradeSideSource = myResolution.source;
    if (!mySide || !otherSide) {
      stats.tradeStatus = 'incomplete';
      stats.notes.push('Could not determine both sides of the trade.');
      return;
    }

    const parsed = tradeItemRowElements(mySide).flatMap(parseTradeItemsFromRow);
    stats.tradeItemRows = parsed.length;
    const matched = [];
    const unmatched = [];
    for (const item of parsed) {
      const catalog = catalogItemFor(item.name, item.itemId);
      if (catalog) {
        const enriched = { ...item, catalog };
        matched.push(enriched);
        addTradeItemBadge(enriched);
      } else {
        unmatched.push({ name: item.name, quantity: item.quantity, itemId: item.itemId });
      }
    }
    if (parsed.some((item) => item.fallbackCombined)) {
      stats.notes.push('Trade items were recovered from Torn\'s grouped mobile manifest wrapper.');
    }
    const totals = manifestTotals(matched.map((item) => ({
      quantity: item.quantity,
      marketPrice: item.catalog.marketPrice,
    })));
    const traderCash = cashFromTradeSide(otherSide);
    const myCash = cashFromTradeSide(mySide);
    const netCash = Number.isFinite(traderCash)
      ? traderCash - (Number.isFinite(myCash) ? myCash : 0)
      : null;
    const difference = Number.isFinite(netCash) ? netCash - totals.targetTotal : null;
    const effectivePercent = Number.isFinite(netCash) && totals.marketTotal > 0
      ? netCash / totals.marketTotal * 100
      : null;

    stats.tradeMatchedItems = matched.length;
    stats.tradeUnmatchedItems = unmatched.length;
    stats.tradeMarketTotal = totals.marketTotal;
    stats.tradeTargetTotal = totals.targetTotal;
    stats.tradeTraderCash = traderCash;
    stats.tradeMyCash = myCash;
    stats.tradeNetCash = netCash;
    stats.tradeDifference = difference;
    stats.tradeEffectivePercent = effectivePercent;
    stats.tradeItems = matched.map((item) => ({
      name: item.catalog.name,
      quantity: item.quantity,
      marketPrice: item.catalog.marketPrice,
      marketTotal: item.catalog.marketPrice * item.quantity,
      targetEach: traderPayout(item.catalog.marketPrice),
      targetTotal: traderPayout(item.catalog.marketPrice) * item.quantity,
    }));
    stats.tradeUnmatched = unmatched;

    if (!parsed.length) {
      stats.tradeStatus = 'empty';
      stats.notes.push('No manifested items were found on your selected side.');
    } else if (unmatched.length) {
      stats.tradeStatus = 'incomplete';
      stats.notes.push(`${unmatched.length} trade item${unmatched.length === 1 ? '' : 's'} could not be priced, so the total is incomplete.`);
    } else if (!Number.isFinite(traderCash)) {
      stats.tradeStatus = 'pending';
      stats.notes.push('Your 99% target is ready; no cash offer was detected on the trader side yet.');
    } else if (difference >= 0) {
      stats.tradeStatus = 'good';
    } else {
      stats.tradeStatus = 'loss';
    }

    if (/assumed left/i.test(myResolution.source)) {
      stats.notes.push('IMM assumed your items are on the left. Use the Trade side selector to verify or override it.');
    }
  }

  function ownText(element) {
    if (!(element instanceof Element)) return '';
    return normalizeWhitespace([...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(' '));
  }

  function directTextElements(selector = 'span,div,p,strong,b') {
    return [...document.querySelectorAll(selector)].filter((element) => ownText(element));
  }

  function exactTextElements(regex, selector = 'span,div,p,strong,b') {
    return [...document.querySelectorAll(selector)].filter((element) => {
      if (element.closest(`#${APP.panelId}`) || element.closest(`.${APP.badgeClass}`)) return false;
      const text = normalizeWhitespace(element.innerText);
      if (!regex.test(text)) return false;
      return ![...element.children].some((child) => regex.test(normalizeWhitespace(child.innerText)));
    });
  }

  function countMatches(text, regex) {
    return [...String(text || '').matchAll(regex)].length;
  }

  function findCategoryCard(priceElement) {
    let node = priceElement;
    let best = null;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length > 260) continue;
      const priceMatches = countMatches(text, /\$[\d,.]+\s*\([\d,]+\)/g);
      if (priceMatches !== 1) continue;
      if (!node.querySelector('img')) continue;
      best = node;
      const parentText = normalizeWhitespace(node.parentElement?.innerText);
      const parentMatches = countMatches(parentText, /\$[\d,.]+\s*\([\d,]+\)/g);
      if (parentMatches > 1) break;
    }
    return best;
  }

  function extractCategoryName(card, priceText) {
    const lines = String(card?.innerText || '')
      .split(/\n+/)
      .map(normalizeWhitespace)
      .filter(Boolean)
      .filter((line) => line !== priceText)
      .filter((line) => !/^\$[\d,.]+\s*\([\d,]+\)$/.test(line));
    const likely = lines.find((line) =>
      line.length <= 80
      && !/^(buy|sell|value|circ|owner|cost|qty|popular|equipment|supplies|general)$/i.test(line)
      && !/^\d+$/.test(line)
    );
    return likely || '';
  }

  function itemIdFromCard(card) {
    const candidates = [
      ...card.querySelectorAll('[data-item-id],[data-itemid],[data-id],a[href],img[src]'),
      card,
    ];
    for (const element of candidates) {
      for (const value of [
        element.getAttribute?.('data-item-id'),
        element.getAttribute?.('data-itemid'),
        element.getAttribute?.('href'),
        element.getAttribute?.('src'),
      ]) {
        const text = String(value || '');
        const match = text.match(/(?:item(?:id|ID)?[=/]|items?\/)(\d{1,6})(?:\D|$)/);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function catalogItemFor(name, itemId = null) {
    if (itemId && state.catalog.itemsById?.[String(itemId)]) return state.catalog.itemsById[String(itemId)];
    return state.catalog.itemsByName?.[normalizeName(name)] || null;
  }

  function categoryCandidates() {
    const candidates = [];
    const seen = new Set();
    const categoryPriceRegex = /^\$[\d,.]+\s*\([\d,]+\)$/;
    const priceElements = exactTextElements(categoryPriceRegex);
    for (const priceElement of priceElements) {
      const priceText = normalizeWhitespace(priceElement.innerText);
      const match = priceText.match(/^\$([\d,.]+)\s*\(([\d,]+)\)$/);
      if (!match) continue;
      const card = findCategoryCard(priceElement);
      if (!card || seen.has(card)) continue;
      seen.add(card);
      const name = extractCategoryName(card, priceText);
      candidates.push({
        card,
        priceElement,
        name,
        itemId: itemIdFromCard(card),
        lowestPrice: parseNumber(match[1]),
        marketQuantity: parseNumber(match[2]),
      });
    }
    return candidates;
  }

  function findVisibleMarketValue() {
    const elements = exactTextElements(/^Value:\s*\$[\d,.]+$/i);
    for (const element of elements) {
      const text = normalizeWhitespace(element.innerText);
      const match = text.match(/^Value:\s*\$([\d,.]+)$/i);
      if (match) return parseNumber(match[1]);
    }
    const bodyText = normalizeWhitespace(document.body?.innerText);
    const fallback = bodyText.match(/\bValue:\s*\$([\d,.]+)/i);
    return fallback ? parseNumber(fallback[1]) : null;
  }

  function itemIdFromLocation() {
    const href = String(location.href || '');
    const match = href.match(/[?&#]item(?:id)?=(\d{1,6})(?:\D|$)/i)
      || href.match(/\bitem(?:id)?[=/](\d{1,6})(?:\D|$)/i);
    const id = match ? Number(match[1]) : null;
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  function listingItemNameFromPage() {
    const candidates = document.querySelectorAll(
      'h1,h2,h3,[role="heading"],[class*="title"],[class*="name"]'
    );
    for (const element of candidates) {
      if (!visibleElement(element)) continue;
      const text = normalizeWhitespace(element.textContent);
      if (!text || text.length > 100) continue;
      const item = state.catalog.itemsByName?.[normalizeName(text)];
      if (item) return item.name;
    }
    return '';
  }

  function resolveListingMarketValue() {
    const visibleValue = findVisibleMarketValue();
    if (Number.isFinite(visibleValue) && visibleValue > 0) {
      const itemId = itemIdFromLocation();
      const item = itemId ? state.catalog.itemsById?.[String(itemId)] : null;
      return {
        value: visibleValue,
        visibleValue,
        source: 'visible-value',
        itemId,
        itemName: item?.name || listingItemNameFromPage() || null,
      };
    }

    const itemId = itemIdFromLocation();
    if (itemId) {
      const item = state.catalog.itemsById?.[String(itemId)];
      if (item?.marketPrice > 0) {
        return {
          value: item.marketPrice,
          visibleValue: null,
          source: 'catalog-item-id',
          itemId,
          itemName: item.name,
        };
      }
    }

    const itemName = listingItemNameFromPage();
    const item = itemName ? state.catalog.itemsByName?.[normalizeName(itemName)] : null;
    if (item?.marketPrice > 0) {
      return {
        value: item.marketPrice,
        visibleValue: null,
        source: 'catalog-item-name',
        itemId: item.id || null,
        itemName: item.name,
      };
    }

    return {
      value: null,
      visibleValue: null,
      source: null,
      itemId: itemId || null,
      itemName: itemName || null,
    };
  }

  function findListingRow(priceElement) {
    let node = priceElement;
    let best = null;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length > 220) continue;
      const prices = countMatches(text, /\$[\d,.]+/g);
      if (prices !== 1) continue;
      const integerCells = [...node.querySelectorAll('span,div,p,strong,b')]
        .map((element) => ownText(element))
        .filter((value) => /^\d[\d,]*$/.test(value));
      if (!integerCells.length) continue;
      best = node;
      const parentText = normalizeWhitespace(node.parentElement?.innerText);
      if (countMatches(parentText, /\$[\d,.]+/g) > 1) break;
    }
    return best;
  }

  function extractListingQuantity(row, priceElement) {
    const all = [...row.querySelectorAll('span,div,p,strong,b')]
      .filter((element) => element !== priceElement)
      .map((element) => ({ element, text: ownText(element) }))
      .filter((entry) => /^\d[\d,]*$/.test(entry.text));
    if (!all.length) {
      const rowText = normalizeWhitespace(row.innerText);
      const match = rowText.match(/\$[\d,.]+\s+([\d,]+)(?:\s|$)/);
      return match ? parseNumber(match[1]) : null;
    }
    const priceRect = priceElement.getBoundingClientRect();
    const after = all
      .map((entry) => ({ ...entry, rect: entry.element.getBoundingClientRect() }))
      .filter((entry) => entry.rect.left >= priceRect.left || entry.rect.top >= priceRect.top)
      .sort((a, b) =>
        Math.abs(a.rect.top - priceRect.top) - Math.abs(b.rect.top - priceRect.top)
        || a.rect.left - b.rect.left
      );
    return parseNumber((after[0] || all[all.length - 1]).text);
  }

  function listingCandidates() {
    const candidates = [];
    const seen = new Set();
    const priceElements = exactTextElements(/^\$[\d,.]+$/);
    for (const priceElement of priceElements) {
      const row = findListingRow(priceElement);
      if (!row || seen.has(row)) continue;
      const price = parseNumber(normalizeWhitespace(priceElement.innerText));
      const quantity = extractListingQuantity(row, priceElement);
      if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) continue;
      seen.add(row);
      candidates.push({ row, priceElement, price, quantity });
    }
    return candidates;
  }

  function clearAnnotations() {
    clearTradeAnnotations();
    document.querySelectorAll(`.${APP.badgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.categoryMark}`).forEach((element) => {
      element.classList.remove(APP.categoryMark, 'tsimm-tier-good', 'tsimm-tier-minor', 'tsimm-tier-loss');
    });
    document.querySelectorAll(`.${APP.listingMark}`).forEach((element) => {
      element.classList.remove(APP.listingMark, 'tsimm-tier-good', 'tsimm-tier-minor', 'tsimm-tier-loss');
    });
  }

  function badgeHtml(margin, mode) {
    const sign = margin.profitEach > 0 ? '+' : '';
    const auditLine = `Ⓜ ${formatMoney(margin.value)} · Ⓣ ${formatMoney(margin.payout)}`;
    if (mode === 'category') {
      return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
        + `<span>${escapeHtml(auditLine)}</span>`
        + `<span>${escapeHtml(formatPercent(margin.roiPercent))} ROI</span>`;
    }
    const totalSign = margin.totalProfit > 0 ? '+' : '';
    return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
      + `<span>${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} lot · ${escapeHtml(formatPercent(margin.roiPercent))}</span>`
      + `<span>${escapeHtml(auditLine)}</span>`;
  }

  function addBadge(target, margin, mode, highlightTarget = target) {
    if (margin.tier === 'loss' && !state.settings.showLossesDuringTesting) return;
    const badge = document.createElement('span');
    badge.className = `${APP.badgeClass} tsimm-badge-${mode} tsimm-tier-${margin.tier}`;
    badge.dataset.tsimmGenerated = 'true';
    badge.innerHTML = badgeHtml(margin, mode);
    if (mode === 'category') {
      const computed = getComputedStyle(target);
      if (computed.position === 'static') target.style.position = 'relative';
      highlightTarget.classList.add(APP.categoryMark, `tsimm-tier-${margin.tier}`);
      target.appendChild(badge);
    } else {
      highlightTarget.classList.add(APP.listingMark, `tsimm-tier-${margin.tier}`);
      target.appendChild(badge);
    }
  }

  function scanCategory(stats) {
    const candidates = categoryCandidates();
    stats.categoryCandidates = candidates.length;
    for (const candidate of candidates) {
      const catalog = catalogItemFor(candidate.name, candidate.itemId);
      if (!catalog || !candidate.lowestPrice) continue;
      const margin = marginFor(candidate.lowestPrice, catalog.marketPrice, 1);
      addBadge(candidate.card, margin, 'category');
      stats.categoryMatched += 1;
      if (margin.tier === 'good') stats.categoryGood += 1;
      if (margin.tier === 'minor') stats.categoryMinor += 1;
      if (margin.tier === 'loss') stats.categoryLoss += 1;
    }
  }

  function scanListings(stats) {
    const candidates = listingCandidates();
    stats.listingCandidates = candidates.length;

    const resolution = resolveListingMarketValue();
    stats.visibleMarketValue = resolution.visibleValue;
    stats.listingMarketValue = resolution.value;
    stats.listingMarketValueSource = resolution.source;
    stats.listingItemId = resolution.itemId;
    stats.listingItemName = resolution.itemName;
    if (!resolution.value) return;

    for (const candidate of candidates) {
      const margin = marginFor(candidate.price, resolution.value, candidate.quantity);
      addBadge(candidate.priceElement, margin, 'listing', candidate.row);
      stats.listingMatched += 1;
      if (margin.tier === 'good') stats.listingGood += 1;
      if (margin.tier === 'minor') stats.listingMinor += 1;
      if (margin.tier === 'loss') stats.listingLoss += 1;
    }
  }

  function detectPageType(stats) {
    if (stats.tradeSideCandidates) return 'trade';
    if (stats.listingCandidates) return stats.listingMarketValue ? 'item listings' : 'item listings (value unresolved)';
    if (stats.categoryCandidates) return 'category';
    return 'unknown';
  }

  function scanPage() {
    const isItemMarket = pageLooksLikeItemMarket();
    const isTrade = pageLooksLikeTrade();
    if (!isItemMarket && !isTrade) {
      clearAnnotations();
      document.getElementById(APP.panelId)?.remove();
      state.lastScan = emptyScanStats();
      state.lastScan.notes.push('Waiting for the Item Market or Trade page.');
      return;
    }
    clearAnnotations();
    const stats = emptyScanStats();
    if (isItemMarket) {
      scanCategory(stats);
      scanListings(stats);
    }
    if (isTrade) scanTrade(stats);
    stats.pageType = isTrade ? 'trade' : detectPageType(stats);
    stats.scannedAt = new Date().toISOString();
    if (!catalogCount()) stats.notes.push('No catalog values cached. Press Sync values.');
    if (stats.categoryCandidates && !stats.categoryMatched) {
      stats.notes.push('Category tiles were found, but their names did not match the cached catalog.');
    }
    if (stats.listingMarketValue && !stats.listingCandidates) {
      stats.notes.push('The item value was resolved, but listing rows were not recognized.');
    }
    if (stats.listingCandidates && !stats.listingMarketValue) {
      stats.notes.push('Listing rows were found, but no market value could be resolved from the page or cached item ID.');
    }
    if (stats.listingMarketValueSource === 'catalog-item-id') {
      stats.notes.push('The compact listing page hid Value; IMM used the cached catalog value for the itemID in the URL.');
    }
    state.lastScan = stats;
    renderPanel();
  }

  function pageLooksLikeItemMarket() {
    const href = location.href.toLowerCase();
    if (href.includes('itemmarket') || href.includes('item-market') || href.includes('imarket')) return true;
    const title = normalizeWhitespace(document.querySelector('h1,h2,[role="heading"]')?.textContent);
    if (/item market/i.test(title)) return true;
    return /\bItem Market\b/i.test(document.body?.innerText || '');
  }

  function scheduleScan(delay = APP.scanDelayMs) {
    clearTimeout(state.scanTimer);
    state.scanTimer = setTimeout(scanPage, delay);
  }


  function parsePurchaseConfirmationText(value) {
    const text = normalizeWhitespace(value);
    const match = text.match(/\bBuy\s+([\d,]+)\s*x\s+(.+?)\s+for\s+\$([\d,]+)/i);
    if (!match) return null;
    const quantity = Math.max(0, Math.floor(parseNumber(match[1]) || 0));
    const itemName = normalizeWhitespace(match[2]);
    const totalCost = Math.max(0, parseNumber(match[3]) || 0);
    if (!itemName || quantity <= 0 || totalCost <= 0) return null;
    return {
      itemName,
      quantity,
      totalCost,
      unitCost: totalCost / quantity,
      confirmationText: match[0],
    };
  }

  function purchaseConfirmationFromClick(target) {
    const clickable = target instanceof Element ? target.closest('button,a,[role="button"],span,div') : null;
    const clickedText = normalizeWhitespace(clickable?.textContent || target?.textContent);
    if (!/^yes$/i.test(clickedText)) return null;
    let node = clickable;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      const text = normalizeWhitespace(node.textContent);
      if (!text || text.length > 1200 || !/\bYes\b/i.test(text) || !/\bNo\b/i.test(text)) continue;
      const parsed = parsePurchaseConfirmationText(text);
      if (parsed) return { ...parsed, container: node };
    }
    return null;
  }

  function beginPendingPurchase(parsed) {
    const resolution = resolveListingMarketValue();
    const itemId = resolution.itemId || itemIdFromLocation();
    const catalog = catalogItemFor(parsed.itemName, itemId);
    const itemName = catalog?.name || resolution.itemName || parsed.itemName;
    const marketValue = Number(catalog?.marketPrice || resolution.value || 0);
    state.pendingPurchase = {
      id: createId('pending'),
      itemId: catalog?.id || itemId || null,
      itemName,
      quantity: parsed.quantity,
      unitCost: parsed.unitCost,
      totalCost: parsed.totalCost,
      marketValue,
      traderValue: traderPayout(marketValue),
      source: 'item-market',
      createdAt: new Date().toISOString(),
      purchaseUrl: location.href,
      confirmationText: parsed.confirmationText,
    };
    savePendingPurchase();
    recordPurchaseSignal('pending', 'click', parsed.confirmationText, location.href);
    renderPanel();
  }

  function recordPurchaseSignal(type, source, snippet = '', url = '') {
    state.purchaseSignals.unshift({
      at: new Date().toISOString(),
      type,
      source,
      snippet: normalizeWhitespace(snippet).slice(0, 360),
      url: normalizeWhitespace(url).slice(0, 300),
      pendingId: state.pendingPurchase?.id || null,
    });
    state.purchaseSignals = state.purchaseSignals.slice(0, 20);
  }

  function parsePurchaseSuccessText(value) {
    const text = normalizeWhitespace(value);
    const match = text.match(/\bYou\s+bought\s+([\d,]+)\s*x\s+(.+?)\s+from\s+(.+?)\s+for\s+(?:a\s+total\s+of\s+)?\$([\d,]+)\b/i);
    if (!match) return null;
    const quantity = Math.max(0, Math.floor(parseNumber(match[1]) || 0));
    const itemName = normalizeWhitespace(match[2]);
    const sellerName = normalizeWhitespace(match[3]);
    const totalCost = Math.max(0, parseNumber(match[4]) || 0);
    if (!itemName || quantity <= 0 || totalCost <= 0) return null;
    return {
      itemName,
      sellerName,
      quantity,
      totalCost,
      unitCost: totalCost / quantity,
      successText: match[0],
    };
  }

  function purchaseFingerprint(parsed) {
    return [
      normalizeName(parsed?.itemName),
      Math.floor(Number(parsed?.quantity) || 0),
      Math.round(Number(parsed?.totalCost) || 0),
      normalizeName(parsed?.sellerName),
      Number(itemIdFromLocation()) || 0,
    ].join('|');
  }

  function pruneRecentPurchaseFingerprints() {
    const cutoff = Date.now() - APP.duplicatePurchaseWindowMs;
    state.recentPurchaseFingerprints = (Array.isArray(state.recentPurchaseFingerprints)
      ? state.recentPurchaseFingerprints
      : [])
      .filter((entry) => Number(entry?.at) >= cutoff)
      .slice(0, 30);
  }

  function hasRecentPurchaseFingerprint(fingerprint) {
    pruneRecentPurchaseFingerprints();
    return state.recentPurchaseFingerprints.some((entry) => entry?.fingerprint === fingerprint);
  }

  function rememberPurchaseFingerprint(fingerprint) {
    pruneRecentPurchaseFingerprints();
    state.recentPurchaseFingerprints.unshift({ fingerprint, at: Date.now() });
    state.recentPurchaseFingerprints = state.recentPurchaseFingerprints.slice(0, 30);
    saveJson(APP.recentPurchaseFingerprintsStorageKey, state.recentPurchaseFingerprints);
  }

  function capturePurchaseDirectlyFromSuccessText(value, source = 'dom-success-fallback', url = '') {
    if (!pageLooksLikeItemMarket()) return null;
    const parsed = parsePurchaseSuccessText(value);
    if (!parsed) return null;
    const fingerprint = purchaseFingerprint(parsed);
    if (hasRecentPurchaseFingerprint(fingerprint)) return null;

    if (state.pendingPurchase) {
      const pendingMatches = normalizeName(state.pendingPurchase.itemName) === normalizeName(parsed.itemName)
        && Number(state.pendingPurchase.quantity) === Number(parsed.quantity)
        && Math.round(Number(state.pendingPurchase.totalCost)) === Math.round(Number(parsed.totalCost));
      if (pendingMatches) {
        rememberPurchaseFingerprint(fingerprint);
        recordPurchaseSignal('success', source, parsed.successText, url);
        return commitPendingPurchase(source, parsed.successText);
      }
    }

    const itemId = itemIdFromLocation();
    const catalog = catalogItemFor(parsed.itemName, itemId);
    const marketValueAtPurchase = Number(catalog?.marketPrice || resolveListingMarketValue().value || 0);
    const lot = buildLedgerLot({
      source: 'item-market',
      venue: 'item-market',
      itemId: catalog?.id || itemId || null,
      itemName: catalog?.name || parsed.itemName,
      quantity: parsed.quantity,
      unitCost: parsed.unitCost,
      marketValueAtPurchase,
      traderValueAtPurchase: traderPayout(marketValueAtPurchase),
      capturedAt: new Date().toISOString(),
      purchaseUrl: url || location.href,
      notes: parsed.sellerName
        ? `Seller: ${parsed.sellerName}. Captured from Torn success message.`
        : 'Captured from Torn success message.',
    }, source);

    rememberPurchaseFingerprint(fingerprint);
    recordPurchaseSignal('success', source, parsed.successText, url);
    addLedgerLot(lot);
    toast(`Ledger auto-recorded ${formatInteger(lot.quantity)}× ${lot.itemName}.`);
    return lot;
  }

  function purchaseFailurePattern(value) {
    return /\b(?:purchase|buy|bought|item)\b.{0,80}\b(?:failed|failure|error|unable|cannot|could not|not enough|insufficient|unavailable|no longer available|already sold|someone else)\b/i.test(value)
      || /\b(?:not enough money|insufficient funds|item is unavailable|listing is unavailable)\b/i.test(value);
  }

  function purchaseSuccessPattern(value) {
    return /\b(?:you\s+(?:have\s+)?(?:successfully\s+)?(?:bought|purchased)|successfully\s+(?:bought|purchased)|purchase\s+(?:was\s+)?(?:successful|completed)|items?\s+(?:were|have been)\s+(?:bought|purchased)|bought\s+[\d,]+\s*x)\b/i.test(value);
  }

  function inspectPurchaseSignal(value, source = 'dom', url = '') {
    const text = normalizeWhitespace(value);
    if (!text) return;
    const directCapture = capturePurchaseDirectlyFromSuccessText(text, source === 'dom' ? 'dom-success-fallback' : source, url);
    if (directCapture || !state.pendingPurchase) return;
    if (purchaseFailurePattern(text)) {
      recordPurchaseSignal('failure', source, text, url);
      discardPendingPurchase('Purchase was not recorded because Torn reported a failure.');
      return;
    }
    if (purchaseSuccessPattern(text)) {
      recordPurchaseSignal('success', source, text, url);
      commitPendingPurchase(`${source}-success`, text);
    }
  }

  function inspectPurchasePayload(payload, source, url) {
    if (!state.pendingPurchase || payload === null || payload === undefined) return;
    if (typeof payload === 'string') {
      inspectPurchaseSignal(payload, source, url);
      try {
        inspectPurchasePayload(JSON.parse(payload), source, url);
      } catch {
        // Non-JSON responses are still checked as text above.
      }
      return;
    }
    if (typeof payload !== 'object') return;

    const message = normalizeWhitespace(
      payload.message ?? payload.text ?? payload.msg ?? payload.error?.error ?? payload.error
    );
    if (message) inspectPurchaseSignal(message, source, url);
    if (!state.pendingPurchase) return;

    const status = normalizeWhitespace(payload.status ?? payload.result).toLowerCase();
    const explicitFailure = payload.success === false
      || payload.ok === false
      || Boolean(payload.error && payload.error !== false)
      || ['error', 'failed', 'failure'].includes(status);
    if (explicitFailure) {
      recordPurchaseSignal('failure', source, message || status || 'Explicit failure response', url);
      discardPendingPurchase('Purchase was not recorded because Torn rejected it.');
      return;
    }

    const explicitSuccess = payload.success === true
      || payload.ok === true
      || ['success', 'successful', 'ok', 'completed'].includes(status);
    if (explicitSuccess) {
      recordPurchaseSignal('success', source, message || status || 'Explicit success response', url);
      commitPendingPurchase(`${source}-success`, message || status || 'success=true');
    }
  }

  function relevantItemMarketRequest(value) {
    const url = String(value || '').toLowerCase();
    return url.includes('itemmarket')
      || url.includes('item-market')
      || url.includes('sid=itemmarket')
      || (url.includes('page.php') && pageLooksLikeItemMarket());
  }

  function installNetworkObservers() {
    if (state.networkObserversBound) return;
    state.networkObserversBound = true;

    try {
      const originalFetch = window.fetch;
      if (typeof originalFetch === 'function' && !originalFetch.__tsimmWrapped) {
        const wrappedFetch = async function(...args) {
          const requestUrl = String(args[0]?.url || args[0] || location.href);
          const pendingIdAtStart = state.pendingPurchase?.id || null;
          const response = await originalFetch.apply(this, args);
          if (pendingIdAtStart && pendingIdAtStart === state.pendingPurchase?.id && relevantItemMarketRequest(requestUrl)) {
            response.clone().text()
              .then((body) => inspectPurchasePayload(body, 'fetch', requestUrl))
              .catch(() => {});
          }
          return response;
        };
        wrappedFetch.__tsimmWrapped = true;
        window.fetch = wrappedFetch;
      }
    } catch (error) {
      console.debug('[TornScripture IMM] Fetch observer unavailable:', error);
    }

    try {
      const XHR = window.XMLHttpRequest;
      if (XHR?.prototype && !XHR.prototype.send.__tsimmWrapped) {
        const originalOpen = XHR.prototype.open;
        const originalSend = XHR.prototype.send;
        XHR.prototype.open = function(method, url, ...rest) {
          this.__tsimmUrl = String(url || '');
          return originalOpen.call(this, method, url, ...rest);
        };
        const wrappedSend = function(...args) {
          const pendingIdAtStart = state.pendingPurchase?.id || null;
          this.addEventListener('load', () => {
            if (!pendingIdAtStart || pendingIdAtStart !== state.pendingPurchase?.id) return;
            if (!relevantItemMarketRequest(this.__tsimmUrl)) return;
            try {
              inspectPurchasePayload(this.responseText, 'xhr', this.__tsimmUrl);
            } catch {
              // Some response types do not expose responseText.
            }
          }, { once: true });
          return originalSend.apply(this, args);
        };
        wrappedSend.__tsimmWrapped = true;
        XHR.prototype.send = wrappedSend;
      }
    } catch (error) {
      console.debug('[TornScripture IMM] XHR observer unavailable:', error);
    }
  }

  function capturePurchaseIntentFromClick(event) {
    if (!pageLooksLikeItemMarket() || event.target.closest?.(`#${APP.panelId},#${APP.ledgerOverlayId}`)) return;
    const parsed = purchaseConfirmationFromClick(event.target);
    if (!parsed) return;
    beginPendingPurchase(parsed);
  }

  function promptLedgerLot(existing = null) {
    const defaultName = existing?.itemName || listingItemNameFromPage() || '';
    const itemName = normalizeWhitespace(prompt('Item name:', defaultName));
    if (!itemName) return null;
    const quantity = Math.floor(Number(prompt('Quantity purchased:', String(existing?.quantity || 1))) || 0);
    if (quantity <= 0) return null;
    const unitCost = Number(prompt('Price paid per item:', String(existing?.unitCost || 0))) || 0;
    if (unitCost <= 0) return null;
    const catalog = catalogItemFor(itemName, existing?.itemId);
    const marketValueAtPurchase = Number(prompt(
      'Market value per item at purchase:',
      String(existing?.marketValueAtPurchase || catalog?.marketPrice || 0)
    )) || 0;
    const source = normalizeWhitespace(prompt(
      'Source (item-market, overseas, bazaar, manual):',
      existing?.source || 'manual'
    )) || 'manual';
    const country = source === 'overseas'
      ? normalizeWhitespace(prompt('Country or destination (optional):', existing?.country || ''))
      : normalizeWhitespace(existing?.country);
    const notes = normalizeWhitespace(prompt('Notes (optional):', existing?.notes || ''));
    return buildLedgerLot({
      itemId: existing?.itemId || catalog?.id || null,
      itemName: catalog?.name || itemName,
      quantity,
      unitCost,
      marketValueAtPurchase,
      source,
      venue: source,
      country,
      location: existing?.location || '',
      capturedAt: existing?.capturedAt || new Date().toISOString(),
      purchaseUrl: existing?.purchaseUrl || location.href,
      notes,
    }, existing ? existing.captureMethod || 'manual-edit' : 'manual');
  }

  function editLedgerLot(id) {
    const index = state.ledger.lots.findIndex((lot) => lot.id === id);
    if (index < 0) return;
    const existing = state.ledger.lots[index];
    const updated = promptLedgerLot(existing);
    if (!updated) return;
    updated.id = existing.id;
    updated.remainingQuantity = Math.min(updated.quantity, existing.remainingQuantity ?? updated.quantity);
    updated.status = updated.remainingQuantity > 0 ? existing.status || 'open' : 'closed';
    state.ledger.lots[index] = updated;
    saveLedger();
    renderLedger();
    renderPanel();
  }

  function deleteLedgerLot(id) {
    const lot = state.ledger.lots.find((entry) => entry.id === id);
    if (!lot || !confirm(`Delete the recorded purchase of ${lot.quantity}× ${lot.itemName}?`)) return;
    state.ledger.lots = state.ledger.lots.filter((entry) => entry.id !== id);
    saveLedger();
    renderLedger();
    renderPanel();
  }

  async function copyLedgerJson() {
    const text = JSON.stringify(state.ledger, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast('Ledger JSON copied.');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast('Ledger JSON copied.');
    }
  }

  function importLedgerJson() {
    const raw = prompt('Paste an IMM ledger JSON export. Existing lots will be preserved and matching IDs will be replaced.');
    if (!raw) return;
    try {
      const imported = normalizeLedger(JSON.parse(raw));
      if (!imported.lots.length) throw new Error('No valid purchase lots were found.');
      const merged = new Map(state.ledger.lots.map((lot) => [lot.id, lot]));
      for (const lot of imported.lots) merged.set(lot.id, lot);
      state.ledger = normalizeLedger({ lots: [...merged.values()] });
      saveLedger();
      renderLedger();
      renderPanel();
      toast(`Imported ${formatInteger(imported.lots.length)} purchase lots.`);
    } catch (error) {
      toast(error?.message || 'Ledger import failed.');
    }
  }

  function ledgerLotHtml(lot) {
    const profitClass = lot.expectedProfitTotal >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss';
    const when = (() => {
      const date = new Date(lot.capturedAt);
      return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown date';
    })();
    const source = lot.country ? `${lot.source} · ${lot.country}` : lot.source;
    return `
      <article class="tsimm-ledger-lot" data-tsimm-lot-id="${escapeHtml(lot.id)}">
        <div class="tsimm-ledger-lot-head">
          <strong>${escapeHtml(lot.itemName)} × ${formatInteger(lot.quantity)}</strong>
          <span>${escapeHtml(source)}</span>
        </div>
        <div class="tsimm-ledger-lot-grid">
          <span>Paid each</span><strong>${formatMoney(lot.unitCost)}</strong>
          <span>Total cost</span><strong>${formatMoney(lot.totalCost)}</strong>
          <span>Ⓜ at purchase</span><strong>${formatMoney(lot.marketValueAtPurchase)}</strong>
          <span>Ⓣ at purchase</span><strong>${formatMoney(lot.traderValueAtPurchase)}</strong>
          <span>Expected profit</span><strong class="${profitClass}">${lot.expectedProfitTotal >= 0 ? '+' : ''}${formatMoney(lot.expectedProfitTotal)}</strong>
        </div>
        <div class="tsimm-ledger-lot-foot">
          <small>${escapeHtml(when)} · ${escapeHtml(lot.captureMethod)}</small>
          <div>
            <button type="button" data-tsimm-action="ledger-edit" data-tsimm-lot-id="${escapeHtml(lot.id)}">Edit</button>
            <button type="button" data-tsimm-action="ledger-delete" data-tsimm-lot-id="${escapeHtml(lot.id)}">Delete</button>
          </div>
        </div>
        ${lot.notes ? `<div class="tsimm-ledger-notes">${escapeHtml(lot.notes)}</div>` : ''}
      </article>
    `;
  }

  function renderLedger() {
    const overlay = document.getElementById(APP.ledgerOverlayId);
    if (!overlay) return;
    const summary = ledgerSummary();
    const lots = state.ledger.lots || [];
    overlay.innerHTML = `
      <div class="tsimm-ledger-shell">
        <div class="tsimm-ledger-head">
          <div><strong>📒 IMM Purchase Ledger</strong><small>Local purchase lots · schema v1</small></div>
          <button type="button" data-tsimm-action="ledger-close">×</button>
        </div>
        <div class="tsimm-ledger-summary">
          <div><strong>${formatInteger(summary.lots)}</strong><span>lots</span></div>
          <div><strong>${formatInteger(summary.itemTypes)}</strong><span>items</span></div>
          <div><strong>${formatMoney(summary.invested)}</strong><span>invested</span></div>
          <div><strong class="${summary.expectedProfit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${summary.expectedProfit >= 0 ? '+' : ''}${formatMoney(summary.expectedProfit)}</strong><span>expected</span></div>
        </div>
        <div class="tsimm-ledger-actions">
          <button type="button" data-tsimm-action="ledger-add">Add manual lot</button>
          <button type="button" data-tsimm-action="ledger-copy">Copy JSON</button>
          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-clear">Clear all</button>
        </div>
        <div class="tsimm-ledger-future">Source fields already support overseas lots. Automatic overseas capture comes later.</div>
        <div class="tsimm-ledger-list">
          ${lots.length ? lots.map(ledgerLotHtml).join('') : '<div class="tsimm-ledger-empty">No purchase lots recorded yet. Complete an Item Market purchase or add one manually.</div>'}
        </div>
      </div>
    `;
  }

  function openLedger() {
    injectStyles();
    let overlay = document.getElementById(APP.ledgerOverlayId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = APP.ledgerOverlayId;
      overlay.dataset.tsimmGenerated = 'true';
      document.body.appendChild(overlay);
    }
    renderLedger();
  }

  function closeLedger() {
    document.getElementById(APP.ledgerOverlayId)?.remove();
  }

  function pendingPurchaseHtml() {
    const pending = state.pendingPurchase;
    if (!pending) return '';
    return `
      <div class="tsimm-pending-card">
        <strong>Pending purchase capture</strong>
        <span>${escapeHtml(pending.itemName)} × ${formatInteger(pending.quantity)}</span>
        <span>${formatMoney(pending.unitCost)} each · ${formatMoney(pending.totalCost)} total</span>
        <small>Waiting for Torn's success response. Use Record only if the purchase completed but automatic confirmation was missed.</small>
        <div>
          <button type="button" data-tsimm-action="pending-record">Record completed</button>
          <button type="button" data-tsimm-action="pending-discard">Discard</button>
        </div>
      </div>
    `;
  }

  function diagnostics() {
    const categorySample = categoryCandidates().slice(0, 8).map((item) => ({
      name: item.name,
      itemId: item.itemId,
      lowestPrice: item.lowestPrice,
      marketQuantity: item.marketQuantity,
      catalogMatch: Boolean(catalogItemFor(item.name, item.itemId)),
      cardTag: item.card.tagName,
      cardClass: item.card.className,
      priceTag: item.priceElement.tagName,
      priceClass: item.priceElement.className,
    }));
    const listingSample = listingCandidates().slice(0, 8).map((item) => ({
      price: item.price,
      quantity: item.quantity,
      rowTag: item.row.tagName,
      rowClass: item.row.className,
      priceTag: item.priceElement.tagName,
      priceClass: item.priceElement.className,
    }));
    const tradeSides = pageLooksLikeTrade() ? tradeSideCandidates() : [];
    const tradeSample = tradeSides.map((side) => ({
      side: side.side,
      heading: side.heading,
      rowCount: tradeItemRowElements(side).length,
      cash: cashFromTradeSide(side),
      tag: side.element.tagName,
      className: side.element.className,
      detectionSource: side.source || null,
      presetCashValue: Number.isFinite(side.cashValue) ? side.cashValue : null,
      itemRows: tradeItemRowElements(side).flatMap(parseTradeItemsFromRow).slice(0, 12).map((parsed) => ({
        name: parsed.name,
        quantity: parsed.quantity,
        itemId: parsed.itemId,
        catalogMatch: Boolean(catalogItemFor(parsed.name, parsed.itemId)),
        fallbackCombined: Boolean(parsed.fallbackCombined),
        tag: parsed.row?.tagName || null,
        className: parsed.row?.className || null,
        text: normalizeWhitespace(parsed.row?.innerText || '').slice(0, 180),
      })),
    }));
    return {
      app: `${APP.name} v${APP.version}`,
      url: location.href,
      userAgent: navigator.userAgent,
      cachedCatalogItems: catalogCount(),
      catalogUpdatedAt: state.catalog.updatedAt,
      settings: state.settings,
      calculationPolicy: {
        traderPercent: TRADER_PERCENT,
        payoutFormula: 'floor(marketValue * 0.99)',
        profitFormula: 'traderPayout - listingPrice',
        manifestFormula: 'sum(floor(itemMarketValue * 0.99) * quantity)',
        tradeDifferenceFormula: 'otherSideCash - mySideCash - manifestTarget',
      },
      lastScan: state.lastScan,
      ledger: {
        summary: ledgerSummary(),
        updatedAt: state.ledger.updatedAt,
        recentLots: state.ledger.lots.slice(0, 8),
      },
      pendingPurchase: state.pendingPurchase,
      recentPurchaseSignals: state.purchaseSignals.slice(0, 12),
      categorySample,
      listingSample,
      tradeSample,
    };
  }

  async function copyDiagnostics() {
    const text = JSON.stringify(diagnostics(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast('Diagnostics copied.');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast('Diagnostics copied.');
    }
  }

  function updateSetting(key, value) {
    state.settings = { ...state.settings, [key]: value };
    saveJson(APP.settingsStorageKey, state.settings);
    scheduleScan(25);
    renderPanel();
  }

  function injectStyles() {
    if (document.getElementById(APP.styleId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      #${APP.panelId}{position:fixed;right:8px;bottom:118px;width:min(292px,calc(100vw - 16px));z-index:2147483000;border:1px solid #58506b;border-radius:12px;background:#1d1b22;color:#f4f1f8;box-shadow:0 10px 30px #0009;font:12px/1.35 Arial,sans-serif;overflow:hidden}
      #${APP.panelId} *{box-sizing:border-box}
      #${APP.panelId}.tsimm-collapsed{width:auto}
      .tsimm-head{display:flex;align-items:center;gap:7px;padding:8px 9px;background:#292530;border-bottom:1px solid #4e475b}
      .tsimm-head strong{flex:1;font-size:13px}.tsimm-head small{color:#aaa1b7}.tsimm-head button,.tsimm-btn{border:1px solid #625a70;border-radius:7px;background:#393341;color:#fff;padding:6px 8px;font-weight:700;cursor:pointer}
      .tsimm-head button{padding:2px 7px}.tsimm-body{padding:9px}.tsimm-collapsed .tsimm-body,.tsimm-collapsed .tsimm-head small{display:none}
      .tsimm-status{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:7px}.tsimm-stat{padding:5px;border:1px solid #46404f;border-radius:7px;background:#242129;text-align:center}.tsimm-stat strong{display:block;font-size:14px}.tsimm-stat span{color:#b7afc0;font-size:10px}
      .tsimm-actions{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0}.tsimm-btn{flex:1;min-width:78px}.tsimm-btn-primary{background:#5b2b82;border-color:#8e55b9}.tsimm-btn:disabled{opacity:.55;cursor:wait}
      .tsimm-controls{display:grid;grid-template-columns:1fr 72px;gap:5px;align-items:center;margin-top:6px}.tsimm-controls input{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}.tsimm-check{display:flex;align-items:center;gap:6px;margin-top:7px;color:#c9c2d0}
      .tsimm-note{margin-top:6px;color:#d0c8d8}.tsimm-muted{color:#aaa1b7}.tsimm-good-text{color:#63df9f}.tsimm-minor-text{color:#c77dff}.tsimm-loss-text{color:#ff6b76}
      .${APP.badgeClass}{display:flex;flex-direction:column;justify-content:center;gap:1px;border:1px solid currentColor;border-radius:7px;padding:3px 5px;font:700 10px/1.15 Arial,sans-serif;white-space:nowrap;box-shadow:0 2px 8px #0007;background:#19171dcc;pointer-events:none}
      .${APP.badgeClass} span{font-size:8px;font-weight:600;opacity:.9}.tsimm-tier-good{--tsimm-tier:#44d88b}.tsimm-tier-minor{--tsimm-tier:#bd6cff}.tsimm-tier-loss{--tsimm-tier:#ff626d}
      .${APP.badgeClass}.tsimm-tier-good{color:#44d88b}.${APP.badgeClass}.tsimm-tier-minor{color:#bd6cff}.${APP.badgeClass}.tsimm-tier-loss{color:#ff626d}
      .tsimm-badge-category{position:absolute;right:4px;top:4px;z-index:5;max-width:calc(100% - 8px)}
      .tsimm-badge-listing{display:inline-flex;margin-left:6px;vertical-align:middle;position:relative;z-index:3}
      .${APP.categoryMark}.tsimm-tier-good{outline:2px solid #44d88b80;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-minor{outline:2px solid #bd6cff80;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-loss{outline:2px solid #ff626d80;outline-offset:-2px}
      .${APP.listingMark}.tsimm-tier-good{box-shadow:inset 3px 0 #44d88b}.${APP.listingMark}.tsimm-tier-minor{box-shadow:inset 3px 0 #bd6cff}.${APP.listingMark}.tsimm-tier-loss{box-shadow:inset 3px 0 #ff626d}
      .${APP.tradeItemMark}{position:relative;min-height:38px}      .${APP.tradeBadgeClass}{display:inline-flex;flex-direction:column;gap:1px;margin:3px 0 3px 6px;padding:3px 5px;border:1px solid #bd6cff;border-radius:7px;background:#19171dcc;color:#d9a6ff;font:700 10px/1.15 Arial,sans-serif;vertical-align:middle;white-space:nowrap;pointer-events:none}
      .${APP.tradeBadgeClass} span{font-size:8px;font-weight:600;color:#c9c2d0}
      .tsimm-trade-card{margin:8px 0;padding:8px;border:1px solid #50485c;border-radius:9px;background:#242129}.tsimm-trade-card.tsimm-trade-good{border-color:#44d88b;color:#eafff2}.tsimm-trade-card.tsimm-trade-loss{border-color:#ff626d;color:#fff0f1}.tsimm-trade-card.tsimm-trade-pending,.tsimm-trade-card.tsimm-trade-incomplete{border-color:#bd6cff;color:#f4e8ff}
      .tsimm-trade-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.tsimm-trade-title strong{font-size:13px}.tsimm-trade-title span{font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      .tsimm-trade-grid{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center}.tsimm-trade-grid span{color:#bfb7c8}.tsimm-trade-grid strong{text-align:right}.tsimm-trade-diff-good{color:#63df9f}.tsimm-trade-diff-loss{color:#ff7c85}.tsimm-trade-diff-pending{color:#d6a0ff}
      .tsimm-trade-items{margin-top:7px;padding-top:6px;border-top:1px solid #47404f;max-height:118px;overflow:auto}.tsimm-trade-item-line{display:grid;grid-template-columns:1fr auto;gap:6px;padding:2px 0;font-size:10px}.tsimm-trade-item-line span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-trade-unmatched{color:#ff9ba2}
      .tsimm-controls select{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}
      .tsimm-pending-card{margin:7px 0;padding:8px;border:1px solid #c48b35;border-radius:8px;background:#2b2418;display:grid;gap:3px}.tsimm-pending-card>strong{color:#ffd184}.tsimm-pending-card>span{color:#f2e8d5}.tsimm-pending-card>small{color:#c9baa0}.tsimm-pending-card>div{display:flex;gap:6px;margin-top:3px}.tsimm-pending-card button{flex:1;border:1px solid #725f3d;border-radius:6px;background:#3b3020;color:#fff;padding:5px;font-weight:700}
      #${APP.ledgerOverlayId}{position:fixed;inset:0;z-index:2147483500;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f1f8}
      .tsimm-ledger-shell{width:min(620px,100%);max-height:94vh;display:flex;flex-direction:column;background:#1d1b22;border:1px solid #655d70;border-radius:12px;box-shadow:0 14px 44px #000d;overflow:hidden}
      .tsimm-ledger-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#282330;border-bottom:1px solid #4f4759}.tsimm-ledger-head>div{display:grid;gap:1px;flex:1}.tsimm-ledger-head strong{font-size:14px}.tsimm-ledger-head small{color:#aaa1b7}.tsimm-ledger-head>button{border:1px solid #655d70;border-radius:7px;background:#393341;color:#fff;width:30px;height:30px;font-size:19px}
      .tsimm-ledger-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:8px}.tsimm-ledger-summary>div{display:grid;text-align:center;padding:7px 3px;border:1px solid #494250;border-radius:8px;background:#24212a}.tsimm-ledger-summary strong{font-size:12px}.tsimm-ledger-summary span{font-size:9px;color:#aaa1b7;text-transform:uppercase}
      .tsimm-ledger-actions{display:flex;flex-wrap:wrap;gap:5px;padding:0 8px 8px}.tsimm-ledger-actions button{flex:1;min-width:105px;border:1px solid #625a70;border-radius:7px;background:#393341;color:#fff;padding:7px;font-weight:700}.tsimm-ledger-actions button:first-child{background:#5b2b82;border-color:#8e55b9}
      .tsimm-ledger-future{margin:0 8px 8px;padding:6px 8px;border:1px solid #51425e;border-radius:7px;background:#241d2a;color:#cdbbdd}
      .tsimm-ledger-list{overflow:auto;padding:0 8px 10px;display:grid;gap:7px}.tsimm-ledger-empty{padding:18px 10px;text-align:center;color:#aaa1b7;border:1px dashed #514a59;border-radius:8px}
      .tsimm-ledger-lot{border:1px solid #4d4656;border-radius:9px;background:#24212a;padding:8px}.tsimm-ledger-lot-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-ledger-lot-head strong{flex:1;font-size:13px}.tsimm-ledger-lot-head span{font-size:9px;text-transform:uppercase;color:#c9a2e4;border:1px solid #66497a;border-radius:999px;padding:2px 5px}
      .tsimm-ledger-lot-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.tsimm-ledger-lot-grid span{color:#aaa1b7}.tsimm-ledger-lot-grid strong{text-align:right}.tsimm-ledger-profit{color:#63df9f}.tsimm-ledger-loss{color:#ff7c85}
      .tsimm-ledger-lot-foot{display:flex;gap:8px;align-items:center;margin-top:7px;padding-top:6px;border-top:1px solid #423c49}.tsimm-ledger-lot-foot small{flex:1;color:#8f8798}.tsimm-ledger-lot-foot button{border:1px solid #5a5266;border-radius:6px;background:#332e3a;color:#fff;padding:4px 7px;margin-left:4px}.tsimm-ledger-notes{margin-top:5px;color:#c1b8ca;font-size:10px}
      #tsimm-toast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:2147483647;padding:8px 11px;border-radius:8px;background:#17151b;color:#fff;border:1px solid #655d70;box-shadow:0 6px 20px #0009;font:12px Arial,sans-serif}
    `;
    document.head.appendChild(style);
  }

  function tradeSummaryHtml(stats) {
    if (stats.pageType !== 'trade') return '';
    const status = stats.tradeStatus || 'incomplete';
    const statusLabel = {
      good: '99% protected',
      loss: 'under target',
      pending: 'awaiting cash',
      incomplete: 'incomplete',
      empty: 'no items',
    }[status] || status;
    const netCashText = Number.isFinite(stats.tradeNetCash) ? formatMoney(stats.tradeNetCash) : 'Not detected';
    const diffClass = status === 'good'
      ? 'tsimm-trade-diff-good'
      : status === 'loss'
        ? 'tsimm-trade-diff-loss'
        : 'tsimm-trade-diff-pending';
    const differenceText = Number.isFinite(stats.tradeDifference)
      ? `${stats.tradeDifference >= 0 ? '+' : ''}${formatMoney(stats.tradeDifference)}`
      : 'Pending';
    const effectiveText = Number.isFinite(stats.tradeEffectivePercent)
      ? formatPercent(stats.tradeEffectivePercent)
      : 'Pending';
    const itemLines = state.settings.showTradeItemBreakdown
      ? [
          ...stats.tradeItems.map((item) => `<div class="tsimm-trade-item-line"><span>${escapeHtml(item.name)} × ${escapeHtml(formatInteger(item.quantity))}</span><strong>Ⓣ ${escapeHtml(formatMoney(item.targetTotal))}</strong></div>`),
          ...stats.tradeUnmatched.map((item) => `<div class="tsimm-trade-item-line tsimm-trade-unmatched"><span>Unmatched: ${escapeHtml(item.name)} × ${escapeHtml(formatInteger(item.quantity))}</span><strong>?</strong></div>`),
        ].join('')
      : '';
    return `
      <div class="tsimm-trade-card tsimm-trade-${escapeHtml(status)}">
        <div class="tsimm-trade-title"><strong>🤝 Trade manifest</strong><span>${escapeHtml(statusLabel)}</span></div>
        <div class="tsimm-trade-grid">
          <span>Your item types</span><strong>${formatInteger(stats.tradeMatchedItems)}${stats.tradeUnmatchedItems ? ` + ${formatInteger(stats.tradeUnmatchedItems)} unmatched` : ''}</strong>
          <span>Ⓜ Full market value</span><strong>${formatMoney(stats.tradeMarketTotal)}</strong>
          <span>Ⓣ Required trader payout</span><strong>${formatMoney(stats.tradeTargetTotal)}</strong>
          <span>Trader cash minus your cash</span><strong>${escapeHtml(netCashText)}</strong>
          <span>Difference from target</span><strong class="${diffClass}">${escapeHtml(differenceText)}</strong>
          <span>Effective payout</span><strong>${escapeHtml(effectiveText)}</strong>
        </div>
        ${itemLines ? `<div class="tsimm-trade-items">${itemLines}</div>` : ''}
      </div>
    `;
  }

  function renderPanel() {
    injectStyles();
    let panel = document.getElementById(APP.panelId);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = APP.panelId;
      document.body.appendChild(panel);
    }
    panel.classList.toggle('tsimm-collapsed', Boolean(state.settings.collapsed));
    const stats = state.lastScan;
    const isTrade = stats.pageType === 'trade';
    const goodCount = stats.categoryGood + stats.listingGood;
    const minorCount = stats.categoryMinor + stats.listingMinor;
    const lossCount = stats.categoryLoss + stats.listingLoss;
    const matchedCount = stats.categoryMatched + stats.listingMatched;
    const ledger = ledgerSummary();
    const notes = stats.notes.length
      ? stats.notes.map((note) => `<div class="tsimm-note">${escapeHtml(note)}</div>`).join('')
      : '';
    const statusHtml = isTrade
      ? `<div class="tsimm-status">
          <div class="tsimm-stat"><strong>${formatInteger(stats.tradeMatchedItems)}</strong><span>priced</span></div>
          <div class="tsimm-stat"><strong class="${stats.tradeUnmatchedItems ? 'tsimm-loss-text' : ''}">${formatInteger(stats.tradeUnmatchedItems)}</strong><span>unmatched</span></div>
          <div class="tsimm-stat"><strong>${formatInteger(stats.tradeSideCandidates)}</strong><span>sides</span></div>
          <div class="tsimm-stat"><strong>${escapeHtml(stats.tradeMySide || '?')}</strong><span>your side</span></div>
        </div>`
      : `<div class="tsimm-status">
          <div class="tsimm-stat"><strong class="tsimm-good-text">${goodCount}</strong><span>green</span></div>
          <div class="tsimm-stat"><strong class="tsimm-minor-text">${minorCount}</strong><span>purple</span></div>
          <div class="tsimm-stat"><strong class="tsimm-loss-text">${lossCount}</strong><span>red</span></div>
          <div class="tsimm-stat"><strong>${matchedCount}</strong><span>matched</span></div>
        </div>`;
    const marketControls = !isTrade
      ? `<div class="tsimm-controls"><label>Green profit each</label><input type="number" min="0" step="1" value="${escapeHtml(state.settings.minimumProfitEach)}" data-tsimm-setting="minimumProfitEach"></div>
        <div class="tsimm-controls"><label>Green minimum ROI %</label><input type="number" min="0" step="0.01" value="${escapeHtml(state.settings.minimumRoiPercent)}" data-tsimm-setting="minimumRoiPercent"></div>
        <label class="tsimm-check"><input type="checkbox" data-tsimm-setting="showLossesDuringTesting" ${state.settings.showLossesDuringTesting ? 'checked' : ''}> Show red non-profitable items</label>`
      : '';
    const tradeControls = isTrade
      ? `<div class="tsimm-controls"><label>Your trade side</label><select data-tsimm-setting="tradeSidePreference">
          <option value="auto" ${state.settings.tradeSidePreference === 'auto' ? 'selected' : ''}>Auto detect</option>
          <option value="left" ${state.settings.tradeSidePreference === 'left' ? 'selected' : ''}>Left</option>
          <option value="right" ${state.settings.tradeSidePreference === 'right' ? 'selected' : ''}>Right</option>
        </select></div>
        <label class="tsimm-check"><input type="checkbox" data-tsimm-setting="showTradeItemBreakdown" ${state.settings.showTradeItemBreakdown ? 'checked' : ''}> Show per-item 99% totals</label>
        <div class="tsimm-muted">Side detection: ${escapeHtml(stats.tradeSideSource || 'not resolved')}</div>`
      : '';
    panel.innerHTML = `
      <div class="tsimm-head">
        <strong>📈 ${escapeHtml(APP.shortName)}</strong>
        <small>v${escapeHtml(APP.version)} · ${escapeHtml(stats.pageType)}</small>
        <button type="button" data-tsimm-action="toggle">${state.settings.collapsed ? '+' : '−'}</button>
      </div>
      <div class="tsimm-body">
        ${statusHtml}
        <div class="tsimm-muted">Catalog: ${formatInteger(catalogCount())} values${catalogIsFresh() ? ' · fresh' : ''}</div>
        <div class="tsimm-muted">Ledger: ${formatInteger(ledger.lots)} lots · ${formatMoney(ledger.invested)} invested · ${ledger.expectedProfit >= 0 ? '+' : ''}${formatMoney(ledger.expectedProfit)} expected</div>
        <div class="tsimm-note">Profit base: Ⓣ = floor(Ⓜ × 99%) per item</div>
        ${pendingPurchaseHtml()}
        ${tradeSummaryHtml(stats)}
        <div class="tsimm-actions">
          <button class="tsimm-btn tsimm-btn-primary" type="button" data-tsimm-action="sync" ${state.syncing ? 'disabled' : ''}>${state.syncing ? 'Syncing…' : 'Sync values'}</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="scan">Scan page</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="diagnostics">Copy diagnostics</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="ledger-open">Ledger (${formatInteger(ledger.lots)})</button>
        </div>
        ${tradeControls}
        ${marketControls}
        ${notes}
      </div>
    `;
  }

  function bindPanelEvents() {
    document.addEventListener('click', capturePurchaseIntentFromClick, true);
    document.addEventListener('click', (event) => {
      const button = event.target.closest(`[data-tsimm-action]`);
      if (!button) return;
      const action = button.dataset.tsimmAction;
      if (action === 'toggle') {
        updateSetting('collapsed', !state.settings.collapsed);
      } else if (action === 'sync') {
        syncCatalog();
      } else if (action === 'scan') {
        scanPage();
      } else if (action === 'diagnostics') {
        copyDiagnostics();
      } else if (action === 'ledger-open') {
        openLedger();
      } else if (action === 'ledger-close') {
        closeLedger();
      } else if (action === 'ledger-copy') {
        copyLedgerJson();
      } else if (action === 'ledger-import') {
        importLedgerJson();
      } else if (action === 'ledger-add') {
        const lot = promptLedgerLot();
        if (lot) {
          addLedgerLot(lot);
          toast(`Added ${formatInteger(lot.quantity)}× ${lot.itemName}.`);
        }
      } else if (action === 'ledger-edit') {
        editLedgerLot(button.dataset.tsimmLotId);
      } else if (action === 'ledger-delete') {
        deleteLedgerLot(button.dataset.tsimmLotId);
      } else if (action === 'ledger-clear') {
        if (state.ledger.lots.length && confirm('Clear the entire IMM purchase ledger? This cannot be undone unless you copied the JSON first.')) {
          state.ledger = normalizeLedger({});
          saveLedger();
          renderLedger();
          renderPanel();
          toast('Purchase ledger cleared.');
        }
      } else if (action === 'pending-record') {
        commitPendingPurchase('manual-confirmation', 'User confirmed the completed purchase.');
      } else if (action === 'pending-discard') {
        discardPendingPurchase();
      }
    });
    document.addEventListener('change', (event) => {
      const input = event.target.closest('[data-tsimm-setting]');
      if (!input) return;
      const key = input.dataset.tsimmSetting;
      let value;
      if (input.type === 'checkbox') value = input.checked;
      else if (key === 'tradeSidePreference') value = ['auto', 'left', 'right'].includes(input.value) ? input.value : 'auto';
      else value = Math.max(0, Number(input.value) || 0);
      updateSetting(key, value);
    });
    document.addEventListener('input', (event) => {
      if (event.target.closest(`#${APP.panelId}`)) return;
      if (pageLooksLikeTrade()) scheduleScan(180);
    }, true);
  }

  function toast(message) {
    document.getElementById('tsimm-toast')?.remove();
    const element = document.createElement('div');
    element.id = 'tsimm-toast';
    element.textContent = message;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 2800);
  }

  function bindObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent && !parent.closest(`#${APP.panelId},#${APP.ledgerOverlayId},[data-tsimm-generated]`)) {
            inspectPurchaseSignal(parent.textContent, 'dom');
          }
        }
        for (const node of mutation.addedNodes || []) {
          if (node.nodeType === Node.TEXT_NODE) {
            inspectPurchaseSignal(node.textContent, 'dom');
          } else if (node.nodeType === Node.ELEMENT_NODE && !node.closest?.(`#${APP.panelId},#${APP.ledgerOverlayId}`)) {
            inspectPurchaseSignal(node.textContent, 'dom');
          }
        }
      }
      const meaningful = mutations.some((mutation) => {
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          return parent && !parent.closest(`#${APP.panelId}, [data-tsimm-generated]`);
        }
        if (mutation.target instanceof Element && mutation.target.closest(`#${APP.panelId}, [data-tsimm-generated]`)) return false;
        return [...mutation.addedNodes].some((node) => {
          if (node.nodeType === Node.TEXT_NODE) return Boolean(normalizeWhitespace(node.textContent));
          return node.nodeType === Node.ELEMENT_NODE
            && !node.matches?.(`#${APP.panelId}, .${APP.badgeClass}, .${APP.tradeBadgeClass}, [data-tsimm-generated]`)
            && !node.closest?.(`#${APP.panelId}`);
        });
      });
      if (meaningful) scheduleScan();
    });
    state.observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  function initialize() {
    if (state.initialized || !document.body) return;
    state.initialized = true;
    injectStyles();
    savePendingPurchase();
    bindPanelEvents();
    installNetworkObservers();
    bindObserver();
    scheduleScan(250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      normalizeName,
      parseNumber,
      normalizeCatalogItem,
      normalizeCatalog,
      marginFor,
      traderPayout,
      manifestTotals,
      itemIdFromLocation,
      resolveListingMarketValue,
      parsePurchaseConfirmationText,
      parsePurchaseSuccessText,
      normalizeLedger,
      buildLedgerLot,
      ledgerSummary,
    };
  }
})();
