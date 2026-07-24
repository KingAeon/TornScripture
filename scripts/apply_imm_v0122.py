from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text

if '// @version      0.12.1' not in text:
    raise SystemExit('Expected IMM v0.12.1 header was not found')
if '@require' in text:
    raise SystemExit('Refusing to patch a wrapper userscript')

anchor = """  function decorateMarket() {
    cleanupMarket();
"""
replacement = """  function validWatchListingRow(row) {
    if (!(row instanceof Element) || !row.isConnected || !visible(row)) return false;
    if (row.closest(`#${A.deals},#${A.dock},#${A.panel},[data-tsimm-generated],header,nav`)) return false;
    const quickMax = row.querySelector('[data-tsimm-quick-max]');
    const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing');
    if (!quickMax || !badge) return false;
    const quantity = Math.floor(Number(badge.dataset.tsimmQuantity) || 0);
    if (quantity <= 0) return false;
    const price = listingPrice(row);
    return Number.isFinite(price) && price > 0;
  }

  function decorateMarket() {
    cleanupMarket();
"""

if anchor not in text:
    raise SystemExit('decorateMarket anchor was not found')
text = text.replace(anchor, replacement, 1)

old_rows = "    const rows = [...document.querySelectorAll('.tsimm-listing-mark')];"
new_rows = "    const rows = [...document.querySelectorAll('.tsimm-listing-mark')].filter(validWatchListingRow);"
if old_rows not in text:
    raise SystemExit('Watched listing row selector was not found')
text = text.replace(old_rows, new_rows, 1)

text = text.replace('0.12.1', '0.12.2')

required = (
    '// @version      0.12.2',
    "version: '0.12.2'",
    'function validWatchListingRow(row)',
    "row.querySelector('[data-tsimm-quick-max]')",
    "row.querySelector('.tsimm-margin-badge.tsimm-badge-listing')",
    '.filter(validWatchListingRow)',
)
for token in required:
    if token not in text:
        raise SystemExit(f'Missing required release token: {token}')

if text.count('function validWatchListingRow(row)') != 1:
    raise SystemExit('Containment guard was inserted more than once')
if text.count("const rows = [...document.querySelectorAll('.tsimm-listing-mark')].filter(validWatchListingRow);") != 1:
    raise SystemExit('Unexpected watched listing selector count')
if '@require' in text:
    raise SystemExit('Release became a wrapper unexpectedly')
if len(text) <= len(original):
    raise SystemExit('Expected a focused source expansion')

path.write_text(text, encoding='utf-8')
