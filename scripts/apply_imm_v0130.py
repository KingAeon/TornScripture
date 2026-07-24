from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text

if '// @version      0.12.3' not in text:
    raise SystemExit('Expected stable IMM v0.12.3 source')
if '@require' in text:
    raise SystemExit('Refusing to patch a wrapper userscript')

def once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label} anchor count: {count}')
    text = text.replace(old, new, 1)

def block(start, end, replacement, label):
    global text
    left = text.find(start)
    if left < 0:
        raise SystemExit(f'{label} start missing')
    right = text.find(end, left)
    if right < 0:
        raise SystemExit(f'{label} end missing')
    text = text[:left] + replacement.rstrip() + '\n\n' + text[right:]

once(
    "    ledgerOverlayId: 'tornscripture-imm-ledger',\n",
    "    ledgerOverlayId: 'tornscripture-imm-ledger',\n"
    "    ledgerReconcileStyleId: 'tornscripture-imm-ledger-reconcile-style',\n",
    'reconcile style id',
)
once(
    "    ledgerStorageKey: 'tornscripture-imm-ledger-v1',\n",
    "    ledgerStorageKey: 'tornscripture-imm-ledger-v1',\n"
    "    inventoryStorageKey: 'tornscripture-imm-inventory-v1',\n",
    'inventory storage',
)
once(
    "    catalogUrl: 'https://api.torn.com/v2/torn/items',\n",
    "    catalogUrl: 'https://api.torn.com/v2/torn/items',\n"
    "    inventoryUrl: 'https://api.torn.com/v2/user/inventory',\n"
    "    inventoryItemMarketUrl: 'https://api.torn.com/v2/user/itemmarket',\n",
    'inventory urls',
)
once(
    "    traderCaptureMaxAgeMs: 60 * 60 * 1000,\n",
    "    traderCaptureMaxAgeMs: 60 * 60 * 1000,\n"
    "    inventoryCacheMaxAgeMs: 2 * 60 * 60 * 1000,\n",
    'inventory max age',
)
once(
    "    ledger: normalizeLedger(loadJson(APP.ledgerStorageKey, {})),\n",
    "    ledger: normalizeLedger(loadJson(APP.ledgerStorageKey, {})),\n"
    "    inventory: normalizeInventoryCache(loadJson(APP.inventoryStorageKey, {})),\n",
    'inventory state',
)
once(
    "    syncing: false,\n",
    "    syncing: false,\n"
    "    inventorySyncing: false,\n",
    'inventory sync state',
)
once(
    "      overseasPlanItems: [],\n",
    "      overseasPlanItems: [],\n"
    "      overseasRankedItems: [],\n",
    'overseas ranked stats',
)

