from pathlib import Path

CORE = Path("TornScripture-Item-Market-Margin.user.js")
EXT = Path("TornScripture-IMM-Trader-Extensions.user.js")
core = CORE.read_text(encoding="utf-8")
ext = EXT.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# Core metadata and capability ownership.
core = replace_once(core, "// @version      0.9.2", "// @version      0.9.3", "core metadata version")
core = replace_once(
    core,
    "// @description  Item-market and overseas profit overlays with NPC buyback flips, TornW3B pricelist capture, purchase history, trade verification, and receipt audits.",
    "// @description  Item-market and overseas profit overlays with NPC buyback flips, TornW3B and TornExchange pricelist capture, purchase history, trade verification, and receipt audits.",
    "core metadata description",
)
core = replace_once(
    core,
    "// @match        https://www.weav3r.dev/pricelist/*\n",
    "// @match        https://www.weav3r.dev/pricelist/*\n// @match        https://tornexchange.com/prices/*\n// @match        https://www.tornexchange.com/prices/*\n",
    "core TornExchange matches",
)
core = replace_once(core, "TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.2", "TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.3", "core banner version")
core = replace_once(core, "version: '0.9.2',", "version: '0.9.3',", "core runtime version")
core = replace_once(
    core,
    "(() => {\n  'use strict';\n",
    "(() => {\n  'use strict';\n\n  if (typeof window !== 'undefined') {\n    window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.3' });\n  }\n",
    "core capability flag",
)

# Generalize early import preflight so TornExchange captures use their own provider label.
core = replace_once(
    core,
    "    const compact = earlyDecodeBase64Url(encoded);\n    const items = earlyCaptureItems(compact);\n    if (!compact || !items.length) return false;\n\n    const pending = earlyLoadJson(EARLY_CAPTURE.pendingKey, null);",
    "    const compact = earlyDecodeBase64Url(encoded);\n    const items = earlyCaptureItems(compact);\n    if (!compact || !items.length) return false;\n    const provider = earlyClean(compact.p).toLowerCase() === 'tornexchange' ? 'tornexchange' : 'weav3r';\n\n    const pending = earlyLoadJson(EARLY_CAPTURE.pendingKey, null);",
    "early provider detection",
)
core = replace_once(core, "        captureSource: 'weav3r-pricelist',", "        captureSource: `${provider}-pricelist`,", "early new-trader provider")
core = replace_once(core, "      pricePageProvider: 'weav3r',", "      pricePageProvider: provider,", "early price provider")
core = replace_once(core, "      pricePageLastResult: 'weav3r-pricelist:core-preflight',", "      pricePageLastResult: `${provider}-pricelist:core-preflight`,", "early result provider")

# Add core ids and state for the TornExchange page module.
core = replace_once(
    core,
    "    receiptAuditOverlayId: 'tornscripture-imm-receipt-audit',\n",
    "    receiptAuditOverlayId: 'tornscripture-imm-receipt-audit',\n    tornExchangePanelId: 'tsimm-tx-panel',\n    tornExchangeStyleId: 'tsimm-tx-core-style',\n",
    "core TX ids",
)
core = replace_once(
    core,
    "    weav3rAutoReturnTimer: null,\n    ledgerUi:",
    "    weav3rAutoReturnTimer: null,\n    tornExchangeCapturePreview: null,\n    tornExchangeCaptureTimer: null,\n    tornExchangeObserver: null,\n    tornExchangeAutoReturnTimer: null,\n    ledgerUi:",
    "core TX state",
)

