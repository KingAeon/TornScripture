# Assistant-First Gate: Continuity, Review and Escalation

Status: OWNER-REQUESTED GOVERNANCE RESTORATION, 2026-10-11. This document restates and operationalizes existing `AGENTS.md`, `docs/ASSISTANT-OPERATING-RULES.md`, `docs/DEVELOPMENT-WORKFLOW.md`, `docs/MUTUAL-COVENANT.md` and `docs/LEDGER-INVARIANTS.md`. It does **not** amend them or grant implementation, financial, gameplay, merge, release or spending permission.

## Always begin here

1. **Bootstrap:** read root `AGENTS.md`; `docs/divine-knowledge/INDEX.md` → `NOW.md` → `AUTHORITY.md`; relevant domain/chapter indexes, governing invariants and canonical evidence. Read only what is relevant but **do this in the assistant's own conversation**, not merely as instructions to the next Work agent.
2. **Check live truth:** inspect the current GitHub PR/main/branch refs, exact head, tree, merge status, evidence comments and full changed-file inventory. Explicitly identify stale records rather than propagating them. Use timestamped snapshot labels, never assert older `NOW.md` entries are live.
3. **State mode and risk:** discussion, specification, implementation, independent verification or release; Tier 0–4; approved scope and prohibitions. Do not treat a Work output, fixture count or author's PASS as independent PASS.
4. **Perform assistant review first:** read **the actual changed source and relevant surrounding callers**, base-to-head and parent-to-head diffs, storage/raw-to-normalized authority and identity semantics, transitions/races, complete relevant tests and omitted adversarial permutations; check Ledger and protected boundaries. GitHub fetch can support this review. A PR metadata check or an author report alone **does not** satisfy it.
5. **Prove tool capability, do not assume:** determine what this chat/GitHub connector/local runtime can truly perform; record positive and negative evidence. If an executable full checkout is unavailable, do all static/GitHub-backed work first. If a compatible clean full checkout is available, run the relevant tests locally. Do not call a static review an executable [V1] or Node fixture a TornPDA browser test.
6. **Write the pre-escalation decision:** before suggesting any paid Work/Codex run, report: exact SHA/tree and snapshot date; assistant review performed and evidence links; verified vs unverified claims; risks and missing tests; why a cheaper adequate tool cannot finish; expected cost class/passes; stop conditions; frozen exclusions and next owner decision.
7. **Enforce correction budget:** the existing rules default to one implementation, one consolidated correction and at most one bounded repair. After repeated independent new blockers, **pause and review raw-state/architecture and correction scope** before more paid patches. Consolidate related defects. Do not reflexively request another Work run because an agent returned BLOCKED.
8. **Close the loop:** keep durable evidence/decisions/current state in issue/PR and relevant Divine Knowledge records after consequential work; reread refs after publication. Do not update product/main as a side effect of documentation continuity. Require independent exact-head [V1], then separate owner [V2] TornPDA/desktop + Ledger Integrity, then separate merge/release decision.

## Mandatory short pre-escalation record

- **Project / mode / risk / authority:** exact repo, PR and approved boundary.
- **Current facts:** verified main/base/head/tree, date and immutable source links; note stale sources.
- **Assistant work completed:** source sections/diffs inspected, invariants challenged, tests/fixtures designed or run; say what was **not** executed.
- **Open hazards:** evidence-backed defects, potential cases, impact and rollback.
- **Escalation case:** required unavailable capability, cheaper options genuinely considered, budget/correction-cycle stop line.
- **Owner gate:** precise requested authorization, untouched protected systems, next V1/V2/release stage.

No advancement to implementation, testing claim, V2 or merge solely because this record exists. A missing or incomplete gate is a **process blocker**, not permission to bypass.

## Source-of-truth hierarchy and project files

The **canonical, mutable project source** is GitHub (governing docs, issue/PR evidence, immutable commits); Divine Knowledge is a compact navigation/decision layer, not a duplicate codebase. Assistant memory and chat thread handoffs are convenience context only. Project uploads/files, if used, should carry a small **static navigation card**, clearly timestamped and directing agents to re-fetch live GitHub. Never upload a mutable `NOW.md` snapshot or source ZIP as the sole truth, and never assume a project file edits itself when the repository changes.

## Current Black Ledger example

See [BL-R01B v2.2 dated continuity](../black-ledger/PR-139-STATUS-2026-10-11.md). Its current [B] author PASS is not [V1] PASS. Repeated V1 blockers are evidence that this assistant must perform a substantive independent source audit before requesting another full paid test pass. Do not relax the frozen architecture or protected Ledger boundaries.