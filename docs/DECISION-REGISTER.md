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

---

## GOV-004: Use optional conversation mode keys

**Date:** 2026-08-06

**Question:** How can the owner quickly signal the intended project mode without being forced into formal specifications?

**Decision:** Adopt the optional keys `[D]`, `[S]`, `[B]`, `[V]`, `[R]`, and `[P]` for Discussion, Specification, Build, Verification, Release, and Pause.

**Evidence:** Short prefixes help separate exploratory conversation from repository action while preserving natural-language input.

**Consequences:**

- The keys are documented in `docs/MODE-KEYS.md`.
- Forgetting or mistyping a key does not invalidate the request.
- Keys do not override safety, spending authority, toolchain gates, or owner-exclusive merge authority.
- `[R]` starts release checks; explicit `Merge PR #<number>` authorization remains required.

**Revisit condition:** The keys create confusion or the owner approves a simpler replacement.

---

## ARCH-001: Prefer a modular monolith with a small domain set

**Date:** 2026-08-06

**Question:** Should TornScriptures become one enormous script, a hub with many small add-ons, or a small internally modular suite?

**Decision:** Prefer one installable TornScriptures suite where practical, implemented internally as a modular monolith with a core hub and a small number of major domains.

**Approved domains:** Core Hub, Market and Trader, Black Ledger, Inventory and Bazaar, and War Intelligence.

**Evidence:** One unstructured file increases entanglement, while dozens of add-ons increase installation, versioning, compatibility, and support burden.

**Consequences:**

- Features default to toggles or components inside an existing domain.
- Separate scripts require a strong boundary such as permissions, data lifecycle, failure isolation, unrelated audience, or loading cost.
- Source modules may eventually build into one user-facing installation.
- Modularization remains a Tier 4 staged migration and does not interrupt Black Ledger recovery.

**Revisit condition:** A formal architecture inventory shows that another domain split or packaging model reduces risk without multiplying installations.

---

## ANALYTICS-001: Build market intelligence in evidence-first stages

**Date:** 2026-08-06

**Question:** How should TornScriptures identify stagnant, rising, falling, and possible bottoming products?

**Decision:** Build market intelligence in stages: historical observation, reproducible calculations, cautious classification, and historical validation.

**Evidence:** A reliable trend signal requires timestamped history, source provenance, freshness, liquidity context, and false-positive measurement. A current low price alone does not prove a bottom.

**Consequences:**

- The first release collects and displays evidence without purchase recommendations.
- Later classifications may include stagnant, rising, falling, bottoming candidate, early rebound, overheated, and insufficient data.
- Confidence, sample count, freshness, volatility, and liquidity remain visible.
- Early language uses `potential accumulation zone` or `bottoming candidate`, not an absolute `buy now` instruction.
- Stronger decision language requires replay testing and outcome tracking.
- Analytics remains advisory and never buys, lists, or moves money automatically.

**Revisit condition:** Historical validation demonstrates sufficiently reliable signals and the owner approves stronger wording.

---

## TOOL-001: Trial GitHub Copilot before assigning product work

**Date:** 2026-08-06

**Question:** Which coding environment should TornScriptures test first for mid-level implementation assistance?

**Decision:** Trial GitHub Copilot Pro cloud agent first through a harmless repository preflight. Preserve Codex as the preferred premium candidate for Tier 3 accounting and architecture work unless another agent proves equal capability.

**Evidence:** Copilot is connected directly to GitHub, can work from issues toward pull requests, and provides a lower-cost mid-level route. Its actual repository, terminal, and test behavior must still be proven.

**Consequences:**

- `main` is protected before the trial.
- Copilot receives a separate documentation-only preflight issue, not Issue #97.
- The preflight must prove repository materialization, clean baseline, tests, isolated branch, commit, and draft PR.
- Failure disqualifies Copilot from product work without condemning TornScriptures or other tools.
- Issue #97 remains reserved until a suitable workspace passes the gate.

**Revisit condition:** Copilot passes or fails the preflight, pricing changes materially, or another coding environment demonstrates a safer and more economical loop.

---

## TOOL-002: Use the lightest verified tool for each job

**Date:** 2026-08-20

**Question:** After the Copilot preflight, how should TornScriptures choose between the GitHub connector, Copilot, and Codex?

**Decision:** Use the lightest tool that can safely complete and verify the task. Prefer the GitHub connector for repository inspection, documentation, issue administration, branch bookkeeping, and controlled repository-object operations. Use a full-repository coding agent only when executable implementation, testing, or deeper code reasoning materially requires it.

**Evidence:** PR #103 proved the Copilot repository workflow. Later PR #107 required a stronger implementation/test path for Tier 3 accounting, while PR #109 and the August 20 housekeeping work were safely handled through GitHub without spending coding-agent credits.

**Consequences:**

- Copilot is available but is not the default for routine administration.
- Codex/premium capacity remains reserved for high-risk or complex implementation.
- Documentation and Discovery bookkeeping should not consume premium coding budget merely because an agent is available.
- Tool choice remains subordinate to risk and verification requirements.

**Revisit condition:** Tool capabilities, reliability, or usage economics materially change.

---

## BL-004: Treat IMM v0.19.36 API recovery as the released accounting contract for ordinary completed sales

**Date:** 2026-08-20

**Question:** Did the review-first API recovery architecture become tested, released behavior, or is it still only a proposal?

**Decision:** It is released behavior for the current supported boundary: ordinary completed cash-for-items sales with complete FIFO coverage.

