export * from "@pina-rs/lootbox-generated";
export * from "./client.js";
export * from "./market.js";
export * from "./templates.js";

export const MAX_OUTCOMES = 8;
export const MAX_TOTAL_WEIGHT = 0xffff_ffffn;
export const SWITCHBOARD_REVEAL_DISCRIMINATOR = new Uint8Array([
	197,
	181,
	187,
	10,
	30,
	58,
	20,
	73,
]);
const MAX_U64 = (1n << 64n) - 1n;

export type SwitchboardReveal = Readonly<{
	signature: Uint8Array;
	recoveryId: number;
	value: Uint8Array;
}>;

/**
 * Decode Switchboard's `randomness_reveal` instruction data into arguments
 * accepted by the generated Lootbox `settleOpen` builder.
 */
export function decodeSwitchboardReveal(data: Uint8Array): SwitchboardReveal {
	if (data.byteLength !== 105) {
		throw new RangeError(
			"Switchboard reveal data must contain exactly 105 bytes",
		);
	}

	for (const [index, byte] of SWITCHBOARD_REVEAL_DISCRIMINATOR.entries()) {
		if (data[index] !== byte) {
			throw new RangeError(
				"instruction is not a Switchboard randomness reveal",
			);
		}
	}

	return Object.freeze({
		signature: data.slice(8, 72),
		recoveryId: data[72] ?? 0,
		value: data.slice(73, 105),
	});
}

export type LootboxOutcomeInput = Readonly<{
	label: string;
	weight: bigint | number;
	rewardLamports: bigint | number;
}>;

export type LootboxOutcome = Readonly<{
	label: string;
	weight: bigint;
	rewardLamports: bigint;
	probability: number;
}>;

export type LootboxPlan = Readonly<{
	maxSupply: bigint;
	outcomes: readonly LootboxOutcome[];
	totalWeight: bigint;
	minimumRewardLamports: bigint;
	requiredCollateralLamports: bigint;
}>;

export type PlanErrorCode =
	| "ZERO_SUPPLY"
	| "NO_OUTCOMES"
	| "TOO_MANY_OUTCOMES"
	| "ZERO_WEIGHT"
	| "WEIGHT_LIMIT_EXCEEDED"
	| "NEGATIVE_REWARD"
	| "OUT_OF_RANGE"
	| "ARITHMETIC_OVERFLOW"
	| "UNSAFE_INTEGER";

export class LootboxPlanError extends Error {
	readonly code: PlanErrorCode;

	constructor(code: PlanErrorCode, message: string) {
		super(message);
		this.name = "LootboxPlanError";
		this.code = code;
	}
}

function integer(value: bigint | number, field: string): bigint {
	if (typeof value === "number" && !Number.isSafeInteger(value)) {
		throw new LootboxPlanError(
			"UNSAFE_INTEGER",
			`${field} must be a safe integer or bigint`,
		);
	}

	return BigInt(value);
}

function assertU64(value: bigint, field: string): void {
	if (value > MAX_U64) {
		throw new LootboxPlanError(
			"OUT_OF_RANGE",
			`${field} exceeds the u64 maximum`,
		);
	}
}

export function createLootboxPlan(input: {
	maxSupply: bigint | number;
	outcomes: readonly LootboxOutcomeInput[];
}): LootboxPlan {
	const maxSupply = integer(input.maxSupply, "maxSupply");

	if (maxSupply <= 0n) {
		throw new LootboxPlanError(
			"ZERO_SUPPLY",
			"maxSupply must be greater than zero",
		);
	}
	assertU64(maxSupply, "maxSupply");

	if (input.outcomes.length === 0) {
		throw new LootboxPlanError(
			"NO_OUTCOMES",
			"at least one outcome is required",
		);
	}

	if (input.outcomes.length > MAX_OUTCOMES) {
		throw new LootboxPlanError(
			"TOO_MANY_OUTCOMES",
			`single-reward protocol supports at most ${MAX_OUTCOMES} outcomes`,
		);
	}

	const normalized = input.outcomes.map((outcome, index) => {
		const weight = integer(outcome.weight, `outcomes[${index}].weight`);
		const rewardLamports = integer(
			outcome.rewardLamports,
			`outcomes[${index}].rewardLamports`,
		);

		if (weight <= 0n) {
			throw new LootboxPlanError(
				"ZERO_WEIGHT",
				`outcome ${index} must have a positive weight`,
			);
		}

		if (rewardLamports < 0n) {
			throw new LootboxPlanError(
				"NEGATIVE_REWARD",
				`outcome ${index} has a negative reward`,
			);
		}
		assertU64(weight, `outcomes[${index}].weight`);
		assertU64(rewardLamports, `outcomes[${index}].rewardLamports`);

		return { label: outcome.label, rewardLamports, weight };
	});
	const totalWeight = normalized.reduce(
		(sum, outcome) => sum + outcome.weight,
		0n,
	);

	if (totalWeight > MAX_U64) {
		throw new LootboxPlanError(
			"ARITHMETIC_OVERFLOW",
			"the sum of outcome weights exceeds the u64 maximum",
		);
	}

	if (totalWeight > MAX_TOTAL_WEIGHT) {
		throw new LootboxPlanError(
			"WEIGHT_LIMIT_EXCEEDED",
			`the sum of outcome weights must not exceed ${MAX_TOTAL_WEIGHT}`,
		);
	}

	const maxReward = normalized.reduce(
		(maximum, outcome) =>
			outcome.rewardLamports > maximum ? outcome.rewardLamports : maximum,
		0n,
	);
	const minimumRewardLamports = normalized.reduce(
		(minimum, outcome) =>
			outcome.rewardLamports < minimum ? outcome.rewardLamports : minimum,
		normalized[0]?.rewardLamports ?? 0n,
	);
	const requiredCollateralLamports = maxSupply * maxReward;

	if (requiredCollateralLamports > MAX_U64) {
		throw new LootboxPlanError(
			"ARITHMETIC_OVERFLOW",
			"worst-case collateral exceeds the u64 maximum",
		);
	}

	const outcomes = normalized.map((outcome) => ({
		...outcome,
		probability: Number((outcome.weight * 1_000_000n) / totalWeight) / 10_000,
	}));

	return Object.freeze({
		maxSupply,
		minimumRewardLamports,
		outcomes: Object.freeze(outcomes),
		totalWeight,
		requiredCollateralLamports,
	});
}

function readU64(bytes: Uint8Array, index: number): bigint {
	const offset = index * 8;
	const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);

	return view.getBigUint64(0, true);
}

export function decodeOutcomeTable(
	weights: Uint8Array,
	rewards: Uint8Array,
	count: number,
): readonly Readonly<{ weight: bigint; rewardLamports: bigint }>[] {
	if (weights.byteLength !== 64 || rewards.byteLength !== 64) {
		throw new RangeError(
			"on-chain outcome tables must each contain exactly 64 bytes",
		);
	}

	if (!Number.isInteger(count) || count < 0 || count > MAX_OUTCOMES) {
		throw new RangeError(`outcome count must be between 0 and ${MAX_OUTCOMES}`);
	}

	return Object.freeze(
		Array.from({ length: count }, (_, index) =>
			Object.freeze({
				weight: readU64(weights, index),
				rewardLamports: readU64(rewards, index),
			})),
	);
}
