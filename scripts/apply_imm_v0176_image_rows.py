from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '@version      0.17.5' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.17.5 as patch base')

text = text.replace('0.17.5', '0.17.6')
text = text.replace('direct TornPDA Qty-row payout badges', 'TornPDA image-row payout badges')


def replace_function_span(source, start_name, next_name, replacement):
    start_marker = f'  function {start_name}'
    next_marker = f'  function {next_name}'
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f'Could not find start function {start_name}')
    end = source.find(next_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f'Could not find next function {next_name}')
    return source[:start] + replacement.rstrip() + '\n\n' + source[end:]


candidate_block = r'''  function pricedTradeRowForItemImage(image, trader) {
    if (!(image instanceof Element) || !trader) return null;
    let best = null;
    let node = image;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element) || node === document.body) continue;
      if (node.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) continue;
      if (node.classList.contains(APP.tradeItemMark) || node.closest(`.${APP.tradeItemMark}`)) break;
      const text = normalizeWhitespace(node.innerText || node.textContent);
      if (!text || text.length > 420) continue;
      if (/\b(?:which items would you like to add to trade|add to trade|clear all)\b/i.test(text)) continue;
      const item = pricedTradeItemForRow(node, trader);
      if (!item) continue;
      const itemImages = [...node.querySelectorAll('img')]
        .filter((candidate) => visibleElement(candidate)
          && !candidate.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`));
      if (itemImages.length !== 1) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 18 || rect.height > 190) continue;
      best = node;
      if (text.length <= 220) return node;
    }
    return best;
  }

  function pricedTradeCandidateRows(trader) {
    const rows = new Set();
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const surface = pricedTradeInventorySurface() || document;
    for (const image of surface.querySelectorAll('img')) {
      if (!visibleElement(image) || image.closest(ignored)) continue;
      const row = pricedTradeRowForItemImage(image, trader);
      if (row) rows.add(row);
    }
    const singleControls = [...surface.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .filter((control) => visibleElement(control) && !control.disabled && !control.closest(ignored));
    for (const control of singleControls) {
      const row = pricedTradeRowForControl(control, trader);
      if (row) rows.add(row);
    }
    return [...rows];
  }'''
text = replace_function_span(text, 'pricedTradeCandidateRows', 'pricedTradePickerEvidence', candidate_block)

old_active = 'const active = Boolean(hasPickerText && hasAddText && itemControls.length);'
new_active = 'const active = Boolean(hasPickerText && hasAddText);'
if old_active not in text:
    raise SystemExit('Could not find picker active condition')
text = text.replace(old_active, new_active, 1)

old_single = '''    const singleControl = [...row.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .find((control) => visibleElement(control) && !control.disabled);
    if (singleControl) return 1;
    return null;'''
new_single = '''    const singleControl = [...row.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .find((control) => visibleElement(control) && !control.disabled);
    if (singleControl) return 1;
    if ([...row.querySelectorAll('img')].some((image) => visibleElement(image))) return 1;
    return null;'''
if old_single not in text:
    raise SystemExit('Could not find quantity fallback block')
text = text.replace(old_single, new_single, 1)

required = [
    '@version      0.17.6',
    "version: '0.17.6'",
    'function pricedTradeRowForItemImage(image, trader)',
    "const surface = pricedTradeInventorySurface() || document;",
    'const active = Boolean(hasPickerText && hasAddText);',
    "if ([...row.querySelectorAll('img')].some((image) => visibleElement(image))) return 1;",
    'quickMaxOverrideArmed',
    'Outside an explicitly armed Override MAX action',
    'buildTradeExitAudit',
    'sellPriority',
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'Missing protected or new marker: {needle}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.17.6 TornPDA image-row hotfix')
