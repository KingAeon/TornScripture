// ==UserScript==
// @name         TornScripture - War Intelligence HUD
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.2.1
// @description  Locally records visible Torn faction activity with a compact HUD and full-screen player history timeline.
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
   * TORNSCRIPTURE - WAR INTELLIGENCE HUD v0.2.1
   *
   * SAFETY BOUNDARY
   * - Reads only information already rendered on a page the user opened.
   * - Makes no Torn API calls and no background page requests.
   * - Performs no gameplay actions.
   * - Stores observations locally in IndexedDB.
   *
   * v0.2.1 PURPOSE
   * - Establish reliable local storage.
   * - Discover player rows conservatively.
   * - Capture visible player status / last-action text.
   * - Provide export, import, purge, and diagnostics.
   * - Recognize Torn status text stored in visible rows and element attributes.
   * - Report rejected profile candidates instead of silently hiding them.
   * - Store activity and life status as separate values.
   * - Poll rendered rows every minute and save a ten-minute heartbeat.
   * - Normalize legacy observations for analysis without deleting raw history.
   * - Distinguish Abroad, Traveling, and Returning life states.
   * - Provide Android-friendly copy, view, share, and text export paths.
   * - Provide a full-screen, mobile-first player history viewer.
   * - Render activity timelines with explicit coverage gaps.
   * - Provide 12-hour, 24-hour, 3-day, and all-history ranges.
   * - Let users tap the timeline to inspect its corresponding time.
   * - Do NOT predict sleep windows yet.
   */

  const APP = Object.freeze({
    name: 'War Intelligence HUD',
    shortName: 'WIH',
    version: '0.2.1',
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
    legacyDuplicateWindowMs: 1_000,
    coverageGapThresholdMs: 15 * 60_000,
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
    capturePromise: null,
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
      ignoredPageChromeCount: 0,
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
    if (/\breturning\b/.test(value)) return 'returning';
    if (/\btravel(?:ing|ling)?\b/.test(value)) return 'traveling';
    if (/\babroad\b/.test(value)) return 'abroad';
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
      traveling: 6,
      returning: 7,
      abroad: 8,
      federal: 9,
      fallen: 10,
      unknown: 11,
    }[status] ?? 11;
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
    const candidates = [
      anchor.getAttribute('title'),
      anchor.getAttribute('aria-label'),
      anchor.textContent,
    ];

    for (const candidate of candidates) {
      const text = normalizeWhitespace(candidate)
        .replace(/^view profile of\s+/i, '')
        .replace(/\s*\[\d+\]\s*$/, '')
        .trim();

      if (
        text &&
        text !== playerId &&
        !/^view profile$/i.test(text) &&
        text.length <= 80
      ) {
        return text;
      }
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
        (/last action[:\s-]+.{2,120}/i.test(value) ||
          /\b\d+\s+(?:seconds?|minutes?|hours?|days?)\s+ago\b/i.test(value) ||
          /\b(?:\d+\s*[dhms]\s*){1,4}\s+ago\b/i.test(value))
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
    let ignoredPageChromeCount = 0;

    for (const anchor of anchors) {
      const playerId = parsePlayerId(anchor.href);
      if (!playerId) continue;

      const container = findLikelyPlayerContainer(anchor);
      if (!container || container.closest(`#${APP.panelId}`)) continue;

      const text = normalizeWhitespace(container.innerText);
      if (!text || text.length > 1000) continue;
      if (/text based rpg\s*-\s*torn/i.test(text)) {
        ignoredPageChromeCount += 1;
        continue;
      }

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
      ignoredPageChromeCount,
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

  async function cleanPlayerSummaryNames() {
    const tx = state.db.transaction(APP.playersStore, 'readwrite');
    const store = tx.objectStore(APP.playersStore);
    const request = store.openCursor();

    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        const player = cursor.value;
        const cleanedName = cleanStoredName(player.name, player.playerId);
        if (cleanedName !== player.name) cursor.update({ ...player, name: cleanedName });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });

    await transactionDone(tx);
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

  async function performCapture({ manual = false } = {}) {
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

  function capturePage(options = {}) {
    if (state.capturePromise) return state.capturePromise;

    state.capturePromise = performCapture(options).finally(() => {
      state.capturePromise = null;
    });
    return state.capturePromise;
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
        return !target?.closest?.(`#${APP.panelId}, #wih-export-viewer, #wih-history-viewer, #wih-toast`);
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
      #${APP.panelId} .status-travel,
      #${APP.panelId} .status-traveling { background: rgba(109, 154, 255, .2); color: #b9d0ff; }
      #${APP.panelId} .status-returning { background: rgba(98, 191, 255, .2); color: #bde5ff; }
      #${APP.panelId} .status-abroad { background: rgba(91, 208, 170, .18); color: #b9f1df; }
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
      #wih-export-viewer {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        padding: 14px;
        background: rgba(0, 0, 0, .78);
        font: 13px/1.35 Arial, sans-serif;
      }
      #wih-export-viewer .wih-export-card {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 10px;
        width: min(920px, 100%);
        height: min(82vh, 760px);
        padding: 12px;
        border: 1px solid rgba(255,255,255,.2);
        border-radius: 12px;
        background: #17191d;
        color: #fff;
      }
      #wih-export-viewer textarea {
        width: 100%;
        min-height: 0;
        resize: none;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 8px;
        padding: 9px;
        background: #0e1013;
        color: #e8eaed;
        font: 11px/1.4 monospace;
      }
      #wih-export-viewer .wih-export-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      #wih-export-viewer button {
        min-height: 36px;
        padding: 7px 11px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 8px;
        background: #2b2f36;
        color: #fff;
      }
      #wih-history-viewer {
        --wih-bg: #111318;
        --wih-surface: #1b1e25;
        --wih-surface-2: #232731;
        --wih-border: rgba(255,255,255,.13);
        --wih-text: #f3f4f6;
        --wih-muted: #a7adb7;
        --wih-accent: #ff7a59;
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        overflow: auto;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        background: var(--wih-bg);
        color: var(--wih-text);
        font: 13px/1.4 Arial, sans-serif;
      }
      #wih-history-viewer * { box-sizing: border-box; }
      #wih-history-viewer button,
      #wih-history-viewer input,
      #wih-history-viewer select { font: inherit; }
      #wih-history-viewer .wih-history-shell { min-height: 100%; }
      #wih-history-viewer .wih-history-header {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 56px;
        padding: 9px 12px;
        border-bottom: 1px solid var(--wih-border);
        background: rgba(17,19,24,.96);
        backdrop-filter: blur(10px);
      }
      #wih-history-viewer .wih-history-title { min-width: 0; flex: 1; }
      #wih-history-viewer .wih-history-title strong { display: block; font-size: 16px; }
      #wih-history-viewer .wih-muted { color: var(--wih-muted); font-size: 11px; }
      #wih-history-viewer .wih-close,
      #wih-history-viewer .wih-range-button {
        min-height: 36px;
        padding: 7px 11px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface-2);
        color: var(--wih-text);
      }
      #wih-history-viewer .wih-history-grid { display: grid; gap: 12px; padding: 12px; }
      #wih-history-viewer .wih-roster,
      #wih-history-viewer .wih-history-detail { min-width: 0; }
      #wih-history-viewer .wih-roster-tools {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(105px, .42fr);
        gap: 7px;
        margin-bottom: 8px;
      }
      #wih-history-viewer .wih-roster-tools input,
      #wih-history-viewer .wih-roster-tools select {
        width: 100%;
        min-height: 40px;
        padding: 8px 10px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface);
        color: var(--wih-text);
      }
      #wih-history-viewer .wih-roster-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        max-height: 36vh;
        overflow: auto;
      }
      #wih-history-viewer .wih-player-button {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        min-height: 48px;
        padding: 7px 9px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface);
        color: var(--wih-text);
        text-align: left;
      }
      #wih-history-viewer .wih-player-button[aria-current="true"] {
        border-color: var(--wih-accent);
        box-shadow: inset 3px 0 var(--wih-accent);
      }
      #wih-history-viewer .wih-player-name {
        overflow: hidden;
        font-weight: 700;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #wih-history-viewer .wih-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #777d86;
      }
      #wih-history-viewer .wih-dot.status-online { background: #33c774; }
      #wih-history-viewer .wih-dot.status-idle { background: #f2b949; }
      #wih-history-viewer .wih-card {
        margin-bottom: 10px;
        padding: 11px;
        border: 1px solid var(--wih-border);
        border-radius: 11px;
        background: var(--wih-surface);
      }
      #wih-history-viewer .wih-player-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      #wih-history-viewer .wih-player-heading h2 { margin: 0 0 2px; font-size: 20px; }
      #wih-history-viewer .wih-status-pills { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
      #wih-history-viewer .wih-pill {
        padding: 4px 7px;
        border-radius: 99px;
        background: var(--wih-surface-2);
        text-transform: capitalize;
        font-size: 11px;
        font-weight: 700;
      }
      #wih-history-viewer .wih-pill.status-online { background: rgba(51,199,116,.2); color: #8ef0b7; }
      #wih-history-viewer .wih-pill.status-idle { background: rgba(242,185,73,.2); color: #ffd782; }
      #wih-history-viewer .wih-pill.status-hospital,
      #wih-history-viewer .wih-pill.status-jail,
      #wih-history-viewer .wih-pill.status-federal { background: rgba(228,78,78,.2); color: #ffaaaa; }
      #wih-history-viewer .wih-pill.status-traveling,
      #wih-history-viewer .wih-pill.status-returning,
      #wih-history-viewer .wih-pill.status-abroad { background: rgba(91,154,255,.2); color: #c4d7ff; }
      #wih-history-viewer .wih-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        margin-top: 10px;
      }
      #wih-history-viewer .wih-summary-stat { padding: 8px; border-radius: 8px; background: var(--wih-surface-2); }
      #wih-history-viewer .wih-summary-stat strong { display: block; font-size: 15px; }
      #wih-history-viewer .wih-range-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      #wih-history-viewer .wih-range-button[aria-pressed="true"] { border-color: var(--wih-accent); background: rgba(255,122,89,.18); }
      #wih-history-viewer .wih-timeline {
        position: relative;
        display: flex;
        height: 34px;
        overflow: hidden;
        border: 1px solid var(--wih-border);
        border-radius: 8px;
        background: repeating-linear-gradient(135deg, #343840, #343840 5px, #292d34 5px, #292d34 10px);
        cursor: crosshair;
        touch-action: manipulation;
      }
      #wih-history-viewer .wih-timeline:focus-visible { outline: 2px solid var(--wih-accent); outline-offset: 2px; }
      #wih-history-viewer .wih-segment { height: 100%; min-width: 1px; }
      #wih-history-viewer .wih-segment.status-online { background: #299a5c; }
      #wih-history-viewer .wih-segment.status-idle { background: #c08a27; }
      #wih-history-viewer .wih-segment.status-offline { background: #626873; }
      #wih-history-viewer .wih-segment.status-unknown { background: transparent; }
      #wih-history-viewer .wih-timeline-marker {
        position: absolute;
        top: 0;
        bottom: 0;
        z-index: 2;
        width: 2px;
        transform: translateX(-1px);
        background: #fff;
        box-shadow: 0 0 0 1px rgba(0,0,0,.48), 0 0 7px rgba(255,255,255,.85);
        pointer-events: none;
      }
      #wih-history-viewer .wih-marker-readout {
        min-height: 18px;
        margin-top: 6px;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        text-align: center;
      }
      #wih-history-viewer .wih-timeline-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 7px; }
      #wih-history-viewer .wih-legend-swatch { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; vertical-align: -1px; }
      #wih-history-viewer .wih-event-list { display: grid; gap: 7px; }
      #wih-history-viewer .wih-event {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 7px;
        padding: 8px;
        border-radius: 8px;
        background: var(--wih-surface-2);
      }
      #wih-history-viewer .wih-event-status { text-transform: capitalize; font-weight: 700; }
      #wih-history-viewer .wih-empty { padding: 24px 12px; text-align: center; color: var(--wih-muted); }
      @media (min-width: 760px) {
        #wih-history-viewer .wih-history-grid { grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); align-items: start; max-width: 1320px; margin: 0 auto; }
        #wih-history-viewer .wih-roster { position: sticky; top: 68px; }
        #wih-history-viewer .wih-roster-list { grid-template-columns: 1fr; max-height: calc(100vh - 140px); }
        #wih-history-viewer .wih-summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
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
          <button class="wih-button wih-primary" data-action="history">History</button>
          <button class="wih-button" data-action="copy-export">Copy export</button>
          <button class="wih-button" data-action="view-export">View export</button>
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
          <button class="wih-button" data-action="share-export">Share export</button>
          <button class="wih-button" data-action="download-export">Download export file</button>
          <button class="wih-button" data-action="diagnostics">Copy diagnostics</button>
          <button class="wih-button" data-action="erase">Erase all local WIH data</button>
          <div class="wih-note">
            v0.2.1 records only information already rendered on the page. It does not make API calls,
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

    panel.querySelector('[data-action="history"]')?.addEventListener('click', () => {
      openHistoryViewer().catch(reportError);
    });

    panel.querySelector('[data-action="download-export"]')?.addEventListener('click', () => {
      exportData().catch(reportError);
    });

    panel.querySelector('[data-action="copy-export"]')?.addEventListener('click', () => {
      copyExportData().catch(reportError);
    });

    panel.querySelector('[data-action="view-export"]')?.addEventListener('click', () => {
      viewExportData().catch(reportError);
    });

    panel.querySelector('[data-action="share-export"]')?.addEventListener('click', () => {
      shareExportData().catch(reportError);
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

  function cleanStoredName(name, playerId) {
    const cleaned = normalizeWhitespace(name)
      .replace(/^view profile of\s+/i, '')
      .trim();
    return cleaned && !/^view profile$/i.test(cleaned)
      ? cleaned
      : `Player ${playerId}`;
  }

  function normalizeObservationForAnalysis(observation) {
    const visibleText = normalizeWhitespace(observation?.visibleText);
    const inferredLifeStatus = classifyLifeStatus(visibleText);
    const legacyLifeStatus = observation?.lifeStatus;
    const lifeStatus =
      inferredLifeStatus !== 'unknown'
        ? inferredLifeStatus
        : legacyLifeStatus === 'travel'
          ? 'traveling'
          : legacyLifeStatus || 'unknown';
    const activityStatus =
      observation?.activityStatus || observation?.status || 'unknown';

    return {
      ...observation,
      name: cleanStoredName(observation?.name, observation?.playerId),
      status: activityStatus,
      activityStatus,
      lifeStatus,
    };
  }

  function buildAnalysisObservations(rawObservations) {
    const sorted = rawObservations
      .map(normalizeObservationForAnalysis)
      .sort(
        (a, b) =>
          Number(a.capturedAt || 0) - Number(b.capturedAt || 0) ||
          Number(a.id || 0) - Number(b.id || 0)
      );
    const latestByPlayer = new Map();
    const observations = [];
    let ignoredLegacyDuplicates = 0;

    for (const observation of sorted) {
      const previous = latestByPlayer.get(observation.playerId);
      const isLegacyDuplicate = Boolean(
        previous &&
        observation.capturedAt - previous.capturedAt <= APP.legacyDuplicateWindowMs &&
        observation.activityStatus === previous.activityStatus &&
        observation.lifeStatus === previous.lifeStatus &&
        observation.visibleText === previous.visibleText
      );

      if (isLegacyDuplicate) {
        ignoredLegacyDuplicates += 1;
        continue;
      }

      observations.push(observation);
      latestByPlayer.set(observation.playerId, observation);
    }

    return { observations, ignoredLegacyDuplicates };
  }

  function findCoverageGaps(analysisObservations) {
    const scanTimes = [];

    for (const observation of analysisObservations) {
      const timestamp = Number(observation.capturedAt || 0);
      if (!timestamp) continue;
      const previous = scanTimes.at(-1);
      if (!previous || timestamp - previous > 5_000) scanTimes.push(timestamp);
    }

    const gaps = [];
    for (let index = 1; index < scanTimes.length; index += 1) {
      const from = scanTimes[index - 1];
      const to = scanTimes[index];
      const durationMs = to - from;
      if (durationMs >= APP.coverageGapThresholdMs) {
        gaps.push({ from, to, durationMs });
      }
    }
    return gaps;
  }

  async function getObservationsForPlayer(playerId) {
    const tx = state.db.transaction(APP.observationsStore, 'readonly');
    const index = tx.objectStore(APP.observationsStore).index('byPlayerCapturedAt');
    const range = IDBKeyRange.bound(
      [String(playerId), 0],
      [String(playerId), Number.MAX_SAFE_INTEGER]
    );
    return requestResult(index.getAll(range));
  }

  function formatDuration(durationMs) {
    const minutes = Math.max(0, Math.round(Number(durationMs || 0) / 60_000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  function historyRangeStart(rangeName, observations, now) {
    if (rangeName === '12h') return now - 12 * 60 * 60_000;
    if (rangeName === '24h') return now - 24 * 60 * 60_000;
    if (rangeName === '3d') return now - 3 * 24 * 60 * 60_000;
    return Number(observations[0]?.capturedAt || now);
  }

  function buildPlayerTimeline(observations, rangeName, now = Date.now()) {
    const sorted = observations
      .filter((observation) => Number(observation.capturedAt || 0) <= now)
      .sort((a, b) => Number(a.capturedAt) - Number(b.capturedAt));
    const rangeStart = historyRangeStart(rangeName, sorted, now);
    const totalMs = Math.max(1, now - rangeStart);
    const segments = [];
    let coveredMs = 0;
    let cursor = rangeStart;

    for (let index = 0; index < sorted.length; index += 1) {
      const observation = sorted[index];
      const capturedAt = Number(observation.capturedAt || 0);
      const nextAt = Number(sorted[index + 1]?.capturedAt || now);
      if (nextAt <= rangeStart || capturedAt >= now) continue;

      const statusFrom = Math.max(rangeStart, capturedAt);
      const statusTo = Math.min(
        now,
        nextAt,
        capturedAt + APP.coverageGapThresholdMs
      );

      if (statusFrom > cursor) {
        segments.push({ from: cursor, to: statusFrom, status: 'unknown', isGap: true });
      }
      if (statusTo > statusFrom) {
        segments.push({
          from: statusFrom,
          to: statusTo,
          status: observation.activityStatus || 'unknown',
          isGap: false,
        });
        coveredMs += statusTo - statusFrom;
        cursor = Math.max(cursor, statusTo);
      }
    }

    if (cursor < now) {
      segments.push({ from: cursor, to: now, status: 'unknown', isGap: true });
    }

    const visibleObservations = sorted.filter(
      (observation) => Number(observation.capturedAt || 0) >= rangeStart
    );
    let transitions = 0;
    let previous = null;
    for (const observation of sorted) {
      if (Number(observation.capturedAt || 0) >= rangeStart) break;
      previous = observation;
    }
    for (const observation of visibleObservations) {
      if (
        previous &&
        (observation.activityStatus !== previous.activityStatus ||
          observation.lifeStatus !== previous.lifeStatus)
      ) {
        transitions += 1;
      }
      previous = observation;
    }

    return {
      rangeStart,
      rangeEnd: now,
      totalMs,
      segments,
      visibleObservations,
      transitions,
      coveragePercent: Math.min(100, Math.round((coveredMs / totalMs) * 100)),
    };
  }

  function historyStatusPill(status) {
    const normalized = normalizeWhitespace(status || 'unknown').toLowerCase();
    return `<span class="wih-pill status-${escapeHtml(normalized)}">${escapeHtml(normalized)}</span>`;
  }

  async function openHistoryViewer() {
    document.getElementById('wih-history-viewer')?.remove();

    const players = (await getAllFromStore(APP.playersStore))
      .map((player) => ({
        ...player,
        name: cleanStoredName(player.name, player.playerId),
        latestActivityStatus: player.latestActivityStatus || player.latestStatus || 'unknown',
        latestLifeStatus: player.latestLifeStatus || 'unknown',
      }))
      .sort(
        (a, b) =>
          statusRank(a.latestActivityStatus) - statusRank(b.latestActivityStatus) ||
          a.name.localeCompare(b.name)
      );

    const currentFactionId = inferFactionId(location.href);
    const initialPlayer =
      players.find((player) => player.factionId === currentFactionId) || players[0] || null;
    const viewerState = {
      players,
      selectedPlayerId: initialPlayer?.playerId || null,
      factionId: currentFactionId && players.some((player) => player.factionId === currentFactionId)
        ? currentFactionId
        : 'all',
      query: '',
      range: '24h',
      markerTimestamp: null,
      detailRequest: 0,
    };

    const viewer = document.createElement('div');
    viewer.id = 'wih-history-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'War Intelligence history');
    viewer.innerHTML = `
      <div class="wih-history-shell">
        <header class="wih-history-header">
          <div class="wih-history-title">
            <strong>War Intelligence History</strong>
            <span class="wih-muted">Local observations · gaps are shown honestly</span>
          </div>
          <button type="button" class="wih-close" data-history-action="close">Close</button>
        </header>
        <main class="wih-history-grid">
          <section class="wih-roster" aria-label="Player roster"></section>
          <section class="wih-history-detail" aria-live="polite"></section>
        </main>
      </div>
    `;
    document.body.append(viewer);

    const rosterElement = viewer.querySelector('.wih-roster');
    const detailElement = viewer.querySelector('.wih-history-detail');
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeViewer = () => {
      document.body.style.overflow = previousBodyOverflow;
      viewer.remove();
    };

    function filteredPlayers() {
      const query = viewerState.query.toLowerCase();
      return viewerState.players.filter((player) => {
        const factionMatches =
          viewerState.factionId === 'all' || player.factionId === viewerState.factionId;
        const queryMatches =
          !query ||
          player.name.toLowerCase().includes(query) ||
          String(player.playerId).includes(query);
        return factionMatches && queryMatches;
      });
    }

    function renderRoster() {
      const factionIds = [...new Set(
        viewerState.players.map((player) => player.factionId).filter(Boolean)
      )].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
      const filtered = filteredPlayers();
      rosterElement.innerHTML = `
        <div class="wih-roster-tools">
          <input type="search" data-history-search placeholder="Search name or ID" value="${escapeHtml(viewerState.query)}" aria-label="Search players">
          <select data-history-faction aria-label="Filter faction">
            <option value="all" ${viewerState.factionId === 'all' ? 'selected' : ''}>All factions</option>
            ${factionIds.map((factionId) => `
              <option value="${escapeHtml(factionId)}" ${viewerState.factionId === factionId ? 'selected' : ''}>
                Faction ${escapeHtml(factionId)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="wih-muted" style="margin:0 2px 7px">${filtered.length} player${filtered.length === 1 ? '' : 's'}</div>
        <div class="wih-roster-list">
          ${filtered.length ? filtered.map((player) => `
            <button type="button" class="wih-player-button" data-history-player="${escapeHtml(player.playerId)}" aria-current="${player.playerId === viewerState.selectedPlayerId}">
              <span>
                <span class="wih-player-name">${escapeHtml(player.name)}</span>
                <span class="wih-muted">${escapeHtml(player.latestLifeStatus)} · ${escapeHtml(formatDateTime(player.lastSeenAt))}</span>
              </span>
              <span class="wih-dot status-${escapeHtml(player.latestActivityStatus)}" title="${escapeHtml(player.latestActivityStatus)}"></span>
            </button>
          `).join('') : '<div class="wih-empty">No players match this filter.</div>'}
        </div>
      `;

      rosterElement.querySelector('[data-history-search]')?.addEventListener('input', (event) => {
        viewerState.query = event.currentTarget.value;
        renderRoster();
        rosterElement.querySelector('[data-history-search]')?.focus();
      });
      rosterElement.querySelector('[data-history-faction]')?.addEventListener('change', (event) => {
        viewerState.factionId = event.currentTarget.value;
        const first = filteredPlayers()[0];
        if (first && !filteredPlayers().some((player) => player.playerId === viewerState.selectedPlayerId)) {
          viewerState.selectedPlayerId = first.playerId;
          viewerState.markerTimestamp = null;
          renderDetail().catch(reportError);
        }
        renderRoster();
      });
      rosterElement.querySelectorAll('[data-history-player]').forEach((button) => {
        button.addEventListener('click', () => {
          viewerState.selectedPlayerId = button.dataset.historyPlayer;
          viewerState.markerTimestamp = null;
          renderRoster();
          renderDetail().catch(reportError);
          if (window.innerWidth < 760) detailElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    async function renderDetail() {
      const requestNumber = ++viewerState.detailRequest;
      const player = viewerState.players.find(
        (candidate) => candidate.playerId === viewerState.selectedPlayerId
      );
      if (!player) {
        detailElement.innerHTML = '<div class="wih-empty">Capture a faction page to begin building player history.</div>';
        return;
      }

      detailElement.innerHTML = '<div class="wih-empty">Loading player history…</div>';
      const rawObservations = await getObservationsForPlayer(player.playerId);
      if (requestNumber !== viewerState.detailRequest || !viewer.isConnected) return;
      const analysis = buildAnalysisObservations(rawObservations);
      const timeline = buildPlayerTimeline(analysis.observations, viewerState.range);
      const markerTimestamp =
        viewerState.markerTimestamp >= timeline.rangeStart &&
        viewerState.markerTimestamp <= timeline.rangeEnd
          ? viewerState.markerTimestamp
          : null;
      const markerPercent = markerTimestamp === null
        ? null
        : ((markerTimestamp - timeline.rangeStart) / timeline.totalMs) * 100;
      const latest = analysis.observations.at(-1) || {
        activityStatus: player.latestActivityStatus,
        lifeStatus: player.latestLifeStatus,
        capturedAt: player.lastSeenAt,
      };
      const first = analysis.observations[0];
      const events = [...timeline.visibleObservations].reverse().slice(0, 100);

      detailElement.innerHTML = `
        <section class="wih-card">
          <div class="wih-player-heading">
            <div>
              <h2>${escapeHtml(player.name)}</h2>
              <div class="wih-muted">Player ${escapeHtml(player.playerId)} · Faction ${escapeHtml(player.factionId || 'unknown')}</div>
            </div>
            <div class="wih-status-pills">
              ${historyStatusPill(latest.activityStatus)}
              ${historyStatusPill(latest.lifeStatus)}
            </div>
          </div>
          <div class="wih-summary-grid">
            <div class="wih-summary-stat"><strong>${analysis.observations.length}</strong><span class="wih-muted">usable observations</span></div>
            <div class="wih-summary-stat"><strong>${timeline.transitions}</strong><span class="wih-muted">changes in range</span></div>
            <div class="wih-summary-stat"><strong>${timeline.coveragePercent}%</strong><span class="wih-muted">range coverage</span></div>
            <div class="wih-summary-stat"><strong>${formatDuration(timeline.totalMs)}</strong><span class="wih-muted">selected range</span></div>
          </div>
          <div class="wih-muted" style="margin-top:9px">
            First seen ${escapeHtml(formatDateTime(first?.capturedAt))} · Last seen ${escapeHtml(formatDateTime(latest?.capturedAt))}
            ${analysis.ignoredLegacyDuplicates ? ` · ${analysis.ignoredLegacyDuplicates} legacy duplicate${analysis.ignoredLegacyDuplicates === 1 ? '' : 's'} ignored` : ''}
          </div>
        </section>

        <section class="wih-card">
          <div class="wih-range-row" aria-label="Timeline range">
            ${[
              ['12h', '12hr'],
              ['24h', '24hr'],
              ['3d', '3 days'],
              ['all', 'All'],
            ].map(([rangeName, rangeLabel]) => `
              <button type="button" class="wih-range-button" data-history-range="${rangeName}" aria-pressed="${viewerState.range === rangeName}">${rangeLabel}</button>
            `).join('')}
          </div>
          <div class="wih-timeline" data-history-timeline tabindex="0" role="slider" aria-label="Activity timeline. Tap to inspect a time." aria-valuemin="${timeline.rangeStart}" aria-valuemax="${timeline.rangeEnd}" ${markerTimestamp === null ? '' : `aria-valuenow="${markerTimestamp}" aria-valuetext="${escapeHtml(formatDateTime(markerTimestamp))}"`}>
            ${timeline.segments.map((segment) => {
              const width = ((segment.to - segment.from) / timeline.totalMs) * 100;
              const label = segment.isGap
                ? `No coverage · ${formatDuration(segment.to - segment.from)}`
                : `${segment.status} · ${formatDuration(segment.to - segment.from)}`;
              return `<span class="wih-segment status-${escapeHtml(segment.status)}" style="width:${width.toFixed(5)}%" title="${escapeHtml(label)}"></span>`;
            }).join('')}
            ${markerPercent === null ? '' : `<span class="wih-timeline-marker" style="left:${markerPercent.toFixed(5)}%" aria-hidden="true"></span>`}
          </div>
          <div class="wih-marker-readout" data-history-marker-readout>${markerTimestamp === null ? 'Tap the timeline to inspect a time' : escapeHtml(formatDateTime(markerTimestamp))}</div>
          <div class="wih-timeline-legend wih-muted">
            <span><i class="wih-legend-swatch" style="background:#299a5c"></i>Online</span>
            <span><i class="wih-legend-swatch" style="background:#c08a27"></i>Idle</span>
            <span><i class="wih-legend-swatch" style="background:#626873"></i>Offline</span>
            <span><i class="wih-legend-swatch" style="background:repeating-linear-gradient(135deg,#343840,#343840 3px,#292d34 3px,#292d34 6px)"></i>No coverage</span>
          </div>
          <div class="wih-muted" style="margin-top:8px">${escapeHtml(formatDateTime(timeline.rangeStart))} → ${escapeHtml(formatDateTime(timeline.rangeEnd))}</div>
        </section>

        <section class="wih-card">
          <strong>Observation events</strong>
          <div class="wih-muted" style="margin:2px 0 9px">Newest first${events.length === 100 ? ' · showing latest 100 in range' : ''}</div>
          <div class="wih-event-list">
            ${events.length ? events.map((observation, index) => {
              const prior = events[index + 1];
              const changed = prior && (
                observation.activityStatus !== prior.activityStatus ||
                observation.lifeStatus !== prior.lifeStatus
              );
              return `
                <div class="wih-event">
                  <div>
                    <div class="wih-event-status">${escapeHtml(observation.activityStatus)} · ${escapeHtml(observation.lifeStatus)}</div>
                    <div class="wih-muted">${changed ? 'Status change' : 'Observation'}${observation.lastActionText ? ` · ${escapeHtml(observation.lastActionText)}` : ''}</div>
                  </div>
                  <time class="wih-muted">${escapeHtml(formatDateTime(observation.capturedAt))}</time>
                </div>
              `;
            }).join('') : '<div class="wih-empty">No observations fall inside this range.</div>'}
          </div>
        </section>
      `;

      detailElement.querySelectorAll('[data-history-range]').forEach((button) => {
        button.addEventListener('click', () => {
          viewerState.range = button.dataset.historyRange;
          viewerState.markerTimestamp = null;
          renderDetail().catch(reportError);
        });
      });

      const timelineElement = detailElement.querySelector('[data-history-timeline]');
      const setTimelineMarker = (ratio) => {
        const boundedRatio = Math.max(0, Math.min(1, ratio));
        viewerState.markerTimestamp = Math.round(
          timeline.rangeStart + boundedRatio * timeline.totalMs
        );
        let markerElement = timelineElement?.querySelector('.wih-timeline-marker');
        if (!markerElement && timelineElement) {
          markerElement = document.createElement('span');
          markerElement.className = 'wih-timeline-marker';
          markerElement.setAttribute('aria-hidden', 'true');
          timelineElement.append(markerElement);
        }
        if (markerElement) markerElement.style.left = `${(boundedRatio * 100).toFixed(5)}%`;
        const formattedTime = formatDateTime(viewerState.markerTimestamp);
        const readout = detailElement.querySelector('[data-history-marker-readout]');
        if (readout) readout.textContent = formattedTime;
        timelineElement?.setAttribute('aria-valuenow', String(viewerState.markerTimestamp));
        timelineElement?.setAttribute('aria-valuetext', formattedTime);
      };
      timelineElement?.addEventListener('click', (event) => {
        const rect = timelineElement.getBoundingClientRect();
        if (!rect.width) return;
        setTimelineMarker((event.clientX - rect.left) / rect.width);
      });
      timelineElement?.addEventListener('keydown', (event) => {
        const currentMarkerTimestamp = viewerState.markerTimestamp;
        const currentRatio = currentMarkerTimestamp === null
          ? 0.5
          : (currentMarkerTimestamp - timeline.rangeStart) / timeline.totalMs;
        let nextRatio = currentRatio;
        if (event.key === 'ArrowLeft') nextRatio -= 0.01;
        else if (event.key === 'ArrowRight') nextRatio += 0.01;
        else if (event.key === 'Home') nextRatio = 0;
        else if (event.key === 'End') nextRatio = 1;
        else return;
        event.preventDefault();
        setTimelineMarker(nextRatio);
      });
    }

    viewer.querySelector('[data-history-action="close"]')?.addEventListener('click', closeViewer);
    viewer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeViewer();
    });
    renderRoster();
    await renderDetail();
  }

  async function buildExportPayload() {
    const [players, rawObservations] = await Promise.all([
      getAllFromStore(APP.playersStore),
      getAllFromStore(APP.observationsStore),
    ]);
    const analysis = buildAnalysisObservations(rawObservations);
    const coverageGaps = findCoverageGaps(analysis.observations);

    return {
      schema: 'script-kitty-war-intel-export',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: APP.version,
      analysisSummary: {
        rawObservationCount: rawObservations.length,
        usableObservationCount: analysis.observations.length,
        ignoredLegacyDuplicateCount: analysis.ignoredLegacyDuplicates,
        coverageGapCount: coverageGaps.length,
        coverageGaps,
      },
      players,
      observations: rawObservations,
    };
  }

  async function exportData() {
    const payload = await buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tornscripture-war-intel-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Prepared ${payload.observations.length} observations for download.`);
  }

  async function writeTextToClipboard(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard copy was not available.');
  }

  async function copyExportData() {
    const payload = await buildExportPayload();
    await writeTextToClipboard(JSON.stringify(payload, null, 2));
    toast(`Copied ${payload.observations.length} observations.`);
  }

  async function viewExportData() {
    const payload = await buildExportPayload();
    const serialized = JSON.stringify(payload, null, 2);
    document.getElementById('wih-export-viewer')?.remove();

    const viewer = document.createElement('div');
    viewer.id = 'wih-export-viewer';
    viewer.innerHTML = `
      <section class="wih-export-card" role="dialog" aria-modal="true" aria-label="TornScripture export">
        <strong>TornScripture export · ${payload.observations.length} raw observations</strong>
        <textarea readonly aria-label="Export data"></textarea>
        <div class="wih-export-actions">
          <button type="button" data-export-action="copy">Copy all</button>
          <button type="button" data-export-action="share">Share</button>
          <button type="button" data-export-action="close">Close</button>
        </div>
      </section>
    `;
    viewer.querySelector('textarea').value = serialized;
    document.body.append(viewer);

    viewer.querySelector('[data-export-action="copy"]')?.addEventListener('click', () => {
      writeTextToClipboard(serialized)
        .then(() => toast('Export copied.'))
        .catch(reportError);
    });
    viewer.querySelector('[data-export-action="share"]')?.addEventListener('click', () => {
      shareSerializedExport(serialized).catch(reportError);
    });
    viewer.querySelector('[data-export-action="close"]')?.addEventListener('click', () => {
      viewer.remove();
    });
  }

  function exportFilename() {
    return `tornscripture-war-intel-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  }

  async function shareSerializedExport(serialized) {
    const filename = exportFilename();
    const file = typeof File === 'function'
      ? new File([serialized], filename, { type: 'text/plain' })
      : null;

    try {
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'TornScripture export',
          text: 'War Intelligence HUD local export',
          files: [file],
        });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }

    await writeTextToClipboard(serialized);
    toast('File sharing is unavailable here; export copied instead.');
  }

  async function shareExportData() {
    const payload = await buildExportPayload();
    await shareSerializedExport(JSON.stringify(payload, null, 2));
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
    const rawObservations = await getAllFromStore(APP.observationsStore);
    const analysis = buildAnalysisObservations(rawObservations);
    const coverageGaps = findCoverageGaps(analysis.observations);
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
      ignoredPageChromeCount: state.lastDiscoveryStats.ignoredPageChromeCount,
      archiveStats: stats,
      analysisStats: {
        usableObservationCount: analysis.observations.length,
        ignoredLegacyDuplicateCount: analysis.ignoredLegacyDuplicates,
        coverageGapCount: coverageGaps.length,
      },
      userAgent: navigator.userAgent,
      generatedAt: new Date().toISOString(),
    };

    await writeTextToClipboard(JSON.stringify(diagnostics, null, 2));
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
    await cleanPlayerSummaryNames();
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
