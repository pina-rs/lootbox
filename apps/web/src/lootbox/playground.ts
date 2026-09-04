import {
	type ChainTemplate,
	type ClientProgress,
	createTemplatePlan,
	encodeTemplateText,
	getTemplateOpeningStateDecoder,
	LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
	LootboxClient,
	type OracleAccounts,
	type PrizeAsset,
} from "@pina-rs/lootbox";
import {
	address,
	createKeyPairSignerFromPrivateKeyBytes,
	getBase64Encoder,
	type TransactionSigner,
} from "@solana/kit";

const CONTROL = "http://127.0.0.1:8898";
const ORACLE = "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
export type PrizeRow = {
	kind: "sol" | "token" | "nft";
	amount: string;
	quantity: string;
	weight: string;
	nftCount: string;
};
export type CreatorInput = {
	name: string;
	uri: string;
	opensAt: string;
	rows: PrizeRow[];
};
type Draft = {
	id: string;
	mint: number[];
	rewards: number[][][];
	input: CreatorInput;
};
type Config = { instanceId: string; rpcUrl: string; oracle: OracleAccounts };
export type Playground = {
	config: Config;
	creator: TransactionSigner;
	recipient: TransactionSigner;
	client: (
		role: "creator" | "recipient",
		progress?: ClientProgress,
	) => LootboxClient;
	faucet: (role: "creator" | "recipient") => Promise<void>;
};

function record(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error("Invalid sandbox response");
	}
	return value as Record<string, unknown>;
}
function string(value: unknown): string {
	if (typeof value !== "string") {
		throw new Error("Missing sandbox configuration");
	}
	return value;
}
export function assertLoopback(url: string) {
	const parsed = new URL(url);
	if (
		parsed.protocol !== "http:" ||
		!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.username ||
		parsed.password
	) {
		throw new Error(
			"Test wallets are restricted to a local Surfpool sandbox. Never import a real wallet here.",
		);
	}
}
async function control(
	path: string,
	input?: object,
): Promise<Record<string, unknown>> {
	const response = await fetch(`${CONTROL}${path}`, {
		...(input
			? {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			}
			: {}),
		signal: AbortSignal.timeout(10_000),
	});
	const result = record(await response.json());
	if (!response.ok) {
		throw new Error(
			typeof result.error === "string"
				? result.error
				: "Sandbox request failed",
		);
	}
	return result;
}
function seed(): number[] {
	return Array.from(crypto.getRandomValues(new Uint8Array(32)));
}
function signer(bytes: unknown) {
	if (
		!Array.isArray(bytes) || bytes.length !== 32 ||
		!bytes.every((byte: unknown) =>
			typeof byte === "number" && Number.isInteger(byte) && byte >= 0 &&
			byte <= 255
		)
	) {
		throw new Error(
			"Invalid saved test wallet. Clear this site's sandbox data to restart.",
		);
	}
	return createKeyPairSignerFromPrivateKeyBytes(Uint8Array.from(bytes));
}
async function wallet(instance: string, role: string) {
	const key = `lootbox:test-wallet:${instance}:${role}`;
	const stored = localStorage.getItem(key);
	const bytes: unknown = stored ? JSON.parse(stored) : seed();
	if (!stored) localStorage.setItem(key, JSON.stringify(bytes));
	return signer(bytes);
}
let connection: Promise<Playground> | undefined;
export function connectPlayground(): Promise<Playground> {
	if (connection) return connection;
	connection = (async () => {
		assertLoopback(location.origin);
		const raw = await control("/config");
		if (
			raw.testOnly !== true || raw.network !== "surfpool" ||
			raw.programId !== LOOTBOX_PROGRAM_PROGRAM_ADDRESS ||
			raw.oracleProgram !== ORACLE
		) {
			throw new Error(
				"Unexpected network. Refusing to sign test transactions.",
			);
		}
		const rpcUrl = string(raw.rpcUrl);
		assertLoopback(rpcUrl);
		const oracle = record(raw.oracle);
		const config: Config = {
			instanceId: string(raw.instanceId),
			rpcUrl,
			oracle: {
				queue: address(string(oracle.queue)),
				oracle: address(string(oracle.oracle)),
				rewardEscrow: address(string(oracle.rewardEscrow)),
				programState: address(string(oracle.programState)),
				lutSigner: address(string(oracle.lutSigner)),
				lut: address(string(oracle.lut)),
				stats: address(string(oracle.stats)),
			},
		};
		const creator = await wallet(config.instanceId, "creator");
		const recipient = await wallet(config.instanceId, "recipient");
		const result: Playground = {
			config,
			creator,
			recipient,
			client: (role, progress) =>
				new LootboxClient(
					rpcUrl,
					role === "creator" ? creator : recipient,
					progress,
				),
			faucet: async (role) => {
				await control("/faucet", {
					address: role === "creator" ? creator.address : recipient.address,
				});
			},
		};
		for (const role of ["creator", "recipient"] as const) {
			const key = `lootbox:faucet:${config.instanceId}:${role}`;
			if (!localStorage.getItem(key)) {
				await result.faucet(role);
				localStorage.setItem(key, "funded");
			}
		}
		return result;
	})();
	connection.catch(() => {
		connection = undefined;
	});
	return connection;
}

