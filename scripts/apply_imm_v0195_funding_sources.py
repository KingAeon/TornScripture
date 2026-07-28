from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    print(f'{label}: {count} match(es)')
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once('// @version      0.19.4', '// @version      0.19.5', 'header version')
replace_once(
    'reversible duplicate-ledger cleanup, and receipt audits.',
    'reversible duplicate-ledger cleanup, capital-source lot tracking, and receipt audits.',
    'description',
)
replace_once('ITEM MARKET MARGIN v0.19.4', 'ITEM MARKET MARGIN v0.19.5', 'internal version comment')

version_count = text.count("version: '0.19.4'")
print(f'version constants: {version_count} match(es)')
if version_count != 3:
    raise SystemExit(f'version constants: expected three matches, found {version_count}')
text = text.replace("version: '0.19.4'", "version: '0.19.5'")

replace_once(
"""    ledgerShowSoldPurchases: true,
    overseasLoadLimit: 21,
""",
"""    ledgerShowSoldPurchases: true,
    ledgerDefaultFundingSource: 'personal',
    overseasLoadLimit: 21,
""",
'default funding setting')

replace_once(
"""  const TRADER_REASON_LABELS = Object.freeze({
    prices: 'Poor prices',
    reputation: 'Reputation',
    reliability: 'Unreliable',
    availability: 'Frequently unavailable',
    vibe: 'Bad vibe',
    other: 'Other',
  });

  const state = {
""",
"""  const TRADER_REASON_LABELS = Object.freeze({
    prices: 'Poor prices',
    reputation: 'Reputation',
    reliability: 'Unreliable',
    availability: 'Frequently unavailable',
    vibe: 'Bad vibe',
    other: 'Other',
  });

  const LEDGER_FUNDING_SOURCES = Object.freeze(['unassigned', 'personal', 'butcher', 'shared', 'other']);
  const LEDGER_FUNDING_LABELS = Object.freeze({
    unassigned: 'Unassigned',
    personal: 'Personal',
    butcher: 'Butcher',
    shared: 'Shared',
    other: 'Other',
  });

  function normalizeLedgerFundingSource(value, fallback = 'unassigned') {
    const raw = normalizeName(value);
    if (!raw) return fallback;
    const aliases = {
      me: 'personal',
      mine: 'personal',
      self: 'personal',
      personal: 'personal',
      butcher: 'butcher',
      butchers: 'butcher',
      backer: 'butcher',
      bankroll: 'butcher',
      shared: 'shared',
      mixed: 'shared',
      joint: 'shared',
      other: 'other',
      unassigned: 'unassigned',
      unknown: 'unassigned',
      none: 'unassigned',
    };
    const normalized = aliases[raw] || raw;
    return LEDGER_FUNDING_SOURCES.includes(normalized) ? normalized : fallback;
  }

  function ledgerFundingSourceLabel(value) {
    return LEDGER_FUNDING_LABELS[normalizeLedgerFundingSource(value)] || LEDGER_FUNDING_LABELS.unassigned;
  }

  function ledgerFundingSourceOptions(selected, includeAll = false) {
    const active = includeAll && selected === 'all' ? 'all' : normalizeLedgerFundingSource(selected);
    const keys = includeAll ? ['all', ...LEDGER_FUNDING_SOURCES] : [...LEDGER_FUNDING_SOURCES];
    return keys.map((key) => {
      const label = key === 'all' ? 'All funding' : LEDGER_FUNDING_LABELS[key];
      return `<option value="${key}" ${active === key ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  const state = {
""",
'funding constants and helpers')

replace_once(
"""      sort: 'newest',
      showSold: true,
    },
  };
  state.ledgerUi.showSold = state.settings.ledgerShowSoldPurchases !== false;
""",
"""      sort: 'newest',
      showSold: true,
      fundingFilter: 'all',
    },
  };
  state.ledgerUi.showSold = state.settings.ledgerShowSoldPurchases !== false;
  state.settings.ledgerDefaultFundingSource = normalizeLedgerFundingSource(
    state.settings.ledgerDefaultFundingSource,
    'personal',
  );
""",
'state funding defaults')

