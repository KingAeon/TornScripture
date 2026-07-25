from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text

if '// @version      0.13.2' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.13.2 header was not found')
if '@require' in text:
    raise SystemExit('Refusing to patch a wrapper userscript')


def replace_block(source: str, start: str, end: str, replacement: str) -> str:
    start_index = source.find(start)
    if start_index < 0:
        raise SystemExit(f'Missing start anchor: {start}')
    end_index = source.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f'Missing end anchor: {end}')
    return source[:start_index] + replacement + source[end_index:]


def protected_block(source: str, start: str, end: str) -> str:
    start_index = source.find(start)
    end_index = source.find(end, start_index)
    if start_index < 0 or end_index < 0:
        raise SystemExit(f'Missing protected block: {start} -> {end}')
    return source[start_index:end_index]

protected_listing = protected_block(
    text,
    '  function listingRowHasPurchaseControl(row) {',
    '  const MARKET_TIER_CLASSES = Object.freeze(['
)
protected_override = protected_block(
    text,
    '      const quickMaxOverride = event.target.closest(\'[data-tsimm-quick-max-override]\');',
    '      const soldToggle = event.target.closest(\'[data-tsimm-ledger-show-sold]\');'
)

constant_anchor = "  const TRADER_PERCENT = 99;\n"
constant_replacement = """  const TRADER_PERCENT = 99;
  const INVENTORY_API_CATEGORIES = Object.freeze([
    'Collectible', 'Clothing', 'Other', 'Tool', 'Melee', 'Defensive', 'Material', 'Car',
    'Primary', 'Secondary', 'Book', 'Special', 'Supply Pack', 'Temporary', 'Enhancer',
    'Artifact', 'Flower', 'Booster', 'Medical', 'Candy', 'Jewelry', 'Alcohol', 'Plushie',
    'Drug', 'Energy Drink',
  ]);
"""
if constant_anchor not in text:
    raise SystemExit('TRADER_PERCENT anchor was not found')
text = text.replace(constant_anchor, constant_replacement, 1)

probe_replacement = """  async function probeGoblinGodEndpoint(urlValue, kind, key) {
    if (kind === 'inventory') {
      const result = await fetchInventoryWithFallback(key, { probeOnly: true });
      return {
        inventory: result.items,
        _tsimmInventoryMode: result.mode,
        _tsimmInventoryCategories: result.categoriesFetched,
      };
    }

    const url = new URL(urlValue);
    url.searchParams.set('comment', 'TornScripture GOBLIN GOD key check');
    const response = await fetch(url.href, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `ApiKey ${key}`,
      },
      credentials: 'omit',
      cache: 'no-store',
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`${kind} returned unreadable data (${response.status}).`);
    }
    if (!response.ok || payload?.error) throw new Error(apiErrorMessage(payload, response));
    return payload;
  }

"""
text = replace_block(
    text,
    '  async function probeGoblinGodEndpoint(urlValue, kind, key) {',
    '  function apiEndpointStatusHtml(name, label) {',
    probe_replacement,
)

old_message = "            message: name === 'keyInfo' ? 'valid key' : 'selection available',"
new_message = """            message: name === 'keyInfo'
              ? 'valid key'
              : name === 'inventory' && payload?._tsimmInventoryMode === 'category-fallback'
                ? 'selection available via category fallback'
                : 'selection available',"""
if old_message not in text:
    raise SystemExit('Key probe status message anchor was not found')
text = text.replace(old_message, new_message, 1)

cache_replacement = """  function normalizeInventoryCache(raw) {
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
      captureMode: normalizeWhitespace(raw?.captureMode),
      categoriesFetched: Array.isArray(raw?.categoriesFetched)
        ? raw.categoriesFetched.map(normalizeWhitespace).filter(Boolean)
        : [],
      categoryErrors: Array.isArray(raw?.categoryErrors)
        ? raw.categoryErrors.map(normalizeWhitespace).filter(Boolean)
        : [],
    };
  }

"""
text = replace_block(
    text,
    '  function normalizeInventoryCache(raw) {',
    '  function inventorySnapshotFresh() {',
    cache_replacement,
)

