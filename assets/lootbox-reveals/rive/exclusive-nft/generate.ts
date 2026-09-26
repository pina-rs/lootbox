import { writeFileSync } from "node:fs";

import {
	BACKGROUND_ART_COUNT,
	backgroundArt,
	CANVAS,
} from "../../../../packages/exclusive-nft-art/src/art/backgrounds.ts";
import {
	BODY_PANEL,
	BODY_SILHOUETTE,
	chest,
	CONTENTS_Y,
	LID_PANEL,
	LID_SILHOUETTE,
	LID_Y,
	LOCK_Y,
	POSTER_LID,
} from "../../../../packages/exclusive-nft-art/src/art/chest.ts";
import {
	CONTENTS_ART,
	contentsRoot,
} from "../../../../packages/exclusive-nft-art/src/art/contents.ts";
import {
	AURA_CENTER,
	cosmosBackArt,
	cosmosFrontArt,
	haloArt,
	holoArt,
	raysArt,
	sparkleArt,
	sparklePlacements,
} from "../../../../packages/exclusive-nft-art/src/art/effects.ts";
import {
	type Art,
	type Color,
	ellipse,
	type FinishSlot,
	type Geometry,
	type Gradient,
	group,
	isGradient,
	isSlot,
	type Paint,
	polar,
	poly,
	rect,
	type Shape,
	shape,
	slot,
	type StopColor,
	type Transform,
	withAlpha,
} from "../../../../packages/exclusive-nft-art/src/art/model.ts";
import {
	PATTERN_ART_COUNT,
	patternArt,
} from "../../../../packages/exclusive-nft-art/src/art/patterns.ts";
import { STAGE } from "../../../../packages/exclusive-nft-art/src/render.ts";
import {
	REVEAL_DRAMA_ORDER,
	type RevealDrama,
	type Tier,
	TIERS,
} from "../../../../packages/exclusive-nft-art/src/tiers.ts";

/**
 * Generates `scene.rml` for the Exclusive NFT reveal.
 *
 * All artwork comes from `@pina-rs/exclusive-nft-art`, the same vector model
 * that renders the SVG posters, so the animation and the still always match.
 * This script adds only what a poster lacks: ids, per-tier color keys,
 * visibility states, motion, and the state machine.
 */

// ---------------------------------------------------------------------------
// Fixed ids and property keys.

const ARTBOARD = 1;
const LAYOUT_STYLE = 2;
const STATE_MACHINE = 3;
const VIEW_MODEL = 40;
const VIEW_MODEL_INSTANCE = 41;
const PROPERTY = {
	tier: 42,
	contents: 43,
	background: 44,
	pattern: 45,
	reveal: 46,
} as const;

const X = 13;
const Y = 14;
const ROTATION = 15;
const SCALE_X = 16;
const SCALE_Y = 17;
const OPACITY = 18;
const SOLID_COLOR = 37;
const STOP_COLOR = 38;

const FPS = 30;
const IDLE_FRAMES = 120;
const REVEAL_FRAMES = 96;
const AMBIENT_FRAMES = 240;
const DRAMA_FRAMES = 90;

const round = (value: number) => Number(value.toFixed(3));
const ref = (id: number) => `0:${id}`;

// ---------------------------------------------------------------------------
// Model → RML. Rive draws the first sibling on top, so every list is reversed.

type SlotPaint = Readonly<
	{ id: number; slot: FinishSlot; alpha: number | undefined; property: number }
>;

class RmlWriter {
	#next = 1000;
	readonly keys = new Map<string, number>();
	readonly slots: SlotPaint[] = [];
	readonly #fallback: Tier;

	constructor(fallback: Tier) {
		this.#fallback = fallback;
	}

	id(): number {
		return this.#next++;
	}

	/** The id of a keyed group; throws if the art never declared the key. */
	key(name: string): number {
		const id = this.keys.get(name);

		if (id === undefined) {
			throw new Error(`No keyed group "${name}"`);
		}

		return id;
	}

	write(art: readonly Art[]): string {
		return [...art].reverse().map((item) => this.#art(item)).join("");
	}

	#art(item: Art): string {
		return item.kind === "shape" ? this.#shape(item) : this.#group(item);
	}

	#group(item: Extract<Art, { kind: "group" }>): string {
		let id: number | null = null;

		if (item.key !== undefined) {
			if (this.keys.has(item.key)) {
				throw new Error(`Duplicate key "${item.key}"`);
			}

			id = this.id();
			this.keys.set(item.key, id);
		}

		let clip = "";

		if (item.clip) {
			const source = this.id();

			clip = `<ClippingShape sourceId="${
				ref(source)
			}"/><Shape name="Clip source" id="${ref(source)}">${
				item.clip.map(geometry).join("")
			}</Shape>`;
		}

