# TornScriptures Branch Cleanup Audit

Status: **ACTIVE HOUSEKEEPING MAP / NO DELETIONS AUTHORIZED BY THIS FILE ALONE**

Audit date: 2026-08-20

## Baseline

- Repository: `KingAeon/TornScripture`
- Stable branch: `main`
- Stable main SHA before this housekeeping patch: `8944dcd9c9ae5b0d2994322efcff2c8e579b36b5`
- Stable IMM: `0.19.36`
- Open pull requests before this housekeeping patch: `0`
- Live branches before creating the housekeeping branch: `90`
- Active housekeeping branch: `docs/housekeeping-2026-08-20`

This audit replaces the stale branch-role assumptions in Issue #84. It is deliberately conservative. A branch is not marked safe merely because it is old or has a closed pull request.

## Classification rules

### Keep

Keep a branch when it is the stable branch, the current active housekeeping branch, or a deliberately preserved evidence branch whose unmerged contents remain useful to future research.

### Safe to delete

A branch is marked safe only when at least one strong condition is established:

1. its pull request was merged and the work is durably represented in `main`;
2. its exact head is proven to be contained in `main`;
3. its pull request explicitly records that the branch was disposable, superseded, or that the tested change was promoted separately to `main` and the branch is no longer needed.

Deleting a branch does not authorize deleting or rewriting its pull request, issue, or historical evidence.

### Needs verification

Anything not proven by the rules above remains untouched. Naming patterns such as `trigger/`, `release/`, `fix/`, or `dev/` are not sufficient proof by themselves.

## Keep

- `main` — stable release channel.
- `docs/housekeeping-2026-08-20` — active housekeeping patch; keep until its release/cleanup cycle is complete.
- `agent/ledger-trade-finality` — PR #92 explicitly preserves this closed, unmerged branch as evidence of the rejected DOM-backed trade-capture architecture and exact finality-message work.
- `agent/ledger-touch-capture-probe` — retained pending an explicit evidence/containment audit because it is related to the rejected mobile capture investigation and has no sufficiently verified cleanup disposition yet.

## Safe to delete after the housekeeping patch is merged

### Merged or exact-main-contained work

- [ ] `agent/black-ledger-dedup-recovery` — PR #87 merged.
- [ ] `agent/black-ledger-overlap-queue` — PR #88 merged.
- [ ] `agent/black-ledger-sale-identity` — PR #90 merged.
- [ ] `agent/black-ledger-track-a-audit` — PR #86 merged; it is no longer the active Track A branch.
- [ ] `agent/fix-favorite-carousel-routing` — PR #91 merged.
- [ ] `agent/ledger-inventory-strategy` — PR #73 merged.
- [ ] `agent/v0.19.36-startup-repair` — exact branch head `9afdf3766e0fbd108f10666c70f92f1916e0f0de` is the owner-tested PR #107 release head and is an ancestor of current `main`.
- [ ] `copilot/implement-black-ledger-recovery` — PR #107 merged.
- [ ] `copilot/implement-api-backed-black-ledger-recovery` — PR #104 merged and its later reversal is also preserved on `main` through PR #105; the obsolete branch history is therefore durable.
- [ ] `revert-104-copilot/implement-api-backed-black-ledger-recovery` — PR #105 merged.
- [ ] `copilot/validate-github-copilot-workflow` — PR #103 merged.
- [ ] `docs/project-governance-charter` — PR #99 merged.
- [ ] `docs/roadmap-copilot-amendment` — PR #101 merged.
- [ ] `docs/age-of-discovery` — PR #109 merged.

### Explicitly disposable or superseded recovery runners

- [ ] `agent/ledger-api-recovery-registered-runner` — PR #96 describes it as a disposable verifier trigger and says do not merge.
- [ ] `agent/ledger-api-recovery-v2-runner` — PR #95 describes it as a disposable verifier trigger and says do not merge.
- [ ] `agent/ledger-api-recovery-runner` — PRs #93/#94 describe it as a disposable verifier trigger/retry and say do not merge.
- [ ] `copilot/implement-api-backed-black-ledger-recovery-again` — PR #106 was closed WIP and superseded by the successful fresh implementation in PR #107.

### Explicitly promoted staging branches

- [ ] `agent/core-watchlists-v0.9.4` — PR #11 says the migration was promoted through a clean direct commit to `main` and the staging PR was no longer needed.
- [ ] `agent/favorite-capture-carousel-v0.9.8` — PR #15 says the feature was promoted through a clean commit to `main` and the staging PR was no longer needed.
- [ ] `agent/favorite-feedback-v0.2.1` — PR #10 says the hotfix was promoted through a clean direct commit to `main` and the staging PR was no longer needed.
- [ ] `agent/mobile-amount-field-v0.9.7` — PR #14 says the change was promoted through a clean commit to `main` and the staging PR was no longer needed.
- [ ] `agent/quick-max-mobile-v0.9.6` — PR #13 says the change was promoted through a clean commit to `main` and the staging PR was no longer needed.
- [ ] `agent/quick-max-v0.9.5` — PR #12 says the change was promoted through a clean direct commit to `main` and the staging PR was no longer needed.
- [ ] `agent/tx-core-migration-v093-run` — PR #6 says the migration was promoted through a clean direct commit to `main` and the staging PR was no longer needed.
- [ ] `trigger/imm-v0.19.15-run` — PR #67 says the trigger completed successfully, released v0.19.15 to `main`, and the marker PR was intentionally not merged.

