import {
	generateKeyPairSigner,
	getAddressDecoder,
	signBytes,
} from "@solana/kit";
import { describe, expect, it, vi } from "vitest";

import { buildSiwsMessage } from "../siws.js";
import { checkSiwsFields, verifyEd25519, verifySignIn } from "./auth.js";

const NOW = Date.parse("2026-09-26T10:00:00.000Z") / 1000;
const URL_ = new URL("https://lootbox.so/api/auth/verify");

async function signed(domain = "lootbox.so") {
	const signer = await generateKeyPairSigner();
	const message = new TextEncoder().encode(
		buildSiwsMessage({
			domain,
			address: signer.address,
			statement: "Sign in.",
			uri: "https://lootbox.so",
			version: "1",
			nonce: "nonce123",
			issuedAt: new Date(NOW * 1000).toISOString(),
			expirationTime: new Date((NOW + 600) * 1000).toISOString(),
		}),
	);
	const signature = new Uint8Array(
		await signBytes(signer.keyPair.privateKey, message),
	);

	return { signer, message, signature };
}

type Call = Readonly<{ sql: string; args: readonly unknown[] }>;

/** A D1 stand-in that records statements and reports one changed row. */
function fakeDb(changes = 1) {
	const calls: Call[] = [];
	const statement = (sql: string) => ({
		bind: (...args: unknown[]) => {
			calls.push({ sql, args });

			return {
				run: () => Promise.resolve({ meta: { changes } }),
				first: () => Promise.resolve(null),
			};
		},
	});
	const db = {
		prepare: statement,
		batch: vi.fn(() => Promise.resolve([])),
	};

	return { db: db as unknown as D1Database, calls };
}

describe("verifyEd25519", () => {
	it("accepts the wallet's signature and rejects any change", async () => {
		const { signer, message, signature } = await signed();

		expect(await verifyEd25519(signer.address, message, signature)).toBe(true);

		const tampered = Uint8Array.from(message);

		tampered[0] = (tampered[0] ?? 0) ^ 1;
		expect(await verifyEd25519(signer.address, tampered, signature)).toBe(
			false,
		);

		const other = await generateKeyPairSigner();

		expect(await verifyEd25519(other.address, message, signature)).toBe(false);
		expect(await verifyEd25519("not-an-address", message, signature)).toBe(
			false,
		);
	});
});

describe("checkSiwsFields", () => {
	const base = {
		domain: "lootbox.so",
		address: getAddressDecoder().decode(new Uint8Array(32).fill(7)),
		nonce: "n",
		version: "1",
		issuedAt: new Date(NOW * 1000).toISOString(),
		expirationTime: new Date((NOW + 60) * 1000).toISOString(),
	};
	const expected = { domain: "lootbox.so", address: base.address, now: NOW };

	it("accepts a fresh message for this site and wallet", () => {
		expect(checkSiwsFields(base, expected)).toBeNull();
	});

	it("names each problem", () => {
		expect(checkSiwsFields({ ...base, domain: "evil.example" }, expected))
			.toBe("signed for another site");
		expect(checkSiwsFields(base, { ...expected, address: "x" }))
			.toBe("signed by another wallet");
		expect(checkSiwsFields({ ...base, nonce: "" }, expected)).toBe(
			"missing nonce",
		);
		expect(checkSiwsFields(base, { ...expected, now: NOW + 3_600 }))
			.toBe("sign-in request is too old");
		expect(checkSiwsFields(base, { ...expected, now: NOW + 120 }))
			.toBe("sign-in request expired");
	});
});

describe("verifySignIn", () => {
	it("starts a session with an HttpOnly cookie and stores only a hash", async () => {
		const { signer, message, signature } = await signed();
		const { db, calls } = fakeDb();
		const result = await verifySignIn(db, {
			requestUrl: URL_,
			address: signer.address,
			message,
			signature,
			now: NOW,
		});

		expect(result).toMatchObject({ address: signer.address });

		if (!("cookie" in result)) throw new Error("expected a session");

		expect(result.cookie).toMatch(
			/^lootbox_session=[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/,
		);

		const token = result.cookie.split(";")[0]?.split("=")[1] ?? "";
		const session = calls.find((call) =>
			call.sql.startsWith("INSERT INTO sessions")
		);

		expect(session?.args[0]).toMatch(/^[0-9a-f]{64}$/);
		expect(session?.args).not.toContain(token);
	});

	it("refuses a bad signature before touching the nonce", async () => {
		const { signer, message } = await signed();
		const { db, calls } = fakeDb();
		const result = await verifySignIn(db, {
			requestUrl: URL_,
			address: signer.address,
			message,
			signature: new Uint8Array(64),
			now: NOW,
		});

		expect(result).toEqual({ error: "signature does not match the wallet" });
		expect(calls).toEqual([]);
	});

	it("refuses another site's message and a spent nonce", async () => {
		const foreign = await signed("evil.example");

		expect(
			await verifySignIn(fakeDb().db, {
				requestUrl: URL_,
				address: foreign.signer.address,
				message: foreign.message,
				signature: foreign.signature,
				now: NOW,
			}),
		).toEqual({ error: "signed for another site" });

		const good = await signed();

		expect(
			await verifySignIn(fakeDb(0).db, {
				requestUrl: URL_,
				address: good.signer.address,
				message: good.message,
				signature: good.signature,
				now: NOW,
			}),
		).toEqual({ error: "sign-in request was already used or expired" });
	});
});
