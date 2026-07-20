// ==UserScript==
// @name         TornScripture - IMM Trader Price Report
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Adds a lazy-loaded trader-vs-market price report to the stable IMM Trader Book without changing IMM startup.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Report.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Report.user.js
// ==/UserScript==

(() => {
  'use strict';

  const ADDON = Object.freeze({
    version: '0.1.0',
    overlayId: 'tornscripture-imm-trader-report-addon',
    styleId: 'tornscripture-imm-trader-report-addon-style',
    traderOverlayId: 'tornscripture-imm-traders',
    tradersStorageKey: 'tornscripture-imm-traders-v1',
    catalogStorageKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogStorageKey: 'tornscripture-ish-torn-catalog-v1',
    ledgerStorageKey: 'tornscripture-imm-ledger-v1',
    settingsStorageKey: 'tornscripture-imm-report-addon-settings-v1',
  });

  const DEFAULT_SETTINGS = Object.freeze({
    nearWindowPercent: 2,
    ownedOnly: false,
    bucket: 'all',
    search: '',
    sort: 'payout-desc',
    limit: 200,
  });

  let ui = { ...DEFAULT_SETTINGS, ...loadJson(ADDON.settingsStorageKey, {}) };
  let activeTraderId = null;
  let decorateTimer = null;
  let observer = null;

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      const parsed = JSON.parse(raw);
      return parsed ?? clone(fallback);
    } catch {
      return clone(fallback);
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The report remains usable for this session even when persistence fails.
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatMoney(value) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function formatInteger(value) {
    return new Intl.NumberFormat().format(Math.floor(Number(value) || 0));
  }

  function formatPercent(value) {
    const number = Number(value) || 0;
    return `${number.toFixed(Math.abs(number) >= 10 ? 1 : 2)}%`;
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
    };
  }

  function normalizeTraders(raw) {
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.traders) ? raw.traders : [];
    return source.map((candidate) => {
      if (!candidate || typeof candidate !== 'object') return null;
      const name = normalizeWhitespace(candidate.name ?? candidate.username);
      if (!name) return null;
      const pricePageItems = Array.isArray(candidate.pricePageItems ?? candidate.pricingItems)
        ? (candidate.pricePageItems ?? candidate.pricingItems).map(normalizeTraderPriceItem).filter(Boolean)
        : [];
      return {
        ...candidate,
        id: normalizeWhitespace(candidate.recordId)
          || normalizeWhitespace(candidate.uuid)
          || (typeof candidate.id === 'string' ? normalizeWhitespace(candidate.id) : '')
          || `trader-${normalizeName(name)}`,
        name,
        normalizedName: normalizeName(name),
        targetPercent: Math.max(0, Math.min(100, Number(candidate.targetPercent ?? candidate.preferredPercent) || 99)),
        pricePageItems,
      };
    }).filter(Boolean);
  }

  function normalizeCatalogItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const value = raw.value && typeof raw.value === 'object' ? raw.value : {};
    const id = Number(raw.id ?? raw.itemId);
    const name = normalizeWhitespace(raw.name);
    const marketPrice = Number(raw.marketPrice ?? raw.market_price ?? value.market_price) || 0;
    if (!name || marketPrice <= 0) return null;
    return {
      id: Number.isFinite(id) && id > 0 ? id : null,
      name,
      normalizedName: normalizeName(name),
      marketPrice,
    };
  }

  function normalizeCatalog(rawCatalog) {
    const normalized = { updatedAt: rawCatalog?.updatedAt || null, itemsByName: {}, itemsById: {} };
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

  function mergedCatalog() {
    const shared = normalizeCatalog(loadJson(ADDON.sharedCatalogStorageKey, {}));
    const own = normalizeCatalog(loadJson(ADDON.catalogStorageKey, {}));
    return {
      updatedAt: own.updatedAt || shared.updatedAt || null,
      itemsByName: { ...shared.itemsByName, ...own.itemsByName },
      itemsById: { ...shared.itemsById, ...own.itemsById },
    };
  }

  function catalogItemFor(catalog, itemName, itemId = null) {
    if (itemId && catalog.itemsById?.[String(itemId)]) return catalog.itemsById[String(itemId)];
    return catalog.itemsByName?.[normalizeName(itemName)] || null;
  }

  function openHoldings() {
    const raw = loadJson(ADDON.ledgerStorageKey, {});
    const lots = Array.isArray(raw?.lots) ? raw.lots : [];
    const byId = new Map();
    const byName = new Map();
    for (const lot of lots) {
      const quantity = Math.max(0, Math.floor(Number(lot?.remainingQuantity) || 0));
      if (!quantity) continue;
      const unitCost = Math.max(0, Number(lot?.unitCost) || 0);
      const payload = { quantity, costBasis: quantity * unitCost };
      if (Number(lot?.itemId) > 0) mergeHolding(byId, String(Number(lot.itemId)), payload);
      const nameKey = normalizeName(lot?.itemName);
      if (nameKey) mergeHolding(byName, nameKey, payload);
    }
    return { byId, byName };
  }

  function mergeHolding(map, key, payload) {
    const previous = map.get(key) || { quantity: 0, costBasis: 0 };
    map.set(key, {
      quantity: previous.quantity + payload.quantity,
      costBasis: previous.costBasis + payload.costBasis,
    });
  }

  function reportRows(trader, catalog = mergedCatalog(), holdings = openHoldings(), nearWindow = ui.nearWindowPercent) {
    if (!trader) return [];
    const targetPercent = Math.max(0, Math.min(100, Number(trader.targetPercent) || 99));
    const near = Math.max(0, Number(nearWindow) || 0);
    const nearFloorPercent = Math.max(0, targetPercent - near);
    return (trader.pricePageItems || []).map((rawItem) => {
      const item = normalizeTraderPriceItem(rawItem);
      if (!item) return null;
      const catalogItem = catalogItemFor(catalog, item.itemName, item.itemId);
      const marketPrice = Math.max(0, Number(catalogItem?.marketPrice) || 0);
      const traderPrice = Math.max(0, Number(item.unitPrice) || 0);
      const payoutPercent = marketPrice > 0 ? traderPrice / marketPrice * 100 : null;
      const targetPayout = marketPrice > 0 ? Math.floor(marketPrice * targetPercent / 100) : 0;
      const gapToTarget = marketPrice > 0 ? traderPrice - targetPayout : null;
      let bucket = 'unknown';
      if (payoutPercent !== null) {
        if (traderPrice >= targetPayout) bucket = 'sell';
        else if (payoutPercent >= nearFloorPercent) bucket = 'near';
        else bucket = 'withhold';
      }
      const holding = (item.itemId ? holdings.byId.get(String(item.itemId)) : null)
        || holdings.byName.get(item.normalizedName)
        || { quantity: 0, costBasis: 0 };
      const ownedQuantity = Math.max(0, Math.floor(Number(holding.quantity) || 0));
      const ownedCostBasis = Math.max(0, Number(holding.costBasis) || 0);
      return {
        ...item,
        traderPrice,
        marketPrice,
        payoutPercent,
        targetPercent,
        targetPayout,
        gapToTarget,
        bucket,
        ownedQuantity,
        ownedCostBasis,
        ownedTraderReturn: ownedQuantity * traderPrice,
        ownedProfit: ownedQuantity ? ownedQuantity * traderPrice - ownedCostBasis : 0,
      };
    }).filter(Boolean);
  }

  function reportCounts(rows) {
    const counts = { all: rows.length, sell: 0, near: 0, withhold: 0, unknown: 0, owned: 0 };
    for (const row of rows) {
      if (Object.hasOwn(counts, row.bucket)) counts[row.bucket] += 1;
      if (row.ownedQuantity > 0) counts.owned += 1;
    }
    return counts;
  }

  function filteredRows(rows) {
    let result = [...rows];
    if (ui.bucket !== 'all') result = result.filter((row) => row.bucket === ui.bucket);
    if (ui.ownedOnly) result = result.filter((row) => row.ownedQuantity > 0);
    const query = normalizeName(ui.search);
    if (query) result = result.filter((row) => row.normalizedName.includes(query) || String(row.itemId || '').includes(query));
    return sortRows(result, ui.sort);
  }

  function sortRows(rows, sort) {
    const copy = [...rows];
    const percent = (row, fallback) => row.payoutPercent === null ? fallback : Number(row.payoutPercent);
    copy.sort((a, b) => {
      if (sort === 'payout-asc') return percent(a, Infinity) - percent(b, Infinity) || a.itemName.localeCompare(b.itemName);
      if (sort === 'gap-desc') return Number(b.gapToTarget ?? -Infinity) - Number(a.gapToTarget ?? -Infinity) || a.itemName.localeCompare(b.itemName);
      if (sort === 'gap-asc') return Number(a.gapToTarget ?? Infinity) - Number(b.gapToTarget ?? Infinity) || a.itemName.localeCompare(b.itemName);
      if (sort === 'price-desc') return Number(b.traderPrice) - Number(a.traderPrice) || a.itemName.localeCompare(b.itemName);
      if (sort === 'name') return a.itemName.localeCompare(b.itemName);
      return percent(b, -Infinity) - percent(a, -Infinity) || a.itemName.localeCompare(b.itemName);
    });
    return copy;
  }

  function bucketLabel(bucket) {
    return {
      sell: 'SELL TO TRADER',
      near: 'NEAR TARGET',
      withhold: 'WITHHOLD',
      unknown: 'NO MARKET VALUE',
    }[bucket] || 'UNKNOWN';
  }

  function allTraders() {
    return normalizeTraders(loadJson(ADDON.tradersStorageKey, []));
  }

  function findTrader(traderId) {
    return allTraders().find((trader) => trader.id === traderId) || null;
  }

  function injectStyles() {
    if (document.getElementById(ADDON.styleId)) return;
    const style = document.createElement('style');
    style.id = ADDON.styleId;
    style.textContent = `
      .tsimm-addon-report-button{background:#23577a!important;border-color:#3f8fc0!important;color:#e5f6ff!important}
      #${ADDON.overlayId}{position:fixed;inset:0;z-index:2147483645;background:#000c;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f3f7fa}
      .tsimm-ar-shell{width:min(720px,100%);max-height:95vh;display:flex;flex-direction:column;background:#171d24;border:1px solid #50718a;border-radius:12px;box-shadow:0 14px 44px #000e;overflow:hidden}
      .tsimm-ar-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;border-bottom:1px solid #394b5a;background:#1f2a34}.tsimm-ar-head>div{display:grid}.tsimm-ar-head small{color:#a9bdcc}.tsimm-ar-head button{border:1px solid #566b7c;border-radius:7px;background:#293642;color:#fff;padding:5px 9px;font-weight:800}
      .tsimm-ar-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:8px}.tsimm-ar-summary>div{display:grid;gap:2px;padding:7px;border:1px solid #41505d;border-radius:8px;background:#202a33}.tsimm-ar-summary strong{font-size:17px}.tsimm-ar-summary span{font-size:9px;text-transform:uppercase;color:#aebdca}.tsimm-ar-summary .sell strong{color:#62e49c}.tsimm-ar-summary .near strong{color:#f1c85d}.tsimm-ar-summary .withhold strong{color:#ff7f89}
      .tsimm-ar-note{margin:0 8px 8px;padding:7px;border:1px solid #405466;border-radius:7px;background:#202a34;color:#c8d8e4}
      .tsimm-ar-actions{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:0 8px 8px}.tsimm-ar-actions button,.tsimm-ar-actions label{display:flex;align-items:center;gap:5px;border:1px solid #506779;border-radius:7px;background:#293744;color:#fff;padding:6px 8px;font-weight:700}.tsimm-ar-actions input[type=number]{width:55px;border:1px solid #60788a;border-radius:5px;background:#13191e;color:#fff;padding:3px}
      .tsimm-ar-tabs{display:flex;gap:4px;overflow:auto;padding:0 8px 8px}.tsimm-ar-tabs button{white-space:nowrap;border:1px solid #4a5c69;border-radius:999px;background:#252e36;color:#dce7ee;padding:5px 8px;font-weight:700}.tsimm-ar-tabs button.active{background:#37617e;border-color:#64add8;color:#fff}
      .tsimm-ar-controls{display:grid;grid-template-columns:1fr 160px;gap:5px;padding:0 8px 8px}.tsimm-ar-controls input,.tsimm-ar-controls select{min-width:0;border:1px solid #52697a;border-radius:7px;background:#12181d;color:#fff;padding:7px}
      .tsimm-ar-list{overflow:auto;display:grid;gap:6px;padding:0 8px 10px}.tsimm-ar-row{padding:7px;border:1px solid #4b5964;border-radius:8px;background:#212930}.tsimm-ar-row.sell{border-color:#39885d}.tsimm-ar-row.near{border-color:#90763a}.tsimm-ar-row.withhold{border-color:#94444f}.tsimm-ar-row.unknown{border-color:#626971}.tsimm-ar-row-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.tsimm-ar-row-head b{font-size:9px;border:1px solid currentColor;border-radius:999px;padding:2px 6px}.tsimm-ar-row.sell .tsimm-ar-row-head b{color:#62e49c}.tsimm-ar-row.near .tsimm-ar-row-head b{color:#f1c85d}.tsimm-ar-row.withhold .tsimm-ar-row-head b{color:#ff7f89}.tsimm-ar-row.unknown .tsimm-ar-row-head b{color:#bbc3ca}.tsimm-ar-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px;margin-top:6px}.tsimm-ar-grid span{color:#aebbc5}.tsimm-ar-grid strong{text-align:right}.tsimm-ar-owned{display:block;margin-top:6px;padding-top:5px;border-top:1px solid #3e4b55;color:#84d3ff}.tsimm-ar-good{color:#64e39d}.tsimm-ar-bad{color:#ff828c}.tsimm-ar-muted{color:#aeb8c0}.tsimm-ar-more{border:1px solid #52697a;border-radius:7px;background:#293744;color:#fff;padding:8px;font-weight:700}
      @media(max-width:520px){.tsimm-ar-summary{grid-template-columns:repeat(2,1fr)}.tsimm-ar-controls{grid-template-columns:1fr}.tsimm-ar-shell{max-height:97vh}}
    `;
    document.head?.appendChild(style);
  }

  function decorateTraderBook() {
    const overlay = document.getElementById(ADDON.traderOverlayId);
    if (!overlay) return;
    const traders = new Map(allTraders().map((trader) => [trader.id, trader]));
    overlay.querySelectorAll('.tsimm-trader-card').forEach((card) => {
      const reference = card.querySelector('[data-tsimm-action="trader-edit"][data-tsimm-trader-id]');
      if (!reference) return;
      const traderId = reference.dataset.tsimmTraderId;
      const trader = traders.get(traderId);
      let button = card.querySelector('[data-tsimm-addon-action="open-report"]');
      if (!trader?.pricePageItems?.length) {
        button?.remove();
        return;
      }
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'tsimm-addon-report-button';
        button.dataset.tsimmAddonAction = 'open-report';
        button.dataset.tsimmTraderId = traderId;
        button.textContent = 'Price report';
        reference.parentElement?.insertBefore(button, reference);
      }
    });
  }

  function scheduleDecorate(delay = 40) {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateTraderBook, delay);
  }

  function rowHtml(row) {
    const percent = row.payoutPercent === null ? 'Unknown' : formatPercent(row.payoutPercent);
    const gap = row.gapToTarget === null
      ? 'No comparison'
      : `${row.gapToTarget >= 0 ? '+' : ''}${formatMoney(row.gapToTarget)} vs target`;
    const owned = row.ownedQuantity > 0
      ? `<span class="tsimm-ar-owned">Owned × ${formatInteger(row.ownedQuantity)} · return ${formatMoney(row.ownedTraderReturn)} · tracked profit ${row.ownedProfit >= 0 ? '+' : ''}${formatMoney(row.ownedProfit)}</span>`
      : '';
    return `
      <article class="tsimm-ar-row ${escapeHtml(row.bucket)}">
        <div class="tsimm-ar-row-head"><strong>${escapeHtml(row.itemName)}</strong><b>${escapeHtml(bucketLabel(row.bucket))}</b></div>
        <div class="tsimm-ar-grid">
          <span>Trader pays</span><strong>${formatMoney(row.traderPrice)}</strong>
          <span>Market value</span><strong>${row.marketPrice > 0 ? formatMoney(row.marketPrice) : 'Not synced'}</strong>
          <span>Market payout</span><strong>${escapeHtml(percent)}</strong>
          <span>Target gap</span><strong class="${row.gapToTarget === null ? 'tsimm-ar-muted' : row.gapToTarget >= 0 ? 'tsimm-ar-good' : 'tsimm-ar-bad'}">${escapeHtml(gap)}</strong>
        </div>
        ${owned}
      </article>
    `;
  }

  function renderReport() {
    const overlay = document.getElementById(ADDON.overlayId);
    if (!overlay) return;
    const trader = findTrader(activeTraderId);
    if (!trader) {
      overlay.remove();
      activeTraderId = null;
      return;
    }
    const catalog = mergedCatalog();
    const rows = reportRows(trader, catalog, openHoldings(), ui.nearWindowPercent);
    const counts = reportCounts(rows);
    const filtered = filteredRows(rows);
    const limit = Math.max(50, Math.floor(Number(ui.limit) || 200));
    const shown = filtered.slice(0, limit);
    const synced = catalog.updatedAt ? new Date(catalog.updatedAt).toLocaleString() : 'Never';
    const captured = trader.pricePageLastCheckedAt || trader.pricePageCapturedAt;
    const capturedText = captured ? new Date(captured).toLocaleString() : 'Unknown';
    const tabs = [
      ['all', 'All', counts.all],
      ['sell', 'Sell', counts.sell],
      ['near', 'Near', counts.near],
      ['withhold', 'Withhold', counts.withhold],
      ['unknown', 'No market', counts.unknown],
    ].map(([value, label, count]) => `<button type="button" class="${ui.bucket === value ? 'active' : ''}" data-tsimm-addon-action="filter" data-bucket="${value}">${label} ${formatInteger(count)}</button>`).join('');

    overlay.innerHTML = `
      <div class="tsimm-ar-shell">
        <div class="tsimm-ar-head">
          <div><strong>📊 ${escapeHtml(trader.name)} Price Report</strong><small>Lazy add-on v${ADDON.version} · IMM startup remains untouched</small></div>
          <button type="button" data-tsimm-addon-action="close">×</button>
        </div>
        <div class="tsimm-ar-summary">
          <div class="sell"><strong>${formatInteger(counts.sell)}</strong><span>sell to trader</span></div>
          <div class="near"><strong>${formatInteger(counts.near)}</strong><span>near target</span></div>
          <div class="withhold"><strong>${formatInteger(counts.withhold)}</strong><span>withhold</span></div>
          <div><strong>${formatInteger(counts.owned)}</strong><span>owned matches</span></div>
        </div>
        <div class="tsimm-ar-note">Sell means at least ${escapeHtml(formatPercent(trader.targetPercent))} of market. Near means within ${escapeHtml(formatPercent(ui.nearWindowPercent))} below that target. Market values synced ${escapeHtml(synced)}; trader prices captured ${escapeHtml(capturedText)}.</div>
        <div class="tsimm-ar-actions">
          <button type="button" data-tsimm-addon-action="reload">Reload saved data</button>
          <button type="button" data-tsimm-addon-action="copy">Copy report</button>
          <label><input type="checkbox" data-tsimm-addon-owned ${ui.ownedOnly ? 'checked' : ''}> Owned only</label>
          <label>Near range <input type="number" min="0" max="25" step="0.5" value="${escapeHtml(ui.nearWindowPercent)}" data-tsimm-addon-near></label>
        </div>
        <div class="tsimm-ar-tabs">${tabs}</div>
        <div class="tsimm-ar-controls">
          <input type="search" placeholder="Search item or ID" value="${escapeHtml(ui.search)}" data-tsimm-addon-search>
          <select data-tsimm-addon-sort>
            <option value="payout-desc" ${ui.sort === 'payout-desc' ? 'selected' : ''}>Payout % high</option>
            <option value="payout-asc" ${ui.sort === 'payout-asc' ? 'selected' : ''}>Payout % low</option>
            <option value="gap-desc" ${ui.sort === 'gap-desc' ? 'selected' : ''}>Best target gap</option>
            <option value="gap-asc" ${ui.sort === 'gap-asc' ? 'selected' : ''}>Worst target gap</option>
            <option value="price-desc" ${ui.sort === 'price-desc' ? 'selected' : ''}>Trader price high</option>
            <option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Item name</option>
          </select>
        </div>
        <div class="tsimm-ar-list">
          ${shown.length ? shown.map(rowHtml).join('') : '<div class="tsimm-ar-note">No items match this report filter.</div>'}
          ${filtered.length > shown.length ? `<button type="button" class="tsimm-ar-more" data-tsimm-addon-action="more">Show ${formatInteger(Math.min(200, filtered.length - shown.length))} more · ${formatInteger(filtered.length - shown.length)} hidden</button>` : ''}
        </div>
      </div>
    `;
  }

  function openReport(traderId) {
    const trader = findTrader(traderId);
    if (!trader?.pricePageItems?.length) {
      notify('Capture this trader’s pricelist first.');
      return;
    }
    injectStyles();
    activeTraderId = trader.id;
    ui = { ...ui, bucket: 'all', search: '', sort: 'payout-desc', ownedOnly: false, limit: 200 };
    persistUi();
    let overlay = document.getElementById(ADDON.overlayId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = ADDON.overlayId;
      document.body.appendChild(overlay);
    }
    renderReport();
  }

  function closeReport() {
    document.getElementById(ADDON.overlayId)?.remove();
    activeTraderId = null;
  }

  function persistUi() {
    saveJson(ADDON.settingsStorageKey, {
      nearWindowPercent: Math.max(0, Number(ui.nearWindowPercent) || 0),
      ownedOnly: Boolean(ui.ownedOnly),
      bucket: ui.bucket,
      search: ui.search,
      sort: ui.sort,
      limit: ui.limit,
    });
  }

  async function copyReport() {
    const trader = findTrader(activeTraderId);
    if (!trader) return;
    const rows = filteredRows(reportRows(trader));
    const lines = [
      `${trader.name} price report`,
      `Target: ${formatPercent(trader.targetPercent)} of market`,
      `Near range: ${formatPercent(ui.nearWindowPercent)} below target`,
      '',
      'Recommendation\tItem\tTrader price\tMarket value\tPayout %\tTarget gap\tOwned',
      ...rows.map((row) => [
        bucketLabel(row.bucket),
        row.itemName,
        row.traderPrice,
        row.marketPrice || '',
        row.payoutPercent === null ? '' : row.payoutPercent.toFixed(2),
        row.gapToTarget === null ? '' : row.gapToTarget,
        row.ownedQuantity || 0,
      ].join('\t')),
    ];
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify(`Copied ${formatInteger(rows.length)} report rows.`);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      notify(`Copied ${formatInteger(rows.length)} report rows.`);
    }
  }

  function notify(message) {
    let toast = document.getElementById('tsimm-report-addon-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tsimm-report-addon-toast';
      toast.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:2147483647;padding:8px 11px;border-radius:8px;background:#17212a;color:#fff;border:1px solid #4f7189;box-shadow:0 6px 20px #0009;font:12px Arial,sans-serif';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.remove(), 2600);
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tsimm-addon-action]');
      if (!button) return;
      const action = button.dataset.tsimmAddonAction;
      if (action === 'open-report') openReport(button.dataset.tsimmTraderId);
      else if (action === 'close') closeReport();
      else if (action === 'reload') renderReport();
      else if (action === 'copy') copyReport();
      else if (action === 'filter') {
        ui.bucket = ['all', 'sell', 'near', 'withhold', 'unknown'].includes(button.dataset.bucket) ? button.dataset.bucket : 'all';
        ui.limit = 200;
        persistUi();
        renderReport();
      } else if (action === 'more') {
        ui.limit = Math.max(200, Number(ui.limit) || 200) + 200;
        persistUi();
        renderReport();
      }
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-tsimm-addon-owned]')) {
        ui.ownedOnly = event.target.checked;
        ui.limit = 200;
        persistUi();
        renderReport();
      } else if (event.target.matches('[data-tsimm-addon-sort]')) {
        ui.sort = ['payout-desc', 'payout-asc', 'gap-desc', 'gap-asc', 'price-desc', 'name'].includes(event.target.value)
          ? event.target.value
          : 'payout-desc';
        ui.limit = 200;
        persistUi();
        renderReport();
      } else if (event.target.matches('[data-tsimm-addon-near]')) {
        ui.nearWindowPercent = Math.max(0, Math.min(25, Number(event.target.value) || 0));
        ui.limit = 200;
        persistUi();
        renderReport();
      }
    }, true);

    document.addEventListener('input', (event) => {
      if (!event.target.matches('[data-tsimm-addon-search]')) return;
      const cursor = event.target.selectionStart ?? event.target.value.length;
      ui.search = event.target.value;
      ui.limit = 200;
      persistUi();
      renderReport();
      const replacement = document.querySelector(`#${ADDON.overlayId} [data-tsimm-addon-search]`);
      if (replacement) {
        replacement.focus();
        replacement.setSelectionRange(cursor, cursor);
      }
    }, true);
  }

  function boot() {
    if (!document.body) {
      setTimeout(boot, 80);
      return;
    }
    injectStyles();
    bindEvents();
    observer = new MutationObserver(() => scheduleDecorate());
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleDecorate(0);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      normalizeName,
      normalizeTraderPriceItem,
      normalizeTraders,
      normalizeCatalog,
      reportRows,
      reportCounts,
      sortRows,
      bucketLabel,
    };
  }
})();
