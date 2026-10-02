import { describe, expect, it } from "vitest";

import { buildSiwsMessage, parseSiwsMessage } from "./siws.js";

const fields = {
	domain: "lootbox.so",
	address: "3SWqQpWP5AUyJA5c7kLQdgwP83BLL9p8EH1DkfLTZ3pj",
	statement: "Sign in to lootbox.so.",
	uri: "https://lootbox.so",
	version: "1",
	nonce: "abc123",
	issuedAt: "2026-09-26T10:00:00.000Z",
	expirationTime: "2026-09-26T10:10:00.000Z",
};

describe("SIWS messages", () => {
	it("round-trips every field", () => {
		const text = buildSiwsMessage(fields);

		expect(text.split("\n")[0]).toBe(
			"lootbox.so wants you to sign in with your Solana account:",
		);
		expect(parseSiwsMessage(text)).toEqual(fields);
	});

	it("round-trips without a statement and with resources", () => {
		const { statement: _statement, ...rest } = fields;
		const withResources = {
			...rest,
			resources: ["https://a.example", "https://b.example"],
		};

		expect(parseSiwsMessage(buildSiwsMessage(withResources))).toEqual(
			withResources,
		);
	});

	it("rejects unknown lines, repeated fields, and foreign headers", () => {
		const text = buildSiwsMessage(fields);

		expect(parseSiwsMessage(`${text}\nSurprise: yes`)).toBeNull();
		expect(parseSiwsMessage(`${text}\nNonce: again`)).toBeNull();
		expect(parseSiwsMessage(text.replace("wants you to sign in", "asks")))
			.toBeNull();
		expect(parseSiwsMessage("")).toBeNull();
	});
});
