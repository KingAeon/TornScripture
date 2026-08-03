from pathlib import Path

SOURCE = Path('TornScripture-Item-Market-Margin.user.js')
TEST = Path('tests/imm-trade-api-recovery.test.js')
PREACCEPT_TEST = Path('tests/imm-trade-preaccept.test.js')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}')
    return source.replace(old, new)


source = SOURCE.read_text()
if source.count('0.19.36') != 5:
    raise RuntimeError(f'Expected five 0.19.36 markers, found {source.count("0.19.36")}')
source = source.replace('0.19.36', '0.19.37')

source = replace_once(
    source,
    "    inventoryItemMarketUrl: 'https://api.torn.com/v2/user/itemmarket',\n",
    "    inventoryItemMarketUrl: 'https://api.torn.com/v2/user/itemmarket',\n"
    "    tradesUrl: 'https://api.torn.com/v2/user/trades',\n",
    'trades URL',
)
source = replace_once(
    source,
    '    inventorySyncing: false,\n',
    '    inventorySyncing: false,\n    tradeRecoveryBusy: false,\n',
    'trade recovery state',
)
source = replace_once(
    source,
    '   * - The key is sent only to Torn\'s official API.\n',
    '   * - The key is sent only to Torn\'s official API. Finished-trade recovery is read-only until the user confirms a reviewed sale.\n',
    'safety boundary',
)

hook_start = source.index('  function tradeAcceptanceActionLabel(')
hook_end = source.index('  function bindPanelEvents()', hook_start)
source = source[:hook_start] + source[hook_end:]
source = replace_once(
    source,
    "    document.addEventListener('click', captureTradeSnapshotBeforeAcceptance, true);\n",
    '',
    'fragile acceptance listener',
)

