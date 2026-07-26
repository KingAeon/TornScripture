    const verification = pricedTradeVerification(stats);
    if (verification.status === 'inactive') return;
    renderPricedTradePanel(verification);
    if (verification.status !== 'verified' || !verification.trader) return;
    injectPricedTradeStyles();
    const trader = verification.trader;
    let decorated = 0;
    let priced = 0;
    for (const row of pricedTradeCandidateRows(trader)) {
      const item = pricedTradeItemForRow(row, trader);
      if (!item) continue;
      decorated += 1;
      const quote = tradeExitQuoteForTrader(trader, {
        itemId: item.id,
        name: item.name,
      });
      const quantity = pricedTradeAvailableQuantity(row, item.name);
      const badge = document.createElement('span');
      badge.className = PRICED_TRADE_BADGE_CLASS;
      badge.dataset.tsimmGenerated = 'true';
      const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
      row.dataset.tsimmPricedTradeToken = token;
      row.classList.add(PRICED_TRADE_ROW_CLASS);
      if (quote) {
        priced += 1;
        const freshness = quote.freshness || tradeExitFreshness(quote.capturedAt);
        const status = freshness.status === 'fresh' ? 'fresh' : freshness.status;
        row.classList.add(status);
        badge.classList.add(status);
        const stack = quantity ? quote.unitPrice * quantity : null;
        badge.innerHTML = `<strong>${escapeHtml(trader.name)} PAYS ${escapeHtml(formatMoney(quote.unitPrice))} EA</strong>`
          + `<span>${quantity ? `${escapeHtml(formatInteger(quantity))} available · stack ${escapeHtml(formatMoney(stack))}` : 'available quantity unresolved'} · ${escapeHtml(freshness.ageLabel)}</span>`;
      } else {
        row.classList.add('missing');
        badge.classList.add('missing');
        badge.innerHTML = `<strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list</span>`;
      }
      row.appendChild(badge);
    }
    renderPricedTradePanel(verification, decorated, priced);
  }
"""

replace_once(
    """  function currentTradeTrader(stats) {""",
    priced_trade_functions + "\n  function currentTradeTrader(stats) {",
    "priced trade functions",
)

replace_once(
    """  function clearTradeAnnotations() {
    document.querySelectorAll(`.${APP.tradeBadgeClass}`).forEach((element) => element.remove());""",
    """  function clearTradeAnnotations() {
    clearPricedTradeAnnotations();
    document.querySelectorAll(`.${APP.tradeBadgeClass}`).forEach((element) => element.remove());""",
    "clear trade annotations",
)

replace_once(
    """    applyTradeExitAuditBadges(matched, stats.tradeExitAudit);
    applyTradeExitMainPageAlert(mySide, stats.tradeExitAudit);
""",
    """    applyTradeExitAuditBadges(matched, stats.tradeExitAudit);
    applyTradeExitMainPageAlert(mySide, stats.tradeExitAudit);
    applyPricedTradeInventoryBadges(stats);
""",
    "scan trade decoration",
)

if text == original:
    raise SystemExit("No changes were applied")

path.write_text(text, encoding="utf-8")
print("Applied GOBLIN GOD v0.17.0 priced-trade inventory badges")
