from pathlib import Path

TARGET = Path("TornScripture-IMM-Trader-Extensions.user.js")
text = TARGET.read_text(encoding="utf-8")

text = text.replace("// @version      0.1.8", "// @version      0.1.9", 1)
text = text.replace("v: '0.1.8',", "v: '0.1.9',", 1)

old_start = """  function injectStyle() {
    if (document.getElementById(A.style) || !document.head) return;
    const style = document.createElement('style');
    style.id = A.style;
    style.textContent = `
"""
new_start = """  function injectStyle() {
    if (!document.head) return;
    let style = document.getElementById(A.style);
    if (!style) {
      style = document.createElement('style');
      style.id = A.style;
      document.head.appendChild(style);
    }
    style.textContent = `
"""
if old_start not in text:
    raise SystemExit("injectStyle start not found")
text = text.replace(old_start, new_start, 1)

old_end = """    `;
    document.head.appendChild(style);
  }

  function tradersRaw() {
"""
new_end = """    `;
  }

  function tradersRaw() {
"""
if old_end not in text:
    raise SystemExit("injectStyle end not found")
text = text.replace(old_end, new_end, 1)

TARGET.write_text(text, encoding="utf-8")
