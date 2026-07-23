from pathlib import Path
import hashlib
import re

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')

if '// @version      0.10.8' not in text:
    raise SystemExit('Expected IMM v0.10.8 as patch base')
if '@require' in text:
    raise SystemExit('Refusing to patch a wrapper build')
if len(text) < 200_000:
    raise SystemExit('Refusing to patch a truncated userscript')

quick_start = text.index('  function quickMaxInteractiveLabel(')
quick_end = text.index('  function scanListings(', quick_start)
quick_before = hashlib.sha256(text[quick_start:quick_end].encode()).hexdigest()

text = text.replace('0.10.8', '0.10.9')

old_css_1 = """      .tsimm-watch-inline-badge{display:grid!important;gap:1px!important;min-width:0!important;max-width:100%!important;padding:2px 4px!important;overflow:hidden!important;box-sizing:border-box!important}.tsimm-watch-inline-badge strong,.tsimm-watch-inline-badge .tsimm-listing-lot{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:clip!important}.tsimm-watch-inline-badge strong{font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline-badge .tsimm-listing-lot{font:800 7px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline{display:none!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit .tsimm-listing-lot{border-color:#78ef8d!important;background:#073411f5!important;color:#78ef8d!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-even,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even .tsimm-listing-lot{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-loss,.tsimm-watch-inline-badge.tsimm-watch-best-exit-loss strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-loss .tsimm-listing-lot{border-color:#ff626d!important;background:#2c0b0ef5!important;color:#ff7c85!important}.tsimm-watch-format-row{position:relative!important}"""
new_css_1 = """      .tsimm-watch-inline-badge{display:grid!important;gap:1px!important;min-width:0!important;max-width:100%!important;padding:2px 4px!important;overflow:hidden!important;box-sizing:border-box!important}.tsimm-watch-inline-badge strong,.tsimm-watch-inline-badge .tsimm-listing-lot{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:clip!important}.tsimm-watch-inline-badge strong{font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline-badge .tsimm-listing-lot{font:800 7px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline{display:none!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit .tsimm-listing-lot{border-color:#78ef8d!important;background:#073411f5!important;color:#78ef8d!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-even,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even .tsimm-listing-lot,.tsimm-watch-inline-badge.tsimm-watch-floor-badge,.tsimm-watch-inline-badge.tsimm-watch-floor-badge strong,.tsimm-watch-inline-badge.tsimm-watch-floor-badge .tsimm-listing-lot{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}.tsimm-watch-hidden-loss{display:none!important}.tsimm-watch-format-row{position:relative!important}"""
if text.count(old_css_1) != 1:
    raise SystemExit(f'Expected one primary watch CSS anchor, found {text.count(old_css_1)}')
text = text.replace(old_css_1, new_css_1)

old_css_2 = """      .tsimm-watch-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:112px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}.tsimm-watch-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-watch-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-watch-floor-row{box-shadow:inset 0 2px #347c41!important}"""
new_css_2 = """      .tsimm-watch-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:112px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}.tsimm-watch-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-watch-profit.floor{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}.tsimm-watch-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-watch-floor-row{box-shadow:inset 0 2px #52c7ea!important}"""
if text.count(old_css_2) != 1:
    raise SystemExit(f'Expected one floor CSS anchor, found {text.count(old_css_2)}')
text = text.replace(old_css_2, new_css_2)

old_cleanup = """      badge.classList.remove('tsimm-watch-inline-badge', 'tsimm-watch-best-exit', 'tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss');"""
new_cleanup = """      badge.classList.remove('tsimm-watch-inline-badge', 'tsimm-watch-best-exit', 'tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss', 'tsimm-watch-floor-badge', 'tsimm-watch-hidden-loss');"""
if text.count(old_cleanup) != 1:
    raise SystemExit(f'Expected one badge cleanup anchor, found {text.count(old_cleanup)}')
text = text.replace(old_cleanup, new_cleanup)

cleanup_anchor = """    document.querySelectorAll('[data-tsimm-watch-profit]').forEach((element) => element.remove());
    document.querySelectorAll('.tsimm-watch-profitable,.tsimm-watch-floor-row,.tsimm-watch-format-row').forEach((row) => {"""
cleanup_replacement = """    document.querySelectorAll('[data-tsimm-watch-profit]').forEach((element) => element.remove());
    document.querySelectorAll('.tsimm-watch-hidden-loss').forEach((badge) => badge.classList.remove('tsimm-watch-hidden-loss'));
    document.querySelectorAll('.tsimm-watch-profitable,.tsimm-watch-floor-row,.tsimm-watch-format-row').forEach((row) => {"""
if text.count(cleanup_anchor) != 1:
    raise SystemExit(f'Expected one hidden-loss cleanup anchor, found {text.count(cleanup_anchor)}')
text = text.replace(cleanup_anchor, cleanup_replacement)

