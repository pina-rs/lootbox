# Lootbox Playground

A real browser-to-Surfpool workspace for reusable treasury templates, transferable gifts, and animated openings. The frontend uses `LootboxClient` over the generated Pina/Codama ABI. No reward balance or winning outcome is simulated in React.

## Start locally

From the repository root:

```sh
devenv shell
install:all
build:program
build:test-programs
pnpm playground:rpc
```

Leave that terminal running. In a second terminal:

```sh
devenv shell -- pnpm --dir apps/web dev
```

Open `http://127.0.0.1:5173`. The control plane must run on its default port, 8898. Allowed browser ports are 5173 and 4173. The UI does not fall back to fake data if the local service is unavailable.

## Try the full journey

1. Choose **Workshop**. The default drop contains eight 0.1 SOL bundles, four 100-token bundles, and one bundle containing 1 SOL plus two unique NFTs. Equal per-copy weights produce initial odds of approximately 61.54%, 30.77%, and 7.69%.
2. Edit the name, optional metadata URI, optional earliest claim date, quantities, amounts, or weights. The preview totals 1.8 SOL, 400 test tokens, and two NFTs for the default drop. Fees and account rent are additional.
3. Choose **Fund treasury & seal**. The browser creates fixed-supply test prizes and an immutable Token-2022 box mint, funds the program's escrow accounts, and seals the template. This requires several transactions.
4. Under **Send a little suspense**, leave the prefilled recipient test wallet or enter another local address, choose a count, and **Mint a gift**. Minting stops when capacity is exhausted or a prize tier has been depleted.
5. Choose **Open a gift**. Burning and the oracle commitment are atomic. The local proof is then verified by the test oracle, and the prize allocation is recorded in FIFO order.
6. Choose **Reveal your winnings**, then **Claim your winnings**. The animated reveal does not decide the outcome. Claims deliver every recorded asset to the recipient's wallet; the manifest updates as prizes leave inventory.
7. Expand **Recipient test wallet**, **Inspect assets**, or **Transaction trail** to inspect addresses and receipts. The default mint is an interchangeable zero-decimal Token-2022 token, not an individually unique NFT.

For a short deterministic inventory test, set the first two bundle quantities to one, mint all three boxes before opening, then open all three. Every bundle will be won exactly once, in a random order.

## Recovery and time locks

- A draft saves its stable id and test signers before the first transaction. If funding fails, reload and choose **Resume funding & seal**. Completed assets are read from chain and not funded twice. **Reset creator test SOL** restores the creator to 100 test SOL so an interrupted deposit can resume.
- If proof transport fails after the burn, **Resume opening** uses the existing receipt. Reloading after allocation restores **Reveal your winnings**. A failed claim retains its fixed allocation and per-asset delivery mask.
- Date inputs use the browser's local timezone; on-chain enforcement uses Unix seconds from Solana's Clock. A box can be transferred before its unlock date. Enter a destination in the dispatch form and expand **Transfer gifts you already hold** to transfer from the recipient test wallet.
- Do not use time travel across epochs to certify liveness: Surfpool 1.5 has a documented Clock-slot limitation. A missing or expired production oracle proof is **not** solved by the local retry flow.

## Test-only boundary

The browser creates two disposable wallets, creator and recipient, and stores their seeds on this origin in localStorage. Never import real keys or fund these wallets on a real network. Seeds are not encrypted. A new service instance creates a new namespace; restarting Surfpool destroys its old test state. Clearing browser storage loses saved wallet/draft access.

The UI refuses remote RPCs and mismatched program IDs. All assets and oracle proofs are local test fixtures. It supports SOL, newly created classic test tokens, and basic one-of-one NFTs; it does not import arbitrary NFT standards, connect production wallets, or provide a public hosted backend.

Probabilistic undercollateralization remains an explicit next reserve policy. This UI currently enforces only finite full backing; it does not pretend a percentage buffer guarantees payouts. See [v2 economics and remaining scope](../../docs/treasury-templates.md) and [security reasoning](../../docs/security-templates.md).

## Verification

After building both SBF programs:

```sh
devenv shell -- pnpm --dir apps/web test
devenv shell -- pnpm --dir apps/web test:e2e
devenv shell -- pnpm --dir apps/web build
```

Playwright starts Vite and the local control plane when needed. Tests cover desktop and Pixel 7: all mixed prizes reaching real RPC wallet balances, oracle transport failure/reload recovery, partially funded draft resumption, pre-unlock transfers, and offline state. The mobile project also respects reduced-motion preferences. The default interaction retains keyboard focus rings, live status/error announcements, and a single crate-centered opening/reveal animation.
