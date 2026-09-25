import { readFileSync, writeFileSync } from "node:fs";

// Generates the marked thing, dust, motion, and state machine sections. The
// chest silhouette, lid, lock, and view model stay hand-authored in scene.rml.
const source = new URL("./scene.rml", import.meta.url);
let scene = readFileSync(source, "utf8");

const ink = "FF243D40";
const paper = "FFFBF8EE";
const ivory = "FFF3EDDA";
const gold = "FFF5C54E";
const coral = "FFEF7869";
const deepCoral = "FFD9534A";
const teal = "FF39AB9F";
const dust = "FFE3D8BC";

const X = 13;
const Y = 14;
const ROTATION = 15;
const SCALE_X = 16;
const SCALE_Y = 17;
const OPACITY = 18;

/** Frames at 30 fps. The idle loop is four seconds. */
const IDLE_FRAMES = 120;
const REVEAL_FRAMES = 84;
/** Every variant acts inside this window, starting and ending hidden. */
const ACTION_FRAMES = 50;
const IDLE_ACTION_START = 36;
const REVEAL_ACTION_START = 9;
const LID_LIFT = 42;
const LID_Y = -183;
const LOCK_Y = -173;

type Point = readonly [number, number];
type Ease = "ease" | "out" | "in" | "linear" | "hold";
type Key = readonly [frame: number, value: number, ease?: Ease];
type Track = Readonly<{ id: number; property: number; keys: readonly Key[] }>;
type Variant = Readonly<{ art: string; action: readonly Track[] }>;

const round = (value: number) => Number(value.toFixed(3));

function section(name: string, contents: string) {
	const start = `<!-- ${name}:start -->`;
	const end = `<!-- ${name}:end -->`;

	if (!scene.includes(start) || !scene.includes(end)) {
		throw new Error(`Missing RML section: ${name}`);
	}

	const before = scene.slice(0, scene.indexOf(start) + start.length);
	const after = scene.slice(scene.indexOf(end));
	scene = `${before}\n${contents}\n      ${after}`;
}

// ---------------------------------------------------------------------------
// Drawing helpers. The first sibling draws on top, so art lists foreground first.

function poly(points: readonly Point[], closed = true, radius = 0) {
	return `<PointsPath isClosed="${closed}">${
		points.map(([x, y]) =>
			`<StraightVertex x="${round(x)}" y="${round(y)}"${
				radius ? ` radius="${radius}"` : ""
			}/>`
		).join("")
	}</PointsPath>`;
}

function ellipse(x: number, y: number, width: number, height: number) {
	return `<Ellipse x="${x}" y="${y}" width="${width}" height="${height}"/>`;
}

function rect(x: number, y: number, width: number, height: number, radius = 0) {
	return `<Rectangle x="${x}" y="${y}" width="${width}" height="${height}" cornerRadiusTL="${radius}"/>`;
}

function shape(
	name: string,
	geometry: string,
	fill?: string,
	strokeWidth = 3.5,
	strokeColor = ink,
) {
	const fillPaint = fill
		? `<Fill><SolidColor colorValue="${fill}"/></Fill>`
		: "";
	const strokePaint = strokeWidth > 0
		? `<Stroke thickness="${strokeWidth}" cap="round" join="round"><SolidColor colorValue="${strokeColor}"/></Stroke>`
		: "";

	return `<Shape name="${name}">${geometry}${fillPaint}${strokePaint}</Shape>`;
}

function line(name: string, points: readonly Point[], color = ink, width = 2) {
	return shape(name, poly(points, false), undefined, width, color);
}

function group(
	name: string,
	id: number | null,
	attributes: Readonly<Record<string, number>>,
	children: readonly string[],
) {
	const attrs = Object.entries(attributes).map(([key, value]) =>
		` ${key}="${round(value)}"`
	).join("");

	return `<Node name="${name}"${id === null ? "" : ` id="0:${id}"`}${attrs}>${
		children.join("")
	}</Node>`;
}

// A tiny hand-inked stroke font, so lettering needs no embedded font asset.
// Glyphs sit in a box one unit tall; y grows downward.
type Glyph = Readonly<
	{ width: number; strokes: readonly (readonly Point[])[] }
>;
const oval: readonly Point[] = [
	[.2, 0],
	[.42, 0],
	[.62, .25],
	[.62, .75],
	[.42, 1],
	[.2, 1],
	[0, .75],
	[0, .25],
	[.2, 0],
];
const glyphs: Readonly<Record<string, Glyph>> = {
	A: {
		width: .62,
		strokes: [[[0, 1], [.31, 0], [.62, 1]], [[.13, .64], [.49, .64]]],
	},
	D: {
		width: .6,
		strokes: [[[0, 0], [0, 1], [.32, 1], [.6, .72], [.6, .28], [.32, 0], [
			0,
			0,
		]]],
	},
	E: {
		width: .52,
		strokes: [[[.52, 0], [0, 0], [0, 1], [.52, 1]], [[0, .5], [.4, .5]]],
	},
	H: {
		width: .6,
		strokes: [[[0, 0], [0, 1]], [[.6, 0], [.6, 1]], [[0, .5], [.6, .5]]],
	},
	I: {
		width: .44,
		strokes: [[[.22, 0], [.22, 1]], [[0, 0], [.44, 0]], [[0, 1], [.44, 1]]],
	},
	L: { width: .5, strokes: [[[0, 0], [0, 1], [.5, 1]]] },
	O: { width: .62, strokes: [oval] },
	R: {
		width: .6,
		strokes: [[[0, 1], [0, 0], [.42, 0], [.6, .16], [.6, .34], [.42, .5], [
			0,
			.5,
		]], [[.28, .5], [.6, 1]]],
	},
	S: {
		width: .58,
		strokes: [[
			[.56, .12],
			[.42, 0],
			[.14, 0],
			[0, .14],
			[0, .34],
			[.14, .47],
			[.44, .53],
			[.58, .66],
			[.58, .86],
			[.44, 1],
			[.14, 1],
			[0, .88],
		]],
	},
	T: { width: .6, strokes: [[[0, 0], [.6, 0]], [[.3, 0], [.3, 1]]] },
	U: {
		width: .6,
		strokes: [[[0, 0], [0, .76], [.2, 1], [.4, 1], [.6, .76], [.6, 0]]],
	},
	"0": {
		width: .54,
		strokes: [oval.map(([x, y]) => [x * .87, y] as const), [[.12, .8], [
			.42,
			.2,
		]]],
	},
	"?": {
		width: .52,
		strokes: [[
			[0, .2],
			[.12, .03],
			[.38, 0],
			[.52, .15],
			[.52, .32],
			[.26, .5],
			[.26, .68],
		], [[.26, .92], [.26, .95]]],
	},
	".": { width: .16, strokes: [[[.08, .93], [.08, .96]]] },
	" ": { width: .3, strokes: [] },
};