		return `<Node name="${item.name}"${id === null ? "" : ` id="${ref(id)}"`}${
			transform(item)
		}>${clip}${this.write(item.children)}</Node>`;
	}

	#shape(item: Shape): string {
		const paths = item.geometry.map(geometry).join("");
		const fill = item.fill === undefined
			? ""
			: `<Fill>${this.#paint(item.fill)}</Fill>`;
		const stroke = item.stroke
			? `<Stroke thickness="${
				round(item.stroke.width)
			}" cap="round" join="round">${this.#paint(item.stroke.paint)}</Stroke>`
			: "";
		const opacity = item.opacity === undefined
			? ""
			: ` opacity="${round(item.opacity)}"`;

		return `<Shape name="${item.name}"${opacity}>${paths}${fill}${stroke}</Shape>`;
	}

	#paint(paint: Paint): string {
		if (isGradient(paint)) {
			return this.#gradient(paint);
		}

		return `<SolidColor${this.#color(paint, SOLID_COLOR, "colorValue")}/>`;
	}

	#color(color: StopColor, property: number, attribute: string): string {
		if (!isSlot(color)) {
			return ` ${attribute}="${color}"`;
		}

		const id = this.id();

		this.slots.push({ id, slot: color.slot, alpha: color.alpha, property });

		return ` id="${ref(id)}" ${attribute}="${
			slotColor(this.#fallback, color.slot, color.alpha)
		}"`;
	}

	#gradient(gradient: Gradient): string {
		const tag = gradient.kind === "radial"
			? "RadialGradient"
			: "LinearGradient";
		const [startX, startY] = gradient.from;
		const [endX, endY] = gradient.to;
		const stops = gradient.stops.map(([position, color]) =>
			`<GradientStop${this.#color(color, STOP_COLOR, "colorValue")} position="${
				round(position)
			}"/>`
		).join("");

		return `<${tag} startX="${round(startX)}" startY="${round(startY)}" endX="${
			round(endX)
		}" endY="${round(endY)}">${stops}</${tag}>`;
	}
}

function slotColor(
	tier: Tier,
	name: FinishSlot,
	alpha: number | undefined,
): Color {
	const base = tier.palette[name];

	return alpha === undefined ? base : withAlpha(base, alpha);
}

function transform(item: Transform): string {
	const attrs: [string, number | undefined][] = [
		["x", item.x],
		["y", item.y],
		["rotation", item.rotation],
		["scaleX", item.scaleX],
		["scaleY", item.scaleY],
		["opacity", item.opacity],
	];

	return attrs
		.filter(([, value]) => value !== undefined)
		.map(([name, value]) => ` ${name}="${round(value ?? 0)}"`)
		.join("");
}

function geometry(item: Geometry): string {
	switch (item.kind) {
		case "poly":
			return `<PointsPath isClosed="${item.closed}">${
				item.points.map(([x, y]) =>
					`<StraightVertex x="${round(x)}" y="${round(y)}"${
						item.radius ? ` radius="${round(item.radius)}"` : ""
					}/>`
				).join("")
			}</PointsPath>`;

		case "ellipse":
			return `<Ellipse x="${round(item.x)}" y="${round(item.y)}" width="${
				round(item.width)
			}" height="${round(item.height)}"/>`;

		case "rect":
			return `<Rectangle x="${round(item.x)}" y="${round(item.y)}" width="${
				round(item.width)
			}" height="${round(item.height)}" cornerRadiusTL="${
				round(item.radius)
			}"/>`;

		case "star":
			return `<Star x="${round(item.x)}" y="${round(item.y)}" width="${
				round(item.width)
			}" height="${round(item.height)}" points="${item.points}" innerRadius="${
				round(item.innerRadius)
			}"/>`;
	}
}

// ---------------------------------------------------------------------------
// Keyframes.

type Ease = "ease" | "out" | "in" | "linear" | "hold";
type Key = readonly [frame: number, value: number, ease?: Ease];
type Track = Readonly<{ id: number; property: number; keys: readonly Key[] }>;
type ColorTrack = Readonly<{ id: number; property: number; color: Color }>;

const CURVES: Readonly<Record<"ease" | "out" | "in", string>> = {
	ease: 'x1="0.42" y1="0" x2="0.58" y2="1"',
	out: 'x1="0.16" y1="0.84" x2="0.3" y2="1"',
	in: 'x1="0.55" y1="0" x2="0.9" y2="0.4"',
};

const track = (id: number, property: number, keys: readonly Key[]): Track => ({
	id,
	property,
	keys,
});
const hold = (id: number, property: number, value: number): Track =>
	track(id, property, [[0, value, "hold"]]);

function keyframe([frame, value, ease = "ease"]: Key): string {
	if (ease === "hold" || ease === "linear") {
		return `<KeyFrameDouble frame="${frame}" value="${
			round(value)
		}" interpolationType="${ease}"/>`;
	}

	return `<KeyFrameDouble frame="${frame}" value="${
		round(value)
	}" interpolationType="cubic"><CubicEaseInterpolator ${
		CURVES[ease]
	}/></KeyFrameDouble>`;
}

function keyedObjects(
	tracks: readonly Track[],
	colors: readonly ColorTrack[],
): string {
	const byObject = new Map<number, string[]>();
	const seen = new Set<string>();
	const add = (id: number, property: number, body: string) => {
		const signature = `${id}/${property}`;

		if (seen.has(signature)) {
			throw new Error(`Duplicate track ${signature}`);
		}

		seen.add(signature);
		byObject.set(id, [
			...(byObject.get(id) ?? []),
			`<KeyedProperty propertyKey="${property}">${body}</KeyedProperty>`,
		]);
	};

	for (const item of tracks) {
		add(item.id, item.property, item.keys.map(keyframe).join(""));
	}

	for (const item of colors) {
		add(
			item.id,
			item.property,
			`<KeyFrameColor frame="0" value="${item.color}" interpolationType="hold"/>`,
		);
	}

	return [...byObject].map(([id, properties]) =>
		`<KeyedObject objectId="${ref(id)}">${properties.join("")}</KeyedObject>`
	)
		.join("");
}

