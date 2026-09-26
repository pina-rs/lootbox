# @pina-rs/exclusive-nft-art

Art, tiers, and metadata for **Exclusive Lootbox NFTs**: rarity-tiered cartoon chests given to lootbox openers who did not win a main prize.

- **Why it exists:** a losing opening should still hand over something worth showing off. The program draws a tier and three traits on-chain; this package turns those five numbers into a polished poster, an animated reveal, and Metaplex JSON.
- **Why use it:** one pure TypeScript module renders every combination deterministically, with no DOM or Node APIs, so a Cloudflare Worker can serve art straight from the URI. The same vector model drives the Rive reveal, so the still and the animation always match.
- **Use cases:** serving `…/{stem}.svg` and `…/{stem}.json` from a Worker, showing the prize card on the website, rendering review sheets, and rebuilding the Rive reveal.

## The contract

The program writes each NFT's URI as:

```
{base}{tier}-{contents}-{background}-{pattern}-{serial}.json
```

| Field        | Range              | Sets                                           |
| ------------ | ------------------ | ---------------------------------------------- |
| `tier`       | 0–15               | Chest finish, effects, reveal drama            |
| `contents`   | 0–19 (room for 32) | The thing inside                               |
| `background` | 0–11               | The backdrop                                   |
| `pattern`    | 0–7                | The engraving on the wood                      |
| `serial`     | 0 – 2^53−1         | Edition number; also seeds the sparkle scatter |

Catalog indices are append-only. Once a series is minted, reordering an entry or changing a drawing changes the art behind existing URIs, so `test/render.test.ts` pins a hash of every tier's poster.

## Tiers

Default weight for tier `k` is `2^(15-k)`, so each tier is half as likely as the one before; the weights sum to 65,535. The ladder is a joke told in sixteen steps: the chest gets ever more overdressed for what is, at best, a pet rock.

| #  | Tier            | Finish                                | Odds        | Effects                             | Reveal        |
| -- | --------------- | ------------------------------------- | ----------- | ----------------------------------- | ------------- |
| 0  | Painted Pine    | Teal paint on pine, brass straps      | 1 in 2      | none                                | `dust`        |
| 1  | Sunbleached     | Peach paint left too long on a porch  | 1 in 4      | none                                | `dust`        |
| 2  | Barnacled       | Sea-soaked navy planks, verdigris     | 1 in 8      | none                                | `dust`        |
| 3  | Copper Bottom   | Mahogany with hammered copper bands   | 1 in 16     | 2 sparkles                          | `glints`      |
| 4  | Pewter Promise  | Brushed pewter, slate-blue lock       | 1 in 32     | 3 sparkles                          | `glints`      |
| 5  | Cinnabar        | Red lacquer, gilt corners, black lock | 1 in 64     | 4 sparkles                          | `glints`      |
| 6  | Jade Court      | Carved jade with gold and ivory       | 1 in 128    | sparkles, halo                      | `glints`      |
| 7  | Midnight Brass  | Ink-blue ebony with polished brass    | 1 in 256    | sparkles, halo                      | `glints`      |
| 8  | Silverleaf      | Beaten silver leaf, sapphire lock     | 1 in 512    | sparkles, halo                      | `glints`      |
| 9  | Solid Gold      | Solid gold, ruby lock                 | 1 in 1,024  | sparkles, halo, gold rays           | `goldBurst`   |
| 10 | Rose Gilt       | Rose gold with a pearl lock           | 1 in 2,048  | sparkles, halo, gold rays           | `goldBurst`   |
| 11 | Mother of Pearl | Opaline nacre, lilac trim             | 1 in 4,096  | rays, light holographic foil        | `holoShimmer` |
| 12 | Holofoil        | Rainbow holographic foil, chrome trim | 1 in 8,192  | rays, full holographic foil         | `holoShimmer` |
| 13 | Eclipse         | Obsidian with a gold corona           | 1 in 16,384 | corona ring, rays                   | `cosmic`      |
| 14 | Nebula          | Violet stardust lacquer, cyan trim    | 1 in 32,768 | corona, orbiting particles, foil    | `cosmic`      |
| 15 | Event Horizon   | A chest so dense light won't leave it | 1 in 65,535 | corona, accretion disk, 16 sparkles | `cosmic`      |

