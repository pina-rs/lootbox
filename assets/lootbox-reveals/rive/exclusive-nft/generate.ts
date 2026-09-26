import { writeFileSync } from "node:fs";

import {
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
import { contentsRoot } from "../../../../packages/exclusive-nft-art/src/art/contents.ts";
import { decorationArt } from "../../../../packages/exclusive-nft-art/src/art/decorations.ts";
import {
	AURA_CENTER,
	effectArt,
	haloArt,
	holoArt,
	sparkleArt,
} from "../../../../packages/exclusive-nft-art/src/art/effects.ts";
import { lockArt } from "../../../../packages/exclusive-nft-art/src/art/locks.ts";
import {
	type Art,
	ellipse,
	type Geometry,
	group,
	polar,
	poly,
	rect,
	shape,
	type Transform,
} from "../../../../packages/exclusive-nft-art/src/art/model.ts";
import { patternArt } from "../../../../packages/exclusive-nft-art/src/art/patterns.ts";
import {
	FINISHES,
	REVEAL_DRAMA_ORDER,
	type RevealDrama,
} from "../../../../packages/exclusive-nft-art/src/finishes.ts";
import {
	LAYER,
	type LayerId,
	LAYERS,
} from "../../../../packages/exclusive-nft-art/src/layers.ts";
import {
	BODY_BOUNDS,
	LID_BOUNDS,
	STAGE,
} from "../../../../packages/exclusive-nft-art/src/render.ts";
import {
	RENDER_RULES,
	type RenderRule,
} from "../../../../packages/exclusive-nft-art/src/rules.ts";
import {
	add,
	animation,
	type ColorTrack,
	cycleFrames,
	type Ease,
	equals,
	type Expr,
	hold,
	input,
	type Key,
	motionTracks,
	mul,
	num,
	property,
	PROPERTY_KEY,
	raise,
	ref,
	RmlWriter,
	slotColor,
	sub,
	tokens,
	type Track,
	track,
} from "./rml.ts";

/**
 * Generates `scene.rml` for the Exclusive NFT reveal.
 *
 * All artwork and idle motion come from `@pina-rs/exclusive-nft-art`, the same
 * model that renders the SVG posters, so still, animated SVG, and Rive match.
 * The Rive file adds three things of its own:
 *
 * - **Visibility by data binding.** Every trait group, in its layer's
 *   back-to-front order, binds its opacity to its layer's view-model number
 *   through a per-trait converter that is 1 for that trait and 0 otherwise,
 *   and render rules fold into the same formulas.
 * - **Finish poses** in a state machine layer, recoloring the chest's paints.
 * - **The reveal**: the chest pops, and a celebration that escalates with the
 *   finish plays over the layers.
 */

const {
	x: X,
	y: Y,
	rotation: ROTATION,
	scaleX: SCALE_X,
	scaleY: SCALE_Y,
	opacity: OPACITY,
} = PROPERTY_KEY;

// ---------------------------------------------------------------------------
// Fixed ids.

const ARTBOARD = 1;
const LAYOUT_STYLE = 2;
const STATE_MACHINE = 3;
const VIEW_MODEL = 40;
const VIEW_MODEL_INSTANCE = 41;
/** One number per layer, then the reveal trigger. */
const PROPERTY_ID: Readonly<Record<LayerId, number>> = Object.fromEntries(
	LAYERS.map((layer) => [layer.id, 42 + layer.index]),
) as Record<LayerId, number>;
const REVEAL = 42 + LAYERS.length;

const IDLE_FRAMES = 120;
const REVEAL_FRAMES = 96;
const DRAMA_FRAMES = 90;
const [CX, CY] = AURA_CENTER;

const writer = new RmlWriter(
	FINISHES[0]?.palette ?? raise("No finishes"),
	VIEW_MODEL,
);
const converters: string[] = [];

// ---------------------------------------------------------------------------
// Visibility: one converter per trait, folding in the render rules.

/** 1 while every condition of `rule` holds. */
function ruleActive(rule: RenderRule): Expr {
	return Object.entries(rule.when)
		.map(([layer, values]): Expr => {
			const source = property(PROPERTY_ID[layer as LayerId]);

			return values.map((value) => equals(source, value)).reduce((a, b) =>
				add(a, b)
			);
		})
		.reduce((a, b) => mul(a, b));
}

/** Converters by formula, so a trait's body and lid parts share one. */
const converterIds = new Map<string, number>();

function converter(name: string, expr: Expr): number {
	const body = tokens(expr, VIEW_MODEL);
	const existing = converterIds.get(body);

	if (existing !== undefined) {
		return existing;
	}

	const id = writer.id();

	converterIds.set(body, id);
	converters.push(
		`<DataConverterFormula name="${name}" id="${
			ref(id)
		}">${body}</DataConverterFormula>`,
	);

	return id;
}

/** A trait's group: shown only when its layer holds `trait` and no rule hides it. */
function traitGroup(
	layer: LayerId,
	trait: number,
	art: readonly Art[],
	part = "",
	transform: Transform = {},
): Art {
	const key = `${layer}${part}-${trait}`;
	// A hide rule that names this layer only ever hides the traits it lists.
	const hiders = RENDER_RULES.filter((rule) =>
		rule.effect.kind === "hide" && rule.effect.layer === layer &&
		(rule.when[layer]?.includes(trait) ?? true)
	);
	const visible = hiders.reduce(
		(shown, rule) => mul(shown, sub(num(1), ruleActive(rule))),
		equals(input, trait),
	);

	writer.bind(key, {
		source: PROPERTY_ID[layer],
		propertyKey: OPACITY,
		converter: converter(`${layer} ${trait}${part} visible`, visible),
	});

	const authored = layer !== "contents" && trait === 0 ? 1 : 0;

	return group(
		`${layer} ${trait}${part}`,
		{ ...transform, opacity: authored },
		art,
		{ key },
	);
}

/** A layer's traits in index order: later traits draw above earlier ones. */
function layerGroups(
	layer: LayerId,
	draw: (trait: number) => readonly Art[],
	part = "",
): Art[] {
	const count = LAYERS[LAYER[layer]]?.traits.length ?? 0;

	return Array.from(
		{ length: count },
		(_, trait) => traitGroup(layer, trait, draw(trait), part),
	);
}

/** Offsets from render rules, bound onto the lock's offset node. */
function bindLockOffset(): void {
	for (const axis of ["x", "y"] as const) {
		const terms = RENDER_RULES.filter((rule) =>
			rule.effect.kind === "offset" && rule.effect.layer === "lock"
		)
			.map((rule) =>
				mul(
					num(rule.effect.kind === "offset" ? rule.effect[axis] : 0),
					ruleActive(rule),
				)
			);

		if (!terms.length) {
			continue;
		}

		writer.bind("lock-offset", {
			source: PROPERTY_ID.lock,
			propertyKey: PROPERTY_KEY[axis],
			converter: converter(
				`lock offset ${axis}`,
				terms.reduce((a, b) => add(a, b)),
			),
		});
	}
}

// ---------------------------------------------------------------------------
// Rive-only reveal pieces. Each keyed group sits at its own pivot, so scale
// and rotation keys turn it in place.

const BURST_GLINTS = 8;
const BURST_STARS = 14;
const PUFFS = 6;
const GOLD = "FFFFC94A";

function hidden(
	name: string,
	key: string,
	children: readonly Art[],
	transform: Transform = {},
): Art {
	return group(name, { ...transform, opacity: 0 }, children, { key });
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
		shape("Star", ellipse(0, 0, 14, 14), "FFFFFFFF", 2.5, GOLD),
	], { x: CX, y: CY });
}

