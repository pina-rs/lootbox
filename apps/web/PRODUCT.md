# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: recipients of a free launch giveaway, most on phones, many new to Solana. They receive a transferable box token, check what is inside and their current odds, send boxes to friends, and on reveal day open theirs and claim a real tokenized stock to their wallet. Secondary: Solana developers and creators, who use the `/playground` workshop on a local Surfpool network to fund, lock, and distribute series.

## Product Purpose

**Unlisted** (working name; `BRAND` in `src/launch/config.ts`) is a free, fixed-supply series of Solana boxes whose escrowed prizes are real tokenized pre-IPO stocks (PreStocks: SpaceX, OpenAI, Anthropic, Kalshi, Neuralink, Anduril, Figure AI, Polymarket), about £200 split into two £50 and five £20 slices. Success means a recipient can connect a wallet, see their boxes, pass one on, and after the reveal date open one with a press-and-hold chest, watch the recorded result, and claim the stock token.

## Positioning

A giveaway, never a sale: there is no purchase or checkout flow, and copy never says "buy", "bet", or "gamble". Before the reveal date a box is an ordinary token to hold, send, or trade. After it, every holder opens independently: burn box, Switchboard randomness commit, oracle reveal, FIFO allocation, claim. The difference from a generic mint page is the physical opening: holding the chest is the anticipation beat that honestly covers oracle latency.

## Operating Context

Static Vite + React + TypeScript build. `/` is the recipient site; `/playground` is the local creator workshop. Wallets connect through Wallet Standard (Phantom, Solflare, Backpack) and sign through a kit `TransactionSigner`; the app never holds keys. `VITE_SOLANA_CLUSTER`, `VITE_RPC_URL`, and `VITE_TREASURY` choose the network and series. Localnet uses the Surfpool control plane's mock oracle; devnet and mainnet use the Switchboard gateway once it is wired at the single `createPublicOracle` wiring point.

## Capabilities and Constraints

- The animation plays the already-recorded on-chain result. It never chooses the outcome, and the prize card, receipt link, and live region never wait on it.
- Live odds are each bundle's share of remaining boxes read from the locked treasury; depleted bundles stay visible at 0%.
- Prize values are estimates from PreStocks prices. The API is not CORS-enabled, so browsers fall back to a dated snapshot bundled at build time (`tools/snapshot-prestocks.ts`).
- Required disclosures stay on the page: issuer-controlled tokens (freeze/pause, PreStocks issuer transfer fee on claim), geo-restrictions on the underlying tokens, not investment advice, and verifiable Switchboard randomness with explorer links to the opening receipt and transactions.
- An interrupted opening is recovered from chain (unfinished openings bound to the wallet) and never burns a second box.
- Localnet balances, stand-in prize mints, and oracle proofs are test-only and labeled as such.

## Brand Commitments

Unlisted, built on Lootbox by Pina. Playful, tactile, warm. The cartoon chest is the signature object on the public site; the dark mechanical workbench remains the creator playground's identity.

## Evidence on Hand

The protocol and three SDKs are implemented. Playwright drives the full recipient flow (connect, balance, send, pre-reveal lock, hold-to-open, keyboard hold, reduced motion, skip, oracle outage recovery, claim to a token balance) against local Surfpool on desktop and Pixel viewports, with axe checks. No independent audit or real-network oracle soak has completed.

## Product Principles

- Reveal the treasury and the rules, not only the spectacle.
- The hold is honest anticipation: it starts the real transaction and covers real latency.
- Animation presents a recorded result; it never determines the reward.
- Clearly separate test-network stand-ins, planned lineups, and production guarantees.

## Accessibility & Inclusion

Implementation decisions delegated by the user: keyboard-operable controls, visible focus, readable contrast, reduced-motion equivalents, responsive desktop/mobile layouts, and persistent text status for asynchronous transactions.
