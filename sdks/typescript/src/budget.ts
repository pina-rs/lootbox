/**
 * Compute-unit budgets for lootbox transactions, derived from the measured
 * Surfpool journeys in `docs/performance.md`.
 *
 * `tests/vectors/compute-units.json` pins this table and the budget policy
 * across the TypeScript, Dart, and Rust planners. The measured figures use
 * fixture keys whose canonical bumps sit near 255; real keys can land further
 * down the bump search and shift an instruction by thousands of units, so the
 * budget applies a generous margin. Priority fees are charged on the compute
 * units a transaction consumes, never on the requested limit, so the margin
 * only guards against limit exhaustion — it cannot inflate a priority fee.
 */
import * as generated from "@pina-rs/lootbox-program-client";
import { address, type Instruction } from "@solana/kit";

/** The compute budget program, whose instructions never cost lootbox units. */
const COMPUTE_BUDGET_PROGRAM_ADDRESS = address(
	"ComputeBudget111111111111111111111111111111",
);

/** Multiplier applied to the summed measured compute units. */
export const COMPUTE_UNIT_MARGIN_MULTIPLIER = 2;
/** Flat compute units added after the multiplier. */
export const COMPUTE_UNIT_MARGIN_ADDEND = 10_000;
/** Lowest compute-unit limit the policy ever requests. */
export const COMPUTE_UNIT_MINIMUM = 50_000;
/** Highest compute-unit limit the policy ever requests, under the 1.4M cap. */
export const COMPUTE_UNIT_MAXIMUM = 1_398_000;

/** Measured compute units per lootbox instruction, keyed by instruction name. */
export const MEASURED_COMPUTE_UNITS: Readonly<Record<string, number>> = {
	activateBundle: 6000,
	addBundle: 6590,
	allocatePrizePoolOpen: 19497,
	allocateTemplateOpen: 21204,
	appendExclusiveTree: 115407,
	attachExclusiveNft: 13663,
	buyCurveBoxes: 11369,
	cancelBundle: 3813,
	cancelPrizePoolItem: 7564,
	claimCoreAssetPrize: 12135,
	claimExclusiveNft: 125489,
	claimMintPrize: 13525,
	claimPrizePoolItem: 15249,
	claimSolPrize: 5469,
	claimStrandedPrizePoolItem: 20434,
	claimTokenPrize: 15025,
	closeBoxCurve: 10490,
	closePrizePool: 5767,
	closeServiceVault: 5359,
	closeTemplateOpening: 7642,
	createExclusiveCollection: 23905,
	createPrizePool: 15002,
	createTemplate: 11931,
	depositPrizePoolItem: 14979,
	forfeitTemplateOpen: 8997,
	fulfillTemplateOpen: 13579,
	fundCoreAssetPrize: 10246,
	fundMintPrize: 5338,
	fundQuoteSolPrize: 5097,
	fundQuoteTokenPrize: 8559,
	fundSolPrize: 5098,
	fundTokenPrize: 8639,
	lockTreasury: 11693,
	mintTemplateBoxes: 7379,
	openBoxCurve: 11654,
	preparePrizePoolItem: 14874,
	publishExclusiveCollection: 21409,
	reclaimCoreAssetPrize: 10654,
	reclaimExclusiveFees: 9328,
	reclaimMintPrize: 5615,
	reclaimPrizePoolItem: 15504,
	reclaimSolPrize: 4297,
	reclaimTokenPrize: 13422,
	requestTemplateOpen: 23972,
	retireTemplate: 2328,
	sealPrizePool: 6170,
	sealTemplate: 2172,
	sellCurveBoxes: 9014,
	setExclusiveLayer: 3231,
};