function lettering(
	name: string,
	text: string,
	centerX: number,
	top: number,
	size: number,
	color = ink,
	width = 3,
) {
	const gap = .2;
	const letters = [...text].map((character) => {
		const glyph = glyphs[character];
		if (!glyph) throw new Error(`No stroke glyph for "${character}"`);
		return glyph;
	});
	const total = letters.reduce((sum, glyph) => sum + glyph.width + gap, -gap) *
		size;
	let cursor = centerX - total / 2;
	const paths: string[] = [];

	for (const glyph of letters) {
		for (const stroke of glyph.strokes) {
			const points = stroke.map(([x, y]) =>
				[cursor + x * size, top + y * size] as const
			);
			paths.push(poly(points, false, round(size * .12)));
		}

		cursor += (glyph.width + gap) * size;
	}

	return `<Shape name="${name}">${
		paths.join("")
	}<Stroke thickness="${width}" cap="round" join="round"><SolidColor colorValue="${color}"/></Stroke></Shape>`;
}

// ---------------------------------------------------------------------------
// Keyframe helpers.

const curves: Readonly<Record<"ease" | "out" | "in", string>> = {
	ease: 'x1="0.42" y1="0" x2="0.58" y2="1"',
	out: 'x1="0.16" y1="0.84" x2="0.3" y2="1"',
	in: 'x1="0.55" y1="0" x2="0.9" y2="0.4"',
};

function keyframe([frame, value, ease = "ease"]: Key) {
	if (ease === "hold" || ease === "linear") {
		return `<KeyFrameDouble frame="${frame}" value="${
			round(value)
		}" interpolationType="${ease}"/>`;
	}

	return `<KeyFrameDouble frame="${frame}" value="${
		round(value)
	}" interpolationType="cubic"><CubicEaseInterpolator ${
		curves[ease]
	}/></KeyFrameDouble>`;
}

function keyedObjects(tracks: readonly Track[]) {
	const byObject = new Map<number, Track[]>();

	for (const track of tracks) {
		const list = byObject.get(track.id) ?? [];

		if (list.some((other) => other.property === track.property)) {
			throw new Error(`Duplicate track 0:${track.id}/${track.property}`);
		}

		list.push(track);
		byObject.set(track.id, list);
	}

	return [...byObject].map(([id, list]) =>
		`<KeyedObject objectId="0:${id}">${
			list.map((track) =>
				`<KeyedProperty propertyKey="${track.property}">${
					track.keys.map(keyframe).join("")
				}</KeyedProperty>`
			).join("")
		}</KeyedObject>`
	).join("\n");
}

function animation(
	name: string,
	id: number,
	duration: number,
	loop: boolean,
	tracks: readonly Track[],
) {
	return `<LinearAnimation name="${name}" id="0:${id}" fps="30" duration="${duration}" loopValue="${
		loop ? "loop" : "oneShot"
	}">${keyedObjects(tracks)}</LinearAnimation>`;
}

/** Shift an action (frames 0..ACTION_FRAMES) into a longer timeline, holding rest outside it. */
function place(tracks: readonly Track[], start: number, duration: number) {
	return tracks.map((track): Track => {
		const first = track.keys[0];
		const last = track.keys.at(-1);

		if (!first || !last || first[0] !== 0 || last[0] !== ACTION_FRAMES) {
			throw new Error(
				`Action track 0:${track.id} must span 0..${ACTION_FRAMES}`,
			);
		}

		if (first[1] !== last[1]) {
			throw new Error(`Action track 0:${track.id} must end at rest`);
		}

		return {
			...track,
			keys: [
				[0, first[1], "hold"],
				...track.keys.map(([frame, value, ease]): Key => [
					frame + start,
					value,
					ease,
				]),
				[duration, first[1], "hold"],
			],
		};
	});
}

const track = (id: number, property: number, keys: readonly Key[]): Track => ({
	id,
	property,
	keys,
});

/** Alternating wing beats: a linear flap every `period` frames. */
function flutter(id: number, from: number, to: number, period = 2) {
	const keys: Key[] = [[0, 1, "linear"]];

	for (let frame = from; frame <= to; frame += period) {
		keys.push([frame, ((frame - from) / period) % 2 === 0 ? 1 : .22, "linear"]);
	}

	keys.push([ACTION_FRAMES, 1, "linear"]);

	return track(id, SCALE_X, keys);
}

// ---------------------------------------------------------------------------
// The thirteen things. Each root sits hidden behind the chest front at y = 0
// (local to the "Things" node); negative y rises through the lid crack. The
// lid top sits at about y = -305 while the lid is cracked open.

const LID_TOP = -305;

/** A hidden root whose art is scaled up inside it, so motion stays in chest units. */
function thing(
	name: string,
	root: number,
	size: number,
	children: readonly string[],
) {
	return group(name, root, { opacity: 0 }, [
		group("Art", null, { scaleX: size, scaleY: size }, children),
	]);
}
const rootId = (variant: number) => 1000 + variant * 20;