new_marker = r'''  function addProfitMarker(row, traderProfit, traderName = '', breakEvenPrice = 0, isFloor = false) {
    const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing')
      || row.querySelector('.tsimm-margin-badge');
    const profitEach = Number(traderProfit);
    if (!Number.isFinite(profitEach)) return false;
    const traderLabel = clean(traderName).slice(0, 18) || 'trader';
    const signedCash = (value) => value > 0 ? `+${cash(value)}` : cash(value);

    if (profitEach < 0 && !isFloor) {
      badge?.classList.add('tsimm-watch-hidden-loss');
      row.classList.remove('tsimm-watch-profitable');
      return true;
    }

    if (badge) {
      if (!badge.dataset.tsimmWatchOriginalHtml) badge.dataset.tsimmWatchOriginalHtml = badge.innerHTML;
      const quantity = Math.max(1, Math.floor(Number(badge.dataset.tsimmQuantity) || 1));
      const totalProfit = profitEach * quantity;
      if (profitEach < 0 && isFloor) {
        badge.innerHTML = '<strong>BREAK-EVEN LIMIT</strong>'
          + `<span class="tsimm-listing-lot">${esc(cash(breakEvenPrice))} exit</span>`;
      } else {
        const eachText = profitEach === 0 ? '$0 EVEN' : `${signedCash(profitEach)} ea`;
        const lotText = totalProfit === 0 ? 'lot $0' : `lot ${compactWatchCash(totalProfit)}`;
        badge.innerHTML = `<strong>${esc(eachText)}</strong>`
          + `<span class="tsimm-listing-lot">${esc(lotText)}</span>`;
      }
      badge.classList.remove(
        'tsimm-tier-npc', 'tsimm-tier-gold', 'tsimm-tier-good', 'tsimm-tier-minor', 'tsimm-tier-loss',
        'tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss',
        'tsimm-watch-floor-badge', 'tsimm-watch-hidden-loss',
      );
      badge.classList.add('tsimm-watch-inline-badge', 'tsimm-watch-best-exit');
      if (profitEach > 0) badge.classList.add('tsimm-watch-best-exit-profit');
      else if (profitEach === 0) badge.classList.add('tsimm-watch-best-exit-even');
      else badge.classList.add('tsimm-watch-floor-badge');
      badge.title = profitEach < 0 && isFloor
        ? `Break-even limit from ${traderLabel}: ${cash(breakEvenPrice)}`
        : `${traderLabel} best exit`;
      row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
      return true;
    }

    if (profitEach < 0 && !isFloor) return true;
    const marker = document.createElement('span');
    marker.className = `tsimm-watch-profit${profitEach > 0 ? ' flip' : ''}${isFloor ? ' floor' : ''}`;
    marker.dataset.tsimmWatchProfit = '1';
    marker.textContent = profitEach < 0 && isFloor
      ? `BREAK-EVEN LIMIT ${cash(breakEvenPrice)}`
      : profitEach === 0
        ? '$0 EVEN'
        : `${compactWatchCash(profitEach)} ea`;
    marker.title = profitEach < 0 && isFloor
      ? `Break-even limit from ${traderLabel}: ${cash(breakEvenPrice)}`
      : `${traderLabel} best exit`;
    row.appendChild(marker);
    row.classList.add('tsimm-watch-format-row');
    row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
    return true;
  }
'''
marker_pattern = re.compile(r"  function addProfitMarker\(row, traderProfit, traderName = ''\) \{.*?\n  \}\n\n  function decorateMarket\(\) \{", re.S)
marker_match = marker_pattern.search(text)
if not marker_match:
    raise SystemExit('Could not locate addProfitMarker block')
text = text[:marker_match.start()] + new_marker + '\n  function decorateMarket() {' + text[marker_match.end():]

new_decorate = r'''  function decorateMarket() {
    cleanupMarket();
    if (!singleItemMarketPage()) {
      document.getElementById(A.panel)?.remove();
      return;
    }
    const item = currentMarketItem();
    if (!item) {
      document.getElementById(A.panel)?.remove();
      return;
    }
    const watched = isWatched(watchedStore(), item);
    const exits = watched ? exitsForItem(item) : [];
    const best = bestExit(exits);
    renderWatchPanel(item, exits);
    if (!watched || !best || best.status !== 'fresh') return;
    const rows = [...document.querySelectorAll('.tsimm-listing-mark')];
    let floorPlaced = false;
    for (const row of rows) {
      const price = listingPrice(row);
      if (!(price > 0)) continue;
      const traderProfit = best.price - price;
      const isFloorRow = traderProfit <= 0 && !floorPlaced;
      if (isFloorRow) {
        row.classList.add('tsimm-watch-floor-row');
        floorPlaced = true;
      }
      addProfitMarker(row, traderProfit, best.traderName, best.price, isFloorRow);
    }
  }
'''
decorate_pattern = re.compile(r"  function decorateMarket\(\) \{.*?\n  \}\n\n  function cardTrader\(", re.S)
decorate_match = decorate_pattern.search(text)
if not decorate_match:
    raise SystemExit('Could not locate decorateMarket block')
text = text[:decorate_match.start()] + new_decorate + '\n  function cardTrader(' + text[decorate_match.end():]

quick_start_after = text.index('  function quickMaxInteractiveLabel(')
quick_end_after = text.index('  function scanListings(', quick_start_after)
quick_after = hashlib.sha256(text[quick_start_after:quick_end_after].encode()).hexdigest()
if quick_before != quick_after:
    raise SystemExit('Quick MAX protected block changed')

for required in [
    '// @version      0.10.9',
    "version: '0.10.9'",
    'BREAK-EVEN LIMIT',
    'tsimm-watch-hidden-loss',
    'tsimm-watch-floor-badge',
]:
    if required not in text:
        raise SystemExit(f'Missing release marker: {required}')
if '@require' in text:
    raise SystemExit('Release unexpectedly contains @require')

path.write_text(text, encoding='utf-8')
print('Patched IMM v0.10.9 with profitable-only watched badges and cyan floor marker')
