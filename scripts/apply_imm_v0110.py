from pathlib import Path
import hashlib

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return source.replace(old, new, 1)


def protected_quick_max(source: str) -> str:
    start = source.index('  function quickMaxInteractiveLabel(')
    end = source.index('\n  function scanListings(', start)
    return source[start:end]

quick_max_before = hashlib.sha256(protected_quick_max(text).encode()).hexdigest()

text = text.replace('0.10.9', '0.11.0')

old_item_id = '''  function itemIdFromCard(card) {
    const candidates = [
      ...card.querySelectorAll('[data-item-id],[data-itemid],[data-id],a[href],img[src]'),
      card,
    ];
    for (const element of candidates) {
      for (const value of [
        element.getAttribute?.('data-item-id'),
        element.getAttribute?.('data-itemid'),
        element.getAttribute?.('href'),
        element.getAttribute?.('src'),
      ]) {
        const text = String(value || '');
        const match = text.match(/(?:item(?:id|ID)?[=/]|items?\\/)(\\d{1,6})(?:\\D|$)/);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function catalogItemFor(name, itemId = null) {
    if (itemId && state.catalog.itemsById?.[String(itemId)]) return state.catalog.itemsById[String(itemId)];
    return state.catalog.itemsByName?.[normalizeName(name)] || null;
  }
'''
new_item_id = '''  function itemIdFromCard(card) {
    if (!(card instanceof Element)) return null;
    const candidates = [
      ...card.querySelectorAll('[data-item-id],[data-itemid],[data-id],a[href],img[src]'),
      card,
    ];
    for (const element of candidates) {
      for (const value of [
        element.getAttribute?.('data-item-id'),
        element.getAttribute?.('data-itemid'),
        element.getAttribute?.('data-id'),
        element.getAttribute?.('href'),
        element.getAttribute?.('src'),
      ]) {
        const valueText = String(value || '');
        const match = valueText.match(/[?&#](?:itemID|itemId|item_id|ID|id)=(\\d{1,6})(?:\\D|$)/i)
          || valueText.match(/\\/(?:images\\/)?items?\\/(\\d{1,6})(?:\\/|\\.|$)/i)
          || valueText.match(/(?:item(?:id|ID)?[=\\/_-])(\\d{1,6})(?:\\D|$)/i);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function catalogItemFor(name, itemId = null) {
    if (itemId && state.catalog.itemsById?.[String(itemId)]) return state.catalog.itemsById[String(itemId)];
    return state.catalog.itemsByName?.[normalizeName(name)] || null;
  }

  function catalogItemForCard(card, name = '', itemId = null) {
    const direct = catalogItemFor(name, itemId);
    if (direct || !(card instanceof Element)) return direct;

    const labels = [
      ...card.querySelectorAll('img[alt],img[title],[aria-label],[title],[data-item-name]'),
    ].flatMap((element) => [
      element.getAttribute?.('alt'),
      element.getAttribute?.('title'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('data-item-name'),
    ]).map(normalizeWhitespace).filter(Boolean);
    for (const label of labels) {
      const match = catalogItemFor(label);
      if (match) return match;
    }

    const cardName = ` ${normalizeName(card.innerText || card.textContent)} `;
    if (!cardName.trim()) return null;
    return Object.values(state.catalog.itemsByName || {})
      .filter((item) => item?.normalizedName && cardName.includes(` ${item.normalizedName} `))
      .sort((left, right) => right.normalizedName.length - left.normalizedName.length)[0]
      || null;
  }
'''
text = replace_once(text, old_item_id, new_item_id, 'item ID and card matcher')

