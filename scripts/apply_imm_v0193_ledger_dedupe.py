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


replace_once('// @version      0.19.2', '// @version      0.19.3', 'header version')
replace_once(
    'purchase history, and receipt audits.',
    'purchase history, cross-channel purchase dedupe, and receipt audits.',
    'description',
)
replace_once('ITEM MARKET MARGIN v0.19.2', 'ITEM MARKET MARGIN v0.19.3', 'internal version comment')

version_count = text.count("version: '0.19.2'")
print(f'version constants: {version_count} match(es)')
if version_count != 3:
    raise SystemExit(f'version constants: expected three matches, found {version_count}')
text = text.replace("version: '0.19.2'", "version: '0.19.3'")

old_fingerprint = """  function purchaseFingerprint(parsed) {
    return [
      normalizeName(parsed?.itemName),
      Math.floor(Number(parsed?.quantity) || 0),
      Math.round(Number(parsed?.totalCost) || 0),
      Number(itemIdFromLocation()) || 0,
      stableTextHash(parsed?.successText),
    ].join('|');
  }
"""
new_fingerprint = """  function purchaseFingerprint(parsed, itemId = itemIdFromLocation()) {
    return [
      normalizeName(parsed?.itemName),
      Math.floor(Number(parsed?.quantity) || 0),
      Math.round(Number(parsed?.totalCost) || 0),
      Number(itemId) || 0,
    ].join('|');
  }
"""
replace_once(old_fingerprint, new_fingerprint, 'purchase fingerprint')

old_commit = """  function commitPendingPurchase(captureMethod = 'detected-success', signal = '') {
    const pending = state.pendingPurchase;
    if (!pending) return null;
    const lot = buildLedgerLot({
      ...pending,
      marketValueAtPurchase: pending.marketValue,
      traderValueAtPurchase: pending.traderValue,
      capturedAt: new Date().toISOString(),
      notes: signal ? `Capture signal: ${sanitizePurchaseSignalText(signal).slice(0, 180)}` : '',
    }, captureMethod);
    state.pendingPurchase = null;
    savePendingPurchase();
    activePendingTraderCapture();
    addLedgerLot(lot);
    scheduleScan(30);
    toast(`Ledger recorded ${formatInteger(lot.quantity)}× ${lot.itemName}.`);
    return lot;
  }
"""
new_commit = """  function commitPendingPurchase(captureMethod = 'detected-success', signal = '') {
    const pending = state.pendingPurchase;
    if (!pending) return null;
    const fingerprint = purchaseFingerprint({
      itemName: pending.itemName,
      quantity: pending.quantity,
      totalCost: pending.totalCost,
    }, pending.itemId);
    const lot = buildLedgerLot({
      ...pending,
      marketValueAtPurchase: pending.marketValue,
      traderValueAtPurchase: pending.traderValue,
      capturedAt: new Date().toISOString(),
      notes: signal ? `Capture signal: ${sanitizePurchaseSignalText(signal).slice(0, 180)}` : '',
    }, captureMethod);
    state.pendingPurchase = null;
    savePendingPurchase();
    activePendingTraderCapture();
    rememberPurchaseFingerprint(fingerprint);
    addLedgerLot(lot);
    scheduleScan(30);
    toast(`Ledger recorded ${formatInteger(lot.quantity)}× ${lot.itemName}.`);
    return lot;
  }
"""
replace_once(old_commit, new_commit, 'pending purchase commit')

