// ==UserScript==
// @name         TornScripture - IMM TornExchange Safe Return
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Prevents TornExchange captures from returning to Torn routes that cannot be reopened directly in TornPDA.
// @author       KingAeon
// @match        https://tornexchange.com/prices/*
// @match        https://www.tornexchange.com/prices/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-TornExchange-Safe-Return.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-TornExchange-Safe-Return.user.js
// ==/UserScript==

(() => {
  'use strict';

  const PREFIX = 'TSIMM_PRICE_BRIDGE:';
  const SAFE_RETURN_URL = 'https://www.torn.com/itemmarket.php';
  const MAX_AGE_MS = 20 * 60 * 1000;

  function readBridge() {
    const raw = String(window.name || '');
    if (!raw.startsWith(PREFIX)) return null;
    try {
      const parsed = JSON.parse(raw.slice(PREFIX.length));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeBridge(payload) {
    try {
      window.name = PREFIX + JSON.stringify(payload);
      return true;
    } catch {
      return false;
    }
  }

  function forceSafeRequest(createWhenMissing = false) {
    const rawWindowName = String(window.name || '');
    let request = readBridge();

    if (!request || request.type !== 'request') {
      if (!createWhenMissing) return false;
      request = {
        version: 1,
        type: 'request',
        trader: {},
        returnUrl: SAFE_RETURN_URL,
        requestedAt: Date.now(),
        expiresAt: Date.now() + MAX_AGE_MS,
        autoReturn: false,
        previousWindowName: rawWindowName.startsWith(PREFIX) ? '' : rawWindowName.slice(0, 4096),
      };
      return writeBridge(request);
    }

    if (request.returnUrl === SAFE_RETURN_URL) return true;
    request.originalReturnUrl = request.originalReturnUrl || request.returnUrl || '';
    request.returnUrl = SAFE_RETURN_URL;
    return writeBridge(request);
  }

  // Armed captures already carry a request before TornExchange loads.
  forceSafeRequest(false);

  // Manual captures may not have an armed request. Create one before the
  // extension's target-level click handler reads window.name.
  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-tx="save"]')) return;
    forceSafeRequest(true);
  }, true);

  // TornExchange and TornPDA can restore window.name a moment after document-start.
  // Keep correcting only request payloads until capture begins.
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const bridge = readBridge();
    if (bridge?.type === 'capture' || Date.now() - startedAt > MAX_AGE_MS) {
      clearInterval(timer);
      return;
    }
    forceSafeRequest(false);
  }, 200);
})();
