import {
	type Address,
	address,
	assertIsTransactionWithinSizeLimit,
	getTransactionDecoder,
	getTransactionEncoder,
	type Transaction,
	type TransactionModifyingSigner,
	type TransactionSigner,
	type TransactionWithLifetime,
} from "@solana/kit";
import {
	SolanaSignTransaction,
	type SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";
import { getWallets } from "@wallet-standard/app";
import type {
	IdentifierString,
	Wallet,
	WalletAccount,
} from "@wallet-standard/base";
import {
	StandardConnect,
	type StandardConnectFeature,
	StandardDisconnect,
	type StandardDisconnectFeature,
} from "@wallet-standard/features";

import type { Cluster } from "./config.js";

/** A wallet the recipient has connected. No private key ever enters the app. */
export type ConnectedWallet = Readonly<{
	name: string;
	address: Address;
	signer: TransactionSigner;
	/** `test` marks the disposable localnet recipient wallet. */
	kind: "wallet" | "test";
	disconnect(): Promise<void>;
}>;

export type WalletOption = Readonly<{
	name: string;
	icon: string | null;
	connect(): Promise<ConnectedWallet>;
}>;

export function chainFor(cluster: Cluster): IdentifierString {
	return `solana:${cluster}`;
}

type SignTransaction =
	SolanaSignTransactionFeature[typeof SolanaSignTransaction];
type Connect = StandardConnectFeature[typeof StandardConnect];
type Disconnect = StandardDisconnectFeature[typeof StandardDisconnect];

function feature<T>(wallet: Wallet, name: string): T | null {
	return name in wallet.features
		? (wallet.features as Record<string, T>)[name] ?? null
		: null;
}

function signsFor(wallet: Wallet, chain: IdentifierString): boolean {
	const sign = feature<SignTransaction>(wallet, SolanaSignTransaction);

	return feature<Connect>(wallet, StandardConnect) !== null && sign !== null &&
		// Some wallets list only mainnet chains yet sign for every cluster.
		(wallet.chains.includes(chain) ||
			wallet.chains.some((value) => value.startsWith("solana:")));
}

const encoder = getTransactionEncoder();
const decoder = getTransactionDecoder();

/**
 * Adapt a Wallet Standard account to the kit `TransactionSigner` the SDK uses.
 *
 * The wallet may add instructions (for example priority fees) but keeps the
 * blockhash, so the original lifetime constraint still applies.
 */
export function walletSigner(
	sign: SignTransaction,
	account: WalletAccount,
	chain: IdentifierString,
): TransactionModifyingSigner {
	return Object.freeze({
		address: address(account.address),
		async modifyAndSignTransactions(
			transactions:
				readonly (Transaction | (Transaction & TransactionWithLifetime))[],
		) {
			const outputs = await sign.signTransaction(
				...transactions.map((transaction) => ({
					account,
					chain,
					transaction: new Uint8Array(encoder.encode(transaction)),
				})),
			);

			return outputs.map((output, index) => {
				const original = transactions[index];

				if (!original || !("lifetimeConstraint" in original)) {
					throw new Error("Wallet returned a transaction without a lifetime");
				}

				const signed = {
					...decoder.decode(output.signedTransaction),
					lifetimeConstraint: original.lifetimeConstraint,
				};

				assertIsTransactionWithinSizeLimit(signed);

				return signed;
			});
		},
	});
}

function optionFor(wallet: Wallet, chain: IdentifierString): WalletOption {
	return Object.freeze({
		name: wallet.name,
		icon: wallet.icon,
		async connect() {
			const connect = feature<Connect>(wallet, StandardConnect);
			const sign = feature<SignTransaction>(wallet, SolanaSignTransaction);

			if (!connect || !sign) {
				throw new Error(`${wallet.name} cannot sign Solana transactions`);
			}

			const { accounts } = await connect.connect();
			const account = accounts[0];

			if (!account) throw new Error(`${wallet.name} shared no accounts`);

			return Object.freeze({
				name: wallet.name,
				address: address(account.address),
				signer: walletSigner(sign, account, chain),
				kind: "wallet" as const,
				async disconnect() {
					await feature<Disconnect>(wallet, StandardDisconnect)?.disconnect();
				},
			});
		},
	});
}

/** Watch for Wallet Standard wallets (Phantom, Solflare, Backpack, …). */
export function watchWallets(
	cluster: Cluster,
	onChange: (options: readonly WalletOption[]) => void,
): () => void {
	const chain = chainFor(cluster);
	const registry = getWallets();
	const publish = () =>
		onChange(
			registry.get().filter((wallet) => signsFor(wallet, chain)).map((
				wallet,
			) => optionFor(wallet, chain)),
		);
	const stopRegister = registry.on("register", publish);
	const stopUnregister = registry.on("unregister", publish);

	publish();

	return () => {
		stopRegister();
		stopUnregister();
	};
}
