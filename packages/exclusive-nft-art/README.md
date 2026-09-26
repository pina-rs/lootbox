# @pina-rs/exclusive-nft-art

Art, layer tables, rarity, and metadata for **Exclusive Lootbox NFTs**: layered cartoon chests given to lootbox openers who did not win a main prize.

- **Why it exists:** a losing opening should still hand over something worth showing off. The program rolls seven independent layers on-chain; this package turns that trait vector into a poster, an animated SVG, a Rive reveal, and Metaplex JSON.
- **Why use it:** one pure TypeScript module renders every combination deterministically, with no DOM or Node APIs, so a Cloudflare Worker can serve art straight from the URI. The same vector model and idle motions drive the still SVG, the animated SVG, and the Rive file, so all three match.
- **Use cases:** serving `{stem}.json`, `{stem}.svg`, `{stem}.animated.svg`, and `play.html` from a Worker; showing the prize card on the website; rendering review sheets; rebuilding the Rive reveal.

## The contract

An NFT is a trait vector, one index per layer, drawn bottom to top. The program writes its URI as:

```
{base_uri}{hex}-{serial}.json      e.g. 00050203000d01-42.json
```

`hex` is one lowercase byte per layer, bottom to top. `parseExclusiveNftStem` rejects uppercase hex, padded serials, and out-of-range traits, so each NFT has exactly one URI. The versioned form is `{ version: 1, traits: [...] }` and the short code is `traits.join("-")`.

`src/layers.ts` holds the tables the program stores verbatim: layer id, name, and traits `{ index, name, description, weight }`. **Indices are append-only**: new layers go on top, new traits go at the end, and nothing is reordered or renamed once published. `test/layers.test.ts` pins the tables.

## Layers and weights

Each layer rolls independently with u32 weights that sum to 10,000, so a weight reads as hundredths of a percent. Rarity is the product of the chosen traits' probabilities, computed exactly with `bigint`.

| # | Layer      | Traits | Commonest (weight)   | Rarest (weight)            |
| - | ---------- | -----: | -------------------- | -------------------------- |
| 0 | Background |     15 | Ivory Studio (1,800) | Inside a Bigger Chest (20) |
| 1 | Finish     |     16 | Painted Pine (2,600) | Event Horizon (10)         |
| 2 | Pattern    |      8 | Plain Planks (3,000) | Scrollwork (200)           |
| 3 | Lock       |     10 | Shield Latch (3,000) | No Lock (80)               |
| 4 | Decoration |     12 | None (4,000)         | Googly Eyes (50)           |
| 5 | Contents   |     20 | A Dust Bunny (1,000) | A Golden Ticket Stub (50)  |
| 6 | Effect     |     14 | None (3,500)         | Singularity (40)           |

- The commonest chest is **1 in 16,958**; the rarest is **1 in 31,250,000,000,000,000** (about 1 in 3 × 10¹⁶).
- `rarityOf(traits)` returns `probability`, exact `oneIn`, `label` (`1 in N`), `compact` (`1 in 31 quadrillion`), and `score`, the information content `Σ −log2 p` in bits (commonest ≈ 14.05, rarest ≈ 54.79).
- The finish carries its material only: palette, glow, and holographic foil. The effect layer is the animated trait: dust motes, glints, butterflies, fireflies, confetti, bubbles, snowfall, gold burst, holo shimmer, lightning, orbit ring, cosmic particles, and a singularity.

## Render rules

`src/rules.ts` lists combinations that clash on screen. Rules change only how a vector is drawn, never its odds, metadata, or URI; the SVG renderer applies them directly and the Rive generator compiles them into its visibility converters.

- **Tall contents clear the crown trim:** a moth, cobweb, tag, paper crown, ghost, or echo hides the Crown Trim decoration.
- **The keyhole eye joins the googly eyes:** with Googly Eyes, the Keyhole Eye lock drops 14 units so the three eyes read as a face.

## Outputs

