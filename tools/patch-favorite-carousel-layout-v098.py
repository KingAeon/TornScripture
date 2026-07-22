from pathlib import Path

path = Path("TornScripture-Item-Market-Margin.user.js")
text = path.read_text(encoding="utf-8")
old = "#${A.carousel}{display:grid;grid-template-columns:minmax(0,1fr) auto;"
new = "#${A.carousel}{display:grid;grid-column:1/-1;width:auto;grid-template-columns:minmax(0,1fr) auto;"
if new in text:
    print("Favorite carousel full-width layout already applied.")
elif text.count(old) == 1:
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("Applied favorite carousel full-width layout.")
else:
    raise SystemExit(f"carousel layout: expected 1 match, found {text.count(old)}")
