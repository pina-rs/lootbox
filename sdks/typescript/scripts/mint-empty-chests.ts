/**
 * Mint the 13 Empty Chest compressed NFTs into a dedicated Bubblegum V1 tree.
 *
 *   pnpm --dir sdks/typescript mint:empty-chests -- \
 *     --cluster devnet --keypair ~/devnet.json [--rpc URL] [--execute]
 *
 * Without `--execute` the script prints the tree shape, rent, and fees and
 * sends nothing. With it, the script:
 *
 * 1. creates a Bubblegum V1 tree (max depth 5, buffer 8, no canopy): 32 leaf
 *    slots, a 5-node proof that stays far below the lootbox program's
 *    16-proof-account cap;
 * 2. mints one leaf per variant to the keypair (the PrizePool creator) with
 *    `isMutable: false`, which PrizePool admission requires, and the hosted
 *    `nft/empty-chest/<variant>.json` URI;
 * 3. writes `apps/web/public/nft/empty-chest/assets.json` (asset id → variant,
 *    leaf index) so the website shows the chest a winner received.
 *
 * Leaf index equals variant, so a re-run resumes from the tree config's
 * `numMinted`. The state file (`empty-chests.<cluster>.launch.json`,
 * gitignored) holds the tree keypair until its account exists.
 *
 * Minting needs only a normal RPC. Depositing the leaves into a PrizePool and
 * claiming them later needs a DAS-capable RPC for proofs; see
 * docs/compressed-nft-empty-boxes.md.
 */
import {
	createTree,
	fetchTreeConfigFromSeeds,
	findLeafAssetIdPda,
	mintV1,
	mplBubblegum,
	safeFetchTreeConfigFromSeeds,
	TokenProgramVersion,
	TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";
import { getMerkleTreeSize } from "@metaplex-foundation/spl-account-compression";
import {
	createSignerFromKeypair,
	type KeypairSigner,
	none,
	publicKey,
	signerIdentity,
	some,
	type Umi,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
	EMPTY_CHESTS,
	emptyChestLeafName,
} from "../../../apps/web/src/launch/emptyChests.js";
import {
	installPatientFetch,
	parseArgs,
	parseCluster,
	verifiedRpcUrl,
} from "./cli.js";

/** 2^5 = 32 leaves for 13 chests; a valid SPL Account Compression pair. */
const MAX_DEPTH = 5;
const MAX_BUFFER_SIZE = 8;
/** The whole 5-node proof fits in a transaction, so no canopy is needed. */
const CANOPY_DEPTH = 0;
const PROGRAM_PROOF_CAP = 16;
const SIGNATURE_FEE = 5_000n;
const LAMPORTS_PER_SOL = 1_000_000_000n;
const URI_BASE = "https://pina-rs.github.io/lootbox/nft/empty-chest/";
const MANIFEST = new URL(
	"../../../apps/web/public/nft/empty-chest/assets.json",
	import.meta.url,
);

type MintState = Readonly<{ cluster: string; treeSecretKey: number[] }>;

function isMintState(value: unknown): value is MintState {
	if (typeof value !== "object" || value === null) return false;

	const { cluster, treeSecretKey } = value as Record<string, unknown>;

	return typeof cluster === "string" && Array.isArray(treeSecretKey) &&
		treeSecretKey.length === 64 &&
		treeSecretKey.every((byte) => Number.isInteger(byte));
}

function sol(lamports: bigint): string {
	const whole = lamports / LAMPORTS_PER_SOL;
	const fraction = (lamports % LAMPORTS_PER_SOL).toString().padStart(9, "0");

	return `${whole}.${fraction} SOL`;
}

function loadUmiKeypair(umi: Umi, path: string): KeypairSigner {
	const bytes: unknown = JSON.parse(
		readFileSync(resolve(process.cwd(), path), "utf8"),
	);

	if (!Array.isArray(bytes) || bytes.length !== 64) {
		throw new Error(`${path} is not a 64-byte Solana keypair file`);
	}

	const keypair = umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(bytes));

	return createSignerFromKeypair(umi, keypair);
}

