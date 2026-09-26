import type { Color, FinishSlot } from "./art/model.ts";

/**
 * Render data for the chest finishes, indexed like the `finish` layer in
 * `layers.ts` (which holds names, descriptions, and weights).
 *
 * A finish is the chest's material: its palette, plus the glow and holographic
 * foil that belong to that material. Everything else a chest can wear lives in
 * its own layer.
 */

/** How loudly the Rive reveal celebrates a finish; each stage includes the ones below. */
export type RevealDrama =
	| "dust"
	| "glints"
	| "goldBurst"
	| "holoShimmer"
	| "cosmic";

export const REVEAL_DRAMA_ORDER: readonly RevealDrama[] = [
	"dust",
	"glints",
	"goldBurst",
	"holoShimmer",
	"cosmic",
];

export type FinishPalette = Readonly<Record<FinishSlot, Color>>;

export type Finish = Readonly<{
	/** The material, e.g. `Solid gold, ruby lock`. */
	material: string;
	palette: FinishPalette;
	/** Soft glow behind the chest, 0–1. */
	halo: number;
	/** Holographic foil over the chest, 0–1. */
	holo: number;
	drama: RevealDrama;
}>;

function palette(
	wood: Color,
	woodLight: Color,
	trim: Color,
	trimLight: Color,
	lock: Color,
	lockLight: Color,
	feet: Color,
	inside: Color,
	glow: Color,
): FinishPalette {
	const argb = (hex: Color) => `FF${hex}`;

	return {
		wood: argb(wood),
		woodLight: argb(woodLight),
		trim: argb(trim),
		trimLight: argb(trimLight),
		lock: argb(lock),
		lockLight: argb(lockLight),
		feet: argb(feet),
		inside: argb(inside),
		glow: argb(glow),
	};
}

type Row = readonly [
	material: string,
	colors: readonly [
		Color,
		Color,
		Color,
		Color,
		Color,
		Color,
		Color,
		Color,
		Color,
	],
	halo: number,
	holo: number,
	drama: RevealDrama,
];

