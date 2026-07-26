from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')

if '// @version      0.18.2' not in text:
    raise SystemExit('Expected v0.18.2 source')
text = text.replace('0.18.2', '0.18.3')
text = text.replace(
    'decision-first ledger and best-trader trade badges',
    'auto-repainting decision-first ledger and best-trader trade badges',
)

anchor = "  const PRICED_TRADE_TTL_MS = 12 * 60 * 60 * 1000;\n"
addition = anchor + "  let pricedTradePickerObserver = null;\n  let pricedTradeObservedSurface = null;\n  let pricedTradeRepaintSettleTimer = null;\n"
if anchor not in text:
    raise SystemExit('Priced Trade constants anchor missing')
text = text.replace(anchor, addition, 1)

verification_anchor = "  function pricedTradeVerification(stats) {\n"
helpers = r'''  function pricedTradeMutationElement(node) {
    if (node?.nodeType === Node.TEXT_NODE) return node.parentElement;
    return node instanceof Element ? node : null;
  }

  function pricedTradeGeneratedMutationNode(node) {
    const element = pricedTradeMutationElement(node);
    return Boolean(element?.matches?.(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)
      || element?.closest?.(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`));
  }

  function pricedTradeMutationNeedsRepaint(mutation) {
    if (mutation.type === 'characterData') {
      return !pricedTradeGeneratedMutationNode(mutation.target)
        && Boolean(normalizeWhitespace(mutation.target?.textContent));
    }
    const changedNodes = [
      ...(mutation.addedNodes || []),
      ...(mutation.removedNodes || []),
    ];
    return changedNodes.some((node) => !pricedTradeGeneratedMutationNode(node));
  }

  function schedulePricedTradePickerRepaint(delay = 90) {
    if (!loadPricedTradeSession()) return;
    scheduleScan(delay);
    clearTimeout(pricedTradeRepaintSettleTimer);
    pricedTradeRepaintSettleTimer = setTimeout(() => {
      pricedTradeRepaintSettleTimer = null;
      if (loadPricedTradeSession()) scheduleScan(0);
    }, 780);
  }

  function syncPricedTradePickerObserver() {
    const surface = loadPricedTradeSession() ? pricedTradeInventorySurface() : null;
    if (surface === pricedTradeObservedSurface && pricedTradePickerObserver) return;
    pricedTradePickerObserver?.disconnect();
    pricedTradePickerObserver = null;
    pricedTradeObservedSurface = surface instanceof Element ? surface : null;
    if (!pricedTradeObservedSurface) return;
    pricedTradePickerObserver = new MutationObserver((mutations) => {
      if (mutations.some(pricedTradeMutationNeedsRepaint)) schedulePricedTradePickerRepaint(70);
    });
    pricedTradePickerObserver.observe(pricedTradeObservedSurface, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function capturePricedTradePickerInteraction(event) {
    if (!loadPricedTradeSession()) return;
    const target = event.target instanceof Element ? event.target : null;
    const surface = pricedTradeInventorySurface();
    if (!target || !surface || !surface.contains(target)) return;
    if (target.closest(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    schedulePricedTradePickerRepaint(80);
  }

'''
if verification_anchor not in text:
    raise SystemExit('Priced Trade verification anchor missing')
text = text.replace(verification_anchor, helpers + verification_anchor, 1)

bind_anchor = "    document.addEventListener('click', capturePurchaseIntentFromClick, true);\n"
if bind_anchor not in text:
    raise SystemExit('Panel click binding anchor missing')
text = text.replace(
    bind_anchor,
    bind_anchor + "    document.addEventListener('click', capturePricedTradePickerInteraction, true);\n",
    1,
)

apply_anchor = "  function applyPricedTradeInventoryBadges(stats) {\n    clearPricedTradeAnnotations();\n"
if apply_anchor not in text:
    raise SystemExit('Priced Trade apply anchor missing')
text = text.replace(
    apply_anchor,
    "  function applyPricedTradeInventoryBadges(stats) {\n    clearPricedTradeAnnotations();\n    syncPricedTradePickerObserver();\n",
    1,
)

end_anchor = "    renderPricedTradePanel(verification, decorated, priced);\n  }\n\n  function currentTradeTrader(stats) {\n"
if end_anchor not in text:
    raise SystemExit('Priced Trade apply ending anchor missing')
text = text.replace(
    end_anchor,
    "    renderPricedTradePanel(verification, decorated, priced);\n    syncPricedTradePickerObserver();\n  }\n\n  function currentTradeTrader(stats) {\n",
    1,
)

required = [
    '// @version      0.18.3',
    'function schedulePricedTradePickerRepaint',
    'function syncPricedTradePickerObserver',
    'function capturePricedTradePickerInteraction',
    "document.addEventListener('click', capturePricedTradePickerInteraction, true)",
    'pricedTradePickerObserver.observe(pricedTradeObservedSurface',
    'syncPricedTradePickerObserver();',
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'Missing required feature marker: {needle}')
if '0.18.2' in text:
    raise SystemExit('Old release version remains')

path.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.3 automatic category repaint')
