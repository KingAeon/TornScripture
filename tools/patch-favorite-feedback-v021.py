from pathlib import Path

PATH = Path("TornScripture-IMM-Trader-Extensions.user.js")
text = PATH.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once("// @version      0.2.0", "// @version      0.2.1", "metadata version")
replace_once("    v: '0.2.0',", "    v: '0.2.1',", "runtime version")
replace_once("    panel: 'tsimm-watch-panel',\n", "    panel: 'tsimm-watch-panel',\n    toast: 'tsimm-watch-toast',\n", "toast id")

replace_once(
    "      .tsimm-favorite-trader-btn{border:1px solid #72622a!important;border-radius:5px!important;background:#171407!important;color:#d9bf55!important;padding:7px 8px!important;font:800 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-favorite-trader-btn.on{border-color:#d7b943!important;background:#332a08!important;color:#ffe47b!important}\n",
    "      .tsimm-favorite-trader-btn{border:1px solid #72622a!important;border-radius:5px!important;background:#171407!important;color:#d9bf55!important;padding:7px 8px!important;font:800 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-favorite-trader-btn.on{border-color:#d7b943!important;background:#332a08!important;color:#ffe47b!important}\n      #${A.toast}{position:fixed;left:50%;top:max(70px,calc(env(safe-area-inset-top) + 62px));z-index:2147483647;max-width:min(360px,calc(100vw - 24px));padding:8px 11px;transform:translate(-50%,-8px);border:1px solid #73df83;border-radius:6px;background:#06170af5;color:#d2ffc0;box-shadow:0 8px 26px #000c;font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease}#${A.toast}.show{transform:translate(-50%,0);opacity:1}\n",
    "toast css",
)

replace_once(
    "  function toggleFavorite(trader) {\n    const store = favoriteStore();\n    const index = store.entries.findIndex((entry) => favoriteMatches(entry, trader));\n    if (index >= 0) store.entries.splice(index, 1);\n    else store.entries.push({ traderId: trader.id, traderName: trader.name, addedAt: new Date().toISOString() });\n    saveFavorites(store);\n    scheduleTorn();\n  }\n",
    "  let favoriteToastTimer = 0;\n\n  function showFavoriteToast(message) {\n    let toast = document.getElementById(A.toast);\n    if (!toast) {\n      toast = document.createElement('div');\n      toast.id = A.toast;\n      toast.setAttribute('role', 'status');\n      toast.setAttribute('aria-live', 'polite');\n      document.body.appendChild(toast);\n    }\n    toast.textContent = clean(message);\n    toast.classList.add('show');\n    clearTimeout(favoriteToastTimer);\n    favoriteToastTimer = setTimeout(() => {\n      toast.classList.remove('show');\n      setTimeout(() => { if (!toast.classList.contains('show')) toast.remove(); }, 220);\n    }, 1500);\n  }\n\n  function applyFavoriteButtonState(button, favorite, kind = 'dock') {\n    if (!(button instanceof HTMLElement)) return;\n    button.classList.toggle('on', favorite);\n    button.setAttribute('aria-pressed', String(favorite));\n    button.textContent = kind === 'book'\n      ? (favorite ? '★ FAVORITE' : '☆ FAVORITE')\n      : (favorite ? '★ TRADER' : '☆ TRADER');\n  }\n\n  function toggleFavorite(trader) {\n    const store = favoriteStore();\n    const index = store.entries.findIndex((entry) => favoriteMatches(entry, trader));\n    const added = index < 0;\n    if (added) store.entries.push({ traderId: trader.id, traderName: trader.name, addedAt: new Date().toISOString() });\n    else store.entries.splice(index, 1);\n    saveFavorites(store);\n    scheduleTorn();\n    return added;\n  }\n",
    "favorite toggle and feedback helpers",
)

replace_once(
    "    dock.innerHTML = `<div class=\"watch-copy\"><small>ITEM-CENTRIC WATCH · ${esc(selectedDeal.trader.name)}</small><strong>${esc(selectedDeal.item.name)}</strong><span>This trader pays ${cash(selectedDeal.item.price)} · compare with every favorite</span></div><button type=\"button\" class=\"${favorite ? 'on' : ''}\" data-watch-favorite-toggle>${favorite ? '★ TRADER' : '☆ TRADER'}</button><button type=\"button\" class=\"${watched ? 'on' : ''}\" data-watch-item-toggle>${watched ? '★ WATCHED' : '☆ WATCH'}</button>`;\n",
    "    dock.innerHTML = `<div class=\"watch-copy\"><small>ITEM-CENTRIC WATCH · ${esc(selectedDeal.trader.name)}</small><strong>${esc(selectedDeal.item.name)}</strong><span>This trader pays ${cash(selectedDeal.item.price)} · compare with every favorite</span></div><button type=\"button\" class=\"${favorite ? 'on' : ''}\" aria-pressed=\"${favorite}\" data-watch-favorite-toggle>${favorite ? '★ TRADER' : '☆ TRADER'}</button><button type=\"button\" class=\"${watched ? 'on' : ''}\" data-watch-item-toggle>${watched ? '★ WATCHED' : '☆ WATCH'}</button>`;\n",
    "dock aria state",
)

replace_once(
    "      button.classList.toggle('on', favorite);\n      button.textContent = favorite ? '★ FAVORITE' : '☆ FAVORITE';\n      button.dataset.trader = trader.id;\n",
    "      applyFavoriteButtonState(button, favorite, 'book');\n      button.dataset.trader = trader.id;\n",
    "book button state helper",
)

replace_once(
    "        if (favoriteDock && selectedDeal) {\n          event.preventDefault();\n          event.stopImmediatePropagation();\n          toggleFavorite(selectedDeal.trader);\n          return;\n        }\n",
    "        if (favoriteDock && selectedDeal) {\n          event.preventDefault();\n          event.stopImmediatePropagation();\n          const added = toggleFavorite(selectedDeal.trader);\n          applyFavoriteButtonState(favoriteDock, added, 'dock');\n          showFavoriteToast(`${added ? 'Added' : 'Removed'} ${selectedDeal.trader.name} ${added ? 'to' : 'from'} favorites`);\n          return;\n        }\n",
    "dock favorite click feedback",
)

replace_once(
    "          const trader = normTraders().find((candidate) => candidate.id === clean(favoriteBook.dataset.trader));\n          if (trader) toggleFavorite(trader);\n          return;\n",
    "          const trader = normTraders().find((candidate) => candidate.id === clean(favoriteBook.dataset.trader));\n          if (trader) {\n            const added = toggleFavorite(trader);\n            applyFavoriteButtonState(favoriteBook, added, 'book');\n            showFavoriteToast(`${added ? 'Added' : 'Removed'} ${trader.name} ${added ? 'to' : 'from'} favorites`);\n          }\n          return;\n",
    "book favorite click feedback",
)

for marker in (
    "// @version      0.2.1",
    "v: '0.2.1'",
    "function showFavoriteToast",
    "function applyFavoriteButtonState",
    "Added' : 'Removed",
    "aria-pressed",
):
    if marker not in text:
        raise SystemExit(f"Missing patched marker: {marker}")

PATH.write_text(text, encoding="utf-8")
print("Patched Trader Extensions to v0.2.1 with immediate favorite feedback.")
