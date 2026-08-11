// ==UserScript==
// @name         TornScriptures Discovery - TornPDA Storage Qualification Probe
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.1
// @description  Disposable Age of Discovery probe for PDA_storage scaling, batching, quota rejection, and cleanup integrity. Never touches TornScripture product data.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const KiB = 1024;
  const MiB = 1024 * KiB;
  const APP = Object.freeze({
    name: 'TornPDA Storage Qualification Probe',
    version: '0.1.1',
    panelId: 'ts-discovery-storage-qualification-probe',
    styleId: 'ts-discovery-storage-qualification-style',
    keyPrefix: 'ts-discovery-storage-qualification:',
    controlKey: 'ts-discovery-storage-qualification:control',
    expectedDefaultQuota: 10 * MiB,
    maxQuotaTestQuota: 12 * MiB,
    slowOperationMs: 5000,
  });

  const state = { running: false, lastReport: null, quotaArmedUntil: 0 };

  // TornPDA normalizes literal smart quotes/apostrophes in userscript source before execution.
  // Keep this probe's source free of those literals and construct Unicode test characters by code point.
  const UNICODE_PHRASE = [
    'Ledger ',
    String.fromCodePoint(0x1F510),
    ' cafe', String.fromCodePoint(0x0301),
    ' ', String.fromCodePoint(0x65E5, 0x672C, 0x8A9E),
    ' ', String.fromCodePoint(0x2014),
    ' quoted apostrophe | ',
  ].join('');

  function nowIso() { return new Date().toISOString(); }
  function hasNativeStorage() {
    return typeof PDA_storage !== 'undefined'
      && PDA_storage
      && typeof PDA_storage.get === 'function'
      && typeof PDA_storage.set === 'function'
      && typeof PDA_storage.delete === 'function'
      && typeof PDA_storage.list === 'function'
      && typeof PDA_storage.loadAll === 'function'
      && typeof PDA_storage.getMany === 'function'
      && typeof PDA_storage.setMany === 'function'
      && typeof PDA_storage.usage === 'function';
  }
  function utf8Bytes(text) {
    const value = String(text);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength;
    return unescape(encodeURIComponent(value)).length;
  }
  function jsonBytes(value) { return utf8Bytes(JSON.stringify(value)); }
  function ownKey(name) { return APP.keyPrefix + name; }
  function ms(value) { return Math.round(Number(value) * 1000) / 1000; }
  function token(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10); }
  function describeError(error) {
    if (!error) return { name: 'Error', message: 'Unknown error', code: null, used: null, quota: null };
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      code: error.code || null,
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
  async function timed(fn) {
    const started = performance.now();
    const value = await fn();
    return { value, durationMs: ms(performance.now() - started) };
  }
  function setStatus(text) {
    const node = document.querySelector('#' + APP.panelId + ' [data-role="status"]');
    if (node) node.textContent = text;
  }
  function render(value) {
    state.lastReport = value;
    const node = document.querySelector('#' + APP.panelId + ' [data-role="report"]');
    if (node) node.textContent = JSON.stringify(value, null, 2);
  }
  async function copyLastReport() {
    const text = JSON.stringify(state.lastReport || { note: 'No report generated yet.' }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Last report copied.');
    } catch (_) {
      setStatus('Clipboard unavailable. Report remains visible below.');
    }
  }
  async function clearOwnKeys() {
    const result = { deleted: 0, errors: [] };
    if (!hasNativeStorage()) return result;
    let keys = [];
    try { keys = await PDA_storage.list(); }
    catch (error) {
      result.errors.push({ stage: 'list', error: describeError(error) });
      return result;
    }
    for (const key of keys || []) {
      if (!String(key).startsWith(APP.keyPrefix)) continue;
      try { await PDA_storage.delete(key); result.deleted += 1; }
      catch (error) { result.errors.push({ key, error: describeError(error) }); }
    }
    return result;
  }

  function makeSizedBlob(targetJsonBytes, id, kind) {
    const target = Math.max(256, Math.floor(Number(targetJsonBytes) || 0));
    const value = { schema: 'ts-storage-qualification', schemaVersion: 1, kind, token: id, data: '' };
    let need = Math.max(0, target - jsonBytes(value));
    value.data = 'x'.repeat(need);
    let actual = jsonBytes(value);
    if (actual < target) value.data += 'x'.repeat(target - actual);
    if (actual > target && value.data.length >= actual - target) value.data = value.data.slice(0, value.data.length - (actual - target));
    return value;
  }

  function makeUnicodePayload(targetJsonBytes, id) {
    const target = Math.max(8 * KiB, Math.floor(Number(targetJsonBytes) || 0));
    const value = { schema: 'ts-storage-qualification', schemaVersion: 1, kind: 'unicode-text', token: id, text: '' };
    const phraseBytes = Math.max(1, utf8Bytes(UNICODE_PHRASE));
    const repeats = Math.max(1, Math.ceil((target - jsonBytes(value)) / phraseBytes));
    value.text = UNICODE_PHRASE.repeat(repeats);
    return value;
  }

  function ledgerRecord(i, id) {
    const itemId = 200 + (i % 950);
    const quantity = 1 + (i % 97);
    const unitCost = 100 + ((i * 7919) % 250000);
    const traderValue = Math.max(1, unitCost + ((i % 17) - 5) * 137);
    return {
      id: 'synthetic-lot-' + id + '-' + i,
      schemaVersion: 2,
      source: i % 3 === 0 ? 'item-market' : 'synthetic-discovery',
      venue: 'item-market',
      fundingSource: ['personal', 'shared', 'other'][i % 3],
      itemId,
      itemName: 'Synthetic Item ' + itemId,
      normalizedName: 'synthetic item ' + itemId,
      quantity,
      remainingQuantity: quantity,
      unitCost,
      totalCost: unitCost * quantity,
      marketValueAtPurchase: traderValue + 250,
      traderValueAtPurchase: traderValue,
      expectedProfitEach: traderValue - unitCost,
      expectedProfitTotal: (traderValue - unitCost) * quantity,
      capturedAt: new Date(1786000000000 + i * 37000).toISOString(),
      purchaseUrl: 'https://www.torn.com/page.php?sid=ItemMarket#/market/view=item&itemID=' + itemId,
      captureMethod: i % 2 === 0 ? 'fetch-success' : 'dom-success-fallback',
      status: 'open',
      notes: 'Synthetic qualification record ' + i + '. No owner transaction data.',
    };
  }

  function historyRecord(i, id) {
    const playerId = 1000000 + (i % 2000);
    return {
      id: id + '-' + i,
      playerId: String(playerId),
      name: 'Synthetic Player ' + playerId,
      factionId: String(1000 + (i % 40)),
      activity: ['online', 'idle', 'offline'][i % 3],
      life: ['okay', 'hospital', 'traveling', 'abroad'][i % 4],
      observedAt: new Date(1786000000000 + i * 60000).toISOString(),
      sourceUrl: 'https://www.torn.com/factions.php?step=profile&ID=' + (1000 + (i % 40)),
      collector: 'synthetic-' + (i % 5),
    };
  }

  function makeRecordPayload(shape, targetJsonBytes, id) {
    const target = Math.max(8 * KiB, Math.floor(Number(targetJsonBytes) || 0));
    const factory = shape === 'history-like' ? historyRecord : ledgerRecord;
    const sampleBytes = Math.max(1, jsonBytes(factory(0, id)) + 1);
    let count = Math.max(1, Math.floor((target - 180) / sampleBytes));
    const records = Array.from({ length: count }, (_, i) => factory(i, id));
    const value = { schema: 'ts-storage-qualification', schemaVersion: 1, kind: shape, token: id, records };
    let actual = jsonBytes(value);
    let guard = 0;
    while (guard < 8 && actual < target * 0.97) {
      const add = Math.max(1, Math.floor((target - actual) / sampleBytes));
      const start = records.length;
      for (let i = 0; i < add; i += 1) records.push(factory(start + i, id));
      actual = jsonBytes(value);
      guard += 1;
    }
    while (records.length > 1 && actual > target * 1.08 && guard < 16) {
      const remove = Math.min(records.length - 1, Math.max(1, Math.floor((actual - target) / sampleBytes)));
      records.splice(records.length - remove, remove);
      actual = jsonBytes(value);
      guard += 1;
    }
    return value;
  }

  function buildPayload(shape, targetJsonBytes, id) {
    if (shape === 'unicode-text') return makeUnicodePayload(targetJsonBytes, id);
    if (shape === 'blob-like') return makeSizedBlob(targetJsonBytes, id, shape);
    return makeRecordPayload(shape, targetJsonBytes, id);
  }

  async function runStorageCase(plan) {
    const id = token(plan.shape);
    const key = ownKey('case-' + plan.shape + '-' + plan.targetJsonBytes + '-' + id);
    const generationStart = performance.now();
    const payload = buildPayload(plan.shape, plan.targetJsonBytes, id);
    const generationMs = ms(performance.now() - generationStart);
    const expectedJson = JSON.stringify(payload);
    const valueBytes = utf8Bytes(expectedJson);
    const keyBytes = utf8Bytes(key);
    const expectedDelta = keyBytes + valueBytes;
    const expectedHash = compactHash(expectedJson);
    const usageBefore = await PDA_storage.usage();
    let usageAfterWrite = null;
    let usageAfterDelete = null;
    try {
      const write = await timed(() => PDA_storage.set(key, payload));
      usageAfterWrite = await PDA_storage.usage();
      const read = await timed(() => PDA_storage.get(key, null));
      const actualJson = JSON.stringify(read.value);
      const actualHash = compactHash(actualJson);
      let load = null;
      let loadExact = null;
      if (plan.loadAll) {
        load = await timed(() => PDA_storage.loadAll());
        loadExact = JSON.stringify(load.value && load.value[key]) === expectedJson;
      }
      const deletion = await timed(() => PDA_storage.delete(key));
      usageAfterDelete = await PDA_storage.usage();
      const observedDelta = Number(usageAfterWrite.used) - Number(usageBefore.used);
      const exactEqual = actualJson === expectedJson;
      const pass = exactEqual
        && actualHash === expectedHash
        && observedDelta === expectedDelta
        && Number(usageAfterDelete.used) === Number(usageBefore.used)
        && (loadExact !== false)
        && write.durationMs <= APP.slowOperationMs
        && read.durationMs <= APP.slowOperationMs
        && (!load || load.durationMs <= APP.slowOperationMs);
      return {
        shape: plan.shape,
        targetJsonBytes: plan.targetJsonBytes,
        actualJsonBytes: valueBytes,
        recordCount: Array.isArray(payload.records) ? payload.records.length : null,
        keyBytes,
        expectedAccountingDelta: expectedDelta,
        observedAccountingDelta: observedDelta,
        accountingExact: observedDelta === expectedDelta,
        generationMs,
        setMs: write.durationMs,
        getMs: read.durationMs,
        loadAllMs: load ? load.durationMs : null,
        deleteMs: deletion.durationMs,
        exactEqual,
        expectedHash,
        actualHash,
        loadAllContainsExactValue: loadExact,
        cleanupReturnedToBaseline: Number(usageAfterDelete.used) === Number(usageBefore.used),
        usageBefore,
        usageAfterWrite,
        usageAfterDelete,
        pass,
      };
    } catch (error) {
      try { await PDA_storage.delete(key); } catch (_) {}
      try { usageAfterDelete = await PDA_storage.usage(); } catch (_) {}
      return {
        shape: plan.shape,
        targetJsonBytes: plan.targetJsonBytes,
        actualJsonBytes: valueBytes,
        expectedAccountingDelta: expectedDelta,
        usageBefore,
        usageAfterWrite,
        usageAfterDelete,
        error: describeError(error),
        pass: false,
      };
    }
  }

  async function runBatchCase() {
    const id = token('batch');
    const obj = {};
    const expected = {};
    let expectedDelta = 0;
    for (let i = 0; i < 4; i += 1) {
      const key = ownKey('batch-' + i + '-' + id);
      const value = makeSizedBlob(256 * KiB, id + '-' + i, 'batch-part');
      obj[key] = value;
      expected[key] = JSON.stringify(value);
      expectedDelta += utf8Bytes(key) + utf8Bytes(expected[key]);
    }
    const keys = Object.keys(obj);
    const usageBefore = await PDA_storage.usage();
    try {
      const write = await timed(() => PDA_storage.setMany(obj));
      const usageAfterWrite = await PDA_storage.usage();
      const read = await timed(() => PDA_storage.getMany(keys));
      const entries = keys.map((key) => {
        const actualJson = JSON.stringify(read.value && read.value[key]);
        return {
          keySuffix: key.slice(APP.keyPrefix.length),
          exactEqual: actualJson === expected[key],
          expectedHash: compactHash(expected[key]),
          actualHash: compactHash(actualJson),
          jsonBytes: utf8Bytes(expected[key]),
        };
      });
      for (const key of keys) await PDA_storage.delete(key);
      const usageAfterDelete = await PDA_storage.usage();
      const observedDelta = Number(usageAfterWrite.used) - Number(usageBefore.used);
      return {
        entryCount: keys.length,
        expectedAccountingDelta: expectedDelta,
        observedAccountingDelta: observedDelta,
        accountingExact: observedDelta === expectedDelta,
        setManyMs: write.durationMs,
        getManyMs: read.durationMs,
        entries,
        allEntriesExact: entries.every((entry) => entry.exactEqual && entry.expectedHash === entry.actualHash),
        cleanupReturnedToBaseline: Number(usageAfterDelete.used) === Number(usageBefore.used),
        usageBefore,
        usageAfterWrite,
        usageAfterDelete,
        pass: observedDelta === expectedDelta
          && entries.every((entry) => entry.exactEqual && entry.expectedHash === entry.actualHash)
          && Number(usageAfterDelete.used) === Number(usageBefore.used)
          && write.durationMs <= APP.slowOperationMs
          && read.durationMs <= APP.slowOperationMs,
      };
    } catch (error) {
      for (const key of keys) { try { await PDA_storage.delete(key); } catch (_) {} }
      return { pass: false, error: describeError(error), usageAfterCleanup: await PDA_storage.usage().catch(() => null) };
    }
  }

  async function preflightSnapshot() {
    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q0 preflight',
      checkedAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      usage: null,
      expectedDefaultQuota: APP.expectedDefaultQuota,
      quotaMatchesDefault: null,
      bridgeReady: false,
      injectionNormalizationSafe: true,
      notes: [
        'v0.1.1 avoids literal smart quote/apostrophe characters because TornPDA normalizes them before execution.',
        'Q1/Q2 uses bounded synthetic payloads and deletes each large case before advancing.',
        'Q3 is separate and double-armed; do not run until Q1/Q2 is reviewed.',
      ],
    };
    if (hasNativeStorage()) {
      try {
        report.usage = await PDA_storage.usage();
        report.bridgeReady = Number(report.usage && report.usage.quota) > 0;
        report.quotaMatchesDefault = Number(report.usage && report.usage.quota) === APP.expectedDefaultQuota;
      } catch (error) { report.usageError = describeError(error); }
    }
    render(report);
    setStatus(hasNativeStorage() ? 'Ready. Native quota: ' + (report.usage ? report.usage.quota : 'unknown') + ' bytes.' : 'PDA_storage unavailable.');
  }

  async function runScalingBenchmark() {
    if (state.running) return;
    state.running = true;
    setStatus('Running Q1/Q2 bounded scaling benchmark...');
    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q1/Q2 scaling and batch profile',
      runAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      cleanupBefore: null,
      baselineUsage: null,
      controlUsage: null,
      cases: [],
      batch: null,
      finalCleanup: null,
      finalUsage: null,
      aborted: false,
      abortReason: null,
    };
    if (!hasNativeStorage()) {
      report.aborted = true;
      report.abortReason = 'PDA_storage unavailable.';
      render(report);
      setStatus(report.abortReason);
      state.running = false;
      return;
    }
    try {
      report.cleanupBefore = await clearOwnKeys();
      if (report.cleanupBefore.errors.length) throw new Error('Could not establish a clean qualification namespace.');
      report.baselineUsage = await PDA_storage.usage();
      const control = { token: token('control'), createdAt: nowIso(), purpose: 'Detect unintended mutation during synthetic qualification.' };
      await PDA_storage.set(APP.controlKey, control);
      report.controlUsage = await PDA_storage.usage();
      const plans = [
        { shape: 'unicode-text', targetJsonBytes: 64 * KiB, loadAll: false },
        { shape: 'blob-like', targetJsonBytes: 64 * KiB, loadAll: false },
        { shape: 'blob-like', targetJsonBytes: 256 * KiB, loadAll: false },
        { shape: 'blob-like', targetJsonBytes: 1 * MiB, loadAll: true },
        { shape: 'ledger-like', targetJsonBytes: 64 * KiB, loadAll: false },
        { shape: 'ledger-like', targetJsonBytes: 256 * KiB, loadAll: false },
        { shape: 'ledger-like', targetJsonBytes: 1 * MiB, loadAll: true },
        { shape: 'history-like', targetJsonBytes: 1 * MiB, loadAll: true },
      ];
      for (let i = 0; i < plans.length; i += 1) {
        const plan = plans[i];
        setStatus('Q1 case ' + (i + 1) + '/' + plans.length + ': ' + plan.shape + ' ' + Math.round(plan.targetJsonBytes / KiB) + ' KiB');
        const result = await runStorageCase(plan);
        report.cases.push(result);
        if (!result.pass) { report.aborted = true; report.abortReason = 'Case failed: ' + plan.shape + ' ' + plan.targetJsonBytes + ' bytes.'; break; }
        const controlAfter = await PDA_storage.get(APP.controlKey, null);
        if (JSON.stringify(controlAfter) !== JSON.stringify(control)) { report.aborted = true; report.abortReason = 'Control record changed during scaling benchmark.'; break; }
      }
      if (!report.aborted) {
        setStatus('Running Q2 ~1 MiB setMany/getMany profile...');
        report.batch = await runBatchCase();
        if (!report.batch.pass) { report.aborted = true; report.abortReason = 'Batch profile failed.'; }
      }
      const finalControl = await PDA_storage.get(APP.controlKey, null);
      report.controlIntactAtEnd = JSON.stringify(finalControl) === JSON.stringify(control);
    } catch (error) {
      report.aborted = true;
      report.abortReason = 'Unexpected benchmark exception.';
      report.error = describeError(error);
    } finally {
      report.finalCleanup = await clearOwnKeys();
      try { report.finalUsage = await PDA_storage.usage(); } catch (error) { report.finalUsageError = describeError(error); }
      report.cleanupReturnedToCleanBaseline = Boolean(report.finalUsage && report.baselineUsage && Number(report.finalUsage.used) === Number(report.baselineUsage.used));
      report.summary = {
        caseCount: report.cases.length,
        casePasses: report.cases.filter((entry) => entry.pass).length,
        batchPass: report.batch ? Boolean(report.batch.pass) : null,
        controlIntactAtEnd: report.controlIntactAtEnd === true,
        cleanupReturnedToCleanBaseline: report.cleanupReturnedToCleanBaseline,
        aborted: report.aborted,
        pass: !report.aborted
          && report.cases.length === 8
          && report.cases.every((entry) => entry.pass)
          && report.batch && report.batch.pass === true
          && report.controlIntactAtEnd === true
          && report.cleanupReturnedToCleanBaseline === true,
      };
      render(report);
      setStatus(report.summary.pass ? 'Q1/Q2 PASS. All synthetic data cleaned.' : 'Q1/Q2 stopped: ' + (report.abortReason || 'see report'));
      state.running = false;
    }
  }

  async function verifyFillKeys(fillKeys) {
    for (const entry of fillKeys) {
      const actual = await PDA_storage.get(entry.key, null);
      if (!actual || actual.token !== entry.token || typeof actual.data !== 'string' || actual.data.length !== entry.dataLength) return false;
    }
    return true;
  }

  async function runQuotaAtomicity() {
    if (state.running) return;
    state.running = true;
    setStatus('Running Q3 quota/atomicity test...');
    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q3 default-quota rejection and atomicity',
      runAt: nowIso(),
      nativeStorageAvailable: hasNativeStorage(),
      cleanupBefore: null,
      baselineUsage: null,
      fill: { targetFraction: 0.80, operations: [], keys: 0 },
      failedSet: null,
      failedSetMany: null,
      integrityAfterFailures: null,
      finalCleanup: null,
      finalUsage: null,
      aborted: false,
      abortReason: null,
    };
    let fillKeys = [];
    let sentinel = null;
    try {
      if (!hasNativeStorage()) throw new Error('PDA_storage unavailable.');
      report.cleanupBefore = await clearOwnKeys();
      if (report.cleanupBefore.errors.length) throw new Error('Could not clean qualification namespace.');
      report.baselineUsage = await PDA_storage.usage();
      const quota = Number(report.baselineUsage.quota) || 0;
      if (quota !== APP.expectedDefaultQuota || quota > APP.maxQuotaTestQuota || quota < 4 * MiB) {
        report.aborted = true;
        report.abortReason = 'Q3 v0.1.1 requires the untouched 10 MiB default quota.';
        return;
      }
      sentinel = { token: token('quota-sentinel'), createdAt: nowIso(), purpose: 'Must survive rejected writes unchanged.' };
      await PDA_storage.set(APP.controlKey, sentinel);
      let usage = await PDA_storage.usage();
      const targetUsed = Math.floor(quota * report.fill.targetFraction);
      let index = 0;
      while (Number(usage.used) < targetUsed) {
        const key = ownKey('quota-fill-' + index);
        const remainingToTarget = targetUsed - Number(usage.used);
        const keyBytes = utf8Bytes(key);
        const desiredDelta = Math.min(1 * MiB, Math.max(64 * KiB, remainingToTarget));
        const value = makeSizedBlob(Math.max(512, desiredDelta - keyBytes), token('fill-' + index), 'quota-fill');
        const before = Number(usage.used);
        const write = await timed(() => PDA_storage.set(key, value));
        usage = await PDA_storage.usage();
        const expectedDelta = keyBytes + jsonBytes(value);
        const actualDelta = Number(usage.used) - before;
        report.fill.operations.push({ index, expectedDelta, actualDelta, accountingExact: expectedDelta === actualDelta, setMs: write.durationMs });
        if (expectedDelta !== actualDelta || write.durationMs > APP.slowOperationMs) throw new Error('Quota fill accounting/timing failure.');
        fillKeys.push({ key, token: value.token, dataLength: value.data.length });
        index += 1;
        if (index > 16) throw new Error('Quota fill exceeded chunk safety bound.');
      }
      report.fill.keys = fillKeys.length;
      const preFailureUsage = await PDA_storage.usage();
      const remaining = quota - Number(preFailureUsage.used);
      const rejectKey = ownKey('quota-rejected-single');
      const rejectValue = makeSizedBlob(remaining + 128 * KiB, token('reject-single'), 'quota-rejected-single');
      let singleError = null;
      const beforeSingle = await PDA_storage.usage();
      try { await PDA_storage.set(rejectKey, rejectValue); } catch (error) { singleError = describeError(error); }
      const afterSingle = await PDA_storage.usage();
      const rejectedValue = await PDA_storage.get(rejectKey, '__missing__');
      report.failedSet = {
        error: singleError,
        errorCodeCorrect: singleError && singleError.code === 'QuotaExceeded',
        rejectedKeyAbsent: rejectedValue === '__missing__',
        usageUnchanged: Number(afterSingle.used) === Number(beforeSingle.used),
      };
      report.failedSet.pass = Boolean(report.failedSet.errorCodeCorrect && report.failedSet.rejectedKeyAbsent && report.failedSet.usageUnchanged);

      const beforeBatch = await PDA_storage.usage();
      const batchRemaining = quota - Number(beforeBatch.used);
      const eachTarget = Math.floor((batchRemaining + 128 * KiB) / 2);
      const keyA = ownKey('quota-rejected-batch-a');
      const keyB = ownKey('quota-rejected-batch-b');
      const valueA = makeSizedBlob(eachTarget, token('batch-a'), 'quota-rejected-batch');
      const valueB = makeSizedBlob(eachTarget, token('batch-b'), 'quota-rejected-batch');
      let batchError = null;
      try { await PDA_storage.setMany({ [keyA]: valueA, [keyB]: valueB }); } catch (error) { batchError = describeError(error); }
      const afterBatch = await PDA_storage.usage();
      const actualA = await PDA_storage.get(keyA, '__missing__');
      const actualB = await PDA_storage.get(keyB, '__missing__');
      report.failedSetMany = {
        error: batchError,
        errorCodeCorrect: batchError && batchError.code === 'QuotaExceeded',
        firstKeyAbsent: actualA === '__missing__',
        secondKeyAbsent: actualB === '__missing__',
        usageUnchanged: Number(afterBatch.used) === Number(beforeBatch.used),
      };
      report.failedSetMany.pass = Boolean(report.failedSetMany.errorCodeCorrect && report.failedSetMany.firstKeyAbsent && report.failedSetMany.secondKeyAbsent && report.failedSetMany.usageUnchanged);

      const sentinelAfter = await PDA_storage.get(APP.controlKey, null);
      const fillIntact = await verifyFillKeys(fillKeys);
      report.integrityAfterFailures = {
        sentinelIntact: JSON.stringify(sentinelAfter) === JSON.stringify(sentinel),
        fillRecordsIntact: fillIntact,
      };
      report.integrityAfterFailures.pass = report.integrityAfterFailures.sentinelIntact && report.integrityAfterFailures.fillRecordsIntact;
      if (!report.failedSet.pass) { report.aborted = true; report.abortReason = 'Single over-quota set did not reject atomically.'; }
      else if (!report.failedSetMany.pass) { report.aborted = true; report.abortReason = 'Over-quota setMany did not reject atomically.'; }
      else if (!report.integrityAfterFailures.pass) { report.aborted = true; report.abortReason = 'Existing data changed after rejected writes.'; }
    } catch (error) {
      report.aborted = true;
      report.abortReason = report.abortReason || 'Unexpected quota-test exception.';
      report.error = describeError(error);
    } finally {
      report.finalCleanup = await clearOwnKeys();
      try { report.finalUsage = await PDA_storage.usage(); } catch (error) { report.finalUsageError = describeError(error); }
      report.cleanupReturnedToCleanBaseline = Boolean(report.finalUsage && report.baselineUsage && Number(report.finalUsage.used) === Number(report.baselineUsage.used));
      report.summary = {
        observedQuota: report.baselineUsage ? report.baselineUsage.quota : null,
        fillAccountingExact: report.fill.operations.every((entry) => entry.accountingExact),
        singleRejectedAtomically: report.failedSet ? report.failedSet.pass === true : false,
        setManyRejectedAtomically: report.failedSetMany ? report.failedSetMany.pass === true : false,
        existingDataIntact: report.integrityAfterFailures ? report.integrityAfterFailures.pass === true : false,
        cleanupReturnedToCleanBaseline: report.cleanupReturnedToCleanBaseline,
        aborted: report.aborted,
      };
      report.summary.pass = !report.aborted
        && Number(report.summary.observedQuota) === APP.expectedDefaultQuota
        && report.fill.operations.length > 0
        && report.summary.fillAccountingExact
        && report.summary.singleRejectedAtomically
        && report.summary.setManyRejectedAtomically
        && report.summary.existingDataIntact
        && report.summary.cleanupReturnedToCleanBaseline;
      render(report);
      setStatus(report.summary.pass ? 'Q3 PASS. Namespace returned to baseline.' : 'Q3 stopped: ' + (report.abortReason || 'see report'));
      state.running = false;
    }
  }

  function installUi() {
    if (document.getElementById(APP.panelId)) return;
    const style = document.createElement('style');
    style.id = APP.styleId;
    style.textContent = '#' + APP.panelId + '{position:fixed;right:12px;bottom:12px;z-index:2147483000;width:min(470px,calc(100vw - 24px));max-height:76vh;overflow:auto;background:#101214;color:#eee;border:1px solid #586069;border-radius:10px;padding:12px;box-shadow:0 8px 28px rgba(0,0,0,.5);font:13px/1.35 sans-serif}'
      + '#' + APP.panelId + ' h3{margin:0 0 6px;font-size:15px}'
      + '#' + APP.panelId + ' .row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}'
      + '#' + APP.panelId + ' button{border:1px solid #747d87;border-radius:7px;background:#20252a;color:#eee;padding:7px 9px}'
      + '#' + APP.panelId + ' [data-role="status"]{color:#b9e2ff;margin:8px 0}'
      + '#' + APP.panelId + ' pre{white-space:pre-wrap;word-break:break-word;max-height:36vh;overflow:auto;background:#08090a;padding:8px;border-radius:6px}'
      + '#' + APP.panelId + ' .note{color:#b9c0c7;font-size:12px}'
      + '#' + APP.panelId + ' .warn{color:#ffd38a;font-size:12px}';
    document.head.appendChild(style);
    const panel = document.createElement('section');
    panel.id = APP.panelId;
    panel.innerHTML = '<h3>' + APP.name + ' v' + APP.version + '</h3>'
      + '<div class="note">Synthetic Discovery data only. No TornScripture product data is read or written.</div>'
      + '<div class="row"><button data-action="preflight">Preflight</button><button data-action="scaling">Run Q1/Q2 scaling</button><button data-action="copy">Copy report</button></div>'
      + '<div class="warn">Q3 is separate and deliberately approaches this probe namespace quota. Run only after Q1/Q2 review.</div>'
      + '<div class="row"><button data-action="quota">Run Q3 quota/atomicity</button><button data-action="clear">Clear this probe data</button></div>'
      + '<div data-role="status">Ready. PDA_storage: ' + (hasNativeStorage() ? 'YES' : 'NO') + '.</div>'
      + '<pre data-role="report">Press Preflight first.</pre>';
    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || state.running) return;
      try {
        if (button.dataset.action === 'preflight') await preflightSnapshot();
        if (button.dataset.action === 'scaling') await runScalingBenchmark();
        if (button.dataset.action === 'copy') await copyLastReport();
        if (button.dataset.action === 'quota') {
          const now = Date.now();
          if (state.quotaArmedUntil < now) {
            state.quotaArmedUntil = now + 30000;
            setStatus('Q3 armed for 30 seconds. Press Q3 again to begin.');
            return;
          }
          state.quotaArmedUntil = 0;
          await runQuotaAtomicity();
        }
        if (button.dataset.action === 'clear') {
          state.running = true;
          const cleanup = await clearOwnKeys();
          const usage = hasNativeStorage() ? await PDA_storage.usage() : null;
          render({ clearedAt: nowIso(), cleanup, usage });
          setStatus('Cleared ' + cleanup.deleted + ' qualification key(s).');
          state.running = false;
        }
      } catch (error) {
        state.running = false;
        render({ failedAt: nowIso(), error: describeError(error) });
        setStatus('Action failed: ' + (error && error.message ? error.message : String(error)));
      }
    });
    document.body.appendChild(panel);
  }

  function boot() {
    try {
      if (!document.body) return;
      installUi();
    } catch (error) {
      try {
        const box = document.createElement('pre');
        box.id = APP.panelId + '-boot-error';
        box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;max-width:90vw;background:#300;color:#fff;padding:10px;white-space:pre-wrap';
        box.textContent = APP.name + ' boot error: ' + (error && error.message ? error.message : String(error));
        document.body.appendChild(box);
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();