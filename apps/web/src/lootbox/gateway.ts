import { createLootboxPlan, type LootboxPlan } from "@pina-rs/lootbox";

export type OpeningStage = "commit" | "burn" | "reveal";

export type RewardPresentation = Readonly<{
	name: string;
	tier: "COMMON" | "RARE" | "MYTHIC";
	rewardLamports: bigint;
	accent: "lime" | "cyan" | "orange";
}>;

export type OpeningReceipt = Readonly<{
	commitment: string;
	signature: string;
	reward: RewardPresentation;
}>;

export interface LootboxGateway {
	readonly plan: LootboxPlan;
	open(onStage: (stage: OpeningStage) => void): Promise<OpeningReceipt>;
}

const rewardCatalog: readonly RewardPresentation[] = [
	{
		name: "Static Bloom",
		tier: "COMMON",
		rewardLamports: 2_000_000n,
		accent: "lime",
	},
	{
		name: "Neon Cache",
		tier: "RARE",
		rewardLamports: 10_000_000n,
		accent: "cyan",
	},
	{
		name: "Solar Crown",
		tier: "MYTHIC",
		rewardLamports: 50_000_000n,
		accent: "orange",
	},
];

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function selectReward(target: bigint): RewardPresentation {
	const weights = [62n, 28n, 10n];
	let cumulative = 0n;

	for (const [index, weight] of weights.entries()) {
		cumulative += weight;

		if (target < cumulative) {
			const reward = rewardCatalog[index];

			if (!reward) {
				throw new Error("reward catalog and weight table diverged");
			}

			return reward;
		}
	}

	throw new Error("weighted draw fell outside the configured domain");
}

export function createDemoGateway(): LootboxGateway {
	let openings = 0;
	const draws = [96n, 24n, 73n] as const;
	const plan = createLootboxPlan({
		maxSupply: 250,
		outcomes: rewardCatalog.map((reward, index) => ({
			label: reward.name,
			rewardLamports: reward.rewardLamports,
			weight: [62, 28, 10][index] ?? 0,
		})),
	});

	return {
		plan,
		async open(onStage) {
			onStage("commit");
			await delay(600);
			onStage("burn");
			await delay(800);
			onStage("reveal");
			await delay(900);
			const draw = draws[openings % draws.length] ?? 0n;
			openings += 1;

			return Object.freeze({
				commitment: `7Lbx…${String(openings).padStart(2, "0")}Qm`,
				signature: `surf_${openings.toString(16).padStart(4, "0")}_verified`,
				reward: selectReward(draw),
			});
		},
	};
}

export function formatSol(lamports: bigint): string {
	const whole = lamports / 1_000_000_000n;
	const fraction = (lamports % 1_000_000_000n).toString().padStart(9, "0")
		.slice(0, 3);

	return `${whole}.${fraction} SOL`;
}
