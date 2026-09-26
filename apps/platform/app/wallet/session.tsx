/**
 * Sign In With Solana on the client.
 *
 * Wallets with `solana:signIn` build and sign the SIWS message themselves;
 * others sign the canonical text from `buildSiwsMessage`. Either way the
 * server re-parses and verifies everything.
 */
import {
	useSelectedWalletAccount,
	useSignIn,
	useSignMessage,
} from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { type ReactNode, useState } from "react";
import { useRevalidator } from "react-router";

import { toBase64 } from "../lib/bytes.js";
import { usePublicConfig } from "../lib/public-config.js";
import { buildSiwsMessage } from "../lib/siws.js";
import { useHydrated, useWalletUi } from "./WalletProvider.js";

type Challenge = Readonly<{
	domain: string;
	uri: string;
	statement: string;
	version: string;
	nonce: string;
	issuedAt: string;
	expirationTime: string;
}>;

function isChallenge(value: unknown): value is Challenge {
	return typeof value === "object" && value !== null &&
		[
			"domain",
			"uri",
			"statement",
			"version",
			"nonce",
			"issuedAt",
			"expirationTime",
		]
			.every((key) => typeof Reflect.get(value, key) === "string");
}

async function postJson(url: string, body: unknown): Promise<unknown> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data: unknown = await response.json();

	if (!response.ok) {
		const message = typeof data === "object" && data !== null
			? Reflect.get(data, "error")
			: null;

		throw new Error(typeof message === "string" ? message : "Request failed");
	}

	return data;
}

async function requestChallenge(): Promise<Challenge> {
	const challenge = await postJson("/api/auth/nonce", {});

	if (!isChallenge(challenge)) throw new Error("Unexpected sign-in challenge");

	return challenge;
}

type Signed = Readonly<{
	address: string;
	message: Uint8Array;
	signature: Uint8Array;
}>;

/** Sign-in state for the connected wallet. */
export function useSession() {
	const config = usePublicConfig();
	const [account] = useSelectedWalletAccount();
	const hydrated = useHydrated();
	const address = hydrated ? account?.address ?? null : null;

	return {
		account: hydrated ? account : undefined,
		address,
		/** The server-side session wallet, which may differ from the selection. */
		session: config.session,
		signedIn: address !== null && config.session === address,
	};
}

function SignInAction(
	{ sign, label }: Readonly<{
		sign: (challenge: Challenge) => Promise<Signed>;
		label: string;
	}>,
) {
	const revalidator = useRevalidator();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	return (
		<>
			<button
				type="button"
				className="button button-primary"
				disabled={busy}
				onClick={async () => {
					setBusy(true);
					setError(null);

					try {
						const signed = await sign(await requestChallenge());

						await postJson("/api/auth/verify", {
							address: signed.address,
							message: toBase64(signed.message),
							signature: toBase64(signed.signature),
						});
						await revalidator.revalidate();
					} catch (reason) {
						setError(
							reason instanceof Error ? reason.message : "Sign-in failed",
						);
					} finally {
						setBusy(false);
					}
				}}
			>
				{busy ? "Check your wallet…" : label}
			</button>
			{error && <p className="form-error" role="alert">{error}</p>}
		</>
	);
}

function SignInWithFeature(
	{ account, label }: Readonly<{ account: UiWalletAccount; label: string }>,
) {
	const signIn = useSignIn(account);

	return (
		<SignInAction
			label={label}
			sign={async (challenge) => {
				const output = await signIn(challenge);

				return {
					address: output.account.address,
					message: output.signedMessage,
					signature: output.signature,
				};
			}}
		/>
	);
}

function SignInWithMessage(
	{ account, label }: Readonly<{ account: UiWalletAccount; label: string }>,
) {
	const signMessage = useSignMessage(account);

	return (
		<SignInAction
			label={label}
			sign={async (challenge) => {
				const message = new TextEncoder().encode(
					buildSiwsMessage({ ...challenge, address: account.address }),
				);
				const output = await signMessage({ message });

				return {
					address: account.address,
					message,
					signature: output.signature,
				};
			}}
		/>
	);
}

export function SignInButton(
	{ account, label = "Sign in with wallet" }: Readonly<{
		account: UiWalletAccount;
		label?: string;
	}>,
) {
	if (account.features.includes("solana:signIn")) {
		return <SignInWithFeature account={account} label={label} />;
	}

	if (account.features.includes("solana:signMessage")) {
		return <SignInWithMessage account={account} label={label} />;
	}

	return (
		<p className="form-error">
			This wallet cannot sign messages, so it cannot sign in here.
		</p>
	);
}

/**
 * Show `children` only to a signed-in wallet; otherwise explain the one step
 * that is missing (connect, then sign in).
 */
export function RequireSignIn(
	{ children, why }: Readonly<{ children: ReactNode; why: string }>,
) {
	const { account, signedIn } = useSession();
	const { openConnect } = useWalletUi();
	const hydrated = useHydrated();

	if (signedIn) return children;

	return (
		<section className="card gate" aria-labelledby="gate-title">
			<img src="/chest/chest-closed.webp" alt="" width={120} height={120} />
			<h2 id="gate-title">
				{account ? "One quick signature" : "Connect your wallet"}
			</h2>
			<p>{why}</p>
			{!hydrated
				? <button type="button" className="button" disabled>Loading…</button>
				: account
				? <SignInButton account={account} />
				: (
					<button
						type="button"
						className="button button-primary"
						onClick={openConnect}
					>
						Connect wallet
					</button>
				)}
		</section>
	);
}