function moth(root: number): Variant {
	const wing = (side: 1 | -1) =>
		shape(
			side < 0 ? "Left wing" : "Right wing",
			poly(
				[[0, 0], [30 * side, -26], [48 * side, -14], [42 * side, 8], [
					18 * side,
					16,
				]],
				true,
				9,
			),
			"FFE8DAB6",
		) +
		shape("Wing spot", ellipse(28 * side, -6, 11, 11), "FFB39B72", 2);

	return {
		art: thing("Moth", root, 2, [
			line("Left antenna", [[-3, -52], [-9, -66], [-17, -68]]),
			line("Right antenna", [[3, -52], [9, -66], [17, -68]]),
			shape("Moth eye", ellipse(-4, -45, 4, 4), ink, 0),
			shape("Moth eye", ellipse(4, -45, 4, 4), ink, 0),
			shape("Fuzzy head", ellipse(0, -44, 20, 18), "FFD9C59C"),
			shape("Body stripes", poly([[-6, -26], [6, -26]], false), undefined, 2),
			shape("Moth body", ellipse(0, -22, 18, 38), "FFBFA67C"),
			group("Left wing beat", root + 1, { y: -24 }, [wing(-1)]),
			group("Right wing beat", root + 2, { y: -24 }, [wing(1)]),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[6, -150],
				[12, -240],
				[18, -310],
				[24, -340],
				[30, -300],
				[36, -250],
				[42, -190, "in"],
				[47, -60],
				[ACTION_FRAMES, 0],
			]),
			track(root, X, [
				[0, 0],
				[12, 50],
				[18, 120],
				[24, 70],
				[30, -60],
				[36, -115],
				[42, -40],
				[47, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root, ROTATION, [
				[0, 0],
				[12, .35],
				[18, .1],
				[24, -.4],
				[30, -.5],
				[36, .2],
				[42, .3],
				[ACTION_FRAMES, 0],
			]),
			flutter(root + 1, 2, 46),
			flutter(root + 2, 2, 46),
		],
	};
}

function sock(root: number): Variant {
	const stripes = [-18, -36, -54].map((y) =>
		line("Sock stripe", [[-19, y], [19, y]], teal, 6)
	);

	return {
		art: thing("Odd sock", root, 1.25, [
			group("Floppy foot", root + 1, { y: -70 }, [
				shape(
					"Toe patch",
					poly(
						[[30, -62], [44, -62], [56, -50], [52, -34], [36, -30]],
						true,
						6,
					),
					gold,
					3,
				),
				shape(
					"Heel patch",
					poly(
						[[-21, -30], [-21, -50], [-8, -62], [2, -58], [-6, -32]],
						true,
						5,
					),
					gold,
					3,
				),
				line("Foot stripe", [[-19, -16], [19, -16]], teal, 6),
				shape(
					"Sock foot",
					poly(
						[[-21, 4], [-21, -48], [-6, -63], [42, -63], [56, -50], [52, -32], [
							21,
							-28,
						], [21, 4]],
						true,
						10,
					),
					coral,
				),
			]),
			...stripes,
			shape(
				"Sock cuff ribs",
				poly([[-10, -4], [-10, -12]], false),
				undefined,
				2,
			),
			shape("Sock leg", rect(0, -36, 42, 74, 4), coral),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -222],
				[12, -196],
				[16, -204],
				[40, -200],
				[46, -50, "in"],
				[ACTION_FRAMES, 0],
			]),
			track(root, ROTATION, [[0, 0], [10, -.14], [20, .1], [30, -.06], [
				40,
				.05,
			], [ACTION_FRAMES, 0]]),
			track(root + 1, ROTATION, [
				[0, 0],
				[8, -.25],
				[14, .95],
				[20, .45],
				[26, .9],
				[32, .55],
				[38, .8],
				[44, .15],
				[ACTION_FRAMES, 0],
			]),
		],
	};
}

function iou(root: number): Variant {
	return {
		art: thing("IOU", root, 1.45, [
			line(
				"Signature",
				[[18, -18], [26, -26], [30, -16], [38, -26], [46, -18], [58, -20]],
				ink,
				2,
			),
			lettering("Zero shares", "0 SHARES", -8, -46, 13, deepCoral, 2.6),
			lettering("IOU", "IOU", 0, -86, 30, ink, 4.5),
			shape("Perforation", rect(0, -52, 138, 80, 4), undefined, 1.5, teal),
			shape("IOU slip", rect(0, -52, 156, 96, 6), paper),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -215],
				[12, -196],
				[16, -202],
				[40, -200],
				[46, -60, "in"],
				[ACTION_FRAMES, 0],
			]),
			track(root, ROTATION, [
				[0, 0],
				[8, -.16],
				[14, .08],
				[20, -.05],
				[28, .03],
				[40, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root, SCALE_X, [[0, 1], [10, 1], [14, 1.1], [18, 1], [
				ACTION_FRAMES,
				1,
			]]),
			track(root, SCALE_Y, [[0, 1], [10, 1], [14, .9], [18, 1], [
				ACTION_FRAMES,
				1,
			]]),
		],
	};
}

function cobweb(root: number): Variant {
	const spokes = Array.from({ length: 8 }, (_, i) => {
		const angle = i * Math.PI / 4 + .2;
		return [Math.cos(angle) * 58, Math.sin(angle) * 58 - 70] as const;
	});
	const ring = (radius: number) =>
		poly(
			Array.from({ length: 8 }, (_, i) => {
				const angle = i * Math.PI / 4 + .2;
				const sag = i % 2 ? .86 : 1;
				return [
					Math.cos(angle) * radius * sag,
					Math.sin(angle) * radius * sag - 70,
				] as const;
			}),
			true,
		);
	const legs = [-1, 1].flatMap((side) =>
		[-6, 0, 6].map((y) =>
			line(
				"Spider leg",
				[[4 * side, y], [13 * side, y - 7], [18 * side, y + 4]],
				ink,
				2.2,
			)
		)
	);

	return {
		art: thing("Cobweb", root, 1.3, [
			group("Spider", root + 1, { y: -70 }, [
				group("Dangling spider", root + 3, { y: 14 }, [
					shape("Spider eye", ellipse(-3, -3, 4, 4), paper, 0),
					shape("Spider eye", ellipse(3, -3, 4, 4), paper, 0),
					shape("Spider body", ellipse(0, 0, 16, 16), ink, 0),
					...legs,
				]),
			]),
			group("Spider thread", root + 2, { y: -70 }, [
				line("Silk", [[0, 0], [0, 14]], "FF8FA8A2", 1.6),
			]),
			shape(
				"Web",
				spokes.map((point) => poly([[0, -70], point], false)).join("") +
					ring(20) + ring(38) + ring(56),
				undefined,
				2.4,
				"FF9FB2AC",
			),
		]),
		action: [
			track(root, Y, [[0, 0, "out"], [10, -250], [14, -236], [40, -236], [
				46,
				-60,
				"in",
			], [ACTION_FRAMES, 0]]),
			track(root + 1, Y, [
				[0, -70],
				[14, -70, "in"],
				[20, 0],
				[24, -14],
				[28, 8],
				[32, -6],
				[36, 0],
				[41, -70, "in"],
				[ACTION_FRAMES, -70],
			]),
			track(root + 2, SCALE_Y, [
				[0, 1],
				[14, 1, "in"],
				[20, 6],
				[24, 5],
				[28, 6.6],
				[32, 5.6],
				[36, 6],
				[41, 1, "in"],
				[ACTION_FRAMES, 1],
			]),
			track(root + 3, ROTATION, [
				[0, 0],
				[20, 0],
				[24, .35],
				[28, -.3],
				[32, .2],
				[36, 0],
				[ACTION_FRAMES, 0],
			]),
		],
	};
}

