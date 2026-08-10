// ==UserScript==
// @name         TornScriptures Discovery - TornPDA Cross-Origin Storage Probe
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Disposable Age of Discovery probe for PDA_storage continuity across Torn, Weav3r, and TornExchange top-level pages. Does not touch TornScripture product data.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://weav3r.dev/*
// @match        https://www.weav3r.dev/*
// @match        https://tornexchange.com/*
// @match        https://www.tornexchange.com/*
// @grant        none
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const APP = Object.freeze({
    name: 'TornPDA Cross-Origin Storage Probe',
    version: '0.1.0',
    panelId: 'ts-discovery-cross-origin-probe',
    styleId: 'ts-discovery-cross-origin-probe-style',
    keyPrefix: 'ts-discovery-cross-origin-probe:',
    tornMarkerKey: 'ts-discovery-cross-origin-probe:torn-marker',
    externalProofKey: 'ts-discovery-cross-origin-probe:external-proof',
    roundTripKey: 'ts-discovery-cross-origin-probe:round-trip',
  });

  const state = { lastReport: null, running: false };

  function nowIso() { return new Date().toISOString(); }
  function hasNativeStorage() {
    return typeof PDA_storage !== 'undefined' && PDA_storage && typeof PDA_storage.get === 'function';
  }
  function hostKind() {
    const host = location.hostname.toLowerCase();
    if (host === 'www.torn.com' || host === 'torn.com') return 'torn';
    if (host === 'weav3r.dev' || host === 'www.weav3r.dev') return 'weav3r';
    if (host === 'tornexchange.com' || host === 'www.tornexchange.com') return 'tornexchange';
    return 'other';
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
  function setStatus(text) {
    const node = document.querySelector(`#${APP.panelId} [data-role="status"]`);
    if (node) node.textContent = text;
  }
  function render(value) {
    state.lastReport = value;
    const node = document.querySelector(`#${APP.panelId} [data-role="report"]`);
    if (node) node.textContent = JSON.stringify(value, null, 2);
  }

  async function snapshot(label) {
    const report = {
      label,
      checkedAt: nowIso(),
      probeVersion: APP.version,
      href: location.href,
      origin: location.origin,
      hostKind: hostKind(),
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      tornMarker: null,
      externalProof: null,
      usage: null,
    };
    if (hasNativeStorage()) {
      try { report.tornMarker = await PDA_storage.get(APP.tornMarkerKey, null); }
      catch (error) { report.tornMarkerError = describeError(error); }
      try { report.externalProof = await PDA_storage.get(APP.externalProofKey, null); }
      catch (error) { report.externalProofError = describeError(error); }
      try { report.usage = await PDA_storage.usage(); }
      catch (error) { report.usageError = describeError(error); }
    }
    render(report);
    return report;
  }

  async function writeTornMarker() {
    if (!hasNativeStorage()) return setStatus('PDA_storage unavailable in this context.');
    if (hostKind() !== 'torn') return setStatus('Create the Torn marker from a normal Torn page.');
    const marker = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: nowIso(),
      origin: location.origin,
      href: location.href,
    };
    await PDA_storage.set(APP.tornMarkerKey, marker);
    await PDA_storage.delete(APP.externalProofKey);
    const report = await snapshot('Torn marker written');
    setStatus(`Torn marker written: ${marker.id}`);
    render(report);
  }

  async function writeExternalProof() {
    if (!hasNativeStorage()) return setStatus('PDA_storage unavailable in this context.');
    const kind = hostKind();
    if (!['weav3r', 'tornexchange'].includes(kind)) {
      return setStatus('Write external proof from Weav3r or TornExchange.');
    }
    const marker = await PDA_storage.get(APP.tornMarkerKey, null);
    if (!marker) return setStatus('No Torn marker visible here. Cross-origin continuity has not been established.');
    const proof = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      writtenAt: nowIso(),
      provider: kind,
      origin: location.origin,
      href: location.href,
      sawTornMarkerId: marker.id,
    };
    await PDA_storage.set(APP.externalProofKey, proof);
    const report = await snapshot(`${kind} proof written`);
    setStatus(`External proof written from ${kind}.`);
    render(report);
  }

  async function runLocalRoundTrip() {
    if (state.running) return;
    state.running = true;
    if (!hasNativeStorage()) {
      setStatus('PDA_storage unavailable in this context.');
      state.running = false;
      return;
    }
    const expected = {
      token: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      writtenAt: nowIso(),
      origin: location.origin,
      hostKind: hostKind(),
    };
    let result;
    try {
      await PDA_storage.set(APP.roundTripKey, expected);
      const actual = await PDA_storage.get(APP.roundTripKey, null);
      result = {
        label: 'local round trip',
        checkedAt: nowIso(),
        probeVersion: APP.version,
        href: location.href,
        origin: location.origin,
        hostKind: hostKind(),
        nativeStorageAvailable: true,
        pass: JSON.stringify(actual) === JSON.stringify(expected),
        expected,
        actual,
        tornMarker: await PDA_storage.get(APP.tornMarkerKey, null),
        externalProof: await PDA_storage.get(APP.externalProofKey, null),
        usage: await PDA_storage.usage(),
      };
    } catch (error) {
      result = {
        label: 'local round trip',
        checkedAt: nowIso(),
        href: location.href,
        origin: location.origin,
        hostKind: hostKind(),
        nativeStorageAvailable: true,
        pass: false,
        error: describeError(error),
      };
    } finally {
      try { await PDA_storage.delete(APP.roundTripKey); } catch (_) {}
      state.running = false;
    }
    render(result);
    setStatus(result.pass ? 'Local native-storage round trip passed.' : 'Local native-storage round trip failed.');
  }

  async function copyReport() {
    const text = JSON.stringify(state.lastReport || { note: 'No report yet.' }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Report copied to clipboard.');
    } catch (_) {
      setStatus('Clipboard unavailable; report remains visible below.');
    }
  }

  async function clearProbeData() {
    if (!hasNativeStorage()) return setStatus('PDA_storage unavailable in this context.');
    for (const key of [APP.tornMarkerKey, APP.externalProofKey, APP.roundTripKey]) {
      try { await PDA_storage.delete(key); } catch (_) {}
    }
    const report = await snapshot('Probe data cleared');
    setStatus('Cross-origin probe data cleared.');
    render(report);
  }

  function installUi() {
    if (document.getElementById(APP.panelId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      #${APP.panelId} { position:fixed; right:12px; bottom:12px; z-index:2147483000; width:min(430px,calc(100vw - 24px)); max-height:70vh; overflow:auto; background:#111; color:#eee; border:1px solid #555; border-radius:10px; padding:12px; box-shadow:0 8px 28px rgba(0,0,0,.45); font:13px/1.35 sans-serif; }
      #${APP.panelId} h3 { margin:0 0 8px; font-size:15px; }
      #${APP.panelId} .row { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
      #${APP.panelId} button { border:1px solid #777; border-radius:7px; background:#222; color:#eee; padding:7px 9px; }
      #${APP.panelId} [data-role="status"] { margin:8px 0; color:#b9e2ff; }
      #${APP.panelId} pre { white-space:pre-wrap; word-break:break-word; max-height:32vh; overflow:auto; background:#090909; padding:8px; border-radius:6px; }
      #${APP.panelId} .note { color:#bbb; font-size:12px; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.id = APP.panelId;
    panel.innerHTML = `
      <h3>${APP.name} v${APP.version}</h3>
      <div class="note">Isolated Discovery probe. Uses only <code>${APP.keyPrefix}</code> keys and never reads TornScripture production storage.</div>
      <div class="row">
        <button data-action="snapshot">Check shared marker</button>
        <button data-action="roundtrip">Local round trip</button>
        <button data-action="copy">Copy report</button>
      </div>
      <div class="row">
        <button data-action="torn-marker">Write Torn marker</button>
        <button data-action="external-proof">Write external proof</button>
        <button data-action="clear">Clear probe data</button>
      </div>
      <div data-role="status">Ready on ${hostKind()}. PDA_storage: ${hasNativeStorage() ? 'YES' : 'NO'}.</div>
      <pre data-role="report">No report yet.</pre>
    `;
    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      try {
        if (button.dataset.action === 'snapshot') await snapshot('manual snapshot');
        if (button.dataset.action === 'roundtrip') await runLocalRoundTrip();
        if (button.dataset.action === 'copy') await copyReport();
        if (button.dataset.action === 'torn-marker') await writeTornMarker();
        if (button.dataset.action === 'external-proof') await writeExternalProof();
        if (button.dataset.action === 'clear') await clearProbeData();
      } catch (error) {
        setStatus(`Action failed: ${JSON.stringify(describeError(error))}`);
      }
    });
    document.body.appendChild(panel);
  }

  async function initialize() {
    installUi();
    await snapshot('script load');
    const marker = state.lastReport && state.lastReport.tornMarker;
    setStatus(`Ready on ${hostKind()}. PDA_storage: ${hasNativeStorage() ? 'YES' : 'NO'}. Torn marker: ${marker ? 'present' : 'absent'}.`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
