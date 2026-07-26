      .${PRICED_TRADE_BADGE_CLASS}{display:grid!important;gap:1px!important;width:max-content!important;max-width:min(210px,48vw)!important;margin:3px 4px!important;padding:4px 6px!important;border:1px solid #47c968!important;border-radius:5px!important;background:#082611f2!important;color:#caffba!important;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;pointer-events:none!important;box-sizing:border-box!important}
      .${PRICED_TRADE_BADGE_CLASS} strong,.${PRICED_TRADE_BADGE_CLASS} span{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.${PRICED_TRADE_BADGE_CLASS} span{color:#7ebd89!important;font-size:7px!important}
      .${PRICED_TRADE_BADGE_CLASS}.stale{border-color:#c59a39!important;background:#2a2008f2!important;color:#ffe09a!important}.${PRICED_TRADE_BADGE_CLASS}.stale span{color:#c5ad73!important}
      .${PRICED_TRADE_BADGE_CLASS}.outdated{border-color:#b65466!important;background:#270b10f2!important;color:#ffb0bc!important}.${PRICED_TRADE_BADGE_CLASS}.outdated span{color:#c98d96!important}
      .${PRICED_TRADE_BADGE_CLASS}.missing{border-color:#65727a!important;background:#14191cf2!important;color:#c1cbd1!important}.${PRICED_TRADE_BADGE_CLASS}.missing span{color:#8d999f!important}
      .tsimm-priced-trade-start{border-color:#47c968!important;background:#0d3818!important;color:#d4ffc8!important}
    `;
    document.head.appendChild(style);
  }

  function clearPricedTradeAnnotations() {
    document.getElementById(PRICED_TRADE_PANEL_ID)?.remove();
    document.querySelectorAll(`.${PRICED_TRADE_BADGE_CLASS}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${PRICED_TRADE_ROW_CLASS}`).forEach((element) => {
      element.classList.remove(PRICED_TRADE_ROW_CLASS, 'fresh', 'stale', 'outdated', 'missing');
      delete element.dataset.tsimmPricedTradeToken;
    });
  }

  function pricedTradeControlLabel(element) {
    if (!(element instanceof Element)) return '';
    return normalizeWhitespace([
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('value'),
      element.getAttribute('class'),
    ].filter(Boolean).join(' '));
  }

  function pricedTradeNativeAddControl(row) {
    if (!(row instanceof Element)) return null;
    const controls = [...row.querySelectorAll('button,a,[role="button"],input,select,label')]
      .filter((control) =>
        visibleElement(control)
        && !control.disabled
        && !control.closest(`#${APP.panelId},#${APP.traderOverlayId},[data-tsimm-generated]`)
      );
    return controls.find((control) => {
      const label = pricedTradeControlLabel(control);
      if (/\b(?:remove|delete|trash|withdraw)\b/i.test(label)) return false;
      if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(String(control.type || '').toLowerCase())) return true;
      return /\b(?:add|select|choose|include)\b/i.test(label)
        || /(?:add|select|choose|include|plus)/i.test(String(control.className || ''))
        || /^\s*\+\s*$/.test(label);
    }) || null;
  }

  function pricedTradeItemForRow(row, trader) {
    if (!(row instanceof Element) || !trader) return null;
    const itemId = itemIdFromTradeRow(row);
    const priceItems = Array.isArray(trader.pricePageItems) ? trader.pricePageItems : [];
    if (itemId) {
      const captured = priceItems.find((item) => Number(item.itemId) > 0 && Number(item.itemId) === itemId);
      const catalog = catalogItemFor('', itemId);
      if (captured || catalog) {
        return {
          id: catalog?.id || captured?.itemId || itemId,
          name: catalog?.name || captured?.itemName || `Item ${itemId}`,
        };
      }
    }
    const labels = [
      ...row.querySelectorAll('[data-item-name],img[alt],img[title],[aria-label],[title],strong,b,span,p'),
    ].flatMap((element) => [
      element.getAttribute?.('data-item-name'),
      element.getAttribute?.('alt'),
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label'),
      ownText(element),
    ]).map(normalizeWhitespace).filter((label) => label && label.length <= 100);
    for (const label of labels) {
      const catalog = catalogItemFor(label);
      if (catalog) return { id: catalog.id || null, name: catalog.name };
      const captured = priceItems.find((item) => normalizeName(item.itemName) === normalizeName(label));
      if (captured) return { id: captured.itemId || null, name: captured.itemName };
    }
    const haystack = ` ${normalizeName(row.innerText || row.textContent)} `;
    const captured = priceItems
      .filter((item) => item?.itemName)
      .sort((left, right) => String(right.itemName).length - String(left.itemName).length)
      .find((item) => haystack.includes(` ${normalizeName(item.itemName)} `));
