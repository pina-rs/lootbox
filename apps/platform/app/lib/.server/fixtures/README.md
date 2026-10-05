# Catalog fixtures

Used when `CATALOG_FIXTURES=true` (end-to-end tests only) and by unit tests.

- `prestocks.json` and `backed.json` are trimmed recordings of the public PreStocks and Backed APIs (2026-09-26).
- `jupiter-search.json`, `jupiter-price.json`, and `swap-order.json` follow the documented Jupiter Tokens v2, Price v3, and Swap v2 response shapes; their values are illustrative. `transaction` is `null` because a fixture must never carry a signable mainnet transaction.