export function parseUnits(input: string, decimals: number): bigint {
	if (
		!Number.isInteger(decimals) || decimals < 0 || decimals > 9 ||
		!/^\d+(\.\d+)?$/.test(input)
	) throw new Error("Enter a positive decimal amount");
	const [whole = "", fraction = ""] = input.split(".");
	if (fraction.length > decimals) {
		throw new Error(`Use at most ${decimals} decimal places`);
	}
	const amount = BigInt(whole) * 10n ** BigInt(decimals) +
		BigInt(fraction.padEnd(decimals, "0") || "0");
	if (amount > (1n << 64n) - 1n) {
		throw new Error("Amount exceeds the token limit");
	}
	return amount;
}
export function formatUnits(amount: bigint, decimals = 9): string {
	const scale = 10n ** BigInt(decimals);
	const fractional = (amount % scale).toString().padStart(decimals, "0")
		.replace(/0+$/, "");
	return `${amount / scale}${fractional ? `.${fractional}` : ""}`;
}
export const initialInput: CreatorInput = {
	name: "Midnight cargo",
	uri: "",
	opensAt: "",
	rows: [
		{ kind: "sol", amount: "0.1", quantity: "8", weight: "1", nftCount: "1" },
		{ kind: "token", amount: "100", quantity: "4", weight: "1", nftCount: "1" },
		{ kind: "nft", amount: "1", quantity: "1", weight: "1", nftCount: "2" },
	],
};
export function creatorErrors(input: CreatorInput): Record<string, string> {
	const errors: Record<string, string> = {};
	const check = (field: string, action: () => void) => {
		try {
			action();
		} catch (error) {
			errors[field] = error instanceof Error
				? error.message
				: "Check this value";
		}
	};
	check("name", () => {
		encodeTemplateText(input.name, 32);
		if (!input.name.trim()) {
			throw new Error("Enter a template name (1–32 UTF-8 bytes)");
		}
	});
	check("uri", () => {
		encodeTemplateText(input.uri, 200);
		if (
			input.uri &&
			!["http:", "https:", "ipfs:", "ar:"].includes(new URL(input.uri).protocol)
		) throw new Error("Use an http, https, ipfs, or ar metadata URI");
	});
	if (input.opensAt && !Number.isFinite(Date.parse(input.opensAt))) {
		errors.opensAt = "Choose a valid local date and time";
	}
	if (input.rows.length < 1 || input.rows.length > 8) {
		errors.bundles = "Use one to eight bundles";
	}
	let totalSol = 0n;
	for (const [index, row] of input.rows.entries()) {
		const key = `row-${index}`;
		if (!["sol", "token", "nft"].includes(row.kind)) {
			errors[`${key}-kind`] = "Choose a supported prize type";
		}
		check(`${key}-amount`, () => {
			const amount = parseUnits(row.amount, row.kind === "token" ? 0 : 9);
			if (row.kind !== "nft" && amount === 0n) {
				throw new Error("Enter a prize amount greater than zero");
			}
			if (/^\d+$/.test(row.quantity)) {
				const collateral = amount * BigInt(row.quantity);
				if (collateral > (1n << 64n) - 1n) {
					throw new Error("Amount × copies exceeds the token limit");
				}
				if (row.kind !== "token") totalSol += collateral;
			}
		});
		for (
			const [field, label] of [["quantity", "Copies"], [
				"weight",
				"Weight",
			]] as const
		) {
			check(`${key}-${field}`, () => {
				const value = parseUnits(row[field], 0);
				if (value < 1n || value > 1000n) {
					throw new Error(`${label} must be a whole number from 1 to 1,000`);
				}
				if (
					field === "quantity" && row.kind === "nft" && value !== 1n
				) throw new Error("A unique NFT bundle has one copy");
			});
		}
		if (row.kind === "nft" && !["1", "2", "3"].includes(row.nftCount)) {
			errors[`${key}-nftCount`] = "Choose one to three unique NFTs";
		}
	}
	if (totalSol > (1n << 64n) - 1n) {
		errors.bundles =
			"Combined SOL deposits exceed the token limit; reduce the prize amounts";
	}
	return errors;
}
export function validateInput(input: CreatorInput) {
	const error = Object.values(creatorErrors(input))[0];
	if (error) throw new Error(error);
}
export function previewInput(input: CreatorInput) {
	try {
		validateInput(input);
		let sol = 0n;
		let tokens = 0n;
		let nfts = 0;
		let copies = 0n;
		const weights = input.rows.map((row) => {
			const quantity = parseUnits(row.quantity, 0);
			copies += quantity;
			if (row.kind === "token") tokens += parseUnits(row.amount, 0) * quantity;
			else sol += parseUnits(row.amount, 9) * quantity;
			if (row.kind === "nft") nfts += Number(row.nftCount);
			return quantity * parseUnits(row.weight, 0);
		});
		if (sol > (1n << 64n) - 1n) {
			throw new Error("Total SOL inventory exceeds u64");
		}
		const total = weights.reduce((sum, weight) => sum + weight, 0n);
		return {
			sol,
			tokens,
			nfts,
			copies,
			odds: weights.map((weight) =>
				`${(Number(weight * 1_000_000n / total) / 10_000).toFixed(2)}%`
			),
		};
	} catch {
		return null;
	}
}
const draftKey = (sandbox: Playground) =>
	`lootbox:draft:${sandbox.config.instanceId}`;
