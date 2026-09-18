import { readFileSync, writeFileSync } from "node:fs";

// Generates only the marked detail/particle/timeline sections. The hand-authored
// silhouette, hierarchy and paint remain editable in scene.rml.
const source = new URL("./scene.rml", import.meta.url);
let scene = readFileSync(source, "utf8");
const ink = "FF243D40";
const gold = "FFF5C54E";
type Point = readonly [number, number];
type Key = readonly [number, number];
const number = (value: number) => Number(value.toFixed(3));

function section(name: string, contents: string) {
	const start = `<!-- ${name}:start -->`;
	const end = `<!-- ${name}:end -->`;
	if (!scene.includes(start) || !scene.includes(end)) {
		throw new Error(`Missing RML section: ${name}`);
	}
	const before = scene.slice(0, scene.indexOf(start) + start.length);
	const after = scene.slice(scene.indexOf(end));
	scene = `${before}\n${contents}\n    ${after}`;
}

function path(
	name: string,
	points: readonly Point[],
	fill?: string,
	color = ink,
	width = 2,
) {
	return `<Shape name="${name}"><PointsPath isClosed="${Boolean(fill)}">${
		points.map(([x, y]) => `<StraightVertex x="${x}" y="${y}"/>`).join("")
	}</PointsPath>${
		fill ? `<Fill><SolidColor colorValue="${fill}"/></Fill>` : ""
	}<Stroke thickness="${width}" cap="round" join="round"><SolidColor colorValue="${color}"/></Stroke></Shape>`;
}

const bands = [-111, 106].flatMap((x) => [
	path(
		"Strap highlight",
		[[x - 8, -159], [x - 7, -33]],
		undefined,
		"FFFFE5A0",
		3,
	),
	...[-151, -37].map((y) =>
		`<Shape name="Hammered brass rivet"><Ellipse x="${x}" y="${y}" width="7" height="7"/><Fill><SolidColor colorValue="${ink}"/></Fill></Shape>`
	),
	path(
		"Brass body strap",
		[[x - 17, -175], [x + 16, -176], [x + 15, -17], [x - 15, -15]],
		gold,
		ink,
		3,
	),
]);
section(
	"details",
	[
		...bands,
		path(
			"Lower gold edge",
			[[-140, -27], [144, -31], [144, -9], [-139, -5]],
			gold,
			ink,
			3,
		),
		path(
			"Upper gold edge",
			[[-151, -183], [155, -180], [153, -160], [-151, -163]],
			gold,
			ink,
			3,
		),
		path("Wood seam upper", [[-145, -113], [-61, -116], [22, -112], [
			151,
			-115,
		]]),
		path("Wood seam lower", [[-143, -70], [-48, -73], [35, -68], [148, -72]]),
		path(
			"Paint edge glint",
			[[-83, -150], [-41, -152], [-30, -151]],
			undefined,
			"FF9DE0C2",
			3,
		),
		path(
			"Paint edge glint",
			[[31, -149], [65, -148], [82, -150]],
			undefined,
			"FF9DE0C2",
			3,
		),
		path(
			"Wood knot",
			[[31, -94], [44, -99], [60, -95], [45, -89], [31, -94]],
			undefined,
			"FF247970",
			1.8,
		),
		path(
			"Paint scratch",
			[[-77, -91], [-63, -93], [-46, -91]],
			undefined,
			"FF247970",
			1.8,
		),
		...Array.from({ length: 7 }, (_, i) =>
			path(
				"Hand ink hatch",
				[[65 + i * 4, -50], [71 + i * 4, -42]],
				undefined,
				ink,
				1.2,
			)),
		path(
			"Dry brush lower edge",
			[[-86, -39], [-61, -40], [-32, -38], [-9, -40]],
			undefined,
			"FF247970",
			1.5,
		),
	].join("\n"),
);
section(
	"lid-details",
	[
		...[-111, 106].flatMap((x) => [
			path(
				"Lid strap light",
				[[x - 8, -87], [x - 7, -14]],
				undefined,
				"FFFFE5A0",
				3,
			),
			path(
				"Lid strap",
				[[x - 17, -100], [x + 16, -101], [x + 16, -1], [x - 16, 0]],
				gold,
				ink,
				3,
			),
		]),
		path(
			"Lid top glint",
			[[-79, -86], [-40, -89], [29, -88], [81, -90]],
			undefined,
			"FF9DE0C2",
			3,
		),
		path("Lid plank seam", [[-148, -42], [-79, -44], [-1, -41], [86, -45], [
			153,
			-42,
		]]),
		path(
			"Lid timber scratch",
			[[-67, -59], [-43, -62], [-14, -61]],
			undefined,
			"FF247970",
			1.5,
		),
		...Array.from({ length: 6 }, (_, i) =>
			path(
				"Lid sketch hatch",
				[[43 + i * 4, -25], [50 + i * 4, -18]],
				undefined,
				ink,
				1.2,
			)),
	].join("\n"),
);

