from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    print(f'{label}: {count} match(es)')
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once('// @version      0.19.7', '// @version      0.19.8', 'header version')
replace_once(
    'static full-stack Priced Trade badges with native MAX filling,',
    'persistent full-stack Priced Trade badges with Qty-adjacent MAX filling,',
    'description',
)
replace_once('ITEM MARKET MARGIN v0.19.7', 'ITEM MARKET MARGIN v0.19.8', 'internal version comment')

version_count = text.count("version: '0.19.7'")
print(f'version constants: {version_count} match(es)')
if version_count != 3:
    raise SystemExit(f'version constants: expected three matches, found {version_count}')
text = text.replace("version: '0.19.7'", "version: '0.19.8'")

replace_once(
    "  const PRICED_TRADE_BADGE_CLASS = 'tsimm-priced-trade-badge';\n  const PRICED_TRADE_ROW_CLASS = 'tsimm-priced-trade-row';",
    "  const PRICED_TRADE_BADGE_CLASS = 'tsimm-priced-trade-badge';\n  const PRICED_TRADE_ROW_CLASS = 'tsimm-priced-trade-row';\n  const PRICED_TRADE_MAX_CLASS = 'tsimm-priced-trade-native-max';",
    'max class constant',
)

replace_once(
    'adds static full-stack payout badges, and provides an explicit MAX button that fills Torn\'s native quantity field.',
    'adds persistent full-stack payout badges, and provides an explicit MAX button beside Torn\'s native quantity field.',
    'safety boundary description',
)

replace_once(
    'padding:4px 44px 4px 6px!important;',
    'padding:4px 6px!important;',
    'badge padding',
)

old_max_css = '''      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-max{position:absolute!important;right:4px!important;top:4px!important;width:36px!important;height:28px!important;margin:0!important;padding:0!important;border:1px solid #63e47c!important;border-radius:5px!important;background:#0d3818!important;color:#d4ffc8!important;font:900 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;line-height:26px!important;text-align:center!important;pointer-events:auto!important;cursor:pointer!important;z-index:2!important}
      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-max:active{transform:translateY(1px)!important;background:#175226!important}
'''
new_max_css = '''      .${PRICED_TRADE_MAX_CLASS}{display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important;flex:0 0 auto!important;width:38px!important;min-width:38px!important;height:28px!important;margin:0 0 0 4px!important;padding:0!important;border:1px solid #63e47c!important;border-radius:5px!important;background:#0d3818!important;color:#d4ffc8!important;font:900 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;line-height:26px!important;text-align:center!important;pointer-events:auto!important;cursor:pointer!important;z-index:2!important;box-sizing:border-box!important}
      .${PRICED_TRADE_MAX_CLASS}:active{transform:translateY(1px)!important;background:#175226!important}
'''
replace_once(old_max_css, new_max_css, 'Qty-adjacent MAX styles')

old_settle = '''  function schedulePricedTradeScrollSettle() {
    clearTimeout(pricedTradeScrollQuietTimer);
    const remaining = Math.max(40, pricedTradeScrollActiveUntil - Date.now() + 40);
    pricedTradeScrollQuietTimer = setTimeout(() => {
      pricedTradeScrollQuietTimer = null;
      if (pricedTradeScrollIsActive()) {
        schedulePricedTradeScrollSettle();
        return;
      }
      pricedTradeScrollActiveUntil = 0;
      const deferredRow = pricedTradeDeferredRow;
      const needsFullRepaint = pricedTradeDeferredFullRepaint;
      pricedTradeDeferredRow = null;
      pricedTradeDeferredFullRepaint = false;
      if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
      const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
      if (deferredRow instanceof Element && deferredRow.isConnected && deferredRow.contains(activeElement)) {
        schedulePricedTradeRowRefresh(deferredRow, 0);
        return;
      }
      if (needsFullRepaint) scheduleScan(0);
    }, remaining);
  }
'''
new_settle = '''  function schedulePricedTradeScrollSettle() {
    clearTimeout(pricedTradeScrollQuietTimer);
    const remaining = Math.max(40, pricedTradeScrollActiveUntil - Date.now() + 40);
    pricedTradeScrollQuietTimer = setTimeout(() => {
      pricedTradeScrollQuietTimer = null;
      if (pricedTradeScrollIsActive()) {
        schedulePricedTradeScrollSettle();
        return;
      }
      pricedTradeScrollActiveUntil = 0;
      pricedTradeDeferredRow = null;
      pricedTradeDeferredFullRepaint = false;
      if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return;
      pricedTradeReconcileVisibleRows();
    }, remaining);
  }
'''
replace_once(old_settle, new_settle, 'scroll settle reconciliation')

