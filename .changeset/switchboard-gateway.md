---
lootbox_sdk_typescript: feat
---

# Add a Switchboard On-Demand oracle transport

Add `createSwitchboardOracle` for real devnet and mainnet randomness: it selects a verified oracle with a fresh heartbeat from the queue, derives the per-randomness lookup-table, program-state, and oracle-stats accounts, and fetches the reveal proof from the bound oracle's gateway with typed errors and bounded backoff. `requestOpen` now accepts an accounts resolver, because real Switchboard derives the lookup table from the fresh randomness address and its `recent_slot`, and it reads that slot at `finalized` commitment so the lookup-table program always finds it in `SlotHashes`.

`createTemplate` accepts an optional box metadata `symbol` (default `LOOT`), and `accountsFor` retries while a fresh commit is not yet visible at `confirmed` commitment.

Add a settlement relayer script that reveals, allocates, and optionally claims abandoned openings in FIFO order without ever forfeiting them.