function animation(
	name: string,
	id: number,
	duration: number,
	loop: boolean,
	tracks: readonly Track[],
	colors: readonly ColorTrack[] = [],
): string {
	return `<LinearAnimation name="${name}" id="${
		ref(id)
	}" fps="${FPS}" duration="${duration}" loopValue="${
		loop ? "loop" : "oneShot"
	}">${keyedObjects(tracks, colors)}</LinearAnimation>`;
}

// ---------------------------------------------------------------------------
// The scene. Everything is drawn once at full strength; states decide what
// shows. Keys name the groups that motion and visibility target.

const writer = new RmlWriter(TIERS[0] ?? raise("No tiers"));
const SPARKLES = 16;
const BURST_GLINTS = 8;
const BURST_STARS = 14;
const PUFFS = 6;
const BODY_BOUNDS = { left: -152, right: 156, top: -184, bottom: -3 };
const LID_BOUNDS = { left: -152, right: 156, top: -103, bottom: 1 };
const [CX, CY] = AURA_CENTER;

function raise(message: string): never {
	throw new Error(message);
}

function hidden(
	name: string,
	key: string,
	children: readonly Art[],
	extra: Transform = {},
): Art {
	return group(name, { ...extra, opacity: 0 }, children, { key });
}

function foil(
	key: string,
	silhouette: Geometry,
	bounds: typeof BODY_BOUNDS,
): Art {
	const [foilShape, sheen] = holoArt(bounds);
	const sweep = group("Sheen sweep", {}, sheen ? [sheen] : [], {
		key: `${key}-sheen`,
	});

	return group(
		"Holofoil",
		{ opacity: 0 },
		foilShape ? [foilShape, sweep] : [sweep],
		{ key, clip: [silhouette] },
	);
}

function puff(index: number): Art {
	const size = 34 - (index % 3) * 6;

	return hidden("Dust puff", `puff-${index}`, [
		shape("Puff", ellipse(0, 0, size, size * .72), "FFE3D8BC", 2, "FFB8AC8A"),
	], { x: CX, y: 520, scaleX: 0, scaleY: 0 });
}

function burstGlint(index: number): Art {
	const [x, y] = polar(
		300,
		-Math.PI / 2 + (index - (BURST_GLINTS - 1) / 2) * .42,
	);

	return hidden("Burst glint", `burst-glint-${index}`, [sparkleArt(0, 0, 64)], {
		x: CX + x,
		y: CY + 40 + y * .9,
		scaleX: 0,
		scaleY: 0,
	});
}

function burstStar(index: number): Art {
	return hidden("Burst star", `burst-star-${index}`, [
		shape("Star", ellipse(0, 0, 14, 14), "FFFFFFFF", 2.5, slot("glow")),
	], { x: CX, y: CY });
}

const rainbowBand: Gradient = {
	kind: "linear",
	from: [-160, 0],
	to: [160, 0],
	stops: [
		[0, "00FF8AD8"],
		[.2, "B3FF8AD8"],
		[.4, "B3FFE27A"],
		[.6, "B38AFFC1"],
		[.8, "B37FD8FF"],
		[1, "00C39BFF"],
	],
};

const scene: Art[] = [
	group(
		"Backgrounds",
		{},
		Array.from(
			{ length: BACKGROUND_ART_COUNT },
			(_, i) =>
				group(
					`Background ${i}`,
					{ opacity: i === 0 ? 1 : 0 },
					backgroundArt(i),
					{
						key: `background-${i}`,
					},
				),
		),
	),
	hidden("Halo", "halo", haloArt()),
	...cosmosBackArt(3).map((art) => ({ ...art, opacity: 0 })),
	...cosmosBackArt(2).slice(1).map((art) => ({ ...art, opacity: 0 })),
	hidden("Rays", "rays", raysArt(16)),
	hidden("Burst rays", "burst-rays", [
		group("Burst fan", { x: CX, y: CY }, [
			shape(
				"Burst fan",
				Array.from({ length: 24 }, (_, i) => {
					const angle = i * Math.PI / 12;
					const [x1, y1] = polar(640, angle - .07);
					const [x2, y2] = polar(640, angle + .07);

					return poly([[0, 0], [x1, y1], [x2, y2]]);
				}),
				{
					kind: "radial",
					from: [0, 0],
					to: [640, 0],
					stops: [[0, "FFFFF1BA"], [.4, slot("glow", .8)], [
						1,
						slot("glow", 0),
					]],
				},
				0,
			),
		]),
	]),
	hidden("Shockwave", "burst-ring", [
		shape("Ring", ellipse(0, 0, 400, 400), undefined, 10, slot("glow", .9)),
	], {
		x: CX,
		y: CY,
	}),
	group("Stage", {
		x: STAGE.x,
		y: STAGE.y,
		scaleX: STAGE.scale,
		scaleY: STAGE.scale,
	}, [
		chest({
			lid: POSTER_LID,
			bodyPattern: Array.from(
				{ length: PATTERN_ART_COUNT },
				(_, i) =>
					group(
						`Body pattern ${i}`,
						{ opacity: i === 0 ? 1 : 0 },
						patternArt(i, BODY_PANEL),
						{
							key: `pattern-body-${i}`,
						},
					),
			),
			lidPattern: Array.from(
				{ length: PATTERN_ART_COUNT },
				(_, i) =>
					group(
						`Lid pattern ${i}`,
						{ opacity: i === 0 ? 1 : 0 },
						patternArt(i, LID_PANEL),
						{
							key: `pattern-lid-${i}`,
						},
					),
			),
			bodyOverlay: [foil("holo-body", BODY_SILHOUETTE, BODY_BOUNDS)],
			lidOverlay: [foil("holo-lid", LID_SILHOUETTE, LID_BOUNDS)],
			contents: CONTENTS_ART.map((_, i) =>
				contentsRoot(i, { opacity: 0, key: `contents-${i}` })
			),
		}),
	]),
	...cosmosFrontArt(2).map((art) => ({ ...art, opacity: 0 })),
	...cosmosFrontArt(3).map((art) => ({ ...art, opacity: 0 })),
	...sparklePlacements(SPARKLES, "rive-sparkles").map((
		{ x, y, size, rotation },
		i,
	) =>
		hidden("Sparkle", `sparkle-${i}`, [sparkleArt(0, 0, size, rotation)], {
			x,
			y,
		})
	),
	...Array.from({ length: PUFFS }, (_, i) => puff(i)),
	...Array.from({ length: BURST_GLINTS }, (_, i) => burstGlint(i)),
	...Array.from({ length: BURST_STARS }, (_, i) => burstStar(i)),
	hidden("Holo sweep", "burst-holo", [
		shape("Band", rect(0, 0, 320, 1600), rainbowBand, 0),
	], { x: -300, y: CY, rotation: .35 }),
	hidden("Flash", "flash", [
		shape("Flash", rect(CANVAS / 2, CANVAS / 2, CANVAS, CANVAS), "FFFFFFFF", 0),
	]),
];

