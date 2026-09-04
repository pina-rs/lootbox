# Lootbox Playground

A browser-to-Surfpool workshop for append-only reward treasuries, transferable boxes, and animated openings. The React app sends real local transactions through `LootboxClient`; it does not fabricate balances or outcomes.

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

Open `http://127.0.0.1:5173`. The control plane defaults to port 8898. The UI fails visibly if the service is missing; it never swaps in fake client state.

For live catalog results, set these only on the server process:

```sh
export JUPITER_API_KEY="your-key"
export DAS_RPC_URL="https://your-das-rpc.example"
pnpm playground:rpc
```

The browser never receives either credential. Without a Jupiter key, the token picker shows a small labeled fallback list. Without DAS, wallet assets show an unavailable state and manual entry remains usable.

## Creator journey

1. Open **Workshop**. The default manifest contains eight 0.1 SOL tickets, four 100-token tickets, and one bundle with 1 SOL plus two one-of-one test NFTs. Its initial odds are 61.54%, 30.77%, and 7.69%.
2. Set the name, optional permanent metadata URI, and unlock date. The date control separates calendar, time, and browser timezone and includes Now, Tomorrow, and Next Friday shortcuts.
3. Compose one to 256 prize bundles. A bundle has one to four assets and a copy count; every copy is one equal ticket. There are no weights. Bundles containing a unique NFT have exactly one copy.
4. Use **Add asset to bundle** to search Jupiter Tokens V2, inspect the creator wallet through Metaplex DAS, choose native/local fixtures, or enter an address manually. Source, verification, asset standard, and exact ID remain visible.
5. Choose **Fund & publish treasury**. Each bundle is staged, fully funded, and activated in sequence. Activation alone changes odds/version/capacity. Multiple creator-signed transactions are expected.
6. If funding is interrupted, reload and **Resume funding**. Confirmed steps are read from chain. **Reclaim staged draft** returns assets in only the unpublished tail and closes it; already active history stays immutable.
7. Select a creator-owned live treasury and choose **Add prizes to this treasury**. The console shows its version, published bundles, remaining tickets, and pending openings. New fully funded bundles publish as later versions.
8. Under **Send a little suspense**, choose a local recipient and count, then mint. Available count is derived from activated inventory, current supply, pending receipts, and lifetime mints—not a creator-entered maximum.

Catalog choices are mirrored into disposable local assets so the sandbox never tries to transfer mainnet property. Production SDK callers use the selected classic SPL, safe Token-2022, Token Metadata/pNFT, Core, or compressed-NFT adapter with live ownership/proof accounts.

## Recipient journey

1. Select a treasury. The manifest shows latest on-chain odds, remaining copies, version, unlock time, box balance, and pending queue.
2. **Open a gift** after unlock. One box is burned atomically with a fresh oracle commitment, and the receipt snapshots the current treasury version and eligible bundle prefix.
3. Proof verification and FIFO allocation record the prize independently of animation. Reloading or **Resume opening** continues from the receipt; it never samples again.
4. **Reveal your winnings**, then claim. Every asset is delivered to the receipt recipient and tracked with its own claim bit.
5. **Close receipt & recover rent** after all assets arrive.

Bundles added after a box was minted are eligible if they are active when that box is opened. Bundles added after its burn are excluded from that receipt. A depleted tier becomes 0%; other inventory continues to support new boxes.

## Recovery and safety

- A funding draft persists its template ID, box-mint signer, reward signers, append start index, and input before the first transaction. Resume compares those values with chain state and fails closed on mismatches.
- A failed claim retries the same allocated asset. It cannot reroll or redirect.
- After 300 unrevealed slots, only the FIFO-head recipient may **Forfeit & unblock queue**. The burned box is not returned and no prize is consumed. This is intentional: returning it would let somebody inspect an unfavorable off-chain proof and reroll.
- The creator pays treasury changes and minting. The box owner pays burn/open in this UI. Program verification, allocation, and claim calls remain permissionless for a sponsored relayer.
- Transaction progress, signatures, fees/account-rent context, locked actions, validation errors, API degradation, and local-only warnings are visible in the interface.

## Test-only boundary

The app accepts only loopback origins/RPCs, expected program IDs, and the control plane's test marker. It creates two disposable browser wallets and stores their unencrypted seeds in origin-scoped localStorage. Never import real keys or fund those addresses on a real network. Restarting Surfpool destroys its old chain state; clearing browser storage loses saved local signers.

The oracle endpoint is an ABI emulator and does not validate production enclave signatures. Jupiter/DAS results are discovery metadata, not endorsements. This build is not approved for real-value deposits.

## Verification

After building both SBF programs:

```sh
devenv shell -- pnpm --dir apps/web test
devenv shell -- pnpm --dir apps/web build
devenv shell -- pnpm --dir apps/web test:e2e
```

Playwright covers desktop and Pixel-sized layouts, mixed prize delivery to real local balances, reload/recovery, partial funding, time locks, transfers, offline state, and reduced motion. See the [v2 protocol](../../docs/treasury-templates.md) and [security notes](../../docs/security-templates.md).
