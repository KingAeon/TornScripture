from pathlib import Path

PATH = Path("TornScripture-Item-Market-Margin.user.js")
text = PATH.read_text(encoding="utf-8")

if "// @version      0.9.5" in text and "function runQuickMax" in text:
    print("Quick MAX v0.9.5 already applied.")
    raise SystemExit(0)


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once("// @version      0.9.4", "// @version      0.9.5", "metadata version")
replace_once(
    "// @description  Item-market and overseas profit overlays with trader capture, favorite watchlists, best-exit prompts, purchase history, trade verification, and receipt audits.",
    "// @description  Item-market and overseas profit overlays with Quick MAX, trader capture, favorite watchlists, best-exit prompts, purchase history, trade verification, and receipt audits.",
    "metadata description",
)
replace_once(
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.4' });",
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.5' });",
    "TX owner marker",
)
replace_once(
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.4' });",
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.5' });",
    "watch owner marker",
)
replace_once(
    "   * TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.4",
    "   * TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.5",
    "banner version",
)
replace_once(
    "   * - Purchase capture begins only after the user presses Torn's normal confirmation button.\n"
    "   * - Completed trade sales only update local lot quantities; receipt audits are read-only and never alter sale quantities or costs.\n"
    "   * - The script never clicks Buy, submits purchases, lists items, or sells items.",
    "   * - Normal purchase capture begins after the user presses Torn's confirmation button.\n"
    "   * - Quick MAX can fill Torn's native quantity field; Override MAX can submit only after the user session-arms it and presses IMM's generated MAX button.\n"
    "   * - Completed trade sales only update local lot quantities; receipt audits are read-only and never alter sale quantities or costs.\n"
    "   * - Outside an explicitly armed Override MAX action, the script never submits purchases, lists items, or sells items.",
    "safety boundary",
)
replace_once(
    "    version: '0.9.4',\n"
    "    panelId: 'tornscripture-imm-panel',\n"
    "    styleId: 'tornscripture-imm-style',\n"
    "    badgeClass: 'tsimm-margin-badge',",
    "    version: '0.9.5',\n"
    "    panelId: 'tornscripture-imm-panel',\n"
    "    styleId: 'tornscripture-imm-style',\n"
    "    badgeClass: 'tsimm-margin-badge',\n"
    "    quickMaxButtonClass: 'tsimm-quick-max',\n"
    "    quickMaxRowClass: 'tsimm-quick-max-row',",
    "APP Quick MAX constants",
)
replace_once(
    "    pendingPurchase: normalizePendingPurchase(loadJson(APP.pendingPurchaseStorageKey, null)),\n"
    "    purchaseSignals: [],\n"
    "    recentPurchaseFingerprints: loadJson(APP.recentPurchaseFingerprintsStorageKey, []),",
    "    pendingPurchase: normalizePendingPurchase(loadJson(APP.pendingPurchaseStorageKey, null)),\n"
    "    purchaseSignals: [],\n"
    "    quickMaxOverrideArmed: false,\n"
    "    quickMaxBusy: false,\n"
    "    quickMaxLastActionAt: 0,\n"
    "    recentPurchaseFingerprints: loadJson(APP.recentPurchaseFingerprintsStorageKey, []),",
    "Quick MAX state",
)

