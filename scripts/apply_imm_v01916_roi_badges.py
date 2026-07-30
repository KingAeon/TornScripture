from pathlib import Path

TARGET = Path("TornScripture-Item-Market-Margin.user.js")
text = TARGET.read_text(encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return source.replace(old, new, 1)


if text.count("0.19.15") != 5:
    raise SystemExit(f"version guard: expected five 0.19.15 markers, found {text.count('0.19.15')}")
text = text.replace("0.19.15", "0.19.16")

cash_anchor = """  function marketHealthForItem(item, best, rows) {"""
compact_each_helper = """  function compactWatchEachCash(value) {
    const number = Number(value) || 0;
    const amount = Math.abs(number);
    const sign = number < 0 ? '-' : number > 0 ? '+' : '';
    const compact = (divisor, suffix, decimals) => {
      const rendered = (amount / divisor)
        .toFixed(decimals)
        .replace(/\\.0+$|(\\.[0-9]*[1-9])0+$/g, '$1');
      return `${sign}$${rendered}${suffix}`;
    };
    if (amount >= 1_000_000_000) return compact(1_000_000_000, 'b', amount < 10_000_000_000 ? 2 : 1);
    if (amount >= 1_000_000) return compact(1_000_000, 'm', amount < 10_000_000 ? 2 : 1);
    if (amount >= 1_000) return compact(1_000, 'k', amount < 10_000 ? 2 : amount < 100_000 ? 1 : 0);
    return `${sign}${cash(amount)}`;
  }


  function marketHealthForItem(item, best, rows) {"""
text = replace_once(text, cash_anchor, compact_each_helper, "compact per-item cash helper")

exit_anchor = """    const exitPrice = breakEvenPrice > 0 ? breakEvenPrice : Math.max(0, entryPrice + profitEach);

    if (badge) {"""
exit_replacement = """    const exitPrice = breakEvenPrice > 0 ? breakEvenPrice : Math.max(0, entryPrice + profitEach);
    const eachText = profitEach === 0 ? '$0 ea' : `${compactWatchEachCash(profitEach)} ea`;

    if (badge) {"""
text = replace_once(text, exit_anchor, exit_replacement, "shared compact per-item label")

text = replace_once(
    text,
    """      const eachText = profitEach === 0 ? '$0 ea' : `${signedCash(profitEach)} ea`;
""",
    "",
    "remove wide per-item label",
)

text = replace_once(
    text,
    """      badge.innerHTML = `<strong>${esc(eachText)} · ${esc(roiText)}</strong>`
""",
    """      badge.innerHTML = `<strong>${esc(roiText)} · ${esc(eachText)}</strong>`
""",
    "ROI-first badge order",
)

text = replace_once(
    text,
    """    marker.textContent = `${profitEach === 0 ? '$0 ea' : `${signedCash(profitEach)} ea`} · ${roiText}`;
""",
    """    marker.textContent = `${roiText} · ${eachText}`;
""",
    "ROI-first fallback marker",
)

TARGET.write_text(text, encoding="utf-8")
print("Applied IMM v0.19.16 ROI-first compact badge patch.")