- `renderExclusiveNft(traits, serial)`: the still 1024² SVG poster (wallet `image`). About 45 KB at most across the tested combinations (budget 60 KB).
- `renderAnimatedExclusiveNft(traits, serial)`: the same poster with CSS keyframes for every layer's idle motion: the chest breathes, the contents perform, the effect loops. Viewers who prefer reduced motion get the still pose. About 50 KB at most (budget 80 KB).
- `assets/exclusive-nft.riv` (`@pina-rs/exclusive-nft-art/exclusive-nft.riv`): the Rive reveal. One number input per layer (`background`, `finish`, `pattern`, `lock`, `decoration`, `contents`, `effect`) and a `reveal` trigger. See `assets/lootbox-reveals/rive/exclusive-nft/README.md`.
- `playerHtml()` and `assets/play.html`: the `animation_url` page. It plays the Rive reveal for `?nft={stem}`, overlays the poster's plaque, and falls back to the animated SVG (or the still under reduced motion).
- `metadataFor(traits, serial, { base, externalUrl })`: Metaplex JSON with an attribute per layer, `Serial`, `Rarity` (`1 in N`), and `Rarity score`.

```ts
import {
	metadataFor,
	parseExclusiveNftStem,
	playerHtml,
	renderAnimatedExclusiveNft,
	renderExclusiveNft,
} from "@pina-rs/exclusive-nft-art";

// A Cloudflare Worker serving /exclusive/{stem}.{json,svg,animated.svg} and play.html.
export default {
	fetch(request: Request): Response {
		const path = new URL(request.url).pathname;

		if (path.endsWith("/play.html")) {
			return new Response(playerHtml(), {
				headers: { "content-type": "text/html" },
			});
		}

		const match = /\/exclusive\/([0-9a-f]+-\d+)\.(json|svg|animated\.svg)$/
			.exec(path);
		const parsed = match?.[1] ? parseExclusiveNftStem(match[1]) : null;

		if (!match || !parsed) {
			return new Response("Not found", { status: 404 });
		}

		const { traits, serial } = parsed;
		const svg = {
			"content-type": "image/svg+xml",
			"cache-control": "public, max-age=31536000, immutable",
		};

		switch (match[2]) {
			case "svg":
				return new Response(renderExclusiveNft(traits, serial), {
					headers: svg,
				});
			case "animated.svg":
				return new Response(renderAnimatedExclusiveNft(traits, serial), {
					headers: svg,
				});
			default:
				return Response.json(metadataFor(traits, serial, {
					base: "https://nft.example/exclusive/",
					externalUrl: "https://pina-rs.github.io/lootbox/",
				}));
		}
	},
};
```

Serve `exclusive-nft.riv` beside `play.html`.

## Layout

| Path                       | What                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `src/layers.ts`            | The published layer tables, trait vectors, and validation.                         |
| `src/finishes.ts`          | Finish palettes, glow, foil, and reveal drama.                                     |
| `src/rarity.ts`            | Exact odds and the bits score.                                                     |
| `src/rules.ts`             | Render rules for clashing combinations.                                            |
| `src/art/model.ts`         | The shared vector model: shapes, groups, gradients, finish slots, motions.         |
| `src/art/motion.ts`        | Looping idle motions shared by CSS and Rive.                                       |
| `src/art/svg.ts`           | Model → SVG, with Rive-style rounded corners and CSS keyframes.                    |
| `src/art/*.ts`             | Chest, backgrounds, patterns, locks, decorations, contents, effects, plaque, font. |
| `src/render.ts`            | Still and animated renderers.                                                      |
| `src/metadata.ts`          | Metaplex JSON and URI helpers.                                                     |
| `src/player.ts`            | The `animation_url` page.                                                          |
| `scripts/contact-sheet.ts` | Review sheets via resvg (dev only).                                                |

## Scripts

```sh
pnpm --dir packages/exclusive-nft-art check          # tsc: src without Node types, then scripts, tests, and the Rive generator
pnpm --dir packages/exclusive-nft-art test           # vitest: every trait of every layer, goldens, rarity, rules, metadata, Rive contract
pnpm --dir packages/exclusive-nft-art contact-sheet /tmp/exclusive-art
pnpm --dir packages/exclusive-nft-art build:rive     # regenerate the reveal, exclusive-nft.riv, and play.html
```

`check` compiles `src/` with no Node or DOM types, which keeps the renderer Worker-safe. The golden test pins four vectors' still and animated hashes: minted NFTs render on demand, so art changes after release need an explicit compatibility plan.