quick_max_functions = r'''
  function quickMaxInteractiveLabel(element) {
    if (!(element instanceof Element)) return '';
    return normalizeWhitespace([
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('name'),
      element.getAttribute('value'),
      element.className,
    ].filter(Boolean).join(' '));
  }

  function quickMaxBuyControl(row) {
    if (!(row instanceof Element)) return null;
    const controls = [...row.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .filter((element) =>
        visibleElement(element)
        && !element.disabled
        && !element.closest(`[data-tsimm-generated],#${APP.panelId}`)
      );
    return controls.find((element) => /\b(?:buy|purchase)\b/i.test(quickMaxInteractiveLabel(element)))
      || controls.find((element) => /(?:buy|purchase)/i.test(String(element.className || '')))
      || null;
  }

  function quickMaxQuantityInput(root) {
    if (!(root instanceof Element || root instanceof Document)) return null;
    const selectors = [
      'input[type="number"]',
      'input[inputmode="numeric"]',
      'input[name*="quantity" i]',
      'input[name*="amount" i]',
      'input[id*="quantity" i]',
      'input[id*="amount" i]',
      'input[class*="quantity" i]',
      'input[class*="amount" i]',
    ].join(',');
    const candidates = [...root.querySelectorAll(selectors)].filter((input) =>
      input instanceof HTMLInputElement
      && visibleElement(input)
      && !input.disabled
      && !input.readOnly
      && !input.closest(`#${APP.panelId},[data-tsimm-generated]`)
    );
    return candidates.sort((left, right) => {
      const leftLabel = quickMaxInteractiveLabel(left);
      const rightLabel = quickMaxInteractiveLabel(right);
      const leftScore = Number(/\b(?:quantity|qty|amount|how many)\b/i.test(leftLabel)) * 4
        + Number(left.type === 'number') * 2
        + Number(Boolean(left.max));
      const rightScore = Number(/\b(?:quantity|qty|amount|how many)\b/i.test(rightLabel)) * 4
        + Number(right.type === 'number') * 2
        + Number(Boolean(right.max));
      return rightScore - leftScore;
    })[0] || null;
  }

  function quickMaxSetInput(input, quantity) {
    if (!(input instanceof HTMLInputElement)) return false;
    const value = String(Math.max(1, Math.floor(Number(quantity) || 1)));
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor?.set) descriptor.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
    return Number(input.value) === Number(value);
  }

  function quickMaxMaximum(candidate, input = null, surface = null) {
    const limits = [];
    const listingQuantity = Math.max(0, Math.floor(Number(candidate?.quantity) || 0));
    if (listingQuantity) limits.push(listingQuantity);
    for (const raw of [
      input?.max,
      input?.getAttribute?.('data-max'),
      input?.getAttribute?.('aria-valuemax'),
      input?.dataset?.max,
      input?.dataset?.maximum,
    ]) {
      const value = Math.max(0, Math.floor(parseNumber(raw) || 0));
      if (value) limits.push(value);
    }
    const surfaceText = normalizeWhitespace(surface?.innerText || surface?.textContent || '');
    for (const pattern of [
      /\bmax(?:imum)?\D{0,18}([\d,]+)/i,
      /\b(?:available|stock|quantity|qty)\D{0,18}([\d,]+)/i,
      /\bup to\D{0,12}([\d,]+)/i,
    ]) {
      const value = Math.max(0, Math.floor(parseNumber(surfaceText.match(pattern)?.[1]) || 0));
      if (value) limits.push(value);
    }
    return limits.length ? Math.max(1, Math.min(...limits)) : 1;
  }

  function quickMaxPurchaseSurface() {
    const selectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[class*="dialog" i]',
      '[class*="modal" i]',
      '[class*="popup" i]',
      '[class*="confirm" i]',
    ].join(',');
    const candidates = [...new Set([...document.querySelectorAll(selectors)])].filter((element) => {
      if (!visibleElement(element) || element.closest(`#${APP.panelId},[data-tsimm-generated]`)) return false;
      const text = normalizeWhitespace(element.innerText || element.textContent);
      if (!text || text.length > 5000) return false;
      return Boolean(quickMaxQuantityInput(element))
        || /\b(?:buy|purchase)\b/i.test(text)
        || (/\bYes\b/i.test(text) && /\bNo\b/i.test(text));
    });
    return candidates.sort((left, right) => {
      const leftInput = Number(Boolean(quickMaxQuantityInput(left)));
      const rightInput = Number(Boolean(quickMaxQuantityInput(right)));
      const leftYes = [...left.querySelectorAll('button,a,[role="button"],span,div')].find((element) =>
        /^yes$/i.test(normalizeWhitespace(element.textContent))
      );
      const rightYes = [...right.querySelectorAll('button,a,[role="button"],span,div')].find((element) =>
        /^yes$/i.test(normalizeWhitespace(element.textContent))
      );
      const leftConfirm = Number(Boolean(purchaseConfirmationFromClick(leftYes)));
      const rightConfirm = Number(Boolean(purchaseConfirmationFromClick(rightYes)));
      return rightConfirm - leftConfirm || rightInput - leftInput;
    })[0] || null;
  }

  function quickMaxPrimaryAction(surface) {
    if (!(surface instanceof Element)) return null;
    const controls = [...surface.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .filter((element) => visibleElement(element) && !element.disabled && !element.closest('[data-tsimm-generated]'));
    return controls.find((element) => {
      const label = quickMaxInteractiveLabel(element);
      if (/^(?:yes|no|cancel|close|back)$/i.test(label)) return false;
      return /^(?:buy|purchase|confirm|continue)(?:\b|$)/i.test(label)
        || /\b(?:buy now|complete purchase|confirm purchase)\b/i.test(label);
    }) || null;
  }

  function quickMaxYesButton() {
    const controls = [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],span,div')]
      .filter((element) =>
        visibleElement(element)
        && !element.closest(`#${APP.panelId},[data-tsimm-generated]`)
        && /^yes$/i.test(normalizeWhitespace(element.textContent || element.value))
      );
    return controls.find((element) => Boolean(purchaseConfirmationFromClick(element))) || null;
  }

  function waitForQuickMax(getter, timeoutMs = 1800, intervalMs = 35) {
    const started = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        const value = getter();
        if (value || Date.now() - started >= timeoutMs) {
          resolve(value || null);
          return;
        }
        setTimeout(check, intervalMs);
      };
      check();
    });
  }

  function quickMaxSyntheticPurchase(candidate, quantity) {
    const resolution = resolveListingMarketValue();
    const itemId = resolution.itemId || itemIdFromLocation();
    const catalog = catalogItemFor(resolution.itemName, itemId);
    const itemName = catalog?.name || resolution.itemName || listingItemNameFromPage() || 'Item Market purchase';
    const totalCost = Number(candidate?.price || 0) * Number(quantity || 0);
    return {
      itemName,
      quantity,
      totalCost,
      unitCost: Number(candidate?.price || 0),
      confirmationText: `Quick MAX ${quantity} x ${itemName} for ${formatMoney(totalCost)}`,
    };
  }

  function clearQuickMaxPendingSilently(pendingId) {
    if (!pendingId || state.pendingPurchase?.id !== pendingId) return;
    state.pendingPurchase = null;
    savePendingPurchase();
    renderPanel();
  }

  function quickMaxFailClosed(message, pendingId = '') {
    clearQuickMaxPendingSilently(pendingId);
    if (state.quickMaxOverrideArmed) {
      state.quickMaxOverrideArmed = false;
      renderPanel();
      scheduleScan(20);
    }
    toast(`${message} Override MAX is off.`);
  }

  function decorateQuickMaxCandidate(candidate, scanToken) {
    const row = candidate?.row;
    if (!(row instanceof Element)) return;
    const buyControl = quickMaxBuyControl(row);
    let button = row.querySelector('[data-tsimm-quick-max]');
    if (!buyControl) {
      button?.remove();
      row.classList.remove(APP.quickMaxRowClass);
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.tsimmQuickMax = '1';
      button.dataset.tsimmGenerated = 'true';
      const parent = buyControl.parentElement || row;
      parent.insertBefore(button, buyControl);
    }
    button.className = `${APP.quickMaxButtonClass}${state.quickMaxOverrideArmed ? ' armed' : ''}`;
    button.textContent = state.quickMaxOverrideArmed ? '⚡ MAX' : 'MAX';
    button.title = state.quickMaxOverrideArmed
      ? 'Override MAX armed: fill and submit the maximum purchase'
      : 'Fill the maximum quantity and stop before submission';
    button.setAttribute('aria-label', button.title);
    button.dataset.tsimmScanToken = scanToken;
    button.disabled = Boolean(state.quickMaxBusy);
    row.classList.add(APP.quickMaxRowClass);
  }

  async function runQuickMax(button) {
    if (state.quickMaxBusy || !(button instanceof HTMLElement)) return;
    const row = button.closest(`.${APP.listingMark}`) || button.closest('li,[class*="row"],[class*="listing"]');
    const candidate = listingCandidates().find((entry) => entry.row === row);
    const buyControl = quickMaxBuyControl(row);
    if (!candidate || !buyControl) {
      toast('Quick MAX could not resolve this listing. Refresh and try again.');
      return;
    }

    const override = Boolean(state.quickMaxOverrideArmed);
    state.quickMaxBusy = true;
    state.quickMaxLastActionAt = Date.now();
    scheduleScan(0);
    let maximum = Math.max(1, Math.floor(Number(candidate.quantity) || 1));
    let pendingId = '';

    try {
      const rowInput = quickMaxQuantityInput(row);
      if (rowInput) {
        maximum = quickMaxMaximum(candidate, rowInput, row);
        if (!quickMaxSetInput(rowInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');
        if (!override) {
          toast(`MAX set to ${formatInteger(maximum)}. Press Torn's Buy button when ready.`);
          return;
        }
        beginPendingPurchase(quickMaxSyntheticPurchase(candidate, maximum));
        pendingId = state.pendingPurchase?.id || '';
        buyControl.click();
      } else {
        buyControl.click();
        const surface = await waitForQuickMax(() => quickMaxPurchaseSurface(), 1800);
        if (!surface) throw new Error('Torn did not open a recognizable purchase dialog.');
        const dialogInput = quickMaxQuantityInput(surface);
        if (!dialogInput) throw new Error('Torn opened a purchase dialog without a quantity field.');
        maximum = quickMaxMaximum(candidate, dialogInput, surface);
        if (!quickMaxSetInput(dialogInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');
        if (!override) {
          toast(`MAX set to ${formatInteger(maximum)}. Review Torn's dialog and submit when ready.`);
          return;
        }
        beginPendingPurchase(quickMaxSyntheticPurchase(candidate, maximum));
        pendingId = state.pendingPurchase?.id || '';
        const primary = quickMaxPrimaryAction(surface);
        if (!primary) throw new Error('Torn did not expose a recognizable purchase button.');
        primary.click();
      }

      const yesButton = await waitForQuickMax(() => quickMaxYesButton(), 1600);
      if (yesButton) {
        const parsed = purchaseConfirmationFromClick(yesButton);
        if (!parsed) throw new Error('Torn confirmation could not be verified.');
        if (parsed.quantity <= 0 || parsed.quantity > maximum) {
          throw new Error(`Torn confirmation quantity ${parsed.quantity} exceeded the armed MAX ${maximum}.`);
        }
        const expectedName = quickMaxSyntheticPurchase(candidate, maximum).itemName;
        if (expectedName && normalizeName(parsed.itemName) !== normalizeName(expectedName)) {
          throw new Error('Torn confirmation item did not match the selected listing.');
        }
        const expectedTotal = Number(candidate.price) * Number(parsed.quantity);
        if (expectedTotal > 0 && Math.abs(parsed.totalCost - expectedTotal) > Math.max(1, parsed.quantity)) {
          throw new Error('Torn confirmation total did not match the selected listing price.');
        }
        yesButton.click();
        toast(`Override MAX submitted ${formatInteger(parsed.quantity)}× ${parsed.itemName}.`);
      } else {
        toast(`Override MAX submitted up to ${formatInteger(maximum)}. Waiting for Torn's response.`);
      }
    } catch (error) {
      if (override) quickMaxFailClosed(error?.message || 'Quick MAX stopped on an unrecognized purchase step.', pendingId);
      else toast(error?.message || 'Quick MAX could not fill this purchase.');
    } finally {
      state.quickMaxBusy = false;
      scheduleScan(60);
    }
  }

  function handleQuickMaxClick(event) {
    const button = event.target.closest?.('[data-tsimm-quick-max]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runQuickMax(button);
  }

'''

