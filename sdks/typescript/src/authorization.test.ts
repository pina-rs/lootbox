import {
	getBuyCurveBoxesInstructionDataDecoder,
	getSellCurveBoxesInstructionDataDecoder,
	getTemplateStateDecoder,
	getTemplateStateEncoder,
} from "@pina-rs/lootbox-program-client";
import {
	address,
	createSolanaRpc,
	generateKeyPairSigner,
	type TransactionSigner,
} from "@solana/kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type ChainTemplate,
	expectedRentExemptionLamports,
	LootboxClient,
	rentExemptionLamports,
} from "./client.js";
import { createTemplatePlan } from "./templates.js";

const key = address("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");
const plan = createTemplatePlan({
	name: "Bounded",
	bundles: [{
		label: "SOL",
		quantity: 1n,
		assets: [{ kind: "sol", lamports: 1n }],
	}],
});

const creationFlows: readonly [
	string,
	(client: LootboxClient, mint: TransactionSigner) => Promise<unknown>,
][] = [
	["classic badge", (client, mint) => client.createBadgeMint(mint)],
	["metadata badge", (client, mint) =>
		client.createMetadataBadgeMint(mint, {
			name: "Badge",
			symbol: "BADGE",
			uri: "https://example.com/badge.json",
		})],
	["fixed supply", (client, mint) => client.createFixedSupplyMint(mint, 1n)],
	[
		"template",
		(client, mint) => client.createTemplate(plan, 1n, mint, key, key),
	],
	["compression tree", (client) => client.appendExclusiveTree(key)],
];

/** Real RPC encoding and decoding with a controlled remote response. */
function rpcTransport(rent: (space: bigint) => bigint) {
	const requests: string[] = [];
	vi.stubGlobal("fetch", async (_input: unknown, options?: RequestInit) => {
		const request: unknown = JSON.parse(String(options?.body));

		if (
			typeof request !== "object" || request === null ||
			!("method" in request) || typeof request.method !== "string" ||
			!("params" in request) || !Array.isArray(request.params)
		) throw new Error("malformed test RPC request");

		requests.push(request.method);
		const result = request.method === "getMinimumBalanceForRentExemption"
			? Number(rent(BigInt(String(request.params[0]))))
			: { context: { slot: 1 }, value: null };

		return new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result }), {
			headers: { "content-type": "application/json" },
		});
	});

	return { rpc: createSolanaRpc("http://localhost:8899"), requests };
}

