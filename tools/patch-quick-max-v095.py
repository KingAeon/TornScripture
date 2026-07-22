from pathlib import Path

PATH = Path("TornScripture-Item-Market-Margin.user.js")
text = PATH.read_text(encoding="utf-8")

old = r"/\b(?:available|stock|quantity|qty)\D{0,18}([\d,]+)/i,"
new = r"/\b(?:available|stock)\D{0,18}([\d,]+)/i,"

if old in text:
    if text.count(old) != 1:
        raise SystemExit(f"Quick MAX stock parser: expected 1 match, found {text.count(old)}")
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit("Quick MAX stock parser anchor not found")

required = [
    "// @version      0.9.5",
    "function runQuickMax",
    "data-tsimm-quick-max-override",
    "quickMaxOverrideArmed: false",
    "Override MAX submitted",
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f"Missing Quick MAX markers: {missing}")

PATH.write_text(text, encoding="utf-8")
print("Tightened Quick MAX stock parser.")
