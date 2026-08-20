# TornScriptures Discovery Log

This is the chronological notebook for the Age of Discovery. It records what was investigated, what the evidence established, what remains uncertain, and what changed in our understanding.

The Capability Registry is the durable reference. This log preserves the path taken to reach it so future agents do not repeat old assumptions or dead ends.

## 2026-08-10 — Age of Discovery begins

### Scope

Begin a deliberate capability-first phase before further TornScriptures architecture work.

Primary question:

> Before TornScriptures writes or preserves a workaround, what official Torn API, key permission, page/application state, browser capability, or other legitimate source already provides the information?

This is research and documentation only. Discovery does not authorize runtime changes.

### Repository baseline

- Repository: `KingAeon/TornScripture`
- Base branch: `main`
- Base SHA: `a5dea932df186b8d5d2e2805e4eef837f6edf0f7`
- Stable IMM: `0.19.33`
- The immediately preceding v0.19.34 API-backed completed-trade recovery was reverted on `main`.

### Official Torn baseline

- API docs reviewed: `https://www.torn.com/api.html`
- OpenAPI reviewed: `https://www.torn.com/swagger/openapi.json`
- OpenAPI version observed: `6.6.1`
- The OpenAPI itself states that v2 development is ongoing.

### Repository source map reviewed

Current API/data acquisition was inspected in:

- `TornScripture-Item-Market-Margin.user.js`
- `TornScripture-Inventory-Sales-HUD.user.js`
- `TornScripture-War-Intelligence-HUD.user.js`
- the reverted v0.19.34 completed-trade recovery diff
- project governance and roadmap documents

### Discovery 001 — The official OpenAPI can be our primary capability map

**Finding:** The official v2 OpenAPI is machine-readable and records endpoint contracts, parameters, access requirements, response schemas and Torn's Stable/Unstable marker.

**Consequence for discovery:** Do not rely on memory or forum folklore to define a capability when the current official contract can answer it.

**Architecture action:** None.

### Discovery 002 — Torn exposes self-describing lookup endpoints

**Finding:** Major API sections expose stable public `lookup` endpoints that enumerate available selections.

**Why important:** A future registry-maintenance process can compare Torn's current selection surface with our recorded snapshot instead of hardcoding discovery forever.

**Architecture action:** None.

### Discovery 003 — Key introspection is richer than TornScriptures currently uses

**Finding:** `/key/info` can identify the key owner, access details and exact granted selections. `/key/log` exposes recent request history.

**Current project:** IMM already probes `/key/info` during its key check.

**Why important:** Least-privilege setup and request auditing may be possible using Torn-provided data rather than a custom remote service.

**Unresolved:** Whether TornScriptures should ever surface `/key/log` information to the user and what privacy tradeoffs that creates.

### Discovery 004 — Permission cost belongs beside code/request efficiency

**Finding:** `/user/log` is powerful but requires Full access. Custom log permissions can narrow categories/types, but that does not make log access a free replacement for a Public/Limited endpoint.

**New project rule:** A source is not "efficient" merely because it eliminates parsing. Permission burden, privacy and trust are part of efficiency.

### Discovery 005 — User inventory is structured but deliberately stale

**Finding:** `/user/inventory` is Stable/Limited and explicitly cached for one hour per category.

**Current project:** IMM and ISH already use this endpoint.

**Important consequence:** Inventory API data can be an excellent planning or reconciliation snapshot but cannot be assumed to prove an immediate post-transaction state.

**Architecture action:** None. Existing use is unchanged.

### Discovery 006 — Finished trades have a precise current v2 contract

**Finding:** `/user/trades?cat=finished` and `/user/{tradeId}/trade` are Stable/Limited. The detailed schema attributes each exchanged asset entry to a `user_id` and represents Money, Item and other trade asset types through a documented union.

**Historical comparison:** The reverted v0.19.34 recovery code normalized multiple guessed/nested shapes before a controlled live response had been captured and frozen as evidence.

**Lesson:** The API route itself is not thereby rejected. The project moved into implementation before the exact current contract and live behavior were sufficiently recorded.

**New gate:** Any renewed Black Ledger API recovery must begin from the current documented schema and a controlled live low-value finished-trade response before ledger mutation is specified.

### Discovery 007 — Public Item Market API has explicit cache provenance

**Finding:** `/market/{id}/itemmarket` is Stable/Public and globally cached. The response includes cache provenance fields.

**Why important:** This could be useful for reproducible market-history snapshots.

**Why not automatically better:** A globally cached API may be less fresh than the market page the player is actively viewing.

**Architecture action:** None.

### Discovery 008 — Torn has a public Bazaar directory

**Finding:** Stable/Public Market endpoints expose Bazaar directories, including weekly groupings and item-specialized directories. Directory entries identify owners and whether the Bazaar is open.

**Why important:** This capability was discovered before TornScriptures had designed a feature around it. It validates the purpose of a capability-first phase.

**Clarification:** This public directory is not the same capability as reading the API-key owner's own Bazaar contents.

**Architecture action:** None.

### Discovery 009 — War Intelligence overlaps a Stable/Public structured source

**Finding:** `/faction/{id}/members` returns structured faction members including `last_action` and current `status`. It requires only Public access and is Stable in the current OpenAPI.

**Current project:** WIH intentionally makes no API calls. It reads rendered faction pages and stores observations locally.

**Significance:** Several signals WIH currently extracts from rendered pages are also available in a structured faction-wide response.

**What this does not prove:**

- that the API is fresh enough for war intelligence
- that API polling fits the intended product boundary
- that TornPDA behavior would be better
- that historical observations should be sourced differently
- that the page observer is obsolete

**Next evidence needed:** Controlled freshness/cadence/source comparison before any architecture discussion.

### Discovery 010 — Torn item catalog supports both broad and targeted lookup

**Finding:** `/torn/items` and `/torn/{ids}/items` are Stable/Public. The broad catalog includes base item/value data; specific-ID lookup populates equipment details when available.

**Current project:** IMM uses broad catalog synchronization. ISH uses targeted batches.

**Open efficiency question:** Which pattern is preferable per future domain depends on actual item count, refresh cadence, cache/storage behavior and whether full-catalog analysis is needed.

**Architecture action:** None.

### Discovery 011 — Existing browser cache flags do not define Torn API freshness

**Finding:** IMM/ISH use browser fetch controls such as `cache: 'no-store'`. Torn separately documents server-side caching, the API `timestamp` cache-bypass parameter and global caches.

**Lesson:** Future reviews must distinguish browser cache behavior from Torn service/global cache behavior.

**Architecture action:** None.

## Initial project doctrine established by this batch

The following principles are now the working research rules:

1. Exact contract before implementation.
2. Official availability does not automatically mean runtime suitability.
3. Freshness is separate from authority.
4. Permission cost is separate from request cost and code complexity.
5. Controlled live evidence is required before an accounting-critical source mutates persistent data.
6. A discovered capability is recorded before deciding whether existing code should change.
7. Negative findings and unknowns are durable project knowledge, not disposable chat context.

## Files created in this batch

- `docs/discovery/README.md`
- `docs/discovery/TORN-CAPABILITY-REGISTRY.md`
- `docs/discovery/DISCOVERY-LOG.md`
- `docs/discovery/OPEN-QUESTIONS.md` (companion queue)

No product/userscript behavior is changed by the Age of Discovery documentation.