const artwork = writer.write(scene);
const key = (name: string) => writer.key(name);

// ---------------------------------------------------------------------------
// Chest layer: closed, idle loop, and the reveal one-shot.

const LID = key("lid");
const LOCK = key("lock");
const WOBBLE = key("wobble");
const CONTENTS = key("contents");
const SUNK = 150;
const HIGH = -90;

type LidKey = readonly [frame: number, lift: number, tilt: number, ease?: Ease];

function lidTracks(keys: readonly LidKey[]): Track[] {
	return [
		track(
			LID,
			Y,
			keys.map((
				[frame, lift, , ease],
			) => [frame, LID_Y - lift, ease ?? "ease"]),
		),
		track(
			LID,
			ROTATION,
			keys.map(([frame, , tilt, ease]) => [frame, tilt, ease ?? "ease"]),
		),
		track(
			LOCK,
			Y,
			keys.map((
				[frame, lift, , ease],
			) => [frame, LOCK_Y - lift, ease ?? "ease"]),
		),
	];
}

function squash(keys: readonly Key[]): Track[] {
	return [
		track(WOBBLE, SCALE_Y, keys),
		track(
			WOBBLE,
			SCALE_X,
			keys.map((
				[frame, value, ease],
			) => [frame, 1 + (1 - value) * .8, ease ?? "ease"]),
		),
	];
}

const closedChest = animation("Closed", 30, 1, false, [
	...lidTracks([[0, 0, 0, "hold"]]),
	hold(CONTENTS, Y, CONTENTS_Y + SUNK),
	hold(CONTENTS, OPACITY, 0),
	hold(LOCK, ROTATION, 0),
	...squash([[0, 1, "hold"]]),
]);

const idleChest = animation("Idle", 31, IDLE_FRAMES, true, [
	...lidTracks([
		[0, POSTER_LID.lift, POSTER_LID.tilt],
		[60, POSTER_LID.lift + 8, POSTER_LID.tilt - .02],
		[IDLE_FRAMES, POSTER_LID.lift, POSTER_LID.tilt],
	]),
	track(CONTENTS, Y, [[0, CONTENTS_Y], [60, CONTENTS_Y - 10], [
		IDLE_FRAMES,
		CONTENTS_Y,
	]]),
	hold(CONTENTS, OPACITY, 1),
	track(LOCK, ROTATION, [[0, 0], [30, .06], [90, -.06], [IDLE_FRAMES, 0]]),
	...squash([[0, 1], [60, 1.012], [IDLE_FRAMES, 1]]),
]);