function dustBunny(root: number): Variant {
	return {
		art: thing("Dust bunny", root, 1.4, [
			group("Bunny eyes", root + 1, { y: -48 }, [
				shape("Pupil", ellipse(-12, 1, 6, 8), ink, 0),
				shape("Pupil", ellipse(14, 1, 6, 8), ink, 0),
				shape("Eye", ellipse(-13, 0, 14, 16), paper, 2.5),
				shape("Eye", ellipse(13, 0, 14, 16), paper, 2.5),
			]),
			shape("Blush", ellipse(-26, -34, 10, 5), "FFF2A89C", 0),
			shape("Blush", ellipse(26, -34, 10, 5), "FFF2A89C", 0),
			shape(
				"Fluff",
				`<Star x="0" y="-40" width="96" height="82" points="22" innerRadius="0.84"/>`,
				"FFBDB5A4",
			),
			shape(
				"Ear",
				poly([[-18, -70], [-30, -112], [-16, -116], [-8, -76]], true, 7),
				"FFBDB5A4",
			),
			shape(
				"Ear",
				poly([[10, -76], [22, -118], [36, -110], [22, -70]], true, 7),
				"FFBDB5A4",
			),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -230],
				[12, -350, "in"],
				[16, LID_TOP],
				[38, LID_TOP, "out"],
				[42, -370, "in"],
				[47, -80],
				[ACTION_FRAMES, 0],
			]),
			track(root, X, [[0, 0], [12, 30], [16, 45], [38, 45], [42, 25], [
				ACTION_FRAMES,
				0,
			]]),
			track(root, SCALE_Y, [
				[0, 1],
				[15, 1.1],
				[17, .72],
				[21, 1.08],
				[25, 1],
				[28, 1],
				[30, .85],
				[32, 1.25],
				[36, 1],
				[38, 1],
				[40, .8],
				[42, 1.15],
				[ACTION_FRAMES, 1],
			]),
			track(root, SCALE_X, [
				[0, 1],
				[15, .92],
				[17, 1.24],
				[21, .96],
				[25, 1],
				[28, 1],
				[30, 1.1],
				[32, .9],
				[36, 1],
				[38, 1],
				[40, 1.2],
				[42, .9],
				[ACTION_FRAMES, 1],
			]),
			track(root + 1, SCALE_Y, [
				[0, 1],
				[22, 1, "linear"],
				[23, .1, "linear"],
				[25, 1, "linear"],
				[30, 1, "linear"],
				[31, .1, "linear"],
				[35, .1, "linear"],
				[36, 1],
				[ACTION_FRAMES, 1],
			]),
		],
	};
}

