from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text

if text.count('0.19.11') < 4:
    raise SystemExit('Expected v0.19.11 markers were not found')
text = text.replace('0.19.11', '0.19.12')

old_badge_css = '''      .${PRICED_TRADE_BADGE_CLASS}{display:grid!important;gap:1px!important;width:min(210px,48vw)!important;max-width:min(210px,48vw)!important;position:relative!important;height:36px!important;min-height:36px!important;max-height:36px!important;overflow:hidden!important;overflow-anchor:none!important;align-content:start!important;margin:2px 4px!important;padding:4px 6px!important;border:1px solid #47c968!important;border-radius:5px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.12 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:auto!important;cursor:pointer!important;box-sizing:border-box!important}
      .${PRICED_TRADE_BADGE_CLASS}.expanded{height:auto!important;min-height:36px!important;max-height:132px!important;overflow:auto!important}'''
new_badge_css = '''      .${PRICED_TRADE_BADGE_CLASS}{display:grid!important;gap:0!important;width:min(210px,48vw)!important;max-width:min(210px,48vw)!important;position:relative!important;height:30px!important;min-height:30px!important;max-height:30px!important;overflow:hidden!important;overflow-anchor:none!important;align-content:start!important;margin:1px 4px!important;padding:3px 5px!important;border:1px solid #47c968!important;border-radius:4px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:auto!important;cursor:pointer!important;box-sizing:border-box!important}
      .${PRICED_TRADE_BADGE_CLASS}.expanded{height:auto!important;min-height:30px!important;max-height:126px!important;overflow:auto!important}'''
if old_badge_css not in text:
    raise SystemExit('Compact badge CSS anchor not found')
text = text.replace(old_badge_css, new_badge_css, 1)

old_compact_css = '''      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact{display:grid!important;gap:1px!important;min-width:0!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact-line{font-size:9px!important;line-height:1.05!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact-sub{color:#9fb4a3!important;font-size:7px!important;line-height:1.05!important}'''
new_compact_css = '''      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact{display:grid!important;gap:0!important;min-width:0!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact-line{font-size:8.5px!important;line-height:1!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-compact-sub{color:#9fb4a3!important;font-size:6.5px!important;line-height:1!important}'''
if old_compact_css not in text:
    raise SystemExit('Compact text CSS anchor not found')
text = text.replace(old_compact_css, new_compact_css, 1)

old_details_css = '      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-details{display:none!important;gap:1px!important;margin-top:3px!important;padding-top:3px!important;border-top:1px solid #315d39!important}'
new_details_css = '      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-details{display:none!important;gap:1px!important;margin-top:2px!important;padding-top:2px!important;border-top:1px solid #315d39!important}'
if old_details_css not in text:
    raise SystemExit('Expanded details CSS anchor not found')
text = text.replace(old_details_css, new_details_css, 1)

start = text.index('  function pricedTradeCompactBadgeHtml(')
end = text.index('\n\n\n  function pricedTradeRowDecisionClasses()', start)
new_function = '''  function pricedTradeCompactBadgeHtml(projection, bestMatch, currentTrader, currentQuote) {
    const trackedQuantity = Math.max(0, Math.floor(Number(projection?.trackedQuantity) || 0));
    const requestedQuantity = Math.max(1, Math.floor(Number(projection?.requestedQuantity) || 1));
    const knownCost = trackedQuantity > 0 && Number.isFinite(Number(projection?.profitEach));
    let primary = `? COST UNKNOWN · ${formatMoney(currentQuote?.unitPrice || 0)} ea`;
    let secondary = 'tap for details';
    if (knownCost) {
      const status = Number(projection.profit) > 0 ? 'profit' : Number(projection.profit) < 0 ? 'loss' : 'even';
      const icon = projection.fullCoverage ? (status === 'profit' ? '✓' : status === 'loss' ? '✕' : '≈') : '⚠';
      const total = status === 'profit'
        ? `+${formatMoney(Math.abs(projection.profit))}`
        : status === 'loss'
          ? `-${formatMoney(Math.abs(projection.profit))}`
          : 'BREAK EVEN';
      const costBasis = Number(projection.costBasis);
      const roiPercent = costBasis > 0 && Number.isFinite(Number(projection.profit))
        ? Number(projection.profit) / costBasis * 100
        : null;
      const normalizedRoi = roiPercent !== null && Math.abs(roiPercent) < 0.05 ? 0 : roiPercent;
      const roiLabel = normalizedRoi === null
        ? 'ROI —'
        : `${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(normalizedRoi)}% ROI`;
      primary = `${icon} ${total} · ${roiLabel}`;
      if (!projection.fullCoverage) {
        secondary = `${formatInteger(trackedQuantity)}/${formatInteger(requestedQuantity)} tracked`;
      }
    }

    if (bestMatch?.trader && bestMatch?.quote && currentTrader && currentQuote) {
      const stale = bestMatch.comparisonFreshness !== 'fresh';
      if (bestMatch.trader.id === currentTrader.id) {
        const topLabel = stale ? 'STALE TOP' : 'TOP PRICE';
        secondary = projection?.fullCoverage ? topLabel : `${secondary} · ${topLabel}`;
      } else if (trackedQuantity > 0) {
        const gainTotal = Math.max(0, Number(bestMatch.quote.unitPrice) - Number(currentQuote.unitPrice)) * trackedQuantity;
        const bestLabel = `${stale ? 'STALE BEST' : 'BEST'} +${formatMoney(gainTotal)} more`;
        secondary = projection?.fullCoverage ? bestLabel : `${secondary} · ${bestLabel}`;
      } else {
        secondary = `${stale ? 'STALE BEST' : 'BEST'} ${formatMoney(bestMatch.quote.unitPrice)} ea`;
      }
    }

    return `<span class="tsimm-priced-trade-compact"><strong class="tsimm-priced-trade-compact-line">${escapeHtml(primary)}</strong><span class="tsimm-priced-trade-compact-sub">${escapeHtml(secondary)}</span></span>`;
  }'''
text = text[:start] + new_function + text[end:]

old_missing = '''      badgeHtml = `<span class="tsimm-priced-trade-compact"><strong class="tsimm-priced-trade-compact-line">? NO CAPTURED PRICE</strong><span class="tsimm-priced-trade-compact-sub">${escapeHtml(trader.name)} · tap for details</span></span>`'''
new_missing = '''      badgeHtml = `<span class="tsimm-priced-trade-compact"><strong class="tsimm-priced-trade-compact-line">? NO PRICE</strong><span class="tsimm-priced-trade-compact-sub">tap for details</span></span>`'''
if old_missing not in text:
    raise SystemExit('Missing-price compact badge anchor not found')
text = text.replace(old_missing, new_missing, 1)

if text == original:
    raise SystemExit('No changes applied')
path.write_text(text, encoding='utf-8')
print('Applied IMM v0.19.12 visual cleanup')
