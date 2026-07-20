from pathlib import Path

TARGET = Path("TornScripture-IMM-Trader-Extensions.user.js")
text = TARGET.read_text(encoding="utf-8")

if "// @version      0.1.7" in text and "v: '0.1.7'" in text:
    raise SystemExit("Trader Extensions is already 0.1.7")

required = [
    "// @version      0.1.6",
    "v: '0.1.6'",
    "  function cleanupMarket() {",
    "  function cardTrader(card, traders) {",
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f"Refusing to patch: missing markers {missing}")

text = text.replace("// @version      0.1.6", "// @version      0.1.7", 1)
text = text.replace("v: '0.1.6'", "v: '0.1.7'", 1)
text = text.replace("    floor: 'tsimm-track-floor',\n", "", 1)

lines = text.splitlines()
caption_start = next(i for i, line in enumerate(lines) if line.strip().startswith("#${A.caption}{"))
floor_end = next(i for i, line in enumerate(lines) if line.strip().startswith("#${A.floor}{"))
if floor_end < caption_start:
    raise SystemExit("Refusing to patch: malformed style block")

new_css = r'''      #${A.caption}{z-index:9;display:grid;gap:1px;box-sizing:border-box;padding:3px 6px;border:1px solid #27863f;border-radius:5px;background:#041109f5;color:#9ff48e;font:700 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:normal;box-shadow:none;pointer-events:none}
      #${A.caption} strong{font-size:8px;color:#c7ffad}#${A.caption} span{display:block;color:#72bd7d;font-size:7px}#${A.caption}.stacked{position:static!important;transform:none!important;width:auto!important;max-width:none!important;margin:3px 5px!important}#${A.caption}.stale{border-color:#9a6d1f;background:#211705f5;color:#ffd166}#${A.caption}.stale strong,#${A.caption}.stale span{color:#ffd166}#${A.caption}.outdated,#${A.caption}.missing{border-color:#8f4850;background:#23090cf5;color:#ff9ba3}#${A.caption}.outdated strong,#${A.caption}.outdated span,#${A.caption}.missing strong,#${A.caption}.missing span{color:#ff9ba3}
      .tsimm-listing-mark{position:relative!important}.tsimm-track-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:106px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}
      .tsimm-track-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-track-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-track-floor-row{box-shadow:inset 0 2px #347c41!important}'''.splitlines()
lines[caption_start:floor_end + 1] = new_css
text = "\n".join(lines) + "\n"

start = text.index("  function cleanupMarket() {")
end = text.index("  function cardTrader(card, traders) {", start)

