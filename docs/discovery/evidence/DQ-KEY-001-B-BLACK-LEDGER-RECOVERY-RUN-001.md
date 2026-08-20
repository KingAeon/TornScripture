# DQ-KEY-001-B — Black Ledger Recovery-Only Permission Run 001

Status: **PARTIAL PASS / TRADE LIST ACCESS LIVE-CONFIRMED / DETAIL + CATALOG STILL OPEN**

Date: 2026-08-20

## Safety note

The owner supplied Swagger screenshots from the controlled test. Raw API key material is not copied, retained, quoted, or committed in TornScriptures evidence. Screenshots are not committed.

## Intended temporary custom grants

- User → `trades`
- User → `trade`
- Torn → `items`

The test intentionally excludes `user:inventory`, `user:itemmarket`, and `user:log`.

Torn may also report baseline/default selections such as `profile`, `timestamp`, `lookup`, `info`, or `log`; these are not treated as evidence that broader private capabilities were intentionally granted.

## `/key/info` evidence

Observed live Swagger response:

- HTTP 200
- `access.type`: `Custom`
- `access.level`: `0`
- `access.faction`: false
- `access.company`: false
- Torn selection array visibly includes `items`

The screenshots supplied for this stage did not preserve the complete User selection array, so direct retained evidence for both `trades` and `trade` in `/key/info` is not yet complete. Functional endpoint behavior below independently proves `user:trades` is usable under this key.

## `/user/trades` evidence

Swagger exposes `cat` as an explicit choice between:

- `ongoing`
- `finished`

This matches the current v2 contract and is recorded because it confirms the intended category boundary directly in the live interface.

### Ongoing run

Request:

`GET /v2/user/trades?cat=ongoing&limit=100&sort=DESC`

Observed:

- HTTP 200
- valid response structure
- `trades: []`

An empty ongoing list is a valid success, not a permission failure.

### Finished run

Request:

`GET /v2/user/trades?cat=finished&limit=100&sort=DESC`

Observed:

- HTTP 200
- real completed trade rows returned
- trade `7210016` present
- trade `7200716` also visible in the retained evidence
- participant identity and completion/timestamp fields populated

Trade `7210016` is the previously owner-tested ordinary cash-for-items trade already used for stable Black Ledger recovery verification, making it an appropriate low-risk detail candidate for this permission test.

## Current conclusion

The `user:trades` capability is **live-confirmed** under the recovery-only Custom key configuration without `user:inventory` or `user:itemmarket`.

This is direct evidence that Black Ledger's finished-trade discovery does not require the broader inventory/listing permission bundle currently associated with the monolithic IMM key prompt.

## Remaining evidence before KEY-001-B can pass

1. Run `GET /v2/user/7210016/trade` and confirm HTTP 200 with the expected detailed trade/item structure.
2. Run `GET /v2/torn/items` and confirm HTTP 200 under the same key.
3. Preferably retain the sanitized `/key/info` User selections section showing both `trades` and `trade`.
4. After API boundary proof, test stable IMM v0.19.36 with this same capability-limited key and stop at non-mutating review. Do not press Record sale.

## Product effect

None. This evidence does not authorize changing stable key prompts, recovery behavior, or accounting mutation.