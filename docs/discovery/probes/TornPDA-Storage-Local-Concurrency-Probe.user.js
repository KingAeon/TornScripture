// ==UserScript==
// @name         TornScriptures Discovery - TornPDA Storage Local Concurrency Probe
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Disposable Q4-L probe for concurrent PDA_storage calls from one active TornPDA execution context. Never touches TornScripture product data.
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
  const MiB = 1024 * KiB;
  const APP = Object.freeze({
    name: 'TornPDA Storage Local Concurrency Probe',
    version: '0.1.0',
    panelId: 'ts-discovery-storage-local-concurrency-probe',
    styleId: 'ts-discovery-storage-local-concurrency-style',
    keyPrefix: 'ts-discovery-storage-local-concurrency:',
    expectedDefaultQuota: 10 * MiB,
    ordinaryPayloadBytes: 256 * KiB,
    batchEntryBytes: 64 * KiB,
    ordinaryAttempts: 5,
    quotaCandidateBytes: 1 * MiB,
    quotaArmMs: 30000,
  });

  const encoder = new TextEncoder();
  const state = { running: false, lastReport: null, quotaArmedUntil: 0 };

  function nowIso() { return new Date().toISOString(); }
  function bytes(text) { return encoder.encode(String(text)).byteLength; }
  function jsonBytes(value) { return bytes(JSON.stringify(value)); }
  function ownKey(name) { return `${APP.keyPrefix}${name}`; }
  function ms(n) { return Math.round(Number(n) * 1000) / 1000; }
  function token(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
  function hasNativeStorage() {
    return typeof PDA_storage !== 'undefined'
      && PDA_storage
      && typeof PDA_storage.get === 'function'
      && typeof PDA_storage.set === 'function'
      && typeof PDA_storage.setMany === 'function'
      && typeof PDA_storage.delete === 'function'
      && typeof PDA_storage.list === 'function'
      && typeof PDA_storage.usage === 'function';
  }
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
  function compactHash(text) {
    let hash = 2166136261 >>> 0;
    const value = String(text);
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }
  function makeSizedBlob(targetJsonBytes, marker, kind) {
    const target = Math.max(512, Math.floor(targetJsonBytes));
    const payload = { schema: 'ts-storage-local-concurrency', schemaVersion: 1, kind, marker, data: '' };
    const base = jsonBytes(payload);
    payload.data = 'x'.repeat(Math.max(0, target - base));
    let actual = jsonBytes(payload);
    if (actual < target) payload.data += 'x'.repeat(target - actual);
    if (actual > target) payload.data = payload.data.slice(0, Math.max(0, payload.data.length - (actual - target)));
    return payload;
  }
  async function clearOwnKeys() {
    const result = { deleted: 0, errors: [] };
    if (!hasNativeStorage()) return result;
    let keys = [];
    try { keys = await PDA_storage.list(); }
    catch (error) { result.errors.push({ stage: 'list', error: describeError(error) }); return result; }
    for (const key of keys || []) {
      if (!String(key).startsWith(APP.keyPrefix)) continue;
      try { await PDA_storage.delete(key); result.deleted += 1; }
      catch (error) { result.errors.push({ key, error: describeError(error) }); }
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
  async function copyReport() {
    const text = JSON.stringify(state.lastReport || { note: 'No report yet.' }, null, 2);
    try { await navigator.clipboard.writeText(text); setStatus('Report copied.'); }
    catch (_) { setStatus('Clipboard unavailable; report remains visible.'); }
  }

  function launchPair(fnA, fnB) {
    const issuedAAt = performance.now();
    let promiseA;
    try { promiseA = Promise.resolve(fnA()); }
    catch (error) { promiseA = Promise.reject(error); }
    const issuedBAfterA = performance.now();
    let promiseB;
    try { promiseB = Promise.resolve(fnB()); }
    catch (error) { promiseB = Promise.reject(error); }
    const issuedBAt = performance.now();
    return {
      issueSeparationMs: ms(issuedBAfterA - issuedAAt),
      issuanceWindowMs: ms(issuedBAt - issuedAAt),
      promiseA,
      promiseB,
    };
  }

  async function settlePair(launch) {
    const started = performance.now();
    const [a, b] = await Promise.allSettled([launch.promiseA, launch.promiseB]);
    return {
      totalAwaitMs: ms(performance.now() - started),
      a: a.status === 'fulfilled' ? { status: 'fulfilled' } : { status: 'rejected', error: describeError(a.reason) },
      b: b.status === 'fulfilled' ? { status: 'fulfilled' } : { status: 'rejected', error: describeError(b.reason) },
    };
  }

  async function preflight() {
    const usage = hasNativeStorage() ? await PDA_storage.usage().catch(() => null) : null;
    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q4-L preflight',
      checkedAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      usage,
      expectedDefaultQuota: APP.expectedDefaultQuota,
      quotaMatchesDefault: Number(usage?.quota) === APP.expectedDefaultQuota,
      note: 'Q4-L submits paired native-storage calls from one active execution context so Android hidden-tab timer delay is not part of the concurrency window.',
    };
    render(report);
    setStatus(hasNativeStorage() ? 'Q4-L preflight ready.' : 'PDA_storage unavailable.');
  }

  async function differentKeyAttempt(index) {
    const id = token(`l1-${index}`);
    const keyA = ownKey(`${id}:a`);
    const keyB = ownKey(`${id}:b`);
    const valueA = makeSizedBlob(APP.ordinaryPayloadBytes, `${id}:a`, 'different-key');
    const valueB = makeSizedBlob(APP.ordinaryPayloadBytes, `${id}:b`, 'different-key');
    const expectedA = JSON.stringify(valueA);
    const expectedB = JSON.stringify(valueB);
    const before = await PDA_storage.usage();
    const launch = launchPair(() => PDA_storage.set(keyA, valueA), () => PDA_storage.set(keyB, valueB));
    const settled = await settlePair(launch);
    const actualA = await PDA_storage.get(keyA, null);
    const actualB = await PDA_storage.get(keyB, null);
    const after = await PDA_storage.usage();
    const expectedDelta = bytes(keyA) + bytes(expectedA) + bytes(keyB) + bytes(expectedB);
    const exactA = JSON.stringify(actualA) === expectedA;
    const exactB = JSON.stringify(actualB) === expectedB;
    const pass = settled.a.status === 'fulfilled' && settled.b.status === 'fulfilled'
      && exactA && exactB && Number(after.used) - Number(before.used) === expectedDelta;
    await PDA_storage.delete(keyA).catch(() => {});
    await PDA_storage.delete(keyB).catch(() => {});
    const cleanupUsage = await PDA_storage.usage();
    return {
      attempt: index + 1,
      issueSeparationMs: launch.issueSeparationMs,
      issuanceWindowMs: launch.issuanceWindowMs,
      totalAwaitMs: settled.totalAwaitMs,
      outcomes: [settled.a, settled.b],
      exact: [exactA, exactB],
      hashes: [
        { expected: compactHash(expectedA), actual: actualA === null ? null : compactHash(JSON.stringify(actualA)) },
        { expected: compactHash(expectedB), actual: actualB === null ? null : compactHash(JSON.stringify(actualB)) },
      ],
      expectedDelta,
      observedDelta: Number(after.used) - Number(before.used),
      accountingExact: Number(after.used) - Number(before.used) === expectedDelta,
      cleanupReturnedToBaseline: Number(cleanupUsage.used) === Number(before.used),
      pass: pass && Number(cleanupUsage.used) === Number(before.used),
    };
  }

  async function sameKeyAttempt(index) {
    const id = token(`l2-${index}`);
    const key = ownKey(`${id}:shared`);
    const valueA = makeSizedBlob(APP.ordinaryPayloadBytes, `${id}:a`, 'same-key-a');
    const valueB = makeSizedBlob(APP.ordinaryPayloadBytes, `${id}:b`, 'same-key-b');
    const jsonA = JSON.stringify(valueA);
    const jsonB = JSON.stringify(valueB);
    const before = await PDA_storage.usage();
    const launch = launchPair(() => PDA_storage.set(key, valueA), () => PDA_storage.set(key, valueB));
    const settled = await settlePair(launch);
    const actual = await PDA_storage.get(key, null);
    const actualJson = actual === null ? null : JSON.stringify(actual);
    const winner = actualJson === jsonA ? 'A' : actualJson === jsonB ? 'B' : null;
    const after = await PDA_storage.usage();
    const expectedStoredBytes = winner === 'A' ? bytes(key) + bytes(jsonA) : winner === 'B' ? bytes(key) + bytes(jsonB) : null;
    const accountingExact = expectedStoredBytes !== null && Number(after.used) - Number(before.used) === expectedStoredBytes;
    const noCorruption = winner !== null;
    await PDA_storage.delete(key).catch(() => {});
    const cleanupUsage = await PDA_storage.usage();
    const bothFulfilled = settled.a.status === 'fulfilled' && settled.b.status === 'fulfilled';
    return {
      attempt: index + 1,
      issueSeparationMs: launch.issueSeparationMs,
      issuanceWindowMs: launch.issuanceWindowMs,
      totalAwaitMs: settled.totalAwaitMs,
      outcomes: [settled.a, settled.b],
      winner,
      finalHash: actualJson === null ? null : compactHash(actualJson),
      expectedHashes: { A: compactHash(jsonA), B: compactHash(jsonB) },
      noCorruption,
      accountingExact,
      observedDelta: Number(after.used) - Number(before.used),
      cleanupReturnedToBaseline: Number(cleanupUsage.used) === Number(before.used),
      pass: bothFulfilled && noCorruption && accountingExact && Number(cleanupUsage.used) === Number(before.used),
    };
  }

  async function batchAttempt(index) {
    const id = token(`l3-${index}`);
    const batchA = {};
    const batchB = {};
    const expected = new Map();
    for (let i = 0; i < 4; i += 1) {
      const keyA = ownKey(`${id}:a:${i}`);
      const keyB = ownKey(`${id}:b:${i}`);
      const valueA = makeSizedBlob(APP.batchEntryBytes, `${id}:a:${i}`, 'batch-a');
      const valueB = makeSizedBlob(APP.batchEntryBytes, `${id}:b:${i}`, 'batch-b');
      batchA[keyA] = valueA;
      batchB[keyB] = valueB;
      expected.set(keyA, JSON.stringify(valueA));
      expected.set(keyB, JSON.stringify(valueB));
    }
    const before = await PDA_storage.usage();
    const launch = launchPair(() => PDA_storage.setMany(batchA), () => PDA_storage.setMany(batchB));
    const settled = await settlePair(launch);
    const checks = [];
    for (const [key, expectedJson] of expected.entries()) {
      const actual = await PDA_storage.get(key, null);
      const actualJson = actual === null ? null : JSON.stringify(actual);
      checks.push({ keySuffix: key.slice(APP.keyPrefix.length), exact: actualJson === expectedJson, expectedHash: compactHash(expectedJson), actualHash: actualJson === null ? null : compactHash(actualJson) });
    }
    const after = await PDA_storage.usage();
    const expectedDelta = [...expected.entries()].reduce((sum, [key, valueJson]) => sum + bytes(key) + bytes(valueJson), 0);
    for (const key of expected.keys()) await PDA_storage.delete(key).catch(() => {});
    const cleanupUsage = await PDA_storage.usage();
    const pass = settled.a.status === 'fulfilled' && settled.b.status === 'fulfilled'
      && checks.every((c) => c.exact)
      && Number(after.used) - Number(before.used) === expectedDelta
      && Number(cleanupUsage.used) === Number(before.used);
    return {
      attempt: index + 1,
      issueSeparationMs: launch.issueSeparationMs,
      issuanceWindowMs: launch.issuanceWindowMs,
      totalAwaitMs: settled.totalAwaitMs,
      outcomes: [settled.a, settled.b],
      entriesExact: checks.every((c) => c.exact),
      checks,
      expectedDelta,
      observedDelta: Number(after.used) - Number(before.used),
      accountingExact: Number(after.used) - Number(before.used) === expectedDelta,
      cleanupReturnedToBaseline: Number(cleanupUsage.used) === Number(before.used),
      pass,
    };
  }

  async function runOrdinarySuite() {
    if (state.running) return;
    state.running = true;
    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q4-L ordinary same-context concurrency',
      runAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      cleanupBefore: null,
      baselineUsage: null,
      differentKey: [],
      sameKey: [],
      batches: [],
      finalCleanup: null,
      finalUsage: null,
      aborted: false,
      abortReason: null,
    };
    try {
      if (!hasNativeStorage()) throw new Error('PDA_storage unavailable.');
      report.cleanupBefore = await clearOwnKeys();
      if (report.cleanupBefore.errors.length) throw new Error('Could not establish clean Q4-L namespace.');
      report.baselineUsage = await PDA_storage.usage();
      for (let i = 0; i < APP.ordinaryAttempts; i += 1) {
        setStatus(`Q4-L1 different-key attempt ${i + 1}/${APP.ordinaryAttempts}...`);
        const result = await differentKeyAttempt(i);
        report.differentKey.push(result);
        if (!result.pass) throw new Error(`Q4-L1 failed attempt ${i + 1}.`);
      }
      for (let i = 0; i < APP.ordinaryAttempts; i += 1) {
        setStatus(`Q4-L2 same-key attempt ${i + 1}/${APP.ordinaryAttempts}...`);
        const result = await sameKeyAttempt(i);
        report.sameKey.push(result);
        if (!result.pass) throw new Error(`Q4-L2 failed attempt ${i + 1}.`);
      }
      for (let i = 0; i < APP.ordinaryAttempts; i += 1) {
        setStatus(`Q4-L3 batch attempt ${i + 1}/${APP.ordinaryAttempts}...`);
        const result = await batchAttempt(i);
        report.batches.push(result);
        if (!result.pass) throw new Error(`Q4-L3 failed attempt ${i + 1}.`);
      }
    } catch (error) {
      report.aborted = true;
      report.abortReason = error.message || String(error);
      report.error = describeError(error);
    } finally {
      report.finalCleanup = await clearOwnKeys();
      report.finalUsage = hasNativeStorage() ? await PDA_storage.usage().catch(() => null) : null;
      report.cleanupReturnedToBaseline = Boolean(report.finalUsage && report.baselineUsage && Number(report.finalUsage.used) === Number(report.baselineUsage.used));
      report.summary = {
        differentKeyPasses: report.differentKey.filter((r) => r.pass).length,
        sameKeyPasses: report.sameKey.filter((r) => r.pass).length,
        batchPasses: report.batches.filter((r) => r.pass).length,
        expectedAttemptsPerVariant: APP.ordinaryAttempts,
        maxIssueSeparationMs: Math.max(0, ...report.differentKey.concat(report.sameKey, report.batches).map((r) => Number(r.issueSeparationMs) || 0)),
        aborted: report.aborted,
        cleanupReturnedToBaseline: report.cleanupReturnedToBaseline,
        pass: !report.aborted
          && report.differentKey.length === APP.ordinaryAttempts && report.differentKey.every((r) => r.pass)
          && report.sameKey.length === APP.ordinaryAttempts && report.sameKey.every((r) => r.pass)
          && report.batches.length === APP.ordinaryAttempts && report.batches.every((r) => r.pass)
          && report.cleanupReturnedToBaseline,
      };
      render(report);
      setStatus(report.summary.pass ? 'Q4-L1/L2/L3 complete: all ordinary concurrent-call checks passed and cleaned.' : `Q4-L ordinary suite stopped: ${report.abortReason || 'see report'}`);
      state.running = false;
    }
  }

  async function runQuotaRace() {
    if (state.running) return;
    state.running = true;
    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q4-L4 same-context near-quota concurrent writes',
      runAt: nowIso(),
      cleanupBefore: null,
      baselineUsage: null,
      sentinel: null,
      fill: { operations: [] },
      geometry: null,
      race: null,
      integrity: null,
      finalCleanup: null,
      finalUsage: null,
      aborted: false,
      abortReason: null,
    };
    let fillKeys = [];
    try {
      if (!hasNativeStorage()) throw new Error('PDA_storage unavailable.');
      report.cleanupBefore = await clearOwnKeys();
      if (report.cleanupBefore.errors.length) throw new Error('Could not establish clean Q4-L namespace.');
      report.baselineUsage = await PDA_storage.usage();
      const quota = Number(report.baselineUsage.quota);
      if (quota !== APP.expectedDefaultQuota) throw new Error(`Q4-L4 v0.1.0 requires default 10 MiB quota; observed ${quota}.`);

      const sentinelKey = ownKey('quota-sentinel');
      const sentinelValue = { schema: 'ts-storage-local-concurrency-sentinel', token: token('sentinel'), createdAt: nowIso() };
      await PDA_storage.set(sentinelKey, sentinelValue);
      report.sentinel = { key: sentinelKey, token: sentinelValue.token };

      const keyA = ownKey('quota-candidate-a');
      const keyB = ownKey('quota-candidate-b');
      const valueA = makeSizedBlob(APP.quotaCandidateBytes, token('quota-a'), 'quota-candidate-a');
      const valueB = makeSizedBlob(APP.quotaCandidateBytes, token('quota-b'), 'quota-candidate-b');
      const deltaA = bytes(keyA) + jsonBytes(valueA);
      const deltaB = bytes(keyB) + jsonBytes(valueB);
      const maxCandidate = Math.max(deltaA, deltaB);
      const combined = deltaA + deltaB;
      const desiredRemaining = Math.floor((maxCandidate + combined) / 2);
      const targetUsed = quota - desiredRemaining;

      let usage = await PDA_storage.usage();
      let i = 0;
      while (Number(usage.used) < targetUsed) {
        const key = ownKey(`quota-fill-${i}`);
        const remainingToTarget = targetUsed - Number(usage.used);
        const keyBytes = bytes(key);
        const desiredDelta = Math.min(1 * MiB, remainingToTarget);
        if (desiredDelta <= keyBytes + 512) break;
        const value = makeSizedBlob(desiredDelta - keyBytes, token(`fill-${i}`), 'quota-fill');
        const expectedDelta = keyBytes + jsonBytes(value);
        const before = Number(usage.used);
        await PDA_storage.set(key, value);
        usage = await PDA_storage.usage();
        const actualDelta = Number(usage.used) - before;
        report.fill.operations.push({ index: i, expectedDelta, actualDelta, accountingExact: expectedDelta === actualDelta });
        if (expectedDelta !== actualDelta) throw new Error(`Fill accounting mismatch at ${i}.`);
        fillKeys.push({ key, marker: value.marker, dataLength: value.data.length });
        i += 1;
        if (i > 16) throw new Error('Fill exceeded safety chunk bound.');
      }

      const preRaceUsage = await PDA_storage.usage();
      const remaining = quota - Number(preRaceUsage.used);
      const geometryValid = remaining > deltaA && remaining > deltaB && remaining < combined;
      report.geometry = { quota, preRaceUsage, remaining, deltaA, deltaB, combined, geometryValid };
      if (!geometryValid) throw new Error('Could not establish required near-quota geometry.');

      const launch = launchPair(() => PDA_storage.set(keyA, valueA), () => PDA_storage.set(keyB, valueB));
      const settled = await settlePair(launch);
      const afterUsage = await PDA_storage.usage();
      const actualA = await PDA_storage.get(keyA, null);
      const actualB = await PDA_storage.get(keyB, null);
      const successA = settled.a.status === 'fulfilled';
      const successB = settled.b.status === 'fulfilled';
      const exactA = successA && JSON.stringify(actualA) === JSON.stringify(valueA);
      const exactB = successB && JSON.stringify(actualB) === JSON.stringify(valueB);
      const rejectAQuota = settled.a.status === 'rejected' && settled.a.error?.code === 'QuotaExceeded';
      const rejectBQuota = settled.b.status === 'rejected' && settled.b.error?.code === 'QuotaExceeded';
      const safeOutcome = (
        (successA && rejectBQuota && exactA && actualB === null)
        || (successB && rejectAQuota && exactB && actualA === null)
        || (rejectAQuota && rejectBQuota && actualA === null && actualB === null)
      ) && Number(afterUsage.used) <= quota;
      const criticalOverQuota = successA && successB && Number(afterUsage.used) > quota;
      const criticalCorruption = (successA && !exactA) || (successB && !exactB);

      const sentinelAfter = await PDA_storage.get(sentinelKey, null);
      let fillIntact = true;
      for (const entry of fillKeys) {
        const actual = await PDA_storage.get(entry.key, null);
        if (!actual || actual.marker !== entry.marker || typeof actual.data !== 'string' || actual.data.length !== entry.dataLength) {
          fillIntact = false;
          break;
        }
      }
      report.race = {
        issueSeparationMs: launch.issueSeparationMs,
        issuanceWindowMs: launch.issuanceWindowMs,
        totalAwaitMs: settled.totalAwaitMs,
        outcomes: [settled.a, settled.b],
        successA,
        successB,
        candidateAExact: successA ? exactA : actualA === null,
        candidateBExact: successB ? exactB : actualB === null,
        afterUsage,
        safeOutcome,
        criticalOverQuota,
        criticalCorruption,
      };
      report.integrity = {
        sentinelIntact: JSON.stringify(sentinelAfter) === JSON.stringify(sentinelValue),
        fillIntact,
      };
      if (criticalOverQuota) throw new Error('CRITICAL: both near-quota writes succeeded and namespace exceeded quota.');
      if (criticalCorruption) throw new Error('CRITICAL: a successful candidate payload was not exact.');
      if (!safeOutcome) throw new Error('Near-quota outcome was neither recognized safe serialization nor clean dual rejection.');
      if (!report.integrity.sentinelIntact || !fillIntact) throw new Error('Existing data changed during near-quota race.');
    } catch (error) {
      report.aborted = true;
      report.abortReason = error.message || String(error);
      report.error = describeError(error);
    } finally {
      report.finalCleanup = await clearOwnKeys();
      report.finalUsage = hasNativeStorage() ? await PDA_storage.usage().catch(() => null) : null;
      report.cleanupReturnedToBaseline = Boolean(report.finalUsage && report.baselineUsage && Number(report.finalUsage.used) === Number(report.baselineUsage.used));
      report.summary = {
        geometryValid: report.geometry?.geometryValid === true,
        safeOutcome: report.race?.safeOutcome === true,
        criticalOverQuota: report.race?.criticalOverQuota === true,
        criticalCorruption: report.race?.criticalCorruption === true,
        existingDataIntact: report.integrity?.sentinelIntact === true && report.integrity?.fillIntact === true,
        cleanupReturnedToBaseline: report.cleanupReturnedToBaseline,
        aborted: report.aborted,
        pass: !report.aborted
          && report.geometry?.geometryValid === true
          && report.race?.safeOutcome === true
          && report.race?.criticalOverQuota !== true
          && report.race?.criticalCorruption !== true
          && report.integrity?.sentinelIntact === true
          && report.integrity?.fillIntact === true
          && report.cleanupReturnedToBaseline,
      };
      render(report);
      setStatus(report.summary.pass ? 'Q4-L4 complete: near-quota concurrent calls resolved safely and namespace cleaned.' : `Q4-L4 stopped: ${report.abortReason || 'see report'}`);
      state.running = false;
    }
  }

  function installUi() {
    if (document.getElementById(APP.panelId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = `
      #${APP.panelId} { position: fixed; right: 12px; bottom: 12px; z-index: 2147483000; width: min(500px, calc(100vw - 24px)); max-height: 78vh; overflow: auto; background: #101214; color: #eee; border: 1px solid #586069; border-radius: 10px; padding: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.5); font: 13px/1.35 sans-serif; }
      #${APP.panelId} h3 { margin: 0 0 6px; font-size: 15px; }
      #${APP.panelId} .note { color: #b9c0c7; font-size: 12px; margin: 6px 0; }
      #${APP.panelId} .warning { color: #ffd38a; font-size: 12px; margin: 8px 0; }
      #${APP.panelId} .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
      #${APP.panelId} button { border: 1px solid #747d87; border-radius: 7px; background: #20252a; color: #eee; padding: 7px 9px; }
      #${APP.panelId} [data-role="status"] { color: #b9e2ff; margin: 8px 0; }
      #${APP.panelId} pre { white-space: pre-wrap; word-break: break-word; max-height: 36vh; overflow: auto; background: #08090a; padding: 8px; border-radius: 6px; }
    `;
    document.head.appendChild(style);
    const panel = document.createElement('section');
    panel.id = APP.panelId;
    panel.innerHTML = `
      <h3>${APP.name} v${APP.version}</h3>
      <div class="note">Q4-L removes hidden-tab scheduling from the first backend-concurrency test by submitting paired PDA_storage calls from one active TornPDA execution context.</div>
      <div class="row">
        <button type="button" data-action="preflight">Preflight</button>
        <button type="button" data-action="ordinary">Run Q4-L1/L2/L3</button>
        <button type="button" data-action="copy">Copy report</button>
      </div>
      <div class="warning">Q4-L4 deliberately creates near-quota pressure in this probe's own disposable namespace. First press arms for 30 seconds; second press runs it. Do not run L4 until L1/L2/L3 has been reviewed.</div>
      <div class="row">
        <button type="button" data-action="quota">Run Q4-L4 near-quota</button>
        <button type="button" data-action="clear">Clear this probe data</button>
      </div>
      <div data-role="status">Ready. PDA_storage: ${hasNativeStorage() ? 'YES' : 'NO'}.</div>
      <pre data-role="report">Press Preflight first.</pre>
    `;
    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || state.running) return;
      try {
        if (button.dataset.action === 'preflight') await preflight();
        if (button.dataset.action === 'ordinary') await runOrdinarySuite();
        if (button.dataset.action === 'copy') await copyReport();
        if (button.dataset.action === 'quota') {
          const now = Date.now();
          if (state.quotaArmedUntil < now) {
            state.quotaArmedUntil = now + APP.quotaArmMs;
            setStatus('Q4-L4 armed for 30 seconds. Press the same button again to begin near-quota race.');
            return;
          }
          state.quotaArmedUntil = 0;
          await runQuotaRace();
        }
        if (button.dataset.action === 'clear') {
          state.running = true;
          const cleanup = await clearOwnKeys();
          const usage = await PDA_storage.usage().catch(() => null);
          render({ phase: 'Q4-L clear', clearedAt: nowIso(), cleanup, usage });
          setStatus(`Cleared ${cleanup.deleted} Q4-L key(s).`);
          state.running = false;
        }
      } catch (error) {
        state.running = false;
        render({ failedAt: nowIso(), action: button.dataset.action, error: describeError(error) });
        setStatus(`Action failed: ${error?.message || error}`);
      }
    });
    document.body.appendChild(panel);
  }

  function bootstrapFailure(error) {
    try {
      const box = document.createElement('pre');
      box.textContent = `${APP.name} bootstrap failure:\n${error?.stack || error}`;
      Object.assign(box.style, { position: 'fixed', right: '8px', bottom: '8px', zIndex: '2147483647', maxWidth: 'calc(100vw - 16px)', maxHeight: '50vh', overflow: 'auto', background: '#300', color: '#fff', padding: '10px' });
      document.body.appendChild(box);
    } catch (_) {}
  }

  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi, { once: true });
    else installUi();
  } catch (error) { bootstrapFailure(error); }
})();
