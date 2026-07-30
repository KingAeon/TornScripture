// ==UserScript==
// @name         TornScripture - Item Market Margin
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.19.17
// @description  Item-market and overseas profit overlays with Quick MAX, single-item trader exits, curated watchlists, market-velocity learning, compact tap-expandable Priced Trade badges with reliable Qty-adjacent MAX filling and a compact header, classified trader controls, trader capture, Trade Exit Audit, purchase history, cross-channel purchase dedupe, reversible duplicate-ledger cleanup, capital-source lot tracking, and receipt audits.
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
    window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.19.17' });
    window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.19.17' });
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
        disposition: 'normal',
        hiddenFromDisposition: 'normal',
        avoidReasons: [],
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
        traderId: traders[index].id,
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
   * TORNSCRIPTURE - ITEM MARKET MARGIN v0.19.17
   *
   * SAFETY BOUNDARY
   * - Reads item names, lowest prices, market values, NPC store buyback values, visible listing rows, price pages, and trade manifests.
   * - Torn catalog values are requested only when the user presses Sync values.
   * - The API key, catalog cache, pending purchase, purchase lots, sale history, trader book, favorite traders, watched items, and receipt audits remain in this browser's local storage.
   * - The key is sent only to Torn's official API.
   * - Normal purchase capture begins after the user presses Torn's confirmation button.
   * - Quick MAX can fill Torn's native quantity field; Override MAX can submit only after the user session-arms it and presses IMM's generated MAX button.
   * - Completed trade sales only update local lot quantities; receipt audits are read-only and never alter sale quantities or costs.
   * - Trade Exit Audit comparisons are read-only. Bulk removal runs only after the user presses its button and confirms; it uses Torn's visible item-removal controls and never accepts or completes a trade.
   * - Priced Trade stores an expiring trader handoff, verifies the live counterparty, adds one persistent full-stack payout badge per visible item row, and provides an explicit MAX button beside Torn's native quantity field. It never presses Add to Trade or completes a trade.
   * - Outside an explicitly armed Override MAX action, the script never submits purchases, lists items, sells items, or completes trades.
   */

  const APP = Object.freeze({
    name: 'Item Market Margin',
    shortName: 'IMM',
    brandName: 'GOBLIN GOD',
    brandSubtitle: 'IMM engine',
    version: '0.19.17',
    panelId: 'tornscripture-imm-panel',
    styleId: 'tornscripture-imm-style',
    badgeClass: 'tsimm-margin-badge',
    quickMaxButtonClass: 'tsimm-quick-max',
    quickMaxRowClass: 'tsimm-quick-max-row',
    categoryMark: 'tsimm-category-mark',
    listingMark: 'tsimm-listing-mark',
    overseasMark: 'tsimm-overseas-mark',
    tradeItemMark: 'tsimm-trade-item-mark',
    tradeBadgeClass: 'tsimm-trade-item-badge',
    ledgerOverlayId: 'tornscripture-imm-ledger',
    ledgerReconcileStyleId: 'tornscripture-imm-ledger-reconcile-style',
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
    ledgerCleanupBackupStorageKey: 'tornscripture-imm-ledger-cleanup-backup-v1',
    inventoryStorageKey: 'tornscripture-imm-inventory-v1',
    inventoryBaselineStorageKey: 'tornscripture-imm-inventory-baseline-v1',
    sellPriorityStorageKey: 'tornscripture-imm-sell-priority-v1',
    apiKeyProfileStorageKey: 'tornscripture-imm-api-key-profile-v1',
    inventoryReconcileIntentStorageKey: 'tornscripture-imm-inventory-reconcile-intent-v1',
    tradersStorageKey: 'tornscripture-imm-traders-v1',
    traderViewStorageKey: 'tornscripture-imm-trader-view-v1',
    pendingTraderCaptureStorageKey: 'tornscripture-imm-pending-trader-capture-v1',
    priceRecaptureSessionKey: 'tornscripture-imm-price-recapture-v1',
    favoriteRecaptureCarouselSessionKey: 'tornscripture-imm-favorite-recapture-carousel-v1',
    traderRecaptureResultStorageKey: 'tornscripture-imm-trader-recapture-result-v1',
    priceBridgeWindowNamePrefix: 'TSIMM_PRICE_BRIDGE:',
    priceImportQueryKey: 'tsimmPriceImport',
    pendingPurchaseStorageKey: 'tornscripture-imm-pending-purchase-v1',
    pendingTradeSaleStorageKey: 'tornscripture-imm-pending-trade-sale-v1',
    recentPurchaseFingerprintsStorageKey: 'tornscripture-imm-recent-purchase-fingerprints-v1',
    purchasePrivacyMigrationStorageKey: 'tornscripture-imm-purchase-privacy-v1',
    catalogUrl: 'https://api.torn.com/v2/torn/items',
    inventoryUrl: 'https://api.torn.com/v2/user/inventory',
    inventoryItemMarketUrl: 'https://api.torn.com/v2/user/itemmarket',
    keyInfoUrl: 'https://api.torn.com/v2/key/info',
    keyBuilderUrl: 'https://www.torn.com/api.html',
    inventoryPageUrl: 'https://www.torn.com/item.php',
    fastScanDelayMs: 35,
    settleScanDelayMs: 520,
    minimumScanIntervalMs: 90,
    catalogMaxAgeMs: 24 * 60 * 60 * 1000,
    pendingPurchaseMaxAgeMs: 30 * 60 * 1000,
    pendingTradeSaleMaxAgeMs: 2 * 60 * 60 * 1000,
    duplicatePurchaseWindowMs: 2 * 60 * 1000,
    traderCaptureMaxAgeMs: 60 * 60 * 1000,
    inventoryCacheMaxAgeMs: 2 * 60 * 60 * 1000,
  });

  const PDA_API_KEY = '###PDA-APIKEY###';
  const TRADER_PERCENT = 99;
  const INVENTORY_API_CATEGORIES = Object.freeze([
    'Collectible', 'Clothing', 'Other', 'Tool', 'Melee', 'Defensive', 'Material', 'Car',
    'Primary', 'Secondary', 'Book', 'Special', 'Supply Pack', 'Temporary', 'Enhancer',
    'Artifact', 'Flower', 'Booster', 'Medical', 'Candy', 'Jewelry', 'Alcohol', 'Plushie',
    'Drug', 'Energy Drink',
  ]);

  const DEFAULT_SETTINGS = Object.freeze({
    collapsed: false,
    minimumProfitEach: 100,
    goldMinimumProfitEach: 1000,
    minimumRoiPercent: 0.25,
    itemTraderQuoteLimit: 3,
    showLossesDuringTesting: true,
    tradeSidePreference: 'auto',
    showTradeItemBreakdown: true,
    showTradeExitAudit: true,
    tradeExitShowAllItems: false,
    tradeExitMinimumSwitchGain: 0,
    showClosedLedgerLots: true,
    ledgerShowSoldPurchases: true,
    ledgerDefaultFundingSource: 'personal',
    overseasLoadLimit: 21,
    sellPrioritySuggestBelowTotalValue: 5000,
  });

  const TRADER_DISPOSITIONS = Object.freeze(['normal', 'avoid', 'hidden']);
  const TRADER_REASON_LABELS = Object.freeze({
    prices: 'Poor prices',
    reputation: 'Reputation',
    reliability: 'Unreliable',
    availability: 'Frequently unavailable',
    vibe: 'Bad vibe',
    other: 'Other',
  });

  const LEDGER_FUNDING_SOURCES = Object.freeze(['unassigned', 'personal', 'butcher', 'shared', 'other']);
  const LEDGER_FUNDING_LABELS = Object.freeze({
    unassigned: 'Unassigned',
    personal: 'Personal',
    butcher: 'Butcher',
    shared: 'Shared',
    other: 'Other',
  });

  function normalizeLedgerFundingSource(value, fallback = 'unassigned') {
    const raw = normalizeName(value);
    if (!raw) return fallback;
    const aliases = {
      me: 'personal',
      mine: 'personal',
      self: 'personal',
      personal: 'personal',
      butcher: 'butcher',
      butchers: 'butcher',
      backer: 'butcher',
      bankroll: 'butcher',
      shared: 'shared',
      mixed: 'shared',
      joint: 'shared',
      other: 'other',
      unassigned: 'unassigned',
      unknown: 'unassigned',
      none: 'unassigned',
    };
    const normalized = aliases[raw] || raw;
    return LEDGER_FUNDING_SOURCES.includes(normalized) ? normalized : fallback;
  }

  function ledgerFundingSourceLabel(value) {
    return LEDGER_FUNDING_LABELS[normalizeLedgerFundingSource(value)] || LEDGER_FUNDING_LABELS.unassigned;
  }

  function ledgerFundingSourceOptions(selected, includeAll = false) {
    const active = includeAll && selected === 'all' ? 'all' : normalizeLedgerFundingSource(selected);
    const keys = includeAll ? ['all', ...LEDGER_FUNDING_SOURCES] : [...LEDGER_FUNDING_SOURCES];
    return keys.map((key) => {
      const label = key === 'all' ? 'All funding' : LEDGER_FUNDING_LABELS[key];
      return `<option value="${key}" ${active === key ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  const state = {
    settings: { ...structuredCloneSafe(DEFAULT_SETTINGS), ...loadJson(APP.settingsStorageKey, DEFAULT_SETTINGS) },
    catalog: mergeCatalogCaches(),
    ledger: normalizeLedger(loadJson(APP.ledgerStorageKey, {})),
    inventory: normalizeInventoryCache(loadJson(APP.inventoryStorageKey, {})),
    inventoryBaseline: normalizeInventoryBaseline(loadJson(APP.inventoryBaselineStorageKey, {})),
    sellPriority: normalizeSellPriority(loadJson(APP.sellPriorityStorageKey, {})),
    keyProfile: normalizeApiKeyProfile(loadJson(APP.apiKeyProfileStorageKey, {})),
    traders: normalizeTraders(loadJson(APP.tradersStorageKey, [])),
    showHiddenTraders: Boolean(loadJson(APP.traderViewStorageKey, {})?.showHidden),
    pendingTraderCapture: normalizePendingTraderCapture(loadJson(APP.pendingTraderCaptureStorageKey, null)),
    pendingPurchase: normalizePendingPurchase(loadJson(APP.pendingPurchaseStorageKey, null)),
    purchaseSignals: [],
    quickMaxOverrideArmed: false,
    quickMaxBusy: false,
    quickMaxLastActionAt: 0,
    tradeExitRemoveBusy: false,
    recentPurchaseFingerprints: loadJson(APP.recentPurchaseFingerprintsStorageKey, []),
    lastScan: emptyScanStats(),
    syncing: false,
    inventorySyncing: false,
    keyChecking: false,
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
      fundingFilter: 'all',
    },
  };
  state.ledgerUi.showSold = state.settings.ledgerShowSoldPurchases !== false;
  state.settings.ledgerDefaultFundingSource = normalizeLedgerFundingSource(
    state.settings.ledgerDefaultFundingSource,
    'personal',
  );

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


  function normalizeTraderDisposition(value) {
    const normalized = normalizeWhitespace(value).toLowerCase();
    return TRADER_DISPOSITIONS.includes(normalized) ? normalized : 'normal';
  }

  function normalizeTraderReasons(value) {
    const source = Array.isArray(value)
      ? value
      : normalizeWhitespace(value).split(/[,;|/]+/g);
    const aliases = {
      price: 'prices', prices: 'prices', pricing: 'prices', 'poor price': 'prices', 'poor prices': 'prices',
      rep: 'reputation', reputation: 'reputation', scam: 'reputation', scammer: 'reputation',
      reliable: 'reliability', reliability: 'reliability', unreliable: 'reliability', flaky: 'reliability',
      availability: 'availability', unavailable: 'availability', closed: 'availability', 'frequently unavailable': 'availability',
      vibe: 'vibe', vibes: 'vibe', 'bad vibe': 'vibe', attitude: 'vibe', interaction: 'vibe',
      other: 'other',
    };
    const unique = [];
    for (const raw of source) {
      const cleaned = normalizeWhitespace(raw).toLowerCase();
      if (!cleaned) continue;
      const canonical = aliases[cleaned] || (Object.prototype.hasOwnProperty.call(TRADER_REASON_LABELS, cleaned) ? cleaned : 'other');
      if (!unique.includes(canonical)) unique.push(canonical);
    }
    return unique;
  }

  function traderReasonLabels(trader) {
    return normalizeTraderReasons(trader?.avoidReasons)
      .map((reason) => TRADER_REASON_LABELS[reason] || TRADER_REASON_LABELS.other);
  }

  function traderRecommendationsEligible(trader) {
    return normalizeTraderDisposition(trader?.disposition) === 'normal';
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
    const legacyDisposition = candidate.hidden ? 'hidden' : candidate.avoid ? 'avoid' : 'normal';
    const disposition = normalizeTraderDisposition(candidate.disposition ?? candidate.traderStatus ?? legacyDisposition);
    const hiddenFromDisposition = normalizeTraderDisposition(candidate.hiddenFromDisposition) === 'avoid' ? 'avoid' : 'normal';
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
      disposition,
      hiddenFromDisposition,
      avoidReasons: normalizeTraderReasons(candidate.avoidReasons ?? candidate.traderReasons ?? candidate.reasons),
      dispositionUpdatedAt: candidate.dispositionUpdatedAt || null,
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
    const dispositionOrder = { normal: 0, avoid: 1, hidden: 2 };
    return [...unique.values()].sort((a, b) =>
      Number(dispositionOrder[a.disposition] ?? 0) - Number(dispositionOrder[b.disposition] ?? 0)
      || Number(b.rating || 0) - Number(a.rating || 0)
      || a.name.localeCompare(b.name)
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
        <strong>🧌 ${escapeHtml(APP.brandName)}</strong>
        <small>${escapeHtml(APP.brandSubtitle)} v${escapeHtml(APP.version)} · TornW3B pricelist</small>
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


  function normalizeApiKeyProfile(raw) {
    const endpoint = (candidate) => ({
      ok: candidate?.ok === true,
      checked: candidate?.checked === true,
      message: normalizeWhitespace(candidate?.message),
      count: Math.max(0, Math.floor(Number(candidate?.count) || 0)),
    });
    return {
      schema: 'tornscripture-imm-api-key-profile',
      schemaVersion: 1,
      checkedAt: raw?.checkedAt || null,
      accessType: normalizeWhitespace(raw?.accessType),
      accessLevel: optionalFiniteNumber(raw?.accessLevel),
      userId: Math.max(0, Math.floor(Number(raw?.userId) || 0)) || null,
      lastError: normalizeWhitespace(raw?.lastError),
      endpoints: {
        keyInfo: endpoint(raw?.endpoints?.keyInfo),
        inventory: endpoint(raw?.endpoints?.inventory),
        itemmarket: endpoint(raw?.endpoints?.itemmarket),
        catalog: endpoint(raw?.endpoints?.catalog),
      },
    };
  }

  function saveApiKeyProfile() {
    state.keyProfile = normalizeApiKeyProfile(state.keyProfile);
    saveJson(APP.apiKeyProfileStorageKey, state.keyProfile);
  }

  function clearApiKeyProfile() {
    state.keyProfile = normalizeApiKeyProfile({});
    saveApiKeyProfile();
    renderLedger();
    renderPanel();
  }

  function apiProbeCount(payload, kind) {
    if (!payload || typeof payload !== 'object') return 0;
    if (kind === 'inventory') {
      const root = payload.inventory ?? payload.items ?? payload.data?.inventory;
      return Array.isArray(root) ? root.length : inventoryEntriesFromPayload(payload, 'inventory').length;
    }
    if (kind === 'itemmarket') {
      const root = payload.itemmarket ?? payload.listings ?? payload.data?.itemmarket;
      return Array.isArray(root) ? root.length : inventoryEntriesFromPayload(payload, 'itemmarket').length;
    }
    if (kind === 'catalog') {
      const root = payload.items ?? payload.data?.items;
      return Array.isArray(root) ? root.length : 0;
    }
    return 1;
  }

  async function probeGoblinGodEndpoint(urlValue, kind, key) {
    if (kind === 'inventory') {
      const result = await fetchInventoryWithFallback(key, { probeOnly: true });
      return {
        inventory: result.items,
        _tsimmInventoryMode: result.mode,
        _tsimmInventoryCategories: result.categoriesFetched,
      };
    }

    const url = new URL(urlValue);
    url.searchParams.set('comment', 'TornScripture GOBLIN GOD key check');
    const response = await fetch(url.href, {
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
      throw new Error(`${kind} returned unreadable data (${response.status}).`);
    }
    if (!response.ok || payload?.error) throw new Error(apiErrorMessage(payload, response));
    return payload;
  }

  function apiEndpointStatusHtml(name, label) {
    const status = state.keyProfile?.endpoints?.[name] || {};
    const icon = !status.checked ? '…' : status.ok ? '✓' : '✕';
    const className = !status.checked ? 'unknown' : status.ok ? 'good' : 'bad';
    const detail = status.message || (status.ok ? 'available' : 'not checked');
    return `<div class="tsimm-key-endpoint ${className}"><strong>${icon} ${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></div>`;
  }

  function apiKeyProfileHtml(compact = false) {
    const profile = state.keyProfile || normalizeApiKeyProfile({});
    const checked = profile.checkedAt ? relativeAge(profile.checkedAt) : 'never';
    const type = profile.accessType || (profile.accessLevel !== null ? `level ${profile.accessLevel}` : 'unknown');
    return `
      <section class="tsimm-key-profile ${compact ? 'compact' : ''}">
        <div class="tsimm-key-profile-head">
          <div><strong>🔑 GOBLIN GOD KEY</strong><span>${escapeHtml(type)} · checked ${escapeHtml(checked)}</span></div>
          <b>${state.keyChecking ? 'CHECKING…' : (profile.endpoints.inventory.ok ? 'READY' : 'SETUP')}</b>
        </div>
        <div class="tsimm-key-endpoints">
          ${apiEndpointStatusHtml('keyInfo', 'Key identity')}
          ${apiEndpointStatusHtml('inventory', 'Your inventory')}
          ${apiEndpointStatusHtml('itemmarket', 'Your listings')}
          ${apiEndpointStatusHtml('catalog', 'Torn item catalog')}
        </div>
        ${compact ? '' : `<div class="tsimm-key-guide">Create one custom key named <strong>GOBLIN GOD</strong> with <strong>user → inventory</strong>, <strong>user → itemmarket</strong>, and <strong>torn → items</strong>. Paste it only inside TornPDA. It is stored locally and sent only to Torn's official API.</div>`}
        <div class="tsimm-key-actions">
          <button type="button" data-tsimm-action="api-key-builder">Open Torn key builder</button>
          <button type="button" data-tsimm-action="api-key-set">Paste / replace key</button>
          <button type="button" data-tsimm-action="api-key-check" ${state.keyChecking ? 'disabled' : ''}>${state.keyChecking ? 'Checking…' : 'Check permissions'}</button>
        </div>
        ${profile.lastError ? `<small class="tsimm-key-error">${escapeHtml(profile.lastError)}</small>` : ''}
      </section>
    `;
  }

  async function inspectGoblinGodKey({ syncAfter = false } = {}) {
    if (state.keyChecking) return false;
    const key = currentApiKey();
    if (!key) {
      toast('Paste the dedicated GOBLIN GOD API key first.');
      setApiKey();
      clearApiKeyProfile();
      return false;
    }

    state.keyChecking = true;
    renderLedger();
    renderPanel();
    const endpoints = {};
    let keyInfoPayload = null;
    let lastError = '';
    const probes = [
      ['keyInfo', 'Key identity', APP.keyInfoUrl, 'keyInfo'],
      ['inventory', 'Inventory', APP.inventoryUrl, 'inventory'],
      ['itemmarket', 'Item Market listings', APP.inventoryItemMarketUrl, 'itemmarket'],
      ['catalog', 'Torn item catalog', APP.catalogUrl, 'catalog'],
    ];

    try {
      for (const [name, label, url, kind] of probes) {
        try {
          const payload = await probeGoblinGodEndpoint(url, kind, key);
          if (name === 'keyInfo') keyInfoPayload = payload;
          endpoints[name] = {
            ok: true,
            checked: true,
            count: apiProbeCount(payload, kind),
            message: name === 'keyInfo'
              ? 'valid key'
              : name === 'inventory' && payload?._tsimmInventoryMode === 'category-fallback'
                ? 'selection available via category fallback'
                : 'selection available',
          };
        } catch (error) {
          const message = normalizeWhitespace(error?.message || `${label} unavailable`);
          endpoints[name] = { ok: false, checked: true, count: 0, message };
          lastError ||= `${label}: ${message}`;
        }
      }

      const access = keyInfoPayload?.access ?? keyInfoPayload?.info?.access ?? {};
      const user = keyInfoPayload?.user ?? keyInfoPayload?.info?.user ?? {};
      state.keyProfile = normalizeApiKeyProfile({
        checkedAt: new Date().toISOString(),
        accessType: access.type ?? access.name,
        accessLevel: access.level,
        userId: user.id ?? user.user_id,
        lastError,
        endpoints,
      });
      saveApiKeyProfile();
      const ready = endpoints.inventory?.ok && endpoints.itemmarket?.ok && endpoints.catalog?.ok;
      toast(ready
        ? 'GOBLIN GOD key verified. Inventory, listings, and item catalog are available.'
        : `Key checked. ${lastError || 'One or more required selections are unavailable.'}`);
    } finally {
      state.keyChecking = false;
      renderLedger();
      renderPanel();
    }

    if (syncAfter && state.keyProfile.endpoints.inventory.ok) {
      await syncInventorySnapshot({ skipKeyCheck: true });
    }
    return state.keyProfile.endpoints.inventory.ok;
  }

  function openGoblinGodKeyBuilder() {
    const opened = window.open(APP.keyBuilderUrl, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.assign(APP.keyBuilderUrl);
  }

  function configureGoblinGodKey() {
    setApiKey();
    clearApiKeyProfile();
    if (currentApiKey()) setTimeout(() => inspectGoblinGodKey(), 80);
  }

  function pageLooksLikeInventory() {
    const href = String(location.href || '').toLowerCase();
    if (href.includes('itemmarket') || href.includes('item-market') || href.includes('imarket')) return false;
    if (href.includes('/item.php') || href.includes('sid=items') || href.includes('inventory')) return true;
    const heading = normalizeWhitespace(document.querySelector('h1,h2,[role="heading"]')?.textContent);
    return /^(?:items|inventory)$/i.test(heading);
  }

  function showInventoryReconciliation() {
    openLedger();
    state.ledgerUi.view = 'reconcile';
    state.ledgerUi.search = '';
    renderLedger();
  }

  function openInventoryAndReconcile() {
    if (pageLooksLikeInventory()) {
      showInventoryReconciliation();
      return;
    }
    try { sessionStorage.setItem(APP.inventoryReconcileIntentStorageKey, '1'); } catch {}
    window.location.assign(APP.inventoryPageUrl);
  }

  function maybeOpenInventoryReconcileIntent() {
    if (!pageLooksLikeInventory()) return false;
    let requested = false;
    try {
      requested = sessionStorage.getItem(APP.inventoryReconcileIntentStorageKey) === '1';
      if (requested) sessionStorage.removeItem(APP.inventoryReconcileIntentStorageKey);
    } catch {}
    if (!requested) return false;
    setTimeout(showInventoryReconciliation, 60);
    return true;
  }

  function inventoryKey(candidate) {
    const id = Number(candidate?.itemId ?? candidate?.id);
    if (id > 0) return `id:${id}`;
    const name = normalizeName(candidate?.itemName ?? candidate?.name);
    return name ? `name:${name}` : '';
  }

  function inventoryEntry(candidate, source = 'inventory') {
    if (!candidate || typeof candidate !== 'object') return null;
    const nested = candidate.item && typeof candidate.item === 'object' ? candidate.item : {};
    const itemId = Number(
      candidate.itemId ?? candidate.item_id ?? candidate.itemID
      ?? nested.id ?? nested.itemId ?? candidate.id
    ) > 0
      ? Number(candidate.itemId ?? candidate.item_id ?? candidate.itemID ?? nested.id ?? nested.itemId ?? candidate.id)
      : null;
    const catalog = itemId ? state?.catalog?.itemsById?.[String(itemId)] : null;
    const itemName = normalizeWhitespace(
      candidate.itemName ?? candidate.item_name ?? candidate.name
      ?? nested.name ?? nested.itemName ?? catalog?.name
    );
    const quantity = Math.max(0, Math.floor(Number(
      candidate.quantity ?? candidate.qty ?? candidate.amount ?? candidate.stock
      ?? candidate.available ?? candidate.count ?? candidate.owned
      ?? nested.quantity ?? nested.amount
    ) || 0));
    if ((!itemId && !itemName) || quantity <= 0) return null;
    return {
      itemId,
      itemName: catalog?.name || itemName || `Item ${itemId}`,
      onHandQuantity: source === 'itemmarket' ? 0 : quantity,
      listedQuantity: source === 'itemmarket' ? quantity : 0,
    };
  }

  function mergeInventory(target, candidate) {
    const key = inventoryKey(candidate);
    if (!key) return;
    const existing = target.get(key) || {
      itemId: candidate.itemId || null,
      itemName: candidate.itemName,
      onHandQuantity: 0,
      listedQuantity: 0,
    };
    existing.itemId ||= candidate.itemId || null;
    existing.itemName ||= candidate.itemName;
    existing.onHandQuantity += Number(candidate.onHandQuantity || 0);
    existing.listedQuantity += Number(candidate.listedQuantity || 0);
    existing.totalQuantity = existing.onHandQuantity + existing.listedQuantity;
    target.set(key, existing);
  }

  function inventoryEntriesFromPayload(payload, source) {
    const found = new Map();
    const queue = [{ value: payload, depth: 0 }];
    const visited = new Set();
    while (queue.length) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object' || visited.has(value) || depth > 8) continue;
      visited.add(value);
      if (Array.isArray(value)) {
        value.forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
        continue;
      }
      const entry = inventoryEntry(value, source);
      if (entry) mergeInventory(found, entry);
      for (const [key, child] of Object.entries(value)) {
        if (!child || typeof child !== 'object' || /metadata|links|pagination/i.test(key)) continue;
        if (entry && /^(?:item|itemDetails|item_details|bonuses)$/i.test(key)) continue;
        queue.push({ value: child, depth: depth + 1 });
      }
    }
    return [...found.values()];
  }

  function normalizeInventoryCache(raw) {
    const found = new Map();
    for (const item of Array.isArray(raw?.items) ? raw.items : []) {
      const itemId = Number(item?.itemId) > 0 ? Number(item.itemId) : null;
      const itemName = normalizeWhitespace(item?.itemName ?? item?.name) || (itemId ? `Item ${itemId}` : '');
      const onHandQuantity = Math.max(0, Math.floor(Number(item?.onHandQuantity ?? item?.quantity) || 0));
      const listedQuantity = Math.max(0, Math.floor(Number(item?.listedQuantity) || 0));
      if ((!itemId && !itemName) || onHandQuantity + listedQuantity <= 0) continue;
      mergeInventory(found, { itemId, itemName, onHandQuantity, listedQuantity });
    }
    return {
      schema: 'tornscripture-imm-inventory',
      schemaVersion: 1,
      capturedAt: raw?.capturedAt || null,
      items: [...found.values()],
      itemMarketIncluded: Boolean(raw?.itemMarketIncluded),
      itemMarketError: normalizeWhitespace(raw?.itemMarketError),
      captureMode: normalizeWhitespace(raw?.captureMode),
      categoriesFetched: Array.isArray(raw?.categoriesFetched)
        ? raw.categoriesFetched.map(normalizeWhitespace).filter(Boolean)
        : [],
      categoryErrors: Array.isArray(raw?.categoryErrors)
        ? raw.categoryErrors.map(normalizeWhitespace).filter(Boolean)
        : [],
    };
  }

  function normalizeInventoryBaseline(raw) {
    const found = new Map();
    for (const item of Array.isArray(raw?.items) ? raw.items : []) {
      const itemId = Number(item?.itemId) > 0 ? Number(item.itemId) : null;
      const itemName = normalizeWhitespace(item?.itemName ?? item?.name) || (itemId ? `Item ${itemId}` : '');
      const quantity = Math.max(0, Math.floor(Number(item?.quantity ?? item?.totalQuantity) || 0));
      const key = itemId ? `id:${itemId}` : itemName ? `name:${normalizeName(itemName)}` : '';
      if (!key || quantity <= 0) continue;
      const existing = found.get(key) || { itemId, itemName, quantity: 0 };
      existing.itemId ||= itemId;
      existing.itemName ||= itemName;
      existing.quantity += quantity;
      found.set(key, existing);
    }
    return {
      schema: 'tornscripture-imm-inventory-baseline',
      schemaVersion: 1,
      capturedAt: raw?.capturedAt || null,
      sourceInventoryCapturedAt: raw?.sourceInventoryCapturedAt || null,
      items: [...found.values()],
    };
  }

  function saveInventoryBaseline() {
    state.inventoryBaseline = normalizeInventoryBaseline(state.inventoryBaseline);
    saveJson(APP.inventoryBaselineStorageKey, state.inventoryBaseline);
  }

  function baselineHoldingMap() {
    const found = new Map();
    for (const item of state.inventoryBaseline?.items || []) {
      const key = inventoryKey(item);
      if (!key) continue;
      found.set(key, {
        key,
        itemId: Number(item.itemId) > 0 ? Number(item.itemId) : null,
        itemName: item.itemName,
        baselineQuantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
      });
    }
    return found;
  }

  function normalizeSellPriority(raw) {
    const items = {};
    const source = raw?.items && typeof raw.items === 'object' ? raw.items : {};
    const entries = Array.isArray(source)
      ? source.map((entry) => [normalizeWhitespace(entry?.key), entry])
      : Object.entries(source);
    for (const [rawKey, candidate] of entries) {
      const status = ['always', 'hide'].includes(normalizeWhitespace(candidate?.status))
        ? normalizeWhitespace(candidate.status)
        : 'normal';
      if (status === 'normal') continue;
      const itemId = Number(candidate?.itemId) > 0 ? Number(candidate.itemId) : null;
      const itemName = normalizeWhitespace(candidate?.itemName ?? candidate?.name);
      const key = normalizeWhitespace(rawKey) || (itemId ? `id:${itemId}` : itemName ? `name:${normalizeName(itemName)}` : '');
      if (!key) continue;
      items[key] = {
        key,
        itemId,
        itemName,
        status,
        updatedAt: candidate?.updatedAt || new Date().toISOString(),
      };
    }
    return {
      schema: 'tornscripture-imm-sell-priority',
      schemaVersion: 1,
      updatedAt: raw?.updatedAt || null,
      items,
    };
  }

  function saveSellPriority() {
    state.sellPriority = normalizeSellPriority({
      ...state.sellPriority,
      updatedAt: new Date().toISOString(),
    });
    saveJson(APP.sellPriorityStorageKey, state.sellPriority);
  }

  function sellPriorityKey(candidate) {
    return normalizeWhitespace(candidate?.key) || inventoryKey(candidate);
  }

  function sellPriorityEntry(candidate) {
    const key = sellPriorityKey(candidate);
    return key ? state.sellPriority?.items?.[key] || null : null;
  }

  function sellPriorityStatus(candidate) {
    return sellPriorityEntry(candidate)?.status || 'normal';
  }

  function sellPriorityLabel(status) {
    return ({ normal: 'NORMAL', always: 'ALWAYS SHOW', hide: 'HIDE FROM SELLING' })[status] || 'NORMAL';
  }

  function sellPriorityAllowsSelling(candidate) {
    return sellPriorityStatus(candidate) !== 'hide';
  }

  function sellPriorityCatalog(candidate) {
    return catalogItemFor(candidate?.itemName, candidate?.itemId);
  }

  function sellPriorityEstimatedEach(candidate) {
    const catalog = sellPriorityCatalog(candidate);
    return Math.max(
      0,
      Number(catalog?.sellPrice) || 0,
      traderPayout(Number(catalog?.marketPrice) || 0),
    );
  }

  function sellPriorityStackValue(candidate, quantity = null) {
    const qty = Math.max(0, Math.floor(Number(quantity ?? candidate?.apiQuantity ?? candidate?.totalQuantity) || 0));
    return sellPriorityEstimatedEach(candidate) * qty;
  }

  function sellPrioritySuggested(candidate) {
    if (sellPriorityStatus(candidate) !== 'normal') return false;
    const value = sellPriorityStackValue(candidate, candidate?.apiQuantity);
    const threshold = Math.max(0, Number(state.settings.sellPrioritySuggestBelowTotalValue) || 0);
    return candidate?.apiQuantity > 0 && value > 0 && threshold > 0 && value < threshold;
  }

  function setSellPriority(candidate, status) {
    const key = sellPriorityKey(candidate);
    const normalizedStatus = ['normal', 'always', 'hide'].includes(status) ? status : 'normal';
    if (!key) return false;
    if (normalizedStatus === 'normal') {
      delete state.sellPriority.items[key];
    } else {
      state.sellPriority.items[key] = {
        key,
        itemId: Number(candidate?.itemId) > 0 ? Number(candidate.itemId) : null,
        itemName: normalizeWhitespace(candidate?.itemName) || key,
        status: normalizedStatus,
        updatedAt: new Date().toISOString(),
      };
    }
    saveSellPriority();
    renderLedger();
    renderPanel();
    toast(`${normalizeWhitespace(candidate?.itemName) || 'Item'} set to ${sellPriorityLabel(normalizedStatus)}.`);
    return true;
  }

  function setCurrentInventoryBaseline() {
    if (!state.inventory?.capturedAt || !(state.inventory?.items || []).length) {
      toast('Sync inventory before setting a starting baseline.');
      return false;
    }
    const openLots = (state.ledger.lots || []).filter((lot) => Number(lot.remainingQuantity || 0) > 0);
    if (openLots.length) {
      toast('Starting baseline requires an empty open purchase ledger to avoid double-counting.');
      return false;
    }
    const items = (state.inventory.items || [])
      .map((item) => ({
        itemId: Number(item.itemId) > 0 ? Number(item.itemId) : null,
        itemName: item.itemName,
        quantity: Math.max(0, Math.floor(Number(item.totalQuantity) || 0)),
      }))
      .filter((item) => item.quantity > 0 && (item.itemId || item.itemName));
    if (!items.length) {
      toast('The current inventory snapshot contains no baseline quantities.');
      return false;
    }
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const replacing = Boolean(state.inventoryBaseline?.capturedAt);
    const message = `${replacing ? 'Replace' : 'Set'} the current API inventory as your starting baseline?\n\n${formatInteger(items.length)} item types · ${formatInteger(quantity)} total items\n\nBaseline items keep unknown acquisition cost. Future tracked purchases remain separate and measurable.`;
    if (!confirm(message)) return false;
    state.inventoryBaseline = normalizeInventoryBaseline({
      capturedAt: new Date().toISOString(),
      sourceInventoryCapturedAt: state.inventory.capturedAt,
      items,
    });
    saveInventoryBaseline();
    renderLedger();
    renderPanel();
    toast(`Starting baseline saved: ${formatInteger(items.length)} item types.`);
    return true;
  }

  function clearInventoryBaseline() {
    if (!state.inventoryBaseline?.capturedAt) {
      toast('No starting baseline is saved.');
      return false;
    }
    if (!confirm('Clear the starting inventory baseline? Purchase lots and sell priorities will not be changed.')) return false;
    state.inventoryBaseline = normalizeInventoryBaseline({});
    saveInventoryBaseline();
    renderLedger();
    renderPanel();
    toast('Starting inventory baseline cleared.');
    return true;
  }

  function hideSuggestedSellPriority(rows = ledgerReconciliationRows()) {
    const suggested = rows.filter((row) => row.prioritySuggested);
    if (!suggested.length) {
      toast('No low-value NORMAL items are currently suggested for hiding.');
      return false;
    }
    const threshold = Math.max(0, Number(state.settings.sellPrioritySuggestBelowTotalValue) || 0);
    if (!confirm(`Hide ${formatInteger(suggested.length)} suggested item types from future selling recommendations?\n\nEach current stack is below ${formatMoney(threshold)}. Inventory and reconciliation totals remain unchanged.`)) return false;
    for (const row of suggested) {
      state.sellPriority.items[row.key] = {
        key: row.key,
        itemId: row.itemId || null,
        itemName: row.itemName,
        status: 'hide',
        updatedAt: new Date().toISOString(),
      };
    }
    saveSellPriority();
    renderLedger();
    renderPanel();
    toast(`${formatInteger(suggested.length)} item types hidden from selling recommendations.`);
    return true;
  }

  function resetSellPriorities() {
    const count = Object.keys(state.sellPriority?.items || {}).length;
    if (!count) {
      toast('No persistent sell priorities are set.');
      return false;
    }
    if (!confirm(`Reset all ${formatInteger(count)} persistent sell-priority choices to NORMAL?`)) return false;
    state.sellPriority = normalizeSellPriority({});
    saveSellPriority();
    renderLedger();
    renderPanel();
    toast('All sell priorities reset to NORMAL.');
    return true;
  }

  function inventorySnapshotFresh() {
    const captured = Date.parse(state.inventory?.capturedAt || '');
    return Number.isFinite(captured) && Date.now() - captured <= APP.inventoryCacheMaxAgeMs;
  }

  function inventoryNextUrl(payload, currentUrl) {
    const value = payload?._metadata?.links?.next
      ?? payload?.metadata?.links?.next
      ?? payload?.pagination?.next
      ?? payload?.links?.next;
    if (!value) return '';
    try { return new URL(value, currentUrl).href; } catch { return ''; }
  }

  function inventoryCategoryError(error) {
    return /(?:incorrect|invalid) category|category.{0,30}(?:incorrect|invalid)/i.test(
      normalizeWhitespace(error?.message || error)
    );
  }

  async function fetchInventorySelection(baseUrl, source, key, { category = '', clean = false } = {}) {
    const found = new Map();
    let url = new URL(baseUrl);
    if (category) url.searchParams.set('cat', category);
    if (!clean) {
      if (source === 'inventory') url.searchParams.set('limit', '250');
      url.searchParams.set('comment', 'TornScripture GOBLIN GOD inventory reconciliation');
    }
    for (let page = 0; url && page < 20; page += 1) {
      const response = await fetch(url.href, {
        headers: { Accept: 'application/json', Authorization: `ApiKey ${key}` },
        credentials: 'omit',
        cache: 'no-store',
      });
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error(`${source === 'itemmarket' ? 'Item Market' : 'Inventory'} returned unreadable data (${response.status}).`); }
      if (!response.ok || payload?.error) throw new Error(apiErrorMessage(payload, response));
      inventoryEntriesFromPayload(payload, source).forEach((item) => mergeInventory(found, item));
      const next = inventoryNextUrl(payload, url.href);
      url = next ? new URL(next) : null;
    }
    return [...found.values()];
  }

  async function fetchInventoryWithFallback(key, { probeOnly = false } = {}) {
    try {
      const items = await fetchInventorySelection(APP.inventoryUrl, 'inventory', key, { clean: true });
      return {
        items,
        mode: 'unfiltered',
        categoriesFetched: [],
        categoryErrors: [],
      };
    } catch (error) {
      if (!inventoryCategoryError(error)) throw error;
    }

    const categories = probeOnly ? ['Other'] : INVENTORY_API_CATEGORIES;
    const found = new Map();
    const categoriesFetched = [];
    const categoryErrors = [];
    for (const category of categories) {
      try {
        const items = await fetchInventorySelection(APP.inventoryUrl, 'inventory', key, {
          category,
          clean: true,
        });
        items.forEach((item) => mergeInventory(found, item));
        categoriesFetched.push(category);
      } catch (error) {
        categoryErrors.push(`${category}: ${normalizeWhitespace(error?.message || 'request failed')}`);
      }
    }

    if (categoryErrors.length) {
      throw new Error(`Inventory category fallback failed: ${categoryErrors.join(' · ')}`);
    }
    if (!categoriesFetched.length) {
      throw new Error('Inventory category fallback did not complete any category requests.');
    }

    return {
      items: [...found.values()],
      mode: 'category-fallback',
      categoriesFetched,
      categoryErrors,
    };
  }

  async function syncInventorySnapshot({ skipKeyCheck = false } = {}) {
    if (state.inventorySyncing) return;
    const key = currentApiKey();
    if (!key) {
      toast('Paste the dedicated GOBLIN GOD API key first.');
      configureGoblinGodKey();
      return;
    }
    if (!skipKeyCheck && !state.keyProfile?.endpoints?.inventory?.ok) {
      await inspectGoblinGodKey({ syncAfter: true });
      return;
    }

    state.inventorySyncing = true;
    renderLedger();
    try {
      const found = new Map();
      const inventoryResult = await fetchInventoryWithFallback(key);
      inventoryResult.items.forEach((item) => mergeInventory(found, item));
      let itemMarketIncluded = false;
      let itemMarketError = '';
      try {
        (await fetchInventorySelection(APP.inventoryItemMarketUrl, 'itemmarket', key))
          .forEach((item) => mergeInventory(found, item));
        itemMarketIncluded = true;
      } catch (error) {
        itemMarketError = normalizeWhitespace(error?.message || 'Active Item Market listings could not be read.');
      }
      state.inventory = normalizeInventoryCache({
        capturedAt: new Date().toISOString(),
        items: [...found.values()],
        itemMarketIncluded,
        itemMarketError,
        captureMode: inventoryResult.mode,
        categoriesFetched: inventoryResult.categoriesFetched,
        categoryErrors: inventoryResult.categoryErrors,
      });
      saveJson(APP.inventoryStorageKey, state.inventory);
      state.keyProfile.lastError = itemMarketError ? `Item Market listings: ${itemMarketError}` : '';
      state.keyProfile.endpoints.inventory = {
        ok: true,
        checked: true,
        count: inventoryResult.items.length,
        message: inventoryResult.mode === 'category-fallback'
          ? `available via ${inventoryResult.categoriesFetched.length} categories`
          : 'selection available',
      };
      saveApiKeyProfile();
      const quantity = state.inventory.items.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0);
      const inventoryRoute = inventoryResult.mode === 'category-fallback'
        ? ` via ${inventoryResult.categoriesFetched.length} inventory categories`
        : ' via the complete inventory endpoint';
      toast(`Inventory snapshot saved: ${formatInteger(quantity)} items${inventoryRoute}${itemMarketIncluded ? ', including active Item Market listings' : ''}.`);
    } catch (error) {
      const message = normalizeWhitespace(error?.message || 'Inventory sync failed.');
      state.keyProfile.lastError = `Inventory: ${message}`;
      state.keyProfile.endpoints.inventory = { ok: false, checked: true, count: 0, message };
      saveApiKeyProfile();
      toast(`Inventory API failed: ${message}`);
    } finally {
      state.inventorySyncing = false;
      renderLedger();
      renderPanel();
    }
  }

  function ledgerHoldingMap() {
    const found = new Map();
    for (const lot of state.ledger.lots || []) {
      const quantity = Math.max(0, Math.floor(Number(lot.remainingQuantity) || 0));
      if (!quantity) continue;
      const key = Number(lot.itemId) > 0 ? `id:${Number(lot.itemId)}` : `name:${normalizeName(lot.itemName)}`;
      const entry = found.get(key) || {
        key,
        itemId: Number(lot.itemId) > 0 ? Number(lot.itemId) : null,
        itemName: lot.itemName,
        ledgerQuantity: 0,
      };
      entry.ledgerQuantity += quantity;
      found.set(key, entry);
    }
    return found;
  }

  function recentLedgerActivity(key) {
    const cutoff = Date.now() - 75 * 60 * 1000;
    const recentLot = (state.ledger.lots || []).some((lot) => {
      const lotKey = Number(lot.itemId) > 0 ? `id:${Number(lot.itemId)}` : `name:${normalizeName(lot.itemName)}`;
      return lotKey === key && Date.parse(lot.capturedAt || '') >= cutoff;
    });
    const recentSale = (state.ledger.sales || []).some((sale) =>
      Date.parse(sale.soldAt || '') >= cutoff
      && (sale.items || []).some((item) => {
        const itemKey = Number(item.itemId) > 0 ? `id:${Number(item.itemId)}` : `name:${normalizeName(item.itemName)}`;
        return itemKey === key;
      })
    );
    return recentLot || recentSale;
  }

  function ledgerReconciliationRows() {
    const baseline = baselineHoldingMap();
    const ledger = ledgerHoldingMap();
    const inventory = new Map((state.inventory?.items || []).map((item) => [inventoryKey(item), item]));
    const rows = [];
    const query = normalizeName(state.ledgerUi.search);
    for (const key of new Set([...baseline.keys(), ...ledger.keys(), ...inventory.keys()])) {
      const starting = baseline.get(key) || {};
      const tracked = ledger.get(key) || {};
      const current = inventory.get(key) || {};
      const baselineQuantity = Number(starting.baselineQuantity || 0);
      const trackedQuantity = Number(tracked.ledgerQuantity || 0);
      const expectedQuantity = baselineQuantity + trackedQuantity;
      const apiQuantity = Number(current.totalQuantity || 0);
      const difference = apiQuantity - expectedQuantity;
      let status = 'matched';
      if (!state.inventory?.capturedAt) status = 'not-synced';
      else if (!inventorySnapshotFresh()) status = 'stale';
      else if (difference && recentLedgerActivity(key)) status = 'pending';
      else if (difference > 0) status = 'untracked';
      else if (difference < 0) status = 'missing';
      const row = {
        key,
        itemId: Number(starting.itemId || tracked.itemId || current.itemId) || null,
        itemName: starting.itemName || tracked.itemName || current.itemName || key,
        baselineQuantity,
        trackedQuantity,
        ledgerQuantity: expectedQuantity,
        expectedQuantity,
        apiQuantity,
        onHandQuantity: Number(current.onHandQuantity || 0),
        listedQuantity: Number(current.listedQuantity || 0),
        difference,
        status,
      };
      row.priorityStatus = sellPriorityStatus(row);
      row.estimatedSellEach = sellPriorityEstimatedEach(row);
      row.estimatedStackValue = sellPriorityStackValue(row, apiQuantity);
      row.prioritySuggested = sellPrioritySuggested(row);
      if (!query || normalizeName(row.itemName).includes(query)) rows.push(row);
    }
    const order = { untracked: 0, missing: 1, pending: 2, stale: 3, 'not-synced': 4, matched: 5 };
    const priorityOrder = { always: 0, normal: 1, hide: 2 };
    return rows.sort((a, b) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9)
      || (priorityOrder[a.priorityStatus] ?? 1) - (priorityOrder[b.priorityStatus] ?? 1)
      || Math.abs(b.difference) - Math.abs(a.difference)
      || b.estimatedStackValue - a.estimatedStackValue
      || a.itemName.localeCompare(b.itemName)
    );
  }

  function injectLedgerReconciliationStyles() {
    if (!document.head || document.getElementById(APP.ledgerReconcileStyleId)) return;
    const style = document.createElement('style');
    style.id = APP.ledgerReconcileStyleId;
    style.textContent = `
      #${APP.ledgerOverlayId} .tsimm-reconcile-note{margin:10px 12px;padding:9px;border:1px solid #27819a;border-radius:7px;background:#06171d;color:#c1efff;font-size:10px;line-height:1.45}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:0 12px 9px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts div{padding:6px;border:1px solid #333;border-radius:6px;text-align:center;background:#141414}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts strong,#${APP.ledgerOverlayId} .tsimm-reconcile-counts span{display:block}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts span{font-size:8px;color:#aaa}
      #${APP.ledgerOverlayId} .tsimm-reconcile-list{display:grid;gap:6px;padding:0 12px 14px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row{padding:8px;border:1px solid #333;border-radius:7px;background:#111}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.untracked{border-color:#b68b2c;background:#211906}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.missing{border-color:#bd4b61;background:#21080e}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.pending{border-color:#2da8c8;background:#061a20}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.matched{border-color:#287d47;background:#07180d}
      #${APP.ledgerOverlayId} .tsimm-reconcile-head{display:flex;justify-content:space-between;gap:8px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-head span{font-size:8px;font-weight:800;text-transform:uppercase}
      #${APP.ledgerOverlayId} .tsimm-reconcile-grid{display:grid;grid-template-columns:1fr auto;gap:3px 10px;margin-top:6px;font-size:10px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-grid strong{text-align:right}
      #${APP.ledgerOverlayId} .tsimm-key-profile{margin:10px 12px;padding:9px;border:1px solid #555;border-radius:8px;background:#101010}
      #${APP.ledgerOverlayId} .tsimm-key-profile-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      #${APP.ledgerOverlayId} .tsimm-key-profile-head div strong,#${APP.ledgerOverlayId} .tsimm-key-profile-head div span{display:block}
      #${APP.ledgerOverlayId} .tsimm-key-profile-head span{font-size:9px;color:#aaa}
      #${APP.ledgerOverlayId} .tsimm-key-profile-head b{font-size:9px;color:#8de4ff}
      #${APP.ledgerOverlayId} .tsimm-key-endpoints{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:8px}
      #${APP.ledgerOverlayId} .tsimm-key-endpoint{padding:6px;border:1px solid #333;border-radius:6px;background:#171717}
      #${APP.ledgerOverlayId} .tsimm-key-endpoint strong,#${APP.ledgerOverlayId} .tsimm-key-endpoint span{display:block}
      #${APP.ledgerOverlayId} .tsimm-key-endpoint span{font-size:8px;color:#aaa;overflow-wrap:anywhere}
      #${APP.ledgerOverlayId} .tsimm-key-endpoint.good{border-color:#287d47}
      #${APP.ledgerOverlayId} .tsimm-key-endpoint.bad{border-color:#bd4b61}
      #${APP.ledgerOverlayId} .tsimm-key-guide{margin-top:8px;font-size:9px;line-height:1.45;color:#ccc}
      #${APP.ledgerOverlayId} .tsimm-key-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
      #${APP.ledgerOverlayId} .tsimm-key-actions button{flex:1;min-width:120px;border:1px solid #3b8fc2;border-radius:6px;background:#173d56;color:#eaf7ff;padding:7px;font-size:9px;font-weight:800}
      #${APP.ledgerOverlayId} .tsimm-key-error{display:block;margin-top:7px;color:#ff9aab}
      #${APP.ledgerOverlayId} .tsimm-baseline-card,#${APP.ledgerOverlayId} .tsimm-sell-priority-card{margin:10px 12px;padding:9px;border:1px solid #5b4770;border-radius:8px;background:#17131c;display:grid;gap:7px}
      #${APP.ledgerOverlayId} .tsimm-baseline-card>div,#${APP.ledgerOverlayId} .tsimm-sell-priority-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      #${APP.ledgerOverlayId} .tsimm-baseline-card span,#${APP.ledgerOverlayId} .tsimm-sell-priority-card small{color:#aaa1b7;font-size:9px}
      #${APP.ledgerOverlayId} .tsimm-baseline-actions,#${APP.ledgerOverlayId} .tsimm-sell-priority-actions,#${APP.ledgerOverlayId} .tsimm-priority-row-actions{display:flex;flex-wrap:wrap;gap:5px}
      #${APP.ledgerOverlayId} .tsimm-baseline-actions button,#${APP.ledgerOverlayId} .tsimm-sell-priority-actions button,#${APP.ledgerOverlayId} .tsimm-priority-row-actions button{flex:1;min-width:92px;border:1px solid #665575;border-radius:6px;background:#342c3d;color:#fff;padding:6px;font-size:9px;font-weight:800}
      #${APP.ledgerOverlayId} .tsimm-sell-priority-threshold{display:grid;grid-template-columns:1fr 110px;gap:7px;align-items:center;color:#d5cbe0;font-size:10px}
      #${APP.ledgerOverlayId} .tsimm-sell-priority-threshold input{min-width:0;border:1px solid #5a5266;border-radius:6px;background:#111;color:#fff;padding:6px}
      #${APP.ledgerOverlayId} .tsimm-priority-pill{display:inline-flex;margin-left:5px;padding:2px 5px;border:1px solid #625a70;border-radius:999px;font-size:8px;font-weight:800;color:#c9c2d0}
      #${APP.ledgerOverlayId} .tsimm-priority-pill.always{border-color:#3b8fc2;color:#8bd7ff}#${APP.ledgerOverlayId} .tsimm-priority-pill.hide{border-color:#8a5f2e;color:#ffc879}#${APP.ledgerOverlayId} .tsimm-priority-pill.suggested{border-color:#9b6bd0;color:#e2bfff}
      #${APP.ledgerOverlayId} .tsimm-priority-row-actions{margin-top:7px;padding-top:7px;border-top:1px solid #3a3341}
      #${APP.ledgerOverlayId} .tsimm-priority-row-actions button.active{background:#5b2b82;border-color:#9a61c2}.tsimm-priority-row-actions button[data-tsimm-sell-priority="hide"].active{background:#563715;border-color:#b78035}.tsimm-priority-row-actions button[data-tsimm-sell-priority="always"].active{background:#174f75;border-color:#3b8fc2}
      #${APP.ledgerOverlayId} .tsimm-integrity-note{margin:0 8px 8px;padding:8px;border:1px solid #4f6572;border-radius:8px;background:#172229;color:#bcd5e2;line-height:1.45}
      #${APP.ledgerOverlayId} .tsimm-integrity-result{display:grid;gap:3px;margin:0 8px 8px;padding:10px;border:1px solid #4d4656;border-radius:9px;background:#24212a}
      #${APP.ledgerOverlayId} .tsimm-integrity-result.good{border-color:#3e8b62;background:#18271f}.tsimm-integrity-result.good strong{color:#63df9f}
      #${APP.ledgerOverlayId} .tsimm-integrity-result.bad{border-color:#9c4650;background:#301d21}.tsimm-integrity-result.bad strong{color:#ff9ca4}
      #${APP.ledgerOverlayId} .tsimm-integrity-result span{color:#bdb5c6}
      #${APP.ledgerOverlayId} .tsimm-integrity-groups{display:grid;gap:8px;padding:0 8px 12px;min-width:0}
      #${APP.ledgerOverlayId} .tsimm-integrity-group{min-width:0;border:1px solid #514a59;border-radius:9px;background:#201d25;overflow:hidden}
      #${APP.ledgerOverlayId} .tsimm-integrity-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;background:#2a2530;border-bottom:1px solid #514a59}.tsimm-integrity-group-head span{flex:none;border:1px solid #76548e;border-radius:999px;padding:2px 6px;color:#e2bfff;font-size:9px}
      #${APP.ledgerOverlayId} .tsimm-integrity-list{display:grid;gap:6px;padding:7px}
      #${APP.ledgerOverlayId} .tsimm-integrity-issue{display:grid;gap:3px;min-width:0;padding:7px;border:1px solid #4b4352;border-radius:7px;background:#17151b}.tsimm-integrity-issue strong{color:#f1c3c8;overflow-wrap:anywhere}.tsimm-integrity-issue span{color:#c8c0cf;overflow-wrap:anywhere;word-break:break-word}
      @media(max-width:520px){#${APP.ledgerOverlayId} .tsimm-reconcile-counts,#${APP.ledgerOverlayId} .tsimm-key-endpoints{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function reconciliationStatus(status) {
    return ({
      matched: 'Matched',
      untracked: 'Untracked',
      missing: 'Missing',
      pending: 'Pending',
      stale: 'Snapshot stale',
      'not-synced': 'Not synced',
    })[status] || status;
  }

  function ledgerReconciliationHtml(rows) {
    const counts = rows.reduce((all, row) => {
      all[row.status] = (all[row.status] || 0) + 1;
      all[row.priorityStatus] = (all[row.priorityStatus] || 0) + 1;
      if (row.prioritySuggested) all.suggested = (all.suggested || 0) + 1;
      return all;
    }, {});
    const age = state.inventory?.capturedAt
      ? `${relativeAge(state.inventory.capturedAt)}${inventorySnapshotFresh() ? '' : ' · stale'}`
      : 'never';
    const baselineAge = state.inventoryBaseline?.capturedAt ? relativeAge(state.inventoryBaseline.capturedAt) : 'not set';
    const baselineQuantity = (state.inventoryBaseline?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const priorityCount = Object.keys(state.sellPriority?.items || {}).length;
    const threshold = Math.max(0, Number(state.settings.sellPrioritySuggestBelowTotalValue) || 0);
    const body = rows.map((row) => {
      const itemId = Number(row.itemId) > 0 ? Number(row.itemId) : '';
      const priority = row.priorityStatus || 'normal';
      const suggestion = row.prioritySuggested ? '<span class="tsimm-priority-pill suggested">LOW-VALUE SUGGESTION</span>' : '';
      return `
      <article class="tsimm-reconcile-row ${escapeHtml(row.status)}">
        <div class="tsimm-reconcile-head"><strong>${escapeHtml(row.itemName)}<span class="tsimm-priority-pill ${escapeHtml(priority)}">${escapeHtml(sellPriorityLabel(priority))}</span>${suggestion}</strong><span>${escapeHtml(reconciliationStatus(row.status))}</span></div>
        <div class="tsimm-reconcile-grid">
          <span>Starting baseline</span><strong>${formatInteger(row.baselineQuantity)}</strong>
          <span>Tracked purchases</span><strong>${formatInteger(row.trackedQuantity)}</strong>
          <span>Expected total</span><strong>${formatInteger(row.expectedQuantity)}</strong>
          <span>API total</span><strong>${formatInteger(row.apiQuantity)}</strong>
          <span>On hand / listed</span><strong>${formatInteger(row.onHandQuantity)} / ${formatInteger(row.listedQuantity)}</strong>
          <span>API minus expected</span><strong>${row.difference > 0 ? '+' : ''}${formatInteger(row.difference)}</strong>
          <span>Estimated sell value</span><strong>${row.estimatedStackValue > 0 ? formatMoney(row.estimatedStackValue) : 'Unknown'}</strong>
        </div>
        <div class="tsimm-priority-row-actions">
          <button type="button" class="${priority === 'normal' ? 'active' : ''}" data-tsimm-action="sell-priority-set" data-tsimm-sell-priority="normal" data-tsimm-item-key="${escapeHtml(row.key)}" data-tsimm-item-id="${escapeHtml(itemId)}" data-tsimm-item-name="${escapeHtml(row.itemName)}">NORMAL</button>
          <button type="button" class="${priority === 'always' ? 'active' : ''}" data-tsimm-action="sell-priority-set" data-tsimm-sell-priority="always" data-tsimm-item-key="${escapeHtml(row.key)}" data-tsimm-item-id="${escapeHtml(itemId)}" data-tsimm-item-name="${escapeHtml(row.itemName)}">ALWAYS SHOW</button>
          <button type="button" class="${priority === 'hide' ? 'active' : ''}" data-tsimm-action="sell-priority-set" data-tsimm-sell-priority="hide" data-tsimm-item-key="${escapeHtml(row.key)}" data-tsimm-item-id="${escapeHtml(itemId)}" data-tsimm-item-name="${escapeHtml(row.itemName)}">HIDE</button>
        </div>
      </article>`;
    }).join('');
    return `
      ${apiKeyProfileHtml()}
      <div class="tsimm-reconcile-note">
        Read-only snapshot captured ${escapeHtml(age)}. It combines on-hand inventory with active Item Market listings when available.
        Missing items may still be in your Bazaar, display case, active trades, faction storage, company storage, or another off-inventory location.
        No purchase costs are invented and no ledger quantities are changed from this screen.
        ${state.inventory?.itemMarketError ? `<br><strong>Listings not included:</strong> ${escapeHtml(state.inventory.itemMarketError)}` : ''}
      </div>
      <section class="tsimm-baseline-card">
        <div><strong>Starting inventory baseline</strong><span>${escapeHtml(baselineAge)} · ${formatInteger(state.inventoryBaseline?.items?.length || 0)} types · ${formatInteger(baselineQuantity)} items</span></div>
        <small>Baseline stock carries unknown acquisition cost. It prevents your pre-GOBLIN inventory from being mistaken for new untracked purchases.</small>
        <div class="tsimm-baseline-actions">
          <button type="button" data-tsimm-action="inventory-baseline-set">${state.inventoryBaseline?.capturedAt ? 'REPLACE BASELINE' : 'SET CURRENT INVENTORY AS BASELINE'}</button>
          ${state.inventoryBaseline?.capturedAt ? '<button type="button" data-tsimm-action="inventory-baseline-clear">CLEAR BASELINE</button>' : ''}
        </div>
      </section>
      <section class="tsimm-sell-priority-card">
        <div class="tsimm-sell-priority-head"><strong>Sell Priority</strong><small>${formatInteger(counts.always || 0)} always · ${formatInteger(counts.hide || 0)} hidden · ${formatInteger(counts.suggested || 0)} suggested</small></div>
        <label class="tsimm-sell-priority-threshold"><span>Suggest hiding when the whole current stack is worth less than</span><input type="number" min="0" step="500" value="${escapeHtml(threshold)}" data-tsimm-setting="sellPrioritySuggestBelowTotalValue"></label>
        <small>Suggestions never hide anything automatically. Hidden items remain in inventory and reconciliation, but future selling recommendations will skip them.</small>
        <div class="tsimm-sell-priority-actions">
          <button type="button" data-tsimm-action="sell-priority-hide-suggested" ${counts.suggested ? '' : 'disabled'}>HIDE ${formatInteger(counts.suggested || 0)} SUGGESTED</button>
          <button type="button" data-tsimm-action="sell-priority-reset" ${priorityCount ? '' : 'disabled'}>RESET PRIORITIES</button>
        </div>
      </section>
      <div class="tsimm-reconcile-counts">
        <div><strong>${formatInteger(counts.untracked || 0)}</strong><span>untracked</span></div>
        <div><strong>${formatInteger(counts.missing || 0)}</strong><span>missing</span></div>
        <div><strong>${formatInteger(counts.pending || 0)}</strong><span>pending</span></div>
        <div><strong>${formatInteger(counts.matched || 0)}</strong><span>matched</span></div>
      </div>
      <div class="tsimm-ledger-filters"><input type="search" value="${escapeHtml(state.ledgerUi.search)}" placeholder="Search item name" data-tsimm-ledger-search></div>
      <div class="tsimm-reconcile-list">${body || '<div class="tsimm-ledger-empty">Sync inventory to begin reconciliation.</div>'}</div>
    `;
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
        schemaVersion: 2,
        source: normalizeWhitespace(candidate?.source) || 'manual',
        venue: normalizeWhitespace(candidate?.venue) || normalizeWhitespace(candidate?.source) || 'manual',
        country: normalizeWhitespace(candidate?.country),
        location: normalizeWhitespace(candidate?.location),
        fundingSource: normalizeLedgerFundingSource(candidate?.fundingSource ?? candidate?.capitalSource, 'unassigned'),
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
      schemaVersion: 5,
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
      fundingSource: normalizeLedgerFundingSource(raw.fundingSource, 'personal'),
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

  const LEDGER_INTEGRITY_GROUPS = Object.freeze([
    { type: 'duplicate-lot-id', label: 'Duplicate lot IDs' },
    { type: 'duplicate-sale-id', label: 'Duplicate sale IDs' },
    { type: 'duplicate-allocation-id', label: 'Duplicate allocation IDs' },
    { type: 'missing-lot-reference', label: 'Missing lot references' },
    { type: 'allocation-quantity', label: 'Allocation quantity disagreements' },
    { type: 'cost-basis-total', label: 'Cost-basis total disagreements' },
    { type: 'proceeds-total', label: 'Proceeds total disagreements' },
    { type: 'realized-profit-total', label: 'Realized-profit total disagreements' },
    { type: 'lot-sold-quantity', label: 'Lot sold-quantity disagreements' },
  ]);

  function analyzeLedgerIntegrity(ledger = state.ledger) {
    const lots = Array.isArray(ledger?.lots) ? ledger.lots : [];
    const sales = Array.isArray(ledger?.sales) ? ledger.sales : [];
    const issues = [];
    const lotIds = new Set();
    const allocatedQuantityByLotId = new Map();
    const allocationIds = new Map();
    const amount = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    };
    const quantity = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    };
    const recordId = (value) => String(value ?? '').trim();
    const amountsAgree = (left, right) => Math.abs(amount(left) - amount(right)) <= 0.01;
    const quantitiesAgree = (left, right) => Math.abs(quantity(left) - quantity(right)) < 0.000001;
    const addIssue = (type, id, detail) => {
      issues.push({ type, recordId: recordId(id) || 'Missing ID', detail: String(detail || '') });
    };
    const duplicateIds = (records, type, kind, describe) => {
      const found = new Map();
      records.forEach((record, index) => {
        const id = recordId(record?.id);
        if (!id) return;
        const entries = found.get(id) || [];
        entries.push(describe(record, index));
        found.set(id, entries);
      });
      for (const [id, entries] of found) {
        if (entries.length > 1) {
          addIssue(type, id, `${kind} ID appears ${entries.length} times: ${entries.join('; ')}.`);
        }
      }
    };

    duplicateIds(
      lots,
      'duplicate-lot-id',
      'Lot',
      (lot, index) => `lot #${index + 1} ${recordId(lot?.itemName) || 'Unnamed item'}`,
    );
    duplicateIds(
      sales,
      'duplicate-sale-id',
      'Sale',
      (sale, index) => `sale #${index + 1} ${recordId(sale?.counterparty) || 'Unknown counterparty'}`,
    );

    for (const lot of lots) {
      const lotId = recordId(lot?.id);
      if (lotId) lotIds.add(lotId);
    }

    sales.forEach((sale, saleIndex) => {
      const saleId = recordId(sale?.id) || `sale #${saleIndex + 1}`;
      const items = Array.isArray(sale?.items) ? sale.items : [];
      let saleItemQuantity = 0;
      let saleTrackedQuantity = 0;
      let saleUntrackedQuantity = 0;
      let saleItemCostBasis = 0;
      let saleItemProceeds = 0;
      let saleAllocationCostBasis = 0;
      let saleAllocationProceeds = 0;
      let saleAllocationProfit = 0;

      items.forEach((item, itemIndex) => {
        const itemName = recordId(item?.itemName ?? item?.name) || `item #${itemIndex + 1}`;
        const itemId = `${saleId} / ${itemName}`;
        const itemQuantity = quantity(item?.quantity);
        const itemTrackedQuantity = quantity(item?.trackedQuantity);
        const itemUntrackedQuantity = quantity(item?.untrackedQuantity);
        const allocations = Array.isArray(item?.allocations) ? item.allocations : [];
        let itemAllocationQuantity = 0;
        let itemAllocationCostBasis = 0;
        let itemAllocationProceeds = 0;
        let itemAllocationProfit = 0;

        allocations.forEach((allocation, allocationIndex) => {
          const allocationId = recordId(allocation?.id);
          const allocationLabel = allocationId || `allocation #${allocationIndex + 1}`;
          const allocationContext = `${saleId} / ${itemName} / ${allocationLabel}`;
          const lotId = recordId(allocation?.lotId);
          const allocationQuantity = quantity(allocation?.quantity);
          const allocationCostBasis = amount(allocation?.costBasis);
          const allocationProceeds = amount(allocation?.proceeds);
          const allocationProfit = amount(allocation?.realizedProfit);

          if (allocationId) {
            const entries = allocationIds.get(allocationId) || [];
            entries.push(allocationContext);
            allocationIds.set(allocationId, entries);
          }
          if (!lotId || !lotIds.has(lotId)) {
            addIssue(
              'missing-lot-reference',
              allocationContext,
              lotId ? `References missing lot ID ${lotId}.` : 'Does not contain a lot ID.',
            );
          }
          if (lotId) {
            allocatedQuantityByLotId.set(
              lotId,
              quantity(allocatedQuantityByLotId.get(lotId)) + allocationQuantity,
            );
          }

          itemAllocationQuantity += allocationQuantity;
          itemAllocationCostBasis += allocationCostBasis;
          itemAllocationProceeds += allocationProceeds;
          itemAllocationProfit += allocationProfit;
        });

        if (!quantitiesAgree(itemAllocationQuantity, itemTrackedQuantity)) {
          addIssue(
            'allocation-quantity',
            itemId,
            `Allocations total ${itemAllocationQuantity}; item tracked quantity is ${itemTrackedQuantity}.`,
          );
        }
        if (!quantitiesAgree(itemTrackedQuantity + itemUntrackedQuantity, itemQuantity)) {
          addIssue(
            'allocation-quantity',
            itemId,
            `Tracked ${itemTrackedQuantity} plus untracked ${itemUntrackedQuantity} does not equal item quantity ${itemQuantity}.`,
          );
        }
        if (!amountsAgree(itemAllocationCostBasis, item?.costBasis)) {
          addIssue(
            'cost-basis-total',
            itemId,
            `Allocations total ${itemAllocationCostBasis}; item cost basis is ${amount(item?.costBasis)}.`,
          );
        }
        const expectedTrackedProceeds = itemQuantity > 0
          ? amount(item?.proceeds) * itemTrackedQuantity / itemQuantity
          : 0;
        if (!amountsAgree(itemAllocationProceeds, expectedTrackedProceeds)) {
          addIssue(
            'proceeds-total',
            itemId,
            `Allocations total ${itemAllocationProceeds}; expected tracked proceeds are ${expectedTrackedProceeds}.`,
          );
        }
        const itemRealizedProfit = optionalFiniteNumber(item?.realizedProfit);
        if (itemRealizedProfit !== null && !amountsAgree(itemAllocationProfit, itemRealizedProfit)) {
          addIssue(
            'realized-profit-total',
            itemId,
            `Allocations total ${itemAllocationProfit}; item realized profit is ${itemRealizedProfit}.`,
          );
        }

        saleItemQuantity += itemQuantity;
        saleTrackedQuantity += itemTrackedQuantity;
        saleUntrackedQuantity += itemUntrackedQuantity;
        saleItemCostBasis += amount(item?.costBasis);
        saleItemProceeds += amount(item?.proceeds);
        saleAllocationCostBasis += itemAllocationCostBasis;
        saleAllocationProceeds += itemAllocationProceeds;
        saleAllocationProfit += itemAllocationProfit;
      });

      if (!quantitiesAgree(saleItemQuantity, sale?.requestedQuantity)) {
        addIssue(
          'allocation-quantity',
          saleId,
          `Sale items total ${saleItemQuantity}; requested quantity is ${quantity(sale?.requestedQuantity)}.`,
        );
      }
      if (!quantitiesAgree(saleTrackedQuantity, sale?.trackedQuantity)) {
        addIssue(
          'allocation-quantity',
          saleId,
          `Sale items track ${saleTrackedQuantity}; sale tracked quantity is ${quantity(sale?.trackedQuantity)}.`,
        );
      }
      if (!quantitiesAgree(saleUntrackedQuantity, sale?.untrackedQuantity)) {
        addIssue(
          'allocation-quantity',
          saleId,
          `Sale items leave ${saleUntrackedQuantity} untracked; sale untracked quantity is ${quantity(sale?.untrackedQuantity)}.`,
        );
      }
      if (!amountsAgree(saleItemCostBasis, sale?.trackedCostBasis)) {
        addIssue(
          'cost-basis-total',
          saleId,
          `Sale items total ${saleItemCostBasis}; sale tracked cost basis is ${amount(sale?.trackedCostBasis)}.`,
        );
      }
      if (!amountsAgree(saleAllocationCostBasis, sale?.trackedCostBasis)) {
        addIssue(
          'cost-basis-total',
          saleId,
          `Allocations total ${saleAllocationCostBasis}; sale tracked cost basis is ${amount(sale?.trackedCostBasis)}.`,
        );
      }
      if (!amountsAgree(saleItemProceeds, sale?.cashReceived)) {
        addIssue(
          'proceeds-total',
          saleId,
          `Sale items total ${saleItemProceeds}; cash received is ${amount(sale?.cashReceived)}.`,
        );
      }
      if (sale?.fullCoverage && !amountsAgree(saleAllocationProceeds, sale?.cashReceived)) {
        addIssue(
          'proceeds-total',
          saleId,
          `Full-coverage allocations total ${saleAllocationProceeds}; cash received is ${amount(sale?.cashReceived)}.`,
        );
      }
      const trackedProfit = optionalFiniteNumber(sale?.trackedProfit);
      if (trackedProfit !== null && !amountsAgree(saleAllocationProfit, trackedProfit)) {
        addIssue(
          'realized-profit-total',
          saleId,
          `Allocations total ${saleAllocationProfit}; sale tracked profit is ${trackedProfit}.`,
        );
      }
      const realizedProfit = optionalFiniteNumber(sale?.realizedProfit);
      if (sale?.fullCoverage && realizedProfit !== null && !amountsAgree(saleAllocationProfit, realizedProfit)) {
        addIssue(
          'realized-profit-total',
          saleId,
          `Full-coverage allocations total ${saleAllocationProfit}; sale realized profit is ${realizedProfit}.`,
        );
      }
    });

    for (const [allocationId, entries] of allocationIds) {
      if (entries.length > 1) {
        addIssue(
          'duplicate-allocation-id',
          allocationId,
          `Allocation ID appears ${entries.length} times: ${entries.join('; ')}.`,
        );
      }
    }

    lots.forEach((lot, index) => {
      const lotId = recordId(lot?.id);
      if (!lotId) return;
      const soldQuantity = quantity(lot?.quantity) - quantity(lot?.remainingQuantity);
      const allocatedQuantity = quantity(allocatedQuantityByLotId.get(lotId));
      if (!quantitiesAgree(soldQuantity, allocatedQuantity)) {
        addIssue(
          'lot-sold-quantity',
          lotId,
          `${recordId(lot?.itemName) || `Lot #${index + 1}`} shows ${soldQuantity} sold; sale allocations reference ${allocatedQuantity}.`,
        );
      }
    });

    return { issues };
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
      schemaVersion: 2,
      source: normalizeWhitespace(source?.source) || 'item-market',
      venue: normalizeWhitespace(source?.venue) || normalizeWhitespace(source?.source) || 'item-market',
      country: normalizeWhitespace(source?.country),
      location: normalizeWhitespace(source?.location),
      fundingSource: normalizeLedgerFundingSource(
        source?.fundingSource,
        normalizeLedgerFundingSource(state.settings.ledgerDefaultFundingSource, 'personal'),
      ),
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
    const fingerprint = purchaseFingerprint({
      itemName: pending.itemName,
      quantity: pending.quantity,
      totalCost: pending.totalCost,
    }, pending.itemId);
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
    rememberPurchaseFingerprint(fingerprint);
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
      overseasRankedItems: [],
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
      listingLowestPrice: null,
      listingLowestQuantity: null,
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
      tradeExitAudit: null,
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
    const capacity = Math.max(0, limit - carried);
    let remaining = capacity;
    const ordered = items
      .filter((item) => Number(item?.availableQuantity) > 0 && Number(item?.margin?.profitEach) > 0)
      .sort((a, b) =>
        Number(b.margin.profitEach) - Number(a.margin.profitEach)
        || Number(b.margin.roiPercent) - Number(a.margin.roiPercent)
        || String(a.name || '').localeCompare(String(b.name || ''))
      );
    const rankedItems = ordered.slice(0, 2).map((item, index) => ({
      rank: index + 1,
      itemId: item.itemId || item.catalog?.id || null,
      name: item.catalog?.name || item.name,
      availableQuantity: Math.max(0, Math.floor(Number(item.availableQuantity) || 0)),
      unitCost: Number(item.price) || 0,
      traderValue: Number(item.margin?.payout) || 0,
      profitEach: Number(item.margin?.profitEach) || 0,
      runQuantity: Math.min(capacity, Math.max(0, Math.floor(Number(item.availableQuantity) || 0))),
    }));
    const planItems = [];
    for (const item of ordered.slice(0, 2)) {
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
      remainingCapacity: capacity,
      plannedQuantity: planItems.reduce((sum, item) => sum + item.quantity, 0),
      totalCost: planItems.reduce((sum, item) => sum + item.totalCost, 0),
      marketTotal: planItems.reduce((sum, item) => sum + item.marketTotal, 0),
      traderReturn: planItems.reduce((sum, item) => sum + item.traderReturn, 0),
      profit: planItems.reduce((sum, item) => sum + item.profit, 0),
      items: planItems,
      rankedItems,
    };
  }

  function pageLooksLikeOverseasShop() {
    const href = String(location.href || '').toLowerCase();
    if (href.includes('itemmarket') || href.includes('item-market') || href.includes('imarket')) return false;
    const bodyText = normalizeWhitespace(document.body?.innerText || '');
    const routeMatch = href.includes('shops.php')
      || href.includes('foreignshop')
      || href.includes('travelshop')
      || href.includes('abroad')
      || href.includes('travel.php')
      || href.includes('sid=shops')
      || href.includes('sid=shop')
      || href.includes('#/shops')
      || href.includes('#/shop');
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
    const overseasPriceRegex = /^(?:(?:cost|price)\s*:?\s*)?\$[\d,.]+$/i;
    const priceElements = marketTextElements(overseasPriceRegex, 'span,div,p,strong,b,td');
    for (const priceElement of priceElements) {
      const row = priceElement.closest(`.${APP.overseasMark}`) || overseasRowForPrice(priceElement);
      if (!row || seen.has(row)) continue;
      const priceText = normalizeWhitespace(ownText(priceElement) || priceElement.innerText || priceElement.textContent);
      const price = parseNumber(priceText.match(/\$[\d,.]+/)?.[0] || priceText);
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



  function normalizePendingTradeSale(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const capturedAtMs = Date.parse(candidate.capturedAt || '');
    if (!Number.isFinite(capturedAtMs) || Date.now() - capturedAtMs > APP.pendingTradeSaleMaxAgeMs) return null;
    const tradeItems = Array.isArray(candidate.tradeItems)
      ? candidate.tradeItems.map((item) => {
          const name = normalizeWhitespace(item?.name ?? item?.itemName);
          const quantity = Math.max(0, Math.floor(Number(item?.quantity) || 0));
          if (!name || quantity <= 0) return null;
          const marketPrice = Math.max(0, Number(item?.marketPrice) || 0);
          const targetEach = Math.max(0, Number(item?.targetEach) || 0);
          return {
            itemId: Number(item?.itemId) > 0 ? Number(item.itemId) : null,
            name,
            quantity,
            marketPrice,
            marketTotal: Math.max(0, Number(item?.marketTotal) || marketPrice * quantity),
            targetEach,
            targetTotal: Math.max(0, Number(item?.targetTotal) || targetEach * quantity),
          };
        }).filter(Boolean)
      : [];
    const tradeNetCash = optionalFiniteNumber(candidate.tradeNetCash);
    if (!tradeItems.length || tradeNetCash === null) return null;
    return {
      schemaVersion: 1,
      capturedAt: new Date(capturedAtMs).toISOString(),
      tradeId: normalizeWhitespace(candidate.tradeId),
      tradeCounterparty: normalizeWhitespace(candidate.tradeCounterparty),
      tradeCounterpartyId: Number(candidate.tradeCounterpartyId) > 0 ? Number(candidate.tradeCounterpartyId) : null,
      tradeCounterpartyProfileUrl: normalizeHttpUrl(candidate.tradeCounterpartyProfileUrl),
      tradeCounterpartyBannerUrl: normalizeHttpUrl(candidate.tradeCounterpartyBannerUrl),
      tradeMarketTotal: Math.max(0, Number(candidate.tradeMarketTotal) || 0),
      tradeTargetTotal: Math.max(0, Number(candidate.tradeTargetTotal) || 0),
      tradeTraderCash: optionalFiniteNumber(candidate.tradeTraderCash),
      tradeMyCash: Math.max(0, Number(candidate.tradeMyCash) || 0),
      tradeNetCash,
      tradeItems,
      tradeUnmatchedItems: Math.max(0, Math.floor(Number(candidate.tradeUnmatchedItems) || 0)),
      sourceUrl: normalizeHttpUrl(candidate.sourceUrl),
    };
  }

  function loadPendingTradeSale() {
    const pending = normalizePendingTradeSale(loadJson(APP.pendingTradeSaleStorageKey, null));
    if (!pending) localStorage.removeItem(APP.pendingTradeSaleStorageKey);
    return pending;
  }

  function clearPendingTradeSale() {
    localStorage.removeItem(APP.pendingTradeSaleStorageKey);
  }

  function pendingTradeSaleMatchesStats(pending, stats) {
    if (!pending || !stats) return false;
    const pendingTradeId = normalizeWhitespace(pending.tradeId);
    const statsTradeId = normalizeWhitespace(stats.tradeId || tradeIdFromLocation());
    if (pendingTradeId && statsTradeId) return pendingTradeId === statsTradeId;
    const pendingFingerprint = saleFingerprintForStats({
      tradeId: pendingTradeId,
      tradeItems: pending.tradeItems,
      tradeNetCash: pending.tradeNetCash,
    });
    return pendingFingerprint === saleFingerprintForStats(stats);
  }

  function clearPendingTradeSaleForStats(stats) {
    const pending = loadPendingTradeSale();
    if (pending && pendingTradeSaleMatchesStats(pending, stats)) clearPendingTradeSale();
  }

  function savePendingTradeSaleFromStats(stats) {
    if (!stats || stats.pageType !== 'trade' || stats.tradeCompleted) return null;
    if (!Array.isArray(stats.tradeItems) || !stats.tradeItems.length) return null;
    if (stats.tradeUnmatchedItems || optionalFiniteNumber(stats.tradeNetCash) === null) return null;
    const snapshot = normalizePendingTradeSale({
      capturedAt: new Date().toISOString(),
      tradeId: stats.tradeId || tradeIdFromLocation(),
      tradeCounterparty: stats.tradeCounterparty,
      tradeCounterpartyId: stats.tradeCounterpartyId,
      tradeCounterpartyProfileUrl: stats.tradeCounterpartyProfileUrl,
      tradeCounterpartyBannerUrl: stats.tradeCounterpartyBannerUrl,
      tradeMarketTotal: stats.tradeMarketTotal,
      tradeTargetTotal: stats.tradeTargetTotal,
      tradeTraderCash: stats.tradeTraderCash,
      tradeMyCash: stats.tradeMyCash,
      tradeNetCash: stats.tradeNetCash,
      tradeItems: stats.tradeItems,
      tradeUnmatchedItems: stats.tradeUnmatchedItems,
      sourceUrl: location.href,
    });
    if (!snapshot) return null;
    saveJson(APP.pendingTradeSaleStorageKey, snapshot);
    return snapshot;
  }

  function hydrateStatsFromPendingTradeSale(stats) {
    const pending = loadPendingTradeSale();
    if (!pending) return false;
    const currentTradeId = normalizeWhitespace(tradeIdFromLocation());
    if (pending.tradeId && currentTradeId && pending.tradeId !== currentTradeId) return false;
    stats.tradeId = currentTradeId || pending.tradeId || null;
    stats.tradeCounterparty = pending.tradeCounterparty || null;
    stats.tradeCounterpartyId = pending.tradeCounterpartyId || null;
    stats.tradeCounterpartyProfileUrl = pending.tradeCounterpartyProfileUrl || '';
    stats.tradeCounterpartyBannerUrl = pending.tradeCounterpartyBannerUrl || '';
    stats.tradeMarketTotal = pending.tradeMarketTotal;
    stats.tradeTargetTotal = pending.tradeTargetTotal;
    stats.tradeTraderCash = pending.tradeTraderCash;
    stats.tradeMyCash = pending.tradeMyCash;
    stats.tradeNetCash = pending.tradeNetCash;
    stats.tradeItems = structuredCloneSafe(pending.tradeItems);
    stats.tradeMatchedItems = pending.tradeItems.length;
    stats.tradeUnmatchedItems = pending.tradeUnmatchedItems;
    stats.tradeUnmatched = [];
    stats.tradeStatus = 'completed-snapshot';
    stats.tradeCompleted = true;
    stats.tradeCompletionSource = 'preserved live-trade snapshot';
    stats.notes.push('Completed trade restored from the live manifest preserved before Torn opened the trade log.');
    return true;
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
    clearPendingTradeSaleForStats(stats);
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
    clearPricedTradeAnnotations();
    document.querySelectorAll(`.${APP.tradeBadgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.tradeItemMark}`).forEach((element) => element.classList.remove(APP.tradeItemMark));
    document.querySelectorAll('[data-tsimm-trade-route-alert]').forEach((element) => element.remove());
    document.querySelectorAll('[data-tsimm-trade-exit-status],[data-tsimm-trade-exit-token]').forEach((element) => {
      delete element.dataset.tsimmTradeExitStatus;
      delete element.dataset.tsimmTradeExitToken;
    });
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

  const TRADE_EXIT_FAVORITES_STORAGE_KEY = 'tornscripture-imm-favorite-traders-v1';
  const TRADE_EXIT_SETTINGS_STORAGE_KEY = 'tornscripture-imm-trader-market-overlay-settings-v1';
  const PRICED_TRADE_SESSION_KEY = 'tornscripture-imm-priced-trade-session-v1';
  const PRICED_TRADE_STYLE_ID = 'tsimm-priced-trade-style';
  const PRICED_TRADE_PANEL_ID = 'tsimm-priced-trade-panel';
  const PRICED_TRADE_BADGE_CLASS = 'tsimm-priced-trade-badge';
  const PRICED_TRADE_ROW_CLASS = 'tsimm-priced-trade-row';
  const PRICED_TRADE_MAX_CLASS = 'tsimm-priced-trade-native-max';
  const PRICED_TRADE_PANEL_EXPANDED_KEY = 'tornscripture-imm-priced-trade-panel-expanded-v1';
  const PRICED_TRADE_TTL_MS = 12 * 60 * 60 * 1000;
  let pricedTradePickerObserver = null;
  let pricedTradeObservedSurface = null;
  let pricedTradeRepaintSettleTimer = null;
  let pricedTradeQuantityTimer = null;
  let pricedTradePendingQuantityRow = null;
  let pricedTradeLastInteractedRow = null;
  let pricedTradeScrollQuietTimer = null;
  let pricedTradeScrollActiveUntil = 0;
  let pricedTradeDeferredFullRepaint = false;
  let pricedTradeDeferredRow = null;
  const PRICED_TRADE_SCROLL_QUIET_MS = 650;
  const pricedTradeExpandedBadgeTokens = new Set();

  function tradeExitFavoriteRefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(TRADE_EXIT_FAVORITES_STORAGE_KEY) || 'null');
      const source = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
      return source.map((entry) => ({
        traderId: normalizeWhitespace(entry?.traderId ?? entry?.id),
        traderName: normalizeWhitespace(entry?.traderName ?? entry?.name),
      })).filter((entry) => entry.traderId || entry.traderName);
    } catch {
      return [];
    }
  }


  function tradeExitTraderIsFavorite(trader, refs) {
    if (!trader || !traderRecommendationsEligible(trader)) return false;
    return refs.some((entry) =>
      (entry.traderId && entry.traderId === trader.id)
      || (entry.traderName && normalizeName(entry.traderName) === trader.normalizedName)
    );
  }

  function tradeExitFreshness(capturedAt) {
    const settings = loadJson(TRADE_EXIT_SETTINGS_STORAGE_KEY, {});
    const freshHours = Math.max(1, Number(settings.freshAgeHours) || 72);
    const actionableHours = Math.max(freshHours, Number(settings.actionableAgeHours) || 168);
    const capturedTime = Date.parse(capturedAt || '');
    if (!Number.isFinite(capturedTime)) {
      return { status: 'missing', ageMs: null, ageLabel: 'unknown age' };
    }
    const ageMs = Math.max(0, Date.now() - capturedTime);
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageLabel = ageMinutes < 60
      ? `${ageMinutes}m old`
      : ageMinutes < 2880
        ? `${Math.floor(ageMinutes / 60)}h old`
        : `${Math.floor(ageMinutes / 1440)}d old`;
    if (ageMs <= freshHours * 3600000) return { status: 'fresh', ageMs, ageLabel };
    if (ageMs <= actionableHours * 3600000) return { status: 'stale', ageMs, ageLabel };
    return { status: 'outdated', ageMs, ageLabel };
  }

  function tradeExitQuoteForTrader(trader, item) {
    if (!trader || !item) return null;
    const itemName = normalizeName(item.name ?? item.itemName);
    const itemId = Number(item.itemId) > 0 ? Number(item.itemId) : null;
    const capturedItem = (trader.pricePageItems || []).find((candidate) =>
      (itemId && Number(candidate.itemId) > 0 && Number(candidate.itemId) === itemId)
      || normalizeName(candidate.itemName) === itemName
    );
    if (!capturedItem || Number(capturedItem.unitPrice) <= 0) return null;
    const capturedAt = trader.pricePageLastCheckedAt || trader.pricePageCapturedAt || null;
    return {
      traderId: trader.id,
      traderName: trader.name,
      unitPrice: Number(capturedItem.unitPrice),
      capturedAt,
      freshness: tradeExitFreshness(capturedAt),
      source: 'captured price list',
    };
  }




  function singleItemTraderQuotes(stats = state.lastScan) {
    if (!String(stats?.pageType || '').startsWith('item listings')) return [];
    const itemId = Number(stats?.listingItemId) > 0 ? Number(stats.listingItemId) : null;
    const itemName = normalizeWhitespace(stats?.listingItemName);
    if (!itemId && !itemName) return [];
    const currentPrice = Number(stats?.listingLowestPrice) > 0 ? Number(stats.listingLowestPrice) : null;
    const favoriteRefs = tradeExitFavoriteRefs();
    const freshnessRank = { fresh: 0, stale: 1, outdated: 2, missing: 3 };
    return state.traders
      .filter(traderRecommendationsEligible)
      .map((trader) => {
        const quote = tradeExitQuoteForTrader(trader, { itemId, itemName, name: itemName });
        if (!quote) return null;
        const profitEach = currentPrice === null ? null : Number(quote.unitPrice) - currentPrice;
        const roiPercent = currentPrice && profitEach !== null ? profitEach / currentPrice * 100 : null;
        return {
          ...quote,
          trader,
          favorite: tradeExitTraderIsFavorite(trader, favoriteRefs),
          profitEach,
          roiPercent,
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        Number(freshnessRank[left.freshness?.status] ?? 9) - Number(freshnessRank[right.freshness?.status] ?? 9)
        || Number(right.unitPrice) - Number(left.unitPrice)
        || Number(right.favorite) - Number(left.favorite)
        || String(left.traderName || '').localeCompare(String(right.traderName || ''))
      );
  }

  function singleItemTraderQuotesHtml(stats = state.lastScan) {
    if (!String(stats?.pageType || '').startsWith('item listings')) return '';
    const itemName = normalizeWhitespace(stats?.listingItemName) || 'this item';
    const currentPrice = Number(stats?.listingLowestPrice) > 0 ? Number(stats.listingLowestPrice) : null;
    const quotes = singleItemTraderQuotes(stats);
    const limit = Number(state.settings.itemTraderQuoteLimit) === 5 ? 5 : 3;
    const visible = quotes.slice(0, limit);
    const rows = visible.map((quote, index) => {
      const freshness = quote.freshness?.status || 'missing';
      const profitKnown = Number.isFinite(quote.profitEach);
      const profitClass = !profitKnown ? '' : quote.profitEach >= 0 ? 'profit' : 'loss';
      const profitText = profitKnown
        ? `${quote.profitEach >= 0 ? '+' : ''}${formatMoney(quote.profitEach)} · ${formatPercent(quote.roiPercent)}`
        : 'Open listing price unresolved';
      const links = [
        quote.trader?.tradeUrl ? `<a href="${escapeHtml(quote.trader.tradeUrl)}">Trade</a>` : '',
        quote.trader?.pricePageUrl ? `<a href="${escapeHtml(quote.trader.pricePageUrl)}">Prices</a>` : '',
        quote.trader?.profileUrl ? `<a href="${escapeHtml(quote.trader.profileUrl)}">Profile</a>` : '',
      ].filter(Boolean).join('');
      return `<div class="tsimm-item-trader-row ${escapeHtml(freshness)}">
        <div class="tsimm-item-trader-name"><strong>#${index + 1} ${quote.favorite ? '★ ' : ''}${escapeHtml(quote.traderName)}</strong><span>${escapeHtml(quote.freshness?.ageLabel || 'unknown age')} · ${escapeHtml(freshness)}</span></div>
        <div class="tsimm-item-trader-money"><strong>${escapeHtml(formatMoney(quote.unitPrice))}</strong><span class="${escapeHtml(profitClass)}">${escapeHtml(profitText)}</span></div>
        ${links ? `<div class="tsimm-item-trader-links">${links}</div>` : ''}
      </div>`;
    }).join('');
    const toggle = quotes.length > 3
      ? `<button type="button" data-tsimm-action="item-trader-quotes-toggle">${limit === 5 ? 'Show top 3' : `Show top ${Math.min(5, quotes.length)}`}</button>`
      : '';
    const subtitle = currentPrice === null
      ? `${escapeHtml(itemName)} · current listing unresolved`
      : `${escapeHtml(itemName)} · lowest visible ${escapeHtml(formatMoney(currentPrice))}`;
    const empty = '<div class="tsimm-item-trader-empty">No active trader has a captured price for this item yet.</div>';
    return `<section class="tsimm-item-trader-card">
      <div class="tsimm-item-trader-head"><div><strong>🤝 Best trader exits</strong><span>${subtitle}</span></div>${toggle}</div>
      <div class="tsimm-item-trader-list">${rows || empty}</div>
    </section>`;
  }

  function loadPricedTradeSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(PRICED_TRADE_SESSION_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return null;
      if (!Number.isFinite(Number(raw.expiresAt)) || Number(raw.expiresAt) <= Date.now()) {
        sessionStorage.removeItem(PRICED_TRADE_SESSION_KEY);
        return null;
      }
      return {
        traderId: normalizeWhitespace(raw.traderId),
        traderName: normalizeWhitespace(raw.traderName),
        userId: Number(raw.userId) > 0 ? Number(raw.userId) : null,
        armedAt: Number(raw.armedAt) || Date.now(),
        expiresAt: Number(raw.expiresAt),
        tradeUrl: normalizeHttpUrl(raw.tradeUrl),
      };
    } catch {
      return null;
    }
  }

  function savePricedTradeSession(session) {
    try {
      if (!session) sessionStorage.removeItem(PRICED_TRADE_SESSION_KEY);
      else sessionStorage.setItem(PRICED_TRADE_SESSION_KEY, JSON.stringify(session));
      return true;
    } catch {
      return false;
    }
  }


  function clearPricedTradeSession(message = '') {
    savePricedTradeSession(null);
    clearTimeout(pricedTradeRepaintSettleTimer);
    clearTimeout(pricedTradeQuantityTimer);
    clearTimeout(pricedTradeScrollQuietTimer);
    pricedTradeRepaintSettleTimer = null;
    pricedTradeQuantityTimer = null;
    pricedTradeScrollQuietTimer = null;
    pricedTradeScrollActiveUntil = 0;
    pricedTradeDeferredFullRepaint = false;
    pricedTradeDeferredRow = null;
    pricedTradePendingQuantityRow = null;
    pricedTradeLastInteractedRow = null;
    pricedTradeExpandedBadgeTokens.clear();
    clearPricedTradeAnnotations();
    syncPricedTradePickerObserver();
    if (message) toast(message);
  }

  function pricedTradeArmedTrader(session = loadPricedTradeSession()) {
    if (!session) return null;
    const wantedName = normalizeName(session.traderName);
    return state.traders.find((trader) =>
      (session.traderId && trader.id === session.traderId)
      || (session.userId && Number(trader.userId) === Number(session.userId))
      || (wantedName && trader.normalizedName === wantedName)
    ) || null;
  }

  function startPricedTrade(trader) {
    if (!trader?.tradeUrl) {
      toast('This trader does not have a saved trade link.');
      return false;
    }
    const priceCount = Array.isArray(trader.pricePageItems) ? trader.pricePageItems.length : 0;
    if (!priceCount) {
      toast(`${trader.name} has no captured prices yet.`);
      return false;
    }
    const session = {
      traderId: trader.id,
      traderName: trader.name,
      userId: Number(trader.userId) > 0 ? Number(trader.userId) : null,
      armedAt: Date.now(),
      expiresAt: Date.now() + PRICED_TRADE_TTL_MS,
      tradeUrl: trader.tradeUrl,
    };
    if (!savePricedTradeSession(session)) {
      toast('Priced Trade could not save its handoff in this tab.');
      return false;
    }
    closeTraders();
    toast(`Priced Trade armed for ${trader.name}: ${formatInteger(priceCount)} captured prices.`);
    setTimeout(() => location.assign(trader.tradeUrl), 120);
    return true;
  }

  function pricedTradeMutationElement(node) {
    if (node?.nodeType === Node.TEXT_NODE) return node.parentElement;
    return node instanceof Element ? node : null;
  }

  function pricedTradeGeneratedMutationNode(node) {
    const element = pricedTradeMutationElement(node);
    return Boolean(element?.matches?.(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)
      || element?.closest?.(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`));
  }

  function pricedTradeMutationNeedsRepaint(mutation) {
    if (mutation.type === 'characterData') {
      return !pricedTradeGeneratedMutationNode(mutation.target)
        && Boolean(normalizeWhitespace(mutation.target?.textContent));
    }
    const changedNodes = [
      ...(mutation.addedNodes || []),
      ...(mutation.removedNodes || []),
    ];
    return changedNodes.some((node) => !pricedTradeGeneratedMutationNode(node));
  }


  function pricedTradeScrollIsActive() {
    return Date.now() < pricedTradeScrollActiveUntil;
  }

  function schedulePricedTradeScrollSettle() {
    clearTimeout(pricedTradeScrollQuietTimer);
    const remaining = Math.max(40, pricedTradeScrollActiveUntil - Date.now() + 40);
    pricedTradeScrollQuietTimer = setTimeout(() => {
      pricedTradeScrollQuietTimer = null;
      if (pricedTradeScrollIsActive()) {
        schedulePricedTradeScrollSettle();
        return;
      }
      pricedTradeScrollActiveUntil = 0;
      pricedTradeDeferredRow = null;
      pricedTradeDeferredFullRepaint = false;
      if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
      pricedTradeReconcileVisibleRows();
    }, remaining);
  }


  function capturePricedTradeScroll(event) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
    const target = event?.target instanceof Element ? event.target : null;
    if (target?.closest?.(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    pricedTradeScrollActiveUntil = Date.now() + PRICED_TRADE_SCROLL_QUIET_MS;
    clearTimeout(pricedTradeRepaintSettleTimer);
    clearTimeout(pricedTradeQuantityTimer);
    clearTimeout(pricedTradeScrollQuietTimer);
    pricedTradeRepaintSettleTimer = null;
    pricedTradeQuantityTimer = null;
    pricedTradeScrollQuietTimer = null;
    pricedTradePendingQuantityRow = null;
    pricedTradeDeferredFullRepaint = false;
    pricedTradeDeferredRow = null;
    schedulePricedTradeScrollSettle();
  }


  function schedulePricedTradePickerRepaint(delay = 140) {
    if (!loadPricedTradeSession()) return;
    clearTimeout(pricedTradeRepaintSettleTimer);
    pricedTradeRepaintSettleTimer = setTimeout(() => {
      pricedTradeRepaintSettleTimer = null;
      if (pricedTradeScrollIsActive()) {
        schedulePricedTradeScrollSettle();
        return;
      }
      pricedTradeReconcileVisibleRows();
    }, Math.max(40, Number(delay) || 0));
  }

  function pricedTradeMutationTouchesPicker(mutation, currentSurface = null, previousSurface = null) {
    const target = pricedTradeMutationElement(mutation.target);
    const surfaces = [currentSurface, previousSurface]
      .filter((surface) => surface instanceof Element);
    const touchesSurface = (element) => Boolean(element && surfaces.some((surface) =>
      element === surface || surface.contains(element) || element.contains?.(surface)
    ));
    if (touchesSurface(target)) return true;
    const changedNodes = [
      ...(mutation.addedNodes || []),
      ...(mutation.removedNodes || []),
    ];
    return changedNodes.some((node) => {
      if (pricedTradeGeneratedMutationNode(node)) return false;
      const element = pricedTradeMutationElement(node);
      if (touchesSurface(element)) return true;
      const text = normalizeWhitespace(node?.textContent);
      return /\bqty\b|\bwhich items would you like to add to trade\b|\byou are adding\s+[\d,]+\s+items?\b|\badd\s+to\s+trade\b|\bx\s*[\d,]+\b/i.test(text)
        || Boolean(element?.matches?.('img,input[type="checkbox"],input[type="radio"],[class*="item" i],[class*="category" i]'))
        || Boolean(element?.querySelector?.('img,input[type="checkbox"],input[type="radio"]'));
    });
  }


  function pricedTradeMutationRows(mutation) {
    const rows = new Set();
    const nodes = [
      mutation.target,
      ...(mutation.addedNodes || []),
    ];
    for (const node of nodes) {
      const element = pricedTradeMutationElement(node);
      if (!element || pricedTradeGeneratedMutationNode(element)) continue;
      const row = element.matches?.(`.${PRICED_TRADE_ROW_CLASS}`)
        ? element
        : element.closest?.(`.${PRICED_TRADE_ROW_CLASS}`);
      if (row instanceof Element && row.isConnected) rows.add(row);
    }
    return [...rows];
  }

  function syncPricedTradePickerObserver() {
    const session = loadPricedTradeSession();
    if (!session || !document.body) {
      pricedTradePickerObserver?.disconnect();
      pricedTradePickerObserver = null;
      pricedTradeObservedSurface = null;
      return;
    }

    const currentSurface = pricedTradeInventorySurface();
    const observeTarget = currentSurface instanceof Element ? currentSurface : document.body;
    if (pricedTradePickerObserver && pricedTradeObservedSurface === observeTarget) return;

    pricedTradePickerObserver?.disconnect();
    pricedTradePickerObserver = null;
    pricedTradeObservedSurface = observeTarget;

    pricedTradePickerObserver = new MutationObserver((mutations) => {
      if (!loadPricedTradeSession()) {
        syncPricedTradePickerObserver();
        return;
      }
      if (!(pricedTradeObservedSurface instanceof Element) || !pricedTradeObservedSurface.isConnected) {
        syncPricedTradePickerObserver();
        schedulePricedTradePickerRepaint(45);
        return;
      }
      if (pricedTradeScrollIsActive()) return;
      const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
      if (pricedTradeIsQuantityControl(activeElement)) return;

      const resolvedSurface = pricedTradeInventorySurface();
      const nextSurface = resolvedSurface instanceof Element ? resolvedSurface : null;
      if (nextSurface && nextSurface !== pricedTradeObservedSurface) {
        syncPricedTradePickerObserver();
        schedulePricedTradePickerRepaint(45);
        return;
      }
      const mutationSurface = nextSurface || (pricedTradeObservedSurface === document.body ? null : pricedTradeObservedSurface);
      const rowUpdates = new Set();
      let needsFullRepaint = false;
      for (const mutation of mutations) {
        if (!pricedTradeMutationNeedsRepaint(mutation)) continue;
        const rows = pricedTradeMutationRows(mutation);
        if (rows.length) {
          rows.forEach((row) => rowUpdates.add(row));
          continue;
        }
        if (pricedTradeMutationTouchesPicker(mutation, mutationSurface, mutationSurface)) {
          needsFullRepaint = true;
          break;
        }
      }
      if (needsFullRepaint) {
        schedulePricedTradePickerRepaint(70);
        return;
      }
      const verification = pricedTradeVerification(state.lastScan || {});
      const trader = verification.status === 'verified' ? verification.trader : null;
      if (trader && [...rowUpdates].some((row) => pricedTradeRowNeedsDecoration(row, trader))) {
        schedulePricedTradePickerRepaint(70);
      }
    });
    pricedTradePickerObserver.observe(observeTarget, {
      childList: true,
      subtree: true,
    });
  }


  function pricedTradeIsQuantityControl(target) {
    if (!(target instanceof Element)) return false;
    const role = String(target.getAttribute?.('role') || '').toLowerCase();
    const type = String(target.getAttribute?.('type') || '').toLowerCase();
    const label = pricedTradeControlLabel(target);
    return ['checkbox', 'radio', 'number'].includes(type)
      || role === 'spinbutton'
      || target.getAttribute?.('contenteditable') === 'true'
      || /\b(?:qty|quantity|amount)\b/i.test(label)
      || /(?:qty|quantity|amount)/i.test(String(target.className || ''));
  }

  function capturePricedTradePickerInteraction(event) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    if (pricedTradeIsQuantityControl(target)) return;
    if (pricedTradeScrollIsActive()) return;
    const picker = pricedTradePickerEvidence();
    const previousSurface = pricedTradeObservedSurface;
    const insidePrevious = previousSurface instanceof Element
      && previousSurface.isConnected
      && previousSurface.contains(target);
    if (!picker.active && !insidePrevious) return;

    const trader = pricedTradeArmedTrader();
    const row = trader
      ? (target.closest(`.${PRICED_TRADE_ROW_CLASS}`) || pricedTradeRowForControl(target, trader))
      : null;
    if (row instanceof Element && row.isConnected) {
      pricedTradeLastInteractedRow = row;
      if (pricedTradeRowNeedsDecoration(row, trader)) schedulePricedTradePickerRepaint(90);
      return;
    }
    schedulePricedTradePickerRepaint(80);
  }

  function pricedTradeVerification(stats) {
    const session = loadPricedTradeSession();
    if (!session) return { status: 'inactive', session: null, trader: null, currentTrader: null, verificationSource: '' };
    const trader = pricedTradeArmedTrader(session);
    if (!trader) return { status: 'missing-trader', session, trader: null, currentTrader: null, verificationSource: '' };
    const currentTrader = currentTradeTrader(stats);
    const counterpartyId = Number(stats?.tradeCounterpartyId) > 0 ? Number(stats.tradeCounterpartyId) : null;
    const counterpartyName = normalizeName(stats?.tradeCounterparty);
    const idMatches = Boolean(
      counterpartyId
      && Number(trader.userId) > 0
      && Number(trader.userId) === counterpartyId
    );
    const nameMatches = Boolean(counterpartyName && trader.normalizedName === counterpartyName);
    const currentMatches = Boolean(currentTrader && currentTrader.id === trader.id);
    if (!counterpartyId && !counterpartyName && !currentTrader) {
      const picker = pricedTradePickerEvidence();
      const recentHandoff = Date.now() - Number(session.armedAt || 0) <= 15 * 60 * 1000;
      const tornHost = /(^|\.)torn\.com$/i.test(location.hostname);
      if (picker.active && recentHandoff && tornHost) {
        return {
          status: 'verified',
          session,
          trader,
          currentTrader: null,
          verificationSource: 'armed-picker',
        };
      }
      return { status: 'waiting', session, trader, currentTrader: null, verificationSource: '' };
    }
    const verified = idMatches || nameMatches || currentMatches;
    return {
      status: verified ? 'verified' : 'mismatch',
      session,
      trader,
      currentTrader,
      verificationSource: verified ? 'live-counterparty' : 'live-mismatch',
    };
  }

  function pricedTradePanelExpanded() {
    try {
      return sessionStorage.getItem(PRICED_TRADE_PANEL_EXPANDED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setPricedTradePanelExpanded(expanded) {
    try {
      sessionStorage.setItem(PRICED_TRADE_PANEL_EXPANDED_KEY, expanded ? '1' : '0');
    } catch {}
  }

  function injectPricedTradeStyles() {
    if (!document.head || document.getElementById(PRICED_TRADE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = PRICED_TRADE_STYLE_ID;
    style.textContent = `
      #${PRICED_TRADE_PANEL_ID}{position:fixed;left:50%;top:max(64px,calc(env(safe-area-inset-top) + 54px));z-index:2147483040;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 6px;align-items:center;width:min(420px,calc(100vw - 18px));padding:5px 6px;transform:translateX(-50%);border:1px solid #57d972;border-radius:8px;background:#07180cf5;color:#d6ffcd;box-shadow:0 8px 24px #000a;font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-sizing:border-box}
      #${PRICED_TRADE_PANEL_ID}.inline{position:sticky;left:auto;top:0;z-index:40;width:auto;max-width:100%;margin:0 0 5px;transform:none}#${PRICED_TRADE_PANEL_ID}.waiting{border-color:#4f9bc5;background:#071723f5;color:#c9ecff}#${PRICED_TRADE_PANEL_ID}.mismatch,#${PRICED_TRADE_PANEL_ID}.missing-trader{border-color:#cf5866;background:#250a0df5;color:#ffc2c8}
      #${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-summary{appearance:none;display:grid;grid-template-columns:minmax(0,1fr);gap:1px;min-width:0;margin:0;padding:0;border:0;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}
      #${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-summary strong,#${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-summary span,#${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-summary small{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-summary strong{font-size:9px}#${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-summary span{color:#8fbd96;font-size:7px}#${PRICED_TRADE_PANEL_ID}.waiting .tsimm-priced-trade-summary span{color:#82b6d4}#${PRICED_TRADE_PANEL_ID}.mismatch .tsimm-priced-trade-summary span,#${PRICED_TRADE_PANEL_ID}.missing-trader .tsimm-priced-trade-summary span{color:#d89198}
      #${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-summary small{display:none;margin-top:2px;padding-top:3px;border-top:1px solid #285f35;color:#a9cbb0;font-size:7px;white-space:normal}#${PRICED_TRADE_PANEL_ID}.expanded .tsimm-priced-trade-summary small{display:block}#${PRICED_TRADE_PANEL_ID}.waiting .tsimm-priced-trade-summary small{border-top-color:#315d73;color:#9fc5d8}#${PRICED_TRADE_PANEL_ID}.mismatch .tsimm-priced-trade-summary small,#${PRICED_TRADE_PANEL_ID}.missing-trader .tsimm-priced-trade-summary small{border-top-color:#74303a;color:#d8a1a8}
      #${PRICED_TRADE_PANEL_ID} .tsimm-priced-trade-clear{align-self:stretch;border:1px solid #75616a;border-radius:6px;background:#2a1c21;color:#ffd9df;padding:4px 7px;font:800 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      .${PRICED_TRADE_ROW_CLASS}{position:relative!important;overflow-anchor:none!important;box-shadow:inset 3px 0 #47c968!important}.${PRICED_TRADE_ROW_CLASS}.stale{box-shadow:inset 3px 0 #c59a39!important}.${PRICED_TRADE_ROW_CLASS}.outdated{box-shadow:inset 3px 0 #b65466!important}.${PRICED_TRADE_ROW_CLASS}.missing{box-shadow:inset 3px 0 #66717a!important}
      .${PRICED_TRADE_BADGE_CLASS}{display:grid!important;gap:0!important;width:min(210px,48vw)!important;max-width:min(210px,48vw)!important;position:relative!important;height:30px!important;min-height:30px!important;max-height:30px!important;overflow:hidden!important;overflow-anchor:none!important;align-content:start!important;margin:1px 4px!important;padding:3px 5px!important;border:1px solid #47c968!important;border-radius:4px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:auto!important;cursor:pointer!important;box-sizing:border-box!important}
      .${PRICED_TRADE_BADGE_CLASS}.expanded{height:auto!important;min-height:30px!important;max-height:126px!important;overflow:auto!important}
      .${PRICED_TRADE_BADGE_CLASS} strong,.${PRICED_TRADE_BADGE_CLASS} span{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;pointer-events:none!important}.${PRICED_TRADE_BADGE_CLASS} span{color:#7ebd89!important;font-size:7px!important}
      .${PRICED_TRADE_BADGE_CLASS}.stale{border-color:#c59a39!important;background:#2a2008f2!important;color:#ffe09a!important}.${PRICED_TRADE_BADGE_CLASS}.stale span{color:#c5ad73!important}
      .${PRICED_TRADE_BADGE_CLASS}.outdated{border-color:#b65466!important;background:#270b10f2!important;color:#ffb0bc!important}.${PRICED_TRADE_BADGE_CLASS}.outdated span{color:#c98d96!important}
      .${PRICED_TRADE_BADGE_CLASS}.missing{border-color:#65727a!important;background:#14191cf2!important;color:#c1cbd1!important}.${PRICED_TRADE_BADGE_CLASS}.missing span{color:#8d999f!important}
      .${PRICED_TRADE_BADGE_CLASS}.ledger-profit{border-color:#47c968!important;background:#082611f2!important;color:#caffba!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-loss{border-color:#dc5568!important;background:#310b12f2!important;color:#ffc0c9!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-even{border-color:#8a9298!important;background:#191d20f2!important;color:#e1e5e8!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-unknown{border-color:#65727a!important;background:#14191cf2!important;color:#c1cbd1!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-partial{border-color:#c59a39!important;background:#2a2008f2!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact{display:grid!important;gap:0!important;min-width:0!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact-line{font-size:8.5px!important;line-height:1!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact-sub{color:#9fb4a3!important;font-size:6.5px!important;line-height:1!important}
      .${PRICED_TRADE_BADGE_CLASS}.ledger-loss .tsimm-priced-trade-compact-sub{color:#dba0a8!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-partial .tsimm-priced-trade-compact-sub{color:#d3bc82!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-unknown .tsimm-priced-trade-compact-sub{color:#a8b2b8!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-details{display:none!important;gap:1px!important;margin-top:2px!important;padding-top:2px!important;border-top:1px solid #315d39!important}
      .${PRICED_TRADE_BADGE_CLASS}.expanded .tsimm-priced-trade-details{display:grid!important}
      .${PRICED_TRADE_BADGE_CLASS}.ledger-loss .tsimm-priced-trade-details{border-top-color:#74303a!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-partial .tsimm-priced-trade-details{border-top-color:#7c6125!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-unknown .tsimm-priced-trade-details{border-top-color:#566068!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict,.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-comparison,.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-meta{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict{font-size:9px!important;line-height:1.15!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.profit{color:#83f19a!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.loss{color:#ff8f9d!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.even{color:#e0e0e0!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.unknown{color:#b3bec4!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-comparison{margin-top:1px!important;color:#d7ded9!important;font-size:7px!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-meta{color:#87948c!important;font-size:7px!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best{margin-top:2px!important;padding-top:2px!important;border-top:1px solid #725d21!important;color:#ffd76f!important;font-size:8px!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best.better{color:#8edcff!important;border-top-color:#315f73!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best.stale{color:#d7b66b!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best-detail{color:#83b7cc!important;font-size:7px!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
      .${PRICED_TRADE_ROW_CLASS}.decision-profit{box-shadow:inset 3px 0 #47c968!important}.${PRICED_TRADE_ROW_CLASS}.decision-loss{box-shadow:inset 3px 0 #dc5568!important}.${PRICED_TRADE_ROW_CLASS}.decision-even{box-shadow:inset 3px 0 #8a9298!important}.${PRICED_TRADE_ROW_CLASS}.decision-partial{box-shadow:inset 3px 0 #c59a39!important}.${PRICED_TRADE_ROW_CLASS}.decision-unknown{box-shadow:inset 3px 0 #65727a!important}
      .${PRICED_TRADE_MAX_CLASS}{display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important;flex:0 0 auto!important;width:38px!important;min-width:38px!important;height:28px!important;margin:0 0 0 4px!important;padding:0!important;border:1px solid #63e47c!important;border-radius:5px!important;background:#0d3818!important;color:#d4ffc8!important;font:900 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;line-height:26px!important;text-align:center!important;pointer-events:auto!important;cursor:pointer!important;z-index:2!important;box-sizing:border-box!important}
      .${PRICED_TRADE_MAX_CLASS}:active{transform:translateY(1px)!important;background:#175226!important}
      .tsimm-priced-trade-start{border-color:#47c968!important;background:#0d3818!important;color:#d4ffc8!important}
    `;
    document.head.appendChild(style);
  }


  function clearPricedTradeAnnotations() {
    document.getElementById(PRICED_TRADE_PANEL_ID)?.remove();
    clearPricedTradeRowAnnotations();
  }

  function pricedTradeControlLabel(element) {
    if (!(element instanceof Element)) return '';
    return normalizeWhitespace([
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('value'),
      element.getAttribute('class'),
    ].filter(Boolean).join(' '));
  }


  function pricedTradeDirectQtyElements(root = document) {
    const scope = root instanceof Document
      ? (root.body || root.documentElement)
      : root instanceof Element ? root : null;
    if (!scope) return [];
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const results = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!/^qty$/i.test(normalizeWhitespace(node.nodeValue))) continue;
      const element = node.parentElement;
      if (!element || !visibleElement(element) || element.closest(ignored)) continue;
      results.add(element);
    }
    for (const element of scope.querySelectorAll('[class*="qty" i],[aria-label*="qty" i],[title*="qty" i]')) {
      if (!visibleElement(element) || element.closest(ignored)) continue;
      const label = pricedTradeControlLabel(element);
      if (/\bqty\b/i.test(label) && label.length <= 80) results.add(element);
    }
    return [...results];
  }

  function pricedTradeControlElements(root = document) {
    if (!(root instanceof Document || root instanceof Element)) return [];
    const controls = [...root.querySelectorAll('button,a,[role="button"],input,select,label')];
    controls.push(...pricedTradeDirectQtyElements(root));
    return [...new Set(controls)];
  }

  function pricedTradeNativeAddControl(row) {
    if (!(row instanceof Element)) return null;
    const controls = pricedTradeControlElements(row)
      .filter((control) =>
        visibleElement(control)
        && !control.disabled
        && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},[data-tsimm-generated]`)
      );
    return controls.find((control) => {
      const label = pricedTradeControlLabel(control);
      if (/\b(?:remove|delete|trash|withdraw)\b/i.test(label)) return false;
      if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(String(control.type || '').toLowerCase())) return true;
      if (/^qty$/i.test(normalizeWhitespace(ownText(control) || control.textContent))) return true;
      return /\b(?:add|select|choose|include|qty|quantity)\b/i.test(label)
        || /(?:add|select|choose|include|qty|quantity|plus)/i.test(String(control.className || ''))
        || /^\s*\+\s*$/.test(label);
    }) || null;
  }

  function pricedTradeItemForRow(row, trader) {
    if (!(row instanceof Element) || !trader) return null;
    const itemId = itemIdFromTradeRow(row);
    const priceItems = Array.isArray(trader.pricePageItems) ? trader.pricePageItems : [];
    if (itemId) {
      const captured = priceItems.find((item) => Number(item.itemId) > 0 && Number(item.itemId) === itemId);
      const catalog = catalogItemFor('', itemId);
      if (captured || catalog) {
        return {
          id: catalog?.id || captured?.itemId || itemId,
          name: catalog?.name || captured?.itemName || `Item ${itemId}`,
        };
      }
    }
    const labels = [
      ...row.querySelectorAll('[data-item-name],img[alt],img[title],[aria-label],[title],strong,b,span,p'),
    ].flatMap((element) => [
      element.getAttribute?.('data-item-name'),
      element.getAttribute?.('alt'),
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label'),
      ownText(element),
    ]).map(normalizeWhitespace).filter((label) => label && label.length <= 100);
    for (const label of labels) {
      const catalog = catalogItemFor(label);
      if (catalog) return { id: catalog.id || null, name: catalog.name };
      const captured = priceItems.find((item) => normalizeName(item.itemName) === normalizeName(label));
      if (captured) return { id: captured.itemId || null, name: captured.itemName };
    }
    const haystack = ` ${normalizeName(row.innerText || row.textContent)} `;
    const captured = priceItems
      .filter((item) => item?.itemName)
      .sort((left, right) => String(right.itemName).length - String(left.itemName).length)
      .find((item) => haystack.includes(` ${normalizeName(item.itemName)} `));
    if (captured) return { id: captured.itemId || null, name: captured.itemName };
    const catalog = Object.values(state.catalog.itemsByName || {})
      .filter((item) => item?.name && haystack.includes(` ${item.normalizedName} `))
      .sort((left, right) => right.normalizedName.length - left.normalizedName.length)[0];
    return catalog ? { id: catalog.id || null, name: catalog.name } : null;
  }


  function pricedTradeAvailableQuantity(row, itemName = '') {
    if (!(row instanceof Element)) return null;
    const limits = [...row.querySelectorAll('input,[role="spinbutton"]')].flatMap((input) => [
      input.getAttribute('max'),
      input.getAttribute('data-max'),
      input.getAttribute('aria-valuemax'),
    ]).map(parseNumber).filter((value) => Number.isFinite(value) && value > 0);
    if (limits.length) return Math.max(1, Math.floor(Math.max(...limits)));
    const text = normalizeWhitespace(row.innerText || row.textContent).replace(itemName, ' ');
    for (const pattern of [
      /\b(?:available|owned|quantity|qty|amount|stock)\D{0,16}([\d,]+)/i,
      /(?:\bx|×)\s*([\d,]+)\b/i,
      /\(([\d,]+)\)/,
    ]) {
      const quantity = parseNumber(text.match(pattern)?.[1]);
      if (Number.isFinite(quantity) && quantity > 0) return Math.max(1, Math.floor(quantity));
    }
    const singleControl = [...row.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .find((control) => visibleElement(control) && !control.disabled);
    if (singleControl) return 1;
    if ([...row.querySelectorAll('img')].some((image) => visibleElement(image))) return 1;
    return null;
  }

  function pricedTradeSelectedQuantity(row) {
    if (!(row instanceof Element)) return { selected: false, quantity: 0, source: '' };
    const singleControl = [...row.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .find((control) => visibleElement(control) && !control.disabled);
    if (singleControl) {
      return {
        selected: Boolean(singleControl.checked),
        quantity: singleControl.checked ? 1 : 0,
        source: 'single-control',
      };
    }

    const selector = [
      'input:not([type="checkbox"]):not([type="radio"])',
      'select',
      '[role="spinbutton"]',
      '[contenteditable="true"]',
      '[class*="qty" i]',
      '[class*="quantity" i]',
      '[aria-label*="qty" i]',
      '[aria-label*="quantity" i]',
      '[title*="qty" i]',
      '[title*="quantity" i]',
      '[data-qty]',
      '[data-quantity]',
    ].join(',');
    const controls = [...new Set([
      ...row.querySelectorAll(selector),
      ...pricedTradeDirectQtyElements(row),
    ])].filter((control) =>
      visibleElement(control)
      && !control.disabled
      && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)
    );

    for (const control of controls) {
      const role = String(control.getAttribute?.('role') || '').toLowerCase();
      const label = pricedTradeControlLabel(control);
      const inputLike = control instanceof HTMLInputElement
        || control instanceof HTMLSelectElement
        || role === 'spinbutton'
        || control.getAttribute?.('contenteditable') === 'true';
      const quantityHint = inputLike
        || /\b(?:qty|quantity|amount)\b/i.test(label)
        || /(?:qty|quantity|amount)/i.test(String(control.className || ''));
      if (!quantityHint) continue;
      const values = [
        control.value,
        control.getAttribute?.('aria-valuenow'),
        control.getAttribute?.('data-selected-quantity'),
        control.getAttribute?.('data-current-quantity'),
        control.getAttribute?.('data-qty'),
        control.getAttribute?.('data-quantity'),
        ownText(control),
        control.textContent,
      ];
      for (const candidate of values) {
        const raw = normalizeWhitespace(candidate);
        if (!/^[\d,]+$/.test(raw)) continue;
        const quantity = parseNumber(raw);
        if (Number.isFinite(quantity) && quantity > 0) {
          return { selected: true, quantity: Math.max(1, Math.floor(quantity)), source: 'quantity-control' };
        }
      }
    }
    return { selected: false, quantity: 0, source: '' };
  }

  function pricedTradeQuantityDecision(row, itemName = '') {
    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, itemName)) || 1));
    return {
      availableQuantity,
      selectedQuantity: 0,
      quantity: availableQuantity,
      selected: false,
      mode: 'full-stack',
      source: 'available-quantity',
    };
  }

  function pricedTradeWritableQuantityControl(row) {
    if (!(row instanceof Element)) return null;
    const ignored = `#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const controls = [...row.querySelectorAll('input,select,[role="spinbutton"],[contenteditable="true"]')]
      .filter((control) => visibleElement(control) && !control.disabled && !control.closest(ignored));
    return controls.find((control) => {
      const role = String(control.getAttribute?.('role') || '').toLowerCase();
      const type = String(control.getAttribute?.('type') || '').toLowerCase();
      const label = pricedTradeControlLabel(control);
      if (['checkbox', 'radio', 'number'].includes(type)) return true;
      if (role === 'spinbutton' || control.getAttribute?.('contenteditable') === 'true') return true;
      return /\b(?:qty|quantity|amount)\b/i.test(label)
        || /(?:qty|quantity|amount)/i.test(String(control.className || ''));
    }) || null;
  }

  function pricedTradeNativeMaxPlacementControl(row) {
    if (!(row instanceof Element)) return null;
    const writable = pricedTradeWritableQuantityControl(row);
    if (writable) return writable;
    const nativeControl = pricedTradeNativeAddControl(row);
    if (!(nativeControl instanceof Element)) return null;
    const clickable = nativeControl.matches('button,a,[role="button"],label')
      ? nativeControl
      : nativeControl.closest('button,a,[role="button"],label');
    return clickable instanceof Element && row.contains(clickable) ? clickable : nativeControl;
  }


  function pricedTradeEnsureNativeMaxButton(row, availableQuantity, itemToken) {
    if (!(row instanceof Element) || !row.isConnected) return null;
    const control = pricedTradeNativeMaxPlacementControl(row);
    const token = normalizeWhitespace(itemToken);
    const ownedButtons = pricedTradeOwnedGeneratedElements(row, `.${PRICED_TRADE_MAX_CLASS}`);
    let button = ownedButtons.find((candidate) => candidate.dataset.tsimmItemToken === token)
      || ownedButtons[0]
      || null;
    ownedButtons.filter((candidate) => candidate !== button).forEach((candidate) => candidate.remove());
    if (!(control instanceof Element) || !control.isConnected || !(control.parentElement instanceof Element)) {
      button?.remove();
      return null;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = PRICED_TRADE_MAX_CLASS;
      button.dataset.tsimmGenerated = 'true';
      button.dataset.tsimmAction = 'priced-trade-max';
      button.textContent = 'MAX';
    }
    const quantity = Math.max(1, Math.floor(Number(availableQuantity) || 1));
    button.dataset.tsimmAvailableQuantity = String(quantity);
    button.dataset.tsimmItemToken = token;
    button.setAttribute('aria-label', `Fill maximum quantity ${quantity}`);
    if (button.parentElement !== control.parentElement || button.previousElementSibling !== control) {
      control.insertAdjacentElement('afterend', button);
    }
    return button;
  }


  function pricedTradeSetQuantityControl(control, quantity) {
    if (!(control instanceof Element)) return false;
    const nextQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    try { control.focus({ preventScroll: true }); } catch { try { control.focus(); } catch {} }

    if (control instanceof HTMLInputElement) {
      const type = String(control.type || '').toLowerCase();
      if (['checkbox', 'radio'].includes(type)) {
        const checkedSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
        if (checkedSetter) checkedSetter.call(control, true);
        else control.checked = true;
      } else {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (valueSetter) valueSetter.call(control, String(nextQuantity));
        else control.value = String(nextQuantity);
      }
    } else if (control instanceof HTMLSelectElement) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (valueSetter) valueSetter.call(control, String(nextQuantity));
      else control.value = String(nextQuantity);
    } else if (control.getAttribute?.('contenteditable') === 'true') {
      control.textContent = String(nextQuantity);
    } else if ('value' in control) {
      control.value = String(nextQuantity);
      control.setAttribute?.('aria-valuenow', String(nextQuantity));
    } else {
      return false;
    }

    pricedTradeScrollActiveUntil = Date.now() + 1000;
    control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    control.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    setTimeout(() => { try { control.blur(); } catch {} }, 20);
    return true;
  }

  function pricedTradeRowByToken(token, trader) {
    const normalizedToken = normalizeWhitespace(token);
    if (!normalizedToken || !trader) return null;
    return pricedTradeResolvedCandidateRows(trader)
      .find((entry) => entry.token === normalizedToken)?.row || null;
  }


  function fillPricedTradeMax(row, requestedQuantity = 0, itemToken = '', attempt = 0) {
    const trader = pricedTradeArmedTrader();
    const liveRow = row instanceof Element && row.isConnected
      ? row
      : pricedTradeRowByToken(itemToken, trader);
    if (!(liveRow instanceof Element) || !trader) {
      toast('MAX could not find this Torn trade row.');
      return false;
    }

    const item = pricedTradeItemForRow(liveRow, trader);
    const availableQuantity = Math.max(
      1,
      Math.floor(Number(requestedQuantity) || Number(pricedTradeAvailableQuantity(liveRow, item?.name || '')) || 1),
    );
    pricedTradeScrollActiveUntil = Date.now() + 1000;
    pricedTradeLastInteractedRow = liveRow;

    let control = pricedTradeWritableQuantityControl(liveRow);
    if (!control && attempt > 0) {
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      if (active && pricedTradeIsQuantityControl(active) && !active.closest('[data-tsimm-generated]')) control = active;
    }
    if (control && pricedTradeSetQuantityControl(control, availableQuantity)) {
      toast(`MAX filled ${formatInteger(availableQuantity)}× ${item?.name || 'item'}.`);
      return true;
    }

    if (attempt === 0) {
      const nativeControl = pricedTradeNativeAddControl(liveRow);
      const nativeLabel = pricedTradeControlLabel(nativeControl);
      if (nativeControl && /\b(?:qty|quantity|amount)\b/i.test(nativeLabel)) {
        nativeControl.click();
        setTimeout(() => fillPricedTradeMax(liveRow, availableQuantity, itemToken, 1), 90);
        return true;
      }
    }

    if (attempt < 4) {
      setTimeout(() => fillPricedTradeMax(liveRow, availableQuantity, itemToken, attempt + 1), 90 + attempt * 70);
      return true;
    }
    toast('Torn did not expose a quantity field. Tap its Qty control once, then press MAX.');
    return false;
  }

  function pricedTradeRowForControl(control, trader) {
    if (!(control instanceof Element) || !trader) return null;
    let fallback = null;
    let node = control;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element) || node === document.body) continue;
      if (node.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) continue;
      if (node.classList.contains(APP.tradeItemMark) || node.closest(`.${APP.tradeItemMark}`)) break;
      const text = normalizeWhitespace(node.innerText || node.textContent);
      if (!text || text.length > 420) continue;
      const item = pricedTradeItemForRow(node, trader);
      if (!item || !pricedTradeNativeAddControl(node)) continue;
      const qtyCount = pricedTradeDirectQtyElements(node).length;
      const singleCount = [...node.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
        .filter((input) => visibleElement(input) && !input.disabled).length;
      if (qtyCount + singleCount !== 1) continue;
      fallback = node;
      if (text.length <= 240) return node;
    }
    return fallback;
  }

  function pricedTradeRowForItemImage(image, trader) {
    if (!(image instanceof Element) || !trader) return null;
    let best = null;
    let node = image;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element) || node === document.body) continue;
      if (node.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) continue;
      if (node.classList.contains(APP.tradeItemMark) || node.closest(`.${APP.tradeItemMark}`)) break;
      const text = normalizeWhitespace(node.innerText || node.textContent);
      if (!text || text.length > 420) continue;
      if (/\b(?:which items would you like to add to trade|add to trade|clear all)\b/i.test(text)) continue;
      const item = pricedTradeItemForRow(node, trader);
      if (!item) continue;
      const itemImages = [...node.querySelectorAll('img')]
        .filter((candidate) => visibleElement(candidate)
          && !candidate.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`));
      if (itemImages.length !== 1) continue;
      const placementControl = pricedTradeNativeMaxPlacementControl(node);
      if (!(placementControl instanceof Element)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 18 || rect.height > 190) continue;
      best = node;
      if (text.length <= 240) return node;
    }
    return best;
  }


  function pricedTradeCandidateRows(trader) {
    const rows = new Set();
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const surface = pricedTradeInventorySurface() || document;
    for (const image of surface.querySelectorAll('img')) {
      if (!visibleElement(image) || image.closest(ignored)) continue;
      const row = pricedTradeRowForItemImage(image, trader);
      if (row) rows.add(row);
    }
    const singleControls = [...surface.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .filter((control) => visibleElement(control) && !control.disabled && !control.closest(ignored));
    for (const control of singleControls) {
      const row = pricedTradeRowForControl(control, trader);
      if (row) rows.add(row);
    }
    return [...rows];
  }

  function pricedTradeRowDepth(row) {
    let depth = 0;
    for (let node = row; node && node !== document.body; node = node.parentElement) depth += 1;
    return depth;
  }

  function pricedTradeResolvedCandidateRows(trader) {
    if (!trader) return [];
    const resolved = pricedTradeCandidateRows(trader).map((row) => {
      const item = pricedTradeItemForRow(row, trader);
      if (!item) return null;
      const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
      const control = pricedTradeNativeMaxPlacementControl(row);
      const rect = row.getBoundingClientRect();
      return {
        row,
        item,
        token,
        hasControl: control instanceof Element,
        area: Math.max(1, rect.width) * Math.max(1, rect.height),
        depth: pricedTradeRowDepth(row),
      };
    }).filter(Boolean);

    resolved.sort((left, right) =>
      Number(right.hasControl) - Number(left.hasControl)
      || left.area - right.area
      || right.depth - left.depth
    );

    const winners = [];
    const seenTokens = new Set();
    for (const entry of resolved) {
      if (seenTokens.has(entry.token)) {
        if (entry.row.classList.contains(PRICED_TRADE_ROW_CLASS)) pricedTradeRemoveRowAnnotation(entry.row);
        continue;
      }
      seenTokens.add(entry.token);
      winners.push(entry);
    }
    return winners;
  }

  function pricedTradePruneNonCanonicalRows(entries) {
    const canonicalRows = new Set((entries || []).map((entry) => entry.row));
    const surface = pricedTradeInventorySurface() || document;
    for (const row of surface.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`)) {
      if (!canonicalRows.has(row)) pricedTradeRemoveRowAnnotation(row);
    }
  }


  function pricedTradePickerEvidence() {
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const bodyText = normalizeWhitespace(document.body?.innerText || document.body?.textContent || '');
    const headingPattern = /\bwhich items would you like to add to trade\??\b/i;
    const summaryPattern = /\byou are adding\s+[\d,]+\s+items?\s+across\s+[\d,]+\s+categor(?:y|ies)\b/i;
    const hasPickerText = headingPattern.test(bodyText) || summaryPattern.test(bodyText);
    const hasAddText = /\badd\s+to\s+trade\b/i.test(bodyText);
    const qtyControls = pricedTradeDirectQtyElements(document)
      .filter((control) => !control.closest(ignored));
    const singleControls = [...document.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .filter((control) => visibleElement(control) && !control.disabled && !control.closest(ignored));
    const itemControls = [...new Set([...qtyControls, ...singleControls])];
    const active = Boolean(hasPickerText && hasAddText);
    let surface = null;
    if (active) {
      const anchors = [...document.querySelectorAll('h1,h2,h3,h4,strong,b,p,span,div')]
        .filter((element) => visibleElement(element) && !element.closest(ignored))
        .filter((element) => {
          const direct = normalizeWhitespace(ownText(element));
          return headingPattern.test(direct) || summaryPattern.test(direct);
        });
      for (const anchor of anchors) {
        let node = anchor;
        for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
          if (!(node instanceof Element) || node === document.body) continue;
          const text = normalizeWhitespace(node.innerText || node.textContent);
          if (!text || text.length > 30000 || !/\badd\s+to\s+trade\b/i.test(text)) continue;
          if (!itemControls.some((control) => node.contains(control))) continue;
          surface = node;
          break;
        }
        if (surface) break;
      }
    }
    return { active, surface, addControl: null, itemControls };
  }

  function pricedTradeInventorySurface() {
    return pricedTradePickerEvidence().surface;
  }

  function renderPricedTradePanel(verification, decorated = 0, priced = 0) {
    injectPricedTradeStyles();
    const inventorySurface = pricedTradeInventorySurface();
    let panel = document.getElementById(PRICED_TRADE_PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PRICED_TRADE_PANEL_ID;
      panel.dataset.tsimmGenerated = 'true';
    }
    if (inventorySurface) {
      if (panel.parentElement !== inventorySurface) inventorySurface.prepend(panel);
    } else if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    const expanded = pricedTradePanelExpanded();
    panel.className = `${verification.status}${inventorySurface ? ' inline' : ''}${expanded ? ' expanded' : ''}`;
    const trader = verification.trader;
    const count = trader?.pricePageItems?.length || 0;
    const capturedAt = trader?.pricePageLastCheckedAt || trader?.pricePageCapturedAt || null;
    const freshness = tradeExitFreshness(capturedAt);
    const title = verification.status === 'verified'
      ? `🤝 ${trader.name} · ${formatInteger(priced)}/${formatInteger(decorated)} priced`
      : verification.status === 'waiting'
        ? `⌛ PRICED TRADE · ${trader?.name || verification.session?.traderName || 'Trader'}`
        : verification.status === 'mismatch'
          ? '⚠ PRICED TRADE MISMATCH'
          : '⚠ PRICED TRADE TRADER MISSING';
    const compactDetail = verification.status === 'verified'
      ? `${formatInteger(count)} captured · ${freshness.ageLabel} · ${verification.verificationSource === 'armed-picker' ? 'armed handoff' : 'live verified'}`
      : verification.status === 'waiting'
        ? `${formatInteger(count)} captured · waiting for Torn participant data`
        : verification.status === 'mismatch'
          ? `Armed for ${trader?.name || verification.session?.traderName} · wrong counterparty`
          : 'Trader Book entry missing · no prices applied';
    const detail = verification.status === 'verified'
      ? verification.verificationSource === 'armed-picker'
        ? `${formatInteger(priced)}/${formatInteger(decorated)} visible addable items priced · armed picker handoff · ${formatInteger(count)} captured prices · ${freshness.ageLabel}`
        : `${formatInteger(priced)}/${formatInteger(decorated)} visible addable items priced · live counterparty verified · ${formatInteger(count)} captured prices · ${freshness.ageLabel}`
      : verification.status === 'waiting'
        ? `${formatInteger(count)} captured prices ready · waiting for Torn to identify the other participant`
        : verification.status === 'mismatch'
          ? `Armed for ${trader?.name || verification.session?.traderName}; this trade is with ${verification.currentTrader?.name || 'someone else'}. No prices were applied.`
          : 'The armed trader is no longer present in Trader Book. No prices were applied.';
    panel.innerHTML = `<button type="button" class="tsimm-priced-trade-summary" data-tsimm-action="priced-trade-toggle" aria-expanded="${expanded ? 'true' : 'false'}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(compactDetail)}</span><small>${escapeHtml(detail)}</small></button><button type="button" class="tsimm-priced-trade-clear" data-tsimm-action="priced-trade-clear">CLEAR</button>`;
  }


  function pricedTradeLedgerProjection(item, quantity, unitPrice) {
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const matchingLots = (state.ledger.lots || [])
      .filter((lot) => lotMatchesTradeItem(lot, { itemId: item.id, name: item.name }))
      .sort((left, right) => Date.parse(left.capturedAt || '') - Date.parse(right.capturedAt || ''));
    let remaining = requestedQuantity;
    let trackedQuantity = 0;
    let costBasis = 0;
    let lotsUsed = 0;
    for (const lot of matchingLots) {
      if (remaining <= 0) break;
      const available = Math.max(0, Math.floor(Number(lot.remainingQuantity) || 0));
      if (!available) continue;
      const allocated = Math.min(remaining, available);
      if (allocated <= 0) continue;
      lotsUsed += 1;
      trackedQuantity += allocated;
      costBasis += allocated * Math.max(0, Number(lot.unitCost) || 0);
      remaining -= allocated;
    }
    const payoutEach = Math.max(0, Number(unitPrice) || 0);
    const proceeds = trackedQuantity * payoutEach;
    const profit = proceeds - costBasis;
    return {
      requestedQuantity,
      trackedQuantity,
      untrackedQuantity: Math.max(0, requestedQuantity - trackedQuantity),
      fullCoverage: trackedQuantity === requestedQuantity,
      lotsUsed,
      costBasis,
      averageCost: trackedQuantity ? costBasis / trackedQuantity : null,
      proceeds,
      profit,
      profitEach: trackedQuantity ? profit / trackedQuantity : null,
    };
  }


  function pricedTradeLedgerHtml(projection, unitPrice) {
    const payoutEach = Math.max(0, Number(unitPrice) || 0);
    const requestedQuantity = Math.max(1, Math.floor(Number(projection?.requestedQuantity) || 1));
    if (!projection?.trackedQuantity) {
      return '<strong class="tsimm-priced-trade-verdict unknown">? COST UNKNOWN</strong>'
        + `<span class="tsimm-priced-trade-comparison">${escapeHtml(formatInteger(requestedQuantity))} available · pays ${escapeHtml(formatMoney(payoutEach))} ea · no open ledger lot</span>`;
    }
    const status = projection.profit > 0 ? 'profit' : projection.profit < 0 ? 'loss' : 'even';
    const totalAmount = formatMoney(Math.abs(projection.profit));
    const eachAmount = formatMoney(Math.abs(projection.profitEach));
    const scope = projection.fullCoverage
      ? 'FULL STACK'
      : `TRACKED ${formatInteger(projection.trackedQuantity)}/${formatInteger(projection.requestedQuantity)}`;
    const headline = status === 'profit'
      ? `${projection.fullCoverage ? '✓' : '⚠'} ${scope} +${totalAmount}`
      : status === 'loss'
        ? `${projection.fullCoverage ? '✕' : '⚠'} ${scope} -${totalAmount}`
        : `${projection.fullCoverage ? '≈' : '⚠'} ${scope} BREAK EVEN`;
    const eachLabel = status === 'profit'
      ? `+${eachAmount} ea`
      : status === 'loss' ? `-${eachAmount} ea` : `${eachAmount} ea`;
    const lotDetail = Number(projection.lotsUsed) > 1
      ? ` · ${formatInteger(projection.lotsUsed)} lots blended`
      : Number(projection.lotsUsed) === 1 ? ' · 1 lot' : '';
    return `<strong class="tsimm-priced-trade-verdict ${status}${projection.fullCoverage ? '' : ' partial'}">${escapeHtml(headline)}</strong>`
      + `<span class="tsimm-priced-trade-comparison">${escapeHtml(eachLabel)} · cost ${escapeHtml(formatMoney(projection.averageCost))} → pays ${escapeHtml(formatMoney(payoutEach))}${escapeHtml(lotDetail)}</span>`;
  }

  function pricedTradeBestTraderQuote(item, currentTrader) {
    if (!item || !currentTrader) return null;
    const favoriteRefs = tradeExitFavoriteRefs();
    const candidates = state.traders.filter((trader) =>
      trader.id === currentTrader.id || tradeExitTraderIsFavorite(trader, favoriteRefs)
    );
    const seen = new Set();
    const quotes = [];
    for (const trader of candidates) {
      if (!trader?.id || seen.has(trader.id)) continue;
      seen.add(trader.id);
      const quote = tradeExitQuoteForTrader(trader, { itemId: item.id, name: item.name });
      if (!quote) continue;
      const freshness = quote.freshness || tradeExitFreshness(quote.capturedAt);
      if (freshness.status === 'missing') continue;
      quotes.push({ trader, quote: { ...quote, freshness } });
    }
    const fresh = quotes.filter((entry) => entry.quote.freshness.status === 'fresh');
    const pool = fresh.length ? fresh : quotes;
    pool.sort((left, right) =>
      Number(right.quote.unitPrice || 0) - Number(left.quote.unitPrice || 0)
      || Number(right.trader.id === currentTrader.id) - Number(left.trader.id === currentTrader.id)
      || Number(left.quote.freshness.ageMs ?? Number.MAX_SAFE_INTEGER) - Number(right.quote.freshness.ageMs ?? Number.MAX_SAFE_INTEGER)
    );
    if (!pool.length) return null;
    return {
      ...pool[0],
      comparisonFreshness: fresh.length ? 'fresh' : 'stale',
    };
  }

  function pricedTradeBestMatchHtml(bestMatch, currentTrader, currentQuote, projection) {
    if (!bestMatch?.trader || !bestMatch?.quote || !currentTrader || !currentQuote) return '';
    const stale = bestMatch.comparisonFreshness !== 'fresh';
    const isCurrent = bestMatch.trader.id === currentTrader.id;
    if (isCurrent) {
      const label = stale ? '⌛ STALE TOP MATCH' : '★ TOP MATCH';
      return `<strong class="tsimm-priced-trade-best${stale ? ' stale' : ''}">${escapeHtml(label)}</strong>`;
    }
    const knownCost = Boolean(projection?.trackedQuantity && Number.isFinite(Number(projection.averageCost)));
    const trackedQuantity = Math.max(0, Math.floor(Number(projection?.trackedQuantity) || 0));
    const bestProfitEach = knownCost ? Number(bestMatch.quote.unitPrice) - Number(projection.averageCost) : null;
    const bestProfitTotal = bestProfitEach === null ? null : bestProfitEach * trackedQuantity;
    const profitLabel = bestProfitTotal === null
      ? 'profit unknown'
      : bestProfitTotal > 0
        ? `+${formatMoney(bestProfitTotal)} STACK`
        : bestProfitTotal < 0
          ? `-${formatMoney(Math.abs(bestProfitTotal))} STACK`
          : `${formatMoney(0)} STACK`;
    const gainTotal = Math.max(0, Number(bestMatch.quote.unitPrice) - Number(currentQuote.unitPrice)) * trackedQuantity;
    const prefix = stale ? '⌛ STALE BEST' : '↑ BEST';
    return `<strong class="tsimm-priced-trade-best better${stale ? ' stale' : ''}">${escapeHtml(prefix)}: ${escapeHtml(bestMatch.trader.name)} · ${escapeHtml(profitLabel)}</strong>`
      + `<span class="tsimm-priced-trade-best-detail">+${escapeHtml(formatMoney(gainTotal))} over this trader for the tracked stack</span>`;
  }

  function pricedTradeCompactBadgeHtml(projection, bestMatch, currentTrader, currentQuote) {
    const trackedQuantity = Math.max(0, Math.floor(Number(projection?.trackedQuantity) || 0));
    const requestedQuantity = Math.max(1, Math.floor(Number(projection?.requestedQuantity) || 1));
    const knownCost = trackedQuantity > 0 && Number.isFinite(Number(projection?.profitEach));
    let primary = `? COST UNKNOWN · ${formatMoney(currentQuote?.unitPrice || 0)} ea`;
    let secondary = 'tap for details';
    if (knownCost) {
      const status = Number(projection.profit) > 0 ? 'profit' : Number(projection.profit) < 0 ? 'loss' : 'even';
      const icon = projection.fullCoverage ? (status === 'profit' ? '✓' : status === 'loss' ? '✕' : '≈') : '⚠';
      const total = status === 'profit'
        ? `+${formatMoney(Math.abs(projection.profit))}`
        : status === 'loss'
          ? `-${formatMoney(Math.abs(projection.profit))}`
          : 'BREAK EVEN';
      const costBasis = Number(projection.costBasis);
      const roiPercent = costBasis > 0 && Number.isFinite(Number(projection.profit))
        ? Number(projection.profit) / costBasis * 100
        : null;
      const normalizedRoi = roiPercent !== null && Math.abs(roiPercent) < 0.05 ? 0 : roiPercent;
      const roiLabel = normalizedRoi === null
        ? 'ROI —'
        : `${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(normalizedRoi)}% ROI`;
      primary = `${icon} ${total} · ${roiLabel}`;
      if (!projection.fullCoverage) {
        secondary = `${formatInteger(trackedQuantity)}/${formatInteger(requestedQuantity)} tracked`;
      }
    }

    if (bestMatch?.trader && bestMatch?.quote && currentTrader && currentQuote) {
      const stale = bestMatch.comparisonFreshness !== 'fresh';
      if (bestMatch.trader.id === currentTrader.id) {
        const topLabel = stale ? 'STALE TOP' : 'TOP PRICE';
        secondary = projection?.fullCoverage ? topLabel : `${secondary} · ${topLabel}`;
      } else if (trackedQuantity > 0) {
        const gainTotal = Math.max(0, Number(bestMatch.quote.unitPrice) - Number(currentQuote.unitPrice)) * trackedQuantity;
        const bestLabel = `${stale ? 'STALE BEST' : 'BEST'} +${formatMoney(gainTotal)} more`;
        secondary = projection?.fullCoverage ? bestLabel : `${secondary} · ${bestLabel}`;
      } else {
        secondary = `${stale ? 'STALE BEST' : 'BEST'} ${formatMoney(bestMatch.quote.unitPrice)} ea`;
      }
    }

    return `<span class="tsimm-priced-trade-compact"><strong class="tsimm-priced-trade-compact-line">${escapeHtml(primary)}</strong><span class="tsimm-priced-trade-compact-sub">${escapeHtml(secondary)}</span></span>`;
  }


  function pricedTradeRowDecisionClasses() {
    return [
      'fresh', 'stale', 'outdated', 'missing',
      'decision-profit', 'decision-loss', 'decision-even', 'decision-partial', 'decision-unknown',
    ];
  }

  function pricedTradeOwnedGeneratedElements(row, selector) {
    if (!(row instanceof Element)) return [];
    return [...row.querySelectorAll(selector)].filter((element) =>
      element.closest(`.${PRICED_TRADE_ROW_CLASS}`) === row
    );
  }

  function pricedTradeRemoveRowAnnotation(row) {
    if (!(row instanceof Element)) return;
    pricedTradeOwnedGeneratedElements(row, `.${PRICED_TRADE_BADGE_CLASS},.${PRICED_TRADE_MAX_CLASS}`)
      .forEach((element) => element.remove());
    row.classList.remove(PRICED_TRADE_ROW_CLASS, ...pricedTradeRowDecisionClasses());
    delete row.dataset.tsimmPricedTradeToken;
  }


  function clearPricedTradeRowAnnotations() {
    document.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`).forEach(pricedTradeRemoveRowAnnotation);
    document.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS},.${PRICED_TRADE_MAX_CLASS}`).forEach((element) => element.remove());
  }




  function pricedTradeCaptureScrollAnchor(surface = pricedTradeInventorySurface()) {
    const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
    const activeRow = activeElement?.closest(`.${PRICED_TRADE_ROW_CLASS}`) || null;
    if (activeRow?.isConnected && (!(surface instanceof Element) || surface.contains(activeRow))) {
      return { mode: 'row', row: activeRow, top: activeRow.getBoundingClientRect().top };
    }
    return null;
  }

  function pricedTradeRestoreScrollAnchor() {
    // Deliberately empty. Mobile Torn/TornPDA owns scroll position and keyboard anchoring.
  }

  function pricedTradeRenderRowBadge(row, trader, resolvedItem = null) {
    if (!(row instanceof Element) || !row.isConnected || !trader) return null;
    const item = resolvedItem || pricedTradeItemForRow(row, trader);
    if (!item) return null;
    const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
    const quote = tradeExitQuoteForTrader(trader, { itemId: item.id, name: item.name });
    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, item.name)) || 1));

    row.classList.remove(...pricedTradeRowDecisionClasses());
    row.classList.add(PRICED_TRADE_ROW_CLASS);
    row.dataset.tsimmPricedTradeToken = token;

    const ownedBadges = pricedTradeOwnedGeneratedElements(row, `.${PRICED_TRADE_BADGE_CLASS}`);
    let badge = ownedBadges.find((candidate) => candidate.dataset.tsimmItemToken === token)
      || ownedBadges[0]
      || null;
    ownedBadges.filter((candidate) => candidate !== badge).forEach((candidate) => candidate.remove());
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.tsimmGenerated = 'true';
    }
    badge.dataset.tsimmItemToken = token;

    const expanded = pricedTradeExpandedBadgeTokens.has(token);
    let badgeClasses = [PRICED_TRADE_BADGE_CLASS];
    let badgeHtml = '';
    if (quote) {
      const freshness = quote.freshness || tradeExitFreshness(quote.capturedAt);
      const status = freshness.status === 'fresh' ? 'fresh' : freshness.status;
      row.classList.add(status);
      const ledger = pricedTradeLedgerProjection(item, availableQuantity, quote.unitPrice);
      const ledgerState = !ledger.trackedQuantity
        ? 'unknown'
        : ledger.profit > 0 ? 'profit' : ledger.profit < 0 ? 'loss' : 'even';
      const decisionState = ledger.trackedQuantity && !ledger.fullCoverage ? 'partial' : ledgerState;
      row.classList.add(`decision-${decisionState}`);
      badgeClasses = [
        PRICED_TRADE_BADGE_CLASS,
        status,
        `ledger-${ledgerState}`,
        'quantity-full-stack',
      ];
      if (expanded) badgeClasses.push('expanded');
      if (ledger.trackedQuantity && !ledger.fullCoverage) badgeClasses.push('ledger-partial');
      const bestMatch = pricedTradeBestTraderQuote(item, trader);
      const quantityLabel = `FULL STACK · ${formatInteger(availableQuantity)} AVAILABLE`;
      const detailHtml = pricedTradeLedgerHtml(ledger, quote.unitPrice)
        + pricedTradeBestMatchHtml(bestMatch, trader, quote, ledger)
        + `<span class="tsimm-priced-trade-meta">${escapeHtml(quantityLabel)} · ${escapeHtml(trader.name)} · ${escapeHtml(freshness.ageLabel)}</span>`;
      badgeHtml = pricedTradeCompactBadgeHtml(ledger, bestMatch, trader, quote)
        + `<span class="tsimm-priced-trade-details">${detailHtml}</span>`;
    } else {
      row.classList.add('missing');
      badgeClasses = [PRICED_TRADE_BADGE_CLASS, 'missing', 'quantity-full-stack'];
      if (expanded) badgeClasses.push('expanded');
      badgeHtml = `<span class="tsimm-priced-trade-compact"><strong class="tsimm-priced-trade-compact-line">? NO PRICE</strong><span class="tsimm-priced-trade-compact-sub">tap for details</span></span>`
        + `<span class="tsimm-priced-trade-details"><strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list · ${escapeHtml(formatInteger(availableQuantity))} available</span></span>`;
    }

    const nextClassName = badgeClasses.join(' ');
    if (badge.className !== nextClassName) badge.className = nextClassName;
    badge.dataset.tsimmAction = 'priced-trade-badge-toggle';
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    badge.setAttribute('aria-label', `${item.name}: ${expanded ? 'hide' : 'show'} Priced Trade details`);
    if (badge.innerHTML !== badgeHtml) badge.innerHTML = badgeHtml;
    if (badge.parentElement !== row) row.appendChild(badge);
    pricedTradeEnsureNativeMaxButton(row, availableQuantity, token);
    return { row, item, token, priced: Boolean(quote) };
  }


  function schedulePricedTradeRowRefresh(row, delay = 180) {
    if (!(row instanceof Element) || !row.isConnected || !loadPricedTradeSession()) return false;
    pricedTradeLastInteractedRow = row;
    if (pricedTradeScrollIsActive()) return true;
    pricedTradePendingQuantityRow = row;
    clearTimeout(pricedTradeQuantityTimer);
    pricedTradeQuantityTimer = setTimeout(() => {
      pricedTradeQuantityTimer = null;
      const pendingRow = pricedTradePendingQuantityRow;
      pricedTradePendingQuantityRow = null;
      if (!(pendingRow instanceof Element) || !pendingRow.isConnected) {
        schedulePricedTradePickerRepaint(45);
        return;
      }
      if (pricedTradeScrollIsActive()) return;
      const verification = pricedTradeVerification(state.lastScan || {});
      if (verification.status !== 'verified' || !verification.trader) {
        scheduleScan(0);
        return;
      }
      const anchor = pricedTradeCaptureScrollAnchor();
      pricedTradeRenderRowBadge(pendingRow, verification.trader);
      pricedTradeRestoreScrollAnchor(anchor);
    }, Math.max(20, Number(delay) || 0));
    return true;
  }

  function capturePricedTradeQuantityEvent(event) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return false;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return false;
    if (!pricedTradeIsQuantityControl(target)) return false;
    const trader = pricedTradeArmedTrader();
    if (!trader) return false;
    const row = target.closest(`.${PRICED_TRADE_ROW_CLASS}`) || pricedTradeRowForControl(target, trader);
    if (row instanceof Element && row.isConnected) pricedTradeLastInteractedRow = row;
    return true;
  }

  function pricedTradeRowNeedsDecoration(row, trader) {
    if (!(row instanceof Element) || !row.isConnected || !trader) return false;
    const item = pricedTradeItemForRow(row, trader);
    if (!item) return false;
    const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
    const badges = pricedTradeOwnedGeneratedElements(row, `.${PRICED_TRADE_BADGE_CLASS}`);
    const maxButtons = pricedTradeOwnedGeneratedElements(row, `.${PRICED_TRADE_MAX_CLASS}`);
    const badge = badges[0] || null;
    const maxButton = maxButtons[0] || null;
    const control = pricedTradeNativeMaxPlacementControl(row);
    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, item.name)) || 1));
    return badges.length !== 1
      || maxButtons.length !== 1
      || row.dataset.tsimmPricedTradeToken !== token
      || badge?.dataset.tsimmItemToken !== token
      || maxButton?.dataset.tsimmItemToken !== token
      || Number(maxButton?.dataset.tsimmAvailableQuantity) !== availableQuantity
      || !(control instanceof Element)
      || maxButton.parentElement !== control.parentElement
      || maxButton.previousElementSibling !== control;
  }


  function pricedTradeReconcileVisibleRows() {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade() || pricedTradeScrollIsActive()) return false;
    const verification = pricedTradeVerification(state.lastScan || {});
    if (verification.status !== 'verified' || !verification.trader) {
      scheduleScan(0);
      return false;
    }
    injectPricedTradeStyles();
    const trader = verification.trader;
    const entries = pricedTradeResolvedCandidateRows(trader);
    let decorated = 0;
    let priced = 0;
    for (const entry of entries) {
      const result = pricedTradeRowNeedsDecoration(entry.row, trader)
        ? pricedTradeRenderRowBadge(entry.row, trader, entry.item)
        : { priced: Boolean(tradeExitQuoteForTrader(trader, { itemId: entry.item.id, name: entry.item.name })) };
      if (!result) continue;
      decorated += 1;
      if (result.priced) priced += 1;
    }
    pricedTradePruneNonCanonicalRows(entries);
    renderPricedTradePanel(verification, decorated, priced);
    syncPricedTradePickerObserver();
    return true;
  }


  function applyPricedTradeInventoryBadges(stats) {
    syncPricedTradePickerObserver();
    const verification = pricedTradeVerification(stats);
    if (verification.status === 'inactive') {
      clearPricedTradeAnnotations();
      return;
    }
    if (verification.status !== 'verified' || !verification.trader) {
      clearPricedTradeRowAnnotations();
      renderPricedTradePanel(verification);
      return;
    }

    if (pricedTradeScrollIsActive()) return;

    injectPricedTradeStyles();
    const trader = verification.trader;
    const anchor = pricedTradeCaptureScrollAnchor();
    const entries = pricedTradeResolvedCandidateRows(trader);
    let decorated = 0;
    let priced = 0;
    for (const entry of entries) {
      const result = pricedTradeRenderRowBadge(entry.row, trader, entry.item);
      if (!result) continue;
      decorated += 1;
      if (result.priced) priced += 1;
    }

    pricedTradePruneNonCanonicalRows(entries);
    renderPricedTradePanel(verification, decorated, priced);
    pricedTradeRestoreScrollAnchor(anchor);
    syncPricedTradePickerObserver();
  }


  function currentTradeTrader(stats) {
    const counterpartyId = Number(stats?.tradeCounterpartyId) > 0 ? Number(stats.tradeCounterpartyId) : null;
    const counterpartyName = normalizeName(stats?.tradeCounterparty);
    return state.traders.find((trader) =>
      (counterpartyId && Number(trader.userId) === counterpartyId)
      || (counterpartyName && trader.normalizedName === counterpartyName)
    ) || null;
  }

  function tradeExitVerdictLabel(status) {
    return {
      'sell-here': '✓ SELL HERE',
      'better-elsewhere': '↑ BETTER ELSEWHERE',
      'close-enough': '≈ CLOSE ENOUGH',
      'npc-better': '🏪 NPC BETTER',
      'stale-price': '⌛ STALE PRICE',
      unknown: '? UNKNOWN',
    }[status] || '? UNKNOWN';
  }

  function tradeExitItemToken(item) {
    return Number(item?.itemId) > 0
      ? `id:${Number(item.itemId)}`
      : `name:${normalizeName(item?.name ?? item?.itemName)}`;
  }

  function buildTradeExitAudit(stats) {
    const items = Array.isArray(stats?.tradeItems) ? stats.tradeItems : [];
    const favoriteRefs = tradeExitFavoriteRefs();
    const favoriteTraders = state.traders.filter((trader) => tradeExitTraderIsFavorite(trader, favoriteRefs));
    const currentTrader = currentTradeTrader(stats);
    const currentToken = currentTrader
      ? (currentTrader.userId ? `uid:${currentTrader.userId}` : `name:${currentTrader.normalizedName}`)
      : '';
    const otherFavorites = favoriteTraders.filter((trader) => {
      const token = trader.userId ? `uid:${trader.userId}` : `name:${trader.normalizedName}`;
      return !currentToken || token !== currentToken;
    });
    const liveSingleItem = items.length === 1
      && Number.isFinite(stats?.tradeNetCash)
      && Number(items[0]?.quantity) > 0;
    const auditItems = [];
    let actionableTypes = 0;
    let currentCoverage = 0;
    let currentFreshCoverage = 0;
    let bestKnownTotal = 0;
    let currentCapturedTotal = 0;
    let sellHereCount = 0;
    let betterElsewhereCount = 0;
    let closeEnoughCount = 0;
    let npcBetterCount = 0;
    let staleCount = 0;
    let unknownCount = 0;
    const minimumSwitchGain = Math.max(0, Number(state.settings.tradeExitMinimumSwitchGain) || 0);

    for (const item of items) {
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const catalog = catalogItemFor(item.name, item.itemId);
      const targetEach = Math.max(0, Number(item.targetEach) || traderPayout(catalog?.marketPrice || item.marketPrice));
      const npcEach = Math.max(0, Number(catalog?.sellPrice) || 0);
      const capturedCurrent = tradeExitQuoteForTrader(currentTrader, item);
      const liveCurrent = liveSingleItem
        ? {
            traderId: currentTrader?.id || '',
            traderName: stats.tradeCounterparty || currentTrader?.name || 'Current trade',
            unitPrice: Math.max(0, Number(stats.tradeNetCash) / quantity),
            capturedAt: new Date().toISOString(),
            freshness: { status: 'fresh', ageMs: 0, ageLabel: 'live now' },
            source: 'live trade cash',
          }
        : null;
      const currentQuote = liveCurrent || capturedCurrent;
      if (currentQuote) {
        currentCoverage += 1;
        currentCapturedTotal += currentQuote.unitPrice * quantity;
        if (currentQuote.freshness.status === 'fresh') currentFreshCoverage += 1;
      }

      const favoriteQuotes = otherFavorites
        .map((trader) => tradeExitQuoteForTrader(trader, item))
        .filter(Boolean)
        .sort((left, right) =>
          Number(right.unitPrice) - Number(left.unitPrice)
          || Number(left.freshness.ageMs ?? Number.MAX_SAFE_INTEGER) - Number(right.freshness.ageMs ?? Number.MAX_SAFE_INTEGER)
        );
      const bestFreshFavorite = favoriteQuotes.find((quote) => quote.freshness.status === 'fresh') || null;
      const bestStaleFavorite = favoriteQuotes.find((quote) => quote.freshness.status !== 'fresh') || null;
      const currentFresh = currentQuote?.freshness.status === 'fresh' ? currentQuote : null;
      const currentReference = Number(currentQuote?.unitPrice) || 0;
      const favoriteFreshPrice = Number(bestFreshFavorite?.unitPrice) || 0;
      const highestFreshAlternative = Math.max(favoriteFreshPrice, npcEach);

      let status = 'unknown';
      let recommendedEach = 0;
      let recommendedSource = '';
      let recommendedTraderId = '';
      let recommendedFreshness = null;

      if (currentFresh) {
        if (npcEach > currentFresh.unitPrice && npcEach >= favoriteFreshPrice) {
          status = 'npc-better';
          recommendedEach = npcEach;
          recommendedSource = 'Torn NPC buyback';
        } else if (bestFreshFavorite && bestFreshFavorite.unitPrice > currentFresh.unitPrice && bestFreshFavorite.unitPrice >= npcEach) {
          status = 'better-elsewhere';
          recommendedEach = bestFreshFavorite.unitPrice;
          recommendedSource = bestFreshFavorite.traderName;
          recommendedTraderId = bestFreshFavorite.traderId;
          recommendedFreshness = bestFreshFavorite.freshness;
        } else {
          status = 'sell-here';
          recommendedEach = currentFresh.unitPrice;
          recommendedSource = currentFresh.source === 'live trade cash'
            ? `${currentFresh.traderName} live offer`
            : currentFresh.traderName;
          recommendedTraderId = currentFresh.traderId;
          recommendedFreshness = currentFresh.freshness;
        }
      } else if (npcEach > Math.max(currentReference, favoriteFreshPrice)) {
        status = 'npc-better';
        recommendedEach = npcEach;
        recommendedSource = 'Torn NPC buyback';
      } else if (bestFreshFavorite && bestFreshFavorite.unitPrice > currentReference) {
        status = 'better-elsewhere';
        recommendedEach = bestFreshFavorite.unitPrice;
        recommendedSource = bestFreshFavorite.traderName;
        recommendedTraderId = bestFreshFavorite.traderId;
        recommendedFreshness = bestFreshFavorite.freshness;
      } else if (currentQuote || bestStaleFavorite) {
        const staleReference = [currentQuote, bestStaleFavorite]
          .filter(Boolean)
          .sort((left, right) => Number(right.unitPrice) - Number(left.unitPrice))[0];
        status = 'stale-price';
        recommendedEach = Number(staleReference?.unitPrice) || 0;
        recommendedSource = staleReference?.traderName || 'Captured trader';
        recommendedTraderId = staleReference?.traderId || '';
        recommendedFreshness = staleReference?.freshness || null;
      } else if (npcEach > 0) {
        status = 'npc-better';
        recommendedEach = npcEach;
        recommendedSource = 'Torn NPC buyback';
      }

      let ignoredAlternative = null;
      let ignoredGainTotal = 0;
      if (status === 'better-elsewhere' && currentQuote && minimumSwitchGain > 0) {
        const candidateGainTotal = Math.max(0, (recommendedEach - currentQuote.unitPrice) * quantity);
        if (candidateGainTotal > 0 && candidateGainTotal < minimumSwitchGain) {
          ignoredAlternative = {
            traderId: recommendedTraderId,
            traderName: recommendedSource,
            unitPrice: recommendedEach,
            freshness: recommendedFreshness,
          };
          ignoredGainTotal = candidateGainTotal;
          status = 'close-enough';
          recommendedEach = currentQuote.unitPrice;
          recommendedSource = currentQuote.source === 'live trade cash'
            ? `${currentQuote.traderName} live offer`
            : currentQuote.traderName;
          recommendedTraderId = currentQuote.traderId;
          recommendedFreshness = currentQuote.freshness;
        }
      }

      const actionable = ['sell-here', 'better-elsewhere', 'close-enough', 'npc-better'].includes(status) && recommendedEach > 0;
      if (actionable) {
        actionableTypes += 1;
        bestKnownTotal += recommendedEach * quantity;
      }
      if (status === 'sell-here') sellHereCount += 1;
      else if (status === 'better-elsewhere') betterElsewhereCount += 1;
      else if (status === 'close-enough') closeEnoughCount += 1;
      else if (status === 'npc-better') npcBetterCount += 1;
      else if (status === 'stale-price') staleCount += 1;
      else unknownCount += 1;

      const deltaEach = recommendedEach > 0 && currentQuote
        ? recommendedEach - currentQuote.unitPrice
        : null;
      const targetGapEach = currentQuote
        ? currentQuote.unitPrice - targetEach
        : null;
      auditItems.push({
        token: tradeExitItemToken(item),
        itemId: item.itemId || catalog?.id || null,
        itemName: item.name,
        quantity,
        targetEach,
        npcEach,
        currentQuote,
        bestFreshFavorite,
        bestStaleFavorite,
        status,
        verdict: tradeExitVerdictLabel(status),
        actionable,
        recommendedEach,
        recommendedTotal: recommendedEach * quantity,
        recommendedSource,
        recommendedTraderId,
        recommendedFreshness,
        ignoredAlternative,
        ignoredGainTotal,
        deltaEach,
        deltaTotal: deltaEach === null ? null : deltaEach * quantity,
        targetGapEach,
        highestFreshAlternative,
      });
    }

    const totalTypes = items.length;
    const fullCoverage = totalTypes > 0
      && actionableTypes === totalTypes
      && Number(stats?.tradeUnmatchedItems || 0) === 0;
    const netCash = Number.isFinite(stats?.tradeNetCash) ? Number(stats.tradeNetCash) : null;
    const offerVsBest = fullCoverage && netCash !== null ? netCash - bestKnownTotal : null;
    const potentialLeftBehind = offerVsBest === null ? null : Math.max(0, -offerVsBest);
    const overallStatus = betterElsewhereCount + npcBetterCount > 0
      ? 'review'
      : staleCount > 0
        ? 'stale'
        : unknownCount > 0
          ? 'unknown'
          : totalTypes > 0
            ? 'sell-here'
            : 'empty';
    const overallLabel = {
      review: `${betterElsewhereCount + npcBetterCount} route${betterElsewhereCount + npcBetterCount === 1 ? '' : 's'} to review`,
      stale: 'Refresh captured prices',
      unknown: 'Incomplete exit coverage',
      'sell-here': closeEnoughCount
        ? `${closeEnoughCount} small switch gain${closeEnoughCount === 1 ? '' : 's'} ignored`
        : 'Current route wins',
      empty: 'No items to audit',
    }[overallStatus];

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      counterparty: stats?.tradeCounterparty || currentTrader?.name || '',
      currentTraderId: currentTrader?.id || '',
      currentTraderName: currentTrader?.name || stats?.tradeCounterparty || '',
      favoriteTraderCount: favoriteTraders.length,
      totalTypes,
      actionableTypes,
      currentCoverage,
      currentFreshCoverage,
      bestKnownTotal,
      currentCapturedTotal,
      fullCoverage,
      netCash,
      offerVsBest,
      potentialLeftBehind,
      sellHereCount,
      betterElsewhereCount,
      closeEnoughCount,
      npcBetterCount,
      staleCount,
      unknownCount,
      overallStatus,
      overallLabel,
      items: auditItems,
    };
  }

  function applyTradeExitAuditBadges(matched, audit) {
    if (!audit?.items?.length) return;
    const byToken = new Map(audit.items.map((item) => [item.token, item]));
    for (const item of matched || []) {
      const annotationRow = item?.annotationRow === null ? null : (item?.annotationRow || item?.row);
      if (!annotationRow) continue;
      const auditItem = byToken.get(tradeExitItemToken({
        itemId: item.catalog?.id || item.itemId,
        name: item.catalog?.name || item.name,
      }));
      if (!auditItem) continue;
      annotationRow.dataset.tsimmTradeExitStatus = auditItem.status;
      annotationRow.dataset.tsimmTradeExitToken = auditItem.token;
      const badge = annotationRow.querySelector(`.${APP.tradeBadgeClass}`);
      if (!badge) continue;
      badge.classList.add(`tsimm-trade-exit-badge-${auditItem.status}`);
      const majorSwitchGain = auditItem.status === 'better-elsewhere' && Number(auditItem.deltaTotal) > 0
        ? Number(auditItem.deltaTotal)
        : 0;
      if (majorSwitchGain) badge.classList.add('tsimm-trade-exit-badge-major');
      const route = auditItem.status === 'close-enough' && auditItem.ignoredGainTotal > 0
        ? `Ignored +${escapeHtml(formatMoney(auditItem.ignoredGainTotal))} total · keep here`
        : auditItem.recommendedEach > 0
          ? `${escapeHtml(auditItem.recommendedSource)} ${escapeHtml(formatMoney(auditItem.recommendedEach))} ea`
          : 'No actionable exit';
      const verdict = majorSwitchGain
        ? `${auditItem.verdict} · +${formatMoney(majorSwitchGain)} TOTAL`
        : auditItem.verdict;
      badge.innerHTML = `<strong>${escapeHtml(verdict)}</strong>`
        + `<span>${route} · Ⓣ ${escapeHtml(formatMoney(auditItem.targetEach * auditItem.quantity))}</span>`;
    }
  }

  function applyTradeExitMainPageAlert(mySide, audit) {
    document.querySelectorAll('[data-tsimm-trade-route-alert]').forEach((element) => element.remove());
    if (state.settings.showTradeExitAudit === false || !(mySide?.element instanceof Element) || !audit?.items?.length) return;

    const routes = audit.items
      .filter((item) => item.status === 'better-elsewhere' && Number(item.deltaTotal) > 0)
      .sort((left, right) => Number(right.deltaTotal) - Number(left.deltaTotal));
    if (!routes.length) return;

    const totalGain = routes.reduce((sum, item) => sum + Number(item.deltaTotal || 0), 0);
    const alert = document.createElement('section');
    alert.className = 'tsimm-trade-route-alert';
    alert.dataset.tsimmTradeRouteAlert = 'true';
    alert.dataset.tsimmGenerated = 'true';
    const routeLines = routes.slice(0, 3).map((item) =>
      `<span><strong>${escapeHtml(item.itemName)}</strong> +${escapeHtml(formatMoney(item.deltaTotal))} → ${escapeHtml(item.recommendedSource)}</span>`
    ).join('');
    const remainder = routes.length > 3
      ? `<span class="tsimm-trade-route-more">+${formatInteger(routes.length - 3)} more worthwhile route${routes.length - 3 === 1 ? '' : 's'}</span>`
      : '';
    alert.innerHTML = `
      <div class="tsimm-trade-route-alert-head">
        <strong>🧭 ${formatInteger(routes.length)} worthwhile trader switch${routes.length === 1 ? '' : 'es'}</strong>
        <b>+${escapeHtml(formatMoney(totalGain))} total</b>
      </div>
      <div class="tsimm-trade-route-alert-list">${routeLines}${remainder}</div>
    `;

    const headingSelector = '.title-black,[role="heading"],h2,h3,h4,h5,[class*="title___"],[class*="header___"]';
    const heading = mySide.element.matches?.(headingSelector)
      ? mySide.element
      : [...mySide.element.querySelectorAll(headingSelector)].find((element) => visibleElement(element));
    if (heading) heading.insertAdjacentElement('afterend', alert);
    else mySide.element.prepend(alert);
  }

  function tradeExitRemoveControlLabel(element) {
    if (!(element instanceof Element)) return '';
    const childHints = [...element.querySelectorAll('[class],[aria-label],[title]')]
      .slice(0, 16)
      .map((child) => `${child.getAttribute('class') || ''} ${child.getAttribute('aria-label') || ''} ${child.getAttribute('title') || ''}`)
      .join(' ');
    return normalizeWhitespace([
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('value'),
      element.getAttribute('class'),
      childHints,
    ].filter(Boolean).join(' '));
  }

  function tradeExitRemoveControl(row) {
    if (!(row instanceof Element)) return null;
    const controls = [...row.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .filter((element) => visibleElement(element)
        && !element.disabled
        && !element.closest(`#${APP.panelId},[data-tsimm-generated]`));
    return controls.find((element) => /\b(?:remove|delete|trash)\b/i.test(tradeExitRemoveControlLabel(element)))
      || controls.find((element) => /(?:remove|delete|trash)/i.test(String(element.className || '')))
      || null;
  }

  function tradeExitRowForToken(token) {
    return [...document.querySelectorAll('[data-tsimm-trade-exit-token]')]
      .find((row) => row.dataset.tsimmTradeExitToken === token) || null;
  }

  const tradeExitDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function removeTradeExitItems(status = 'better-elsewhere') {
    if (state.tradeExitRemoveBusy) return;
    const audit = state.lastScan?.tradeExitAudit;
    const targets = (audit?.items || []).filter((item) => item.status === status);
    if (!targets.length) {
      toast('No better-elsewhere items are currently in this trade.');
      return;
    }
    const preview = targets.slice(0, 8).map((item) => `${item.itemName} × ${formatInteger(item.quantity)}`).join('\n');
    const remainder = targets.length > 8 ? `\n…plus ${targets.length - 8} more` : '';
    const accepted = confirm(
      `Remove ${targets.length} better-elsewhere item type${targets.length === 1 ? '' : 's'} from your side of this trade?\n\n${preview}${remainder}\n\nIMM will press Torn's visible remove controls one at a time. It will not accept or complete the trade.`
    );
    if (!accepted) return;

    state.tradeExitRemoveBusy = true;
    renderPanel();
    let removed = 0;
    let unavailable = 0;
    try {
      for (const target of targets) {
        const row = tradeExitRowForToken(target.token);
        const control = tradeExitRemoveControl(row);
        if (!row || !control) {
          unavailable += 1;
          continue;
        }
        const originalRow = row;
        control.click();
        await tradeExitDelay(550);
        if (!originalRow.isConnected || !visibleElement(originalRow)) removed += 1;
        else unavailable += 1;
        scanPage();
        await tradeExitDelay(120);
      }
    } finally {
      state.tradeExitRemoveBusy = false;
      scheduleScan(120);
      renderPanel();
    }
    if (removed) {
      toast(`Removed ${removed} better-elsewhere item type${removed === 1 ? '' : 's'}${unavailable ? ` · ${unavailable} still need manual removal` : ''}.`);
    } else {
      toast('Torn did not expose a usable remove control. Use the native trash icons for these rows.');
    }
  }

  function scanTrade(stats) {
    const sides = tradeSideCandidates();
    stats.tradeSideCandidates = sides.length;
    if (sides.length < 2) {
      const completion = tradeCompletionState();
      stats.tradeCompleted = completion.completed;
      stats.tradeCompletionSource = completion.source || null;
      if (completion.completed && hydrateStatsFromPendingTradeSale(stats)) {
        applyLedgerSalePreview(stats);
        return;
      }
      stats.tradeStatus = 'incomplete';
      stats.notes.push(completion.completed
        ? 'Completed trade detected, but no preserved live-sale snapshot matched this trade.'
        : 'Trade sides were not recognized. Copy diagnostics from the live trade page.');
      const previous = state.lastScan;
      const currentTradeId = tradeIdFromLocation() || null;
      const sameTrade = previous?.pageType === 'trade'
        && (!currentTradeId || !previous.tradeId || String(previous.tradeId) === String(currentTradeId));
      if (sameTrade && loadPricedTradeSession()) applyPricedTradeInventoryBadges(previous);
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
      const previous = state.lastScan;
      const currentTradeId = tradeIdFromLocation() || null;
      const sameTrade = previous?.pageType === 'trade'
        && (!currentTradeId || !previous.tradeId || String(previous.tradeId) === String(currentTradeId));
      if (sameTrade && loadPricedTradeSession()) applyPricedTradeInventoryBadges(previous);
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
    stats.tradeExitAudit = buildTradeExitAudit(stats);
    applyTradeExitAuditBadges(matched, stats.tradeExitAudit);
    applyTradeExitMainPageAlert(mySide, stats.tradeExitAudit);
    applyPricedTradeInventoryBadges(stats);

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
    savePendingTradeSaleFromStats(stats);

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
    if (!(card instanceof Element)) return null;
    const candidates = [
      ...card.querySelectorAll('[data-item-id],[data-itemid],[data-id],a[href],img[src]'),
      card,
    ];
    for (const element of candidates) {
      for (const value of [
        element.getAttribute?.('data-item-id'),
        element.getAttribute?.('data-itemid'),
        element.getAttribute?.('data-id'),
        element.getAttribute?.('href'),
        element.getAttribute?.('src'),
      ]) {
        const valueText = String(value || '');
        const match = valueText.match(/[?&#](?:itemID|itemId|item_id|ID|id)=(\d{1,6})(?:\D|$)/i)
          || valueText.match(/\/(?:images\/)?items?\/(\d{1,6})(?:\/|\.|$)/i)
          || valueText.match(/(?:item(?:id|ID)?[=\/_-])(\d{1,6})(?:\D|$)/i);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function catalogItemFor(name, itemId = null) {
    if (itemId && state.catalog.itemsById?.[String(itemId)]) return state.catalog.itemsById[String(itemId)];
    return state.catalog.itemsByName?.[normalizeName(name)] || null;
  }

  function catalogItemForCard(card, name = '', itemId = null) {
    const direct = catalogItemFor(name, itemId);
    if (direct || !(card instanceof Element)) return direct;

    const labels = [
      ...card.querySelectorAll('img[alt],img[title],[aria-label],[title],[data-item-name]'),
    ].flatMap((element) => [
      element.getAttribute?.('alt'),
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('data-item-name'),
    ]).map(normalizeWhitespace).filter(Boolean);
    for (const label of labels) {
      const match = catalogItemFor(label);
      if (match) return match;
    }

    const cardName = ` ${normalizeName(card.innerText || card.textContent)} `;
    if (!cardName.trim()) return null;
    return Object.values(state.catalog.itemsByName || {})
      .filter((item) => item?.normalizedName && cardName.includes(` ${item.normalizedName} `))
      .sort((left, right) => right.normalizedName.length - left.normalizedName.length)[0]
      || null;
  }

  function categoryCandidates() {
    const candidates = [];
    const seen = new Set();
    const categoryPriceRegex = /^\$[\d,.]+\s*\([\d,]+\)$/;
    const addCard = (card, priceElement = null) => {
      if (!(card instanceof Element) || seen.has(card)) return;
      const cardText = normalizeWhitespace(card.innerText || card.textContent);
      if (!cardText || cardText.length > 280 || /\b(?:Owner|Qty|Buy|MAX)\b/i.test(cardText)) return;
      const match = cardText.match(/\$([\d,.]+)\s*\(([\d,]+)\)/);
      if (!match) return;
      const exactPriceElement = priceElement || [...card.querySelectorAll('span,div,p,strong,b')]
        .find((element) => categoryPriceRegex.test(normalizeWhitespace(ownText(element) || element.textContent)))
        || card;
      const priceText = normalizeWhitespace(ownText(exactPriceElement) || exactPriceElement.textContent || match[0]);
      const name = extractCategoryName(card, priceText) || extractCategoryName(card, match[0]);
      seen.add(card);
      candidates.push({
        card,
        priceElement: exactPriceElement,
        name,
        itemId: itemIdFromCard(card),
        lowestPrice: parseNumber(match[1]),
        marketQuantity: parseNumber(match[2]),
      });
    };

    const priceElements = marketTextElements(categoryPriceRegex);
    for (const priceElement of priceElements) {
      const card = priceElement.closest(`.${APP.categoryMark}`) || findCategoryCard(priceElement);
      addCard(card, priceElement);
    }

    // TornPDA occasionally merges the title and price into one React text node.
    // Image-first recovery keeps the multi-item grid working when there is no
    // standalone price element for marketTextElements() to discover.
    for (const image of document.querySelectorAll('img')) {
      if (!visibleElement(image) || image.closest(`#${APP.panelId},[data-tsimm-generated]`)) continue;
      addCard(findCategoryCard(image));
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

  function listingRowHasPurchaseControl(row) {
    return Boolean(row instanceof Element && quickMaxBuyControl(row));
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
      if (!listingRowHasPurchaseControl(node)) continue;
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
      const markedRow = priceElement.closest(`.${APP.listingMark}`);
      const markedRowValid = Boolean(markedRow && listingRowHasPurchaseControl(markedRow));
      if (markedRow && !markedRowValid) {
        directMarginBadge(priceElement, 'listing')?.remove();
        clearTierMark(markedRow, APP.listingMark);
      }
      const row = markedRowValid ? markedRow : findListingRow(priceElement);
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
    document.querySelectorAll('[data-tsimm-quick-max]').forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.quickMaxRowClass}`).forEach((element) => element.classList.remove(APP.quickMaxRowClass));
    document.querySelectorAll(`.${APP.badgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.categoryMark}`).forEach((element) => clearTierMark(element, APP.categoryMark));
    document.querySelectorAll(`.${APP.listingMark}`).forEach((element) => clearTierMark(element, APP.listingMark));
    document.querySelectorAll(`.${APP.overseasMark}`).forEach((element) => clearTierMark(element, APP.overseasMark));
    clearOverseasPlanAnnotations();
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
    document.querySelectorAll('[data-tsimm-quick-max]').forEach((button) => {
      if (button.dataset.tsimmScanToken === scanToken) return;
      button.closest(`.${APP.quickMaxRowClass}`)?.classList.remove(APP.quickMaxRowClass);
      button.remove();
    });
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
      + `<span class="tsimm-listing-lot">${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} full lot</span>`;
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
    if (mode === 'listing') {
      badge.dataset.tsimmQuantity = String(margin.qty);
      badge.dataset.tsimmBaseProfitEach = String(margin.profitEach);
      badge.dataset.tsimmBaseProfitTotal = String(margin.totalProfit);
      badge.dataset.tsimmListingPrice = String(margin.price);
      badge.dataset.tsimmMarketValue = String(margin.value);
      badge.dataset.tsimmTraderPayout = String(margin.payout);
    }

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
      const catalog = catalogItemForCard(candidate.card, candidate.name, candidate.itemId);
      if (!catalog || !candidate.lowestPrice) continue;
      candidate.name = catalog.name;
      candidate.itemId = candidate.itemId || catalog.id || null;
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


  function quickMaxInteractiveLabel(element) {
    if (!(element instanceof Element)) return '';
    return normalizeWhitespace([
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('value'),
      element.className,
    ].filter(Boolean).join(' '));
  }

  function quickMaxBuyControl(row) {
    if (!(row instanceof Element)) return null;
    const controls = [...row.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .filter((element) =>
        visibleElement(element)
        && !element.disabled
        && !element.closest(`[data-tsimm-generated],#${APP.panelId}`)
      );
    return controls.find((element) => /\b(?:buy|purchase)\b/i.test(quickMaxInteractiveLabel(element)))
      || controls.find((element) => /(?:buy|purchase)/i.test(String(element.className || '')))
      || null;
  }

  function quickMaxQuantityValue(control) {
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      return normalizeWhitespace(control.value);
    }
    if (!(control instanceof Element)) return '';
    return normalizeWhitespace(
      control.getAttribute('aria-valuenow')
      || control.getAttribute('data-value')
      || control.textContent
      || ''
    );
  }

  function quickMaxQuantityInput(root) {
    if (!(root instanceof Element || root instanceof Document)) return null;
    const selectors = [
      'input[type="number"]',
      'input[type="text"]',
      'input:not([type])',
      'input[inputmode="numeric"]',
      'input[inputmode="decimal"]',
      'input[name*="quantity" i]',
      'input[name*="amount" i]',
      'input[id*="quantity" i]',
      'input[id*="amount" i]',
      'input[class*="quantity" i]',
      'input[class*="amount" i]',
      'textarea',
      '[contenteditable="true"]',
      '[role="spinbutton"]',
    ].join(',');
    const candidates = [...new Set([...root.querySelectorAll(selectors)])].filter((control) => {
      if (!(control instanceof HTMLElement) || !visibleElement(control)) return false;
      if (control.closest(`#${APP.panelId},[data-tsimm-generated]`)) return false;
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
        if (control.disabled || control.readOnly) return false;
      } else if (control.getAttribute('aria-disabled') === 'true') {
        return false;
      }
      const value = quickMaxQuantityValue(control);
      const label = quickMaxInteractiveLabel(control);
      const context = normalizeWhitespace(control.parentElement?.innerText || control.parentElement?.textContent || '');
      return /^\d[\d,]*$/.test(value)
        || /\b(?:quantity|qty|amount|how many)\b/i.test(`${label} ${context}`);
    });
    const score = (control) => {
      const label = quickMaxInteractiveLabel(control);
      const context = normalizeWhitespace(control.parentElement?.innerText || control.parentElement?.textContent || '');
      const value = quickMaxQuantityValue(control);
      const inputType = control instanceof HTMLInputElement ? String(control.type || '').toLowerCase() : '';
      return Number(/\b(?:quantity|qty|amount|how many)\b/i.test(`${label} ${context}`)) * 6
        + Number(/^\d[\d,]*$/.test(value)) * 4
        + Number(inputType === 'number') * 3
        + Number(inputType === 'text' || control instanceof HTMLTextAreaElement) * 2
        + Number(control.getAttribute('contenteditable') === 'true') * 2
        + Number(control.getAttribute('role') === 'spinbutton') * 2
        + Number(Boolean(control.getAttribute('max') || control.getAttribute('data-max') || control.getAttribute('aria-valuemax')));
    };
    return candidates.sort((left, right) => score(right) - score(left))[0] || null;
  }

  function quickMaxSetInput(control, quantity) {
    if (!(control instanceof HTMLElement)) return false;
    const value = String(Math.max(1, Math.floor(Number(quantity) || 1)));
    control.focus?.();
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      const prototype = control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor?.set) descriptor.set.call(control, value);
      else control.value = value;
    } else {
      control.textContent = value;
      if (control.getAttribute('role') === 'spinbutton') control.setAttribute('aria-valuenow', value);
      if (control.hasAttribute('data-value')) control.setAttribute('data-value', value);
    }
    if (typeof InputEvent === 'function') {
      control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    } else {
      control.dispatchEvent(new Event('input', { bubbles: true }));
    }
    control.dispatchEvent(new Event('change', { bubbles: true }));
    control.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
    return parseNumber(quickMaxQuantityValue(control)) === Number(value);
  }

  function quickMaxMaximum(candidate, input = null, surface = null) {
    const limits = [];
    const listingQuantity = Math.max(0, Math.floor(Number(candidate?.quantity) || 0));
    if (listingQuantity) limits.push(listingQuantity);
    for (const raw of [
      input?.max,
      input?.getAttribute?.('data-max'),
      input?.getAttribute?.('aria-valuemax'),
      input?.dataset?.max,
      input?.dataset?.maximum,
    ]) {
      const value = Math.max(0, Math.floor(parseNumber(raw) || 0));
      if (value) limits.push(value);
    }
    const surfaceText = normalizeWhitespace(surface?.innerText || surface?.textContent || '');
    for (const pattern of [
      /\bmax(?:imum)?\D{0,18}([\d,]+)/i,
      /\b(?:available|stock)\D{0,18}([\d,]+)/i,
      /\bup to\D{0,12}([\d,]+)/i,
    ]) {
      const value = Math.max(0, Math.floor(parseNumber(surfaceText.match(pattern)?.[1]) || 0));
      if (value) limits.push(value);
    }
    return limits.length ? Math.max(1, Math.min(...limits)) : 1;
  }

  function quickMaxPurchaseSurface() {
    const selectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[class*="dialog" i]',
      '[class*="modal" i]',
      '[class*="popup" i]',
      '[class*="confirm" i]',
    ].join(',');
    const candidates = [...new Set([...document.querySelectorAll(selectors)])].filter((element) => {
      if (!visibleElement(element) || element.closest(`#${APP.panelId},[data-tsimm-generated]`)) return false;
      const text = normalizeWhitespace(element.innerText || element.textContent);
      if (!text || text.length > 5000) return false;
      return Boolean(quickMaxQuantityInput(element))
        || /\b(?:buy|purchase)\b/i.test(text)
        || (/\bYes\b/i.test(text) && /\bNo\b/i.test(text));
    });
    return candidates.sort((left, right) => {
      const leftInput = Number(Boolean(quickMaxQuantityInput(left)));
      const rightInput = Number(Boolean(quickMaxQuantityInput(right)));
      const leftYes = [...left.querySelectorAll('button,a,[role="button"],span,div')].find((element) =>
        /^yes$/i.test(normalizeWhitespace(element.textContent))
      );
      const rightYes = [...right.querySelectorAll('button,a,[role="button"],span,div')].find((element) =>
        /^yes$/i.test(normalizeWhitespace(element.textContent))
      );
      const leftConfirm = Number(Boolean(purchaseConfirmationFromClick(leftYes)));
      const rightConfirm = Number(Boolean(purchaseConfirmationFromClick(rightYes)));
      return rightConfirm - leftConfirm || rightInput - leftInput;
    })[0] || null;
  }

  function quickMaxPrimaryAction(surface) {
    if (!(surface instanceof Element)) return null;
    const controls = [...surface.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .filter((element) => visibleElement(element) && !element.disabled && !element.closest('[data-tsimm-generated]'));
    return controls.find((element) => {
      const label = quickMaxInteractiveLabel(element);
      if (/^(?:yes|no|cancel|close|back)$/i.test(label)) return false;
      return /^(?:buy|purchase|confirm|continue)(?:\b|$)/i.test(label)
        || /\b(?:buy now|complete purchase|confirm purchase)\b/i.test(label);
    }) || null;
  }

  function quickMaxYesButton() {
    const controls = [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],span,div')]
      .filter((element) =>
        visibleElement(element)
        && !element.closest(`#${APP.panelId},[data-tsimm-generated]`)
        && /^yes$/i.test(normalizeWhitespace(element.textContent || element.value))
      );
    return controls.find((element) => Boolean(purchaseConfirmationFromClick(element))) || null;
  }

  function quickMaxConfirmationAction(surface = null) {
    const roots = surface instanceof Element ? [surface] : [];
    if (!roots.length) {
      roots.push(...document.querySelectorAll('[role="dialog"],[aria-modal="true"],[class*="dialog" i],[class*="modal" i],[class*="popup" i],[class*="confirm" i]'));
    }
    for (const root of roots) {
      if (!(root instanceof Element) || !visibleElement(root)) continue;
      const parsed = parsePurchaseConfirmationText(root.innerText || root.textContent || '');
      if (!parsed) continue;
      const controls = [...root.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],span,div')]
        .filter((element) =>
          visibleElement(element)
          && !element.disabled
          && !element.closest(`#${APP.panelId},[data-tsimm-generated]`)
        );
      const button = controls.find((element) => /^yes$/i.test(normalizeWhitespace(element.textContent || element.value)))
        || controls.find((element) => /^(?:buy|purchase|confirm|continue)(?:\b|$)/i.test(quickMaxInteractiveLabel(element)))
        || controls.find((element) => /\b(?:buy now|complete purchase|confirm purchase)\b/i.test(quickMaxInteractiveLabel(element)));
      if (button) return { button, parsed, surface: root };
    }
    return null;
  }

  function quickMaxVerifyConfirmation(parsed, candidate, maximum) {
    if (!parsed) throw new Error('Torn confirmation could not be verified.');
    if (parsed.quantity <= 0 || parsed.quantity !== maximum) {
      throw new Error(`Torn confirmation quantity ${parsed.quantity} did not match the armed MAX ${maximum}.`);
    }
    const expectedName = quickMaxSyntheticPurchase(candidate, maximum).itemName;
    if (expectedName && normalizeName(parsed.itemName) !== normalizeName(expectedName)) {
      throw new Error('Torn confirmation item did not match the selected listing.');
    }
    const expectedTotal = Number(candidate.price) * Number(parsed.quantity);
    if (expectedTotal > 0 && Math.abs(parsed.totalCost - expectedTotal) > Math.max(1, parsed.quantity)) {
      throw new Error('Torn confirmation total did not match the selected listing price.');
    }
    return parsed;
  }

  function waitForQuickMax(getter, timeoutMs = 1800, intervalMs = 35) {
    const started = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        const value = getter();
        if (value || Date.now() - started >= timeoutMs) {
          resolve(value || null);
          return;
        }
        setTimeout(check, intervalMs);
      };
      check();
    });
  }

  function quickMaxSyntheticPurchase(candidate, quantity) {
    const resolution = resolveListingMarketValue();
    const itemId = resolution.itemId || itemIdFromLocation();
    const catalog = catalogItemFor(resolution.itemName, itemId);
    const itemName = catalog?.name || resolution.itemName || listingItemNameFromPage() || 'Item Market purchase';
    const totalCost = Number(candidate?.price || 0) * Number(quantity || 0);
    return {
      itemName,
      quantity,
      totalCost,
      unitCost: Number(candidate?.price || 0),
      confirmationText: `Quick MAX ${quantity} x ${itemName} for ${formatMoney(totalCost)}`,
    };
  }

  function clearQuickMaxPendingSilently(pendingId) {
    if (!pendingId || state.pendingPurchase?.id !== pendingId) return;
    state.pendingPurchase = null;
    savePendingPurchase();
    renderPanel();
  }

  function quickMaxFailClosed(message, pendingId = '') {
    clearQuickMaxPendingSilently(pendingId);
    if (state.quickMaxOverrideArmed) {
      state.quickMaxOverrideArmed = false;
      renderPanel();
      scheduleScan(20);
    }
    toast(`${message} Override MAX is off.`);
  }

  function decorateQuickMaxCandidate(candidate, scanToken) {
    const row = candidate?.row;
    if (!(row instanceof Element)) return;
    const buyControl = quickMaxBuyControl(row);
    let button = row.querySelector('[data-tsimm-quick-max]');
    if (!buyControl) {
      button?.remove();
      row.classList.remove(APP.quickMaxRowClass);
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.tsimmQuickMax = '1';
      button.dataset.tsimmGenerated = 'true';
      const parent = buyControl.parentElement || row;
      parent.insertBefore(button, buyControl);
    }
    button.className = `${APP.quickMaxButtonClass}${state.quickMaxOverrideArmed ? ' armed' : ''}`;
    button.textContent = state.quickMaxOverrideArmed ? '⚡ MAX' : 'MAX';
    button.title = state.quickMaxOverrideArmed
      ? 'Override MAX armed: fill and submit the maximum purchase'
      : 'Fill the maximum quantity and stop before submission';
    button.setAttribute('aria-label', button.title);
    button.dataset.tsimmScanToken = scanToken;
    button.disabled = Boolean(state.quickMaxBusy);
    row.classList.add(APP.quickMaxRowClass);
  }

  async function runQuickMax(button) {
    if (state.quickMaxBusy || !(button instanceof HTMLElement)) return;
    const row = button.closest(`.${APP.listingMark}`) || button.closest('li,[class*="row"],[class*="listing"]');
    const candidate = listingCandidates().find((entry) => entry.row === row);
    const buyControl = quickMaxBuyControl(row);
    if (!candidate || !buyControl) {
      toast('Quick MAX could not resolve this listing. Refresh and try again.');
      return;
    }

    const override = Boolean(state.quickMaxOverrideArmed);
    state.quickMaxBusy = true;
    state.quickMaxLastActionAt = Date.now();
    scheduleScan(0);
    let maximum = Math.max(1, Math.floor(Number(candidate.quantity) || 1));
    let pendingId = '';

    try {
      const rowInput = quickMaxQuantityInput(row);
      if (rowInput) {
        maximum = quickMaxMaximum(candidate, rowInput, row);
        if (!quickMaxSetInput(rowInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');
        const rowApplied = await waitForQuickMax(() => parseNumber(quickMaxQuantityValue(rowInput)) === maximum ? rowInput : null, 500);
        if (!rowApplied) throw new Error('Torn reverted the MAX quantity field update.');
        if (!override) {
          toast(`MAX set to ${formatInteger(maximum)}. Press Torn's Buy button when ready.`);
          return;
        }
        beginPendingPurchase(quickMaxSyntheticPurchase(candidate, maximum));
        pendingId = state.pendingPurchase?.id || '';
        buyControl.click();
      } else {
        buyControl.click();
        const surface = await waitForQuickMax(() => quickMaxPurchaseSurface(), 1800);
        if (!surface) throw new Error('Torn did not open a recognizable purchase dialog.');
        const directConfirmation = quickMaxConfirmationAction(surface);
        if (directConfirmation) {
          const parsed = quickMaxVerifyConfirmation(directConfirmation.parsed, candidate, maximum);
          if (!override) {
            toast(`Torn opened a verified purchase confirmation for ${formatInteger(parsed.quantity)}. Review it and submit when ready.`);
            return;
          }
          beginPendingPurchase(parsed);
          pendingId = state.pendingPurchase?.id || '';
          directConfirmation.button.click();
          toast(`Override MAX submitted ${formatInteger(parsed.quantity)}× ${parsed.itemName}.`);
          return;
        }
        const dialogInput = quickMaxQuantityInput(surface);
        if (!dialogInput) throw new Error('Torn opened a purchase dialog without a quantity field or verified confirmation.');
        maximum = quickMaxMaximum(candidate, dialogInput, surface);
        if (!quickMaxSetInput(dialogInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');
        const dialogApplied = await waitForQuickMax(() => parseNumber(quickMaxQuantityValue(dialogInput)) === maximum ? dialogInput : null, 500);
        if (!dialogApplied) throw new Error('Torn reverted the MAX quantity field update.');
        if (!override) {
          toast(`MAX set to ${formatInteger(maximum)}. Review Torn's dialog and submit when ready.`);
          return;
        }
        beginPendingPurchase(quickMaxSyntheticPurchase(candidate, maximum));
        pendingId = state.pendingPurchase?.id || '';
        const primary = quickMaxPrimaryAction(surface);
        if (!primary) throw new Error('Torn did not expose a recognizable purchase button.');
        primary.click();
      }

      const confirmation = await waitForQuickMax(() => quickMaxConfirmationAction(), 1600);
      if (confirmation) {
        const parsed = quickMaxVerifyConfirmation(confirmation.parsed, candidate, maximum);
        confirmation.button.click();
        toast(`Override MAX submitted ${formatInteger(parsed.quantity)}× ${parsed.itemName}.`);
      } else {
        toast(`Override MAX submitted up to ${formatInteger(maximum)}. Waiting for Torn's response.`);
      }
    } catch (error) {
      if (override) quickMaxFailClosed(error?.message || 'Quick MAX stopped on an unrecognized purchase step.', pendingId);
      else toast(error?.message || 'Quick MAX could not fill this purchase.');
    } finally {
      state.quickMaxBusy = false;
      scheduleScan(60);
    }
  }

  function handleQuickMaxClick(event) {
    const button = event.target.closest?.('[data-tsimm-quick-max]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runQuickMax(button);
  }

  function scanListings(stats, scanToken) {
    const candidates = listingCandidates();
    stats.listingCandidates = candidates.length;
    if (!candidates.length) return;

    const lowestListing = [...candidates].sort((left, right) => Number(left.price) - Number(right.price))[0] || null;
    stats.listingLowestPrice = Number(lowestListing?.price) > 0 ? Number(lowestListing.price) : null;
    stats.listingLowestQuantity = Number(lowestListing?.quantity) > 0 ? Number(lowestListing.quantity) : null;

    for (const candidate of candidates) decorateQuickMaxCandidate(candidate, scanToken);

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


  function clearOverseasPlanAnnotations() {
    document.querySelectorAll('[data-tsimm-overseas-plan-ui]').forEach((element) => element.remove());
    document.querySelectorAll('.tsimm-overseas-planned').forEach((element) => {
      element.classList.remove('tsimm-overseas-planned');
      delete element.dataset.tsimmOverseasPlanRank;
    });
    document.querySelectorAll('.tsimm-overseas-buy-line').forEach((element) => element.remove());
  }

  function overseasPlanItemKey(item) {
    const itemId = Number(item?.itemId || item?.catalog?.id) || 0;
    return itemId > 0 ? `id:${itemId}` : `name:${normalizeName(item?.name || item?.catalog?.name)}`;
  }

  function applyOverseasPagePlan(candidates, priced, plan, stats, scanToken) {
    clearOverseasPlanAnnotations();
    const anchorRow = candidates[0]?.row || priced[0]?.row;
    if (!(anchorRow instanceof Element)) return;
    const planned = new Map((plan.items || []).map((item) => [overseasPlanItemKey(item), item]));
    const ranked = new Map((plan.rankedItems || []).map((item) => [overseasPlanItemKey(item), item]));
    for (const item of priced) {
      const rank = ranked.get(overseasPlanItemKey(item));
      if (!rank || !(item.row instanceof Element)) continue;
      const selected = planned.get(overseasPlanItemKey(item));
      item.row.classList.add('tsimm-overseas-planned');
      item.row.dataset.tsimmOverseasPlanRank = String(rank.rank);
      item.row.dataset.tsimmScanToken = scanToken;
      const badge = directMarginBadge(item.priceElement, 'overseas');
      if (!badge) continue;
      const line = document.createElement('span');
      line.className = 'tsimm-overseas-buy-line';
      line.dataset.tsimmOverseasPlanUi = 'true';
      line.textContent = selected
        ? `#${rank.rank} BUY ${formatInteger(selected.quantity)} · +${formatMoney(selected.profit)} trip`
        : `#${rank.rank} BACKUP · +${formatMoney(rank.profitEach)} ea`;
      badge.appendChild(line);
      badge.classList.add('tsimm-overseas-planned-badge');
    }
    const card = document.createElement('section');
    card.className = 'tsimm-overseas-page-plan';
    card.dataset.tsimmOverseasPlanUi = 'true';
    card.dataset.tsimmScanToken = scanToken;
    const selected = planned;
    const lines = (plan.rankedItems || []).map((item) => {
      const pick = selected.get(overseasPlanItemKey(item));
      const role = item.rank === 1 ? 'BEST' : 'RUNNER-UP';
      const instruction = pick ? `BUY ${formatInteger(pick.quantity)}` : `BACKUP UP TO ${formatInteger(item.runQuantity)}`;
      return `<div><span><b>#${item.rank} ${role}</b> ${escapeHtml(item.name)} · stock ${formatInteger(item.availableQuantity)} · ${instruction}</span><strong>+${escapeHtml(formatMoney(item.profitEach))} ea</strong></div>`;
    }).join('');
    const fill = (plan.items || []).map((item) => `${escapeHtml(item.name)} × ${formatInteger(item.quantity)}`).join(' + ');
    const message = !plan.remainingCapacity
      ? 'Your configured travel load is already full.'
      : !(plan.rankedItems || []).length
        ? 'No profitable 99% exit was found.'
        : `${fill || 'No fill'} · cost ${formatMoney(plan.totalCost)} · return ${formatMoney(plan.traderReturn)}`;
    card.innerHTML = `<div class="tsimm-overseas-page-plan-head"><strong>✈️ GOBLIN GOD BEST RUN</strong><b>+${escapeHtml(formatMoney(plan.profit))} trip profit</b></div><span>${escapeHtml(message)}</span>${lines ? `<div class="tsimm-overseas-page-plan-list">${lines}</div>` : ''}`;
    let anchor = anchorRow.tagName === 'TR' ? (anchorRow.closest('table') || anchorRow) : anchorRow;
    const list = anchorRow.closest('ul,ol,[class*="shop-list"],[class*="items-list"],[class*="stock"]');
    if (anchorRow.tagName !== 'TR' && list && list !== document.body) anchor = list;
    if (anchor.parentElement) anchor.insertAdjacentElement('beforebegin', card);
    else document.body.prepend(card);
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
      const catalog = catalogItemForCard(candidate.row, candidate.name, candidate.itemId);
      if (!catalog) continue;
      const visibleQuantity = Math.max(1, Math.floor(Number(candidate.availableQuantity) || 1));
      const margin = marginFor(candidate.price, catalog.marketPrice, visibleQuantity);
      addBadge(candidate.priceElement, margin, 'overseas', candidate.row, scanToken);
      const item = {
        ...candidate,
        name: catalog.name,
        itemId: candidate.itemId || catalog.id || null,
        catalog,
        margin,
      };
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
    stats.overseasRankedItems = plan.rankedItems;
    applyOverseasPagePlan(candidates, priced, plan, stats, scanToken);

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
    const isInventory = !isProfile && pageLooksLikeInventory();
    const isOverseas = !isProfile && !isInventory && pageLooksLikeOverseasShop();
    const isItemMarket = !isInventory && !isOverseas && pageLooksLikeItemMarket();
    const isTrade = !isProfile && !isInventory && !isOverseas && pageLooksLikeTrade();
    const hasPriceCaptureContext = Boolean(activePendingTraderCapture() || activePriceRecaptureRequest());
    const isPriceCapturePage = !isItemMarket && !isTrade && !isProfile && !isInventory && !isOverseas && hasPriceCaptureContext;
    if (!isItemMarket && !isTrade && !isProfile && !isInventory && !isOverseas && !isPriceCapturePage) {
      clearAnnotations();
      document.getElementById(APP.panelId)?.remove();
      state.lastScan = emptyScanStats();
      state.lastScan.notes.push('Waiting for Inventory, the Item Market, an overseas shop, Trade, player Profile, or an armed price-page capture.');
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
    stats.pageType = isProfile ? 'profile' : (isInventory ? 'inventory' : (isTrade ? 'trade' : (isOverseas ? 'overseas shop' : (isPriceCapturePage ? 'price capture' : detectPageType(stats)))));
    if (isInventory) stats.notes.push('Inventory page ready. Open Reconcile to check the dedicated API key and compare holdings.');
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
    if (isInventory) maybeOpenInventoryReconcileIntent();
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
      fundingSource: normalizeLedgerFundingSource(state.settings.ledgerDefaultFundingSource, 'personal'),
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

  function purchaseFingerprint(parsed, itemId = itemIdFromLocation()) {
    return [
      normalizeName(parsed?.itemName),
      Math.floor(Number(parsed?.quantity) || 0),
      Math.round(Number(parsed?.totalCost) || 0),
      Number(itemId) || 0,
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
    const locationItemId = overseas ? null : itemIdFromLocation();
    const catalog = catalogItemFor(parsed.itemName, locationItemId);
    const resolvedItemId = catalog?.id || locationItemId || null;
    const fingerprint = purchaseFingerprint(parsed, resolvedItemId);

    if (state.pendingPurchase) {
      const pendingMatches = normalizeName(state.pendingPurchase.itemName) === normalizeName(parsed.itemName)
        && Number(state.pendingPurchase.quantity) === Number(parsed.quantity)
        && Math.round(Number(state.pendingPurchase.totalCost)) === Math.round(Number(parsed.totalCost));
      if (pendingMatches) {
        recordPurchaseSignal('success', source, parsed.successText, url);
        return commitPendingPurchase(source, parsed.successText);
      }
    }

    if (hasRecentPurchaseFingerprint(fingerprint)) {
      recordPurchaseSignal('duplicate-suppressed', source, parsed.successText, url);
      return null;
    }

    const marketValueAtPurchase = Number(catalog?.marketPrice || (overseas ? 0 : resolveListingMarketValue().value) || 0);
    const lot = buildLedgerLot({
      source: overseas ? 'overseas' : 'item-market',
      venue: overseas ? 'overseas' : 'item-market',
      country: overseas ? overseasCountryFromPage() : '',
      itemId: resolvedItemId,
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
    const fundingRaw = prompt(
      'Funding source (Personal, Butcher, Shared, Other, or Unassigned):',
      ledgerFundingSourceLabel(existing?.fundingSource || state.settings.ledgerDefaultFundingSource),
    );
    if (fundingRaw === null) return null;
    const fundingSource = normalizeLedgerFundingSource(fundingRaw, '');
    if (!fundingSource) {
      alert('Funding source must be Personal, Butcher, Shared, Other, or Unassigned.');
      return null;
    }
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
      fundingSource,
      location: existing?.location || '',
      capturedAt: existing?.capturedAt || new Date().toISOString(),
      purchaseUrl: existing?.purchaseUrl || location.href,
      notes,
    }, existing ? existing.captureMethod || 'manual-edit' : 'manual');
  }



  function promptMissedLedgerSale() {
    const itemName = normalizeWhitespace(prompt('Sold item name:', listingItemNameFromPage() || ''));
    if (!itemName) return null;
    const quantity = Math.max(0, Math.floor(Number(prompt('Quantity sold:', '1')) || 0));
    if (quantity <= 0) return null;
    const cashReceived = Math.max(0, Number(prompt('Total cash received for this sale:', '0')) || 0);
    if (cashReceived <= 0) return null;
    const counterparty = normalizeWhitespace(prompt('Buyer or trader name (optional):', ''));
    const catalog = catalogItemFor(itemName);
    const marketPrice = Math.max(0, Number(catalog?.marketPrice) || 0);
    const targetEach = cashReceived / quantity;
    const stats = emptyScanStats();
    stats.pageType = 'trade';
    stats.tradeId = `recovery-${Date.now()}`;
    stats.tradeCounterparty = counterparty || 'Recovered sale';
    stats.tradeCounterpartyId = null;
    stats.tradeCounterpartyProfileUrl = '';
    stats.tradeCounterpartyBannerUrl = '';
    stats.tradeMarketTotal = marketPrice * quantity;
    stats.tradeTargetTotal = cashReceived;
    stats.tradeTraderCash = cashReceived;
    stats.tradeMyCash = 0;
    stats.tradeNetCash = cashReceived;
    stats.tradeItems = [{
      itemId: catalog?.id || null,
      name: catalog?.name || itemName,
      quantity,
      marketPrice,
      marketTotal: marketPrice * quantity,
      targetEach,
      targetTotal: cashReceived,
    }];
    stats.tradeMatchedItems = 1;
    stats.tradeUnmatchedItems = 0;
    stats.tradeUnmatched = [];
    const plan = ledgerSalePlan(stats);
    if (!plan.trackedQuantity) {
      alert('No open ledger lots matched this item. Correct the item name or add the missing purchase lot first.');
      return null;
    }
    if (!plan.fullCoverage) {
      alert(`Only ${formatInteger(plan.trackedQuantity)} of ${formatInteger(plan.requestedQuantity)} sold items are covered by open lots. Recovery stopped so the ledger cannot invent a cost basis.`);
      return null;
    }
    const profit = cashReceived - plan.trackedCostBasis;
    const accepted = confirm(
      `Recover this missed sale?\n\n${catalog?.name || itemName} × ${formatInteger(quantity)}\nCash received: ${formatMoney(cashReceived)}\nFIFO cost basis: ${formatMoney(plan.trackedCostBasis)}\nRealized profit: ${profit >= 0 ? '+' : ''}${formatMoney(profit)}\n\nThis will reduce the matching open lots and create a Sale Audit record.`
    );
    return accepted ? stats : null;
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

  function editLedgerLotFundingSource(id) {
    const lot = state.ledger.lots.find((entry) => entry.id === id);
    if (!lot) return;
    const raw = prompt(
      'Funding source (Personal, Butcher, Shared, Other, or Unassigned):',
      ledgerFundingSourceLabel(lot.fundingSource),
    );
    if (raw === null) return;
    const fundingSource = normalizeLedgerFundingSource(raw, '');
    if (!fundingSource) {
      alert('Funding source must be Personal, Butcher, Shared, Other, or Unassigned.');
      return;
    }
    lot.fundingSource = fundingSource;
    saveLedger();
    renderLedger();
    renderPanel();
    toast(`${lot.itemName} funding set to ${ledgerFundingSourceLabel(fundingSource)}.`);
  }

  function chooseLedgerDefaultFundingSource() {
    const raw = prompt(
      'Default funding source for NEW purchases (Personal, Butcher, Shared, Other, or Unassigned):',
      ledgerFundingSourceLabel(state.settings.ledgerDefaultFundingSource),
    );
    if (raw === null) return;
    const fundingSource = normalizeLedgerFundingSource(raw, '');
    if (!fundingSource) {
      alert('Funding source must be Personal, Butcher, Shared, Other, or Unassigned.');
      return;
    }
    state.settings.ledgerDefaultFundingSource = fundingSource;
    saveJson(APP.settingsStorageKey, state.settings);
    renderLedger();
    renderPanel();
    toast(`New purchases will use ${ledgerFundingSourceLabel(fundingSource)} funding.`);
  }

  function assignUnassignedOpenLedgerLots() {
    const target = normalizeLedgerFundingSource(state.settings.ledgerDefaultFundingSource, 'personal');
    if (target === 'unassigned') {
      toast('Choose a Personal, Butcher, Shared, or Other default first.');
      return;
    }
    const lots = state.ledger.lots.filter((lot) =>
      Number(lot.remainingQuantity || 0) > 0
      && normalizeLedgerFundingSource(lot.fundingSource) === 'unassigned'
    );
    if (!lots.length) {
      toast('No unassigned open lots were found.');
      return;
    }
    const invested = lots.reduce((sum, lot) =>
      sum + Number(lot.unitCost || 0) * Number(lot.remainingQuantity || 0), 0);
    if (!confirm(
      `Assign ${formatInteger(lots.length)} unassigned open lot${lots.length === 1 ? '' : 's'} to ${ledgerFundingSourceLabel(target)}?

`
      + `Remaining invested capital: ${formatMoney(invested)}

This changes only the funding label. Quantities, prices, cost basis, and sales are untouched.`
    )) return;
    for (const lot of lots) lot.fundingSource = target;
    saveLedger();
    renderLedger();
    renderPanel();
    toast(`Assigned ${formatInteger(lots.length)} open lot${lots.length === 1 ? '' : 's'} to ${ledgerFundingSourceLabel(target)}.`);
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

  function loadLedgerCleanupBackup() {
    try {
      const parsed = JSON.parse(localStorage.getItem(APP.ledgerCleanupBackupStorageKey) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function ledgerLotUntouchedForCleanup(lot) {
    const quantity = Math.max(0, Number(lot?.quantity) || 0);
    const remaining = Math.max(0, Number(lot?.remainingQuantity) || 0);
    return quantity > 0
      && remaining === quantity
      && normalizeWhitespace(lot?.status || 'open').toLowerCase() === 'open';
  }

  function exactLedgerDuplicateKey(lot) {
    const identity = Number(lot?.itemId) > 0
      ? `id:${Number(lot.itemId)}`
      : `name:${normalizeName(lot?.itemName || lot?.normalizedName)}`;
    return [
      identity,
      normalizeWhitespace(lot?.source),
      normalizeWhitespace(lot?.venue),
      normalizeLedgerFundingSource(lot?.fundingSource),
      Math.floor(Number(lot?.quantity) || 0),
      Math.floor(Number(lot?.remainingQuantity) || 0),
      Number(lot?.unitCost) || 0,
      Number(lot?.totalCost) || 0,
      Number(lot?.marketValueAtPurchase) || 0,
      Number(lot?.traderValueAtPurchase) || 0,
      Number(lot?.expectedProfitEach) || 0,
      Number(lot?.expectedProfitTotal) || 0,
      normalizeWhitespace(lot?.status || 'open').toLowerCase(),
    ].join('|');
  }

  function exactDuplicateLedgerPairs() {
    const lots = Array.isArray(state.ledger?.lots) ? state.ledger.lots : [];
    const fetchLots = lots.filter((lot) => lot?.captureMethod === 'fetch-success' && ledgerLotUntouchedForCleanup(lot));
    const fallbackLots = lots.filter((lot) => lot?.captureMethod === 'dom-success-fallback' && ledgerLotUntouchedForCleanup(lot));
    const usedFetchIds = new Set();
    const pairs = [];

    for (const fallback of fallbackLots) {
      const fallbackTime = Date.parse(fallback.capturedAt || '');
      if (!Number.isFinite(fallbackTime)) continue;
      const key = exactLedgerDuplicateKey(fallback);
      let best = null;
      for (const fetchLot of fetchLots) {
        if (usedFetchIds.has(fetchLot.id) || exactLedgerDuplicateKey(fetchLot) !== key) continue;
        const fetchTime = Date.parse(fetchLot.capturedAt || '');
        if (!Number.isFinite(fetchTime)) continue;
        const deltaMs = Math.abs(fallbackTime - fetchTime);
        if (deltaMs > 250) continue;
        if (!best || deltaMs < best.deltaMs) best = { keep: fetchLot, remove: fallback, deltaMs };
      }
      if (!best) continue;
      usedFetchIds.add(best.keep.id);
      pairs.push(best);
    }
    return pairs;
  }

  function exactDuplicateLedgerPreview() {
    const pairs = exactDuplicateLedgerPairs();
    return {
      pairs,
      lots: pairs.length,
      quantity: pairs.reduce((sum, pair) => sum + Number(pair.remove.quantity || 0), 0),
      invested: pairs.reduce((sum, pair) => sum + Number(pair.remove.totalCost || 0), 0),
      expectedProfit: pairs.reduce((sum, pair) => sum + Number(pair.remove.expectedProfitTotal || 0), 0),
    };
  }

  function cleanExactLedgerDuplicates() {
    const preview = exactDuplicateLedgerPreview();
    if (!preview.lots) {
      toast('No untouched exact capture duplicates were found.');
      return;
    }
    const accepted = confirm(
      `Remove ${formatInteger(preview.lots)} exact duplicate lot${preview.lots === 1 ? '' : 's'}?\n\n`
      + `Tracked quantity correction: ${formatInteger(preview.quantity)} items\n`
      + `Invested correction: ${formatMoney(preview.invested)}\n`
      + `Expected-profit correction: ${preview.expectedProfit >= 0 ? '+' : ''}${formatMoney(preview.expectedProfit)}\n\n`
      + 'Only untouched fetch-success / dom-success-fallback pairs with identical values and timestamps within 250ms will be removed. A full pre-cleanup ledger backup will be stored for one-click undo.'
    );
    if (!accepted) return;

    const backup = {
      schema: 'tornscripture-imm-ledger-cleanup-backup',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      reason: 'exact-cross-channel-capture-duplicates',
      removedLotIds: preview.pairs.map((pair) => pair.remove.id),
      ledger: JSON.parse(JSON.stringify(state.ledger)),
    };
    saveJson(APP.ledgerCleanupBackupStorageKey, backup);
    const removeIds = new Set(backup.removedLotIds);
    state.ledger.lots = state.ledger.lots.filter((lot) => !removeIds.has(lot.id));
    saveLedger();
    renderLedger();
    renderPanel();
    toast(`Removed ${formatInteger(preview.lots)} exact duplicate lot${preview.lots === 1 ? '' : 's'}. Undo is available in the Ledger.`);
  }

  function undoExactLedgerDuplicateCleanup() {
    const backup = loadLedgerCleanupBackup();
    if (!backup?.ledger) {
      toast('No duplicate-cleanup backup is available.');
      return;
    }
    const created = new Date(backup.createdAt || '');
    const when = Number.isFinite(created.getTime()) ? created.toLocaleString() : 'an earlier time';
    const accepted = confirm(
      `Restore the complete ledger snapshot from ${when}?\n\n`
      + 'This replaces the current ledger, including any purchases or sales recorded after that cleanup.'
    );
    if (!accepted) return;
    state.ledger = normalizeLedger(backup.ledger);
    localStorage.removeItem(APP.ledgerCleanupBackupStorageKey);
    saveLedger();
    renderLedger();
    renderPanel();
    toast('Duplicate cleanup undone and the previous ledger restored.');
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
    if (state.ledgerUi.fundingFilter !== 'all') {
      lots = lots.filter((lot) => normalizeLedgerFundingSource(lot.fundingSource) === state.ledgerUi.fundingFilter);
    }
    return sortLedgerLots(lots, state.ledgerUi.sort);
  }

  function ledgerFundingSummary() {
    const openLots = (state.ledger.lots || []).filter((lot) => Number(lot.remainingQuantity || 0) > 0);
    return LEDGER_FUNDING_SOURCES.map((fundingSource) => {
      const lots = openLots.filter((lot) => normalizeLedgerFundingSource(lot.fundingSource) === fundingSource);
      return {
        fundingSource,
        label: ledgerFundingSourceLabel(fundingSource),
        lots: lots.length,
        quantity: lots.reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0), 0),
        invested: lots.reduce((sum, lot) =>
          sum + Number(lot.unitCost || 0) * Number(lot.remainingQuantity || 0), 0),
        expectedProfit: lots.reduce((sum, lot) =>
          sum + Number(lot.expectedProfitEach || 0) * Number(lot.remainingQuantity || 0), 0),
      };
    }).filter((row) => row.lots > 0);
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
          <span>Funding</span><strong>${escapeHtml(ledgerFundingSourceLabel(lot.fundingSource))}</strong>
          <span>Possible profit when bought</span><strong class="${originalClass}">${originalProfit === null ? 'Original value unavailable' : `${originalProfit >= 0 ? '+' : ''}${formatMoney(originalProfit)}`}</strong>
          <span>Possible profit now${remaining > 0 ? ' on remaining' : ''}</span><strong class="${currentClass}">${escapeHtml(currentProfitText)}</strong>
        </div>
        <div class="tsimm-ledger-lot-foot">
          <small>${escapeHtml(when)}</small>
          <div>
            <button type="button" data-tsimm-action="ledger-funding-edit" data-tsimm-lot-id="${escapeHtml(lot.id)}">Funding</button>
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

  function formatLedgerIntegrityAmount(value) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }

  function ledgerIntegrityHtml(report) {
    const issues = Array.isArray(report?.issues) ? report.issues : [];
    if (!issues.length) {
      return `
        <section class="tsimm-integrity-result good">
          <strong>No integrity issues found</strong>
          <span>Read-only checks found no duplicate IDs, missing lot references, or quantity and accounting disagreements.</span>
        </section>
      `;
    }
    const groups = LEDGER_INTEGRITY_GROUPS.map((group) => ({
      ...group,
      issues: issues.filter((issue) => issue.type === group.type),
    })).filter((group) => group.issues.length);
    const moneyTypes = new Set(['cost-basis-total', 'proceeds-total', 'realized-profit-total']);
    const groupHtml = groups.map((group) => `
      <section class="tsimm-integrity-group">
        <div class="tsimm-integrity-group-head">
          <strong>${escapeHtml(group.label)}</strong>
          <span>${formatInteger(group.issues.length)}</span>
        </div>
        <div class="tsimm-integrity-list">
          ${group.issues.map((issue) => {
            const detail = moneyTypes.has(issue.type)
              ? String(issue.detail).replace(/-?\d+(?:\.\d+)?/g, (value) => formatLedgerIntegrityAmount(value))
              : issue.detail;
            return `
              <article class="tsimm-integrity-issue">
                <strong>${escapeHtml(issue.recordId)}</strong>
                <span>${escapeHtml(detail)}</span>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `).join('');
    return `
      <div class="tsimm-integrity-note">
        Read-only report. Nothing on this screen normalizes, saves, repairs, deletes, or changes Ledger records.
      </div>
      <section class="tsimm-integrity-result bad">
        <strong>${formatInteger(issues.length)} integrity issue${issues.length === 1 ? '' : 's'} found</strong>
        <span>Review the affected IDs before editing or deleting any Ledger data.</span>
      </section>
      <div class="tsimm-integrity-groups">${groupHtml}</div>
    `;
  }

  function renderLedger() {
    const overlay = document.getElementById(APP.ledgerOverlayId);
    if (!overlay) return;
    injectLedgerReconciliationStyles();
    const summary = ledgerSummary();
    const lots = visibleLedgerLots();
    const sales = state.ledger.sales || [];
    const view = state.ledgerUi.view;
    const reconciliationRows = ledgerReconciliationRows();
    const issues = reconciliationRows.filter((row) => ['untracked', 'missing'].includes(row.status)).length;
    const catalogFreshness = state.catalog.updatedAt
      ? `Current values synced ${relativeAge(state.catalog.updatedAt)}${catalogIsFresh() ? '' : ' · stale'}`
      : 'Current values have not been synced';
    const inventoryCaptureNote = state.inventory?.captureMode === 'category-fallback'
      ? ` · ${formatInteger(state.inventory.categoriesFetched?.length || 0)} categories`
      : state.inventory?.captureMode === 'unfiltered'
        ? ' · complete endpoint'
        : '';
    const inventoryFreshness = state.inventory?.capturedAt
      ? `Inventory synced ${relativeAge(state.inventory.capturedAt)}${inventorySnapshotFresh() ? '' : ' · stale'}${inventoryCaptureNote}`
      : 'Inventory has not been synced';
    const showPurchaseControls = view === 'holdings' || view === 'history';
    const duplicatePreview = exactDuplicateLedgerPreview();
    const cleanupBackup = loadLedgerCleanupBackup();
    const fundingSummary = ledgerFundingSummary();
    const unassignedOpenLots = fundingSummary.find((row) => row.fundingSource === 'unassigned')?.lots || 0;
    const integrityReport = analyzeLedgerIntegrity(state.ledger);
    overlay.innerHTML = `
      <div class="tsimm-ledger-shell">
        <div class="tsimm-ledger-head">
          <div><strong>📒 GOBLIN GOD Ledger</strong><small>What you obtained, what it cost, and what it can earn · schema v5</small></div>
          <button type="button" data-tsimm-action="ledger-close">×</button>
        </div>
        <div class="tsimm-ledger-scroll">
          <div class="tsimm-ledger-summary">
          <div><strong>${formatInteger(summary.lots)}</strong><span>open lots</span></div>
          <div><strong>${formatInteger(summary.remainingQuantity)}</strong><span>tracked on hand</span></div>
          <div><strong>${formatMoney(summary.invested)}</strong><span>invested</span></div>
          <div><strong class="${summary.expectedProfit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${summary.expectedProfit >= 0 ? '+' : ''}${formatMoney(summary.expectedProfit)}</strong><span>original expected</span></div>
          <div><strong class="${summary.realizedProfit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${summary.realizedProfit >= 0 ? '+' : ''}${formatMoney(summary.realizedProfit)}</strong><span>realized</span></div>
        </div>
        ${fundingSummary.length ? `
          <div class="tsimm-ledger-section-title">Capital by funding source</div>
          <div class="tsimm-ledger-summary">
            ${fundingSummary.map((row) => `
              <div>
                <strong>${formatMoney(row.invested)}</strong>
                <span>${escapeHtml(row.label)} · ${formatInteger(row.lots)} lot${row.lots === 1 ? '' : 's'} · ${row.expectedProfit >= 0 ? '+' : ''}${formatMoney(row.expectedProfit)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="tsimm-ledger-tabs" role="tablist">
          <button type="button" class="${view === 'holdings' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="holdings">Current holdings</button>
          <button type="button" class="${view === 'reconcile' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="reconcile">Reconcile${issues ? ` (${formatInteger(issues)})` : ''}</button>
          <button type="button" class="${view === 'history' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="history">Purchase history</button>
          <button type="button" class="${view === 'sales' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="sales">Sale audits</button>
          <button type="button" class="${view === 'integrity' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="integrity">Integrity${integrityReport.issues.length ? ` (${formatInteger(integrityReport.issues.length)})` : ''}</button>
        </div>
        <div class="tsimm-ledger-actions">
          <button type="button" data-tsimm-action="inventory-sync" ${state.inventorySyncing ? 'disabled' : ''}>${state.inventorySyncing ? 'Syncing inventory…' : 'Sync inventory'}</button>
          <button type="button" data-tsimm-action="ledger-add">Add manual lot</button>
          <button type="button" data-tsimm-action="ledger-recover-sale">Recover missed sale</button>
          <button type="button" data-tsimm-action="ledger-copy">Copy JSON</button>
          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-default-funding">New money: ${escapeHtml(ledgerFundingSourceLabel(state.settings.ledgerDefaultFundingSource))}</button>
          <button type="button" data-tsimm-action="ledger-assign-unassigned" ${unassignedOpenLots ? '' : 'disabled'}>Assign unassigned${unassignedOpenLots ? ` (${formatInteger(unassignedOpenLots)})` : ''}</button>
          <button type="button" data-tsimm-action="ledger-clean-duplicates" ${duplicatePreview.lots ? '' : 'disabled'}>Clean exact duplicates${duplicatePreview.lots ? ` (${formatInteger(duplicatePreview.lots)})` : ''}</button>
          ${cleanupBackup?.ledger ? '<button type="button" data-tsimm-action="ledger-undo-cleanup">Undo cleanup</button>' : ''}
          <button type="button" data-tsimm-action="ledger-clear">Clear all</button>
        </div>
        <div class="tsimm-ledger-freshness">${escapeHtml(inventoryFreshness)}</div>
        ${view === 'reconcile'
          ? ledgerReconciliationHtml(reconciliationRows)
          : view === 'integrity'
            ? ledgerIntegrityHtml(integrityReport)
          : showPurchaseControls ? `
            <div class="tsimm-ledger-filters">
              <input type="search" value="${escapeHtml(state.ledgerUi.search)}" placeholder="Search item name" data-tsimm-ledger-search>
              <select data-tsimm-ledger-sort>
                <option value="newest" ${state.ledgerUi.sort === 'newest' ? 'selected' : ''}>Newest</option>
                <option value="oldest" ${state.ledgerUi.sort === 'oldest' ? 'selected' : ''}>Oldest</option>
                <option value="profit-now" ${state.ledgerUi.sort === 'profit-now' ? 'selected' : ''}>Highest profit now</option>
                <option value="item-name" ${state.ledgerUi.sort === 'item-name' ? 'selected' : ''}>Item name</option>
                <option value="purchase-price" ${state.ledgerUi.sort === 'purchase-price' ? 'selected' : ''}>Purchase price</option>
              </select>
              <select data-tsimm-ledger-funding-filter>
                ${ledgerFundingSourceOptions(state.ledgerUi.fundingFilter, true)}
              </select>
            </div>
            ${view === 'history' ? `<label class="tsimm-ledger-toggle"><input type="checkbox" data-tsimm-ledger-show-sold ${state.ledgerUi.showSold ? 'checked' : ''}> Show sold purchases</label>` : ''}
            <div class="tsimm-ledger-freshness">${escapeHtml(catalogFreshness)}</div>
            <div class="tsimm-ledger-section-title">${view === 'holdings' ? 'Current holdings' : 'Purchase history'} · ${formatInteger(lots.length)} lot${lots.length === 1 ? '' : 's'}</div>
            <div class="tsimm-ledger-list">${lots.length ? lots.map(ledgerLotHtml).join('') : '<div class="tsimm-ledger-empty">No matching purchase lots to show.</div>'}</div>
          ` : `
            <div class="tsimm-ledger-section-title">Sale history</div>
            <div class="tsimm-ledger-sales">${sales.length ? sales.map(ledgerSaleHtml).join('') : '<div class="tsimm-ledger-empty">No recorded sales yet.</div>'}</div>
          `}
        </div>
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
      (document.documentElement || document.body).appendChild(overlay);
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
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


  function saveTraderView() {
    saveJson(APP.traderViewStorageKey, {
      schemaVersion: 1,
      showHidden: Boolean(state.showHiddenTraders),
      updatedAt: new Date().toISOString(),
    });
  }

  function markTraderAvoid(id) {
    const trader = state.traders.find((entry) => entry.id === id);
    if (!trader) return;
    const current = traderReasonLabels(trader).join(', ');
    const raw = prompt(
      `Why should ${trader.name} be avoided?\n\nUse any of: prices, reputation, reliability, availability, vibe, other. Separate reasons with commas.`,
      current,
    );
    if (raw === null) return;
    const reasons = normalizeTraderReasons(raw);
    trader.disposition = 'avoid';
    trader.hiddenFromDisposition = 'avoid';
    trader.avoidReasons = reasons.length ? reasons : ['other'];
    trader.dispositionUpdatedAt = new Date().toISOString();
    trader.updatedAt = trader.dispositionUpdatedAt;
    saveTraders();
    renderTraders();
    renderPanel();
    toast(`${trader.name} marked AVOID${traderReasonLabels(trader).length ? ` · ${traderReasonLabels(trader).join(', ')}` : ''}.`);
  }

  function hideTrader(id) {
    const trader = state.traders.find((entry) => entry.id === id);
    if (!trader || !confirm(`Hide ${trader.name} from normal trader lists and automatic recommendations?`)) return;
    trader.hiddenFromDisposition = trader.disposition === 'avoid' ? 'avoid' : 'normal';
    trader.disposition = 'hidden';
    trader.dispositionUpdatedAt = new Date().toISOString();
    trader.updatedAt = trader.dispositionUpdatedAt;
    saveTraders();
    renderTraders();
    renderPanel();
    toast(`${trader.name} hidden. Their history and captured prices were preserved.`);
  }

  function restoreTrader(id) {
    const trader = state.traders.find((entry) => entry.id === id);
    if (!trader) return;
    const restored = trader.disposition === 'hidden' && trader.hiddenFromDisposition === 'avoid' ? 'avoid' : 'normal';
    trader.disposition = restored;
    if (restored === 'normal') trader.avoidReasons = [];
    trader.hiddenFromDisposition = restored === 'avoid' ? 'avoid' : 'normal';
    trader.dispositionUpdatedAt = new Date().toISOString();
    trader.updatedAt = trader.dispositionUpdatedAt;
    saveTraders();
    renderTraders();
    renderPanel();
    toast(`${trader.name} restored as ${restored === 'avoid' ? 'AVOID' : 'ACTIVE'}.`);
  }

  function toggleHiddenTraders() {
    state.showHiddenTraders = !state.showHiddenTraders;
    saveTraderView();
    renderTraders();
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
    const text = JSON.stringify({ schema: 'tornscripture-imm-traders', schemaVersion: 3, traders: state.traders }, null, 2);
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
    const disposition = normalizeTraderDisposition(trader.disposition);
    const reasonText = traderReasonLabels(trader).join(' · ');
    const statusLabel = disposition === 'avoid' ? '⚠ AVOID' : disposition === 'hidden' ? '◌ HIDDEN' : '✓ ACTIVE';
    const dispositionActions = disposition === 'normal'
      ? `<button type="button" class="tsimm-trader-avoid-action" data-tsimm-action="trader-avoid" data-tsimm-trader-id="${escapeHtml(trader.id)}">Avoid</button><button type="button" class="tsimm-trader-hide-action" data-tsimm-action="trader-hide" data-tsimm-trader-id="${escapeHtml(trader.id)}">Hide</button>`
      : disposition === 'avoid'
        ? `<button type="button" class="tsimm-trader-avoid-action" data-tsimm-action="trader-avoid" data-tsimm-trader-id="${escapeHtml(trader.id)}">Edit avoid</button><button type="button" data-tsimm-action="trader-restore" data-tsimm-trader-id="${escapeHtml(trader.id)}">Restore</button><button type="button" class="tsimm-trader-hide-action" data-tsimm-action="trader-hide" data-tsimm-trader-id="${escapeHtml(trader.id)}">Hide</button>`
        : `<button type="button" data-tsimm-action="trader-restore" data-tsimm-trader-id="${escapeHtml(trader.id)}">Restore</button>`;
    return `
      <article class="tsimm-trader-card tsimm-trader-${escapeHtml(disposition)}">
        <div class="tsimm-trader-card-head">
          ${trader.profileUrl
            ? `<a class="tsimm-trader-profile-button${trader.bannerUrl ? ' has-banner' : ''}" href="${escapeHtml(trader.profileUrl)}" title="Open ${escapeHtml(trader.name)}'s profile">${trader.bannerUrl ? `<img src="${escapeHtml(trader.bannerUrl)}" alt="${escapeHtml(trader.name)}"><span class="tsimm-trader-banner-label"><strong>${escapeHtml(trader.name)}</strong>${trader.userId ? `<small>[${escapeHtml(trader.userId)}]</small>` : ''}</span>` : `<strong>${escapeHtml(trader.name)}</strong>`}<span class="tsimm-trader-stars">${escapeHtml(stars)}</span></a>`
            : `<div class="tsimm-trader-profile-button"><strong>${escapeHtml(trader.name)}</strong><span>${escapeHtml(stars)}</span></div>`}
          <b>${escapeHtml(formatPercent(trader.targetPercent))} target</b>
        </div>
        <div class="tsimm-trader-disposition"><strong>${escapeHtml(statusLabel)}</strong><span>${escapeHtml(reasonText || (disposition === 'normal' ? 'Eligible for comparisons and refresh queues' : disposition === 'hidden' ? 'Excluded from normal lists and recommendations' : 'Excluded from automatic recommendations'))}</span></div>
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
          ${disposition === 'normal' && trader.tradeUrl && priceItemCount ? `<button type="button" class="tsimm-priced-trade-start" data-tsimm-action="trader-start-priced-trade" data-tsimm-trader-id="${escapeHtml(trader.id)}">Start priced trade</button>` : (disposition === 'normal' && trader.tradeUrl ? `<a href="${escapeHtml(trader.tradeUrl)}">Start trade</a>` : '')}
          ${trader.profileUrl ? `<a href="${escapeHtml(trader.profileUrl)}">Profile</a>` : ''}
          ${trader.pricePageUrl ? `<a href="${escapeHtml(trader.pricePageUrl)}">Open prices</a>` : ''}
          ${disposition === 'normal' && autoRecaptureAvailable ? `<button type="button" data-tsimm-action="trader-open-recapture" data-tsimm-trader-id="${escapeHtml(trader.id)}">Open & recapture</button>` : ''}
          ${disposition === 'normal' ? `<button type="button" data-tsimm-action="trader-arm-capture" data-tsimm-trader-id="${escapeHtml(trader.id)}">Arm price capture</button>` : ''}
          ${dispositionActions}
          <button type="button" data-tsimm-action="trader-edit" data-tsimm-trader-id="${escapeHtml(trader.id)}">Edit</button>
          <button type="button" data-tsimm-action="trader-delete" data-tsimm-trader-id="${escapeHtml(trader.id)}">Delete</button>
        </div>
      </article>
    `;
  }


  function renderTraders() {
    const overlay = document.getElementById(APP.traderOverlayId);
    if (!overlay) return;
    const hiddenCount = state.traders.filter((trader) => normalizeTraderDisposition(trader.disposition) === 'hidden').length;
    const avoidCount = state.traders.filter((trader) => normalizeTraderDisposition(trader.disposition) === 'avoid').length;
    const visibleTraders = state.traders.filter((trader) => state.showHiddenTraders || normalizeTraderDisposition(trader.disposition) !== 'hidden');
    overlay.innerHTML = `
      <div class="tsimm-trader-shell">
        <div class="tsimm-ledger-head">
          <div><strong>🤝 GOBLIN GOD Trader Book</strong><small>Fast links, ratings, notes, local sale history, and recommendation controls</small></div>
          <button type="button" data-tsimm-action="traders-close">×</button>
        </div>
        <div class="tsimm-trader-top">
          <strong>${formatInteger(state.traders.length)} saved · ${formatInteger(avoidCount)} avoid · ${formatInteger(hiddenCount)} hidden</strong>
          <span>${activePendingTraderCapture() ? `${escapeHtml(activePendingTraderCapture().name)} armed for next page` : 'Avoided and hidden traders are excluded from automatic recommendations.'}</span>
        </div>
        <div class="tsimm-ledger-actions">
          <button type="button" data-tsimm-action="trader-add">Add trader</button>
          ${state.lastScan.pageType === 'profile' && state.lastScan.profileCaptureReady ? '<button type="button" data-tsimm-action="trader-capture-profile">Capture this profile</button>' : ''}
          ${state.lastScan.pageType === 'trade' && state.lastScan.tradeCounterparty ? '<button type="button" data-tsimm-action="trader-save-current">Save current trade</button>' : ''}
          ${hiddenCount ? `<button type="button" data-tsimm-action="traders-toggle-hidden">${state.showHiddenTraders ? 'Hide hidden' : `Show hidden (${formatInteger(hiddenCount)})`}</button>` : ''}
          <button type="button" data-tsimm-action="traders-copy">Copy JSON</button>
          <button type="button" data-tsimm-action="traders-import">Import JSON</button>
        </div>
        <div class="tsimm-trader-list">
          ${visibleTraders.length ? visibleTraders.map(traderCardHtml).join('') : '<div class="tsimm-ledger-empty">No visible traders. Use Show hidden to restore a hidden trader.</div>'}
        </div>
      </div>
    `;
    setTimeout(() => {
      try {
        window.__TSIMM_WATCHLIST_API__?.decorateBook?.();
      } catch (error) {
        console.error('[TornScripture IMM] Favorite Trader Book decoration failed:', error);
      }
    }, 0);
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
      quickMax: {
        overrideArmed: state.quickMaxOverrideArmed,
        busy: state.quickMaxBusy,
        lastActionAt: state.quickMaxLastActionAt || null,
        visibleButtons: document.querySelectorAll('[data-tsimm-quick-max]').length,
      },
      calculationPolicy: {
        traderPercent: TRADER_PERCENT,
        payoutFormula: 'floor(marketValue * 0.99)',
        profitFormula: 'traderPayout - listingPrice',
        npcBuybackFormula: 'catalog.sell_price - listingPrice',
        manifestFormula: 'sum(floor(itemMarketValue * 0.99) * quantity)',
        tradeDifferenceFormula: 'otherSideCash - mySideCash - manifestTarget',
        tradeExitAuditFormula: 'best fresh concrete exit per item (current trader, favorite trader, or NPC) minus live net cash',
      },
      lastScan: state.lastScan,
      traders: state.traders.map((trader) => ({ ...trader, stats: traderStats(trader) })),
      ledger: {
        summary: ledgerSummary(),
        updatedAt: state.ledger.updatedAt,
        recentLots: state.ledger.lots.slice(0, 8),
        recentSales: (state.ledger.sales || []).slice(0, 5),
      },
      inventoryBaseline: state.inventoryBaseline,
      sellPriority: state.sellPriority,
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
      #${APP.panelId}{position:fixed;right:8px;bottom:118px;width:min(292px,calc(100vw - 16px));max-height:calc(100vh - 134px);max-height:calc(100dvh - 134px);z-index:2147483000;display:flex;flex-direction:column;border:1px solid #58506b;border-radius:12px;background:#1d1b22;color:#f4f1f8;box-shadow:0 10px 30px #0009;font:12px/1.35 Arial,sans-serif;overflow:hidden}
      #${APP.panelId} *{box-sizing:border-box}
      #${APP.panelId}.tsimm-collapsed{width:auto}
      .tsimm-head{display:flex;align-items:center;gap:7px;padding:8px 9px;background:#292530;border-bottom:1px solid #4e475b}
      .tsimm-head strong{flex:1;font-size:13px}.tsimm-head small{color:#aaa1b7}.tsimm-head button,.tsimm-btn{border:1px solid #625a70;border-radius:7px;background:#393341;color:#fff;padding:6px 8px;font-weight:700;cursor:pointer}
      .tsimm-head{flex:0 0 auto}.tsimm-head button{padding:2px 7px}.tsimm-body{min-height:0;padding:9px;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}.tsimm-collapsed{max-height:none!important}.tsimm-collapsed .tsimm-body,.tsimm-collapsed .tsimm-head small{display:none}
      .tsimm-status{display:grid;grid-template-columns:repeat(auto-fit,minmax(44px,1fr));gap:5px;margin-bottom:7px}.tsimm-stat{padding:5px;border:1px solid #46404f;border-radius:7px;background:#242129;text-align:center}.tsimm-stat strong{display:block;font-size:14px}.tsimm-stat span{color:#b7afc0;font-size:10px}
      .tsimm-actions{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0}.tsimm-btn{flex:1;min-width:78px}.tsimm-btn-primary{background:#5b2b82;border-color:#8e55b9}.tsimm-btn-blue{background:#174f75!important;border-color:#3b8fc2!important;color:#eaf7ff!important}.tsimm-btn:disabled{opacity:.55;cursor:wait}
      .tsimm-controls{display:grid;grid-template-columns:1fr 72px;gap:5px;align-items:center;margin-top:6px}.tsimm-controls input{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}.tsimm-check{display:flex;align-items:center;gap:6px;margin-top:7px;color:#c9c2d0}
      .tsimm-note{margin-top:6px;color:#d0c8d8}.tsimm-muted{color:#aaa1b7}.tsimm-npc-text{color:#58bfff}.tsimm-good-text{color:#63df9f}.tsimm-minor-text{color:#c77dff}.tsimm-loss-text{color:#ff6b76}
      .${APP.badgeClass}{display:flex;flex-direction:column;justify-content:center;gap:1px;border:1px solid currentColor;border-radius:7px;padding:3px 5px;font:700 10px/1.15 Arial,sans-serif;white-space:nowrap;box-shadow:0 2px 8px #0007;background:#19171dcc;pointer-events:none}
      .${APP.badgeClass} span{font-size:8px;font-weight:600;opacity:.9}.tsimm-tier-npc{--tsimm-tier:#58bfff}.tsimm-tier-gold{--tsimm-tier:#f4c95d}.tsimm-tier-good{--tsimm-tier:#44d88b}.tsimm-tier-minor{--tsimm-tier:#bd6cff}.tsimm-tier-loss{--tsimm-tier:#ff626d}
      .${APP.badgeClass}.tsimm-tier-npc{color:#58bfff}.${APP.badgeClass}.tsimm-tier-gold{color:#f4c95d}.${APP.badgeClass}.tsimm-tier-good{color:#44d88b}.${APP.badgeClass}.tsimm-tier-minor{color:#bd6cff}.${APP.badgeClass}.tsimm-tier-loss{color:#ff626d}
      .tsimm-badge-category{position:absolute;right:4px;top:4px;z-index:5;max-width:calc(100% - 8px)}
      .tsimm-badge-listing{display:flex!important;position:relative;z-index:3;min-width:0;max-width:100%;width:max-content;margin:3px 0 0!important;overflow:hidden;vertical-align:initial;white-space:normal}.tsimm-badge-listing strong,.tsimm-badge-listing span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-badge-listing .tsimm-listing-lot{color:inherit;font-size:8px;font-weight:800;opacity:1}.tsimm-badge-listing.tsimm-watch-best-exit{background:#101512f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-profit{color:#78ef8d!important;border-color:#78ef8d!important;background:#073411f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-even{color:#f4c95d!important;border-color:#f4c95d!important;background:#2b2208f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-loss{color:#ff7c85!important;border-color:#ff626d!important;background:#2c0b0ef5!important}.tsimm-badge-listing.tsimm-watch-best-exit .tsimm-watch-inline{color:inherit!important}
      .tsimm-badge-overseas{display:inline-flex;margin-left:6px;vertical-align:middle;position:relative;z-index:3}
      .${APP.quickMaxButtonClass}{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:38px!important;min-height:28px!important;margin:0 5px!important;padding:4px 6px!important;border:1px solid #67d889!important;border-radius:6px!important;background:#0d3520!important;color:#c9ffda!important;font:900 9px/1 Arial,sans-serif!important;letter-spacing:.03em!important;box-shadow:0 2px 8px #0008!important;cursor:pointer!important}.${APP.quickMaxButtonClass}:disabled{opacity:.5!important;cursor:wait!important}.${APP.quickMaxButtonClass}.armed{border-color:#ff9b4a!important;background:#4b1d08!important;color:#ffe0be!important;box-shadow:0 0 0 1px #ff7a2f66,0 2px 10px #000a!important}
      .tsimm-quick-max-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;align-items:center;margin-top:7px;padding:7px;border:1px solid #45614f;border-radius:8px;background:#1d2921}.tsimm-quick-max-card strong{color:#a8f3bd}.tsimm-quick-max-card span{color:#aab8ae;font-size:10px}.tsimm-quick-max-card label{display:flex;align-items:center;gap:5px;font-weight:800;white-space:nowrap}.tsimm-quick-max-card.armed{border-color:#ff873b;background:#35180a}.tsimm-quick-max-card.armed strong,.tsimm-quick-max-card.armed label{color:#ffd1aa}
      .${APP.categoryMark}.tsimm-tier-npc{outline:2px solid #58bfff99;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-gold{outline:2px solid #f4c95d99;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-good{outline:2px solid #44d88b80;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-minor{outline:2px solid #bd6cff80;outline-offset:-2px}.${APP.categoryMark}.tsimm-tier-loss{outline:2px solid #ff626d80;outline-offset:-2px}
      .${APP.listingMark}.tsimm-tier-npc{box-shadow:inset 3px 0 #58bfff}.${APP.listingMark}.tsimm-tier-gold{box-shadow:inset 3px 0 #f4c95d}.${APP.listingMark}.tsimm-tier-good{box-shadow:inset 3px 0 #44d88b}.${APP.listingMark}.tsimm-tier-minor{box-shadow:inset 3px 0 #bd6cff}.${APP.listingMark}.tsimm-tier-loss{box-shadow:inset 3px 0 #ff626d}
      .${APP.overseasMark}.tsimm-tier-gold{box-shadow:inset 3px 0 #f4c95d}.${APP.overseasMark}.tsimm-tier-good{box-shadow:inset 3px 0 #44d88b}.${APP.overseasMark}.tsimm-tier-minor{box-shadow:inset 3px 0 #bd6cff}.${APP.overseasMark}.tsimm-tier-loss{box-shadow:inset 3px 0 #ff626d}
      .tsimm-item-trader-card{margin:8px 0;padding:8px;border:1px solid #5a4b70;border-radius:9px;background:#221d2a}.tsimm-item-trader-head{display:flex;align-items:flex-start;justify-content:space-between;gap:7px;margin-bottom:6px}.tsimm-item-trader-head>div{min-width:0}.tsimm-item-trader-head strong{display:block;color:#e7d7ff;font-size:12px}.tsimm-item-trader-head span{display:block;color:#aaa1b7;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-item-trader-head button{flex:0 0 auto;border:1px solid #76618f;border-radius:6px;background:#342942;color:#eee4f8;padding:4px 6px;font:800 9px/1 Arial,sans-serif}.tsimm-item-trader-list{display:grid;gap:5px}.tsimm-item-trader-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 7px;padding:6px;border:1px solid #46404f;border-radius:7px;background:#19171e}.tsimm-item-trader-row.stale{border-color:#74642f}.tsimm-item-trader-row.outdated{border-color:#714049;opacity:.82}.tsimm-item-trader-name,.tsimm-item-trader-money{min-width:0}.tsimm-item-trader-name strong,.tsimm-item-trader-money strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-item-trader-name span,.tsimm-item-trader-money span{display:block;color:#aaa1b7;font-size:9px}.tsimm-item-trader-money{text-align:right}.tsimm-item-trader-money .profit{color:#63df9f}.tsimm-item-trader-money .loss{color:#ff7c85}.tsimm-item-trader-links{grid-column:1/-1;display:flex;gap:4px}.tsimm-item-trader-links a{flex:1;border:1px solid #554c62;border-radius:5px;background:#2c2733;color:#f2edf7;padding:3px 5px;text-align:center;text-decoration:none;font-size:9px;font-weight:800}.tsimm-item-trader-empty{padding:7px;border:1px dashed #51485d;border-radius:7px;color:#aaa1b7;text-align:center;font-size:10px}
      .tsimm-overseas-card{margin:8px 0;padding:8px;border:1px solid #4d5967;border-radius:9px;background:#20272d}.tsimm-overseas-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-overseas-title strong{flex:1;color:#a7d9ff}.tsimm-overseas-title span{font-size:9px;color:#9eb2c2;text-transform:uppercase}.tsimm-overseas-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.tsimm-overseas-grid span{color:#aebbc4}.tsimm-overseas-grid strong{text-align:right}.tsimm-overseas-profit{color:#63df9f}.tsimm-overseas-plan{margin-top:7px;padding-top:6px;border-top:1px solid #3e4a53;display:grid;gap:3px;max-height:110px;overflow:auto}.tsimm-overseas-plan>div{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:10px}.tsimm-overseas-plan span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d4dc}
      .tsimm-overseas-page-plan{box-sizing:border-box;margin:7px 0;padding:8px;border:1px solid #54c8ed;border-radius:8px;background:#061b25f5;color:#ccefff;box-shadow:0 4px 14px #0009;font:700 10px/1.25 Arial,sans-serif}.tsimm-overseas-page-plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px}.tsimm-overseas-page-plan-head strong{color:#8ee8ff}.tsimm-overseas-page-plan-head b{color:#68e69a}.tsimm-overseas-page-plan>span,.tsimm-overseas-page-plan>small{display:block;color:#9ebdca}.tsimm-overseas-page-plan-list{display:grid;gap:2px;margin-top:6px;padding-top:5px;border-top:1px solid #315365}.tsimm-overseas-page-plan-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.tsimm-overseas-page-plan-list span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-overseas-page-plan-list b{color:#8ee8ff}.tsimm-overseas-page-plan-list strong{color:#68e69a}.tsimm-overseas-planned{box-shadow:inset 3px 0 #54c8ed!important}.tsimm-overseas-planned-badge{border-color:#54c8ed!important}.tsimm-overseas-buy-line{color:#8ee8ff!important;font-weight:900!important;opacity:1!important}
      .${APP.tradeItemMark}{position:relative;min-height:38px}      .${APP.tradeBadgeClass}{display:inline-flex;flex-direction:column;gap:1px;margin:3px 0 3px 6px;padding:3px 5px;border:1px solid #bd6cff;border-radius:7px;background:#19171dcc;color:#d9a6ff;font:700 10px/1.15 Arial,sans-serif;vertical-align:middle;white-space:nowrap;pointer-events:none}
      .${APP.tradeBadgeClass} span{font-size:8px;font-weight:600;color:#c9c2d0}
      .tsimm-trade-card{margin:8px 0;padding:8px;border:1px solid #50485c;border-radius:9px;background:#242129}.tsimm-trade-card.tsimm-trade-good{border-color:#44d88b;color:#eafff2}.tsimm-trade-card.tsimm-trade-loss{border-color:#ff626d;color:#fff0f1}.tsimm-trade-card.tsimm-trade-pending,.tsimm-trade-card.tsimm-trade-incomplete{border-color:#bd6cff;color:#f4e8ff}
      .tsimm-trade-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.tsimm-trade-title strong{font-size:13px}.tsimm-trade-title span{font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      .tsimm-trade-grid{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center}.tsimm-trade-grid span{color:#bfb7c8}.tsimm-trade-grid strong{text-align:right}.tsimm-trade-diff-good{color:#63df9f}.tsimm-trade-diff-loss{color:#ff7c85}.tsimm-trade-diff-pending{color:#d6a0ff}
      .tsimm-trade-items{margin-top:7px;padding-top:6px;border-top:1px solid #47404f;max-height:118px;overflow:auto}.tsimm-trade-item-line{display:grid;grid-template-columns:1fr auto;gap:6px;padding:2px 0;font-size:10px}.tsimm-trade-item-line span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-trade-unmatched{color:#ff9ba2}.tsimm-trade-record{width:100%;margin-top:7px;border:1px solid #4b9d70;border-radius:7px;background:#215b3b;color:#eafff2;padding:7px;font-weight:800}
      .tsimm-trade-exit-audit{margin-top:8px;padding-top:7px;border-top:1px solid #514a59;display:grid;gap:6px}
      .tsimm-trade-exit-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.tsimm-trade-exit-head strong{color:#d9c9e8;font-size:11px}.tsimm-trade-exit-head span{font-size:9px;color:#aaa1b7;text-align:right}
      .tsimm-trade-exit-summary{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:6px;border:1px solid #494250;border-radius:7px;background:#1d1a22}.tsimm-trade-exit-summary span{color:#aaa1b7}.tsimm-trade-exit-summary strong{text-align:right}
      .tsimm-trade-exit-actions{display:flex;gap:5px;flex-wrap:wrap}.tsimm-trade-exit-actions button{flex:1;min-width:104px;border:1px solid #625a70;border-radius:6px;background:#332d3b;color:#f4f1f8;padding:6px;font-size:9px;font-weight:800}.tsimm-trade-exit-actions button.remove{border-color:#925264;background:#3a1821;color:#ffc5cf}.tsimm-trade-exit-actions button:disabled{opacity:.55;cursor:wait}
      .tsimm-trade-exit-list{display:grid;gap:5px;max-height:min(210px,32dvh);overflow:auto;overscroll-behavior:contain;padding-right:2px}.tsimm-trade-exit-empty{padding:7px;border:1px dashed #514a59;border-radius:7px;color:#9fdcb8;text-align:center;font-size:9px}
      .tsimm-trade-exit-row{display:grid;gap:3px;padding:6px;border:1px solid #4c4653;border-radius:7px;background:#1d1a21}.tsimm-trade-exit-row-head,.tsimm-trade-exit-route{display:flex;align-items:center;justify-content:space-between;gap:7px}.tsimm-trade-exit-row-head strong{font-size:9px}.tsimm-trade-exit-row-head span,.tsimm-trade-exit-route span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-trade-exit-route{font-size:10px}.tsimm-trade-exit-row small{color:#aaa1b7;font-size:8px;line-height:1.25}
      .tsimm-trade-exit-gain{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:3px 5px;border-radius:5px;background:#281b35;color:#e5c4ff;font-size:9px}.tsimm-trade-exit-gain strong{color:#f0c8ff}.tsimm-trade-exit-gain.ignored{background:#172820;color:#a9d9bc}.tsimm-trade-exit-gain.ignored strong{color:#b8ebca}
      .tsimm-trade-exit-sell-here{border-color:#3d9162}.tsimm-trade-exit-sell-here .tsimm-trade-exit-row-head strong{color:#70e6a2}
      .tsimm-trade-exit-better-elsewhere{border-color:#7d59a4}.tsimm-trade-exit-better-elsewhere .tsimm-trade-exit-row-head strong{color:#d7a4ff}
      .tsimm-trade-exit-close-enough{border-color:#47785b}.tsimm-trade-exit-close-enough .tsimm-trade-exit-row-head strong{color:#91dbad}
      .tsimm-trade-exit-npc-better{border-color:#3b8fc2}.tsimm-trade-exit-npc-better .tsimm-trade-exit-row-head strong{color:#83d1ff}
      .tsimm-trade-exit-stale-price{border-color:#9a6d1f}.tsimm-trade-exit-stale-price .tsimm-trade-exit-row-head strong{color:#ffd166}
      .tsimm-trade-exit-unknown{border-color:#5d6268}.tsimm-trade-exit-unknown .tsimm-trade-exit-row-head strong{color:#b7bdc2}
      .tsimm-trade-exit-badge-sell-here{border-color:#44d88b!important;color:#8cf0b5!important}.tsimm-trade-exit-badge-better-elsewhere{border-color:#bd6cff!important;color:#e0b2ff!important}.tsimm-trade-exit-badge-close-enough{border-color:#5ea879!important;color:#a7e6bd!important}.tsimm-trade-exit-badge-npc-better{border-color:#58bfff!important;color:#a7ddff!important}.tsimm-trade-exit-badge-stale-price{border-color:#d3a13c!important;color:#ffd982!important}.tsimm-trade-exit-badge-unknown{border-color:#707780!important;color:#c1c6cc!important}
      .tsimm-trade-exit-badge-major{background:#281735!important;box-shadow:0 0 0 1px #bd6cff66,0 3px 10px #0009!important}.tsimm-trade-exit-badge-major strong{color:#f0c8ff!important;font-size:10px!important}
      .tsimm-trade-route-alert{position:relative;z-index:8;display:grid;gap:5px;margin:6px;padding:7px;border:1px solid #9a62c7;border-radius:8px;background:linear-gradient(135deg,#291735,#1d1928);color:#f5eaff;box-shadow:0 3px 12px #0008;font:700 10px/1.25 Arial,sans-serif;pointer-events:none}.tsimm-trade-route-alert-head{display:flex;align-items:center;justify-content:space-between;gap:7px}.tsimm-trade-route-alert-head strong{min-width:0}.tsimm-trade-route-alert-head b{color:#f0c8ff;white-space:nowrap;font-size:11px}.tsimm-trade-route-alert-list{display:grid;gap:2px;color:#d9c9e8;font-size:9px}.tsimm-trade-route-alert-list span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-trade-route-alert-list strong{color:#fff}.tsimm-trade-route-more{color:#ad9bbd!important}
      .tsimm-controls select{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}
      .tsimm-pending-card{margin:7px 0;padding:8px;border:1px solid #c48b35;border-radius:8px;background:#2b2418;display:grid;gap:3px}.tsimm-pending-card>strong{color:#ffd184}.tsimm-pending-card>span{color:#f2e8d5}.tsimm-pending-card>small{color:#c9baa0}.tsimm-pending-card>div{display:flex;gap:6px;margin-top:3px}.tsimm-pending-card button{flex:1;border:1px solid #725f3d;border-radius:6px;background:#3b3020;color:#fff;padding:5px;font-weight:700}
      .tsimm-trader-capture-card{margin:7px 0;padding:8px;border:1px solid #3b8fc2;border-radius:8px;background:#172833;display:grid;gap:3px}.tsimm-trader-capture-card>strong{color:#83d1ff}.tsimm-trader-capture-card>span{color:#d9f1ff}.tsimm-trader-capture-card>small{color:#9fbfce}.tsimm-trader-capture-card>div{display:flex;gap:6px;margin-top:3px}.tsimm-trader-capture-card button{flex:1;border:1px solid #376b89;border-radius:6px;background:#1e4359;color:#fff;padding:5px;font-weight:700}
      #${APP.ledgerOverlayId}{position:fixed;inset:0;z-index:2147483647;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f1f8;pointer-events:auto!important;isolation:isolate;overscroll-behavior:contain}
      .tsimm-ledger-shell{position:relative;z-index:1;width:min(620px,100%);max-height:94vh;max-height:94dvh;display:flex;flex-direction:column;background:#1d1b22;border:1px solid #655d70;border-radius:12px;box-shadow:0 14px 44px #000d;overflow:hidden;pointer-events:auto!important}
      .tsimm-ledger-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;pointer-events:auto!important}
      #${APP.ledgerOverlayId} button,#${APP.ledgerOverlayId} input,#${APP.ledgerOverlayId} select,#${APP.ledgerOverlayId} textarea{pointer-events:auto!important;touch-action:manipulation}
      .tsimm-ledger-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#282330;border-bottom:1px solid #4f4759}.tsimm-ledger-head>div{display:grid;gap:1px;flex:1}.tsimm-ledger-head strong{font-size:14px}.tsimm-ledger-head small{color:#aaa1b7}.tsimm-ledger-head>button{border:1px solid #655d70;border-radius:7px;background:#393341;color:#fff;width:30px;height:30px;font-size:19px}
      .tsimm-ledger-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:5px;padding:8px}.tsimm-ledger-summary>div{display:grid;text-align:center;padding:7px 3px;border:1px solid #494250;border-radius:8px;background:#24212a}.tsimm-ledger-summary strong{font-size:12px}.tsimm-ledger-summary span{font-size:9px;color:#aaa1b7;text-transform:uppercase}
      .tsimm-ledger-actions{display:flex;flex-wrap:wrap;gap:5px;padding:0 8px 8px}.tsimm-ledger-actions button{flex:1;min-width:105px;border:1px solid #625a70;border-radius:7px;background:#393341;color:#fff;padding:7px;font-weight:700}.tsimm-ledger-actions button:first-child{background:#5b2b82;border-color:#8e55b9}
      .tsimm-ledger-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:8px}.tsimm-ledger-tabs button{border:1px solid #514a59;border-radius:7px;background:#28242f;color:#bdb5c6;padding:7px 4px;font-size:10px;font-weight:700}.tsimm-ledger-tabs button.active{background:#5b2b82;border-color:#9a61c2;color:#fff}.tsimm-ledger-filters{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:6px;padding:0 8px 8px}.tsimm-ledger-filters input,.tsimm-ledger-filters select{min-width:0;border:1px solid #5a5266;border-radius:7px;background:#17151b;color:#fff;padding:7px}.tsimm-ledger-freshness{margin:0 8px 8px;color:#aaa1b7;font-size:10px}.tsimm-ledger-toggle{display:flex;align-items:center;gap:6px;margin:0 8px 8px;color:#c9c2d0}.tsimm-ledger-future{margin:0 8px 8px;padding:6px 8px;border:1px solid #51425e;border-radius:7px;background:#241d2a;color:#cdbbdd}.tsimm-ledger-section-title{padding:3px 10px 6px;color:#cdbbdd;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.05em}.tsimm-ledger-sales{padding:0 8px 8px;display:grid;gap:7px;overflow:auto}.tsimm-ledger-sale{border:1px solid #4b6657;border-radius:9px;background:#202a25;padding:8px}.tsimm-ledger-sale-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-ledger-sale-head strong{flex:1;font-size:12px}.tsimm-ledger-sale-head span{font-size:9px;text-transform:uppercase;color:#9ee2bb;border:1px solid #37634b;border-radius:999px;padding:2px 5px}.tsimm-ledger-sale-foot{display:flex;align-items:center;gap:8px;margin-top:6px;padding-top:5px;border-top:1px solid #385044;color:#94aa9d;font-size:10px}.tsimm-ledger-sale-foot span{flex:1}.tsimm-ledger-sale-foot button{border:1px solid #4e6759;border-radius:6px;background:#2d4136;color:#e6fff0;padding:4px 7px;font-weight:700}
      .tsimm-ledger-list{overflow:auto;padding:0 8px 10px;display:grid;gap:7px}.tsimm-ledger-empty{padding:18px 10px;text-align:center;color:#aaa1b7;border:1px dashed #514a59;border-radius:8px}
      .tsimm-ledger-lot{border:1px solid #4d4656;border-radius:9px;background:#24212a;padding:8px}.tsimm-ledger-lot-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-ledger-lot-head strong{flex:1;font-size:13px}.tsimm-ledger-lot-head span{font-size:9px;text-transform:uppercase;color:#c9a2e4;border:1px solid #66497a;border-radius:999px;padding:2px 5px}
      .tsimm-ledger-lot-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.tsimm-ledger-lot-grid span{color:#aaa1b7}.tsimm-ledger-lot-grid strong{text-align:right}.tsimm-ledger-gold{color:#f4c95d}.tsimm-ledger-profit{color:#63df9f}.tsimm-ledger-minor{color:#c77dff}.tsimm-ledger-loss{color:#ff7c85}
      .tsimm-ledger-lot-foot{display:flex;gap:8px;align-items:center;margin-top:7px;padding-top:6px;border-top:1px solid #423c49}.tsimm-ledger-lot-foot small{flex:1;color:#8f8798}.tsimm-ledger-lot-foot button{border:1px solid #5a5266;border-radius:6px;background:#332e3a;color:#fff;padding:4px 7px;margin-left:4px}.tsimm-ledger-notes{margin-top:5px;color:#c1b8ca;font-size:10px}
      .tsimm-gold-text{color:#f4c95d}
             .tsimm-trader-disposition{display:flex;align-items:center;gap:7px;margin-top:7px;padding:5px 7px;border:1px solid #4d6548;border-radius:6px;background:#172017}.tsimm-trader-disposition strong{color:#aaf59d;font-size:9px;white-space:nowrap}.tsimm-trader-disposition span{overflow:hidden;color:#a8bba5;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.tsimm-trader-card.tsimm-trader-avoid{border-color:#9a6d1f;background:#2c230f}.tsimm-trader-card.tsimm-trader-avoid .tsimm-trader-disposition{border-color:#9a6d1f;background:#211705}.tsimm-trader-card.tsimm-trader-avoid .tsimm-trader-disposition strong,.tsimm-trader-card.tsimm-trader-avoid .tsimm-trader-disposition span{color:#ffd166}.tsimm-trader-card.tsimm-trader-hidden{border-color:#555b61;background:#202326;opacity:.86}.tsimm-trader-card.tsimm-trader-hidden .tsimm-trader-disposition{border-color:#555b61;background:#151719}.tsimm-trader-card.tsimm-trader-hidden .tsimm-trader-disposition strong,.tsimm-trader-card.tsimm-trader-hidden .tsimm-trader-disposition span{color:#b4bdc2}.tsimm-trader-avoid-action{border-color:#9a6d1f!important;background:#392708!important;color:#ffe29a!important}.tsimm-trader-hide-action{border-color:#5d646a!important;background:#25292d!important;color:#d3d9dd!important}
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
    const planned = new Map((stats.overseasPlanItems || []).map((item) => [overseasPlanItemKey(item), item]));
    const lines = (stats.overseasRankedItems || []).map((item) => {
      const pick = planned.get(overseasPlanItemKey(item));
      const role = item.rank === 1 ? 'BEST' : 'RUNNER-UP';
      return `<div><span>#${item.rank} ${role} · ${escapeHtml(item.name)} · ${pick ? `buy ${formatInteger(pick.quantity)}` : `backup up to ${formatInteger(item.runQuantity)}`}</span><strong>+${escapeHtml(formatMoney(item.profitEach))} ea</strong></div>`;
    }).join('');
    return `<div class="tsimm-overseas-card"><div class="tsimm-overseas-title"><strong>✈️ Best run + runner-up</strong><span>${escapeHtml(stats.overseasCountry || 'foreign shop')}</span></div><div class="tsimm-overseas-grid"><span>Configured load</span><strong>${escapeHtml(currentText)}</strong><span>Planned fill</span><strong>${formatInteger(stats.overseasPlanQuantity)} items</strong><span>Purchase cost</span><strong>${formatMoney(stats.overseasPlanCost)}</strong><span>Ⓣ Return at home</span><strong>${formatMoney(stats.overseasPlanTraderReturn)}</strong><span>Expected trip profit</span><strong class="tsimm-overseas-profit">+${formatMoney(stats.overseasPlanProfit)}</strong></div>${lines ? `<div class="tsimm-overseas-plan">${lines}</div>` : ''}</div>`;
  }

  function tradeExitAuditHtml(stats) {
    const audit = stats?.tradeExitAudit;
    if (!state.settings.showTradeExitAudit || !audit || stats.pageType !== 'trade') return '';
    const showAll = state.settings.tradeExitShowAllItems === true;
    const problemItems = audit.items.filter((item) => !['sell-here', 'close-enough'].includes(item.status));
    const visibleItems = showAll ? audit.items : problemItems;
    const hiddenSafeCount = showAll ? 0 : audit.sellHereCount + Number(audit.closeEnoughCount || 0);
    const bestTotalText = audit.fullCoverage
      ? formatMoney(audit.bestKnownTotal)
      : `${formatInteger(audit.actionableTypes)}/${formatInteger(audit.totalTypes)} types covered`;
    const potentialText = audit.potentialLeftBehind === null
      ? 'Incomplete'
      : audit.potentialLeftBehind > 0
        ? `+${formatMoney(audit.potentialLeftBehind)} available`
        : 'No known loss';
    const potentialClass = audit.potentialLeftBehind > 0
      ? 'tsimm-trade-diff-loss'
      : audit.potentialLeftBehind === null
        ? 'tsimm-trade-diff-pending'
        : 'tsimm-trade-diff-good';
    const offerVsBestText = audit.offerVsBest === null
      ? 'Incomplete'
      : `${audit.offerVsBest >= 0 ? '+' : ''}${formatMoney(audit.offerVsBest)}`;
    const offerVsBestClass = audit.offerVsBest === null
      ? 'tsimm-trade-diff-pending'
      : audit.offerVsBest >= 0
        ? 'tsimm-trade-diff-good'
        : 'tsimm-trade-diff-loss';
    const rows = visibleItems.map((item) => {
      const hereText = item.currentQuote
        ? `${formatMoney(item.currentQuote.unitPrice)}${item.currentQuote.freshness.status === 'fresh' ? '' : ' stale'}`
        : '?';
      const favoriteText = item.bestFreshFavorite
        ? `${item.bestFreshFavorite.traderName} ${formatMoney(item.bestFreshFavorite.unitPrice)}`
        : item.bestStaleFavorite
          ? `${item.bestStaleFavorite.traderName} ${formatMoney(item.bestStaleFavorite.unitPrice)} stale`
          : 'none';
      const npcText = item.npcEach > 0 ? formatMoney(item.npcEach) : 'none';
      const routeValue = item.recommendedEach > 0 ? `${formatMoney(item.recommendedEach)} ea` : 'No price';
      const routeAge = item.recommendedFreshness?.ageLabel ? ` · ${item.recommendedFreshness.ageLabel}` : '';
      const deltaText = item.deltaTotal === null
        ? ''
        : item.deltaTotal > 0
          ? ` · +${formatMoney(item.deltaTotal)} vs here`
          : item.deltaTotal < 0
            ? ` · ${formatMoney(item.deltaTotal)} vs here`
            : ' · tied with here';
      const switchGainHtml = item.status === 'better-elsewhere' && Number(item.deltaTotal) > 0
        ? `<div class="tsimm-trade-exit-gain"><span>Bulk switch gain</span><strong>+${escapeHtml(formatMoney(item.deltaTotal))} total</strong></div>`
        : item.status === 'close-enough' && Number(item.ignoredGainTotal) > 0
          ? `<div class="tsimm-trade-exit-gain ignored"><span>Ignored switch gain</span><strong>+${escapeHtml(formatMoney(item.ignoredGainTotal))} total</strong></div>`
          : '';
      return `<div class="tsimm-trade-exit-row tsimm-trade-exit-${escapeHtml(item.status)}">`
        + `<div class="tsimm-trade-exit-row-head"><strong>${escapeHtml(item.verdict)}</strong><span>${escapeHtml(item.itemName)} × ${formatInteger(item.quantity)}</span></div>`
        + `<div class="tsimm-trade-exit-route"><span>${escapeHtml(item.recommendedSource || 'No actionable route')}${escapeHtml(routeAge)}</span><strong>${escapeHtml(routeValue)}</strong></div>`
        + switchGainHtml
        + `<small>Here ${escapeHtml(hereText)} · Favorite ${escapeHtml(favoriteText)} · NPC ${escapeHtml(npcText)} · 99% ${escapeHtml(formatMoney(item.targetEach))}${escapeHtml(deltaText)}</small>`
        + `</div>`;
    }).join('');
    const safeCount = audit.sellHereCount + Number(audit.closeEnoughCount || 0);
    const emptyText = audit.totalTypes
      ? `${formatInteger(safeCount)} item type${safeCount === 1 ? '' : 's'} cleared or below your switch threshold. Use Show all to inspect them.`
      : 'Add items to your side of the trade to begin the audit.';
    const viewButton = safeCount
      ? `<button type="button" data-tsimm-action="trade-exit-toggle-all">${showAll ? `Problems only (${formatInteger(problemItems.length)})` : `Show all (${formatInteger(audit.totalTypes)})`}</button>`
      : '';
    const removeButton = audit.betterElsewhereCount
      ? `<button class="remove" type="button" data-tsimm-action="trade-exit-remove-better" ${state.tradeExitRemoveBusy ? 'disabled' : ''}>${state.tradeExitRemoveBusy ? 'Removing…' : `Remove ${formatInteger(audit.betterElsewhereCount)} better elsewhere`}</button>`
      : '';
    return `
      <div class="tsimm-trade-exit-audit">
        <div class="tsimm-trade-exit-head"><strong>🧭 Trade Exit Audit</strong><span>${escapeHtml(audit.overallLabel)}${hiddenSafeCount ? ` · ${formatInteger(hiddenSafeCount)} safe hidden` : ''}</span></div>
        <div class="tsimm-trade-exit-summary">
          <span>Current trader price coverage</span><strong>${formatInteger(audit.currentFreshCoverage)}/${formatInteger(audit.totalTypes)} fresh</strong>
          <span>Best known concrete exit</span><strong>${escapeHtml(bestTotalText)}</strong>
          <span>Live cash vs best route</span><strong class="${offerVsBestClass}">${escapeHtml(offerVsBestText)}</strong>
          <span>Potential left behind</span><strong class="${potentialClass}">${escapeHtml(potentialText)}</strong>
        </div>
        ${(viewButton || removeButton) ? `<div class="tsimm-trade-exit-actions">${viewButton}${removeButton}</div>` : ''}
        ${rows ? `<div class="tsimm-trade-exit-list">${rows}</div>` : `<div class="tsimm-trade-exit-empty">${escapeHtml(emptyText)}</div>`}
        <div class="tsimm-muted">Problems-only view hides SELL HERE and CLOSE ENOUGH rows. Minimum switch gain: ${escapeHtml(formatMoney(state.settings.tradeExitMinimumSwitchGain || 0))}. Fresh prices remain actionable for 72h.</div>
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
        ${tradeExitAuditHtml(stats)}
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
    const previousBodyScroll = panel.querySelector('.tsimm-body')?.scrollTop || 0;
    panel.classList.toggle('tsimm-collapsed', Boolean(state.settings.collapsed));
    const stats = state.lastScan;
    const isTrade = stats.pageType === 'trade';
    const isProfile = stats.pageType === 'profile';
    const isInventory = stats.pageType === 'inventory';
    const isOverseas = stats.pageType === 'overseas shop';
    const isPriceCapture = stats.pageType === 'price capture';
    const isMarketPage = isOverseas || stats.pageType === 'category' || stats.pageType.startsWith('item listings');
    const isItemListings = stats.pageType.startsWith('item listings');
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
        : isInventory
          ? `<div class="tsimm-status">
              <div class="tsimm-stat"><strong>${formatInteger(state.inventory?.items?.length || 0)}</strong><span>API types</span></div>
              <div class="tsimm-stat"><strong>${formatInteger(ledger.itemTypes || 0)}</strong><span>ledger types</span></div>
              <div class="tsimm-stat"><strong class="${state.keyProfile?.endpoints?.inventory?.ok ? 'tsimm-good-text' : 'tsimm-loss-text'}">${state.keyProfile?.endpoints?.inventory?.ok ? '✓' : '?'}</strong><span>inventory key</span></div>
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
    const quickMaxControls = isItemListings
      ? `<div class="tsimm-quick-max-card ${state.quickMaxOverrideArmed ? 'armed' : ''}">
          <div><strong>${state.quickMaxOverrideArmed ? '⚡ OVERRIDE MAX ARMED' : 'Quick MAX safe mode'}</strong><span>${state.quickMaxOverrideArmed ? 'MAX buttons will submit Torn\'s native purchase flow.' : 'MAX fills the largest visible quantity and stops before submission.'}</span></div>
          <label><input type="checkbox" data-tsimm-quick-max-override ${state.quickMaxOverrideArmed ? 'checked' : ''}> 1-tap</label>
        </div>`
      : '';
    const tradeControls = isTrade
      ? `<div class="tsimm-controls"><label>Your trade side</label><select data-tsimm-setting="tradeSidePreference">
          <option value="auto" ${state.settings.tradeSidePreference === 'auto' ? 'selected' : ''}>Auto detect</option>
          <option value="left" ${state.settings.tradeSidePreference === 'left' ? 'selected' : ''}>Left</option>
          <option value="right" ${state.settings.tradeSidePreference === 'right' ? 'selected' : ''}>Right</option>
        </select></div>
        <label class="tsimm-check"><input type="checkbox" data-tsimm-setting="showTradeItemBreakdown" ${state.settings.showTradeItemBreakdown ? 'checked' : ''}> Show per-item 99% totals</label>
        <label class="tsimm-check"><input type="checkbox" data-tsimm-setting="showTradeExitAudit" ${state.settings.showTradeExitAudit !== false ? 'checked' : ''}> Show Trade Exit Audit</label>
        <div class="tsimm-controls"><label>Ignore switch gains under</label><input type="number" min="0" step="100" value="${escapeHtml(state.settings.tradeExitMinimumSwitchGain || 0)}" data-tsimm-setting="tradeExitMinimumSwitchGain"></div>
        <div class="tsimm-muted">Side detection: ${escapeHtml(stats.tradeSideSource || 'not resolved')}</div>`
      : '';
    panel.innerHTML = `
      <div class="tsimm-head">
        <strong>🧌 ${escapeHtml(APP.brandName)}</strong>
        <small>${escapeHtml(APP.brandSubtitle)} v${escapeHtml(APP.version)} · ${escapeHtml(stats.pageType)}</small>
        <button type="button" data-tsimm-action="toggle">${state.settings.collapsed ? '+' : '−'}</button>
      </div>
      <div class="tsimm-body">
        ${statusHtml}
        <div class="tsimm-muted">Catalog: ${formatInteger(catalogCount())} values${catalogIsFresh() ? ' · fresh' : ''}</div>
        <div class="tsimm-muted">Ledger: ${formatInteger(ledger.lots)} open lots · ${formatMoney(ledger.invested)} invested · ${ledger.expectedProfit >= 0 ? '+' : ''}${formatMoney(ledger.expectedProfit)} expected · ${ledger.realizedProfit >= 0 ? '+' : ''}${formatMoney(ledger.realizedProfit)} realized</div>
        <div class="tsimm-note">Profit base: Ⓣ = floor(Ⓜ × 99%) per item · blue = NPC store payout above listing price</div>
        ${isInventory ? apiKeyProfileHtml(true) : ''}
        ${pendingPurchaseHtml()}
        ${pendingTraderCaptureHtml()}
        ${singleItemTraderQuotesHtml(stats)}
        ${overseasSummaryHtml(stats)}
        ${tradeSummaryHtml(stats)}
        ${isProfile && stats.profileName ? `<div class="tsimm-profile-capture-card">${stats.profileBannerUrl ? `<img src="${escapeHtml(stats.profileBannerUrl)}" alt="${escapeHtml(stats.profileName)}">` : ''}<div><strong>${escapeHtml(stats.profileName)}</strong><span>Torn ID ${escapeHtml(stats.profileUserId || 'unresolved')}</span></div></div>` : ''}
        <div class="tsimm-actions">
          <button class="tsimm-btn tsimm-btn-primary" type="button" data-tsimm-action="sync" ${state.syncing ? 'disabled' : ''}>${state.syncing ? 'Syncing…' : 'Sync values'}</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="scan">Scan page</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="diagnostics">Copy diagnostics</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="ledger-open">Ledger (${formatInteger(ledger.lots)})</button>
          <button class="tsimm-btn tsimm-btn-blue" type="button" data-tsimm-action="inventory-open-reconcile">${isInventory ? 'Reconcile inventory' : 'Open Inventory & Reconcile'}</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="traders-open">Traders (${formatInteger(state.traders.length)})</button>
          ${isProfile && stats.profileCaptureReady ? '<button class="tsimm-btn tsimm-btn-gold" type="button" data-tsimm-action="trader-capture-profile">Capture profile</button><button class="tsimm-btn tsimm-btn-blue" type="button" data-tsimm-action="trader-arm-current-profile">Arm price capture</button>' : ''}
          ${activePendingTraderCapture() ? '<button class="tsimm-btn tsimm-btn-blue" type="button" data-tsimm-action="trader-capture-current-page">Capture current page</button>' : ''}
          ${isTrade && stats.tradeCounterparty ? '<button class="tsimm-btn" type="button" data-tsimm-action="trader-save-current">Save trader</button>' : ''}
        </div>
        ${tradeControls}
        ${quickMaxControls}
        ${marketControls}
        ${notes}
      </div>
    `;
    const nextBody = panel.querySelector('.tsimm-body');
    if (nextBody && previousBodyScroll > 0) nextBody.scrollTop = previousBodyScroll;
  }

  function bindPanelEvents() {
    document.addEventListener('click', handleQuickMaxClick, true);
    document.addEventListener('click', capturePurchaseIntentFromClick, true);
    document.addEventListener('click', capturePricedTradePickerInteraction, true);
    document.addEventListener('change', capturePricedTradePickerInteraction, true);
    document.addEventListener('scroll', capturePricedTradeScroll, { capture: true, passive: true });
    document.addEventListener('touchmove', capturePricedTradeScroll, { capture: true, passive: true });
    document.addEventListener('wheel', capturePricedTradeScroll, { capture: true, passive: true });
    document.addEventListener('click', (event) => {
      const button = event.target.closest(`[data-tsimm-action]`);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.tsimmAction;
      if (action === 'toggle') {
        updateSetting('collapsed', !state.settings.collapsed);
      } else if (action === 'item-trader-quotes-toggle') {
        updateSetting('itemTraderQuoteLimit', Number(state.settings.itemTraderQuoteLimit) === 5 ? 3 : 5);
      } else if (action === 'sync') {
        syncCatalog();
      } else if (action === 'scan') {
        scanPage();
      } else if (action === 'diagnostics') {
        copyDiagnostics();
      } else if (action === 'trade-exit-toggle-all') {
        updateSetting('tradeExitShowAllItems', state.settings.tradeExitShowAllItems !== true);
      } else if (action === 'trade-exit-remove-better') {
        removeTradeExitItems('better-elsewhere').catch((error) => {
          state.tradeExitRemoveBusy = false;
          renderPanel();
          toast(error?.message || 'Bulk trade removal failed.');
        });
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
      } else if (action === 'trader-start-priced-trade') {
        startPricedTrade(state.traders.find((entry) => entry.id === button.dataset.tsimmTraderId));
      } else if (action === 'priced-trade-toggle') {
        const panel = button.closest(`#${PRICED_TRADE_PANEL_ID}`);
        const expanded = !panel?.classList.contains('expanded');
        setPricedTradePanelExpanded(expanded);
        panel?.classList.toggle('expanded', expanded);
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      } else if (action === 'priced-trade-badge-toggle') {
        const token = normalizeWhitespace(button.dataset.tsimmItemToken);
        if (token) {
          const expanded = !button.classList.contains('expanded');
          if (expanded) pricedTradeExpandedBadgeTokens.add(token);
          else pricedTradeExpandedBadgeTokens.delete(token);
          button.classList.toggle('expanded', expanded);
          button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
      } else if (action === 'priced-trade-clear') {
        clearPricedTradeSession('Priced Trade cleared.');
        scheduleScan(20);
      } else if (action === 'priced-trade-max') {
        const row = button.closest(`.${PRICED_TRADE_ROW_CLASS}`);
        fillPricedTradeMax(
          row,
          Number(button.dataset.tsimmAvailableQuantity) || 0,
          button.dataset.tsimmItemToken || '',
        );
      } else if (action === 'trader-toggle-favorite') {
        const result = window.__TSIMM_WATCHLIST_API__?.toggleFavoriteById?.(button.dataset.tsimmTraderId);
        if (!result?.available) toast('Favorite trader controls are not ready. Refresh Torn and try again.');
        else {
          toast(`${result.favorite ? 'Added' : 'Removed'} ${result.traderName} ${result.favorite ? 'to' : 'from'} favorites.`);
          renderTraders();
        }
      } else if (action === 'traders-refresh-favorites') {
        if (!window.__TSIMM_WATCHLIST_API__?.startFavoriteCaptureCarousel?.()) {
          window.__TSIMM_WATCHLIST_API__ || toast('Favorite trader controls are not ready. Refresh Torn and try again.');
        }
      } else if (action === 'traders-continue-favorites') {
        window.__TSIMM_WATCHLIST_API__?.launchFavoriteCaptureCarousel?.();
      } else if (action === 'traders-cancel-favorites') {
        window.__TSIMM_WATCHLIST_API__?.cancelFavoriteCaptureCarousel?.();
      } else if (action === 'trader-add') {
        const trader = promptTrader();
        if (trader) { upsertTrader(trader); toast(`Saved trader ${trader.name}.`); }
      } else if (action === 'trader-edit') {
        editTrader(button.dataset.tsimmTraderId);
      } else if (action === 'trader-avoid') {
        markTraderAvoid(button.dataset.tsimmTraderId);
      } else if (action === 'trader-hide') {
        hideTrader(button.dataset.tsimmTraderId);
      } else if (action === 'trader-restore') {
        restoreTrader(button.dataset.tsimmTraderId);
      } else if (action === 'traders-toggle-hidden') {
        toggleHiddenTraders();
      } else if (action === 'trader-delete') {
        deleteTrader(button.dataset.tsimmTraderId);
      } else if (action === 'traders-copy') {
        copyTradersJson();
      } else if (action === 'traders-import') {
        importTradersJson();
      } else if (action === 'inventory-sync') {
        syncInventorySnapshot();
      } else if (action === 'inventory-open-reconcile') {
        openInventoryAndReconcile();
      } else if (action === 'inventory-baseline-set') {
        setCurrentInventoryBaseline();
      } else if (action === 'inventory-baseline-clear') {
        clearInventoryBaseline();
      } else if (action === 'sell-priority-set') {
        setSellPriority({
          key: button.dataset.tsimmItemKey,
          itemId: Number(button.dataset.tsimmItemId) || null,
          itemName: button.dataset.tsimmItemName,
        }, button.dataset.tsimmSellPriority);
      } else if (action === 'sell-priority-hide-suggested') {
        hideSuggestedSellPriority();
      } else if (action === 'sell-priority-reset') {
        resetSellPriorities();
      } else if (action === 'api-key-builder') {
        openGoblinGodKeyBuilder();
      } else if (action === 'api-key-set') {
        configureGoblinGodKey();
      } else if (action === 'api-key-check') {
        inspectGoblinGodKey();
      } else if (action === 'ledger-tab') {
        const view = button.dataset.tsimmLedgerView;
        if (['holdings', 'reconcile', 'history', 'sales', 'integrity'].includes(view)) {
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
      } else if (action === 'ledger-recover-sale') {
        const recovered = promptMissedLedgerSale();
        if (recovered) {
          try {
            const sale = recordTradeSale(recovered, 'manual-missed-sale-recovery');
            toast(`Recovered sale. Profit ${sale.realizedProfit >= 0 ? '+' : ''}${formatMoney(sale.realizedProfit)}.`);
          } catch (error) {
            alert(error?.message || 'IMM could not recover this sale.');
          }
        }
      } else if (action === 'ledger-funding-edit') {
        editLedgerLotFundingSource(button.dataset.tsimmLotId);
      } else if (action === 'ledger-edit') {
        editLedgerLot(button.dataset.tsimmLotId);
      } else if (action === 'ledger-default-funding') {
        chooseLedgerDefaultFundingSource();
      } else if (action === 'ledger-assign-unassigned') {
        assignUnassignedOpenLedgerLots();
      } else if (action === 'ledger-delete') {
        deleteLedgerLot(button.dataset.tsimmLotId);
      } else if (action === 'ledger-clean-duplicates') {
        cleanExactLedgerDuplicates();
      } else if (action === 'ledger-undo-cleanup') {
        undoExactLedgerDuplicateCleanup();
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
    }, true);
    document.addEventListener('change', (event) => {
      if (pageLooksLikeTrade()
        && !event.target.closest(immUiSelector())
        && pricedTradeIsQuantityControl(event.target)) {
        pricedTradeScrollActiveUntil = Date.now() + 1000;
        return;
      }
      const quickMaxOverride = event.target.closest('[data-tsimm-quick-max-override]');
      if (quickMaxOverride) {
        if (quickMaxOverride.checked) {
          const accepted = confirm('Arm Override MAX for this page session?\n\nPressing an orange ⚡ MAX button will fill the maximum quantity and submit Torn\'s native purchase flow immediately.\n\nThe mode fails closed and disarms when Torn\'s dialog cannot be verified.');
          state.quickMaxOverrideArmed = Boolean(accepted);
        } else {
          state.quickMaxOverrideArmed = false;
        }
        renderPanel();
        scheduleScan(20);
        toast(state.quickMaxOverrideArmed ? 'Override MAX armed for this page session.' : 'Override MAX is off.');
        return;
      }
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
      const fundingFilter = event.target.closest('[data-tsimm-ledger-funding-filter]');
      if (fundingFilter) {
        state.ledgerUi.fundingFilter = fundingFilter.value === 'all'
          ? 'all'
          : normalizeLedgerFundingSource(fundingFilter.value);
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
      if (pageLooksLikeTrade()
        && !event.target.closest(immUiSelector())
        && pricedTradeIsQuantityControl(event.target)) {
        pricedTradeScrollActiveUntil = Date.now() + 1000;
        return;
      }
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
    if (tradeRoute
      && loadPricedTradeSession()
      && (pricedTradeScrollIsActive() || pricedTradeIsQuantityControl(document.activeElement))) return false;
    const inventoryRoute = href.includes('/item.php') || href.includes('sid=items') || href.includes('inventory');
    const added = [...(mutation.addedNodes || [])];

    if (mutation.type === 'characterData') {
      const text = normalizeWhitespace(mutation.target.textContent);
      if (!text) return false;
      if (marketRoute || overseasRoute) return /\$|\bvalue\b|\bqty\b|\bbuy\b|\bowner\b|\bstock\b|\bavailable\b|\bcapacity\b|\([\d,]+\)/i.test(text);
      if (inventoryRoute) return /\bitems?\b|\binventory\b|\bquantity\b|\bcategory\b|\bactive\b/i.test(text);
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
      if (inventoryRoute) {
        return /\bitems?\b|\binventory\b|\bquantity\b|\bcategory\b/i.test(text)
          || Boolean(element?.matches('li,[class*="item"],[class*="inventory"],[data-item]'))
          || Boolean(element?.querySelector?.('img,[data-item]'));
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
      buildTradeExitAudit,
      tradeExitAuditHtml,
      _state: state,
    };
  }

  /*
   * ITEM-CENTRIC WATCHLIST MODULE
   * Migrated from IMM Trader Extensions v0.2.1.
   * Storage keys intentionally remain unchanged so existing favorites and
   * watched items continue without conversion or data loss.
   */
  if (!isWeav3rPriceListUrl(location.href) && !isTornExchangePriceListUrl(location.href)) {
(() => {
  'use strict';

  const A = Object.freeze({
    v: '0.3.0',
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
    carousel: 'tsimm-favorite-capture-carousel',
    bulkDialog: 'tsimm-trader-refresh-dialog',
    turnoverPanel: 'tsimm-turnover-preset-panel',
    turnoverHistory: 'tornscripture-imm-turnover-history-v1',
    carouselSession: APP.favoriteRecaptureCarouselSessionKey,
    carouselResult: APP.traderRecaptureResultStorageKey,
  });

  const HIGH_TURNOVER_PRESETS = Object.freeze([
    Object.freeze({
      id: 'war-recovery',
      icon: '✚',
      tier: 'A',
      label: 'WAR RECOVERY',
      description: 'Repeat-use medical supplies for wars, chains, and hospital exits.',
      items: Object.freeze([
        'Blood Bag : A+', 'Blood Bag : A-', 'Blood Bag : B+', 'Blood Bag : B-',
        'Blood Bag : AB+', 'Blood Bag : AB-', 'Blood Bag : O+', 'Blood Bag : O-',
        'Morphine', 'First Aid Kit', 'Small First Aid Kit', 'Empty Blood Bag',
        'Box of Medical Supplies',
      ]),
    }),
    Object.freeze({
      id: 'combat-temps',
      icon: '☄',
      tier: 'A',
      label: 'COMBAT TEMPS',
      description: 'Disposable combat and mission items with recurring war demand.',
      items: Object.freeze([
        'Smoke Grenade', 'Flash Grenade', 'Pepper Spray', 'Tear Gas',
        'Concussion Grenade', 'Grenade', 'HEG', 'Molotov Cocktail',
      ]),
    }),
    Object.freeze({
      id: 'museum-sets',
      icon: '♜',
      tier: 'B',
      label: 'MUSEUM SETS',
      description: 'Plushies and flowers continually absorbed by Museum set exchanges.',
      items: Object.freeze([
        'Camel Plushie', 'Chamois Plushie', 'Jaguar Plushie', 'Kitten Plushie',
        'Lion Plushie', 'Monkey Plushie', 'Nessie Plushie', 'Panda Plushie',
        'Red Fox Plushie', 'Sheep Plushie', 'Stingray Plushie', 'Teddy Bear Plushie',
        'Wolverine Plushie', 'African Violet', 'Banana Orchid', 'Ceibo Flower',
        'Cherry Blossom', 'Crocus', 'Dahlia', 'Edelweiss', 'Heather', 'Orchid',
        'Peony', 'Tribulus Omanense',
      ]),
    }),
    Object.freeze({
      id: 'energy-gym',
      icon: '⚡',
      tier: 'S',
      label: 'ENERGY & GYM',
      description: 'Very liquid energy and happy consumables; expect fierce competition.',
      items: Object.freeze([
        'Xanax', 'LSD', 'Ecstasy', 'Feathery Hotel Coupon', 'Erotic DVD',
        'Can of Goose Juice', 'Can of Damp Valley', 'Can of Crocozade',
        'Can of Munster', 'Can of Santa Shooters', 'Can of Red Cow',
        'Can of Rockstar Rudolph', 'Can of Taurine Elite', 'Can of X-MASS',
        'Six-Pack of Energy Drink',
      ]),
    }),
  ]);


  const TURNOVER_CAPTURE_RULES = Object.freeze({
    schemaVersion: 1,
    settleMs: 1200,
    changedMinimumGapMs: 15 * 1000,
    heartbeatMs: 5 * 60 * 1000,
    maximumPairGapMs: 30 * 60 * 1000,
    retentionMs: 14 * 24 * 60 * 60 * 1000,
    maxSnapshotsPerItem: 72,
    maxItems: 80,
    maxVisibleListings: 30,
  });
  const turnoverCaptureState = {
    itemToken: '',
    signature: '',
    stableSince: 0,
  };

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
  const loadSessionJson = (storageKey, fallback) => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return fallback === undefined ? undefined : clone(fallback);
      return JSON.parse(raw);
    } catch {
      return fallback === undefined ? undefined : clone(fallback);
    }
  };
  const saveSessionJson = (storageKey, value) => {
    try {
      if (value === null || value === undefined) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify(value));
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
  const singleItemMarketPage = () => {
    if (!marketPage()) return false;
    if (idFrom(location.href)) return true;
    return Boolean(document.querySelector('.tsimm-listing-mark'));
  };

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
      #${A.carousel}{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 8px;align-items:center;box-sizing:border-box;margin:6px 8px;padding:7px 8px;border:1px solid #3879a4;border-radius:7px;background:#06141df2;color:#b8e6ff;font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.carousel}.active{border-color:#58d76d;background:#071b0cf2;color:#caffb5}#${A.carousel} .carousel-copy{display:grid;min-width:0;gap:2px}#${A.carousel} strong,#${A.carousel} span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${A.carousel} span{color:#78a9c7;font-size:7px}#${A.carousel}.active span{color:#75bd7e}#${A.carousel} .carousel-actions{display:flex;gap:4px}#${A.carousel} button{min-height:31px;border:1px solid #438bb9;border-radius:5px;background:#0b2b3d;color:#d4f2ff;padding:5px 7px;font:800 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.carousel}.active button{border-color:#58d76d;background:#0b3213;color:#d5ffc2}#${A.carousel} button.cancel{border-color:#8f4850;background:#2a0b0f;color:#ffb2b8}#${A.carousel} button:disabled{opacity:.5}
      #${A.carousel} .carousel-actions{flex-wrap:wrap;justify-content:flex-end}
      #${A.bulkDialog}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:#000c;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.bulkDialog} *{box-sizing:border-box}#${A.bulkDialog} .refresh-shell{width:min(410px,100%);overflow:hidden;border:1px solid #68e879;border-radius:10px;background:#07110af7;color:#d8ffd0;box-shadow:0 18px 55px #000;padding:12px}#${A.bulkDialog} .refresh-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}#${A.bulkDialog} .refresh-head strong{flex:1;color:#baff9f;font-size:13px;letter-spacing:.05em}#${A.bulkDialog} .refresh-head button{border:0;background:transparent;color:#8ab18d;font-size:18px}#${A.bulkDialog} .refresh-grid{display:grid;grid-template-columns:1fr auto;gap:4px 9px;padding:8px;border:1px solid #294c30;border-radius:7px;background:#091b0e}#${A.bulkDialog} .refresh-grid span{color:#82a889;font-size:9px}#${A.bulkDialog} .refresh-grid strong{text-align:right;color:#d5ffca;font-size:10px}#${A.bulkDialog} .refresh-note{margin:9px 1px;color:#8fb696;font-size:9px;line-height:1.35}#${A.bulkDialog} .refresh-options{display:grid;gap:7px}#${A.bulkDialog} .refresh-option{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 9px;align-items:center;padding:9px;border:1px solid #36583d;border-radius:7px;background:#0b2211;color:#d1ffca;text-align:left}#${A.bulkDialog} .refresh-option strong{font-size:10px}#${A.bulkDialog} .refresh-option span{grid-column:1;color:#83a98a;font-size:8px}#${A.bulkDialog} .refresh-option button{grid-row:1/3;grid-column:2;min-height:38px;border:1px solid #58d76d;border-radius:6px;background:#16461e;color:#e1ffd2;padding:6px 9px;font:800 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.bulkDialog} .refresh-option.all button{border-color:#438bb9;background:#0b2b3d;color:#d4f2ff}#${A.bulkDialog} button:disabled{opacity:.45}
      #${A.toast}{position:fixed;left:50%;top:max(70px,calc(env(safe-area-inset-top) + 62px));z-index:2147483647;max-width:min(360px,calc(100vw - 24px));padding:8px 11px;transform:translate(-50%,-8px);border:1px solid #73df83;border-radius:6px;background:#06170af5;color:#d2ffc0;box-shadow:0 8px 26px #000c;font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease}#${A.toast}.show{transform:translate(-50%,0);opacity:1}
      #${A.panel}{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;align-items:center;box-sizing:border-box;margin:3px 5px;padding:5px 7px;border:1px solid #27863f;border-radius:5px;background:#041109f5;color:#9ff48e;box-shadow:none;font:700 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.panel} .watch-copy{display:grid;min-width:0;gap:2px}#${A.panel} strong{overflow:hidden;color:#c7ffad;font-size:8px;white-space:nowrap;text-overflow:ellipsis}#${A.panel} span{display:block;overflow:hidden;color:#72bd7d;font-size:7px;white-space:nowrap;text-overflow:ellipsis}#${A.panel} button{min-height:28px;border:1px solid #58d76d;border-radius:4px;background:#082b10;color:#c5ffac;padding:4px 7px;font:800 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.panel}.idle{border-color:#4d5960;background:#0a0d0ff5;color:#aeb8bd}#${A.panel}.idle strong,#${A.panel}.idle span{color:#aeb8bd}#${A.panel}.stale{border-color:#9a6d1f;background:#211705f5;color:#ffd166}#${A.panel}.stale strong,#${A.panel}.stale span{color:#ffd166}#${A.panel}.outdated,#${A.panel}.missing{border-color:#8f4850;background:#23090cf5;color:#ff9ba3}#${A.panel}.outdated strong,#${A.panel}.outdated span,#${A.panel}.missing strong,#${A.panel}.missing span{color:#ff9ba3}
      .tsimm-watch-inline-badge{display:grid!important;gap:1px!important;min-width:0!important;max-width:100%!important;padding:2px 4px!important;overflow:hidden!important;box-sizing:border-box!important}.tsimm-watch-inline-badge strong,.tsimm-watch-inline-badge .tsimm-listing-lot{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:clip!important}.tsimm-watch-inline-badge strong{font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline-badge .tsimm-listing-lot{font:800 7px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline{display:none!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit .tsimm-listing-lot{border-color:#78ef8d!important;background:#073411f5!important;color:#78ef8d!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-even,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even .tsimm-listing-lot,.tsimm-watch-inline-badge.tsimm-watch-floor-badge,.tsimm-watch-inline-badge.tsimm-watch-floor-badge strong,.tsimm-watch-inline-badge.tsimm-watch-floor-badge .tsimm-listing-lot{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}.tsimm-watch-hidden-loss{display:none!important}.tsimm-watch-format-row{position:relative!important}
      .tsimm-watch-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:112px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}.tsimm-watch-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-watch-profit.floor{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}.tsimm-watch-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-watch-floor-row{box-shadow:inset 0 2px #52c7ea!important}
      .tsimm-market-health-mark{display:flex!important;align-items:center!important;gap:0!important;margin-top:1px!important;padding-top:1px!important;border-top:1px solid #6b6570!important;font:900 6.5px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;letter-spacing:.02em!important;opacity:1!important}.tsimm-market-health-mark .mv-gap.discount{color:#78ef8d!important}.tsimm-market-health-mark .mv-gap.aligned{color:#8ee8ff!important}.tsimm-market-health-mark .mv-gap.premium{color:#ff8c96!important}.tsimm-market-health-mark .mv-gap.unknown{color:#aeb8bd!important}.tsimm-market-health-mark .quote-gap.aligned,.tsimm-market-health-summary.aligned{color:#8ee8ff!important}.tsimm-market-health-mark .quote-gap.caution,.tsimm-market-health-summary.caution{color:#ffd166!important}.tsimm-market-health-mark .quote-gap.danger,.tsimm-market-health-summary.danger{color:#ff8c96!important}.tsimm-market-health-mark .quote-gap.unknown,.tsimm-market-health-summary.unknown{color:#aeb8bd!important}.tsimm-market-health-aligned-row{box-shadow:inset 3px 0 #52c7ea!important}.tsimm-market-health-caution-row{box-shadow:inset 3px 0 #d7a83d!important}.tsimm-market-health-danger-row{box-shadow:inset 3px 0 #df5966!important}.tsimm-market-health-unknown-row{box-shadow:inset 3px 0 #66717a!important}#${A.panel}.health-caution{border-color:#9a6d1f!important}#${A.panel}.health-danger{border-color:#8f4850!important}#${A.panel}.health-aligned{border-color:#318cab!important}
    `;
    style.textContent += `
      .tsimm-watch-inline-badge.tsimm-watch-roi-gold,.tsimm-watch-inline-badge.tsimm-watch-roi-gold strong,.tsimm-watch-inline-badge.tsimm-watch-roi-gold .tsimm-listing-lot{border-color:#f4c95d!important;background:#2b2208f5!important;color:#ffe38a!important}
      .tsimm-watch-inline-badge.tsimm-watch-roi-green,.tsimm-watch-inline-badge.tsimm-watch-roi-green strong,.tsimm-watch-inline-badge.tsimm-watch-roi-green .tsimm-listing-lot{border-color:#78ef8d!important;background:#073411f5!important;color:#78ef8d!important}
      .tsimm-watch-inline-badge.tsimm-watch-roi-purple,.tsimm-watch-inline-badge.tsimm-watch-roi-purple strong,.tsimm-watch-inline-badge.tsimm-watch-roi-purple .tsimm-listing-lot{border-color:#c77dff!important;background:#281037f5!important;color:#dca2ff!important}
      .tsimm-watch-inline-badge.tsimm-watch-roi-even,.tsimm-watch-inline-badge.tsimm-watch-roi-even strong,.tsimm-watch-inline-badge.tsimm-watch-roi-even .tsimm-listing-lot{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}
      .tsimm-watch-inline-badge.tsimm-watch-roi-loss,.tsimm-watch-inline-badge.tsimm-watch-roi-loss strong,.tsimm-watch-inline-badge.tsimm-watch-roi-loss .tsimm-listing-lot{border-color:#ff626d!important;background:#2c0b0ef5!important;color:#ff8c96!important}
      .tsimm-watch-profit.tsimm-watch-roi-gold{border-color:#f4c95d!important;background:#2b2208f5!important;color:#ffe38a!important}
      .tsimm-watch-profit.tsimm-watch-roi-green{border-color:#78ef8d!important;background:#073411f5!important;color:#78ef8d!important}
      .tsimm-watch-profit.tsimm-watch-roi-purple{border-color:#c77dff!important;background:#281037f5!important;color:#dca2ff!important}
      .tsimm-watch-profit.tsimm-watch-roi-even{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}
      .tsimm-watch-profit.tsimm-watch-roi-loss{border-color:#ff626d!important;background:#2c0b0ef5!important;color:#ff8c96!important}
      .tsimm-watch-hidden-loss{display:flex!important}
    `;
    style.textContent += `
      #${A.turnoverPanel}{display:grid;gap:7px;box-sizing:border-box;margin:6px 8px;padding:9px;border:1px solid #9d7627;border-radius:8px;background:#171105f4;color:#ffe28a;font:800 9px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.turnoverPanel} .turnover-head{display:grid;gap:2px}#${A.turnoverPanel} .turnover-head strong{color:#ffe8a3;font-size:11px;letter-spacing:.04em}#${A.turnoverPanel} .turnover-head span{color:#bfa969;font-size:8px;font-weight:700}
      #${A.turnoverPanel} .turnover-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}#${A.turnoverPanel} button{display:grid;grid-template-columns:auto 1fr auto;gap:5px;align-items:center;min-height:36px;border:1px solid #826923;border-radius:6px;background:#2a2008;color:#ffe8a3;padding:6px 7px;text-align:left;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.turnoverPanel} button small{color:#ad985a;font-size:7px}#${A.turnoverPanel} button.complete{border-color:#4ea966;background:#0b2b13;color:#bdffae}#${A.turnoverPanel} button.all{grid-column:1/-1;border-color:#5a8aa6;background:#0a2230;color:#c8efff}#${A.turnoverPanel} button:disabled{opacity:.65}
      .tsimm-turnover-chip{display:inline-flex!important;align-items:center!important;margin-right:4px!important;padding:1px 4px!important;border:1px solid #b78c2d!important;border-radius:999px!important;background:#2a1f07!important;color:#ffe28a!important;font:900 7px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;vertical-align:1px!important;white-space:nowrap!important}

      #${A.turnoverPanel} .velocity-board{display:grid;gap:4px;padding-top:7px;border-top:1px solid #5d4a19}#${A.turnoverPanel} .velocity-board-head{display:flex;justify-content:space-between;gap:8px;color:#ffe8a3;font-size:9px}#${A.turnoverPanel} .velocity-board-head span{color:#ad985a;font-size:7px}#${A.turnoverPanel} .velocity-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;padding:5px 6px;border:1px solid #4f4527;border-radius:5px;background:#17140a}#${A.turnoverPanel} .velocity-row strong{overflow:hidden;color:#f4e5ac;font-size:8px;white-space:nowrap;text-overflow:ellipsis}#${A.turnoverPanel} .velocity-row b{color:#9fe8ff;font-size:8px}#${A.turnoverPanel} .velocity-row span{grid-column:1/-1;color:#958a62;font-size:7px}#${A.turnoverPanel} .velocity-empty{padding:6px;border:1px dashed #5d542f;border-radius:5px;color:#a89c70;font-size:8px;font-weight:700}
      #${A.panel} .tsimm-market-velocity{display:block!important;margin-top:1px!important;color:#8fcce0!important;font-size:7px!important;font-weight:900!important;letter-spacing:.01em!important}#${A.panel} .tsimm-market-velocity.learning{color:#a7afb4!important}#${A.panel} .tsimm-market-velocity.slow{color:#8fa4ad!important}#${A.panel} .tsimm-market-velocity.steady{color:#8edcf2!important}#${A.panel} .tsimm-market-velocity.fast{color:#95efaa!important}#${A.panel} .tsimm-market-velocity.frenzy{color:#ffe07b!important;text-shadow:0 0 8px #d6a72d55}
      @media(max-width:430px){#${A.turnoverPanel} .turnover-actions{grid-template-columns:1fr}#${A.turnoverPanel} button.all{grid-column:auto}}
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
      const disposition = ['normal', 'avoid', 'hidden'].includes(clean(candidate.disposition).toLowerCase())
        ? clean(candidate.disposition).toLowerCase()
        : candidate.hidden ? 'hidden' : candidate.avoid ? 'avoid' : 'normal';
      return {
        raw: candidate,
        id: clean(candidate.recordId ?? candidate.uuid)
          || (typeof candidate.id === 'string' ? clean(candidate.id) : '')
          || (uid ? `trader-${uid}` : `trader-${key(name)}`),
        name,
        n: key(name),
        uid,
        disposition,
        avoidReasons: Array.isArray(candidate.avoidReasons) ? candidate.avoidReasons.map(clean).filter(Boolean) : [],
        captured: candidate.pricePageLastCheckedAt || candidate.pricePageCapturedAt || candidate.pricesCapturedAt || null,
        url: clean(candidate.pricePageUrl ?? candidate.pricingPageUrl),
        items: (Array.isArray(candidate.pricePageItems ?? candidate.pricingItems)
          ? candidate.pricePageItems ?? candidate.pricingItems
          : []).map(normItem).filter(Boolean),
      };
    }).filter(Boolean);
  }

  function traderRecommendationEligible(trader) {
    return clean(trader?.disposition || 'normal').toLowerCase() === 'normal';
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
        turnoverPreset: clean(candidate?.turnoverPreset),
        turnoverTier: clean(candidate?.turnoverTier),
        turnoverReason: clean(candidate?.turnoverReason),
      });
    }
    return { schema: 'tornscripture-imm-watched-items', schemaVersion: 1, entries: [...unique.values()] };
  }

  function watchEntryMatchesItem(entry, item) {
    const entryId = Number(entry?.itemId) > 0 ? Number(entry.itemId) : null;
    const itemId = Number(item?.id ?? item?.itemId) > 0 ? Number(item.id ?? item.itemId) : null;
    if (entryId && itemId && entryId === itemId) return true;
    return Boolean(key(entry?.itemName ?? entry?.name)
      && key(entry?.itemName ?? entry?.name) === key(item?.name ?? item?.itemName));
  }

  function turnoverPresetById(presetId) {
    return HIGH_TURNOVER_PRESETS.find((preset) => preset.id === clean(presetId)) || null;
  }

  function turnoverProfilesForItem(item) {
    const wanted = key(item?.name ?? item?.itemName);
    if (!wanted) return [];
    return HIGH_TURNOVER_PRESETS.filter((preset) => preset.items.some((name) => key(name) === wanted));
  }

  function resolvedTurnoverItems(preset) {
    const values = catalog();
    return preset.items.map((name) => {
      const resolved = values.name[key(name)] || null;
      return {
        id: resolved?.id || null,
        name: resolved?.name || name,
        n: key(resolved?.name || name),
      };
    });
  }

  function turnoverPresetStats(preset, store = watchedStore()) {
    const items = resolvedTurnoverItems(preset);
    const watched = items.filter((item) => store.entries.some((entry) => watchEntryMatchesItem(entry, item))).length;
    return { watched, total: items.length, complete: watched === items.length };
  }

  function addTurnoverPreset(presetId) {
    const presets = clean(presetId) === 'all'
      ? HIGH_TURNOVER_PRESETS
      : [turnoverPresetById(presetId)].filter(Boolean);
    if (!presets.length) return { added: 0, total: 0, presets: 0 };
    const store = watchedStore();
    let added = 0;
    let total = 0;
    for (const preset of presets) {
      for (const item of resolvedTurnoverItems(preset)) {
        total += 1;
        if (store.entries.some((entry) => watchEntryMatchesItem(entry, item))) continue;
        store.entries.push({
          itemId: item.id,
          itemName: item.name,
          addedAt: new Date().toISOString(),
          source: `turnover:${preset.id}`,
          turnoverPreset: preset.id,
          turnoverTier: preset.tier,
          turnoverReason: preset.description,
        });
        added += 1;
      }
    }
    if (added) saveWatched(store);
    scheduleTorn();
    const label = presets.length === HIGH_TURNOVER_PRESETS.length
      ? 'all high-turnover presets'
      : presets[0].label.toLowerCase();
    showFavoriteToast(added
      ? `Added ${added} ${label} target${added === 1 ? '' : 's'}`
      : `${label} already fully watched`);
    return { added, total, presets: presets.length };
  }


  function turnoverTextHash(value) {
    let hash = 2166136261;
    const input = String(value || '');
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function turnoverHistoryStore() {
    const raw = read(A.turnoverHistory, {});
    const source = raw?.items && typeof raw.items === 'object' ? raw.items : {};
    const cutoff = Date.now() - TURNOVER_CAPTURE_RULES.retentionMs;
    const items = {};
    for (const [token, candidate] of Object.entries(source)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const itemId = Number(candidate.itemId) > 0 ? Number(candidate.itemId) : null;
      const itemName = clean(candidate.itemName);
      if (!itemName) continue;
      const snapshots = (Array.isArray(candidate.snapshots) ? candidate.snapshots : [])
        .map((snapshot) => {
          const at = Date.parse(snapshot?.at || '');
          if (!Number.isFinite(at) || at < cutoff) return null;
          const listings = (Array.isArray(snapshot?.listings) ? snapshot.listings : [])
            .map((listing) => ({
              key: clean(listing?.key),
              owner: clean(listing?.owner),
              price: Math.max(0, Math.round(Number(listing?.price) || 0)),
              quantity: Math.max(0, Math.floor(Number(listing?.quantity) || 0)),
            }))
            .filter((listing) => listing.key && listing.price > 0 && listing.quantity > 0)
            .slice(0, TURNOVER_CAPTURE_RULES.maxVisibleListings);
          if (!listings.length) return null;
          return {
            at: new Date(at).toISOString(),
            signature: clean(snapshot?.signature) || listings.map((listing) => `${listing.key}:${listing.quantity}`).join('|'),
            listings,
          };
        })
        .filter(Boolean)
        .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
        .slice(-TURNOVER_CAPTURE_RULES.maxSnapshotsPerItem);
      if (!snapshots.length) continue;
      items[token] = {
        itemId,
        itemName,
        firstSeenAt: candidate.firstSeenAt || snapshots[0].at,
        lastSeenAt: snapshots[snapshots.length - 1].at,
        snapshots,
      };
    }
    return {
      schema: 'tornscripture-imm-turnover-history',
      schemaVersion: TURNOVER_CAPTURE_RULES.schemaVersion,
      updatedAt: raw?.updatedAt || null,
      items,
    };
  }

  function saveTurnoverHistory(store) {
    const entries = Object.entries(store.items || {})
      .sort((left, right) => Date.parse(right[1]?.lastSeenAt || '') - Date.parse(left[1]?.lastSeenAt || ''))
      .slice(0, TURNOVER_CAPTURE_RULES.maxItems);
    store.items = Object.fromEntries(entries);
    store.updatedAt = new Date().toISOString();
    write(A.turnoverHistory, store);
  }

  function turnoverRecordForItem(store, item) {
    const token = itemKey(item?.id ?? item?.itemId, item?.name ?? item?.itemName);
    if (store.items?.[token]) return { token, record: store.items[token] };
    const wantedId = Number(item?.id ?? item?.itemId) > 0 ? Number(item.id ?? item.itemId) : null;
    const wantedName = key(item?.name ?? item?.itemName);
    const match = Object.entries(store.items || {}).find(([, record]) =>
      (wantedId && Number(record?.itemId) === wantedId)
      || (wantedName && key(record?.itemName) === wantedName));
    return match ? { token: match[0], record: match[1] } : { token, record: null };
  }

  function turnoverListingOwner(row, index) {
    const profile = row.querySelector('a[href*="profiles.php?XID="],a[href*="profiles.php?id=" i]');
    const href = String(profile?.getAttribute('href') || profile?.href || '');
    const userId = Number(href.match(/[?&](?:XID|id)=(\d+)/i)?.[1]) || null;
    if (userId) return `uid:${userId}`;
    const profileName = clean(profile?.textContent || profile?.getAttribute('title') || profile?.getAttribute('aria-label'));
    if (profileName) return `name:${key(profileName)}`;
    const ownerLike = [...row.querySelectorAll('[class*="owner" i],[class*="seller" i],[class*="name" i],a')]
      .map((element) => clean(element.textContent || element.getAttribute('title') || element.getAttribute('aria-label')))
      .find((label) => label && label.length <= 40 && !/^(?:buy|max|purchase|qty|quantity)$/i.test(label));
    if (ownerLike) return `name:${key(ownerLike)}`;
    const stableText = clean(row.innerText || row.textContent)
      .replace(/\$[\d,.]+/g, '')
      .replace(/\b[\d,]+\b/g, '')
      .replace(/\b(?:buy|max|purchase|qty|quantity)\b/gi, '');
    return `row:${turnoverTextHash(stableText || String(index))}`;
  }

  function turnoverVisibleListings() {
    return [...document.querySelectorAll('.tsimm-listing-mark')]
      .filter(validWatchListingRow)
      .slice(0, TURNOVER_CAPTURE_RULES.maxVisibleListings)
      .map((row, index) => {
        const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing');
        const price = Math.max(0, Math.round(listingPrice(row) || 0));
        const quantity = Math.max(0, Math.floor(Number(badge?.dataset?.tsimmQuantity) || 0));
        const owner = turnoverListingOwner(row, index);
        return price > 0 && quantity > 0
          ? { key: `${owner}@${price}`, owner, price, quantity }
          : null;
      })
      .filter(Boolean);
  }

  function turnoverProfileFromRecord(record) {
    const snapshots = Array.isArray(record?.snapshots) ? record.snapshots : [];
    let observedMs = 0;
    let windows = 0;
    let quantityDropUnits = 0;
    let removedListingUnits = 0;
    let quantityDropEvents = 0;
    let removedListings = 0;
    let newListings = 0;
    for (let index = 1; index < snapshots.length; index += 1) {
      const previous = snapshots[index - 1];
      const current = snapshots[index];
      const gap = Date.parse(current.at) - Date.parse(previous.at);
      if (!Number.isFinite(gap) || gap < 5000 || gap > TURNOVER_CAPTURE_RULES.maximumPairGapMs) continue;
      observedMs += gap;
      windows += 1;
      const before = new Map(previous.listings.map((listing) => [listing.key, listing]));
      const after = new Map(current.listings.map((listing) => [listing.key, listing]));
      for (const [listingKey, listing] of before) {
        const next = after.get(listingKey);
        if (!next) {
          removedListings += 1;
          removedListingUnits += Number(listing.quantity) || 0;
          continue;
        }
        const decrease = Math.max(0, Number(listing.quantity || 0) - Number(next.quantity || 0));
        if (decrease > 0) {
          quantityDropEvents += 1;
          quantityDropUnits += decrease;
        }
      }
      for (const listingKey of after.keys()) {
        if (!before.has(listingKey)) newListings += 1;
      }
    }
    const observedHours = observedMs / 3600000;
    const weightedUnits = quantityDropUnits + removedListingUnits * 0.35;
    const signalUnitsPerHour = observedHours > 0 ? weightedUnits / observedHours : 0;
    const movementEvents = quantityDropEvents + removedListings;
    const eventsPerHour = observedHours > 0 ? movementEvents / observedHours : 0;
    const unitScore = Math.min(70, Math.log10(1 + signalUnitsPerHour) / Math.log10(1001) * 70);
    const eventScore = Math.min(30, Math.log10(1 + eventsPerHour) / Math.log10(21) * 30);
    const score = Math.max(0, Math.min(100, Math.round(unitScore + eventScore)));
    const confidence = Math.max(0, Math.min(100, Math.round(
      Math.min(1, windows / 12) * 55
      + Math.min(1, observedMs / (2 * 3600000)) * 30
      + Math.min(1, snapshots.length / 20) * 15
    )));
    let band = 'learning';
    if (snapshots.length >= 3 && confidence >= 20) {
      if (score >= 75) band = 'frenzy';
      else if (score >= 55) band = 'fast';
      else if (score >= 30) band = 'steady';
      else band = 'slow';
    }
    const labels = { learning: 'LEARNING', slow: 'SLOW', steady: 'STEADY', fast: 'FAST', frenzy: 'FRENZY' };
    return {
      itemId: Number(record?.itemId) || null,
      itemName: clean(record?.itemName),
      snapshots: snapshots.length,
      windows,
      observedMinutes: Math.round(observedMs / 60000),
      quantityDropUnits,
      removedListingUnits,
      quantityDropEvents,
      removedListings,
      newListings,
      signalUnitsPerHour,
      eventsPerHour,
      score,
      confidence,
      band,
      label: labels[band],
      rank: score * (0.35 + confidence / 100 * 0.65),
      lastSeenAt: record?.lastSeenAt || snapshots[snapshots.length - 1]?.at || null,
    };
  }

  function turnoverVelocityForItem(item) {
    const store = turnoverHistoryStore();
    const found = turnoverRecordForItem(store, item);
    return found.record
      ? turnoverProfileFromRecord(found.record)
      : turnoverProfileFromRecord({ itemId: item?.id || null, itemName: item?.name || '', snapshots: [] });
  }

  function turnoverLeaderboard(limit = 6) {
    const store = turnoverHistoryStore();
    return Object.values(store.items || {})
      .map(turnoverProfileFromRecord)
      .filter((profile) => profile.snapshots >= 2)
      .sort((left, right) => right.rank - left.rank
        || right.confidence - left.confidence
        || right.snapshots - left.snapshots
        || left.itemName.localeCompare(right.itemName))
      .slice(0, Math.max(1, Math.floor(Number(limit) || 6)));
  }

  function maybeCaptureTurnoverSnapshot(item) {
    const listings = turnoverVisibleListings();
    const profile = () => turnoverVelocityForItem(item);
    if (!listings.length) return profile();
    const itemToken = itemKey(item?.id, item?.name);
    const signature = listings.map((listing) => `${listing.key}:${listing.quantity}`).join('|');
    const now = Date.now();
    if (turnoverCaptureState.itemToken !== itemToken || turnoverCaptureState.signature !== signature) {
      turnoverCaptureState.itemToken = itemToken;
      turnoverCaptureState.signature = signature;
      turnoverCaptureState.stableSince = now;
      return profile();
    }
    if (now - turnoverCaptureState.stableSince < TURNOVER_CAPTURE_RULES.settleMs) return profile();

    const store = turnoverHistoryStore();
    const found = turnoverRecordForItem(store, item);
    const record = found.record || {
      itemId: Number(item?.id) || null,
      itemName: clean(item?.name),
      firstSeenAt: new Date(now).toISOString(),
      lastSeenAt: null,
      snapshots: [],
    };
    const last = record.snapshots[record.snapshots.length - 1] || null;
    const lastAt = Date.parse(last?.at || '') || 0;
    const gap = now - lastAt;
    const changed = !last || last.signature !== signature;
    if (last && ((!changed && gap < TURNOVER_CAPTURE_RULES.heartbeatMs)
      || (changed && gap < TURNOVER_CAPTURE_RULES.changedMinimumGapMs))) return turnoverProfileFromRecord(record);

    const capturedAt = new Date(now).toISOString();
    record.itemId = Number(item?.id) || record.itemId || null;
    record.itemName = clean(item?.name) || record.itemName;
    record.lastSeenAt = capturedAt;
    record.snapshots.push({ at: capturedAt, signature, listings });
    record.snapshots = record.snapshots.slice(-TURNOVER_CAPTURE_RULES.maxSnapshotsPerItem);
    store.items[found.token || itemToken] = record;
    saveTurnoverHistory(store);
    return turnoverProfileFromRecord(record);
  }

  function turnoverVelocityHtml(item) {
    const profile = turnoverVelocityForItem(item);
    const title = 'Visible listing movement only; removals can include sales, repricing, or delisting.';
    if (profile.snapshots < 3 || profile.band === 'learning') {
      return `<span class="tsimm-market-velocity learning" title="${esc(title)}">◌ VELOCITY LEARNING · ${profile.snapshots}/3 snapshots · ${profile.windows} usable comparison${profile.windows === 1 ? '' : 's'}</span>`;
    }
    const rate = Math.round(profile.signalUnitsPerHour).toLocaleString();
    return `<span class="tsimm-market-velocity ${esc(profile.band)}" title="${esc(title)}">⚡ ${esc(profile.label)} · score ${profile.score}/100 · ~${rate} units/hr signal · ${profile.confidence}% confidence</span>`;
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

  function normalizeFavoriteCaptureCarousel(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const entries = Array.isArray(candidate.entries)
      ? candidate.entries.map((entry) => ({
          traderId: clean(entry?.traderId),
          traderName: clean(entry?.traderName),
          pricePageUrl: clean(entry?.pricePageUrl),
        })).filter((entry) => entry.traderId && entry.traderName && entry.pricePageUrl)
      : [];
    const expiresAt = Number(candidate.expiresAt) || 0;
    if (!entries.length || (expiresAt && expiresAt <= Date.now())) return null;
    return {
      schemaVersion: 2,
      mode: ['favorite', 'stale', 'all', 'retry'].includes(clean(candidate.mode)) ? clean(candidate.mode) : 'favorite',
      id: clean(candidate.id) || createId('trader-recapture'),
      entries,
      cursor: Math.max(0, Math.min(entries.length, Math.floor(Number(candidate.cursor) || 0))),
      completed: Array.isArray(candidate.completed) ? candidate.completed.map(clean).filter(Boolean) : [],
      failed: Array.isArray(candidate.failed) ? candidate.failed.map(clean).filter(Boolean) : [],
      skipped: Math.max(0, Math.floor(Number(candidate.skipped) || 0)),
      status: clean(candidate.status) || 'ready',
      currentTraderId: clean(candidate.currentTraderId),
      currentTraderName: clean(candidate.currentTraderName),
      returnUrl: clean(candidate.returnUrl),
      startedAt: Number(candidate.startedAt) || Date.now(),
      launchedAt: Number(candidate.launchedAt) || 0,
      expiresAt: expiresAt || Date.now() + (12 * 60 * 60 * 1000),
      lastError: clean(candidate.lastError),
    };
  }

  function activeFavoriteCaptureCarousel() {
    const persisted = read(A.carouselSession, null);
    const legacy = loadSessionJson(A.carouselSession, null);
    const queue = normalizeFavoriteCaptureCarousel(persisted || legacy);
    if (legacy && !persisted && queue) {
      write(A.carouselSession, queue);
      saveSessionJson(A.carouselSession, null);
    }
    if (!queue) {
      try { localStorage.removeItem(A.carouselSession); } catch {}
      saveSessionJson(A.carouselSession, null);
    }
    return queue;
  }

  function saveFavoriteCaptureCarousel(queue) {
    const normalized = queue ? normalizeFavoriteCaptureCarousel(queue) : null;
    try {
      if (normalized) write(A.carouselSession, normalized);
      else localStorage.removeItem(A.carouselSession);
    } catch {}
    saveSessionJson(A.carouselSession, null);
    scheduleTorn();
  }


  function favoriteCaptureSelection(traders = normTraders(), favorites = favoriteStore()) {
    const ready = [];
    const seen = new Set();
    let skipped = 0;
    for (const favorite of favorites.entries) {
      const trader = traders.find((candidate) => favoriteMatches(favorite, candidate));
      if (!trader || seen.has(trader.id)) continue;
      seen.add(trader.id);
      if (!traderRecommendationEligible(trader)
        || !trader.url
        || (!isWeav3rPriceListUrl(trader.url) && !isTornExchangePriceListUrl(trader.url))) {
        skipped += 1;
        continue;
      }
      ready.push(trader);
    }
    return { ready, skipped, favoriteCount: favorites.entries.length };
  }

  const TRADER_CAPTURE_FRESH_MS = 72 * 60 * 60 * 1000;
  let traderRefreshDialogOpen = false;

  function captureQueueLabel(queueOrMode) {
    const mode = typeof queueOrMode === 'string' ? queueOrMode : clean(queueOrMode?.mode);
    if (mode === 'all') return 'ALL TRADER REFRESH';
    if (mode === 'stale') return 'STALE TRADER REFRESH';
    if (mode === 'retry') return 'FAILED TRADER RETRY';
    return 'FAVORITE REFRESH';
  }

  function traderCaptureFresh(trader) {
    const captured = Date.parse(trader?.captured || '');
    return Number.isFinite(captured) && Date.now() - captured <= TRADER_CAPTURE_FRESH_MS;
  }


  function savedTraderCaptureSelection(traders = normTraders()) {
    const eligible = [];
    const stale = [];
    const fresh = [];
    const unsupported = [];
    const excluded = [];
    for (const trader of traders) {
      if (!traderRecommendationEligible(trader)) {
        excluded.push(trader);
        continue;
      }
      if (!trader.url || (!isWeav3rPriceListUrl(trader.url) && !isTornExchangePriceListUrl(trader.url))) {
        unsupported.push(trader);
        continue;
      }
      eligible.push(trader);
      if (traderCaptureFresh(trader)) fresh.push(trader);
      else stale.push(trader);
    }
    return { total: traders.length, eligible, stale, fresh, unsupported, excluded };
  }

  function lastCaptureRefreshResult() {
    const result = read(A.carouselResult, null);
    if (!result || typeof result !== 'object') return null;
    const finishedAt = Number(result.finishedAt) || 0;
    if (finishedAt && Date.now() - finishedAt > 7 * 24 * 60 * 60 * 1000) {
      try { localStorage.removeItem(A.carouselResult); } catch {}
      return null;
    }
    return {
      mode: clean(result.mode) || 'all',
      completed: Array.isArray(result.completed) ? result.completed.map(clean).filter(Boolean) : [],
      failed: Array.isArray(result.failed) ? result.failed.map(clean).filter(Boolean) : [],
      skipped: Math.max(0, Math.floor(Number(result.skipped) || 0)),
      finishedAt,
    };
  }

  function saveCaptureRefreshResult(result) {
    try {
      if (result) write(A.carouselResult, result);
      else localStorage.removeItem(A.carouselResult);
    } catch {}
    scheduleTorn();
  }

  function closeTraderRefreshDialog() {
    traderRefreshDialogOpen = false;
    document.getElementById(A.bulkDialog)?.remove();
    scheduleTorn();
  }

  function openTraderRefreshDialog() {
    traderRefreshDialogOpen = true;
    scheduleTorn();
  }


  function renderTraderRefreshDialog(selection = savedTraderCaptureSelection()) {
    let dialog = document.getElementById(A.bulkDialog);
    if (!traderRefreshDialogOpen) {
      dialog?.remove();
      return;
    }
    if (!dialog) {
      dialog = document.createElement('section');
      dialog.id = A.bulkDialog;
      dialog.dataset.tsimmGenerated = 'true';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<div class="refresh-shell"><div class="refresh-head"><strong>🧌 GOBLIN GOD PRICE CENSUS</strong><button type="button" data-watch-bulk-cancel aria-label="Close">×</button></div><div class="refresh-grid"><span>Saved traders</span><strong>${selection.total}</strong><span>Supported price pages</span><strong>${selection.eligible.length}</strong><span>Stale or missing</span><strong>${selection.stale.length}</strong><span>Fresh within 72h</span><strong>${selection.fresh.length}</strong><span>Unsupported / manual</span><strong>${selection.unsupported.length}</strong><span>Avoided / hidden</span><strong>${selection.excluded.length}</strong></div><div class="refresh-note">Old captures are preserved until a replacement succeeds. Avoided and hidden traders are skipped. The queue returns to Torn after each supported price page and can resume after an app restart.</div><div class="refresh-options"><div class="refresh-option"><strong>Stale or missing only</strong><span>Recommended default. Skips traders whose captured prices are already fresh.</span><button type="button" data-watch-bulk-start="stale" ${selection.stale.length ? '' : 'disabled'}>START ${selection.stale.length}</button></div><div class="refresh-option all"><strong>Every eligible trader</strong><span>Refreshes fresh, stale, and missing active traders in one complete sweep.</span><button type="button" data-watch-bulk-start="all" ${selection.eligible.length ? '' : 'disabled'}>START ${selection.eligible.length}</button></div></div></div>`;
  }

  function startSavedTraderCaptureCarousel(mode = 'stale', explicitTraders = null) {
    const existing = activeFavoriteCaptureCarousel();
    if (existing && existing.cursor < existing.entries.length) {
      showFavoriteToast(`${captureQueueLabel(existing)} already active: ${existing.cursor + 1}/${existing.entries.length}`);
      return false;
    }
    const selection = savedTraderCaptureSelection();
    const ready = Array.isArray(explicitTraders)
      ? explicitTraders
      : mode === 'all'
        ? selection.eligible
        : selection.stale;
    const unique = [...new Map(ready.map((trader) => [trader.id, trader])).values()]
      .filter((trader) => trader?.id && trader?.url && (isWeav3rPriceListUrl(trader.url) || isTornExchangePriceListUrl(trader.url)));
    if (!unique.length) {
      showFavoriteToast(mode === 'stale' ? 'All supported trader prices are already fresh' : 'No eligible trader price pages are available');
      return false;
    }
    const queue = normalizeFavoriteCaptureCarousel({
      id: createId(`${mode}-trader-recapture`),
      mode,
      entries: unique.map((trader) => ({ traderId: trader.id, traderName: trader.name, pricePageUrl: trader.url })),
      cursor: 0,
      completed: [],
      failed: [],
      skipped: mode === 'retry' ? 0 : selection.unsupported.length,
      status: 'ready',
      returnUrl: normalizeHttpUrl(location.href),
      startedAt: Date.now(),
      expiresAt: Date.now() + (12 * 60 * 60 * 1000),
    });
    saveCaptureRefreshResult(null);
    saveFavoriteCaptureCarousel(queue);
    closeTraderRefreshDialog();
    showFavoriteToast(`${captureQueueLabel(queue)} armed: ${queue.entries.length} trader${queue.entries.length === 1 ? '' : 's'}`);
    setTimeout(launchFavoriteCaptureCarousel, 450);
    return true;
  }

  function retryFailedTraderCaptureCarousel() {
    const result = lastCaptureRefreshResult();
    if (!result?.failed?.length) {
      showFavoriteToast('No failed trader captures are waiting');
      return false;
    }
    const failed = new Set(result.failed.map(key));
    const traders = normTraders().filter((trader) => failed.has(key(trader.name))
      && trader.url
      && (isWeav3rPriceListUrl(trader.url) || isTornExchangePriceListUrl(trader.url)));
    return startSavedTraderCaptureCarousel('retry', traders);
  }

  function skipCurrentCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    if (!queue || queue.cursor >= queue.entries.length) {
      showFavoriteToast('No active trader capture is available to skip');
      return false;
    }
    const current = queue.entries[queue.cursor];
    if (!queue.failed.includes(current.traderName)) queue.failed.push(current.traderName);
    queue.cursor += 1;
    queue.status = queue.cursor >= queue.entries.length ? 'complete' : 'ready';
    queue.currentTraderId = '';
    queue.currentTraderName = '';
    queue.lastError = `${current.traderName} skipped; previous captured prices were preserved.`;
    saveFavoriteCaptureCarousel(queue);
    if (queue.cursor >= queue.entries.length) finishFavoriteCaptureCarousel(queue);
    else setTimeout(launchFavoriteCaptureCarousel, 350);
    return true;
  }

  function finishFavoriteCaptureCarousel(queue, message = '') {
    const completed = queue?.completed?.length || 0;
    const failed = queue?.failed?.length || 0;
    const skipped = queue?.skipped || 0;
    const label = captureQueueLabel(queue);
    saveCaptureRefreshResult({
      mode: queue?.mode || 'favorite',
      completed: [...(queue?.completed || [])],
      failed: [...(queue?.failed || [])],
      skipped,
      finishedAt: Date.now(),
    });
    saveFavoriteCaptureCarousel(null);
    showFavoriteToast(message || `${label} finished: ${completed} captured${failed ? ` · ${failed} failed` : ''}${skipped ? ` · ${skipped} unsupported` : ''}`);
  }

  function cancelFavoriteCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    saveFavoriteCaptureCarousel(null);
    showFavoriteToast(queue ? `${captureQueueLabel(queue)} cancelled` : 'No trader capture queue is active');
  }

  function launchFavoriteCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    if (!queue) {
      showFavoriteToast('No trader capture queue is ready');
      return false;
    }
    if (queue.cursor >= queue.entries.length) {
      finishFavoriteCaptureCarousel(queue);
      return true;
    }
    const current = queue.entries[queue.cursor];
    const trader = state.traders.find((entry) => entry.id === current.traderId);
    if (!trader?.pricePageUrl || (!isWeav3rPriceListUrl(trader.pricePageUrl) && !isTornExchangePriceListUrl(trader.pricePageUrl))) {
      queue.failed.push(current.traderName);
      queue.cursor += 1;
      queue.status = 'ready';
      queue.lastError = `${current.traderName} no longer has a supported automatic price page.`;
      saveFavoriteCaptureCarousel(queue);
      setTimeout(launchFavoriteCaptureCarousel, 250);
      return false;
    }
    queue.status = 'launched';
    queue.currentTraderId = current.traderId;
    queue.currentTraderName = current.traderName;
    queue.launchedAt = Date.now();
    queue.lastError = '';
    saveFavoriteCaptureCarousel(queue);
    showFavoriteToast(`${captureQueueLabel(queue)} ${queue.cursor + 1}/${queue.entries.length}: ${current.traderName}`);
    setTimeout(() => requestTraderPriceRecapture(current.traderId), 180);
    return true;
  }

  function startFavoriteCaptureCarousel() {
    const existing = activeFavoriteCaptureCarousel();
    if (existing && existing.cursor < existing.entries.length) {
      showFavoriteToast(`${captureQueueLabel(existing)} already active: ${existing.cursor + 1}/${existing.entries.length}`);
      return false;
    }
    const selection = favoriteCaptureSelection();
    if (!selection.favoriteCount) {
      showFavoriteToast('Star traders first, then refresh favorites');
      return false;
    }
    if (!selection.ready.length) {
      showFavoriteToast('No favorite traders have supported TornExchange or TornW3B price pages');
      return false;
    }
    const queue = normalizeFavoriteCaptureCarousel({
      id: createId('favorite-recapture'),
      mode: 'favorite',
      entries: selection.ready.map((trader) => ({
        traderId: trader.id,
        traderName: trader.name,
        pricePageUrl: trader.url,
      })),
      cursor: 0,
      completed: [],
      failed: [],
      skipped: selection.skipped,
      status: 'ready',
      returnUrl: normalizeHttpUrl(location.href),
      startedAt: Date.now(),
      expiresAt: Date.now() + (12 * 60 * 60 * 1000),
    });
    saveCaptureRefreshResult(null);
    saveFavoriteCaptureCarousel(queue);
    showFavoriteToast(`Favorite carousel armed: ${queue.entries.length} trader${queue.entries.length === 1 ? '' : 's'}`);
    setTimeout(launchFavoriteCaptureCarousel, 450);
    return true;
  }

  function continueFavoriteCaptureCarousel(notice) {
    const queue = activeFavoriteCaptureCarousel();
    if (!queue || !notice) return false;
    if (queue.cursor >= queue.entries.length) {
      finishFavoriteCaptureCarousel(queue);
      return true;
    }
    const current = queue.entries[queue.cursor];
    const noticeId = clean(notice.traderId);
    const noticeName = key(notice.trader);
    const matches = (noticeId && noticeId === current.traderId)
      || (noticeName && noticeName === key(current.traderName));
    if (!matches) {
      queue.status = 'paused';
      queue.lastError = `Captured ${clean(notice.trader) || 'another trader'} while waiting for ${current.traderName}.`;
      saveFavoriteCaptureCarousel(queue);
      showFavoriteToast(`Carousel paused: expected ${current.traderName}`);
      return false;
    }
    if (!queue.completed.includes(current.traderName)) queue.completed.push(current.traderName);
    queue.cursor += 1;
    queue.status = queue.cursor >= queue.entries.length ? 'complete' : 'ready';
    queue.currentTraderId = '';
    queue.currentTraderName = '';
    queue.lastError = '';
    saveFavoriteCaptureCarousel(queue);
    if (queue.cursor >= queue.entries.length) {
      finishFavoriteCaptureCarousel(queue);
      return true;
    }
    const next = queue.entries[queue.cursor];
    showFavoriteToast(`${clean(notice.trader)} captured · next ${next.traderName}`);
    setTimeout(launchFavoriteCaptureCarousel, 850);
    return true;
  }

  function renderTurnoverPresetPanel(book) {
    if (!(book instanceof Element)) return;
    let panel = book.querySelector(`#${A.turnoverPanel}`);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = A.turnoverPanel;
      const firstCard = book.querySelector('.tsimm-trader-card');
      if (firstCard) firstCard.before(panel);
      else book.appendChild(panel);
    }
    const store = watchedStore();
    const buttons = HIGH_TURNOVER_PRESETS.map((preset) => {
      const stats = turnoverPresetStats(preset, store);
      return `<button type="button" class="${stats.complete ? 'complete' : ''}" data-watch-turnover-preset="${esc(preset.id)}" ${stats.complete ? 'disabled' : ''}><span>${esc(preset.icon)}</span><strong>${esc(preset.tier)} · ${esc(preset.label)}<small>${esc(preset.description)}</small></strong><span>${stats.watched}/${stats.total}</span></button>`;
    }).join('');
    const union = new Map();
    for (const preset of HIGH_TURNOVER_PRESETS) {
      for (const item of resolvedTurnoverItems(preset)) union.set(item.n, item);
    }
    const watchedTotal = [...union.values()].filter((item) => store.entries.some((entry) => watchEntryMatchesItem(entry, item))).length;
    const allComplete = watchedTotal === union.size;
    const leaders = turnoverLeaderboard(6);
    const leaderRows = leaders.map((profile) => {
      const rate = Math.round(profile.signalUnitsPerHour).toLocaleString();
      return `<div class="velocity-row"><strong>${esc(profile.itemName)}</strong><b>${esc(profile.label)} ${profile.score}</b><span>~${rate} units/hr signal · ${profile.confidence}% confidence · ${profile.snapshots} snapshots</span></div>`;
    }).join('');
    const velocityBoard = leaders.length
      ? leaderRows
      : '<div class="velocity-empty">Browse individual Item Market pages. GOBLIN GOD will begin learning visible listing movement locally after stable snapshots.</div>';
    panel.innerHTML = `<div class="turnover-head"><strong>⚡ HIGH-TURNOVER TARGET LIBRARY</strong><span>Seed repeat-use items into the existing watch system. Your manual watches stay untouched.</span></div><div class="turnover-actions">${buttons}<button type="button" class="all ${allComplete ? 'complete' : ''}" data-watch-turnover-preset="all" ${allComplete ? 'disabled' : ''}><span>＋</span><strong>ADD EVERY PRESET<small>Broad scan list; profit rules still decide what is worth buying.</small></strong><span>${watchedTotal}/${union.size}</span></button></div><div class="velocity-board"><div class="velocity-board-head"><strong>LOCAL VELOCITY LEADERS</strong><span>movement signals, not confirmed sales</span></div>${velocityBoard}</div>`;
  }


  function renderFavoriteCaptureCarousel(book, traders, favorites) {
    if (!(book instanceof Element)) return;
    const favoriteSelection = favoriteCaptureSelection(traders, favorites);
    const traderSelection = savedTraderCaptureSelection(traders);
    const queue = activeFavoriteCaptureCarousel();
    renderTraderRefreshDialog(traderSelection);
    let bar = book.querySelector(`#${A.carousel}`);
    if (!bar) {
      bar = document.createElement('section');
      bar.id = A.carousel;
      const firstCard = book.querySelector('.tsimm-trader-card');
      if (firstCard) firstCard.before(bar);
      else book.appendChild(bar);
    }
    if (queue) {
      const current = queue.entries[queue.cursor] || null;
      const done = Math.min(queue.cursor, queue.entries.length);
      const label = captureQueueLabel(queue);
      bar.className = 'active';
      bar.innerHTML = `<div class="carousel-copy"><strong>↻ ${esc(label)} · ${done}/${queue.entries.length} captured</strong><span>${current ? `${queue.status === 'launched' ? 'Waiting on' : 'Next'}: ${esc(current.traderName)}` : 'Finishing queue'}${queue.lastError ? ` · ${esc(queue.lastError)}` : ''}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-resume>${queue.status === 'launched' ? 'RETRY' : 'CONTINUE'}</button>${current ? '<button type="button" data-watch-carousel-skip>SKIP</button>' : ''}<button type="button" class="cancel" data-watch-carousel-cancel>CANCEL</button></div>`;
      return;
    }
    bar.className = '';
    const favoriteSkipped = favoriteSelection.skipped ? ` · ${favoriteSelection.skipped} skipped` : '';
    const result = lastCaptureRefreshResult();
    const resultText = result
      ? ` · last ${captureQueueLabel(result).toLowerCase()}: ${result.completed.length} captured${result.failed.length ? `, ${result.failed.length} failed` : ''}`
      : '';
    bar.innerHTML = `<div class="carousel-copy"><strong>↻ TRADER PRICE CONTROL</strong><span>${favoriteSelection.ready.length}/${favoriteSelection.favoriteCount} favorites ready${favoriteSkipped} · ${traderSelection.stale.length} stale/missing · ${traderSelection.fresh.length} fresh · ${traderSelection.unsupported.length} manual · ${traderSelection.excluded.length} avoided/hidden${esc(resultText)}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-start ${favoriteSelection.ready.length ? '' : 'disabled'}>FAVORITES</button><button type="button" data-watch-bulk-open ${traderSelection.eligible.length ? '' : 'disabled'}>PRICE CHECK TRADERS</button>${result?.failed?.length ? `<button type="button" data-watch-bulk-retry>RETRY FAILURES (${result.failed.length})</button>` : ''}</div>`;
  }

  function isWatched(store, item) {
    return store.entries.some((entry) => watchEntryMatchesItem(entry, item));
  }

  function toggleWatched(item, source = 'manual') {
    const store = watchedStore();
    const index = store.entries.findIndex((entry) => watchEntryMatchesItem(entry, item));
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
    if (!singleItemMarketPage()) return null;
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
      if (!traderRecommendationEligible(trader) || !isFavorite(favorites, trader)) continue;
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
    const turnover = turnoverProfilesForItem(item)[0] || null;
    const turnoverBadge = turnover
      ? `<b class="tsimm-turnover-chip" title="${esc(turnover.description)}">${esc(turnover.icon)} ${esc(turnover.tier)} · ${esc(turnover.label)}</b>`
      : '';
    const velocity = turnoverVelocityHtml(item);
    if (!watched) {
      panel.className = 'idle';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}☆ NOT WATCHED · ${esc(item.name)}</strong><span>Watch this item across your favorite traders.</span>${velocity}</div><button type="button" data-market-watch-toggle>+ WATCH</button>`;
      return panel;
    }
    if (!favorites) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ WATCHED · NO FAVORITE TRADERS</strong><span>Star traders in the Trader Book or Deals report.</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    if (!best) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ WATCHED · NO CAPTURED EXIT</strong><span>${favorites.toLocaleString()} favorite trader${favorites === 1 ? '' : 's'} · none currently list this item.</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    panel.className = best.status;
    if (best.status === 'fresh') {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ BEST EXIT · ${esc(best.traderName)} pays ${esc(cash(best.price))} · ${esc(ageText(best.captured))} old</strong><span>${exits.length.toLocaleString()} captured favorite${exits.length === 1 ? '' : 's'} · buy below ${esc(cash(best.price))}</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else if (best.status === 'stale') {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}⌛ WATCHED REFERENCE · ${esc(best.traderName)} paid ${esc(cash(best.price))}</strong><span>${esc(ageText(best.captured))} old · recapture before buying · no signal</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}⚠ WATCHED PRICE OUTDATED · ${esc(best.traderName)}</strong><span>Last paid ${esc(cash(best.price))} · recapture before buying.</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
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
    document.querySelectorAll('.tsimm-margin-badge[data-tsimm-watch-original-html]').forEach((badge) => {
      badge.innerHTML = badge.dataset.tsimmWatchOriginalHtml || '';
      badge.classList.remove('tsimm-watch-inline-badge', 'tsimm-watch-best-exit', 'tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss', 'tsimm-watch-floor-badge', 'tsimm-watch-hidden-loss', 'tsimm-watch-roi-gold', 'tsimm-watch-roi-green', 'tsimm-watch-roi-purple', 'tsimm-watch-roi-even', 'tsimm-watch-roi-loss');
      delete badge.dataset.tsimmWatchOriginalHtml;
    });
    document.querySelectorAll('.tsimm-watch-inline[data-tsimm-watch-original-html]').forEach((line) => {
      line.innerHTML = line.dataset.tsimmWatchOriginalHtml || '';
      line.classList.remove('tsimm-watch-inline');
      delete line.dataset.tsimmWatchOriginalHtml;
      line.closest('.tsimm-margin-badge')?.classList.remove('tsimm-watch-inline-badge');
    });
    document.querySelectorAll('[data-tsimm-watch-profit],[data-tsimm-market-health]').forEach((element) => element.remove());
    document.querySelectorAll('[data-tsimm-market-health-summary]').forEach((element) => element.remove());
    document.querySelectorAll('.tsimm-watch-hidden-loss').forEach((badge) => badge.classList.remove('tsimm-watch-hidden-loss'));
    document.querySelectorAll('.tsimm-watch-profitable,.tsimm-watch-floor-row,.tsimm-watch-format-row,.tsimm-market-health-aligned-row,.tsimm-market-health-caution-row,.tsimm-market-health-danger-row,.tsimm-market-health-unknown-row').forEach((row) => {
      row.classList.remove(
        'tsimm-watch-profitable', 'tsimm-watch-floor-row', 'tsimm-watch-format-row',
        'tsimm-market-health-aligned-row', 'tsimm-market-health-caution-row',
        'tsimm-market-health-danger-row', 'tsimm-market-health-unknown-row',
      );
    });
  }

  function compactWatchCash(value) {
    const number = Number(value) || 0;
    const amount = Math.abs(number);
    const sign = number < 0 ? '-' : number > 0 ? '+' : '';
    const compact = (divisor, suffix, decimals) => {
      const rendered = (amount / divisor)
        .toFixed(decimals)
        .replace(/\.0+$|(\.[0-9]*[1-9])0+$/g, '$1');
      return `${sign}$${rendered}${suffix}`;
    };
    if (amount >= 1_000_000_000) return compact(1_000_000_000, 'b', amount < 10_000_000_000 ? 1 : 0);
    if (amount >= 1_000_000) return compact(1_000_000, 'm', amount < 10_000_000 ? 1 : 0);
    if (amount >= 1_000) return compact(1_000, 'k', amount < 10_000 ? 1 : 0);
    return `${sign}${cash(amount)}`;
  }



  function compactWatchEachCash(value) {
    const number = Number(value) || 0;
    const amount = Math.abs(number);
    const sign = number < 0 ? '-' : number > 0 ? '+' : '';
    const compact = (divisor, suffix, decimals) => {
      const rendered = (amount / divisor)
        .toFixed(decimals)
        .replace(/\.0+$|(\.[0-9]*[1-9])0+$/g, '$1');
      return `${sign}$${rendered}${suffix}`;
    };
    if (amount >= 1_000_000_000) return compact(1_000_000_000, 'b', amount < 10_000_000_000 ? 2 : 1);
    if (amount >= 1_000_000) return compact(1_000_000, 'm', amount < 10_000_000 ? 2 : 1);
    if (amount >= 1_000) return compact(1_000, 'k', amount < 10_000 ? 2 : amount < 100_000 ? 1 : 0);
    return `${sign}${cash(amount)}`;
  }


  function marketHealthForItem(item, best, rows) {
    const prices = rows.map(listingPrice).filter((price) => Number.isFinite(price) && price > 0);
    const livePrice = prices.length ? Math.min(...prices) : 0;
    const badge = rows.map((row) => row.querySelector('.tsimm-margin-badge.tsimm-badge-listing')).find(Boolean);
    const marketValue = Math.max(0, Number(badge?.dataset?.tsimmMarketValue) || 0);
    const velocity = turnoverVelocityForItem(item);
    const marketGap = livePrice > 0 && marketValue > 0 ? (livePrice - marketValue) / marketValue * 100 : null;
    const quoteGap = livePrice > 0 && Number(best?.price) > 0 ? (Number(best.price) - livePrice) / livePrice * 100 : null;
    let level = 'unknown';
    let label = 'MARKET DATA LIMITED';
    if (livePrice > 0 && marketValue > 0) {
      level = 'aligned';
      label = 'MARKET ALIGNED';
      if (best?.status === 'outdated' || (quoteGap !== null && quoteGap >= 4) || marketGap <= -6) {
        level = 'danger';
        label = best?.status === 'outdated' ? 'OUTDATED QUOTE' : 'QUOTE-LAG RISK';
      } else if (best?.status === 'stale'
        || (quoteGap !== null && quoteGap >= 1.5)
        || Math.abs(marketGap) >= 2
        || ['fast', 'frenzy'].includes(velocity.band)) {
        level = 'caution';
        label = ['fast', 'frenzy'].includes(velocity.band) ? `${velocity.label} MARKET` : 'MARKET MOVING';
      }
    }
    return { level, label, livePrice, marketValue, marketGap, quoteGap, velocity, best };
  }

  function signedMarketPercent(value) {
    if (!Number.isFinite(value)) return '—';
    const normalized = Math.abs(value) < 0.05 ? 0 : value;
    return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1)}%`;
  }

  function addMarketHealthMarker(row, health) {
    if (!(row instanceof Element)) return;
    row.classList.remove(
      'tsimm-market-health-aligned-row', 'tsimm-market-health-caution-row',
      'tsimm-market-health-danger-row', 'tsimm-market-health-unknown-row',
    );
    row.classList.add(`tsimm-market-health-${health.level}-row`);
    row.querySelector('[data-tsimm-market-health]')?.remove();
  }

  function applyMarketHealthPanel(health) {
    const panel = document.getElementById(A.panel);
    const copy = panel?.querySelector('.watch-copy');
    if (!panel || !copy) return;
    panel.classList.remove('health-aligned', 'health-caution', 'health-danger', 'health-unknown');
    panel.classList.add(`health-${health.level}`);
    copy.querySelector('[data-tsimm-market-health-summary]')?.remove();
    const summary = document.createElement('span');
    summary.dataset.tsimmMarketHealthSummary = '1';
    summary.className = `tsimm-market-health-summary ${health.level}`;
    const live = health.livePrice > 0 ? cash(health.livePrice) : '—';
    const market = health.marketValue > 0 ? cash(health.marketValue) : '—';
    const quote = Number(health.best?.price) > 0 ? cash(health.best.price) : '—';
    const gap = Number.isFinite(health.quoteGap) ? ` · quote ${signedMarketPercent(health.quoteGap)} vs live` : '';
    summary.textContent = `${health.label} · LIVE ${live} · MV ${market} · EXIT ${quote}${gap}`;
    copy.appendChild(summary);
  }

  function addProfitMarker(row, traderProfit, traderName = '', breakEvenPrice = 0, isFloor = false) {
    const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing')
      || row.querySelector('.tsimm-margin-badge');
    const profitEach = Number(traderProfit);
    if (!Number.isFinite(profitEach)) return false;
    const traderLabel = clean(traderName).slice(0, 18) || 'trader';
    const signedCash = (value) => value > 0 ? `+${cash(value)}` : cash(value);
    const entryPrice = Math.max(0, Number(badge?.dataset?.tsimmListingPrice) || listingPrice(row) || 0);
    const roiPercent = entryPrice > 0 ? profitEach / entryPrice * 100 : 0;
    const roiClass = profitEach < 0
      ? 'tsimm-watch-roi-loss'
      : profitEach === 0
        ? 'tsimm-watch-roi-even'
        : roiPercent >= 4
          ? 'tsimm-watch-roi-gold'
          : roiPercent >= 2.5
            ? 'tsimm-watch-roi-green'
            : 'tsimm-watch-roi-purple';
    const roiText = entryPrice > 0 ? `${roiPercent.toFixed(2)}%` : 'ROI —';
    const exitPrice = breakEvenPrice > 0 ? breakEvenPrice : Math.max(0, entryPrice + profitEach);
    const eachText = profitEach === 0 ? '$0 ea' : `${compactWatchEachCash(profitEach)} ea`;

    if (badge) {
      if (!badge.dataset.tsimmWatchOriginalHtml) badge.dataset.tsimmWatchOriginalHtml = badge.innerHTML;
      const quantity = Math.max(1, Math.floor(Number(badge.dataset.tsimmQuantity) || 1));
      const totalProfit = profitEach * quantity;
      const lotText = totalProfit === 0 ? 'lot $0' : `lot ${compactWatchCash(totalProfit)}`;
      badge.innerHTML = `<strong>${esc(roiText)} · ${esc(eachText)}</strong>`
        + `<span class="tsimm-listing-lot">${esc(lotText)}</span>`;
      badge.classList.remove(
        'tsimm-tier-npc', 'tsimm-tier-gold', 'tsimm-tier-good', 'tsimm-tier-minor', 'tsimm-tier-loss',
        'tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss',
        'tsimm-watch-floor-badge', 'tsimm-watch-hidden-loss',
        'tsimm-watch-roi-gold', 'tsimm-watch-roi-green', 'tsimm-watch-roi-purple',
        'tsimm-watch-roi-even', 'tsimm-watch-roi-loss',
      );
      badge.classList.add('tsimm-watch-inline-badge', 'tsimm-watch-best-exit', roiClass);
      badge.title = `${traderLabel} exit ${cash(exitPrice)} · buy ${cash(entryPrice)} · ${roiText} ROI${isFloor ? ' · first row at or below the exit' : ''}`;
      row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
      return true;
    }

    const marker = document.createElement('span');
    marker.className = `tsimm-watch-profit ${roiClass}`;
    marker.dataset.tsimmWatchProfit = '1';
    marker.textContent = `${roiText} · ${eachText}`;
    marker.title = `${traderLabel} exit ${cash(exitPrice)} · buy ${cash(entryPrice)} · ${roiText} ROI${isFloor ? ' · first row at or below the exit' : ''}`;
    row.appendChild(marker);
    row.classList.add('tsimm-watch-format-row');
    row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
    return true;
  }

  function validWatchListingRow(row) {
    if (!(row instanceof Element) || !row.isConnected || !visible(row)) return false;
    if (row.closest(`#${A.deals},#${A.dock},#${A.panel},[data-tsimm-generated],header,nav`)) return false;
    const quickMax = row.querySelector('[data-tsimm-quick-max]');
    const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing');
    if (!quickMax || !badge) return false;
    const quantity = Math.floor(Number(badge.dataset.tsimmQuantity) || 0);
    if (quantity <= 0) return false;
    const price = listingPrice(row);
    return Number.isFinite(price) && price > 0;
  }

  function decorateMarket() {
    cleanupMarket();
    if (!singleItemMarketPage()) {
      document.getElementById(A.panel)?.remove();
      return;
    }
    const item = currentMarketItem();
    if (!item) {
      document.getElementById(A.panel)?.remove();
      return;
    }
    maybeCaptureTurnoverSnapshot(item);
    const watched = isWatched(watchedStore(), item);
    const exits = watched ? exitsForItem(item) : [];
    const best = bestExit(exits);
    const rows = [...document.querySelectorAll('.tsimm-listing-mark')].filter(validWatchListingRow);
    const health = marketHealthForItem(item, best, rows);
    renderWatchPanel(item, exits);
    applyMarketHealthPanel(health);
    if (watched && best && best.status === 'fresh') {
      let floorPlaced = false;
      for (const row of rows) {
        const price = listingPrice(row);
        if (!(price > 0)) continue;
        const traderProfit = best.price - price;
        const isFloorRow = traderProfit <= 0 && !floorPlaced;
        if (isFloorRow) {
          row.classList.add('tsimm-watch-floor-row');
          floorPlaced = true;
        }
        addProfitMarker(row, traderProfit, best.traderName, best.price, isFloorRow);
      }
    }
    for (const row of rows) addMarketHealthMarker(row, health);
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
    renderTurnoverPresetPanel(book);
    renderFavoriteCaptureCarousel(book, traders, favorites);
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
        button.dataset.tsimmAction = 'trader-toggle-favorite';
        button.className = 'tsimm-favorite-trader-btn';
        const actions = card.querySelector('.tsimm-trader-actions') || card;
        actions.prepend(button);
      }
      const favorite = isFavorite(favorites, trader);
      applyFavoriteButtonState(button, favorite, 'book');
      button.dataset.trader = trader.id;
      button.dataset.tsimmTraderId = trader.id;
      const eligible = traderRecommendationEligible(trader);
      button.disabled = !eligible;
      if (!eligible) {
        button.textContent = trader.disposition === 'hidden' ? '◌ HIDDEN' : '⚠ AVOIDED';
        button.title = 'Restore this trader to active before using favorites or automatic comparisons.';
      } else {
        button.removeAttribute('title');
      }
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
        const turnoverPreset = event.target.closest?.('[data-watch-turnover-preset]');
        if (turnoverPreset) {
          event.preventDefault();
          event.stopImmediatePropagation();
          addTurnoverPreset(clean(turnoverPreset.dataset.watchTurnoverPreset));
          return;
        }
        const bulkOpen = event.target.closest?.('[data-watch-bulk-open]');
        if (bulkOpen) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openTraderRefreshDialog();
          return;
        }
        const bulkStart = event.target.closest?.('[data-watch-bulk-start]');
        if (bulkStart) {
          event.preventDefault();
          event.stopImmediatePropagation();
          startSavedTraderCaptureCarousel(clean(bulkStart.dataset.watchBulkStart) === 'all' ? 'all' : 'stale');
          return;
        }
        const bulkCancel = event.target.closest?.('[data-watch-bulk-cancel]');
        if (bulkCancel) {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeTraderRefreshDialog();
          return;
        }
        const bulkRetry = event.target.closest?.('[data-watch-bulk-retry]');
        if (bulkRetry) {
          event.preventDefault();
          event.stopImmediatePropagation();
          retryFailedTraderCaptureCarousel();
          return;
        }
        const carouselSkip = event.target.closest?.('[data-watch-carousel-skip]');
        if (carouselSkip) {
          event.preventDefault();
          event.stopImmediatePropagation();
          skipCurrentCaptureCarousel();
          return;
        }
        const carouselStart = event.target.closest?.('[data-watch-carousel-start]');
        if (carouselStart) {
          event.preventDefault();
          event.stopImmediatePropagation();
          startFavoriteCaptureCarousel();
          return;
        }
        const carouselResume = event.target.closest?.('[data-watch-carousel-resume]');
        if (carouselResume) {
          event.preventDefault();
          event.stopImmediatePropagation();
          launchFavoriteCaptureCarousel();
          return;
        }
        const carouselCancel = event.target.closest?.('[data-watch-carousel-cancel]');
        if (carouselCancel) {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancelFavoriteCaptureCarousel();
          return;
        }
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
      continueFavoriteCaptureCarousel(EARLY_CAPTURE_NOTICE);
      scheduleTorn();
    };
    start();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.__TSIMM_WATCHLIST_API__ = {
      version: APP.version,
      decorateBook,
      startFavoriteCaptureCarousel,
      launchFavoriteCaptureCarousel,
      cancelFavoriteCaptureCarousel,
      openTraderRefreshDialog,
      startSavedTraderCaptureCarousel,
      retryFailedTraderCaptureCarousel,
      skipCurrentCaptureCarousel,
      addTurnoverPreset,
      turnoverProfilesForItem,
      turnoverVelocityForItem,
      turnoverLeaderboard,
      maybeCaptureTurnoverSnapshot,
      toggleFavoriteById(traderId) {
        const trader = normTraders().find((candidate) => candidate.id === clean(traderId));
        if (!trader) return { available: false, favorite: false, traderName: '' };
        const favorite = toggleFavorite(trader);
        scheduleTorn();
        return { available: true, favorite, traderName: trader.name };
      },
      status() {
        return { ready: true, version: APP.version, hostname: location.hostname };
      },
    };
    try {
      boot();
    } catch (error) {
      console.error('[TornScripture IMM] Favorite watchlist boot failed:', error);
      setTimeout(() => {
        try {
          injectStyle();
          scheduleTorn();
        } catch (retryError) {
          console.error('[TornScripture IMM] Favorite watchlist fallback failed:', retryError);
        }
      }, 120);
    }
  }
})();
  }

})();
