from pathlib import Path

PATH = Path('TornScripture-Item-Market-Margin.user.js')
text = PATH.read_text(encoding='utf-8')
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    text = text.replace(old, new, 1)


def replace_at_least(old: str, new: str, minimum: int, label: str) -> None:
    global text
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'{label}: expected at least {minimum} anchors, found {count}')
    text = text.replace(old, new)


def quick_max_block(source: str) -> str:
    start = source.index('  function quickMaxInteractiveLabel')
    end = source.index('  function scanListings', start)
    return source[start:end]


protected_quick_max = quick_max_block(text)

if text.count('0.11.0') < 4:
    raise SystemExit('version anchors missing')
text = text.replace('0.11.0', '0.12.0')

replace_once(
    "    shortName: 'IMM',\n    version: '0.12.0',",
    "    shortName: 'IMM',\n    brandName: 'GOBLIN GOD',\n    brandSubtitle: 'IMM engine',\n    version: '0.12.0',",
    'brand fields',
)
replace_once(
    "    favoriteRecaptureCarouselSessionKey: 'tornscripture-imm-favorite-recapture-carousel-v1',\n",
    "    favoriteRecaptureCarouselSessionKey: 'tornscripture-imm-favorite-recapture-carousel-v1',\n    traderRecaptureResultStorageKey: 'tornscripture-imm-trader-recapture-result-v1',\n",
    'refresh result storage key',
)

replace_at_least(
    '<strong>📈 ${escapeHtml(APP.shortName)}</strong>',
    '<strong>🧌 ${escapeHtml(APP.brandName)}</strong>',
    2,
    'visible brand headers',
)
replace_at_least(
    '<small>v${escapeHtml(APP.version)} ·',
    '<small>${escapeHtml(APP.brandSubtitle)} v${escapeHtml(APP.version)} ·',
    2,
    'visible brand subtitles',
)
text = text.replace('🤝 IMM Trader Book', '🤝 GOBLIN GOD Trader Book')
text = text.replace('📒 IMM Purchase Ledger', '📒 GOBLIN GOD Ledger')

replace_once(
    "    carousel: 'tsimm-favorite-capture-carousel',\n    carouselSession: APP.favoriteRecaptureCarouselSessionKey,\n",
    "    carousel: 'tsimm-favorite-capture-carousel',\n    bulkDialog: 'tsimm-trader-refresh-dialog',\n    carouselSession: APP.favoriteRecaptureCarouselSessionKey,\n    carouselResult: APP.traderRecaptureResultStorageKey,\n",
    'watchlist refresh constants',
)

replace_once(
    "      #${A.toast}{position:fixed;left:50%;top:max(70px,calc(env(safe-area-inset-top) + 62px));",
    "      #${A.carousel} .carousel-actions{flex-wrap:wrap;justify-content:flex-end}\n"
    "      #${A.bulkDialog}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:#000c;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.bulkDialog} *{box-sizing:border-box}#${A.bulkDialog} .refresh-shell{width:min(410px,100%);overflow:hidden;border:1px solid #68e879;border-radius:10px;background:#07110af7;color:#d8ffd0;box-shadow:0 18px 55px #000;padding:12px}#${A.bulkDialog} .refresh-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}#${A.bulkDialog} .refresh-head strong{flex:1;color:#baff9f;font-size:13px;letter-spacing:.05em}#${A.bulkDialog} .refresh-head button{border:0;background:transparent;color:#8ab18d;font-size:18px}#${A.bulkDialog} .refresh-grid{display:grid;grid-template-columns:1fr auto;gap:4px 9px;padding:8px;border:1px solid #294c30;border-radius:7px;background:#091b0e}#${A.bulkDialog} .refresh-grid span{color:#82a889;font-size:9px}#${A.bulkDialog} .refresh-grid strong{text-align:right;color:#d5ffca;font-size:10px}#${A.bulkDialog} .refresh-note{margin:9px 1px;color:#8fb696;font-size:9px;line-height:1.35}#${A.bulkDialog} .refresh-options{display:grid;gap:7px}#${A.bulkDialog} .refresh-option{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 9px;align-items:center;padding:9px;border:1px solid #36583d;border-radius:7px;background:#0b2211;color:#d1ffca;text-align:left}#${A.bulkDialog} .refresh-option strong{font-size:10px}#${A.bulkDialog} .refresh-option span{grid-column:1;color:#83a98a;font-size:8px}#${A.bulkDialog} .refresh-option button{grid-row:1/3;grid-column:2;min-height:38px;border:1px solid #58d76d;border-radius:6px;background:#16461e;color:#e1ffd2;padding:6px 9px;font:800 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.bulkDialog} .refresh-option.all button{border-color:#438bb9;background:#0b2b3d;color:#d4f2ff}#${A.bulkDialog} button:disabled{opacity:.45}\n"
    "      #${A.toast}{position:fixed;left:50%;top:max(70px,calc(env(safe-area-inset-top) + 62px));",
    'refresh dialog styles',
)

