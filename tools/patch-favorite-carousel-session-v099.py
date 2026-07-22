from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "TornScripture-Item-Market-Margin.user.js"
WORKFLOW = ROOT / ".github/workflows/favorite-carousel-session-v099.yml"
SELF = Path(__file__).resolve()

text = SCRIPT.read_text(encoding="utf-8")

if "// @version      0.9.8" not in text:
    raise SystemExit("Expected IMM v0.9.8 before applying favorite carousel session fix")

anchor = """  const write = (storageKey, value) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
"""

helpers = anchor + """  const loadSessionJson = (storageKey, fallback) => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return fallback === undefined ? undefined : clone(fallback);
      return JSON.parse(raw);
    } catch {
      return fallback === undefined ? undefined : clone(fallback);
    }
  };
  const saveSessionJson = (storageKey, value) => {
    try {
      if (value === null || value === undefined) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
"""

if "const loadSessionJson = (storageKey, fallback)" not in text:
    if anchor not in text:
        raise SystemExit("Could not find watchlist storage helper insertion point")
    text = text.replace(anchor, helpers, 1)

text = text.replace("0.9.8", "0.9.9")

required = (
    "// @version      0.9.9",
    "const loadSessionJson = (storageKey, fallback)",
    "const saveSessionJson = (storageKey, value)",
    "function renderFavoriteCaptureCarousel",
    "function startFavoriteCaptureCarousel",
)
for marker in required:
    if marker not in text:
        raise SystemExit(f"Missing required marker after patch: {marker}")

SCRIPT.write_text(text, encoding="utf-8")

for temporary in (WORKFLOW, SELF):
    if temporary.exists():
        temporary.unlink()
