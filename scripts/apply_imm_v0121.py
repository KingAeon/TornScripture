from pathlib import Path

path = Path('TornScripture-Item-Market-Margin.user.js')
text = path.read_text(encoding='utf-8')
original = text

if text.count('0.12.0') < 4:
    raise SystemExit('Expected IMM v0.12.0 version anchors')
text = text.replace('0.12.0', '0.12.1')

old_cancel = """  function cancelFavoriteCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    saveSessionJson(A.carouselSession, null);
    scheduleTorn();
    showFavoriteToast(queue ? `${captureQueueLabel(queue)} cancelled` : 'No trader capture queue is active');
  }"""
new_cancel = """  function cancelFavoriteCaptureCarousel() {
    const queue = activeFavoriteCaptureCarousel();
    saveFavoriteCaptureCarousel(null);
    showFavoriteToast(queue ? `${captureQueueLabel(queue)} cancelled` : 'No trader capture queue is active');
  }"""
if text.count(old_cancel) != 1:
    raise SystemExit(f'Cancel anchor count: {text.count(old_cancel)}')
text = text.replace(old_cancel, new_cancel, 1)

text = text.replace(
    "showFavoriteToast('No favorite capture carousel is ready');",
    "showFavoriteToast('No trader capture queue is ready');",
    1,
)
text = text.replace(
    "showFavoriteToast(`Favorite carousel already active: ${existing.cursor + 1}/${existing.entries.length}`);",
    "showFavoriteToast(`${captureQueueLabel(existing)} already active: ${existing.cursor + 1}/${existing.entries.length}`);",
    1,
)

for marker in [
    '@version      0.12.1',
    "brandName: 'GOBLIN GOD'",
    'saveFavoriteCaptureCarousel(null);',
    'PRICE CHECK TRADERS',
]:
    if marker not in text:
        raise SystemExit(f'Missing marker: {marker}')
if '@require' in text:
    raise SystemExit('Userscript must remain self-contained')
if len(text) < 200_000:
    raise SystemExit('Userscript unexpectedly truncated')

path.write_text(text, encoding='utf-8')
print(f'Patched {len(original)} -> {len(text)} bytes')
