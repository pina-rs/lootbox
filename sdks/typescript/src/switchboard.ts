/**
 * Switchboard On-Demand randomness transport for real clusters.
 *
 * The lootbox program drives Switchboard through CPI: `requestOpen` runs
 * `randomness_init` + `randomness_commit` with the opening PDA as randomness
 * authority, and `fulfill` runs `randomness_reveal` with a proof signed by the
 * oracle the commit bound. This module supplies the off-chain half: it picks a
 * live oracle from the queue, derives every Switchboard account the CPIs
 * need, and asks the bound oracle's gateway for the reveal proof.
 *
 * Layouts, seeds, and the gateway protocol mirror the deployed program's
 * on-chain Anchor IDL and `@switchboard-xyz/on-demand` 3.10.6
 * (`Randomness.create`, `Randomness.revealIx`, `Queue.inspectRandomnessOracles`)
 * and `@switchboard-xyz/common` 5.8.5 (`Gateway.fetchRandomnessReveal`). The
 * module talks JSON-RPC over `fetch` directly so browsers and Node share one
 * dependency-free code path, and tests can replay recorded responses.
 *
 * Trust: the gateway response is not trusted. `randomness_reveal` verifies
 * the secp256k1 signature against the committed oracle's enclave key on-chain,
 * so a malicious or buggy gateway can only cause a failed transaction.
 */
import {
	type Address,
	address,
	getAddressDecoder,
	getAddressEncoder,
	getBase64Encoder,
	getProgramDerivedAddress,
	getU64Encoder,
} from "@solana/kit";
import type {
	OracleAccounts,
	OracleProof,
	RandomnessBinding,
} from "./client.js";

export type SwitchboardCluster = "devnet" | "mainnet";

/** Switchboard On-Demand program per cluster (`ON_DEMAND_*_PID`). */
export const SWITCHBOARD_PROGRAM: Readonly<
	Record<SwitchboardCluster, Address>
> = {
	devnet: address("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"),
	mainnet: address("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"),
};

/** Default randomness queue per cluster (`ON_DEMAND_*_QUEUE`). */
export const SWITCHBOARD_QUEUE: Readonly<Record<SwitchboardCluster, Address>> =
	{
		devnet: address("EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7"),
		mainnet: address("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w"),
	};

const LOOKUP_TABLE_PROGRAM = address(
	"AddressLookupTab1e1111111111111111111111111",
);
const DEFAULT_ADDRESS = address("11111111111111111111111111111111");

const RANDOMNESS_DISCRIMINATOR = [10, 66, 229, 135, 220, 239, 217, 114];
const ORACLE_DISCRIMINATOR = [128, 30, 16, 241, 170, 73, 55, 54];
const QUEUE_DISCRIMINATOR = [217, 194, 55, 127, 184, 83, 138, 1];

// Byte offsets include the 8-byte Anchor discriminator. Every struct is
// bytemuck `repr(C)`; offsets were checked against live devnet and mainnet
// accounts.
const RANDOMNESS_LAYOUT = {
	authority: 8,
	queue: 40,
	seedSlothash: 72,
	seedSlot: 104,
	oracle: 112,
	revealSlot: 144,
	value: 152,
	lutSlot: 184,
	minLength: 192,
} as const;
const ORACLE_LAYOUT = {
	verificationStatus: 72,
	validUntil: 88,
	queue: 3472,
	lastHeartbeat: 3512,
	gatewayUri: 3584,
	gatewayUriLength: 64,
	isOnQueue: 3656,
	minLength: 3657,
} as const;
const QUEUE_LAYOUT = {
	oracleKeys: 1064,
	oracleKeysCapacity: 78,
	nodeTimeout: 5176,
	oracleKeysLen: 5204,
	minLength: 5208,
} as const;
/** `Quote.verification_status` value for a verified enclave. */
const ORACLE_VERIFIED = 4;

export type SwitchboardErrorCode =
	| "rpc"
	| "accountMissing"
	| "invalidAccount"
	| "wrongQueue"
	| "wrongOracle"
	| "noUsableOracle"
	| "notCommitted"
	| "alreadyRevealed"
	| "gateway"
	| "invalidProof"
	| "timeout";

