/**
 * A preview of one Exclusive Lootbox NFT, drawn from its stacked layers.
 *
 * This is a faithful stand-in for the collection art: the same seven layers,
 * in the same order, each drawn from its trait. Minted NFTs use the
 * collection's own images; this renderer lets the wizard and reveal show any
 * combination without a network round trip.
 */
import { useId } from "react";

import {
	type Collection,
	combinationProbability,
	rarityLabel,
	type TraitIndices,
} from "../lib/exclusive-nft.js";

type Props = Readonly<{
	collection: Collection;
	indices: TraitIndices;
	size?: number;
	/** Visible caption with traits and rarity. */
	caption?: boolean;
}>;

function traitAt(collection: Collection, indices: TraitIndices, layer: number) {
	const trait = collection.layers[layer]?.traits[indices[layer] ?? 0];

	if (!trait) throw new RangeError("unknown trait");

	return trait;
}

export function ExclusiveNftArt(
	{ collection, indices, size = 180, caption = false }: Props,
) {
	const id = useId().replace(/:/g, "");
	const trait = (layer: number) => traitAt(collection, indices, layer);
	const background = trait(0);
	const chest = trait(1);
	const finish = trait(2);
	const lock = trait(3);
	const decoration = trait(4);
	const contents = trait(5);
	const aura = trait(6);
	const probability = combinationProbability(collection, indices);
	const label =
		`${collection.name} Exclusive: ${chest.name} chest, ${finish.name.toLowerCase()}, ${lock.name.toLowerCase()}, holding a ${contents.name.toLowerCase()}. ${
			rarityLabel(probability)
		}.`;
	const dark = ["Night", "Starfield"].includes(background.name);
	const outline = "#1d1a14";

	return (
		<figure className="nft-art" style={{ inlineSize: size }}>
			<svg
				viewBox="0 0 200 200"
				width={size}
				height={size}
				role="img"
				aria-label={label}
			>
				<defs>
					<linearGradient id={`${id}-holo`} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="#ff8ad8" />
						<stop offset="0.35" stopColor="#8fe3ff" />
						<stop offset="0.7" stopColor="#bff7a8" />
						<stop offset="1" stopColor="#f7c948" />
					</linearGradient>
					<linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
						<stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
						<stop offset="1" stopColor="#ffffff" stopOpacity="0.45" />
					</linearGradient>
					<radialGradient id={`${id}-sun`}>
						<stop offset="0" stopColor="#fff3b8" />
						<stop offset="1" stopColor={background.color} />
					</radialGradient>
				</defs>

				{/* Background */}
				<rect
					width="200"
					height="200"
					rx="24"
					fill={background.name === "Sunburst"
						? `url(#${id}-sun)`
						: background.color}
				/>
				{background.name === "Starfield" &&
					[[30, 40], [160, 30], [120, 70], [40, 150], [170, 160], [80, 25], [
						20,
						100,
					]].map(([x, y]) => (
						<circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#fff" />
					))}

				{/* Aura behind the chest */}
				{aura.name === "Sparkle" &&
					[[45, 60], [155, 55], [150, 140], [50, 145]].map(([x, y]) => (
						<path
							key={`${x}-${y}`}
							d={`M${x} ${(y ?? 0) - 9}l3 6 6 3-6 3-3 6-3-6-6-3 6-3z`}
							fill={aura.color}
							stroke={outline}
							strokeWidth="1.5"
						/>
					))}
				{aura.name === "Smoke" && (
					<g fill={aura.color} opacity="0.55">
						<circle cx="60" cy="150" r="22" />
						<circle cx="140" cy="152" r="26" />
						<circle cx="100" cy="162" r="24" />
					</g>
				)}
				{aura.name === "Hearts" &&
					[[48, 70], [152, 66], [154, 132]].map(([x, y]) => (
						<path
							key={`${x}-${y}`}
							d={`M${x} ${
								(y ?? 0) + 6
							}c-9-7-9-15-3-15 3 0 3 3 3 3s0-3 3-3c6 0 6 8-3 15z`}
							fill={aura.color}
							stroke={outline}
							strokeWidth="1.5"
						/>
					))}
				{aura.name === "Lightning" && (
					<path
						d="M40 40l14 0-8 18 12 0-22 30 6-22-10 0z M160 120l14 0-8 18 12 0-22 30 6-22-10 0z"
						fill={aura.color}
						stroke={outline}
						strokeWidth="2"
					/>
				)}
				{aura.name === "Rainbow" && (
					<g fill="none" strokeWidth="7" opacity="0.9">
						{["#ff2e88", "#ff8a3d", "#f7c948", "#3fbf6a", "#2d9bf0", "#8b5cf6"]
							.map((color, index) => (
								<path
									key={color}
									d={`M${24 + index * 7} 150a${76 - index * 7} ${
										76 - index * 7
									} 0 0 1 ${152 - index * 14} 0`}
									stroke={color}
								/>
							))}
					</g>
				)}

				{/* Contents peeking out of the open lid */}
				<g transform="translate(100 78)">
					{contents.name === "Another chest"
						? (
							<rect
								x="-16"
								y="-14"
								width="32"
								height="24"
								rx="4"
								fill={contents.color}
								stroke={outline}
								strokeWidth="2.5"
							/>
						)
						: contents.name === "Rubber duck"
						? (
							<g stroke={outline} strokeWidth="2.5">
								<ellipse cx="0" cy="0" rx="16" ry="11" fill={contents.color} />
								<circle cx="9" cy="-10" r="8" fill={contents.color} />
								<path d="M16 -10l8 2-8 3z" fill="#ff8a3d" />
							</g>
						)
						: contents.name === "Pocket nebula"
						? (
							<g>
								<circle
									cx="0"
									cy="-2"
									r="16"
									fill={contents.color}
									stroke={outline}
									strokeWidth="2.5"
								/>
								<circle cx="-5" cy="-6" r="3" fill="#fff" />
								<circle cx="6" cy="2" r="2" fill="#fff" />
							</g>
						)
						: contents.name === "IOU note"
						? (
							<g stroke={outline} strokeWidth="2.5">
								<rect
									x="-18"
									y="-16"
									width="36"
									height="24"
									rx="2"
									fill={contents.color}
									transform="rotate(-8)"
								/>
								<text
									x="-11"
									y="1"
									fontSize="10"
									fontWeight="900"
									fill={outline}
									stroke="none"
									transform="rotate(-8)"
								>
									IOU
								</text>
							</g>
						)
						: (
							<circle
								cx="0"
								cy="-2"
								r="14"
								fill={contents.color}
								stroke={outline}
								strokeWidth="2.5"
							/>
						)}
				</g>

				{/* Chest */}
				<g stroke={outline} strokeWidth="4" strokeLinejoin="round">
					<path
						d="M46 92c0-26 24-40 54-40s54 14 54 40z"
						fill={chest.color}
						transform="rotate(-10 46 92)"
					/>
					<rect
						x="44"
						y="92"
						width="112"
						height="66"
						rx="8"
						fill={chest.color}
					/>
				</g>
				{finish.name === "Glossy" && (
					<path
						d="M54 100h40"
						stroke="#fff"
						strokeWidth="5"
						strokeLinecap="round"
						opacity="0.7"
					/>
				)}
				{finish.name === "Chrome" && (
					<rect
						x="44"
						y="92"
						width="112"
						height="66"
						rx="8"
						fill={`url(#${id}-chrome)`}
					/>
				)}
				{finish.name === "Holographic" && (
					<rect
						x="44"
						y="92"
						width="112"
						height="66"
						rx="8"
						fill={`url(#${id}-holo)`}
						opacity="0.55"
					/>
				)}
				{finish.name === "Weathered" && (
					<g stroke={outline} strokeWidth="2" opacity="0.45" fill="none">
						<path d="M56 110l12 6M130 140l14-5M70 146l10-8" />
					</g>
				)}
				{finish.name === "Glitch" && (
					<g opacity="0.8">
						<rect x="40" y="104" width="112" height="6" fill="#00e5ff" />
						<rect x="50" y="130" width="100" height="5" fill="#ff2e88" />
					</g>
				)}
				<path d="M44 118h112" stroke={outline} strokeWidth="4" />

				{/* Decoration */}
				{decoration.name === "Rivets" &&
					[54, 146].flatMap((x) =>
						[104, 146].map((y) => (
							<circle
								key={`${x}-${y}`}
								cx={x}
								cy={y}
								r="3.5"
								fill={decoration.color}
							/>
						))
					)}
				{decoration.name === "Stickers" && (
					<g stroke={outline} strokeWidth="2">
						<circle cx="62" cy="140" r="8" fill={decoration.color} />
						<rect
							x="130"
							y="128"
							width="16"
							height="14"
							rx="3"
							fill="#8fe3ff"
							transform="rotate(12 138 135)"
						/>
					</g>
				)}
				{decoration.name === "Ribbon" && (
					<path
						d="M92 92v66M108 92v66"
						stroke={decoration.color}
						strokeWidth="6"
					/>
				)}
				{decoration.name === "Vines" && (
					<path
						d="M46 150c12-10 18 4 28-8s16 2 24-6"
						fill="none"
						stroke={decoration.color}
						strokeWidth="4"
						strokeLinecap="round"
					/>
				)}
				{decoration.name === "Runes" && (
					<path
						d="M58 132l6-10 6 10M132 124v14l8-7z"
						fill="none"
						stroke={decoration.color}
						strokeWidth="3"
					/>
				)}
				{decoration.name === "Crown" && (
					<path
						d="M80 50l8-16 12 12 12-12 8 16z"
						fill={decoration.color}
						stroke={outline}
						strokeWidth="3"
						strokeLinejoin="round"
					/>
				)}
				{decoration.name === "Halo" && (
					<ellipse
						cx="100"
						cy="36"
						rx="30"
						ry="8"
						fill="none"
						stroke={decoration.color}
						strokeWidth="5"
					/>
				)}

				{/* Lock */}
				<g stroke={outline} strokeWidth="3">
					{lock.name === "Heart lock"
						? (
							<path
								d="M100 134c-14-10-14-24-5-24 4 0 5 4 5 4s1-4 5-4c9 0 9 14-5 24z"
								fill={lock.color}
							/>
						)
						: lock.name === "Skull lock"
						? (
							<g>
								<circle cx="100" cy="120" r="12" fill={lock.color} />
								<circle cx="95" cy="119" r="2.5" fill={outline} stroke="none" />
								<circle
									cx="105"
									cy="119"
									r="2.5"
									fill={outline}
									stroke="none"
								/>
							</g>
						)
						: lock.name === "Crystal lock"
						? <path d="M100 106l11 12-11 16-11-16z" fill={lock.color} />
						: lock.name === "Laser lock"
						? (
							<g>
								<rect
									x="89"
									y="108"
									width="22"
									height="22"
									rx="5"
									fill="#1d1a14"
								/>
								<path d="M92 119h16" stroke={lock.color} strokeWidth="4" />
							</g>
						)
						: (
							<rect
								x="90"
								y="108"
								width="20"
								height="22"
								rx="4"
								fill={lock.color}
							/>
						)}
				</g>
				{dark && (
					<rect
						width="200"
						height="200"
						rx="24"
						fill="none"
						stroke="#fff"
						strokeOpacity="0.15"
						strokeWidth="2"
					/>
				)}
			</svg>
			{caption && (
				<figcaption>
					<strong>{rarityLabel(probability)}</strong>
					<span>
						{chest.name} · {finish.name} · {lock.name} · {contents.name}
					</span>
				</figcaption>
			)}
		</figure>
	);
}