# Supported URL and generic capture-envelope changes.
core = replace_once(
    core,
    "  function isSupportedPricePageUrl(value) {\n    return isTornPageUrl(value) || isWeav3rPriceListUrl(value);\n  }",
    "  function isTornExchangePriceListUrl(value = location.href) {\n    const normalized = normalizeHttpUrl(value);\n    if (!normalized) return false;\n    try {\n      const url = new URL(normalized);\n      return /^(?:www\\.)?tornexchange\\.com$/i.test(url.hostname)\n        && /^\\/prices\\/[^/]+\\/?$/i.test(url.pathname);\n    } catch {\n      return false;\n    }\n  }\n\n  function cleanSupportedPricePageUrl(value = location.href) {\n    const normalized = cleanWeav3rPriceListUrl(value);\n    if (!normalized) return '';\n    try {\n      const url = new URL(normalized);\n      if (isTornExchangePriceListUrl(url.href)) url.hash = '';\n      return url.href;\n    } catch {\n      return normalized;\n    }\n  }\n\n  function isSupportedPricePageUrl(value) {\n    return isTornPageUrl(value) || isWeav3rPriceListUrl(value) || isTornExchangePriceListUrl(value);\n  }",
    "supported TX URL",
)
core = replace_once(core, "      sourceUrl: cleanWeav3rPriceListUrl(sourceUrl),", "      sourceUrl: cleanSupportedPricePageUrl(sourceUrl),", "generic request source URL")
core = replace_once(
    core,
    "      v: 1,\n      t: compactTraderCaptureIdentity(payload.trader),\n      u: cleanWeav3rPriceListUrl(payload.sourceUrl),",
    "      v: 1,\n      p: normalizeWhitespace(payload.provider || payload.sourceType || 'weav3r').toLowerCase(),\n      t: compactTraderCaptureIdentity(payload.trader),\n      u: cleanSupportedPricePageUrl(payload.sourceUrl),",
    "compact capture provider",
)
core = replace_once(
    core,
    "      trader: compact.t || {},\n      sourceUrl: normalizeHttpUrl(compact.u),",
    "      trader: compact.t || {},\n      provider: normalizeWhitespace(compact.p || 'weav3r').toLowerCase(),\n      sourceUrl: normalizeHttpUrl(compact.u),",
    "expand capture provider",
)
core = replace_once(
    core,
    "    const identity = imported.trader || {};\n    let trader = state.traders.find((entry) =>",
    "    const identity = imported.trader || {};\n    const provider = imported.provider === 'tornexchange' ? 'tornexchange' : 'weav3r';\n    let trader = state.traders.find((entry) =>",
    "import provider selection",
)
core = replace_once(core, "        captureSource: 'weav3r-pricelist',", "        captureSource: `${provider}-pricelist`,", "import new-trader provider")
core = replace_once(
    core,
    "      title: imported.title || `${trader.name}'s TornW3B pricelist`,\n      items: imported.items,\n      sourceType: 'weav3r-pricelist',",
    "      title: imported.title || `${trader.name}'s ${provider === 'tornexchange' ? 'TornExchange' : 'TornW3B'} pricelist`,\n      items: imported.items,\n      sourceType: `${provider}-pricelist`,",
    "import save provider",
)
core = replace_once(
    core,
    "      trader: { ...identity, traderId: identity.traderId || request?.trader?.traderId || '' },\n      sourceUrl: cleanWeav3rPriceListUrl(location.href),",
    "      trader: { ...identity, traderId: identity.traderId || request?.trader?.traderId || '' },\n      provider: 'weav3r',\n      sourceUrl: cleanWeav3rPriceListUrl(location.href),",
    "Weav3r provider marker",
)