const ROWS: readonly Row[] = [
	[
		"Teal paint on pine, brass straps",
		[
			"39AB9F",
			"9DE0C2",
			"F5C54E",
			"FFE5A0",
			"EF7869",
			"FFBE95",
			"B88339",
			"163A3A",
			"FFF1C2",
		],
		0,
		0,
		"dust",
	],
	[
		"Peach paint left too long on a porch",
		[
			"F0B79B",
			"FFE3D2",
			"D9C6A0",
			"F4EAD2",
			"7FB8C9",
			"CFE9F0",
			"A98A60",
			"5A3A33",
			"FFF4E0",
		],
		0,
		0,
		"dust",
	],
	[
		"Sea-soaked navy planks, verdigris fittings",
		[
			"2F5D7C",
			"8FC3D9",
			"6FB59B",
			"BFE8D6",
			"E8D5A8",
			"FFF6DD",
			"55745F",
			"132433",
			"CFF4FF",
		],
		0,
		0,
		"dust",
	],
	[
		"Mahogany with hammered copper bands",
		[
			"8C4A2F",
			"D9906A",
			"D9804A",
			"FFC49A",
			"3E8C7C",
			"9ED8C8",
			"5E3220",
			"2B1510",
			"FFD7B0",
		],
		0,
		0,
		"glints",
	],
	[
		"Brushed pewter, slate-blue lock",
		[
			"8B979C",
			"D5DEE1",
			"C9D1D4",
			"FFFFFF",
			"5B6D8A",
			"A9BCD9",
			"5A6468",
			"232A2E",
			"F2F7FA",
		],
		0,
		0,
		"glints",
	],
	[
		"Red lacquer, gilt corners, black lock",
		[
			"C8372D",
			"F59A7E",
			"F2C14E",
			"FFE9A8",
			"1F2B2E",
			"6A7A7E",
			"7A1F1A",
			"3A0F0C",
			"FFE2B8",
		],
		0,
		0,
		"glints",
	],
	[
		"Carved jade with gold and ivory",
		[
			"2E9E6B",
			"9DE8BF",
			"F2C14E",
			"FFEBB0",
			"F4F1E4",
			"FFFFFF",
			"1E6B48",
			"0E3325",
			"E8FFE0",
		],
		.35,
		0,
		"glints",
	],
	[
		"Ink-blue ebony with polished brass",
		[
			"26314A",
			"6E82B0",
			"E0AE4A",
			"FFE09A",
			"D9534A",
			"FF9B8C",
			"151B29",
			"0B0F18",
			"FFE7A8",
		],
		.45,
		0,
		"glints",
	],
	[
		"Beaten silver leaf, sapphire lock",
		[
			"C9D3DC",
			"FFFFFF",
			"8FA3B8",
			"E6EEF6",
			"4C7FD1",
			"A8C6F5",
			"7A8896",
			"2D3945",
			"EAF4FF",
		],
		.55,
		0,
		"glints",
	],
	[
		"Solid gold, ruby lock",
		[
			"F2C14E",
			"FFF0B3",
			"D98E2B",
			"FFD27A",
			"C23A3A",
			"FF8F87",
			"B07324",
			"5A3A0E",
			"FFE27A",
		],
		.7,
		0,
		"goldBurst",
	],
	[
		"Rose gold with a pearl lock",
		[
			"F2A7A0",
			"FFE0DB",
			"E8B96A",
			"FFE6B8",
			"F7F3EA",
			"FFFFFF",
			"C47A73",
			"5C2A2A",
			"FFD9D2",
		],
		.75,
		0,
		"goldBurst",
	],
	[
		"Opaline nacre, lilac trim",
		[
			"E6ECF0",
			"FFFFFF",
			"C8B6E2",
			"F1E9FF",
			"7FD1C8",
			"D2F5F0",
			"A9A2C0",
			"3A3550",
			"F4EEFF",
		],
		.8,
		.35,
		"holoShimmer",
	],
	[
		"Rainbow holographic foil, chrome trim",
		[
			"9FD6F0",
			"FFFFFF",
			"E6E9F2",
			"FFFFFF",
			"FF7BC5",
			"FFC6E6",
			"8A94B8",
			"1E2244",
			"C9F6FF",
		],
		.85,
		.75,
		"holoShimmer",
	],
	[
		"Obsidian with a gold corona",
		[
			"1B1B24",
			"55556B",
			"F5C54E",
			"FFF0B0",
			"F5F0E1",
			"FFFFFF",
			"0E0E14",
			"07070B",
			"FFC75A",
		],
		.9,
		0,
		"cosmic",
	],
	[
		"Violet stardust lacquer, cyan trim",
		[
			"3B2A6B",
			"A08BFF",
			"7FE3FF",
			"D9F8FF",
			"FF6FA8",
			"FFC2DA",
			"24184A",
			"0D0820",
			"C7A8FF",
		],
		.95,
		.5,
		"cosmic",
	],
	[
		"A chest so dense light won't leave it",
		[
			"0B0B12",
			"3A3A5A",
			"FF9F43",
			"FFE2B0",
			"FFFFFF",
			"FFFFFF",
			"050508",
			"000000",
			"FFB870",
		],
		1,
		0,
		"cosmic",
	],
];

export const FINISHES: readonly Finish[] = Object.freeze(
	ROWS.map(([material, colors, halo, holo, drama]): Finish =>
		Object.freeze({ material, palette: palette(...colors), halo, holo, drama })
	),
);

/** The finish at `index`, or a `RangeError`. */
export function finishAt(index: number): Finish {
	const finish = Number.isInteger(index) ? FINISHES[index] : undefined;

	if (!finish) {
		throw new RangeError(
			`finish must be an integer in 0..${FINISHES.length - 1}, got ${index}`,
		);
	}

	return finish;
}
