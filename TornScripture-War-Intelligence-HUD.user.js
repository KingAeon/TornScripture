// ==UserScript==
// @name         TornScripture - War Intelligence HUD
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.7.1
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
   * TORNSCRIPTURE - WAR INTELLIGENCE HUD v0.7.1
   *
   * SAFETY BOUNDARY
   * - Reads only information already rendered on a page the user opened.
   * - Makes no Torn API calls and no background page requests.
   * - Performs no gameplay actions.
   * - Stores observations locally in IndexedDB.
   *
   * v0.3.0 PURPOSE
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
   * - Record collector wake-ups and scans to measure background reliability.
   * - Deduplicate observation writes atomically across Torn PDA tabs.
   * - Attribute health records to persistent tabs and individual script runs.
   * - Provide a faction-level intelligence dashboard with honest coverage.
   * - Do NOT predict sleep windows yet.
   * - Resolve Torn's real faction ID on member pages that omit it from the URL.
   * - Continue rendered-page polling in hidden tabs while the WebView remains awake.
   * - Summarize actionable observed events and ready windows in war reports.
   * - Contain Intelligence columns to the visible Torn PDA viewport.
   */

  const APP = Object.freeze({
    name: 'War Intelligence HUD',
    shortName: 'WIH',
    version: '0.7.1',
    // Keep the v0.1.0 storage identifiers so upgrading does not erase history.
    dbName: 'script-kitty-war-intel',
    dbVersion: 1,
    observationsStore: 'observations',
    playersStore: 'players',
    healthDbName: 'script-kitty-war-intel-health',
    healthDbVersion: 1,
    healthStore: 'collectorHealth',
    settingsKey: 'sk-wih-settings-v1',
    warSessionsKey: 'sk-wih-war-sessions-v1',
    panelId: 'sk-wih-panel',
    styleId: 'sk-wih-style',
    maxRowsInPanel: 50,
    captureDebounceMs: 1800,
    renderedPagePollMs: 60_000,
    unchangedObservationHeartbeatMs: 10 * 60_000,
    legacyDuplicateWindowMs: 1_000,
    coverageGapThresholdMs: 15 * 60_000,
    collectorTickGapThresholdMs: 2.5 * 60_000,
    collectorHealthKeepDays: 7,
  });

  const DEFAULT_SETTINGS = Object.freeze({
    collapsed: false,
    autoCaptureVisiblePage: true,
    showOnlyLikelyEnemies: true,
    keepDays: 30,
    localTime: true,
    hudPosition: null,
    watchedPlayerIds: [],
    watchedFactionIds: [],
    factionAliases: {},
  });

  function createCollectorId(prefix) {
    const randomPart = globalThis.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${randomPart}`;
  }

  function getOrCreateCollectorTabId() {
    const key = 'sk-wih-collector-tab-id-v1';
    try {
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;
      const created = createCollectorId('tab');
      sessionStorage.setItem(key, created);
      return created;
    } catch {
      return createCollectorId('tab');
    }
  }

  const COLLECTOR_TAB_ID = getOrCreateCollectorTabId();
  const COLLECTOR_RUN_ID = createCollectorId('run');

  const state = {
    db: null,
    healthDb: null,
    settings: loadSettings(),
    warSessions: loadWarSessions(),
    captureTimer: null,
    pollTimer: null,
    capturePromise: null,
    mutationObserver: null,
    lastUrl: location.href,
    lastCaptureAt: null,
    lastCaptureCount: 0,
    lastWakeAt: null,
    lastPageContentChangeAt: null,
    lastPageFingerprint: null,
    collectorTabId: COLLECTOR_TAB_ID,
    collectorRunId: COLLECTOR_RUN_ID,
    resolvedFactionIds: new Map(),
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
      const settings = {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(localStorage.getItem(APP.settingsKey) || '{}'),
      };
      settings.watchedPlayerIds = Array.isArray(settings.watchedPlayerIds)
        ? [...new Set(settings.watchedPlayerIds.map(String))]
        : [];
      settings.watchedFactionIds = Array.isArray(settings.watchedFactionIds)
        ? [...new Set(settings.watchedFactionIds.map(String))]
        : [];
      settings.factionAliases = settings.factionAliases &&
        typeof settings.factionAliases === 'object' &&
        !Array.isArray(settings.factionAliases)
        ? settings.factionAliases
        : {};
      return settings;
    } catch {
      return {
        ...DEFAULT_SETTINGS,
        watchedPlayerIds: [],
        watchedFactionIds: [],
        factionAliases: {},
      };
    }
  }

  function saveSettings() {
    localStorage.setItem(APP.settingsKey, JSON.stringify(state.settings));
  }

  function loadWarSessions() {
    try {
      const sessions = JSON.parse(localStorage.getItem(APP.warSessionsKey) || '[]');
      return Array.isArray(sessions)
        ? sessions.filter(
            (session) => session?.id && session?.startedAt && Array.isArray(session.factionIds)
          ).slice(-30)
        : [];
    } catch {
      return [];
    }
  }

  function saveWarSessions() {
    state.warSessions = state.warSessions.slice(-30);
    localStorage.setItem(APP.warSessionsKey, JSON.stringify(state.warSessions));
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

  function extractFactionId(value) {
    if (!value) return null;
    try {
      const url = new URL(value, location.origin);
      const queryId = url.searchParams.get('ID') || url.searchParams.get('id');
      const pathId = url.pathname.match(/\/factions\/(\d+)/i)?.[1];
      const id = queryId || pathId;
      return id && /^\d+$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  function factionPageCacheKey() {
    try {
      const url = new URL(location.href);
      // Referral parameters can change without changing the faction context.
      url.searchParams.delete('referredFrom');
      return `${url.pathname}${url.search}${url.hash.split('/')[0]}`;
    } catch {
      return `${location.pathname}${location.search}`;
    }
  }

  function inferFactionId() {
    try {
      const currentUrl = new URL(location.href);
      const currentId = extractFactionId(currentUrl.href);
      if (currentId) {
        state.resolvedFactionIds.set(factionPageCacheKey(), currentId);
        return currentId;
      }
    } catch {
      // Fall through to page-link detection.
    }

    const cacheKey = factionPageCacheKey();
    const scoredIds = new Map();
    const addCandidate = (id, score) => {
      if (!id || !/^\d+$/.test(id)) return;
      scoredIds.set(id, Math.max(scoredIds.get(id) || 0, score));
    };

    for (const element of document.querySelectorAll('[data-faction-id], [data-factionid]')) {
      const id = element.getAttribute('data-faction-id') || element.getAttribute('data-factionid');
      const nearFactionIdentity = Boolean(
        element.closest('h1, h2, [class*="faction" i][class*="title" i], [class*="faction" i][class*="info" i]')
      );
      addCandidate(id, nearFactionIdentity ? 140 : 100);
    }

    const links = document.querySelectorAll(
      'a[href*="factions.php"][href*="ID="], a[href*="/factions/"]'
    );
    for (const link of links) {
      const id = extractFactionId(link.getAttribute('href') || link.href);
      if (!id) continue;

      let score = 40;
      const href = String(link.getAttribute('href') || '');
      const label = normalizeWhitespace(
        `${link.textContent || ''} ${link.getAttribute('aria-label') || ''} ${link.getAttribute('title') || ''}`
      ).toLowerCase();
      if (/step=profile/i.test(href)) score += 25;
      if (/\bfaction\b|view faction|faction profile/.test(label)) score += 20;
      if (link.closest('h1, h2, [class*="title" i], [class*="header" i]')) score += 35;
      if (link.closest('[class*="faction" i][class*="info" i], [class*="faction" i][class*="name" i]')) score += 45;
      if (link.closest('nav, [class*="menu" i], [class*="sidebar" i], footer')) score -= 20;
      addCandidate(id, score);
    }

    const ranked = [...scoredIds.entries()].sort((a, b) => b[1] - a[1]);
    const cachedId = state.resolvedFactionIds.get(cacheKey);
    if (cachedId && scoredIds.has(cachedId)) return cachedId;

    // A lone real faction ID is unambiguous. With several links, require the
    // page-identity candidate to clearly outrank navigation/opponent links.
    const resolvedId = ranked.length === 1 || (ranked[0] && ranked[0][1] >= (ranked[1]?.[1] || 0) + 20)
      ? ranked[0]?.[0] || null
      : null;
    if (resolvedId) state.resolvedFactionIds.set(cacheKey, resolvedId);
    return resolvedId || cachedId || null;
  }

  function inferCollectorFactionId() {
    try {
      const currentUrl = new URL(location.href);
      const isFactionPage = /\/factions\.php$/i.test(currentUrl.pathname);
      return isFactionPage ? inferFactionId() : null;
    } catch {
      return null;
    }
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
        rowLike: Boolean(rowLike),
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
          (player.rowLike && player.lastActionText && !/^Player\s+\d+$/i.test(player.name))
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
      .map(({ candidateScore, attributeText, rowLike, ...player }) => player)
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

  function openHealthDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(APP.healthDbName, APP.healthDbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(APP.healthStore)) {
          const store = db.createObjectStore(APP.healthStore, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('byRecordedAt', 'recordedAt', { unique: false });
          store.createIndex('byTypeRecordedAt', ['type', 'recordedAt'], { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Collector health database was blocked.'));
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

  async function recordCollectorHealth(type, details = {}) {
    if (!state.healthDb) return;
    const recordedAt = Date.now();
    state.lastWakeAt = recordedAt;
    const tx = state.healthDb.transaction(APP.healthStore, 'readwrite');
    tx.objectStore(APP.healthStore).add({
      type,
      recordedAt,
      tabId: state.collectorTabId,
      runId: state.collectorRunId,
      hidden: document.hidden,
      relevantPage: pageLooksRelevant(),
      pageUrl: location.href,
      factionId: inferCollectorFactionId(),
      lastPageContentChangeAt: state.lastPageContentChangeAt,
      ...details,
    });
    await transactionDone(tx);
  }

  async function getCollectorHealthRecords(since = 0) {
    const tx = state.healthDb.transaction(APP.healthStore, 'readonly');
    const index = tx.objectStore(APP.healthStore).index('byRecordedAt');
    return requestResult(index.getAll(IDBKeyRange.lowerBound(since)));
  }

  async function getLatestCollectorHealthRecord() {
    const tx = state.healthDb.transaction(APP.healthStore, 'readonly');
    const index = tx.objectStore(APP.healthStore).index('byRecordedAt');
    const cursor = await requestResult(index.openCursor(null, 'prev'));
    return cursor?.value ?? null;
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
      const tx = state.db.transaction(
        [APP.observationsStore, APP.playersStore],
        'readwrite'
      );
      const done = transactionDone(tx);
      const observationsStore = tx.objectStore(APP.observationsStore);
      const playersStore = tx.objectStore(APP.playersStore);
      const index = observationsStore.index('byPlayerCapturedAt');
      const range = IDBKeyRange.bound(
        [player.playerId, 0],
        [player.playerId, Number.MAX_SAFE_INTEGER]
      );
      const [cursor, existingSummary] = await Promise.all([
        requestResult(index.openCursor(range, 'prev')),
        requestResult(playersStore.get(player.playerId)),
      ]);
      const previous = cursor?.value ?? null;

      if (!observationMeaningfullyChanged(previous, player)) {
        await done;
        continue;
      }

      observationsStore.add({
        ...player,
        collectorTabId: state.collectorTabId,
        collectorRunId: state.collectorRunId,
      });
      playersStore.put({
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

      await done;
      saved += 1;
    }

    return saved;
  }

  async function getDatabaseStats() {
    const tx = state.db.transaction([APP.playersStore, APP.observationsStore], 'readonly');
    const playersCount = await requestResult(tx.objectStore(APP.playersStore).count());
    const observationsCount = await requestResult(tx.objectStore(APP.observationsStore).count());
    const healthTx = state.healthDb.transaction(APP.healthStore, 'readonly');
    const healthRecordsCount = await requestResult(
      healthTx.objectStore(APP.healthStore).count()
    );
    return { playersCount, observationsCount, healthRecordsCount };
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
    const observationCutoff = Date.now() - state.settings.keepDays * 86_400_000;
    const healthCutoff = Date.now() - APP.collectorHealthKeepDays * 86_400_000;
    const tx = state.db.transaction(APP.observationsStore, 'readwrite');
    const healthTx = state.healthDb.transaction(APP.healthStore, 'readwrite');
    const deleteBefore = (index, cutoff) => new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
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
    await Promise.all([
      deleteBefore(
        tx.objectStore(APP.observationsStore).index('byCapturedAt'),
        observationCutoff
      ),
      deleteBefore(
        healthTx.objectStore(APP.healthStore).index('byRecordedAt'),
        healthCutoff
      ),
    ]);
    await Promise.all([transactionDone(tx), transactionDone(healthTx)]);
  }

  async function performCapture({ manual = false } = {}) {
    if (!state.db) return;

    const players = discoverVisiblePlayers();
    const pageFingerprint = players
      .map((player) => `${player.playerId}:${player.activityStatus}:${player.lifeStatus}`)
      .sort()
      .join('|');
    const pageContentChanged = pageFingerprint !== state.lastPageFingerprint;
    if (pageContentChanged) state.lastPageContentChangeAt = Date.now();
    state.lastPageFingerprint = pageFingerprint;
    state.currentRows = players;
    state.lastCaptureAt = Date.now();
    state.lastCaptureCount = players.length;

    let saved = 0;
    if (players.length) saved = await saveObservations(players);

    await recordCollectorHealth('scan', {
      source: manual ? 'manual' : 'automatic',
      playersFound: players.length,
      observationsSaved: saved,
      pageContentChanged,
    });

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
        return !target?.closest?.(`#${APP.panelId}, #wih-export-viewer, #wih-history-viewer, #wih-health-viewer, #wih-intel-viewer, #wih-session-viewer, #wih-toast`);
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
      recordCollectorHealth('tick', { source: 'poll' }).catch(reportError);
      if (
        !state.settings.autoCaptureVisiblePage ||
        !pageLooksRelevant()
      ) {
        return;
      }

      capturePage().catch(reportError);
    }, APP.renderedPagePollMs);

    document.addEventListener('visibilitychange', () => {
      recordCollectorHealth('visibility', {
        source: document.hidden ? 'hidden' : 'visible',
      }).catch(reportError);
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
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      #${APP.panelId}.wih-dragging .wih-header { cursor: grabbing; }
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
      @media (max-width: 759px) {
        #${APP.panelId}.wih-collapsed {
          bottom: max(82px, calc(env(safe-area-inset-bottom) + 72px));
        }
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
        width: 100%;
        max-width: 100vw;
        z-index: 2147483646;
        overflow-x: hidden;
        overflow-y: auto;
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
      #wih-health-viewer {
        --wih-surface: #1b1e25;
        --wih-surface-2: #232731;
        --wih-border: rgba(255,255,255,.13);
        --wih-text: #f3f4f6;
        --wih-muted: #a7adb7;
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        overflow: auto;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        background: #111318;
        color: var(--wih-text);
        font: 13px/1.4 Arial, sans-serif;
      }
      #wih-health-viewer * { box-sizing: border-box; }
      #wih-health-viewer button { font: inherit; }
      #wih-health-viewer .wih-health-header {
        position: sticky;
        top: 0;
        z-index: 3;
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 56px;
        padding: 9px 12px;
        border-bottom: 1px solid var(--wih-border);
        background: rgba(17,19,24,.96);
      }
      #wih-health-viewer .wih-health-title { min-width: 0; flex: 1; }
      #wih-health-viewer .wih-health-title strong { display: block; font-size: 16px; }
      #wih-health-viewer .wih-muted { color: var(--wih-muted); font-size: 11px; }
      #wih-health-viewer .wih-health-close {
        min-height: 36px;
        padding: 7px 11px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface-2);
        color: var(--wih-text);
      }
      #wih-health-viewer .wih-health-content { display: grid; gap: 11px; max-width: 1040px; margin: 0 auto; padding: 12px; }
      #wih-health-viewer .wih-health-controls { display: grid; grid-template-columns: minmax(0,1fr) minmax(120px,.55fr); gap: 7px; }
      #wih-health-viewer .wih-health-controls select {
        width: 100%;
        min-height: 40px;
        padding: 7px 9px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface-2);
        color: var(--wih-text);
        font: inherit;
      }
      #wih-health-viewer .wih-health-actions { display: flex; flex-wrap: wrap; gap: 7px; }
      #wih-health-viewer .wih-health-action {
        min-height: 36px;
        padding: 7px 11px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface-2);
        color: var(--wih-text);
      }
      #wih-health-viewer .wih-health-card {
        padding: 11px;
        border: 1px solid var(--wih-border);
        border-radius: 11px;
        background: var(--wih-surface);
      }
      #wih-health-viewer .wih-health-state { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
      #wih-health-viewer .wih-health-state-dot { width: 13px; height: 13px; border-radius: 50%; background: #777d86; }
      #wih-health-viewer .wih-health-state-dot.is-awake { background: #33c774; box-shadow: 0 0 8px rgba(51,199,116,.7); }
      #wih-health-viewer .wih-health-state strong { font-size: 17px; }
      #wih-health-viewer .wih-health-stats { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
      #wih-health-viewer .wih-health-stat { padding: 8px; border-radius: 8px; background: var(--wih-surface-2); }
      #wih-health-viewer .wih-health-stat strong { display: block; font-size: 15px; }
      #wih-health-viewer .wih-health-bar {
        position: relative;
        height: 32px;
        overflow: hidden;
        margin-top: 9px;
        border: 1px solid var(--wih-border);
        border-radius: 8px;
        background: repeating-linear-gradient(135deg,#343840,#343840 5px,#292d34 5px,#292d34 10px);
      }
      #wih-health-viewer .wih-health-segment { position: absolute; top: 0; bottom: 0; min-width: 1px; background: #299a5c; }
      #wih-health-viewer .wih-health-event-list { display: grid; gap: 7px; margin-top: 9px; }
      #wih-health-viewer .wih-health-event { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; padding: 8px; border-radius: 8px; background: var(--wih-surface-2); }
      #wih-health-viewer .wih-health-event strong { text-transform: capitalize; }
      @media (min-width: 760px) {
        #wih-health-viewer .wih-health-stats { grid-template-columns: repeat(4, minmax(0,1fr)); }
      }
      #wih-intel-viewer {
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
        background: #111318;
        color: var(--wih-text);
        font: 13px/1.4 Arial, sans-serif;
      }
      #wih-intel-viewer * { box-sizing: border-box; max-width: 100%; }
      #wih-intel-viewer button,
      #wih-intel-viewer input,
      #wih-intel-viewer select { font: inherit; }
      #wih-intel-viewer .wih-intel-header {
        position: sticky;
        top: 0;
        z-index: 4;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        min-height: 56px;
        padding: 9px 12px;
        border-bottom: 1px solid var(--wih-border);
        background: rgba(17,19,24,.96);
        backdrop-filter: blur(10px);
      }
      #wih-intel-viewer .wih-intel-title { min-width: 0; flex: 1; }
      #wih-intel-viewer .wih-intel-title strong { display: block; font-size: 16px; }
      #wih-intel-viewer .wih-muted { color: var(--wih-muted); font-size: 11px; }
      #wih-intel-viewer .wih-intel-close,
      #wih-intel-viewer .wih-intel-action {
        min-height: 36px;
        padding: 7px 11px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface-2);
        color: var(--wih-text);
        text-decoration: none;
      }
      #wih-intel-viewer .wih-intel-action:disabled { opacity: .6; cursor: wait; }
      #wih-intel-viewer .wih-intel-context-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 7px;
        margin-top: 7px;
      }
      #wih-intel-viewer .wih-intel-content { display: grid; width: 100%; min-width: 0; gap: 11px; max-width: 1260px; margin: 0 auto; padding: 12px; }
      #wih-intel-viewer .wih-intel-content > *,
      #wih-intel-viewer .wih-intel-columns > * { min-width: 0; }
      #wih-intel-viewer .wih-intel-card {
        width: 100%;
        min-width: 0;
        padding: 11px;
        border: 1px solid var(--wih-border);
        border-radius: 11px;
        background: var(--wih-surface);
      }
      #wih-intel-viewer .wih-intel-stats { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 7px; }
      #wih-intel-viewer .wih-intel-stat { padding: 8px; border-radius: 8px; background: var(--wih-surface-2); }
      #wih-intel-viewer .wih-intel-stat strong { display: block; font-size: 17px; }
      #wih-intel-viewer .wih-intel-stat,
      #wih-intel-viewer .wih-target-metric,
      #wih-intel-viewer .wih-muted { overflow-wrap: anywhere; }
      #wih-intel-viewer .wih-intel-controls { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }
      #wih-intel-viewer .wih-intel-controls .wih-intel-search { grid-column: 1 / -1; }
      #wih-intel-viewer .wih-intel-controls input,
      #wih-intel-viewer .wih-intel-controls select {
        width: 100%;
        min-height: 40px;
        padding: 8px 9px;
        border: 1px solid var(--wih-border);
        border-radius: 9px;
        background: var(--wih-surface-2);
        color: var(--wih-text);
      }
      #wih-intel-viewer .wih-intel-columns { display: grid; min-width: 0; gap: 11px; }
      #wih-intel-viewer .wih-intel-list,
      #wih-intel-viewer .wih-intel-changes { display: grid; gap: 8px; margin-top: 9px; }
      #wih-intel-viewer .wih-target {
        width: 100%;
        min-width: 0;
        padding: 10px;
        border: 1px solid var(--wih-border);
        border-radius: 10px;
        background: var(--wih-surface-2);
      }
      #wih-intel-viewer .wih-target-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 9px; }
      #wih-intel-viewer .wih-target-name { min-width: 0; font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #wih-intel-viewer .wih-intel-pills { display: flex; min-width: 0; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
      #wih-intel-viewer .wih-intel-pill { padding: 3px 7px; border-radius: 99px; background: rgba(255,255,255,.08); text-transform: capitalize; font-size: 11px; font-weight: 700; }
      #wih-intel-viewer .wih-intel-pill.status-online { background: rgba(51,199,116,.2); color: #8ef0b7; }
      #wih-intel-viewer .wih-intel-pill.status-idle { background: rgba(242,185,73,.2); color: #ffd782; }
      #wih-intel-viewer .wih-intel-pill.status-hospital,
      #wih-intel-viewer .wih-intel-pill.status-jail,
      #wih-intel-viewer .wih-intel-pill.status-federal { background: rgba(228,78,78,.2); color: #ffaaaa; }
      #wih-intel-viewer .wih-intel-pill.status-traveling,
      #wih-intel-viewer .wih-intel-pill.status-returning,
      #wih-intel-viewer .wih-intel-pill.status-abroad { background: rgba(91,154,255,.2); color: #c4d7ff; }
      #wih-intel-viewer .wih-intel-pill.priority-ready { background: rgba(51,199,116,.24); color: #9bf4bf; }
      #wih-intel-viewer .wih-intel-pill.priority-watch { background: rgba(242,185,73,.2); color: #ffd782; }
      #wih-intel-viewer .wih-intel-pill.priority-unavailable { background: rgba(228,78,78,.18); color: #ffb1b1; }
      #wih-intel-viewer .wih-intel-pill.priority-stale { background: rgba(255,255,255,.08); color: #c3c7ce; }
      #wih-intel-viewer .wih-target-metrics { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; margin-top: 9px; }
      #wih-intel-viewer .wih-target-metric { padding: 7px; border-radius: 7px; background: rgba(0,0,0,.15); }
      #wih-intel-viewer .wih-target-metric strong { display: block; }
      #wih-intel-viewer .wih-confidence-high { color: #8ef0b7; }
      #wih-intel-viewer .wih-confidence-medium { color: #ffd782; }
      #wih-intel-viewer .wih-confidence-low { color: #c3c7ce; }
      #wih-intel-viewer .wih-target-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
      #wih-intel-viewer .wih-watchlist-grid { display: grid; gap: 7px; margin-top: 9px; }
      #wih-intel-viewer .wih-watch-target { display: grid; min-width: 0; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; padding: 9px; border-radius: 8px; background: var(--wih-surface-2); }
      #wih-intel-viewer .wih-changed-marker { color: #ffd782; font-size: 11px; font-weight: 700; }
      #wih-intel-viewer .wih-war-board { display: grid; width: 100%; min-width: 0; grid-auto-flow: column; grid-auto-columns: min(310px, calc(100% - 8px)); gap: 8px; overflow-x: auto; overscroll-behavior-x: contain; margin-top: 9px; padding-bottom: 4px; scroll-snap-type: x proximity; }
      #wih-intel-viewer .wih-faction-card { display: grid; min-width: 0; gap: 8px; padding: 10px; border: 1px solid var(--wih-border); border-radius: 10px; background: var(--wih-surface-2); scroll-snap-align: start; }
      #wih-intel-viewer .wih-faction-card.is-selected { border-color: var(--wih-accent); box-shadow: inset 0 0 0 1px rgba(255,122,89,.28); }
      #wih-intel-viewer .wih-faction-card-head { display: flex; min-width: 0; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 7px; }
      #wih-intel-viewer .wih-faction-card-name { min-width: 0; overflow: hidden; font-size: 15px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
      #wih-intel-viewer .wih-faction-metrics { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; }
      #wih-intel-viewer .wih-monitor-live { background: rgba(51,199,116,.24); color: #9bf4bf; }
      #wih-intel-viewer .wih-monitor-stale { background: rgba(242,185,73,.2); color: #ffd782; }
      #wih-intel-viewer .wih-monitor-unmonitored { background: rgba(255,255,255,.08); color: #c3c7ce; }
      #wih-intel-viewer .wih-monitor-warning { padding: 7px; border: 1px solid rgba(242,185,73,.35); border-radius: 7px; background: rgba(242,185,73,.1); color: #ffd782; font-size: 11px; }
      #wih-intel-viewer .wih-transition { display: grid; min-width: 0; grid-template-columns: minmax(0,1fr) auto; gap: 7px; padding: 8px; border-radius: 8px; background: var(--wih-surface-2); }
      #wih-intel-viewer .wih-transition strong { display: block; }
      #wih-intel-viewer .wih-intel-empty { padding: 20px 8px; color: var(--wih-muted); text-align: center; }
      #wih-intel-viewer.wih-intel-wide .wih-intel-stats { grid-template-columns: repeat(6,minmax(0,1fr)); }
      #wih-intel-viewer.wih-intel-wide .wih-intel-controls { grid-template-columns: minmax(180px,1.4fr) repeat(5,minmax(0,1fr)); }
      #wih-intel-viewer.wih-intel-wide .wih-intel-controls .wih-intel-search { grid-column: auto; }
      #wih-intel-viewer.wih-intel-wide .wih-intel-columns { grid-template-columns: minmax(0,1.7fr) minmax(260px,.8fr); align-items: start; }
      #wih-intel-viewer.wih-intel-wide .wih-intel-changes-card { position: sticky; top: 68px; }
      #wih-intel-viewer.wih-intel-wide .wih-target-metrics { grid-template-columns: repeat(4,minmax(0,1fr)); }
      #wih-intel-viewer:not(.wih-intel-wide) .wih-intel-header { gap: 6px; padding-inline: 9px; }
      #wih-intel-viewer:not(.wih-intel-wide) .wih-intel-header .wih-intel-action,
      #wih-intel-viewer:not(.wih-intel-wide) .wih-intel-header .wih-intel-close { min-height: 34px; padding: 6px 8px; }
      #wih-intel-viewer:not(.wih-intel-wide) .wih-intel-pills { justify-content: flex-start; }
      #wih-intel-viewer:not(.wih-intel-wide) .wih-watch-target { grid-template-columns: minmax(0,1fr); }
      #wih-intel-viewer:not(.wih-intel-wide) .wih-watch-target .wih-target-actions { justify-content: flex-start !important; }
      #wih-session-viewer { --wih-surface:#1b1e25; --wih-surface-2:#232731; --wih-border:rgba(255,255,255,.13); --wih-text:#f3f4f6; --wih-muted:#a7adb7; --wih-accent:#ff7a59; position:fixed; inset:0; z-index:2147483646; overflow:auto; padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); background:#111318; color:var(--wih-text); font:13px/1.4 Arial,sans-serif; }
      #wih-session-viewer * { box-sizing:border-box; }
      #wih-session-viewer button, #wih-session-viewer input { font:inherit; }
      #wih-session-viewer .wih-session-header { position:sticky; top:0; z-index:4; display:flex; align-items:center; gap:10px; min-height:56px; padding:9px 12px; border-bottom:1px solid var(--wih-border); background:rgba(17,19,24,.96); }
      #wih-session-viewer .wih-session-title { min-width:0; flex:1; }
      #wih-session-viewer .wih-session-title strong { display:block; font-size:16px; }
      #wih-session-viewer .wih-muted { color:var(--wih-muted); font-size:11px; }
      #wih-session-viewer .wih-session-content { display:grid; gap:11px; max-width:1100px; margin:0 auto; padding:12px; }
      #wih-session-viewer .wih-session-card { padding:11px; border:1px solid var(--wih-border); border-radius:11px; background:var(--wih-surface); }
      #wih-session-viewer .wih-session-action { min-height:36px; padding:7px 11px; border:1px solid var(--wih-border); border-radius:9px; background:var(--wih-surface-2); color:var(--wih-text); }
      #wih-session-viewer .wih-session-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:9px; }
      #wih-session-viewer .wih-session-name { width:100%; min-height:40px; margin-top:9px; padding:7px 9px; border:1px solid var(--wih-border); border-radius:9px; background:var(--wih-surface-2); color:var(--wih-text); }
      #wih-session-viewer .wih-session-factions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin-top:9px; }
      #wih-session-viewer .wih-session-check { display:flex; align-items:center; gap:7px; padding:8px; border-radius:8px; background:var(--wih-surface-2); }
      #wih-session-viewer .wih-session-list { display:grid; gap:7px; margin-top:9px; }
      #wih-session-viewer .wih-session-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; padding:9px; border-radius:8px; background:var(--wih-surface-2); }
      #wih-session-viewer .wih-report-chunk { display:grid; gap:7px; margin-top:9px; }
      #wih-session-viewer textarea { width:100%; min-height:260px; resize:vertical; padding:9px; border:1px solid var(--wih-border); border-radius:8px; background:#0e1013; color:#e8eaed; font:12px/1.4 monospace; }
      @media (min-width:760px) { #wih-session-viewer .wih-session-factions { grid-template-columns:repeat(4,minmax(0,1fr)); } }
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
    window.addEventListener('resize', () => {
      if (!state.settings.hudPosition || !panel.isConnected) return;
      applyHudPosition(panel, state.settings.hudPosition, { persist: true });
    });
    return panel;
  }

  function clampHudPosition(panel, position) {
    const margin = 8;
    const rect = panel.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = Number(viewport?.offsetLeft || 0);
    const viewportTop = Number(viewport?.offsetTop || 0);
    const viewportWidth = Number(
      viewport?.width || document.documentElement.clientWidth || window.innerWidth
    );
    const viewportHeight = Number(
      viewport?.height || document.documentElement.clientHeight || window.innerHeight
    );
    const requestedX = Number(position?.x);
    const requestedY = Number(position?.y);
    const minX = viewportLeft + margin;
    const minY = viewportTop + margin;
    const maxX = Math.max(minX, viewportLeft + viewportWidth - rect.width - margin);
    const maxY = Math.max(minY, viewportTop + viewportHeight - rect.height - margin);
    return {
      x: Math.min(maxX, Math.max(minX, Number.isFinite(requestedX) ? requestedX : rect.left)),
      y: Math.min(maxY, Math.max(minY, Number.isFinite(requestedY) ? requestedY : rect.top)),
      space: 'rendered-v1',
    };
  }

  function applyHudPosition(panel, position = state.settings.hudPosition, { persist = false } = {}) {
    if (position && position.space !== 'rendered-v1') {
      state.settings.hudPosition = null;
      saveSettings();
      position = null;
    }
    if (!position || !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('right');
      panel.style.removeProperty('bottom');
      panel.classList.remove('wih-positioned');
      return null;
    }

    const clamped = clampHudPosition(panel, position);
    if (!panel.classList.contains('wih-positioned')) {
      const renderedStart = panel.getBoundingClientRect();
      panel.style.left = '0px';
      panel.style.top = '0px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      const renderedOrigin = panel.getBoundingClientRect();
      const scaleX = renderedOrigin.width / Math.max(1, panel.offsetWidth);
      const scaleY = renderedOrigin.height / Math.max(1, panel.offsetHeight);
      panel.style.left = `${(renderedStart.left - renderedOrigin.left) / Math.max(.01, scaleX)}px`;
      panel.style.top = `${(renderedStart.top - renderedOrigin.top) / Math.max(.01, scaleY)}px`;
      panel.classList.add('wih-positioned');
    }

    for (let pass = 0; pass < 2; pass += 1) {
      const rendered = panel.getBoundingClientRect();
      const scaleX = rendered.width / Math.max(1, panel.offsetWidth);
      const scaleY = rendered.height / Math.max(1, panel.offsetHeight);
      const cssLeft = Number.parseFloat(panel.style.left) || 0;
      const cssTop = Number.parseFloat(panel.style.top) || 0;
      panel.style.left = `${cssLeft + (clamped.x - rendered.left) / Math.max(.01, scaleX)}px`;
      panel.style.top = `${cssTop + (clamped.y - rendered.top) / Math.max(.01, scaleY)}px`;
    }
    if (persist) {
      state.settings.hudPosition = clamped;
      saveSettings();
    }
    return clamped;
  }

  function bindHudDragging(panel) {
    const handle = panel.querySelector('[data-drag-handle]');
    if (!handle) return;
    let drag = null;

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button, a, input, select')) return;
      const rect = panel.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        grabX: event.clientX - rect.left,
        grabY: event.clientY - rect.top,
        currentX: event.clientX,
        currentY: event.clientY,
      };
      panel.classList.add('wih-dragging');
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.currentX = event.clientX;
      drag.currentY = event.clientY;
      applyHudPosition(panel, {
        x: event.clientX - drag.grabX,
        y: event.clientY - drag.grabY,
        space: 'rendered-v1',
      });
      event.preventDefault();
    });

    const finishDrag = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const clientX = Number.isFinite(event.clientX) ? event.clientX : drag.currentX;
      const clientY = Number.isFinite(event.clientY) ? event.clientY : drag.currentY;
      const position = applyHudPosition(panel, {
        x: clientX - drag.grabX,
        y: clientY - drag.grabY,
        space: 'rendered-v1',
      });
      drag = null;
      panel.classList.remove('wih-dragging');
      if (position) {
        state.settings.hudPosition = position;
        saveSettings();
      }
    };
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
  }

  async function renderPanel() {
    const panel = ensurePanel();
    const [stats, latestHealth] = await Promise.all([
      getDatabaseStats(),
      getLatestCollectorHealthRecord(),
    ]);
    const collectorRecentlyAwake = Boolean(
      latestHealth && Date.now() - latestHealth.recordedAt <= APP.collectorTickGapThresholdMs
    );

    panel.classList.toggle('wih-collapsed', state.settings.collapsed);

    const rows = state.currentRows.slice(0, APP.maxRowsInPanel);
    const online = state.currentRows.filter((row) => row.activityStatus === 'online').length;
    const offline = state.currentRows.filter((row) => row.activityStatus === 'offline').length;

    panel.innerHTML = `
      <div class="wih-header" data-drag-handle title="Drag to move">
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
          <button class="wih-button wih-primary" data-action="intelligence">Intelligence</button>
          <button class="wih-button wih-primary" data-action="sessions">War sessions</button>
          <button class="wih-button wih-primary" data-action="history">History</button>
          <button class="wih-button" data-action="health">Collector health</button>
          <button class="wih-button" data-action="copy-export">Copy export</button>
          <button class="wih-button" data-action="view-export">View export</button>
          <button class="wih-button" data-action="import">Import data</button>
        </div>

        <div class="wih-note">
          Local archive: ${stats.playersCount} players · ${stats.observationsCount} observations<br>
          Last scan: ${escapeHtml(formatDateTime(state.lastCaptureAt))}<br>
          Collector: ${collectorRecentlyAwake ? 'awake' : 'no recent wake-up'} · ${escapeHtml(formatAgo(latestHealth?.recordedAt))}
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
          <button class="wih-button" data-action="purge-old">Purge expired local history</button>
          <button class="wih-button" data-action="reset-position">Reset HUD position</button>
          <button class="wih-button" data-action="share-export">Share export</button>
          <button class="wih-button" data-action="download-export">Download export file</button>
          <button class="wih-button" data-action="diagnostics">Copy diagnostics</button>
          <button class="wih-button" data-action="erase">Erase all local WIH data</button>
          <div class="wih-note">
            v${escapeHtml(APP.version)} records only information already rendered on the page. It does not make API calls,
            navigate, click, attack, or submit game actions.
          </div>
        </div>
      </div>
    `;

    applyHudPosition(panel);
    bindPanelEvents(panel);
    bindHudDragging(panel);
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

    panel.querySelector('[data-action="intelligence"]')?.addEventListener('click', () => {
      openFactionIntelligenceViewer().catch(reportError);
    });

    panel.querySelector('[data-action="sessions"]')?.addEventListener('click', () => {
      openWarSessionsViewer().catch(reportError);
    });

    panel.querySelector('[data-action="health"]')?.addEventListener('click', () => {
      openCollectorHealthViewer().catch(reportError);
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
      toast('Expired observation and collector-health history purged.');
    });

    panel.querySelector('[data-action="reset-position"]')?.addEventListener('click', () => {
      state.settings.hudPosition = null;
      saveSettings();
      applyHudPosition(panel, null);
      toast('HUD position reset.');
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
    let ignoredUnknownObservations = 0;

    for (const observation of sorted) {
      if (
        observation.activityStatus === 'unknown' &&
        observation.lifeStatus === 'unknown'
      ) {
        ignoredUnknownObservations += 1;
        continue;
      }
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

    return { observations, ignoredLegacyDuplicates, ignoredUnknownObservations };
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

  function formatAgo(timestamp, now = Date.now()) {
    if (!timestamp) return 'never';
    const elapsed = Math.max(0, now - Number(timestamp));
    if (elapsed < 60_000) return 'just now';
    return `${formatDuration(elapsed)} ago`;
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

  async function openHistoryViewer({ selectedPlayerId = null } = {}) {
    document.getElementById('wih-history-viewer')?.remove();

    const players = (await getAllFromStore(APP.playersStore))
      .map((player) => ({
        ...player,
        name: cleanStoredName(player.name, player.playerId),
        latestActivityStatus: player.latestActivityStatus || player.latestStatus || 'unknown',
        latestLifeStatus: player.latestLifeStatus || 'unknown',
      }))
      .filter(
        (player) =>
          player.latestActivityStatus !== 'unknown' || player.latestLifeStatus !== 'unknown'
      )
      .sort(
        (a, b) =>
          statusRank(a.latestActivityStatus) - statusRank(b.latestActivityStatus) ||
          a.name.localeCompare(b.name)
      );

    const currentFactionId = inferFactionId(location.href);
    const initialPlayer =
      players.find((player) => String(player.playerId) === String(selectedPlayerId)) ||
      players.find((player) => player.factionId === currentFactionId) ||
      players[0] || null;
    const viewerState = {
      players,
      selectedPlayerId: initialPlayer?.playerId || null,
      factionId: initialPlayer?.factionId && players.some((player) => player.factionId === initialPlayer.factionId)
        ? initialPlayer.factionId
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
            ${analysis.ignoredUnknownObservations ? ` · ${analysis.ignoredUnknownObservations} unusable unknown observation${analysis.ignoredUnknownObservations === 1 ? '' : 's'} ignored` : ''}
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

  function intelligenceConfidence(coveragePercent) {
    if (coveragePercent >= 75) return { label: 'high', className: 'high' };
    if (coveragePercent >= 40) return { label: 'medium', className: 'medium' };
    return { label: 'low', className: 'low' };
  }

  function intelligenceActionability(player, now = Date.now()) {
    const unavailableLifeStatuses = new Set([
      'hospital', 'jail', 'federal', 'fallen', 'traveling', 'returning', 'abroad',
    ]);
    const observationAge = player.lastObservedAt
      ? Math.max(0, now - Number(player.lastObservedAt))
      : Number.POSITIVE_INFINITY;
    const activeNow = player.activityStatus === 'online' || player.activityStatus === 'idle';
    const lifeOkay = player.lifeStatus === 'okay';
    const unavailable = unavailableLifeStatuses.has(player.lifeStatus);
    let score = 0;

    if (player.currentlyCovered) score += 15;
    if (observationAge <= 5 * 60_000) score += 15;
    else if (observationAge <= APP.coverageGapThresholdMs) score += 8;
    if (player.activityStatus === 'online') score += 30;
    else if (player.activityStatus === 'idle') score += 22;
    else if (player.activityStatus === 'offline') score += 5;
    if (lifeOkay) score += 25;
    if (player.recentlyActive) score += 5;
    score += Math.round(Math.min(10, player.coveragePercent / 10));

    let tier;
    let label;
    let reason;
    if (!player.currentlyCovered) {
      tier = 'stale';
      label = 'stale';
      reason = 'No observation within 15 minutes';
      score = Math.min(score, 20);
    } else if (unavailable) {
      tier = 'unavailable';
      label = 'unavailable';
      reason = `Latest observed condition is ${player.lifeStatus}`;
      score = Math.min(score, 25);
    } else if (activeNow && lifeOkay) {
      tier = 'ready';
      label = 'observed ready';
      reason = `Fresh ${player.activityStatus} + Okay observation`;
    } else {
      tier = 'watch';
      label = 'watch';
      reason = lifeOkay
        ? `Fresh ${player.activityStatus} + Okay observation`
        : `Fresh observation; condition is ${player.lifeStatus}`;
      score = Math.min(score, 69);
    }

    return { score: Math.max(0, Math.min(100, score)), tier, label, reason };
  }

  function buildFactionIntelligence(players, observations, now = Date.now()) {
    const observationsByPlayer = new Map();
    for (const observation of observations) {
      if (!observationsByPlayer.has(observation.playerId)) {
        observationsByPlayer.set(observation.playerId, []);
      }
      observationsByPlayer.get(observation.playerId).push(observation);
    }

    return players.map((player) => {
      const playerObservations = (observationsByPlayer.get(player.playerId) || [])
        .sort((a, b) => Number(a.capturedAt) - Number(b.capturedAt));
      const latest = playerObservations.at(-1);
      const activityStatus =
        latest?.activityStatus || player.latestActivityStatus || player.latestStatus || 'unknown';
      const lifeStatus = latest?.lifeStatus || player.latestLifeStatus || 'unknown';
      let lastOnlineAt = null;
      let lastActiveAt = null;
      const transitions = [];

      for (let index = 0; index < playerObservations.length; index += 1) {
        const observation = playerObservations[index];
        if (observation.activityStatus === 'online') lastOnlineAt = observation.capturedAt;
        if (observation.activityStatus === 'online' || observation.activityStatus === 'idle') {
          lastActiveAt = observation.capturedAt;
        }
        const previous = playerObservations[index - 1];
        if (!previous) continue;
        const activityChanged = previous.activityStatus !== observation.activityStatus;
        const lifeChanged = previous.lifeStatus !== observation.lifeStatus;
        if (!activityChanged && !lifeChanged) continue;
        transitions.push({
          playerId: player.playerId,
          name: cleanStoredName(player.name, player.playerId),
          capturedAt: observation.capturedAt,
          previousActivityStatus: previous.activityStatus,
          activityStatus: observation.activityStatus,
          previousLifeStatus: previous.lifeStatus,
          lifeStatus: observation.lifeStatus,
          activityChanged,
          lifeChanged,
        });
      }

      const timeline = buildPlayerTimeline(playerObservations, '24h', now);
      const coveragePercent = timeline.coveragePercent;
      const confidence = intelligenceConfidence(coveragePercent);
      const lastObservedAt = latest?.capturedAt || player.lastSeenAt || null;
      const currentlyCovered = Boolean(
        lastObservedAt && now - lastObservedAt <= APP.coverageGapThresholdMs
      );

      const intelligencePlayer = {
        playerId: player.playerId,
        name: cleanStoredName(player.name, player.playerId),
        profileUrl: player.profileUrl || `https://www.torn.com/profiles.php?XID=${player.playerId}`,
        factionId: player.factionId || latest?.factionId || 'unknown',
        activityStatus,
        lifeStatus,
        lastObservedAt,
        firstObservedAt: playerObservations[0]?.capturedAt || player.firstSeenAt || null,
        lastOnlineAt,
        lastActiveAt,
        recentlyActive: Boolean(lastActiveAt && now - lastActiveAt <= 60 * 60_000),
        currentlyCovered,
        coveragePercent,
        confidence,
        observationCount: playerObservations.length,
        transitions,
        latestTransition: transitions.at(-1) || null,
      };
      intelligencePlayer.actionability = intelligenceActionability(intelligencePlayer, now);
      return intelligencePlayer;
    });
  }

  function intelligenceTransitionText(transition) {
    const parts = [];
    if (transition.activityChanged) {
      parts.push(`${transition.previousActivityStatus} → ${transition.activityStatus}`);
    }
    if (transition.lifeChanged) {
      parts.push(`${transition.previousLifeStatus} → ${transition.lifeStatus}`);
    }
    return parts.join(' · ');
  }

  async function openFactionIntelligenceViewer() {
    document.getElementById('wih-intel-viewer')?.remove();
    async function loadIntelligenceData() {
      const [storedPlayers, rawObservations, collectorHealth] = await Promise.all([
        getAllFromStore(APP.playersStore),
        getAllFromStore(APP.observationsStore),
        getCollectorHealthRecords(Date.now() - 24 * 60 * 60_000),
      ]);
      const normalizedPlayers = storedPlayers.map((player) => ({
        ...player,
        name: cleanStoredName(player.name, player.playerId),
      }));
      const observationAnalysis = buildAnalysisObservations(rawObservations);
      const usablePlayerIds = new Set(
        observationAnalysis.observations.map((observation) => String(observation.playerId))
      );
      const nextIntelligence = buildFactionIntelligence(
        normalizedPlayers.filter((player) => usablePlayerIds.has(String(player.playerId))),
        observationAnalysis.observations
      );
      const nextFactionIds = [...new Set(
        nextIntelligence
          .map((player) => player.factionId)
          .filter((value) => value && value !== 'unknown')
      )].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
      return {
        intelligence: nextIntelligence,
        factionIds: nextFactionIds,
        factionHealthRecords: collectorHealth.filter(
          (record) => record.factionId && record.relevantPage
        ),
      };
    }

    let { intelligence, factionIds, factionHealthRecords } = await loadIntelligenceData();
    let lastUpdatedAt = Date.now();
    let refreshPromise = null;
    let refreshTimer = null;
    let previousTierByPlayer = new Map(
      intelligence.map((player) => [String(player.playerId), player.actionability.tier])
    );
    const changedPlayerIds = new Set();
    const priorityChanges = [];
    const currentFactionId = inferFactionId();
    const viewerState = {
      factionId: factionIds.includes(currentFactionId) ? currentFactionId : factionIds[0] || 'all',
      query: '',
      activity: 'all',
      life: 'all',
      priority: 'all',
      sort: 'priority',
    };

    const viewer = document.createElement('div');
    viewer.id = 'wih-intel-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'Faction intelligence');
    viewer.innerHTML = `
      <header class="wih-intel-header">
        <div class="wih-intel-title">
          <strong>Faction Intelligence</strong>
          <span class="wih-muted">Observed facts only · 24-hour coverage confidence · <span data-intel-updated>Updated just now</span></span>
        </div>
        <button type="button" class="wih-intel-action" data-intel-action="sessions">Sessions</button>
        <button type="button" class="wih-intel-action" data-intel-action="refresh">Refresh</button>
        <button type="button" class="wih-intel-close" data-intel-action="close">Close</button>
      </header>
      <main class="wih-intel-content"></main>
    `;
    document.body.append(viewer);
    const syncIntelligenceWidthMode = () => {
      const reportedWidths = [
        Number(window.innerWidth),
        Number(window.visualViewport?.width),
        Number(window.screen?.width),
      ].filter((width) => Number.isFinite(width) && width > 0);
      const narrowestReportedWidth = Math.min(...reportedWidths);
      const mobileWebView = /android|mobile|tornpda/i.test(navigator.userAgent);
      viewer.classList.toggle(
        'wih-intel-wide',
        !mobileWebView && narrowestReportedWidth >= 760
      );
    };
    syncIntelligenceWidthMode();
    window.addEventListener('resize', syncIntelligenceWidthMode);
    window.visualViewport?.addEventListener('resize', syncIntelligenceWidthMode);
    const content = viewer.querySelector('.wih-intel-content');
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function watchedPlayerIdSet() {
      return new Set((state.settings.watchedPlayerIds || []).map(String));
    }

    function toggleWatchedPlayer(playerId) {
      const normalizedId = String(playerId);
      const watched = watchedPlayerIdSet();
      if (watched.has(normalizedId)) watched.delete(normalizedId);
      else watched.add(normalizedId);
      state.settings.watchedPlayerIds = [...watched];
      saveSettings();
    }

    function watchedFactionIdSet() {
      return new Set((state.settings.watchedFactionIds || []).map(String));
    }

    function factionDisplayName(factionId) {
      const alias = normalizeWhitespace(state.settings.factionAliases?.[String(factionId)]);
      return alias || `Faction ${factionId}`;
    }

    function toggleWatchedFaction(factionId) {
      const normalizedId = String(factionId);
      const watched = watchedFactionIdSet();
      if (watched.has(normalizedId)) watched.delete(normalizedId);
      else watched.add(normalizedId);
      state.settings.watchedFactionIds = [...watched];
      saveSettings();
    }

    function nameFaction(factionId) {
      const normalizedId = String(factionId);
      const currentName = normalizeWhitespace(state.settings.factionAliases?.[normalizedId]);
      const enteredName = window.prompt(
        `Custom name for faction ${normalizedId}. Leave blank to remove it.`,
        currentName
      );
      if (enteredName === null) return false;
      const cleanedName = normalizeWhitespace(enteredName).slice(0, 60);
      state.settings.factionAliases = { ...(state.settings.factionAliases || {}) };
      if (cleanedName) state.settings.factionAliases[normalizedId] = cleanedName;
      else delete state.settings.factionAliases[normalizedId];
      saveSettings();
      return true;
    }

    function buildFactionSummaries() {
      const watchedPlayers = watchedPlayerIdSet();
      const watchedFactions = watchedFactionIdSet();
      const now = Date.now();
      return factionIds.map((factionId) => {
        const players = intelligence.filter((player) => player.factionId === factionId);
        const healthRecords = factionHealthRecords
          .filter((record) => String(record.factionId) === String(factionId))
          .sort((a, b) => Number(a.recordedAt) - Number(b.recordedAt));
        const healthAnalysis = analyzeCollectorHealth(healthRecords, now);
        const latestHealthAt = Number(healthAnalysis.latest?.recordedAt || 0);
        const latestSuccessfulScan = [...healthAnalysis.scans]
          .reverse()
          .find((record) => Number(record.playersFound || 0) > 0) || null;
        const recentHealthRecords = healthRecords.filter(
          (record) => now - Number(record.recordedAt || 0) <= APP.collectorTickGapThresholdMs
        );
        const activeTabCount = new Set(
          recentHealthRecords.map((record) => record.tabId || 'legacy-tab')
        ).size;
        const tabCount24h = new Set(
          healthRecords.map((record) => record.tabId || 'legacy-tab')
        ).size;
        const runCount24h = new Set(
          healthRecords.map((record) => record.runId || 'legacy-run')
        ).size;
        const monitorStatus = latestHealthAt && now - latestHealthAt <= APP.collectorTickGapThresholdMs
          ? 'live'
          : latestHealthAt
            ? 'stale'
            : 'unmonitored';
        const latestObservedAt = Math.max(
          0,
          ...players.map((player) => Number(player.lastObservedAt || 0))
        );
        const averageCoverage = players.length
          ? Math.round(
              players.reduce((sum, player) => sum + player.coveragePercent, 0) / players.length
            )
          : 0;
        return {
          factionId,
          name: factionDisplayName(factionId),
          pinned: watchedFactions.has(String(factionId)),
          playerCount: players.length,
          coveredCount: players.filter((player) => player.currentlyCovered).length,
          readyCount: players.filter((player) => player.actionability.tier === 'ready').length,
          watchedTargetCount: players.filter((player) => watchedPlayers.has(String(player.playerId))).length,
          averageCoverage,
          latestObservedAt,
          monitorStatus,
          monitorLabel: monitorStatus === 'live'
            ? 'actively monitored'
            : monitorStatus === 'stale'
              ? 'collector stale'
              : 'not monitored',
          latestHealthAt: latestHealthAt || null,
          latestScanAt: healthAnalysis.latestScan?.recordedAt || null,
          latestSuccessfulScanAt: latestSuccessfulScan?.recordedAt || null,
          activeTabCount,
          tabCount24h,
          runCount24h,
          longestGapMs: healthAnalysis.longestGap?.durationMs || 0,
        };
      }).sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          Number(b.factionId === viewerState.factionId) - Number(a.factionId === viewerState.factionId) ||
          b.latestObservedAt - a.latestObservedAt ||
          a.name.localeCompare(b.name)
      );
    }

    function factionPlayers() {
      return intelligence.filter(
        (player) => viewerState.factionId === 'all' || player.factionId === viewerState.factionId
      );
    }

    function filteredPlayers() {
      const query = viewerState.query.toLowerCase();
      const filtered = factionPlayers().filter((player) => {
        const queryMatches =
          !query || player.name.toLowerCase().includes(query) || String(player.playerId).includes(query);
        const activityMatches =
          viewerState.activity === 'all' ||
          player.activityStatus === viewerState.activity ||
          (viewerState.activity === 'recent' && player.recentlyActive);
        const lifeMatches =
          viewerState.life === 'all' ||
          player.lifeStatus === viewerState.life ||
          (viewerState.life === 'other' && !['okay', 'hospital', 'jail', 'traveling', 'returning', 'abroad'].includes(player.lifeStatus));
        const priorityMatches =
          viewerState.priority === 'all' || player.actionability.tier === viewerState.priority;
        return queryMatches && activityMatches && lifeMatches && priorityMatches;
      });

      return filtered.sort((a, b) => {
        if (viewerState.sort === 'name') return a.name.localeCompare(b.name);
        if (viewerState.sort === 'coverage') {
          return b.coveragePercent - a.coveragePercent || a.name.localeCompare(b.name);
        }
        if (viewerState.sort === 'recent') {
          return Number(b.lastActiveAt || 0) - Number(a.lastActiveAt || 0) || a.name.localeCompare(b.name);
        }
        return (
          b.actionability.score - a.actionability.score ||
          Number(b.lastActiveAt || 0) - Number(a.lastActiveAt || 0) ||
          b.coveragePercent - a.coveragePercent ||
          a.name.localeCompare(b.name)
        );
      });
    }

    function renderIntelligence() {
      const allFactionPlayers = factionPlayers();
      const visiblePlayers = filteredPlayers();
      const factionSummaries = buildFactionSummaries();
      const pinnedFactionCount = factionSummaries.filter((faction) => faction.pinned).length;
      const watchedIds = watchedPlayerIdSet();
      const watchedPlayers = allFactionPlayers
        .filter((player) => watchedIds.has(String(player.playerId)))
        .sort(
          (a, b) =>
            b.actionability.score - a.actionability.score || a.name.localeCompare(b.name)
        );
      const visiblePriorityChanges = priorityChanges
        .filter(
          (change) =>
            viewerState.factionId === 'all' || change.factionId === viewerState.factionId
        )
        .slice(0, 12);
      const observedReady = allFactionPlayers.filter((player) => player.actionability.tier === 'ready').length;
      const online = allFactionPlayers.filter((player) => player.currentlyCovered && player.activityStatus === 'online').length;
      const idle = allFactionPlayers.filter((player) => player.currentlyCovered && player.activityStatus === 'idle').length;
      const recentlyActive = allFactionPlayers.filter((player) => player.recentlyActive).length;
      const hospital = allFactionPlayers.filter((player) => player.lifeStatus === 'hospital').length;
      const traveling = allFactionPlayers.filter((player) => ['traveling', 'returning', 'abroad'].includes(player.lifeStatus)).length;
      const averageCoverage = allFactionPlayers.length
        ? Math.round(allFactionPlayers.reduce((sum, player) => sum + player.coveragePercent, 0) / allFactionPlayers.length)
        : 0;
      const recentTransitions = allFactionPlayers
        .flatMap((player) => player.transitions)
        .sort((a, b) => Number(b.capturedAt) - Number(a.capturedAt))
        .slice(0, 15);

      content.innerHTML = `
        <section class="wih-intel-card">
          <div class="wih-intel-stats">
            <div class="wih-intel-stat"><strong>${online}</strong><span class="wih-muted">covered online</span></div>
            <div class="wih-intel-stat"><strong>${idle}</strong><span class="wih-muted">covered idle</span></div>
            <div class="wih-intel-stat"><strong>${observedReady}</strong><span class="wih-muted">observed ready now</span></div>
            <div class="wih-intel-stat"><strong>${hospital}</strong><span class="wih-muted">latest hospital</span></div>
            <div class="wih-intel-stat"><strong>${traveling}</strong><span class="wih-muted">latest travel/abroad</span></div>
            <div class="wih-intel-stat"><strong>${averageCoverage}%</strong><span class="wih-muted">average 24h coverage</span></div>
          </div>
        </section>

        <section class="wih-intel-card">
          <strong>Multi-faction war board</strong>
          <div class="wih-muted">${factionSummaries.length} observed faction${factionSummaries.length === 1 ? '' : 's'} · ${pinnedFactionCount} pinned · swipe horizontally</div>
          <div class="wih-war-board">
            ${factionSummaries.length ? factionSummaries.map((faction) => `
              <article class="wih-faction-card ${viewerState.factionId === faction.factionId ? 'is-selected' : ''}">
                <div class="wih-faction-card-head">
                  <div style="min-width:0">
                    <div class="wih-faction-card-name">${escapeHtml(faction.name)}</div>
                    <div class="wih-muted">ID ${escapeHtml(faction.factionId)} · ${faction.playerCount} observed players</div>
                  </div>
                  <div class="wih-intel-pills">
                    <span class="wih-intel-pill wih-monitor-${escapeHtml(faction.monitorStatus)}">${escapeHtml(faction.monitorLabel)}</span>
                    <span class="wih-intel-pill ${faction.pinned ? 'priority-watch' : ''}">${faction.pinned ? '★ pinned' : 'observed'}</span>
                  </div>
                </div>
                <div class="wih-faction-metrics">
                  <div class="wih-target-metric"><strong>${faction.readyCount}</strong><span class="wih-muted">observed ready</span></div>
                  <div class="wih-target-metric"><strong>${faction.coveredCount}/${faction.playerCount}</strong><span class="wih-muted">currently covered</span></div>
                  <div class="wih-target-metric"><strong>${faction.watchedTargetCount}</strong><span class="wih-muted">watched targets</span></div>
                  <div class="wih-target-metric"><strong>${faction.averageCoverage}%</strong><span class="wih-muted">average 24h coverage</span></div>
                </div>
                <div class="wih-muted">
                  Latest observation ${escapeHtml(formatAgo(faction.latestObservedAt))} · collector wake ${escapeHtml(formatAgo(faction.latestHealthAt))}<br>
                  Last faction scan ${escapeHtml(formatAgo(faction.latestSuccessfulScanAt))} · ${faction.activeTabCount} active / ${faction.tabCount24h} tab${faction.tabCount24h === 1 ? '' : 's'} · ${faction.runCount24h} run${faction.runCount24h === 1 ? '' : 's'} in 24h
                  ${faction.longestGapMs >= APP.collectorTickGapThresholdMs ? `<br>Longest measured collector gap: ${escapeHtml(formatDuration(faction.longestGapMs))}` : ''}
                </div>
                ${faction.pinned && faction.monitorStatus !== 'live' ? `<div class="wih-monitor-warning">Pinned faction has no collector tab reporting within ${escapeHtml(formatDuration(APP.collectorTickGapThresholdMs))}.</div>` : ''}
                <div class="wih-target-actions" style="margin-top:0">
                  <button type="button" class="wih-intel-action" data-intel-select-faction="${escapeHtml(faction.factionId)}">${viewerState.factionId === faction.factionId ? 'Selected' : 'Select'}</button>
                  <button type="button" class="wih-intel-action" data-intel-watch-faction="${escapeHtml(faction.factionId)}">${faction.pinned ? 'Unpin' : 'Pin'}</button>
                  <button type="button" class="wih-intel-action" data-intel-name-faction="${escapeHtml(faction.factionId)}">Name</button>
                  <a class="wih-intel-action" href="https://www.torn.com/factions.php?step=profile&amp;ID=${encodeURIComponent(faction.factionId)}">Open</a>
                </div>
              </article>
            `).join('') : '<div class="wih-intel-empty">Capture faction pages to populate the war board.</div>'}
          </div>
        </section>

        <section class="wih-intel-card">
          <div class="wih-intel-controls">
            <input class="wih-intel-search" type="search" data-intel-query placeholder="Search name or ID" value="${escapeHtml(viewerState.query)}" aria-label="Search faction players">
            <select data-intel-faction aria-label="Faction">
              <option value="all" ${viewerState.factionId === 'all' ? 'selected' : ''}>All factions</option>
              ${factionIds.map((factionId) => `<option value="${escapeHtml(factionId)}" ${viewerState.factionId === factionId ? 'selected' : ''}>${escapeHtml(factionDisplayName(factionId))}</option>`).join('')}
            </select>
            <select data-intel-activity aria-label="Activity filter">
              <option value="all" ${viewerState.activity === 'all' ? 'selected' : ''}>All activity</option>
              <option value="online" ${viewerState.activity === 'online' ? 'selected' : ''}>Online</option>
              <option value="idle" ${viewerState.activity === 'idle' ? 'selected' : ''}>Idle</option>
              <option value="offline" ${viewerState.activity === 'offline' ? 'selected' : ''}>Offline</option>
              <option value="recent" ${viewerState.activity === 'recent' ? 'selected' : ''}>Active within 1h</option>
            </select>
            <select data-intel-life aria-label="Life-status filter">
              <option value="all" ${viewerState.life === 'all' ? 'selected' : ''}>All conditions</option>
              <option value="okay" ${viewerState.life === 'okay' ? 'selected' : ''}>Okay</option>
              <option value="hospital" ${viewerState.life === 'hospital' ? 'selected' : ''}>Hospital</option>
              <option value="jail" ${viewerState.life === 'jail' ? 'selected' : ''}>Jail</option>
              <option value="traveling" ${viewerState.life === 'traveling' ? 'selected' : ''}>Traveling</option>
              <option value="returning" ${viewerState.life === 'returning' ? 'selected' : ''}>Returning</option>
              <option value="abroad" ${viewerState.life === 'abroad' ? 'selected' : ''}>Abroad</option>
              <option value="other" ${viewerState.life === 'other' ? 'selected' : ''}>Other/unknown</option>
            </select>
            <select data-intel-sort aria-label="Sort players">
              <option value="priority" ${viewerState.sort === 'priority' ? 'selected' : ''}>Observed priority</option>
              <option value="recent" ${viewerState.sort === 'recent' ? 'selected' : ''}>Most recently active</option>
              <option value="coverage" ${viewerState.sort === 'coverage' ? 'selected' : ''}>Best coverage</option>
              <option value="name" ${viewerState.sort === 'name' ? 'selected' : ''}>Name</option>
            </select>
            <select data-intel-priority aria-label="Observed priority filter">
              <option value="all" ${viewerState.priority === 'all' ? 'selected' : ''}>All priorities</option>
              <option value="ready" ${viewerState.priority === 'ready' ? 'selected' : ''}>Observed ready</option>
              <option value="watch" ${viewerState.priority === 'watch' ? 'selected' : ''}>Watch</option>
              <option value="unavailable" ${viewerState.priority === 'unavailable' ? 'selected' : ''}>Unavailable</option>
              <option value="stale" ${viewerState.priority === 'stale' ? 'selected' : ''}>Stale/no coverage</option>
            </select>
          </div>
          <div class="wih-intel-context-row">
            <div class="wih-muted">Showing ${visiblePlayers.length} of ${allFactionPlayers.length} players. “Observed ready” means currently covered, online/idle, and Okay; it is not an attack guarantee. Score uses only freshness, activity, condition, recent activity, and coverage confidence.</div>
            ${viewerState.factionId === 'all' ? '' : `<a class="wih-intel-action" href="https://www.torn.com/factions.php?step=profile&amp;ID=${encodeURIComponent(viewerState.factionId)}">Open faction ${escapeHtml(viewerState.factionId)}</a>`}
          </div>
        </section>

        <section class="wih-intel-card">
          <strong>Watched targets</strong>
          <div class="wih-muted">Persistent pins · visual alerts while Intelligence is open</div>
          <div class="wih-watchlist-grid">
            ${watchedPlayers.length ? watchedPlayers.map((player) => `
              <div class="wih-watch-target">
                <div style="min-width:0">
                  <div class="wih-target-name">${escapeHtml(player.name)}</div>
                  <div class="wih-intel-pills" style="justify-content:flex-start;margin-top:5px">
                    <span class="wih-intel-pill priority-${escapeHtml(player.actionability.tier)}">${escapeHtml(player.actionability.label)} · ${player.actionability.score}</span>
                    <span class="wih-intel-pill status-${escapeHtml(player.activityStatus)}">${escapeHtml(player.activityStatus)}</span>
                    <span class="wih-intel-pill status-${escapeHtml(player.lifeStatus)}">${escapeHtml(player.lifeStatus)}</span>
                  </div>
                  ${changedPlayerIds.has(String(player.playerId)) ? '<div class="wih-changed-marker" style="margin-top:5px">Changed since Intelligence opened</div>' : ''}
                </div>
                <div class="wih-target-actions" style="justify-content:flex-end;margin-top:0">
                  <button type="button" class="wih-intel-action" data-intel-history="${escapeHtml(player.playerId)}">History</button>
                  <a class="wih-intel-action" href="${escapeHtml(player.profileUrl)}">Profile</a>
                  ${player.factionId && player.factionId !== 'unknown' ? `<a class="wih-intel-action" href="https://www.torn.com/factions.php?step=profile&amp;ID=${encodeURIComponent(player.factionId)}">Faction</a>` : ''}
                  <button type="button" class="wih-intel-action" data-intel-watch="${escapeHtml(player.playerId)}">Unpin</button>
                </div>
              </div>
            `).join('') : '<div class="wih-intel-empty">Pin a player from the observed roster to add them here.</div>'}
          </div>
        </section>

        <div class="wih-intel-columns">
          <section class="wih-intel-card">
            <strong>Observed roster</strong>
            <div class="wih-intel-list">
              ${visiblePlayers.length ? visiblePlayers.map((player) => `
                <article class="wih-target">
                  <div class="wih-target-head">
                    <div style="min-width:0">
                      <div class="wih-target-name">${escapeHtml(player.name)}</div>
                      <div class="wih-muted">${escapeHtml(player.playerId)} · ${player.observationCount} usable observations</div>
                      ${changedPlayerIds.has(String(player.playerId)) ? '<div class="wih-changed-marker">Changed since opened</div>' : ''}
                    </div>
                    <div class="wih-intel-pills">
                      <span class="wih-intel-pill priority-${escapeHtml(player.actionability.tier)}">${escapeHtml(player.actionability.label)} · ${player.actionability.score}</span>
                      <span class="wih-intel-pill status-${escapeHtml(player.activityStatus)}">${escapeHtml(player.activityStatus)}</span>
                      <span class="wih-intel-pill status-${escapeHtml(player.lifeStatus)}">${escapeHtml(player.lifeStatus)}</span>
                      ${player.currentlyCovered ? '' : '<span class="wih-intel-pill">no current coverage</span>'}
                    </div>
                  </div>
                  <div class="wih-muted" style="margin-top:7px">Priority evidence: ${escapeHtml(player.actionability.reason)}</div>
                  <div class="wih-target-metrics">
                    <div class="wih-target-metric"><strong>${escapeHtml(formatAgo(player.lastOnlineAt))}</strong><span class="wih-muted">last observed online</span></div>
                    <div class="wih-target-metric"><strong>${escapeHtml(formatAgo(player.lastObservedAt))}</strong><span class="wih-muted">last observation</span></div>
                    <div class="wih-target-metric"><strong>${player.coveragePercent}%</strong><span class="wih-muted">24h coverage</span></div>
                    <div class="wih-target-metric"><strong class="wih-confidence-${player.confidence.className}">${escapeHtml(player.confidence.label)}</strong><span class="wih-muted">confidence</span></div>
                  </div>
                  <div class="wih-muted" style="margin-top:7px">Latest change: ${player.latestTransition ? `${escapeHtml(intelligenceTransitionText(player.latestTransition))} · ${escapeHtml(formatAgo(player.latestTransition.capturedAt))}` : 'none observed'}</div>
                  <div class="wih-target-actions">
                    <button type="button" class="wih-intel-action" data-intel-watch="${escapeHtml(player.playerId)}">${watchedIds.has(String(player.playerId)) ? '★ Pinned' : '☆ Pin'}</button>
                    <button type="button" class="wih-intel-action" data-intel-history="${escapeHtml(player.playerId)}">History</button>
                    <a class="wih-intel-action" href="${escapeHtml(player.profileUrl)}">Profile</a>
                    ${player.factionId && player.factionId !== 'unknown' ? `<a class="wih-intel-action" href="https://www.torn.com/factions.php?step=profile&amp;ID=${encodeURIComponent(player.factionId)}">Faction</a>` : ''}
                  </div>
                </article>
              `).join('') : '<div class="wih-intel-empty">No players match these filters.</div>'}
            </div>
          </section>

          <section class="wih-intel-card wih-intel-changes-card">
            <strong>Priority changes while open</strong>
            <div class="wih-muted">Detected while this Intelligence window is open</div>
            <div class="wih-intel-changes">
              ${visiblePriorityChanges.length ? visiblePriorityChanges.map((change) => `
                <div class="wih-transition">
                  <div>
                    <strong>${escapeHtml(change.name)}${change.watched ? ' ★' : ''}</strong>
                    <div class="wih-muted">${escapeHtml(change.from)} → ${escapeHtml(change.to)}</div>
                  </div>
                  <time class="wih-muted">${escapeHtml(formatAgo(change.changedAt))}</time>
                </div>
              `).join('') : '<div class="wih-intel-empty">No priority changes detected since opening.</div>'}
            </div>
            <div style="height:10px"></div>
            <strong>Recent observed changes</strong>
            <div class="wih-muted">Newest first · observations, not predictions</div>
            <div class="wih-intel-changes">
              ${recentTransitions.length ? recentTransitions.map((transition) => `
                <div class="wih-transition">
                  <div>
                    <strong>${escapeHtml(transition.name)}</strong>
                    <div class="wih-muted">${escapeHtml(intelligenceTransitionText(transition))}</div>
                  </div>
                  <time class="wih-muted">${escapeHtml(formatAgo(transition.capturedAt))}</time>
                </div>
              `).join('') : '<div class="wih-intel-empty">No status changes have been observed for this faction.</div>'}
            </div>
          </section>
        </div>
      `;

      content.querySelector('[data-intel-query]')?.addEventListener('input', (event) => {
        viewerState.query = event.currentTarget.value;
        renderIntelligence();
        const search = content.querySelector('[data-intel-query]');
        search?.focus();
        search?.setSelectionRange?.(viewerState.query.length, viewerState.query.length);
      });
      for (const [selector, key] of [
        ['[data-intel-faction]', 'factionId'],
        ['[data-intel-activity]', 'activity'],
        ['[data-intel-life]', 'life'],
        ['[data-intel-priority]', 'priority'],
        ['[data-intel-sort]', 'sort'],
      ]) {
        content.querySelector(selector)?.addEventListener('change', (event) => {
          viewerState[key] = event.currentTarget.value;
          renderIntelligence();
        });
      }
      content.querySelectorAll('[data-intel-select-faction]').forEach((button) => {
        button.addEventListener('click', () => {
          viewerState.factionId = button.dataset.intelSelectFaction;
          renderIntelligence();
        });
      });
      content.querySelectorAll('[data-intel-watch-faction]').forEach((button) => {
        button.addEventListener('click', () => {
          const boardScrollLeft = content.querySelector('.wih-war-board')?.scrollLeft || 0;
          toggleWatchedFaction(button.dataset.intelWatchFaction);
          renderIntelligence();
          const board = content.querySelector('.wih-war-board');
          if (board) board.scrollLeft = boardScrollLeft;
        });
      });
      content.querySelectorAll('[data-intel-name-faction]').forEach((button) => {
        button.addEventListener('click', () => {
          const boardScrollLeft = content.querySelector('.wih-war-board')?.scrollLeft || 0;
          if (!nameFaction(button.dataset.intelNameFaction)) return;
          renderIntelligence();
          const board = content.querySelector('.wih-war-board');
          if (board) board.scrollLeft = boardScrollLeft;
        });
      });
      content.querySelectorAll('[data-intel-watch]').forEach((button) => {
        button.addEventListener('click', () => {
          const preservedScrollTop = viewer.scrollTop;
          toggleWatchedPlayer(button.dataset.intelWatch);
          renderIntelligence();
          viewer.scrollTop = preservedScrollTop;
        });
      });
      content.querySelectorAll('[data-intel-history]').forEach((button) => {
        button.addEventListener('click', () => {
          const playerId = button.dataset.intelHistory;
          closeViewer();
          openHistoryViewer({ selectedPlayerId: playerId }).catch(reportError);
        });
      });
    }

    function updateRefreshLabel() {
      const label = viewer.querySelector('[data-intel-updated]');
      if (label) label.textContent = `Updated ${formatAgo(lastUpdatedAt)}`;
    }

    async function refreshIntelligence() {
      if (refreshPromise || !viewer.isConnected) return refreshPromise;
      const refreshButton = viewer.querySelector('[data-intel-action="refresh"]');
      const preservedScrollTop = viewer.scrollTop;
      const activeElement = document.activeElement;
      const restoreSearchFocus = activeElement?.matches?.('[data-intel-query]');
      const selectionStart = restoreSearchFocus ? activeElement.selectionStart : null;
      const selectionEnd = restoreSearchFocus ? activeElement.selectionEnd : null;
      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = 'Refreshing…';
      }

      refreshPromise = (async () => {
        const next = await loadIntelligenceData();
        const watchedIds = watchedPlayerIdSet();
        const readyAlerts = [];
        const nextTierByPlayer = new Map();
        for (const player of next.intelligence) {
          const playerId = String(player.playerId);
          const nextTier = player.actionability.tier;
          const previousTier = previousTierByPlayer.get(playerId);
          nextTierByPlayer.set(playerId, nextTier);
          if (!previousTier || previousTier === nextTier) continue;
          const watched = watchedIds.has(playerId);
          changedPlayerIds.add(playerId);
          priorityChanges.unshift({
            playerId,
            name: player.name,
            factionId: player.factionId,
            from: previousTier,
            to: nextTier,
            watched,
            changedAt: Date.now(),
          });
          if (watched && nextTier === 'ready') readyAlerts.push(player.name);
        }
        if (priorityChanges.length > 100) priorityChanges.length = 100;
        previousTierByPlayer = nextTierByPlayer;
        intelligence = next.intelligence;
        factionIds = next.factionIds;
        factionHealthRecords = next.factionHealthRecords;
        if (viewerState.factionId !== 'all' && !factionIds.includes(viewerState.factionId)) {
          viewerState.factionId = factionIds.includes(currentFactionId)
            ? currentFactionId
            : factionIds[0] || 'all';
        }
        lastUpdatedAt = Date.now();
        renderIntelligence();
        updateRefreshLabel();
        if (readyAlerts.length) {
          const names = readyAlerts.slice(0, 3).join(', ');
          toast(`${names}${readyAlerts.length > 3 ? ` +${readyAlerts.length - 3} more` : ''} now observed ready.`);
        }
        viewer.scrollTop = preservedScrollTop;
        requestAnimationFrame(() => {
          if (!viewer.isConnected) return;
          viewer.scrollTop = preservedScrollTop;
          if (restoreSearchFocus) {
            const search = content.querySelector('[data-intel-query]');
            search?.focus();
            search?.setSelectionRange?.(selectionStart, selectionEnd);
          }
        });
      })().finally(() => {
        refreshPromise = null;
        if (refreshButton?.isConnected) {
          refreshButton.disabled = false;
          refreshButton.textContent = 'Refresh';
        }
      });
      return refreshPromise;
    }

    const closeViewer = () => {
      if (refreshTimer) clearInterval(refreshTimer);
      window.removeEventListener('resize', syncIntelligenceWidthMode);
      window.visualViewport?.removeEventListener('resize', syncIntelligenceWidthMode);
      document.body.style.overflow = previousBodyOverflow;
      viewer.remove();
    };
    viewer.querySelector('[data-intel-action="refresh"]')?.addEventListener('click', () => {
      refreshIntelligence().catch(reportError);
    });
    viewer.querySelector('[data-intel-action="sessions"]')?.addEventListener('click', () => {
      closeViewer();
      openWarSessionsViewer().catch(reportError);
    });
    viewer.querySelector('[data-intel-action="close"]')?.addEventListener('click', closeViewer);
    viewer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeViewer();
    });
    renderIntelligence();
    updateRefreshLabel();
    refreshTimer = setInterval(() => {
      if (!viewer.isConnected) {
        clearInterval(refreshTimer);
        return;
      }
      updateRefreshLabel();
      if (Date.now() - lastUpdatedAt >= 60_000) {
        refreshIntelligence().catch(reportError);
      }
    }, 10_000);
  }

  function measureSessionHealth(records, rangeStart, rangeEnd) {
    const intervals = records
      .map((record) => Number(record.recordedAt || 0))
      .filter((timestamp) => timestamp >= rangeStart && timestamp <= rangeEnd)
      .sort((a, b) => a - b)
      .map((timestamp) => ({
        from: timestamp,
        to: Math.min(rangeEnd, timestamp + APP.collectorTickGapThresholdMs),
      }));
    const merged = [];
    for (const interval of intervals) {
      const previous = merged.at(-1);
      if (previous && interval.from <= previous.to) previous.to = Math.max(previous.to, interval.to);
      else merged.push({ ...interval });
    }
    let coveredMs = 0;
    let longestGapMs = 0;
    let gapCount = 0;
    let cursor = rangeStart;
    for (const interval of merged) {
      if (interval.from > cursor) {
        gapCount += 1;
        longestGapMs = Math.max(longestGapMs, interval.from - cursor);
      }
      coveredMs += Math.max(0, interval.to - Math.max(cursor, interval.from));
      cursor = Math.max(cursor, interval.to);
    }
    if (cursor < rangeEnd) {
      gapCount += 1;
      longestGapMs = Math.max(longestGapMs, rangeEnd - cursor);
    }
    const totalMs = Math.max(1, rangeEnd - rangeStart);
    return {
      coveragePercent: Math.min(100, Math.round((coveredMs / totalMs) * 100)),
      gapCount,
      longestGapMs,
    };
  }

  function splitDiscordReport(text, title) {
    const maxBodyLength = 1700;
    const lines = text.split('\n');
    const bodies = [];
    let current = '';
    for (const originalLine of lines) {
      const lineParts = originalLine.length > maxBodyLength
        ? originalLine.match(new RegExp(`.{1,${maxBodyLength}}`, 'g')) || ['']
        : [originalLine];
      for (const line of lineParts) {
        const candidate = current ? `${current}\n${line}` : line;
        if (candidate.length > maxBodyLength && current) {
          bodies.push(current);
          current = line;
        } else current = candidate;
      }
    }
    if (current) bodies.push(current);
    return bodies.map(
      (body, index) => `**${title} — ${index + 1}/${bodies.length}**\n${body}`
    );
  }

  async function buildWarSessionDiscordReport(session) {
    const rangeStart = Number(session.startedAt);
    const rangeEnd = Number(session.endedAt || Date.now());
    const [players, rawObservations, healthRecords] = await Promise.all([
      getAllFromStore(APP.playersStore),
      getAllFromStore(APP.observationsStore),
      getCollectorHealthRecords(rangeStart),
    ]);
    const factionIds = session.factionIds.map(String);
    const analysis = buildAnalysisObservations(rawObservations);
    const sessionObservations = analysis.observations.filter(
      (observation) =>
        Number(observation.capturedAt) >= rangeStart &&
        Number(observation.capturedAt) <= rangeEnd &&
        factionIds.includes(String(observation.factionId))
    );
    const watchedIds = new Set((state.settings.watchedPlayerIds || []).map(String));
    const playerNames = new Map(
      players.map((player) => [String(player.playerId), cleanStoredName(player.name, player.playerId)])
    );
    let totalTransitions = 0;
    let totalPriorityTransitions = 0;
    const watchedChanges = [];
    const arrivalsHome = [];
    const hospitalExits = [];
    const newlyActive = [];
    const readyWindows = [];
    const observationsByPlayer = new Map();
    const observedTier = (observation) => {
      if (['hospital', 'jail', 'federal', 'fallen', 'traveling', 'returning', 'abroad'].includes(observation.lifeStatus)) return 'unavailable';
      if (
        observation.lifeStatus === 'okay' &&
        (observation.activityStatus === 'online' || observation.activityStatus === 'idle')
      ) return 'ready';
      return 'watch';
    };
    const isTravelState = (lifeStatus) => ['traveling', 'returning', 'abroad'].includes(lifeStatus);
    const factionLabel = (factionId) =>
      normalizeWhitespace(state.settings.factionAliases?.[String(factionId)]) || `Faction ${factionId}`;
    const playerLabel = (playerId, observations) =>
      playerNames.get(playerId) ||
      cleanStoredName(observations.find((observation) => observation.name)?.name, playerId) ||
      `Player ${playerId}`;
    for (const observation of sessionObservations) {
      const playerId = String(observation.playerId);
      if (!observationsByPlayer.has(playerId)) observationsByPlayer.set(playerId, []);
      observationsByPlayer.get(playerId).push(observation);
    }
    for (const [playerId, observations] of observationsByPlayer) {
      observations.sort((a, b) => Number(a.capturedAt) - Number(b.capturedAt));
      const name = playerLabel(playerId, observations);
      const factionId = String(observations.at(-1)?.factionId || 'unknown');
      for (let index = 1; index < observations.length; index += 1) {
        const previous = observations[index - 1];
        const current = observations[index];
        if (observedTier(previous) !== observedTier(current)) totalPriorityTransitions += 1;
        if (
          previous.activityStatus === current.activityStatus &&
          previous.lifeStatus === current.lifeStatus
        ) continue;
        totalTransitions += 1;
        const eventBase = {
          playerId,
          name,
          factionId: String(current.factionId || factionId),
          at: Number(current.capturedAt),
        };
        if (isTravelState(previous.lifeStatus) && current.lifeStatus === 'okay') {
          arrivalsHome.push({ ...eventBase, from: previous.lifeStatus, to: current.lifeStatus });
        }
        if (previous.lifeStatus === 'hospital' && current.lifeStatus !== 'hospital') {
          hospitalExits.push({ ...eventBase, from: previous.lifeStatus, to: current.lifeStatus });
        }
        if (
          previous.activityStatus === 'offline' &&
          (current.activityStatus === 'online' || current.activityStatus === 'idle')
        ) {
          newlyActive.push({ ...eventBase, from: previous.activityStatus, to: current.activityStatus });
        }
        if (watchedIds.has(playerId)) {
          watchedChanges.push({
            name,
            at: current.capturedAt,
            from: `${previous.activityStatus}/${previous.lifeStatus}`,
            to: `${current.activityStatus}/${current.lifeStatus}`,
          });
        }
      }

      let activeWindow = null;
      const finishReadyWindow = () => {
        if (activeWindow && activeWindow.samples >= 2 && activeWindow.lastAt > activeWindow.startedAt) {
          readyWindows.push({
            ...activeWindow,
            durationMs: activeWindow.lastAt - activeWindow.startedAt,
          });
        }
        activeWindow = null;
      };
      for (const observation of observations) {
        const capturedAt = Number(observation.capturedAt);
        if (observedTier(observation) !== 'ready') {
          finishReadyWindow();
          continue;
        }
        if (
          activeWindow &&
          capturedAt - activeWindow.lastAt <= APP.coverageGapThresholdMs
        ) {
          activeWindow.lastAt = capturedAt;
          activeWindow.samples += 1;
          continue;
        }
        finishReadyWindow();
        activeWindow = {
          playerId,
          name,
          factionId: String(observation.factionId || factionId),
          startedAt: capturedAt,
          lastAt: capturedAt,
          samples: 1,
        };
      }
      finishReadyWindow();
    }

    const lines = [
      `**Session:** ${session.name}`,
      `**Window:** ${formatDateTime(rangeStart)} → ${formatDateTime(rangeEnd)}`,
      `**Duration:** ${formatDuration(rangeEnd - rangeStart)}`,
      `**Factions:** ${factionIds.length} • **Usable observations:** ${sessionObservations.length}`,
      `**Observed status changes:** ${totalTransitions} • **Priority-tier changes:** ${totalPriorityTransitions}`,
      '',
      '**Faction coverage**',
    ];

    for (const factionId of factionIds) {
      const factionName = normalizeWhitespace(state.settings.factionAliases?.[factionId]) || `Faction ${factionId}`;
      const factionObservations = sessionObservations.filter(
        (observation) => String(observation.factionId) === factionId
      );
      const factionHealth = healthRecords.filter(
        (record) =>
          String(record.factionId) === factionId &&
          Number(record.recordedAt) <= rangeEnd &&
          record.relevantPage
      );
      const health = measureSessionHealth(factionHealth, rangeStart, rangeEnd);
      const scans = factionHealth.filter((record) => record.type === 'scan');
      const saved = scans.reduce(
        (sum, record) => sum + Number(record.observationsSaved || 0),
        0
      );
      const uniquePlayers = new Set(factionObservations.map((observation) => String(observation.playerId))).size;
      const latestByPlayer = new Map();
      for (const observation of factionObservations) {
        latestByPlayer.set(String(observation.playerId), observation);
      }
      const latest = [...latestByPlayer.values()];
      const active = latest.filter(
        (observation) => observation.activityStatus === 'online' || observation.activityStatus === 'idle'
      ).length;
      const okay = latest.filter((observation) => observation.lifeStatus === 'okay').length;
      lines.push(
        `**${factionName}** \`${factionId}\``,
        `• Collector coverage: **${health.coveragePercent}%** • scans: ${scans.length} • saved: ${saved}`,
        `• Gaps: ${health.gapCount} • longest: ${formatDuration(health.longestGapMs)} • observed players: ${uniquePlayers}`,
        `• Final observed snapshot: activity ${active} active • life ${okay} Okay`,
        ''
      );
    }

    const appendEventSection = (title, events, emptyText) => {
      lines.push(`**${title} (${events.length})**`);
      if (!events.length) {
        lines.push(`• ${emptyText}`, '');
        return;
      }
      const displayed = [...events]
        .sort((a, b) => Number(b.at) - Number(a.at))
        .slice(0, 8);
      displayed.forEach((event) => {
        lines.push(
          `• **${event.name}** (${factionLabel(event.factionId)}): ${event.from} → ${event.to} • ${formatDateTime(event.at)}`
        );
      });
      if (events.length > displayed.length) lines.push(`• …and ${events.length - displayed.length} more`);
      lines.push('');
    };

    lines.push(
      '**Actionable observed intelligence**',
      `• Arrivals home: **${arrivalsHome.length}** • hospital exits: **${hospitalExits.length}** • newly active: **${newlyActive.length}**`,
      ''
    );
    appendEventSection('Arrivals home', arrivalsHome, 'No travel/abroad → Okay arrivals were observed.');
    appendEventSection('Hospital exits', hospitalExits, 'No hospital exits were observed.');
    appendEventSection('Newly active targets', newlyActive, 'No offline → Online/Idle changes were observed.');

    lines.push('**Longest observed ready windows**');
    const displayedReadyWindows = [...readyWindows]
      .sort((a, b) => b.durationMs - a.durationMs || b.samples - a.samples)
      .slice(0, 10);
    if (displayedReadyWindows.length) {
      displayedReadyWindows.forEach((window) => {
        lines.push(
          `• **${window.name}** (${factionLabel(window.factionId)}): **${formatDuration(window.durationMs)}** ready • ${window.samples} saved observations • ${formatDateTime(window.startedAt)} → ${formatDateTime(window.lastAt)}`
        );
      });
      if (readyWindows.length > displayedReadyWindows.length) {
        lines.push(`• …and ${readyWindows.length - displayedReadyWindows.length} more observed ready windows`);
      }
    } else {
      lines.push('• No repeated Online/Idle + Okay observations formed a ready window.');
    }
    lines.push('• Windows split on status changes or observation gaps over 15 minutes.', '');

    lines.push('**Watched-target changes**');
    if (watchedChanges.length) {
      watchedChanges
        .sort((a, b) => Number(b.at) - Number(a.at))
        .slice(0, 30)
        .forEach((change) => {
          lines.push(`• **${change.name}:** ${change.from} → ${change.to} • ${formatDateTime(change.at)}`);
        });
      if (watchedChanges.length > 30) lines.push(`• …and ${watchedChanges.length - 30} more watched changes`);
    } else lines.push('• No watched-target status changes were observed.');
    lines.push(
      '',
      '_Observed data only; coverage gaps are not treated as offline time._',
      '_Transition times are the first confirming observations, not exact event times._'
    );
    const title = `WIH War Report: ${session.name}`.slice(0, 80);
    return { chunks: splitDiscordReport(lines.join('\n'), title), sessionObservations, totalTransitions, totalPriorityTransitions };
  }

  async function shareTextReport(title, text) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    await writeTextToClipboard(text);
    toast('Sharing unavailable; report chunk copied instead.');
  }

  async function openWarSessionsViewer() {
    document.getElementById('wih-session-viewer')?.remove();
    const players = await getAllFromStore(APP.playersStore);
    const factionIds = [...new Set(
      players.map((player) => String(player.factionId || '')).filter((id) => /^\d+$/.test(id))
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const pinnedFactions = new Set((state.settings.watchedFactionIds || []).map(String));
    const currentFactionId = inferFactionId();
    const defaultFactions = factionIds.filter((id) => pinnedFactions.has(id));
    if (!defaultFactions.length && currentFactionId && factionIds.includes(currentFactionId)) {
      defaultFactions.push(currentFactionId);
    }
    const uiState = {
      selectedSessionId: null,
      setupFactionIds: new Set(defaultFactions.length ? defaultFactions : factionIds.slice(0, 1)),
    };
    const viewer = document.createElement('div');
    viewer.id = 'wih-session-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.innerHTML = `
      <header class="wih-session-header">
        <div class="wih-session-title"><strong>War Sessions</strong><span class="wih-muted">Timestamped monitoring windows · Discord-ready reports</span></div>
        <button type="button" class="wih-session-action" data-session-action="close">Close</button>
      </header>
      <main class="wih-session-content"></main>
    `;
    document.body.append(viewer);
    const content = viewer.querySelector('.wih-session-content');
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const factionName = (id) => normalizeWhitespace(state.settings.factionAliases?.[id]) || `Faction ${id}`;

    function renderSessions() {
      const active = state.warSessions.find((session) => !session.endedAt) || null;
      const completed = [...state.warSessions].filter((session) => session.endedAt).reverse();
      content.innerHTML = `
        ${active ? `
          <section class="wih-session-card">
            <strong>Active: ${escapeHtml(active.name)}</strong>
            <div class="wih-muted">Started ${escapeHtml(formatDateTime(active.startedAt))} · running ${escapeHtml(formatDuration(Date.now() - active.startedAt))}</div>
            <div style="margin-top:7px">${active.factionIds.map((id) => escapeHtml(factionName(String(id)))).join(' · ')}</div>
            <div class="wih-session-actions">
              <button class="wih-session-action" data-session-live-report="${escapeHtml(active.id)}">Build live report</button>
              <button class="wih-session-action" data-session-end="${escapeHtml(active.id)}">End session</button>
            </div>
          </section>
        ` : `
          <section class="wih-session-card">
            <strong>Start a war session</strong>
            <div class="wih-muted">Choose factions. The report will reference observations and collector health inside this timestamp window.</div>
            <input class="wih-session-name" data-session-name maxlength="80" value="War ${escapeHtml(new Date().toLocaleDateString())}" aria-label="Session name">
            <div class="wih-session-factions">
              ${factionIds.map((id) => `<label class="wih-session-check"><input type="checkbox" data-session-faction="${escapeHtml(id)}" ${uiState.setupFactionIds.has(id) ? 'checked' : ''}><span>${escapeHtml(factionName(id))}</span></label>`).join('') || '<div class="wih-muted">Capture at least one faction first.</div>'}
            </div>
            <div class="wih-session-actions"><button class="wih-session-action" data-session-action="start" ${factionIds.length ? '' : 'disabled'}>Start session</button></div>
          </section>
        `}
        <section class="wih-session-card">
          <strong>Completed sessions</strong>
          <div class="wih-session-list">
            ${completed.length ? completed.map((session) => `
              <div class="wih-session-row">
                <div><strong>${escapeHtml(session.name)}</strong><div class="wih-muted">${escapeHtml(formatDateTime(session.startedAt))} · ${escapeHtml(formatDuration(session.endedAt - session.startedAt))} · ${session.factionIds.length} faction${session.factionIds.length === 1 ? '' : 's'}</div></div>
                <button class="wih-session-action" data-session-report="${escapeHtml(session.id)}">Report</button>
              </div>
            `).join('') : '<div class="wih-muted">No completed sessions yet.</div>'}
          </div>
        </section>
        <section class="wih-session-card" data-session-report-area ${uiState.selectedSessionId ? '' : 'hidden'}></section>
      `;
      bindSessionControls();
      if (uiState.selectedSessionId) renderReport(uiState.selectedSessionId).catch(reportError);
    }

    function bindSessionControls() {
      content.querySelector('[data-session-action="start"]')?.addEventListener('click', () => {
        const name = normalizeWhitespace(content.querySelector('[data-session-name]')?.value).slice(0, 80);
        const selected = [...content.querySelectorAll('[data-session-faction]:checked')].map((input) => input.dataset.sessionFaction);
        if (!name || !selected.length) {
          toast('Enter a session name and select at least one faction.');
          return;
        }
        state.warSessions.push({ id: createCollectorId('war'), name, factionIds: selected, startedAt: Date.now(), endedAt: null });
        saveWarSessions();
        renderSessions();
      });
      content.querySelectorAll('[data-session-end]').forEach((button) => button.addEventListener('click', () => {
        if (!window.confirm('End this war session and finalize its report window?')) return;
        const session = state.warSessions.find((item) => item.id === button.dataset.sessionEnd);
        if (!session) return;
        session.endedAt = Date.now();
        uiState.selectedSessionId = session.id;
        saveWarSessions();
        renderSessions();
      }));
      content.querySelectorAll('[data-session-report], [data-session-live-report]').forEach((button) => button.addEventListener('click', () => {
        uiState.selectedSessionId = button.dataset.sessionReport || button.dataset.sessionLiveReport;
        renderSessions();
      }));
    }

    async function renderReport(sessionId) {
      const area = content.querySelector('[data-session-report-area]');
      const session = state.warSessions.find((item) => item.id === sessionId);
      if (!area || !session) return;
      area.hidden = false;
      area.innerHTML = '<div class="wih-muted">Building report from the local archive…</div>';
      const report = await buildWarSessionDiscordReport(session);
      if (!area.isConnected || uiState.selectedSessionId !== sessionId) return;
      area.innerHTML = `
        <strong>Discord report: ${escapeHtml(session.name)}</strong>
        <div class="wih-muted">${report.chunks.length} Discord-safe message chunk${report.chunks.length === 1 ? '' : 's'} · each stays below Discord’s standard message limit</div>
        ${report.chunks.map((chunk, index) => `
          <div class="wih-report-chunk">
            <strong>Chunk ${index + 1} of ${report.chunks.length}</strong>
            <textarea readonly data-report-text="${index}">${escapeHtml(chunk)}</textarea>
            <div class="wih-session-actions">
              <button class="wih-session-action" data-report-copy="${index}">Copy chunk ${index + 1}</button>
              <button class="wih-session-action" data-report-share="${index}">Share chunk ${index + 1}</button>
            </div>
          </div>
        `).join('')}
      `;
      area.querySelectorAll('[data-report-copy]').forEach((button) => button.addEventListener('click', async () => {
        await writeTextToClipboard(report.chunks[Number(button.dataset.reportCopy)]);
        toast(`Copied report chunk ${Number(button.dataset.reportCopy) + 1}.`);
      }));
      area.querySelectorAll('[data-report-share]').forEach((button) => button.addEventListener('click', () => {
        const index = Number(button.dataset.reportShare);
        shareTextReport(`WIH War Report: ${session.name}`, report.chunks[index]).catch(reportError);
      }));
    }

    const closeViewer = () => {
      document.body.style.overflow = previousBodyOverflow;
      viewer.remove();
    };
    viewer.querySelector('[data-session-action="close"]')?.addEventListener('click', closeViewer);
    viewer.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeViewer(); });
    renderSessions();
  }

  function analyzeCollectorHealth(records, now = Date.now()) {
    const cutoff = now - 24 * 60 * 60_000;
    const sorted = records
      .filter((record) => Number(record.recordedAt || 0) >= cutoff)
      .sort((a, b) => Number(a.recordedAt) - Number(b.recordedAt));
    const rangeStart = Number(sorted[0]?.recordedAt || now);
    const totalMs = Math.max(1, now - rangeStart);
    const segments = [];
    const gaps = [];
    let coveredMs = 0;
    let cursor = rangeStart;

    for (let index = 0; index < sorted.length; index += 1) {
      const from = Number(sorted[index].recordedAt);
      const nextAt = Number(sorted[index + 1]?.recordedAt || now);
      const to = Math.min(now, nextAt, from + APP.collectorTickGapThresholdMs);
      if (from > cursor) {
        gaps.push({ from: cursor, to: from, durationMs: from - cursor });
      }
      if (to > from) {
        segments.push({ from, to });
        coveredMs += to - from;
        cursor = Math.max(cursor, to);
      }
    }

    if (sorted.length && cursor < now) {
      gaps.push({ from: cursor, to: now, durationMs: now - cursor });
    }

    const scans = sorted.filter((record) => record.type === 'scan');
    const ticks = sorted.filter((record) => record.type === 'tick');
    const savedScans = scans.filter((record) => Number(record.observationsSaved || 0) > 0);
    const latest = sorted.at(-1) || null;
    const latestScan = scans.at(-1) || null;
    const latestSavedScan = savedScans.at(-1) || null;
    const contentChangeTimes = sorted
      .map((record) => Number(record.lastPageContentChangeAt || 0))
      .filter(Boolean);
    const relevantTicks = ticks.filter((record) => record.relevantPage).length;
    const hiddenTicks = ticks.filter((record) => record.hidden).length;
    const longestGap = gaps.reduce(
      (longest, gap) => gap.durationMs > (longest?.durationMs || 0) ? gap : longest,
      null
    );

    return {
      rangeStart,
      rangeEnd: now,
      totalMs,
      sorted,
      segments,
      gaps,
      scans,
      ticks,
      latest,
      latestScan,
      latestSavedScan,
      latestContentChangeAt: contentChangeTimes.length ? Math.max(...contentChangeTimes) : null,
      relevantTickPercent: ticks.length ? Math.round((relevantTicks / ticks.length) * 100) : 0,
      hiddenTickPercent: ticks.length ? Math.round((hiddenTicks / ticks.length) * 100) : 0,
      observationsSaved: scans.reduce(
        (total, record) => total + Number(record.observationsSaved || 0),
        0
      ),
      coveragePercent: Math.min(100, Math.round((coveredMs / totalMs) * 100)),
      longestGap,
      recentlyAwake: Boolean(
        latest && now - latest.recordedAt <= APP.collectorTickGapThresholdMs
      ),
    };
  }

  function shortCollectorId(value) {
    const parts = String(value || 'legacy').split('-');
    return (parts.at(-1) || 'legacy').slice(0, 8);
  }

  function collectorHealthSummary(analysis) {
    return {
      recordedEvents: analysis.sorted.length,
      ticks: analysis.ticks.length,
      scans: analysis.scans.length,
      observationsSaved: analysis.observationsSaved,
      likelySuspensionGaps: analysis.gaps.length,
      longestLikelySuspensionGapMs: analysis.longestGap?.durationMs || 0,
      measuredRuntimeCoveragePercent: analysis.coveragePercent,
      relevantPagePollPercent: analysis.relevantTickPercent,
      hiddenTabPollPercent: analysis.hiddenTickPercent,
      firstRecordAt: analysis.sorted[0]?.recordedAt || null,
      lastWakeAt: analysis.latest?.recordedAt || null,
      lastScanAt: analysis.latestScan?.recordedAt || null,
      lastRenderedStatusChangeAt: analysis.latestContentChangeAt,
    };
  }

  function buildCollectorHealthReport(records, analysis, selection) {
    return {
      schema: 'script-kitty-collector-health-report',
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      appVersion: APP.version,
      currentTabId: state.collectorTabId,
      currentRunId: state.collectorRunId,
      selection,
      summary: collectorHealthSummary(analysis),
      gaps: analysis.gaps,
      records,
    };
  }

  async function openCollectorHealthViewer() {
    document.getElementById('wih-health-viewer')?.remove();
    const now = Date.now();
    const allRecords = await getCollectorHealthRecords(now - 24 * 60 * 60_000);
    const viewerState = {
      scope: `tab:${state.collectorTabId}`,
      factionId: 'all',
    };

    const viewer = document.createElement('div');
    viewer.id = 'wih-health-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'Collector health');
    viewer.innerHTML = `
      <header class="wih-health-header">
        <div class="wih-health-title">
          <strong>Collector Health</strong>
          <span class="wih-muted">Measured userscript activity · up to 24 hours</span>
        </div>
        <button type="button" class="wih-health-close" data-health-action="close">Close</button>
      </header>
      <main class="wih-health-content"></main>
    `;
    document.body.append(viewer);
    const content = viewer.querySelector('.wih-health-content');
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const normalizedRecords = allRecords.map((record) => ({
      ...record,
      tabId: record.tabId || 'legacy-tab',
      runId: record.runId || 'legacy-run',
    }));
    const runMap = new Map();
    for (const record of normalizedRecords) {
      const existing = runMap.get(record.runId);
      if (!existing || record.recordedAt > existing.recordedAt) {
        runMap.set(record.runId, record);
      }
    }
    const recentRuns = [...runMap.values()].sort((a, b) => b.recordedAt - a.recordedAt);
    const tabMap = new Map();
    for (const record of normalizedRecords) {
      const existing = tabMap.get(record.tabId);
      if (!existing || record.recordedAt > existing.recordedAt) {
        tabMap.set(record.tabId, record);
      }
    }
    const recentTabs = [...tabMap.values()].sort((a, b) => b.recordedAt - a.recordedAt);
    const factionIds = [...new Set(
      normalizedRecords.map((record) => record.factionId).filter(Boolean)
    )].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

    function selectedRecords() {
      return normalizedRecords.filter((record) => {
        let scopeMatches = true;
        if (viewerState.scope.startsWith('run:')) {
          scopeMatches = record.runId === viewerState.scope.slice(4);
        } else if (viewerState.scope.startsWith('tab:')) {
          scopeMatches = record.tabId === viewerState.scope.slice(4);
        }
        const factionMatches =
          viewerState.factionId === 'all' || record.factionId === viewerState.factionId;
        return scopeMatches && factionMatches;
      });
    }

    function scopeLabel() {
      if (viewerState.scope === 'all') return 'All tabs combined';
      if (viewerState.scope.startsWith('tab:')) {
        return `Tab ${shortCollectorId(viewerState.scope.slice(4))}`;
      }
      const runId = viewerState.scope.slice(4);
      const run = runMap.get(runId);
      return `Run ${shortCollectorId(runId)} · Tab ${shortCollectorId(run?.tabId)}`;
    }

    function renderHealth() {
      const records = selectedRecords();
      const analysis = analyzeCollectorHealth(records, Date.now());
      const events = [...analysis.sorted]
        .reverse()
        .filter((record) => record.type !== 'tick')
        .slice(0, 40);

      const otherRunOptions = recentRuns
        .filter((record) => record.runId !== state.collectorRunId)
        .map((record) => `
          <option value="run:${escapeHtml(record.runId)}" ${viewerState.scope === `run:${record.runId}` ? 'selected' : ''}>
            Run ${escapeHtml(shortCollectorId(record.runId))} · Tab ${escapeHtml(shortCollectorId(record.tabId))}
          </option>
        `).join('');
      const otherTabOptions = recentTabs
        .filter((record) => record.tabId !== state.collectorTabId)
        .map((record) => `
          <option value="tab:${escapeHtml(record.tabId)}" ${viewerState.scope === `tab:${record.tabId}` ? 'selected' : ''}>
            Tab ${escapeHtml(shortCollectorId(record.tabId))} · all runs
          </option>
        `).join('');

      content.innerHTML = `
        <section class="wih-health-card">
          <div class="wih-health-controls">
            <select data-health-scope aria-label="Collector tab or run">
              <option value="run:${escapeHtml(state.collectorRunId)}" ${viewerState.scope === `run:${state.collectorRunId}` ? 'selected' : ''}>Current run · ${escapeHtml(shortCollectorId(state.collectorRunId))}</option>
              <option value="tab:${escapeHtml(state.collectorTabId)}" ${viewerState.scope === `tab:${state.collectorTabId}` ? 'selected' : ''}>Current tab · ${escapeHtml(shortCollectorId(state.collectorTabId))}</option>
              <option value="all" ${viewerState.scope === 'all' ? 'selected' : ''}>All tabs combined</option>
              ${otherTabOptions}
              ${otherRunOptions}
            </select>
            <select data-health-faction aria-label="Collector faction filter">
              <option value="all" ${viewerState.factionId === 'all' ? 'selected' : ''}>All pages</option>
              ${factionIds.map((factionId) => `
                <option value="${escapeHtml(factionId)}" ${viewerState.factionId === factionId ? 'selected' : ''}>Faction ${escapeHtml(factionId)}</option>
              `).join('')}
            </select>
          </div>
          <div class="wih-muted" style="margin-top:7px">${escapeHtml(scopeLabel())} · ${records.length} health record${records.length === 1 ? '' : 's'}</div>
        </section>

        <section class="wih-health-card">
          <div class="wih-health-state">
            <span class="wih-health-state-dot ${analysis.recentlyAwake ? 'is-awake' : ''}"></span>
            <div>
              <strong>${analysis.recentlyAwake ? 'Collector awake recently' : 'No recent collector wake-up'}</strong>
              <div class="wih-muted">Last measured activity ${escapeHtml(formatAgo(analysis.latest?.recordedAt))}</div>
            </div>
          </div>
          <div class="wih-health-stats">
            <div class="wih-health-stat"><strong>${analysis.coveragePercent}%</strong><span class="wih-muted">selected runtime coverage</span></div>
            <div class="wih-health-stat"><strong>${analysis.scans.length}</strong><span class="wih-muted">completed scans</span></div>
            <div class="wih-health-stat"><strong>${analysis.observationsSaved}</strong><span class="wih-muted">observations saved</span></div>
            <div class="wih-health-stat"><strong>${analysis.gaps.length}</strong><span class="wih-muted">likely suspension gaps</span></div>
          </div>
        </section>

        <section class="wih-health-card">
          <strong>Measured runtime</strong>
          ${analysis.sorted.length ? `
            <div class="wih-health-bar" aria-label="Green is measured userscript runtime; hatched gray is no health coverage">
              ${analysis.segments.map((segment) => {
                const left = ((segment.from - analysis.rangeStart) / analysis.totalMs) * 100;
                const width = ((segment.to - segment.from) / analysis.totalMs) * 100;
                return `<span class="wih-health-segment" style="left:${left.toFixed(5)}%;width:${width.toFixed(5)}%" title="Measured awake · ${escapeHtml(formatDuration(segment.to - segment.from))}"></span>`;
              }).join('')}
            </div>
            <div class="wih-muted" style="margin-top:7px">Green means this selection reported activity. Hatched gray is a likely suspension gap.</div>
            <div class="wih-muted" style="margin-top:5px">${escapeHtml(formatDateTime(analysis.rangeStart))} → ${escapeHtml(formatDateTime(analysis.rangeEnd))}</div>
          ` : '<div class="wih-muted" style="padding-top:9px">No health records match this selection yet.</div>'}
        </section>

        <section class="wih-health-card">
          <strong>Background evidence</strong>
          <div class="wih-health-stats" style="margin-top:9px">
            <div class="wih-health-stat"><strong>${escapeHtml(formatAgo(analysis.latestScan?.recordedAt))}</strong><span class="wih-muted">last successful scan</span></div>
            <div class="wih-health-stat"><strong>${escapeHtml(formatAgo(analysis.latestSavedScan?.recordedAt))}</strong><span class="wih-muted">last saved observation</span></div>
            <div class="wih-health-stat"><strong>${escapeHtml(formatAgo(analysis.latestContentChangeAt))}</strong><span class="wih-muted">last rendered status change</span></div>
            <div class="wih-health-stat"><strong>${analysis.longestGap ? escapeHtml(formatDuration(analysis.longestGap.durationMs)) : 'None'}</strong><span class="wih-muted">longest measured gap</span></div>
            <div class="wih-health-stat"><strong>${analysis.relevantTickPercent}%</strong><span class="wih-muted">polls with relevant page</span></div>
            <div class="wih-health-stat"><strong>${analysis.hiddenTickPercent}%</strong><span class="wih-muted">polls reporting hidden tab</span></div>
          </div>
          <div class="wih-health-actions" style="margin-top:10px">
            <button type="button" class="wih-health-action" data-health-action="copy-report">Copy health report</button>
          </div>
        </section>

        <section class="wih-health-card">
          <strong>Recent collector events</strong>
          <div class="wih-muted">Newest first · routine one-minute ticks are summarized above</div>
          <div class="wih-health-event-list">
            ${events.length ? events.map((record) => {
              const detail = record.type === 'scan'
                ? `${record.playersFound || 0} players · ${record.observationsSaved || 0} saved · rendered data ${record.pageContentChanged ? 'changed' : 'unchanged'}`
                : `Tab reported ${record.source || (record.hidden ? 'hidden' : 'visible')}`;
              return `
                <div class="wih-health-event">
                  <div>
                    <strong>${escapeHtml(record.type)}</strong>
                    <div class="wih-muted">${escapeHtml(detail)} · ${record.relevantPage ? 'relevant page' : 'other page'} · tab ${escapeHtml(shortCollectorId(record.tabId))}</div>
                  </div>
                  <time class="wih-muted">${escapeHtml(formatDateTime(record.recordedAt))}</time>
                </div>
              `;
            }).join('') : '<div class="wih-muted" style="padding:16px 0">No non-tick events match this selection.</div>'}
          </div>
        </section>

        <section class="wih-health-card wih-muted">
          Current run isolates this script load. Current tab combines reloads of this Torn PDA tab. All tabs combined reveals periods when every instrumented tab stopped. This proves script activity, not that Torn refreshed unchanged server data.
        </section>
      `;

      content.querySelector('[data-health-scope]')?.addEventListener('change', (event) => {
        viewerState.scope = event.currentTarget.value;
        renderHealth();
      });
      content.querySelector('[data-health-faction]')?.addEventListener('change', (event) => {
        viewerState.factionId = event.currentTarget.value;
        renderHealth();
      });
      content.querySelector('[data-health-action="copy-report"]')?.addEventListener('click', () => {
        const report = buildCollectorHealthReport(records, analysis, {
          scope: viewerState.scope,
          scopeLabel: scopeLabel(),
          factionId: viewerState.factionId,
        });
        writeTextToClipboard(JSON.stringify(report, null, 2))
          .then(() => toast(`Copied ${records.length} collector-health records.`))
          .catch(reportError);
      });
    }

    const closeViewer = () => {
      document.body.style.overflow = previousBodyOverflow;
      viewer.remove();
    };
    viewer.querySelector('[data-health-action="close"]')?.addEventListener('click', closeViewer);
    viewer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeViewer();
    });
    renderHealth();
  }

  async function buildExportPayload() {
    const [players, rawObservations, collectorHealth] = await Promise.all([
      getAllFromStore(APP.playersStore),
      getAllFromStore(APP.observationsStore),
      getCollectorHealthRecords(0),
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
        ignoredUnknownObservationCount: analysis.ignoredUnknownObservations,
        coverageGapCount: coverageGaps.length,
        coverageGaps,
      },
      players,
      observations: rawObservations,
      collectorHealth,
      warSessions: state.warSessions,
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
        if (Array.isArray(payload.collectorHealth) && payload.collectorHealth.length) {
          const healthTx = state.healthDb.transaction(APP.healthStore, 'readwrite');
          const healthStore = healthTx.objectStore(APP.healthStore);
          for (const record of payload.collectorHealth) {
            if (!record?.recordedAt || !record?.type) continue;
            const clean = { ...record };
            delete clean.id;
            healthStore.add(clean);
          }
          await transactionDone(healthTx);
        }
        if (Array.isArray(payload.warSessions)) {
          const sessionsById = new Map(state.warSessions.map((session) => [session.id, session]));
          for (const session of payload.warSessions) {
            if (!session?.id || !session?.startedAt || !Array.isArray(session.factionIds)) continue;
            sessionsById.set(session.id, session);
          }
          state.warSessions = [...sessionsById.values()]
            .sort((a, b) => Number(a.startedAt) - Number(b.startedAt))
            .slice(-30);
          saveWarSessions();
        }
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
    const [rawObservations, healthRecords] = await Promise.all([
      getAllFromStore(APP.observationsStore),
      getCollectorHealthRecords(Date.now() - 24 * 60 * 60_000),
    ]);
    const analysis = buildAnalysisObservations(rawObservations);
    const coverageGaps = findCoverageGaps(analysis.observations);
    const normalizedHealthRecords = healthRecords.map((record) => ({
      ...record,
      tabId: record.tabId || 'legacy-tab',
      runId: record.runId || 'legacy-run',
    }));
    const combinedCollectorHealth = analyzeCollectorHealth(normalizedHealthRecords);
    const currentTabCollectorHealth = analyzeCollectorHealth(
      normalizedHealthRecords.filter((record) => record.tabId === state.collectorTabId)
    );
    const currentRunCollectorHealth = analyzeCollectorHealth(
      normalizedHealthRecords.filter((record) => record.runId === state.collectorRunId)
    );
    const diagnostics = {
      app: APP.name,
      version: APP.version,
      url: location.href,
      title: document.title,
      relevantPageGuess: pageLooksRelevant(),
      documentHidden: document.hidden,
      resolvedFactionId: inferFactionId(),
      collectorFactionId: inferCollectorFactionId(),
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
        ignoredUnknownObservationCount: analysis.ignoredUnknownObservations,
        coverageGapCount: coverageGaps.length,
      },
      collectorHealthStats: {
        currentTabId: state.collectorTabId,
        currentRunId: state.collectorRunId,
        distinctTabCount24h: new Set(normalizedHealthRecords.map((record) => record.tabId)).size,
        distinctRunCount24h: new Set(normalizedHealthRecords.map((record) => record.runId)).size,
        currentRun: collectorHealthSummary(currentRunCollectorHealth),
        currentTab: collectorHealthSummary(currentTabCollectorHealth),
        allTabsCombined: collectorHealthSummary(combinedCollectorHealth),
      },
      userAgent: navigator.userAgent,
      generatedAt: new Date().toISOString(),
    };

    await writeTextToClipboard(JSON.stringify(diagnostics, null, 2));
    toast('Diagnostics copied. Player IDs and visible row samples are included.');
  }

  async function eraseAllData() {
    const confirmed = window.confirm(
      'Erase every locally stored War Intelligence HUD player, observation, collector-health record, and war session? This cannot be undone unless you exported a backup.'
    );
    if (!confirmed) return;

    const tx = state.db.transaction(
      [APP.playersStore, APP.observationsStore],
      'readwrite'
    );
    tx.objectStore(APP.playersStore).clear();
    tx.objectStore(APP.observationsStore).clear();
    const healthTx = state.healthDb.transaction(APP.healthStore, 'readwrite');
    healthTx.objectStore(APP.healthStore).clear();
    await Promise.all([transactionDone(tx), transactionDone(healthTx)]);

    state.currentRows = [];
    state.warSessions = [];
    localStorage.removeItem(APP.warSessionsKey);
    await renderPanel();
    toast('All local WIH data, collector-health history, and war sessions erased.');
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
    state.healthDb = await openHealthDatabase();
    await cleanPlayerSummaryNames();
    await purgeOldObservations();
    await recordCollectorHealth('init', { source: 'script-start' });
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