function duck(root: number): Variant {
	return {
		art: thing("Rubber duck", root, 1.5, [
			group("Squeak", root + 1, { x: 66, y: -84, opacity: 0 }, [
				line("Squeak line", [[4, -14], [12, -24]], ink, 3),
				line("Squeak line", [[8, 0], [22, 0]], ink, 3),
				line("Squeak line", [[4, 14], [12, 24]], ink, 3),
			]),
			shape("Duck eye shine", ellipse(29, -80, 3, 3), paper, 0),
			shape("Duck eye", ellipse(28, -78, 8, 10), ink, 0),
			shape(
				"Beak",
				poly([[42, -76], [66, -74], [64, -62], [42, -60]], true, 5),
				"FFF08A3C",
			),
			shape(
				"Wing",
				poly([[-22, -44], [-4, -50], [10, -40], [-8, -30]], true, 8),
				"FFF2BF2E",
				3,
			),
			shape("Head", ellipse(24, -72, 50, 48), "FFF7D046"),
			shape(
				"Belly shine",
				poly([[-30, -20], [-10, -14], [10, -14]], false),
				undefined,
				3,
				"FFFFF1BA",
			),
			shape(
				"Duck body",
				poly(
					[
						[-54, -54],
						[-40, -46],
						[-4, -48],
						[24, -50],
						[52, -40],
						[48, -10],
						[22, 0],
						[-30, 0],
						[-50, -16],
					],
					true,
					16,
				),
				"FFF7D046",
			),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -236],
				[12, -206],
				[16, -218],
				[20, -208],
				[24, -214],
				[40, -210],
				[46, -60, "in"],
				[ACTION_FRAMES, 0],
			]),
			track(root, ROTATION, [
				[0, 0],
				[12, .12],
				[18, -.08],
				[26, .06],
				[34, -.04],
				[40, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root, SCALE_Y, [
				[0, 1],
				[24, 1, "linear"],
				[26, .8, "out"],
				[29, 1.1],
				[33, 1],
				[ACTION_FRAMES, 1],
			]),
			track(root, SCALE_X, [
				[0, 1],
				[24, 1, "linear"],
				[26, 1.14, "out"],
				[29, .95],
				[33, 1],
				[ACTION_FRAMES, 1],
			]),
			track(root + 1, OPACITY, [
				[0, 0],
				[25, 0, "hold"],
				[26, 1],
				[34, 1, "linear"],
				[37, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root + 1, SCALE_X, [[0, .5], [25, .5, "out"], [29, 1.2], [34, 1], [
				ACTION_FRAMES,
				.5,
			]]),
			track(root + 1, SCALE_Y, [[0, .5], [25, .5, "out"], [29, 1.2], [34, 1], [
				ACTION_FRAMES,
				.5,
			]]),
		],
	};
}

function soldOutTag(root: number): Variant {
	return {
		art: thing("Sold out tag", root, 1.2, [
			group("Tag swing", root + 1, { y: -140 }, [
				lettering("Out", "OUT", 0, 100, 17, deepCoral, 3.4),
				lettering("Sold", "SOLD", 0, 76, 17, deepCoral, 3.4),
				shape("Tag hole", ellipse(0, 50, 11, 11), ivory, 2.5),
				shape(
					"Tag",
					poly(
						[[-44, 135], [44, 135], [44, 60], [22, 38], [-22, 38], [-44, 60]],
						true,
						7,
					),
					"FFEBCB8E",
				),
				line(
					"String",
					[[0, 50], [-12, 26], [-4, 0], [10, 20], [0, 50]],
					ink,
					2.2,
				),
			]),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -262],
				[12, -240],
				[16, -246],
				[40, -244],
				[46, -60, "in"],
				[ACTION_FRAMES, 0],
			]),
			track(root + 1, ROTATION, [
				[0, 0],
				[10, .5],
				[16, -.38],
				[22, .26],
				[28, -.16],
				[34, .08],
				[40, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root + 1, SCALE_X, [[0, 1], [3, -.4], [7, 1], [ACTION_FRAMES, 1]]),
		],
	};
}

function button(root: number): Variant {
	const holes = [[-9, -9], [9, -9], [-9, 9], [9, 9]].map(([x, y]) =>
		shape("Button hole", ellipse(x ?? 0, y ?? 0, 9, 9), "FF8E3530", 0)
	);
	const roll = (distance: number) => distance / 36;

	return {
		art: thing("Lost button", root, 1.5, [
			group("Rolling button", root + 1, { y: -36 }, [
				line("Thread", [[-9, -9], [9, 9]], gold, 3.4),
				line("Thread", [[9, -9], [-9, 9]], gold, 3.4),
				...holes,
				shape("Button rim", ellipse(0, 0, 52, 52), undefined, 3, "FFC24A40"),
				shape(
					"Button shine",
					poly([[-24, -12], [-18, -22], [-8, -28]], false),
					undefined,
					3,
					"FFFFC2B4",
				),
				shape("Button", ellipse(0, 0, 72, 72), coral),
			]),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -340],
				[11, LID_TOP, "out"],
				[14, -322],
				[17, LID_TOP],
				[42, LID_TOP, "out"],
				[44, -340, "in"],
				[49, -40],
				[ACTION_FRAMES, 0],
			]),
			track(root, X, [
				[0, 0],
				[17, 0],
				[27, 100],
				[37, -90],
				[42, -20],
				[49, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root + 1, ROTATION, [
				[0, 0],
				[17, 0],
				[27, roll(100)],
				[37, roll(-90)],
				[42, roll(-20)],
				[49, 0],
				[ACTION_FRAMES, 0],
			]),
		],
	};
}

function crown(root: number): Variant {
	const tips: readonly Point[] = [[-50, -44], [-18, -56], [18, -56], [50, -44]];

	return {
		art: thing("Paper crown", root, 1.5, [
			...[[-20, coral], [0, teal], [20, coral]].map(([x, color]) =>
				shape(
					"Paper jewel",
					ellipse(Number(x), -14, 11, 11),
					String(color),
					2.5,
				)
			),
			...tips.map(([x, y]) =>
				shape("Crown tip", ellipse(x, y, 10, 10), gold, 2.5)
			),
			line("Crease", [[-30, -30], [-26, -6]], "FFD9A635", 2),
			line("Crease", [[28, -34], [24, -8]], "FFD9A635", 2),
			line("Band", [[-50, -24], [50, -24]], "FFD9A635", 2.5),
			shape(
				"Crown",
				poly(
					[
						[-50, 0],
						[-50, -44],
						[-34, -24],
						[-18, -56],
						[0, -28],
						[18, -56],
						[34, -24],
						[50, -44],
						[50, 0],
					],
					true,
					3,
				),
				gold,
			),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -360],
				[13, LID_TOP + 6, "out"],
				[16, LID_TOP],
				[40, LID_TOP, "out"],
				[44, -350, "in"],
				[49, -60],
				[ACTION_FRAMES, 0],
			]),
			track(root, X, [[0, 0], [13, -46], [40, -46], [44, -20], [
				ACTION_FRAMES,
				0,
			]]),
			track(root, ROTATION, [
				[0, 0],
				[8, -.5],
				[13, .22],
				[16, .14],
				[40, .14],
				[44, -.25],
				[ACTION_FRAMES, 0],
			]),
			track(root, SCALE_X, [[0, 1], [22, 1], [25, 1.12], [28, 1], [
				ACTION_FRAMES,
				1,
			]]),
			track(root, SCALE_Y, [[0, 1], [22, 1], [25, 1.12], [28, 1], [
				ACTION_FRAMES,
				1,
			]]),
		],
	};
}

function snail(root: number): Variant {
	const spiral: readonly Point[] = [
		[4, -44],
		[12, -46],
		[16, -38],
		[10, -30],
		[-2, -32],
		[-8, -44],
		[0, -58],
		[16, -60],
		[28, -48],
		[26, -30],
	];

	return {
		art: thing("Snail", root, 1.5, [
			shape("Shell spiral", poly(spiral, false, 6), undefined, 3),
			shape("Shell", ellipse(4, -42, 64, 60), "FFE39A55"),
			group("Eye stalks", root + 1, { x: 40, y: -30, scaleY: .2 }, [
				shape("Eye", ellipse(-6, -38, 10, 10), ink, 0),
				shape("Eye", ellipse(12, -40, 10, 10), ink, 0),
				line("Stalk", [[-2, 0], [-6, -36]], ink, 3),
				line("Stalk", [[4, 0], [12, -38]], ink, 3),
			]),
			line("Snail smile", [[48, -14], [54, -10], [60, -14]], ink, 2),
			shape(
				"Snail body",
				poly(
					[[-54, 0], [-50, -10], [24, -14], [34, -34], [52, -38], [64, -24], [
						62,
						0,
					]],
					true,
					9,
				),
				"FFB3CF92",
			),
		]),
		action: [
			track(root, Y, [[0, 0], [16, -210], [38, -214], [48, -30], [
				ACTION_FRAMES,
				0,
			]]),
			track(root, X, [[0, 0], [16, -10], [38, 18], [ACTION_FRAMES, 0]]),
			track(root + 1, SCALE_Y, [
				[0, .2],
				[16, .2, "out"],
				[20, 1.12],
				[23, 1],
				[34, 1],
				[40, .3],
				[ACTION_FRAMES, .2],
			]),
			track(root + 1, ROTATION, [
				[0, 0],
				[22, 0],
				[26, .3],
				[30, -.28],
				[34, 0],
				[ACTION_FRAMES, 0],
			]),
		],
	};
}