replace_once(
"""        schemaVersion: 1,
        source: normalizeWhitespace(candidate?.source) || 'manual',
        venue: normalizeWhitespace(candidate?.venue) || normalizeWhitespace(candidate?.source) || 'manual',
        country: normalizeWhitespace(candidate?.country),
        location: normalizeWhitespace(candidate?.location),
        itemId: Number(candidate?.itemId) > 0 ? Number(candidate.itemId) : null,
""",
"""        schemaVersion: 2,
        source: normalizeWhitespace(candidate?.source) || 'manual',
        venue: normalizeWhitespace(candidate?.venue) || normalizeWhitespace(candidate?.source) || 'manual',
        country: normalizeWhitespace(candidate?.country),
        location: normalizeWhitespace(candidate?.location),
        fundingSource: normalizeLedgerFundingSource(candidate?.fundingSource ?? candidate?.capitalSource, 'unassigned'),
        itemId: Number(candidate?.itemId) > 0 ? Number(candidate.itemId) : null,
""",
'normalize lot funding')

replace_once(
"""      schema: 'tornscripture-imm-ledger',
      schemaVersion: 4,
""",
"""      schema: 'tornscripture-imm-ledger',
      schemaVersion: 5,
""",
'ledger schema version')

replace_once(
"""      source: normalizeWhitespace(raw.source) || 'item-market',
      createdAt: raw.createdAt || raw.clickedAt || new Date().toISOString(),
""",
"""      source: normalizeWhitespace(raw.source) || 'item-market',
      fundingSource: normalizeLedgerFundingSource(raw.fundingSource, 'personal'),
      createdAt: raw.createdAt || raw.clickedAt || new Date().toISOString(),
""",
'pending purchase funding')

replace_once(
"""      schemaVersion: 1,
      source: normalizeWhitespace(source?.source) || 'item-market',
      venue: normalizeWhitespace(source?.venue) || normalizeWhitespace(source?.source) || 'item-market',
      country: normalizeWhitespace(source?.country),
      location: normalizeWhitespace(source?.location),
      itemId: Number(source?.itemId) > 0 ? Number(source.itemId) : null,
""",
"""      schemaVersion: 2,
      source: normalizeWhitespace(source?.source) || 'item-market',
      venue: normalizeWhitespace(source?.venue) || normalizeWhitespace(source?.source) || 'item-market',
      country: normalizeWhitespace(source?.country),
      location: normalizeWhitespace(source?.location),
      fundingSource: normalizeLedgerFundingSource(
        source?.fundingSource,
        normalizeLedgerFundingSource(state.settings.ledgerDefaultFundingSource, 'personal'),
      ),
      itemId: Number(source?.itemId) > 0 ? Number(source.itemId) : null,
""",
'build lot funding')

replace_once(
"""      source: overseas ? 'overseas' : 'item-market',
      country: overseas ? overseasCountryFromPage() : '',
      createdAt: new Date().toISOString(),
""",
"""      source: overseas ? 'overseas' : 'item-market',
      country: overseas ? overseasCountryFromPage() : '',
      fundingSource: normalizeLedgerFundingSource(state.settings.ledgerDefaultFundingSource, 'personal'),
      createdAt: new Date().toISOString(),
""",
'purchase intent funding')

replace_once(
"""    const source = normalizeWhitespace(prompt(
      'Source (item-market, overseas, bazaar, manual):',
      existing?.source || 'manual'
    )) || 'manual';
    const country = source === 'overseas'
""",
"""    const source = normalizeWhitespace(prompt(
      'Source (item-market, overseas, bazaar, manual):',
      existing?.source || 'manual'
    )) || 'manual';
    const fundingRaw = prompt(
      'Funding source (Personal, Butcher, Shared, Other, or Unassigned):',
      ledgerFundingSourceLabel(existing?.fundingSource || state.settings.ledgerDefaultFundingSource),
    );
    if (fundingRaw === null) return null;
    const fundingSource = normalizeLedgerFundingSource(fundingRaw, '');
    if (!fundingSource) {
      alert('Funding source must be Personal, Butcher, Shared, Other, or Unassigned.');
      return null;
    }
    const country = source === 'overseas'
""",
'manual lot funding prompt')

