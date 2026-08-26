# DQ-KEY-001

Status: LANDED via PR #111.

Core conclusions:

- broad key level is not permission truth for Custom keys;
- exact Custom `user:inventory` works while broad level remains 0;
- completed-trade recovery minimum is `user:trades` + `user:trade` + `torn:items` + local accounting state;
- exact Custom `user:bazaar` works while broad level remains 0;
- `/key/info` is useful for owner identity/private Custom diagnostics but Public selection-name enumeration is not universal;
- public faction members capability worked with `access.faction:false` even when `members` was not enumerated.

Canonical docs live under `docs/discovery/DQ-KEY-001-*` and the capability registry.
