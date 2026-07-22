from pathlib import Path

path = Path("TornScripture-Item-Market-Margin.user.js")
text = path.read_text(encoding="utf-8")
original = text

if "0.9.9" not in text:
    raise SystemExit("Expected IMM v0.9.9 source")
text = text.replace("0.9.9", "0.9.10")

old_guard = "  if (/^(?:www\\.)?torn\\.com$/i.test(location.hostname)) {"
new_guard = "  if (!isWeav3rPriceListUrl(location.href) && !isTornExchangePriceListUrl(location.href)) {"
if old_guard not in text:
    raise SystemExit("Watchlist host guard not found")
text = text.replace(old_guard, new_guard, 1)

old_render_end = """        </div>\n      </div>\n    `;\n  }\n\n  function openTraders() {"""
new_render_end = """        </div>\n      </div>\n    `;\n    setTimeout(() => {\n      try {\n        window.__TSIMM_WATCHLIST_API__?.decorateBook?.();\n      } catch (error) {\n        console.error('[TornScripture IMM] Favorite Trader Book decoration failed:', error);\n      }\n    }, 0);\n  }\n\n  function openTraders() {"""
if old_render_end not in text:
    raise SystemExit("Trader Book render hook target not found")
text = text.replace(old_render_end, new_render_end, 1)

old_action = """      } else if (action === 'trader-open-recapture') {\n        requestTraderPriceRecapture(button.dataset.tsimmTraderId);\n      } else if (action === 'trader-add') {"""
new_action = """      } else if (action === 'trader-open-recapture') {\n        requestTraderPriceRecapture(button.dataset.tsimmTraderId);\n      } else if (action === 'trader-toggle-favorite') {\n        const result = window.__TSIMM_WATCHLIST_API__?.toggleFavoriteById?.(button.dataset.tsimmTraderId);\n        if (!result?.available) toast('Favorite trader controls are not ready. Refresh Torn and try again.');\n        else {\n          toast(`${result.favorite ? 'Added' : 'Removed'} ${result.traderName} ${result.favorite ? 'to' : 'from'} favorites.`);\n          renderTraders();\n        }\n      } else if (action === 'traders-refresh-favorites') {\n        if (!window.__TSIMM_WATCHLIST_API__?.startFavoriteCaptureCarousel?.()) {\n          window.__TSIMM_WATCHLIST_API__ || toast('Favorite trader controls are not ready. Refresh Torn and try again.');\n        }\n      } else if (action === 'traders-continue-favorites') {\n        window.__TSIMM_WATCHLIST_API__?.launchFavoriteCaptureCarousel?.();\n      } else if (action === 'traders-cancel-favorites') {\n        window.__TSIMM_WATCHLIST_API__?.cancelFavoriteCaptureCarousel?.();\n      } else if (action === 'trader-add') {"""
if old_action not in text:
    raise SystemExit("Core trader action insertion point not found")
text = text.replace(old_action, new_action, 1)

old_button_create = """        button.dataset.watchFavoriteBook = '1';\n        button.className = 'tsimm-favorite-trader-btn';"""
new_button_create = """        button.dataset.watchFavoriteBook = '1';\n        button.dataset.tsimmAction = 'trader-toggle-favorite';\n        button.className = 'tsimm-favorite-trader-btn';"""
if old_button_create not in text:
    raise SystemExit("Favorite button creation target not found")
text = text.replace(old_button_create, new_button_create, 1)

old_button_id = """      button.dataset.trader = trader.id;\n    }"""
new_button_id = """      button.dataset.trader = trader.id;\n      button.dataset.tsimmTraderId = trader.id;\n    }"""
if old_button_id not in text:
    raise SystemExit("Favorite button trader id target not found")
text = text.replace(old_button_id, new_button_id, 1)

replacements = {
    '<button type="button" data-watch-carousel-resume>': '<button type="button" data-watch-carousel-resume data-tsimm-action="traders-continue-favorites">',
    '<button type="button" class="cancel" data-watch-carousel-cancel>': '<button type="button" class="cancel" data-watch-carousel-cancel data-tsimm-action="traders-cancel-favorites">',
    '<button type="button" data-watch-carousel-start ': '<button type="button" data-watch-carousel-start data-tsimm-action="traders-refresh-favorites" ',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Carousel control target not found: {old}")
    text = text.replace(old, new, 1)

old_boot = """  if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();\n})();"""
new_boot = """  if (typeof window !== 'undefined' && typeof document !== 'undefined') {\n    window.__TSIMM_WATCHLIST_API__ = {\n      version: APP.version,\n      decorateBook,\n      startFavoriteCaptureCarousel,\n      launchFavoriteCaptureCarousel,\n      cancelFavoriteCaptureCarousel,\n      toggleFavoriteById(traderId) {\n        const trader = normTraders().find((candidate) => candidate.id === clean(traderId));\n        if (!trader) return { available: false, favorite: false, traderName: '' };\n        const favorite = toggleFavorite(trader);\n        scheduleTorn();\n        return { available: true, favorite, traderName: trader.name };\n      },\n      status() {\n        return { ready: true, version: APP.version, hostname: location.hostname };\n      },\n    };\n    try {\n      boot();\n    } catch (error) {\n      console.error('[TornScripture IMM] Favorite watchlist boot failed:', error);\n      setTimeout(() => {\n        try {\n          injectStyle();\n          scheduleTorn();\n        } catch (retryError) {\n          console.error('[TornScripture IMM] Favorite watchlist fallback failed:', retryError);\n        }\n      }, 120);\n    }\n  }\n})();"""
if old_boot not in text:
    raise SystemExit("Watchlist boot target not found")
text = text.replace(old_boot, new_boot, 1)

if text == original:
    raise SystemExit("No changes applied")

path.write_text(text, encoding="utf-8")
print("Patched IMM favorite runtime integration to v0.9.10")