replace_once(
    "  function activeFavoriteCaptureCarousel() {\n    const queue = normalizeFavoriteCaptureCarousel(loadSessionJson(A.carouselSession, null));\n    if (!queue) saveSessionJson(A.carouselSession, null);\n    return queue;\n  }\n\n  function saveFavoriteCaptureCarousel(queue) {\n    saveSessionJson(A.carouselSession, queue ? normalizeFavoriteCaptureCarousel(queue) : null);\n    scheduleTorn();\n  }",
    "  function activeFavoriteCaptureCarousel() {\n    const persisted = read(A.carouselSession, null);\n    const legacy = loadSessionJson(A.carouselSession, null);\n    const queue = normalizeFavoriteCaptureCarousel(persisted || legacy);\n    if (legacy && !persisted && queue) {\n      write(A.carouselSession, queue);\n      saveSessionJson(A.carouselSession, null);\n    }\n    if (!queue) {\n      try { localStorage.removeItem(A.carouselSession); } catch {}\n      saveSessionJson(A.carouselSession, null);\n    }\n    return queue;\n  }\n\n  function saveFavoriteCaptureCarousel(queue) {\n    const normalized = queue ? normalizeFavoriteCaptureCarousel(queue) : null;\n    try {\n      if (normalized) write(A.carouselSession, normalized);\n      else localStorage.removeItem(A.carouselSession);\n    } catch {}\n    saveSessionJson(A.carouselSession, null);\n    scheduleTorn();\n  }",
    'persistent queue storage',
)

replace_once(
    "      schemaVersion: 1,\n      id: clean(candidate.id) || createId('favorite-recapture'),\n      entries,",
    "      schemaVersion: 2,\n      mode: ['favorite', 'stale', 'all', 'retry'].includes(clean(candidate.mode)) ? clean(candidate.mode) : 'favorite',\n      id: clean(candidate.id) || createId('trader-recapture'),\n      entries,",
    'queue mode schema',
)
replace_once(
    "      expiresAt: expiresAt || Date.now() + (45 * 60 * 1000),",
    "      expiresAt: expiresAt || Date.now() + (12 * 60 * 60 * 1000),",
    'queue persistence window',
)

insert_anchor = "  function finishFavoriteCaptureCarousel(queue, message = '') {"
if text.count(insert_anchor) != 1:
    raise SystemExit('bulk refresh insertion anchor missing')
