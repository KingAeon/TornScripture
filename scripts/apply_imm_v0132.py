from pathlib import Path

PATH = Path('TornScripture-Item-Market-Margin.user.js')
source = PATH.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)


def section(text: str, start: str, end: str) -> str:
    left = text.index(start)
    right = text.index(end, left)
    return text[left:right]


if '// @version      0.13.1' not in source:
    raise SystemExit('Expected v0.13.1 source')

quick_max_before = section(source, '  function quickMaxMaximum(', '  function clearOverseasPlanAnnotations(')
watch_listing_before = section(source, '  function validWatchListingRow(', '  function cardTrader(')

source = source.replace('0.13.1', '0.13.2')

source = replace_once(
    source,
    '      #${APP.ledgerOverlayId}{position:fixed;inset:0;z-index:2147483500;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f1f8}',
    '      #${APP.ledgerOverlayId}{position:fixed;inset:0;z-index:2147483647;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;font:12px/1.35 Arial,sans-serif;color:#f4f1f8;pointer-events:auto!important;isolation:isolate;overscroll-behavior:contain}',
    'ledger overlay layer',
)
source = replace_once(
    source,
    '      .tsimm-ledger-shell{width:min(620px,100%);max-height:94vh;display:flex;flex-direction:column;background:#1d1b22;border:1px solid #655d70;border-radius:12px;box-shadow:0 14px 44px #000d;overflow:hidden}',
    '      .tsimm-ledger-shell{position:relative;z-index:1;width:min(620px,100%);max-height:94vh;max-height:94dvh;display:flex;flex-direction:column;background:#1d1b22;border:1px solid #655d70;border-radius:12px;box-shadow:0 14px 44px #000d;overflow:hidden;pointer-events:auto!important}\n      .tsimm-ledger-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;pointer-events:auto!important}\n      #${APP.ledgerOverlayId} button,#${APP.ledgerOverlayId} input,#${APP.ledgerOverlayId} select,#${APP.ledgerOverlayId} textarea{pointer-events:auto!important;touch-action:manipulation}',
    'ledger shell scroll layer',
)
source = replace_once(
    source,
    '      #${APP.ledgerOverlayId} .tsimm-key-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}',
    '      #${APP.ledgerOverlayId} .tsimm-key-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}\n      #${APP.ledgerOverlayId} .tsimm-key-actions button{flex:1;min-width:120px;border:1px solid #3b8fc2;border-radius:6px;background:#173d56;color:#eaf7ff;padding:7px;font-size:9px;font-weight:800}',
    'key action buttons',
)

render_start = source.index('  function renderLedger()')
render_end = source.index('  function openLedger()', render_start)
render_block = source[render_start:render_end]
render_block = replace_once(
    render_block,
    '        </div>\n        <div class="tsimm-ledger-summary">',
    '        </div>\n        <div class="tsimm-ledger-scroll">\n          <div class="tsimm-ledger-summary">',
    'ledger scroll opening',
)
render_block = replace_once(
    render_block,
    '          `}\n      </div>\n    `;',
    '          `}\n        </div>\n      </div>\n    `;',
    'ledger scroll closing',
)
source = source[:render_start] + render_block + source[render_end:]

open_start = source.index('  function openLedger()')
open_end = source.index('  function closeLedger()', open_start)
open_block = source[open_start:open_end]
open_block = replace_once(
    open_block,
    '      document.body.appendChild(overlay);',
    '      (document.documentElement || document.body).appendChild(overlay);\n      overlay.setAttribute(\'role\', \'dialog\');\n      overlay.setAttribute(\'aria-modal\', \'true\');',
    'ledger root mounting',
)
source = source[:open_start] + open_block + source[open_end:]

bind_start = source.index('  function bindPanelEvents()')
bind_end = source.index('  function toast(', bind_start)
bind_block = source[bind_start:bind_end]
bind_block = replace_once(
    bind_block,
    '      if (!button) return;\n      const action = button.dataset.tsimmAction;',
    '      if (!button) return;\n      event.preventDefault();\n      event.stopPropagation();\n      const action = button.dataset.tsimmAction;',
    'action touch isolation',
)
bind_block = replace_once(
    bind_block,
    '    });\n    document.addEventListener(\'change\', (event) => {',
    '    }, true);\n    document.addEventListener(\'change\', (event) => {',
    'captured action listener',
)
source = source[:bind_start] + bind_block + source[bind_end:]

quick_max_after = section(source, '  function quickMaxMaximum(', '  function clearOverseasPlanAnnotations(')
watch_listing_after = section(source, '  function validWatchListingRow(', '  function cardTrader(')
if quick_max_after != quick_max_before:
    raise SystemExit('Protected Quick MAX section changed')
if watch_listing_after != watch_listing_before:
    raise SystemExit('Protected listing/watch section changed')

required = [
    '// @version      0.13.2',
    "version: '0.13.2'",
    'class="tsimm-ledger-scroll"',
    'z-index:2147483647',
    '(document.documentElement || document.body).appendChild(overlay);',
    'function quickMaxMaximum',
    'function validWatchListingRow',
]
for marker in required:
    if marker not in source:
        raise SystemExit(f'Missing marker: {marker}')
if '@require' in source:
    raise SystemExit('Unexpected @require')

PATH.write_text(source, encoding='utf-8')
print('Applied GOBLIN GOD v0.13.2 mobile ledger interaction patch')
