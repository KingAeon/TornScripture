from pathlib import Path

PATH = Path("TornScripture-Item-Market-Margin.user.js")
text = PATH.read_text(encoding="utf-8")

if "// @version      0.9.6" in text and "function quickMaxConfirmationAction" in text:
    print("Quick MAX mobile v0.9.6 already applied.")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)

replace_once("// @version      0.9.5", "// @version      0.9.6", "metadata version")
replace_once("ITEM MARKET MARGIN v0.9.5", "ITEM MARKET MARGIN v0.9.6", "header version")
for label in ("core TX capability", "core watchlist capability", "app version"):
    replace_once("version: '0.9.5'", "version: '0.9.6'", label)

old_helpers = '''  function quickMaxYesButton() {
    const controls = [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],span,div')]
      .filter((element) =>
        visibleElement(element)
        && !element.closest(`#${APP.panelId},[data-tsimm-generated]`)
        && /^yes$/i.test(normalizeWhitespace(element.textContent || element.value))
      );
    return controls.find((element) => Boolean(purchaseConfirmationFromClick(element))) || null;
  }

  function waitForQuickMax(getter, timeoutMs = 1800, intervalMs = 35) {'''
new_helpers = '''  function quickMaxYesButton() {
    const controls = [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],span,div')]
      .filter((element) =>
        visibleElement(element)
        && !element.closest(`#${APP.panelId},[data-tsimm-generated]`)
        && /^yes$/i.test(normalizeWhitespace(element.textContent || element.value))
      );
    return controls.find((element) => Boolean(purchaseConfirmationFromClick(element))) || null;
  }

  function quickMaxConfirmationAction(surface = null) {
    const roots = surface instanceof Element ? [surface] : [];
    if (!roots.length) {
      roots.push(...document.querySelectorAll('[role="dialog"],[aria-modal="true"],[class*="dialog" i],[class*="modal" i],[class*="popup" i],[class*="confirm" i]'));
    }
    for (const root of roots) {
      if (!(root instanceof Element) || !visibleElement(root)) continue;
      const parsed = parsePurchaseConfirmationText(root.innerText || root.textContent || '');
      if (!parsed) continue;
      const controls = [...root.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],span,div')]
        .filter((element) =>
          visibleElement(element)
          && !element.disabled
          && !element.closest(`#${APP.panelId},[data-tsimm-generated]`)
        );
      const button = controls.find((element) => /^yes$/i.test(normalizeWhitespace(element.textContent || element.value)))
        || controls.find((element) => /^(?:buy|purchase|confirm|continue)(?:\\b|$)/i.test(quickMaxInteractiveLabel(element)))
        || controls.find((element) => /\\b(?:buy now|complete purchase|confirm purchase)\\b/i.test(quickMaxInteractiveLabel(element)));
      if (button) return { button, parsed, surface: root };
    }
    return null;
  }

  function quickMaxVerifyConfirmation(parsed, candidate, maximum) {
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
    return parsed;
  }

  function waitForQuickMax(getter, timeoutMs = 1800, intervalMs = 35) {'''
replace_once(old_helpers, new_helpers, "confirmation helpers")

start = text.index("  async function runQuickMax(button) {")
end = text.index("\n  function handleQuickMaxClick(event) {", start)
new_run = '''  async function runQuickMax(button) {
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
        const directConfirmation = quickMaxConfirmationAction(surface);
        if (directConfirmation) {
          const parsed = quickMaxVerifyConfirmation(directConfirmation.parsed, candidate, maximum);
          if (!override) {
            toast(`Torn opened a verified purchase confirmation for ${formatInteger(parsed.quantity)}. Review it and submit when ready.`);
            return;
          }
          beginPendingPurchase(parsed);
          pendingId = state.pendingPurchase?.id || '';
          directConfirmation.button.click();
          toast(`Override MAX submitted ${formatInteger(parsed.quantity)}× ${parsed.itemName}.`);
          return;
        }
        const dialogInput = quickMaxQuantityInput(surface);
        if (!dialogInput) throw new Error('Torn opened a purchase dialog without a quantity field or verified confirmation.');
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

      const confirmation = await waitForQuickMax(() => quickMaxConfirmationAction(), 1600);
      if (confirmation) {
        const parsed = quickMaxVerifyConfirmation(confirmation.parsed, candidate, maximum);
        confirmation.button.click();
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
'''
text = text[:start] + new_run + text[end:]
PATH.write_text(text, encoding="utf-8")
print("Applied Quick MAX mobile v0.9.6.")
