from pathlib import Path
import subprocess
import sys

script_path = Path('tools/patch-trade-switch-gain-v0102.py')
source = script_path.read_text(encoding='utf-8')

old = '''replace_once(
    "      .tsimm-trade-exit-route{font-size:10px}.tsimm-trade-exit-row small{color:#aaa1b7;font-size:8px;line-height:1.25}",
    "      .tsimm-trade-exit-route{font-size:10px}.tsimm-trade-exit-gain{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:3px 5px;border-radius:5px;background:#281b35;color:#e5c4ff;font-size:9px}.tsimm-trade-exit-gain strong{color:#f0c8ff}.tsimm-trade-exit-gain.ignored{background:#172820;color:#a9d9bc}.tsimm-trade-exit-gain.ignored strong{color:#b8ebca}.tsimm-trade-exit-row small{color:#aaa1b7;font-size:8px;line-height:1.25}",
    'gain styling',
)'''

new = '''replace_once(
    "      .tsimm-trade-exit-route{font-size:10px}",
    "      .tsimm-trade-exit-route{font-size:10px}.tsimm-trade-exit-gain{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:3px 5px;border-radius:5px;background:#281b35;color:#e5c4ff;font-size:9px}.tsimm-trade-exit-gain strong{color:#f0c8ff}.tsimm-trade-exit-gain.ignored{background:#172820;color:#a9d9bc}.tsimm-trade-exit-gain.ignored strong{color:#b8ebca}",
    'gain styling',
)'''

if old not in source:
    raise SystemExit('Could not locate the long gain-style anchor in the staged patch script.')

script_path.write_text(source.replace(old, new, 1), encoding='utf-8')
subprocess.run([sys.executable, str(script_path)], check=True)
