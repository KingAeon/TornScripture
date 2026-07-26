from pathlib import Path

path = Path("TornScripture-Item-Market-Margin.user.js")
text = path.read_text(encoding="utf-8")
original = text

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    text = text.replace(old, new, 1)

replace_once("// @version      0.16.0", "// @version      0.17.0", "metadata version")
replace_once(
    "// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, local market-velocity learning, trader capture, Trade Exit Audit, purchase history, and receipt audits.",
    "// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, local market-velocity learning, priced-trade inventory badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.",
    "metadata description",
)
replace_once(
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.16.0' });",
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.17.0' });",
    "capture marker",
)
replace_once(
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.16.0' });",
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.17.0' });",
    "watch marker",
)
replace_once(
    " * TORNSCRIPTURE - ITEM MARKET MARGIN v0.16.0",
    " * TORNSCRIPTURE - ITEM MARKET MARGIN v0.17.0",
    "header version",
)
replace_once("    version: '0.16.0',", "    version: '0.17.0',", "APP version")
replace_once(
    "   * - Trade Exit Audit comparisons are read-only. Bulk removal runs only after the user presses its button and confirms; it uses Torn's visible item-removal controls and never accepts or completes a trade.\n",
    "   * - Trade Exit Audit comparisons are read-only. Bulk removal runs only after the user presses its button and confirms; it uses Torn's visible item-removal controls and never accepts or completes a trade.\n"
    "   * - Priced Trade stores an expiring trader handoff, verifies the live counterparty, and adds read-only payout badges beside Torn's native addable-item controls. It never adds an item or changes a trade.\n",
    "safety boundary",
)

replace_once(
    """          ${trader.tradeUrl ? `<a href="${escapeHtml(trader.tradeUrl)}">Start trade</a>` : ''}""",
    """          ${trader.tradeUrl && priceItemCount ? `<button type="button" class="tsimm-priced-trade-start" data-tsimm-action="trader-start-priced-trade" data-tsimm-trader-id="${escapeHtml(trader.id)}">Start priced trade</button>` : (trader.tradeUrl ? `<a href="${escapeHtml(trader.tradeUrl)}">Start trade</a>` : '')}""",
    "trader card trade action",
)

replace_once(
    """      } else if (action === 'trader-open-recapture') {
        requestTraderPriceRecapture(button.dataset.tsimmTraderId);
      } else if (action === 'trader-toggle-favorite') {""",
    """      } else if (action === 'trader-open-recapture') {
        requestTraderPriceRecapture(button.dataset.tsimmTraderId);
      } else if (action === 'trader-start-priced-trade') {
        startPricedTrade(state.traders.find((entry) => entry.id === button.dataset.tsimmTraderId));
      } else if (action === 'priced-trade-clear') {
        clearPricedTradeSession('Priced Trade cleared.');
        scheduleScan(20);
      } else if (action === 'trader-toggle-favorite') {""",
    "priced trade actions",
)

replace_once(
    """  const TRADE_EXIT_FAVORITES_STORAGE_KEY = 'tornscripture-imm-favorite-traders-v1';
  const TRADE_EXIT_SETTINGS_STORAGE_KEY = 'tornscripture-imm-trader-market-overlay-settings-v1';
""",
    """  const TRADE_EXIT_FAVORITES_STORAGE_KEY = 'tornscripture-imm-favorite-traders-v1';
  const TRADE_EXIT_SETTINGS_STORAGE_KEY = 'tornscripture-imm-trader-market-overlay-settings-v1';
  const PRICED_TRADE_SESSION_KEY = 'tornscripture-imm-priced-trade-session-v1';
  const PRICED_TRADE_STYLE_ID = 'tsimm-priced-trade-style';
  const PRICED_TRADE_PANEL_ID = 'tsimm-priced-trade-panel';
  const PRICED_TRADE_BADGE_CLASS = 'tsimm-priced-trade-badge';
  const PRICED_TRADE_ROW_CLASS = 'tsimm-priced-trade-row';
  const PRICED_TRADE_TTL_MS = 12 * 60 * 60 * 1000;
""",
    "priced trade constants",
)

priced_trade_functions = r"""
  function loadPricedTradeSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(PRICED_TRADE_SESSION_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return null;
      if (!Number.isFinite(Number(raw.expiresAt)) || Number(raw.expiresAt) <= Date.now()) {
        sessionStorage.removeItem(PRICED_TRADE_SESSION_KEY);
        return null;
      }
      return {
        traderId: normalizeWhitespace(raw.traderId),
        traderName: normalizeWhitespace(raw.traderName),
        userId: Number(raw.userId) > 0 ? Number(raw.userId) : null,
        armedAt: Number(raw.armedAt) || Date.now(),
        expiresAt: Number(raw.expiresAt),
