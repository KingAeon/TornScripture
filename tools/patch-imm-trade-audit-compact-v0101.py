from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text

if '// @version      0.10.0' not in text:
    raise SystemExit('Expected IMM v0.10.0 source')
text = text.replace('0.10.0', '0.10.1')

safety_old = """   * - Trade Exit Audit is read-only: it compares live trade cash, captured trader prices, favorite traders, NPC buyback, and the 99% target without changing the trade.
   * - Outside an explicitly armed Override MAX action, the script never submits purchases, lists items, or sells items.
"""
safety_new = """   * - Trade Exit Audit comparisons are read-only. Bulk removal runs only after the user presses its button and confirms; it uses Torn's visible item-removal controls and never accepts or completes a trade.
   * - Outside an explicitly armed Override MAX action, the script never submits purchases, lists items, sells items, or completes trades.
"""
if safety_old not in text:
    raise SystemExit('Safety boundary anchor not found')
text = text.replace(safety_old, safety_new, 1)

settings_old = """    showTradeItemBreakdown: true,
    showTradeExitAudit: true,
    showClosedLedgerLots: true,
"""
settings_new = """    showTradeItemBreakdown: true,
    showTradeExitAudit: true,
    tradeExitShowAllItems: false,
    showClosedLedgerLots: true,
"""
if settings_old not in text:
    raise SystemExit('Settings anchor not found')
text = text.replace(settings_old, settings_new, 1)

state_old = """    quickMaxOverrideArmed: false,
    quickMaxBusy: false,
    quickMaxLastActionAt: 0,
    recentPurchaseFingerprints: loadJson(APP.recentPurchaseFingerprintsStorageKey, []),
"""
state_new = """    quickMaxOverrideArmed: false,
    quickMaxBusy: false,
    quickMaxLastActionAt: 0,
    tradeExitRemoveBusy: false,
    recentPurchaseFingerprints: loadJson(APP.recentPurchaseFingerprintsStorageKey, []),
"""
if state_old not in text:
    raise SystemExit('State anchor not found')
text = text.replace(state_old, state_new, 1)

clear_old = """  function clearTradeAnnotations() {
    document.querySelectorAll(`.${APP.tradeBadgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.tradeItemMark}`).forEach((element) => element.classList.remove(APP.tradeItemMark));
  }
"""
clear_new = """  function clearTradeAnnotations() {
    document.querySelectorAll(`.${APP.tradeBadgeClass}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${APP.tradeItemMark}`).forEach((element) => element.classList.remove(APP.tradeItemMark));
    document.querySelectorAll('[data-tsimm-trade-exit-status],[data-tsimm-trade-exit-token]').forEach((element) => {
      delete element.dataset.tsimmTradeExitStatus;
      delete element.dataset.tsimmTradeExitToken;
    });
  }
"""
if clear_old not in text:
    raise SystemExit('Trade annotation cleanup anchor not found')
text = text.replace(clear_old, clear_new, 1)

apply_old = """      const badge = annotationRow.querySelector(`.${APP.tradeBadgeClass}`);
      if (!auditItem || !badge) continue;
      badge.classList.add(`tsimm-trade-exit-badge-${auditItem.status}`);
"""
apply_new = """      if (!auditItem) continue;
      annotationRow.dataset.tsimmTradeExitStatus = auditItem.status;
      annotationRow.dataset.tsimmTradeExitToken = auditItem.token;
      const badge = annotationRow.querySelector(`.${APP.tradeBadgeClass}`);
      if (!badge) continue;
      badge.classList.add(`tsimm-trade-exit-badge-${auditItem.status}`);
"""
if apply_old not in text:
    raise SystemExit('Trade audit badge anchor not found')
text = text.replace(apply_old, apply_new, 1)

