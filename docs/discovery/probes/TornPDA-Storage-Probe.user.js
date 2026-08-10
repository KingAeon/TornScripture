// ==UserScript==
// @name         TornScriptures Discovery - TornPDA Storage Probe
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Disposable Age of Discovery probe for TornPDA PDA_storage behavior. Does not touch TornScripture product data.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const APP = Object.freeze({
    name: 'TornPDA Storage Probe',
    version: '0.1.0',
    panelId: 'ts-discovery-pda-storage-probe',
    styleId: 'ts-discovery-pda-storage-probe-style',
    keyPrefix: 'ts-discovery-storage-probe:',
    persistenceKey: 'ts-discovery-storage-probe:persistence-marker',
  });

  const ephemeralKeys = [
    `${APP.keyPrefix}string`,
    `${APP.keyPrefix}object`,
    `${APP.keyPrefix}array`,
    `${APP.keyPrefix}number`,
    `${APP.keyPrefix}boolean`,
    `${APP.keyPrefix}batch-a`,
    `${APP.keyPrefix}batch-b`,
    `${APP.keyPrefix}missing`,
    `${APP.keyPrefix}latency`,
  ];

  const state = {
    lastReport: null,
    running: false,
  };

  function hasNativeStorage() {
    return typeof PDA_storage !== 'undefined' && PDA_storage && typeof PDA_storage.get === 'function';
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function ms(value) {
    return Math.round(value * 1000) / 1000;
  }

  async function timed(label, fn) {
    const started = performance.now();
    const value = await fn();
    return { label, durationMs: ms(performance.now() - started), value };
  }

  function equalJson(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  async function cleanupEphemeral() {
    if (!hasNativeStorage()) return;
    for (const key of ephemeralKeys) {
      try {
        await PDA_storage.delete(key);
      } catch (_) {
        // Best-effort cleanup only. The report records operation failures separately.
      }
    }
  }

  async function runSafeTests() {
    if (state.running) return;
    state.running = true;
    setStatus('Running safe contract tests…');

    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      runAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      tests: [],
      latency: {},
      usageBefore: null,
      usageAfter: null,
      persistenceMarker: null,
      notes: [],
    };

    if (!hasNativeStorage()) {
      report.tests.push({ name: 'PDA_storage availability', pass: false, detail: 'PDA_storage is not available in this script context.' });
      state.lastReport = report;
      renderReport(report);
      setStatus('Native storage unavailable in this context.');
      state.running = false;
      return;
    }

    report.tests.push({ name: 'PDA_storage availability', pass: true });

    try {
      report.usageBefore = await PDA_storage.usage();
    } catch (error) {
      report.tests.push({ name: 'usage() before tests', pass: false, error: describeError(error) });
    }

    await cleanupEphemeral();

    const cases = [
      [`${APP.keyPrefix}string`, 'TornScriptures'],
      [`${APP.keyPrefix}object`, { source: 'Age of Discovery', nested: { ok: true }, n: 17 }],
      [`${APP.keyPrefix}array`, [1, 'two', false, { four: 4 }]],
      [`${APP.keyPrefix}number`, 123456789],
      [`${APP.keyPrefix}boolean`, true],
    ];

    for (const [key, expected] of cases) {
      try {
        const write = await timed(`set ${key}`, () => PDA_storage.set(key, expected));
        const read = await timed(`get ${key}`, () => PDA_storage.get(key));
        const pass = equalJson(read.value, expected);
        report.tests.push({ name: `round-trip ${key.slice(APP.keyPrefix.length)}`, pass, expected, actual: read.value });
        report.latency[write.label] = write.durationMs;
        report.latency[read.label] = read.durationMs;
      } catch (error) {
        report.tests.push({ name: `round-trip ${key.slice(APP.keyPrefix.length)}`, pass: false, error: describeError(error) });
      }
    }

    try {
      const fallback = { fallback: true };
      const missing = await PDA_storage.get(`${APP.keyPrefix}missing`, fallback);
      report.tests.push({ name: 'get missing key default', pass: equalJson(missing, fallback), actual: missing });
    } catch (error) {
      report.tests.push({ name: 'get missing key default', pass: false, error: describeError(error) });
    }

    try {
      const write = await timed('setMany', () => PDA_storage.setMany({
        [`${APP.keyPrefix}batch-a`]: { a: 1 },
        [`${APP.keyPrefix}batch-b`]: ['b', 2],
      }));
      const read = await timed('getMany', () => PDA_storage.getMany([
        `${APP.keyPrefix}batch-a`,
        `${APP.keyPrefix}batch-b`,
      ]));
      const pass = equalJson(read.value[`${APP.keyPrefix}batch-a`], { a: 1 }) &&
        equalJson(read.value[`${APP.keyPrefix}batch-b`], ['b', 2]);
      report.tests.push({ name: 'setMany/getMany batch round-trip', pass, actual: read.value });
      report.latency[write.label] = write.durationMs;
      report.latency[read.label] = read.durationMs;
    } catch (error) {
      report.tests.push({ name: 'setMany/getMany batch round-trip', pass: false, error: describeError(error) });
    }

    try {
      const all = await timed('loadAll', () => PDA_storage.loadAll());
      const probeKeys = Object.keys(all.value || {}).filter((key) => key.startsWith(APP.keyPrefix));
      report.tests.push({ name: 'loadAll sees probe namespace keys', pass: probeKeys.length >= 7, probeKeys });
      report.latency[all.label] = all.durationMs;
    } catch (error) {
      report.tests.push({ name: 'loadAll', pass: false, error: describeError(error) });
    }

    try {
      await PDA_storage.delete(`${APP.keyPrefix}string`);
      const deleted = await PDA_storage.get(`${APP.keyPrefix}string`, '__missing__');
      report.tests.push({ name: 'delete removes key', pass: deleted === '__missing__', actual: deleted });
    } catch (error) {
      report.tests.push({ name: 'delete removes key', pass: false, error: describeError(error) });
    }

    try {
      const listed = await PDA_storage.list();
      const probeKeys = (listed || []).filter((key) => key.startsWith(APP.keyPrefix));
      report.tests.push({ name: 'list returns probe keys', pass: probeKeys.length > 0, probeKeys });
    } catch (error) {
      report.tests.push({ name: 'list', pass: false, error: describeError(error) });
    }

    try {
      report.persistenceMarker = await PDA_storage.get(APP.persistenceKey, null);
    } catch (error) {
      report.notes.push(`Persistence marker read failed: ${describeError(error)}`);
    }

    await cleanupEphemeral();

    try {
      report.usageAfter = await PDA_storage.usage();
    } catch (error) {
      report.tests.push({ name: 'usage() after cleanup', pass: false, error: describeError(error) });
    }

    report.summary = summarize(report.tests);
    report.notes.push('Quota exhaustion is intentionally not forced by v0.1.0. usage()/quota are recorded without allocating a 10–50 MiB failure payload.');
    report.notes.push('Only the persistence marker, if explicitly created by the user, is left behind after safe tests.');

    state.lastReport = report;
    renderReport(report);
    setStatus(`${report.summary.passed}/${report.summary.total} checks passed.`);
    state.running = false;
  }

  async function createPersistenceMarker() {
    if (!hasNativeStorage()) return setStatus('PDA_storage unavailable.');
    const marker = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
    };
    await PDA_storage.set(APP.persistenceKey, marker);
    setStatus(`Persistence marker written: ${marker.id}`);
    await showPersistenceMarker();
  }

  async function showPersistenceMarker() {
    if (!hasNativeStorage()) return setStatus('PDA_storage unavailable.');
    try {
      const marker = await PDA_storage.get(APP.persistenceKey, null);
      const ageMs = marker && marker.createdAt ? Date.now() - Date.parse(marker.createdAt) : null;
      const payload = {
        checkedAt: nowIso(),
        exists: Boolean(marker),
        ageMs,
        marker,
      };
      renderReport(payload);
      setStatus(marker ? `Marker survived. Age: ${Math.round(ageMs / 1000)}s.` : 'No persistence marker found.');
    } catch (error) {
      setStatus(`Marker check failed: ${describeError(error)}`);
    }
  }

  async function clearPersistenceMarker() {
    if (!hasNativeStorage()) return setStatus('PDA_storage unavailable.');
    await PDA_storage.delete(APP.persistenceKey);
    setStatus('Persistence marker deleted.');
    renderReport({ clearedAt: nowIso(), persistenceMarker: 'deleted' });
  }

  function describeError(error) {
    if (!error) return 'Unknown error';
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      code: error.code,
      used: error.used,
      quota: error.quota,
    };
  }

  function summarize(tests) {
    const total = tests.length;
    const passed = tests.filter((test) => test.pass === true).length;
    return { total, passed, failed: total - passed };
  }

  function setStatus(text) {
    const node = document.querySelector(`#${APP.panelId} [data-role="status"]`);
    if (node) node.textContent = text;
  }

  function renderReport(value) {
    const node = document.querySelector(`#${APP.panelId} [data-role="report"]`);
    if (node) node.textContent = JSON.stringify(value, null, 2);
  }

  async function copyLastReport() {
    const text = JSON.stringify(state.lastReport || { note: 'No safe-test report has been generated yet.' }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Safe-test report copied to clipboard.');
    } catch (_) {
      renderReport({ copyFallback: true, report: state.lastReport });
      setStatus('Clipboard unavailable. Report remains visible below.');
    }
  }

  function installUi() {
    if (document.getElementById(APP.panelId)) return;

    if (!document.getElementById(APP.styleId)) {
      const style = document.createElement('style');
      style.id = APP.styleId;
      style.textContent = `
        #${APP.panelId} {
          position: fixed; right: 12px; bottom: 12px; z-index: 2147483000;
          width: min(430px, calc(100vw - 24px)); max-height: 70vh; overflow: auto;
          background: #111; color: #eee; border: 1px solid #555; border-radius: 10px;
          padding: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.45); font: 13px/1.35 sans-serif;
        }
        #${APP.panelId} h3 { margin: 0 0 8px; font-size: 15px; }
        #${APP.panelId} .tsprobe-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
        #${APP.panelId} button { border: 1px solid #777; border-radius: 7px; background: #222; color: #eee; padding: 7px 9px; }
        #${APP.panelId} button:active { transform: translateY(1px); }
        #${APP.panelId} [data-role="status"] { margin: 8px 0; color: #b9e2ff; }
        #${APP.panelId} pre { white-space: pre-wrap; word-break: break-word; max-height: 32vh; overflow: auto; background: #090909; padding: 8px; border-radius: 6px; }
        #${APP.panelId} .tsprobe-note { color: #bbb; font-size: 12px; }
      `;
      document.head.appendChild(style);
    }

    const panel = document.createElement('section');
    panel.id = APP.panelId;
    panel.innerHTML = `
      <h3>${APP.name} v${APP.version}</h3>
      <div class="tsprobe-note">Disposable Discovery probe. It never reads or writes IMM, ISH, WIH, API-key, or Black Ledger keys.</div>
      <div class="tsprobe-row">
        <button type="button" data-action="safe">Run safe tests</button>
        <button type="button" data-action="copy">Copy report</button>
      </div>
      <div class="tsprobe-row">
        <button type="button" data-action="marker-write">Write persistence marker</button>
        <button type="button" data-action="marker-check">Check marker</button>
        <button type="button" data-action="marker-clear">Delete marker</button>
      </div>
      <div data-role="status">Ready. PDA_storage detected: ${hasNativeStorage() ? 'YES' : 'NO'}</div>
      <pre data-role="report">No test has run yet.</pre>
    `;

    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      try {
        if (button.dataset.action === 'safe') await runSafeTests();
        if (button.dataset.action === 'copy') await copyLastReport();
        if (button.dataset.action === 'marker-write') await createPersistenceMarker();
        if (button.dataset.action === 'marker-check') await showPersistenceMarker();
        if (button.dataset.action === 'marker-clear') await clearPersistenceMarker();
      } catch (error) {
        setStatus(`Action failed: ${JSON.stringify(describeError(error))}`);
      }
    });

    document.body.appendChild(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installUi, { once: true });
  } else {
    installUi();
  }
})();
