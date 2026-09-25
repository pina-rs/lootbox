/**
 * Launch a token-prize treasury from a JSON plan.
 *
 *   pnpm --dir sdks/typescript launch:treasury -- \
 *     --plan treasury.json --cluster devnet --keypair ~/devnet.json \
 *     [--rpc URL] [--state treasury.launch.json] [--execute]
 *
 * Without `--execute` the script prints a dry-run summary and sends nothing.
 * With it, the script creates and funds the template through the SDK's
 * resumable `createTemplate`, then locks the treasury, which mints the exact
 * box supply to the plan's `supplyRecipient`. Re-running after an
 * interruption continues from on-chain state.
 *
 * The state file (default: the plan path with `.launch.json`) pins the
 * template id and the box mint key so every run targets the same treasury.
 * It holds throwaway mint keys whose authority moves to the treasury on
 * creation; `*.launch.json` is gitignored.
 *
 * Plan file:
 *
 *   {
 *     "name": "Pre-IPO Mystery Box",
 *     "symbol": "PREBOX",
 *     "uri": "https://example.com/box.json",
 *     "revealAt": "2026-09-26T18:00:00Z",
 *     "supplyRecipient": "<address>",
 *     "bundles": [
 *       { "label": "PreStock X", "quantity": 3,
 *         "assets": [{ "kind": "token", "mint": "<mint>", "amount": "1000000" }] },
 *       { "label": "Empty box", "quantity": 13, "assets": [
 *         { "kind": "mintBadge", "create": { "name": "Empty Box", "symbol": "EMPTY", "uri": "<uri>" } },
 *         { "kind": "sol", "lamports": "1000000" } ] }
 *     ]
 *   }
 *
 * Assets: `token` (`amount` in raw base units per win; issuer transfer fees
 * are grossed up on-chain at funding, and the summary shows the gross the
 * creator must hold), `sol` (`lamports` per win), and `mintBadge` (one badge
 * minted per claim), either an existing `mint` or `create`, which makes a
 * zero-decimal Token-2022 mint whose on-mint metadata is immutable. See
 * `plans/unlisted-mainnet.example.json`.
 */
import {
	fetchMaybeToken,
	fetchMint,
	findAssociatedTokenPda,
	getTokenSize,
	TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
	type Address,
	address,
	createKeyPairSignerFromPrivateKeyBytes,
	createSolanaRpc,
	type KeyPairSigner,
} from "@solana/kit";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
	CLASSIC_TOKEN_PROGRAM,
	createTemplatePlan,
	fetchMaybeTemplateState,
	getBundleStateEncoder,
	getResultReceiptStateEncoder,
	grossForNetTransfer,
	LootboxClient,
	type PrizeAsset,
	type PrizeBundleInput,
	requiredServiceBudget,
	SWITCHBOARD_PROGRAM,
	SWITCHBOARD_QUEUE,
} from "../src/index.js";
import {
	installPatientFetch,
	loadKeypair,
	parseArgs,
	parseCluster,
	verifiedRpcUrl,
} from "./cli.js";

type BadgeMetadata = Readonly<{ name: string; symbol: string; uri: string }>;
type AssetInput =
	| Readonly<{ kind: "token"; mint: string; amount: string }>
	| Readonly<{ kind: "sol"; lamports: string }>
	| Readonly<{ kind: "mintBadge"; mint: string }>
	| Readonly<{ kind: "mintBadge"; create: BadgeMetadata }>;
type BundleInput = Readonly<{
	label: string;
	quantity: number | string;
	assets: readonly AssetInput[];
}>;
type PlanFile = Readonly<{
	name: string;
	symbol: string;
	uri: string;
	revealAt: string | number;
	supplyRecipient: string;
	settlementBountyLamports?: string;
	resultReceiptsEnabled?: boolean;
	bundles: readonly BundleInput[];
}>;
type LaunchState = Readonly<{
	templateId: string;
	boxMintSeed: number[];
	/** Badge mint keys by `bundle:asset` index, for `mintBadge.create`. */
	badgeMintSeeds: Readonly<Record<string, number[]>>;
}>;
type MintInfo = Readonly<{
	address: Address;
	program: Address;
	decimals: number;
	feeBps: number;
	maxFee: bigint;
	balance: bigint;
}>;

