/**
 * Local Surfpool fixtures for the recipient-site suite.
 *
 * Everything here is test-only: fresh keypairs generated per run, funded by the
 * playground control plane's faucet. Prize tokens are local stand-ins created
 * at the real PreStocks mint addresses (via Surfpool's `surfnet_setAccount`
 * cheatcode) so the manifest resolves logos and prices exactly as it would on
 * mainnet. No real key or real-network account is ever touched.
 */
import {
	createTemplatePlan,
	LootboxClient,
	type PrizeBundleInput,
} from "@pina-rs/lootbox";
import type { Page } from "@playwright/test";
import {
	findAssociatedTokenPda,
	getCreateAssociatedTokenIdempotentInstruction,
	getMintEncoder,
	getMintToInstruction,
	getTokenDecoder,
} from "@solana-program/token-2022";
import {
	type Address,
	address,
	generateKeyPairSigner,
	getAddressEncoder,
	getBase64Encoder,
	getTransactionDecoder,
	getTransactionEncoder,
	type KeyPairSigner,
	partiallySignTransaction,
} from "@solana/kit";

export const CONTROL = "http://127.0.0.1:8898";
const CLASSIC_TOKEN = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ORACLE_PROGRAM = address("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");

/** PreStocks mainnet mints, recreated locally as classic SPL stand-ins. */
export const STOCKS = {
	OPENAI: address("PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"),
	SPACEX: address("PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"),
} as const;

type ControlConfig = Readonly<{
	rpcUrl: string;
	oracle: Readonly<{ queue: string }>;
}>;

async function json(response: Response): Promise<unknown> {
	if (!response.ok) {
		throw new Error(`${response.url} responded ${response.status}`);
	}

	return response.json();
}

export async function controlConfig(): Promise<ControlConfig> {
	const body = await json(await fetch(`${CONTROL}/config`));

	if (
		typeof body !== "object" || body === null ||
		typeof Reflect.get(body, "rpcUrl") !== "string"
	) throw new Error("unexpected control plane config");

	return body as ControlConfig;
}

export async function faucet(wallet: Address): Promise<void> {
	await json(
		await fetch(`${CONTROL}/faucet`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ address: wallet }),
		}),
	);
}

export async function chainTime(client: LootboxClient): Promise<bigint> {
	const slot = await client.rpc.getSlot({ commitment: "processed" }).send();
	const time = await client.rpc.getBlockTime(slot).send();

	if (time === null) throw new Error("chain time unavailable");

	return time;
}

export async function timeTravel(timestampSeconds: bigint): Promise<void> {
	await json(
		await fetch(`${CONTROL}/time-travel`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ timestampSeconds: Number(timestampSeconds) }),
		}),
	);
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
	const body = await json(
		await fetch(rpcUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
		}),
	);

	if (typeof body === "object" && body !== null && "error" in body) {
		throw new Error(`${method} failed: ${JSON.stringify(body.error)}`);
	}
}

/** Recreate a PreStocks mint locally with `authority` able to mint. */
async function standInMint(
	client: LootboxClient,
	rpcUrl: string,
	mint: Address,
	authority: KeyPairSigner,
	amount: bigint,
): Promise<void> {
	const data = getMintEncoder().encode({
		mintAuthority: authority.address,
		supply: 0n,
		decimals: 9,
		isInitialized: true,
		freezeAuthority: null,
		extensions: null,
	});
	const rent = await client.rpc.getMinimumBalanceForRentExemption(82n).send();

	await rpcCall(rpcUrl, "surfnet_setAccount", [mint, {
		lamports: Number(rent),
		owner: CLASSIC_TOKEN,
		executable: false,
		data: Buffer.from(data.slice(0, 82)).toString("hex"),
	}]);

	const [ata] = await findAssociatedTokenPda({
		owner: authority.address,
		mint,
		tokenProgram: CLASSIC_TOKEN,
	});

	await client.send([
		getCreateAssociatedTokenIdempotentInstruction({
			payer: authority,
			ata,
			owner: authority.address,
			mint,
			tokenProgram: CLASSIC_TOKEN,
		}),
		getMintToInstruction({
			mint,
			token: ata,
			mintAuthority: authority,
			amount,
		}, { programAddress: CLASSIC_TOKEN }),
	], "Mint local PreStocks stand-in");
}

export type LocalSeries = Readonly<{
	treasury: Address;
	boxMint: Address;
	badge: Address | null;
	revealAt: bigint;
	rpcUrl: string;
	client: LootboxClient;
}>;

/** One OpenAI slice (1 box) and two SpaceX slices (2 boxes), all to `holder`. */
export const OPENAI_AMOUNT = 47_900_000n;
export const SPACEX_AMOUNT = 217_000_000n;

/** Lamports in each empty box, alongside its mint-on-claim badge. */
export const EMPTY_BOX_LAMPORTS = 1_000_000n;

type SeriesKind = "stocks" | "empty";

