from pathlib import Path
import re

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


def sub_once(pattern: str, replacement: str, label: str) -> None:
    global text
    text, count = re.subn(pattern, lambda match: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')


if '// @version      0.19.6' not in text:
    raise SystemExit('Expected v0.19.6 source before applying v0.19.7')

text = text.replace('0.19.6', '0.19.7')
text = text.replace(
    'interaction-locked Priced Trade badges',
    'static full-stack Priced Trade badges with native MAX filling',
)
text = text.replace(
    "- Priced Trade stores an expiring trader handoff, verifies the live counterparty, and adds read-only payout badges beside Torn's native addable-item controls. It never adds an item or changes a trade.",
    "- Priced Trade stores an expiring trader handoff, verifies the live counterparty, adds static full-stack payout badges, and provides an explicit MAX button that fills Torn's native quantity field. It never presses Add to Trade or completes a trade.",
)

replace_once(
    'height:62px!important;min-height:62px!important;overflow:hidden!important;overflow-anchor:none!important;align-content:start!important;margin:3px 4px!important;padding:4px 6px!important;border:1px solid #47c968!important;border-radius:5px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:none!important;box-sizing:border-box!important',
    'position:relative!important;height:76px!important;min-height:76px!important;overflow:hidden!important;overflow-anchor:none!important;align-content:start!important;margin:3px 4px!important;padding:4px 44px 4px 6px!important;border:1px solid #47c968!important;border-radius:5px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:auto!important;box-sizing:border-box!important',
    'priced trade badge interaction CSS',
)
replace_once(
    '.${PRICED_TRADE_BADGE_CLASS} strong,.${PRICED_TRADE_BADGE_CLASS} span{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}',
    '.${PRICED_TRADE_BADGE_CLASS} strong,.${PRICED_TRADE_BADGE_CLASS} span{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;pointer-events:none!important}',
    'priced trade text pointer CSS',
)
replace_once(
    '      .tsimm-priced-trade-start{border-color:#47c968!important;background:#0d3818!important;color:#d4ffc8!important}\n',
    '      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-max{position:absolute!important;right:4px!important;top:4px!important;width:36px!important;height:28px!important;margin:0!important;padding:0!important;border:1px solid #63e47c!important;border-radius:5px!important;background:#0d3818!important;color:#d4ffc8!important;font:900 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;line-height:26px!important;text-align:center!important;pointer-events:auto!important;cursor:pointer!important;z-index:2!important}\n      .${PRICED_TRADE_BADGE_CLASS} .tsimm-priced-trade-max:active{transform:translateY(1px)!important;background:#175226!important}\n      .tsimm-priced-trade-start{border-color:#47c968!important;background:#0d3818!important;color:#d4ffc8!important}\n',
    'priced trade MAX CSS',
)

quantity_block = r'''  function pricedTradeQuantityDecision(row, itemName = '') {
    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, itemName)) || 1));
    return {
      availableQuantity,
      selectedQuantity: 0,
      quantity: availableQuantity,
      selected: false,
      mode: 'full-stack',
      source: 'available-quantity',
    };
  }

  function pricedTradeWritableQuantityControl(row) {
    if (!(row instanceof Element)) return null;
    const ignored = `#${APP.panelId},#${APP.ledgerOverlayId},#${APP.traderOverlayId},#${APP.receiptAuditOverlayId},#${PRICED_TRADE_PANEL_ID},[data-tsimm-generated]`;
    const controls = [...row.querySelectorAll('input,select,[role="spinbutton"],[contenteditable="true"]')]
      .filter((control) => visibleElement(control) && !control.disabled && !control.closest(ignored));
    return controls.find((control) => {
      const role = String(control.getAttribute?.('role') || '').toLowerCase();
      const type = String(control.getAttribute?.('type') || '').toLowerCase();
      const label = pricedTradeControlLabel(control);
      if (['checkbox', 'radio', 'number'].includes(type)) return true;
      if (role === 'spinbutton' || control.getAttribute?.('contenteditable') === 'true') return true;
      return /\b(?:qty|quantity|amount)\b/i.test(label)
        || /(?:qty|quantity|amount)/i.test(String(control.className || ''));
    }) || null;
  }

  function pricedTradeSetQuantityControl(control, quantity) {
    if (!(control instanceof Element)) return false;
    const nextQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    try { control.focus({ preventScroll: true }); } catch { try { control.focus(); } catch {} }

    if (control instanceof HTMLInputElement) {
      const type = String(control.type || '').toLowerCase();
      if (['checkbox', 'radio'].includes(type)) {
        const checkedSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
        if (checkedSetter) checkedSetter.call(control, true);
        else control.checked = true;
      } else {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (valueSetter) valueSetter.call(control, String(nextQuantity));
        else control.value = String(nextQuantity);
      }
    } else if (control instanceof HTMLSelectElement) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (valueSetter) valueSetter.call(control, String(nextQuantity));
      else control.value = String(nextQuantity);
    } else if (control.getAttribute?.('contenteditable') === 'true') {
      control.textContent = String(nextQuantity);
    } else if ('value' in control) {
      control.value = String(nextQuantity);
      control.setAttribute?.('aria-valuenow', String(nextQuantity));
    } else {
      return false;
    }

    pricedTradeScrollActiveUntil = Date.now() + 1000;
    control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    control.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    setTimeout(() => { try { control.blur(); } catch {} }, 20);
    return true;
  }

  function pricedTradeRowByToken(token, trader) {
    const normalizedToken = normalizeWhitespace(token);
    if (!normalizedToken || !trader) return null;
    return pricedTradeCandidateRows(trader).find((candidate) => {
      if (candidate.dataset.tsimmPricedTradeToken === normalizedToken) return true;
      const item = pricedTradeItemForRow(candidate, trader);
      if (!item) return false;
      const candidateToken = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
      return candidateToken === normalizedToken;
    }) || null;
  }

  function fillPricedTradeMax(row, requestedQuantity = 0, itemToken = '', attempt = 0) {
    const trader = pricedTradeArmedTrader();
    const liveRow = row instanceof Element && row.isConnected
      ? row
      : pricedTradeRowByToken(itemToken, trader);
    if (!(liveRow instanceof Element) || !trader) {
      toast('MAX could not find this Torn trade row.');
      return false;
    }

    const item = pricedTradeItemForRow(liveRow, trader);
    const availableQuantity = Math.max(
      1,
      Math.floor(Number(requestedQuantity) || Number(pricedTradeAvailableQuantity(liveRow, item?.name || '')) || 1),
    );
    pricedTradeScrollActiveUntil = Date.now() + 1000;
    pricedTradeLastInteractedRow = liveRow;

    let control = pricedTradeWritableQuantityControl(liveRow);
    if (!control && attempt > 0) {
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      if (active && pricedTradeIsQuantityControl(active) && !active.closest('[data-tsimm-generated]')) control = active;
    }
    if (control && pricedTradeSetQuantityControl(control, availableQuantity)) {
      toast(`MAX filled ${formatInteger(availableQuantity)}× ${item?.name || 'item'}.`);
      return true;
    }

    if (attempt === 0) {
      const nativeControl = pricedTradeNativeAddControl(liveRow);
      const nativeLabel = pricedTradeControlLabel(nativeControl);
      if (nativeControl && /\b(?:qty|quantity|amount)\b/i.test(nativeLabel)) {
        nativeControl.click();
        setTimeout(() => fillPricedTradeMax(liveRow, availableQuantity, itemToken, 1), 90);
        return true;
      }
    }

    if (attempt < 4) {
      setTimeout(() => fillPricedTradeMax(liveRow, availableQuantity, itemToken, attempt + 1), 90 + attempt * 70);
      return true;
    }
    toast('Torn did not expose a quantity field. Tap its Qty control once, then press MAX.');
    return false;
  }

'''
sub_once(
    r"  function pricedTradeQuantityDecision\(row, itemName = ''\) \{.*?\n  \}\n\n  function pricedTradeRowForControl",
    quantity_block + '  function pricedTradeRowForControl',
    'static quantity decision and MAX helpers',
)

ledger_html = r'''  function pricedTradeLedgerHtml(projection, unitPrice) {
    const payoutEach = Math.max(0, Number(unitPrice) || 0);
    const requestedQuantity = Math.max(1, Math.floor(Number(projection?.requestedQuantity) || 1));
    if (!projection?.trackedQuantity) {
      return '<strong class="tsimm-priced-trade-verdict unknown">? COST UNKNOWN</strong>'
        + `<span class="tsimm-priced-trade-comparison">${escapeHtml(formatInteger(requestedQuantity))} available · pays ${escapeHtml(formatMoney(payoutEach))} ea · no open ledger lot</span>`;
    }
    const status = projection.profit > 0 ? 'profit' : projection.profit < 0 ? 'loss' : 'even';
    const totalAmount = formatMoney(Math.abs(projection.profit));
    const eachAmount = formatMoney(Math.abs(projection.profitEach));
    const scope = projection.fullCoverage
      ? 'FULL STACK'
      : `TRACKED ${formatInteger(projection.trackedQuantity)}/${formatInteger(projection.requestedQuantity)}`;
    const headline = status === 'profit'
      ? `${projection.fullCoverage ? '✓' : '⚠'} ${scope} +${totalAmount}`
      : status === 'loss'
        ? `${projection.fullCoverage ? '✕' : '⚠'} ${scope} -${totalAmount}`
        : `${projection.fullCoverage ? '≈' : '⚠'} ${scope} BREAK EVEN`;
    const eachLabel = status === 'profit'
      ? `+${eachAmount} ea`
      : status === 'loss' ? `-${eachAmount} ea` : `${eachAmount} ea`;
    const lotDetail = Number(projection.lotsUsed) > 1
      ? ` · ${formatInteger(projection.lotsUsed)} lots blended`
      : Number(projection.lotsUsed) === 1 ? ' · 1 lot' : '';
    return `<strong class="tsimm-priced-trade-verdict ${status}${projection.fullCoverage ? '' : ' partial'}">${escapeHtml(headline)}</strong>`
      + `<span class="tsimm-priced-trade-comparison">${escapeHtml(eachLabel)} · cost ${escapeHtml(formatMoney(projection.averageCost))} → pays ${escapeHtml(formatMoney(payoutEach))}${escapeHtml(lotDetail)}</span>`;
  }

'''
sub_once(
    r'  function pricedTradeLedgerHtml\(projection, unitPrice\) \{.*?\n  \}\n\n  function pricedTradeBestTraderQuote',
    ledger_html + '  function pricedTradeBestTraderQuote',
    'full-stack ledger badge copy',
)

best_match = r'''  function pricedTradeBestMatchHtml(bestMatch, currentTrader, currentQuote, projection) {
    if (!bestMatch?.trader || !bestMatch?.quote || !currentTrader || !currentQuote) return '';
    const stale = bestMatch.comparisonFreshness !== 'fresh';
    const isCurrent = bestMatch.trader.id === currentTrader.id;
    if (isCurrent) {
      const label = stale ? '⌛ STALE TOP MATCH' : '★ TOP MATCH';
      return `<strong class="tsimm-priced-trade-best${stale ? ' stale' : ''}">${escapeHtml(label)}</strong>`;
    }
    const knownCost = Boolean(projection?.trackedQuantity && Number.isFinite(Number(projection.averageCost)));
    const trackedQuantity = Math.max(0, Math.floor(Number(projection?.trackedQuantity) || 0));
    const bestProfitEach = knownCost ? Number(bestMatch.quote.unitPrice) - Number(projection.averageCost) : null;
    const bestProfitTotal = bestProfitEach === null ? null : bestProfitEach * trackedQuantity;
    const profitLabel = bestProfitTotal === null
      ? 'profit unknown'
      : bestProfitTotal > 0
        ? `+${formatMoney(bestProfitTotal)} STACK`
        : bestProfitTotal < 0
          ? `-${formatMoney(Math.abs(bestProfitTotal))} STACK`
          : `${formatMoney(0)} STACK`;
    const gainTotal = Math.max(0, Number(bestMatch.quote.unitPrice) - Number(currentQuote.unitPrice)) * trackedQuantity;
    const prefix = stale ? '⌛ STALE BEST' : '↑ BEST';
    return `<strong class="tsimm-priced-trade-best better${stale ? ' stale' : ''}">${escapeHtml(prefix)}: ${escapeHtml(bestMatch.trader.name)} · ${escapeHtml(profitLabel)}</strong>`
      + `<span class="tsimm-priced-trade-best-detail">+${escapeHtml(formatMoney(gainTotal))} over this trader for the tracked stack</span>`;
  }

'''
sub_once(
    r'  function pricedTradeBestMatchHtml\(bestMatch, currentTrader, currentQuote, projection\) \{.*?\n  \}\n{2,5}  function pricedTradeRowDecisionClasses',
    best_match + '  function pricedTradeRowDecisionClasses',
    'full-stack best trader copy',
)

render_badge = r'''  function pricedTradeRenderRowBadge(row, trader, resolvedItem = null) {
    if (!(row instanceof Element) || !row.isConnected || !trader) return null;
    const item = resolvedItem || pricedTradeItemForRow(row, trader);
    if (!item) return null;
    const token = Number(item.id) > 0 ? `id:${Number(item.id)}` : `name:${normalizeName(item.name)}`;
    const quote = tradeExitQuoteForTrader(trader, { itemId: item.id, name: item.name });
    const availableQuantity = Math.max(1, Math.floor(Number(pricedTradeAvailableQuantity(row, item.name)) || 1));
    const maxButton = `<button class="tsimm-priced-trade-max" type="button" data-tsimm-action="priced-trade-max" data-tsimm-available-quantity="${availableQuantity}" data-tsimm-item-token="${escapeHtml(token)}" aria-label="Fill maximum quantity ${availableQuantity}">MAX</button>`;
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
      const ledger = pricedTradeLedgerProjection(item, availableQuantity, quote.unitPrice);
      const ledgerState = !ledger.trackedQuantity
        ? 'unknown'
        : ledger.profit > 0 ? 'profit' : ledger.profit < 0 ? 'loss' : 'even';
      const decisionState = ledger.trackedQuantity && !ledger.fullCoverage ? 'partial' : ledgerState;
      row.classList.add(`decision-${decisionState}`);
      badgeClasses = [
        PRICED_TRADE_BADGE_CLASS,
        status,
        `ledger-${ledgerState}`,
        'quantity-full-stack',
      ];
      if (ledger.trackedQuantity && !ledger.fullCoverage) badgeClasses.push('ledger-partial');
      const bestMatch = pricedTradeBestTraderQuote(item, trader);
      const quantityLabel = `FULL STACK · ${formatInteger(availableQuantity)} AVAILABLE`;
      badgeHtml = pricedTradeLedgerHtml(ledger, quote.unitPrice)
        + pricedTradeBestMatchHtml(bestMatch, trader, quote, ledger)
        + `<span class="tsimm-priced-trade-meta">${escapeHtml(quantityLabel)} · ${escapeHtml(trader.name)} · ${escapeHtml(freshness.ageLabel)}</span>`
        + maxButton;
    } else {
      row.classList.add('missing');
      badgeClasses = [PRICED_TRADE_BADGE_CLASS, 'missing', 'quantity-full-stack'];
      badgeHtml = `<strong>${escapeHtml(trader.name)} · NO CAPTURED PRICE</strong><span>${escapeHtml(item.name)} is absent from the saved price list · ${escapeHtml(formatInteger(availableQuantity))} available</span>${maxButton}`;
    }

    const nextClassName = badgeClasses.join(' ');
    if (badge.className !== nextClassName) badge.className = nextClassName;
    if (badge.innerHTML !== badgeHtml) badge.innerHTML = badgeHtml;
    if (badge.parentElement !== row) row.appendChild(badge);
    return { row, item, token, priced: Boolean(quote) };
  }

'''
sub_once(
    r'  function pricedTradeRenderRowBadge\(row, trader, resolvedItem = null\) \{.*?\n  \}\n\n  function schedulePricedTradeRowRefresh',
    render_badge + '  function schedulePricedTradeRowRefresh',
    'static full-stack row badge',
)

replace_once(
    "      } else if (action === 'priced-trade-clear') {\n        clearPricedTradeSession('Priced Trade cleared.');\n        scheduleScan(20);\n",
    "      } else if (action === 'priced-trade-clear') {\n        clearPricedTradeSession('Priced Trade cleared.');\n        scheduleScan(20);\n      } else if (action === 'priced-trade-max') {\n        const row = button.closest(`.${PRICED_TRADE_ROW_CLASS}`);\n        fillPricedTradeMax(\n          row,\n          Number(button.dataset.tsimmAvailableQuantity) || 0,\n          button.dataset.tsimmItemToken || '',\n        );\n",
    'priced trade MAX action',
)

replace_once(
    "    document.addEventListener('change', (event) => {\n      if (capturePricedTradeQuantityEvent(event, 60)) return;\n",
    "    document.addEventListener('change', (event) => {\n      if (pageLooksLikeTrade()\n        && !event.target.closest(immUiSelector())\n        && pricedTradeIsQuantityControl(event.target)) {\n        pricedTradeScrollActiveUntil = Date.now() + 1000;\n        return;\n      }\n",
    'quantity change repaint removal',
)
replace_once(
    "    document.addEventListener('input', (event) => {\n      if (capturePricedTradeQuantityEvent(event, 220)) return;\n",
    "    document.addEventListener('input', (event) => {\n      if (pageLooksLikeTrade()\n        && !event.target.closest(immUiSelector())\n        && pricedTradeIsQuantityControl(event.target)) {\n        pricedTradeScrollActiveUntil = Date.now() + 1000;\n        return;\n      }\n",
    'quantity input repaint removal',
)

replace_once(
    "    const tradeRoute = href.includes('trade.php');\n    const profileRoute = href.includes('profiles.php');\n",
    "    const tradeRoute = href.includes('trade.php');\n    const profileRoute = href.includes('profiles.php');\n    if (tradeRoute\n      && loadPricedTradeSession()\n      && (pricedTradeScrollIsActive() || pricedTradeIsQuantityControl(document.activeElement))) return false;\n",
    'global trade observer quantity guard',
)

required = [
    '// @version      0.19.7',
    "version: '0.19.7'",
    'data-tsimm-action="priced-trade-max"',
    "mode: 'full-stack'",
    'function fillPricedTradeMax',
    'FULL STACK',
    'pricedTradeSetQuantityControl',
    'handleQuickMaxClick',
    'trade-record-sale',
    'ledgerSalePlan',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Missing required token after patch: {token}')
if 'capturePricedTradeQuantityEvent(event' in text:
    raise SystemExit('Quantity event redraw hooks remain bound')
if 'quantityDecision.selected' in text:
    raise SystemExit('Selected-quantity badge rendering remains')

path.write_text(text, encoding='utf-8')
