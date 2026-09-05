# Adoption and launch plan

The strongest positioning is not “another lootbox site.” It is a composable, fully backed reward primitive: one transferable token represents one sealed chance in a finite, auditable prize inventory.

## Product wedge

Start with projects that already distribute rewards but struggle with claim pages, allowlists, and low-engagement airdrops:

- NFT communities running seasonal member rewards;
- games issuing quest or tournament prizes;
- loyalty programs that need sponsor-paid transactions;
- protocols rewarding usage without inventing a bespoke randomness contract;
- creators selling or distributing pre-reveal sealed collectibles.

The differentiator is the visible lifecycle: fund every prize, lock exact supply, trade unopened opportunities, reveal after a shared date, and watch the finite odds change as bundles leave the treasury.

## Ninety-day path

### Weeks 1–3: prove the primitive

- Publish a devnet reference deployment, explorer, TypeScript quickstart, and one small consumer-program example.
- Run an internal adversarial review and external audit intake.
- Recruit three design partners and build their drops manually.
- Instrument treasury funding, lock completion, opening latency, forfeitures, claim failures, and adapter-specific failures.

### Weeks 4–7: prove repeat use

- Launch capped, valueless or low-value community pilots.
- Ship embeddable React UI, webhook/indexer events, sponsored transaction examples, and a settlement service reference.
- Publish manifest hashes, exact supply, prize inventory, live odds, oracle status, and fee sponsorship in a shareable public page.
- Turn every pilot into a technical case study with numbers, not promotional claims.

### Weeks 8–12: open the ecosystem

- Complete audit fixes and sustained devnet soak before any mainnet value.
- Publish generated packages, semantic release policy, verified builds, and an integration compatibility matrix.
- Add templates for quests, Discord/community rewards, tournament chests, and loyalty campaigns.
- Run a builder program with office hours and small integration grants. Reward shipped integrations and tests rather than announcements.

## Distribution

- Lead with a live “treasury x-ray” demo: show all bundles, exact box supply, current EV, and how odds move after each reveal.
- Give partners an embed that says “powered by Lootbox” and links to the locked manifest.
- Publish short engineering content around exact collateral, anti-reroll FIFO, transferable pre-reveal boxes, and CPI-bound immutable results.
- Maintain sample integrations for Pina, Anchor/native Rust, TypeScript, and Flutter/Dart so teams can begin from their existing stack.
- Treat Jupiter and marketplaces as distribution surfaces for locked box mints, not as protocol dependencies. Liquidity should remain opt-in per creator.

## Trust and compliance

Avoid claims that a box is an investment or guarantees a return. Display the finite inventory, changing probability, current remaining expected value, reveal time, oracle/expiry behavior, fees, transferability, and whether a result receipt exists. Require jurisdiction-specific legal review before paid or real-value randomized rewards; age, geography, consumer-protection, gaming, and securities rules can all affect the product.

Do not launch real value until independent audit, live-oracle soak, external asset compatibility, verified deployment, multisig/timelock policy, monitoring, and incident procedures are complete.

## North-star metrics

- Percentage of funded treasuries that reach exact-supply lock.
- Median time from eligibility to settled result.
- Settlement and claim success rate by asset adapter.
- Percentage of boxes transferred before reveal.
- Repeat creators and repeat integrating projects.
- Integrations completed without core-team transaction debugging.
- Zero prize insolvency, redirect, reroll, or duplicate-consumption incidents.

Trading volume is a secondary metric. The primitive succeeds when teams can reliably create rewards and users understand what a sealed box represents.