export function savedInput(sandbox: Playground): CreatorInput | null {
	const raw = localStorage.getItem(draftKey(sandbox));
	if (!raw) return null;
	const draft: Draft = JSON.parse(raw);
	validateInput(draft.input);
	return draft.input;
}

/** Saved test seeds make every multi-transaction creation step resumable.
 * These are disposable sandbox wallets, not a production custody mechanism.
 */
export async function createDrop(
	sandbox: Playground,
	input: CreatorInput,
	progress: ClientProgress,
): Promise<ChainTemplate> {
	validateInput(input);
	const stored = localStorage.getItem(draftKey(sandbox));
	const draft: Draft = stored ? JSON.parse(stored) : {
		id: new DataView(crypto.getRandomValues(new Uint8Array(8)).buffer)
			.getBigUint64(0, true).toString(),
		mint: seed(),
		input,
		rewards: input.rows.map((row) =>
			Array.from({
				length: row.kind === "nft"
					? Number(row.nftCount)
					: row.kind === "token"
					? 1
					: 0,
			}, seed)
		),
	};
	if (stored && JSON.stringify(input) !== JSON.stringify(draft.input)) {
		throw new Error("Resume your saved draft before editing the prize table");
	}
	const client = sandbox.client("creator", progress);
	const rewards = await Promise.all(
		draft.rewards.map((row) => Promise.all(row.map(signer))),
	);
	const bundles = input.rows.map((row, index) => {
		const assets: PrizeAsset[] = [];
		const amount = parseUnits(row.amount, row.kind === "token" ? 0 : 9);
		if (row.kind !== "token" && amount > 0n) {
			assets.push({ kind: "sol", lamports: amount });
		}
		for (const mint of rewards[index] ?? []) {
			assets.push(
				row.kind === "nft"
					? { kind: "nft", mint: mint.address }
					: { kind: "token", mint: mint.address, amount },
			);
		}
		return {
			label: `Bundle ${index + 1}`,
			quantity: parseUnits(row.quantity, 0),
			weight: parseUnits(row.weight, 0),
			assets,
		};
	});
	const plan = createTemplatePlan({
		name: input.name,
		uri: input.uri,
		opensAt: input.opensAt
			? BigInt(Math.floor(Date.parse(input.opensAt) / 1000))
			: 0n,
		bundles,
	});
	localStorage.setItem(draftKey(sandbox), JSON.stringify(draft));
	for (const [index, row] of rewards.entries()) {
		for (const reward of row) {
			const config = input.rows[index];
			if (!config) throw new Error("Missing saved reward configuration");
			await client.createFixedSupplyMint(
				reward,
				config.kind === "nft"
					? 1n
					: parseUnits(config.amount, 0) * parseUnits(config.quantity, 0),
			);
		}
	}
	const template = await client.createTemplate(
		plan,
		BigInt(draft.id),
		await signer(draft.mint),
		address(ORACLE),
		sandbox.config.oracle.queue,
	);
	localStorage.removeItem(draftKey(sandbox));
	return template;
}

