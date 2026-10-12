export * from "@pina-rs/lootbox-program-client";
export * from "./client.js";
export * from "./curve.js";
export * from "./exclusive.js";
export * from "./market.js";
export * from "./relayer.js";
export * from "./switchboard.js";
export * from "./templates.js";

export const SWITCHBOARD_REVEAL_DISCRIMINATOR = new Uint8Array([
	197,
	181,
	187,
	10,
	30,
	58,
	20,
	73,
]);
const MAX_U64 = (1n << 64n) - 1n;

export type SwitchboardReveal = Readonly<{
	signature: Uint8Array;
	recoveryId: number;
	value: Uint8Array;
}>;

/**
 * Decode Switchboard's `randomness_reveal` instruction data into arguments
 * accepted by the generated Lootbox `settleOpen` builder.
 */
export function decodeSwitchboardReveal(data: Uint8Array): SwitchboardReveal {
	if (data.byteLength !== 105) {
		throw new RangeError(
			"Switchboard reveal data must contain exactly 105 bytes",
		);
	}

	for (const [index, byte] of SWITCHBOARD_REVEAL_DISCRIMINATOR.entries()) {
		if (data[index] !== byte) {
			throw new RangeError(
				"instruction is not a Switchboard randomness reveal",
			);
		}
	}

	return Object.freeze({
		signature: data.slice(8, 72),
		recoveryId: data[72] ?? 0,
		value: data.slice(73, 105),
	});
}
