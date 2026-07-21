from pathlib import Path

CORE_PATH = Path("TornScripture-Item-Market-Margin.user.js")
EXT_PATH = Path("TornScripture-IMM-Trader-Extensions.user.js")

core = CORE_PATH.read_text(encoding="utf-8")
ext = EXT_PATH.read_text(encoding="utf-8")

if (
    "// @version      0.9.4" in core
    and "ITEM-CENTRIC WATCHLIST MODULE" in core
    and "// @version      0.2.2" in ext
    and "dormant: true" in ext
):
    print("Core watchlist migration is already applied.")
    raise SystemExit(0)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


if "// @version      0.9.3" not in core:
    raise SystemExit("Expected IMM core v0.9.3 before migration")
if "// @version      0.2.1" not in ext:
    raise SystemExit("Expected Trader Extensions v0.2.1 before migration")

# Extract the proven extension runtime without its userscript metadata. It stays
# inside a nested IIFE so its helper names cannot collide with core helpers.
ext_start = ext.find("(() => {")
ext_end = ext.rfind("})();")
if ext_start < 0 or ext_end < ext_start:
    raise SystemExit("Unable to locate Trader Extensions runtime IIFE")
ext_runtime = ext[ext_start:ext_end + len("})();")]

core = replace_once(core, "// @version      0.9.3", "// @version      0.9.4", "core metadata version")
core = replace_once(
    core,
    "// @description  Item-market and overseas profit overlays with NPC buyback flips, TornW3B and TornExchange pricelist capture, purchase history, trade verification, and receipt audits.",
    "// @description  Item-market and overseas profit overlays with trader capture, favorite watchlists, best-exit prompts, purchase history, trade verification, and receipt audits.",
    "core metadata description",
)
core = replace_once(core, "TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.3", "TORNSCRIPTURE - ITEM MARKET MARGIN v0.9.4", "core banner version")
core = replace_once(core, "version: '0.9.3',", "version: '0.9.4',", "core runtime version")
core = replace_once(
    core,
    "  if (typeof window !== 'undefined') {\n    window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.3' });\n  }",
    "  if (typeof window !== 'undefined') {\n    window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.4' });\n    window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.4' });\n  }",
    "core ownership flags",
)
core = replace_once(
    core,
    "   * - The API key, catalog cache, pending purchase, purchase lots, sale history, trader book, and receipt audits remain in this browser's local storage.",
    "   * - The API key, catalog cache, pending purchase, purchase lots, sale history, trader book, favorite traders, watched items, and receipt audits remain in this browser's local storage.",
    "core safety storage note",
)

watch_module = f'''\n\n  /*\n   * ITEM-CENTRIC WATCHLIST MODULE\n   * Migrated from IMM Trader Extensions v0.2.1.\n   * Storage keys intentionally remain unchanged so existing favorites and\n   * watched items continue without conversion or data loss.\n   */\n  if (/^(?:www\\.)?torn\\.com$/i.test(location.hostname)) {{\n{ext_runtime}\n  }}\n'''

closing = core.rfind("\n})();")
if closing < 0:
    raise SystemExit("Unable to locate final IMM core closure")
core = core[:closing] + watch_module + core[closing:]

compatibility_shell = '''// ==UserScript==
// @name         TornScripture - IMM Trader Extensions
// @namespace    https://github.com/KingAeon/TornScripture
// @version      0.2.2
// @description  Compatibility shell. Favorite traders, watched items, and best-exit prompts are now owned by Item Market Margin v0.9.4+.
// @author       KingAeon
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Extensions.user.js
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/main/TornScripture-IMM-Trader-Extensions.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (typeof window === 'undefined') return;
  window.__TSIMM_TRADER_EXTENSIONS_COMPAT__ = Object.freeze({
    version: '0.2.2',
    owner: 'TornScripture - Item Market Margin',
    dormant: true,
  });
})();
'''

for marker in (
    "// @version      0.9.4",
    "window.__TSIMM_CORE_WATCHLISTS__",
    "ITEM-CENTRIC WATCHLIST MODULE",
    "function toggleFavorite",
    "function showFavoriteToast",
    "tornscripture-imm-favorite-traders-v1",
    "tornscripture-imm-watched-items-v1",
):
    if marker not in core:
        raise SystemExit(f"Missing migrated core marker: {marker}")

if "function toggleFavorite" in compatibility_shell:
    raise SystemExit("Compatibility shell unexpectedly contains active watch logic")

CORE_PATH.write_text(core, encoding="utf-8")
EXT_PATH.write_text(compatibility_shell, encoding="utf-8")
print("Migrated favorite traders and watched items into IMM core v0.9.4; Extensions is dormant v0.2.2.")
