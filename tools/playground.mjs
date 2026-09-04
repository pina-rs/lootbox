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
