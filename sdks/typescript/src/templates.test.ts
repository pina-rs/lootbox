import { type Address, address, getAddressDecoder } from "@solana/kit";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	createTemplatePlan,
	decodeTemplateText,
	encodeTemplateText,
	remainingTemplateBundleCapacity,
	requiredServiceBudget,
	templateInventory,
	TemplatePlanError,
} from "./templates.js";

const nft: Address = address("Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op");
const poolTree: Address = address(
	"7RmhTYBS7Uv9PSNmJGX6tM8BjSn7HVbGdVgV6EtCNKLm",
);
const zeroAddress: Address = address("11111111111111111111111111111111");
const serviceBudgetVector = JSON.parse(readFileSync(
	new URL("../../../tests/vectors/service-budget.json", import.meta.url),
	"utf8",
)) as Readonly<Record<string, string | boolean>>;
const prizePoolVector = JSON.parse(readFileSync(
	new URL("../../../tests/vectors/prize-pool.json", import.meta.url),
	"utf8",
)) as Readonly<{
	maxItems: number;
	validQuantity: number;
	validItemCount: number;
	mismatchedItemCount: number;
	mutableItemCount: number;
	duplicateItemCount: number;
	oversizedQuantity: number;
	validMetadataBytes: number;
	oversizedMetadataBytes: number;
	validProofNodes: number;
	oversizedProofNodes: number;
}>;

function poolItems(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		asset: index === 0
			? nft
			: getAddressDecoder().decode(new Uint8Array(32).fill(index + 1)),
		metadataMutable: false,
		metadata: new Uint8Array(prizePoolVector.validMetadataBytes).fill(1),
		proof: {
			root: new Uint8Array(32).fill(1),
			dataHash: new Uint8Array(32).fill(index + 2),
			creatorHash: new Uint8Array(32).fill(index + 3),
			nonce: BigInt(index),
			leafIndex: index,
			tree: poolTree,
			treeConfig: nft,
			proof: [nft],
		},
	}));
}

