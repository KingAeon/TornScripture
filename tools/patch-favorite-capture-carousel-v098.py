from pathlib import Path

PATH = Path("TornScripture-Item-Market-Margin.user.js")
text = PATH.read_text(encoding="utf-8")

if "// @version      0.9.8" in text and "function startFavoriteCaptureCarousel" in text:
    print("Favorite capture carousel v0.9.8 already applied.")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once("// @version      0.9.7", "// @version      0.9.8", "metadata version")
replace_once(
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.7' });",
    "window.__TSIMM_CORE_TX_CAPTURE__ = Object.freeze({ owner: 'core', version: '0.9.8' });",
    "core TX capability",
)
replace_once(
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.7' });",
    "window.__TSIMM_CORE_WATCHLISTS__ = Object.freeze({ owner: 'core', version: '0.9.8' });",
    "core watchlist capability",
)
replace_once("ITEM MARKET MARGIN v0.9.7", "ITEM MARKET MARGIN v0.9.8", "header version")
replace_once("    version: '0.9.7',", "    version: '0.9.8',", "app version")
replace_once(
    "    priceRecaptureSessionKey: 'tornscripture-imm-price-recapture-v1',\n    priceBridgeWindowNamePrefix: 'TSIMM_PRICE_BRIDGE:',",
    "    priceRecaptureSessionKey: 'tornscripture-imm-price-recapture-v1',\n    favoriteRecaptureCarouselSessionKey: 'tornscripture-imm-favorite-recapture-carousel-v1',\n    priceBridgeWindowNamePrefix: 'TSIMM_PRICE_BRIDGE:',",
    "carousel session key",
)
replace_once(
    "        trader: traders[index].name,\n        count: items.length,",
    "        trader: traders[index].name,\n        traderId: traders[index].id,\n        count: items.length,",
    "early capture notice identity",
)
replace_once(
    "    panel: 'tsimm-watch-panel',\n    toast: 'tsimm-watch-toast',",
    "    panel: 'tsimm-watch-panel',\n    toast: 'tsimm-watch-toast',\n    carousel: 'tsimm-favorite-capture-carousel',\n    carouselSession: APP.favoriteRecaptureCarouselSessionKey,",
    "watch module carousel constants",
)

style_marker = "      .tsimm-favorite-trader-btn{border:1px solid #72622a!important;border-radius:5px!important;background:#171407!important;color:#d9bf55!important;padding:7px 8px!important;font:800 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}.tsimm-favorite-trader-btn.on{border-color:#d7b943!important;background:#332a08!important;color:#ffe47b!important}\n"
style_addition = style_marker + "      #${A.carousel}{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 8px;align-items:center;box-sizing:border-box;margin:6px 8px;padding:7px 8px;border:1px solid #3879a4;border-radius:7px;background:#06141df2;color:#b8e6ff;font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.carousel}.active{border-color:#58d76d;background:#071b0cf2;color:#caffb5}#${A.carousel} .carousel-copy{display:grid;min-width:0;gap:2px}#${A.carousel} strong,#${A.carousel} span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${A.carousel} span{color:#78a9c7;font-size:7px}#${A.carousel}.active span{color:#75bd7e}#${A.carousel} .carousel-actions{display:flex;gap:4px}#${A.carousel} button{min-height:31px;border:1px solid #438bb9;border-radius:5px;background:#0b2b3d;color:#d4f2ff;padding:5px 7px;font:800 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.carousel}.active button{border-color:#58d76d;background:#0b3213;color:#d5ffc2}#${A.carousel} button.cancel{border-color:#8f4850;background:#2a0b0f;color:#ffb2b8}#${A.carousel} button:disabled{opacity:.5}\n"
replace_once(style_marker, style_addition, "carousel styles")