inventory_code = r'''  function inventoryKey(candidate) {
    const id = Number(candidate?.itemId ?? candidate?.id);
    if (id > 0) return `id:${id}`;
    const name = normalizeName(candidate?.itemName ?? candidate?.name);
    return name ? `name:${name}` : '';
  }

  function inventoryEntry(candidate, source = 'inventory') {
    if (!candidate || typeof candidate !== 'object') return null;
    const nested = candidate.item && typeof candidate.item === 'object' ? candidate.item : {};
    const itemId = Number(
      candidate.itemId ?? candidate.item_id ?? candidate.itemID
      ?? nested.id ?? nested.itemId ?? candidate.id
    ) > 0
      ? Number(candidate.itemId ?? candidate.item_id ?? candidate.itemID ?? nested.id ?? nested.itemId ?? candidate.id)
      : null;
    const catalog = itemId ? state?.catalog?.itemsById?.[String(itemId)] : null;
    const itemName = normalizeWhitespace(
      candidate.itemName ?? candidate.item_name ?? candidate.name
      ?? nested.name ?? nested.itemName ?? catalog?.name
    );
    const quantity = Math.max(0, Math.floor(Number(
      candidate.quantity ?? candidate.qty ?? candidate.amount ?? candidate.stock
      ?? candidate.available ?? candidate.count ?? candidate.owned
      ?? nested.quantity ?? nested.amount
    ) || 0));
    if ((!itemId && !itemName) || quantity <= 0) return null;
    return {
      itemId,
      itemName: catalog?.name || itemName || `Item ${itemId}`,
      onHandQuantity: source === 'itemmarket' ? 0 : quantity,
      listedQuantity: source === 'itemmarket' ? quantity : 0,
    };
  }

  function mergeInventory(target, candidate) {
    const key = inventoryKey(candidate);
    if (!key) return;
    const existing = target.get(key) || {
      itemId: candidate.itemId || null,
      itemName: candidate.itemName,
      onHandQuantity: 0,
      listedQuantity: 0,
    };
    existing.itemId ||= candidate.itemId || null;
    existing.itemName ||= candidate.itemName;
    existing.onHandQuantity += Number(candidate.onHandQuantity || 0);
    existing.listedQuantity += Number(candidate.listedQuantity || 0);
    existing.totalQuantity = existing.onHandQuantity + existing.listedQuantity;
    target.set(key, existing);
  }

  function inventoryEntriesFromPayload(payload, source) {
    const found = new Map();
    const queue = [{ value: payload, depth: 0 }];
    const visited = new Set();
    while (queue.length) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object' || visited.has(value) || depth > 8) continue;
      visited.add(value);
      if (Array.isArray(value)) {
        value.forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
        continue;
      }
      const entry = inventoryEntry(value, source);
      if (entry) mergeInventory(found, entry);
      for (const [key, child] of Object.entries(value)) {
        if (!child || typeof child !== 'object' || /metadata|links|pagination/i.test(key)) continue;
        queue.push({ value: child, depth: depth + 1 });
      }
    }
    return [...found.values()];
  }

  function normalizeInventoryCache(raw) {
    const found = new Map();
    for (const item of Array.isArray(raw?.items) ? raw.items : []) {
      const itemId = Number(item?.itemId) > 0 ? Number(item.itemId) : null;
      const itemName = normalizeWhitespace(item?.itemName ?? item?.name) || (itemId ? `Item ${itemId}` : '');
      const onHandQuantity = Math.max(0, Math.floor(Number(item?.onHandQuantity ?? item?.quantity) || 0));
      const listedQuantity = Math.max(0, Math.floor(Number(item?.listedQuantity) || 0));
      if ((!itemId && !itemName) || onHandQuantity + listedQuantity <= 0) continue;
      mergeInventory(found, { itemId, itemName, onHandQuantity, listedQuantity });
    }
    return {
      schema: 'tornscripture-imm-inventory',
      schemaVersion: 1,
      capturedAt: raw?.capturedAt || null,
      items: [...found.values()],
      itemMarketIncluded: Boolean(raw?.itemMarketIncluded),
      itemMarketError: normalizeWhitespace(raw?.itemMarketError),
    };
  }

  function inventorySnapshotFresh() {
    const captured = Date.parse(state.inventory?.capturedAt || '');
    return Number.isFinite(captured) && Date.now() - captured <= APP.inventoryCacheMaxAgeMs;
  }

  function inventoryNextUrl(payload, currentUrl) {
    const value = payload?._metadata?.links?.next
      ?? payload?.metadata?.links?.next
      ?? payload?.pagination?.next
      ?? payload?.links?.next;
    if (!value) return '';
    try { return new URL(value, currentUrl).href; } catch { return ''; }
  }

  async function fetchInventorySelection(baseUrl, source, key) {
    const found = new Map();
    let url = new URL(baseUrl);
    url.searchParams.set('limit', '250');
    for (let page = 0; url && page < 20; page += 1) {
      const response = await fetch(url.href, {
        headers: { Accept: 'application/json', Authorization: `ApiKey ${key}` },
        credentials: 'omit',
        cache: 'no-store',
      });
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error(`${source === 'itemmarket' ? 'Item Market' : 'Inventory'} returned unreadable data (${response.status}).`); }
      if (!response.ok || payload?.error) throw new Error(apiErrorMessage(payload, response));
      inventoryEntriesFromPayload(payload, source).forEach((item) => mergeInventory(found, item));
      const next = inventoryNextUrl(payload, url.href);
      url = next ? new URL(next) : null;
    }
    return [...found.values()];
  }

  async function syncInventorySnapshot() {
    if (state.inventorySyncing) return;
    const key = currentApiKey();
    if (!key) {
      toast('Set a Limited Access API key first.');
      setApiKey();
      return;
    }
    state.inventorySyncing = true;
    renderLedger();
    try {
      const found = new Map();
      (await fetchInventorySelection(APP.inventoryUrl, 'inventory', key))
        .forEach((item) => mergeInventory(found, item));
      let itemMarketIncluded = false;
      let itemMarketError = '';
      try {
        (await fetchInventorySelection(APP.inventoryItemMarketUrl, 'itemmarket', key))
          .forEach((item) => mergeInventory(found, item));
        itemMarketIncluded = true;
      } catch (error) {
        itemMarketError = normalizeWhitespace(error?.message || 'Active Item Market listings could not be read.');
      }
      state.inventory = normalizeInventoryCache({
        capturedAt: new Date().toISOString(),
        items: [...found.values()],
        itemMarketIncluded,
        itemMarketError,
      });
      saveJson(APP.inventoryStorageKey, state.inventory);
      const quantity = state.inventory.items.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0);
      toast(`Inventory snapshot saved: ${formatInteger(quantity)} items${itemMarketIncluded ? ' including active Item Market listings' : ''}.`);
    } catch (error) {
      toast(error?.message || 'Inventory sync failed.');
    } finally {
      state.inventorySyncing = false;
      renderLedger();
    }
  }

  function ledgerHoldingMap() {
    const found = new Map();
    for (const lot of state.ledger.lots || []) {
      const quantity = Math.max(0, Math.floor(Number(lot.remainingQuantity) || 0));
      if (!quantity) continue;
      const key = Number(lot.itemId) > 0 ? `id:${Number(lot.itemId)}` : `name:${normalizeName(lot.itemName)}`;
      const entry = found.get(key) || {
        key,
        itemId: Number(lot.itemId) > 0 ? Number(lot.itemId) : null,
        itemName: lot.itemName,
        ledgerQuantity: 0,
      };
      entry.ledgerQuantity += quantity;
      found.set(key, entry);
    }
    return found;
  }

  function recentLedgerActivity(key) {
    const cutoff = Date.now() - 75 * 60 * 1000;
    const recentLot = (state.ledger.lots || []).some((lot) => {
      const lotKey = Number(lot.itemId) > 0 ? `id:${Number(lot.itemId)}` : `name:${normalizeName(lot.itemName)}`;
      return lotKey === key && Date.parse(lot.capturedAt || '') >= cutoff;
    });
    const recentSale = (state.ledger.sales || []).some((sale) =>
      Date.parse(sale.soldAt || '') >= cutoff
      && (sale.items || []).some((item) => {
        const itemKey = Number(item.itemId) > 0 ? `id:${Number(item.itemId)}` : `name:${normalizeName(item.itemName)}`;
        return itemKey === key;
      })
    );
    return recentLot || recentSale;
  }

  function ledgerReconciliationRows() {
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

  function injectLedgerReconciliationStyles() {
    if (!document.head || document.getElementById(APP.ledgerReconcileStyleId)) return;
    const style = document.createElement('style');
    style.id = APP.ledgerReconcileStyleId;
    style.textContent = `
      #${APP.ledgerOverlayId} .tsimm-reconcile-note{margin:10px 12px;padding:9px;border:1px solid #27819a;border-radius:7px;background:#06171d;color:#c1efff;font-size:10px;line-height:1.45}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:0 12px 9px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts div{padding:6px;border:1px solid #333;border-radius:6px;text-align:center;background:#141414}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts strong,#${APP.ledgerOverlayId} .tsimm-reconcile-counts span{display:block}
      #${APP.ledgerOverlayId} .tsimm-reconcile-counts span{font-size:8px;color:#aaa}
      #${APP.ledgerOverlayId} .tsimm-reconcile-list{display:grid;gap:6px;padding:0 12px 14px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row{padding:8px;border:1px solid #333;border-radius:7px;background:#111}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.untracked{border-color:#b68b2c;background:#211906}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.missing{border-color:#bd4b61;background:#21080e}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.pending{border-color:#2da8c8;background:#061a20}
      #${APP.ledgerOverlayId} .tsimm-reconcile-row.matched{border-color:#287d47;background:#07180d}
      #${APP.ledgerOverlayId} .tsimm-reconcile-head{display:flex;justify-content:space-between;gap:8px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-head span{font-size:8px;font-weight:800;text-transform:uppercase}
      #${APP.ledgerOverlayId} .tsimm-reconcile-grid{display:grid;grid-template-columns:1fr auto;gap:3px 10px;margin-top:6px;font-size:10px}
      #${APP.ledgerOverlayId} .tsimm-reconcile-grid strong{text-align:right}
      @media(max-width:520px){#${APP.ledgerOverlayId} .tsimm-reconcile-counts{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function reconciliationStatus(status) {
    return ({
      matched: 'Matched',
      untracked: 'Untracked',
      missing: 'Missing',
      pending: 'Pending',
      stale: 'Snapshot stale',
      'not-synced': 'Not synced',
    })[status] || status;
  }

  function ledgerReconciliationHtml(rows) {
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
  }'''