old_category = '''  function categoryCandidates() {
    const candidates = [];
    const seen = new Set();
    const categoryPriceRegex = /^\\$[\\d,.]+\\s*\\([\\d,]+\\)$/;
    const priceElements = marketTextElements(categoryPriceRegex);
    for (const priceElement of priceElements) {
      const priceText = normalizeWhitespace(ownText(priceElement) || priceElement.innerText || priceElement.textContent);
      const match = priceText.match(/^\\$([\\d,.]+)\\s*\\(([\\d,]+)\\)$/);
      if (!match) continue;
      const card = priceElement.closest(`.${APP.categoryMark}`) || findCategoryCard(priceElement);
      if (!card || seen.has(card)) continue;
      seen.add(card);
      const name = extractCategoryName(card, priceText);
      candidates.push({
        card,
        priceElement,
        name,
        itemId: itemIdFromCard(card),
        lowestPrice: parseNumber(match[1]),
        marketQuantity: parseNumber(match[2]),
      });
    }
    return candidates;
  }
'''
new_category = '''  function categoryCandidates() {
    const candidates = [];
    const seen = new Set();
    const categoryPriceRegex = /^\\$[\\d,.]+\\s*\\([\\d,]+\\)$/;
    const addCard = (card, priceElement = null) => {
      if (!(card instanceof Element) || seen.has(card)) return;
      const cardText = normalizeWhitespace(card.innerText || card.textContent);
      if (!cardText || cardText.length > 280 || /\\b(?:Owner|Qty|Buy|MAX)\\b/i.test(cardText)) return;
      const match = cardText.match(/\\$([\\d,.]+)\\s*\\(([\\d,]+)\\)/);
      if (!match) return;
      const exactPriceElement = priceElement || [...card.querySelectorAll('span,div,p,strong,b')]
        .find((element) => categoryPriceRegex.test(normalizeWhitespace(ownText(element) || element.textContent)))
        || card;
      const priceText = normalizeWhitespace(ownText(exactPriceElement) || exactPriceElement.textContent || match[0]);
      const name = extractCategoryName(card, priceText) || extractCategoryName(card, match[0]);
      seen.add(card);
      candidates.push({
        card,
        priceElement: exactPriceElement,
        name,
        itemId: itemIdFromCard(card),
        lowestPrice: parseNumber(match[1]),
        marketQuantity: parseNumber(match[2]),
      });
    };

    const priceElements = marketTextElements(categoryPriceRegex);
    for (const priceElement of priceElements) {
      const card = priceElement.closest(`.${APP.categoryMark}`) || findCategoryCard(priceElement);
      addCard(card, priceElement);
    }

    // TornPDA occasionally merges the title and price into one React text node.
    // Image-first recovery keeps the multi-item grid working when there is no
    // standalone price element for marketTextElements() to discover.
    for (const image of document.querySelectorAll('img')) {
      if (!visibleElement(image) || image.closest(`#${APP.panelId},[data-tsimm-generated]`)) continue;
      addCard(findCategoryCard(image));
    }
    return candidates;
  }
'''
text = replace_once(text, old_category, new_category, 'category candidates')

old_scan_category = '''    for (const candidate of candidates) {
      const catalog = catalogItemFor(candidate.name, candidate.itemId);
      if (!catalog || !candidate.lowestPrice) continue;
      const margin = marketAnalysisFor(candidate.lowestPrice, catalog, 1);
'''
new_scan_category = '''    for (const candidate of candidates) {
      const catalog = catalogItemForCard(candidate.card, candidate.name, candidate.itemId);
      if (!catalog || !candidate.lowestPrice) continue;
      candidate.name = catalog.name;
      candidate.itemId = candidate.itemId || catalog.id || null;
      const margin = marketAnalysisFor(candidate.lowestPrice, catalog, 1);
'''
text = replace_once(text, old_scan_category, new_scan_category, 'category scan matcher')

old_route = '''    const routeMatch = href.includes('shops.php')
      || href.includes('foreignshop')
      || href.includes('travelshop')
      || href.includes('abroad');
'''
new_route = '''    const routeMatch = href.includes('shops.php')
      || href.includes('foreignshop')
      || href.includes('travelshop')
      || href.includes('abroad')
      || href.includes('travel.php')
      || href.includes('sid=shops')
      || href.includes('sid=shop')
      || href.includes('#/shops')
      || href.includes('#/shop');
'''
text = replace_once(text, old_route, new_route, 'overseas route detection')

