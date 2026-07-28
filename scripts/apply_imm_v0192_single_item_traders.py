from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    text = text.replace(old, new, 1)


replace_once('// @version      0.19.1', '// @version      0.19.2', 'metadata version')
replace_once(
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, loop-safe Priced Trade badges, startup-safe classified trader controls, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    '// @description  Item-market and overseas profit overlays with Quick MAX, single-item trader exits, curated watchlists, market-velocity learning, loop-safe Priced Trade badges, classified trader controls, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    'metadata description',
)
version_token = "version: '0.19.1'"
if text.count(version_token) != 3:
    raise SystemExit(f'runtime version: expected three tokens, found {text.count(version_token)}')
text = text.replace(version_token, "version: '0.19.2'")
replace_once('ITEM MARKET MARGIN v0.19.1', 'ITEM MARKET MARGIN v0.19.2', 'comment version')

replace_once(
    '    minimumRoiPercent: 0.25,\n',
    '    minimumRoiPercent: 0.25,\n    itemTraderQuoteLimit: 3,\n',
    'quote limit setting',
)

replace_once(
    '      listingItemId: null,\n      listingItemName: null,\n      tradeSideCandidates: 0,\n',
    '      listingItemId: null,\n      listingItemName: null,\n      listingLowestPrice: null,\n      listingLowestQuantity: null,\n      tradeSideCandidates: 0,\n',
    'listing stats',
)

replace_once(
    '    stats.listingCandidates = candidates.length;\n    if (!candidates.length) return;\n\n    for (const candidate of candidates) decorateQuickMaxCandidate(candidate, scanToken);\n',
    '    stats.listingCandidates = candidates.length;\n    if (!candidates.length) return;\n\n    const lowestListing = [...candidates].sort((left, right) => Number(left.price) - Number(right.price))[0] || null;\n    stats.listingLowestPrice = Number(lowestListing?.price) > 0 ? Number(lowestListing.price) : null;\n    stats.listingLowestQuantity = Number(lowestListing?.quantity) > 0 ? Number(lowestListing.quantity) : null;\n\n    for (const candidate of candidates) decorateQuickMaxCandidate(candidate, scanToken);\n',
    'lowest listing capture',
)

helper_block = r'''

  function singleItemTraderQuotes(stats = state.lastScan) {
    if (!String(stats?.pageType || '').startsWith('item listings')) return [];
    const itemId = Number(stats?.listingItemId) > 0 ? Number(stats.listingItemId) : null;
    const itemName = normalizeWhitespace(stats?.listingItemName);
    if (!itemId && !itemName) return [];
    const currentPrice = Number(stats?.listingLowestPrice) > 0 ? Number(stats.listingLowestPrice) : null;
    const favoriteRefs = tradeExitFavoriteRefs();
    const freshnessRank = { fresh: 0, stale: 1, outdated: 2, missing: 3 };
    return state.traders
      .filter(traderRecommendationsEligible)
      .map((trader) => {
        const quote = tradeExitQuoteForTrader(trader, { itemId, itemName, name: itemName });
        if (!quote) return null;
        const profitEach = currentPrice === null ? null : Number(quote.unitPrice) - currentPrice;
        const roiPercent = currentPrice && profitEach !== null ? profitEach / currentPrice * 100 : null;
        return {
          ...quote,
          trader,
          favorite: tradeExitTraderIsFavorite(trader, favoriteRefs),
          profitEach,
          roiPercent,
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        Number(freshnessRank[left.freshness?.status] ?? 9) - Number(freshnessRank[right.freshness?.status] ?? 9)
        || Number(right.unitPrice) - Number(left.unitPrice)
        || Number(right.favorite) - Number(left.favorite)
        || String(left.traderName || '').localeCompare(String(right.traderName || ''))
      );
  }

  function singleItemTraderQuotesHtml(stats = state.lastScan) {
    if (!String(stats?.pageType || '').startsWith('item listings')) return '';
    const itemName = normalizeWhitespace(stats?.listingItemName) || 'this item';
    const currentPrice = Number(stats?.listingLowestPrice) > 0 ? Number(stats.listingLowestPrice) : null;
    const quotes = singleItemTraderQuotes(stats);
    const limit = Number(state.settings.itemTraderQuoteLimit) === 5 ? 5 : 3;
    const visible = quotes.slice(0, limit);
    const rows = visible.map((quote, index) => {
      const freshness = quote.freshness?.status || 'missing';
      const profitKnown = Number.isFinite(quote.profitEach);
      const profitClass = !profitKnown ? '' : quote.profitEach >= 0 ? 'profit' : 'loss';
      const profitText = profitKnown
        ? `${quote.profitEach >= 0 ? '+' : ''}${formatMoney(quote.profitEach)} · ${formatPercent(quote.roiPercent)}`
        : 'Open listing price unresolved';
      const links = [
        quote.trader?.tradeUrl ? `<a href="${escapeHtml(quote.trader.tradeUrl)}">Trade</a>` : '',
        quote.trader?.pricePageUrl ? `<a href="${escapeHtml(quote.trader.pricePageUrl)}">Prices</a>` : '',
        quote.trader?.profileUrl ? `<a href="${escapeHtml(quote.trader.profileUrl)}">Profile</a>` : '',
      ].filter(Boolean).join('');
      return `<div class="tsimm-item-trader-row ${escapeHtml(freshness)}">
        <div class="tsimm-item-trader-name"><strong>#${index + 1} ${quote.favorite ? '★ ' : ''}${escapeHtml(quote.traderName)}</strong><span>${escapeHtml(quote.freshness?.ageLabel || 'unknown age')} · ${escapeHtml(freshness)}</span></div>
        <div class="tsimm-item-trader-money"><strong>${escapeHtml(formatMoney(quote.unitPrice))}</strong><span class="${escapeHtml(profitClass)}">${escapeHtml(profitText)}</span></div>
        ${links ? `<div class="tsimm-item-trader-links">${links}</div>` : ''}
      </div>`;
    }).join('');
    const toggle = quotes.length > 3
      ? `<button type="button" data-tsimm-action="item-trader-quotes-toggle">${limit === 5 ? 'Show top 3' : `Show top ${Math.min(5, quotes.length)}`}</button>`
      : '';
    const subtitle = currentPrice === null
      ? `${escapeHtml(itemName)} · current listing unresolved`
      : `${escapeHtml(itemName)} · lowest visible ${escapeHtml(formatMoney(currentPrice))}`;
    const empty = '<div class="tsimm-item-trader-empty">No active trader has a captured price for this item yet.</div>';
    return `<section class="tsimm-item-trader-card">
      <div class="tsimm-item-trader-head"><div><strong>🤝 Best trader exits</strong><span>${subtitle}</span></div>${toggle}</div>
      <div class="tsimm-item-trader-list">${rows || empty}</div>
    </section>`;
  }
'''
replace_once(
    '  function loadPricedTradeSession() {\n',
    helper_block + '\n  function loadPricedTradeSession() {\n',
    'single-item quote helpers',
)

