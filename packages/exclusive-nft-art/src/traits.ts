/**
 * Trait catalogs for Exclusive Lootbox NFTs: what is inside, what is behind,
 * and what is carved into the wood.
 *
 * Indices are the on-chain values in the metadata URI
 * `{base}{tier}-{contents}-{background}-{pattern}-{serial}.json`. They are
 * append-only: once a series is minted, reordering or removing an entry would
 * change the art behind existing URIs.
 */

export type Trait = Readonly<{
	index: number;
	/** The trait value shown by wallets, e.g. `A Rubber Duck`. */
	name: string;
	/** One witty line for the metadata description. */
	line: string;
}>;

/** Contents are designed to grow to this many without changing the layout. */
export const MAX_CONTENTS = 32;

function catalog(
	entries: readonly (readonly [name: string, line: string])[],
): readonly Trait[] {
	return Object.freeze(
		entries.map(([name, line], index): Trait =>
			Object.freeze({ index, name, line })
		),
	);
}

/** The thing inside. The first thirteen match the Empty Chest series. */
export const CONTENTS: readonly Trait[] = catalog([
	["A Moth", "Something lived in here once. It is leaving now."],
	["One Odd Sock", "Its partner is in another chest. Probably."],
	["An IOU for 0 Shares", "Legally cheerful. Financially zero."],
	[
		"A Cobweb, Tenant Included",
		"The spider pays no rent and considers this a win.",
	],
	["A Dust Bunny", "Rare breed. Sneezes on cue. Does not multiply. Yet."],
	["A Rubber Duck", "Squeaks once per viewing. Debugs nothing."],
	["A Sold Out Tag", "Proof you were early to something already gone."],
	["A Lost Button", "From a coat nobody remembers owning."],
	["A Paper Crown", "Ruler of one empty box. Long may you reign."],
	["A Snail", "Got here before you. Will leave after you."],
	["A Crumpled Receipt", "Total: 0.00. Keep for your records."],
	["The Ghost of a Share Certificate", "Haunts portfolios. Harmless. Mostly."],
	["An Echo", "…hello? …hello? …hello?"],
	[
		"A Tiny Crab",
		"Moved in. Won't move out. Walks sideways around the question.",
	],
	["A Message in a Bottle", 'It reads: "Help, I\'m stuck in a lootbox."'],
	["A Golden Ticket Stub (Void)", "Admit one. Admitted no one."],
	["A Pet Rock", "Low maintenance. Emotionally unavailable. Has a sprout."],
	["A Key to Nothing", "Fits no lock. Opens no door. Extremely shiny."],
	["A Jar of Fireflies", "A free night light. Bring your own night."],
	["A Lucky Penny (Tails)", "Lucky, technically. Landed tails."],
]);

/** The backdrop behind the chest. */
export const BACKGROUNDS: readonly Trait[] = catalog([
	["Ivory Studio", "The house backdrop. Warm, calm, suspiciously well lit."],
	["Dusk", "Golden hour, sliding gently into navy hour."],
	["Open Sea", "Somewhere out there is the other sock."],
	["Bank Vault", "Very secure. Mostly securing this."],
	["Meadow", "Grass, sky, and one cloud minding its own business."],
	["Starfield", "Space: big, dark, and still no refunds."],
	["Attic", "Where chests go to be forgotten, and then found."],
	["Blueprint", "Engineered to precise specifications of nothing."],
	["Sunburst", "A retro halo for a modern disappointment."],
	["Picnic Blanket", "Gingham. The ants are already on their way."],
	["Deep Sea", "Bioluminescent and under a lot of pressure."],
	["Velvet Curtain", "And now, for one night only: this."],
]);

/** The engraving cut into the chest's wood. */
export const PATTERNS: readonly Trait[] = catalog([
	["Plain Planks", "Just wood. Refreshing, really."],
	["Woodgrain", "Every ring a year spent waiting to be opened."],
	[
		"Diamond Lattice",
		"Diamonds! Engraved ones. Please lower your expectations.",
	],
	["Chevron", "Arrows pointing up. Morale, possibly."],
	["Rivets", "Held together by optimism and forty rivets."],
	["Scrollwork", "Fancy curls, courtesy of a very bored engraver."],
	["Waves", "Carved at sea by a sailor with time on their hands."],
	["Tally Marks", "Someone was counting the days until opening."],
]);

/** The trait at `index`, or a `RangeError` naming the field. */
export function traitAt(
	list: readonly Trait[],
	index: number,
	field: string,
): Trait {
	const trait = Number.isInteger(index) ? list[index] : undefined;

	if (!trait) {
		throw new RangeError(
			`${field} must be an integer in 0..${list.length - 1}, got ${index}`,
		);
	}

	return trait;
}