replace_once(
    "  function scanListings(stats, scanToken) {",
    quick_max_functions + "  function scanListings(stats, scanToken) {",
    "Quick MAX functions",
)

replace_once(
    "    const resolution = resolveListingMarketValue();\n"
    "    stats.visibleMarketValue = resolution.visibleValue;\n"
    "    stats.listingMarketValue = resolution.value;\n"
    "    stats.listingMarketValueSource = resolution.source;\n"
    "    stats.listingItemId = resolution.itemId;\n"
    "    stats.listingItemName = resolution.itemName;\n"
    "    if (!resolution.value) return;",
    "    for (const candidate of candidates) decorateQuickMaxCandidate(candidate, scanToken);\n\n"
    "    const resolution = resolveListingMarketValue();\n"
    "    stats.visibleMarketValue = resolution.visibleValue;\n"
    "    stats.listingMarketValue = resolution.value;\n"
    "    stats.listingMarketValueSource = resolution.source;\n"
    "    stats.listingItemId = resolution.itemId;\n"
    "    stats.listingItemName = resolution.itemName;\n"
    "    if (!resolution.value) return;",
    "decorate listing candidates",
)

replace_once(
    "  function clearMarketAnnotations() {\n"
    "    document.querySelectorAll(`.${APP.badgeClass}`).forEach((element) => element.remove());",
    "  function clearMarketAnnotations() {\n"
    "    document.querySelectorAll('[data-tsimm-quick-max]').forEach((element) => element.remove());\n"
    "    document.querySelectorAll(`.${APP.quickMaxRowClass}`).forEach((element) => element.classList.remove(APP.quickMaxRowClass));\n"
    "    document.querySelectorAll(`.${APP.badgeClass}`).forEach((element) => element.remove());",
    "clear Quick MAX controls",
)

