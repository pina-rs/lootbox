/**
 * Describe on-chain prize bundles for people.
 *
 * Amounts, kinds, and mints always come from the chain. D1 only contributes
 * the creator's bundle label and token display names captured at creation.
 */
import type { ChainAssetView, ChainBundleView } from "./chain.js";
import { formatSol, formatUnits } from "./plan.js";
import type { BundleLabel, DraftAsset } from "./schemas.js";
import { PRESTOCKS } from "./tokens.js";

export type PrizeTier = "headline" | "standard" | "empty";

export type PrizeView = Readonly<{
	index: number;
	title: string;
	lines: readonly string[];
	/** Copies at activation and copies still unopened. */
	quantity: bigint;
	remaining: bigint;
	tier: PrizeTier;
	/** Company tracked by an issuer-stock prize, for the disclosure. */
	tracks: readonly string[];
	issuerStock: boolean;
}>;

function shortMint(mint: string): string {
	return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function describeAsset(
	asset: ChainAssetView,
	hint: DraftAsset | undefined,
): Readonly<{ text: string; tracks: string | null; issuerStock: boolean }> {
	const amount = BigInt(asset.amount);

	switch (asset.kind) {
		case "sol":
		case "quoteSol":
			return { text: formatSol(amount), tracks: null, issuerStock: false };
		case "token":
		case "token2022":
		case "quoteToken": {
			const tracks = PRESTOCKS.get(asset.mint) ??
				(hint?.kind === "token" ? hint.tracks : null);
			const units = formatUnits(amount, asset.decimals);
			const symbol = hint?.kind === "token" && hint.mint === asset.mint
				? hint.symbol
				: "";
			const issuerStock = tracks !== null ||
				(hint?.kind === "token" && hint.issuer !== null);

			const xStock = hint?.kind === "token" &&
				hint.issuer?.name.includes("xStocks") === true;

			return {
				text: tracks
					? xStock
						? `${units} xStocks tracking ${tracks}`
						: `${units} PreStocks tokens tracking ${tracks}`
					: `${units} ${symbol || `tokens (${shortMint(asset.mint)})`}`,
				tracks,
				issuerStock,
			};
		}
		case "mintBadge":
			return { text: "A collectible badge", tracks: null, issuerStock: false };
		case "prizePool":
			return {
				text: "One collectible from a pool",
				tracks: null,
				issuerStock: false,
			};
		default: {
			const name = hint?.kind === "nft" && hint.mint === asset.mint
				? hint.name
				: "";

			return {
				text: name || `NFT ${shortMint(asset.mint)}`,
				tracks: null,
				issuerStock: false,
			};
		}
	}
}

/**
 * The rarest active bundle is the headline (big reaction); if every bundle
 * has the same copy count, nothing is a headline.
 */
function headlineQuantity(bundles: readonly ChainBundleView[]): bigint | null {
	const quantities = bundles.filter((bundle) => bundle.status === 1).map((
		bundle,
	) => BigInt(bundle.quantity));

	if (quantities.length < 2) return null;

	const smallest = quantities.reduce((a, b) => (b < a ? b : a));
	const largest = quantities.reduce((a, b) => (b > a ? b : a));

	return smallest === largest ? null : smallest;
}

export function prizeViews(
	bundles: readonly ChainBundleView[],
	labels: readonly BundleLabel[],
): PrizeView[] {
	const headline = headlineQuantity(bundles);

	return bundles.filter((bundle) => bundle.status === 1).map((bundle) => {
		const label = labels.find((item) => item.index === bundle.index);
		const described = bundle.assets.map((asset, position) =>
			describeAsset(asset, label?.assets[position])
		);
		const quantity = BigInt(bundle.quantity);

		return {
			index: bundle.index,
			title: label?.label || described[0]?.text || `Prize ${bundle.index + 1}`,
			lines: described.map((item) => item.text),
			quantity,
			remaining: BigInt(bundle.remaining),
			tier: headline !== null && quantity === headline
				? "headline"
				: "standard",
			tracks: described.flatMap((item) => (item.tracks ? [item.tracks] : [])),
			issuerStock: described.some((item) => item.issuerStock),
		};
	});
}

/** The standard non-affiliation line for issuer-stock prizes. */
export function stockDisclaimer(companies: readonly string[]): string {
	const unique = [...new Set(companies)];

	if (unique.length === 0) {
		return "Tokenized stock prizes are issuer tokens, not shares, and carry no ownership, voting, or dividend rights.";
	}

	return `Tokenized stock prizes track economic exposure to ${
		unique.join(", ")
	}. They are issuer tokens, not shares, and carry no ownership, voting, or dividend rights. Not affiliated with or endorsed by ${
		unique.join(", ")
	}.`;
}

export const ELIGIBILITY_STATEMENT =
	"I am 18 or older, not a US person, not in a jurisdiction where these tokens are restricted, and not a sanctioned person.";
