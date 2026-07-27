from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '// @version      0.18.7' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.18.7 as patch base')

text = text.replace('0.18.7', '0.18.8')
text = text.replace(
    'bottom-locked scroll-stable in-place quantity-reactive',
    'focus-anchored fixed-height in-place quantity-reactive',
)


def replace_function(source: str, name: str, replacement: str) -> str:
    marker = f'  function {name}('
    start = source.find(marker)
    if start < 0:
        raise SystemExit(f'Function not found: {name}')
    end = source.find('\n  function ', start + len(marker))
    if end < 0:
        raise SystemExit(f'Could not find end of function: {name}')
    return source[:start] + replacement.rstrip() + '\n' + source[end:]


capture_replacement = r'''
  function pricedTradeCaptureScrollAnchor(surface = pricedTradeInventorySurface()) {
    const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
    const activeRow = activeElement?.closest(`.${PRICED_TRADE_ROW_CLASS}`) || null;
    if (activeRow?.isConnected && (!(surface instanceof Element) || surface.contains(activeRow))) {
      return { mode: 'row', row: activeRow, top: activeRow.getBoundingClientRect().top };
    }

    const scrollRoot = document.scrollingElement || document.documentElement;
    const scrollTop = Math.max(0, Number(scrollRoot?.scrollTop ?? window.scrollY) || 0);
    const viewportHeight = Math.max(0, Number(scrollRoot?.clientHeight ?? window.innerHeight) || 0);
    const scrollHeight = Math.max(0, Number(scrollRoot?.scrollHeight) || 0);
    const bottomDistance = Math.max(0, scrollHeight - scrollTop - viewportHeight);
    if (bottomDistance <= 96) {
      return { mode: 'bottom', bottomDistance };
    }

    return null;
  }
'''
text = replace_function(text, 'pricedTradeCaptureScrollAnchor', capture_replacement)

restore_replacement = r'''
  function pricedTradeRestoreScrollAnchor(anchor) {
    if (!anchor) return;
    if (anchor.mode === 'bottom') {
      const scrollRoot = document.scrollingElement || document.documentElement;
      if (!scrollRoot) return;
      const viewportHeight = Math.max(0, Number(scrollRoot.clientHeight ?? window.innerHeight) || 0);
      const scrollHeight = Math.max(0, Number(scrollRoot.scrollHeight) || 0);
      const targetTop = Math.max(0, scrollHeight - viewportHeight - Math.max(0, Number(anchor.bottomDistance) || 0));
      if (Math.abs(Number(scrollRoot.scrollTop) - targetTop) > 0.5) scrollRoot.scrollTop = targetTop;
      return;
    }
    if (anchor.mode !== 'row' || !anchor.row?.isConnected) return;
    const activeRow = document.activeElement instanceof Element
      ? document.activeElement.closest(`.${PRICED_TRADE_ROW_CLASS}`)
      : null;
    if (activeRow !== anchor.row) return;
    const delta = anchor.row.getBoundingClientRect().top - Number(anchor.top || 0);
    if (Number.isFinite(delta) && Math.abs(delta) > 0.5) window.scrollBy(0, delta);
  }
'''
text = replace_function(text, 'pricedTradeRestoreScrollAnchor', restore_replacement)

old_row_css = ".${PRICED_TRADE_ROW_CLASS}{position:relative!important;box-shadow:inset 3px 0 #47c968!important}"
new_row_css = ".${PRICED_TRADE_ROW_CLASS}{position:relative!important;overflow-anchor:none!important;box-shadow:inset 3px 0 #47c968!important}"
if old_row_css not in text:
    raise SystemExit('Expected Priced Trade row CSS was not found')
text = text.replace(old_row_css, new_row_css, 1)

old_badge_css = ".${PRICED_TRADE_BADGE_CLASS}{display:grid!important;gap:1px!important;width:min(210px,48vw)!important;max-width:min(210px,48vw)!important;min-height:52px!important;align-content:start!important;margin:3px 4px!important;padding:4px 6px!important;border:1px solid #47c968!important;border-radius:5px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:none!important;box-sizing:border-box!important}"
new_badge_css = ".${PRICED_TRADE_BADGE_CLASS}{display:grid!important;gap:1px!important;width:min(210px,48vw)!important;max-width:min(210px,48vw)!important;height:62px!important;min-height:62px!important;overflow:hidden!important;overflow-anchor:none!important;align-content:start!important;margin:3px 4px!important;padding:4px 6px!important;border:1px solid #47c968!important;border-radius:5px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:none!important;box-sizing:border-box!important}"
if old_badge_css not in text:
    raise SystemExit('Expected Priced Trade badge CSS was not found')
text = text.replace(old_badge_css, new_badge_css, 1)

required = [
    '// @version      0.18.8',
    "if (activeRow?.isConnected",
    "return { mode: 'row', row: activeRow",
    "if (anchor.mode !== 'row'",
    'if (activeRow !== anchor.row) return;',
    'height:62px!important',
    'overflow-anchor:none!important',
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
print('Applied GOBLIN GOD v0.18.8 interaction-stability patch')
