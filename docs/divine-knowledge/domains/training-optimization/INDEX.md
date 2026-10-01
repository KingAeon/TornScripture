# Training Optimization Domain

Status: **001J CORE OWNER TORNPDA SMOKE PASS; 001K SPEC VERIFIED/MERGED; PR #135 0.1.1 IMPLEMENTED/AUTOMATED PASS; OWNER BROWSER AND INDEPENDENT IMPLEMENTATION GATES PENDING; DRAFT/UNMERGED; H1/H2 OPEN**

## Purpose

Develop a TornScriptures training advisor that helps the owner and faction members make better long-term battle-stat training decisions. Happy Jump planning is the first major use case, but the domain includes ordinary training, gym choice, consumable strategy, opportunity cost, and compounded future outcomes.

## Owner-approved direction

Recorded 2026-09-14:

- The eventual tool should be useful to the project owner and shareable with the owner's faction.
- New players must be able to use the primary guidance without understanding the underlying formula.
- Advanced users should be able to inspect assumptions, predicted gains, costs, alternatives, model status, and uncertainty.
- Small efficiency gains matter because current stat gains feed later training gains over a long time horizon.
- Durable conclusions, source provenance, decisions, uncertainty, and nonprivate fixtures belong in Divine Knowledge.

## Product boundary

The intended product is an advisory navigator, not an unattended gameplay agent.

Allowed direction includes calculations, live-state summaries, timers, warnings, checklists, inventory-aware substitutions, predicted gains, comparisons, and user-triggered planning. Automatic item consumption, automatic drug use, automatic training, or other unattended gameplay actions remain prohibited.

Player API keys, personal inventory, live player stats, session data, raw calibration records, and private exports remain browser/local/chat context and must not enter this subtree by default.

## Knowledge split

Store here:

- verified mechanics and explicitly bounded formula assumptions;
- sources and dates checked;
- owner decisions and product boundaries;
- uncertainty and competing interpretations;
- deterministic test vectors containing no private player data;
- calibration protocol and synthetic observation schema;
- aggregate validation findings and supersession history.

Resolve at runtime or recheck before consequential use:

- live prices and market availability;
- current player stats, energy, Happy, cooldowns, perks, gyms, and inventory;
- mutable Torn API contracts and cache behavior;
- current Torn scripting rules.

## Delivery sequence

1. **Completed:** research and falsify initial training-model assumptions.
2. **Completed:** freeze DQ-TRAIN-001A pure Training Math Engine contract and deterministic fixtures.
3. **Completed:** freeze DQ-TRAIN-001B live-calibration protocol and observation schema.
4. **Completed:** B1 smoke/falsification lane.
5. **Completed:** B2 all-four stat-family ordinary-Happy breadth.
6. **Completed:** B3 elevated-Happy Speed/Strength calibration.
7. **Completed:** B4 sequential 11-train batch validation.
8. **Accepted 2026-09-25:** owner promoted `vladar-v2-pre50m-v1` to `calibrated_observed_domain` for the documented Complete Cardio / 10E / recorded-modifier evidence domain only.
9. **Completed:** freeze the Training Advisor / Happy Jump Navigator product specification and ranking/strategy fixtures.
10. **Implemented and verification corrected in draft PR #123:** pure math/planner and deterministic frozen-fixture tests after explicit owner build authorization; five blocking findings and two bounded gaps corrected, 318 Node tests passed. Its additive Point-refill finding was subsequently superseded.
11. **DQ-TRAIN-001E correction, PR #125 merged into main:** owner-authorized supersession of the incorrect refill fixture; a refill fills to natural maximum and a 1,150E jump trains the stack and refill bar sequentially. Focused 89 and repository 326 Node tests passed at that checkpoint.
12. **DQ-TRAIN-001F correction merged in PR #127:** per-item pre-use booster threshold; after exact-max four-eDVD checkpoint, fifth item requires observed below-max state. Focused 97 and repository 334 Node tests passed at the original checkpoint. The merge preceded independent [V], which found a legal mixed-booster plan pruned by an illegal competitor. The bounded [follow-up correction](../../chapters/dq-train-001/BOOSTER-FRONTIER-VERIFICATION-CORRECTION-2026-09-26.md), draft PR #128, passed independent [V] at `0a8abe04cfe8a7d4e2ce346b7bb5f0867e29785c`; its separately authorized merge landed as `24701cccbaebbeae7b3e8bb3e05d9c2f9c478a82`; PR #126 final adapter-spec verification has resumed.
13. **DQ-TRAIN-001D completed:** pure source adapters built from `main@f4777409632ee69f901ed0dbe41a882a95743f2d`, independently verified, and merged in PR #129. UI and TornPDA integration remain later.
14. **DQ-TRAIN-001H/001I complete:** PR #130's immediate Xanax +75 Happy correction and PR #131's 1,000E stack-cap specification merged. PR #132 passed independent [V] at `a5066c848ebd14c5045817947978646ef9af9578` and merged at `7352573be851f4cae590848af830975e905f6890`, completing versioned-cap and supported Xanax normalization. The [001I build checkpoint](../../chapters/dq-train-001/STACK-CAP-BUILD-CHECKPOINT-2026-09-28.md) retains its historical pending-V language.
15. **DQ-TRAIN-001J-P complete/merged:** the selected-plan inventory prerequisite passed independent executable [V] at `7b1b31c60efcd8cbd0c13d32ee1d44fa84b7bcf0` and merged in PR #133 at `8665d1e02d6b96e8daf9b9a3dcc091dfb17a21d1`. Partial current confirmation can prove only selected-plan owned quantities; bought resources remain acquisition-gated.
16. **DQ-TRAIN-001J specification verified/merged:** [runtime/UI integration](../../chapters/dq-train-001/RUNTIME-UI-INTEGRATION-SPEC-001J.md) plus [34 synthetic fixtures](../../chapters/dq-train-001/RUNTIME-UI-INTEGRATION-FIXTURES-001J.json) passed independent [V] in PR #134 and merged at `776d8e8044f317cd8feca58fb5197710b9c69b64`; H1/H2 remain open live-evidence gates.
17. **DQ-TRAIN-001J draft implementation active:** PR #135 remains draft/unmerged; at the 001K freeze its head is `4067c82c52439e97bb22856ac5e3e451d6a33591` with product bytes from `f309913a223520e720701d5e5c25cb092796b618`. Owner TornPDA smoke has exercised core acquisition/epoch/effect/item-confirmation/zero-override/refresh-reset behavior.
18. **DQ-TRAIN-001K specification frozen for independent [V]:** [UI polish and route comparison/selection](../../chapters/dq-train-001/UI-POLISH-ROUTE-SELECTION-SPEC-001K.md) plus [synthetic fixtures](../../chapters/dq-train-001/UI-POLISH-ROUTE-SELECTION-FIXTURES-001K.json) freeze modal stacking/theme/navigation/evidence UX and the canonical bounded route-option + ephemeral player-selection extension. No implementation is authorized by the freeze.
19. Release only after implementation, independent verification, owner review, manual gates, and explicit merge/release authorization.

