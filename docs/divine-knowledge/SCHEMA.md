# Divine Knowledge Schema

The subtree intentionally supports both human-readable Markdown and compact machine-oriented records.

## Pipe records

Compact state may use:

```text
NODE|EXT.QUOTE.ACTIONABLE
TYPE|DECISION
STATE|LOCKED
CLAIM|numeric_quote_alone_insufficient
REQ|buying_state+item_supported+conditions
CONF|OWNER_APPROVED
SRC|owner-decision:2026-08-26
```

Common keys:

- `NODE` — stable logical identifier.
- `TYPE` — DECISION, FACT, QUESTION, LESSON, IDEA, STATE, SOURCE, DEPENDENCY.
- `STATE` — ACTIVE, LOCKED, OPEN, DEFERRED, SUPERSEDED, ARCHIVED.
- `CLAIM` / `VALUE` — concise content.
- `REQ` — requirement or invariant.
- `REL` — relationship.
- `CONF` — confidence/evidence status.
- `SRC` — provenance.
- `SUPERSEDES` / `SUPERSEDED_BY` — lifecycle links.

## NDJSON records

Each line in `*.ndjson` is one independent JSON object. Prefer stable IDs and short values.

Recommended shape:

```json
{"id":"EXT.QUOTE.ACTIONABLE","type":"decision","state":"locked","claim":"numeric external quote alone is insufficient","source":["owner-decision:2026-08-26"]}
```

Graph shape:

```json
{"from":"DQ-MARKET-001","rel":"baseline_for","to":"DQ-EXT-001"}
```

## Provenance hierarchy

Prefer, roughly:

1. current live/repository evidence;
2. merged PR / exact commit;
3. canonical repository documentation or issue;
4. owner decision with date/context;
5. assistant inference clearly marked as inference.

Do not silently upgrade an inference into a fact.

## Mutable facts

Attach `observed_at` or snapshot context to facts that can change. Recheck them before consequential use.

## Lifecycle

Use `superseded` rather than destructive editing when an old conclusion remains historically useful. Archive when retrieval value is low but historical value remains. Delete when retention is actively harmful or redundant.

## Compactness rule

Optimize for retrieval. Avoid duplicating full canonical documents. Store the conclusion plus provenance and follow links when detail is required.
