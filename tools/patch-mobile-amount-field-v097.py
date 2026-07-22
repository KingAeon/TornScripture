from pathlib import Path

PATH = Path("TornScripture-Item-Market-Margin.user.js")
text = PATH.read_text(encoding="utf-8")

if "// @version      0.9.7" in text and "function quickMaxQuantityValue" in text:
    print("Mobile amount field v0.9.7 already applied.")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once("// @version      0.9.6", "// @version      0.9.7", "metadata version")
replace_once("ITEM MARKET MARGIN v0.9.6", "ITEM MARKET MARGIN v0.9.7", "header version")
replace_once(
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.6' });",
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.7' });",
    "core capture capability",
)
replace_once(
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.6' });",
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.7' });",
    "core watchlist capability",
)
replace_once("    version: '0.9.6',", "    version: '0.9.7',", "app version")

old_controls = '''  function quickMaxQuantityInput(root) {
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
      const leftScore = Number(/\\b(?:quantity|qty|amount|how many)\\b/i.test(leftLabel)) * 4
        + Number(left.type === 'number') * 2
        + Number(Boolean(left.max));
      const rightScore = Number(/\\b(?:quantity|qty|amount|how many)\\b/i.test(rightLabel)) * 4
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
'''

new_controls = '''  function quickMaxQuantityValue(control) {
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      return normalizeWhitespace(control.value);
    }
    if (!(control instanceof Element)) return '';
    return normalizeWhitespace(
      control.getAttribute('aria-valuenow')
      || control.getAttribute('data-value')
      || control.textContent
      || ''
    );
  }

  function quickMaxQuantityInput(root) {
    if (!(root instanceof Element || root instanceof Document)) return null;
    const selectors = [
      'input[type="number"]',
      'input[type="text"]',
      'input:not([type])',
      'input[inputmode="numeric"]',
      'input[inputmode="decimal"]',
      'input[name*="quantity" i]',
      'input[name*="amount" i]',
      'input[id*="quantity" i]',
      'input[id*="amount" i]',
      'input[class*="quantity" i]',
      'input[class*="amount" i]',
      'textarea',
      '[contenteditable="true"]',
      '[role="spinbutton"]',
    ].join(',');
    const candidates = [...new Set([...root.querySelectorAll(selectors)])].filter((control) => {
      if (!(control instanceof HTMLElement) || !visibleElement(control)) return false;
      if (control.closest(`#${APP.panelId},[data-tsimm-generated]`)) return false;
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
        if (control.disabled || control.readOnly) return false;
      } else if (control.getAttribute('aria-disabled') === 'true') {
        return false;
      }
      const value = quickMaxQuantityValue(control);
      const label = quickMaxInteractiveLabel(control);
      const context = normalizeWhitespace(control.parentElement?.innerText || control.parentElement?.textContent || '');
      return /^\\d[\\d,]*$/.test(value)
        || /\\b(?:quantity|qty|amount|how many)\\b/i.test(`${label} ${context}`);
    });
    const score = (control) => {
      const label = quickMaxInteractiveLabel(control);
      const context = normalizeWhitespace(control.parentElement?.innerText || control.parentElement?.textContent || '');
      const value = quickMaxQuantityValue(control);
      const inputType = control instanceof HTMLInputElement ? String(control.type || '').toLowerCase() : '';
      return Number(/\\b(?:quantity|qty|amount|how many)\\b/i.test(`${label} ${context}`)) * 6
        + Number(/^\\d[\\d,]*$/.test(value)) * 4
        + Number(inputType === 'number') * 3
        + Number(inputType === 'text' || control instanceof HTMLTextAreaElement) * 2
        + Number(control.getAttribute('contenteditable') === 'true') * 2
        + Number(control.getAttribute('role') === 'spinbutton') * 2
        + Number(Boolean(control.getAttribute('max') || control.getAttribute('data-max') || control.getAttribute('aria-valuemax')));
    };
    return candidates.sort((left, right) => score(right) - score(left))[0] || null;
  }

  function quickMaxSetInput(control, quantity) {
    if (!(control instanceof HTMLElement)) return false;
    const value = String(Math.max(1, Math.floor(Number(quantity) || 1)));
    control.focus?.();
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      const prototype = control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor?.set) descriptor.set.call(control, value);
      else control.value = value;
    } else {
      control.textContent = value;
      if (control.getAttribute('role') === 'spinbutton') control.setAttribute('aria-valuenow', value);
      if (control.hasAttribute('data-value')) control.setAttribute('data-value', value);
    }
    if (typeof InputEvent === 'function') {
      control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    } else {
      control.dispatchEvent(new Event('input', { bubbles: true }));
    }
    control.dispatchEvent(new Event('change', { bubbles: true }));
    control.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
    return parseNumber(quickMaxQuantityValue(control)) === Number(value);
  }
'''
replace_once(old_controls, new_controls, "mobile amount controls")

replace_once(
    "        if (!quickMaxSetInput(rowInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');",
    "        if (!quickMaxSetInput(rowInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');\n        const rowApplied = await waitForQuickMax(() => parseNumber(quickMaxQuantityValue(rowInput)) === maximum ? rowInput : null, 500);\n        if (!rowApplied) throw new Error('Torn reverted the MAX quantity field update.');",
    "row amount verification",
)
replace_once(
    "        if (!quickMaxSetInput(dialogInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');",
    "        if (!quickMaxSetInput(dialogInput, maximum)) throw new Error('Torn rejected the MAX quantity field update.');\n        const dialogApplied = await waitForQuickMax(() => parseNumber(quickMaxQuantityValue(dialogInput)) === maximum ? dialogInput : null, 500);\n        if (!dialogApplied) throw new Error('Torn reverted the MAX quantity field update.');",
    "dialog amount verification",
)

PATH.write_text(text, encoding="utf-8")
print("Applied mobile amount field v0.9.7.")
