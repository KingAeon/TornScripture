from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    text = text.replace(old, new, 1)


version_count = text.count('0.17.3')
if version_count < 4:
    raise SystemExit(f'version markers: expected at least 4 matches, found {version_count}')
text = text.replace('0.17.3', '0.17.4')

replace_once(
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, resilient pre-trade picker payout badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, TornPDA Qty-row payout badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    'metadata description',
)

helper = r'''
  function pricedTradeControlElements(root = document) {
    if (!(root instanceof Document || root instanceof Element)) return [];
    const controls = [...root.querySelectorAll('button,a,[role="button"],input,select,label,[class*="qty" i]')];
    for (const element of root.querySelectorAll('div,span')) {
      if (!visibleElement(element)) continue;
      const direct = normalizeWhitespace(ownText(element));
      if (!/^qty$/i.test(direct)) continue;
      controls.push(element);
    }
    return [...new Set(controls)];
  }

'''
replace_once(
    '  function pricedTradeNativeAddControl(row) {\n',
    helper + '  function pricedTradeNativeAddControl(row) {\n',
    'generic Qty control helper',
)

replace_once(
    "    const controls = [...row.querySelectorAll('button,a,[role=\"button\"],input,select,label')]\n      .filter((control) =>\n        visibleElement(control)\n        && !control.disabled\n        && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},[data-tsimm-generated]`)\n      );",
    "    const controls = pricedTradeControlElements(row)\n      .filter((control) =>\n        visibleElement(control)\n        && !control.disabled\n        && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},[data-tsimm-generated]`)\n      );",
    'native control collection',
)

replace_once(
    "      if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(String(control.type || '').toLowerCase())) return true;\n      return /\\b(?:add|select|choose|include|qty|quantity)\\b/i.test(label)",
    "      if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(String(control.type || '').toLowerCase())) return true;\n      if (/^qty$/i.test(normalizeWhitespace(ownText(control) || control.textContent))) return true;\n      return /\\b(?:add|select|choose|include|qty|quantity)\\b/i.test(label)",
    'exact generic Qty recognition',
)

replace_once(
    "    return null;\n  }\n\n  function pricedTradeCandidateRows(trader) {",
    "    const singleControl = [...row.querySelectorAll('input[type=\"checkbox\"],input[type=\"radio\"]')]\n      .find((control) => visibleElement(control) && !control.disabled);\n    if (singleControl) return 1;\n    return null;\n  }\n\n  function pricedTradeCandidateRows(trader) {",
    'single equipment quantity fallback',
)

replace_once(
    "    const controls = [...document.querySelectorAll('button,a,[role=\"button\"],input,select,label')]\n      .filter((control) =>\n        visibleElement(control)\n        && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)\n      );",
    "    const controls = pricedTradeControlElements(document)\n      .filter((control) =>\n        visibleElement(control)\n        && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)\n      );",
    'candidate generic control collection',
)

replace_once(
    "    const controls = [...document.querySelectorAll('button,a,[role=\"button\"],input,label')]\n      .filter((control) => visibleElement(control) && !control.closest(ignored));",
    "    const controls = pricedTradeControlElements(document)\n      .filter((control) => visibleElement(control) && !control.closest(ignored));",
    'picker evidence generic control collection',
)

path.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.17.4 TornPDA generic Qty-row and single-equipment quantity hotfix.')