/** Maps a lootbox instruction's discriminator byte to its measured name. */
const NAME_BY_DISCRIMINATOR: ReadonlyMap<number, string> = new Map([
	[generated.ACTIVATE_BUNDLE_DISCRIMINATOR, "activateBundle"],
	[generated.ADD_BUNDLE_DISCRIMINATOR, "addBundle"],
	[generated.ALLOCATE_PRIZE_POOL_OPEN_DISCRIMINATOR, "allocatePrizePoolOpen"],
	[generated.ALLOCATE_TEMPLATE_OPEN_DISCRIMINATOR, "allocateTemplateOpen"],
	[generated.APPEND_EXCLUSIVE_TREE_DISCRIMINATOR, "appendExclusiveTree"],
	[generated.ATTACH_EXCLUSIVE_NFT_DISCRIMINATOR, "attachExclusiveNft"],
	[generated.BUY_CURVE_BOXES_DISCRIMINATOR, "buyCurveBoxes"],
	[generated.CANCEL_BUNDLE_DISCRIMINATOR, "cancelBundle"],
	[generated.CANCEL_PRIZE_POOL_ITEM_DISCRIMINATOR, "cancelPrizePoolItem"],
	[generated.CLAIM_CORE_ASSET_PRIZE_DISCRIMINATOR, "claimCoreAssetPrize"],
	[generated.CLAIM_EXCLUSIVE_NFT_DISCRIMINATOR, "claimExclusiveNft"],
	[generated.CLAIM_MINT_PRIZE_DISCRIMINATOR, "claimMintPrize"],
	[generated.CLAIM_PRIZE_POOL_ITEM_DISCRIMINATOR, "claimPrizePoolItem"],
	[generated.CLAIM_SOL_PRIZE_DISCRIMINATOR, "claimSolPrize"],
	[
		generated.CLAIM_STRANDED_PRIZE_POOL_ITEM_DISCRIMINATOR,
		"claimStrandedPrizePoolItem",
	],
	[generated.CLAIM_TOKEN_PRIZE_DISCRIMINATOR, "claimTokenPrize"],
	[generated.CLOSE_BOX_CURVE_DISCRIMINATOR, "closeBoxCurve"],
	[generated.CLOSE_PRIZE_POOL_DISCRIMINATOR, "closePrizePool"],
	[generated.CLOSE_SERVICE_VAULT_DISCRIMINATOR, "closeServiceVault"],
	[generated.CLOSE_TEMPLATE_OPENING_DISCRIMINATOR, "closeTemplateOpening"],
	[
		generated.CREATE_EXCLUSIVE_COLLECTION_DISCRIMINATOR,
		"createExclusiveCollection",
	],
	[generated.CREATE_PRIZE_POOL_DISCRIMINATOR, "createPrizePool"],
	[generated.CREATE_TEMPLATE_DISCRIMINATOR, "createTemplate"],
	[generated.DEPOSIT_PRIZE_POOL_ITEM_DISCRIMINATOR, "depositPrizePoolItem"],
	[generated.FORFEIT_TEMPLATE_OPEN_DISCRIMINATOR, "forfeitTemplateOpen"],
	[generated.FULFILL_TEMPLATE_OPEN_DISCRIMINATOR, "fulfillTemplateOpen"],
	[generated.FUND_CORE_ASSET_PRIZE_DISCRIMINATOR, "fundCoreAssetPrize"],
	[generated.FUND_MINT_PRIZE_DISCRIMINATOR, "fundMintPrize"],
	[generated.FUND_QUOTE_SOL_PRIZE_DISCRIMINATOR, "fundQuoteSolPrize"],
	[generated.FUND_QUOTE_TOKEN_PRIZE_DISCRIMINATOR, "fundQuoteTokenPrize"],
	[generated.FUND_SOL_PRIZE_DISCRIMINATOR, "fundSolPrize"],
	[generated.FUND_TOKEN_PRIZE_DISCRIMINATOR, "fundTokenPrize"],
	[generated.LOCK_TREASURY_DISCRIMINATOR, "lockTreasury"],
	[generated.MINT_TEMPLATE_BOXES_DISCRIMINATOR, "mintTemplateBoxes"],
	[generated.OPEN_BOX_CURVE_DISCRIMINATOR, "openBoxCurve"],
	[generated.PREPARE_PRIZE_POOL_ITEM_DISCRIMINATOR, "preparePrizePoolItem"],
	[
		generated.PUBLISH_EXCLUSIVE_COLLECTION_DISCRIMINATOR,
		"publishExclusiveCollection",
	],
	[generated.RECLAIM_CORE_ASSET_PRIZE_DISCRIMINATOR, "reclaimCoreAssetPrize"],
	[generated.RECLAIM_EXCLUSIVE_FEES_DISCRIMINATOR, "reclaimExclusiveFees"],
	[generated.RECLAIM_MINT_PRIZE_DISCRIMINATOR, "reclaimMintPrize"],
	[generated.RECLAIM_PRIZE_POOL_ITEM_DISCRIMINATOR, "reclaimPrizePoolItem"],
	[generated.RECLAIM_SOL_PRIZE_DISCRIMINATOR, "reclaimSolPrize"],
	[generated.RECLAIM_TOKEN_PRIZE_DISCRIMINATOR, "reclaimTokenPrize"],
	[generated.REQUEST_TEMPLATE_OPEN_DISCRIMINATOR, "requestTemplateOpen"],
	[generated.RETIRE_TEMPLATE_DISCRIMINATOR, "retireTemplate"],
	[generated.SEAL_PRIZE_POOL_DISCRIMINATOR, "sealPrizePool"],
	[generated.SEAL_TEMPLATE_DISCRIMINATOR, "sealTemplate"],
	[generated.SELL_CURVE_BOXES_DISCRIMINATOR, "sellCurveBoxes"],
	[generated.SET_EXCLUSIVE_LAYER_DISCRIMINATOR, "setExclusiveLayer"],
]);