B5 special/boundary research remains parallel and opportunistic; it does not block specification work.

## Active chapter

- `../../chapters/dq-train-001/INDEX.md` — authoritative state for battle-stat training and Happy Jump mechanics, DQ-TRAIN-001A contract/fixtures, DQ-TRAIN-001B live calibration, aggregate results, and later optimization work.

## DQ-TRAIN-001D adapter specification

Merged PR #126 carries the normalized source map, item mechanic registry, live proof, and synthetic fixtures. Its final [V]/[S] checks passed after the verified PR #128 planner merge; see the [freeze result](../../chapters/dq-train-001/ADAPTER-FINAL-FREEZE-2026-09-26.md). The owner separately authorized the [001D pure adapter build](../../chapters/dq-train-001/ADAPTER-BUILD-CHECKPOINT-2026-09-27.md), later merged in PR #129. PR #131 froze the versioned Energy stack cap; PR #132's independently verified 001I implementation is merged. Selected-plan inventory execution proof is complete through independently verified/merged PR #133. DQ-TRAIN-001J now freezes the later acquisition, standalone packaging/runtime, and beginner/advanced UI contract; the prior runtime/UI head passed independent [V][WORK], and the bounded quote correction now awaits repeated owner live gates; see the build checkpoint.

Owner-authorized PR #135 amendment (2026-10-01) removes the unsupported 60-second authority expiry and blanket foreground/page-interaction invalidation. Current epochs/confirmation persist until an explicit approved transition; checkpoint → Refresh & Plan → observe → replan remains required after material actions. Tested amended product head `a151435e18de2a15eebbcd818cdc8ea1b296cebe`; 219 focused / 456 repository passes; final draft PR head is the independent-verification pin.

Owner-authorized TornPDA compatibility amendment (2026-10-01), after independently verified head `f9c37b181c22a23f093830e33d987abdfeb7d380`: first real Android smoke test installed successfully with END injection but showed no HUD, with or without an API key. Known whole-source smart-quote normalization turned `plan\u2019s` into invalid single-quoted JavaScript; the documented transform reproduced the startup SyntaxError. Two ASCII-safe UI wording changes and one permanent four-quote source/artifact build guard correct that bounded failure. Tested product head `29a4b6bc80a59889cc336d43cbf166c601092309`; 162 existing / 58 runtime/UI/build / 220 focused / 457 repository passes, all 34 frozen J cases, deterministic regeneration, provenance, drift and VM parity. See the build checkpoint and [normalization evidence](../../../discovery/evidence/TORN-PDA-USERSCRIPT-SOURCE-NORMALIZATION.md). Repeat owner TornPDA smoke; desktop/H1/H2 gates remain pending; same draft PR #135 remains unmerged/unreleased.

