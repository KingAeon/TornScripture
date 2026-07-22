from pathlib import Path

path = Path("TornScripture-Item-Market-Margin.user.js")
text = path.read_text(encoding="utf-8")
old = '''    if (parsed.quantity <= 0 || parsed.quantity > maximum) {
      throw new Error(`Torn confirmation quantity ${parsed.quantity} exceeded the armed MAX ${maximum}.`);
    }'''
new = '''    if (parsed.quantity <= 0 || parsed.quantity !== maximum) {
      throw new Error(`Torn confirmation quantity ${parsed.quantity} did not match the armed MAX ${maximum}.`);
    }'''
if new in text:
    print("Exact MAX confirmation guard already applied.")
elif text.count(old) == 1:
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("Applied exact MAX confirmation guard.")
else:
    raise SystemExit(f"exact MAX guard: expected 1 match, found {text.count(old)}")