replace_once(
"""      source,
      venue: source,
      country,
""",
"""      source,
      venue: source,
      country,
      fundingSource,
""",
'manual lot funding value')

replace_once(
"""  function deleteLedgerLot(id) {
""",
"""  function editLedgerLotFundingSource(id) {
    const lot = state.ledger.lots.find((entry) => entry.id === id);
    if (!lot) return;
    const raw = prompt(
      'Funding source (Personal, Butcher, Shared, Other, or Unassigned):',
      ledgerFundingSourceLabel(lot.fundingSource),
    );
    if (raw === null) return;
    const fundingSource = normalizeLedgerFundingSource(raw, '');
    if (!fundingSource) {
      alert('Funding source must be Personal, Butcher, Shared, Other, or Unassigned.');
      return;
    }
    lot.fundingSource = fundingSource;
    saveLedger();
    renderLedger();
    renderPanel();
    toast(`${lot.itemName} funding set to ${ledgerFundingSourceLabel(fundingSource)}.`);
  }

  function chooseLedgerDefaultFundingSource() {
    const raw = prompt(
      'Default funding source for NEW purchases (Personal, Butcher, Shared, Other, or Unassigned):',
      ledgerFundingSourceLabel(state.settings.ledgerDefaultFundingSource),
    );
    if (raw === null) return;
    const fundingSource = normalizeLedgerFundingSource(raw, '');
    if (!fundingSource) {
      alert('Funding source must be Personal, Butcher, Shared, Other, or Unassigned.');
      return;
    }
    state.settings.ledgerDefaultFundingSource = fundingSource;
    saveJson(APP.settingsStorageKey, state.settings);
    renderLedger();
    renderPanel();
    toast(`New purchases will use ${ledgerFundingSourceLabel(fundingSource)} funding.`);
  }

  function assignUnassignedOpenLedgerLots() {
    const target = normalizeLedgerFundingSource(state.settings.ledgerDefaultFundingSource, 'personal');
    if (target === 'unassigned') {
      toast('Choose a Personal, Butcher, Shared, or Other default first.');
      return;
    }
    const lots = state.ledger.lots.filter((lot) =>
      Number(lot.remainingQuantity || 0) > 0
      && normalizeLedgerFundingSource(lot.fundingSource) === 'unassigned'
    );
    if (!lots.length) {
      toast('No unassigned open lots were found.');
      return;
    }
    const invested = lots.reduce((sum, lot) =>
      sum + Number(lot.unitCost || 0) * Number(lot.remainingQuantity || 0), 0);
    if (!confirm(
      `Assign ${formatInteger(lots.length)} unassigned open lot${lots.length === 1 ? '' : 's'} to ${ledgerFundingSourceLabel(target)}?\n\n`
      + `Remaining invested capital: ${formatMoney(invested)}\n\nThis changes only the funding label. Quantities, prices, cost basis, and sales are untouched.`
    )) return;
    for (const lot of lots) lot.fundingSource = target;
    saveLedger();
    renderLedger();
    renderPanel();
    toast(`Assigned ${formatInteger(lots.length)} open lot${lots.length === 1 ? '' : 's'} to ${ledgerFundingSourceLabel(target)}.`);
  }

  function deleteLedgerLot(id) {
""",
'funding actions')

replace_once(
"""      normalizeWhitespace(lot?.source),
      normalizeWhitespace(lot?.venue),
      Math.floor(Number(lot?.quantity) || 0),
""",
"""      normalizeWhitespace(lot?.source),
      normalizeWhitespace(lot?.venue),
      normalizeLedgerFundingSource(lot?.fundingSource),
      Math.floor(Number(lot?.quantity) || 0),
""",
'cleanup funding key')