scan_anchor = """  function scanTrade(stats) {
"""
helpers = r'''  function tradeExitRemoveControlLabel(element) {
    if (!(element instanceof Element)) return '';
    const childHints = [...element.querySelectorAll('[class],[aria-label],[title]')]
      .slice(0, 16)
      .map((child) => `${child.getAttribute('class') || ''} ${child.getAttribute('aria-label') || ''} ${child.getAttribute('title') || ''}`)
      .join(' ');
    return normalizeWhitespace([
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('value'),
      element.getAttribute('class'),
      childHints,
    ].filter(Boolean).join(' '));
  }

  function tradeExitRemoveControl(row) {
    if (!(row instanceof Element)) return null;
    const controls = [...row.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .filter((element) => visibleElement(element)
        && !element.disabled
        && !element.closest(`#${APP.panelId},[data-tsimm-generated]`));
    return controls.find((element) => /\b(?:remove|delete|trash)\b/i.test(tradeExitRemoveControlLabel(element)))
      || controls.find((element) => /(?:remove|delete|trash)/i.test(String(element.className || '')))
      || null;
  }

  function tradeExitRowForToken(token) {
    return [...document.querySelectorAll('[data-tsimm-trade-exit-token]')]
      .find((row) => row.dataset.tsimmTradeExitToken === token) || null;
  }

  const tradeExitDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function removeTradeExitItems(status = 'better-elsewhere') {
    if (state.tradeExitRemoveBusy) return;
    const audit = state.lastScan?.tradeExitAudit;
    const targets = (audit?.items || []).filter((item) => item.status === status);
    if (!targets.length) {
      toast('No better-elsewhere items are currently in this trade.');
      return;
    }
    const preview = targets.slice(0, 8).map((item) => `${item.itemName} × ${formatInteger(item.quantity)}`).join('\n');
    const remainder = targets.length > 8 ? `\n…plus ${targets.length - 8} more` : '';
    const accepted = confirm(
      `Remove ${targets.length} better-elsewhere item type${targets.length === 1 ? '' : 's'} from your side of this trade?\n\n${preview}${remainder}\n\nIMM will press Torn's visible remove controls one at a time. It will not accept or complete the trade.`
    );
    if (!accepted) return;

    state.tradeExitRemoveBusy = true;
    renderPanel();
    let removed = 0;
    let unavailable = 0;
    try {
      for (const target of targets) {
        const row = tradeExitRowForToken(target.token);
        const control = tradeExitRemoveControl(row);
        if (!row || !control) {
          unavailable += 1;
          continue;
        }
        const originalRow = row;
        control.click();
        await tradeExitDelay(550);
        if (!originalRow.isConnected || !visibleElement(originalRow)) removed += 1;
        else unavailable += 1;
        scanPage();
        await tradeExitDelay(120);
      }
    } finally {
      state.tradeExitRemoveBusy = false;
      scheduleScan(120);
      renderPanel();
    }
    if (removed) {
      toast(`Removed ${removed} better-elsewhere item type${removed === 1 ? '' : 's'}${unavailable ? ` · ${unavailable} still need manual removal` : ''}.`);
    } else {
      toast('Torn did not expose a usable remove control. Use the native trash icons for these rows.');
    }
  }

'''
if scan_anchor not in text:
    raise SystemExit('scanTrade anchor not found')
text = text.replace(scan_anchor, helpers + scan_anchor, 1)

panel_css_old = """      #${APP.panelId}{position:fixed;right:8px;bottom:118px;width:min(292px,calc(100vw - 16px));z-index:2147483000;border:1px solid #58506b;border-radius:12px;background:#1d1b22;color:#f4f1f8;box-shadow:0 10px 30px #0009;font:12px/1.35 Arial,sans-serif;overflow:hidden}
"""
panel_css_new = """      #${APP.panelId}{position:fixed;right:8px;bottom:118px;width:min(292px,calc(100vw - 16px));max-height:calc(100vh - 134px);max-height:calc(100dvh - 134px);z-index:2147483000;display:flex;flex-direction:column;border:1px solid #58506b;border-radius:12px;background:#1d1b22;color:#f4f1f8;box-shadow:0 10px 30px #0009;font:12px/1.35 Arial,sans-serif;overflow:hidden}
"""
if panel_css_old not in text:
    raise SystemExit('Panel CSS anchor not found')
