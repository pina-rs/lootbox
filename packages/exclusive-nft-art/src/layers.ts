/**
 * The Exclusive Lootbox NFT layer tables.
 *
 * An NFT is a vector of trait indices, one per layer, drawn bottom to top.
 * Each layer is rolled independently on-chain with the integer weights below,
 * so a trait's probability is `weight / layer total` and an NFT's rarity is the
 * product over its layers. The program stores these tables verbatim.
 *
 * **Append-only.** Once published, a layer's position and every trait's index
 * keep their meaning forever: new layers go on top, new traits go at the end,
 * and a retired trait keeps its slot (with weight 0 it still renders but is
 * never rolled). The `layers` golden test pins the published tables.
 */

export type Trait = Readonly<{
	/** The trait's stable index within its layer. */
	index: number;
	/** The value wallets show, e.g. `A Rubber Duck`. */
	name: string;
	/** One witty line for descriptions and catalog pages. */
	description: string;
	/** Relative on-chain weight, a u32; 0 retires a trait from new rolls. */
	weight: number;
}>;

export type LayerId =
	| "background"
	| "finish"
	| "pattern"
	| "lock"
	| "decoration"
	| "contents"
	| "effect";

export type Layer = Readonly<{
	/** The layer's stable position in the trait vector, bottom (0) to top. */
	index: number;
	id: LayerId;
	/** The attribute name wallets show, e.g. `Contents`. */
	name: string;
	traits: readonly Trait[];
	/** Sum of the layer's weights. */
	total: number;
}>;

/** The trait-vector format version; bump only with a new compatibility boundary. */
export const TRAIT_VECTOR_VERSION = 1;

/** Upper bounds the program's account layout reserves. */
export const MAX_LAYERS = 12;
export const MAX_TRAITS_PER_LAYER = 64;

type TraitRow = readonly [name: string, description: string, weight: number];

function layer(
	index: number,
	id: LayerId,
	name: string,
	rows: readonly TraitRow[],
): Layer {
	const traits = rows.map((
		[traitName, description, weight],
		traitIndex,
	): Trait =>
		Object.freeze({ index: traitIndex, name: traitName, description, weight })
	);

	return Object.freeze({
		index,
		id,
		name,
		traits: Object.freeze(traits),
		total: traits.reduce((sum, trait) => sum + trait.weight, 0),
	});
}

// Every layer's weights sum to 10,000, so a weight reads as hundredths of a
// percent: 250 is 2.5%.

const BACKGROUND = layer(0, "background", "Background", [
	[
		"Ivory Studio",
		"The house backdrop. Warm, calm, suspiciously well lit.",
		1800,
	],
	["Dusk", "Golden hour, sliding gently into navy hour.", 1000],
	["Open Sea", "Somewhere out there is the other sock.", 1000],
	["Bank Vault", "Very secure. Mostly securing this.", 500],
	["Meadow", "Grass, sky, and one cloud minding its own business.", 1000],
	["Starfield", "Space: big, dark, and still no refunds.", 400],
	["Attic", "Where chests go to be forgotten, and then found.", 900],
	["Blueprint", "Engineered to precise specifications of nothing.", 800],
	["Sunburst", "A retro halo for a modern disappointment.", 700],
	["Picnic Blanket", "Gingham. The ants are already on their way.", 900],
	["Deep Sea", "Bioluminescent and under a lot of pressure.", 600],
	["Velvet Curtain", "And now, for one night only: this.", 250],
	["Aurora", "The sky is doing more than the chest is.", 80],
	["Treasure Hoard", "Surrounded by gold. Contains none of it.", 50],
	["Inside a Bigger Chest", "It's chests all the way down.", 20],
]);

const FINISH = layer(1, "finish", "Finish", [
	[
		"Painted Pine",
		"The classic. Honest wood, honest paint, honestly nothing much.",
		2600,
	],
	[
		"Sunbleached",
		"Spent one summer too many in the window. Still smiling.",
		1600,
	],
	[
		"Barnacled",
		"Recovered from a shipwreck. The shipwreck wants it back.",
		1300,
	],
	["Copper Bottom", "Copper-bottomed guarantee: the bottom is copper.", 1000],
	[
		"Pewter Promise",
		"Looks like silver from across the room. Stay across the room.",
		800,
	],
	[
		"Cinnabar",
		"Seventeen coats of lacquer protecting absolutely nothing.",
		650,
	],
	["Jade Court", "Fit for an emperor's spare sock drawer.", 500],
	["Midnight Brass", "Opens only after dark. Also during the day.", 420],
	[
		"Silverleaf",
		"Every leaf hand-laid by someone with a very small brush.",
		350,
	],
	["Solid Gold", "Solid gold. The contents are not.", 260],
	["Rose Gilt", "Blushing, because it knows what it's holding.", 200],
	[
		"Mother of Pearl",
		"Grown slowly by a very patient oyster. Worth it? Ask the oyster.",
		140,
	],
	["Holofoil", "Tilt your phone. No, the other way. There it is.", 90],
	["Eclipse", "Do not look directly at the chest.", 50],
	["Nebula", "Contains trace amounts of the early universe. And a snail.", 30],
	[
		"Event Horizon",
		"A chest so dense light won't leave it. Neither will value.",
		10,
	],
]);

