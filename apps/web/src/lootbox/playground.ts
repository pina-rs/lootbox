import {
	type ChainTemplate,
	type ClientProgress,
	createTemplatePlan,
	encodeTemplateText,
	fetchMaybeTemplateState,
	getTemplateOpeningStateDecoder,
	LOOTBOX_PROGRAM_PROGRAM_ADDRESS,
	LootboxClient,
	MAX_TEMPLATE_BUNDLES,
	type OracleAccounts,
	type PrizeAsset,
	type PrizeBundleInput,
} from "@pina-rs/lootbox";
import {
	address,
	createKeyPairSignerFromPrivateKeyBytes,
	getBase64Encoder,
	type TransactionSigner,
} from "@solana/kit";

const CONTROL = "http://127.0.0.1:8898";
const ORACLE = "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const U64_MAX = (1n << 64n) - 1n;
const MAX_ASSETS = 4;

export type AssetSource = "native" | "sandbox" | "jupiter" | "das" | "manual";
export type DraftAsset = {
	id: string;
	kind: "sol" | "token" | "nft";
	label: string;
	amount: string;
	source: AssetSource;
	decimals: number;
	mint?: string;
	icon?: string;
	tokenProgram?: string;
	standard?: string;
};
export type PrizeRow = {
	label: string;
	quantity: string;
	assets: DraftAsset[];
};
export type CreatorInput = {
	name: string;
	uri: string;
	opensAt: string;
	resultReceiptsEnabled: boolean;
	settlementBountySol: string;
	rows: PrizeRow[];
};
type Draft = {
	format: "treasury";
	mode: "create" | "append";
	template?: string;
	startBundleCount?: number;
	id?: string;
	mint?: number[];
	rewards: (number[] | null)[][];
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
export type TokenSearchResult = Readonly<{
	id: string;
	name: string;
	symbol: string;
	icon?: string;
	decimals: number;
	verified: boolean;
	tokenProgram: string;
}>;
export type NftSearchResult = Readonly<{
	id: string;
	name: string;
	image?: string;
	standard: string;
	compressed: boolean;
}>;
export type AssetSearchResponse<T> = Readonly<{
	items: readonly T[];
	source: "live" | "fallback" | "unavailable";
	message?: string;
}>;

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
function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}
function integer(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isSafeInteger(value)
		? value
		: fallback;
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
function id(): string {
	return crypto.randomUUID?.() ?? seed().slice(0, 8).join("-");
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

function searchResponse<T>(
	raw: Record<string, unknown>,
	parser: (value: unknown) => T,
): AssetSearchResponse<T> {
	if (!Array.isArray(raw.items)) {
		throw new Error("Invalid asset catalog response");
	}
	const source = raw.source;
	if (source !== "live" && source !== "fallback" && source !== "unavailable") {
		throw new Error("Invalid asset catalog source");
	}
	const message = optionalString(raw.message);
	return Object.freeze({
		items: Object.freeze(raw.items.map(parser)),
		source,
		...(message ? { message } : {}),
	});
}
export async function searchTokens(
	query: string,
): Promise<AssetSearchResponse<TokenSearchResult>> {
	const raw = await control(
		`/assets/tokens?q=${encodeURIComponent(query.trim())}`,
	);
	const response = searchResponse(raw, (value) => {
		const item = record(value);
		const icon = optionalString(item.icon);
		return Object.freeze({
			id: string(item.id),
			name: string(item.name),
			symbol: string(item.symbol),
			...(icon ? { icon } : {}),
			decimals: integer(item.decimals, -1),
			verified: item.verified === true,
			tokenProgram: string(item.tokenProgram),
		});
	});
	return Object.freeze({
		...response,
		items: Object.freeze(
			response.items.filter(({ decimals }) => decimals >= 0 && decimals <= 9),
		),
	});
}
export async function searchNfts(
	owner: string,
	query: string,
): Promise<AssetSearchResponse<NftSearchResult>> {
	const raw = await control(
		`/assets/nfts?owner=${encodeURIComponent(owner.trim())}&q=${
			encodeURIComponent(query.trim())
		}`,
	);
	return searchResponse(raw, (value) => {
		const item = record(value);
		const image = optionalString(item.image);
		return Object.freeze({
			id: string(item.id),
			name: string(item.name),
			...(image ? { image } : {}),
			standard: string(item.standard),
			compressed: item.compressed === true,
		});
	});
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
	if (amount > U64_MAX) throw new Error("Amount exceeds the token limit");
	return amount;
}
export function formatUnits(amount: bigint, decimals = 9): string {
	const scale = 10n ** BigInt(decimals);
	const fractional = (amount % scale).toString().padStart(decimals, "0")
		.replace(/0+$/, "");
	return `${amount / scale}${fractional ? `.${fractional}` : ""}`;
}
export function makeAsset(kind: DraftAsset["kind"] = "sol"): DraftAsset {
	if (kind === "sol") {
		return {
			id: id(),
			kind,
			label: "SOL",
			amount: "0.1",
			source: "native",
			decimals: 9,
		};
	}
	if (kind === "token") {
		return {
			id: id(),
			kind,
			label: "Workshop token",
			amount: "100",
			source: "sandbox",
			decimals: 0,
		};
	}
	return {
		id: id(),
		kind,
		label: "One-of-one test NFT",
		amount: "1",
		source: "sandbox",
		decimals: 0,
		standard: "Legacy NFT",
	};
}
export function makeBundle(asset: DraftAsset = makeAsset()): PrizeRow {
	return { label: "Prize bundle", quantity: "1", assets: [asset] };
}
function defaultRevealDate(): string {
	const date = new Date(Date.now() + 24 * 3_600_000);
	return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
		.toISOString().slice(0, 16);
}
export const initialInput: CreatorInput = {
	name: "Midnight cargo",
	uri: "",
	opensAt: defaultRevealDate(),
	resultReceiptsEnabled: false,
	settlementBountySol: "0",
	rows: [
		{ label: "Pocket spark", quantity: "8", assets: [makeAsset("sol")] },
		{ label: "BONK crate", quantity: "4", assets: [makeAsset("token")] },
		{
			label: "Collector bundle",
			quantity: "1",
			assets: [
				{ ...makeAsset("sol"), amount: "1" },
				makeAsset("nft"),
				makeAsset("nft"),
			],
		},
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
		) {
			throw new Error("Use an http, https, ipfs, or ar metadata URI");
		}
	});
	const revealTime = Date.parse(input.opensAt);
	if (!input.opensAt || !Number.isFinite(revealTime)) {
		errors.opensAt = "Choose a valid future reveal date and time";
	} else if (revealTime <= Date.now() + 60_000) {
		errors.opensAt = "Reveal must be at least one minute in the future";
	}
	check("settlementBountySol", () => {
		parseUnits(input.settlementBountySol, 9);
	});
	if (input.rows.length < 1 || input.rows.length > MAX_TEMPLATE_BUNDLES) {
		errors.bundles = `Use one to ${MAX_TEMPLATE_BUNDLES} bundles`;
	}
	let totalCopies = 0n;
	let totalSol = 0n;
	for (const [index, row] of input.rows.entries()) {
		const key = `row-${index}`;
		check(`${key}-label`, () => {
			if (
				!row.label.trim() || new TextEncoder().encode(row.label).length > 64
			) {
				throw new Error("Give the bundle a short label (1–64 UTF-8 bytes)");
			}
		});
		let quantity = 0n;
		check(`${key}-quantity`, () => {
			quantity = parseUnits(row.quantity, 0);
			if (quantity < 1n || quantity > 1_000_000n) {
				throw new Error("Copies must be a whole number from 1 to 1,000,000");
			}
			totalCopies += quantity;
			if (totalCopies > 0xffff_ffffn) {
				throw new Error("Total copies exceed u32::MAX");
			}
		});
		if (row.assets.length < 1 || row.assets.length > MAX_ASSETS) {
			errors[`${key}-assets`] = `A bundle needs one to ${MAX_ASSETS} assets`;
		}
		const hasUnique = row.assets.some((asset) => asset.kind === "nft");
		if (hasUnique && row.quantity !== "1") {
			errors[`${key}-quantity`] =
				"A bundle containing a unique NFT has one copy";
		}
		for (const [assetIndex, asset] of row.assets.entries()) {
			const assetKey = `${key}-asset-${assetIndex}`;
			check(`${assetKey}-amount`, () => {
				const amount = asset.kind === "nft"
					? 1n
					: parseUnits(asset.amount, asset.decimals);
				if (amount === 0n) throw new Error("Enter an amount greater than zero");
				const collateral = amount * quantity;
				if (collateral > U64_MAX) {
					throw new Error("Amount × copies exceeds the token limit");
				}
				if (asset.kind === "sol") totalSol += collateral;
			});
			if (asset.kind !== "sol" && asset.mint) {
				check(`${assetKey}-mint`, () => void address(asset.mint ?? ""));
			}
			if (asset.source === "manual" && asset.kind !== "sol" && !asset.mint) {
				errors[`${assetKey}-mint`] = "Enter the asset mint address";
			}
		}
	}
	if (totalSol > U64_MAX) {
		errors.bundles = "Combined SOL deposits exceed the token limit";
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
		let tokenAssets = 0;
		let nfts = 0;
		let copies = 0n;
		const quantities = input.rows.map((row) => {
			const quantity = parseUnits(row.quantity, 0);
			copies += quantity;
			for (const asset of row.assets) {
				if (asset.kind === "sol") sol += parseUnits(asset.amount, 9) * quantity;
				if (asset.kind === "token") tokenAssets += 1;
				if (asset.kind === "nft") nfts += 1;
			}
			return quantity;
		});
		return {
			sol,
			tokenAssets,
			nfts,
			copies,
			odds: quantities.map((quantity) =>
				`${(Number(quantity * 1_000_000n / copies) / 10_000).toFixed(2)}%`
			),
		};
	} catch {
		return null;
	}
}