replace_once(
    "  function pruneMarketAnnotations(scanToken) {\n"
    "    document.querySelectorAll(`.${APP.badgeClass}`).forEach((badge) => {",
    "  function pruneMarketAnnotations(scanToken) {\n"
    "    document.querySelectorAll('[data-tsimm-quick-max]').forEach((button) => {\n"
    "      if (button.dataset.tsimmScanToken === scanToken) return;\n"
    "      button.closest(`.${APP.quickMaxRowClass}`)?.classList.remove(APP.quickMaxRowClass);\n"
    "      button.remove();\n"
    "    });\n"
    "    document.querySelectorAll(`.${APP.badgeClass}`).forEach((badge) => {",
    "prune Quick MAX controls",
)

replace_once(
    "      .tsimm-badge-overseas{display:inline-flex;margin-left:6px;vertical-align:middle;position:relative;z-index:3}\n",
    "      .tsimm-badge-overseas{display:inline-flex;margin-left:6px;vertical-align:middle;position:relative;z-index:3}\n"
    "      .${APP.quickMaxButtonClass}{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:38px!important;min-height:28px!important;margin:0 5px!important;padding:4px 6px!important;border:1px solid #67d889!important;border-radius:6px!important;background:#0d3520!important;color:#c9ffda!important;font:900 9px/1 Arial,sans-serif!important;letter-spacing:.03em!important;box-shadow:0 2px 8px #0008!important;cursor:pointer!important}.${APP.quickMaxButtonClass}:disabled{opacity:.5!important;cursor:wait!important}.${APP.quickMaxButtonClass}.armed{border-color:#ff9b4a!important;background:#4b1d08!important;color:#ffe0be!important;box-shadow:0 0 0 1px #ff7a2f66,0 2px 10px #000a!important}\n"
    "      .tsimm-quick-max-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;align-items:center;margin-top:7px;padding:7px;border:1px solid #45614f;border-radius:8px;background:#1d2921}.tsimm-quick-max-card strong{color:#a8f3bd}.tsimm-quick-max-card span{color:#aab8ae;font-size:10px}.tsimm-quick-max-card label{display:flex;align-items:center;gap:5px;font-weight:800;white-space:nowrap}.tsimm-quick-max-card.armed{border-color:#ff873b;background:#35180a}.tsimm-quick-max-card.armed strong,.tsimm-quick-max-card.armed label{color:#ffd1aa}\n",
    "Quick MAX styles",
)

