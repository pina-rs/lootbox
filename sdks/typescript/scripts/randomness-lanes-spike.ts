/**
 * Devnet spike for reusable Switchboard randomness "lanes".
 *
 * Today every opening creates, commits, reveals, and closes a fresh
 * Switchboard randomness account, and the account's lookup-table rent is never
 * recovered. A lane is a randomness account that is kept and recommitted for
 * every opening instead. This script drives Switchboard On-Demand directly,
 * with the payer as randomness authority, to answer what a lane design needs:
 *
 * - `reuse`: does one account survive repeated commit → reveal cycles, and
 *   what does its state look like after each step?
 * - `pending`: does Switchboard accept a commit on an account whose previous
 *   commit is still unrevealed? If it does, the program must refuse it.
 * - `sameslot`: do lanes committed in the same slot reveal different values?
 * - `fused`: can round k's reveal and round k+1's commit share a transaction?
 * - `latency`: how long a lane is busy per cycle when many lanes run at once,
 *   which sizes the pool for plain lanes and for batched openings.
 *
 * Usage (from the repository root):
 *
 *   LOOTBOX_DEVNET_KEYPAIR=target/devnet/payer.json \
 *     pnpm --dir sdks/typescript spike:lanes -- --lanes 10 --cycles 5
 *
 * Options: `--experiments reuse,pending,sameslot,fused,latency` (default all),
 * `--lanes` for the latency pool (default 10), `--cycles` per lane (default 5),
 * `--keep` to leave the lanes open instead of closing them, and `--out` for the
 * JSON report path (default `target/spikes/randomness-lanes-<time>.json`).
 * LOOTBOX_DEVNET_RPC_URL overrides the public devnet RPC. The script refuses
 * to run against any cluster whose genesis hash is not devnet's.
 */
import { findAssociatedTokenPda } from "@solana-program/token-2022";
import {
	type AccountMeta,
	AccountRole,
	type AccountSignerMeta,
	type Address,
	address,
	appendTransactionMessageInstructions,
	createSolanaRpc,
	createTransactionMessage,
	generateKeyPairSigner,
	getAddressEncoder,
	getBase64EncodedWireTransaction,
	getU64Encoder,
	type Instruction,
	type KeyPairSigner,
	pipe,
	type ReadonlyUint8Array,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners,
} from "@solana/kit";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
	CLASSIC_TOKEN_PROGRAM,
	createSwitchboardOracle,
	parseSwitchboardOracle,
	parseSwitchboardRandomness,
	parseSwitchboardRevealResponse,
	SWITCHBOARD_PROGRAM,
	SWITCHBOARD_QUEUE,
	switchboardGatewayUrl,
	switchboardOracleAccounts,
	type SwitchboardRandomness,
} from "../src/index.js";
import {
	installPatientFetch,
	loadKeypair,
	parseArgs,
	verifiedRpcUrl,
} from "./cli.js";

const EXPERIMENTS = [
	"reuse",
	"pending",
	"sameslot",
	"fused",
	"latency",
] as const;
type Experiment = (typeof EXPERIMENTS)[number];

const PROGRAM = SWITCHBOARD_PROGRAM.devnet;
const QUEUE = SWITCHBOARD_QUEUE.devnet;
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const ASSOCIATED_TOKEN_PROGRAM = address(
	"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const WRAPPED_SOL_MINT = address(
	"So11111111111111111111111111111111111111112",
);
const LOOKUP_TABLE_PROGRAM = address(
	"AddressLookupTab1e1111111111111111111111111",
);
const SLOT_HASHES = address("SysvarS1otHashes111111111111111111111111111");
const DEFAULT_ADDRESS = address("11111111111111111111111111111111");

/** Anchor discriminators, little-endian as in `switchboard_randomness_cpi`. */
const DISCRIMINATOR = {
	init: 0x0f71_7432_21cc_0909n,
	commit: 0x8df2_85b3_c998_aa34n,
	reveal: 0x4914_3a1e_0abb_b5c5n,
	close: 0x9c00_f6e1_4a0e_6592n,
} as const;

