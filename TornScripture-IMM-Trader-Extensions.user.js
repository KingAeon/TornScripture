// ==UserScript==
// @name         TornScripture - IMM Trader Extensions
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.8
// @description  Adds TornExchange capture, a persistent Deals tracking dock, and compact tracked-exit margin prompts on Item Market listings.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @match        https://tornexchange.com/prices/*
// @match        https://www.tornexchange.com/prices/*
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
    v: '0.1.8',
    bridge: 'TSIMM_PRICE_BRIDGE:',
    traders: 'tornscripture-imm-traders-v1',
    pending: 'tornscripture-imm-pending-trader-capture-v1',
    catalog: 'tornscripture-imm-catalog-v1',
    sharedCatalog: 'tornscripture-ish-torn-catalog-v1',
    tracked: 'tornscripture-imm-tracked-items-v1',
    overlaySettings: 'tornscripture-imm-trader-market-overlay-settings-v1',
    notice: 'tsimm-tx-notice-v1',
    deals: 'tornscripture-imm-trader-deals-addon',
    style: 'tsimm-trader-extensions-style',
    dock: 'tsimm-track-dock',
    caption: 'tsimm-track-caption',
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
  const http = (value) => {
    try {
      const url = new URL(String(value || ''), location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };
  const ageText = (value) => {
    const captured = Date.parse(value || '');
    if (!Number.isFinite(captured)) return 'unknown age';
    const minutes = Math.max(0, Math.floor((Date.now() - captured) / 60000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
  };
  const isTorn = () => /^(?:www\.)?torn\.com$/i.test(location.hostname);
  const isTX = (value = location.href) => {
    const normalized = http(value);
    if (!normalized) return false;
    try {
      const url = new URL(normalized);
      return /^(?:www\.)?tornexchange\.com$/i.test(url.hostname)
        && /^\/prices\/[^/]+\/?$/i.test(url.pathname);
    } catch {
      return false;
    }
  };

  function injectStyle() {
    if (document.getElementById(A.style) || !document.head) return;
    const style = document.createElement('style');
    style.id = A.style;
    style.textContent = `
      #tsimm-tx-panel{position:fixed;right:10px;bottom:10px;z-index:2147483646;width:min(360px,calc(100vw - 20px));border:1px solid #3bd35d;border-radius:9px;background:#020704;color:#aaff83;box-shadow:0 14px 40px #000c;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden}
      #tsimm-tx-panel *{box-sizing:border-box}.txh{display:flex;padding:9px 10px;background:#041108;border-bottom:1px solid #1d6b2d}.txh strong{flex:1}.txb{display:grid;gap:7px;padding:10px}.txg{display:grid;grid-template-columns:1fr auto;gap:4px 8px}.txg b{text-align:right}.txw{padding:7px;border:1px solid #9a6d1f;border-radius:5px;background:#241a05;color:#ffd166}.txa{display:grid;grid-template-columns:1fr 1.7fr;gap:6px}
      #tsimm-tx-panel button,.tsimm-tx-recapture{border:1px solid #2c843d;border-radius:5px;background:#06170a;color:#b6ff9d;padding:8px;font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.dock}{position:fixed;left:8px;right:8px;bottom:max(70px,calc(env(safe-area-inset-bottom) + 62px));z-index:2147483647;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #68e879;border-radius:7px;background:#020a04f2;color:#aaff83;box-shadow:0 8px 28px #000d;font:10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.dock}[hidden]{display:none!important}#${A.dock} .track-copy{display:grid;min-width:0;gap:2px}#${A.dock} small{color:#5ea66a;font-size:7px;letter-spacing:.08em}#${A.dock} strong{overflow:hidden;color:#c1ff9d;font-size:11px;white-space:nowrap;text-overflow:ellipsis}#${A.dock} span{overflow:hidden;color:#70b87b;font-size:8px;white-space:nowrap;text-overflow:ellipsis}#${A.dock} button{min-width:88px;min-height:38px;border:1px solid #58d76d;border-radius:5px;background:#082b10;color:#c5ffac;padding:6px 9px;font:800 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.dock} button.on{border-color:#9dff7c;background:#16461e;color:#e1ffd2}.tsimm-track-selected{outline:1px solid #9dff7c!important;outline-offset:-2px!important}
      #${A.caption}{z-index:9;display:grid;gap:1px;box-sizing:border-box;padding:3px 6px;border:1px solid #27863f;border-radius:5px;background:#041109f5;color:#9ff48e;font:700 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:normal;box-shadow:none;pointer-events:none}
      #${A.caption} strong{font-size:8px;color:#c7ffad}#${A.caption} span{display:block;color:#72bd7d;font-size:7px}#${A.caption}.stacked{position:static!important;transform:none!important;width:auto!important;max-width:none!important;margin:3px 5px!important}#${A.caption}.stale{border-color:#9a6d1f;background:#211705f5;color:#ffd166}#${A.caption}.stale strong,#${A.caption}.stale span{color:#ffd166}#${A.caption}.outdated,#${A.caption}.missing{border-color:#8f4850;background:#23090cf5;color:#ff9ba3}#${A.caption}.outdated strong,#${A.caption}.outdated span,#${A.caption}.missing strong,#${A.caption}.missing span{color:#ff9ba3}
      .tsimm-track-format-row{position:relative!important}.tsimm-track-caption-anchor{position:relative!important}.tsimm-track-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:106px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}
      .tsimm-track-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-track-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-track-floor-row{box-shadow:inset 0 2px #347c41!important}
    `;
    document.head.appendChild(style);
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
        const item = { id, name };
        if (id) result.id[String(id)] = item;
        result.name[key(name)] = item;
      }
      return result;
    };
    const shared = normalize(read(A.sharedCatalog, {}));
    const own = normalize(read(A.catalog, {}));
    return { id: { ...shared.id, ...own.id }, name: { ...shared.name, ...own.name } };
  }

  function bridge() {
    const raw = String(window.name || '');
    if (!raw.startsWith(A.bridge)) return null;
    try {
      return JSON.parse(raw.slice(A.bridge.length));
    } catch {
      return null;
    }
  }

  function findTrader(list, pending, identity) {
    const pendingName = key(pending?.name), identityName = key(identity?.name);
    return list.findIndex((candidate) =>
      (pending?.traderId && String(candidate?.id) === String(pending.traderId))
      || (Number(pending?.userId) > 0 && Number(candidate?.userId) === Number(pending.userId))
      || (pendingName && key(candidate?.name) === pendingName)
      || (identity?.traderId && String(candidate?.id) === String(identity.traderId))
      || (Number(identity?.userId) > 0 && Number(candidate?.userId) === Number(identity.userId))
      || (identityName && key(candidate?.name) === identityName));
  }

  function changed(previous, next) {
    const map = (items) => new Map((items || []).map((item) => [itemKey(item.itemId, item.itemName), Number(item.unitPrice) || 0]));
    const oldMap = map(previous), newMap = map(next), keys = new Set([...oldMap.keys(), ...newMap.keys()]);
    let count = 0;
    for (const entryKey of keys) {
      if (!oldMap.has(entryKey) || !newMap.has(entryKey) || Math.round(oldMap.get(entryKey)) !== Math.round(newMap.get(entryKey))) count += 1;
    }
    return count;
  }

  function importTX() {
    const envelope = bridge(), compact = envelope?.type === 'capture' ? envelope.compact : null;
    if (!compact || clean(compact.p).toLowerCase() !== 'tornexchange') return false;
    const values = catalog();
    const items = (Array.isArray(compact.i) ? compact.i : []).map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const id = Number(entry[0]) > 0 ? Number(entry[0]) : null;
      const price = Math.max(0, Number(entry[1]) || 0);
      const name = clean(entry[2]) || (id ? values.id[String(id)]?.name : '') || (id ? `Item ${id}` : '');
      return name && price ? { itemId: id, itemName: name, normalizedName: key(name), unitPrice: price } : null;
    }).filter(Boolean);
    if (!items.length) return false;

    const pending = read(A.pending, null), identity = compact.t || {}, store = tradersRaw(), list = store.list;
    let index = findTrader(list, pending, identity);
    if (index < 0) {
      const name = clean(pending?.name || identity.name || identity.pageName) || 'Captured trader';
      list.push({
        id: clean(pending?.traderId || identity.traderId) || `trader-${Date.now()}`,
        name,
        normalizedName: key(name),
        userId: Number(pending?.userId || identity.userId) || null,
        rating: 0,
        targetPercent: 99,
        profileUrl: clean(identity.profileUrl),
        tradeUrl: clean(identity.tradeUrl),
        bannerUrl: clean(identity.bannerUrl),
        captureSource: 'tornexchange-pricelist',
        pricePageItems: [],
        createdAt: new Date().toISOString(),
      });
      index = list.length - 1;
    }

    const old = list[index], now = new Date().toISOString(), sourceUrl = clean(compact.u);
    list[index] = {
      ...old,
      normalizedName: key(old.name),
      previousPricePageUrl: sourceUrl && old.pricePageUrl && sourceUrl !== old.pricePageUrl
        ? old.pricePageUrl
        : clean(old.previousPricePageUrl),
      pricePageUrl: sourceUrl || clean(old.pricePageUrl),
      pricePageTitle: clean(compact.l || old.pricePageTitle).slice(0, 160),
      pricePageProvider: 'tornexchange',
      pricePageSourceUpdated: clean(compact.s).slice(0, 160),
      pricePageItems: items,
      pricePageCapturedAt: compact.c || now,
      pricePageLastCheckedAt: now,
      pricePageCaptureCount: Math.max(0, Number(old.pricePageCaptureCount) || 0) + 1,
      pricePageLastChangedCount: changed(old.pricePageItems, items),
      pricePageLastResult: 'tornexchange-pricelist:extensions',
      updatedAt: now,
    };

    write(A.traders, store.object ? { ...store.root, traders: list } : list);
    localStorage.removeItem(A.pending);
    window.name = clean(envelope.previousWindowName);
    try {
      sessionStorage.setItem(A.notice, JSON.stringify({ name: list[index].name, count: items.length }));
    } catch {}
    location.replace(location.href);
    return true;
  }

  function notice() {
    let payload = null;
    try {
      payload = JSON.parse(sessionStorage.getItem(A.notice) || 'null');
      sessionStorage.removeItem(A.notice);
    } catch {}
    if (!payload) return;
    const mount = () => {
      if (!document.body) return setTimeout(mount, 50);
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:12px;border:1px solid #36d399;border-radius:9px;background:#13231e;color:#eafff7;font:600 13px system-ui';
      box.textContent = `${payload.name}: ${Number(payload.count).toLocaleString()} TornExchange prices saved.`;
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 5000);
    };
    mount();
  }

  function pageName() {
    const headings = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].map((element) => clean(element.textContent));
    for (const heading of headings) {
      const match = heading.match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
      if (match) return clean(match[1]);
    }
    const titleMatch = clean(document.title).match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
    if (titleMatch) return clean(titleMatch[1]);
    return clean(decodeURIComponent(location.pathname).match(/^\/prices\/([^/]+)/i)?.[1]) || 'TornExchange trader';
  }

  function pageUpdated() {
    return clean(String(document.body?.innerText || '').match(/Prices\s+last\s+updated\s*:\s*([^\n\r]+)/i)?.[1]).slice(0, 120);
  }

  function parsePrice(value) {
    const text = clean(value);
    if (!/\d/.test(text)) return null;
    const number = Number(text.replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function rowId(row) {
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

  function scanTX() {
    const found = new Map();
    for (const table of document.querySelectorAll('table')) {
      const headingRow = table.querySelector('thead tr') || table.querySelector('tr');
      const headings = [...(headingRow?.querySelectorAll('th,td') || [])].map((element) => key(element.textContent));
      const nameIndex = headings.findIndex((heading) => heading === 'item name' || heading === 'item');
      const priceIndex = headings.findIndex((heading) => heading.includes('buy price') || heading === 'price');
      const rows = table.querySelectorAll('tbody tr').length ? table.querySelectorAll('tbody tr') : table.querySelectorAll('tr');
      for (const row of rows) {
        if (row === headingRow) continue;
        const cells = [...row.children].filter((element) => /^(?:TH|TD)$/i.test(element.tagName));
        if (cells.length < 2) continue;
        let selectedPriceIndex = priceIndex;
        if (selectedPriceIndex < 0 || !parsePrice(cells[selectedPriceIndex]?.textContent)) {
          for (let i = cells.length - 1; i >= 0; i -= 1) {
            if (parsePrice(cells[i].textContent)) {
              selectedPriceIndex = i;
              break;
            }
          }
        }
        const price = parsePrice(cells[selectedPriceIndex]?.textContent);
        if (!price) continue;
        let name = clean(cells[nameIndex]?.textContent);
        if (!name || /^(?:image|item|item name|buy price|price)$/i.test(name) || parsePrice(name)) {
          name = cells.map((cell, index) => ({ index, text: clean(cell.textContent) }))
            .filter((entry) => entry.index !== selectedPriceIndex && entry.text && !parsePrice(entry.text) && !/^image$/i.test(entry.text))
            .sort((a, b) => b.text.length - a.text.length)[0]?.text || '';
        }
        if (!name) continue;
        const id = rowId(row), entryKey = itemKey(id, name), previous = found.get(entryKey);
        if (!previous || price > previous.price) found.set(entryKey, { id, name, price });
      }
    }
    return [...found.values()];
  }

  function request() {
    const envelope = bridge();
    return envelope?.type === 'request' && (!envelope.expiresAt || Number(envelope.expiresAt) > Date.now())
      ? envelope
      : null;
  }

  function sendTX(items, name, updated) {
    const captureRequest = request(), armed = clean(captureRequest?.trader?.name);
    if (armed && key(armed) !== key(name)
      && !confirm(`IMM is armed for ${armed}, but this page belongs to ${name}.\n\nSave these prices to ${armed}?`)) return;
    const compact = {
      v: 1,
      p: 'tornexchange',
      t: { ...(captureRequest?.trader || {}), name: armed || name, pageName: name },
      u: location.origin + location.pathname,
      l: `${name} TornExchange prices`,
      c: new Date().toISOString(),
      s: updated,
      i: items.map((item) => item.id ? [item.id, Math.round(item.price)] : [0, Math.round(item.price), item.name]),
    };
    const returnUrl = 'https://www.torn.com/page.php?sid=ItemMarket';
    window.name = A.bridge + JSON.stringify({
      version: 1,
      type: 'capture',
      compact,
      returnUrl,
      previousWindowName: clean(captureRequest?.previousWindowName),
    });
    location.href = returnUrl;
  }

  function txBoot() {
    let timer = 0, autoTimer = 0, sent = false;
    const draw = () => {
      injectStyle();
      const items = scanTX(), name = pageName(), updated = pageUpdated(), captureRequest = request(), armed = clean(captureRequest?.trader?.name);
      const mismatch = armed && key(armed) !== key(name);
      let panel = document.getElementById('tsimm-tx-panel');
      if (!panel) {
        panel = document.createElement('section');
        panel.id = 'tsimm-tx-panel';
        document.body.appendChild(panel);
      }
      panel.innerHTML = `<div class="txh"><strong>&gt; TORNEXCHANGE_CAPTURE</strong><span>v${A.v}</span></div><div class="txb"><div class="txg"><span>PAGE</span><b>${esc(name)}</b><span>PRICES</span><b>${items.length.toLocaleString()}</b><span>UPDATED</span><b>${esc(updated || 'Unknown')}</b><span>TARGET</span><b>${esc(armed || name)}</b></div>${mismatch ? `<div class="txw">ARMED FOR ${esc(armed)} · PAGE IS ${esc(name)}</div>` : ''}<div class="txa"><button data-tx="scan">RESCAN</button><button data-tx="save" ${items.length ? '' : 'disabled'}>CAPTURE & RETURN</button></div></div>`;
      panel.querySelector('[data-tx="scan"]')?.addEventListener('click', draw);
      panel.querySelector('[data-tx="save"]')?.addEventListener('click', () => sendTX(items, name, updated));
      clearTimeout(autoTimer);
      if (captureRequest?.autoReturn && !mismatch && items.length && !sent) {
        autoTimer = setTimeout(() => {
          sent = true;
          sendTX(items, name, updated);
        }, 1400);
      }
    };
    const start = () => {
      if (!document.body) return setTimeout(start, 60);
      draw();
      new MutationObserver((records) => {
        const panel = document.getElementById('tsimm-tx-panel');
        if (panel && records.every((record) => panel.contains(record.target))) return;
        clearTimeout(timer);
        timer = setTimeout(draw, 180);
      }).observe(document.body, { childList: true, subtree: true });
    };
    start();
  }

  function trackedStore() {
    const raw = read(A.tracked, {});
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    const unique = new Map();
    for (const candidate of source) {
      if (!candidate) continue;
      const entry = {
        traderId: clean(candidate.traderId),
        traderName: clean(candidate.traderName),
        itemId: Number(candidate.itemId) > 0 ? Number(candidate.itemId) : null,
        itemName: clean(candidate.itemName),
        markedAt: candidate.markedAt || new Date().toISOString(),
        markedPrice: Number(candidate.markedPrice) || 0,
        markedCapturedAt: candidate.markedCapturedAt || null,
        sourceUrl: clean(candidate.sourceUrl),
      };
      if (!entry.itemName) continue;
      unique.set(`${entry.traderId || key(entry.traderName)}|${itemKey(entry.itemId, entry.itemName)}`, entry);
    }
    return { schema: 'tornscripture-imm-tracked-items', schemaVersion: 1, entries: [...unique.values()] };
  }

  function saveTracked(store) {
    store.updatedAt = new Date().toISOString();
    write(A.tracked, store);
    try {
      window.dispatchEvent(new CustomEvent('tsimm:tracked-items-updated', { detail: store }));
    } catch {}
  }

  function isTracked(store, trader, item) {
    return store.entries.some((entry) =>
      (entry.traderId ? entry.traderId === trader.id : key(entry.traderName) === trader.n)
      && itemKey(entry.itemId, entry.itemName) === itemKey(item.id, item.name));
  }

  function toggleTrack(trader, item) {
    const store = trackedStore();
    const index = store.entries.findIndex((entry) =>
      (entry.traderId ? entry.traderId === trader.id : key(entry.traderName) === trader.n)
      && itemKey(entry.itemId, entry.itemName) === itemKey(item.id, item.name));
    if (index >= 0) store.entries.splice(index, 1);
    else store.entries.push({
      traderId: trader.id,
      traderName: trader.name,
      itemId: item.id,
      itemName: item.name,
      markedAt: new Date().toISOString(),
      markedPrice: item.price,
      markedCapturedAt: trader.captured,
      sourceUrl: trader.url,
    });
    saveTracked(store);
    scheduleTorn();
  }

  let activeTrader = '', selectedDeal = null, tornTimer = 0, ownMutation = false;

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
    const overlay = document.getElementById(A.deals), trader = reportTrader(normTraders()), deal = dealFromRow(row, trader);
    if (!overlay || !deal) return;
    selectedDeal = deal;
    overlay.querySelectorAll('.tsimm-track-selected').forEach((element) => element.classList.remove('tsimm-track-selected'));
    row.classList.add('tsimm-track-selected');
    renderTrackDock();
  }

  function renderTrackDock() {
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
      dock.innerHTML = '<div class="track-copy"><small>TRACK TARGET</small><strong>TAP AN ITEM ROW</strong><span>Select a trader item to mark it.</span></div><button type="button" disabled>SELECT ITEM</button>';
      return;
    }
    const tracked = isTracked(trackedStore(), selectedDeal.trader, selectedDeal.item);
    dock.innerHTML = `<div class="track-copy"><small>TRACK TARGET · ${esc(selectedDeal.trader.name)}</small><strong>${esc(selectedDeal.item.name)}</strong><span>Trader pays ${cash(selectedDeal.item.price)} · tap another row to change</span></div><button type="button" class="${tracked ? 'on' : ''}" data-track-dock-toggle>${tracked ? '✓ TRACKED' : '+ TRACK'}</button>`;
    const selectedKey = itemKey(selectedDeal.item.id, selectedDeal.item.name);
    overlay.querySelectorAll('.td-row').forEach((row) => {
      const deal = dealFromRow(row, trader);
      row.classList.toggle('tsimm-track-selected', Boolean(deal && itemKey(deal.item.id, deal.item.name) === selectedKey));
    });
  }

  function resolvedTracked() {
    const traders = normTraders(), store = trackedStore();
    const settings = { freshAgeHours: 72, actionableAgeHours: 168, ...read(A.overlaySettings, {}) };
    const groups = new Map();
    for (const tracked of store.entries) {
      const trader = traders.find((candidate) => tracked.traderId
        ? candidate.id === tracked.traderId
        : candidate.n === key(tracked.traderName));
      const item = trader?.items.find((candidate) => tracked.itemId
        ? candidate.id === tracked.itemId
        : candidate.n === key(tracked.itemName));
      const captured = trader?.captured || tracked.markedCapturedAt;
      const capturedMs = Date.parse(captured || '');
      const ageHours = Number.isFinite(capturedMs) ? Math.max(0, Date.now() - capturedMs) / 3600000 : Infinity;
      const status = !trader || !item || !item.price
        ? 'missing'
        : ageHours <= Number(settings.freshAgeHours || 72)
          ? 'fresh'
          : ageHours <= Number(settings.actionableAgeHours || 168)
            ? 'stale'
            : 'outdated';
      const entry = {
        ...tracked,
        traderName: trader?.name || tracked.traderName,
        price: item?.price || tracked.markedPrice,
        captured,
        status,
      };
      const groupKey = itemKey(tracked.itemId, tracked.itemName);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(entry);
    }
    const rank = { fresh: 0, stale: 1, outdated: 2, missing: 3 };
    for (const entries of groups.values()) {
      entries.sort((a, b) => rank[a.status] - rank[b.status] || b.price - a.price);
    }
    return groups;
  }

  function marketPage() {
    return /itemmarket|sid=ItemMarket/i.test(`${location.pathname}${location.search}${location.hash}`)
      || Boolean(document.querySelector('.tsimm-listing-mark,.tsimm-category-mark'));
  }

  function idFrom(value) {
    const match = String(value || '').match(/[?&#](?:itemID|itemId|item_id|item|ID)=(\d+)/i)
      || String(value || '').match(/\/(?:items?|item)\/(\d+)/i)
      || String(value || '').match(/\bitem(?:id)?[=/](\d+)/i);
    return Number(match?.[1]) || null;
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function ownText(element) {
    if (!(element instanceof Element)) return '';
    return clean([...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(' '));
  }

  function currentTrackedGroup(groups) {
    const urlId = idFrom(location.href);
    if (urlId && groups.has(`id:${urlId}`)) return [`id:${urlId}`, groups.get(`id:${urlId}`)];
    const byName = new Map();
    for (const [groupKey, list] of groups) {
      const itemName = clean(list?.[0]?.itemName);
      if (itemName) byName.set(key(itemName), [groupKey, list]);
    }
    const selectors = 'h1,h2,h3,h4,[role="heading"],[class*="title"],[class*="name"],strong,span,div';
    for (const element of document.querySelectorAll(selectors)) {
      if (!visible(element)
        || element.closest(`#${A.deals},#${A.dock},#${A.caption},[data-tsimm-track-profit],.tsimm-listing-mark`)) continue;
      const match = byName.get(key(element.textContent));
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
        || element.closest(`#${A.deals},#${A.dock},#${A.caption},.tsimm-listing-mark,[data-tsimm-track-profit]`)) continue;
      if (/^(H1|H2|H3|H4)$/i.test(element.tagName)
        || element.matches('[role="heading"],[class*="title"],[class*="name"]')) preferred.push(element);
      else fallback.push(element);
    }
    return preferred[0] || fallback[0] || null;
  }

  function listingPrice(row) {
    const candidates = [...row.querySelectorAll('span,div,p,strong,b')]
      .filter((element) => !element.closest('[data-tsimm-track-profit],.tsimm-tmo-badge,.tsimm-margin-badge'));
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
    document.querySelectorAll('[data-tsimm-tracked], [data-tsimm-track-profit]').forEach((element) => element.remove());
    const caption = document.getElementById(A.caption);
    const captionAnchor = caption?.parentElement;
    caption?.remove();
    if (captionAnchor?.dataset?.tsimmTrackCaptionAnchor === '1') {
      captionAnchor.classList.remove('tsimm-track-caption-anchor');
      delete captionAnchor.dataset.tsimmTrackCaptionAnchor;
    }
    document.querySelectorAll('[data-tsimm-track-caption-anchor="1"]').forEach((anchor) => {
      anchor.classList.remove('tsimm-track-caption-anchor');
      delete anchor.dataset.tsimmTrackCaptionAnchor;
    });
    document.querySelectorAll('.tsimm-tracked-buy-row,.tsimm-track-profitable,.tsimm-track-floor-row,.tsimm-track-format-row').forEach((row) => {
      row.classList.remove('tsimm-tracked-buy-row', 'tsimm-track-profitable', 'tsimm-track-floor-row', 'tsimm-track-format-row');
      delete row.dataset.tsimmTrackedToken;
    });
  }

  function placeCaption(caption, title) {
    const closest = title.closest('[class*="header"],[class*="title"]');
    const anchor = closest && closest !== title ? closest : title.parentElement || title;
    if (!(anchor instanceof Element)) return;
    document.querySelectorAll('[data-tsimm-track-caption-anchor="1"]').forEach((previous) => {
      if (previous === anchor) return;
      previous.classList.remove('tsimm-track-caption-anchor');
      delete previous.dataset.tsimmTrackCaptionAnchor;
    });
    anchor.classList.add('tsimm-track-caption-anchor');
    anchor.dataset.tsimmTrackCaptionAnchor = '1';
    if (caption.parentElement !== anchor) anchor.appendChild(caption);
    caption.classList.remove('stacked');
    caption.style.position = 'absolute';
    caption.style.top = '50%';
    caption.style.transform = 'translateY(-50%)';
    caption.style.right = '84px';
    const anchorRect = anchor.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const left = Math.max(8, Math.round(titleRect.right - anchorRect.left + 8));
    caption.style.left = `${left}px`;
    const available = anchorRect.width - left - 84;
    if (available >= 150) return;
    caption.classList.add('stacked');
    caption.removeAttribute('style');
    anchor.classList.remove('tsimm-track-caption-anchor');
    delete anchor.dataset.tsimmTrackCaptionAnchor;
    anchor.insertAdjacentElement('afterend', caption);
  }

  function renderCaption(entry, itemName, summary = null) {
    const title = findTitleElement(itemName);
    if (!title) return null;
    let caption = document.getElementById(A.caption);
    if (!caption) {
      caption = document.createElement('div');
      caption.id = A.caption;
    }
    caption.className = entry.status;
    const age = ageText(entry.captured);
    if (entry.status === 'fresh') {
      const count = Math.max(0, Number(summary?.count) || 0);
      const best = Math.max(0, Number(summary?.best) || 0);
      caption.innerHTML = `<strong>📌 ${esc(entry.traderName)} pays ${esc(cash(entry.price))} · ${esc(age)} old</strong><span>${count.toLocaleString()} profitable${best > 0 ? ` · best +${esc(cash(best))} ea` : ''} · buy below ${esc(cash(entry.price))}</span>`;
    } else if (entry.status === 'stale') {
      caption.innerHTML = `<strong>⌛ TRACKED REFERENCE · ${esc(entry.traderName)}</strong><span>Last paid ${esc(cash(entry.price))} · ${esc(age)} old · no buy signal</span>`;
    } else if (entry.status === 'outdated') {
      caption.innerHTML = `<strong>⚠ TRACKED PRICE OUTDATED · ${esc(entry.traderName)}</strong><span>Last paid ${esc(cash(entry.price))} · recapture before buying</span>`;
    } else {
      caption.innerHTML = `<strong>⚠ TRACKED PRICE UNAVAILABLE · ${esc(entry.traderName)}</strong><span>Recapture this trader before buying</span>`;
    }
    placeCaption(caption, title);
    return caption;
  }

  function addProfitMarker(row, trackedProfit) {
    const immProfit = signedEach(row.querySelector('.tsimm-margin-badge')?.textContent);
    let label = '';
    let flip = false;
    if (Number.isFinite(immProfit) && immProfit < 0) {
      label = `📌 FLIP +${cash(trackedProfit)}`;
      flip = true;
    } else if (Number.isFinite(immProfit)) {
      const extra = trackedProfit - immProfit;
      if (extra <= 0) return false;
      label = `📌 +${cash(extra)} extra`;
    } else {
      label = `📌 +${cash(trackedProfit)}`;
    }
    const marker = document.createElement('span');
    marker.className = `tsimm-track-profit${flip ? ' flip' : ''}`;
    marker.dataset.tsimmTrackProfit = '1';
    marker.dataset.tsimmTrackTraderProfit = String(trackedProfit);
    marker.textContent = label;
    row.appendChild(marker);
    row.classList.add('tsimm-track-format-row', 'tsimm-track-profitable');
    return true;
  }

  function decorateMarket() {
    cleanupMarket();
    if (!marketPage()) return;
    const groups = resolvedTracked();
    if (!groups.size) return;
    const match = currentTrackedGroup(groups);
    if (!match?.[1]?.length) return;
    const entry = match[1][0], itemName = clean(entry.itemName);
    if (entry.status !== 'fresh') {
      renderCaption(entry, itemName);
      return;
    }

    const rows = [...document.querySelectorAll('.tsimm-listing-mark')];
    let sawProfit = false, floorPlaced = false, count = 0, best = 0;
    for (const row of rows) {
      const price = listingPrice(row);
      const trackedProfit = price > 0 ? entry.price - price : 0;
      const profitable = trackedProfit > 0;
      if (profitable) {
        sawProfit = true;
        count += 1;
        best = Math.max(best, trackedProfit);
        addProfitMarker(row, trackedProfit);
      } else if (sawProfit && !floorPlaced && price > 0) {
        row.classList.add('tsimm-track-floor-row');
        floorPlaced = true;
      }
    }
    renderCaption(entry, itemName, { count, best });
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

  function openRecapture(trader) {
    const now = Date.now();
    write(A.pending, {
      traderId: trader.id,
      userId: trader.uid,
      name: trader.name,
      armedAt: now,
      expiresAt: now + 3600000,
    });
    const current = bridge();
    const previousWindowName = clean(current?.previousWindowName
      || (String(window.name).startsWith(A.bridge) ? '' : String(window.name).slice(0, 4096)));
    window.name = A.bridge + JSON.stringify({
      version: 1,
      type: 'request',
      trader: {
        traderId: trader.id,
        userId: trader.uid,
        name: trader.name,
        profileUrl: clean(trader.raw.profileUrl),
        tradeUrl: clean(trader.raw.tradeUrl),
        bannerUrl: clean(trader.raw.bannerUrl),
      },
      returnUrl: 'https://www.torn.com/page.php?sid=ItemMarket',
      expiresAt: now + 900000,
      autoReturn: true,
      previousWindowName,
    });
    location.href = trader.url;
  }

  function decorateBook() {
    const book = document.getElementById('tornscripture-imm-traders');
    if (!book) return;
    const traders = normTraders();
    for (const card of book.querySelectorAll('.tsimm-trader-card')) {
      const trader = cardTrader(card, traders);
      let button = card.querySelector('[data-tx-recapture]');
      if (!trader || !isTX(trader.url)) {
        button?.remove();
        continue;
      }
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.txRecapture = '1';
        button.className = 'tsimm-tx-recapture';
        button.textContent = 'Open & recapture';
        const actions = card.querySelector('.tsimm-trader-actions') || card;
        const edit = actions.querySelector('[data-tsimm-action="trader-edit"]');
        edit ? actions.insertBefore(button, edit) : actions.appendChild(button);
      }
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
        ['dock', renderTrackDock],
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

  function tornBoot() {
    if (importTX()) return;
    notice();
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
        const dockButton = event.target.closest?.('[data-track-dock-toggle]');
        if (dockButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (selectedDeal) {
            toggleTrack(selectedDeal.trader, selectedDeal.item);
            renderTrackDock();
          }
          return;
        }
        const recapture = event.target.closest?.('[data-tx-recapture]');
        if (recapture) {
          event.preventDefault();
          event.stopPropagation();
          const trader = normTraders().find((candidate) => candidate.id === clean(recapture.dataset.trader));
          if (trader) openRecapture(trader);
        }
      }, true);
      new MutationObserver(() => {
        if (!ownMutation) scheduleTorn();
      }).observe(document.body, { childList: true, subtree: true });
      window.addEventListener('tsimm:tracked-items-updated', scheduleTorn);
      setInterval(scheduleTorn, 1500);
      scheduleTorn();
    };
    start();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    isTorn() ? tornBoot() : txBoot();
  }
})();
