// ==UserScript==
// @name         TornScripture - Item Market Margin
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.10.7
// @description  Item-market and overseas profit overlays with Quick MAX, trader capture, favorite watchlists, Trade Exit Audit, purchase history, trade verification, and receipt audits.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://weav3r.dev/pricelist/*
// @match        https://www.weav3r.dev/pricelist/*
// @match        https://tornexchange.com/prices/*
// @match        https://www.tornexchange.com/prices/*
// @grant        none
// @run-at       document-start
// @require      https://raw.githubusercontent.com/KingAeon/TornScripture/6a37c57bd550fe984e10d6a8f4473268bf29be53/TornScripture-Item-Market-Margin.user.js
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-Item-Market-Margin.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-Item-Market-Margin.user.js
// ==/UserScript==

(() => {
  'use strict';

  const WRAPPER_VERSION = '0.10.7';
  const STYLE_ID = 'tornscripture-imm-compact-listing-badges-v0107';
  const BADGE_SELECTOR = '.tsimm-margin-badge.tsimm-badge-listing';
  let scheduled = 0;

  window.__TSIMM_WRAPPER_VERSION__ = WRAPPER_VERSION;

  function compactNumber(value) {
    const amount = Math.abs(Number(value) || 0);
    const format = (divisor, suffix, decimals) => {
      const number = amount / divisor;
      const text = number.toFixed(decimals).replace(/\.0+$|(\.[0-9]*[1-9])0+$/g, '$1');
      return `${text}${suffix}`;
    };
    if (amount >= 1_000_000_000) return format(1_000_000_000, 'b', amount < 10_000_000_000 ? 1 : 0);
    if (amount >= 1_000_000) return format(1_000_000, 'm', amount < 10_000_000 ? 1 : 0);
    if (amount >= 1_000) return format(1_000, 'k', amount < 10_000 ? 1 : 0);
    return Math.round(amount).toLocaleString('en-US');
  }

  function compactMoneyToken(token) {
    const match = String(token || '').match(/^([+-]?)(\$)([\d,]+)$/);
    if (!match) return token;
    const value = Number(match[3].replace(/,/g, ''));
    if (!Number.isFinite(value)) return token;
    return `${match[1]}$${compactNumber(value)}`;
  }

  function compactLine(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    let match = normalized.match(/^([+-]?\$[\d,]+)\s+ea$/i);
    if (match) return `${compactMoneyToken(match[1])} ea`;
    match = normalized.match(/^([+-]?\$[\d,]+)\s+(?:full\s+lot|lot)$/i);
    if (match) return `${compactMoneyToken(match[1])} lot`;
    if (/^\$0\s+(?:break\s+even|even)$/i.test(normalized)) return '$0 EVEN';
    return normalized;
  }

  function injectStyle() {
    if (!document.head || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${BADGE_SELECTOR}{
        width:max-content!important;
        max-width:100%!important;
        min-width:0!important;
        padding:2px 4px!important;
        gap:0!important;
        overflow:hidden!important;
      }
      ${BADGE_SELECTOR} strong,
      ${BADGE_SELECTOR} span{
        max-width:100%!important;
        overflow:hidden!important;
        text-overflow:clip!important;
        white-space:nowrap!important;
        line-height:1.05!important;
      }
      ${BADGE_SELECTOR} strong{font-size:8px!important}
      ${BADGE_SELECTOR} span{font-size:7px!important}
      ${BADGE_SELECTOR} .tsimm-watch-inline{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function decorateBadge(badge) {
    if (!(badge instanceof Element)) return;
    const lines = [badge.querySelector(':scope > strong'), ...badge.querySelectorAll(':scope > span')].filter(Boolean);
    if (!lines.length) return;

    if (!badge.dataset.tsimmCompactFullText) {
      badge.dataset.tsimmCompactFullText = lines.map((line) => String(line.textContent || '').trim()).filter(Boolean).join(' · ');
    }
    badge.title = badge.dataset.tsimmCompactFullText;

    for (const line of lines) {
      if (line.classList.contains('tsimm-watch-inline')) continue;
      const compacted = compactLine(line.textContent);
      if (compacted !== line.textContent) line.textContent = compacted;
    }
  }

  function showWrapperVersion() {
    document.querySelectorAll('#tornscripture-imm-panel small').forEach((element) => {
      if (/\b0\.10\.6\b/.test(element.textContent || '')) {
        element.textContent = String(element.textContent || '').replace(/\b0\.10\.6\b/g, WRAPPER_VERSION);
      }
    });
  }

  function decorate() {
    scheduled = 0;
    injectStyle();
    document.querySelectorAll(BADGE_SELECTOR).forEach(decorateBadge);
    showWrapperVersion();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = window.setTimeout(decorate, 60);
  }

  function boot() {
    injectStyle();
    schedule();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('hashchange', schedule);
    window.addEventListener('popstate', schedule);
  }

  if (document.documentElement) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
