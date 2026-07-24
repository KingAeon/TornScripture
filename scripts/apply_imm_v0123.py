from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text

if '// @version      0.12.2' not in text:
    raise SystemExit('Expected IMM v0.12.2 header was not found')
if '@require' in text:
    raise SystemExit('Refusing to patch a wrapper userscript')

old_finder = """  function findListingRow(priceElement) {
    let node = priceElement;
    let best = null;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length > 220) continue;
      const prices = countMatches(text, /\\$[\\d,.]+/g);
      if (prices !== 1) continue;
      const integerCells = [...node.querySelectorAll('span,div,p,strong,b')]
        .map((element) => ownText(element))
        .filter((value) => /^\\d[\\d,]*$/.test(value));
      if (!integerCells.length) continue;
      best = node;
      const parentText = normalizeWhitespace(node.parentElement?.innerText);
      if (countMatches(parentText, /\\$[\\d,.]+/g) > 1) break;
    }
    return best;
  }
"""

new_finder = """  function listingRowHasPurchaseControl(row) {
    return Boolean(row instanceof Element && quickMaxBuyControl(row));
  }

  function findListingRow(priceElement) {
    let node = priceElement;
    let best = null;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const text = normalizeWhitespace(node.innerText);
      if (!text || text.length > 220) continue;
      const prices = countMatches(text, /\\$[\\d,.]+/g);
      if (prices !== 1) continue;
      const integerCells = [...node.querySelectorAll('span,div,p,strong,b')]
        .map((element) => ownText(element))
        .filter((value) => /^\\d[\\d,]*$/.test(value));
      if (!integerCells.length) continue;
      if (!listingRowHasPurchaseControl(node)) continue;
      best = node;
      const parentText = normalizeWhitespace(node.parentElement?.innerText);
      if (countMatches(parentText, /\\$[\\d,.]+/g) > 1) break;
    }
    return best;
  }
"""

if text.count(old_finder) != 1:
    raise SystemExit(f'findListingRow anchor count: {text.count(old_finder)}')
text = text.replace(old_finder, new_finder, 1)

old_candidate = """    for (const priceElement of priceElements) {
      const row = priceElement.closest(`.${APP.listingMark}`) || findListingRow(priceElement);
      if (!row || seen.has(row)) continue;
"""
new_candidate = """    for (const priceElement of priceElements) {
      const markedRow = priceElement.closest(`.${APP.listingMark}`);
      const markedRowValid = Boolean(markedRow && listingRowHasPurchaseControl(markedRow));
      if (markedRow && !markedRowValid) {
        directMarginBadge(priceElement, 'listing')?.remove();
        clearTierMark(markedRow, APP.listingMark);
      }
      const row = markedRowValid ? markedRow : findListingRow(priceElement);
      if (!row || seen.has(row)) continue;
"""

if text.count(old_candidate) != 1:
    raise SystemExit(f'listingCandidates anchor count: {text.count(old_candidate)}')
text = text.replace(old_candidate, new_candidate, 1)

text = text.replace('0.12.2', '0.12.3')

required = (
    '// @version      0.12.3',
    "version: '0.12.3'",
    'function listingRowHasPurchaseControl(row)',
    'if (!listingRowHasPurchaseControl(node)) continue;',
    'const markedRowValid = Boolean(markedRow && listingRowHasPurchaseControl(markedRow));',
    "directMarginBadge(priceElement, 'listing')?.remove();",
    'clearTierMark(markedRow, APP.listingMark);',
    'function quickMaxBuyControl(row)',
    "brandName: 'GOBLIN GOD'",
)
for token in required:
    if token not in text:
        raise SystemExit(f'Missing required release token: {token}')

if text.count('function listingRowHasPurchaseControl(row)') != 1:
    raise SystemExit('Purchase-control listing guard was inserted more than once')
if text.count('function quickMaxBuyControl(row)') != original.count('function quickMaxBuyControl(row)'):
    raise SystemExit('Protected Quick MAX helper count changed')
if '@require' in text:
    raise SystemExit('Release became a wrapper unexpectedly')
if len(text) <= len(original):
    raise SystemExit('Expected a focused source expansion')

path.write_text(text, encoding='utf-8')
