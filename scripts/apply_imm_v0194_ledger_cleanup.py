from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once('// @version      0.19.3', '// @version      0.19.4', 'header version')
replace_once(
    'purchase history, cross-channel purchase dedupe, and receipt audits.',
    'purchase history, cross-channel purchase dedupe, reversible duplicate-ledger cleanup, and receipt audits.',
    'description',
)
replace_once('ITEM MARKET MARGIN v0.19.3', 'ITEM MARKET MARGIN v0.19.4', 'internal version comment')

version_count = text.count("version: '0.19.3'")
if version_count != 3:
    raise SystemExit(f'version constants: expected three matches, found {version_count}')
text = text.replace("version: '0.19.3'", "version: '0.19.4'")

replace_once(
    "    ledgerStorageKey: 'tornscripture-imm-ledger-v1',\n",
    "    ledgerStorageKey: 'tornscripture-imm-ledger-v1',\n    ledgerCleanupBackupStorageKey: 'tornscripture-imm-ledger-cleanup-backup-v1',\n",
    'cleanup backup storage key',
)

insert_before_import = r'''  function loadLedgerCleanupBackup() {
    try {
      const parsed = JSON.parse(localStorage.getItem(APP.ledgerCleanupBackupStorageKey) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function ledgerLotUntouchedForCleanup(lot) {
    const quantity = Math.max(0, Number(lot?.quantity) || 0);
    const remaining = Math.max(0, Number(lot?.remainingQuantity) || 0);
    return quantity > 0
      && remaining === quantity
      && normalizeWhitespace(lot?.status || 'open').toLowerCase() === 'open';
  }

  function exactLedgerDuplicateKey(lot) {
    const identity = Number(lot?.itemId) > 0
      ? `id:${Number(lot.itemId)}`
      : `name:${normalizeName(lot?.itemName || lot?.normalizedName)}`;
    return [
      identity,
      normalizeWhitespace(lot?.source),
      normalizeWhitespace(lot?.venue),
      Math.floor(Number(lot?.quantity) || 0),
      Math.floor(Number(lot?.remainingQuantity) || 0),
      Number(lot?.unitCost) || 0,
      Number(lot?.totalCost) || 0,
      Number(lot?.marketValueAtPurchase) || 0,
      Number(lot?.traderValueAtPurchase) || 0,
      Number(lot?.expectedProfitEach) || 0,
      Number(lot?.expectedProfitTotal) || 0,
      normalizeWhitespace(lot?.status || 'open').toLowerCase(),
    ].join('|');
  }

  function exactDuplicateLedgerPairs() {
    const lots = Array.isArray(state.ledger?.lots) ? state.ledger.lots : [];
    const fetchLots = lots.filter((lot) => lot?.captureMethod === 'fetch-success' && ledgerLotUntouchedForCleanup(lot));
    const fallbackLots = lots.filter((lot) => lot?.captureMethod === 'dom-success-fallback' && ledgerLotUntouchedForCleanup(lot));
    const usedFetchIds = new Set();
    const pairs = [];

    for (const fallback of fallbackLots) {
      const fallbackTime = Date.parse(fallback.capturedAt || '');
      if (!Number.isFinite(fallbackTime)) continue;
      const key = exactLedgerDuplicateKey(fallback);
      let best = null;
      for (const fetchLot of fetchLots) {
        if (usedFetchIds.has(fetchLot.id) || exactLedgerDuplicateKey(fetchLot) !== key) continue;
        const fetchTime = Date.parse(fetchLot.capturedAt || '');
        if (!Number.isFinite(fetchTime)) continue;
        const deltaMs = Math.abs(fallbackTime - fetchTime);
        if (deltaMs > 250) continue;
        if (!best || deltaMs < best.deltaMs) best = { keep: fetchLot, remove: fallback, deltaMs };
      }
      if (!best) continue;
      usedFetchIds.add(best.keep.id);
      pairs.push(best);
    }
    return pairs;
  }

  function exactDuplicateLedgerPreview() {
    const pairs = exactDuplicateLedgerPairs();
    return {
      pairs,
      lots: pairs.length,
      quantity: pairs.reduce((sum, pair) => sum + Number(pair.remove.quantity || 0), 0),
      invested: pairs.reduce((sum, pair) => sum + Number(pair.remove.totalCost || 0), 0),
      expectedProfit: pairs.reduce((sum, pair) => sum + Number(pair.remove.expectedProfitTotal || 0), 0),
    };
  }

  function cleanExactLedgerDuplicates() {
    const preview = exactDuplicateLedgerPreview();
    if (!preview.lots) {
      toast('No untouched exact capture duplicates were found.');
      return;
    }
    const accepted = confirm(
      `Remove ${formatInteger(preview.lots)} exact duplicate lot${preview.lots === 1 ? '' : 's'}?\n\n`
      + `Tracked quantity correction: ${formatInteger(preview.quantity)} items\n`
      + `Invested correction: ${formatMoney(preview.invested)}\n`
      + `Expected-profit correction: ${preview.expectedProfit >= 0 ? '+' : ''}${formatMoney(preview.expectedProfit)}\n\n`
      + 'Only untouched fetch-success / dom-success-fallback pairs with identical values and timestamps within 250ms will be removed. A full pre-cleanup ledger backup will be stored for one-click undo.'
    );
    if (!accepted) return;

    const backup = {
      schema: 'tornscripture-imm-ledger-cleanup-backup',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      reason: 'exact-cross-channel-capture-duplicates',
      removedLotIds: preview.pairs.map((pair) => pair.remove.id),
      ledger: JSON.parse(JSON.stringify(state.ledger)),
    };
    saveJson(APP.ledgerCleanupBackupStorageKey, backup);
    const removeIds = new Set(backup.removedLotIds);
    state.ledger.lots = state.ledger.lots.filter((lot) => !removeIds.has(lot.id));
    saveLedger();
    renderLedger();
    renderPanel();
    toast(`Removed ${formatInteger(preview.lots)} exact duplicate lot${preview.lots === 1 ? '' : 's'}. Undo is available in the Ledger.`);
  }

  function undoExactLedgerDuplicateCleanup() {
    const backup = loadLedgerCleanupBackup();
    if (!backup?.ledger) {
      toast('No duplicate-cleanup backup is available.');
      return;
    }
    const created = new Date(backup.createdAt || '');
    const when = Number.isFinite(created.getTime()) ? created.toLocaleString() : 'an earlier time';
    const accepted = confirm(
      `Restore the complete ledger snapshot from ${when}?\n\n`
      + 'This replaces the current ledger, including any purchases or sales recorded after that cleanup.'
    );
    if (!accepted) return;
    state.ledger = normalizeLedger(backup.ledger);
    localStorage.removeItem(APP.ledgerCleanupBackupStorageKey);
    saveLedger();
    renderLedger();
    renderPanel();
    toast('Duplicate cleanup undone and the previous ledger restored.');
  }

'''
replace_once(
    '  function importLedgerJson() {\n',
    insert_before_import + '  function importLedgerJson() {\n',
    'cleanup functions',
)