export async function settleOpenings(
	sandbox: Playground,
	template: ChainTemplate,
	progress: ClientProgress,
) {
	const client = sandbox.client("recipient", progress);
	const { openings } = await client.inventory();
	const pending = openings.filter((opening) =>
		opening.data.template === template.address && opening.data.status < 2
	)
		.sort((a, b) => a.data.sequence < b.data.sequence ? -1 : 1);
	for (const opening of pending) {
		if (opening.data.status === 0) {
			const proof = await control(
				`/proof?randomness=${opening.data.randomness}`,
			);
			const bytes = (value: unknown, length: number) => {
				if (
					!Array.isArray(value) || value.length !== length ||
					!value.every((byte: unknown) =>
						typeof byte === "number" && Number.isInteger(byte) && byte >= 0 &&
						byte <= 255
					)
				) throw new Error("Invalid oracle proof");
				return Uint8Array.from(value);
			};
			if (proof.testOnly !== true || typeof proof.recoveryId !== "number") {
				throw new Error("Expected an emulator proof");
			}
			await client.fulfill(template, opening, sandbox.config.oracle, {
				signature: bytes(proof.signature, 64),
				recoveryId: proof.recoveryId,
				value: bytes(proof.value, 32),
			});
		}
		const current = await client.rpc.getAccountInfo(opening.address, {
			commitment: "processed",
			encoding: "base64",
		}).send();
		if (
			!current.value || current.value.owner !== LOOTBOX_PROGRAM_PROGRAM_ADDRESS
		) throw new Error("Opening account missing");
		await client.allocate(await client.template(template.address), {
			address: opening.address,
			data: getTemplateOpeningStateDecoder().decode(
				getBase64Encoder().encode(current.value.data[0]),
			),
		});
	}
}