const PATTERN = layer(2, "pattern", "Pattern", [
	["Plain Planks", "Just wood. Refreshing, really.", 3000],
	["Woodgrain", "Every ring a year spent waiting to be opened.", 2200],
	[
		"Diamond Lattice",
		"Diamonds! Engraved ones. Please lower your expectations.",
		1400,
	],
	["Chevron", "Arrows pointing up. Morale, possibly.", 1200],
	["Rivets", "Held together by optimism and forty rivets.", 1000],
	["Scrollwork", "Fancy curls, courtesy of a very bored engraver.", 200],
	["Waves", "Carved at sea by a sailor with time on their hands.", 600],
	["Tally Marks", "Someone was counting the days until opening.", 400],
]);

const LOCK = layer(3, "lock", "Lock", [
	["Shield Latch", "The original latch, painted to match the chest.", 3000],
	["Padlock", "Heavy, honest, and guarding a sock.", 2000],
	["Combination Dial", "The combination is 0-0-0. It always was.", 1400],
	["Heart Lock", "Locked with love. Opens with a gentle shrug.", 1100],
	["Gear Lock", "Seven cogs, one purpose, zero payoff.", 900],
	["Star Lock", "You get a gold star for opening it.", 700],
	["Skull Lock", "Menacing. Smiles when nobody's looking.", 450],
	["Crystal Lock", "Grown in a cave for exactly this moment.", 250],
	["Keyhole Eye", "The keyhole looks back.", 120],
	["No Lock", "It was never locked. You could have just opened it.", 80],
]);

const DECORATION = layer(4, "decoration", "Decoration", [
	["None", "Unadorned, as nature and the chest-maker intended.", 4000],
	[
		"Stickers",
		"Collected from every gift shop between here and nowhere.",
		1200,
	],
	["Duct Tape", "Structural, probably.", 900],
	["Vines", "Left in the garden for one weekend.", 900],
	["Bunting", "Dressed for a party nobody told it about.", 800],
	["Barnacles", "Came back from the sea with friends.", 700],
	["Candles", "Mood lighting for an empty room.", 500],
	["Gems", "Paste, but very convincing paste.", 400],
	["Runes", "Say 'open sesame' in a language nobody speaks.", 250],
	["Crown Trim", "Royal edging for a very common chest.", 180],
	["Neon Strip", "Open 24 hours. Contents closed.", 120],
	["Googly Eyes", "The chest has seen things. Mostly moths.", 50],
]);

const CONTENTS = layer(5, "contents", "Contents", [
	["A Moth", "Something lived in here once. It is leaving now.", 950],
	["One Odd Sock", "Its partner is in another chest. Probably.", 900],
	["An IOU for 0 Shares", "Legally cheerful. Financially zero.", 500],
	[
		"A Cobweb, Tenant Included",
		"The spider pays no rent and considers this a win.",
		650,
	],
	["A Dust Bunny", "Rare breed. Sneezes on cue. Does not multiply. Yet.", 1000],
	["A Rubber Duck", "Squeaks once per viewing. Debugs nothing.", 600],
	["A Sold Out Tag", "Proof you were early to something already gone.", 450],
	["A Lost Button", "From a coat nobody remembers owning.", 750],
	["A Paper Crown", "Ruler of one empty box. Long may you reign.", 350],
	["A Snail", "Got here before you. Will leave after you.", 700],
	["A Crumpled Receipt", "Total: 0.00. Keep for your records.", 800],
	[
		"The Ghost of a Share Certificate",
		"Haunts portfolios. Harmless. Mostly.",
		100,
	],
	["An Echo", "…hello? …hello? …hello?", 400],
	[
		"A Tiny Crab",
		"Moved in. Won't move out. Walks sideways around the question.",
		350,
	],
	["A Message in a Bottle", 'It reads: "Help, I\'m stuck in a lootbox."', 250],
	["A Golden Ticket Stub (Void)", "Admit one. Admitted no one.", 50],
	[
		"A Pet Rock",
		"Low maintenance. Emotionally unavailable. Has a sprout.",
		550,
	],
	["A Key to Nothing", "Fits no lock. Opens no door. Extremely shiny.", 150],
	["A Jar of Fireflies", "A free night light. Bring your own night.", 200],
	["A Lucky Penny (Tails)", "Lucky, technically. Landed tails.", 300],
]);

