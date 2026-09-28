/**
 * The three on-camera scripts in `talk/SCRIPTS.md`, as edit cues: when each
 * line is said and which animated insert covers it. Times are seconds from
 * the first word. When a real recording arrives, retime these to the take.
 */

export type Insert =
	| "lock"
	| "builder"
	| "odds"
	| "ways"
	| "airdrop"
	| "curve"
	| "collectibles"
	| "open"
	| "copies"
	| "stairs"
	| "end";

export type Cue = Readonly<{ from: number; to: number }>;

export type ScriptCut = Readonly<{
	id: "A" | "B" | "C";
	title: string;
	shape: "wide" | "tall";
	seconds: number;
	captions: readonly (Cue & Readonly<{ text: string }>)[];
	inserts: readonly (Cue & Readonly<{ insert: Insert }>)[];
}>;

export const SCRIPT_CUTS: readonly ScriptCut[] = [
	{
		id: "A",
		title: "The hook",
		shape: "tall",
		seconds: 15,
		captions: [
			{ from: 0, to: 3, text: "I built a way to put real prizes inside a box" },
			{ from: 3, to: 7, text: "Locked on chain before anyone opens one" },
			{
				from: 7,
				to: 11,
				text: "Send them to friends, or sell them on a curve",
			},
			{ from: 11, to: 13, text: "Hold the chest. See what's inside." },
		],
		inserts: [
			{ from: 3, to: 7, insert: "lock" },
			{ from: 7, to: 9, insert: "copies" },
			{ from: 9, to: 11, insert: "stairs" },
			{ from: 11, to: 13, insert: "open" },
			{ from: 13, to: 15, insert: "end" },
		],
	},
	{
		id: "B",
		title: "Why I built lootbox",
		shape: "wide",
		seconds: 56,
		captions: [
			{ from: 0, to: 3, text: "Everyone loves opening a lootbox." },
			{ from: 3, to: 6, text: "Nobody trusts what's inside one." },
			{ from: 6, to: 9, text: "So I built lootbox.so" },
			{ from: 9, to: 12, text: "You fill a box with real prizes" },
			{ from: 12, to: 14, text: "Every prize is locked on chain" },
			{ from: 14, to: 16, text: "before anyone opens a box" },
			{ from: 16, to: 18.5, text: "One box is one ticket." },
			{ from: 18.5, to: 21, text: "The odds are the prizes you put in." },
			{ from: 21, to: 26, text: "Not even I can pick the winner." },
			{ from: 26, to: 33, text: "Airdrop to a list. You cover the fees." },
			{ from: 33, to: 36, text: "Or put them on a curve" },
			{ from: 36, to: 40, text: "People can sell back until it sells out" },
			{ from: 40, to: 43, text: "Not the big one?" },
			{ from: 43, to: 48, text: "You still get an Exclusive Lootbox NFT" },
			{ from: 48, to: 52, text: "It's live at lootbox.so" },
		],
		inserts: [
			{ from: 6, to: 16, insert: "builder" },
			{ from: 16, to: 21, insert: "odds" },
			{ from: 21, to: 26, insert: "lock" },
			{ from: 26, to: 33, insert: "airdrop" },
			{ from: 33, to: 40, insert: "curve" },
			{ from: 40, to: 48, insert: "collectibles" },
			{ from: 52, to: 56, insert: "end" },
		],
	},
	{
		id: "C",
		title: "I'm giving away 1 SOL",
		shape: "tall",
		seconds: 30,
		captions: [
			{ from: 0, to: 3, text: "I just put 1 SOL in a lootbox." },
			{ from: 3, to: 8, text: "20 boxes. One has the SOL." },
			{ from: 8, to: 14, text: "Every prize is already locked on chain" },
			{
				from: 14,
				to: 20,
				text: "Reply with your wallet and I'll airdrop you a box. Free.",
			},
			{ from: 20, to: 26, text: "On Friday, everyone holds their chest" },
			{ from: 26, to: 28, text: "Links below" },
		],
		inserts: [
			{ from: 3, to: 8, insert: "collectibles" },
			{ from: 8, to: 14, insert: "lock" },
			{ from: 14, to: 20, insert: "copies" },
			{ from: 20, to: 26, insert: "open" },
			{ from: 26, to: 30, insert: "end" },
		],
	},
];
