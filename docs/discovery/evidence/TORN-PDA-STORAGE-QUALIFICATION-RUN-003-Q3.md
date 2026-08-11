# TornPDA Storage Qualification Evidence — Run 003 / Q3

Status: **PASS — default-quota rejection, atomicity, existing-data integrity, and cleanup**

Date: 2026-08-11

Probe: `TornPDA Storage Qualification Probe v0.1.1`

Phase: `Q3 default-quota rejection and atomicity`

This file preserves the owner-provided live qualification result from the tested Android/TornPDA environment. It is discovery evidence only and does not authorize a production storage migration.

## Baseline

- `PDA_storage` available: yes
- cleanup before run: 0 keys deleted, 0 errors
- baseline usage: 0 bytes
- observed quota: 10,485,760 bytes (10 MiB)

## Controlled fill

The probe deliberately filled only its own disposable native-storage namespace to approximately 80% of the default per-script quota.

Eight bounded fill writes completed successfully.

| Index | Expected delta | Observed delta | Accounting exact | set ms |
| ---: | ---: | ---: | --- | ---: |
| 0 | 1,048,576 | 1,048,576 | yes | 67.3 |
| 1 | 1,048,576 | 1,048,576 | yes | 54.0 |
| 2 | 1,048,576 | 1,048,576 | yes | 48.0 |
| 3 | 1,048,576 | 1,048,576 | yes | 48.8 |
| 4 | 1,048,576 | 1,048,576 | yes | 46.1 |
| 5 | 1,048,576 | 1,048,576 | yes | 41.4 |
| 6 | 1,048,576 | 1,048,576 | yes | 44.3 |
| 7 | 1,048,394 | 1,048,394 | yes | 51.7 |

Every fill operation matched the source-derived byte-accounting contract exactly.

## Single over-quota write

The intentionally oversized `set()` attempt was rejected with:

- error name/message: `QuotaExceeded`
- error code: `QuotaExceeded`
- reported prospective used value: 10,616,888 bytes
- quota: 10,485,760 bytes
- rejected key absent after failure: yes
- actual namespace usage unchanged: yes
- atomic rejection PASS: **true**

The error's `used` field represents the prospective namespace size if the rejected value had been accepted. It does not mean storage actually grew to that amount. The explicit unchanged-usage check confirms the rejected record was not persisted.

## Over-quota `setMany()`

The intentionally over-quota batch was rejected with:

- error name/message: `QuotaExceeded`
- error code: `QuotaExceeded`
- reported prospective used value: 10,616,946 bytes
- quota: 10,485,760 bytes
- first batch key absent after failure: yes
- second batch key absent after failure: yes
- actual namespace usage unchanged: yes
- whole-batch atomic rejection PASS: **true**

This live-verifies that the tested over-quota `setMany()` failed without partially inserting either requested member.

## Existing-data integrity after failures

After both expected quota failures:

- sentinel/control record intact: yes
- all eight successfully written fill records intact: yes
- integrity PASS: **true**

This is important because clean rejection alone would not be enough if failed writes corrupted or mutated pre-existing records.

## Cleanup

- qualification keys deleted: 9
- cleanup errors: 0
- final usage: 0 bytes / 10,485,760-byte quota
- returned to clean Q0 baseline: yes

## Overall result

- observed quota: 10 MiB default
- fill byte accounting exact: yes
- single write rejected atomically: yes
- `setMany()` rejected atomically: yes
- existing records remained intact: yes
- cleanup returned exactly to zero: yes
- aborted: no
- overall summary pass: **true**

## Interpretation

The TornPDA warning that the script had reached its storage limit and that the limit could be increased in settings was **expected behavior for Q3**. The test was deliberately designed around the untouched 10 MiB default quota so that quota handling could be qualified.

Current TornPDA source/settings expose per-script native-storage quota adjustment from the 10 MiB default up to 50 MiB. This run intentionally did not increase the quota because doing so would have changed the condition Q3 was designed to verify.

## Gate decision

**Q3 qualification: PASS.**

Together with Q0 and Q1/Q2, the tested TornPDA environment now satisfies the initial native-storage qualification gate defined for a future non-critical/reconstructible TornScriptures storage pilot:

1. expected default quota and live bridge established from a clean baseline
2. exact byte accounting for Unicode, blob-like, ledger-like, and history-like payloads
3. exact round-trip integrity through approximately 1 MiB realistic payloads
4. successful approximately 1 MiB `setMany()` / `getMany()` behavior
5. control-record integrity during large-value churn
6. deterministic cleanup to zero
7. clean `QuotaExceeded` rejection for a single write
8. whole-batch `setMany()` rejection without partial insertion
9. previously valid records intact after expected quota failures

## Evidence boundary

This does **not** establish:

- behavior under a user-raised 11–50 MiB per-script quota
- behavior at TornPDA's 250 MiB global cap
- concurrent multi-tab write safety (future Q4)
- desktop/userscript-manager behavior
- immunity from TornPDA's explicit Userscript storage → Clear action
- suitability as sole Black Ledger/accounting authority
- authorization for any production storage migration

Architecture action: **none. QUALIFIED / DISCOVERED ONLY.**
