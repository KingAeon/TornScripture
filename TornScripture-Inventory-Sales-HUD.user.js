// ==UserScript==
// @name         TornScripture - Inventory Sales HUD
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.2.0
// @description  Scans your Torn inventory on demand, excludes equipment, and builds local keep/trader/store/trash sale plans.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/TornScripture-Inventory-Sales-HUD.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/TornScripture-Inventory-Sales-HUD.user.js
// ==/UserScript==

(() => {
  'use strict';

  /*
   * TORNSCRIPTURE - INVENTORY SALES HUD v0.2.0
   *
   * SAFETY BOUNDARY
   * - Inventory API calls happen only after the user presses Scan.
   * - The API key and inventory remain in this browser's local storage.
   * - The key is sent only to Torn's official API.
   * - Price configuration contains no API key or inventory data.
   * - Weapons and armor are locked in Excluded Equipment.
   * - The script never sells, sends, lists, or trashes an item.
   */

  const APP = Object.freeze({
    name: 'Inventory Sales HUD',
    shortName: 'ISH',
    version: '0.2.0',
    apiUrl: 'https://api.torn.com/v2/user/inventory',
    catalogApiBase: 'https://api.torn.com/v2/torn',
    apiKeyStorageKey: 'tornscripture-ish-api-key-v1',
    settingsStorageKey: 'tornscripture-ish-settings-v1',
    rulesStorageKey: 'tornscripture-ish-rules-v1',
    inventoryStorageKey: 'tornscripture-ish-inventory-v1',
    catalogStorageKey: 'tornscripture-ish-torn-catalog-v1',
    priceStorageKey: 'tornscripture-ish-price-config-v1',
    panelId: 'tornscripture-ish-panel',
    overlayId: 'tornscripture-ish-overlay',
    settingsId: 'tornscripture-ish-settings',
    styleId: 'tornscripture-ish-style',
    pageSize: 100,
    maxPagesPerCategory: 10,
    catalogBatchSize: 50,
    defaultPriceConfigUrl:
      'https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/data/trader-prices.json',
  });

  // Canonical values from Torn's /user/inventory `cat` enum. The endpoint
  // returns one category at a time; omitting `cat` produces "Incorrect category".
  const INVENTORY_CATEGORIES = Object.freeze([
    'Collectible',
    'Clothing',
    'Other',
    'Tool',
    'Melee',
    'Defensive',
    'Material',
    'Car',
    'Primary',
    'Secondary',
    'Book',
    'Special',
    'Supply Pack',
    'Temporary',
    'Enhancer',
    'Artifact',
    'Flower',
    'Booster',
    'Medical',
    'Candy',
    'Jewelry',
    'Alcohol',
    'Plushie',
    'Drug',
    'Energy Drink',
  ]);

  // TornPDA replaces this placeholder with the key stored in the app.
  const PDA_API_KEY = '###PDA-APIKEY###';
  const ACTIONS = Object.freeze(['keep', 'trader', 'store', 'trash', 'review', 'excluded']);
  const ACTION_LABELS = Object.freeze({
    keep: 'Keep',
    trader: 'Sell to Trader',
    store: 'Sell to Store',
    trash: 'Trash',
    review: 'Needs Review',
    excluded: 'Excluded Equipment',
  });
  const DEFAULT_SETTINGS = Object.freeze({
    collapsed: false,
    priceConfigUrl: APP.defaultPriceConfigUrl,
    selectedTab: 'all',
    search: '',
  });
  const EMPTY_PRICE_CONFIG = Object.freeze({
    schema: 'tornscripture-trader-prices',
    schemaVersion: 1,
    updatedAt: null,
    traders: [],
    items: {},
  });
  const EMPTY_CATALOG = Object.freeze({
    updatedAt: null,
    items: {},
  });

  const state = {
    settings: loadJson(APP.settingsStorageKey, DEFAULT_SETTINGS),
    rules: loadJson(APP.rulesStorageKey, {}),
    inventory: loadJson(APP.inventoryStorageKey, []),
    catalog: normalizeCatalog(loadJson(APP.catalogStorageKey, EMPTY_CATALOG)),
    priceConfig: normalizePriceConfig(loadJson(APP.priceStorageKey, EMPTY_PRICE_CONFIG)),
    scanning: false,
    scanProgress: '',
    initialized: false,
  };

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (parsed === null || typeof parsed !== typeof fallback) return structuredCloneSafe(fallback);
      return parsed;
    } catch {
      return structuredCloneSafe(fallback);
    }
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatMoney(value) {
    const number = Number(value) || 0;
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(number);
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function pdaApiKey() {
    const value = normalizeWhitespace(PDA_API_KEY);
    if (!value || /^###.+###$/.test(value)) return '';
    return value;
  }

  function storedApiKey() {
    return normalizeWhitespace(localStorage.getItem(APP.apiKeyStorageKey));
  }

  function currentApiKey() {
    return pdaApiKey() || storedApiKey();
  }

  function apiKeySource() {
    if (pdaApiKey()) return 'TornPDA managed key';
    if (storedApiKey()) return 'Local browser key';
    return 'Not connected';
  }

  function looksLikeApiKey(value) {
    return /^[A-Za-z0-9_-]{8,128}$/.test(normalizeWhitespace(value));
  }

  function apiErrorMessage(payload, response) {
    const error = payload?.error;
    if (typeof error === 'string') return error;
    if (error?.error) return String(error.error);
    if (error?.message) return String(error.message);
    if (payload?.message) return String(payload.message);
    return `Torn API request failed (${response?.status || 'unknown status'}).`;
  }

  function extractInventoryItems(payload) {
    const inventory = payload?.inventory;
    if (Array.isArray(inventory)) return inventory;
    if (Array.isArray(inventory?.items)) return inventory.items;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  function extractInventoryTotal(payload) {
    const candidates = [
      payload?.inventory?.total,
      payload?.inventory?.count,
      payload?._metadata?.total,
      payload?.metadata?.total,
      payload?.pagination?.total,
    ];
    const found = candidates.map(Number).find(Number.isFinite);
    return found ?? null;
  }

  function normalizeApiItem(raw, fallbackCategory = 'Unknown') {
    const detail = raw?.item && typeof raw.item === 'object' ? raw.item : raw || {};
    const id = Number(raw?.id ?? raw?.item_id ?? detail?.id ?? detail?.item_id);
    const amount = Math.max(0, Number(raw?.amount ?? raw?.quantity ?? 1) || 0);
    const category = normalizeWhitespace(
      raw?.category ?? raw?.type ?? detail?.category ?? detail?.type ?? fallbackCategory
    ) || 'Unknown';
    const name = normalizeWhitespace(raw?.name ?? detail?.name) || (id ? `Item ${id}` : 'Unknown item');
    const uid = raw?.uid ?? detail?.uid ?? null;
    const equipped = Boolean(raw?.equipped ?? detail?.equipped);
    const factionOwned = Boolean(raw?.faction_owned ?? detail?.faction_owned);

    return {
      itemId: Number.isFinite(id) && id > 0 ? id : null,
      name,
      category,
      amount,
      uid: uid === undefined ? null : uid,
      equipped,
      factionOwned,
    };
  }

  function isEquipmentCategory(category) {
    const normalized = normalizeWhitespace(category).toLowerCase();
    return /(?:^|\s)(?:armor|armour|weapon)(?:$|\s)/i.test(normalized) ||
      ['primary', 'secondary', 'melee', 'temporary', 'defensive'].includes(normalized);
  }

  function isEquipmentItem(item) {
    return isEquipmentCategory(item?.category) || Boolean(item?.equipped) || item?.uid != null;
  }

  function aggregateInventory(rawItems) {
    const aggregates = new Map();
    for (const raw of rawItems) {
      const item = raw?.itemId !== undefined ? raw : normalizeApiItem(raw);
      if (!item.itemId || item.amount <= 0) continue;
      const equipment = isEquipmentItem(item);
      const key = equipment && item.uid
        ? `${item.itemId}:uid:${item.uid}`
        : `${item.itemId}:stack`;
      const existing = aggregates.get(key);
      if (existing) {
        existing.amount += item.amount;
        existing.instanceCount += 1;
        existing.equipped ||= item.equipped;
        existing.factionOwned ||= item.factionOwned;
      } else {
        aggregates.set(key, { ...item, instanceCount: 1 });
      }
    }
    return [...aggregates.values()].sort((a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  }

  function nullableNonNegativeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : null;
  }

  function normalizeCatalogItem(raw) {
    const id = Number(raw?.itemId ?? raw?.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    const value = raw?.value && typeof raw.value === 'object' ? raw.value : {};
    const vendor = value.vendor && typeof value.vendor === 'object' ? value.vendor : {};
    return {
      itemId: id,
      name: normalizeWhitespace(raw?.name),
      type: normalizeWhitespace(raw?.type),
      marketPrice: nullableNonNegativeNumber(raw?.marketPrice ?? value.market_price) ?? 0,
      shopBuyPrice: nullableNonNegativeNumber(raw?.shopBuyPrice ?? value.buy_price),
      shopSellPrice: nullableNonNegativeNumber(raw?.shopSellPrice ?? value.sell_price),
      vendorName: normalizeWhitespace(raw?.vendorName ?? vendor.name),
      vendorCountry: normalizeWhitespace(raw?.vendorCountry ?? vendor.country),
      isTradable: Boolean(raw?.isTradable ?? raw?.is_tradable),
      circulation: nullableNonNegativeNumber(raw?.circulation),
    };
  }

  function normalizeCatalog(value) {
    const normalized = {
      updatedAt: value?.updatedAt || null,
      items: {},
    };
    const sourceItems = value?.items && typeof value.items === 'object' ? value.items : {};
    const entries = Array.isArray(sourceItems)
      ? sourceItems.map((item) => [String(item?.id ?? ''), item])
      : Object.entries(sourceItems);
    for (const [key, raw] of entries) {
      const item = normalizeCatalogItem({ ...raw, itemId: raw?.itemId ?? Number(key) });
      if (item) normalized.items[String(item.itemId)] = item;
    }
    return normalized;
  }

  function catalogRecord(itemId) {
    return state.catalog.items?.[String(itemId)] || null;
  }

  function normalizePriceConfig(value) {
    if (!isPriceConfig(value)) {
      return structuredCloneSafe(EMPTY_PRICE_CONFIG);
    }
    const traders = Array.isArray(value.traders)
      ? value.traders
          .filter((trader) => trader?.id && trader?.name)
          .map((trader) => ({
            id: String(trader.id),
            name: normalizeWhitespace(trader.name),
            active: trader.active !== false,
            website: normalizeWhitespace(trader.website),
            updatedAt: trader.updatedAt || null,
          }))
      : [];
    const items = value.items && typeof value.items === 'object' && !Array.isArray(value.items)
      ? value.items
      : {};
    return {
      schema: 'tornscripture-trader-prices',
      schemaVersion: 1,
      updatedAt: value.updatedAt || null,
      traders,
      items,
    };
  }

  function isPriceConfig(value) {
    return Boolean(
      value &&
      value.schema === 'tornscripture-trader-prices' &&
      Number(value.schemaVersion) === 1 &&
      Array.isArray(value.traders) &&
      value.items &&
      typeof value.items === 'object' &&
      !Array.isArray(value.items)
    );
  }

  function itemPriceRecord(itemId) {
    return state.priceConfig.items?.[String(itemId)] || {};
  }

  function mergeItemPrices(configured = {}, catalog = null) {
    const catalogMarket = nullableNonNegativeNumber(catalog?.marketPrice);
    const catalogSell = nullableNonNegativeNumber(catalog?.shopSellPrice);
    return {
      marketPrice: catalogMarket && catalogMarket > 0
        ? catalogMarket
        : nullableNonNegativeNumber(configured.marketValue) ?? 0,
      shopSellPrice: catalogSell !== null
        ? catalogSell
        : nullableNonNegativeNumber(configured.citySellPrice) ?? 0,
      shopBuyPrice: nullableNonNegativeNumber(catalog?.shopBuyPrice),
      catalog,
    };
  }

  function effectivePrices(itemId) {
    return mergeItemPrices(itemPriceRecord(itemId), catalogRecord(itemId));
  }

  function activeTraders() {
    return state.priceConfig.traders.filter((trader) => trader.active !== false);
  }

  function bestTraderFor(itemId) {
    const priceRecord = itemPriceRecord(itemId);
    const traderPrices = priceRecord.traderPrices && typeof priceRecord.traderPrices === 'object'
      ? priceRecord.traderPrices
      : {};
    let best = null;
    for (const trader of activeTraders()) {
      const unitPrice = Number(traderPrices[trader.id]) || 0;
      if (unitPrice > 0 && (!best || unitPrice > best.unitPrice)) {
        best = { ...trader, unitPrice };
      }
    }
    return best;
  }

  function rememberedRule(itemId) {
    const rule = state.rules?.[String(itemId)];
    return rule && typeof rule === 'object' ? rule : null;
  }

  function classificationFor(item) {
    if (isEquipmentItem(item)) return 'excluded';
    const remembered = rememberedRule(item.itemId);
    if (ACTIONS.includes(remembered?.action) && remembered.action !== 'excluded') {
      return remembered.action;
    }
    const record = itemPriceRecord(item.itemId);
    if (ACTIONS.includes(record.classification) && record.classification !== 'excluded') {
      return record.classification;
    }
    const best = bestTraderFor(item.itemId);
    const storePrice = effectivePrices(item.itemId).shopSellPrice;
    if (best?.unitPrice > 0 && best.unitPrice >= storePrice) return 'trader';
    if (storePrice > 0) return 'store';
    return 'review';
  }

  function keepQuantityFor(item) {
    const value = Number(rememberedRule(item.itemId)?.keepQuantity) || 0;
    return Math.max(0, Math.min(item.amount, value));
  }

  function saleQuantityFor(item) {
    const action = classificationFor(item);
    if (action === 'keep' || action === 'review' || action === 'excluded') return 0;
    return Math.max(0, item.amount - keepQuantityFor(item));
  }

  function itemView(item) {
    const action = classificationFor(item);
    const quantity = saleQuantityFor(item);
    const bestTrader = bestTraderFor(item.itemId);
    const prices = effectivePrices(item.itemId);
    const marketValue = prices.marketPrice;
    const citySellPrice = prices.shopSellPrice;
    let unitPrice = 0;
    let destination = ACTION_LABELS[action];
    if (action === 'trader' && bestTrader) {
      unitPrice = bestTrader.unitPrice;
      destination = bestTrader.name;
    } else if (action === 'store') {
      unitPrice = citySellPrice;
      destination = prices.catalog?.vendorName
        ? `${prices.catalog.vendorName} shop`
        : ACTION_LABELS.store;
    }
    return {
      ...item,
      action,
      quantity,
      keepQuantity: keepQuantityFor(item),
      bestTrader,
      marketValue,
      citySellPrice,
      shopBuyPrice: prices.shopBuyPrice,
      vendorName: prices.catalog?.vendorName || '',
      vendorCountry: prices.catalog?.vendorCountry || '',
      isTradable: prices.catalog?.isTradable ?? null,
      circulation: prices.catalog?.circulation ?? null,
      marketTotal: item.amount * marketValue,
      unitPrice,
      total: quantity * unitPrice,
      destination,
    };
  }

  function inventoryViews() {
    return aggregateInventory(state.inventory).map(itemView);
  }

  function inventoryRequestUrl(category, offset) {
    const url = new URL(APP.apiUrl);
    url.searchParams.set('cat', category);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(APP.pageSize));
    url.searchParams.set('comment', 'TornScripture Inventory Sales HUD');
    return url;
  }

  async function fetchInventoryPage(key, category, offset) {
    const url = inventoryRequestUrl(category, offset);
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
      throw new Error(`Torn API returned unreadable data (${response.status}).`);
    }
    if (!response.ok || payload?.error) throw new Error(apiErrorMessage(payload, response));
    return payload;
  }

  function catalogRequestUrl(itemIds) {
    const ids = [...new Set(itemIds.map(Number))]
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length) throw new Error('No valid item IDs were supplied for Torn price lookup.');
    const url = new URL(`${APP.catalogApiBase}/${ids.join(',')}/items`);
    url.searchParams.set('comment', 'TornScripture Inventory Sales HUD');
    return url;
  }

  async function fetchCatalogBatch(key, itemIds) {
    const response = await fetch(catalogRequestUrl(itemIds), {
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
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async function refreshTornCatalog(key, inventory = state.inventory) {
    const ids = [...new Set(inventory.map((item) => Number(item?.itemId)).filter((id) => id > 0))];
    if (!ids.length) {
      state.catalog = structuredCloneSafe(EMPTY_CATALOG);
      saveJson(APP.catalogStorageKey, state.catalog);
      return 0;
    }
    const batches = [];
    for (let index = 0; index < ids.length; index += APP.catalogBatchSize) {
      batches.push(ids.slice(index, index + APP.catalogBatchSize));
    }
    const items = {};
    for (let index = 0; index < batches.length; index += 1) {
      state.scanProgress = `prices ${index + 1}/${batches.length}`;
      renderPanel();
      renderOverlay();
      const returned = await fetchCatalogBatch(key, batches[index]);
      for (const raw of returned) {
        const item = normalizeCatalogItem(raw);
        if (item) items[String(item.itemId)] = item;
      }
    }
    state.catalog = {
      updatedAt: new Date().toISOString(),
      items,
    };
    saveJson(APP.catalogStorageKey, state.catalog);
    return Object.keys(items).length;
  }

  async function refreshTornCatalogOnly() {
    if (state.scanning) return;
    const key = currentApiKey();
    if (!key) {
      openSettings();
      toast('Connect a Limited Access API key before refreshing Torn prices.');
      return;
    }
    if (!state.inventory.length) {
      toast('Scan inventory first so there are item IDs to price.');
      return;
    }
    state.scanning = true;
    state.scanProgress = 'prices';
    renderPanel();
    renderOverlay();
    try {
      const count = await refreshTornCatalog(key);
      renderPanel();
      renderOverlay();
      toast(`Updated ${count} Torn item price records.`);
    } finally {
      state.scanning = false;
      state.scanProgress = '';
      renderPanel();
      renderOverlay();
    }
  }

  async function scanInventory() {
    if (state.scanning) return;
    const key = currentApiKey();
    if (!key) {
      openSettings();
      toast('Connect a Limited Access API key before scanning.');
      return;
    }
    state.scanning = true;
    state.scanProgress = '';
    renderPanel();
    try {
      const rawItems = [];
      for (let categoryIndex = 0; categoryIndex < INVENTORY_CATEGORIES.length; categoryIndex += 1) {
        const category = INVENTORY_CATEGORIES[categoryIndex];
        state.scanProgress = `${categoryIndex + 1}/${INVENTORY_CATEGORIES.length}`;
        renderPanel();
        renderOverlay();
        let offset = 0;
        let categoryItemCount = 0;
        for (let page = 0; page < APP.maxPagesPerCategory; page += 1) {
          let payload;
          try {
            payload = await fetchInventoryPage(key, category, offset);
          } catch (error) {
            throw new Error(`${category} inventory: ${error?.message || String(error)}`);
          }
          const items = extractInventoryItems(payload);
          rawItems.push(...items.map((item) => normalizeApiItem(item, category)));
          categoryItemCount += items.length;
          const total = extractInventoryTotal(payload);
          if (
            !items.length ||
            items.length < APP.pageSize ||
            (total !== null && categoryItemCount >= total)
          ) break;
          offset += items.length;
        }
      }
      state.inventory = rawItems;
      saveJson(APP.inventoryStorageKey, state.inventory);
      state.settings.lastScanAt = new Date().toISOString();
      saveJson(APP.settingsStorageKey, state.settings);
      let catalogCount = 0;
      let catalogError = null;
      try {
        catalogCount = await refreshTornCatalog(key, rawItems);
      } catch (error) {
        catalogError = error;
        console.warn(`[${APP.shortName}] Torn catalog`, error);
      }
      renderPanel();
      renderOverlay();
      if (catalogError) {
        toast(`Inventory saved, but Torn prices failed: ${catalogError?.message || String(catalogError)}`);
      } else {
        toast(`Scanned ${inventoryViews().length} stacks and priced ${catalogCount} items.`);
      }
    } finally {
      state.scanning = false;
      state.scanProgress = '';
      renderPanel();
      renderOverlay();
    }
  }

  function inferVisibleCategory(element) {
    const section = element.closest?.('[data-category], [class*="category" i], section');
    const explicit = section?.getAttribute?.('data-category');
    if (explicit) return normalizeWhitespace(explicit);
    const heading = section?.querySelector?.('h1, h2, h3, [class*="title" i]');
    return normalizeWhitespace(heading?.textContent) || 'Unknown';
  }

  function parseVisibleItemId(element) {
    const values = [
      element.getAttribute?.('data-item-id'),
      element.getAttribute?.('data-itemid'),
      element.getAttribute?.('data-id'),
      element.querySelector?.('a[href*="item"]')?.getAttribute?.('href'),
      element.innerHTML,
    ];
    for (const value of values) {
      const match = String(value || '').match(/(?:item(?:id|_id)?[=:"'\s]+|ID=)(\d+)/i);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function scanVisibleInventory() {
    const selectors = [
      '[data-item-id]',
      '[data-itemid]',
      '[class*="item" i][data-id]',
      'li[class*="item" i]',
      'div[class*="item" i]',
    ];
    const found = new Map();
    for (const element of document.querySelectorAll(selectors.join(','))) {
      const itemId = parseVisibleItemId(element);
      if (!itemId) continue;
      const text = normalizeWhitespace(element.innerText);
      if (!text || text.length > 800) continue;
      const name = normalizeWhitespace(
        element.getAttribute('data-name') ||
        element.querySelector('[class*="name" i]')?.textContent ||
        element.querySelector('img[alt]')?.getAttribute('alt') ||
        element.getAttribute('title') ||
        text.split(/\n| x\d+| ×\d+/i)[0]
      );
      const amountMatch = text.match(/(?:amount|quantity|qty)\s*:?\s*(\d[\d,]*)|(?:x|×)\s*(\d[\d,]*)/i);
      const amount = Number((amountMatch?.[1] || amountMatch?.[2] || '1').replaceAll(',', '')) || 1;
      const item = normalizeApiItem({
        id: itemId,
        name,
        amount,
        category: inferVisibleCategory(element),
      });
      const existing = found.get(itemId);
      if (!existing || item.amount > existing.amount) found.set(itemId, item);
    }
    if (!found.size) {
      toast('No reliable item rows were found. Use the API scan or scroll the inventory page first.');
      return;
    }
    state.inventory = [...found.values()];
    saveJson(APP.inventoryStorageKey, state.inventory);
    state.settings.lastScanAt = new Date().toISOString();
    saveJson(APP.settingsStorageKey, state.settings);
    renderPanel();
    renderOverlay();
    toast(`Captured ${found.size} visible item stacks.`);
  }

  async function loadPriceConfigFromUrl(showToast = true) {
    const url = normalizeWhitespace(state.settings.priceConfigUrl);
    if (!url) throw new Error('Enter a price configuration URL first.');
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`Price configuration request failed (${response.status}).`);
    const parsed = await response.json();
    if (!isPriceConfig(parsed)) throw new Error('The URL did not return a compatible TornScripture price file.');
    const config = normalizePriceConfig(parsed);
    state.priceConfig = config;
    saveJson(APP.priceStorageKey, state.priceConfig);
    renderPanel();
    renderOverlay();
    if (showToast) toast(`Loaded ${Object.keys(config.items).length} priced items.`);
  }

  function importPriceConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!isPriceConfig(parsed)) throw new Error('That is not a compatible TornScripture trader-price file.');
        const normalized = normalizePriceConfig(parsed);
        state.priceConfig = normalized;
        saveJson(APP.priceStorageKey, state.priceConfig);
        renderPanel();
        renderOverlay();
        toast(`Imported ${Object.keys(normalized.items).length} priced items.`);
      } catch (error) {
        reportError(error);
      }
    });
    input.click();
  }

  function setItemRule(itemId, action, keepQuantity = 0) {
    if (!ACTIONS.includes(action) || action === 'excluded') return;
    state.rules[String(itemId)] = {
      action,
      keepQuantity: Math.max(0, Number(keepQuantity) || 0),
      updatedAt: new Date().toISOString(),
    };
    saveJson(APP.rulesStorageKey, state.rules);
    renderPanel();
    renderOverlay();
  }

  function exportRules() {
    const payload = {
      schema: 'tornscripture-inventory-rules',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      rules: state.rules,
    };
    downloadJson(payload, `tornscripture-inventory-rules-${Date.now()}.json`);
  }

  function downloadJson(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function writeClipboard(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard access is unavailable.');
  }

  function summaryFor(views) {
    return {
      stacks: views.length,
      units: views.reduce((sum, item) => sum + item.amount, 0),
      marketWorth: views.reduce((sum, item) => sum + item.marketTotal, 0),
      payout: views.reduce((sum, item) => sum + item.total, 0),
      review: views.filter((item) => item.action === 'review').length,
      excluded: views.filter((item) => item.action === 'excluded').length,
    };
  }

  function planGroups(views) {
    const traders = new Map();
    const store = [];
    const trash = [];
    for (const item of views) {
      if (item.action === 'trader' && item.bestTrader && item.quantity > 0) {
        if (!traders.has(item.bestTrader.id)) {
          traders.set(item.bestTrader.id, { trader: item.bestTrader, items: [], total: 0 });
        }
        const group = traders.get(item.bestTrader.id);
        group.items.push(item);
        group.total += item.total;
      } else if (item.action === 'store' && item.quantity > 0) {
        store.push(item);
      } else if (item.action === 'trash') {
        trash.push(item);
      }
    }
    return { traders: [...traders.values()], store, trash };
  }

  function traderMessage(group) {
    const lines = group.items.map(
      (item) => `${item.quantity} × ${item.name} @ ${formatMoney(item.unitPrice)} = ${formatMoney(item.total)}`
    );
    return `Hey, I'm selling:\n${lines.join('\n')}\nTotal: ${formatMoney(group.total)}`;
  }

  function injectStyles() {
    if (document.getElementById(APP.styleId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      :root{--ish-navy:#18243a;--ish-blue:#243b5a;--ish-teal:#10b7a5;--ish-bg:#f4f7fb;--ish-card:#fff;--ish-line:#c9d2df;--ish-ink:#18212f;--ish-muted:#5b677a;--ish-green:#177245;--ish-red:#b42318;--ish-gold:#9a5a00}
      #${APP.panelId}{position:fixed;right:10px;bottom:132px;width:min(330px,calc(100vw - 20px));z-index:2147483000;background:var(--ish-card);color:var(--ish-ink);border:1px solid var(--ish-line);border-radius:13px;box-shadow:0 12px 32px #0004;font:13px/1.35 Arial,sans-serif;overflow:hidden}
      #${APP.panelId} *{box-sizing:border-box} .ish-mini-head{display:flex;align-items:center;gap:8px;padding:10px 11px;background:var(--ish-navy);color:#fff}.ish-mini-head strong{flex:1}.ish-mini-head button,.ish-btn{border:0;border-radius:8px;padding:8px 10px;background:var(--ish-blue);color:#fff;font-weight:700;cursor:pointer}.ish-mini-head button{padding:3px 7px}.ish-mini-body{padding:10px}.ish-mini-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:9px}.ish-mini-stat{background:#e8f0fa;border-radius:8px;padding:7px;text-align:center}.ish-mini-stat strong{display:block;font-size:15px}.ish-mini-actions{display:flex;flex-wrap:wrap;gap:6px}.ish-btn.primary{background:var(--ish-teal);color:#082b28}.ish-btn.light{background:#e8f0fa;color:var(--ish-ink)}.ish-btn.danger{background:#fce3e3;color:var(--ish-red)}.ish-muted{color:var(--ish-muted);font-size:11px}
      #${APP.overlayId},#${APP.settingsId}{position:fixed;inset:0;z-index:2147483200;background:var(--ish-bg);color:var(--ish-ink);font:14px/1.4 Arial,sans-serif;overflow:auto}#${APP.overlayId} *,#${APP.settingsId} *{box-sizing:border-box}.ish-topbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:9px;padding:11px 12px;background:var(--ish-navy);color:#fff}.ish-topbar strong{flex:1;font-size:17px}.ish-topbar button{border:0;border-radius:8px;background:#ffffff20;color:#fff;padding:7px 10px;font-weight:700}.ish-content{max-width:1050px;margin:0 auto;padding:12px}.ish-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px}.ish-summary-card{background:#ddf7f2;border:1px solid #90ddd3;border-radius:10px;padding:9px}.ish-summary-card strong{display:block;font-size:18px;color:var(--ish-green)}.ish-toolbar{display:flex;gap:7px;flex-wrap:wrap;margin:11px 0}.ish-toolbar input{flex:1;min-width:180px;border:1px solid var(--ish-line);border-radius:8px;padding:9px}.ish-tabs{display:flex;gap:5px;overflow:auto;padding-bottom:5px}.ish-tab{white-space:nowrap;border:1px solid var(--ish-line);border-radius:999px;background:#fff;color:var(--ish-ink);padding:7px 10px}.ish-tab.active{background:var(--ish-blue);color:#fff;border-color:var(--ish-blue)}.ish-list{display:grid;gap:8px;margin-top:10px}.ish-item{display:grid;grid-template-columns:minmax(160px,1fr) auto auto;gap:9px;align-items:center;background:#fff;border:1px solid var(--ish-line);border-radius:10px;padding:10px}.ish-item-name{font-weight:700}.ish-item-meta{color:var(--ish-muted);font-size:12px}.ish-item-value{text-align:right}.ish-price-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.ish-price-cell{background:#f4f7fb;border:1px solid #e0e6ef;border-radius:8px;padding:7px}.ish-price-cell span,.ish-price-cell small{display:block;color:var(--ish-muted);font-size:11px}.ish-price-cell strong{font-size:14px}.ish-item select,.ish-item input,.ish-field input{border:1px solid var(--ish-line);border-radius:7px;padding:7px;background:#fff;color:var(--ish-ink)}.ish-badge{display:inline-block;border-radius:999px;padding:3px 7px;background:#e8f0fa;font-size:11px;font-weight:700}.ish-badge.trader,.ish-badge.store{background:#ddf3e4;color:var(--ish-green)}.ish-badge.trash{background:#fce3e3;color:var(--ish-red)}.ish-badge.review{background:#ffe8c2;color:var(--ish-gold)}.ish-badge.excluded{background:#e5e7eb;color:#4b5563}.ish-empty,.ish-plan-card,.ish-settings-card{background:#fff;border:1px solid var(--ish-line);border-radius:11px;padding:12px;margin-top:10px}.ish-plan-card pre{white-space:pre-wrap;font:13px/1.45 Arial,sans-serif;background:#f4f7fb;border-radius:8px;padding:9px}.ish-field{display:grid;gap:5px;margin:10px 0}.ish-field label{font-weight:700}.ish-field input{width:100%}.ish-privacy{background:#fff4c7;border:1px solid #e4cb67;border-radius:9px;padding:10px}.ish-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483600;background:#111827;color:#fff;padding:10px 14px;border-radius:9px;box-shadow:0 8px 24px #0005;max-width:calc(100vw - 30px)}
      @media(max-width:680px){.ish-summary{grid-template-columns:repeat(2,1fr)}.ish-item{grid-template-columns:1fr}.ish-item-value{text-align:left}.ish-content{padding:9px}#${APP.panelId}{bottom:112px}}
    `;
    document.head.append(style);
  }

  function renderPanel() {
    let panel = document.getElementById(APP.panelId);
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = APP.panelId;
      document.body.append(panel);
    }
    const views = inventoryViews();
    const summary = summaryFor(views);
    panel.innerHTML = `
      <div class="ish-mini-head"><strong>${APP.shortName} · Inventory Sales</strong><button type="button" data-ish="collapse">${state.settings.collapsed ? '+' : '−'}</button></div>
      ${state.settings.collapsed ? '' : `<div class="ish-mini-body">
        <div class="ish-mini-stats">
          <div class="ish-mini-stat"><strong>${summary.stacks}</strong><span>stacks</span></div>
          <div class="ish-mini-stat"><strong>${summary.review}</strong><span>review</span></div>
          <div class="ish-mini-stat"><strong>${formatMoney(summary.payout)}</strong><span>planned</span></div>
        </div>
        <div class="ish-mini-actions">
          <button class="ish-btn primary" type="button" data-ish="scan">${state.scanning ? `Scanning ${state.scanProgress}…` : 'Scan API'}</button>
          <button class="ish-btn" type="button" data-ish="open">Open organizer</button>
          <button class="ish-btn light" type="button" data-ish="settings">Settings</button>
        </div>
        <div class="ish-muted" style="margin-top:8px">${escapeHtml(apiKeySource())} · last scan ${escapeHtml(formatDateTime(state.settings.lastScanAt))}</div>
      </div>`}
    `;
    panel.querySelector('[data-ish="collapse"]')?.addEventListener('click', () => {
      state.settings.collapsed = !state.settings.collapsed;
      saveJson(APP.settingsStorageKey, state.settings);
      renderPanel();
    });
    panel.querySelector('[data-ish="scan"]')?.addEventListener('click', () => scanInventory().catch(reportError));
    panel.querySelector('[data-ish="open"]')?.addEventListener('click', () => openOverlay());
    panel.querySelector('[data-ish="settings"]')?.addEventListener('click', () => openSettings());
  }

  function filteredViews() {
    const search = normalizeWhitespace(state.settings.search).toLowerCase();
    return inventoryViews().filter((item) => {
      const tabMatch = state.settings.selectedTab === 'all' || item.action === state.settings.selectedTab;
      const searchMatch = !search || `${item.name} ${item.category} ${item.destination} ${item.vendorName} ${item.vendorCountry}`.toLowerCase().includes(search);
      return tabMatch && searchMatch;
    });
  }

  function renderItem(item) {
    const disabled = item.action === 'excluded';
    const catalogMeta = [
      item.vendorName ? `Vendor ${item.vendorName}${item.vendorCountry ? ` (${item.vendorCountry})` : ''}` : '',
      item.isTradable === null ? '' : item.isTradable ? 'Tradable' : 'Not tradable',
      item.circulation === null ? '' : `${new Intl.NumberFormat().format(item.circulation)} circulating`,
    ].filter(Boolean).join(' · ');
    return `
      <article class="ish-item" data-item-id="${item.itemId}">
        <div><div class="ish-item-name">${escapeHtml(item.name)}</div><div class="ish-item-meta">${escapeHtml(item.category)} · ID ${item.itemId} · owned ${item.amount}${item.keepQuantity ? ` · keep ${item.keepQuantity}` : ''}</div></div>
        <div><span class="ish-badge ${item.action}">${escapeHtml(ACTION_LABELS[item.action])}</span><div class="ish-item-meta">${escapeHtml(item.destination)}</div></div>
        <div class="ish-item-value"><strong>${item.total ? formatMoney(item.total) : '—'}</strong><div class="ish-item-meta">${item.quantity ? `${item.quantity} × ${formatMoney(item.unitPrice)} planned` : 'no sale quantity'}</div></div>
        <div class="ish-price-grid">
          <div class="ish-price-cell"><span>Market each</span><strong>${item.marketValue ? formatMoney(item.marketValue) : '—'}</strong><small>${item.marketValue ? `${formatMoney(item.marketTotal)} owned` : 'no catalog value'}</small></div>
          <div class="ish-price-cell"><span>Shop pays you</span><strong>${item.citySellPrice ? formatMoney(item.citySellPrice) : '—'}</strong><small>per item</small></div>
          <div class="ish-price-cell"><span>Shop charges</span><strong>${item.shopBuyPrice !== null ? formatMoney(item.shopBuyPrice) : '—'}</strong><small>per item</small></div>
        </div>
        ${catalogMeta ? `<div class="ish-item-meta" style="grid-column:1/-1">${escapeHtml(catalogMeta)}</div>` : ''}
        <div style="grid-column:1/-1;display:flex;gap:7px;flex-wrap:wrap">
          <select data-ish-action ${disabled ? 'disabled' : ''} aria-label="Classification for ${escapeHtml(item.name)}">
            ${ACTIONS.filter((action) => action !== 'excluded').map((action) => `<option value="${action}" ${action === item.action ? 'selected' : ''}>${escapeHtml(ACTION_LABELS[action])}</option>`).join('')}
          </select>
          <label class="ish-item-meta">Keep quantity <input data-ish-keep type="number" min="0" max="${item.amount}" value="${item.keepQuantity}" ${disabled ? 'disabled' : ''} style="width:84px"></label>
        </div>
      </article>
    `;
  }

  function renderPlan(views) {
    const groups = planGroups(views);
    const traderCards = groups.traders.map((group) => `
      <section class="ish-plan-card">
        <strong>${escapeHtml(group.trader.name)} · ${formatMoney(group.total)}</strong>
        <pre>${escapeHtml(traderMessage(group))}</pre>
        <button class="ish-btn" type="button" data-copy-trader="${escapeHtml(group.trader.id)}">Copy message</button>
      </section>
    `).join('');
    const storeTotal = groups.store.reduce((sum, item) => sum + item.total, 0);
    const storeCard = groups.store.length ? `<section class="ish-plan-card"><strong>Sell to Torn shops · ${formatMoney(storeTotal)}</strong><pre>${escapeHtml(groups.store.map((item) => `${item.quantity} × ${item.name} @ ${formatMoney(item.unitPrice)} = ${formatMoney(item.total)}${item.vendorName ? ` · ${item.vendorName}` : ''}`).join('\n'))}</pre></section>` : '';
    const trashCard = groups.trash.length ? `<section class="ish-plan-card"><strong>Trash review list</strong><div class="ish-privacy" style="margin-top:8px">No item is trashed automatically. Confirm every destructive action inside Torn.</div><pre>${escapeHtml(groups.trash.map((item) => `${item.amount} × ${item.name}`).join('\n'))}</pre></section>` : '';
    return traderCards || storeCard || trashCard
      ? traderCards + storeCard + trashCard
      : '<div class="ish-empty">No trader, store, or trash plan exists yet.</div>';
  }

  function openOverlay() {
    document.getElementById(APP.overlayId)?.remove();
    const overlay = document.createElement('main');
    overlay.id = APP.overlayId;
    document.body.append(overlay);
    renderOverlay();
  }

  function renderOverlay() {
    const overlay = document.getElementById(APP.overlayId);
    if (!overlay) return;
    const allViews = inventoryViews();
    const summary = summaryFor(allViews);
    const visible = filteredViews();
    const tabs = ['all', 'keep', 'trader', 'store', 'trash', 'review', 'excluded', 'plan'];
    overlay.innerHTML = `
      <header class="ish-topbar"><strong>TornScripture · Inventory Sales HUD</strong><button type="button" data-ish="settings">Settings</button><button type="button" data-ish="close">Close</button></header>
      <div class="ish-content">
        <section class="ish-summary">
          <div class="ish-summary-card"><strong>${summary.stacks}</strong><span>item stacks</span></div>
          <div class="ish-summary-card"><strong>${summary.units}</strong><span>total units</span></div>
          <div class="ish-summary-card"><strong>${formatMoney(summary.marketWorth)}</strong><span>Torn market worth</span></div>
          <div class="ish-summary-card"><strong>${formatMoney(summary.payout)}</strong><span>planned payout</span></div>
          <div class="ish-summary-card"><strong>${summary.review}</strong><span>need review</span></div>
        </section>
        <div class="ish-toolbar">
          <button class="ish-btn primary" type="button" data-ish="scan">${state.scanning ? `Scanning ${state.scanProgress}…` : 'Scan API'}</button>
          <button class="ish-btn light" type="button" data-ish="scan-visible">Scan visible page</button>
          <button class="ish-btn light" type="button" data-ish="refresh-catalog">Refresh Torn prices</button>
          <button class="ish-btn light" type="button" data-ish="refresh-prices">Refresh trader prices</button>
          <input type="search" data-ish-search placeholder="Search items, categories, or traders" value="${escapeHtml(state.settings.search)}">
        </div>
        <div class="ish-tabs">${tabs.map((tab) => `<button type="button" class="ish-tab ${state.settings.selectedTab === tab ? 'active' : ''}" data-ish-tab="${tab}">${tab === 'all' ? 'All' : tab === 'plan' ? 'Sale Plan' : ACTION_LABELS[tab]}</button>`).join('')}</div>
        ${state.settings.selectedTab === 'plan'
          ? renderPlan(allViews)
          : `<section class="ish-list">${visible.length ? visible.map(renderItem).join('') : '<div class="ish-empty">No items match this view.</div>'}</section>`}
      </div>
    `;
    overlay.querySelector('[data-ish="close"]')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-ish="settings"]')?.addEventListener('click', openSettings);
    overlay.querySelector('[data-ish="scan"]')?.addEventListener('click', () => scanInventory().catch(reportError));
    overlay.querySelector('[data-ish="scan-visible"]')?.addEventListener('click', scanVisibleInventory);
    overlay.querySelector('[data-ish="refresh-catalog"]')?.addEventListener('click', () => refreshTornCatalogOnly().catch(reportError));
    overlay.querySelector('[data-ish="refresh-prices"]')?.addEventListener('click', () => loadPriceConfigFromUrl().catch(reportError));
    overlay.querySelector('[data-ish-search]')?.addEventListener('input', (event) => {
      state.settings.search = event.currentTarget.value;
      saveJson(APP.settingsStorageKey, state.settings);
      renderOverlay();
      requestAnimationFrame(() => overlay.querySelector('[data-ish-search]')?.focus());
    });
    for (const button of overlay.querySelectorAll('[data-ish-tab]')) {
      button.addEventListener('click', () => {
        state.settings.selectedTab = button.getAttribute('data-ish-tab');
        saveJson(APP.settingsStorageKey, state.settings);
        renderOverlay();
      });
    }
    for (const row of overlay.querySelectorAll('[data-item-id]')) {
      const itemId = Number(row.getAttribute('data-item-id'));
      const actionInput = row.querySelector('[data-ish-action]');
      const keepInput = row.querySelector('[data-ish-keep]');
      const save = () => setItemRule(itemId, actionInput.value, keepInput.value);
      actionInput?.addEventListener('change', save);
      keepInput?.addEventListener('change', save);
    }
    for (const button of overlay.querySelectorAll('[data-copy-trader]')) {
      button.addEventListener('click', () => {
        const group = planGroups(allViews).traders.find(
          (candidate) => candidate.trader.id === button.getAttribute('data-copy-trader')
        );
        if (group) writeClipboard(traderMessage(group)).then(() => toast('Trader message copied.')).catch(reportError);
      });
    }
  }

  function openSettings() {
    document.getElementById(APP.settingsId)?.remove();
    const modal = document.createElement('main');
    modal.id = APP.settingsId;
    modal.innerHTML = `
      <header class="ish-topbar"><strong>Inventory Sales HUD Settings</strong><button type="button" data-ish="close">Close</button></header>
      <div class="ish-content" style="max-width:720px">
        <section class="ish-settings-card">
          <h2 style="margin-top:0">Torn API connection</h2>
          <div class="ish-privacy"><strong>Privacy:</strong> inventory and API key stay on this device. The key is sent only to <code>api.torn.com</code>. No key is included in exports or price files. Required access: Limited.</div>
          <div class="ish-field"><label>Connection</label><div>${escapeHtml(apiKeySource())}</div></div>
          <div class="ish-muted">Torn catalog: ${Object.keys(state.catalog.items).length} matched items · updated ${escapeHtml(formatDateTime(state.catalog.updatedAt))}</div>
          ${pdaApiKey() ? '<div class="ish-field"><div>TornPDA supplied its managed key. Nothing needs to be pasted here.</div></div>' : `<div class="ish-field"><label for="ish-api-key">Limited Access API key</label><input id="ish-api-key" type="password" autocomplete="off" placeholder="Stored only in this browser" value="${escapeHtml(storedApiKey())}"></div>`}
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            ${pdaApiKey() ? '' : '<button class="ish-btn primary" type="button" data-ish="save-key">Save key</button><button class="ish-btn danger" type="button" data-ish="forget-key">Forget key</button>'}
            <button class="ish-btn light" type="button" data-ish="refresh-catalog">Refresh Torn prices</button>
            <a class="ish-btn light" href="https://www.torn.com/preferences.php#tab=api" target="_blank" rel="noopener">Open Torn API settings</a>
          </div>
        </section>
        <section class="ish-settings-card">
          <h2 style="margin-top:0">Trader price connection</h2>
          <div class="ish-field"><label for="ish-price-url">JSON price configuration URL</label><input id="ish-price-url" type="url" value="${escapeHtml(state.settings.priceConfigUrl)}"></div>
          <div class="ish-muted">Loaded ${state.priceConfig.traders.length} traders and ${Object.keys(state.priceConfig.items).length} priced items · updated ${escapeHtml(formatDateTime(state.priceConfig.updatedAt))}</div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px"><button class="ish-btn primary" type="button" data-ish="save-url">Save and refresh</button><button class="ish-btn light" type="button" data-ish="import-prices">Import JSON file</button><button class="ish-btn light" type="button" data-ish="export-rules">Export my rules</button></div>
        </section>
        <section class="ish-settings-card">
          <h2 style="margin-top:0">Equipment safety</h2>
          <p>Armor and every weapon category are always locked in Excluded Equipment. They never enter price totals, trader messages, store plans, or trash plans.</p>
        </section>
      </div>
    `;
    document.body.append(modal);
    modal.querySelector('[data-ish="close"]')?.addEventListener('click', () => modal.remove());
    modal.querySelector('[data-ish="save-key"]')?.addEventListener('click', () => {
      const key = normalizeWhitespace(modal.querySelector('#ish-api-key')?.value);
      if (!looksLikeApiKey(key)) {
        toast('That does not look like a valid API key.');
        return;
      }
      localStorage.setItem(APP.apiKeyStorageKey, key);
      renderPanel();
      toast('API key saved locally. Press Scan API to test it.');
    });
    modal.querySelector('[data-ish="forget-key"]')?.addEventListener('click', () => {
      localStorage.removeItem(APP.apiKeyStorageKey);
      renderPanel();
      openSettings();
      toast('Local API key removed.');
    });
    modal.querySelector('[data-ish="refresh-catalog"]')?.addEventListener('click', () => {
      refreshTornCatalogOnly().then(openSettings).catch(reportError);
    });
    modal.querySelector('[data-ish="save-url"]')?.addEventListener('click', () => {
      state.settings.priceConfigUrl = normalizeWhitespace(modal.querySelector('#ish-price-url')?.value);
      saveJson(APP.settingsStorageKey, state.settings);
      loadPriceConfigFromUrl().then(openSettings).catch(reportError);
    });
    modal.querySelector('[data-ish="import-prices"]')?.addEventListener('click', importPriceConfig);
    modal.querySelector('[data-ish="export-rules"]')?.addEventListener('click', exportRules);
  }

  function toast(message) {
    document.querySelector('.ish-toast')?.remove();
    const element = document.createElement('div');
    element.className = 'ish-toast';
    element.textContent = message;
    document.body.append(element);
    setTimeout(() => element.remove(), 4200);
  }

  function reportError(error) {
    console.error(`[${APP.shortName}]`, error);
    toast(`${APP.shortName} error: ${error?.message || String(error)}`);
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
    injectStyles();
    renderPanel();
    if (!localStorage.getItem(APP.priceStorageKey)) {
      loadPriceConfigFromUrl(false).catch((error) => console.warn(`[${APP.shortName}] Price config`, error));
    }
    console.info(`[${APP.shortName}] ${APP.name} v${APP.version} initialized. Manual-scan, local-only mode.`);
  }

  if (globalThis.__TS_ISH_TEST_MODE__) {
    globalThis.__TS_ISH_TEST_EXPORTS__ = {
      normalizeApiItem,
      inventoryRequestUrl,
      catalogRequestUrl,
      INVENTORY_CATEGORIES,
      isEquipmentCategory,
      isEquipmentItem,
      aggregateInventory,
      normalizeCatalogItem,
      normalizeCatalog,
      mergeItemPrices,
      normalizePriceConfig,
      isPriceConfig,
      extractInventoryItems,
      extractInventoryTotal,
    };
    return;
  }

  init().catch(reportError);
})();
