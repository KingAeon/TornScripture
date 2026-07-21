from pathlib import Path

HELPER = Path("tools/patch-tx-core-migration-v093.py")
source = HELPER.read_text(encoding="utf-8")

old = '''core = replace_once(core, "        captureSource: 'weav3r-pricelist',", "        captureSource: `${provider}-pricelist`,", "early new-trader provider")'''
new = '''core = core.replace("        captureSource: 'weav3r-pricelist',", "        captureSource: `${provider}-pricelist`,", 1)'''

if source.count(old) != 1:
    raise SystemExit(f"TX migration wrapper expected one early capture-source guard, found {source.count(old)}")

source = source.replace(old, new, 1)
exec(compile(source, str(HELPER), "exec"), {"__name__": "__main__", "__file__": str(HELPER)})
