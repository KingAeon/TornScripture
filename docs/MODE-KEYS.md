# TornScriptures Conversation Mode Keys

## Purpose

These short prefixes let the project owner signal the intended conversation mode at the beginning of a message. They are optional memory aids, not authorization traps.

The owner may always speak naturally. When a key is absent, the project assistant still interprets the request under the Project Charter and asks only when consequential ambiguity remains.

## Primary keys

| Key | Mode | Meaning |
|---|---|---|
| `[D]` | Discussion | Explore behavior, compare options, evaluate priority, and make no repository changes. |
| `[S]` | Specification | Freeze mission, scope, exclusions, risks, tests, tool choice, and manual gates. |
| `[B]` | Build | Begin the approved implementation after the required toolchain and branch gates pass. |
| `[V]` | Verification | Review evidence, run tests, diagnose defects, and make only evidence-driven corrections. |
| `[R]` | Release | Run the release gate. A merge still requires explicit authorization tied to the exact PR and head SHA. |
| `[P]` | Pause | Stop active implementation, preserve state, and record what is needed to resume. |

Memory line:

> **D S B V R P**: Discuss, Specify, Build, Verify, Release, Pause.

## Optional subject keys

These may be combined with a primary mode key:

| Key | Meaning |
|---|---|
| `[BUG]` | Defect, regression, or unexpected behavior |
| `[MAP]` | Roadmap, priority, dependency, or future-project discussion |
| `[DECIDE]` | Compare realistic options and reach a recorded decision |

Examples:

```text
[D][MAP] Add market trend analytics to the long-term roadmap.
```

```text
[V][BUG] The trade completed, but Black Ledger recorded nothing.
```

```text
[S] Freeze the scope for trader hiding and reversible classifications.
```

## Interpretation rules

- A key signals intent but does not override safety, data protection, spending authority, or owner-exclusive merge authority.
- `[B]` applies only to an already approved specification. Without one, the assistant returns to Specification rather than improvising product behavior.
- `[R]` authorizes release checks, not an unspecified merge. Use `Merge PR #<number>` for explicit merge authorization.
- `[P]` stops implementation immediately but does not abandon TornScriptures or erase the roadmap.
- A mistyped or forgotten key should be interpreted from context rather than treated as failure.