text = text.replace(panel_css_old, panel_css_new, 1)

body_css_old = """      .tsimm-head button{padding:2px 7px}.tsimm-body{padding:9px}.tsimm-collapsed .tsimm-body,.tsimm-collapsed .tsimm-head small{display:none}
"""
body_css_new = """      .tsimm-head{flex:0 0 auto}.tsimm-head button{padding:2px 7px}.tsimm-body{min-height:0;padding:9px;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}.tsimm-collapsed{max-height:none!important}.tsimm-collapsed .tsimm-body,.tsimm-collapsed .tsimm-head small{display:none}
"""
if body_css_old not in text:
    raise SystemExit('Panel body CSS anchor not found')
text = text.replace(body_css_old, body_css_new, 1)

audit_css_old = """      .tsimm-trade-exit-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.tsimm-trade-exit-head strong{color:#d9c9e8;font-size:11px}.tsimm-trade-exit-head span{font-size:9px;color:#aaa1b7;text-align:right}
      .tsimm-trade-exit-summary{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:6px;border:1px solid #494250;border-radius:7px;background:#1d1a22}.tsimm-trade-exit-summary span{color:#aaa1b7}.tsimm-trade-exit-summary strong{text-align:right}
      .tsimm-trade-exit-list{display:grid;gap:5px;max-height:210px;overflow:auto;padding-right:2px}
"""
audit_css_new = """      .tsimm-trade-exit-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.tsimm-trade-exit-head strong{color:#d9c9e8;font-size:11px}.tsimm-trade-exit-head span{font-size:9px;color:#aaa1b7;text-align:right}
      .tsimm-trade-exit-summary{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:6px;border:1px solid #494250;border-radius:7px;background:#1d1a22}.tsimm-trade-exit-summary span{color:#aaa1b7}.tsimm-trade-exit-summary strong{text-align:right}
      .tsimm-trade-exit-actions{display:flex;gap:5px;flex-wrap:wrap}.tsimm-trade-exit-actions button{flex:1;min-width:104px;border:1px solid #625a70;border-radius:6px;background:#332d3b;color:#f4f1f8;padding:6px;font-size:9px;font-weight:800}.tsimm-trade-exit-actions button.remove{border-color:#925264;background:#3a1821;color:#ffc5cf}.tsimm-trade-exit-actions button:disabled{opacity:.55;cursor:wait}
      .tsimm-trade-exit-list{display:grid;gap:5px;max-height:min(210px,32dvh);overflow:auto;overscroll-behavior:contain;padding-right:2px}.tsimm-trade-exit-empty{padding:7px;border:1px dashed #514a59;border-radius:7px;color:#9fdcb8;text-align:center;font-size:9px}
"""
if audit_css_old not in text:
    raise SystemExit('Audit CSS anchor not found')
text = text.replace(audit_css_old, audit_css_new, 1)

function_start = text.find('  function tradeExitAuditHtml(stats) {')
function_end = text.find('\n  function tradeSummaryHtml(stats) {', function_start)
if function_start < 0 or function_end < 0:
    raise SystemExit('Trade Exit Audit HTML function not found')