insert_code = r'''  const TRADER_CAPTURE_FRESH_MS = 72 * 60 * 60 * 1000;
  let traderRefreshDialogOpen = false;

  function captureQueueLabel(queueOrMode) {
    const mode = typeof queueOrMode === 'string' ? queueOrMode : clean(queueOrMode?.mode);
    if (mode === 'all') return 'ALL TRADER REFRESH';
    if (mode === 'stale') return 'STALE TRADER REFRESH';
    if (mode === 'retry') return 'FAILED TRADER RETRY';
    return 'FAVORITE REFRESH';
  }

  function traderCaptureFresh(trader) {
    const captured = Date.parse(trader?.captured || '');
    return Number.isFinite(captured) && Date.now() - captured <= TRADER_CAPTURE_FRESH_MS;
  }

  function savedTraderCaptureSelection(traders = normTraders()) {
    const eligible = [];
    const stale = [];
    const fresh = [];
    const unsupported = [];
    for (const trader of traders) {
      if (!trader.url || (!isWeav3rPriceListUrl(trader.url) && !isTornExchangePriceListUrl(trader.url))) {
        unsupported.push(trader);
        continue;
      }
      eligible.push(trader);
      if (traderCaptureFresh(trader)) fresh.push(trader);
      else stale.push(trader);
    }
    return { total: traders.length, eligible, stale, fresh, unsupported };
  }

  function lastCaptureRefreshResult() {
    const result = read(A.carouselResult, null);
    if (!result || typeof result !== 'object') return null;
    const finishedAt = Number(result.finishedAt) || 0;
    if (finishedAt && Date.now() - finishedAt > 7 * 24 * 60 * 60 * 1000) {
      try { localStorage.removeItem(A.carouselResult); } catch {}
      return null;
    }
    return {
      mode: clean(result.mode) || 'all',
      completed: Array.isArray(result.completed) ? result.completed.map(clean).filter(Boolean) : [],
      failed: Array.isArray(result.failed) ? result.failed.map(clean).filter(Boolean) : [],
      skipped: Math.max(0, Math.floor(Number(result.skipped) || 0)),
      finishedAt,
    };
  }

  function saveCaptureRefreshResult(result) {
    try {
      if (result) write(A.carouselResult, result);
      else localStorage.removeItem(A.carouselResult);
    } catch {}
    scheduleTorn();
  }

  function closeTraderRefreshDialog() {
    traderRefreshDialogOpen = false;
    document.getElementById(A.bulkDialog)?.remove();
    scheduleTorn();
  }

  function openTraderRefreshDialog() {
    traderRefreshDialogOpen = true;
    scheduleTorn();
  }

  function renderTraderRefreshDialog(selection = savedTraderCaptureSelection()) {
    let dialog = document.getElementById(A.bulkDialog);
    if (!traderRefreshDialogOpen) {
      dialog?.remove();
      return;
    }
    if (!dialog) {
      dialog = document.createElement('section');
      dialog.id = A.bulkDialog;
      dialog.dataset.tsimmGenerated = 'true';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<div class="refresh-shell"><div class="refresh-head"><strong>🧌 GOBLIN GOD PRICE CENSUS</strong><button type="button" data-watch-bulk-cancel aria-label="Close">×</button></div><div class="refresh-grid"><span>Saved traders</span><strong>${selection.total}</strong><span>Supported price pages</span><strong>${selection.eligible.length}</strong><span>Stale or missing</span><strong>${selection.stale.length}</strong><span>Fresh within 72h</span><strong>${selection.fresh.length}</strong><span>Unsupported / manual</span><strong>${selection.unsupported.length}</strong></div><div class="refresh-note">Old captures are preserved until a replacement succeeds. The queue returns to Torn after each supported price page and can resume after an app restart.</div><div class="refresh-options"><div class="refresh-option"><strong>Stale or missing only</strong><span>Recommended default. Skips traders whose captured prices are already fresh.</span><button type="button" data-watch-bulk-start="stale" ${selection.stale.length ? '' : 'disabled'}>START ${selection.stale.length}</button></div><div class="refresh-option all"><strong>Every eligible trader</strong><span>Refreshes fresh, stale, and missing captures in one complete sweep.</span><button type="button" data-watch-bulk-start="all" ${selection.eligible.length ? '' : 'disabled'}>START ${selection.eligible.length}</button></div></div></div>`;
  }

  function startSavedTraderCaptureCarousel(mode = 'stale', explicitTraders = null) {
    const existing = activeFavoriteCaptureCarousel();
    if (existing && existing.cursor < existing.entries.length) {
      showFavoriteToast(`${captureQueueLabel(existing)} already active: ${existing.cursor + 1}/${existing.entries.length}`);
      return false;
    }
    const selection = savedTraderCaptureSelection();
    const ready = Array.isArray(explicitTraders)
      ? explicitTraders
      : mode === 'all'
        ? selection.eligible
        : selection.stale;
    const unique = [...new Map(ready.map((trader) => [trader.id, trader])).values()]
      .filter((trader) => trader?.id && trader?.url && (isWeav3rPriceListUrl(trader.url) || isTornExchangePriceListUrl(trader.url)));
    if (!unique.length) {
      showFavoriteToast(mode === 'stale' ? 'All supported trader prices are already fresh' : 'No eligible trader price pages are available');
      return false;
    }
    const queue = normalizeFavoriteCaptureCarousel({
      id: createId(`${mode}-trader-recapture`),
      mode,
      entries: unique.map((trader) => ({ traderId: trader.id, traderName: trader.name, pricePageUrl: trader.url })),
      cursor: 0,
      completed: [],
      failed: [],
      skipped: mode === 'retry' ? 0 : selection.unsupported.length,
      status: 'ready',
      returnUrl: normalizeHttpUrl(location.href),
      startedAt: Date.now(),
      expiresAt: Date.now() + (12 * 60 * 60 * 1000),
    });
    saveCaptureRefreshResult(null);
    saveFavoriteCaptureCarousel(queue);
    closeTraderRefreshDialog();
    showFavoriteToast(`${captureQueueLabel(queue)} armed: ${queue.entries.length} trader${queue.entries.length === 1 ? '' : 's'}`);
    setTimeout(launchFavoriteCaptureCarousel, 450);
    return true;
  }

  function retryFailedTraderCaptureCarousel() {
    const result = lastCaptureRefreshResult();
    if (!result?.failed?.length) {
      showFavoriteToast('No failed trader captures are waiting');
      return false;
    }
    const failed = new Set(result.failed.map(key));
    const traders = normTraders().filter((trader) => failed.has(key(trader.name))
      && trader.url
      && (isWeav3rPriceListUrl(trader.url) || isTornExchangePriceListUrl(trader.url)));
    return startSavedTraderCaptureCarousel('retry', traders);
  }

  function skipCurrentCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    if (!queue || queue.cursor >= queue.entries.length) {
      showFavoriteToast('No active trader capture is available to skip');
      return false;
    }
    const current = queue.entries[queue.cursor];
    if (!queue.failed.includes(current.traderName)) queue.failed.push(current.traderName);
    queue.cursor += 1;
    queue.status = queue.cursor >= queue.entries.length ? 'complete' : 'ready';
    queue.currentTraderId = '';
    queue.currentTraderName = '';
    queue.lastError = `${current.traderName} skipped; previous captured prices were preserved.`;
    saveFavoriteCaptureCarousel(queue);
    if (queue.cursor >= queue.entries.length) finishFavoriteCaptureCarousel(queue);
    else setTimeout(launchFavoriteCaptureCarousel, 350);
    return true;
  }

'''
text = text.replace(insert_anchor, insert_code + insert_anchor, 1)