/** A typed Switchboard transport failure. `retryable` marks conditions that
 * can clear on their own (RPC lag, a gateway that has not seen the seed slot
 * yet); `fetchProof` retries those and surfaces everything else at once.
 */
export class SwitchboardError extends Error {
	override readonly name = "SwitchboardError";

	constructor(
		readonly code: SwitchboardErrorCode,
		message: string,
		readonly retryable = false,
		readonly status?: number,
	) {
		super(message);
	}
}

export type SwitchboardRandomness = Readonly<{
	authority: Address;
	queue: Address;
	seedSlothash: Uint8Array;
	seedSlot: bigint;
	oracle: Address;
	revealSlot: bigint;
	value: Uint8Array;
	lutSlot: bigint;
}>;

export type SwitchboardOracleState = Readonly<{
	queue: Address;
	verified: boolean;
	validUntil: bigint;
	lastHeartbeat: bigint;
	isOnQueue: boolean;
	gatewayUri: string;
}>;

export type SwitchboardQueueState = Readonly<{
	oracleKeys: readonly Address[];
	nodeTimeout: bigint;
}>;

export type SwitchboardRetry = Readonly<{
	attempts: number;
	initialDelayMs: number;
	maxDelayMs: number;
}>;

export type FetchProofOptions = Readonly<{
	retry?: SwitchboardRetry;
	signal?: AbortSignal;
}>;

export type SwitchboardOracle = Readonly<{
	programId: Address;
	queue: Address;
	/** Choose a live oracle from the queue and derive the accounts
	 * `requestOpen` needs. The lookup-table accounts belong to the randomness
	 * account, not the oracle, so they depend on the fresh randomness address
	 * and the `recent_slot` passed to `randomness_init`.
	 */
	selectAccounts(binding: RandomnessBinding): Promise<OracleAccounts>;
	/** Accounts for the oracle a committed randomness account is bound to,
	 * for `fulfill`, `settle`, and `closeTemplateOpening`.
	 */
	accountsFor(randomness: Address): Promise<OracleAccounts>;
	/** Ask the bound oracle's gateway for the reveal proof, retrying with
	 * exponential backoff while the commit or seed slot is not yet visible.
	 */
	fetchProof(
		randomness: Address,
		options?: FetchProofOptions,
	): Promise<OracleProof>;
}>;

export type SwitchboardOracleOptions = Readonly<{
	rpcUrl: string;
	cluster: SwitchboardCluster;
	fetch?: typeof fetch;
	/** Override the default queue; it must match the template's `oracleQueue`. */
	queue?: Address;
	/** Injected for deterministic tests. */
	now?: () => number;
	random?: () => number;
	sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}>;

export const DEFAULT_PROOF_RETRY: SwitchboardRetry = {
	attempts: 12,
	initialDelayMs: 500,
	maxDelayMs: 5_000,
};

const addressDecoder = getAddressDecoder();
const addressEncoder = getAddressEncoder();
const base64 = getBase64Encoder();
const utf8 = new TextEncoder();
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

function hasDiscriminator(data: Uint8Array, expected: readonly number[]) {
	return expected.every((byte, index) => data[index] === byte);
}

