// ==UserScript==
// @name         TornScriptures Discovery - TornPDA Storage Qualification Probe
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.1.0
// @description  Disposable Age of Discovery probe for PDA_storage payload scaling, batching, quota rejection, and cleanup integrity. Never touches TornScripture product data.
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
    name: 'TornPDA Storage Qualification Probe',
    version: '0.1.0',
    panelId: 'ts-discovery-storage-qualification-probe',
    styleId: 'ts-discovery-storage-qualification-style',
    keyPrefix: 'ts-discovery-storage-qualification:',
    controlKey: 'ts-discovery-storage-qualification:control',
    slowOperationMs: 5000,
    expectedDefaultQuota: 10 * MiB,
    maxQuotaTestQuota: 12 * MiB,
  });

  const state = {
    running: false,
    lastReport: null,
    quotaArmedUntil: 0,
  };

  const encoder = new TextEncoder();

  function nowIso() {
    return new Date().toISOString();
  }

  function hasNativeStorage() {
    return typeof PDA_storage !== 'undefined'
      && PDA_storage
      && typeof PDA_storage.get === 'function'
      && typeof PDA_storage.set === 'function'
      && typeof PDA_storage.usage === 'function';
  }

  function byteLength(text) {
    return encoder.encode(String(text)).byteLength;
  }

  function jsonBytes(value) {
    return byteLength(JSON.stringify(value));
  }

  function describeError(error) {
    if (!error) return { name: 'Error', message: 'Unknown error' };
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

  function ms(value) {
    return Math.round(Number(value) * 1000) / 1000;
  }

  async function timed(fn) {
    const started = performance.now();
    const value = await fn();
    return { value, durationMs: ms(performance.now() - started) };
  }

  function createToken(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

  async function copyLastReport() {
    const text = JSON.stringify(state.lastReport || { note: 'No report generated yet.' }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Last report copied.');
    } catch (_) {
      setStatus('Clipboard unavailable. Report remains visible below.');
    }
  }

  function ownKey(name) {
    return `${APP.keyPrefix}${name}`;
  }

  async function clearOwnKeys() {
    if (!hasNativeStorage()) return { deleted: 0, errors: [] };
    const result = { deleted: 0, errors: [] };
    let keys = [];
    try {
      keys = await PDA_storage.list();
    } catch (error) {
      result.errors.push({ stage: 'list', error: describeError(error) });
      return result;
    }

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

  function makeSizedBlob(targetJsonBytes, token, kind = 'blob') {
    const target = Math.max(256, Math.floor(Number(targetJsonBytes) || 0));
    const payload = {
      schema: 'ts-storage-qualification',
      schemaVersion: 1,
      kind,
      token,
      data: '',
    };
    const baseBytes = jsonBytes(payload);
    const fillerLength = Math.max(0, target - baseBytes);
    payload.data = 'x'.repeat(fillerLength);

    const actual = jsonBytes(payload);
    if (actual < target) payload.data += 'x'.repeat(target - actual);
    else if (actual > target && payload.data.length >= actual - target) {
      payload.data = payload.data.slice(0, payload.data.length - (actual - target));
    }
    return payload;
  }

  function makeUnicodePayload(targetJsonBytes, token) {
    const target = Math.max(8 * KiB, Math.floor(Number(targetJsonBytes) || 0));
    const phrase = 'Ledger 🔐 café 日本語 — “quoted” ’apostrophe’ | ';
    const payload = {
      schema: 'ts-storage-qualification',
      schemaVersion: 1,
      kind: 'unicode-text',
      token,
      text: '',
    };
    const baseBytes = jsonBytes(payload);
    const phraseBytes = byteLength(phrase);
    const repeats = Math.max(1, Math.ceil((target - baseBytes) / Math.max(1, phraseBytes)));
    payload.text = phrase.repeat(repeats);
    return payload;
  }

  function syntheticLedgerRecord(i, token) {
    const itemId = 200 + (i % 950);
    const quantity = 1 + (i % 97);
    const unitCost = 100 + ((i * 7919) % 250000);
    const traderValue = Math.max(1, unitCost + ((i % 17) - 5) * 137);
    return {
      id: `synthetic-lot-${token}-${i}`,
      schemaVersion: 2,
      source: i % 3 === 0 ? 'item-market' : 'synthetic-discovery',
      venue: 'item-market',
      country: '',
      location: '',
      fundingSource: ['personal', 'shared', 'other'][i % 3],
      itemId,
      itemName: `Synthetic Item ${itemId}`,
      normalizedName: `synthetic item ${itemId}`,
      quantity,
      remainingQuantity: quantity,
      unitCost,
      totalCost: unitCost * quantity,
      marketValueAtPurchase: traderValue + 250,
      traderValueAtPurchase: traderValue,
      expectedProfitEach: traderValue - unitCost,
      expectedProfitTotal: (traderValue - unitCost) * quantity,
      capturedAt: new Date(1786000000000 + i * 37000).toISOString(),
      purchaseUrl: `https://www.torn.com/page.php?sid=ItemMarket#/market/view=item&itemID=${itemId}`,
      captureMethod: i % 2 === 0 ? 'fetch-success' : 'dom-success-fallback',
      status: 'open',
      notes: `Synthetic qualification record ${i}. No owner transaction data.`,
    };
  }

  function syntheticHistoryRecord(i, token) {
    const playerId = 1000000 + (i % 2000);
    return {
      id: `${token}-${i}`,
      playerId: String(playerId),
      name: `Synthetic Player ${playerId}`,
      factionId: String(1000 + (i % 40)),
      activity: ['online', 'idle', 'offline'][i % 3],
      life: ['okay', 'hospital', 'traveling', 'abroad'][i % 4],
      observedAt: new Date(1786000000000 + i * 60000).toISOString(),
      sourceUrl: `https://www.torn.com/factions.php?step=profile&ID=${1000 + (i % 40)}`,
      collector: `synthetic-${i % 5}`,
    };
  }

  function makeRecordPayload(shape, targetJsonBytes, token) {
    const target = Math.max(8 * KiB, Math.floor(Number(targetJsonBytes) || 0));
    const factory = shape === 'history-like' ? syntheticHistoryRecord : syntheticLedgerRecord;
    const sample = factory(0, token);
    const sampleBytes = Math.max(1, jsonBytes(sample) + 1);
    let count = Math.max(1, Math.floor((target - 180) / sampleBytes));
    let records = Array.from({ length: count }, (_, i) => factory(i, token));
    const payload = {
      schema: 'ts-storage-qualification',
      schemaVersion: 1,
      kind: shape,
      token,
      records,
    };
    let actual = jsonBytes(payload);

    let guard = 0;
    while (guard < 8 && actual < target * 0.97) {
      const deficit = target - actual;
      const add = Math.max(1, Math.floor(deficit / sampleBytes));
      const start = records.length;
      for (let i = 0; i < add; i += 1) records.push(factory(start + i, token));
      actual = jsonBytes(payload);
      guard += 1;
    }

    while (records.length > 1 && actual > target * 1.08 && guard < 16) {
      const excess = actual - target;
      const remove = Math.min(records.length - 1, Math.max(1, Math.floor(excess / sampleBytes)));
      records.splice(records.length - remove, remove);
      actual = jsonBytes(payload);
      guard += 1;
    }

    return payload;
  }

  function buildPayload(shape, targetJsonBytes, token) {
    if (shape === 'blob-like') return makeSizedBlob(targetJsonBytes, token, shape);
    if (shape === 'unicode-text') return makeUnicodePayload(targetJsonBytes, token);
    return makeRecordPayload(shape, targetJsonBytes, token);
  }

  async function runStorageCase({ shape, targetJsonBytes, loadAll = false }) {
    const token = createToken(shape);
    const key = ownKey(`case-${shape}-${targetJsonBytes}-${token}`);
    const generationStart = performance.now();
    const payload = buildPayload(shape, targetJsonBytes, token);
    const generationMs = ms(performance.now() - generationStart);

    const stringifyStart = performance.now();
    const expectedJson = JSON.stringify(payload);
    const stringifyMs = ms(performance.now() - stringifyStart);
    const valueBytes = byteLength(expectedJson);
    const keyBytes = byteLength(key);
    const expectedAccountingDelta = keyBytes + valueBytes;
    const expectedHash = compactHash(expectedJson);

    const usageBefore = await PDA_storage.usage();
    let write;
    let read;
    let load;
    let deletion;
    let usageAfterWrite;
    let usageAfterDelete;

    try {
      write = await timed(() => PDA_storage.set(key, payload));
      usageAfterWrite = await PDA_storage.usage();
      if (write.durationMs > APP.slowOperationMs) throw new Error(`SlowOperation:set:${write.durationMs}ms`);

      read = await timed(() => PDA_storage.get(key, null));
      if (read.durationMs > APP.slowOperationMs) throw new Error(`SlowOperation:get:${read.durationMs}ms`);

      const verifyStart = performance.now();
      const actualJson = JSON.stringify(read.value);
      const verificationMs = ms(performance.now() - verifyStart);
      const actualHash = compactHash(actualJson);
      const exactEqual = actualJson === expectedJson;

      if (loadAll) {
        load = await timed(() => PDA_storage.loadAll());
        if (load.durationMs > APP.slowOperationMs) throw new Error(`SlowOperation:loadAll:${load.durationMs}ms`);
      }

      deletion = await timed(() => PDA_storage.delete(key));
      usageAfterDelete = await PDA_storage.usage();

      const observedDelta = Number(usageAfterWrite.used) - Number(usageBefore.used);
      return {
        shape,
        targetJsonBytes,
        actualJsonBytes: valueBytes,
        recordCount: Array.isArray(payload.records) ? payload.records.length : null,
        keyBytes,
        expectedAccountingDelta,
        observedAccountingDelta: observedDelta,
        accountingExact: observedDelta === expectedAccountingDelta,
        generationMs,
        stringifyMs,
        setMs: write.durationMs,
        setMiBPerSec: write.durationMs > 0 ? ms((valueBytes / MiB) / (write.durationMs / 1000)) : null,
        getMs: read.durationMs,
        getMiBPerSec: read.durationMs > 0 ? ms((valueBytes / MiB) / (read.durationMs / 1000)) : null,
        verificationMs,
        exactEqual,
        expectedHash,
        actualHash,
        loadAllMs: load ? load.durationMs : null,
        loadAllContainsExactValue: load ? JSON.stringify(load.value?.[key]) === expectedJson : null,
        deleteMs: deletion.durationMs,
        usageBefore,
        usageAfterWrite,
        usageAfterDelete,
        cleanupReturnedToBaseline: Number(usageAfterDelete.used) === Number(usageBefore.used),
        pass: (
          exactEqual
          && actualHash === expectedHash
          && observedDelta === expectedAccountingDelta
          && Number(usageAfterDelete.used) === Number(usageBefore.used)
          && (!load || JSON.stringify(load.value?.[key]) === expectedJson)
        ),
      };
    } catch (error) {
      try { await PDA_storage.delete(key); } catch (_) {}
      try { usageAfterDelete = await PDA_storage.usage(); } catch (_) {}
      return {
        shape,
        targetJsonBytes,
        actualJsonBytes: valueBytes,
        keyBytes,
        expectedAccountingDelta,
        generationMs,
        stringifyMs,
        pass: false,
        error: describeError(error),
        usageBefore,
        usageAfterWrite: usageAfterWrite || null,
        usageAfterDelete: usageAfterDelete || null,
      };
    }
  }

  async function runBatchCase() {
    const batchToken = createToken('batch');
    const partTarget = 256 * KiB;
    const obj = {};
    const expectedJsonByKey = {};
    let expectedDelta = 0;

    for (let i = 0; i < 4; i += 1) {
      const key = ownKey(`batch-${i}-${batchToken}`);
      const value = makeSizedBlob(partTarget, `${batchToken}-${i}`, 'batch-part');
      obj[key] = value;
      expectedJsonByKey[key] = JSON.stringify(value);
      expectedDelta += byteLength(key) + byteLength(expectedJsonByKey[key]);
    }

    const keys = Object.keys(obj);
    const usageBefore = await PDA_storage.usage();

    try {
      const write = await timed(() => PDA_storage.setMany(obj));
      const usageAfterWrite = await PDA_storage.usage();
      const read = await timed(() => PDA_storage.getMany(keys));

      const entryResults = keys.map((key) => {
        const actualJson = JSON.stringify(read.value?.[key]);
        const expectedJson = expectedJsonByKey[key];
        return {
          keySuffix: key.slice(APP.keyPrefix.length),
          exactEqual: actualJson === expectedJson,
          expectedHash: compactHash(expectedJson),
          actualHash: compactHash(actualJson),
          jsonBytes: byteLength(expectedJson),
        };
      });

      for (const key of keys) await PDA_storage.delete(key);
      const usageAfterDelete = await PDA_storage.usage();
      const observedDelta = Number(usageAfterWrite.used) - Number(usageBefore.used);

      return {
        totalTargetJsonBytes: 1 * MiB,
        entryCount: keys.length,
        expectedAccountingDelta: expectedDelta,
        observedAccountingDelta: observedDelta,
        accountingExact: observedDelta === expectedDelta,
        setManyMs: write.durationMs,
        setManyMiBPerSec: write.durationMs > 0 ? ms((expectedDelta / MiB) / (write.durationMs / 1000)) : null,
        getManyMs: read.durationMs,
        getManyMiBPerSec: read.durationMs > 0 ? ms((expectedDelta / MiB) / (read.durationMs / 1000)) : null,
        entries: entryResults,
        allEntriesExact: entryResults.every((entry) => entry.exactEqual && entry.expectedHash === entry.actualHash),
        usageBefore,
        usageAfterWrite,
        usageAfterDelete,
        cleanupReturnedToBaseline: Number(usageAfterDelete.used) === Number(usageBefore.used),
        pass: (
          observedDelta === expectedDelta
          && entryResults.every((entry) => entry.exactEqual && entry.expectedHash === entry.actualHash)
          && Number(usageAfterDelete.used) === Number(usageBefore.used)
          && write.durationMs <= APP.slowOperationMs
          && read.durationMs <= APP.slowOperationMs
        ),
      };
    } catch (error) {
      for (const key of keys) {
        try { await PDA_storage.delete(key); } catch (_) {}
      }
      return {
        pass: false,
        error: describeError(error),
        usageAfterCleanup: await PDA_storage.usage().catch(() => null),
      };
    }
  }

  async function runScalingBenchmark() {
    if (state.running) return;
    state.running = true;
    setStatus('Running bounded scaling benchmark...');

    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q1/Q2 scaling and batch profile',
      runAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      sourceContract: {
        accounting: 'UTF-8 key bytes + UTF-8 JSON value bytes',
        slowOperationAbortMs: APP.slowOperationMs,
      },
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
      if (!Number(report.baselineUsage?.quota)) throw new Error('Native storage bridge returned no usable quota.');

      const control = {
        token: createToken('control'),
        createdAt: nowIso(),
        purpose: 'Detect unintended mutation while large synthetic values come and go.',
      };
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

      for (let index = 0; index < plans.length; index += 1) {
        const plan = plans[index];
        setStatus(`Scaling case ${index + 1}/${plans.length}: ${plan.shape}, ${Math.round(plan.targetJsonBytes / KiB)} KiB...`);
        const result = await runStorageCase(plan);
        report.cases.push(result);
        if (!result.pass) {
          report.aborted = true;
          report.abortReason = `Case failed: ${plan.shape} ${plan.targetJsonBytes} bytes.`;
          break;
        }

        const controlAfter = await PDA_storage.get(APP.controlKey, null);
        if (JSON.stringify(controlAfter) !== JSON.stringify(control)) {
          report.aborted = true;
          report.abortReason = 'Control record changed during scaling benchmark.';
          break;
        }
      }

      if (!report.aborted) {
        setStatus('Running ~1 MiB setMany/getMany batch profile...');
        report.batch = await runBatchCase();
        if (!report.batch.pass) {
          report.aborted = true;
          report.abortReason = 'Batch profile failed.';
        }
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
      report.cleanupReturnedToCleanBaseline = (
        report.finalUsage
        && report.baselineUsage
        && Number(report.finalUsage.used) === Number(report.baselineUsage.used)
      );
      report.summary = {
        caseCount: report.cases.length,
        casePasses: report.cases.filter((entry) => entry.pass).length,
        batchPass: report.batch ? Boolean(report.batch.pass) : null,
        aborted: report.aborted,
        cleanupReturnedToCleanBaseline: Boolean(report.cleanupReturnedToCleanBaseline),
        pass: (
          !report.aborted
          && report.cases.length === 8
          && report.cases.every((entry) => entry.pass)
          && report.batch?.pass === true
          && report.controlIntactAtEnd === true
          && report.cleanupReturnedToCleanBaseline === true
        ),
      };
      render(report);
      setStatus(report.summary.pass
        ? 'Q1/Q2 complete: all scaling and batch checks passed; namespace cleaned.'
        : `Q1/Q2 stopped: ${report.abortReason || 'see report'}`);
      state.running = false;
    }
  }

  async function verifyFillKeys(fillKeys) {
    for (let i = 0; i < fillKeys.length; i += 1) {
      const entry = fillKeys[i];
      const actual = await PDA_storage.get(entry.key, null);
      if (!actual || actual.token !== entry.token || typeof actual.data !== 'string') return false;
      if (actual.data.length !== entry.dataLength) return false;
    }
    return true;
  }

  async function runQuotaAtomicity() {
    if (state.running) return;
    state.running = true;
    setStatus('Running default-quota rejection/atomicity test...');

    const report = {
      probe: APP.name,
      probeVersion: APP.version,
      phase: 'Q3 default-quota rejection and atomicity',
      runAt: nowIso(),
      href: location.href,
      userAgent: navigator.userAgent,
      nativeStorageAvailable: hasNativeStorage(),
      cleanupBefore: null,
      baselineUsage: null,
      sentinel: null,
      fill: {
        targetFraction: 0.80,
        keys: 0,
        totalRequestedValueBytes: 0,
        operations: [],
      },
      preFailureUsage: null,
      failedSet: null,
      failedSetMany: null,
      integrityAfterFailures: null,
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

    let fillKeys = [];
    let sentinelValue = null;

    try {
      report.cleanupBefore = await clearOwnKeys();
      if (report.cleanupBefore.errors.length) throw new Error('Could not establish a clean qualification namespace.');
      report.baselineUsage = await PDA_storage.usage();

      const quota = Number(report.baselineUsage.quota) || 0;
      if (quota <= 0) throw new Error('Reported quota is unavailable.');
      if (quota !== APP.expectedDefaultQuota) {
        report.aborted = true;
        report.abortReason = `Q3 v0.1.0 requires the untouched 10 MiB default quota; reported ${quota} bytes.`;
        return;
      }
      if (quota > APP.maxQuotaTestQuota || quota < 4 * MiB) {
        report.aborted = true;
        report.abortReason = `Quota ${quota} is outside the v0.1.0 qualification safety envelope.`;
        return;
      }

      sentinelValue = {
        token: createToken('quota-sentinel'),
        createdAt: nowIso(),
        purpose: 'Must survive rejected writes unchanged.',
      };
      await PDA_storage.set(APP.controlKey, sentinelValue);
      report.sentinel = { written: true, token: sentinelValue.token };

      let usage = await PDA_storage.usage();
      const targetUsed = Math.floor(quota * report.fill.targetFraction);
      let index = 0;

      while (Number(usage.used) < targetUsed) {
        const key = ownKey(`quota-fill-${index}`);
        const remainingToTarget = targetUsed - Number(usage.used);
        const keyBytes = byteLength(key);
        const desiredDelta = Math.min(1 * MiB, Math.max(64 * KiB, remainingToTarget));
        const desiredValueBytes = Math.max(512, desiredDelta - keyBytes);
        const token = createToken(`fill-${index}`);
        const value = makeSizedBlob(desiredValueBytes, token, 'quota-fill');
        const valueBytes = jsonBytes(value);
        const before = Number(usage.used);

        const write = await timed(() => PDA_storage.set(key, value));
        if (write.durationMs > APP.slowOperationMs) throw new Error(`SlowOperation:quota-fill:${write.durationMs}ms`);
        usage = await PDA_storage.usage();
        const actualDelta = Number(usage.used) - before;
        const expectedDelta = keyBytes + valueBytes;

        report.fill.operations.push({
          index,
          valueBytes,
          keyBytes,
          expectedDelta,
          actualDelta,
          accountingExact: actualDelta === expectedDelta,
          setMs: write.durationMs,
        });

        if (actualDelta !== expectedDelta) throw new Error(`Quota fill accounting mismatch at chunk ${index}.`);

        fillKeys.push({ key, token, dataLength: value.data.length });
        report.fill.totalRequestedValueBytes += valueBytes;
        index += 1;

        if (index > 16) throw new Error('Quota fill exceeded chunk-count safety bound.');
      }

      report.fill.keys = fillKeys.length;
      report.preFailureUsage = await PDA_storage.usage();
      const preUsed = Number(report.preFailureUsage.used);
      const remaining = quota - preUsed;
      if (remaining <= 256 * KiB) throw new Error('Quota fill left too little margin for bounded rejection test.');

      {
        const key = ownKey('quota-rejected-single');
        const keyBytes = byteLength(key);
        const requestedValueBytes = remaining + 128 * KiB;
        if (requestedValueBytes > 3 * MiB) throw new Error('Single rejection payload exceeds v0.1.0 3 MiB safety ceiling.');
        const value = makeSizedBlob(requestedValueBytes, createToken('rejected-single'), 'quota-rejected-single');
        const beforeUsage = await PDA_storage.usage();
        let caught = null;
        const started = performance.now();
        try {
          await PDA_storage.set(key, value);
        } catch (error) {
          caught = describeError(error);
        }
        const durationMs = ms(performance.now() - started);
        const afterUsage = await PDA_storage.usage();
        const missing = await PDA_storage.get(key, '__missing__');
        report.failedSet = {
          requestedValueBytes: jsonBytes(value),
          keyBytes,
          durationMs,
          error: caught,
          expectedErrorCode: 'QuotaExceeded',
          errorCodeCorrect: caught?.code === 'QuotaExceeded',
          rejectedKeyAbsent: missing === '__missing__',
          usageUnchanged: Number(afterUsage.used) === Number(beforeUsage.used),
          beforeUsage,
          afterUsage,
          pass: (
            caught?.code === 'QuotaExceeded'
            && missing === '__missing__'
            && Number(afterUsage.used) === Number(beforeUsage.used)
          ),
        };
      }

      {
        const beforeUsage = await PDA_storage.usage();
        const batchRemaining = quota - Number(beforeUsage.used);
        const overage = 128 * KiB;
        const combinedValueBudget = batchRemaining + overage;
        const eachTarget = Math.floor(combinedValueBudget / 2);
        if (eachTarget >= batchRemaining) throw new Error('Cannot construct bounded two-entry setMany rejection case.');

        const keyA = ownKey('quota-rejected-batch-a');
        const keyB = ownKey('quota-rejected-batch-b');
        const valueA = makeSizedBlob(eachTarget, createToken('batch-a'), 'quota-rejected-batch');
        const valueB = makeSizedBlob(eachTarget, createToken('batch-b'), 'quota-rejected-batch');
        let caught = null;
        const started = performance.now();
        try {
          await PDA_storage.setMany({ [keyA]: valueA, [keyB]: valueB });
        } catch (error) {
          caught = describeError(error);
        }
        const durationMs = ms(performance.now() - started);
        const afterUsage = await PDA_storage.usage();
        const actualA = await PDA_storage.get(keyA, '__missing__');
        const actualB = await PDA_storage.get(keyB, '__missing__');

        report.failedSetMany = {
          entryValueBytes: [jsonBytes(valueA), jsonBytes(valueB)],
          combinedAccountingBytes: (
            byteLength(keyA) + jsonBytes(valueA)
            + byteLength(keyB) + jsonBytes(valueB)
          ),
          remainingBeforeAttempt: batchRemaining,
          durationMs,
          error: caught,
          expectedErrorCode: 'QuotaExceeded',
          errorCodeCorrect: caught?.code === 'QuotaExceeded',
          firstKeyAbsent: actualA === '__missing__',
          secondKeyAbsent: actualB === '__missing__',
          usageUnchanged: Number(afterUsage.used) === Number(beforeUsage.used),
          beforeUsage,
          afterUsage,
          pass: (
            caught?.code === 'QuotaExceeded'
            && actualA === '__missing__'
            && actualB === '__missing__'
            && Number(afterUsage.used) === Number(beforeUsage.used)
          ),
        };
      }

      const sentinelAfter = await PDA_storage.get(APP.controlKey, null);
      const fillIntact = await verifyFillKeys(fillKeys);
      report.integrityAfterFailures = {
        sentinelIntact: JSON.stringify(sentinelAfter) === JSON.stringify(sentinelValue),
        fillRecordsIntact: fillIntact,
        usage: await PDA_storage.usage(),
        pass: (
          JSON.stringify(sentinelAfter) === JSON.stringify(sentinelValue)
          && fillIntact
        ),
      };

      if (!report.failedSet?.pass) {
        report.aborted = true;
        report.abortReason = 'Single over-quota set did not reject atomically as expected.';
      } else if (!report.failedSetMany?.pass) {
        report.aborted = true;
        report.abortReason = 'Over-quota setMany did not reject atomically as expected.';
      } else if (!report.integrityAfterFailures.pass) {
        report.aborted = true;
        report.abortReason = 'Existing control/fill data changed after rejected writes.';
      }
    } catch (error) {
      report.aborted = true;
      report.abortReason = report.abortReason || 'Unexpected quota-test exception.';
      report.error = describeError(error);
    } finally {
      report.finalCleanup = await clearOwnKeys();
      try { report.finalUsage = await PDA_storage.usage(); } catch (error) { report.finalUsageError = describeError(error); }
      report.cleanupReturnedToCleanBaseline = (
        report.finalUsage
        && report.baselineUsage
        && Number(report.finalUsage.used) === Number(report.baselineUsage.used)
      );
      report.summary = {
        expectedDefaultQuota: APP.expectedDefaultQuota,
        observedQuota: report.baselineUsage?.quota ?? null,
        observedDefaultQuotaMatches: Number(report.baselineUsage?.quota) === APP.expectedDefaultQuota,
        fillAccountingExact: report.fill.operations.every((entry) => entry.accountingExact),
        singleRejectedAtomically: report.failedSet?.pass === true,
        setManyRejectedAtomically: report.failedSetMany?.pass === true,
        existingDataIntact: report.integrityAfterFailures?.pass === true,
        cleanupReturnedToCleanBaseline: Boolean(report.cleanupReturnedToCleanBaseline),
        aborted: report.aborted,
        pass: (
          !report.aborted
          && Number(report.baselineUsage?.quota) === APP.expectedDefaultQuota
          && report.fill.operations.length > 0
          && report.fill.operations.every((entry) => entry.accountingExact)
          && report.failedSet?.pass === true
          && report.failedSetMany?.pass === true
          && report.integrityAfterFailures?.pass === true
          && report.cleanupReturnedToCleanBaseline === true
        ),
      };
      render(report);
      setStatus(report.summary.pass
        ? 'Q3 complete: quota rejection was atomic and namespace returned to baseline.'
        : `Q3 stopped: ${report.abortReason || 'see report'}`);
      state.running = false;
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
      notes: [
        'Q1/Q2 uses bounded synthetic payloads and deletes each large case before advancing.',
        'Q3 is separate and temporarily fills only this probe namespace to about 80% of its reported quota.',
        'No global-cap test, cache clear, app-data clear, userscript-storage clear, API call, or TornScripture product-data access is performed.',
      ],
    };
    if (hasNativeStorage()) {
      try {
        report.usage = await PDA_storage.usage();
        report.bridgeReady = Number(report.usage?.quota) > 0;
        report.quotaMatchesDefault = Number(report.usage?.quota) === APP.expectedDefaultQuota;
      } catch (error) {
        report.usageError = describeError(error);
      }
    }
    render(report);
    setStatus(hasNativeStorage()
      ? `Ready. Native quota: ${report.usage?.quota ?? 'unknown'} bytes.`
      : 'PDA_storage unavailable.');
  }

  function installUi() {
    if (document.getElementById(APP.panelId)) return;

    if (!document.getElementById(APP.styleId)) {
      const style = document.createElement('style');
      style.id = APP.styleId;
      style.textContent = `
        #${APP.panelId} {
          position: fixed; right: 12px; bottom: 12px; z-index: 2147483000;
          width: min(470px, calc(100vw - 24px)); max-height: 76vh; overflow: auto;
          background: #101214; color: #eee; border: 1px solid #586069; border-radius: 10px;
          padding: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.5); font: 13px/1.35 sans-serif;
        }
        #${APP.panelId} h3 { margin: 0 0 6px; font-size: 15px; }
        #${APP.panelId} .tsq-note { color: #b9c0c7; font-size: 12px; margin: 6px 0; }
        #${APP.panelId} .tsq-warning { color: #ffd38a; font-size: 12px; margin: 8px 0; }
        #${APP.panelId} .tsq-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
        #${APP.panelId} button {
          border: 1px solid #747d87; border-radius: 7px; background: #20252a; color: #eee;
          padding: 7px 9px;
        }
        #${APP.panelId} button:active { transform: translateY(1px); }
        #${APP.panelId} [data-role="status"] { color: #b9e2ff; margin: 8px 0; }
        #${APP.panelId} pre {
          white-space: pre-wrap; word-break: break-word; max-height: 36vh; overflow: auto;
          background: #08090a; padding: 8px; border-radius: 6px;
        }
      `;
      document.head.appendChild(style);
    }

    const panel = document.createElement('section');
    panel.id = APP.panelId;
    panel.innerHTML = `
      <h3>${APP.name} v${APP.version}</h3>
      <div class="tsq-note">Synthetic Discovery data only. Never reads IMM, ISH, WIH, Black Ledger, trader, API-key, purchase, receipt, or earlier probe keys.</div>
      <div class="tsq-row">
        <button type="button" data-action="preflight">Preflight</button>
        <button type="button" data-action="scaling">Run Q1/Q2 scaling</button>
        <button type="button" data-action="copy">Copy report</button>
      </div>
      <div class="tsq-warning">Q3 is separate: it temporarily fills about 80% of this probe's own default native quota, deliberately triggers bounded QuotaExceeded errors, verifies no partial writes, then cleans itself.</div>
      <div class="tsq-row">
        <button type="button" data-action="quota">Run Q3 quota/atomicity</button>
        <button type="button" data-action="clear">Clear this probe data</button>
      </div>
      <div data-role="status">Ready. PDA_storage: ${hasNativeStorage() ? 'YES' : 'NO'}.</div>
      <pre data-role="report">Press Preflight first.</pre>
    `;

    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || state.running) return;

      try {
        if (button.dataset.action === 'preflight') await preflightSnapshot();
        if (button.dataset.action === 'scaling') await runScalingBenchmark();
        if (button.dataset.action === 'quota') {
          const now = Date.now();
          if (state.quotaArmedUntil < now) {
            state.quotaArmedUntil = now + 30000;
            setStatus('Q3 armed for 30 seconds. Press Run Q3 quota/atomicity again to begin.');
            return;
          }
          state.quotaArmedUntil = 0;
          await runQuotaAtomicity();
        }
        if (button.dataset.action === 'copy') await copyLastReport();
        if (button.dataset.action === 'clear') {
          state.running = true;
          setStatus('Clearing qualification-probe keys...');
          const cleanup = await clearOwnKeys();
          const usage = hasNativeStorage() ? await PDA_storage.usage() : null;
          render({ clearedAt: nowIso(), cleanup, usage });
          setStatus(`Cleared ${cleanup.deleted} qualification key(s).`);
          state.running = false;
        }
      } catch (error) {
        state.running = false;
        render({ failedAt: nowIso(), error: describeError(error) });
        setStatus(`Action failed: ${error?.message || error}`);
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
