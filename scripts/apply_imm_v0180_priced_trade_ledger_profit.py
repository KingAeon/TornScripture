from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '@version      0.17.6' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.17.6 as patch base')

text = text.replace('0.17.6', '0.18.0')
text = text.replace('TornPDA image-row payout badges', 'ledger-aware TornPDA payout badges')


def replace_function_block(source, start_name, next_name, replacement):
    start_marker = f'  function {start_name}'
    next_marker = f'  function {next_name}'
    start = source.find(start_marker)
    if start < 0:
        raise SystemExit(f'Could not find {start_name}')
    end = source.find(next_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f'Could not find function after {start_name}: {next_name}')
    return source[:start] + replacement.rstrip() + '\n\n' + source[end:]


css_anchor = '      .tsimm-priced-trade-start{border-color:#47c968!important;background:#0d3818!important;color:#d4ffc8!important}'
css_insert = '''      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-ledger{margin-top:1px!important;padding-top:2px!important;border-top:1px solid #315d39!important;color:#b7c0b9!important;font-size:7px!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-ledger.profit{color:#83f19a!important}. ${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-ledger.loss{color:#ff8f9d!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-ledger.even{color:#d8d8d8!important}. ${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-ledger.partial{border-top-color:#9a7830!important}. ${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-ledger.unknown{color:#9aa4aa!important;border-top-color:#566068!important}
'''
# Correct accidental selector spacing after interpolation while keeping the source readable here.
css_insert = css_insert.replace('. ${PRICED_TRADE_BADGE_CLASS}', '.${PRICED_TRADE_BADGE_CLASS}')
if css_anchor not in text:
    raise SystemExit('Could not find priced-trade CSS anchor')
text = text.replace(css_anchor, css_insert + css_anchor, 1)

helper_block = r'''  function pricedTradeLedgerProjection(item, quantity, unitPrice) {
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const matchingLots = (state.ledger.lots || [])
      .filter((lot) => lotMatchesTradeItem(lot, { itemId: item.id, name: item.name }))
      .sort((left, right) => Date.parse(left.capturedAt || '') - Date.parse(right.capturedAt || ''));
    let remaining = requestedQuantity;
    let trackedQuantity = 0;
    let costBasis = 0;
    for (const lot of matchingLots) {
      if (remaining <= 0) break;
      const available = Math.max(0, Math.floor(Number(lot.remainingQuantity) || 0));
      if (!available) continue;
      const allocated = Math.min(remaining, available);
      trackedQuantity += allocated;
      costBasis += allocated * Math.max(0, Number(lot.unitCost) || 0);
      remaining -= allocated;
    }
    const payoutEach = Math.max(0, Number(unitPrice) || 0);
    const proceeds = trackedQuantity * payoutEach;
    const profit = proceeds - costBasis;
    return {
      requestedQuantity,
      trackedQuantity,
      untrackedQuantity: Math.max(0, requestedQuantity - trackedQuantity),
      fullCoverage: trackedQuantity === requestedQuantity,
      costBasis,
      averageCost: trackedQuantity ? costBasis / trackedQuantity : null,
      proceeds,
      profit,
      profitEach: trackedQuantity ? profit / trackedQuantity : null,
    };
  }

  function pricedTradeLedgerHtml(projection) {
    if (!projection?.trackedQuantity) {
      return '<span class="tsimm-priced-trade-ledger unknown">LEDGER COST UNKNOWN · no open lot match</span>';
    }
    const status = projection.profit > 0 ? 'profit' : projection.profit < 0 ? 'loss' : 'even';
    const eachSign = projection.profitEach > 0 ? '+' : projection.profitEach < 0 ? '-' : '';
    const totalSign = projection.profit > 0 ? '+' : projection.profit < 0 ? '-' : '';
    const coverage = projection.fullCoverage
      ? 'LEDGER FULL'
      : `LEDGER ${formatInteger(projection.trackedQuantity)}/${formatInteger(projection.requestedQuantity)} TRACKED`;
    const totalLabel = projection.fullCoverage ? 'STACK' : 'TRACKED';
    return `<span class="tsimm-priced-trade-ledger ${status}${projection.fullCoverage ? '' : ' partial'}">`
      + `${escapeHtml(coverage)} · COST ${escapeHtml(formatMoney(projection.averageCost))} EA · `
      + `${eachSign}${escapeHtml(formatMoney(Math.abs(projection.profitEach)))} EA · `
      + `${totalSign}${escapeHtml(formatMoney(Math.abs(projection.profit)))} ${totalLabel}</span>`;
  }'''