once(
    "  function normalizeLedger(raw) {\n",
    inventory_code + "\n\n  function normalizeLedger(raw) {\n",
    'inventory and reconcile helpers',
)

render_ledger = r'''  function renderLedger() {
    const overlay = document.getElementById(APP.ledgerOverlayId);
    if (!overlay) return;
    injectLedgerReconciliationStyles();
    const summary = ledgerSummary();
    const lots = visibleLedgerLots();
    const sales = state.ledger.sales || [];
    const view = state.ledgerUi.view;
    const reconciliationRows = ledgerReconciliationRows();
    const issues = reconciliationRows.filter((row) => ['untracked', 'missing'].includes(row.status)).length;
    const catalogFreshness = state.catalog.updatedAt
      ? `Current values synced ${relativeAge(state.catalog.updatedAt)}${catalogIsFresh() ? '' : ' · stale'}`
      : 'Current values have not been synced';
    const inventoryFreshness = state.inventory?.capturedAt
      ? `Inventory synced ${relativeAge(state.inventory.capturedAt)}${inventorySnapshotFresh() ? '' : ' · stale'}`
      : 'Inventory has not been synced';
    const showPurchaseControls = view === 'holdings' || view === 'history';
    overlay.innerHTML = `
      <div class="tsimm-ledger-shell">
        <div class="tsimm-ledger-head">
          <div><strong>📒 GOBLIN GOD Ledger</strong><small>What you obtained, what it cost, and what it can earn · schema v4</small></div>
          <button type="button" data-tsimm-action="ledger-close">×</button>
        </div>
        <div class="tsimm-ledger-summary">
          <div><strong>${formatInteger(summary.lots)}</strong><span>open lots</span></div>
          <div><strong>${formatInteger(summary.remainingQuantity)}</strong><span>on hand</span></div>
          <div><strong>${formatMoney(summary.invested)}</strong><span>invested</span></div>
          <div><strong class="${summary.expectedProfit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${summary.expectedProfit >= 0 ? '+' : ''}${formatMoney(summary.expectedProfit)}</strong><span>original expected</span></div>
          <div><strong class="${summary.realizedProfit >= 0 ? 'tsimm-ledger-profit' : 'tsimm-ledger-loss'}">${summary.realizedProfit >= 0 ? '+' : ''}${formatMoney(summary.realizedProfit)}</strong><span>realized</span></div>
        </div>
        <div class="tsimm-ledger-tabs" role="tablist">
          <button type="button" class="${view === 'holdings' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="holdings">Current holdings</button>
          <button type="button" class="${view === 'reconcile' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="reconcile">Reconcile${issues ? ` (${formatInteger(issues)})` : ''}</button>
          <button type="button" class="${view === 'history' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="history">Purchase history</button>
          <button type="button" class="${view === 'sales' ? 'active' : ''}" data-tsimm-action="ledger-tab" data-tsimm-ledger-view="sales">Sale audits</button>
        </div>
        <div class="tsimm-ledger-actions">
          <button type="button" data-tsimm-action="inventory-sync" ${state.inventorySyncing ? 'disabled' : ''}>${state.inventorySyncing ? 'Syncing inventory…' : 'Sync inventory'}</button>
          <button type="button" data-tsimm-action="ledger-add">Add manual lot</button>
          <button type="button" data-tsimm-action="ledger-copy">Copy JSON</button>
          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-clear">Clear all</button>
        </div>
        <div class="tsimm-ledger-freshness">${escapeHtml(inventoryFreshness)}</div>
        ${view === 'reconcile'
          ? ledgerReconciliationHtml(reconciliationRows)
          : showPurchaseControls ? `
            <div class="tsimm-ledger-filters">
              <input type="search" value="${escapeHtml(state.ledgerUi.search)}" placeholder="Search item name" data-tsimm-ledger-search>
              <select data-tsimm-ledger-sort>
                <option value="newest" ${state.ledgerUi.sort === 'newest' ? 'selected' : ''}>Newest</option>
                <option value="oldest" ${state.ledgerUi.sort === 'oldest' ? 'selected' : ''}>Oldest</option>
                <option value="profit-now" ${state.ledgerUi.sort === 'profit-now' ? 'selected' : ''}>Highest profit now</option>
                <option value="item-name" ${state.ledgerUi.sort === 'item-name' ? 'selected' : ''}>Item name</option>
                <option value="purchase-price" ${state.ledgerUi.sort === 'purchase-price' ? 'selected' : ''}>Purchase price</option>
              </select>
            </div>
            ${view === 'history' ? `<label class="tsimm-ledger-toggle"><input type="checkbox" data-tsimm-ledger-show-sold ${state.ledgerUi.showSold ? 'checked' : ''}> Show sold purchases</label>` : ''}
            <div class="tsimm-ledger-freshness">${escapeHtml(catalogFreshness)}</div>
            <div class="tsimm-ledger-section-title">${view === 'holdings' ? 'Current holdings' : 'Purchase history'} · ${formatInteger(lots.length)} lot${lots.length === 1 ? '' : 's'}</div>
            <div class="tsimm-ledger-list">${lots.length ? lots.map(ledgerLotHtml).join('') : '<div class="tsimm-ledger-empty">No matching purchase lots to show.</div>'}</div>
          ` : `
            <div class="tsimm-ledger-section-title">Sale history</div>
            <div class="tsimm-ledger-sales">${sales.length ? sales.map(ledgerSaleHtml).join('') : '<div class="tsimm-ledger-empty">No recorded sales yet.</div>'}</div>
          `}
      </div>
    `;
  }'''

