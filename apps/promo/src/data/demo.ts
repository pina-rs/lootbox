/**
 * The lootbox every video builds: "Summer Drop", 20 boxes. One box wins a
 * whole SOL; everyone else still gets something.
 */
import type { OddsTone } from "@pina-rs/lootbox-ui";

export type PrizeKind = "sol" | "bonk" | "stock" | "nft";

export type DemoBundle = Readonly<{
	key: string;
	label: string;
	prize: string;
	/** Per-box value shown under the prize, as the site does. */
	value: string;
	kind: PrizeKind;
	boxes: number;
	tone: OddsTone;
}>;

/** The colours behind each odds tone, for drawing outside the odds strip. */
export const TONE_COLORS: Record<OddsTone, string> = {
	gold: "var(--gold)",
	teal: "var(--teal-bright)",
	lock: "var(--lock)",
	plum: "#9a74c9",
	sky: "var(--sky)",
	ivory: "var(--ivory-deep)",
};

export const DEMO_TITLE = "Summer Drop";
export const DEMO_SLUG = "summer-drop";
export const DEMO_URL = `lootbox.pina.rs/l/${DEMO_SLUG}`;

export const DEMO_BUNDLES: readonly DemoBundle[] = [
	{
		key: "grand",
		label: "Grand prize",
		prize: "1 SOL",
		value: "≈ $152 per box",
		kind: "sol",
		boxes: 1,
		tone: "gold",
	},
	{
		key: "bonk",
		label: "Bonk bag",
		prize: "1,000,000 BONK",
		value: "≈ $21 per box",
		kind: "bonk",
		boxes: 9,
		tone: "teal",
	},
	{
		key: "stock",
		label: "Stock slice",
		prize: "$25 in stock tokens",
		value: "Tokens that track a share price",
		kind: "stock",
		boxes: 5,
		tone: "lock",
	},
	{
		key: "exclusive",
		label: "Everyone else",
		prize: "Exclusive Lootbox NFT",
		value: "A collectible with its own rarity",
		kind: "nft",
		boxes: 5,
		tone: "plum",
	},
];

export const DEMO_BOXES = DEMO_BUNDLES.reduce(
	(sum, bundle) => sum + bundle.boxes,
	0,
);

/** The demo curve: 20 boxes from 0.01 to 0.05 SOL with a 1% fee. */
export const DEMO_CURVE = {
	inventory: 20,
	startPrice: 10_000_000,
	priceStep: 2_105_263,
	feeBps: 100,
} as const;

/** Wallets in the airdrop list, with a colour each for their avatar. */
export const DEMO_WALLETS = [
	{ address: "7xKX…q9Fm", color: "var(--gold)" },
	{ address: "4nAk…TJV8", color: "var(--teal-bright)" },
	{ address: "9pQe…3sLb", color: "var(--lock)" },
	{ address: "Fhv1…AcXv", color: "var(--sky)" },
	{ address: "2mRt…8wZk", color: "#9a74c9" },
	{ address: "Bq7d…Uu2p", color: "var(--gold)" },
	{ address: "6Yhn…kP0e", color: "var(--teal-bright)" },
	{ address: "C3vo…M1rX", color: "var(--lock)" },
	{ address: "8Lsa…Qe4n", color: "var(--sky)" },
	{ address: "5Wzi…7dTq", color: "#9a74c9" },
] as const;
