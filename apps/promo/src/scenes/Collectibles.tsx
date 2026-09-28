/**
 * The consolation prize: a fan of real Exclusive Lootbox NFTs, rendered by
 * the same package that mints them, each with its rarity.
 */
import {
	commonestTraits,
	compactOneIn,
	LAYERS,
	rarestTraits,
	rarityOf,
	renderExclusiveNft,
	type TraitVector,
} from "@pina-rs/exclusive-nft-art";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";

import { BOUNCE, enter, float, mix } from "../kit/motion.ts";
import { SparkleBurst } from "../kit/Particles.tsx";
import { Sfx } from "../kit/Sound.tsx";
import { Headline } from "../kit/Type.tsx";

export const COLLECTIBLE_FRAMES = 93;

/** A varied, valid trait vector: only traits that can actually be rolled. */
function mixed(offset: number): TraitVector {
	return LAYERS.map((layer, index) => {
		const rollable = layer.traits.flatMap((trait, position) =>
			trait.weight > 0 ? [position] : []
		);

		return rollable[(offset * 3 + index * 5) % rollable.length] ?? 0;
	});
}

const CHESTS: readonly Readonly<{ traits: TraitVector; serial: number }>[] = [
	{ traits: commonestTraits(), serial: 118 },
	{ traits: mixed(1), serial: 2041 },
	{ traits: rarestTraits(), serial: 7 },
	{ traits: mixed(4), serial: 530 },
	{ traits: mixed(7), serial: 1296 },
];

const ART = CHESTS.map(({ traits, serial }) => ({
	src: `data:image/svg+xml;utf8,${
		encodeURIComponent(renderExclusiveNft(traits, serial))
	}`,
	rarity: rarityOf(traits),
}));

export function Collectibles(
	{ headline = ["Nobody", "leaves", "empty-handed"] }: Readonly<
		{ headline?: readonly string[] }
	>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const tall = height > width;
	const card = Math.min(width / (tall ? 3.1 : 6.4), height * 0.36);
	const centreX = width / 2;
	const baseY = tall ? height * 0.5 : height * 0.4;

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					top: tall ? height * 0.14 : height * 0.1,
					left: 0,
					right: 0,
				}}
			>
				<Headline
					words={headline.map((word, index) =>
						index === headline.length - 1
							? { text: word, underline: true }
							: word
					)}
					at={0}
					size={tall ? width * 0.1 : height * 0.1}
					width={width}
				/>
			</div>
			{ART.map((art, index) => {
				const offset = index - 2;
				const t = enter(frame, 10 + Math.abs(offset) * 4, BOUNCE);
				const spread = tall ? card * 0.62 : card * 0.95;
				const x = centreX + offset * spread;
				const y = baseY + Math.abs(offset) * card * 0.12 +
					(offset === 0 ? -card * 0.12 : 0);
				const hero = offset === 0;

				return (
					<figure
						key={index}
						style={{
							position: "absolute",
							left: x - card / 2,
							top: y + mix(height * 0.6, 0, t) +
								float(frame + index * 17, 5, 70),
							width: card,
							margin: 0,
							zIndex: 10 - Math.abs(offset),
							transform: `rotate(${mix(offset * 24, offset * 7, t)}deg) scale(${
								hero ? 1.14 : 1
							})`,
						}}
					>
						<Img
							src={art.src}
							style={{
								display: "block",
								width: card,
								height: card,
								border: "5px solid var(--ink)",
								borderRadius: 22,
								background: "var(--paper)",
								boxShadow: hero
									? "0 10px 0 var(--ink), 0 0 0 10px var(--gold)"
									: "0 8px 0 var(--ink)",
							}}
						/>
						{hero && (
							<figcaption
								style={{
									position: "absolute",
									left: "50%",
									bottom: -card * 0.22,
									transform: "translateX(-50%) rotate(-3deg)",
									padding: `${card * 0.03}px ${card * 0.07}px`,
									border: "4px solid var(--ink)",
									borderRadius: 999,
									background: "var(--gold)",
									boxShadow: "0 5px 0 var(--ink)",
									font: `900 ${card * 0.1}px/1.1 var(--body)`,
									whiteSpace: "nowrap",
									zIndex: 20,
								}}
							>
								{compactOneIn(art.rarity.oneIn)}
							</figcaption>
						)}
					</figure>
				);
			})}
			<SparkleBurst
				x={centreX}
				y={baseY + card * 0.35}
				at={30}
				radius={card * 1.1}
				size={card * 0.08}
			/>
			<Sfx name="whoosh" at={8} volume={0.45} />
			<Sfx name="sparkle" at={30} volume={0.55} />
		</AbsoluteFill>
	);
}
