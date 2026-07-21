from pathlib import Path

PATH = Path("TornScripture-Item-Market-Margin.user.js")
text = PATH.read_text(encoding="utf-8")

checks = {
    "metadata version": "// @version      0.9.1",
    "run timing": "// @run-at       document-idle",
    "banner version": "TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.1",
    "runtime version": "version: '0.9.1',",
    "startup import": "    const importedPriceCapture = consumeImportedPriceCapture();",
}
for label, needle in checks.items():
    if needle not in text:
        raise SystemExit(f"Missing expected {label}: {needle}")

text = text.replace("// @version      0.9.1", "// @version      0.9.2", 1)
text = text.replace("// @run-at       document-idle", "// @run-at       document-start", 1)
text = text.replace("TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.1", "TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.2", 1)
text = text.replace("version: '0.9.1',", "version: '0.9.2',", 1)

anchor = "(() => {\n  'use strict';\n"
if text.count(anchor) != 1:
    raise SystemExit(f"Expected one userscript anchor, found {text.count(anchor)}")

preflight = r'''

  const EARLY_CAPTURE = Object.freeze({
    importQueryKey: 'tsimmPriceImport',
    tradersKey: 'tornscripture-imm-traders-v1',
    pendingKey: 'tornscripture-imm-pending-trader-capture-v1',
    catalogKey: 'tornscripture-imm-catalog-v1',
    sharedCatalogKey: 'tornscripture-ish-torn-catalog-v1',
    bridgePrefix: 'TSIMM_PRICE_BRIDGE:',
    noticeKey: 'tornscripture-imm-core-capture-notice-v1',
  });

  function earlyClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function earlyLoadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : earlyClone(fallback);
    } catch {
      return earlyClone(fallback);
    }
  }

  function earlyClean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function earlyNameKey(value) {
    return earlyClean(value)
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9'+&-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function earlyDecodeBase64Url(value) {
    try {
      const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function earlyNormalizeCatalog(raw) {
    const result = { byId: {}, byName: {} };
    const source = raw?.itemsByName || raw?.items || {};
    const entries = Array.isArray(source)
      ? source.map((item) => [String(item?.id ?? ''), item])
      : Object.entries(source);
    for (const [key, item] of entries) {
      if (!item || typeof item !== 'object') continue;
      const id = Math.max(0, Math.floor(Number(item.id ?? item.itemId ?? key) || 0)) || null;
      const name = earlyClean(item.name);
      if (!name) continue;
      const normalized = { id, name };
      if (id) result.byId[String(id)] = normalized;
      result.byName[earlyNameKey(name)] = normalized;
    }
    return result;
  }

  function earlyCatalog() {
    const shared = earlyNormalizeCatalog(earlyLoadJson(EARLY_CAPTURE.sharedCatalogKey, {}));
    const own = earlyNormalizeCatalog(earlyLoadJson(EARLY_CAPTURE.catalogKey, {}));
    return {
      byId: { ...shared.byId, ...own.byId },
      byName: { ...shared.byName, ...own.byName },
    };
  }

  function earlyCaptureItems(compact) {
    const values = earlyCatalog();
    if (!Array.isArray(compact?.i)) return [];
    return compact.i.map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const itemId = Math.max(0, Math.floor(Number(entry[0]) || 0)) || null;
      const unitPrice = Math.max(0, Number(entry[1]) || 0);
      const itemName = earlyClean(entry[2])
        || (itemId ? values.byId[String(itemId)]?.name : '')
        || (itemId ? `Item ${itemId}` : '');
      if ((!itemId && !itemName) || !unitPrice) return null;
      return { itemId, itemName, normalizedName: earlyNameKey(itemName), unitPrice };
    }).filter(Boolean);
  }

  function earlyItemKey(item) {
    return Number(item?.itemId) > 0
      ? `id:${Number(item.itemId)}`
      : `name:${earlyNameKey(item?.itemName)}`;
  }

  function earlyChangedCount(previous, next) {
    const before = new Map((previous || []).map((item) => [earlyItemKey(item), Number(item?.unitPrice) || 0]).filter(([key]) => key));
    const after = new Map((next || []).map((item) => [earlyItemKey(item), Number(item?.unitPrice) || 0]).filter(([key]) => key));
    const keys = new Set([...before.keys(), ...after.keys()]);
    let changed = 0;
    for (const key of keys) {
      if (!before.has(key) || !after.has(key) || Math.round(before.get(key)) !== Math.round(after.get(key))) changed += 1;
    }
    return changed;
  }

  function earlyFindTraderIndex(traders, pending, identity) {
    const pendingName = earlyNameKey(pending?.name);
    let index = traders.findIndex((trader) =>
      (pending?.traderId && String(trader?.id) === String(pending.traderId))
      || (Number(pending?.userId) > 0 && Number(trader?.userId) === Number(pending.userId))
      || (pendingName && earlyNameKey(trader?.name) === pendingName));
    if (index >= 0) return index;
    const identityName = earlyNameKey(identity?.name);
    return traders.findIndex((trader) =>
      (identity?.traderId && String(trader?.id) === String(identity.traderId))
      || (Number(identity?.userId) > 0 && Number(trader?.userId) === Number(identity.userId))
      || (identityName && earlyNameKey(trader?.name) === identityName));
  }

  function earlyClearBridgeName() {
    const raw = String(window.name || '');
    if (!raw.startsWith(EARLY_CAPTURE.bridgePrefix)) return;
    try {
      const payload = JSON.parse(raw.slice(EARLY_CAPTURE.bridgePrefix.length));
      window.name = earlyClean(payload?.previousWindowName);
    } catch {
      window.name = '';
    }
  }

  function runEarlyCapturePreflight() {
    let url;
    try {
      url = new URL(location.href);
    } catch {
      return false;
    }
    const encoded = url.searchParams.get(EARLY_CAPTURE.importQueryKey);
    if (!encoded) return false;

    const compact = earlyDecodeBase64Url(encoded);
    const items = earlyCaptureItems(compact);
    if (!compact || !items.length) return false;

    const pending = earlyLoadJson(EARLY_CAPTURE.pendingKey, null);
    const identity = compact.t && typeof compact.t === 'object' ? compact.t : {};
    const rawStore = earlyLoadJson(EARLY_CAPTURE.tradersKey, []);
    const objectStore = !Array.isArray(rawStore) && Array.isArray(rawStore?.traders);
    const traders = Array.isArray(rawStore) ? rawStore : objectStore ? rawStore.traders : [];
    let index = earlyFindTraderIndex(traders, pending, identity);

    if (index < 0) {
      const name = earlyClean(pending?.name || identity.name)
        || (Number(pending?.userId || identity.userId) > 0
          ? `Trader ${Number(pending?.userId || identity.userId)}`
          : 'Captured trader');
      traders.push({
        id: earlyClean(pending?.traderId || identity.traderId) || `trader-${Date.now()}`,
        name,
        normalizedName: earlyNameKey(name),
        userId: Number(pending?.userId || identity.userId) > 0 ? Number(pending?.userId || identity.userId) : null,
        rating: 0,
        targetPercent: 99,
        profileUrl: earlyClean(identity.profileUrl),
        tradeUrl: earlyClean(identity.tradeUrl),
        bannerUrl: earlyClean(identity.bannerUrl),
        captureSource: 'weav3r-pricelist',
        pricePageItems: [],
        createdAt: new Date().toISOString(),
      });
      index = traders.length - 1;
    }

    const trader = traders[index];
    const now = new Date().toISOString();
    const sourceUrl = earlyClean(compact.u);
    const previousItems = Array.isArray(trader.pricePageItems) ? trader.pricePageItems : [];
    const changes = earlyChangedCount(previousItems, items);
    traders[index] = {
      ...trader,
      normalizedName: earlyNameKey(trader.name),
      previousPricePageUrl: sourceUrl && trader.pricePageUrl && sourceUrl !== trader.pricePageUrl
        ? trader.pricePageUrl
        : earlyClean(trader.previousPricePageUrl),
      pricePageUrl: sourceUrl || earlyClean(trader.pricePageUrl),
      pricePageTitle: earlyClean(compact.l || trader.pricePageTitle).slice(0, 160),
      pricePageProvider: 'weav3r',
      pricePageItems: items,
      pricePageCapturedAt: compact.c || now,
      pricePageLastCheckedAt: now,
      pricePageCaptureCount: Math.max(0, Math.floor(Number(trader.pricePageCaptureCount) || 0)) + 1,
      pricePageLastChangedCount: changes,
      pricePageLastResult: 'weav3r-pricelist:core-preflight',
      updatedAt: now,
    };

    try {
      localStorage.setItem(
        EARLY_CAPTURE.tradersKey,
        JSON.stringify(objectStore ? { ...rawStore, traders } : traders),
      );
      localStorage.removeItem(EARLY_CAPTURE.pendingKey);
    } catch (error) {
      console.error('[TornScripture IMM] Early capture storage failed:', error);
      return false;
    }

    earlyClearBridgeName();
    url.searchParams.delete(EARLY_CAPTURE.importQueryKey);
    try {
      sessionStorage.setItem(EARLY_CAPTURE.noticeKey, JSON.stringify({
        trader: traders[index].name,
        count: items.length,
        changes,
      }));
    } catch {}
    location.replace(url.href);
    return true;
  }

  function consumeEarlyCaptureNotice() {
    try {
      const payload = JSON.parse(sessionStorage.getItem(EARLY_CAPTURE.noticeKey) || 'null');
      sessionStorage.removeItem(EARLY_CAPTURE.noticeKey);
      return payload;
    } catch {
      return null;
    }
  }

  if (runEarlyCapturePreflight()) return;
  const EARLY_CAPTURE_NOTICE = consumeEarlyCaptureNotice();
'''