old_scroll_tail = '''    pricedTradePendingQuantityRow = null;
    pricedTradeDeferredFullRepaint = false;
    pricedTradeDeferredRow = null;
  }


  function schedulePricedTradePickerRepaint(delay = 140) {
    if (!loadPricedTradeSession() || pricedTradeScrollIsActive()) return;
    clearTimeout(pricedTradeRepaintSettleTimer);
    pricedTradeRepaintSettleTimer = null;
    scheduleScan(Math.max(100, Number(delay) || 0));
  }
'''
new_scroll_tail = '''    pricedTradePendingQuantityRow = null;
    pricedTradeDeferredFullRepaint = false;
    pricedTradeDeferredRow = null;
    schedulePricedTradeScrollSettle();
  }


  function schedulePricedTradePickerRepaint(delay = 140) {
    if (!loadPricedTradeSession()) return;
    clearTimeout(pricedTradeRepaintSettleTimer);
    pricedTradeRepaintSettleTimer = setTimeout(() => {
      pricedTradeRepaintSettleTimer = null;
      if (pricedTradeScrollIsActive()) {
        schedulePricedTradeScrollSettle();
        return;
      }
      pricedTradeReconcileVisibleRows();
    }, Math.max(40, Number(delay) || 0));
  }
'''
replace_once(old_scroll_tail, new_scroll_tail, 'scroll capture and lightweight repaint')

old_writable_tail = '''    }) || null;
  }

  function pricedTradeSetQuantityControl(control, quantity) {
'''
new_writable_tail = '''    }) || null;
  }

  function pricedTradeNativeMaxPlacementControl(row) {
    if (!(row instanceof Element)) return null;
    return pricedTradeWritableQuantityControl(row) || pricedTradeNativeAddControl(row);
  }

  function pricedTradeEnsureNativeMaxButton(row, availableQuantity, itemToken) {
    if (!(row instanceof Element) || !row.isConnected) return null;
    const control = pricedTradeNativeMaxPlacementControl(row);
    let button = row.querySelector(`.${PRICED_TRADE_MAX_CLASS}`);
    if (!(control instanceof Element) || !control.isConnected) {
      button?.remove();
      return null;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = PRICED_TRADE_MAX_CLASS;
      button.dataset.tsimmGenerated = 'true';
      button.dataset.tsimmAction = 'priced-trade-max';
      button.textContent = 'MAX';
    }
    const quantity = Math.max(1, Math.floor(Number(availableQuantity) || 1));
    button.dataset.tsimmAvailableQuantity = String(quantity);
    button.dataset.tsimmItemToken = normalizeWhitespace(itemToken);
    button.setAttribute('aria-label', `Fill maximum quantity ${quantity}`);
    if (button.parentElement !== control.parentElement || button.previousElementSibling !== control) {
      control.insertAdjacentElement('afterend', button);
    }
    return button;
  }

  function pricedTradeSetQuantityControl(control, quantity) {
'''
replace_once(old_writable_tail, new_writable_tail, 'native MAX placement helpers')

