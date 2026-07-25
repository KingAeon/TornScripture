from pathlib import Path

TARGET = Path('TornScripture-Item-Market-Margin.user.js')
text = TARGET.read_text(encoding='utf-8')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return source.replace(old, new, 1)


version_count = text.count('0.14.0')
if version_count != 5:
    raise SystemExit(f'version guard: expected 5 occurrences of 0.14.0, found {version_count}')
text = text.replace('0.14.0', '0.15.0')
text = replace_once(
    text,
    '// @description  Item-market and overseas profit overlays with Quick MAX, trader capture, favorite watchlists, Trade Exit Audit, purchase history, trade verification, and receipt audits.',
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated high-turnover watchlists, trader capture, Trade Exit Audit, purchase history, trade verification, and receipt audits.',
    'userscript description',
)

module_anchor = """    bulkDialog: 'tsimm-trader-refresh-dialog',
    carouselSession: APP.favoriteRecaptureCarouselSessionKey,
    carouselResult: APP.traderRecaptureResultStorageKey,
  });

  const clone = (value) => JSON.parse(JSON.stringify(value));
"""
module_insert = """    bulkDialog: 'tsimm-trader-refresh-dialog',
    turnoverPanel: 'tsimm-turnover-preset-panel',
    carouselSession: APP.favoriteRecaptureCarouselSessionKey,
    carouselResult: APP.traderRecaptureResultStorageKey,
  });

  const HIGH_TURNOVER_PRESETS = Object.freeze([
    Object.freeze({
      id: 'war-recovery',
      icon: '✚',
      tier: 'A',
      label: 'WAR RECOVERY',
      description: 'Repeat-use medical supplies for wars, chains, and hospital exits.',
      items: Object.freeze([
        'Blood Bag : A+', 'Blood Bag : A-', 'Blood Bag : B+', 'Blood Bag : B-',
        'Blood Bag : AB+', 'Blood Bag : AB-', 'Blood Bag : O+', 'Blood Bag : O-',
        'Morphine', 'First Aid Kit', 'Small First Aid Kit', 'Empty Blood Bag',
        'Box of Medical Supplies',
      ]),
    }),
    Object.freeze({
      id: 'combat-temps',
      icon: '☄',
      tier: 'A',
      label: 'COMBAT TEMPS',
      description: 'Disposable combat and mission items with recurring war demand.',
      items: Object.freeze([
        'Smoke Grenade', 'Flash Grenade', 'Pepper Spray', 'Tear Gas',
        'Concussion Grenade', 'Grenade', 'HEG', 'Molotov Cocktail',
      ]),
    }),
    Object.freeze({
      id: 'museum-sets',
      icon: '♜',
      tier: 'B',
      label: 'MUSEUM SETS',
      description: 'Plushies and flowers continually absorbed by Museum set exchanges.',
      items: Object.freeze([
        'Camel Plushie', 'Chamois Plushie', 'Jaguar Plushie', 'Kitten Plushie',
        'Lion Plushie', 'Monkey Plushie', 'Nessie Plushie', 'Panda Plushie',
        'Red Fox Plushie', 'Sheep Plushie', 'Stingray Plushie', 'Teddy Bear Plushie',
        'Wolverine Plushie', 'African Violet', 'Banana Orchid', 'Ceibo Flower',
        'Cherry Blossom', 'Crocus', 'Dahlia', 'Edelweiss', 'Heather', 'Orchid',
        'Peony', 'Tribulus Omanense',
      ]),
    }),
    Object.freeze({
      id: 'energy-gym',
      icon: '⚡',
      tier: 'S',
      label: 'ENERGY & GYM',
      description: 'Very liquid energy and happy consumables; expect fierce competition.',
      items: Object.freeze([
        'Xanax', 'LSD', 'Ecstasy', 'Feathery Hotel Coupon', 'Erotic DVD',
        'Can of Goose Juice', 'Can of Damp Valley', 'Can of Crocozade',
        'Can of Munster', 'Can of Santa Shooters', 'Can of Red Cow',
        'Can of Rockstar Rudolph', 'Can of Taurine Elite', 'Can of X-MASS',
        'Six-Pack of Energy Drink',
      ]),
    }),
  ]);

  const clone = (value) => JSON.parse(JSON.stringify(value));
"""
text = replace_once(text, module_anchor, module_insert, 'turnover preset constants')

