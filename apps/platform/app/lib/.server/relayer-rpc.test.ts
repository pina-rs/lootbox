import { listTemplateOpenings, LootboxClient } from "@pina-rs/lootbox";
import { address, generateKeyPairSigner } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { RELAYER_RUN_LIMITS, relayerBudget } from "./relayer-budget.js";
import { RELAYER_RPC_RESPONSE_BYTES, relayerRpc } from "./relayer-rpc.js";

const TEMPLATE = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

describe("hosted RPC response bounds", () => {
	it.each([2, 12])(
		"submits an already-reserved attempt %i before expiry",
		async (attempt) => {
			const controller = new AbortController();
			const budget = relayerBudget(() => 100, controller.signal);
			let submissions = 0;

			for (let index = 0; index < attempt / 2 - 1; index++) {
				const earlier = budget.forLootbox();
				earlier.reserve();
				earlier.reserve();
			}

			const local = budget.forLootbox();
			local.reserve();
			const rpc = relayerRpc(
				"https://rpc.test",
				controller.signal,
				budget.expired,
				async (_input, init) => {
					const request: unknown = JSON.parse(
						typeof init?.body === "string" ? init.body : "null",
					);

					if (typeof request !== "object" || request === null) {
						throw new Error(
							"Malformed test request",
						);
					}

					const method = Reflect.get(request, "method");
					let result: unknown;

					if (method === "getLatestBlockhash") {
						result = {
							context: { slot: 1 },
							value: {
								blockhash: "GHjnZdpDPTpex7X8WqMf9NdawoM4kXQ8JUkvdLdDebeR",
								lastValidBlockHeight: 100,
							},
						};
					} else if (method === "sendTransaction") {
						submissions += 1;
						expect(local.shouldStop()).toBe(true);
						expect(budget.shouldStop()).toBe(attempt === 12);
						result = "1".repeat(64);
					} else if (method === "getSignatureStatuses") {
						result = {
							context: { slot: 1 },
							value: [
								{ confirmationStatus: "confirmed", err: null, slot: 1 },
							],
						};
					} else throw new Error("Unexpected test RPC method");

					return Response.json({
						jsonrpc: "2.0",
						id: Reflect.get(request, "id"),
						result,
					});
				},
			);
			const client = new LootboxClient(
				"https://rpc.test",
				await generateKeyPairSigner(),
				undefined,
				{
					rpc,
					abortSignal: controller.signal,
					beforeTransaction: local.reserve,
				},
			);

			expect(await client.send([], "last reserved attempt")).toBe(
				"1".repeat(64),
			);
			expect(submissions).toBe(1);
			expect(budget.expired()).toBe(false);
		},
	);

	it.each([undefined, "1"])(
		"cancels oversized program accounts with length %s before decoding",
		async (length) => {
			let canceled = false;
			let pulls = 0;
			const size = 64 * 1024;
			const rpc = relayerRpc(
				"https://rpc.test",
				new AbortController().signal,
				() => false,
				async () =>
					new Response(
						new ReadableStream({
							pull(controller) {
								pulls += 1;
								controller.enqueue(new Uint8Array(size));
							},
							cancel() {
								canceled = true;
							},
						}),
						{ headers: length ? { "Content-Length": length } : {} },
					),
			);

			await expect(listTemplateOpenings(rpc, TEMPLATE)).rejects.toThrow(
				"byte limit",
			);
			expect(canceled).toBe(true);
			expect(pulls).toBeLessThanOrEqual(RELAYER_RPC_RESPONSE_BYTES / size + 2);
		},
	);

	it("preserves u64 response precision through Kit's transformations", async () => {
		const rpc = relayerRpc(
			"https://rpc.test",
			new AbortController().signal,
			() => false,
			async () =>
				new Response(
					'{"jsonrpc":"2.0","id":"1","result":18446744073709551615}',
				),
		);

		expect(await rpc.getSlot().send()).toBe(18_446_744_073_709_551_615n);
	});

	it("rejects a malformed response envelope", async () => {
		const rpc = relayerRpc(
			"https://rpc.test",
			new AbortController().signal,
			() => false,
			async () => Response.json({ result: 1 }),
		);

		await expect(rpc.getSlot().send()).rejects.toThrow();
	});

	it("rejects a signed submission after wall-clock expiry without a delivered abort", async () => {
		let now = 100;
		let submissions = 0;
		const controller = new AbortController();
		const budget = relayerBudget(() => now, controller.signal);
		const signer = await generateKeyPairSigner();
		const rpc = relayerRpc(
			"https://rpc.test",
			controller.signal,
			budget.expired,
			async (_input, init) => {
				const request: unknown = JSON.parse(
					typeof init?.body === "string" ? init.body : "null",
				);

				if (typeof request !== "object" || request === null) {
					throw new Error(
						"Malformed test request",
					);
				}

				if (Reflect.get(request, "method") === "sendTransaction") {
					submissions += 1;
					throw new Error("Expired submission reached the transport");
				}

				return Response.json({
					jsonrpc: "2.0",
					id: Reflect.get(request, "id"),
					result: {
						context: { slot: 1 },
						value: {
							blockhash: "GHjnZdpDPTpex7X8WqMf9NdawoM4kXQ8JUkvdLdDebeR",
							lastValidBlockHeight: 100,
						},
					},
				});
			},
		);
		const local = budget.forLootbox();
		const client = new LootboxClient(
			"https://rpc.test",
			{
				...signer,
				signTransactions: async (
					...args: Parameters<typeof signer.signTransactions>
				) => {
					const signatures = await signer.signTransactions(...args);
					now += RELAYER_RUN_LIMITS.durationSeconds + 61;

					return signatures;
				},
			},
			undefined,
			{ rpc, abortSignal: controller.signal, beforeTransaction: local.reserve },
		);

		await expect(client.send([], "expired after signing")).rejects.toThrow(
			"deadline expired",
		);
		expect(controller.signal.aborted).toBe(false);
		expect(submissions).toBe(0);
	});
});