block("  function renderLedger() {", "  function openLedger() {", render_ledger, 'render ledger')

overseas_plan = r'''  function overseasLoadPlan(items = [], loadLimit = 21, currentLoad = 0) {
    const limit = Math.max(0, Math.floor(Number(loadLimit) || 0));
    const carried = Math.max(0, Math.min(limit, Math.floor(Number(currentLoad) || 0)));
    const capacity = Math.max(0, limit - carried);
    let remaining = capacity;
    const ordered = items
      .filter((item) => Number(item?.availableQuantity) > 0 && Number(item?.margin?.profitEach) > 0)
      .sort((a, b) =>
        Number(b.margin.profitEach) - Number(a.margin.profitEach)
        || Number(b.margin.roiPercent) - Number(a.margin.roiPercent)
        || String(a.name || '').localeCompare(String(b.name || ''))
      );
    const rankedItems = ordered.slice(0, 2).map((item, index) => ({
      rank: index + 1,
      itemId: item.itemId || item.catalog?.id || null,
      name: item.catalog?.name || item.name,
      availableQuantity: Math.max(0, Math.floor(Number(item.availableQuantity) || 0)),
      unitCost: Number(item.price) || 0,
      traderValue: Number(item.margin?.payout) || 0,
      profitEach: Number(item.margin?.profitEach) || 0,
      runQuantity: Math.min(capacity, Math.max(0, Math.floor(Number(item.availableQuantity) || 0))),
    }));
    const planItems = [];
    for (const item of ordered.slice(0, 2)) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, Math.max(0, Math.floor(Number(item.availableQuantity) || 0)));
      if (!quantity) continue;
      planItems.push({
        itemId: item.itemId || item.catalog?.id || null,
        name: item.catalog?.name || item.name,
        quantity,
        unitCost: Number(item.price) || 0,
        marketValue: Number(item.catalog?.marketPrice) || 0,
        traderValue: Number(item.margin?.payout) || 0,
        profitEach: Number(item.margin?.profitEach) || 0,
        totalCost: (Number(item.price) || 0) * quantity,
        marketTotal: (Number(item.catalog?.marketPrice) || 0) * quantity,
        traderReturn: (Number(item.margin?.payout) || 0) * quantity,
        profit: (Number(item.margin?.profitEach) || 0) * quantity,
      });
      remaining -= quantity;
    }
    return {
      loadLimit: limit,
      currentLoad: carried,
      remainingCapacity: capacity,
      plannedQuantity: planItems.reduce((sum, item) => sum + item.quantity, 0),
      totalCost: planItems.reduce((sum, item) => sum + item.totalCost, 0),
      marketTotal: planItems.reduce((sum, item) => sum + item.marketTotal, 0),
      traderReturn: planItems.reduce((sum, item) => sum + item.traderReturn, 0),
      profit: planItems.reduce((sum, item) => sum + item.profit, 0),
      items: planItems,
      rankedItems,
    };
  }'''

