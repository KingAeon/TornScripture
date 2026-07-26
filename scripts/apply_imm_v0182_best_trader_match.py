from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')

replacements = [
    ('// @version      0.18.1', '// @version      0.18.2'),
    ('decision-first ledger trade badges', 'decision-first ledger and best-trader trade badges'),
    ("version: '0.18.1'", "version: '0.18.2'"),
    ('ITEM MARKET MARGIN v0.18.1', 'ITEM MARKET MARGIN v0.18.2'),
    ("version: '0.18.1'", "version: '0.18.2'"),
]

# Replace version markers carefully, including the two core markers and APP version.
text = text.replace('// @version      0.18.1', '// @version      0.18.2', 1)
text = text.replace('decision-first ledger trade badges', 'decision-first ledger and best-trader trade badges', 1)
text = text.replace("window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.18.1' });", "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.18.2' });", 1)
text = text.replace("window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.18.1' });", "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.18.2' });", 1)
text = text.replace('ITEM MARKET MARGIN v0.18.1', 'ITEM MARKET MARGIN v0.18.2', 1)
text = text.replace("version: '0.18.1',", "version: '0.18.2',", 1)

css_old = """      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-meta{color:#87948c!important;font-size:7px!important}\n      .${PRICED_TRADE_ROW_CLASS}.decision-profit{box-shadow:inset 3px 0 #47c968!important}.${PRICED_TRADE_ROW_CLASS}.decision-loss{box-shadow:inset 3px 0 #dc5568!important}.${PRICED_TRADE_ROW_CLASS}.decision-even{box-shadow:inset 3px 0 #8a9298!important}.${PRICED_TRADE_ROW_CLASS}.decision-partial{box-shadow:inset 3px 0 #c59a39!important}.${PRICED_TRADE_ROW_CLASS}.decision-unknown{box-shadow:inset 3px 0 #65727a!important}\n"""
css_new = """      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-meta{color:#87948c!important;font-size:7px!important}\n      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best{margin-top:2px!important;padding-top:2px!important;border-top:1px solid #725d21!important;color:#ffd76f!important;font-size:8px!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best.better{color:#8edcff!important;border-top-color:#315f73!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best.stale{color:#d7b66b!important}.${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-best-detail{color:#83b7cc!important;font-size:7px!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}\n      .${PRICED_TRADE_ROW_CLASS}.decision-profit{box-shadow:inset 3px 0 #47c968!important}.${PRICED_TRADE_ROW_CLASS}.decision-loss{box-shadow:inset 3px 0 #dc5568!important}.${PRICED_TRADE_ROW_CLASS}.decision-even{box-shadow:inset 3px 0 #8a9298!important}.${PRICED_TRADE_ROW_CLASS}.decision-partial{box-shadow:inset 3px 0 #c59a39!important}.${PRICED_TRADE_ROW_CLASS}.decision-unknown{box-shadow:inset 3px 0 #65727a!important}\n"""
if css_old not in text:
    raise SystemExit('Could not locate priced-trade CSS insertion point')
text = text.replace(css_old, css_new, 1)

marker = "\n  function applyPricedTradeInventoryBadges(stats) {"
if marker not in text:
    raise SystemExit('Could not locate applyPricedTradeInventoryBadges')
functions = r'''

  function pricedTradeBestTraderQuote(item, currentTrader) {
    if (!item || !currentTrader) return null;
    const favoriteRefs = tradeExitFavoriteRefs();
    const candidates = state.traders.filter((trader) =>
      trader.id === currentTrader.id || tradeExitTraderIsFavorite(trader, favoriteRefs)
    );
    const seen = new Set();
    const quotes = [];
    for (const trader of candidates) {
      if (!trader?.id || seen.has(trader.id)) continue;
      seen.add(trader.id);
      const quote = tradeExitQuoteForTrader(trader, { itemId: item.id, name: item.name });
      if (!quote) continue;
      const freshness = quote.freshness || tradeExitFreshness(quote.capturedAt);
      if (freshness.status === 'missing') continue;
      quotes.push({ trader, quote: { ...quote, freshness } });
    }
    const fresh = quotes.filter((entry) => entry.quote.freshness.status === 'fresh');
    const pool = fresh.length ? fresh : quotes;
    pool.sort((left, right) =>
      Number(right.quote.unitPrice || 0) - Number(left.quote.unitPrice || 0)
      || Number(right.trader.id === currentTrader.id) - Number(left.trader.id === currentTrader.id)
      || Number(left.quote.freshness.ageMs ?? Number.MAX_SAFE_INTEGER) - Number(right.quote.freshness.ageMs ?? Number.MAX_SAFE_INTEGER)
    );
    if (!pool.length) return null;
    return {
      ...pool[0],
      comparisonFreshness: fresh.length ? 'fresh' : 'stale',
    };
  }

  function pricedTradeBestMatchHtml(bestMatch, currentTrader, currentQuote, projection) {
    if (!bestMatch?.trader || !bestMatch?.quote || !currentTrader || !currentQuote) return '';
    const stale = bestMatch.comparisonFreshness !== 'fresh';
    const isCurrent = bestMatch.trader.id === currentTrader.id;
    if (isCurrent) {
      const label = stale ? '⌛ STALE TOP MATCH' : '★ TOP MATCH';
      return `<strong class="tsimm-priced-trade-best${stale ? ' stale' : ''}">${escapeHtml(label)}</strong>`;
    }
    const knownCost = Boolean(projection?.trackedQuantity && Number.isFinite(Number(projection.averageCost)));
    const bestProfitEach = knownCost ? Number(bestMatch.quote.unitPrice) - Number(projection.averageCost) : null;
    const profitLabel = bestProfitEach === null
      ? 'profit unknown'
      : bestProfitEach > 0
        ? `+${formatMoney(bestProfitEach)} EA`
        : bestProfitEach < 0
          ? `-${formatMoney(Math.abs(bestProfitEach))} EA`
          : `${formatMoney(0)} EA`;
    const gainEach = Math.max(0, Number(bestMatch.quote.unitPrice) - Number(currentQuote.unitPrice));
    const prefix = stale ? '⌛ STALE BEST' : '↑ BEST';
    return `<strong class="tsimm-priced-trade-best better${stale ? ' stale' : ''}">${escapeHtml(prefix)}: ${escapeHtml(bestMatch.trader.name)} · ${escapeHtml(profitLabel)}</strong>`
      + `<span class="tsimm-priced-trade-best-detail">+${escapeHtml(formatMoney(gainEach))} ea over this trader</span>`;
  }
'''
text = text.replace(marker, functions + marker, 1)

old_badge = """        badge.innerHTML = pricedTradeLedgerHtml(ledger, quote.unitPrice)\n          + `<span class=\"tsimm-priced-trade-meta\">${escapeHtml(trader.name)} · ${escapeHtml(formatInteger(resolvedQuantity))} available · ${escapeHtml(freshness.ageLabel)}</span>`;\n"""
new_badge = """        const bestMatch = pricedTradeBestTraderQuote(item, trader);\n        badge.innerHTML = pricedTradeLedgerHtml(ledger, quote.unitPrice)\n          + pricedTradeBestMatchHtml(bestMatch, trader, quote, ledger)\n          + `<span class=\"tsimm-priced-trade-meta\">${escapeHtml(trader.name)} · ${escapeHtml(formatInteger(resolvedQuantity))} available · ${escapeHtml(freshness.ageLabel)}</span>`;\n"""
if old_badge not in text:
    raise SystemExit('Could not locate decision-first badge rendering')
text = text.replace(old_badge, new_badge, 1)

path.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.2 best-trader match feature')
