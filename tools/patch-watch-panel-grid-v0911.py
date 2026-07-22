from pathlib import Path

path = Path("TornScripture-Item-Market-Margin.user.js")
text = path.read_text(encoding="utf-8")
original = text

if "0.9.10" not in text:
    raise SystemExit("Expected IMM v0.9.10 source")
text = text.replace("0.9.10", "0.9.11")

market_anchor = """  const marketPage = () => /(?:sid=ItemMarket|itemmarket|item-market)/i.test(location.href)
    || Boolean(document.querySelector('.tsimm-listing-mark'));
"""
market_guard = market_anchor + """  const singleItemMarketPage = () => {
    if (!marketPage()) return false;
    if (idFrom(location.href)) return true;
    return Boolean(document.querySelector('.tsimm-listing-mark'));
  };
"""
if market_anchor not in text:
    raise SystemExit("Market page helper anchor not found")
text = text.replace(market_anchor, market_guard, 1)

current_old = """  function currentMarketItem() {
    if (!marketPage()) return null;
"""
current_new = """  function currentMarketItem() {
    if (!singleItemMarketPage()) return null;
"""
if current_old not in text:
    raise SystemExit("Current market item guard not found")
text = text.replace(current_old, current_new, 1)

decorate_old = """  function decorateMarket() {
    cleanupMarket();
    if (!marketPage()) {
"""
decorate_new = """  function decorateMarket() {
    cleanupMarket();
    if (!singleItemMarketPage()) {
"""
if decorate_old not in text:
    raise SystemExit("Market decoration guard not found")
text = text.replace(decorate_old, decorate_new, 1)

required = (
    "// @version      0.9.11",
    "const singleItemMarketPage = () =>",
    "if (!singleItemMarketPage()) return null;",
    "if (!singleItemMarketPage()) {",
)
for marker in required:
    if marker not in text:
        raise SystemExit(f"Missing hotfix marker: {marker}")

if text == original:
    raise SystemExit("No changes applied")

path.write_text(text, encoding="utf-8")
print("Patched IMM watch panel grid leak to v0.9.11")
