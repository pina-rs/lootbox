/**
 * Turn wallet and RPC failures into one sentence a creator can act on.
 *
 * Kit's `SolanaError` messages embed URL-encoded transaction logs; the
 * program and token-program log lines inside tell us what actually happened.
 */
const KNOWN: readonly Readonly<[RegExp, string]>[] = [
	[
		/user rejected|rejected the request|declined/i,
		"You declined in your wallet. Nothing was sent.",
	],
	[
		/insufficient lamports|insufficient funds for fee|attempt to debit an account but found no record/i,
		"Your wallet doesn't have enough SOL for this step.",
	],
	[
		/Error: insufficient funds/i,
		"Your wallet doesn't hold enough of a prize token.",
	],
	[
		/blockhash not found|block height exceeded/i,
		"The network was busy and the transaction expired. Try again.",
	],
	[
		/Confirmation timed out/i,
		"The network did not confirm in time. Refresh, then try again.",
	],
];

/** Everything we can read about a failure: message, logs, encoded context. */
function details(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error);
	const context = typeof error === "object" && error !== null
		? Reflect.get(error, "context")
		: undefined;
	const logs = typeof context === "object" && context !== null
		? Reflect.get(context, "logs")
		: undefined;
	const parts = [raw, Array.isArray(logs) ? logs.join("\n") : ""];
	// Production kit builds encode the context as base64 in the message.
	const encoded = /decode -- -?\d+ '([A-Za-z0-9+/=]+)'/.exec(raw)?.[1];

	if (encoded && typeof atob === "function") {
		try {
			parts.push(decodeURIComponent(atob(encoded).replace(/\+/g, " ")));
		} catch {
			// Undecodable context: fall back to the message alone.
		}
	}

	return parts.join("\n");
}

export function friendlyError(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error);
	const text = details(error);

	for (const [pattern, message] of KNOWN) {
		if (pattern.test(text)) return message;
	}

	return raw.length > 240 ? `${raw.slice(0, 200)}…` : raw;
}
