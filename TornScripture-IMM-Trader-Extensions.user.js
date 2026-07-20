// ==UserScript==
// @name         TornScripture - IMM Trader Extensions
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.5
// @description  Adds TornExchange capture, a persistent Deals tracking dock, and tracked purchase prompts on Item Market listings.
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
    v: '0.1.5', bridge: 'TSIMM_PRICE_BRIDGE:', traders: 'tornscripture-imm-traders-v1',
    pending: 'tornscripture-imm-pending-trader-capture-v1', catalog: 'tornscripture-imm-catalog-v1',
    sharedCatalog: 'tornscripture-ish-torn-catalog-v1', tracked: 'tornscripture-imm-tracked-items-v1',
    overlaySettings: 'tornscripture-imm-trader-market-overlay-settings-v1', notice: 'tsimm-tx-notice-v1',
    deals: 'tornscripture-imm-trader-deals-addon', style: 'tsimm-trader-extensions-style', dock: 'tsimm-track-dock',
  });

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const read = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : clone(f); } catch { return clone(f); } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const key = (v) => clean(v).toLowerCase().replace(/[’‘]/g, "'").replace(/_/g, ' ').replace(/[^a-z0-9'+&-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const cash = (v) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const itemKey = (id, name) => Number(id) > 0 ? `id:${Number(id)}` : `name:${key(name)}`;
  const http = (v) => { try { const u = new URL(String(v || ''), location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const tornUrl = (v) => { const n = http(v); if (!n) return ''; try { return /^(?:www\.)?torn\.com$/i.test(new URL(n).hostname) ? n : ''; } catch { return ''; } };
  const ageText = (v) => { const t = Date.parse(v || ''); if (!Number.isFinite(t)) return 'unknown age'; const m = Math.max(0, Math.floor((Date.now() - t) / 60000)); if (m < 60) return `${m}m`; const h = Math.floor(m / 60); return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`; };
  const isTorn = () => /^(?:www\.)?torn\.com$/i.test(location.hostname);
  const isTX = (v = location.href) => { const n = http(v); if (!n) return false; try { const u = new URL(n); return /^(?:www\.)?tornexchange\.com$/i.test(u.hostname) && /^\/prices\/[^/]+\/?$/i.test(u.pathname); } catch { return false; } };

  function injectStyle() {
    if (document.getElementById(A.style)) return;
    const s = document.createElement('style');
    s.id = A.style;
    s.textContent = `
      #tsimm-tx-panel{position:fixed;right:10px;bottom:10px;z-index:2147483646;width:min(360px,calc(100vw - 20px));border:1px solid #3bd35d;border-radius:9px;background:#020704;color:#aaff83;box-shadow:0 14px 40px #000c;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden}#tsimm-tx-panel *{box-sizing:border-box}.txh{display:flex;padding:9px 10px;background:#041108;border-bottom:1px solid #1d6b2d}.txh strong{flex:1}.txb{display:grid;gap:7px;padding:10px}.txg{display:grid;grid-template-columns:1fr auto;gap:4px 8px}.txg b{text-align:right}.txw{padding:7px;border:1px solid #9a6d1f;border-radius:5px;background:#241a05;color:#ffd166}.txa{display:grid;grid-template-columns:1fr 1.7fr;gap:6px}#tsimm-tx-panel button,.tsimm-tx-recapture{border:1px solid #2c843d;border-radius:5px;background:#06170a;color:#b6ff9d;padding:8px;font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.dock}{position:fixed;left:8px;right:8px;bottom:max(70px,calc(env(safe-area-inset-bottom) + 62px));z-index:2147483647;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #68e879;border-radius:7px;background:#020a04f2;color:#aaff83;box-shadow:0 8px 28px #000d;font:10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.dock}[hidden]{display:none!important}#${A.dock} .track-copy{display:grid;min-width:0;gap:2px}#${A.dock} small{color:#5ea66a;font-size:7px;letter-spacing:.08em}#${A.dock} strong{overflow:hidden;color:#c1ff9d;font-size:11px;white-space:nowrap;text-overflow:ellipsis}#${A.dock} span{overflow:hidden;color:#70b87b;font-size:8px;white-space:nowrap;text-overflow:ellipsis}#${A.dock} button{min-width:88px;min-height:38px;border:1px solid #58d76d;border-radius:5px;background:#082b10;color:#c5ffac;padding:6px 9px;font:800 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.dock} button.on{border-color:#9dff7c;background:#16461e;color:#e1ffd2}.tsimm-track-selected{outline:1px solid #9dff7c!important;outline-offset:-2px!important}
      .tsimm-tracked-badge{display:grid!important;gap:2px!important;margin-top:4px!important;padding:5px 7px!important;min-width:150px!important;border:1px solid #2e8f50!important;border-radius:6px!important;background:#05200ff2!important;color:#aaff83!important;font:700 9px/1.22 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:normal!important;box-shadow:0 2px 10px #0007!important}.tsimm-tracked-badge strong{color:#c8ffae!important;font-size:10px!important}.tsimm-tracked-badge span{display:block!important}.tsimm-tracked-badge.stale{border-color:#b4872d!important;background:#241a05f2!important;color:#ffd166!important}.tsimm-tracked-badge.stale strong{color:#ffe09a!important}.tsimm-tracked-badge.outdated,.tsimm-tracked-badge.missing{border-color:#8f4850!important;background:#23090cf2!important;color:#ff9ba3!important}.tsimm-tracked-buy-row{box-shadow:inset -4px 0 #58df78!important}
    `;
    document.head?.appendChild(s);
  }

  function tradersRaw() {
    const r = read(A.traders, []);
    return { root: r, object: !Array.isArray(r) && Array.isArray(r?.traders), list: Array.isArray(r) ? r : Array.isArray(r?.traders) ? r.traders : [] };
  }

  function normItem(x) {
    if (!x || typeof x !== 'object') return null;
    const id = Number(x.itemId ?? x.id) > 0 ? Number(x.itemId ?? x.id) : null;
    const name = clean(x.itemName ?? x.name) || (id ? `Item ${id}` : '');
    const price = Math.max(0, Number(x.unitPrice ?? x.price ?? x.value) || 0);
    return name ? { id, name, n: key(name), price } : null;
  }

  function normTraders() {
    return tradersRaw().list.map((x) => {
      if (!x || typeof x !== 'object') return null;
      const name = clean(x.name ?? x.username);
      if (!name) return null;
      const uid = Number(x.userId ?? x.tornId) > 0 ? Number(x.userId ?? x.tornId) : null;
      return {
        raw: x,
        id: clean(x.recordId ?? x.uuid) || (typeof x.id === 'string' ? clean(x.id) : '') || (uid ? `trader-${uid}` : `trader-${key(name)}`),
        name,
        n: key(name),
        uid,
        captured: x.pricePageLastCheckedAt || x.pricePageCapturedAt || x.pricesCapturedAt || null,
        url: clean(x.pricePageUrl ?? x.pricingPageUrl),
        items: (Array.isArray(x.pricePageItems ?? x.pricingItems) ? x.pricePageItems ?? x.pricingItems : []).map(normItem).filter(Boolean),
      };
    }).filter(Boolean);
  }

  function catalog() {
    const norm = (r) => {
      const o = { id: {}, name: {} }, src = r?.itemsByName || r?.items || {};
      const es = Array.isArray(src) ? src.map((x) => [String(x?.id ?? ''), x]) : Object.entries(src);
      for (const [k, x] of es) {
        if (!x || typeof x !== 'object') continue;
        const id = Number(x.id ?? x.itemId ?? k) > 0 ? Number(x.id ?? x.itemId ?? k) : null;
        const name = clean(x.name);
        if (!name) continue;
        const v = { id, name };
        if (id) o.id[String(id)] = v;
        o.name[key(name)] = v;
      }
      return o;
    };
    const a = norm(read(A.sharedCatalog, {})), b = norm(read(A.catalog, {}));
    return { id: { ...a.id, ...b.id }, name: { ...a.name, ...b.name } };
  }

  function bridge() {
    const r = String(window.name || '');
    if (!r.startsWith(A.bridge)) return null;
    try { return JSON.parse(r.slice(A.bridge.length)); } catch { return null; }
  }

  function findTrader(list, pending, ident) {
    const pn = key(pending?.name), tn = key(ident?.name);
    return list.findIndex((x) =>
      (pending?.traderId && String(x?.id) === String(pending.traderId))
      || (Number(pending?.userId) > 0 && Number(x?.userId) === Number(pending.userId))
      || (pn && key(x?.name) === pn)
      || (ident?.traderId && String(x?.id) === String(ident.traderId))
      || (Number(ident?.userId) > 0 && Number(x?.userId) === Number(ident.userId))
      || (tn && key(x?.name) === tn));
  }

  function changed(a, b) {
    const m = (z) => new Map((z || []).map((x) => [itemKey(x.itemId, x.itemName), Number(x.unitPrice) || 0]));
    const x = m(a), y = m(b), ks = new Set([...x.keys(), ...y.keys()]);
    let n = 0;
    for (const k of ks) if (!x.has(k) || !y.has(k) || Math.round(x.get(k)) !== Math.round(y.get(k))) n++;
    return n;
  }

  function importTX() {
    const e = bridge(), c = e?.type === 'capture' ? e.compact : null;
    if (!c || clean(c.p).toLowerCase() !== 'tornexchange') return false;
    const cv = catalog();
    const items = (Array.isArray(c.i) ? c.i : []).map((z) => {
      if (!Array.isArray(z) || z.length < 2) return null;
      const id = Number(z[0]) > 0 ? Number(z[0]) : null;
      const price = Math.max(0, Number(z[1]) || 0);
      const name = clean(z[2]) || (id ? cv.id[String(id)]?.name : '') || (id ? `Item ${id}` : '');
      return name && price ? { itemId: id, itemName: name, normalizedName: key(name), unitPrice: price } : null;
    }).filter(Boolean);
    if (!items.length) return false;

    const p = read(A.pending, null), ident = c.t || {}, store = tradersRaw(), list = store.list;
    let i = findTrader(list, p, ident);
    if (i < 0) {
      const name = clean(p?.name || ident.name || ident.pageName) || 'Captured trader';
      list.push({
        id: clean(p?.traderId || ident.traderId) || `trader-${Date.now()}`,
        name, normalizedName: key(name), userId: Number(p?.userId || ident.userId) || null,
        rating: 0, targetPercent: 99, profileUrl: clean(ident.profileUrl), tradeUrl: clean(ident.tradeUrl),
        bannerUrl: clean(ident.bannerUrl), captureSource: 'tornexchange-pricelist', pricePageItems: [], createdAt: new Date().toISOString(),
      });
      i = list.length - 1;
    }

    const old = list[i], now = new Date().toISOString(), ch = changed(old.pricePageItems, items), url = clean(c.u);
    list[i] = {
      ...old,
      normalizedName: key(old.name),
      previousPricePageUrl: url && old.pricePageUrl && url !== old.pricePageUrl ? old.pricePageUrl : clean(old.previousPricePageUrl),
      pricePageUrl: url || clean(old.pricePageUrl),
      pricePageTitle: clean(c.l || old.pricePageTitle).slice(0, 160),
      pricePageProvider: 'tornexchange',
      pricePageSourceUpdated: clean(c.s).slice(0, 160),
      pricePageItems: items,
      pricePageCapturedAt: c.c || now,
      pricePageLastCheckedAt: now,
      pricePageCaptureCount: Math.max(0, Number(old.pricePageCaptureCount) || 0) + 1,
      pricePageLastChangedCount: ch,
      pricePageLastResult: 'tornexchange-pricelist:extensions',
      updatedAt: now,
    };
    write(A.traders, store.object ? { ...store.root, traders: list } : list);
    localStorage.removeItem(A.pending);
    window.name = clean(e.previousWindowName);
    try { sessionStorage.setItem(A.notice, JSON.stringify({ name: list[i].name, count: items.length })); } catch {}
    location.replace(location.href);
    return true;
  }

  function notice() {
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem(A.notice) || 'null'); sessionStorage.removeItem(A.notice); } catch {}
    if (!p) return;
    const mount = () => {
      if (!document.body) return setTimeout(mount, 50);
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:12px;border:1px solid #36d399;border-radius:9px;background:#13231e;color:#eafff7;font:600 13px system-ui';
      d.textContent = `${p.name}: ${Number(p.count).toLocaleString()} TornExchange prices saved.`;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 5000);
    };
    mount();
  }

  function pageName() {
    const hs = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].map((x) => clean(x.textContent));
    for (const h of hs) {
      const m = h.match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
      if (m) return clean(m[1]);
    }
    const t = clean(document.title).match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
    if (t) return clean(t[1]);
    return clean(decodeURIComponent(location.pathname).match(/^\/prices\/([^/]+)/i)?.[1]) || 'TornExchange trader';
  }

  function pageUpdated() {
    return clean(String(document.body?.innerText || '').match(/Prices\s+last\s+updated\s*:\s*([^\n\r]+)/i)?.[1]).slice(0, 120);
  }

  function parsePrice(v) {
    const t = clean(v);
    if (!/\d/.test(t)) return null;
    const n = Number(t.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function rowId(row) {
    for (const n of row.querySelectorAll('[href],[src],[data-item-id],[data-itemid],[data-id]')) {
      for (const v of [n.getAttribute('href'), n.getAttribute('src'), n.getAttribute('data-item-id'), n.getAttribute('data-itemid'), n.getAttribute('data-id')].filter(Boolean)) {
        const m = String(v).match(/[?&#](?:itemID|itemId|item_id|ID|id)=(\d+)/i) || String(v).match(/\/(?:images\/)?items?\/(\d+)(?:\/|\.|$)/i);
        if (Number(m?.[1]) > 0) return Number(m[1]);
      }
    }
    return null;
  }

  function scanTX() {
    const out = new Map();
    for (const table of document.querySelectorAll('table')) {
      const hr = table.querySelector('thead tr') || table.querySelector('tr');
      const heads = [...(hr?.querySelectorAll('th,td') || [])].map((x) => key(x.textContent));
      const ni = heads.findIndex((x) => x === 'item name' || x === 'item');
      const pi = heads.findIndex((x) => x.includes('buy price') || x === 'price');
      const rows = table.querySelectorAll('tbody tr').length ? table.querySelectorAll('tbody tr') : table.querySelectorAll('tr');
      for (const row of rows) {
        if (row === hr) continue;
        const cs = [...row.children].filter((x) => /^(?:TH|TD)$/i.test(x.tagName));
        if (cs.length < 2) continue;
        let pidx = pi;
        if (pidx < 0 || !parsePrice(cs[pidx]?.textContent)) {
          for (let j = cs.length - 1; j >= 0; j--) if (parsePrice(cs[j].textContent)) { pidx = j; break; }
        }
        const price = parsePrice(cs[pidx]?.textContent);
        if (!price) continue;
        let name = clean(cs[ni]?.textContent);
        if (!name || /^(?:image|item|item name|buy price|price)$/i.test(name) || parsePrice(name)) {
          name = cs.map((x, j) => ({ j, t: clean(x.textContent) }))
            .filter((x) => x.j !== pidx && x.t && !parsePrice(x.t) && !/^image$/i.test(x.t))
            .sort((a, b) => b.t.length - a.t.length)[0]?.t || '';
        }
        if (!name) continue;
        const id = rowId(row), k = itemKey(id, name), prev = out.get(k);
        if (!prev || price > prev.price) out.set(k, { id, name, price });
      }
    }
    return [...out.values()];
  }

  function request() {
    const e = bridge();
    return e?.type === 'request' && (!e.expiresAt || Number(e.expiresAt) > Date.now()) ? e : null;
  }

  function sendTX(items, name, updated) {
    const r = request(), armed = clean(r?.trader?.name);
    if (armed && key(armed) !== key(name) && !confirm(`IMM is armed for ${armed}, but this page belongs to ${name}.\n\nSave these prices to ${armed}?`)) return;
    const compact = {
      v: 1, p: 'tornexchange', t: { ...(r?.trader || {}), name: armed || name, pageName: name },
      u: location.origin + location.pathname, l: `${name} TornExchange prices`, c: new Date().toISOString(), s: updated,
      i: items.map((x) => x.id ? [x.id, Math.round(x.price)] : [0, Math.round(x.price), x.name]),
    };
    const ret = tornUrl(r?.returnUrl) || tornUrl(document.referrer) || 'https://www.torn.com/page.php?sid=ItemMarket';
    window.name = A.bridge + JSON.stringify({ version: 1, type: 'capture', compact, returnUrl: ret, previousWindowName: clean(r?.previousWindowName) });
    location.href = ret;
  }

  function txBoot() {
    let timer = 0, auto = 0, sent = false;
    const draw = () => {
      injectStyle();
      const items = scanTX(), name = pageName(), updated = pageUpdated(), r = request(), armed = clean(r?.trader?.name);
      const mismatch = armed && key(armed) !== key(name);
      let p = document.getElementById('tsimm-tx-panel');
      if (!p) { p = document.createElement('section'); p.id = 'tsimm-tx-panel'; document.body.appendChild(p); }
      p.innerHTML = `<div class="txh"><strong>&gt; TORNEXCHANGE_CAPTURE</strong><span>v${A.v}</span></div><div class="txb"><div class="txg"><span>PAGE</span><b>${esc(name)}</b><span>PRICES</span><b>${items.length.toLocaleString()}</b><span>UPDATED</span><b>${esc(updated || 'Unknown')}</b><span>TARGET</span><b>${esc(armed || name)}</b></div>${mismatch ? `<div class="txw">ARMED FOR ${esc(armed)} · PAGE IS ${esc(name)}</div>` : ''}<div class="txa"><button data-tx="scan">RESCAN</button><button data-tx="save" ${items.length ? '' : 'disabled'}>CAPTURE & RETURN</button></div></div>`;
      p.querySelector('[data-tx="scan"]')?.addEventListener('click', draw);
      p.querySelector('[data-tx="save"]')?.addEventListener('click', () => sendTX(items, name, updated));
      clearTimeout(auto);
      if (r?.autoReturn && !mismatch && items.length && !sent) auto = setTimeout(() => { sent = true; sendTX(items, name, updated); }, 1400);
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
    const r = read(A.tracked, {}), src = Array.isArray(r) ? r : Array.isArray(r?.entries) ? r.entries : [], map = new Map();
    for (const x of src) {
      if (!x) continue;
      const e = {
        traderId: clean(x.traderId), traderName: clean(x.traderName), itemId: Number(x.itemId) > 0 ? Number(x.itemId) : null,
        itemName: clean(x.itemName), markedAt: x.markedAt || new Date().toISOString(), markedPrice: Number(x.markedPrice) || 0,
        markedCapturedAt: x.markedCapturedAt || null, sourceUrl: clean(x.sourceUrl),
      };
      if (!e.itemName) continue;
      map.set(`${e.traderId || key(e.traderName)}|${itemKey(e.itemId, e.itemName)}`, e);
    }
    return { schema: 'tornscripture-imm-tracked-items', schemaVersion: 1, entries: [...map.values()] };
  }

  function saveTracked(s) {
    s.updatedAt = new Date().toISOString();
    write(A.tracked, s);
    try { window.dispatchEvent(new CustomEvent('tsimm:tracked-items-updated', { detail: s })); } catch {}
  }

  function isTracked(store, trader, item) {
    return store.entries.some((x) => (x.traderId ? x.traderId === trader.id : key(x.traderName) === trader.n)
      && itemKey(x.itemId, x.itemName) === itemKey(item.id, item.name));
  }

  function toggleTrack(trader, item) {
    const s = trackedStore();
    const i = s.entries.findIndex((x) => (x.traderId ? x.traderId === trader.id : key(x.traderName) === trader.n)
      && itemKey(x.itemId, x.itemName) === itemKey(item.id, item.name));
    if (i >= 0) s.entries.splice(i, 1);
    else s.entries.push({ traderId: trader.id, traderName: trader.name, itemId: item.id, itemName: item.name, markedAt: new Date().toISOString(), markedPrice: item.price, markedCapturedAt: trader.captured, sourceUrl: trader.url });
    saveTracked(s);
    scheduleTorn();
  }

  let activeTrader = '', selectedDeal = null, tornTimer = 0, ownMutation = false;

  function reportTrader(ts) {
    const overlay = document.getElementById(A.deals);
    if (!overlay) return null;
    const header = clean(overlay.querySelector('.td-head strong')?.textContent).replace(/^>\s*/, '').replace(/_DEALS$/i, '');
    const byHeader = header ? ts.find((x) => x.n === key(header)) : null;
    if (byHeader) { activeTrader = byHeader.id; return byHeader; }
    return activeTrader ? ts.find((x) => x.id === activeTrader) || null : null;
  }

  function dealFromRow(row, trader) {
    const name = clean(row?.querySelector('.td-row-title strong')?.textContent);
    const item = trader?.items.find((x) => x.n === key(name));
    return item ? { trader, item } : null;
  }

  function selectDeal(row) {
    const overlay = document.getElementById(A.deals), trader = reportTrader(normTraders()), deal = dealFromRow(row, trader);
    if (!overlay || !deal) return;
    selectedDeal = deal;
    overlay.querySelectorAll('.tsimm-track-selected').forEach((x) => x.classList.remove('tsimm-track-selected'));
    row.classList.add('tsimm-track-selected');
    renderTrackDock();
  }

  function renderTrackDock() {
    const overlay = document.getElementById(A.deals);
    let dock = document.getElementById(A.dock);
    if (!overlay) { dock?.remove(); selectedDeal = null; return; }
    const trader = reportTrader(normTraders());
    if (!trader) { dock?.remove(); return; }
    if (!selectedDeal || selectedDeal.trader.id !== trader.id || !trader.items.some((x) => itemKey(x.id, x.name) === itemKey(selectedDeal.item.id, selectedDeal.item.name))) {
      const deal = dealFromRow(overlay.querySelector('.td-row'), trader);
      if (deal) selectedDeal = deal;
    }
    if (!dock) { dock = document.createElement('section'); dock.id = A.dock; document.body.appendChild(dock); }
    if (!selectedDeal) {
      dock.innerHTML = '<div class="track-copy"><small>TRACK TARGET</small><strong>TAP AN ITEM ROW</strong><span>Select a trader item to mark it.</span></div><button type="button" disabled>SELECT ITEM</button>';
      return;
    }
    const on = isTracked(trackedStore(), selectedDeal.trader, selectedDeal.item);
    dock.innerHTML = `<div class="track-copy"><small>TRACK TARGET · ${esc(selectedDeal.trader.name)}</small><strong>${esc(selectedDeal.item.name)}</strong><span>Trader pays ${cash(selectedDeal.item.price)} · tap another row to change</span></div><button type="button" class="${on ? 'on' : ''}" data-track-dock-toggle>${on ? '✓ TRACKED' : '+ TRACK'}</button>`;
    const chosenKey = itemKey(selectedDeal.item.id, selectedDeal.item.name);
    overlay.querySelectorAll('.td-row').forEach((row) => {
      const deal = dealFromRow(row, trader);
      row.classList.toggle('tsimm-track-selected', Boolean(deal && itemKey(deal.item.id, deal.item.name) === chosenKey));
    });
  }

  function resolvedTracked() {
    const ts = normTraders(), s = trackedStore(), set = { freshAgeHours: 72, actionableAgeHours: 168, ...read(A.overlaySettings, {}) }, groups = new Map();
    for (const x of s.entries) {
      const t = ts.find((z) => x.traderId ? z.id === x.traderId : z.n === key(x.traderName));
      const it = t?.items.find((z) => x.itemId ? z.id === x.itemId : z.n === key(x.itemName));
      const cap = t?.captured || x.markedCapturedAt;
      const ms = Date.parse(cap || '');
      const h = Number.isFinite(ms) ? Math.max(0, Date.now() - ms) / 3600000 : Infinity;
      const status = !t || !it || !it.price ? 'missing' : h <= Number(set.freshAgeHours || 72) ? 'fresh' : h <= Number(set.actionableAgeHours || 168) ? 'stale' : 'outdated';
      const e = { ...x, traderName: t?.name || x.traderName, price: it?.price || x.markedPrice, captured: cap, status };
      const k = itemKey(x.itemId, x.itemName);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    const rank = { fresh: 0, stale: 1, outdated: 2, missing: 3 };
    for (const a of groups.values()) a.sort((x, y) => rank[x.status] - rank[y.status] || y.price - x.price);
    return groups;
  }

  function marketPage() {
    return /itemmarket|sid=ItemMarket/i.test(`${location.pathname}${location.search}${location.hash}`)
      || Boolean(document.querySelector('.tsimm-listing-mark,.tsimm-category-mark'));
  }

  function idFrom(value) {
    const m = String(value || '').match(/[?&#](?:itemID|itemId|item_id|item|ID)=(\d+)/i)
      || String(value || '').match(/\/(?:items?|item)\/(\d+)/i)
      || String(value || '').match(/\bitem(?:id)?[=/](\d+)/i);
    return Number(m?.[1]) || null;
  }

  function ownText(element) {
    if (!(element instanceof Element)) return '';
    return clean([...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(' '));
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function currentTrackedGroup(groups) {
    const urlId = idFrom(location.href);
    if (urlId && groups.has(`id:${urlId}`)) return [`id:${urlId}`, groups.get(`id:${urlId}`)];

    const byName = new Map();
    for (const [groupKey, list] of groups) {
      const itemName = clean(list?.[0]?.itemName);
      if (itemName) byName.set(key(itemName), [groupKey, list]);
    }

    const selectors = 'h1,h2,h3,h4,[role="heading"],[class*="title"],[class*="name"],strong,span';
    for (const element of document.querySelectorAll(selectors)) {
      if (!visible(element) || element.closest(`#${A.deals},#${A.dock},[data-tsimm-tracked]`)) continue;
      const match = byName.get(key(element.textContent));
      if (match) return match;
    }
    return null;
  }

  function listingPrice(row) {
    const candidates = [...row.querySelectorAll('span,div,p,strong,b')]
      .filter((element) => !element.closest('[data-tsimm-tracked],.tsimm-tmo-badge,.tsimm-margin-badge'));
    for (const element of candidates) {
      const text = ownText(element);
      if (/^\$[\d,.]+$/.test(text)) {
        const price = Number(text.replace(/[^\d.-]/g, ''));
        if (Number.isFinite(price) && price > 0) return price;
      }
    }
    return 0;
  }

  function trackedBadgeHtml(entry, listing) {
    const age = ageText(entry.captured);
    const difference = entry.price - listing;
    if (entry.status === 'fresh') {
      const title = difference > 0 ? `📌 TRACKED BUY → ${entry.traderName}` : `📌 TRACKED · ${entry.traderName}`;
      const comparison = listing > 0
        ? `${difference >= 0 ? '+' : '-'}${cash(Math.abs(difference))} each versus trader`
        : 'Listing price unavailable';
      return `<strong>${esc(title)}</strong><span>Trader pays ${esc(cash(entry.price))} · ${esc(age)}</span><span>${esc(comparison)}</span>`;
    }
    if (entry.status === 'stale') return `<strong>⌛ TRACKED · PRICE STALE</strong><span>${esc(entry.traderName)} last paid ${esc(cash(entry.price))}</span><span>Captured ${esc(age)} ago</span>`;
    if (entry.status === 'outdated') return `<strong>⚠ TRACKED · PRICE OUTDATED</strong><span>${esc(entry.traderName)} last paid ${esc(cash(entry.price))}</span><span>Captured ${esc(age)} ago</span>`;
    return `<strong>⚠ TRACKED · PRICE UNAVAILABLE</strong><span>${esc(entry.traderName)}</span><span>Recapture this trader before buying</span>`;
  }

  function applyTrackedBadge(row, groupKey, list, token) {
    if (!(row instanceof Element) || !list?.length) return;
    const entry = list[0], listing = listingPrice(row);
    let badge = row.querySelector('[data-tsimm-tracked]');
    if (!badge) {
      badge = document.createElement('div');
      badge.dataset.tsimmTracked = groupKey;
      const margin = row.querySelector('.tsimm-margin-badge');
      if (margin?.parentElement) margin.parentElement.appendChild(badge);
      else row.appendChild(badge);
    }
    badge.className = `tsimm-tracked-badge ${entry.status}`;
    badge.innerHTML = trackedBadgeHtml(entry, listing);
    badge.dataset.tsimmTrackedToken = token;
    const buy = entry.status === 'fresh' && listing > 0 && entry.price > listing;
    row.classList.toggle('tsimm-tracked-buy-row', buy);
    row.dataset.tsimmTrackedToken = token;
  }

  function decorateMarket() {
    const existing = [...document.querySelectorAll('[data-tsimm-tracked]')];
    if (!marketPage()) {
      existing.forEach((x) => x.remove());
      document.querySelectorAll('.tsimm-tracked-buy-row').forEach((x) => x.classList.remove('tsimm-tracked-buy-row'));
      return;
    }

    const groups = resolvedTracked();
    if (!groups.size) {
      existing.forEach((x) => x.remove());
      document.querySelectorAll('.tsimm-tracked-buy-row').forEach((x) => x.classList.remove('tsimm-tracked-buy-row'));
      return;
    }

    const match = currentTrackedGroup(groups);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (match) {
      for (const row of document.querySelectorAll('.tsimm-listing-mark')) applyTrackedBadge(row, match[0], match[1], token);
    }

    document.querySelectorAll('[data-tsimm-tracked]').forEach((badge) => {
      if (badge.dataset.tsimmTrackedToken !== token) badge.remove();
    });
    document.querySelectorAll('.tsimm-tracked-buy-row').forEach((row) => {
      if (row.dataset.tsimmTrackedToken === token) return;
      row.classList.remove('tsimm-tracked-buy-row');
      delete row.dataset.tsimmTrackedToken;
    });
  }

  function cardTrader(card, ts) {
    const id = clean(card.querySelector('[data-tsimm-trader-id]')?.dataset?.tsimmTraderId);
    if (id) { const t = ts.find((x) => x.id === id); if (t) return t; }
    const uid = Number((card.querySelector('a[href*="profiles.php?XID="]')?.href || '').match(/[?&]XID=(\d+)/)?.[1]);
    if (uid) { const t = ts.find((x) => x.uid === uid); if (t) return t; }
    const n = key(card.querySelector('.tsimm-trader-banner-label strong,.tsimm-trader-profile-button strong')?.textContent);
    return ts.find((x) => x.n === n) || null;
  }

  function openRecapture(t) {
    const now = Date.now();
    write(A.pending, { traderId: t.id, userId: t.uid, name: t.name, armedAt: now, expiresAt: now + 3600000 });
    const cur = bridge(), prev = clean(cur?.previousWindowName || (String(window.name).startsWith(A.bridge) ? '' : String(window.name).slice(0, 4096)));
    window.name = A.bridge + JSON.stringify({
      version: 1, type: 'request',
      trader: { traderId: t.id, userId: t.uid, name: t.name, profileUrl: clean(t.raw.profileUrl), tradeUrl: clean(t.raw.tradeUrl), bannerUrl: clean(t.raw.bannerUrl) },
      returnUrl: location.href, expiresAt: now + 900000, autoReturn: true, previousWindowName: prev,
    });
    location.href = t.url;
  }

  function decorateBook() {
    const b = document.getElementById('tornscripture-imm-traders');
    if (!b) return;
    const ts = normTraders();
    for (const c of b.querySelectorAll('.tsimm-trader-card')) {
      const t = cardTrader(c, ts);
      let x = c.querySelector('[data-tx-recapture]');
      if (!t || !isTX(t.url)) { x?.remove(); continue; }
      if (!x) {
        x = document.createElement('button');
        x.type = 'button'; x.dataset.txRecapture = '1'; x.className = 'tsimm-tx-recapture'; x.textContent = 'Open & recapture';
        const actions = c.querySelector('.tsimm-trader-actions') || c, edit = actions.querySelector('[data-tsimm-action="trader-edit"]');
        edit ? actions.insertBefore(x, edit) : actions.appendChild(x);
      }
      x.dataset.trader = t.id;
    }
  }

  function scheduleTorn() {
    clearTimeout(tornTimer);
    tornTimer = setTimeout(() => {
      ownMutation = true;
      for (const [name, task] of [['style', injectStyle], ['book', decorateBook], ['dock', renderTrackDock], ['market', decorateMarket]]) {
        try { task(); } catch (error) { console.error(`[IMM Trader Extensions] ${name} update failed:`, error); }
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
      document.addEventListener('click', (e) => {
        const opener = e.target.closest?.('[data-tsimm-deals-open]');
        if (opener?.dataset?.tsimmTraderId) { activeTrader = opener.dataset.tsimmTraderId; selectedDeal = null; setTimeout(scheduleTorn, 0); }
        const rowButton = e.target.closest?.('.td-row-toggle');
        if (rowButton) { const row = rowButton.closest('.td-row'); if (row) selectDeal(row); }
        const dockButton = e.target.closest?.('[data-track-dock-toggle]');
        if (dockButton) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (selectedDeal) { toggleTrack(selectedDeal.trader, selectedDeal.item); renderTrackDock(); }
          return;
        }
        const recapture = e.target.closest?.('[data-tx-recapture]');
        if (recapture) {
          e.preventDefault(); e.stopPropagation();
          const t = normTraders().find((x) => x.id === clean(recapture.dataset.trader));
          if (t) openRecapture(t);
        }
      }, true);
      new MutationObserver(() => { if (!ownMutation) scheduleTorn(); }).observe(document.body, { childList: true, subtree: true });
      window.addEventListener('tsimm:tracked-items-updated', scheduleTorn);
      setInterval(scheduleTorn, 1500);
      scheduleTorn();
    };
    start();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') isTorn() ? tornBoot() : txBoot();
})();