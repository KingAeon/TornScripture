// ==UserScript==
// @name         TornScriptures Discovery - TornPDA Storage Concurrency Probe
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Disposable Q4-A probe for PDA_storage two-tab concurrency. Never touches TornScripture product data.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  if (window.top !== window.self) return;

  const KiB = 1024;
  const APP = Object.freeze({
    name: 'TornPDA Storage Concurrency Probe',
    version: '0.1.0',
    panelId: 'ts-discovery-storage-concurrency-probe',
    styleId: 'ts-discovery-storage-concurrency-style',
    keyPrefix: 'ts-discovery-storage-concurrency:',
    runKey: 'ts-discovery-storage-concurrency:run',
    runRecordBytes: 8192,
    participantRecordBytes: 4096,
    resultRecordBytes: 8192,
    payloadBytes: 256 * KiB,
    fireDelayMs: 12000,
    monitorMs: 250,
  });

  const encoder = new TextEncoder();
  const state = {
    running: false,
    lastReport: null,
    participantId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    tabUid: null,
    joinedRunId: null,
    slot: null,
    scheduledRunId: null,
    monitorBusy: false,
    localRaceResult: null,
  };

  const nowIso = () => new Date().toISOString();
  const bytes = (text) => encoder.encode(String(text)).byteLength;
  const jsonBytes = (value) => bytes(JSON.stringify(value));
  const ownKey = (suffix) => `${APP.keyPrefix}${suffix}`;
  const participantKey = (runId, participantId) => ownKey(`participant:${runId}:${participantId}`);
  const resultKey = (runId, participantId) => ownKey(`result:${runId}:${participantId}`);
  const targetKey = (runId, slot) => ownKey(`target:${runId}:slot-${slot}`);

  function describeError(error) {
    if (!error) return null;
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      code: error.code ?? null,
      used: Number.isFinite(Number(error.used)) ? Number(error.used) : null,
      quota: Number.isFinite(Number(error.quota)) ? Number(error.quota) : null,
    };
  }

  function hasNativeStorage() {
    return typeof PDA_storage !== 'undefined'
      && PDA_storage
      && typeof PDA_storage.get === 'function'
      && typeof PDA_storage.set === 'function'
      && typeof PDA_storage.list === 'function'
      && typeof PDA_storage.delete === 'function'
      && typeof PDA_storage.usage === 'function';
  }

  function hasTabBridge() {
    return Boolean(
      window.flutter_inappwebview
      && typeof window.flutter_inappwebview.callHandler === 'function'
    );
  }

  async function getTabUid() {
    if (!hasTabBridge()) return null;
    try {
      const tab = await window.flutter_inappwebview.callHandler('PDA_getTabState');
      return tab && typeof tab === 'object' ? (tab.uid ?? null) : null;
    } catch (_) {
      return null;
    }
  }

  function fixedRecord(base, targetBytes) {
    const record = { ...base, pad: '' };
    const before = jsonBytes(record);
    if (before > targetBytes) throw new Error(`FixedRecordTooLarge:${before}>${targetBytes}`);
    record.pad = 'x'.repeat(targetBytes - before);
    const after = jsonBytes(record);
    if (after !== targetBytes) throw new Error(`FixedRecordSizeMismatch:${after}!=${targetBytes}`);
    return record;
  }

  function makePayload(runId, slot) {
    const token = `q4a-${runId}-slot-${slot}`;
    const payload = {
      schema: 'ts-storage-concurrency',
      schemaVersion: 1,
      kind: 'q4a-different-key',
      runId,
      slot,
      token,
      data: '',
    };
    const before = jsonBytes(payload);
    payload.data = 'x'.repeat(APP.payloadBytes - before);
    if (jsonBytes(payload) !== APP.payloadBytes) throw new Error('Q4-A payload sizing failed.');
    return payload;
  }

  function compactHash(text) {
    let hash = 2166136261 >>> 0;
    const value = String(text);
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  async function writeRun(run) {
    await PDA_storage.set(APP.runKey, fixedRecord(run, APP.runRecordBytes));
  }

  async function readRun() {
    return await PDA_storage.get(APP.runKey, null);
  }

  async function listPrefix(prefix) {
    const keys = await PDA_storage.list();
    return (keys || []).filter((key) => String(key).startsWith(prefix));
  }

  async function readParticipants(runId) {
    const keys = await listPrefix(ownKey(`participant:${runId}:`));
    const out = [];
    for (const key of keys) {
      const value = await PDA_storage.get(key, null);
      if (value && value.runId === runId) out.push(value);
    }
    return out.sort((a, b) => Number(a.slot) - Number(b.slot));
  }

  async function readResults(runId) {
    const keys = await listPrefix(ownKey(`result:${runId}:`));
    const out = [];
    for (const key of keys) {
      const value = await PDA_storage.get(key, null);
      if (value && value.runId === runId) out.push(value);
    }
    return out.sort((a, b) => Number(a.slot ?? 99) - Number(b.slot ?? 99));
  }

  async function clearOwnKeys() {
    if (!hasNativeStorage()) return { deleted: 0, errors: [] };
    const keys = await PDA_storage.list();
    const result = { deleted: 0, errors: [] };
    for (const key of keys || []) {
      if (!String(key).startsWith(APP.keyPrefix)) continue;
      try {
        await PDA_storage.delete(key);
        result.deleted += 1;
      } catch (error) {
        result.errors.push({ key, error: describeError(error) });
      }
    }
    return result;
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

  function renderLocal(value) {
    const node = document.querySelector(`#${APP.panelId} [data-role="local"]`);
    if (node) node.textContent = value ? JSON.stringify(value, null, 2) : 'No local target-call result yet.';
  }

  async function copyLastReport() {
    const text = JSON.stringify(state.lastReport || { note: 'No report generated yet.' }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Last report copied.');
    } catch (_) {
      setStatus('Clipboard unavailable. Report remains visible.');
    }
  }

  async function preflight() {
    const usage = hasNativeStorage() ? await PDA_storage.usage().catch(() => null) : null;
    const run = hasNativeStorage() ? await readRun().catch(() => null) : null;
    const participants = run ? await readParticipants(run.runId).catch(() => []) : [];
    render({
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q4-A preflight',
      checkedAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      tabBridgeAvailable: hasTabBridge(),
      participantId: state.participantId,
      tabUid: state.tabUid,
      usage,
      currentRun: run ? {
        runId: run.runId,
        state: run.state,
        fireAt: run.fireAt ?? null,
      } : null,
      participants: participants.map((p) => ({
        participantId: p.participantId,
        slot: p.slot,
        tabUid: p.tabUid,
      })),
      note: 'v0.1.0 implements Q4-A only. Its first job is to prove that two TornPDA tabs can create a valid concurrency window.',
    });
    setStatus(hasNativeStorage() ? 'Q4-A preflight ready.' : 'PDA_storage unavailable.');
  }

  async function joinRun(run, silent = false) {
    const existing = await readParticipants(run.runId);
    const mine = existing.find((p) => p.participantId === state.participantId);
    if (mine) {
      state.joinedRunId = run.runId;
      state.slot = mine.slot;
      return mine;
    }
    if (run.state !== 'open') throw new Error('Run is no longer open for joining.');
    if (existing.length >= 2) throw new Error('Run already has two participants.');
    const usedSlots = new Set(existing.map((p) => Number(p.slot)));
    const slot = usedSlots.has(0) ? 1 : 0;
    const participant = {
      schema: 'ts-storage-concurrency-participant',
      schemaVersion: 1,
      runId: run.runId,
      participantId: state.participantId,
      slot,
      tabUid: state.tabUid,
      joinedAt: nowIso(),
      href: location.href,
    };
    await PDA_storage.set(
      participantKey(run.runId, state.participantId),
      fixedRecord(participant, APP.participantRecordBytes)
    );
    await PDA_storage.set(
      resultKey(run.runId, state.participantId),
      fixedRecord({
        schema: 'ts-storage-concurrency-result',
        schemaVersion: 1,
        runId: run.runId,
        participantId: state.participantId,
        slot,
        stage: 'placeholder',
      }, APP.resultRecordBytes)
    );
    state.joinedRunId = run.runId;
    state.slot = slot;
    state.scheduledRunId = null;
    if (!silent) {
      render({
        phase: 'Q4-A join',
        joinedAt: nowIso(),
        runId: run.runId,
        participantId: state.participantId,
        slot,
        tabUid: state.tabUid,
      });
      setStatus(`Joined Q4-A as slot ${slot}.`);
    }
    return participant;
  }

  async function createRun() {
    if (state.running) return;
    state.running = true;
    try {
      if (!hasNativeStorage()) throw new Error('PDA_storage unavailable.');
      const cleanup = await clearOwnKeys();
      if (cleanup.errors.length) throw new Error('Could not establish clean Q4-A namespace.');
      const baselineUsage = await PDA_storage.usage();
      const runId = `q4a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const run = {
        schema: 'ts-storage-concurrency-run',
        schemaVersion: 1,
        probeVersion: APP.version,
        runId,
        variant: 'A',
        state: 'open',
        createdAt: nowIso(),
        coordinatorParticipantId: state.participantId,
        coordinatorTabUid: state.tabUid,
        fireAt: null,
        preRaceUsage: null,
        baselineUsage,
        payloadBytes: APP.payloadBytes,
      };
      await writeRun(run);
      state.joinedRunId = null;
      state.slot = null;
      await joinRun(run, true);
      render({
        phase: 'Q4-A create',
        createdAt: nowIso(),
        cleanup,
        runId,
        baselineUsage,
        coordinatorParticipantId: state.participantId,
        slot: state.slot,
        tabUid: state.tabUid,
      });
      setStatus('Created Q4-A and joined as slot 0. Open a second Torn tab and press Join current run there.');
    } finally {
      state.running = false;
    }
  }

  async function joinCurrentRun() {
    if (!hasNativeStorage()) throw new Error('PDA_storage unavailable.');
    const run = await readRun();
    if (!run) throw new Error('No Q4-A run exists.');
    return await joinRun(run, false);
  }

  async function armRun() {
    if (state.running) return;
    state.running = true;
    try {
      const run = await readRun();
      if (!run || run.state !== 'open') throw new Error('No open Q4-A run to arm.');
      if (run.coordinatorParticipantId !== state.participantId) {
        throw new Error('Only the coordinator tab may arm Q4-A.');
      }
      const participants = await readParticipants(run.runId);
      if (participants.length !== 2) throw new Error(`Need exactly two participants; found ${participants.length}.`);

      const armed = {
        ...run,
        state: 'armed',
        armedAt: nowIso(),
        fireAt: Date.now() + APP.fireDelayMs,
        participantIds: participants.map((p) => p.participantId),
      };
      await writeRun(armed);
      const preRaceUsage = await PDA_storage.usage();
      await writeRun({ ...armed, preRaceUsage });
      const after = await PDA_storage.usage();
      if (Number(after.used) !== Number(preRaceUsage.used)) {
        throw new Error('Fixed-size run update changed usage unexpectedly.');
      }

      render({
        phase: 'Q4-A armed',
        armedAt: nowIso(),
        runId: run.runId,
        fireAt: armed.fireAt,
        preRaceUsage,
        participants: participants.map((p) => ({
          participantId: p.participantId,
          slot: p.slot,
          tabUid: p.tabUid,
        })),
      });
      setStatus(`Q4-A armed. Both tabs should fire in about ${APP.fireDelayMs / 1000} seconds.`);
    } finally {
      state.running = false;
    }
  }

  async function executeTarget(run) {
    if (state.localRaceResult?.runId === run.runId) return;
    const participants = await readParticipants(run.runId);
    const participant = participants.find((p) => p.participantId === state.participantId);
    if (!participant) return;

    const key = targetKey(run.runId, participant.slot);
    const payload = makePayload(run.runId, participant.slot);
    const expectedJson = JSON.stringify(payload);
    const expectedHash = compactHash(expectedJson);
    const accountingDelta = bytes(key) + jsonBytes(payload);

    const startWallMs = Date.now();
    const startPerfMs = performance.now();
    let error = null;
    try {
      await PDA_storage.set(key, payload);
    } catch (caught) {
      error = describeError(caught);
    }
    const endPerfMs = performance.now();
    const endWallMs = Date.now();

    const result = {
      schema: 'ts-storage-concurrency-result',
      schemaVersion: 1,
      runId: run.runId,
      participantId: state.participantId,
      slot: participant.slot,
      tabUid: state.tabUid,
      stage: 'completed',
      scheduledFireAt: run.fireAt,
      startWallMs,
      startIso: new Date(startWallMs).toISOString(),
      endWallMs,
      durationMs: Math.round((endPerfMs - startPerfMs) * 1000) / 1000,
      firedLateByMs: startWallMs - Number(run.fireAt),
      visibilityState: document.visibilityState,
      hasFocus: typeof document.hasFocus === 'function' ? document.hasFocus() : null,
      key,
      expectedHash,
      accountingDelta,
      success: !error,
      error,
      completedAt: nowIso(),
    };

    state.localRaceResult = result;
    renderLocal(result);
    try {
      sessionStorage.setItem(ownKey('local-result'), JSON.stringify(result));
    } catch (_) {}

    try {
      await PDA_storage.set(resultKey(run.runId, state.participantId), fixedRecord(result, APP.resultRecordBytes));
      setStatus('Q4-A target call completed in this tab. Wait for the other tab, then collect from coordinator.');
    } catch (resultError) {
      result.resultPersistenceError = describeError(resultError);
      state.localRaceResult = result;
      renderLocal(result);
      setStatus('Target call completed, but result-slot persistence failed. Preserve this local result.');
    }
  }

  async function monitorTick() {
    if (state.monitorBusy || !hasNativeStorage()) return;
    state.monitorBusy = true;
    try {
      const run = await readRun();
      if (!run || run.state !== 'armed') return;

      const participants = await readParticipants(run.runId);
      const mine = participants.find((p) => p.participantId === state.participantId);
      if (!mine) return;
      state.joinedRunId = run.runId;
      state.slot = mine.slot;

      if (state.scheduledRunId === run.runId || state.localRaceResult?.runId === run.runId) return;
      state.scheduledRunId = run.runId;

      const waitMs = Number(run.fireAt) - Date.now();
      setStatus(`Q4-A scheduled locally. Fire in ${Math.max(0, Math.round(waitMs / 1000))} seconds.`);
      setTimeout(() => {
        executeTarget(run).catch((error) => {
          const failure = {
            runId: run.runId,
            participantId: state.participantId,
            failedAt: nowIso(),
            error: describeError(error),
          };
          state.localRaceResult = failure;
          renderLocal(failure);
          setStatus(`Local Q4-A execution failed: ${error?.message || error}`);
        });
      }, Math.max(0, waitMs));
    } catch (_) {
      // Best-effort monitor. Explicit actions report their own errors.
    } finally {
      state.monitorBusy = false;
    }
  }

  function concurrencyQuality(separationMs) {
    if (separationMs <= 25) return 'strong';
    if (separationMs <= 100) return 'weak-but-usable';
    return 'inconclusive';
  }

  async function collect() {
    if (state.running) return;
    state.running = true;
    try {
      const run = await readRun();
      if (!run) throw new Error('No Q4-A run exists.');
      const participants = await readParticipants(run.runId);
      const results = await readResults(run.runId);
      const completed = results.filter((r) => r.stage === 'completed');

      if (participants.length !== 2 || completed.length !== 2) {
        render({
          phase: 'Q4-A collect waiting',
          checkedAt: nowIso(),
          runId: run.runId,
          participantCount: participants.length,
          completedResultCount: completed.length,
          resultStages: results.map((r) => ({
            participantId: r.participantId,
            slot: r.slot,
            stage: r.stage,
          })),
        });
        setStatus(`Waiting for both tabs: ${completed.length}/2 completed results.`);
        return;
      }

      completed.sort((a, b) => Number(a.slot) - Number(b.slot));
      const separationMs = Math.abs(Number(completed[0].startWallMs) - Number(completed[1].startWallMs));
      const quality = concurrencyQuality(separationMs);
      const checks = [];

      for (const result of completed) {
        const actual = await PDA_storage.get(result.key, null);
        const expected = makePayload(run.runId, result.slot);
        const actualJson = actual === null ? null : JSON.stringify(actual);
        const expectedJson = JSON.stringify(expected);
        checks.push({
          slot: result.slot,
          key: result.key,
          success: result.success,
          present: actual !== null,
          exact: actualJson === expectedJson,
          expectedHash: compactHash(expectedJson),
          actualHash: actualJson === null ? null : compactHash(actualJson),
        });
      }

      const usageBeforeCleanup = await PDA_storage.usage();
      const expectedDelta = completed
        .filter((r) => r.success)
        .reduce((sum, r) => sum + Number(r.accountingDelta), 0);
      const expectedUsage = Number(run.preRaceUsage?.used) + expectedDelta;
      const accountingExact = Number(usageBeforeCleanup.used) === expectedUsage;
      const integrityPass = checks.every((c) => c.success && c.present && c.exact) && accountingExact;
      const validConcurrency = quality !== 'inconclusive';

      const report = {
        probe: APP.name,
        probeVersion: APP.version,
        phase: 'Q4-A simultaneous different-key writes',
        collectedAt: nowIso(),
        href: location.href,
        userAgent: navigator.userAgent,
        run: {
          runId: run.runId,
          createdAt: run.createdAt,
          armedAt: run.armedAt,
          fireAt: run.fireAt,
          baselineUsage: run.baselineUsage,
          preRaceUsage: run.preRaceUsage,
        },
        participants: participants.map((p) => ({
          participantId: p.participantId,
          slot: p.slot,
          tabUid: p.tabUid,
          joinedAt: p.joinedAt,
        })),
        results: completed.map((r) => ({
          participantId: r.participantId,
          slot: r.slot,
          tabUid: r.tabUid,
          startWallMs: r.startWallMs,
          startIso: r.startIso,
          durationMs: r.durationMs,
          firedLateByMs: r.firedLateByMs,
          visibilityState: r.visibilityState,
          hasFocus: r.hasFocus,
          success: r.success,
          error: r.error,
          accountingDelta: r.accountingDelta,
        })),
        startSeparationMs: separationMs,
        concurrencyQuality: quality,
        targetChecks: checks,
        usageBeforeCleanup,
        expectedUsageBeforeCleanup: expectedUsage,
        accountingExact,
        integrityPass,
        summary: {
          actualConcurrencyValid: validConcurrency,
          concurrencyQuality: quality,
          startSeparationMs: separationMs,
          integrityPass,
          pass: validConcurrency && integrityPass,
          interpretation: !validConcurrency
            ? 'INCONCLUSIVE - target calls started more than 100 ms apart.'
            : integrityPass
              ? 'PASS - valid Q4-A concurrency attempt with exact independent-write integrity.'
              : 'FAIL - valid concurrency attempt produced an integrity/accounting problem.',
        },
        cleanup: null,
        finalUsage: null,
      };

      state.lastReport = report;
      report.cleanup = await clearOwnKeys();
      report.finalUsage = await PDA_storage.usage();
      report.cleanupReturnedToBaseline = Number(report.finalUsage.used) === Number(run.baselineUsage?.used);
      report.summary.cleanupReturnedToBaseline = report.cleanupReturnedToBaseline;
      report.summary.pass = report.summary.pass && report.cleanupReturnedToBaseline;

      render(report);
      setStatus(`${report.summary.interpretation} Cleanup ${report.cleanupReturnedToBaseline ? 'returned to baseline' : 'did not return to baseline'}.`);

      state.joinedRunId = null;
      state.slot = null;
      state.scheduledRunId = null;
      state.localRaceResult = null;
      try { sessionStorage.removeItem(ownKey('local-result')); } catch (_) {}
      renderLocal(null);
    } finally {
      state.running = false;
    }
  }

  function installUi() {
    if (document.getElementById(APP.panelId)) return;

    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      #${APP.panelId} {
        position: fixed; right: 12px; bottom: 12px; z-index: 2147483000;
        width: min(500px, calc(100vw - 24px)); max-height: 78vh; overflow: auto;
        background: #101214; color: #eee; border: 1px solid #586069; border-radius: 10px;
        padding: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.5); font: 13px/1.35 sans-serif;
      }
      #${APP.panelId} h3 { margin: 0 0 6px; font-size: 15px; }
      #${APP.panelId} .note { color: #b9c0c7; font-size: 12px; margin: 6px 0; }
      #${APP.panelId} .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
      #${APP.panelId} button {
        border: 1px solid #747d87; border-radius: 7px; background: #20252a; color: #eee;
        padding: 7px 9px;
      }
      #${APP.panelId} [data-role="status"] { color: #b9e2ff; margin: 8px 0; }
      #${APP.panelId} pre {
        white-space: pre-wrap; word-break: break-word; max-height: 28vh; overflow: auto;
        background: #08090a; padding: 8px; border-radius: 6px;
      }
      #${APP.panelId} details { margin-top: 8px; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.id = APP.panelId;
    panel.innerHTML = `
      <h3>${APP.name} v${APP.version}</h3>
      <div class="note">Q4-A only: two TornPDA tabs, simultaneous 256 KiB writes to different native keys. First objective is validating the race harness itself.</div>
      <div class="row">
        <button type="button" data-action="preflight">Preflight</button>
        <button type="button" data-action="create">Create Q4-A</button>
        <button type="button" data-action="join">Join current run</button>
      </div>
      <div class="row">
        <button type="button" data-action="arm">Arm Q4-A</button>
        <button type="button" data-action="collect">Collect + cleanup</button>
        <button type="button" data-action="copy">Copy report</button>
      </div>
      <div class="row">
        <button type="button" data-action="clear">Emergency clear Q4-A keys</button>
      </div>
      <div data-role="identity">Participant: ${state.participantId} | Tab UID: loading...</div>
      <div data-role="status">Initializing...</div>
      <pre data-role="report">Press Preflight first.</pre>
      <details>
        <summary>Local target-call result</summary>
        <pre data-role="local">No local target-call result yet.</pre>
      </details>
    `;

    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || state.running) return;
      try {
        if (button.dataset.action === 'preflight') await preflight();
        if (button.dataset.action === 'create') await createRun();
        if (button.dataset.action === 'join') await joinCurrentRun();
        if (button.dataset.action === 'arm') await armRun();
        if (button.dataset.action === 'collect') await collect();
        if (button.dataset.action === 'copy') await copyLastReport();
        if (button.dataset.action === 'clear') {
          state.running = true;
          const cleanup = await clearOwnKeys();
          const usage = await PDA_storage.usage().catch(() => null);
          render({ phase: 'Q4-A emergency clear', clearedAt: nowIso(), cleanup, usage });
          setStatus(`Cleared ${cleanup.deleted} Q4-A key(s).`);
          state.running = false;
        }
      } catch (error) {
        state.running = false;
        render({ failedAt: nowIso(), action: button.dataset.action, error: describeError(error) });
        setStatus(`Action failed: ${error?.message || error}`);
      }
    });

    document.body.appendChild(panel);

    getTabUid().then((uid) => {
      state.tabUid = uid;
      const identity = document.querySelector(`#${APP.panelId} [data-role="identity"]`);
      if (identity) identity.textContent = `Participant: ${state.participantId} | Tab UID: ${uid || 'unavailable'}`;
      setStatus(`Ready. PDA_storage: ${hasNativeStorage() ? 'YES' : 'NO'}.`);
    });

    try {
      const restored = sessionStorage.getItem(ownKey('local-result'));
      if (restored) {
        state.localRaceResult = JSON.parse(restored);
        renderLocal(state.localRaceResult);
      }
    } catch (_) {}

    setInterval(() => { monitorTick(); }, APP.monitorMs);
  }

  function bootstrapFailure(error) {
    try {
      const box = document.createElement('pre');
      box.textContent = `${APP.name} bootstrap failure:\n${error?.stack || error}`;
      Object.assign(box.style, {
        position: 'fixed',
        right: '8px',
        bottom: '8px',
        zIndex: '2147483647',
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: '50vh',
        overflow: 'auto',
        background: '#300',
        color: '#fff',
        padding: '10px',
      });
      document.body.appendChild(box);
    } catch (_) {}
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installUi, { once: true });
    } else {
      installUi();
    }
  } catch (error) {
    bootstrapFailure(error);
  }
})();