/** Reuse the saved tree key so an interrupted creation retries the same address. */
function treeSigner(
	umi: Umi,
	statePath: string,
	cluster: string,
): KeypairSigner {
	if (existsSync(statePath)) {
		const state: unknown = JSON.parse(readFileSync(statePath, "utf8"));

		if (!isMintState(state)) {
			throw new Error(`${statePath} is not a mint state file`);
		}

		if (state.cluster !== cluster) {
			throw new Error(
				`${statePath} belongs to ${state.cluster}, not ${cluster}`,
			);
		}

		const keypair = umi.eddsa.createKeypairFromSecretKey(
			Uint8Array.from(state.treeSecretKey),
		);

		return createSignerFromKeypair(umi, keypair);
	}

	const keypair = umi.eddsa.generateKeypair();
	const state: MintState = {
		cluster,
		treeSecretKey: Array.from(keypair.secretKey),
	};

	writeFileSync(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });

	return createSignerFromKeypair(umi, keypair);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const cluster = parseCluster(args.required("cluster"));
	const execute = args.flag("execute");

	installPatientFetch();

	const rpcUrl = await verifiedRpcUrl(cluster, args.optional("rpc"));
	const umi = createUmi(rpcUrl, "confirmed").use(mplBubblegum());
	const payer = loadUmiKeypair(umi, args.required("keypair"));

	umi.use(signerIdentity(payer));

	const treeSize = getMerkleTreeSize(MAX_DEPTH, MAX_BUFFER_SIZE, CANOPY_DEPTH);
	const treeRent = (await umi.rpc.getRent(treeSize)).basisPoints;
	// TreeConfig: 8 discriminator + 2 × 32 keys + 2 × u64 + bool + 2 enums.
	const configRent =
		(await umi.rpc.getRent(8 + 32 + 32 + 8 + 8 + 1 + 1 + 1)).basisPoints;
	const balance = (await umi.rpc.getBalance(payer.publicKey)).basisPoints;
	const fees = SIGNATURE_FEE * 2n + SIGNATURE_FEE * BigInt(EMPTY_CHESTS.length);
	const total = treeRent + configRent + fees;
	const proofLength = MAX_DEPTH - CANOPY_DEPTH;

	console.log(`Empty Chest mint · ${cluster} · ${rpcUrl}`);
	console.log(`Creator and leaf owner: ${payer.publicKey}`);
	console.log(
		`Tree: Bubblegum V1, max depth ${MAX_DEPTH}, buffer ${MAX_BUFFER_SIZE}, canopy ${CANOPY_DEPTH} → ${
			2 ** MAX_DEPTH
		} leaves, ${treeSize} bytes`,
	);
	console.log(
		`Proof nodes per transfer: ${proofLength} (program cap ${PROGRAM_PROOF_CAP})`,
	);
	console.log(`Tree rent:        ${sol(treeRent)}`);
	console.log(`Tree config rent: ${sol(configRent)}`);
	console.log(`Fees (~${2 + EMPTY_CHESTS.length} signatures): ${sol(fees)}`);
	console.log(`Total:            ${sol(total)} (balance ${sol(balance)})`);
	console.log(`Per chest:        ${sol(total / BigInt(EMPTY_CHESTS.length))}`);

	for (const chest of EMPTY_CHESTS) {
		console.log(
			`  leaf ${chest.variant}: ${
				emptyChestLeafName(chest)
			} → ${URI_BASE}${chest.variant}.json`,
		);
	}

	if (proofLength > PROGRAM_PROOF_CAP) {
		throw new Error(
			"tree proof exceeds the lootbox program's proof-account cap",
		);
	}

	if (!execute) {
		console.log(
			"\nDry run: nothing was sent. Pass --execute to create the tree and mint.",
		);
		return;
	}

	const statePath = resolve(
		process.cwd(),
		`empty-chests.${cluster}.launch.json`,
	);
	const tree = treeSigner(umi, statePath, cluster);
	const existing = await safeFetchTreeConfigFromSeeds(umi, {
		merkleTree: tree.publicKey,
	});
	// A resumed run has already paid the tree rent and earlier mints, so it
	// needs fees only for the leaves still to mint.
	const remaining = existing
		? Math.max(EMPTY_CHESTS.length - Number(existing.numMinted), 0)
		: EMPTY_CHESTS.length;
	const required = existing ? SIGNATURE_FEE * BigInt(remaining) : total;

	if (balance < required) {
		throw new Error(`payer needs at least ${sol(required)}`);
	}

	if (!existing) {
		const builder = await createTree(umi, {
			merkleTree: tree,
			maxDepth: MAX_DEPTH,
			maxBufferSize: MAX_BUFFER_SIZE,
			canopyDepth: CANOPY_DEPTH,
			public: false,
		});

		await builder.sendAndConfirm(umi);
		console.log(`Created tree ${tree.publicKey}`);
	} else {
		console.log(`Resuming tree ${tree.publicKey}`);
	}

	const assets: Record<string, { variant: number; leafIndex: number }> = {};

	for (const chest of EMPTY_CHESTS) {
		const config = await fetchTreeConfigFromSeeds(umi, {
			merkleTree: tree.publicKey,
		});
		const minted = Number(config.numMinted);

		if (minted < chest.variant) {
			throw new Error(
				`tree has ${minted} leaves; expected at least ${chest.variant}`,
			);
		}

		if (minted === chest.variant) {
			await mintV1(umi, {
				leafOwner: payer.publicKey,
				merkleTree: tree.publicKey,
				metadata: {
					name: emptyChestLeafName(chest),
					symbol: "EMPTY",
					uri: `${URI_BASE}${chest.variant}.json`,
					sellerFeeBasisPoints: 0,
					primarySaleHappened: false,
					isMutable: false,
					editionNonce: none(),
					tokenStandard: some(TokenStandard.NonFungible),
					collection: none(),
					uses: none(),
					tokenProgramVersion: TokenProgramVersion.Original,
					creators: [{ address: payer.publicKey, verified: false, share: 100 }],
				},
			}).sendAndConfirm(umi);
		}

		const [assetId] = findLeafAssetIdPda(umi, {
			merkleTree: tree.publicKey,
			leafIndex: chest.variant,
		});

		assets[publicKey(assetId)] = {
			variant: chest.variant,
			leafIndex: chest.variant,
		};
		console.log(`  ${emptyChestLeafName(chest)} → ${assetId}`);
	}

	const manifest = { cluster, tree: tree.publicKey, assets };

	writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, "\t")}\n`);
	console.log(`Wrote ${MANIFEST.pathname}`);
}

main().catch((reason: unknown) => {
	console.error(reason instanceof Error ? reason.message : reason);
	process.exitCode = 1;
});
