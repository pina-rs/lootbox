/**
 * The Introductory Exclusive Lootbox NFT collection explained: example
 * NFTs, how rarity stacks, and every layer's odds.
 */
import {
	type Collection,
	combinationProbability,
	layerOdds,
	rarestCombination,
	rarestIndices,
	rarityLabel,
	sampleCombinations,
} from "../lib/exclusive-nft.js";
import { ExclusiveNftArt } from "./ExclusiveNftArt.js";

function percent(probability: number): string {
	const value = probability * 100;

	return value >= 1
		? `${value.toFixed(value >= 10 ? 0 : 1)}%`
		: `${value.toFixed(2)}%`;
}

export function ExclusiveGallery(
	{ collection, count = 5 }: Readonly<
		{ collection: Collection; count?: number }
	>,
) {
	const examples = [
		...sampleCombinations(collection, count),
		rarestIndices(collection),
	];

	return (
		<ul className="nft-gallery" aria-label="Example Exclusive Lootbox NFTs">
			{examples.map((indices) => (
				<li key={indices.join("")}>
					<ExclusiveNftArt
						collection={collection}
						indices={indices}
						size={150}
						caption
					/>
				</li>
			))}
		</ul>
	);
}

export function RarityExplainer(
	{ collection }: Readonly<{ collection: Collection }>,
) {
	const example = sampleCombinations(collection, 1, 7)[0] ??
		rarestIndices(collection);
	const odds = layerOdds(collection);

	return (
		<div className="stack">
			<p>
				Every Exclusive Lootbox NFT stacks one trait from each of{" "}
				{collection.layers.length}{" "}
				layers. Each trait has its own odds, and an NFT's rarity is all of them
				multiplied together. The rarest possible combination is{" "}
				<strong>{rarityLabel(rarestCombination(collection))}</strong>.
			</p>
			<p className="fine">
				For example: {odds.map((layer, position) => {
					const entry = layer.traits[example[position] ?? 0];

					return entry
						? `${entry.trait.name} (${percent(entry.probability)})`
						: "";
				}).join(" × ")} ={" "}
				{rarityLabel(combinationProbability(collection, example))}.
			</p>
		</div>
	);
}

export function LayerOddsTables(
	{ collection }: Readonly<{ collection: Collection }>,
) {
	return (
		<div className="layer-odds">
			{layerOdds(collection).map((layer) => (
				<details key={layer.layer.key}>
					<summary>
						{layer.layer.name}
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
							{layer.traits.map((entry) => (
								<tr key={entry.trait.name}>
									<td>
										<span
											className="swatch"
											style={{ background: entry.trait.color }}
											aria-hidden="true"
										/>
										{entry.trait.name}
									</td>
									<td className="num">{percent(entry.probability)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</details>
			))}
		</div>
	);
}