const revealChest = animation("Reveal", 32, REVEAL_FRAMES, false, [
	...lidTracks([
		[0, 0, 0],
		[8, 0, 0, "out"],
		[12, 140, -.32],
		[18, 110, -.22],
		[70, 110, -.22, "in"],
		[84, POSTER_LID.lift - 6, POSTER_LID.tilt],
		[90, POSTER_LID.lift + 2, POSTER_LID.tilt],
		[REVEAL_FRAMES, POSTER_LID.lift, POSTER_LID.tilt],
	]),
	track(LOCK, ROTATION, [[0, 0], [12, .5], [18, -.3], [24, .15], [30, 0], [
		REVEAL_FRAMES,
		0,
	]]),
	track(WOBBLE, ROTATION, [[0, 0], [2, .05], [4, -.05], [6, .03], [8, 0], [
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
		[80, 1],
		[84, .95],
		[90, 1],
		[
			REVEAL_FRAMES,
			1,
		],
	]),
	track(CONTENTS, Y, [
		[0, CONTENTS_Y + SUNK, "hold"],
		[9, CONTENTS_Y + SUNK, "out"],
		[15, CONTENTS_Y + HIGH - 30],
		[22, CONTENTS_Y + HIGH],
		[40, CONTENTS_Y + HIGH - 12],
		[58, CONTENTS_Y + HIGH],
		[72, CONTENTS_Y + HIGH - 8, "in"],
		[86, CONTENTS_Y],
		[REVEAL_FRAMES, CONTENTS_Y],
	]),
	track(CONTENTS, OPACITY, [[0, 0, "hold"], [9, 1, "hold"], [
		REVEAL_FRAMES,
		1,
		"hold",
	]]),
]);

// ---------------------------------------------------------------------------
// Tier layer: one pose per tier sets the finish colors and which effects show.

const COSMOS_KEYS = [
	"cosmos-1",
	"cosmos-2-back",
	"cosmos-2-front",
	"cosmos-3-back",
	"cosmos-3-front",
] as const;

function cosmosOpacity(
	name: (typeof COSMOS_KEYS)[number],
	level: number,
): number {
	switch (name) {
		case "cosmos-1":
			return level >= 1 ? 1 : 0;

		case "cosmos-2-back":
		case "cosmos-2-front":
			return level === 2 ? 1 : 0;

		case "cosmos-3-back":
		case "cosmos-3-front":
			return level >= 3 ? 1 : 0;
	}
}

function tierPose(tier: Tier, id: number): string {
	const { effects } = tier;
	const colors = writer.slots.map((paint): ColorTrack => ({
		id: paint.id,
		property: paint.property,
		color: slotColor(tier, paint.slot, paint.alpha),
	}));

	return animation(`Tier ${tier.index}`, id, 1, false, [
		hold(key("halo"), OPACITY, effects.halo),
		hold(key("rays"), OPACITY, effects.rays > 0 ? .9 : 0),
		hold(key("holo-body"), OPACITY, effects.holo),
		hold(key("holo-lid"), OPACITY, effects.holo),
		...COSMOS_KEYS.map((name) =>
			hold(key(name), OPACITY, cosmosOpacity(name, effects.cosmos))
		),
		...Array.from(
			{ length: SPARKLES },
			(_, i) =>
				hold(key(`sparkle-${i}`), OPACITY, i < effects.sparkles ? 1 : 0),
		),
	], colors);
}

// ---------------------------------------------------------------------------
// Trait layers: one pose per value shows exactly one group.

function onlyShown(
	prefix: string,
	count: number,
	shown: number | null,
): Track[] {
	return Array.from(
		{ length: count },
		(_, i) => hold(key(`${prefix}-${i}`), OPACITY, i === shown ? 1 : 0),
	);
}

// ---------------------------------------------------------------------------
// Ambient loop: rays turn one ray-width per loop (seamless), sparkles
// twinkle out of phase, foil sheen drifts, the corona breathes.

const ambient = animation("Ambient", 33, AMBIENT_FRAMES, true, [
	track(key("rays-spin"), ROTATION, [[0, 0, "linear"], [
		AMBIENT_FRAMES,
		Math.PI * 2 / 16,
		"linear",
	]]),
	...Array.from({ length: SPARKLES }, (_, i) => {
		const offset = (i * 17) % 60;
		const keys: Key[] = [[0, 1]];

		// One 32-frame twinkle per second, skipping any that would wrap.
		for (let start = offset; start + 32 < AMBIENT_FRAMES; start += 60) {
			if (start > 0) {
				keys.push([start, 1]);
			}

			keys.push([start + 12, .45], [start + 24, 1.12], [start + 32, 1]);
		}

		keys.push([AMBIENT_FRAMES, 1]);

		return [
			track(key(`sparkle-${i}`), SCALE_X, keys),
			track(key(`sparkle-${i}`), SCALE_Y, keys),
		];
	}).flat(),
	track(key("holo-body-sheen"), X, [[0, -120], [120, 160], [
		AMBIENT_FRAMES,
		-120,
	]]),
	track(key("holo-lid-sheen"), X, [[0, -140], [120, 140], [
		AMBIENT_FRAMES,
		-140,
	]]),
	track(key("cosmos-1"), SCALE_X, [[0, 1], [120, 1.02], [AMBIENT_FRAMES, 1]]),
]);

// ---------------------------------------------------------------------------
// Drama layer: the reveal's celebration, escalating with the tier.

function dramaRest(): Track[] {
	return [
		...Array.from(
			{ length: PUFFS },
			(_, i) => hold(key(`puff-${i}`), OPACITY, 0),
		),
		...Array.from(
			{ length: BURST_GLINTS },
			(_, i) => hold(key(`burst-glint-${i}`), OPACITY, 0),
		),
		...Array.from(
			{ length: BURST_STARS },
			(_, i) => hold(key(`burst-star-${i}`), OPACITY, 0),
		),
		hold(key("burst-rays"), OPACITY, 0),
		hold(key("burst-ring"), OPACITY, 0),
		hold(key("burst-holo"), OPACITY, 0),
		hold(key("flash"), OPACITY, 0),
	];
}

function dustTracks(): Track[] {
	return Array.from({ length: PUFFS }, (_, i) => {
		const id = key(`puff-${i}`);
		const side = i < PUFFS / 2 ? -1 : 1;
		const row = i % 3;
		const at = 10 + row * 2;
		const startX = CX + side * 230;
		const endX = CX + side * (300 + row * 34);
		const endY = 520 - row * 36;
		const scale: Key[] = [
			[0, 0, "hold"],
			[at, 0, "out"],
			[at + 8, 1.2 - row * .15],
			[at + 22, 1.5 - row * .2],
			[
				DRAMA_FRAMES,
				1.5 - row * .2,
			],
		];

		return [
			track(id, X, [[0, startX, "hold"], [at, startX, "out"], [at + 22, endX], [
				DRAMA_FRAMES,
				endX,
			]]),
			track(id, Y, [[0, 540, "hold"], [at, 540, "out"], [at + 22, endY], [
				DRAMA_FRAMES,
				endY,
			]]),
			track(id, SCALE_X, scale),
			track(id, SCALE_Y, scale),
			track(id, OPACITY, [[0, 0, "hold"], [at, 1, "hold"], [at + 8, 1, "in"], [
				at + 24,
				0,
			], [DRAMA_FRAMES, 0]]),
		];
	}).flat();
}

function glintTracks(): Track[] {
	return Array.from({ length: BURST_GLINTS }, (_, i) => {
		const id = key(`burst-glint-${i}`);
		const at = 12 + i * 3;
		const scale: Key[] = [
			[0, 0, "hold"],
			[at, 0, "out"],
			[at + 6, 1.25],
			[at + 12, .9],
			[at + 24, 0, "in"],
			[
				DRAMA_FRAMES,
				0,
			],
		];

		return [
			track(id, SCALE_X, scale),
			track(id, SCALE_Y, scale),
			track(id, ROTATION, [[0, 0], [at, 0], [at + 24, .8], [DRAMA_FRAMES, .8]]),
			track(id, OPACITY, [[0, 0, "hold"], [at, 1, "hold"], [
				DRAMA_FRAMES,
				1,
				"hold",
			]]),
		];
	}).flat();
}

function goldBurstTracks(): Track[] {
	const rays = key("burst-rays");
	const ring = key("burst-ring");
	const fan: Key[] = [[0, .2, "hold"], [10, .2, "out"], [26, 1.3], [
		DRAMA_FRAMES,
		1.45,
	]];
	const wave: Key[] = [[0, .2, "hold"], [11, .2, "out"], [40, 2.6], [
		DRAMA_FRAMES,
		2.6,
	]];

	return [
		track(rays, SCALE_X, fan),
		track(rays, SCALE_Y, fan),
		track(rays, ROTATION, [[0, 0], [10, 0], [DRAMA_FRAMES, .5]]),
		track(rays, OPACITY, [[0, 0, "hold"], [10, 0], [16, 1], [50, .8], [80, 0], [
			DRAMA_FRAMES,
			0,
		]]),
		track(ring, SCALE_X, wave),
		track(ring, SCALE_Y, wave),
		track(ring, OPACITY, [[0, 0, "hold"], [11, 1, "hold"], [40, 0], [
			DRAMA_FRAMES,
			0,
		]]),
	];
}

function holoTracks(): Track[] {
	const band = key("burst-holo");

	return [
		track(band, X, [[0, -300, "hold"], [14, -300], [50, CANVAS + 300], [
			DRAMA_FRAMES,
			CANVAS + 300,
		]]),
		track(band, OPACITY, [[0, 0, "hold"], [14, 1, "hold"], [50, 0, "hold"], [
			DRAMA_FRAMES,
			0,
			"hold",
		]]),
	];
}

function cosmicTracks(): Track[] {
	const flash = key("flash");
	const stars = Array.from({ length: BURST_STARS }, (_, i) => {
		const id = key(`burst-star-${i}`);
		const angle = i / BURST_STARS * Math.PI * 2;
		const [x, y] = polar(360 + (i % 3) * 60, angle + 1.2);
		const [midX, midY] = polar(160, angle + .5);
		const at = 12 + (i % 4);
		const scale: Key[] = [[0, .2, "hold"], [at, .2, "out"], [at + 14, 1.4], [
			at + 50,
			.3,
		], [DRAMA_FRAMES, .3]];

		return [
			track(id, X, [[0, CX, "hold"], [at, CX, "out"], [at + 14, CX + midX], [
				at + 50,
				CX + x,
			], [DRAMA_FRAMES, CX + x]]),
			track(id, Y, [[0, CY, "hold"], [at, CY, "out"], [at + 14, CY + midY], [
				at + 50,
				CY + y,
			], [DRAMA_FRAMES, CY + y]]),
			track(id, SCALE_X, scale),
			track(id, SCALE_Y, scale),
			track(id, OPACITY, [[0, 0, "hold"], [at, 1, "hold"], [at + 36, 1], [
				at + 56,
				0,
			], [DRAMA_FRAMES, 0]]),
		];
	}).flat();

	return [
		...stars,
		track(flash, OPACITY, [[0, 0, "hold"], [10, 0, "out"], [13, .85], [26, 0], [
			DRAMA_FRAMES,
			0,
		]]),
	];
}

function dramaTracks(stage: RevealDrama): Track[] {
	const level = REVEAL_DRAMA_ORDER.indexOf(stage);
	const byLevel: readonly (() => Track[])[] = [
		dustTracks,
		glintTracks,
		goldBurstTracks,
		holoTracks,
		cosmicTracks,
	];
	const active = byLevel.slice(0, level + 1).flatMap((build) => build());
	const keyed = new Set(active.map((item) => `${item.id}/${item.property}`));

	// Every drama animation keys every burst object, so switching stages never
	// strands a burst from a previous reveal on screen.
	return [
		...active,
		...dramaRest().filter((item) => !keyed.has(`${item.id}/${item.property}`)),
	];
}

// ---------------------------------------------------------------------------
// Animation ids.

const TIER_ANIMATION = 100;
const BACKGROUND_ANIMATION = 140;
const PATTERN_ANIMATION = 160;
const CONTENTS_ANIMATION = 180;
const DRAMA_ANIMATION = 220;
const DRAMA_REST = 219;

const tierPoses = TIERS.map((tier) =>
	tierPose(tier, TIER_ANIMATION + tier.index)
);
const backgroundPoses = Array.from(
	{ length: BACKGROUND_ART_COUNT },
	(_, i) =>
		animation(
			`Background ${i}`,
			BACKGROUND_ANIMATION + i,
			1,
			false,
			onlyShown("background", BACKGROUND_ART_COUNT, i),
		),
);
const patternPoses = Array.from(
	{ length: PATTERN_ART_COUNT },
	(_, i) =>
		animation(`Pattern ${i}`, PATTERN_ANIMATION + i, 1, false, [
			...onlyShown("pattern-body", PATTERN_ART_COUNT, i),
			...onlyShown("pattern-lid", PATTERN_ART_COUNT, i),
		]),
);
const noContents = animation(
	"No contents",
	CONTENTS_ANIMATION - 1,
	1,
	false,
	onlyShown("contents", CONTENTS_ART.length, null),
);
const contentsPoses = CONTENTS_ART.map((_, i) =>
	animation(
		`Contents ${i}`,
		CONTENTS_ANIMATION + i,
		1,
		false,
		onlyShown("contents", CONTENTS_ART.length, i),
	)
);
const dramaRestAnimation = animation(
	"Drama rest",
	DRAMA_REST,
	1,
	false,
	dramaRest(),
);
const dramaAnimations = REVEAL_DRAMA_ORDER.map((stage, i) =>
	animation(
		`Drama ${stage}`,
		DRAMA_ANIMATION + i,
		DRAMA_FRAMES,
		false,
		dramaTracks(stage),
	)
);

// ---------------------------------------------------------------------------
// State machine.

type Property = keyof typeof PROPERTY;

function numberIs(
	property: Exclude<Property, "reveal">,
	op: string,
	value: number,
): string {
	return `<TransitionViewModelCondition opValue="${op}"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="${
		ref(VIEW_MODEL)
	}-${
		ref(PROPERTY[property])
	}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${value}"/></TransitionViewModelCondition>`;
}

const revealFired =
	`<TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyTrigger><DataBindContext sourcePathIds="${
		ref(VIEW_MODEL)
	}-${
		ref(PROPERTY.reveal)
	}" propertyKey="686"/></BindablePropertyTrigger></TransitionPropertyViewModelComparator><TransitionValueTriggerComparator/></TransitionViewModelCondition>`;

const afterExit = (to: number) =>
	`<StateTransition stateToId="${
		ref(to)
	}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`;

let stateId = 300;
const nextState = () => stateId++;

/**
 * A layer that mirrors one number property: a rest pose, then one pose per
 * value. Leaving a pose goes back through rest, so any change of value lands.
 */
function selectorLayer(
	name: string,
	property: Exclude<Property, "reveal">,
	restAnimation: number,
	animations: readonly number[],
): string {
	const rest = nextState();
	const states = animations.map(() => nextState());

	return `<StateMachineLayer name="${name}"><AnyState x="0" y="-150"/><ExitState x="800" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="${
		ref(rest)
	}"/></EntryState><AnimationState id="${ref(rest)}" animationId="${
		ref(restAnimation)
	}" x="200" y="0">${
		states.map((state, value) =>
			`<StateTransition stateToId="${ref(state)}">${
				numberIs(property, "equal", value)
			}</StateTransition>`
		)
			.join("")
	}</AnimationState>${
		states.map((state, value) =>
			`<AnimationState id="${ref(state)}" animationId="${
				ref(animations[value] ?? raise("missing animation"))
			}" x="450" y="${value * 100}"><StateTransition stateToId="${ref(rest)}">${
				numberIs(property, "notEqual", value)
			}</StateTransition></AnimationState>`
		).join("")
	}</StateMachineLayer>`;
}