function view(data: Uint8Array) {
	return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function readAddress(data: Uint8Array, offset: number): Address {
	return addressDecoder.decode(data.subarray(offset, offset + 32));
}

/** Parse a Switchboard `RandomnessAccountData` payload. */
export function parseSwitchboardRandomness(
	data: Uint8Array,
): SwitchboardRandomness {
	if (
		data.length < RANDOMNESS_LAYOUT.minLength ||
		!hasDiscriminator(data, RANDOMNESS_DISCRIMINATOR)
	) {
		throw new SwitchboardError(
			"invalidAccount",
			"account is not a Switchboard randomness account",
		);
	}

	const bytes = view(data);

	return {
		authority: readAddress(data, RANDOMNESS_LAYOUT.authority),
		queue: readAddress(data, RANDOMNESS_LAYOUT.queue),
		seedSlothash: data.slice(
			RANDOMNESS_LAYOUT.seedSlothash,
			RANDOMNESS_LAYOUT.seedSlothash + 32,
		),
		seedSlot: bytes.getBigUint64(RANDOMNESS_LAYOUT.seedSlot, true),
		oracle: readAddress(data, RANDOMNESS_LAYOUT.oracle),
		revealSlot: bytes.getBigUint64(RANDOMNESS_LAYOUT.revealSlot, true),
		value: data.slice(RANDOMNESS_LAYOUT.value, RANDOMNESS_LAYOUT.value + 32),
		lutSlot: bytes.getBigUint64(RANDOMNESS_LAYOUT.lutSlot, true),
	};
}

/** Parse the fields of a Switchboard `OracleAccountData` that decide
 * whether it can serve randomness and where its gateway lives.
 */
export function parseSwitchboardOracle(
	data: Uint8Array,
): SwitchboardOracleState {
	if (
		data.length < ORACLE_LAYOUT.minLength ||
		!hasDiscriminator(data, ORACLE_DISCRIMINATOR)
	) {
		throw new SwitchboardError(
			"invalidAccount",
			"account is not a Switchboard oracle account",
		);
	}

	const bytes = view(data);
	const uriBytes = data.subarray(
		ORACLE_LAYOUT.gatewayUri,
		ORACLE_LAYOUT.gatewayUri + ORACLE_LAYOUT.gatewayUriLength,
	);
	const end = uriBytes.indexOf(0);
	let gatewayUri: string;

	try {
		gatewayUri = strictUtf8.decode(
			end === -1 ? uriBytes : uriBytes.subarray(0, end),
		);
	} catch {
		throw new SwitchboardError(
			"invalidAccount",
			"oracle gateway URI is not valid UTF-8",
		);
	}

	return {
		queue: readAddress(data, ORACLE_LAYOUT.queue),
		verified: data[ORACLE_LAYOUT.verificationStatus] === ORACLE_VERIFIED,
		validUntil: bytes.getBigInt64(ORACLE_LAYOUT.validUntil, true),
		lastHeartbeat: bytes.getBigInt64(ORACLE_LAYOUT.lastHeartbeat, true),
		isOnQueue: data[ORACLE_LAYOUT.isOnQueue] !== 0,
		gatewayUri,
	};
}

/** Parse the active oracle set and heartbeat timeout of a queue. */
export function parseSwitchboardQueue(data: Uint8Array): SwitchboardQueueState {
	if (
		data.length < QUEUE_LAYOUT.minLength ||
		!hasDiscriminator(data, QUEUE_DISCRIMINATOR)
	) {
		throw new SwitchboardError(
			"invalidAccount",
			"account is not a Switchboard queue account",
		);
	}

	const bytes = view(data);
	const length = bytes.getUint32(QUEUE_LAYOUT.oracleKeysLen, true);

	if (length > QUEUE_LAYOUT.oracleKeysCapacity) {
		throw new SwitchboardError(
			"invalidAccount",
			"queue oracle count exceeds its capacity",
		);
	}

	return {
		oracleKeys: Array.from(
			{ length },
			(_, index) => readAddress(data, QUEUE_LAYOUT.oracleKeys + index * 32),
		),
		nodeTimeout: bytes.getBigInt64(QUEUE_LAYOUT.nodeTimeout, true),
	};
}

/** Normalize an on-chain gateway URI, rejecting anything but http(s). */
export function switchboardGatewayUrl(gatewayUri: string): URL | undefined {
	if (!URL.canParse(gatewayUri)) return undefined;

	const url = new URL(gatewayUri);

	return url.protocol === "https:" || url.protocol === "http:"
		? url
		: undefined;
}

/** Whether an oracle can currently serve randomness for `queue`: the same
 * freshness rules `Queue.inspectRandomnessOracles` applies on-chain data.
 */
export function isSwitchboardOracleUsable(
	oracle: SwitchboardOracleState,
	queue: Readonly<{ address: Address; nodeTimeout: bigint }>,
	nowUnix: bigint,
): boolean {
	return oracle.queue === queue.address &&
		oracle.isOnQueue &&
		oracle.verified &&
		oracle.validUntil > nowUnix &&
		nowUnix - oracle.lastHeartbeat <= queue.nodeTimeout &&
		switchboardGatewayUrl(oracle.gatewayUri) !== undefined;
}

/** Decode a `/gateway/api/v1/randomness_reveal` body into reveal arguments. */
export function parseSwitchboardRevealResponse(body: string): OracleProof {
	let parsed: unknown;

	try {
		parsed = JSON.parse(body);
	} catch {
		throw new SwitchboardError(
			"invalidProof",
			"gateway reveal response is not JSON",
		);
	}

	if (typeof parsed !== "object" || parsed === null) {
		throw new SwitchboardError(
			"invalidProof",
			"gateway reveal response is not an object",
		);
	}

	const signatureText = "signature" in parsed ? parsed.signature : undefined;
	const recoveryId = "recovery_id" in parsed ? parsed.recovery_id : undefined;
	const valueBytes = "value" in parsed ? parsed.value : undefined;

	if (typeof signatureText !== "string") {
		throw new SwitchboardError("invalidProof", "gateway signature is missing");
	}

	let signature: Uint8Array;

	try {
		signature = new Uint8Array(base64.encode(signatureText));
	} catch {
		throw new SwitchboardError(
			"invalidProof",
			"gateway signature is not base64",
		);
	}

	if (signature.length !== 64) {
		throw new SwitchboardError(
			"invalidProof",
			"gateway signature must contain exactly 64 bytes",
		);
	}

	if (
		typeof recoveryId !== "number" ||
		!Number.isInteger(recoveryId) ||
		recoveryId < 0 ||
		recoveryId > 3
	) {
		throw new SwitchboardError(
			"invalidProof",
			"gateway recovery id must be an integer between 0 and 3",
		);
	}

	if (
		!Array.isArray(valueBytes) ||
		valueBytes.length !== 32 ||
		!valueBytes.every((byte: unknown) =>
			typeof byte === "number" && Number.isInteger(byte) && byte >= 0 &&
			byte <= 255
		)
	) {
		throw new SwitchboardError(
			"invalidProof",
			"gateway value must be exactly 32 bytes",
		);
	}

	return {
		signature,
		recoveryId,
		value: Uint8Array.from(valueBytes),
	};
}

/** Switchboard's global `State` account. */
export async function switchboardProgramStateAddress(programId: Address) {
	return (await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [utf8.encode("STATE")],
	}))[0];
}