style_anchor = """    `;
  }

  function tradersRaw() {
"""
style_insert = """    `;
    style.textContent += `
      #${A.turnoverPanel}{display:grid;gap:7px;box-sizing:border-box;margin:6px 8px;padding:9px;border:1px solid #9d7627;border-radius:8px;background:#171105f4;color:#ffe28a;font:800 9px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${A.turnoverPanel} .turnover-head{display:grid;gap:2px}#${A.turnoverPanel} .turnover-head strong{color:#ffe8a3;font-size:11px;letter-spacing:.04em}#${A.turnoverPanel} .turnover-head span{color:#bfa969;font-size:8px;font-weight:700}
      #${A.turnoverPanel} .turnover-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}#${A.turnoverPanel} button{display:grid;grid-template-columns:auto 1fr auto;gap:5px;align-items:center;min-height:36px;border:1px solid #826923;border-radius:6px;background:#2a2008;color:#ffe8a3;padding:6px 7px;text-align:left;font:800 8px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${A.turnoverPanel} button small{color:#ad985a;font-size:7px}#${A.turnoverPanel} button.complete{border-color:#4ea966;background:#0b2b13;color:#bdffae}#${A.turnoverPanel} button.all{grid-column:1/-1;border-color:#5a8aa6;background:#0a2230;color:#c8efff}#${A.turnoverPanel} button:disabled{opacity:.65}
      .tsimm-turnover-chip{display:inline-flex!important;align-items:center!important;margin-right:4px!important;padding:1px 4px!important;border:1px solid #b78c2d!important;border-radius:999px!important;background:#2a1f07!important;color:#ffe28a!important;font:900 7px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;vertical-align:1px!important;white-space:nowrap!important}
      @media(max-width:430px){#${A.turnoverPanel} .turnover-actions{grid-template-columns:1fr}#${A.turnoverPanel} button.all{grid-column:auto}}
    `;
  }

  function tradersRaw() {
"""
text = replace_once(text, style_anchor, style_insert, 'turnover preset styles')

watched_anchor = """  function emitWatchUpdate() {
"""
watched_insert = """  function watchEntryMatchesItem(entry, item) {
    const entryId = Number(entry?.itemId) > 0 ? Number(entry.itemId) : null;
    const itemId = Number(item?.id ?? item?.itemId) > 0 ? Number(item.id ?? item.itemId) : null;
    if (entryId && itemId && entryId === itemId) return true;
    return Boolean(key(entry?.itemName ?? entry?.name)
      && key(entry?.itemName ?? entry?.name) === key(item?.name ?? item?.itemName));
  }

  function turnoverPresetById(presetId) {
    return HIGH_TURNOVER_PRESETS.find((preset) => preset.id === clean(presetId)) || null;
  }

  function turnoverProfilesForItem(item) {
    const wanted = key(item?.name ?? item?.itemName);
    if (!wanted) return [];
    return HIGH_TURNOVER_PRESETS.filter((preset) => preset.items.some((name) => key(name) === wanted));
  }

  function resolvedTurnoverItems(preset) {
    const values = catalog();
    return preset.items.map((name) => {
      const resolved = values.name[key(name)] || null;
      return {
        id: resolved?.id || null,
        name: resolved?.name || name,
        n: key(resolved?.name || name),
      };
    });
  }

  function turnoverPresetStats(preset, store = watchedStore()) {
    const items = resolvedTurnoverItems(preset);
    const watched = items.filter((item) => store.entries.some((entry) => watchEntryMatchesItem(entry, item))).length;
    return { watched, total: items.length, complete: watched === items.length };
  }

  function addTurnoverPreset(presetId) {
    const presets = clean(presetId) === 'all'
      ? HIGH_TURNOVER_PRESETS
      : [turnoverPresetById(presetId)].filter(Boolean);
    if (!presets.length) return { added: 0, total: 0, presets: 0 };
    const store = watchedStore();
    let added = 0;
    let total = 0;
    for (const preset of presets) {
      for (const item of resolvedTurnoverItems(preset)) {
        total += 1;
        if (store.entries.some((entry) => watchEntryMatchesItem(entry, item))) continue;
        store.entries.push({
          itemId: item.id,
          itemName: item.name,
          addedAt: new Date().toISOString(),
          source: `turnover:${preset.id}`,
          turnoverPreset: preset.id,
          turnoverTier: preset.tier,
          turnoverReason: preset.description,
        });
        added += 1;
      }
    }
    if (added) saveWatched(store);
    scheduleTorn();
    const label = presets.length === HIGH_TURNOVER_PRESETS.length
      ? 'all high-turnover presets'
      : presets[0].label.toLowerCase();
    showFavoriteToast(added
      ? `Added ${added} ${label} target${added === 1 ? '' : 's'}`
      : `${label} already fully watched`);
    return { added, total, presets: presets.length };
  }

  function emitWatchUpdate() {
"""
text = replace_once(text, watched_anchor, watched_insert, 'turnover watch helpers')

