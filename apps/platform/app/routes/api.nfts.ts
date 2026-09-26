/**
 * NFTs owned by a wallet, from a DAS-capable RPC configured server-side.
 * Only standard Token Metadata NFTs and plain Core assets are offered because
 * those are the kinds the creator flow can escrow without proofs.
 */
import {
	errorResponse,
	jsonResponse,
	services,
} from "../lib/.server/context.js";
import { parseCluster } from "../lib/clusters.js";
import type { Route } from "./+types/api.nfts";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type NftItem = Readonly<{
	mint: string;
	name: string;
	image: string | null;
	standard: "tokenMetadata" | "core";
}>;

function parseAssets(payload: unknown): NftItem[] {
	const items = typeof payload === "object" && payload !== null
		? Reflect.get(Reflect.get(payload, "result") ?? {}, "items")
		: null;

	if (!Array.isArray(items)) throw new TypeError("unexpected DAS response");

	return items.flatMap((item: unknown): NftItem[] => {
		if (typeof item !== "object" || item === null) return [];

		const id = Reflect.get(item, "id");
		const face = Reflect.get(item, "interface");
		const compression = Reflect.get(item, "compression");
		const content = Reflect.get(item, "content");
		const metadata = typeof content === "object" && content !== null
			? Reflect.get(content, "metadata")
			: null;
		const links = typeof content === "object" && content !== null
			? Reflect.get(content, "links")
			: null;
		const name = typeof metadata === "object" && metadata !== null
			? Reflect.get(metadata, "name")
			: null;
		const image = typeof links === "object" && links !== null
			? Reflect.get(links, "image")
			: null;
		const compressed = typeof compression === "object" &&
			compression !== null &&
			Reflect.get(compression, "compressed") === true;

		if (typeof id !== "string" || !BASE58.test(id) || compressed) return [];

		const standard = face === "MplCoreAsset"
			? "core"
			: face === "V1_NFT" || face === "ProgrammableNFT"
			? "tokenMetadata"
			: null;

		// Programmable NFTs carry transfer rules the program does not admit yet.
		if (!standard || face === "ProgrammableNFT") return [];

		return [{
			mint: id,
			name: typeof name === "string" ? name.slice(0, 80) : "Untitled NFT",
			image: typeof image === "string" && image.startsWith("https://")
				? image
				: null,
			standard,
		}];
	});
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const url = new URL(request.url);
	const owner = url.searchParams.get("owner") ?? "";
	const cluster = parseCluster(url.searchParams.get("cluster"));

	if (!BASE58.test(owner) || !cluster) return errorResponse(400, "Bad request");

	const endpoint = cluster === "mainnet"
		? app.env.DAS_RPC_URL
		: cluster === "devnet"
		? app.env.DAS_RPC_URL_DEVNET
		: undefined;

	if (!endpoint) {
		return jsonResponse({
			items: [],
			source: "unavailable",
			message:
				"NFT discovery is not set up here. Paste the NFT's mint address instead.",
		});
	}

	try {
		const upstream = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: "lootbox",
				method: "getAssetsByOwner",
				params: { ownerAddress: owner, page: 1, limit: 100 },
			}),
			signal: AbortSignal.timeout(8_000),
		});

		if (!upstream.ok) throw new Error(`DAS returned ${upstream.status}`);

		return jsonResponse({
			items: parseAssets(await upstream.json()),
			source: "live",
		});
	} catch (error) {
		console.error("DAS lookup failed", error);

		return jsonResponse({
			items: [],
			source: "unavailable",
			message:
				"NFT discovery did not answer. Paste the NFT's mint address instead.",
		});
	}
}
