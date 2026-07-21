// ==UserScript==
// @name         TornScripture - IMM Trader Extensions
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.2.0
// @description  Adds favorite-trader watchlists, item-centric tracking, and best fresh trader-exit prompts to IMM.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Extensions.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Extensions.user.js
// ==/UserScript==

(() => {
  'use strict';

  const A = Object.freeze({
    v: '0.2.0',
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

  function toggleFavorite(trader) {
    const store = favoriteStore();
    const index = store.entries.findIndex((entry) => favoriteMatches(entry, trader));
    if (index >= 0) store.entries.splice(index, 1);
    else store.entries.push({ traderId: trader.id, traderName: trader.name, addedAt: new Date().toISOString() });
    saveFavorites(store);
    scheduleTorn();
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
    dock.innerHTML = `<div class="watch-copy"><small>ITEM-CENTRIC WATCH · ${esc(selectedDeal.trader.name)}</small><strong>${esc(selectedDeal.item.name)}</strong><span>This trader pays ${cash(selectedDeal.item.price)} · compare with every favorite</span></div><button type="button" class="${favorite ? 'on' : ''}" data-watch-favorite-toggle>${favorite ? '★ TRADER' : '☆ TRADER'}</button><button type="button" class="${watched ? 'on' : ''}" data-watch-item-toggle>${watched ? '★ WATCHED' : '☆ WATCH'}</button>`;
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
      button.classList.toggle('on', favorite);
      button.textContent = favorite ? '★ FAVORITE' : '☆ FAVORITE';
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
          toggleFavorite(selectedDeal.trader);
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
          if (trader) toggleFavorite(trader);
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
