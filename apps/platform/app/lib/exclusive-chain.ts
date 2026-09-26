/**
 * Exclusive Lootbox NFT state read from chain: the collection's attach window
 * and published tables, and what an opening minted.
 */
import {
	type ChainOpening,
	deriveExclusiveTraits,
	fetchMaybeExclusiveCollectionState,
	getExclusiveNftMintedEventEventDecoder,
} from "@pina-rs/lootbox";
import {
	type Address,
	address,
	createSolanaRpc,
	getBase64Encoder,
	type Signature,
} from "@solana/kit";

import { collectionLayers, paddedText } from "./exclusive-nft.js";

export type ExclusiveCollectionInfo = Readonly<{
	address: string;
	attachOpensAt: number;
	attachClosesAt: number;
	published: boolean;
	baseUri: string;
	layers: readonly (readonly number[])[];
}>;

export async function readExclusiveCollection(
	rpcUrl: string,
	collection: string,
): Promise<ExclusiveCollectionInfo | null> {
	const state = await fetchMaybeExclusiveCollectionState(
		createSolanaRpc(rpcUrl),
		address(collection),
		{ commitment: "confirmed" },
	);

	if (!state.exists) return null;

	return {
		address: collection,
		attachOpensAt: Number(state.data.attachOpensAt),
		attachClosesAt: Number(state.data.attachClosesAt),
		published: state.data.status === 1,
		baseUri: paddedText(state.data.baseUri),
		layers: collectionLayers(state.data),
	};
}

/** Traits an opening's claim mints, from its verified randomness alone. */
export async function openingTraits(
	opening: ChainOpening,
	collection: ExclusiveCollectionInfo,
): Promise<readonly number[]> {
	const { traits } = await deriveExclusiveTraits(
		opening.data.template,
		opening.address,
		opening.data.entropy,
		collection.layers,
	);

	return traits;
}

export type MintedExclusive = Readonly<{
	asset: string;
	serial: number;
	traits: readonly number[];
	signature: string;
}>;

/**
 * The `ExclusiveNftMinted` event from an opening's claim transaction, found
 * among the opening account's recent signatures.
 */
export async function mintedExclusive(
	rpcUrl: string,
	opening: Address,
): Promise<MintedExclusive | null> {
	const rpc = createSolanaRpc(rpcUrl);
	const signatures = await rpc.getSignaturesForAddress(opening, { limit: 10 })
		.send();
	const decoder = getExclusiveNftMintedEventEventDecoder();
	const base64 = getBase64Encoder();

	for (const entry of signatures) {
		if (entry.err) continue;

		const transaction = await rpc.getTransaction(entry.signature as Signature, {
			encoding: "base64",
			maxSupportedTransactionVersion: 0,
			commitment: "confirmed",
		}).send();

		for (const line of transaction?.meta?.logMessages ?? []) {
			if (!line.startsWith("Program data: ")) continue;

			const bytes = base64.encode(line.slice("Program data: ".length));

			// Event discriminator 1, migration version 0.
			if (
				bytes[0] !== 1 || bytes[1] !== 0 || bytes.length !== decoder.fixedSize
			) continue;

			const event = decoder.decode(bytes);

			if (event.opening !== opening) continue;

			return {
				asset: event.asset,
				serial: Number(event.serial),
				traits: Array.from(event.traits.slice(0, event.layerCount)),
				signature: entry.signature,
			};
		}
	}

	return null;
}
