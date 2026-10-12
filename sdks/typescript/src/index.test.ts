import { describe, expect, it } from "vitest";

import {
	decodeSwitchboardReveal,
	SWITCHBOARD_REVEAL_DISCRIMINATOR,
} from "./index.js";

describe("decodeSwitchboardReveal", () => {
	it("extracts the signed fields for a reveal", () => {
		const data = new Uint8Array(105);
		data.set(SWITCHBOARD_REVEAL_DISCRIMINATOR);
		data.fill(9, 8, 72);
		data[72] = 1;
		data.fill(4, 73);

		expect(decodeSwitchboardReveal(data)).toEqual({
			recoveryId: 1,
			signature: new Uint8Array(64).fill(9),
			value: new Uint8Array(32).fill(4),
		});
	});

	it("rejects unrelated instruction data", () => {
		expect(() => decodeSwitchboardReveal(new Uint8Array(105))).toThrowError(
			"instruction is not a Switchboard randomness reveal",
		);
	});
});