old_remove = '''  function pricedTradeRemoveRowAnnotation(row) {
    if (!(row instanceof Element)) return;
    row.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS}`).forEach((badge) => badge.remove());
    row.classList.remove(PRICED_TRADE_ROW_CLASS, ...pricedTradeRowDecisionClasses());
    delete row.dataset.tsimmPricedTradeToken;
  }

  function clearPricedTradeRowAnnotations() {
    document.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`).forEach(pricedTradeRemoveRowAnnotation);
    document.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS}`).forEach((badge) => badge.remove());
  }
'''
new_remove = '''  function pricedTradeRemoveRowAnnotation(row) {
    if (!(row instanceof Element)) return;
    row.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS},.${PRICED_TRADE_MAX_CLASS}`).forEach((element) => element.remove());
    row.classList.remove(PRICED_TRADE_ROW_CLASS, ...pricedTradeRowDecisionClasses());
    delete row.dataset.tsimmPricedTradeToken;
  }

  function clearPricedTradeRowAnnotations() {
    document.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`).forEach(pricedTradeRemoveRowAnnotation);
    document.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS},.${PRICED_TRADE_MAX_CLASS}`).forEach((element) => element.remove());
  }
'''
replace_once(old_remove, new_remove, 'annotation cleanup')

replace_once(
    '''    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, item.name)) || 1));
    const maxButton = `<button class="tsimm-priced-trade-max" type="button" data-tsimm-action="priced-trade-max" data-tsimm-available-quantity="${availableQuantity}" data-tsimm-item-token="${escapeHtml(token)}" aria-label="Fill maximum quantity ${availableQuantity}">MAX</button>`;
    let badge = [...row.children].find((child) => child.classList?.contains(PRICED_TRADE_BADGE_CLASS))
''',
    '''    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, item.name)) || 1));
    let badge = [...row.children].find((child) => child.classList?.contains(PRICED_TRADE_BADGE_CLASS))
''',
    'remove badge-embedded MAX creation',
)

replace_once(
    '''        + pricedTradeBestMatchHtml(bestMatch, trader, quote, ledger)
        + `<span class="tsimm-priced-trade-meta">${escapeHtml(quantityLabel)} · ${escapeHtml(trader.name)} · ${escapeHtml(freshness.ageLabel)}</span>`
        + maxButton;
''',
    '''        + pricedTradeBestMatchHtml(bestMatch, trader, quote, ledger)
        + `<span class="tsimm-priced-trade-meta">${escapeHtml(quantityLabel)} · ${escapeHtml(trader.name)} · ${escapeHtml(freshness.ageLabel)}</span>`;
''',
    'priced badge HTML',
)

replace_once(
    '''      badgeClasses = [PRICED_TRADE_BADGE_CLASS, 'missing', 'quantity-full-stack'];
      badgeHtml = `<strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list · ${escapeHtml(formatInteger(availableQuantity))} available</span>${maxButton}`;
''',
    '''      badgeClasses = [PRICED_TRADE_BADGE_CLASS, 'missing', 'quantity-full-stack'];
      badgeHtml = `<strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list · ${escapeHtml(formatInteger(availableQuantity))} available</span>`;
''',
    'missing badge HTML',
)

replace_once(
    '''    if (badge.innerHTML !== badgeHtml) badge.innerHTML = badgeHtml;
    if (badge.parentElement !== row) row.appendChild(badge);
    return { row, item, token, priced: Boolean(quote) };
  }
''',
    '''    if (badge.innerHTML !== badgeHtml) badge.innerHTML = badgeHtml;
    if (badge.parentElement !== row) row.appendChild(badge);
    pricedTradeEnsureNativeMaxButton(row, availableQuantity, token);
    return { row, item, token, priced: Boolean(quote) };
  }
''',
    'attach native MAX beside Qty',
)

old_quantity_event = '''  function capturePricedTradeQuantityEvent(event, delay = 180) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return false;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return false;
    if (!pricedTradeIsQuantityControl(target)) return false;

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
    if (event.type === 'input') return true;
    return schedulePricedTradeRowRefresh(row, delay);
  }
'''
new_quantity_event = '''  function capturePricedTradeQuantityEvent(event) {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade()) return false;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`)) return false;
    if (!pricedTradeIsQuantityControl(target)) return false;
    const trader = pricedTradeArmedTrader();
    if (!trader) return false;
    const row = target.closest(`.${PRICED_TRADE_ROW_CLASS}`) || pricedTradeRowForControl(target, trader);
    if (row instanceof Element && row.isConnected) pricedTradeLastInteractedRow = row;
    return true;
  }
'''
replace_once(old_quantity_event, new_quantity_event, 'silent quantity events')