const EFFECT = layer(6, "effect", "Effect", [
	["None", "Perfectly still. Suspiciously still.", 3500],
	["Dust Motes", "The air, doing its best impression of treasure.", 1400],
	["Glints", "Twinkles on a loop, for no reason at all.", 1100],
	["Butterflies", "The moth's glamorous cousins, visiting.", 800],
	["Fireflies", "Blink, blink, nothing inside, blink.", 700],
	["Confetti", "Celebrating something. Unclear what.", 600],
	["Bubbles", "Somebody left the bath running.", 500],
	["Snowfall", "A cosy little blizzard, indoors.", 450],
	["Gold Burst", "Rays of pure, unearned glory.", 350],
	["Holo Shimmer", "A rainbow sweeps past, just to be seen.", 250],
	["Lightning", "Dramatic weather for a dramatic nothing.", 150],
	["Orbit Ring", "Tiny moons with nowhere better to be.", 100],
	["Cosmic Particles", "Stardust, freshly unpacked.", 60],
	["Singularity", "Spacetime bends politely around the chest.", 40],
]);

/** Every layer, bottom to top. The array position is the layer index. */
export const LAYERS: readonly Layer[] = Object.freeze([
	BACKGROUND,
	FINISH,
	PATTERN,
	LOCK,
	DECORATION,
	CONTENTS,
	EFFECT,
]);

export const LAYER_COUNT = LAYERS.length;

/** Layer indices by id, so code reads `traits[LAYER.contents]`. */
export const LAYER: Readonly<Record<LayerId, number>> = Object.freeze(
	Object.fromEntries(LAYERS.map((item) => [item.id, item.index])) as Record<
		LayerId,
		number
	>,
);

/** A trait index per layer, bottom to top. */
export type TraitVector = readonly number[];

/** The versioned, serialisable form of a trait vector. */
export type VersionedTraits = Readonly<
	{ version: number; traits: TraitVector }
>;

/** The layer at `index`, or a `RangeError`. */
export function layerAt(index: number): Layer {
	const found = Number.isInteger(index) ? LAYERS[index] : undefined;

	if (!found) {
		throw new RangeError(
			`layer must be an integer in 0..${LAYER_COUNT - 1}, got ${index}`,
		);
	}

	return found;
}

/** The trait chosen on `layer`, or a `RangeError` naming the layer. */
export function traitOf(layerValue: Layer, index: number): Trait {
	const trait = Number.isInteger(index) ? layerValue.traits[index] : undefined;

	if (!trait) {
		throw new RangeError(
			`${layerValue.id} must be an integer in 0..${
				layerValue.traits.length - 1
			}, got ${index}`,
		);
	}

	return trait;
}

/**
 * Check a trait vector against the tables and resolve each trait.
 *
 * Throws a `RangeError` for a wrong length or any out-of-range index, so a
 * host can turn a bad URI into a 404 rather than draw a broken chest.
 */
export function resolveTraits(traits: TraitVector): readonly Trait[] {
	if (traits.length !== LAYER_COUNT) {
		throw new RangeError(
			`expected ${LAYER_COUNT} traits, got ${traits.length}`,
		);
	}

	return LAYERS.map((item) => traitOf(item, traits[item.index] ?? -1));
}

/** The short code `3-0-1-…`, handy in logs and URLs. */
export function traitCode(traits: TraitVector): string {
	return traits.join("-");
}

export function versionedTraits(traits: TraitVector): VersionedTraits {
	resolveTraits(traits);

	return { version: TRAIT_VECTOR_VERSION, traits: [...traits] };
}

/** Parse `{version, traits}`; `null` for any other version or shape. */
export function parseVersionedTraits(value: unknown): TraitVector | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const { version, traits } = value as Record<string, unknown>;

	if (version !== TRAIT_VECTOR_VERSION || !Array.isArray(traits)) {
		return null;
	}

	if (!traits.every((trait): trait is number => Number.isInteger(trait))) {
		return null;
	}

	try {
		resolveTraits(traits);
	} catch (error) {
		if (error instanceof RangeError) {
			return null;
		}

		throw error;
	}

	return traits;
}
