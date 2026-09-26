/**
 * Exclusive Lootbox NFTs as the site presents them.
 *
 * One protocol-run collection, the Introductory collection, is shared by
 * every lootbox. Each NFT stacks one trait from each of seven layers; every
 * trait has its own odds, so an NFT's rarity is the product of its layers'
 * odds. The tables, art, and rarity maths come from
 * `@pina-rs/exclusive-nft-art`; the chain holds the same weights, frozen at
 * publication. Creators only choose whether to attach the collection (and
 * for how many boxes) while its attach window is open.
 */
import {
	commonestTraits,
	LAYERS,
	posterTitle,
	rarestTraits,
	rarityOf,
	renderExclusiveNft,
	type TraitVector,
} from "@pina-rs/exclusive-nft-art";
import type { ExclusiveCollectionState } from "@pina-rs/lootbox";

export const EXCLUSIVE_LABEL = "Exclusive Lootbox NFT";

export type LayerOdds = Readonly<{
	id: string;
	name: string;
	traits: readonly Readonly<
		{ index: number; name: string; probability: number }
	>[];
}>;

export function layerOdds(): LayerOdds[] {
	return LAYERS.map((layer) => {
		const total = layer.traits.reduce((sum, trait) => sum + trait.weight, 0);

		return {
			id: layer.id,
			name: layer.name,
			traits: layer.traits.map((trait) => ({
				index: trait.index,
				name: trait.name,
				probability: total === 0 ? 0 : trait.weight / total,
			})),
		};
	});
}

export function commonestRarity(): string {
	return rarityOf(commonestTraits()).label;
}

export function rarestRarity(): string {
	return rarityOf(rarestTraits()).compact;
}

/**
 * Deterministic example vectors for the gallery, drawn by weight from a
 * small xorshift stream so server and client render the same examples.
 */
export function sampleTraits(count: number, seed = 0x1ee7): TraitVector[] {
	let state = seed >>> 0 || 1;
	const next = () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		state >>>= 0;

		return state / 0x1_0000_0000;
	};

	return Array.from({ length: count }, () =>
		LAYERS.map((layer) => {
			const total = layer.traits.reduce((sum, trait) => sum + trait.weight, 0);
			let roll = next() * total;

			for (const trait of layer.traits) {
				roll -= trait.weight;

				if (roll < 0) return trait.index;
			}

			return layer.traits.length - 1;
		}));
}

/** The still poster as a data URI, for `<img>` (never injected as markup). */
export function posterDataUri(traits: TraitVector, serial: number): string {
	return `data:image/svg+xml;charset=utf-8,${
		encodeURIComponent(renderExclusiveNft(traits, serial))
	}`;
}

export function posterAlt(traits: TraitVector, serial: number): string {
	return `${EXCLUSIVE_LABEL}: ${posterTitle(traits, serial)}, ${
		rarityOf(traits).label
	}`;
}

/** The published layer weights, read from the collection account. */
export function collectionLayers(
	state: Pick<
		ExclusiveCollectionState,
		"layerCount" | "traitCounts" | "weights"
	>,
): number[][] {
	const view = new DataView(
		state.weights.buffer,
		state.weights.byteOffset,
		state.weights.byteLength,
	);

	return Array.from({ length: state.layerCount }, (_, layer) =>
		Array.from(
			{ length: state.traitCounts[layer] ?? 0 },
			(_, slot) => view.getUint32(layer * 256 + slot * 4, true),
		));
}

/** Null-padded UTF-8 text from a fixed-size account field. */
export function paddedText(bytes: Uint8Array | ArrayLike<number>): string {
	const array = Uint8Array.from(bytes as ArrayLike<number>);
	const end = array.indexOf(0);

	return new TextDecoder().decode(end < 0 ? array : array.subarray(0, end));
}