old_apply_cleanup = '''    document.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`).forEach((row) => {
      if (!activeRows.has(row)) pricedTradeRemoveRowAnnotation(row);
    });
    document.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS}`).forEach((badge) => {
      const row = badge.closest(`.${PRICED_TRADE_ROW_CLASS}`);
      if (!row || !activeRows.has(row)) badge.remove();
    });
    renderPricedTradePanel(verification, decorated, priced);
'''
new_apply_cleanup = '''    renderPricedTradePanel(verification, decorated, priced);
'''
replace_once(old_apply_cleanup, new_apply_cleanup, 'remove aggressive badge cleanup')

insert_anchor = '''  function applyPricedTradeInventoryBadges(stats) {
'''
reconcile_helpers = '''  function pricedTradeRowNeedsDecoration(row, trader) {
    if (!(row instanceof Element) || !row.isConnected || !trader) return false;
    const item = pricedTradeItemForRow(row, trader);
    if (!item) return false;
    const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
    const badge = row.querySelector(`.${PRICED_TRADE_BADGE_CLASS}`);
    const maxButton = row.querySelector(`.${PRICED_TRADE_MAX_CLASS}`);
    const control = pricedTradeNativeMaxPlacementControl(row);
    return !badge
      || !maxButton
      || row.dataset.tsimmPricedTradeToken !== token
      || !(control instanceof Element)
      || maxButton.parentElement !== control.parentElement
      || maxButton.previousElementSibling !== control;
  }

  function pricedTradeReconcileVisibleRows() {
    if (!loadPricedTradeSession() || !pageLooksLikeTrade() || pricedTradeScrollIsActive()) return false;
    const verification = pricedTradeVerification(state.lastScan || {});
    if (verification.status !== 'verified' || !verification.trader) {
      scheduleScan(0);
      return false;
    }
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
      const result = pricedTradeRowNeedsDecoration(row, trader)
        ? pricedTradeRenderRowBadge(row, trader, item)
        : { priced: Boolean(tradeExitQuoteForTrader(trader, { itemId: item.id, name: item.name })) };
      if (!result) continue;
      decorated += 1;
      if (result.priced) priced += 1;
    }
    renderPricedTradePanel(verification, decorated, priced);
    return true;
  }

'''
replace_once(insert_anchor, reconcile_helpers + insert_anchor, 'visible-row reconciliation helpers')

old_observer_rows = '''      if (needsFullRepaint) {
        schedulePricedTradePickerRepaint(70);
        return;
      }
      rowUpdates.forEach((row) => schedulePricedTradeRowRefresh(row, 100));
'''
new_observer_rows = '''      if (needsFullRepaint) {
        schedulePricedTradePickerRepaint(70);
        return;
      }
      const verification = pricedTradeVerification(state.lastScan || {});
      const trader = verification.status === 'verified' ? verification.trader : null;
      if (trader && [...rowUpdates].some((row) => pricedTradeRowNeedsDecoration(row, trader))) {
        schedulePricedTradePickerRepaint(70);
      }
'''
replace_once(old_observer_rows, new_observer_rows, 'observer missing-only reconciliation')

old_interaction_row = '''    if (row instanceof Element && row.isConnected) {
      pricedTradeLastInteractedRow = row;
      schedulePricedTradeRowRefresh(row, 90);
      return;
    }
'''
new_interaction_row = '''    if (row instanceof Element && row.isConnected) {
      pricedTradeLastInteractedRow = row;
      if (pricedTradeRowNeedsDecoration(row, trader)) schedulePricedTradePickerRepaint(90);
      return;
    }
'''
replace_once(old_interaction_row, new_interaction_row, 'interaction missing-only reconciliation')

path.write_text(text)
print('PATCH_OK')