apply_block = r'''  function applyPricedTradeInventoryBadges(stats) {
    clearPricedTradeAnnotations();
    const verification = pricedTradeVerification(stats);
    if (verification.status === 'inactive') return;
    renderPricedTradePanel(verification);
    if (verification.status !== 'verified' || !verification.trader) return;
    injectPricedTradeStyles();
    const trader = verification.trader;
    const seenTokens = new Set();
    let decorated = 0;
    let priced = 0;
    for (const row of pricedTradeCandidateRows(trader)) {
      const item = pricedTradeItemForRow(row, trader);
      if (!item) continue;
      const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
      if (seenTokens.has(token)) continue;
      seenTokens.add(token);
      decorated += 1;
      const quote = tradeExitQuoteForTrader(trader, {
        itemId: item.id,
        name: item.name,
      });
      const quantity = pricedTradeAvailableQuantity(row, item.name);
      const badge = document.createElement('span');
      badge.className = PRICED_TRADE_BADGE_CLASS;
      badge.dataset.tsimmGenerated = 'true';
      row.dataset.tsimmPricedTradeToken = token;
      row.classList.add(PRICED_TRADE_ROW_CLASS);
      if (quote) {
        priced += 1;
        const freshness = quote.freshness || tradeExitFreshness(quote.capturedAt);
        const status = freshness.status === 'fresh' ? 'fresh' : freshness.status;
        row.classList.add(status);
        badge.classList.add(status);
        const resolvedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
        const stack = quote.unitPrice * resolvedQuantity;
        const ledger = pricedTradeLedgerProjection(item, resolvedQuantity, quote.unitPrice);
        badge.innerHTML = `<strong>${escapeHtml(trader.name)} PAYS ${escapeHtml(formatMoney(quote.unitPrice))} EA</strong>`
          + `<span>${escapeHtml(formatInteger(resolvedQuantity))} available · stack ${escapeHtml(formatMoney(stack))} · ${escapeHtml(freshness.ageLabel)}</span>`
          + pricedTradeLedgerHtml(ledger);
      } else {
        row.classList.add('missing');
        badge.classList.add('missing');
        badge.innerHTML = `<strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list</span>`;
      }
      row.appendChild(badge);
    }
    renderPricedTradePanel(verification, decorated, priced);
  }'''

insert_anchor = '  function applyPricedTradeInventoryBadges(stats) {'
if insert_anchor not in text:
    raise SystemExit('Could not find priced-trade badge function')
text = text.replace(insert_anchor, helper_block + '\n\n' + insert_anchor, 1)
text = replace_function_block(text, 'applyPricedTradeInventoryBadges', 'currentTradeTrader', apply_block)

required = [
    '@version      0.18.0',
    "version: '0.18.0'",
    'function pricedTradeLedgerProjection(item, quantity, unitPrice)',
    'function pricedTradeLedgerHtml(projection)',
    'LEDGER COST UNKNOWN',
    'const seenTokens = new Set()',
    'lotMatchesTradeItem',
    'quickMaxOverrideArmed',
    'Outside an explicitly armed Override MAX action',
    'buildTradeExitAudit',
    'sellPriority',
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'Missing protected or new marker: {needle}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.0 priced-trade ledger profit badges')
