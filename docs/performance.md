# Performance and scaling

The protocol keeps prize accounting on chain and fully collateralized. That makes its safety properties easy to explain, but it also makes the shared treasury state the primary throughput limit.

## Hot paths

| Path        | Shared writable accounts                                          | Practical consequence                                            | Current mitigation                                              |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Request     | Treasury, holder box ATA, opening, oracle accounts                | Requests for one treasury serialize on its inventory counters    | Use multiple independent treasuries for very large campaigns    |
| Fulfill     | Treasury, opening, oracle accounts, optional service vault        | Oracle and treasury contention; external CPI dominates compute   | Atomic SDK `settle`; bounded creator-funded bounty              |
| Allocate    | Treasury, opening, selected bundle, optional service vault/result | Every allocation updates the same finite inventory and FIFO head | Bounded scan of the compact active prefix, up to 1,024 slots    |
| Claim       | Opening and selected bundle plus adapter accounts                 | Complex NFT adapters can make transactions account-heavy         | Per-asset claim bits; SDK size/account-bounds each atomic batch |
| Create/fund | One bundle at a time plus asset programs                          | Large manifests require several creator signatures               | Resumable draft state and idempotent chain reads                |

## Hard limits

- 1,024 active bundle definitions per treasury.
- Four assets per bundle.
- `u32::MAX` total bundle copies.
- One indivisible Token-2022 box per bundle copy.
- FIFO allocation per treasury, so scarce inventory cannot be double-spent or reordered after results are known.

The bounded inventory prefix makes selection cost predictable. A new treasury stores no unused inventory slots and grows by eight bytes per activation, but a fully populated treasury still reaches 8,740 bytes. RPC consumers should use data slices or an indexer for discovery instead of repeatedly downloading every account.

## Ecosystem-scale topology

Do not route the entire ecosystem through one treasury. The scalable unit is a treasury series:

```text
project / campaign / season
          |
          +-- treasury A -- fixed box mint A -- FIFO A
          +-- treasury B -- fixed box mint B -- FIFO B
          +-- treasury C -- fixed box mint C -- FIFO C
```

Independent series execute in parallel because they do not share writable inventory. A project can shard by season, collection, geography, reveal window, or inventory size while keeping every mint fungible within its own locked series. A universal registry or indexer should stay read-only; putting a global writable registry in every instruction would recreate the bottleneck.

## What to measure before adding protocol sharding

1. Compute units and account-data bytes for the largest supported bundle and each external NFT adapter.
2. Successful settlements per slot for one treasury and for many treasuries.
3. Oracle proof latency, expiration rate, relayer inclusion rate, and bounty efficiency.
4. RPC time to discover treasuries, fetch up to 1,024 bundle accounts, and refresh live odds.
5. Transaction size and address lookup table use for mixed four-asset claims.
6. Failure rates by adapter, especially NFT transfer rules, Core plugins, and compressed-NFT proof depth.

Only introduce inventory lanes after measurements show that a single series needs more throughput than FIFO allows. Lanes change fairness semantics because they create several depletion pools; they must be visible in the box identity and locked manifest rather than hidden as an implementation optimization.

## Operational recommendations

- Index program accounts and materialize current odds off chain; always treat program state as authoritative when submitting.
- Keep proof fetchers and transaction senders separate, with durable queues and idempotent opening-address keys.
- Use several RPC providers, explicit commitment policies, simulation, priority fees, and alerting for the oldest FIFO head.
- Pre-resolve dynamic NFT accounts immediately before claim; cached proofs and authorization-rule accounts expire.
- Let the SDK split mixed prize delivery and resume from the current claim mask. Compressed transfers are capped at 16 supplied proof nodes on chain; configure sufficient tree canopy rather than relying on an address lookup table to bypass that account-count policy.
- Cap initial treasury value and supply, then increase only after observed load and adapter compatibility are stable.
