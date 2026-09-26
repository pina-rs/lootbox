import type { Color, FinishSlot } from "./art/model.ts";

/**
 * The sixteen Exclusive Lootbox NFT tiers.
 *
 * The program draws a tier on-chain from the opening's committed randomness
 * with default weight `2^(15 - k)`, so each tier is half as likely as the one
 * before it: tier 0 lands about every second opening and tier 15 about once in
 * 65,535. The tier sets the chest finish (its palette) and how much the chest
 * shows off (its effects and reveal drama).
 *
 * The ladder is a joke told in sixteen steps: the chest gets ever more
 * overdressed for what is, at best, a pet rock.
 */

export const TIER_COUNT = 16;

/** Sum of every default weight: `2^16 - 1`. */
export const TOTAL_TIER_WEIGHT = 2 ** TIER_COUNT - 1;

/**
 * How loudly a reveal celebrates. Each stage includes everything below it.
 *
 * - `dust`: the lid pops and dust puffs out.
 * - `glints`: star glints wink along the trim.
 * - `goldBurst`: a fan of gold rays bursts behind the chest.
 * - `holoShimmer`: a rainbow foil band sweeps across the chest.
 * - `cosmic`: orbiting particles, a ring, and a flash of starlight.
 */
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

/** Static effect strengths for the poster; all zero means a plain chest. */
export type TierEffects = Readonly<{
	/** Four-point star glints around the chest. */
	sparkles: number;
	/** Soft radial glow behind the chest, 0–1. */
	halo: number;
	/** Gold rays fanning out behind the chest; 0 for none. */
	rays: number;
	/** Rainbow foil over the chest, 0–1. */
	holo: number;
	/** Cosmic dressing: 1 corona ring, 2 adds an orbit of particles, 3 swaps the orbit for an accretion disk. */
	cosmos: 0 | 1 | 2 | 3;
}>;

export type TierPalette = Readonly<Record<FinishSlot, Color>>;

export type Tier = Readonly<{
	index: number;
	name: string;
	/** The chest finish, used as the `Finish` trait. */
	finish: string;
	/** One witty line for the metadata description. */
	line: string;
	palette: TierPalette;
	effects: TierEffects;
	drama: RevealDrama;
	/** Effects intensity, 0 (none) to 1 (everything). */
	intensity: number;
	/** Default weight, `2^(15 - index)`. */
	weight: number;
	/** Human odds under the default weights, e.g. `1 in 64`. */
	odds: string;
	/** Default probability, `weight / TOTAL_TIER_WEIGHT`. */
	probability: number;
}>;

type TierSeed = Omit<
	Tier,
	"index" | "weight" | "odds" | "probability" | "intensity"
