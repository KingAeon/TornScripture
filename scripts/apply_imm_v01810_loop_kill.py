from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '// @version      0.18.9' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.18.9 as patch base')

text = text.replace('0.18.9', '0.18.10')
text = text.replace(
    'scroll-quiet focus-anchored fixed-height in-place quantity-reactive',
    'loop-safe focus-anchored fixed-height in-place quantity-reactive',
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


text = replace_function(text, 'pricedTradeScrollIsActive', r'''
  function pricedTradeScrollIsActive() {
    return false;
  }
''')

text = replace_function(text, 'capturePricedTradeScroll', r'''
  function capturePricedTradeScroll() {
    // v0.18.10 emergency guard: scrolling must never schedule a Priced Trade repaint.
  }
''')

text = replace_function(text, 'schedulePricedTradePickerRepaint', r'''
  function schedulePricedTradePickerRepaint(delay = 140) {
    if (!loadPricedTradeSession()) return;
    clearTimeout(pricedTradeRepaintSettleTimer);
    pricedTradeRepaintSettleTimer = null;
    scheduleScan(Math.max(100, Number(delay) || 0));
  }
''')

text = text.replace(
    "    document.addEventListener('scroll', capturePricedTradeScroll, { capture: true, passive: true });\n",
    '',
)

required = [
    '// @version      0.18.10',
    'function pricedTradeScrollIsActive()',
    'return false;',
    'scrolling must never schedule a Priced Trade repaint',
    'function schedulePricedTradePickerRepaint(delay = 140)',
    'scheduleScan(Math.max(100, Number(delay) || 0));',
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

for forbidden in [
    "document.addEventListener('scroll', capturePricedTradeScroll",
    'pricedTradeScrollActiveUntil = Date.now() + PRICED_TRADE_SCROLL_QUIET_MS;',
]:
    if forbidden in text:
        raise SystemExit(f'Forbidden loop trigger remains: {forbidden}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.10 loop-kill patch')
