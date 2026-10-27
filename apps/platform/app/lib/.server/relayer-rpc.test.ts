import { listTemplateOpenings } from "@pina-rs/lootbox";
import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { RELAYER_RPC_RESPONSE_BYTES, relayerRpc } from "./relayer-rpc.js";

const TEMPLATE = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

describe("hosted RPC response bounds", () => {
	it.each([undefined, "1"])(
		"cancels oversized program accounts with length %s before decoding",
		async (length) => {
			let canceled = false;
			let pulls = 0;
			const size = 64 * 1024;
			const rpc = relayerRpc(
				"https://rpc.test",
				new AbortController().signal,
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
			async () => Response.json({ result: 1 }),
		);

		await expect(rpc.getSlot().send()).rejects.toThrow();
	});
});