old_overseas_candidates = '''  function overseasCandidates() {
    const candidates = [];
    const seen = new Set();
    const priceElements = marketTextElements(/^\\$[\\d,.]+$/, 'span,div,p,strong,b,td');
    for (const priceElement of priceElements) {
      const row = priceElement.closest(`.${APP.overseasMark}`) || overseasRowForPrice(priceElement);
      if (!row || seen.has(row)) continue;
      const priceText = normalizeWhitespace(ownText(priceElement) || priceElement.innerText || priceElement.textContent);
      const price = parseNumber(priceText);
      if (!Number.isFinite(price) || price <= 0) continue;
      const itemId = itemIdFromCard(row);
      const name = overseasItemName(row, priceText);
      if (!name && !itemId) continue;
      seen.add(row);
      candidates.push({
        row,
        priceElement,
        price,
        name,
        itemId,
        availableQuantity: overseasAvailableQuantity(row, priceElement),
      });
    }
    return candidates;
  }
'''
new_overseas_candidates = '''  function overseasCandidates() {
    const candidates = [];
    const seen = new Set();
    const overseasPriceRegex = /^(?:(?:cost|price)\\s*:?\\s*)?\\$[\\d,.]+$/i;
    const priceElements = marketTextElements(overseasPriceRegex, 'span,div,p,strong,b,td');
    for (const priceElement of priceElements) {
      const row = priceElement.closest(`.${APP.overseasMark}`) || overseasRowForPrice(priceElement);
      if (!row || seen.has(row)) continue;
      const priceText = normalizeWhitespace(ownText(priceElement) || priceElement.innerText || priceElement.textContent);
      const price = parseNumber(priceText.match(/\\$[\\d,.]+/)?.[0] || priceText);
      if (!Number.isFinite(price) || price <= 0) continue;
      const itemId = itemIdFromCard(row);
      const name = overseasItemName(row, priceText);
      if (!name && !itemId) continue;
      seen.add(row);
      candidates.push({
        row,
        priceElement,
        price,
        name,
        itemId,
        availableQuantity: overseasAvailableQuantity(row, priceElement),
      });
    }
    return candidates;
  }
'''
text = replace_once(text, old_overseas_candidates, new_overseas_candidates, 'overseas candidates')

old_clear = '''    document.querySelectorAll(`.${APP.overseasMark}`).forEach((element) => clearTierMark(element, APP.overseasMark));
  }
'''
new_clear = '''    document.querySelectorAll(`.${APP.overseasMark}`).forEach((element) => clearTierMark(element, APP.overseasMark));
    clearOverseasPlanAnnotations();
  }
'''
text = replace_once(text, old_clear, new_clear, 'overseas annotation cleanup')