**Safe candidates in this audit: 26.**

No branch in this section is deleted by creating or merging this document. Physical deletion is a separate post-merge housekeeping action.

## Needs verification — do not delete

The following 61 branches remain live and are intentionally not promoted to the safe list in this audit:

- [ ] `agent/imm-core-early-capture-v0.9.2`
- [ ] `agent/imm-v0188-interaction-stability`
- [ ] `agent/imm-v0189-scroll-quiet`
- [ ] `agent/imm-v01810-loop-kill`
- [ ] `agent/remove-obsolete-imm-shims`
- [ ] `agent/retire-trader-extensions`
- [ ] `agent/tracked-badge-merge-v0.1.10`
- [ ] `agent/validate-favorite-runtime-v0910`
- [ ] `agent/validate-trade-exit-audit-v0100`
- [ ] `agent/validate-trade-switch-gain-v0102b`
- [ ] `agent/validate-trade-switch-gain-v0102`
- [ ] `agent/watch-model-v0.2.0`
- [ ] `dev/tracked-format-overlay-011`
- [ ] `dev/tracked-margin-016`
- [ ] `dev/trader-extensions-017-auto`
- [ ] `dev/trader-extensions-018-layout`
- [ ] `dev/trader-extensions-019-style-refresh`
- [ ] `feature/item-market-margin-v0.1.0`
- [ ] `feature/tracked-margin-cleanup`
- [ ] `fix/listing-cost-cell-v0107b`
- [ ] `fix/listing-cost-cell-v0107`
- [ ] `imm-v0122-trigger-ref`
- [ ] `imm-v0123-trigger-ref`
- [ ] `imm-v0131-api-first-pr`
- [ ] `imm-v0131-trigger-ref`
- [ ] `imm-v0140-pr-trigger`
- [ ] `imm-v0140-release-ref`
- [ ] `imm-v0150-pr-trigger`
- [ ] `imm-v0160-pr-trigger`
- [ ] `imm-v0170-pr-trigger`
- [ ] `imm-v0171-pr-trigger`
- [ ] `imm-v0172-pr-trigger`
- [ ] `imm-v0173-pr-trigger`
- [ ] `imm-v0174-pr-trigger`
- [ ] `imm-v0175-pr-trigger`
- [ ] `imm-v0176-pr-trigger`
- [ ] `imm-v0180-pr-trigger`
- [ ] `imm-v0181-pr-trigger`
- [ ] `imm-v0182-pr-trigger`
- [ ] `imm-v0183-pr-trigger`
- [ ] `imm-v0184-pr-trigger`
- [ ] `imm-v0185-pr-trigger`
- [ ] `imm-v0186-pr-trigger`
- [ ] `imm-v0187-pr-trigger`
- [ ] `release/imm-v0.19.0-trader-controls`
- [ ] `release/imm-v0.19.1-final-trigger`
- [ ] `release/imm-v0.19.1-startup-hotfix`
- [ ] `release/imm-v0.19.1-startup-hotfix-2`
- [ ] `release/imm-v0.19.1-startup-hotfix-3`
- [ ] `release/imm-v0.19.1-yaml-fixed-trigger`
- [ ] `release/imm-v0.19.2-single-item-traders`
- [ ] `release/imm-v0.19.3-ledger-dedupe`
- [ ] `release/imm-v0.19.3-ledger-dedupe-fresh`
- [ ] `release/imm-v0.19.5-funding-sources`
- [ ] `release/imm-v0.19.6-trade-lockdown`
- [ ] `release/imm-v0.19.7-canonical-trigger`
- [ ] `release/imm-v0.19.7-static-badges-trade-max`
- [ ] `release/imm-v0.19.7-static-badges-trade-max-direct`
- [ ] `release/imm-v0.19.7-static-badges-trade-max-fresh`
- [ ] `repair/imm-v0.19.15-roi-first-badges`
- [ ] `test/tsimm-action-smoke`

These branches may be staging, triggers, superseded experiments, or contain work already represented elsewhere, but this audit does not delete them without stronger evidence.

## Post-merge deletion procedure

After this housekeeping patch is reviewed and merged:

1. Re-read this file from the merged `main` commit.
2. Confirm each candidate branch still points to the expected historical work and no new commits appeared.
3. Delete only branches in **Safe to delete**.
4. Never delete `main`, the active housekeeping branch before its own cleanup is complete, or either evidence branch listed above.
5. Update Issue #84 and this audit after deletion with actual results rather than assuming success.

## Current verdict

TornScriptures has a clean PR board but a large historical branch tail. This audit establishes a conservative first cleanup tranche of 26 branches while preserving two evidence branches and quarantining 61 branches for later verification.
