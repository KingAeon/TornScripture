# CLASSIFIER-05 production implementation 01 — draft review candidate

Malformed or parser-incompatible lines in deliberately pasted Trader Book price receipts now reject the entire price capture. The integrated source-complete classifier retains every original role/marker, conserves early malformed quantity atoms and whole names, and reconciles with the unchanged financial projection before admitting the existing writer. A healthy sibling cannot hide a damaged row. Supported positive receipts and zero-only checks retain their existing writer/arm behavior.

This is a draft B candidate, awaiting separate independent Q, V1, owner desktop/TornPDA acceptance, V2/Ledger Integrity and explicit merge/release authorization. No live Torn account or device acceptance is claimed.

## Authority and source identity

Owner assignment: https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6516908829

Starting HEAD/sole candidate parent: `9ce77e287a14b376cccb5079ee0c87167014c7eb`; starting tree `47adb23d807d61e36ad544acf9a7a3315d2655ac`. Main/base remains `529400117f727da31a058b7941c29693f40bb1b3`. Existing branch: `agent/bl-r01b-v22-trader-refresh-implementation`, PR139 draft/unmerged; Issue142 open. Exact review commit/tree and evidence checksum are in the consolidated B verdict.

Verified proof: [RC4-CORRECTION-03 PASS](https://github.com/KingAeon/TornScripture/pull/139#issuecomment-6516781453), archive10,043,408 bytes, SHA-256 `1280da57adc16f59bf7beb2420edb335f2758e1f893c5525b4e6e07026baa3ae`,231 payloads/6849 manifest entries;14326 frozen inputs and prior14265 freeze verified. All failed proof generations remain failed and unchanged. The prototype PASS did not establish runtime acceptance; the native tests here load the integrated candidate.

The five existing **0.19.44** metadata/app/ownership identifiers remain consistent for this **unreleased draft amendment**, identified by its exact Git SHA. The assignment permits a possible0.19.45 candidate rather than requiring a release now. Original maintained version assertion remains unchanged; no original test assertion was changed to permit a bump. This is not acceptance or release of the older rejected0.19.44 tree, and no0.19.45 release is claimed. Versioning for a release remains an owner-controlled later step.

## Minimal implementation seam and invariants

Only two existing function bodies change: `priceItemsFromParsedReceipt` gains an optional ephemeral deliberate-text decision, and `linkPendingTraderToReceiptAudit` computes/passes that decision. Five side-effect-free role/certificate/field/reconciliation/admission functions are added. The structural stage uses the COMPLETE untrimmed user input, preserving UTF-16 spans, CRLF, marker inventories, whole item ownership, rejected alternatives and malformed fences. The financial parse still uses its original unchanged semantics.

The decision is computed before any persistent write. Rejection is raised at the existing price-admission point after ONLY the original frozen R8 counterparty linkage/timestamp allowance, before any Book/counter/price/completion/arm change. This preserves original historical accounting assertions. Admitted text uses unchanged `prepareTraderCapturePriceItems` after complete independent source validation/exact legacy reconciliation; the general helper default and JSON/page/provider callers keep their original path.

No edits to financial parsers, prepare function, shared writer/native lock/arm/completion protocol,21 protected accounting bodies, Ledger/FIFO, Report/HEV/launcher, original tests/fixtures, storage keys/schemas, permissions/network, listeners/timers/observers or unrelated UI. Valid positives retain existing canonical item-list replacement; rejected/zero-only receipts retain exact prior canonical/legacy/opaque quotes. Exactly30 receipt-only Box7 policy supersessions remain additive; raw rows stay structurally positive while mismatched legacy projections reject. No31st supersession.

## Validation and correction transparency

Original source-hashed external403 and UI231 are run unchanged. The baseline was2475 maintained PASS,351/403,209/231 and56/62. Original archived failed05 remains401/403, with historical sensitivity RED results separate from candidate acceptance.

The first integrated implementation passed403/403,231/231 and its new4447-case suite, but frozen110 found two missing whole-field witnesses: `bad x Other Item @ $1234 = $2468` in both sibling orders. The pure role eligibility now establishes a separator-bounded operator with a real monetary tail before validating the WHOLE quantity atom, including unsupported multiword content. No item/word blacklist, protected financial change or policy amendment. That is the single bounded implementation correction. The first source/TAP/state evidence is preserved.

An initial multi-file launcher omitted `--test`, executed only233 tests and was never treated as2475 acceptance. The final launcher explicitly uses `--test` and the unchanged15000ms timeout. An ancillary negative-test loop starting from an already failed writer was not credited; a separate oracle suite proves a pristine passing rejection first, then detects seven one-field mutations with specific failure causes across12 contexts (84 detections).

New native acceptance covers original249/novel459/receipts939 with the exact30 overlay, independent150, discriminators39, original403 token264/valid33, all4596 both-order rejection host checks including60 overlay host checks,1878 receipt host checks, six positive and six zero cases across both orders/U-C-E, repeat/reload/fault recovery and orthogonal negative/source-coverage controls. An additional2299-test uninstrumented native trace audit validates the complete2298-source rejection corpus,272200 span references and4596 row inventories. Original frozen110/external89/provider25/EVR9 and quantity-six are separate gates. Full original62 is reported honestly; six historically unresolved `]/!` negatives are not rewritten or skipped.

The new adapter uses the unchanged native host with productionEvents:true/testMode:false and real Web Locks. A SEPARATE VM test copy has one additive writer-call observer, without changing decisions, return flow or stored data. The committed userscript remains uninstrumented; original403/231/maintained/historical suites run that unmodified candidate directly. Observer/source hashes and limitations are in evidence. No detached model is imported as a runtime acceptance oracle: tests use immutable truth tables and an independent coverage oracle.

A resumed final combined run of `node --test --test-reporter=tap --test-timeout=15000 tests/*.test.js` passed **9233/9233**, including all2475 original maintained assertions and6758 additive admission/sensitivity/source-trace tests, with zero skips/cancellations/TODO. The candidate source/fixture hashes still match the retained pre-execution freeze. A fresh remote original-tree comparison verified234/234 blobs and233 unchanged original paths; original source and archive/freeze provenance were rehashed. The earlier workspace and pre-edit results are reused transparently rather than represented as newly authored work.

Complete raw before/after host snapshots are persisted before assertions. Long strings use lossless SHA-256-addressed blobs to avoid duplicate Books/Ledgers. Each `__c05_blob` reference resolves to the exact UTF-8 bytes in its run's `blobs/` directory; a decoder and full manifest are supplied. Both raw array order and stable-ID views remain auditable. Only the R8 Ledger allowance may differ on REJECT.

## Independent Q handoff — not execution or authorization

After owner review, a different session/reviewer should materialize the exact candidate head reported in B, independently verify its parent/tree and archive manifests, and rerun unmodified original403/231/62/110/89/25/EVR9/six plus2475 maintained and the added native suites at original timeouts. Do not replace original assertions with the owner overlay; the overlay only amends exactly30 synthetic receipt expectations.

Independently challenge the port and new separator-bounded malformed-field correction using new source-complete cases, both trader orders/U-C-E and CRLF sibling orders. Verify selected/neighbor canonical/legacy/opaque placement by stable ID. Challenge zero/positive/mixed/dedup, true competing operators, early0x2 fences, parser disagreement, incidental prose, numeric/suffix/overflow/money cases, failed storage/rollback, native contention/re-arm, durable completion/reload and R8-only Ledger effects. Reconstruct saved state rather than trusting author totals. Repeat some paths without the writer observer; negative controls must start from a genuine passing baseline and fail for the intended mutation. Inspect all21 protected bodies/19 financial witnesses, metadata/effects and every changed file. A Q handoff does not start Q or waive device/Ledger Integrity/release gates.

## Future owner-controlled desktop and TornPDA Android acceptance

1. Export the current raw Trader Book, Ledger JSON, pending/queue and Report data, record device/browser/TornPDA version and review candidate exact SHA, and keep exports offline. Do not overwrite newer real authority with old diagnostic fixtures. Use an owner-controlled safe receipt-audit context and disposable/synthetic records where supported.
2. Install only the exact isolated review source after owner approval; record visible version and SHA. Verify the Goblin God launcher and existing permissions/native-lock behavior. Work has not performed these steps.
3. Deliberately arm a known selected trader. Record selected/neighbor raw quote/count/last success and arm. Paste a healthy item plus `Other Item × 0x2 @ $1234 = $2468`, both orders; repeat with `bad x Other Item @ $1234 = $2468` and genuine `2 x Other Item x2 @ $1234 = $2468`. Expect truthful not-captured feedback, identical Book/price/count/arm/input and only existing R8 linkage/timestamp allowance; no partial healthy capture.
4. In a controlled record, paste supported `Fixture Item x2 @ $1234 = $2468` or an actual matching supported item. Expect one eligible write/check increment/completion and original arm cleanup, neighbor intact. Repeat/reload/second context must not duplicate the committed capture.
5. With a separately armed disposable record, paste supported zero-only `Fixture Item x2 $0`. Expect check+1 with original quote/last successful capture retained, no successful completion and arm/input retained. Positive+zero mixed receipts reject atomically, count unchanged.
6. Check both array orders where safely representable through supported record operations, text whitespace/Unicode/CRLF, benign prose, correction/retry, native contention/re-arm and storage recovery without touching real purchases/sales. Confirm JSON/page/provider, Report and launcher behavior remain unchanged.
7. Inspect exports before/after, run Ledger Integrity, preserve any mismatch screenshot/raw data and report back. Q/V1/device/V2/Ledger Integrity PASS and separate exact-SHA merge authority are still required. Do not merge on synthetic results alone.

## Rollback

Main was not changed, so this candidate is not deployed through the normal update channel. The original parent remains immutable; no storage/schema migration exists. Preserve newer authority and raw exports. Any branch rollback, reinstall, production revert or data reconciliation requires separate owner disposition; never force-update main, reset raw accounting, restore stale backups or delete failed evidence. Do not perform real Torn gameplay as part of Work validation.