text = text.replace(anchor, anchor + preflight, 1)

startup = "    const importedPriceCapture = consumeImportedPriceCapture();"
notice = r'''    const importedPriceCapture = consumeImportedPriceCapture();
    if (EARLY_CAPTURE_NOTICE) {
      setTimeout(() => toast(
        `${EARLY_CAPTURE_NOTICE.trader}: ${formatInteger(EARLY_CAPTURE_NOTICE.count)} prices saved${EARLY_CAPTURE_NOTICE.changes ? ` · ${formatInteger(EARLY_CAPTURE_NOTICE.changes)} changed` : ''}. IMM controls restored.`,
      ), 150);
    }'''
text = text.replace(startup, notice, 1)

for forbidden in (
    "// @version      0.9.1",
    "// @run-at       document-idle",
    "TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.1",
    "version: '0.9.1',",
):
    if forbidden in text:
        raise SystemExit(f"Old marker survived: {forbidden}")

required = (
    "// @version      0.9.2",
    "// @run-at       document-start",
    "function runEarlyCapturePreflight()",
    "if (runEarlyCapturePreflight()) return;",
    "pricePageLastResult: 'weav3r-pricelist:core-preflight'",
    "IMM controls restored.",
)
for needle in required:
    if needle not in text:
        raise SystemExit(f"Missing patched marker: {needle}")

PATH.write_text(text, encoding="utf-8")
print("Patched Item Market Margin to v0.9.2 with document-start capture preflight.")
