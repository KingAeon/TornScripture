from pathlib import Path
import re
import subprocess
import sys

script_path = Path('tools/patch-trade-switch-gain-v0102.py')
userscript_path = Path('TornScripture-Item-Market-Margin.user.js')
source = script_path.read_text(encoding='utf-8')

for label in ('gain styling', 'close-enough card styling', 'close-enough badge styling'):
    pattern = re.compile(
        r"\nreplace_once\(\n(?:(?!\nreplace_once\().)*?\n\s*'" + re.escape(label) + r"',\n\)\n",
        re.S,
    )
    source, count = pattern.subn('\n', source, count=1)
    if count != 1:
        raise SystemExit(f'Could not remove staged CSS block: {label}')

script_path.write_text(source, encoding='utf-8')
subprocess.run([sys.executable, str(script_path)], check=True)

text = userscript_path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 stable style anchor, found {count}')
    text = text.replace(old, new, 1)


gain_css = (
    '      .tsimm-trade-exit-gain{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:3px 5px;border-radius:5px;background:#281b35;color:#e5c4ff;font-size:9px}'
    '.tsimm-trade-exit-gain strong{color:#f0c8ff}'
    '.tsimm-trade-exit-gain.ignored{background:#172820;color:#a9d9bc}'
    '.tsimm-trade-exit-gain.ignored strong{color:#b8ebca}\n'
)
replace_once(
    '      .tsimm-trade-exit-sell-here{',
    gain_css + '      .tsimm-trade-exit-sell-here{',
    'bulk gain styles',
)

replace_once(
    '      .tsimm-trade-exit-npc-better{',
    '      .tsimm-trade-exit-close-enough{border-color:#47785b}.tsimm-trade-exit-close-enough .tsimm-trade-exit-row-head strong{color:#91dbad}\n'
    '      .tsimm-trade-exit-npc-better{',
    'close-enough card styles',
)

replace_once(
    '.tsimm-trade-exit-badge-npc-better{',
    '.tsimm-trade-exit-badge-close-enough{border-color:#5ea879!important;color:#a7e6bd!important}'
    '.tsimm-trade-exit-badge-npc-better{',
    'close-enough badge styles',
)

userscript_path.write_text(text, encoding='utf-8')
print('Independent switch-gain styles applied.')
