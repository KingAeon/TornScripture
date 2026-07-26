from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')

if '// @version      0.18.5' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.18.5 as patch base')

text = text.replace('0.18.5', '0.18.6')
text = text.replace(
    'persistent auto-repainting quantity-reactive decision-first',
    'scroll-stable in-place quantity-reactive decision-first',
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


declaration_anchor = "  let pricedTradeRepaintSettleTimer = null;"
declaration_replacement = """  let pricedTradeRepaintSettleTimer = null;
  let pricedTradeQuantityTimer = null;
  let pricedTradePendingQuantityRow = null;
  let pricedTradeLastInteractedRow = null;"""
if declaration_anchor not in text:
    raise SystemExit('Could not locate Priced Trade timer declarations')
text = text.replace(declaration_anchor, declaration_replacement, 1)

clear_session = r'''
  function clearPricedTradeSession(message = '') {
    savePricedTradeSession(null);
    clearTimeout(pricedTradeRepaintSettleTimer);
    clearTimeout(pricedTradeQuantityTimer);
    pricedTradeRepaintSettleTimer = null;
    pricedTradeQuantityTimer = null;
    pricedTradePendingQuantityRow = null;
    pricedTradeLastInteractedRow = null;
    clearPricedTradeAnnotations();
    syncPricedTradePickerObserver();
    if (message) toast(message);
  }
'''
text = replace_function(text, 'clearPricedTradeSession', clear_session)

clear_annotations = r'''
  function clearPricedTradeAnnotations() {
    document.getElementById(PRICED_TRADE_PANEL_ID)?.remove();
    clearPricedTradeRowAnnotations();
  }
'''
text = replace_function(text, 'clearPricedTradeAnnotations', clear_annotations)

sync_observer = r'''
  function pricedTradeMutationRows(mutation) {
    const rows = new Set();
    const nodes = [
      mutation.target,
      ...(mutation.addedNodes || []),
    ];
    for (const node of nodes) {
      const element = pricedTradeMutationElement(node);
      if (!element || pricedTradeGeneratedMutationNode(element)) continue;
      const row = element.matches?.(`.${PRICED_TRADE_ROW_CLASS}`)
        ? element
        : element.closest?.(`.${PRICED_TRADE_ROW_CLASS}`);
      if (row instanceof Element && row.isConnected) rows.add(row);
    }
    return [...rows];
  }

  function syncPricedTradePickerObserver() {
    const session = loadPricedTradeSession();
    if (!session || !document.body) {
      pricedTradePickerObserver?.disconnect();
      pricedTradePickerObserver = null;
      pricedTradeObservedSurface = null;
      return;
    }

    const currentSurface = pricedTradeInventorySurface();
    if (currentSurface instanceof Element) pricedTradeObservedSurface = currentSurface;
    if (pricedTradePickerObserver) return;

    pricedTradePickerObserver = new MutationObserver((mutations) => {
      if (!loadPricedTradeSession()) {
        syncPricedTradePickerObserver();
        return;
      }
      const previousSurface = pricedTradeObservedSurface;
      const resolvedSurface = pricedTradeInventorySurface();
      const nextSurface = resolvedSurface instanceof Element ? resolvedSurface : null;
      if (nextSurface && nextSurface !== previousSurface) {
        pricedTradeObservedSurface = nextSurface;
        schedulePricedTradePickerRepaint(45);
        return;
      }

      const rowUpdates = new Set();
      let needsFullRepaint = false;
      for (const mutation of mutations) {
        if (!pricedTradeMutationNeedsRepaint(mutation)) continue;
        const rows = pricedTradeMutationRows(mutation);
        if (rows.length) {
          rows.forEach((row) => rowUpdates.add(row));
          continue;
        }
        if (pricedTradeMutationTouchesPicker(mutation, nextSurface, previousSurface)) {
          needsFullRepaint = true;
          break;
        }
      }
      if (needsFullRepaint) {
        schedulePricedTradePickerRepaint(70);
        return;
      }
      rowUpdates.forEach((row) => schedulePricedTradeRowRefresh(row, 100));
    });
    pricedTradePickerObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
'''
text = replace_function(text, 'syncPricedTradePickerObserver', sync_observer)

capture_interaction = r'''
  function capturePricedTradePickerInteraction(event) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return;
    const picker = pricedTradePickerEvidence();
    const previousSurface = pricedTradeObservedSurface;
    const insidePrevious = previousSurface instanceof Element
      && previousSurface.isConnected
      && previousSurface.contains(target);
    if (!picker.active && !insidePrevious) return;

    const trader = pricedTradeArmedTrader();
    const row = trader
      ? (target.closest(`.${PRICED_TRADE_ROW_CLASS}`) || pricedTradeRowForControl(target, trader))
      : null;
    if (row instanceof Element && row.isConnected) {
      pricedTradeLastInteractedRow = row;
      schedulePricedTradeRowRefresh(row, 90);
      return;
    }
    schedulePricedTradePickerRepaint(80);
  }
'''
text = replace_function(text, 'capturePricedTradePickerInteraction', capture_interaction)

render_block = r'''
  function pricedTradeRowDecisionClasses() {
    return [
      'fresh', 'stale', 'outdated', 'missing',
      'decision-profit', 'decision-loss', 'decision-even', 'decision-partial', 'decision-unknown',
    ];
  }

  function pricedTradeRemoveRowAnnotation(row) {
    if (!(row instanceof Element)) return;
    row.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS}`).forEach((badge) => badge.remove());
    row.classList.remove(PRICED_TRADE_ROW_CLASS, ...pricedTradeRowDecisionClasses());
    delete row.dataset.tsimmPricedTradeToken;
  }

  function clearPricedTradeRowAnnotations() {
    document.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`).forEach(pricedTradeRemoveRowAnnotation);
    document.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS}`).forEach((badge) => badge.remove());
  }

  function pricedTradeCaptureScrollAnchor(surface = pricedTradeInventorySurface()) {
    const activeRow = document.activeElement instanceof Element
      ? document.activeElement.closest(`.${PRICED_TRADE_ROW_CLASS}`)
      : null;
    const rows = surface instanceof Element
      ? [...surface.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`)]
      : [];
    const row = activeRow?.isConnected
      ? activeRow
      : rows.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight;
        });
    if (!(row instanceof Element) || !row.isConnected) return null;
    return { row, top: row.getBoundingClientRect().top };
  }

  function pricedTradeRestoreScrollAnchor(anchor) {
    if (!anchor?.row?.isConnected) return;
    const delta = anchor.row.getBoundingClientRect().top - Number(anchor.top || 0);
    if (Number.isFinite(delta) && Math.abs(delta) > 0.5) window.scrollBy(0, delta);
  }

  function pricedTradeRenderRowBadge(row, trader, resolvedItem = null) {
    if (!(row instanceof Element) || !row.isConnected || !trader) return null;
    const item = resolvedItem || pricedTradeItemForRow(row, trader);
    if (!item) return null;
    const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
    const quote = tradeExitQuoteForTrader(trader, { itemId: item.id, name: item.name });
    const quantityDecision = pricedTradeQuantityDecision(row, item.name);
    let badge = [...row.children].find((child) => child.classList?.contains(PRICED_TRADE_BADGE_CLASS))
      || row.querySelector(`.${PRICED_TRADE_BADGE_CLASS}`);
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.tsimmGenerated = 'true';
    }

    row.classList.remove(...pricedTradeRowDecisionClasses());
    row.classList.add(PRICED_TRADE_ROW_CLASS);
    row.dataset.tsimmPricedTradeToken = token;

    let badgeClasses = [PRICED_TRADE_BADGE_CLASS];
    let badgeHtml = '';
    if (quote) {
      const freshness = quote.freshness || tradeExitFreshness(quote.capturedAt);
      const status = freshness.status === 'fresh' ? 'fresh' : freshness.status;
      row.classList.add(status);
      const resolvedQuantity = Math.max(1, Math.floor(Number(quantityDecision.quantity) || 1));
      const ledger = pricedTradeLedgerProjection(item, resolvedQuantity, quote.unitPrice);
      const ledgerState = !ledger.trackedQuantity
        ? 'unknown'
        : ledger.profit > 0 ? 'profit' : ledger.profit < 0 ? 'loss' : 'even';
      const decisionState = ledger.trackedQuantity && !ledger.fullCoverage ? 'partial' : ledgerState;
      row.classList.add(`decision-${decisionState}`);
      badgeClasses = [
        PRICED_TRADE_BADGE_CLASS,
        status,
        `ledger-${ledgerState}`,
        quantityDecision.selected ? 'quantity-selected' : 'quantity-preview',
      ];
      if (ledger.trackedQuantity && !ledger.fullCoverage) badgeClasses.push('ledger-partial');
      const bestMatch = pricedTradeBestTraderQuote(item, trader);
      const quantityLabel = quantityDecision.selected
        ? `${formatInteger(resolvedQuantity)} SELECTED`
        : `${formatInteger(resolvedQuantity)} AVAILABLE PREVIEW`;
      badgeHtml = pricedTradeLedgerHtml(ledger, quote.unitPrice)
        + pricedTradeBestMatchHtml(bestMatch, trader, quote, ledger)
        + `<span class="tsimm-priced-trade-meta">${escapeHtml(quantityLabel)} · ${escapeHtml(trader.name)} · ${escapeHtml(freshness.ageLabel)}</span>`;
    } else {
      row.classList.add('missing');
      badgeClasses = [PRICED_TRADE_BADGE_CLASS, 'missing'];
      badgeHtml = `<strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list</span>`;
    }

    const nextClassName = badgeClasses.join(' ');
    if (badge.className !== nextClassName) badge.className = nextClassName;
    if (badge.innerHTML !== badgeHtml) badge.innerHTML = badgeHtml;
    if (badge.parentElement !== row) row.appendChild(badge);
    return { row, item, token, priced: Boolean(quote) };
  }

  function schedulePricedTradeRowRefresh(row, delay = 180) {
    if (!(row instanceof Element) || !row.isConnected || !loadPricedTradeSession()) return false;
    pricedTradeLastInteractedRow = row;
    pricedTradePendingQuantityRow = row;
    clearTimeout(pricedTradeQuantityTimer);
    pricedTradeQuantityTimer = setTimeout(() => {
      pricedTradeQuantityTimer = null;
      const pendingRow = pricedTradePendingQuantityRow;
      pricedTradePendingQuantityRow = null;
      if (!(pendingRow instanceof Element) || !pendingRow.isConnected) {
        schedulePricedTradePickerRepaint(45);
        return;
      }
      const verification = pricedTradeVerification(state.lastScan || {});
      if (verification.status !== 'verified' || !verification.trader) {
        scheduleScan(0);
        return;
      }
      const anchor = pricedTradeCaptureScrollAnchor();
      pricedTradeRenderRowBadge(pendingRow, verification.trader);
      pricedTradeRestoreScrollAnchor(anchor);
    }, Math.max(20, Number(delay) || 0));
    return true;
  }

  function capturePricedTradeQuantityEvent(event, delay = 180) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return false;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return false;
    const role = String(target.getAttribute?.('role') || '').toLowerCase();
    const type = String(target.getAttribute?.('type') || '').toLowerCase();
    const label = pricedTradeControlLabel(target);
    const quantityControl = ['checkbox', 'radio', 'number'].includes(type)
      || role === 'spinbutton'
      || target.getAttribute?.('contenteditable') === 'true'
      || /\b(?:qty|quantity|amount)\b/i.test(label)
      || /(?:qty|quantity|amount)/i.test(String(target.className || ''));
    if (!quantityControl) return false;

    const trader = pricedTradeArmedTrader();
    if (!trader) return false;
    let row = target.closest(`.${PRICED_TRADE_ROW_CLASS}`) || pricedTradeRowForControl(target, trader);
    if (!(row instanceof Element) && pricedTradeLastInteractedRow?.isConnected) {
      row = pricedTradeLastInteractedRow;
    }
    if (!(row instanceof Element) || !row.isConnected) return false;
    const surface = pricedTradeInventorySurface();
    if (surface instanceof Element && !surface.contains(row)) return false;
    pricedTradeLastInteractedRow = row;
    return schedulePricedTradeRowRefresh(row, delay);
  }

  function applyPricedTradeInventoryBadges(stats) {
    syncPricedTradePickerObserver();
    const verification = pricedTradeVerification(stats);
    if (verification.status === 'inactive') {
      clearPricedTradeAnnotations();
      return;
    }
    if (verification.status !== 'verified' || !verification.trader) {
      clearPricedTradeRowAnnotations();
      renderPricedTradePanel(verification);
      return;
    }

    injectPricedTradeStyles();
    const trader = verification.trader;
    const anchor = pricedTradeCaptureScrollAnchor();
    const activeRows = new Set();
    const seenTokens = new Set();
    let decorated = 0;
    let priced = 0;
    for (const row of pricedTradeCandidateRows(trader)) {
      const item = pricedTradeItemForRow(row, trader);
      if (!item) continue;
      const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
      if (seenTokens.has(token)) continue;
      seenTokens.add(token);
      activeRows.add(row);
      const result = pricedTradeRenderRowBadge(row, trader, item);
      if (!result) continue;
      decorated += 1;
      if (result.priced) priced += 1;
    }

    document.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`).forEach((row) => {
      if (!activeRows.has(row)) pricedTradeRemoveRowAnnotation(row);
    });
    document.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS}`).forEach((badge) => {
      const row = badge.closest(`.${PRICED_TRADE_ROW_CLASS}`);
      if (!row || !activeRows.has(row)) badge.remove();
    });
    renderPricedTradePanel(verification, decorated, priced);
    pricedTradeRestoreScrollAnchor(anchor);
    syncPricedTradePickerObserver();
  }
'''
text = replace_function(text, 'applyPricedTradeInventoryBadges', render_block)

old_badge_size = 'width:max-content!important;max-width:min(210px,48vw)!important;'
new_badge_size = 'width:min(210px,48vw)!important;max-width:min(210px,48vw)!important;min-height:52px!important;align-content:start!important;'
if old_badge_size not in text:
    raise SystemExit('Could not locate Priced Trade badge width rule')
text = text.replace(old_badge_size, new_badge_size, 1)

change_anchor = "    document.addEventListener('change', (event) => {"
change_replacement = change_anchor + "\n      if (capturePricedTradeQuantityEvent(event, 60)) return;"
if change_anchor not in text:
    raise SystemExit('Could not locate change listener')
text = text.replace(change_anchor, change_replacement, 1)

input_anchor = "    document.addEventListener('input', (event) => {"
input_replacement = input_anchor + "\n      if (capturePricedTradeQuantityEvent(event, 220)) return;"
if input_anchor not in text:
    raise SystemExit('Could not locate input listener')
text = text.replace(input_anchor, input_replacement, 1)

required = [
    '// @version      0.18.6',
    "version: '0.18.6'",
    'pricedTradeRenderRowBadge',
    'capturePricedTradeQuantityEvent',
    'schedulePricedTradeRowRefresh',
    'pricedTradeCaptureScrollAnchor',
    'window.scrollBy(0, delta)',
    'AVAILABLE PREVIEW',
    'SELECTED',
    'width:min(210px,48vw)!important',
    'pricedTradePickerObserver.observe(document.body',
    'quickMaxOverrideArmed',
    'buildTradeExitAudit',
    'inventoryBaseline',
    'sellPriority',
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit(f'Missing required tokens after patch: {missing}')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.18.6 scroll-stability patch')
