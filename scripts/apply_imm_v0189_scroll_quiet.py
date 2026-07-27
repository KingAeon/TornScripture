from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '// @version      0.18.8' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.18.8 as patch base')

text = text.replace('0.18.8', '0.18.9')
text = text.replace(
    'focus-anchored fixed-height in-place quantity-reactive',
    'scroll-quiet focus-anchored fixed-height in-place quantity-reactive',
)

old_vars = """  let pricedTradeQuantityTimer = null;
  let pricedTradePendingQuantityRow = null;
  let pricedTradeLastInteractedRow = null;
"""
new_vars = """  let pricedTradeQuantityTimer = null;
  let pricedTradePendingQuantityRow = null;
  let pricedTradeLastInteractedRow = null;
  let pricedTradeScrollQuietTimer = null;
  let pricedTradeScrollActiveUntil = 0;
  let pricedTradeDeferredFullRepaint = false;
  let pricedTradeDeferredRow = null;
  const PRICED_TRADE_SCROLL_QUIET_MS = 280;
"""
if old_vars not in text:
    raise SystemExit('Priced Trade variable marker not found')
text = text.replace(old_vars, new_vars, 1)

old_clear = """  function clearPricedTradeSession(message = '') {
    savePricedTradeSession(null);
    clearTimeout(pricedTradeRepaintSettleTimer);
    clearTimeout(pricedTradeQuantityTimer);
    pricedTradeRepaintSettleTimer = null;
    pricedTradeQuantityTimer = null;
    pricedTradePendingQuantityRow = null;
    pricedTradeLastInteractedRow = null;
    clearPricedTradeAnnotations();
    syncPricedTradePickerObserver();
    if (message) toast(message);
  }
"""
new_clear = """  function clearPricedTradeSession(message = '') {
    savePricedTradeSession(null);
    clearTimeout(pricedTradeRepaintSettleTimer);
    clearTimeout(pricedTradeQuantityTimer);
    clearTimeout(pricedTradeScrollQuietTimer);
    pricedTradeRepaintSettleTimer = null;
    pricedTradeQuantityTimer = null;
    pricedTradeScrollQuietTimer = null;
    pricedTradeScrollActiveUntil = 0;
    pricedTradeDeferredFullRepaint = false;
    pricedTradeDeferredRow = null;
    pricedTradePendingQuantityRow = null;
    pricedTradeLastInteractedRow = null;
    clearPricedTradeAnnotations();
    syncPricedTradePickerObserver();
    if (message) toast(message);
  }
"""
if old_clear not in text:
    raise SystemExit('clearPricedTradeSession marker not found')
text = text.replace(old_clear, new_clear, 1)

old_repaint = """  function schedulePricedTradePickerRepaint(delay = 90) {
    if (!loadPricedTradeSession()) return;
    scheduleScan(delay);
    clearTimeout(pricedTradeRepaintSettleTimer);
    pricedTradeRepaintSettleTimer = setTimeout(() => {
      pricedTradeRepaintSettleTimer = null;
      if (loadPricedTradeSession()) scheduleScan(0);
    }, 780);
  }
"""
new_repaint = """  function pricedTradeScrollIsActive() {
    return Date.now() < pricedTradeScrollActiveUntil;
  }

  function schedulePricedTradeScrollSettle() {
    clearTimeout(pricedTradeScrollQuietTimer);
    const remaining = Math.max(40, pricedTradeScrollActiveUntil - Date.now() + 40);
    pricedTradeScrollQuietTimer = setTimeout(() => {
      pricedTradeScrollQuietTimer = null;
      if (pricedTradeScrollIsActive()) {
        schedulePricedTradeScrollSettle();
        return;
      }
      pricedTradeScrollActiveUntil = 0;
      const deferredRow = pricedTradeDeferredRow;
      const needsFullRepaint = pricedTradeDeferredFullRepaint;
      pricedTradeDeferredRow = null;
      pricedTradeDeferredFullRepaint = false;
      if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
      const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
      if (deferredRow instanceof Element && deferredRow.isConnected && deferredRow.contains(activeElement)) {
        schedulePricedTradeRowRefresh(deferredRow, 0);
        return;
      }
      if (needsFullRepaint) scheduleScan(0);
    }, remaining);
  }

  function capturePricedTradeScroll() {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
    pricedTradeScrollActiveUntil = Date.now() + PRICED_TRADE_SCROLL_QUIET_MS;
    pricedTradeDeferredFullRepaint = true;
    schedulePricedTradeScrollSettle();
  }

  function schedulePricedTradePickerRepaint(delay = 90) {
    if (!loadPricedTradeSession()) return;
    if (pricedTradeScrollIsActive()) {
      pricedTradeDeferredFullRepaint = true;
      schedulePricedTradeScrollSettle();
      return;
    }
    scheduleScan(delay);
    clearTimeout(pricedTradeRepaintSettleTimer);
    pricedTradeRepaintSettleTimer = setTimeout(() => {
      pricedTradeRepaintSettleTimer = null;
      if (loadPricedTradeSession() && !pricedTradeScrollIsActive()) scheduleScan(0);
      else if (loadPricedTradeSession()) {
        pricedTradeDeferredFullRepaint = true;
        schedulePricedTradeScrollSettle();
      }
    }, 780);
  }
"""
if old_repaint not in text:
    raise SystemExit('schedulePricedTradePickerRepaint marker not found')
