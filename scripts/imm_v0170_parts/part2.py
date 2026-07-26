        tradeUrl: normalizeHttpUrl(raw.tradeUrl),
      };
    } catch {
      return null;
    }
  }

  function savePricedTradeSession(session) {
    try {
      if (!session) sessionStorage.removeItem(PRICED_TRADE_SESSION_KEY);
      else sessionStorage.setItem(PRICED_TRADE_SESSION_KEY, JSON.stringify(session));
      return true;
    } catch {
      return false;
    }
  }

  function clearPricedTradeSession(message = '') {
    savePricedTradeSession(null);
    clearPricedTradeAnnotations();
    if (message) toast(message);
  }

  function pricedTradeArmedTrader(session = loadPricedTradeSession()) {
    if (!session) return null;
    const wantedName = normalizeName(session.traderName);
    return state.traders.find((trader) =>
      (session.traderId && trader.id === session.traderId)
      || (session.userId && Number(trader.userId) === Number(session.userId))
      || (wantedName && trader.normalizedName === wantedName)
    ) || null;
  }

  function startPricedTrade(trader) {
    if (!trader?.tradeUrl) {
      toast('This trader does not have a saved trade link.');
      return false;
    }
    const priceCount = Array.isArray(trader.pricePageItems) ? trader.pricePageItems.length : 0;
    if (!priceCount) {
      toast(`${trader.name} has no captured prices yet.`);
      return false;
    }
    const session = {
      traderId: trader.id,
      traderName: trader.name,
      userId: Number(trader.userId) > 0 ? Number(trader.userId) : null,
      armedAt: Date.now(),
      expiresAt: Date.now() + PRICED_TRADE_TTL_MS,
      tradeUrl: trader.tradeUrl,
    };
    if (!savePricedTradeSession(session)) {
      toast('Priced Trade could not save its handoff in this tab.');
      return false;
    }
    closeTraders();
    toast(`Priced Trade armed for ${trader.name}: ${formatInteger(priceCount)} captured prices.`);
    setTimeout(() => location.assign(trader.tradeUrl), 120);
    return true;
  }

  function pricedTradeVerification(stats) {
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

  function injectPricedTradeStyles() {
    if (!document.head || document.getElementById(PRICED_TRADE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = PRICED_TRADE_STYLE_ID;
    style.textContent = `
      #${PRICED_TRADE_PANEL_ID}{position:fixed;left:50%;top:max(64px,calc(env(safe-area-inset-top) + 54px));z-index:2147483040;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center;width:min(560px,calc(100vw - 18px));padding:8px 10px;transform:translateX(-50%);border:1px solid #57d972;border-radius:9px;background:#07180cf5;color:#d6ffcd;box-shadow:0 10px 30px #000b;font:800 10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      #${PRICED_TRADE_PANEL_ID}.waiting{border-color:#4f9bc5;background:#071723f5;color:#c9ecff}#${PRICED_TRADE_PANEL_ID}.mismatch,#${PRICED_TRADE_PANEL_ID}.missing-trader{border-color:#cf5866;background:#250a0df5;color:#ffc2c8}
      #${PRICED_TRADE_PANEL_ID} strong,#${PRICED_TRADE_PANEL_ID} span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${PRICED_TRADE_PANEL_ID} span{grid-column:1;color:#8fbd96;font-size:8px}#${PRICED_TRADE_PANEL_ID}.waiting span{color:#82b6d4}#${PRICED_TRADE_PANEL_ID}.mismatch span,#${PRICED_TRADE_PANEL_ID}.missing-trader span{color:#d89198}
      #${PRICED_TRADE_PANEL_ID} button{grid-row:1/3;grid-column:2;border:1px solid #75616a;border-radius:6px;background:#2a1c21;color:#ffd9df;padding:6px 8px;font:800 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      .${PRICED_TRADE_ROW_CLASS}{position:relative!important;box-shadow:inset 3px 0 #47c968!important}.${PRICED_TRADE_ROW_CLASS}.stale{box-shadow:inset 3px 0 #c59a39!important}.${PRICED_TRADE_ROW_CLASS}.outdated{box-shadow:inset 3px 0 #b65466!important}.${PRICED_TRADE_ROW_CLASS}.missing{box-shadow:inset 3px 0 #66717a!important}