new_function = r'''  function tradeExitAuditHtml(stats) {
    const audit = stats?.tradeExitAudit;
    if (!state.settings.showTradeExitAudit || !audit || stats.pageType !== 'trade') return '';
    const showAll = state.settings.tradeExitShowAllItems === true;
    const problemItems = audit.items.filter((item) => item.status !== 'sell-here');
    const visibleItems = showAll ? audit.items : problemItems;
    const hiddenSellHere = showAll ? 0 : audit.sellHereCount;
    const bestTotalText = audit.fullCoverage
      ? formatMoney(audit.bestKnownTotal)
      : `${formatInteger(audit.actionableTypes)}/${formatInteger(audit.totalTypes)} types covered`;
    const potentialText = audit.potentialLeftBehind === null
      ? 'Incomplete'
      : audit.potentialLeftBehind > 0
        ? `+${formatMoney(audit.potentialLeftBehind)} available`
        : 'No known loss';
    const potentialClass = audit.potentialLeftBehind > 0
      ? 'tsimm-trade-diff-loss'
      : audit.potentialLeftBehind === null
        ? 'tsimm-trade-diff-pending'
        : 'tsimm-trade-diff-good';
    const offerVsBestText = audit.offerVsBest === null
      ? 'Incomplete'
      : `${audit.offerVsBest >= 0 ? '+' : ''}${formatMoney(audit.offerVsBest)}`;
    const offerVsBestClass = audit.offerVsBest === null
      ? 'tsimm-trade-diff-pending'
      : audit.offerVsBest >= 0
        ? 'tsimm-trade-diff-good'
        : 'tsimm-trade-diff-loss';
    const rows = visibleItems.map((item) => {
      const hereText = item.currentQuote
        ? `${formatMoney(item.currentQuote.unitPrice)}${item.currentQuote.freshness.status === 'fresh' ? '' : ' stale'}`
        : '?';
      const favoriteText = item.bestFreshFavorite
        ? `${item.bestFreshFavorite.traderName} ${formatMoney(item.bestFreshFavorite.unitPrice)}`
        : item.bestStaleFavorite
          ? `${item.bestStaleFavorite.traderName} ${formatMoney(item.bestStaleFavorite.unitPrice)} stale`
          : 'none';
      const npcText = item.npcEach > 0 ? formatMoney(item.npcEach) : 'none';
      const routeValue = item.recommendedEach > 0 ? `${formatMoney(item.recommendedEach)} ea` : 'No price';
      const routeAge = item.recommendedFreshness?.ageLabel ? ` · ${item.recommendedFreshness.ageLabel}` : '';
      const deltaText = item.deltaTotal === null
        ? ''
        : item.deltaTotal > 0
          ? ` · +${formatMoney(item.deltaTotal)} vs here`
          : item.deltaTotal < 0
            ? ` · ${formatMoney(item.deltaTotal)} vs here`
            : ' · tied with here';
      return `<div class="tsimm-trade-exit-row tsimm-trade-exit-${escapeHtml(item.status)}">`
        + `<div class="tsimm-trade-exit-row-head"><strong>${escapeHtml(item.verdict)}</strong><span>${escapeHtml(item.itemName)} × ${formatInteger(item.quantity)}</span></div>`
        + `<div class="tsimm-trade-exit-route"><span>${escapeHtml(item.recommendedSource || 'No actionable route')}${escapeHtml(routeAge)}</span><strong>${escapeHtml(routeValue)}</strong></div>`
        + `<small>Here ${escapeHtml(hereText)} · Favorite ${escapeHtml(favoriteText)} · NPC ${escapeHtml(npcText)} · 99% ${escapeHtml(formatMoney(item.targetEach))}${escapeHtml(deltaText)}</small>`
        + `</div>`;
    }).join('');
    const emptyText = audit.totalTypes
      ? `${formatInteger(audit.sellHereCount)} item type${audit.sellHereCount === 1 ? '' : 's'} cleared to sell here. Use Show all to inspect them.`
      : 'Add items to your side of the trade to begin the audit.';
    const viewButton = audit.sellHereCount
      ? `<button type="button" data-tsimm-action="trade-exit-toggle-all">${showAll ? `Problems only (${formatInteger(problemItems.length)})` : `Show all (${formatInteger(audit.totalTypes)})`}</button>`
      : '';
    const removeButton = audit.betterElsewhereCount
      ? `<button class="remove" type="button" data-tsimm-action="trade-exit-remove-better" ${state.tradeExitRemoveBusy ? 'disabled' : ''}>${state.tradeExitRemoveBusy ? 'Removing…' : `Remove ${formatInteger(audit.betterElsewhereCount)} better elsewhere`}</button>`
      : '';
    return `
      <div class="tsimm-trade-exit-audit">
        <div class="tsimm-trade-exit-head"><strong>🧭 Trade Exit Audit</strong><span>${escapeHtml(audit.overallLabel)}${hiddenSellHere ? ` · ${formatInteger(hiddenSellHere)} safe hidden` : ''}</span></div>
        <div class="tsimm-trade-exit-summary">
          <span>Current trader price coverage</span><strong>${formatInteger(audit.currentFreshCoverage)}/${formatInteger(audit.totalTypes)} fresh</strong>
          <span>Best known concrete exit</span><strong>${escapeHtml(bestTotalText)}</strong>
          <span>Live cash vs best route</span><strong class="${offerVsBestClass}">${escapeHtml(offerVsBestText)}</strong>
          <span>Potential left behind</span><strong class="${potentialClass}">${escapeHtml(potentialText)}</strong>
        </div>
        ${(viewButton || removeButton) ? `<div class="tsimm-trade-exit-actions">${viewButton}${removeButton}</div>` : ''}
        ${rows ? `<div class="tsimm-trade-exit-list">${rows}</div>` : `<div class="tsimm-trade-exit-empty">${escapeHtml(emptyText)}</div>`}
        <div class="tsimm-muted">Problems-only view hides SELL HERE rows. Fresh captured prices remain actionable for 72h by default.</div>
      </div>
    `;
  }
'''
text = text[:function_start] + new_function + text[function_end:]