ui_functions = r'''

  function clearOverseasPlanAnnotations() {
    document.querySelectorAll('[data-tsimm-overseas-plan-ui]').forEach((element) => element.remove());
    document.querySelectorAll('.tsimm-overseas-planned').forEach((element) => {
      element.classList.remove('tsimm-overseas-planned');
      delete element.dataset.tsimmOverseasPlanRank;
    });
    document.querySelectorAll('.tsimm-overseas-buy-line').forEach((element) => element.remove());
  }

  function overseasPlanItemKey(item) {
    const itemId = Number(item?.itemId || item?.catalog?.id) || 0;
    return itemId > 0 ? `id:${itemId}` : `name:${normalizeName(item?.name || item?.catalog?.name)}`;
  }

  function applyOverseasPagePlan(candidates, priced, plan, stats, scanToken) {
    clearOverseasPlanAnnotations();
    const anchorRow = candidates[0]?.row || priced[0]?.row;
    if (!(anchorRow instanceof Element)) return;

    const plannedByItem = new Map((plan.items || []).map((item, index) => [
      overseasPlanItemKey(item),
      { ...item, rank: index + 1 },
    ]));

    for (const item of priced) {
      const planned = plannedByItem.get(overseasPlanItemKey(item));
      if (!planned || !(item.row instanceof Element)) continue;
      item.row.classList.add('tsimm-overseas-planned');
      item.row.dataset.tsimmOverseasPlanRank = String(planned.rank);
      item.row.dataset.tsimmScanToken = scanToken;
      const badge = directMarginBadge(item.priceElement, 'overseas');
      if (badge) {
        const line = document.createElement('span');
        line.className = 'tsimm-overseas-buy-line';
        line.dataset.tsimmOverseasPlanUi = 'true';
        line.textContent = `#${planned.rank} BUY ${formatInteger(planned.quantity)} · +${formatMoney(planned.profit)} trip`;
        badge.appendChild(line);
        badge.classList.add('tsimm-overseas-planned-badge');
      }
    }

    const card = document.createElement('section');
    card.className = 'tsimm-overseas-page-plan';
    card.dataset.tsimmOverseasPlanUi = 'true';
    card.dataset.tsimmScanToken = scanToken;
    const remaining = Math.max(0, Number(stats.overseasRemainingCapacity) || 0);
    const planLines = (plan.items || []).slice(0, 5).map((item, index) =>
      `<div><span><b>#${index + 1}</b> ${escapeHtml(item.name)} × ${formatInteger(item.quantity)} · +${escapeHtml(formatMoney(item.profitEach))} ea</span><strong>+${escapeHtml(formatMoney(item.profit))}</strong></div>`
    ).join('');
    const remainder = (plan.items || []).length > 5
      ? `<small>+${formatInteger(plan.items.length - 5)} more planned item type${plan.items.length - 5 === 1 ? '' : 's'}</small>`
      : '';
    let message = '';
    if (!remaining) message = 'Your configured travel load is already full.';
    else if (!priced.length && candidates.length) message = 'Shop rows found, but none matched the cached catalog. Open IMM and press Sync values.';
    else if (!(plan.items || []).length) message = 'No profitable 99% exit was found for the remaining slots.';
    else message = `${formatInteger(plan.plannedQuantity)} of ${formatInteger(remaining)} open slots planned · cost ${formatMoney(plan.totalCost)} · return ${formatMoney(plan.traderReturn)}`;

    card.innerHTML = `
      <div class="tsimm-overseas-page-plan-head">
        <strong>✈️ IMM BEST LOAD</strong>
        <b>${plan.profit > 0 ? `+${escapeHtml(formatMoney(plan.profit))}` : escapeHtml(formatMoney(plan.profit))} trip profit</b>
      </div>
      <span>${escapeHtml(message)}</span>
      ${planLines ? `<div class="tsimm-overseas-page-plan-list">${planLines}</div>${remainder}` : ''}
    `;

    let anchor = anchorRow;
    if (anchorRow.tagName === 'TR') anchor = anchorRow.closest('table') || anchorRow;
    else {
      const list = anchorRow.closest('ul,ol,[class*="shop-list"],[class*="items-list"],[class*="stock"]');
      if (list && list !== document.body) anchor = list;
    }
    if (anchor.parentElement) anchor.insertAdjacentElement('beforebegin', card);
    else document.body.prepend(card);
  }
'''
text = replace_once(text, '\n\n  function scanOverseas(stats, scanToken) {', ui_functions + '\n\n  function scanOverseas(stats, scanToken) {', 'overseas page plan functions')

old_scan_overseas = '''    const priced = [];
    for (const candidate of candidates) {
      const catalog = catalogItemFor(candidate.name, candidate.itemId);
      if (!catalog) continue;
      const visibleQuantity = Math.max(1, Math.floor(Number(candidate.availableQuantity) || 1));
      const margin = marginFor(candidate.price, catalog.marketPrice, visibleQuantity);
      addBadge(candidate.priceElement, margin, 'overseas', candidate.row, scanToken);
      const item = { ...candidate, catalog, margin };
      priced.push(item);
'''
new_scan_overseas = '''    const priced = [];
    for (const candidate of candidates) {
      const catalog = catalogItemForCard(candidate.row, candidate.name, candidate.itemId);
      if (!catalog) continue;
      const visibleQuantity = Math.max(1, Math.floor(Number(candidate.availableQuantity) || 1));
      const margin = marginFor(candidate.price, catalog.marketPrice, visibleQuantity);
      addBadge(candidate.priceElement, margin, 'overseas', candidate.row, scanToken);
      const item = {
        ...candidate,
        name: catalog.name,
        itemId: candidate.itemId || catalog.id || null,
        catalog,
        margin,
      };
      priced.push(item);
'''
text = replace_once(text, old_scan_overseas, new_scan_overseas, 'overseas scan matcher')

old_plan_end = '''    stats.overseasPlanProfit = plan.profit;
    stats.overseasPlanItems = plan.items;

    const countryKey = normalizeName(stats.overseasCountry);
'''
new_plan_end = '''    stats.overseasPlanProfit = plan.profit;
    stats.overseasPlanItems = plan.items;
    applyOverseasPagePlan(candidates, priced, plan, stats, scanToken);

    const countryKey = normalizeName(stats.overseasCountry);
'''
text = replace_once(text, old_plan_end, new_plan_end, 'overseas plan render call')