replace_once(
    "  function finishFavoriteCaptureCarousel(queue, message = '') {\n    const completed = queue?.completed?.length || 0;\n    const failed = queue?.failed?.length || 0;\n    const skipped = queue?.skipped || 0;\n    saveSessionJson(A.carouselSession, null);\n    scheduleTorn();\n    showFavoriteToast(message || `Favorite refresh finished: ${completed} captured${failed ? ` · ${failed} failed` : ''}${skipped ? ` · ${skipped} skipped` : ''}`);\n  }",
    "  function finishFavoriteCaptureCarousel(queue, message = '') {\n    const completed = queue?.completed?.length || 0;\n    const failed = queue?.failed?.length || 0;\n    const skipped = queue?.skipped || 0;\n    const label = captureQueueLabel(queue);\n    saveCaptureRefreshResult({\n      mode: queue?.mode || 'favorite',\n      completed: [...(queue?.completed || [])],\n      failed: [...(queue?.failed || [])],\n      skipped,\n      finishedAt: Date.now(),\n    });\n    saveFavoriteCaptureCarousel(null);\n    showFavoriteToast(message || `${label} finished: ${completed} captured${failed ? ` · ${failed} failed` : ''}${skipped ? ` · ${skipped} unsupported` : ''}`);\n  }",
    'generic queue finish',
)
replace_once(
    "    showFavoriteToast(queue ? 'Favorite capture carousel cancelled' : 'No favorite capture carousel is active');",
    "    showFavoriteToast(queue ? `${captureQueueLabel(queue)} cancelled` : 'No trader capture queue is active');",
    'generic queue cancellation',
)
replace_once(
    "    showFavoriteToast(`Refreshing ${queue.cursor + 1}/${queue.entries.length}: ${current.traderName}`);",
    "    showFavoriteToast(`${captureQueueLabel(queue)} ${queue.cursor + 1}/${queue.entries.length}: ${current.traderName}`);",
    'generic queue launch message',
)
replace_once(
    "      id: createId('favorite-recapture'),\n      entries: selection.ready.map((trader) => ({",
    "      id: createId('favorite-recapture'),\n      mode: 'favorite',\n      entries: selection.ready.map((trader) => ({",
    'favorite queue mode',
)
replace_once(
    "      expiresAt: Date.now() + (45 * 60 * 1000),",
    "      expiresAt: Date.now() + (12 * 60 * 60 * 1000),",
    'favorite queue duration',
)
replace_once(
    "    saveFavoriteCaptureCarousel(queue);\n    showFavoriteToast(`Favorite carousel armed: ${queue.entries.length} trader${queue.entries.length === 1 ? '' : 's'}`);",
    "    saveCaptureRefreshResult(null);\n    saveFavoriteCaptureCarousel(queue);\n    showFavoriteToast(`Favorite carousel armed: ${queue.entries.length} trader${queue.entries.length === 1 ? '' : 's'}`);",
    'clear prior result on favorite start',
)
replace_once(
    "      finishFavoriteCaptureCarousel(queue, `Favorite refresh complete: ${queue.completed.length} captured${queue.skipped ? ` · ${queue.skipped} skipped` : ''}`);",
    "      finishFavoriteCaptureCarousel(queue);",
    'generic completion message',
)

