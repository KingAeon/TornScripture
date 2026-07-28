from pathlib import Path
import re

PATH = Path('TornScripture-Item-Market-Margin.user.js')
text = PATH.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


def replace_count(old: str, new: str, expected: int, label: str) -> None:
    global text
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} matches, found {count}')
    text = text.replace(old, new)


replace_once('// @version      0.19.5', '// @version      0.19.6', 'header version')
replace_once(
    'loop-safe Priced Trade badges',
    'interaction-locked Priced Trade badges',
    'description',
)
replace_once(
    'TORNSCRIPTURE - ITEM MARKET MARGIN v0.19.5',
    'TORNSCRIPTURE - ITEM MARKET MARGIN v0.19.6',
    'internal version comment',
)
replace_count("version: '0.19.5'", "version: '0.19.6'", 3, 'version constants')
replace_once(
    '  const PRICED_TRADE_SCROLL_QUIET_MS = 280;',
    '  const PRICED_TRADE_SCROLL_QUIET_MS = 650;',
    'scroll quiet duration',
)

replace_once(
"""  function pricedTradeScrollIsActive() {
    return false;
  }
""",
"""  function pricedTradeScrollIsActive() {
    return Date.now() < pricedTradeScrollActiveUntil;
  }
""",
'active scroll detection')

replace_once(
"""  function capturePricedTradeScroll() {
    // v0.19.0 emergency guard: scrolling must never schedule a Priced Trade repaint.
  }
""",
"""  function capturePricedTradeScroll(event) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
    const target = event?.target instanceof Element ? event.target : null;
    if (target?.closest?.(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    pricedTradeScrollActiveUntil = Date.now() + PRICED_TRADE_SCROLL_QUIET_MS;
    clearTimeout(pricedTradeRepaintSettleTimer);
    clearTimeout(pricedTradeQuantityTimer);
    clearTimeout(pricedTradeScrollQuietTimer);
    pricedTradeRepaintSettleTimer = null;
    pricedTradeQuantityTimer = null;
    pricedTradeScrollQuietTimer = null;
    pricedTradePendingQuantityRow = null;
    pricedTradeDeferredFullRepaint = false;
    pricedTradeDeferredRow = null;
  }
""",
'scroll lockdown handler')

replace_once(
"""  function schedulePricedTradePickerRepaint(delay = 140) {
    if (!loadPricedTradeSession()) return;
    clearTimeout(pricedTradeRepaintSettleTimer);
""",
"""  function schedulePricedTradePickerRepaint(delay = 140) {
    if (!loadPricedTradeSession() || pricedTradeScrollIsActive()) return;
    clearTimeout(pricedTradeRepaintSettleTimer);
""",
'full repaint scroll guard')

replace_count(
"""    if (pricedTradeScrollIsActive()) {
      pricedTradeDeferredRow = row;
      schedulePricedTradeScrollSettle();
      return true;
    }
""",
"""    if (pricedTradeScrollIsActive()) return true;
""",
1,
'row refresh initial scroll guard')

replace_count(
"""      if (pricedTradeScrollIsActive()) {
        pricedTradeDeferredRow = pendingRow;
        schedulePricedTradeScrollSettle();
        return;
      }
""",
"""      if (pricedTradeScrollIsActive()) return;
""",
1,
'row refresh timer scroll guard')

replace_once(
"""    if (pricedTradeScrollIsActive()) {
      pricedTradeDeferredFullRepaint = true;
      schedulePricedTradeScrollSettle();
      return;
    }
""",
"""    if (pricedTradeScrollIsActive()) return;
""",
'badge pass scroll guard')

