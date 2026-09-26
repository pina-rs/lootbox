/**
 * Launch a draft: create the box mint and treasury, escrow every prize, and
 * publish the page. Every step is resumable.
 *
 * Resumability rests on two values chosen before the first signature and
 * pinned on the server: the template id (which fixes the template PDA) and
 * the box mint address. The mint's throwaway keypair seed stays in this
 * browser's storage only until the mint exists; afterwards the SDK needs just
 * its address. `LootboxClient.createTemplate` re-reads the chain and skips
 * every confirmed step, so pressing Resume after a reload never repeats one.
 */
import {
	type ClientProgress,
	createTemplatePlan,
	LootboxClient,
	type PrizeBundleInput,
	SWITCHBOARD_PROGRAM,
	SWITCHBOARD_QUEUE,
	type TemplatePlan,
} from "@pina-rs/lootbox";
import {
	type Address,
	address,
	createKeyPairSignerFromPrivateKeyBytes,
	createNoopSigner,
	type TransactionSigner,
} from "@solana/kit";

import { fromBase64, toBase64 } from "../lib/bytes.js";
import type { ClusterInfo } from "../lib/clusters.js";
import { draftBundlesToInputs } from "../lib/plan.js";
import type { DraftBundle, DraftData } from "../lib/schemas.js";

/** The local Surfpool emulator is deployed at Switchboard's devnet id. */
const LOCAL_ORACLE_PROGRAM = address(
	"Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2",
);

type LaunchKeys = Readonly<{ templateId: string; mintSeed: string }>;

function storageKey(draftId: string): string {
	return `lootbox:launch:${draftId}`;
}

function readKeys(draftId: string): LaunchKeys | null {
	try {
		const raw = localStorage.getItem(storageKey(draftId));
		const value: unknown = raw ? JSON.parse(raw) : null;

		if (
			typeof value === "object" && value !== null &&
			typeof Reflect.get(value, "templateId") === "string" &&
			typeof Reflect.get(value, "mintSeed") === "string"
		) {
			return value as LaunchKeys;
		}
	} catch {
		// Unreadable storage behaves like a first launch from this browser.
	}

	return null;
}

function writeKeys(draftId: string, keys: LaunchKeys): void {
	localStorage.setItem(storageKey(draftId), JSON.stringify(keys));
}

export function forgetKeys(draftId: string): void {
	try {
		localStorage.removeItem(storageKey(draftId));
	} catch {
		// Nothing to forget.
	}
}

/** A random u64 template id that fits in a JS safe integer for readability. */
function newTemplateId(): bigint {
	const bytes = crypto.getRandomValues(new Uint8Array(6));

	return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
}

export function oracleFor(
	cluster: ClusterInfo,
): { program: Address; queue: Address } {
	if (cluster.cluster === "localnet") {
		if (!cluster.localOracle) throw new Error("Local oracle is not configured");

		return {
			program: LOCAL_ORACLE_PROGRAM,
			queue: address(cluster.localOracle.queue),
		};
	}

	return {
		program: SWITCHBOARD_PROGRAM[cluster.cluster],
		queue: SWITCHBOARD_QUEUE[cluster.cluster],
	};
}

export function metadataUri(origin: string, boxMint: string): string {
	return `${origin}/m/${boxMint}.json`;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data: unknown = await response.json();

	if (!response.ok) {
		const message = typeof data === "object" && data !== null
			? Reflect.get(data, "error")
			: null;

		throw new Error(typeof message === "string" ? message : "Request failed");
	}

	return data;
}

export type LaunchIdentity = Readonly<{
	templateId: bigint;
	template: Address;
	boxMint: Address;
	mintSigner: TransactionSigner;
}>;

/**
 * Choose (or recover) the template id and box mint, and pin them on the
 * server before anything is signed.
 */
