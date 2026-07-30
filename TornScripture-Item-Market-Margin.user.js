// ==UserScript==
// @name         TornScripture - Item Market Margin
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.19.15
// @description  TornScripture IMM core with ROI-first market badges, preserved market-risk rails, Quick MAX, trade sale capture, ledger auditing, and trader exits.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://weav3r.dev/pricelist/*
// @match        https://www.weav3r.dev/pricelist/*
// @match        https://tornexchange.com/prices/*
// @match        https://www.tornexchange.com/prices/*
// @require      https://raw.githubusercontent.com/KingAeon/TornScripture/354091320944bee98ab33163809a6b6f707111c4/TornScripture-Item-Market-Margin.user.js
// @grant        none
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-Item-Market-Margin.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-Item-Market-Margin.user.js
// ==/UserScript==

(() => {
  'use strict';

  const PATCH = Object.freeze({
    version: '0.19.15',
    styleId: 'tsimm-roi-first-badge-style',
    panelId: 'tsimm-watch-panel',
    badgeSelector: '.tsimm-margin-badge.tsimm-badge-listing',
    rowSelector: '.tsimm-listing-mark',
  });

  window.__TSIMM_ROI_FIRST_BADGES__ = Object.freeze({ owner: 'core-hotfix', version: PATCH.version });

  function injectStyle() {
    if (document.getElementById(PATCH.styleId)) return;
    const style = document.createElement('style');
    style.id = PATCH.styleId;
    style.textContent = `
      html body ${PATCH.badgeSelector}[data-tsimm-roi-hotfix="1"]{
        display:grid!important;
        gap:1px!important;
        padding:2px 4px!important;
        border-radius:7px!important;
        overflow:hidden!important;
        box-sizing:border-box!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-hotfix="1"]>*{
        display:none!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-hotfix="1"]::before,
      html body ${PATCH.badgeSelector}[data-tsimm-roi-hotfix="1"]::after{
        display:block!important;
        min-width:0!important;
        max-width:100%!important;
        overflow:hidden!important;
        color:inherit!important;
        white-space:nowrap!important;
        text-overflow:clip!important;
        pointer-events:none!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-hotfix="1"]::before{
        content:attr(data-tsimm-roi-line);
        font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-hotfix="1"]::after{
        content:attr(data-tsimm-roi-lot);
        font:800 7px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;
      }
      html body ${PATCH.badgeSelector}.tsimm-watch-hidden-loss[data-tsimm-roi-hotfix="1"]{
        display:grid!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-tier="gold"]{
        border-color:#f4c95d!important;background:#2b2208f5!important;color:#ffe38a!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-tier="green"]{
        border-color:#78ef8d!important;background:#073411f5!important;color:#78ef8d!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-tier="purple"]{
        border-color:#c77dff!important;background:#281037f5!important;color:#dca2ff!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-tier="even"]{
        border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important;
      }
      html body ${PATCH.badgeSelector}[data-tsimm-roi-tier="loss"]{
        border-color:#ff626d!important;background:#2c0b0ef5!important;color:#ff8c96!important;
      }
      html body .tsimm-market-health-mark{display:none!important;}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function numericCash(text) {
    const value = Number(String(text || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(value) ? value : 0;
  }

  function exitPriceFromPanel() {
    const panel = document.getElementById(PATCH.panelId);
    if (!panel || !panel.classList.contains('fresh')) return 0;
    const text = String(panel.innerText || panel.textContent || '');
    const match = text.match(/\bEXIT\s*\$([\d,]+)/i)
      || text.match(/\bpays\s*\$([\d,]+)/i)
      || text.match(/\bbuy below\s*\$([\d,]+)/i);
    return numericCash(match?.[1]);
  }

  function signedCash(value) {
    const amount = Math.round(Math.abs(Number(value) || 0)).toLocaleString('en-US');
    if (value > 0) return `+$${amount}`;
    if (value < 0) return `-$${amount}`;
    return '$0';
  }

  function compactCash(value) {
    const number = Number(value) || 0;
    const amount = Math.abs(number);
    const sign = number > 0 ? '+' : number < 0 ? '-' : '';
    const compact = (divisor, suffix, decimals) => {
      const rendered = (amount / divisor)
        .toFixed(decimals)
        .replace(/\.0+$|(\.[0-9]*[1-9])0+$/g, '$1');
      return `${sign}$${rendered}${suffix}`;
    };
    if (amount >= 1_000_000_000) return compact(1_000_000_000, 'b', amount < 10_000_000_000 ? 1 : 0);
    if (amount >= 1_000_000) return compact(1_000_000, 'm', amount < 10_000_000 ? 1 : 0);
    if (amount >= 1_000) return compact(1_000, 'k', amount < 10_000 ? 1 : 0);
    return `${sign}$${Math.round(amount).toLocaleString('en-US')}`;
  }

  function roiTier(profitEach, roiPercent) {
    if (profitEach < 0) return 'loss';
    if (profitEach === 0) return 'even';
    if (roiPercent >= 4) return 'gold';
    if (roiPercent >= 2.5) return 'green';
    return 'purple';
  }

  function clearRoiAttributes() {
    document.querySelectorAll(`${PATCH.badgeSelector}[data-tsimm-roi-hotfix="1"]`).forEach((badge) => {
      delete badge.dataset.tsimmRoiHotfix;
      delete badge.dataset.tsimmRoiTier;
      delete badge.dataset.tsimmRoiLine;
      delete badge.dataset.tsimmRoiLot;
      delete badge.dataset.tsimmRoiSignature;
    });
  }

  function applyRoiBadges() {
    injectStyle();
    const exitPrice = exitPriceFromPanel();
    if (!(exitPrice > 0)) {
      clearRoiAttributes();
      return;
    }

    for (const row of document.querySelectorAll(PATCH.rowSelector)) {
      const badge = row.querySelector(PATCH.badgeSelector);
      if (!badge) continue;
      const entryPrice = Math.max(0, Number(badge.dataset.tsimmListingPrice) || 0);
      const quantity = Math.max(1, Math.floor(Number(badge.dataset.tsimmQuantity) || 1));
      if (!(entryPrice > 0)) continue;

      const profitEach = exitPrice - entryPrice;
      const roiPercent = profitEach / entryPrice * 100;
      const tier = roiTier(profitEach, roiPercent);
      const totalProfit = profitEach * quantity;
      const line = `${signedCash(profitEach)} ea · ${roiPercent.toFixed(2)}%`;
      const lot = `lot ${compactCash(totalProfit)}`;
      const signature = [exitPrice, entryPrice, quantity, tier, line, lot].join('|');
      if (badge.dataset.tsimmRoiSignature === signature) continue;

      badge.dataset.tsimmRoiHotfix = '1';
      badge.dataset.tsimmRoiTier = tier;
      badge.dataset.tsimmRoiLine = line;
      badge.dataset.tsimmRoiLot = lot;
      badge.dataset.tsimmRoiSignature = signature;
      badge.title = `Exit $${exitPrice.toLocaleString('en-US')} · Buy $${entryPrice.toLocaleString('en-US')} · ${roiPercent.toFixed(2)}% ROI`;
      badge.querySelector('[data-tsimm-market-health]')?.remove();
    }
  }

  function patchVisibleVersion() {
    document.querySelectorAll('#tornscripture-imm-panel small,#tornscripture-imm-panel span').forEach((element) => {
      if (/0\.19\.14/.test(element.textContent || '')) {
        element.textContent = String(element.textContent).replace(/0\.19\.14/g, PATCH.version);
      }
    });
  }

  function tick() {
    try {
      applyRoiBadges();
      patchVisibleVersion();
    } catch (error) {
      console.error('[TornScripture IMM ROI badges] update failed:', error);
    }
  }

  const start = () => {
    injectStyle();
    tick();
    setTimeout(tick, 250);
    setTimeout(tick, 800);
    setInterval(tick, 1200);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
