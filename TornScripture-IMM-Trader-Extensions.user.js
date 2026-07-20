// ==UserScript==
// @name         TornScripture - IMM Trader Extensions
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.2
// @description  Adds TornExchange pricelist capture, recapture links, tracked trader items, and fresh/stale Item Market badges.
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
    v: '0.1.2', bridge: 'TSIMM_PRICE_BRIDGE:', traders: 'tornscripture-imm-traders-v1',
    pending: 'tornscripture-imm-pending-trader-capture-v1', catalog: 'tornscripture-imm-catalog-v1',
    sharedCatalog: 'tornscripture-ish-torn-catalog-v1', tracked: 'tornscripture-imm-tracked-items-v1',
    overlaySettings: 'tornscripture-imm-trader-market-overlay-settings-v1', notice: 'tsimm-tx-notice-v1',
    deals: 'tornscripture-imm-trader-deals-addon', style: 'tsimm-trader-extensions-style',
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
    const s = document.createElement('style'); s.id = A.style; s.textContent = `
      #tsimm-tx-panel{position:fixed;right:10px;bottom:10px;z-index:2147483646;width:min(360px,calc(100vw - 20px));border:1px solid #3bd35d;border-radius:9px;background:#020704;color:#aaff83;box-shadow:0 14px 40px #000c;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden}#tsimm-tx-panel *{box-sizing:border-box}.txh{display:flex;padding:9px 10px;background:#041108;border-bottom:1px solid #1d6b2d}.txh strong{flex:1}.txb{display:grid;gap:7px;padding:10px}.txg{display:grid;grid-template-columns:1fr auto;gap:4px 8px}.txg b{text-align:right}.txw{padding:7px;border:1px solid #9a6d1f;border-radius:5px;background:#241a05;color:#ffd166}.txa{display:grid;grid-template-columns:1fr 1.7fr;gap:6px}#tsimm-tx-panel button,.tsimm-tx-recapture{border:1px solid #2c843d;border-radius:5px;background:#06170a;color:#b6ff9d;padding:8px;font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.tsimm-track-toggle{display:inline-flex;align-items:center;justify-content:center;width:max-content;min-height:21px;margin-top:3px;padding:2px 6px;border:1px solid #40754a;border-radius:4px;background:#031007;color:#79c986;font:700 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;cursor:pointer;pointer-events:auto}.tsimm-track-toggle.on{border-color:#7dff6e;background:#0b3512;color:#c1ff9d}.tsimm-tracked-badge{display:block!important;margin-top:4px!important;padding:5px 7px!important;border:1px solid #2e8f50!important;border-radius:6px!important;background:#05200f!important;color:#aaff83!important;font:700 10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;box-shadow:0 2px 10px #0007!important}.tsimm-tracked-badge.stale{border-color:#b4872d!important;background:#241a05!important;color:#ffd166!important}.tsimm-tracked-badge.outdated,.tsimm-tracked-badge.missing{border-color:#8f4850!important;background:#23090c!important;color:#ff9ba3!important}`;
    document.head?.appendChild(s);
  }

  function tradersRaw() { const r = read(A.traders, []); return { root: r, object: !Array.isArray(r) && Array.isArray(r?.traders), list: Array.isArray(r) ? r : Array.isArray(r?.traders) ? r.traders : [] }; }
  function normItem(x) { if (!x || typeof x !== 'object') return null; const id = Number(x.itemId ?? x.id) > 0 ? Number(x.itemId ?? x.id) : null; const name = clean(x.itemName ?? x.name) || (id ? `Item ${id}` : ''); const price = Math.max(0, Number(x.unitPrice ?? x.price ?? x.value) || 0); return name ? { id, name, n: key(name), price } : null; }
  function normTraders() { return tradersRaw().list.map((x) => { if (!x || typeof x !== 'object') return null; const name = clean(x.name ?? x.username); if (!name) return null; const uid = Number(x.userId ?? x.tornId) > 0 ? Number(x.userId ?? x.tornId) : null; return { raw: x, id: clean(x.recordId ?? x.uuid) || (typeof x.id === 'string' ? clean(x.id) : '') || (uid ? `trader-${uid}` : `trader-${key(name)}`), name, n: key(name), uid, captured: x.pricePageLastCheckedAt || x.pricePageCapturedAt || x.pricesCapturedAt || null, url: clean(x.pricePageUrl ?? x.pricingPageUrl), items: (Array.isArray(x.pricePageItems ?? x.pricingItems) ? x.pricePageItems ?? x.pricingItems : []).map(normItem).filter(Boolean) }; }).filter(Boolean); }

  function catalog() {
    const norm = (r) => { const o = { id: {}, name: {} }, src = r?.itemsByName || r?.items || {}, es = Array.isArray(src) ? src.map((x) => [String(x?.id ?? ''), x]) : Object.entries(src); for (const [k, x] of es) { if (!x || typeof x !== 'object') continue; const id = Number(x.id ?? x.itemId ?? k) > 0 ? Number(x.id ?? x.itemId ?? k) : null, name = clean(x.name); if (!name) continue; const v = { id, name }; if (id) o.id[String(id)] = v; o.name[key(name)] = v; } return o; };
    const a = norm(read(A.sharedCatalog, {})), b = norm(read(A.catalog, {})); return { id: { ...a.id, ...b.id }, name: { ...a.name, ...b.name } };
  }

  function bridge() { const r = String(window.name || ''); if (!r.startsWith(A.bridge)) return null; try { return JSON.parse(r.slice(A.bridge.length)); } catch { return null; } }
  function findTrader(list, pending, ident) { const pn = key(pending?.name), tn = key(ident?.name); return list.findIndex((x) => (pending?.traderId && String(x?.id) === String(pending.traderId)) || (Number(pending?.userId) > 0 && Number(x?.userId) === Number(pending.userId)) || (pn && key(x?.name) === pn) || (ident?.traderId && String(x?.id) === String(ident.traderId)) || (Number(ident?.userId) > 0 && Number(x?.userId) === Number(ident.userId)) || (tn && key(x?.name) === tn)); }
  function changed(a, b) { const m = (z) => new Map((z || []).map((x) => [itemKey(x.itemId, x.itemName), Number(x.unitPrice) || 0])); const x = m(a), y = m(b), ks = new Set([...x.keys(), ...y.keys()]); let n = 0; for (const k of ks) if (!x.has(k) || !y.has(k) || Math.round(x.get(k)) !== Math.round(y.get(k))) n++; return n; }

  function importTX() {
    const e = bridge(), c = e?.type === 'capture' ? e.compact : null; if (!c || clean(c.p).toLowerCase() !== 'tornexchange') return false;
    const cv = catalog(); const items = (Array.isArray(c.i) ? c.i : []).map((z) => { if (!Array.isArray(z) || z.length < 2) return null; const id = Number(z[0]) > 0 ? Number(z[0]) : null, price = Math.max(0, Number(z[1]) || 0), name = clean(z[2]) || (id ? cv.id[String(id)]?.name : '') || (id ? `Item ${id}` : ''); return name && price ? { itemId: id, itemName: name, normalizedName: key(name), unitPrice: price } : null; }).filter(Boolean); if (!items.length) return false;
    const p = read(A.pending, null), ident = c.t || {}, store = tradersRaw(), list = store.list; let i = findTrader(list, p, ident);
    if (i < 0) { const name = clean(p?.name || ident.name || ident.pageName) || 'Captured trader'; list.push({ id: clean(p?.traderId || ident.traderId) || `trader-${Date.now()}`, name, normalizedName: key(name), userId: Number(p?.userId || ident.userId) || null, rating: 0, targetPercent: 99, profileUrl: clean(ident.profileUrl), tradeUrl: clean(ident.tradeUrl), bannerUrl: clean(ident.bannerUrl), captureSource: 'tornexchange-pricelist', pricePageItems: [], createdAt: new Date().toISOString() }); i = list.length - 1; }
    const old = list[i], now = new Date().toISOString(), ch = changed(old.pricePageItems, items), url = clean(c.u); list[i] = { ...old, normalizedName: key(old.name), previousPricePageUrl: url && old.pricePageUrl && url !== old.pricePageUrl ? old.pricePageUrl : clean(old.previousPricePageUrl), pricePageUrl: url || clean(old.pricePageUrl), pricePageTitle: clean(c.l || old.pricePageTitle).slice(0, 160), pricePageProvider: 'tornexchange', pricePageSourceUpdated: clean(c.s).slice(0, 160), pricePageItems: items, pricePageCapturedAt: c.c || now, pricePageLastCheckedAt: now, pricePageCaptureCount: Math.max(0, Number(old.pricePageCaptureCount) || 0) + 1, pricePageLastChangedCount: ch, pricePageLastResult: 'tornexchange-pricelist:extensions', updatedAt: now };
    write(A.traders, store.object ? { ...store.root, traders: list } : list); localStorage.removeItem(A.pending); window.name = clean(e.previousWindowName); try { sessionStorage.setItem(A.notice, JSON.stringify({ name: list[i].name, count: items.length })); } catch {} location.replace(location.href); return true;
  }

  function notice() { let p = null; try { p = JSON.parse(sessionStorage.getItem(A.notice) || 'null'); sessionStorage.removeItem(A.notice); } catch {} if (!p) return; const m = () => { if (!document.body) return setTimeout(m, 50); const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:12px;border:1px solid #36d399;border-radius:9px;background:#13231e;color:#eafff7;font:600 13px system-ui'; d.textContent = `${p.name}: ${Number(p.count).toLocaleString()} TornExchange prices saved.`; document.body.appendChild(d); setTimeout(() => d.remove(), 5000); }; m(); }

  function pageName() { const hs = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].map((x) => clean(x.textContent)); for (const h of hs) { const m = h.match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i); if (m) return clean(m[1]); } const t = clean(document.title).match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i); if (t) return clean(t[1]); return clean(decodeURIComponent(location.pathname).match(/^\/prices\/([^/]+)/i)?.[1]) || 'TornExchange trader'; }
  function pageUpdated() { return clean(String(document.body?.innerText || '').match(/Prices\s+last\s+updated\s*:\s*([^\n\r]+)/i)?.[1]).slice(0, 120); }
  function parsePrice(v) { const t = clean(v); if (!/\d/.test(t)) return null; const n = Number(t.replace(/[^\d.-]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; }
  function rowId(row) { for (const n of row.querySelectorAll('[href],[src],[data-item-id],[data-itemid],[data-id]')) for (const v of [n.getAttribute('href'), n.getAttribute('src'), n.getAttribute('data-item-id'), n.getAttribute('data-itemid'), n.getAttribute('data-id')].filter(Boolean)) { const m = String(v).match(/[?&#](?:itemID|itemId|item_id|ID|id)=(\d+)/i) || String(v).match(/\/(?:images\/)?items?\/(\d+)(?:\/|\.|$)/i); if (Number(m?.[1]) > 0) return Number(m[1]); } return null; }
  function scanTX() { const out = new Map(); for (const table of document.querySelectorAll('table')) { const hr = table.querySelector('thead tr') || table.querySelector('tr'), heads = [...(hr?.querySelectorAll('th,td') || [])].map((x) => key(x.textContent)), ni = heads.findIndex((x) => x === 'item name' || x === 'item'), pi = heads.findIndex((x) => x.includes('buy price') || x === 'price'), rows = table.querySelectorAll('tbody tr').length ? table.querySelectorAll('tbody tr') : table.querySelectorAll('tr'); for (const row of rows) { if (row === hr) continue; const cs = [...row.querySelectorAll(':scope > th,:scope > td')]; if (cs.length < 2) continue; let pidx = pi; if (pidx < 0 || !parsePrice(cs[pidx]?.textContent)) for (let j = cs.length - 1; j >= 0; j--) if (parsePrice(cs[j].textContent)) { pidx = j; break; } const price = parsePrice(cs[pidx]?.textContent); if (!price) continue; let name = clean(cs[ni]?.textContent); if (!name || /^(?:image|item|item name|buy price|price)$/i.test(name) || parsePrice(name)) name = cs.map((x, j) => ({ j, t: clean(x.textContent) })).filter((x) => x.j !== pidx && x.t && !parsePrice(x.t) && !/^image$/i.test(x.t)).sort((a, b) => b.t.length - a.t.length)[0]?.t || ''; if (!name) continue; const id = rowId(row), k = itemKey(id, name), prev = out.get(k); if (!prev || price > prev.price) out.set(k, { id, name, price }); } } return [...out.values()]; }

  function request() { const e = bridge(); return e?.type === 'request' && (!e.expiresAt || Number(e.expiresAt) > Date.now()) ? e : null; }
  function sendTX(items, name, updated) { const r = request(), armed = clean(r?.trader?.name); if (armed && key(armed) !== key(name) && !confirm(`IMM is armed for ${armed}, but this page belongs to ${name}.\n\nSave these prices to ${armed}?`)) return; const compact = { v: 1, p: 'tornexchange', t: { ...(r?.trader || {}), name: armed || name, pageName: name }, u: location.origin + location.pathname, l: `${name} TornExchange prices`, c: new Date().toISOString(), s: updated, i: items.map((x) => x.id ? [x.id, Math.round(x.price)] : [0, Math.round(x.price), x.name]) }, ret = tornUrl(r?.returnUrl) || tornUrl(document.referrer) || 'https://www.torn.com/page.php?sid=ItemMarket'; window.name = A.bridge + JSON.stringify({ version: 1, type: 'capture', compact, returnUrl: ret, previousWindowName: clean(r?.previousWindowName) }); location.href = ret; }

  function txBoot() { let timer = 0, auto = 0, sent = false; const draw = () => { injectStyle(); const items = scanTX(), name = pageName(), updated = pageUpdated(), r = request(), armed = clean(r?.trader?.name), mismatch = armed && key(armed) !== key(name); let p = document.getElementById('tsimm-tx-panel'); if (!p) { p = document.createElement('section'); p.id = 'tsimm-tx-panel'; document.body.appendChild(p); } p.innerHTML = `<div class="txh"><strong>&gt; TORNEXCHANGE_CAPTURE</strong><span>v${A.v}</span></div><div class="txb"><div class="txg"><span>PAGE</span><b>${esc(name)}</b><span>PRICES</span><b>${items.length.toLocaleString()}</b><span>UPDATED</span><b>${esc(updated || 'Unknown')}</b><span>TARGET</span><b>${esc(armed || name)}</b></div>${mismatch ? `<div class="txw">ARMED FOR ${esc(armed)} · PAGE IS ${esc(name)}</div>` : ''}<div class="txa"><button data-tx="scan">RESCAN</button><button data-tx="save" ${items.length ? '' : 'disabled'}>CAPTURE & RETURN</button></div></div>`; p.querySelector('[data-tx="scan"]')?.addEventListener('click', draw); p.querySelector('[data-tx="save"]')?.addEventListener('click', () => sendTX(items, name, updated)); clearTimeout(auto); if (r?.autoReturn && !mismatch && items.length && !sent) auto = setTimeout(() => { sent = true; sendTX(items, name, updated); }, 1400); };
    const start = () => { if (!document.body) return setTimeout(start, 60); draw(); new MutationObserver((records) => { const panel = document.getElementById('tsimm-tx-panel'); if (panel && records.every((record) => panel.contains(record.target))) return; clearTimeout(timer); timer = setTimeout(draw, 180); }).observe(document.body, { childList: true, subtree: true }); }; start();
  }

  function trackedStore() { const r = read(A.tracked, {}), src = Array.isArray(r) ? r : Array.isArray(r?.entries) ? r.entries : [], map = new Map(); for (const x of src) { if (!x) continue; const e = { traderId: clean(x.traderId), traderName: clean(x.traderName), itemId: Number(x.itemId) > 0 ? Number(x.itemId) : null, itemName: clean(x.itemName), markedAt: x.markedAt || new Date().toISOString(), markedPrice: Number(x.markedPrice) || 0, markedCapturedAt: x.markedCapturedAt || null, sourceUrl: clean(x.sourceUrl) }; if (!e.itemName) continue; map.set(`${e.traderId || key(e.traderName)}|${itemKey(e.itemId, e.itemName)}`, e); } return { schema: 'tornscripture-imm-tracked-items', schemaVersion: 1, entries: [...map.values()] }; }
  function saveTracked(s) { s.updatedAt = new Date().toISOString(); write(A.tracked, s); try { window.dispatchEvent(new CustomEvent('tsimm:tracked-items-updated', { detail: s })); } catch {} }
  function toggleTrack(trader, item) { const s = trackedStore(), k = itemKey(item.id, item.name), i = s.entries.findIndex((x) => (x.traderId ? x.traderId === trader.id : key(x.traderName) === trader.n) && itemKey(x.itemId, x.itemName) === k); if (i >= 0) s.entries.splice(i, 1); else s.entries.push({ traderId: trader.id, traderName: trader.name, itemId: item.id, itemName: item.name, markedAt: new Date().toISOString(), markedPrice: item.price, markedCapturedAt: trader.captured, sourceUrl: trader.url }); saveTracked(s); scheduleTorn(); }

  let activeTrader = '', tornTimer = 0, ownMutation = false;
  function reportTrader(ts) { if (activeTrader) { const t = ts.find((x) => x.id === activeTrader); if (t) return t; } const o = document.getElementById(A.deals); if (!o) return null; const h = key(clean(o.querySelector('.td-head strong')?.textContent).replace(/^>\s*/, '').replace(/_DEALS$/i, '')); return ts.find((x) => x.n === h) || null; }
  function decorateDeals() {
    const o = document.getElementById(A.deals); if (!o) return;
    const ts = normTraders(), t = reportTrader(ts); if (!t) return;
    activeTrader = t.id;
    const s = trackedStore();
    for (const row of o.querySelectorAll('.td-row')) {
      try {
        const title = row.querySelector('.td-row-title');
        const name = clean(title?.querySelector('strong')?.textContent);
        const it = t.items.find((x) => x.n === key(name));
        if (!title || !it) continue;
        let b = row.querySelector('[data-track-toggle]');
        const on = s.entries.some((x) => (x.traderId ? x.traderId === t.id : key(x.traderName) === t.n) && itemKey(x.itemId, x.itemName) === itemKey(it.id, it.name));
        if (!b) {
          b = document.createElement('span');
          b.dataset.trackToggle = '1';
          b.setAttribute('role', 'button');
          b.setAttribute('tabindex', '0');
          b.setAttribute('aria-label', `Track ${it.name} for ${t.name}`);
          title.appendChild(b);
        }
        b.className = `tsimm-track-toggle${on ? ' on' : ''}`;
        b.textContent = on ? '✓ TRACKED' : '+ TRACK';
        b.dataset.trader = t.id;
        b.dataset.item = it.id || '';
        b.dataset.name = it.name;
      } catch (error) {
        console.error('[IMM Trader Extensions] Could not decorate one Deals row:', error);
      }
    }
  }

  function resolvedTracked() { const ts = normTraders(), s = trackedStore(), set = { freshAgeHours: 72, actionableAgeHours: 168, ...read(A.overlaySettings, {}) }, groups = new Map(); for (const x of s.entries) { const t = ts.find((z) => x.traderId ? z.id === x.traderId : z.n === key(x.traderName)), it = t?.items.find((z) => x.itemId ? z.id === x.itemId : z.n === key(x.itemName)), cap = t?.captured || x.markedCapturedAt, ms = Date.parse(cap || ''), h = Number.isFinite(ms) ? Math.max(0, Date.now() - ms) / 3600000 : Infinity, status = !t || !it || !it.price ? 'missing' : h <= Number(set.freshAgeHours || 72) ? 'fresh' : h <= Number(set.actionableAgeHours || 168) ? 'stale' : 'outdated', e = { ...x, traderName: t?.name || x.traderName, price: it?.price || x.markedPrice, captured: cap, status }, k = itemKey(x.itemId, x.itemName); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); } const rank = { fresh: 0, stale: 1, outdated: 2, missing: 3 }; for (const a of groups.values()) a.sort((x, y) => rank[x.status] - rank[y.status] || y.price - x.price); return groups; }
  function marketPage() { return /itemmarket|sid=ItemMarket/i.test(`${location.pathname}${location.search}${location.hash}`); }
  function idFrom(v) { const m = String(v || '').match(/[?&#](?:itemID|itemId|item_id|item|ID)=(\d+)/i) || String(v || '').match(/\/items?\/(\d+)/i); return Number(m?.[1]) || null; }
  function cardOf(n, name) { let c = n, best = n.parentElement; for (let d = 0; c && d < 9; d++, c = c.parentElement) { const txt = clean(c.innerText || c.textContent); if (!txt || !key(txt).includes(key(name))) continue; if (c.querySelector?.('.tsimm-tmo-badge,.tsimm-margin-badge')) return c; if (/\$[\d,.]+|buy|market|listing/i.test(txt)) best = c; if (/^(LI|ARTICLE)$/i.test(c.tagName) || /(item|card|row|listing)/i.test(String(c.className))) return c; } return best; }
  function badge(card, k, list) { if (!card) return; let b = card.querySelector(`[data-tsimm-tracked="${k.replace(/"/g, '\\"')}"]`); if (!b) { b = document.createElement('div'); b.dataset.tsimmTracked = k; const e = card.querySelector('.tsimm-tmo-badge,.tsimm-margin-badge'); e?.parentElement ? e.parentElement.appendChild(b) : card.appendChild(b); } const x = list[0], extra = list.length > 1 ? ` · +${list.length - 1}` : ''; b.className = `tsimm-tracked-badge ${x.status}`; b.textContent = x.status === 'fresh' ? `📌 TRACKED · ${x.traderName} ${cash(x.price)} · ${ageText(x.captured)}${extra}` : x.status === 'stale' ? `⌛ TRACKED · ${x.traderName} PRICE STALE · ${ageText(x.captured)}${extra}` : x.status === 'outdated' ? `⚠ TRACKED · ${x.traderName} PRICE OUTDATED · ${ageText(x.captured)}${extra}` : `⚠ TRACKED · ${x.traderName} PRICE UNAVAILABLE${extra}`; }
  function decorateMarket() { const old = [...document.querySelectorAll('[data-tsimm-tracked]')]; if (!marketPage()) { old.forEach((x) => x.remove()); return; } const g = resolvedTracked(), touched = new Set(); if (!g.size) { old.forEach((x) => x.remove()); return; } const ids = new Map(), names = new Map(); for (const [k, v] of g) k.startsWith('id:') ? ids.set(Number(k.slice(3)), [k, v]) : names.set(k.slice(5), [k, v]); for (const n of document.querySelectorAll('a[href],[data-item-id],[data-itemid]')) { const id = idFrom(n.getAttribute('href')) || Number(n.getAttribute('data-item-id') || n.getAttribute('data-itemid')) || null, m = ids.get(id); if (!m) continue; const c = cardOf(n, m[1][0].itemName); badge(c, m[0], m[1]); const b = c?.querySelector('[data-tsimm-tracked]'); if (b) touched.add(b); } for (const n of document.querySelectorAll('a,strong,h1,h2,h3,h4,h5,span,p')) { if (n.closest?.(`#${A.deals},[data-tsimm-tracked]`)) continue; const m = names.get(key(n.textContent)) || [...ids.values()].find((z) => key(z[1][0].itemName) === key(n.textContent)); if (!m) continue; const c = cardOf(n, m[1][0].itemName); badge(c, m[0], m[1]); const b = c?.querySelector('[data-tsimm-tracked]'); if (b) touched.add(b); } old.forEach((x) => { if (!touched.has(x)) x.remove(); }); }

  function cardTrader(card, ts) { const id = clean(card.querySelector('[data-tsimm-trader-id]')?.dataset?.tsimmTraderId); if (id) { const t = ts.find((x) => x.id === id); if (t) return t; } const uid = Number((card.querySelector('a[href*="profiles.php?XID="]')?.href || '').match(/[?&]XID=(\d+)/)?.[1]); if (uid) { const t = ts.find((x) => x.uid === uid); if (t) return t; } const n = key(card.querySelector('.tsimm-trader-banner-label strong,.tsimm-trader-profile-button strong')?.textContent); return ts.find((x) => x.n === n) || null; }
  function openRecapture(t) { const now = Date.now(); write(A.pending, { traderId: t.id, userId: t.uid, name: t.name, armedAt: now, expiresAt: now + 3600000 }); const cur = bridge(), prev = clean(cur?.previousWindowName || (String(window.name).startsWith(A.bridge) ? '' : String(window.name).slice(0, 4096))); window.name = A.bridge + JSON.stringify({ version: 1, type: 'request', trader: { traderId: t.id, userId: t.uid, name: t.name, profileUrl: clean(t.raw.profileUrl), tradeUrl: clean(t.raw.tradeUrl), bannerUrl: clean(t.raw.bannerUrl) }, returnUrl: location.href, expiresAt: now + 900000, autoReturn: true, previousWindowName: prev }); location.href = t.url; }
  function decorateBook() { const b = document.getElementById('tornscripture-imm-traders'); if (!b) return; const ts = normTraders(); for (const c of b.querySelectorAll('.tsimm-trader-card')) { const t = cardTrader(c, ts); let x = c.querySelector('[data-tx-recapture]'); if (!t || !isTX(t.url)) { x?.remove(); continue; } if (!x) { x = document.createElement('button'); x.type = 'button'; x.dataset.txRecapture = '1'; x.className = 'tsimm-tx-recapture'; x.textContent = 'Open & recapture'; const a = c.querySelector('.tsimm-trader-actions') || c, e = a.querySelector('[data-tsimm-action="trader-edit"]'); e ? a.insertBefore(x, e) : a.appendChild(x); } x.dataset.trader = t.id; } }
  function scheduleTorn() { clearTimeout(tornTimer); tornTimer = setTimeout(() => { ownMutation = true; injectStyle(); decorateBook(); decorateDeals(); decorateMarket(); setTimeout(() => { ownMutation = false; }, 0); }, 100); }

  function tornBoot() { if (importTX()) return; notice(); const start = () => { if (!document.body) return setTimeout(start, 60); injectStyle(); document.addEventListener('click', (e) => { const d = e.target.closest?.('[data-tsimm-deals-open]'); if (d?.dataset?.tsimmTraderId) activeTrader = d.dataset.tsimmTraderId; const r = e.target.closest?.('[data-tx-recapture]'); if (r) { e.preventDefault(); e.stopPropagation(); const t = normTraders().find((x) => x.id === clean(r.dataset.trader)); if (t) openRecapture(t); return; } const b = e.target.closest?.('[data-track-toggle]'); if (b) { e.preventDefault(); e.stopImmediatePropagation(); const t = normTraders().find((x) => x.id === clean(b.dataset.trader)), it = t?.items.find((x) => (Number(b.dataset.item) > 0 && x.id === Number(b.dataset.item)) || x.n === key(b.dataset.name)); if (t && it) toggleTrack(t, it); } }, true); new MutationObserver(() => { if (!ownMutation) scheduleTorn(); }).observe(document.body, { childList: true, subtree: true }); setInterval(scheduleTorn, 2000); scheduleTorn(); }; start(); }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') isTorn() ? tornBoot() : txBoot();
})();