function readPlan(path: string): PlanFile {
	const plan: PlanFile = JSON.parse(readFileSync(path, "utf8"));

	if (!plan.name || !plan.symbol || !plan.supplyRecipient) {
		throw new Error("plan needs name, symbol, and supplyRecipient");
	}

	if (!Array.isArray(plan.bundles) || plan.bundles.length === 0) {
		throw new Error("plan needs at least one bundle");
	}

	for (const bundle of plan.bundles) {
		for (const asset of bundle.assets) {
			if (!["token", "sol", "mintBadge"].includes(asset.kind)) {
				throw new Error(`unsupported asset kind ${String(asset.kind)}`);
			}
		}
	}

	return plan;
}

function revealTimestamp(value: string | number) {
	const seconds = typeof value === "number"
		? value
		: Math.floor(Date.parse(value) / 1000);

	if (!Number.isSafeInteger(seconds) || seconds <= 0) {
		throw new Error(`invalid revealAt ${value}`);
	}

	return BigInt(seconds);
}

/** Load the launch state, adding a key for every badge the plan creates.
 * Keys are generated once and persisted before any transaction, so a
 * resumed launch reuses the same mints.
 */
function readOrCreateState(path: string, plan: PlanFile): LaunchState {
	const saved: Partial<LaunchState> = existsSync(path)
		? JSON.parse(readFileSync(path, "utf8"))
		: {};
	const badgeMintSeeds = { ...saved.badgeMintSeeds };

	for (const [bundleIndex, bundle] of plan.bundles.entries()) {
		for (const [assetIndex, asset] of bundle.assets.entries()) {
			const key = `${bundleIndex}:${assetIndex}`;

			if ("create" in asset && !badgeMintSeeds[key]) {
				badgeMintSeeds[key] = Array.from(randomBytes(32));
			}
		}
	}

	const state: LaunchState = {
		templateId: saved.templateId ?? BigInt(Date.now()).toString(),
		boxMintSeed: saved.boxMintSeed ?? Array.from(randomBytes(32)),
		badgeMintSeeds,
	};

	writeFileSync(path, `${JSON.stringify(state)}\n`, { mode: 0o600 });

	return state;
}

function signerFromSeed(seed: readonly number[] | undefined) {
	if (!seed) throw new Error("launch state is missing a mint key");

	return createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from(seed));
}

installPatientFetch();

const args = parseArgs(process.argv.slice(2));
const planPath = args.required("plan");
const cluster = parseCluster(args.required("cluster"));
const execute = args.flag("execute");
const rpcUrl = await verifiedRpcUrl(cluster, args.optional("rpc"));
const rpc = createSolanaRpc(rpcUrl);
const payer = await loadKeypair(args.required("keypair"));
const file = readPlan(planPath);
const statePath = args.optional("state") ??
	planPath.replace(/\.json$/, "") + ".launch.json";
const state = readOrCreateState(statePath, file);
const boxMint = await createKeyPairSignerFromPrivateKeyBytes(
	Uint8Array.from(state.boxMintSeed),
);
const client = new LootboxClient(rpcUrl, payer, (message, signature) => {
	console.log(signature ? `✓ ${message}  ${signature}` : `… ${message}`);
});
const { epoch } = await rpc.getEpochInfo().send();
const mints = new Map<Address, MintInfo>();

for (const bundle of file.bundles) {
	for (const asset of bundle.assets) {
		if (asset.kind !== "token") continue;

		const key = address(asset.mint);

		if (mints.has(key)) continue;

		const mint = await fetchMint(rpc, key);
		const program = mint.programAddress;
		const feeConfig = mint.data.extensions.__option === "Some"
			? mint.data.extensions.value.find((entry) =>
				entry.__kind === "TransferFeeConfig"
			)
			: undefined;
		const schedule = feeConfig?.__kind === "TransferFeeConfig"
			? epoch >= feeConfig.newerTransferFee.epoch
				? feeConfig.newerTransferFee
				: feeConfig.olderTransferFee
			: undefined;
		const [source] = await findAssociatedTokenPda({
			owner: payer.address,
			mint: key,
			tokenProgram: program,
		});
		// A missing source account holds nothing; any RPC failure propagates.
		const sourceAccount = await fetchMaybeToken(rpc, source);
		const balance = sourceAccount.exists ? sourceAccount.data.amount : 0n;

		mints.set(key, {
			address: key,
			program,
			decimals: mint.data.decimals,
			feeBps: schedule?.transferFeeBasisPoints ?? 0,
			maxFee: schedule?.maximumFee ?? 0n,
			balance,
		});
	}
}

const badgesToCreate: Array<
	Readonly<
		{ bundleIndex: number; signer: KeyPairSigner; metadata: BadgeMetadata }
	>
> = [];

