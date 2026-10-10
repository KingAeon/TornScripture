// ==UserScript==
// @name         TornScriptures | TornPDA Web Locks Qualification Probe
// @namespace    tornscriptures.local.diagnostics
// @version      0.0.2
// @description  Isolated Web Locks two-tab diagnostic. No IMM, Ledger, or gameplay access.
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.__tsWebLockProbeV2) return;
  window.__tsWebLockProbeV2 = true;
  const prefix = 'ts-probe-weblocks-qualification-v2:';
  const name = prefix + 'exclusive-test';
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  const key = prefix + 'tab:' + id;
  const lines = [];
  let pendingHold = false, holding = false, releaseHold = null, waitJob = null;
  let panel, logField, statusField, peersField;
  const supported = () => !!(navigator.locks && navigator.locks.request);
  function log(message) {
    lines.push(new Date().toLocaleTimeString() + ' ' + message);
    if (lines.length > 100) lines.shift();
    if (logField) { logField.value = lines.join('\n'); logField.scrollTop = logField.scrollHeight; }
    refresh();
  }
  function ownState(state) {
    try { localStorage.setItem(key, JSON.stringify({ id, state, time: Date.now(), origin: location.origin })); }
    catch (error) { console.warn('[TS Web Locks Probe] temporary state inaccessible', error); }
  }
  function peers() {
    const rows = [];
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const k = localStorage.key(index);
        if (!k || !k.startsWith(prefix + 'tab:')) continue;
        const p = JSON.parse(localStorage.getItem(k));
        if (p && Date.now() - p.time < 1200000) rows.push(p);
      }
    } catch (error) { console.warn('[TS Web Locks Probe] peer listing unavailable', error); }
    return rows;
  }
  function refresh() {
    if (!panel) return;
    statusField.textContent = 'Tab ' + id + ' | Web Locks: ' + (supported() ? 'AVAILABLE' : 'UNAVAILABLE')
      + ' | State: ' + (holding ? 'HOLDING' : pendingHold ? 'WAITING' : 'READY');
    peersField.textContent = peers().map(p => p.id + ': ' + p.state).join(' | ') || 'No peer state visible';
  }
  async function hold() {
    if (!supported()) return log('HOLD BLOCKED: Web Locks unavailable');
    if (holding || pendingHold) return log('HOLD already active');
    pendingHold = true;
    ownState('WAITING');
    log('HOLD requested');
    try {
      await navigator.locks.request(name, { mode: 'exclusive' }, async lock => {
        if (!lock) return log('HOLD returned no lock');
        pendingHold = false;
        holding = true;
        ownState('HOLDING');
        log('LOCK ACQUIRED. Keep Tab A open while testing Tab B.');
        await new Promise(resolve => { releaseHold = resolve; });
        log('HOLD callback ending; releasing');
      });
    } catch (error) { log('HOLD ERROR: ' + String(error.name || error)); }
    finally {
      pendingHold = false;
      holding = false;
      releaseHold = null;
      ownState('READY');
      refresh();
    }
  }
  async function tryNow() {
    if (!supported()) return log('TRY BLOCKED: Web Locks unavailable');
    log('TRY requested; peer states: ' + peers().map(p => p.id + '=' + p.state).join(', '));
    try {
      await navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, lock => {
        log(lock
          ? 'TRY GRANTED. If A was still HOLDING, exclusion may NOT be shared.'
          : 'TRY DENIED: expected while Tab A owns the same lock.');
      });
    } catch (error) { log('TRY ERROR: ' + String(error.name || error)); }
  }
  async function queue() {
    if (!supported()) return log('QUEUE BLOCKED: Web Locks unavailable');
    if (waitJob) return log('QUEUE already waiting');
    const controller = new AbortController();
    const job = { controller, granted: false };
    waitJob = job;
    log('QUEUE waiting. While A holds, use CANCEL WAIT before A releases.');
    try {
      await navigator.locks.request(name, { mode: 'exclusive', signal: controller.signal }, lock => {
        if (lock) { job.granted = true; log('QUEUE GRANTED. Confirm Tab A was released first.'); }
      });
    } catch (error) { log('QUEUE ENDED: ' + String(error.name || error)); }
    finally { if (waitJob === job) waitJob = null; }
  }
  function cancelWait() {
    if (!waitJob) return log('No queue request pending');
    if (waitJob.granted) return log('Cannot cancel: queue already granted');
    waitJob.controller.abort();
    log('CANCEL WAIT sent. Confirm no later QUEUE GRANTED after A releases.');
  }
  function release() {
    if (!releaseHold) return log('No lock held here');
    const finish = releaseHold;
    releaseHold = null;
    log('RELEASE requested');
    finish();
  }
  async function copy() {
    const value = 'TornScriptures Web Locks Probe v0.0.2\n'
      + 'Tab ' + id + '\nOrigin: ' + location.origin
      + '\nUser agent: ' + navigator.userAgent
      + '\nPeer state: ' + JSON.stringify(peers())
      + '\n' + lines.join('\n');
    try {
      await navigator.clipboard.writeText(value);
      log('Log copied');
    } catch {
      logField.value = value;
      logField.select();
      log('Clipboard unavailable: manually select/copy');
    }
  }
  function clean() {
    cancelWait();
    release();
    let count = 0;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      for (const k of keys) { localStorage.removeItem(k); count++; }
    } catch (error) { log('CLEAN ERROR: ' + String(error)); }
    log('Deleted ' + count + ' disposable probe-only keys. Disable this script after testing.');
  }
  function start() {
    if (panel || !document.body) return;
    panel = document.createElement('section');
    panel.id = 'ts-web-lock-probe-v2';
    panel.style.cssText = 'position:fixed!important;bottom:10px!important;left:8px!important;z-index:2147483646!important;width:min(370px,calc(100vw - 16px))!important;max-height:78vh!important;overflow:auto!important;padding:12px!important;border:2px solid #70bdcc!important;border-radius:10px!important;background:#15202c!important;color:#fff!important;font:12px/1.4 sans-serif!important;box-shadow:0 8px 28px #000a!important';
    const title = document.createElement('strong');
    title.textContent = 'TS | TornPDA Web Locks Probe v0.0.2';
    panel.appendChild(title);
    statusField = document.createElement('div');
    statusField.style.margin = '7px 0';
    panel.appendChild(statusField);
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
    const controls = [['HOLD', hold], ['TRY NOW', tryNow], ['QUEUE', queue], ['CANCEL WAIT', cancelWait],
      ['RELEASE', release], ['REFRESH', refresh], ['COPY LOG', copy], ['CLEAR KEYS', clean]];
    controls.forEach(([label, fn]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = 'flex:1 1 27%;min-height:44px;background:#294455;color:white;border:1px solid #77afbb;border-radius:5px';
      button.addEventListener('click', fn);
      actions.appendChild(button);
    });
    panel.appendChild(actions);
    peersField = document.createElement('div');
    peersField.style.cssText = 'margin:8px 0;font-size:11px';
    panel.appendChild(peersField);
    logField = document.createElement('textarea');
    logField.readOnly = true;
    logField.style.cssText = 'width:100%;box-sizing:border-box;height:150px;background:#07101a;color:white;font:11px monospace';
    panel.appendChild(logField);
    const help = document.createElement('div');
    help.style.cssText = 'font-size:11px;margin-top:6px';
    help.textContent = 'Tab A: HOLD until LOCK ACQUIRED. Tab B: TRY NOW (expect DENIED); then QUEUE, CANCEL WAIT. Tab A: RELEASE. Confirm B never grants its canceled queue. Tab unloading makes results inconclusive.';
    panel.appendChild(help);
    document.body.appendChild(panel);
    ownState('READY');
    log('Probe loaded; origin=' + location.origin + '; Web Locks=' + supported());
  }
  window.addEventListener('pagehide', () => {
    ownState('PAGEHIDE');
    log('PAGEHIDE: lock may be released when document closes');
  });
  document.addEventListener('visibilitychange', () => {
    log('VISIBILITY=' + (document.hidden ? 'hidden' : 'visible') + '; hidden does not prove release');
  });
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