const starCount = 48;
section(
	"stars",
	Array.from({ length: starCount }, (_, i) => {
		const size = i < 28 ? 14 + (i % 5) * 4 : i < 36 ? 20 : 7;
		const fill = [gold, "FFEF7869", "FF55BCAE", "FFFFDE87"][i % 4];
		return `<Node name="${i < 28 ? "Shooting" : "Orbit"} star ${i + 1}" id="0:${
			100 + i
		}" x="320" y="335" scaleX="0" scaleY="0"><Shape><Star width="${size}" height="${size}" points="${
			i % 3 === 0 ? 4 : 5
		}" innerRadius="0.43"/><Fill><SolidColor colorValue="${fill}"/></Fill><Stroke thickness="${
			i < 36 ? 1.8 : 1
		}" join="round"><SolidColor colorValue="${ink}"/></Stroke></Shape></Node>`;
	}).join("\n"),
);

function property(key: number, keys: readonly Key[], easing = true) {
	return `<KeyedProperty propertyKey="${key}">${
		keys.map(([frame, value]) =>
			`<KeyFrameDouble frame="${frame}" value="${
				number(value)
			}" interpolationType="${easing ? "cubic" : "linear"}">${
				easing
					? '<CubicEaseInterpolator x1="0.38" y1="0" x2="0.35" y2="1"/>'
					: ""
			}</KeyFrameDouble>`
		).join("")
	}</KeyedProperty>`;
}
function keyed(id: number, properties: string[]) {
	return `<KeyedObject objectId="0:${id}">${properties.join("")}</KeyedObject>`;
}
type Pose = readonly [
	frame: number,
	lift: number,
	sx: number,
	sy: number,
	rotation: number,
];
const poses: readonly Pose[] = [
	[0, 0, 1, 1, 0],
	[15, 0, 1, 1, 0],
	[26, 0, 1.13, .8, -.018],
	[34, 0, 1.27, .59, .02],
	[40, 22, .83, 1.24, -.035],
	[48, 110, .96, 1.05, .025],
	[54, 113, 1.04, .94, .035],
	[65, 0, 1.25, .68, -.022],
	[76, 57, .94, 1.08, -.03],
	[85, 0, 1.17, .8, .02],
	[93, 29, .96, 1.09, .015],
	[101, 0, 1.1, .88, -.01],
	[108, 12, .98, 1.045, 0],
	[115, 0, 1.045, .96, 0],
	[125, 0, 1, 1, 0],
	[150, 0, 1, 1, 0],
];