async function prizeAsset(
	asset: AssetInput,
	bundleIndex: number,
	assetIndex: number,
): Promise<PrizeAsset> {
	if (asset.kind === "sol") {
		return { kind: "sol", lamports: BigInt(asset.lamports) };
	}

	if (asset.kind === "mintBadge" && "create" in asset) {
		const signer = await signerFromSeed(
			state.badgeMintSeeds[`${bundleIndex}:${assetIndex}`],
		);

		badgesToCreate.push({ bundleIndex, signer, metadata: asset.create });

		return {
			kind: "mintBadge",
			mint: signer.address,
			tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
			name: asset.create.name,
		};
	}

	if (asset.kind === "mintBadge") {
		const mint = await fetchMint(rpc, address(asset.mint));

		return {
			kind: "mintBadge",
			mint: mint.address,
			tokenProgram: mint.programAddress,
		};
	}

	const mint = mints.get(address(asset.mint));

	if (!mint) throw new Error(`mint ${asset.mint} was not loaded`);

	return {
		kind: "token",
		mint: mint.address,
		amount: BigInt(asset.amount),
		tokenProgram: mint.program,
		decimals: mint.decimals,
	};
}

const bundles: PrizeBundleInput[] = [];

for (const [bundleIndex, bundle] of file.bundles.entries()) {
	const assets: PrizeAsset[] = [];

	for (const [assetIndex, asset] of bundle.assets.entries()) {
		assets.push(await prizeAsset(asset, bundleIndex, assetIndex));
	}

	bundles.push({
		label: bundle.label,
		quantity: BigInt(bundle.quantity),
		assets,
	});
}
const plan = createTemplatePlan({
	name: file.name,
	uri: file.uri,
	opensAt: revealTimestamp(file.revealAt),
	settlementBountyLamports: BigInt(file.settlementBountyLamports ?? "0"),
	resultReceiptsEnabled: file.resultReceiptsEnabled ?? false,
	bundles,
});
const templateId = BigInt(state.templateId);
const [template] = await client.templateAddress(templateId);

// Dry-run summary.
const gross = new Map<Address, bigint>();
const net = new Map<Address, bigint>();
let solPrizes = 0n;

console.log(`cluster          ${cluster} (${rpcUrl})`);
console.log(`creator          ${payer.address}`);
console.log(`treasury         ${template} (id ${templateId})`);
console.log(`box mint         ${boxMint.address} (${file.symbol})`);
console.log(`supply recipient ${file.supplyRecipient}`);
console.log(
	`reveal           ${new Date(Number(plan.opensAt) * 1000).toISOString()}`,
);
console.log(`box supply       ${plan.fixedSupply}`);
console.log(
	`oracle           ${SWITCHBOARD_PROGRAM[cluster]} queue ${
		SWITCHBOARD_QUEUE[cluster]
	}`,
);
console.log("\nbundles");

for (const [index, bundle] of plan.bundles.entries()) {
	console.log(
		`  ${index + 1}. ${bundle.label} × ${bundle.quantity} (${
			bundle.probabilityPercent.toFixed(2)
		}%)`,
	);

	for (const asset of bundle.assets) {
		if (asset.kind === "sol") {
			solPrizes += asset.lamports * bundle.quantity;
			console.log(
				`       ${asset.lamports} lamports per win; escrow ${
					asset.lamports * bundle.quantity
				}`,
			);
			continue;
		}

		if (asset.kind === "mintBadge") {
			console.log(
				`       1 ${
					asset.name ?? "badge"
				} per win, minted on claim from ${asset.mint}`,
			);
			continue;
		}

		if (asset.kind !== "token") continue;

		const mint = mints.get(asset.mint);

		if (!mint) continue;

		// The program grosses up each funding transfer (one per bundle asset).
		const deposit = asset.amount * bundle.quantity;
		const transfer = grossForNetTransfer(deposit, {
			basisPoints: mint.feeBps,
			maximumFee: mint.maxFee,
		});

		if (transfer === undefined) {
			throw new Error(
				`no transfer credits exactly ${deposit} of ${asset.mint}`,
			);
		}

		net.set(mint.address, (net.get(mint.address) ?? 0n) + deposit);
		gross.set(mint.address, (gross.get(mint.address) ?? 0n) + transfer);
		console.log(
			`       ${asset.amount} raw of ${asset.mint} per win; escrow ${deposit}, send ${transfer}`,
		);
	}
}

console.log("\ntoken totals (raw base units)");

let tokensShort = false;

