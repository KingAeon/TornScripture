from hashlib import sha256
from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    text = text.replace(old, new, 1)


def quick_max_hash(source: str) -> str:
    start = source.index('  function quickMaxInteractiveLabel')
    end = source.index('  function scanListings', start)
    return sha256(source[start:end].encode('utf-8')).hexdigest()


protected_quick_max = quick_max_hash(text)
version_count = text.count('0.10.5')
if version_count < 3:
    raise SystemExit(f'version: expected at least 3 v0.10.5 markers, found {version_count}')
text = text.replace('0.10.5', '0.10.6')

replace_once(
    "badge.classList.remove('tsimm-watch-inline-badge', 'tsimm-watch-best-exit');",
    "badge.classList.remove('tsimm-watch-inline-badge', 'tsimm-watch-best-exit', 'tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss');",
    'watch badge cleanup classes',
)

replace_once(
    ".tsimm-badge-listing.tsimm-watch-best-exit{color:#78ef8d!important;border-color:#78ef8d!important;background:#073411f5!important}.tsimm-badge-listing.tsimm-watch-best-exit .tsimm-watch-inline{color:#d1ffbf!important}",
    ".tsimm-badge-listing.tsimm-watch-best-exit{background:#101512f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-profit{color:#78ef8d!important;border-color:#78ef8d!important;background:#073411f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-even{color:#f4c95d!important;border-color:#f4c95d!important;background:#2b2208f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-loss{color:#ff7c85!important;border-color:#ff626d!important;background:#2c0b0ef5!important}.tsimm-badge-listing.tsimm-watch-best-exit .tsimm-watch-inline{color:inherit!important}",
    'watched exit state styles',
)

replace_once(
"""  function addProfitMarker(row, traderProfit, traderName = '') {
    const badge = row.querySelector('.tsimm-margin-badge.tsimm-badge-listing')
      || row.querySelector('.tsimm-margin-badge');
    const profitEach = Number(traderProfit) || 0;
    if (!(profitEach > 0)) return false;
    const traderLabel = clean(traderName).slice(0, 18) || 'trader';
    if (badge) {
      const quantity = Math.max(1, Math.floor(Number(badge.dataset.tsimmQuantity) || 1));
      if (!badge.dataset.tsimmWatchOriginalHtml) badge.dataset.tsimmWatchOriginalHtml = badge.innerHTML;
      badge.innerHTML = `<strong>+${esc(cash(profitEach))} ea</strong>`
        + `<span class="tsimm-listing-lot">+${esc(cash(profitEach * quantity))} full lot</span>`
        + `<span class="tsimm-watch-inline">📌 ${esc(traderLabel)} best exit</span>`;
      badge.classList.add('tsimm-watch-inline-badge', 'tsimm-watch-best-exit');
      row.classList.add('tsimm-watch-profitable');
      return true;
    }
    const marker = document.createElement('span');
    marker.className = 'tsimm-watch-profit flip';
    marker.dataset.tsimmWatchProfit = '1';
    marker.textContent = `📌 ${traderLabel} +${cash(profitEach)}`;
    row.appendChild(marker);
    row.classList.add('tsimm-watch-format-row', 'tsimm-watch-profitable');
    return true;
  }
""",
"""  function addProfitMarker(row, traderProfit, traderName = '') {
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
      const eachText = profitEach === 0 ? '$0 BREAK EVEN' : `${signedCash(profitEach)} ea`;
      const lotText = totalProfit === 0 ? '$0 full lot' : `${signedCash(totalProfit)} full lot`;
      if (!badge.dataset.tsimmWatchOriginalHtml) badge.dataset.tsimmWatchOriginalHtml = badge.innerHTML;
      badge.innerHTML = `<strong>${esc(eachText)}</strong>`
        + `<span class="tsimm-listing-lot">${esc(lotText)}</span>`
        + `<span class="tsimm-watch-inline">📌 ${esc(traderLabel)} best exit</span>`;
      badge.classList.remove('tsimm-watch-best-exit-profit', 'tsimm-watch-best-exit-even', 'tsimm-watch-best-exit-loss');
      badge.classList.add('tsimm-watch-inline-badge', 'tsimm-watch-best-exit', stateClass);
      row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
      return true;
    }
    const marker = document.createElement('span');
    marker.className = `tsimm-watch-profit${profitEach > 0 ? ' flip' : ''}`;
    marker.dataset.tsimmWatchProfit = '1';
    marker.textContent = profitEach === 0
      ? `📌 ${traderLabel} $0 BREAK EVEN`
      : `📌 ${traderLabel} ${signedCash(profitEach)}`;
    if (profitEach === 0) {
      marker.style.setProperty('border-color', '#f4c95d', 'important');
      marker.style.setProperty('background', '#2b2208f5', 'important');
      marker.style.setProperty('color', '#f4c95d', 'important');
    } else if (profitEach < 0) {
      marker.style.setProperty('border-color', '#ff626d', 'important');
      marker.style.setProperty('background', '#2c0b0ef5', 'important');
      marker.style.setProperty('color', '#ff7c85', 'important');
    }
    row.appendChild(marker);
    row.classList.add('tsimm-watch-format-row');
    row.classList.toggle('tsimm-watch-profitable', profitEach > 0);
    return true;
  }
""",
    'signed watched exit marker',
)

replace_once(
"""      const traderProfit = price > 0 ? best.price - price : 0;
      if (traderProfit > 0) {
        sawProfit = true;
        addProfitMarker(row, traderProfit, best.traderName);
      } else if (sawProfit && !floorPlaced && price > 0) {
        row.classList.add('tsimm-watch-floor-row');
        floorPlaced = true;
      }
""",
"""      if (!(price > 0)) continue;
      const traderProfit = best.price - price;
      if (traderProfit > 0) sawProfit = true;
      else if (sawProfit && !floorPlaced) {
        row.classList.add('tsimm-watch-floor-row');
        floorPlaced = true;
      }
      addProfitMarker(row, traderProfit, best.traderName);
""",
    'decorate every watched listing row',
)

if quick_max_hash(text) != protected_quick_max:
    raise SystemExit('protected Quick MAX block changed unexpectedly')

path.write_text(text, encoding='utf-8')
