/**
 * The lootbox palette. It is sampled from the cartoon chest renders, so the
 * logo, the site, and the reveal animations read as one world: warm ivory
 * paper, heavy warm-black ink, a teal chest with gold bands, and a coral lock.
 */
export const palette = {
	/** Page background; also the chest renders' own backdrop. */
	ivory: "#f3edda",
	/** Raised surfaces on ivory. */
	paper: "#fbf8ee",
	/** Eye whites and highlights. Slightly warm so it never glares. */
	white: "#fffdf7",
	/** Every outline and all body text. */
	ink: "#1d1a14",
	/** Chest wood. */
	teal: "#34a898",
	/** Chest wood in cel shadow. */
	tealShade: "#23867a",
	/** Deep teal for type on ivory and for reversed backgrounds. */
	tealDeep: "#146f63",
	/** The dark inside of the chest, where the eyes are. */
	inside: "#12302e",
	/** Bands, straps, sparkles. */
	gold: "#f0b429",
	/** Gold in cel shadow; the chest's feet. */
	goldShade: "#c98a14",
	/** Glints on gold and paint. */
	goldLight: "#fbe29a",
	/** The lock plate. */
	coral: "#ef7564",
	/** The lock plate in cel shadow. */
	coralShade: "#c9544b",
} as const;

export type PaletteColor = keyof typeof palette;

/**
 * Typefaces. Bungee (SIL OFL 1.1) carries identity: the wordmark is drawn
 * from its outlines, and headings use it. Nunito carries reading.
 */
export const typefaces = {
	display: `"Bungee", "Arial Black", sans-serif`,
	body: `"Nunito Variable", "Nunito", "Trebuchet MS", sans-serif`,
} as const;