pattern = re.compile(
    r"  function pricedTradeRestoreScrollAnchor\(anchor\) \{.*?\n  \}\n\n  function pricedTradeRenderRowBadge",
    re.S,
)
replacement = """  function pricedTradeRestoreScrollAnchor() {
    // Deliberately empty. Mobile Torn/TornPDA owns scroll position and keyboard anchoring.
  }

  function pricedTradeRenderRowBadge"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'scroll restoration removal: expected exactly one match, found {count}')

helper_anchor = """  function capturePricedTradePickerInteraction(event) {
"""
helper = """  function pricedTradeIsQuantityControl(target) {
    if (!(target instanceof Element)) return false;
    const role = String(target.getAttribute?.('role') || '').toLowerCase();
    const type = String(target.getAttribute?.('type') || '').toLowerCase();
    const label = pricedTradeControlLabel(target);
    return ['checkbox', 'radio', 'number'].includes(type)
      || role === 'spinbutton'
      || target.getAttribute?.('contenteditable') === 'true'
      || /\\b(?:qty|quantity|amount)\\b/i.test(label)
      || /(?:qty|quantity|amount)/i.test(String(target.className || ''));
  }

  function capturePricedTradePickerInteraction(event) {
"""
replace_once(helper_anchor, helper, 'quantity control helper')

replace_once(
"""    if (!target || target.closest(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    const picker = pricedTradePickerEvidence();
""",
"""    if (!target || target.closest(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    if (pricedTradeIsQuantityControl(target)) return;
    if (pricedTradeScrollIsActive()) return;
    const picker = pricedTradePickerEvidence();
""",
'picker interaction quantity bypass')

replace_once(
"""    pricedTradePickerObserver = new MutationObserver((mutations) => {
      if (!loadPricedTradeSession()) {
        syncPricedTradePickerObserver();
        return;
      }
      const previousSurface = pricedTradeObservedSurface;
""",
"""    pricedTradePickerObserver = new MutationObserver((mutations) => {
      if (!loadPricedTradeSession()) {
        syncPricedTradePickerObserver();
        return;
      }
      if (pricedTradeScrollIsActive()) return;
      const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
      if (pricedTradeIsQuantityControl(activeElement)) return;
      const previousSurface = pricedTradeObservedSurface;
""",
'observer interaction guard')

replace_once(
"""    pricedTradePickerObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
""",
"""    pricedTradePickerObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
""",
'observer character-data removal')

replace_once(
"""    const role = String(target.getAttribute?.('role') || '').toLowerCase();
    const type = String(target.getAttribute?.('type') || '').toLowerCase();
    const label = pricedTradeControlLabel(target);
    const quantityControl = ['checkbox', 'radio', 'number'].includes(type)
      || role === 'spinbutton'
      || target.getAttribute?.('contenteditable') === 'true'
      || /\\b(?:qty|quantity|amount)\\b/i.test(label)
      || /(?:qty|quantity|amount)/i.test(String(target.className || ''));
    if (!quantityControl) return false;
""",
"""    if (!pricedTradeIsQuantityControl(target)) return false;
""",
'quantity event helper use')

replace_once(
"""    pricedTradeLastInteractedRow = row;
    return schedulePricedTradeRowRefresh(row, delay);
  }
""",
"""    pricedTradeLastInteractedRow = row;
    if (event.type === 'input') return true;
    return schedulePricedTradeRowRefresh(row, delay);
  }
""",
'keystroke repaint suppression')

replace_once(
"""    document.addEventListener('click', capturePricedTradePickerInteraction, true);
    document.addEventListener('change', capturePricedTradePickerInteraction, true);
    document.addEventListener('input', capturePricedTradePickerInteraction, true);
""",
"""    document.addEventListener('click', capturePricedTradePickerInteraction, true);
    document.addEventListener('change', capturePricedTradePickerInteraction, true);
    document.addEventListener('scroll', capturePricedTradeScroll, { capture: true, passive: true });
    document.addEventListener('touchmove', capturePricedTradeScroll, { capture: true, passive: true });
    document.addEventListener('wheel', capturePricedTradeScroll, { capture: true, passive: true });
""",
'event binding lockdown')

PATH.write_text(text, encoding='utf-8')
print('Patched GOBLIN GOD v0.19.6 trade interaction lockdown.')
