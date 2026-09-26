/**
 * The Introductory Exclusive Lootbox NFT collection: its terms and a
 * resumable create-load-publish run, shared by the admin script and the
 * end-to-end setup.
 */
import { LAYERS } from "@pina-rs/exclusive-nft-art";
import {
	EXCLUSIVE_TREE_SHAPE,
	type ExclusiveLayer,
	fetchMaybeExclusiveCollectionState,
	type LootboxClient,
	validateExclusiveLayers,
} from "@pina-rs/lootbox";
import type { Address } from "@solana/kit";

export const INTRODUCTORY = {
	collectionId: 1n,
	namePrefix: "Lootbox",
	symbol: "LOOT",
} as const;

/** The art package's published tables, bottom layer first, as u32 weights. */
export function introductoryLayers(): ExclusiveLayer[] {
	const layers = LAYERS.map((layer) =>
		layer.traits.map((trait) => trait.weight)
	);

	validateExclusiveLayers(layers);

	return layers;
}

export function defaultBaseUri(origin: string, collection: Address): string {
	return `${origin.replace(/\/$/, "")}/x/${collection}/`;
}

export type CollectionPlan = Readonly<{
	collection: Address;
	baseUri: string;
	layers: readonly ExclusiveLayer[];
	attachOpensAt: bigint;
	attachClosesAt: bigint;
	/** Rent for the tree account the first append creates. */
	treeRent: bigint;
	exists: boolean;
	published: boolean;
}>;

export async function planCollection(
	client: LootboxClient,
	options: Readonly<{
		origin: string;
		baseUri?: string;
		attachOpensAt: bigint;
		attachClosesAt: bigint;
	}>,
): Promise<CollectionPlan> {
	const [collection] = await client.exclusiveCollectionAddress(
		client.payer.address,
		INTRODUCTORY.collectionId,
	);
	const state = await fetchMaybeExclusiveCollectionState(
		client.rpc,
		collection,
	);

	return {
		collection,
		baseUri: options.baseUri ?? defaultBaseUri(options.origin, collection),
		layers: introductoryLayers(),
		attachOpensAt: options.attachOpensAt,
		attachClosesAt: options.attachClosesAt,
		treeRent: await client.rpc.getMinimumBalanceForRentExemption(
			EXCLUSIVE_TREE_SHAPE.space,
		).send(),
		exists: state.exists,
		published: state.exists && state.data.status === 1,
	};
}

/** Create (or resume), load every layer, append the tree, and publish. */
export async function ensureCollection(
	client: LootboxClient,
	plan: CollectionPlan,
): Promise<Address> {
	return client.createExclusiveCollection({
		collectionId: INTRODUCTORY.collectionId,
		namePrefix: INTRODUCTORY.namePrefix,
		symbol: INTRODUCTORY.symbol,
		baseUri: plan.baseUri,
		attachOpensAt: plan.attachOpensAt,
		attachClosesAt: plan.attachClosesAt,
		layers: plan.layers,
		tree: EXCLUSIVE_TREE_SHAPE,
	});
}
