// ==UserScript==
// @name         TornScripture - Item Market Margin
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.9.4
// @description  Item-market and overseas profit overlays with trader capture, favorite watchlists, best-exit prompts, purchase history, trade verification, and receipt audits.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://weav3r.dev/pricelist/*
// @match        https://www.weav3r.dev/pricelist/*
// @match        https://tornexchange.com/prices/*
// @match        https://www.tornexchange.com/prices/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-Item-Market-Margin.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-Item-Market-Margin.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (typeof window !== 'undefined') {
    window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.4' });
    window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.4' });
  }


  const EARLY_CAPTURE = Object.freeze({
    importQueryKey: 'tsimmPriceImport',
    tradersKey: 'tornscripture-imm-traders-v1',
    pendingKey: 'tornscripture-imm-pending-trader-capture-v1',
    catalogKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogKey: 'tornscripture-ish-torn-catalog-v1',
    bridgePrefix: 'TSIMM_PRICE_BRIDGE:',
    noticeKey: 'tornscripture-imm-core-capture-notice-v1',
  });

  function earlyClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function earlyLoadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : earlyClone(fallback);
    } catch {
      return earlyClone(fallback);
    }
  }

  function earlyClean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function earlyNameKey(value) {
    return earlyClean(value)
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9'+&-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function earlyDecodeBase64Url(value) {
    try {
      const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function earlyNormalizeCatalog(raw) {
    const result = { byId: {}, byName: {} };
    const source = raw?.itemsByName || raw?.items || {};
    const entries = Array.isArray(source)
      ? source.map((item) => [String(item?.id ?? ''), item])
      : Object.entries(source);
    for (const [key, item] of entries) {
      if (!item || typeof item !== 'object') continue;
      const id = Math.max(0, Math.floor(Number(item.id ?? item.itemId ?? key) || 0)) || null;
      const name = earlyClean(item.name);
      if (!name) continue;
      const normalized = { id, name };
      if (id) result.byId[String(id)] = normalized;
      result.byName[earlyNameKey(name)] = normalized;
    }
    return result;
  }

  function earlyCatalog() {
    const shared = earlyNormalizeCatalog(earlyLoadJson(EARLY_CAPTURE.sharedCatalogKey, {}));
    const own = earlyNormalizeCatalog(earlyLoadJson(EARLY_CAPTURE.catalogKey, {}));
    return {
      byId: { ...shared.byId, ...own.byId },
      byName: { ...shared.byName, ...own.byName },
    };
  }

  function earlyCaptureItems(compact) {
    const values = earlyCatalog();
    if (!Array.isArray(compact?.i)) return [];
    return compact.i.map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const itemId = Math.max(0, Math.floor(Number(entry[0]) || 0)) || null;
      const unitPrice = Math.max(0, Number(entry[1]) || 0);
      const itemName = earlyClean(entry[2])
        || (itemId ? values.byId[String(itemId)]?.name : '')
        || (itemId ? `Item ${itemId}` : '');
      if ((!itemId && !itemName) || !unitPrice) return null;
      return { itemId, itemName, normalizedName: earlyNameKey(itemName), unitPrice };
    }).filter(Boolean);
  }

  function earlyItemKey(item) {
    return Number(item?.itemId) > 0
      ? `id:${Number(item.itemId)}`
      : `name:${earlyNameKey(item?.itemName)}`;
  }

  function earlyChangedCount(previous, next) {
    const before = new Map((previous || []).map((item) => [earlyItemKey(item), Number(item?.unitPrice) || 0]).filter(([key]) => key));
    const after = new Map((next || []).map((item) => [earlyItemKey(item), Number(item?.unitPrice) || 0]).filter(([key]) => key));
    const keys = new Set([...before.keys(), ...after.keys()]);
    let changed = 0;
    for (const key of keys) {
      if (!before.has(key) || !after.has(key) || Math.round(before.get(key)) !== Math.round(after.get(key))) changed += 1;
    }
    return changed;
  }

  function earlyFindTraderIndex(traders, pending, identity) {
    const pendingName = earlyNameKey(pending?.name);
    let index = traders.findIndex((trader) =>
      (pending?.traderId && String(trader?.id) === String(pending.traderId))
      || (Number(pending?.userId) > 0 && Number(trader?.userId) === Number(pending.userId))
      || (pendingName && earlyNameKey(trader?.name) === pendingName));
    if (index >= 0) return index;
    const identityName = earlyNameKey(identity?.name);
    return traders.findIndex((trader) =>
      (identity?.traderId && String(trader?.id) === String(identity.traderId))
      || (Number(identity?.userId) > 0 && Number(trader?.userId) === Number(identity.userId))
      || (identityName && earlyNameKey(trader?.name) === identityName));
  }

  function earlyClearBridgeName() {
    const raw = String(window.name || '');
    if (!raw.startsWith(EARLY_CAPTURE.bridgePrefix)) return;
    try {
      const payload = JSON.parse(raw.slice(EARLY_CAPTURE.bridgePrefix.length));
      window.name = earlyClean(payload?.previousWindowName);
    } catch {
      window.name = '';
    }
  }

  function runEarlyCapturePreflight() {
    let url;
    try {
      url = new URL(location.href);
    } catch {
      return false;
    }
    const encoded = url.searchParams.get(EARLY_CAPTURE.importQueryKey);
    if (!encoded) return false;

    const compact = earlyDecodeBase64Url(encoded);
    const items = earlyCaptureItems(compact);
    if (!compact || !items.length) return false;
    const provider = earlyClean(compact.p).toLowerCase() === 'tornexchange' ? 'tornexchange' : 'weav3r';

    const pending = earlyLoadJson(EARLY_CAPTURE.pendingKey, null);
    const identity = compact.t && typeof compact.t === 'object' ? compact.t : {};
    const rawStore = earlyLoadJson(EARLY_CAPTURE.tradersKey, []);
    const objectStore = !Array.isArray(rawStore) && Array.isArray(rawStore?.traders);
    const traders = Array.isArray(rawStore) ? rawStore : objectStore ? rawStore.traders : [];
    let index = earlyFindTraderIndex(traders, pending, identity);

    if (index < 0) {
      const name = earlyClean(pending?.name || identity.name)
        || (Number(pending?.userId || identity.userId) > 0
          ? `Trader ${Number(pending?.userId || identity.userId)}`
          : 'Captured trader');
      traders.push({
        id: earlyClean(pending?.traderId || identity.traderId) || `trader-${Date.now()}`,
        name,
        normalizedName: earlyNameKey(name),
        userId: Number(pending?.userId || identity.userId) > 0 ? Number(pending?.userId || identity.userId) : null,
        rating: 0,
        targetPercent: 99,
        profileUrl: earlyClean(identity.profileUrl),
        tradeUrl: earlyClean(identity.tradeUrl),
        bannerUrl: earlyClean(identity.bannerUrl),
        captureSource: `${provider}-pricelist`,
        pricePageItems: [],
        createdAt: new Date().toISOString(),
      });
      index = traders.length - 1;
    }

    const trader = traders[index];
    const now = new Date().toISOString();
    const sourceUrl = earlyClean(compact.u);
    const previousItems = Array.isArray(trader.pricePageItems) ? trader.pricePageItems : [];
    const changes = earlyChangedCount(previousItems, items);
    traders[index] = {
      ...trader,
      normalizedName: earlyNameKey(trader.name),
      previousPricePageUrl: sourceUrl && trader.pricePageUrl && sourceUrl !== trader.pricePageUrl
        ? trader.pricePageUrl
        : earlyClean(trader.previousPricePageUrl),
      pricePageUrl: sourceUrl || earlyClean(trader.pricePageUrl),
      pricePageTitle: earlyClean(compact.l || trader.pricePageTitle).slice(0, 160),
      pricePageProvider: provider,
      pricePageItems: items,
      pricePageCapturedAt: compact.c || now,
      pricePageLastCheckedAt: now,
      pricePageCaptureCount: Math.max(0, Math.floor(Number(trader.pricePageCaptureCount) || 0)) + 1,
      pricePageLastChangedCount: changes,
      pricePageLastResult: `${provider}-pricelist:core-preflight`,
      updatedAt: now,
    };

    try {
      localStorage.setItem(
        EARLY_CAPTURE.tradersKey,
        JSON.stringify(objectStore ? { ...rawStore, traders } : traders),
      );
      localStorage.removeItem(EARLY_CAPTURE.pendingKey);
    } catch (error) {
      console.error('[TornScripture IMM] Early capture storage failed:', error);
      return false;
    }

    earlyClearBridgeName();
    url.searchParams.delete(EARLY_CAPTURE.importQueryKey);
    try {
      sessionStorage.setItem(EARLY_CAPTURE.noticeKey, JSON.stringify({
        trader: traders[index].name,
        count: items.length,
        changes,
      }));
    } catch {}
    location.replace(url.href);
    return true;
  }

  function consumeEarlyCaptureNotice() {
    try {
      const payload = JSON.parse(sessionStorage.getItem(EARLY_CAPTURE.noticeKey) || 'null');
      sessionStorage.removeItem(EARLY_CAPTURE.noticeKey);
      return payload;
    } catch {
      return null;
    }
  }

  if (runEarlyCapturePreflight()) return;
  const EARLY_CAPTURE_NOTICE = consumeEarlyCaptureNotice();

  /*
   * TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.4
   *
   * SAFETY BOUNDARY
   * - Reads item names, lowest prices, market values, NPC store buyback values, visible listing rows, price pages, and trade manifests.
   * - Torn catalog values are requested only when the user presses Sync values.
   * - The API key, catalog cache, pending purchase, purchase lots, sale history, trader book, favorite traders, watched items, and receipt audits remain in this browser's local storage.
   * - The key is sent only to Torn's official API.
   * - Purchase capture begins only after the user presses Torn's normal confirmation button.
   * - Completed trade sales only update local lot quantities; receipt audits are read-only and never alter sale quantities or costs.
   * - The script never clicks Buy, submits purchases, lists items, or sells items.
   */

  const APP = Object.freeze({
    name: 'Item Market Margin',
    shortName: 'IMM',
    version: '0.9.4',
    panelId: 'tornscripture-imm-panel',
    styleId: 'tornscripture-imm-style',
    badgeClass: 'tsimm-margin-badge',
    categoryMark: 'tsimm-category-mark',
    listingMark: 'tsimm-listing-mark',
    overseasMark: 'tsimm-overseas-mark',
    tradeItemMark: 'tsimm-trade-item-mark',
    tradeBadgeClass: 'tsimm-trade-item-badge',
    ledgerOverlayId: 'tornscripture-imm-ledger',
    traderOverlayId: 'tornscripture-imm-traders',
    receiptAuditOverlayId: 'tornscripture-imm-receipt-audit',
    tornExchangePanelId: 'tsimm-tx-panel',
    tornExchangeStyleId: 'tsimm-tx-core-style',
    apiKeyStorageKey: 'tornscripture-imm-api-key-v1',
    sharedApiKeyStorageKey: 'tornscripture-ish-api-key-v1',
    catalogStorageKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogStorageKey: 'tornscripture-ish-torn-catalog-v1',
    settingsStorageKey: 'tornscripture-imm-settings-v1',
    ledgerStorageKey: 'tornscripture-imm-ledger-v1',
    tradersStorageKey: 'tornscripture-imm-traders-v1',
    pendingTraderCaptureStorageKey: 'tornscripture-imm-pending-trader-capture-v1',
    priceRecaptureSessionKey: 'tornscripture-imm-price-recapture-v1',
    priceBridgeWindowNamePrefix: 'TSIMM_PRICE_BRIDGE:',
    priceImportQueryKey: 'tsimmPriceImport',
    pendingPurchaseStorageKey: 'tornscripture-imm-pending-purchase-v1',
    recentPurchaseFingerprintsStorageKey: 'tornscripture-imm-recent-purchase-fingerprints-v1',
    purchasePrivacyMigrationStorageKey: 'tornscripture-imm-purchase-privacy-v1',
    catalogUrl: 'https://api.torn.com/v2/torn/items',
    fastScanDelayMs: 35,
    settleScanDelayMs: 520,
    minimumScanIntervalMs: 90,
    catalogMaxAgeMs: 24 * 60 * 60 * 1000,
    pendingPurchaseMaxAgeMs: 30 * 60 * 1000,
    duplicatePurchaseWindowMs: 2 * 60 * 1000,
    traderCaptureMaxAgeMs: 60 * 60 * 1000,
  });

  const PDA_API_KEY = '###PDA-APIKEY###';
  const TRADER_PERCENT = 99;

  const DEFAULT_SETTINGS = Object.freeze({
    collapsed: false,
    minimumProfitEach: 100,
    goldMinimumProfitEach: 1000,
    minimumRoiPercent: 0.25,
    showLossesDuringTesting: true,
    tradeSidePreference: 'auto',
    showTradeItemBreakdown: true,
    showClosedLedgerLots: true,
    ledgerShowSoldPurchases: true,
    overseasLoadLimit: 21,
  });

  const state = {
    settings: { ...structuredCloneSafe(DEFAULT_SETTINGS), ...loadJson(APP.settingsStorageKey, DEFAULT_SETTINGS) },
    catalog: mergeCatalogCaches(),
    ledger: normalizeLedger(loadJson(APP.ledgerStorageKey, {})),
    traders: normalizeTraders(loadJson(APP.tradersStorageKey, [])),
    pendingTraderCapture: normalizePendingTraderCapture(loadJson(APP.pendingTraderCaptureStorageKey, null)),
    pendingPurchase: normalizePendingPurchase(loadJson(APP.pendingPurchaseStorageKey, null)),
    purchaseSignals: [],
    recentPurchaseFingerprints: loadJson(APP.recentPurchaseFingerprintsStorageKey, []),
    lastScan: emptyScanStats(),
    syncing: false,
    scanTimer: null,
    scanDueAt: 0,
    settleScanTimer: null,
    lastScanStartedAt: 0,
    marketScanGeneration: 0,
    observer: null,
    initialized: false,
    networkObserversBound: false,
    receiptAuditDraft: null,
    priceRecaptureTimer: null,
    priceRecaptureInFlight: false,
    weav3rCapturePreview: null,
    weav3rCaptureTimer: null,
    weav3rObserver: null,
    weav3rAutoReturnTimer: null,
    tornExchangeCapturePreview: null,
    tornExchangeCaptureTimer: null,
    tornExchangeObserver: null,
    tornExchangeAutoReturnTimer: null,
    ledgerUi: {
      view: 'holdings',
      search: '',
      sort: 'newest',
      showSold: true,
    },
  };
  state.ledgerUi.showSold = state.settings.ledgerShowSoldPurchases !== false;

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

  function optionalFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeTraderPriceItem(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const itemName = normalizeWhitespace(candidate.itemName ?? candidate.name);
    const itemId = Number(candidate.itemId ?? candidate.id) > 0 ? Number(candidate.itemId ?? candidate.id) : null;
    const unitPrice = Math.max(0, Number(candidate.unitPrice ?? candidate.price ?? candidate.value) || 0);
    if ((!itemName && !itemId) || unitPrice <= 0) return null;
    const resolvedName = itemName || `Item ${itemId}`;
    return {
      itemId,
      itemName: resolvedName,
      normalizedName: normalizeName(resolvedName),
      unitPrice,
      quantity: Math.max(1, Math.floor(Number(candidate.quantity ?? candidate.qty) || 1)),
      sourceText: normalizeWhitespace(candidate.sourceText ?? candidate.text).slice(0, 300),
    };
  }

  function normalizeTrader(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const name = normalizeWhitespace(candidate.name ?? candidate.username);
    if (!name) return null;
    const rawUserId = candidate.userId ?? candidate.tornId ?? (typeof candidate.id === 'number' ? candidate.id : null);
    const userId = Math.max(0, Math.floor(Number(rawUserId) || 0)) || null;
    const rating = Math.max(0, Math.min(5, Math.floor(Number(candidate.rating) || 0)));
    const targetPercent = Math.max(0, Math.min(100, Number(candidate.targetPercent ?? candidate.preferredPercent) || TRADER_PERCENT));
    const profileUrl = normalizeHttpUrl(candidate.profileUrl)
      || (userId ? `https://www.torn.com/profiles.php?XID=${userId}` : '');
    const tradeUrl = normalizeHttpUrl(candidate.tradeUrl)
      || (userId ? `https://www.torn.com/trade.php#step=start&userID=${userId}` : '');
    const bannerUrl = normalizeHttpUrl(candidate.bannerUrl ?? candidate.bannerImageUrl ?? candidate.userbarUrl);
    const pricePageItems = Array.isArray(candidate.pricePageItems ?? candidate.pricingItems)
      ? (candidate.pricePageItems ?? candidate.pricingItems).map(normalizeTraderPriceItem).filter(Boolean)
      : [];
    return {
      id: normalizeWhitespace(candidate.recordId)
        || normalizeWhitespace(candidate.uuid)
        || (typeof candidate.id === 'string' ? normalizeWhitespace(candidate.id) : '')
        || createId('trader'),
      name,
      normalizedName: normalizeName(name),
      userId,
      rating,
      targetPercent,
      profileUrl,
      tradeUrl,
      bannerUrl,
      captureSource: normalizeWhitespace(candidate.captureSource) || (bannerUrl ? 'profile-page' : 'manual'),
      pricePageUrl: normalizeHttpUrl(candidate.pricePageUrl ?? candidate.pricingPageUrl ?? candidate.receiptPageUrl),
      previousPricePageUrl: normalizeHttpUrl(candidate.previousPricePageUrl),
      pricePageTitle: normalizeWhitespace(candidate.pricePageTitle ?? candidate.pricingPageTitle).slice(0, 160),
      pricePageItems,
      pricePageCapturedAt: candidate.pricePageCapturedAt ?? candidate.pricesCapturedAt ?? null,
      pricePageLastCheckedAt: candidate.pricePageLastCheckedAt ?? candidate.pricePageCapturedAt ?? null,
      pricePageCaptureCount: Math.max(0, Math.floor(Number(candidate.pricePageCaptureCount) || 0)),
      pricePageLastChangedCount: Math.max(0, Math.floor(Number(candidate.pricePageLastChangedCount) || 0)),
      pricePageLastResult: normalizeWhitespace(candidate.pricePageLastResult) || (pricePageItems.length ? 'captured' : ''),
      notes: normalizeWhitespace(candidate.notes),
      createdAt: candidate.createdAt || new Date().toISOString(),
      updatedAt: candidate.updatedAt || new Date().toISOString(),
    };
  }

  function normalizeTraders(raw) {
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.traders) ? raw.traders : [];
    const unique = new Map();
    for (const candidate of source) {
      const trader = normalizeTrader(candidate);
      if (!trader) continue;
      const key = trader.userId ? `id:${trader.userId}` : `name:${trader.normalizedName}`;
      unique.set(key, trader);
    }
    return [...unique.values()].sort((a, b) =>
      Number(b.rating || 0) - Number(a.rating || 0) || a.name.localeCompare(b.name)
    );
  }

  function saveTraders() {
    state.traders = normalizeTraders(state.traders);
    saveJson(APP.tradersStorageKey, state.traders);
  }


  function normalizePendingTraderCapture(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const name = normalizeWhitespace(candidate.name);
    const traderId = normalizeWhitespace(candidate.traderId);
    const userId = Math.max(0, Math.floor(Number(candidate.userId) || 0)) || null;
    const armedAt = Number(candidate.armedAt) || Date.now();
    const expiresAt = Number(candidate.expiresAt) || (armedAt + APP.traderCaptureMaxAgeMs);
    if ((!traderId && !userId && !name) || expiresAt <= Date.now()) return null;
    return { traderId, userId, name, armedAt, expiresAt };
  }

  function savePendingTraderCapture() {
    if (state.pendingTraderCapture) saveJson(APP.pendingTraderCaptureStorageKey, state.pendingTraderCapture);
    else localStorage.removeItem(APP.pendingTraderCaptureStorageKey);
  }

  function activePendingTraderCapture() {
    const pending = normalizePendingTraderCapture(state.pendingTraderCapture);
    if (!pending) {
      if (state.pendingTraderCapture) {
        state.pendingTraderCapture = null;
        savePendingTraderCapture();
      }
      return null;
    }
    state.pendingTraderCapture = pending;
    return pending;
  }

  function traderForPendingCapture(pending = activePendingTraderCapture()) {
    if (!pending) return null;
    return state.traders.find((trader) =>
      (pending.traderId && trader.id === pending.traderId)
      || (pending.userId && trader.userId === pending.userId)
      || (pending.name && trader.normalizedName === normalizeName(pending.name))
    ) || null;
  }

  function clearPendingTraderCapture(message = '') {
    state.pendingTraderCapture = null;
    savePendingTraderCapture();
    if (readPriceBridgeWindowName()?.type === 'request') clearPriceBridgeWindowName();
    renderPanel();
    renderTraders();
    if (message) toast(message);
  }

  function armTraderForPriceCapture(trader) {
    if (!trader) return;
    state.pendingTraderCapture = {
      traderId: trader.id,
      userId: trader.userId || null,
      name: trader.name,
      armedAt: Date.now(),
      expiresAt: Date.now() + APP.traderCaptureMaxAgeMs,
    };
    savePendingTraderCapture();
    writePriceBridgeWindowName({
      ...priceCaptureRequestForTrader(trader),
      autoReturn: false,
    });
    renderPanel();
    renderTraders();
    toast(`${trader.name} armed for the next receipt or price page.`);
  }

  function armCurrentProfileTrader() {
    const identity = currentProfileIdentity();
    if (!identity.name || !identity.userId) {
      toast('IMM could not resolve this profile name and Torn ID.');
      return;
    }
    let trader = state.traders.find((entry) =>
      entry.userId === identity.userId || entry.normalizedName === normalizeName(identity.name)
    ) || null;
    if (!trader) {
      trader = upsertTrader(normalizeTrader({
        ...identity,
        rating: 0,
        targetPercent: TRADER_PERCENT,
        captureSource: 'profile-page-armed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
    armTraderForPriceCapture(trader);
  }

  function loadSessionJson(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveSessionJson(key, value) {
    try {
      if (value === null || value === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Session storage can be unavailable in hardened webviews. Manual capture still works.
    }
  }


  function base64UrlEncode(value) {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      let binary = '';
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch {
      return '';
    }
  }

  function base64UrlDecode(value) {
    try {
      const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function readPriceBridgeWindowName() {
    const raw = String(window.name || '');
    if (!raw.startsWith(APP.priceBridgeWindowNamePrefix)) return null;
    try {
      const parsed = JSON.parse(raw.slice(APP.priceBridgeWindowNamePrefix.length));
      if (!parsed || typeof parsed !== 'object') return null;
      if (Number(parsed.expiresAt) && Number(parsed.expiresAt) <= Date.now()) {
        window.name = normalizeWhitespace(parsed.previousWindowName);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function writePriceBridgeWindowName(payload) {
    const current = readPriceBridgeWindowName();
    const previousWindowName = current?.previousWindowName
      || (String(window.name || '').startsWith(APP.priceBridgeWindowNamePrefix) ? '' : String(window.name || '').slice(0, 4096));
    try {
      window.name = APP.priceBridgeWindowNamePrefix + JSON.stringify({ ...payload, previousWindowName });
      return true;
    } catch {
      return false;
    }
  }

  function clearPriceBridgeWindowName() {
    const current = readPriceBridgeWindowName();
    window.name = current?.previousWindowName || '';
  }

  function isWeav3rPriceListUrl(value = location.href) {
    const normalized = normalizeHttpUrl(value);
    if (!normalized) return false;
    try {
      const url = new URL(normalized);
      const host = url.hostname.toLowerCase();
      return (host === 'weav3r.dev' || host === 'www.weav3r.dev')
        && /^\/pricelist\/\d+\/?$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function cleanWeav3rPriceListUrl(value = location.href) {
    const normalized = normalizeHttpUrl(value);
    if (!normalized) return '';
    try {
      const url = new URL(normalized);
      if (/^tsimm-capture=/i.test(url.hash.slice(1))) url.hash = '';
      return url.href;
    } catch {
      return normalized;
    }
  }

  function isTornExchangePriceListUrl(value = location.href) {
    const normalized = normalizeHttpUrl(value);
    if (!normalized) return false;
    try {
      const url = new URL(normalized);
      return /^(?:www\.)?tornexchange\.com$/i.test(url.hostname)
        && /^\/prices\/[^/]+\/?$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function cleanSupportedPricePageUrl(value = location.href) {
    const normalized = cleanWeav3rPriceListUrl(value);
    if (!normalized) return '';
    try {
      const url = new URL(normalized);
      if (isTornExchangePriceListUrl(url.href)) url.hash = '';
      return url.href;
    } catch {
      return normalized;
    }
  }

  function isSupportedPricePageUrl(value) {
    return isTornPageUrl(value) || isWeav3rPriceListUrl(value) || isTornExchangePriceListUrl(value);
  }

  function compactTraderCaptureIdentity(trader) {
    return {
      traderId: normalizeWhitespace(trader?.id ?? trader?.traderId),
      userId: Math.max(0, Math.floor(Number(trader?.userId) || 0)) || null,
      name: normalizeWhitespace(trader?.name),
      profileUrl: normalizeHttpUrl(trader?.profileUrl),
      tradeUrl: normalizeHttpUrl(trader?.tradeUrl),
      bannerUrl: normalizeHttpUrl(trader?.bannerUrl),
    };
  }

  function priceCaptureRequestForTrader(trader, sourceUrl = '') {
    return {
      version: 1,
      type: 'request',
      trader: compactTraderCaptureIdentity(trader),
      sourceUrl: cleanSupportedPricePageUrl(sourceUrl),
      returnUrl: normalizeHttpUrl(location.href) || 'https://www.torn.com/index.php',
      requestedAt: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000),
      autoReturn: true,
    };
  }

  function weav3rUrlWithCaptureRequest(urlValue, request) {
    const normalized = normalizeHttpUrl(urlValue);
    if (!normalized) return '';
    try {
      const url = new URL(normalized);
      const encoded = base64UrlEncode({
        v: 1,
        t: request.trader,
        r: request.returnUrl,
        a: request.autoReturn !== false,
        x: request.expiresAt,
      });
      if (encoded) url.hash = `tsimm-capture=${encoded}`;
      return url.href;
    } catch {
      return normalized;
    }
  }

  function captureRequestFromWeav3rPage() {
    const hash = String(location.hash || '').slice(1);
    if (/^tsimm-capture=/i.test(hash)) {
      const decoded = base64UrlDecode(hash.replace(/^tsimm-capture=/i, ''));
      if (decoded && (!decoded.x || Number(decoded.x) > Date.now())) {
        return {
          version: 1,
          type: 'request',
          trader: decoded.t || {},
          returnUrl: normalizeHttpUrl(decoded.r) || '',
          autoReturn: decoded.a !== false,
          expiresAt: Number(decoded.x) || Date.now() + (15 * 60 * 1000),
        };
      }
    }
    const bridged = readPriceBridgeWindowName();
    return bridged?.type === 'request' ? bridged : null;
  }

  function weav3rTraderIdentity() {
    const request = captureRequestFromWeav3rPage();
    const profileAnchor = [...document.querySelectorAll('a[href*="profiles.php?XID=" i]')]
      .find((anchor) => userIdFromUrl(anchor.href));
    const pathMatch = String(location.pathname || '').match(/\/pricelist\/(\d+)/i);
    const userId = userIdFromUrl(profileAnchor?.href) || Math.max(0, Math.floor(Number(pathMatch?.[1]) || 0)) || null;
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')]
      .map((element) => normalizeWhitespace(element.innerText || element.textContent))
      .filter(Boolean);
    let name = '';
    for (const heading of headings) {
      const match = heading.match(/^(.+?)(?:[’']s)\s+Pricelist$/i);
      if (match?.[1]) { name = normalizeWhitespace(match[1]); break; }
    }
    if (!name) {
      const titleMatch = normalizeWhitespace(document.title).match(/^(.+?)(?:[’']s)\s+Pricelist/i);
      name = normalizeWhitespace(titleMatch?.[1]);
    }
    const requested = request?.trader || {};
    return {
      traderId: normalizeWhitespace(requested.traderId),
      userId: userId || Math.max(0, Math.floor(Number(requested.userId) || 0)) || null,
      name: name || normalizeWhitespace(requested.name) || (userId ? `Trader ${userId}` : 'Weav3r trader'),
      profileUrl: normalizeHttpUrl(profileAnchor?.href || requested.profileUrl)
        || (userId ? `https://www.torn.com/profiles.php?XID=${userId}` : ''),
      tradeUrl: normalizeHttpUrl(requested.tradeUrl)
        || (userId ? `https://www.torn.com/trade.php#step=start&userID=${userId}` : ''),
      bannerUrl: normalizeHttpUrl(requested.bannerUrl),
    };
  }

  function weav3rItemPriceElements(container) {
    return [...container.querySelectorAll('span,div,p,strong,b,td')]
      .filter((element) => /^\$[\d,.]+$/.test(normalizeWhitespace(ownText(element) || element.textContent)))
      .filter(visibleElement);
  }

  function weav3rRowForItemLink(link) {
    let node = link.parentElement;
    let fallback = null;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const text = normalizeWhitespace(node.innerText || node.textContent);
      if (!text || text.length > 900) continue;
      const itemLinks = [...node.querySelectorAll('a[href*="/item/"]')]
        .filter((anchor) => /\/item\/\d+\/?(?:[#?].*)?$/i.test(anchor.href));
      const prices = weav3rItemPriceElements(node);
      if (itemLinks.length === 1 && prices.length) return { row: node, priceElement: prices[0] };
      if (!fallback && itemLinks.length <= 2 && prices.length) fallback = { row: node, priceElement: prices[0] };
    }
    return fallback;
  }

  function captureWeav3rPriceItems() {
    const captured = new Map();
    const links = [...document.querySelectorAll('a[href*="/item/"]')]
      .filter((link) => /\/item\/\d+\/?(?:[#?].*)?$/i.test(link.href));
    for (const link of links) {
      const itemMatch = String(link.href).match(/\/item\/(\d+)/i);
      const itemId = Math.max(0, Math.floor(Number(itemMatch?.[1]) || 0)) || null;
      const itemName = normalizeWhitespace(link.innerText || link.textContent || link.getAttribute('aria-label'));
      if (!itemId || !itemName) continue;
      const resolved = weav3rRowForItemLink(link);
      const unitPrice = parseNumber(resolved?.priceElement?.textContent);
      if (!(unitPrice > 0)) continue;
      captured.set(`id:${itemId}`, normalizeTraderPriceItem({
        itemId,
        itemName,
        unitPrice,
        quantity: 1,
        sourceText: `${itemName} ${formatMoney(unitPrice)}`,
      }));
    }
    return [...captured.values()].filter(Boolean).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }

  function compactPriceCaptureResult(payload) {
    return {
      v: 1,
      p: normalizeWhitespace(payload.provider || payload.sourceType || 'weav3r').toLowerCase(),
      t: compactTraderCaptureIdentity(payload.trader),
      u: cleanSupportedPricePageUrl(payload.sourceUrl),
      l: normalizeWhitespace(payload.title).slice(0, 160),
      c: payload.capturedAt || new Date().toISOString(),
      i: (payload.items || []).map((item) => {
        const normalized = normalizeTraderPriceItem(item);
        if (!normalized) return null;
        return normalized.itemId
          ? [normalized.itemId, Math.round(normalized.unitPrice)]
          : [0, Math.round(normalized.unitPrice), normalized.itemName];
      }).filter(Boolean),
    };
  }

  function expandPriceCaptureResult(compact) {
    if (!compact || typeof compact !== 'object' || !Array.isArray(compact.i)) return null;
    const items = compact.i.map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const itemId = Math.max(0, Math.floor(Number(entry[0]) || 0)) || null;
      const catalog = itemId ? state.catalog.itemsById?.[String(itemId)] : null;
      return normalizeTraderPriceItem({
        itemId,
        itemName: normalizeWhitespace(entry[2]) || catalog?.name || (itemId ? `Item ${itemId}` : ''),
        unitPrice: Number(entry[1]) || 0,
      });
    }).filter(Boolean);
    return {
      trader: compact.t || {},
      provider: normalizeWhitespace(compact.p || 'weav3r').toLowerCase(),
      sourceUrl: normalizeHttpUrl(compact.u),
      title: normalizeWhitespace(compact.l),
      capturedAt: compact.c || null,
      items,
    };
  }

  function returnUrlWithPriceCapture(result, returnUrl = '') {
    const target = normalizeHttpUrl(returnUrl)
      || (result.trader?.userId ? `https://www.torn.com/profiles.php?XID=${result.trader.userId}` : 'https://www.torn.com/index.php');
    try {
      const url = new URL(target);
      const encoded = base64UrlEncode(compactPriceCaptureResult(result));
      if (encoded) url.searchParams.set(APP.priceImportQueryKey, encoded);
      return url.href;
    } catch {
      return 'https://www.torn.com/index.php';
    }
  }

  function priceCaptureResultFromCurrentUrl() {
    try {
      const url = new URL(location.href);
      const encoded = url.searchParams.get(APP.priceImportQueryKey);
      if (!encoded) return null;
      return expandPriceCaptureResult(base64UrlDecode(encoded));
    } catch {
      return null;
    }
  }

  function clearPriceCaptureImportFromUrl() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has(APP.priceImportQueryKey)) return;
      url.searchParams.delete(APP.priceImportQueryKey);
      history.replaceState(history.state, document.title, url.href);
    } catch {
      // The saved capture is already in local storage even if URL cleanup fails.
    }
  }

  function consumeImportedPriceCapture() {
    const bridged = readPriceBridgeWindowName();
    const fromWindow = bridged?.type === 'result' ? expandPriceCaptureResult(bridged.compact) : null;
    const imported = priceCaptureResultFromCurrentUrl() || fromWindow;
    if (!imported?.items?.length) return null;
    const identity = imported.trader || {};
    const provider = imported.provider === 'tornexchange' ? 'tornexchange' : 'weav3r';
    let trader = state.traders.find((entry) =>
      (identity.traderId && entry.id === identity.traderId)
      || (identity.userId && entry.userId === Number(identity.userId))
      || (identity.name && entry.normalizedName === normalizeName(identity.name))
    ) || null;
    if (!trader) {
      trader = upsertTrader(normalizeTrader({
        recordId: identity.traderId,
        name: identity.name || (identity.userId ? `Trader ${identity.userId}` : 'Imported trader'),
        userId: identity.userId,
        profileUrl: identity.profileUrl,
        tradeUrl: identity.tradeUrl,
        bannerUrl: identity.bannerUrl,
        captureSource: `${provider}-pricelist`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
    const result = saveTraderPriceCapture(trader, {
      url: imported.sourceUrl,
      title: imported.title || `${trader.name}'s ${provider === 'tornexchange' ? 'TornExchange' : 'TornW3B'} pricelist`,
      items: imported.items,
      sourceType: `${provider}-pricelist`,
      automatic: true,
    });
    const pending = activePendingTraderCapture();
    if (pending && traderForPendingCapture(pending)?.id === trader.id) {
      state.pendingTraderCapture = null;
      savePendingTraderCapture();
    }
    clearPriceBridgeWindowName();
    clearPriceCaptureImportFromUrl();
    return result;
  }

  function createWeav3rCaptureResult() {
    const request = captureRequestFromWeav3rPage();
    const identity = weav3rTraderIdentity();
    const items = captureWeav3rPriceItems();
    const result = {
      trader: { ...identity, traderId: identity.traderId || request?.trader?.traderId || '' },
      provider: 'weav3r',
      sourceUrl: cleanWeav3rPriceListUrl(location.href),
      title: document.title,
      items,
      capturedAt: new Date().toISOString(),
    };
    state.weav3rCapturePreview = result;
    writePriceBridgeWindowName({
      version: 1,
      type: 'result',
      compact: compactPriceCaptureResult(result),
      returnUrl: request?.returnUrl || '',
      expiresAt: Date.now() + (20 * 60 * 1000),
    });
    return { result, request };
  }

  function goBackToTornWithWeav3rCapture({ automatic = false } = {}) {
    const { result, request } = createWeav3rCaptureResult();
    renderWeav3rCapturePanel();
    if (!result.items.length) {
      toast('No TornW3B prices were parsed yet. Wait for the page to finish loading and retry.');
      return null;
    }
    const returnUrl = returnUrlWithPriceCapture(result, request?.returnUrl);
    toast(`${formatInteger(result.items.length)} prices captured${automatic ? ' · returning to Torn' : ''}.`);
    clearTimeout(state.weav3rAutoReturnTimer);
    state.weav3rAutoReturnTimer = setTimeout(() => window.location.assign(returnUrl), automatic ? 900 : 350);
    return result;
  }

  function renderWeav3rCapturePanel() {
    injectStyles();
    let panel = document.getElementById(APP.panelId);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = APP.panelId;
      document.body.appendChild(panel);
    }
    panel.classList.toggle('tsimm-collapsed', Boolean(state.settings.collapsed));
    const request = captureRequestFromWeav3rPage();
    const identity = weav3rTraderIdentity();
    const preview = state.weav3rCapturePreview || { items: captureWeav3rPriceItems() };
    state.weav3rCapturePreview = { ...preview, trader: identity };
    const count = preview.items?.length || 0;
    panel.innerHTML = `
      <div class="tsimm-head">
        <strong>📈 ${escapeHtml(APP.shortName)}</strong>
        <small>v${escapeHtml(APP.version)} · TornW3B pricelist</small>
        <button type="button" data-tsimm-weav3r-action="toggle">${state.settings.collapsed ? '+' : '−'}</button>
      </div>
      <div class="tsimm-body">
        <div class="tsimm-status">
          <div class="tsimm-stat"><strong class="${count ? 'tsimm-good-text' : 'tsimm-loss-text'}">${formatInteger(count)}</strong><span>prices found</span></div>
          <div class="tsimm-stat"><strong>${escapeHtml(identity.name || '?')}</strong><span>trader</span></div>
          <div class="tsimm-stat"><strong>${escapeHtml(identity.userId || '?')}</strong><span>Torn ID</span></div>
        </div>
        <div class="tsimm-note">IMM can read this public TornW3B pricelist, save its address to the trader, and bring the captured prices back to Torn.</div>
        ${request ? `<div class="tsimm-note">Recapture requested for ${escapeHtml(request.trader?.name || identity.name)}. It will return to Torn automatically after a successful scan.</div>` : ''}
        <div class="tsimm-actions">
          <button class="tsimm-btn tsimm-btn-blue" type="button" data-tsimm-weav3r-action="capture-return">Capture & return to Torn</button>
          <button class="tsimm-btn" type="button" data-tsimm-weav3r-action="rescan">Rescan page</button>
        </div>
      </div>`;
  }

  function scheduleWeav3rCaptureScan(delay = 450) {
    clearTimeout(state.weav3rCaptureTimer);
    state.weav3rCaptureTimer = setTimeout(() => {
      state.weav3rCaptureTimer = null;
      const items = captureWeav3rPriceItems();
      state.weav3rCapturePreview = {
        trader: weav3rTraderIdentity(),
        sourceUrl: cleanWeav3rPriceListUrl(location.href),
        title: document.title,
        items,
      };
      renderWeav3rCapturePanel();
      const request = captureRequestFromWeav3rPage();
      const bridged = readPriceBridgeWindowName();
      if (request?.autoReturn && items.length && bridged?.type !== 'result') {
        goBackToTornWithWeav3rCapture({ automatic: true });
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function initializeWeav3rPriceCapture() {
    injectStyles();
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tsimm-weav3r-action]');
      if (!button) return;
      const action = button.dataset.tsimmWeav3rAction;
      if (action === 'toggle') {
        state.settings.collapsed = !state.settings.collapsed;
        renderWeav3rCapturePanel();
      } else if (action === 'rescan') {
        scheduleWeav3rCaptureScan(20);
      } else if (action === 'capture-return') {
        goBackToTornWithWeav3rCapture({ automatic: false });
      }
    });
    state.weav3rObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => normalizeWhitespace(mutation.target?.textContent).includes('$')
        || [...(mutation.addedNodes || [])].some((node) => normalizeWhitespace(node.textContent).includes('$')))) {
        scheduleWeav3rCaptureScan(300);
      }
    });
    state.weav3rObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    renderWeav3rCapturePanel();
    scheduleWeav3rCaptureScan(700);
    setTimeout(() => scheduleWeav3rCaptureScan(1800), 1800);
  }


  function tornExchangeCaptureRequest() {
    const bridged = readPriceBridgeWindowName();
    return bridged?.type === 'request' ? bridged : null;
  }

  function tornExchangePageName() {
    const headings = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
      .map((element) => normalizeWhitespace(element.textContent));
    for (const heading of headings) {
      const match = heading.match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
      if (match?.[1]) return normalizeWhitespace(match[1]);
    }
    const titleMatch = normalizeWhitespace(document.title).match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
    if (titleMatch?.[1]) return normalizeWhitespace(titleMatch[1]);
    return normalizeWhitespace(decodeURIComponent(location.pathname).match(/^\/prices\/([^/]+)/i)?.[1]) || 'TornExchange trader';
  }

  function tornExchangePageUpdated() {
    return normalizeWhitespace(String(document.body?.innerText || '').match(/Prices\s+last\s+updated\s*:\s*([^\n\r]+)/i)?.[1]).slice(0, 120);
  }

  function tornExchangeCellPrice(value) {
    const text = normalizeWhitespace(value);
    if (!/\d/.test(text)) return null;
    const number = Number(text.replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function tornExchangeRowItemId(row) {
    for (const element of row.querySelectorAll('[href],[src],[data-item-id],[data-itemid],[data-id]')) {
      for (const value of [
        element.getAttribute('href'), element.getAttribute('src'), element.getAttribute('data-item-id'),
        element.getAttribute('data-itemid'), element.getAttribute('data-id'),
      ].filter(Boolean)) {
        const match = String(value).match(/[?&#](?:itemID|itemId|item_id|ID|id)=(\d+)/i)
          || String(value).match(/\/(?:images\/)?items?\/(\d+)(?:\/|\.|$)/i);
        if (Number(match?.[1]) > 0) return Number(match[1]);
      }
    }
    return null;
  }

  function captureTornExchangePriceItems() {
    const found = new Map();
    for (const table of document.querySelectorAll('table')) {
      const headingRow = table.querySelector('thead tr') || table.querySelector('tr');
      const headings = [...(headingRow?.querySelectorAll('th,td') || [])].map((element) => normalizeName(element.textContent));
      const nameIndex = headings.findIndex((heading) => heading === 'item name' || heading === 'item');
      const priceIndex = headings.findIndex((heading) => heading.includes('buy price') || heading === 'price');
      const rows = table.querySelectorAll('tbody tr').length ? table.querySelectorAll('tbody tr') : table.querySelectorAll('tr');
      for (const row of rows) {
        if (row === headingRow) continue;
        const cells = [...row.children].filter((element) => /^(?:TH|TD)$/i.test(element.tagName));
        if (cells.length < 2) continue;
        let selectedPriceIndex = priceIndex;
        if (selectedPriceIndex < 0 || !tornExchangeCellPrice(cells[selectedPriceIndex]?.textContent)) {
          for (let index = cells.length - 1; index >= 0; index -= 1) {
            if (tornExchangeCellPrice(cells[index].textContent)) {
              selectedPriceIndex = index;
              break;
            }
          }
        }
        const unitPrice = tornExchangeCellPrice(cells[selectedPriceIndex]?.textContent);
        if (!unitPrice) continue;
        let itemName = normalizeWhitespace(cells[nameIndex]?.textContent);
        if (!itemName || /^(?:image|item|item name|buy price|price)$/i.test(itemName) || tornExchangeCellPrice(itemName)) {
          itemName = cells.map((cell, index) => ({ index, text: normalizeWhitespace(cell.textContent) }))
            .filter((entry) => entry.index !== selectedPriceIndex && entry.text && !tornExchangeCellPrice(entry.text) && !/^image$/i.test(entry.text))
            .sort((left, right) => right.text.length - left.text.length)[0]?.text || '';
        }
        if (!itemName) continue;
        const itemId = tornExchangeRowItemId(row);
        const item = normalizeTraderPriceItem({ itemId, itemName, unitPrice });
        if (!item) continue;
        const itemKey = traderPriceItemKey(item);
        const previous = found.get(itemKey);
        if (!previous || unitPrice > previous.unitPrice) found.set(itemKey, item);
      }
    }
    return [...found.values()].sort((left, right) => left.itemName.localeCompare(right.itemName));
  }

  function tornExchangeTraderIdentity() {
    const request = tornExchangeCaptureRequest();
    const requested = request?.trader || {};
    const pageName = tornExchangePageName();
    return {
      traderId: normalizeWhitespace(requested.traderId),
      userId: Math.max(0, Math.floor(Number(requested.userId) || 0)) || null,
      name: pageName || normalizeWhitespace(requested.name) || 'TornExchange trader',
      profileUrl: normalizeHttpUrl(requested.profileUrl),
      tradeUrl: normalizeHttpUrl(requested.tradeUrl),
      bannerUrl: normalizeHttpUrl(requested.bannerUrl),
    };
  }

  function createTornExchangeCaptureResult() {
    const request = tornExchangeCaptureRequest();
    const identity = tornExchangeTraderIdentity();
    const items = captureTornExchangePriceItems();
    const result = {
      trader: { ...identity, traderId: identity.traderId || request?.trader?.traderId || '' },
      provider: 'tornexchange',
      sourceUrl: cleanSupportedPricePageUrl(location.origin + location.pathname),
      title: `${tornExchangePageName()} TornExchange prices`,
      items,
      capturedAt: new Date().toISOString(),
    };
    state.tornExchangeCapturePreview = result;
    writePriceBridgeWindowName({
      version: 1,
      type: 'result',
      compact: compactPriceCaptureResult(result),
      returnUrl: request?.returnUrl || 'https://www.torn.com/page.php?sid=ItemMarket',
      expiresAt: Date.now() + (20 * 60 * 1000),
    });
    return { result, request };
  }

  function goBackToTornWithTornExchangeCapture({ automatic = false } = {}) {
    const { result, request } = createTornExchangeCaptureResult();
    renderTornExchangeCapturePanel();
    if (!result.items.length) return null;
    const armedName = normalizeWhitespace(request?.trader?.name);
    if (armedName && normalizeName(armedName) !== normalizeName(result.trader.name)
      && !confirm(`IMM is armed for ${armedName}, but this page belongs to ${result.trader.name}.\n\nSave these prices to ${armedName}?`)) return null;
    if (armedName) result.trader.name = armedName;
    const returnUrl = returnUrlWithPriceCapture(
      result,
      request?.returnUrl || 'https://www.torn.com/page.php?sid=ItemMarket',
    );
    clearTimeout(state.tornExchangeAutoReturnTimer);
    state.tornExchangeAutoReturnTimer = setTimeout(() => window.location.assign(returnUrl), automatic ? 900 : 300);
    return result;
  }

  function injectTornExchangeStyles() {
    if (!document.head || document.getElementById(APP.tornExchangeStyleId)) return;
    const style = document.createElement('style');
    style.id = APP.tornExchangeStyleId;
    style.textContent = `
      #${APP.tornExchangePanelId}{position:fixed;right:10px;bottom:10px;z-index:2147483646;width:min(360px,calc(100vw - 20px));overflow:hidden;border:1px solid #3bd35d;border-radius:9px;background:#020704;color:#aaff83;box-shadow:0 14px 40px #000c;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${APP.tornExchangePanelId} *{box-sizing:border-box}#${APP.tornExchangePanelId} .txh{display:flex;padding:9px 10px;border-bottom:1px solid #1d6b2d;background:#041108}#${APP.tornExchangePanelId} .txh strong{flex:1}#${APP.tornExchangePanelId} .txb{display:grid;gap:7px;padding:10px}#${APP.tornExchangePanelId} .txg{display:grid;grid-template-columns:1fr auto;gap:4px 8px}#${APP.tornExchangePanelId} .txg b{text-align:right}#${APP.tornExchangePanelId} .txw{padding:7px;border:1px solid #9a6d1f;border-radius:5px;background:#241a05;color:#ffd166}#${APP.tornExchangePanelId} .txa{display:grid;grid-template-columns:1fr 1.7fr;gap:6px}#${APP.tornExchangePanelId} button{border:1px solid #2c843d;border-radius:5px;background:#06170a;color:#b6ff9d;padding:8px;font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    `;
    document.head.appendChild(style);
  }

  function renderTornExchangeCapturePanel() {
    injectTornExchangeStyles();
    let panel = document.getElementById(APP.tornExchangePanelId);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = APP.tornExchangePanelId;
      document.body.appendChild(panel);
    }
    const items = state.tornExchangeCapturePreview?.items || captureTornExchangePriceItems();
    const name = tornExchangePageName();
    const updated = tornExchangePageUpdated();
    const request = tornExchangeCaptureRequest();
    const armed = normalizeWhitespace(request?.trader?.name);
    const mismatch = armed && normalizeName(armed) !== normalizeName(name);
    panel.innerHTML = `<div class="txh"><strong>&gt; TORNEXCHANGE_CAPTURE</strong><span>core v${escapeHtml(APP.version)}</span></div><div class="txb"><div class="txg"><span>PAGE</span><b>${escapeHtml(name)}</b><span>PRICES</span><b>${formatInteger(items.length)}</b><span>UPDATED</span><b>${escapeHtml(updated || 'Unknown')}</b><span>TARGET</span><b>${escapeHtml(armed || name)}</b></div>${mismatch ? `<div class="txw">ARMED FOR ${escapeHtml(armed)} · PAGE IS ${escapeHtml(name)}</div>` : ''}<div class="txa"><button data-tsimm-tx-action="scan">RESCAN</button><button data-tsimm-tx-action="save" ${items.length ? '' : 'disabled'}>CAPTURE & RETURN</button></div></div>`;
  }

  function scheduleTornExchangeCaptureScan(delay = 350) {
    clearTimeout(state.tornExchangeCaptureTimer);
    state.tornExchangeCaptureTimer = setTimeout(() => {
      state.tornExchangeCaptureTimer = null;
      state.tornExchangeCapturePreview = {
        trader: tornExchangeTraderIdentity(),
        provider: 'tornexchange',
        sourceUrl: cleanSupportedPricePageUrl(location.origin + location.pathname),
        title: `${tornExchangePageName()} TornExchange prices`,
        items: captureTornExchangePriceItems(),
      };
      renderTornExchangeCapturePanel();
      const request = tornExchangeCaptureRequest();
      if (request?.autoReturn && state.tornExchangeCapturePreview.items.length
        && readPriceBridgeWindowName()?.type !== 'result') {
        goBackToTornWithTornExchangeCapture({ automatic: true });
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function initializeTornExchangePriceCapture() {
    injectTornExchangeStyles();
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tsimm-tx-action]');
      if (!button) return;
      const action = button.dataset.tsimmTxAction;
      if (action === 'scan') scheduleTornExchangeCaptureScan(20);
      else if (action === 'save') goBackToTornWithTornExchangeCapture({ automatic: false });
    });
    state.tornExchangeObserver = new MutationObserver((records) => {
      const panel = document.getElementById(APP.tornExchangePanelId);
      if (panel && records.every((record) => panel.contains(record.target))) return;
      scheduleTornExchangeCaptureScan(180);
    });
    state.tornExchangeObserver.observe(document.body, { childList: true, subtree: true });
    renderTornExchangeCapturePanel();
    scheduleTornExchangeCaptureScan(650);
    setTimeout(() => scheduleTornExchangeCaptureScan(20), 1600);
  }

  function normalizePriceRecaptureRequest(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const traderId = normalizeWhitespace(candidate.traderId);
    const url = normalizeHttpUrl(candidate.url);
    const requestedAt = Number(candidate.requestedAt) || Date.now();
    const expiresAt = Number(candidate.expiresAt) || requestedAt + (15 * 60 * 1000);
    if (!traderId || !url || expiresAt <= Date.now()) return null;
    return { traderId, url, requestedAt, expiresAt };
  }

  function activePriceRecaptureRequest() {
    const request = normalizePriceRecaptureRequest(loadSessionJson(APP.priceRecaptureSessionKey, null));
    if (!request) saveSessionJson(APP.priceRecaptureSessionKey, null);
    return request;
  }

  function isTornPageUrl(value) {
    const normalized = normalizeHttpUrl(value);
    if (!normalized) return false;
    try {
      const host = new URL(normalized).hostname.toLowerCase();
      return host === 'torn.com' || host.endsWith('.torn.com');
    } catch {
      return false;
    }
  }

  function recaptureUrlsMatch(left, right) {
    const a = normalizeHttpUrl(left);
    const b = normalizeHttpUrl(right);
    if (!a || !b) return false;
    if (a === b) return true;
    try {
      const ua = new URL(a);
      const ub = new URL(b);
      return ua.origin === ub.origin
        && ua.pathname === ub.pathname
        && ua.search === ub.search
        && (!ua.hash || !ub.hash || ua.hash === ub.hash);
    } catch {
      return false;
    }
  }

  function traderPriceItemKey(item) {
    const id = Number(item?.itemId);
    return Number.isFinite(id) && id > 0
      ? `id:${id}`
      : `name:${normalizeName(item?.itemName)}`;
  }

  function mergeCapturedPriceItem(target, candidate, confidence = 1) {
    const item = normalizeTraderPriceItem(candidate);
    if (!item) return;
    const key = traderPriceItemKey(item);
    if (!key || key === 'name:') return;
    const existing = target.get(key);
    if (!existing || confidence >= existing.confidence) target.set(key, { ...item, confidence });
  }

  function quantityFromPriceLine(text, catalog) {
    if (!catalog?.name) return 1;
    const escaped = escapeRegExp(catalog.name);
    const after = text.match(new RegExp(`${escaped}\\s*(?:x|×)\\s*([\\d,]+)`, 'i'));
    const before = text.match(new RegExp(`([\\d,]+)\\s*(?:x|×)\\s*${escaped}`, 'i'));
    return Math.max(1, Math.floor(parseNumber(after?.[1] ?? before?.[1]) || 1));
  }

  function explicitUnitPriceFromLine(text) {
    const patterns = [
      /(?:@|each|ea\.?|unit\s+price|price|pays?|value)\s*[:=-]?\s*\$\s*([\d,.]+)/i,
      /\$\s*([\d,.]+)\s*(?:each|ea\.?)\b/i,
    ];
    for (const pattern of patterns) {
      const match = String(text || '').match(pattern);
      const value = parseNumber(match?.[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    const tokens = [...String(text || '').matchAll(/\$\s*([\d,.]+)/g)]
      .map((match) => parseNumber(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0);
    return tokens[0] || 0;
  }

  function priceItemFromPageText(text) {
    const cleanText = normalizeWhitespace(text);
    if (!cleanText || cleanText.length > 700 || !cleanText.includes('$')) return null;
    const catalog = catalogNameInReceiptLine(cleanText);
    if (!catalog) return null;
    const unitPrice = explicitUnitPriceFromLine(cleanText);
    if (!(unitPrice > 0)) return null;
    return {
      itemId: catalog.id,
      itemName: catalog.name,
      unitPrice,
      quantity: quantityFromPriceLine(cleanText, catalog),
      sourceText: cleanText,
    };
  }

  function priceItemsFromParsedReceipt(parsed) {
    return (parsed?.items || []).map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      unitPrice: Number(item.unitPrice) > 0
        ? Number(item.unitPrice)
        : (Number(item.totalValue) > 0 && Number(item.quantity) > 0 ? Number(item.totalValue) / Number(item.quantity) : 0),
      quantity: item.quantity || 1,
      sourceText: `${item.itemName} × ${item.quantity}`,
    })).map(normalizeTraderPriceItem).filter(Boolean);
  }

  function pageTextWithoutImmUi() {
    const clone = document.body?.cloneNode(true);
    if (!clone) return '';
    clone.querySelectorAll(immUiSelector()).forEach((node) => node.remove());
    return String(clone.innerText || clone.textContent || '').trim();
  }

  function capturePriceItemsFromCurrentPage() {
    const captured = new Map();
    const pageText = pageTextWithoutImmUi();
    const parsed = parseReceiptInput(pageText);
    for (const item of priceItemsFromParsedReceipt(parsed)) mergeCapturedPriceItem(captured, item, 5);
    for (const line of pageText.split(/\r?\n/)) {
      const item = priceItemFromPageText(line);
      if (item) mergeCapturedPriceItem(captured, item, 2);
    }
    const selectors = 'tr,[role="row"],li,article,[class*="price"],[class*="item"],[class*="row"]';
    const ignored = immUiSelector();
    const seenText = new Set();
    for (const element of document.querySelectorAll(selectors)) {
      if (!(element instanceof Element) || element.closest(ignored) || !visibleElement(element)) continue;
      const rowText = normalizeWhitespace(element.innerText || element.textContent);
      if (!rowText || rowText.length > 700 || !rowText.includes('$') || seenText.has(rowText)) continue;
      seenText.add(rowText);
      const item = priceItemFromPageText(rowText);
      if (item) mergeCapturedPriceItem(captured, item, 4);
    }
    return [...captured.values()]
      .map(({ confidence, ...item }) => item)
      .sort((a, b) => a.itemName.localeCompare(b.itemName))
      .slice(0, 600);
  }

  function capturedPriceChangeCount(previous = [], next = []) {
    const oldMap = new Map(previous.map((item) => [traderPriceItemKey(item), normalizeTraderPriceItem(item)]).filter((entry) => entry[0] && entry[1]));
    const newMap = new Map(next.map((item) => [traderPriceItemKey(item), normalizeTraderPriceItem(item)]).filter((entry) => entry[0] && entry[1]));
    const keys = new Set([...oldMap.keys(), ...newMap.keys()]);
    let changed = 0;
    for (const key of keys) {
      const oldItem = oldMap.get(key);
      const newItem = newMap.get(key);
      if (!oldItem || !newItem || Math.round(oldItem.unitPrice) !== Math.round(newItem.unitPrice)) changed += 1;
    }
    return changed;
  }

  function saveTraderPriceCapture(trader, { url = '', title = '', items = [], sourceType = 'page', automatic = false } = {}) {
    if (!trader) return null;
    const cleanUrl = normalizeHttpUrl(url || location.href);
    const cleanItems = items.map(normalizeTraderPriceItem).filter(Boolean);
    const previousItems = trader.pricePageItems || [];
    const preservePrevious = cleanItems.length === 0 && previousItems.length > 0;
    const changedCount = cleanItems.length ? capturedPriceChangeCount(previousItems, cleanItems) : 0;
    const previousUrl = cleanUrl && trader.pricePageUrl && cleanUrl !== trader.pricePageUrl
      ? trader.pricePageUrl
      : trader.previousPricePageUrl;
    const now = new Date().toISOString();
    const next = normalizeTrader({
      ...trader,
      recordId: trader.id,
      previousPricePageUrl: previousUrl,
      pricePageUrl: cleanUrl || trader.pricePageUrl,
      pricePageTitle: normalizeWhitespace(title || document.title || trader.pricePageTitle).slice(0, 160),
      pricePageItems: preservePrevious ? previousItems : cleanItems,
      pricePageCapturedAt: cleanItems.length ? now : trader.pricePageCapturedAt,
      pricePageLastCheckedAt: now,
      pricePageCaptureCount: Number(trader.pricePageCaptureCount || 0) + 1,
      pricePageLastChangedCount: changedCount,
      pricePageLastResult: cleanItems.length ? `${sourceType}:${automatic ? 'auto' : 'manual'}` : 'no-prices-found',
      updatedAt: now,
    });
    const saved = upsertTrader(next);
    return {
      trader: saved,
      parsedCount: cleanItems.length,
      changedCount,
      preservedPrevious,
      url: cleanUrl,
    };
  }

  function captureCurrentPricePageForTrader(traderId = '', { automatic = false, consumePending = true } = {}) {
    const pending = activePendingTraderCapture();
    const trader = state.traders.find((entry) => entry.id === traderId)
      || traderForPendingCapture(pending);
    if (!trader) {
      toast('No trader is armed for this price-page capture.');
      return null;
    }
    const result = saveTraderPriceCapture(trader, {
      url: location.href,
      title: document.title,
      items: capturePriceItemsFromCurrentPage(),
      sourceType: 'price-page',
      automatic,
    });
    if (consumePending && pending) clearPendingTraderCapture();
    if (!result) return null;
    const resultText = result.parsedCount
      ? `${formatInteger(result.parsedCount)} prices captured${result.changedCount ? ` · ${formatInteger(result.changedCount)} changed` : ''}`
      : result.preservedPrevious
        ? 'Page checked, but no prices parsed; the previous snapshot was kept'
        : 'Page linked, but no prices were parsed';
    toast(`${result.trader.name}: ${resultText}.`);
    return result;
  }

  function requestTraderPriceRecapture(traderId) {
    const trader = state.traders.find((entry) => entry.id === traderId);
    if (!trader?.pricePageUrl) {
      toast('This trader does not have a saved price page yet.');
      return;
    }
    if (isWeav3rPriceListUrl(trader.pricePageUrl)) {
      const request = priceCaptureRequestForTrader(trader, trader.pricePageUrl);
      writePriceBridgeWindowName(request);
      window.location.assign(weav3rUrlWithCaptureRequest(trader.pricePageUrl, request));
      return;
    }
    if (isTornExchangePriceListUrl(trader.pricePageUrl)) {
      const request = priceCaptureRequestForTrader(trader, trader.pricePageUrl);
      writePriceBridgeWindowName(request);
      window.location.assign(cleanSupportedPricePageUrl(trader.pricePageUrl));
      return;
    }
    if (!isTornPageUrl(trader.pricePageUrl)) {
      toast('This saved page can be opened, but automatic recapture is not supported for its domain yet.');
      window.location.assign(trader.pricePageUrl);
      return;
    }
    saveSessionJson(APP.priceRecaptureSessionKey, {
      traderId: trader.id,
      url: trader.pricePageUrl,
      requestedAt: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000),
    });
    window.location.assign(trader.pricePageUrl);
  }

  function maybeScheduleTraderPriceRecapture() {
    const request = activePriceRecaptureRequest();
    if (!request || state.priceRecaptureTimer || state.priceRecaptureInFlight) return;
    if (!recaptureUrlsMatch(location.href, request.url)) return;
    state.priceRecaptureTimer = setTimeout(() => {
      state.priceRecaptureTimer = null;
      state.priceRecaptureInFlight = true;
      try {
        captureCurrentPricePageForTrader(request.traderId, { automatic: true, consumePending: false });
      } finally {
        saveSessionJson(APP.priceRecaptureSessionKey, null);
        state.priceRecaptureInFlight = false;
        renderPanel();
        renderTraders();
      }
    }, 900);
  }

  function linkPendingTraderToReceiptAudit() {
    const pending = activePendingTraderCapture();
    const trader = traderForPendingCapture(pending);
    const draft = state.receiptAuditDraft;
    const sale = (state.ledger.sales || []).find((entry) => entry.id === draft?.saleId);
    const input = document.querySelector(`#${APP.receiptAuditOverlayId} [data-tsimm-receipt-input]`);
    if (!trader || !sale) {
      toast('No armed trader or receipt sale was available to link.');
      return;
    }
    const rawText = String(input?.value || draft?.rawText || '').trim();
    const parsed = parseReceiptInput(rawText);
    sale.counterparty = trader.name;
    if (trader.userId) sale.counterpartyId = trader.userId;
    if (trader.profileUrl) sale.counterpartyProfileUrl = trader.profileUrl;
    saveLedger();
    const items = priceItemsFromParsedReceipt(parsed);
    const url = parsed.receiptUrl || sale.receiptAudit?.receiptUrl || sale.saleUrl || location.href;
    const result = saveTraderPriceCapture(trader, {
      url,
      title: `Receipt / pricing page for ${trader.name}`,
      items,
      sourceType: 'receipt-audit',
      automatic: false,
    });
    clearPendingTraderCapture();
    renderReceiptAudit();
    renderLedger();
    toast(`${trader.name} linked to this receipt${result?.parsedCount ? ` · ${result.parsedCount} prices captured` : ''}.`);
  }

  function normalizeReceiptAuditItem(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const itemName = normalizeWhitespace(candidate.itemName ?? candidate.name);
    const quantity = Math.max(0, Math.floor(Number(candidate.quantity ?? candidate.qty) || 0));
    if (!itemName || quantity <= 0) return null;
    const unitPrice = Math.max(0, Number(candidate.unitPrice ?? candidate.price ?? candidate.priceUsed) || 0);
    const totalValue = Math.max(0, Number(candidate.totalValue ?? candidate.total ?? candidate.totalPrice) || (unitPrice * quantity));
    const status = ['gold', 'green', 'purple', 'red', 'gray'].includes(candidate.status)
      ? candidate.status
      : 'gray';
    return {
      itemId: Number(candidate.itemId) > 0 ? Number(candidate.itemId) : null,
      itemName,
      normalizedName: normalizeName(itemName),
      quantity,
      unitPrice: unitPrice || (quantity > 0 ? totalValue / quantity : 0),
      totalValue,
      matchedSaleItemName: normalizeWhitespace(candidate.matchedSaleItemName),
      saleQuantity: Math.max(0, Math.floor(Number(candidate.saleQuantity) || 0)),
      expectedTarget: Math.max(0, Number(candidate.expectedTarget) || 0),
      costBasis: Math.max(0, Number(candidate.costBasis) || 0),
      profit: optionalFiniteNumber(candidate.profit),
      quantityDifference: Number(candidate.quantityDifference) || 0,
      targetDifference: optionalFiniteNumber(candidate.targetDifference),
      status,
      note: normalizeWhitespace(candidate.note),
    };
  }

  function normalizeReceiptAudit(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const items = Array.isArray(candidate.items)
      ? candidate.items.map(normalizeReceiptAuditItem).filter(Boolean)
      : [];
    const unmatchedReceiptItems = Array.isArray(candidate.unmatchedReceiptItems)
      ? candidate.unmatchedReceiptItems.map(normalizeReceiptAuditItem).filter(Boolean)
      : [];
    const missingSaleItems = Array.isArray(candidate.missingSaleItems)
      ? candidate.missingSaleItems.map((item) => ({
          itemName: normalizeWhitespace(item?.itemName ?? item?.name),
          quantity: Math.max(0, Math.floor(Number(item?.quantity) || 0)),
        })).filter((item) => item.itemName && item.quantity > 0)
      : [];
    const status = ['gold', 'green', 'purple', 'red', 'gray', 'link-only'].includes(candidate.status)
      ? candidate.status
      : (items.length ? 'gray' : 'link-only');
    return {
      id: normalizeWhitespace(candidate.id) || createId('audit'),
      schemaVersion: 1,
      provider: normalizeWhitespace(candidate.provider) || 'unknown',
      receiptUrl: normalizeHttpUrl(candidate.receiptUrl ?? candidate.url),
      rawText: String(candidate.rawText ?? candidate.receiptText ?? '').trim(),
      sourceFormat: normalizeWhitespace(candidate.sourceFormat) || 'text',
      auditedAt: candidate.auditedAt || new Date().toISOString(),
      totalValue: Math.max(0, Number(candidate.totalValue) || 0),
      saleCash: Math.max(0, Number(candidate.saleCash) || 0),
      cashDifference: optionalFiniteNumber(candidate.cashDifference),
      targetDifference: optionalFiniteNumber(candidate.targetDifference),
      auditedProfit: optionalFiniteNumber(candidate.auditedProfit),
      status,
      summary: normalizeWhitespace(candidate.summary),
      items,
      unmatchedReceiptItems,
      missingSaleItems,
      notes: normalizeWhitespace(candidate.notes),
    };
  }

  function normalizeSaleRecord(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const items = Array.isArray(candidate.items)
      ? candidate.items.map((item) => ({
          itemId: Number(item?.itemId) > 0 ? Number(item.itemId) : null,
          itemName: normalizeWhitespace(item?.itemName ?? item?.name),
          normalizedName: normalizeName(item?.itemName ?? item?.name),
          quantity: Math.max(0, Math.floor(Number(item?.quantity) || 0)),
          trackedQuantity: Math.max(0, Math.floor(Number(item?.trackedQuantity) || 0)),
          untrackedQuantity: Math.max(0, Math.floor(Number(item?.untrackedQuantity) || 0)),
          marketTotal: Math.max(0, Number(item?.marketTotal) || 0),
          targetTotal: Math.max(0, Number(item?.targetTotal) || 0),
          costBasis: Math.max(0, Number(item?.costBasis) || 0),
          proceeds: Math.max(0, Number(item?.proceeds) || 0),
          realizedProfit: optionalFiniteNumber(item?.realizedProfit),
          allocations: Array.isArray(item?.allocations)
            ? item.allocations.map((allocation) => ({
                lotId: normalizeWhitespace(allocation?.lotId),
                quantity: Math.max(0, Math.floor(Number(allocation?.quantity) || 0)),
                unitCost: Math.max(0, Number(allocation?.unitCost) || 0),
                costBasis: Math.max(0, Number(allocation?.costBasis) || 0),
                proceeds: Math.max(0, Number(allocation?.proceeds) || 0),
                realizedProfit: optionalFiniteNumber(allocation?.realizedProfit),
              })).filter((allocation) => allocation.lotId && allocation.quantity > 0)
            : [],
        })).filter((item) => item.itemName && item.quantity > 0)
      : [];
    const cashReceived = Math.max(0, Number(candidate?.cashReceived ?? candidate?.netCash) || 0);
    const trackedCostBasis = Math.max(0, Number(candidate?.trackedCostBasis ?? candidate?.totalCost) || 0);
    const fullCoverage = Boolean(candidate?.fullCoverage);
    const trackedProfit = optionalFiniteNumber(candidate?.trackedProfit);
    // Partial-coverage sales do not have a complete actual-profit figure.
    // Older v0.3.2 records accidentally normalized null to $0; this repairs them on load.
    const realizedProfit = fullCoverage ? optionalFiniteNumber(candidate?.realizedProfit) : null;
    return {
      id: normalizeWhitespace(candidate?.id) || createId('sale'),
      schemaVersion: 1,
      fingerprint: normalizeWhitespace(candidate?.fingerprint),
      tradeId: normalizeWhitespace(candidate?.tradeId),
      counterparty: cleanTradeParticipantName(candidate?.counterparty),
      counterpartyId: Math.max(0, Math.floor(Number(candidate?.counterpartyId ?? candidate?.traderId) || 0)) || null,
      counterpartyProfileUrl: normalizeHttpUrl(candidate?.counterpartyProfileUrl ?? candidate?.traderProfileUrl),
      soldAt: candidate?.soldAt || candidate?.capturedAt || new Date().toISOString(),
      saleUrl: normalizeHttpUrl(candidate?.saleUrl),
      captureMethod: normalizeWhitespace(candidate?.captureMethod) || 'import',
      completionSource: normalizeWhitespace(candidate?.completionSource),
      cashReceived,
      myCash: Math.max(0, Number(candidate?.myCash) || 0),
      marketTotal: Math.max(0, Number(candidate?.marketTotal) || 0),
      targetTotal: Math.max(0, Number(candidate?.targetTotal) || 0),
      trackedCostBasis,
      realizedProfit,
      trackedProfit,
      requestedQuantity: Math.max(0, Math.floor(Number(candidate?.requestedQuantity) || 0)),
      trackedQuantity: Math.max(0, Math.floor(Number(candidate?.trackedQuantity) || 0)),
      untrackedQuantity: Math.max(0, Math.floor(Number(candidate?.untrackedQuantity) || 0)),
      fullCoverage,
      items,
      receiptAudit: normalizeReceiptAudit(candidate?.receiptAudit ?? candidate?.audit),
      notes: normalizeWhitespace(candidate?.notes),
    };
  }

  function sanitizePurchaseSignalText(value) {
    return normalizeWhitespace(String(value || '')
      .replace(/\s+from\s+[^$]+?(?=\s+for\s+(?:a\s+total\s+of\s+)?\$)/i, ''));
  }

  function scrubItemMarketPurchaseNotes(value, source = '', venue = '') {
    let notes = normalizeWhitespace(value);
    const sourceKey = normalizeName(source);
    const venueKey = normalizeName(venue);
    const isItemMarket = ['item market', 'item-market'].includes(sourceKey) || ['item market', 'item-market'].includes(venueKey);
    if (!isItemMarket || !notes) return notes;
    notes = notes.replace(/(?:^|\s)Seller:\s*[^.]+\.?\s*/gi, ' ');
    notes = notes.replace(/\s{2,}/g, ' ').trim();
    return notes;
  }

  function stableTextHash(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function runPurchasePrivacyMigration() {
    if (localStorage.getItem(APP.purchasePrivacyMigrationStorageKey) === '1') return;
    state.ledger = normalizeLedger(state.ledger);
    saveJson(APP.ledgerStorageKey, state.ledger);
    state.recentPurchaseFingerprints = [];
    localStorage.removeItem(APP.recentPurchaseFingerprintsStorageKey);
    localStorage.setItem(APP.purchasePrivacyMigrationStorageKey, '1');
  }

  function normalizeLedger(raw) {
    const sourceLots = Array.isArray(raw?.lots) ? raw.lots : Array.isArray(raw) ? raw : [];
    const sourceSales = Array.isArray(raw?.sales) ? raw.sales : [];
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
      const candidateRemaining = Number(candidate?.remainingQuantity);
      const remainingQuantity = Math.max(
        0,
        Math.min(quantity, Number.isFinite(candidateRemaining) ? Math.floor(candidateRemaining) : quantity)
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
        status: remainingQuantity > 0 ? 'open' : 'closed',
        notes: scrubItemMarketPurchaseNotes(candidate?.notes, candidate?.source, candidate?.venue),
      });
    }
    const sales = sourceSales.map(normalizeSaleRecord).filter(Boolean);
    lots.sort((a, b) => Date.parse(b.capturedAt || '') - Date.parse(a.capturedAt || ''));
    sales.sort((a, b) => Date.parse(b.soldAt || '') - Date.parse(a.soldAt || ''));
    return {
      schema: 'tornscripture-imm-ledger',
      schemaVersion: 4,
      updatedAt: raw?.updatedAt || null,
      lots,
      sales,
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
      confirmationText: sanitizePurchaseSignalText(raw.confirmationText),
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
    const sales = state.ledger.sales || [];
    const openLots = lots.filter((lot) => Number(lot.remainingQuantity || 0) > 0);
    const realizedProfits = sales
      .map((sale) => optionalFiniteNumber(sale.realizedProfit)
        ?? optionalFiniteNumber(sale.trackedProfit))
      .filter((value) => value !== null);
    return {
      lots: openLots.length,
      allLots: lots.length,
      closedLots: lots.length - openLots.length,
      sales: sales.length,
      itemTypes: new Set(openLots.map((lot) => lot.normalizedName || normalizeName(lot.itemName))).size,
      quantity: lots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0),
      remainingQuantity: openLots.reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0), 0),
      invested: openLots.reduce((sum, lot) =>
        sum + Number(lot.unitCost || 0) * Number(lot.remainingQuantity || 0), 0),
      expectedProfit: openLots.reduce((sum, lot) =>
        sum + Number(lot.expectedProfitEach || 0) * Number(lot.remainingQuantity || 0), 0),
      realizedProfit: realizedProfits.reduce((sum, value) => sum + value, 0),
      realizedSalesWithProfit: realizedProfits.length,
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
      notes: scrubItemMarketPurchaseNotes(source?.notes, source?.source, source?.venue),
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
      notes: signal ? `Capture signal: ${sanitizePurchaseSignalText(signal).slice(0, 180)}` : '',
    }, captureMethod);
    state.pendingPurchase = null;
    savePendingPurchase();
    activePendingTraderCapture();
    addLedgerLot(lot);
    scheduleScan(30);
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

  function normalizeHttpUrl(value) {
    const candidate = normalizeWhitespace(value);
    if (!candidate) return '';
    try {
      const url = new URL(candidate, 'https://www.torn.com');
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function cleanTradeParticipantName(value) {
    return normalizeWhitespace(value)
      .replace(/(?:[’']s?)?\s+items\s+traded\s*$/i, '')
      .replace(/(?:[’']s?)?\s+(?:items|offer)\s*$/i, '')
      .replace(/^trade\s+(?:with|between)\s+/i, '')
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
      categoryNpc: 0,
      categoryGold: 0,
      categoryGood: 0,
      categoryMinor: 0,
      categoryLoss: 0,
      listingCandidates: 0,
      listingMatched: 0,
      listingNpc: 0,
      listingGold: 0,
      listingGood: 0,
      listingMinor: 0,
      listingLoss: 0,
      overseasCandidates: 0,
      overseasMatched: 0,
      overseasGold: 0,
      overseasGood: 0,
      overseasMinor: 0,
      overseasLoss: 0,
      overseasCountry: '',
      overseasDetectedLoad: null,
      overseasDetectedLimit: null,
      overseasLoadSource: null,
      overseasLoadLimit: 21,
      overseasRemainingCapacity: 21,
      overseasPlanQuantity: 0,
      overseasPlanCost: 0,
      overseasPlanMarketTotal: 0,
      overseasPlanTraderReturn: 0,
      overseasPlanProfit: 0,
      overseasPlanItems: [],
      overseasCargoLots: 0,
      overseasCargoQuantity: 0,
      overseasCargoCost: 0,
      overseasCargoTraderReturn: 0,
      overseasCargoProfit: 0,
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
      tradeId: null,
      tradeCounterparty: null,
      tradeCounterpartyId: null,
      tradeCounterpartyProfileUrl: '',
      tradeCounterpartyBannerUrl: '',
      profileName: null,
      profileUserId: null,
      profileUrl: '',
      profileBannerUrl: '',
      profileCaptureReady: false,
      tradeCompleted: false,
      tradeCompletionSource: null,
      tradeLedgerCostBasis: 0,
      tradeLedgerTrackedQuantity: 0,
      tradeLedgerRequestedQuantity: 0,
      tradeLedgerUntrackedQuantity: 0,
      tradeLedgerFullCoverage: false,
      tradeSaleProfit: null,
      tradeSaleRecorded: false,
      tradeSaleRecordId: null,
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
    const buyPrice = parseNumber(raw?.buyPrice ?? value.buy_price);
    const sellPrice = parseNumber(raw?.sellPrice ?? value.sell_price);
    const hasUsefulValue = [marketPrice, buyPrice, sellPrice].some((price) => Number.isFinite(price) && price > 0);
    if (!name || !hasUsefulValue) return null;
    return {
      id: Number.isFinite(id) && id > 0 ? id : null,
      name,
      normalizedName: normalizeName(name),
      marketPrice: Number.isFinite(marketPrice) && marketPrice > 0 ? marketPrice : 0,
      buyPrice: Number.isFinite(buyPrice) && buyPrice > 0 ? buyPrice : 0,
      sellPrice: Number.isFinite(sellPrice) && sellPrice > 0 ? sellPrice : 0,
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
      toast(`Loaded ${formatInteger(catalogCount())} item values, including NPC buyback payouts where Torn provides them.`);
      renderLedger();
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
      const clearsRoi = roiPercent >= Number(state.settings.minimumRoiPercent);
      if (clearsRoi && profitEach >= Number(state.settings.goldMinimumProfitEach)) tier = 'gold';
      else if (clearsRoi && profitEach >= Number(state.settings.minimumProfitEach)) tier = 'good';
      else tier = 'minor';
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

  function npcBuybackFor(listingPrice, catalog, quantity = 1) {
    const price = Number(listingPrice) || 0;
    const payout = Number(catalog?.sellPrice) || 0;
    if (price <= 0 || payout <= price) return null;
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const profitEach = payout - price;
    return {
      payout,
      profitEach,
      totalProfit: profitEach * qty,
      qty,
      source: 'Torn item catalog sell_price',
    };
  }

  function marketAnalysisFor(listingPrice, catalog, quantity = 1, fallbackMarketValue = 0) {
    const marketValue = Number(catalog?.marketPrice) > 0 ? Number(catalog.marketPrice) : Number(fallbackMarketValue) || 0;
    const margin = marginFor(listingPrice, marketValue, quantity);
    const npc = npcBuybackFor(listingPrice, catalog, quantity);
    return npc ? { ...margin, tier: 'npc', npc } : margin;
  }

  function manifestTotals(items = []) {
    const rows = items.filter((item) => Number(item?.quantity) > 0 && Number(item?.marketPrice) > 0);
    const marketTotal = rows.reduce((sum, item) => sum + Number(item.marketPrice) * Number(item.quantity), 0);
    // Match the trader's per-item policy exactly: floor each unit to 99%, then multiply by quantity.
    const targetTotal = rows.reduce((sum, item) => sum + traderPayout(item.marketPrice) * Number(item.quantity), 0);
    const totalQuantity = rows.reduce((sum, item) => sum + Number(item.quantity), 0);
    return { marketTotal, targetTotal, totalQuantity, itemTypes: rows.length };
  }


  function overseasLoadPlan(items = [], loadLimit = 21, currentLoad = 0) {
    const limit = Math.max(0, Math.floor(Number(loadLimit) || 0));
    const carried = Math.max(0, Math.min(limit, Math.floor(Number(currentLoad) || 0)));
    let remaining = Math.max(0, limit - carried);
    const planItems = [];
    const ordered = items
      .filter((item) => Number(item?.availableQuantity) > 0 && Number(item?.margin?.profitEach) > 0)
      .sort((a, b) =>
        Number(b.margin.profitEach) - Number(a.margin.profitEach)
        || Number(b.margin.roiPercent) - Number(a.margin.roiPercent)
        || String(a.name || '').localeCompare(String(b.name || ''))
      );
    for (const item of ordered) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, Math.max(0, Math.floor(Number(item.availableQuantity) || 0)));
      if (!quantity) continue;
      planItems.push({
        itemId: item.itemId || item.catalog?.id || null,
        name: item.catalog?.name || item.name,
        quantity,
        unitCost: Number(item.price) || 0,
        marketValue: Number(item.catalog?.marketPrice) || 0,
        traderValue: Number(item.margin?.payout) || 0,
        profitEach: Number(item.margin?.profitEach) || 0,
        totalCost: (Number(item.price) || 0) * quantity,
        marketTotal: (Number(item.catalog?.marketPrice) || 0) * quantity,
        traderReturn: (Number(item.margin?.payout) || 0) * quantity,
        profit: (Number(item.margin?.profitEach) || 0) * quantity,
      });
      remaining -= quantity;
    }
    return {
      loadLimit: limit,
      currentLoad: carried,
      remainingCapacity: Math.max(0, limit - carried),
      plannedQuantity: planItems.reduce((sum, item) => sum + item.quantity, 0),
      totalCost: planItems.reduce((sum, item) => sum + item.totalCost, 0),
      marketTotal: planItems.reduce((sum, item) => sum + item.marketTotal, 0),
      traderReturn: planItems.reduce((sum, item) => sum + item.traderReturn, 0),
      profit: planItems.reduce((sum, item) => sum + item.profit, 0),
      items: planItems,
    };
  }

  function pageLooksLikeOverseasShop() {
    const href = String(location.href || '').toLowerCase();
    if (href.includes('itemmarket') || href.includes('item-market') || href.includes('imarket')) return false;
    const bodyText = normalizeWhitespace(document.body?.innerText || '');
    const routeMatch = href.includes('shops.php')
      || href.includes('foreignshop')
      || href.includes('travelshop')
      || href.includes('abroad');
    const purchaseControls = Boolean(document.querySelector(
      'input[name="amount"],input[name*="buyAmount"],input[id^="item"],button[data-item],[data-item] input,'
      + 'a[href*="buy"],button[class*="buy"],[class*="buy"] button,[class*="cart"],[data-action*="buy"],'
      + '[aria-label*="buy" i],[title*="buy" i]'
    ));
    const foreignMarkers = /\b(?:items?\s+carried|travel\s+capacity|luggage|overseas|abroad|foreign\s+shop)\b/i.test(bodyText);
    const countryMarker = /\b(?:Mexico|Cayman Islands|Canada|Hawaii|United Kingdom|Argentina|Switzerland|Japan|China|United Arab Emirates|South Africa|MEX|CAY|CAN|HAW|UNI|ARG|SWI|JAP|CHI|UAE|SAF)\b/i.test(
      `${document.title || ''} ${[...document.querySelectorAll('h1,h2,h3,h4,h5,[class*=title],[class*=country],[class*=travel]')].map((element) => element.textContent || '').join(' ')}`
    );
    const shopTableMarkers = /\bGeneral Store\b/i.test(bodyText)
      && /\bStock\b/i.test(bodyText)
      && /\bCost\b/i.test(bodyText)
      && /\bBuy\b/i.test(bodyText);
    const dealerMarkers = /\b(?:Arms Dealer|Black Market|Pharmacy|Flower Shop|Souvenir Shop)\b/i.test(bodyText);
    const visibleShopRow = [...document.querySelectorAll('tr,[class*="shop"],[class*="item"]')].some((row) => {
      if (!(row instanceof Element) || row.closest(`#${APP.panelId}`)) return false;
      const text = normalizeWhitespace(row.innerText || row.textContent);
      return /\$[\d,.]+/.test(text) && Boolean(row.querySelector('img'));
    });
    const visiblePrices = /\$[\d,.]+/.test(bodyText);
    return visiblePrices
      && (purchaseControls || shopTableMarkers || visibleShopRow)
      && (routeMatch || foreignMarkers || countryMarker || (shopTableMarkers && dealerMarkers));
  }

  function overseasCountryFromPage() {
    const selectors = [
      'h1,h2,h3,h4,h5',
      '[class*="title"]',
      '[class*="header"]',
      '[class*="country"]',
      '[class*="travel"]',
      '[data-country]',
    ];
    const known = [
      'Mexico', 'Cayman Islands', 'Canada', 'Hawaii', 'United Kingdom',
      'Argentina', 'Switzerland', 'Japan', 'China', 'United Arab Emirates',
      'South Africa',
    ];
    const chunks = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
      .map((element) => normalizeWhitespace(element.getAttribute?.('data-country') || element.textContent))
      .filter(Boolean);
    chunks.push(normalizeWhitespace(document.title || ''));
    chunks.push(normalizeWhitespace(document.body?.innerText || '').slice(0, 6000));
    for (const chunk of chunks) {
      const match = known.find((country) => new RegExp(`\\b${escapeRegExp(country)}\\b`, 'i').test(chunk));
      if (match) return match;
    }
    const countryCodes = {
      MEX: 'Mexico',
      CAY: 'Cayman Islands',
      CAN: 'Canada',
      HAW: 'Hawaii',
      UNI: 'United Kingdom',
      UK: 'United Kingdom',
      ARG: 'Argentina',
      SWI: 'Switzerland',
      JAP: 'Japan',
      CHI: 'China',
      UAE: 'United Arab Emirates',
      SAF: 'South Africa',
    };
    const joined = chunks.join(' ');
    for (const [code, country] of Object.entries(countryCodes)) {
      if (new RegExp(`(?:^|[^A-Za-z])${escapeRegExp(code)}(?:$|[^A-Za-z])`, 'i').test(joined)) return country;
    }
    const generic = joined.match(/(?:shop|market|items?)\s+(?:in|at)\s+([A-Z][A-Za-z .'-]{2,40})/i);
    return normalizeWhitespace(generic?.[1] || '');
  }

  function detectOverseasLoad() {
    const text = normalizeWhitespace(document.body?.innerText || '');
    const patterns = [
      /(?:items?\s+carried|travel\s+capacity|luggage|load|capacity)\D{0,28}([\d,]+)\s*\/\s*([\d,]+)/i,
      /([\d,]+)\s*\/\s*([\d,]+)\s*(?:items?|slots?|capacity)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const current = Math.max(0, Math.floor(parseNumber(match[1]) || 0));
      const limit = Math.max(0, Math.floor(parseNumber(match[2]) || 0));
      if (limit > 0 && current <= limit) return { current, limit, source: match[0] };
    }
    return { current: null, limit: null, source: null };
  }

  function overseasRowForPrice(priceElement) {
    let node = priceElement;
    let best = null;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      if (node.closest(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId}`)) continue;
      const text = normalizeWhitespace(node.innerText || node.textContent);
      if (!text || text.length > 900) continue;
      const prices = countMatches(text, /\$[\d,.]+/g);
      const hasImage = Boolean(node.querySelector('img'));
      const hasPurchaseControl = Boolean(node.querySelector(
        'input[name="amount"],input[name*="buyAmount"],input[id^="item"],button,[role="button"],a[href*="buy"],[class*="buy"],[class*="cart"],[data-action*="buy"]'
      ));
      if (prices < 1 || prices > 3 || (!hasImage && !hasPurchaseControl)) continue;
      best = node;
      const parentText = normalizeWhitespace(node.parentElement?.innerText || '');
      const parentPrices = countMatches(parentText, /\$[\d,.]+/g);
      if (parentPrices > prices || node.matches('li,tr,[data-item],[data-item-id]')) break;
    }
    return best;
  }

  function overseasItemName(row, priceText) {
    const imageName = [...row.querySelectorAll('img[alt],img[title]')]
      .map((image) => normalizeWhitespace(image.getAttribute('alt') || image.getAttribute('title')))
      .find((name) => name && catalogItemFor(name));
    if (imageName) return imageName;

    const lines = String(row.innerText || row.textContent || '')
      .split(/\n+/)
      .map(normalizeWhitespace)
      .filter(Boolean)
      .filter((line) => line !== priceText)
      .filter((line) => !/^\$[\d,.]+$/.test(line))
      .filter((line) => !/^(?:buy|max|available|stock|quantity|qty|cost|price)$/i.test(line));
    for (const line of lines) {
      const exact = catalogItemFor(line, itemIdFromCard(row));
      if (exact) return exact.name;
    }
    const joined = ` ${normalizeWhitespace(row.innerText || row.textContent)} `;
    const catalogNames = Object.values(state.catalog.itemsByName || {})
      .sort((a, b) => b.name.length - a.name.length);
    const contained = catalogNames.find((item) =>
      new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(item.name)}(?:$|[^A-Za-z0-9])`, 'i').test(joined)
    );
    return contained?.name || lines.find((line) => line.length <= 90 && !/^\d[\d,]*$/.test(line)) || '';
  }

  function overseasAvailableQuantity(row, priceElement) {
    const controls = [...row.querySelectorAll('input,button,[data-stock],[data-available],[data-quantity]')];
    for (const control of controls) {
      for (const value of [
        control.getAttribute?.('max'),
        control.getAttribute?.('data-stock'),
        control.getAttribute?.('data-available'),
        control.getAttribute?.('data-quantity'),
      ]) {
        const quantity = Math.floor(parseNumber(value) || 0);
        if (quantity > 0) return quantity;
      }
    }
    const text = normalizeWhitespace(row.innerText || row.textContent);
    const explicit = text.match(/(?:stock|available|remaining|qty|quantity)\s*:?[\s-]*([\d,]+)/i)
      || text.match(/\bx\s*([\d,]+)\b/i)
      || text.match(/\(([\d,]+)\)\s*(?:$|buy|available|stock)/i);
    if (explicit) return Math.max(1, Math.floor(parseNumber(explicit[1]) || 1));

    const price = parseNumber(ownText(priceElement) || priceElement.textContent);
    const numericCells = [...row.querySelectorAll('span,div,p,strong,b,td')]
      .filter((element) => element !== priceElement)
      .map((element) => ownText(element))
      .filter((value) => /^\d[\d,]*$/.test(value))
      .map(parseNumber)
      .filter((value) => Number.isFinite(value) && value > 0 && value !== price && value < 1_000_000);
    return numericCells.length ? Math.max(...numericCells) : 1;
  }

  function overseasShopNameForRow(row) {
    const known = [
      'General Store', 'Arms Dealer', 'Black Market', 'Pharmacy',
      'Flower Shop', 'Souvenir Shop', 'Jewelry Shop', 'Sweet Shop',
    ];
    let node = row;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const text = normalizeWhitespace(node.innerText || node.textContent);
      const match = known.find((name) => new RegExp(`\b${escapeRegExp(name)}\b`, 'i').test(text));
      if (match) return match;
      let sibling = node.previousElementSibling;
      for (let offset = 0; sibling && offset < 3; offset += 1, sibling = sibling.previousElementSibling) {
        const siblingText = normalizeWhitespace(sibling.innerText || sibling.textContent);
        const siblingMatch = known.find((name) => new RegExp(`\b${escapeRegExp(name)}\b`, 'i').test(siblingText));
        if (siblingMatch) return siblingMatch;
      }
    }
    return 'Overseas NPC shop';
  }

  function overseasCandidates() {
    const candidates = [];
    const seen = new Set();
    const priceElements = marketTextElements(/^\$[\d,.]+$/, 'span,div,p,strong,b,td');
    for (const priceElement of priceElements) {
      const row = priceElement.closest(`.${APP.overseasMark}`) || overseasRowForPrice(priceElement);
      if (!row || seen.has(row)) continue;
      const priceText = normalizeWhitespace(ownText(priceElement) || priceElement.innerText || priceElement.textContent);
      const price = parseNumber(priceText);
      if (!Number.isFinite(price) || price <= 0) continue;
      const itemId = itemIdFromCard(row);
      const name = overseasItemName(row, priceText);
      if (!name && !itemId) continue;
      seen.add(row);
      candidates.push({
        row,
        priceElement,
        price,
        name,
        itemId,
        availableQuantity: overseasAvailableQuantity(row, priceElement),
      });
    }
    return candidates;
  }



  function pageLooksLikeProfile() {
    const href = String(location.href || '').toLowerCase();
    if (href.includes('profiles.php') && userIdFromUrl(location.href)) return true;
    const title = normalizeWhitespace(document.title || '');
    if (/(?:[’']s?)\s+profile\b/i.test(title)) return true;
    return false;
  }

  function profileNameFromPage() {
    const patterns = [
      /^(.+?)(?:[’']s?)\s+Profile$/i,
      /^Profile\s*:\s*(.+)$/i,
    ];
    const selectors = [
      'h1,h2,h3,h4,h5',
      '[role="heading"]',
      '.title-black',
      '[class*="title___"]',
      '[class*="header___"]',
    ];
    const candidates = [];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!visibleElement(element) || element.closest(`#${APP.panelId},#${APP.traderOverlayId},#${APP.ledgerOverlayId}`)) continue;
        const text = normalizeWhitespace(element.innerText || element.textContent);
        if (text && text.length <= 120) candidates.push(text);
      }
    }
    candidates.push(normalizeWhitespace(document.title || '').replace(/\s*[|\-].*$/, ''));
    for (const candidate of candidates) {
      for (const pattern of patterns) {
        const match = candidate.match(pattern);
        const name = cleanTradeParticipantName(match?.[1]);
        if (name && !/^your$/i.test(name)) return name;
      }
    }
    const urlId = userIdFromUrl(location.href);
    const profileAnchor = [...document.querySelectorAll('a[href*="profiles.php?XID=" i]')]
      .find((anchor) => userIdFromUrl(anchor.href) === urlId && normalizeWhitespace(anchor.innerText));
    return cleanTradeParticipantName(profileAnchor?.innerText || profileAnchor?.textContent || '');
  }

  function profileBannerUrlFromPage(profileName = '') {
    const nameKey = normalizeName(profileName);
    const images = [...document.querySelectorAll('img[src]')].filter((image) => {
      if (!visibleElement(image) || image.closest(`#${APP.panelId},#${APP.traderOverlayId},#${APP.ledgerOverlayId}`)) return false;
      const src = normalizeHttpUrl(image.currentSrc || image.src);
      if (!src || /\/items\//i.test(src)) return false;
      return true;
    });
    const scored = images.map((image) => {
      const rect = image.getBoundingClientRect();
      const src = normalizeHttpUrl(image.currentSrc || image.src);
      const alt = normalizeWhitespace(image.alt || image.title);
      let score = 0;
      if (/userbar|banner|signature|nameplate/i.test(src)) score += 10;
      if (nameKey && normalizeName(alt).includes(nameKey)) score += 6;
      if (rect.width >= 180 && rect.width / Math.max(1, rect.height) >= 3) score += 6;
      if (rect.width >= 240) score += 2;
      if (rect.height <= 120) score += 1;
      if (/avatar|honor|award|icon|logo/i.test(src)) score -= 4;
      return { src, score, width: rect.width };
    }).filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.width - a.width);
    return scored[0]?.src || '';
  }

  function currentProfileIdentity() {
    const userId = userIdFromUrl(location.href);
    const name = profileNameFromPage();
    const profileUrl = userId
      ? `https://www.torn.com/profiles.php?XID=${userId}`
      : normalizeHttpUrl(location.href);
    return {
      name,
      userId,
      profileUrl,
      tradeUrl: userId ? `https://www.torn.com/trade.php#step=start&userID=${userId}` : '',
      bannerUrl: profileBannerUrlFromPage(name),
      captureSource: 'profile-page',
    };
  }

  function scanProfile(stats) {
    const identity = currentProfileIdentity();
    stats.profileName = identity.name || null;
    stats.profileUserId = identity.userId || null;
    stats.profileUrl = identity.profileUrl || '';
    stats.profileBannerUrl = identity.bannerUrl || '';
    stats.profileCaptureReady = Boolean(identity.name && identity.userId);
    if (!stats.profileCaptureReady) {
      stats.notes.push('Profile detected, but IMM could not resolve both the player name and Torn ID.');
    } else if (!identity.bannerUrl) {
      stats.notes.push('Profile identity is ready. No usable horizontal banner was detected, so the trader card will use the name button.');
    }
  }

  function tradeIdFromLocation() {
    const href = String(location.href || '');
    const direct = href.match(/[?&#]ID=(\d+)/i);
    if (direct) return direct[1];
    try {
      const url = new URL(href);
      const hashParams = new URLSearchParams(String(url.hash || '').replace(/^#/, ''));
      return hashParams.get('ID') || hashParams.get('id') || '';
    } catch {
      return '';
    }
  }

  function tradeCompletionState() {
    const hash = String(location.hash || '');
    if (/(?:^|[&#])step=logview(?:&|$)/i.test(hash)) {
      return { completed: true, source: 'trade log page' };
    }
    const text = normalizeWhitespace(document.body?.innerText || '');
    const patterns = [
      /\bthe trade (?:has been|was) successfully completed\b/i,
      /\bthe trade (?:has been|was) completed\b/i,
      /\bthe trade was accepted by both parties\b/i,
      /\btrade completed successfully\b/i,
    ];
    const match = patterns.find((pattern) => pattern.test(text));
    return match
      ? { completed: true, source: 'completed trade message' }
      : { completed: false, source: '' };
  }

  function stableStringHash(value) {
    let hash = 2166136261;
    for (const character of String(value || '')) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function saleFingerprintForStats(stats) {
    const tradeId = normalizeWhitespace(stats?.tradeId);
    if (tradeId) return `trade:${tradeId}`;
    const manifest = (stats?.tradeItems || [])
      .map((item) => `${normalizeName(item.name)}:${Number(item.quantity) || 0}`)
      .sort()
      .join('|');
    return `trade-fallback:${stableStringHash(`${manifest}|${Number(stats?.tradeNetCash) || 0}`)}`;
  }

  function recordedSaleForStats(stats) {
    const fingerprint = saleFingerprintForStats(stats);
    return (state.ledger.sales || []).find((sale) => sale.fingerprint === fingerprint) || null;
  }

  function lotMatchesTradeItem(lot, item) {
    if (!lot || !item || Number(lot.remainingQuantity || 0) <= 0) return false;
    if (Number(item.itemId) > 0 && Number(lot.itemId) > 0) {
      return Number(item.itemId) === Number(lot.itemId);
    }
    return (lot.normalizedName || normalizeName(lot.itemName)) === normalizeName(item.name);
  }

  function ledgerSalePlan(stats) {
    const items = Array.isArray(stats?.tradeItems) ? stats.tradeItems : [];
    const requestedQuantity = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
    const available = new Map((state.ledger.lots || []).map((lot) => [lot.id, Number(lot.remainingQuantity || 0)]));
    const planItems = [];
    const allocations = [];
    let trackedQuantity = 0;
    let trackedCostBasis = 0;

    for (const item of items) {
      let remaining = Math.max(0, Math.floor(Number(item.quantity) || 0));
      const matchingLots = (state.ledger.lots || [])
        .filter((lot) => lotMatchesTradeItem(lot, item) && Number(available.get(lot.id) || 0) > 0)
        .sort((a, b) => Date.parse(a.capturedAt || '') - Date.parse(b.capturedAt || ''));
      const itemAllocations = [];
      let itemCostBasis = 0;
      for (const lot of matchingLots) {
        if (remaining <= 0) break;
        const quantity = Math.min(remaining, Math.max(0, Math.floor(Number(available.get(lot.id)) || 0)));
        if (quantity <= 0) continue;
        const costBasis = quantity * Number(lot.unitCost || 0);
        itemAllocations.push({
          lotId: lot.id,
          quantity,
          unitCost: Number(lot.unitCost || 0),
          costBasis,
          targetValue: quantity * Number(item.targetEach || 0),
        });
        allocations.push(itemAllocations[itemAllocations.length - 1]);
        available.set(lot.id, Number(available.get(lot.id) || 0) - quantity);
        remaining -= quantity;
        trackedQuantity += quantity;
        trackedCostBasis += costBasis;
        itemCostBasis += costBasis;
      }
      planItems.push({
        ...item,
        trackedQuantity: Number(item.quantity || 0) - remaining,
        untrackedQuantity: remaining,
        costBasis: itemCostBasis,
        allocations: itemAllocations,
      });
    }

    const targetTotal = Math.max(0, Number(stats?.tradeTargetTotal) || 0);
    const netCash = Number(stats?.tradeNetCash);
    for (const item of planItems) {
      const itemProceeds = Number.isFinite(netCash) && targetTotal > 0
        ? netCash * Number(item.targetTotal || 0) / targetTotal
        : 0;
      item.proceeds = itemProceeds;
      item.realizedProfit = item.untrackedQuantity === 0
        ? itemProceeds - item.costBasis
        : null;
      for (const allocation of item.allocations) {
        const fraction = Number(item.quantity || 0) > 0
          ? Number(allocation.quantity || 0) / Number(item.quantity || 0)
          : 0;
        allocation.proceeds = itemProceeds * fraction;
        allocation.realizedProfit = allocation.proceeds - allocation.costBasis;
      }
    }

    const untrackedQuantity = Math.max(0, requestedQuantity - trackedQuantity);
    const fullCoverage = requestedQuantity > 0 && untrackedQuantity === 0;
    const trackedProceeds = planItems.reduce((sum, item) => {
      if (!(Number(item.quantity) > 0)) return sum;
      return sum + Number(item.proceeds || 0) * Number(item.trackedQuantity || 0) / Number(item.quantity);
    }, 0);
    const trackedProfit = Number.isFinite(netCash) ? trackedProceeds - trackedCostBasis : null;
    const realizedProfit = fullCoverage && Number.isFinite(netCash)
      ? netCash - trackedCostBasis
      : null;

    return {
      requestedQuantity,
      trackedQuantity,
      untrackedQuantity,
      fullCoverage,
      trackedCostBasis,
      trackedProceeds,
      trackedProfit,
      realizedProfit,
      items: planItems,
      allocations,
    };
  }

  function applyLedgerSalePreview(stats) {
    const recorded = recordedSaleForStats(stats);
    stats.tradeSaleRecorded = Boolean(recorded);
    stats.tradeSaleRecordId = recorded?.id || null;
    stats.tradeSaleProfit = optionalFiniteNumber(recorded?.realizedProfit)
      ?? optionalFiniteNumber(recorded?.trackedProfit);
    stats.tradeLedgerCostBasis = Number(recorded?.trackedCostBasis) || 0;
    stats.tradeLedgerTrackedQuantity = Number(recorded?.trackedQuantity) || 0;
    stats.tradeLedgerRequestedQuantity = Number(recorded?.requestedQuantity) || 0;
    stats.tradeLedgerUntrackedQuantity = Number(recorded?.untrackedQuantity) || 0;
    stats.tradeLedgerFullCoverage = Boolean(recorded?.fullCoverage);
    if (recorded) return recorded;

    const plan = ledgerSalePlan(stats);
    stats.tradeLedgerCostBasis = plan.trackedCostBasis;
    stats.tradeLedgerTrackedQuantity = plan.trackedQuantity;
    stats.tradeLedgerRequestedQuantity = plan.requestedQuantity;
    stats.tradeLedgerUntrackedQuantity = plan.untrackedQuantity;
    stats.tradeLedgerFullCoverage = plan.fullCoverage;
    stats.tradeSaleProfit = Number.isFinite(plan.realizedProfit) ? plan.realizedProfit : plan.trackedProfit;
    return plan;
  }

  function recordTradeSale(stats, captureMethod = 'manual-completed-trade') {
    if (!stats || stats.pageType !== 'trade') throw new Error('Open a recognized trade before recording a sale.');
    const existing = recordedSaleForStats(stats);
    if (existing) return existing;
    if (!Array.isArray(stats.tradeItems) || !stats.tradeItems.length) {
      throw new Error('No trade items were available to record.');
    }
    if (stats.tradeUnmatchedItems) {
      throw new Error('Unmatched trade items must be resolved before the ledger can consume lots.');
    }
    if (optionalFiniteNumber(stats.tradeNetCash) === null) {
      throw new Error('Trader cash was not detected.');
    }

    const plan = ledgerSalePlan(stats);
    if (!plan.trackedQuantity) {
      throw new Error('None of the sold quantities matched open ledger lots.');
    }

    for (const allocation of plan.allocations) {
      const lot = state.ledger.lots.find((candidate) => candidate.id === allocation.lotId);
      if (!lot) continue;
      lot.remainingQuantity = Math.max(0, Number(lot.remainingQuantity || 0) - Number(allocation.quantity || 0));
      lot.status = lot.remainingQuantity > 0 ? 'open' : 'closed';
    }

    const completion = tradeCompletionState();
    const sale = normalizeSaleRecord({
      id: createId('sale'),
      fingerprint: saleFingerprintForStats(stats),
      tradeId: stats.tradeId || tradeIdFromLocation(),
      counterparty: stats.tradeCounterparty,
      counterpartyId: stats.tradeCounterpartyId,
      counterpartyProfileUrl: stats.tradeCounterpartyProfileUrl,
      soldAt: new Date().toISOString(),
      saleUrl: location.href,
      captureMethod,
      completionSource: completion.source,
      cashReceived: Number(stats.tradeNetCash),
      myCash: Number(stats.tradeMyCash) || 0,
      marketTotal: Number(stats.tradeMarketTotal) || 0,
      targetTotal: Number(stats.tradeTargetTotal) || 0,
      trackedCostBasis: plan.trackedCostBasis,
      realizedProfit: plan.realizedProfit,
      trackedProfit: plan.trackedProfit,
      requestedQuantity: plan.requestedQuantity,
      trackedQuantity: plan.trackedQuantity,
      untrackedQuantity: plan.untrackedQuantity,
      fullCoverage: plan.fullCoverage,
      items: plan.items.map((item) => ({
        itemId: item.itemId || null,
        itemName: item.name,
        quantity: item.quantity,
        trackedQuantity: item.trackedQuantity,
        untrackedQuantity: item.untrackedQuantity,
        marketTotal: item.marketTotal,
        targetTotal: item.targetTotal,
        costBasis: item.costBasis,
        proceeds: item.proceeds,
        realizedProfit: item.realizedProfit,
        allocations: item.allocations,
      })),
      notes: plan.fullCoverage
        ? 'FIFO purchase-lot allocation.'
        : `FIFO allocation with ${plan.untrackedQuantity} untracked item${plan.untrackedQuantity === 1 ? '' : 's'}.`,
    });
    state.ledger.sales.unshift(sale);
    saveLedger();
    applyLedgerSalePreview(stats);
    renderLedger();
    renderPanel();
    return sale;
  }

  function maybeAutoRecordCompletedTrade(stats) {
    const completion = tradeCompletionState();
    stats.tradeCompleted = completion.completed;
    stats.tradeCompletionSource = completion.source;
    if (!completion.completed || recordedSaleForStats(stats)) return null;
    if (stats.tradeUnmatchedItems || optionalFiniteNumber(stats.tradeNetCash) === null) return null;
    const plan = ledgerSalePlan(stats);
    if (!plan.fullCoverage) {
      if (plan.trackedQuantity > 0) {
        stats.notes.push(`Completed trade detected, but ${plan.untrackedQuantity} sold item${plan.untrackedQuantity === 1 ? '' : 's'} are not covered by the ledger. Record manually after review.`);
      }
      return null;
    }
    const sale = recordTradeSale(stats, 'auto-completed-trade');
    toast(`Sale recorded. Profit ${sale.realizedProfit >= 0 ? '+' : ''}${formatMoney(sale.realizedProfit)}.`);
    return sale;
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


  function tradeSideIdentity(side) {
    const name = cleanTradeParticipantName(side?.heading);
    const nameKey = normalizeName(name);
    const roots = [side?.element, document].filter(Boolean);
    let userId = null;
    let profileUrl = '';
    let bannerUrl = '';
    for (const root of roots) {
      const anchors = [...root.querySelectorAll?.('a[href*="profiles.php" i],a[href*="trade.php" i]') || []];
      for (const anchor of anchors) {
        const anchorText = normalizeName(anchor.innerText || anchor.textContent || '');
        if (nameKey && anchorText && !anchorText.includes(nameKey)) continue;
        const candidateId = userIdFromUrl(anchor.href);
        if (!candidateId) continue;
        userId = candidateId;
        if (/profiles\.php/i.test(anchor.href)) profileUrl = normalizeHttpUrl(anchor.href);
        break;
      }
      if (userId) break;
    }
    const saved = state.traders.find((trader) =>
      (userId && trader.userId === userId) || trader.normalizedName === nameKey
    );
    if (!userId) userId = saved?.userId || null;
    if (!profileUrl) profileUrl = saved?.profileUrl || (userId ? `https://www.torn.com/profiles.php?XID=${userId}` : '');
    bannerUrl = saved?.bannerUrl || '';
    return { name, userId, profileUrl, bannerUrl };
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
    stats.tradeId = tradeIdFromLocation() || null;
    const counterpartyIdentity = tradeSideIdentity(otherSide);
    stats.tradeCounterparty = counterpartyIdentity.name || null;
    stats.tradeCounterpartyId = counterpartyIdentity.userId || null;
    stats.tradeCounterpartyProfileUrl = counterpartyIdentity.profileUrl || '';
    stats.tradeCounterpartyBannerUrl = counterpartyIdentity.bannerUrl || '';
    const completion = tradeCompletionState();
    stats.tradeCompleted = completion.completed;
    stats.tradeCompletionSource = completion.source || null;
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
      itemId: item.catalog.id || item.itemId || null,
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

    applyLedgerSalePreview(stats);

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
    const ignored = `#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},.${APP.badgeClass},[data-tsimm-generated]`;
    return [...document.querySelectorAll(selector)].filter((element) =>
      ownText(element) && !element.closest(ignored)
    );
  }

  function exactTextElements(regex, selector = 'span,div,p,strong,b') {
    const ignored = `#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},.${APP.badgeClass},[data-tsimm-generated]`;
    return [...document.querySelectorAll(selector)].filter((element) => {
      if (element.closest(ignored)) return false;
      const text = normalizeWhitespace(ownText(element) || element.innerText || element.textContent);
      if (!regex.test(text)) return false;
      return ![...element.children]
        .filter((child) => !child.matches?.(`.${APP.badgeClass},[data-tsimm-generated]`))
        .some((child) => regex.test(normalizeWhitespace(ownText(child) || child.innerText || child.textContent)));
    });
  }

  function marketTextElements(regex, selector = 'span,div,p,strong,b') {
    const direct = directTextElements(selector).filter((element) =>
      regex.test(normalizeWhitespace(ownText(element)))
    );
    return direct.length ? direct : exactTextElements(regex, selector);
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
    const priceElements = marketTextElements(categoryPriceRegex);
    for (const priceElement of priceElements) {
      const priceText = normalizeWhitespace(ownText(priceElement) || priceElement.innerText || priceElement.textContent);
      const match = priceText.match(/^\$([\d,.]+)\s*\(([\d,]+)\)$/);
      if (!match) continue;
      const card = priceElement.closest(`.${APP.categoryMark}`) || findCategoryCard(priceElement);
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
    const elements = marketTextElements(/^Value:\s*\$[\d,.]+$/i);
    for (const element of elements) {
      const text = normalizeWhitespace(ownText(element) || element.innerText || element.textContent);
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
      const visibleItemName = listingItemNameFromPage();
      if (
        item?.marketPrice > 0
        && visibleItemName
        && normalizeName(visibleItemName) !== normalizeName(item.name)
      ) {
        return {
          value: null,
          visibleValue: null,
          source: 'page-transition',
          itemId,
          itemName: item.name,
        };
      }
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
    const priceElements = marketTextElements(/^\$[\d,.]+$/);
    for (const priceElement of priceElements) {
      const row = priceElement.closest(`.${APP.listingMark}`) || findListingRow(priceElement);
      if (!row || seen.has(row)) continue;
      const price = parseNumber(normalizeWhitespace(ownText(priceElement) || priceElement.innerText || priceElement.textContent));
      const quantity = extractListingQuantity(row, priceElement);
      if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) continue;
      seen.add(row);
      candidates.push({ row, priceElement, price, quantity });
    }
    return candidates;
  }

  const MARKET_TIER_CLASSES = Object.freeze([
    'tsimm-tier-npc',
    'tsimm-tier-gold',
    'tsimm-tier-good',
    'tsimm-tier-minor',
    'tsimm-tier-loss',
  ]);

  function clearTierMark(element, markClass) {
    if (!(element instanceof Element)) return;
    element.classList.remove(markClass, ...MARKET_TIER_CLASSES);
    delete element.dataset.tsimmScanToken;
  }

  function clearMarketAnnotations() {
    document.querySelectorAll(`.${APP.badgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.categoryMark}`).forEach((element) => clearTierMark(element, APP.categoryMark));
    document.querySelectorAll(`.${APP.listingMark}`).forEach((element) => clearTierMark(element, APP.listingMark));
    document.querySelectorAll(`.${APP.overseasMark}`).forEach((element) => clearTierMark(element, APP.overseasMark));
  }

  function clearAnnotations() {
    clearTradeAnnotations();
    clearMarketAnnotations();
  }

  function directMarginBadge(target, mode) {
    if (!(target instanceof Element)) return null;
    return [...target.children].find((child) =>
      child.classList?.contains(APP.badgeClass)
      && child.classList?.contains(`tsimm-badge-${mode}`)
    ) || null;
  }

  function applyTierMark(element, markClass, tier, scanToken) {
    if (!(element instanceof Element)) return;
    element.classList.remove(markClass, ...MARKET_TIER_CLASSES);
    element.classList.add(markClass, `tsimm-tier-${tier}`);
    element.dataset.tsimmScanToken = scanToken;
  }

  function removeDirectMarginBadge(target, mode, highlightTarget, markClass) {
    directMarginBadge(target, mode)?.remove();
    clearTierMark(highlightTarget, markClass);
  }

  function pruneMarketAnnotations(scanToken) {
    document.querySelectorAll(`.${APP.badgeClass}`).forEach((badge) => {
      if (badge.dataset.tsimmScanToken === scanToken) return;
      badge.remove();
    });
    document.querySelectorAll(`.${APP.categoryMark}`).forEach((element) => {
      if (element.dataset.tsimmScanToken !== scanToken) clearTierMark(element, APP.categoryMark);
    });
    document.querySelectorAll(`.${APP.listingMark}`).forEach((element) => {
      if (element.dataset.tsimmScanToken !== scanToken) clearTierMark(element, APP.listingMark);
    });
    document.querySelectorAll(`.${APP.overseasMark}`).forEach((element) => {
      if (element.dataset.tsimmScanToken !== scanToken) clearTierMark(element, APP.overseasMark);
    });
  }

  function badgeHtml(margin, mode) {
    const sign = margin.profitEach > 0 ? '+' : '';
    const auditLine = `Ⓜ ${formatMoney(margin.value)} · Ⓣ ${formatMoney(margin.payout)}`;
    if (margin.tier === 'npc' && margin.npc) {
      if (mode === 'category') {
        return `<strong>NPC pays +${escapeHtml(formatMoney(margin.npc.profitEach))} ea</strong>`
          + `<span>Ⓢ ${escapeHtml(formatMoney(margin.npc.payout))} · listed ${escapeHtml(formatMoney(margin.price))}</span>`
          + '<span>Guaranteed store exit</span>';
      }
      return `<strong>NPC pays ${escapeHtml(formatMoney(margin.npc.payout))}</strong>`
        + `<span>+${escapeHtml(formatMoney(margin.npc.profitEach))} ea · +${escapeHtml(formatMoney(margin.npc.totalProfit))} lot</span>`
        + '<span>Sell to an NPC store</span>';
    }
    if (mode === 'category') {
      return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
        + `<span>${escapeHtml(auditLine)}</span>`
        + `<span>${escapeHtml(formatPercent(margin.roiPercent))} ROI</span>`;
    }
    if (mode === 'overseas') {
      const stockSign = margin.totalProfit > 0 ? '+' : '';
      return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
        + `<span>${escapeHtml(formatInteger(margin.qty))} visible · ${stockSign}${escapeHtml(formatMoney(margin.totalProfit))}</span>`
        + `<span>${escapeHtml(auditLine)} · ${escapeHtml(formatPercent(margin.roiPercent))}</span>`;
    }
    const totalSign = margin.totalProfit > 0 ? '+' : '';
    return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
      + `<span>${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} lot · ${escapeHtml(formatPercent(margin.roiPercent))}</span>`
      + `<span>${escapeHtml(auditLine)}</span>`;
  }

  function addBadge(target, margin, mode, highlightTarget = target, scanToken = '') {
    const markClass = mode === 'category' ? APP.categoryMark : (mode === 'overseas' ? APP.overseasMark : APP.listingMark);
    if (margin.tier === 'loss' && !state.settings.showLossesDuringTesting) {
      removeDirectMarginBadge(target, mode, highlightTarget, markClass);
      return;
    }

    let badge = directMarginBadge(target, mode);
    const html = badgeHtml(margin, mode);
    const signature = [
      margin.tier,
      margin.price,
      margin.value,
      margin.payout,
      margin.qty,
      margin.profitEach,
      margin.totalProfit,
      margin.roiPercent.toFixed(4),
      margin.npc?.payout || 0,
      margin.npc?.profitEach || 0,
      margin.npc?.totalProfit || 0,
    ].join('|');

    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.tsimmGenerated = 'true';
      target.appendChild(badge);
    }
    if (badge.dataset.tsimmSignature !== signature) {
      badge.className = `${APP.badgeClass} tsimm-badge-${mode} tsimm-tier-${margin.tier}`;
      badge.innerHTML = html;
      badge.dataset.tsimmSignature = signature;
    }
    badge.dataset.tsimmScanToken = scanToken;

    if (mode === 'category') {
      const computed = getComputedStyle(target);
      if (computed.position === 'static') target.style.position = 'relative';
    }
    applyTierMark(highlightTarget, markClass, margin.tier, scanToken);
  }

  function scanCategory(stats, scanToken) {
    const candidates = categoryCandidates();
    stats.categoryCandidates = candidates.length;
    for (const candidate of candidates) {
      const catalog = catalogItemFor(candidate.name, candidate.itemId);
      if (!catalog || !candidate.lowestPrice) continue;
      const margin = marketAnalysisFor(candidate.lowestPrice, catalog, 1);
      addBadge(candidate.card, margin, 'category', candidate.card, scanToken);
      stats.categoryMatched += 1;
      if (margin.tier === 'npc') stats.categoryNpc += 1;
      if (margin.tier === 'gold') stats.categoryGold += 1;
      if (margin.tier === 'good') stats.categoryGood += 1;
      if (margin.tier === 'minor') stats.categoryMinor += 1;
      if (margin.tier === 'loss') stats.categoryLoss += 1;
    }
  }

  function scanListings(stats, scanToken) {
    const candidates = listingCandidates();
    stats.listingCandidates = candidates.length;
    if (!candidates.length) return;

    const resolution = resolveListingMarketValue();
    stats.visibleMarketValue = resolution.visibleValue;
    stats.listingMarketValue = resolution.value;
    stats.listingMarketValueSource = resolution.source;
    stats.listingItemId = resolution.itemId;
    stats.listingItemName = resolution.itemName;
    if (!resolution.value) return;
    const catalog = catalogItemFor(resolution.itemName, resolution.itemId);

    for (const candidate of candidates) {
      const margin = marketAnalysisFor(candidate.price, catalog, candidate.quantity, resolution.value);
      addBadge(candidate.priceElement, margin, 'listing', candidate.row, scanToken);
      stats.listingMatched += 1;
      if (margin.tier === 'npc') stats.listingNpc += 1;
      if (margin.tier === 'gold') stats.listingGold += 1;
      if (margin.tier === 'good') stats.listingGood += 1;
      if (margin.tier === 'minor') stats.listingMinor += 1;
      if (margin.tier === 'loss') stats.listingLoss += 1;
    }
  }


  function scanOverseas(stats, scanToken) {
    const candidates = overseasCandidates();
    stats.overseasCandidates = candidates.length;
    stats.overseasCountry = overseasCountryFromPage();
    const detectedLoad = detectOverseasLoad();
    const configuredLimit = Math.max(0, Math.floor(Number(state.settings.overseasLoadLimit) || 21));
    const currentLoad = detectedLoad.current ?? 0;
    stats.overseasDetectedLoad = detectedLoad.current;
    stats.overseasDetectedLimit = detectedLoad.limit;
    stats.overseasLoadSource = detectedLoad.source;
    stats.overseasLoadLimit = configuredLimit;
    stats.overseasRemainingCapacity = Math.max(0, configuredLimit - Math.min(configuredLimit, currentLoad));

    const priced = [];
    for (const candidate of candidates) {
      const catalog = catalogItemFor(candidate.name, candidate.itemId);
      if (!catalog) continue;
      const visibleQuantity = Math.max(1, Math.floor(Number(candidate.availableQuantity) || 1));
      const margin = marginFor(candidate.price, catalog.marketPrice, visibleQuantity);
      addBadge(candidate.priceElement, margin, 'overseas', candidate.row, scanToken);
      const item = { ...candidate, catalog, margin };
      priced.push(item);
      stats.overseasMatched += 1;
      if (margin.tier === 'gold') stats.overseasGold += 1;
      if (margin.tier === 'good') stats.overseasGood += 1;
      if (margin.tier === 'minor') stats.overseasMinor += 1;
      if (margin.tier === 'loss') stats.overseasLoss += 1;
    }


    const plan = overseasLoadPlan(priced, configuredLimit, currentLoad);
    stats.overseasRemainingCapacity = plan.remainingCapacity;
    stats.overseasPlanQuantity = plan.plannedQuantity;
    stats.overseasPlanCost = plan.totalCost;
    stats.overseasPlanMarketTotal = plan.marketTotal;
    stats.overseasPlanTraderReturn = plan.traderReturn;
    stats.overseasPlanProfit = plan.profit;
    stats.overseasPlanItems = plan.items;

    const countryKey = normalizeName(stats.overseasCountry);
    const cargoLots = (state.ledger.lots || []).filter((lot) => {
      if (Number(lot.remainingQuantity || 0) <= 0) return false;
      if (normalizeName(lot.source) !== 'overseas' && normalizeName(lot.venue) !== 'overseas') return false;
      return !countryKey || !normalizeName(lot.country) || normalizeName(lot.country) === countryKey;
    });
    stats.overseasCargoLots = cargoLots.length;
    stats.overseasCargoQuantity = cargoLots.reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0), 0);
    stats.overseasCargoCost = cargoLots.reduce((sum, lot) =>
      sum + Number(lot.unitCost || 0) * Number(lot.remainingQuantity || 0), 0);
    stats.overseasCargoTraderReturn = cargoLots.reduce((sum, lot) =>
      sum + Number(lot.traderValueAtPurchase || 0) * Number(lot.remainingQuantity || 0), 0);
    stats.overseasCargoProfit = stats.overseasCargoTraderReturn - stats.overseasCargoCost;
  }

  function detectPageType(stats) {
    if (stats.tradeSideCandidates) return 'trade';
    if (stats.listingCandidates) return stats.listingMarketValue ? 'item listings' : 'item listings (value unresolved)';
    if (stats.categoryCandidates) return 'category';
    return 'unknown';
  }

  function comparableScanStats(stats) {
    const clone = structuredCloneSafe(stats || {});
    delete clone.scannedAt;
    return JSON.stringify(clone);
  }

  function scanPage() {
    state.scanTimer = null;
    state.scanDueAt = 0;
    state.lastScanStartedAt = Date.now();

    const isProfile = pageLooksLikeProfile();
    const isOverseas = !isProfile && pageLooksLikeOverseasShop();
    const isItemMarket = !isOverseas && pageLooksLikeItemMarket();
    const isTrade = !isProfile && !isOverseas && pageLooksLikeTrade();
    const hasPriceCaptureContext = Boolean(activePendingTraderCapture() || activePriceRecaptureRequest());
    const isPriceCapturePage = !isItemMarket && !isTrade && !isProfile && !isOverseas && hasPriceCaptureContext;
    if (!isItemMarket && !isTrade && !isProfile && !isOverseas && !isPriceCapturePage) {
      clearAnnotations();
      document.getElementById(APP.panelId)?.remove();
      state.lastScan = emptyScanStats();
      state.lastScan.notes.push('Waiting for the Item Market, overseas shop, Trade, player Profile, or an armed price-page capture.');
      return;
    }

    const previousSignature = comparableScanStats(state.lastScan);
    const stats = emptyScanStats();

    if (isItemMarket || isOverseas) {
      clearTradeAnnotations();
      const scanToken = String(++state.marketScanGeneration);
      if (isItemMarket) {
        scanCategory(stats, scanToken);
        scanListings(stats, scanToken);
      }
      if (isOverseas) scanOverseas(stats, scanToken);
      pruneMarketAnnotations(scanToken);
    } else {
      clearMarketAnnotations();
      clearTradeAnnotations();
    }

    if (isTrade) scanTrade(stats);
    if (isProfile) scanProfile(stats);
    stats.pageType = isProfile ? 'profile' : (isTrade ? 'trade' : (isOverseas ? 'overseas shop' : (isPriceCapturePage ? 'price capture' : detectPageType(stats))));
    if (isPriceCapturePage) stats.notes.push('Trader capture is armed. Use Capture this page after the pricing or receipt content finishes loading.');
    stats.scannedAt = new Date().toISOString();
    if (!catalogCount()) stats.notes.push('No catalog values cached. Press Sync values.');
    if (stats.categoryCandidates && !stats.categoryMatched) {
      stats.notes.push('Category tiles were found, but their names did not match the cached catalog.');
    }
    if (stats.listingMarketValue && !stats.listingCandidates) {
      stats.notes.push('The item value was resolved, but listing rows were not recognized.');
    }
    if (stats.listingCandidates && !stats.listingMarketValue) {
      if (stats.listingMarketValueSource === 'page-transition') {
        stats.notes.push('The Item Market page is still switching items; IMM is waiting for the visible item name to match the URL.');
      } else {
        stats.notes.push('Listing rows were found, but no market value could be resolved from the page or cached item ID.');
      }
    }
    if (stats.listingMarketValueSource === 'catalog-item-id') {
      stats.notes.push('The compact listing page hid Value; IMM used the cached catalog value for the itemID in the URL.');
    }
    if (isOverseas && stats.overseasCandidates && !stats.overseasMatched) {
      stats.notes.push('Overseas shop rows were found, but their item names did not match the cached catalog.');
    }
    if (isOverseas && stats.overseasDetectedLoad === null) {
      stats.notes.push(`Current carried load was not visible; the planner assumes 0/${stats.overseasLoadLimit}.`);
    }
    if (isOverseas && stats.overseasDetectedLimit && stats.overseasDetectedLimit !== stats.overseasLoadLimit) {
      stats.notes.push(`The page shows a ${stats.overseasDetectedLimit}-item capacity; IMM is using your configured ${stats.overseasLoadLimit}-item limit.`);
    }

    state.lastScan = stats;
    const recordedSale = isTrade ? maybeAutoRecordCompletedTrade(stats) : null;
    const nextSignature = comparableScanStats(stats);
    if (
      recordedSale
      || previousSignature !== nextSignature
      || !document.getElementById(APP.panelId)
    ) {
      renderPanel();
    }
    maybeScheduleTraderPriceRecapture();
  }

  function pageLooksLikeItemMarket() {
    const href = location.href.toLowerCase();
    if (href.includes('itemmarket') || href.includes('item-market') || href.includes('imarket')) return true;
    const title = normalizeWhitespace(document.querySelector('h1,h2,[role="heading"]')?.textContent);
    if (/item market/i.test(title)) return true;
    return /\bItem Market\b/i.test(document.body?.innerText || '');
  }

  function scheduleFastScan(delay = APP.fastScanDelayMs) {
    const now = Date.now();
    const requestedDelay = Math.max(0, Number(delay) || 0);
    const minimumWait = Math.max(0, APP.minimumScanIntervalMs - (now - state.lastScanStartedAt));
    const dueAt = now + Math.max(requestedDelay, minimumWait);

    if (state.scanTimer && state.scanDueAt <= dueAt) return;
    clearTimeout(state.scanTimer);
    state.scanDueAt = dueAt;
    state.scanTimer = setTimeout(scanPage, Math.max(0, dueAt - Date.now()));
  }

  function scheduleScan(delay = APP.fastScanDelayMs) {
    scheduleFastScan(delay);
    clearTimeout(state.settleScanTimer);
    state.settleScanTimer = setTimeout(() => {
      state.settleScanTimer = null;
      scheduleFastScan(0);
    }, APP.settleScanDelayMs);
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
    const overseas = pageLooksLikeOverseasShop();
    const resolution = overseas ? { itemId: null, itemName: null, value: null } : resolveListingMarketValue();
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
      source: overseas ? 'overseas' : 'item-market',
      country: overseas ? overseasCountryFromPage() : '',
      createdAt: new Date().toISOString(),
      purchaseUrl: location.href,
      confirmationText: sanitizePurchaseSignalText(parsed.confirmationText),
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
      snippet: sanitizePurchaseSignalText(snippet).slice(0, 360),
      url: normalizeWhitespace(url).slice(0, 300),
      pendingId: state.pendingPurchase?.id || null,
    });
    state.purchaseSignals = state.purchaseSignals.slice(0, 20);
  }

  function parsePurchaseSuccessText(value) {
    const text = normalizeWhitespace(value);
    const patterns = [
      /\bYou\s+bought\s+([\d,]+)\s*x\s+(.+?)\s+from\s+(.+?)\s+for\s+(?:a\s+total\s+of\s+)?\$([\d,]+)\b/i,
      /\bYou\s+bought\s+([\d,]+)\s*x\s+(.+?)\s+for\s+(?:a\s+total\s+of\s+)?\$([\d,]+)\b/i,
      /\bYou\s+bought\s+([\d,]+)\s+(.+?)\s+for\s+(?:a\s+total\s+of\s+)?\$([\d,]+)\b/i,
    ];
    for (let index = 0; index < patterns.length; index += 1) {
      const match = text.match(patterns[index]);
      if (!match) continue;
      const withSeller = index === 0;
      const quantity = Math.max(0, Math.floor(parseNumber(match[1]) || 0));
      const itemName = normalizeWhitespace(match[2]);
      const totalCost = Math.max(0, parseNumber(match[withSeller ? 4 : 3]) || 0);
      if (!itemName || quantity <= 0 || totalCost <= 0) continue;
      return {
        itemName,
        quantity,
        totalCost,
        unitCost: totalCost / quantity,
        successText: match[0],
      };
    }
    return null;
  }

  function purchaseFingerprint(parsed) {
    return [
      normalizeName(parsed?.itemName),
      Math.floor(Number(parsed?.quantity) || 0),
      Math.round(Number(parsed?.totalCost) || 0),
      Number(itemIdFromLocation()) || 0,
      stableTextHash(parsed?.successText),
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
    const overseas = pageLooksLikeOverseasShop();
    if (!pageLooksLikeItemMarket() && !overseas) return null;
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

    const itemId = overseas ? null : itemIdFromLocation();
    const catalog = catalogItemFor(parsed.itemName, itemId);
    const marketValueAtPurchase = Number(catalog?.marketPrice || (overseas ? 0 : resolveListingMarketValue().value) || 0);
    const lot = buildLedgerLot({
      source: overseas ? 'overseas' : 'item-market',
      venue: overseas ? 'overseas' : 'item-market',
      country: overseas ? overseasCountryFromPage() : '',
      itemId: catalog?.id || itemId || null,
      itemName: catalog?.name || parsed.itemName,
      quantity: parsed.quantity,
      unitCost: parsed.unitCost,
      marketValueAtPurchase,
      traderValueAtPurchase: traderPayout(marketValueAtPurchase),
      capturedAt: new Date().toISOString(),
      purchaseUrl: url || location.href,
      notes: 'Captured from Torn success message.',
    }, source);

    rememberPurchaseFingerprint(fingerprint);
    recordPurchaseSignal('success', source, parsed.successText, url);
    addLedgerLot(lot);
    scheduleScan(30);
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

  function relevantPurchaseRequest(value) {
    const url = String(value || '').toLowerCase();
    return url.includes('itemmarket')
      || url.includes('item-market')
      || url.includes('sid=itemmarket')
      || url.includes('shops.php')
      || url.includes('foreignshop')
      || (url.includes('page.php') && pageLooksLikeItemMarket())
      || pageLooksLikeOverseasShop();
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
          if (pendingIdAtStart && pendingIdAtStart === state.pendingPurchase?.id && relevantPurchaseRequest(requestUrl)) {
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
            if (!relevantPurchaseRequest(this.__tsimmUrl)) return;
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
    if ((!pageLooksLikeItemMarket() && !pageLooksLikeOverseasShop()) || event.target.closest?.(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId}`)) return;
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
      if (!imported.lots.length && !imported.sales.length) {
        throw new Error('No valid purchase lots or sale records were found.');
      }
      const mergedLots = new Map(state.ledger.lots.map((lot) => [lot.id, lot]));
      for (const lot of imported.lots) mergedLots.set(lot.id, lot);
      const mergedSales = new Map((state.ledger.sales || []).map((sale) => [sale.id, sale]));
      for (const sale of imported.sales) mergedSales.set(sale.id, sale);
      state.ledger = normalizeLedger({
        lots: [...mergedLots.values()],
        sales: [...mergedSales.values()],
      });
      saveLedger();
      renderLedger();
      renderPanel();
      toast(`Imported ${formatInteger(imported.lots.length)} lots and ${formatInteger(imported.sales.length)} sales.`);
    } catch (error) {
      toast(error?.message || 'Ledger import failed.');
    }
  }

  function relativeAge(value) {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return 'not synced';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function ledgerProfitClass(tier) {
    if (tier === 'gold') return 'tsimm-ledger-gold';
    if (tier === 'good') return 'tsimm-ledger-profit';
    if (tier === 'minor') return 'tsimm-ledger-minor';
    return 'tsimm-ledger-loss';
  }

  function lotProfitProjection(lot) {
    const originalMarketValue = Math.max(0, Number(lot.marketValueAtPurchase) || 0);
    const original = originalMarketValue > 0
      ? marginFor(lot.unitCost, originalMarketValue, lot.quantity)
      : null;
    const catalog = catalogItemFor(lot.itemName, lot.itemId);
    const currentMarketValue = Math.max(0, Number(catalog?.marketPrice) || 0);
    const remaining = Math.max(0, Number(lot.remainingQuantity) || 0);
    const current = currentMarketValue > 0 && remaining > 0
      ? marginFor(lot.unitCost, currentMarketValue, remaining)
      : null;
    return { original, current, currentMarketValue };
  }

  function sortLedgerLots(lots, sortMode) {
    const result = [...lots];
    result.sort((left, right) => {
      if (sortMode === 'oldest') return Date.parse(left.capturedAt || '') - Date.parse(right.capturedAt || '');
      if (sortMode === 'profit-now') {
        const leftProfit = lotProfitProjection(left).current?.totalProfit ?? Number.NEGATIVE_INFINITY;
        const rightProfit = lotProfitProjection(right).current?.totalProfit ?? Number.NEGATIVE_INFINITY;
        return rightProfit - leftProfit;
      }
      if (sortMode === 'item-name') return String(left.itemName).localeCompare(String(right.itemName));
      if (sortMode === 'purchase-price') return Number(right.unitCost || 0) - Number(left.unitCost || 0);
      return Date.parse(right.capturedAt || '') - Date.parse(left.capturedAt || '');
    });
    return result;
  }

  function visibleLedgerLots() {
    const view = state.ledgerUi.view;
    const query = normalizeName(state.ledgerUi.search);
    let lots = state.ledger.lots || [];
    if (view === 'holdings') lots = lots.filter((lot) => Number(lot.remainingQuantity || 0) > 0);
    if (view === 'history' && !state.ledgerUi.showSold) {
      lots = lots.filter((lot) => Number(lot.remainingQuantity || 0) > 0);
    }
    if (query) lots = lots.filter((lot) => normalizeName(lot.itemName).includes(query));
    return sortLedgerLots(lots, state.ledgerUi.sort);
  }

  function saleAllocationsForLot(lotId) {
    const entries = [];
    for (const sale of state.ledger.sales || []) {
      for (const item of sale.items || []) {
        for (const allocation of item.allocations || []) {
          if (allocation.lotId !== lotId) continue;
          entries.push({
            sale,
            item,
            ...allocation,
          });
        }
      }
    }
    return entries;
  }

  function ledgerLotHtml(lot) {
    const soldQuantity = Math.max(0, Number(lot.quantity || 0) - Number(lot.remainingQuantity || 0));
    const remaining = Math.max(0, Number(lot.remainingQuantity || 0));
    const projection = lotProfitProjection(lot);
    const originalProfit = projection.original?.totalProfit ?? null;
    const originalClass = projection.original ? ledgerProfitClass(projection.original.tier) : '';
    const currentProfit = projection.current?.totalProfit ?? null;
    const currentClass = projection.current ? ledgerProfitClass(projection.current.tier) : '';
    const when = (() => {
      const date = new Date(lot.capturedAt);
      return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown date';
    })();
    const status = remaining > 0 ? (soldQuantity > 0 ? 'partial' : 'open') : 'sold';
    const currentProfitText = remaining <= 0
      ? 'Sold out'
      : currentProfit === null
        ? 'Current value unavailable'
        : `${currentProfit >= 0 ? '+' : ''}${formatMoney(currentProfit)}`;
    return `
      <article class="tsimm-ledger-lot" data-tsimm-lot-id="${escapeHtml(lot.id)}">
        <div class="tsimm-ledger-lot-head">
          <strong>${escapeHtml(lot.itemName)}</strong>
          <span>${escapeHtml(status)}</span>
        </div>
        <div class="tsimm-ledger-lot-grid">
          <span>Obtained</span><strong>${formatInteger(lot.quantity)}</strong>
          <span>Remaining</span><strong>${formatInteger(remaining)}</strong>
          <span>Paid each</span><strong>${formatMoney(lot.unitCost)}</strong>
          <span>Total paid</span><strong>${formatMoney(lot.totalCost)}</strong>
          <span>Possible profit when bought</span><strong class="${originalClass}">${originalProfit === null ? 'Original value unavailable' : `${originalProfit >= 0 ? '+' : ''}${formatMoney(originalProfit)}`}</strong>
          <span>Possible profit now${remaining > 0 ? ' on remaining' : ''}</span><strong class="${currentClass}">${escapeHtml(currentProfitText)}</strong>
        </div>
        <div class="tsimm-ledger-lot-foot">
          <small>${escapeHtml(when)}</small>
          <div>
            <button type="button" data-tsimm-action="ledger-edit" data-tsimm-lot-id="${escapeHtml(lot.id)}">Edit</button>
            <button type="button" data-tsimm-action="ledger-delete" data-tsimm-lot-id="${escapeHtml(lot.id)}">Delete</button>
          </div>
        </div>
      </article>
    `;
  }

  function receiptProviderFromUrl(value) {
    const url = normalizeHttpUrl(value);
    if (!url) return 'unknown';
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host === 'weav3r.dev' || host.endsWith('.weav3r.dev')) return 'TornW3B';
      if (host === 'tornexchange.com' || host.endsWith('.tornexchange.com')) return 'TornExchange';
      return 'linked receipt';
    } catch {
      return 'unknown';
    }
  }

  function extractReceiptUrl(value) {
    const text = String(value || '');
    const match = text.match(/https?:\/\/[^\s<>"']+/i);
    if (!match) return '';
    return normalizeHttpUrl(match[0].replace(/[),.;!?]+$/, ''));
  }

  function findReceiptItemsArray(root) {
    const queue = [{ value: root, depth: 0 }];
    const visited = new Set();
    while (queue.length) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object' || visited.has(value) || depth > 7) continue;
      visited.add(value);
      if (Array.isArray(value)) {
        const qualifying = value.filter((item) => item && typeof item === 'object' && (
          item.name || item.itemName || item.item_name || item.item || item.itemId || item.itemID
        ) && (item.quantity || item.qty || item.amount));
        if (qualifying.length) return qualifying;
        for (const entry of value) queue.push({ value: entry, depth: depth + 1 });
      } else {
        for (const child of Object.values(value)) queue.push({ value: child, depth: depth + 1 });
      }
    }
    return [];
  }

  function deepReceiptNumber(root, keys) {
    const wanted = new Set(keys.map((key) => String(key).toLowerCase()));
    const queue = [{ value: root, depth: 0 }];
    const visited = new Set();
    while (queue.length) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object' || visited.has(value) || depth > 6) continue;
      visited.add(value);
      if (!Array.isArray(value)) {
        const itemLike = Boolean(
          (value.name || value.itemName || value.item_name || value.itemId || value.itemID)
          && (value.quantity || value.qty || value.amount)
        );
        if (itemLike) continue;
        for (const [key, child] of Object.entries(value)) {
          if (wanted.has(String(key).toLowerCase())) {
            const number = parseNumber(child);
            if (Number.isFinite(number) && number >= 0) return number;
          }
          if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
        }
      } else {
        for (const child of value) queue.push({ value: child, depth: depth + 1 });
      }
    }
    return null;
  }

  function receiptItemFromObject(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const itemId = Number(candidate.itemId ?? candidate.itemID ?? candidate.id) > 0
      ? Number(candidate.itemId ?? candidate.itemID ?? candidate.id)
      : null;
    const catalog = itemId ? state.catalog.itemsById?.[String(itemId)] : null;
    const itemName = normalizeWhitespace(
      candidate.itemName ?? candidate.item_name ?? candidate.name ?? candidate.item?.name ?? catalog?.name
    );
    const quantity = Math.max(0, Math.floor(Number(
      candidate.quantity ?? candidate.qty ?? candidate.amount ?? candidate.item?.quantity
    ) || 0));
    if (!itemName || quantity <= 0) return null;
    const unitPrice = Math.max(0, Number(
      candidate.unitPrice ?? candidate.unit_price ?? candidate.priceUsed ?? candidate.price_each
      ?? candidate.price ?? candidate.cost_each ?? candidate.item?.price
    ) || 0);
    const totalValue = Math.max(0, Number(
      candidate.totalValue ?? candidate.total_value ?? candidate.totalPrice ?? candidate.total_price
      ?? candidate.value ?? candidate.proceeds
    ) || (unitPrice * quantity));
    return {
      itemId,
      itemName,
      normalizedName: normalizeName(itemName),
      quantity,
      unitPrice: unitPrice || (totalValue > 0 ? totalValue / quantity : 0),
      totalValue,
    };
  }

  function parseReceiptJson(root) {
    const rawItems = findReceiptItemsArray(root);
    const items = rawItems.map(receiptItemFromObject).filter(Boolean);
    const totalValue = deepReceiptNumber(root, [
      'totalValue', 'total_value', 'grandTotal', 'grand_total', 'receiptTotal', 'receipt_total',
      'cashReceived', 'cash_received', 'amountPaid', 'amount_paid', 'total',
    ]);
    const receiptUrl = normalizeHttpUrl(
      root?.receiptURL ?? root?.receiptUrl ?? root?.receipt_url ?? root?.url ?? root?.data?.receiptURL
    );
    return {
      sourceFormat: 'json',
      provider: receiptProviderFromUrl(receiptUrl),
      receiptUrl,
      totalValue: Number.isFinite(totalValue) ? totalValue : items.reduce((sum, item) => sum + item.totalValue, 0),
      items,
    };
  }

  function catalogNameInReceiptLine(line) {
    const normalizedLine = normalizeName(line);
    if (!normalizedLine) return null;
    let best = null;
    for (const item of Object.values(state.catalog.itemsByName || {})) {
      const key = item.normalizedName;
      if (!key || !normalizedLine.includes(key)) continue;
      if (!best || key.length > best.normalizedName.length) best = item;
    }
    return best;
  }

  function parseReceiptTextLine(line) {
    const text = normalizeWhitespace(line);
    if (!text || /^(?:total|grand total|cash|receipt|thanks|trade|seller|buyer)\b/i.test(text)) return null;
    const catalog = catalogNameInReceiptLine(text);
    let itemName = catalog?.name || '';
    let quantity = null;
    if (catalog) {
      const escaped = escapeRegExp(catalog.name);
      const after = text.match(new RegExp(`${escaped}\\s*(?:x|×)\\s*([\\d,]+)`, 'i'));
      const before = text.match(new RegExp(`([\\d,]+)\\s*(?:x|×)\\s*${escaped}`, 'i'));
      quantity = parseNumber(after?.[1] ?? before?.[1]);
    }
    if (!itemName) {
      let match = text.match(/^(.+?)\s*(?:x|×)\s*([\d,]+)\b/i);
      if (match) {
        itemName = normalizeWhitespace(match[1].replace(/^[-•*\s]+/, ''));
        quantity = parseNumber(match[2]);
      } else {
        match = text.match(/^([\d,]+)\s*(?:x|×)\s*(.+?)(?=\s+(?:@|\$|=|\||-)|$)/i);
        if (match) {
          quantity = parseNumber(match[1]);
          itemName = normalizeWhitespace(match[2]);
        }
      }
    }
    if (!itemName || !(quantity > 0)) return null;
    const moneyTokens = [...text.matchAll(/\$\s*([\d,.]+)/g)]
      .map((match) => parseNumber(match[1]))
      .filter((value) => Number.isFinite(value) && value >= 0);
    let unitPrice = 0;
    let totalValue = 0;
    if (moneyTokens.length >= 2) {
      unitPrice = moneyTokens[0];
      totalValue = moneyTokens[moneyTokens.length - 1];
    } else if (moneyTokens.length === 1) {
      totalValue = moneyTokens[0];
      unitPrice = quantity > 0 ? totalValue / quantity : 0;
    }
    return {
      itemId: catalog?.id || null,
      itemName,
      normalizedName: normalizeName(itemName),
      quantity: Math.floor(quantity),
      unitPrice,
      totalValue,
    };
  }

  function parseReceiptInput(value) {
    const rawText = String(value || '').trim();
    const receiptUrl = extractReceiptUrl(rawText);
    const provider = receiptProviderFromUrl(receiptUrl);
    if (!rawText) return {
      sourceFormat: 'empty', provider: 'unknown', receiptUrl: '', totalValue: 0, items: [], rawText,
    };
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = parseReceiptJson(JSON.parse(trimmed));
        return {
          ...parsed,
          provider: parsed.provider === 'unknown' ? provider : parsed.provider,
          receiptUrl: parsed.receiptUrl || receiptUrl,
          rawText,
        };
      } catch {
        // Continue into the text parser so copied messages with malformed JSON still remain useful.
      }
    }
    const items = [];
    const seen = new Set();
    for (const line of rawText.split(/\r?\n/)) {
      const item = parseReceiptTextLine(line);
      if (!item) continue;
      const key = `${item.normalizedName}:${item.quantity}:${Math.round(item.totalValue)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    const explicitTotalMatch = rawText.match(/(?:grand\s+total|receipt\s+total|total\s+(?:value|paid|payout)|cash\s+(?:paid|received)|total)\s*[:=-]?\s*\$\s*([\d,.]+)/i);
    const explicitTotal = parseNumber(explicitTotalMatch?.[1]);
    const itemTotal = items.reduce((sum, item) => sum + Number(item.totalValue || 0), 0);
    return {
      sourceFormat: items.length ? 'text' : (receiptUrl ? 'link' : 'unparsed'),
      provider,
      receiptUrl,
      totalValue: Number.isFinite(explicitTotal) ? explicitTotal : itemTotal,
      items,
      rawText,
    };
  }

  function receiptAuditStatusRank(status) {
    return ({ red: 5, purple: 4, gray: 3, green: 2, gold: 1, 'link-only': 0 })[status] ?? 3;
  }

  function buildReceiptAudit(sale, parsed) {
    const receiptItems = (parsed?.items || []).map((item) => ({ ...item }));
    const saleItems = Array.isArray(sale?.items) ? sale.items : [];
    if (parsed?.receiptUrl && !receiptItems.length) {
      return normalizeReceiptAudit({
        provider: parsed.provider,
        receiptUrl: parsed.receiptUrl,
        rawText: parsed.rawText,
        sourceFormat: parsed.sourceFormat,
        auditedAt: new Date().toISOString(),
        totalValue: 0,
        saleCash: Math.max(0, Number(sale?.cashReceived) || 0),
        cashDifference: null,
        targetDifference: null,
        auditedProfit: null,
        status: 'link-only',
        summary: 'Receipt link saved. Paste copied receipt details to complete the audit.',
        items: [],
        unmatchedReceiptItems: [],
        missingSaleItems: [],
      });
    }
    const used = new Set();
    const items = [];
    const missingSaleItems = [];
    for (const saleItem of saleItems) {
      const saleKey = normalizeName(saleItem.itemName);
      let index = receiptItems.findIndex((item, candidateIndex) => !used.has(candidateIndex)
        && ((saleItem.itemId && item.itemId && Number(saleItem.itemId) === Number(item.itemId))
          || item.normalizedName === saleKey));
      if (index < 0) {
        missingSaleItems.push({ itemName: saleItem.itemName, quantity: saleItem.quantity });
        continue;
      }
      used.add(index);
      const receiptItem = receiptItems[index];
      const quantityDifference = Number(receiptItem.quantity || 0) - Number(saleItem.quantity || 0);
      const expectedTarget = Math.max(0, Number(saleItem.targetTotal) || 0);
      const costBasis = Math.max(0, Number(saleItem.costBasis) || 0);
      const receiptTotal = Math.max(0, Number(receiptItem.totalValue) || 0);
      const targetDifference = receiptTotal - expectedTarget;
      const itemFullCoverage = Number((saleItem.trackedQuantity ?? saleItem.quantity) || 0) >= Number(saleItem.quantity || 0);
      let status = 'gray';
      let note = 'Receipt did not include a usable item total.';
      if (quantityDifference !== 0) {
        status = 'red';
        note = `Quantity differs by ${quantityDifference > 0 ? '+' : ''}${quantityDifference}.`;
      } else if (receiptTotal > 0) {
        if (targetDifference > 1) {
          status = 'gold';
          note = `${formatMoney(targetDifference)} above the 99% target.`;
        } else if (targetDifference >= -1) {
          status = 'green';
          note = 'Matches the 99% target within $1 rounding.';
        } else {
          status = 'purple';
          note = `${formatMoney(Math.abs(targetDifference))} below the 99% target.`;
        }
      }
      items.push({
        ...receiptItem,
        matchedSaleItemName: saleItem.itemName,
        saleQuantity: saleItem.quantity,
        expectedTarget,
        costBasis,
        profit: receiptTotal > 0 && itemFullCoverage ? receiptTotal - costBasis : null,
        quantityDifference,
        targetDifference,
        status,
        note,
      });
    }
    const unmatchedReceiptItems = receiptItems.filter((item, index) => !used.has(index));
    const totalValue = Math.max(0, Number(parsed?.totalValue) || items.reduce((sum, item) => sum + Number(item.totalValue || 0), 0));
    const saleCash = Math.max(0, Number(sale?.cashReceived) || 0);
    const cashDifference = totalValue > 0 ? totalValue - saleCash : null;
    const targetDifference = totalValue > 0 ? totalValue - Number(sale?.targetTotal || 0) : null;
    const auditedProfit = totalValue > 0 && sale?.fullCoverage && Number(sale?.trackedCostBasis) > 0
      ? totalValue - Number(sale.trackedCostBasis)
      : null;
    let status = parsed?.receiptUrl && !receiptItems.length ? 'link-only' : 'gray';
    if (missingSaleItems.length || unmatchedReceiptItems.length || items.some((item) => item.status === 'red')) {
      status = 'red';
    } else if (items.length) {
      status = items.reduce((worst, item) =>
        receiptAuditStatusRank(item.status) > receiptAuditStatusRank(worst) ? item.status : worst, 'gold');
      if (cashDifference !== null && Math.abs(cashDifference) > 1) status = 'red';
    }
    const summary = status === 'gold'
      ? 'Receipt is above the expected 99% target.'
      : status === 'green'
        ? 'Receipt matches the expected sale and 99% target.'
        : status === 'purple'
          ? 'Receipt matches the manifest but pays below the 99% target.'
          : status === 'red'
            ? 'Receipt differs from the recorded sale or manifest.'
            : status === 'link-only'
              ? 'Receipt link saved. Paste copied receipt details to complete the audit.'
              : 'Receipt details were saved but could not be fully priced.';
    return normalizeReceiptAudit({
      provider: parsed?.provider,
      receiptUrl: parsed?.receiptUrl,
      rawText: parsed?.rawText,
      sourceFormat: parsed?.sourceFormat,
      auditedAt: new Date().toISOString(),
      totalValue,
      saleCash,
      cashDifference,
      targetDifference,
      auditedProfit,
      status,
      summary,
      items,
      unmatchedReceiptItems,
      missingSaleItems,
    });
  }

  function receiptAuditBadge(status) {
    return ({
      gold: 'Gold verified',
      green: 'Verified',
      purple: 'Below target',
      red: 'Mismatch',
      gray: 'Needs review',
      'link-only': 'Link saved',
    })[status] || 'Not audited';
  }

  function receiptAuditItemHtml(item) {
    const profitText = item.profit === null
      ? 'Unknown'
      : `${item.profit >= 0 ? '+' : ''}${formatMoney(item.profit)}`;
    return `
      <div class="tsimm-audit-item tsimm-audit-${escapeHtml(item.status)}">
        <div><strong>${escapeHtml(item.matchedSaleItemName || item.itemName)} × ${formatInteger(item.quantity)}</strong><span>${escapeHtml(receiptAuditBadge(item.status))}</span></div>
        <div class="tsimm-ledger-lot-grid">
          <span>Receipt value</span><strong>${item.totalValue > 0 ? formatMoney(item.totalValue) : 'Not supplied'}</strong>
          <span>Ⓣ expected</span><strong>${formatMoney(item.expectedTarget)}</strong>
          <span>Ledger cost</span><strong>${formatMoney(item.costBasis)}</strong>
          <span>Audited profit</span><strong class="${item.profit === null ? '' : (item.profit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss')}">${profitText}</strong>
        </div>
        <small>${escapeHtml(item.note)}</small>
      </div>
    `;
  }

  function renderReceiptAudit() {
    const overlay = document.getElementById(APP.receiptAuditOverlayId);
    if (!overlay) return;
    const draft = state.receiptAuditDraft;
    const sale = (state.ledger.sales || []).find((entry) => entry.id === draft?.saleId);
    if (!sale) {
      overlay.remove();
      state.receiptAuditDraft = null;
      return;
    }
    const audit = draft.audit || sale.receiptAudit || null;
    const rawText = draft.rawText ?? sale.receiptAudit?.rawText ?? sale.receiptAudit?.receiptUrl ?? '';
    const auditItems = audit?.items || [];
    overlay.innerHTML = `
      <div class="tsimm-audit-shell">
        <div class="tsimm-ledger-head">
          <div><strong>🧾 Audit sale receipt</strong><small>${escapeHtml(sale.counterparty || 'Unknown trader')} · ${escapeHtml(new Date(sale.soldAt).toLocaleString())}</small></div>
          <button type="button" data-tsimm-action="receipt-audit-close">×</button>
        </div>
        <div class="tsimm-audit-summary">
          <div><span>Recorded cash</span><strong>${formatMoney(sale.cashReceived)}</strong></div>
          <div><span>Ⓣ sale target</span><strong>${formatMoney(sale.targetTotal)}</strong></div>
          <div><span>Ledger cost</span><strong>${formatMoney(sale.trackedCostBasis)}</strong></div>
          <div><span>Saved audit</span><strong class="tsimm-audit-status-${escapeHtml(audit?.status || 'gray')}">${escapeHtml(audit ? receiptAuditBadge(audit.status) : 'None')}</strong></div>
        </div>
        <div class="tsimm-audit-input">
          <label>Paste receipt text, JSON, or the TornPDA receipt message/link</label>
          <textarea data-tsimm-receipt-input placeholder="Paste the receipt here…">${escapeHtml(rawText)}</textarea>
          <small>Receipt auditing is read-only. Saving an audit never changes purchase lots, sold quantities, or the original sale record.</small>
        </div>
        ${audit ? `
          <div class="tsimm-audit-result tsimm-audit-${escapeHtml(audit.status)}">
            <div class="tsimm-audit-result-head"><strong>${escapeHtml(receiptAuditBadge(audit.status))}</strong><span>${escapeHtml(audit.provider)}</span></div>
            <p>${escapeHtml(audit.summary)}</p>
            <div class="tsimm-ledger-lot-grid">
              <span>Receipt total</span><strong>${audit.totalValue > 0 ? formatMoney(audit.totalValue) : 'Not parsed'}</strong>
              <span>Cash difference</span><strong>${audit.cashDifference === null ? 'Unknown' : `${audit.cashDifference >= 0 ? '+' : ''}${formatMoney(audit.cashDifference)}`}</strong>
              <span>Difference from Ⓣ</span><strong>${audit.targetDifference === null ? 'Unknown' : `${audit.targetDifference >= 0 ? '+' : ''}${formatMoney(audit.targetDifference)}`}</strong>
              <span>Audited profit</span><strong>${audit.auditedProfit === null ? 'Incomplete' : `${audit.auditedProfit >= 0 ? '+' : ''}${formatMoney(audit.auditedProfit)}`}</strong>
            </div>
            ${audit.receiptUrl ? `<a class="tsimm-audit-link" href="${escapeHtml(audit.receiptUrl)}">Open receipt</a>` : ''}
          </div>
          ${auditItems.length ? `<div class="tsimm-audit-items">${auditItems.map(receiptAuditItemHtml).join('')}</div>` : ''}
          ${audit.missingSaleItems.length ? `<div class="tsimm-audit-warning">Missing from receipt: ${audit.missingSaleItems.map((item) => `${escapeHtml(item.itemName)} × ${formatInteger(item.quantity)}`).join(', ')}</div>` : ''}
          ${audit.unmatchedReceiptItems.length ? `<div class="tsimm-audit-warning">Extra receipt items: ${audit.unmatchedReceiptItems.map((item) => `${escapeHtml(item.itemName)} × ${formatInteger(item.quantity)}`).join(', ')}</div>` : ''}
        ` : ''}
        <div class="tsimm-audit-actions">
          <button type="button" data-tsimm-action="receipt-audit-preview">Parse preview</button>
          <button type="button" data-tsimm-action="receipt-audit-save" ${audit ? '' : 'disabled'}>Save audit</button>
          ${activePendingTraderCapture() ? `<button type="button" data-tsimm-action="receipt-link-pending-trader">Link ${escapeHtml(activePendingTraderCapture().name)} + save page</button>` : ''}
          ${sale.receiptAudit ? '<button type="button" data-tsimm-action="receipt-audit-clear">Clear saved audit</button>' : ''}
        </div>
      </div>
    `;
  }

  function openReceiptAudit(saleId) {
    const sale = (state.ledger.sales || []).find((entry) => entry.id === saleId);
    if (!sale) return;
    injectStyles();
    let overlay = document.getElementById(APP.receiptAuditOverlayId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = APP.receiptAuditOverlayId;
      overlay.dataset.tsimmGenerated = 'true';
      document.body.appendChild(overlay);
    }
    state.receiptAuditDraft = {
      saleId,
      rawText: sale.receiptAudit?.rawText || sale.receiptAudit?.receiptUrl || '',
      audit: sale.receiptAudit || null,
    };
    renderReceiptAudit();
  }

  function closeReceiptAudit() {
    document.getElementById(APP.receiptAuditOverlayId)?.remove();
    state.receiptAuditDraft = null;
  }

  function previewReceiptAudit() {
    const draft = state.receiptAuditDraft;
    const sale = (state.ledger.sales || []).find((entry) => entry.id === draft?.saleId);
    const input = document.querySelector(`#${APP.receiptAuditOverlayId} [data-tsimm-receipt-input]`);
    if (!sale || !input) return;
    const rawText = String(input.value || '').trim();
    const parsed = parseReceiptInput(rawText);
    draft.rawText = rawText;
    draft.audit = buildReceiptAudit(sale, parsed);
    renderReceiptAudit();
  }

  function saveReceiptAudit() {
    const draft = state.receiptAuditDraft;
    const sale = (state.ledger.sales || []).find((entry) => entry.id === draft?.saleId);
    if (!sale) return;
    if (!draft.audit) previewReceiptAudit();
    if (!draft.audit) return;
    sale.receiptAudit = normalizeReceiptAudit(draft.audit);
    saveLedger();
    renderLedger();
    renderTraders();
    renderReceiptAudit();
    toast(`Receipt audit saved: ${receiptAuditBadge(sale.receiptAudit.status)}.`);
  }

  function clearReceiptAudit() {
    const draft = state.receiptAuditDraft;
    const sale = (state.ledger.sales || []).find((entry) => entry.id === draft?.saleId);
    if (!sale || !sale.receiptAudit || !confirm('Clear the saved receipt audit for this sale?')) return;
    sale.receiptAudit = null;
    draft.audit = null;
    draft.rawText = '';
    saveLedger();
    renderLedger();
    renderTraders();
    renderReceiptAudit();
    toast('Receipt audit cleared.');
  }


  function ledgerSaleHtml(sale) {
    const profit = optionalFiniteNumber(sale.realizedProfit)
      ?? optionalFiniteNumber(sale.trackedProfit);
    const profitClass = Number(profit) >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss';
    const when = (() => {
      const date = new Date(sale.soldAt);
      return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown date';
    })();
    const coverage = sale.fullCoverage
      ? 'complete'
      : `${formatInteger(sale.trackedQuantity)}/${formatInteger(sale.requestedQuantity)} tracked`;
    const audit = sale.receiptAudit;
    return `
      <article class="tsimm-ledger-sale">
        <div class="tsimm-ledger-sale-head">
          <strong>Trade sale${sale.counterparty ? ` · ${escapeHtml(sale.counterparty)}` : ''}</strong>
          <span>${escapeHtml(coverage)}</span>
        </div>
        <div class="tsimm-ledger-lot-grid">
          <span>Cash received</span><strong>${formatMoney(sale.cashReceived)}</strong>
          <span>Ledger cost basis</span><strong>${formatMoney(sale.trackedCostBasis)}</strong>
          <span>Ⓣ target</span><strong>${formatMoney(sale.targetTotal)}</strong>
          <span>${sale.fullCoverage ? 'Actual sale profit' : 'Tracked sale profit'}</span><strong class="${profitClass}">${profit === null ? 'Incomplete' : `${profit >= 0 ? '+' : ''}${formatMoney(profit)}`}</strong>
          <span>Receipt audit</span><strong class="tsimm-audit-status-${escapeHtml(audit?.status || 'gray')}">${escapeHtml(audit ? receiptAuditBadge(audit.status) : 'Not audited')}</strong>
        </div>
        <div class="tsimm-ledger-sale-foot">
          <span>${escapeHtml(when)} · ${escapeHtml(sale.captureMethod)}</span>
          <button type="button" data-tsimm-action="receipt-audit-open" data-tsimm-sale-id="${escapeHtml(sale.id)}">${audit ? 'Review audit' : 'Audit sale'}</button>
        </div>
      </article>
    `;
  }

  function renderLedger() {
    const overlay = document.getElementById(APP.ledgerOverlayId);
    if (!overlay) return;
    const summary = ledgerSummary();
    const lots = visibleLedgerLots();
    const sales = state.ledger.sales || [];
    const view = state.ledgerUi.view;
    const catalogFreshness = state.catalog.updatedAt
      ? `Current values synced ${relativeAge(state.catalog.updatedAt)}${catalogIsFresh() ? '' : ' · stale'}`
      : 'Current values have not been synced';
    const showPurchaseControls = view === 'holdings' || view === 'history';
    overlay.innerHTML = `
      <div class="tsimm-ledger-shell">
        <div class="tsimm-ledger-head">
          <div><strong>📒 IMM Purchase Ledger</strong><small>What you obtained, what it cost, and what it can earn · schema v4</small></div>
          <button type="button" data-tsimm-action="ledger-close">×</button>
        </div>
        <div class="tsimm-ledger-summary">
          <div><strong>${formatInteger(summary.lots)}</strong><span>open lots</span></div>
          <div><strong>${formatInteger(summary.remainingQuantity)}</strong><span>on hand</span></div>
          <div><strong>${formatMoney(summary.invested)}</strong><span>invested</span></div>
          <div><strong class="${summary.expectedProfit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${summary.expectedProfit >= 0 ? '+' : ''}${formatMoney(summary.expectedProfit)}</strong><span>original expected</span></div>
          <div><strong class="${summary.realizedProfit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${summary.realizedProfit >= 0 ? '+' : ''}${formatMoney(summary.realizedProfit)}</strong><span>realized</span></div>
        </div>
        <div class="tsimm-ledger-tabs" role="tablist">
          <button type="button" class="${view === 'holdings' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="holdings">Current holdings</button>
          <button type="button" class="${view === 'history' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="history">Purchase history</button>
          <button type="button" class="${view === 'sales' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="sales">Sale audits</button>
        </div>
        <div class="tsimm-ledger-actions">
          <button type="button" data-tsimm-action="ledger-add">Add manual lot</button>
          <button type="button" data-tsimm-action="ledger-copy">Copy JSON</button>
          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-clear">Clear all</button>
        </div>
        ${showPurchaseControls ? `
          <div class="tsimm-ledger-filters">
            <input type="search" value="${escapeHtml(state.ledgerUi.search)}" placeholder="Search item name" data-tsimm-ledger-search>
            <select data-tsimm-ledger-sort>
              <option value="newest" ${state.ledgerUi.sort === 'newest' ? 'selected' : ''}>Newest</option>
              <option value="oldest" ${state.ledgerUi.sort === 'oldest' ? 'selected' : ''}>Oldest</option>
              <option value="profit-now" ${state.ledgerUi.sort === 'profit-now' ? 'selected' : ''}>Highest profit now</option>
              <option value="item-name" ${state.ledgerUi.sort === 'item-name' ? 'selected' : ''}>Item name</option>
              <option value="purchase-price" ${state.ledgerUi.sort === 'purchase-price' ? 'selected' : ''}>Purchase price</option>
            </select>
          </div>
          ${view === 'history' ? `<label class="tsimm-ledger-toggle"><input type="checkbox" data-tsimm-ledger-show-sold ${state.ledgerUi.showSold ? 'checked' : ''}> Show sold purchases</label>` : ''}
          <div class="tsimm-ledger-freshness">${escapeHtml(catalogFreshness)}</div>
          <div class="tsimm-ledger-section-title">${view === 'holdings' ? 'Current holdings' : 'Purchase history'} · ${formatInteger(lots.length)} lot${lots.length === 1 ? '' : 's'}</div>
          <div class="tsimm-ledger-list">
            ${lots.length ? lots.map(ledgerLotHtml).join('') : '<div class="tsimm-ledger-empty">No matching purchase lots to show.</div>'}
          </div>
        ` : `
          <div class="tsimm-ledger-section-title">Sale history</div>
          <div class="tsimm-ledger-sales">${sales.length ? sales.map(ledgerSaleHtml).join('') : '<div class="tsimm-ledger-empty">No recorded sales yet.</div>'}</div>
        `}
      </div>
    `;
  }

  function openLedger() {
    injectStyles();
    state.ledgerUi.view = 'holdings';
    state.ledgerUi.search = '';
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

  function userIdFromUrl(value) {
    const text = String(value || '');
    const match = text.match(/[?&#](?:XID|userID)=(\d+)/i) || text.match(/\/profiles\.php\/(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function currentCounterpartyIdentity() {
    const name = cleanTradeParticipantName(state.lastScan?.tradeCounterparty);
    let userId = Math.max(0, Math.floor(Number(state.lastScan?.tradeCounterpartyId) || 0)) || null;
    let profileUrl = normalizeHttpUrl(state.lastScan?.tradeCounterpartyProfileUrl);
    const anchors = [...document.querySelectorAll('a[href*="profiles.php" i],a[href*="trade.php" i]')];
    const nameKey = normalizeName(name);
    for (const anchor of anchors) {
      const anchorName = normalizeName(anchor.innerText || anchor.textContent || '');
      if (nameKey && anchorName && anchorName !== nameKey) continue;
      const candidateId = userIdFromUrl(anchor.href);
      if (!candidateId) continue;
      userId = candidateId;
      if (/profiles\.php/i.test(anchor.href)) profileUrl = anchor.href;
      break;
    }
    const saved = state.traders.find((trader) =>
      (userId && trader.userId === userId) || trader.normalizedName === normalizeName(name)
    );
    return {
      name,
      userId: userId || saved?.userId || null,
      profileUrl: profileUrl || saved?.profileUrl || (userId ? `https://www.torn.com/profiles.php?XID=${userId}` : ''),
      tradeUrl: userId ? `https://www.torn.com/trade.php#step=start&userID=${userId}` : (saved?.tradeUrl || ''),
      bannerUrl: normalizeHttpUrl(state.lastScan?.tradeCounterpartyBannerUrl) || saved?.bannerUrl || '',
      captureSource: 'trade-page',
    };
  }

  function traderSalesFor(trader) {
    const key = normalizeName(trader?.name);
    return (state.ledger.sales || []).filter((sale) => {
      if (trader?.userId && sale?.counterpartyId) return Number(trader.userId) === Number(sale.counterpartyId);
      return normalizeName(cleanTradeParticipantName(sale?.counterparty)) === key;
    });
  }

  function traderStats(trader) {
    const sales = traderSalesFor(trader);
    const profits = sales.map((sale) => optionalFiniteNumber(sale.realizedProfit) ?? optionalFiniteNumber(sale.trackedProfit)).filter((value) => value !== null);
    const cash = sales.reduce((sum, sale) => sum + Number(sale.cashReceived || 0), 0);
    const market = sales.reduce((sum, sale) => sum + Number(sale.marketTotal || 0), 0);
    return {
      trades: sales.length,
      cash,
      profit: profits.reduce((sum, value) => sum + value, 0),
      profitCount: profits.length,
      effectivePercent: market > 0 ? cash / market * 100 : null,
      lastTradeAt: sales[0]?.soldAt || null,
    };
  }

  function promptTrader(existing = null, defaults = {}) {
    const name = normalizeWhitespace(prompt('Trader name:', existing?.name || defaults.name || ''));
    if (!name) return null;
    const idRaw = prompt('Torn user ID (recommended for Profile and Start trade buttons):', existing?.userId || defaults.userId || '');
    const userId = Math.max(0, Math.floor(Number(idRaw) || 0)) || null;
    const ratingRaw = prompt('Personal rating from 0 to 5:', existing?.rating ?? 0);
    const rating = Math.max(0, Math.min(5, Math.floor(Number(ratingRaw) || 0)));
    const targetRaw = prompt('Your expected payout percentage for this trader:', existing?.targetPercent ?? TRADER_PERCENT);
    const targetPercent = Math.max(0, Math.min(100, Number(targetRaw) || TRADER_PERCENT));
    const notes = normalizeWhitespace(prompt('Notes:', existing?.notes || defaults.notes || '') || '');
    return normalizeTrader({
      ...existing,
      recordId: existing?.id,
      name,
      userId,
      profileUrl: defaults.profileUrl || existing?.profileUrl,
      tradeUrl: defaults.tradeUrl || existing?.tradeUrl,
      bannerUrl: defaults.bannerUrl || existing?.bannerUrl,
      captureSource: defaults.captureSource || existing?.captureSource,
      rating,
      targetPercent,
      notes,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function linkRecordedSalesToTrader(trader) {
    if (!trader) return 0;
    const nameKey = normalizeName(trader.name);
    let linked = 0;
    for (const sale of state.ledger.sales || []) {
      const idMatch = Boolean(trader.userId && sale.counterpartyId && Number(trader.userId) === Number(sale.counterpartyId));
      const nameMatch = normalizeName(cleanTradeParticipantName(sale.counterparty)) === nameKey;
      if (!idMatch && !nameMatch) continue;
      sale.counterparty = trader.name;
      if (trader.userId) sale.counterpartyId = trader.userId;
      if (trader.profileUrl) sale.counterpartyProfileUrl = trader.profileUrl;
      linked += 1;
    }
    if (linked) saveLedger();
    return linked;
  }

  function upsertTrader(trader) {
    if (!trader) return null;
    const index = state.traders.findIndex((candidate) =>
      (trader.userId && candidate.userId === trader.userId)
      || candidate.normalizedName === trader.normalizedName
      || candidate.id === trader.id
    );
    if (index >= 0) state.traders[index] = { ...state.traders[index], ...trader, id: state.traders[index].id };
    else state.traders.push(trader);
    saveTraders();
    const savedTrader = state.traders.find((candidate) =>
      candidate.id === trader.id
      || (trader.userId && candidate.userId === trader.userId)
      || candidate.normalizedName === trader.normalizedName
    ) || trader;
    linkRecordedSalesToTrader(savedTrader);
    renderTraders();
    renderLedger();
    renderPanel();
    return savedTrader;
  }

  function saveCurrentTrader() {
    const identity = currentCounterpartyIdentity();
    if (!identity.name) {
      toast('No trade counterparty was detected.');
      return;
    }
    const existing = state.traders.find((trader) =>
      (identity.userId && trader.userId === identity.userId) || trader.normalizedName === normalizeName(identity.name)
    ) || null;
    const stats = state.lastScan;
    const observation = Number.isFinite(stats.tradeEffectivePercent)
      ? `Observed ${formatPercent(stats.tradeEffectivePercent)} payout on ${new Date().toLocaleDateString()}${Number(stats.tradeDifference) < 0 ? `, ${formatMoney(Math.abs(stats.tradeDifference))} below the 99% target` : ', at or above the 99% target'}.`
      : '';
    const trader = promptTrader(existing, { ...identity, notes: observation });
    if (trader && identity.bannerUrl && !trader.bannerUrl) trader.bannerUrl = identity.bannerUrl;
    if (!trader) return;
    const saved = upsertTrader(trader);
    const linked = traderSalesFor(saved).length;
    toast(`Saved trader ${saved.name}${linked ? ` · ${linked} recorded sale${linked === 1 ? '' : 's'} linked` : ''}.`);
  }


  function promptCapturedTrader(existing, identity) {
    const ratingRaw = prompt(`Personal rating for ${identity.name} from 0 to 5:`, existing?.rating ?? 0);
    if (ratingRaw === null) return null;
    const rating = Math.max(0, Math.min(5, Math.floor(Number(ratingRaw) || 0)));
    const targetRaw = prompt('Your expected payout percentage for this trader:', existing?.targetPercent ?? TRADER_PERCENT);
    if (targetRaw === null) return null;
    const targetPercent = Math.max(0, Math.min(100, Number(targetRaw) || TRADER_PERCENT));
    const notes = normalizeWhitespace(prompt('Notes:', existing?.notes || '') || '');
    return normalizeTrader({
      ...existing,
      ...identity,
      recordId: existing?.id,
      rating,
      targetPercent,
      notes,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function saveCurrentProfileTrader() {
    const identity = currentProfileIdentity();
    if (!identity.name || !identity.userId) {
      toast('IMM could not resolve this profile name and Torn ID.');
      return;
    }
    const existing = state.traders.find((trader) =>
      trader.userId === identity.userId || trader.normalizedName === normalizeName(identity.name)
    ) || null;
    const trader = promptCapturedTrader(existing, identity);
    if (!trader) return;
    const saved = upsertTrader(trader);
    const linked = traderSalesFor(saved).length;
    toast(`Captured ${saved.name}'s profile${saved.bannerUrl ? ' and banner' : ''}${linked ? ` · linked ${linked} recorded sale${linked === 1 ? '' : 's'}` : ''}.`);
  }

  function editTrader(id) {
    const existing = state.traders.find((trader) => trader.id === id);
    if (!existing) return;
    const trader = promptTrader(existing);
    if (trader) upsertTrader(trader);
  }

  function deleteTrader(id) {
    const trader = state.traders.find((entry) => entry.id === id);
    if (!trader || !confirm(`Remove ${trader.name} from your trader book?`)) return;
    state.traders = state.traders.filter((entry) => entry.id !== id);
    saveTraders();
    renderTraders();
    renderPanel();
  }

  async function copyTradersJson() {
    const text = JSON.stringify({ schema: 'tornscripture-imm-traders', schemaVersion: 2, traders: state.traders }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast('Trader book JSON copied.');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast('Trader book JSON copied.');
    }
  }

  function importTradersJson() {
    const raw = prompt('Paste an IMM trader-book JSON export.');
    if (!raw) return;
    try {
      const imported = normalizeTraders(JSON.parse(raw));
      if (!imported.length) throw new Error('No valid traders were found.');
      for (const trader of imported) upsertTrader(trader);
      toast(`Imported ${formatInteger(imported.length)} traders.`);
    } catch (error) {
      toast(error?.message || 'Trader import failed.');
    }
  }

  function traderCardHtml(trader) {
    const stats = traderStats(trader);
    const stars = trader.rating ? `${'★'.repeat(trader.rating)}${'☆'.repeat(5 - trader.rating)}` : 'Not rated';
    const lastTrade = stats.lastTradeAt ? new Date(stats.lastTradeAt).toLocaleDateString() : 'None recorded';
    const lastPriceCapture = trader.pricePageLastCheckedAt
      ? new Date(trader.pricePageLastCheckedAt).toLocaleString()
      : 'Never';
    const priceItemCount = trader.pricePageItems?.length || 0;
    const autoRecaptureAvailable = trader.pricePageUrl && isSupportedPricePageUrl(trader.pricePageUrl);
    return `
      <article class="tsimm-trader-card">
        <div class="tsimm-trader-card-head">
          ${trader.profileUrl
            ? `<a class="tsimm-trader-profile-button${trader.bannerUrl ? ' has-banner' : ''}" href="${escapeHtml(trader.profileUrl)}" title="Open ${escapeHtml(trader.name)}'s profile">${trader.bannerUrl ? `<img src="${escapeHtml(trader.bannerUrl)}" alt="${escapeHtml(trader.name)}"><span class="tsimm-trader-banner-label"><strong>${escapeHtml(trader.name)}</strong>${trader.userId ? `<small>[${escapeHtml(trader.userId)}]</small>` : ''}</span>` : `<strong>${escapeHtml(trader.name)}</strong>`}<span class="tsimm-trader-stars">${escapeHtml(stars)}</span></a>`
            : `<div class="tsimm-trader-profile-button"><strong>${escapeHtml(trader.name)}</strong><span>${escapeHtml(stars)}</span></div>`}
          <b>${escapeHtml(formatPercent(trader.targetPercent))} target</b>
        </div>
        <div class="tsimm-trader-grid">
          <span>Recorded trades</span><strong>${formatInteger(stats.trades)}</strong>
          <span>Cash received</span><strong>${formatMoney(stats.cash)}</strong>
          <span>Tracked profit</span><strong class="${stats.profit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${stats.profit >= 0 ? '+' : ''}${formatMoney(stats.profit)}</strong>
          <span>Observed payout</span><strong>${stats.effectivePercent === null ? 'No history' : formatPercent(stats.effectivePercent)}</strong>
          <span>Last recorded trade</span><strong>${escapeHtml(lastTrade)}</strong>
          ${trader.pricePageUrl ? `<span>Saved price page</span><strong>${formatInteger(priceItemCount)} prices</strong><span>Last price check</span><strong>${escapeHtml(lastPriceCapture)}</strong><span>Last changes</span><strong>${formatInteger(trader.pricePageLastChangedCount || 0)}</strong>` : ''}
        </div>
        ${trader.notes ? `<div class="tsimm-trader-notes">${escapeHtml(trader.notes)}</div>` : ''}
        <div class="tsimm-trader-actions">
          ${trader.tradeUrl ? `<a href="${escapeHtml(trader.tradeUrl)}">Start trade</a>` : ''}
          ${trader.profileUrl ? `<a href="${escapeHtml(trader.profileUrl)}">Profile</a>` : ''}
          ${trader.pricePageUrl ? `<a href="${escapeHtml(trader.pricePageUrl)}">Open prices</a>` : ''}
          ${autoRecaptureAvailable ? `<button type="button" data-tsimm-action="trader-open-recapture" data-tsimm-trader-id="${escapeHtml(trader.id)}">Open & recapture</button>` : ''}
          <button type="button" data-tsimm-action="trader-arm-capture" data-tsimm-trader-id="${escapeHtml(trader.id)}">Arm price capture</button>
          <button type="button" data-tsimm-action="trader-edit" data-tsimm-trader-id="${escapeHtml(trader.id)}">Edit</button>
          <button type="button" data-tsimm-action="trader-delete" data-tsimm-trader-id="${escapeHtml(trader.id)}">Delete</button>
        </div>
      </article>
    `;
  }

  function renderTraders() {
    const overlay = document.getElementById(APP.traderOverlayId);
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="tsimm-trader-shell">
        <div class="tsimm-ledger-head">
          <div><strong>🤝 IMM Trader Book</strong><small>Fast links, ratings, notes, and local sale history</small></div>
          <button type="button" data-tsimm-action="traders-close">×</button>
        </div>
        <div class="tsimm-trader-top">
          <strong>${formatInteger(state.traders.length)} saved traders</strong>
          <span>${activePendingTraderCapture() ? `${escapeHtml(activePendingTraderCapture().name)} armed for next page` : 'Stored only in this browser unless exported.'}</span>
        </div>
        <div class="tsimm-ledger-actions">
          <button type="button" data-tsimm-action="trader-add">Add trader</button>
          ${state.lastScan.pageType === 'profile' && state.lastScan.profileCaptureReady ? '<button type="button" data-tsimm-action="trader-capture-profile">Capture this profile</button>' : ''}
          ${state.lastScan.pageType === 'trade' && state.lastScan.tradeCounterparty ? '<button type="button" data-tsimm-action="trader-save-current">Save current trade</button>' : ''}
          <button type="button" data-tsimm-action="traders-copy">Copy JSON</button>
          <button type="button" data-tsimm-action="traders-import">Import JSON</button>
        </div>
        <div class="tsimm-trader-list">
          ${state.traders.length ? state.traders.map(traderCardHtml).join('') : '<div class="tsimm-ledger-empty">No traders saved yet. Add one manually or save the counterparty from a trade page.</div>'}
        </div>
      </div>
    `;
  }

  function openTraders() {
    injectStyles();
    let overlay = document.getElementById(APP.traderOverlayId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = APP.traderOverlayId;
      overlay.dataset.tsimmGenerated = 'true';
      document.body.appendChild(overlay);
    }
    renderTraders();
  }

  function closeTraders() {
    document.getElementById(APP.traderOverlayId)?.remove();
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


  function pendingTraderCaptureHtml() {
    const pending = activePendingTraderCapture();
    if (!pending) return '';
    const trader = traderForPendingCapture(pending);
    const minutes = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 60000));
    return `
      <div class="tsimm-trader-capture-card">
        <strong>🔗 Trader armed: ${escapeHtml(trader?.name || pending.name)}</strong>
        <span>${formatInteger(minutes)}m remaining · open a receipt or pricing page</span>
        <small>Capture stores this page address and a local price snapshot on the trader card.</small>
        <div>
          <button type="button" data-tsimm-action="trader-capture-current-page">Capture this page</button>
          <button type="button" data-tsimm-action="trader-clear-capture">Clear</button>
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
        npcBuybackFormula: 'catalog.sell_price - listingPrice',
        manifestFormula: 'sum(floor(itemMarketValue * 0.99) * quantity)',
        tradeDifferenceFormula: 'otherSideCash - mySideCash - manifestTarget',
      },
      lastScan: state.lastScan,
      traders: state.traders.map((trader) => ({ ...trader, stats: traderStats(trader) })),
      ledger: {
        summary: ledgerSummary(),
        updatedAt: state.ledger.updatedAt,
        recentLots: state.ledger.lots.slice(0, 8),
        recentSales: (state.ledger.sales || []).slice(0, 5),
      },
      pendingPurchase: state.pendingPurchase,
      pendingTraderCapture: activePendingTraderCapture(),
      pendingPriceRecapture: activePriceRecaptureRequest(),
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
    renderLedger();
    renderTraders();
    renderReceiptAudit();
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
      .tsimm-status{display:grid;grid-template-columns:repeat(auto-fit,minmax(44px,1fr));gap:5px;margin-bottom:7px}.tsimm-stat{padding:5px;border:1px solid #46404f;border-radius:7px;background:#242129;text-align:center}.tsimm-stat strong{display:block;font-size:14px}.tsimm-stat span{color:#b7afc0;font-size:10px}
      .tsimm-actions{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0}.tsimm-btn{flex:1;min-width:78px}.tsimm-btn-primary{background:#5b2b82;border-color:#8e55b9}.tsimm-btn-blue{background:#174f75!important;border-color:#3b8fc2!important;color:#eaf7ff!important}.tsimm-btn:disabled{opacity:.55;cursor:wait}
      .tsimm-controls{display:grid;grid-template-columns:1fr 72px;gap:5px;align-items:center;margin-top:6px}.tsimm-controls input{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}.tsimm-check{display:flex;align-items:center;gap:6px;margin-top:7px;color:#c9c2d0}
      .tsimm-note{margin-top:6px;color:#d0c8d8}.tsimm-muted{color:#aaa1b7}.tsimm-npc-text{color:#58bfff}.tsimm-good-text{color:#63df9f}.tsimm-minor-text{color:#c77dff}.tsimm-loss-text{color:#ff6b76}
      .${APP.badgeClass}{display:flex;flex-direction:column;justify-content:center;gap:1px;border:1px solid currentColor;border-radius:7px;padding:3px 5px;font:700 10px/1.15 Arial,sans-serif;white-space:nowrap;box-shadow:0 2px 8px #0007;background:#19171dcc;pointer-events:none}
      .${APP.badgeClass} span{font-size:8px;font-weight:600;opacity:.9}.tsimm-tier-npc{--tsimm-tier:#58bfff}.tsimm-tier-gold{--tsimm-tier:#f4c95d}.tsimm-tier-good{--tsimm-tier:#44d88b}.tsimm-tier-minor{--tsimm-tier:#bd6cff}.tsimm-tier-loss{--tsimm-tier:#ff626d}
      .${APP.badgeClass}.tsimm-tier-npc{color:#58bfff}.${APP.badgeClass}.tsimm-tier-gold{color:#f4c95d}.${APP.badgeClass}.tsimm-tier-good{color:#44d88b}.${APP.badgeClass}.tsimm-tier-minor{color:#bd6cff}.${APP.badgeClass}.tsimm-tier-loss{color:#ff626d}
      .tsimm-badge-category{position:absolute;right:4px;top:4px;z-index:5;max-width:calc(100% - 8px)}
      .tsimm-badge-listing{display:inline-flex;margin-left:6px;vertical-align:middle;position:relative;z-index:3}
      .tsimm-badge-overseas{display:inline-flex;margin-left:6px;vertical-align:middle;position:relative;z-index:3}
      .${APP.categoryMark}.tsimm-tier-npc{outline:2px solid #58bfff99;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-gold{outline:2px solid #f4c95d99;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-good{outline:2px solid #44d88b80;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-minor{outline:2px solid #bd6cff80;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-loss{outline:2px solid #ff626d80;outline-offset:-2px}
      .${APP.listingMark}.tsimm-tier-npc{box-shadow:inset 3px 0 #58bfff}.${APP.listingMark}.tsimm-tier-gold{box-shadow:inset 3px 0 #f4c95d}.${APP.listingMark}.tsimm-tier-good{box-shadow:inset 3px 0 #44d88b}.${APP.listingMark}.tsimm-tier-minor{box-shadow:inset 3px 0 #bd6cff}.${APP.listingMark}.tsimm-tier-loss{box-shadow:inset 3px 0 #ff626d}
      .${APP.overseasMark}.tsimm-tier-gold{box-shadow:inset 3px 0 #f4c95d}.${APP.overseasMark}.tsimm-tier-good{box-shadow:inset 3px 0 #44d88b}.${APP.overseasMark}.tsimm-tier-minor{box-shadow:inset 3px 0 #bd6cff}.${APP.overseasMark}.tsimm-tier-loss{box-shadow:inset 3px 0 #ff626d}
      .tsimm-overseas-card{margin:8px 0;padding:8px;border:1px solid #4d5967;border-radius:9px;background:#20272d}.tsimm-overseas-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-overseas-title strong{flex:1;color:#a7d9ff}.tsimm-overseas-title span{font-size:9px;color:#9eb2c2;text-transform:uppercase}.tsimm-overseas-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.tsimm-overseas-grid span{color:#aebbc4}.tsimm-overseas-grid strong{text-align:right}.tsimm-overseas-profit{color:#63df9f}.tsimm-overseas-plan{margin-top:7px;padding-top:6px;border-top:1px solid #3e4a53;display:grid;gap:3px;max-height:110px;overflow:auto}.tsimm-overseas-plan>div{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:10px}.tsimm-overseas-plan span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d4dc}
      .${APP.tradeItemMark}{position:relative;min-height:38px}      .${APP.tradeBadgeClass}{display:inline-flex;flex-direction:column;gap:1px;margin:3px 0 3px 6px;padding:3px 5px;border:1px solid #bd6cff;border-radius:7px;background:#19171dcc;color:#d9a6ff;font:700 10px/1.15 Arial,sans-serif;vertical-align:middle;white-space:nowrap;pointer-events:none}
      .${APP.tradeBadgeClass} span{font-size:8px;font-weight:600;color:#c9c2d0}
      .tsimm-trade-card{margin:8px 0;padding:8px;border:1px solid #50485c;border-radius:9px;background:#242129}.tsimm-trade-card.tsimm-trade-good{border-color:#44d88b;color:#eafff2}.tsimm-trade-card.tsimm-trade-loss{border-color:#ff626d;color:#fff0f1}.tsimm-trade-card.tsimm-trade-pending,.tsimm-trade-card.tsimm-trade-incomplete{border-color:#bd6cff;color:#f4e8ff}
      .tsimm-trade-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.tsimm-trade-title strong{font-size:13px}.tsimm-trade-title span{font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      .tsimm-trade-grid{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center}.tsimm-trade-grid span{color:#bfb7c8}.tsimm-trade-grid strong{text-align:right}.tsimm-trade-diff-good{color:#63df9f}.tsimm-trade-diff-loss{color:#ff7c85}.tsimm-trade-diff-pending{color:#d6a0ff}
      .tsimm-trade-items{margin-top:7px;padding-top:6px;border-top:1px solid #47404f;max-height:118px;overflow:auto}.tsimm-trade-item-line{display:grid;grid-template-columns:1fr auto;gap:6px;padding:2px 0;font-size:10px}.tsimm-trade-item-line span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-trade-unmatched{color:#ff9ba2}.tsimm-trade-record{width:100%;margin-top:7px;border:1px solid #4b9d70;border-radius:7px;background:#215b3b;color:#eafff2;padding:7px;font-weight:800}
      .tsimm-controls select{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}
      .tsimm-pending-card{margin:7px 0;padding:8px;border:1px solid #c48b35;border-radius:8px;background:#2b2418;display:grid;gap:3px}.tsimm-pending-card>strong{color:#ffd184}.tsimm-pending-card>span{color:#f2e8d5}.tsimm-pending-card>small{color:#c9baa0}.tsimm-pending-card>div{display:flex;gap:6px;margin-top:3px}.tsimm-pending-card button{flex:1;border:1px solid #725f3d;border-radius:6px;background:#3b3020;color:#fff;padding:5px;font-weight:700}
      .tsimm-trader-capture-card{margin:7px 0;padding:8px;border:1px solid #3b8fc2;border-radius:8px;background:#172833;display:grid;gap:3px}.tsimm-trader-capture-card>strong{color:#83d1ff}.tsimm-trader-capture-card>span{color:#d9f1ff}.tsimm-trader-capture-card>small{color:#9fbfce}.tsimm-trader-capture-card>div{display:flex;gap:6px;margin-top:3px}.tsimm-trader-capture-card button{flex:1;border:1px solid #376b89;border-radius:6px;background:#1e4359;color:#fff;padding:5px;font-weight:700}
      #${APP.ledgerOverlayId}{position:fixed;inset:0;z-index:2147483500;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f1f8}
      .tsimm-ledger-shell{width:min(620px,100%);max-height:94vh;display:flex;flex-direction:column;background:#1d1b22;border:1px solid #655d70;border-radius:12px;box-shadow:0 14px 44px #000d;overflow:hidden}
      .tsimm-ledger-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#282330;border-bottom:1px solid #4f4759}.tsimm-ledger-head>div{display:grid;gap:1px;flex:1}.tsimm-ledger-head strong{font-size:14px}.tsimm-ledger-head small{color:#aaa1b7}.tsimm-ledger-head>button{border:1px solid #655d70;border-radius:7px;background:#393341;color:#fff;width:30px;height:30px;font-size:19px}
      .tsimm-ledger-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:5px;padding:8px}.tsimm-ledger-summary>div{display:grid;text-align:center;padding:7px 3px;border:1px solid #494250;border-radius:8px;background:#24212a}.tsimm-ledger-summary strong{font-size:12px}.tsimm-ledger-summary span{font-size:9px;color:#aaa1b7;text-transform:uppercase}
      .tsimm-ledger-actions{display:flex;flex-wrap:wrap;gap:5px;padding:0 8px 8px}.tsimm-ledger-actions button{flex:1;min-width:105px;border:1px solid #625a70;border-radius:7px;background:#393341;color:#fff;padding:7px;font-weight:700}.tsimm-ledger-actions button:first-child{background:#5b2b82;border-color:#8e55b9}
      .tsimm-ledger-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:8px}.tsimm-ledger-tabs button{border:1px solid #514a59;border-radius:7px;background:#28242f;color:#bdb5c6;padding:7px 4px;font-size:10px;font-weight:700}.tsimm-ledger-tabs button.active{background:#5b2b82;border-color:#9a61c2;color:#fff}.tsimm-ledger-filters{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:6px;padding:0 8px 8px}.tsimm-ledger-filters input,.tsimm-ledger-filters select{min-width:0;border:1px solid #5a5266;border-radius:7px;background:#17151b;color:#fff;padding:7px}.tsimm-ledger-freshness{margin:0 8px 8px;color:#aaa1b7;font-size:10px}.tsimm-ledger-toggle{display:flex;align-items:center;gap:6px;margin:0 8px 8px;color:#c9c2d0}.tsimm-ledger-future{margin:0 8px 8px;padding:6px 8px;border:1px solid #51425e;border-radius:7px;background:#241d2a;color:#cdbbdd}.tsimm-ledger-section-title{padding:3px 10px 6px;color:#cdbbdd;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.05em}.tsimm-ledger-sales{padding:0 8px 8px;display:grid;gap:7px;overflow:auto}.tsimm-ledger-sale{border:1px solid #4b6657;border-radius:9px;background:#202a25;padding:8px}.tsimm-ledger-sale-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-ledger-sale-head strong{flex:1;font-size:12px}.tsimm-ledger-sale-head span{font-size:9px;text-transform:uppercase;color:#9ee2bb;border:1px solid #37634b;border-radius:999px;padding:2px 5px}.tsimm-ledger-sale-foot{display:flex;align-items:center;gap:8px;margin-top:6px;padding-top:5px;border-top:1px solid #385044;color:#94aa9d;font-size:10px}.tsimm-ledger-sale-foot span{flex:1}.tsimm-ledger-sale-foot button{border:1px solid #4e6759;border-radius:6px;background:#2d4136;color:#e6fff0;padding:4px 7px;font-weight:700}
      .tsimm-ledger-list{overflow:auto;padding:0 8px 10px;display:grid;gap:7px}.tsimm-ledger-empty{padding:18px 10px;text-align:center;color:#aaa1b7;border:1px dashed #514a59;border-radius:8px}
      .tsimm-ledger-lot{border:1px solid #4d4656;border-radius:9px;background:#24212a;padding:8px}.tsimm-ledger-lot-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-ledger-lot-head strong{flex:1;font-size:13px}.tsimm-ledger-lot-head span{font-size:9px;text-transform:uppercase;color:#c9a2e4;border:1px solid #66497a;border-radius:999px;padding:2px 5px}
      .tsimm-ledger-lot-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.tsimm-ledger-lot-grid span{color:#aaa1b7}.tsimm-ledger-lot-grid strong{text-align:right}.tsimm-ledger-gold{color:#f4c95d}.tsimm-ledger-profit{color:#63df9f}.tsimm-ledger-minor{color:#c77dff}.tsimm-ledger-loss{color:#ff7c85}
      .tsimm-ledger-lot-foot{display:flex;gap:8px;align-items:center;margin-top:7px;padding-top:6px;border-top:1px solid #423c49}.tsimm-ledger-lot-foot small{flex:1;color:#8f8798}.tsimm-ledger-lot-foot button{border:1px solid #5a5266;border-radius:6px;background:#332e3a;color:#fff;padding:4px 7px;margin-left:4px}.tsimm-ledger-notes{margin-top:5px;color:#c1b8ca;font-size:10px}
      .tsimm-gold-text{color:#f4c95d}
      #${APP.traderOverlayId}{position:fixed;inset:0;z-index:2147483500;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f1f8}
      .tsimm-trader-shell{width:min(620px,100%);max-height:94vh;display:flex;flex-direction:column;background:#1d1b22;border:1px solid #7a6740;border-radius:12px;box-shadow:0 14px 44px #000d;overflow:hidden}
      .tsimm-trader-top{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;color:#d8caa5}.tsimm-trader-top span{color:#aaa1b7;font-size:10px}
      .tsimm-trader-list{overflow:auto;padding:0 8px 10px;display:grid;gap:7px}.tsimm-trader-card{border:1px solid #61563e;border-radius:9px;background:#29251e;padding:8px}.tsimm-trader-card-head{display:flex;align-items:center;gap:8px}.tsimm-trader-profile-button{display:grid;flex:1;gap:2px;min-width:0;color:#fff;text-decoration:none}.tsimm-trader-profile-button>strong{font-size:13px}.tsimm-trader-profile-button>.tsimm-trader-stars{color:#f4c95d;letter-spacing:.05em}.tsimm-trader-profile-button.has-banner{position:relative;display:block;min-height:68px;border:1px solid #5d5137;border-radius:6px;overflow:hidden;background:#17140f}.tsimm-trader-profile-button.has-banner img{display:block;width:100%;height:68px;object-fit:cover}.tsimm-trader-banner-label{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:6px;background:linear-gradient(90deg,#0008,#0002 38%,#0002 62%,#0008);text-shadow:0 2px 4px #000,0 0 8px #000;color:#fff!important;letter-spacing:.02em;text-align:center}.tsimm-trader-banner-label strong{font-size:15px;line-height:1.05}.tsimm-trader-banner-label small{font-size:9px;color:#ded7e6}.tsimm-trader-profile-button.has-banner>.tsimm-trader-stars{position:absolute;left:6px;bottom:3px;padding:1px 4px;border-radius:999px;background:#0009;color:#f4c95d;font-size:10px}.tsimm-trader-card-head b{font-size:10px;color:#e8d8ae;border:1px solid #746442;border-radius:999px;padding:2px 6px;white-space:nowrap}.tsimm-trader-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px;margin-top:7px}.tsimm-trader-grid span{color:#b6ad99}.tsimm-trader-grid strong{text-align:right}.tsimm-trader-notes{margin-top:7px;padding:6px;border:1px solid #514a3b;border-radius:6px;background:#201d18;color:#d3c9b6;white-space:pre-wrap}.tsimm-trader-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.tsimm-trader-actions a,.tsimm-trader-actions button{flex:1;min-width:76px;text-align:center;text-decoration:none;border:1px solid #675c43;border-radius:6px;background:#3a3326;color:#fff;padding:6px;font-weight:700}.tsimm-trader-actions a:first-child{background:#6f5220;border-color:#ad8133;color:#fff4d1}.tsimm-profile-capture-card{display:flex;align-items:center;gap:8px;margin:7px 0;padding:7px;border:1px solid #6f5220;border-radius:8px;background:#2b2417}.tsimm-profile-capture-card img{width:112px;max-height:44px;object-fit:cover;border-radius:5px}.tsimm-profile-capture-card div{display:grid;min-width:0}.tsimm-profile-capture-card strong{color:#f6d16f}.tsimm-profile-capture-card span{color:#bdb4c8;font-size:10px}.tsimm-btn-gold{background:#775715!important;border-color:#b98c2c!important;color:#fff5cc!important}
      #${APP.receiptAuditOverlayId}{position:fixed;inset:0;z-index:2147483600;background:#000c;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f1f8}
      .tsimm-audit-shell{width:min(660px,100%);max-height:95vh;display:flex;flex-direction:column;background:#1d1b22;border:1px solid #71617d;border-radius:12px;box-shadow:0 14px 44px #000d;overflow:hidden}.tsimm-audit-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:5px;padding:8px}.tsimm-audit-summary>div{display:grid;gap:2px;padding:7px;border:1px solid #4a4352;border-radius:8px;background:#25212a}.tsimm-audit-summary span{font-size:9px;color:#aaa1b7;text-transform:uppercase}.tsimm-audit-input{display:grid;gap:5px;padding:0 8px 8px}.tsimm-audit-input label{font-weight:700;color:#ded5e7}.tsimm-audit-input textarea{min-height:120px;max-height:220px;resize:vertical;border:1px solid #625a70;border-radius:8px;background:#141218;color:#f7f3fa;padding:8px;font:11px/1.35 monospace}.tsimm-audit-input small{color:#9d94a7}.tsimm-audit-result{margin:0 8px 8px;padding:8px;border:1px solid #51485c;border-radius:9px;background:#242129}.tsimm-audit-result-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.tsimm-audit-result-head span{font-size:9px;text-transform:uppercase;color:#b8afc1}.tsimm-audit-result p{margin:5px 0 7px;color:#cbc3d2}.tsimm-audit-link{display:block;margin-top:7px;text-align:center;border:1px solid #615372;border-radius:6px;background:#352d3f;color:#fff;text-decoration:none;padding:6px;font-weight:700}.tsimm-audit-items{overflow:auto;display:grid;gap:6px;padding:0 8px 8px}.tsimm-audit-item{padding:7px;border:1px solid #4f4759;border-radius:8px;background:#24212a}.tsimm-audit-item>div:first-child{display:flex;justify-content:space-between;gap:8px}.tsimm-audit-item>div:first-child span{font-size:9px;text-transform:uppercase}.tsimm-audit-item>small{display:block;margin-top:5px;color:#a9a0b2}.tsimm-audit-gold{border-color:#a98532!important}.tsimm-audit-green{border-color:#3e8b62!important}.tsimm-audit-purple{border-color:#7b4c9e!important}.tsimm-audit-red{border-color:#9c4650!important}.tsimm-audit-gray{border-color:#5e5963!important}.tsimm-audit-warning{margin:0 8px 8px;padding:7px;border:1px solid #8f4650;border-radius:7px;background:#301d21;color:#ffb8be}.tsimm-audit-actions{display:flex;flex-wrap:wrap;gap:5px;padding:0 8px 8px}.tsimm-audit-actions button{flex:1;min-width:110px;border:1px solid #625a70;border-radius:7px;background:#393341;color:#fff;padding:7px;font-weight:700}.tsimm-audit-actions button:first-child{background:#5b2b82;border-color:#8e55b9}.tsimm-audit-actions button:disabled{opacity:.5}.tsimm-audit-status-gold{color:#f4c95d}.tsimm-audit-status-green{color:#63df9f}.tsimm-audit-status-purple{color:#cf8cff}.tsimm-audit-status-red{color:#ff7c85}.tsimm-audit-status-gray,.tsimm-audit-status-link-only{color:#bbb2c3}
      #tsimm-toast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:2147483647;padding:8px 11px;border-radius:8px;background:#17151b;color:#fff;border:1px solid #655d70;box-shadow:0 6px 20px #0009;font:12px Arial,sans-serif}
    `;
    document.head.appendChild(style);
  }

  function overseasSummaryHtml(stats) {
    if (stats.pageType !== 'overseas shop') return '';
    const currentText = stats.overseasDetectedLoad === null
      ? `assumed 0/${formatInteger(stats.overseasLoadLimit)}`
      : `${formatInteger(stats.overseasDetectedLoad)}/${formatInteger(stats.overseasLoadLimit)}`;
    const planLines = (stats.overseasPlanItems || []).map((item) =>
      `<div><span>${escapeHtml(item.name)} × ${formatInteger(item.quantity)}</span><strong>+${escapeHtml(formatMoney(item.profit))}</strong></div>`
    ).join('');
    const cargoProfitText = stats.overseasCargoQuantity > 0
      ? `${stats.overseasCargoProfit >= 0 ? '+' : ''}${formatMoney(stats.overseasCargoProfit)}`
      : 'No captured cargo';
    const cargoProfitClass = stats.overseasCargoQuantity > 0
      ? (stats.overseasCargoProfit >= 0 ? 'tsimm-overseas-profit' : 'tsimm-loss-text')
      : 'tsimm-muted';
    return `
      <div class="tsimm-overseas-card">
        <div class="tsimm-overseas-title"><strong>✈️ Overseas load planner</strong><span>${escapeHtml(stats.overseasCountry || 'foreign shop')}</span></div>
        <div class="tsimm-overseas-grid">
          <span>Configured load</span><strong>${escapeHtml(currentText)}</strong>
          <span>Remaining slots</span><strong>${formatInteger(stats.overseasRemainingCapacity)}</strong>
          <span>Best visible fill</span><strong>${formatInteger(stats.overseasPlanQuantity)} items</strong>
          <span>Purchase cost</span><strong>${formatMoney(stats.overseasPlanCost)}</strong>
          <span>Ⓣ Return at home</span><strong>${formatMoney(stats.overseasPlanTraderReturn)}</strong>
          <span>Expected trip profit</span><strong class="tsimm-overseas-profit">+${formatMoney(stats.overseasPlanProfit)}</strong>
          <span>Captured cargo</span><strong>${formatInteger(stats.overseasCargoQuantity)} items</strong>
          <span>Cargo cost basis</span><strong>${formatMoney(stats.overseasCargoCost)}</strong>
          <span>Cargo Ⓣ return</span><strong>${formatMoney(stats.overseasCargoTraderReturn)}</strong>
          <span>Cargo expected profit</span><strong class="${cargoProfitClass}">${escapeHtml(cargoProfitText)}</strong>
        </div>
        ${planLines ? `<div class="tsimm-overseas-plan">${planLines}</div>` : ''}
      </div>
    `;
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
    const coverageText = stats.tradeLedgerRequestedQuantity
      ? `${formatInteger(stats.tradeLedgerTrackedQuantity)}/${formatInteger(stats.tradeLedgerRequestedQuantity)}`
      : 'No ledger match';
    const saleProfitValue = optionalFiniteNumber(stats.tradeSaleProfit);
    const saleProfitText = saleProfitValue === null
      ? 'Incomplete'
      : `${saleProfitValue >= 0 ? '+' : ''}${formatMoney(saleProfitValue)}`;
    const saleProfitClass = saleProfitValue === null
      ? 'tsimm-trade-diff-pending'
      : (saleProfitValue >= 0 ? 'tsimm-trade-diff-good' : 'tsimm-trade-diff-loss');
    const saleProfitLabel = stats.tradeLedgerFullCoverage ? 'Actual sale profit' : 'Tracked sale profit';
    const saleStateText = stats.tradeSaleRecorded
      ? 'Recorded'
      : (stats.tradeCompleted ? 'Completed, not recorded' : 'Preview');
    const itemLines = state.settings.showTradeItemBreakdown
      ? [
          ...stats.tradeItems.map((item) => `<div class="tsimm-trade-item-line"><span>${escapeHtml(item.name)} × ${escapeHtml(formatInteger(item.quantity))}</span><strong>Ⓣ ${escapeHtml(formatMoney(item.targetTotal))}</strong></div>`),
          ...stats.tradeUnmatched.map((item) => `<div class="tsimm-trade-item-line tsimm-trade-unmatched"><span>Unmatched: ${escapeHtml(item.name)} × ${escapeHtml(formatInteger(item.quantity))}</span><strong>?</strong></div>`),
        ].join('')
      : '';
    const canRecord = !stats.tradeSaleRecorded
      && stats.tradeMatchedItems > 0
      && !stats.tradeUnmatchedItems
      && optionalFiniteNumber(stats.tradeNetCash) !== null
      && stats.tradeLedgerTrackedQuantity > 0;
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
          <span>Ledger cost basis</span><strong>${formatMoney(stats.tradeLedgerCostBasis)}</strong>
          <span>Ledger coverage</span><strong>${escapeHtml(coverageText)}</strong>
          <span>${escapeHtml(saleProfitLabel)}</span><strong class="${saleProfitClass}">${escapeHtml(saleProfitText)}</strong>
          <span>Ledger sale state</span><strong>${escapeHtml(saleStateText)}</strong>
        </div>
        ${itemLines ? `<div class="tsimm-trade-items">${itemLines}</div>` : ''}
        ${canRecord
          ? `<button class="tsimm-trade-record" type="button" data-tsimm-action="trade-record-sale">Record completed sale</button>`
          : ''}
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
    const isProfile = stats.pageType === 'profile';
    const isOverseas = stats.pageType === 'overseas shop';
    const isPriceCapture = stats.pageType === 'price capture';
    const isMarketPage = isOverseas || stats.pageType === 'category' || stats.pageType.startsWith('item listings');
    const npcCount = stats.categoryNpc + stats.listingNpc;
    const goldCount = stats.categoryGold + stats.listingGold + stats.overseasGold;
    const goodCount = stats.categoryGood + stats.listingGood + stats.overseasGood;
    const minorCount = stats.categoryMinor + stats.listingMinor + stats.overseasMinor;
    const lossCount = stats.categoryLoss + stats.listingLoss + stats.overseasLoss;
    const matchedCount = stats.categoryMatched + stats.listingMatched + stats.overseasMatched;
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
      : isProfile
        ? `<div class="tsimm-status tsimm-profile-status">
            <div class="tsimm-stat"><strong class="${stats.profileCaptureReady ? 'tsimm-good-text' : 'tsimm-loss-text'}">${stats.profileCaptureReady ? '✓' : '?'}</strong><span>profile</span></div>
            <div class="tsimm-stat"><strong>${escapeHtml(stats.profileUserId || '?')}</strong><span>Torn ID</span></div>
            <div class="tsimm-stat"><strong>${stats.profileBannerUrl ? '✓' : '—'}</strong><span>banner</span></div>
            <div class="tsimm-stat"><strong>${formatInteger(state.traders.length)}</strong><span>saved</span></div>
          </div>`
        : isPriceCapture
          ? (() => {
              const pending = activePendingTraderCapture();
              const trader = traderForPendingCapture(pending);
              return `<div class="tsimm-status">
                <div class="tsimm-stat"><strong class="tsimm-npc-text">🔗</strong><span>armed</span></div>
                <div class="tsimm-stat"><strong>${escapeHtml(trader?.name || pending?.name || '?')}</strong><span>trader</span></div>
                <div class="tsimm-stat"><strong>${formatInteger(trader?.pricePageItems?.length || 0)}</strong><span>saved prices</span></div>
              </div>`;
            })()
          : `<div class="tsimm-status">
            <div class="tsimm-stat"><strong class="tsimm-npc-text">${npcCount}</strong><span>NPC flips</span></div>
            <div class="tsimm-stat"><strong class="tsimm-gold-text">${goldCount}</strong><span>gold</span></div>
            <div class="tsimm-stat"><strong class="tsimm-good-text">${goodCount}</strong><span>green</span></div>
            <div class="tsimm-stat"><strong class="tsimm-minor-text">${minorCount}</strong><span>purple</span></div>
            <div class="tsimm-stat"><strong class="tsimm-loss-text">${lossCount}</strong><span>red</span></div>
            <div class="tsimm-stat"><strong>${matchedCount}</strong><span>matched</span></div>
          </div>`;
    const marketControls = isMarketPage
      ? `${isOverseas ? `<div class="tsimm-controls"><label>Travel load limit</label><input type="number" min="0" step="1" value="${escapeHtml(state.settings.overseasLoadLimit)}" data-tsimm-setting="overseasLoadLimit"></div>` : ''}<div class="tsimm-controls"><label>Gold profit each</label><input type="number" min="0" step="1" value="${escapeHtml(state.settings.goldMinimumProfitEach)}" data-tsimm-setting="goldMinimumProfitEach"></div>
        <div class="tsimm-controls"><label>Green profit each</label><input type="number" min="0" step="1" value="${escapeHtml(state.settings.minimumProfitEach)}" data-tsimm-setting="minimumProfitEach"></div>
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
        <div class="tsimm-muted">Ledger: ${formatInteger(ledger.lots)} open lots · ${formatMoney(ledger.invested)} invested · ${ledger.expectedProfit >= 0 ? '+' : ''}${formatMoney(ledger.expectedProfit)} expected · ${ledger.realizedProfit >= 0 ? '+' : ''}${formatMoney(ledger.realizedProfit)} realized</div>
        <div class="tsimm-note">Profit base: Ⓣ = floor(Ⓜ × 99%) per item · blue = NPC store payout above listing price</div>
        ${pendingPurchaseHtml()}
        ${pendingTraderCaptureHtml()}
        ${overseasSummaryHtml(stats)}
        ${tradeSummaryHtml(stats)}
        ${isProfile && stats.profileName ? `<div class="tsimm-profile-capture-card">${stats.profileBannerUrl ? `<img src="${escapeHtml(stats.profileBannerUrl)}" alt="${escapeHtml(stats.profileName)}">` : ''}<div><strong>${escapeHtml(stats.profileName)}</strong><span>Torn ID ${escapeHtml(stats.profileUserId || 'unresolved')}</span></div></div>` : ''}
        <div class="tsimm-actions">
          <button class="tsimm-btn tsimm-btn-primary" type="button" data-tsimm-action="sync" ${state.syncing ? 'disabled' : ''}>${state.syncing ? 'Syncing…' : 'Sync values'}</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="scan">Scan page</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="diagnostics">Copy diagnostics</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="ledger-open">Ledger (${formatInteger(ledger.lots)})</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="traders-open">Traders (${formatInteger(state.traders.length)})</button>
          ${isProfile && stats.profileCaptureReady ? '<button class="tsimm-btn tsimm-btn-gold" type="button" data-tsimm-action="trader-capture-profile">Capture profile</button><button class="tsimm-btn tsimm-btn-blue" type="button" data-tsimm-action="trader-arm-current-profile">Arm price capture</button>' : ''}
          ${activePendingTraderCapture() ? '<button class="tsimm-btn tsimm-btn-blue" type="button" data-tsimm-action="trader-capture-current-page">Capture current page</button>' : ''}
          ${isTrade && stats.tradeCounterparty ? '<button class="tsimm-btn" type="button" data-tsimm-action="trader-save-current">Save trader</button>' : ''}
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
      } else if (action === 'trade-record-sale') {
        const stats = state.lastScan;
        const plan = ledgerSalePlan(stats);
        if (!plan.trackedQuantity) {
          toast('No open ledger lots matched this trade.');
          return;
        }
        const profitText = Number.isFinite(plan.realizedProfit)
          ? `${plan.realizedProfit >= 0 ? '+' : ''}${formatMoney(plan.realizedProfit)}`
          : `${plan.trackedProfit >= 0 ? '+' : ''}${formatMoney(plan.trackedProfit)} tracked profit`;
        const coverageWarning = plan.fullCoverage
          ? ''
          : `\n\nWarning: ${plan.untrackedQuantity} sold item${plan.untrackedQuantity === 1 ? '' : 's'} are not covered by the ledger.`;
        if (confirm(`Record this completed trade sale?\n\nLedger cost basis: ${formatMoney(plan.trackedCostBasis)}\nSale profit: ${profitText}${coverageWarning}`)) {
          try {
            const sale = recordTradeSale(stats, plan.fullCoverage ? 'manual-completed-trade' : 'manual-partial-trade');
            toast(`Sale recorded. ${sale.fullCoverage ? 'Profit' : 'Tracked profit'} ${Number(sale.realizedProfit ?? sale.trackedProfit) >= 0 ? '+' : ''}${formatMoney(sale.realizedProfit ?? sale.trackedProfit)}.`);
            scanPage();
          } catch (error) {
            toast(error?.message || 'Sale recording failed.');
          }
        }
      } else if (action === 'receipt-audit-open') {
        openReceiptAudit(button.dataset.tsimmSaleId);
      } else if (action === 'receipt-audit-close') {
        closeReceiptAudit();
      } else if (action === 'receipt-audit-preview') {
        previewReceiptAudit();
      } else if (action === 'receipt-audit-save') {
        saveReceiptAudit();
      } else if (action === 'receipt-audit-clear') {
        clearReceiptAudit();
      } else if (action === 'receipt-link-pending-trader') {
        linkPendingTraderToReceiptAudit();
      } else if (action === 'ledger-open') {
        openLedger();
      } else if (action === 'traders-open') {
        openTraders();
      } else if (action === 'traders-close') {
        closeTraders();
      } else if (action === 'trader-save-current') {
        saveCurrentTrader();
      } else if (action === 'trader-capture-profile') {
        saveCurrentProfileTrader();
      } else if (action === 'trader-arm-current-profile') {
        armCurrentProfileTrader();
      } else if (action === 'trader-arm-capture') {
        armTraderForPriceCapture(state.traders.find((entry) => entry.id === button.dataset.tsimmTraderId));
      } else if (action === 'trader-capture-current-page') {
        captureCurrentPricePageForTrader();
      } else if (action === 'trader-clear-capture') {
        clearPendingTraderCapture('Trader price capture cleared.');
      } else if (action === 'trader-open-recapture') {
        requestTraderPriceRecapture(button.dataset.tsimmTraderId);
      } else if (action === 'trader-add') {
        const trader = promptTrader();
        if (trader) { upsertTrader(trader); toast(`Saved trader ${trader.name}.`); }
      } else if (action === 'trader-edit') {
        editTrader(button.dataset.tsimmTraderId);
      } else if (action === 'trader-delete') {
        deleteTrader(button.dataset.tsimmTraderId);
      } else if (action === 'traders-copy') {
        copyTradersJson();
      } else if (action === 'traders-import') {
        importTradersJson();
      } else if (action === 'ledger-tab') {
        const view = button.dataset.tsimmLedgerView;
        if (['holdings', 'history', 'sales'].includes(view)) {
          state.ledgerUi.view = view;
          state.ledgerUi.search = '';
          renderLedger();
        }
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
      const soldToggle = event.target.closest('[data-tsimm-ledger-show-sold]');
      if (soldToggle) {
        state.ledgerUi.showSold = soldToggle.checked;
        state.settings.ledgerShowSoldPurchases = soldToggle.checked;
        saveJson(APP.settingsStorageKey, state.settings);
        renderLedger();
        return;
      }
      const ledgerSort = event.target.closest('[data-tsimm-ledger-sort]');
      if (ledgerSort) {
        state.ledgerUi.sort = ['newest', 'oldest', 'profit-now', 'item-name', 'purchase-price'].includes(ledgerSort.value)
          ? ledgerSort.value
          : 'newest';
        renderLedger();
        return;
      }
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
      const ledgerSearch = event.target.closest('[data-tsimm-ledger-search]');
      if (ledgerSearch) {
        const cursor = ledgerSearch.selectionStart ?? ledgerSearch.value.length;
        state.ledgerUi.search = ledgerSearch.value;
        renderLedger();
        const replacement = document.querySelector(`#${APP.ledgerOverlayId} [data-tsimm-ledger-search]`);
        if (replacement) {
          replacement.focus();
          replacement.setSelectionRange(cursor, cursor);
        }
        return;
      }
      if (event.target.closest(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId}`)) return;
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

  function immUiSelector() {
    return `#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},[data-tsimm-generated]`;
  }

  function mutationNodeElement(node) {
    if (node?.nodeType === Node.TEXT_NODE) return node.parentElement;
    return node instanceof Element ? node : null;
  }

  function mutationLooksRelevant(mutation) {
    const targetElement = mutationNodeElement(mutation.target);
    if (targetElement?.closest(immUiSelector())) return false;

    const href = String(location.href || '').toLowerCase();
    const marketRoute = href.includes('itemmarket') || href.includes('item-market') || href.includes('imarket');
    const overseasRoute = href.includes('shops.php') || href.includes('foreignshop') || href.includes('travelshop') || href.includes('abroad');
    const tradeRoute = href.includes('trade.php');
    const profileRoute = href.includes('profiles.php');
    const added = [...(mutation.addedNodes || [])];

    if (mutation.type === 'characterData') {
      const text = normalizeWhitespace(mutation.target.textContent);
      if (!text) return false;
      if (marketRoute || overseasRoute) return /\$|\bvalue\b|\bqty\b|\bbuy\b|\bowner\b|\bstock\b|\bavailable\b|\bcapacity\b|\([\d,]+\)/i.test(text);
      if (tradeRoute) return /\btrade\b|\bin trade\b|\bx\s*[\d,]+\b|\$[\d,]+/i.test(text);
      if (profileRoute) return /profile|level|rank|\[\d+\]/i.test(text);
      return false;
    }

    return added.some((node) => {
      const element = mutationNodeElement(node);
      if (element?.closest(immUiSelector()) || element?.matches(immUiSelector())) return false;
      const text = normalizeWhitespace(node.textContent);
      if (marketRoute || overseasRoute) {
        return /\$[\d,.]+|\bItem Market\b|\bValue\b|\bQty\b|\bOwner\b|\bStock\b|\bAvailable\b|\bCapacity\b/i.test(text)
          || Boolean(element?.matches('li,[class*="row"],[class*="item"],[class*="market"]'))
          || Boolean(element?.querySelector?.('[class*="price"],li,img'));
      }
      if (tradeRoute) {
        return /\btrade\b|\bin trade\b|\bx\s*[\d,]+\b|\$[\d,]+/i.test(text)
          || Boolean(element?.matches('.user,[class*="trade"],li.color2'));
      }
      if (profileRoute) {
        return /profile|level|rank|\[\d+\]/i.test(text)
          || Boolean(element?.matches('img,[class*="profile"],[class*="user"]'));
      }
      return false;
    });
  }

  function bindObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent && !parent.closest(immUiSelector())) {
            inspectPurchaseSignal(parent.textContent, 'dom');
          }
        }
        for (const node of mutation.addedNodes || []) {
          const element = mutationNodeElement(node);
          if (element?.closest(immUiSelector()) || element?.matches(immUiSelector())) continue;
          inspectPurchaseSignal(node.textContent, 'dom');
        }
      }
      if (mutations.some(mutationLooksRelevant)) scheduleScan();
    });
    state.observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  function initialize() {
    if (state.initialized || !document.body) return;
    state.initialized = true;
    if (isTornExchangePriceListUrl(location.href)) {
      initializeTornExchangePriceCapture();
      return;
    }
    if (isWeav3rPriceListUrl(location.href)) {
      initializeWeav3rPriceCapture();
      return;
    }
    injectStyles();
    const importedPriceCapture = consumeImportedPriceCapture();
    if (EARLY_CAPTURE_NOTICE) {
      setTimeout(() => toast(
        `${EARLY_CAPTURE_NOTICE.trader}: ${formatInteger(EARLY_CAPTURE_NOTICE.count)} prices saved${EARLY_CAPTURE_NOTICE.changes ? ` · ${formatInteger(EARLY_CAPTURE_NOTICE.changes)} changed` : ''}. IMM controls restored.`,
      ), 150);
    }
    runPurchasePrivacyMigration();
    savePendingPurchase();
    bindPanelEvents();
    installNetworkObservers();
    bindObserver();
    if (importedPriceCapture) {
      setTimeout(() => toast(`${importedPriceCapture.trader.name}: ${formatInteger(importedPriceCapture.parsedCount)} TornW3B prices saved${importedPriceCapture.changedCount ? ` · ${formatInteger(importedPriceCapture.changedCount)} changed` : ''}.`), 150);
    }
    window.addEventListener('hashchange', () => scheduleScan(20));
    window.addEventListener('popstate', () => scheduleScan(20));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleScan(20);
    });
    scheduleScan(120);
    maybeScheduleTraderPriceRecapture();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      normalizeName,
      cleanTradeParticipantName,
      normalizeHttpUrl,
      parseNumber,
      normalizeCatalogItem,
      normalizeCatalog,
      marginFor,
      traderPayout,
      manifestTotals,
      overseasLoadPlan,
      pageLooksLikeOverseasShop,
      detectOverseasLoad,
      itemIdFromLocation,
      resolveListingMarketValue,
      parsePurchaseConfirmationText,
      parsePurchaseSuccessText,
      sanitizePurchaseSignalText,
      scrubItemMarketPurchaseNotes,
      normalizeLedger,
      normalizeSaleRecord,
      normalizeTraderPriceItem,
      normalizeTrader,
      normalizeTraders,
      normalizeReceiptAudit,
      parseReceiptInput,
      buildReceiptAudit,
      npcBuybackFor,
      capturedPriceChangeCount,
      isWeav3rPriceListUrl,
      compactPriceCaptureResult,
      expandPriceCaptureResult,
      traderSalesFor,
      linkRecordedSalesToTrader,
      optionalFiniteNumber,
      buildLedgerLot,
      ledgerSummary,
      lotProfitProjection,
      sortLedgerLots,
      ledgerSalePlan,
      recordTradeSale,
      _state: state,
    };
  }

  /*
   * ITEM-CENTRIC WATCHLIST MODULE
   * Migrated from IMM Trader Extensions v0.2.1.
   * Storage keys intentionally remain unchanged so existing favorites and
   * watched items continue without conversion or data loss.
   */
  if (/^(?:www\.)?torn\.com$/i.test(location.hostname)) {
(() => {
  'use strict';

  const A = Object.freeze({
    v: '0.2.1',
    traders: 'tornscripture-imm-traders-v1',
    catalog: 'tornscripture-imm-catalog-v1',
    sharedCatalog: 'tornscripture-ish-torn-catalog-v1',
    legacyTracked: 'tornscripture-imm-tracked-items-v1',
    favorites: 'tornscripture-imm-favorite-traders-v1',
    watched: 'tornscripture-imm-watched-items-v1',
    migration: 'tornscripture-imm-watch-model-migration-v1',
    overlaySettings: 'tornscripture-imm-trader-market-overlay-settings-v1',
    deals: 'tornscripture-imm-trader-deals-addon',
    style: 'tsimm-trader-extensions-style',
    dock: 'tsimm-watch-dock',
    panel: 'tsimm-watch-panel',
    toast: 'tsimm-watch-toast',
  });

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const read = (storageKey, fallback) => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch {
      return clone(fallback);
    }
  };
  const write = (storageKey, value) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const key = (value) => clean(value)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9'+&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const cash = (value) => new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(Number(value) || 0);
  const itemKey = (id, name) => Number(id) > 0 ? `id:${Number(id)}` : `name:${key(name)}`;
  const ageText = (value) => {
    const captured = Date.parse(value || '');
    if (!Number.isFinite(captured)) return 'unknown';
    const minutes = Math.max(0, Math.floor((Date.now() - captured) / 60000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
  };
  const marketPage = () => /(?:sid=ItemMarket|itemmarket|item-market)/i.test(location.href)
    || Boolean(document.querySelector('.tsimm-listing-mark'));

  function injectStyle() {
    if (!document.head) return;
    let style = document.getElementById(A.style);
    if (!style) {
      style = document.createElement('style');
      style.id = A.style;
      document.head.appendChild(style);
    }
    style.textContent = `
      #${A.dock}{position:fixed;left:8px;right:8px;bottom:max(70px,calc(env(safe-area-inset-bottom) + 62px));z-index:2147483647;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:8px 9px;border:1px solid #68e879;border-radius:7px;background:#020a04f2;color:#aaff83;box-shadow:0 8px 28px #000d;font:10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.dock} .watch-copy{display:grid;min-width:0;gap:2px}#${A.dock} small{color:#5ea66a;font-size:7px;letter-spacing:.08em}#${A.dock} strong{overflow:hidden;color:#c1ff9d;font-size:11px;white-space:nowrap;text-overflow:ellipsis}#${A.dock} span{overflow:hidden;color:#70b87b;font-size:8px;white-space:nowrap;text-overflow:ellipsis}#${A.dock} button{min-height:36px;border:1px solid #58d76d;border-radius:5px;background:#082b10;color:#c5ffac;padding:6px 8px;font:800 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.dock} button.on{border-color:#9dff7c;background:#16461e;color:#e1ffd2}.tsimm-watch-selected{outline:1px solid #9dff7c!important;outline-offset:-2px!important}
      .tsimm-favorite-trader-btn{border:1px solid #72622a!important;border-radius:5px!important;background:#171407!important;color:#d9bf55!important;padding:7px 8px!important;font:800 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-favorite-trader-btn.on{border-color:#d7b943!important;background:#332a08!important;color:#ffe47b!important}
      #${A.toast}{position:fixed;left:50%;top:max(70px,calc(env(safe-area-inset-top) + 62px));z-index:2147483647;max-width:min(360px,calc(100vw - 24px));padding:8px 11px;transform:translate(-50%,-8px);border:1px solid #73df83;border-radius:6px;background:#06170af5;color:#d2ffc0;box-shadow:0 8px 26px #000c;font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease}#${A.toast}.show{transform:translate(-50%,0);opacity:1}
      #${A.panel}{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;align-items:center;box-sizing:border-box;margin:3px 5px;padding:5px 7px;border:1px solid #27863f;border-radius:5px;background:#041109f5;color:#9ff48e;box-shadow:none;font:700 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.panel} .watch-copy{display:grid;min-width:0;gap:2px}#${A.panel} strong{overflow:hidden;color:#c7ffad;font-size:8px;white-space:nowrap;text-overflow:ellipsis}#${A.panel} span{display:block;overflow:hidden;color:#72bd7d;font-size:7px;white-space:nowrap;text-overflow:ellipsis}#${A.panel} button{min-height:28px;border:1px solid #58d76d;border-radius:4px;background:#082b10;color:#c5ffac;padding:4px 7px;font:800 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.panel}.idle{border-color:#4d5960;background:#0a0d0ff5;color:#aeb8bd}#${A.panel}.idle strong,#${A.panel}.idle span{color:#aeb8bd}#${A.panel}.stale{border-color:#9a6d1f;background:#211705f5;color:#ffd166}#${A.panel}.stale strong,#${A.panel}.stale span{color:#ffd166}#${A.panel}.outdated,#${A.panel}.missing{border-color:#8f4850;background:#23090cf5;color:#ff9ba3}#${A.panel}.outdated strong,#${A.panel}.outdated span,#${A.panel}.missing strong,#${A.panel}.missing span{color:#ff9ba3}
      .tsimm-watch-inline-badge{min-width:0!important}.tsimm-watch-inline{display:block!important;max-width:100%!important;overflow:hidden!important;color:#baff9f!important;opacity:1!important;font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;text-overflow:ellipsis!important;white-space:nowrap!important}.tsimm-watch-format-row{position:relative!important}
      .tsimm-watch-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:112px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}.tsimm-watch-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-watch-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-watch-floor-row{box-shadow:inset 0 2px #347c41!important}
    `;
  }

  function tradersRaw() {
    const root = read(A.traders, []);
    return {
      root,
      object: !Array.isArray(root) && Array.isArray(root?.traders),
      list: Array.isArray(root) ? root : Array.isArray(root?.traders) ? root.traders : [],
    };
  }

  function normItem(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const id = Number(candidate.itemId ?? candidate.id) > 0 ? Number(candidate.itemId ?? candidate.id) : null;
    const name = clean(candidate.itemName ?? candidate.name) || (id ? `Item ${id}` : '');
    const price = Math.max(0, Number(candidate.unitPrice ?? candidate.price ?? candidate.value) || 0);
    return name ? { id, name, n: key(name), price } : null;
  }

  function normTraders() {
    return tradersRaw().list.map((candidate) => {
      if (!candidate || typeof candidate !== 'object') return null;
      const name = clean(candidate.name ?? candidate.username);
      if (!name) return null;
      const uid = Number(candidate.userId ?? candidate.tornId) > 0 ? Number(candidate.userId ?? candidate.tornId) : null;
      return {
        raw: candidate,
        id: clean(candidate.recordId ?? candidate.uuid)
          || (typeof candidate.id === 'string' ? clean(candidate.id) : '')
          || (uid ? `trader-${uid}` : `trader-${key(name)}`),
        name,
        n: key(name),
        uid,
        captured: candidate.pricePageLastCheckedAt || candidate.pricePageCapturedAt || candidate.pricesCapturedAt || null,
        url: clean(candidate.pricePageUrl ?? candidate.pricingPageUrl),
        items: (Array.isArray(candidate.pricePageItems ?? candidate.pricingItems)
          ? candidate.pricePageItems ?? candidate.pricingItems
          : []).map(normItem).filter(Boolean),
      };
    }).filter(Boolean);
  }

  function catalog() {
    const normalize = (raw) => {
      const result = { id: {}, name: {} };
      const source = raw?.itemsByName || raw?.items || {};
      const entries = Array.isArray(source)
        ? source.map((item) => [String(item?.id ?? ''), item])
        : Object.entries(source);
      for (const [entryKey, candidate] of entries) {
        if (!candidate || typeof candidate !== 'object') continue;
        const id = Number(candidate.id ?? candidate.itemId ?? entryKey) > 0
          ? Number(candidate.id ?? candidate.itemId ?? entryKey)
          : null;
        const name = clean(candidate.name);
        if (!name) continue;
        const item = { id, name, n: key(name) };
        if (id) result.id[String(id)] = item;
        result.name[item.n] = item;
      }
      return result;
    };
    const shared = normalize(read(A.sharedCatalog, {}));
    const own = normalize(read(A.catalog, {}));
    return { id: { ...shared.id, ...own.id }, name: { ...shared.name, ...own.name } };
  }

  function legacyEntries() {
    const raw = read(A.legacyTracked, {});
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    return source.filter(Boolean);
  }

  function favoriteStore() {
    const raw = read(A.favorites, {});
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    const unique = new Map();
    for (const candidate of source) {
      const traderId = clean(candidate?.traderId ?? candidate?.id);
      const traderName = clean(candidate?.traderName ?? candidate?.name);
      if (!traderId && !traderName) continue;
      unique.set(traderId || `name:${key(traderName)}`, {
        traderId,
        traderName,
        addedAt: candidate?.addedAt || new Date().toISOString(),
      });
    }
    return { schema: 'tornscripture-imm-favorite-traders', schemaVersion: 1, entries: [...unique.values()] };
  }

  function watchedStore() {
    const raw = read(A.watched, {});
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    const unique = new Map();
    for (const candidate of source) {
      const itemId = Number(candidate?.itemId ?? candidate?.id) > 0 ? Number(candidate.itemId ?? candidate.id) : null;
      const itemName = clean(candidate?.itemName ?? candidate?.name);
      if (!itemName) continue;
      unique.set(itemKey(itemId, itemName), {
        itemId,
        itemName,
        addedAt: candidate?.addedAt || new Date().toISOString(),
        source: clean(candidate?.source) || 'manual',
      });
    }
    return { schema: 'tornscripture-imm-watched-items', schemaVersion: 1, entries: [...unique.values()] };
  }

  function emitWatchUpdate() {
    try {
      window.dispatchEvent(new CustomEvent('tsimm:watchlists-updated'));
    } catch {}
  }

  function saveFavorites(store) {
    store.updatedAt = new Date().toISOString();
    write(A.favorites, store);
    emitWatchUpdate();
  }

  function saveWatched(store) {
    store.updatedAt = new Date().toISOString();
    write(A.watched, store);
    emitWatchUpdate();
  }

  function migrateLegacyTracking() {
    const previous = read(A.migration, null);
    if (previous?.completed) return previous;
    const legacy = legacyEntries();
    const favorites = favoriteStore();
    const watched = watchedStore();
    const favoriteKeys = new Set(favorites.entries.map((entry) => entry.traderId || `name:${key(entry.traderName)}`));
    const watchedKeys = new Set(watched.entries.map((entry) => itemKey(entry.itemId, entry.itemName)));
    let favoritesAdded = 0;
    let itemsAdded = 0;
    for (const entry of legacy) {
      const traderId = clean(entry.traderId);
      const traderName = clean(entry.traderName);
      const traderToken = traderId || `name:${key(traderName)}`;
      if ((traderId || traderName) && !favoriteKeys.has(traderToken)) {
        favorites.entries.push({ traderId, traderName, addedAt: entry.markedAt || new Date().toISOString() });
        favoriteKeys.add(traderToken);
        favoritesAdded += 1;
      }
      const itemId = Number(entry.itemId) > 0 ? Number(entry.itemId) : null;
      const itemName = clean(entry.itemName);
      const token = itemName ? itemKey(itemId, itemName) : '';
      if (token && !watchedKeys.has(token)) {
        watched.entries.push({ itemId, itemName, addedAt: entry.markedAt || new Date().toISOString(), source: 'legacy-pair' });
        watchedKeys.add(token);
        itemsAdded += 1;
      }
    }
    if (favoritesAdded) saveFavorites(favorites);
    if (itemsAdded) saveWatched(watched);
    const result = {
      completed: true,
      migratedAt: new Date().toISOString(),
      legacyCount: legacy.length,
      favoritesAdded,
      itemsAdded,
    };
    write(A.migration, result);
    return result;
  }

  function favoriteMatches(entry, trader) {
    return entry.traderId ? entry.traderId === trader.id : key(entry.traderName) === trader.n;
  }

  function isFavorite(store, trader) {
    return store.entries.some((entry) => favoriteMatches(entry, trader));
  }

  let favoriteToastTimer = 0;

  function showFavoriteToast(message) {
    let toast = document.getElementById(A.toast);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = A.toast;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = clean(message);
    toast.classList.add('show');
    clearTimeout(favoriteToastTimer);
    favoriteToastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { if (!toast.classList.contains('show')) toast.remove(); }, 220);
    }, 1500);
  }

  function applyFavoriteButtonState(button, favorite, kind = 'dock') {
    if (!(button instanceof HTMLElement)) return;
    button.classList.toggle('on', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.textContent = kind === 'book'
      ? (favorite ? '★ FAVORITE' : '☆ FAVORITE')
      : (favorite ? '★ TRADER' : '☆ TRADER');
  }

  function toggleFavorite(trader) {
    const store = favoriteStore();
    const index = store.entries.findIndex((entry) => favoriteMatches(entry, trader));
    const added = index < 0;
    if (added) store.entries.push({ traderId: trader.id, traderName: trader.name, addedAt: new Date().toISOString() });
    else store.entries.splice(index, 1);
    saveFavorites(store);
    scheduleTorn();
    return added;
  }

  function isWatched(store, item) {
    const token = itemKey(item.id, item.name);
    return store.entries.some((entry) => itemKey(entry.itemId, entry.itemName) === token);
  }

  function toggleWatched(item, source = 'manual') {
    const store = watchedStore();
    const token = itemKey(item.id, item.name);
    const index = store.entries.findIndex((entry) => itemKey(entry.itemId, entry.itemName) === token);
    if (index >= 0) store.entries.splice(index, 1);
    else store.entries.push({ itemId: item.id, itemName: item.name, addedAt: new Date().toISOString(), source });
    saveWatched(store);
    scheduleTorn();
  }

  let activeTrader = '';
  let selectedDeal = null;
  let tornTimer = 0;
  let ownMutation = false;

  function reportTrader(traders) {
    const overlay = document.getElementById(A.deals);
    if (!overlay) return null;
    const header = clean(overlay.querySelector('.td-head strong')?.textContent)
      .replace(/^>\s*/, '')
      .replace(/_DEALS$/i, '');
    const fromHeader = header ? traders.find((trader) => trader.n === key(header)) : null;
    if (fromHeader) {
      activeTrader = fromHeader.id;
      return fromHeader;
    }
    return activeTrader ? traders.find((trader) => trader.id === activeTrader) || null : null;
  }

  function dealFromRow(row, trader) {
    const name = clean(row?.querySelector('.td-row-title strong')?.textContent);
    const item = trader?.items.find((candidate) => candidate.n === key(name));
    return item ? { trader, item } : null;
  }

  function selectDeal(row) {
    const overlay = document.getElementById(A.deals);
    const trader = reportTrader(normTraders());
    const deal = dealFromRow(row, trader);
    if (!overlay || !deal) return;
    selectedDeal = deal;
    overlay.querySelectorAll('.tsimm-watch-selected').forEach((element) => element.classList.remove('tsimm-watch-selected'));
    row.classList.add('tsimm-watch-selected');
    renderWatchDock();
  }

  function renderWatchDock() {
    const overlay = document.getElementById(A.deals);
    let dock = document.getElementById(A.dock);
    if (!overlay) {
      dock?.remove();
      selectedDeal = null;
      return;
    }
    const trader = reportTrader(normTraders());
    if (!trader) {
      dock?.remove();
      return;
    }
    if (!selectedDeal || selectedDeal.trader.id !== trader.id
      || !trader.items.some((item) => itemKey(item.id, item.name) === itemKey(selectedDeal.item.id, selectedDeal.item.name))) {
      const deal = dealFromRow(overlay.querySelector('.td-row'), trader);
      if (deal) selectedDeal = deal;
    }
    if (!dock) {
      dock = document.createElement('section');
      dock.id = A.dock;
      document.body.appendChild(dock);
    }
    if (!selectedDeal) {
      dock.innerHTML = '<div class="watch-copy"><small>WATCH TARGET</small><strong>TAP AN ITEM ROW</strong><span>Select an item to watch across favorite traders.</span></div><button type="button" disabled>☆ TRADER</button><button type="button" disabled>☆ ITEM</button>';
      return;
    }
    const favorite = isFavorite(favoriteStore(), selectedDeal.trader);
    const watched = isWatched(watchedStore(), selectedDeal.item);
    dock.innerHTML = `<div class="watch-copy"><small>ITEM-CENTRIC WATCH · ${esc(selectedDeal.trader.name)}</small><strong>${esc(selectedDeal.item.name)}</strong><span>This trader pays ${cash(selectedDeal.item.price)} · compare with every favorite</span></div><button type="button" class="${favorite ? 'on' : ''}" aria-pressed="${favorite}" data-watch-favorite-toggle>${favorite ? '★ TRADER' : '☆ TRADER'}</button><button type="button" class="${watched ? 'on' : ''}" data-watch-item-toggle>${watched ? '★ WATCHED' : '☆ WATCH'}</button>`;
    const selectedKey = itemKey(selectedDeal.item.id, selectedDeal.item.name);
    overlay.querySelectorAll('.td-row').forEach((row) => {
      const deal = dealFromRow(row, trader);
      row.classList.toggle('tsimm-watch-selected', Boolean(deal && itemKey(deal.item.id, deal.item.name) === selectedKey));
    });
  }

  function idFrom(value) {
    const text = String(value || '');
    for (const pattern of [/[?&#](?:itemID|itemId|item_id|ID|id)=(\d+)/i, /\bitem(?:ID)?[=:/_-](\d+)\b/i]) {
      const match = text.match(pattern);
      if (Number(match?.[1]) > 0) return Number(match[1]);
    }
    return null;
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function currentMarketItem() {
    if (!marketPage()) return null;
    const values = catalog();
    const urlId = idFrom(location.href);
    if (urlId && values.id[String(urlId)]) return values.id[String(urlId)];
    const selectors = 'h1,h2,h3,h4,[role="heading"],[class*="title"],[class*="name"],strong,span,div';
    for (const element of document.querySelectorAll(selectors)) {
      if (!visible(element) || element.closest(`#${A.deals},#${A.dock},#${A.panel},.tsimm-listing-mark`)) continue;
      const match = values.name[key(element.textContent)];
      if (match) return match;
    }
    const known = new Map();
    for (const trader of normTraders()) {
      for (const item of trader.items) known.set(item.n, item);
    }
    for (const element of document.querySelectorAll(selectors)) {
      if (!visible(element) || element.closest(`#${A.deals},#${A.dock},#${A.panel},.tsimm-listing-mark`)) continue;
      const match = known.get(key(element.textContent));
      if (match) return match;
    }
    return null;
  }

  function findTitleElement(itemName) {
    const wanted = key(itemName);
    const preferred = [];
    const fallback = [];
    const selectors = 'h1,h2,h3,h4,[role="heading"],[class*="title"],[class*="name"],strong,span,div';
    for (const element of document.querySelectorAll(selectors)) {
      if (!visible(element)
        || key(element.textContent) !== wanted
        || element.closest(`#${A.deals},#${A.dock},#${A.panel},.tsimm-listing-mark`)) continue;
      if (/^(H1|H2|H3|H4)$/i.test(element.tagName)
        || element.matches('[role="heading"],[class*="title"],[class*="name"]')) preferred.push(element);
      else fallback.push(element);
    }
    return preferred[0] || fallback[0] || null;
  }

  function statusForCapture(captured, settings) {
    const capturedTime = Date.parse(captured || '');
    if (!Number.isFinite(capturedTime)) return 'missing';
    const ageHours = Math.max(0, (Date.now() - capturedTime) / 3600000);
    if (ageHours <= settings.freshAgeHours) return 'fresh';
    if (ageHours <= settings.actionableAgeHours) return 'stale';
    return 'outdated';
  }

  function exitsForItem(item) {
    const traders = normTraders();
    const favorites = favoriteStore();
    const settings = { freshAgeHours: 72, actionableAgeHours: 168, ...read(A.overlaySettings, {}) };
    const exits = [];
    for (const trader of traders) {
      if (!isFavorite(favorites, trader)) continue;
      const priceItem = trader.items.find((candidate) =>
        (item.id && candidate.id === item.id) || candidate.n === key(item.name));
      if (!priceItem?.price) continue;
      exits.push({
        traderId: trader.id,
        traderName: trader.name,
        itemId: priceItem.id || item.id,
        itemName: priceItem.name || item.name,
        price: priceItem.price,
        captured: trader.captured,
        status: statusForCapture(trader.captured, settings),
      });
    }
    const rank = { fresh: 0, stale: 1, outdated: 2, missing: 3 };
    exits.sort((left, right) => {
      const statusDifference = rank[left.status] - rank[right.status];
      if (statusDifference) return statusDifference;
      const priceDifference = right.price - left.price;
      if (priceDifference) return priceDifference;
      return Date.parse(right.captured || '') - Date.parse(left.captured || '');
    });
    return exits;
  }

  function bestExit(exits) {
    return exits.find((entry) => entry.status === 'fresh')
      || exits.find((entry) => entry.status === 'stale')
      || exits.find((entry) => entry.status === 'outdated')
      || exits[0]
      || null;
  }

  function panelAnchor(itemName) {
    const title = findTitleElement(itemName);
    if (!title) return null;
    const closest = title.closest('[class*="header"],[class*="title"]');
    return closest && closest !== title ? closest : title.parentElement || title;
  }

  function renderWatchPanel(item, exits) {
    const anchor = panelAnchor(item.name);
    if (!anchor) return null;
    let panel = document.getElementById(A.panel);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = A.panel;
    }
    if (panel.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', panel);
    const watched = isWatched(watchedStore(), item);
    const favorites = favoriteStore().entries.length;
    const best = bestExit(exits);
    if (!watched) {
      panel.className = 'idle';
      panel.innerHTML = `<div class="watch-copy"><strong>☆ NOT WATCHED · ${esc(item.name)}</strong><span>Watch this item across your favorite traders.</span></div><button type="button" data-market-watch-toggle>+ WATCH</button>`;
      return panel;
    }
    if (!favorites) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>★ WATCHED · NO FAVORITE TRADERS</strong><span>Star traders in the Trader Book or Deals report.</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    if (!best) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>★ WATCHED · NO CAPTURED EXIT</strong><span>${favorites.toLocaleString()} favorite trader${favorites === 1 ? '' : 's'} · none currently list this item.</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    panel.className = best.status;
    if (best.status === 'fresh') {
      panel.innerHTML = `<div class="watch-copy"><strong>★ BEST EXIT · ${esc(best.traderName)} pays ${esc(cash(best.price))} · ${esc(ageText(best.captured))} old</strong><span>${exits.length.toLocaleString()} captured favorite${exits.length === 1 ? '' : 's'} · buy below ${esc(cash(best.price))}</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else if (best.status === 'stale') {
      panel.innerHTML = `<div class="watch-copy"><strong>⌛ WATCHED REFERENCE · ${esc(best.traderName)} paid ${esc(cash(best.price))}</strong><span>${esc(ageText(best.captured))} old · recapture before buying · no signal</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else {
      panel.innerHTML = `<div class="watch-copy"><strong>⚠ WATCHED PRICE OUTDATED · ${esc(best.traderName)}</strong><span>Last paid ${esc(cash(best.price))} · recapture before buying.</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    }
    return panel;
  }

  function ownText(element) {
    if (!(element instanceof Element)) return '';
    return clean([...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(' '));
  }

  function listingPrice(row) {
    const candidates = [...row.querySelectorAll('span,div,p,strong,b')]
      .filter((element) => !element.closest('[data-tsimm-watch-profit],.tsimm-margin-badge'));
    for (const element of candidates) {
      const text = ownText(element);
      if (!/^\$[\d,.]+$/.test(text)) continue;
      const value = Number(text.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  function signedEach(value) {
    const match = clean(value).match(/([+-])\s*\$([\d,.]+)\s*ea/i);
    if (!match) return null;
    const amount = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(amount)) return null;
    return match[1] === '-' ? -amount : amount;
  }

  function cleanupMarket() {
    document.querySelectorAll('.tsimm-watch-inline[data-tsimm-watch-original-html]').forEach((line) => {
      line.innerHTML = line.dataset.tsimmWatchOriginalHtml || '';
      line.classList.remove('tsimm-watch-inline');
      delete line.dataset.tsimmWatchOriginalHtml;
      line.closest('.tsimm-margin-badge')?.classList.remove('tsimm-watch-inline-badge');
    });
    document.querySelectorAll('[data-tsimm-watch-profit]').forEach((element) => element.remove());
    document.querySelectorAll('.tsimm-watch-profitable,.tsimm-watch-floor-row,.tsimm-watch-format-row').forEach((row) => {
      row.classList.remove('tsimm-watch-profitable', 'tsimm-watch-floor-row', 'tsimm-watch-format-row');
    });
  }

  function addProfitMarker(row, traderProfit, traderName = '') {
    const badge = row.querySelector('.tsimm-margin-badge');
    const immProfit = signedEach(badge?.textContent);
    const traderLabel = clean(traderName).slice(0, 14) || 'trader';
    let label = '';
    let flip = false;
    if (Number.isFinite(immProfit) && immProfit < 0) {
      label = `📌 ${traderLabel} FLIP +${cash(traderProfit)}`;
      flip = true;
    } else if (Number.isFinite(immProfit)) {
      const extra = traderProfit - immProfit;
      if (extra <= 0) return false;
      label = `📌 ${traderLabel} +${cash(extra)} better`;
    } else {
      label = `📌 ${traderLabel} +${cash(traderProfit)}`;
    }
    const badgeLines = badge ? [...badge.querySelectorAll('span')] : [];
    const inlineLine = badgeLines.at(-1) || null;
    if (inlineLine) {
      inlineLine.dataset.tsimmWatchOriginalHtml = inlineLine.innerHTML;
      inlineLine.textContent = label;
      inlineLine.classList.add('tsimm-watch-inline');
      badge.classList.add('tsimm-watch-inline-badge');
      row.classList.add('tsimm-watch-profitable');
      return true;
    }
    const marker = document.createElement('span');
    marker.className = `tsimm-watch-profit${flip ? ' flip' : ''}`;
    marker.dataset.tsimmWatchProfit = '1';
    marker.textContent = label;
    row.appendChild(marker);
    row.classList.add('tsimm-watch-format-row', 'tsimm-watch-profitable');
    return true;
  }

  function decorateMarket() {
    cleanupMarket();
    if (!marketPage()) {
      document.getElementById(A.panel)?.remove();
      return;
    }
    const item = currentMarketItem();
    if (!item) {
      document.getElementById(A.panel)?.remove();
      return;
    }
    const watched = isWatched(watchedStore(), item);
    const exits = watched ? exitsForItem(item) : [];
    const best = bestExit(exits);
    renderWatchPanel(item, exits);
    if (!watched || !best || best.status !== 'fresh') return;
    const rows = [...document.querySelectorAll('.tsimm-listing-mark')];
    let sawProfit = false;
    let floorPlaced = false;
    for (const row of rows) {
      const price = listingPrice(row);
      const traderProfit = price > 0 ? best.price - price : 0;
      if (traderProfit > 0) {
        sawProfit = true;
        addProfitMarker(row, traderProfit, best.traderName);
      } else if (sawProfit && !floorPlaced && price > 0) {
        row.classList.add('tsimm-watch-floor-row');
        floorPlaced = true;
      }
    }
  }

  function cardTrader(card, traders) {
    const id = clean(card.querySelector('[data-tsimm-trader-id]')?.dataset?.tsimmTraderId);
    if (id) {
      const trader = traders.find((candidate) => candidate.id === id);
      if (trader) return trader;
    }
    const uid = Number((card.querySelector('a[href*="profiles.php?XID="]')?.href || '').match(/[?&]XID=(\d+)/)?.[1]);
    if (uid) {
      const trader = traders.find((candidate) => candidate.uid === uid);
      if (trader) return trader;
    }
    const name = key(card.querySelector('.tsimm-trader-banner-label strong,.tsimm-trader-profile-button strong')?.textContent);
    return traders.find((candidate) => candidate.n === name) || null;
  }

  function decorateBook() {
    const book = document.getElementById('tornscripture-imm-traders');
    if (!book) return;
    const traders = normTraders();
    const favorites = favoriteStore();
    for (const card of book.querySelectorAll('.tsimm-trader-card')) {
      const trader = cardTrader(card, traders);
      let button = card.querySelector('[data-watch-favorite-book]');
      if (!trader) {
        button?.remove();
        continue;
      }
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.watchFavoriteBook = '1';
        button.className = 'tsimm-favorite-trader-btn';
        const actions = card.querySelector('.tsimm-trader-actions') || card;
        actions.prepend(button);
      }
      const favorite = isFavorite(favorites, trader);
      applyFavoriteButtonState(button, favorite, 'book');
      button.dataset.trader = trader.id;
    }
  }

  function scheduleTorn() {
    clearTimeout(tornTimer);
    tornTimer = setTimeout(() => {
      ownMutation = true;
      for (const [name, task] of [
        ['style', injectStyle],
        ['book', decorateBook],
        ['dock', renderWatchDock],
        ['market', decorateMarket],
      ]) {
        try {
          task();
        } catch (error) {
          console.error(`[IMM Trader Extensions] ${name} update failed:`, error);
        }
      }
      setTimeout(() => { ownMutation = false; }, 0);
    }, 100);
  }

  function boot() {
    migrateLegacyTracking();
    const start = () => {
      if (!document.body) return setTimeout(start, 60);
      injectStyle();
      document.addEventListener('click', (event) => {
        const opener = event.target.closest?.('[data-tsimm-deals-open]');
        if (opener?.dataset?.tsimmTraderId) {
          activeTrader = opener.dataset.tsimmTraderId;
          selectedDeal = null;
          setTimeout(scheduleTorn, 0);
        }
        const rowButton = event.target.closest?.('.td-row-toggle');
        if (rowButton) {
          const row = rowButton.closest('.td-row');
          if (row) selectDeal(row);
        }
        const favoriteDock = event.target.closest?.('[data-watch-favorite-toggle]');
        if (favoriteDock && selectedDeal) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const added = toggleFavorite(selectedDeal.trader);
          applyFavoriteButtonState(favoriteDock, added, 'dock');
          showFavoriteToast(`${added ? 'Added' : 'Removed'} ${selectedDeal.trader.name} ${added ? 'to' : 'from'} favorites`);
          return;
        }
        const itemDock = event.target.closest?.('[data-watch-item-toggle]');
        if (itemDock && selectedDeal) {
          event.preventDefault();
          event.stopImmediatePropagation();
          toggleWatched(selectedDeal.item, 'deals');
          return;
        }
        const favoriteBook = event.target.closest?.('[data-watch-favorite-book]');
        if (favoriteBook) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const trader = normTraders().find((candidate) => candidate.id === clean(favoriteBook.dataset.trader));
          if (trader) {
            const added = toggleFavorite(trader);
            applyFavoriteButtonState(favoriteBook, added, 'book');
            showFavoriteToast(`${added ? 'Added' : 'Removed'} ${trader.name} ${added ? 'to' : 'from'} favorites`);
          }
          return;
        }
        const marketWatch = event.target.closest?.('[data-market-watch-toggle]');
        if (marketWatch) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const item = currentMarketItem();
          if (item) toggleWatched(item, 'market');
        }
      }, true);
      new MutationObserver(() => {
        if (!ownMutation) scheduleTorn();
      }).observe(document.body, { childList: true, subtree: true });
      window.addEventListener('tsimm:watchlists-updated', scheduleTorn);
      setInterval(scheduleTorn, 1500);
      scheduleTorn();
    };
    start();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();
})();
  }

})();
