import {
	type Address,
	address,
	getAddressEncoder,
	getBase64Decoder,
} from "@solana/kit";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	createSwitchboardOracle,
	lookupTableAddress,
	parseSwitchboardOracle,
	parseSwitchboardQueue,
	parseSwitchboardRandomness,
	parseSwitchboardRevealResponse,
	SWITCHBOARD_PROGRAM,
	SWITCHBOARD_QUEUE,
	SwitchboardError,
	switchboardLutSignerAddress,
	type SwitchboardOracleOptions,
} from "./switchboard.js";

type RecordedAccount = Readonly<
	{ address: string; owner: string; data: string }
>;
type Fixtures = Readonly<{
	recordedAtUnix: number;
	queue: RecordedAccount;
	freshOracle: RecordedAccount;
	staleOracle: RecordedAccount;
	gatewayReveal: Readonly<{ gatewayUri: string; status: number; body: string }>;
	gatewayUnavailableSlot: Readonly<{ status: number; body: string }>;
}>;

const fixtures: Fixtures = JSON.parse(
	readFileSync(new URL("./switchboard.fixtures.json", import.meta.url), "utf8"),
);
const program = SWITCHBOARD_PROGRAM.devnet;
const queue = SWITCHBOARD_QUEUE.devnet;
const freshOracle = address(fixtures.freshOracle.address);
const staleOracle = address(fixtures.staleOracle.address);
const randomness = address("7uG6Zb1ezT2kUvhuAB4TYy4fvrnjDvuQYdG8Ru6hPFaQ");
const rpcUrl = "https://rpc.test";
const revealUrl =
	`${fixtures.gatewayReveal.gatewayUri}/gateway/api/v1/randomness_reveal`;
const addressEncoder = getAddressEncoder();
const base64 = getBase64Decoder();

function decodeBase64(text: string) {
	return new Uint8Array(Buffer.from(text, "base64"));
}

/** Build a `RandomnessAccountData` payload the way Switchboard writes it. */
function randomnessPayload(
	input: Readonly<{
		queue?: Address;
		oracle?: Address;
		seedSlot?: bigint;
		revealSlot?: bigint;
		lutSlot?: bigint;
	}> = {},
) {
	const data = new Uint8Array(480);
	const view = new DataView(data.buffer);

	data.set([10, 66, 229, 135, 220, 239, 217, 114]);
	data.set(addressEncoder.encode(randomness), 8);
	data.set(addressEncoder.encode(input.queue ?? queue), 40);
	data.set(new Uint8Array(32).fill(7), 72);
	view.setBigUint64(104, input.seedSlot ?? 504_035_171n, true);
	data.set(addressEncoder.encode(input.oracle ?? freshOracle), 112);
	view.setBigUint64(144, input.revealSlot ?? 0n, true);
	view.setBigUint64(184, input.lutSlot ?? 504_035_100n, true);

	return data;
}

type GatewayReply = Readonly<{ status: number; body: string }> | "unreachable";
type Harness = Readonly<{
	accounts: Map<string, Readonly<{ owner: string; data: Uint8Array }>>;
	gateway: GatewayReply[];
	gatewayBodies: unknown[];
	sleeps: number[];
	options: SwitchboardOracleOptions;
}>;

function harness(
	randomnessData: Uint8Array | undefined = randomnessPayload(),
	gateway: GatewayReply[] = [fixtures.gatewayReveal],
): Harness {
	const accounts = new Map<
		string,
		Readonly<{ owner: string; data: Uint8Array }>
	>([
		[queue, { owner: program, data: decodeBase64(fixtures.queue.data) }],
		[freshOracle, {
			owner: program,
			data: decodeBase64(fixtures.freshOracle.data),
		}],
		[staleOracle, {
			owner: program,
			data: decodeBase64(fixtures.staleOracle.data),
		}],
	]);

	if (randomnessData) {
		accounts.set(randomness, { owner: program, data: randomnessData });
	}

	const gatewayBodies: unknown[] = [];
	const sleeps: number[] = [];
	const fakeFetch: typeof fetch = async (input, init) => {
		const url = input instanceof URL ? input.href : String(input);
		const body = typeof init?.body === "string" ? init.body : "";

		if (url === rpcUrl) {
			const request: { params: [string[]] } = JSON.parse(body);
			const value = request.params[0].map((key) => {
				const account = accounts.get(key);

				return account
					? {
						owner: account.owner,
						data: [base64.decode(account.data), "base64"],
					}
					: null;
			});

			return Response.json({ jsonrpc: "2.0", id: 1, result: { value } });
		}

		if (url === revealUrl) {
			gatewayBodies.push(JSON.parse(body));
			const reply = gateway.shift() ?? fixtures.gatewayUnavailableSlot;

			if (reply === "unreachable") throw new TypeError("fetch failed");

			return new Response(reply.body, { status: reply.status });
		}

		throw new Error(`unexpected request to ${url}`);
	};

	return {
		accounts,
		gateway,
		gatewayBodies,
		sleeps,
		options: {
			rpcUrl,
			cluster: "devnet",
			fetch: fakeFetch,
			now: () => fixtures.recordedAtUnix * 1000,
			random: () => 0.99,
			sleep: async (ms) => {
				sleeps.push(ms);
			},
		},
	};
}