/** Complete account data keeps trade tests independent of unsafe casts. */
function template(): ChainTemplate {
	return {
		address: key,
		data: getTemplateStateDecoder().decode(
			getTemplateStateEncoder().encode({
				authority: key,
				boxMint: key,
				oracleProgram: key,
				oracleQueue: key,
				id: 1n,
				opensAt: 0n,
				lockedAt: 0n,
				totalBundles: 1n,
				totalMinted: 1n,
				remainingBundles: 1n,
				pendingOpenings: 0n,
				nextRequest: 0n,
				nextAllocation: 0n,
				revision: 0n,
				manifestAccumulator: new Uint8Array(32),
				manifestHash: new Uint8Array(32),
				settlementBountyLamports: 0n,
				resultReceiptRentLamports: 0n,
				remainingResultReceipts: 0n,
				remainingSettlementBounties: 0n,
				name: new Uint8Array(32),
				uri: new Uint8Array(200),
				bundleCount: 0,
				status: 0,
				resultReceiptsEnabled: false,
				bump: 0,
				serviceVaultBump: 0,
				remaining: [],
			}),
		),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("account funding authorization", () => {
	it("derives known Solana rent values and rejects impossible account sizes", () => {
		expect(expectedRentExemptionLamports(0)).toBe(890_880n);
		expect(expectedRentExemptionLamports(82)).toBe(1_461_600n);
		expect(expectedRentExemptionLamports(165)).toBe(2_039_280n);

		for (const size of [-1, 1.5, NaN, Infinity, 10_485_761, 1n << 64n]) {
			expect(() => expectedRentExemptionLamports(size)).toThrow();
		}
	});

	it.each(creationFlows)(
		"rejects inflated RPC rent before signing %s",
		async (_name, create) => {
			const { rpc } = rpcTransport(() => 10_000_000_000n);
			const signer = await generateKeyPairSigner();
			const client = new LootboxClient(
				"http://localhost:8899",
				signer,
				undefined,
				{
					rpc,
					maxAccountFundingLamports: 1_000_000_000n,
				},
			);
			const send = vi.spyOn(client, "send");

			await expect(create(client, signer)).rejects.toThrow(
				"differs from expected",
			);
			expect(send).not.toHaveBeenCalled();
		},
	);

	it.each(creationFlows)(
		"requires a caller cap before signing %s",
		async (_name, create) => {
			const { rpc, requests } = rpcTransport(expectedRentExemptionLamports);
			const signer = await generateKeyPairSigner();
			const client = new LootboxClient(
				"http://localhost:8899",
				signer,
				undefined,
				{ rpc },
			);
			const send = vi.spyOn(client, "send");

			await expect(create(client, signer)).rejects.toThrow(
				"requires maxAccountFundingLamports",
			);
			expect(send).not.toHaveBeenCalled();
			expect(requests).not.toContain("getMinimumBalanceForRentExemption");
		},
	);

	it.each(creationFlows)(
		"enforces the caller's smaller cap for %s",
		async (_name, create) => {
			const { rpc } = rpcTransport(expectedRentExemptionLamports);
			const signer = await generateKeyPairSigner();
			const client = new LootboxClient(
				"http://localhost:8899",
				signer,
				undefined,
				{
					rpc,
					maxAccountFundingLamports: 1n,
				},
			);
			const send = vi.spyOn(client, "send");

			await expect(create(client, signer)).rejects.toThrow(
				"exceeds approved maximum",
			);
			expect(send).not.toHaveBeenCalled();
		},
	);

	it.each(creationFlows)(
		"composes only the verified debit for %s",
		async (_name, create) => {
			const { rpc } = rpcTransport(expectedRentExemptionLamports);
			const signer = await generateKeyPairSigner();
			const progress = vi.fn();
			const client = new LootboxClient(
				"http://localhost:8899",
				signer,
				progress,
				{
					rpc,
					maxAccountFundingLamports: 1_000_000_000n,
				},
			);
			const composed = new Error("inspect before submission");
			const send = vi.spyOn(client, "send").mockRejectedValue(composed);

			await expect(create(client, signer)).rejects.toBe(composed);
			const data = send.mock.calls[0]?.[0][0]?.data;
			expect(data).toBeDefined();

			if (!data) throw new Error("missing account creation data");

			const debit = new DataView(Uint8Array.from(data).buffer).getBigUint64(
				4,
				true,
			);
			expect(debit).toBeGreaterThan(0n);
			expect(debit).toBeLessThanOrEqual(1_000_000_000n);
			expect(progress).toHaveBeenCalledWith(
				`Fund new account with ${debit} lamports`,
			);
		},
	);

	it("rejects poisoned caches and never shares estimates across RPCs", async () => {
		const { rpc } = rpcTransport(expectedRentExemptionLamports);
		await expect(rentExemptionLamports(rpc, 82)).resolves.toBe(1_461_600n);
		await expect(rentExemptionLamports(rpc, 82, new Map([[82, 99n]]))).rejects
			.toThrow("differs from expected");
		const other = rpcTransport(() => 99n);
		await expect(rentExemptionLamports(other.rpc, 82)).rejects.toThrow(
			"differs from expected",
		);
	});
});

describe("curve signer limits", () => {
	it.each(["buy", "sell"])(
		"rejects missing or invalid %s limits before reading RPC state",
		async (side) => {
			const { rpc, requests } = rpcTransport(expectedRentExemptionLamports);
			const client = new LootboxClient(
				"http://localhost:8899",
				await generateKeyPairSigner(),
				undefined,
				{ rpc },
			);
			const trade = side === "buy"
				? client.buyCurveBoxes
				: client.sellCurveBoxes;

			for (const limit of [undefined, -1n, 1n << 64n, 1, null]) {
				await expect(Reflect.apply(trade, client, [template(), 1n, limit]))
					.rejects.toThrow("explicit lamport limit");
			}

			expect(requests).toEqual([]);
		},
	);

	it("encodes the payer's bounds unchanged despite forged curve pricing", async () => {
		const { rpc } = rpcTransport(expectedRentExemptionLamports);
		const client = new LootboxClient(
			"http://localhost:8899",
			await generateKeyPairSigner(),
			undefined,
			{ rpc },
		);
		vi.spyOn(client, "boxCurve").mockResolvedValue({
			address: key,
			data: {
				discriminator: 9,
				migrationVersion: 0,
				template: key,
				boxMint: key,
				authority: key,
				inventory: 100n,
				sold: 10n,
				startPrice: 1_000_000_000_000n,
				priceStep: 1_000_000_000n,
				reserve: 1n,
				closesAt: 999_999n,
				soldOutAt: 0n,
				feeBps: 500,
				bump: 0,
			},
		});
		const send = vi.spyOn(client, "send").mockResolvedValue("submitted");
		await client.buyCurveBoxes(template(), 1n, 123n);
		await client.sellCurveBoxes(template(), 1n, 456n);
		const buy = send.mock.calls[0]?.[0][1]?.data;
		const sell = send.mock.calls[1]?.[0][0]?.data;

		if (!buy || !sell) throw new Error("missing curve instruction data");

		expect(getBuyCurveBoxesInstructionDataDecoder().decode(buy).maxLamports)
			.toBe(123n);
		expect(getSellCurveBoxesInstructionDataDecoder().decode(sell).minLamports)
			.toBe(456n);
	});
});
