// ==UserScript==
// @name         TornScripture - War Intelligence HUD
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.2
// @description  Locally records enemy activity already visible on Torn faction/war pages and displays a compact HUD.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/TornScripture-War-Intelligence-HUD.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/TornScripture-War-Intelligence-HUD.user.js
// ==/UserScript==

(() => {
  'use strict';

  /*
   * TORNSCRIPTURE - WAR INTELLIGENCE HUD v0.1.2
   *
   * SAFETY BOUNDARY
   * - Reads only information already rendered on a page the user opened.
   * - Makes no Torn API calls and no background page requests.
   * - Performs no gameplay actions.
   * - Stores observations locally in IndexedDB.
   *
   * v0.1.2 PURPOSE
   * - Establish reliable local storage.
   * - Discover player rows conservatively.
   * - Capture visible player status / last-action text.
   * - Provide export, import, purge, and diagnostics.
   * - Recognize Torn status text stored in visible rows and element attributes.
   * - Report rejected profile candidates instead of silently hiding them.
   * - Store activity and life status as separate values.
   * - Poll rendered rows every minute and save a ten-minute heartbeat.
   * - Do NOT predict sleep windows yet.
   */

  const APP = Object.freeze({
    name: 'War Intelligence HUD',
    shortName: 'WIH',
    version: '0.1.2',
    // Keep the v0.1.0 storage identifiers so upgrading does not erase history.
    dbName: 'script-kitty-war-intel',
    dbVersion: 1,
    observationsStore: 'observations',
    playersStore: 'players',
    settingsKey: 'sk-wih-settings-v1',
    panelId: 'sk-wih-panel',
    styleId: 'sk-wih-style',
    maxRowsInPanel: 50,
    captureDebounceMs: 1800,
    renderedPagePollMs: 60_000,
    unchangedObservationHeartbeatMs: 10 * 60_000,
  });

  const DEFAULT_SETTINGS = Object.freeze({
    collapsed: false,
    autoCaptureVisiblePage: true,
    showOnlyLikelyEnemies: true,
    keepDays: 30,
    localTime: true,
  });

  const state = {
    db: null,
    settings: loadSettings(),
    captureTimer: null,
    pollTimer: null,
    mutationObserver: null,
    lastUrl: location.href,
    lastCaptureAt: null,
    lastCaptureCount: 0,
    currentRows: [],
    lastDiscoveryStats: {
      uniqueProfileIds: 0,
      acceptedCount: 0,
      acceptedCandidates: [],
      rejectedCandidates: [],
    },
    initialized: false,
  };

  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(APP.settingsKey) || '{}') };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(APP.settingsKey, JSON.stringify(state.settings));
  }

  function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: state.settings.localTime ? undefined : false,
      timeZone: state.settings.localTime ? undefined : 'UTC',
      timeZoneName: 'short',
    }).format(date);
  }

  function parsePlayerId(href) {
    if (!href) return null;
    try {
      const url = new URL(href, location.origin);
      const xid = url.searchParams.get('XID') || url.searchParams.get('xid');
      if (xid && /^\d+$/.test(xid)) return xid;

      const profileMatch = url.pathname.match(/\/profiles?\/(\d+)/i);
      return profileMatch?.[1] ?? null;
    } catch {
      const match = String(href).match(/[?&]XID=(\d+)/i);
      return match?.[1] ?? null;
    }
  }

  function classifyActivityStatus(text) {
    const value = normalizeWhitespace(text).toLowerCase();

    if (/\bonline\b/.test(value)) return 'online';
    if (/\bidle\b/.test(value)) return 'idle';
    if (/\boffline\b/.test(value)) return 'offline';
    return 'unknown';
  }

  function classifyLifeStatus(text) {
    const value = normalizeWhitespace(text).toLowerCase();

    if (/\bhospital(?:ized)?\b/.test(value)) return 'hospital';
    if (/\bjail(?:ed)?\b/.test(value)) return 'jail';
    if (/\btravel(?:ing|ling)?\b|\babroad\b|\breturning\b/.test(value)) return 'travel';
    if (/\bfederal\b|\bfedded\b/.test(value)) return 'federal';
    if (/\bfallen\b/.test(value)) return 'fallen';
    if (/\bokay\b|\bhealthy\b/.test(value)) return 'okay';
    return 'unknown';
  }

  function statusRank(status) {
    return {
      online: 0,
      idle: 1,
      okay: 2,
      offline: 3,
      hospital: 4,
      jail: 5,
      travel: 6,
      federal: 7,
      fallen: 8,
      unknown: 9,
    }[status] ?? 9;
  }

  function collectElementAttributeText(container) {
    if (!container?.querySelectorAll) return '';

    const attributeNames = [
      'title',
      'aria-label',
      'data-tooltip',
      'data-original-title',
      'data-last-action',
      'data-status',
      'data-state',
      'class',
    ];
    const values = [];
    const elements = [container, ...container.querySelectorAll('*')].slice(0, 250);

    for (const element of elements) {
      for (const attributeName of attributeNames) {
        const value = normalizeWhitespace(element.getAttribute?.(attributeName));
        if (value) values.push(value);
      }
    }

    return normalizeWhitespace(values.join(' ')).slice(0, 4000);
  }

  function findLikelyPlayerContainer(anchor) {
    const candidates = [];
    let node = anchor;

    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      const text = normalizeWhitespace(node.innerText);
      const profileLinks = node.querySelectorAll?.('a[href*="XID="], a[href*="/profile/"], a[href*="/profiles/"]').length ?? 0;
      const rect = node.getBoundingClientRect?.();

      if (
        text.length >= 3 &&
        text.length <= 900 &&
        profileLinks >= 1 &&
        rect &&
        rect.width > 100 &&
        rect.height > 12 &&
        rect.height < 350
      ) {
        candidates.push({
          node,
          score:
            (profileLinks === 1 ? 6 : 0) +
            (/\b(?:online|offline|idle|hospital(?:ized)?|jail(?:ed)?|travel(?:ing|ling)?|abroad|returning|federal|fedded|fallen|okay|healthy)\b/i.test(text) ? 5 : 0) +
            (node.matches('li, tr, [class*="row"], [class*="member"], [class*="user"]') ? 3 : 0) -
            Math.min(text.length / 250, 3),
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.node ?? anchor.parentElement;
  }

  function extractName(anchor, playerId) {
    const text = normalizeWhitespace(
      anchor.getAttribute('title') ||
      anchor.getAttribute('aria-label') ||
      anchor.textContent
    );

    if (text && text !== playerId && text.length <= 80) {
      return text.replace(/\s*\[\d+\]\s*$/, '').trim();
    }
    return `Player ${playerId}`;
  }

  function extractLastActionText(container) {
    const explicit = [
      '[class*="lastAction"]',
      '[class*="last-action"]',
      '[class*="last_action"]',
      '[data-last-action]',
      '[title*="Last action" i]',
      '[aria-label*="Last action" i]',
    ];

    for (const selector of explicit) {
      const element = container.querySelector?.(selector);
      const value = normalizeWhitespace(
        element?.getAttribute?.('data-last-action') ||
        element?.getAttribute?.('title') ||
        element?.getAttribute?.('aria-label') ||
        element?.textContent
      );
      if (
        value &&
        value.length <= 180 &&
        !/^last action:?$/i.test(value) &&
        /last action|\bago\b|\b(?:online|offline|idle)\b|\d+\s*[dhms]\b/i.test(value)
      ) {
        return value;
      }
    }

    const attributeText = collectElementAttributeText(container);
    const attributePatterns = [
      /last action[:\s-]+([^|•]{2,100})/i,
      /\b(\d+\s+(?:seconds?|minutes?|hours?|days?)\s+ago)\b/i,
      /\b((?:\d+\s*[dhms]\s*){1,4})\s+(?:ago|offline)\b/i,
    ];

    for (const pattern of attributePatterns) {
      const match = attributeText.match(pattern);
      if (match?.[1]) return normalizeWhitespace(match[1]);
    }

    const text = normalizeWhitespace(container.innerText);
    const patterns = [
      /last action[:\s-]+([^|•]{2,80})/i,
      /\b(?:online|offline|idle)\b(?:\s+for)?\s+((?:\d+\s*[dhms]\s*){1,4})/i,
      /\b(\d+\s+(?:seconds?|minutes?|hours?|days?)\s+ago)\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return normalizeWhitespace(match[1]);
    }
    return '';
  }

  function inferFactionId() {
    try {
      const currentUrl = new URL(location.href);
      const currentId = currentUrl.searchParams.get('ID');
      if (currentId && /^\d+$/.test(currentId)) return currentId;
    } catch {
      // Fall through to page-link detection.
    }

    const candidates = [
      ...document.querySelectorAll('a[href*="factions.php"][href*="ID="], a[href*="/factions/"]'),
    ];

    for (const link of candidates) {
      try {
        const url = new URL(link.href, location.origin);
        const id = url.searchParams.get('ID') || url.pathname.match(/\/factions\/(\d+)/i)?.[1];
        if (id && /^\d+$/.test(id)) return id;
      } catch {
        // Ignore malformed links.
      }
    }
    return null;
  }

  function pageLooksRelevant() {
    const url = `${location.pathname}${location.search}${location.hash}`.toLowerCase();
    const pageText = normalizeWhitespace(document.body?.innerText).slice(0, 7000).toLowerCase();

    return (
      /factions\.php|rankedwar|ranked-war|war/.test(url) ||
      /\branked war\b|\bwar members\b|\bopposing faction\b/.test(pageText)
    );
  }

  function discoverVisiblePlayers() {
    const anchors = [
      ...document.querySelectorAll(
        'a[href*="profiles.php?XID="], a[href*="profiles.php?xid="], a[href*="/profile/"], a[href*="/profiles/"]'
      ),
    ];

    const candidatesByPlayer = new Map();

    for (const anchor of anchors) {
      const playerId = parsePlayerId(anchor.href);
      if (!playerId) continue;

      const container = findLikelyPlayerContainer(anchor);
      if (!container || container.closest(`#${APP.panelId}`)) continue;

      const text = normalizeWhitespace(container.innerText);
      if (!text || text.length > 1000) continue;

      const attributeText = collectElementAttributeText(container);
      const combinedStatusText = `${text} ${attributeText}`;
      const activityStatus = classifyActivityStatus(combinedStatusText);
      const lifeStatus = classifyLifeStatus(combinedStatusText);
      const name = extractName(anchor, playerId);
      const lastActionText = extractLastActionText(container);

      const rowLike = container.matches?.('li, tr, [class*="row"], [class*="member"], [class*="user"]');
      const candidateScore =
        (activityStatus !== 'unknown' ? 12 : 0) +
        (lifeStatus !== 'unknown' ? 6 : 0) +
        (lastActionText ? 7 : 0) +
        (rowLike ? 4 : 0) +
        (text.length <= 300 ? 2 : 0) -
        (/text based rpg\s*-\s*torn/i.test(text) ? 30 : 0);

      /*
       * Enemy certainty is intentionally conservative in v0.1.
       * On a clearly relevant war/faction page, visible player rows are candidates.
       * The UI labels them "page players" rather than claiming perfect enemy detection.
       */
      const candidate = {
        playerId,
        name,
        // Keep status as a compatibility alias for v0.1.0/v0.1.1 exports.
        status: activityStatus,
        activityStatus,
        lifeStatus,
        lastActionText,
        visibleText: text.slice(0, 500),
        attributeText: attributeText.slice(0, 500),
        profileUrl: anchor.href,
        factionId: inferFactionId(),
        pageUrl: location.href,
        capturedAt: Date.now(),
        candidateScore,
      };

      const existing = candidatesByPlayer.get(playerId);
      if (!existing || candidate.candidateScore > existing.candidateScore) {
        candidatesByPlayer.set(playerId, candidate);
      }
    }

    const candidates = [...candidatesByPlayer.values()];
    const accepted = candidates.filter(
      (player) =>
        !/text based rpg\s*-\s*torn/i.test(player.visibleText) &&
        (
          player.activityStatus !== 'unknown' ||
          player.lifeStatus !== 'unknown' ||
          player.lastActionText
        )
    );

    state.lastDiscoveryStats = {
      uniqueProfileIds: candidates.length,
      acceptedCount: accepted.length,
      acceptedCandidates: accepted.slice(0, 75).map((player) => ({
        playerId: player.playerId,
        activityStatus: player.activityStatus,
        lifeStatus: player.lifeStatus,
        visibleTextSample: player.visibleText.slice(0, 180),
        attributeTextSample: player.attributeText.slice(0, 240),
      })),
      rejectedCandidates: candidates
        .filter((player) => !accepted.includes(player))
        .slice(0, 75)
        .map((player) => ({
          playerId: player.playerId,
          name: player.name,
          activityStatus: player.activityStatus,
          lifeStatus: player.lifeStatus,
          lastActionText: player.lastActionText,
          visibleTextSample: player.visibleText.slice(0, 180),
          attributeTextSample: player.attributeText.slice(0, 240),
        })),
    };

    return accepted
      .map(({ candidateScore, attributeText, ...player }) => player)
      .sort(
        (a, b) =>
          statusRank(a.activityStatus) - statusRank(b.activityStatus) ||
          a.name.localeCompare(b.name)
      );
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(APP.dbName, APP.dbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(APP.observationsStore)) {
          const store = db.createObjectStore(APP.observationsStore, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('byPlayer', 'playerId', { unique: false });
          store.createIndex('byCapturedAt', 'capturedAt', { unique: false });
          store.createIndex('byPlayerCapturedAt', ['playerId', 'capturedAt'], { unique: false });
        }

        if (!db.objectStoreNames.contains(APP.playersStore)) {
          const store = db.createObjectStore(APP.playersStore, { keyPath: 'playerId' });
          store.createIndex('byLastSeen', 'lastSeenAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another Torn tab.'));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Database transaction aborted.'));
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getLatestObservation(playerId) {
    const tx = state.db.transaction(APP.observationsStore, 'readonly');
    const index = tx.objectStore(APP.observationsStore).index('byPlayerCapturedAt');
    const range = IDBKeyRange.bound([playerId, 0], [playerId, Number.MAX_SAFE_INTEGER]);
    const request = index.openCursor(range, 'prev');
    const cursor = await requestResult(request);
    return cursor?.value ?? null;
  }

  async function getPlayerSummary(playerId) {
    const tx = state.db.transaction(APP.playersStore, 'readonly');
    return requestResult(tx.objectStore(APP.playersStore).get(playerId));
  }

  function observationMeaningfullyChanged(previous, current) {
    if (!previous) return true;
    const previousActivity = previous.activityStatus ?? previous.status ?? 'unknown';
    const currentActivity = current.activityStatus ?? current.status ?? 'unknown';
    const previousLife = previous.lifeStatus ?? 'unknown';
    const currentLife = current.lifeStatus ?? 'unknown';

    if (previousActivity !== currentActivity) return true;
    if (previousLife !== currentLife) return true;
    if (previous.lastActionText !== current.lastActionText) return true;
    return (
      current.capturedAt - previous.capturedAt >=
      APP.unchangedObservationHeartbeatMs
    );
  }

  async function saveObservations(players) {
    let saved = 0;

    for (const player of players) {
      const previous = await getLatestObservation(player.playerId);
      if (!observationMeaningfullyChanged(previous, player)) continue;
      const existingSummary = await getPlayerSummary(player.playerId);

      const tx = state.db.transaction(
        [APP.observationsStore, APP.playersStore],
        'readwrite'
      );

      tx.objectStore(APP.observationsStore).add(player);
      tx.objectStore(APP.playersStore).put({
        playerId: player.playerId,
        name: player.name,
        profileUrl: player.profileUrl,
        factionId: player.factionId,
        firstSeenAt:
          existingSummary?.firstSeenAt ??
          previous?.capturedAt ??
          player.capturedAt,
        lastSeenAt: player.capturedAt,
        latestStatus: player.activityStatus,
        latestActivityStatus: player.activityStatus,
        latestLifeStatus: player.lifeStatus,
        latestLastActionText: player.lastActionText,
      });

      await transactionDone(tx);
      saved += 1;
    }

    return saved;
  }

  async function getDatabaseStats() {
    const tx = state.db.transaction([APP.playersStore, APP.observationsStore], 'readonly');
    const playersCount = await requestResult(tx.objectStore(APP.playersStore).count());
    const observationsCount = await requestResult(tx.objectStore(APP.observationsStore).count());
    return { playersCount, observationsCount };
  }

  async function purgeOldObservations() {
    const cutoff = Date.now() - state.settings.keepDays * 86_400_000;
    const tx = state.db.transaction(APP.observationsStore, 'readwrite');
    const index = tx.objectStore(APP.observationsStore).index('byCapturedAt');
    const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });

    await transactionDone(tx);
  }

  async function capturePage({ manual = false } = {}) {
    if (!state.db) return;

    const players = discoverVisiblePlayers();
    state.currentRows = players;
    state.lastCaptureAt = Date.now();
    state.lastCaptureCount = players.length;

    let saved = 0;
    if (players.length) saved = await saveObservations(players);

    await renderPanel();

    if (manual) {
      toast(
        players.length
          ? `Found ${players.length} page player${players.length === 1 ? '' : 's'}; saved ${saved} new observation${saved === 1 ? '' : 's'}.`
          : 'No status-bearing player rows were detected on this page.'
      );
    }
  }

  function scheduleCapture() {
    if (!state.settings.autoCaptureVisiblePage) return;
    clearTimeout(state.captureTimer);
    state.captureTimer = setTimeout(() => {
      capturePage().catch(reportError);
    }, APP.captureDebounceMs);
  }

  function observePageChanges() {
    state.mutationObserver?.disconnect();

    state.mutationObserver = new MutationObserver((mutations) => {
      const hasOutsideMutation = mutations.some((mutation) => {
        const target =
          mutation.target?.nodeType === Node.ELEMENT_NODE
            ? mutation.target
            : mutation.target?.parentElement;
        return !target?.closest?.(`#${APP.panelId}`);
      });

      // Rendering the HUD changes its own DOM. Ignore those changes so the HUD
      // cannot trigger an endless capture/render loop.
      if (!hasOutsideMutation) return;

      if (location.href !== state.lastUrl) {
        state.lastUrl = location.href;
        scheduleCapture();
        return;
      }

      if (pageLooksRelevant()) scheduleCapture();
    });

    state.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('popstate', scheduleCapture);
    window.addEventListener('hashchange', scheduleCapture);
  }

  function startRenderedPagePolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
      if (
        !state.settings.autoCaptureVisiblePage ||
        document.hidden ||
        !pageLooksRelevant()
      ) {
        return;
      }

      capturePage().catch(reportError);
    }, APP.renderedPagePollMs);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && pageLooksRelevant()) scheduleCapture();
    });
  }

  function injectStyles() {
    if (document.getElementById(APP.styleId)) return;

    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      #${APP.panelId} {
        --wih-bg: rgba(24, 25, 28, 0.97);
        --wih-surface: rgba(255, 255, 255, 0.065);
        --wih-border: rgba(255, 255, 255, 0.13);
        --wih-text: #f2f2f2;
        --wih-muted: #aaaeb5;
        --wih-accent: #ff7a59;
        position: fixed;
        right: max(10px, env(safe-area-inset-right));
        bottom: max(10px, env(safe-area-inset-bottom));
        z-index: 2147483600;
        width: min(390px, calc(100vw - 20px));
        max-height: min(72vh, 680px);
        overflow: hidden;
        border: 1px solid var(--wih-border);
        border-radius: 13px;
        background: var(--wih-bg);
        color: var(--wih-text);
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.48);
        font: 13px/1.35 Arial, sans-serif;
        backdrop-filter: blur(8px);
      }
      #${APP.panelId} * { box-sizing: border-box; }
      #${APP.panelId} button,
      #${APP.panelId} select,
      #${APP.panelId} input {
        font: inherit;
      }
      #${APP.panelId} .wih-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 11px;
        border-bottom: 1px solid var(--wih-border);
        background: linear-gradient(135deg, rgba(255,122,89,.16), rgba(255,255,255,.025));
      }
      #${APP.panelId} .wih-title {
        min-width: 0;
        flex: 1;
        font-weight: 700;
        letter-spacing: .2px;
      }
      #${APP.panelId} .wih-version {
        color: var(--wih-muted);
        font-size: 11px;
        font-weight: 400;
      }
      #${APP.panelId} .wih-icon-button {
        width: 30px;
        height: 30px;
        border: 1px solid var(--wih-border);
        border-radius: 8px;
        background: var(--wih-surface);
        color: var(--wih-text);
        cursor: pointer;
      }
      #${APP.panelId} .wih-body {
        max-height: calc(min(72vh, 680px) - 52px);
        overflow: auto;
        padding: 10px;
      }
      #${APP.panelId}.wih-collapsed .wih-body {
        display: none;
      }
      #${APP.panelId} .wih-status-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 7px;
        margin-bottom: 9px;
      }
      #${APP.panelId} .wih-stat {
        padding: 8px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface);
      }
      #${APP.panelId} .wih-stat strong {
        display: block;
        font-size: 17px;
      }
      #${APP.panelId} .wih-stat span,
      #${APP.panelId} .wih-note {
        color: var(--wih-muted);
        font-size: 11px;
      }
      #${APP.panelId} .wih-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 9px;
      }
      #${APP.panelId} .wih-button {
        min-height: 32px;
        padding: 6px 9px;
        border: 1px solid var(--wih-border);
        border-radius: 8px;
        background: var(--wih-surface);
        color: var(--wih-text);
        cursor: pointer;
      }
      #${APP.panelId} .wih-button:hover,
      #${APP.panelId} .wih-icon-button:hover {
        border-color: rgba(255, 122, 89, .7);
      }
      #${APP.panelId} .wih-primary {
        background: rgba(255, 122, 89, .18);
      }
      #${APP.panelId} .wih-list {
        display: grid;
        gap: 6px;
        margin-top: 8px;
      }
      #${APP.panelId} .wih-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface);
      }
      #${APP.panelId} .wih-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
      }
      #${APP.panelId} .wih-name a {
        color: inherit;
        text-decoration: none;
      }
      #${APP.panelId} .wih-detail {
        overflow: hidden;
        color: var(--wih-muted);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${APP.panelId} .wih-badge {
        min-width: 62px;
        padding: 4px 7px;
        border-radius: 99px;
        text-align: center;
        text-transform: capitalize;
        font-size: 11px;
        font-weight: 700;
      }
      #${APP.panelId} .wih-badges {
        display: grid;
        gap: 4px;
        justify-items: end;
      }
      #${APP.panelId} .status-online { background: rgba(51, 199, 116, .2); color: #8ef0b7; }
      #${APP.panelId} .status-idle { background: rgba(242, 185, 73, .2); color: #ffd782; }
      #${APP.panelId} .status-offline { background: rgba(150, 156, 166, .2); color: #d0d3d8; }
      #${APP.panelId} .status-hospital,
      #${APP.panelId} .status-jail,
      #${APP.panelId} .status-federal { background: rgba(228, 78, 78, .2); color: #ffaaaa; }
      #${APP.panelId} .status-travel { background: rgba(109, 154, 255, .2); color: #b9d0ff; }
      #${APP.panelId} .status-fallen { background: rgba(171, 112, 255, .2); color: #d9bdff; }
      #${APP.panelId} .status-okay { background: rgba(120, 205, 190, .18); color: #b6eee4; }
      #${APP.panelId} .status-unknown { background: rgba(255,255,255,.08); color: #ccc; }
      #${APP.panelId} .wih-settings {
        display: grid;
        gap: 7px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--wih-border);
      }
      #${APP.panelId} .wih-setting {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      #${APP.panelId} .wih-setting input[type="number"] {
        width: 68px;
        padding: 4px;
        border: 1px solid var(--wih-border);
        border-radius: 6px;
        background: #111216;
        color: var(--wih-text);
      }
      #wih-toast {
        position: fixed;
        left: 50%;
        bottom: max(18px, env(safe-area-inset-bottom));
        z-index: 2147483647;
        max-width: calc(100vw - 30px);
        transform: translateX(-50%);
        padding: 9px 13px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 9px;
        background: rgba(20,21,24,.97);
        color: #fff;
        box-shadow: 0 8px 24px rgba(0,0,0,.42);
        font: 13px/1.35 Arial, sans-serif;
      }
    `;
    document.head.append(style);
  }

  function ensurePanel() {
    let panel = document.getElementById(APP.panelId);
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = APP.panelId;
    panel.setAttribute('aria-label', APP.name);
    document.body.append(panel);
    return panel;
  }

  async function renderPanel() {
    const panel = ensurePanel();
    const stats = await getDatabaseStats();

    panel.classList.toggle('wih-collapsed', state.settings.collapsed);

    const rows = state.currentRows.slice(0, APP.maxRowsInPanel);
    const online = state.currentRows.filter((row) => row.activityStatus === 'online').length;
    const offline = state.currentRows.filter((row) => row.activityStatus === 'offline').length;

    panel.innerHTML = `
      <div class="wih-header">
        <div class="wih-title">
          🐾 ${escapeHtml(APP.name)}
          <span class="wih-version">v${escapeHtml(APP.version)}</span>
        </div>
        <button class="wih-icon-button" data-action="settings" title="Settings">⚙</button>
        <button class="wih-icon-button" data-action="collapse" title="Collapse or expand">
          ${state.settings.collapsed ? '▴' : '▾'}
        </button>
      </div>

      <div class="wih-body">
        <div class="wih-status-grid">
          <div class="wih-stat"><strong>${state.currentRows.length}</strong><span>on this page</span></div>
          <div class="wih-stat"><strong>${online}</strong><span>visible online</span></div>
          <div class="wih-stat"><strong>${offline}</strong><span>visible offline</span></div>
        </div>

        <div class="wih-actions">
          <button class="wih-button wih-primary" data-action="capture">Capture page</button>
          <button class="wih-button" data-action="export">Export TXT</button>
          <button class="wih-button" data-action="copy-export">Copy export</button>
          <button class="wih-button" data-action="import">Import data</button>
        </div>

        <div class="wih-note">
          Local archive: ${stats.playersCount} players · ${stats.observationsCount} observations<br>
          Last scan: ${escapeHtml(formatDateTime(state.lastCaptureAt))}
        </div>

        <div class="wih-list">
          ${
            rows.length
              ? rows.map((row) => `
                  <div class="wih-row">
                    <div>
                      <div class="wih-name">
                        <a href="${escapeHtml(row.profileUrl)}">${escapeHtml(row.name)}</a>
                        <span class="wih-note">[${escapeHtml(row.playerId)}]</span>
                      </div>
                      <div class="wih-detail" title="${escapeHtml(row.lastActionText || row.visibleText)}">
                        ${escapeHtml(
                          row.lastActionText ||
                          (row.lifeStatus !== 'unknown'
                            ? `Condition: ${row.lifeStatus}`
                            : 'No life-status text detected')
                        )}
                      </div>
                    </div>
                    <div class="wih-badges">
                      <div class="wih-badge status-${escapeHtml(row.activityStatus)}">${escapeHtml(row.activityStatus)}</div>
                      ${
                        row.lifeStatus !== 'unknown'
                          ? `<div class="wih-badge status-${escapeHtml(row.lifeStatus)}">${escapeHtml(row.lifeStatus)}</div>`
                          : ''
                      }
                    </div>
                  </div>
                `).join('')
              : `
                <div class="wih-note">
                  No status-bearing player rows detected yet. Open a faction or ranked-war member list,
                  then press <strong>Capture page</strong>.
                </div>
              `
          }
        </div>

        <div class="wih-settings" data-settings hidden>
          <label class="wih-setting">
            <span>Auto-capture changes + 10m heartbeat</span>
            <input type="checkbox" data-setting="autoCaptureVisiblePage" ${state.settings.autoCaptureVisiblePage ? 'checked' : ''}>
          </label>
          <label class="wih-setting">
            <span>Keep history, days</span>
            <input type="number" min="1" max="365" step="1" data-setting="keepDays" value="${state.settings.keepDays}">
          </label>
          <button class="wih-button" data-action="purge-old">Purge expired observations</button>
          <button class="wih-button" data-action="diagnostics">Copy diagnostics</button>
          <button class="wih-button" data-action="erase">Erase all local WIH data</button>
          <div class="wih-note">
            v0.1.2 records only information already rendered on the page. It does not make API calls,
            navigate, click, attack, or submit game actions.
          </div>
        </div>
      </div>
    `;

    bindPanelEvents(panel);
  }

  function bindPanelEvents(panel) {
    panel.querySelector('[data-action="collapse"]')?.addEventListener('click', async () => {
      state.settings.collapsed = !state.settings.collapsed;
      saveSettings();
      await renderPanel();
    });

    panel.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
      const settings = panel.querySelector('[data-settings]');
      settings.hidden = !settings.hidden;
    });

    panel.querySelector('[data-action="capture"]')?.addEventListener('click', () => {
      capturePage({ manual: true }).catch(reportError);
    });

    panel.querySelector('[data-action="export"]')?.addEventListener('click', () => {
      exportData().catch(reportError);
    });

    panel.querySelector('[data-action="copy-export"]')?.addEventListener('click', () => {
      copyExportData().catch(reportError);
    });

    panel.querySelector('[data-action="import"]')?.addEventListener('click', importData);

    panel.querySelector('[data-action="purge-old"]')?.addEventListener('click', async () => {
      await purgeOldObservations();
      await renderPanel();
      toast('Expired observations purged.');
    });

    panel.querySelector('[data-action="diagnostics"]')?.addEventListener('click', () => {
      copyDiagnostics().catch(reportError);
    });

    panel.querySelector('[data-action="erase"]')?.addEventListener('click', () => {
      eraseAllData().catch(reportError);
    });

    panel.querySelector('[data-setting="autoCaptureVisiblePage"]')?.addEventListener('change', (event) => {
      state.settings.autoCaptureVisiblePage = event.currentTarget.checked;
      saveSettings();
      if (state.settings.autoCaptureVisiblePage) scheduleCapture();
    });

    panel.querySelector('[data-setting="keepDays"]')?.addEventListener('change', (event) => {
      const value = Math.max(1, Math.min(365, Number(event.currentTarget.value) || 30));
      state.settings.keepDays = value;
      saveSettings();
      event.currentTarget.value = String(value);
    });
  }

  async function getAllFromStore(storeName) {
    const tx = state.db.transaction(storeName, 'readonly');
    return requestResult(tx.objectStore(storeName).getAll());
  }

  async function buildExportPayload() {
    const [players, observations] = await Promise.all([
      getAllFromStore(APP.playersStore),
      getAllFromStore(APP.observationsStore),
    ]);

    return {
      schema: 'script-kitty-war-intel-export',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: APP.version,
      players,
      observations,
    };
  }

  async function exportData() {
    const payload = await buildExportPayload();
    const exportText = JSON.stringify(payload, null, 2);

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tornscripture-war-intel-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Exported ${payload.observations.length} observations as TXT.`);
  }

  async function copyExportData() {
    const payload = await buildExportPayload();
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast(`Copied ${payload.observations.length} observations to the clipboard.`);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,text/plain,.json,.txt';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const payload = JSON.parse(await file.text());
        if (
          payload?.schema !== 'script-kitty-war-intel-export' ||
          payload?.schemaVersion !== 1 ||
          !Array.isArray(payload.players) ||
          !Array.isArray(payload.observations)
        ) {
          throw new Error('That file is not a compatible WIH export.');
        }

        const tx = state.db.transaction(
          [APP.playersStore, APP.observationsStore],
          'readwrite'
        );
        const playersStore = tx.objectStore(APP.playersStore);
        const observationsStore = tx.objectStore(APP.observationsStore);

        for (const player of payload.players) {
          if (player?.playerId) playersStore.put(player);
        }

        for (const observation of payload.observations) {
          if (!observation?.playerId || !observation?.capturedAt) continue;
          const clean = { ...observation };
          delete clean.id;
          observationsStore.add(clean);
        }

        await transactionDone(tx);
        await renderPanel();
        toast(`Imported ${payload.observations.length} observations.`);
      } catch (error) {
        reportError(error);
      }
    });

    input.click();
  }

  async function copyDiagnostics() {
    const stats = await getDatabaseStats();
    const diagnostics = {
      app: APP.name,
      version: APP.version,
      url: location.href,
      title: document.title,
      relevantPageGuess: pageLooksRelevant(),
      profileAnchorCount: document.querySelectorAll(
        'a[href*="profiles.php?XID="], a[href*="/profile/"], a[href*="/profiles/"]'
      ).length,
      uniqueProfileIdsEvaluated: state.lastDiscoveryStats.uniqueProfileIds,
      acceptedCandidateCount: state.lastDiscoveryStats.acceptedCount,
      detectedRows: state.currentRows.map((row) => ({
        playerId: row.playerId,
        status: row.activityStatus,
        activityStatus: row.activityStatus,
        lifeStatus: row.lifeStatus,
        lastActionText: row.lastActionText,
        visibleTextSample: row.visibleText.slice(0, 180),
      })),
      acceptedCandidateEvidence: state.lastDiscoveryStats.acceptedCandidates,
      rejectedCandidates: state.lastDiscoveryStats.rejectedCandidates,
      archiveStats: stats,
      userAgent: navigator.userAgent,
      generatedAt: new Date().toISOString(),
    };

    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    toast('Diagnostics copied. Player IDs and visible row samples are included.');
  }

  async function eraseAllData() {
    const confirmed = window.confirm(
      'Erase every locally stored War Intelligence HUD player and observation? This cannot be undone unless you exported a backup.'
    );
    if (!confirmed) return;

    const tx = state.db.transaction(
      [APP.playersStore, APP.observationsStore],
      'readwrite'
    );
    tx.objectStore(APP.playersStore).clear();
    tx.objectStore(APP.observationsStore).clear();
    await transactionDone(tx);

    state.currentRows = [];
    await renderPanel();
    toast('All local WIH data erased.');
  }

  function toast(message) {
    document.getElementById('wih-toast')?.remove();
    const element = document.createElement('div');
    element.id = 'wih-toast';
    element.textContent = message;
    document.body.append(element);
    setTimeout(() => element.remove(), 3800);
  }

  function reportError(error) {
    console.error(`[${APP.shortName}]`, error);
    toast(`${APP.shortName} error: ${error?.message || String(error)}`);
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;

    injectStyles();
    state.db = await openDatabase();
    await purgeOldObservations();
    await renderPanel();
    observePageChanges();
    startRenderedPagePolling();

    if (state.settings.autoCaptureVisiblePage) {
      await capturePage();
    }

    console.info(
      `[${APP.shortName}] ${APP.name} v${APP.version} initialized. Local-only observation mode.`
    );
  }

  init().catch(reportError);
})();