async function seriesBundles(
	kind: SeriesKind,
	client: LootboxClient,
	rpcUrl: string,
	creator: KeyPairSigner,
): Promise<{ bundles: PrizeBundleInput[]; badge: Address | null }> {
	if (kind === "empty") {
		const badge = await client.createBadgeMint(await generateKeyPairSigner());

		return {
			badge,
			bundles: [{
				label: "Empty box",
				quantity: 3n,
				assets: [
					{ kind: "mintBadge", mint: badge, name: "Empty Box" },
					{ kind: "sol", lamports: EMPTY_BOX_LAMPORTS },
				],
			}],
		};
	}

	await standInMint(client, rpcUrl, STOCKS.OPENAI, creator, OPENAI_AMOUNT);
	await standInMint(client, rpcUrl, STOCKS.SPACEX, creator, SPACEX_AMOUNT * 2n);

	return {
		badge: null,
		bundles: [{
			label: "OpenAI",
			quantity: 1n,
			assets: [{
				kind: "token",
				mint: STOCKS.OPENAI,
				amount: OPENAI_AMOUNT,
				decimals: 9,
				tokenProgram: CLASSIC_TOKEN,
			}],
		}, {
			label: "SpaceX",
			quantity: 2n,
			assets: [{
				kind: "token",
				mint: STOCKS.SPACEX,
				amount: SPACEX_AMOUNT,
				decimals: 9,
				tokenProgram: CLASSIC_TOKEN,
			}],
		}],
	};
}

/**
 * Fund, lock, and hand three boxes to `holder`.
 *
 * `stocks` (default): one OpenAI slice and two SpaceX slices.
 * `empty`: three empty boxes, each a mint-on-claim badge plus 0.001 SOL.
 */
export async function createSeries(
	options: Readonly<{
		holder: Address;
		revealInSeconds?: bigint;
		kind?: SeriesKind;
	}>,
): Promise<LocalSeries> {
	const { rpcUrl, oracle } = await controlConfig();
	const creator = await generateKeyPairSigner();

	await faucet(creator.address);

	const client = new LootboxClient(rpcUrl, creator);
	const { bundles, badge } = await seriesBundles(
		options.kind ?? "stocks",
		client,
		rpcUrl,
		creator,
	);
	const revealAt = await chainTime(client) +
		(options.revealInSeconds ?? 3_600n);
	const plan = createTemplatePlan({
		name: "Unlisted E2E",
		uri: "",
		opensAt: revealAt,
		resultReceiptsEnabled: false,
		settlementBountyLamports: 0n,
		bundles,
	});
	const id = BigInt(Math.floor(Math.random() * 2 ** 48));
	const created = await client.createTemplate(
		plan,
		id,
		await generateKeyPairSigner(),
		ORACLE_PROGRAM,
		address(oracle.queue),
	);
	const locked = await client.lockTreasury(created);

	await client.transfer(locked, options.holder, 3n);

	return {
		treasury: locked.address,
		boxMint: locked.data.boxMint,
		badge,
		revealAt,
		rpcUrl,
		client,
	};
}

/** Base-unit balance of `mint` held by `owner` in its associated account. */
export async function tokenBalance(
	client: LootboxClient,
	owner: Address,
	mint: Address,
	tokenProgram: Address = CLASSIC_TOKEN,
): Promise<bigint> {
	const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram });
	const { value } = await client.rpc.getAccountInfo(ata, {
		encoding: "base64",
		commitment: "processed",
	}).send();

	if (!value) return 0n;

	return getTokenDecoder().decode(getBase64Encoder().encode(value.data[0]))
		.amount;
}

/**
 * Register a Wallet Standard wallet in the page, backed by a fresh local
 * keypair. Signing happens in the test process through an exposed binding, so
 * the secret key never enters the page.
 */
export async function injectTestWallet(page: Page): Promise<KeyPairSigner> {
	const signer = await generateKeyPairSigner();
	const decoder = getTransactionDecoder();
	const encoder = getTransactionEncoder();

	await faucet(signer.address);
	await page.exposeBinding("__e2eSign", async (_source, bytes: number[]) => {
		const transaction = decoder.decode(Uint8Array.from(bytes));
		const signed = await partiallySignTransaction(
			[signer.keyPair],
			transaction,
		);

		return Array.from(encoder.encode(signed));
	});
	await page.addInitScript(
		({ walletAddress, publicKey }) => {
			type Input = { transaction: Uint8Array };
			type Sign = (bytes: number[]) => Promise<number[]>;
			const sign = (window as unknown as { __e2eSign: Sign }).__e2eSign;
			const chains = ["solana:localnet", "solana:devnet", "solana:mainnet"];
			const account = {
				address: walletAddress,
				publicKey: Uint8Array.from(publicKey),
				chains,
				features: ["solana:signTransaction"],
			};
			const wallet = {
				version: "1.0.0",
				name: "E2E Wallet",
				icon:
					"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiLz4=",
				chains,
				accounts: [] as (typeof account)[],
				features: {
					"standard:connect": {
						version: "1.0.0",
						connect: () => {
							wallet.accounts = [account];

							return Promise.resolve({ accounts: [account] });
						},
					},
					"standard:disconnect": {
						version: "1.0.0",
						disconnect: () => {
							wallet.accounts = [];

							return Promise.resolve();
						},
					},
					"standard:events": { version: "1.0.0", on: () => () => {} },
					"solana:signTransaction": {
						version: "1.0.0",
						supportedTransactionVersions: ["legacy", 0],
						signTransaction: (...inputs: Input[]) =>
							Promise.all(
								inputs.map(async (input) => ({
									signedTransaction: Uint8Array.from(
										await sign(Array.from(input.transaction)),
									),
								})),
							),
					},
				},
			};
			type Api = { register(value: typeof wallet): unknown };
			const register = (api: Api) => api.register(wallet);

			window.addEventListener(
				"wallet-standard:app-ready",
				(event) => register((event as CustomEvent<Api>).detail),
			);
			window.dispatchEvent(
				new CustomEvent("wallet-standard:register-wallet", {
					detail: register,
				}),
			);
		},
		{
			walletAddress: signer.address,
			publicKey: Array.from(getAddressEncoder().encode(signer.address)),
		},
	);

	return signer;
}
