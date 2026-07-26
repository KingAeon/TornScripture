from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    text = text.replace(old, new, 1)


version_count = text.count('0.17.0')
if version_count < 4:
    raise SystemExit(f'version markers: expected at least 4 matches, found {version_count}')
text = text.replace('0.17.0', '0.17.1')

replace_once(
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, local market-velocity learning, priced-trade inventory badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, TornPDA priced-trade inventory badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    'metadata description',
)

replace_once(
    "      #${PRICED_TRADE_PANEL_ID}.waiting{border-color:#4f9bc5;background:#071723f5;color:#c9ecff}#${PRICED_TRADE_PANEL_ID}.mismatch,#${PRICED_TRADE_PANEL_ID}.missing-trader{border-color:#cf5866;background:#250a0df5;color:#ffc2c8}",
    "      #${PRICED_TRADE_PANEL_ID}.inline{position:sticky;left:auto;top:0;z-index:40;width:auto;margin:0 0 6px;transform:none}#${PRICED_TRADE_PANEL_ID}.waiting{border-color:#4f9bc5;background:#071723f5;color:#c9ecff}#${PRICED_TRADE_PANEL_ID}.mismatch,#${PRICED_TRADE_PANEL_ID}.missing-trader{border-color:#cf5866;background:#250a0df5;color:#ffc2c8}",
    'inline priced-trade panel style',
)

replace_once(
    "      return /\\b(?:add|select|choose|include)\\b/i.test(label)\n        || /(?:add|select|choose|include|plus)/i.test(String(control.className || ''))\n        || /^\\s*\\+\\s*$/.test(label);",
    "      return /\\b(?:add|select|choose|include|qty|quantity)\\b/i.test(label)\n        || /(?:add|select|choose|include|qty|quantity|plus)/i.test(String(control.className || ''))\n        || /^\\s*\\+\\s*$/.test(label);",
    'Qty native control support',
)

surface_code = r'''
  function pricedTradeInventorySurface() {
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
  }

'''
replace_once(
    '  function renderPricedTradePanel(verification, decorated = 0, priced = 0) {\n',
    surface_code + '  function renderPricedTradePanel(verification, decorated = 0, priced = 0) {\n',
    'priced-trade inventory surface detector',
)

replace_once(
    "    let panel = document.getElementById(PRICED_TRADE_PANEL_ID);\n    if (!panel) {\n      panel = document.createElement('section');\n      panel.id = PRICED_TRADE_PANEL_ID;\n      panel.dataset.tsimmGenerated = 'true';\n      document.body.appendChild(panel);\n    }\n    panel.className = verification.status;",
    "    const inventorySurface = pricedTradeInventorySurface();\n    let panel = document.getElementById(PRICED_TRADE_PANEL_ID);\n    if (!panel) {\n      panel = document.createElement('section');\n      panel.id = PRICED_TRADE_PANEL_ID;\n      panel.dataset.tsimmGenerated = 'true';\n    }\n    if (inventorySurface) {\n      if (panel.parentElement !== inventorySurface) inventorySurface.prepend(panel);\n    } else if (panel.parentElement !== document.body) {\n      document.body.appendChild(panel);\n    }\n    panel.className = `${verification.status}${inventorySurface ? ' inline' : ''}`;",
    'priced-trade modal panel mount',
)

replace_once(
    "    if (sides.length < 2) {\n      stats.tradeStatus = 'incomplete';\n      stats.notes.push('Trade sides were not recognized. Copy diagnostics from the live trade page.');\n      return;\n    }",
    "    if (sides.length < 2) {\n      stats.tradeStatus = 'incomplete';\n      stats.notes.push('Trade sides were not recognized. Copy diagnostics from the live trade page.');\n      const previous = state.lastScan;\n      const currentTradeId = tradeIdFromLocation() || null;\n      const sameTrade = previous?.pageType === 'trade'\n        && (!currentTradeId || !previous.tradeId || String(previous.tradeId) === String(currentTradeId));\n      if (sameTrade && loadPricedTradeSession()) applyPricedTradeInventoryBadges(previous);\n      return;\n    }",
    'priced-trade modal scan fallback',
)

replace_once(
    "    if (!mySide || !otherSide) {\n      stats.tradeStatus = 'incomplete';\n      stats.notes.push('Could not determine both sides of the trade.');\n      return;\n    }",
    "    if (!mySide || !otherSide) {\n      stats.tradeStatus = 'incomplete';\n      stats.notes.push('Could not determine both sides of the trade.');\n      const previous = state.lastScan;\n      const currentTradeId = tradeIdFromLocation() || null;\n      const sameTrade = previous?.pageType === 'trade'\n        && (!currentTradeId || !previous.tradeId || String(previous.tradeId) === String(currentTradeId));\n      if (sameTrade && loadPricedTradeSession()) applyPricedTradeInventoryBadges(previous);\n      return;\n    }",
    'priced-trade missing-side fallback',
)

path.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.17.1 TornPDA Qty-row priced-trade hotfix.')