api_code = r'''
  function apiTradeTimestampIso(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    const milliseconds = Number.isFinite(numeric) && numeric > 0
      ? (numeric > 10_000_000_000 ? numeric : numeric * 1000)
      : Date.parse(value);
    if (!Number.isFinite(milliseconds)) return null;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function apiTradeListFromPayload(payload) {
    const trades = payload?.trades ?? payload?.data?.trades ?? (Array.isArray(payload) ? payload : []);
    return Array.isArray(trades) ? trades.filter((trade) => trade && typeof trade === 'object') : [];
  }

  function apiTradeDetailFromPayload(payload) {
    const trade = payload?.trade ?? payload?.data?.trade ?? payload;
    return trade && typeof trade === 'object' && !Array.isArray(trade) ? trade : null;
  }

  function apiTradeParticipant(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const id = Math.max(0, Math.floor(Number(candidate.id ?? candidate.user_id ?? candidate.userId) || 0)) || null;
    const name = normalizeWhitespace(candidate.name ?? candidate.username) || (id ? `Player ${id}` : '');
    return id || name ? { id, name } : null;
  }

  function apiTradeParticipants(trade) {
    return [apiTradeParticipant(trade?.user), apiTradeParticipant(trade?.trader)].filter(Boolean);
  }

  function apiTradeCounterparty(trade, ownUserId) {
    const ownId = Math.max(0, Math.floor(Number(ownUserId) || 0)) || null;
    if (!ownId) throw new Error('The API key owner could not be identified. Check the GOBLIN GOD key.');
    const participants = apiTradeParticipants(trade);
    if (!participants.some((participant) => participant.id === ownId)) {
      throw new Error('This API trade does not identify the current key owner as a participant.');
    }
    return participants.find((participant) => participant.id !== ownId) || null;
  }

  function apiTradeEntryOwnerId(entry) {
    return Math.max(0, Math.floor(Number(entry?.user_id ?? entry?.userId ?? entry?.owner_id) || 0)) || null;
  }

  function apiTradeEntryType(entry) {
    return normalizeWhitespace(entry?.type ?? entry?.item_type ?? entry?.category).toLowerCase();
  }

  function apiTradeStatsFromDetail(payload, ownUserId) {
    const trade = apiTradeDetailFromPayload(payload);
    if (!trade) throw new Error('Torn returned no usable detailed trade.');
    const ownId = Math.max(0, Math.floor(Number(ownUserId) || 0)) || null;
    const counterparty = apiTradeCounterparty(trade, ownId);
    if (!counterparty?.id) throw new Error('The trade counterparty could not be identified.');

    const entries = Array.isArray(trade.items)
      ? trade.items
      : Array.isArray(trade.trade_items) ? trade.trade_items : [];
    const outgoingItems = new Map();
    const unmatched = [];
    const unsupported = [];
    let ownCash = 0;
    let counterpartyCash = 0;

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const ownerId = apiTradeEntryOwnerId(entry);
      const type = apiTradeEntryType(entry);
      const details = entry.details && typeof entry.details === 'object' ? entry.details : entry;
      if (type === 'money') {
        const amount = Math.max(0, Number(details.amount ?? details.value) || 0);
        if (ownerId === ownId) ownCash += amount;
        else if (ownerId === counterparty.id) counterpartyCash += amount;
        continue;
      }
      if (type === 'item') {
        const itemId = Math.max(0, Math.floor(Number(details.id ?? details.item_id ?? details.itemId) || 0)) || null;
        const quantity = Math.max(0, Math.floor(Number(details.amount ?? details.quantity ?? details.qty) || 0));
        if (!itemId || !quantity) continue;
        if (ownerId !== ownId) {
          unsupported.push(`Counterparty item ${itemId} × ${quantity}`);
          continue;
        }
        const key = `id:${itemId}`;
        const current = outgoingItems.get(key) || { itemId, quantity: 0 };
        current.quantity += quantity;
        outgoingItems.set(key, current);
        continue;
      }
      if (type) unsupported.push(`${ownerId === ownId ? 'Your' : 'Counterparty'} ${normalizeWhitespace(entry.type || type)}`);
    }

    const tradeItems = [];
    for (const outgoing of outgoingItems.values()) {
      const catalog = catalogItemFor('', outgoing.itemId);
      const name = normalizeWhitespace(catalog?.name) || `Item ${outgoing.itemId}`;
      const marketPrice = Math.max(0, Number(catalog?.marketPrice) || 0);
      if (!catalog || !marketPrice) {
        unmatched.push({ itemId: outgoing.itemId, name, quantity: outgoing.quantity });
        continue;
      }
      const targetEach = traderPayout(marketPrice);
      tradeItems.push({
        itemId: outgoing.itemId,
        name,
        quantity: outgoing.quantity,
        marketPrice,
        marketTotal: marketPrice * outgoing.quantity,
        targetEach,
        targetTotal: targetEach * outgoing.quantity,
      });
    }

    const tradeMarketTotal = tradeItems.reduce((sum, item) => sum + Number(item.marketTotal || 0), 0);
    const tradeTargetTotal = tradeItems.reduce((sum, item) => sum + Number(item.targetTotal || 0), 0);
    const tradeId = normalizeWhitespace(trade.id ?? trade.trade_id ?? trade.tradeId);
    const completedAt = apiTradeTimestampIso(trade.completed_at ?? trade.timestamp ?? trade.modified_at);
    const tradeNetCash = counterpartyCash - ownCash;
    return {
      pageType: 'trade',
      tradeId,
      tradeCaptureId: '',
      tradeCompleted: true,
      tradeCompletionSource: 'Torn API v2 detailed trade',
      tradeCompletedAt: completedAt,
      tradeSourceUrl: tradeId ? `https://www.torn.com/trade.php#step=logview&ID=${tradeId}` : '',
      tradeCounterparty: counterparty.name,
      tradeCounterpartyId: counterparty.id,
      tradeCounterpartyProfileUrl: `https://www.torn.com/profiles.php?XID=${counterparty.id}`,
      tradeCounterpartyBannerUrl: '',
      tradeTraderCash: counterpartyCash,
      tradeMyCash: ownCash,
      tradeNetCash,
      tradeMarketTotal,
      tradeTargetTotal,
      tradeItems,
      tradeMatchedItems: tradeItems.length,
      tradeUnmatchedItems: unmatched.length,
      tradeUnmatched: unmatched,
      apiUnsupportedEntries: unsupported,
      notes: [],
    };
  }

  function possibleRecordedSaleForApiStats(stats) {
    const exact = recordedSaleForStats(stats);
    if (exact) return exact;
    const fingerprint = saleContentFingerprintForStats(stats);
    const completedAt = Date.parse(stats?.tradeCompletedAt || '');
    return (state.ledger.sales || []).find((sale) => {
      const saleFingerprint = saleContentFingerprintForStats({
        tradeItems: (sale.items || []).map((item) => ({
          name: item.itemName ?? item.name,
          quantity: item.quantity,
        })),
        tradeNetCash: sale.cashReceived,
      });
      if (saleFingerprint !== fingerprint) return false;
      if (!Number.isFinite(completedAt)) return true;
      const soldAt = Date.parse(sale.soldAt || '');
      return Number.isFinite(soldAt) && Math.abs(soldAt - completedAt) <= 6 * 60 * 60 * 1000;
    }) || null;
  }

  async function fetchTornApiJson(urlValue, context = 'Torn API') {
    const key = currentApiKey();
    if (!key) throw new Error('Paste a GOBLIN GOD API key first.');
    const response = await fetch(String(urlValue), {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `ApiKey ${key}` },
      credentials: 'omit',
      cache: 'no-store',
    });
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error(`${context} returned unreadable data (${response.status}).`); }
    if (!response.ok || payload?.error) throw new Error(apiErrorMessage(payload, response));
    return payload;
  }

  function apiTradeListLabel(trade, ownUserId, index) {
    let counterparty = null;
    try { counterparty = apiTradeCounterparty(trade, ownUserId); } catch {}
    const completedAt = apiTradeTimestampIso(trade?.completed_at ?? trade?.timestamp ?? trade?.modified_at);
    const when = completedAt ? new Date(completedAt).toLocaleString() : 'time unavailable';
    return `${index + 1}. ${counterparty?.name || `Trade ${trade?.id || '?'}`} · ${when} · API #${trade?.id || '?'}`;
  }

  async function recoverRecentTradeFromApi() {
    if (state.tradeRecoveryBusy) return false;
    if (!currentApiKey()) {
      toast('Paste or replace the GOBLIN GOD key with user trade permissions first.');
      configureGoblinGodKey();
      return false;
    }
    state.tradeRecoveryBusy = true;
    renderLedger();
    try {
      if (!state.keyProfile?.userId) await inspectGoblinGodKey();
      const ownUserId = Math.max(0, Math.floor(Number(state.keyProfile?.userId) || 0)) || null;
      if (!ownUserId) throw new Error('The API key owner could not be identified. Run Check permissions.');

      const listUrl = new URL(APP.tradesUrl);
      listUrl.searchParams.set('cat', 'finished');
      listUrl.searchParams.set('limit', '25');
      listUrl.searchParams.set('sort', 'DESC');
      listUrl.searchParams.set('comment', 'TornScripture Black Ledger trade recovery');
      const listPayload = await fetchTornApiJson(listUrl.href, 'Trade history');
      const recent = apiTradeListFromPayload(listPayload)
        .filter((trade) => normalizeWhitespace(trade?.id))
        .filter((trade) => !(state.ledger.sales || []).some((sale) =>
          normalizeWhitespace(sale?.tradeId) === normalizeWhitespace(trade.id)
          || normalizeWhitespace(sale?.fingerprint) === `trade:${normalizeWhitespace(trade.id)}`
        ))
        .slice(0, 12);
      if (!recent.length) {
        alert('No unrecorded finished trades were found in the most recent API results.');
        return false;
      }

      const choice = prompt(
        `Recover a recent finished trade from Torn's API.\n\n${recent.map((trade, index) => apiTradeListLabel(trade, ownUserId, index)).join('\n')}\n\nEnter a number from 1 to ${recent.length}:`,
        '1',
      );
      if (choice === null) return false;
      const selectedIndex = Math.floor(Number(choice)) - 1;
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= recent.length) {
        throw new Error('That trade selection was not valid.');
      }
      const selected = recent[selectedIndex];
      const tradeId = normalizeWhitespace(selected.id);
      const detailUrl = new URL(`https://api.torn.com/v2/user/${encodeURIComponent(tradeId)}/trade`);
      detailUrl.searchParams.set('stripTags', 'true');
      detailUrl.searchParams.set('comment', 'TornScripture Black Ledger detailed trade recovery');
      const detailPayload = await fetchTornApiJson(detailUrl.href, `Detailed trade ${tradeId}`);
      const stats = apiTradeStatsFromDetail(detailPayload, ownUserId);
      const existing = possibleRecordedSaleForApiStats(stats);
      if (existing) {
        alert(`This API trade already matches saved sale ${existing.id}. Nothing was changed.`);
        return false;
      }
      if (stats.apiUnsupportedEntries.length) {
        alert(`This trade contains assets Black Ledger does not safely account for yet:\n\n${stats.apiUnsupportedEntries.join('\n')}\n\nUse manual recovery only after reviewing the full trade.`);
        return false;
      }
      if (stats.tradeUnmatchedItems) {
        alert(`Black Ledger could not value ${stats.tradeUnmatchedItems} API item type${stats.tradeUnmatchedItems === 1 ? '' : 's'}. Sync item values, then retry this recovery.\n\n${stats.tradeUnmatched.map((item) => `${item.name} × ${item.quantity}`).join('\n')}`);
        return false;
      }
      if (!stats.tradeItems.length) throw new Error('The selected trade contains no outgoing item entries to record as a sale.');
      if (!Number.isFinite(stats.tradeNetCash)) throw new Error('The selected trade does not contain usable money entries.');

      const plan = ledgerSalePlan(stats);
      if (!plan.trackedQuantity) {
        alert('None of the items in this API trade match open Black Ledger lots. Nothing was changed.');
        return false;
      }
      if (!plan.fullCoverage) {
        alert(`This API trade is only partially covered by Black Ledger.\n\nTracked: ${formatInteger(plan.trackedQuantity)}\nUntracked: ${formatInteger(plan.untrackedQuantity)}\n\nAPI recovery is fail-closed until every sold quantity has a ledger lot. Use the manual recovery tool only after reviewing the missing lots.`);
        return false;
      }

      applyLedgerSalePreview(stats);
      const completedText = stats.tradeCompletedAt ? new Date(stats.tradeCompletedAt).toLocaleString() : 'Unknown completion time';
      const itemText = stats.tradeItems.map((item) => `${item.name} × ${formatInteger(item.quantity)}`).join('\n');
      const accepted = confirm(
        `Record this API-confirmed sale?\n\n`
        + `Trader: ${stats.tradeCounterparty} [${stats.tradeCounterpartyId}]\n`
        + `Completed: ${completedText}\n`
        + `API trade: ${stats.tradeId}\n\n`
        + `${itemText}\n\n`
        + `Trader cash: ${formatMoney(stats.tradeTraderCash)}\n`
        + `Your cash: ${formatMoney(stats.tradeMyCash)}\n`
        + `Net proceeds: ${formatMoney(stats.tradeNetCash)}\n`
        + `FIFO cost basis: ${formatMoney(plan.trackedCostBasis)}\n`
        + `Realized profit: ${plan.realizedProfit >= 0 ? '+' : ''}${formatMoney(plan.realizedProfit)}\n\n`
        + 'Black Ledger will consume the matched FIFO quantities only after you press OK.',
      );
      if (!accepted) return false;

      const sale = recordTradeSale(stats, 'api-confirmed-trade');
      state.ledgerUi.view = 'sales';
      renderLedger();
      toast(`API sale recorded. Profit ${sale.realizedProfit >= 0 ? '+' : ''}${formatMoney(sale.realizedProfit)}.`);
      return true;
    } catch (error) {
      console.error('[TornScripture IMM] API trade recovery failed:', error);
      const message = normalizeWhitespace(error?.message || 'API trade recovery failed.');
      if (/access level|permission|selection|not high enough/i.test(message)) {
        alert(`${message}\n\nReplace the GOBLIN GOD custom key with both user → trades and user → trade enabled, then run Check permissions.`);
      } else {
        alert(message);
      }
      return false;
    } finally {
      state.tradeRecoveryBusy = false;
      renderLedger();
      renderPanel();
    }
  }

'''
source = replace_once(source, '  function pageLooksLikeTrade() {', api_code + '  function pageLooksLikeTrade() {', 'API code insertion')

