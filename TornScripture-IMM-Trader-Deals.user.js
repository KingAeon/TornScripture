// ==UserScript==
// @name         TornScripture - IMM Trader Deals
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Adds a Deals report to each captured IMM trader, highlighting prices near or above Torn market value.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Deals.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Deals.user.js
// ==/UserScript==

(() => {
  'use strict';

  const APP = Object.freeze({
    version: '0.1.0',
    tradersKey: 'tornscripture-imm-traders-v1',
    catalogKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogKey: 'tornscripture-ish-torn-catalog-v1',
    ledgerKey: 'tornscripture-imm-ledger-v1',
    settingsKey: 'tornscripture-imm-trader-deals-settings-v1',
    traderOverlayId: 'tornscripture-imm-traders',
    overlayId: 'tornscripture-imm-trader-deals',
    styleId: 'tornscripture-imm-trader-deals-style',
  });

  const defaults = Object.freeze({
    nearFloor: 97,
    bucket: 'deals',
    search: '',
    sort: 'percent-desc',
    ownedOnly: false,
    limit: 200,
  });

  let ui = { ...defaults, ...read(APP.settingsKey, {}) };
  let activeTraderId = null;
  let decorateTimer = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch { return clone(fallback); }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
  function keyName(value) {
    return clean(value).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'+&-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function esc(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
  function money(value) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  function integer(value) { return new Intl.NumberFormat().format(Math.floor(Number(value) || 0)); }
  function percent(value) { return `${(Number(value) || 0).toFixed(Math.abs(Number(value) || 0) >= 10 ? 1 : 2)}%`; }
  function signed(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'No comparison';
    return `${Number(value) >= 0 ? '+' : ''}${money(value)}`;
  }

  function traders() {
    const raw = read(APP.tradersKey, []);
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.traders) ? raw.traders : [];
    return source.map((candidate) => {
      const name = clean(candidate?.name ?? candidate?.username);
      if (!name) return null;
      const items = Array.isArray(candidate?.pricePageItems ?? candidate?.pricingItems)
        ? (candidate.pricePageItems ?? candidate.pricingItems).map((item) => {
            const itemName = clean(item?.itemName ?? item?.name);
            const itemId = Number(item?.itemId ?? item?.id) > 0 ? Number(item.itemId ?? item.id) : null;
            const price = Math.max(0, Number(item?.unitPrice ?? item?.price ?? item?.value) || 0);
            if ((!itemName && !itemId) || !price) return null;
            return { itemId, itemName: itemName || `Item ${itemId}`, nameKey: keyName(itemName || `Item ${itemId}`), price };
          }).filter(Boolean)
        : [];
      return {
        ...candidate,
        id: clean(candidate?.recordId) || clean(candidate?.uuid) || (typeof candidate?.id === 'string' ? clean(candidate.id) : '') || `trader-${keyName(name)}`,
        name,
        items,
        capturedAt: candidate?.pricePageLastCheckedAt || candidate?.pricePageCapturedAt || null,
      };
    }).filter(Boolean);
  }

  function normalizeCatalog(raw) {
    const result = { byId: {}, byName: {}, updatedAt: raw?.updatedAt || null };
    const source = raw?.itemsByName || raw?.items || {};
    const entries = Array.isArray(source) ? source.map((item) => [String(item?.id ?? ''), item]) : Object.entries(source);
    for (const [key, candidate] of entries) {
      const item = candidate?.value && typeof candidate.value === 'object' ? { ...candidate, ...candidate.value } : candidate;
      const id = Number(item?.id ?? item?.itemId ?? key) > 0 ? Number(item.id ?? item.itemId ?? key) : null;
      const name = clean(item?.name);
      const market = Math.max(0, Number(item?.marketPrice ?? item?.market_price) || 0);
      if (!name || !market) continue;
      const value = { id, name, market };
      if (id) result.byId[String(id)] = value;
      result.byName[keyName(name)] = value;
    }
    return result;
  }

  function catalog() {
    const shared = normalizeCatalog(read(APP.sharedCatalogKey, {}));
    const own = normalizeCatalog(read(APP.catalogKey, {}));
    return {
      updatedAt: own.updatedAt || shared.updatedAt || null,
      byId: { ...shared.byId, ...own.byId },
      byName: { ...shared.byName, ...own.byName },
    };
  }

  function holdings() {
    const raw = read(APP.ledgerKey, {});
    const lots = Array.isArray(raw?.lots) ? raw.lots : [];
    const byId = new Map();
    const byName = new Map();
    for (const lot of lots) {
      const quantity = Math.max(0, Math.floor(Number(lot?.remainingQuantity) || 0));
      if (!quantity) continue;
      const cost = quantity * Math.max(0, Number(lot?.unitCost) || 0);
      const merge = (map, key) => {
        if (!key) return;
        const old = map.get(key) || { quantity: 0, cost: 0 };
        map.set(key, { quantity: old.quantity + quantity, cost: old.cost + cost });
      };
      if (Number(lot?.itemId) > 0) merge(byId, String(Number(lot.itemId)));
      merge(byName, keyName(lot?.itemName));
    }
    return { byId, byName };
  }

  function rowsFor(trader) {
    const values = catalog();
    const owned = holdings();
    const nearFloor = Math.max(0, Math.min(98.9, Number(ui.nearFloor) || 97));
    return trader.items.map((item) => {
      const value = (item.itemId ? values.byId[String(item.itemId)] : null) || values.byName[item.nameKey] || null;
      const market = Math.max(0, Number(value?.market) || 0);
      const payoutPercent = market > 0 ? item.price / market * 100 : null;
      const route99 = market > 0 ? Math.floor(market * 0.99) : 0;
      let bucket = 'unknown';
      if (payoutPercent !== null) {
        if (payoutPercent >= 100) bucket = 'premium';
        else if (payoutPercent >= 99) bucket = 'strong';
        else if (payoutPercent >= nearFloor) bucket = 'near';
        else bucket = 'withhold';
      }
      const holding = (item.itemId ? owned.byId.get(String(item.itemId)) : null) || owned.byName.get(item.nameKey) || { quantity: 0, cost: 0 };
      return {
        ...item,
        market,
        payoutPercent,
        marketDifference: market ? item.price - market : null,
        routeDifference: market ? item.price - route99 : null,
        bucket,
        deal: ['premium', 'strong', 'near'].includes(bucket),
        ownedQuantity: holding.quantity,
        ownedReturn: holding.quantity * item.price,
        ownedProfit: holding.quantity * item.price - holding.cost,
      };
    });
  }

  function counts(rows) {
    const result = { all: rows.length, deals: 0, premium: 0, strong: 0, near: 0, withhold: 0, unknown: 0, owned: 0 };
    for (const row of rows) {
      result[row.bucket] += 1;
      if (row.deal) result.deals += 1;
      if (row.ownedQuantity > 0) result.owned += 1;
    }
    return result;
  }

  function filtered(rows) {
    let output = [...rows];
    if (ui.bucket === 'deals') output = output.filter((row) => row.deal);
    else if (ui.bucket !== 'all') output = output.filter((row) => row.bucket === ui.bucket);
    if (ui.ownedOnly) output = output.filter((row) => row.ownedQuantity > 0);
    const query = keyName(ui.search);
    if (query) output = output.filter((row) => row.nameKey.includes(query) || String(row.itemId || '').includes(query));
    output.sort((a, b) => {
      if (ui.sort === 'percent-asc') return Number(a.payoutPercent ?? Infinity) - Number(b.payoutPercent ?? Infinity) || a.itemName.localeCompare(b.itemName);
      if (ui.sort === 'market-gap') return Number(b.marketDifference ?? -Infinity) - Number(a.marketDifference ?? -Infinity) || a.itemName.localeCompare(b.itemName);
      if (ui.sort === 'route-gap') return Number(b.routeDifference ?? -Infinity) - Number(a.routeDifference ?? -Infinity) || a.itemName.localeCompare(b.itemName);
      if (ui.sort === 'price') return b.price - a.price || a.itemName.localeCompare(b.itemName);
      if (ui.sort === 'name') return a.itemName.localeCompare(b.itemName);
      return Number(b.payoutPercent ?? -Infinity) - Number(a.payoutPercent ?? -Infinity) || a.itemName.localeCompare(b.itemName);
    });
    return output;
  }

  function label(bucket) {
    return { premium: 'PREMIUM 100%+', strong: 'STRONG 99%+', near: 'NEAR MARKET', withhold: 'WITHHOLD', unknown: 'NO MARKET' }[bucket] || 'UNKNOWN';
  }

  function ageText(trader) {
    const time = Date.parse(trader.capturedAt || '');
    if (!Number.isFinite(time)) return 'capture age unknown';
    const hours = Math.max(0, (Date.now() - time) / 3600000);
    if (hours <= 72) return `${Math.floor(hours)}h old · fresh`;
    if (hours <= 168) return `${Math.max(1, Math.floor(hours / 24))}d old · aging`;
    return `${Math.max(1, Math.floor(hours / 24))}d old · stale`;
  }

  function injectStyle() {
    if (document.getElementById(APP.styleId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      .tsimm-deals-button{background:#166b61!important;border-color:#39b8a9!important;color:#edfffb!important}
      #${APP.overlayId}{position:fixed;inset:0;z-index:2147483646;background:#000c;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f8fb}
      .tsimm-d-shell{width:min(740px,100%);max-height:96vh;display:flex;flex-direction:column;background:#171d24;border:1px solid #4c7a78;border-radius:12px;overflow:hidden;box-shadow:0 14px 44px #000e}
      .tsimm-d-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;background:#1c2b2c;border-bottom:1px solid #365354}.tsimm-d-head small{display:block;color:#a9c4c3}.tsimm-d-head button,.tsimm-d-actions button,.tsimm-d-tabs button,.tsimm-d-more{border:1px solid #547170;border-radius:7px;background:#293b3c;color:#fff;padding:6px 9px;font-weight:800}
      .tsimm-d-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:8px}.tsimm-d-summary>div{display:grid;gap:2px;padding:7px;border:1px solid #405455;border-radius:8px;background:#202b2c}.tsimm-d-summary strong{font-size:17px}.tsimm-d-summary span{font-size:9px;text-transform:uppercase;color:#b2c4c4}.tsimm-d-summary .deals strong{color:#69ead1}.tsimm-d-summary .premium strong{color:#79f2a8}.tsimm-d-summary .strong strong{color:#77cfff}.tsimm-d-summary .near strong{color:#f1c85d}
      .tsimm-d-note{margin:0 8px 8px;padding:7px;border:1px solid #40595a;border-radius:7px;background:#202c2d;color:#cfdfdf}.tsimm-d-actions{display:flex;flex-wrap:wrap;gap:5px;padding:0 8px 8px}.tsimm-d-actions label{display:flex;align-items:center;gap:5px;border:1px solid #506b6c;border-radius:7px;background:#293b3c;padding:6px 8px;font-weight:700}.tsimm-d-actions input[type=number]{width:58px;background:#121a1b;color:#fff;border:1px solid #607d7e;border-radius:5px;padding:3px}
      .tsimm-d-tabs{display:flex;gap:4px;overflow:auto;padding:0 8px 8px}.tsimm-d-tabs button{white-space:nowrap;border-radius:999px;padding:5px 8px}.tsimm-d-tabs button.active{background:#187e71;border-color:#52c8b9}
      .tsimm-d-controls{display:grid;grid-template-columns:1fr 170px;gap:5px;padding:0 8px 8px}.tsimm-d-controls input,.tsimm-d-controls select{min-width:0;background:#12191a;color:#fff;border:1px solid #526d6e;border-radius:7px;padding:7px}
      .tsimm-d-list{overflow:auto;display:grid;gap:6px;padding:0 8px 10px}.tsimm-d-row{padding:7px;border:1px solid #4b5c5d;border-radius:8px;background:#212a2b}.tsimm-d-row.premium{border-color:#3c9661}.tsimm-d-row.strong{border-color:#337aa3}.tsimm-d-row.near{border-color:#90763a}.tsimm-d-row.withhold{border-color:#94444f}.tsimm-d-row.unknown{border-color:#626971}.tsimm-d-row-head{display:flex;justify-content:space-between;gap:8px}.tsimm-d-row-head b{font-size:9px;border:1px solid currentColor;border-radius:999px;padding:2px 6px}.tsimm-d-row.premium b{color:#79f2a8}.tsimm-d-row.strong b{color:#77cfff}.tsimm-d-row.near b{color:#f1c85d}.tsimm-d-row.withhold b{color:#ff7f89}.tsimm-d-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px;margin-top:6px}.tsimm-d-grid span{color:#afc0c0}.tsimm-d-grid strong{text-align:right}.tsimm-good{color:#64e39d}.tsimm-bad{color:#ff828c}.tsimm-muted{color:#aeb8c0}.tsimm-owned{display:block;margin-top:6px;padding-top:5px;border-top:1px solid #3e4d4e;color:#84d3ff}
      @media(max-width:520px){.tsimm-d-summary{grid-template-columns:repeat(2,1fr)}.tsimm-d-controls{grid-template-columns:1fr}.tsimm-d-shell{max-height:97vh}}
    `;
    document.head?.appendChild(style);
  }

  function decorate() {
    const overlay = document.getElementById(APP.traderOverlayId);
    if (!overlay) return;
    const map = new Map(traders().map((trader) => [trader.id, trader]));
    overlay.querySelectorAll('.tsimm-trader-card').forEach((card) => {
      const edit = card.querySelector('[data-tsimm-action="trader-edit"][data-tsimm-trader-id]');
      if (!edit) return;
      const trader = map.get(edit.dataset.tsimmTraderId);
      card.querySelectorAll('.tsimm-addon-report-button').forEach((button) => button.remove());
      let button = card.querySelector('[data-tsimm-deals-trader]');
      if (!trader?.items?.length) { button?.remove(); return; }
      const total = counts(rowsFor(trader)).deals;
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'tsimm-deals-button';
        button.dataset.tsimmDealsTrader = trader.id;
        edit.parentElement?.insertBefore(button, edit);
      }
      button.textContent = `Deals ${integer(total)}`;
    });
  }

  function scheduleDecorate(delay = 40) {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorate, delay);
  }

  function rowHtml(row) {
    const marketClass = row.marketDifference === null ? 'tsimm-muted' : row.marketDifference >= 0 ? 'tsimm-good' : 'tsimm-bad';
    const routeClass = row.routeDifference === null ? 'tsimm-muted' : row.routeDifference >= 0 ? 'tsimm-good' : 'tsimm-bad';
    const owned = row.ownedQuantity > 0
      ? `<span class="tsimm-owned">Owned × ${integer(row.ownedQuantity)} · return ${money(row.ownedReturn)} · tracked profit ${signed(row.ownedProfit)}</span>`
      : '';
    return `<article class="tsimm-d-row ${esc(row.bucket)}"><div class="tsimm-d-row-head"><strong>${esc(row.itemName)}</strong><b>${esc(label(row.bucket))}</b></div><div class="tsimm-d-grid"><span>Trader pays</span><strong>${money(row.price)}</strong><span>Market value</span><strong>${row.market ? money(row.market) : 'Not synced'}</strong><span>Percent of market</span><strong>${row.payoutPercent === null ? 'Unknown' : percent(row.payoutPercent)}</strong><span>Vs market</span><strong class="${marketClass}">${esc(signed(row.marketDifference))}</strong><span>Vs 99% route</span><strong class="${routeClass}">${esc(signed(row.routeDifference))}</strong></div>${owned}</article>`;
  }

  function saveUi() {
    write(APP.settingsKey, {
      nearFloor: Math.max(0, Math.min(98.9, Number(ui.nearFloor) || 97)),
      bucket: ui.bucket,
      search: ui.search,
      sort: ui.sort,
      ownedOnly: Boolean(ui.ownedOnly),
      limit: ui.limit,
    });
  }

  function render() {
    const overlay = document.getElementById(APP.overlayId);
    if (!overlay) return;
    const trader = traders().find((entry) => entry.id === activeTraderId);
    if (!trader) { overlay.remove(); activeTraderId = null; return; }
    const rows = rowsFor(trader);
    const totals = counts(rows);
    const visible = filtered(rows);
    const shown = visible.slice(0, Math.max(50, Number(ui.limit) || 200));
    const tabs = [['deals','Deals',totals.deals],['premium','Premium',totals.premium],['strong','Strong',totals.strong],['near','Near',totals.near],['withhold','Withhold',totals.withhold],['unknown','No market',totals.unknown],['all','All',totals.all]]
      .map(([value, text, count]) => `<button type="button" class="${ui.bucket === value ? 'active' : ''}" data-tsimm-deals-action="filter" data-bucket="${value}">${text} ${integer(count)}</button>`).join('');
    overlay.innerHTML = `<div class="tsimm-d-shell"><div class="tsimm-d-head"><div><strong>💰 ${esc(trader.name)} Deals</strong><small>Prices near or above Torn market value · add-on v${APP.version}</small></div><button type="button" data-tsimm-deals-action="close">×</button></div><div class="tsimm-d-summary"><div class="deals"><strong>${integer(totals.deals)}</strong><span>total deals</span></div><div class="premium"><strong>${integer(totals.premium)}</strong><span>premium 100%+</span></div><div class="strong"><strong>${integer(totals.strong)}</strong><span>strong 99%+</span></div><div class="near"><strong>${integer(totals.near)}</strong><span>near ${percent(ui.nearFloor)}+</span></div></div><div class="tsimm-d-note">Deals includes Premium, Strong, and Near. Withhold is hidden by default. ${esc(ageText(trader))}. Owned matches: ${integer(totals.owned)}.</div><div class="tsimm-d-actions"><button type="button" data-tsimm-deals-action="reload">Reload saved data</button><button type="button" data-tsimm-deals-action="copy">Copy deals</button><label><input type="checkbox" data-tsimm-deals-owned ${ui.ownedOnly ? 'checked' : ''}> Owned only</label><label>Near floor <input type="number" min="0" max="98.9" step="0.1" value="${esc(ui.nearFloor)}" data-tsimm-deals-near></label></div><div class="tsimm-d-tabs">${tabs}</div><div class="tsimm-d-controls"><input type="search" placeholder="Search item or ID" value="${esc(ui.search)}" data-tsimm-deals-search><select data-tsimm-deals-sort><option value="percent-desc" ${ui.sort === 'percent-desc' ? 'selected' : ''}>Payout % high</option><option value="percent-asc" ${ui.sort === 'percent-asc' ? 'selected' : ''}>Payout % low</option><option value="market-gap" ${ui.sort === 'market-gap' ? 'selected' : ''}>Best vs market</option><option value="route-gap" ${ui.sort === 'route-gap' ? 'selected' : ''}>Best vs 99% route</option><option value="price" ${ui.sort === 'price' ? 'selected' : ''}>Trader price high</option><option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Item name</option></select></div><div class="tsimm-d-list">${shown.length ? shown.map(rowHtml).join('') : '<div class="tsimm-d-note">No items match this Deals filter.</div>'}${visible.length > shown.length ? `<button type="button" class="tsimm-d-more" data-tsimm-deals-action="more">Show ${integer(Math.min(200, visible.length - shown.length))} more</button>` : ''}</div></div>`;
  }

  function open(traderId) {
    const trader = traders().find((entry) => entry.id === traderId);
    if (!trader?.items?.length) { toast('Capture this trader’s pricelist first.'); return; }
    activeTraderId = trader.id;
    ui = { ...ui, bucket: 'deals', search: '', sort: 'percent-desc', ownedOnly: false, limit: 200 };
    saveUi();
    let overlay = document.getElementById(APP.overlayId);
    if (!overlay) { overlay = document.createElement('div'); overlay.id = APP.overlayId; document.body.appendChild(overlay); }
    render();
  }

  async function copyDeals() {
    const trader = traders().find((entry) => entry.id === activeTraderId);
    if (!trader) return;
    const rows = filtered(rowsFor(trader));
    const text = [`${trader.name} Deals`,`Near floor: ${percent(ui.nearFloor)}`,'','Category\tItem\tTrader price\tMarket value\tPayout %\tVs market\tVs 99% route\tOwned',...rows.map((row) => [label(row.bucket),row.itemName,row.price,row.market || '',row.payoutPercent === null ? '' : row.payoutPercent.toFixed(2),row.marketDifference ?? '',row.routeDifference ?? '',row.ownedQuantity || 0].join('\t'))].join('\n');
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    }
    toast(`Copied ${integer(rows.length)} deal rows.`);
  }

  function toast(message) {
    let box = document.getElementById('tsimm-trader-deals-toast');
    if (!box) { box = document.createElement('div'); box.id = 'tsimm-trader-deals-toast'; box.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:2147483647;padding:8px 11px;border-radius:8px;background:#172725;color:#fff;border:1px solid #4f8a83;box-shadow:0 6px 20px #0009;font:12px Arial,sans-serif'; document.body.appendChild(box); }
    box.textContent = message; clearTimeout(toast.timer); toast.timer = setTimeout(() => box.remove(), 2600);
  }

  function bind() {
    document.addEventListener('click', (event) => {
      const traderButton = event.target.closest('[data-tsimm-deals-trader]');
      if (traderButton) { open(traderButton.dataset.tsimmDealsTrader); return; }
      const button = event.target.closest('[data-tsimm-deals-action]');
      if (!button) return;
      const action = button.dataset.tsimmDealsAction;
      if (action === 'close') { document.getElementById(APP.overlayId)?.remove(); activeTraderId = null; }
      else if (action === 'reload') render();
      else if (action === 'copy') copyDeals();
      else if (action === 'more') { ui.limit = Math.max(200, Number(ui.limit) || 200) + 200; saveUi(); render(); }
      else if (action === 'filter') { ui.bucket = ['deals','premium','strong','near','withhold','unknown','all'].includes(button.dataset.bucket) ? button.dataset.bucket : 'deals'; ui.limit = 200; saveUi(); render(); }
    }, true);
    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-tsimm-deals-owned]')) { ui.ownedOnly = event.target.checked; ui.limit = 200; saveUi(); render(); }
      else if (event.target.matches('[data-tsimm-deals-sort]')) { ui.sort = event.target.value; ui.limit = 200; saveUi(); render(); }
      else if (event.target.matches('[data-tsimm-deals-near]')) { ui.nearFloor = Math.max(0, Math.min(98.9, Number(event.target.value) || 97)); ui.limit = 200; saveUi(); scheduleDecorate(0); render(); }
    }, true);
    document.addEventListener('input', (event) => {
      if (!event.target.matches('[data-tsimm-deals-search]')) return;
      const cursor = event.target.selectionStart ?? event.target.value.length;
      ui.search = event.target.value; ui.limit = 200; saveUi(); render();
      const replacement = document.querySelector(`#${APP.overlayId} [data-tsimm-deals-search]`);
      replacement?.focus(); replacement?.setSelectionRange(cursor, cursor);
    }, true);
  }

  function boot() {
    if (!document.body) { setTimeout(boot, 80); return; }
    injectStyle(); bind();
    new MutationObserver(() => scheduleDecorate()).observe(document.body, { childList: true, subtree: true });
    scheduleDecorate(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();