Owner live post-quote smoke at `efbe6b34a36dc72896c54f0c29f388cbebd02765` passed END startup, HUD/expanded UI, managed key, real CURRENT refresh, stats and Complete Cardio gym acquisition. Bars normalization remained blocked because the acquisition boundary omitted the official v2 bars envelope; the first new regression reproduced missing Energy, then one unwrap line fixed it without changing adaptBars. The nine-endpoint official wrapper audit (OpenAPI 6.13.6) found no other missing unwrap. Current confirmations now receive immediate-replan guidance; API failures identify their source/refresh; H1/H2 remain dedicated open limitations with full Advanced raw diagnostics. Tested product head `0ba12a007f0b1fe241b63b563586bb543990e679`; 162 canonical / 67 runtime/UI/build / 229 focused / 466 repository passes, all 34 frozen J cases, deterministic/hashes/drift/VM/four-quote checks pass. Repeat owner bars/confirmation smoke; same draft/open/unmerged PR #135 and separate desktop/H1/H2 gates remain.

Merged PR #126 carries the normalized source map, item mechanic registry, live proof, and synthetic fixtures. Its final [V]/[S] checks passed after the verified PR #128 planner merge; see the [freeze result](../../chapters/dq-train-001/ADAPTER-FINAL-FREEZE-2026-09-26.md). The owner separately authorized the [001D pure adapter build](../../chapters/dq-train-001/ADAPTER-BUILD-CHECKPOINT-2026-09-27.md), later merged in PR #129. PR #131 froze the versioned Energy stack cap; PR #132's independently verified 001I implementation is merged. Selected-plan inventory execution proof is complete through independently verified/merged PR #133. DQ-TRAIN-001J's acquisition, standalone packaging/runtime and beginner/advanced UI contract is verified/merged, and its authorized implementation remains active in draft PR #135. DQ-TRAIN-001K is the follow-on currently awaiting independent specification verification before any separate implementation authorization.

## DQ-TRAIN-001K UI polish and route selection

The owner completed a live TornPDA-informed [D] design pass and froze DQ-TRAIN-001K on 2026-10-01. The spec defines Midnight Ledger/Dark Terminal visual tokens, true modal ownership above Torn document chrome, Plan/Options/Advanced information architecture, touch-safe/stale/confirmation/research-gate UX, structured Advanced and compact HUD. It also recognizes that user-selectable alternatives are not presentation-only: the canonical pure planner must expose a deterministic bounded route-option set. The UI may select an exact route fingerprint but may not rerank, hybridize or simulate candidates. Manual selection is ephemeral, cannot bypass H1/H2, and re-scopes selected-plan inventory confirmation.

For booster optimization, 001K preserves the pre-use threshold/checkpoint rule. If five eDVD uses are currently legal and modeled, the fifth unit may expose canonical marginal-final-booster evidence. If four uses reach the threshold and another item is only possible after a later checkpoint, that fifth is conditional and its gain is not forecast from stale state; the Advisor must refresh/replan after observation.

## Current DQ-TRAIN-001K implementation gate

PR #136 passed independent [V] at `0b17df647129634675913b8f7c9ad2844986609c` and merged as `main@b8474253237e63485100fdcc51b2cb82530d2efc`. Separate owner [B][WORK] then authorized this amendment. The existing PR #135 branch was reconciled by ordinary two-parent merge `0e435bd1e4f3262e77c72b370e9bf35e64b55bba`, preserving previous head `4067c82c52439e97bb22856ac5e3e451d6a33591` and all 001J product/history evidence.

Tested 0.1.1 product head `6a6cfdaf4097b4d7a4266e325d5e7e67380ad76d` adds canonical routeOptions (maximum seven exact fingerprints, deduplicated accumulated roles and supported preparation families), canonical marginal-final-booster metadata, ephemeral exact player selection with route-scoped inventory proof clearing, staged same-epoch Apply & Replan, and the frozen Midnight Ledger Plan/Options/Advanced/modal/HUD presentation. Historical objective winners remain unchanged; adapters and frozen 001J/001K specification/fixture bytes remain unchanged. No new endpoint, price source, durable key, gameplay action, authority TTL, polling or observer.

Automated PASS: 162 existing canonical Training tests, 67 runtime/UI/build tests, 54 polish tests including all 46 K cases; 283 focused / 520 full, 21 suites; all 34 J cases; deterministic regeneration, source hashes, deliberate drift rejection, VM parity and four-quote guard. [Implementation checkpoint](../../chapters/dq-train-001/RUNTIME-UI-BUILD-CHECKPOINT-001J.md) contains exact commands, privacy boundaries, manual checks and rollback. Prior owner 001J smoke is live evidence; the new 001K modal/route/UI implementation is synthetic-tested only. Next: repeated owner TornPDA and desktop smoke, independent implementation verification, then a separate owner merge decision. H1/H2 remain OPEN. Same PR #135 remains draft/open/unmerged/unreleased.