>;

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
): TierPalette {
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

const NO_EFFECTS: TierEffects = {
	sparkles: 0,
	halo: 0,
	rays: 0,
	holo: 0,
	cosmos: 0,
};

const SEEDS: readonly TierSeed[] = [
	{
		name: "Painted Pine",
		finish: "Teal paint on pine, brass straps",
		line: "The classic. Honest wood, honest paint, honestly nothing much.",
		palette: palette(
			"39AB9F",
			"9DE0C2",
			"F5C54E",
			"FFE5A0",
			"EF7869",
			"FFBE95",
			"B88339",
			"163A3A",
			"FFF1C2",
		),
		effects: NO_EFFECTS,
		drama: "dust",
	},
	{
		name: "Sunbleached",
		finish: "Peach paint left too long on a porch",
		line: "Spent one summer too many in the window. Still smiling.",
		palette: palette(
			"F0B79B",
			"FFE3D2",
			"D9C6A0",
			"F4EAD2",
			"7FB8C9",
			"CFE9F0",
			"A98A60",
			"5A3A33",
			"FFF4E0",
		),
		effects: NO_EFFECTS,
		drama: "dust",
	},
	{
		name: "Barnacled",
		finish: "Sea-soaked navy planks, verdigris fittings",
		line: "Recovered from a shipwreck. The shipwreck wants it back.",
		palette: palette(
			"2F5D7C",
			"8FC3D9",
			"6FB59B",
			"BFE8D6",
			"E8D5A8",
			"FFF6DD",
			"55745F",
			"132433",
			"CFF4FF",
		),
		effects: NO_EFFECTS,
		drama: "dust",
	},
	{
		name: "Copper Bottom",
		finish: "Mahogany with hammered copper bands",
		line: "Copper-bottomed guarantee: the bottom is copper.",
		palette: palette(
			"8C4A2F",
			"D9906A",
			"D9804A",
			"FFC49A",
			"3E8C7C",
			"9ED8C8",
			"5E3220",
			"2B1510",
			"FFD7B0",
		),
		effects: { ...NO_EFFECTS, sparkles: 2 },
		drama: "glints",
	},
	{
		name: "Pewter Promise",
		finish: "Brushed pewter, slate-blue lock",
		line: "Looks like silver from across the room. Stay across the room.",
		palette: palette(
			"8B979C",
			"D5DEE1",
			"C9D1D4",
			"FFFFFF",
			"5B6D8A",
			"A9BCD9",
			"5A6468",
			"232A2E",
			"F2F7FA",
		),
		effects: { ...NO_EFFECTS, sparkles: 3 },
		drama: "glints",
	},
	{
		name: "Cinnabar",
		finish: "Red lacquer, gilt corners, black lock",
		line: "Seventeen coats of lacquer protecting absolutely nothing.",
		palette: palette(
			"C8372D",
			"F59A7E",
			"F2C14E",
			"FFE9A8",
			"1F2B2E",
			"6A7A7E",
			"7A1F1A",
			"3A0F0C",
			"FFE2B8",
		),
		effects: { ...NO_EFFECTS, sparkles: 4 },
		drama: "glints",
	},
	{
		name: "Jade Court",
		finish: "Carved jade with gold and ivory",
		line: "Fit for an emperor's spare sock drawer.",
		palette: palette(
			"2E9E6B",
			"9DE8BF",
			"F2C14E",
			"FFEBB0",
			"F4F1E4",
			"FFFFFF",
			"1E6B48",
			"0E3325",
			"E8FFE0",
		),
		effects: { ...NO_EFFECTS, sparkles: 5, halo: .35 },
		drama: "glints",
	},
	{
		name: "Midnight Brass",
		finish: "Ink-blue ebony with polished brass",
		line: "Opens only after dark. Also during the day.",
		palette: palette(
			"26314A",
			"6E82B0",
			"E0AE4A",
			"FFE09A",
			"D9534A",
			"FF9B8C",
			"151B29",
			"0B0F18",
			"FFE7A8",
		),
		effects: { ...NO_EFFECTS, sparkles: 6, halo: .45 },
		drama: "glints",
	},
	{
		name: "Silverleaf",
		finish: "Beaten silver leaf, sapphire lock",
		line: "Every leaf hand-laid by someone with a very small brush.",
		palette: palette(
			"C9D3DC",
			"FFFFFF",
			"8FA3B8",
			"E6EEF6",
			"4C7FD1",
			"A8C6F5",
			"7A8896",
			"2D3945",
			"EAF4FF",
		),
		effects: { ...NO_EFFECTS, sparkles: 7, halo: .55 },
		drama: "glints",
	},
	{
		name: "Solid Gold",
		finish: "Solid gold, ruby lock",
		line: "Solid gold. The contents are not.",
		palette: palette(
			"F2C14E",
			"FFF0B3",
			"D98E2B",
			"FFD27A",
			"C23A3A",
			"FF8F87",
			"B07324",
			"5A3A0E",
			"FFE27A",
		),
		effects: { ...NO_EFFECTS, sparkles: 8, halo: .7, rays: 12 },
		drama: "goldBurst",
	},
	{
		name: "Rose Gilt",
		finish: "Rose gold with a pearl lock",
		line: "Blushing, because it knows what it's holding.",
		palette: palette(
			"F2A7A0",
			"FFE0DB",
			"E8B96A",
			"FFE6B8",
			"F7F3EA",
			"FFFFFF",
			"C47A73",
			"5C2A2A",
			"FFD9D2",
		),
		effects: { ...NO_EFFECTS, sparkles: 9, halo: .75, rays: 14 },
		drama: "goldBurst",
	},
	{
		name: "Mother of Pearl",
		finish: "Opaline nacre, lilac trim",
		line: "Grown slowly by a very patient oyster. Worth it? Ask the oyster.",
		palette: palette(
			"E6ECF0",
			"FFFFFF",
			"C8B6E2",
			"F1E9FF",
			"7FD1C8",
			"D2F5F0",
			"A9A2C0",
			"3A3550",
			"F4EEFF",
		),
		effects: { ...NO_EFFECTS, sparkles: 10, halo: .8, rays: 16, holo: .35 },
		drama: "holoShimmer",
	},
	{
		name: "Holofoil",
		finish: "Rainbow holographic foil, chrome trim",
		line: "Tilt your phone. No, the other way. There it is.",
		palette: palette(
			"9FD6F0",
			"FFFFFF",
			"E6E9F2",
			"FFFFFF",
			"FF7BC5",
			"FFC6E6",
			"8A94B8",
			"1E2244",
			"C9F6FF",
		),
		effects: { ...NO_EFFECTS, sparkles: 12, halo: .85, rays: 16, holo: .75 },
		drama: "holoShimmer",
	},
	{
		name: "Eclipse",
		finish: "Obsidian with a gold corona",
		line: "Do not look directly at the chest.",
		palette: palette(
			"1B1B24",
			"55556B",
			"F5C54E",
			"FFF0B0",
			"F5F0E1",
			"FFFFFF",
			"0E0E14",
			"07070B",
			"FFC75A",
		),
		effects: { sparkles: 12, halo: .9, rays: 20, holo: 0, cosmos: 1 },
		drama: "cosmic",
	},
	{
		name: "Nebula",
		finish: "Violet stardust lacquer, cyan trim",
		line: "Contains trace amounts of the early universe. And a snail.",
		palette: palette(
			"3B2A6B",
			"A08BFF",
			"7FE3FF",
			"D9F8FF",
			"FF6FA8",
			"FFC2DA",
			"24184A",
			"0D0820",
			"C7A8FF",
		),
		effects: { sparkles: 14, halo: .95, rays: 0, holo: .5, cosmos: 2 },
		drama: "cosmic",
	},
	{
		name: "Event Horizon",
		finish: "A chest so dense light won't leave it",
		line: "One in 65,535. Nothing escapes it. Least of all value.",
		palette: palette(
			"0B0B12",
			"3A3A5A",
			"FF9F43",
			"FFE2B0",
			"FFFFFF",
			"FFFFFF",
			"050508",
			"000000",
			"FFB870",
		),
		effects: { sparkles: 16, halo: 1, rays: 0, holo: 0, cosmos: 3 },
		drama: "cosmic",
	},
];

/** Default on-chain weight for tier `index`: `2^(15 - index)`. */
export function tierWeight(index: number): number {
	return 2 ** (TIER_COUNT - 1 - index);
}

/** `1 in 1,024`-style odds for a probability. */
export function formatOdds(probability: number): string {
	return `1 in ${Math.round(1 / probability).toLocaleString("en-US")}`;
}

export const TIERS: readonly Tier[] = Object.freeze(
	SEEDS.map((seed, index): Tier => {
		const weight = tierWeight(index);
		const probability = weight / TOTAL_TIER_WEIGHT;

		return Object.freeze({
			...seed,
			index,
			weight,
			probability,
			odds: formatOdds(probability),
			intensity: index / (TIER_COUNT - 1),
		});
	}),
);

/** The tier at `index`, or a `RangeError` for anything outside 0–15. */
export function tierAt(index: number): Tier {
	const tier = Number.isInteger(index) ? TIERS[index] : undefined;

	if (!tier) {
		throw new RangeError(
			`tier must be an integer in 0..${TIER_COUNT - 1}, got ${index}`,
		);
	}

	return tier;
}