const args = parseArgs(process.argv.slice(2));
const keypairPath = process.env.LOOTBOX_DEVNET_KEYPAIR;

if (!keypairPath) {
	throw new Error("set LOOTBOX_DEVNET_KEYPAIR to a devnet-only keypair file");
}

const experiments = parseExperiments(args.optional("experiments") ?? "all");
const latencyLanes = positiveInteger("lanes", 10);
const cyclesPerLane = positiveInteger("cycles", 5);
const keepLanes = args.flag("keep");
const outPath = resolve(
	process.cwd(),
	args.optional("out") ??
		`../../target/spikes/randomness-lanes-${
			new Date().toISOString().replaceAll(":", "-")
		}.json`,
);

installPatientFetch();

const rpcUrl = await verifiedRpcUrl(
	"devnet",
	process.env.LOOTBOX_DEVNET_RPC_URL,
);
const rpc = createSolanaRpc(rpcUrl);
const payer = await loadKeypair(keypairPath);
const oracle = createSwitchboardOracle({ rpcUrl, cluster: "devnet" });

function parseExperiments(value: string): readonly Experiment[] {
	if (value === "all") return EXPERIMENTS;

	return value.split(",").map((name) => {
		const experiment = EXPERIMENTS.find((known) => known === name);

		if (!experiment) throw new Error(`unknown experiment ${name}`);

		return experiment;
	});
}

function positiveInteger(name: string, fallback: number) {
	const raw = args.optional(name);
	const value = raw === undefined ? fallback : Number(raw);

	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`--${name} must be a positive integer`);
	}

	return value;
}

