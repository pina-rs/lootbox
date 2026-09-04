import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { get as httpGet } from "node:http";
import { createServer } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

test("local Surfpool control plane is labeled and rejects untrusted requests", {
	timeout: 30_000,
}, async (t) => {
	const reservation = createServer();
	reservation.listen(0, "127.0.0.1");
	await once(reservation, "listening");
	const address = reservation.address();
	assert.ok(address && typeof address !== "string");
	const port = address.port;
	await new Promise((resolve, reject) =>
		reservation.close((error) => error ? reject(error) : resolve())
	);
	const child = spawn(process.execPath, ["tools/playground.mjs"], {
		env: { ...process.env, LOOTBOX_PLAYGROUND_PORT: String(port) },
		stdio: ["ignore", "ignore", "pipe"],
	});
	let diagnostics = "";
	child.stderr.on("data", (chunk) => {
		diagnostics += chunk.toString();
	});
	const exited = once(child, "exit");
	t.after(async () => {
		if (child.exitCode !== null || child.signalCode !== null) return;
		child.kill("SIGINT");
		const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);
		try {
			await exited;
		} finally {
			clearTimeout(timeout);
		}
	});
	const base = `http://127.0.0.1:${port}`;
	let config;
	for (let attempt = 0; attempt < 100; attempt++) {
		assert.equal(child.exitCode, null, diagnostics);
		try {
			const response = await fetch(`${base}/config`, {
				signal: AbortSignal.timeout(500),
			});
			if (response.ok) {
				config = await response.json();
				break;
			}
		} catch { /* Native runtime is still starting. */ }
		await delay(100);
	}
	assert.ok(config, `service did not start: ${diagnostics}`);
	assert.equal(config.testOnly, true);
	assert.equal(config.network, "surfpool");
	assert.match(config.rpcUrl, /^http:\/\/127\.0\.0\.1:/);
	assert.equal(JSON.stringify(config).includes("secret"), false);
	const trusted = await fetch(`${base}/config`, { headers: { Origin: base } });
	assert.equal(trusted.headers.get("Access-Control-Allow-Origin"), base);
	assert.equal(
		(await fetch(`${base}/config`, {
			headers: { Origin: "https://untrusted.example" },
		})).status,
		403,
	);
	// Fetch normalizes Host; use raw HTTP so the server really receives the
	// hostile header instead of accidentally testing a valid loopback Host.
	const hostileHostStatus = await new Promise((resolve, reject) => {
		httpGet(
			`${base}/config`,
			{ headers: { Host: "untrusted.example" } },
			(response) => {
				response.resume();
				resolve(response.statusCode);
			},
		).on("error", reject);
	});
	assert.equal(hostileHostStatus, 403);
	assert.equal(
		(await fetch(`${base}/faucet`, { method: "POST", body: "x".repeat(2048) }))
			.status,
		400,
	);
	assert.equal(
		(await fetch(`${base}/proof?randomness=${config.programId}`)).status,
		400,
	);
	assert.equal(
		(await fetch(`${base}/time-travel`, {
			method: "POST",
			body: JSON.stringify({ timestampSeconds: -1 }),
		})).status,
		400,
	);
	const wallet = "not-an-address";
	// Use an existing valid fixture address without touching the fee payer.
	const recipient = config.oracle.stats;
	assert.equal(
		(await fetch(`${base}/faucet`, {
			method: "POST",
			body: JSON.stringify({ address: wallet }),
		})).status,
		400,
	);
	assert.equal(
		(await fetch(`${base}/faucet`, {
			method: "POST",
			body: JSON.stringify({ address: recipient }),
		})).status,
		200,
	);
	const balance = await fetch(config.rpcUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "getBalance",
			params: [recipient],
		}),
	});
	assert.equal((await balance.json()).result.value, 100_000_000_000);
});
