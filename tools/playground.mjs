import { Surfnet } from "@solana/surfpool";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const programId = "Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op";
const oracleProgram = "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const port = Number(process.env.LOOTBOX_PLAYGROUND_PORT ?? 8898);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
	throw new RangeError("invalid playground port");
}

const surfnet = Surfnet.startWithConfig({
	offline: true,
	blockProductionMode: "clock",
	slotTimeMs: 400,
});
surfnet.deploy({
	programId,
	soPath: resolve(root, "target/deploy/lootbox_program.so"),
});
surfnet.deploy({
	programId: oracleProgram,
	soPath: resolve(root, "target/deploy/mock_switchboard.so"),
});
const oracle = Object.fromEntries(
	[
		"queue",
		"oracle",
		"rewardEscrow",
		"programState",
		"lutSigner",
		"lut",
		"stats",
	].map((name) => [name, Surfnet.newKeypair().publicKey]),
);
surfnet.fundSolMany(
	Object.values(oracle).map((address) => ({ address, lamports: 1_000_000 })),
);
const config = Object.freeze({
	network: "surfpool",
	testOnly: true,
	instanceId: randomBytes(16).toString("hex"),
	programId,
	oracleProgram,
	rpcUrl: surfnet.rpcUrl,
	wsUrl: surfnet.wsUrl,
	oracle,
});
const proofs = new Map();
const observer = setInterval(() => surfnet.drainEvents(), 100);
const allowedOrigins = new Set(
	[5173, 4173, port].flatMap((value) => [
		`http://localhost:${value}`,
		`http://127.0.0.1:${value}`,
	]),
);
const classicTokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const catalogCache = new Map();
const catalogTtlMs = 5 * 60 * 1000;
const fallbackTokens = Object.freeze([
	{
		id: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6XKj7D3WpqkDmzPK",
		name: "Bonk",
		symbol: "BONK",
		decimals: 5,
		verified: true,
		tokenProgram: classicTokenProgram,
	},
	{
		id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		name: "USD Coin",
		symbol: "USDC",
		decimals: 6,
		verified: true,
		tokenProgram: classicTokenProgram,
	},
]);

function safeQuery(value, maximum = 120) {
	if (
		typeof value !== "string" || value.length > maximum ||
		/[\u0000-\u001f\u007f]/.test(value)
	) {
		throw new RangeError("invalid search query");
	}
	return value.trim();
}

async function cached(key, load) {
	const hit = catalogCache.get(key);
	if (hit && Date.now() - hit.at < catalogTtlMs) return hit.value;
	const value = await load();
	if (catalogCache.size >= 100) {
		catalogCache.delete(catalogCache.keys().next().value);
	}
	catalogCache.set(key, { at: Date.now(), value });
	return value;
}

async function searchTokenCatalog(query) {
	const match = (token) =>
		[token.id, token.name, token.symbol].some((value) =>
			value.toLowerCase().includes(query.toLowerCase())
		);
	const fallback = fallbackTokens.filter(match);
	const apiKey = process.env.JUPITER_API_KEY;
	if (!apiKey) {
		return {
			items: fallback,
			source: "fallback",
			message:
				"Add JUPITER_API_KEY for live Jupiter Tokens results; showing a verified starter list.",
		};
	}
	try {
		return await cached(`jupiter:${query.toLowerCase()}`, async () => {
			const upstream = await fetch(
				`https://api.jup.ag/tokens/v2/search?query=${
					encodeURIComponent(query || "SOL")
				}`,
				{
					headers: { "x-api-key": apiKey },
					signal: AbortSignal.timeout(7_000),
				},
			);
			if (!upstream.ok) throw new Error(`Jupiter returned ${upstream.status}`);
			const payload = await upstream.json();
			if (!Array.isArray(payload)) {
				throw new TypeError("invalid Jupiter response");
			}
			const items = payload.slice(0, 20).flatMap((item) => {
				if (
					!item || !validAddress(item.id) || typeof item.name !== "string" ||
					typeof item.symbol !== "string" || !Number.isInteger(item.decimals) ||
					item.decimals < 0 || item.decimals > 9
				) return [];
				return [{
					id: item.id,
					name: item.name.slice(0, 80),
					symbol: item.symbol.slice(0, 20),
					...(typeof item.icon === "string" ? { icon: item.icon } : {}),
					decimals: item.decimals,
					verified: item.isVerified === true,
					tokenProgram: validAddress(item.tokenProgram)
						? item.tokenProgram
						: classicTokenProgram,
				}];
			});
			return { items, source: "live" };
		});
	} catch (error) {
		return {
			items: fallback,
			source: "fallback",
			message: `Jupiter is unavailable (${
				error instanceof Error ? error.message : "request failed"
			}); showing a verified starter list.`,
		};
	}
}