function chestLayer(): string {
	const closed = nextState();
	const idle = nextState();
	const reveal = nextState();

	return `<StateMachineLayer name="Chest"><AnyState x="0" y="-150"><StateTransition stateToId="${
		ref(reveal)
	}">${revealFired}</StateTransition></AnyState><ExitState x="600" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="${
		ref(closed)
	}"/></EntryState><AnimationState id="${ref(closed)}" animationId="${
		ref(30)
	}" x="200" y="0"><StateTransition stateToId="${ref(idle)}">${
		numberIs("contents", "greaterThanOrEqual", 0)
	}</StateTransition></AnimationState><AnimationState id="${
		ref(idle)
	}" animationId="${ref(31)}" x="400" y="0"/><AnimationState id="${
		ref(reveal)
	}" animationId="${ref(32)}" reset="true" x="400" y="-150">${
		afterExit(idle)
	}</AnimationState></StateMachineLayer>`;
}

function ambientLayer(): string {
	const loop = nextState();

	return `<StateMachineLayer name="Ambient"><AnyState x="0" y="-150"/><ExitState x="400" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="${
		ref(loop)
	}"/></EntryState><AnimationState id="${ref(loop)}" animationId="${
		ref(33)
	}" x="200" y="0"/></StateMachineLayer>`;
}

