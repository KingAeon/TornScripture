from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')

if '@version      0.18.0' not in text:
    raise SystemExit('Expected v0.18.0 userscript')

text = text.replace('0.18.0', '0.18.1')
text = text.replace(
    'ledger-aware TornPDA payout badges',
    'decision-first ledger trade badges',
)

old_clear = "element.classList.remove(PRICED_TRADE_ROW_CLASS, 'fresh', 'stale', 'outdated', 'missing');"
new_clear = "element.classList.remove(PRICED_TRADE_ROW_CLASS, 'fresh', 'stale', 'outdated', 'missing', 'decision-profit', 'decision-loss', 'decision-even', 'decision-partial', 'decision-unknown');"
if old_clear not in text:
    raise SystemExit('Priced Trade clear marker not found')
text = text.replace(old_clear, new_clear, 1)

css_start = text.index("      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-ledger{")
css_end = text.index("      .tsimm-priced-trade-start", css_start)
new_css = r'''      .${PRICED_TRADE_BADGE_CLASS}.ledger-profit{border-color:#47c968!important;background:#082611f2!important;color:#caffba!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-loss{border-color:#dc5568!important;background:#310b12f2!important;color:#ffc0c9!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-even{border-color:#8a9298!important;background:#191d20f2!important;color:#e1e5e8!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-unknown{border-color:#65727a!important;background:#14191cf2!important;color:#c1cbd1!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-partial{border-color:#c59a39!important;background:#2a2008f2!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict,.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-comparison,.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-meta{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict{font-size:9px!important;line-height:1.15!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.profit{color:#83f19a!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.loss{color:#ff8f9d!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.even{color:#e0e0e0!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-verdict.unknown{color:#b3bec4!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-comparison{margin-top:1px!important;padding-top:2px!important;border-top:1px solid #315d39!important;color:#d7ded9!important;font-size:7px!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-loss .tsimm-priced-trade-comparison{border-top-color:#74303a!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-partial .tsimm-priced-trade-comparison{border-top-color:#7c6125!important}.${PRICED_TRADE_BADGE_CLASS}.ledger-unknown .tsimm-priced-trade-comparison{border-top-color:#566068!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-meta{color:#87948c!important;font-size:7px!important}
      .${PRICED_TRADE_ROW_CLASS}.decision-profit{box-shadow:inset 3px 0 #47c968!important}.${PRICED_TRADE_ROW_CLASS}.decision-loss{box-shadow:inset 3px 0 #dc5568!important}.${PRICED_TRADE_ROW_CLASS}.decision-even{box-shadow:inset 3px 0 #8a9298!important}.${PRICED_TRADE_ROW_CLASS}.decision-partial{box-shadow:inset 3px 0 #c59a39!important}.${PRICED_TRADE_ROW_CLASS}.decision-unknown{box-shadow:inset 3px 0 #65727a!important}
'''
text = text[:css_start] + new_css + text[css_end:]

function_start = text.index('  function pricedTradeLedgerHtml(projection) {')
function_end = text.index('\n\n  function applyPricedTradeInventoryBadges', function_start)
new_function = r'''  function pricedTradeLedgerHtml(projection, unitPrice) {
    const payoutEach = Math.max(0, Number(unitPrice) || 0);
    if (!projection?.trackedQuantity) {
      return '<strong class="tsimm-priced-trade-verdict unknown">? COST UNKNOWN</strong>'
        + `<span class="tsimm-priced-trade-comparison">pays ${escapeHtml(formatMoney(payoutEach))} ea · no open ledger lot</span>`;
    }
    const status = projection.profit > 0 ? 'profit' : projection.profit < 0 ? 'loss' : 'even';
    const amount = formatMoney(Math.abs(projection.profitEach));
    const headline = status === 'profit'
      ? `${projection.fullCoverage ? '✓ PROFIT' : '⚠ PARTIAL PROFIT'} +${amount} EA`
      : status === 'loss'
        ? `${projection.fullCoverage ? '✕ LOSS' : '⚠ PARTIAL LOSS'} -${amount} EA`
        : `${projection.fullCoverage ? '≈ BREAK EVEN' : '⚠ PARTIAL EVEN'} · ${amount} EA`;
    const coverage = projection.fullCoverage
      ? 'ledger full'
      : `${formatInteger(projection.trackedQuantity)}/${formatInteger(projection.requestedQuantity)} ledger units`;
    return `<strong class="tsimm-priced-trade-verdict ${status}${projection.fullCoverage ? '' : ' partial'}">${escapeHtml(headline)}</strong>`
      + `<span class="tsimm-priced-trade-comparison">cost ${escapeHtml(formatMoney(projection.averageCost))} → pays ${escapeHtml(formatMoney(payoutEach))} · ${escapeHtml(coverage)}</span>`;
  }'''
text = text[:function_start] + new_function + text[function_end:]

apply_start = text.index('        const resolvedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));')
apply_end = text.index('\n      } else {', apply_start)
new_apply = r'''        const resolvedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
        const ledger = pricedTradeLedgerProjection(item, resolvedQuantity, quote.unitPrice);
        const ledgerState = !ledger.trackedQuantity
          ? 'unknown'
          : ledger.profit > 0 ? 'profit' : ledger.profit < 0 ? 'loss' : 'even';
        const decisionState = ledger.trackedQuantity && !ledger.fullCoverage ? 'partial' : ledgerState;
        row.classList.add(`decision-${decisionState}`);
        badge.classList.add(`ledger-${ledgerState}`);
        if (ledger.trackedQuantity && !ledger.fullCoverage) badge.classList.add('ledger-partial');
        badge.innerHTML = pricedTradeLedgerHtml(ledger, quote.unitPrice)
          + `<span class="tsimm-priced-trade-meta">${escapeHtml(trader.name)} · ${escapeHtml(formatInteger(resolvedQuantity))} available · ${escapeHtml(freshness.ageLabel)}</span>`;'''
text = text[:apply_start] + new_apply + text[apply_end:]

path.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.1 decision-first trade badges')