async function searchNftCatalog(owner, query) {
	const endpoint = process.env.DAS_RPC_URL;
	if (!endpoint) {
		return {
			items: [],
			source: "unavailable",
			message:
				"Add a DAS_RPC_URL to search this wallet's Metaplex, Core, and compressed NFTs.",
		};
	}
	try {
		return await cached(`das:${owner}:${query.toLowerCase()}`, async () => {
			const upstream = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: "lootbox-picker",
					method: "getAssetsByOwner",
					params: { ownerAddress: owner, page: 1, limit: 100 },
				}),
				signal: AbortSignal.timeout(7_000),
			});
			if (!upstream.ok) {
				throw new Error(`DAS provider returned ${upstream.status}`);
			}
			const payload = await upstream.json();
			if (payload.error) {
				throw new Error(String(payload.error.message ?? "DAS RPC error"));
			}
			const values = payload.result?.items;
			if (!Array.isArray(values)) throw new TypeError("invalid DAS response");
			const needle = query.toLowerCase();
			const items = values.flatMap((item) => {
				const name = item?.content?.metadata?.name;
				const standard = item?.interface;
				if (
					!validAddress(item?.id) || typeof name !== "string" ||
					typeof standard !== "string" ||
					standard.toLowerCase().includes("fungible") ||
					(needle &&
						!`${name} ${item.id} ${standard}`.toLowerCase().includes(needle))
				) return [];
				const image = item?.content?.links?.image ??
					item?.content?.files?.[0]?.uri;
				return [{
					id: item.id,
					name: name.slice(0, 100),
					...(typeof image === "string" ? { image } : {}),
					standard,
					compressed: item?.compression?.compressed === true,
				}];
			});
			return { items: items.slice(0, 40), source: "live" };
		});
	} catch (error) {
		return {
			items: [],
			source: "unavailable",
			message: `DAS search is unavailable (${
				error instanceof Error ? error.message : "request failed"
			}).`,
		};
	}
}

function validAddress(value) {
	return typeof value === "string" &&
		/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function reply(response, status, value) {
	response.writeHead(status, {
		"Content-Type": "application/json",
		"Cache-Control": "no-store",
	});
	response.end(JSON.stringify(value));
}

async function body(request) {
	let text = "";
	for await (const chunk of request) {
		text += chunk.toString();
		if (text.length > 1024) throw new RangeError("request too large");
	}
	return JSON.parse(text);
}

const server = createServer(async (request, response) => {
	// This is a local-only test control plane, never a hosted wallet service.
	if (
		!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
			request.socket.remoteAddress,
		) ||
		![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)
	) {
		reply(response, 403, { error: "loopback access only" });
		return;
	}
	const origin = request.headers.origin;
	if (origin && !allowedOrigins.has(origin)) {
		reply(response, 403, { error: "untrusted browser origin" });
		return;
	}
	if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
	response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	response.setHeader("Access-Control-Allow-Headers", "Content-Type");
	if (request.method === "OPTIONS") {
		response.writeHead(204);
		response.end();
		return;
	}
	try {
		surfnet.drainEvents();
		const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
		if (request.method === "GET" && url.pathname === "/config") {
			reply(response, 200, config);
			return;
		}
		if (request.method === "GET" && url.pathname === "/assets/tokens") {
			const query = safeQuery(url.searchParams.get("q") ?? "");
			reply(response, 200, await searchTokenCatalog(query));
			return;
		}
		if (request.method === "GET" && url.pathname === "/assets/nfts") {
			const owner = safeQuery(url.searchParams.get("owner") ?? "", 44);
			const query = safeQuery(url.searchParams.get("q") ?? "");
			if (!validAddress(owner)) throw new RangeError("invalid wallet address");
			reply(response, 200, await searchNftCatalog(owner, query));
			return;
		}
		if (request.method === "POST" && url.pathname === "/faucet") {
			const input = await body(request);
			if (!input || !validAddress(input.address)) {
				throw new RangeError("invalid address");
			}
			surfnet.fundSol(input.address, 100_000_000_000);
			reply(response, 200, { testOnly: true });
			return;
		}
		if (request.method === "POST" && url.pathname === "/time-travel") {
			const input = await body(request);
			if (
				!input || !Number.isSafeInteger(input.timestampSeconds) ||
				input.timestampSeconds < 0 || input.timestampSeconds > 4_102_444_800
			) throw new RangeError("invalid Unix timestamp");
			reply(
				response,
				200,
				surfnet.timeTravelToTimestamp(input.timestampSeconds * 1000),
			);
			return;
		}
		if (request.method === "GET" && url.pathname === "/proof") {
			const randomness = url.searchParams.get("randomness");
			if (!validAddress(randomness)) {
				throw new RangeError("invalid randomness address");
			}
			const rpcResponse = await fetch(surfnet.rpcUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "getAccountInfo",
					params: [randomness, { encoding: "base64", commitment: "processed" }],
				}),
			});
			const account = (await rpcResponse.json()).result?.value;
			if (account?.owner !== oracleProgram || !Array.isArray(account.data)) {
				throw new RangeError("no committed randomness account");
			}
			const bytes = Buffer.from(account.data[0], "base64");
			if (bytes.length !== 408 || bytes.readBigUInt64LE(104) === 0n) {
				throw new RangeError("randomness is not committed");
			}
			let value = proofs.get(randomness);
			if (!value) {
				value = bytes.readBigUInt64LE(144) === 0n
					? randomBytes(32)
					: bytes.subarray(152, 184);
				proofs.set(randomness, value);
			}
			// The emulator does not verify enclave signatures. Never use this
			// endpoint, these accounts, or these proofs on a real Solana network.
			reply(response, 200, {
				testOnly: true,
				signature: Array(64).fill(7),
				recoveryId: 1,
				value: Array.from(value),
			});
			return;
		}
		reply(response, 404, { error: "not found" });
	} catch (error) {
		reply(response, 400, {
			error: error instanceof Error ? error.message : "request failed",
		});
	}
});

server.listen(port, "127.0.0.1", () => {
	console.info(
		`Local-only Lootbox Surfpool control plane: http://127.0.0.1:${port}/config`,
	);
	console.info(JSON.stringify(config, null, 2));
	console.info(
		"All balances and oracle proofs are test-only. Restarting clears this network.",
	);
});
let stopped = false;
function stop() {
	if (stopped) return;
	stopped = true;
	clearInterval(observer);
	server.close();
	surfnet.stop();
}
server.on("error", (error) => {
	console.error(error.message);
	stop();
	process.exitCode = 1;
});
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
