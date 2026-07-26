from pathlib import Path
import re

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '@version      0.17.4' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.17.4 as patch base')

text = text.replace('0.17.4', '0.17.5')
text = text.replace('TornPDA Qty-row payout badges', 'direct TornPDA Qty-row payout badges')


def replace_function_block(source, start_name, next_name, replacement):
    pattern = rf"  function {re.escape(start_name)}\b.*?(?=  function {re.escape(next_name)}\b)"
    updated, count = re.subn(pattern, replacement.rstrip() + '\n\n', source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Could not replace {start_name} block; matches={count}')
    return updated


controls_block = r'''  function pricedTradeDirectQtyElements(root = document) {
    const scope = root instanceof Document
      ? (root.body || root.documentElement)
      : root instanceof Element ? root : null;
    if (!scope) return [];
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const results = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!/^qty$/i.test(normalizeWhitespace(node.nodeValue))) continue;
      const element = node.parentElement;
      if (!element || !visibleElement(element) || element.closest(ignored)) continue;
      results.add(element);
    }
    for (const element of scope.querySelectorAll('[class*="qty" i],[aria-label*="qty" i],[title*="qty" i]')) {
      if (!visibleElement(element) || element.closest(ignored)) continue;
      const label = pricedTradeControlLabel(element);
      if (/\bqty\b/i.test(label) && label.length <= 80) results.add(element);
    }
    return [...results];
  }

  function pricedTradeControlElements(root = document) {
    if (!(root instanceof Document || root instanceof Element)) return [];
    const controls = [...root.querySelectorAll('button,a,[role="button"],input,select,label')];
    controls.push(...pricedTradeDirectQtyElements(root));
    return [...new Set(controls)];
  }'''
text = replace_function_block(text, 'pricedTradeControlElements', 'pricedTradeNativeAddControl', controls_block)

candidate_block = r'''  function pricedTradeRowForControl(control, trader) {
    if (!(control instanceof Element) || !trader) return null;
    let fallback = null;
    let node = control;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element) || node === document.body) continue;
      if (node.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) continue;
      if (node.classList.contains(APP.tradeItemMark) || node.closest(`.${APP.tradeItemMark}`)) break;
      const text = normalizeWhitespace(node.innerText || node.textContent);
      if (!text || text.length > 420) continue;
      const item = pricedTradeItemForRow(node, trader);
      if (!item || !pricedTradeNativeAddControl(node)) continue;
      const qtyCount = pricedTradeDirectQtyElements(node).length;
      const singleCount = [...node.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
        .filter((input) => visibleElement(input) && !input.disabled).length;
      if (qtyCount + singleCount !== 1) continue;
      fallback = node;
      if (text.length <= 240) return node;
    }
    return fallback;
  }

  function pricedTradeCandidateRows(trader) {
    const rows = new Set();
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const qtyControls = pricedTradeDirectQtyElements(document);
    const singleControls = [...document.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .filter((control) => visibleElement(control) && !control.disabled && !control.closest(ignored));
    for (const control of [...qtyControls, ...singleControls]) {
      const row = pricedTradeRowForControl(control, trader);
      if (row) rows.add(row);
    }
    return [...rows];
  }'''
text = replace_function_block(text, 'pricedTradeCandidateRows', 'pricedTradePickerEvidence', candidate_block)

picker_block = r'''  function pricedTradePickerEvidence() {
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const bodyText = normalizeWhitespace(document.body?.innerText || document.body?.textContent || '');
    const headingPattern = /\bwhich items would you like to add to trade\??\b/i;
    const summaryPattern = /\byou are adding\s+[\d,]+\s+items?\s+across\s+[\d,]+\s+categor(?:y|ies)\b/i;
    const hasPickerText = headingPattern.test(bodyText) || summaryPattern.test(bodyText);
    const hasAddText = /\badd\s+to\s+trade\b/i.test(bodyText);
    const qtyControls = pricedTradeDirectQtyElements(document)
      .filter((control) => !control.closest(ignored));
    const singleControls = [...document.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .filter((control) => visibleElement(control) && !control.disabled && !control.closest(ignored));
    const itemControls = [...new Set([...qtyControls, ...singleControls])];
    const active = Boolean(hasPickerText && hasAddText && itemControls.length);
    let surface = null;
    if (active) {
      const anchors = [...document.querySelectorAll('h1,h2,h3,h4,strong,b,p,span,div')]
        .filter((element) => visibleElement(element) && !element.closest(ignored))
        .filter((element) => {
          const direct = normalizeWhitespace(ownText(element));
          return headingPattern.test(direct) || summaryPattern.test(direct);
        });
      for (const anchor of anchors) {
        let node = anchor;
        for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
          if (!(node instanceof Element) || node === document.body) continue;
          const text = normalizeWhitespace(node.innerText || node.textContent);
          if (!text || text.length > 30000 || !/\badd\s+to\s+trade\b/i.test(text)) continue;
          if (!itemControls.some((control) => node.contains(control))) continue;
          surface = node;
          break;
        }
        if (surface) break;
      }
    }
    return { active, surface, addControl: null, itemControls };
  }'''
text = replace_function_block(text, 'pricedTradePickerEvidence', 'pricedTradeInventorySurface', picker_block)

required = [
    '@version      0.17.5',
    "version: '0.17.5'",
    'function pricedTradeDirectQtyElements(root = document)',
    'function pricedTradeRowForControl(control, trader)',
    'const active = Boolean(hasPickerText && hasAddText && itemControls.length)',
    'quickMaxOverrideArmed',
    'Outside an explicitly armed Override MAX action',
    'buildTradeExitAudit',
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'Missing protected or new marker: {needle}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.17.5 direct Qty text-node hotfix')
