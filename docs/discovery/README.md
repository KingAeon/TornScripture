# TornScriptures Age of Discovery

## Purpose

The Age of Discovery is a deliberate research phase for mapping what Torn already exposes before TornScriptures invents a new capture path, parser, workaround, or dependency.

The goal is not to redesign TornScriptures during discovery. The goal is to understand the platform well enough that later architecture can choose the most authoritative, least privileged, least fragile, and least wasteful source for each job.

Discovery may take as long as necessary. A capability being discovered does **not** authorize a product change.

## Canonical records

- [`CURRENT-STATUS.md`](CURRENT-STATUS.md) is the first-stop current-state index. It records the newest project baseline, which historical questions have since been answered or reclassified, and the recommended next Discovery frontier.
- [`RECONCILIATION-2026-08-20.md`](RECONCILIATION-2026-08-20.md) records the synchronization with released IMM v0.19.36 and explains which older statements remain historical rather than current.
- [`TORN-CAPABILITY-REGISTRY.md`](TORN-CAPABILITY-REGISTRY.md) records durable Torn API/game capability facts and source-fit assessments.
- [`TORN-PDA-CAPABILITY-REGISTRY.md`](TORN-PDA-CAPABILITY-REGISTRY.md) records TornPDA runtime/platform capabilities that may affect storage, portability, networking, injection, or userscript design.
- [`DISCOVERY-LOG.md`](DISCOVERY-LOG.md) records what was investigated, when it was investigated, and what changed in our understanding.
- [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) records unknowns that still require documentation review, live observation, or controlled testing. Its historical question text should be read together with `CURRENT-STATUS.md` when later implementation has supplied newer evidence.

Historical records are preserved as evidence. They are not silently rewritten merely because later work changed the current state.

## Evidence classes

Every important claim should be classified by the strongest evidence supporting it.

### Official Torn

Documented by Torn in the current official API documentation or OpenAPI specification.

### Platform documented

Documented by the maintained runtime/platform used by TornScriptures, such as TornPDA, and where practical cross-checked against that platform's current source implementation.

### Observed

Verified by TornScriptures through a controlled live Torn or TornPDA observation. Observed behavior should record the date, environment, and relevant setup.

### Inferred / unstable

Derived from page structure, browser application state, undocumented payloads, or another behavior Torn has not documented as a stable interface. These sources may still be useful, but later architecture must treat them as more fragile.

### External

Provided by a third-party service such as a trader-price provider. External capabilities require their own provenance, freshness, failure, privacy, and terms assessment.

## Capability states

- **Catalogued:** known to exist, but not yet deeply assessed.
- **Assessed:** contract, permission, stability, freshness, and limitations have been reviewed.
- **Live-verified:** expected behavior has also been observed in Torn/TornPDA.
- **Unavailable / rejected:** investigated and determined not to provide the required data or not to be suitable for the intended use.
- **Needs recheck:** previously assessed information may have changed.

`DISCOVERED ONLY` is an architecture guard. It means the finding is recorded but does not authorize replacing current code or creating a feature.

## Source hierarchy

When sources disagree or overlap, later architecture should begin with evidence appropriate to the surface being investigated and then account for freshness, permissions and runtime constraints:

1. Current official Torn contract/documentation for Torn capabilities, or maintained platform documentation/source for runtime capabilities such as TornPDA.
2. Controlled live response or behavior from the documented interface.
3. Torn page/application information observed by the user on an opened page.
4. Documented third-party service contract and controlled live response.
5. Inference from undocumented implementation details.

A lower-ranked source can still be the correct runtime choice when it is materially fresher, requires less privilege, or contains information that a higher-ranked source does not expose. The registries record those tradeoffs rather than assuming `API = better` or `native = better`.

## Source-fit dimensions

Each capability should eventually record the dimensions relevant to its surface, including:

- authority and evidence class
- exact endpoint, selection, platform API, or page surface
- permission/access implications
- documented stability or lifecycle guarantees
- cache/freshness behavior
- request, bridge, pagination or storage cost
- schema/data completeness
- user-data and key-handling implications
- current TornScriptures consumer, if any
- current alternative source, if any
- known failure behavior and destructive lifecycle events
- portability across TornPDA, Tampermonkey and Violentmonkey where relevant
- last verification date
- live-verification status
- possible replacement or consolidation relevance, without authorizing it

## Discovery baseline

Initial research snapshot: **2026-08-10**

- Repository baseline: `main` at `a5dea932df186b8d5d2e2805e4eef837f6edf0f7`
- IMM stable version: `0.19.33`
- Torn API v2 OpenAPI version observed: `6.6.1`
- Official API base: `https://api.torn.com/v2`
- TornPDA baseline additionally reviewed: `3.15.0+673`
- Official Torn references:
  - `https://www.torn.com/api.html`
  - `https://www.torn.com/swagger/openapi.json`
  - `https://www.torn.com/swagger.php`
- TornPDA platform references are recorded in `TORN-PDA-CAPABILITY-REGISTRY.md`.

Current reconciled project baseline as of **2026-08-20**:

- Stable `main`: `25fe4936b87697427cfaa1db99fffa907ba07126`
- Stable IMM: `0.19.36`
- API-backed Black Ledger completed-trade recovery: released through PR #107
- TornPDA native-storage qualification: closed for the current Discovery cycle
- Current recommended Discovery frontier: minimum permission and source-ownership matrix, beginning with DQ-KEY-001

The Torn v2 specification and supported userscript platforms can evolve. Every capability therefore carries a last-verified date rather than being treated as permanent truth.

## Discovery rule before implementation

Before a new data source, runtime capability or persistence mechanism becomes architecture, establish at minimum:

1. the exact current documented contract when one exists
2. required permissions, platform and availability
3. cache/freshness or persistence/lifecycle behavior
4. ownership, identity and namespace semantics
5. expected success and error behavior
6. a controlled live sample when the capability will affect persistent accounting or other high-risk behavior
7. what the capability does **not** prove or preserve
8. portability and failure behavior where relevant
9. why it is preferable to existing official, page-state, browser, platform-native or local sources

This rule exists to prevent TornScriptures from spending code and maintenance effort recreating capabilities Torn or its supported runtimes already expose, and also to prevent a documented-but-unsuitable capability from replacing a better source merely because it looks cleaner.