render_scroll_old = """    panel.classList.toggle('tsimm-collapsed', Boolean(state.settings.collapsed));
    const stats = state.lastScan;
"""
render_scroll_new = """    const previousBodyScroll = panel.querySelector('.tsimm-body')?.scrollTop || 0;
    panel.classList.toggle('tsimm-collapsed', Boolean(state.settings.collapsed));
    const stats = state.lastScan;
"""
if render_scroll_old not in text:
    raise SystemExit('Render scroll anchor not found')
text = text.replace(render_scroll_old, render_scroll_new, 1)

render_tail_old = """        ${notes}
      </div>
    `;
  }

  function bindPanelEvents() {
"""
render_tail_new = """        ${notes}
      </div>
    `;
    const nextBody = panel.querySelector('.tsimm-body');
    if (nextBody && previousBodyScroll > 0) nextBody.scrollTop = previousBodyScroll;
  }

  function bindPanelEvents() {
"""
if render_tail_old not in text:
    raise SystemExit('Render tail anchor not found')
text = text.replace(render_tail_old, render_tail_new, 1)

event_old = """      } else if (action === 'diagnostics') {
        copyDiagnostics();
      } else if (action === 'trade-record-sale') {
"""
event_new = """      } else if (action === 'diagnostics') {
        copyDiagnostics();
      } else if (action === 'trade-exit-toggle-all') {
        updateSetting('tradeExitShowAllItems', state.settings.tradeExitShowAllItems !== true);
      } else if (action === 'trade-exit-remove-better') {
        removeTradeExitItems('better-elsewhere').catch((error) => {
          state.tradeExitRemoveBusy = false;
          renderPanel();
          toast(error?.message || 'Bulk trade removal failed.');
        });
      } else if (action === 'trade-record-sale') {
"""
if event_old not in text:
    raise SystemExit('Panel event anchor not found')
text = text.replace(event_old, event_new, 1)

required = (
    '// @version      0.10.1',
    'tradeExitShowAllItems: false',
    'function removeTradeExitItems',
    'data-tsimm-action="trade-exit-remove-better"',
    'overscroll-behavior:contain',
    'previousBodyScroll',
    'Problems-only view hides SELL HERE rows',
)
for marker in required:
    if marker not in text:
        raise SystemExit(f'Missing patch marker: {marker}')
if text == original:
    raise SystemExit('No changes applied')

path.write_text(text, encoding='utf-8')
print('Patched IMM compact Trade Exit Audit and bulk removal to v0.10.1')
