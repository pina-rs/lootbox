/**
 * Create the Introductory Exclusive Lootbox NFT collection.
 *
 *   pnpm --dir apps/platform exclusive:collection -- \
 *     --cluster devnet --keypair admin.json --closes 2026-12-31T23:59:59Z \
 *     [--opens <iso|unix>] [--origin https://lootbox.so] [--base-uri <url>] \
 *     [--rpc <url>] [--execute]
 *
 * Loads the art package's layer tables in chunks (`setExclusiveLayer`),
 * appends a depth-20 / buffer-64 / canopy-10 Bubblegum V2 tree, creates the
 * Core collection, sets the base URI to `<origin>/x/<collection>/`, and
 * publishes. Prints a dry run first and sends nothing without `--execute`.
 * Every run rereads the collection on chain, so an interrupted run resumes.
 * The admin keypair should be a dedicated key (a multisig on mainnet).
 */
import { LAYERS } from "@pina-rs/exclusive-nft-art";
import { EXCLUSIVE_TREE_SHAPE, LootboxClient } from "@pina-rs/lootbox";

import {
	installPatientFetch,
	loadKeypair,
	parseArgs,
	parseCluster,
	verifiedRpcUrl,
} from "../../../sdks/typescript/scripts/cli.ts";
import { ensureCollection, planCollection } from "./collection.ts";

function unixSeconds(value: string): bigint {
	if (/^\d+$/.test(value)) return BigInt(value);

	const parsed = Date.parse(value);

	if (!Number.isFinite(parsed)) throw new Error(`not a date: ${value}`);

	return BigInt(Math.floor(parsed / 1000));
}

function sol(lamports: bigint): string {
	return `${(Number(lamports) / 1e9).toFixed(4)} SOL`;
}

installPatientFetch();

const args = parseArgs(process.argv.slice(2));
const cluster = parseCluster(args.required("cluster"));
const rpcUrl = await verifiedRpcUrl(cluster, args.optional("rpc"));
const admin = await loadKeypair(args.required("keypair"));
const client = new LootboxClient(rpcUrl, admin, (message, signature) => {
	console.log(signature ? `✓ ${message}  ${signature}` : `… ${message}`);
});
const baseUri = args.optional("base-uri");
const plan = await planCollection(client, {
	origin: args.optional("origin") ?? "https://lootbox.so",
	...(baseUri ? { baseUri } : {}),
	attachOpensAt: unixSeconds(
		args.optional("opens") ?? String(Math.floor(Date.now() / 1000)),
	),
	attachClosesAt: unixSeconds(args.required("closes")),
});

console.log(`Introductory Exclusive Lootbox NFT collection on ${cluster}`);
console.log(`  admin        ${admin.address}`);
console.log(
	`  collection   ${plan.collection} (${
		plan.published ? "published" : plan.exists ? "draft, resuming" : "new"
	})`,
);
console.log(`  base URI     ${plan.baseUri}`);
console.log(
	`  attach       ${
		new Date(Number(plan.attachOpensAt) * 1000).toISOString()
	} → ${new Date(Number(plan.attachClosesAt) * 1000).toISOString()}`,
);
console.log(
	`  tree         depth ${EXCLUSIVE_TREE_SHAPE.maxDepth}, buffer ${EXCLUSIVE_TREE_SHAPE.maxBufferSize}, canopy ${EXCLUSIVE_TREE_SHAPE.canopyDepth}: ${
		sol(plan.treeRent)
	} rent`,
);

for (const [index, layer] of LAYERS.entries()) {
	console.log(
		`  layer ${index}      ${layer.name}: ${layer.traits.length} traits, weights sum ${
			plan.layers[index]?.reduce((a, b) => a + b, 0)
		}`,
	);
}

if (plan.published) {
	console.log("Already published. Nothing to do.");
} else if (!args.flag("execute")) {
	console.log("Dry run. Re-run with --execute to send.");
} else {
	const collection = await ensureCollection(client, plan);

	console.log(
		`Published ${collection}. Set EXCLUSIVE_COLLECTION_${cluster.toUpperCase()}=${collection}.`,
	);
}
