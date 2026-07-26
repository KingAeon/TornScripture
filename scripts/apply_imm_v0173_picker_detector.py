from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    text = text.replace(old, new, 1)


version_count = text.count('0.17.2')
if version_count < 4:
    raise SystemExit(f'version markers: expected at least 4 matches, found {version_count}')
text = text.replace('0.17.2', '0.17.3')

replace_once(
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, pre-trade picker payout badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, resilient pre-trade picker payout badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    'metadata description',
)

old_verification = r'''    if (!counterpartyId && !counterpartyName && !currentTrader) {
      const inventorySurface = pricedTradeInventorySurface();
      const recentHandoff = Date.now() - Number(session.armedAt || 0) <= 15 * 60 * 1000;
      const tradeRoute = /(?:^|\/)trade\.php$/i.test(location.pathname)
        || /(?:^|\/)trade\.php(?:[?#]|$)/i.test(location.href);
      if (inventorySurface && recentHandoff && tradeRoute) {
        return {
          status: 'verified',
          session,
          trader,
          currentTrader: null,
          verificationSource: 'armed-picker',
        };
      }
      return { status: 'waiting', session, trader, currentTrader: null, verificationSource: '' };
    }'''
new_verification = r'''    if (!counterpartyId && !counterpartyName && !currentTrader) {
      const picker = pricedTradePickerEvidence();
      const recentHandoff = Date.now() - Number(session.armedAt || 0) <= 15 * 60 * 1000;
      const tornHost = /(^|\.)torn\.com$/i.test(location.hostname);
      if (picker.active && recentHandoff && tornHost) {
        return {
          status: 'verified',
          session,
          trader,
          currentTrader: null,
          verificationSource: 'armed-picker',
        };
      }
      return { status: 'waiting', session, trader, currentTrader: null, verificationSource: '' };
    }'''
replace_once(old_verification, new_verification, 'picker verification branch')

old_surface = r'''  function pricedTradeInventorySurface() {
    const summaryPattern = /^You are adding\s+[\d,]+\s+items?\s+across\s+[\d,]+\s+categor(?:y|ies)/i;
    const summaries = [...document.querySelectorAll('div,span,p,strong')]
      .filter((element) => visibleElement(element)
        && summaryPattern.test(normalizeWhitespace(ownText(element) || element.textContent))
        && !element.closest(`#${APP.panelId},#${APP.traderOverlayId},[data-tsimm-generated]`));
    for (const summary of summaries) {
      let node = summary;
      for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
        if (!(node instanceof Element) || node === document.body) continue;
        const text = normalizeWhitespace(node.innerText || node.textContent);
        if (!text || text.length > 30000 || !/\bADD TO TRADE\b/i.test(text)) continue;
        const controls = [...node.querySelectorAll('button,a,[role="button"],input,label')]
          .filter((control) => visibleElement(control)
            && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},[data-tsimm-generated]`));
        const hasAddToTrade = controls.some((control) => /^add to trade$/i.test(pricedTradeControlLabel(control)));
        const hasItemControls = controls.some((control) => /^qty$/i.test(pricedTradeControlLabel(control))
          || (control instanceof HTMLInputElement
            && ['checkbox', 'radio'].includes(String(control.type || '').toLowerCase())));
        if (hasAddToTrade && hasItemControls) return node;
      }
    }
    return null;
  }'''
new_surface = r'''  function pricedTradePickerEvidence() {
    const ignored = `#${APP.panelId},#${APP.traderOverlayId},[data-tsimm-generated]`;
    const bodyText = normalizeWhitespace(document.body?.innerText || document.body?.textContent || '');
    const headingPattern = /\bwhich items would you like to add to trade\??\b/i;
    const summaryPattern = /\byou are adding\s+[\d,]+\s+items?\s+across\s+[\d,]+\s+categor(?:y|ies)\b/i;
    const controls = [...document.querySelectorAll('button,a,[role="button"],input,label')]
      .filter((control) => visibleElement(control) && !control.closest(ignored));
    const addControl = controls.find((control) => /\badd\s+to\s+trade\b/i.test(pricedTradeControlLabel(control))) || null;
    const itemControls = controls.filter((control) => {
      const label = pricedTradeControlLabel(control);
      if (/\bqty\b/i.test(label)) return true;
      return control instanceof HTMLInputElement
        && ['checkbox', 'radio'].includes(String(control.type || '').toLowerCase());
    });
    const textEvidence = headingPattern.test(bodyText) || summaryPattern.test(bodyText);
    const active = Boolean(addControl && itemControls.length && textEvidence);
    let surface = null;
    if (active) {
      let node = addControl;
      for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
        if (!(node instanceof Element) || node === document.body) continue;
        const text = normalizeWhitespace(node.innerText || node.textContent);
        if (!text || text.length > 30000) continue;
        const containsItemControl = itemControls.some((control) => node.contains(control));
        if (!containsItemControl) continue;
        if (headingPattern.test(text) || summaryPattern.test(text)) {
          surface = node;
          break;
        }
      }
    }
    return { active, surface, addControl, itemControls };
  }

  function pricedTradeInventorySurface() {
    return pricedTradePickerEvidence().surface;
  }'''
replace_once(old_surface, new_surface, 'resilient picker evidence')

path.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.17.3 resilient TornPDA picker detector hotfix.')
