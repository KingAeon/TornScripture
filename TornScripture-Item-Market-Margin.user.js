// ==UserScript==
// @name         TornScripture - Item Market Margin
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.2.1
// @description  Audits item-market margins and verifies 99% trader payouts against live trade manifests.
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
   * TORNSCRIPTURE - ITEM MARKET MARGIN v0.2.1
   *
   * PHASE-ONE SAFETY BOUNDARY
   * - Reads item names, lowest prices, market values, and visible listing rows.
   * - Torn catalog values are requested only when the user presses Sync values.
   * - The API key and catalog cache remain in this browser's local storage.
   * - The key is sent only to Torn's official API.
   * - The script never clicks Buy, submits purchases, lists items, or sells items.
   */

  const APP = Object.freeze({
    name: 'Item Market Margin',
    shortName: 'IMM',
    version: '0.2.1',
    panelId: 'tornscripture-imm-panel',
    styleId: 'tornscripture-imm-style',
    badgeClass: 'tsimm-margin-badge',
    categoryMark: 'tsimm-category-mark',
    listingMark: 'tsimm-listing-mark',
    tradeItemMark: 'tsimm-trade-item-mark',
    tradeBadgeClass: 'tsimm-trade-item-badge',
    apiKeyStorageKey: 'tornscripture-imm-api-key-v1',
    sharedApiKeyStorageKey: 'tornscripture-ish-api-key-v1',
    catalogStorageKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogStorageKey: 'tornscripture-ish-torn-catalog-v1',
    settingsStorageKey: 'tornscripture-imm-settings-v1',
    catalogUrl: 'https://api.torn.com/v2/torn/items',
    scanDelayMs: 450,
    catalogMaxAgeMs: 24 * 60 * 60 * 1000,
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
    lastScan: emptyScanStats(),
    syncing: false,
    scanTimer: null,
    observer: null,
    initialized: false,
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
    if (!(container instanceof Element)) return [];
    const selectors = [
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
        || /\b(?:money|cash)\b[^\n]{0,30}\$[\d,]+/i.test(text);
    });

    if (candidates.length < 2) {
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
      .sort((a, b) => a.rect.left - b.rect.left)
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

    const editable = sides.map((side) => ({
      side,
      controls: side.element.querySelectorAll('input,button,select').length,
      addText: /\b(?:add|remove) items?\b/i.test(side.element.innerText || ''),
    })).sort((a, b) => Number(b.addText) - Number(a.addText) || b.controls - a.controls);
    if (editable[0] && (editable[0].addText || editable[0].controls > (editable[1]?.controls || 0))) {
      return { side: editable[0].side, source: 'editable side' };
    }

    const left = sides.find((side) => side.side === 'left') || sides[0] || null;
    return left ? { side: left, source: 'assumed left; verify selector' } : { side: null, source: 'not found' };
  }

  function itemIdFromTradeRow(row) {
    const elements = [row, ...row.querySelectorAll('[data-item-id],[data-itemid],[data-item],a[href],img[src]')];
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

  function cashFromTradeSide(side) {
    if (!side?.element) return null;
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
    if (!state.settings.showTradeItemBreakdown || !item?.row || !item.catalog) return;
    const badge = document.createElement('span');
    badge.className = APP.tradeBadgeClass;
    badge.dataset.tsimmGenerated = 'true';
    const marketTotal = item.catalog.marketPrice * item.quantity;
    const targetTotal = traderPayout(item.catalog.marketPrice) * item.quantity;
    badge.innerHTML = `<strong>99% ${escapeHtml(formatMoney(targetTotal))}</strong>`
      + `<span>MV ${escapeHtml(formatMoney(marketTotal))} · ${escapeHtml(formatInteger(item.quantity))} qty</span>`;
    item.row.classList.add(APP.tradeItemMark);
    item.row.appendChild(badge);
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

    const parsed = tradeItemRowElements(mySide.element).map(parseTradeItemRow).filter(Boolean);
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
    const auditLine = `MV ${formatMoney(margin.value)} → 99% ${formatMoney(margin.payout)}`;
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
      rowCount: tradeItemRowElements(side.element).length,
      cash: cashFromTradeSide(side),
      tag: side.element.tagName,
      className: side.element.className,
      itemRows: tradeItemRowElements(side.element).slice(0, 8).map((row) => {
        const parsed = parseTradeItemRow(row);
        return parsed ? {
          name: parsed.name,
          quantity: parsed.quantity,
          itemId: parsed.itemId,
          catalogMatch: Boolean(catalogItemFor(parsed.name, parsed.itemId)),
          tag: row.tagName,
          className: row.className,
          text: normalizeWhitespace(row.innerText).slice(0, 180),
        } : null;
      }).filter(Boolean),
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
          ...stats.tradeItems.map((item) => `<div class="tsimm-trade-item-line"><span>${escapeHtml(item.name)} × ${escapeHtml(formatInteger(item.quantity))}</span><strong>${escapeHtml(formatMoney(item.targetTotal))}</strong></div>`),
          ...stats.tradeUnmatched.map((item) => `<div class="tsimm-trade-item-line tsimm-trade-unmatched"><span>Unmatched: ${escapeHtml(item.name)} × ${escapeHtml(formatInteger(item.quantity))}</span><strong>?</strong></div>`),
        ].join('')
      : '';
    return `
      <div class="tsimm-trade-card tsimm-trade-${escapeHtml(status)}">
        <div class="tsimm-trade-title"><strong>🤝 Trade manifest</strong><span>${escapeHtml(statusLabel)}</span></div>
        <div class="tsimm-trade-grid">
          <span>Your item types</span><strong>${formatInteger(stats.tradeMatchedItems)}${stats.tradeUnmatchedItems ? ` + ${formatInteger(stats.tradeUnmatchedItems)} unmatched` : ''}</strong>
          <span>Full market value</span><strong>${formatMoney(stats.tradeMarketTotal)}</strong>
          <span>Required 99% payout</span><strong>${formatMoney(stats.tradeTargetTotal)}</strong>
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
        <div class="tsimm-note">Profit base: floor(Market Value × 99%) per item</div>
        ${tradeSummaryHtml(stats)}
        <div class="tsimm-actions">
          <button class="tsimm-btn tsimm-btn-primary" type="button" data-tsimm-action="sync" ${state.syncing ? 'disabled' : ''}>${state.syncing ? 'Syncing…' : 'Sync values'}</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="scan">Scan page</button>
          <button class="tsimm-btn" type="button" data-tsimm-action="diagnostics">Copy diagnostics</button>
        </div>
        ${tradeControls}
        ${marketControls}
        ${notes}
      </div>
    `;
  }

  function bindPanelEvents() {
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
    bindPanelEvents();
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
    };
  }
})();