text = text.replace(old_repaint, new_repaint, 1)


def replace_function(source: str, name: str, replacement: str) -> str:
    marker = f'  function {name}('
    start = source.find(marker)
    if start < 0:
        raise SystemExit(f'Function not found: {name}')
    end = source.find('\n  function ', start + len(marker))
    if end < 0:
        raise SystemExit(f'Could not find end of function: {name}')
    return source[:start] + replacement.rstrip() + '\n' + source[end:]

capture_anchor = r'''
  function pricedTradeCaptureScrollAnchor(surface = pricedTradeInventorySurface()) {
    const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
    const activeRow = activeElement?.closest(`.${PRICED_TRADE_ROW_CLASS}`) || null;
    if (activeRow?.isConnected && (!(surface instanceof Element) || surface.contains(activeRow))) {
      return { mode: 'row', row: activeRow, top: activeRow.getBoundingClientRect().top };
    }
    return null;
  }
'''
text = replace_function(text, 'pricedTradeCaptureScrollAnchor', capture_anchor)

old_row_start = """  function schedulePricedTradeRowRefresh(row, delay = 180) {
    if (!(row instanceof Element) || !row.isConnected || !loadPricedTradeSession()) return false;
    pricedTradeLastInteractedRow = row;
"""
new_row_start = """  function schedulePricedTradeRowRefresh(row, delay = 180) {
    if (!(row instanceof Element) || !row.isConnected || !loadPricedTradeSession()) return false;
    pricedTradeLastInteractedRow = row;
    if (pricedTradeScrollIsActive()) {
      pricedTradeDeferredRow = row;
      schedulePricedTradeScrollSettle();
      return true;
    }
"""
if old_row_start not in text:
    raise SystemExit('schedulePricedTradeRowRefresh start marker not found')
text = text.replace(old_row_start, new_row_start, 1)

old_timer_block = """      if (!(pendingRow instanceof Element) || !pendingRow.isConnected) {
        schedulePricedTradePickerRepaint(45);
        return;
      }
      const verification = pricedTradeVerification(state.lastScan || {});
"""
new_timer_block = """      if (!(pendingRow instanceof Element) || !pendingRow.isConnected) {
        schedulePricedTradePickerRepaint(45);
        return;
      }
      if (pricedTradeScrollIsActive()) {
        pricedTradeDeferredRow = pendingRow;
        schedulePricedTradeScrollSettle();
        return;
      }
      const verification = pricedTradeVerification(state.lastScan || {});
"""
if old_timer_block not in text:
    raise SystemExit('quantity timer marker not found')
text = text.replace(old_timer_block, new_timer_block, 1)

old_apply = """    injectPricedTradeStyles();
    const trader = verification.trader;
"""
new_apply = """    if (pricedTradeScrollIsActive()) {
      pricedTradeDeferredFullRepaint = true;
      schedulePricedTradeScrollSettle();
      return;
    }

    injectPricedTradeStyles();
    const trader = verification.trader;
"""
if old_apply not in text:
    raise SystemExit('applyPricedTradeInventoryBadges marker not found')
text = text.replace(old_apply, new_apply, 1)

old_initialize = """    window.addEventListener('hashchange', () => scheduleScan(20));
    window.addEventListener('popstate', () => scheduleScan(20));
    document.addEventListener('visibilitychange', () => {
"""
new_initialize = """    window.addEventListener('hashchange', () => scheduleScan(20));
    window.addEventListener('popstate', () => scheduleScan(20));
    document.addEventListener('scroll', capturePricedTradeScroll, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
"""
if old_initialize not in text:
    raise SystemExit('initialize listener marker not found')
text = text.replace(old_initialize, new_initialize, 1)

required = [
    '// @version      0.18.9',
    'PRICED_TRADE_SCROLL_QUIET_MS = 280',
    'function pricedTradeScrollIsActive()',
    'function capturePricedTradeScroll()',
    "document.addEventListener('scroll', capturePricedTradeScroll",
    'if (pricedTradeScrollIsActive()) {',
    'pricedTradeDeferredFullRepaint = true;',
    "return { mode: 'row', row: activeRow",
    'schedulePricedTradeRowRefresh',
    'pricedTradeRenderRowBadge',
    'pricedTradePickerObserver.observe(document.body',
    'pricedTradeBestTraderQuote',
    'quickMaxOverrideArmed',
    'buildTradeExitAudit',
    'inventoryBaseline',
    'sellPriority',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit(f'Missing required tokens after patch: {missing}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.9 scroll-quiet patch')