function receipt(root: number): Variant {
	const zigzag: Point[] = [[-34, 0], [34, 0], [34, -130]];

	for (let x = 34; x > -34; x -= 8.5) {
		zigzag.push([x - 4.25, -136], [x - 8.5, -130]);
	}

	return {
		art: thing("Crumpled receipt", root, 1.25, [
			group("Paper ball", root + 2, { y: -26, opacity: 0 }, [
				line("Crease", [[-12, -8], [0, 2], [8, -12]], "FFB9AE92", 2),
				line("Crease", [[-4, 10], [12, 4]], "FFB9AE92", 2),
				shape(
					"Crumpled ball",
					poly(
						[[-22, -6], [-14, -22], [4, -24], [20, -14], [24, 4], [12, 20], [
							-8,
							22,
						], [-22, 10]],
						true,
						5,
					),
					paper,
				),
			]),
			group("Receipt strip", root + 1, { scaleY: .3 }, [
				lettering("Total", "0.00", 0, -40, 16, ink, 2.8),
				lettering("Total label", "TOTAL", 0, -62, 10, teal, 2),
				...[-112, -100, -88, -76].map((y, i) =>
					line("Receipt row", [[-22, y], [4 + (i % 2) * 8, y]], "FF9DB5AE", 2.4)
				),
				...[-112, -100, -88, -76].map((y) =>
					line("Price dots", [[16, y], [22, y]], "FF9DB5AE", 2.4)
				),
				shape("Receipt", poly(zigzag, true), paper),
			]),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[8, -196],
				[34, -196, "out"],
				[40, -245, "in"],
				[47, -50],
				[ACTION_FRAMES, 0],
			]),
			track(root, ROTATION, [
				[0, 0],
				[16, 0],
				[20, .08],
				[26, -.06],
				[32, 0],
				[35, 0],
				[46, 3.2, "hold"],
				[ACTION_FRAMES, 0],
			]),
			track(root + 1, SCALE_Y, [
				[0, .3],
				[6, .3, "out"],
				[16, 1.06],
				[20, 1],
				[30, 1, "in"],
				[34, .2, "hold"],
				[49, .2],
				[ACTION_FRAMES, .3],
			]),
			track(root + 1, OPACITY, [[0, 1, "hold"], [34, 0, "hold"], [
				49,
				0,
				"hold",
			], [ACTION_FRAMES, 1]]),
			track(root + 2, OPACITY, [[0, 0, "hold"], [34, 1, "hold"], [
				49,
				1,
				"hold",
			], [ACTION_FRAMES, 0]]),
		],
	};
}