function hex(bytes: ReadonlyUint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/** An instruction whose signer accounts carry their `TransactionSigner`. */
type LaneInstruction = Instruction<
	string,
	readonly (AccountMeta | AccountSignerMeta)[]
>;

function sleep(ms: number) {
	return new Promise((done) => setTimeout(done, ms));
}

function discriminator(value: bigint, extra = 0) {
	const data = new Uint8Array(8 + extra);

	new DataView(data.buffer).setBigUint64(0, value, true);

	return data;
}

/** One reusable randomness account plus the accounts every CPI needs. */
type Lane = Readonly<{
	signer: KeyPairSigner;
	address: Address;
	rewardEscrow: Address;
	lutSlot: bigint;
	lutSigner: Address;
	lut: Address;
	programState: Address;
}>;

type Confirmed = Readonly<{
	signature: string;
	slot: bigint;
	/** Slots between the RPC's processed tip at send time and the landing
	 * slot. Unlike `ms`, it excludes RPC confirmation-polling lag.
	 */
	inclusionSlots: number;
	ms: number;
}>;

/** Send one transaction and wait for `confirmed`, returning its slot. */
async function send(
	instructions: readonly LaneInstruction[],
): Promise<Confirmed> {
	const started = performance.now();
	const { value: blockhash } = await rpc.getLatestBlockhash({
		commitment: "confirmed",
	}).send();
	const message = pipe(
		createTransactionMessage({ version: 0 }),
		(draft) => setTransactionMessageFeePayerSigner(payer, draft),
		(draft) => setTransactionMessageLifetimeUsingBlockhash(blockhash, draft),
		(draft) => appendTransactionMessageInstructions(instructions, draft),
	);
	const transaction = await signTransactionMessageWithSigners(message);
	const sentSlot = await rpc.getSlot({ commitment: "processed" }).send();
	const signature = await rpc.sendTransaction(
		getBase64EncodedWireTransaction(transaction),
		{ encoding: "base64", preflightCommitment: "confirmed" },
	).send();

	for (let attempt = 0; attempt < 240; attempt++) {
		const { value } = await rpc.getSignatureStatuses([signature]).send();
		const status = value[0];

		if (status?.err) {
			throw new Error(`${signature} failed: ${JSON.stringify(status.err)}`);
		}

		if (
			status?.confirmationStatus === "confirmed" ||
			status?.confirmationStatus === "finalized"
		) {
			return {
				signature,
				slot: status.slot,
				inclusionSlots: Number(status.slot - sentSlot),
				ms: performance.now() - started,
			};
		}

		await sleep(250);
	}

	throw new Error(`${signature} did not confirm within 60 seconds`);
}

/** Run `operation` and capture a failure instead of throwing, so a rejected
 * probe (for example a commit on a pending lane) is recorded as a result.
 */
async function attempt<T>(
	operation: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
	try {
		return { ok: true, value: await operation() };
	} catch (error) {
		return { ok: false, error: describe(error) };
	}
}

/** An error message plus the program log lines that explain a failed
 * preflight; kit keeps those logs in `context.logs`, not in `message`.
 */
function describe(error: unknown): string {
	if (!(error instanceof Error)) return String(error);

	const context: unknown = "context" in error ? error.context : undefined;
	const logs = typeof context === "object" && context !== null &&
			"logs" in context && Array.isArray(context.logs)
		? context.logs.filter((line): line is string =>
			typeof line === "string" && line.startsWith("Program log: ") &&
			!line.includes("Instruction:")
		)
		: [];

	return [error.message, ...logs.slice(-3)].join(" | ");
}

async function readLane(lane: Lane): Promise<SwitchboardRandomness> {
	const { value } = await rpc.getAccountInfo(lane.address, {
		encoding: "base64",
		commitment: "confirmed",
	}).send();

	if (!value) throw new Error(`lane ${lane.address} does not exist`);

	return parseSwitchboardRandomness(
		new Uint8Array(Buffer.from(value.data[0], "base64")),
	);
}

function laneState(state: SwitchboardRandomness) {
	return {
		seedSlot: state.seedSlot.toString(),
		revealSlot: state.revealSlot.toString(),
		oracle: state.oracle,
		oracleCleared: state.oracle === DEFAULT_ADDRESS,
		value: hex(state.value),
	};
}

/** Create a lane, retrying when the lookup-table slot is not yet in the
 * simulating node's slot hashes. The public devnet RPC is load balanced, so
 * the node that answered `getSlot` can be ahead of the node that preflights.
 */
async function createLane(): Promise<Lane> {
	for (let tries = 1;; tries++) {
		const result = await attempt(createLaneOnce);

		if (result.ok) return result.value;

		if (tries === 5 || !result.error.includes("is not a recent slot")) {
			throw new Error(result.error);
		}

		await sleep(1_000);
	}
}

async function createLaneOnce(): Promise<Lane> {
	const signer = await generateKeyPairSigner();
	const lutSlot = await rpc.getSlot({ commitment: "finalized" }).send();
	const accounts = await switchboardOracleAccounts(
		PROGRAM,
		QUEUE,
		DEFAULT_ADDRESS,
		signer.address,
		lutSlot,
	);
	const [rewardEscrow] = await findAssociatedTokenPda({
		owner: signer.address,
		mint: WRAPPED_SOL_MINT,
		tokenProgram: CLASSIC_TOKEN_PROGRAM,
	});
	const data = discriminator(DISCRIMINATOR.init, 8);

	data.set(getU64Encoder().encode(lutSlot), 8);
	await send([{
		programAddress: PROGRAM,
		accounts: [
			{ address: signer.address, role: AccountRole.WRITABLE_SIGNER, signer },
			{ address: rewardEscrow, role: AccountRole.WRITABLE },
			{
				address: payer.address,
				role: AccountRole.READONLY_SIGNER,
				signer: payer,
			},
			{ address: QUEUE, role: AccountRole.WRITABLE },
			{
				address: payer.address,
				role: AccountRole.WRITABLE_SIGNER,
				signer: payer,
			},
			{ address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
			{ address: CLASSIC_TOKEN_PROGRAM, role: AccountRole.READONLY },
			{ address: ASSOCIATED_TOKEN_PROGRAM, role: AccountRole.READONLY },
			{ address: WRAPPED_SOL_MINT, role: AccountRole.READONLY },
			{ address: accounts.programState, role: AccountRole.READONLY },
			{ address: accounts.lutSigner, role: AccountRole.READONLY },
			{ address: accounts.lut, role: AccountRole.WRITABLE },
			{ address: LOOKUP_TABLE_PROGRAM, role: AccountRole.READONLY },
		],
		data,
	}]);

	return {
		signer,
		address: signer.address,
		rewardEscrow,
		lutSlot,
		lutSigner: accounts.lutSigner,
		lut: accounts.lut,
		programState: accounts.programState,
	};
}

/** Pick a live oracle from the queue for the next commit. */
async function pickOracle(lane: Lane) {
	const selected = await oracle.selectAccounts({
		randomness: lane.address,
		recentSlot: lane.lutSlot,
	});

	return selected.oracle;
}

function commitInstruction(lane: Lane, boundOracle: Address): LaneInstruction {
	return {
		programAddress: PROGRAM,
		accounts: [
			{ address: lane.address, role: AccountRole.WRITABLE },
			{ address: QUEUE, role: AccountRole.READONLY },
			{ address: boundOracle, role: AccountRole.WRITABLE },
			{ address: SLOT_HASHES, role: AccountRole.READONLY },
			{
				address: payer.address,
				role: AccountRole.READONLY_SIGNER,
				signer: payer,
			},
		],
		data: discriminator(DISCRIMINATOR.commit),
	};
}

type Proof = ReturnType<typeof parseSwitchboardRevealResponse>;

async function revealInstruction(
	lane: Lane,
	boundOracle: Address,
	proof: Proof,
): Promise<LaneInstruction> {
	const { stats } = await switchboardOracleAccounts(
		PROGRAM,
		QUEUE,
		boundOracle,
		lane.address,
		lane.lutSlot,
	);
	const data = discriminator(DISCRIMINATOR.reveal, 97);

	data.set(proof.signature, 8);
	data[72] = proof.recoveryId;
	data.set(proof.value, 73);

	return {
		programAddress: PROGRAM,
		accounts: [
			{ address: lane.address, role: AccountRole.WRITABLE },
			{ address: boundOracle, role: AccountRole.READONLY },
			{ address: QUEUE, role: AccountRole.READONLY },
			{ address: stats, role: AccountRole.WRITABLE },
			{
				address: payer.address,
				role: AccountRole.READONLY_SIGNER,
				signer: payer,
			},
			{
				address: payer.address,
				role: AccountRole.WRITABLE_SIGNER,
				signer: payer,
			},
			{ address: SLOT_HASHES, role: AccountRole.READONLY },
			{ address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
			{ address: lane.rewardEscrow, role: AccountRole.WRITABLE },
			{ address: CLASSIC_TOKEN_PROGRAM, role: AccountRole.READONLY },
			{ address: WRAPPED_SOL_MINT, role: AccountRole.READONLY },
			{ address: lane.programState, role: AccountRole.READONLY },
		],
		data,
	};
}

function closeInstruction(lane: Lane): LaneInstruction {
	return {
		programAddress: PROGRAM,
		accounts: [
			{ address: lane.address, role: AccountRole.WRITABLE },
			{ address: lane.rewardEscrow, role: AccountRole.WRITABLE },
			{
				address: payer.address,
				role: AccountRole.WRITABLE_SIGNER,
				signer: payer,
			},
			{ address: lane.programState, role: AccountRole.READONLY },
			{ address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
			{ address: CLASSIC_TOKEN_PROGRAM, role: AccountRole.READONLY },
			{ address: WRAPPED_SOL_MINT, role: AccountRole.READONLY },
			{ address: lane.lut, role: AccountRole.WRITABLE },
			{ address: lane.lutSigner, role: AccountRole.READONLY },
			{ address: LOOKUP_TABLE_PROGRAM, role: AccountRole.READONLY },
		],
		data: discriminator(DISCRIMINATOR.close),
	};
}

type ProofTiming = Readonly<{ proof: Proof; ms: number; attempts: number }>;

/** Ask the bound oracle's gateway for the reveal proof of the lane's current
 * commit, polling until the gateway can serve it. Reads the commitment from
 * the lane itself so a stale reveal slot cannot short-circuit the request.
 */
async function fetchProof(
	lane: Lane,
	commit: SwitchboardRandomness,
): Promise<ProofTiming> {
	const { value } = await rpc.getAccountInfo(commit.oracle, {
		encoding: "base64",
		commitment: "confirmed",
	}).send();

	if (!value) throw new Error(`oracle ${commit.oracle} does not exist`);

	const gateway = switchboardGatewayUrl(
		parseSwitchboardOracle(new Uint8Array(Buffer.from(value.data[0], "base64")))
			.gatewayUri,
	);

	if (!gateway) throw new Error(`oracle ${commit.oracle} has no gateway`);

	const endpoint = new URL(
		`${gateway.pathname.replace(/\/$/, "")}/gateway/api/v1/randomness_reveal`,
		gateway,
	);
	const body = JSON.stringify({
		slothash: Array.from(commit.seedSlothash),
		randomness_key: hex(
			new Uint8Array(getAddressEncoder().encode(lane.address)),
		),
		slot: Number(commit.seedSlot),
	});
	const started = performance.now();
	let lastError = "";

	for (let attempts = 1; attempts <= 60; attempts++) {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		}).catch((error: unknown) => error);

		if (response instanceof Response) {
			const text = await response.text();

			if (response.ok) {
				return {
					proof: parseSwitchboardRevealResponse(text),
					ms: performance.now() - started,
					attempts,
				};
			}

			lastError = `HTTP ${response.status}: ${text.slice(0, 160)}`;
		} else {
			lastError = response instanceof Error ? response.message : "unreachable";
		}

		await sleep(250);
	}

	throw new Error(
		`no proof from ${gateway.host} after 60 attempts: ${lastError}`,
	);
}

type Cycle = Readonly<{
	lane: Address;
	round: number;
	oracle: Address;
	commitSlot: string;
	seedSlot: string;
	revealSlot: string;
	slotsCommitToReveal: number;
	commitInclusionSlots: number;
	commitConfirmMs: number;
	proofMs: number;
	proofAttempts: number;
	revealInclusionSlots: number;
	revealConfirmMs: number;
	cycleMs: number;
	stateAfterCommit: ReturnType<typeof laneState>;
	stateAfterReveal: ReturnType<typeof laneState>;
}>;

/** One full commit → proof → reveal cycle on a lane. */
async function cycle(lane: Lane, round: number): Promise<Cycle> {
	const started = performance.now();
	const boundOracle = await pickOracle(lane);
	const commit = await send([commitInstruction(lane, boundOracle)]);
	const committed = await readLane(lane);
	const timing = await fetchProof(lane, committed);
	const reveal = await send([
		await revealInstruction(lane, committed.oracle, timing.proof),
	]);
	const revealed = await readLane(lane);

	if (hex(revealed.value) !== hex(timing.proof.value)) {
		throw new Error(`lane ${lane.address} stored a value other than the proof`);
	}

	return {
		lane: lane.address,
		round,
		oracle: committed.oracle,
		commitSlot: commit.slot.toString(),
		seedSlot: committed.seedSlot.toString(),
		revealSlot: revealed.revealSlot.toString(),
		slotsCommitToReveal: Number(revealed.revealSlot - committed.seedSlot),
		commitInclusionSlots: commit.inclusionSlots,
		commitConfirmMs: Math.round(commit.ms),
		proofMs: Math.round(timing.ms),
		proofAttempts: timing.attempts,
		revealInclusionSlots: reveal.inclusionSlots,
		revealConfirmMs: Math.round(reveal.ms),
		cycleMs: Math.round(performance.now() - started),
		stateAfterCommit: laneState(committed),
		stateAfterReveal: laneState(revealed),
	};
}

async function balance() {
	const { value } = await rpc.getBalance(payer.address, {
		commitment: "confirmed",
	}).send();

	return value;
}

function percentiles(values: readonly number[]) {
	const sorted = [...values].sort((left, right) => left - right);
	const at = (fraction: number) =>
		sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ??
			0;

	return {
		count: sorted.length,
		min: sorted[0] ?? 0,
		p50: at(0.5),
		p90: at(0.9),
		max: sorted[sorted.length - 1] ?? 0,
	};
}

const lanes: Lane[] = [];
const report: Record<string, unknown> = {
	startedAt: new Date().toISOString(),
	rpc: new URL(rpcUrl).host,
	payer: payer.address,
	program: PROGRAM,
	queue: QUEUE,
};

async function newLane() {
	const before = await balance();
	const lane = await createLane();

	lanes.push(lane);

	return { lane, costLamports: Number(before - (await balance())) };
}

try {
	if (experiments.includes("reuse")) {
		console.log("reuse: one lane through repeated cycles");
		const { lane, costLamports } = await newLane();
		const cycles: Cycle[] = [];
		const before = await balance();

		for (let round = 0; round < cyclesPerLane; round++) {
			cycles.push(await cycle(lane, round));
			console.log(
				`  round ${round}: seed ${cycles[round]?.seedSlot} → reveal ${
					cycles[round]?.revealSlot
				} in ${cycles[round]?.cycleMs} ms`,
			);
		}

		const values = new Set(cycles.map((entry) => entry.stateAfterReveal.value));

		report.reuse = {
			laneCreationLamports: costLamports,
			lamportsPerCycle: Number(before - (await balance())) / cycles.length,
			distinctValues: values.size,
			cycles,
		};
	}

	if (experiments.includes("pending")) {
		console.log("pending: recommit while the previous commit is unrevealed");
		const { lane } = await newLane();
		const first = await send([commitInstruction(lane, await pickOracle(lane))]);
		const afterFirst = await readLane(lane);

		// Wait a few slots so a second commit would record a new seed slot.
		await sleep(2_000);

		const second = await attempt(async () =>
			send([commitInstruction(lane, await pickOracle(lane))])
		);
		const afterSecond = await readLane(lane);

		report.pending = {
			firstCommitSlot: first.slot.toString(),
			secondCommitAccepted: second.ok,
			secondCommitError: second.ok ? undefined : second.error,
			seedSlotChanged: afterFirst.seedSlot !== afterSecond.seedSlot,
			stateAfterFirst: laneState(afterFirst),
			stateAfterSecond: laneState(afterSecond),
		};

		// Leave the lane revealed so it closes cleanly.
		const timing = await fetchProof(lane, afterSecond);
		await send([
			await revealInstruction(lane, afterSecond.oracle, timing.proof),
		]);
	}

	if (experiments.includes("sameslot")) {
		console.log("sameslot: commit several lanes in one transaction");
		const group: Lane[] = [];

		for (let index = 0; index < 3; index++) {
			group.push((await newLane()).lane);
		}

		const commits = await Promise.all(
			group.map(async (lane) =>
				commitInstruction(lane, await pickOracle(lane))
			),
		);
		const commit = await send(commits);
		const states = await Promise.all(group.map(readLane));
		const reveals = await Promise.all(
			group.map(async (lane, index) => {
				const state = states[index];

				if (!state) throw new Error("missing committed state");

				const timing = await fetchProof(lane, state);

				await send([await revealInstruction(lane, state.oracle, timing.proof)]);

				return hex(timing.proof.value);
			}),
		);

		report.sameslot = {
			commitSlot: commit.slot.toString(),
			seedSlots: states.map((state) => state.seedSlot.toString()),
			sameSeedSlot: new Set(states.map((state) => state.seedSlot)).size === 1,
			sameSlothash: new Set(states.map((state) => hex(state.seedSlothash)))
				.size === 1,
			values: reveals,
			allDistinct: new Set(reveals).size === reveals.length,
		};
	}

	if (experiments.includes("fused")) {
		console.log("fused: reveal round k and commit round k+1 together");
		const { lane } = await newLane();

		await send([commitInstruction(lane, await pickOracle(lane))]);
		const committed = await readLane(lane);
		const timing = await fetchProof(lane, committed);
		const fused = await attempt(async () =>
			send([
				await revealInstruction(lane, committed.oracle, timing.proof),
				commitInstruction(lane, await pickOracle(lane)),
			])
		);
		const after = await readLane(lane);

		report.fused = {
			accepted: fused.ok,
			error: fused.ok ? undefined : fused.error,
			stateAfter: laneState(after),
		};

		if (after.revealSlot === 0n && after.seedSlot !== 0n) {
			const next = await fetchProof(lane, after);

			await send([await revealInstruction(lane, after.oracle, next.proof)]);
		}
	}

	if (experiments.includes("latency")) {
		console.log(
			`latency: ${latencyLanes} lanes × ${cyclesPerLane} concurrent cycles`,
		);
		const pool = await Promise.all(
			Array.from({ length: latencyLanes }, async () => (await newLane()).lane),
		);
		const started = performance.now();
		const failures: string[] = [];
		const cycles = (await Promise.all(pool.map(async (lane) => {
			const completed: Cycle[] = [];

			for (let round = 0; round < cyclesPerLane; round++) {
				const result = await attempt(() => cycle(lane, round));

				if (result.ok) completed.push(result.value);
				else failures.push(`${lane.address} round ${round}: ${result.error}`);
			}

			return completed;
		}))).flat();
		const wallMs = performance.now() - started;
		const oracles = new Map<string, number>();

		for (const entry of cycles) {
			oracles.set(entry.oracle, (oracles.get(entry.oracle) ?? 0) + 1);
		}

		report.latency = {
			lanes: latencyLanes,
			cyclesPerLane,
			completed: cycles.length,
			failures,
			wallMs: Math.round(wallMs),
			revealsPerSecond: cycles.length / (wallMs / 1_000),
			cycleMs: percentiles(cycles.map((entry) => entry.cycleMs)),
			proofMs: percentiles(cycles.map((entry) => entry.proofMs)),
			commitConfirmMs: percentiles(
				cycles.map((entry) => entry.commitConfirmMs),
			),
			revealConfirmMs: percentiles(
				cycles.map((entry) => entry.revealConfirmMs),
			),
			commitInclusionSlots: percentiles(
				cycles.map((entry) => entry.commitInclusionSlots),
			),
			revealInclusionSlots: percentiles(
				cycles.map((entry) => entry.revealInclusionSlots),
			),
			slotsCommitToReveal: percentiles(
				cycles.map((entry) => entry.slotsCommitToReveal),
			),
			oracleUse: Object.fromEntries(oracles),
			cycles,
		};
	}
} finally {
	if (!keepLanes && lanes.length > 0) {
		console.log(`closing ${lanes.length} lanes`);
		const before = await balance();
		const closed = await Promise.all(lanes.map(async (lane) => {
			const state = await attempt(() => readLane(lane));

			// A lane with an unrevealed commit cannot close; leave it for manual
			// cleanup rather than hiding the failure.
			if (
				state.ok && state.value.revealSlot === 0n && state.value.seedSlot !== 0n
			) {
				return { lane: lane.address, closed: false, error: "commit pending" };
			}

			const result = await attempt(() => send([closeInstruction(lane)]));

			return result.ok
				? { lane: lane.address, closed: true }
				: { lane: lane.address, closed: false, error: result.error };
		}));

		report.close = {
			refundedLamports: Number((await balance()) - before),
			lanes: closed,
		};
	}

	report.finishedAt = new Date().toISOString();
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(
		outPath,
		`${
			JSON.stringify(
				report,
				(_key, value: unknown) =>
					typeof value === "bigint" ? value.toString() : value,
				"\t",
			)
		}\n`,
	);
	console.log(`report written to ${outPath}`);
}
