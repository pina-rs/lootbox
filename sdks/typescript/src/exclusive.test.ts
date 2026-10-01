import { type Address, address, getAddressDecoder } from "@solana/kit";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	deriveExclusiveTraits,
	encodeExclusiveLayer,
	EXCLUSIVE_TREE_SHAPE,
	exclusiveMintFeeEscrow,
	exclusiveName,
	exclusiveNftSeed,
	exclusiveTraits,
	exclusiveTreeSpace,
	exclusiveUri,
	validateExclusiveLayers,
} from "./exclusive.js";
import { createTemplatePlan } from "./templates.js";

type Vectors = Readonly<{
	seeds: readonly Readonly<{
		templateHex: string;
		openingHex: string;
		entropyHex: string;
		seedHex: string;
	}>[];
	draws: readonly Readonly<{
		label: string;
		seedHex: string;
		layers: readonly (readonly number[])[];
		traits: readonly number[];
		namePrefix: string;
		baseUri: string;
		serial: string;
		name: string;
		uri: string;
	}>[];
	planner: Readonly<{
		quantity: string;
		expectedMintFeeEscrowLamports: string;
	}>;
}>;

const vectors = JSON.parse(readFileSync(
	new URL("../../../tests/vectors/exclusive-nft.json", import.meta.url),
	"utf8",
)) as Vectors;

function bytes(hex: string): Uint8Array {
	return Uint8Array.from(
		hex.match(/../g) ?? [],
		(pair) => Number.parseInt(pair, 16),
	);
}

function addressOf(hex: string): Address {
	return getAddressDecoder().decode(bytes(hex));
}

function hex(value: Uint8Array): string {
	return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

describe("Exclusive Lootbox NFT derivation", () => {
	it("matches the shared seed vectors", async () => {
		for (const seed of vectors.seeds) {
			expect(
				hex(
					await exclusiveNftSeed(
						addressOf(seed.templateHex),
						addressOf(seed.openingHex),
						bytes(seed.entropyHex),
					),
				),
			).toBe(seed.seedHex);
		}
	});

	it("matches the shared per-layer trait, name, and URI vectors", async () => {
		for (const draw of vectors.draws) {
			const traits = await exclusiveTraits(bytes(draw.seedHex), draw.layers);
			expect(traits, draw.label).toEqual(draw.traits);
			const serial = BigInt(draw.serial);
			expect(exclusiveUri(draw.baseUri, traits, serial)).toBe(draw.uri);
			expect(exclusiveName(draw.namePrefix, serial)).toBe(draw.name);
		}
	});

	it("derives traits from the opening like the program", async () => {
		const [seed] = vectors.seeds;
		const draw = vectors.draws[0];
		if (!seed || !draw) throw new Error("missing vectors");
		const derived = await deriveExclusiveTraits(
			addressOf(seed.templateHex),
			addressOf(seed.openingHex),
			bytes(seed.entropyHex),
			draw.layers,
		);
		expect(hex(derived.seed)).toBe(seed.seedHex);
		expect(derived.traits).toEqual(draw.traits);
	});

	it("rejects layer tables the program rejects", () => {
		expect(() => validateExclusiveLayers([])).toThrow();
		expect(() => validateExclusiveLayers([[]])).toThrow();
		expect(() => validateExclusiveLayers([[0, 0]])).toThrow();
		expect(() => validateExclusiveLayers([[0xffff_ffff, 1]])).toThrow();
		expect(() => validateExclusiveLayers([Array(65).fill(1)])).toThrow();
		expect(() => validateExclusiveLayers(Array(13).fill([1]))).toThrow();
		expect(() => validateExclusiveLayers([[1, 0]])).not.toThrow();
		expect(() => exclusiveName("A".repeat(21), 9_999_999_999n)).toThrow();
		expect(Array.from(encodeExclusiveLayer([1, 0, 258]).slice(0, 12))).toEqual(
			[1, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0],
		);
	});

	it("sizes the default tree for ten-node transfer proofs", () => {
		expect(exclusiveTreeSpace(3, 8, 0)).toBe(1_304n);
		expect(EXCLUSIVE_TREE_SHAPE.space).toBe(109_752n);
		expect(
			EXCLUSIVE_TREE_SHAPE.maxDepth - EXCLUSIVE_TREE_SHAPE.canopyDepth,
		).toBe(10);
	});

	it("plans many attachments to one collection and their fee escrow", () => {
		const collection = address("LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E");
		const quantity = BigInt(vectors.planner.quantity);
		expect(exclusiveMintFeeEscrow(quantity)).toBe(
			BigInt(vectors.planner.expectedMintFeeEscrowLamports),
		);
		const plan = createTemplatePlan({
			name: "Consolation",
			bundles: [
				{
					label: "Exclusive plus SOL",
					quantity,
					assets: [
						{ kind: "exclusiveNft", collection },
						{ kind: "sol", lamports: 1_000n },
					],
				},
				{
					label: "Exclusive",
					quantity: 2n,
					assets: [{ kind: "exclusiveNft", collection }],
				},
			],
		});
		expect(plan.treasury).toContainEqual({
			asset: collection,
			amount: quantity + 2n,
			kind: "exclusiveNft",
		});
	});
});
