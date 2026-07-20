from pathlib import Path

TARGET = Path("TornScripture-IMM-Trader-Extensions.user.js")
text = TARGET.read_text(encoding="utf-8")

replacements = [
    ("// @version      0.1.7", "// @version      0.1.8"),
    ("v: '0.1.7',", "v: '0.1.8',"),
    (
        ".tsimm-listing-mark{position:relative!important}.tsimm-track-profit{",
        ".tsimm-track-format-row{position:relative!important}.tsimm-track-caption-anchor{position:relative!important}.tsimm-track-profit{",
    ),
    (
        "document.querySelectorAll('.tsimm-tracked-buy-row,.tsimm-track-profitable,.tsimm-track-floor-row').forEach((row) => {\n      row.classList.remove('tsimm-tracked-buy-row', 'tsimm-track-profitable', 'tsimm-track-floor-row');",
        "document.querySelectorAll('.tsimm-tracked-buy-row,.tsimm-track-profitable,.tsimm-track-floor-row,.tsimm-track-format-row').forEach((row) => {\n      row.classList.remove('tsimm-tracked-buy-row', 'tsimm-track-profitable', 'tsimm-track-floor-row', 'tsimm-track-format-row');",
    ),
    (
        "    document.getElementById(A.caption)?.remove();\n    document.querySelectorAll('.tsimm-tracked-buy-row",
        "    const caption = document.getElementById(A.caption);\n    const captionAnchor = caption?.parentElement;\n    caption?.remove();\n    if (captionAnchor?.dataset?.tsimmTrackCaptionAnchor === '1') {\n      captionAnchor.classList.remove('tsimm-track-caption-anchor');\n      delete captionAnchor.dataset.tsimmTrackCaptionAnchor;\n    }\n    document.querySelectorAll('[data-tsimm-track-caption-anchor=\"1\"]').forEach((anchor) => {\n      anchor.classList.remove('tsimm-track-caption-anchor');\n      delete anchor.dataset.tsimmTrackCaptionAnchor;\n    });\n    document.querySelectorAll('.tsimm-tracked-buy-row",
    ),
    (
        "    anchor.style.position = 'relative';\n    if (caption.parentElement !== anchor) anchor.appendChild(caption);",
        "    document.querySelectorAll('[data-tsimm-track-caption-anchor=\"1\"]').forEach((previous) => {\n      if (previous === anchor) return;\n      previous.classList.remove('tsimm-track-caption-anchor');\n      delete previous.dataset.tsimmTrackCaptionAnchor;\n    });\n    anchor.classList.add('tsimm-track-caption-anchor');\n    anchor.dataset.tsimmTrackCaptionAnchor = '1';\n    if (caption.parentElement !== anchor) anchor.appendChild(caption);",
    ),
    (
        "    caption.classList.add('stacked');\n    caption.removeAttribute('style');\n    anchor.insertAdjacentElement('afterend', caption);",
        "    caption.classList.add('stacked');\n    caption.removeAttribute('style');\n    anchor.classList.remove('tsimm-track-caption-anchor');\n    delete anchor.dataset.tsimmTrackCaptionAnchor;\n    anchor.insertAdjacentElement('afterend', caption);",
    ),
    (
        "    row.appendChild(marker);\n    row.classList.add('tsimm-track-profitable');",
        "    row.appendChild(marker);\n    row.classList.add('tsimm-track-format-row', 'tsimm-track-profitable');",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match, found {count}: {old[:90]!r}")
    text = text.replace(old, new, 1)

TARGET.write_text(text, encoding="utf-8")
