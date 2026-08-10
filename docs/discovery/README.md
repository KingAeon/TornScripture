# TornScriptures Age of Discovery

## Purpose

The Age of Discovery is a deliberate research phase for mapping what Torn already exposes before TornScriptures invents a new capture path, parser, workaround, or dependency.

The goal is not to redesign TornScriptures during discovery. The goal is to understand the platform well enough that later architecture can choose the most authoritative, least privileged, least fragile, and least wasteful source for each job.

Discovery may take as long as necessary. A capability being discovered does **not** authorize a product change.

## Canonical records

- [`TORN-CAPABILITY-REGISTRY.md`](TORN-CAPABILITY-REGISTRY.md) records durable capability facts and source-fit assessments.
- [`DISCOVERY-LOG.md`](DISCOVERY-LOG.md) records what was investigated, when it was investigated, and what changed in our understanding.
- [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) records unknowns that still require documentation review, live observation, or controlled testing.

## Evidence classes

Every important claim should be classified by the strongest evidence supporting it.

### Official

Documented by Torn in the current official API documentation or OpenAPI specification.

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

When sources disagree or overlap, later architecture should begin with this evidence order and then account for freshness and permissions:

1. Current official Torn OpenAPI contract and API documentation.
2. Controlled live response from the documented Torn interface.
3. Torn page/application information observed by the user on an opened page.
4. Documented third-party service contract and controlled live response.
5. Inference from undocumented implementation details.

A lower-ranked source can still be the correct runtime choice when it is materially fresher, requires less privilege, or contains information that a higher-ranked source does not expose. The registry records those tradeoffs rather than assuming `API = better`.

## Source-fit dimensions

Each capability should eventually record:

- authority and evidence class
- exact endpoint, selection, or page surface
- API access level and custom-key implications
- API stability marker
- service/global cache behavior and practical freshness
- request and pagination cost
- schema completeness
- user-data and key-handling implications
- current TornScriptures consumer, if any
- current alternative source, if any
- known failure behavior
- last verification date
- live-verification status
- possible replacement or consolidation relevance, without authorizing it

## Discovery baseline

Initial research snapshot: **2026-08-10**

- Repository baseline: `main` at `a5dea932df186b8d5d2e2805e4eef837f6edf0f7`
- IMM stable version: `0.19.33`
- Torn API v2 OpenAPI version observed: `6.6.1`
- Official API base: `https://api.torn.com/v2`
- Official references:
  - `https://www.torn.com/api.html`
  - `https://www.torn.com/swagger/openapi.json`
  - `https://www.torn.com/swagger.php`

The Torn v2 specification is actively developed. Every capability therefore carries a last-verified date rather than being treated as permanent truth.

## Discovery rule before implementation

Before a new Torn data source becomes architecture, establish at minimum:

1. the exact current official contract when one exists
2. required access level or custom selection
3. cache/freshness behavior
4. ownership and identity semantics
5. expected success and error shape
6. a controlled live sample when the data will affect persistent accounting or other high-risk behavior
7. what the source does **not** prove
8. why it is preferable to existing official, page-state, or local sources

This rule exists to prevent TornScriptures from spending code and maintenance effort recreating data Torn already exposes, and also to prevent a documented-but-unsuitable API from replacing a better live source merely because it looks cleaner.
