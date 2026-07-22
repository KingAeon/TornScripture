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


text = text.replace('0.10.1', '0.10.2')
if text == original:
    raise SystemExit('version replacement made no changes')

replace_once(
    "    showTradeExitAudit: true,\n    showClosedLedgerLots: true,",
    "    showTradeExitAudit: true,\n    tradeExitMinimumSwitchGain: 0,\n    showClosedLedgerLots: true,",
    'default switch threshold',
)

replace_once(
    "      'better-elsewhere': '↑ BETTER ELSEWHERE',\n      'npc-better': '🏪 NPC BETTER',",
    "      'better-elsewhere': '↑ BETTER ELSEWHERE',\n      'close-enough': '≈ CLOSE ENOUGH',\n      'npc-better': '🏪 NPC BETTER',",
    'close-enough verdict',
)

replace_once(
    "    let betterElsewhereCount = 0;\n    let npcBetterCount = 0;",
    "    let betterElsewhereCount = 0;\n    let closeEnoughCount = 0;\n    let npcBetterCount = 0;",
    'close-enough counter',
)

replace_once(
    "    let unknownCount = 0;\n\n    for (const item of items) {",
    "    let unknownCount = 0;\n    const minimumSwitchGain = Math.max(0, Number(state.settings.tradeExitMinimumSwitchGain) || 0);\n\n    for (const item of items) {",
    'minimum switch gain value',
)

replace_once(
    "      const actionable = ['sell-here', 'better-elsewhere', 'npc-better'].includes(status) && recommendedEach > 0;",
    "      let ignoredAlternative = null;\n      let ignoredGainTotal = 0;\n      if (status === 'better-elsewhere' && currentQuote && minimumSwitchGain > 0) {\n        const candidateGainTotal = Math.max(0, (recommendedEach - currentQuote.unitPrice) * quantity);\n        if (candidateGainTotal > 0 && candidateGainTotal < minimumSwitchGain) {\n          ignoredAlternative = {\n            traderId: recommendedTraderId,\n            traderName: recommendedSource,\n            unitPrice: recommendedEach,\n            freshness: recommendedFreshness,\n          };\n          ignoredGainTotal = candidateGainTotal;\n          status = 'close-enough';\n          recommendedEach = currentQuote.unitPrice;\n          recommendedSource = currentQuote.source === 'live trade cash'\n            ? `${currentQuote.traderName} live offer`\n            : currentQuote.traderName;\n          recommendedTraderId = currentQuote.traderId;\n          recommendedFreshness = currentQuote.freshness;\n        }\n      }\n\n      const actionable = ['sell-here', 'better-elsewhere', 'close-enough', 'npc-better'].includes(status) && recommendedEach > 0;",
    'threshold classification',
)

replace_once(
    "      if (status === 'sell-here') sellHereCount += 1;\n      else if (status === 'better-elsewhere') betterElsewhereCount += 1;\n      else if (status === 'npc-better') npcBetterCount += 1;",
    "      if (status === 'sell-here') sellHereCount += 1;\n      else if (status === 'better-elsewhere') betterElsewhereCount += 1;\n      else if (status === 'close-enough') closeEnoughCount += 1;\n      else if (status === 'npc-better') npcBetterCount += 1;",
    'close-enough count increment',
)

replace_once(
    "        recommendedFreshness,\n        deltaEach,",
    "        recommendedFreshness,\n        ignoredAlternative,\n        ignoredGainTotal,\n        deltaEach,",
    'ignored alternative fields',
)

replace_once(
    "      'sell-here': 'Current route wins',",
    "      'sell-here': closeEnoughCount\n        ? `${closeEnoughCount} small switch gain${closeEnoughCount === 1 ? '' : 's'} ignored`\n        : 'Current route wins',",
    'overall close-enough label',
)

replace_once(
    "      betterElsewhereCount,\n      npcBetterCount,",
    "      betterElsewhereCount,\n      closeEnoughCount,\n      npcBetterCount,",
    'return close-enough count',
)

replace_once(
    "      const route = auditItem.recommendedEach > 0\n        ? `${escapeHtml(auditItem.recommendedSource)} ${escapeHtml(formatMoney(auditItem.recommendedEach))} ea`\n        : 'No actionable exit';",
    "      const route = auditItem.status === 'close-enough' && auditItem.ignoredGainTotal > 0\n        ? `Ignored +${escapeHtml(formatMoney(auditItem.ignoredGainTotal))} total · keep here`\n        : auditItem.recommendedEach > 0\n          ? `${escapeHtml(auditItem.recommendedSource)} ${escapeHtml(formatMoney(auditItem.recommendedEach))} ea`\n          : 'No actionable exit';",
    'close-enough row badge',
)

