// ==UserScript==
// @name         TornScripture - IMM Trader Market Overlay
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.1
// @description  Compares live Item Market prices with captured trader pricelists and formats compact tracked-exit margin prompts.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Market-Overlay.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Market-Overlay.user.js
// ==/UserScript==

(() => {
  'use strict';

  const APP = Object.freeze({
    version: '0.1.1',
    tradersKey: 'tornscripture-imm-traders-v1',
    catalogKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogKey: 'tornscripture-ish-torn-catalog-v1',
    settingsKey: 'tornscripture-imm-trader-market-overlay-settings-v1',
    indexKey: 'tornscripture-imm-trader-price-index-v1',
    panelId: 'tornscripture-imm-panel',
    settingsOverlayId: 'tornscripture-imm-trader-market-overlay-settings',
    styleId: 'tornscripture-imm-trader-market-overlay-style',
    badgeClass: 'tsimm-tmo-badge',
    categoryMark: 'tsimm-category-mark',
    listingMark: 'tsimm-listing-mark',
  });

  const DEFAULTS = Object.freeze({
    enabled: true,
    minimumProfitEach: 1000,
    minimumRoiPercent: 1,
    minimumListingProfit: 5000,
    actionableAgeHours: 168,
    freshAgeHours: 72,
    pricesShown: 3,
    showReferencePrices: true,
  });

  let settings = { ...DEFAULTS, ...loadJson(APP.settingsKey, {}) };
  let indexCache = null;
  let traderSnapshot = null;
  let decorateTimer = null;
  let pollTimer = null;
  let observer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch {
      return clone(fallback);
    }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function nameKey(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9'+&-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function parseNumber(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const number = Number(raw.replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) ? number : null;
  }

  function money(value) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function integer(value) {
    return new Intl.NumberFormat().format(Math.floor(Number(value) || 0));
  }

  function percent(value) {
    const number = Number(value) || 0;
    return `${number.toFixed(Math.abs(number) >= 10 ? 1 : 2)}%`;
  }

  function timestampMs(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : null;
  }

  function ageText(value, now = Date.now()) {
    const captured = timestampMs(value);
    if (captured === null) return 'age unknown';
    const minutes = Math.max(0, Math.floor((now - captured) / 60000));
    if (minutes < 60) return `${minutes}m old`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h old`;
    return `${Math.floor(hours / 24)}d old`;
  }

  function normalizeTraderItem(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const itemId = Number(candidate.itemId ?? candidate.id) > 0 ? Number(candidate.itemId ?? candidate.id) : null;
    const itemName = clean(candidate.itemName ?? candidate.name) || (itemId ? `Item ${itemId}` : '');
    const unitPrice = Math.max(0, Number(candidate.unitPrice ?? candidate.price ?? candidate.value) || 0);
    if ((!itemId && !itemName) || !unitPrice) return null;
    return { itemId, itemName, normalizedName: nameKey(itemName), unitPrice };
  }

  function normalizeTraders(raw) {
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.traders) ? raw.traders : [];
    return source.map((candidate) => {
      if (!candidate || typeof candidate !== 'object') return null;
      const name = clean(candidate.name ?? candidate.username);
      if (!name) return null;
      const items = Array.isArray(candidate.pricePageItems ?? candidate.pricingItems)
        ? (candidate.pricePageItems ?? candidate.pricingItems).map(normalizeTraderItem).filter(Boolean)
        : [];
      return {
        id: clean(candidate.recordId ?? candidate.uuid)
          || (typeof candidate.id === 'string' ? clean(candidate.id) : '')
          || `trader-${nameKey(name)}`,
        name,
        userId: Number(candidate.userId ?? candidate.tornId) > 0 ? Number(candidate.userId ?? candidate.tornId) : null,
        capturedAt: candidate.pricePageLastCheckedAt || candidate.pricePageCapturedAt || null,
        sourceUrl: clean(candidate.pricePageUrl),
        items,
      };
    }).filter(Boolean);
  }

  function normalizeCatalogItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const value = raw.value && typeof raw.value === 'object' ? raw.value : {};
    const id = Number(raw.id ?? raw.itemId);
    const name = clean(raw.name);
    const marketPrice = Math.max(0, Number(raw.marketPrice ?? raw.market_price ?? value.market_price) || 0);
    const sellPrice = Math.max(0, Number(raw.sellPrice ?? raw.sell_price ?? value.sell_price) || 0);
    if (!name || (!marketPrice && !sellPrice)) return null;
    return {
      id: Number.isFinite(id) && id > 0 ? id : null,
      name,
      normalizedName: nameKey(name),
      marketPrice,
      sellPrice,
    };
  }

  function normalizeCatalog(raw) {
    const result = { updatedAt: raw?.updatedAt || null, byId: {}, byName: {} };
    const source = raw?.itemsByName || raw?.items || {};
    const entries = Array.isArray(source)
      ? source.map((item) => [String(item?.id || ''), item])
      : Object.entries(source);
    for (const [key, candidate] of entries) {
      const item = normalizeCatalogItem({ ...candidate, id: candidate?.id ?? candidate?.itemId ?? Number(key) });
      if (!item) continue;
      if (item.id) result.byId[String(item.id)] = item;
      result.byName[item.normalizedName] = item;
    }
    return result;
  }

  function catalog() {
    const shared = normalizeCatalog(loadJson(APP.sharedCatalogKey, {}));
    const own = normalizeCatalog(loadJson(APP.catalogKey, {}));
    return {
      updatedAt: own.updatedAt || shared.updatedAt || null,
      byId: { ...shared.byId, ...own.byId },
      byName: { ...shared.byName, ...own.byName },
    };
  }

  function catalogItem(values, itemId, itemName) {
    if (Number(itemId) > 0 && values.byId[String(Number(itemId))]) return values.byId[String(Number(itemId))];
    return values.byName[nameKey(itemName)] || null;
  }

  function buildIndex(traders = normalizeTraders(loadJson(APP.tradersKey, [])), now = Date.now()) {
    const byKey = {};
    for (const trader of traders) {
      const capturedMs = timestampMs(trader.capturedAt);
      const ageMs = capturedMs === null ? null : Math.max(0, now - capturedMs);
      for (const item of trader.items) {
        const entry = {
          traderId: trader.id,
          traderName: trader.name,
          userId: trader.userId,
          itemId: item.itemId,
          itemName: item.itemName,
          normalizedName: item.normalizedName,
          unitPrice: item.unitPrice,
          capturedAt: trader.capturedAt,
          ageMs,
          sourceUrl: trader.sourceUrl,
        };
        const keys = [];
        if (item.itemId) keys.push(`id:${item.itemId}`);
        if (item.normalizedName) keys.push(`name:${item.normalizedName}`);
        for (const key of keys) {
          const list = byKey[key] ||= [];
          const existing = list.findIndex((value) => value.traderId === trader.id);
          if (existing < 0) list.push(entry);
          else if (entry.unitPrice > list[existing].unitPrice) list[existing] = entry;
        }
      }
    }
    for (const list of Object.values(byKey)) {
      list.sort((a, b) => b.unitPrice - a.unitPrice
        || Number(a.ageMs ?? Infinity) - Number(b.ageMs ?? Infinity)
        || a.traderName.localeCompare(b.traderName));
    }
    const idCount = Object.keys(byKey).filter((key) => key.startsWith('id:')).length;
    return {
      schema: 'tornscripture-imm-trader-price-index',
      schemaVersion: 1,
      updatedAt: new Date(now).toISOString(),
      traderCount: traders.filter((trader) => trader.items.length).length,
      itemCount: idCount || Object.keys(byKey).filter((key) => key.startsWith('name:')).length,
      byKey,
    };
  }

  function refreshIndex(force = false) {
    let raw = '';
    try { raw = localStorage.getItem(APP.tradersKey) || ''; } catch {}
    if (!force && raw === traderSnapshot && indexCache) return indexCache;
    traderSnapshot = raw;
    indexCache = buildIndex();
    saveJson(APP.indexKey, indexCache);
    try { window.dispatchEvent(new CustomEvent('tsimm:trader-price-index-updated', { detail: indexCache })); } catch {}
    return indexCache;
  }

  function pricesFor(itemId, itemName) {
    const index = refreshIndex();
    const idList = Number(itemId) > 0 ? index.byKey[`id:${Number(itemId)}`] : null;
    if (Array.isArray(idList) && idList.length) return idList;
    const nameList = index.byKey[`name:${nameKey(itemName)}`];
    return Array.isArray(nameList) ? nameList : [];
  }

  function bestOtherExit(item) {
    const generic = Math.floor(Math.max(0, Number(item?.marketPrice) || 0) * 0.99);
    const npc = Math.max(0, Number(item?.sellPrice) || 0);
    if (npc > generic) return { payout: npc, label: 'NPC' };
    if (generic > 0) return { payout: generic, label: '99% route' };
    return { payout: 0, label: 'other exits' };
  }

  function analyze({ itemId = null, itemName = '', listingPrice, quantity = 1, mode = 'listing' }, now = Date.now()) {
    const price = Math.max(0, Number(listingPrice) || 0);
    if (!price) return null;
    const traders = pricesFor(itemId, itemName);
    if (!traders.length) return null;
    const values = catalog();
    const item = catalogItem(values, itemId, itemName);
    const shown = Math.max(1, Math.min(6, Math.floor(Number(settings.pricesShown) || 3)));
    const top = traders.slice(0, shown);
    const best = top[0];
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const profitEach = best.unitPrice - price;
    const totalProfit = profitEach * qty;
    const roi = price > 0 ? profitEach / price * 100 : 0;
    const other = bestOtherExit(item);
    const beatsOther = other.payout > 0 ? best.unitPrice > other.payout : true;
    const routeDifference = other.payout > 0 ? best.unitPrice - other.payout : null;
    const capturedMs = timestampMs(best.capturedAt);
    const ageHours = capturedMs === null ? Infinity : Math.max(0, now - capturedMs) / 3600000;
    const ageOkay = ageHours <= Math.max(1, Number(settings.actionableAgeHours) || 168);
    const fresh = ageHours <= Math.max(1, Number(settings.freshAgeHours) || 72);
    const totalOkay = mode === 'category'
      ? true
      : totalProfit >= Math.max(0, Number(settings.minimumListingProfit) || 0);
    const actionable = ageOkay
      && beatsOther
      && profitEach >= Math.max(0, Number(settings.minimumProfitEach) || 0)
      && roi >= Math.max(0, Number(settings.minimumRoiPercent) || 0)
      && totalOkay;
    return {
      item, top, best, price, qty, profitEach, totalProfit, roi,
      other, beatsOther, routeDifference, ageHours, ageOkay, fresh, actionable,
    };
  }

  function ownText(element) {
    if (!(element instanceof Element)) return '';
    return clean([...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(' '));
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function itemIdFromElement(root) {
    if (!(root instanceof Element)) return null;
    const elements = [root, ...root.querySelectorAll('[data-item-id],[data-itemid],a[href],img[src]')];
    for (const element of elements) {
      for (const value of [
        element.getAttribute?.('data-item-id'),
        element.getAttribute?.('data-itemid'),
        element.getAttribute?.('href'),
        element.getAttribute?.('src'),
      ]) {
        const match = String(value || '').match(/(?:item(?:id|ID)?[=/]|items?\/)(\d{1,6})(?:\D|$)/);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function itemIdFromUrl() {
    const href = String(location.href || '');
    const match = href.match(/[?&#]item(?:id)?=(\d{1,6})(?:\D|$)/i)
      || href.match(/\bitem(?:id)?[=/](\d{1,6})(?:\D|$)/i);
    return match ? Number(match[1]) : null;
  }

  function directPrice(root, regex) {
    return [...root.querySelectorAll('span,div,p,strong,b')].find((element) => {
      if (element.closest(`[data-tsimm-generated],.${APP.badgeClass}`)) return false;
      return regex.test(ownText(element));
    }) || null;
  }

  function categoryCandidates() {
    const values = catalog();
    const results = [];
    for (const card of document.querySelectorAll(`.${APP.categoryMark}`)) {
      const priceElement = directPrice(card, /^\$[\d,.]+\s*\([\d,]+\)$/);
      const match = ownText(priceElement).match(/^\$([\d,.]+)\s*\(([\d,]+)\)$/);
      if (!match) continue;
      const itemId = itemIdFromElement(card);
      let itemName = itemId ? values.byId[String(itemId)]?.name : '';
      if (!itemName) {
        const lines = String(card.innerText || '').split(/\n+/).map(clean).filter(Boolean);
        itemName = lines.find((line) => values.byName[nameKey(line)]) || '';
      }
      if (!itemName) continue;
      results.push({
        mode: 'category', target: card, row: card, itemId, itemName,
        listingPrice: parseNumber(match[1]), quantity: 1,
      });
    }
    return results;
  }

  function listingItemName(values, itemId) {
    if (itemId && values.byId[String(itemId)]) return values.byId[String(itemId)].name;
    for (const element of document.querySelectorAll('h1,h2,h3,[role="heading"],[class*="title"],[class*="name"]')) {
      if (!visible(element)) continue;
      const text = clean(element.textContent);
      if (values.byName[nameKey(text)]) return values.byName[nameKey(text)].name;
    }
    return '';
  }

  function listingQuantity(row, priceElement) {
    const priceRect = priceElement.getBoundingClientRect();
    const numbers = [...row.querySelectorAll('span,div,p,strong,b')]
      .filter((element) => element !== priceElement && !element.closest(`[data-tsimm-generated],.${APP.badgeClass}`))
      .map((element) => ({ text: ownText(element), rect: element.getBoundingClientRect() }))
      .filter((entry) => /^\d[\d,]*$/.test(entry.text))
      .sort((a, b) => Math.abs(a.rect.top - priceRect.top) - Math.abs(b.rect.top - priceRect.top)
        || a.rect.left - b.rect.left);
    return Math.max(1, Math.floor(parseNumber(numbers[0]?.text) || 1));
  }

  function listingCandidates() {
    const values = catalog();
    const itemId = itemIdFromUrl();
    const itemName = listingItemName(values, itemId);
    if (!itemId && !itemName) return [];
    const results = [];
    for (const row of document.querySelectorAll(`.${APP.listingMark}`)) {
      const priceElement = directPrice(row, /^\$[\d,.]+$/);
      const price = parseNumber(ownText(priceElement));
      if (!priceElement || !price) continue;
      results.push({
        mode: 'listing', target: priceElement, row, itemId, itemName,
        listingPrice: price, quantity: listingQuantity(row, priceElement),
      });
    }
    return results;
  }

  function compactPrices(entries, limit = settings.pricesShown) {
    return entries.slice(0, Math.max(1, Number(limit) || 1))
      .map((entry) => `${entry.traderName} ${money(entry.unitPrice)}`)
      .join(' · ');
  }

  function comparisonText(result) {
    const age = ageText(result.best.capturedAt);
    if (!result.ageOkay) return `Reference only · ${age}`;
    if (result.routeDifference === null) return `Other exits unresolved · ${age}`;
    if (result.beatsOther) return `Beats ${result.other.label} by ${money(result.routeDifference)} · ${age}`;
    return `${result.other.label} still pays ${money(Math.abs(result.routeDifference))} more · ${age}`;
  }

  function badgeHtml(result, mode) {
    const title = result.actionable
      ? `👥 BUY → ${result.best.traderName}`
      : mode === 'category' ? '👥 Trader prices' : `👥 Best trader: ${result.best.traderName}`;
    const top = compactPrices(result.top);
    if (mode === 'category') {
      return `<strong>${escapeHtml(title)}</strong>`
        + `<span>${escapeHtml(top)}</span>`
        + `<span>${result.profitEach >= 0 ? '+' : ''}${escapeHtml(money(result.profitEach))} ea · ${escapeHtml(percent(result.roi))} ROI</span>`
        + `<span>${escapeHtml(comparisonText(result))}</span>`;
    }
    const alternatives = result.top.length > 1 ? compactPrices(result.top.slice(1), Math.max(1, settings.pricesShown - 1)) : '';
    return `<strong>${escapeHtml(title)}</strong>`
      + `<span>Pays ${escapeHtml(money(result.best.unitPrice))} · ${result.profitEach >= 0 ? '+' : ''}${escapeHtml(money(result.profitEach))} ea</span>`
      + `<span>${result.totalProfit >= 0 ? '+' : ''}${escapeHtml(money(result.totalProfit))} lot · ${escapeHtml(percent(result.roi))} ROI</span>`
      + `<span>${escapeHtml(comparisonText(result))}</span>`
      + `${alternatives ? `<span>Also: ${escapeHtml(alternatives)}</span>` : ''}`;
  }

  function directBadge(target, mode) {
    return [...target.children].find((child) => child.classList?.contains(APP.badgeClass)
      && child.dataset.tsimmTmoMode === mode) || null;
  }

  function applyBadge(candidate, result, token) {
    if (!result) return;
    if (!result.actionable && !settings.showReferencePrices) return;
    let badge = directBadge(candidate.target, candidate.mode);
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.tsimmGenerated = 'true';
      badge.dataset.tsimmTmoMode = candidate.mode;
      candidate.target.appendChild(badge);
    }
    const state = result.actionable ? 'actionable' : !result.ageOkay ? 'stale' : 'reference';
    badge.className = `${APP.badgeClass} tsimm-tmo-${candidate.mode} ${state}`;
    badge.innerHTML = badgeHtml(result, candidate.mode);
    badge.dataset.tsimmTmoToken = token;
    candidate.row.classList.toggle('tsimm-tmo-buy-row', result.actionable && candidate.mode === 'listing');
    candidate.row.dataset.tsimmTmoToken = token;
  }

  function prune(token = '') {
    document.querySelectorAll(`.${APP.badgeClass}`).forEach((badge) => {
      if (token && badge.dataset.tsimmTmoToken === token) return;
      badge.remove();
    });
    document.querySelectorAll('.tsimm-tmo-buy-row').forEach((row) => {
      if (token && row.dataset.tsimmTmoToken === token) return;
      row.classList.remove('tsimm-tmo-buy-row');
      delete row.dataset.tsimmTmoToken;
    });
  }

  function itemMarketPage() {
    const href = String(location.href || '').toLowerCase();
    return href.includes('itemmarket') || href.includes('item-market') || href.includes('imarket')
      || Boolean(document.querySelector(`.${APP.categoryMark},.${APP.listingMark}`));
  }

  function signedEach(value) {
    const match = clean(value).match(/([+-])\s*\$([\d,.]+)\s*ea/i);
    if (!match) return null;
    const amount = parseNumber(match[2]);
    if (!Number.isFinite(amount)) return null;
    return match[1] === '-' ? -amount : amount;
  }

  function trackedCaptionData(caption) {
    if (!(caption instanceof Element)) return null;
    const title = clean(caption.querySelector('strong')?.textContent);
    const detail = clean(caption.querySelector('span')?.textContent);
    if (!/TRACKED EXIT/i.test(title)) return null;
    const trader = clean(title.split('·').slice(1).join('·')) || 'Tracked trader';
    const payoutMatch = detail.match(/Pays\s+(\$[\d,.]+)/i);
    const ageMatch = detail.match(/captured\s+(.+?)\s+ago/i);
    const payout = payoutMatch ? parseNumber(payoutMatch[1]) : null;
    return { trader, payout, age: clean(ageMatch?.[1]) || 'fresh' };
  }

  function formatTrackedMargins() {
    document.querySelectorAll('.tsimm-track-floor-row').forEach((row) => row.classList.remove('tsimm-track-floor-row'));

    const floor = document.getElementById('tsimm-track-floor');
    if (floor) {
      const nextRow = floor.nextElementSibling;
      if (nextRow?.classList?.contains(APP.listingMark)) nextRow.classList.add('tsimm-track-floor-row');
      floor.remove();
    }

    const caption = document.getElementById('tsimm-track-caption');
    if (!caption) return;
    caption.classList.add('tsimm-track-caption-compact');

    const markers = [...document.querySelectorAll('.tsimm-track-profit')];
    const profits = [];
    for (const marker of markers) {
      const row = marker.closest(`.${APP.listingMark}`);
      if (!row) continue;
      let traderProfit = Number(marker.dataset.tsimmTrackTraderProfit);
      if (!Number.isFinite(traderProfit)) {
        traderProfit = signedEach(marker.textContent);
        if (Number.isFinite(traderProfit)) marker.dataset.tsimmTrackTraderProfit = String(traderProfit);
      }
      if (!Number.isFinite(traderProfit) || traderProfit <= 0) continue;
      profits.push(traderProfit);

      if (marker.parentElement !== row) row.appendChild(marker);
      row.classList.add('tsimm-track-format-row');

      const immProfit = signedEach(row.querySelector('.tsimm-margin-badge')?.textContent);
      let label = '';
      let flip = false;
      if (Number.isFinite(immProfit) && immProfit < 0) {
        label = `📌 FLIP +${money(traderProfit)}`;
        flip = true;
      } else if (Number.isFinite(immProfit)) {
        const extra = Math.max(0, traderProfit - immProfit);
        label = `📌 +${money(extra)} extra`;
      } else {
        label = `📌 +${money(traderProfit)}`;
      }
      if (marker.textContent !== label) marker.textContent = label;
      marker.classList.toggle('flip', flip);
    }

    const data = trackedCaptionData(caption);
    if (data && profits.length) {
      const best = Math.max(...profits);
      const payout = Number.isFinite(data.payout) ? money(data.payout) : 'captured payout';
      const html = `<strong>📌 ${escapeHtml(data.trader)} pays ${escapeHtml(payout)} · ${escapeHtml(data.age)} old</strong>`
        + `<span>${integer(profits.length)} profitable · best +${escapeHtml(money(best))} ea · buy below ${escapeHtml(payout)}</span>`;
      if (caption.innerHTML !== html) caption.innerHTML = html;
    }
  }

  function decorateMarket() {
    refreshIndex();
    decoratePanelButton();
    formatTrackedMargins();
    if (!settings.enabled || !itemMarketPage()) {
      prune();
      return;
    }
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    for (const candidate of [...categoryCandidates(), ...listingCandidates()]) {
      applyBadge(candidate, analyze(candidate), token);
    }
    prune(token);
    formatTrackedMargins();
  }

  function decoratePanelButton() {
    const actions = document.querySelector(`#${APP.panelId} .tsimm-actions`);
    if (!actions) return;
    const index = refreshIndex();
    let button = actions.querySelector('[data-tsimm-tmo-action="settings"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'tsimm-btn tsimm-tmo-settings-button';
      button.dataset.tsimmTmoAction = 'settings';
      actions.appendChild(button);
    }
    button.textContent = `Trader overlay (${integer(index.traderCount)})`;
  }

  function saveSettings() {
    const overlay = document.getElementById(APP.settingsOverlayId);
    if (!overlay) return;
    overlay.querySelectorAll('[data-tsimm-tmo-setting]').forEach((input) => {
      const key = input.dataset.tsimmTmoSetting;
      if (!(key in DEFAULTS)) return;
      settings[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
    });
    settings.minimumProfitEach = Math.max(0, Number(settings.minimumProfitEach) || 0);
    settings.minimumRoiPercent = Math.max(0, Number(settings.minimumRoiPercent) || 0);
    settings.minimumListingProfit = Math.max(0, Number(settings.minimumListingProfit) || 0);
    settings.actionableAgeHours = Math.max(1, Number(settings.actionableAgeHours) || 168);
    settings.freshAgeHours = Math.max(1, Math.min(settings.actionableAgeHours, Number(settings.freshAgeHours) || 72));
    settings.pricesShown = Math.max(1, Math.min(6, Math.floor(Number(settings.pricesShown) || 3)));
    saveJson(APP.settingsKey, settings);
    overlay.remove();
    prune();
    schedule(0);
    toast('Trader overlay settings saved.');
  }

  function openSettings() {
    const index = refreshIndex();
    let overlay = document.getElementById(APP.settingsOverlayId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = APP.settingsOverlayId;
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="tsimm-tmo-shell">
        <div class="tsimm-tmo-head"><div><strong>👥 Trader Market Overlay</strong><small>v${APP.version} · ${integer(index.traderCount)} traders · ${integer(index.itemCount)} items</small></div><button type="button" data-tsimm-tmo-action="close">×</button></div>
        <div class="tsimm-tmo-note">Trader prices remain visible as references. A teal BUY notice uses separate stricter rules and only appears when the best captured trader also beats NPC buyback and IMM's generic 99% route.</div>
        <div class="tsimm-tmo-grid">
          <label><span>Overlay enabled</span><input type="checkbox" data-tsimm-tmo-setting="enabled" ${settings.enabled ? 'checked' : ''}></label>
          <label><span>Minimum profit each</span><input type="number" min="0" step="1" value="${escapeHtml(settings.minimumProfitEach)}" data-tsimm-tmo-setting="minimumProfitEach"></label>
          <label><span>Minimum ROI %</span><input type="number" min="0" step="0.1" value="${escapeHtml(settings.minimumRoiPercent)}" data-tsimm-tmo-setting="minimumRoiPercent"></label>
          <label><span>Minimum listing profit</span><input type="number" min="0" step="1" value="${escapeHtml(settings.minimumListingProfit)}" data-tsimm-tmo-setting="minimumListingProfit"></label>
          <label><span>Actionable age hours</span><input type="number" min="1" step="1" value="${escapeHtml(settings.actionableAgeHours)}" data-tsimm-tmo-setting="actionableAgeHours"></label>
          <label><span>Fresh badge hours</span><input type="number" min="1" step="1" value="${escapeHtml(settings.freshAgeHours)}" data-tsimm-tmo-setting="freshAgeHours"></label>
          <label><span>Trader prices shown</span><input type="number" min="1" max="6" step="1" value="${escapeHtml(settings.pricesShown)}" data-tsimm-tmo-setting="pricesShown"></label>
          <label><span>Show reference prices</span><input type="checkbox" data-tsimm-tmo-setting="showReferencePrices" ${settings.showReferencePrices ? 'checked' : ''}></label>
        </div>
        <div class="tsimm-tmo-actions"><button type="button" data-tsimm-tmo-action="rebuild">Rebuild index</button><button class="primary" type="button" data-tsimm-tmo-action="save">Save and rescan</button></div>
      </div>`;
  }

  function toast(message) {
    let element = document.getElementById('tsimm-tmo-toast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'tsimm-tmo-toast';
      element.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:2147483647;padding:8px 11px;border:1px solid #25b8c1;border-radius:8px;background:#10272b;color:#eaffff;font:700 12px Arial,sans-serif;box-shadow:0 6px 20px #0009';
      document.body.appendChild(element);
    }
    element.textContent = message;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.remove(), 2600);
  }

  function injectStyles() {
    if (document.getElementById(APP.styleId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      .tsimm-tmo-settings-button{background:#075c68!important;border-color:#20aab6!important;color:#eaffff!important}
      .${APP.badgeClass}{display:grid;gap:2px;margin-top:4px;padding:5px 7px;min-width:155px;max-width:300px;box-sizing:border-box;border:1px solid #4d7279;border-radius:7px;background:#102228f2;color:#e8fbff;font:600 10px/1.25 Arial,sans-serif;white-space:normal;box-shadow:0 5px 14px #0008}.${APP.badgeClass} strong{font-size:11px;color:#8cecf4}.${APP.badgeClass} span{display:block}.${APP.badgeClass}.actionable{border-color:#27d5d0;background:#092e31f5;box-shadow:0 0 0 1px #27d5d055,0 6px 18px #0009}.${APP.badgeClass}.actionable strong{color:#6ffff4}.${APP.badgeClass}.stale{border-color:#8a7451;background:#2b2417f2;color:#e6d4b7}.${APP.badgeClass}.stale strong{color:#ffd78c}.tsimm-tmo-category{position:absolute;left:4px;bottom:4px;z-index:7;max-width:calc(100% - 8px)}.tsimm-tmo-buy-row{box-shadow:inset -4px 0 #27d5d0!important}
      #tsimm-track-caption{position:static!important;display:grid!important;gap:1px!important;width:auto!important;max-width:none!important;min-width:0!important;margin:4px 6px!important;padding:4px 7px!important;box-sizing:border-box!important;border-radius:5px!important;font:700 9px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:normal!important;box-shadow:none!important}#tsimm-track-caption strong{font-size:9px!important;white-space:normal!important}#tsimm-track-caption span{display:block!important;font-size:8px!important;opacity:.85!important}#tsimm-track-floor{display:none!important}.${APP.listingMark}{position:relative!important}.tsimm-track-format-row{position:relative!important}.tsimm-track-profit{position:absolute!important;inset-inline-end:clamp(72px,21%,150px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:112px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border-radius:4px!important;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}.tsimm-track-profit.flip{border-color:#6ee98a!important;background:#073411f2!important;color:#c8ffb4!important}.tsimm-track-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-track-floor-row{box-shadow:inset 0 2px #347c41!important}
      #${APP.settingsOverlayId}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:8px;background:#000c;color:#f4fbfc;font:12px/1.35 Arial,sans-serif}.tsimm-tmo-shell{width:min(560px,100%);max-height:95vh;overflow:auto;border:1px solid #2aa4ad;border-radius:12px;background:#171d24;box-shadow:0 14px 44px #000e}.tsimm-tmo-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;border-bottom:1px solid #345b62;background:#1d2d32}.tsimm-tmo-head>div{display:grid}.tsimm-tmo-head small{color:#a9c5c9}.tsimm-tmo-head button{border:1px solid #55727a;border-radius:7px;background:#293940;color:#fff;padding:5px 9px;font-weight:800}.tsimm-tmo-note{margin:8px;padding:8px;border:1px solid #35666d;border-radius:8px;background:#16282d;color:#cce8eb}.tsimm-tmo-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:0 8px 8px}.tsimm-tmo-grid label{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px;border:1px solid #3d5660;border-radius:8px;background:#202a32}.tsimm-tmo-grid input[type=number]{width:90px;border:1px solid #57727c;border-radius:6px;background:#11181d;color:#fff;padding:5px}.tsimm-tmo-actions{display:flex;justify-content:flex-end;gap:7px;padding:0 8px 9px}.tsimm-tmo-actions button{border:1px solid #55727c;border-radius:7px;background:#263943;color:#fff;padding:7px 9px;font-weight:800}.tsimm-tmo-actions button.primary{background:#087883;border-color:#23bdc4}
      @media(max-width:520px){.tsimm-tmo-grid{grid-template-columns:1fr}.tsimm-tmo-category{position:static;max-width:none;margin:5px}}
    `;
    document.head?.appendChild(style);
  }

  function schedule(delay = 50) {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateMarket, delay);
  }

  function bind() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tsimm-tmo-action]');
      if (!button) return;
      const action = button.dataset.tsimmTmoAction;
      if (action === 'settings') openSettings();
      else if (action === 'close') document.getElementById(APP.settingsOverlayId)?.remove();
      else if (action === 'save') saveSettings();
      else if (action === 'rebuild') {
        refreshIndex(true);
        openSettings();
        schedule(0);
        toast('Trader price index rebuilt.');
      }
    }, true);
  }

  function boot() {
    if (!document.body) {
      setTimeout(boot, 80);
      return;
    }
    injectStyles();
    bind();
    refreshIndex(true);
    observer = new MutationObserver((mutations) => {
      const external = mutations.some((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          return target instanceof Element
            && !target.matches?.(`.${APP.badgeClass}`)
            && !target.classList?.contains('tsimm-tmo-buy-row');
        }
        return [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
          node instanceof Element
          && !node.matches?.(`.${APP.badgeClass}`)
          && !node.closest?.(`.${APP.badgeClass}`)
        );
      });
      if (external) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', (event) => {
      if ([APP.tradersKey, APP.catalogKey, APP.sharedCatalogKey].includes(event.key)) {
        refreshIndex(true);
        schedule(0);
      }
    });
    pollTimer = setInterval(() => {
      let raw = '';
      try { raw = localStorage.getItem(APP.tradersKey) || ''; } catch {}
      if (raw !== traderSnapshot) {
        refreshIndex(true);
        schedule(0);
      }
    }, 2000);
    schedule(0);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizeTraderItem, normalizeTraders, normalizeCatalog, buildIndex, bestOtherExit, analyze, ageText };
  }
})();
