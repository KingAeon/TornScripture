    if (captured) return { id: captured.itemId || null, name: captured.itemName };
    const catalog = Object.values(state.catalog.itemsByName || {})
      .filter((item) => item?.name && haystack.includes(` ${item.normalizedName} `))
      .sort((left, right) => right.normalizedName.length - left.normalizedName.length)[0];
    return catalog ? { id: catalog.id || null, name: catalog.name } : null;
  }

  function pricedTradeAvailableQuantity(row, itemName = '') {
    if (!(row instanceof Element)) return null;
    const limits = [...row.querySelectorAll('input,[role="spinbutton"]')].flatMap((input) => [
      input.getAttribute('max'),
      input.getAttribute('data-max'),
      input.getAttribute('aria-valuemax'),
    ]).map(parseNumber).filter((value) => Number.isFinite(value) && value > 0);
    if (limits.length) return Math.max(1, Math.floor(Math.max(...limits)));
    const text = normalizeWhitespace(row.innerText || row.textContent).replace(itemName, ' ');
    for (const pattern of [
      /\b(?:available|owned|quantity|qty|amount|stock)\D{0,16}([\d,]+)/i,
      /(?:\bx|×)\s*([\d,]+)\b/i,
      /\(([\d,]+)\)/,
    ]) {
      const quantity = parseNumber(text.match(pattern)?.[1]);
      if (Number.isFinite(quantity) && quantity > 0) return Math.max(1, Math.floor(quantity));
    }
    return null;
  }

  function pricedTradeCandidateRows(trader) {
    const rows = new Set();
    const controls = [...document.querySelectorAll('button,a,[role="button"],input,select,label')]
      .filter((control) =>
        visibleElement(control)
        && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)
      );
    for (const control of controls) {
      let node = control;
      for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
        if (!(node instanceof Element) || node === document.body) continue;
        if (node.classList.contains(APP.tradeItemMark) || node.closest(`.${APP.tradeItemMark}`)) break;
        const text = normalizeWhitespace(node.innerText || node.textContent);
        if (!text || text.length > 650) continue;
        const item = pricedTradeItemForRow(node, trader);
        if (!item) continue;
        if (!pricedTradeNativeAddControl(node)) continue;
        rows.add(node);
        break;
      }
    }
    for (const row of document.querySelectorAll('li,[role="option"],[class*="item" i],[class*="inventory" i]')) {
      if (!(row instanceof Element) || !visibleElement(row) || rows.has(row)) continue;
      if (row.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) continue;
      if (row.classList.contains(APP.tradeItemMark) || row.closest(`.${APP.tradeItemMark}`)) continue;
      const text = normalizeWhitespace(row.innerText || row.textContent);
      if (!text || text.length > 650 || !pricedTradeNativeAddControl(row)) continue;
      if (pricedTradeItemForRow(row, trader)) rows.add(row);
    }
    return [...rows];
  }

  function renderPricedTradePanel(verification, decorated = 0, priced = 0) {
    injectPricedTradeStyles();
    let panel = document.getElementById(PRICED_TRADE_PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PRICED_TRADE_PANEL_ID;
      panel.dataset.tsimmGenerated = 'true';
      document.body.appendChild(panel);
    }
    panel.className = verification.status;
    const trader = verification.trader;
    const count = trader?.pricePageItems?.length || 0;
    const capturedAt = trader?.pricePageLastCheckedAt || trader?.pricePageCapturedAt || null;
    const freshness = tradeExitFreshness(capturedAt);
    const title = verification.status === 'verified'
      ? `🤝 PRICED TRADE · ${trader.name}`
      : verification.status === 'waiting'
        ? `⌛ PRICED TRADE ARMED · ${trader?.name || verification.session?.traderName || 'Trader'}`
        : verification.status === 'mismatch'
          ? `⚠ PRICED TRADE MISMATCH`
          : `⚠ PRICED TRADE TRADER MISSING`;
    const detail = verification.status === 'verified'
      ? `${formatInteger(priced)}/${formatInteger(decorated)} visible addable items priced · ${formatInteger(count)} captured prices · ${freshness.ageLabel}`
      : verification.status === 'waiting'
        ? `${formatInteger(count)} captured prices ready · waiting for Torn to identify the other participant`
        : verification.status === 'mismatch'
          ? `Armed for ${trader?.name || verification.session?.traderName}; this trade is with ${verification.currentTrader?.name || 'someone else'}. No prices were applied.`
          : 'The armed trader is no longer present in Trader Book. No prices were applied.';
    panel.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span><button type="button" data-tsimm-action="priced-trade-clear">CLEAR</button>`;
  }

  function applyPricedTradeInventoryBadges(stats) {
    clearPricedTradeAnnotations();