block("  function overseasLoadPlan(items = [], loadLimit = 21, currentLoad = 0) {", "  function pageLooksLikeOverseasShop() {", overseas_plan, 'overseas load plan')

overseas_page = r'''  function applyOverseasPagePlan(candidates, priced, plan, stats, scanToken) {
    clearOverseasPlanAnnotations();
    const anchorRow = candidates[0]?.row || priced[0]?.row;
    if (!(anchorRow instanceof Element)) return;
    const planned = new Map((plan.items || []).map((item) => [overseasPlanItemKey(item), item]));
    const ranked = new Map((plan.rankedItems || []).map((item) => [overseasPlanItemKey(item), item]));
    for (const item of priced) {
      const rank = ranked.get(overseasPlanItemKey(item));
      if (!rank || !(item.row instanceof Element)) continue;
      const selected = planned.get(overseasPlanItemKey(item));
      item.row.classList.add('tsimm-overseas-planned');
      item.row.dataset.tsimmOverseasPlanRank = String(rank.rank);
      item.row.dataset.tsimmScanToken = scanToken;
      const badge = directMarginBadge(item.priceElement, 'overseas');
      if (!badge) continue;
      const line = document.createElement('span');
      line.className = 'tsimm-overseas-buy-line';
      line.dataset.tsimmOverseasPlanUi = 'true';
      line.textContent = selected
        ? `#${rank.rank} BUY ${formatInteger(selected.quantity)} · +${formatMoney(selected.profit)} trip`
        : `#${rank.rank} BACKUP · +${formatMoney(rank.profitEach)} ea`;
      badge.appendChild(line);
      badge.classList.add('tsimm-overseas-planned-badge');
    }
    const card = document.createElement('section');
    card.className = 'tsimm-overseas-page-plan';
    card.dataset.tsimmOverseasPlanUi = 'true';
    card.dataset.tsimmScanToken = scanToken;
    const selected = planned;
    const lines = (plan.rankedItems || []).map((item) => {
      const pick = selected.get(overseasPlanItemKey(item));
      const role = item.rank === 1 ? 'BEST' : 'RUNNER-UP';
      const instruction = pick ? `BUY ${formatInteger(pick.quantity)}` : `BACKUP UP TO ${formatInteger(item.runQuantity)}`;
      return `<div><span><b>#${item.rank} ${role}</b> ${escapeHtml(item.name)} · stock ${formatInteger(item.availableQuantity)} · ${instruction}</span><strong>+${escapeHtml(formatMoney(item.profitEach))} ea</strong></div>`;
    }).join('');
    const fill = (plan.items || []).map((item) => `${escapeHtml(item.name)} × ${formatInteger(item.quantity)}`).join(' + ');
    const message = !plan.remainingCapacity
      ? 'Your configured travel load is already full.'
      : !(plan.rankedItems || []).length
        ? 'No profitable 99% exit was found.'
        : `${fill || 'No fill'} · cost ${formatMoney(plan.totalCost)} · return ${formatMoney(plan.traderReturn)}`;
    card.innerHTML = `<div class="tsimm-overseas-page-plan-head"><strong>✈️ GOBLIN GOD BEST RUN</strong><b>+${escapeHtml(formatMoney(plan.profit))} trip profit</b></div><span>${escapeHtml(message)}</span>${lines ? `<div class="tsimm-overseas-page-plan-list">${lines}</div>` : ''}`;
    let anchor = anchorRow.tagName === 'TR' ? (anchorRow.closest('table') || anchorRow) : anchorRow;
    const list = anchorRow.closest('ul,ol,[class*="shop-list"],[class*="items-list"],[class*="stock"]');
    if (anchorRow.tagName !== 'TR' && list && list !== document.body) anchor = list;
    if (anchor.parentElement) anchor.insertAdjacentElement('beforebegin', card);
    else document.body.prepend(card);
  }'''