export async function prepareIdentity(
	input: Readonly<{
		draftId: string;
		client: LootboxClient;
		pinned: Readonly<{ template: string | null; boxMint: string | null }>;
	}>,
): Promise<LaunchIdentity> {
	const stored = readKeys(input.draftId);

	if (stored) {
		const seed = fromBase64(stored.mintSeed);
		const mintSigner = await createKeyPairSignerFromPrivateKeyBytes(seed);
		const templateId = BigInt(stored.templateId);
		const [template] = await input.client.templateAddress(templateId);

		await postJson(`/api/drafts/${input.draftId}/signing`, {
			templateId: templateId.toString(),
			template,
			boxMint: mintSigner.address,
		});

		return { templateId, template, boxMint: mintSigner.address, mintSigner };
	}

	if (input.pinned.template && input.pinned.boxMint) {
		// The template id and mint seed live in the browser that started this
		// launch; without them this browser cannot sign the next step safely.
		throw new Error(
			"This launch was started in another browser. Finish it there, or start a new lootbox.",
		);
	}

	const seed = crypto.getRandomValues(new Uint8Array(32));
	const mintSigner = await createKeyPairSignerFromPrivateKeyBytes(seed);
	const templateId = newTemplateId();
	const [template] = await input.client.templateAddress(templateId);

	writeKeys(input.draftId, {
		templateId: templateId.toString(),
		mintSeed: toBase64(seed),
	});
	await postJson(`/api/drafts/${input.draftId}/signing`, {
		templateId: templateId.toString(),
		template,
		boxMint: mintSigner.address,
	});

	return { templateId, template, boxMint: mintSigner.address, mintSigner };
}

/** SDK bundle inputs, deriving each standard NFT's metadata account. */
export async function prizeInputs(
	client: LootboxClient,
	bundles: readonly DraftBundle[],
): Promise<PrizeBundleInput[]> {
	const metadata = new Map<string, Address>();

	for (const bundle of bundles) {
		for (const asset of bundle.assets) {
			if (asset.kind === "nft" && asset.standard === "tokenMetadata") {
				metadata.set(asset.mint, await client.metadataPda(address(asset.mint)));
			}
		}
	}

	return draftBundlesToInputs(bundles, (mint) => {
		const pda = metadata.get(mint);

		if (!pda) throw new Error(`missing metadata account for ${mint}`);

		return pda;
	});
}

/** The exact checked plan the SDK will execute for this draft. */
export async function launchPlan(
	client: LootboxClient,
	data: DraftData,
	uri: string,
): Promise<TemplatePlan> {
	return createTemplatePlan({
		name: data.details.name.trim(),
		uri,
		opensAt: BigInt(data.details.revealAt ?? 0),
		bundles: await prizeInputs(client, data.bundles),
	});
}

export type LaunchResult = Readonly<{ slug: string }>;

export async function launchLootbox(
	input: Readonly<{
		draftId: string;
		data: DraftData;
		cluster: ClusterInfo;
		origin: string;
		signer: TransactionSigner;
		pinned: Readonly<{ template: string | null; boxMint: string | null }>;
		progress: ClientProgress;
		onIdentity: (identity: LaunchIdentity) => void;
	}>,
): Promise<LaunchResult> {
	const client = new LootboxClient(
		input.cluster.rpcUrl,
		input.signer,
		input.progress,
	);
	const identity = await prepareIdentity({
		draftId: input.draftId,
		client,
		pinned: input.pinned,
	});

	input.onIdentity(identity);

	const plan = await launchPlan(
		client,
		input.data,
		metadataUri(input.origin, identity.boxMint),
	);
	const oracle = oracleFor(input.cluster);
	const mintExists = await client.rpc.getAccountInfo(identity.boxMint, {
		encoding: "base64",
	}).send();

	await client.createTemplate(
		plan,
		identity.templateId,
		mintExists.value ? createNoopSigner(identity.boxMint) : identity.mintSigner,
		oracle.program,
		oracle.queue,
		{ symbol: input.data.details.symbol.trim() },
	);

	const published = await postJson("/api/lootboxes", {
		draftId: input.draftId,
		template: identity.template,
	});
	const slug = typeof published === "object" && published !== null
		? Reflect.get(published, "slug")
		: null;

	if (typeof slug !== "string") throw new Error("Publishing returned no page");

	forgetKeys(input.draftId);

	return { slug };
}