replace_once(
"""    if (query) lots = lots.filter((lot) => normalizeName(lot.itemName).includes(query));
    return sortLedgerLots(lots, state.ledgerUi.sort);
  }

  function saleAllocationsForLot(lotId) {
""",
"""    if (query) lots = lots.filter((lot) => normalizeName(lot.itemName).includes(query));
    if (state.ledgerUi.fundingFilter !== 'all') {
      lots = lots.filter((lot) => normalizeLedgerFundingSource(lot.fundingSource) === state.ledgerUi.fundingFilter);
    }
    return sortLedgerLots(lots, state.ledgerUi.sort);
  }

  function ledgerFundingSummary() {
    const openLots = (state.ledger.lots || []).filter((lot) => Number(lot.remainingQuantity || 0) > 0);
    return LEDGER_FUNDING_SOURCES.map((fundingSource) => {
      const lots = openLots.filter((lot) => normalizeLedgerFundingSource(lot.fundingSource) === fundingSource);
      return {
        fundingSource,
        label: ledgerFundingSourceLabel(fundingSource),
        lots: lots.length,
        quantity: lots.reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0), 0),
        invested: lots.reduce((sum, lot) =>
          sum + Number(lot.unitCost || 0) * Number(lot.remainingQuantity || 0), 0),
        expectedProfit: lots.reduce((sum, lot) =>
          sum + Number(lot.expectedProfitEach || 0) * Number(lot.remainingQuantity || 0), 0),
      };
    }).filter((row) => row.lots > 0);
  }

  function saleAllocationsForLot(lotId) {
""",
'funding filter and summary')

replace_once(
"""          <span>Total paid</span><strong>${formatMoney(lot.totalCost)}</strong>
          <span>Possible profit when bought</span><strong class="${originalClass}">${originalProfit === null ? 'Original value unavailable' : `${originalProfit >= 0 ? '+' : ''}${formatMoney(originalProfit)}`}</strong>
""",
"""          <span>Total paid</span><strong>${formatMoney(lot.totalCost)}</strong>
          <span>Funding</span><strong>${escapeHtml(ledgerFundingSourceLabel(lot.fundingSource))}</strong>
          <span>Possible profit when bought</span><strong class="${originalClass}">${originalProfit === null ? 'Original value unavailable' : `${originalProfit >= 0 ? '+' : ''}${formatMoney(originalProfit)}`}</strong>
""",
'lot funding display')

replace_once(
"""            <button type="button" data-tsimm-action="ledger-edit" data-tsimm-lot-id="${escapeHtml(lot.id)}">Edit</button>
            <button type="button" data-tsimm-action="ledger-delete" data-tsimm-lot-id="${escapeHtml(lot.id)}">Delete</button>
""",
"""            <button type="button" data-tsimm-action="ledger-funding-edit" data-tsimm-lot-id="${escapeHtml(lot.id)}">Funding</button>
            <button type="button" data-tsimm-action="ledger-edit" data-tsimm-lot-id="${escapeHtml(lot.id)}">Edit</button>
            <button type="button" data-tsimm-action="ledger-delete" data-tsimm-lot-id="${escapeHtml(lot.id)}">Delete</button>
""",
'lot funding button')

replace_once(
"""    const duplicatePreview = exactDuplicateLedgerPreview();
    const cleanupBackup = loadLedgerCleanupBackup();
    overlay.innerHTML = `
""",
"""    const duplicatePreview = exactDuplicateLedgerPreview();
    const cleanupBackup = loadLedgerCleanupBackup();
    const fundingSummary = ledgerFundingSummary();
    const unassignedOpenLots = fundingSummary.find((row) => row.fundingSource === 'unassigned')?.lots || 0;
    overlay.innerHTML = `
""",
'render funding data')

replace_once('What you obtained, what it cost, and what it can earn · schema v4', 'What you obtained, what it cost, and what it can earn · schema v5', 'ledger schema label')

