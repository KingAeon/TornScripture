from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    text = text.replace(old, new, 1)


version_count = text.count('0.17.1')
if version_count < 4:
    raise SystemExit(f'version markers: expected at least 4 matches, found {version_count}')
text = text.replace('0.17.1', '0.17.2')

replace_once(
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, TornPDA priced-trade inventory badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, market-velocity learning, pre-trade picker payout badges, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    'metadata description',
)

old_verification = '''  function pricedTradeVerification(stats) {
    const session = loadPricedTradeSession();
    if (!session) return { status: 'inactive', session: null, trader: null, currentTrader: null };
    const trader = pricedTradeArmedTrader(session);
    if (!trader) return { status: 'missing-trader', session, trader: null, currentTrader: null };
    const currentTrader = currentTradeTrader(stats);
    const counterpartyId = Number(stats?.tradeCounterpartyId) > 0 ? Number(stats.tradeCounterpartyId) : null;
    const counterpartyName = normalizeName(stats?.tradeCounterparty);
    const idMatches = Boolean(
      counterpartyId
      && Number(trader.userId) > 0
      && Number(trader.userId) === counterpartyId
    );
    const nameMatches = Boolean(counterpartyName && trader.normalizedName === counterpartyName);
    const currentMatches = Boolean(currentTrader && currentTrader.id === trader.id);
    if (!counterpartyId && !counterpartyName && !currentTrader) {
      return { status: 'waiting', session, trader, currentTrader: null };
    }
    return {
      status: idMatches || nameMatches || currentMatches ? 'verified' : 'mismatch',
      session,
      trader,
      currentTrader,
    };
  }
'''
new_verification = '''  function pricedTradeVerification(stats) {
    const session = loadPricedTradeSession();
    if (!session) return { status: 'inactive', session: null, trader: null, currentTrader: null, verificationSource: '' };
    const trader = pricedTradeArmedTrader(session);
    if (!trader) return { status: 'missing-trader', session, trader: null, currentTrader: null, verificationSource: '' };
    const currentTrader = currentTradeTrader(stats);
    const counterpartyId = Number(stats?.tradeCounterpartyId) > 0 ? Number(stats.tradeCounterpartyId) : null;
    const counterpartyName = normalizeName(stats?.tradeCounterparty);
    const idMatches = Boolean(
      counterpartyId
      && Number(trader.userId) > 0
      && Number(trader.userId) === counterpartyId
    );
    const nameMatches = Boolean(counterpartyName && trader.normalizedName === counterpartyName);
    const currentMatches = Boolean(currentTrader && currentTrader.id === trader.id);
    if (!counterpartyId && !counterpartyName && !currentTrader) {
      const inventorySurface = pricedTradeInventorySurface();
      const recentHandoff = Date.now() - Number(session.armedAt || 0) <= 15 * 60 * 1000;
      const tradeRoute = /(?:^|\\/)trade\\.php$/i.test(location.pathname)
        || /(?:^|\\/)trade\\.php(?:[?#]|$)/i.test(location.href);
      if (inventorySurface && recentHandoff && tradeRoute) {
        return {
          status: 'verified',
          session,
          trader,
          currentTrader: null,
          verificationSource: 'armed-picker',
        };
      }
      return { status: 'waiting', session, trader, currentTrader: null, verificationSource: '' };
    }
    const verified = idMatches || nameMatches || currentMatches;
    return {
      status: verified ? 'verified' : 'mismatch',
      session,
      trader,
      currentTrader,
      verificationSource: verified ? 'live-counterparty' : 'live-mismatch',
    };
  }
'''
replace_once(old_verification, new_verification, 'priced-trade pre-trade verification')

old_detail = '''    const detail = verification.status === 'verified'
      ? `${formatInteger(priced)}/${formatInteger(decorated)} visible addable items priced · ${formatInteger(count)} captured prices · ${freshness.ageLabel}`
      : verification.status === 'waiting'
'''
new_detail = '''    const detail = verification.status === 'verified'
      ? verification.verificationSource === 'armed-picker'
        ? `${formatInteger(priced)}/${formatInteger(decorated)} visible addable items priced · armed picker handoff · ${formatInteger(count)} captured prices · ${freshness.ageLabel}`
        : `${formatInteger(priced)}/${formatInteger(decorated)} visible addable items priced · live counterparty verified · ${formatInteger(count)} captured prices · ${freshness.ageLabel}`
      : verification.status === 'waiting'
'''
replace_once(old_detail, new_detail, 'priced-trade verification detail')

path.write_text(text, encoding='utf-8')
print('Applied GOBLIN GOD v0.17.2 pre-trade picker handoff hotfix.')