source = replace_once(
    source,
    '    tradeCaptureIdForStats(stats, true);\n\n    const plan = ledgerSalePlan(stats);\n',
    "    if (!String(captureMethod).startsWith('api-')) tradeCaptureIdForStats(stats, true);\n\n    const plan = ledgerSalePlan(stats);\n",
    'API capture ID suppression',
)
source = replace_once(
    source,
    '    const completion = tradeCompletionState();\n',
    "    const completion = stats.tradeCompletionSource\n"
    "      ? { source: normalizeWhitespace(stats.tradeCompletionSource) }\n"
    "      : tradeCompletionState();\n",
    'completion source',
)
source = replace_once(
    source,
    '      soldAt: new Date().toISOString(),\n      saleUrl: location.href,\n',
    "      soldAt: apiTradeTimestampIso(stats.tradeCompletedAt) || new Date().toISOString(),\n"
    "      saleUrl: normalizeHttpUrl(stats.tradeSourceUrl) || location.href,\n",
    'API sale metadata',
)
source = replace_once(
    source,
    '    if (!markPendingTradeSaleRecorded(stats, sale.id)) {\n',
    "    if (!String(captureMethod).startsWith('api-') && !markPendingTradeSaleRecorded(stats, sale.id)) {\n",
    'pending live snapshot suppression',
)

