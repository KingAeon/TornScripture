from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    text = text.replace(old, new, 1)


text = text.replace('0.10.3', '0.10.4')
if text == original:
    raise SystemExit('version replacement made no changes')

replace_once(
    "    const totalSign = margin.totalProfit > 0 ? '+' : '';\n    return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`\n      + `<span>${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} lot · ${escapeHtml(formatPercent(margin.roiPercent))}</span>`\n      + `<span>${escapeHtml(auditLine)}</span>`;",
    "    const totalSign = margin.totalProfit > 0 ? '+' : '';\n    return `<strong>${sign}${escapeHtml(formatMoney(margin.profitEach))} ea</strong>`\n      + `<span class=\"tsimm-listing-lot\">${totalSign}${escapeHtml(formatMoney(margin.totalProfit))} full lot</span>`\n      + `<span>${escapeHtml(formatPercent(margin.roiPercent))} ROI · Ⓣ ${escapeHtml(formatMoney(margin.payout))}</span>`;",
    'listing badge wording',
)

replace_once(
    "      .tsimm-badge-listing{display:inline-flex;margin-left:6px;vertical-align:middle;position:relative;z-index:3}",
    "      .tsimm-badge-listing{display:flex!important;position:relative;z-index:3;min-width:0;max-width:100%;width:max-content;margin:3px 0 0!important;overflow:hidden;vertical-align:initial;white-space:normal}.tsimm-badge-listing strong,.tsimm-badge-listing span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-badge-listing .tsimm-listing-lot{color:inherit;font-size:8px;font-weight:800;opacity:1}",
    'mobile listing badge css',
)

if text == original:
    raise SystemExit('patch made no changes')

path.write_text(text, encoding='utf-8')
print('Mobile listing badge patch applied.')