/** How a transaction instruction contributes to a compute-unit budget. */
export type InstructionCost =
	| Readonly<{ kind: "measured"; name: string; units: number }>
	| Readonly<{ kind: "computeBudget" }>
	| Readonly<{ kind: "unknown" }>;

/** Classify one instruction against the measured tables. */
export function classifyInstructionCost(
	instruction: Instruction,
): InstructionCost {
	if (instruction.programAddress === COMPUTE_BUDGET_PROGRAM_ADDRESS) {
		return { kind: "computeBudget" };
	}

	if (
		instruction.programAddress === generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS &&
		instruction.data !== undefined
	) {
		const discriminator = instruction.data[0];
		const name = discriminator === undefined
			? undefined
			: NAME_BY_DISCRIMINATOR.get(discriminator);
		const units = name === undefined ? undefined : MEASURED_COMPUTE_UNITS[name];

		if (name !== undefined && units !== undefined) {
			return { kind: "measured", name, units };
		}
	}

	return { kind: "unknown" };
}

/** Apply the shared margin policy to a summed measured budget. */
export function computeUnitLimitForSum(summedUnits: number): number {
	return Math.min(
		Math.max(
			COMPUTE_UNIT_MINIMUM,
			summedUnits * COMPUTE_UNIT_MARGIN_MULTIPLIER + COMPUTE_UNIT_MARGIN_ADDEND,
		),
		COMPUTE_UNIT_MAXIMUM,
	);
}

/** Budget by instruction names, for planners and tests. */
export function computeUnitLimitByNames(
	names: readonly string[],
): number | null {
	if (names.length === 0) return null;

	let sum = 0;

	for (const name of names) {
		const units = MEASURED_COMPUTE_UNITS[name];

		if (units === undefined) return null;

		sum += units;
	}

	return computeUnitLimitForSum(sum);
}

/**
 * Compute-unit limit for one transaction, or `null` when the caller must not
 * set a limit: the transaction is empty or contains any instruction outside
 * the measured lootbox tables, whose cost is unknown here.
 */
export function lootboxComputeUnitLimit(
	instructions: readonly Instruction[],
): number | null {
	if (instructions.length === 0) return null;

	let sum = 0;

	for (const instruction of instructions) {
		const cost = classifyInstructionCost(instruction);

		if (cost.kind === "unknown") return null;
		if (cost.kind === "computeBudget") continue;

		sum += cost.units;
	}

	return computeUnitLimitForSum(sum);
}