old_render = r'''  function renderFavoriteCaptureCarousel(book, traders, favorites) {
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
      bar.innerHTML = `<div class="carousel-copy"><strong>↻ FAVORITE REFRESH · ${done}/${queue.entries.length} captured</strong><span>${current ? `Next: ${esc(current.traderName)}` : 'Finishing carousel'}${queue.lastError ? ` · ${esc(queue.lastError)}` : ''}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-resume data-tsimm-action="traders-continue-favorites">${queue.status === 'launched' ? 'RETRY' : 'CONTINUE'}</button><button type="button" class="cancel" data-watch-carousel-cancel data-tsimm-action="traders-cancel-favorites">CANCEL</button></div>`;
      return;
    }
    bar.className = '';
    const skippedText = selection.skipped ? ` · ${selection.skipped} unsupported` : '';
    bar.innerHTML = `<div class="carousel-copy"><strong>↻ REFRESH FAVORITE PRICE LISTS</strong><span>${selection.ready.length} ready of ${selection.favoriteCount} favorite${selection.favoriteCount === 1 ? '' : 's'}${skippedText}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-start data-tsimm-action="traders-refresh-favorites" ${selection.ready.length ? '' : 'disabled'}>REFRESH FAVORITES</button></div>`;
  }
'''
new_render = r'''  function renderFavoriteCaptureCarousel(book, traders, favorites) {
    if (!(book instanceof Element)) return;
    const favoriteSelection = favoriteCaptureSelection(traders, favorites);
    const traderSelection = savedTraderCaptureSelection(traders);
    const queue = activeFavoriteCaptureCarousel();
    renderTraderRefreshDialog(traderSelection);
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
      const label = captureQueueLabel(queue);
      bar.className = 'active';
      bar.innerHTML = `<div class="carousel-copy"><strong>↻ ${esc(label)} · ${done}/${queue.entries.length} captured</strong><span>${current ? `${queue.status === 'launched' ? 'Waiting on' : 'Next'}: ${esc(current.traderName)}` : 'Finishing queue'}${queue.lastError ? ` · ${esc(queue.lastError)}` : ''}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-resume>${queue.status === 'launched' ? 'RETRY' : 'CONTINUE'}</button>${current ? '<button type="button" data-watch-carousel-skip>SKIP</button>' : ''}<button type="button" class="cancel" data-watch-carousel-cancel>CANCEL</button></div>`;
      return;
    }
    bar.className = '';
    const favoriteSkipped = favoriteSelection.skipped ? ` · ${favoriteSelection.skipped} unsupported` : '';
    const result = lastCaptureRefreshResult();
    const resultText = result
      ? ` · last ${captureQueueLabel(result).toLowerCase()}: ${result.completed.length} captured${result.failed.length ? `, ${result.failed.length} failed` : ''}`
      : '';
    bar.innerHTML = `<div class="carousel-copy"><strong>↻ TRADER PRICE CONTROL</strong><span>${favoriteSelection.ready.length}/${favoriteSelection.favoriteCount} favorites ready${favoriteSkipped} · ${traderSelection.stale.length} stale/missing · ${traderSelection.fresh.length} fresh · ${traderSelection.unsupported.length} manual${esc(resultText)}</span></div><div class="carousel-actions"><button type="button" data-watch-carousel-start ${favoriteSelection.ready.length ? '' : 'disabled'}>FAVORITES</button><button type="button" data-watch-bulk-open ${traderSelection.eligible.length ? '' : 'disabled'}>PRICE CHECK TRADERS</button>${result?.failed?.length ? `<button type="button" data-watch-bulk-retry>RETRY FAILURES (${result.failed.length})</button>` : ''}</div>`;
  }
'''
replace_once(old_render, new_render, 'capture carousel renderer')