replace_once(
    "      settings: state.settings,\n"
    "      calculationPolicy: {",
    "      settings: state.settings,\n"
    "      quickMax: {\n"
    "        overrideArmed: state.quickMaxOverrideArmed,\n"
    "        busy: state.quickMaxBusy,\n"
    "        lastActionAt: state.quickMaxLastActionAt || null,\n"
    "        visibleButtons: document.querySelectorAll('[data-tsimm-quick-max]').length,\n"
    "      },\n"
    "      calculationPolicy: {",
    "Quick MAX diagnostics",
)

replace_once(
    "    const isMarketPage = isOverseas || stats.pageType === 'category' || stats.pageType.startsWith('item listings');",
    "    const isMarketPage = isOverseas || stats.pageType === 'category' || stats.pageType.startsWith('item listings');\n"
    "    const isItemListings = stats.pageType.startsWith('item listings');",
    "item listings panel flag",
)

replace_once(
    "    const tradeControls = isTrade\n",
    "    const quickMaxControls = isItemListings\n"
    "      ? `<div class=\"tsimm-quick-max-card ${state.quickMaxOverrideArmed ? 'armed' : ''}\">\n"
    "          <div><strong>${state.quickMaxOverrideArmed ? '⚡ OVERRIDE MAX ARMED' : 'Quick MAX safe mode'}</strong><span>${state.quickMaxOverrideArmed ? 'MAX buttons will submit Torn\\'s native purchase flow.' : 'MAX fills the largest visible quantity and stops before submission.'}</span></div>\n"
    "          <label><input type=\"checkbox\" data-tsimm-quick-max-override ${state.quickMaxOverrideArmed ? 'checked' : ''}> 1-tap</label>\n"
    "        </div>`\n"
    "      : '';\n"
    "    const tradeControls = isTrade\n",
    "Quick MAX panel control",
)

