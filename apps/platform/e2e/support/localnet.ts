/**
 * Local Surfpool fixtures for the platform suite.
 *
 * Everything is test-only: fresh keypairs per run, funded by the playground
 * control plane's faucet, on an offline Surfpool with an emulated oracle. No
 * real key, account, or network is ever touched.
 */
import { LootboxClient } from "@pina-rs/lootbox";
import type { Page } from "@playwright/test";
import {
	findAssociatedTokenPda,
	getCreateAssociatedTokenIdempotentInstruction,
	getMintEncoder,
	getMintToInstruction,
} from "@solana-program/token-2022";
import {
	type Address,
	address,
	generateKeyPairSigner,
	getAddressEncoder,
	getTransactionDecoder,
	getTransactionEncoder,
	type KeyPairSigner,
	partiallySignTransaction,
	signBytes,
} from "@solana/kit";

import { clusterTime } from "../../app/lib/clock.js";

export const CONTROL = "http://127.0.0.1:8898";
export const CLASSIC_TOKEN = address(
	"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

type ControlConfig = Readonly<{ rpcUrl: string }>;

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
	) {
		throw new Error("unexpected control plane config");
	}

	return { rpcUrl: String(Reflect.get(body, "rpcUrl")) };
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
	return BigInt(await clusterTime(client.rpc));
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

async function rpcCall(
	rpcUrl: string,
	method: string,
	params: unknown[],
): Promise<void> {
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

/**
 * A classic SPL mint with `amount` base units minted to `owner`, created with
 * Surfpool's `surfnet_setAccount`. Pass `at` to recreate a mainnet mint
 * (BONK, a PreStocks token) as a local stand-in so catalog results resolve.
 */
export async function testToken(
	client: LootboxClient,
	rpcUrl: string,
	owner: KeyPairSigner,
	amount: bigint,
	options: Readonly<{ at?: Address; decimals?: number; freezable?: boolean }> =
		{},
): Promise<Address> {
	const mint = options.at ?? (await generateKeyPairSigner()).address;
	const data = getMintEncoder().encode({
		mintAuthority: owner.address,
		supply: 0n,
		decimals: options.decimals ?? 6,
		isInitialized: true,
		freezeAuthority: options.freezable ? owner.address : null,
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
		owner: owner.address,
		mint,
		tokenProgram: CLASSIC_TOKEN,
	});

	await client.send([
		getCreateAssociatedTokenIdempotentInstruction({
			payer: owner,
			ata,
			owner: owner.address,
			mint,
			tokenProgram: CLASSIC_TOKEN,
		}),
		getMintToInstruction({ mint, token: ata, mintAuthority: owner, amount }, {
			programAddress: CLASSIC_TOKEN,
		}),
	], "Mint test token");

	return mint;
}

/**
 * Register a Wallet Standard wallet in the page, backed by a local keypair.
 * Signing happens in the test process through exposed bindings, so the
 * secret key never enters the page. It supports `signTransaction` and
 * `signMessage` (the SIWS fallback path).
 */
export async function injectTestWallet(
	page: Page,
	signer: KeyPairSigner,
): Promise<void> {
	const decoder = getTransactionDecoder();
	const encoder = getTransactionEncoder();

	await page.exposeBinding("__e2eSign", async (_source, bytes: number[]) => {
		const transaction = decoder.decode(Uint8Array.from(bytes));
		const signed = await partiallySignTransaction(
			[signer.keyPair],
			transaction,
		);

		return Array.from(encoder.encode(signed));
	});
	await page.exposeBinding(
		"__e2eSignMessage",
		async (_source, bytes: number[]) => {
			const signature = await signBytes(
				signer.keyPair.privateKey,
				Uint8Array.from(bytes),
			);

			return Array.from(signature);
		},
	);
	await page.addInitScript(
		({ walletAddress, publicKey }) => {
			type Sign = (bytes: number[]) => Promise<number[]>;
			const host = window as unknown as {
				__e2eSign: Sign;
				__e2eSignMessage: Sign;
			};
			const chains = ["solana:localnet", "solana:devnet", "solana:mainnet"];
			const account = {
				address: walletAddress,
				publicKey: Uint8Array.from(publicKey),
				chains,
				features: ["solana:signTransaction", "solana:signMessage"],
			};
			type Listener = (properties: { accounts: (typeof account)[] }) => void;
			const listeners = new Set<Listener>();
			const announce = () => {
				for (const listener of listeners) {
					listener({ accounts: wallet.accounts });
				}
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
							announce();

							return Promise.resolve({ accounts: [account] });
						},
					},
					"standard:disconnect": {
						version: "1.0.0",
						disconnect: () => {
							wallet.accounts = [];
							announce();

							return Promise.resolve();
						},
					},
					// Real wallets emit `change` when accounts change; Wallet
					// Standard UIs rely on it to see the connected account.
					"standard:events": {
						version: "1.0.0",
						on: (_event: "change", listener: Listener) => {
							listeners.add(listener);

							return () => listeners.delete(listener);
						},
					},
					"solana:signTransaction": {
						version: "1.0.0",
						supportedTransactionVersions: ["legacy", 0],
						signTransaction: (...inputs: { transaction: Uint8Array }[]) =>
							Promise.all(
								inputs.map(async (input) => ({
									signedTransaction: Uint8Array.from(
										await host.__e2eSign(Array.from(input.transaction)),
									),
								})),
							),
					},
					"solana:signMessage": {
						version: "1.0.0",
						signMessage: (...inputs: { message: Uint8Array }[]) =>
							Promise.all(
								inputs.map(async (input) => ({
									signedMessage: input.message,
									signature: Uint8Array.from(
										await host.__e2eSignMessage(Array.from(input.message)),
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
}

/** A funded test keypair. */
export async function fundedSigner(): Promise<KeyPairSigner> {
	const signer = await generateKeyPairSigner();

	await faucet(signer.address);

	return signer;
}

export function testClient(
	rpcUrl: string,
	signer: KeyPairSigner,
): LootboxClient {
	return new LootboxClient(rpcUrl, signer);
}