fetch_replacement = """  function inventoryCategoryError(error) {
    return /(?:incorrect|invalid) category|category.{0,30}(?:incorrect|invalid)/i.test(
      normalizeWhitespace(error?.message || error)
    );
  }

  async function fetchInventorySelection(baseUrl, source, key, { category = '', clean = false } = {}) {
    const found = new Map();
    let url = new URL(baseUrl);
    if (category) url.searchParams.set('cat', category);
    if (!clean) {
      if (source === 'inventory') url.searchParams.set('limit', '250');
      url.searchParams.set('comment', 'TornScripture GOBLIN GOD inventory reconciliation');
    }
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

  async function fetchInventoryWithFallback(key, { probeOnly = false } = {}) {
    try {
      const items = await fetchInventorySelection(APP.inventoryUrl, 'inventory', key, { clean: true });
      return {
        items,
        mode: 'unfiltered',
        categoriesFetched: [],
        categoryErrors: [],
      };
    } catch (error) {
      if (!inventoryCategoryError(error)) throw error;
    }

    const categories = probeOnly ? ['Other'] : INVENTORY_API_CATEGORIES;
    const found = new Map();
    const categoriesFetched = [];
    const categoryErrors = [];
    for (const category of categories) {
      try {
        const items = await fetchInventorySelection(APP.inventoryUrl, 'inventory', key, {
          category,
          clean: true,
        });
        items.forEach((item) => mergeInventory(found, item));
        categoriesFetched.push(category);
      } catch (error) {
        categoryErrors.push(`${category}: ${normalizeWhitespace(error?.message || 'request failed')}`);
      }
    }

    if (categoryErrors.length) {
      throw new Error(`Inventory category fallback failed: ${categoryErrors.join(' · ')}`);
    }
    if (!categoriesFetched.length) {
      throw new Error('Inventory category fallback did not complete any category requests.');
    }

    return {
      items: [...found.values()],
      mode: 'category-fallback',
      categoriesFetched,
      categoryErrors,
    };
  }

  async function syncInventorySnapshot({ skipKeyCheck = false } = {}) {
    if (state.inventorySyncing) return;
    const key = currentApiKey();
    if (!key) {
      toast('Paste the dedicated GOBLIN GOD API key first.');
      configureGoblinGodKey();
      return;
    }
    if (!skipKeyCheck && !state.keyProfile?.endpoints?.inventory?.ok) {
      await inspectGoblinGodKey({ syncAfter: true });
      return;
    }

    state.inventorySyncing = true;
    renderLedger();
    try {
      const found = new Map();
      const inventoryResult = await fetchInventoryWithFallback(key);
      inventoryResult.items.forEach((item) => mergeInventory(found, item));
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
        captureMode: inventoryResult.mode,
        categoriesFetched: inventoryResult.categoriesFetched,
        categoryErrors: inventoryResult.categoryErrors,
      });
      saveJson(APP.inventoryStorageKey, state.inventory);
      state.keyProfile.lastError = itemMarketError ? `Item Market listings: ${itemMarketError}` : '';
      state.keyProfile.endpoints.inventory = {
        ok: true,
        checked: true,
        count: inventoryResult.items.length,
        message: inventoryResult.mode === 'category-fallback'
          ? `available via ${inventoryResult.categoriesFetched.length} categories`
          : 'selection available',
      };
      saveApiKeyProfile();
      const quantity = state.inventory.items.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0);
      const inventoryRoute = inventoryResult.mode === 'category-fallback'
        ? ` via ${inventoryResult.categoriesFetched.length} inventory categories`
        : ' via the complete inventory endpoint';
      toast(`Inventory snapshot saved: ${formatInteger(quantity)} items${inventoryRoute}${itemMarketIncluded ? ', including active Item Market listings' : ''}.`);
    } catch (error) {
      const message = normalizeWhitespace(error?.message || 'Inventory sync failed.');
      state.keyProfile.lastError = `Inventory: ${message}`;
      state.keyProfile.endpoints.inventory = { ok: false, checked: true, count: 0, message };
      saveApiKeyProfile();
      toast(`Inventory API failed: ${message}`);
    } finally {
      state.inventorySyncing = false;
      renderLedger();
      renderPanel();
    }
  }

"""
text = replace_block(
    text,
    '  async function fetchInventorySelection(baseUrl, source, key) {',
    '  function ledgerHoldingMap() {',
    fetch_replacement,
)

old_freshness = """    const inventoryFreshness = state.inventory?.capturedAt
      ? `Inventory synced ${relativeAge(state.inventory.capturedAt)}${inventorySnapshotFresh() ? '' : ' · stale'}`
      : 'Inventory has not been synced';"""
new_freshness = """    const inventoryCaptureNote = state.inventory?.captureMode === 'category-fallback'
      ? ` · ${formatInteger(state.inventory.categoriesFetched?.length || 0)} categories`
      : state.inventory?.captureMode === 'unfiltered'
        ? ' · complete endpoint'
        : '';
    const inventoryFreshness = state.inventory?.capturedAt
      ? `Inventory synced ${relativeAge(state.inventory.capturedAt)}${inventorySnapshotFresh() ? '' : ' · stale'}${inventoryCaptureNote}`
      : 'Inventory has not been synced';"""
if old_freshness not in text:
    raise SystemExit('Inventory freshness anchor was not found')
text = text.replace(old_freshness, new_freshness, 1)

text = text.replace('0.13.2', '0.13.3')

required = (
    '// @version      0.13.3',
    "version: '0.13.3'",
    'const INVENTORY_API_CATEGORIES = Object.freeze([',
    "'Energy Drink'",
    'function inventoryCategoryError(error)',
    'async function fetchInventoryWithFallback(key, { probeOnly = false } = {})',
    "const categories = probeOnly ? ['Other'] : INVENTORY_API_CATEGORIES;",
    "captureMode: inventoryResult.mode",
    "available via ${inventoryResult.categoriesFetched.length} categories",
    'function listingRowHasPurchaseControl(row)',
    'OVERRIDE MAX ARMED',
)
for token in required:
    if token not in text:
        raise SystemExit(f'Missing required release token: {token}')

if protected_block(text, '  function listingRowHasPurchaseControl(row) {', '  const MARKET_TIER_CLASSES = Object.freeze([') != protected_listing:
    raise SystemExit('Protected listing containment block changed unexpectedly')
if protected_block(text, "      const quickMaxOverride = event.target.closest('[data-tsimm-quick-max-override]');", "      const soldToggle = event.target.closest('[data-tsimm-ledger-show-sold]');") != protected_override:
    raise SystemExit('Protected Override MAX block changed unexpectedly')
if '@require' in text:
    raise SystemExit('Release became a wrapper unexpectedly')
if len(text) <= len(original):
    raise SystemExit('Expected a focused source expansion')

path.write_text(text, encoding='utf-8')
