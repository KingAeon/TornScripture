// ==UserScript==
// @name         TornScripture - IMM Capture Return Guard
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Safely imports TornW3B/Weav3r price captures before stable IMM starts, then restores a clean responsive Torn page.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Capture-Return-Guard.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Capture-Return-Guard.user.js
// ==/UserScript==

(() => {
  'use strict';

  const APP = Object.freeze({
    version: '0.1.0',
    importQueryKey: 'tsimmPriceImport',
    tradersKey: 'tornscripture-imm-traders-v1',
    pendingKey: 'tornscripture-imm-pending-trader-capture-v1',
    catalogKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogKey: 'tornscripture-ish-torn-catalog-v1',
    bridgePrefix: 'TSIMM_PRICE_BRIDGE:',
    noticeKey: 'tornscripture-imm-capture-guard-notice-v1',
  });

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
    localStorage.setItem(key, JSON.stringify(value));
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

  function decodeBase64Url(value) {
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

  function normalizeCatalog(raw) {
    const result = { byId: {}, byName: {} };
    const source = raw?.itemsByName || raw?.items || {};
    const entries = Array.isArray(source)
      ? source.map((item) => [String(item?.id ?? ''), item])
      : Object.entries(source);
    for (const [key, item] of entries) {
      if (!item || typeof item !== 'object') continue;
      const id = Math.max(0, Math.floor(Number(item.id ?? item.itemId ?? key) || 0)) || null;
      const name = clean(item.name);
      if (!name) continue;
      const normalized = { id, name };
      if (id) result.byId[String(id)] = normalized;
      result.byName[nameKey(name)] = normalized;
    }
    return result;
  }

  function catalog() {
    const shared = normalizeCatalog(loadJson(APP.sharedCatalogKey, {}));
    const own = normalizeCatalog(loadJson(APP.catalogKey, {}));
    return {
      byId: { ...shared.byId, ...own.byId },
      byName: { ...shared.byName, ...own.byName },
    };
  }

  function captureItems(compact) {
    const values = catalog();
    if (!Array.isArray(compact?.i)) return [];
    return compact.i.map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const itemId = Math.max(0, Math.floor(Number(entry[0]) || 0)) || null;
      const unitPrice = Math.max(0, Number(entry[1]) || 0);
      const itemName = clean(entry[2])
        || (itemId ? values.byId[String(itemId)]?.name : '')
        || (itemId ? `Item ${itemId}` : '');
      if ((!itemId && !itemName) || !unitPrice) return null;
      return { itemId, itemName, normalizedName: nameKey(itemName), unitPrice };
    }).filter(Boolean);
  }

  function itemKey(item) {
    return Number(item?.itemId) > 0 ? `id:${Number(item.itemId)}` : `name:${nameKey(item?.itemName)}`;
  }

  function changedCount(previous, next) {
    const before = new Map((previous || []).map((item) => [itemKey(item), Number(item?.unitPrice) || 0]).filter(([key]) => key));
    const after = new Map((next || []).map((item) => [itemKey(item), Number(item?.unitPrice) || 0]).filter(([key]) => key));
    const keys = new Set([...before.keys(), ...after.keys()]);
    let changed = 0;
    for (const key of keys) {
      if (!before.has(key) || !after.has(key) || Math.round(before.get(key)) !== Math.round(after.get(key))) changed += 1;
    }
    return changed;
  }

  function findTraderIndex(traders, pending, identity) {
    const pendingName = nameKey(pending?.name);
    let index = traders.findIndex((trader) =>
      (pending?.traderId && String(trader?.id) === String(pending.traderId))
      || (Number(pending?.userId) > 0 && Number(trader?.userId) === Number(pending.userId))
      || (pendingName && nameKey(trader?.name) === pendingName)
    );
    if (index >= 0) return index;
    const identityName = nameKey(identity?.name);
    return traders.findIndex((trader) =>
      (identity?.traderId && String(trader?.id) === String(identity.traderId))
      || (Number(identity?.userId) > 0 && Number(trader?.userId) === Number(identity.userId))
      || (identityName && nameKey(trader?.name) === identityName)
    );
  }

  function clearBridgeName() {
    const raw = String(window.name || '');
    if (!raw.startsWith(APP.bridgePrefix)) return;
    try {
      const payload = JSON.parse(raw.slice(APP.bridgePrefix.length));
      window.name = clean(payload?.previousWindowName);
    } catch {
      window.name = '';
    }
  }

  function importCapture() {
    const url = new URL(location.href);
    const encoded = url.searchParams.get(APP.importQueryKey);
    if (!encoded) return false;

    const compact = decodeBase64Url(encoded);
    const items = captureItems(compact);
    if (!compact || !items.length) return false;

    const pending = loadJson(APP.pendingKey, null);
    const identity = compact.t && typeof compact.t === 'object' ? compact.t : {};
    const rawTraders = loadJson(APP.tradersKey, []);
    const traders = Array.isArray(rawTraders) ? rawTraders : Array.isArray(rawTraders?.traders) ? rawTraders.traders : [];
    let index = findTraderIndex(traders, pending, identity);

    if (index < 0) {
      const name = clean(pending?.name || identity.name)
        || (Number(pending?.userId || identity.userId) > 0 ? `Trader ${Number(pending?.userId || identity.userId)}` : 'Captured trader');
      traders.push({
        id: clean(pending?.traderId || identity.traderId) || `trader-${Date.now()}`,
        name,
        normalizedName: nameKey(name),
        userId: Number(pending?.userId || identity.userId) > 0 ? Number(pending?.userId || identity.userId) : null,
        rating: 0,
        targetPercent: 99,
        profileUrl: clean(identity.profileUrl),
        tradeUrl: clean(identity.tradeUrl),
        bannerUrl: clean(identity.bannerUrl),
        captureSource: 'weav3r-pricelist',
        pricePageItems: [],
        createdAt: new Date().toISOString(),
      });
      index = traders.length - 1;
    }

    const trader = traders[index];
    const now = new Date().toISOString();
    const sourceUrl = clean(compact.u);
    const previousItems = Array.isArray(trader.pricePageItems) ? trader.pricePageItems : [];
    const changes = changedCount(previousItems, items);
    traders[index] = {
      ...trader,
      normalizedName: nameKey(trader.name),
      previousPricePageUrl: sourceUrl && trader.pricePageUrl && sourceUrl !== trader.pricePageUrl
        ? trader.pricePageUrl
        : clean(trader.previousPricePageUrl),
      pricePageUrl: sourceUrl || clean(trader.pricePageUrl),
      pricePageTitle: clean(compact.l || trader.pricePageTitle).slice(0, 160),
      pricePageItems: items,
      pricePageCapturedAt: compact.c || now,
      pricePageLastCheckedAt: now,
      pricePageCaptureCount: Math.max(0, Math.floor(Number(trader.pricePageCaptureCount) || 0)) + 1,
      pricePageLastChangedCount: changes,
      pricePageLastResult: 'weav3r-pricelist:guard',
      updatedAt: now,
    };

    saveJson(APP.tradersKey, traders);
    localStorage.removeItem(APP.pendingKey);
    clearBridgeName();
    url.searchParams.delete(APP.importQueryKey);
    try {
      sessionStorage.setItem(APP.noticeKey, JSON.stringify({
        trader: traders[index].name,
        count: items.length,
        changes,
      }));
    } catch {}
    location.replace(url.href);
    return true;
  }

  function showNoticeWhenReady() {
    let payload = null;
    try {
      payload = JSON.parse(sessionStorage.getItem(APP.noticeKey) || 'null');
      sessionStorage.removeItem(APP.noticeKey);
    } catch {
      payload = null;
    }
    if (!payload) return;
    const mount = () => {
      if (!document.body) {
        setTimeout(mount, 60);
        return;
      }
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;max-width:min(88vw,420px);padding:12px 14px;border:1px solid #36d399;border-radius:10px;background:#13231e;color:#eafff7;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4)';
      box.textContent = `${payload.trader}: ${Number(payload.count).toLocaleString()} prices saved. IMM controls restored.`;
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 5000);
    };
    mount();
  }

  try {
    if (importCapture()) return;
  } catch (error) {
    console.error('[TornScripture IMM Capture Guard] Import failed:', error);
  }
  showNoticeWhenReady();
})();