/** Tier ranges per drama stage, from the tier table. */
function dramaRange(stage: RevealDrama): readonly [number, number] {
	const indices = TIERS.filter((tier) => tier.drama === stage).map((tier) =>
		tier.index
	);

	return [Math.min(...indices), Math.max(...indices)];
}

function dramaLayer(): string {
	const rest = nextState();
	const states = REVEAL_DRAMA_ORDER.map(() => nextState());
	const transitions = REVEAL_DRAMA_ORDER.map((stage, i) => {
		const [low, high] = dramaRange(stage);

		return `<StateTransition stateToId="${
			ref(states[i] ?? raise("missing state"))
		}">${revealFired}${numberIs("tier", "greaterThanOrEqual", low)}${
			numberIs("tier", "lessThanOrEqual", high)
		}</StateTransition>`;
	}).join("");

	return `<StateMachineLayer name="Drama"><AnyState x="0" y="-150">${transitions}</AnyState><ExitState x="800" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="${
		ref(rest)
	}"/></EntryState><AnimationState id="${ref(rest)}" animationId="${
		ref(DRAMA_REST)
	}" x="200" y="0"/>${
		states.map((state, i) =>
			`<AnimationState id="${ref(state)}" animationId="${
				ref(DRAMA_ANIMATION + i)
			}" reset="true" x="450" y="${i * 100}">${
				afterExit(rest)
			}</AnimationState>`
		).join("")
	}</StateMachineLayer>`;
}