function burstFan(): Art {
	const wedges: Geometry[] = Array.from({ length: 24 }, (_, i) => {
		const angle = i * Math.PI / 12;
		const [x1, y1] = polar(640, angle - .07);
		const [x2, y2] = polar(640, angle + .07);

		return poly([[0, 0], [x1, y1], [x2, y2]]);
	});

	// Pivot on the keyed group itself (review fix): the fan is drawn around the
	// group's origin, so the burst scales and spins about the aura centre.
	return hidden("Burst rays", "burst-rays", [
		shape("Burst fan", wedges, {
			kind: "radial",
			from: [0, 0],
			to: [640, 0],
			stops: [[0, "FFFFF1BA"], [.4, "CCFFC94A"], [1, "00FFC94A"]],
		}, 0),
	], { x: CX, y: CY });
}

function foil(
	key: string,
	silhouette: Geometry,
	bounds: typeof BODY_BOUNDS,
): Art {
	return group("Holofoil", { opacity: 0 }, holoArt(bounds), {
		key,
		clip: [silhouette],
	});
}

// ---------------------------------------------------------------------------
// The scene, back to front.

bindLockOffset();

const effects =
	LAYERS[LAYER.effect]?.traits.map((trait) =>
		effectArt(trait.index, "glints-rive")
	) ?? [];
const decorations =
	LAYERS[LAYER.decoration]?.traits.map((trait) => decorationArt(trait.index)) ??
		[];