function ghostCertificate(root: number): Variant {
	const hem: Point[] = [];

	for (let i = 0; i <= 8; i++) hem.push([-48 + i * 12, i % 2 ? -8 : 0]);

	return {
		art: thing("Ghost certificate", root, 1.45, [
			group("Ghost body", root + 1, { opacity: .86 }, [
				shape("Ghost mouth", ellipse(0, -44, 11, 13), ink, 0),
				shape("Ghost eye", ellipse(-14, -62, 9, 14), ink, 0),
				shape("Ghost eye", ellipse(14, -62, 9, 14), ink, 0),
				shape(
					"Seal",
					`<Star x="30" y="-24" width="22" height="22" points="8" innerRadius="0.7"/>`,
					gold,
					2,
				),
				lettering("Share", "SHARE", 0, -100, 10, teal, 2),
				shape(
					"Certificate border",
					rect(0, -60, 80, 94, 4),
					undefined,
					2,
					"FFD9B45A",
				),
				shape(
					"Certificate",
					poly([...hem.reverse(), [-48, -112], [48, -112]], true, 6),
					"FFF7F1DE",
				),
			]),
		]),
		action: [
			track(root, Y, [
				[0, 0, "out"],
				[10, -250],
				[16, -232],
				[22, -252],
				[28, -234],
				[34, -250],
				[40, -238],
				[47, -60, "in"],
				[ACTION_FRAMES, 0],
			]),
			track(root, X, [
				[0, 0],
				[10, -22],
				[16, 18],
				[22, -14],
				[28, 18],
				[34, -10],
				[40, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root, ROTATION, [
				[0, 0],
				[10, -.1],
				[16, .1],
				[22, -.08],
				[28, .08],
				[34, -.05],
				[40, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root, SCALE_X, [[0, 1], [26, 1], [28, 1.22, "out"], [31, .94], [
				34,
				1,
			], [ACTION_FRAMES, 1]]),
			track(root, SCALE_Y, [[0, 1], [26, 1], [28, 1.22, "out"], [31, .94], [
				34,
				1,
			], [ACTION_FRAMES, 1]]),
		],
	};
}

function echo(root: number): Variant {
	const bubble = (name: string) => [
		lettering(`${name} words`, "...HELLO?", 2, -54, 17, ink, 3.2),
		shape(
			`${name} tail`,
			poly([[-30, -20], [-40, 2], [-12, -20]], true, 3),
			paper,
		),
		shape(name, rect(0, -44, 148, 52, 22), paper),
	];

	return {
		art: thing("Echo", root, 1.35, [
			group("Faint echo", root + 3, {
				x: 70,
				y: -170,
				scaleX: .5,
				scaleY: .5,
				opacity: 0,
			}, bubble("Faint bubble")),
			group("Echo", root + 2, {
				x: 44,
				y: -96,
				scaleX: .72,
				scaleY: .72,
				opacity: 0,
			}, bubble("Echo bubble")),
			group("Hello", root + 1, {}, bubble("Speech bubble")),
		]),
		action: [
			track(root, Y, [[0, 0, "out"], [8, -226], [12, -212], [40, -214], [
				46,
				-60,
				"in",
			], [ACTION_FRAMES, 0]]),
			track(root + 1, ROTATION, [[0, 0], [12, -.05], [18, .03], [24, 0], [
				ACTION_FRAMES,
				0,
			]]),
			track(root + 2, OPACITY, [[0, 0], [16, 0], [19, .7], [30, .45], [36, 0], [
				ACTION_FRAMES,
				0,
			]]),
			track(root + 2, Y, [[0, -96], [16, -86], [36, -120], [
				ACTION_FRAMES,
				-96,
			]]),
			track(root + 3, OPACITY, [
				[0, 0],
				[23, 0],
				[26, .42],
				[34, .25],
				[39, 0],
				[ACTION_FRAMES, 0],
			]),
			track(root + 3, Y, [[0, -170], [23, -160], [39, -200], [
				ACTION_FRAMES,
				-170,
			]]),
		],
	};
}

const variants: readonly Variant[] = [
	moth,
	sock,
	iou,
	cobweb,
	dustBunny,
	duck,
	soldOutTag,
	button,
	crown,
	snail,
	receipt,
	ghostCertificate,
	echo,
].map((build, variant) => build(rootId(variant)));

// ---------------------------------------------------------------------------
// Chest and dust motion.

const PUFFS = 6;
const MOTES = 4;
const puffId = (i: number) => 60 + i;
const moteId = (i: number) => 70 + i;

section(
	"dust",
	[
		...Array.from(
			{ length: MOTES },
			(_, i) =>
				group(
					"Dust mote",
					moteId(i),
					{ x: -40 + i * 26, y: -190, opacity: 0 },
					[
						shape(
							"Mote",
							ellipse(0, 0, 5 + (i % 2) * 3, 5 + (i % 2) * 3),
							"FFD8CCAA",
							0,
						),
					],
				),
		),
		...Array.from(
			{ length: PUFFS },
			(_, i) =>
				group("Dust puff", puffId(i), {
					x: i < 3 ? -150 : 150,
					y: -184,
					scaleX: 0,
					scaleY: 0,
				}, [
					shape(
						"Puff",
						ellipse(0, 0, 30 - (i % 3) * 5, 22 - (i % 3) * 4),
						dust,
						2,
						"FFB8AC8A",
					),
				]),
		),
	].join("\n"),
);

section("things", variants.map((variant) => variant.art).join("\n"));

function dustBurst(start: number, duration: number): Track[] {
	const tracks: Track[] = [];

	for (let i = 0; i < PUFFS; i++) {
		const side = i < 3 ? -1 : 1;
		const tier = i % 3;
		const x = side * 150;
		const endX = side * (190 + tier * 22);
		const endY = -196 - tier * 20;
		const at = start + tier * 2;
		const scale: Key[] = [
			[0, 0, "hold"],
			[at, 0, "out"],
			[at + 8, 1.1 - tier * .15],
			[at + 22, 1.4 - tier * .2, "hold"],
			[at + 23, 0, "hold"],
			[duration, 0, "hold"],
		];

		tracks.push(
			track(puffId(i), X, [[0, x, "hold"], [at, x, "out"], [
				at + 22,
				endX,
				"hold",
			], [duration, x, "hold"]]),
			track(puffId(i), Y, [[0, -184, "hold"], [at, -184, "out"], [
				at + 22,
				endY,
				"hold",
			], [duration, -184, "hold"]]),
			track(puffId(i), SCALE_X, scale),
			track(puffId(i), SCALE_Y, scale),
			track(puffId(i), OPACITY, [[0, 1, "hold"], [at + 6, 1, "in"], [
				at + 22,
				0,
				"hold",
			], [duration, 1, "hold"]]),
		);
	}

	return tracks;
}

function motes(start: number, duration: number): Track[] {
	return Array.from({ length: MOTES }, (_, i) => {
		const at = start + i * 6;
		const x = -40 + i * 26;

		return [
			track(moteId(i), Y, [[0, -190, "hold"], [at, -190, "linear"], [
				at + 40,
				-300 - i * 14,
				"hold",
			], [duration, -190, "hold"]]),
			track(moteId(i), X, [[0, x, "hold"], [at, x], [at + 20, x + 14], [
				at + 40,
				x - 6,
				"hold",
			], [duration, x, "hold"]]),
			track(moteId(i), OPACITY, [
				[0, 0, "hold"],
				[at, 0, "linear"],
				[at + 12, .9, "linear"],
				[at + 40, 0, "hold"],
				[duration, 0, "hold"],
			]),
		];
	}).flat();
}

type LidPose = Readonly<
	{
		frames: readonly number[];
		lifts: readonly number[];
		tilts: readonly number[];
	}
>;

function lidTracks(pose: LidPose): Track[] {
	return [
		track(
			11,
			Y,
			pose.frames.map((frame, i) => [frame, LID_Y - (pose.lifts[i] ?? 0)]),
		),
		track(
			11,
			ROTATION,
			pose.frames.map((frame, i) => [frame, pose.tilts[i] ?? 0]),
		),
		track(
			12,
			Y,
			pose.frames.map((frame, i) => [frame, LOCK_Y - (pose.lifts[i] ?? 0)]),
		),
	];
}

function squash(keys: readonly Key[]): Track[] {
	return [
		track(10, SCALE_Y, keys),
		track(
			10,
			SCALE_X,
			keys.map(([frame, value, ease]) => [frame, 1 + (1 - value) * .8, ease]),
		),
	];
}

const closedChest = animation("Closed", 30, 1, false, [
	...lidTracks({ frames: [0], lifts: [0], tilts: [0] }),
]);

const idleChest = animation("Chest idle", 31, IDLE_FRAMES, true, [
	track(10, ROTATION, [
		[0, 0],
		[8, 0],
		[12, -.045],
		[16, .04],
		[20, -.03],
		[24, .018],
		[28, 0],
		[IDLE_FRAMES, 0],
	]),
	...squash([
		[0, 1],
		[28, 1],
		[32, .93],
		[37, 1.04],
		[42, 1],
		[89, 1, "in"],
		[93, .88, "out"],
		[98, 1.05],
		[104, .98],
		[110, 1],
		[IDLE_FRAMES, 1],
	]),
	...lidTracks({
		frames: [0, 30, 35, 40, 84, 88, 93, 97, 101, IDLE_FRAMES],
		lifts: [0, 0, LID_LIFT + 12, LID_LIFT, LID_LIFT, LID_LIFT + 10, 0, 4, 0, 0],
		tilts: [0, 0, -.08, -.05, -.05, -.07, 0, 0, 0, 0],
	}),
	track(12, ROTATION, [
		[0, 0],
		[35, 0],
		[40, .22],
		[46, -.14],
		[52, .07],
		[58, 0],
		[93, 0],
		[96, -.12],
		[100, .06],
		[104, 0],
		[IDLE_FRAMES, 0],
	]),
	...dustBurst(93, IDLE_FRAMES),
	...motes(IDLE_ACTION_START, IDLE_FRAMES),
]);

const revealChest = animation("Chest reveal", 32, REVEAL_FRAMES, false, [
	track(10, ROTATION, [[0, 0], [2, .05], [4, -.05], [6, .03], [8, 0], [
		REVEAL_FRAMES,
		0,
	]]),
	track(10, Y, [[0, 0], [4, 6, "out"], [9, -26, "in"], [13, 0], [
		REVEAL_FRAMES,
		0,
	]]),
	...squash([
		[0, 1],
		[4, .86],
		[9, 1.1],
		[13, .92],
		[17, 1.03],
		[21, 1],
		[62, 1, "in"],
		[66, .88, "out"],
		[71, 1.05],
		[76, 1],
		[REVEAL_FRAMES, 1],
	]),
	...lidTracks({
		frames: [0, 6, 10, 15, 58, 62, 66, 70, 74, REVEAL_FRAMES],
		lifts: [0, 0, LID_LIFT + 34, LID_LIFT, LID_LIFT, LID_LIFT + 10, 0, 4, 0, 0],
		tilts: [0, 0, -.12, -.05, -.05, -.07, 0, 0, 0, 0],
	}),
	track(12, ROTATION, [
		[0, 0],
		[10, .3],
		[16, -.2],
		[22, .1],
		[28, 0],
		[66, 0],
		[69, -.12],
		[73, .06],
		[77, 0],
		[REVEAL_FRAMES, 0],
	]),
	...dustBurst(66, REVEAL_FRAMES),
	...motes(REVEAL_ACTION_START, REVEAL_FRAMES),
]);

// ---------------------------------------------------------------------------
// Thing layer animations: one idle loop and one reveal per variant. Each keys
// every root's opacity, so switching variant never leaves a stale thing shown.

function visibility(shown: number | null, duration: number): Track[] {
	return variants.map((_, variant) =>
		track(rootId(variant), OPACITY, [[0, variant === shown ? 1 : 0, "hold"], [
			duration,
			variant === shown ? 1 : 0,
			"hold",
		]])
	);
}

const THING_ANIMATION = 100;
const noThing = animation(
	"No thing",
	THING_ANIMATION - 1,
	1,
	false,
	visibility(null, 1),
);
const thingAnimations = variants.flatMap((variant, index) => [
	animation(
		`Thing ${index} idle`,
		THING_ANIMATION + index * 2,
		IDLE_FRAMES,
		true,
		[
			...visibility(index, IDLE_FRAMES),
			...place(variant.action, IDLE_ACTION_START, IDLE_FRAMES),
		],
	),
	animation(
		`Thing ${index} reveal`,
		THING_ANIMATION + index * 2 + 1,
		REVEAL_FRAMES,
		false,
		[
			...visibility(index, REVEAL_FRAMES),
			...place(variant.action, REVEAL_ACTION_START, REVEAL_FRAMES),
		],
	),
]);

section(
	"motion",
	[closedChest, idleChest, revealChest, noThing, ...thingAnimations].join("\n"),
);

// ---------------------------------------------------------------------------
// State machine. `variant` (0-12) picks the thing; `reveal` plays a one-shot
// open. Both layers leave their rest state on the same frame so they stay in
// step for the whole loop.

const variantPath = 'sourcePathIds="0:40-0:42"';
const revealPath = 'sourcePathIds="0:40-0:43"';

function variantIs(op: string, value: number) {
	return `<TransitionViewModelCondition opValue="${op}"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext ${variantPath} propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${value}"/></TransitionViewModelCondition>`;
}

const revealFired =
	`<TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyTrigger><DataBindContext ${revealPath} propertyKey="686"/></BindablePropertyTrigger></TransitionPropertyViewModelComparator><TransitionValueTriggerComparator/></TransitionViewModelCondition>`;

const CHEST_CLOSED = 200;
const CHEST_IDLE = 201;
const CHEST_REVEAL = 202;
const THING_NONE = 210;
const thingIdle = (variant: number) => 220 + variant * 2;
const thingReveal = (variant: number) => 221 + variant * 2;
const afterReveal = (to: number) =>
	`<StateTransition stateToId="0:${to}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`;

const chestLayer =
	`<StateMachineLayer name="Chest"><AnyState x="0" y="-150"><StateTransition stateToId="0:${CHEST_REVEAL}">${revealFired}</StateTransition></AnyState><ExitState x="600" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="0:${CHEST_CLOSED}"/></EntryState><AnimationState id="0:${CHEST_CLOSED}" animationId="0:30" x="200" y="0"><StateTransition stateToId="0:${CHEST_IDLE}">${
		variantIs("greaterThanOrEqual", 0)
	}</StateTransition></AnimationState><AnimationState id="0:${CHEST_IDLE}" animationId="0:31" x="400" y="0"/><AnimationState id="0:${CHEST_REVEAL}" animationId="0:32" reset="true" x="400" y="-150">${
		afterReveal(CHEST_IDLE)
	}</AnimationState></StateMachineLayer>`;

const thingLayer = `<StateMachineLayer name="Thing"><AnyState x="0" y="-150">${
	variants.map((_, variant) =>
		`<StateTransition stateToId="0:${thingReveal(variant)}">${revealFired}${
			variantIs("equal", variant)
		}</StateTransition>`
	).join("")
}</AnyState><ExitState x="800" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="0:${THING_NONE}"/></EntryState><AnimationState id="0:${THING_NONE}" animationId="0:${
	THING_ANIMATION - 1
}" x="200" y="0">${
	variants.map((_, variant) =>
		`<StateTransition stateToId="0:${thingIdle(variant)}">${
			variantIs("equal", variant)
		}</StateTransition>`
	).join("")
}</AnimationState>${
	variants.map((_, variant) =>
		`<AnimationState id="0:${thingIdle(variant)}" animationId="0:${
			THING_ANIMATION + variant * 2
		}" reset="true" x="450" y="${
			variant * 120
		}"><StateTransition stateToId="0:${THING_NONE}">${
			variantIs("notEqual", variant)
		}</StateTransition></AnimationState><AnimationState id="0:${
			thingReveal(variant)
		}" animationId="0:${
			THING_ANIMATION + variant * 2 + 1
		}" reset="true" x="700" y="${variant * 120}">${
			afterReveal(thingIdle(variant))
		}</AnimationState>`
	).join("")
}</StateMachineLayer>`;

section(
	"machine",
	`<StateMachine name="Empty chest" id="0:3">${chestLayer}${thingLayer}</StateMachine>`,
);

writeFileSync(source, scene);
