/**
 * SOL for display: enough digits to tell neighbouring curve prices apart,
 * never a wall of zeros. `1500000` lamports reads "0.0015".
 */
export function formatSolAmount(lamports: number): string {
	const sol = lamports / 1e9;
	const digits = sol >= 100 ? 1 : sol >= 1 ? 3 : sol >= 0.01 ? 4 : 6;

	return sol.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** "12", "1.2K", "3.4M": whole-box counts in tight spaces. */
export function formatCount(value: number): string {
	return value.toLocaleString("en-US", {
		notation: value >= 10_000 ? "compact" : "standard",
		maximumFractionDigits: 1,
	});
}