watched_normalize_old = """        addedAt: candidate?.addedAt || new Date().toISOString(),
        source: clean(candidate?.source) || 'manual',
      });
"""
watched_normalize_new = """        addedAt: candidate?.addedAt || new Date().toISOString(),
        source: clean(candidate?.source) || 'manual',
        turnoverPreset: clean(candidate?.turnoverPreset),
        turnoverTier: clean(candidate?.turnoverTier),
        turnoverReason: clean(candidate?.turnoverReason),
      });
"""
text = replace_once(text, watched_normalize_old, watched_normalize_new, 'turnover metadata normalization')

is_watched_old = """  function isWatched(store, item) {
    const token = itemKey(item.id, item.name);
    return store.entries.some((entry) => itemKey(entry.itemId, entry.itemName) === token);
  }

  function toggleWatched(item, source = 'manual') {
    const store = watchedStore();
    const token = itemKey(item.id, item.name);
    const index = store.entries.findIndex((entry) => itemKey(entry.itemId, entry.itemName) === token);
"""
is_watched_new = """  function isWatched(store, item) {
    return store.entries.some((entry) => watchEntryMatchesItem(entry, item));
  }

  function toggleWatched(item, source = 'manual') {
    const store = watchedStore();
    const index = store.entries.findIndex((entry) => watchEntryMatchesItem(entry, item));
"""
text = replace_once(text, is_watched_old, is_watched_new, 'name-safe watched item matching')

render_anchor = """  function renderFavoriteCaptureCarousel(book, traders, favorites) {
"""
render_insert = """  function renderTurnoverPresetPanel(book) {
    if (!(book instanceof Element)) return;
    let panel = book.querySelector(`#${A.turnoverPanel}`);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = A.turnoverPanel;
      const firstCard = book.querySelector('.tsimm-trader-card');
      if (firstCard) firstCard.before(panel);
      else book.appendChild(panel);
    }
    const store = watchedStore();
    const buttons = HIGH_TURNOVER_PRESETS.map((preset) => {
      const stats = turnoverPresetStats(preset, store);
      return `<button type="button" class="${stats.complete ? 'complete' : ''}" data-watch-turnover-preset="${esc(preset.id)}" ${stats.complete ? 'disabled' : ''}><span>${esc(preset.icon)}</span><strong>${esc(preset.tier)} · ${esc(preset.label)}<small>${esc(preset.description)}</small></strong><span>${stats.watched}/${stats.total}</span></button>`;
    }).join('');
    const union = new Map();
    for (const preset of HIGH_TURNOVER_PRESETS) {
      for (const item of resolvedTurnoverItems(preset)) union.set(item.n, item);
    }
    const watchedTotal = [...union.values()].filter((item) => store.entries.some((entry) => watchEntryMatchesItem(entry, item))).length;
    const allComplete = watchedTotal === union.size;
    panel.innerHTML = `<div class="turnover-head"><strong>⚡ HIGH-TURNOVER TARGET LIBRARY</strong><span>Seed repeat-use items into the existing watch system. Your manual watches stay untouched.</span></div><div class="turnover-actions">${buttons}<button type="button" class="all ${allComplete ? 'complete' : ''}" data-watch-turnover-preset="all" ${allComplete ? 'disabled' : ''}><span>＋</span><strong>ADD EVERY PRESET<small>Broad scan list; profit rules still decide what is worth buying.</small></strong><span>${watchedTotal}/${union.size}</span></button></div>`;
  }

  function renderFavoriteCaptureCarousel(book, traders, favorites) {
"""
text = replace_once(text, render_anchor, render_insert, 'turnover preset panel renderer')

