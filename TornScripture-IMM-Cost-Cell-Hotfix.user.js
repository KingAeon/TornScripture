// ==UserScript==
// @name         TornScripture - IMM Cost Cell Hotfix
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Gives IMM listing badges the full Cost-cell width on narrow Torn and TornPDA item-market layouts.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-end
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Cost-Cell-Hotfix.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Cost-Cell-Hotfix.user.js
// ==/UserScript==

(() => {
  'use strict';

  const STYLE_ID = 'tornscripture-imm-cost-cell-hotfix-style';
  const HOST_CLASS = 'tsimm-cost-cell-hotfix-host';
  const BADGE_SELECTOR = '.tsimm-margin-badge.tsimm-badge-listing';
  let scheduled = 0;

  function ownText(element) {
    if (!(element instanceof Element)) return '';
    return [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function injectStyle() {
    if (!document.head || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HOST_CLASS}{position:relative!important;min-width:0!important;padding-bottom:38px!important;overflow:visible!important}
      .${HOST_CLASS} ${BADGE_SELECTOR}{position:absolute!important;left:3px!important;right:3px!important;bottom:3px!important;z-index:6!important;display:flex!important;align-items:stretch!important;width:auto!important;min-width:0!important;max-width:none!important;margin:0!important;overflow:hidden!important;padding:3px 5px!important;box-sizing:border-box!important}
      .${HOST_CLASS} ${BADGE_SELECTOR} strong,.${HOST_CLASS} ${BADGE_SELECTOR} span{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:clip!important;white-space:nowrap!important}
      .${HOST_CLASS} ${BADGE_SELECTOR} strong{font-size:9px!important;line-height:1.1!important}
      .${HOST_CLASS} ${BADGE_SELECTOR} span{font-size:8px!important;line-height:1.1!important}
      .${HOST_CLASS} ${BADGE_SELECTOR} .tsimm-watch-inline{color:inherit!important}
    `;
    document.head.appendChild(style);
  }

  function listingRowFor(badge) {
    return badge.closest('.tsimm-listing-mark')
      || badge.closest('li,[class*="row" i],[class*="listing" i]')
      || null;
  }

  function priceElementFor(row) {
    if (!(row instanceof Element)) return null;
    const candidates = [...row.querySelectorAll('span,div,p,strong,b')]
      .filter((element) => !element.closest('.tsimm-margin-badge,[data-tsimm-generated]'))
      .filter(visible);
    return candidates.find((element) => /^\$[\d,.]+$/.test(ownText(element))) || null;
  }

  function costHostFor(priceElement, row) {
    if (!(priceElement instanceof Element) || !(row instanceof Element)) return priceElement?.parentElement || null;
    const priceRect = priceElement.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    let best = priceElement.parentElement || priceElement;
    for (let node = priceElement.parentElement; node && node !== row; node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const rect = node.getBoundingClientRect();
      if (!(rect.width > 0) || rect.width > Math.max(190, rowRect.width * 0.38)) break;
      const hasPurchaseControl = Boolean(node.querySelector('button,[role="button"],input,a[href]'));
      const hasImage = Boolean(node.querySelector('img'));
      const hasQuantity = [...node.querySelectorAll('span,div,p,strong,b')]
        .filter((element) => !element.closest('.tsimm-margin-badge,[data-tsimm-generated]'))
        .some((element) => /^\d[\d,]*$/.test(ownText(element)));
      if (hasPurchaseControl || hasImage || hasQuantity) continue;
      if (rect.width + 1 >= priceRect.width) best = node;
    }
    return best;
  }

  function compactBadge(badge) {
    const lines = [badge.querySelector('strong'), ...badge.querySelectorAll(':scope > span')].filter(Boolean);
    if (!lines.length) return;

    const first = lines[0];
    const firstText = (first.textContent || '').replace(/\s+/g, ' ').trim();
    let match = firstText.match(/^([+-]?\$[\d,.]+)\s*ea$/i);
    if (match) first.textContent = `ea ${match[1]}`;
    else if (/^\$0\s*(?:BREAK\s+EVEN|EVEN)$/i.test(firstText)) first.textContent = 'ea $0 EVEN';

    const second = lines[1];
    if (second) {
      const secondText = (second.textContent || '').replace(/\s+/g, ' ').trim();
      match = secondText.match(/^([+-]?\$[\d,.]+)\s*(?:full\s+lot|lot)$/i);
      if (match) second.textContent = `lot ${match[1]}`;
      else {
        const npc = secondText.match(/^([+-]?\$[\d,.]+)\s*ea\s*[·•]\s*([+-]?\$[\d,.]+)\s*lot$/i);
        if (npc) {
          second.textContent = `ea ${npc[1]}`;
          const third = lines[2];
          if (third) third.textContent = `lot ${npc[2]}`;
        }
      }
    }

    const last = lines.at(-1);
    if (last && /📌/.test(last.textContent || '')) {
      last.textContent = (last.textContent || '')
        .replace(/\s+best\s+exit\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  function decorate() {
    scheduled = 0;
    injectStyle();
    const badges = [...document.querySelectorAll(BADGE_SELECTOR)];
    const activeHosts = new Set();
    for (const badge of badges) {
      const row = listingRowFor(badge);
      const priceElement = priceElementFor(row);
      const host = costHostFor(priceElement, row);
      if (!(host instanceof Element)) continue;
      host.classList.add(HOST_CLASS);
      activeHosts.add(host);
      compactBadge(badge);
    }
    document.querySelectorAll(`.${HOST_CLASS}`).forEach((host) => {
      if (!activeHosts.has(host) || !host.querySelector(BADGE_SELECTOR)) host.classList.remove(HOST_CLASS);
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = window.setTimeout(decorate, 80);
  }

  function boot() {
    injectStyle();
    schedule();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('hashchange', schedule);
    window.addEventListener('popstate', schedule);
    window.setInterval(schedule, 1200);
  }

  if (document.body) boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