/** Lookup-table authority Switchboard derives per randomness account. */
export async function switchboardLutSignerAddress(
	programId: Address,
	randomness: Address,
) {
	return (await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [utf8.encode("LutSigner"), addressEncoder.encode(randomness)],
	}))[0];
}

/** Address Lookup Table address for `authority` created at `recentSlot`. */
export async function lookupTableAddress(
	authority: Address,
	recentSlot: bigint,
) {
	return (await getProgramDerivedAddress({
		programAddress: LOOKUP_TABLE_PROGRAM,
		seeds: [
			addressEncoder.encode(authority),
			getU64Encoder().encode(recentSlot),
		],
	}))[0];
}

/** Per-oracle randomness statistics account the reveal increments. */
export async function switchboardOracleStatsAddress(
	programId: Address,
	oracle: Address,
) {
	return (await getProgramDerivedAddress({
		programAddress: programId,
		seeds: [
			utf8.encode("OracleRandomnessStats"),
			addressEncoder.encode(oracle),
		],
	}))[0];
}

/** Derive the full account set for one randomness account and oracle. */
export async function switchboardOracleAccounts(
	programId: Address,
	queue: Address,
	oracle: Address,
	randomness: Address,
	lutSlot: bigint,
): Promise<OracleAccounts> {
	const lutSigner = await switchboardLutSignerAddress(programId, randomness);

	return {
		queue,
		oracle,
		programState: await switchboardProgramStateAddress(programId),
		lutSigner,
		lut: await lookupTableAddress(lutSigner, lutSlot),
		stats: await switchboardOracleStatsAddress(programId, oracle),
	};
}

