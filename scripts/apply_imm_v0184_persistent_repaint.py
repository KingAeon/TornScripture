from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '// @version      0.18.3' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.18.3 as patch base')

text = text.replace('0.18.3', '0.18.4')
text = text.replace('auto-repainting decision-first', 'persistent auto-repainting decision-first')


def replace_function(source: str, name: str, replacement: str) -> str:
    marker = f'  function {name}('
    start = source.find(marker)
    if start < 0:
        raise SystemExit(f'Function not found: {name}')
    end = source.find('\n  function ', start + len(marker))
    if end < 0:
        raise SystemExit(f'Could not find end of function: {name}')
    return source[:start] + replacement.rstrip() + '\n' + source[end:]

sync_replacement = r'''
  function pricedTradeMutationTouchesPicker(mutation, currentSurface = null, previousSurface = null) {
    const target = pricedTradeMutationElement(mutation.target);
    const surfaces = [currentSurface, previousSurface]
      .filter((surface) => surface instanceof Element);
    const touchesSurface = (element) => Boolean(element && surfaces.some((surface) =>
      element === surface || surface.contains(element) || element.contains?.(surface)
    ));
    if (touchesSurface(target)) return true;
    const changedNodes = [
      ...(mutation.addedNodes || []),
      ...(mutation.removedNodes || []),
    ];
    return changedNodes.some((node) => {
      if (pricedTradeGeneratedMutationNode(node)) return false;
      const element = pricedTradeMutationElement(node);
      if (touchesSurface(element)) return true;
      const text = normalizeWhitespace(node?.textContent);
      return /\bqty\b|\bwhich items would you like to add to trade\b|\byou are adding\s+[\d,]+\s+items?\b|\badd\s+to\s+trade\b|\bx\s*[\d,]+\b/i.test(text)
        || Boolean(element?.matches?.('img,input[type="checkbox"],input[type="radio"],[class*="item" i],[class*="category" i]'))
        || Boolean(element?.querySelector?.('img,input[type="checkbox"],input[type="radio"]'));
    });
  }

  function syncPricedTradePickerObserver() {
    const session = loadPricedTradeSession();
    if (!session || !document.body) {
      pricedTradePickerObserver?.disconnect();
      pricedTradePickerObserver = null;
      pricedTradeObservedSurface = null;
      return;
    }

    const currentSurface = pricedTradeInventorySurface();
    if (currentSurface instanceof Element) pricedTradeObservedSurface = currentSurface;
    if (pricedTradePickerObserver) return;

    pricedTradePickerObserver = new MutationObserver((mutations) => {
      if (!loadPricedTradeSession()) {
        syncPricedTradePickerObserver();
        return;
      }
      const previousSurface = pricedTradeObservedSurface;
      const resolvedSurface = pricedTradeInventorySurface();
      const nextSurface = resolvedSurface instanceof Element ? resolvedSurface : null;
      if (nextSurface && nextSurface !== previousSurface) {
        pricedTradeObservedSurface = nextSurface;
        schedulePricedTradePickerRepaint(45);
        return;
      }
      if (mutations.some((mutation) =>
        pricedTradeMutationNeedsRepaint(mutation)
        && pricedTradeMutationTouchesPicker(mutation, nextSurface, previousSurface)
      )) {
        schedulePricedTradePickerRepaint(70);
      }
    });
    pricedTradePickerObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
'''
text = replace_function(text, 'syncPricedTradePickerObserver', sync_replacement)

capture_replacement = r'''
  function capturePricedTradePickerInteraction(event) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    const picker = pricedTradePickerEvidence();
    const previousSurface = pricedTradeObservedSurface;
    const insidePrevious = previousSurface instanceof Element
      && previousSurface.isConnected
      && previousSurface.contains(target);
    if (!picker.active && !insidePrevious) return;
    schedulePricedTradePickerRepaint(80);
  }
'''
text = replace_function(text, 'capturePricedTradePickerInteraction', capture_replacement)

old_clear = """  function clearPricedTradeSession(message = '') {\n    savePricedTradeSession(null);\n    clearPricedTradeAnnotations();\n    if (message) toast(message);\n  }"""
new_clear = """  function clearPricedTradeSession(message = '') {\n    savePricedTradeSession(null);\n    clearTimeout(pricedTradeRepaintSettleTimer);\n    pricedTradeRepaintSettleTimer = null;\n    clearPricedTradeAnnotations();\n    syncPricedTradePickerObserver();\n    if (message) toast(message);\n  }"""
if old_clear not in text:
    raise SystemExit('Could not patch Priced Trade session cleanup')
text = text.replace(old_clear, new_clear, 1)

listener = "document.addEventListener('click', capturePricedTradePickerInteraction, true);"
if listener not in text:
    anchor = "document.addEventListener('click', capturePurchaseIntentFromClick, true);"
    if anchor not in text:
        raise SystemExit('Could not locate click listener anchor')
    text = text.replace(anchor, anchor + '\n    ' + listener, 1)

required = [
    "// @version      0.18.4",
    "pricedTradePickerObserver.observe(document.body",
    "pricedTradeMutationTouchesPicker",
    "capturePricedTradePickerInteraction",
    "syncPricedTradePickerObserver();",
    "quickMaxOverrideArmed",
    "buildTradeExitAudit",
    "pricedTradeBestTraderQuote",
    "inventoryBaseline",
    "sellPriority",
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit(f'Missing required tokens after patch: {missing}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.4 persistent picker repaint patch')