old_plan_lines = '''    const planLines = (stats.overseasPlanItems || []).map((item) =>
      `<div><span>${escapeHtml(item.name)} × ${formatInteger(item.quantity)}</span><strong>+${escapeHtml(formatMoney(item.profit))}</strong></div>`
    ).join('');
'''
new_plan_lines = '''    const planLines = (stats.overseasPlanItems || []).map((item, index) =>
      `<div><span>#${index + 1} ${escapeHtml(item.name)} × ${formatInteger(item.quantity)} · +${escapeHtml(formatMoney(item.profitEach))} ea</span><strong>+${escapeHtml(formatMoney(item.profit))}</strong></div>`
    ).join('');
'''
text = replace_once(text, old_plan_lines, new_plan_lines, 'overseas panel ranked lines')

old_css = '''      .tsimm-overseas-card{margin:8px 0;padding:8px;border:1px solid #4d5967;border-radius:9px;background:#20272d}.tsimm-overseas-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-overseas-title strong{flex:1;color:#a7d9ff}.tsimm-overseas-title span{font-size:9px;color:#9eb2c2;text-transform:uppercase}.tsimm-overseas-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.tsimm-overseas-grid span{color:#aebbc4}.tsimm-overseas-grid strong{text-align:right}.tsimm-overseas-profit{color:#63df9f}.tsimm-overseas-plan{margin-top:7px;padding-top:6px;border-top:1px solid #3e4a53;display:grid;gap:3px;max-height:110px;overflow:auto}.tsimm-overseas-plan>div{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:10px}.tsimm-overseas-plan span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d4dc}
'''
new_css = '''      .tsimm-overseas-card{margin:8px 0;padding:8px;border:1px solid #4d5967;border-radius:9px;background:#20272d}.tsimm-overseas-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}.tsimm-overseas-title strong{flex:1;color:#a7d9ff}.tsimm-overseas-title span{font-size:9px;color:#9eb2c2;text-transform:uppercase}.tsimm-overseas-grid{display:grid;grid-template-columns:1fr auto;gap:3px 8px}.tsimm-overseas-grid span{color:#aebbc4}.tsimm-overseas-grid strong{text-align:right}.tsimm-overseas-profit{color:#63df9f}.tsimm-overseas-plan{margin-top:7px;padding-top:6px;border-top:1px solid #3e4a53;display:grid;gap:3px;max-height:110px;overflow:auto}.tsimm-overseas-plan>div{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:10px}.tsimm-overseas-plan span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d4dc}
      .tsimm-overseas-page-plan{box-sizing:border-box;margin:7px 0;padding:8px;border:1px solid #54c8ed;border-radius:8px;background:#061b25f5;color:#ccefff;box-shadow:0 4px 14px #0009;font:700 10px/1.25 Arial,sans-serif}.tsimm-overseas-page-plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px}.tsimm-overseas-page-plan-head strong{color:#8ee8ff}.tsimm-overseas-page-plan-head b{color:#68e69a}.tsimm-overseas-page-plan>span,.tsimm-overseas-page-plan>small{display:block;color:#9ebdca}.tsimm-overseas-page-plan-list{display:grid;gap:2px;margin-top:6px;padding-top:5px;border-top:1px solid #315365}.tsimm-overseas-page-plan-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.tsimm-overseas-page-plan-list span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsimm-overseas-page-plan-list b{color:#8ee8ff}.tsimm-overseas-page-plan-list strong{color:#68e69a}.tsimm-overseas-planned{box-shadow:inset 3px 0 #54c8ed!important}.tsimm-overseas-planned-badge{border-color:#54c8ed!important}.tsimm-overseas-buy-line{color:#8ee8ff!important;font-weight:900!important;opacity:1!important}
'''
text = replace_once(text, old_css, new_css, 'overseas page plan styles')

quick_max_after = hashlib.sha256(protected_quick_max(text).encode()).hexdigest()
if quick_max_after != quick_max_before:
    raise SystemExit('Protected Quick MAX block changed')
if '@require' in text:
    raise SystemExit('Refusing to publish wrapper build')
if len(text) < 200_000:
    raise SystemExit('Userscript unexpectedly truncated')

path.write_text(text, encoding='utf-8')
print('IMM v0.11.0 patch applied successfully')