**Evidence:** PR #107 was owner-tested on TornPDA at exact head `9afdf3766e0fbd108f10666c70f92f1916e0f0de` and merged to `main` through commit `25fe4936b87697427cfaa1db99fffa907ba07126`. The controlled sale used exact API trade identity, produced the predicted FIFO cost basis and realized profit, remained non-mutating during review/cancel, persisted once after confirmation, disappeared from the recovery queue after reload, and passed Ledger Integrity.

**Consequences:**

- Exact API trade ID is the primary duplicate identity for this path.
- Canonical API fingerprint remains a secondary exact guard.
- Bounded legacy/manual matching remains a protection only where exact API identity is unavailable.
- Unsupported assets, barter, malformed data, non-positive proceeds, unknown catalog items, and incomplete FIFO remain fail-closed.
- Manual missed-sale recovery remains the outage/unsupported fallback.
- Future Discovery must not describe current API recovery as wholly unverified or unimplemented.

**Revisit condition:** Torn changes the relevant API contract, live evidence contradicts the released assumptions, or the owner approves a broader transaction boundary.

---

## BL-005: Treat the API journal as the supported TornPDA missed-trade path

**Date:** 2026-09-03

**Question:** Should IMM v0.19.37 promise automatic Black Ledger recording from TornPDA's completed-trade screen, or use the unresolved-trade API journal as the supported path when the live manifest vanishes?

**Decision:** The explicit API journal flow—**Load details → review → consume**—is the supported TornPDA recovery contract. Live-DOM recording may remain as a best-effort compatibility path when a complete matching pre-completion snapshot genuinely exists, but it is not a release guarantee.

**Evidence:** In a controlled low-value trade, the repaired candidate visibly recognized Torn's authoritative `Trade was accepted and is now complete!` message. Sanitized diagnostics showed `pendingSnapshot.present: false`, proving that no pre-completion manifest survived and ruling out a trade-ID mismatch. IMM correctly made no accounting mutation. The same trade was then hydrated, reviewed, consumed once through the API journal, and followed by a passing Ledger Integrity check.

**Consequences:**

- Missing live snapshots fail closed with no guessed sale or FIFO mutation.
- Saved Trader Book membership is not a prerequisite for API journal recovery.
- Automatic live-DOM recording is not part of the v0.19.37 release promise.
- Final-message recognition remains useful for truthful completed/not-recorded status and recovery guidance.
- Do not restart acceptance selectors, touch probes, or vanished-DOM reconstruction without a newly exposed stable complete source.

**Revisit condition:** Torn exposes a stable embedded payload or documented event containing authoritative participants, items, money, identity, and completion evidence before the manifest is removed.

---

## STORAGE-001: Use hybrid persistence behind a centralized storage service

**Date:** 2026-08-11; recorded in the main decision register 2026-08-20

**Question:** Should TornScriptures migrate all persistent data to one backend, or choose storage by data consequence and timing?

**Decision:** Use a hybrid persistence architecture behind a centralized storage service. Backend choice is determined by data class and runtime requirements, not by one universal storage mechanism.

**Evidence:** The Age of Discovery completed TornPDA native-storage qualification across lifecycle persistence, scaling, batching, quota rejection, cross-origin continuity, and bounded concurrency. The evidence is preserved under `docs/discovery/` and the architecture is recorded in `TORNSCRIPTURE-STORAGE-ARCHITECTURE-DECISION.md`.

**Consequences:**

- Timing-critical state may remain in synchronous memory/browser/session/URL mechanisms where timing requires it.
- Substantial reconstructible TornPDA data should eventually prefer `PDA_storage` behind the abstraction.
- Irreplaceable Black Ledger and user-authored data must never depend on one unbacked copy.
- Class C data requires portable backup/recovery and integrity guarantees before migration.
- Do not mechanically move monolithic `localStorage` blobs into native storage.
- The preferred first eventual storage-abstraction pilot is reconstructible Torn item catalog data, not Black Ledger.
- No production migration is authorized merely by this decision.

**Revisit condition:** New runtime evidence changes TornPDA storage guarantees, desktop portability requirements demand another backend policy, or a production pilot reveals a material limitation.

---

## DISC-001: Keep Discovery as durable project knowledge on `main`

**Date:** 2026-08-20

**Question:** Should the Age of Discovery remain isolated on a long-running research branch until every open question is solved?

**Decision:** No. Merge verified Discovery checkpoints into `main` while preserving unresolved questions and historical evidence. Use a current-status layer to supersede stale state without rewriting history.

**Evidence:** PR #109 merged the first Age of Discovery checkpoint from exact reviewed head `fffef3e2ae9236d5b8684a029420c989b488d45c` through merge commit `8944dcd9c9ae5b0d2994322efcff2c8e579b36b5`. All PR changes were confined to `docs/discovery/` and disposable discovery probes.

**Consequences:**

- Future threads and agents can begin from repository-backed capability knowledge instead of chat memory alone.
- Historical propositions and open-question wording remain evidence, even when later implementation changes current truth.
- `docs/discovery/CURRENT-STATUS.md` is the first-stop current state.
- Open research questions do not block merging accurate Discovery checkpoints.
- The next recommended chapter is DQ-KEY-001, the minimum permission and source-ownership matrix.

**Revisit condition:** Discovery documentation becomes too large or too stale to function as a useful source of truth, at which point the owner may approve a reorganized index/archive strategy without deleting evidence.
