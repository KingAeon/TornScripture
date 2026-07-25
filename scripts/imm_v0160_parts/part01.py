from pathlib import Path

PATH = Path('TornScripture-Item-Market-Margin.user.js')
text = PATH.read_text(encoding='utf-8')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return source.replace(old, new, 1)


if '@version      0.16.0' in text:
    raise SystemExit('GOBLIN GOD v0.16.0 already applied')
if '@version      0.15.0' not in text:
    raise SystemExit('Expected GOBLIN GOD v0.15.0 baseline')

text = text.replace('0.15.0', '0.16.0')
text = replace_once(
    text,
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated high-turnover watchlists, trader capture, Trade Exit Audit, purchase history, trade verification, and receipt audits.',
    '// @description  Item-market and overseas profit overlays with Quick MAX, curated watchlists, local market-velocity learning, trader capture, Trade Exit Audit, purchase history, and receipt audits.',
    'userscript description',
)

text = replace_once(
    text,
    "    turnoverPanel: 'tsimm-turnover-preset-panel',\n    carouselSession: APP.favoriteRecaptureCarouselSessionKey,",
    "    turnoverPanel: 'tsimm-turnover-preset-panel',\n    turnoverHistory: 'tornscripture-imm-turnover-history-v1',\n    carouselSession: APP.favoriteRecaptureCarouselSessionKey,",
    'turnover storage key',
)

constants = r'''
  const TURNOVER_CAPTURE_RULES = Object.freeze({
    schemaVersion: 1,
    settleMs: 1200,
    changedMinimumGapMs: 15 * 1000,
    heartbeatMs: 5 * 60 * 1000,
    maximumPairGapMs: 30 * 60 * 1000,
    retentionMs: 14 * 24 * 60 * 60 * 1000,
    maxSnapshotsPerItem: 72,
    maxItems: 80,
    maxVisibleListings: 30,
  });
  const turnoverCaptureState = {
    itemToken: '',
    signature: '',
    stableSince: 0,
  };

'''
text = replace_once(
    text,
    "  const clone = (value) => JSON.parse(JSON.stringify(value));",
    constants + "  const clone = (value) => JSON.parse(JSON.stringify(value));",
    'turnover capture constants',
)

velocity_css = r'''
      #${A.turnoverPanel} .velocity-board{display:grid;gap:4px;padding-top:7px;border-top:1px solid #5d4a19}#${A.turnoverPanel} .velocity-board-head{display:flex;justify-content:space-between;gap:8px;color:#ffe8a3;font-size:9px}#${A.turnoverPanel} .velocity-board-head span{color:#ad985a;font-size:7px}#${A.turnoverPanel} .velocity-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;padding:5px 6px;border:1px solid #4f4527;border-radius:5px;background:#17140a}#${A.turnoverPanel} .velocity-row strong{overflow:hidden;color:#f4e5ac;font-size:8px;white-space:nowrap;text-overflow:ellipsis}#${A.turnoverPanel} .velocity-row b{color:#9fe8ff;font-size:8px}#${A.turnoverPanel} .velocity-row span{grid-column:1/-1;color:#958a62;font-size:7px}#${A.turnoverPanel} .velocity-empty{padding:6px;border:1px dashed #5d542f;border-radius:5px;color:#a89c70;font-size:8px;font-weight:700}
      #${A.panel} .tsimm-market-velocity{display:block!important;margin-top:1px!important;color:#8fcce0!important;font-size:7px!important;font-weight:900!important;letter-spacing:.01em!important}#${A.panel} .tsimm-market-velocity.learning{color:#a7afb4!important}#${A.panel} .tsimm-market-velocity.slow{color:#8fa4ad!important}#${A.panel} .tsimm-market-velocity.steady{color:#8edcf2!important}#${A.panel} .tsimm-market-velocity.fast{color:#95efaa!important}#${A.panel} .tsimm-market-velocity.frenzy{color:#ffe07b!important;text-shadow:0 0 8px #d6a72d55}
'''
text = replace_once(
    text,
    "      .tsimm-turnover-chip{display:inline-flex!important;align-items:center!important;margin-right:4px!important;padding:1px 4px!important;border:1px solid #b78c2d!important;border-radius:999px!important;background:#2a1f07!important;color:#ffe28a!important;font:900 7px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;vertical-align:1px!important;white-space:nowrap!important}\n      @media(max-width:430px){#${A.turnoverPanel} .turnover-actions{grid-template-columns:1fr}#${A.turnoverPanel} button.all{grid-column:auto}}",
    "      .tsimm-turnover-chip{display:inline-flex!important;align-items:center!important;margin-right:4px!important;padding:1px 4px!important;border:1px solid #b78c2d!important;border-radius:999px!important;background:#2a1f07!important;color:#ffe28a!important;font:900 7px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;vertical-align:1px!important;white-space:nowrap!important}\n" + velocity_css + "      @media(max-width:430px){#${A.turnoverPanel} .turnover-actions{grid-template-columns:1fr}#${A.turnoverPanel} button.all{grid-column:auto}}",
    'market velocity styles',
)

velocity_functions = r'''
  function turnoverTextHash(value) {
    let hash = 2166136261;
    const input = String(value || '');
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function turnoverHistoryStore() {
    const raw = read(A.turnoverHistory, {});
    const source = raw?.items && typeof raw.items === 'object' ? raw.items : {};
    const cutoff = Date.now() - TURNOVER_CAPTURE_RULES.retentionMs;
    const items = {};
    for (const [token, candidate] of Object.entries(source)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const itemId = Number(candidate.itemId) > 0 ? Number(candidate.itemId) : null;
      const itemName = clean(candidate.itemName);
      if (!itemName) continue;
      const snapshots = (Array.isArray(candidate.snapshots) ? candidate.snapshots : [])
        .map((snapshot) => {
          const at = Date.parse(snapshot?.at || '');
          if (!Number.isFinite(at) || at < cutoff) return null;
          const listings = (Array.isArray(snapshot?.listings) ? snapshot.listings : [])
            .map((listing) => ({
              key: clean(listing?.key),
              owner: clean(listing?.owner),
              price: Math.max(0, Math.round(Number(listing?.price) || 0)),
