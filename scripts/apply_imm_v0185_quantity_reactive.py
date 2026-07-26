from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '// @version      0.18.4' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.18.4 as patch base')

text = text.replace('0.18.4', '0.18.5')
text = text.replace(
    'persistent auto-repainting decision-first',
    'persistent auto-repainting quantity-reactive decision-first',
)


def replace_function(source: str, name: str, replacement: str) -> str:
    marker = f'  function {name}('
    start = source.find(marker)
    if start < 0:
        raise SystemExit(f'Function not found: {name}')
    end = source.find('\n  function ', start + len(marker))
    if end < 0:
        raise SystemExit(f'Could not find end of function: {name}')
    return source[:start] + replacement.rstrip() + '\n' + source[end:]


quantity_replacement = r'''
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
    const singleControl = [...row.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .find((control) => visibleElement(control) && !control.disabled);
    if (singleControl) return 1;
    if ([...row.querySelectorAll('img')].some((image) => visibleElement(image))) return 1;
    return null;
  }

  function pricedTradeSelectedQuantity(row) {
    if (!(row instanceof Element)) return { selected: false, quantity: 0, source: '' };
    const singleControl = [...row.querySelectorAll('input[type="checkbox"],input[type="radio"]')]
      .find((control) => visibleElement(control) && !control.disabled);
    if (singleControl) {
      return {
        selected: Boolean(singleControl.checked),
        quantity: singleControl.checked ? 1 : 0,
        source: 'single-control',
      };
    }

    const selector = [
      'input:not([type="checkbox"]):not([type="radio"])',
      'select',
      '[role="spinbutton"]',
      '[contenteditable="true"]',
      '[class*="qty" i]',
      '[class*="quantity" i]',
      '[aria-label*="qty" i]',
      '[aria-label*="quantity" i]',
      '[title*="qty" i]',
      '[title*="quantity" i]',
      '[data-qty]',
      '[data-quantity]',
    ].join(',');
    const controls = [...new Set([
      ...row.querySelectorAll(selector),
      ...pricedTradeDirectQtyElements(row),
    ])].filter((control) =>
      visibleElement(control)
      && !control.disabled
      && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)
    );

    for (const control of controls) {
      const role = String(control.getAttribute?.('role') || '').toLowerCase();
      const label = pricedTradeControlLabel(control);
      const inputLike = control instanceof HTMLInputElement
        || control instanceof HTMLSelectElement
        || role === 'spinbutton'
        || control.getAttribute?.('contenteditable') === 'true';
      const quantityHint = inputLike
        || /\b(?:qty|quantity|amount)\b/i.test(label)
        || /(?:qty|quantity|amount)/i.test(String(control.className || ''));
      if (!quantityHint) continue;
      const values = [
        control.value,
        control.getAttribute?.('aria-valuenow'),
        control.getAttribute?.('data-selected-quantity'),
        control.getAttribute?.('data-current-quantity'),
        control.getAttribute?.('data-qty'),
        control.getAttribute?.('data-quantity'),
        ownText(control),
        control.textContent,
      ];
      for (const candidate of values) {
        const raw = normalizeWhitespace(candidate);
        if (!/^[\d,]+$/.test(raw)) continue;
        const quantity = parseNumber(raw);
        if (Number.isFinite(quantity) && quantity > 0) {
          return { selected: true, quantity: Math.max(1, Math.floor(quantity)), source: 'quantity-control' };
        }
      }
    }
    return { selected: false, quantity: 0, source: '' };
  }

  function pricedTradeQuantityDecision(row, itemName = '') {
    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, itemName)) || 1));
    const selection = pricedTradeSelectedQuantity(row);
    const selectedQuantity = selection.selected
      ? Math.max(1, Math.min(availableQuantity, Math.floor(Number(selection.quantity) || 1)))
      : 0;
    return {
      availableQuantity,
      selectedQuantity,
      quantity: selectedQuantity || availableQuantity,
      selected: selectedQuantity > 0,
      mode: selectedQuantity > 0 ? 'selected' : 'preview',
      source: selection.source,
    };
  }
'''
text = replace_function(text, 'pricedTradeAvailableQuantity', quantity_replacement)

ledger_projection_replacement = r'''
  function pricedTradeLedgerProjection(item, quantity, unitPrice) {
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const matchingLots = (state.ledger.lots || [])
      .filter((lot) => lotMatchesTradeItem(lot, { itemId: item.id, name: item.name }))
      .sort((left, right) => Date.parse(left.capturedAt || '') - Date.parse(right.capturedAt || ''));
    let remaining = requestedQuantity;
    let trackedQuantity = 0;
    let costBasis = 0;
    let lotsUsed = 0;
    for (const lot of matchingLots) {
      if (remaining <= 0) break;
      const available = Math.max(0, Math.floor(Number(lot.remainingQuantity) || 0));
      if (!available) continue;
      const allocated = Math.min(remaining, available);
      if (allocated <= 0) continue;
      lotsUsed += 1;
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
      lotsUsed,
      costBasis,
      averageCost: trackedQuantity ? costBasis / trackedQuantity : null,
      proceeds,
      profit,
      profitEach: trackedQuantity ? profit / trackedQuantity : null,
    };
  }
'''
text = replace_function(text, 'pricedTradeLedgerProjection', ledger_projection_replacement)