replace_once(
    "    const problemItems = audit.items.filter((item) => item.status !== 'sell-here');\n    const visibleItems = showAll ? audit.items : problemItems;\n    const hiddenSellHere = showAll ? 0 : audit.sellHereCount;",
    "    const problemItems = audit.items.filter((item) => !['sell-here', 'close-enough'].includes(item.status));\n    const visibleItems = showAll ? audit.items : problemItems;\n    const hiddenSafeCount = showAll ? 0 : audit.sellHereCount + Number(audit.closeEnoughCount || 0);",
    'problems-only safe filtering',
)

replace_once(
    "      const deltaText = item.deltaTotal === null\n        ? ''\n        : item.deltaTotal > 0\n          ? ` · +${formatMoney(item.deltaTotal)} vs here`\n          : item.deltaTotal < 0\n            ? ` · ${formatMoney(item.deltaTotal)} vs here`\n            : ' · tied with here';\n      return `<div class=\"tsimm-trade-exit-row tsimm-trade-exit-${escapeHtml(item.status)}\">`",
    "      const deltaText = item.deltaTotal === null\n        ? ''\n        : item.deltaTotal > 0\n          ? ` · +${formatMoney(item.deltaTotal)} vs here`\n          : item.deltaTotal < 0\n            ? ` · ${formatMoney(item.deltaTotal)} vs here`\n            : ' · tied with here';\n      const switchGainHtml = item.status === 'better-elsewhere' && Number(item.deltaTotal) > 0\n        ? `<div class=\"tsimm-trade-exit-gain\"><span>Bulk switch gain</span><strong>+${escapeHtml(formatMoney(item.deltaTotal))} total</strong></div>`\n        : item.status === 'close-enough' && Number(item.ignoredGainTotal) > 0\n          ? `<div class=\"tsimm-trade-exit-gain ignored\"><span>Ignored switch gain</span><strong>+${escapeHtml(formatMoney(item.ignoredGainTotal))} total</strong></div>`\n          : '';\n      return `<div class=\"tsimm-trade-exit-row tsimm-trade-exit-${escapeHtml(item.status)}\">`",
    'bulk gain row',
)

replace_once(
    "        + `<div class=\"tsimm-trade-exit-route\"><span>${escapeHtml(item.recommendedSource || 'No actionable route')}${escapeHtml(routeAge)}</span><strong>${escapeHtml(routeValue)}</strong></div>`\n        + `<small>",
    "        + `<div class=\"tsimm-trade-exit-route\"><span>${escapeHtml(item.recommendedSource || 'No actionable route')}${escapeHtml(routeAge)}</span><strong>${escapeHtml(routeValue)}</strong></div>`\n        + switchGainHtml\n        + `<small>",
    'insert gain html',
)

replace_once(
    "    const emptyText = audit.totalTypes\n      ? `${formatInteger(audit.sellHereCount)} item type${audit.sellHereCount === 1 ? '' : 's'} cleared to sell here. Use Show all to inspect them.`",
    "    const safeCount = audit.sellHereCount + Number(audit.closeEnoughCount || 0);\n    const emptyText = audit.totalTypes\n      ? `${formatInteger(safeCount)} item type${safeCount === 1 ? '' : 's'} cleared or below your switch threshold. Use Show all to inspect them.`",
    'safe empty text',
)

replace_once(
    "    const viewButton = audit.sellHereCount\n      ? `<button type=\"button\" data-tsimm-action=\"trade-exit-toggle-all\">${showAll ? `Problems only (${formatInteger(problemItems.length)})` : `Show all (${formatInteger(audit.totalTypes)})`}</button>`",
    "    const viewButton = safeCount\n      ? `<button type=\"button\" data-tsimm-action=\"trade-exit-toggle-all\">${showAll ? `Problems only (${formatInteger(problemItems.length)})` : `Show all (${formatInteger(audit.totalTypes)})`}</button>`",
    'show-all safe count',
)