# Add TornExchange capture module before the generic recapture helpers.
tx_module = r'''

  function tornExchangeCaptureRequest() {
    const bridged = readPriceBridgeWindowName();
    return bridged?.type === 'request' ? bridged : null;
  }

  function tornExchangePageName() {
    const headings = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
      .map((element) => normalizeWhitespace(element.textContent));
    for (const heading of headings) {
      const match = heading.match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
      if (match?.[1]) return normalizeWhitespace(match[1]);
    }
    const titleMatch = normalizeWhitespace(document.title).match(/^(.+?)(?:[’']s)\s+(?:Trading|Price)\s+List/i);
    if (titleMatch?.[1]) return normalizeWhitespace(titleMatch[1]);
    return normalizeWhitespace(decodeURIComponent(location.pathname).match(/^\/prices\/([^/]+)/i)?.[1]) || 'TornExchange trader';
  }

  function tornExchangePageUpdated() {
    return normalizeWhitespace(String(document.body?.innerText || '').match(/Prices\s+last\s+updated\s*:\s*([^\n\r]+)/i)?.[1]).slice(0, 120);
  }

  function tornExchangeCellPrice(value) {
    const text = normalizeWhitespace(value);
    if (!/\d/.test(text)) return null;
    const number = Number(text.replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function tornExchangeRowItemId(row) {
    for (const element of row.querySelectorAll('[href],[src],[data-item-id],[data-itemid],[data-id]')) {
      for (const value of [
        element.getAttribute('href'), element.getAttribute('src'), element.getAttribute('data-item-id'),
        element.getAttribute('data-itemid'), element.getAttribute('data-id'),
      ].filter(Boolean)) {
        const match = String(value).match(/[?&#](?:itemID|itemId|item_id|ID|id)=(\d+)/i)
          || String(value).match(/\/(?:images\/)?items?\/(\d+)(?:\/|\.|$)/i);
        if (Number(match?.[1]) > 0) return Number(match[1]);
      }
    }
    return null;
  }

  function captureTornExchangePriceItems() {
    const found = new Map();
    for (const table of document.querySelectorAll('table')) {
      const headingRow = table.querySelector('thead tr') || table.querySelector('tr');
      const headings = [...(headingRow?.querySelectorAll('th,td') || [])].map((element) => normalizeName(element.textContent));
      const nameIndex = headings.findIndex((heading) => heading === 'item name' || heading === 'item');
      const priceIndex = headings.findIndex((heading) => heading.includes('buy price') || heading === 'price');
      const rows = table.querySelectorAll('tbody tr').length ? table.querySelectorAll('tbody tr') : table.querySelectorAll('tr');
      for (const row of rows) {
        if (row === headingRow) continue;
        const cells = [...row.children].filter((element) => /^(?:TH|TD)$/i.test(element.tagName));
        if (cells.length < 2) continue;
        let selectedPriceIndex = priceIndex;
        if (selectedPriceIndex < 0 || !tornExchangeCellPrice(cells[selectedPriceIndex]?.textContent)) {
          for (let index = cells.length - 1; index >= 0; index -= 1) {
            if (tornExchangeCellPrice(cells[index].textContent)) {
              selectedPriceIndex = index;
              break;
            }
          }
        }
        const unitPrice = tornExchangeCellPrice(cells[selectedPriceIndex]?.textContent);
        if (!unitPrice) continue;
        let itemName = normalizeWhitespace(cells[nameIndex]?.textContent);
        if (!itemName || /^(?:image|item|item name|buy price|price)$/i.test(itemName) || tornExchangeCellPrice(itemName)) {
          itemName = cells.map((cell, index) => ({ index, text: normalizeWhitespace(cell.textContent) }))
            .filter((entry) => entry.index !== selectedPriceIndex && entry.text && !tornExchangeCellPrice(entry.text) && !/^image$/i.test(entry.text))
            .sort((left, right) => right.text.length - left.text.length)[0]?.text || '';
        }
        if (!itemName) continue;
        const itemId = tornExchangeRowItemId(row);
        const item = normalizeTraderPriceItem({ itemId, itemName, unitPrice });
        if (!item) continue;
        const itemKey = traderPriceItemKey(item);
        const previous = found.get(itemKey);
        if (!previous || unitPrice > previous.unitPrice) found.set(itemKey, item);
      }
    }
    return [...found.values()].sort((left, right) => left.itemName.localeCompare(right.itemName));
  }

  function tornExchangeTraderIdentity() {
    const request = tornExchangeCaptureRequest();
    const requested = request?.trader || {};
    const pageName = tornExchangePageName();
    return {
      traderId: normalizeWhitespace(requested.traderId),
      userId: Math.max(0, Math.floor(Number(requested.userId) || 0)) || null,
      name: pageName || normalizeWhitespace(requested.name) || 'TornExchange trader',
      profileUrl: normalizeHttpUrl(requested.profileUrl),
      tradeUrl: normalizeHttpUrl(requested.tradeUrl),
      bannerUrl: normalizeHttpUrl(requested.bannerUrl),
    };
  }

  function createTornExchangeCaptureResult() {
    const request = tornExchangeCaptureRequest();
    const identity = tornExchangeTraderIdentity();
    const items = captureTornExchangePriceItems();
    const result = {
      trader: { ...identity, traderId: identity.traderId || request?.trader?.traderId || '' },
      provider: 'tornexchange',
      sourceUrl: cleanSupportedPricePageUrl(location.origin + location.pathname),
      title: `${tornExchangePageName()} TornExchange prices`,
      items,
      capturedAt: new Date().toISOString(),
    };
    state.tornExchangeCapturePreview = result;
    writePriceBridgeWindowName({
      version: 1,
      type: 'result',
      compact: compactPriceCaptureResult(result),
      returnUrl: request?.returnUrl || 'https://www.torn.com/page.php?sid=ItemMarket',
      expiresAt: Date.now() + (20 * 60 * 1000),
    });
    return { result, request };
  }

  function goBackToTornWithTornExchangeCapture({ automatic = false } = {}) {
    const { result, request } = createTornExchangeCaptureResult();
    renderTornExchangeCapturePanel();
    if (!result.items.length) return null;
    const armedName = normalizeWhitespace(request?.trader?.name);
    if (armedName && normalizeName(armedName) !== normalizeName(result.trader.name)
      && !confirm(`IMM is armed for ${armedName}, but this page belongs to ${result.trader.name}.\n\nSave these prices to ${armedName}?`)) return null;
    if (armedName) result.trader.name = armedName;
    const returnUrl = returnUrlWithPriceCapture(
      result,
      request?.returnUrl || 'https://www.torn.com/page.php?sid=ItemMarket',
    );
    clearTimeout(state.tornExchangeAutoReturnTimer);
    state.tornExchangeAutoReturnTimer = setTimeout(() => window.location.assign(returnUrl), automatic ? 900 : 300);
    return result;
  }

  function injectTornExchangeStyles() {
    if (!document.head || document.getElementById(APP.tornExchangeStyleId)) return;
    const style = document.createElement('style');
    style.id = APP.tornExchangeStyleId;
    style.textContent = `
      #${APP.tornExchangePanelId}{position:fixed;right:10px;bottom:10px;z-index:2147483646;width:min(360px,calc(100vw - 20px));overflow:hidden;border:1px solid #3bd35d;border-radius:9px;background:#020704;color:#aaff83;box-shadow:0 14px 40px #000c;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${APP.tornExchangePanelId} *{box-sizing:border-box}#${APP.tornExchangePanelId} .txh{display:flex;padding:9px 10px;border-bottom:1px solid #1d6b2d;background:#041108}#${APP.tornExchangePanelId} .txh strong{flex:1}#${APP.tornExchangePanelId} .txb{display:grid;gap:7px;padding:10px}#${APP.tornExchangePanelId} .txg{display:grid;grid-template-columns:1fr auto;gap:4px 8px}#${APP.tornExchangePanelId} .txg b{text-align:right}#${APP.tornExchangePanelId} .txw{padding:7px;border:1px solid #9a6d1f;border-radius:5px;background:#241a05;color:#ffd166}#${APP.tornExchangePanelId} .txa{display:grid;grid-template-columns:1fr 1.7fr;gap:6px}#${APP.tornExchangePanelId} button{border:1px solid #2c843d;border-radius:5px;background:#06170a;color:#b6ff9d;padding:8px;font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    `;
    document.head.appendChild(style);
  }

  function renderTornExchangeCapturePanel() {
    injectTornExchangeStyles();
    let panel = document.getElementById(APP.tornExchangePanelId);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = APP.tornExchangePanelId;
      document.body.appendChild(panel);
    }
    const items = state.tornExchangeCapturePreview?.items || captureTornExchangePriceItems();
    const name = tornExchangePageName();
    const updated = tornExchangePageUpdated();
    const request = tornExchangeCaptureRequest();
    const armed = normalizeWhitespace(request?.trader?.name);
    const mismatch = armed && normalizeName(armed) !== normalizeName(name);
    panel.innerHTML = `<div class="txh"><strong>&gt; TORNEXCHANGE_CAPTURE</strong><span>core v${escapeHtml(APP.version)}</span></div><div class="txb"><div class="txg"><span>PAGE</span><b>${escapeHtml(name)}</b><span>PRICES</span><b>${formatInteger(items.length)}</b><span>UPDATED</span><b>${escapeHtml(updated || 'Unknown')}</b><span>TARGET</span><b>${escapeHtml(armed || name)}</b></div>${mismatch ? `<div class="txw">ARMED FOR ${escapeHtml(armed)} · PAGE IS ${escapeHtml(name)}</div>` : ''}<div class="txa"><button data-tsimm-tx-action="scan">RESCAN</button><button data-tsimm-tx-action="save" ${items.length ? '' : 'disabled'}>CAPTURE & RETURN</button></div></div>`;
  }

  function scheduleTornExchangeCaptureScan(delay = 350) {
    clearTimeout(state.tornExchangeCaptureTimer);
    state.tornExchangeCaptureTimer = setTimeout(() => {
      state.tornExchangeCaptureTimer = null;
      state.tornExchangeCapturePreview = {
        trader: tornExchangeTraderIdentity(),
        provider: 'tornexchange',
        sourceUrl: cleanSupportedPricePageUrl(location.origin + location.pathname),
        title: `${tornExchangePageName()} TornExchange prices`,
        items: captureTornExchangePriceItems(),
      };
      renderTornExchangeCapturePanel();
      const request = tornExchangeCaptureRequest();
      if (request?.autoReturn && state.tornExchangeCapturePreview.items.length
        && readPriceBridgeWindowName()?.type !== 'result') {
        goBackToTornWithTornExchangeCapture({ automatic: true });
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function initializeTornExchangePriceCapture() {
    injectTornExchangeStyles();
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tsimm-tx-action]');
      if (!button) return;
      const action = button.dataset.tsimmTxAction;
      if (action === 'scan') scheduleTornExchangeCaptureScan(20);
      else if (action === 'save') goBackToTornWithTornExchangeCapture({ automatic: false });
    });
    state.tornExchangeObserver = new MutationObserver((records) => {
      const panel = document.getElementById(APP.tornExchangePanelId);
      if (panel && records.every((record) => panel.contains(record.target))) return;
      scheduleTornExchangeCaptureScan(180);
    });
    state.tornExchangeObserver.observe(document.body, { childList: true, subtree: true });
    renderTornExchangeCapturePanel();
    scheduleTornExchangeCaptureScan(650);
    setTimeout(() => scheduleTornExchangeCaptureScan(20), 1600);
  }
'''
core = replace_once(core, "\n  function normalizePriceRecaptureRequest(candidate) {", tx_module + "\n  function normalizePriceRecaptureRequest(candidate) {", "insert TX module")