ledger_html_replacement = r'''
  function pricedTradeLedgerHtml(projection, unitPrice) {
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
    const lotDetail = Number(projection.lotsUsed) > 1
      ? ` · ${formatInteger(projection.lotsUsed)} lots blended`
      : Number(projection.lotsUsed) === 1 ? ' · 1 lot' : '';
    return `<strong class="tsimm-priced-trade-verdict ${status}${projection.fullCoverage ? '' : ' partial'}">${escapeHtml(headline)}</strong>`
      + `<span class="tsimm-priced-trade-comparison">cost ${escapeHtml(formatMoney(projection.averageCost))} → pays ${escapeHtml(formatMoney(payoutEach))} · ${escapeHtml(coverage + lotDetail)}</span>`;
  }
'''
text = replace_function(text, 'pricedTradeLedgerHtml', ledger_html_replacement)

apply_replacement = r'''
  function applyPricedTradeInventoryBadges(stats) {
    clearPricedTradeAnnotations();
    syncPricedTradePickerObserver();
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
      const quantityDecision = pricedTradeQuantityDecision(row, item.name);
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
        badge.classList.add(status, quantityDecision.selected ? 'quantity-selected' : 'quantity-preview');
        const resolvedQuantity = Math.max(1, Math.floor(Number(quantityDecision.quantity) || 1));
        const ledger = pricedTradeLedgerProjection(item, resolvedQuantity, quote.unitPrice);
        const ledgerState = !ledger.trackedQuantity
          ? 'unknown'
          : ledger.profit > 0 ? 'profit' : ledger.profit < 0 ? 'loss' : 'even';
        const decisionState = ledger.trackedQuantity && !ledger.fullCoverage ? 'partial' : ledgerState;
        row.classList.add(`decision-${decisionState}`);
        badge.classList.add(`ledger-${ledgerState}`);
        if (ledger.trackedQuantity && !ledger.fullCoverage) badge.classList.add('ledger-partial');
        const bestMatch = pricedTradeBestTraderQuote(item, trader);
        const quantityLabel = quantityDecision.selected
          ? `${formatInteger(resolvedQuantity)} SELECTED`
          : `${formatInteger(resolvedQuantity)} AVAILABLE PREVIEW`;
        badge.innerHTML = pricedTradeLedgerHtml(ledger, quote.unitPrice)
          + pricedTradeBestMatchHtml(bestMatch, trader, quote, ledger)
          + `<span class="tsimm-priced-trade-meta">${escapeHtml(quantityLabel)} · ${escapeHtml(trader.name)} · ${escapeHtml(freshness.ageLabel)}</span>`;
      } else {
        row.classList.add('missing');
        badge.classList.add('missing');
        badge.innerHTML = `<strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list</span>`;
      }
      row.appendChild(badge);
    }
    renderPricedTradePanel(verification, decorated, priced);
    syncPricedTradePickerObserver();
  }
'''
text = replace_function(text, 'applyPricedTradeInventoryBadges', apply_replacement)

meta_css = ".${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-meta{color:#87948c!important;font-size:7px!important}"
if meta_css not in text:
    raise SystemExit('Could not locate Priced Trade meta CSS')
text = text.replace(
    meta_css,
    meta_css
    + ".${PRICED_TRADE_BADGE_CLASS}.quantity-selected .tsimm-priced-trade-meta{color:#9eefff!important;font-weight:900!important}"
    + ".${PRICED_TRADE_BADGE_CLASS}.quantity-preview .tsimm-priced-trade-meta{color:#87948c!important}",
    1,
)

click_listener = "document.addEventListener('click', capturePricedTradePickerInteraction, true);"
if click_listener not in text:
    raise SystemExit('Could not locate Priced Trade click listener')
for event_name in ('input', 'change'):
    listener = f"document.addEventListener('{event_name}', capturePricedTradePickerInteraction, true);"
    if listener not in text:
        text = text.replace(click_listener, click_listener + '\n    ' + listener, 1)

required = [
    '// @version      0.18.5',
    'pricedTradeSelectedQuantity',
    'pricedTradeQuantityDecision',
    'AVAILABLE PREVIEW',
    'SELECTED',
    'lotsUsed',
    'lots blended',
    "document.addEventListener('input', capturePricedTradePickerInteraction, true);",
    "document.addEventListener('change', capturePricedTradePickerInteraction, true);",
    'pricedTradePickerObserver.observe(document.body',
    'quickMaxOverrideArmed',
    'buildTradeExitAudit',
    'pricedTradeBestTraderQuote',
    'inventoryBaseline',
    'sellPriority',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit(f'Missing required tokens after patch: {missing}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.5 quantity-reactive FIFO trade badges')