old_direct = """  function capturePurchaseDirectlyFromSuccessText(value, source = 'dom-success-fallback', url = '') {
    const overseas = pageLooksLikeOverseasShop();
    if (!pageLooksLikeItemMarket() && !overseas) return null;
    const parsed = parsePurchaseSuccessText(value);
    if (!parsed) return null;
    const fingerprint = purchaseFingerprint(parsed);
    if (hasRecentPurchaseFingerprint(fingerprint)) return null;

    if (state.pendingPurchase) {
      const pendingMatches = normalizeName(state.pendingPurchase.itemName) === normalizeName(parsed.itemName)
        && Number(state.pendingPurchase.quantity) === Number(parsed.quantity)
        && Math.round(Number(state.pendingPurchase.totalCost)) === Math.round(Number(parsed.totalCost));
      if (pendingMatches) {
        rememberPurchaseFingerprint(fingerprint);
        recordPurchaseSignal('success', source, parsed.successText, url);
        return commitPendingPurchase(source, parsed.successText);
      }
    }

    const itemId = overseas ? null : itemIdFromLocation();
    const catalog = catalogItemFor(parsed.itemName, itemId);
    const marketValueAtPurchase = Number(catalog?.marketPrice || (overseas ? 0 : resolveListingMarketValue().value) || 0);
    const lot = buildLedgerLot({
      source: overseas ? 'overseas' : 'item-market',
      venue: overseas ? 'overseas' : 'item-market',
      country: overseas ? overseasCountryFromPage() : '',
      itemId: catalog?.id || itemId || null,
      itemName: catalog?.name || parsed.itemName,
      quantity: parsed.quantity,
      unitCost: parsed.unitCost,
      marketValueAtPurchase,
      traderValueAtPurchase: traderPayout(marketValueAtPurchase),
      capturedAt: new Date().toISOString(),
      purchaseUrl: url || location.href,
      notes: 'Captured from Torn success message.',
    }, source);

    rememberPurchaseFingerprint(fingerprint);
    recordPurchaseSignal('success', source, parsed.successText, url);
    addLedgerLot(lot);
    scheduleScan(30);
    toast(`Ledger auto-recorded ${formatInteger(lot.quantity)}× ${lot.itemName}.`);
    return lot;
  }
"""
new_direct = """  function capturePurchaseDirectlyFromSuccessText(value, source = 'dom-success-fallback', url = '') {
    const overseas = pageLooksLikeOverseasShop();
    if (!pageLooksLikeItemMarket() && !overseas) return null;
    const parsed = parsePurchaseSuccessText(value);
    if (!parsed) return null;
    const locationItemId = overseas ? null : itemIdFromLocation();
    const catalog = catalogItemFor(parsed.itemName, locationItemId);
    const resolvedItemId = catalog?.id || locationItemId || null;
    const fingerprint = purchaseFingerprint(parsed, resolvedItemId);

    if (state.pendingPurchase) {
      const pendingMatches = normalizeName(state.pendingPurchase.itemName) === normalizeName(parsed.itemName)
        && Number(state.pendingPurchase.quantity) === Number(parsed.quantity)
        && Math.round(Number(state.pendingPurchase.totalCost)) === Math.round(Number(parsed.totalCost));
      if (pendingMatches) {
        recordPurchaseSignal('success', source, parsed.successText, url);
        return commitPendingPurchase(source, parsed.successText);
      }
    }

    if (hasRecentPurchaseFingerprint(fingerprint)) {
      recordPurchaseSignal('duplicate-suppressed', source, parsed.successText, url);
      return null;
    }

    const marketValueAtPurchase = Number(catalog?.marketPrice || (overseas ? 0 : resolveListingMarketValue().value) || 0);
    const lot = buildLedgerLot({
      source: overseas ? 'overseas' : 'item-market',
      venue: overseas ? 'overseas' : 'item-market',
      country: overseas ? overseasCountryFromPage() : '',
      itemId: resolvedItemId,
      itemName: catalog?.name || parsed.itemName,
      quantity: parsed.quantity,
      unitCost: parsed.unitCost,
      marketValueAtPurchase,
      traderValueAtPurchase: traderPayout(marketValueAtPurchase),
      capturedAt: new Date().toISOString(),
      purchaseUrl: url || location.href,
      notes: 'Captured from Torn success message.',
    }, source);

    rememberPurchaseFingerprint(fingerprint);
    recordPurchaseSignal('success', source, parsed.successText, url);
    addLedgerLot(lot);
    scheduleScan(30);
    toast(`Ledger auto-recorded ${formatInteger(lot.quantity)}× ${lot.itemName}.`);
    return lot;
  }
"""
replace_once(old_direct, new_direct, 'direct success capture')

path.write_text(text)
print('PATCH_OK')
