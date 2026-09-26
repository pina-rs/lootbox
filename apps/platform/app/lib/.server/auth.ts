/**
 * Sign In With Solana sessions.
 *
 * 1. `POST /api/auth/nonce` issues a single-use nonce bound to this host.
 * 2. The wallet signs a SIWS message (`solana:signIn`, or `signMessage` with
 *    text from `buildSiwsMessage`).
 * 3. `POST /api/auth/verify` parses the signed text, checks every field, burns
 *    the nonce, verifies the Ed25519 signature with WebCrypto, and sets an
 *    HttpOnly session cookie. Only a SHA-256 hash of the token is stored.
 *
 * A session proves wallet control only. Creator actions additionally check
 * that the wallet is the template authority on chain.
 */
import { getAddressEncoder, isAddress } from "@solana/kit";

import { parseSiwsMessage, type SiwsFields } from "../siws.js";
import {
	consumeNonce,
	deleteSession,
	insertNonce,
	insertSession,
	sessionAddress,
} from "./db.js";

export const SESSION_COOKIE = "lootbox_session";
export const SIGN_IN_STATEMENT =
	"Sign in to lootbox.so. This proves you own this wallet. It is free and sends no transaction.";
const NONCE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Wallet clocks drift; accept an Issued At up to five minutes either side. */
const CLOCK_SKEW_SECONDS = 5 * 60;

function base64Url(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) binary += String.fromCharCode(byte);

	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
		/=+$/,
		"",
	);
}

export function randomToken(bytes = 32): string {
	return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);

	return Array.from(
		new Uint8Array(digest),
		(byte) => byte.toString(16).padStart(2, "0"),
	).join("");
}

/** Verify an Ed25519 signature by a Solana address over `message`. */
export async function verifyEd25519(
	address: string,
	message: Uint8Array<ArrayBuffer>,
	signature: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
	if (!isAddress(address) || signature.length !== 64) return false;

	const publicKey = new Uint8Array(getAddressEncoder().encode(address));
	const key = await crypto.subtle.importKey(
		"raw",
		publicKey,
		{ name: "Ed25519" },
		false,
		["verify"],
	);

	return crypto.subtle.verify({ name: "Ed25519" }, key, signature, message);
}

export type SignInChallenge = Readonly<{
	domain: string;
	uri: string;
	statement: string;
	version: "1";
	nonce: string;
	issuedAt: string;
	expirationTime: string;
}>;

export async function issueChallenge(
	db: D1Database,
	requestUrl: URL,
	now: number,
): Promise<SignInChallenge> {
	const nonce = randomToken(16).replace(/[-_]/g, "x");
	const expiresAt = now + NONCE_TTL_SECONDS;

	await insertNonce(db, nonce, requestUrl.host, now, expiresAt);

	return {
		domain: requestUrl.host,
		uri: requestUrl.origin,
		statement: SIGN_IN_STATEMENT,
		version: "1",
		nonce,
		issuedAt: new Date(now * 1000).toISOString(),
		expirationTime: new Date(expiresAt * 1000).toISOString(),
	};
}

/** Why a signed SIWS message is not acceptable, or `null` when it is. */
export function checkSiwsFields(
	fields: SiwsFields,
	expected: Readonly<{ domain: string; address: string; now: number }>,
): string | null {
	if (fields.domain !== expected.domain) return "signed for another site";

	if (fields.address !== expected.address) return "signed by another wallet";

	if (!fields.nonce) return "missing nonce";

	if (fields.version !== undefined && fields.version !== "1") {
		return "unsupported SIWS version";
	}

	const issuedAt = fields.issuedAt ? Date.parse(fields.issuedAt) / 1000 : NaN;

	if (
		!Number.isFinite(issuedAt) ||
		Math.abs(issuedAt - expected.now) > NONCE_TTL_SECONDS + CLOCK_SKEW_SECONDS
	) return "sign-in request is too old";

	if (fields.expirationTime) {
		const expiresAt = Date.parse(fields.expirationTime) / 1000;

		if (!Number.isFinite(expiresAt) || expiresAt <= expected.now) {
			return "sign-in request expired";
		}
	}

	if (fields.notBefore) {
		const notBefore = Date.parse(fields.notBefore) / 1000;

		if (
			!Number.isFinite(notBefore) ||
			notBefore > expected.now + CLOCK_SKEW_SECONDS
		) {
			return "sign-in request is not valid yet";
		}
	}

	return null;
}

export type VerifiedSession = Readonly<{ address: string; cookie: string }>;

/**
 * Verify a signed SIWS message and start a session. Returns a reason string
 * on failure so the client can show something useful.
 */
export async function verifySignIn(
	db: D1Database,
	input: Readonly<{
		requestUrl: URL;
		address: string;
		message: Uint8Array<ArrayBuffer>;
		signature: Uint8Array<ArrayBuffer>;
		now: number;
	}>,
): Promise<VerifiedSession | { error: string }> {
	const text = new TextDecoder("utf-8", { fatal: false }).decode(input.message);
	const fields = parseSiwsMessage(text);

	if (!fields) return { error: "not a Sign In With Solana message" };

	const problem = checkSiwsFields(fields, {
		domain: input.requestUrl.host,
		address: input.address,
		now: input.now,
	});

	if (problem) return { error: problem };

	// Security: verify the signature before consuming the nonce so a forged
	// request cannot burn someone else's pending nonce.
	if (!(await verifyEd25519(input.address, input.message, input.signature))) {
		return { error: "signature does not match the wallet" };
	}

	if (
		!(await consumeNonce(
			db,
			fields.nonce ?? "",
			input.requestUrl.host,
			input.now,
		))
	) return { error: "sign-in request was already used or expired" };

	const token = randomToken();

	await insertSession(
		db,
		await sha256Hex(token),
		input.address,
		input.now,
		input.now + SESSION_TTL_SECONDS,
	);

	return {
		address: input.address,
		cookie: sessionCookie(token, input.requestUrl, SESSION_TTL_SECONDS),
	};
}

function sessionCookie(token: string, url: URL, maxAge: number): string {
	const secure = url.protocol === "https:" ? "; Secure" : "";

	return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("Cookie") ?? "";

	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");

		if (key === name) return rest.join("=") || null;
	}

	return null;
}

/** The signed-in wallet for this request, or `null`. */
export async function currentWallet(
	db: D1Database,
	request: Request,
	now: number,
): Promise<string | null> {
	const token = readCookie(request, SESSION_COOKIE);

	if (!token) return null;

	return sessionAddress(db, await sha256Hex(token), now);
}

/** End the session and return a cookie that clears it. */
export async function signOut(
	db: D1Database,
	request: Request,
): Promise<string> {
	const token = readCookie(request, SESSION_COOKIE);

	if (token) await deleteSession(db, await sha256Hex(token));

	return sessionCookie("", new URL(request.url), 0);
}
