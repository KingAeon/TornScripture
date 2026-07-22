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


text = text.replace('0.10.2', '0.10.3')
if text == original:
    raise SystemExit('version replacement made no changes')

replace_once(
    "    document.querySelectorAll(`.${APP.tradeItemMark}`).forEach((element) => element.classList.remove(APP.tradeItemMark));\n    document.querySelectorAll('[data-tsimm-trade-exit-status],[data-tsimm-trade-exit-token]').forEach((element) => {",
    "    document.querySelectorAll(`.${APP.tradeItemMark}`).forEach((element) => element.classList.remove(APP.tradeItemMark));\n    document.querySelectorAll('[data-tsimm-trade-route-alert]').forEach((element) => element.remove());\n    document.querySelectorAll('[data-tsimm-trade-exit-status],[data-tsimm-trade-exit-token]').forEach((element) => {",
    'clear main route alert',
)

replace_once(
    "      const route = auditItem.status === 'close-enough' && auditItem.ignoredGainTotal > 0\n        ? `Ignored +${escapeHtml(formatMoney(auditItem.ignoredGainTotal))} total · keep here`\n        : auditItem.recommendedEach > 0\n          ? `${escapeHtml(auditItem.recommendedSource)} ${escapeHtml(formatMoney(auditItem.recommendedEach))} ea`\n          : 'No actionable exit';\n      badge.innerHTML = `<strong>${escapeHtml(auditItem.verdict)}</strong>`\n        + `<span>${route} · Ⓣ ${escapeHtml(formatMoney(auditItem.targetEach * auditItem.quantity))}</span>`;",
    "      const majorSwitchGain = auditItem.status === 'better-elsewhere' && Number(auditItem.deltaTotal) > 0\n        ? Number(auditItem.deltaTotal)\n        : 0;\n      if (majorSwitchGain) badge.classList.add('tsimm-trade-exit-badge-major');\n      const route = auditItem.status === 'close-enough' && auditItem.ignoredGainTotal > 0\n        ? `Ignored +${escapeHtml(formatMoney(auditItem.ignoredGainTotal))} total · keep here`\n        : auditItem.recommendedEach > 0\n          ? `${escapeHtml(auditItem.recommendedSource)} ${escapeHtml(formatMoney(auditItem.recommendedEach))} ea`\n          : 'No actionable exit';\n      const verdict = majorSwitchGain\n        ? `${auditItem.verdict} · +${formatMoney(majorSwitchGain)} TOTAL`\n        : auditItem.verdict;\n      badge.innerHTML = `<strong>${escapeHtml(verdict)}</strong>`\n        + `<span>${route} · Ⓣ ${escapeHtml(formatMoney(auditItem.targetEach * auditItem.quantity))}</span>`;",
    'prominent main-page switch gain badge',
)

replace_once(
    "  function tradeExitRemoveControlLabel(element) {",
    """  function applyTradeExitMainPageAlert(mySide, audit) {
    document.querySelectorAll('[data-tsimm-trade-route-alert]').forEach((element) => element.remove());
    if (state.settings.showTradeExitAudit === false || !(mySide?.element instanceof Element) || !audit?.items?.length) return;

    const routes = audit.items
      .filter((item) => item.status === 'better-elsewhere' && Number(item.deltaTotal) > 0)
      .sort((left, right) => Number(right.deltaTotal) - Number(left.deltaTotal));
    if (!routes.length) return;

    const totalGain = routes.reduce((sum, item) => sum + Number(item.deltaTotal || 0), 0);
    const alert = document.createElement('section');
    alert.className = 'tsimm-trade-route-alert';
    alert.dataset.tsimmTradeRouteAlert = 'true';
    alert.dataset.tsimmGenerated = 'true';
    const routeLines = routes.slice(0, 3).map((item) =>
      `<span><strong>${escapeHtml(item.itemName)}</strong> +${escapeHtml(formatMoney(item.deltaTotal))} → ${escapeHtml(item.recommendedSource)}</span>`
    ).join('');
    const remainder = routes.length > 3
      ? `<span class="tsimm-trade-route-more">+${formatInteger(routes.length - 3)} more worthwhile route${routes.length - 3 === 1 ? '' : 's'}</span>`
      : '';
    alert.innerHTML = `
      <div class="tsimm-trade-route-alert-head">
        <strong>🧭 ${formatInteger(routes.length)} worthwhile trader switch${routes.length === 1 ? '' : 'es'}</strong>
        <b>+${escapeHtml(formatMoney(totalGain))} total</b>
      </div>
      <div class="tsimm-trade-route-alert-list">${routeLines}${remainder}</div>
    `;

    const headingSelector = '.title-black,[role="heading"],h2,h3,h4,h5,[class*="title___"],[class*="header___"]';
    const heading = mySide.element.matches?.(headingSelector)
      ? mySide.element
      : [...mySide.element.querySelectorAll(headingSelector)].find((element) => visibleElement(element));
    if (heading) heading.insertAdjacentElement('afterend', alert);
    else mySide.element.prepend(alert);
  }

  function tradeExitRemoveControlLabel(element) {""",
    'main trade route alert helper',
)

replace_once(
    "    stats.tradeExitAudit = buildTradeExitAudit(stats);\n    applyTradeExitAuditBadges(matched, stats.tradeExitAudit);",
    "    stats.tradeExitAudit = buildTradeExitAudit(stats);\n    applyTradeExitAuditBadges(matched, stats.tradeExitAudit);\n    applyTradeExitMainPageAlert(mySide, stats.tradeExitAudit);",
    'main route alert scan call',
)

replace_once(
    "      .tsimm-controls select{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}",
    "      .tsimm-trade-exit-badge-major{background:#281735!important;box-shadow:0 0 0 1px #bd6cff66,0 3px 10px #0009!important}.tsimm-trade-exit-badge-major strong{color:#f0c8ff!important;font-size:10px!important}\n      .tsimm-trade-route-alert{position:relative;z-index:8;display:grid;gap:5px;margin:6px;padding:7px;border:1px solid #9a62c7;border-radius:8px;background:linear-gradient(135deg,#291735,#1d1928);color:#f5eaff;box-shadow:0 3px 12px #0008;font:700 10px/1.25 Arial,sans-serif;pointer-events:none}.tsimm-trade-route-alert-head{display:flex;align-items:center;justify-content:space-between;gap:7px}.tsimm-trade-route-alert-head strong{min-width:0}.tsimm-trade-route-alert-head b{color:#f0c8ff;white-space:nowrap;font-size:11px}.tsimm-trade-route-alert-list{display:grid;gap:2px;color:#d9c9e8;font-size:9px}.tsimm-trade-route-alert-list span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-trade-route-alert-list strong{color:#fff}.tsimm-trade-route-more{color:#ad9bbd!important}\n      .tsimm-controls select{width:100%;border:1px solid #5a5266;border-radius:6px;background:#17151b;color:#fff;padding:5px}",
    'main route alert styling',
)

if text == original:
    raise SystemExit('patch made no changes')

path.write_text(text, encoding='utf-8')
print('Main trade route alert patch applied.')
