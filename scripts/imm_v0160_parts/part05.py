
old_watch_panel = r'''  function renderWatchPanel(item, exits) {
    const anchor = panelAnchor(item.name);
    if (!anchor) return null;
    let panel = document.getElementById(A.panel);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = A.panel;
    }
    if (panel.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', panel);
    const watched = isWatched(watchedStore(), item);
    const favorites = favoriteStore().entries.length;
    const best = bestExit(exits);
    const turnover = turnoverProfilesForItem(item)[0] || null;
    const turnoverBadge = turnover
      ? `<b class="tsimm-turnover-chip" title="${esc(turnover.description)}">${esc(turnover.icon)} ${esc(turnover.tier)} · ${esc(turnover.label)}</b>`
      : '';
    if (!watched) {
      panel.className = 'idle';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}☆ NOT WATCHED · ${esc(item.name)}</strong><span>Watch this item across your favorite traders.</span></div><button type="button" data-market-watch-toggle>+ WATCH</button>`;
      return panel;
    }
    if (!favorites) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ WATCHED · NO FAVORITE TRADERS</strong><span>Star traders in the Trader Book or Deals report.</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    if (!best) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ WATCHED · NO CAPTURED EXIT</strong><span>${favorites.toLocaleString()} favorite trader${favorites === 1 ? '' : 's'} · none currently list this item.</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    panel.className = best.status;
    if (best.status === 'fresh') {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ BEST EXIT · ${esc(best.traderName)} pays ${esc(cash(best.price))} · ${esc(ageText(best.captured))} old</strong><span>${exits.length.toLocaleString()} captured favorite${exits.length === 1 ? '' : 's'} · buy below ${esc(cash(best.price))}</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else if (best.status === 'stale') {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}⌛ WATCHED REFERENCE · ${esc(best.traderName)} paid ${esc(cash(best.price))}</strong><span>${esc(ageText(best.captured))} old · recapture before buying · no signal</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}⚠ WATCHED PRICE OUTDATED · ${esc(best.traderName)}</strong><span>Last paid ${esc(cash(best.price))} · recapture before buying.</span></div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    }
    return panel;
  }
'''
new_watch_panel = r'''  function renderWatchPanel(item, exits) {
    const anchor = panelAnchor(item.name);
    if (!anchor) return null;
    let panel = document.getElementById(A.panel);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = A.panel;
    }
    if (panel.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', panel);
    const watched = isWatched(watchedStore(), item);
    const favorites = favoriteStore().entries.length;
    const best = bestExit(exits);
    const turnover = turnoverProfilesForItem(item)[0] || null;
    const turnoverBadge = turnover
      ? `<b class="tsimm-turnover-chip" title="${esc(turnover.description)}">${esc(turnover.icon)} ${esc(turnover.tier)} · ${esc(turnover.label)}</b>`
      : '';
    const velocity = turnoverVelocityHtml(item);
    if (!watched) {
      panel.className = 'idle';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}☆ NOT WATCHED · ${esc(item.name)}</strong><span>Watch this item across your favorite traders.</span>${velocity}</div><button type="button" data-market-watch-toggle>+ WATCH</button>`;
      return panel;
    }
    if (!favorites) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ WATCHED · NO FAVORITE TRADERS</strong><span>Star traders in the Trader Book or Deals report.</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    if (!best) {
      panel.className = 'missing';
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ WATCHED · NO CAPTURED EXIT</strong><span>${favorites.toLocaleString()} favorite trader${favorites === 1 ? '' : 's'} · none currently list this item.</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
      return panel;
    }
    panel.className = best.status;
    if (best.status === 'fresh') {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}★ BEST EXIT · ${esc(best.traderName)} pays ${esc(cash(best.price))} · ${esc(ageText(best.captured))} old</strong><span>${exits.length.toLocaleString()} captured favorite${exits.length === 1 ? '' : 's'} · buy below ${esc(cash(best.price))}</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else if (best.status === 'stale') {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}⌛ WATCHED REFERENCE · ${esc(best.traderName)} paid ${esc(cash(best.price))}</strong><span>${esc(ageText(best.captured))} old · recapture before buying · no signal</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    } else {
      panel.innerHTML = `<div class="watch-copy"><strong>${turnoverBadge}⚠ WATCHED PRICE OUTDATED · ${esc(best.traderName)}</strong><span>Last paid ${esc(cash(best.price))} · recapture before buying.</span>${velocity}</div><button type="button" data-market-watch-toggle>UNWATCH</button>`;
    }
    return panel;
  }
'''
text = replace_once(text, old_watch_panel, new_watch_panel, 'watch panel velocity line')

text = replace_once(
    text,
    "    const watched = isWatched(watchedStore(), item);\n    const exits = watched ? exitsForItem(item) : [];",
    "    maybeCaptureTurnoverSnapshot(item);\n    const watched = isWatched(watchedStore(), item);\n    const exits = watched ? exitsForItem(item) : [];",
    'market snapshot capture hook',
)

text = replace_once(
    text,
    "      addTurnoverPreset,\n      turnoverProfilesForItem,",
    "      addTurnoverPreset,\n      turnoverProfilesForItem,\n      turnoverVelocityForItem,\n      turnoverLeaderboard,\n      maybeCaptureTurnoverSnapshot,",
    'watchlist diagnostics API',
)

PATH.write_text(text, encoding='utf-8')
print('Prepared GOBLIN GOD v0.16.0 local market velocity learning release.')
