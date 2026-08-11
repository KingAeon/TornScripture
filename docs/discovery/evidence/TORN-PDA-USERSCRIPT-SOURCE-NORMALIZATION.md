# TornPDA userscript source normalization hazard

Status: **DISCOVERED / live-triggered during qualification probe bootstrap**

Date: 2026-08-10

## Finding

Current TornPDA `UserScriptsProvider.adaptSource()` rewrites literal smart double quotes (`U+201C`, `U+201D`) to ASCII `"` and literal smart apostrophes (`U+2018`, `U+2019`) to ASCII `'` across the complete userscript source immediately before injection.

The storage qualification probe v0.1.0 contained a valid JavaScript single-quoted Unicode test string with literal smart quote/apostrophe characters. The raw source passed ordinary syntax validation, but TornPDA's source normalization converted the embedded smart apostrophes to ASCII single quotes, which terminated the JavaScript string and produced invalid injected source before the probe could render its UI.

Observed owner symptom: the qualification userscript was installed and enabled in TornPDA, but no qualification panel appeared on matching Torn pages.

## Resolution

Probe v0.1.1 removes literal smart quote/apostrophe characters from executable source. Unicode test characters are generated at runtime with `String.fromCodePoint(...)` instead. A visible bootstrap-error fallback was also added.

Before commit, v0.1.1 was syntax-checked twice:

1. as raw repository source;
2. after applying the same smart quote/apostrophe replacement performed by TornPDA.

Both forms parsed successfully.

## TornScriptures implication

This normalization is a platform-specific source transformation and can invalidate otherwise correct JavaScript when smart punctuation appears inside string literals, template literals, regular expressions, comments that interact with adjacent syntax, or generated code.

Future TornScriptures/TornPDA compatibility checks should validate the **post-TornPDA-normalization source**, not only the repository source. Avoid literal smart quote/apostrophe characters in executable userscript source when practical.

Architecture action: none. Compatibility rule only. **DISCOVERED ONLY.**