favorite_block = '''  function toggleFavorite(trader) {
    const store = favoriteStore();
    const index = store.entries.findIndex((entry) => favoriteMatches(entry, trader));
    const added = index < 0;
    if (added) store.entries.push({ traderId: trader.id, traderName: trader.name, addedAt: new Date().toISOString() });
    else store.entries.splice(index, 1);
    saveFavorites(store);
    scheduleTorn();
    return added;
  }
'''
carousel_functions = favorite_block + '''
  function normalizeFavoriteCaptureCarousel(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const entries = Array.isArray(candidate.entries)
      ? candidate.entries.map((entry) => ({
          traderId: clean(entry?.traderId),
          traderName: clean(entry?.traderName),
          pricePageUrl: clean(entry?.pricePageUrl),
        })).filter((entry) => entry.traderId && entry.traderName && entry.pricePageUrl)
      : [];
    const expiresAt = Number(candidate.expiresAt) || 0;
    if (!entries.length || (expiresAt && expiresAt <= Date.now())) return null;
    return {
      schemaVersion: 1,
      id: clean(candidate.id) || createId('favorite-recapture'),
      entries,
      cursor: Math.max(0, Math.min(entries.length, Math.floor(Number(candidate.cursor) || 0))),
      completed: Array.isArray(candidate.completed) ? candidate.completed.map(clean).filter(Boolean) : [],
      failed: Array.isArray(candidate.failed) ? candidate.failed.map(clean).filter(Boolean) : [],
      skipped: Math.max(0, Math.floor(Number(candidate.skipped) || 0)),
      status: clean(candidate.status) || 'ready',
      currentTraderId: clean(candidate.currentTraderId),
      currentTraderName: clean(candidate.currentTraderName),
      returnUrl: clean(candidate.returnUrl),
      startedAt: Number(candidate.startedAt) || Date.now(),
      launchedAt: Number(candidate.launchedAt) || 0,
      expiresAt: expiresAt || Date.now() + (45 * 60 * 1000),
      lastError: clean(candidate.lastError),
    };
  }

  function activeFavoriteCaptureCarousel() {
    const queue = normalizeFavoriteCaptureCarousel(loadSessionJson(A.carouselSession, null));
    if (!queue) saveSessionJson(A.carouselSession, null);
    return queue;
  }

  function saveFavoriteCaptureCarousel(queue) {
    saveSessionJson(A.carouselSession, queue ? normalizeFavoriteCaptureCarousel(queue) : null);
    scheduleTorn();
  }

  function favoriteCaptureSelection(traders = normTraders(), favorites = favoriteStore()) {
    const ready = [];
    const seen = new Set();
    let skipped = 0;
    for (const favorite of favorites.entries) {
      const trader = traders.find((candidate) => favoriteMatches(favorite, candidate));
      if (!trader || seen.has(trader.id)) continue;
      seen.add(trader.id);
      if (!trader.url || (!isWeav3rPriceListUrl(trader.url) && !isTornExchangePriceListUrl(trader.url))) {
        skipped += 1;
        continue;
      }
      ready.push(trader);
    }
    return { ready, skipped, favoriteCount: favorites.entries.length };
  }

  function finishFavoriteCaptureCarousel(queue, message = '') {
    const completed = queue?.completed?.length || 0;
    const failed = queue?.failed?.length || 0;
    const skipped = queue?.skipped || 0;
    saveSessionJson(A.carouselSession, null);
    scheduleTorn();
    showFavoriteToast(message || `Favorite refresh finished: ${completed} captured${failed ? ` · ${failed} failed` : ''}${skipped ? ` · ${skipped} skipped` : ''}`);
  }

  function cancelFavoriteCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    saveSessionJson(A.carouselSession, null);
    scheduleTorn();
    showFavoriteToast(queue ? 'Favorite capture carousel cancelled' : 'No favorite capture carousel is active');
  }

  function launchFavoriteCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    if (!queue) {
      showFavoriteToast('No favorite capture carousel is ready');
      return false;
    }
    if (queue.cursor >= queue.entries.length) {
      finishFavoriteCaptureCarousel(queue);
      return true;
    }
    const current = queue.entries[queue.cursor];
    const trader = state.traders.find((entry) => entry.id === current.traderId);
    if (!trader?.pricePageUrl || (!isWeav3rPriceListUrl(trader.pricePageUrl) && !isTornExchangePriceListUrl(trader.pricePageUrl))) {
      queue.failed.push(current.traderName);
      queue.cursor += 1;
      queue.status = 'ready';
      queue.lastError = `${current.traderName} no longer has a supported automatic price page.`;
      saveFavoriteCaptureCarousel(queue);
      setTimeout(launchFavoriteCaptureCarousel, 250);
      return false;
    }
    queue.status = 'launched';
    queue.currentTraderId = current.traderId;
    queue.currentTraderName = current.traderName;
    queue.launchedAt = Date.now();
    queue.lastError = '';
    saveFavoriteCaptureCarousel(queue);
    showFavoriteToast(`Refreshing ${queue.cursor + 1}/${queue.entries.length}: ${current.traderName}`);
    setTimeout(() => requestTraderPriceRecapture(current.traderId), 180);
    return true;
  }

  function startFavoriteCaptureCarousel() {
    const existing = activeFavoriteCaptureCarousel();
    if (existing && existing.cursor < existing.entries.length) {
      showFavoriteToast(`Favorite carousel already active: ${existing.cursor + 1}/${existing.entries.length}`);
      return false;
    }
    const selection = favoriteCaptureSelection();
    if (!selection.favoriteCount) {
      showFavoriteToast('Star traders first, then refresh favorites');
      return false;
    }
    if (!selection.ready.length) {
      showFavoriteToast('No favorite traders have supported TornExchange or TornW3B price pages');
      return false;
    }
    const queue = normalizeFavoriteCaptureCarousel({
      id: createId('favorite-recapture'),
      entries: selection.ready.map((trader) => ({
        traderId: trader.id,
        traderName: trader.name,
        pricePageUrl: trader.url,
      })),
      cursor: 0,
      completed: [],
      failed: [],
      skipped: selection.skipped,
      status: 'ready',
      returnUrl: normalizeHttpUrl(location.href),
      startedAt: Date.now(),
      expiresAt: Date.now() + (45 * 60 * 1000),
    });
    saveFavoriteCaptureCarousel(queue);
    showFavoriteToast(`Favorite carousel armed: ${queue.entries.length} trader${queue.entries.length === 1 ? '' : 's'}`);
    setTimeout(launchFavoriteCaptureCarousel, 450);
    return true;
  }

  function continueFavoriteCaptureCarousel(notice) {
    const queue = activeFavoriteCaptureCarousel();
    if (!queue || !notice) return false;
    if (queue.cursor >= queue.entries.length) {
      finishFavoriteCaptureCarousel(queue);
      return true;
    }
    const current = queue.entries[queue.cursor];
    const noticeId = clean(notice.traderId);
    const noticeName = key(notice.trader);
    const matches = (noticeId && noticeId === current.traderId)
      || (noticeName && noticeName === key(current.traderName));
    if (!matches) {
      queue.status = 'paused';
      queue.lastError = `Captured ${clean(notice.trader) || 'another trader'} while waiting for ${current.traderName}.`;
      saveFavoriteCaptureCarousel(queue);
      showFavoriteToast(`Carousel paused: expected ${current.traderName}`);
      return false;
    }
    if (!queue.completed.includes(current.traderName)) queue.completed.push(current.traderName);
    queue.cursor += 1;
    queue.status = queue.cursor >= queue.entries.length ? 'complete' : 'ready';
    queue.currentTraderId = '';
    queue.currentTraderName = '';
    queue.lastError = '';
    saveFavoriteCaptureCarousel(queue);
    if (queue.cursor >= queue.entries.length) {
      finishFavoriteCaptureCarousel(queue, `Favorite refresh complete: ${queue.completed.length} captured${queue.skipped ? ` · ${queue.skipped} skipped` : ''}`);
      return true;
    }
    const next = queue.entries[queue.cursor];
    showFavoriteToast(`${clean(notice.trader)} captured · next ${next.traderName}`);
    setTimeout(launchFavoriteCaptureCarousel, 850);
    return true;
  }

  function renderFavoriteCaptureCarousel(book, traders, favorites) {
    if (!(book instanceof Element)) return;
    const selection = favoriteCaptureSelection(traders, favorites);
    const queue = activeFavoriteCaptureCarousel();
    let bar = book.querySelector(`#${A.carousel}`);
    if (!bar) {
      bar = document.createElement('section');
      bar.id = A.carousel;
      const firstCard = book.querySelector('.tsimm-trader-card');
      if (firstCard) firstCard.before(bar);
      else book.appendChild(bar);
    }
    if (queue) {
      const current = queue.entries[queue.cursor] || null;
      const done = Math.min(queue.cursor, queue.entries.length);
      bar.className = 'active';
      bar.innerHTML = `<div class="carousel-copy"><strong>↻ FAVORITE REFRESH · ${done}/${queue.entries.length} captured</strong><span>${current ? `Next: ${esc(current.traderName)}` : 'Finishing carousel'}${queue.lastError ? ` · ${esc(queue.lastError)}` : ''}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-resume>${queue.status === 'launched' ? 'RETRY' : 'CONTINUE'}</button><button type="button" class="cancel" data-watch-carousel-cancel>CANCEL</button></div>`;
      return;
    }
    bar.className = '';
    const skippedText = selection.skipped ? ` · ${selection.skipped} unsupported` : '';
    bar.innerHTML = `<div class="carousel-copy"><strong>↻ REFRESH FAVORITE PRICE LISTS</strong><span>${selection.ready.length} ready of ${selection.favoriteCount} favorite${selection.favoriteCount === 1 ? '' : 's'}${skippedText}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-start ${selection.ready.length ? '' : 'disabled'}>REFRESH FAVORITES</button></div>`;
  }
'''
replace_once(favorite_block, carousel_functions, "carousel functions")