click_anchor = r'''        const carouselStart = event.target.closest?.('[data-watch-carousel-start]');
'''
if text.count(click_anchor) != 1:
    raise SystemExit('carousel click insertion anchor missing')
click_code = r'''        const bulkOpen = event.target.closest?.('[data-watch-bulk-open]');
        if (bulkOpen) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openTraderRefreshDialog();
          return;
        }
        const bulkStart = event.target.closest?.('[data-watch-bulk-start]');
        if (bulkStart) {
          event.preventDefault();
          event.stopImmediatePropagation();
          startSavedTraderCaptureCarousel(clean(bulkStart.dataset.watchBulkStart) === 'all' ? 'all' : 'stale');
          return;
        }
        const bulkCancel = event.target.closest?.('[data-watch-bulk-cancel]');
        if (bulkCancel) {
          event.preventDefault();
          event.stopImmediatePropagation();
          closeTraderRefreshDialog();
          return;
        }
        const bulkRetry = event.target.closest?.('[data-watch-bulk-retry]');
        if (bulkRetry) {
          event.preventDefault();
          event.stopImmediatePropagation();
          retryFailedTraderCaptureCarousel();
          return;
        }
        const carouselSkip = event.target.closest?.('[data-watch-carousel-skip]');
        if (carouselSkip) {
          event.preventDefault();
          event.stopImmediatePropagation();
          skipCurrentCaptureCarousel();
          return;
        }
'''
text = text.replace(click_anchor, click_code + click_anchor, 1)

replace_once(
    "      cancelFavoriteCaptureCarousel,\n      toggleFavoriteById(traderId) {",
    "      cancelFavoriteCaptureCarousel,\n      openTraderRefreshDialog,\n      startSavedTraderCaptureCarousel,\n      retryFailedTraderCaptureCarousel,\n      skipCurrentCaptureCarousel,\n      toggleFavoriteById(traderId) {",
    'watchlist api extensions',
)

if quick_max_block(text) != protected_quick_max:
    raise SystemExit('Quick MAX block changed unexpectedly')
if '@require' in text:
    raise SystemExit('release must remain self-contained')
for marker in [
    "@version      0.12.0",
    "brandName: 'GOBLIN GOD'",
    'startSavedTraderCaptureCarousel',
    'PRICE CHECK TRADERS',
    'Stale or missing only',
    'RETRY FAILURES',
]:
    if marker not in text:
        raise SystemExit(f'missing release marker: {marker}')
if len(text) < 200_000:
    raise SystemExit('userscript unexpectedly truncated')

PATH.write_text(text, encoding='utf-8')
print(f'Patched {PATH}: {len(original)} -> {len(text)} bytes')