`src/tiers.ts` holds each tier's palette, witty line, exact effect strengths, and computed `weight`, `probability`, and `odds`.

## Trait catalogs

`src/traits.ts` holds the names and one-line descriptions.

- **Contents (20):** A Moth; One Odd Sock; An IOU for 0 Shares; A Cobweb, Tenant Included; A Dust Bunny; A Rubber Duck; A Sold Out Tag; A Lost Button; A Paper Crown; A Snail; A Crumpled Receipt; The Ghost of a Share Certificate; An Echo; and, new for this series, A Tiny Crab; A Message in a Bottle; A Golden Ticket Stub (Void); A Pet Rock; A Key to Nothing; A Jar of Fireflies; A Lucky Penny (Tails).
- **Backgrounds (12):** Ivory Studio, Dusk, Open Sea, Bank Vault, Meadow, Starfield, Attic, Blueprint, Sunburst, Picnic Blanket, Deep Sea, Velvet Curtain.
- **Patterns (8):** Plain Planks, Woodgrain, Diamond Lattice, Chevron, Rivets, Scrollwork, Waves, Tally Marks.

## Usage

```ts
import {
	metadataFor,
	parseExclusiveNftStem,
	renderExclusiveNft,
} from "@pina-rs/exclusive-nft-art";

// A Cloudflare Worker serving /exclusive/{stem}.svg and /exclusive/{stem}.json.
export default {
	fetch(request: Request): Response {
		const match = /\/exclusive\/([\d-]+)\.(svg|json)$/.exec(
			new URL(request.url).pathname,
		);
		const traits = match?.[1] ? parseExclusiveNftStem(match[1]) : null;

		if (!match || !traits) {
			return new Response("Not found", { status: 404 });
		}

		if (match[2] === "svg") {
			return new Response(renderExclusiveNft(traits), {
				headers: {
					"content-type": "image/svg+xml",
					"cache-control": "public, max-age=31536000, immutable",
				},
			});
		}

		return Response.json(metadataFor(traits, {
			base: "https://nft.example/exclusive/",
			externalUrl: "https://pina-rs.github.io/lootbox/",
		}));
	},
};
```

- `renderExclusiveNft(traits)` returns a standalone 1024² SVG string (at most about 46 KB across every combination). It throws `RangeError` for out-of-range traits.
- `metadataFor(traits, { base, externalUrl })` returns Metaplex JSON with `image` at `{base}{stem}.svg`, `animation_url` at `{base}play.html?nft={stem}`, and `Tier`, `Finish`, `Contents`, `Background`, `Pattern`, `Serial`, and `Odds` attributes.
- `parseExclusiveNftStem(stem)` validates a URI stem and rejects padded or out-of-range fields, so each NFT has exactly one URI.
- `@pina-rs/exclusive-nft-art/exclusive-nft.riv` is the compiled reveal; see `assets/lootbox-reveals/rive/exclusive-nft/README.md` for its view model (`tier`, `contents`, `background`, `pattern`, `reveal`).

## Layout

| Path                       | What                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `src/art/model.ts`         | The shared vector model: shapes, groups, gradients, finish slots.     |
| `src/art/svg.ts`           | Model → SVG, with Rive-style rounded corners.                         |
| `src/art/*.ts`             | Chest, contents, backgrounds, patterns, effects, plaque, stroke font. |
| `src/render.ts`            | `renderExclusiveNft` and trait validation.                            |
| `src/metadata.ts`          | Metaplex JSON and URI helpers.                                        |
| `scripts/contact-sheet.ts` | Review sheets via resvg (dev only).                                   |
| `assets/exclusive-nft.riv` | The compiled Rive reveal.                                             |

## Scripts

```sh
pnpm --dir packages/exclusive-nft-art check          # tsc: src without Node types, then scripts/tests
pnpm --dir packages/exclusive-nft-art test           # vitest: all 30,720 combinations, metadata, Rive contract
pnpm --dir packages/exclusive-nft-art contact-sheet /tmp/exclusive-art
pnpm --dir packages/exclusive-nft-art build:rive     # regenerate and compile the reveal
```

`check` compiles `src/` with no Node or DOM types, which keeps the renderer Worker-safe.
