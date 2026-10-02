/**
 * An Exclusive Lootbox NFT poster, rendered by the art package. Shown as an
 * `<img>` data URI so the SVG is never injected into the page's DOM.
 */
import { rarityOf, type TraitVector } from "@pina-rs/exclusive-nft-art";

import { posterAlt, posterDataUri } from "../lib/exclusive-nft.js";

export function ExclusiveNftArt(
	{ traits, serial, size = 180, caption = false }: Readonly<{
		traits: TraitVector;
		serial: number;
		size?: number;
		caption?: boolean;
	}>,
) {
	const rarity = rarityOf(traits);

	return (
		<figure className="nft-art" style={{ inlineSize: size }}>
			<img
				src={posterDataUri(traits, serial)}
				alt={posterAlt(traits, serial)}
				width={size}
				height={size}
				loading="lazy"
			/>
			{caption && (
				<figcaption>
					<strong>{rarity.compact}</strong>
				</figcaption>
			)}
		</figure>
	);
}