block("  function applyOverseasPagePlan(candidates, priced, plan, stats, scanToken) {", "  function scanOverseas(stats, scanToken) {", overseas_page, 'overseas page')
once("    stats.overseasPlanItems = plan.items;\n", "    stats.overseasPlanItems = plan.items;\n    stats.overseasRankedItems = plan.rankedItems;\n", 'overseas stats')

overseas_summary = r'''  function overseasSummaryHtml(stats) {
    if (stats.pageType !== 'overseas shop') return '';
    const currentText = stats.overseasDetectedLoad === null
      ? `assumed 0/${formatInteger(stats.overseasLoadLimit)}`
      : `${formatInteger(stats.overseasDetectedLoad)}/${formatInteger(stats.overseasLoadLimit)}`;
    const planned = new Map((stats.overseasPlanItems || []).map((item) => [overseasPlanItemKey(item), item]));
    const lines = (stats.overseasRankedItems || []).map((item) => {
      const pick = planned.get(overseasPlanItemKey(item));
      const role = item.rank === 1 ? 'BEST' : 'RUNNER-UP';
      return `<div><span>#${item.rank} ${role} · ${escapeHtml(item.name)} · ${pick ? `buy ${formatInteger(pick.quantity)}` : `backup up to ${formatInteger(item.runQuantity)}`}</span><strong>+${escapeHtml(formatMoney(item.profitEach))} ea</strong></div>`;
    }).join('');
    return `<div class="tsimm-overseas-card"><div class="tsimm-overseas-title"><strong>✈️ Best run + runner-up</strong><span>${escapeHtml(stats.overseasCountry || 'foreign shop')}</span></div><div class="tsimm-overseas-grid"><span>Configured load</span><strong>${escapeHtml(currentText)}</strong><span>Planned fill</span><strong>${formatInteger(stats.overseasPlanQuantity)} items</strong><span>Purchase cost</span><strong>${formatMoney(stats.overseasPlanCost)}</strong><span>Ⓣ Return at home</span><strong>${formatMoney(stats.overseasPlanTraderReturn)}</strong><span>Expected trip profit</span><strong class="tsimm-overseas-profit">+${formatMoney(stats.overseasPlanProfit)}</strong></div>${lines ? `<div class="tsimm-overseas-plan">${lines}</div>` : ''}</div>`;
  }'''

