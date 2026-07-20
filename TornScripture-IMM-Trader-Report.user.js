// ==UserScript==
// @name         TornScripture - IMM Trader Deals
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.2.3
// @description  Terminal-style per-trader Deals reports with visible compact rows and safe pricelist controls.
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

  const APP = Object.freeze({
    version: '0.2.3',
    traderBookId: 'tornscripture-imm-traders',
    overlayId: 'tornscripture-imm-trader-deals-addon',
    styleId: 'tornscripture-imm-trader-deals-style',
    tradersKey: 'tornscripture-imm-traders-v1',
    catalogKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogKey: 'tornscripture-ish-torn-catalog-v1',
    ledgerKey: 'tornscripture-imm-ledger-v1',
    settingsKey: 'tornscripture-imm-report-addon-settings-v1',
    priceIndexKey: 'tornscripture-imm-trader-price-index-v1',
    linkBackupKey: 'tornscripture-imm-trader-link-backup-v1',
  });

  const DEFAULTS = Object.freeze({
    near: 97,
    bucket: 'deals',
    ownedOnly: false,
    search: '',
    sort: 'pct',
    limit: 200,
    controlsOpen: false,
    manageOpen: false,
  });

  let ui = { ...DEFAULTS, ...readJson(APP.settingsKey, {}) };
  ui.near = clamp(
    Number.isFinite(Number(ui.nearFloorPercent))
      ? ui.nearFloorPercent
      : Number.isFinite(Number(ui.nearWindowPercent))
        ? 99 - Number(ui.nearWindowPercent)
        : ui.near,
    0,
    99,
  );

  let activeTraderId = '';
  let bound = false;
  let started = false;
  let decorateTimer = 0;
  let storageSignature = '';
  let traders = [];
  let catalog = { byId: {}, byName: {}, updatedAt: null };
  let dealCounts = new Map();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch {
      return clone(fallback);
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
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
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function clamp(value, minimum, maximum) {
    const number = Number(value);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(number) ? number : minimum));
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

  function formatAge(value) {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return 'capture time unknown';
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 60) return `${minutes}m old`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h old`;
    return `${Math.floor(hours / 24)}d old`;
  }

  function normalizePriceItem(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const itemId = Number(candidate.itemId ?? candidate.id) > 0
      ? Number(candidate.itemId ?? candidate.id)
      : null;
    const itemName = clean(candidate.itemName ?? candidate.name) || (itemId ? `Item ${itemId}` : '');
    const price = Math.max(0, Number(candidate.unitPrice ?? candidate.price ?? candidate.value) || 0);
    if (!itemName || !price) return null;
    return { itemId, itemName, normalizedName: nameKey(itemName), price };
  }

  function normalizedTraderId(candidate, name = '', userId = null) {
    return clean(candidate?.recordId)
      || clean(candidate?.uuid)
      || (typeof candidate?.id === 'string' ? clean(candidate.id) : '')
      || (userId ? `trader-${userId}` : `trader-${nameKey(name)}`);
  }

  function normalizeTrader(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const name = clean(candidate.name ?? candidate.username);
    if (!name) return null;
    const userId = Math.max(0, Math.floor(Number(candidate.userId ?? candidate.tornId) || 0)) || null;
    const items = (Array.isArray(candidate.pricePageItems ?? candidate.pricingItems)
      ? candidate.pricePageItems ?? candidate.pricingItems
      : []).map(normalizePriceItem).filter(Boolean);
    return {
      ...candidate,
      id: normalizedTraderId(candidate, name, userId),
      name,
      normalizedName: nameKey(name),
      userId,
      items,
      pricePageUrl: clean(candidate.pricePageUrl ?? candidate.pricingPageUrl),
      capturedAt: candidate.pricePageLastCheckedAt
        ?? candidate.pricePageCapturedAt
        ?? candidate.pricesCapturedAt
        ?? null,
    };
  }

  function normalizeCatalog(raw) {
    const output = { updatedAt: raw?.updatedAt || null, byId: {}, byName: {} };
    const source = raw?.itemsByName || raw?.items || {};
    const entries = Array.isArray(source)
      ? source.map((item) => [String(item?.id ?? ''), item])
      : Object.entries(source);

    for (const [key, candidate] of entries) {
      if (!candidate || typeof candidate !== 'object') continue;
      const value = candidate.value && typeof candidate.value === 'object' ? candidate.value : {};
      const itemId = Number(candidate.id ?? candidate.itemId ?? key) > 0
        ? Number(candidate.id ?? candidate.itemId ?? key)
        : null;
      const itemName = clean(candidate.name);
      const market = Math.max(0, Number(candidate.marketPrice ?? candidate.market_price ?? value.market_price) || 0);
      if (!itemName || !market) continue;
      const item = { itemId, itemName, normalizedName: nameKey(itemName), market };
      if (itemId) output.byId[String(itemId)] = item;
      output.byName[item.normalizedName] = item;
    }

    return output;
  }

  function holdingMaps() {
    const lots = readJson(APP.ledgerKey, {}).lots || [];
    const byId = new Map();
    const byName = new Map();
    const add = (map, key, quantity, cost) => {
      const current = map.get(key) || { quantity: 0, cost: 0 };
      map.set(key, { quantity: current.quantity + quantity, cost: current.cost + cost });
    };

    for (const lot of lots) {
      const quantity = Math.max(0, Math.floor(Number(lot?.remainingQuantity) || 0));
      if (!quantity) continue;
      const cost = quantity * Math.max(0, Number(lot?.unitCost) || 0);
      if (Number(lot?.itemId) > 0) add(byId, String(Number(lot.itemId)), quantity, cost);
      const key = nameKey(lot?.itemName);
      if (key) add(byName, key, quantity, cost);
    }

    return { byId, byName };
  }

  function refreshData(force = false) {
    let signature = '';
    try {
      signature = [
        localStorage.getItem(APP.tradersKey) || '',
        localStorage.getItem(APP.catalogKey) || '',
        localStorage.getItem(APP.sharedCatalogKey) || '',
        ui.near,
      ].join('|');
    } catch {}

    if (!force && signature === storageSignature && traders.length) return;
    storageSignature = signature;

    const rawTraders = readJson(APP.tradersKey, []);
    traders = (Array.isArray(rawTraders) ? rawTraders : rawTraders?.traders || [])
      .map(normalizeTrader)
      .filter(Boolean);

    const shared = normalizeCatalog(readJson(APP.sharedCatalogKey, {}));
    const own = normalizeCatalog(readJson(APP.catalogKey, {}));
    catalog = {
      updatedAt: own.updatedAt || shared.updatedAt,
      byId: { ...shared.byId, ...own.byId },
      byName: { ...shared.byName, ...own.byName },
    };

    dealCounts = new Map(traders.map((entry) => [
      entry.id,
      countRows(reportRows(entry, { byId: new Map(), byName: new Map() })).deals,
    ]));
  }

  function marketItemFor(item) {
    return (item.itemId && catalog.byId[String(item.itemId)])
      || catalog.byName[item.normalizedName]
      || null;
  }

  function classifyPayout(percent, nearFloor = ui.near) {
    if (percent === null || !Number.isFinite(percent)) return 'unknown';
    if (percent >= 100) return 'premium';
    if (percent >= 99) return 'strong';
    if (percent >= nearFloor) return 'near';
    return 'withhold';
  }

  function reportRows(trader, holdings = holdingMaps()) {
    return (trader?.items || []).map((item) => {
      const marketItem = marketItemFor(item);
      const market = Math.max(0, Number(marketItem?.market) || 0);
      const percent = market ? item.price / market * 100 : null;
      const differenceVsMarket = market ? item.price - market : null;
      const route99 = market ? Math.floor(market * 0.99) : 0;
      const differenceVs99 = market ? item.price - route99 : null;
      const holding = (item.itemId ? holdings.byId.get(String(item.itemId)) : null)
        || holdings.byName.get(item.normalizedName)
        || { quantity: 0, cost: 0 };
      const owned = Math.max(0, Number(holding.quantity) || 0);
      return {
        ...item,
        market,
        percent,
        differenceVsMarket,
        differenceVs99,
        bucket: classifyPayout(percent),
        owned,
        ownedReturn: owned * item.price,
        ownedProfit: owned * item.price - Math.max(0, Number(holding.cost) || 0),
      };
    });
  }

  function countRows(rows) {
    const counts = {
      all: rows.length,
      deals: 0,
      premium: 0,
      strong: 0,
      near: 0,
      withhold: 0,
      unknown: 0,
      owned: 0,
    };
    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(counts, row.bucket)) counts[row.bucket] += 1;
      if (['premium', 'strong', 'near'].includes(row.bucket)) counts.deals += 1;
      if (row.owned) counts.owned += 1;
    }
    return counts;
  }

  function traderForCard(card) {
    refreshData();
    const directId = clean(card.querySelector('[data-tsimm-trader-id]')?.dataset?.tsimmTraderId);
    if (directId) {
      const direct = traders.find((entry) => entry.id === directId);
      if (direct) return direct;
    }

    const profileHref = card.querySelector('a[href*="profiles.php?XID="]')?.getAttribute('href') || '';
    const userId = profileHref.match(/[?&]XID=(\d+)/i)?.[1];
    if (userId) {
      const byUserId = traders.find((entry) => Number(entry.userId) === Number(userId));
      if (byUserId) return byUserId;
    }

    const visibleName = nameKey(
      card.querySelector('.tsimm-trader-banner-label strong,.tsimm-trader-profile-button strong')?.textContent,
    );
    return visibleName ? traders.find((entry) => entry.normalizedName === visibleName) || null : null;
  }

  function decorateTraderBook() {
    const book = document.getElementById(APP.traderBookId);
    if (!book) return;
    try {
      refreshData();
      for (const card of book.querySelectorAll('.tsimm-trader-card')) {
        const trader = traderForCard(card);
        let button = card.querySelector('[data-tsimm-deals-open]');
        if (!trader?.items?.length) {
          button?.remove();
          continue;
        }
        const actions = card.querySelector('.tsimm-trader-actions') || card;
        const edit = actions.querySelector('[data-tsimm-action="trader-edit"]');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'tsimm-deals-button';
          button.dataset.tsimmDealsOpen = '1';
          edit ? actions.insertBefore(button, edit) : actions.appendChild(button);
        }
        const count = dealCounts.get(trader.id) || 0;
        button.dataset.tsimmTraderId = trader.id;
        button.textContent = count ? `Deals ${formatInteger(count)}` : 'Deals';
        button.title = `${formatInteger(count)} captured prices at or near market value`;
      }
    } catch (error) {
      console.error('[IMM Trader Deals] decorate failed', error);
    }
  }

  function scheduleDecorate(delay = 40) {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateTraderBook, delay);
  }

  function filteredRows(rows) {
    let output = [...rows];
    if (ui.bucket === 'deals') output = output.filter((row) => ['premium', 'strong', 'near'].includes(row.bucket));
    else if (ui.bucket !== 'all') output = output.filter((row) => row.bucket === ui.bucket);
    if (ui.ownedOnly) output = output.filter((row) => row.owned);

    const query = nameKey(ui.search);
    if (query) {
      output = output.filter((row) => row.normalizedName.includes(query) || String(row.itemId || '').includes(query));
    }

    const percent = (row, fallback) => row.percent === null ? fallback : Number(row.percent);
    output.sort((left, right) => {
      if (ui.sort === 'pct-asc') return percent(left, Infinity) - percent(right, Infinity);
      if (ui.sort === 'market') return Number(right.differenceVsMarket ?? -Infinity) - Number(left.differenceVsMarket ?? -Infinity);
      if (ui.sort === 'route99') return Number(right.differenceVs99 ?? -Infinity) - Number(left.differenceVs99 ?? -Infinity);
      if (ui.sort === 'price') return right.price - left.price;
      if (ui.sort === 'name') return left.itemName.localeCompare(right.itemName);
      return percent(right, -Infinity) - percent(left, -Infinity);
    });
    return output;
  }

  function bucketLabel(bucket) {
    return {
      premium: 'PREMIUM 100%+',
      strong: 'STRONG 99%+',
      near: 'NEAR MARKET',
      withhold: 'WITHHOLD',
      unknown: 'NO MARKET VALUE',
    }[bucket] || 'UNKNOWN';
  }

  function compactGap(value) {
    if (value === null) return 'n/a';
    return `${value >= 0 ? '+' : ''}${formatMoney(value)}`;
  }

  function rowHtml(row) {
    const ownedLine = row.owned
      ? `<div class="td-owned">OWNED ${formatInteger(row.owned)} · RETURN ${formatMoney(row.ownedReturn)} · PROFIT ${row.ownedProfit >= 0 ? '+' : ''}${formatMoney(row.ownedProfit)}</div>`
      : '';
    return `
      <article class="td-row ${escapeHtml(row.bucket)}" data-td-row>
        <button type="button" class="td-row-toggle" data-td="row" aria-expanded="false">
          <span class="td-chevron" aria-hidden="true">&gt;</span>
          <span class="td-row-title"><strong>${escapeHtml(row.itemName)}</strong><small>TRADER ${formatMoney(row.price)} · MARKET ${row.market ? formatMoney(row.market) : 'NOT SYNCED'} · VS 99% ${escapeHtml(compactGap(row.differenceVs99))}</small></span>
          <b>${escapeHtml(bucketLabel(row.bucket))}</b>
        </button>
        <div class="td-row-body" hidden>
          <div class="td-detail-grid">
            <span>TRADER PAYS</span><strong>${formatMoney(row.price)}</strong>
            <span>MARKET VALUE</span><strong>${row.market ? formatMoney(row.market) : 'NOT SYNCED'}</strong>
            <span>PERCENT OF MARKET</span><strong>${row.percent === null ? 'UNKNOWN' : formatPercent(row.percent)}</strong>
            <span>VS MARKET</span><strong class="${row.differenceVsMarket === null ? 'td-muted' : row.differenceVsMarket >= 0 ? 'td-good' : 'td-bad'}">${escapeHtml(compactGap(row.differenceVsMarket))}</strong>
            <span>VS 99% ROUTE</span><strong class="${row.differenceVs99 === null ? 'td-muted' : row.differenceVs99 >= 0 ? 'td-good' : 'td-bad'}">${escapeHtml(compactGap(row.differenceVs99))}</strong>
          </div>
          ${ownedLine}
        </div>
      </article>
    `;
  }

  function rawTraderRecords() {
    const raw = readJson(APP.tradersKey, []);
    return {
      shape: Array.isArray(raw) ? 'array' : 'object',
      root: raw,
      records: Array.isArray(raw) ? raw : Array.isArray(raw?.traders) ? raw.traders : [],
    };
  }

  function saveRawTraderRecords(snapshot, records) {
    if (snapshot.shape === 'object') {
      return writeJson(APP.tradersKey, { ...snapshot.root, traders: records });
    }
    return writeJson(APP.tradersKey, records);
  }

  function pricePayload(record) {
    return {
      pricePageUrl: clean(record?.pricePageUrl ?? record?.pricingPageUrl),
      previousPricePageUrl: clean(record?.previousPricePageUrl),
      pricePageTitle: clean(record?.pricePageTitle ?? record?.pricingPageTitle),
      pricePageItems: clone(Array.isArray(record?.pricePageItems ?? record?.pricingItems)
        ? record.pricePageItems ?? record.pricingItems
        : []),
      pricePageCapturedAt: record?.pricePageCapturedAt ?? record?.pricesCapturedAt ?? null,
      pricePageLastCheckedAt: record?.pricePageLastCheckedAt ?? record?.pricePageCapturedAt ?? null,
      pricePageCaptureCount: Math.max(0, Math.floor(Number(record?.pricePageCaptureCount) || 0)),
      pricePageLastChangedCount: Math.max(0, Math.floor(Number(record?.pricePageLastChangedCount) || 0)),
      pricePageLastResult: clean(record?.pricePageLastResult),
    };
  }

  function clearPriceConnection(record) {
    const next = { ...record };
    next.pricePageUrl = '';
    next.previousPricePageUrl = '';
    next.pricePageTitle = '';
    next.pricePageItems = [];
    next.pricePageCapturedAt = null;
    next.pricePageLastCheckedAt = null;
    next.pricePageCaptureCount = 0;
    next.pricePageLastChangedCount = 0;
    next.pricePageLastResult = '';
    next.updatedAt = new Date().toISOString();
    delete next.pricingPageUrl;
    delete next.receiptPageUrl;
    delete next.pricingPageTitle;
    delete next.pricingItems;
    delete next.pricesCapturedAt;
    return next;
  }

  function applyPricePayload(record, payload) {
    const next = clearPriceConnection(record);
    next.pricePageUrl = payload.pricePageUrl;
    next.previousPricePageUrl = payload.previousPricePageUrl;
    next.pricePageTitle = payload.pricePageTitle;
    next.pricePageItems = clone(payload.pricePageItems);
    next.pricePageCapturedAt = payload.pricePageCapturedAt;
    next.pricePageLastCheckedAt = payload.pricePageLastCheckedAt;
    next.pricePageCaptureCount = payload.pricePageCaptureCount;
    next.pricePageLastChangedCount = payload.pricePageLastChangedCount;
    next.pricePageLastResult = payload.pricePageLastResult;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function rawRecordMatches(record, trader) {
    const normalized = normalizeTrader(record);
    return Boolean(normalized && (
      normalized.id === trader.id
      || (normalized.userId && trader.userId && Number(normalized.userId) === Number(trader.userId))
      || normalized.normalizedName === trader.normalizedName
    ));
  }

  function storeLinkBackup(snapshot) {
    writeJson(APP.linkBackupKey, {
      savedAt: new Date().toISOString(),
      shape: snapshot.shape,
      root: snapshot.root,
    });
  }

  function rebuildAfterLinkChange() {
    try {
      localStorage.removeItem(APP.priceIndexKey);
      window.dispatchEvent(new CustomEvent('tsimm:trader-price-index-updated', { detail: { source: 'trader-deals' } }));
    } catch {}
    location.reload();
  }

  function disconnectActivePricelist() {
    refreshData(true);
    const trader = traders.find((entry) => entry.id === activeTraderId);
    if (!trader) return;
    const count = trader.items.length;
    const confirmed = confirm(
      `Disconnect ${trader.name}'s pricelist?\n\nThis removes the saved URL, ${count} captured prices, and capture timestamps. Profile, notes, rating, trade history, and profits stay intact.`,
    );
    if (!confirmed) return;

    const snapshot = rawTraderRecords();
    const index = snapshot.records.findIndex((record) => rawRecordMatches(record, trader));
    if (index < 0) return;
    storeLinkBackup(snapshot);
    const records = [...snapshot.records];
    records[index] = clearPriceConnection(records[index]);
    if (!saveRawTraderRecords(snapshot, records)) {
      alert('IMM could not update local trader storage. No data was changed.');
      return;
    }
    rebuildAfterLinkChange();
  }

  function moveActivePricelist() {
    refreshData(true);
    const source = traders.find((entry) => entry.id === activeTraderId);
    const targetId = clean(document.querySelector(`#${APP.overlayId} [data-td-move-target]`)?.value);
    const target = traders.find((entry) => entry.id === targetId);
    if (!source || !target || source.id === target.id) return;

    const replacementWarning = target.items.length
      ? `\n\n${target.name} already has ${target.items.length} captured prices. Those will be replaced.`
      : '';
    const confirmed = confirm(
      `Move ${source.items.length} captured prices from ${source.name} to ${target.name}?${replacementWarning}\n\nThe trader profiles, notes, ratings, and trade histories will not move.`,
    );
    if (!confirmed) return;

    const snapshot = rawTraderRecords();
    const sourceIndex = snapshot.records.findIndex((record) => rawRecordMatches(record, source));
    const targetIndex = snapshot.records.findIndex((record) => rawRecordMatches(record, target));
    if (sourceIndex < 0 || targetIndex < 0) return;

    storeLinkBackup(snapshot);
    const records = [...snapshot.records];
    const payload = pricePayload(records[sourceIndex]);
    const targetPreviousUrl = clean(records[targetIndex]?.pricePageUrl ?? records[targetIndex]?.pricingPageUrl);
    if (targetPreviousUrl && targetPreviousUrl !== payload.pricePageUrl) payload.previousPricePageUrl = targetPreviousUrl;
    records[sourceIndex] = clearPriceConnection(records[sourceIndex]);
    records[targetIndex] = applyPricePayload(records[targetIndex], payload);

    if (!saveRawTraderRecords(snapshot, records)) {
      alert('IMM could not update local trader storage. No data was changed.');
      return;
    }
    rebuildAfterLinkChange();
  }

  function undoLastLinkChange() {
    const backup = readJson(APP.linkBackupKey, null);
    if (!backup?.root) return;
    if (!confirm('Undo the most recent pricelist move or disconnect?')) return;
    if (!writeJson(APP.tradersKey, backup.root)) {
      alert('IMM could not restore the trader backup.');
      return;
    }
    try {
      localStorage.removeItem(APP.linkBackupKey);
      localStorage.removeItem(APP.priceIndexKey);
    } catch {}
    location.reload();
  }

  function persistUi() {
    writeJson(APP.settingsKey, {
      nearFloorPercent: ui.near,
      bucket: ui.bucket,
      ownedOnly: ui.ownedOnly,
      search: ui.search,
      sort: ui.sort,
      limit: ui.limit,
    });
  }

  function summaryChip(value, label, count, className = '') {
    const active = ui.bucket === value && !ui.ownedOnly ? ' active' : '';
    return `<button type="button" class="${escapeHtml(className)}${active}" data-td="filter" data-bucket="${escapeHtml(value)}"><strong>${formatInteger(count)}</strong><span>${escapeHtml(label)}</span></button>`;
  }

  function renderReport() {
    const overlay = document.getElementById(APP.overlayId);
    if (!overlay) return;
    refreshData(true);
    const trader = traders.find((entry) => entry.id === activeTraderId);
    if (!trader) {
      closeReport();
      return;
    }

    const rows = reportRows(trader);
    const counts = countRows(rows);
    const filtered = filteredRows(rows);
    const shown = filtered.slice(0, Math.max(50, Number(ui.limit) || 200));
    const capturedText = trader.capturedAt ? formatAge(trader.capturedAt) : 'capture time unknown';
    const moveTargets = traders
      .filter((entry) => entry.id !== trader.id)
      .map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}${entry.items.length ? ` · replaces ${formatInteger(entry.items.length)} prices` : ''}</option>`)
      .join('');
    const hasBackup = Boolean(readJson(APP.linkBackupKey, null)?.root);

    overlay.innerHTML = `
      <div class="td-shell">
        <header class="td-head">
          <div>
            <strong>&gt; ${escapeHtml(trader.name.toUpperCase())}_DEALS</strong>
            <small>${formatInteger(trader.items.length)} PRICES · ${escapeHtml(capturedText.toUpperCase())} · V${APP.version}</small>
          </div>
          <button type="button" data-td="close" aria-label="Close">×</button>
        </header>

        <nav class="td-summary" aria-label="Deal filters">
          ${summaryChip('deals', 'DEALS', counts.deals, 'deals')}
          ${summaryChip('premium', 'PREM', counts.premium, 'premium')}
          ${summaryChip('strong', 'STRONG', counts.strong, 'strong')}
          ${summaryChip('near', 'NEAR', counts.near, 'near')}
          ${summaryChip('withhold', 'HOLD', counts.withhold, 'withhold')}
          <button type="button" class="owned${ui.ownedOnly ? ' active' : ''}" data-td="owned"><strong>${formatInteger(counts.owned)}</strong><span>OWNED</span></button>
        </nav>

        <div class="td-toolbar">
          <button type="button" data-td="controls">${ui.controlsOpen ? 'HIDE FILTERS' : 'FILTERS'}</button>
          <button type="button" data-td="copy">COPY</button>
          ${trader.pricePageUrl ? `<a href="${escapeHtml(trader.pricePageUrl)}">OPEN LIST</a>` : ''}
          <button type="button" data-td="manage">${ui.manageOpen ? 'CLOSE MANAGE' : 'MANAGE LINK'}</button>
        </div>

        ${ui.controlsOpen ? `
          <section class="td-drawer">
            <input type="search" placeholder="SEARCH ITEM OR ID" value="${escapeHtml(ui.search)}" data-td-search>
            <select data-td-sort>
              <option value="pct" ${ui.sort === 'pct' ? 'selected' : ''}>PAYOUT % HIGH</option>
              <option value="pct-asc" ${ui.sort === 'pct-asc' ? 'selected' : ''}>PAYOUT % LOW</option>
              <option value="market" ${ui.sort === 'market' ? 'selected' : ''}>BEST VS MARKET</option>
              <option value="route99" ${ui.sort === 'route99' ? 'selected' : ''}>BEST VS 99%</option>
              <option value="price" ${ui.sort === 'price' ? 'selected' : ''}>TRADER PRICE HIGH</option>
              <option value="name" ${ui.sort === 'name' ? 'selected' : ''}>ITEM NAME</option>
            </select>
            <label>NEAR FLOOR <input type="number" min="0" max="99" step="0.5" value="${escapeHtml(ui.near)}" data-td-near> %</label>
            <label><input type="checkbox" data-td-owned ${ui.ownedOnly ? 'checked' : ''}> OWNED ONLY</label>
            <button type="button" data-td="all">SHOW ALL ${formatInteger(counts.all)}</button>
            ${counts.unknown ? `<button type="button" data-td="unknown">NO MARKET ${formatInteger(counts.unknown)}</button>` : ''}
          </section>
        ` : ''}

        ${ui.manageOpen ? `
          <section class="td-manage">
            <strong>PRICE CONNECTION</strong>
            <small>Moving or disconnecting changes only captured pricelist data. Trader history stays put.</small>
            <div class="td-move-row">
              <select data-td-move-target>
                <option value="">MOVE TO SAVED TRADER…</option>
                ${moveTargets}
              </select>
              <button type="button" data-td="move">MOVE</button>
            </div>
            <button type="button" class="danger" data-td="disconnect">DISCONNECT PRICELIST</button>
            ${hasBackup ? '<button type="button" data-td="undo">UNDO LAST LINK CHANGE</button>' : ''}
          </section>
        ` : ''}

        <main class="td-list">
          ${shown.length ? shown.map(rowHtml).join('') : '<div class="td-empty">NO ITEMS MATCH THIS FILTER.</div>'}
          ${filtered.length > shown.length ? `<button type="button" class="td-more" data-td="more">LOAD ${formatInteger(Math.min(200, filtered.length - shown.length))} MORE</button>` : ''}
        </main>
      </div>
    `;
  }

  function openReport(traderId) {
    refreshData(true);
    const trader = traders.find((entry) => entry.id === traderId);
    if (!trader?.items?.length) return;
    activeTraderId = trader.id;
    ui = {
      ...ui,
      bucket: 'deals',
      ownedOnly: false,
      search: '',
      limit: 200,
      controlsOpen: false,
      manageOpen: false,
    };
    persistUi();
    let overlay = document.getElementById(APP.overlayId);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = APP.overlayId;
      document.body.appendChild(overlay);
    }
    renderReport();
  }

  function closeReport() {
    document.getElementById(APP.overlayId)?.remove();
    activeTraderId = '';
  }

  async function copyReport() {
    const trader = traders.find((entry) => entry.id === activeTraderId);
    if (!trader) return;
    const rows = filteredRows(reportRows(trader));
    const text = [
      `${trader.name} deals`,
      `Near floor: ${formatPercent(ui.near)}`,
      '',
      'Group\tItem\tTrader\tMarket\tPayout %\tVs market\tVs 99%\tOwned',
      ...rows.map((row) => [
        bucketLabel(row.bucket),
        row.itemName,
        row.price,
        row.market || '',
        row.percent === null ? '' : row.percent.toFixed(2),
        row.differenceVsMarket ?? '',
        row.differenceVs99 ?? '',
        row.owned,
      ].join('\t')),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-tsimm-deals-open]');
      if (opener) {
        openReport(opener.dataset.tsimmTraderId);
        return;
      }

      const button = event.target.closest('[data-td]');
      if (!button) return;
      const action = button.dataset.td;

      if (action === 'close') closeReport();
      else if (action === 'row') {
        const card = button.closest('[data-td-row]');
        const body = card?.querySelector('.td-row-body');
        if (!card || !body) return;
        const expanded = card.classList.toggle('expanded');
        body.hidden = !expanded;
        button.setAttribute('aria-expanded', String(expanded));
      } else if (action === 'controls') {
        ui.controlsOpen = !ui.controlsOpen;
        ui.manageOpen = false;
        renderReport();
      } else if (action === 'manage') {
        ui.manageOpen = !ui.manageOpen;
        ui.controlsOpen = false;
        renderReport();
      } else if (action === 'copy') copyReport();
      else if (action === 'filter') {
        ui.bucket = button.dataset.bucket;
        ui.ownedOnly = false;
        ui.limit = 200;
        persistUi();
        renderReport();
      } else if (action === 'owned') {
        ui.ownedOnly = !ui.ownedOnly;
        ui.limit = 200;
        persistUi();
        renderReport();
      } else if (action === 'all') {
        ui.bucket = 'all';
        ui.ownedOnly = false;
        ui.limit = 200;
        persistUi();
        renderReport();
      } else if (action === 'unknown') {
        ui.bucket = 'unknown';
        ui.ownedOnly = false;
        ui.limit = 200;
        persistUi();
        renderReport();
      } else if (action === 'more') {
        ui.limit += 200;
        persistUi();
        renderReport();
      } else if (action === 'disconnect') disconnectActivePricelist();
      else if (action === 'move') moveActivePricelist();
      else if (action === 'undo') undoLastLinkChange();
    }, true);

    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-td-owned]')) ui.ownedOnly = event.target.checked;
      else if (event.target.matches('[data-td-sort]')) ui.sort = event.target.value;
      else if (event.target.matches('[data-td-near]')) {
        ui.near = clamp(event.target.value, 0, 99);
        storageSignature = '';
        scheduleDecorate(0);
      } else return;
      ui.limit = 200;
      persistUi();
      renderReport();
    }, true);

    document.addEventListener('input', (event) => {
      if (!event.target.matches('[data-td-search]')) return;
      const cursor = event.target.selectionStart ?? event.target.value.length;
      ui.search = event.target.value;
      ui.limit = 200;
      persistUi();
      renderReport();
      const replacement = document.querySelector(`#${APP.overlayId} [data-td-search]`);
      replacement?.focus();
      replacement?.setSelectionRange(cursor, cursor);
    }, true);
  }

  function injectStyles() {
    if (document.getElementById(APP.styleId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      .tsimm-deals-button{background:#073914!important;border-color:#55ff79!important;color:#b6ff9d!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}
      #${APP.overlayId}{position:fixed;inset:0;z-index:2147483645;background:#000d;display:flex;align-items:center;justify-content:center;padding:8px;color:#aaff83;font:12px/1.32 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${APP.overlayId} *{box-sizing:border-box}
      .td-shell{position:relative;width:min(760px,100%);height:min(94dvh,900px);display:flex;flex-direction:column;overflow:hidden;background:#020704;border:1px solid #39b84f;border-radius:10px;box-shadow:0 0 0 1px #0d3516,0 18px 54px #000}
      .td-shell::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:10;background:repeating-linear-gradient(0deg,#7dff8c08 0,#7dff8c08 1px,transparent 1px,transparent 4px);mix-blend-mode:screen}
      .td-head{position:relative;z-index:11;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:#041108;border-bottom:1px solid #267e37;flex:0 0 auto}
      .td-head>div{display:grid;min-width:0}.td-head strong{color:#b7ff91;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.td-head small{color:#5ba769;font-size:9px;letter-spacing:.04em}.td-head button{width:30px;height:30px;border:1px solid #3d9c4c;border-radius:5px;background:#06190a;color:#aaff83;font:700 18px/1 monospace}
      .td-summary{position:relative;z-index:11;display:flex;gap:4px;overflow-x:auto;padding:5px 6px;background:#020b04;border-bottom:1px solid #123e1c;scrollbar-width:none;flex:0 0 auto}.td-summary::-webkit-scrollbar{display:none}
      .td-summary button{min-width:70px;display:grid;gap:0;padding:4px 7px;border:1px solid #245d2f;border-radius:5px;background:#031107;color:#6eb87b;text-align:left;font:inherit}.td-summary button strong{font-size:15px;line-height:1;color:#9dff7a}.td-summary button span{font-size:8px;letter-spacing:.06em}.td-summary button.active{background:#0a2b10;border-color:#7dff6e;box-shadow:inset 0 0 0 1px #2f7c39}.td-summary .premium strong{color:#aaff83}.td-summary .strong strong{color:#66e9d5}.td-summary .near strong{color:#ffd166}.td-summary .withhold strong{color:#ff7f89}.td-summary .owned strong{color:#8bd9ff}
      .td-toolbar{position:relative;z-index:11;display:flex;gap:4px;overflow-x:auto;padding:5px 6px;background:#020704;border-bottom:1px solid #123e1c;flex:0 0 auto}.td-toolbar button,.td-toolbar a{white-space:nowrap;border:1px solid #2d713a;border-radius:4px;background:#06170a;color:#aaff83;padding:5px 7px;font:700 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-decoration:none}
      .td-drawer,.td-manage{position:relative;z-index:11;display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.55fr);gap:5px;padding:6px;background:#031008;border-bottom:1px solid #245d2f;flex:0 0 auto}.td-drawer input,.td-drawer select,.td-drawer label,.td-drawer button,.td-manage select,.td-manage button{min-width:0;border:1px solid #2a7137;border-radius:4px;background:#010803;color:#aaff83;padding:6px;font:10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.td-drawer label{display:flex;align-items:center;gap:5px}.td-drawer input[type=number]{width:58px}.td-manage{grid-template-columns:1fr}.td-manage>strong{color:#b7ff91}.td-manage>small{color:#609d69}.td-move-row{display:grid;grid-template-columns:1fr auto;gap:5px}.td-manage .danger{border-color:#9f3942;color:#ff9aa2;background:#22080b}
      .td-list{position:relative;z-index:11;min-height:0;flex:1 1 auto;overflow:auto;display:grid;align-content:start;gap:4px;padding:5px 6px 8px;background:#010402}
      .td-row{display:block;min-height:46px;border:1px solid #245f30;border-radius:5px;background:#020a04;overflow:hidden}.td-row.expanded{border-color:#5ed36b;background:#031008}.td-row.premium{border-left:3px solid #8dff72}.td-row.strong{border-left:3px solid #59d9c8}.td-row.near{border-left:3px solid #e6b84a}.td-row.withhold{border-left:3px solid #99424b}.td-row.unknown{border-left:3px solid #5d6b61}
      #${APP.overlayId} .td-row-toggle{appearance:none!important;-webkit-appearance:none!important;width:100%!important;min-height:44px!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#aaff83!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:7px!important;padding:7px 8px!important;text-align:left!important;cursor:pointer!important;font:inherit!important;line-height:1.25!important;box-shadow:none!important}.td-chevron{color:#57a864;font-weight:800;font-size:12px}.td-row.expanded .td-chevron{transform:rotate(90deg);color:#9cff85}.td-row-title{display:grid;min-width:0;gap:2px}.td-row-title strong{display:block;color:#b8ff9c!important;font-size:12px!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.td-row-title small{display:block;color:#66a672!important;font-size:9px!important;line-height:1.2!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.td-row-toggle>b{display:inline-block;flex:0 0 auto;border:1px solid currentColor;border-radius:999px;padding:2px 5px;color:#7adf83;font-size:7px;white-space:nowrap}.td-row.premium .td-row-toggle>b{color:#9cff85}.td-row.strong .td-row-toggle>b{color:#6fe4d3}.td-row.near .td-row-toggle>b{color:#f2c45e}.td-row.withhold .td-row-toggle>b{color:#e87982}.td-row.unknown .td-row-toggle>b{color:#86918a}.td-row-body[hidden]{display:none!important}
      .td-detail-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:6px 9px 7px;border-top:1px dashed #1b4e27}.td-detail-grid span{color:#5f9e69;font-size:9px}.td-detail-grid strong{text-align:right;color:#b3ff92;font-size:9px}.td-owned{padding:5px 9px;border-top:1px dashed #1b4e27;color:#79cfff;font-size:8px}.td-good{color:#87ff77!important}.td-bad{color:#ff7f89!important}.td-muted{color:#718277!important}
      .td-empty,.td-more{border:1px solid #275f31;border-radius:5px;background:#031008;color:#88d891;padding:8px;text-align:center;font:10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.td-more{cursor:pointer}
      @media(max-width:560px){#${APP.overlayId}{padding:0;align-items:stretch}.td-shell{width:100%;height:100dvh;max-height:none;border-radius:0;border-left:0;border-right:0}.td-head{padding-top:max(8px,env(safe-area-inset-top))}.td-drawer{grid-template-columns:1fr}.td-summary button{min-width:64px}.td-list{padding-bottom:max(8px,env(safe-area-inset-bottom))}}
    `;
    document.head?.appendChild(style);
  }

  function boot() {
    if (!document.body) {
      setTimeout(boot, 80);
      return;
    }
    if (started) {
      scheduleDecorate(0);
      return;
    }
    started = true;
    injectStyles();
    bindEvents();
    new MutationObserver(() => scheduleDecorate()).observe(document.body, { childList: true, subtree: true });
    setInterval(() => {
      if (document.getElementById(APP.traderBookId)) decorateTraderBook();
    }, 750);
    scheduleDecorate(0);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    boot();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      classifyPayout,
      normalizePriceItem,
      normalizeTrader,
      normalizeCatalog,
      pricePayload,
      clearPriceConnection,
      applyPricePayload,
      countRows,
    };
  }
})();