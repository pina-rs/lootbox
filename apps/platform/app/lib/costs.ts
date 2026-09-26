/**
 * What launching a lootbox costs, in lamports, before anything is signed.
 *
 * Rent is linear in account size: `rent(n) = rent(0) × (128 + n) / 128`, so one
 * `getMinimumBalanceForRentExemption(0)` call prices every account exactly.
 * Account sizes mirror the SDK's creation path (`LootboxClient.createTemplate`).
 */
import type { DraftBundle } from "./schemas.js";

/** Solana's fixed account storage overhead, in bytes. */
const ACCOUNT_OVERHEAD = 128n;
/** Base fee for one signature. */
export const SIGNATURE_FEE = 5_000n;
/** Fixed template header; each activated bundle appends one `u64` slot. */
export const TEMPLATE_HEADER_BYTES = 548n;
export const TEMPLATE_BYTES_PER_BUNDLE = 8n;
/** Classic SPL token account. */
export const CLASSIC_TOKEN_ACCOUNT_BYTES = 165n;
/** Token-2022 associated account: base, account type, ImmutableOwner. */
export const TOKEN_2022_ACCOUNT_BYTES = 170n;
/** Extra `TransferFeeAmount` extension on accounts of fee-bearing mints. */
export const TRANSFER_FEE_ACCOUNT_BYTES = 12n;
/** `ExclusiveAttachmentState`, created when a bundle attaches the collection. */
export const EXCLUSIVE_ATTACHMENT_BYTES = 157n;
/** Bubblegum V2 `mint_v2` fee, escrowed per consolation box. */
export const EXCLUSIVE_MINT_FEE = 90_000n;

const utf8 = new TextEncoder();

export function rentFor(bytes: bigint, rentForZeroBytes: bigint): bigint {
	return rentForZeroBytes * (ACCOUNT_OVERHEAD + bytes) / ACCOUNT_OVERHEAD;
}

/** Box mint size once Token-2022 metadata is written (see the SDK). */
export function boxMintBytes(
	name: string,
	symbol: string,
	uri: string,
): bigint {
	return BigInt(
		234 + 4 + 64 + 4 + utf8.encode(name).length + 4 +
			utf8.encode(symbol).length + 4 + utf8.encode(uri).length + 4,
	);
}

export type CostLine = Readonly<{
	key: string;
	label: string;
	lamports: bigint;
	note: string;
}>;

export type CreationCost = Readonly<{
	lines: readonly CostLine[];
	transactions: number;
	/** SOL leaving the creator's wallet, including SOL prizes. */
	totalLamports: bigint;
}>;

/**
 * Exact SOL needed to create, fund, and publish a treasury.
 *
 * `bundleBytes` is the fixed `BundleState` size from the generated client.
 * Token-2022 escrow accounts are priced with ImmutableOwner plus the
 * transfer-fee extension when the prize is an issuer stock; other rare account
 * extensions would add a few bytes, so that line is labelled an estimate.
 */
export function creationCost(
	input: Readonly<{
		name: string;
		symbol: string;
		uri: string;
		bundles: readonly DraftBundle[];
		bundleBytes: bigint;
		rentForZeroBytes: bigint;
		/** Boxes holding an Exclusive Lootbox NFT consolation (0 for none). */
		consolationBoxes?: number;
	}>,
): CreationCost {
	const rent = (bytes: bigint) => rentFor(bytes, input.rentForZeroBytes);
	const consolation = BigInt(input.consolationBoxes ?? 0);
	const bundleCount = BigInt(input.bundles.length) +
		(consolation > 0n ? 1n : 0n);
	let solPrizes = 0n;
	let escrowAccounts = 0n;
	let escrowIsEstimate = false;
	let transactions = 3; // box mint, template, publish

	for (const bundle of input.bundles) {
		transactions += 2 + bundle.assets.length; // add, fund each, activate

		for (const asset of bundle.assets) {
			if (asset.kind === "sol") {
				solPrizes += BigInt(asset.lamports) * BigInt(bundle.quantity);
				continue;
			}

			if (asset.kind === "nft") {
				if (asset.standard === "tokenMetadata") {
					escrowAccounts += rent(CLASSIC_TOKEN_ACCOUNT_BYTES);
				}

				continue;
			}

			const isClassic = asset.tokenProgram ===
				"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

			if (isClassic) {
				escrowAccounts += rent(CLASSIC_TOKEN_ACCOUNT_BYTES);
				continue;
			}

			escrowIsEstimate = true;
			escrowAccounts += rent(
				TOKEN_2022_ACCOUNT_BYTES +
					(asset.issuer ? TRANSFER_FEE_ACCOUNT_BYTES : 0n),
			);
		}
	}

	if (consolation > 0n) transactions += 3; // add, attach, activate

	// The box-mint transaction carries two signatures: creator and new mint.
	const fees = BigInt(transactions + 1) * SIGNATURE_FEE;
	const lines: CostLine[] = [
		{
			key: "prizes",
			label: "SOL prizes held in escrow",
			lamports: solPrizes,
			note: "Paid out to winners",
		},
		{
			key: "mint",
			label: "Box token mint",
			lamports: rent(boxMintBytes(input.name, input.symbol, input.uri)),
			note: "Rent for the Token-2022 mint and its metadata",
		},
		{
			key: "template",
			label: "Treasury account",
			lamports: rent(
				TEMPLATE_HEADER_BYTES + TEMPLATE_BYTES_PER_BUNDLE * bundleCount,
			),
			note: "Grows 8 bytes per bundle",
		},
		{
			key: "bundles",
			label: "Bundle accounts",
			lamports: rent(input.bundleBytes) * bundleCount,
			note: `${bundleCount} × one escrow record`,
		},
		{
			key: "escrow",
			label: "Prize token escrow accounts",
			lamports: escrowAccounts,
			note: escrowIsEstimate
				? "Estimate: Token-2022 accounts may carry extra extensions"
				: "One token account per token or NFT prize",
		},
		{
			key: "exclusive",
			label: "Exclusive Lootbox NFT mint fees",
			lamports: consolation > 0n
				? consolation * EXCLUSIVE_MINT_FEE + rent(EXCLUSIVE_ATTACHMENT_BYTES) +
					rent(0n)
				: 0n,
			note: "Escrowed; unused fees come back",
		},
		{
			key: "fees",
			label: "Network fees",
			lamports: fees,
			note: `${transactions} transactions`,
		},
	];

	return {
		lines: lines.filter((line) => line.lamports > 0n),
		transactions,
		totalLamports: lines.reduce((sum, line) => sum + line.lamports, 0n),
	};
}
