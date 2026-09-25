# Lootbox web

Two surfaces share one static Vite build:

- `/` is **Unlisted**, the public recipient site: a free series of Solana boxes with tokenized pre-IPO stock inside. Connect a Wallet Standard wallet, see your boxes and live odds, send a box to a friend, and after the reveal date press and hold the cartoon chest to open one and claim the prize.
- `/playground` is the local creator workshop described below.

Static hosts must rewrite unknown paths to `index.html` so `/playground` resolves (Vite's dev and preview servers already do).

## Recipient site

Configure it with Vite environment variables at build time:

| Variable              | Meaning                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `VITE_SOLANA_CLUSTER` | `localnet` (default), `devnet`, or `mainnet`.                                                      |
| `VITE_RPC_URL`        | RPC for devnet/mainnet. Defaults to the public endpoint. Localnet reads it from the control plane. |
| `VITE_TREASURY`       | The locked series (template) address. Without it the page shows the planned lineup.                |

On localnet, `?treasury=<address>` overrides `VITE_TREASURY` so a series made in `/playground` can be opened from `/`. Public clusters ignore the query string.

Opening burns one box and commits Switchboard randomness, waits for the oracle's reveal, settles the FIFO queue up to that opening, then plays the reaction for the recorded result. The flow is written against `OracleTransport` in `src/launch/oracle.ts`. Localnet injects the Surfpool mock oracle (`localOracle` in `src/lootbox/playground.ts`). Devnet and mainnet use `createPublicOracle`, the single wiring point to replace with `createSwitchboardOracle` from the SDK once `feat/switchboard-gateway` merges; until then public clusters explain that opening is not wired yet and never burn a box.

Prize logos and prices come from PreStocks. The API sends no CORS headers, so the app tries it and falls back to `src/launch/prestocks-snapshot.json`, refreshed with `node tools/snapshot-prestocks.ts`. The cartoon chest clips in `public/animations/cartoon-chest/` are derived from `assets/lootbox-reveals/build/cartoon-chest/` (720 px VP9 WebM with alpha, H.264 MP4 fallback, WebP stills).

## Creator playground

A browser-to-Surfpool workshop for fixed-supply reward treasuries, transferable whole boxes, pre-reveal market analysis, and animated openings. The React app sends real local transactions through `LootboxClient`; it does not fabricate balances or outcomes.

## Start locally

From the repository root:

```sh
devenv shell
install:all
build:program
build:test-programs
pnpm playground:rpc
```

Leave that process running. In a second terminal:

```sh
devenv shell -- pnpm --dir apps/web dev
```

Open `http://127.0.0.1:5173/playground` for the workshop, or `http://127.0.0.1:5173/?treasury=<address>` for the recipient site. The control plane defaults to port 8898. The UI fails visibly if the service is missing; it never swaps in fake client state.

For live catalog results, set these only on the server process:

```sh
export JUPITER_API_KEY="your-key"
export DAS_RPC_URL="https://your-das-rpc.example"
pnpm playground:rpc
```

The browser never receives either credential. Without a Jupiter key, the token picker shows a small labeled fallback list. Without DAS, wallet assets show an unavailable state and manual entry remains usable.

## Creator journey

1. Open **Workshop**. The default manifest contains eight 0.1 SOL tickets, four 100-token tickets, and one bundle with 1 SOL plus two one-of-one test NFTs. Its initial odds are 61.54%, 30.77%, and 7.69%.
2. Set the name, optional permanent metadata URI, and future reveal date. The date control separates calendar, time, and browser timezone, shows the pre-reveal trading window, and includes 24-hour, three-day, and next-Friday shortcuts.
3. Compose one to 1,024 prize bundles. A bundle has one to four assets and a copy count; every copy is one equal ticket. There are no weights. Bundles containing a unique NFT have exactly one copy. The treasury account grows by eight bytes when each bundle activates, so an early draft pays only for its live prefix instead of the full limit.
4. Use **Add asset to bundle** to search Jupiter Tokens, inspect the creator wallet through Metaplex DAS, choose native or local fixtures, or enter an address manually. Source, verification, asset standard, and exact ID remain visible. To add a PrizePool, open **Build PrizePool** and select immutable compressed NFTs from one Bubblegum tree. The composer shows the ordered deposit list, transaction count, custody boundary, and entropy rule before it refreshes every proof.
5. Choose **Fund & publish treasury**. Each bundle is staged, fully funded, and activated in sequence. Activation alone changes odds/revision/capacity. Multiple creator-signed transactions are expected.
6. If funding is interrupted, reload and **Resume funding**. Confirmed steps are read from chain. **Reclaim staged draft** returns assets in only the unpublished tail and closes it; already active history stays immutable.
7. Select a creator-owned live treasury and choose **Add prizes to this treasury**. The console shows its revision, published bundles, remaining tickets, and pending openings. New fully funded bundles publish as later revisions.
8. Review the exact equation between funded bundle copies and box supply, accept the irreversible-lock disclosure, then **Mint & lock treasury**. Every missing box is minted to the creator and mint authority is revoked in that transaction. No additions or openings can precede this lock.
9. Distribute whole boxes from the creator wallet. The market desk accepts explicit token/NFT valuations, calculates remaining EV, previews integer-only constant-product trades, and exports a checked Raydium CPMM deployment manifest. It does not submit a mainnet transaction from the local test wallet.

Catalog choices are mirrored into disposable local assets so the sandbox never tries to transfer mainnet property. A local PrizePool creates a test tree and transfers each selected leaf to its pool PDA in a separate resumable transaction. Production SDK callers use live ownership and proof accounts for classic SPL, safe Token-2022, standard Token Metadata NFT, Core, compressed-NFT, and PrizePool adapters.

## Recipient journey

1. Select a treasury. The manifest shows fixed on-chain inventory, current odds, bundle types, bundle copies, exact supply, reveal time, box balance, and pending queue.
2. Before reveal, transfer or trade the identical zero-decimal box token. After reveal, **Open a gift**. One box is burned atomically with a fresh oracle commitment, and the receipt snapshots the locked treasury revision and eligible bundle prefix.
3. Proof verification and FIFO allocation record the prize independently of animation. Reloading or **Resume opening** continues from the receipt; it never samples again.
4. **Reveal your winnings**, then claim. Every asset is delivered to the receipt recipient and tracked with its own claim bit.
5. **Close receipt & recover rent** after all assets arrive.

No bundle can be added after the market lock. A depleted tier becomes 0%; each win updates the odds and remaining EV of every unopened box.

## Recovery and safety

- A funding draft persists its template ID, box-mint signer, reward signers, append start index, and input before the first transaction. Resume compares those values with chain state and fails closed on mismatches.
- A failed claim retries the same allocated asset. It cannot reroll or redirect.
- After 300 unrevealed slots, only the FIFO-head recipient may **Forfeit & unblock queue**. The burned box is not returned and no prize is consumed. This is intentional: returning it would let somebody inspect an unfavorable off-chain proof and reroll.
- The creator pays treasury changes, exact issuance, and locking. The box owner pays burn/open in this UI. Program verification, allocation, and claim calls remain permissionless for a sponsored relayer.
- Transaction progress, signatures, fees/account-rent context, locked actions, validation errors, API degradation, and local-only warnings are visible in the interface.

## Test-only boundary

The app accepts only loopback origins/RPCs, expected program IDs, and the control plane's test marker. It creates two disposable browser wallets and stores their unencrypted seeds in origin-scoped localStorage. Never import real keys or fund those addresses on a real network. Restarting Surfpool destroys its old chain state; clearing browser storage loses saved local signers.

The oracle and Bubblegum programs are test-only ABI fixtures. The Bubblegum fixture enforces exact leaves, changing mock roots, and owner-signed transfers; it does not implement real concurrent Merkle proofs, canopy, changelog fast-forwarding, or canonical tree-config derivation. Jupiter and DAS results are discovery metadata, not endorsements. This build is not approved for real-value deposits.

## Verification

After building both SBF programs:

```sh
devenv shell -- pnpm --dir apps/web test
devenv shell -- pnpm --dir apps/web build
devenv shell -- pnpm --dir apps/web test:e2e
```

Playwright covers desktop and Pixel-sized layouts. `e2e/launch.spec.ts` drives the recipient site with an injected Wallet Standard test wallet (a fresh local keypair that signs in the test process) and local stand-ins at the real PreStocks mint addresses: landing and disclosures, live odds, balance, sending, the pre-reveal lock, hold-to-open, keyboard hold with reduced motion, skip, oracle outage recovery without a second burn, and claims checked against token balances, with axe checks and no console errors. `e2e/open-lootbox.spec.ts` covers the playground: mixed prize delivery to real local balances, reload and recovery, partial funding, time locks, transfers, offline state, and reduced motion. Component tests cover PrizePool tree locking, immutable admission, ownership refresh, proof refresh, and transfer-plan presentation. See the [treasury protocol](../../docs/treasury-templates.md), [PrizePool reference](../../docs/prize-pools.md), and [security notes](../../docs/security-templates.md).