new_market = r'''  function signedEach(value) {
    const match = clean(value).match(/([+-])\s*\$([\d,.]+)\s*ea/i);
    if (!match) return null;
    const amount = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(amount)) return null;
    return match[1] === '-' ? -amount : amount;
  }

  function cleanupMarket() {
    document.querySelectorAll('[data-tsimm-tracked], [data-tsimm-track-profit]').forEach((element) => element.remove());
    document.getElementById(A.caption)?.remove();
    document.querySelectorAll('.tsimm-tracked-buy-row,.tsimm-track-profitable,.tsimm-track-floor-row').forEach((row) => {
      row.classList.remove('tsimm-tracked-buy-row', 'tsimm-track-profitable', 'tsimm-track-floor-row');
      delete row.dataset.tsimmTrackedToken;
    });
  }

  function placeCaption(caption, title) {
    const closest = title.closest('[class*="header"],[class*="title"]');
    const anchor = closest && closest !== title ? closest : title.parentElement || title;
    if (!(anchor instanceof Element)) return;
    anchor.style.position = 'relative';
    if (caption.parentElement !== anchor) anchor.appendChild(caption);
    caption.classList.remove('stacked');
    caption.style.position = 'absolute';
    caption.style.top = '50%';
    caption.style.transform = 'translateY(-50%)';
    caption.style.right = '84px';
    const anchorRect = anchor.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const left = Math.max(8, Math.round(titleRect.right - anchorRect.left + 8));
    caption.style.left = `${left}px`;
    const available = anchorRect.width - left - 84;
    if (available >= 150) return;
    caption.classList.add('stacked');
    caption.removeAttribute('style');
    anchor.insertAdjacentElement('afterend', caption);
  }

  function renderCaption(entry, itemName, summary = null) {
    const title = findTitleElement(itemName);
    if (!title) return null;
    let caption = document.getElementById(A.caption);
    if (!caption) {
      caption = document.createElement('div');
      caption.id = A.caption;
    }
    caption.className = entry.status;
    const age = ageText(entry.captured);
    if (entry.status === 'fresh') {
      const count = Math.max(0, Number(summary?.count) || 0);
      const best = Math.max(0, Number(summary?.best) || 0);
      caption.innerHTML = `<strong>📌 ${esc(entry.traderName)} pays ${esc(cash(entry.price))} · ${esc(age)} old</strong><span>${count.toLocaleString()} profitable${best > 0 ? ` · best +${esc(cash(best))} ea` : ''} · buy below ${esc(cash(entry.price))}</span>`;
    } else if (entry.status === 'stale') {
      caption.innerHTML = `<strong>⌛ TRACKED REFERENCE · ${esc(entry.traderName)}</strong><span>Last paid ${esc(cash(entry.price))} · ${esc(age)} old · no buy signal</span>`;
    } else if (entry.status === 'outdated') {
      caption.innerHTML = `<strong>⚠ TRACKED PRICE OUTDATED · ${esc(entry.traderName)}</strong><span>Last paid ${esc(cash(entry.price))} · recapture before buying</span>`;
    } else {
      caption.innerHTML = `<strong>⚠ TRACKED PRICE UNAVAILABLE · ${esc(entry.traderName)}</strong><span>Recapture this trader before buying</span>`;
    }
    placeCaption(caption, title);
    return caption;
  }

  function addProfitMarker(row, trackedProfit) {
    const immProfit = signedEach(row.querySelector('.tsimm-margin-badge')?.textContent);
    let label = '';
    let flip = false;
    if (Number.isFinite(immProfit) && immProfit < 0) {
      label = `📌 FLIP +${cash(trackedProfit)}`;
      flip = true;
    } else if (Number.isFinite(immProfit)) {
      const extra = trackedProfit - immProfit;
      if (extra <= 0) return false;
      label = `📌 +${cash(extra)} extra`;
    } else {
      label = `📌 +${cash(trackedProfit)}`;
    }
    const marker = document.createElement('span');
    marker.className = `tsimm-track-profit${flip ? ' flip' : ''}`;
    marker.dataset.tsimmTrackProfit = '1';
    marker.dataset.tsimmTrackTraderProfit = String(trackedProfit);
    marker.textContent = label;
    row.appendChild(marker);
    row.classList.add('tsimm-track-profitable');
    return true;
  }

  function decorateMarket() {
    cleanupMarket();
    if (!marketPage()) return;
    const groups = resolvedTracked();
    if (!groups.size) return;
    const match = currentTrackedGroup(groups);
    if (!match?.[1]?.length) return;
    const entry = match[1][0], itemName = clean(entry.itemName);
    if (entry.status !== 'fresh') {
      renderCaption(entry, itemName);
      return;
    }

    const rows = [...document.querySelectorAll('.tsimm-listing-mark')];
    let sawProfit = false, floorPlaced = false, count = 0, best = 0;
    for (const row of rows) {
      const price = listingPrice(row);
      const trackedProfit = price > 0 ? entry.price - price : 0;
      const profitable = trackedProfit > 0;
      if (profitable) {
        sawProfit = true;
        count += 1;
        best = Math.max(best, trackedProfit);
        addProfitMarker(row, trackedProfit);
      } else if (sawProfit && !floorPlaced && price > 0) {
        row.classList.add('tsimm-track-floor-row');
        floorPlaced = true;
      }
    }
    renderCaption(entry, itemName, { count, best });
  }

'''

text = text[:start] + new_market + text[end:]

checks = [
    "// @version      0.1.7",
    "v: '0.1.7'",
    "📌 FLIP +${cash(trackedProfit)}",
    ".tsimm-track-floor-row",
    "function placeCaption(caption, title)",
]
missing = [marker for marker in checks if marker not in text]
if missing:
    raise SystemExit(f"Patched file failed checks: {missing}")
if "A.floor" in text or "tsimm-track-floor'" in text:
    raise SystemExit("Patched file still contains the removed floor element")

TARGET.write_text(text, encoding="utf-8")
print(f"Patched {TARGET} to v0.1.7 ({len(text)} bytes)")
