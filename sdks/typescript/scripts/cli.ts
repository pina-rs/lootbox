/**
 * Shared plumbing for the operator scripts: argument parsing, keypair
 * loading, cluster verification, and a fetch that rides out public-RPC
 * throttling.
 */
import {
	createKeyPairSignerFromBytes,
	createSolanaRpc,
	type KeyPairSigner,
} from "@solana/kit";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SwitchboardCluster } from "../src/index.js";

const GENESIS: Readonly<Record<SwitchboardCluster, string>> = {
	devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
	mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};
const DEFAULT_RPC: Readonly<Partial<Record<SwitchboardCluster, string>>> = {
	devnet: "https://api.devnet.solana.com",
};

/** Parse `--name value` and bare `--flag` arguments. */
export function parseArgs(argv: readonly string[]) {
	const values = new Map<string, string>();
	const flags = new Set<string>();

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index] ?? "";

		if (argument === "--") continue;

		if (!argument.startsWith("--")) {
			throw new Error(`unexpected argument ${argument}`);
		}

		const next = argv[index + 1];

		if (next === undefined || next.startsWith("--")) {
			flags.add(argument.slice(2));
			continue;
		}

		values.set(argument.slice(2), next);
		index++;
	}

	return {
		flag: (name: string) => flags.has(name),
		optional: (name: string) => values.get(name),
		required(name: string) {
			const value = values.get(name);

			if (value === undefined) throw new Error(`missing --${name}`);

			return value;
		},
	};
}

export function parseCluster(value: string): SwitchboardCluster {
	if (value !== "devnet" && value !== "mainnet") {
		throw new Error(`--cluster must be devnet or mainnet, not ${value}`);
	}

	return value;
}

/** Resolve the RPC URL and refuse to continue when it serves another cluster. */
export async function verifiedRpcUrl(
	cluster: SwitchboardCluster,
	rpcUrl: string | undefined,
) {
	const url = rpcUrl ?? DEFAULT_RPC[cluster];

	if (!url) throw new Error(`--rpc is required for ${cluster}`);

	const genesis = await createSolanaRpc(url).getGenesisHash().send();

	if (genesis !== GENESIS[cluster]) {
		throw new Error(`refusing to run: ${url} is not Solana ${cluster}`);
	}

	return url;
}

export async function loadKeypair(path: string): Promise<KeyPairSigner> {
	const bytes: unknown = JSON.parse(
		readFileSync(resolve(process.cwd(), path), "utf8"),
	);

	if (!Array.isArray(bytes) || bytes.length !== 64) {
		throw new Error(`${path} is not a 64-byte Solana keypair file`);
	}

	return createKeyPairSignerFromBytes(Uint8Array.from(bytes));
}

/** Retry HTTP 429s and dropped connections with backoff.
 *
 * Public RPC answers bursts with 429 and occasionally drops connections.
 * Resending the identical request body is safe: reads are idempotent and a
 * re-sent signed transaction keeps its signature, so it lands at most once.
 * Every RPC and gateway call, including the SDK's, goes through global fetch.
 */
export function installPatientFetch() {
	const direct = globalThis.fetch.bind(globalThis);

	globalThis.fetch = async (input, init) => {
		for (let attempt = 0;; attempt++) {
			let response: Response;

			try {
				response = await direct(input, init);
			} catch (error) {
				if (attempt === 8) throw error;

				await new Promise((done) => setTimeout(done, 2_000));
				continue;
			}

			if (response.status !== 429 || attempt === 8) return response;

			const retryAfter = Number(response.headers.get("retry-after"));
			const delay = Number.isFinite(retryAfter) && retryAfter > 0
				? retryAfter * 1_000
				: 500 * 2 ** Math.min(attempt, 4);

			await new Promise((done) => setTimeout(done, delay));
		}
	};
}
