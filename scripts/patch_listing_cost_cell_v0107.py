from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    text = text.replace(old, new, 1)


version_count = text.count('0.10.6')
if version_count < 3:
    raise SystemExit(f'version: expected at least 3 v0.10.6 markers, found {version_count}')
text = text.replace('0.10.6', '0.10.7')

replace_once(
"""  function extractListingQuantity(row, priceElement) {
""",
"""  function listingBadgeHost(priceElement, row) {
    if (!(priceElement instanceof Element) || !(row instanceof Element)) return priceElement;
    const priceRect = priceElement.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    let best = priceElement.parentElement || priceElement;
    for (let node = priceElement.parentElement; node && node !== row; node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      const rect = node.getBoundingClientRect();
      if (!(rect.width > 0) || rect.width > Math.max(190, rowRect.width * 0.38)) break;
      const hasPurchaseControl = Boolean(node.querySelector('button,[role="button"],input,a[href]'));
      const hasImage = Boolean(node.querySelector('img'));
      const hasQuantityCell = [...node.querySelectorAll('span,div,p,strong,b')]
        .filter((element) => !element.closest(`.${APP.badgeClass},[data-tsimm-generated]`))
        .some((element) => /^\\d[\\d,]*$/.test(ownText(element)));
      if (hasPurchaseControl || hasImage || hasQuantityCell) continue;
      if (rect.width + 1 >= priceRect.width) best = node;
    }
    return best;
  }

  function extractListingQuantity(row, priceElement) {
""",
'listing badge host helper',
)

replace_once(
"""    document.querySelectorAll(`.${APP.badgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.categoryMark}`).forEach((element) => clearTierMark(element, APP.categoryMark));
""",
"""    document.querySelectorAll(`.${APP.badgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll('.tsimm-listing-badge-host').forEach((element) => element.classList.remove('tsimm-listing-badge-host'));
    document.querySelectorAll(`.${APP.categoryMark}`).forEach((element) => clearTierMark(element, APP.categoryMark));
""",
'clear listing badge hosts',
)

replace_once(
"""    document.querySelectorAll(`.${APP.badgeClass}`).forEach((badge) => {
      if (badge.dataset.tsimmScanToken === scanToken) return;
      badge.remove();
    });
""",
"""    document.querySelectorAll(`.${APP.badgeClass}`).forEach((badge) => {
      if (badge.dataset.tsimmScanToken === scanToken) return;
      badge.parentElement?.classList.remove('tsimm-listing-badge-host');
      badge.remove();
    });
""",
'prune listing badge hosts',
)

replace_once(
"""    const totalSign = margin.totalProfit > 0 ? '+' : '';
    return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`
      + `<span class="tsimm-listing-lot">${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} full lot</span>`;
""",
"""    const totalSign = margin.totalProfit > 0 ? '+' : '';
    return `<strong>ea ${sign}${escapeHtml(formatMoney(margin.profitEach))}</strong>`
      + `<span class="tsimm-listing-lot">lot ${totalSign}${escapeHtml(formatMoney(margin.totalProfit))}</span>`;
""",
'compact listing badge labels',
)

replace_once(
"""    if (mode === 'listing') {
      badge.dataset.tsimmQuantity = String(margin.qty);
      badge.dataset.tsimmBaseProfitEach = String(margin.profitEach);
      badge.dataset.tsimmBaseProfitTotal = String(margin.totalProfit);
    }
""",
"""    if (mode === 'listing') {
      target.classList.add('tsimm-listing-badge-host');
      badge.dataset.tsimmQuantity = String(margin.qty);
      badge.dataset.tsimmBaseProfitEach = String(margin.profitEach);
      badge.dataset.tsimmBaseProfitTotal = String(margin.totalProfit);
    }
""",
'mark listing badge host',
)

replace_once(
"""      addBadge(candidate.priceElement, margin, 'listing', candidate.row, scanToken);
""",
"""      const badgeHost = listingBadgeHost(candidate.priceElement, candidate.row);
      addBadge(badgeHost, margin, 'listing', candidate.row, scanToken);
""",
'use cost-cell badge host',
)

replace_once(
"""      badge.classList.remove('tsimm-watch-inline-badge', 'tsimm-watch-best-exit');
""",
"""      badge.classList.remove(
        'tsimm-watch-inline-badge',
        'tsimm-watch-best-exit',
        'tsimm-watch-best-exit-profit',
        'tsimm-watch-best-exit-even',
        'tsimm-watch-best-exit-loss'
      );
""",
'clean watched badge state colors',
)

replace_once(
"""      const eachText = profitEach === 0 ? '$0 BREAK EVEN' : `${signedCash(profitEach)} ea`;
      const lotText = totalProfit === 0 ? '$0 full lot' : `${signedCash(totalProfit)} full lot`;
""",
"""      const eachText = profitEach === 0 ? 'ea $0 EVEN' : `ea ${signedCash(profitEach)}`;
      const lotText = totalProfit === 0 ? 'lot $0' : `lot ${signedCash(totalProfit)}`;
""",
'compact watched badge labels',
)

replace_once(
"""        + `<span class="tsimm-watch-inline">📌 ${esc(traderLabel)} best exit</span>`;
""",
"""        + `<span class="tsimm-watch-inline">📌 ${esc(traderLabel)}</span>`;
""",
'compact watched trader label',
)

replace_once(
"""      .tsimm-badge-listing{display:flex!important;position:relative;z-index:3;min-width:0;max-width:100%;width:max-content;margin:3px 0 0!important;overflow:hidden;vertical-align:initial;white-space:normal}.tsimm-badge-listing strong,.tsimm-badge-listing span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-badge-listing .tsimm-listing-lot{color:inherit;font-size:8px;font-weight:800;opacity:1}.tsimm-badge-listing.tsimm-watch-best-exit{background:#101512f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-profit{color:#78ef8d!important;border-color:#78ef8d!important;background:#073411f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-even{color:#f4c95d!important;border-color:#f4c95d!important;background:#2b2208f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-loss{color:#ff7c85!important;border-color:#ff626d!important;background:#2c0b0ef5!important}.tsimm-badge-listing.tsimm-watch-best-exit .tsimm-watch-inline{color:inherit!important}
""",
"""      .tsimm-listing-badge-host{min-width:0!important;overflow:visible!important}.tsimm-badge-listing{display:flex!important;position:relative;z-index:3;align-items:stretch;min-width:0;max-width:100%;width:100%!important;margin:3px 0 0!important;overflow:hidden;vertical-align:initial;white-space:normal}.tsimm-badge-listing strong,.tsimm-badge-listing span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:clip;white-space:nowrap}.tsimm-badge-listing strong{font-size:9px}.tsimm-badge-listing .tsimm-listing-lot{color:inherit;font-size:8px;font-weight:800;opacity:1}.tsimm-badge-listing.tsimm-watch-best-exit{background:#101512f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-profit{color:#78ef8d!important;border-color:#78ef8d!important;background:#073411f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-even{color:#f4c95d!important;border-color:#f4c95d!important;background:#2b2208f5!important}.tsimm-badge-listing.tsimm-watch-best-exit-loss{color:#ff7c85!important;border-color:#ff626d!important;background:#2c0b0ef5!important}.tsimm-badge-listing.tsimm-watch-best-exit .tsimm-watch-inline{color:inherit!important}
""",
'cost-cell badge styles',
)

path.write_text(text, encoding='utf-8')

# release trigger