const draftKey = (sandbox: Playground) =>
	`lootbox:draft:${sandbox.config.instanceId}`;
function parseDraft(raw: string): Draft {
	const value: unknown = JSON.parse(raw);
	const draft = record(value);
	if (
		draft.format !== "treasury" ||
		(draft.mode !== "create" && draft.mode !== "append")
	) {
		throw new Error(
			"This saved draft uses an older treasury format and cannot be resumed",
		);
	}
	return value as Draft;
}
export function savedDraftInfo(
	sandbox: Playground,
):
	| Readonly<{ input: CreatorInput; mode: Draft["mode"]; template?: string }>
	| null {
	const raw = localStorage.getItem(draftKey(sandbox));
	if (!raw) return null;
	try {
		const draft = parseDraft(raw);
		validateInput(draft.input);
		return {
			input: draft.input,
			mode: draft.mode,
			...(draft.template ? { template: draft.template } : {}),
		};
	} catch {
		localStorage.removeItem(draftKey(sandbox));
		return null;
	}
}
export function savedInput(sandbox: Playground): CreatorInput | null {
	return savedDraftInfo(sandbox)?.input ?? null;
}
function createDraft(
	input: CreatorInput,
	mode: Draft["mode"],
	template?: string,
	startBundleCount?: number,
): Draft {
	return {
		format: "treasury",
		mode,
		...(template ? { template } : {}),
		...(startBundleCount === undefined ? {} : { startBundleCount }),
		...(mode === "create"
			? {
				id: new DataView(crypto.getRandomValues(new Uint8Array(8)).buffer)
					.getBigUint64(0, true).toString(),
				mint: seed(),
			}
			: {}),
		rewards: input.rows.map((row) =>
			row.assets.map((asset) => asset.kind === "sol" ? null : seed())
		),
		input,
	};
}
function loadDraft(
	sandbox: Playground,
	input: CreatorInput,
	mode: Draft["mode"],
	template?: string,
	startBundleCount?: number,
): Draft {
	const raw = localStorage.getItem(draftKey(sandbox));
	const draft = raw
		? parseDraft(raw)
		: createDraft(input, mode, template, startBundleCount);
	if (
		draft.mode !== mode || draft.template !== template ||
		JSON.stringify(input) !== JSON.stringify(draft.input)
	) {
		throw new Error(
			"Resume or clear your saved funding draft before changing this treasury addition",
		);
	}
	localStorage.setItem(draftKey(sandbox), JSON.stringify(draft));
	return draft;
}
async function localBundles(
	sandbox: Playground,
	draft: Draft,
	progress: ClientProgress,
	materialize = true,
): Promise<readonly PrizeBundleInput[]> {
	const client = sandbox.client("creator", progress);
	const rewards = await Promise.all(
		draft.rewards.map((row) =>
			Promise.all(row.map((bytes) => bytes ? signer(bytes) : null))
		),
	);
	const bundles: PrizeBundleInput[] = [];
	for (const [rowIndex, row] of draft.input.rows.entries()) {
		const quantity = parseUnits(row.quantity, 0);
		const assets: PrizeAsset[] = [];
		for (const [assetIndex, asset] of row.assets.entries()) {
			if (asset.kind === "sol") {
				assets.push({ kind: "sol", lamports: parseUnits(asset.amount, 9) });
				continue;
			}
			const reward = rewards[rowIndex]?.[assetIndex];
			if (!reward) throw new Error("Missing saved reward signer");
			const amount = asset.kind === "nft"
				? 1n
				: parseUnits(asset.amount, asset.decimals);
			if (materialize) {
				await client.createFixedSupplyMint(
					reward,
					amount * quantity,
					asset.kind === "nft" ? 0 : asset.decimals,
				);
			}
			assets.push(
				asset.kind === "nft"
					? {
						kind: "nft",
						mint: reward.address,
						name: asset.label,
						...(asset.icon ? { image: asset.icon } : {}),
					}
					: {
						kind: "token",
						mint: reward.address,
						amount,
						decimals: asset.decimals,
						symbol: asset.label,
						...(asset.icon ? { icon: asset.icon } : {}),
					},
			);
		}
		bundles.push({ label: row.label, quantity, assets });
	}
	return bundles;
}

