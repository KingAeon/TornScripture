from pathlib import Path
import subprocess

SOURCE_COMMIT = '5322ae470f29053b13dc8a061ec6b04bd2d58324'
SCRIPT_PATH = 'TornScripture-Item-Market-Margin.user.js'


def git_show(path: str) -> str:
    return subprocess.check_output(
        ['git', 'show', f'{SOURCE_COMMIT}:{path}'],
        text=True,
        encoding='utf-8',
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


def protected_block(source: str, start: str, end: str) -> str:
    start_index = source.find(start)
    end_index = source.find(end, start_index)
    if start_index < 0 or end_index < 0:
        raise SystemExit(f'Missing protected block: {start} -> {end}')
    return source[start_index:end_index]


path = Path(SCRIPT_PATH)
current = path.read_text(encoding='utf-8')
if '// @version      0.13.2' not in current:
    raise SystemExit('Expected current main to be GOBLIN GOD v0.13.2')

text = git_show(SCRIPT_PATH)
if '// @version      0.13.3' not in text:
    raise SystemExit('Verified v0.13.3 source was not found')
if '@require' in text:
    raise SystemExit('Refusing to build from a wrapper userscript')

protected_listing = protected_block(
    text,
    '  function listingRowHasPurchaseControl(row) {',
    '  const MARKET_TIER_CLASSES = Object.freeze(['
)
protected_override = protected_block(
    text,
    "      const quickMaxOverride = event.target.closest('[data-tsimm-quick-max-override]');",
    "      const soldToggle = event.target.closest('[data-tsimm-ledger-show-sold]');"
)

text = text.replace('0.13.3', '0.14.0')

text = replace_once(
    text,
    "    inventoryStorageKey: 'tornscripture-imm-inventory-v1',\n",
    "    inventoryStorageKey: 'tornscripture-imm-inventory-v1',\n"
    "    inventoryBaselineStorageKey: 'tornscripture-imm-inventory-baseline-v1',\n"
    "    sellPriorityStorageKey: 'tornscripture-imm-sell-priority-v1',\n",
    'APP storage keys',
)

text = replace_once(
    text,
    "    overseasLoadLimit: 21,\n",
    "    overseasLoadLimit: 21,\n"
    "    sellPrioritySuggestBelowTotalValue: 5000,\n",
    'sell priority default threshold',
)

text = replace_once(
    text,
    "    inventory: normalizeInventoryCache(loadJson(APP.inventoryStorageKey, {})),\n"
    "    keyProfile: normalizeApiKeyProfile(loadJson(APP.apiKeyProfileStorageKey, {})),\n",
    "    inventory: normalizeInventoryCache(loadJson(APP.inventoryStorageKey, {})),\n"
    "    inventoryBaseline: normalizeInventoryBaseline(loadJson(APP.inventoryBaselineStorageKey, {})),\n"
    "    sellPriority: normalizeSellPriority(loadJson(APP.sellPriorityStorageKey, {})),\n"
    "    keyProfile: normalizeApiKeyProfile(loadJson(APP.apiKeyProfileStorageKey, {})),\n",
    'state baseline and priority',
)

inventory_extensions = r'''  function normalizeInventoryBaseline(raw) {
    const found = new Map();
    for (const item of Array.isArray(raw?.items) ? raw.items : []) {
      const itemId = Number(item?.itemId) > 0 ? Number(item.itemId) : null;
      const itemName = normalizeWhitespace(item?.itemName ?? item?.name) || (itemId ? `Item ${itemId}` : '');
      const quantity = Math.max(0, Math.floor(Number(item?.quantity ?? item?.totalQuantity) || 0));
      const key = itemId ? `id:${itemId}` : itemName ? `name:${normalizeName(itemName)}` : '';
      if (!key || quantity <= 0) continue;
      const existing = found.get(key) || { itemId, itemName, quantity: 0 };
      existing.itemId ||= itemId;
      existing.itemName ||= itemName;
      existing.quantity += quantity;
      found.set(key, existing);
    }
    return {
      schema: 'tornscripture-imm-inventory-baseline',
      schemaVersion: 1,
      capturedAt: raw?.capturedAt || null,
      sourceInventoryCapturedAt: raw?.sourceInventoryCapturedAt || null,
      items: [...found.values()],
    };
  }

  function saveInventoryBaseline() {
    state.inventoryBaseline = normalizeInventoryBaseline(state.inventoryBaseline);
    saveJson(APP.inventoryBaselineStorageKey, state.inventoryBaseline);
  }

  function baselineHoldingMap() {
    const found = new Map();
    for (const item of state.inventoryBaseline?.items || []) {
      const key = inventoryKey(item);
      if (!key) continue;
      found.set(key, {
        key,
        itemId: Number(item.itemId) > 0 ? Number(item.itemId) : null,
        itemName: item.itemName,
        baselineQuantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
      });
    }
    return found;
  }

  function normalizeSellPriority(raw) {
    const items = {};
    const source = raw?.items && typeof raw.items === 'object' ? raw.items : {};
    const entries = Array.isArray(source)
      ? source.map((entry) => [normalizeWhitespace(entry?.key), entry])
      : Object.entries(source);
    for (const [rawKey, candidate] of entries) {
      const status = ['always', 'hide'].includes(normalizeWhitespace(candidate?.status))
        ? normalizeWhitespace(candidate.status)
        : 'normal';
      if (status === 'normal') continue;
      const itemId = Number(candidate?.itemId) > 0 ? Number(candidate.itemId) : null;
      const itemName = normalizeWhitespace(candidate?.itemName ?? candidate?.name);
      const key = normalizeWhitespace(rawKey) || (itemId ? `id:${itemId}` : itemName ? `name:${normalizeName(itemName)}` : '');
      if (!key) continue;
      items[key] = {
        key,
        itemId,
        itemName,
        status,
        updatedAt: candidate?.updatedAt || new Date().toISOString(),
      };
    }
    return {
      schema: 'tornscripture-imm-sell-priority',
      schemaVersion: 1,
      updatedAt: raw?.updatedAt || null,
      items,
    };
  }

  function saveSellPriority() {
    state.sellPriority = normalizeSellPriority({
      ...state.sellPriority,
      updatedAt: new Date().toISOString(),
    });
    saveJson(APP.sellPriorityStorageKey, state.sellPriority);
  }

  function sellPriorityKey(candidate) {
    return normalizeWhitespace(candidate?.key) || inventoryKey(candidate);
  }

  function sellPriorityEntry(candidate) {
    const key = sellPriorityKey(candidate);
    return key ? state.sellPriority?.items?.[key] || null : null;
  }

  function sellPriorityStatus(candidate) {
    return sellPriorityEntry(candidate)?.status || 'normal';
  }

  function sellPriorityLabel(status) {
    return ({ normal: 'NORMAL', always: 'ALWAYS SHOW', hide: 'HIDE FROM SELLING' })[status] || 'NORMAL';
  }

  function sellPriorityAllowsSelling(candidate) {
    return sellPriorityStatus(candidate) !== 'hide';
  }

  function sellPriorityCatalog(candidate) {
    return catalogItemFor(candidate?.itemName, candidate?.itemId);
  }

  function sellPriorityEstimatedEach(candidate) {
    const catalog = sellPriorityCatalog(candidate);
    return Math.max(
      0,
      Number(catalog?.sellPrice) || 0,
      traderPayout(Number(catalog?.marketPrice) || 0),
    );
  }

  function sellPriorityStackValue(candidate, quantity = null) {
    const qty = Math.max(0, Math.floor(Number(quantity ?? candidate?.apiQuantity ?? candidate?.totalQuantity) || 0));
    return sellPriorityEstimatedEach(candidate) * qty;
  }

  function sellPrioritySuggested(candidate) {
    if (sellPriorityStatus(candidate) !== 'normal') return false;
    const value = sellPriorityStackValue(candidate, candidate?.apiQuantity);
    const threshold = Math.max(0, Number(state.settings.sellPrioritySuggestBelowTotalValue) || 0);
    return candidate?.apiQuantity > 0 && value > 0 && threshold > 0 && value < threshold;
  }

  function setSellPriority(candidate, status) {
    const key = sellPriorityKey(candidate);
    const normalizedStatus = ['normal', 'always', 'hide'].includes(status) ? status : 'normal';
    if (!key) return false;
    if (normalizedStatus === 'normal') {
      delete state.sellPriority.items[key];
    } else {
      state.sellPriority.items[key] = {
        key,
        itemId: Number(candidate?.itemId) > 0 ? Number(candidate.itemId) : null,
        itemName: normalizeWhitespace(candidate?.itemName) || key,
        status: normalizedStatus,
        updatedAt: new Date().toISOString(),
      };
    }
    saveSellPriority();
    renderLedger();
    renderPanel();
    toast(`${normalizeWhitespace(candidate?.itemName) || 'Item'} set to ${sellPriorityLabel(normalizedStatus)}.`);
    return true;
  }

  function setCurrentInventoryBaseline() {
    if (!state.inventory?.capturedAt || !(state.inventory?.items || []).length) {
      toast('Sync inventory before setting a starting baseline.');
      return false;
    }
    const openLots = (state.ledger.lots || []).filter((lot) => Number(lot.remainingQuantity || 0) > 0);
    if (openLots.length) {
      toast('Starting baseline requires an empty open purchase ledger to avoid double-counting.');
      return false;
    }
    const items = (state.inventory.items || [])
      .map((item) => ({
        itemId: Number(item.itemId) > 0 ? Number(item.itemId) : null,
        itemName: item.itemName,
        quantity: Math.max(0, Math.floor(Number(item.totalQuantity) || 0)),
      }))
      .filter((item) => item.quantity > 0 && (item.itemId || item.itemName));
    if (!items.length) {
      toast('The current inventory snapshot contains no baseline quantities.');
      return false;
    }
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const replacing = Boolean(state.inventoryBaseline?.capturedAt);
    const message = `${replacing ? 'Replace' : 'Set'} the current API inventory as your starting baseline?\n\n${formatInteger(items.length)} item types · ${formatInteger(quantity)} total items\n\nBaseline items keep unknown acquisition cost. Future tracked purchases remain separate and measurable.`;
    if (!confirm(message)) return false;
    state.inventoryBaseline = normalizeInventoryBaseline({
      capturedAt: new Date().toISOString(),
      sourceInventoryCapturedAt: state.inventory.capturedAt,
      items,
    });
    saveInventoryBaseline();
    renderLedger();
    renderPanel();
    toast(`Starting baseline saved: ${formatInteger(items.length)} item types.`);
    return true;
  }

  function clearInventoryBaseline() {
    if (!state.inventoryBaseline?.capturedAt) {
      toast('No starting baseline is saved.');
      return false;
    }
    if (!confirm('Clear the starting inventory baseline? Purchase lots and sell priorities will not be changed.')) return false;
    state.inventoryBaseline = normalizeInventoryBaseline({});
    saveInventoryBaseline();
    renderLedger();
    renderPanel();
    toast('Starting inventory baseline cleared.');
    return true;
  }

  function hideSuggestedSellPriority(rows = ledgerReconciliationRows()) {
    const suggested = rows.filter((row) => row.prioritySuggested);
    if (!suggested.length) {
      toast('No low-value NORMAL items are currently suggested for hiding.');
      return false;
    }
    const threshold = Math.max(0, Number(state.settings.sellPrioritySuggestBelowTotalValue) || 0);
    if (!confirm(`Hide ${formatInteger(suggested.length)} suggested item types from future selling recommendations?\n\nEach current stack is below ${formatMoney(threshold)}. Inventory and reconciliation totals remain unchanged.`)) return false;
    for (const row of suggested) {
      state.sellPriority.items[row.key] = {
        key: row.key,
        itemId: row.itemId || null,
        itemName: row.itemName,
        status: 'hide',
        updatedAt: new Date().toISOString(),
      };
    }
    saveSellPriority();
    renderLedger();
    renderPanel();
    toast(`${formatInteger(suggested.length)} item types hidden from selling recommendations.`);
    return true;
  }

  function resetSellPriorities() {
    const count = Object.keys(state.sellPriority?.items || {}).length;
    if (!count) {
      toast('No persistent sell priorities are set.');
      return false;
    }
    if (!confirm(`Reset all ${formatInteger(count)} persistent sell-priority choices to NORMAL?`)) return false;
    state.sellPriority = normalizeSellPriority({});
    saveSellPriority();
    renderLedger();
    renderPanel();
    toast('All sell priorities reset to NORMAL.');
    return true;
  }

'''

text = replace_once(
    text,
    "  function inventorySnapshotFresh() {\n",
    inventory_extensions + "  function inventorySnapshotFresh() {\n",
    'inventory baseline and sell priority helpers',
)

old_reconcile = r'''  function ledgerReconciliationRows() {
    const ledger = ledgerHoldingMap();
    const inventory = new Map((state.inventory?.items || []).map((item) => [inventoryKey(item), item]));
    const rows = [];
    const query = normalizeName(state.ledgerUi.search);
    for (const key of new Set([...ledger.keys(), ...inventory.keys()])) {
      const left = ledger.get(key) || {};
      const right = inventory.get(key) || {};
      const ledgerQuantity = Number(left.ledgerQuantity || 0);
      const apiQuantity = Number(right.totalQuantity || 0);
      const difference = apiQuantity - ledgerQuantity;
      let status = 'matched';
      if (!state.inventory?.capturedAt) status = 'not-synced';
      else if (!inventorySnapshotFresh()) status = 'stale';
      else if (difference && recentLedgerActivity(key)) status = 'pending';
      else if (difference > 0) status = 'untracked';
      else if (difference < 0) status = 'missing';
      const row = {
        key,
        itemName: left.itemName || right.itemName || key,
        ledgerQuantity,
        apiQuantity,
        onHandQuantity: Number(right.onHandQuantity || 0),
        listedQuantity: Number(right.listedQuantity || 0),
        difference,
        status,
      };
      if (!query || normalizeName(row.itemName).includes(query)) rows.push(row);
    }
    const order = { untracked: 0, missing: 1, pending: 2, stale: 3, 'not-synced': 4, matched: 5 };
    return rows.sort((a, b) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9)
      || Math.abs(b.difference) - Math.abs(a.difference)
      || a.itemName.localeCompare(b.itemName)
    );
  }
'''

new_reconcile = r'''  function ledgerReconciliationRows() {
    const baseline = baselineHoldingMap();
    const ledger = ledgerHoldingMap();
    const inventory = new Map((state.inventory?.items || []).map((item) => [inventoryKey(item), item]));
    const rows = [];
    const query = normalizeName(state.ledgerUi.search);
    for (const key of new Set([...baseline.keys(), ...ledger.keys(), ...inventory.keys()])) {
      const starting = baseline.get(key) || {};
      const tracked = ledger.get(key) || {};
      const current = inventory.get(key) || {};
      const baselineQuantity = Number(starting.baselineQuantity || 0);
      const trackedQuantity = Number(tracked.ledgerQuantity || 0);
      const expectedQuantity = baselineQuantity + trackedQuantity;
      const apiQuantity = Number(current.totalQuantity || 0);
      const difference = apiQuantity - expectedQuantity;
      let status = 'matched';
      if (!state.inventory?.capturedAt) status = 'not-synced';
      else if (!inventorySnapshotFresh()) status = 'stale';
      else if (difference && recentLedgerActivity(key)) status = 'pending';
      else if (difference > 0) status = 'untracked';
      else if (difference < 0) status = 'missing';
      const row = {
        key,
        itemId: Number(starting.itemId || tracked.itemId || current.itemId) || null,
        itemName: starting.itemName || tracked.itemName || current.itemName || key,
        baselineQuantity,
        trackedQuantity,
        ledgerQuantity: expectedQuantity,
        expectedQuantity,
        apiQuantity,
        onHandQuantity: Number(current.onHandQuantity || 0),
        listedQuantity: Number(current.listedQuantity || 0),
        difference,
        status,
      };
      row.priorityStatus = sellPriorityStatus(row);
      row.estimatedSellEach = sellPriorityEstimatedEach(row);
      row.estimatedStackValue = sellPriorityStackValue(row, apiQuantity);
      row.prioritySuggested = sellPrioritySuggested(row);
      if (!query || normalizeName(row.itemName).includes(query)) rows.push(row);
    }
    const order = { untracked: 0, missing: 1, pending: 2, stale: 3, 'not-synced': 4, matched: 5 };
    const priorityOrder = { always: 0, normal: 1, hide: 2 };
    return rows.sort((a, b) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9)
      || (priorityOrder[a.priorityStatus] ?? 1) - (priorityOrder[b.priorityStatus] ?? 1)
      || Math.abs(b.difference) - Math.abs(a.difference)
      || b.estimatedStackValue - a.estimatedStackValue
      || a.itemName.localeCompare(b.itemName)
    );
  }
'''
text = replace_once(text, old_reconcile, new_reconcile, 'reconciliation model')

style_anchor = "      #${APP.ledgerOverlayId} .tsimm-key-error{display:block;margin-top:7px;color:#ff9aab}\n"
style_additions = style_anchor + r'''      #${APP.ledgerOverlayId} .tsimm-baseline-card,#${APP.ledgerOverlayId} .tsimm-sell-priority-card{margin:10px 12px;padding:9px;border:1px solid #5b4770;border-radius:8px;background:#17131c;display:grid;gap:7px}
      #${APP.ledgerOverlayId} .tsimm-baseline-card>div,#${APP.ledgerOverlayId} .tsimm-sell-priority-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      #${APP.ledgerOverlayId} .tsimm-baseline-card span,#${APP.ledgerOverlayId} .tsimm-sell-priority-card small{color:#aaa1b7;font-size:9px}
      #${APP.ledgerOverlayId} .tsimm-baseline-actions,#${APP.ledgerOverlayId} .tsimm-sell-priority-actions,#${APP.ledgerOverlayId} .tsimm-priority-row-actions{display:flex;flex-wrap:wrap;gap:5px}
      #${APP.ledgerOverlayId} .tsimm-baseline-actions button,#${APP.ledgerOverlayId} .tsimm-sell-priority-actions button,#${APP.ledgerOverlayId} .tsimm-priority-row-actions button{flex:1;min-width:92px;border:1px solid #665575;border-radius:6px;background:#342c3d;color:#fff;padding:6px;font-size:9px;font-weight:800}
      #${APP.ledgerOverlayId} .tsimm-sell-priority-threshold{display:grid;grid-template-columns:1fr 110px;gap:7px;align-items:center;color:#d5cbe0;font-size:10px}
      #${APP.ledgerOverlayId} .tsimm-sell-priority-threshold input{min-width:0;border:1px solid #5a5266;border-radius:6px;background:#111;color:#fff;padding:6px}
      #${APP.ledgerOverlayId} .tsimm-priority-pill{display:inline-flex;margin-left:5px;padding:2px 5px;border:1px solid #625a70;border-radius:999px;font-size:8px;font-weight:800;color:#c9c2d0}
      #${APP.ledgerOverlayId} .tsimm-priority-pill.always{border-color:#3b8fc2;color:#8bd7ff}#${APP.ledgerOverlayId} .tsimm-priority-pill.hide{border-color:#8a5f2e;color:#ffc879}#${APP.ledgerOverlayId} .tsimm-priority-pill.suggested{border-color:#9b6bd0;color:#e2bfff}
      #${APP.ledgerOverlayId} .tsimm-priority-row-actions{margin-top:7px;padding-top:7px;border-top:1px solid #3a3341}
      #${APP.ledgerOverlayId} .tsimm-priority-row-actions button.active{background:#5b2b82;border-color:#9a61c2}.tsimm-priority-row-actions button[data-tsimm-sell-priority="hide"].active{background:#563715;border-color:#b78035}.tsimm-priority-row-actions button[data-tsimm-sell-priority="always"].active{background:#174f75;border-color:#3b8fc2}
'''
text = replace_once(text, style_anchor, style_additions, 'sell priority styles')

old_html = r'''  function ledgerReconciliationHtml(rows) {
    const counts = rows.reduce((all, row) => {
      all[row.status] = (all[row.status] || 0) + 1;
      return all;
    }, {});
    const age = state.inventory?.capturedAt
      ? `${relativeAge(state.inventory.capturedAt)}${inventorySnapshotFresh() ? '' : ' · stale'}`
      : 'never';
    const body = rows.map((row) => `
      <article class="tsimm-reconcile-row ${escapeHtml(row.status)}">
        <div class="tsimm-reconcile-head"><strong>${escapeHtml(row.itemName)}</strong><span>${escapeHtml(reconciliationStatus(row.status))}</span></div>
        <div class="tsimm-reconcile-grid">
          <span>Ledger</span><strong>${formatInteger(row.ledgerQuantity)}</strong>
          <span>API total</span><strong>${formatInteger(row.apiQuantity)}</strong>
          <span>On hand / listed</span><strong>${formatInteger(row.onHandQuantity)} / ${formatInteger(row.listedQuantity)}</strong>
          <span>API minus ledger</span><strong>${row.difference > 0 ? '+' : ''}${formatInteger(row.difference)}</strong>
        </div>
      </article>
    `).join('');
    return `
      ${apiKeyProfileHtml()}
      <div class="tsimm-reconcile-note">
        Read-only snapshot captured ${escapeHtml(age)}. It combines on-hand inventory with active Item Market listings when available.
        Missing items may still be in your Bazaar, display case, active trades, faction storage, company storage, or another off-inventory location.
        No ledger quantities are changed from this screen.
        ${state.inventory?.itemMarketError ? `<br><strong>Listings not included:</strong> ${escapeHtml(state.inventory.itemMarketError)}` : ''}
      </div>
      <div class="tsimm-reconcile-counts">
        <div><strong>${formatInteger(counts.untracked || 0)}</strong><span>untracked</span></div>
        <div><strong>${formatInteger(counts.missing || 0)}</strong><span>missing</span></div>
        <div><strong>${formatInteger(counts.pending || 0)}</strong><span>pending</span></div>
        <div><strong>${formatInteger(counts.matched || 0)}</strong><span>matched</span></div>
      </div>
      <div class="tsimm-ledger-filters"><input type="search" value="${escapeHtml(state.ledgerUi.search)}" placeholder="Search item name" data-tsimm-ledger-search></div>
      <div class="tsimm-reconcile-list">${body || '<div class="tsimm-ledger-empty">Sync inventory to begin reconciliation.</div>'}</div>
    `;
  }
'''

new_html = r'''  function ledgerReconciliationHtml(rows) {
    const counts = rows.reduce((all, row) => {
      all[row.status] = (all[row.status] || 0) + 1;
      all[row.priorityStatus] = (all[row.priorityStatus] || 0) + 1;
      if (row.prioritySuggested) all.suggested = (all.suggested || 0) + 1;
      return all;
    }, {});
    const age = state.inventory?.capturedAt
      ? `${relativeAge(state.inventory.capturedAt)}${inventorySnapshotFresh() ? '' : ' · stale'}`
      : 'never';
    const baselineAge = state.inventoryBaseline?.capturedAt ? relativeAge(state.inventoryBaseline.capturedAt) : 'not set';
    const baselineQuantity = (state.inventoryBaseline?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const priorityCount = Object.keys(state.sellPriority?.items || {}).length;
    const threshold = Math.max(0, Number(state.settings.sellPrioritySuggestBelowTotalValue) || 0);
    const body = rows.map((row) => {
      const itemId = Number(row.itemId) > 0 ? Number(row.itemId) : '';
      const priority = row.priorityStatus || 'normal';
      const suggestion = row.prioritySuggested ? '<span class="tsimm-priority-pill suggested">LOW-VALUE SUGGESTION</span>' : '';
      return `
      <article class="tsimm-reconcile-row ${escapeHtml(row.status)}">
        <div class="tsimm-reconcile-head"><strong>${escapeHtml(row.itemName)}<span class="tsimm-priority-pill ${escapeHtml(priority)}">${escapeHtml(sellPriorityLabel(priority))}</span>${suggestion}</strong><span>${escapeHtml(reconciliationStatus(row.status))}</span></div>
        <div class="tsimm-reconcile-grid">
          <span>Starting baseline</span><strong>${formatInteger(row.baselineQuantity)}</strong>
          <span>Tracked purchases</span><strong>${formatInteger(row.trackedQuantity)}</strong>
          <span>Expected total</span><strong>${formatInteger(row.expectedQuantity)}</strong>
          <span>API total</span><strong>${formatInteger(row.apiQuantity)}</strong>
          <span>On hand / listed</span><strong>${formatInteger(row.onHandQuantity)} / ${formatInteger(row.listedQuantity)}</strong>
          <span>API minus expected</span><strong>${row.difference > 0 ? '+' : ''}${formatInteger(row.difference)}</strong>
          <span>Estimated sell value</span><strong>${row.estimatedStackValue > 0 ? formatMoney(row.estimatedStackValue) : 'Unknown'}</strong>
        </div>
        <div class="tsimm-priority-row-actions">
          <button type="button" class="${priority === 'normal' ? 'active' : ''}" data-tsimm-action="sell-priority-set" data-tsimm-sell-priority="normal" data-tsimm-item-key="${escapeHtml(row.key)}" data-tsimm-item-id="${escapeHtml(itemId)}" data-tsimm-item-name="${escapeHtml(row.itemName)}">NORMAL</button>
          <button type="button" class="${priority === 'always' ? 'active' : ''}" data-tsimm-action="sell-priority-set" data-tsimm-sell-priority="always" data-tsimm-item-key="${escapeHtml(row.key)}" data-tsimm-item-id="${escapeHtml(itemId)}" data-tsimm-item-name="${escapeHtml(row.itemName)}">ALWAYS SHOW</button>
          <button type="button" class="${priority === 'hide' ? 'active' : ''}" data-tsimm-action="sell-priority-set" data-tsimm-sell-priority="hide" data-tsimm-item-key="${escapeHtml(row.key)}" data-tsimm-item-id="${escapeHtml(itemId)}" data-tsimm-item-name="${escapeHtml(row.itemName)}">HIDE</button>
        </div>
      </article>`;
    }).join('');
    return `
      ${apiKeyProfileHtml()}
      <div class="tsimm-reconcile-note">
        Read-only snapshot captured ${escapeHtml(age)}. It combines on-hand inventory with active Item Market listings when available.
        Missing items may still be in your Bazaar, display case, active trades, faction storage, company storage, or another off-inventory location.
        No purchase costs are invented and no ledger quantities are changed from this screen.
        ${state.inventory?.itemMarketError ? `<br><strong>Listings not included:</strong> ${escapeHtml(state.inventory.itemMarketError)}` : ''}
      </div>
      <section class="tsimm-baseline-card">
        <div><strong>Starting inventory baseline</strong><span>${escapeHtml(baselineAge)} · ${formatInteger(state.inventoryBaseline?.items?.length || 0)} types · ${formatInteger(baselineQuantity)} items</span></div>
        <small>Baseline stock carries unknown acquisition cost. It prevents your pre-GOBLIN inventory from being mistaken for new untracked purchases.</small>
        <div class="tsimm-baseline-actions">
          <button type="button" data-tsimm-action="inventory-baseline-set">${state.inventoryBaseline?.capturedAt ? 'REPLACE BASELINE' : 'SET CURRENT INVENTORY AS BASELINE'}</button>
          ${state.inventoryBaseline?.capturedAt ? '<button type="button" data-tsimm-action="inventory-baseline-clear">CLEAR BASELINE</button>' : ''}
        </div>
      </section>
      <section class="tsimm-sell-priority-card">
        <div class="tsimm-sell-priority-head"><strong>Sell Priority</strong><small>${formatInteger(counts.always || 0)} always · ${formatInteger(counts.hide || 0)} hidden · ${formatInteger(counts.suggested || 0)} suggested</small></div>
        <label class="tsimm-sell-priority-threshold"><span>Suggest hiding when the whole current stack is worth less than</span><input type="number" min="0" step="500" value="${escapeHtml(threshold)}" data-tsimm-setting="sellPrioritySuggestBelowTotalValue"></label>
        <small>Suggestions never hide anything automatically. Hidden items remain in inventory and reconciliation, but future selling recommendations will skip them.</small>
        <div class="tsimm-sell-priority-actions">
          <button type="button" data-tsimm-action="sell-priority-hide-suggested" ${counts.suggested ? '' : 'disabled'}>HIDE ${formatInteger(counts.suggested || 0)} SUGGESTED</button>
          <button type="button" data-tsimm-action="sell-priority-reset" ${priorityCount ? '' : 'disabled'}>RESET PRIORITIES</button>
        </div>
      </section>
      <div class="tsimm-reconcile-counts">
        <div><strong>${formatInteger(counts.untracked || 0)}</strong><span>untracked</span></div>
        <div><strong>${formatInteger(counts.missing || 0)}</strong><span>missing</span></div>
        <div><strong>${formatInteger(counts.pending || 0)}</strong><span>pending</span></div>
        <div><strong>${formatInteger(counts.matched || 0)}</strong><span>matched</span></div>
      </div>
      <div class="tsimm-ledger-filters"><input type="search" value="${escapeHtml(state.ledgerUi.search)}" placeholder="Search item name" data-tsimm-ledger-search></div>
      <div class="tsimm-reconcile-list">${body || '<div class="tsimm-ledger-empty">Sync inventory to begin reconciliation.</div>'}</div>
    `;
  }
'''
text = replace_once(text, old_html, new_html, 'reconciliation UI')

text = replace_once(
    text,
    '<div><strong>${formatInteger(summary.remainingQuantity)}</strong><span>on hand</span></div>',
    '<div><strong>${formatInteger(summary.remainingQuantity)}</strong><span>tracked on hand</span></div>',
    'ledger summary tracked label',
)

text = replace_once(
    text,
    "      } else if (action === 'inventory-open-reconcile') {\n"
    "        openInventoryAndReconcile();\n"
    "      } else if (action === 'api-key-builder') {\n",
    "      } else if (action === 'inventory-open-reconcile') {\n"
    "        openInventoryAndReconcile();\n"
    "      } else if (action === 'inventory-baseline-set') {\n"
    "        setCurrentInventoryBaseline();\n"
    "      } else if (action === 'inventory-baseline-clear') {\n"
    "        clearInventoryBaseline();\n"
    "      } else if (action === 'sell-priority-set') {\n"
    "        setSellPriority({\n"
    "          key: button.dataset.tsimmItemKey,\n"
    "          itemId: Number(button.dataset.tsimmItemId) || null,\n"
    "          itemName: button.dataset.tsimmItemName,\n"
    "        }, button.dataset.tsimmSellPriority);\n"
    "      } else if (action === 'sell-priority-hide-suggested') {\n"
    "        hideSuggestedSellPriority();\n"
    "      } else if (action === 'sell-priority-reset') {\n"
    "        resetSellPriorities();\n"
    "      } else if (action === 'api-key-builder') {\n",
    'click handlers',
)

text = replace_once(
    text,
    "        recentSales: (state.ledger.sales || []).slice(0, 5),\n"
    "      },\n"
    "      pendingPurchase: state.pendingPurchase,\n",
    "        recentSales: (state.ledger.sales || []).slice(0, 5),\n"
    "      },\n"
    "      inventoryBaseline: state.inventoryBaseline,\n"
    "      sellPriority: state.sellPriority,\n"
    "      pendingPurchase: state.pendingPurchase,\n",
    'diagnostics baseline and priority',
)

if protected_block(text, '  function listingRowHasPurchaseControl(row) {', '  const MARKET_TIER_CLASSES = Object.freeze([') != protected_listing:
    raise SystemExit('Protected listing containment changed unexpectedly')
if protected_block(text, "      const quickMaxOverride = event.target.closest('[data-tsimm-quick-max-override]');", "      const soldToggle = event.target.closest('[data-tsimm-ledger-show-sold]');") != protected_override:
    raise SystemExit('Protected Override MAX block changed unexpectedly')

required = [
    '// @version      0.14.0',
    "version: '0.14.0'",
    'const INVENTORY_API_CATEGORIES = Object.freeze([',
    "inventoryBaselineStorageKey: 'tornscripture-imm-inventory-baseline-v1'",
    "sellPriorityStorageKey: 'tornscripture-imm-sell-priority-v1'",
    'function normalizeInventoryBaseline(raw)',
    'function normalizeSellPriority(raw)',
    'function setCurrentInventoryBaseline()',
    'function sellPriorityAllowsSelling(candidate)',
    'data-tsimm-action="sell-priority-set"',
    'HIDE ${formatInteger(counts.suggested || 0)} SUGGESTED',
    'function listingRowHasPurchaseControl(row)',
    'OVERRIDE MAX ARMED',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Missing release token: {token}')
if '@require' in text:
    raise SystemExit('Release became a wrapper unexpectedly')

path.write_text(text, encoding='utf-8')