async function rejection(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		if (error instanceof SwitchboardError) return error;
		throw error;
	}

	throw new Error("expected a SwitchboardError");
}

describe("Switchboard account parsing", () => {
	it("reads the recorded devnet queue's active oracle set", () => {
		const state = parseSwitchboardQueue(decodeBase64(fixtures.queue.data));

		expect(state.oracleKeys).toHaveLength(9);
		expect(state.oracleKeys[0]).toBe(freshOracle);
		expect(state.oracleKeys).toContain(staleOracle);
		expect(state.nodeTimeout).toBe(300n);
	});

	it("reads the recorded oracle's gateway and freshness", () => {
		const fresh = parseSwitchboardOracle(
			decodeBase64(fixtures.freshOracle.data),
		);
		const stale = parseSwitchboardOracle(
			decodeBase64(fixtures.staleOracle.data),
		);
		const now = BigInt(fixtures.recordedAtUnix);

		expect(fresh.queue).toBe(queue);
		expect(fresh.gatewayUri).toBe(fixtures.gatewayReveal.gatewayUri);
		expect(fresh.verified).toBe(true);
		expect(fresh.isOnQueue).toBe(true);
		expect(fresh.validUntil > now).toBe(true);
		expect(now - fresh.lastHeartbeat <= 300n).toBe(true);
		expect(stale.validUntil < now).toBe(true);
	});

	it("rejects foreign account types", () => {
		expect(() => parseSwitchboardQueue(decodeBase64(fixtures.freshOracle.data)))
			.toThrow(SwitchboardError);
		expect(() => parseSwitchboardOracle(decodeBase64(fixtures.queue.data)))
			.toThrow(SwitchboardError);
		expect(() => parseSwitchboardRandomness(new Uint8Array(480)))
			.toThrow(SwitchboardError);
	});

	it("reads every randomness field at its Switchboard offset", () => {
		const state = parseSwitchboardRandomness(
			randomnessPayload({ seedSlot: 9n, revealSlot: 11n, lutSlot: 3n }),
		);

		expect(state.queue).toBe(queue);
		expect(state.oracle).toBe(freshOracle);
		expect(state.seedSlot).toBe(9n);
		expect(state.revealSlot).toBe(11n);
		expect(state.lutSlot).toBe(3n);
		expect(state.seedSlothash).toEqual(new Uint8Array(32).fill(7));
	});
});

describe("gateway reveal responses", () => {
	it("decodes the recorded devnet gateway response", () => {
		const proof = parseSwitchboardRevealResponse(fixtures.gatewayReveal.body);

		expect(proof.signature).toHaveLength(64);
		expect(proof.recoveryId).toBe(1);
		expect(Array.from(proof.value).slice(0, 4)).toEqual([12, 242, 133, 235]);
	});

	it.each([
		["non-JSON", "expected value at line 1 column 1"],
		[
			"short signature",
			JSON.stringify({
				signature: "AAAA",
				recovery_id: 0,
				value: Array(32).fill(0),
			}),
		],
		[
			"bad recovery id",
			fixtures.gatewayReveal.body.replace(`"recovery_id":1`, `"recovery_id":4`),
		],
		[
			"short value",
			JSON.stringify({
				signature: JSON.parse(fixtures.gatewayReveal.body).signature,
				recovery_id: 0,
				value: Array(31).fill(0),
			}),
		],
		[
			"out-of-range byte",
			JSON.stringify({
				signature: JSON.parse(fixtures.gatewayReveal.body).signature,
				recovery_id: 0,
				value: [...Array(31).fill(0), 256],
			}),
		],
	])("rejects a %s", (_, body) => {
		expect(() => parseSwitchboardRevealResponse(body)).toThrow(
			SwitchboardError,
		);
	});
});

