import { LAYERS, resolveTraits, type TraitVector } from "./layers.ts";

/**
 * Rarity of a trait vector under the published weights.
 *
 * Layers roll independently, so the probability is the product of each
 * chosen trait's `weight / total`. Odds are computed exactly with `bigint`
 * (the rarest vectors exceed 2^53), and the score is the information content
 * in bits, `Σ −log2 p`, so rarer is always higher and scores add up by layer.
 */
export type Rarity = Readonly<{
	probability: number;
	/** `1 / probability`, rounded to the nearest integer. */
	oneIn: bigint;
	/** Exact odds, e.g. `1 in 31,250,000,000,000,000`. */
	label: string;
	/** Short odds for small spaces, e.g. `1 in 31 quadrillion`. */
	compact: string;
	/** `Σ −log2(p_trait)`, rounded to two decimals. */
	score: number;
}>;

const SCALES: readonly (readonly [bigint, string])[] = [
	[10n ** 18n, "quintillion"],
	[10n ** 15n, "quadrillion"],
	[10n ** 12n, "trillion"],
	[10n ** 9n, "billion"],
	[10n ** 6n, "million"],
];

/** Group digits in threes: `31250000` → `31,250,000`. */
export function groupDigits(value: bigint): string {
	return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `1 in 1,234,567`. */
export function formatOneIn(oneIn: bigint): string {
	return `1 in ${groupDigits(oneIn)}`;
}

/** `1 in 3.1 billion` from a million up; exact below. */
export function compactOneIn(oneIn: bigint): string {
	for (const [scale, word] of SCALES) {
		if (oneIn < scale) {
			continue;
		}

		const value = Number(oneIn * 100n / scale) / 100;
		const shown = value < 10
			? value.toFixed(1).replace(/\.0$/, "")
			: Math.round(value).toString();

		return `1 in ${shown} ${word}`;
	}

	return formatOneIn(oneIn);
}

export function rarityOf(traits: TraitVector): Rarity {
	const chosen = resolveTraits(traits);
	let numerator = 1n;
	let denominator = 1n;
	let score = 0;

	for (const [index, trait] of chosen.entries()) {
		const total = LAYERS[index]?.total ?? 0;

		if (trait.weight === 0 || total === 0) {
			throw new RangeError(`${trait.name} has weight 0 and cannot be rolled`);
		}

		numerator *= BigInt(total);
		denominator *= BigInt(trait.weight);
		score += Math.log2(total / trait.weight);
	}

	// Round half up: (2n + d) / 2d.
	const oneIn = (2n * numerator + denominator) / (2n * denominator);

	return {
		probability: Number(denominator) / Number(numerator),
		oneIn,
		label: formatOneIn(oneIn),
		compact: compactOneIn(oneIn),
		score: Math.round(score * 100) / 100,
	};
}

function extreme(pick: (a: number, b: number) => boolean): TraitVector {
	return LAYERS.map((layer) =>
		layer.traits.reduce(
			(best, trait) =>
				trait.weight > 0 && pick(trait.weight, layer.traits[best]?.weight ?? 0)
					? trait.index
					: best,
			0,
		)
	);
}

/** The most likely vector: every layer's heaviest trait. */
export function commonestTraits(): TraitVector {
	return extreme((a, b) => a > b);
}

/** The least likely vector: every layer's lightest non-retired trait. */
export function rarestTraits(): TraitVector {
	return extreme((a, b) => a < b);
}