for (const mint of mints.values()) {
	const required = gross.get(mint.address) ?? 0n;
	const short = mint.balance < required;

	tokensShort ||= short;
	console.log(
		`  ${mint.address} ${
			mint.program === TOKEN_2022_PROGRAM_ADDRESS ? "Token-2022" : "SPL"
		} · escrow ${net.get(mint.address)} · issuer fee ${
			required - (net.get(mint.address) ?? 0n)
		} (${mint.feeBps} bps) · send ${required} · you hold ${mint.balance}${
			short ? "  ← INSUFFICIENT" : ""
		}`,
	);
}

const rent = async (bytes: number) =>
	rpc.getMinimumBalanceForRentExemption(BigInt(bytes)).send();
const escrowRent = await Promise.all(
	plan.bundles.flatMap((bundle) =>
		bundle.assets.flatMap((asset) =>
			asset.kind !== "token"
				? []
				: asset.tokenProgram !== CLASSIC_TOKEN_PROGRAM
				? [rent(getTokenSize([
					{ __kind: "TransferFeeAmount", withheldAmount: 0n },
					{ __kind: "ImmutableOwner" },
				]))]
				: [rent(165)]
		)
	),
);
const badgeMintRent = (await Promise.all(
	badgesToCreate.map(({ metadata }) =>
		rent(
			322 + metadata.name.length + metadata.symbol.length +
				metadata.uri.length,
		)
	),
)).reduce((sum, value) => sum + value, 0n);
// 548-byte header plus one u64 of remaining inventory per bundle.
const templateRent = await rent(548 + 8 * plan.bundles.length);
const bundleRent = (await rent(getBundleStateEncoder().fixedSize)) *
	BigInt(plan.bundles.length);
const boxMintRent = await rent(
	322 + file.name.length + file.symbol.length + file.uri.length,
);
const serviceBudget = requiredServiceBudget(
	plan,
	plan.resultReceiptsEnabled
		? await rent(getResultReceiptStateEncoder().fixedSize)
		: 0n,
	plan.resultReceiptsEnabled || plan.settlementBountyLamports > 0n
		? await rent(0)
		: 0n,
);
const recipientAtaRent = await rent(170);
const fees = 5_000n * BigInt(8 + plan.bundles.length * 3);
const solTotal = templateRent + bundleRent + boxMintRent + badgeMintRent +
	solPrizes +
	escrowRent.reduce((sum, value) => sum + value, 0n) + serviceBudget +
	recipientAtaRent + fees;
const { value: solBalance } = await rpc.getBalance(payer.address).send();

console.log("\nSOL (lamports, ≈ upper bound)");
console.log(`  template state        ${templateRent}`);
console.log(`  bundle states         ${bundleRent}`);
console.log(`  box mint + metadata   ${boxMintRent}`);
console.log(`  badge mints           ${badgeMintRent}`);
console.log(`  SOL prizes            ${solPrizes}`);
console.log(
	`  prize escrows         ${
		escrowRent.reduce((sum, value) => sum + value, 0n)
	}`,
);
console.log(`  service budget        ${serviceBudget}`);
console.log(`  recipient box account ${recipientAtaRent}`);
console.log(`  transaction fees      ${fees}`);
console.log(
	`  total                 ${solTotal} (you hold ${solBalance})${
		solBalance < solTotal ? "  ← INSUFFICIENT" : ""
	}`,
);

const existing = await fetchMaybeTemplateState(rpc, template);

if (existing.exists && existing.data.lockedAt !== 0n) {
	console.log(`\ntreasury already locked at ${existing.data.lockedAt}`);
	console.log(`VITE_TREASURY=${template}`);
	process.exit(0);
}

if (!execute) {
	console.log("\ndry run: nothing sent. Re-run with --execute to launch.");
	process.exit(0);
}

if (tokensShort || solBalance < solTotal) {
	throw new Error("insufficient balance for the launch; see the summary");
}

const now = BigInt(Math.floor(Date.now() / 1000));

if (plan.opensAt <= now + 60n) {
	throw new Error("revealAt must be at least a minute in the future to lock");
}

for (const { bundleIndex, signer, metadata } of badgesToCreate) {
	const [bundle] = await client.bundleAddress(template, bundleIndex);

	await client.createMetadataBadgeMint(signer, metadata, bundle);
}

const created = await client.createTemplate(
	plan,
	templateId,
	boxMint,
	SWITCHBOARD_PROGRAM[cluster],
	SWITCHBOARD_QUEUE[cluster],
	{ symbol: file.symbol },
);
const locked = await client.lockTreasury(
	created,
	address(file.supplyRecipient),
);

console.log(`\ntreasury ${locked.address} locked`);
console.log(`box mint ${locked.data.boxMint}`);
console.log(`VITE_TREASURY=${locked.address}`);