# Core recapture routing and boot ownership.
core = replace_once(
    core,
    "    if (!isTornPageUrl(trader.pricePageUrl)) {",
    "    if (isTornExchangePriceListUrl(trader.pricePageUrl)) {\n      const request = priceCaptureRequestForTrader(trader, trader.pricePageUrl);\n      writePriceBridgeWindowName(request);\n      window.location.assign(cleanSupportedPricePageUrl(trader.pricePageUrl));\n      return;\n    }\n    if (!isTornPageUrl(trader.pricePageUrl)) {",
    "TX recapture route",
)
core = replace_once(
    core,
    "    if (isWeav3rPriceListUrl(location.href)) {\n      initializeWeav3rPriceCapture();\n      return;\n    }",
    "    if (isTornExchangePriceListUrl(location.href)) {\n      initializeTornExchangePriceCapture();\n      return;\n    }\n    if (isWeav3rPriceListUrl(location.href)) {\n      initializeWeav3rPriceCapture();\n      return;\n    }",
    "core TX boot",
)

# Extension enters compatibility mode for the migrated TX lane.
ext = replace_once(ext, "// @version      0.1.10", "// @version      0.1.11", "extension metadata version")
ext = replace_once(ext, "v: '0.1.10',", "v: '0.1.11',", "extension runtime version")
ext = replace_once(
    ext,
    "  const isTX = (value = location.href) => {\n",
    "  const coreOwnsTX = () => Boolean(window.__TSIMM_CORE_TX_CAPTURE__);\n  const isTX = (value = location.href) => {\n",
    "extension ownership helper",
)
ext = replace_once(
    ext,
    "      if (!trader || !isTX(trader.url)) {",
    "      if (!trader || !isTX(trader.url) || coreOwnsTX()) {",
    "extension core-owned recapture suppression",
)
ext = replace_once(ext, "    if (importTX()) return;", "    if (!coreOwnsTX() && importTX()) return;", "extension import suppression")
ext = replace_once(
    ext,
    "  if (typeof window !== 'undefined' && typeof document !== 'undefined') {\n    isTorn() ? tornBoot() : txBoot();\n  }",
    "  if (typeof window !== 'undefined' && typeof document !== 'undefined') {\n    if (isTorn()) setTimeout(tornBoot, 140);\n    else setTimeout(() => { if (!coreOwnsTX()) txBoot(); }, 260);\n  }",
    "extension delayed ownership boot",
)

# Guardrails.
for marker in (
    "// @version      0.9.3",
    "window.__TSIMM_CORE_TX_CAPTURE__",
    "function initializeTornExchangePriceCapture()",
    "provider: 'tornexchange'",
    "isTornExchangePriceListUrl(trader.pricePageUrl)",
):
    if marker not in core:
        raise SystemExit(f"Missing core marker: {marker}")
for marker in (
    "// @version      0.1.11",
    "const coreOwnsTX",
    "if (!coreOwnsTX() && importTX()) return;",
):
    if marker not in ext:
        raise SystemExit(f"Missing extension marker: {marker}")

CORE.write_text(core, encoding="utf-8")
EXT.write_text(ext, encoding="utf-8")
print("Patched IMM core v0.9.3 and Trader Extensions v0.1.11 for TornExchange ownership migration.")