function animation(outcome: number) {
	const sad = outcome === 2;
	const strength = outcome === 0 ? 1 : sad ? .24 : .68;
	const name = ["Big prize", "Small prize", "Disappointed"][outcome];
	const bounce = poses.map(([frame, lift, sx, sy, rotation]): Pose => [
		frame,
		lift * strength * (outcome === 1 && frame > 101 ? 0 : 1),
		1 + (sx - 1) * strength,
		1 + (sy - 1) * strength - (sad && frame >= 101 ? .12 : 0),
		rotation * strength + (sad && frame >= 101 ? .055 : 0),
	]);
	const tracks = [
		keyed(10, [
			property(14, bounce.map(([f, lift]) => [f, 550 - lift])),
			property(16, bounce.map(([f, , sx]) => [f, sx])),
			property(17, bounce.map(([f, , , sy]) => [f, sy])),
			property(15, bounce.map(([f, , , , r]) => [f, r])),
		]),
		keyed(15, [
			property(16, bounce.map(([f, lift]) => [f, 1 - lift / 230])),
			property(18, bounce.map(([f, lift]) => [f, .85 - lift / 230])),
		]),
		keyed(11, [
			property(17, [[0, 1], [40, 1], [49, 0], [150, 0]]),
			property(18, [[0, 1], [47, 1], [49, 0], [150, 0]], false),
		]),
		keyed(12, [
			property(17, [
				[0, 0],
				[46, 0],
				[57, 1.13],
				[66, .89],
				[77, 1.06],
				[91, 1],
				[110, sad ? .48 : 1],
				[150, sad ? .48 : 1],
			]),
		]),
		keyed(13, [
			property(15, [
				[0, 0],
				[31, -.15],
				[40, .25],
				[50, -1.15],
				[64, .45],
				[77, -.3],
				[90, .18],
				[110, 0],
				[150, 0],
			]),
		]),
		...Array.from(
			{ length: 3 },
			(_, i) =>
				keyed(21 + i, [
					property(18, [[0, i === outcome ? 1 : 0], [
						150,
						i === outcome ? 1 : 0,
					]]),
				]),
		),
		keyed(20, [
			property(
				13,
				sad
					? [[0, 320], [48, 320], [65, 385], [88, 433], [106, 443], [150, 443]]
					: [[0, 320], [150, 320]],
			),
			property(
				14,
				sad
					? [[0, 335], [48, 335], [65, 243], [88, 519], [97, 480], [106, 527], [
						150,
						527,
					]]
					: [[0, 335], [46, 335], [60, 136], [74, 165], [90, 143], [110, 154], [
						150,
						154,
					]],
			),
			property(16, [
				[0, 0],
				[47, 0],
				[57, 1.2],
				[69, .9],
				[83, 1.07],
				[103, 1],
				[150, 1],
			]),
			property(17, [
				[0, 0],
				[47, 0],
				[57, 1.2],
				[69, .9],
				[83, 1.07],
				[103, 1],
				[150, 1],
			]),
			property(15, [
				[0, -.9],
				[47, -.9],
				[67, sad ? 2 : 6.4],
				[86, sad ? 4 : 6.13],
				[108, sad ? 5.8 : 6.28],
				[150, sad ? 5.8 : 6.28],
			]),
		]),
	];
	for (let i = 0; i < starCount; i++) {
		const enabled = !sad &&
			(outcome === 0 || i < 12 || (i >= 28 && i < 32) || (i >= 36 && i < 40));
		if (!enabled) {
			tracks.push(
				keyed(100 + i, [
					property(16, [[0, 0], [150, 0]]),
					property(17, [[0, 0], [150, 0]]),
				]),
			);
			continue;
		}
		if (i < 28) {
			const start = 48 + (i % 7) * 2 + (i >= 20 ? 29 : 0);
			const angle = -Math.PI * .94 + (i % 10) / 9 * Math.PI * .88;
			const distance = 170 + (i % 3) * 52;
			const x = 320 + Math.cos(angle) * distance;
			const y = 330 + Math.sin(angle) * distance;
			const scale: Key[] = [
				[0, 0],
				[start, 0],
				[start + 7, 1.25],
				[start + 17, .85],
				[start + 28, 1],
				[start + 44, 0],
				[150, 0],
			];
			tracks.push(keyed(100 + i, [
				property(13, [[0, 320], [start, 320], [start + 19, x], [
					start + 44,
					x + Math.cos(angle) * 28,
				], [150, x]]),
				property(14, [[0, 330], [start, 330], [start + 19, y], [
					start + 44,
					y + 160,
				], [150, y + 160]]),
				property(
					15,
					[[0, 0], [start, 0], [start + 44, (i % 2 ? 1 : -1) * 8]],
					false,
				),
				property(16, scale),
				property(17, scale),
			]));
		} else {
			const x: Key[] = [[0, 320], [55, 320]];
			const y: Key[] = [[0, 330], [55, 330]];
			const scale: Key[] = [[0, 0], [55, 0]];
			for (let f = 60; f <= 135; f += 5) {
				const angle = (i % 8) * Math.PI / 4 + (f - 60) / 75 * Math.PI * 2 -
					(i >= 36 ? .19 : 0);
				x.push([f, 320 + Math.cos(angle) * (i >= 36 ? 154 : 145)]);
				y.push([f, 163 + Math.sin(angle) * 92]);
				scale.push([
					f,
					f >= 125 ? (135 - f) / 10 : .65 + Math.sin(f * .28 + i) * .3,
				]);
			}
			scale.push([150, 0]);
			tracks.push(
				keyed(100 + i, [
					property(13, x, false),
					property(14, y, false),
					property(16, scale, false),
					property(17, scale, false),
					property(15, [[0, 0], [150, 10]], false),
				]),
			);
		}
	}
	return `<LinearAnimation name="${name}" id="0:${
		31 + outcome
	}" fps="30" duration="150" loopValue="oneShot">${
		tracks.join("\n")
	}</LinearAnimation>`;
}

section(
	"motion",
	`<LinearAnimation name="Idle" id="0:30" fps="30" duration="1" loopValue="oneShot"/>\n${
		[0, 1, 2].map(animation).join("\n")
	}`,
);
section(
	"preview",
	`<StateMachine name="Preview" id="0:3"><StateMachineLayer name="Reaction"><AnyState x="0" y="-150"/><ExitState x="200" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="0:4"/></EntryState><AnimationState id="0:4" animationId="0:30" x="200" y="0">${
		[0, 1, 2].map((i) =>
			`<StateTransition stateToId="0:${
				5 + i
			}" duration="0"><TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="0:40-0:42" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="${i}"/></TransitionViewModelCondition></StateTransition>`
		).join("")
	}</AnimationState>${
		[0, 1, 2].map((i) =>
			`<AnimationState id="0:${5 + i}" animationId="0:${
				31 + i
			}" reset="true" x="450" y="${i * 150}"/>`
		).join("")
	}</StateMachineLayer></StateMachine>`,
);
writeFileSync(source, scene);
