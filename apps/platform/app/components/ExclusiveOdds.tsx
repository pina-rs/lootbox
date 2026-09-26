/**
 * Exclusive Lootbox NFTs explained: example posters, how rarity stacks, and
 * every layer's odds, straight from the published tables.
 */
import { rarityOf, resolveTraits } from "@pina-rs/exclusive-nft-art";

import {
	commonestRarity,
	EXCLUSIVE_LABEL,
	layerOdds,
	rarestRarity,
	sampleTraits,
} from "../lib/exclusive-nft.js";
import { ExclusiveNftArt } from "./ExclusiveNftArt.js";

function percent(probability: number): string {
	const value = probability * 100;

	return value >= 1
		? `${value.toFixed(value >= 10 ? 0 : 1)}%`
		: `${value.toFixed(2)}%`;
}

export function ExclusiveGallery({ count = 6 }: Readonly<{ count?: number }>) {
	return (
		<ul className="nft-gallery" aria-label={`Example ${EXCLUSIVE_LABEL}s`}>
			{sampleTraits(count).map((traits, index) => (
				<li key={traits.join("-")}>
					<ExclusiveNftArt
						traits={traits}
						serial={index + 1}
						size={150}
						caption
					/>
				</li>
			))}
		</ul>
	);
}

export function RarityExplainer() {
	const example = sampleTraits(1, 7)[0] ?? [];
	const chosen = resolveTraits(example);
	const odds = layerOdds();

	return (
		<div className="stack">
			<p>
				Every {EXCLUSIVE_LABEL} stacks one trait from each of {odds.length}{" "}
				layers, drawn on chain from the opening's randomness. Each trait has its
				own odds, and an NFT's rarity is all of them multiplied together: from
				{" "}
				<strong>{commonestRarity()}</strong> for the commonest chest to{" "}
				<strong>{rarestRarity()}</strong> for the rarest.
			</p>
			<p className="fine">
				For example: {odds.map((layer, position) => {
					const trait = layer.traits[example[position] ?? 0];

					return trait
						? `${chosen[position]?.name} (${percent(trait.probability)})`
						: "";
				}).join(" × ")} = {rarityOf(example).label}.
			</p>
		</div>
	);
}

export function LayerOddsTables() {
	return (
		<div className="layer-odds" data-testid="exclusive-layers">
			{layerOdds().map((layer) => (
				<details key={layer.id}>
					<summary>
						{layer.name}
						<span className="muted">· {layer.traits.length} traits</span>
					</summary>
					<table className="odds">
						<thead>
							<tr>
								<th scope="col">Trait</th>
								<th scope="col" className="num">Chance</th>
							</tr>
						</thead>
						<tbody>
							{layer.traits.map((trait) => (
								<tr key={trait.index}>
									<td>{trait.name}</td>
									<td className="num">{percent(trait.probability)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</details>
			))}
		</div>
	);
}
