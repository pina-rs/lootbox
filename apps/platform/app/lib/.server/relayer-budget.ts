/** Every pass stops before its four-minute exclusion lease can expire. */
export const RELAYER_RUN_LIMITS = {
	durationSeconds: 180,
	lootboxes: 8,
	transactions: 12,
	transactionsPerLootbox: 2,
} as const;

/** Reserve attempts before signing, including attempts that later fail. */
export function relayerBudget(now: () => number, signal: AbortSignal) {
	const deadline = now() + RELAYER_RUN_LIMITS.durationSeconds;
	let attempts = 0;
	const shouldStop = () =>
		signal.aborted || now() >= deadline ||
		attempts >= RELAYER_RUN_LIMITS.transactions;

	return {
		shouldStop,
		forLootbox() {
			let localAttempts = 0;
			const stop = () =>
				shouldStop() ||
				localAttempts >= RELAYER_RUN_LIMITS.transactionsPerLootbox;

			return {
				shouldStop: stop,
				reserve() {
					if (stop()) throw new Error("relayer transaction budget exhausted");

					attempts += 1;
					localAttempts += 1;
				},
			};
		},
	};
}