replace_once(
    "        ${tradeControls}\n"
    "        ${marketControls}\n",
    "        ${tradeControls}\n"
    "        ${quickMaxControls}\n"
    "        ${marketControls}\n",
    "render Quick MAX panel control",
)

replace_once(
    "  function bindPanelEvents() {\n"
    "    document.addEventListener('click', capturePurchaseIntentFromClick, true);",
    "  function bindPanelEvents() {\n"
    "    document.addEventListener('click', handleQuickMaxClick, true);\n"
    "    document.addEventListener('click', capturePurchaseIntentFromClick, true);",
    "bind Quick MAX click",
)

replace_once(
    "    document.addEventListener('change', (event) => {\n"
    "      const soldToggle = event.target.closest('[data-tsimm-ledger-show-sold]');",
    "    document.addEventListener('change', (event) => {\n"
    "      const quickMaxOverride = event.target.closest('[data-tsimm-quick-max-override]');\n"
    "      if (quickMaxOverride) {\n"
    "        if (quickMaxOverride.checked) {\n"
    "          const accepted = confirm('Arm Override MAX for this page session?\\n\\nPressing an orange ⚡ MAX button will fill the maximum quantity and submit Torn\\'s native purchase flow immediately.\\n\\nThe mode fails closed and disarms when Torn\\'s dialog cannot be verified.');\n"
    "          state.quickMaxOverrideArmed = Boolean(accepted);\n"
    "        } else {\n"
    "          state.quickMaxOverrideArmed = false;\n"
    "        }\n"
    "        renderPanel();\n"
    "        scheduleScan(20);\n"
    "        toast(state.quickMaxOverrideArmed ? 'Override MAX armed for this page session.' : 'Override MAX is off.');\n"
    "        return;\n"
    "      }\n"
    "      const soldToggle = event.target.closest('[data-tsimm-ledger-show-sold]');",
    "bind Quick MAX override",
)

required = [
    "// @version      0.9.5",
    "function runQuickMax",
    "data-tsimm-quick-max-override",
    "quickMaxOverrideArmed: false",
    "Override MAX submitted",
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.5' });",
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f"Missing Quick MAX markers: {missing}")

PATH.write_text(text, encoding="utf-8")
print("Applied Quick MAX v0.9.5.")