describe("createSwitchboardOracle", () => {
	it("selects only fresh oracles and derives the per-randomness LUT", async () => {
		const { options } = harness();
		const oracle = createSwitchboardOracle(options);
		const accounts = await oracle.selectAccounts({
			randomness,
			recentSlot: 504_035_000n,
		});
		const lutSigner = await switchboardLutSignerAddress(program, randomness);

		expect(accounts).toEqual({
			queue,
			oracle: freshOracle,
			// Both PDAs were confirmed to exist on devnet with the State and
			// OracleStatsAccountData discriminators.
			programState: address("4UFmCebEmzESoDTtHrmaftXj7YAsAH4HMios3yMWyVUT"),
			lutSigner,
			lut: await lookupTableAddress(lutSigner, 504_035_000n),
			stats: address("3x3kPB13ZfLgAAMtFy8zHegL1Kv7HTcLSdt2vtAxXqVw"),
		});
	});

	it("reports a queue without a live oracle", async () => {
		const { options } = harness();
		const oracle = createSwitchboardOracle({
			...options,
			now: () => (fixtures.recordedAtUnix + 86_400 * 30) * 1000,
		});
		const error = await rejection(
			oracle.selectAccounts({ randomness, recentSlot: 1n }),
		);

		expect(error.code).toBe("noUsableOracle");
	});

	it("derives accounts for the committed oracle and LUT slot", async () => {
		const { options } = harness(randomnessPayload({ lutSlot: 42n }));
		const accounts = await createSwitchboardOracle(options).accountsFor(
			randomness,
		);
		const lutSigner = await switchboardLutSignerAddress(program, randomness);

		expect(accounts.oracle).toBe(freshOracle);
		expect(accounts.lut).toBe(await lookupTableAddress(lutSigner, 42n));
	});

	it("waits for a fresh commit to become visible", async () => {
		const { options, accounts } = harness(undefined);
		const oracle = createSwitchboardOracle({
			...options,
			sleep: async () => {
				accounts.set(randomness, { owner: program, data: randomnessPayload() });
			},
		});
		const resolved = await oracle.accountsFor(randomness);

		expect(resolved.oracle).toBe(freshOracle);
	});

	it("fetches the proof from the bound oracle's gateway", async () => {
		const { options, gatewayBodies } = harness();
		const proof = await createSwitchboardOracle(options).fetchProof(randomness);

		expect(proof).toEqual(
			parseSwitchboardRevealResponse(fixtures.gatewayReveal.body),
		);
		expect(gatewayBodies).toEqual([{
			slothash: Array(32).fill(7),
			randomness_key: Buffer.from(addressEncoder.encode(randomness)).toString(
				"hex",
			),
			slot: 504_035_171,
		}]);
	});

	it("backs off while the gateway cannot serve the seed slot yet", async () => {
		const { options, sleeps } = harness(randomnessPayload(), [
			fixtures.gatewayUnavailableSlot,
			"unreachable",
			fixtures.gatewayReveal,
		]);
		const proof = await createSwitchboardOracle(options).fetchProof(randomness);

		expect(proof.recoveryId).toBe(1);
		expect(sleeps).toEqual([500, 1000]);
	});

	it("gives up with a timeout after the retry budget", async () => {
		const { options, sleeps } = harness(randomnessPayload(), []);
		const error = await rejection(
			createSwitchboardOracle(options).fetchProof(randomness, {
				retry: { attempts: 4, initialDelayMs: 100, maxDelayMs: 300 },
			}),
		);

		expect(error.code).toBe("timeout");
		expect(error.message).toContain("HTTP 500");
		expect(sleeps).toEqual([100, 200, 300]);
	});

	it("does not retry a gateway rejection", async () => {
		const { options, sleeps } = harness(randomnessPayload(), [
			{ status: 400, body: "bad request" },
		]);
		const error = await rejection(
			createSwitchboardOracle(options).fetchProof(randomness),
		);

		expect(error.code).toBe("gateway");
		expect(error.status).toBe(400);
		expect(sleeps).toEqual([]);
	});

	it("waits for a commit that is not visible yet", async () => {
		const { options } = harness(randomnessPayload({ seedSlot: 0n }));
		const error = await rejection(
			createSwitchboardOracle(options).fetchProof(randomness, {
				retry: { attempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
			}),
		);

		expect(error.code).toBe("timeout");
		expect(error.message).toContain("has not been committed");
	});

	it("rejects an oracle that serves another queue", async () => {
		const { options, accounts } = harness();
		const foreign = decodeBase64(fixtures.freshOracle.data);

		foreign.set(addressEncoder.encode(SWITCHBOARD_QUEUE.mainnet), 3472);
		accounts.set(freshOracle, { owner: program, data: foreign });

		const error = await rejection(
			createSwitchboardOracle(options).fetchProof(randomness),
		);

		expect(error.code).toBe("wrongOracle");
	});

	it("rejects randomness from a different queue", async () => {
		const { options } = harness(
			randomnessPayload({ queue: SWITCHBOARD_QUEUE.mainnet }),
		);
		const error = await rejection(
			createSwitchboardOracle(options).accountsFor(randomness),
		);

		expect(error.code).toBe("wrongQueue");
	});

	it("refuses to re-reveal", async () => {
		const { options } = harness(
			randomnessPayload({ revealSlot: 504_035_180n }),
		);
		const error = await rejection(
			createSwitchboardOracle(options).fetchProof(randomness),
		);

		expect(error.code).toBe("alreadyRevealed");
	});

	it("rejects accounts not owned by the cluster's Switchboard program", async () => {
		const { options, accounts } = harness();

		accounts.set(randomness, {
			owner: SWITCHBOARD_PROGRAM.mainnet,
			data: randomnessPayload(),
		});

		const error = await rejection(
			createSwitchboardOracle(options).accountsFor(randomness),
		);

		expect(error.code).toBe("invalidAccount");
	});
});
