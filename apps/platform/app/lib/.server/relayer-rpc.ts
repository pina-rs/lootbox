import { fetchBoundedText } from "@pina-rs/lootbox";
import {
	createSolanaRpcFromTransport,
	type RpcResponse,
	type RpcTransport,
} from "@solana/kit";
import {
	parseJsonWithBigInts,
	stringifyJsonWithBigInts,
} from "@solana/rpc-spec-types";
import { z } from "zod";

export const RELAYER_RPC_RESPONSE_BYTES = 1024 * 1024;

const rpcEnvelope = z.object({
	jsonrpc: z.literal("2.0"),
	id: z.union([z.string(), z.number(), z.bigint(), z.null()]),
	result: z.unknown().optional(),
	error: z.unknown().optional(),
}).refine((body) =>
	Object.hasOwn(body, "result") !== Object.hasOwn(body, "error")
);

/** Bound response bytes before Kit parses, decodes, or sorts a template backlog. */
export function relayerRpc(
	url: string,
	runSignal: AbortSignal,
	fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
) {
	async function transport<TResponse>(
		request: Parameters<RpcTransport>[0],
	): Promise<RpcResponse<TResponse>> {
		const { response, text } = await fetchBoundedText(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: stringifyJsonWithBigInts(request.payload),
			signal: AbortSignal.any([
				runSignal,
				...(request.signal ? [request.signal] : []),
			]),
		}, {
			maxBytes: RELAYER_RPC_RESPONSE_BYTES,
			timeoutMs: 8_000,
			fetch: fetcher,
		});

		if (!response.ok) {
			throw new Error(`Relayer RPC returned HTTP ${response.status}`);
		}

		const body = rpcEnvelope.parse(parseJsonWithBigInts(text));

		// Kit's generic transport contract delegates method-specific typing to
		// its RPC response transformers; this boundary validates the envelope.
		return body as RpcResponse<TResponse>;
	}

	return createSolanaRpcFromTransport(transport);
}