book_old = """    const traders = normTraders();
    const favorites = favoriteStore();
    renderFavoriteCaptureCarousel(book, traders, favorites);
"""
book_new = """    const traders = normTraders();
    const favorites = favoriteStore();
    renderTurnoverPresetPanel(book);
    renderFavoriteCaptureCarousel(book, traders, favorites);
"""
text = replace_once(text, book_old, book_new, 'turnover panel book integration')

market_old = """    const watched = isWatched(watchedStore(), item);
    const favorites = favoriteStore().entries.length;
    const best = bestExit(exits);
"""
market_new = """    const watched = isWatched(watchedStore(), item);
    const favorites = favoriteStore().entries.length;
    const best = bestExit(exits);
    const turnover = turnoverProfilesForItem(item)[0] || null;
    const turnoverBadge = turnover
      ? `<b class="tsimm-turnover-chip" title="${esc(turnover.description)}">${esc(turnover.icon)} ${esc(turnover.tier)} · ${esc(turnover.label)}</b>`
      : '';
"""
text = replace_once(text, market_old, market_new, 'market turnover profile lookup')

for old, new, label in [
    ('<strong>☆ NOT WATCHED · ${esc(item.name)}</strong>', '<strong>${turnoverBadge}☆ NOT WATCHED · ${esc(item.name)}</strong>', 'not watched turnover chip'),
    ('<strong>★ WATCHED · NO FAVORITE TRADERS</strong>', '<strong>${turnoverBadge}★ WATCHED · NO FAVORITE TRADERS</strong>', 'no favorites turnover chip'),
    ('<strong>★ WATCHED · NO CAPTURED EXIT</strong>', '<strong>${turnoverBadge}★ WATCHED · NO CAPTURED EXIT</strong>', 'no exit turnover chip'),
    ('<strong>★ BEST EXIT · ${esc(best.traderName)} pays ${esc(cash(best.price))} · ${esc(ageText(best.captured))} old</strong>', '<strong>${turnoverBadge}★ BEST EXIT · ${esc(best.traderName)} pays ${esc(cash(best.price))} · ${esc(ageText(best.captured))} old</strong>', 'fresh exit turnover chip'),
    ('<strong>⌛ WATCHED REFERENCE · ${esc(best.traderName)} paid ${esc(cash(best.price))}</strong>', '<strong>${turnoverBadge}⌛ WATCHED REFERENCE · ${esc(best.traderName)} paid ${esc(cash(best.price))}</strong>', 'stale exit turnover chip'),
    ('<strong>⚠ WATCHED PRICE OUTDATED · ${esc(best.traderName)}</strong>', '<strong>${turnoverBadge}⚠ WATCHED PRICE OUTDATED · ${esc(best.traderName)}</strong>', 'outdated exit turnover chip'),
]:
    text = replace_once(text, old, new, label)

event_anchor = """      document.addEventListener('click', (event) => {
        const bulkOpen = event.target.closest?.('[data-watch-bulk-open]');
"""
event_insert = """      document.addEventListener('click', (event) => {
        const turnoverPreset = event.target.closest?.('[data-watch-turnover-preset]');
        if (turnoverPreset) {
          event.preventDefault();
          event.stopImmediatePropagation();
          addTurnoverPreset(clean(turnoverPreset.dataset.watchTurnoverPreset));
          return;
        }
        const bulkOpen = event.target.closest?.('[data-watch-bulk-open]');
"""
text = replace_once(text, event_anchor, event_insert, 'turnover preset click binding')

api_anchor = """      skipCurrentCaptureCarousel,
      toggleFavoriteById(traderId) {
"""
api_insert = """      skipCurrentCaptureCarousel,
      addTurnoverPreset,
      turnoverProfilesForItem,
      toggleFavoriteById(traderId) {
"""
text = replace_once(text, api_anchor, api_insert, 'turnover watchlist API export')

TARGET.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.15.0 high-turnover target library.')