type RpcAccount = Readonly<{ owner: Address; data: Uint8Array }>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function decodeRpcAccount(value: unknown): RpcAccount | undefined {
	if (value === null) return undefined;

	if (
		!isRecord(value) ||
		typeof value.owner !== "string" ||
		!Array.isArray(value.data) ||
		typeof value.data[0] !== "string"
	) {
		throw new SwitchboardError("rpc", "RPC returned a malformed account");
	}

	return {
		owner: address(value.owner),
		data: new Uint8Array(base64.encode(value.data[0])),
	};
}

function defaultSleep(ms: number, signal?: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason);
			return;
		}

		const timer = setTimeout(resolve, ms);

		signal?.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(signal.reason);
		}, { once: true });
	});
}

/** Create the Switchboard On-Demand transport for one cluster. */
export function createSwitchboardOracle(
	options: SwitchboardOracleOptions,
): SwitchboardOracle {
	const programId = SWITCHBOARD_PROGRAM[options.cluster];
	const queue = options.queue ?? SWITCHBOARD_QUEUE[options.cluster];
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const now = options.now ?? Date.now;
	const random = options.random ?? Math.random;
	const sleep = options.sleep ?? defaultSleep;
	let rpcId = 0;

	async function rpc(method: string, params: readonly unknown[]) {
		let response: Response;

		try {
			response = await fetcher(options.rpcUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
			});
		} catch {
			throw new SwitchboardError("rpc", `${method} request failed`, true);
		}

		if (!response.ok) {
			throw new SwitchboardError(
				"rpc",
				`${method} returned HTTP ${response.status}`,
				response.status === 429 || response.status >= 500,
				response.status,
			);
		}

		const body: unknown = await response.json();

		if (!isRecord(body) || "error" in body || !isRecord(body.result)) {
			throw new SwitchboardError("rpc", `${method} returned an error`);
		}

		return body.result.value;
	}

	async function accounts(keys: readonly Address[]) {
		const value = await rpc("getMultipleAccounts", [keys, {
			encoding: "base64",
			commitment: "confirmed",
		}]);

		if (!Array.isArray(value) || value.length !== keys.length) {
			throw new SwitchboardError(
				"rpc",
				"RPC returned a malformed account list",
			);
		}

		return value.map(decodeRpcAccount);
	}

	async function ownedAccount(key: Address, label: string) {
		const [account] = await accounts([key]);

		if (!account) {
			throw new SwitchboardError(
				"accountMissing",
				`${label} ${key} does not exist`,
				true,
			);
		}

		if (account.owner !== programId) {
			throw new SwitchboardError(
				"invalidAccount",
				`${label} ${key} is not owned by Switchboard ${programId}`,
			);
		}

		return account.data;
	}

	async function committedRandomness(randomness: Address) {
		const state = parseSwitchboardRandomness(
			await ownedAccount(randomness, "randomness account"),
		);

		if (state.queue !== queue) {
			throw new SwitchboardError(
				"wrongQueue",
				`randomness ${randomness} belongs to queue ${state.queue}, not ${queue}`,
			);
		}

		if (state.seedSlot === 0n || state.oracle === DEFAULT_ADDRESS) {
			throw new SwitchboardError(
				"notCommitted",
				`randomness ${randomness} has not been committed`,
				true,
			);
		}

		return state;
	}

	async function boundGateway(state: SwitchboardRandomness) {
		const oracle = parseSwitchboardOracle(
			await ownedAccount(state.oracle, "oracle account"),
		);

		if (oracle.queue !== state.queue) {
			throw new SwitchboardError(
				"wrongOracle",
				`oracle ${state.oracle} serves queue ${oracle.queue}, not ${state.queue}`,
			);
		}

		const gateway = switchboardGatewayUrl(oracle.gatewayUri);

		if (!gateway) {
			throw new SwitchboardError(
				"wrongOracle",
				`oracle ${state.oracle} has no usable gateway URI`,
			);
		}

		return gateway;
	}

	async function requestReveal(
		gateway: URL,
		randomness: Address,
		state: SwitchboardRandomness,
		signal?: AbortSignal,
	) {
		const endpoint = new URL(
			`${gateway.pathname.replace(/\/$/, "")}/gateway/api/v1/randomness_reveal`,
			gateway,
		);
		let response: Response;

		// Privacy: the RPC URL is deliberately not forwarded; it often embeds
		// an API key, and the gateway resolves the slot hash without it.
		try {
			response = await fetcher(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					slothash: Array.from(state.seedSlothash),
					randomness_key: Array.from(
						addressEncoder.encode(randomness),
						(byte) => byte.toString(16).padStart(2, "0"),
					).join(""),
					slot: Number(state.seedSlot),
				}),
				...(signal ? { signal } : {}),
			});
		} catch {
			if (signal?.aborted) throw signal.reason;

			throw new SwitchboardError(
				"gateway",
				`gateway ${gateway.host} is unreachable`,
				true,
			);
		}

		const body = await response.text();

		if (!response.ok) {
			throw new SwitchboardError(
				"gateway",
				`gateway ${gateway.host} returned HTTP ${response.status}: ${
					body.slice(0, 200)
				}`,
				response.status === 429 || response.status >= 500,
				response.status,
			);
		}

		return parseSwitchboardRevealResponse(body);
	}

	async function revealOnce(randomness: Address, signal?: AbortSignal) {
		const state = await committedRandomness(randomness);

		if (state.revealSlot !== 0n) {
			throw new SwitchboardError(
				"alreadyRevealed",
				`randomness ${randomness} was already revealed at slot ${state.revealSlot}`,
			);
		}

		return requestReveal(await boundGateway(state), randomness, state, signal);
	}

	return {
		programId,
		queue,

		async selectAccounts(binding) {
			const queueState = parseSwitchboardQueue(
				await ownedAccount(queue, "queue account"),
			);
			const oracleAccounts = queueState.oracleKeys.length === 0
				? []
				: await accounts(queueState.oracleKeys);
			const nowUnix = BigInt(Math.floor(now() / 1000));
			const usable = queueState.oracleKeys.filter((key, index) => {
				const account = oracleAccounts[index];

				if (!account || account.owner !== programId) return false;

				try {
					return isSwitchboardOracleUsable(
						parseSwitchboardOracle(account.data),
						{ address: queue, nodeTimeout: queueState.nodeTimeout },
						nowUnix,
					);
				} catch {
					// A malformed queue member is skipped, not fatal: the
					// commit only needs one healthy oracle.
					return false;
				}
			});
			const oracle = usable[Math.floor(random() * usable.length)];

			if (!oracle) {
				throw new SwitchboardError(
					"noUsableOracle",
					`queue ${queue} has no verified oracle with a fresh heartbeat`,
					true,
				);
			}

			return switchboardOracleAccounts(
				programId,
				queue,
				oracle,
				binding.randomness,
				binding.recentSlot,
			);
		},

		async accountsFor(randomness) {
			const state = await committedRandomness(randomness);

			return switchboardOracleAccounts(
				programId,
				state.queue,
				state.oracle,
				randomness,
				state.lutSlot,
			);
		},

		async fetchProof(randomness, proofOptions = {}) {
			const retry = proofOptions.retry ?? DEFAULT_PROOF_RETRY;
			let delay = retry.initialDelayMs;
			let lastError: SwitchboardError | undefined;

			for (let attempt = 1; attempt <= retry.attempts; attempt++) {
				try {
					return await revealOnce(randomness, proofOptions.signal);
				} catch (error) {
					if (!(error instanceof SwitchboardError) || !error.retryable) {
						throw error;
					}

					lastError = error;
				}

				if (attempt < retry.attempts) {
					await sleep(delay, proofOptions.signal);
					delay = Math.min(delay * 2, retry.maxDelayMs);
				}
			}

			throw new SwitchboardError(
				"timeout",
				`no reveal proof for ${randomness} after ${retry.attempts} attempts: ${
					lastError?.message ?? "unknown failure"
				}`,
			);
		},
	};
}
