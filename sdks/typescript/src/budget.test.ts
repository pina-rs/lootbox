import * as generated from "@pina-rs/lootbox-program-client";
import { address, type Instruction } from "@solana/kit";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	classifyInstructionCost,
	COMPUTE_UNIT_MARGIN_ADDEND,
	COMPUTE_UNIT_MARGIN_MULTIPLIER,
	COMPUTE_UNIT_MAXIMUM,
	COMPUTE_UNIT_MINIMUM,
	computeUnitLimitByNames,
	lootboxComputeUnitLimit,
	MEASURED_COMPUTE_UNITS,
} from "./budget.js";

const vectors = JSON.parse(
	readFileSync(
		new URL("../../../tests/vectors/compute-units.json", import.meta.url),
		"utf8",
	),
) as {
	policy: {
		addend: number;
		maximum: number;
		minimum: number;
		multiplier: number;
	};
	instructions: Record<string, number>;
	cases: ReadonlyArray<{
		instructions: string[];
		expectedLimit: number | null;
	}>;
};

const LOOTBOX = generated.LOOTBOX_PROGRAM_PROGRAM_ADDRESS;
const COMPUTE_BUDGET = address("ComputeBudget111111111111111111111111111111");

/** A minimal lootbox instruction carrying one instruction discriminator. */
function lootboxInstruction(name: string): Instruction {
	const constant = name.replace(/([A-Z])/g, "_$1").toUpperCase() +
		"_DISCRIMINATOR";
	const discriminator = Reflect.get(generated, constant);

	if (typeof discriminator !== "number") {
		throw new Error(`missing generated discriminator ${constant}`);
	}

	return {
		programAddress: LOOTBOX,
		data: new Uint8Array([discriminator, 0]),
		accounts: [],
	} as unknown as Instruction;
}

describe("compute unit budgets", () => {
	it("matches the shared vector table", () => {
		expect(MEASURED_COMPUTE_UNITS).toEqual(vectors.instructions);
		expect(COMPUTE_UNIT_MARGIN_MULTIPLIER).toBe(vectors.policy.multiplier);
		expect(COMPUTE_UNIT_MARGIN_ADDEND).toBe(vectors.policy.addend);
		expect(COMPUTE_UNIT_MINIMUM).toBe(vectors.policy.minimum);
		expect(COMPUTE_UNIT_MAXIMUM).toBe(vectors.policy.maximum);
	});

	it("recognizes every measured instruction by its discriminator", () => {
		for (const [name, units] of Object.entries(vectors.instructions)) {
			expect(classifyInstructionCost(lootboxInstruction(name))).toEqual({
				kind: "measured",
				name,
				units,
			});
		}
	});

	it("computes the vector limits from instruction names", () => {
		for (const vector of vectors.cases) {
			expect(computeUnitLimitByNames(vector.instructions)).toBe(
				vector.expectedLimit,
			);
		}
	});

	it("computes the same limits from built instructions", () => {
		for (const vector of vectors.cases) {
			if (vector.expectedLimit === null) continue;

			const instructions = vector.instructions.map(lootboxInstruction);

			expect(lootboxComputeUnitLimit(instructions)).toBe(
				vector.expectedLimit,
			);
		}
	});

	it("skips compute budget instructions", () => {
		const budgetInstruction = {
			programAddress: COMPUTE_BUDGET,
			data: new Uint8Array([2, 100, 0, 0, 0]),
			accounts: [],
		} as unknown as Instruction;
		const limit = lootboxComputeUnitLimit([
			budgetInstruction,
			lootboxInstruction("fulfillTemplateOpen"),
		]);

		expect(limit).toBe(computeUnitLimitByNames(["fulfillTemplateOpen"]));
	});

	it("refuses a budget for unknown or foreign instructions", () => {
		const used = new Set(
			Object.keys(vectors.instructions).map((name) => {
				const constant = name.replace(/([A-Z])/g, "_$1").toUpperCase() +
					"_DISCRIMINATOR";

				return Reflect.get(generated, constant) as number;
			}),
		);
		const unused = [...Array(256).keys()].find((byte) => !used.has(byte)) ??
			250;
		const unknownInstruction = {
			programAddress: LOOTBOX,
			data: new Uint8Array([unused, 0]),
			accounts: [],
		} as unknown as Instruction;
		const foreignInstruction = {
			programAddress: address("11111111111111111111111111111111"),
			data: new Uint8Array(),
			accounts: [],
		} as unknown as Instruction;

		expect(classifyInstructionCost(unknownInstruction)).toEqual({
			kind: "unknown",
		});
		expect(classifyInstructionCost(foreignInstruction)).toEqual({
			kind: "unknown",
		});
		expect(lootboxComputeUnitLimit([unknownInstruction])).toBeNull();
		expect(lootboxComputeUnitLimit([foreignInstruction])).toBeNull();
		expect(
			lootboxComputeUnitLimit([
				lootboxInstruction("sealTemplate"),
				foreignInstruction,
			]),
		).toBeNull();
		expect(lootboxComputeUnitLimit([])).toBeNull();
	});

	it("treats empty lootbox instruction data as unknown", () => {
		const emptyData = {
			programAddress: LOOTBOX,
			data: new Uint8Array(),
			accounts: [],
		} as unknown as Instruction;

		expect(classifyInstructionCost(emptyData)).toEqual({ kind: "unknown" });
		expect(lootboxComputeUnitLimit([emptyData])).toBeNull();
	});
});