const machine = `<StateMachine name="Exclusive NFT" id="${
	ref(STATE_MACHINE)
}">${chestLayer()}${
	selectorLayer(
		"Tier",
		"tier",
		TIER_ANIMATION,
		TIERS.map((tier) => TIER_ANIMATION + tier.index),
	)
}${
	selectorLayer(
		"Background",
		"background",
		BACKGROUND_ANIMATION,
		Array.from({ length: BACKGROUND_ART_COUNT }, (_, i) =>
			BACKGROUND_ANIMATION + i),
	)
}${
	selectorLayer(
		"Pattern",
		"pattern",
		PATTERN_ANIMATION,
		Array.from({ length: PATTERN_ART_COUNT }, (_, i) => PATTERN_ANIMATION + i),
	)
}${
	selectorLayer(
		"Contents",
		"contents",
		CONTENTS_ANIMATION - 1,
		CONTENTS_ART.map((_, i) => CONTENTS_ANIMATION + i),
	)
}${ambientLayer()}${dramaLayer()}</StateMachine>`;

// ---------------------------------------------------------------------------
// Document.

const viewModel = `<ViewModel name="Exclusive NFT" id="${
	ref(VIEW_MODEL)
}" defaultInstanceId="${
	ref(VIEW_MODEL_INSTANCE)
}"><ViewModelPropertyNumber name="tier" id="${
	ref(PROPERTY.tier)
}"/><ViewModelPropertyNumber name="contents" id="${
	ref(PROPERTY.contents)
}"/><ViewModelPropertyNumber name="background" id="${
	ref(PROPERTY.background)
}"/><ViewModelPropertyNumber name="pattern" id="${
	ref(PROPERTY.pattern)
}"/><ViewModelPropertyTrigger name="reveal" id="${
	ref(PROPERTY.reveal)
}"/><ViewModelInstance name="Default" id="${
	ref(VIEW_MODEL_INSTANCE)
}" exports="true"><ViewModelInstanceNumber viewModelPropertyId="${
	ref(PROPERTY.tier)
}" propertyValue="0"/><ViewModelInstanceNumber viewModelPropertyId="${
	ref(PROPERTY.contents)
}" propertyValue="-1"/><ViewModelInstanceNumber viewModelPropertyId="${
	ref(PROPERTY.background)
}" propertyValue="0"/><ViewModelInstanceNumber viewModelPropertyId="${
	ref(PROPERTY.pattern)
}" propertyValue="0"/><ViewModelInstanceTrigger viewModelPropertyId="${
	ref(PROPERTY.reveal)
}"/></ViewModelInstance></ViewModel>`;

const animations = [
	closedChest,
	idleChest,
	revealChest,
	ambient,
	...tierPoses,
	...backgroundPoses,
	...patternPoses,
	noContents,
	...contentsPoses,
	dramaRestAnimation,
	...dramaAnimations,
].join("\n");

const document =
	`<!-- Generated by generate.ts from @pina-rs/exclusive-nft-art. Do not edit by hand. -->
<Rive version="1" kind="fragment">
  <Artboard name="Exclusive NFT" id="${
		ref(ARTBOARD)
	}" width="${CANVAS}" height="${CANVAS}" originX="0" originY="0" styleId="${
		ref(LAYOUT_STYLE)
	}" defaultStateMachineId="${ref(STATE_MACHINE)}" viewModelId="${
		ref(VIEW_MODEL)
	}">
    <LayoutComponentStyle name="Fixed illustration" id="${ref(LAYOUT_STYLE)}"/>
${artwork}
${animations}
${machine}
  </Artboard>
  ${viewModel}
</Rive>
`;

writeFileSync(new URL("./scene.rml", import.meta.url), document);
console.log(
	`Wrote scene.rml: ${writer.keys.size} keyed groups, ${writer.slots.length} finish paints, ${
		(document.length / 1024).toFixed(0)
	} KB`,
);