replace_once(
    "    const traders = normTraders();\n    const favorites = favoriteStore();\n    for (const card of book.querySelectorAll('.tsimm-trader-card')) {",
    "    const traders = normTraders();\n    const favorites = favoriteStore();\n    renderFavoriteCaptureCarousel(book, traders, favorites);\n    for (const card of book.querySelectorAll('.tsimm-trader-card')) {",
    "carousel trader book render",
)

click_marker = "        const opener = event.target.closest?.('[data-tsimm-deals-open]');\n"
click_handlers = '''        const carouselStart = event.target.closest?.('[data-watch-carousel-start]');
        if (carouselStart) {
          event.preventDefault();
          event.stopImmediatePropagation();
          startFavoriteCaptureCarousel();
          return;
        }
        const carouselResume = event.target.closest?.('[data-watch-carousel-resume]');
        if (carouselResume) {
          event.preventDefault();
          event.stopImmediatePropagation();
          launchFavoriteCaptureCarousel();
          return;
        }
        const carouselCancel = event.target.closest?.('[data-watch-carousel-cancel]');
        if (carouselCancel) {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancelFavoriteCaptureCarousel();
          return;
        }
        const opener = event.target.closest?.('[data-tsimm-deals-open]');
'''
replace_once(click_marker, click_handlers, "carousel click handlers")

replace_once(
    "      window.addEventListener('tsimm:watchlists-updated', scheduleTorn);\n      setInterval(scheduleTorn, 1500);\n      scheduleTorn();",
    "      window.addEventListener('tsimm:watchlists-updated', scheduleTorn);\n      setInterval(scheduleTorn, 1500);\n      continueFavoriteCaptureCarousel(EARLY_CAPTURE_NOTICE);\n      scheduleTorn();",
    "carousel return continuation",
)

PATH.write_text(text, encoding="utf-8")
print("Applied favorite capture carousel v0.9.8.")
