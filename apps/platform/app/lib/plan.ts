/**
 * Turn a wizard draft into the SDK's checked treasury plan, and describe it.
 *
 * The draft is display-friendly (decimal strings, labels, catalog metadata);
 * the SDK plan is exact (bigints, addresses). Every number shown in the review
 * step comes from here so the UI and the transactions cannot disagree.
 */
import {
	createTemplatePlan,
	grossForNetTransfer,
	type PrizeAsset,
	type PrizeBundleInput,
	type TemplatePlan,
} from "@pina-rs/lootbox";
import { type Address, address } from "@solana/kit";

import type { DraftAsset, DraftBundle } from "./schemas.js";

export const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Convert one draft prize to an SDK prize. `metadataFor` derives the Token
 * Metadata PDA for a standard NFT (the SDK's escrow adapter needs it).
 */
export function draftAssetToPrize(
	asset: DraftAsset,
	metadataFor: (mint: Address) => Address,
): PrizeAsset {
	switch (asset.kind) {
		case "sol":
			return { kind: "sol", lamports: BigInt(asset.lamports) };
		case "token":
			return {
				kind: "token",
				mint: address(asset.mint),
				amount: BigInt(asset.amount),
				tokenProgram: address(asset.tokenProgram),
				decimals: asset.decimals,
				symbol: asset.symbol,
			};
		case "nft":
			return asset.standard === "core"
				? { kind: "core", asset: address(asset.mint), name: asset.name }
				: {
					kind: "nft",
					mint: address(asset.mint),
					name: asset.name,
					metadata: metadataFor(address(asset.mint)),
				};
	}
}

export function draftBundlesToInputs(
	bundles: readonly DraftBundle[],
	metadataFor: (mint: Address) => Address,
): PrizeBundleInput[] {
	return bundles.map((bundle) => ({
		label: bundle.label,
		quantity: BigInt(bundle.quantity),
		assets: bundle.assets.map((asset) => draftAssetToPrize(asset, metadataFor)),
	}));
}

export type PlanCheck =
	| Readonly<{ ok: true; plan: TemplatePlan }>
	| Readonly<{ ok: false; message: string }>;

/** Run the SDK planner and turn its error into one friendly sentence. */
export function checkPlan(
	input: Readonly<{
		name: string;
		uri: string;
		opensAt: bigint;
		bundles: readonly PrizeBundleInput[];
	}>,
): PlanCheck {
	try {
		return { ok: true, plan: createTemplatePlan(input) };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Invalid lootbox",
		};
	}
}

export type OddsRow = Readonly<{
	key: string;
	label: string;
	copies: bigint;
	/** Chance for the next box, 0 to 100. */
	percent: number;
}>;

/** Every box is one equal ticket: odds are copies over all copies. */
export function oddsRows(
	rows: readonly Readonly<{ key: string; label: string; copies: bigint }>[],
): OddsRow[] {
	const total = rows.reduce((sum, row) => sum + row.copies, 0n);

	return rows.map((row) => ({
		...row,
		percent: total === 0n
			? 0
			: Number(row.copies * 1_000_000n / total) / 10_000,
	}));
}