describe("finite template plans", () => {
	it("escrows the complete inventory instead of a probabilistic buffer", () => {
		const plan = createTemplatePlan({
			name: "A small miracle",
			bundles: [
				{
					label: "SOL",
					quantity: 99n,
					assets: [{ kind: "sol", lamports: 100_000_000n }],
				},
				{
					label: "Jackpot",
					quantity: 1n,
					assets: [{ kind: "nft", mint: nft }, {
						kind: "sol",
						lamports: 1_000_000_000n,
					}],
				},
			],
		});
		expect(plan.totalBundles).toBe(100n);
		expect(plan.fixedSupply).toBe(plan.totalBundles);
		expect(plan.bundles.map((bundle) => bundle.probabilityPercent)).toEqual([
			99,
			1,
		]);
		expect(plan.treasury).toEqual([{
			asset: null,
			amount: 10_900_000_000n,
			kind: "sol",
		}, {
			asset: nft,
			amount: 1n,
			kind: "nft",
		}]);
	});

	it("rejects duplicated NFT inventory and overflow", () => {
		let duplicateError: unknown;
		try {
			createTemplatePlan({
				name: "Invalid",
				bundles: [{
					label: "NFT",
					quantity: 2n,
					assets: [{ kind: "nft", mint: nft }],
				}],
			});
		} catch (error: unknown) {
			duplicateError = error;
		}
		expect(duplicateError).toBeInstanceOf(TemplatePlanError);
		expect((duplicateError as TemplatePlanError).code).toBe(
			"DUPLICATE_UNIQUE_ASSET",
		);
		expect(() =>
			createTemplatePlan({
				name: "Invalid",
				bundles: [{
					label: "SOL",
					quantity: 2n,
					assets: [{ kind: "sol", lamports: (1n << 64n) - 1n }],
				}],
			})
		).toThrow("collateral");
	});

	it("rejects mutable collection transfer policies", () => {
		expect(() =>
			createTemplatePlan({
				name: "Mutable programmable NFT",
				bundles: [{
					label: "NFT",
					quantity: 1n,
					assets: [{ kind: "nft", mint: nft, tokenRecord: nft }],
				}],
			})
		).toThrow("programmable NFT");
		expect(() =>
			createTemplatePlan({
				name: "Mutable Core",
				bundles: [{
					label: "Core",
					quantity: 1n,
					assets: [{ kind: "core", asset: nft, collection: nft }],
				}],
			})
		).toThrow("uncollected Core");
	});

	it("counts quote collateral while allowing a multi-copy badge authority", () => {
		const plan = createTemplatePlan({
			name: "Launch box",
			bundles: [{
				label: "Ten launches",
				quantity: 10n,
				assets: [
					{ kind: "quoteSol", lamports: 100_000_000n },
					{ kind: "mintBadge", mint: nft },
				],
			}],
		});
		expect(plan.treasury).toEqual([{
			asset: null,
			amount: 1_000_000_000n,
			kind: "quoteSol",
		}, {
			asset: nft,
			amount: 10n,
			kind: "mintBadge",
		}]);
	});

	it("plans one entropy-addressed PrizePool item per bundle ticket", () => {
		const quantity = BigInt(prizePoolVector.validQuantity);
		const plan = createTemplatePlan({
			name: "Compressed collection",
			bundles: [{
				label: "One of three",
				quantity,
				assets: [{
					kind: "prizePool",
					tree: poolTree,
					items: poolItems(prizePoolVector.validItemCount),
				}],
			}],
		});
		expect(plan.fixedSupply).toBe(quantity);
		expect(plan.treasury).toEqual([{
			asset: poolTree,
			amount: quantity,
			kind: "prizePool",
		}]);
	});

	it("takes an owned snapshot of every PrizePool proof buffer", () => {
		const items = poolItems(1);
		const plan = createTemplatePlan({
			name: "Stable snapshot",
			bundles: [{
				label: "Pool",
				quantity: 1n,
				assets: [{ kind: "prizePool", tree: poolTree, items }],
			}],
		});
		const planned = plan.bundles[0]?.assets[0];
		expect(planned?.kind).toBe("prizePool");
		if (planned?.kind !== "prizePool") throw new Error("planned pool missing");
		const originalDataHash = planned.items[0]?.proof.dataHash[0];
		items[0]!.proof.dataHash[0] = 255;
		items[0]!.metadata[0] = 255;
		items[0]!.proof.proof.splice(0, 1);

		expect(planned.items[0]?.proof.dataHash[0]).toBe(originalDataHash);
		expect(planned.items[0]?.metadata[0]).toBe(1);
		expect(planned.items[0]?.proof.proof).toEqual([nft]);
		expect(Object.isFrozen(planned.items)).toBe(true);
	});

	it("rejects incomplete, mutable, duplicate, and oversized PrizePools", () => {
		const plan = (items: ReturnType<typeof poolItems>, quantity: bigint) =>
			createTemplatePlan({
				name: "Invalid pool",
				bundles: [{
					label: "Pool",
					quantity,
					assets: [{ kind: "prizePool", tree: poolTree, items }],
				}],
			});
		expect(() =>
			plan(
				poolItems(prizePoolVector.mismatchedItemCount),
				BigInt(prizePoolVector.validQuantity),
			)
		).toThrow(/exactly/);
		expect(() =>
			plan(
				poolItems(prizePoolVector.mutableItemCount).map((item) => ({
					...item,
					metadataMutable: true,
				})),
				1n,
			)
		).toThrow(/immutable/);
		const duplicated = poolItems(prizePoolVector.duplicateItemCount);
		expect(() =>
			plan(
				[duplicated[0]!, { ...duplicated[1]!, asset: duplicated[0]!.asset }],
				2n,
			)
		).toThrow(/distinct/);
		const [bounded] = poolItems(1);
		expect(() =>
			plan([{
				...bounded!,
				proof: { ...bounded!.proof, leafIndex: 1.5 },
			}], 1n)
		).toThrow(/complete proofs/);
		expect(() =>
			plan([{
				...bounded!,
				proof: { ...bounded!.proof, nonce: 1n << 64n },
			}], 1n)
		).toThrow(/complete proofs/);
		expect(() =>
			plan([{
				...bounded!,
				proof: {
					...bounded!.proof,
					proof: Array(prizePoolVector.oversizedProofNodes).fill(nft),
				},
			}], 1n)
		).toThrow(/complete proofs/);
		expect(() => plan([{ ...bounded!, metadata: new Uint8Array() }], 1n))
			.toThrow(/complete proofs/);
		expect(() =>
			plan([{
				...bounded!,
				metadata: new Uint8Array(prizePoolVector.oversizedMetadataBytes),
			}], 1n)
		).toThrow(/complete proofs/);
		expect(() => plan([], BigInt(prizePoolVector.oversizedQuantity))).toThrow(
			/maximum/,
		);
		expect(() => plan([{ ...bounded!, asset: zeroAddress }], 1n)).toThrow(
			/distinct/,
		);
		expect(() =>
			plan([{
				...bounded!,
				proof: { ...bounded!.proof, treeConfig: zeroAddress },
			}], 1n)
		).toThrow(/complete proofs/);
	});

	it("rejects malformed standalone compressed-NFT proofs", () => {
		const compressed = {
			kind: "compressedNft" as const,
			asset: nft,
			proof: poolItems(1)[0]!.proof,
		};
		const plan = (asset: typeof compressed) =>
			createTemplatePlan({
				name: "Compressed prize",
				bundles: [{ label: "NFT", quantity: 1n, assets: [asset] }],
			});
		expect(plan(compressed).fixedSupply).toBe(1n);
		expect(() =>
			plan({
				...compressed,
				proof: { ...compressed.proof, root: new Uint8Array(31) },
			})
		).toThrow(/bounded proof/);
		expect(() =>
			plan({
				...compressed,
				proof: { ...compressed.proof, treeConfig: zeroAddress },
			})
		).toThrow(/bounded proof/);
	});

	it("bounds metadata by UTF-8 bytes and rejects hidden control text", () => {
		expect(decodeTemplateText(encodeTemplateText("🎁", 32))).toBe("🎁");
		expect(() => encodeTemplateText("🎁".repeat(9), 32)).toThrow("UTF-8");
		expect(() => encodeTemplateText("safe\0evil", 32)).toThrow("control");
	});

	it("shows an exhausted prize at zero percent", () => {
		const remaining = [9n, 0n];
		expect(
			templateInventory({ remaining, bundleCount: 2 }).map((
				outcome,
			) => outcome.probabilityPercent),
		).toEqual([100, 0]);
	});

	it("supports all 1,024 append slots and snapshots an earlier prefix", () => {
		const bundles = Array.from({ length: 1_024 }, (_, index) => ({
			label: `Bundle ${index}`,
			quantity: 1n,
			assets: [{ kind: "sol" as const, lamports: 1n }],
		}));
		const plan = createTemplatePlan({ name: "Large manifest", bundles });
		expect(plan.totalBundles).toBe(1_024n);
		const remaining = Array<bigint>(1_024).fill(1n);
		expect(templateInventory({ remaining, bundleCount: 1_024 }, 9))
			.toHaveLength(
				9,
			);
		expect(templateInventory({ remaining, bundleCount: 1_024 })).toHaveLength(
			1_024,
		);
	});

	it("rejects an append before any partial bundle can exceed the slot cap", () => {
		expect(remainingTemplateBundleCapacity(0)).toBe(1_024);
		expect(remainingTemplateBundleCapacity(1_023)).toBe(1);
		expect(remainingTemplateBundleCapacity(1_024)).toBe(0);
		expect(() => remainingTemplateBundleCapacity(-1)).toThrow("bundle count");
		expect(() => remainingTemplateBundleCapacity(1_025)).toThrow(
			"bundle count",
		);
	});

	it("funds optional services exactly at lock", () => {
		const totalBundles = BigInt(String(serviceBudgetVector.totalBundles));
		const settlementBountyLamports = BigInt(
			String(serviceBudgetVector.settlementBountyLamports),
		);
		const resultReceiptRentLamports = BigInt(
			String(serviceBudgetVector.resultReceiptRentLamports),
		);
		const serviceVaultRentLamports = BigInt(
			String(serviceBudgetVector.serviceVaultRentLamports),
		);
		const expectedBudgetLamports = BigInt(
			String(serviceBudgetVector.expectedBudgetLamports),
		);
		const plan = createTemplatePlan({
			name: "Services",
			settlementBountyLamports,
			resultReceiptsEnabled: Boolean(
				serviceBudgetVector.resultReceiptsEnabled,
			),
			bundles: [{
				label: "SOL",
				quantity: totalBundles,
				assets: [{ kind: "sol", lamports: 1n }],
			}],
		});
		expect(
			requiredServiceBudget(
				plan,
				resultReceiptRentLamports,
				serviceVaultRentLamports,
			),
		).toBe(
			expectedBudgetLamports,
		);
		expect(
			requiredServiceBudget(
				{ ...plan, resultReceiptsEnabled: false },
				2_000_000n,
				890_880n,
			),
		).toBe(1_040_880n);
		expect(
			requiredServiceBudget(
				{
					...plan,
					resultReceiptsEnabled: false,
					settlementBountyLamports: 0n,
				},
				2_000_000n,
				890_880n,
			),
		).toBe(0n);
	});
});
