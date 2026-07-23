from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')

if '// @version      0.10.6' not in text:
    raise SystemExit('Expected stable v0.10.6 core was not found')
if '@require' in text:
    raise SystemExit('Refusing to patch a wrapper build')

text = text.replace('0.10.6', '0.10.8')

css_start = text.index('      .tsimm-watch-inline-badge')
css_end = text.index('      .tsimm-watch-profit', css_start)
new_css = '''      .tsimm-watch-inline-badge{display:grid!important;gap:1px!important;min-width:0!important;max-width:100%!important;padding:2px 4px!important;overflow:hidden!important;box-sizing:border-box!important}.tsimm-watch-inline-badge strong,.tsimm-watch-inline-badge .tsimm-listing-lot{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;white-space:nowrap!important;text-overflow:clip!important}.tsimm-watch-inline-badge strong{font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline-badge .tsimm-listing-lot{font:800 7px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-watch-inline{display:none!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-profit .tsimm-listing-lot{border-color:#78ef8d!important;background:#073411f5!important;color:#78ef8d!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-even,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-even .tsimm-listing-lot{border-color:#52c7ea!important;background:#071f29f5!important;color:#8ee8ff!important}.tsimm-watch-inline-badge.tsimm-watch-best-exit-loss,.tsimm-watch-inline-badge.tsimm-watch-best-exit-loss strong,.tsimm-watch-inline-badge.tsimm-watch-best-exit-loss .tsimm-listing-lot{border-color:#ff626d!important;background:#2c0b0ef5!important;color:#ff7c85!important}.tsimm-watch-format-row{position:relative!important}
'''
text = text[:css_start] + new_css + text[css_end:]

function_start = text.index('  function addProfitMarker')
function_end = text.index('  function decorateMarket', function_start)
new_function = '''  function compactWatchCash(value) {
    const number = Number(value) || 0;
    const amount = Math.abs(number);
    const sign = number < 0 ? '-' : number > 0 ? '+' : '';
    const compact = (divisor, suffix, decimals) => {
      const rendered = (amount / divisor)
        .toFixed(decimals)
        .replace(/\\.0+$|(\\.[0-9]*[1-9])0+$/g, '$1');
      return `${sign}$${rendered}${suffix}`;
    };
    if (amount >= 1_000_000_000) return compact(1_000_000_000, 'b', amount < 10_000_000_000 ? 1 : 0);
    if (amount >= 1_000_000) return compact(1_000_000, 'm', amount < 10_000_000 ? 1 : 0);
    if (amount >= 1_000) return compact(1_000, 'k', amount < 10_000 ? 1 : 0);
    return `${sign}${cash(amount)}`;
  }

  function addProfitMarker(row, traderProfit, traderName = '') {
    const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing')
      || row.querySelector('.tsimm-margin-badge');
    const profitEach = Number(traderProfit);
    if (!Number.isFinite(profitEach)) return false;
    const traderLabel = clean(traderName).slice(0, 18) || 'trader';
    const stateClass = profitEach > 0
      ? 'tsimm-watch-best-exit-profit'
      : profitEach < 0
        ? 'tsimm-watch-best-exit-loss'
        : 'tsimm-watch-best-exit-even';
    const signedCash = (value) => value > 0 ? `+${cash(value)}` : cash(value);
    if (badge) {
      const quantity = Math.max(1, Math.floor(Number(badge.dataset.tsimmQuantity) || 1));
      const totalProfit = profitEach * quantity;
      const eachText = profitEach === 0 ? '$0 EVEN' : `${signedCash(profitEach)} ea`;
      const lotText = totalProfit === 0 ? 'lot $0' : `lot ${compactWatchCash(totalProfit)}`;
      if (!badge.dataset.tsimmWatchOriginalHtml) badge.dataset.tsimmWatchOriginalHtml = badge.innerHTML;
      badge.innerHTML = `<strong>${esc(eachText)}</strong>`
        + `<span class="tsimm-listing-lot">${esc(lotText)}</span>`;
      badge.classList.remove(
        'tsimm-tier-npc', 'tsimm-tier-gold', 'tsimm-tier-good', 'tsimm-tier-minor', 'tsimm-tier-loss',
        'tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss',
      );
      badge.classList.add('tsimm-watch-inline-badge', 'tsimm-watch-best-exit', stateClass);
      row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
      return true;
    }
    const marker = document.createElement('span');
    marker.className = `tsimm-watch-profit${profitEach > 0 ? ' flip' : ''}`;
    marker.dataset.tsimmWatchProfit = '1';
    marker.textContent = profitEach === 0
      ? '$0 EVEN'
      : `${compactWatchCash(profitEach)} ea`;
    if (profitEach === 0) {
      marker.style.setProperty('border-color', '#52c7ea', 'important');
      marker.style.setProperty('background', '#071f29f5', 'important');
      marker.style.setProperty('color', '#8ee8ff', 'important');
    } else if (profitEach < 0) {
      marker.style.setProperty('border-color', '#ff626d', 'important');
      marker.style.setProperty('background', '#2c0b0ef5', 'important');
      marker.style.setProperty('color', '#ff7c85', 'important');
    }
    marker.title = `${traderLabel} best exit`;
    row.appendChild(marker);
    row.classList.add('tsimm-watch-format-row');
    row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
    return true;
  }

'''
text = text[:function_start] + new_function + text[function_end:]

if text.count('function compactWatchCash') != 1:
    raise SystemExit('Compact cash helper was not installed exactly once')
if '📌 ${esc(traderLabel)} best exit' in text:
    raise SystemExit('Redundant trader row remains in listing badges')
if '#52c7ea' not in text or '#8ee8ff' not in text:
    raise SystemExit('Cyan break-even styling is missing')

path.write_text(text, encoding='utf-8')