/** "1 in 25" style phrasing for small chances; percentages otherwise. */
export function describeChance(copies: bigint, total: bigint): string {
	if (total === 0n || copies === 0n) return "0%";

	if (copies * 10n < total) {
		const oneIn = Number((total * 10n + copies / 2n) / copies) / 10;

		return `1 in ${
			oneIn.toLocaleString("en-US", { maximumFractionDigits: 1 })
		}`;
	}

	const percent = Number(copies * 10_000n / total) / 100;

	return `${percent.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** Format base units with decimals, trimming trailing zeros. */
export function formatUnits(amount: bigint, decimals: number): string {
	if (decimals === 0) return amount.toLocaleString("en-US");

	const scale = 10n ** BigInt(decimals);
	const whole = amount / scale;
	const fraction = (amount % scale).toString().padStart(decimals, "0")
		.replace(/0+$/, "");

	return fraction
		? `${whole.toLocaleString("en-US")}.${fraction}`
		: whole.toLocaleString("en-US");
}

export function formatSol(lamports: bigint): string {
	return `${formatUnits(lamports, 9)} SOL`;
}

/** Parse a decimal string such as "1.25" into base units; `null` if invalid. */
export function parseUnits(value: string, decimals: number): bigint | null {
	const trimmed = value.trim();
	const match = /^(\d+)(?:\.(\d*))?$/.exec(trimmed);

	if (!match) return null;

	const whole = match[1] ?? "0";
	const fraction = match[2] ?? "";

	if (fraction.length > decimals) return null;

	return BigInt(whole) * 10n ** BigInt(decimals) +
		BigInt(fraction.padEnd(decimals, "0") || "0");
}

/** Human description of one draft prize: "0.5 SOL", "100 BONK", "Mad Lad #12". */
export function describeAsset(asset: DraftAsset): string {
	switch (asset.kind) {
		case "sol":
			return formatSol(BigInt(asset.lamports));
		case "token": {
			const amount = formatUnits(BigInt(asset.amount), asset.decimals);

			if (asset.tracks && asset.issuer) {
				return asset.issuer.name === "Backed xStocks" ||
						asset.issuer.name === "xStocks"
					? `${amount} xStocks tracking ${asset.tracks}`
					: `${amount} PreStocks tokens tracking ${asset.tracks}`;
			}

			return asset.tracks
				? `${amount} PreStocks tokens tracking ${asset.tracks}`
				: `${amount} ${asset.symbol || "tokens"}`;
		}
		case "nft":
			return asset.name || "NFT";
	}
}

export type EscrowLine = Readonly<{
	key: string;
	label: string;
	/** What the bundle escrow must hold, in base units (or lamports). */
	net: bigint;
	/** What leaves the creator's wallet; above `net` only for fee-bearing stocks. */
	gross: bigint;
	decimals: number;
	symbol: string;
	issuerFee: bigint;
}>;

/**
 * Exact escrow per prize, including the issuer transfer-fee gross-up. The
 * program grosses up each funding transfer (one per bundle asset), so a
 * fee-bearing stock pays its fee once per bundle, not once per copy.
 */
export function escrowLines(bundles: readonly DraftBundle[]): EscrowLine[] {
	const lines: EscrowLine[] = [];

	for (const bundle of bundles) {
		for (const [index, asset] of bundle.assets.entries()) {
			const key = `${bundle.id}:${index}`;
			const quantity = BigInt(bundle.quantity);

			if (asset.kind === "sol") {
				const net = BigInt(asset.lamports) * quantity;

				lines.push({
					key,
					label: `${bundle.label}: SOL`,
					net,
					gross: net,
					decimals: 9,
					symbol: "SOL",
					issuerFee: 0n,
				});
				continue;
			}

			if (asset.kind === "nft") {
				lines.push({
					key,
					label: `${bundle.label}: ${asset.name || "NFT"}`,
					net: 1n,
					gross: 1n,
					decimals: 0,
					symbol: "NFT",
					issuerFee: 0n,
				});
				continue;
			}

			const net = BigInt(asset.amount) * quantity;
			const gross = asset.issuer
				? grossForNetTransfer(net, {
					basisPoints: asset.issuer.feeBasisPoints,
					maximumFee: BigInt(asset.issuer.maximumFee),
				}) ?? net
				: net;

			lines.push({
				key,
				label: `${bundle.label}: ${asset.symbol || "token"}`,
				net,
				gross,
				decimals: asset.decimals,
				symbol: asset.symbol,
				issuerFee: gross - net,
			});
		}
	}

	return lines;
}

/** The consolation bundle: one Exclusive Lootbox NFT per box, minted on claim. */
export function consolationBundle(
	count: number,
	collection: string,
): PrizeBundleInput {
	return {
		label: "Exclusive Lootbox NFT",
		quantity: BigInt(count),
		assets: [{ kind: "exclusiveNft", collection: address(collection) }],
	};
}
