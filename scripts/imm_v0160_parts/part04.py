    const record = found.record || {
      itemId: Number(item?.id) || null,
      itemName: clean(item?.name),
      firstSeenAt: new Date(now).toISOString(),
      lastSeenAt: null,
      snapshots: [],
    };
    const last = record.snapshots[record.snapshots.length - 1] || null;
    const lastAt = Date.parse(last?.at || '') || 0;
    const gap = now - lastAt;
    const changed = !last || last.signature !== signature;
    if (last && ((!changed && gap < TURNOVER_CAPTURE_RULES.heartbeatMs)
      || (changed && gap < TURNOVER_CAPTURE_RULES.changedMinimumGapMs))) return turnoverProfileFromRecord(record);

    const capturedAt = new Date(now).toISOString();
    record.itemId = Number(item?.id) || record.itemId || null;
    record.itemName = clean(item?.name) || record.itemName;
    record.lastSeenAt = capturedAt;
    record.snapshots.push({ at: capturedAt, signature, listings });
    record.snapshots = record.snapshots.slice(-TURNOVER_CAPTURE_RULES.maxSnapshotsPerItem);
    store.items[found.token || itemToken] = record;
    saveTurnoverHistory(store);
    return turnoverProfileFromRecord(record);
  }

  function turnoverVelocityHtml(item) {
    const profile = turnoverVelocityForItem(item);
    const title = 'Visible listing movement only; removals can include sales, repricing, or delisting.';
    if (profile.snapshots < 3 || profile.band === 'learning') {
      return `<span class="tsimm-market-velocity learning" title="${esc(title)}">◌ VELOCITY LEARNING · ${profile.snapshots}/3 snapshots · ${profile.windows} usable comparison${profile.windows === 1 ? '' : 's'}</span>`;
    }
    const rate = Math.round(profile.signalUnitsPerHour).toLocaleString();
    return `<span class="tsimm-market-velocity ${esc(profile.band)}" title="${esc(title)}">⚡ ${esc(profile.label)} · score ${profile.score}/100 · ~${rate} units/hr signal · ${profile.confidence}% confidence</span>`;
  }

'''
text = replace_once(
    text,
    "  function emitWatchUpdate() {",
    velocity_functions + "  function emitWatchUpdate() {",
    'market velocity functions',
)

old_turnover_panel = r'''  function renderTurnoverPresetPanel(book) {
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
'''
new_turnover_panel = r'''  function renderTurnoverPresetPanel(book) {
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
    const leaders = turnoverLeaderboard(6);
    const leaderRows = leaders.map((profile) => {
      const rate = Math.round(profile.signalUnitsPerHour).toLocaleString();
      return `<div class="velocity-row"><strong>${esc(profile.itemName)}</strong><b>${esc(profile.label)} ${profile.score}</b><span>~${rate} units/hr signal · ${profile.confidence}% confidence · ${profile.snapshots} snapshots</span></div>`;
    }).join('');
    const velocityBoard = leaders.length
      ? leaderRows
      : '<div class="velocity-empty">Browse individual Item Market pages. GOBLIN GOD will begin learning visible listing movement locally after stable snapshots.</div>';
    panel.innerHTML = `<div class="turnover-head"><strong>⚡ HIGH-TURNOVER TARGET LIBRARY</strong><span>Seed repeat-use items into the existing watch system. Your manual watches stay untouched.</span></div><div class="turnover-actions">${buttons}<button type="button" class="all ${allComplete ? 'complete' : ''}" data-watch-turnover-preset="all" ${allComplete ? 'disabled' : ''}><span>＋</span><strong>ADD EVERY PRESET<small>Broad scan list; profit rules still decide what is worth buying.</small></strong><span>${watchedTotal}/${union.size}</span></button></div><div class="velocity-board"><div class="velocity-board-head"><strong>LOCAL VELOCITY LEADERS</strong><span>movement signals, not confirmed sales</span></div>${velocityBoard}</div>`;
  }
'''
text = replace_once(text, old_turnover_panel, new_turnover_panel, 'turnover preset panel')