replace_once(
    "        <div class=\"tsimm-trade-exit-head\"><strong>🧭 Trade Exit Audit</strong><span>${escapeHtml(audit.overallLabel)}${hiddenSellHere ? ` · ${formatInteger(hiddenSellHere)} safe hidden` : ''}</span></div>",
    "        <div class=\"tsimm-trade-exit-head\"><strong>🧭 Trade Exit Audit</strong><span>${escapeHtml(audit.overallLabel)}${hiddenSafeCount ? ` · ${formatInteger(hiddenSafeCount)} safe hidden` : ''}</span></div>",
    'hidden safe count header',
)

replace_once(
    "        <div class=\"tsimm-muted\">Problems-only view hides SELL HERE rows. Fresh captured prices remain actionable for 72h by default.</div>",
    "        <div class=\"tsimm-muted\">Problems-only view hides SELL HERE and CLOSE ENOUGH rows. Minimum switch gain: ${escapeHtml(formatMoney(state.settings.tradeExitMinimumSwitchGain || 0))}. Fresh prices remain actionable for 72h.</div>",
    'threshold audit note',
)

replace_once(
    "        <label class=\"tsimm-check\"><input type=\"checkbox\" data-tsimm-setting=\"showTradeExitAudit\" ${state.settings.showTradeExitAudit !== false ? 'checked' : ''}> Show Trade Exit Audit</label>\n        <div class=\"tsimm-muted\">Side detection:",
    "        <label class=\"tsimm-check\"><input type=\"checkbox\" data-tsimm-setting=\"showTradeExitAudit\" ${state.settings.showTradeExitAudit !== false ? 'checked' : ''}> Show Trade Exit Audit</label>\n        <div class=\"tsimm-controls\"><label>Ignore switch gains under</label><input type=\"number\" min=\"0\" step=\"100\" value=\"${escapeHtml(state.settings.tradeExitMinimumSwitchGain || 0)}\" data-tsimm-setting=\"tradeExitMinimumSwitchGain\"></div>\n        <div class=\"tsimm-muted\">Side detection:",
    'threshold control',
)

replace_once(
    "      .tsimm-trade-exit-route{font-size:10px}.tsimm-trade-exit-row small{color:#aaa1b7;font-size:8px;line-height:1.25}",
    "      .tsimm-trade-exit-route{font-size:10px}.tsimm-trade-exit-gain{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:3px 5px;border-radius:5px;background:#281b35;color:#e5c4ff;font-size:9px}.tsimm-trade-exit-gain strong{color:#f0c8ff}.tsimm-trade-exit-gain.ignored{background:#172820;color:#a9d9bc}.tsimm-trade-exit-gain.ignored strong{color:#b8ebca}.tsimm-trade-exit-row small{color:#aaa1b7;font-size:8px;line-height:1.25}",
    'gain styling',
)

replace_once(
    "      .tsimm-trade-exit-better-elsewhere{border-color:#7d59a4}.tsimm-trade-exit-better-elsewhere .tsimm-trade-exit-row-head strong{color:#d7a4ff}\n      .tsimm-trade-exit-npc-better",
    "      .tsimm-trade-exit-better-elsewhere{border-color:#7d59a4}.tsimm-trade-exit-better-elsewhere .tsimm-trade-exit-row-head strong{color:#d7a4ff}\n      .tsimm-trade-exit-close-enough{border-color:#47785b}.tsimm-trade-exit-close-enough .tsimm-trade-exit-row-head strong{color:#91dbad}\n      .tsimm-trade-exit-npc-better",
    'close-enough card styling',
)

replace_once(
    ".tsimm-trade-exit-badge-sell-here{border-color:#44d88b!important;color:#8cf0b5!important}.tsimm-trade-exit-badge-better-elsewhere{border-color:#bd6cff!important;color:#e0b2ff!important}.tsimm-trade-exit-badge-npc-better",
    ".tsimm-trade-exit-badge-sell-here{border-color:#44d88b!important;color:#8cf0b5!important}.tsimm-trade-exit-badge-better-elsewhere{border-color:#bd6cff!important;color:#e0b2ff!important}.tsimm-trade-exit-badge-close-enough{border-color:#5ea879!important;color:#a7e6bd!important}.tsimm-trade-exit-badge-npc-better",
    'close-enough badge styling',
)

if text == original:
    raise SystemExit('patch made no changes')

path.write_text(text, encoding='utf-8')
print('Trade switch-gain threshold patch applied.')
