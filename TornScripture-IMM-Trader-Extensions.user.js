// ==UserScript==
// @name         TornScripture - IMM Trader Extensions
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.2.2
// @description  Compatibility shell. Favorite traders, watched items, and best-exit prompts are now owned by Item Market Margin v0.9.4+.
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

  if (typeof window === 'undefined') return;
  window.__TSIMM_TRADER_EXTENSIONS_COMPAT__ = Object.freeze({
    version: '0.2.2',
    owner: 'TornScripture - Item Market Margin',
    dormant: true,
  });
})();
