# 📜 TornScripture

A growing collection of high-quality userscripts and utilities for Torn.

The goal of TornScripture is simple:

> Build useful tools that enhance information already available to the player without automating gameplay.

---

## Current Projects

### 🐾 War Intelligence HUD

Version: 0.7.1

The War Intelligence HUD records observations from faction and ranked war pages and stores them locally for later analysis.

Current features include:

- Local observation archive
- Player status detection
- Last action capture
- Export / Import
- IndexedDB storage
- Diagnostics
- Lightweight HUD

### 📦 Inventory Sales HUD

Version: 0.3.0

The Inventory Sales HUD scans the key owner's inventory only after a manual
button press, then organizes items into Keep, Sell to Trader, Sell to Store,
Trash, Needs Review, and Excluded Equipment.

Current features include:

- Torn API v2 category-by-category inventory scan using a Limited Access key
- Torn item-catalog join for market, shop buy, shop sell, vendor, tradability,
  circulation, descriptions, effects, requirements, and item images
- TornPDA managed-key placeholder support
- Browser-local API key, inventory, and classification storage
- Mobile-first organizer and sale-plan interface
- Dark, light, and automatic Torn/device-aware themes
- Draggable HUD position saved locally with a reset control
- JSON trader-price configuration import and refresh
- Per-item remembered classifications and keep quantities
- Copyable per-trader sale messages
- Automatic shop-sale recommendations only when the shop pays more than the
  market estimate, or when no market estimate exists
- Automatic reset option for returning remembered manual choices to live
  price-based recommendations
- Locked exclusion of armor and weapon categories
- Visible-page scan fallback
- No automated selling, sending, listing, or trashing

---

## Installation

1. Choose the `.user.js` tool you want.
2. Open it with TornPDA's Script Manager or a userscript manager such as
   Tampermonkey / Violentmonkey.
3. Save and enable the script.

TornPDA can inject its managed key into the Inventory Sales HUD through the
`###PDA-APIKEY###` placeholder. Other browsers prompt the user to save their
own Limited Access key locally. API keys are never included in exports or
price configuration files.

The shareable price configuration lives at `data/trader-prices.json`. See
`data/trader-prices.example.json` for the schema.

---

## Planned Features

- Enemy activity timeline
- Offline pattern analysis
- Hospital release history
- Travel history
- Search and filtering
- Better visualizations
- Additional Torn utilities
- Trader website price adapters
- Spreadsheet-to-JSON price export

---

## Philosophy

TornScripture is designed to organize and visualize information already available to the player.

It does **not** automate gameplay, perform actions on behalf of the player, or make gameplay decisions.

---

## License

MIT