/** Saved test seeds make every multi-transaction funding step resumable.
 * Catalog selections are mirrored as disposable local assets in Surfpool.
 */
export async function createDrop(
	sandbox: Playground,
	input: CreatorInput,
	progress: ClientProgress,
): Promise<ChainTemplate> {
	validateInput(input);
	const draft = loadDraft(sandbox, input, "create");
	if (!draft.id || !draft.mint) {
		throw new Error("Saved treasury draft is incomplete");
	}
	const plan = createTemplatePlan({
		name: input.name,
		uri: input.uri,
		opensAt: BigInt(Math.floor(Date.parse(input.opensAt) / 1000)),
		resultReceiptsEnabled: input.resultReceiptsEnabled,
		settlementBountyLamports: parseUnits(input.settlementBountySol, 9),
		bundles: await localBundles(sandbox, draft, progress),
	});
	const template = await sandbox.client("creator", progress).createTemplate(
		plan,
		BigInt(draft.id),
		await signer(draft.mint),
		address(ORACLE),
		sandbox.config.oracle.queue,
	);
	localStorage.removeItem(draftKey(sandbox));
	return template;
}
export async function appendDrop(
	sandbox: Playground,
	template: ChainTemplate,
	input: CreatorInput,
	progress: ClientProgress,
): Promise<ChainTemplate> {
	validateInput(input);
	const draft = loadDraft(
		sandbox,
		input,
		"append",
		template.address,
		template.data.bundleCount,
	);
	if (draft.startBundleCount === undefined) {
		throw new Error("Saved treasury addition is missing its append position");
	}
	const bundles = await localBundles(sandbox, draft, progress);
	const updated = await sandbox.client("creator", progress).appendBundles(
		template,
		bundles,
		draft.startBundleCount,
	);
	localStorage.removeItem(draftKey(sandbox));
	return updated;
}

