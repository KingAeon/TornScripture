from pathlib import Path
import runpy

PATCHER = Path("tools/patch-tx-core-migration-v093.py")
text = PATCHER.read_text(encoding="utf-8")

old_early = '''core = replace_once(core, "        captureSource: 'weav3r-pricelist',", "        captureSource: `${provider}-pricelist`,", "early new-trader provider")'''
new_early = '''core = replace_once(
    core,
    "        bannerUrl: earlyClean(identity.bannerUrl),\\n        captureSource: 'weav3r-pricelist',\\n        pricePageItems: [],",
    "        bannerUrl: earlyClean(identity.bannerUrl),\\n        captureSource: `${provider}-pricelist`,\\n        pricePageItems: [],",
    "early new-trader provider",
)'''

old_import = '''core = replace_once(core, "        captureSource: 'weav3r-pricelist',", "        captureSource: `${provider}-pricelist`,", "import new-trader provider")'''
new_import = '''core = replace_once(
    core,
    "        bannerUrl: identity.bannerUrl,\\n        captureSource: 'weav3r-pricelist',\\n        createdAt: new Date().toISOString(),",
    "        bannerUrl: identity.bannerUrl,\\n        captureSource: `${provider}-pricelist`,\\n        createdAt: new Date().toISOString(),",
    "import new-trader provider",
)'''

for label, old, new in (
    ("early capture source guard", old_early, new_early),
    ("import capture source guard", old_import, new_import),
):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 patcher match, found {count}")
    text = text.replace(old, new, 1)

PATCHER.write_text(text, encoding="utf-8")
runpy.run_path(str(PATCHER), run_name="__main__")