block("  function overseasSummaryHtml(stats) {", "  function tradeExitAuditHtml(stats) {", overseas_summary, 'overseas summary')

once(
    "      } else if (action === 'ledger-tab') {\n",
    "      } else if (action === 'inventory-sync') {\n"
    "        syncInventorySnapshot();\n"
    "      } else if (action === 'ledger-tab') {\n",
    'inventory action',
)
once(
    "        if (['holdings', 'history', 'sales'].includes(view)) {\n",
    "        if (['holdings', 'reconcile', 'history', 'sales'].includes(view)) {\n",
    'reconcile tab',
)

text = text.replace('0.12.3', '0.13.0')

for token in [
    '// @version      0.13.0',
    "version: '0.13.0'",
    "inventoryUrl: 'https://api.torn.com/v2/user/inventory'",
    'function syncInventorySnapshot()',
    'function ledgerReconciliationRows()',
    'GOBLIN GOD BEST RUN',
    'RUNNER-UP',
    "['holdings', 'reconcile', 'history', 'sales']",
    'function listingRowHasPurchaseControl(row)',
    "brandName: 'GOBLIN GOD'",
]:
    if token not in text:
        raise SystemExit(f'Missing token: {token}')
if '@require' in text:
    raise SystemExit('Release became a wrapper')
if text.count('function listingRowHasPurchaseControl(row)') != 1:
    raise SystemExit('Stable listing containment changed')
if len(text) < len(original) + 10000:
    raise SystemExit(f'Unexpected size {len(original)} -> {len(text)}')

path.write_text(text, encoding='utf-8')
print(f'Patched {len(original)} -> {len(text)} bytes')
