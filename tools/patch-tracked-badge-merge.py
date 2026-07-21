from pathlib import Path

PATH = Path("TornScripture-IMM-Trader-Extensions.user.js")
text = PATH.read_text(encoding="utf-8")

required_old = {
    "metadata version": "// @version      0.1.9",
    "runtime version": "v: '0.1.9',",
    "profit function": "  function addProfitMarker(row, trackedProfit) {",
    "profit call": "        addProfitMarker(row, trackedProfit);",
    "cleanup function": "  function cleanupMarket() {\n    document.querySelectorAll('[data-tsimm-tracked], [data-tsimm-track-profit]').forEach((element) => element.remove());",
}
for label, needle in required_old.items():
    if needle not in text:
        raise SystemExit(f"Missing expected {label}: {needle}")

text = text.replace("// @version      0.1.9", "// @version      0.1.10", 1)
text = text.replace("v: '0.1.9',", "v: '0.1.10',", 1)

old_css = """      .tsimm-track-format-row{position:relative!important}.tsimm-track-caption-anchor{position:relative!important}.tsimm-track-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:106px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}
      .tsimm-track-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-track-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-track-floor-row{box-shadow:inset 0 2px #347c41!important}
"""
new_css = """      .tsimm-track-format-row{position:relative!important}.tsimm-track-caption-anchor{position:relative!important}.tsimm-track-inline-badge{min-width:0!important}.tsimm-track-inline{display:block!important;max-width:100%!important;overflow:hidden!important;color:#baff9f!important;opacity:1!important;font:800 8px/1.05 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .tsimm-track-profit{position:absolute!important;right:clamp(72px,20%,148px)!important;top:50%!important;z-index:12!important;display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:106px!important;margin:0!important;padding:2px 5px!important;transform:translateY(-50%)!important;border:1px solid #42b95a!important;border-radius:4px!important;background:#07230df2!important;color:#baff9f!important;font:800 8px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;white-space:nowrap!important;pointer-events:none!important;box-sizing:border-box!important}
      .tsimm-track-profit.flip{border-color:#78ef8d!important;background:#073411f5!important;color:#d1ffbf!important}.tsimm-track-profitable{box-shadow:inset 2px 0 #58df78!important}.tsimm-track-floor-row{box-shadow:inset 0 2px #347c41!important}
"""
if old_css not in text:
    raise SystemExit("Expected tracked CSS block not found")
text = text.replace(old_css, new_css, 1)

old_cleanup = """  function cleanupMarket() {
    document.querySelectorAll('[data-tsimm-tracked], [data-tsimm-track-profit]').forEach((element) => element.remove());
"""
new_cleanup = """  function cleanupMarket() {
    document.querySelectorAll('.tsimm-track-inline[data-tsimm-track-original-html]').forEach((line) => {
      line.innerHTML = line.dataset.tsimmTrackOriginalHtml || '';
      line.classList.remove('tsimm-track-inline');
      delete line.dataset.tsimmTrackOriginalHtml;
      line.closest('.tsimm-margin-badge')?.classList.remove('tsimm-track-inline-badge');
    });
    document.querySelectorAll('[data-tsimm-tracked], [data-tsimm-track-profit]').forEach((element) => element.remove());
"""
text = text.replace(old_cleanup, new_cleanup, 1)

start = text.index("  function addProfitMarker(row, trackedProfit) {")
end = text.index("\n  function decorateMarket() {", start)
new_function = """  function addProfitMarker(row, trackedProfit, traderName = '') {
    const badge = row.querySelector('.tsimm-margin-badge');
    const immProfit = signedEach(badge?.textContent);
    const traderLabel = clean(traderName).slice(0, 14) || 'trader';
    let label = '';
    let flip = false;
    if (Number.isFinite(immProfit) && immProfit < 0) {
      label = `📌 ${traderLabel} FLIP +${cash(trackedProfit)}`;
      flip = true;
    } else if (Number.isFinite(immProfit)) {
      const extra = trackedProfit - immProfit;
      if (extra <= 0) return false;
      label = `📌 ${traderLabel} +${cash(extra)} better`;
    } else {
      label = `📌 ${traderLabel} +${cash(trackedProfit)}`;
    }

    const badgeLines = badge ? [...badge.querySelectorAll('span')] : [];
    const inlineLine = badgeLines.at(-1) || null;
    if (inlineLine) {
      inlineLine.dataset.tsimmTrackOriginalHtml = inlineLine.innerHTML;
      inlineLine.textContent = label;
      inlineLine.classList.add('tsimm-track-inline');
      badge.classList.add('tsimm-track-inline-badge');
      row.classList.add('tsimm-track-profitable');
      return true;
    }

    const marker = document.createElement('span');
    marker.className = `tsimm-track-profit${flip ? ' flip' : ''}`;
    marker.dataset.tsimmTrackProfit = '1';
    marker.dataset.tsimmTrackTraderProfit = String(trackedProfit);
    marker.textContent = label;
    row.appendChild(marker);
    row.classList.add('tsimm-track-format-row', 'tsimm-track-profitable');
    return true;
  }
"""
text = text[:start] + new_function + text[end:]
text = text.replace("        addProfitMarker(row, trackedProfit);", "        addProfitMarker(row, trackedProfit, entry.traderName);", 1)

for old in ("// @version      0.1.9", "v: '0.1.9',", "function addProfitMarker(row, trackedProfit) {"):
    if old in text:
        raise SystemExit(f"Old marker survived: {old}")
for marker in (
    "// @version      0.1.10",
    "v: '0.1.10',",
    "tsimm-track-inline-badge",
    "data-tsimm-track-original-html",
    "function addProfitMarker(row, trackedProfit, traderName = '')",
    "addProfitMarker(row, trackedProfit, entry.traderName);",
):
    if marker not in text:
        raise SystemExit(f"Missing patched marker: {marker}")

PATH.write_text(text, encoding="utf-8")
print("Patched Trader Extensions to v0.1.10 with inline tracked-exit badge merging.")