replace_once(
    "    const showPurchaseControls = view === 'holdings' || view === 'history';\n",
    "    const showPurchaseControls = view === 'holdings' || view === 'history';\n    const duplicatePreview = exactDuplicateLedgerPreview();\n    const cleanupBackup = loadLedgerCleanupBackup();\n",
    'ledger cleanup preview state',
)

replace_once(
    '''          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-clear">Clear all</button>
''',
    '''          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-clean-duplicates" ${duplicatePreview.lots ? '' : 'disabled'}>Clean exact duplicates${duplicatePreview.lots ? ` (${formatInteger(duplicatePreview.lots)})` : ''}</button>
          ${cleanupBackup?.ledger ? '<button type="button" data-tsimm-action="ledger-undo-cleanup">Undo cleanup</button>' : ''}
          <button type="button" data-tsimm-action="ledger-clear">Clear all</button>
''',
    'ledger cleanup buttons',
)

replace_once(
    "      } else if (action === 'ledger-delete') {\n        deleteLedgerLot(button.dataset.tsimmLotId);\n      } else if (action === 'ledger-clear') {\n",
    "      } else if (action === 'ledger-delete') {\n        deleteLedgerLot(button.dataset.tsimmLotId);\n      } else if (action === 'ledger-clean-duplicates') {\n        cleanExactLedgerDuplicates();\n      } else if (action === 'ledger-undo-cleanup') {\n        undoExactLedgerDuplicateCleanup();\n      } else if (action === 'ledger-clear') {\n",
    'ledger cleanup actions',
)

path.write_text(text)
print('PATCH_OK')