const scene: Art[] = [
	group("Backgrounds", {}, layerGroups("background", backgroundArt)),
	group("Finish glow", { opacity: 0 }, [haloArt()], { key: "finish-glow" }),
	group(
		"Effects behind",
		{},
		layerGroups("effect", (i) => effects[i]?.back ?? [], "-back"),
	),
	burstFan(),
	hidden("Shockwave", "burst-ring", [
		shape("Ring", ellipse(0, 0, 400, 400), undefined, 10, "E6FFC94A"),
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
			bodyPattern: layerGroups(
				"pattern",
				(i) => patternArt(i, BODY_PANEL),
				"-body",
			),
			lidPattern: layerGroups(
				"pattern",
				(i) => patternArt(i, LID_PANEL),
				"-lid",
			),
			bodyOverlay: [foil("holo-body", BODY_SILHOUETTE, BODY_BOUNDS)],
			lidOverlay: [foil("holo-lid", LID_SILHOUETTE, LID_BOUNDS)],
			bodyDecoration: layerGroups(
				"decoration",
				(i) => decorations[i]?.body ?? [],
				"-body",
			),
			lidDecoration: layerGroups(
				"decoration",
				(i) => decorations[i]?.lid ?? [],
				"-lid",
			),
			lock: layerGroups("lock", lockArt),
			lockOffset: { x: 0, y: 0 },
			contents: layerGroups("contents", (i) => [contentsRoot(i)]),
		}),
	]),
	group(
		"Effects in front",
		{},
		layerGroups("effect", (i) => effects[i]?.front ?? [], "-front"),
	),
	...Array.from({ length: PUFFS }, (_, i) => puff(i)),
	...Array.from({ length: BURST_GLINTS }, (_, i) => burstGlint(i)),
	...Array.from({ length: BURST_STARS }, (_, i) => burstStar(i)),
	hidden("Holo sweep", "burst-holo", [
		shape("Band", rect(0, 0, 320, 1600), {
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
		}, 0),
	], { x: -300, y: CY, rotation: .35 }),
	hidden("Flash", "flash", [
		shape("Flash", rect(CANVAS / 2, CANVAS / 2, CANVAS, CANVAS), "FFFFFFFF", 0),
	]),
];

const artwork = writer.write(scene);
const key = (name: string) => writer.key(name);

// ---------------------------------------------------------------------------
// Chest layer: closed, idle pose, and the reveal one-shot. Breathing comes
// from the ambient loop's motion wrappers, so these key only the rest pose.

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
	hold(WOBBLE, ROTATION, 0),
	...squash([[0, 1, "hold"]]),
]);

const idleChest = animation("Idle", 31, IDLE_FRAMES, true, [
	...lidTracks([[0, POSTER_LID.lift, POSTER_LID.tilt, "hold"]]),
	hold(CONTENTS, Y, CONTENTS_Y),
	hold(CONTENTS, OPACITY, 1),
	hold(LOCK, ROTATION, 0),
	hold(WOBBLE, ROTATION, 0),
	...squash([[0, 1, "hold"]]),
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
		[REVEAL_FRAMES, 1],
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
// Finish layer: one pose per finish recolors every slotted paint and sets the
// material's glow and foil.

function finishPose(index: number, id: number): string {
	const finish = FINISHES[index] ?? raise(`No finish ${index}`);
	const colors = writer.slots.map((paint): ColorTrack => ({
		id: paint.id,
		property: paint.property,
		color: slotColor(finish.palette, paint.slot, paint.alpha),
	}));

	return animation(`Finish ${index}`, id, 1, false, [
		hold(key("finish-glow"), OPACITY, finish.halo),
		hold(key("holo-body"), OPACITY, finish.holo),
		hold(key("holo-lid"), OPACITY, finish.holo),
	], colors);
}

// ---------------------------------------------------------------------------
// Ambient loops: every motion wrapper in the scene, from the shared model.
// Motions of one duration share a looping animation on its own layer, so each
// is keyed once per cycle rather than repeated across a long loop.

const AMBIENT_ANIMATION = 60;
const durations = [
	...new Set(writer.motions.map(({ use }) => use.motion.duration)),
].sort((a, b) => a - b);
const ambients = durations.map((seconds, i) =>
	animation(
		`Ambient ${seconds}s`,
		AMBIENT_ANIMATION + i,
		cycleFrames(seconds),
		true,
		writer.motions.filter(({ use }) => use.motion.duration === seconds).flatMap(
			({ id, use }) => motionTracks(id, use),
		),
	)
);

// ---------------------------------------------------------------------------
// Drama layer: the reveal's celebration, escalating with the finish.

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
			[DRAMA_FRAMES, 0],
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
// Animations and state machine.

const FINISH_ANIMATION = 100;
const DRAMA_ANIMATION = 220;
const DRAMA_REST = 219;

const finishPoses = FINISHES.map((_, i) => finishPose(i, FINISH_ANIMATION + i));
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

function numberIs(layer: LayerId, op: string, value: number): string {
	return `<TransitionViewModelCondition opValue="${op}"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="${
		ref(VIEW_MODEL)
	}-${
		ref(PROPERTY_ID[layer])
	}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${value}"/></TransitionViewModelCondition>`;
}

const revealFired =
	`<TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyTrigger><DataBindContext sourcePathIds="${
		ref(VIEW_MODEL)
	}-${
		ref(REVEAL)
	}" propertyKey="686"/></BindablePropertyTrigger></TransitionPropertyViewModelComparator><TransitionValueTriggerComparator/></TransitionViewModelCondition>`;

const afterExit = (to: number) =>
	`<StateTransition stateToId="${
		ref(to)
	}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`;

let stateId = 300;
const nextState = () => stateId++;

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

/** One pose per finish; leaving a pose returns through rest, so any change lands. */
function finishLayer(): string {
	const rest = nextState();
	const states = FINISHES.map(() => nextState());

	return `<StateMachineLayer name="Finish"><AnyState x="0" y="-150"/><ExitState x="800" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="${
		ref(rest)
	}"/></EntryState><AnimationState id="${ref(rest)}" animationId="${
		ref(FINISH_ANIMATION)
	}" x="200" y="0">${
		states.map((state, value) =>
			`<StateTransition stateToId="${ref(state)}">${
				numberIs("finish", "equal", value)
			}</StateTransition>`
		).join("")
	}</AnimationState>${
		states.map((state, value) =>
			`<AnimationState id="${ref(state)}" animationId="${
				ref(FINISH_ANIMATION + value)
			}" x="450" y="${value * 100}"><StateTransition stateToId="${ref(rest)}">${
				numberIs("finish", "notEqual", value)
			}</StateTransition></AnimationState>`
		).join("")
	}</StateMachineLayer>`;
}