manual_button = '          <button type="button" data-tsimm-action="ledger-recover-sale">Recover missed sale</button>\n'
api_button = (
    '          <button type="button" data-tsimm-action="ledger-recover-api" ${state.tradeRecoveryBusy ? \'disabled\' : \'\'}>'
    '${state.tradeRecoveryBusy ? \'Loading recent trades…\' : \'Recover recent API trade\'}</button>\n'
)
source = replace_once(source, manual_button, api_button + manual_button, 'API recovery button')

action_anchor = "      } else if (action === 'ledger-recover-sale') {\n"
source = replace_once(
    source,
    action_anchor,
    "      } else if (action === 'ledger-recover-api') {\n"
    "        recoverRecentTradeFromApi();\n"
    + action_anchor,
    'API recovery action',
)

SOURCE.write_text(source)
if PREACCEPT_TEST.exists():
    PREACCEPT_TEST.unlink()

TEST.write_text(r'''const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = process.env.TSIMM_TEST_SCRIPT
  ? path.resolve(process.env.TSIMM_TEST_SCRIPT)
  : path.join(__dirname, '..', 'TornScripture-Item-Market-Margin.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function extractNamedFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist in IMM`);
  const parametersEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', parametersEnd);
  assert.notEqual(bodyStart, -1, `${name} should have a body`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const catalog = new Map([
  [1, { id: 1, name: 'Fixture Plushie', marketPrice: 2_000_000 }],
  [2, { id: 2, name: 'Fixture Flower', marketPrice: 500_000 }],
]);
const sandbox = {
  console,
  Date,
  Number,
  Map,
  Error,
  Array,
  Math,
  normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },
  catalogItemFor(name, id) {
    return catalog.get(Number(id)) || null;
  },
  traderPayout(value) {
    return Math.floor(Number(value) * 0.99);
  },
};
vm.createContext(sandbox);
for (const name of [
  'apiTradeTimestampIso',
  'apiTradeListFromPayload',
  'apiTradeDetailFromPayload',
  'apiTradeParticipant',
  'apiTradeParticipants',
  'apiTradeCounterparty',
  'apiTradeEntryOwnerId',
  'apiTradeEntryType',
  'apiTradeStatsFromDetail',
]) {
  vm.runInContext(extractNamedFunction(name), sandbox, { filename: scriptPath });
}

assert.equal(sandbox.apiTradeTimestampIso(1_700_000_000), '2023-11-14T22:13:20.000Z');
assert.equal(sandbox.apiTradeTimestampIso('2026-08-03T12:00:00Z'), '2026-08-03T12:00:00.000Z');
assert.equal(sandbox.apiTradeTimestampIso('not-a-date'), null);
assert.equal(sandbox.apiTradeListFromPayload({ trades: [{ id: 1 }] }).length, 1);
assert.equal(sandbox.apiTradeListFromPayload({ data: { trades: [{ id: 2 }] } })[0].id, 2);

const detail = {
  trade: {
    id: 6509836,
    user: { id: 100, name: 'Ledger Owner' },
    trader: { id: 200, name: 'Fixture Buyer' },
    completed_at: 1_700_000_000,
    items: [
      { user_id: 100, type: 'Item', details: { id: 1, uid: 9001, amount: 2 } },
      { user_id: 100, type: 'Item', details: { id: 1, uid: 9002, amount: 3 } },
      { user_id: 100, type: 'Item', details: { id: 2, amount: 4 } },
      { user_id: 200, type: 'Money', details: { amount: 8_000_000 } },
      { user_id: 100, type: 'Money', details: { amount: 100_000 } },
    ],
  },
};
const stats = sandbox.apiTradeStatsFromDetail(detail, 100);
assert.equal(stats.tradeId, '6509836');
assert.equal(stats.tradeCounterparty, 'Fixture Buyer');
assert.equal(stats.tradeCounterpartyId, 200);
assert.equal(stats.tradeTraderCash, 8_000_000);
assert.equal(stats.tradeMyCash, 100_000);
assert.equal(stats.tradeNetCash, 7_900_000);
assert.equal(stats.tradeItems.length, 2);
assert.equal(stats.tradeItems.find((item) => item.itemId === 1).quantity, 5);
assert.equal(stats.tradeItems.find((item) => item.itemId === 2).quantity, 4);
assert.equal(stats.tradeMarketTotal, 12_000_000);
assert.equal(stats.tradeTargetTotal, 11_880_000);
assert.equal(stats.tradeUnmatchedItems, 0);
assert.deepEqual(stats.apiUnsupportedEntries, []);
assert.equal(stats.tradeCompletionSource, 'Torn API v2 detailed trade');
assert.equal(stats.tradeCompletedAt, '2023-11-14T22:13:20.000Z');

const unknown = structuredClone(detail);
unknown.trade.items.push({ user_id: 100, type: 'Item', details: { id: 999, amount: 2 } });
const unknownStats = sandbox.apiTradeStatsFromDetail(unknown, 100);
assert.equal(unknownStats.tradeUnmatchedItems, 1);
assert.equal(unknownStats.tradeUnmatched[0].itemId, 999);

const unsupported = structuredClone(detail);
unsupported.trade.items.push({ user_id: 200, type: 'Item', details: { id: 2, amount: 1 } });
unsupported.trade.items.push({ user_id: 100, type: 'Property', details: { id: 55 } });
const unsupportedStats = sandbox.apiTradeStatsFromDetail(unsupported, 100);
assert.equal(unsupportedStats.apiUnsupportedEntries.length, 2);
assert.throws(() => sandbox.apiTradeStatsFromDetail(detail, 999), /key owner|participant/i);

assert.equal(source.includes('captureTradeSnapshotBeforeAcceptance'), false);
assert.equal(source.includes("document.addEventListener('click', captureTradeSnapshotBeforeAcceptance, true);"), false);
assert.notEqual(source.indexOf('data-tsimm-action="ledger-recover-api"'), -1);
assert.notEqual(source.indexOf("tradesUrl: 'https://api.torn.com/v2/user/trades'"), -1);
assert.notEqual(source.indexOf('soldAt: apiTradeTimestampIso(stats.tradeCompletedAt)'), -1);
assert.notEqual(source.indexOf("!String(captureMethod).startsWith('api-')"), -1);

console.log('IMM API trade recovery tests passed.');
''')

print('Prepared IMM v0.19.37 API-backed trade recovery.')
