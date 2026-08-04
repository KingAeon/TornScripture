# TornScriptures Decision Register

This register records durable architecture and process decisions. It prevents future agents from repeating rejected approaches or reopening settled questions without new evidence.

## Decision format

Each decision records:

- ID and date
- question
- decision
- evidence
- consequences
- revisit condition

---

## TS-001: Protect `main` as the live release channel

**Date:** 2026-08-04

**Question:** May agents use `main` for experiments, patch runners, or temporary workflows?

**Decision:** No. Product work and governance changes use isolated branches. Temporary workflows, trigger files, placeholders, and one-use patchers do not belong on `main`.

**Evidence:** Userscript update URLs point to raw files on `main`. A failed trade-recovery tooling attempt created temporary CI scaffolding that later had to be removed by restoring the exact stable baseline.

**Consequences:**

- `main` is treated as protected even without technical enforcement.
- Toolchain experiments occur off `main`.
- Merge requires explicit owner authorization.

**Revisit condition:** Only if the repository adopts enforced protected-branch automation with an independently reviewed workflow design.

---

## TS-002: Require the complete implementation toolchain before product edits

**Date:** 2026-08-04

**Question:** Is repository read/write access alone enough for substantial implementation?

**Decision:** No. Product implementation requires the ability to materialize the full repository, edit an isolated branch, run required tests, inspect the complete diff, and publish a verified commit.

**Evidence:** The GitHub connector could inspect and mutate repository objects but could not reliably replace a checked-out repository and terminal when Actions stopped scheduling verifier workflows.

**Consequences:**

- Every coding environment receives a no-change preflight.
- Tool limitations are stated before implementation promises.
- Connector-only work is limited to tasks it can verify safely, such as documentation, issue management, and review.

**Revisit condition:** When the active connector or platform exposes a complete executable repository workspace and proves the full loop.

---

## BL-001: Torn route alone does not prove trade completion

**Date:** 2026-08-03

**Question:** Does `#step=logview` mean a Torn trade is complete?

**Decision:** No.

**Evidence:** Torn reaches log view before final acceptance. The observed true final message is `Trade was accepted and is now complete!`. First acceptance and mutual-acceptance wording occur earlier.

**Consequences:**

- Route alone must not trigger sale mutation.
- Finality tests preserve pending intermediate states.

**Revisit condition:** Torn publishes a stable documented completion state that supersedes message recognition.

---

## BL-002: Reject mobile DOM capture as the primary completed-trade source

**Date:** 2026-08-04

**Question:** Should Black Ledger continue adding acceptance-button selectors, click timing, touch probes, or pre-accept DOM snapshots to recover completed trade contents?

**Decision:** No.

**Evidence:**

- IMM correctly recognized finality but reached completion with zero recognized sides, zero item types, and no cash.
- A capture-phase acceptance listener did not preserve a usable snapshot.
- A separate early pointer/touch probe fired but the parser still produced no manifest.
- An approximately $8 million test sale was correctly not invented or recorded.

**Consequences:**

- Stop investment in button wording and event timing.
- Preserve useful final-message tests.
- Keep manual recovery as fallback.
- Close PR #92 unmerged as a checkpoint.

**Revisit condition:** New evidence shows Torn exposes a stable complete embedded payload or documented event containing participants, items, and money before removal.

---

## BL-003: Use review-first Torn API recovery for completed trades

**Date:** 2026-08-04

**Question:** What architecture should replace failed mobile DOM trade capture?

**Decision:** Use Torn API v2 finished-trade data to list recent trades, fetch detailed trade contents, calculate net proceeds, preview FIFO allocations, and require explicit confirmation before mutation.

**Evidence:** Official trade endpoints provide a more inspectable source than recycled mobile DOM. Issue #97 contains the approved product and test requirements.

**Consequences:**

- First release is user-triggered and review-first.
- Unsupported assets, ambiguous ownership, unknown items, malformed responses, and partial ledger coverage fail closed.
- Primary deduplication uses API trade identity, with secondary content/time protection.
- Manual recovery remains available during API outage.

**Revisit condition:** After repeated live success, the owner may separately consider optional automatic recording of API-confirmed trades.

---

## GOV-001: Adopt project modes and risk tiers

**Date:** 2026-08-04

**Question:** How should natural conversation be converted into controlled project action?

**Decision:** Every substantial request is classified by project mode and risk tier before implementation.

**Modes:** Discussion, Specification, Implementation, Verification, Release.

**Risk tiers:** Tier 0 through Tier 4 as defined in `AGENTS.md` and `docs/PROJECT-CHARTER.md`.

**Consequences:**

- Ideas do not silently become repository changes.
- High-risk work receives stronger tools and gates.
- The assistant structures rough requests without requiring formal user wording.

**Revisit condition:** Owner-approved governance amendment.

---

## GOV-002: Limit active implementation work

**Date:** 2026-08-04

**Question:** How many coding projects should run concurrently?

**Decision:** At most one Tier 3 or Tier 4 implementation and one Tier 1 or Tier 2 side implementation.

**Evidence:** Multiple simultaneous TornScriptures tracks increase context reloads, incomplete branches, and priority drift.

**Consequences:**

- New ideas enter discussion or backlog without automatically opening code branches.
- Dependencies may interrupt priority only with a recorded reason.

**Revisit condition:** The project gains reliable modular ownership, automated coverage, and enough implementation capacity to support more concurrency safely.

---

## GOV-003: Preserve owner-exclusive merge authority

**Date:** 2026-08-04

**Question:** May an assistant or coding agent merge after tests pass?

**Decision:** No. The owner alone authorizes merge of the exact reviewed PR and head SHA.

**Consequences:**

- Design approval is not merge approval.
- Coding agents never enable auto-merge.
- Assistant reports release evidence before requesting authorization.

**Revisit condition:** None unless the owner explicitly amends the charter.

---

## COST-001: Use coding agents only after product decisions are frozen

**Date:** 2026-08-04

**Question:** How should TornScriptures control Codex or alternative coding-agent usage?

**Decision:** Resolve product behavior in discussion and specification before opening implementation sessions. Prefer one implementation pass, one consolidated review pass, and at most one bounded evidence-driven repair.

**Consequences:**

- No premium usage for naming, roadmap work, issue writing, or unresolved debate.
- Related code, tests, cleanup, docs, and versioning are bundled coherently.
- Unrelated projects remain separate.
- Repeated failures trigger re-scope rather than unlimited patch cycles.

**Revisit condition:** Usage economics or agent capabilities materially change.