export type CancelDraftResult = Readonly<{
	template?: ChainTemplate;
	draftRetained: boolean;
	message: string;
}>;

/** Safely unwinds only the unpublished tail bundle. Previously activated
 * additions stay immutable; a partially completed new treasury is published
 * with those fully funded bundles instead of being orphaned.
 */
export async function cancelSavedDraft(
	sandbox: Playground,
	progress: ClientProgress,
): Promise<CancelDraftResult> {
	const raw = localStorage.getItem(draftKey(sandbox));
	if (!raw) throw new Error("There is no saved funding draft to cancel");
	const draft = parseDraft(raw);
	const client = sandbox.client("creator", progress);
	const templateAddress = draft.mode === "append"
		? address(draft.template ?? "")
		: (await client.templateAddress(BigInt(draft.id ?? "")))[0];
	const account = await fetchMaybeTemplateState(client.rpc, templateAddress, {
		commitment: "processed",
	});
	if (!account.exists) {
		localStorage.removeItem(draftKey(sandbox));
		return {
			draftRetained: false,
			message: "Local draft cleared. No treasury funds had reached the chain.",
		};
	}

	let current: ChainTemplate = account;
	const base = draft.mode === "append" ? draft.startBundleCount ?? 0 : 0;
	const offset = current.data.bundleCount - base;
	const bundles = await localBundles(sandbox, draft, progress, false);
	const stagedAssets = bundles[offset]?.assets;
	if (stagedAssets) {
		try {
			current = await client.cancelFundingBundle(current, stagedAssets);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				error.message !== "this treasury has no staged bundle to cancel"
			) throw error;
		}
	}

	if (draft.mode === "create" && current.data.status === 0) {
		if (current.data.bundleCount === 0) {
			return {
				template: current,
				draftRetained: true,
				message:
					"Staged assets were reclaimed. The empty treasury draft remains saved so its on-chain account is not orphaned.",
			};
		}
		current = await client.publishTemplate(current);
	}
	localStorage.removeItem(draftKey(sandbox));
	return {
		template: current,
		draftRetained: false,
		message: draft.mode === "append"
			? "Unpublished assets reclaimed. Existing treasury bundles were unchanged."
			: "Unpublished assets reclaimed. Fully funded bundles were safely published.",
	};
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
	).sort((a, b) => a.data.sequence < b.data.sequence ? -1 : 1);
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
			await client.settle(
				await client.template(template.address),
				opening,
				sandbox.config.oracle,
				{
					signature: bytes(proof.signature, 64),
					recoveryId: proof.recoveryId,
					value: bytes(proof.value, 32),
				},
			);
			continue;
		}
		const current = await client.rpc.getAccountInfo(opening.address, {
			commitment: "processed",
			encoding: "base64",
		}).send();
		if (
			!current.value || current.value.owner !== LOOTBOX_PROGRAM_PROGRAM_ADDRESS
		) {
			throw new Error("Opening account missing");
		}
		await client.allocate(await client.template(template.address), {
			address: opening.address,
			data: getTemplateOpeningStateDecoder().decode(
				getBase64Encoder().encode(current.value.data[0]),
			),
		});
	}
}
