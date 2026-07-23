from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    text = text.replace(old, new, 1)


version_count = text.count('0.10.4')
if version_count < 3:
    raise SystemExit(f'version: expected at least 3 v0.10.4 markers, found {version_count}')
text = text.replace('0.10.4', '0.10.5')

replace_once(
"""    const totalSign = margin.totalProfit > 0 ? '+' : '';
    return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
      + `<span class="tsimm-listing-lot">${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} full lot</span>`
      + `<span>${escapeHtml(formatPercent(margin.roiPercent))} ROI · Ⓣ ${escapeHtml(formatMoney(margin.payout))}</span>`;
""",
"""    const totalSign = margin.totalProfit > 0 ? '+' : '';
    return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
      + `<span class="tsimm-listing-lot">${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} full lot</span>`;
""",
'listing badge details',
)

replace_once(
"""    badge.dataset.tsimmScanToken = scanToken;

    if (mode === 'category') {
""",
"""    badge.dataset.tsimmScanToken = scanToken;
    if (mode === 'listing') {
      badge.dataset.tsimmQuantity = String(margin.qty);
      badge.dataset.tsimmBaseProfitEach = String(margin.profitEach);
      badge.dataset.tsimmBaseProfitTotal = String(margin.totalProfit);
    }

    if (mode === 'category') {
""",
'listing badge data',
)

replace_once(
"""      .tsimm-badge-listing{display:flex!important;position:relative;z-index:3;min-width:0;max-width:100%;width:max-content;margin:3px 0 0!important;overflow:hidden;vertical-align:initial;white-space:normal}.tsimm-badge-listing strong,.tsimm-badge-listing span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-badge-listing .tsimm-listing-lot{color:inherit;font-size:8px;font-weight:800;opacity:1}
""",
"""      .tsimm-badge-listing{display:flex!important;position:relative;z-index:3;min-width:0;max-width:100%;width:max-content;margin:3px 0 0!important;overflow:hidden;vertical-align:initial;white-space:normal}.tsimm-badge-listing strong,.tsimm-badge-listing span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-badge-listing .tsimm-listing-lot{color:inherit;font-size:8px;font-weight:800;opacity:1}.tsimm-badge-listing.tsimm-watch-best-exit{color:#78ef8d!important;border-color:#78ef8d!important;background:#073411f5!important}.tsimm-badge-listing.tsimm-watch-best-exit .tsimm-watch-inline{color:#d1ffbf!important}
""",
'best-exit badge style',
)

replace_once(
"""  function cleanupMarket() {
    document.querySelectorAll('.tsimm-watch-inline[data-tsimm-watch-original-html]').forEach((line) => {
""",
"""  function cleanupMarket() {
    document.querySelectorAll('.tsimm-margin-badge[data-tsimm-watch-original-html]').forEach((badge) => {
      badge.innerHTML = badge.dataset.tsimmWatchOriginalHtml || '';
      badge.classList.remove('tsimm-watch-inline-badge', 'tsimm-watch-best-exit');
      delete badge.dataset.tsimmWatchOriginalHtml;
    });
    document.querySelectorAll('.tsimm-watch-inline[data-tsimm-watch-original-html]').forEach((line) => {
""",
'watch cleanup',
)

replace_once(
"""  function addProfitMarker(row, traderProfit, traderName = '') {
    const badge = row.querySelector('.tsimm-margin-badge');
    const immProfit = signedEach(badge?.textContent);
    const traderLabel = clean(traderName).slice(0, 14) || 'trader';
    let label = '';
    let flip = false;
    if (Number.isFinite(immProfit) && immProfit < 0) {
      label = `📌 ${traderLabel} FLIP +${cash(traderProfit)}`;
      flip = true;
    } else if (Number.isFinite(immProfit)) {
      const extra = traderProfit - immProfit;
      if (extra <= 0) return false;
      label = `📌 ${traderLabel} +${cash(extra)} better`;
    } else {
      label = `📌 ${traderLabel} +${cash(traderProfit)}`;
    }
    const badgeLines = badge ? [...badge.querySelectorAll('span')] : [];
    const inlineLine = badgeLines.at(-1) || null;
    if (inlineLine) {
      inlineLine.dataset.tsimmWatchOriginalHtml = inlineLine.innerHTML;
      inlineLine.textContent = label;
      inlineLine.classList.add('tsimm-watch-inline');
      badge.classList.add('tsimm-watch-inline-badge');
      row.classList.add('tsimm-watch-profitable');
      return true;
    }
    const marker = document.createElement('span');
    marker.className = `tsimm-watch-profit${flip ? ' flip' : ''}`;
    marker.dataset.tsimmWatchProfit = '1';
    marker.textContent = label;
    row.appendChild(marker);
    row.classList.add('tsimm-watch-format-row', 'tsimm-watch-profitable');
    return true;
  }
""",
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
'best-exit profit marker',
)

path.write_text(text, encoding='utf-8')
print('Patched listing badges to v0.10.5')