replace_once(
    '        ${pendingTraderCaptureHtml()}\n        ${overseasSummaryHtml(stats)}\n',
    '        ${pendingTraderCaptureHtml()}\n        ${singleItemTraderQuotesHtml(stats)}\n        ${overseasSummaryHtml(stats)}\n',
    'quote card render',
)

replace_once(
    "      if (action === 'toggle') {\n        updateSetting('collapsed', !state.settings.collapsed);\n      } else if (action === 'sync') {\n",
    "      if (action === 'toggle') {\n        updateSetting('collapsed', !state.settings.collapsed);\n      } else if (action === 'item-trader-quotes-toggle') {\n        updateSetting('itemTraderQuoteLimit', Number(state.settings.itemTraderQuoteLimit) === 5 ? 3 : 5);\n      } else if (action === 'sync') {\n",
    'quote toggle action',
)

quote_css = r'''      .tsimm-item-trader-card{margin:8px 0;padding:8px;border:1px solid #5a4b70;border-radius:9px;background:#221d2a}.tsimm-item-trader-head{display:flex;align-items:flex-start;justify-content:space-between;gap:7px;margin-bottom:6px}.tsimm-item-trader-head>div{min-width:0}.tsimm-item-trader-head strong{display:block;color:#e7d7ff;font-size:12px}.tsimm-item-trader-head span{display:block;color:#aaa1b7;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-item-trader-head button{flex:0 0 auto;border:1px solid #76618f;border-radius:6px;background:#342942;color:#eee4f8;padding:4px 6px;font:800 9px/1 Arial,sans-serif}.tsimm-item-trader-list{display:grid;gap:5px}.tsimm-item-trader-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 7px;padding:6px;border:1px solid #46404f;border-radius:7px;background:#19171e}.tsimm-item-trader-row.stale{border-color:#74642f}.tsimm-item-trader-row.outdated{border-color:#714049;opacity:.82}.tsimm-item-trader-name,.tsimm-item-trader-money{min-width:0}.tsimm-item-trader-name strong,.tsimm-item-trader-money strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-item-trader-name span,.tsimm-item-trader-money span{display:block;color:#aaa1b7;font-size:9px}.tsimm-item-trader-money{text-align:right}.tsimm-item-trader-money .profit{color:#63df9f}.tsimm-item-trader-money .loss{color:#ff7c85}.tsimm-item-trader-links{grid-column:1/-1;display:flex;gap:4px}.tsimm-item-trader-links a{flex:1;border:1px solid #554c62;border-radius:5px;background:#2c2733;color:#f2edf7;padding:3px 5px;text-align:center;text-decoration:none;font-size:9px;font-weight:800}.tsimm-item-trader-empty{padding:7px;border:1px dashed #51485d;border-radius:7px;color:#aaa1b7;text-align:center;font-size:10px}
'''
replace_once(
    '      .tsimm-overseas-card{',
    quote_css + '      .tsimm-overseas-card{',
    'quote card styles',
)

path.write_text(text)
