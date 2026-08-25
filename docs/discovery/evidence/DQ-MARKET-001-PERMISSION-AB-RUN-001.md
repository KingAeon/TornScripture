# DQ-MARKET-001 — Permission A/B Run 001

Status: **LIVE VERIFIED / SANITIZED**

Date: 2026-08-25

Endpoint under test:

`GET /v2/market/206/itemmarket`

Official endpoint classification during the chapter: Public access key, Stable, globally cached.

## Question

For a deliberately narrow Custom key that reports broad `access.level: 0`, is the Market `itemmarket` capability usable when that exact selection is absent, or must the Custom key explicitly include it?

## Safety

- Raw API key not retained.
- Generated Swagger curl/authorization material not retained.
- Key-owner user/faction/company identifiers are omitted because they are unnecessary to the permission conclusion.
- No Torn gameplay action or accounting mutation occurred.

## A-side — `market:itemmarket` absent

Sanitized `/key/info` facts relevant to the test:

```json
{
  "selections": {
    "market": ["timestamp", "lookup"],
    "torn": ["timestamp", "lookup", "items"]
  },
  "access": {
    "level": 0,
    "type": "Custom",
    "faction": false,
    "company": false
  }
}
```

Call:

`GET /v2/market/206/itemmarket`

Observed Torn response:

```json
{
  "error": {
    "code": 16,
    "error": "Access level of this key is not high enough"
  }
}
```

A-side disposition: **FAIL AS EXPECTED FOR MISSING CUSTOM CAPABILITY**.

## B-side — `market:itemmarket` explicitly added

The Custom key was changed only to include the required Market capability while retaining the catalog `torn:items` capability used by this chapter.

Sanitized `/key/info` facts:

```json
{
  "selections": {
    "market": ["timestamp", "lookup", "itemmarket"],
    "torn": ["timestamp", "lookup", "items"]
  },
  "access": {
    "level": 0,
    "type": "Custom",
    "faction": false,
    "company": false
  }
}
```

The same Xanax Item Market endpoint then returned a valid Item Market response including:

- item ID `206`;
- name `Xanax`;
- Item Market `average_price`;
- listing rows;
- `cache_timestamp`;
- `cache_delay: 30`;
- pagination metadata.

B-side disposition: **PASS**.

## Conclusion

For this controlled Custom-key test:

- absence of exact Market → `itemmarket` correlated with Torn error 16;
- adding exact Market → `itemmarket` made the endpoint usable;
- broad key level remained `0 / Custom`.

Therefore TornScriptures must not validate this capability by broad access level alone. An intentionally narrow Custom key needs the actual capability required by the feature.

## Important boundary

Do not turn this into a universal rule that every Public endpoint must appear by exact name in `/key/info` before it can work.

DQ-KEY-001 separately established that the Public faction-members endpoint succeeded while `members` was not enumerated in that Custom key's Faction selection array.

The safe architecture lesson is capability-specific validation:

- private/custom-grant behavior may use `/key/info` exact-selection evidence plus functional validation where appropriate;
- Public endpoint behavior must preserve official contract evidence and observed capability behavior rather than assuming one universal enumeration rule.

## Product effect

None.