function ambientLayer(seconds: number, index: number): string {
	const loop = nextState();

	return `<StateMachineLayer name="Ambient ${seconds}s"><AnyState x="0" y="-150"/><ExitState x="400" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="${
		ref(loop)
	}"/></EntryState><AnimationState id="${ref(loop)}" animationId="${
		ref(AMBIENT_ANIMATION + index)
	}" x="200" y="0"/></StateMachineLayer>`;
}

function dramaRange(stage: RevealDrama): readonly [number, number] {
	const indices = FINISHES.flatMap((
		finish,
		index,
	) => (finish.drama === stage ? [index] : []));

	return [Math.min(...indices), Math.max(...indices)];
}

function dramaLayer(): string {
	const rest = nextState();
	const states = REVEAL_DRAMA_ORDER.map(() => nextState());
	const transitions = REVEAL_DRAMA_ORDER.map((stage, i) => {
		const [low, high] = dramaRange(stage);

		return `<StateTransition stateToId="${
			ref(states[i] ?? raise("missing state"))
		}">${revealFired}${numberIs("finish", "greaterThanOrEqual", low)}${
			numberIs("finish", "lessThanOrEqual", high)
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
}">${chestLayer()}${finishLayer()}${
	durations.map(ambientLayer).join("")
}${dramaLayer()}</StateMachine>`;

// ---------------------------------------------------------------------------
// Document.

const defaults: Readonly<Record<LayerId, number>> = {
	background: 0,
	finish: 0,
	pattern: 0,
	lock: 0,
	decoration: 0,
	contents: -1,
	effect: 0,
};

const viewModel = `<ViewModel name="Exclusive NFT" id="${
	ref(VIEW_MODEL)
}" defaultInstanceId="${ref(VIEW_MODEL_INSTANCE)}">${
	LAYERS.map((layer) =>
		`<ViewModelPropertyNumber name="${layer.id}" id="${
			ref(PROPERTY_ID[layer.id])
		}"/>`
	).join("")
}<ViewModelPropertyTrigger name="reveal" id="${
	ref(REVEAL)
}"/><ViewModelInstance name="Default" id="${
	ref(VIEW_MODEL_INSTANCE)
}" exports="true">${
	LAYERS.map((layer) =>
		`<ViewModelInstanceNumber viewModelPropertyId="${
			ref(PROPERTY_ID[layer.id])
		}" propertyValue="${defaults[layer.id]}"/>`
	).join("")
}<ViewModelInstanceTrigger viewModelPropertyId="${
	ref(REVEAL)
}"/></ViewModelInstance></ViewModel>`;

const animations = [
	closedChest,
	idleChest,
	revealChest,
	...ambients,
	...finishPoses,
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
  ${converters.join("\n  ")}
  ${viewModel}
</Rive>
`;

writeFileSync(new URL("./scene.rml", import.meta.url), document);
console.log(
	`Wrote scene.rml: ${writer.keys.size} keyed groups, ${converters.length} converters, ${writer.motions.length} motions, ${
		(document.length / 1024).toFixed(0)
	} KB`,
);