replace_once(
"""         </div>
        <div class="tsimm-ledger-tabs" role="tablist">
""",
"""         </div>
        ${fundingSummary.length ? `
          <div class="tsimm-ledger-section-title">Capital by funding source</div>
          <div class="tsimm-ledger-summary">
            ${fundingSummary.map((row) => `
              <div>
                <strong>${formatMoney(row.invested)}</strong>
                <span>${escapeHtml(row.label)} · ${formatInteger(row.lots)} lot${row.lots === 1 ? '' : 's'} · ${row.expectedProfit >= 0 ? '+' : ''}${formatMoney(row.expectedProfit)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="tsimm-ledger-tabs" role="tablist">
""",
'funding summary cards')

replace_once(
"""          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-clean-duplicates" ${duplicatePreview.lots ? '' : 'disabled'}>Clean exact duplicates${duplicatePreview.lots ? ` (${formatInteger(duplicatePreview.lots)})` : ''}</button>
""",
"""          <button type="button" data-tsimm-action="ledger-import">Import JSON</button>
          <button type="button" data-tsimm-action="ledger-default-funding">New money: ${escapeHtml(ledgerFundingSourceLabel(state.settings.ledgerDefaultFundingSource))}</button>
          <button type="button" data-tsimm-action="ledger-assign-unassigned" ${unassignedOpenLots ? '' : 'disabled'}>Assign unassigned${unassignedOpenLots ? ` (${formatInteger(unassignedOpenLots)})` : ''}</button>
          <button type="button" data-tsimm-action="ledger-clean-duplicates" ${duplicatePreview.lots ? '' : 'disabled'}>Clean exact duplicates${duplicatePreview.lots ? ` (${formatInteger(duplicatePreview.lots)})` : ''}</button>
""",
'funding action buttons')

replace_once(
"""                <option value="purchase-price" ${state.ledgerUi.sort === 'purchase-price' ? 'selected' : ''}>Purchase price</option>
              </select>
            </div>
""",
"""                <option value="purchase-price" ${state.ledgerUi.sort === 'purchase-price' ? 'selected' : ''}>Purchase price</option>
              </select>
              <select data-tsimm-ledger-funding-filter>
                ${ledgerFundingSourceOptions(state.ledgerUi.fundingFilter, true)}
              </select>
            </div>
""",
'funding filter select')

replace_once(
"""      } else if (action === 'ledger-edit') {
        editLedgerLot(button.dataset.tsimmLotId);
      } else if (action === 'ledger-delete') {
""",
"""      } else if (action === 'ledger-funding-edit') {
        editLedgerLotFundingSource(button.dataset.tsimmLotId);
      } else if (action === 'ledger-edit') {
        editLedgerLot(button.dataset.tsimmLotId);
      } else if (action === 'ledger-default-funding') {
        chooseLedgerDefaultFundingSource();
      } else if (action === 'ledger-assign-unassigned') {
        assignUnassignedOpenLedgerLots();
      } else if (action === 'ledger-delete') {
""",
'funding click handlers')

replace_once(
"""      const ledgerSort = event.target.closest('[data-tsimm-ledger-sort]');
      if (ledgerSort) {
        state.ledgerUi.sort = ['newest', 'oldest', 'profit-now', 'item-name', 'purchase-price'].includes(ledgerSort.value)
          ? ledgerSort.value
          : 'newest';
        renderLedger();
        return;
      }
      const input = event.target.closest('[data-tsimm-setting]');
""",
"""      const ledgerSort = event.target.closest('[data-tsimm-ledger-sort]');
      if (ledgerSort) {
        state.ledgerUi.sort = ['newest', 'oldest', 'profit-now', 'item-name', 'purchase-price'].includes(ledgerSort.value)
          ? ledgerSort.value
          : 'newest';
        renderLedger();
        return;
      }
      const fundingFilter = event.target.closest('[data-tsimm-ledger-funding-filter]');
      if (fundingFilter) {
        state.ledgerUi.fundingFilter = fundingFilter.value === 'all'
          ? 'all'
          : normalizeLedgerFundingSource(fundingFilter.value);
        renderLedger();
        return;
      }
      const input = event.target.closest('[data-tsimm-setting]');
""",
'funding filter handler')

path.write_text(text)
print('PATCH_OK')
