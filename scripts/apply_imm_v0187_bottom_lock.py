from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '// @version      0.18.6' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.18.6 as patch base')

text = text.replace('0.18.6', '0.18.7')
text = text.replace(
    'scroll-stable in-place quantity-reactive',
    'bottom-locked scroll-stable in-place quantity-reactive',
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
    const scrollRoot = document.scrollingElement || document.documentElement;
    const scrollTop = Math.max(0, Number(scrollRoot?.scrollTop ?? window.scrollY) || 0);
    const viewportHeight = Math.max(0, Number(scrollRoot?.clientHeight ?? window.innerHeight) || 0);
    const scrollHeight = Math.max(0, Number(scrollRoot?.scrollHeight) || 0);
    const bottomDistance = Math.max(0, scrollHeight - scrollTop - viewportHeight);
    if (bottomDistance <= 96) {
      return { mode: 'bottom', bottomDistance };
    }

    const activeRow = document.activeElement instanceof Element
      ? document.activeElement.closest(`.${PRICED_TRADE_ROW_CLASS}`)
      : null;
    const rows = surface instanceof Element
      ? [...surface.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`)]
      : [];
    const row = activeRow?.isConnected
      ? activeRow
      : rows.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight;
        });
    if (!(row instanceof Element) || !row.isConnected) return null;
    return { mode: 'row', row, top: row.getBoundingClientRect().top };
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
    if (!anchor.row?.isConnected) return;
    const delta = anchor.row.getBoundingClientRect().top - Number(anchor.top || 0);
    if (Number.isFinite(delta) && Math.abs(delta) > 0.5) window.scrollBy(0, delta);
  }
'''
text = replace_function(text, 'pricedTradeRestoreScrollAnchor', restore_replacement)

required = [
    '// @version      0.18.7',
    "return { mode: 'bottom', bottomDistance }",
    "return { mode: 'row', row, top: row.getBoundingClientRect().top }",
    "if (anchor.mode === 'bottom')",
    'scrollHeight - viewportHeight - Math.max(0, Number(anchor.bottomDistance)',
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
print('Applied GOBLIN GOD v0.18.7 bottom-lock scroll patch')
